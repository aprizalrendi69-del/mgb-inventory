import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/*
===========================================================
CURRENT USER
===========================================================
*/

async function getCurrentUser() {
  try {
    const cookieStore = await cookies();

    const session = cookieStore.get("erp-session");

    if (!session?.value) {
      return null;
    }

    let data: any;

    try {
      data = JSON.parse(session.value);
    } catch {
      return null;
    }

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

    if (!user || !user.active) {
      return null;
    }

    return user;
  } catch (error) {
    console.error(
      "GET CURRENT USER PETTY CASH ACCOUNTS ERROR:",
      error
    );

    return null;
  }
}

/*
===========================================================
ROLE HELPERS
===========================================================
*/

function isCentralAdmin(role: Role) {
  return (
    role === Role.ADMIN ||
    role === Role.MANAGER
  );
}

function isOutletAdmin(role: Role) {
  return (
    role === Role.OUTLET_ADMIN ||
    role === Role.ADMIN_OUTLET
  );
}

/*
===========================================================
GET PETTY CASH ACCOUNTS
===========================================================

ADMIN / MANAGER
----------------
Boleh melihat:

1. Petty Cash Pusat
2. Petty Cash seluruh outlet

OUTLET ADMIN
------------
Hanya:

1. Petty Cash outlet miliknya

PUSAT
------
outletId = null

OUTLET
------
outletId = user.outletId
===========================================================
*/

export async function GET() {
  try {
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

    /*
    ========================================================
    ACCESS
    ========================================================
    */

    if (
      !isCentralAdmin(user.role) &&
      !isOutletAdmin(user.role)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses ke akun Petty Cash.",
        },
        {
          status: 403,
        }
      );
    }

    /*
    ========================================================
    WHERE
    ========================================================
    */

    let where: any = {
      isActive: true,
    };

    /*
    --------------------------------------------------------
    OUTLET ADMIN
    --------------------------------------------------------
    */

    if (isOutletAdmin(user.role)) {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum memiliki outlet.",
          },
          {
            status: 400,
          }
        );
      }

      where = {
        isActive: true,
        outletId: user.outletId,
      };
    }

    /*
    --------------------------------------------------------
    CENTRAL ADMIN
    --------------------------------------------------------

    Tidak menggunakan findUnique outletId=null.

    Kita menggunakan findMany sehingga akun Pusat
    (outletId null) dan semua akun outlet dapat diambil.
    --------------------------------------------------------
    */

    const accounts =
      await prisma.pettyCashAccount.findMany({
        where,

        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          outletId: true,
          openingBalance: true,
          currentBalance: true,
          isActive: true,

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },

        orderBy: [
          {
            outletId: "asc",
          },
          {
            code: "asc",
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

      data: accounts.map(
        (account) => ({
          id: account.id,

          code: account.code,

          name: account.name,

          type: account.type,

          outletId:
            account.outletId,

          openingBalance:
            Number(
              account.openingBalance ?? 0
            ),

          currentBalance:
            Number(
              account.currentBalance ?? 0
            ),

          active:
            Boolean(
              account.isActive
            ),

          outlet:
            account.outlet
              ? {
                  id:
                    account.outlet.id,

                  code:
                    account.outlet.code,

                  name:
                    account.outlet.name,
                }
              : null,
        })
      ),
    });
  } catch (error) {
    console.error(
      "GET PETTY CASH ACCOUNTS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal mengambil akun Petty Cash.",
      },
      {
        status: 500,
      }
    );
  }
}