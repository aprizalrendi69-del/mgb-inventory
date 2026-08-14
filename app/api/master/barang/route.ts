import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";

    // =====================================================
    // GET DATA BARANG
    // =====================================================

    const data = await prisma.barang.findMany({
      where: {
        AND: [
          search
            ? {
                OR: [
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
                ],
              }
            : {},

          category
            ? {
                category,
              }
            : {},
        ],
      },

      // =====================================================
      // RELATION DATA
      // =====================================================

      include: {
        // =================================================
        // HARGA TERAKHIR / SUMMARY HARGA
        // =================================================

        priceSummary: true,

        // =================================================
        // BATCH STOCK / EXPIRED
        // =================================================
        //
        // Hanya batch yang masih mempunyai stock
        // yang dikirim ke frontend.
        //
        // Diurutkan berdasarkan expired terdekat.
        //

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

        // =================================================
        // SUPPLIER TERAKHIR
        // =================================================
        //
        // Barang
        //   ↓
        // PurchaseItem
        //   ↓
        // Purchase
        //   ↓
        // Supplier
        //
        // Ambil PurchaseItem dari purchase terbaru.
        //

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

      // =====================================================
      // SORT BARANG
      // =====================================================

      orderBy: {
        id: "desc",
      },
    });

    // =====================================================
    // FORMAT RESPONSE
    // =====================================================
    //
    // Supplier dibuat langsung menjadi:
    //
    // supplier: {
    //   id,
    //   code,
    //   name
    // }
    //
    // Sehingga frontend barcode tidak perlu membaca
    // PurchaseItem lagi.
    //

    const result = data.map((item) => {
      const lastPurchaseItem =
        item.purchaseItems?.[0];

      const supplier =
        lastPurchaseItem?.purchase?.supplier;

      return {
        ...item,

        supplier: supplier
          ? {
              id: supplier.id,
              code: supplier.code,
              name: supplier.name,
            }
          : null,

        // PurchaseItem tidak perlu dikirim
        // karena supplier sudah diformat di atas.
        purchaseItems: undefined,
      };
    });

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "GET MASTER BARANG ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil data barang",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================================================
// POST - CREATE BARANG
// =========================================================

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // =====================================================
    // VALIDASI
    // =====================================================

    if (!body.code) {
      return NextResponse.json({
        success: false,
        message: "Kode barang wajib diisi",
      });
    }

    if (!body.name) {
      return NextResponse.json({
        success: false,
        message: "Nama barang wajib diisi",
      });
    }

    if (!body.unit) {
      return NextResponse.json({
        success: false,
        message: "Satuan wajib diisi",
      });
    }

    // =====================================================
    // CEK KODE BARANG
    // =====================================================

    const cekKode = await prisma.barang.findUnique({
      where: {
        code: body.code,
      },
    });

    if (cekKode) {
      return NextResponse.json({
        success: false,
        message: "Kode barang sudah digunakan",
      });
    }

    // =====================================================
    // BARCODE
    // =====================================================

    const barcode =
      body.barcode && body.barcode !== ""
        ? body.barcode
        : `MGB-${body.code}`;

    // =====================================================
    // CEK BARCODE
    // =====================================================

    const cekBarcode =
      await prisma.barang.findFirst({
        where: {
          barcode,
        },
      });

    if (cekBarcode) {
      return NextResponse.json({
        success: false,
        message: "Barcode sudah digunakan",
      });
    }

    // =====================================================
    // CREATE BARANG
    // =====================================================

    const barang = await prisma.barang.create({
      data: {
        code: body.code,

        barcode,

        name: body.name,

        category:
          body.category || null,

        brand:
          body.brand || null,

        unit: body.unit,

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
      },
    });

    // =====================================================
    // RESPONSE CREATE
    // =====================================================

    return NextResponse.json({
      success: true,
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
          "Gagal membuat barang",
      },
      {
        status: 500,
      }
    );
  }
}