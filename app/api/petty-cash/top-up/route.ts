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
  try {
    const cookieStore = await cookies();

    const session =
      cookieStore.get("erp-session");

    if (!session?.value) {
      return null;
    }

    const data =
      JSON.parse(session.value);

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
  } catch (error) {
    console.error(
      "GET CURRENT USER TOP UP ERROR:",
      error
    );

    return null;
  }
}

// =====================================================
// TOP UP PETTY CASH
// =====================================================
//
// PUSAT
// - outletId = null
// - menggunakan PettyCashAccount Pusat
//
// OUTLET
// - outletId = ID outlet
// - menggunakan PettyCashAccount Outlet
//
// TOP UP:
// - ADMIN / MANAGER saja
// - langsung APPROVED
// - langsung menambah currentBalance account
//
// SUMBER SALDO UTAMA:
// PettyCashAccount.currentBalance
//
// PettyCash hanya menjadi ledger / riwayat transaksi.
// =====================================================

export async function POST(
  req: NextRequest
) {
  try {
    // ===================================================
    // CURRENT USER
    // ===================================================

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        {
          status: 401,
        }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak aktif",
        },
        {
          status: 403,
        }
      );
    }

    // ===================================================
    // ACCESS
    // ===================================================

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
        {
          status: 403,
        }
      );
    }

    // ===================================================
    // BODY
    // ===================================================

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

    const requestedAccountId =
      body.accountId === null ||
      body.accountId === undefined ||
      body.accountId === ""
        ? null
        : Number(body.accountId);

    const referenceNumber =
      body.referenceNumber ===
        undefined ||
      body.referenceNumber === null ||
      String(
        body.referenceNumber
      ).trim() === ""
        ? null
        : String(
            body.referenceNumber
          ).trim();

    const remarks =
      body.remarks ===
        undefined ||
      body.remarks === null ||
      String(
        body.remarks
      ).trim() === ""
        ? null
        : String(
            body.remarks
          ).trim();

    // ===================================================
    // VALIDATE AMOUNT
    // ===================================================

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
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // VALIDATE OUTLET ID
    // ===================================================

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
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // VALIDATE ACCOUNT ID
    // ===================================================

    if (
      requestedAccountId !== null &&
      (
        !Number.isInteger(
          requestedAccountId
        ) ||
        requestedAccountId <= 0
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Akun Petty Cash tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // TRANSACTION
    // ===================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // =============================================
          // VALIDATE OUTLET
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

                select: {
                  id: true,
                  name: true,
                  active: true,
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
          // FIND PETTY CASH ACCOUNT
          // =============================================

          let account;

          if (
            requestedAccountId !== null
          ) {
            account =
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
                "Akun Petty Cash tidak ditemukan"
              );
            }

            if (!account.isActive) {
              throw new Error(
                "Akun Petty Cash tidak aktif"
              );
            }

            // -------------------------------------------
            // ACCOUNT HARUS SESUAI OUTLET
            // -------------------------------------------

            if (
              account.outletId !==
              requestedOutletId
            ) {
              throw new Error(
                account.outletId === null
                  ? "Akun Petty Cash Pusat tidak sesuai dengan outlet transaksi"
                  : "Akun Petty Cash Outlet tidak sesuai dengan outlet transaksi"
              );
            }
          } else {
            // ===========================================
            // ACCOUNT TIDAK DIPILIH
            // OTOMATIS CARI AKUN SESUAI OUTLET
            // ===========================================

            account =
              await tx.pettyCashAccount.findFirst(
                {
                  where: {
                    outletId:
                      requestedOutletId,

                    isActive: true,
                  },

                  orderBy: {
                    id: "asc",
                  },
                }
              );

            if (!account) {
              throw new Error(
                requestedOutletId === null
                  ? "Akun Petty Cash Pusat belum tersedia"
                  : "Akun Petty Cash Outlet belum tersedia"
              );
            }
          }

          // =============================================
          // SALDO DARI ACCOUNT
          // =============================================

          const balanceBefore =
            roundMoney(
              Number(
                account.currentBalance ??
                  account.openingBalance ??
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
          // CREATE PETTY CASH
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

                accountId:
                  account.id,

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

          // =============================================
          // UPDATE ACCOUNT BALANCE
          // =============================================

          const updatedAccount =
            await tx.pettyCashAccount.update({
              where: {
                id:
                  account.id,
              },

              data: {
                currentBalance:
                  balanceAfter,
              },
            });

          return {
            pettyCash,
            updatedAccount,
            balanceBefore,
            balanceAfter,
          };
        }
      );

    // ===================================================
    // RESPONSE
    // ===================================================

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

          accountId:
            result.pettyCash.accountId,

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

          currentBalance:
            Number(
              result.updatedAccount
                .currentBalance
            ),

          referenceNumber,

          remarks,

          status:
            result.pettyCash.status,
        },
      },
      {
        status: 201,
      }
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
      {
        status: 400,
      }
    );
  }
}