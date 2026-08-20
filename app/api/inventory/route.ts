import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * CURRENT USER
 * =========================================================
 */

async function getCurrentUser() {
  try {
    const cookieStore = await cookies();

    const session = cookieStore.get("erp-session");

    if (!session) {
      return null;
    }

    let sessionData: any;

    try {
      sessionData = JSON.parse(session.value);
    } catch {
      return null;
    }

    if (!sessionData?.id) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: Number(sessionData.id),
      },
      include: {
        outlet: true,
      },
    });

    return user;
  } catch (error) {
    console.error(
      "GET CURRENT USER ERROR:",
      error
    );

    return null;
  }
}

/*
 * =========================================================
 * GET INVENTORY
 *
 * SOURCE:
 *
 * CENTRAL
 * -> Inventory
 * -> Barang.stock
 *
 * OUTLET
 * -> OutletStock
 *
 * PENTING:
 *
 * Barang.stock TIDAK PERNAH digunakan sebagai
 * stock outlet.
 * =========================================================
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    /*
     * =====================================================
     * PARAMETER
     * =====================================================
     */

    const search =
      searchParams.get("search")?.trim() || "";

    const category =
      searchParams.get("category")?.trim() || "";

    const source =
      (
        searchParams.get("source") ||
        "CENTRAL"
      ).toUpperCase();

    const queryOutletId = Number(
      searchParams.get("outletId") || 0
    );

    /*
     * =====================================================
     * VALIDASI SOURCE
     * =====================================================
     */

    if (
      source !== "CENTRAL" &&
      source !== "OUTLET"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Source inventory tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * CURRENT USER
     * =====================================================
     */

    const user = await getCurrentUser();

    /*
     * =====================================================
     * TENTUKAN OUTLET
     *
     * OUTLET_ADMIN
     * -> selalu outlet miliknya
     *
     * ADMIN / MANAGER / GUDANG / PURCHASING
     * -> bisa memilih outlet
     * =====================================================
     */

    let outletId: number | null = null;

    if (user?.role === "OUTLET_ADMIN") {
      outletId = user.outletId ?? null;
    } else if (queryOutletId > 0) {
      outletId = queryOutletId;
    }

    /*
     * =====================================================
     * VALIDASI OUTLET UNTUK SOURCE OUTLET
     * =====================================================
     */

    if (
      source === "OUTLET" &&
      user?.role === "OUTLET_ADMIN" &&
      !outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User outlet belum memiliki outlet",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * SOURCE CENTRAL
     *
     * HANYA AMBIL INVENTORY PUSAT
     * =====================================================
     */

    if (source === "CENTRAL") {
      const barangWhere: any = {
        source: "CENTRAL",
      };

      /*
       * SEARCH
       */

      if (search) {
        barangWhere.OR = [
          {
            code: {
              contains: search,
            },
          },
          {
            name: {
              contains: search,
            },
          },
          {
            barcode: {
              contains: search,
            },
          },
        ];
      }

      /*
       * CATEGORY
       */

      if (category) {
        barangWhere.category = category;
      }

      /*
       * ===================================================
       * GET BARANG CENTRAL
       * ===================================================
       */

      const barang =
        await prisma.barang.findMany({
          where: barangWhere,

          include: {
            inventory: true,

            priceSummary: true,

            purchaseItems: {
              orderBy: {
                purchase: {
                  purchaseDate: "desc",
                },
              },

              take: 1,

              include: {
                purchase: {
                  include: {
                    supplier: true,
                  },
                },
              },
            },
          },

          orderBy: {
            name: "asc",
          },
        });

      /*
       * ===================================================
       * FORMAT CENTRAL
       * ===================================================
       */

      const data = barang.map((item) => {
        const inventory =
          item.inventory;

        const stock =
          Number(
            inventory?.stock ??
              item.stock ??
              0
          );

        const availableStock =
          Number(
            inventory?.availableStock ??
              stock
          );

        const reservedStock =
          Number(
            inventory?.reservedStock ?? 0
          );

        const minimumStock =
          Number(
            inventory?.minimumStock ??
              item.minimumStock ??
              0
          );

        const maximumStock =
          Number(
            inventory?.maximumStock ?? 0
          );

        const averageCost =
          Number(
            inventory?.averageCost ??
              item.priceSummary
                ?.averagePrice ??
              item.purchasePrice ??
              0
          );

        const lastPurchase =
          Number(
            inventory?.lastPurchase ??
              item.purchasePrice ??
              0
          );

        /*
         * STOCK STATUS
         */

        let stockStatus =
          "AMAN";

        if (stock <= 0) {
          stockStatus = "HABIS";
        } else if (
          stock <= minimumStock
        ) {
          stockStatus = "MENIPIS";
        }

        /*
         * SUPPLIER TERAKHIR
         */

        const lastPurchaseItem =
          item.purchaseItems?.[0];

        const supplier =
          lastPurchaseItem
            ?.purchase
            ?.supplier;

        return {
          id: item.id,

          code: item.code,

          barcode: item.barcode,

          name: item.name,

          category: item.category,

          brand: item.brand,

          unit: item.unit,

          /*
           * SOURCE
           */

          source: "CENTRAL",

          /*
           * STOCK
           */

          stock,

          centralStock: stock,

          availableStock,

          reservedStock,

          /*
           * MIN / MAX
           */

          minimumStock,

          maximumStock,

          /*
           * COST
           */

          averageCost,

          lastPurchase,

          purchasePrice:
            item.purchasePrice,

          sellingPrice:
            item.sellingPrice,

          /*
           * WAREHOUSE
           */

          warehouse:
            inventory?.warehouse ??
            "MAIN",

          /*
           * STATUS
           */

          stockStatus,

          /*
           * ACTIVE
           */

          active: item.active,

          /*
           * SUPPLIER
           */

          supplier: supplier
            ? {
                id: supplier.id,
                code: supplier.code,
                name: supplier.name,
              }
            : null,

          /*
           * OUTLET
           *
           * CENTRAL tidak mempunyai
           * outlet stock.
           */

          outlet: null,

          outletId: null,

          /*
           * TIMESTAMP
           */

          createdAt:
            item.createdAt,

          updatedAt:
            inventory?.updatedAt ??
            item.updatedAt,
        };
      });

      /*
       * ===================================================
       * RESPONSE CENTRAL
       * ===================================================
       */

      return NextResponse.json({
        success: true,

        source: "CENTRAL",

        outletId: null,

        total: data.length,

        data,
      });
    }

    /*
     * =====================================================
     * SOURCE OUTLET
     *
     * HANYA AMBIL OutletStock
     * =====================================================
     */

    const outletStockWhere: any = {};

    /*
     * OUTLET ADMIN
     *
     * WAJIB outlet sendiri.
     */

    if (user?.role === "OUTLET_ADMIN") {
      outletStockWhere.outletId =
        user.outletId;
    }

    /*
     * ADMIN / MANAGER / GUDANG / PURCHASING
     *
     * Jika outlet dipilih,
     * filter outlet tersebut.
     */

    else if (outletId) {
      outletStockWhere.outletId =
        outletId;
    }

    /*
     * ===================================================
     * BARANG FILTER
     * ===================================================
     */

    const barangWhere: any = {};

    if (search) {
      barangWhere.OR = [
        {
          code: {
            contains: search,
          },
        },
        {
          name: {
            contains: search,
          },
        },
        {
          barcode: {
            contains: search,
          },
        },
      ];
    }

    if (category) {
      barangWhere.category = category;
    }

    /*
     * ===================================================
     * GET OUTLET STOCK
     * ===================================================
     */

    const outletStocks =
      await prisma.outletStock.findMany({
        where: {
          ...outletStockWhere,

          barang: barangWhere,
        },

        include: {
          outlet: true,

          barang: {
            include: {
              priceSummary: true,

              outletBarang: true,
            },
          },
        },

        orderBy: {
          barang: {
            name: "asc",
          },
        },
      });

    /*
     * ===================================================
     * FORMAT OUTLET
     * ===================================================
     */

    const data = outletStocks.map(
      (outletStock) => {
        const barang =
          outletStock.barang;

        const stock =
          Number(
            outletStock.stock ?? 0
          );

        const minimumStock =
          Number(
            outletStock.minimumStock ?? 0
          );

        const averageCost =
          Number(
            outletStock.averageCost ??
              barang.priceSummary
                ?.averagePrice ??
              barang.purchasePrice ??
              0
          );

        /*
         * =================================================
         * STOCK STATUS
         * =================================================
         */

        let stockStatus =
          "AMAN";

        if (stock <= 0) {
          stockStatus = "HABIS";
        } else if (
          stock <= minimumStock
        ) {
          stockStatus = "MENIPIS";
        }

        /*
         * =================================================
         * OUTLET BARANG
         * =================================================
         */

        const outletBarang =
          barang.outletBarang.find(
            (item) =>
              item.outletId ===
              outletStock.outletId
          ) ?? null;

        /*
         * =================================================
         * RETURN
         * =================================================
         */

        return {
          id: barang.id,

          code: barang.code,

          barcode:
            barang.barcode,

          name: barang.name,

          category:
            barang.category,

          brand:
            barang.brand,

          unit:
            barang.unit,

          /*
           * SOURCE
           */

          source: "OUTLET",

          /*
           * STOCK UTAMA
           *
           * PENTING:
           * ini OutletStock.stock
           */

          stock,

          /*
           * STOCK PUSAT
           *
           * Tidak digunakan sebagai
           * stock outlet.
           */

          centralStock:
            Number(
              barang.stock ?? 0
            ),

          /*
           * OUTLET STOCK
           */

          availableStock:
            stock,

          reservedStock: 0,

          /*
           * MINIMUM STOCK
           */

          minimumStock,

          maximumStock: 0,

          /*
           * COST
           */

          averageCost,

          lastPurchase:
            averageCost,

          purchasePrice:
            barang.purchasePrice,

          sellingPrice:
            barang.sellingPrice,

          /*
           * WAREHOUSE
           */

          warehouse:
            `OUTLET-${outletStock.outlet.code}`,

          /*
           * OUTLET
           */

          outlet: {
            id:
              outletStock.outlet.id,

            code:
              outletStock.outlet.code,

            name:
              outletStock.outlet.name,
          },

          outletId:
            outletStock.outletId,

          /*
           * OUTLET BARANG
           */

          outletBarang:
            outletBarang
              ? {
                  id:
                    outletBarang.id,

                  outletId:
                    outletBarang.outletId,

                  harga:
                    outletBarang.harga,

                  aktif:
                    outletBarang.aktif,

                  createdAt:
                    outletBarang.createdAt,

                  updatedAt:
                    outletBarang.updatedAt,
                }
              : null,

          /*
           * STATUS
           */

          stockStatus,

          /*
           * ACTIVE
           */

          active:
            barang.active,

          /*
           * TIMESTAMP
           */

          createdAt:
            barang.createdAt,

          updatedAt:
            outletStock.updatedAt,
        };
      }
    );

    /*
     * =====================================================
     * RESPONSE OUTLET
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      source: "OUTLET",

      outletId,

      total: data.length,

      data,
    });
  } catch (error) {
    console.error(
      "INVENTORY API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        source: null,

        outletId: null,

        total: 0,

        data: [],

        message:
          "Gagal mengambil data inventory",
      },
      {
        status: 500,
      }
    );
  }
}