import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * GET STOCK OUTLET
 *
 * ADMIN
 * -> bisa melihat semua outlet
 * -> bisa filter outletId
 *
 * MANAGER
 * -> bisa melihat semua outlet
 * -> bisa filter outletId
 *
 * OUTLET_ADMIN
 * -> HANYA outlet miliknya
 *
 * PENTING:
 * -> stock diambil dari OutletStock
 * -> TIDAK mengambil Barang.stock
 * =========================================================
 */

export async function GET(req: NextRequest) {
  try {
    // =====================================================
    // 1. SESSION
    // =====================================================

    const cookieStore = await cookies();
    const session = cookieStore.get("erp-session");

    if (!session) {
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

    // =====================================================
    // 2. PARSE SESSION
    // =====================================================

    let sessionData: any;

    try {
      sessionData = JSON.parse(session.value);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    const userId = Number(sessionData?.id);

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    // =====================================================
    // 3. USER LOGIN
    // =====================================================

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

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =====================================================
    // 4. USER HARUS AKTIF
    // =====================================================

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

    // =====================================================
    // 5. ROLE
    // =====================================================

    const allowedRoles = [
      "ADMIN",
      "MANAGER",
      "OUTLET_ADMIN",
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses stock outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // 6. QUERY PARAMETER
    // =====================================================

    const { searchParams } =
      new URL(req.url);

    const outletIdParam =
      searchParams.get("outletId");

    let outletId: number | null = null;

    // =====================================================
    // 7. OUTLET ADMIN
    //
    // OUTLET_ADMIN TIDAK BOLEH MENGGUNAKAN
    // outletId DARI URL.
    //
    // Contoh:
    //
    // /api/outlet-stock?outletId=1
    //
    // Jika user sebenarnya outlet 2,
    // tetap akan menggunakan outlet 2.
    // =====================================================

    if (user.role === "OUTLET_ADMIN") {
      if (
        !user.outletId ||
        !Number.isInteger(user.outletId) ||
        user.outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum terhubung dengan outlet",
          },
          {
            status: 400,
          }
        );
      }

      outletId = user.outletId;
    }

    // =====================================================
    // 8. ADMIN / MANAGER
    //
    // Bisa:
    //
    // /api/outlet-stock
    //
    // -> semua outlet
    //
    // atau:
    //
    // /api/outlet-stock?outletId=2
    //
    // -> outlet tertentu
    // =====================================================

    else if (
      user.role === "ADMIN" ||
      user.role === "MANAGER"
    ) {
      if (outletIdParam !== null) {
        const parsedOutletId =
          Number(outletIdParam);

        if (
          !Number.isInteger(parsedOutletId) ||
          parsedOutletId <= 0
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Outlet ID tidak valid",
            },
            {
              status: 400,
            }
          );
        }

        outletId = parsedOutletId;
      }
    }

    // =====================================================
    // 9. VALIDASI OUTLET SCOPE
    //
    // Jika outletId sudah ditentukan,
    // pastikan outlet benar-benar ada dan aktif.
    // =====================================================

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
              "Outlet tidak ditemukan",
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
              "Outlet sedang tidak aktif",
          },
          {
            status: 400,
          }
        );
      }
    }

    // =====================================================
    // 10. WHERE
    // =====================================================

    const where: {
      outletId?: number;
    } = {};

    if (outletId !== null) {
      where.outletId = outletId;
    }

    // =====================================================
    // 11. AMBIL STOCK OUTLET
    //
    // PENTING:
    //
    // stock = OutletStock.stock
    //
    // BUKAN:
    //
    // Barang.stock
    //
    // Dengan begitu stock outlet tidak akan bercampur
    // dengan stock pusat.
    // =====================================================

    const stocks =
      await prisma.outletStock.findMany({
        where,

        select: {
          id: true,
          outletId: true,
          barangId: true,
          stock: true,
          minimumStock: true,
          averageCost: true,

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          barang: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,

              /*
               * Data harga master pusat hanya untuk
               * informasi/reference.
               *
               * Tidak pernah diubah dari endpoint ini.
               */
              purchasePrice: true,
              sellingPrice: true,
              minimumStock: true,
            },
          },
        },

        orderBy: [
          {
            outlet: {
              name: "asc",
            },
          },
          {
            barang: {
              name: "asc",
            },
          },
        ],
      });

    // =====================================================
    // 12. RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      scope: {
        role: user.role,
        outletId,
      },

      user: {
        id: user.id,
        fullname: user.fullname,
        role: user.role,
        outletId: user.outletId,
      },

      data: stocks,
    });
  } catch (error: any) {
    console.error(
      "GET OUTLET STOCK ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil stock outlet",
      },
      {
        status: 500,
      }
    );
  }
}