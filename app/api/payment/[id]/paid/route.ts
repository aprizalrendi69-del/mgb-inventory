import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { PaymentStatus } from "@prisma/client";

/*
===========================================================
MARK PAYMENT AS PAID
===========================================================

PUT /api/payment/[id]/paid

FLOW:

APPROVED
   ↓
PAID

KETENTUAN:

- User harus login
- User harus aktif
- ADMIN / MANAGER dapat menandai PAID
- Payment harus APPROVED
- Tidak mengubah PO
- Tidak mengubah stock
- Tidak mengubah receipt
- Membuat History
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

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
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
      "GET CURRENT USER PAID PAYMENT ERROR:",
      error
    );

    return null;
  }
}

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
      user.role !== "ADMIN" &&
      user.role !== "MANAGER"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses untuk menyelesaikan payment",
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
    FIND PAYMENT
    ========================================================
    */

    const payment =
      await prisma.payment.findUnique({
        where: {
          id: paymentId,
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
              status: true,
            },
          },

          outletPurchase: {
            select: {
              id: true,
              number: true,
              total: true,
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

    if (!payment) {
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

    /*
    ========================================================
    STATUS CHECK
    ========================================================
    */

    if (
      payment.status !==
      PaymentStatus.APPROVED
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Payment belum dapat diselesaikan karena status saat ini ${payment.status}`,
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    VALIDASI SUMBER PO
    ========================================================
    */

    if (
      !payment.purchaseId &&
      !payment.outletPurchaseId
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
      payment.purchaseId &&
      payment.outletPurchaseId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment memiliki dua sumber PO sekaligus",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    MARK AS PAID
    ========================================================
    */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
          --------------------------------------------------
          CEK ULANG STATUS DI TRANSACTION
          --------------------------------------------------
          */

          const currentPayment =
            await tx.payment.findUnique({
              where: {
                id: paymentId,
              },

              select: {
                id: true,
                number: true,
                status: true,
                amount: true,
                purchaseId: true,
                outletPurchaseId: true,
              },
            });

          if (!currentPayment) {
            throw new Error(
              "PAYMENT_NOT_FOUND"
            );
          }

          if (
            currentPayment.status !==
            PaymentStatus.APPROVED
          ) {
            throw new Error(
              "PAYMENT_NOT_APPROVED"
            );
          }

          /*
          --------------------------------------------------
          UPDATE PAYMENT
          --------------------------------------------------
          */

          const updatedPayment =
            await tx.payment.update({
              where: {
                id: paymentId,
              },

              data: {
                status:
                  PaymentStatus.PAID,
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
          --------------------------------------------------
          HISTORY
          --------------------------------------------------
          */

          const poNumber =
            updatedPayment.purchase?.number ??
            updatedPayment.outletPurchase?.number ??
            "-";

          await tx.history.create({
            data: {
              transactionType:
                "PURCHASE",

              referenceNumber:
                updatedPayment.number,

              description:
                `Payment ${updatedPayment.number} telah dibayar untuk ${poNumber} sebesar ${updatedPayment.amount}`,

              userId: user.id,
            },
          });

          return updatedPayment;
        }
      );

    return NextResponse.json({
      success: true,
      message:
        "Payment berhasil ditandai sebagai PAID",
      data: result,
    });
  } catch (error: any) {
    console.error(
      "PAID PAYMENT ERROR:",
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
      "PAYMENT_NOT_APPROVED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment belum berstatus APPROVED atau sudah diproses",
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
          "Gagal menyelesaikan payment",
      },
      {
        status: 500,
      }
    );
  }
}