import {
  NextRequest,
  NextResponse,
} from "next/server";

import { cookies } from "next/headers";

import {
  PettyCashStatus,
  PettyCashType,
  Role,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  generatePettyCashNumber,
  roundMoney,
} from "@/lib/payment";

// =====================================================
// CURRENT USER
// =====================================================

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session = cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  try {
    const data = JSON.parse(session.value);

    const userId = Number(
      data?.user?.id ??
        data?.id
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return null;
    }

    return await prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        fullname: true,
        role: true,
        active: true,
        outletId: true,
      },
    });
  } catch {
    return null;
  }
}

// =====================================================
// TOP UP PETTY CASH
//
// PUSAT
// outletId = null
//
// OUTLET
// outletId = user.outletId
//
// TIDAK ADA:
// - Cash Account
// - Bank
// - Cash Ledger
// =====================================================

export async function POST(
  req: NextRequest
) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        { status: 401 }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak aktif",
        },
        { status: 403 }
      );
    }

    if (
      user.role !== Role.ADMIN &&
      user.role !== Role.MANAGER
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak memiliki akses Top Up Petty Cash",
        },
        { status: 403 }
      );
    }

    const body =
      await req.json();

    const amount =
      roundMoney(
        Number(body.amount)
      );

    const requestedOutletId =
      body.outletId === null ||
      body.outletId === undefined ||
      body.outletId === ""
        ? null
        : Number(body.outletId);

    const referenceNumber =
      body.referenceNumber
        ? String(
            body.referenceNumber
          ).trim()
        : null;

    const remarks =
      body.remarks
        ? String(
            body.remarks
          ).trim()
        : null;

    // =================================================
    // VALIDATE AMOUNT
    // =================================================

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Jumlah Top Up harus lebih dari 0",
        },
        { status: 400 }
      );
    }

    // =================================================
    // VALIDATE OUTLET
    // =================================================

    if (
      requestedOutletId !== null &&
      (
        !Number.isInteger(
          requestedOutletId
        ) ||
        requestedOutletId <= 0
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak valid",
        },
        { status: 400 }
      );
    }

    const result =
      await prisma.$transaction(
        async (tx) => {
          // =============================================
          // CHECK OUTLET
          // =============================================

          let outletName =
            "Pusat";

          if (
            requestedOutletId !== null
          ) {
            const outlet =
              await tx.outlet.findUnique({
                where: {
                  id:
                    requestedOutletId,
                },
              });

            if (!outlet) {
              throw new Error(
                "Outlet tidak ditemukan"
              );
            }

            if (!outlet.active) {
              throw new Error(
                "Outlet tidak aktif"
              );
            }

            outletName =
              outlet.name;
          }

          // =============================================
          // AMBIL SALDO PETTY CASH TERAKHIR
          // =============================================

          const last =
            await tx.pettyCash.findFirst({
              where: {
                outletId:
                  requestedOutletId,

                status:
                  PettyCashStatus.APPROVED,
              },

              orderBy: [
                {
                  trxDate:
                    "desc",
                },
                {
                  id:
                    "desc",
                },
              ],
            });

          const balanceBefore =
            roundMoney(
              Number(
                last?.balanceAfter ??
                  0
              )
            );

          const balanceAfter =
            roundMoney(
              balanceBefore +
                amount
            );

          // =============================================
          // GENERATE NUMBER
          // =============================================

          const number =
            await generatePettyCashNumber(
              tx,
              new Date()
            );

          // =============================================
          // CREATE PETTY CASH IN
          // =============================================

          const pettyCash =
            await tx.pettyCash.create({
              data: {
                number,

                trxDate:
                  new Date(),

                type:
                  PettyCashType.IN,

                category:
                  "TOP_UP",

                description:
                  remarks ||
                  `Top Up Petty Cash ${outletName}`,

                amount,

                balanceBefore,

                balanceAfter,

                paymentId:
                  null,

                outletId:
                  requestedOutletId,

                createdBy:
                  user.id,

                approvedBy:
                  user.id,

                status:
                  PettyCashStatus.APPROVED,

                approvedAt:
                  new Date(),
              },
            });

          return {
            pettyCash,
            balanceBefore,
            balanceAfter,
          };
        }
      );

    return NextResponse.json(
      {
        success: true,
        message:
          "Petty Cash berhasil di-Top Up",

        data: {
          id:
            result.pettyCash.id,

          number:
            result.pettyCash.number,

          outletId:
            result.pettyCash.outletId,

          amount:
            Number(
              result.pettyCash.amount
            ),

          balanceBefore:
            result.balanceBefore,

          balanceAfter:
            result.balanceAfter,

          referenceNumber,

          remarks,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "PETTY CASH TOP UP ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Gagal melakukan Top Up Petty Cash";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 400 }
    );
  }
}