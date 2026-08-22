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

SUMBER METODE PEMBAYARAN
========================

PaymentMethod pada PO adalah SUMBER KEBENARAN UTAMA.

PO PUSAT
Purchase
   ↓
paymentMethod
   ↓
Payment PENDING
   ↓
Approve
   ↓
--------------------------------
CASH
TRANSFER
COD
CBD
--------------------------------
   ↓
Petty Cash Pusat OUT
   ↓
Payment PAID
   ↓
PurchasePayable sinkron


PO OUTLET
OutletPurchase
   ↓
paymentMethod
   ↓
Payment PENDING
   ↓
Approve
   ↓
--------------------------------
CASH
TRANSFER
COD
CBD
--------------------------------
   ↓
Petty Cash Outlet OUT
   ↓
Payment PAID
   ↓
PurchasePayable sinkron


TEMPO
=====

PO
 ↓
Payment PENDING
 ↓
Approve
 ↓
Payment APPROVED
 ↓
PurchasePayable OUTSTANDING
 ↓
TIDAK memotong Petty Cash


PERMISSION
==========

ADMIN
MANAGER
   ↓
boleh approve

OUTLET_ADMIN
   ↓
tidak boleh approve


IMPORTANT
=========

Untuk CASH / TRANSFER / COD / CBD:

APPROVE = transaksi pembayaran selesai

Jadi:
Payment = PAID
PettyCash = OUT

Tidak perlu endpoint /paid lagi untuk
mengubah payment menjadi PAID.

Untuk TEMPO:

Payment = APPROVED

Karena belum ada pembayaran kas.

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
          outletId: true,
          active: true,
        },
      });

    if (
      !user ||
      !user.active
    ) {
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
PETTY CASH PAYMENT METHOD
===========================================================

CASH
TRANSFER
COD
CBD

SEMUA mengurangi Petty Cash.

TEMPO TIDAK.
===========================================================
*/

function usesPettyCash(
  method: PaymentMethod
) {
  return (
    method === PaymentMethod.CASH ||
    method === PaymentMethod.TRANSFER ||
    method === PaymentMethod.COD ||
    method === PaymentMethod.CBD
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
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const prefix =
    `PC-${year}${month}-`;

  const last =
    await tx.pettyCash.findFirst({
      where: {
        number: {
          startsWith:
            prefix,
        },
      },

      orderBy: {
        id: "desc",
      },

      select: {
        number: true,
      },
    });

  let sequence =
    1;

  if (
    last?.number
  ) {
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
    ).padStart(
      4,
      "0"
    )}`
  );
}

/*
===========================================================
SYNC PURCHASE PAYABLE
===========================================================

Dipakai setelah payment menjadi PAID.

Perhitungan:

PO Total
   -
Total Payment PAID
   =
Outstanding

Payment PENDING / APPROVED / CANCELLED / REJECTED
tidak dihitung sebagai pembayaran kas.

===========================================================
*/

async function syncPurchasePayable(
  tx: any,
  params: {
    purchaseId?: number | null;
    outletPurchaseId?: number | null;
  }
) {
  const {
    purchaseId,
    outletPurchaseId,
  } = params;

  const isCentral =
    purchaseId !== null &&
    purchaseId !== undefined;

  const isOutlet =
    outletPurchaseId !== null &&
    outletPurchaseId !== undefined;

  if (
    isCentral &&
    isOutlet
  ) {
    throw new Error(
      "PAYABLE_SOURCE_MULTIPLE"
    );
  }

  if (
    !isCentral &&
    !isOutlet
  ) {
    throw new Error(
      "PAYABLE_SOURCE_MISSING"
    );
  }

  let poTotal =
    0;

  let supplierId =
    0;

  let outletId:
    number | null =
    null;

  /*
  ========================================================
  PO PUSAT
  ========================================================
  */

  if (isCentral) {
    const purchase =
      await tx.purchase.findUnique({
        where: {
          id: purchaseId!,
        },

        select: {
          id: true,
          total: true,
          supplierId: true,
        },
      });

    if (!purchase) {
      throw new Error(
        "PURCHASE_NOT_FOUND"
      );
    }

    poTotal =
      Number(
        purchase.total
      ) || 0;

    supplierId =
      purchase.supplierId;

    outletId =
      null;
  }

  /*
  ========================================================
  PO OUTLET
  ========================================================
  */

  if (isOutlet) {
    const outletPurchase =
      await tx.outletPurchase.findUnique({
        where: {
          id:
            outletPurchaseId!,
        },

        select: {
          id: true,
          total: true,
          supplierId: true,
          outletId: true,
        },
      });

    if (!outletPurchase) {
      throw new Error(
        "OUTLET_PURCHASE_NOT_FOUND"
      );
    }

    poTotal =
      Number(
        outletPurchase.total
      ) || 0;

    supplierId =
      outletPurchase.supplierId;

    outletId =
      outletPurchase.outletId;
  }

  /*
  ========================================================
  TOTAL PAYMENT PAID
  ========================================================
  */

  const paidAggregate =
    await tx.payment.aggregate({
      where: {
        ...(isCentral
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
    Number(
      paidAggregate._sum
        .amount ?? 0
    );

  const outstanding =
    Math.max(
      0,
      poTotal -
        paidAmount
    );

  /*
  ========================================================
  CARI PAYABLE
  ========================================================
  */

  const existingPayable =
    isCentral
      ? await tx.purchasePayable.findUnique(
          {
            where: {
              purchaseId:
                purchaseId!,
            },
          }
        )
      : await tx.purchasePayable.findUnique(
          {
            where: {
              outletPurchaseId:
                outletPurchaseId!,
            },
          }
        );

  /*
  ========================================================
  SUDAH LUNAS
  ========================================================
  */

  if (
    paidAmount >=
    poTotal - 0.01
  ) {
    if (
      existingPayable
    ) {
      return await tx.purchasePayable.update(
        {
          where: {
            id:
              existingPayable.id,
          },

          data: {
            amount:
              poTotal,

            paidAmount:
              poTotal,

            outstanding:
              0,

            status:
              "PAID",
          },
        }
      );
    }

    return await tx.purchasePayable.create(
      {
        data: {
          ...(isCentral
            ? {
                purchaseId:
                  purchaseId!,
              }
            : {
                outletPurchaseId:
                  outletPurchaseId!,
              }),

          supplierId,

          outletId,

          invoiceNumber:
            `PAID-${
              isCentral
                ? `PURCHASE-${purchaseId}`
                : `OUTLET-${outletPurchaseId}`
            }`,

          invoiceDate:
            new Date(),

          dueDate:
            new Date(),

          amount:
            poTotal,

          paidAmount:
            poTotal,

          outstanding:
            0,

          status:
            "PAID",
        },
      }
    );
  }

  /*
  ========================================================
  MASIH OUTSTANDING
  ========================================================
  */

  if (
    existingPayable
  ) {
    return await tx.purchasePayable.update(
      {
        where: {
          id:
            existingPayable.id,
        },

        data: {
          amount:
            poTotal,

          paidAmount,

          outstanding,

          status:
            "OUTSTANDING",
        },
      }
    );
  }

  /*
  ========================================================
  CREATE PAYABLE
  ========================================================
  */

  return await tx.purchasePayable.create(
    {
      data: {
        ...(isCentral
          ? {
              purchaseId:
                purchaseId!,
            }
          : {
              outletPurchaseId:
                outletPurchaseId!,
            }),

        supplierId,

        outletId,

        invoiceNumber:
          `PAYMENT-${
            isCentral
              ? purchaseId
              : outletPurchaseId
          }`,

        invoiceDate:
          new Date(),

        dueDate:
          new Date(),

        amount:
          poTotal,

        paidAmount,

        outstanding,

        status:
          "OUTSTANDING",
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
                  id:
                    paymentId,
                },

                include: {
                  supplier: true,

                  purchase: true,

                  outletPurchase: {
                    include: {
                      outlet: true,
                    },
                  },
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
          STATUS
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
          VALIDATE SOURCE
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
            number | null =
            null;

          let poNumber =
            "-";

          let poPaymentMethod:
            PaymentMethod | null =
            null;

          let poTotal =
            0;

          let poPurchaseDate:
            Date | null =
            null;

          /*
          ==================================================
          PO PUSAT
          ==================================================
          */

          if (
            payment.purchaseId
          ) {
            const purchase =
              payment.purchase;

            if (!purchase) {
              throw new Error(
                "PURCHASE_NOT_FOUND"
              );
            }

            poNumber =
              purchase.number;

            poPaymentMethod =
              purchase.paymentMethod;

            poTotal =
              Number(
                purchase.total
              ) || 0;

            poPurchaseDate =
              purchase.purchaseDate;
          }

          /*
          ==================================================
          PO OUTLET
          ==================================================
          */

          if (
            payment.outletPurchaseId
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

            poPaymentMethod =
              outletPurchase.paymentMethod;

            poTotal =
              Number(
                outletPurchase.total
              ) || 0;

            poPurchaseDate =
              outletPurchase.purchaseDate;
          }

          /*
          ==================================================
          PO PAYMENT METHOD
          ==================================================
          */

          if (
            !poPaymentMethod
          ) {
            throw new Error(
              "PO_PAYMENT_METHOD_MISSING"
            );
          }

          /*
          ==================================================
          SOURCE OF TRUTH
          ==================================================

          Metode Payment dari PO adalah sumber kebenaran.

          Jika payment sebelumnya memiliki method yang
          berbeda, otomatis disinkronkan dengan PO.
          ==================================================
          */

          const paymentMethod =
            poPaymentMethod;

          /*
          ==================================================
          PAYMENT AMOUNT
          ==================================================
          */

          const paymentAmount =
            Number(
              payment.amount
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
          CEK TOTAL PAYMENT SEBELUMNYA
          ==================================================
          */

          const previousPayments =
            await tx.payment.aggregate({
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
            });

          const previousAmount =
            Number(
              previousPayments
                ._sum.amount ??
                0
            );

          const remainingBefore =
            Math.max(
              0,
              poTotal -
                previousAmount
            );

          if (
            paymentAmount >
            remainingBefore + 0.01
          ) {
            throw new Error(
              `PAYMENT_EXCEEDS_PO:${remainingBefore}`
            );
          }

          /*
          ==================================================
          CEK PETTY CASH DUPLIKASI
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

          let pettyCash:
            any = null;

          let account:
            any = null;

          let payable:
            any = null;

          /*
          ==================================================
          CASH / TRANSFER / COD / CBD
          ==================================================
          */

          if (
            usesPettyCash(
              paymentMethod
            )
          ) {
            /*
            ------------------------------------------------
            AKUN PETTY CASH

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

                    isActive:
                      true,
                  },

                  orderBy: {
                    id:
                      "asc",
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
            SALDO
            ------------------------------------------------
            */

            const balanceBefore =
              Number(
                account.currentBalance
              ) || 0;

            if (
              paymentAmount >
              balanceBefore
            ) {
              throw new Error(
                `PETTY_CASH_INSUFFICIENT:${balanceBefore}`
              );
            }

            const balanceAfter =
              balanceBefore -
              paymentAmount;

            /*
            ------------------------------------------------
            NUMBER
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
              await tx.pettyCash.create({
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
              });

            /*
            ------------------------------------------------
            UPDATE ACCOUNT
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
                    outlet:
                      true,
                  },
                }
              );
          }

          /*
          ==================================================
          TEMPO
          ==================================================

          TEMPO tidak menyentuh Petty Cash.

          Payment tetap APPROVED.

          PurchasePayable dibuat sebesar nilai PO,
          bukan sekadar amount payment.
          ==================================================
          */

          if (
            paymentMethod ===
            PaymentMethod.TEMPO
          ) {
            /*
            ------------------------------------------------
            CARI PAYABLE
            ------------------------------------------------
            */

            payable =
              hasPurchase
                ? await tx.purchasePayable.findUnique(
                    {
                      where: {
                        purchaseId:
                          payment.purchaseId!,
                      },
                    }
                  )
                : await tx.purchasePayable.findUnique(
                    {
                      where: {
                        outletPurchaseId:
                          payment.outletPurchaseId!,
                      },
                    }
                  );

            /*
            ------------------------------------------------
            INVOICE
            ------------------------------------------------
            */

            const invoiceNumber =
              payment.referenceNumber
                ?.trim() ||
              payment.number;

            const invoiceDate =
              poPurchaseDate ??
              payment.paymentDate;

            /*
            ------------------------------------------------
            CREATE / UPDATE PAYABLE
            ------------------------------------------------
            */

            if (!payable) {
              payable =
                await tx.purchasePayable.create(
                  {
                    data: {
                      ...(hasPurchase
                        ? {
                            purchaseId:
                              payment.purchaseId!,
                          }
                        : {
                            outletPurchaseId:
                              payment.outletPurchaseId!,
                          }),

                      supplierId:
                        payment.supplierId,

                      outletId,

                      invoiceNumber,

                      invoiceDate,

                      dueDate:
                        null,

                      amount:
                        poTotal,

                      paidAmount:
                        0,

                      outstanding:
                        poTotal,

                      status:
                        "OUTSTANDING",
                    },
                  }
                );
            } else {
              payable =
                await tx.purchasePayable.update(
                  {
                    where: {
                      id:
                        payable.id,
                    },

                    data: {
                      amount:
                        poTotal,

                      outstanding:
                        Math.max(
                          0,
                          poTotal -
                            Number(
                              payable.paidAmount
                            )
                        ),

                      invoiceNumber,

                      invoiceDate,

                      status:
                        "OUTSTANDING",
                    },
                  }
                );
            }
          }

          /*
          ==================================================
          PAYMENT STATUS
          ==================================================

          PETTY CASH PAYMENT
             → PAID

          TEMPO
             → APPROVED
          ==================================================
          */

          const finalStatus =
            usesPettyCash(
              paymentMethod
            )
              ? PaymentStatus.PAID
              : PaymentStatus.APPROVED;

          const updatedPayment =
            await tx.payment.update({
              where: {
                id:
                  payment.id,
              },

              data: {
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
              },
            });

          /*
          ==================================================
          SYNC PURCHASE PAYABLE
          ==================================================

          Hanya payment PAID yang dihitung sebagai
          pembayaran kas.

          Untuk TEMPO, payable sudah dibuat di atas.
          ==================================================
          */

          if (
            finalStatus ===
            PaymentStatus.PAID
          ) {
            payable =
              await syncPurchasePayable(
                tx,
                {
                  purchaseId:
                    payment.purchaseId,

                  outletPurchaseId:
                    payment.outletPurchaseId,
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

          if (
            usesPettyCash(
              paymentMethod
            )
          ) {
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
          } else {
            historyDescription =
              `Payment ${payment.number} diapprove untuk ${poNumber}. Metode TEMPO. Payment menjadi APPROVED dan Purchase Payable sebesar ${poTotal} dicatat sebagai hutang supplier. Petty Cash tidak dipotong.`;
          }

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
          RETURN
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
        } telah dipotong sebesar ${result.payment.amount}.`;
    }

    if (
      result.paymentMethod ===
      PaymentMethod.TEMPO
    ) {
      message =
        "Payment TEMPO berhasil diapprove. Payment tetap APPROVED, Purchase Payable dicatat sebagai hutang supplier, dan Petty Cash tidak dipotong.";
    }

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
      },
    });
  } catch (error: any) {
    console.error(
      "APPROVE PAYMENT ERROR:",
      error
    );

    const message =
      String(
        error?.message ??
          ""
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
            `Total payment melebihi nilai PO. Sisa yang dapat diproses: ${remaining}`,

          remaining,
        },
        {
          status: 400,
        }
      );
    }

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

    if (
      message.startsWith(
        "PETTY_CASH_INSUFFICIENT:"
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
            `Saldo Petty Cash tidak mencukupi. Saldo tersedia: ${balance}`,

          balance,
        },
        {
          status: 400,
        }
      );
    }

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