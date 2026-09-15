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
     * =====================================================
     */

    if (source === "CENTRAL") {
      where.source = "CENTRAL";
    }

    /*
     * =====================================================
     * OUTLET
     * =====================================================
     *
     * Barang outlet menggunakan Barang pusat
     * yang mempunyai relasi OutletBarang / OutletStock.
     */

    if (source === "OUTLET") {
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
            item.minimumStock
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
       * HARGA BELI TERAKHIR
       * ===================================================
       */

      const lastPurchasePrice =
        Number(
          item.priceSummary?.lastPrice ??
            item.purchasePrice ??
            0
        );

      /*
       * ===================================================
       * PRICE SUMMARY
       * ===================================================
       */

      const priceSummary =
        item.priceSummary
          ? {
              id: item.priceSummary.id,

              barangId:
                item.priceSummary.barangId,

              supplierId:
                item.priceSummary.supplierId,

              lastPrice:
                item.priceSummary.lastPrice,

              averagePrice:
                item.priceSummary.averagePrice,

              highestPrice:
                item.priceSummary.highestPrice,

              lowestPrice:
                item.priceSummary.lowestPrice,

              totalPurchase:
                item.priceSummary.totalPurchase,

              lastReceiveDate:
                item.priceSummary.lastReceiveDate,
            }
          : null;

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
        /*
         * =================================================
         * DATA MASTER ASLI
         * =================================================
         *
         * Termasuk:
         *
         * active
         *
         * sehingga frontend bisa mengetahui apakah
         * barang masih aktif atau sudah nonaktif.
         */

        ...item,

        /*
         * Pastikan active selalu tersedia secara eksplisit.
         */

        active: item.active,

        /*
         * =================================================
         * HARGA
         * =================================================
         */

        purchasePrice:
          item.purchasePrice ?? 0,

        sellingPrice:
          item.sellingPrice ?? 0,

        /*
         * =================================================
         * HARGA BELI TERAKHIR
         * =================================================
         */

        lastPurchasePrice,

        /*
         * =================================================
         * PRICE SUMMARY
         * =================================================
         */

        priceSummary,

        /*
         * =================================================
         * STOCK UTAMA
         * =================================================
         */

        stock: displayStock,

        /*
         * =================================================
         * STOCK ASLI PUSAT
         * =================================================
         */

        centralStock: item.stock,

        /*
         * =================================================
         * MINIMUM STOCK
         * =================================================
         */

        minimumStock:
          displayMinimumStock,

        /*
         * =================================================
         * COST
         * =================================================
         */

        averageCost,

        /*
         * =================================================
         * OUTLET STOCK
         * =================================================
         */

        outletStock: outletStock
          ? {
              id: outletStock.id,

              outletId:
                outletStock.outletId,

              stock:
                outletStock.stock,

              minimumStock:
                outletStock.minimumStock,

              averageCost:
                outletStock.averageCost,

              updatedAt:
                outletStock.updatedAt,
            }
          : null,

        /*
         * =================================================
         * OUTLET BARANG
         * =================================================
         */

        outletBarang: outletBarang
          ? {
              id: outletBarang.id,

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
         * =================================================
         * SUPPLIER TERAKHIR
         * =================================================
         */

        supplier: supplier
          ? {
              id: supplier.id,

              code: supplier.code,

              name: supplier.name,
            }
          : null,

        /*
         * =================================================
         * OUTLET
         * =================================================
         */

        outlet,

        /*
         * =================================================
         * STATUS STOCK
         * =================================================
         */

        stockStatus,

        /*
         * =================================================
         * HILANGKAN RELASI RAW YANG BESAR
         * =================================================
         */

        purchaseItems:
          undefined,

        sourceOutlet:
          undefined,
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

        total:
          result.length,
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

          minimumStock:
            Number(
              body.minimumStock || 0
            ),

          stock: 0,

          purchasePrice:
            Number(
              body.purchasePrice || 0
            ),

          sellingPrice:
            Number(
              body.sellingPrice || 0
            ),

          hasExpired:
            Boolean(
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

/*
 * =========================================================
 * PATCH - AKTIFKAN / NONAKTIFKAN BARANG
 * =========================================================
 *
 * Fungsi ini HANYA mengubah:
 *
 *     Barang.active
 *
 * Tidak mengubah:
 *
 * - stock
 * - inventory
 * - batch
 * - purchase
 * - receipt
 * - POS
 * - manufacture
 * - recipe / BOM
 * - transfer
 * - delivery
 * - stock card
 * - stock mutation
 * - opname
 * - histori
 *
 * Support:
 *
 * PATCH /api/master/barang?id=132
 *
 * Body:
 *
 * {
 *   "active": true
 * }
 *
 * atau:
 *
 * {
 *   "active": false
 * }
 *
 * Hanya ADMIN dan MANAGER.
 *
 * =========================================================
 */

export async function PATCH(req: NextRequest) {
  try {
    /*
     * =====================================================
     * CURRENT USER
     * =====================================================
     */

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Anda harus login",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * =====================================================
     * AUTHORIZATION
     *
     * Perubahan status master barang tetap merupakan
     * perubahan data master.
     *
     * Hanya ADMIN dan MANAGER.
     * =====================================================
     */

    if (
      user.role !== "ADMIN" &&
      user.role !== "MANAGER"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Anda tidak memiliki izin untuk mengubah status master barang",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * AMBIL ID
     *
     * Support:
     *
     * PATCH /api/master/barang?id=132
     *
     * atau body:
     *
     * {
     *   "id": 132,
     *   "active": true
     * }
     * =====================================================
     */

    const { searchParams } =
      new URL(req.url);

    let body: any = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const queryId =
      Number(
        searchParams.get("id") || 0
      );

    const bodyId =
      Number(
        body?.id ||
        body?.barangId ||
        0
      );

    const id =
      queryId > 0
        ? queryId
        : bodyId;

    /*
     * =====================================================
     * VALIDASI ID
     * =====================================================
     */

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "ID barang tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * VALIDASI ACTIVE
     * =====================================================
     */

    if (
      typeof body?.active !==
      "boolean"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Field active harus berupa true atau false",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * CARI BARANG
     * =====================================================
     */

    const barang =
      await prisma.barang.findUnique({
        where: {
          id,
        },

        select: {
          id: true,

          code: true,

          name: true,

          active: true,
        },
      });

    /*
     * =====================================================
     * TIDAK DITEMUKAN
     * =====================================================
     */

    if (!barang) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Master barang tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * =====================================================
     * STATUS SUDAH SAMA
     * =====================================================
     */

    if (
      barang.active ===
      body.active
    ) {
      return NextResponse.json({
        success: true,

        message:
          body.active
            ? "Barang sudah dalam status aktif"
            : "Barang sudah dalam status nonaktif",

        data: {
          id: barang.id,

          code: barang.code,

          name: barang.name,

          active:
            barang.active,
        },
      });
    }

    /*
     * =====================================================
     * UPDATE STATUS
     * =====================================================
     *
     * HANYA field active yang disentuh.
     *
     * Tidak ada perubahan terhadap field lain.
     * =====================================================
     */

    const updated =
      await prisma.barang.update({
        where: {
          id,
        },

        data: {
          active:
            body.active,
        },

        select: {
          id: true,

          code: true,

          name: true,

          active: true,
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
        updated.active
          ? `Barang "${updated.code} - ${updated.name}" berhasil diaktifkan`
          : `Barang "${updated.code} - ${updated.name}" berhasil dinonaktifkan`,

      data: updated,
    });
  } catch (error: any) {
    console.error(
      "PATCH MASTER BARANG ERROR:",
      error
    );

    /*
     * =====================================================
     * BARANG TIDAK DITEMUKAN
     * =====================================================
     */

    if (
      error?.code === "P2025"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Master barang tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * =====================================================
     * ERROR UMUM
     * =====================================================
     */

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal mengubah status master barang",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * =========================================================
 * DELETE - HAPUS MASTER BARANG
 * =========================================================
 *
 * ATURAN:
 *
 * 1. Barang yang belum pernah digunakan
 *    boleh dihapus permanen.
 *
 * 2. Barang yang sudah mempunyai relasi/transaksi
 *    TIDAK boleh dihapus.
 *
 * 3. Tidak melakukan cascade manual terhadap histori.
 *
 * 4. Jika database menolak karena foreign key,
 *    DELETE tetap dianggap gagal dan data aman.
 *
 * =========================================================
 */

export async function DELETE(req: NextRequest) {
  try {
    /*
     * =====================================================
     * CURRENT USER
     * =====================================================
     */

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda harus login",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * =====================================================
     * AUTHORIZATION
     *
     * Hapus master barang adalah operasi destruktif.
     * Hanya ADMIN dan MANAGER.
     * =====================================================
     */

    if (
      user.role !== "ADMIN" &&
      user.role !== "MANAGER"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki izin untuk menghapus master barang",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * AMBIL ID
     *
     * Support:
     *
     * DELETE /api/master/barang?id=123
     *
     * atau
     *
     * {
     *   "id": 123
     * }
     * =====================================================
     */

    const { searchParams } =
      new URL(req.url);

    let id = Number(
      searchParams.get("id") || 0
    );

    /*
     * Jika ID tidak ada di query,
     * coba baca body.
     */

    if (!id) {
      try {
        const body =
          await req.json();

        id = Number(
          body?.id ||
          body?.barangId ||
          0
        );
      } catch {
        /*
         * Body kosong bukan masalah.
         * Validasi ID dilakukan setelah ini.
         */
      }
    }

    /*
     * =====================================================
     * VALIDASI ID
     * =====================================================
     */

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID barang tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * CARI BARANG + SEMUA RELASI
     * =====================================================
     */

    const barang =
      await prisma.barang.findUnique({
        where: {
          id,
        },

        select: {
          id: true,

          code: true,

          name: true,

          stock: true,

          active: true,

          source: true,

          /*
           * RELASI ONE-TO-ONE
           */

          inventory: {
            select: {
              id: true,
            },
          },

          priceSummary: {
            select: {
              id: true,
            },
          },

          productCKOutputs: {
            select: {
              id: true,
            },
          },

          /*
           * RELASI ONE-TO-MANY
           */

          _count: {
            select: {
              adjustmentItems: true,

              batches: true,

              batchStocks: true,

              deliveryItems: true,

              manufactureOrderItems: true,

              MasterHarga: true,

              mutationStocks: true,

              outletBarang: true,

              outletPurchaseItems: true,

              outletReceiptItems: true,

              outletSaleItems: true,

              outletStocks: true,

              outletStockOuts: true,

              outletTransferItems: true,

              purchaseItems: true,

              receiptItems: true,

              recipeOutputs: true,

              recipeItems: true,

              stockCards: true,

              stockMutations: true,

              stockOpnameHistory: true,

              stockOpnameItems: true,

              stockWastes: true,
            },
          },
        },
      });

    /*
     * =====================================================
     * BARANG TIDAK DITEMUKAN
     * =====================================================
     */

    if (!barang) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Master barang tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * =====================================================
     * CEK STOCK
     * =====================================================
     */

    if (
      Number(barang.stock || 0) !== 0
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            `Barang "${barang.code} - ${barang.name}" masih memiliki stock ${barang.stock}. Kosongkan stock melalui proses yang benar terlebih dahulu.`,
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =====================================================
     * KUMPULKAN RELASI YANG TERPAKAI
     * =====================================================
     */

    const relationUsage: Array<{
      key: string;
      label: string;
      count: number;
    }> = [];

    const count =
      barang._count;

    /*
     * RELASI ONE-TO-ONE
     */

    if (barang.inventory) {
      relationUsage.push({
        key: "inventory",

        label: "Inventory",

        count: 1,
      });
    }

    if (barang.priceSummary) {
      relationUsage.push({
        key: "priceSummary",

        label: "Price Summary",

        count: 1,
      });
    }

    if (barang.productCKOutputs) {
      relationUsage.push({
        key: "productCKOutputs",

        label: "Product CK",

        count: 1,
      });
    }

    /*
     * RELASI TRANSAKSI / MASTER
     */

    const relationLabels: Array<
      [keyof typeof count, string]
    > = [
      [
        "adjustmentItems",
        "Adjustment",
      ],

      [
        "batches",
        "Barang Batch",
      ],

      [
        "batchStocks",
        "Batch Stock",
      ],

      [
        "deliveryItems",
        "Delivery",
      ],

      [
        "manufactureOrderItems",
        "Manufacture",
      ],

      [
        "MasterHarga",
        "Master Harga",
      ],

      [
        "mutationStocks",
        "Mutation Stock",
      ],

      [
        "outletBarang",
        "Outlet Barang",
      ],

      [
        "outletPurchaseItems",
        "Outlet Purchase",
      ],

      [
        "outletReceiptItems",
        "Outlet Receipt",
      ],

      [
        "outletSaleItems",
        "POS / Outlet Sale",
      ],

      [
        "outletStocks",
        "Outlet Stock",
      ],

      [
        "outletStockOuts",
        "Outlet Stock Out",
      ],

      [
        "outletTransferItems",
        "Outlet Transfer",
      ],

      [
        "purchaseItems",
        "Purchase",
      ],

      [
        "receiptItems",
        "Receipt",
      ],

      [
        "recipeOutputs",
        "Recipe Output",
      ],

      [
        "recipeItems",
        "Recipe / BOM",
      ],

      [
        "stockCards",
        "Stock Card",
      ],

      [
        "stockMutations",
        "Stock Mutation",
      ],

      [
        "stockOpnameHistory",
        "Stock Opname History",
      ],

      [
        "stockOpnameItems",
        "Stock Opname",
      ],

      [
        "stockWastes",
        "Stock Waste",
      ],
    ];

    for (
      const [key, label]
      of relationLabels
    ) {
      const relationCount =
        Number(
          count[key] || 0
        );

      if (
        relationCount > 0
      ) {
        relationUsage.push({
          key: String(key),

          label,

          count:
            relationCount,
        });
      }
    }

    /*
     * =====================================================
     * JIKA SUDAH PERNAH DIGUNAKAN
     * =====================================================
     */

    if (
      relationUsage.length > 0
    ) {
      const detail =
        relationUsage
          .map(
            (item) =>
              `${item.label} (${item.count})`
          )
          .join(", ");

      return NextResponse.json(
        {
          success: false,

          canDelete: false,

          message:
            `Barang "${barang.code} - ${barang.name}" tidak dapat dihapus karena sudah digunakan.`,

          reason:
            "Barang memiliki relasi atau histori data.",

          usedIn:
            relationUsage,

          detail,
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =====================================================
     * DELETE
     * =====================================================
     */

    await prisma.barang.delete({
      where: {
        id,
      },
    });

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      canDelete: true,

      message:
        `Master barang "${barang.code} - ${barang.name}" berhasil dihapus.`,

      data: {
        id: barang.id,

        code: barang.code,

        name: barang.name,
      },
    });
  } catch (error: any) {
    console.error(
      "DELETE MASTER BARANG ERROR:",
      error
    );

    /*
     * =====================================================
     * PRISMA FOREIGN KEY
     * =====================================================
     */

    if (
      error?.code === "P2003"
    ) {
      return NextResponse.json(
        {
          success: false,

          canDelete: false,

          message:
            "Barang tidak dapat dihapus karena masih digunakan oleh data lain.",

          reason:
            "Foreign key constraint",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =====================================================
     * BARANG TIDAK DITEMUKAN
     * =====================================================
     */

    if (
      error?.code === "P2025"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Master barang tidak ditemukan atau sudah dihapus.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * =====================================================
     * ERROR UMUM
     * =====================================================
     */

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal menghapus master barang",
      },
      {
        status: 500,
      }
    );
  }
}