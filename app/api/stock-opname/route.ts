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
    });

    return user;
  } catch (error) {
    console.error("GET CURRENT USER ERROR:", error);
    return null;
  }
}

/*
 * =========================================================
 * GET - STOCK OPNAME PUSAT
 * =========================================================
 *
 * STOCK OPNAME PUSAT:
 *
 * StockOpname.outletId = null
 *
 * Hanya mengambil opname pusat.
 * Stock Opname Outlet tidak ikut tampil.
 *
 * =========================================================
 */

export async function GET() {
  try {
    const data = await prisma.stockOpname.findMany({
      where: {
        outletId: null,
      },

      include: {
        items: {
          include: {
            barang: true,
          },
        },
      },

      orderBy: {
        id: "desc",
      },
    });

    const result = data.map((item) => ({
      id: item.id,

      code: item.code,

      date: item.date,

      type: item.type,

      status: item.status,

      outletId: null,

      totalItem: item.items.length,

      totalDifference: item.items.reduce(
        (total, detail) =>
          total + Number(detail.difference || 0),
        0
      ),

      items: item.items.map((detail) => ({
        id: detail.id,

        barangId: detail.barangId,

        code: detail.barang.code,

        barcode: detail.barang.barcode,

        name: detail.barang.name,

        unit: detail.barang.unit,

        systemQty: detail.systemQty,

        physicalQty: detail.physicalQty,

        difference: detail.difference,

        note: detail.note,
      })),
    }));

    return NextResponse.json({
      success: true,

      data: result,

      meta: {
        warehouse: "MAIN",
        outletId: null,
        total: result.length,
      },
    });
  } catch (error) {
    console.error(
      "GET STOCK OPNAME PUSAT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil Stock Opname Pusat",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * =========================================================
 * POST - CREATE STOCK OPNAME PUSAT
 * =========================================================
 *
 * SUMBER STOCK:
 *
 * Barang.stock
 *
 * Hanya Barang.source = CENTRAL.
 *
 * outletId sengaja dibuat NULL.
 *
 * =========================================================
 */

export async function POST(req: NextRequest) {
  try {
    /*
     * =====================================================
     * CURRENT USER
     * =====================================================
     */

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Session user tidak ditemukan",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * =====================================================
     * VALIDASI ROLE
     * =====================================================
     *
     * Stock Opname Pusat hanya dapat dibuat
     * oleh user pusat.
     *
     * OUTLET_ADMIN tidak boleh membuat
     * Stock Opname Pusat.
     *
     * =====================================================
     */

    if (user.role === "OUTLET_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message:
            "OUTLET_ADMIN tidak dapat membuat Stock Opname Pusat",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * BODY
     * =====================================================
     */

    let body: any = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const requestedType =
      String(body?.type || "WEEKLY").toUpperCase();

    const type =
      requestedType === "MONTHLY"
        ? "MONTHLY"
        : "WEEKLY";

    /*
     * =====================================================
     * NOMOR STOCK OPNAME
     * =====================================================
     *
     * Tidak menggunakan count() saja karena
     * count dapat menghasilkan nomor duplikat
     * jika ada data yang terhapus.
     *
     * Untuk menjaga kompatibilitas dengan format lama,
     * kita tetap mencari nomor berikutnya.
     *
     * =====================================================
     */

    const latest = await prisma.stockOpname.findFirst({
      orderBy: {
        id: "desc",
      },
      select: {
        code: true,
      },
    });

    let nomor = 1;

    if (latest?.code) {
      const match =
        latest.code.match(/SO-\d{4}-(\d+)$/);

      if (match) {
        nomor = Number(match[1]) + 1;
      }
    }

    const code =
      `SO-${new Date().getFullYear()}-${String(
        nomor
      ).padStart(4, "0")}`;

    /*
     * =====================================================
     * BARANG PUSAT
     * =====================================================
     *
     * PENTING:
     *
     * Jangan memasukkan barang outlet.
     *
     * Stock Opname Pusat hanya:
     *
     * Barang.source = CENTRAL
     *
     * =====================================================
     */

    const barang = await prisma.barang.findMany({
      where: {
        source: "CENTRAL",
        active: true,
      },

      orderBy: {
        name: "asc",
      },
    });

    if (barang.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Master barang pusat masih kosong",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * CREATE STOCK OPNAME + ITEMS
     * =====================================================
     */

    const opname = await prisma.$transaction(
      async (tx) => {
        /*
         * -------------------------------------------------
         * CREATE HEADER
         * -------------------------------------------------
         *
         * outletId TIDAK DIISI.
         *
         * Dengan demikian:
         *
         * outletId = NULL
         *
         * berarti Stock Opname Pusat.
         *
         * -------------------------------------------------
         */

        const created =
          await tx.stockOpname.create({
            data: {
              code,

              date: new Date(),

              type,

              status: "COUNTING",

              createdBy: user.id,

              outletId: null,
            },
          });

        /*
         * -------------------------------------------------
         * CREATE ITEMS
         * -------------------------------------------------
         *
         * systemQty berasal dari Barang.stock.
         *
         * physicalQty awal = systemQty.
         *
         * difference awal = 0.
         *
         * -------------------------------------------------
         */

        await tx.stockOpnameItem.createMany({
          data: barang.map((b) => ({
            opnameId: created.id,

            barangId: b.id,

            systemQty: Number(b.stock || 0),

            physicalQty: Number(b.stock || 0),

            difference: 0,
          })),
        });

        /*
         * -------------------------------------------------
         * GET DETAIL
         * -------------------------------------------------
         */

        return tx.stockOpname.findUnique({
          where: {
            id: created.id,
          },

          include: {
            items: {
              include: {
                barang: true,
              },
            },
          },
        });
      }
    );

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      message:
        "Stock Opname Pusat berhasil dibuat",

      data: {
        ...opname,

        warehouse: "MAIN",

        outletId: null,
      },
    });
  } catch (error: any) {
    console.error(
      "CREATE STOCK OPNAME PUSAT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal membuat Stock Opname Pusat",
      },
      {
        status: 500,
      }
    );
  }
}