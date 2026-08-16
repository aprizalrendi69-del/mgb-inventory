import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// =========================================================
// GET - MASTER BARANG
// =========================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const source = searchParams.get("source")?.trim() || "CENTRAL";

    const where: any = {};

    // =====================================================
    // FILTER SOURCE
    // =====================================================

    if (source === "CENTRAL") {
      where.source = "CENTRAL";
    } else if (source === "OUTLET") {
      where.source = "OUTLET";
    }
    // source === ALL = tampilkan semua

    // =====================================================
    // SEARCH
    // =====================================================

    if (search) {
      where.OR = [
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

    // =====================================================
    // CATEGORY
    // =====================================================

    if (category) {
      where.category = category;
    }

    // =====================================================
    // GET DATA
    // =====================================================

    const data = await prisma.barang.findMany({
      where,

      include: {
        priceSummary: true,

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

        sourceOutlet: true,
      },

      orderBy: {
        id: "desc",
      },
    });

    // =====================================================
    // FORMAT
    // =====================================================

    const result = data.map((item) => {
      const lastPurchaseItem = item.purchaseItems?.[0];

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

        outlet: item.sourceOutlet
          ? {
              id: item.sourceOutlet.id,
              code: item.sourceOutlet.code,
              name: item.sourceOutlet.name,
            }
          : null,

        purchaseItems: undefined,
        sourceOutlet: undefined,
      };
    });

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
        message:
          "Gagal mengambil data master barang",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================================================
// POST - CREATE BARANG PUSAT
// =========================================================

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // =====================================================
    // NORMALISASI
    // =====================================================

    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();
    const unit = String(body.unit || "").trim();
    const category = String(body.category || "").trim();
    const brand = String(body.brand || "").trim();
    const barcodeInput = String(body.barcode || "").trim();

    // =====================================================
    // VALIDASI
    // =====================================================

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          message: "Kode barang wajib diisi",
        },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Nama barang wajib diisi",
        },
        { status: 400 }
      );
    }

    if (!unit) {
      return NextResponse.json(
        {
          success: false,
          message: "Satuan wajib diisi",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // CEK KODE
    // =====================================================

    const cekKode = await prisma.barang.findUnique({
      where: {
        code,
      },
    });

    if (cekKode) {
      return NextResponse.json(
        {
          success: false,
          message: "Kode barang sudah digunakan",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // BARCODE
    // =====================================================

    const barcode = barcodeInput || `MGB-${code}`;

    // =====================================================
    // CEK BARCODE
    // =====================================================

    const cekBarcode = await prisma.barang.findFirst({
      where: {
        barcode,
      },
    });

    if (cekBarcode) {
      return NextResponse.json(
        {
          success: false,
          message: "Barcode sudah digunakan",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // CREATE BARANG
    // =====================================================

    const barang = await prisma.barang.create({
      data: {
        code,
        barcode,
        name,

        category: category || null,
        brand: brand || null,

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

        // Barang baru selalu dibuat sebagai
        // barang master pusat.
        source: "CENTRAL",
        sourceOutletId: null,
      },
    });

    // =====================================================
    // RESPONSE
    // =====================================================

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