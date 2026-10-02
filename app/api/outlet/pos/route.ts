import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getConversionRate, toBaseQty } from "@/lib/base-unit";
import { changeOutletStock } from "@/lib/outlet-stock-ledger";

export const dynamic = "force-dynamic";

const fail = (message: string, status = 400) =>
  NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );

const POS_ROLES = [
  "ADMIN",
  "MANAGER",
  "OUTLET_ADMIN",
  "KASIR",
] as const;

const PAYMENT_METHODS = [
  "CASH",
  "TRANSFER",
  "TRANSFER_FINANCE",
  "TRANSFER_CREDIT_CARD",
  "TRANSFER_PETTY_CASH_CENTER",
  "COD",
  "CBD",
  "TEMPO",
] as const;

type PosPaymentMethod =
  (typeof PAYMENT_METHODS)[number];

async function getUser() {
  const cookieStore = await cookies();

  const session =
    cookieStore.get("erp-session") ||
    cookieStore.get("session");

  if (!session) return null;

  let userId = 0;

  try {
    const dbSession =
      await prisma.session.findUnique({
        where: {
          token: session.value,
        },
        select: {
          expiresAt: true,
          user: {
            select: {
              id: true,
            },
          },
        },
      });

    if (
      dbSession &&
      dbSession.expiresAt > new Date()
    ) {
      userId = dbSession.user.id;
    }
  } catch {
    // fallback di bawah
  }

  if (!userId) {
    try {
      const parsed = JSON.parse(
        session.value
      );

      userId = Number(
        parsed?.user?.id ??
          parsed?.id ??
          0
      );
    } catch {
      // bukan session JSON
    }
  }

  if (!userId) return null;

  return prisma.user
    .findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
        active: true,
        outletId: true,
        fullname: true,
        username: true,
        outlet: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    })
    .then((user) =>
      user?.active ? user : null
    );
}

function roleOf(user: { role: unknown }) {
  return String(user.role).toUpperCase();
}

function isPosRole(role: string) {
  return POS_ROLES.includes(
    role as (typeof POS_ROLES)[number]
  );
}

function resolveOutletId(
  user: {
    role: unknown;
    outletId: number | null;
  },
  requestedOutletId: unknown
) {
  const role = roleOf(user);

  /*
   * OUTLET_ADMIN dan KASIR selalu terkunci
   * ke outlet dari session.
   */
  if (
    role === "OUTLET_ADMIN" ||
    role === "KASIR"
  ) {
    return Number(user.outletId || 0);
  }

  /*
   * ADMIN / MANAGER boleh memilih outlet.
   */
  const parsed = Number(
    requestedOutletId || 0
  );

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : 0;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function isAyceAddOn(
  menu: {
    id?: number;
    category?: string | null;
    name?: string | null;
  },
  explicitAddOnIds: Set<number>
) {
  if (
    menu.id &&
    explicitAddOnIds.has(Number(menu.id))
  ) {
    return true;
  }

  const category = normalizeText(
    menu.category
  );

  const name = normalizeText(
    menu.name
  );

  if (
    category === "DRINK" ||
    category === "DESSERT"
  ) {
    return true;
  }

  if (
    /\bDRINK\b|\bMINUM\b|\bBEVERAGE\b|\bDESSERT\b|\bES\b/.test(
      name
    )
  ) {
    return true;
  }

  return false;
}

function parseIsoDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function parseReportDate(
  value: string | null
) {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const [
    year,
    month,
    day,
  ] = value
    .split("-")
    .map(Number);

  const start = new Date(
    year,
    month - 1,
    day,
    0,
    0,
    0,
    0
  );

  if (
    start.getFullYear() !== year ||
    start.getMonth() !== month - 1 ||
    start.getDate() !== day
  ) {
    return null;
  }

  const end = new Date(start);

  end.setDate(
    end.getDate() + 1
  );

  return {
    start,
    end,
  };
}

type SaleInputItem = {
  menuId?: unknown;
  qty?: unknown;
  unitPrice?: unknown;
};

type RequiredBom = {
  barangId: number;
  qtyBase: number;
  barangName: string;
  baseUnit: string;
  unitCostBase: number;
};

type AyceInput = {
  enabled?: unknown;
  sessionId?: unknown;
  tableName?: unknown;
  pax?: unknown;
  packageKey?: unknown;
  packageName?: unknown;
  packagePrice?: unknown;
  durationMinutes?: unknown;
  startedAt?: unknown;
  expiresAt?: unknown;
  addOnMenuIds?: unknown;
};

function parseAyce(body: any) {
  const raw = body?.ayce;

  if (
    !raw ||
    typeof raw !== "object"
  ) {
    return {
      enabled: false,
      sessionId:
        null as string | null,
      tableName:
        null as string | null,
      pax: 0,
      packageKey:
        null as string | null,
      packageName:
        null as string | null,
      packagePrice: 0,
      durationMinutes: 0,
      startedAt:
        null as Date | null,
      expiresAt:
        null as Date | null,
      addOnMenuIds:
        new Set<number>(),
    };
  }

  const enabled =
    raw.enabled === true ||
    raw.enabled === 1 ||
    String(
      raw.enabled
    ).toLowerCase() ===
      "true";

  const pax = Number(
    raw.pax || 0
  );

  const packagePrice = Number(
    raw.packagePrice || 0
  );

  const durationMinutes =
    Number(
      raw.durationMinutes || 0
    );

  const addOnMenuIds =
    new Set<number>();

  if (
    Array.isArray(
      raw.addOnMenuIds
    )
  ) {
    for (
      const id of raw.addOnMenuIds
    ) {
      const parsed = Number(id);

      if (
        Number.isInteger(parsed) &&
        parsed > 0
      ) {
        addOnMenuIds.add(parsed);
      }
    }
  }

  return {
    enabled,

    sessionId:
      String(
        raw.sessionId || ""
      ).trim() || null,

    tableName:
      String(
        raw.tableName || ""
      ).trim() || null,

    pax,

    packageKey:
      String(
        raw.packageKey || ""
      ).trim() || null,

    packageName:
      String(
        raw.packageName || ""
      ).trim() || null,

    packagePrice,

    durationMinutes,

    startedAt: parseIsoDate(
      raw.startedAt
    ),

    expiresAt: parseIsoDate(
      raw.expiresAt
    ),

    addOnMenuIds,
  };
}

/*
 * ============================================================
 * GET POS + DAILY REPORT
 * ============================================================
 *
 * GET NORMAL:
 *
 *   /api/outlet/pos
 *
 * GET LAPORAN HARIAN:
 *
 *   /api/outlet/pos?date=YYYY-MM-DD&outletId=1
 *
 * Laporan memakai StockCard POS_OUT sebagai
 * sumber utama consumption / HPP.
 */
export async function GET(
  req: NextRequest
) {
  try {
    const user = await getUser();

    if (!user) {
      return fail(
        "Tidak login.",
        401
      );
    }

    const role = roleOf(user);

    /*
     * ========================================================
     * DAILY REPORT MODE
     * ========================================================
     */
    const dateParam =
      req.nextUrl.searchParams.get(
        "date"
      );

    if (dateParam) {
      const parsed =
        parseReportDate(
          dateParam
        );

      if (!parsed) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Tanggal laporan wajib YYYY-MM-DD",
          },
          {
            status: 400,
          }
        );
      }

      /*
       * Laporan POS tidak dibuka untuk KASIR.
       */
      if (
        role !== "ADMIN" &&
        role !== "MANAGER" &&
        role !== "OUTLET_ADMIN" &&
        role !== "ADMIN_OUTLET"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda tidak memiliki akses laporan POS",
          },
          {
            status: 403,
          }
        );
      }

      const requestedOutletId =
        Number(
          req.nextUrl.searchParams.get(
            "outletId"
          ) || 0
        );

      let outletId =
        requestedOutletId;

      if (
        role === "OUTLET_ADMIN" ||
        role === "ADMIN_OUTLET"
      ) {
        outletId = Number(
          user.outletId || 0
        );
      }

      if (
        !Number.isInteger(
          outletId
        ) ||
        outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet laporan tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      if (
        (role === "OUTLET_ADMIN" ||
          role === "ADMIN_OUTLET") &&
        outletId !==
          Number(user.outletId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet tidak sesuai dengan session",
          },
          {
            status: 403,
          }
        );
      }

      const outlet =
        await prisma.outlet.findUnique(
          {
            where: {
              id: outletId,
            },
            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
          }
        );

      if (!outlet) {
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

      if (!outlet.active) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet sedang tidak aktif",
          },
          {
            status: 400,
          }
        );
      }

      /*
       * ======================================================
       * STOCK CARD POS OUT
       * ======================================================
       */
      const cards =
        await prisma.stockCard.findMany(
          {
            where: {
              trxType: "POS_OUT",

              trxDate: {
                gte: parsed.start,
                lt: parsed.end,
              },

              warehouse:
                `OUTLET:${outlet.code}`,

              qtyOut: {
                gt: 0,
              },
            },

            include: {
              barang: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  unit: true,
                  baseUnit: true,
                  conversionRate: true,
                },
              },
            },

            orderBy: {
              trxDate: "asc",
            },
          }
        );

      const data =
        cards.map(
          (card: any) => ({
            id: card.id,

            trxDate:
              card.trxDate,

            trxType:
              card.trxType,

            trxNumber:
              card.trxNumber,

            referenceId:
              card.referenceId,

            warehouse:
              card.warehouse,

            qtyOut: Number(
              card.qtyOut || 0
            ),

            unitPrice:
              Number(
                card.unitPrice || 0
              ),

            totalValue:
              Number(
                card.totalValue || 0
              ),

            balance:
              Number(
                card.balance || 0
              ),

            note:
              card.note || null,

            barang:
              card.barang
                ? {
                    id:
                      card.barang.id,

                    code:
                      card.barang.code,

                    name:
                      card.barang.name,

                    unit:
                      card.barang.unit,

                    baseUnit:
                      card.barang.baseUnit,

                    conversionRate:
                      Number(
                        card.barang
                          .conversionRate ||
                          1
                      ),
                  }
                : null,
          })
        );

      /*
       * ======================================================
       * SUMMARY LAPORAN
       * ======================================================
       */
      const totalTransactions =
        data.length;

      const totalQtyOut =
        data.reduce(
          (
            sum: number,
            row: any
          ) =>
            sum +
            Number(
              row.qtyOut || 0
            ),
          0
        );

      const totalValue =
        data.reduce(
          (
            sum: number,
            row: any
          ) =>
            sum +
            Number(
              row.totalValue || 0
            ),
          0
        );

      /*
       * Group berdasarkan barang.
       */
      const groupedMap =
        new Map<
          number,
          {
            barangId: number;
            code: string | null;
            name: string;
            unit: string | null;
            baseUnit: string | null;
            conversionRate: number;
            qtyOut: number;
            totalValue: number;
            transactionCount: number;
          }
        >();

      for (
        const row of data
      ) {
        if (!row.barang) {
          continue;
        }

        const barangId =
          Number(
            row.barang.id
          );

        const existing =
          groupedMap.get(
            barangId
          );

        if (existing) {
          existing.qtyOut +=
            Number(
              row.qtyOut || 0
            );

          existing.totalValue +=
            Number(
              row.totalValue || 0
            );

          existing.transactionCount +=
            1;
        } else {
          groupedMap.set(
            barangId,
            {
              barangId,

              code:
                row.barang.code ??
                null,

              name:
                row.barang.name,

              unit:
                row.barang.unit ??
                null,

              baseUnit:
                row.barang.baseUnit ??
                null,

              conversionRate:
                Number(
                  row.barang
                    .conversionRate ||
                    1
                ),

              qtyOut:
                Number(
                  row.qtyOut || 0
                ),

              totalValue:
                Number(
                  row.totalValue || 0
                ),

              transactionCount:
                1,
            }
          );
        }
      }

      const summaryByBarang =
        [...groupedMap.values()]
          .sort(
            (a, b) =>
              a.name.localeCompare(
                b.name
              )
          );

      /*
       * ======================================================
       * SALES HARIAN
       * ======================================================
       *
       * Ditambahkan agar endpoint yang sama dapat digunakan
       * untuk laporan harian POS.
       */
      const sales =
        await prisma.outletSale.findMany(
          {
            where: {
              outletId,

              saleDate: {
                gte: parsed.start,
                lt: parsed.end,
              },
            },

            include: {
              items: {
                include: {
                  barang: true,
                  menu: true,
                },
              },

              outlet: true,

              user: {
                select: {
                  id: true,
                  fullname: true,
                  username: true,
                },
              },
            },

            orderBy: {
              saleDate: "asc",
            },
          }
        );

      const totalSales =
        sales.length;

      const totalGrossSales =
        sales.reduce(
          (
            sum: number,
            sale: any
          ) =>
            sum +
            Number(
              sale.subtotal || 0
            ),
          0
        );

      const totalDiscount =
        sales.reduce(
          (
            sum: number,
            sale: any
          ) =>
            sum +
            Number(
              sale.discount || 0
            ),
          0
        );

      const totalServiceCharge =
        sales.reduce(
          (
            sum: number,
            sale: any
          ) =>
            sum +
            Number(
              sale.serviceCharge || 0
            ),
          0
        );

      const totalPpn =
        sales.reduce(
          (
            sum: number,
            sale: any
          ) =>
            sum +
            Number(
              sale.ppn || 0
            ),
          0
        );

      const totalGrandTotal =
        sales.reduce(
          (
            sum: number,
            sale: any
          ) =>
            sum +
            Number(
              sale.total || 0
            ),
          0
        );

      const totalNetSales =
        totalGrandTotal -
        totalServiceCharge -
        totalPpn;

      return NextResponse.json({
        success: true,

        reportType:
          "POS_DAILY",

        date: dateParam,

        period: {
          start:
            parsed.start.toISOString(),
          end:
            parsed.end.toISOString(),
        },

        outlet,

        trxType:
          "POS_OUT",

        summary: {
          totalTransactions,

          totalQtyOut,

          totalValue,

          totalItems:
            summaryByBarang.length,

          totalSales,

          grossSales:
            totalGrossSales,

          discount:
            totalDiscount,

          serviceCharge:
            totalServiceCharge,

          ppn:
            totalPpn,

          grandTotal:
            totalGrandTotal,

          netSales:
            totalNetSales,
        },

        data,

        summaryByBarang,

        sales,
      });
    }

    /*
     * ========================================================
     * NORMAL POS MODE
     * ========================================================
     */

    if (!isPosRole(role)) {
      return fail(
        "Tidak memiliki akses POS Outlet.",
        403
      );
    }

    const requestedRaw =
      req.nextUrl.searchParams.get(
        "outletId"
      );

    const requestedOutletId =
      Number(
        requestedRaw || 0
      );

    /*
     * Ambil outlet aktif satu kali.
     */
    const outletRows =
      await prisma.outlet.findMany(
        {
          where: {
            active: true,
          },

          select: {
            id: true,
            code: true,
            name: true,
          },

          orderBy: {
            id: "asc",
          },
        }
      );

    /*
     * OUTLET_ADMIN / KASIR hanya boleh melihat
     * outlet miliknya.
     */
    const outlets =
      role === "OUTLET_ADMIN" ||
      role === "KASIR"
        ? outletRows.filter(
            (outlet) =>
              Number(outlet.id) ===
              Number(
                user.outletId
              )
          )
        : outletRows;

    let outletId =
      resolveOutletId(
        user,
        requestedOutletId
      );

    /*
     * ADMIN / MANAGER:
     * jika belum memilih outlet,
     * gunakan outlet aktif pertama.
     */
    if (
      role !== "OUTLET_ADMIN" &&
      role !== "KASIR" &&
      !outletId
    ) {
      outletId =
        outlets[0]?.id || 0;
    }

    /*
     * User yang terikat outlet harus mempunyai outlet.
     */
    if (
      (
        role === "OUTLET_ADMIN" ||
        role === "KASIR"
      ) &&
      !outletId
    ) {
      return fail(
        role === "KASIR"
          ? "User KASIR belum memiliki outlet."
          : "User outlet belum memiliki outlet.",
        400
      );
    }

    /*
     * Tidak ada outlet aktif.
     */
    if (!outletId) {
      return NextResponse.json({
        success: true,

        role,

        cashier: {
          id: user.id,

          fullname:
            user.fullname ||
            null,

          username:
            user.username ||
            null,
        },

        outlets: [],

        currentOutlet: null,

        menus: [],

        sales: [],

        data: [],

        outlet: null,
      });
    }

    /*
     * OUTLET_ADMIN / KASIR tidak boleh memanipulasi
     * outletId melalui browser.
     */
    if (
      (
        role === "OUTLET_ADMIN" ||
        role === "KASIR"
      ) &&
      Number(user.outletId) !==
        Number(outletId)
    ) {
      return fail(
        "Akses outlet ditolak.",
        403
      );
    }

    /*
     * Untuk ADMIN / MANAGER, outletId wajib
     * berasal dari outlet aktif.
     */
    const selectedOutlet =
      outlets.find(
        (outlet) =>
          Number(outlet.id) ===
          Number(outletId)
      ) || null;

    if (!selectedOutlet) {
      return fail(
        "Outlet tidak ditemukan atau tidak aktif.",
        404
      );
    }

    const outlet = {
      ...selectedOutlet,
      active: true,
    };

    /*
     * ========================================================
     * MENU + SALES PARALEL
     * ========================================================
     */
    const [
      menuRows,
      sales,
    ] = await Promise.all([
      prisma.menu.findMany({
        where: {
          active: true,
        },

        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          category: true,
          price: true,
          image: true,

          recipes: {
            where: {
              active: true,
            },

            select: {
              id: true,

              items: {
                select: {
                  barangId: true,
                  qty: true,
                  unit: true,

                  barang: {
                    select: {
                      id: true,
                      name: true,
                      unit: true,
                      baseUnit: true,
                      conversionRate: true,
                      purchasePrice:
                        true,
                      active: true,
                    },
                  },
                },
              },
            },

            orderBy: {
              id: "asc",
            },
          },
        },

        orderBy: {
          id: "asc",
        },
      }),

      prisma.outletSale.findMany({
        where: {
          outletId,
        },

        include: {
          items: {
            include: {
              barang: true,
              menu: true,
            },
          },

          outlet: true,

          user: {
            select: {
              id: true,
              fullname: true,
              username: true,
            },
          },
        },

        orderBy: {
          saleDate: "desc",
        },

        take: 100,
      }),
    ]);

    /*
     * ========================================================
     * KUMPULKAN SEMUA BARANG BOM
     * ========================================================
     */
    const bomBarangIds =
      new Set<number>();

    for (
      const menu of menuRows
    ) {
      const recipe =
        menu.recipes[0];

      if (!recipe) continue;

      for (
        const recipeItem of
          recipe.items
      ) {
        bomBarangIds.add(
          Number(
            recipeItem.barangId
          )
        );
      }
    }

    /*
     * ========================================================
     * AMBIL SEMUA OUTLET STOCK SEKALI
     * ========================================================
     */
    const outletStocks =
      bomBarangIds.size
        ? await prisma.outletStock.findMany(
            {
              where: {
                outletId,

                barangId: {
                  in: [
                    ...bomBarangIds,
                  ],
                },
              },

              select: {
                barangId: true,
                stock: true,
              },
            }
          )
        : [];

    /*
     * Map supaya lookup O(1).
     */
    const stockMap =
      new Map<
        number,
        number
      >();

    for (
      const stock of
        outletStocks
    ) {
      stockMap.set(
        Number(
          stock.barangId
        ),
        Number(
          stock.stock || 0
        )
      );
    }

    /*
     * ========================================================
     * HITUNG STOCK MENU
     * ========================================================
     */
    const menuItems =
      menuRows.map(
        (menu) => {
          const recipe =
            menu.recipes[0];

          const bomReady =
            Boolean(
              recipe &&
                recipe.items &&
                recipe.items.length >
                  0
            );

          let menuStock = 0;

          if (bomReady) {
            let possibleQty =
              Number.POSITIVE_INFINITY;

            for (
              const recipeItem of
                recipe.items
            ) {
              const recipeQty =
                Number(
                  recipeItem.qty ||
                    0
                );

              if (
                !Number.isFinite(
                  recipeQty
                ) ||
                recipeQty <= 0
              ) {
                possibleQty = 0;
                break;
              }

              const stockValue =
                stockMap.get(
                  Number(
                    recipeItem.barangId
                  )
                );

              if (
                stockValue ===
                undefined
              ) {
                possibleQty = 0;
                break;
              }

              const barang =
                recipeItem.barang;

              if (
                !barang ||
                !barang.active
              ) {
                possibleQty = 0;
                break;
              }

              const requiredBase =
                toBaseQty(
                  recipeQty,
                  recipeItem.unit,
                  barang
                );

              if (
                !Number.isFinite(
                  requiredBase
                ) ||
                requiredBase <= 0
              ) {
                possibleQty = 0;
                break;
              }

              const availableBase =
                toBaseQty(
                  stockValue,
                  barang.unit,
                  barang
                );

              if (
                !Number.isFinite(
                  availableBase
                )
              ) {
                possibleQty = 0;
                break;
              }

              const possible =
                availableBase /
                requiredBase;

              possibleQty =
                Math.min(
                  possibleQty,
                  possible
                );
            }

            menuStock =
              Number.isFinite(
                possibleQty
              )
                ? Math.max(
                    0,
                    Math.floor(
                      possibleQty
                    )
                  )
                : 0;
          }

          return {
            id: menu.id,

            menuId: menu.id,

            code: menu.code,

            name: menu.name,

            description:
              menu.description ??
              null,

            category:
              menu.category || "",

            price: Number(
              menu.price || 0
            ),

            image:
              menu.image ?? null,

            stock: menuStock,

            bomReady,

            recipeId:
              recipe?.id ??
              null,
          };
        }
      );

    return NextResponse.json({
      success: true,

      role,

      cashier: {
        id: user.id,

        fullname:
          user.fullname ||
          null,

        username:
          user.username ||
          null,
      },

      outlets,

      currentOutlet: outlet,

      menus: menuItems,

      sales,

      data: sales,

      outlet,
    });
  } catch (error: any) {
    console.error(
      "GET POS ERROR",
      error
    );

    return fail(
      error?.message ||
        "Gagal mengambil data POS.",
      500
    );
  }
}

/*
 * ============================================================
 * CREATE POS
 * ============================================================
 */
export async function POST(
  req: NextRequest
) {
  try {
    const user = await getUser();

    if (!user) {
      return fail(
        "Tidak login.",
        401
      );
    }

    const role = roleOf(user);

    if (!isPosRole(role)) {
      return fail(
        "Tidak memiliki akses POS Outlet.",
        403
      );
    }

    const body =
      await req.json().catch(
        () => ({})
      );

    const outletId =
      resolveOutletId(
        user,
        body?.outletId
      );

    if (!outletId) {
      return fail(
        role === "KASIR"
          ? "User KASIR belum memiliki outlet."
          : "Outlet belum dipilih."
      );
    }

    /*
     * OUTLET_ADMIN / KASIR terkunci ke session outlet.
     */
    if (
      (
        role === "OUTLET_ADMIN" ||
        role === "KASIR"
      ) &&
      Number(user.outletId) !==
        Number(outletId)
    ) {
      return fail(
        "Akses outlet ditolak.",
        403
      );
    }

    const customerName =
      String(
        body?.customerName || ""
      ).trim() || null;

    /*
     * ========================================================
     * PAYMENT METHOD
     * ========================================================
     */
    const paymentMethodRaw =
      String(
        body?.paymentMethod ||
          "CASH"
      )
        .trim()
        .toUpperCase();

    if (
      !PAYMENT_METHODS.includes(
        paymentMethodRaw as PosPaymentMethod
      )
    ) {
      return fail(
        `Metode pembayaran tidak valid: ${paymentMethodRaw}`
      );
    }

    const paymentMethod =
      paymentMethodRaw as PosPaymentMethod;

    const discount =
      Math.max(
        0,
        Number(
          body?.discount || 0
        )
      );

    if (
      !Number.isFinite(
        discount
      )
    ) {
      return fail(
        "Diskon tidak valid."
      );
    }

    const rawItems: SaleInputItem[] =
      Array.isArray(body?.items)
        ? body.items
        : [];

    if (!rawItems.length) {
      return fail(
        "Item POS belum diisi."
      );
    }

    const ayce =
      parseAyce(body);

    /*
     * ========================================================
     * VALIDASI AYCE
     * ========================================================
     */
    if (ayce.enabled) {
      if (!ayce.sessionId) {
        return fail(
          "Session AYCE belum tersedia."
        );
      }

      if (!ayce.tableName) {
        return fail(
          "Meja AYCE belum diisi."
        );
      }

      if (
        !Number.isInteger(
          ayce.pax
        ) ||
        ayce.pax <= 0
      ) {
        return fail(
          "Pax AYCE harus berupa bilangan bulat lebih besar dari 0."
        );
      }

      if (
        !Number.isFinite(
          ayce.packagePrice
        ) ||
        ayce.packagePrice < 0
      ) {
        return fail(
          "Harga paket AYCE tidak valid."
        );
      }

      if (!ayce.packageName) {
        return fail(
          "Paket AYCE belum dipilih."
        );
      }

      if (!ayce.expiresAt) {
        return fail(
          "Waktu berakhir session AYCE tidak valid."
        );
      }

      const nowForAyce =
        new Date();

      if (
        ayce.expiresAt <=
        nowForAyce
      ) {
        return fail(
          "Session AYCE sudah expired. Silakan tutup session dan buat session baru."
        );
      }

      if (
        ayce.startedAt &&
        ayce.startedAt >
          nowForAyce
      ) {
        return fail(
          "Waktu mulai session AYCE tidak valid."
        );
      }

      if (
        ayce.durationMinutes &&
        (
          !Number.isFinite(
            ayce.durationMinutes
          ) ||
          ayce.durationMinutes <=
            0
        )
      ) {
        return fail(
          "Durasi AYCE tidak valid."
        );
      }
    }

    /*
     * ========================================================
     * DATABASE TRANSACTION
     * ========================================================
     */
    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * ==================================================
           * VALIDASI OUTLET
           * ==================================================
           */
          const outlet =
            await tx.outlet.findUnique({
              where: {
                id: outletId,
              },

              select: {
                id: true,
                code: true,
                name: true,
                active: true,
              },
            });

          if (!outlet) {
            throw new Error(
              "Outlet tidak ditemukan."
            );
          }

          if (!outlet.active) {
            throw new Error(
              "Outlet sedang tidak aktif."
            );
          }

          /*
           * ==================================================
           * GABUNGKAN MENU YANG SAMA
           * ==================================================
           */
          const menuQty =
            new Map<
              number,
              number
            >();

          for (
            const rawItem of
              rawItems
          ) {
            const menuId =
              Number(
                rawItem?.menuId ||
                  0
              );

            const qty =
              Number(
                rawItem?.qty ||
                  0
              );

            if (
              !Number.isInteger(
                menuId
              ) ||
              menuId <= 0
            ) {
              throw new Error(
                "Menu tidak valid."
              );
            }

            if (
              !Number.isFinite(
                qty
              ) ||
              qty <= 0
            ) {
              throw new Error(
                `Qty menu ${menuId} harus lebih besar dari 0.`
              );
            }

            menuQty.set(
              menuId,
              (
                menuQty.get(
                  menuId
                ) || 0
              ) + qty
            );
          }

          const menuIds =
            [
              ...menuQty.keys(),
            ];

          /*
           * ==================================================
           * AMBIL SEMUA MENU + BOM
           * ==================================================
           */
          const menus =
            await tx.menu.findMany({
              where: {
                id: {
                  in: menuIds,
                },

                active: true,
              },

              select: {
                id: true,
                code: true,
                name: true,
                price: true,

                recipes: {
                  where: {
                    active: true,
                  },

                  select: {
                    id: true,

                    items: {
                      select: {
                        barangId: true,
                        qty: true,
                        unit: true,

                        barang: {
                          select: {
                            id: true,
                            name: true,
                            unit: true,
                            baseUnit: true,
                            conversionRate:
                              true,
                            purchasePrice:
                              true,
                            active: true,
                          },
                        },
                      },
                    },
                  },

                  orderBy: {
                    id: "asc",
                  },
                },
              },
            });

          if (
            menus.length !==
            menuIds.length
          ) {
            const found =
              new Set(
                menus.map(
                  (menu) =>
                    menu.id
                )
              );

            const missing =
              menuIds.filter(
                (id) =>
                  !found.has(id)
              );

            throw new Error(
              `Menu tidak ditemukan atau tidak aktif: ${missing.join(
                ", "
              )}`
            );
          }

          const menuMap =
            new Map(
              menus.map(
                (menu) => [
                  menu.id,
                  menu,
                ]
              )
            );

          /*
           * ==================================================
           * REQUIRED BOM
           * ==================================================
           */
          const required =
            new Map<
              number,
              RequiredBom
            >();

          let subtotal = 0;

          const saleItems:
            Array<{
              menuId:
                | number
                | null;

              barangId:
                | number
                | null;

              qty: number;

              unitPrice: number;

              subtotal: number;
            }> = [];

          let ayceAddOnSubtotal =
            0;

          /*
           * ==================================================
           * HITUNG MENU + BOM
           * ==================================================
           */
          for (
            const menuId of
              menuIds
          ) {
            const menu =
              menuMap.get(
                menuId
              );

            if (!menu) {
              throw new Error(
                "Menu tidak ditemukan."
              );
            }

            const qty =
              menuQty.get(
                menuId
              ) || 0;

            const unitPrice =
              Number(
                menu.price || 0
              );

            if (
              !Number.isFinite(
                unitPrice
              ) ||
              unitPrice < 0
            ) {
              throw new Error(
                `Harga menu ${menu.name} tidak valid.`
              );
            }

            const addon =
              ayce.enabled &&
              isAyceAddOn(
                menu,
                ayce.addOnMenuIds
              );

            const itemSubtotal =
              ayce.enabled
                ? addon
                  ? unitPrice *
                    qty
                  : 0
                : unitPrice *
                  qty;

            if (
              ayce.enabled &&
              addon
            ) {
              ayceAddOnSubtotal +=
                itemSubtotal;
            }

            saleItems.push({
              menuId,

              barangId: null,

              qty,

              unitPrice:
                ayce.enabled &&
                !addon
                  ? 0
                  : unitPrice,

              subtotal:
                itemSubtotal,
            });

            const recipe =
              menu.recipes[0];

            if (
              !recipe ||
              !recipe.items.length
            ) {
              throw new Error(
                `BOM menu "${menu.name}" belum tersedia.`
              );
            }

            for (
              const recipeItem of
                recipe.items
            ) {
              const barang =
                recipeItem.barang;

              if (
                !barang ||
                !barang.active
              ) {
                throw new Error(
                  `Barang BOM untuk menu "${menu.name}" tidak ditemukan atau tidak aktif.`
                );
              }

              const recipeQty =
                Number(
                  recipeItem.qty ||
                    0
                );

              if (
                !Number.isFinite(
                  recipeQty
                ) ||
                recipeQty <= 0
              ) {
                throw new Error(
                  `Qty BOM ${barang.name} pada menu "${menu.name}" tidak valid.`
                );
              }

              /*
               * Selalu konversi kebutuhan BOM
               * menjadi BASE UNIT.
               */
              const qtyBasePerMenu =
                toBaseQty(
                  recipeQty,
                  recipeItem.unit,
                  barang
                );

              if (
                !Number.isFinite(
                  qtyBasePerMenu
                ) ||
                qtyBasePerMenu <=
                  0
              ) {
                throw new Error(
                  `Konversi BOM ${barang.name} pada menu "${menu.name}" tidak valid.`
                );
              }

              const qtyBase =
                qtyBasePerMenu *
                qty;

              const existing =
                required.get(
                  recipeItem.barangId
                );

              const rate =
                getConversionRate(
                  barang
                );

              const mainCost =
                Number(
                  barang.purchasePrice ||
                    0
                );

              const unitCostBase =
                rate > 0
                  ? mainCost /
                    rate
                  : mainCost;

              required.set(
                recipeItem.barangId,
                {
                  barangId:
                    recipeItem.barangId,

                  qtyBase:
                    (
                      existing?.qtyBase ||
                      0
                    ) +
                    qtyBase,

                  barangName:
                    barang.name,

                  baseUnit:
                    barang.baseUnit ||
                    barang.unit ||
                    "base",

                  unitCostBase:
                    existing?.unitCostBase ??
                    unitCostBase,
                }
              );
            }
          }

          /*
           * ==================================================
           * AYCE PACKAGE
           * ==================================================
           */
          if (ayce.enabled) {
            const packageTotal =
              ayce.packagePrice *
              ayce.pax;

            if (
              !Number.isFinite(
                packageTotal
              ) ||
              packageTotal < 0
            ) {
              throw new Error(
                "Total paket AYCE tidak valid."
              );
            }

            subtotal =
              packageTotal +
              ayceAddOnSubtotal;

            /*
             * Virtual package item.
             */
            saleItems.unshift({
              menuId: null,

              barangId: null,

              qty: ayce.pax,

              unitPrice:
                ayce.packagePrice,

              subtotal:
                packageTotal,
            });
          } else {
            subtotal =
              saleItems.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  item.subtotal,
                0
              );
          }

          if (!saleItems.length) {
            throw new Error(
              "Item POS kosong."
            );
          }

          /*
           * ==================================================
           * VALIDASI DISKON
           * ==================================================
           */
          if (
            !Number.isFinite(
              discount
            ) ||
            discount < 0
          ) {
            throw new Error(
              "Diskon tidak valid."
            );
          }

          if (
            discount > subtotal
          ) {
            throw new Error(
              "Diskon tidak boleh melebihi subtotal."
            );
          }

          /*
           * ==================================================
           * TAX / SERVICE
           * ==================================================
           *
           * SUBTOTAL
           *     ↓
           * DISCOUNT
           *     ↓
           * TAXABLE
           *     ↓
           * SERVICE 5%
           *     ↓
           * PPN 10% dari taxable + service
           *     ↓
           * GRAND TOTAL
           */
          const taxable =
            Math.max(
              0,
              subtotal -
                discount
            );

          if (
            !Number.isFinite(
              taxable
            )
          ) {
            throw new Error(
              "Taxable amount tidak valid."
            );
          }

          const serviceCharge =
            taxable * 0.05;

          const ppn =
            (
              taxable +
              serviceCharge
            ) * 0.1;

          const total =
            Math.max(
              0,
              taxable +
                serviceCharge +
                ppn
            );

          if (
            !Number.isFinite(
              serviceCharge
            ) ||
            serviceCharge < 0
          ) {
            throw new Error(
              "Service Charge tidak valid."
            );
          }

          if (
            !Number.isFinite(
              ppn
            ) ||
            ppn < 0
          ) {
            throw new Error(
              "PPN tidak valid."
            );
          }

          if (
            !Number.isFinite(
              total
            )
          ) {
            throw new Error(
              "Grand Total transaksi tidak valid."
            );
          }

          /*
           * ==================================================
           * PEMBAYARAN
           * ==================================================
           */
          const paidAmount =
            Number(
              body?.paidAmount ??
                total
            );

          if (
            !Number.isFinite(
              paidAmount
            ) ||
            paidAmount < total
          ) {
            throw new Error(
              `Pembayaran kurang. Grand Total ${total}, dibayar ${paidAmount}.`
            );
          }

          const cashLikeMethods =
            new Set<PosPaymentMethod>(
              ["CASH"]
            );

          /*
           * Semua metode selain CASH
           * harus exact payment.
           */
          if (
            !cashLikeMethods.has(
              paymentMethod
            ) &&
            Math.abs(
              paidAmount -
                total
            ) > 0.01
          ) {
            throw new Error(
              `Pembayaran ${paymentMethod} harus sama persis dengan Grand Total ${total}.`
            );
          }

          const changeAmount =
            cashLikeMethods.has(
              paymentMethod
            )
              ? Math.max(
                  0,
                  paidAmount -
                    total
                )
              : 0;

          /*
           * ==================================================
           * AMBIL SEMUA OUTLET STOCK SEKALI
           * ==================================================
           */
          const requiredBarangIds =
            [
              ...required.keys(),
            ];

          const outletStocks =
            requiredBarangIds.length
              ? await tx.outletStock.findMany(
                  {
                    where: {
                      outletId,

                      barangId: {
                        in:
                          requiredBarangIds,
                      },
                    },

                    select: {
                      barangId:
                        true,

                      stock:
                        true,

                      averageCost:
                        true,
                    },
                  }
                )
              : [];

          const outletStockMap =
            new Map<
              number,
              {
                stock: number;
                averageCost: number;
              }
            >();

          for (
            const stock of
              outletStocks
          ) {
            outletStockMap.set(
              Number(
                stock.barangId
              ),
              {
                stock: Number(
                  stock.stock ||
                    0
                ),

                averageCost:
                  Number(
                    stock.averageCost ||
                      0
                  ),
              }
            );
          }

          /*
           * ==================================================
           * VALIDASI STOCK
           * ==================================================
           */
          for (
            const [
              barangId,
              requirement,
            ] of required
          ) {
            const stock =
              outletStockMap.get(
                barangId
              );

            if (!stock) {
              throw new Error(
                `Stok outlet untuk ${requirement.barangName} belum tersedia.`
              );
            }

            const menuContainingBarang =
              menus.find(
                (menu) =>
                  menu.recipes.some(
                    (recipe) =>
                      recipe.items.some(
                        (item) =>
                          Number(
                            item.barangId
                          ) ===
                          Number(
                            barangId
                          )
                      )
                  )
              );

            const barang =
              menuContainingBarang?.recipes
                .flatMap(
                  (recipe) =>
                    recipe.items
                )
                .find(
                  (item) =>
                    Number(
                      item.barangId
                    ) ===
                    Number(
                      barangId
                    )
                )?.barang;

            if (
              !barang ||
              !barang.active
            ) {
              throw new Error(
                `Barang ${requirement.barangName} tidak ditemukan atau tidak aktif.`
              );
            }

            const availableBase =
              toBaseQty(
                stock.stock,
                barang.unit,
                barang
              );

            if (
              !Number.isFinite(
                availableBase
              )
            ) {
              throw new Error(
                `Stock ${requirement.barangName} tidak valid.`
              );
            }

            if (
              availableBase +
                1e-9 <
              requirement.qtyBase
            ) {
              throw new Error(
                `Stock ${requirement.barangName} tidak cukup. ` +
                  `Butuh ${requirement.qtyBase} ${requirement.baseUnit}, ` +
                  `tersedia ${availableBase} ${requirement.baseUnit}.`
              );
            }

            /*
             * averageCost disimpan pada stock unit.
             * Konversikan ke base cost.
             */
            const averageCostMain =
              Number(
                stock.averageCost ||
                  0
              );

            const rate =
              getConversionRate(
                barang
              );

            requirement.unitCostBase =
              averageCostMain >
                  0 &&
                rate > 0
                ? averageCostMain /
                  rate
                : requirement.unitCostBase;
          }

          const now =
            new Date();

          /*
           * Nomor transaksi.
           */
          const number =
            `POS-${outlet.code}-${now
              .toISOString()
              .replace(
                /\D/g,
                ""
              )
              .slice(
                0,
                14
              )}-${Math.floor(
              Math.random() *
                1000
            )
              .toString()
              .padStart(
                3,
                "0"
              )}`;

          /*
           * ==================================================
           * CREATE SALE
           * ==================================================
           */
          const sale =
            await tx.outletSale.create(
              {
                data: {
                  number,

                  outletId,

                  userId:
                    user.id,

                  customerName,

                  saleDate: now,

                  subtotal,

                  discount,

                  /*
                   * Taxable tidak perlu disimpan.
                   * Dihitung ulang dari subtotal - discount.
                   */

                  serviceCharge,

                  ppn,

                  /*
                   * total = GRAND TOTAL
                   */
                  total,

                  paidAmount,

                  changeAmount,

                  paymentMethod,

                  status:
                    "PAID",

                  items: {
                    create:
                      saleItems.map(
                        (
                          item
                        ) => ({
                          barangId:
                            item.barangId,

                          menuId:
                            item.menuId,

                          qty:
                            item.qty,

                          unitPrice:
                            item.unitPrice,

                          subtotal:
                            item.subtotal,
                        })
                      ),
                  },
                },

                include: {
                  items: {
                    include: {
                      menu: true,
                      barang: true,
                    },
                  },

                  outlet: true,

                  user: {
                    select: {
                      id: true,

                      fullname:
                        true,

                      username:
                        true,
                    },
                  },
                },
              }
            );

          /*
           * ==================================================
           * POTONG STOCK BOM
           * ==================================================
           *
           * deltaBaseQty SELALU BASE UNIT.
           */
          for (
            const [
              barangId,
              requirement,
            ] of required
          ) {
            const stockResult =
              await changeOutletStock(
                tx,
                {
                  outletId,

                  barangId,

                  deltaBaseQty:
                    -requirement.qtyBase,

                  reference:
                    sale.number,

                  description:
                    ayce.enabled
                      ? `POS ${sale.number} - AYCE ${ayce.packageName} - konsumsi BOM`
                      : `POS ${sale.number} - konsumsi BOM`,
                }
              );

            const stockAfter =
              Number(
                stockResult.stockAfter ??
                  0
              );

            const qtyOut =
              Math.abs(
                Number(
                  stockResult.deltaStockUnit ??
                    0
                )
              );

            const cachedStock =
              outletStockMap.get(
                barangId
              );

            const stockUnitCost =
              Number(
                cachedStock?.averageCost ??
                  0
              );

            const unitPrice =
              stockUnitCost > 0
                ? stockUnitCost
                : Number(
                    requirement.unitCostBase ||
                      0
                  );

            /*
             * ==================================================
             * STOCK CARD
             * ==================================================
             */
            await tx.stockCard.create(
              {
                data: {
                  barangId,

                  trxDate:
                    now,

                  trxType:
                    "POS_OUT",

                  trxNumber:
                    sale.number,

                  referenceId:
                    sale.id,

                  warehouse:
                    `OUTLET:${outlet.code}`,

                  qtyIn: 0,

                  qtyOut,

                  balance:
                    stockAfter,

                  unitPrice,

                  totalValue:
                    qtyOut *
                    unitPrice,

                  note:
                    ayce.enabled
                      ? `POS ${sale.number} - AYCE ${ayce.packageName} - konsumsi ${requirement.qtyBase} ${requirement.baseUnit}`
                      : `POS ${sale.number} - konsumsi BOM [${requirement.qtyBase} ${requirement.baseUnit}]`,
                },
              }
            );
          }

          /*
           * ==================================================
           * HISTORY
           * ==================================================
           */
          const historyDescription =
            ayce.enabled
              ? [
                  `POS ${outlet.name} ${sale.number} berhasil.`,

                  `AYCE SESSION ${ayce.sessionId}.`,

                  `MEJA ${ayce.tableName}.`,

                  `PAX ${ayce.pax}.`,

                  `PAKET ${ayce.packageName}.`,

                  `HARGA PAKET ${ayce.packagePrice}.`,

                  ayce.durationMinutes
                    ? `DURASI ${ayce.durationMinutes} MENIT.`
                    : null,

                  ayce.startedAt
                    ? `START ${ayce.startedAt.toISOString()}.`
                    : null,

                  ayce.expiresAt
                    ? `EXPIRE ${ayce.expiresAt.toISOString()}.`
                    : null,

                  `SUBTOTAL ${subtotal}.`,

                  `DISCOUNT ${discount}.`,

                  `SERVICE ${serviceCharge}.`,

                  `PPN ${ppn}.`,

                  `GRAND TOTAL ${total}.`,

                  `ADD-ON ${ayceAddOnSubtotal}.`,

                  `STOCK BOM otomatis terpakai sebagai consumption.`,

                  body?.note
                    ? `CATATAN: ${String(
                        body.note
                      ).trim()}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" ")
              : [
                  `POS ${outlet.name} ${sale.number} berhasil.`,

                  `SUBTOTAL ${subtotal}.`,

                  `DISCOUNT ${discount}.`,

                  `SERVICE ${serviceCharge}.`,

                  `PPN ${ppn}.`,

                  `GRAND TOTAL ${total}.`,

                  `Stock BOM otomatis terpakai.`,

                  body?.note
                    ? `CATATAN: ${String(
                        body.note
                      ).trim()}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" ");

          await tx.history.create(
            {
              data: {
                transactionType:
                  "STOCK_OUT",

                referenceNumber:
                  sale.number,

                userId:
                  user.id,

                description:
                  historyDescription,
              },
            }
          );

          return {
            ...sale,

            /*
             * Komponen pricing dikembalikan
             * secara eksplisit supaya frontend
             * dapat langsung menggunakan hasil
             * server.
             */
            pricing: {
              subtotal,

              discount,

              taxable,

              serviceCharge,

              serviceRate:
                0.05,

              ppn,

              ppnRate:
                0.1,

              total,

              grandTotal:
                total,

              paidAmount,

              changeAmount,
            },

            ayce: ayce.enabled
              ? {
                  enabled: true,

                  sessionId:
                    ayce.sessionId,

                  tableName:
                    ayce.tableName,

                  pax:
                    ayce.pax,

                  packageKey:
                    ayce.packageKey,

                  packageName:
                    ayce.packageName,

                  packagePrice:
                    ayce.packagePrice,

                  packageTotal:
                    ayce.packagePrice *
                    ayce.pax,

                  addOnSubtotal:
                    ayceAddOnSubtotal,

                  durationMinutes:
                    ayce.durationMinutes,

                  startedAt:
                    ayce.startedAt?.toISOString() ??
                    null,

                  expiresAt:
                    ayce.expiresAt?.toISOString() ??
                    null,
                }
              : null,
          };
        }
      );

    return NextResponse.json(
      {
        success: true,

        message:
          ayce.enabled
            ? "Transaksi AYCE berhasil. Consumption BOM otomatis mengurangi stock outlet."
            : "Transaksi POS berhasil. Stock BOM otomatis terpakai.",

        data: result,
      },
      {
        status: 201,
      }
    );
  } catch (error: any) {
    console.error(
      "CREATE POS ERROR",
      error
    );

    return fail(
      error?.message ||
        "Gagal membuat transaksi POS.",
      400
    );
  }
}