import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim() || "";

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

    const barang = await prisma.barang.findMany({
      where,
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        code: true,
        name: true,

        // =====================================================
        // SATUAN TRANSAKSI
        // =====================================================
        unit: true,

        // =====================================================
        // SATUAN DASAR + KONVERSI
        //
        // Contoh:
        // unit           = DUS
        // baseUnit       = PCS
        // conversionRate = 24
        //
        // Artinya:
        // 1 DUS = 24 PCS
        // =====================================================
        baseUnit: true,
        conversionRate: true,

        barcode: true,

        // =====================================================
        // STOCK UTAMA
        // =====================================================
        stock: true,
        minimumStock: true,
        purchasePrice: true,

        // =====================================================
        // INVENTORY
        // Digunakan sebagai fallback / informasi tambahan.
        // =====================================================
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

    const barangIds = barang.map((item) => item.id);

    /*
     * =====================================================
     * STOCK OPNAME TERAKHIR PUSAT
     *
     * Stock Opname pusat = opname tanpa outletId.
     *
     * Kita tetap mempertahankan logic sebelumnya agar
     * halaman Stock Pusat tidak berubah perilakunya.
     * =====================================================
     */
    const opnameItems =
      barangIds.length > 0
        ? await prisma.stockOpnameItem.findMany({
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
          })
        : [];

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
    // =====================================================

    const data = barang.map((item) => {
      /*
       * ===================================================
       * STOCK TRANSAKSI
       *
       * PENTING:
       * Stock ini TIDAK dikonversi.
       *
       * Contoh:
       * Barang.stock = 10
       * unit        = DUS
       *
       * Maka:
       * stock = 10 DUS
       * ===================================================
       */
      const systemStock = Number(
        item.stock ??
          item.inventory?.stock ??
          0
      );

      /*
       * ===================================================
       * MINIMUM STOCK
       *
       * Tetap menggunakan satuan transaksi.
       * ===================================================
       */
      const minimumStock = Number(
        item.minimumStock ??
          item.inventory?.minimumStock ??
          0
      );

      /*
       * ===================================================
       * KONVERSI
       *
       * Schema menggunakan conversionRate.
       *
       * Frontend StockPusatPage menggunakan field
       * "conversion", sehingga kita normalisasi di API.
       *
       * Jika conversionRate tidak tersedia / invalid,
       * fallback ke 1.
       * ===================================================
       */
      const rawConversion =
        Number(item.conversionRate ?? 1);

      const conversion =
        Number.isFinite(rawConversion) &&
        rawConversion > 0
          ? rawConversion
          : 1;

      /*
       * ===================================================
       * SATUAN DASAR
       *
       * Jika baseUnit kosong, fallback ke unit transaksi.
       *
       * Contoh:
       *
       * unit     = DUS
       * baseUnit = PCS
       *
       * hasil:
       * 1 DUS = 24 PCS
       * ===================================================
       */
      const baseUnit =
        item.baseUnit?.trim() ||
        item.unit;

      /*
       * ===================================================
       * AVERAGE COST
       * ===================================================
       */
      const averageCost = Number(
        item.inventory?.averageCost ??
          item.purchasePrice ??
          0
      );

      return {
        id: item.id,

        // Stock record menggunakan barangId yang sama
        // karena halaman Stock Pusat mengambil stock dari
        // master Barang.stock.
        barangId: item.id,

        // =================================================
        // STOCK TRANSAKSI
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

          // Normalisasi:
          // conversionRate -> conversion
          //
          // Agar langsung kompatibel dengan
          // StockPusatPage yang sudah kamu kirim.
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