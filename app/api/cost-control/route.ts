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

  if (!session) {
    return null;
  }

  try {
    const data = JSON.parse(session.value);

    return data?.user ?? data;
  } catch {
    return null;
  }
}

/*
 * =========================================================
 * ROLE
 * =========================================================
 */

function normalizeRole(value: any) {
  return String(value ?? "")
    .toUpperCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

function isOutletAdmin(user: any) {
  const role = normalizeRole(user?.role);

  return (
    role === "OUTLET_ADMIN" ||
    role === "ADMIN_OUTLET"
  );
}

function isCentralAdmin(user: any) {
  const role = normalizeRole(user?.role);

  return (
    role === "ADMIN" ||
    role === "CENTRAL_ADMIN" ||
    role === "ADMIN_PUSAT"
  );
}

/*
 * =========================================================
 * RESOLVE USER OUTLET
 * =========================================================
 *
 * Prioritas:
 *
 * 1. session.user.outletId
 * 2. session.outletId
 * 3. session.user.outlet.id
 * 4. database User.outletId
 *
 * KHUSUS OUTLET ADMIN:
 *
 * outletId dari query TIDAK PERNAH dipercaya.
 * Outlet selalu berasal dari user/session/database.
 * =========================================================
 */

async function resolveUserOutletId(user: any) {
  const sessionOutletId = Number(
    user?.outletId ??
      user?.outlet?.id ??
      user?.outletIdValue ??
      0
  );

  if (
    Number.isInteger(sessionOutletId) &&
    sessionOutletId > 0
  ) {
    return sessionOutletId;
  }

  /*
   * FALLBACK DATABASE
   */

  const possibleUserId = Number(
    user?.id ??
      user?.userId ??
      user?.user_id ??
      0
  );

  if (
    !Number.isInteger(possibleUserId) ||
    possibleUserId <= 0
  ) {
    return 0;
  }

  try {
    const dbUser =
      await prisma.user.findUnique({
        where: {
          id: possibleUserId,
        },

        select: {
          outletId: true,
        },
      });

    return Number(
      dbUser?.outletId ?? 0
    );
  } catch (error) {
    console.error(
      "RESOLVE USER OUTLET ERROR:",
      error
    );

    return 0;
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

type CostCategory =
  (typeof COST_CATEGORIES)[number];

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

  if (!n) {
    return null;
  }

  if (
    n.includes("VEGET") ||
    n.includes("SAYUR")
  ) {
    return "VEGETABLES";
  }

  if (
    n.includes("FRUIT") ||
    n.includes("BUAH")
  ) {
    return "FRUITS";
  }

  if (n.includes("GROC")) {
    return "GROCERIES";
  }

  if (
    n.includes("PASTR") ||
    n.includes("BAKERY")
  ) {
    return "PASTRY";
  }

  if (n.includes("FROZEN")) {
    return "FROZEN FOOD";
  }

  if (
    n.includes("SEAFOOD") ||
    n.includes("SEA FOOD")
  ) {
    return "SEAFOOD";
  }

  if (
    n.includes("CHICKEN") ||
    n.includes("POULTRY") ||
    n.includes("AYAM")
  ) {
    return "CHICKEN & POULTRY";
  }

  if (
    n.includes("WIP") ||
    n.includes("SOUP")
  ) {
    return "WIP & SOUP";
  }

  if (
    n.includes("BEVER") ||
    n.includes("MINUM")
  ) {
    return "BEVERAGE";
  }

  if (
    n.includes("MEAT") ||
    n.includes("DAGING")
  ) {
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

  if (
    n.includes("STAFF") ||
    n.includes("KARYAWAN")
  ) {
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
  const n = String(name || "")
    .toUpperCase()
    .trim();

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
  const result = Number(
    value ?? 0
  );

  return Number.isFinite(result)
    ? result
    : 0;
}

function createCategoryMap() {
  const result: Record<
    string,
    number
  > = {};

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
    (target[category] || 0) +
    num(amount);
}

function benchmarkStatus(
  value: number,
  benchmark: any
) {
  if (!benchmark) {
    return "-";
  }

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

  if (
    value >= num(critical)
  ) {
    return "CRITICAL";
  }

  if (
    value >= num(warning)
  ) {
    return "WARNING";
  }

  return "AMAN";
}

/*
 * =========================================================
 * GET COST CONTROL
 * =========================================================
 */

export async function GET(
  req: NextRequest
) {
  try {
    /*
     * =======================================================
     * CURRENT USER
     * =======================================================
     */

    const user: any =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * =======================================================
     * ACCESS CONTROL
     * =======================================================
     */

    const outletAdmin =
      isOutletAdmin(user);

    const centralAdmin =
      isCentralAdmin(user);

    /*
     * HANYA:
     *
     * ADMIN
     * OUTLET_ADMIN
     *
     * yang boleh masuk.
     */

    if (
      !centralAdmin &&
      !outletAdmin
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses Cost Control",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =======================================================
     * QUERY
     * =======================================================
     */

    const {
      searchParams,
    } = new URL(req.url);

    const now = new Date();

    const month =
      searchParams.get(
        "month"
      ) ||
      `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}`;

    const requestedOutlet =
      Number(
        searchParams.get(
          "outletId"
        ) || 0
      );

    /*
     * =======================================================
     * SALES
     * =======================================================
     */

    let salesByOutlet: Record<
      string,
      number
    > = {};

    const salesRaw =
      searchParams.get(
        "salesByOutlet"
      );

    if (salesRaw) {
      try {
        const parsed =
          JSON.parse(
            salesRaw
          );

        if (
          parsed &&
          typeof parsed ===
            "object"
        ) {
          for (const [
            key,
            value,
          ] of Object.entries(
            parsed
          )) {
            salesByOutlet[key] =
              num(value);
          }
        }
      } catch {
        salesByOutlet = {};
      }
    }

    /*
     * BACKWARD COMPATIBILITY
     */

    const oldNetSales =
      num(
        searchParams.get(
          "netSales"
        )
      );

    /*
     * =======================================================
     * RESOLVE OUTLET
     * =======================================================
     */

    let allowedOutletId =
      requestedOutlet;

    /*
     * =======================================================
     * OUTLET ADMIN
     * =======================================================
     *
     * OUTLET ADMIN TIDAK BOLEH MEMILIH OUTLET LAIN.
     *
     * Contoh:
     *
     * /api/cost-control?outletId=2
     *
     * Jika user sebenarnya outlet 1,
     * tetap hanya outlet 1 yang dikembalikan.
     * =======================================================
     */

    if (outletAdmin) {
      const userOutletId =
        await resolveUserOutletId(
          user
        );

      if (!userOutletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User belum memiliki outlet",
          },
          {
            status: 400,
          }
        );
      }

      allowedOutletId =
        userOutletId;
    }

    /*
     * =======================================================
     * CENTRAL ADMIN
     * =======================================================
     *
     * ADMIN:
     *
     * outletId = 0 / tidak ada
     *     -> semua outlet
     *
     * outletId > 0
     *     -> outlet tersebut
     * =======================================================
     */

    /*
     * =======================================================
     * MONTH RANGE
     * =======================================================
     */

    const monthStart =
      startOfDay(
        new Date(
          `${month}-01T00:00:00`
        )
      );

    const monthEnd =
      new Date(
        monthStart
      );

    monthEnd.setMonth(
      monthEnd.getMonth() + 1
    );

    /*
     * =======================================================
     * OUTLETS
     * =======================================================
     */

    const outlets =
      allowedOutletId > 0
        ? await prisma.outlet.findMany(
            {
              where: {
                id:
                  allowedOutletId,

                active: true,
              },

              orderBy: {
                name: "asc",
              },
            }
          )
        : await prisma.outlet.findMany(
            {
              where: {
                active: true,
              },

              orderBy: {
                name: "asc",
              },
            }
          );

    /*
     * =======================================================
     * VALIDASI OUTLET
     * =======================================================
     */

    if (
      allowedOutletId > 0 &&
      outlets.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * =======================================================
     * HASIL
     * =======================================================
     */

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
        await prisma.outletBarang.findMany(
          {
            where: {
              outletId:
                outlet.id,

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
          }
        );

      /*
       * =====================================================
       * MASTER MAP
       * =====================================================
       */

      const masterMap =
        new Map<
          number,
          any
        >();

      for (const master of outletMaster) {
        masterMap.set(
          Number(
            master.barangId
          ),
          master
        );
      }

      /*
       * =====================================================
       * PRICE MAP
       * =====================================================
       */

      const priceMap =
        new Map<
          number,
          number
        >();

      for (const master of outletMaster) {
        priceMap.set(
          Number(
            master.barangId
          ),
          num(
            master.harga ??
              master.barang
                ?.purchasePrice
          )
        );
      }

      /*
       * =====================================================
       * STOCK OPNAME
       * =====================================================
       */

      const opnameRows =
        await prisma.stockOpname.findMany(
          {
            where: {
              outletId:
                outlet.id,

              date: {
                gte: monthStart,
                lt: monthEnd,
              },

              OR: [
                {
                  type: "WEEKLY",

                  status: {
                    in: [
                      "COMPLETED",
                      "APPROVED",
                    ],
                  },
                },

                {
                  type: "MONTHLY",

                  status: "APPROVED",
                },
              ],
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
          }
        );

      const weeklyOpnames =
        opnameRows
          .filter(
            (so) =>
              String(
                so.type
              ).toUpperCase() ===
              "WEEKLY"
          )
          .sort(
            (a, b) =>
              new Date(
                a.date
              ).getTime() -
              new Date(
                b.date
              ).getTime()
          );

      const monthlyOpnames =
        opnameRows
          .filter(
            (so) =>
              String(
                so.type
              ).toUpperCase() ===
                "MONTHLY" &&
              String(
                so.status
              ).toUpperCase() ===
                "APPROVED"
          )
          .sort(
            (a, b) =>
              new Date(
                a.date
              ).getTime() -
              new Date(
                b.date
              ).getTime()
          );

      /*
       * =====================================================
       * PREVIOUS OPNAME
       * =====================================================
       */

      const previousOpname =
        await prisma.stockOpname.findFirst(
          {
            where: {
              outletId:
                outlet.id,

              date: {
                lt: monthStart,
              },

              OR: [
                {
                  type: "MONTHLY",
                  status: "APPROVED",
                },

                {
                  type: "WEEKLY",
                  status: {
                    in: [
                      "COMPLETED",
                      "APPROVED",
                    ],
                  },
                },
              ],
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
          }
        );

      /*
       * =====================================================
       * OUTLET RECEIPT
       * =====================================================
       */

      const receipts =
        await prisma.outletReceipt.findMany(
          {
            where: {
              outletId:
                outlet.id,

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
          }
        );

      /*
       * =====================================================
       * TRANSFER PUSAT -> OUTLET
       * =====================================================
       */

      const transfers =
        await prisma.outletTransfer.findMany(
          {
            where: {
              outletId:
                outlet.id,

              transferDate: {
                gte: monthStart,
                lt: monthEnd,
              },

              status: {
                in: [
                  "PARTIAL",
                  "RECEIVED",
                ],
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
              transferDate:
                "asc",
            },
          }
        );

      /*
       * =====================================================
       * WASTE
       * =====================================================
       */

      const outletWastes =
        await prisma.outletStockOut.findMany(
          {
            where: {
              outletId:
                outlet.id,

              type: "WASTE",

              status: "APPROVED",

              trxDate: {
                gte: monthStart,
                lt: monthEnd,
              },
            },

            include: {
              barang: true,
            },

            orderBy: {
              trxDate: "asc",
            },
          }
        );

      /*
       * =====================================================
       * PRICE
       * =====================================================
       */

      function itemPrice(
        barangId: number,
        barang?: any
      ) {
        const masterPrice = num(
          priceMap.get(barangId)
        );

        if (masterPrice > 0) {
          return masterPrice;
        }

        const purchasePrice = num(
          barang?.purchasePrice
        );

        return purchasePrice > 0
          ? purchasePrice
          : 0;
      }

      /*
       * =====================================================
       * OPENING QTY
       * =====================================================
       */

      const openingQtyMap =
        new Map<
          number,
          number
        >();

      if (previousOpname) {
        for (const item of
          previousOpname.items ||
          []) {
          const barangId =
            Number(
              item.barangId
            );


          openingQtyMap.set(
            barangId,
            num(
              item.physicalQty
            )
          );
        }
      }

      /*
       * =====================================================
       * CALCULATE RECEIVED
       * =====================================================
       */

      function calculateReceived(
        periodStart: Date,
        periodEnd: Date
      ) {
        const result =
          createCategoryMap();

        /*
         * OUTLET RECEIPT
         */

        for (const receipt of
          receipts) {
          const receiptDate =
            new Date(
              receipt.receiptDate
            );

          if (
            receiptDate <
              periodStart ||
            receiptDate >=
              periodEnd
          ) {
            continue;
          }

          for (const item of
            receipt.items || []) {
            const barangId =
              Number(
                item.barangId
              );

            const master =
              masterMap.get(
                barangId
              );

            const barang =
              master?.barang ??
              item.barang;

            const category =
              catKey(
                barang?.category
              );

            if (!category) {
              continue;
            }

            const subtotal =
              num(
                item.subtotal
              );

            const qty =
              num(
                item.qty
              );

            const price =
              itemPrice(
                barangId,
                barang
              );

            const amount =
              subtotal > 0
                ? subtotal
                : qty * price;

            addAmount(
              result,
              category,
              amount
            );
          }
        }

        /*
         * TRANSFER
         */

        for (const transfer of
          transfers) {
          const transferDate =
            new Date(
              transfer.transferDate
            );

          if (
            transferDate <
              periodStart ||
            transferDate >=
              periodEnd
          ) {
            continue;
          }

          for (const item of
            transfer.items || []) {
            const barangId =
              Number(
                item.barangId
              );

            const receivedQty =
              num(
                item.receivedQty
              );

            if (
              receivedQty <= 0
            ) {
              continue;
            }

            const master =
              masterMap.get(
                barangId
              );

            const barang =
              master?.barang ??
              item.barang;

            const category =
              catKey(
                barang?.category
              );

            if (!category) {
              continue;
            }

            const price =
              itemPrice(
                barangId,
                barang
              );

            addAmount(
              result,
              category,
              receivedQty *
                price
            );
          }
        }

        return result;
      }

      /*
       * =====================================================
       * CALCULATE WASTE
       * =====================================================
       */

      function calculateWaste(
        periodStart: Date,
        periodEnd: Date
      ) {
        const result =
          createCategoryMap();

        for (const waste of
          outletWastes) {
          const wasteDate =
            new Date(
              waste.trxDate
            );

          if (
            wasteDate <
              periodStart ||
            wasteDate >=
              periodEnd
          ) {
            continue;
          }

          const barangId =
            Number(
              waste.barangId
            );


          const master =
            masterMap.get(
              barangId
            );

          const barang =
            master?.barang ??
            waste.barang;

          const category =
            catKey(
              barang?.category
            );

          if (!category) {
            continue;
          }

          const wasteQty =
            num(
              waste.wasteQty
            );

          const unitCost =
            num(
              waste.unitCost
            );

          const calculatedCost =
            wasteQty *
            unitCost;

          const wasteCost =
            num(
              waste.totalCost
            ) > 0
              ? num(
                  waste.totalCost
                )
              : calculatedCost;

          addAmount(
            result,
            category,
            wasteCost
          );
        }

        return result;
      }

      /*
       * =====================================================
       * WEEKLY
       * =====================================================
       */

      const weeks: any[] = [];

      for (
        let index = 0;
        index <
        weeklyOpnames.length;
        index++
      ) {
        const so =
          weeklyOpnames[index];

        const periodStart =
          index === 0
            ? monthStart
            : nextDay(
                weeklyOpnames[
                  index - 1
                ].date
              );

        const periodEnd =
          nextDay(
            so.date
          );

        /*
         * OPENING
         */

        const openingByCat =
          createCategoryMap();

        for (const [
          barangId,
          qty,
        ] of openingQtyMap.entries()) {
          const master =
            masterMap.get(
              barangId
            );

          const barang =
            master?.barang ??
            previousOpname.items.find(
              (x: any) =>
                Number(x.barangId) ===
                barangId
            )?.barang;

          const category =
            catKey(
              barang?.category
            );

          if (!category) {
            continue;
          }

          const price =
            itemPrice(
              barangId,
              barang
            );

          addAmount(
            openingByCat,
            category,
            qty * price
          );
        }

        /*
         * ENDING
         */

        const endingByCat =
          createCategoryMap();

        const currentSnapshot =
          new Map<
            number,
            number
          >();

        for (const item of
          so.items || []) {
          const barangId =
            Number(
              item.barangId
            );


          const master =
            masterMap.get(
              barangId
            );

          const barang =
            master?.barang ??
            item.barang;

          const category =
            catKey(
              barang?.category
            );

          if (!category) {
            continue;
          }

          const physicalQty =
            Math.max(
              0,
              num(
                item.physicalQty
              )
            );

          const price =
            itemPrice(
              barangId,
              barang
            );

          currentSnapshot.set(
            barangId,
            physicalQty
          );

          addAmount(
            endingByCat,
            category,
            physicalQty * price
          );
        }

        /*
         * RECEIVED
         */

        const receivedByCat =
          calculateReceived(
            periodStart,
            periodEnd
          );

        /*
         * WASTE
         */

        const wasteByCat =
          calculateWaste(
            periodStart,
            periodEnd
          );

        /*
         * ROWS
         */

        const rows =
          COST_CATEGORIES.map(
            (category) => {
              const opening =
                num(
                  openingByCat[
                    category
                  ]
                );

              const received =
                num(
                  receivedByCat[
                    category
                  ]
                );

              const ending =
                num(
                  endingByCat[
                    category
                  ]
                );

              const waste =
                num(
                  wasteByCat[
                    category
                  ]
                );

              const rawCost =
                opening +
                received -
                ending -
                waste;

              const cost =
                Math.max(
                  0,
                  rawCost
                );

              return {
                category,
                opening,
                purchase:
                  received,
                received,
                ending,
                waste,
                cost,
              };
            }
          );

        /*
         * SALES
         */

        const outletSales =
          salesByOutlet[
            String(
              outlet.id
            )
          ] ??
          (allowedOutletId > 0
            ? oldNetSales
            : 0);

        /*
         * TOTAL
         */

        const totals =
          rows.reduce(
            (acc, row) => ({
              opening:
                acc.opening +
                num(
                  row.opening
                ),

              purchase:
                acc.purchase +
                num(
                  row.purchase
                ),

              received:
                acc.received +
                num(
                  row.received
                ),

              ending:
                acc.ending +
                num(
                  row.ending
                ),

              waste:
                acc.waste +
                num(
                  row.waste
                ),

              cost:
                acc.cost +
                num(
                  row.cost
                ),
            }),
            {
              opening: 0,
              purchase: 0,
              received: 0,
              ending: 0,
              waste: 0,
              cost: 0,
            }
          );

        /*
         * FOOD COST
         */

        const weeklyFoodCost =
          outletSales > 0
            ? (totals.cost /
                outletSales) *
              100
            : 0;

        /*
         * BENCHMARK
         */

        const benchmarkKey =
          outletKey(
            outlet.name
          );

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
         * NEXT OPENING
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

          type: so.type,

          status: so.status,

          date: so.date,

          periodStart,

          periodEnd,

          rows:
            benchmarkRows,

          totals: {
            ...totals,

            purchase:
              totals.received,

            received:
              totals.received,

            foodCost:
              weeklyFoodCost,

            ratioToSales:
              weeklyFoodCost,
          },
        });
      }

      /*
       * =====================================================
       * CLOSING OPNAME
       * =====================================================
       */

      let closingOpname: any =
        monthlyOpnames.length > 0
          ? monthlyOpnames[
              monthlyOpnames.length - 1
            ]
          : weeklyOpnames.length > 0
          ? weeklyOpnames[
              weeklyOpnames.length - 1
            ]
          : null;

      /*
       * =====================================================
       * MONTHLY OPENING
       * =====================================================
       */

      const monthlyOpeningByCat =
        createCategoryMap();

      if (previousOpname) {
        for (const item of
          previousOpname.items ||
          []) {
          const barangId =
            Number(
              item.barangId
            );


          const master =
            masterMap.get(
              barangId
            );

          const barang =
            master?.barang ??
            item.barang;

          const category =
            catKey(
              barang?.category
            );

          if (!category) {
            continue;
          }

          const qty =
            num(
              item.physicalQty
            );

          const price =
            itemPrice(
              barangId,
              barang
            );

          addAmount(
            monthlyOpeningByCat,
            category,
            qty * price
          );
        }
      }

      /*
       * =====================================================
       * MONTHLY ENDING
       * =====================================================
       */

      const monthlyEndingByCat =
        createCategoryMap();

      if (closingOpname) {
        for (const item of
          closingOpname.items ||
          []) {
          const barangId =
            Number(
              item.barangId
            );


          const master =
            masterMap.get(
              barangId
            );

          const barang =
            master?.barang ??
            item.barang;

          const category =
            catKey(
              barang?.category
            );

          if (!category) {
            continue;
          }

          const qty =
            Math.max(
              0,
              num(
                item.physicalQty
              )
            );

          const price =
            itemPrice(
              barangId,
              barang
            );

          addAmount(
            monthlyEndingByCat,
            category,
            qty * price
          );
        }
      }

      /*
       * =====================================================
       * MONTHLY RECEIVED
       * =====================================================
       */

      const monthlyReceivedByCat =
        calculateReceived(
          monthStart,
          monthEnd
        );

      /*
       * =====================================================
       * MONTHLY WASTE
       * =====================================================
       */

      const monthlyWasteByCat =
        calculateWaste(
          monthStart,
          monthEnd
        );

      /*
       * =====================================================
       * MONTHLY ROWS
       * =====================================================
       */

      const monthlyRows =
        COST_CATEGORIES.map(
          (category) => {
            const opening =
              num(
                monthlyOpeningByCat[
                  category
                ]
              );

            const received =
              num(
                monthlyReceivedByCat[
                  category
                ]
              );

            const ending =
              num(
                monthlyEndingByCat[
                  category
                ]
              );

            const waste =
              num(
                monthlyWasteByCat[
                  category
                ]
              );

            const rawCost =
              opening +
              received -
              ending -
              waste;

            const cost =
              Math.max(
                0,
                rawCost
              );

            return {
              category,

              opening,

              purchase:
                received,

              received,

              ending,

              waste,

              cost,
            };
          }
        );

      /*
       * =====================================================
       * MONTHLY TOTAL
       * =====================================================
       */

      const monthly =
        monthlyRows.reduce(
          (acc, row) => ({
            opening:
              acc.opening +
              num(
                row.opening
              ),

            purchase:
              acc.purchase +
              num(
                row.purchase
              ),

            received:
              acc.received +
              num(
                row.received
              ),

            ending:
              acc.ending +
              num(
                row.ending
              ),

            waste:
              acc.waste +
              num(
                row.waste
              ),

            cost:
              acc.cost +
              num(
                row.cost
              ),
          }),
          {
            opening: 0,
            purchase: 0,
            received: 0,
            ending: 0,
            waste: 0,
            cost: 0,
          }
        );

      /*
       * =====================================================
       * OUTLET SALES
       * =====================================================
       */

      const outletNetSales =
        salesByOutlet[
          String(
            outlet.id
          )
        ] ??
        (allowedOutletId > 0
          ? oldNetSales
          : 0);

      /*
       * =====================================================
       * FOOD COST
       * =====================================================
       */

      const foodCost =
        outletNetSales > 0
          ? (monthly.cost /
              outletNetSales) *
            100
          : 0;

      /*
       * =====================================================
       * MONTHLY BENCHMARK
       * =====================================================
       */

      const benchmarkKey =
        outletKey(
          outlet.name
        );

      const monthlyBenchmarkRows =
        monthlyRows.map(
          (row) => {
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
              monthly.cost > 0
                ? (row.cost /
                    monthly.cost) *
                  100
                : 0;

            const ratioToSales =
              outletNetSales > 0
                ? (row.cost /
                    outletNetSales) *
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
          }
        );

      /*
       * =====================================================
       * RESULT OUTLET
       * =====================================================
       */

      results.push({
        outlet,

        benchmark:
          benchmarkKey,

        benchmarks:
          BENCHMARKS[
            benchmarkKey
          ],

        opnameCount:
          opnameRows.length,

        weeklyOpnameCount:
          weeklyOpnames.length,

        monthlyOpnameCount:
          monthlyOpnames.length,

        masterBarangCount:
          outletMaster.length,

        // Stock Opname adalah sumber data Cost Control.
        // Tidak lagi dibatasi oleh OutletBarang aktif.
        opnameItemCount:
          opnameRows.reduce(
            (total, so) =>
              total +
              (so.items?.length || 0),
            0
          ),

        receiptCount:
          receipts.length,

        transferCount:
          transfers.length,

        wasteCount:
          outletWastes.length,

        masterCategories:
          Array.from(
            new Set(
              [
                ...outletMaster.map(
                  (item) =>
                    catKey(
                      item.barang
                        ?.category
                    )
                ),
                ...opnameRows.flatMap(
                  (so) =>
                    (so.items || []).map(
                      (item: any) =>
                        catKey(
                          item.barang
                            ?.category
                        )
                    )
                ),
                ...receipts.flatMap(
                  (receipt) =>
                    (receipt.items || []).map(
                      (item: any) =>
                        catKey(
                          item.barang
                            ?.category
                        )
                    )
                ),
                ...transfers.flatMap(
                  (transfer) =>
                    (transfer.items || []).map(
                      (item: any) =>
                        catKey(
                          item.barang
                            ?.category
                        )
                    )
                ),
                ...outletWastes.map(
                  (item) =>
                    catKey(
                      item.barang
                        ?.category
                    )
                ),
              ].filter(
                (value): value is CostCategory =>
                  Boolean(value)
              )
            )
          ),

        weeks,

        monthly: {
          opening:
            monthly.opening,

          purchase:
            monthly.purchase,

          received:
            monthly.received,

          ending:
            monthly.ending,

          waste:
            monthly.waste,

          cost:
            monthly.cost,

          netSales:
            outletNetSales,

          foodCost,

          ratioToSales:
            foodCost,

          rows:
            monthlyBenchmarkRows,

          closingOpname:
            closingOpname
              ? {
                  id:
                    closingOpname.id,

                  code:
                    closingOpname.code,

                  type:
                    closingOpname.type,

                  status:
                    closingOpname.status,

                  date:
                    closingOpname.date,
                }
              : null,
        },
      });
    }

    /*
     * =======================================================
     * GLOBAL MONTHLY
     * =======================================================
     *
     * Untuk OUTLET_ADMIN:
     * hanya berisi outlet miliknya karena results
     * hanya berisi outlet miliknya.
     *
     * Untuk ADMIN:
     * berisi seluruh outlet jika tidak memilih outlet.
     * =======================================================
     */

    const monthly =
      results.reduce(
        (acc, outlet) => ({
          opening:
            acc.opening +
            num(
              outlet.monthly
                ?.opening
            ),

          purchase:
            acc.purchase +
            num(
              outlet.monthly
                ?.purchase
            ),

          received:
            acc.received +
            num(
              outlet.monthly
                ?.received
            ),

          ending:
            acc.ending +
            num(
              outlet.monthly
                ?.ending
            ),

          waste:
            acc.waste +
            num(
              outlet.monthly
                ?.waste
            ),

          cost:
            acc.cost +
            num(
              outlet.monthly
                ?.cost
            ),

          netSales:
            acc.netSales +
            num(
              outlet.monthly
                ?.netSales
            ),
        }),
        {
          opening: 0,
          purchase: 0,
          received: 0,
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

        /*
         * ADMIN:
         * true jika tidak memilih outlet.
         *
         * OUTLET ADMIN:
         * selalu false.
         */

        allOutlets:
          centralAdmin &&
          allowedOutletId === 0,

        /*
         * Identitas akses untuk frontend.
         */

        access: {
          role:
            normalizeRole(
              user?.role
            ),

          isCentralAdmin:
            centralAdmin,

          isOutletAdmin:
            outletAdmin,

          outletId:
            outletAdmin
              ? allowedOutletId
              : null,
        },

        outlets:
          results,

        monthly: {
          opening:
            monthly.opening,

          purchase:
            monthly.purchase,

          received:
            monthly.received,

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