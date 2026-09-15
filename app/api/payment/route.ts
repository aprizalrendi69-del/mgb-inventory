import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

import {
  PaymentMethod,
  PaymentStatus,
  Role,
} from "@prisma/client";

/*
===========================================================
PAYMENT API
===========================================================

FLOW FINAL MGB ERP
===========================================================

A. INITIAL PAYMENT PO
-----------------------------------------------------------

POST /api/payment

{
  purchaseId / outletPurchaseId,
  amount,
  method
}

                    ↓

              Payment PENDING
                    ↓
        /api/payment/[id]/approve
                    ↓

CASH / COD / CBD
    → Payment PAID
    → Petty Cash OUT

TRANSFER
    → Payment PAID
    → tidak ada Petty Cash

TEMPO
    → Payment APPROVED
    → tidak ada Petty Cash
    → TIDAK membuat PurchasePayable


===========================================================
B. PURCHASE RECEIPT
===========================================================

PO APPROVED
    ↓
Goods Receipt
    ↓
Supplier Invoice Number disimpan di Receipt
    ↓
Jika paymentMethod = TEMPO
    ↓
PurchasePayable dibuat


===========================================================
C. PAYABLE SETTLEMENT
===========================================================

POST /api/payment

{
  payableId,
  amount,
  method
}

                    ↓

CASH / COD / CBD
    → Payment PAID
    → Petty Cash OUT
    → payable.paidAmount bertambah

TRANSFER
    → Payment PAID
    → tidak ada Petty Cash
    → payable.paidAmount bertambah

TEMPO
    → TIDAK BOLEH


===========================================================
IMPORTANT BUSINESS RULE
===========================================================

PurchasePayable HANYA dibuat oleh:

1. Goods Receipt
2. Outlet Receipt

Payment API TIDAK BOLEH membuat PurchasePayable.


===========================================================
INVOICE SOURCE
===========================================================

Untuk PAYMENT:

TEMPO / settlement:
    PurchasePayable.invoiceNumber
        ↓
    Receipt.invoiceNumber fallback

NON TEMPO:
    Purchase Pusat
        ↓
    Receipt.invoiceNumber

Purchase Outlet
        ↓
    OutletReceipt.invoiceNumber


===========================================================
PAYABLE SOURCE OF TRUTH
===========================================================

Jika settlement:

payableId
    ↓
PurchasePayable
    ↓
purchase / outletPurchase
    ↓
supplier
    ↓
outlet
    ↓
amount
    ↓
outstanding


Settlement TIDAK mempercayai:

purchaseId
outletPurchaseId
supplierId
outletId
total

yang dikirim dari frontend.


===========================================================
INITIAL PAYMENT SOURCE OF TRUTH
===========================================================

Purchase.paymentMethod
atau
OutletPurchase.paymentMethod

adalah source of truth.


===========================================================
OUTLET SECURITY
===========================================================

ADMIN
MANAGER
    → seluruh transaksi

OUTLET_ADMIN
    → hanya PO outlet miliknya
    → tidak boleh PO pusat
    → tidak boleh outlet lain
    → settlement hanya payable outlet miliknya


===========================================================
PAYMENT STATUS
===========================================================

INITIAL:

PENDING
    ↓
approve

CASH / COD / CBD / TRANSFER
    ↓
PAID

TEMPO
    ↓
APPROVED


SETTLEMENT:

langsung PAID

karena settlement dibuat sebagai transaksi pembayaran
yang sudah dilakukan.
===========================================================
*/


/*
===========================================================
CURRENT USER
===========================================================
*/

async function getCurrentUser() {
  try {
    const cookieStore = await cookies();

    const session =
      cookieStore.get("erp-session");

    if (!session?.value) {
      return null;
    }

    let sessionData: any;

    try {
      sessionData =
        JSON.parse(session.value);
    } catch {
      return null;
    }

    const sessionUser =
      sessionData?.user ??
      sessionData?.data?.user ??
      sessionData?.data ??
      sessionData;

    const userId =
      Number(sessionUser?.id);

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return null;
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
          username: true,
          fullname: true,
          role: true,
          active: true,
          outletId: true,
        },
      });

    if (!user || !user.active) {
      return null;
    }

    return user;
  } catch (error) {
    console.error(
      "GET CURRENT USER PAYMENT ERROR:",
      error
    );

    return null;
  }
}


/*
===========================================================
HELPERS
===========================================================
*/


/*
-----------------------------------------------------------
NORMALIZE PAYMENT METHOD
-----------------------------------------------------------
*/

function normalizePaymentMethod(
  value: unknown
): PaymentMethod | null {
  const method =
    String(value ?? "")
      .trim()
      .toUpperCase();

  /*
  Backward compatibility.
  */

  if (method === "PETTY_CASH") {
    return PaymentMethod.CASH;
  }

  if (
    !Object.values(PaymentMethod).includes(
      method as PaymentMethod
    )
  ) {
    return null;
  }

  return method as PaymentMethod;
}


/*
-----------------------------------------------------------
NORMALIZE DATE
-----------------------------------------------------------
*/

function normalizeDate(
  value: unknown
): Date {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return new Date();
  }

  const date =
    new Date(String(value));

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "INVALID_PAYMENT_DATE"
    );
  }

  return date;
}


/*
-----------------------------------------------------------
ROUND MONEY
-----------------------------------------------------------

Semua nominal menggunakan 2 decimal.

JANGAN gunakan:

+ 0.01
+ 0.001
+ tolerance lain

untuk menentukan lunas / overpayment.
-----------------------------------------------------------
*/

function roundMoney(
  value: number
) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return (
    Math.round(
      (value + Number.EPSILON) *
        100
    ) / 100
  );
}


/*
-----------------------------------------------------------
PAYMENT METHOD VALID
-----------------------------------------------------------
*/

function isValidPaymentMethod(
  method: PaymentMethod
) {
  return (
    method === PaymentMethod.CASH ||
    method === PaymentMethod.COD ||
    method === PaymentMethod.CBD ||
    method === PaymentMethod.TRANSFER ||
    method === PaymentMethod.TEMPO
  );
}


/*
-----------------------------------------------------------
SETTLEMENT METHOD
-----------------------------------------------------------

TEMPO tidak boleh dipakai untuk settlement.
-----------------------------------------------------------
*/

function isSettlementMethod(
  method: PaymentMethod
) {
  return (
    method === PaymentMethod.CASH ||
    method === PaymentMethod.COD ||
    method === PaymentMethod.CBD ||
    method === PaymentMethod.TRANSFER
  );
}


/*
-----------------------------------------------------------
PETTY CASH METHOD
-----------------------------------------------------------
*/

function isPettyCashMethod(
  method: PaymentMethod
) {
  return (
    method === PaymentMethod.CASH ||
    method === PaymentMethod.COD ||
    method === PaymentMethod.CBD
  );
}


/*
-----------------------------------------------------------
OUTLET ADMIN
-----------------------------------------------------------
*/

function isOutletAdmin(
  user: {
    role: Role;
  }
) {
  return (
    user.role ===
    Role.OUTLET_ADMIN
  );
}


/*
-----------------------------------------------------------
ERROR MESSAGE
-----------------------------------------------------------
*/

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : String(error ?? "");
}


/*
-----------------------------------------------------------
NORMALIZE INVOICE
-----------------------------------------------------------
*/

function normalizeInvoiceNumber(
  value: unknown
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const invoice =
    String(value).trim();

  return invoice !== ""
    ? invoice
    : null;
}


/*
===========================================================
GENERATE PAYMENT NUMBER
===========================================================
*/

async function generatePaymentNumber(
  tx: any,
  paymentDate: Date
) {
  const year =
    paymentDate.getFullYear();

  const month =
    String(
      paymentDate.getMonth() + 1
    ).padStart(2, "0");

  const period =
    `${year}${month}`;

  const document =
    await tx.documentNumber.upsert({
      where: {
        type_period: {
          type: "PAYMENT",
          period,
        },
      },

      create: {
        type: "PAYMENT",
        prefix: "PAY",
        period,
        lastNumber: 1,
      },

      update: {
        lastNumber: {
          increment: 1,
        },
      },
    });

  return (
    `${document.prefix}-${period}-` +
    String(
      document.lastNumber
    ).padStart(5, "0")
  );
}


/*
===========================================================
GET PAYMENT
===========================================================
*/

export async function GET(
  req: NextRequest
) {
  try {
    /*
    ========================================================
    CURRENT USER
    ========================================================
    */

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }


    /*
    ========================================================
    QUERY PARAMS
    ========================================================
    */

    const {
      searchParams,
    } = new URL(req.url);

    const statusParam =
      searchParams.get("status");

    const supplierIdParam =
      searchParams.get(
        "supplierId"
      );

    const purchaseIdParam =
      searchParams.get(
        "purchaseId"
      );

    const outletPurchaseIdParam =
      searchParams.get(
        "outletPurchaseId"
      );

    const payableIdParam =
      searchParams.get(
        "payableId"
      );

    const methodParam =
      searchParams.get("method");


    /*
    ========================================================
    WHERE
    ========================================================
    */

    const where: any = {};


    /*
    ========================================================
    STATUS
    ========================================================
    */

    if (statusParam) {
      const status =
        String(statusParam)
          .trim()
          .toUpperCase();

      if (
        Object.values(
          PaymentStatus
        ).includes(
          status as PaymentStatus
        )
      ) {
        where.status =
          status as PaymentStatus;
      }
    }


    /*
    ========================================================
    METHOD
    ========================================================
    */

    if (methodParam) {
      const method =
        normalizePaymentMethod(
          methodParam
        );

      if (method) {
        where.method = method;
      }
    }


    /*
    ========================================================
    SUPPLIER
    ========================================================
    */

    if (supplierIdParam) {
      const supplierId =
        Number(
          supplierIdParam
        );

      if (
        Number.isInteger(
          supplierId
        ) &&
        supplierId > 0
      ) {
        where.supplierId =
          supplierId;
      }
    }


    /*
    ========================================================
    PURCHASE PUSAT
    ========================================================
    */

    if (purchaseIdParam) {
      const purchaseId =
        Number(
          purchaseIdParam
        );

      if (
        Number.isInteger(
          purchaseId
        ) &&
        purchaseId > 0
      ) {
        where.purchaseId =
          purchaseId;
      }
    }


    /*
    ========================================================
    PURCHASE OUTLET
    ========================================================
    */

    if (outletPurchaseIdParam) {
      const outletPurchaseId =
        Number(
          outletPurchaseIdParam
        );

      if (
        Number.isInteger(
          outletPurchaseId
        ) &&
        outletPurchaseId > 0
      ) {
        where.outletPurchaseId =
          outletPurchaseId;
      }
    }


    /*
    ========================================================
    PAYABLE FILTER
    ========================================================

    payableId adalah source of truth untuk settlement.

    Untuk kompatibilitas data lama,
    relasi PO juga dicari.
    ========================================================
    */

    if (payableIdParam) {
      const payableId =
        Number(
          payableIdParam
        );

      if (
        Number.isInteger(
          payableId
        ) &&
        payableId > 0
      ) {
        where.OR = [
          {
            payableId,
          },

          {
            purchase: {
              payable: {
                id: payableId,
              },
            },
          },

          {
            outletPurchase: {
              payable: {
                id: payableId,
              },
            },
          },
        ];
      }
    }


    /*
    ========================================================
    OUTLET ADMIN SECURITY
    ========================================================
    */

    if (
      isOutletAdmin(user)
    ) {
      if (!user.outletId) {
        return NextResponse.json({
          success: true,

          data: [],

          meta: {
            role: user.role,
            outletId: null,
          },
        });
      }

      /*
      OUTLET_ADMIN hanya boleh melihat
      payment PO outlet miliknya.

      Payment PO pusat otomatis tidak lolos
      kondisi ini.
      */

      where.outletPurchase = {
        outletId:
          user.outletId,
      };
    }


    /*
    ========================================================
    QUERY PAYMENT
    ========================================================
    */

    const payments =
      await prisma.payment.findMany({
        where,

        include: {
          supplier: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          payable: {
            select: {
              id: true,
              invoiceNumber: true,
              invoiceDate: true,
              dueDate: true,
              amount: true,
              paidAmount: true,
              outstanding: true,
              status: true,
              purchaseId: true,
              outletPurchaseId: true,
            },
          },

          /*
          ==================================================
          PURCHASE PUSAT
          ==================================================
          */

          purchase: {
            select: {
              id: true,
              number: true,
              purchaseDate: true,
              status: true,
              total: true,
              paymentMethod: true,

              payable: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  invoiceDate: true,
                  dueDate: true,
                  amount: true,
                  paidAmount: true,
                  outstanding: true,
                  status: true,
                },
              },

              /*
              =================================================
              RECEIPT PUSAT
              =================================================

              Invoice supplier Barang Masuk Pusat
              berasal dari Receipt.invoiceNumber.

              Tidak mengambil OutletReceipt.
              =================================================
              */

              receipts: {
                select: {
                  id: true,
                  number: true,
                  receiptDate: true,
                  invoiceNumber: true,
                },

                orderBy: {
                  receiptDate:
                    "desc",
                },

                take: 1,
              },
            },
          },

          /*
          ==================================================
          PURCHASE OUTLET
          ==================================================
          */

          outletPurchase: {
            select: {
              id: true,
              number: true,
              purchaseDate: true,
              status: true,
              total: true,
              paymentMethod: true,

              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },

              payable: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  invoiceDate: true,
                  dueDate: true,
                  amount: true,
                  paidAmount: true,
                  outstanding: true,
                  status: true,
                },
              },

              /*
              =================================================
              OUTLET RECEIPT
              =================================================
              */

              receipts: {
                select: {
                  id: true,
                  number: true,
                  receiptDate: true,
                  invoiceNumber: true,
                },

                orderBy: {
                  receiptDate:
                    "desc",
                },

                take: 1,
              },
            },
          },

          account: {
            select: {
              id: true,
              code: true,
              name: true,
              outletId: true,
            },
          },
        },

        orderBy: [
          {
            paymentDate:
              "desc",
          },
          {
            id: "desc",
          },
        ],
      });


    /*
    ========================================================
    RESPONSE
    ========================================================
    */

    return NextResponse.json({
      success: true,

      data: payments.map(
        (payment) => {
          /*
          --------------------------------------------------
          PAYABLE SOURCE
          --------------------------------------------------

          Prioritas:

          payment.payable
              ↓
          purchase.payable
              ↓
          outletPurchase.payable
          --------------------------------------------------
          */

          const payable =
            payment.payable ??
            payment.purchase?.payable ??
            payment.outletPurchase
              ?.payable ??
            null;


          /*
          --------------------------------------------------
          RECEIPT SOURCE
          --------------------------------------------------

          SANGAT PENTING:

          Purchase Pusat
              →
          Purchase.receipts

          Purchase Outlet
              →
          OutletPurchase.receipts

          Tidak boleh silang.
          --------------------------------------------------
          */

          const receipt =
            payment.purchase
              ? payment.purchase
                  .receipts?.[0] ??
                null
              : payment.outletPurchase
                ? payment
                    .outletPurchase
                    .receipts?.[0] ??
                  null
                : null;


          /*
          --------------------------------------------------
          INVOICE SOURCE
          --------------------------------------------------

          PRIORITAS:

          1. PurchasePayable.invoiceNumber
          2. Receipt.invoiceNumber

          Untuk Purchase Pusat:

          PurchasePayable
              ↓
          Receipt

          Untuk Purchase Outlet:

          PurchasePayable
              ↓
          OutletReceipt
          --------------------------------------------------
          */

          const invoiceNumber =
            normalizeInvoiceNumber(
              payable?.invoiceNumber
            ) ??
            normalizeInvoiceNumber(
              receipt?.invoiceNumber
            ) ??
            null;


          /*
          --------------------------------------------------
          INVOICE DATE
          --------------------------------------------------
          */

          const invoiceDate =
            payable?.invoiceDate ??
            receipt?.receiptDate ??
            null;


          /*
          --------------------------------------------------
          SOURCE
          --------------------------------------------------
          */

          const source =
            payment.purchase
              ? "PURCHASE"
              : payment.outletPurchase
                ? "OUTLET_PURCHASE"
                : "UNKNOWN";


          /*
          --------------------------------------------------
          TRANSACTION NUMBER
          --------------------------------------------------
          */

          const transactionNumber =
            payment.purchase
              ?.number ??
            payment.outletPurchase
              ?.number ??
            "-";


          /*
          --------------------------------------------------
          PAYMENT TYPE
          --------------------------------------------------
          */

          const paymentType =
            payable
              ? "PAYABLE_SETTLEMENT"
              : "INITIAL_PAYMENT";


          /*
          --------------------------------------------------
          RETURN
          --------------------------------------------------
          */

          return {
            ...payment,

            /*
            ------------------------------------------------
            UNIVERSAL INVOICE
            ------------------------------------------------

            Frontend dapat langsung menggunakan:

            payment.invoiceNumber
            */

            invoiceNumber,

            invoiceDate,

            /*
            ------------------------------------------------
            PAYABLE ID
            ------------------------------------------------
            */

            payableId:
              payment.payableId ??
              payable?.id ??
              null,

            /*
            ------------------------------------------------
            SOURCE
            ------------------------------------------------
            */

            source,

            paymentType,

            transactionNumber,

            /*
            ------------------------------------------------
            SUPPLIER
            ------------------------------------------------
            */

            supplierName:
              payment.supplier?.name ??
              "-",

            /*
            ------------------------------------------------
            OUTLET
            ------------------------------------------------
            */

            outletName:
              payment.outletPurchase
                ?.outlet?.name ??
              "-",

            /*
            ------------------------------------------------
            PAYABLE
            ------------------------------------------------
            */

            payableStatus:
              payable?.status ??
              null,

            payableOutstanding:
              payable?.outstanding ??
              null,

            /*
            ------------------------------------------------
            BACKWARD COMPATIBILITY
            ------------------------------------------------
            */

            payableInvoiceNumber:
              normalizeInvoiceNumber(
                payable?.invoiceNumber
              ) ??
              invoiceNumber,

            payableInvoiceDate:
              payable?.invoiceDate ??
              invoiceDate,

            payableDueDate:
              payable?.dueDate ??
              null,

            /*
            ------------------------------------------------
            RECEIPT INFO
            ------------------------------------------------
            */

            receiptNumber:
              receipt?.number ??
              null,

            receiptDate:
              receipt?.receiptDate ??
              null,
          };
        }
      ),

      meta: {
        role: user.role,

        outletId:
          user.outletId,

        paymentFlow:
          "Initial Payment PO dibuat PENDING dan diproses melalui approval.",

        settlementFlow:
          "Settlement Purchase Payable menggunakan payableId sebagai source of truth.",

        invoiceFlow:
          "Invoice supplier Purchase Pusat diambil dari PurchasePayable.invoiceNumber atau Receipt.invoiceNumber. Invoice Purchase Outlet diambil dari PurchasePayable.invoiceNumber atau OutletReceipt.invoiceNumber.",

        pettyCashFlow:
          "CASH/COD/CBD mengurangi Petty Cash ketika payment disetujui atau settlement dilakukan.",

        transferFlow:
          "TRANSFER tidak mengurangi Petty Cash.",

        tempoFlow:
          "TEMPO tidak membuat PurchasePayable pada Payment API. Payable dibuat saat barang diterima melalui Receipt.",

        outletSecurity:
          "OUTLET_ADMIN hanya dapat melihat payment Purchase Outlet miliknya.",
      },
    });
  } catch (error) {
    console.error(
      "GET PAYMENT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil data payment",
      },
      {
        status: 500,
      }
    );
  }
}


/*
===========================================================
POST PAYMENT
===========================================================
*/

export async function POST(
  req: NextRequest
) {
  try {
    /*
    ========================================================
    CURRENT USER
    ========================================================
    */

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }


    /*
    ========================================================
    REQUEST BODY
    ========================================================
    */

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Request body tidak valid",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    SOURCE ID
    ========================================================
    */

    const purchaseIdRaw =
      body?.purchaseId;

    const outletPurchaseIdRaw =
      body?.outletPurchaseId;

    const payableIdRaw =
      body?.payableId;


    const purchaseId =
      purchaseIdRaw !==
        undefined &&
      purchaseIdRaw !== null &&
      purchaseIdRaw !== ""
        ? Number(
            purchaseIdRaw
          )
        : null;


    const outletPurchaseId =
      outletPurchaseIdRaw !==
        undefined &&
      outletPurchaseIdRaw !== null &&
      outletPurchaseIdRaw !== ""
        ? Number(
            outletPurchaseIdRaw
          )
        : null;


    const payableId =
      payableIdRaw !==
        undefined &&
      payableIdRaw !== null &&
      payableIdRaw !== ""
        ? Number(
            payableIdRaw
          )
        : null;


    /*
    ========================================================
    HAS PAYABLE
    ========================================================
    */

    const hasPayable =
      payableId !== null;


    /*
    ========================================================
    SETTLEMENT
    ========================================================
    */

    if (hasPayable) {
      /*
      ======================================================
      VALIDATE PAYABLE ID
      ======================================================
      */

      if (
        !Number.isInteger(
          payableId
        ) ||
        payableId! <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase Payable ID tidak valid.",
          },
          {
            status: 400,
          }
        );
      }


      /*
      ======================================================
      SETTLEMENT METHOD
      ======================================================
      */

      const settlementMethod =
        normalizePaymentMethod(
          body?.method
        );

      if (!settlementMethod) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Metode pembayaran settlement wajib dipilih.",
          },
          {
            status: 400,
          }
        );
      }


      if (
        !isSettlementMethod(
          settlementMethod
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Settlement hutang hanya dapat menggunakan CASH, COD, CBD, atau TRANSFER. TEMPO tidak dapat digunakan untuk settlement.",
          },
          {
            status: 400,
          }
        );
      }


      /*
      ======================================================
      AMOUNT
      ======================================================
      */

      const settlementAmount =
        roundMoney(
          Number(
            body?.amount
          )
        );

      if (
        !Number.isFinite(
          settlementAmount
        ) ||
        settlementAmount <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Jumlah pembayaran harus lebih dari 0.",
          },
          {
            status: 400,
          }
        );
      }


      /*
      ======================================================
      PAYMENT DATE
      ======================================================
      */

      let settlementPaymentDate: Date;

      try {
        settlementPaymentDate =
          normalizeDate(
            body?.paymentDate
          );
      } catch {
        return NextResponse.json(
          {
            success: false,
            message:
              "Tanggal pembayaran tidak valid.",
          },
          {
            status: 400,
          }
        );
      }


      /*
      ======================================================
      REFERENCE
      ======================================================
      */

      const referenceNumber =
        body?.referenceNumber !==
          undefined &&
        body?.referenceNumber !==
          null &&
        String(
          body.referenceNumber
        ).trim() !== ""
          ? String(
              body.referenceNumber
            ).trim()
          : null;


      /*
      ======================================================
      NOTE
      ======================================================
      */

      const noteSource =
        body?.note ??
        body?.remarks;

      const note =
        noteSource !== undefined &&
        noteSource !== null &&
        String(
          noteSource
        ).trim() !== ""
          ? String(
              noteSource
            ).trim()
          : null;


      /*
      ======================================================
      SETTLEMENT TRANSACTION
      ======================================================
      */

      const result =
        await prisma.$transaction(
          async (tx) => {
            /*
            ------------------------------------------------
            RELOAD PAYABLE
            ------------------------------------------------
            */

            const currentPayable =
              await tx.purchasePayable.findUnique(
                {
                  where: {
                    id:
                      payableId!,
                  },

                  include: {
                    purchase: {
                      include: {
                        supplier:
                          true,
                      },
                    },

                    outletPurchase: {
                      include: {
                        supplier:
                          true,
                        outlet:
                          true,
                      },
                    },
                  },
                }
              );


            if (!currentPayable) {
              throw new Error(
                "PAYABLE_NOT_FOUND"
              );
            }


            /*
            ------------------------------------------------
            SOURCE VALIDATION
            ------------------------------------------------
            */

            const hasPurchaseSource =
              !!currentPayable.purchase;

            const hasOutletSource =
              !!currentPayable
                .outletPurchase;


            if (
              !hasPurchaseSource &&
              !hasOutletSource
            ) {
              throw new Error(
                "PAYABLE_SOURCE_INVALID"
              );
            }


            if (
              hasPurchaseSource &&
              hasOutletSource
            ) {
              throw new Error(
                "PAYABLE_SOURCE_MULTIPLE"
              );
            }


            /*
            ------------------------------------------------
            OUTLET SECURITY
            ------------------------------------------------
            */

            if (
              isOutletAdmin(user)
            ) {
              if (!user.outletId) {
                throw new Error(
                  "OUTLET_ACCESS_DENIED"
                );
              }

              if (
                !currentPayable
                  .outletPurchase
              ) {
                throw new Error(
                  "OUTLET_ACCESS_DENIED"
                );
              }

              if (
                currentPayable
                  .outletPurchase
                  .outletId !==
                user.outletId
              ) {
                throw new Error(
                  "OUTLET_ACCESS_DENIED"
                );
              }
            }


            /*
            ------------------------------------------------
            PAYABLE AMOUNT
            ------------------------------------------------
            */

            const payableAmount =
              roundMoney(
                Number(
                  currentPayable
                    .amount ??
                    0
                )
              );


            const paidAmount =
              roundMoney(
                Number(
                  currentPayable
                    .paidAmount ??
                    0
                )
              );


            const outstanding =
              roundMoney(
                Math.max(
                  0,
                  payableAmount -
                    paidAmount
                )
              );


            /*
            ------------------------------------------------
            SUDAH LUNAS
            ------------------------------------------------
            */

            if (
              outstanding <= 0
            ) {
              throw new Error(
                "PAYABLE_ALREADY_PAID"
              );
            }


            /*
            ------------------------------------------------
            OVERPAYMENT
            ------------------------------------------------

            Exact comparison setelah roundMoney().
            Tidak ada +0.01.
            ------------------------------------------------
            */

            if (
              settlementAmount >
              outstanding
            ) {
              throw new Error(
                `SETTLEMENT_EXCEEDS_OUTSTANDING:${outstanding}`
              );
            }


            /*
            =================================================
            PETTY CASH ACCOUNT
            =================================================
            */

            let accountId:
              number | null =
              null;


            if (
              isPettyCashMethod(
                settlementMethod
              )
            ) {
              /*
              ------------------------------------------------
              REQUESTED ACCOUNT
              ------------------------------------------------
              */

              const requestedAccountId =
                body?.accountId !==
                  undefined &&
                body?.accountId !==
                  null &&
                body?.accountId !== ""
                  ? Number(
                      body.accountId
                    )
                  : null;


              if (
                requestedAccountId !==
                  null &&
                (
                  !Number.isInteger(
                    requestedAccountId
                  ) ||
                  requestedAccountId <= 0
                )
              ) {
                throw new Error(
                  "INVALID_ACCOUNT"
                );
              }


              /*
              ------------------------------------------------
              TARGET OUTLET
              ------------------------------------------------
              */

              let targetOutletId:
                number | null =
                null;


              if (
                currentPayable
                  .outletPurchase
              ) {
                targetOutletId =
                  currentPayable
                    .outletPurchase
                    .outletId;
              }


              /*
              CENTRAL PAYABLE
              */

              if (
                currentPayable
                  .purchase
              ) {
                targetOutletId =
                  null;
              }


              /*
              OUTLET ADMIN
              */

              if (
                isOutletAdmin(user)
              ) {
                targetOutletId =
                  user.outletId;
              }


              /*
              ------------------------------------------------
              EXPLICIT ACCOUNT
              ------------------------------------------------
              */

              if (
                requestedAccountId !==
                  null
              ) {
                const account =
                  await tx.pettyCashAccount.findUnique(
                    {
                      where: {
                        id:
                          requestedAccountId,
                      },
                    }
                  );


                if (!account) {
                  throw new Error(
                    "ACCOUNT_NOT_FOUND"
                  );
                }


                /*
                OUTLET ADMIN
                */

                if (
                  isOutletAdmin(user) &&
                  account.outletId !==
                    user.outletId
                ) {
                  throw new Error(
                    "ACCOUNT_ACCESS_DENIED"
                  );
                }


                /*
                PAYABLE OUTLET
                */

                if (
                  currentPayable
                    .outletPurchase
                ) {
                  if (
                    account.outletId !==
                    currentPayable
                      .outletPurchase
                      .outletId
                  ) {
                    throw new Error(
                      "ACCOUNT_OUTLET_MISMATCH"
                    );
                  }
                }


                /*
                PAYABLE PUSAT
                */

                if (
                  currentPayable.purchase &&
                  !currentPayable
                    .outletPurchase
                ) {
                  if (
                    account.outletId !==
                    null
                  ) {
                    throw new Error(
                      "ACCOUNT_MUST_BE_CENTRAL"
                    );
                  }
                }


                accountId =
                  account.id;
              }


              /*
              ------------------------------------------------
              AUTO ACCOUNT
              ------------------------------------------------
              */

              else {
                const account =
                  await tx.pettyCashAccount.findFirst(
                    {
                      where: {
                        outletId:
                          targetOutletId,
                        isActive:
                          true,
                      },

                      orderBy: {
                        id: "asc",
                      },
                    }
                  );


                if (!account) {
                  throw new Error(
                    "ACCOUNT_NOT_FOUND"
                  );
                }


                accountId =
                  account.id;
              }


              /*
              ------------------------------------------------
              RELOAD ACCOUNT
              ------------------------------------------------
              */

              const account =
                await tx.pettyCashAccount.findUnique(
                  {
                    where: {
                      id: accountId!,
                    },
                  }
                );


              if (!account) {
                throw new Error(
                  "ACCOUNT_NOT_FOUND"
                );
              }


              /*
              ------------------------------------------------
              BALANCE
              ------------------------------------------------
              */

              const currentBalance =
                roundMoney(
                  Number(
                    account
                      .currentBalance ??
                      0
                  )
                );


              if (
                settlementAmount >
                currentBalance
              ) {
                throw new Error(
                  `INSUFFICIENT_PETTY_CASH:${currentBalance}`
                );
              }
            }


            /*
            =================================================
            GENERATE PAYMENT NUMBER
            =================================================
            */

            const number =
              await generatePaymentNumber(
                tx,
                settlementPaymentDate
              );


            /*
            =================================================
            CREATE SETTLEMENT PAYMENT
            =================================================
            */

            const payment =
              await tx.payment.create({
                data: {
                  number,

                  purchaseId:
                    currentPayable
                      .purchaseId ??
                    null,

                  outletPurchaseId:
                    currentPayable
                      .outletPurchaseId ??
                    null,

                  payableId:
                    currentPayable.id,

                  supplierId:
                    currentPayable
                      .purchase
                      ?.supplierId ??
                    currentPayable
                      .outletPurchase
                      ?.supplierId ??
                    null,

                  paymentDate:
                    settlementPaymentDate,

                  amount:
                    settlementAmount,

                  method:
                    settlementMethod,

                  status:
                    PaymentStatus.PAID,

                  accountId,

                  referenceNumber,

                  note,

                  createdBy:
                    user.id,

                  approvedBy:
                    user.id,

                  approvedAt:
                    new Date(),
                },

                include: {
                  supplier: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                    },
                  },

                  payable: {
                    select: {
                      id: true,
                      invoiceNumber:
                        true,
                      invoiceDate:
                        true,
                      dueDate:
                        true,
                      amount: true,
                      paidAmount:
                        true,
                      outstanding:
                        true,
                      status: true,
                    },
                  },
                },
              });


            /*
            =================================================
            UPDATE PAYABLE
            =================================================
            */

            const newPaidAmount =
              roundMoney(
                paidAmount +
                  settlementAmount
              );


            const newOutstanding =
              roundMoney(
                Math.max(
                  0,
                  payableAmount -
                    newPaidAmount
                )
              );


            const newPayableStatus =
              newOutstanding === 0
                ? "PAID"
                : "OUTSTANDING";


            const updatedPayable =
              await tx.purchasePayable.update(
                {
                  where: {
                    id:
                      currentPayable.id,
                  },

                  data: {
                    paidAmount:
                      newPaidAmount,

                    outstanding:
                      newOutstanding,

                    status:
                      newPayableStatus,
                  },
                }
              );


            /*
            =================================================
            PETTY CASH
            =================================================
            */

            if (
              isPettyCashMethod(
                settlementMethod
              ) &&
              accountId
            ) {
              const account =
                await tx.pettyCashAccount.findUnique(
                  {
                    where: {
                      id:
                        accountId,
                    },
                  }
                );


              if (!account) {
                throw new Error(
                  "ACCOUNT_NOT_FOUND"
                );
              }


              const currentBalance =
                roundMoney(
                  Number(
                    account
                      .currentBalance ??
                      0
                  )
                );


              /*
              Recheck balance sebelum update.
              */

              if (
                settlementAmount >
                currentBalance
              ) {
                throw new Error(
                  `INSUFFICIENT_PETTY_CASH:${currentBalance}`
                );
              }


              const newBalance =
                roundMoney(
                  currentBalance -
                    settlementAmount
                );


              await tx.pettyCashAccount.update(
                {
                  where: {
                    id:
                      account.id,
                  },

                  data: {
                    currentBalance:
                      newBalance,
                  },
                }
              );
            }


            /*
            =================================================
            HISTORY
            =================================================
            */

            const sourceNumber =
              currentPayable
                .purchase
                ?.number ??
              currentPayable
                .outletPurchase
                ?.number ??
              currentPayable
                .invoiceNumber ??
              "-";


            await tx.history.create({
              data: {
                transactionType:
                  "PURCHASE",

                referenceNumber:
                  payment.number,

                description:
                  `Settlement Payment ${payment.number} untuk hutang ${
                    currentPayable
                      .invoiceNumber ??
                    sourceNumber
                  } sebesar ${settlementAmount} dengan metode ${settlementMethod}. Paid Amount menjadi ${newPaidAmount}, outstanding menjadi ${newOutstanding}.`,

                userId:
                  user.id,
              },
            });


            /*
            =================================================
            RESULT
            =================================================
            */

            return {
              payment,

              payable:
                updatedPayable,

              accountId,

              settlementMethod,

              pettyCashReduced:
                isPettyCashMethod(
                  settlementMethod
                ),
            };
          },
          {
            maxWait: 5000,
            timeout: 10000,
          }
        );


      /*
      ======================================================
      SETTLEMENT RESPONSE
      ======================================================
      */

      return NextResponse.json(
        {
          success: true,

          message:
            result.payable
              .status ===
            "PAID"
              ? "Pembayaran hutang berhasil. Hutang sudah lunas."
              : "Pembayaran hutang berhasil.",

          data: {
            payment:
              result.payment,

            payable:
              result.payable,

            /*
            Universal invoice.
            */

            invoiceNumber:
              result.payable
                .invoiceNumber ??
              null,

            flow: {
              type:
                "PAYABLE_SETTLEMENT",

              status:
                PaymentStatus.PAID,

              method:
                result.settlementMethod,

              pettyCash:
                result
                  .pettyCashReduced
                  ? "Saldo Petty Cash berkurang."
                  : "Tidak mengurangi Petty Cash.",

              outstanding:
                result.payable
                  .outstanding,

              payableStatus:
                result.payable
                  .status,
            },
          },
        },
        {
          status: 201,
        }
      );
    }


    /*
    ========================================================
    INITIAL PAYMENT PO
    ========================================================
    */

    const canCreateCentral =
      user.role === Role.ADMIN ||
      user.role === Role.MANAGER;


    const canCreateOutlet =
      user.role === Role.ADMIN ||
      user.role === Role.MANAGER ||
      user.role ===
        Role.OUTLET_ADMIN;


    /*
    ========================================================
    SOURCE
    ========================================================
    */

    const hasCentral =
      purchaseId !== null;

    const hasOutlet =
      outletPurchaseId !== null;


    const sourceCount =
      Number(hasCentral) +
      Number(hasOutlet);


    if (sourceCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment harus terkait PO pusat atau PO outlet.",
        },
        {
          status: 400,
        }
      );
    }


    if (sourceCount > 1) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment hanya boleh memiliki satu sumber transaksi.",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    VALIDATE SOURCE ID
    ========================================================
    */

    if (
      hasCentral &&
      (
        !Number.isInteger(
          purchaseId
        ) ||
        purchaseId! <= 0
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase ID tidak valid.",
        },
        {
          status: 400,
        }
      );
    }


    if (
      hasOutlet &&
      (
        !Number.isInteger(
          outletPurchaseId
        ) ||
        outletPurchaseId! <= 0
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet ID tidak valid.",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    METHOD
    ========================================================
    */

    const method =
      normalizePaymentMethod(
        body?.method
      );


    if (!method) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Metode pembayaran wajib dipilih.",
        },
        {
          status: 400,
        }
      );
    }


    if (
      !isValidPaymentMethod(
        method
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Metode pembayaran tidak valid.",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    AMOUNT
    ========================================================
    */

    const amount =
      roundMoney(
        Number(body?.amount)
      );


    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Jumlah pembayaran harus lebih dari 0.",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    PAYMENT DATE
    ========================================================
    */

    let paymentDate: Date;

    try {
      paymentDate =
        normalizeDate(
          body?.paymentDate
        );
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tanggal pembayaran tidak valid.",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    REFERENCE
    ========================================================
    */

    const referenceNumber =
      body?.referenceNumber !==
        undefined &&
      body?.referenceNumber !==
        null &&
      String(
        body.referenceNumber
      ).trim() !== ""
        ? String(
            body.referenceNumber
          ).trim()
        : null;


    /*
    ========================================================
    NOTE
    ========================================================
    */

    const noteSource =
      body?.note ??
      body?.remarks;


    const note =
      noteSource !== undefined &&
      noteSource !== null &&
      String(
        noteSource
      ).trim() !== ""
        ? String(
            noteSource
          ).trim()
        : null;


    /*
    ========================================================
    SOURCE OBJECT
    ========================================================
    */

    let purchase: any = null;

    let outletPurchase: any =
      null;


    /*
    ========================================================
    CENTRAL PURCHASE
    ========================================================
    */

    if (hasCentral) {
      purchase =
        await prisma.purchase.findUnique(
          {
            where: {
              id:
                purchaseId!,
            },

            include: {
              supplier: true,

              payable: true,
            },
          }
        );


      if (!purchase) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase Order Pusat tidak ditemukan.",
          },
          {
            status: 404,
          }
        );
      }


      /*
      ADMIN / MANAGER ONLY
      */

      if (!canCreateCentral) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda tidak memiliki akses membuat payment untuk Purchase Pusat.",
          },
          {
            status: 403,
          }
        );
      }


      /*
      PO DRAFT
      */

      if (
        purchase.status ===
        "DRAFT"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "PO masih DRAFT. Payment belum dapat dibuat.",
          },
          {
            status: 400,
          }
        );
      }


      /*
      PO PAYMENT METHOD
      */

      const poMethod =
        normalizePaymentMethod(
          purchase.paymentMethod
        );


      if (!poMethod) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Metode pembayaran pada PO belum ditentukan.",
          },
          {
            status: 400,
          }
        );
      }


      /*
      FRONTEND METHOD HARUS SAMA
      DENGAN PO.
      */

      if (
        poMethod !== method
      ) {
        return NextResponse.json(
          {
            success: false,

            message:
              `Metode payment harus mengikuti metode PO. Metode PO: ${poMethod}.`,
          },
          {
            status: 400,
          }
        );
      }
    }


    /*
    ========================================================
    OUTLET PURCHASE
    ========================================================
    */

    if (hasOutlet) {
      outletPurchase =
        await prisma.outletPurchase.findUnique(
          {
            where: {
              id:
                outletPurchaseId!,
            },

            include: {
              supplier: true,

              outlet: true,

              payable: true,
            },
          }
        );


      if (!outletPurchase) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase Order Outlet tidak ditemukan.",
          },
          {
            status: 404,
          }
        );
      }


      /*
      ADMIN / MANAGER / OUTLET ADMIN
      */

      if (!canCreateOutlet) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda tidak memiliki akses membuat payment Purchase Outlet.",
          },
          {
            status: 403,
          }
        );
      }


      /*
      OUTLET ADMIN
      */

      if (
        isOutletAdmin(user)
      ) {
        if (!user.outletId) {
          return NextResponse.json(
            {
              success: false,
              message:
                "User belum memiliki outlet.",
            },
            {
              status: 403,
            }
          );
        }


        if (
          outletPurchase
            .outletId !==
          user.outletId
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Anda tidak dapat membuat payment untuk outlet lain.",
            },
            {
              status: 403,
            }
          );
        }
      }


      /*
      PO DRAFT
      */

      if (
        outletPurchase.status ===
        "DRAFT"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "PO Outlet masih DRAFT. Payment belum dapat dibuat.",
          },
          {
            status: 400,
          }
        );
      }


      /*
      PO PAYMENT METHOD
      */

      const poMethod =
        normalizePaymentMethod(
          outletPurchase
            .paymentMethod
        );


      if (!poMethod) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Metode pembayaran pada PO Outlet belum ditentukan.",
          },
          {
            status: 400,
          }
        );
      }


      /*
      METHOD HARUS SAMA
      */

      if (
        poMethod !== method
      ) {
        return NextResponse.json(
          {
            success: false,

            message:
              `Metode payment harus mengikuti metode PO. Metode PO: ${poMethod}.`,
          },
          {
            status: 400,
          }
        );
      }
    }


    /*
    ========================================================
    SOURCE DATA
    ========================================================
    */

    const supplierId =
      Number(
        purchase?.supplierId ??
        outletPurchase?.supplierId ??
        0
      );


    const poTotal =
      roundMoney(
        Number(
          purchase?.total ??
          outletPurchase?.total ??
          0
        )
      );


    const poNumber =
      purchase?.number ??
      outletPurchase?.number ??
      "-";


    if (
      !Number.isInteger(
        supplierId
      ) ||
      supplierId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Supplier pada PO tidak valid.",
        },
        {
          status: 400,
        }
      );
    }


    if (
      !Number.isFinite(
        poTotal
      ) ||
      poTotal <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Total PO tidak valid.",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    IMPORTANT TEMPO RULE
    ========================================================

    Kalau Receipt sudah membuat payable:

    jangan buat initial TEMPO payment lagi.

    Gunakan settlement payable.
    ========================================================
    */

    const existingPayable =
      purchase?.payable ??
      outletPurchase?.payable ??
      null;


    if (
      method ===
        PaymentMethod.TEMPO &&
      existingPayable
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Purchase Payable untuk PO ini sudah tersedia. Gunakan menu Bayar Hutang untuk melakukan settlement.",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    EXISTING INITIAL PAYMENTS
    ========================================================

    Hanya initial payment:

    payableId = null

    yang dihitung.

    Settlement payable tidak dihitung
    sebagai payment awal.
    ========================================================
    */

    const existingAggregate =
      await prisma.payment.aggregate(
        {
          where: {
            ...(hasCentral
              ? {
                  purchaseId:
                    purchaseId!,
                }
              : {
                  outletPurchaseId:
                    outletPurchaseId!,
                }),

            status: {
              in: [
                PaymentStatus.PENDING,
                PaymentStatus.APPROVED,
                PaymentStatus.PAID,
              ],
            },

            payableId: null,
          },

          _sum: {
            amount: true,
          },
        }
      );


    const existingAmount =
      roundMoney(
        Number(
          existingAggregate
            ._sum
            .amount ?? 0
        )
      );


    const remaining =
      roundMoney(
        Math.max(
          0,
          poTotal -
            existingAmount
        )
      );


    /*
    ========================================================
    PAYMENT MELEBIHI SISA
    ========================================================
    */

    if (
      amount > remaining
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            `Jumlah payment melebihi sisa PO. Sisa yang dapat diproses: Rp ${remaining.toLocaleString(
              "id-ID"
            )}.`,

          remaining,
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    NON TEMPO
    ========================================================

    Payment awal non-TEMPO harus membayar
    seluruh sisa PO.

    Tidak boleh partial.
    ========================================================
    */

    if (
      method !==
      PaymentMethod.TEMPO
    ) {
      if (
        amount !==
        remaining
      ) {
        return NextResponse.json(
          {
            success: false,

            message:
              `Payment ${method} harus sebesar sisa PO. Sisa PO: Rp ${remaining.toLocaleString(
                "id-ID"
              )}.`,

            remaining,
          },
          {
            status: 400,
          }
        );
      }
    }


    /*
    ========================================================
    TEMPO
    ========================================================

    Initial TEMPO harus full PO.

    TIDAK membuat payable.

    Payable dibuat nanti ketika receipt.
    ========================================================
    */

    if (
      method ===
      PaymentMethod.TEMPO
    ) {
      if (
        amount !==
        poTotal
      ) {
        return NextResponse.json(
          {
            success: false,

            message:
              `Payment TEMPO awal harus sebesar total PO: Rp ${poTotal.toLocaleString(
                "id-ID"
              )}.`,
          },
          {
            status: 400,
          }
        );
      }
    }


    /*
    ========================================================
    TRANSACTION
    ========================================================
    */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
          ==================================================
          RECHECK CENTRAL PO
          ==================================================
          */

          if (hasCentral) {
            const currentPurchase =
              await tx.purchase.findUnique(
                {
                  where: {
                    id:
                      purchaseId!,
                  },

                  include: {
                    supplier: true,

                    payable: true,
                  },
                }
              );


            if (!currentPurchase) {
              throw new Error(
                "PURCHASE_NOT_FOUND"
              );
            }


            if (
              currentPurchase.status ===
              "DRAFT"
            ) {
              throw new Error(
                "PURCHASE_DRAFT"
              );
            }


            /*
            SOURCE OF TRUTH:
            PO PAYMENT METHOD
            */

            const currentMethod =
              normalizePaymentMethod(
                currentPurchase
                  .paymentMethod
              );


            if (!currentMethod) {
              throw new Error(
                "PO_PAYMENT_METHOD_MISSING"
              );
            }


            if (
              currentMethod !==
              method
            ) {
              throw new Error(
                "PAYMENT_METHOD_MISMATCH"
              );
            }


            /*
            TEMPO PAYABLE SUDAH ADA
            */

            if (
              method ===
                PaymentMethod.TEMPO &&
              currentPurchase.payable
            ) {
              throw new Error(
                "PAYABLE_ALREADY_EXISTS"
              );
            }
          }


          /*
          ==================================================
          RECHECK OUTLET PO
          ==================================================
          */

          if (hasOutlet) {
            const currentOutletPurchase =
              await tx.outletPurchase.findUnique(
                {
                  where: {
                    id:
                      outletPurchaseId!,
                  },

                  include: {
                    supplier: true,

                    payable: true,
                  },
                }
              );


            if (
              !currentOutletPurchase
            ) {
              throw new Error(
                "OUTLET_PURCHASE_NOT_FOUND"
              );
            }


            if (
              currentOutletPurchase.status ===
              "DRAFT"
            ) {
              throw new Error(
                "OUTLET_PURCHASE_DRAFT"
              );
            }


            /*
            OUTLET SECURITY
            */

            if (
              isOutletAdmin(user)
            ) {
              if (
                !user.outletId ||
                currentOutletPurchase
                  .outletId !==
                user.outletId
              ) {
                throw new Error(
                  "OUTLET_ACCESS_DENIED"
                );
              }
            }


            /*
            PO PAYMENT METHOD
            */

            const currentMethod =
              normalizePaymentMethod(
                currentOutletPurchase
                  .paymentMethod
              );


            if (!currentMethod) {
              throw new Error(
                "PO_PAYMENT_METHOD_MISSING"
              );
            }


            if (
              currentMethod !==
              method
            ) {
              throw new Error(
                "PAYMENT_METHOD_MISMATCH"
              );
            }


            /*
            TEMPO PAYABLE SUDAH ADA
            */

            if (
              method ===
                PaymentMethod.TEMPO &&
              currentOutletPurchase.payable
            ) {
              throw new Error(
                "PAYABLE_ALREADY_EXISTS"
              );
            }
          }


          /*
          ==================================================
          RECHECK INITIAL PAYMENT
          ==================================================

          payableId null.

          Settlement tidak ikut dihitung.
          ==================================================
          */

          const aggregate =
            await tx.payment.aggregate(
              {
                where: {
                  ...(hasCentral
                    ? {
                        purchaseId:
                          purchaseId!,
                      }
                    : {
                        outletPurchaseId:
                          outletPurchaseId!,
                      }),

                  status: {
                    in: [
                      PaymentStatus.PENDING,
                      PaymentStatus.APPROVED,
                      PaymentStatus.PAID,
                    ],
                  },

                  payableId: null,
                },

                _sum: {
                  amount: true,
                },
              }
            );


          const reservedAmount =
            roundMoney(
              Number(
                aggregate
                  ._sum
                  .amount ?? 0
              )
            );


          const currentRemaining =
            roundMoney(
              Math.max(
                0,
                poTotal -
                  reservedAmount
              )
            );


          /*
          ==================================================
          OVERPAYMENT RECHECK
          ==================================================
          */

          if (
            amount >
            currentRemaining
          ) {
            throw new Error(
              `PAYMENT_EXCEEDS_PO:${currentRemaining}`
            );
          }


          /*
          ==================================================
          NON TEMPO FULL REMAINING
          ==================================================
          */

          if (
            method !==
            PaymentMethod.TEMPO
          ) {
            if (
              amount !==
              currentRemaining
            ) {
              throw new Error(
                `PAYMENT_NOT_FULL_REMAINING:${currentRemaining}`
              );
            }
          }


          /*
          ==================================================
          TEMPO FULL PO
          ==================================================
          */

          if (
            method ===
            PaymentMethod.TEMPO
          ) {
            if (
              amount !==
              poTotal
            ) {
              throw new Error(
                "TEMPO_MUST_FULL_PO"
              );
            }


            /*
            ------------------------------------------------
            IMPORTANT

            HANYA cek payable.

            TIDAK CREATE PAYABLE.

            Receipt yang akan membuat payable.
            ------------------------------------------------
            */

            const currentPayable =
              hasCentral
                ? await tx.purchasePayable.findFirst(
                    {
                      where: {
                        purchaseId:
                          purchaseId!,
                      },
                    }
                  )
                : await tx.purchasePayable.findFirst(
                    {
                      where: {
                        outletPurchaseId:
                          outletPurchaseId!,
                      },
                    }
                  );


            if (
              currentPayable
            ) {
              throw new Error(
                "PAYABLE_ALREADY_EXISTS"
              );
            }
          }


          /*
          ==================================================
          GENERATE PAYMENT NUMBER
          ==================================================
          */

          const number =
            await generatePaymentNumber(
              tx,
              paymentDate
            );


          /*
          ==================================================
          CREATE PAYMENT
          ==================================================
          */

          const payment =
            await tx.payment.create({
              data: {
                number,

                purchaseId:
                  hasCentral
                    ? purchaseId!
                    : null,

                outletPurchaseId:
                  hasOutlet
                    ? outletPurchaseId!
                    : null,

                /*
                INITIAL PAYMENT
                BELUM TERKAIT PAYABLE.
                */

                payableId:
                  null,

                supplierId,

                paymentDate,

                amount,

                method,

                status:
                  PaymentStatus.PENDING,

                accountId:
                  null,

                referenceNumber,

                note,

                createdBy:
                  user.id,

                approvedBy:
                  null,

                approvedAt:
                  null,
              },

              include: {
                supplier: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },

                purchase: {
                  select: {
                    id: true,
                    number: true,
                    total: true,
                    paymentMethod:
                      true,
                    status: true,
                  },
                },

                outletPurchase: {
                  select: {
                    id: true,
                    number: true,
                    total: true,
                    paymentMethod:
                      true,
                    status: true,

                    outlet: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            });


          /*
          ==================================================
          HISTORY
          ==================================================
          */

          await tx.history.create({
            data: {
              transactionType:
                "PURCHASE",

              referenceNumber:
                payment.number,

              description:
                `Payment ${payment.number} dibuat untuk PO ${poNumber} sebesar ${amount} dengan metode ${method}. Status PENDING menunggu approval.`,

              userId:
                user.id,
            },
          });


          /*
          ==================================================
          RETURN
          ==================================================
          */

          return payment;
        },
        {
          maxWait: 5000,
          timeout: 10000,
        }
      );


    /*
    ========================================================
    RESPONSE FLOW
    ========================================================
    */

    return NextResponse.json(
      {
        success: true,

        message:
          "Payment berhasil dibuat dan menunggu approval.",

        data: {
          payment:
            result,

          flow: {
            type:
              "INITIAL_PO_PAYMENT",

            status:
              PaymentStatus.PENDING,

            nextStep:
              "APPROVE",

            approvalEndpoint:
              `/api/payment/${result.id}/approve`,

            pettyCash:
              "Belum dipotong. Akan diproses saat approval untuk CASH/COD/CBD.",

            payable:
              method ===
              PaymentMethod.TEMPO
                ? "Tidak dibuat pada Payment API. Purchase Payable akan dibuat saat barang diterima melalui Receipt."
                : "Tidak dibuat oleh initial payment.",
          },
        },
      },
      {
        status: 201,
      }
    );
  } catch (error: any) {
    console.error(
      "POST PAYMENT ERROR:",
      error
    );


    const message =
      getErrorMessage(error);


    /*
    ========================================================
    ERROR MAPPING
    ========================================================
    */

    const simpleErrors: Record<
      string,
      {
        status: number;
        message: string;
      }
    > = {
      PAYABLE_NOT_FOUND: {
        status: 404,
        message:
          "Purchase Payable tidak ditemukan.",
      },

      PAYABLE_SOURCE_INVALID: {
        status: 400,
        message:
          "Purchase Payable tidak memiliki sumber PO yang valid.",
      },

      PAYABLE_SOURCE_MULTIPLE: {
        status: 400,
        message:
          "Purchase Payable memiliki lebih dari satu sumber PO.",
      },

      PAYABLE_ALREADY_PAID: {
        status: 400,
        message:
          "Hutang ini sudah lunas.",
      },

      OUTLET_ACCESS_DENIED: {
        status: 403,
        message:
          "Anda tidak memiliki akses ke transaksi outlet tersebut.",
      },

      INVALID_ACCOUNT: {
        status: 400,
        message:
          "Petty Cash Account tidak valid.",
      },

      ACCOUNT_NOT_FOUND: {
        status: 400,
        message:
          "Petty Cash Account tidak ditemukan atau tidak aktif.",
      },

      ACCOUNT_ACCESS_DENIED: {
        status: 403,
        message:
          "Anda tidak memiliki akses ke Petty Cash Account tersebut.",
      },

      ACCOUNT_OUTLET_MISMATCH: {
        status: 400,
        message:
          "Petty Cash Account harus milik outlet yang sama dengan hutang.",
      },

      ACCOUNT_MUST_BE_CENTRAL: {
        status: 400,
        message:
          "Pembayaran hutang Pusat harus menggunakan Petty Cash Account Pusat.",
      },

      PURCHASE_NOT_FOUND: {
        status: 404,
        message:
          "Purchase Order Pusat tidak ditemukan.",
      },

      OUTLET_PURCHASE_NOT_FOUND: {
        status: 404,
        message:
          "Purchase Order Outlet tidak ditemukan.",
      },

      PURCHASE_DRAFT: {
        status: 400,
        message:
          "PO Pusat masih DRAFT.",
      },

      OUTLET_PURCHASE_DRAFT: {
        status: 400,
        message:
          "PO Outlet masih DRAFT.",
      },

      PO_PAYMENT_METHOD_MISSING: {
        status: 400,
        message:
          "Metode pembayaran pada PO belum ditentukan.",
      },

      PAYMENT_METHOD_MISMATCH: {
        status: 400,
        message:
          "Metode Payment harus sama dengan metode pembayaran pada PO.",
      },

      PAYABLE_ALREADY_EXISTS: {
        status: 400,
        message:
          "Purchase Payable untuk PO ini sudah tersedia. Gunakan menu Bayar Hutang untuk melakukan settlement.",
      },

      TEMPO_MUST_FULL_PO: {
        status: 400,
        message:
          "Payment TEMPO awal harus sebesar total PO.",
      },
    };


    const simple =
      simpleErrors[message];


    if (simple) {
      return NextResponse.json(
        {
          success: false,
          message:
            simple.message,
        },
        {
          status:
            simple.status,
        }
      );
    }


    /*
    ========================================================
    PETTY CASH
    ========================================================
    */

    if (
      message.startsWith(
        "INSUFFICIENT_PETTY_CASH:"
      )
    ) {
      const balance =
        Number(
          message.split(":")[1]
        );


      return NextResponse.json(
        {
          success: false,

          message:
            `Saldo Petty Cash tidak mencukupi. Saldo tersedia: Rp ${balance.toLocaleString(
              "id-ID"
            )}.`,

          balance,
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    SETTLEMENT OVER OUTSTANDING
    ========================================================
    */

    if (
      message.startsWith(
        "SETTLEMENT_EXCEEDS_OUTSTANDING:"
      )
    ) {
      const outstanding =
        Number(
          message.split(":")[1]
        );


      return NextResponse.json(
        {
          success: false,

          message:
            `Jumlah pembayaran melebihi outstanding hutang. Outstanding: Rp ${outstanding.toLocaleString(
              "id-ID"
            )}.`,

          outstanding,
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    INITIAL PAYMENT OVER PO
    ========================================================
    */

    if (
      message.startsWith(
        "PAYMENT_EXCEEDS_PO:"
      )
    ) {
      const remaining =
        Number(
          message.split(":")[1]
        );


      return NextResponse.json(
        {
          success: false,

          message:
            `Jumlah payment melebihi sisa PO. Sisa yang dapat diproses: Rp ${remaining.toLocaleString(
              "id-ID"
            )}.`,

          remaining,
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    INITIAL PAYMENT NOT FULL
    ========================================================
    */

    if (
      message.startsWith(
        "PAYMENT_NOT_FULL_REMAINING:"
      )
    ) {
      const remaining =
        Number(
          message.split(":")[1]
        );


      return NextResponse.json(
        {
          success: false,

          message:
            `Payment harus sebesar sisa PO. Sisa yang dapat diproses: Rp ${remaining.toLocaleString(
              "id-ID"
            )}.`,

          remaining,
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    INVALID PAYMENT DATE
    ========================================================
    */

    if (
      message ===
      "INVALID_PAYMENT_DATE"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tanggal pembayaran tidak valid.",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    FALLBACK
    ========================================================
    */

    return NextResponse.json(
      {
        success: false,

        message:
          "Gagal membuat payment.",

        error:
          process.env.NODE_ENV ===
          "development"
            ? message
            : undefined,
      },
      {
        status: 500,
      }
    );
  }
}