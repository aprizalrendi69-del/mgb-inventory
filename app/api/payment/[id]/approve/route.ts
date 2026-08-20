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

PO PUSAT
Payment CASH / COD / CBD
        ↓
Petty Cash Pusat

PO OUTLET
Payment CASH / COD / CBD
        ↓
Petty Cash Outlet sesuai PO

METODE NON-CASH
        ↓
Tidak membuat Petty Cash

OUTLET_ADMIN
        ↓
Tidak dapat approve payment
===========================================================
*/

async function getCurrentUser() {
  try {
    const cookieStore = await cookies();

    const session = cookieStore.get("erp-session");

    if (!session?.value) {
      return null;
    }

    let sessionData: any;

    try {
      sessionData = JSON.parse(session.value);
    } catch {
      return null;
    }

    const sessionUser =
      sessionData?.user ?? sessionData;

    const userId = Number(sessionUser?.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return null;
    }

    const user = await prisma.user.findUnique({
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
PAYMENT METHOD YANG MENGGUNAKAN PETTY CASH
===========================================================
*/

function usesPettyCash(method: PaymentMethod) {
  return (
    method === PaymentMethod.CASH ||
    method === PaymentMethod.COD ||
    method === PaymentMethod.CBD
  );
}

/*
===========================================================
GENERATE PETTY CASH NUMBER
===========================================================
*/

async function generatePettyCashNumber(tx: any) {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const prefix = `PC-${year}${month}-`;

  const last = await tx.pettyCash.findFirst({
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
    const lastNumber = Number(
      last.number.replace(prefix, "")
    );

    if (Number.isFinite(lastNumber)) {
      sequence = lastNumber + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, "0")}`;
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
    const user = await getCurrentUser();

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

    const { id } = await params;

    const paymentId = Number(id);

    if (
      !Number.isInteger(paymentId) ||
      paymentId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "ID payment tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    TRANSACTION
    ========================================================
    */

    const approvedAt = new Date();

    const result = await prisma.$transaction(
      async (tx) => {
        /*
        ----------------------------------------------------
        GET PAYMENT
        ----------------------------------------------------
        */

        const payment =
          await tx.payment.findUnique({
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
            },
          });

        if (!payment) {
          throw new Error(
            "PAYMENT_NOT_FOUND"
          );
        }

        /*
        ----------------------------------------------------
        STATUS
        ----------------------------------------------------
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
        ----------------------------------------------------
        SOURCE
        ----------------------------------------------------
        */

        if (
          !payment.purchaseId &&
          !payment.outletPurchaseId
        ) {
          throw new Error(
            "PAYMENT_SOURCE_MISSING"
          );
        }

        if (
          payment.purchaseId &&
          payment.outletPurchaseId
        ) {
          throw new Error(
            "PAYMENT_SOURCE_MULTIPLE"
          );
        }

        /*
        ----------------------------------------------------
        DETERMINE OUTLET
        ----------------------------------------------------
        */

        let outletId: number | null = null;

        let poNumber = "-";

        if (payment.outletPurchaseId) {
          const outletPurchase =
            payment.outletPurchase;

          if (!outletPurchase) {
            throw new Error(
              "OUTLET_PURCHASE_NOT_FOUND"
            );
          }

          outletId =
            outletPurchase.outletId;

          poNumber =
            outletPurchase.number;
        } else {
          poNumber =
            payment.purchase?.number ?? "-";
        }

        /*
        ----------------------------------------------------
        PAYMENT METHOD
        ----------------------------------------------------
        */

        const paymentMethod =
          payment.method;

        const shouldUsePettyCash =
          usesPettyCash(paymentMethod);

        /*
        ----------------------------------------------------
        UPDATE PAYMENT
        ----------------------------------------------------
        */

        const updatedPayment =
          await tx.payment.update({
            where: {
              id: payment.id,
            },

            data: {
              status:
                PaymentStatus.APPROVED,

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
        ----------------------------------------------------
        DEFAULT RESULT
        ----------------------------------------------------
        */

        let pettyCash = null;
        let account = null;

        /*
        ====================================================
        CASH / COD / CBD
        ====================================================
        */

        if (shouldUsePettyCash) {
          /*
          --------------------------------------------------
          FIND ACCOUNT
          --------------------------------------------------

          outletId === null
          → Petty Cash Pusat

          outletId !== null
          → Petty Cash Outlet tersebut
          */

          account =
            await tx.pettyCashAccount.findFirst({
              where: {
                outletId,
                isActive: true,
              },

              orderBy: {
                id: "asc",
              },
            });

          if (!account) {
            throw new Error(
              outletId === null
                ? "PETTY_CASH_CENTRAL_ACCOUNT_NOT_FOUND"
                : "PETTY_CASH_OUTLET_ACCOUNT_NOT_FOUND"
            );
          }

          /*
          --------------------------------------------------
          CEK DUPLIKASI
          --------------------------------------------------
          */

          const existingPettyCash =
            await tx.pettyCash.findFirst({
              where: {
                paymentId: payment.id,
              },
            });

          if (existingPettyCash) {
            throw new Error(
              "PETTY_CASH_ALREADY_EXISTS"
            );
          }

          /*
          --------------------------------------------------
          HITUNG SALDO
          --------------------------------------------------
          */

          const approvedTransactions =
            await tx.pettyCash.findMany({
              where: {
                accountId: account.id,

                status:
                  PettyCashStatus.APPROVED,
              },

              select: {
                type: true,
                amount: true,
              },
            });

          let currentBalance =
            Number(
              account.openingBalance
            ) || 0;

          for (
            const trx of approvedTransactions
          ) {
            const amount =
              Number(trx.amount) || 0;

            if (
              trx.type ===
              PettyCashType.IN
            ) {
              currentBalance += amount;
            } else if (
              trx.type ===
              PettyCashType.OUT
            ) {
              currentBalance -= amount;
            }
          }

          /*
          --------------------------------------------------
          CEK SALDO
          --------------------------------------------------
          */

          const paymentAmount =
            Number(payment.amount);

          if (
            paymentAmount >
            currentBalance
          ) {
            throw new Error(
              `PETTY_CASH_INSUFFICIENT:${currentBalance}`
            );
          }

          /*
          --------------------------------------------------
          BALANCE
          --------------------------------------------------
          */

          const balanceBefore =
            currentBalance;

          const balanceAfter =
            balanceBefore -
            paymentAmount;

          /*
          --------------------------------------------------
          NUMBER
          --------------------------------------------------
          */

          const pettyCashNumber =
            await generatePettyCashNumber(
              tx
            );

          /*
          --------------------------------------------------
          CREATE PETTY CASH OUT
          --------------------------------------------------
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

                category:
                  outletId === null
                    ? "PEMBAYARAN PO PUSAT"
                    : "PEMBAYARAN PO OUTLET",

                description:
                  `Pembayaran ${payment.number} untuk PO ${poNumber}`,

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
          --------------------------------------------------
          UPDATE ACCOUNT BALANCE
          --------------------------------------------------
          */

          account =
            await tx.pettyCashAccount.update({
              where: {
                id: account.id,
              },

              data: {
                currentBalance:
                  balanceAfter,
              },

              include: {
                outlet: true,
              },
            });
        }

        /*
        ----------------------------------------------------
        HISTORY
        ----------------------------------------------------
        */

        await tx.history.create({
          data: {
            transactionType:
              "PURCHASE",

            referenceNumber:
              payment.number,

            description:
              shouldUsePettyCash
                ? `Payment ${payment.number} diapprove untuk ${poNumber} sebesar ${payment.amount}. ${
                    outletId === null
                      ? "Petty Cash Pusat"
                      : `Petty Cash Outlet ${payment.outletPurchase?.outlet?.name ?? ""}`
                  } berkurang.`
                : `Payment ${payment.number} diapprove untuk ${poNumber} sebesar ${payment.amount}. Metode ${paymentMethod}, tidak menggunakan Petty Cash.`,

            userId:
              user.id,
          },
        });

        return {
          payment: updatedPayment,

          pettyCash,

          account,
        };
      }
    );

    /*
    ========================================================
    RESPONSE
    ========================================================
    */

    return NextResponse.json({
      success: true,

      message:
        result.pettyCash
          ? "Payment berhasil diapprove dan otomatis dicatat ke Petty Cash."
          : "Payment berhasil diapprove. Payment ini tidak menggunakan Petty Cash.",

      data: result,
    });
  } catch (error: any) {
    console.error(
      "APPROVE PAYMENT ERROR:",
      error
    );

    if (
      error?.message ===
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
      error?.message ===
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
      error?.message ===
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
      error?.message ===
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
      error?.message ===
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
      error?.message ===
      "PETTY_CASH_CENTRAL_ACCOUNT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Akun Petty Cash Pusat belum dibuat.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      error?.message ===
      "PETTY_CASH_OUTLET_ACCOUNT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Akun Petty Cash untuk outlet tersebut belum dibuat.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      error?.message?.startsWith(
        "PETTY_CASH_INSUFFICIENT:"
      )
    ) {
      const balance =
        Number(
          error.message.split(":")[1]
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
      error?.message ===
      "PETTY_CASH_ALREADY_EXISTS"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment ini sudah tercatat di Petty Cash.",
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