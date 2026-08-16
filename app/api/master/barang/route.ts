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
    console.error("GET CURRENT USER ERROR:", error);
    return null;
  }
}

/*
 * =========================================================
 * GET - MASTER BARANG
 * =========================================================
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const search =
      searchParams.get("search")?.trim() || "";

    const category =
      searchParams.get("category")?.trim() || "";

    const source =
      searchParams.get("source")?.trim() || "CENTRAL";

    /*
     * =====================================================
     * CURRENT USER
     * =====================================================
     */

    const user = await getCurrentUser();

    /*
     * =====================================================
     * OUTLET ID
     *
     * Prioritas:
     * 1. outletId dari query jika user pusat
     * 2. outletId dari session user outlet
     * =====================================================
     */

    const queryOutletId = Number(
      searchParams.get("outletId") || 0
    );

    let outletId: number | null = null;

    /*
     * ADMIN / MANAGER / GUDANG / PURCHASING
     * dapat melihat outlet yang dipilih.
     *
     * OUTLET_ADMIN hanya boleh melihat outlet miliknya.
     */

    if (user?.role === "OUTLET_ADMIN") {
      outletId = user.outletId ?? null;
    } else if (queryOutletId > 0) {
      outletId = queryOutletId;
    }

    /*
     * =====================================================
     * WHERE BARANG
     * =====================================================
     */

    const where: any = {};

    /*
     * =====================================================
     * CENTRAL
     *
     * Barang pusat = Barang.source CENTRAL
     * =====================================================
     */

    if (source === "CENTRAL") {
      where.source = "CENTRAL";
    }

    /*
     * =====================================================
     * OUTLET
     *
     * PENTING:
     *
     * Barang outlet tidak harus memiliki
     * Barang.source = OUTLET.
     *
     * Barang outlet menggunakan Barang pusat
     * yang mempunyai relasi OutletBarang / OutletStock.
     * =====================================================
     */

    if (source === "OUTLET") {
      /*
       * Jika outletId diketahui, tampilkan barang
       * yang memang terdaftar di outlet tersebut.
       */

      if (outletId) {
        where.OR = [
          {
            outletBarang: {
              some: {
                outletId,
                aktif: true,
              },
            },
          },
          {
            outletStocks: {
              some: {
                outletId,
              },
            },
          },
        ];
      } else {
        /*
         * Untuk admin pusat tanpa outlet tertentu,
         * tampilkan seluruh barang yang pernah
         * digunakan/terdaftar di outlet.
         */

        where.OR = [
          {
            outletBarang: {
              some: {
                aktif: true,
              },
            },
          },
          {
            outletStocks: {
              some: {},
            },
          },
        ];
      }
    }

    /*
     * =====================================================
     * ALL
     *
     * Tidak perlu filter source.
     * =====================================================
     */

    /*
     * =====================================================
     * SEARCH
     * =====================================================
     */

    if (search) {
      const searchConditions = [
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

      /*
       * Jika sebelumnya sudah ada OR untuk outlet,
       * gunakan AND supaya filter outlet + search
       * berjalan bersamaan.
       */

      if (source === "OUTLET") {
        const outletConditions = where.OR;

        delete where.OR;

        where.AND = [
          {
            OR: outletConditions,
          },
          {
            OR: searchConditions,
          },
        ];
      } else {
        where.OR = searchConditions;
      }
    }

    /*
     * =====================================================
     * CATEGORY
     * =====================================================
     */

    if (category) {
      where.category = category;
    }

    /*
     * =====================================================
     * GET DATA
     * =====================================================
     */

    const data = await prisma.barang.findMany({
      where,

      include: {
        /*
         * =================================================
         * PRICE SUMMARY
         * =================================================
         */

        priceSummary: true,

        /*
         * =================================================
         * BATCH STOCK
         * =================================================
         */

        batchStocks: {
          where: {
            qty: {
              gt: 0,
            },
          },

          orderBy: {
            expiredDate: "asc",
          },
        },

        /*
         * =================================================
         * PURCHASE TERAKHIR
         * =================================================
         */

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

        /*
         * =================================================
         * SUMBER BARANG
         * =================================================
         */

        sourceOutlet: true,

        /*
         * =================================================
         * OUTLET BARANG
         * =================================================
         */

        outletBarang: {
          where: outletId
            ? {
                outletId,
              }
            : undefined,

          include: {
            outlet: true,
          },
        },

        /*
         * =================================================
         * OUTLET STOCK
         * =================================================
         */

        outletStocks: {
          where: outletId
            ? {
                outletId,
              }
            : undefined,

          include: {
            outlet: true,
          },
        },
      },

      orderBy: {
        id: "desc",
      },
    });

    /*
     * =====================================================
     * FORMAT DATA
     * =====================================================
     */

    const result = data.map((item) => {
      const lastPurchaseItem =
        item.purchaseItems?.[0];

      const supplier =
        lastPurchaseItem?.purchase?.supplier;

      /*
       * ===================================================
       * OUTLET BARANG
       * ===================================================
       */

      const outletBarang =
        item.outletBarang?.[0] ?? null;

      /*
       * ===================================================
       * OUTLET STOCK
       * ===================================================
       */

      const outletStock =
        item.outletStocks?.[0] ?? null;

      /*
       * ===================================================
       * STOCK YANG DITAMPILKAN
       *
       * Untuk outlet:
       * gunakan OutletStock.stock
       *
       * Untuk pusat:
       * gunakan Barang.stock
       * ===================================================
       */

      const displayStock =
        source === "OUTLET"
          ? outletStock?.stock ?? 0
          : item.stock;

      /*
       * ===================================================
       * MINIMUM STOCK
       * ===================================================
       */

      const displayMinimumStock =
        source === "OUTLET"
          ? outletStock?.minimumStock ??
            outletBarang?.harga !== undefined
              ? item.minimumStock
              : item.minimumStock
          : item.minimumStock;

      /*
       * ===================================================
       * AVERAGE COST
       * ===================================================
       */

      const averageCost =
        source === "OUTLET"
          ? outletStock?.averageCost ??
            item.priceSummary?.averagePrice ??
            0
          : item.priceSummary?.averagePrice ??
            item.purchasePrice ??
            0;

      /*
       * ===================================================
       * OUTLET
       * ===================================================
       */

      let outlet = null;

      if (outletStock?.outlet) {
        outlet = {
          id: outletStock.outlet.id,
          code: outletStock.outlet.code,
          name: outletStock.outlet.name,
        };
      } else if (outletBarang?.outlet) {
        outlet = {
          id: outletBarang.outlet.id,
          code: outletBarang.outlet.code,
          name: outletBarang.outlet.name,
        };
      } else if (item.sourceOutlet) {
        outlet = {
          id: item.sourceOutlet.id,
          code: item.sourceOutlet.code,
          name: item.sourceOutlet.name,
        };
      }

      /*
       * ===================================================
       * STATUS STOCK
       * ===================================================
       */

      let stockStatus = "AMAN";

      if (displayStock <= 0) {
        stockStatus = "HABIS";
      } else if (
        displayStock <= displayMinimumStock
      ) {
        stockStatus = "MENIPIS";
      }

      /*
       * ===================================================
       * RETURN
       * ===================================================
       */

      return {
        ...item,

        /*
         * STOCK UTAMA
         */

        stock: displayStock,

        /*
         * STOCK ASLI PUSAT
         */

        centralStock: item.stock,

        /*
         * MINIMUM STOCK
         */

        minimumStock: displayMinimumStock,

        /*
         * COST
         */

        averageCost,

        /*
         * OUTLET STOCK
         */

        outletStock: outletStock
          ? {
              id: outletStock.id,
              outletId: outletStock.outletId,
              stock: outletStock.stock,
              minimumStock:
                outletStock.minimumStock,
              averageCost:
                outletStock.averageCost,
              updatedAt:
                outletStock.updatedAt,
            }
          : null,

        /*
         * OUTLET BARANG
         */

        outletBarang: outletBarang
          ? {
              id: outletBarang.id,
              outletId: outletBarang.outletId,
              harga: outletBarang.harga,
              aktif: outletBarang.aktif,
              createdAt:
                outletBarang.createdAt,
              updatedAt:
                outletBarang.updatedAt,
            }
          : null,

        /*
         * SUPPLIER TERAKHIR
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
         */

        outlet,

        /*
         * STATUS
         */

        stockStatus,

        /*
         * HILANGKAN RELASI RAW
         */

        purchaseItems: undefined,
        sourceOutlet: undefined,
      };
    });

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        source,
        outletId,
        total: result.length,
      },
    });
  } catch (error) {
    console.error(
      "GET MASTER BARANG ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil data master barang",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * =========================================================
 * POST - CREATE BARANG PUSAT
 * =========================================================
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();

    /*
     * =====================================================
     * NORMALISASI
     * =====================================================
     */

    const code =
      String(body.code || "").trim();

    const name =
      String(body.name || "").trim();

    const unit =
      String(body.unit || "").trim();

    const category =
      String(body.category || "").trim();

    const brand =
      String(body.brand || "").trim();

    const barcodeInput =
      String(body.barcode || "").trim();

    /*
     * =====================================================
     * VALIDASI
     * =====================================================
     */

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kode barang wajib diisi",
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
            "Nama barang wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    if (!unit) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Satuan wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * CEK KODE
     * =====================================================
     */

    const cekKode =
      await prisma.barang.findUnique({
        where: {
          code,
        },
      });

    if (cekKode) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kode barang sudah digunakan",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * BARCODE
     * =====================================================
     */

    const barcode =
      barcodeInput ||
      `MGB-${code}`;

    /*
     * =====================================================
     * CEK BARCODE
     * =====================================================
     */

    const cekBarcode =
      await prisma.barang.findFirst({
        where: {
          barcode,
        },
      });

    if (cekBarcode) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barcode sudah digunakan",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * CREATE BARANG
     *
     * SELALU CENTRAL
     * =====================================================
     */

    const barang =
      await prisma.barang.create({
        data: {
          code,
          barcode,
          name,

          category:
            category || null,

          brand:
            brand || null,

          unit,

          minimumStock: Number(
            body.minimumStock || 0
          ),

          stock: 0,

          purchasePrice: Number(
            body.purchasePrice || 0
          ),

          sellingPrice: Number(
            body.sellingPrice || 0
          ),

          hasExpired: Boolean(
            body.hasExpired
          ),

          active: true,

          expiredWarning: 30,

          source: "CENTRAL",

          sourceOutletId: null,
        },
      });

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      message:
        "Master barang pusat berhasil ditambahkan",

      data: barang,
    });
  } catch (err: any) {
    console.error(
      "POST MASTER BARANG ERROR:",
      err
    );

    return NextResponse.json(
      {
        success: false,
        message:
          err?.message ||
          "Gagal membuat master barang pusat",
      },
      {
        status: 500,
      }
    );
  }
}