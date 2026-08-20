import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/*
===========================================================
PETTY CASH ACCOUNTS API
===========================================================

PUSAT
- outletId = null

OUTLET
- outletId = ID outlet

ADMIN / MANAGER
- dapat melihat semua akun
- dapat membuat akun PUSAT
- dapat membuat akun outlet

OUTLET_ADMIN
- hanya dapat melihat akun outlet sendiri
- hanya dapat membuat akun outlet sendiri
- tidak boleh membuat akun PUSAT
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
      "PETTY CASH ACCOUNTS CURRENT USER ERROR:",
      error
    );

    return null;
  }
}

/*
===========================================================
GET
===========================================================
*/

export async function GET() {
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

    const allowedRoles = [
      Role.ADMIN,
      Role.MANAGER,
      Role.OUTLET_ADMIN,
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses ke akun petty cash.",
        },
        {
          status: 403,
        }
      );
    }

    /*
    ========================================================
    FILTER ACCOUNT
    ========================================================
    */

    const where: any = {};

    if (user.role === Role.OUTLET_ADMIN) {
      if (!user.outletId) {
        return NextResponse.json({
          success: true,
          data: [],
          outlets: [],
        });
      }

      where.outletId = user.outletId;
    }

    /*
    ========================================================
    ACCOUNTS
    ========================================================
    */

    const accounts =
      await prisma.pettyCashAccount.findMany({
        where,

        include: {
          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
              active: true,
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
    OUTLETS
    ========================================================
    */

    let outlets: any[] = [];

    if (user.role === Role.OUTLET_ADMIN) {
      if (user.outletId) {
        const outlet =
          await prisma.outlet.findUnique({
            where: {
              id: user.outletId,
            },

            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
          });

        if (outlet) {
          outlets = [outlet];
        }
      }
    } else {
      outlets =
        await prisma.outlet.findMany({
          where: {
            active: true,
          },

          select: {
            id: true,
            code: true,
            name: true,
            active: true,
          },

          orderBy: {
            name: "asc",
          },
        });
    }

    return NextResponse.json({
      success: true,
      data: accounts,
      outlets,
    });
  } catch (error) {
    console.error(
      "GET /api/petty-cash/accounts ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil data akun petty cash.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
===========================================================
POST
===========================================================
*/

export async function POST(req: NextRequest) {
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

    const allowedRoles = [
      Role.ADMIN,
      Role.MANAGER,
      Role.OUTLET_ADMIN,
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki izin membuat akun petty cash.",
        },
        {
          status: 403,
        }
      );
    }

    const body = await req.json();

    /*
    ========================================================
    BASIC FIELD
    ========================================================
    */

    const code =
      typeof body.code === "string"
        ? body.code.trim()
        : "";

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const openingBalance =
      Number(body.openingBalance ?? 0);

    const isActive =
      body.isActive === undefined
        ? true
        : Boolean(body.isActive);

    /*
    ========================================================
    OUTLET ID
    ========================================================
    */

    let outletId: number | null = null;

    if (
      body.outletId !== undefined &&
      body.outletId !== null &&
      body.outletId !== ""
    ) {
      outletId = Number(body.outletId);

      if (
        !Number.isInteger(outletId) ||
        outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Outlet tidak valid.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
    ========================================================
    OUTLET ADMIN
    ========================================================
    */

    if (user.role === Role.OUTLET_ADMIN) {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum ditentukan.",
          },
          {
            status: 400,
          }
        );
      }

      /*
       * Outlet admin TIDAK BOLEH membuat PUSAT.
       */

      if (outletId === null) {
        return NextResponse.json(
          {
            success: false,
            message:
              "OUTLET_ADMIN hanya dapat membuat akun petty cash outlet sendiri.",
          },
          {
            status: 403,
          }
        );
      }

      /*
       * Paksa outlet sesuai user.
       */

      if (outletId !== user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda tidak dapat membuat akun untuk outlet lain.",
          },
          {
            status: 403,
          }
        );
      }
    }

    /*
    ========================================================
    VALIDATION
    ========================================================
    */

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          message: "Kode akun wajib diisi.",
        },
        {
          status: 400,
        }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Nama akun wajib diisi.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(openingBalance) ||
      openingBalance < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Saldo awal tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    VALIDATE OUTLET
    ========================================================
    */

    if (outletId !== null) {
      const outlet =
        await prisma.outlet.findUnique({
          where: {
            id: outletId,
          },

          select: {
            id: true,
            code: true,
            name: true,
            active: true,
          },
        });

      if (!outlet) {
        return NextResponse.json(
          {
            success: false,
            message: "Outlet tidak ditemukan.",
          },
          {
            status: 404,
          }
        );
      }

      if (!outlet.active) {
        return NextResponse.json(
          {
            success: false,
            message: "Outlet tersebut tidak aktif.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
    ========================================================
    DUPLICATE CODE
    ========================================================
    */

    const duplicate =
      await prisma.pettyCashAccount.findFirst({
        where: {
          code,
        },

        select: {
          id: true,
          code: true,
          name: true,
        },
      });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Kode akun "${code}" sudah digunakan.`,
        },
        {
          status: 409,
        }
      );
    }

    /*
    ========================================================
    CREATE
    ========================================================
    */

    const account =
      await prisma.pettyCashAccount.create({
        data: {
          code,
          name,
          openingBalance,

          /*
           * currentBalance mengikuti saldo awal
           * saat akun baru dibuat.
           */
          currentBalance: openingBalance,

          isActive,

          outletId,
        },

        include: {
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

    return NextResponse.json(
      {
        success: true,
        message:
          "Akun petty cash berhasil dibuat.",
        data: account,
      },
      {
        status: 201,
      }
    );
  } catch (error: any) {
    console.error(
      "POST /api/petty-cash/accounts ERROR:",
      error
    );

    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kode akun petty cash sudah digunakan.",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal membuat akun petty cash.",
      },
      {
        status: 500,
      }
    );
  }
}