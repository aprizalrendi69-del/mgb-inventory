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
  roundMoney,
} from "@/lib/payment";

/*
===========================================================
PETTY CASH APPROVAL API
===========================================================

BUSINESS RULE
-----------------------------------------------------------

ACCOUNT PUSAT
- account.outletId = null

ACCOUNT OUTLET
- account.outletId = outletId

TRANSACTION PUSAT
- pettyCash.outletId = null

TRANSACTION OUTLET
- pettyCash.outletId = outletId

ACCOUNT DAN TRANSAKSI WAJIB SATU LOKASI.

SALDO
-----------------------------------------------------------
PENDING
- tidak mengubah saldo

APPROVED IN
- menambah saldo account terkait

APPROVED OUT
- mengurangi saldo account terkait

REJECTED
- tidak mengubah saldo

ACCESS
-----------------------------------------------------------
ADMIN
- dapat approve Pusat
- dapat approve semua Outlet

MANAGER
- dapat approve Pusat
- dapat approve semua Outlet

OUTLET_ADMIN
- tidak dapat approval

IMPORTANT
-----------------------------------------------------------
Saldo TIDAK PERNAH dihitung dari semua account.

Hanya:
pettyCash.accountId
        ↓
pettyCashAccount.currentBalance

===========================================================
*/

/*
===========================================================
CURRENT USER
===========================================================
*/

async function getCurrentUser() {
  try {
    const cookieStore =
      await cookies();

    const session =
      cookieStore.get("erp-session");

    if (!session?.value) {
      return null;
    }

    let sessionData: any;

    try {
      sessionData =
        JSON.parse(
          session.value
        );
    } catch {
      return null;
    }

    const sessionUser =
      sessionData?.user ??
      sessionData;

    const userId =
      Number(
        sessionUser?.id
      );

    if (
      !Number.isInteger(
        userId
      ) ||
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
          fullname: true,
          role: true,
          active: true,
          outletId: true,
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
      "GET CURRENT USER PETTY CASH APPROVAL ERROR:",
      error
    );

    return null;
  }
}

/*
===========================================================
GET ACCOUNT BALANCE
===========================================================
*/

function getAccountBalance(
  account: {
    currentBalance?: unknown;
    openingBalance?: unknown;
  }
) {
  const current =
    Number(
      account.currentBalance ??
        account.openingBalance ??
        0
    );

  if (
    !Number.isFinite(
      current
    )
  ) {
    return 0;
  }

  return roundMoney(
    current
  );
}

/*
===========================================================
POST
===========================================================

action:
- APPROVE
- REJECT
===========================================================
*/

export async function POST(
  req: NextRequest
) {
  try {
    /*
    ========================================================
    1. CURRENT USER
    ========================================================
    */

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login",
        },
        {
          status: 401,
        }
      );
    }

    /*
    ========================================================
    2. ACCESS CONTROL
    ========================================================
    */

    if (
      user.role !==
        Role.ADMIN &&
      user.role !==
        Role.MANAGER
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses approval Petty Cash",
        },
        {
          status: 403,
        }
      );
    }

    /*
    ========================================================
    3. BODY
    ========================================================
    */

    let body: any;

    try {
      body =
        await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Body request tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const pettyCashId =
      Number(
        body?.id
      );

    const action =
      String(
        body?.action ??
          ""
      )
        .trim()
        .toUpperCase();

    /*
    ========================================================
    4. VALIDATE ID
    ========================================================
    */

    if (
      !Number.isInteger(
        pettyCashId
      ) ||
      pettyCashId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Petty Cash tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    5. VALIDATE ACTION
    ========================================================
    */

    if (
      action !== "APPROVE" &&
      action !== "REJECT"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Action harus APPROVE atau REJECT",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    6. DATABASE TRANSACTION
    ========================================================
    */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
          ==================================================
          GET PETTY CASH
          ==================================================
          */

          const pettyCash =
            await tx.pettyCash.findUnique({
              where: {
                id:
                  pettyCashId,
              },

              include: {
                account: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    outletId: true,
                    openingBalance: true,
                    currentBalance: true,
                    isActive: true,
                  },
                },

                outlet: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    active: true,
                  },
                },
              },
            });

          if (!pettyCash) {
            throw new Error(
              "Petty Cash tidak ditemukan"
            );
          }

          /*
          ==================================================
          HARUS PENDING
          ==================================================
          */

          if (
            pettyCash.status !==
            PettyCashStatus.PENDING
          ) {
            throw new Error(
              `Petty Cash sudah ${pettyCash.status} dan tidak dapat diproses lagi`
            );
          }

          /*
          ==================================================
          ACCOUNT ID
          ==================================================
          */

          if (
            !pettyCash.accountId
          ) {
            throw new Error(
              "Petty Cash tidak memiliki accountId"
            );
          }

          /*
          ==================================================
          GET ACCOUNT TERBARU
          ==================================================

          Sengaja mengambil ulang account di dalam
          transaction supaya saldo yang dipakai adalah
          saldo account yang sebenarnya.
          ==================================================
          */

          const account =
            await tx.pettyCashAccount.findUnique({
              where: {
                id:
                  pettyCash.accountId,
              },

              select: {
                id: true,
                code: true,
                name: true,
                outletId: true,
                openingBalance: true,
                currentBalance: true,
                isActive: true,
              },
            });

          if (!account) {
            throw new Error(
              "Akun Petty Cash tidak ditemukan"
            );
          }

          /*
          ==================================================
          ACCOUNT ACTIVE
          ==================================================
          */

          if (
            !account.isActive
          ) {
            throw new Error(
              "Akun Petty Cash tidak aktif"
            );
          }

          /*
          ==================================================
          NORMALIZE OUTLET
          ==================================================
          */

          const accountOutletId =
            account.outletId ??
            null;

          const transactionOutletId =
            pettyCash.outletId ??
            null;

          /*
          ==================================================
          VALIDATE ACCOUNT LOCATION
          ==================================================

          PUSAT:
          null === null

          OUTLET 1:
          1 === 1

          OUTLET 2:
          2 === 2
          ==================================================
          */

          if (
            accountOutletId !==
            transactionOutletId
          ) {
            console.error(
              "PETTY CASH ACCOUNT LOCATION MISMATCH",
              {
                pettyCashId:
                  pettyCash.id,

                pettyCashNumber:
                  pettyCash.number,

                accountId:
                  account.id,

                accountOutletId,

                transactionOutletId,
              }
            );

            throw new Error(
              "Akun Petty Cash tidak sesuai dengan lokasi transaksi"
            );
          }

          /*
          ==================================================
          VALIDATE OUTLET
          ==================================================
          */

          if (
            transactionOutletId !==
            null
          ) {
            const outlet =
              await tx.outlet.findUnique({
                where: {
                  id:
                    transactionOutletId,
                },

                select: {
                  id: true,
                  code: true,
                  name: true,
                  active: true,
                },
              });

            if (!outlet) {
              throw new Error(
                "Outlet transaksi tidak ditemukan"
              );
            }

            if (
              !outlet.active
            ) {
              throw new Error(
                "Outlet transaksi tidak aktif"
              );
            }
          }

          /*
          ==================================================
          VALIDATE TYPE
          ==================================================
          */

          if (
            pettyCash.type !==
              PettyCashType.IN &&
            pettyCash.type !==
              PettyCashType.OUT
          ) {
            throw new Error(
              "Tipe Petty Cash tidak valid"
            );
          }

          /*
          ==================================================
          VALIDATE AMOUNT
          ==================================================
          */

          const amount =
            roundMoney(
              Number(
                pettyCash.amount
              )
            );

          if (
            !Number.isFinite(
              amount
            ) ||
            amount <= 0
          ) {
            throw new Error(
              "Nominal Petty Cash tidak valid"
            );
          }

          /*
          ==================================================
          REJECT
          ==================================================

          REJECT TIDAK MENYENTUH SALDO.
          ==================================================
          */

          if (
            action ===
            "REJECT"
          ) {
            const currentBalance =
              getAccountBalance(
                account
              );

            const rejected =
              await tx.pettyCash.update({
                where: {
                  id:
                    pettyCash.id,
                },

                data: {
                  status:
                    PettyCashStatus.REJECTED,

                  approvedBy:
                    user.id,

                  approvedAt:
                    new Date(),
                },

                include: {
                  account: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      outletId: true,
                      currentBalance: true,
                      openingBalance: true,
                    },
                  },

                  outlet: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                    },
                  },
                },
              });

            return {
              action:
                "REJECT" as const,

              pettyCash:
                rejected,

              accountId:
                account.id,

              accountCode:
                account.code,

              accountName:
                account.name,

              outletId:
                transactionOutletId,

              balanceBefore:
                currentBalance,

              balanceAfter:
                currentBalance,

              currentBalance:
                currentBalance,
            };
          }

          /*
          ==================================================
          APPROVE
          ==================================================
          */

          const balanceBefore =
            getAccountBalance(
              account
            );

          let balanceAfter =
            balanceBefore;

          /*
          ==================================================
          APPROVE IN
          ==================================================
          */

          if (
            pettyCash.type ===
            PettyCashType.IN
          ) {
            balanceAfter =
              roundMoney(
                balanceBefore +
                  amount
              );
          }

          /*
          ==================================================
          APPROVE OUT
          ==================================================
          */

          if (
            pettyCash.type ===
            PettyCashType.OUT
          ) {
            if (
              amount >
              balanceBefore
            ) {
              throw new Error(
                `Saldo Petty Cash tidak mencukupi. Saldo ${
                  account.outletId ===
                  null
                    ? "Pusat"
                    : "Outlet"
                } tersedia Rp ${balanceBefore.toLocaleString(
                  "id-ID"
                )}`
              );
            }

            balanceAfter =
              roundMoney(
                balanceBefore -
                  amount
              );
          }

          /*
          ==================================================
          UPDATE ACCOUNT
          ==================================================

          HANYA ACCOUNT TRANSAKSI INI.
          ==================================================
          */

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

              select: {
                id: true,
                code: true,
                name: true,
                outletId: true,
                openingBalance: true,
                currentBalance: true,
                isActive: true,
              },
            });

          /*
          ==================================================
          UPDATE PETTY CASH
          ==================================================
          */

          const approved =
            await tx.pettyCash.update({
              where: {
                id:
                  pettyCash.id,
              },

              data: {
                balanceBefore,

                balanceAfter,

                status:
                  PettyCashStatus.APPROVED,

                approvedBy:
                  user.id,

                approvedAt:
                  new Date(),
              },

              include: {
                account: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    outletId: true,
                    openingBalance: true,
                    currentBalance: true,
                  },
                },

                outlet: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
              },
            });

          /*
          ==================================================
          RETURN APPROVED
          ==================================================
          */

          return {
            action:
              "APPROVE" as const,

            pettyCash:
              approved,

            accountId:
              updatedAccount.id,

            accountCode:
              updatedAccount.code,

            accountName:
              updatedAccount.name,

            outletId:
              updatedAccount.outletId ??
              null,

            balanceBefore,

            balanceAfter,

            currentBalance:
              getAccountBalance(
                updatedAccount
              ),
          };
        }
      );

    /*
    ========================================================
    7. RESPONSE
    ========================================================
    */

    return NextResponse.json(
      {
        success: true,

        message:
          result.action ===
          "APPROVE"
            ? "Petty Cash berhasil di-approve"
            : "Petty Cash berhasil ditolak",

        data: {
          id:
            result.pettyCash.id,

          number:
            result.pettyCash.number,

          status:
            result.pettyCash.status,

          action:
            result.action,

          type:
            result.pettyCash.type,

          amount:
            Number(
              result.pettyCash.amount
            ),

          /*
          --------------------------------------------------
          LOKASI
          --------------------------------------------------
          */

          outletId:
            result.outletId,

          /*
          --------------------------------------------------
          ACCOUNT
          --------------------------------------------------
          */

          accountId:
            result.accountId,

          accountCode:
            result.accountCode,

          accountName:
            result.accountName,

          /*
          --------------------------------------------------
          SALDO
          --------------------------------------------------
          */

          balanceBefore:
            result.balanceBefore,

          balanceAfter:
            result.balanceAfter,

          currentBalance:
            result.currentBalance,
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "PETTY CASH APPROVAL ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Gagal memproses Petty Cash";

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