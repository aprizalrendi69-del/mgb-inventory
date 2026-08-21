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

Metode pembayaran yang tersimpan pada PO menjadi
SUMBER KEBENARAN UTAMA.

PO PUSAT
Purchase
   ↓
paymentMethod
   ↓
Payment
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
Petty Cash Pusat


PO OUTLET
OutletPurchase
   ↓
paymentMethod
   ↓
Payment
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
Petty Cash Outlet sesuai PO


TEMPO
=====
PO
 ↓
Payment TEMPO
 ↓
Approve
 ↓
PurchasePayable
 ↓
TIDAK memotong Petty Cash


OUTLET_ADMIN
============
Tidak dapat approve payment.


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
PAYMENT METHOD YANG MEMOTONG PETTY CASH
===========================================================

CASH
TRANSFER
COD
CBD

SEMUA menggunakan Petty Cash.

TEMPO TIDAK.
===========================================================
*/

function usesPettyCash(method: PaymentMethod) {
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
        ====================================================
        GET PAYMENT
        ====================================================
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
        ====================================================
        STATUS
        ====================================================
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
        ====================================================
        SOURCE PO
        ====================================================
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
        ====================================================
        SOURCE DATA
        ====================================================
        */

        let outletId: number | null = null;

        let poNumber = "-";

        let poPaymentMethod:
          PaymentMethod | null = null;

        let poTotal = 0;

        let poPurchaseDate: Date | null =
          null;

        /*
        ====================================================
        PO PUSAT
        ====================================================
        */

        if (payment.purchaseId) {
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
        ====================================================
        PO OUTLET
        ====================================================
        */

        if (
          payment.outletPurchaseId
        ) {
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
        ====================================================
        PAYMENT METHOD
        ====================================================

        PO adalah sumber kebenaran.

        Jadi kalau Payment dibuat dengan method yang
        berbeda, sistem tetap menggunakan method dari PO.
        ====================================================
        */

        if (!poPaymentMethod) {
          throw new Error(
            "PO_PAYMENT_METHOD_MISSING"
          );
        }

        const paymentMethod =
          poPaymentMethod;

        /*
        ====================================================
        JUMLAH PAYMENT
        ====================================================
        */

        const paymentAmount =
          Number(payment.amount);

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
        ====================================================
        CEK PAYMENT METHOD PAYMENT
        ====================================================

        Kalau sebelumnya frontend membuat Payment dengan
        method berbeda dari PO, kita sinkronkan otomatis
        dengan metode PO.
        ====================================================
        */

        /*
        ====================================================
        CEK DUPLIKASI PETTY CASH
        ====================================================
        */

        const existingPettyCash =
          await tx.pettyCash.findFirst({
            where: {
              paymentId: payment.id,
            },
          });

        if (
          existingPettyCash &&
          usesPettyCash(paymentMethod)
        ) {
          throw new Error(
            "PETTY_CASH_ALREADY_EXISTS"
          );
        }

        /*
        ====================================================
        ACCOUNT PETTY CASH
        ====================================================
        */

        let account: any = null;

        let pettyCash: any = null;

        /*
        ====================================================
        CASH / TRANSFER / COD / CBD
        ====================================================
        */

        if (
          usesPettyCash(
            paymentMethod
          )
        ) {
          /*
          --------------------------------------------------
          PUSAT
          outletId = null

          OUTLET
          outletId = ID outlet
          --------------------------------------------------
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
          CURRENT BALANCE
          --------------------------------------------------

          Gunakan currentBalance dari account sebagai
          saldo aktif.

          Tidak perlu menghitung ulang seluruh transaksi
          setiap approve.
          --------------------------------------------------
          */

          const currentBalance =
            Number(
              account.currentBalance
            ) || 0;

          /*
          --------------------------------------------------
          CEK SALDO
          --------------------------------------------------
          */

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
          PETTY CASH NUMBER
          --------------------------------------------------
          */

          const pettyCashNumber =
            await generatePettyCashNumber(
              tx
            );

          /*
          --------------------------------------------------
          CATEGORY
          --------------------------------------------------
          */

          let category =
            "PEMBAYARAN PO PUSAT";

          if (outletId !== null) {
            category =
              "PEMBAYARAN PO OUTLET";
          }

          /*
          --------------------------------------------------
          CREATE PETTY CASH
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
          --------------------------------------------------
          UPDATE ACCOUNT
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
        ====================================================
        TEMPO
        ====================================================

        TEMPO TIDAK memotong Petty Cash.

        TEMPO → PurchasePayable.
        ====================================================
        */

        let payable: any = null;

        if (
          paymentMethod ===
          PaymentMethod.TEMPO
        ) {
          /*
          --------------------------------------------------
          CEK PAYABLE LAMA
          --------------------------------------------------
          */

          if (
            payment.purchaseId
          ) {
            payable =
              await tx.purchasePayable.findUnique(
                {
                  where: {
                    purchaseId:
                      payment.purchaseId,
                  },
                }
              );
          }

          if (
            payment.outletPurchaseId
          ) {
            payable =
              await tx.purchasePayable.findUnique(
                {
                  where: {
                    outletPurchaseId:
                      payment.outletPurchaseId,
                  },
                }
              );
          }

          /*
          --------------------------------------------------
          INVOICE NUMBER
          --------------------------------------------------

          Kalau invoiceNumber belum tersedia,
          gunakan referenceNumber Payment.

          Kalau kosong:
          PAY-XXXX sebagai fallback.
          --------------------------------------------------
          */

          const invoiceNumber =
            payment.referenceNumber?.trim() ||
            payment.number;

          const invoiceDate =
            poPurchaseDate ??
            payment.paymentDate;

          /*
          --------------------------------------------------
          AMOUNT TEMPO
          --------------------------------------------------

          Untuk PO TEMPO, nilai hutang adalah nilai PO.

          Jika sudah ada payable, jangan menambah hutang
          dua kali.
          --------------------------------------------------
          */

          if (!payable) {
            payable =
              await tx.purchasePayable.create(
                {
                  data: {
                    purchaseId:
                      payment.purchaseId,

                    outletPurchaseId:
                      payment.outletPurchaseId,

                    supplierId:
                      payment.supplierId,

                    outletId,

                    invoiceNumber,

                    invoiceDate,

                    dueDate: null,

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
          }
        }

        /*
        ====================================================
        UPDATE PAYMENT
        ====================================================

        Method Payment disinkronkan dengan metode PO.
        ====================================================
        */

        const updatedPayment =
          await tx.payment.update({
            where: {
              id: payment.id,
            },

            data: {
              method:
                paymentMethod,

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
        ====================================================
        HISTORY
        ====================================================
        */

        let historyDescription = "";

        if (
          usesPettyCash(
            paymentMethod
          )
        ) {
          historyDescription =
            `Payment ${payment.number} diapprove untuk ${poNumber} sebesar ${paymentAmount}. Metode ${paymentMethod}. Petty Cash ${
              outletId === null
                ? "Pusat"
                : `Outlet ${
                    payment.outletPurchase
                      ?.outlet
                      ?.name ??
                    ""
                  }`
            } berkurang sebesar ${paymentAmount}.`;
        } else if (
          paymentMethod ===
          PaymentMethod.TEMPO
        ) {
          historyDescription =
            `Payment ${payment.number} diapprove untuk ${poNumber} sebesar ${poTotal}. Metode TEMPO. Tidak memotong Petty Cash dan dicatat sebagai hutang supplier.`;
        } else {
          historyDescription =
            `Payment ${payment.number} diapprove untuk ${poNumber} sebesar ${paymentAmount}. Metode ${paymentMethod}.`;
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
        ====================================================
        RETURN
        ====================================================
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
        };
      }
    );

    /*
    ========================================================
    RESPONSE
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
        `Payment berhasil diapprove. Metode ${result.paymentMethod} dan Petty Cash ${
          result.outletId === null
            ? "Pusat"
            : "Outlet"
        } otomatis dipotong.`;
    }

    if (
      result.paymentMethod ===
      PaymentMethod.TEMPO
    ) {
      message =
        "Payment TEMPO berhasil diapprove dan otomatis masuk ke Purchase Payable. Petty Cash tidak dipotong.";
    }

    return NextResponse.json({
      success: true,

      message,

      data: result,
    });
  } catch (error: any) {
    console.error(
      "APPROVE PAYMENT ERROR:",
      error
    );

    /*
    ========================================================
    ERROR HANDLING
    ========================================================
    */

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
      error?.message ===
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