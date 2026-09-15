import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

import { cookies } from "next/headers";

import {
  PaymentMethod,
  PaymentStatus,
  PettyCashStatus,
  PettyCashType,
  Role,
} from "@prisma/client";

/*
===========================================================
APPROVE PAYMENT
===========================================================

FLOW FINAL MGB ERP
===========================================================

PAYMENT METHOD SOURCE OF TRUTH
==============================

Metode pembayaran pada PO adalah sumber kebenaran utama.

Purchase.paymentMethod
atau
OutletPurchase.paymentMethod


CASH / COD / CBD
----------------
Payment PENDING
      ↓
Approve
      ↓
Payment PAID
      ↓
Petty Cash OUT


TRANSFER
--------
Payment PENDING
      ↓
Approve
      ↓
Payment PAID
      ↓
Tidak ada Petty Cash


TEMPO
-----
Payment PENDING
      ↓
Approve
      ↓
Payment APPROVED
      ↓
Tidak ada Petty Cash
      ↓
TIDAK membuat PurchasePayable


===========================================================
PURCHASE PAYABLE
===========================================================

PurchasePayable UNTUK TEMPO dibuat ketika BARANG DITERIMA.

CENTRAL:
Purchase
   ↓
Goods Receipt
   ↓
PurchasePayable

OUTLET:
OutletPurchase
   ↓
Outlet Receipt
   ↓
PurchasePayable


Tanggal mulai tempo:

invoiceDate = receiptDate

dueDate =
receiptDate + Supplier.tempoDays


Approve Payment TIDAK BOLEH membuat payable.


===========================================================
PETTY CASH
===========================================================

CASH
COD
CBD

→ mengurangi Petty Cash


TRANSFER

→ tidak mengurangi Petty Cash


TEMPO

→ tidak mengurangi Petty Cash


===========================================================
PERMISSION
===========================================================

ADMIN
MANAGER

→ boleh approve

OUTLET_ADMIN
PURCHASING
GUDANG

→ tidak boleh approve


===========================================================
IMPORTANT
===========================================================

CASH / COD / CBD:

Approve
→ Payment PAID
→ Petty Cash OUT


TRANSFER:

Approve
→ Payment PAID
→ tanpa Petty Cash


TEMPO:

Approve
→ Payment APPROVED
→ tanpa Petty Cash
→ tanpa membuat PurchasePayable


PurchasePayable hanya dibuat dari Receipt API.
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
      sessionData = JSON.parse(
        session.value
      );
    } catch {
      return null;
    }

    const sessionUser =
      sessionData?.user ??
      sessionData;

    const userId = Number(
      sessionUser?.id
    );

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
          outletId: true,
          active: true,
        },
      });

    if (!user || !user.active) {
      return null;
    }

    return user;
  } catch (error) {
    console.error(
      "GET CURRENT USER APPROVE PAYMENT ERROR:",
      error
    );

    return null;
  }
}


/*
===========================================================
MONEY HELPER
===========================================================

Semua perbandingan nominal menggunakan 2 decimal.

Tidak menggunakan:

+ 0.01

karena dapat menyebabkan:

Rp 0.10
dibandingkan
Rp 0.10

dianggap berbeda.
===========================================================
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
===========================================================
PETTY CASH PAYMENT METHOD
===========================================================

CASH
COD
CBD

menggunakan Petty Cash.

TRANSFER dan TEMPO tidak.
===========================================================
*/

function usesPettyCash(
  method: PaymentMethod
) {
  return (
    method ===
      PaymentMethod.CASH ||
    method ===
      PaymentMethod.COD ||
    method ===
      PaymentMethod.CBD
  );
}


/*
===========================================================
GENERATE PETTY CASH NUMBER
===========================================================
*/

async function generatePettyCashNumber(
  tx: any
) {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const prefix =
    `PC-${year}${month}-`;

  const last =
    await tx.pettyCash.findFirst({
      where: {
        number: {
          startsWith: prefix,
        },
      },

      orderBy: {
        id: "desc",
      },

      select: {
        number: true,
      },
    });

  let sequence = 1;

  if (last?.number) {
    const lastNumber =
      Number(
        last.number.replace(
          prefix,
          ""
        )
      );

    if (
      Number.isFinite(
        lastNumber
      )
    ) {
      sequence =
        lastNumber + 1;
    }
  }

  return (
    `${prefix}${String(
      sequence
    ).padStart(4, "0")}`
  );
}


/*
===========================================================
SYNC EXISTING PURCHASE PAYABLE
===========================================================

IMPORTANT:

Fungsi ini TIDAK membuat payable baru.

Payable hanya boleh dibuat oleh:

Goods Receipt
atau
Outlet Receipt


Fungsi ini hanya dipakai jika payable memang sudah ada.

Contoh:

Receipt
→ PurchasePayable OUTSTANDING
→ Payment settlement PENDING
→ Approve
→ Payment PAID
→ update payable
===========================================================
*/

async function syncExistingPurchasePayable(
  tx: any,
  params: {
    purchaseId?: number | null;
    outletPurchaseId?: number | null;
    payableId?: number | null;
  }
) {
  const {
    purchaseId,
    outletPurchaseId,
    payableId,
  } = params;

  /*
  ========================================================
  SOURCE VALIDATION
  ========================================================
  */

  const hasPurchase =
    purchaseId !== null &&
    purchaseId !== undefined;

  const hasOutletPurchase =
    outletPurchaseId !== null &&
    outletPurchaseId !== undefined;

  if (
    hasPurchase &&
    hasOutletPurchase
  ) {
    throw new Error(
      "PAYABLE_SOURCE_MULTIPLE"
    );
  }

  if (
    !hasPurchase &&
    !hasOutletPurchase
  ) {
    throw new Error(
      "PAYABLE_SOURCE_MISSING"
    );
  }

  /*
  ========================================================
  JIKA PAYMENT TIDAK TERKAIT PAYABLE
  ========================================================

  Jangan membuat payable.

  Ini penting untuk payment CASH / TRANSFER
  yang terjadi sebelum receipt.

  Receipt tetap menjadi sumber pembentukan payable.
  ========================================================
  */

  if (
    payableId === null ||
    payableId === undefined
  ) {
    return null;
  }

  /*
  ========================================================
  GET PAYABLE
  ========================================================
  */

  const payable =
    await tx.purchasePayable.findUnique({
      where: {
        id: payableId,
      },
    });

  if (!payable) {
    throw new Error(
      "PAYABLE_NOT_FOUND"
    );
  }

  /*
  ========================================================
  VALIDATE PAYABLE SOURCE
  ========================================================
  */

  if (hasPurchase) {
    if (
      payable.purchaseId !==
      purchaseId
    ) {
      throw new Error(
        "PAYABLE_SOURCE_MISMATCH"
      );
    }
  }

  if (hasOutletPurchase) {
    if (
      payable.outletPurchaseId !==
      outletPurchaseId
    ) {
      throw new Error(
        "PAYABLE_SOURCE_MISMATCH"
      );
    }
  }

  /*
  ========================================================
  TOTAL PAID
  ========================================================

  Hanya Payment PAID.

  TEMPO APPROVED tidak dihitung.
  PENDING tidak dihitung.
  CANCELLED tidak dihitung.
  REJECTED tidak dihitung.
  ========================================================
  */

  const paidAggregate =
    await tx.payment.aggregate({
      where: {
        ...(hasPurchase
          ? {
              purchaseId:
                purchaseId!,
            }
          : {
              outletPurchaseId:
                outletPurchaseId!,
            }),

        status:
          PaymentStatus.PAID,
      },

      _sum: {
        amount: true,
      },
    });

  const paidAmount =
    roundMoney(
      Number(
        paidAggregate._sum
          .amount ?? 0
      )
    );

  const payableAmount =
    roundMoney(
      Number(
        payable.amount
      ) || 0
    );

  const actualPaid =
    Math.min(
      payableAmount,
      paidAmount
    );

  const outstanding =
    roundMoney(
      Math.max(
        0,
        payableAmount -
          actualPaid
      )
    );

  const status =
    outstanding <= 0
      ? "PAID"
      : "OUTSTANDING";

  /*
  ========================================================
  UPDATE EXISTING PAYABLE
  ========================================================
  */

  return await tx.purchasePayable.update(
    {
      where: {
        id: payable.id,
      },

      data: {
        paidAmount:
          actualPaid,

        outstanding,

        status,
      },
    }
  );
}


/*
===========================================================
PUT APPROVE PAYMENT
===========================================================
*/

export async function PUT(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
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
          message:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }


    /*
    ========================================================
    PERMISSION
    ========================================================
    */

    if (
      user.role !== Role.ADMIN &&
      user.role !== Role.MANAGER
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses untuk approve payment",
        },
        {
          status: 403,
        }
      );
    }


    /*
    ========================================================
    PAYMENT ID
    ========================================================
    */

    const { id } =
      await params;

    const paymentId =
      Number(id);

    if (
      !Number.isInteger(
        paymentId
      ) ||
      paymentId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID payment tidak valid",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    APPROVAL TRANSACTION
    ========================================================
    */

    const approvedAt =
      new Date();

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
          ==================================================
          GET PAYMENT
          ==================================================
          */

          const payment =
            await tx.payment.findUnique(
              {
                where: {
                  id: paymentId,
                },

                include: {
                  supplier: true,

                  purchase: true,

                  outletPurchase: {
                    include: {
                      outlet: true,
                    },
                  },

                  payable: true,
                },
              }
            );

          if (!payment) {
            throw new Error(
              "PAYMENT_NOT_FOUND"
            );
          }


          /*
          ==================================================
          PAYMENT HARUS PENDING
          ==================================================
          */

          if (
            payment.status !==
            PaymentStatus.PENDING
          ) {
            throw new Error(
              "PAYMENT_NOT_PENDING"
            );
          }


          /*
          ==================================================
          VALIDATE PAYMENT SOURCE
          ==================================================
          */

          const hasPurchase =
            payment.purchaseId !==
            null;

          const hasOutletPurchase =
            payment.outletPurchaseId !==
            null;

          if (
            !hasPurchase &&
            !hasOutletPurchase
          ) {
            throw new Error(
              "PAYMENT_SOURCE_MISSING"
            );
          }

          if (
            hasPurchase &&
            hasOutletPurchase
          ) {
            throw new Error(
              "PAYMENT_SOURCE_MULTIPLE"
            );
          }


          /*
          ==================================================
          SOURCE DATA
          ==================================================
          */

          let outletId:
            number | null = null;

          let poNumber =
            "-";

          let paymentMethod:
            PaymentMethod | null =
              null;

          let poTotal = 0;


          /*
          ==================================================
          PO PUSAT
          ==================================================
          */

          if (hasPurchase) {
            const purchase =
              payment.purchase;

            if (!purchase) {
              throw new Error(
                "PURCHASE_NOT_FOUND"
              );
            }

            poNumber =
              purchase.number;

            paymentMethod =
              purchase.paymentMethod;

            poTotal =
              roundMoney(
                Number(
                  purchase.total
                ) || 0
              );

            outletId = null;
          }


          /*
          ==================================================
          PO OUTLET
          ==================================================
          */

          if (
            hasOutletPurchase
          ) {
            const outletPurchase =
              payment.outletPurchase;

            if (
              !outletPurchase
            ) {
              throw new Error(
                "OUTLET_PURCHASE_NOT_FOUND"
              );
            }

            outletId =
              outletPurchase.outletId;

            poNumber =
              outletPurchase.number;

            paymentMethod =
              outletPurchase.paymentMethod;

            poTotal =
              roundMoney(
                Number(
                  outletPurchase.total
                ) || 0
              );
          }


          /*
          ==================================================
          PAYMENT METHOD SOURCE OF TRUTH
          ==================================================
          */

          if (!paymentMethod) {
            throw new Error(
              "PO_PAYMENT_METHOD_MISSING"
            );
          }


          /*
          ==================================================
          PAYMENT AMOUNT
          ==================================================
          */

          const paymentAmount =
            roundMoney(
              Number(
                payment.amount
              )
            );

          if (
            !Number.isFinite(
              paymentAmount
            ) ||
            paymentAmount <= 0
          ) {
            throw new Error(
              "INVALID_PAYMENT_AMOUNT"
            );
          }


          /*
          ==================================================
          PAYMENT TOTAL VALIDATION
          ==================================================

          PENDING
          APPROVED
          PAID

          tetap dianggap mengambil porsi nilai PO.

          Ini mencegah payment PENDING baru
          membuat total payment melebihi PO.
          ==================================================
          */

          const previousPayments =
            await tx.payment.aggregate(
              {
                where: {
                  ...(hasPurchase
                    ? {
                        purchaseId:
                          payment.purchaseId!,
                      }
                    : {
                        outletPurchaseId:
                          payment.outletPurchaseId!,
                      }),

                  id: {
                    not:
                      payment.id,
                  },

                  status: {
                    in: [
                      PaymentStatus.PENDING,
                      PaymentStatus.APPROVED,
                      PaymentStatus.PAID,
                    ],
                  },
                },

                _sum: {
                  amount: true,
                },
              }
            );

          const previousAmount =
            roundMoney(
              Number(
                previousPayments
                  ._sum
                  .amount ?? 0
              )
            );

          const remainingBefore =
            roundMoney(
              Math.max(
                0,
                poTotal -
                  previousAmount
              )
            );


          /*
          ==================================================
          PAYMENT TIDAK BOLEH MELEBIHI SISA PO
          ==================================================
          */

          if (
            paymentAmount >
            remainingBefore
          ) {
            throw new Error(
              `PAYMENT_EXCEEDS_PO:${remainingBefore}`
            );
          }


          /*
          ==================================================
          DUPLICATE PETTY CASH
          ==================================================
          */

          const existingPettyCash =
            await tx.pettyCash.findFirst(
              {
                where: {
                  paymentId:
                    payment.id,
                },
              }
            );

          if (
            existingPettyCash &&
            usesPettyCash(
              paymentMethod
            )
          ) {
            throw new Error(
              "PETTY_CASH_ALREADY_EXISTS"
            );
          }


          /*
          ==================================================
          RESULT VARIABLES
          ==================================================
          */

          let pettyCash: any =
            null;

          let account: any =
            null;

          let payable: any =
            null;


          /*
          ==================================================
          CASH / COD / CBD
          ==================================================
          */

          if (
            usesPettyCash(
              paymentMethod
            )
          ) {
            /*
            ------------------------------------------------
            PETTY CASH ACCOUNT
            ------------------------------------------------

            PUSAT:
            outletId = null

            OUTLET:
            outletId = outletPurchase.outletId
            ------------------------------------------------
            */

            account =
              await tx.pettyCashAccount.findFirst(
                {
                  where: {
                    outletId,

                    isActive: true,
                  },

                  orderBy: {
                    id: "asc",
                  },
                }
              );

            if (!account) {
              throw new Error(
                outletId === null
                  ? "PETTY_CASH_CENTRAL_ACCOUNT_NOT_FOUND"
                  : "PETTY_CASH_OUTLET_ACCOUNT_NOT_FOUND"
              );
            }


            /*
            ------------------------------------------------
            SALDO PETTY CASH
            ------------------------------------------------
            */

            const balanceBefore =
              roundMoney(
                Number(
                  account.currentBalance
                ) || 0
              );

            if (
              paymentAmount >
              balanceBefore
            ) {
              throw new Error(
                `PETTY_CASH_INSUFFICIENT:${balanceBefore}`
              );
            }


            const balanceAfter =
              roundMoney(
                balanceBefore -
                  paymentAmount
              );


            /*
            ------------------------------------------------
            PETTY CASH NUMBER
            ------------------------------------------------
            */

            const pettyCashNumber =
              await generatePettyCashNumber(
                tx
              );


            /*
            ------------------------------------------------
            CATEGORY
            ------------------------------------------------
            */

            const category =
              outletId === null
                ? "PEMBAYARAN PO PUSAT"
                : "PEMBAYARAN PO OUTLET";


            /*
            ------------------------------------------------
            CREATE PETTY CASH
            ------------------------------------------------
            */

            pettyCash =
              await tx.pettyCash.create(
                {
                  data: {
                    number:
                      pettyCashNumber,

                    trxDate:
                      payment.paymentDate,

                    type:
                      PettyCashType.OUT,

                    category,

                    description:
                      `Pembayaran ${payment.number} (${paymentMethod}) untuk PO ${poNumber}`,

                    amount:
                      paymentAmount,

                    balanceBefore,

                    balanceAfter,

                    accountId:
                      account.id,

                    paymentId:
                      payment.id,

                    outletId,

                    createdBy:
                      payment.createdBy,

                    approvedBy:
                      user.id,

                    approvedAt,

                    status:
                      PettyCashStatus.APPROVED,
                  },
                }
              );


            /*
            ------------------------------------------------
            UPDATE PETTY CASH ACCOUNT
            ------------------------------------------------
            */

            account =
              await tx.pettyCashAccount.update(
                {
                  where: {
                    id:
                      account.id,
                  },

                  data: {
                    currentBalance:
                      balanceAfter,
                  },

                  include: {
                    outlet: true,
                  },
                }
              );
          }


          /*
          ==================================================
          TEMPO
          ==================================================

          IMPORTANT:

          TEMPO TIDAK MEMBUAT PAYABLE.

          PurchasePayable sudah / akan dibuat
          oleh Receipt API.

          Approve payment TEMPO hanya mengubah:

          PENDING
             ↓
          APPROVED

          Tidak ada Petty Cash.

          Tidak mengubah invoiceDate.

          Tidak mengubah dueDate.

          Tidak membuat invoiceNumber baru.
          ==================================================
          */

          if (
            paymentMethod ===
            PaymentMethod.TEMPO
          ) {
            /*
            ------------------------------------------------
            JIKA PAYMENT TEMPO SUDAH TERKAIT PAYABLE
            ------------------------------------------------

            Tidak perlu mengubah payable.

            Payment TEMPO berstatus APPROVED,
            bukan PAID.

            Karena itu tidak dianggap pembayaran kas.
            ------------------------------------------------
            */

            payable =
              payment.payable ??
              null;
          }


          /*
          ==================================================
          FINAL PAYMENT STATUS
          ==================================================
          */

          let finalStatus:
            PaymentStatus;

          if (
            paymentMethod ===
            PaymentMethod.TEMPO
          ) {
            /*
            TEMPO bukan pembayaran kas.

            Status APPROVED berarti
            persetujuan payment/hutang.
            */

            finalStatus =
              PaymentStatus.APPROVED;
          } else {
            /*
            CASH
            COD
            CBD
            TRANSFER

            dianggap selesai saat diapprove.
            */

            finalStatus =
              PaymentStatus.PAID;
          }


          /*
          ==================================================
          UPDATE PAYMENT
          ==================================================
          */

          const updatedPayment =
            await tx.payment.update(
              {
                where: {
                  id:
                    payment.id,
                },

                data: {
                  /*
                  Payment method tetap mengikuti
                  metode PO.
                  */

                  method:
                    paymentMethod,

                  status:
                    finalStatus,

                  approvedBy:
                    user.id,

                  approvedAt,
                },

                include: {
                  supplier: true,

                  purchase: true,

                  outletPurchase: {
                    include: {
                      outlet: true,
                    },
                  },

                  payable: true,
                },
              }
            );


          /*
          ==================================================
          SYNC PAYABLE
          ==================================================

          Hanya payment PAID.

          DAN:

          Hanya update payable jika payable
          memang sudah ada.

          Tidak pernah membuat payable baru.

          Ini menjaga Receipt sebagai satu-satunya
          sumber pembentukan PurchasePayable.
          ==================================================
          */

          if (
            finalStatus ===
            PaymentStatus.PAID
          ) {
            payable =
              await syncExistingPurchasePayable(
                tx,
                {
                  purchaseId:
                    payment.purchaseId,

                  outletPurchaseId:
                    payment.outletPurchaseId,

                  payableId:
                    payment.payableId,
                }
              );
          }


          /*
          ==================================================
          HISTORY
          ==================================================
          */

          let historyDescription =
            "";


          /*
          --------------------------------------------------
          TEMPO
          --------------------------------------------------
          */

          if (
            paymentMethod ===
            PaymentMethod.TEMPO
          ) {
            historyDescription =
              `Payment ${payment.number} diapprove untuk ${poNumber}. Metode TEMPO. Payment menjadi APPROVED. Purchase Payable tidak dibuat pada proses approval payment karena payable dibuat berdasarkan Receipt. Petty Cash tidak dipotong.`;
          }


          /*
          --------------------------------------------------
          TRANSFER
          --------------------------------------------------
          */

          else if (
            paymentMethod ===
            PaymentMethod.TRANSFER
          ) {
            historyDescription =
              `Payment ${payment.number} diapprove untuk ${poNumber} sebesar ${paymentAmount}. Metode TRANSFER. Payment menjadi PAID. Pembayaran melalui transfer tidak memotong Petty Cash.`;
          }


          /*
          --------------------------------------------------
          CASH / COD / CBD
          --------------------------------------------------
          */

          else {
            historyDescription =
              `Payment ${payment.number} diapprove untuk ${poNumber} sebesar ${paymentAmount}. Metode ${paymentMethod}. Payment menjadi PAID dan Petty Cash ${
                outletId === null
                  ? "Pusat"
                  : `Outlet ${
                      payment
                        .outletPurchase
                        ?.outlet
                        ?.name ??
                      ""
                    }`
              } berkurang sebesar ${paymentAmount}.`;
          }


          /*
          ==================================================
          CREATE HISTORY
          ==================================================
          */

          await tx.history.create({
            data: {
              transactionType:
                "PURCHASE",

              referenceNumber:
                payment.number,

              description:
                historyDescription,

              userId:
                user.id,
            },
          });


          /*
          ==================================================
          RETURN TRANSACTION RESULT
          ==================================================
          */

          return {
            payment:
              updatedPayment,

            pettyCash,

            account,

            payable,

            paymentMethod,

            outletId,

            poNumber,

            poTotal,

            paymentAmount,

            finalStatus,
          };
        }
      );


    /*
    ========================================================
    RESPONSE MESSAGE
    ========================================================
    */

    let message =
      "Payment berhasil diapprove.";


    /*
    ========================================================
    CASH / COD / CBD
    ========================================================
    */

    if (
      usesPettyCash(
        result.paymentMethod
      )
    ) {
      message =
        `Payment berhasil diapprove dan menjadi PAID. Metode ${result.paymentMethod}. Petty Cash ${
          result.outletId === null
            ? "Pusat"
            : "Outlet"
        } telah dipotong sebesar ${result.paymentAmount}.`;
    }


    /*
    ========================================================
    TRANSFER
    ========================================================
    */

    if (
      result.paymentMethod ===
      PaymentMethod.TRANSFER
    ) {
      message =
        "Payment TRANSFER berhasil diapprove dan menjadi PAID. Petty Cash tidak dipotong.";
    }


    /*
    ========================================================
    TEMPO
    ========================================================
    */

    if (
      result.paymentMethod ===
      PaymentMethod.TEMPO
    ) {
      message =
        "Payment TEMPO berhasil diapprove dan menjadi APPROVED. Purchase Payable tidak dibuat pada proses approval karena hutang supplier dibuat saat barang diterima.";
    }


    /*
    ========================================================
    SUCCESS RESPONSE
    ========================================================
    */

    return NextResponse.json({
      success: true,

      message,

      data: {
        payment:
          result.payment,

        pettyCash:
          result.pettyCash,

        account:
          result.account,

        payable:
          result.payable,

        paymentMethod:
          result.paymentMethod,

        outletId:
          result.outletId,

        poNumber:
          result.poNumber,

        poTotal:
          result.poTotal,

        paymentAmount:
          result.paymentAmount,

        finalStatus:
          result.finalStatus,
      },
    });
  } catch (error: any) {
    console.error(
      "APPROVE PAYMENT ERROR:",
      error
    );

    const message =
      String(
        error?.message ?? ""
      );


    /*
    ========================================================
    ERROR HANDLING
    ========================================================
    */

    if (
      message ===
      "PAYMENT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }


    if (
      message ===
      "PAYMENT_NOT_PENDING"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment sudah diproses dan tidak lagi berstatus PENDING",
        },
        {
          status: 400,
        }
      );
    }


    if (
      message ===
      "PAYMENT_SOURCE_MISSING"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment tidak memiliki sumber PO",
        },
        {
          status: 400,
        }
      );
    }


    if (
      message ===
      "PAYMENT_SOURCE_MULTIPLE"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment tidak boleh memiliki PO pusat dan PO outlet sekaligus",
        },
        {
          status: 400,
        }
      );
    }


    if (
      message ===
      "PURCHASE_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "PO pusat tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }


    if (
      message ===
      "OUTLET_PURCHASE_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "PO outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }


    if (
      message ===
      "PO_PAYMENT_METHOD_MISSING"
    ) {
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


    if (
      message ===
      "INVALID_PAYMENT_AMOUNT"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Jumlah payment tidak valid.",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    PAYMENT EXCEEDS PO
    ========================================================
    */

    if (
      message.startsWith(
        "PAYMENT_EXCEEDS_PO:"
      )
    ) {
      const remaining =
        roundMoney(
          Number(
            message.split(":")[1]
          )
        );

      return NextResponse.json(
        {
          success: false,

          message:
            `Total payment melebihi nilai PO. Sisa yang dapat diproses: ${remaining}`,

          remaining,
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    PETTY CASH CENTRAL
    ========================================================
    */

    if (
      message ===
      "PETTY_CASH_CENTRAL_ACCOUNT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Akun Petty Cash Pusat belum dibuat atau tidak aktif.",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    PETTY CASH OUTLET
    ========================================================
    */

    if (
      message ===
      "PETTY_CASH_OUTLET_ACCOUNT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Akun Petty Cash Outlet untuk PO tersebut belum dibuat atau tidak aktif.",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    PETTY CASH INSUFFICIENT
    ========================================================
    */

    if (
      message.startsWith(
        "PETTY_CASH_INSUFFICIENT:"
      )
    ) {
      const balance =
        roundMoney(
          Number(
            message.split(":")[1]
          )
        );

      return NextResponse.json(
        {
          success: false,

          message:
            `Saldo Petty Cash tidak mencukupi. Saldo tersedia: ${balance}`,

          balance,
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    DUPLICATE PETTY CASH
    ========================================================
    */

    if (
      message ===
      "PETTY_CASH_ALREADY_EXISTS"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment ini sudah memiliki transaksi Petty Cash.",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    PAYABLE SOURCE MULTIPLE
    ========================================================
    */

    if (
      message ===
      "PAYABLE_SOURCE_MULTIPLE"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Payable memiliki sumber PO yang tidak valid.",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    PAYABLE SOURCE MISSING
    ========================================================
    */

    if (
      message ===
      "PAYABLE_SOURCE_MISSING"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Payable tidak memiliki sumber PO.",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    PAYABLE NOT FOUND
    ========================================================
    */

    if (
      message ===
      "PAYABLE_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Payable yang terkait payment tidak ditemukan. Pastikan barang sudah diterima dan payable sudah terbentuk.",
        },
        {
          status: 404,
        }
      );
    }


    /*
    ========================================================
    PAYABLE SOURCE MISMATCH
    ========================================================
    */

    if (
      message ===
      "PAYABLE_SOURCE_MISMATCH"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Payable tidak sesuai dengan sumber PO payment.",
        },
        {
          status: 400,
        }
      );
    }


    /*
    ========================================================
    FALLBACK ERROR
    ========================================================
    */

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal approve payment",
      },
      {
        status: 500,
      }
    );
  }
}