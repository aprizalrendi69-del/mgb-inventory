import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim() || "";

    // =====================================================
    // FILTER BARANG AKTIF
    // =====================================================

    const where = search
      ? {
          active: true,
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
        }
      : {
          active: true,
        };

    // =====================================================
    // AMBIL MASTER BARANG
    // =====================================================

    const barang = await prisma.barang.findMany({
      where,
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        code: true,
        name: true,

        // ===================================================
        // SATUAN TRANSAKSI
        // ===================================================

        unit: true,

        // ===================================================
        // SATUAN DASAR + KONVERSI
        // ===================================================

        baseUnit: true,
        conversionRate: true,

        barcode: true,

        // ===================================================
        // STOCK UTAMA
        // ===================================================

        stock: true,
        minimumStock: true,
        purchasePrice: true,

        // ===================================================
        // INVENTORY
        // ===================================================

        inventory: {
          select: {
            stock: true,
            minimumStock: true,
            averageCost: true,
            lastPurchase: true,
            availableStock: true,
            reservedStock: true,
          },
        },
      },
    });

    // =====================================================
    // JIKA TIDAK ADA BARANG
    // =====================================================

    if (barang.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const barangIds = barang.map((item) => item.id);

    // =====================================================
    // STOCK CARD HISTORY
    //
    // HANYA WAREHOUSE MAIN / STOCK PUSAT
    //
    // Barang dianggap memiliki history apabila mempunyai
    // minimal 1 StockCard.
    // =====================================================

    const stockCards = await prisma.stockCard.findMany({
      where: {
        barangId: {
          in: barangIds,
        },
        warehouse: "MAIN",
      },
      orderBy: [
        {
          trxDate: "desc",
        },
        {
          id: "desc",
        },
      ],
      select: {
        id: true,
        barangId: true,
        trxDate: true,
        trxType: true,
        trxNumber: true,
        qtyIn: true,
        qtyOut: true,
        balance: true,
        note: true,
      },
    });

    // =====================================================
    // HISTORY COUNT PER BARANG
    // =====================================================

    const historyCountMap = new Map<number, number>();

    // =====================================================
    // LAST STOCK CARD PER BARANG
    // =====================================================

    const lastStockCardMap = new Map<
      number,
      {
        id: number;
        trxDate: Date;
        trxType: string;
        trxNumber: string | null;
        qtyIn: number;
        qtyOut: number;
        balance: number;
        note: string | null;
      }
    >();

    for (const card of stockCards) {
      // ===================================================
      // HITUNG JUMLAH HISTORY
      // ===================================================

      historyCountMap.set(
        card.barangId,
        (historyCountMap.get(card.barangId) || 0) + 1
      );

      // ===================================================
      // AMBIL HISTORY TERAKHIR
      //
      // Karena stockCards sudah DESC berdasarkan tanggal
      // dan id, item pertama adalah history terbaru.
      // ===================================================

      if (!lastStockCardMap.has(card.barangId)) {
        lastStockCardMap.set(card.barangId, {
          id: card.id,
          trxDate: card.trxDate,
          trxType: String(card.trxType || "").toUpperCase(),
          trxNumber: card.trxNumber || null,
          qtyIn: Number(card.qtyIn || 0),
          qtyOut: Number(card.qtyOut || 0),
          balance: Number(card.balance || 0),
          note: card.note || null,
        });
      }
    }

    // =====================================================
    // STOCK OPNAME TERAKHIR PUSAT
    //
    // Stock Opname pusat = opname tanpa outletId.
    //
    // Tetap dipertahankan agar halaman Stock Pusat
    // tidak kehilangan informasi Stock Opname.
    // =====================================================

    const opnameItems = await prisma.stockOpnameItem.findMany({
      where: {
        barangId: {
          in: barangIds,
        },
        opname: {
          outletId: null,
          status: {
            in: [
              "APPROVED",
              "COUNTING",
              "PENDING",
            ],
          },
        },
      },
      orderBy: {
        opname: {
          date: "desc",
        },
      },
      select: {
        id: true,
        barangId: true,
        systemQty: true,
        physicalQty: true,
        difference: true,
        note: true,

        opname: {
          select: {
            id: true,
            code: true,
            date: true,
            status: true,
          },
        },
      },
    });

    // =====================================================
    // MAP STOCK OPNAME TERAKHIR PER BARANG
    // =====================================================

    const lastOpnameMap = new Map<
      number,
      {
        opnameId: number;
        code: string;
        date: Date;
        status: string;
        systemQty: number;
        physicalQty: number;
        difference: number;
        note: string | null;
      }
    >();

    for (const item of opnameItems) {
      /*
       * Karena data sudah diurutkan date DESC,
       * item pertama yang masuk ke map adalah opname
       * terbaru untuk barang tersebut.
       */

      if (!lastOpnameMap.has(item.barangId)) {
        lastOpnameMap.set(item.barangId, {
          opnameId: item.opname.id,
          code: item.opname.code,
          date: item.opname.date,
          status: item.opname.status,

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
        });
      }
    }

    // =====================================================
    // BUILD RESPONSE
    //
    // PENTING:
    // HANYA BARANG YANG MEMILIKI STOCK CARD HISTORY
    // YANG AKAN MASUK KE DATA.
    // =====================================================

    const data = barang
      .filter((item) => {
        const historyCount =
          historyCountMap.get(item.id) || 0;

        return historyCount > 0;
      })
      .map((item) => {
        // =================================================
        // JUMLAH HISTORY
        // =================================================

        const historyCount =
          historyCountMap.get(item.id) || 0;

        // =================================================
        // HISTORY TERAKHIR
        // =================================================

        const lastStockCard =
          lastStockCardMap.get(item.id) || null;

        // =================================================
        // STOCK TRANSAKSI
        //
        // TIDAK DIKONVERSI.
        //
        // Contoh:
        //
        // stock = 10
        // unit  = DUS
        //
        // maka:
        // stock = 10 DUS
        // =================================================

        const systemStock = Number(
          item.stock ??
            item.inventory?.stock ??
            0
        );

        // =================================================
        // MINIMUM STOCK
        // =================================================

        const minimumStock = Number(
          item.minimumStock ??
            item.inventory?.minimumStock ??
            0
        );

        // =================================================
        // KONVERSI
        // =================================================

        const rawConversion = Number(
          item.conversionRate ?? 1
        );

        const conversion =
          Number.isFinite(rawConversion) &&
          rawConversion > 0
            ? rawConversion
            : 1;

        // =================================================
        // BASE UNIT
        // =================================================

        const baseUnit =
          item.baseUnit?.trim() ||
          item.unit;

        // =================================================
        // AVERAGE COST
        // =================================================

        const averageCost = Number(
          item.inventory?.averageCost ??
            item.purchasePrice ??
            0
        );

        // =================================================
        // RETURN
        // =================================================

        return {
          id: item.id,

          // =================================================
          // STOCK RECORD
          // =================================================

          barangId: item.id,

          // =================================================
          // STOCK
          // =================================================

          stock: systemStock,

          // =================================================
          // MINIMUM STOCK
          // =================================================

          minimumStock,

          // =================================================
          // AVERAGE COST
          // =================================================

          averageCost,

          // =================================================
          // HISTORY
          //
          // Field ini bisa langsung digunakan frontend
          // untuk filtering / badge / informasi.
          // =================================================

          hasHistory: true,
          historyCount,

          // =================================================
          // HISTORY TERAKHIR
          //
          // Tambahan informasi tanpa mengganggu
          // lastOpname yang sudah digunakan frontend.
          // =================================================

          lastStockCard,

          // =================================================
          // DATA BARANG
          // =================================================

          barang: {
            id: item.id,
            code: item.code,
            name: item.name,

            // Satuan transaksi
            unit: item.unit,

            // Satuan dasar
            baseUnit,

            // conversionRate -> conversion
            conversion,

            barcode: item.barcode,
          },

          // =================================================
          // STOCK OPNAME TERAKHIR
          // =================================================

          lastOpname:
            lastOpnameMap.get(item.id) ??
            null,
        };
      });

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error(
      "GET CENTRAL STOCK ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        data: [],
        message:
          error?.message ||
          "Gagal mengambil stock pusat",
      },
      {
        status: 500,
      }
    );
  }
}