import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/**
 * ============================================================
 * /api/inventory
 * ============================================================
 *
 * LAPORAN STOCK PUSAT / CENTRAL
 *
 * KONTRAK PERHITUNGAN:
 *
 * 1. Default periode = bulan berjalan.
 *
 * 2. Stock Awal bulan:
 *    = physicalQty dari StockOpname APPROVED
 *      bulan kalender sebelumnya.
 *
 *    BUKAN:
 *    - Barang.stock
 *    - Inventory.stock
 *    - systemQty opname
 *
 * 3. Barang Masuk:
 *    = StockCard.qtyIn pada bulan yang dipilih
 *      dan warehouse MAIN.
 *
 * 4. Barang Keluar:
 *    = StockCard.qtyOut pada bulan yang dipilih
 *      dan warehouse MAIN.
 *
 * 5. Ending bulan:
 *
 *    BULAN BERJALAN:
 *      = Inventory.stock live.
 *
 *    BULAN LAMPAU:
 *      = Stock Awal + Masuk - Keluar
 *
 * 6. Stock Opname pada bulan yang sedang dilihat
 *    TIDAK dipakai sebagai ending stock bulan tersebut.
 *
 *    Contoh:
 *
 *    September:
 *      opening = opname APPROVED Agustus
 *      masuk   = StockCard September
 *      keluar  = StockCard September
 *      ending  = opening + masuk - keluar
 *
 *    Oktober:
 *      opening = opname APPROVED September
 *      masuk   = StockCard Oktober
 *      keluar  = StockCard Oktober
 *      ending  = Inventory.stock live
 *
 * 7. Tidak ada mutation database.
 * 8. Tidak ada reset database.
 * 9. Tidak ada delete/update data.
 * 10. Hanya CENTRAL + active Barang.
 *
 * ============================================================
 */

type CurrentUser = {
  id: number;
  username: string;
  fullname: string;
  role: string;
  outletId?: number | null;
};

const ALLOWED_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "PURCHASING",
  "GUDANG",
]);

const EPSILON = 0.0000001;

/**
 * ============================================================
 * CURRENT USER
 * ============================================================
 */
async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("erp-session");

    if (!session?.value) {
      return null;
    }

    let sessionData: any;

    try {
      sessionData = JSON.parse(session.value);
    } catch {
      return null;
    }

    if (!sessionData) {
      return null;
    }

    const userId = Number(
      sessionData.userId ??
        sessionData.id ??
        sessionData.user?.id ??
        0,
    );

    if (!Number.isFinite(userId) || userId <= 0) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        username: true,
        fullname: true,
        role: true,
        outletId: true,
        active: true,
      },
    });

    if (!user || !user.active) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/**
 * ============================================================
 * DATE HELPERS
 * ============================================================
 *
 * Kita sengaja menggunakan local calendar date untuk laporan
 * karena bisnis berada pada timezone Asia/Jakarta.
 *
 * Query DateTime Prisma kemudian memakai batas:
 *
 * >= start
 * < end
 *
 * sehingga tidak bergantung pada jam 23:59:59.999.
 * ============================================================
 */

function getJakartaParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const year = Number(
    parts.find((part) => part.type === "year")?.value ?? 0,
  );

  const month = Number(
    parts.find((part) => part.type === "month")?.value ?? 0,
  );

  const day = Number(
    parts.find((part) => part.type === "day")?.value ?? 0,
  );

  return {
    year,
    month,
    day,
  };
}

/**
 * Membuat Date UTC yang mewakili awal hari Jakarta.
 *
 * Contoh:
 * 2026-10-01 00:00 Jakarta
 * menjadi 2026-09-30T17:00:00.000Z
 */
function jakartaDate(
  year: number,
  month: number,
  day: number,
): Date {
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      -7,
      0,
      0,
      0,
    ),
  );
}

function getMonthRange(
  year: number,
  month: number,
) {
  const start = jakartaDate(year, month, 1);

  let nextYear = year;
  let nextMonth = month + 1;

  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  const end = jakartaDate(nextYear, nextMonth, 1);

  return {
    start,
    end,
  };
}

function getPreviousMonth(
  year: number,
  month: number,
) {
  if (month === 1) {
    return {
      year: year - 1,
      month: 12,
    };
  }

  return {
    year,
    month: month - 1,
  };
}

function getMonthLabel(
  year: number,
  month: number,
) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(
    jakartaDate(year, month, 1),
  );
}

function roundNumber(
  value: number,
  digits = 4,
) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = Math.pow(10, digits);

  return Math.round(
    (value + Number.EPSILON) * factor,
  ) / factor;
}

/**
 * ============================================================
 * STOCK STATUS
 * ============================================================
 */
function getStockStatus(
  stock: number,
  minimumStock: number,
) {
  if (stock <= EPSILON) {
    return {
      code: "HABIS",
      label: "HABIS",
    };
  }

  if (
    minimumStock > 0 &&
    stock <= minimumStock
  ) {
    return {
      code: "MENIPIS",
      label: "MENIPIS",
    };
  }

  return {
    code: "AMAN",
    label: "AMAN",
  };
}

/**
 * ============================================================
 * COST HELPERS
 * ============================================================
 *
 * Cost utama:
 *   Inventory.averageCost
 *
 * Bila tidak tersedia / 0:
 *   MasterHarga.average informasi tidak tersedia,
 *   sehingga fallback ke:
 *      Barang.purchasePrice
 *
 * MasterHarga bukan snapshot stok, jadi tidak dipakai
 * untuk menghitung quantity.
 * ============================================================
 */

function safeCost(
  averageCost: number,
  purchasePrice: number,
) {
  if (
    Number.isFinite(averageCost) &&
    averageCost > EPSILON
  ) {
    return averageCost;
  }

  if (
    Number.isFinite(purchasePrice) &&
    purchasePrice > EPSILON
  ) {
    return purchasePrice;
  }

  return 0;
}

/**
 * ============================================================
 * MAIN GET
 * ============================================================
 */
export async function GET(
  request: NextRequest,
) {
  try {
    /**
     * --------------------------------------------------------
     * AUTH
     * --------------------------------------------------------
     */
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    if (!ALLOWED_ROLES.has(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message: "Anda tidak memiliki akses ke laporan inventory pusat.",
        },
        {
          status: 403,
        },
      );
    }

    /**
     * --------------------------------------------------------
     * QUERY PARAMS
     *
     * month:
     *   1 - 12
     *
     * year:
     *   YYYY
     *
     * search:
     *   nama / kode / barcode
     *
     * category:
     *   category Barang
     * --------------------------------------------------------
     */
    const searchParams = request.nextUrl.searchParams;

    const nowParts = getJakartaParts();

    const requestedYear = Number(
      searchParams.get("year") ?? nowParts.year,
    );

    const requestedMonth = Number(
      searchParams.get("month") ?? nowParts.month,
    );

    const year =
      Number.isFinite(requestedYear) &&
      requestedYear >= 2000 &&
      requestedYear <= 2100
        ? requestedYear
        : nowParts.year;

    const month =
      Number.isFinite(requestedMonth) &&
      requestedMonth >= 1 &&
      requestedMonth <= 12
        ? requestedMonth
        : nowParts.month;

    const search =
      (
        searchParams.get("search") ??
        ""
      ).trim();

    const category =
      (
        searchParams.get("category") ??
        ""
      ).trim();

    /**
     * --------------------------------------------------------
     * PERIOD
     * --------------------------------------------------------
     */
    const currentMonth =
      year === nowParts.year &&
      month === nowParts.month;

    const monthRange =
      getMonthRange(
        year,
        month,
      );

    const previous =
      getPreviousMonth(
        year,
        month,
      );

    const previousMonthRange =
      getMonthRange(
        previous.year,
        previous.month,
      );

    /**
     * --------------------------------------------------------
     * 1. BARANG CENTRAL
     *
     * Jangan mengambil Barang OUTLET.
     * Jangan mengambil inactive.
     * --------------------------------------------------------
     */
    const barangWhere: any = {
      source: "CENTRAL",
      active: true,
    };

    if (category) {
      barangWhere.category = category;
    }

    if (search) {
      barangWhere.OR = [
        {
          name: {
            contains: search,
          },
        },
        {
          code: {
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

    const barangs =
      await prisma.barang.findMany({
        where: barangWhere,
        orderBy: [
          {
            category: "asc",
          },
          {
            name: "asc",
          },
        ],
        select: {
          id: true,
          code: true,
          barcode: true,
          name: true,
          category: true,
          brand: true,
          unit: true,
          baseUnit: true,
          conversionRate: true,
          minimumStock: true,
          stock: true,
          purchasePrice: true,
          active: true,

          inventory: {
            select: {
              stock: true,
              reservedStock: true,
              availableStock: true,
              minimumStock: true,
              maximumStock: true,
              lastPurchase: true,
              averageCost: true,
              updatedAt: true,
            },
          },
        },
      });

    /**
     * --------------------------------------------------------
     * 2. STOCK OPNAME APPROVED BULAN SEBELUMNYA
     *
     * PENTING:
     *
     * Kita hanya mengambil:
     *
     *   outletId = null
     *   status = APPROVED
     *   date >= awal bulan sebelumnya
     *   date <  awal bulan berjalan
     *
     * Karena laporan ini khusus CENTRAL.
     *
     * Jika ada beberapa opname APPROVED dalam bulan tersebut,
     * kita menggunakan opname TERAKHIR berdasarkan date.
     *
     * BUKAN systemQty.
     * Yang menjadi opening adalah physicalQty.
     * --------------------------------------------------------
     */
    const previousApprovedOpname =
      await prisma.stockOpname.findFirst({
        where: {
          outletId: null,
          status: "APPROVED",
          date: {
            gte: previousMonthRange.start,
            lt: monthRange.start,
          },
        },
        orderBy: [
          {
            date: "desc",
          },
          {
            id: "desc",
          },
        ],
        select: {
          id: true,
          code: true,
          date: true,
          status: true,
          type: true,
          items: {
            select: {
              barangId: true,
              physicalQty: true,
            },
          },
        },
      });

    /**
     * Map:
     * barangId -> physicalQty
     */
    const openingByBarang =
      new Map<number, number>();

    if (previousApprovedOpname) {
      for (
        const item of previousApprovedOpname.items
      ) {
        openingByBarang.set(
          item.barangId,
          Number(item.physicalQty) || 0,
        );
      }
    }

    /**
     * --------------------------------------------------------
     * 3. STOCK CARD BULAN TERPILIH
     *
     * Hanya warehouse MAIN.
     *
     * StockCard adalah ledger movement pusat:
     *
     *   qtyIn  = barang masuk
     *   qtyOut = barang keluar
     *
     * Kita TIDAK menggunakan balance StockCard sebagai
     * stock awal/ending karena kontrak laporan ini memakai
     * Stock Opname sebagai snapshot opening.
     * --------------------------------------------------------
     */
    const stockCards =
      await prisma.stockCard.findMany({
        where: {
          warehouse: "MAIN",
          trxDate: {
            gte: monthRange.start,
            lt: monthRange.end,
          },
        },
        select: {
          id: true,
          barangId: true,
          trxDate: true,
          trxType: true,
          trxNumber: true,
          referenceId: true,
          qtyIn: true,
          qtyOut: true,
          balance: true,
          unitPrice: true,
          totalValue: true,
          note: true,
        },
        orderBy: [
          {
            trxDate: "asc",
          },
          {
            id: "asc",
          },
        ],
      });

    /**
     * --------------------------------------------------------
     * 4. AGGREGASI MUTASI BULAN
     * --------------------------------------------------------
     */
    const movementByBarang =
      new Map<
        number,
        {
          qtyIn: number;
          qtyOut: number;
          valueIn: number;
          valueOut: number;
          transactionCount: number;
          firstDate: Date | null;
          lastDate: Date | null;
        }
      >();

    for (
      const card of stockCards
    ) {
      const barangId =
        Number(card.barangId);

      if (!movementByBarang.has(barangId)) {
        movementByBarang.set(
          barangId,
          {
            qtyIn: 0,
            qtyOut: 0,
            valueIn: 0,
            valueOut: 0,
            transactionCount: 0,
            firstDate: null,
            lastDate: null,
          },
        );
      }

      const aggregate =
        movementByBarang.get(
          barangId,
        )!;

      const qtyIn =
        Number(card.qtyIn) || 0;

      const qtyOut =
        Number(card.qtyOut) || 0;

      const totalValue =
        Number(card.totalValue) || 0;

      aggregate.qtyIn += qtyIn;
      aggregate.qtyOut += qtyOut;

      /**
       * Untuk cost movement:
       *
       * qtyIn  -> totalValue positif
       * qtyOut -> totalValue sebagai nilai keluar
       *
       * Karena StockCard tidak memiliki dua field value,
       * kita menggunakan totalValue dan unitPrice.
       */
      if (qtyIn > EPSILON) {
        aggregate.valueIn +=
          Math.abs(totalValue);
      }

      if (qtyOut > EPSILON) {
        const qtyForValue =
          qtyOut > EPSILON
            ? qtyOut
            : 0;

        const unitPrice =
          Number(card.unitPrice) || 0;

        aggregate.valueOut +=
          unitPrice > EPSILON
            ? Math.abs(
                unitPrice * qtyForValue,
              )
            : 0;
      }

      aggregate.transactionCount += 1;

      if (
        !aggregate.firstDate ||
        card.trxDate <
          aggregate.firstDate
      ) {
        aggregate.firstDate =
          card.trxDate;
      }

      if (
        !aggregate.lastDate ||
        card.trxDate >
          aggregate.lastDate
      ) {
        aggregate.lastDate =
          card.trxDate;
      }
    }

    /**
     * --------------------------------------------------------
     * 5. CURRENT LIVE INVENTORY
     *
     * Hanya diperlukan untuk ending bulan berjalan.
     *
     * Ini sengaja TIDAK digunakan untuk opening.
     * --------------------------------------------------------
     */

    /**
     * --------------------------------------------------------
     * 6. HASIL
     * --------------------------------------------------------
     */
    const rows = barangs.map(
      (barang) => {
        const movement =
          movementByBarang.get(
            barang.id,
          );

        const qtyIn =
          movement?.qtyIn ?? 0;

        const qtyOut =
          movement?.qtyOut ?? 0;

        /**
         * ----------------------------------------------------
         * STOCK AWAL
         *
         * SELALU dari opname APPROVED bulan sebelumnya.
         *
         * Jika item tidak ada dalam opname sebelumnya:
         * opening = 0
         *
         * Tidak pernah:
         *   Barang.stock
         *   Inventory.stock
         * ----------------------------------------------------
         */
        const stockAwal =
          openingByBarang.get(
            barang.id,
          ) ?? 0;

        /**
         * ----------------------------------------------------
         * ENDING CALCULATION
         * ----------------------------------------------------
         */
        const calculatedEnding =
          stockAwal +
          qtyIn -
          qtyOut;

        /**
         * Untuk bulan berjalan:
         *
         * ending = live Inventory.stock
         *
         * Inventory.stock hanya dipakai di sini.
         */
        const liveInventoryStock =
          Number(
            barang.inventory?.stock ??
              barang.stock ??
              0,
          );

        const endingStock =
          currentMonth
            ? liveInventoryStock
            : calculatedEnding;

        /**
         * ----------------------------------------------------
         * COST
         * ----------------------------------------------------
         */
        const averageCost =
          safeCost(
            Number(
              barang.inventory
                ?.averageCost ?? 0,
            ),
            Number(
              barang.purchasePrice ?? 0,
            ),
          );

        const openingValue =
          stockAwal *
          averageCost;

        const endingValue =
          endingStock *
          averageCost;

        /**
         * Cost barang masuk:
         *
         * Prioritas dari StockCard valueIn.
         * Jika tidak tersedia, gunakan average cost.
         */
        const calculatedInValue =
          movement?.valueIn ?? 0;

        const masukCost =
          calculatedInValue > EPSILON
            ? calculatedInValue
            : qtyIn * averageCost;

        /**
         * Cost barang keluar:
         *
         * Prioritas StockCard unitPrice.
         * Jika tidak tersedia, gunakan average cost.
         */
        const calculatedOutValue =
          movement?.valueOut ?? 0;

        const keluarCost =
          calculatedOutValue > EPSILON
            ? calculatedOutValue
            : qtyOut * averageCost;

        /**
         * ----------------------------------------------------
         * COST PERIOD
         *
         * Cost bersih berdasarkan movement:
         *
         * masuk cost - keluar cost
         *
         * Ini bukan HPP penjualan.
         * Ini adalah nilai mutasi inventory.
         * ----------------------------------------------------
         */
        const netCost =
          masukCost -
          keluarCost;

        /**
         * ----------------------------------------------------
         * STATUS
         * ----------------------------------------------------
         */
        const minimumStock =
          Number(
            barang.inventory
              ?.minimumStock ??
              barang.minimumStock ??
              0,
          );

        const status =
          getStockStatus(
            endingStock,
            minimumStock,
          );

        /**
         * ----------------------------------------------------
         * PERCENTASE COST
         *
         * Persentase cost bulan ini dibanding opening value.
         *
         * Jika opening value 0:
         *   0
         *
         * Agar tidak menghasilkan Infinity / NaN.
         * ----------------------------------------------------
         */
        const costPercentage =
          Math.abs(openingValue) >
          EPSILON
            ? (
                (netCost /
                  Math.abs(
                    openingValue,
                  )) *
                100
              )
            : 0;

        return {
          id: barang.id,

          code: barang.code,

          barcode:
            barang.barcode ?? null,

          name: barang.name,

          category:
            barang.category ?? "-",

          brand:
            barang.brand ?? "-",

          unit:
            barang.baseUnit ??
            barang.unit ??
            "-",

          purchaseUnit:
            barang.unit ?? "-",

          baseUnit:
            barang.baseUnit ??
            barang.unit ??
            "-",

          conversionRate:
            Number(
              barang.conversionRate ?? 1,
            ),

          /**
           * ----------------------------------------------
           * STOCK
           * ----------------------------------------------
           */
          stockAwal: roundNumber(
            stockAwal,
          ),

          barangMasuk: roundNumber(
            qtyIn,
          ),

          barangKeluar: roundNumber(
            qtyOut,
          ),

          endingStock: roundNumber(
            endingStock,
          ),

          /**
           * Nilai kalkulasi berdasarkan
           * opening + movement.
           *
           * Untuk current month, ini tetap dikembalikan
           * agar frontend dapat melihat rekonsiliasi.
           */
          calculatedEndingStock:
            roundNumber(
              calculatedEnding,
            ),

          /**
           * Selisih antara ending live dan
           * hasil opening + movement.
           *
           * Ini berguna untuk menemukan data yang
           * tidak masuk StockCard.
           */
          stockDifference:
            currentMonth
              ? roundNumber(
                  liveInventoryStock -
                    calculatedEnding,
                )
              : 0,

          /**
           * ----------------------------------------------
           * COST
           * ----------------------------------------------
           */
          averageCost: roundNumber(
            averageCost,
            2,
          ),

          openingValue: roundNumber(
            openingValue,
            2,
          ),

          masukCost: roundNumber(
            masukCost,
            2,
          ),

          keluarCost: roundNumber(
            keluarCost,
            2,
          ),

          netCost: roundNumber(
            netCost,
            2,
          ),

          endingValue: roundNumber(
            endingValue,
            2,
          ),

          costPercentage:
            roundNumber(
              costPercentage,
              2,
            ),

          /**
           * ----------------------------------------------
           * STATUS
           * ----------------------------------------------
           */
          minimumStock:
            roundNumber(
              minimumStock,
            ),

          status: status.code,

          statusLabel:
            status.label,

          /**
           * ----------------------------------------------
           * LIVE INVENTORY INFO
           * ----------------------------------------------
           */
          liveStock:
            roundNumber(
              liveInventoryStock,
            ),

          reservedStock:
            roundNumber(
              Number(
                barang.inventory
                  ?.reservedStock ?? 0,
              ),
            ),

          availableStock:
            roundNumber(
              Number(
                barang.inventory
                  ?.availableStock ??
                  liveInventoryStock,
              ),
            ),

          /**
           * ----------------------------------------------
           * MOVEMENT INFO
           * ----------------------------------------------
           */
          transactionCount:
            movement?.transactionCount ??
            0,

          firstTransactionDate:
            movement?.firstDate ??
            null,

          lastTransactionDate:
            movement?.lastDate ??
            null,
        };
      },
    );

    /**
     * --------------------------------------------------------
     * 7. MONTH SUMMARY
     * --------------------------------------------------------
     */
    const summary = rows.reduce(
      (
        accumulator,
        row,
      ) => {
        accumulator.totalItems += 1;

        accumulator.stockAwal +=
          row.stockAwal;

        accumulator.barangMasuk +=
          row.barangMasuk;

        accumulator.barangKeluar +=
          row.barangKeluar;

        accumulator.endingStock +=
          row.endingStock;

        accumulator.openingValue +=
          row.openingValue;

        accumulator.masukCost +=
          row.masukCost;

        accumulator.keluarCost +=
          row.keluarCost;

        accumulator.netCost +=
          row.netCost;

        accumulator.endingValue +=
          row.endingValue;

        if (
          row.status === "HABIS"
        ) {
          accumulator.habis += 1;
        }

        if (
          row.status === "MENIPIS"
        ) {
          accumulator.menipis += 1;
        }

        if (
          row.status === "AMAN"
        ) {
          accumulator.aman += 1;
        }

        return accumulator;
      },
      {
        totalItems: 0,

        stockAwal: 0,
        barangMasuk: 0,
        barangKeluar: 0,
        endingStock: 0,

        openingValue: 0,
        masukCost: 0,
        keluarCost: 0,
        netCost: 0,
        endingValue: 0,

        habis: 0,
        menipis: 0,
        aman: 0,
      },
    );

    /**
     * --------------------------------------------------------
     * 8. SUMMARY COST PERCENTAGE
     * --------------------------------------------------------
     */
    const summaryCostPercentage =
      Math.abs(
        summary.openingValue,
      ) > EPSILON
        ? (
            (summary.netCost /
              Math.abs(
                summary.openingValue,
              )) *
            100
          )
        : 0;

    /**
     * --------------------------------------------------------
     * 9. CATEGORY LIST
     *
     * Dipakai frontend untuk dropdown filter.
     * --------------------------------------------------------
     */
    const categoryRows =
      await prisma.barang.findMany({
        where: {
          source: "CENTRAL",
          active: true,
          category: {
            not: null,
          },
        },
        select: {
          category: true,
        },
        distinct: [
          "category",
        ],
        orderBy: {
          category: "asc",
        },
      });

    const categories =
      categoryRows
        .map(
          (row) =>
            row.category?.trim() ?? "",
        )
        .filter(Boolean);

    /**
     * --------------------------------------------------------
     * 10. RESPONSE
     * --------------------------------------------------------
     */
    return NextResponse.json({
      success: true,

      data: rows,

      rows,

      summary: {
        ...summary,

        stockAwal:
          roundNumber(
            summary.stockAwal,
          ),

        barangMasuk:
          roundNumber(
            summary.barangMasuk,
          ),

        barangKeluar:
          roundNumber(
            summary.barangKeluar,
          ),

        endingStock:
          roundNumber(
            summary.endingStock,
          ),

        openingValue:
          roundNumber(
            summary.openingValue,
            2,
          ),

        masukCost:
          roundNumber(
            summary.masukCost,
            2,
          ),

        keluarCost:
          roundNumber(
            summary.keluarCost,
            2,
          ),

        netCost:
          roundNumber(
            summary.netCost,
            2,
          ),

        endingValue:
          roundNumber(
            summary.endingValue,
            2,
          ),

        costPercentage:
          roundNumber(
            summaryCostPercentage,
            2,
          ),
      },

      period: {
        year,
        month,

        label:
          getMonthLabel(
            year,
            month,
          ),

        start:
          monthRange.start,

        end:
          monthRange.end,

        currentMonth,

        isHistorical:
          !currentMonth,
      },

      opening: {
        source:
          previousApprovedOpname
            ? "STOCK_OPNAME_APPROVED"
            : "NONE",

        opnameId:
          previousApprovedOpname
            ?.id ?? null,

        opnameCode:
          previousApprovedOpname
            ?.code ?? null,

        opnameDate:
          previousApprovedOpname
            ?.date ?? null,

        status:
          previousApprovedOpname
            ?.status ?? null,

        sourceMonth:
          getMonthLabel(
            previous.year,
            previous.month,
          ),

        itemCount:
          previousApprovedOpname
            ?.items.length ?? 0,
      },

      ending: {
        source: currentMonth
          ? "INVENTORY_LIVE"
          : "OPENING_PLUS_MONTH_MOVEMENT",

        formula: currentMonth
          ? "Inventory.stock"
          : "StockOpname.previousApproved.physicalQty + StockCard.qtyIn - StockCard.qtyOut",
      },

      movement: {
        source: "StockCard",

        warehouse: "MAIN",

        transactionCount:
          stockCards.length,

        dateFrom:
          monthRange.start,

        dateTo:
          monthRange.end,
      },

      filters: {
        year,
        month,
        search,
        category,
      },

      categories,
    });
  } catch (error: any) {
    console.error(
      "[/api/inventory] GET ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil data inventory pusat.",
        error:
          process.env.NODE_ENV === "development"
            ? String(
                error?.message ??
                  error,
              )
            : undefined,
      },
      {
        status: 500,
      },
    );
  }
}