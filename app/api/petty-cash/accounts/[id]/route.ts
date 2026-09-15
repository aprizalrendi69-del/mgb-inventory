import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/*
===========================================================
PETTY CASH ACCOUNT DETAIL API
===========================================================

GET
- ADMIN / MANAGER
  -> dapat melihat akun pusat dan outlet

- OUTLET_ADMIN
  -> hanya dapat melihat akun outlet sendiri

PUT
- ADMIN / MANAGER
  -> dapat mengubah akun pusat maupun outlet

- OUTLET_ADMIN
  -> hanya dapat mengubah akun outlet sendiri

FIELD YANG BISA DIUBAH
- code
- name
- openingBalance
- outletId
- isActive

CATATAN:
- currentBalance TIDAK diubah.
- PUSAT = outletId null.
- Outlet = outletId ID outlet.

DELETE
- Tidak disediakan.
===========================================================
*/

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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
      "PETTY CASH ACCOUNT DETAIL CURRENT USER ERROR:",
      error
    );

    return null;
  }
}

function getAccountId(params: { id: string }) {
  const accountId = Number(params.id);

  if (
    !Number.isInteger(accountId) ||
    accountId <= 0
  ) {
    return null;
  }

  return accountId;
}

/*
===========================================================
GET ACCOUNT DETAIL
===========================================================
*/

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
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

    const resolvedParams = await params;

    const accountId =
      getAccountId(resolvedParams);

    if (!accountId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID akun petty cash tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    const account =
      await prisma.pettyCashAccount.findUnique({
        where: {
          id: accountId,
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

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Akun petty cash tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    /*
    ========================================================
    OUTLET ADMIN
    ========================================================
    */

    if (user.role === Role.OUTLET_ADMIN) {
      if (
        !user.outletId ||
        account.outletId !== user.outletId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda tidak memiliki akses ke akun petty cash ini.",
          },
          {
            status: 403,
          }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: account,
    });
  } catch (error) {
    console.error(
      "GET /api/petty-cash/accounts/[id] ERROR:",
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
PUT ACCOUNT
===========================================================
*/

export async function PUT(
  req: NextRequest,
  { params }: RouteContext
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
            "Anda tidak memiliki izin mengubah akun petty cash.",
        },
        {
          status: 403,
        }
      );
    }

    const resolvedParams = await params;

    const accountId =
      getAccountId(resolvedParams);

    if (!accountId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID akun petty cash tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    EXISTING ACCOUNT
    ========================================================
    */

    const existingAccount =
      await prisma.pettyCashAccount.findUnique({
        where: {
          id: accountId,
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

    if (!existingAccount) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Akun petty cash tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    /*
    ========================================================
    OUTLET ADMIN ACCESS
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
       * Tidak boleh mengedit akun milik outlet lain.
       */

      if (
        existingAccount.outletId !==
        user.outletId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda tidak memiliki akses ke akun petty cash ini.",
          },
          {
            status: 403,
          }
        );
      }
    }

    const body = await req.json();

    /*
    ========================================================
    CODE
    ========================================================
    */

    const code =
      body.code === undefined
        ? existingAccount.code
        : typeof body.code === "string"
          ? body.code.trim()
          : "";

    /*
    ========================================================
    NAME
    ========================================================
    */

    const name =
      body.name === undefined
        ? existingAccount.name
        : typeof body.name === "string"
          ? body.name.trim()
          : "";

    /*
    ========================================================
    STATUS
    ========================================================
    */

    const isActive =
      body.isActive === undefined
        ? existingAccount.isActive
        : Boolean(body.isActive);

    /*
    ========================================================
    OPENING BALANCE
    ========================================================
    */

    let openingBalance =
      Number(existingAccount.openingBalance);

    if (
      body.openingBalance !== undefined &&
      body.openingBalance !== null &&
      body.openingBalance !== ""
    ) {
      openingBalance =
        Number(body.openingBalance);
    }

    /*
    ========================================================
    OUTLET ID
    ========================================================

    undefined
      -> pertahankan lokasi lama

    null / ""
      -> PUSAT

    number
      -> outlet
    */

    let outletId:
      | number
      | null =
      existingAccount.outletId;

    if (body.outletId !== undefined) {
      if (
        body.outletId === null ||
        body.outletId === ""
      ) {
        outletId = null;
      } else {
        outletId = Number(
          body.outletId
        );

        if (
          !Number.isInteger(
            outletId
          ) ||
          outletId <= 0
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Outlet tidak valid.",
            },
            {
              status: 400,
            }
          );
        }
      }
    }

    /*
    ========================================================
    OUTLET ADMIN CANNOT MOVE ACCOUNT
    ========================================================

    OUTLET_ADMIN hanya boleh berada di outlet sendiri.

    */

    if (user.role === Role.OUTLET_ADMIN) {
      if (outletId !== user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "OUTLET_ADMIN tidak dapat memindahkan akun ke PUSAT atau outlet lain.",
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
          message:
            "Kode akun wajib diisi.",
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
          message:
            "Nama akun wajib diisi.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        openingBalance
      ) ||
      openingBalance < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Saldo awal tidak valid.",
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
            message:
              "Outlet tidak ditemukan.",
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
            message:
              "Outlet tersebut tidak aktif.",
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

    const duplicateCode =
      await prisma.pettyCashAccount.findFirst({
        where: {
          code,

          NOT: {
            id: accountId,
          },
        },

        select: {
          id: true,
          code: true,
          name: true,
        },
      });

    if (duplicateCode) {
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
    CEK TRANSAKSI SAAT PINDAH LOKASI
    ========================================================

    Jangan sembarangan memindahkan akun yang sudah memiliki
    transaksi karena transaksi lama akan tetap mengarah ke
    akun tersebut.

    Untuk menjaga histori tetap konsisten, ADMIN/MANAGER
    hanya boleh mengubah lokasi akun yang belum memiliki
    transaksi.

    */

    const locationChanged =
      existingAccount.outletId !==
      outletId;

    if (locationChanged) {
      const transactionCount =
        await prisma.pettyCash.count({
          where: {
            accountId,
          },
        });

      if (transactionCount > 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Lokasi akun tidak dapat dipindahkan karena akun sudah memiliki transaksi petty cash.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
    ========================================================
    UPDATE
    ========================================================

    currentBalance SENGAJA TIDAK DIUBAH.

    */

    const account =
      await prisma.pettyCashAccount.update({
        where: {
          id: accountId,
        },

        data: {
          code,
          name,
          openingBalance,
          outletId,
          isActive,
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

    return NextResponse.json({
      success: true,
      message:
        "Akun petty cash berhasil diperbarui.",
      data: account,
    });
  } catch (error: any) {
    console.error(
      "PUT /api/petty-cash/accounts/[id] ERROR:",
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
          "Gagal memperbarui akun petty cash.",
      },
      {
        status: 500,
      }
    );
  }
}