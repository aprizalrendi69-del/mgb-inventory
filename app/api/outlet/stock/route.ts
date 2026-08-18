import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * GET STOCK OUTLET
 * =========================================================
 *
 * ROLE:
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
 * -> hanya bisa melihat outlet miliknya
 * -> outletId dari URL DIABAIKAN
 *
 * =========================================================
 * SUMBER DATA
 * =========================================================
 *
 * STOCK SISTEM:
 * -> OutletStock.stock
 *
 * STOCK OPNAME:
 * -> hanya informasi / audit
 *
 * Endpoint ini READ ONLY.
 *
 * TIDAK ADA:
 * -> update OutletStock
 * -> adjustment stock
 * -> perubahan stock karena SO
 *
 * =========================================================
 * RESPONSE PER STOCK
 * =========================================================
 *
 * {
 *   ...stock,
 *
 *   lastOpname: {
 *      opnameId,
 *      code,
 *      date,
 *      status,
 *      systemQty,
 *      physicalQty,
 *      difference,
 *      note
 *   },
 *
 *   opnameHistory: [
 *      {
 *        opnameId,
 *        code,
 *        date,
 *        status,
 *        systemQty,
 *        physicalQty,
 *        difference,
 *        note
 *      }
 *   ]
 * }
 *
 * Dengan demikian halaman Stock Outlet cukup memakai
 * SATU API ini untuk:
 *
 * -> Stock Sistem
 * -> SO Terakhir
 * -> Fisik
 * -> Selisih
 * -> Status SO
 * -> History SO
 *
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

    if (!Number.isInteger(userId) || userId <= 0) {
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
    // 4. USER AKTIF
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
    // 5. ROLE ACCESS
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

    const { searchParams } = new URL(req.url);

    const outletIdParam =
      searchParams.get("outletId");

    let outletId: number | null = null;

    // =====================================================
    // 7. OUTLET ADMIN
    //
    // WAJIB menggunakan outletId dari session.
    //
    // outletId dari URL diabaikan.
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
    // Tanpa outletId:
    // -> semua outlet
    //
    // Dengan outletId:
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
    // 9. VALIDASI OUTLET
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
            message: "Outlet tidak ditemukan",
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
            message: "Outlet sedang tidak aktif",
          },
          {
            status: 400,
          }
        );
      }
    }

    // =====================================================
    // 10. WHERE STOCK
    // =====================================================

    const stockWhere: {
      outletId?: number;
    } = {};

    if (outletId !== null) {
      stockWhere.outletId = outletId;
    }

    // =====================================================
    // 11. AMBIL OUTLET STOCK
    //
    // STOCK SISTEM HANYA DARI:
    //
    // OutletStock.stock
    //
    // TIDAK menggunakan:
    //
    // Barang.stock
    // =====================================================

    const stocks =
      await prisma.outletStock.findMany({
        where: stockWhere,

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
              barcode: true,

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
    // 12. AMBIL SEMUA STOCK OPNAME YANG RELEVAN
    //
    // Kita ambil history lengkap.
    //
    // Urutan:
    // terbaru -> terlama
    //
    // Ini membuat item pertama yang ditemukan
    // menjadi SO terakhir untuk barang tersebut.
    // =====================================================

    const opnameWhere: {
      outletId?: number;
    } = {};

    if (outletId !== null) {
      opnameWhere.outletId = outletId;
    }

    const opnameList =
      await prisma.stockOpname.findMany({
        where: opnameWhere,

        orderBy: [
          {
            date: "desc",
          },
          {
            id: "desc",
          },
        ],

        select: {
          id: true,
          code: true,
          outletId: true,
          date: true,
          status: true,
          createdAt: true,
          approvedBy: true,

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          items: {
            select: {
              id: true,
              barangId: true,
              systemQty: true,
              physicalQty: true,
              difference: true,
              note: true,

              barang: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  unit: true,
                },
              },
            },
          },
        },
      });

    // =====================================================
    // 13. MAP HISTORY PER OUTLET + BARANG
    //
    // Struktur:
    //
    // outletId-barangId
    //
    // -> semua history SO barang tersebut
    // =====================================================

    type OpnameHistoryItem = {
      opnameId: number;
      code: string;
      outletId: number;
      date: Date;
      status: string;
      createdAt: Date;
      approvedBy: number | null;

      systemQty: number;
      physicalQty: number;
      difference: number;
      note: string | null;

      barang: {
        id: number;
        code: string;
        name: string;
        unit: string;
      } | null;
    };

    const opnameHistoryByBarang =
      new Map<
        string,
        OpnameHistoryItem[]
      >();

    // =====================================================
    // 14. BANGUN HISTORY
    // =====================================================

    for (const opname of opnameList) {
      for (const item of opname.items) {
        const key =
          `${opname.outletId}-${item.barangId}`;

        const history =
          opnameHistoryByBarang.get(key) || [];

        history.push({
          opnameId: opname.id,
          code: opname.code,
          outletId: opname.outletId,
          date: opname.date,
          status: opname.status,
          createdAt: opname.createdAt,
          approvedBy:
            opname.approvedBy ?? null,

          systemQty: Number(
            item.systemQty ?? 0
          ),

          physicalQty: Number(
            item.physicalQty ?? 0
          ),

          difference: Number(
            item.difference ?? 0
          ),

          note: item.note ?? null,

          barang: item.barang
            ? {
                id: item.barang.id,
                code: item.barang.code,
                name: item.barang.name,
                unit: item.barang.unit,
              }
            : null,
        });

        opnameHistoryByBarang.set(
          key,
          history
        );
      }
    }

    // =====================================================
    // 15. GABUNGKAN STOCK + LAST OPNAME + HISTORY
    // =====================================================

    const data = stocks.map(
      (stock) => {
        const key =
          `${stock.outletId}-${stock.barangId}`;

        const opnameHistory =
          opnameHistoryByBarang.get(key) || [];

        /*
         * Karena opnameList sudah diurutkan
         * terbaru -> terlama,
         *
         * history[0] = SO terakhir.
         */

        const lastOpname =
          opnameHistory.length > 0
            ? opnameHistory[0]
            : null;

        return {
          ...stock,

          // =================================================
          // NORMALISASI NUMBER
          // =================================================

          stock: Number(
            stock.stock ?? 0
          ),

          minimumStock: Number(
            stock.minimumStock ?? 0
          ),

          averageCost: Number(
            stock.averageCost ?? 0
          ),

          // =================================================
          // SO TERAKHIR
          // =================================================

          lastOpname,

          // =================================================
          // HISTORY SO LENGKAP
          // =================================================

          opnameHistory,
        };
      }
    );

    // =====================================================
    // 16. SUMMARY
    // =====================================================

    const totalStockQty =
      data.reduce(
        (total, item) =>
          total +
          Number(item.stock || 0),
        0
      );

    const itemsWithOpname =
      data.filter(
        (item) =>
          item.lastOpname !== null
      ).length;

    const itemsWithoutOpname =
      data.length -
      itemsWithOpname;

    const approvedOpnameCount =
      opnameList.filter(
        (item) =>
          String(
            item.status
          ).toUpperCase() === "APPROVED"
      ).length;

    const pendingOpnameCount =
      opnameList.filter(
        (item) =>
          [
            "COUNTING",
            "PENDING",
            "WAITING",
          ].includes(
            String(
              item.status
            ).toUpperCase()
          )
      ).length;

    // =====================================================
    // 17. RESPONSE
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

      /*
       * ===================================================
       * DATA UTAMA
       * ===================================================
       *
       * stock:
       * -> OutletStock.stock
       *
       * lastOpname:
       * -> SO terakhir barang
       *
       * opnameHistory:
       * -> seluruh history SO barang
       */

      data,

      // ===================================================
      // META
      // ===================================================

      meta: {
        totalStockItems: data.length,

        totalStockQty,

        itemsWithOpname,

        itemsWithoutOpname,

        opnameLoaded: opnameList.length,

        approvedOpnameCount,

        pendingOpnameCount,

        stockSource:
          "OutletStock.stock",

        stockLocked: true,

        opnameIsInformational: true,

        adjustmentRequiresApproval: true,
      },
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