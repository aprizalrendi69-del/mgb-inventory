import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * CURRENT USER
 * =========================================================
 */

async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session) return null;

  try {
    const data = JSON.parse(session.value);
    return data?.user ?? data;
  } catch {
    return null;
  }
}

/*
 * =========================================================
 * COST CONTROL CATEGORY
 * =========================================================
 */

const COST_CATEGORIES = [
  "VEGETABLES",
  "FRUITS",
  "GROCERIES",
  "PASTRY",
  "FROZEN FOOD",
  "SEAFOOD",
  "CHICKEN & POULTRY",
  "WIP & SOUP",
  "BEVERAGE",
  "MEATS",
  "KITCHEN FUEL",
  "STAFF MEALS",
  "CLEANING SUPPLY",
  "GUEST SUPPLY",
  "PACKAGING",
] as const;

type CostCategory = (typeof COST_CATEGORIES)[number];

/*
 * =========================================================
 * CATEGORY MAPPING
 * =========================================================
 */

function catKey(
  value: string | null | undefined
): CostCategory | null {
  const n = String(value || "")
    .toUpperCase()
    .trim();

  if (!n) return null;

  if (n.includes("VEGET") || n.includes("SAYUR")) {
    return "VEGETABLES";
  }

  if (n.includes("FRUIT") || n.includes("BUAH")) {
    return "FRUITS";
  }

  if (n.includes("GROC")) {
    return "GROCERIES";
  }

  if (n.includes("PASTR") || n.includes("BAKERY")) {
    return "PASTRY";
  }

  if (n.includes("FROZEN")) {
    return "FROZEN FOOD";
  }

  if (n.includes("SEAFOOD") || n.includes("SEA FOOD")) {
    return "SEAFOOD";
  }

  if (
    n.includes("CHICKEN") ||
    n.includes("POULTRY") ||
    n.includes("AYAM")
  ) {
    return "CHICKEN & POULTRY";
  }

  if (n.includes("WIP") || n.includes("SOUP")) {
    return "WIP & SOUP";
  }

  if (n.includes("BEVER") || n.includes("MINUM")) {
    return "BEVERAGE";
  }

  if (n.includes("MEAT") || n.includes("DAGING")) {
    return "MEATS";
  }

  if (
    n.includes("KITCHEN FUEL") ||
    n.includes("KITCHEN") ||
    n.includes("FUEL") ||
    n.includes("GAS")
  ) {
    return "KITCHEN FUEL";
  }

  if (n.includes("STAFF") || n.includes("KARYAWAN")) {
    return "STAFF MEALS";
  }

  if (n.includes("CLEAN")) {
    return "CLEANING SUPPLY";
  }

  if (n.includes("GUEST")) {
    return "GUEST SUPPLY";
  }

  if (n.includes("PACK")) {
    return "PACKAGING";
  }

  return null;
}

/*
 * =========================================================
 * BENCHMARK
 * =========================================================
 */

const BENCHMARKS: Record<string, any> = {
  GANGNAM: {
    food: {
      VEGETABLES: [10, 13, 15],
      FRUITS: [1.5, 2, 3],
      GROCERIES: [10, 13, 15],
      PASTRY: [2, 4, 6],
      "FROZEN FOOD": [2, 4, 6],
      SEAFOOD: [0, 0, 0],
      "CHICKEN & POULTRY": [1, 2, 3],
      "WIP & SOUP": [8, 10, 12],
      BEVERAGE: [5, 7, 10],
      MEATS: [60, 70, 80],
      "KITCHEN FUEL": [0, 0, 0],
      "STAFF MEALS": [0, 0, 0],
      "CLEANING SUPPLY": [0, 0, 0],
      "GUEST SUPPLY": [0, 0, 0],
      PACKAGING: [0, 0, 0],
    },

    sales: {
      VEGETABLES: [5, 7, 10],
      FRUITS: [1, 1.5, 3],
      GROCERIES: [6, 8, 10],
      PASTRY: [1, 1.5, 3],
      "FROZEN FOOD": [1, 1.5, 3],
      SEAFOOD: [0, 0, 0],
      "CHICKEN & POULTRY": [1, 1.5, 3],
      "WIP & SOUP": [4, 6, 8],
      BEVERAGE: [3, 5, 7],
      MEATS: [30, 33, 40],
      "KITCHEN FUEL": [3, 5, 7],
      "STAFF MEALS": [1, 2, 3],
      "CLEANING SUPPLY": [0.5, 0.7, 1],
      "GUEST SUPPLY": [0.5, 0.7, 1],
      PACKAGING: [0.5, 0.7, 1],
    },
  },

  SHUKAGRILL: {
    food: {
      VEGETABLES: [7, 8, 10],
      FRUITS: [2.5, 4, 6],
      GROCERIES: [7, 8, 10],
      PASTRY: [3, 5, 7],
      "FROZEN FOOD": [7, 8, 10],
      SEAFOOD: [3, 5, 7],
      "CHICKEN & POULTRY": [3, 5, 7],
      "WIP & SOUP": [9, 11, 13],
      BEVERAGE: [9, 11, 13],
      MEATS: [50, 60, 70],
      "KITCHEN FUEL": [0, 0, 0],
      "STAFF MEALS": [0, 0, 0],
      "CLEANING SUPPLY": [0, 0, 0],
      "GUEST SUPPLY": [0, 0, 0],
      PACKAGING: [0, 0, 0],
    },

    sales: {
      VEGETABLES: [3.5, 5, 6],
      FRUITS: [2, 3, 5],
      GROCERIES: [3, 5, 6],
      PASTRY: [2, 3, 5],
      "FROZEN FOOD": [2.5, 4, 6],
      SEAFOOD: [2, 3, 5],
      "CHICKEN & POULTRY": [3, 5, 7],
      "WIP & SOUP": [5, 7, 10],
      BEVERAGE: [4, 6, 8],
      MEATS: [25, 27, 30],
      "KITCHEN FUEL": [3, 5, 7],
      "STAFF MEALS": [1, 2, 3],
      "CLEANING SUPPLY": [0.5, 0.7, 1],
      "GUEST SUPPLY": [0.5, 0.7, 1],
      PACKAGING: [0.5, 0.7, 1],
    },
  },
};

/*
 * =========================================================
 * OUTLET KEY
 * =========================================================
 */

function outletKey(name: string) {
  const n = String(name || "").toUpperCase().trim();

  if (n.includes("GANGNAM")) {
    return "GANGNAM";
  }

  if (n.includes("SHUKAGRILL")) {
    return "SHUKAGRILL";
  }

  return "GANGNAM";
}

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function nextDay(date: Date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
}

function num(value: any) {
  const result = Number(value ?? 0);

  return Number.isFinite(result) ? result : 0;
}

function createCategoryMap() {
  const result: Record<string, number> = {};

  for (const category of COST_CATEGORIES) {
    result[category] = 0;
  }

  return result;
}

function addAmount(
  target: Record<string, number>,
  category: string,
  amount: number
) {
  target[category] =
    (target[category] || 0) + num(amount);
}

function benchmarkStatus(
  value: number,
  benchmark: any
) {
  if (!benchmark) return "-";

  const [
    target,
    warning,
    critical,
  ] = benchmark;

  if (
    num(target) === 0 &&
    num(warning) === 0 &&
    num(critical) === 0
  ) {
    return "-";
  }

  if (value >= num(critical)) {
    return "CRITICAL";
  }

  if (value >= num(warning)) {
    return "WARNING";
  }

  return "AMAN";
}

/*
 * =========================================================
 * GET
 * =========================================================
 */

export async function GET(req: NextRequest) {
  try {
    const user: any = await getCurrentUser();

    const { searchParams } = new URL(req.url);

    const month =
      searchParams.get("month") ||
      new Date().toISOString().slice(0, 7);

    const requestedOutlet = Number(
      searchParams.get("outletId") || 0
    );

    /*
     * =======================================================
     * SALES
     * =======================================================
     */

    let salesByOutlet: Record<string, number> = {};

    const salesRaw =
      searchParams.get("salesByOutlet");

    if (salesRaw) {
      try {
        const parsed = JSON.parse(salesRaw);

        if (
          parsed &&
          typeof parsed === "object"
        ) {
          for (const [key, value] of Object.entries(
            parsed
          )) {
            salesByOutlet[key] = num(value);
          }
        }
      } catch {
        salesByOutlet = {};
      }
    }

    const oldNetSales = num(
      searchParams.get("netSales")
    );

    /*
     * =======================================================
     * ACCESS CONTROL
     * =======================================================
     */

    let allowedOutlet = requestedOutlet;

    if (user?.role === "OUTLET_ADMIN") {
      allowedOutlet = num(user?.outletId);

      if (!allowedOutlet) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User belum memiliki outlet",
          },
          { status: 400 }
        );
      }
    }

    /*
     * =======================================================
     * MONTH RANGE
     * =======================================================
     */

    const monthStart = startOfDay(
      new Date(`${month}-01T00:00:00`)
    );

    const monthEnd = new Date(monthStart);

    monthEnd.setMonth(
      monthEnd.getMonth() + 1
    );

    /*
     * =======================================================
     * OUTLETS
     * =======================================================
     */

    const outlets = allowedOutlet
      ? await prisma.outlet.findMany({
          where: {
            id: allowedOutlet,
          },
          orderBy: {
            name: "asc",
          },
        })
      : await prisma.outlet.findMany({
          where: {
            active: true,
          },
          orderBy: {
            name: "asc",
          },
        });

    const results: any[] = [];

    /*
     * =======================================================
     * LOOP OUTLET
     * =======================================================
     */

    for (const outlet of outlets) {
      /*
       * =====================================================
       * MASTER BARANG OUTLET
       * =====================================================
       */

      const outletMaster =
        await prisma.outletBarang.findMany({
          where: {
            outletId: outlet.id,
            aktif: true,
          },
          include: {
            barang: true,
          },
          orderBy: {
            barang: {
              name: "asc",
            },
          },
        });

      const outletBarangIds = new Set(
        outletMaster.map(
          (item) => Number(item.barangId)
        )
      );

      /*
       * =====================================================
       * PRICE MAP
       * =====================================================
       */

      const priceMap = new Map<
        number,
        number
      >();

      for (const master of outletMaster) {
        priceMap.set(
          Number(master.barangId),
          num(
            master.harga ??
              master.barang?.purchasePrice
          )
        );
      }

      /*
       * =====================================================
       * STOCK OPNAME BULAN INI
       * =====================================================
       */

      const opnames =
        await prisma.stockOpname.findMany({
          where: {
            outletId: outlet.id,
            status: "APPROVED",
            date: {
              gte: monthStart,
              lt: monthEnd,
            },
          },

          orderBy: {
            date: "asc",
          },

          include: {
            items: {
              include: {
                barang: true,
              },
            },
          },
        });

      /*
       * =====================================================
       * STOCK OPNAME TERAKHIR SEBELUM BULAN
       * =====================================================
       */

      const previousOpname =
        await prisma.stockOpname.findFirst({
          where: {
            outletId: outlet.id,
            status: "APPROVED",
            date: {
              lt: monthStart,
            },
          },

          orderBy: {
            date: "desc",
          },

          include: {
            items: {
              include: {
                barang: true,
              },
            },
          },
        });

      /*
       * =====================================================
       * RECEIPTS
       * =====================================================
       */

      const receipts =
        await prisma.outletReceipt.findMany({
          where: {
            outletId: outlet.id,
            receiptDate: {
              gte: monthStart,
              lt: monthEnd,
            },
          },

          include: {
            items: {
              include: {
                barang: true,
              },
            },
          },

          orderBy: {
            receiptDate: "asc",
          },
        });

      /*
       * =====================================================
       * PRICE HELPER
       * =====================================================
       */

      function itemPrice(
        barangId: number,
        barang?: any
      ) {
        return (
          priceMap.get(barangId) ??
          num(barang?.purchasePrice)
        );
      }

      /*
       * =====================================================
       * OPENING QTY
       * =====================================================
       */

      const openingQtyMap =
        new Map<number, number>();

      if (previousOpname) {
        for (const item of previousOpname.items || []) {
          const barangId =
            Number(item.barangId);

          if (
            !outletBarangIds.has(barangId)
          ) {
            continue;
          }

          openingQtyMap.set(
            barangId,
            num(item.physicalQty)
          );
        }
      } else if (opnames.length > 0) {
        /*
         * Jika belum ada SO sebelum bulan,
         * gunakan systemQty pada SO pertama
         * sebagai opening.
         */
        const firstOpname = opnames[0];

        for (const item of firstOpname.items || []) {
          const barangId =
            Number(item.barangId);

          if (
            !outletBarangIds.has(barangId)
          ) {
            continue;
          }

          openingQtyMap.set(
            barangId,
            num(item.systemQty)
          );
        }
      }

      /*
       * =====================================================
       * WEEKLY
       * =====================================================
       */

      const weeks: any[] = [];

      for (
        let index = 0;
        index < opnames.length;
        index++
      ) {
        const so = opnames[index];

        const openingByCat =
          createCategoryMap();

        const purchaseByCat =
          createCategoryMap();

        const endingByCat =
          createCategoryMap();

        const wasteByCat =
          createCategoryMap();

        /*
         * ---------------------------------------------------
         * OPENING
         * ---------------------------------------------------
         */

        for (const [
          barangId,
          qty,
        ] of openingQtyMap.entries()) {
          const master =
            outletMaster.find(
              (item) =>
                Number(item.barangId) ===
                barangId
            );

          if (!master) continue;

          const category = catKey(
            master.barang?.category
          );

          if (!category) continue;

          const price = itemPrice(
            barangId,
            master.barang
          );

          addAmount(
            openingByCat,
            category,
            qty * price
          );
        }

        /*
         * ---------------------------------------------------
         * ENDING + WASTE
         * ---------------------------------------------------
         */

        const currentSnapshot =
          new Map<number, number>();

        for (const item of so.items || []) {
          const barangId =
            Number(item.barangId);

          if (
            !outletBarangIds.has(
              barangId
            )
          ) {
            continue;
          }

          const master =
            outletMaster.find(
              (x) =>
                Number(x.barangId) ===
                barangId
            );

          const barang =
            master?.barang ??
            item.barang;

          const category = catKey(
            barang?.category
          );

          if (!category) continue;

          const price = itemPrice(
            barangId,
            barang
          );

          const physicalQty =
            num(item.physicalQty);

          const difference =
            num(item.difference);

          currentSnapshot.set(
            barangId,
            physicalQty
          );

          addAmount(
            endingByCat,
            category,
            physicalQty * price
          );

          /*
           * Difference negatif =
           * actual lebih kecil dari system.
           */
          if (difference < 0) {
            addAmount(
              wasteByCat,
              category,
              Math.abs(difference) *
                price
            );
          }
        }

        /*
         * ---------------------------------------------------
         * PURCHASE / RECEIPT
         * ---------------------------------------------------
         */

        const periodStart =
          index === 0
            ? monthStart
            : nextDay(
                opnames[index - 1].date
              );

        const periodEnd =
          nextDay(so.date);

        for (const receipt of receipts) {
          const receiptDate =
            new Date(
              receipt.receiptDate
            );

          if (
            receiptDate < periodStart ||
            receiptDate >= periodEnd
          ) {
            continue;
          }

          for (const item of receipt.items || []) {
            const barangId =
              Number(item.barangId);

            if (
              !outletBarangIds.has(
                barangId
              )
            ) {
              continue;
            }

            const master =
              outletMaster.find(
                (x) =>
                  Number(x.barangId) ===
                  barangId
              );

            const barang =
              master?.barang ??
              item.barang;

            const category = catKey(
              barang?.category
            );

            if (!category) continue;

            /*
             * Gunakan subtotal receipt.
             */
            addAmount(
              purchaseByCat,
              category,
              num(item.subtotal)
            );
          }
        }

        /*
         * ---------------------------------------------------
         * ROWS
         * ---------------------------------------------------
         */

        const rows =
          COST_CATEGORIES.map(
            (category) => {
              const opening = num(
                openingByCat[category]
              );

              const purchase = num(
                purchaseByCat[category]
              );

              const ending = num(
                endingByCat[category]
              );

              const waste = num(
                wasteByCat[category]
              );

              /*
               * Cost of Sale:
               *
               * Opening
               * + Purchase
               * - Ending
               */
              const cost = Math.max(
                0,
                opening +
                  purchase -
                  ending
              );

              return {
                category,
                opening,
                purchase,
                ending,
                waste,
                cost,
              };
            }
          );

        /*
         * ---------------------------------------------------
         * SALES
         * ---------------------------------------------------
         */

        const outletSales =
          salesByOutlet[
            String(outlet.id)
          ] ??
          (allowedOutlet
            ? oldNetSales
            : 0);

        /*
         * ---------------------------------------------------
         * TOTAL
         * ---------------------------------------------------
         */

        const totals =
          rows.reduce(
            (acc, row) => ({
              opening:
                acc.opening +
                row.opening,

              purchase:
                acc.purchase +
                row.purchase,

              ending:
                acc.ending +
                row.ending,

              waste:
                acc.waste +
                row.waste,

              cost:
                acc.cost +
                row.cost,
            }),
            {
              opening: 0,
              purchase: 0,
              ending: 0,
              waste: 0,
              cost: 0,
            }
          );

        const weeklyFoodCost =
          outletSales > 0
            ? (totals.cost /
                outletSales) *
              100
            : 0;

        /*
         * ---------------------------------------------------
         * BENCHMARK
         * ---------------------------------------------------
         */

        const benchmarkKey =
          outletKey(outlet.name);

        const benchmarkRows =
          rows.map((row) => {
            const foodBenchmark =
              BENCHMARKS[
                benchmarkKey
              ]?.food?.[
                row.category
              ] ?? null;

            const salesBenchmark =
              BENCHMARKS[
                benchmarkKey
              ]?.sales?.[
                row.category
              ] ?? null;

            const ratioFoodCost =
              totals.cost > 0
                ? (row.cost /
                    totals.cost) *
                  100
                : 0;

            const ratioToSales =
              outletSales > 0
                ? (row.cost /
                    outletSales) *
                  100
                : 0;

            return {
              ...row,

              ratioFoodCost,

              ratioToSales,

              foodBenchmark,

              salesBenchmark,

              foodStatus:
                benchmarkStatus(
                  ratioFoodCost,
                  foodBenchmark
                ),

              salesStatus:
                benchmarkStatus(
                  ratioToSales,
                  salesBenchmark
                ),
            };
          });

        /*
         * ---------------------------------------------------
         * NEXT OPENING
         * ---------------------------------------------------
         */

        openingQtyMap.clear();

        for (const [
          barangId,
          qty,
        ] of currentSnapshot.entries()) {
          openingQtyMap.set(
            barangId,
            qty
          );
        }

        weeks.push({
          id: so.id,
          code: so.code,
          date: so.date,
          periodStart,
          periodEnd,

          rows: benchmarkRows,

          totals: {
            ...totals,

            foodCost:
              weeklyFoodCost,

            ratioToSales:
              weeklyFoodCost,
          },
        });
      }

      /*
       * =====================================================
       * MONTHLY
       * =====================================================
       */

      const monthlyOpening =
        weeks.length > 0
          ? weeks[0].totals.opening
          : 0;

      const monthlyEnding =
        weeks.length > 0
          ? weeks[
              weeks.length - 1
            ].totals.ending
          : 0;

      const monthlyPurchase =
        weeks.reduce(
          (sum, week) =>
            sum +
            week.totals.purchase,
          0
        );

      const monthlyWaste =
        weeks.reduce(
          (sum, week) =>
            sum +
            week.totals.waste,
          0
        );

      const monthlyCost =
        Math.max(
          0,
          monthlyOpening +
            monthlyPurchase -
            monthlyEnding
        );

      /*
       * =====================================================
       * MONTHLY SALES
       * =====================================================
       */

      const outletNetSales =
        salesByOutlet[
          String(outlet.id)
        ] ??
        (allowedOutlet
          ? oldNetSales
          : 0);

      const foodCost =
        outletNetSales > 0
          ? (monthlyCost /
              outletNetSales) *
            100
          : 0;

      /*
       * =====================================================
       * RESULT
       * =====================================================
       */

      results.push({
        outlet,

        benchmark:
          outletKey(outlet.name),

        benchmarks:
          BENCHMARKS[
            outletKey(outlet.name)
          ],

        opnameCount:
          opnames.length,

        masterBarangCount:
          outletMaster.length,

        masterCategories:
          Array.from(
            new Set(
              outletMaster
                .map((item) =>
                  catKey(
                    item.barang?.category
                  )
                )
                .filter(
                  (
                    value
                  ): value is CostCategory =>
                    Boolean(value)
                )
            )
          ),

        weeks,

        monthly: {
          opening:
            monthlyOpening,

          purchase:
            monthlyPurchase,

          ending:
            monthlyEnding,

          waste:
            monthlyWaste,

          cost:
            monthlyCost,

          netSales:
            outletNetSales,

          foodCost,

          ratioToSales:
            foodCost,
        },
      });
    }

    /*
     * =======================================================
     * TOTAL ALL OUTLET
     * =======================================================
     */

    const monthly =
      results.reduce(
        (acc, outlet) => ({
          opening:
            acc.opening +
            outlet.monthly.opening,

          purchase:
            acc.purchase +
            outlet.monthly.purchase,

          ending:
            acc.ending +
            outlet.monthly.ending,

          waste:
            acc.waste +
            outlet.monthly.waste,

          cost:
            acc.cost +
            outlet.monthly.cost,

          netSales:
            acc.netSales +
            outlet.monthly.netSales,
        }),
        {
          opening: 0,
          purchase: 0,
          ending: 0,
          waste: 0,
          cost: 0,
          netSales: 0,
        }
      );

    const monthlyFoodCost =
      monthly.netSales > 0
        ? (monthly.cost /
            monthly.netSales) *
          100
        : 0;

    /*
     * =======================================================
     * RESPONSE
     * =======================================================
     */

    return NextResponse.json({
      success: true,

      data: {
        month,

        allOutlets:
          !allowedOutlet,

        outlets: results,

        monthly: {
          opening:
            monthly.opening,

          purchase:
            monthly.purchase,

          ending:
            monthly.ending,

          waste:
            monthly.waste,

          cost:
            monthly.cost,

          netSales:
            monthly.netSales,

          foodCost:
            monthlyFoodCost,

          ratioToSales:
            monthlyFoodCost,
        },
      },
    });
  } catch (error) {
    console.error(
      "COST CONTROL ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Gagal mengambil data Cost Control",

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}