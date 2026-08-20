import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/*
 * =========================================================
 * GET - HISTORY STOCK PUSAT
 * =========================================================
 *
 * SUMBER UTAMA:
 *
 * StockCard
 *
 * STOCK PUSAT:
 *
 * warehouse = MAIN
 *
 * Tidak menggunakan:
 *
 * - OutletStock
 * - OutletReceiptItem
 * - OutletStockOut
 * - OutletTransfer
 *
 * =========================================================
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } =
      new URL(req.url);

    /*
     * =====================================================
     * FILTER
     * =====================================================
     */

    const search =
      searchParams.get("search")?.trim() || "";

    const barangIdParam =
      searchParams.get("barangId");

    const trxType =
      searchParams.get("trxType")?.trim() || "";

    /*
     * =====================================================
     * BARANG ID
     * =====================================================
     */

    let barangId: number | undefined =
      undefined;

    if (barangIdParam) {
      const parsed = Number(barangIdParam);

      if (
        Number.isInteger(parsed) &&
        parsed > 0
      ) {
        barangId = parsed;
      }
    }

    /*
     * =====================================================
     * WHERE
     * =====================================================
     *
     * Stock Pusat:
     *
     * warehouse = MAIN
     *
     * =====================================================
     */

    const where: any = {
      warehouse: "MAIN",
    };

    if (barangId) {
      where.barangId = barangId;
    }

    if (trxType) {
      where.trxType = trxType;
    }

    /*
     * =====================================================
     * SEARCH BARANG
     * =====================================================
     */

    if (search) {
      where.barang = {
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
          {
            barcode: {
              contains: search,
            },
          },
        ],
      };
    }

    /*
     * =====================================================
     * GET STOCK CARD
     * =====================================================
     */

    const stockCards =
      await prisma.stockCard.findMany({
        where,

        include: {
          barang: true,
        },

        orderBy: [
          {
            trxDate: "desc",
          },
          {
            id: "desc",
          },
        ],
      });

    /*
     * =====================================================
     * FORMAT
     * =====================================================
     */

    const data = stockCards.map(
      (item, index) => ({
        id: item.id,

        no: index + 1,

        barangId: item.barangId,

        kodeBarang:
          item.barang?.code ?? "-",

        barcode:
          item.barang?.barcode ?? null,

        barang:
          item.barang?.name ?? "-",

        namaBarang:
          item.barang?.name ?? "-",

        satuan:
          item.barang?.unit ?? "-",

        tanggal: item.trxDate,

        trxDate: item.trxDate,

        tipe: item.trxType,

        trxType: item.trxType,

        nomor:
          item.trxNumber ?? "-",

        trxNumber:
          item.trxNumber ?? "-",

        referenceId:
          item.referenceId ?? null,

        warehouse:
          item.warehouse ?? "MAIN",

        qtyIn:
          Number(item.qtyIn || 0),

        qtyOut:
          Number(item.qtyOut || 0),

        balance:
          Number(item.balance || 0),

        unitPrice:
          Number(item.unitPrice || 0),

        totalValue:
          Number(item.totalValue || 0),

        note:
          item.note ?? null,

        description:
          item.note ?? null,

        createdAt:
          item.createdAt,
      })
    );

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      data,

      meta: {
        warehouse: "MAIN",

        outletId: null,

        total: data.length,
      },
    });
  } catch (error) {
    console.error(
      "GET HISTORY STOCK PUSAT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Gagal mengambil History Stock Pusat",
      },
      {
        status: 500,
      }
    );
  }
}