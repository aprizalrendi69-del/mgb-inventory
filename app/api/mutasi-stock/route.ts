import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * ============================================================
 * /api/mutasi-stock
 * ============================================================
 *
 * KHUSUS STOCK PUSAT / CENTRAL
 *
 * TIDAK MENGAMBIL:
 * - OutletStock
 * - OutletPurchase
 * - OutletSale
 * - OutletTransfer
 * - OutletAdjustment
 * - StockMutation outlet
 *
 * CENTRAL ditentukan dengan:
 *
 * Barang.source = CENTRAL
 * StockMutation.outletId = null
 * StockOpname.outletId = null
 *
 * ============================================================
 *
 * LOGIKA LAPORAN:
 *
 * Stock Awal:
 *   Stock Opname APPROVED pusat terakhir sebelum dateFrom.
 *   Nilai yang dipakai = physicalQty.
 *
 * Barang Masuk:
 *   StockMutation pusat dalam periode dengan type IN.
 *
 * Barang Keluar:
 *   StockMutation pusat dalam periode dengan type OUT.
 *
 * Stock Akhir:
 *   Untuk periode:
 *      stock awal + masuk - keluar
 *
 *   Tetapi bila terdapat stockAfter dari mutation terakhir
 *   dalam periode, stockAfter digunakan sebagai validasi/ending
 *   stock pusat aktual.
 *
 * Untuk periode berjalan:
 *   bila tidak ada mutation setelah stock opname,
 *   fallback ke Barang.stock.
 *
 * Cost:
 *   Inventory.averageCost
 *   fallback Barang.purchasePrice
 *
 * Previous Cost:
 *   MasterHarga terakhir sebelum periode.
 *
 * Cost %:
 *   perubahan cost terhadap previous cost.
 *
 * ============================================================
 *
 * TIDAK ADA:
 * - prisma.delete
 * - prisma.update
 * - prisma.create
 * - reset
 * - db push
 *
 * Route ini READ ONLY.
 * ============================================================
 */

type Direction = "IN" | "OUT" | "OTHER";

type TransactionRow = {
  id: number;
  date: string;
  direction: Direction;
  type: string;
  reference: string | null;
  description: string | null;
  qty: number;
  unit: string;
  cost: number;
  amount: number;
  stockBefore: number;
  stockAfter: number;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (value && typeof value === "object") {
    const candidate = value as {
      toNumber?: () => number;
    };

    if (typeof candidate.toNumber === "function") {
      try {
        const result = candidate.toNumber();

        return Number.isFinite(result) ? result : 0;
      } catch {
        return 0;
      }
    }
  }

  const result = Number(value);

  return Number.isFinite(result) ? result : 0;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  return result;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);

  result.setHours(23, 59, 59, 999);

  return result;
}

function parseDateParam(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function getDirection(type: unknown): Direction {
  const value = String(type ?? "")
    .trim()
    .toUpperCase();

  /*
   * IN
   */
  if (
    value === "IN" ||
    value === "MASUK" ||
    value === "STOCK_IN" ||
    value === "RECEIPT" ||
    value === "RECEIVE" ||
    value === "PURCHASE" ||
    value === "TRANSFER_IN" ||
    value === "ADJUSTMENT_IN" ||
    value === "PLUS"
  ) {
    return "IN";
  }

  /*
   * OUT
   */
  if (
    value === "OUT" ||
    value === "KELUAR" ||
    value === "STOCK_OUT" ||
    value === "ISSUE" ||
    value === "DELIVERY" ||
    value === "WASTE" ||
    value === "TRANSFER_OUT" ||
    value === "ADJUSTMENT_OUT" ||
    value === "MINUS"
  ) {
    return "OUT";
  }

  /*
   * Fallback berdasarkan nama.
   */
  if (
    value.includes("IN") ||
    value.includes("MASUK") ||
    value.includes("RECEIPT") ||
    value.includes("RECEIVE") ||
    value.includes("PURCHASE") ||
    value.includes("PLUS")
  ) {
    return "IN";
  }

  if (
    value.includes("OUT") ||
    value.includes("KELUAR") ||
    value.includes("ISSUE") ||
    value.includes("DELIVERY") ||
    value.includes("WASTE") ||
    value.includes("MINUS")
  ) {
    return "OUT";
  }

  return "OTHER";
}

function getCurrentMonthStart(): Date {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );
}

function getCurrentMonthEnd(): Date {
  const now = new Date();

  return now;
}

function getPreviousMonthStart(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth() - 1,
    1
  );
}

function getPreviousMonthEnd(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    0,
    23,
    59,
    59,
    999
  );
}

function calculateCostPercentage(
  currentCost: number,
  previousCost: number
): number {
  if (previousCost === 0) {
    return 0;
  }

  return ((currentCost - previousCost) / previousCost) * 100;
}

function normalizeCost(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 1000000) / 1000000;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const dateFromInput = searchParams.get("dateFrom");
    const dateToInput = searchParams.get("dateTo");

    const parsedFrom = parseDateParam(dateFromInput);
    const parsedTo = parseDateParam(dateToInput);

    const rawDateFrom = parsedFrom ?? getCurrentMonthStart();
    const rawDateTo = parsedTo ?? getCurrentMonthEnd();

    const dateFrom = startOfDay(rawDateFrom);
    const dateTo = endOfDay(rawDateTo);

    if (dateFrom > dateTo) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tanggal awal tidak boleh lebih besar dari tanggal akhir.",
        },
        {
          status: 400,
        }
      );
    }

    /**
     * ========================================================
     * 1. AMBIL BARANG CENTRAL SAJA
     * ========================================================
     *
     * Tidak ada outlet di sini.
     */
    const barangs = await prisma.barang.findMany({
      where: {
        source: "CENTRAL",
        active: true,
      },
      include: {
        inventory: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    /**
     * ========================================================
     * 2. STOCK OPNAME APPROVED TERAKHIR SEBELUM PERIODE
     * ========================================================
     *
     * Khusus pusat:
     *
     * outletId = null
     *
     * Jadi opname outlet tidak akan pernah masuk.
     *
     * Kita ambil semua opname APPROVED yang tanggalnya
     * sebelum tanggal awal periode, kemudian pilih opname
     * terbaru untuk setiap barang.
     */
    const previousApprovedOpnames =
      await prisma.stockOpnameItem.findMany({
        where: {
          opname: {
            status: "APPROVED",
            outletId: null,
            date: {
              lt: dateFrom,
            },
          },
        },
        include: {
          opname: true,
          barang: true,
        },
        orderBy: [
          {
            opname: {
              date: "desc",
            },
          },
          {
            id: "desc",
          },
        ],
      });

    const openingOpnameByBarang = new Map<
      number,
      {
        qty: number;
        opnameId: number;
        opnameCode: string;
        opnameDate: Date;
      }
    >();

    for (const item of previousApprovedOpnames) {
      if (!openingOpnameByBarang.has(item.barangId)) {
        openingOpnameByBarang.set(item.barangId, {
          qty: toNumber(item.physicalQty),
          opnameId: item.opnameId,
          opnameCode: item.opname.code,
          opnameDate: item.opname.date,
        });
      }
    }

    /**
     * ========================================================
     * 3. MUTASI CENTRAL SEBELUM PERIODE
     * ========================================================
     *
     * Digunakan sebagai fallback apabila suatu barang belum
     * mempunyai Stock Opname APPROVED sebelum periode.
     *
     * outletId = null = PUSAT
     */
    const previousCentralMutations =
      await prisma.stockMutation.findMany({
        where: {
          outletId: null,
          createdAt: {
            lt: dateFrom,
          },
        },
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],
        select: {
          id: true,
          barangId: true,
          type: true,
          qty: true,
          stockBefore: true,
          stockAfter: true,
          reference: true,
          description: true,
          createdAt: true,
        },
      });

    const previousMutationByBarang = new Map<
      number,
      {
        id: number;
        stockAfter: number;
        createdAt: Date;
      }
    >();

    for (const mutation of previousCentralMutations) {
      if (!previousMutationByBarang.has(mutation.barangId)) {
        previousMutationByBarang.set(mutation.barangId, {
          id: mutation.id,
          stockAfter: toNumber(mutation.stockAfter),
          createdAt: mutation.createdAt,
        });
      }
    }

    /**
     * ========================================================
     * 4. MUTASI CENTRAL DALAM PERIODE
     * ========================================================
     *
     * INI YANG MASUK TABEL:
     *
     * outletId = null
     *
     * sehingga mutasi outlet tidak mungkin ikut.
     */
    const periodMutations =
      await prisma.stockMutation.findMany({
        where: {
          outletId: null,
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
          barang: {
            source: "CENTRAL",
            active: true,
          },
        },
        orderBy: [
          {
            createdAt: "asc",
          },
          {
            id: "asc",
          },
        ],
        include: {
          barang: true,
        },
      });

    /**
     * ========================================================
     * 5. MUTASI CENTRAL TERAKHIR SAMPAI END PERIOD
     * ========================================================
     *
     * Untuk mendapatkan stockAfter aktual terakhir pusat.
     */
    const latestCentralMutations =
      await prisma.stockMutation.findMany({
        where: {
          outletId: null,
          createdAt: {
            lte: dateTo,
          },
          barang: {
            source: "CENTRAL",
            active: true,
          },
        },
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],
        select: {
          id: true,
          barangId: true,
          stockAfter: true,
          createdAt: true,
        },
      });

    const latestMutationByBarang = new Map<
      number,
      {
        id: number;
        stockAfter: number;
        createdAt: Date;
      }
    >();

    for (const mutation of latestCentralMutations) {
      if (!latestMutationByBarang.has(mutation.barangId)) {
        latestMutationByBarang.set(mutation.barangId, {
          id: mutation.id,
          stockAfter: toNumber(mutation.stockAfter),
          createdAt: mutation.createdAt,
        });
      }
    }

    /**
     * ========================================================
     * 6. COST CURRENT
     * ========================================================
     *
     * Prioritas:
     *
     * Inventory.averageCost
     * ↓
     * Barang.purchasePrice
     *
     * Tidak menggunakan OutletStock.averageCost.
     */
    const currentCostByBarang = new Map<number, number>();

    for (const barang of barangs) {
      const inventoryCost = toNumber(
        barang.inventory?.averageCost
      );

      const purchaseCost = toNumber(
        barang.purchasePrice
      );

      const cost =
        inventoryCost !== 0
          ? inventoryCost
          : purchaseCost;

      currentCostByBarang.set(
        barang.id,
        normalizeCost(cost)
      );
    }

    /**
     * ========================================================
     * 7. PREVIOUS COST
     * ========================================================
     *
     * MasterHarga pusat terakhir sebelum periode.
     *
     * Tidak ada hubungan outlet di MasterHarga.
     */
    const previousPrices = await prisma.masterHarga.findMany({
      where: {
        createdAt: {
          lt: dateFrom,
        },
        barang: {
          source: "CENTRAL",
          active: true,
        },
      },
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      select: {
        id: true,
        barangId: true,
        hargaBaru: true,
        hargaLama: true,
        createdAt: true,
      },
    });

    const previousCostByBarang = new Map<number, number>();

    for (const price of previousPrices) {
      if (!previousCostByBarang.has(price.barangId)) {
        const cost =
          toNumber(price.hargaBaru) ||
          toNumber(price.hargaLama);

        previousCostByBarang.set(
          price.barangId,
          normalizeCost(cost)
        );
      }
    }

    /**
     * ========================================================
     * 8. GROUP MUTASI
     * ========================================================
     */
    const mutationMap = new Map<
      number,
      {
        masuk: number;
        keluar: number;
        incomingCost: number;
        outgoingCost: number;
        transactions: TransactionRow[];
      }
    >();

    for (const mutation of periodMutations) {
      const barangId = mutation.barangId;

      if (!mutationMap.has(barangId)) {
        mutationMap.set(barangId, {
          masuk: 0,
          keluar: 0,
          incomingCost: 0,
          outgoingCost: 0,
          transactions: [],
        });
      }

      const group = mutationMap.get(barangId)!;

      const direction = getDirection(mutation.type);

      const qty = Math.abs(toNumber(mutation.qty));

      const barangCost =
        currentCostByBarang.get(barangId) ?? 0;

      const amount = qty * barangCost;

      if (direction === "IN") {
        group.masuk += qty;
        group.incomingCost += amount;
      } else if (direction === "OUT") {
        group.keluar += qty;
        group.outgoingCost += amount;
      }

      group.transactions.push({
        id: mutation.id,

        date: mutation.createdAt.toISOString(),

        direction,

        type: mutation.type,

        reference: mutation.reference,

        description: mutation.description,

        qty,

        unit:
          mutation.barang.baseUnit ??
          mutation.barang.unit,

        cost: barangCost,

        amount,

        stockBefore: toNumber(
          mutation.stockBefore
        ),

        stockAfter: toNumber(
          mutation.stockAfter
        ),
      });
    }

    /**
     * ========================================================
     * 9. BUILD ROW
     * ========================================================
     *
     * PENTING:
     *
     * Kita TIDAK memfilter hanya barang yang punya transaksi.
     *
     * Semua Barang CENTRAL tetap masuk.
     *
     * Jadi:
     *
     * September SO = 2
     * Oktober tidak ada transaksi
     *
     * tetap tampil:
     *
     * Stock Awal = 2
     * Masuk = 0
     * Keluar = 0
     * Akhir = 2
     */
    const data = barangs.map((barang) => {
      const barangId = barang.id;

      const mutationGroup = mutationMap.get(barangId);

      const masuk = mutationGroup?.masuk ?? 0;

      const keluar = mutationGroup?.keluar ?? 0;

      /**
       * -----------------------------------------------
       * OPENING STOCK
       * -----------------------------------------------
       *
       * Prioritas:
       *
       * 1. APPROVED Stock Opname pusat terakhir
       * 2. Mutation pusat terakhir sebelum periode
       * 3. 0
       */
      const opnameOpening =
        openingOpnameByBarang.get(barangId);

      const previousMutation =
        previousMutationByBarang.get(barangId);

      let stockAwal = 0;

      let openingSource: any = null;

      if (opnameOpening) {
        stockAwal = opnameOpening.qty;

        openingSource = {
          type: "STOCK_OPNAME",
          opnameId: opnameOpening.opnameId,
          code: opnameOpening.opnameCode,
          date: opnameOpening.opnameDate.toISOString(),
          qty: opnameOpening.qty,
        };
      } else if (previousMutation) {
        stockAwal = previousMutation.stockAfter;

        openingSource = {
          type: "STOCK_MUTATION",
          mutationId: previousMutation.id,
          date: previousMutation.createdAt.toISOString(),
          qty: previousMutation.stockAfter,
        };
      }

      /**
       * -----------------------------------------------
       * RUNNING / CALCULATED ENDING
       * -----------------------------------------------
       */
      const calculatedEnding =
        stockAwal +
        masuk -
        keluar;

      /**
       * -----------------------------------------------
       * ACTUAL LAST STOCK MUTATION
       * -----------------------------------------------
       *
       * Jika ada mutation pusat sampai dateTo,
       * stockAfter adalah angka stock pusat terakhir
       * yang tercatat pada ledger.
       */
      const latestMutation =
        latestMutationByBarang.get(barangId);

      let stockAkhir = calculatedEnding;

      let endingSource = "CALCULATED";

      if (latestMutation) {
        stockAkhir = latestMutation.stockAfter;
        endingSource = "STOCK_MUTATION";
      } else {
        /**
         * Bila tidak ada mutation sampai dateTo dan ini
         * adalah periode berjalan, gunakan Barang.stock
         * sebagai fallback.
         *
         * Barang.stock adalah stock master pusat.
         */
        const isCurrentPeriod =
          dateTo >= startOfDay(new Date());

        if (
          isCurrentPeriod &&
          toNumber(barang.stock) !== 0
        ) {
          stockAkhir = toNumber(barang.stock);
          endingSource = "BARANG_STOCK";
        }
      }

      /**
       * -----------------------------------------------
       * COST
       * -----------------------------------------------
       */
      const cost =
        currentCostByBarang.get(barangId) ?? 0;

      const previousCost =
        previousCostByBarang.get(barangId) ?? 0;

      const costPercentage =
        calculateCostPercentage(
          cost,
          previousCost
        );

      const incomingCost =
        mutationGroup?.incomingCost ?? 0;

      const outgoingCost =
        mutationGroup?.outgoingCost ?? 0;

      const endingStockValue =
        stockAkhir * cost;

      /**
       * -----------------------------------------------
       * STATUS
       * -----------------------------------------------
       */
      const minimumStock =
        toNumber(barang.minimumStock);

      let status = "SAFE";

      if (
        minimumStock > 0 &&
        stockAkhir <= 0
      ) {
        status = "HABIS";
      } else if (
        minimumStock > 0 &&
        stockAkhir <= minimumStock
      ) {
        status = "LOW";
      }

      /**
       * -----------------------------------------------
       * RETURN
       * -----------------------------------------------
       */
      return {
        id: barang.id,

        barangId: barang.id,

        code: barang.code,

        kode: barang.code,

        name: barang.name,

        nama: barang.name,

        category: barang.category,

        unit: barang.unit,

        satuan: barang.unit,

        baseUnit: barang.baseUnit,

        minimumStock,

        stockAwal,

        openingStock: stockAwal,

        barangMasuk: masuk,

        stockIn: masuk,

        barangKeluar: keluar,

        stockOut: keluar,

        stockAkhir,

        endingStock: stockAkhir,

        calculatedEnding,

        currentStock: toNumber(barang.stock),

        cost,

        averageCost: cost,

        previousCost,

        costPercentage,

        costPercent: costPercentage,

        incomingCost,

        outgoingCost,

        endingStockValue,

        status,

        openingSource,

        endingSource,

        transactions:
          mutationGroup?.transactions ?? [],
      };
    });

    /**
     * ========================================================
     * 10. SUMMARY
     * ========================================================
     */
    const summary = {
      itemCount: data.length,

      stockAwal: data.reduce(
        (sum, row) =>
          sum + toNumber(row.stockAwal),
        0
      ),

      barangMasuk: data.reduce(
        (sum, row) =>
          sum + toNumber(row.barangMasuk),
        0
      ),

      barangKeluar: data.reduce(
        (sum, row) =>
          sum + toNumber(row.barangKeluar),
        0
      ),

      stockAkhir: data.reduce(
        (sum, row) =>
          sum + toNumber(row.stockAkhir),
        0
      ),

      incomingCost: data.reduce(
        (sum, row) =>
          sum + toNumber(row.incomingCost),
        0
      ),

      outgoingCost: data.reduce(
        (sum, row) =>
          sum + toNumber(row.outgoingCost),
        0
      ),

      endingStockValue: data.reduce(
        (sum, row) =>
          sum + toNumber(row.endingStockValue),
        0
      ),

      lowStockCount: data.filter(
        (row) => row.status === "LOW"
      ).length,

      habisStockCount: data.filter(
        (row) => row.status === "HABIS"
      ).length,

      safeStockCount: data.filter(
        (row) => row.status === "SAFE"
      ).length,
    };

    /**
     * ========================================================
     * 11. PERIOD
     * ========================================================
     */
    const period = {
      dateFrom: dateFrom.toISOString(),

      dateTo: dateTo.toISOString(),

      dateFromValue:
        dateFrom.toISOString().slice(0, 10),

      dateToValue:
        dateTo.toISOString().slice(0, 10),

      currentMonth:
        dateFrom.getMonth() ===
          new Date().getMonth() &&
        dateFrom.getFullYear() ===
          new Date().getFullYear(),
    };

    /**
     * ========================================================
     * 12. RESPONSE
     * ========================================================
     */
    return NextResponse.json({
      success: true,

      data,

      rows: data,

      summary,

      period,
    });
  } catch (error) {
    console.error(
      "[API /mutasi-stock] ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message: "Gagal mengambil mutasi stock pusat.",

        error:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      {
        status: 500,
      }
    );
  }
}