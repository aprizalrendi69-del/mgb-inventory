import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getConversionRate, toBaseQty } from "@/lib/base-unit";
import { changeOutletStock } from "@/lib/outlet-stock-ledger";

const fail = (message: string, status = 400) =>
  NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );

async function getUser() {
  const cookieStore = await cookies();

  const session =
    cookieStore.get("erp-session") ||
    cookieStore.get("session");

  if (!session) return null;

  let userId = 0;

  try {
    const dbSession = await prisma.session.findUnique({
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

    if (dbSession && dbSession.expiresAt > new Date()) {
      userId = dbSession.user.id;
    }
  } catch {
    // fallback di bawah
  }

  if (!userId) {
    try {
      const parsed = JSON.parse(session.value);

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
      },
    })
    .then((user) =>
      user?.active ? user : null
    );
}

function roleOf(user: { role: unknown }) {
  return String(user.role).toUpperCase();
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
   * ==========================================================
   * USER YANG TERIKAT KE OUTLET
   * ==========================================================
   *
   * OUTLET_ADMIN:
   * selalu memakai outlet dari session.
   *
   * KASIR:
   * selalu memakai outlet dari session.
   *
   * Requested outlet dari browser TIDAK dipercaya.
   */
  if (
    role === "OUTLET_ADMIN" ||
    role === "KASIR"
  ) {
    return Number(user.outletId || 0);
  }

  /*
   * ==========================================================
   * ADMIN / MANAGER
   * ==========================================================
   *
   * Boleh memilih outlet melalui request.
   */
  return Number(requestedOutletId || 0);
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function isAyceAddOn(menu: {
  category?: string | null;
  name?: string | null;
}, explicitAddOnIds: Set<number>) {
  if (explicitAddOnIds.has(Number((menu as any).id))) {
    return true;
  }

  const category = normalizeText(menu.category);
  const name = normalizeText(menu.name);

  /*
   * AYCE default:
   * - FOOD / SIDE / SOUP = termasuk paket
   * - DRINK / DESSERT = add-on berbayar
   *
   * Jika frontend mengirim addOnMenuIds, daftar tersebut
   * menjadi sumber tambahan untuk item berbayar.
   */
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

  if (!raw || typeof raw !== "object") {
    return {
      enabled: false,
      sessionId: null as string | null,
      tableName: null as string | null,
      pax: 0,
      packageKey: null as string | null,
      packageName: null as string | null,
      packagePrice: 0,
      durationMinutes: 0,
      startedAt: null as Date | null,
      expiresAt: null as Date | null,
      addOnMenuIds: new Set<number>(),
    };
  }

  const enabled =
    raw.enabled === true ||
    raw.enabled === 1 ||
    String(raw.enabled).toLowerCase() === "true";

  const pax = Number(raw.pax || 0);
  const packagePrice = Number(
    raw.packagePrice || 0
  );
  const durationMinutes = Number(
    raw.durationMinutes || 0
  );

  const addOnMenuIds = new Set<number>();

  if (Array.isArray(raw.addOnMenuIds)) {
    for (const id of raw.addOnMenuIds) {
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
      String(raw.sessionId || "").trim() ||
      null,
    tableName:
      String(raw.tableName || "").trim() ||
      null,
    pax,
    packageKey:
      String(raw.packageKey || "").trim() ||
      null,
    packageName:
      String(raw.packageName || "").trim() ||
      null,
    packagePrice,
    durationMinutes,
    startedAt: parseIsoDate(raw.startedAt),
    expiresAt: parseIsoDate(raw.expiresAt),
    addOnMenuIds,
  };
}

/*
 * ============================================================
 * GET POS
 * ============================================================
 *
 * Initial request:
 *
 *   GET /api/outlet/pos
 *
 * OUTLET_ADMIN:
 * -> otomatis menggunakan outlet dari session.
 *
 * KASIR:
 * -> otomatis menggunakan outlet dari session.
 * -> TIDAK BOLEH memilih outlet lain.
 *
 * ADMIN / MANAGER:
 * -> menggunakan outlet dari request.
 * -> jika belum ada, gunakan outlet aktif pertama.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return fail("Tidak login.", 401);
    }

    const role = roleOf(user);

    if (
      ![
        "ADMIN",
        "MANAGER",
        "OUTLET_ADMIN",
        "KASIR",
      ].includes(role)
    ) {
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
      Number(requestedRaw || 0);

    const outletRows =
      await prisma.outlet.findMany({
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
      });

    const outlets =
      role === "OUTLET_ADMIN" ||
      role === "KASIR"
        ? outletRows.filter(
            (outlet) =>
              Number(outlet.id) ===
              Number(user.outletId)
          )
        : outletRows;

    let outletId = resolveOutletId(
      user,
      requestedOutletId
    );

    if (
      role !== "OUTLET_ADMIN" &&
      role !== "KASIR" &&
      !outletId
    ) {
      outletId =
        outlets[0]?.id || 0;
    }

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

    if (!outletId) {
      return NextResponse.json({
        success: true,
        role,
        cashier: {
          id: user.id,
          fullname:
            user.fullname || null,
          username:
            user.username || null,
        },
        outlets: [],
        currentOutlet: null,
        menus: [],
        sales: [],
        data: [],
        outlet: null,
      });
    }

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

    const selectedOutlet =
      outlets.find(
        (outlet) =>
          Number(outlet.id) ===
          Number(outletId)
      ) || null;

    if (!selectedOutlet) {
      return fail(
        "Outlet tidak ditemukan.",
        404
      );
    }

    const outlet =
      await prisma.outlet.findUnique({
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
      return fail(
        "Outlet tidak ditemukan.",
        404
      );
    }

    if (!outlet.active) {
      return fail(
        "Outlet sedang tidak aktif.",
        400
      );
    }

    const menuRows =
      await prisma.menu.findMany({
        where: {
          active: true,
        },
        include: {
          recipes: {
            where: {
              active: true,
            },
            include: {
              items: {
                include: {
                  barang: true,
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
      });

    const menuItems = [];

    for (const menu of menuRows) {
      const recipe =
        menu.recipes[0];

      const bomReady =
        Boolean(
          recipe &&
            recipe.items &&
            recipe.items.length > 0
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
              recipeItem.qty || 0
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

          const stock =
            await prisma.outletStock.findUnique(
              {
                where: {
                  outletId_barangId: {
                    outletId,
                    barangId:
                      recipeItem.barangId,
                  },
                },
                select: {
                  stock: true,
                },
              }
            );

          if (!stock) {
            possibleQty = 0;
            break;
          }

          const requiredBase =
            toBaseQty(
              recipeQty,
              recipeItem.unit,
              recipeItem.barang
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
              Number(
                stock.stock || 0
              ),
              recipeItem.barang.unit,
              recipeItem.barang
            );

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

      menuItems.push({
        id: menu.id,
        menuId: menu.id,
        code: menu.code,
        name: menu.name,
        description:
          menu.description ?? null,
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
          recipe?.id ?? null,
      });
    }

    const sales =
      await prisma.outletSale.findMany({
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
      });

    return NextResponse.json({
      success: true,
      role,
      cashier: {
        id: user.id,
        fullname:
          user.fullname || null,
        username:
          user.username || null,
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
 *
 * Normal POS:
 *   Menu -> BOM -> OutletStock -> StockCard
 *
 * AYCE:
 *   Meja -> Session -> Pax -> Paket -> Timer
 *   -> Order -> Consumption -> Payment
 *
 * Catatan penting:
 * - AYCE TIDAK membuat stock menjadi 0-price/free.
 * - Harga paket menjadi nilai transaksi.
 * - Semua menu AYCE tetap menjalankan BOM consumption.
 * - Drink / Dessert dianggap add-on berbayar secara default.
 * - addOnMenuIds dapat dikirim frontend jika ada item lain
 *   yang harus dianggap add-on.
 *
 * Schema saat ini belum memiliki tabel AyceSession/
 * AyceConsumption. Karena itu metadata session disimpan
 * di History, sementara konsumsi stock tetap menggunakan
 * OutletStock + StockCard dalam transaksi database yang sama.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return fail(
        "Tidak login.",
        401
      );
    }

    const role = roleOf(user);

    if (
      ![
        "ADMIN",
        "MANAGER",
        "OUTLET_ADMIN",
        "KASIR",
      ].includes(role)
    ) {
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

    const paymentMethod =
      String(
        body?.paymentMethod ||
          "CASH"
      )
        .trim()
        .toUpperCase();

    const allowedPaymentMethods = [
      "CASH",
      "TRANSFER",
      "QRIS",
      "CARD",
      "DEBIT",
      "CREDIT",
    ];

    if (
      !allowedPaymentMethods.includes(
        paymentMethod
      )
    ) {
      return fail(
        `Metode pembayaran tidak valid: ${paymentMethod}`
      );
    }

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

    const ayce = parseAyce(body);

    /*
     * ========================================================
     * VALIDASI SESSION AYCE
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

      if (
        !ayce.packageName
      ) {
        return fail(
          "Paket AYCE belum dipilih."
        );
      }

      if (
        !ayce.expiresAt
      ) {
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
          ayce.durationMinutes <= 0
        )
      ) {
        return fail(
          "Durasi AYCE tidak valid."
        );
      }
    }

    const result =
      await prisma.$transaction(
        async (tx) => {
          const outlet =
            await tx.outlet.findUnique(
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
                rawItem?.qty || 0
              );

            if (!menuId) {
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
              (menuQty.get(
                menuId
              ) || 0) + qty
            );
          }

          const menuIds =
            [...menuQty.keys()];

          const menus =
            await tx.menu.findMany(
              {
                where: {
                  id: {
                    in: menuIds,
                  },
                  active: true,
                },
                include: {
                  recipes: {
                    where: {
                      active: true,
                    },
                    include: {
                      items: {
                        include: {
                          barang: true,
                        },
                      },
                    },
                    orderBy: {
                      id: "asc",
                    },
                  },
                },
              }
            );

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

          const required =
            new Map<
              number,
              RequiredBom
            >();

          /*
           * Untuk normal POS:
           * subtotal = harga menu x qty.
           *
           * Untuk AYCE:
           * subtotal = harga paket x pax + add-on.
           *
           * Paket dibuat sebagai sale item virtual
           * (menuId/barangId null) agar OutletSaleItem tetap
           * dapat merepresentasikan nilai paket tanpa
           * mengubah tabel Prisma.
           */
          let subtotal = 0;

          const saleItems: Array<{
            menuId: number | null;
            barangId: number | null;
            qty: number;
            unitPrice: number;
            subtotal: number;
          }> = [];

          let ayceAddOnSubtotal = 0;

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
                  ? unitPrice * qty
                  : 0
                : unitPrice * qty;

            if (ayce.enabled && addon) {
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
                  `Qty BOM ${recipeItem.barang.name} pada menu "${menu.name}" tidak valid.`
                );
              }

              const qtyBasePerMenu =
                toBaseQty(
                  recipeQty,
                  recipeItem.unit,
                  recipeItem.barang
                );

              if (
                !Number.isFinite(
                  qtyBasePerMenu
                ) ||
                qtyBasePerMenu <= 0
              ) {
                throw new Error(
                  `Konversi BOM ${recipeItem.barang.name} pada menu "${menu.name}" tidak valid.`
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
                  recipeItem.barang
                );

              const mainCost =
                Number(
                  recipeItem
                    .barang
                    .purchasePrice ||
                    0
                );

              const unitCostBase =
                rate > 0
                  ? mainCost / rate
                  : mainCost;

              required.set(
                recipeItem.barangId,
                {
                  qtyBase:
                    (existing?.qtyBase ||
                      0) +
                    qtyBase,

                  barangName:
                    recipeItem
                      .barang
                      .name,

                  baseUnit:
                    recipeItem
                      .barang
                      .baseUnit ||
                    recipeItem
                      .barang
                      .unit ||
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
             * Package charge disimpan sebagai
             * OutletSaleItem virtual:
             *
             * menuId = null
             * barangId = null
             * qty = pax
             * unitPrice = packagePrice
             *
             * Dengan demikian:
             * subtotal sale == subtotal item.
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
                (sum, item) =>
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

          const total =
            Math.max(
              0,
              subtotal -
                discount
            );

          if (
            !Number.isFinite(
              total
            )
          ) {
            throw new Error(
              "Total transaksi tidak valid."
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
              `Pembayaran kurang. Total ${total}, dibayar ${paidAmount}.`
            );
          }

          const cashLikeMethods =
            new Set(["CASH"]);

          if (
            !cashLikeMethods.has(
              paymentMethod
            ) &&
            Math.abs(
              paidAmount - total
            ) > 0.01
          ) {
            throw new Error(
              `Pembayaran ${paymentMethod} harus sama persis dengan total ${total}.`
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
           * VALIDASI STOCK SEBELUM PERUBAHAN
           * ==================================================
           *
           * Ini berlaku baik POS normal maupun AYCE.
           *
           * AYCE Rp0 pada item bukan berarti BOM gratis.
           * Semua BOM tetap mengurangi OutletStock.
           */
          for (
            const [
              barangId,
              requirement,
            ] of required
          ) {
            const stock =
              await tx.outletStock.findUnique(
                {
                  where: {
                    outletId_barangId: {
                      outletId,
                      barangId,
                    },
                  },
                  select: {
                    stock: true,
                    averageCost:
                      true,
                  },
                }
              );

            if (!stock) {
              throw new Error(
                `Stok outlet untuk ${requirement.barangName} belum tersedia.`
              );
            }

            const barang =
              await tx.barang.findUnique(
                {
                  where: {
                    id: barangId,
                  },
                  select: {
                    unit: true,
                    baseUnit: true,
                    conversionRate: true,
                    active: true,
                  },
                }
              );

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
                Number(
                  stock.stock || 0
                ),
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
              averageCostMain > 0 &&
              rate > 0
                ? averageCostMain /
                  rate
                : requirement.unitCostBase;
          }

          const now =
            new Date();

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
                  total,
                  paidAmount,
                  changeAmount,
                  paymentMethod,
                  status: "PAID",

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
           * deltaBaseQty harus BASE UNIT.
           *
           * Satu transaksi database:
           * Sale + OutletStock + StockCard + History
           * akan commit atau rollback bersama.
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

            const stockAfterRow =
              await tx.outletStock.findUnique(
                {
                  where: {
                    outletId_barangId: {
                      outletId,
                      barangId,
                    },
                  },
                  select: {
                    stock: true,
                    averageCost:
                      true,
                  },
                }
              );

            await tx.stockCard.create({
              data: {
                barangId,
                trxDate: now,
                trxType:
                  "POS_OUT",
                trxNumber:
                  sale.number,
                referenceId:
                  sale.id,
                warehouse:
                  `OUTLET:${outlet.code}`,
                qtyIn: 0,
                qtyOut:
                  Math.abs(
                    stockResult.deltaStockUnit
                  ),
                balance:
                  Number(
                    stockAfterRow?.stock ??
                      stockResult.stockAfter
                  ),
                unitPrice:
                  Number(
                    stockAfterRow?.averageCost ??
                      requirement.unitCostBase ??
                      0
                  ),
                totalValue:
                  Math.abs(
                    stockResult.deltaStockUnit
                  ) *
                  Number(
                    stockAfterRow?.averageCost ??
                      requirement.unitCostBase ??
                      0
                  ),
                note:
                  ayce.enabled
                    ? `POS ${sale.number} - AYCE ${ayce.packageName} - konsumsi ${requirement.qtyBase} ${requirement.baseUnit}`
                    : `POS ${sale.number} - konsumsi BOM [${requirement.qtyBase} ${requirement.baseUnit}]`,
              },
            });
          }

          /*
           * ==================================================
           * HISTORY
           * ==================================================
           *
           * Schema saat ini belum mempunyai tabel session AYCE.
           * Metadata penting session tetap dicatat di History
           * agar transaksi dapat diaudit tanpa migration destruktif.
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
                  `Stock BOM otomatis terpakai.`,
                  body?.note
                    ? `CATATAN: ${String(
                        body.note
                      ).trim()}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" ");

          await tx.history.create({
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
          });

          return {
            ...sale,
            ayce: ayce.enabled
              ? {
                  enabled: true,
                  sessionId:
                    ayce.sessionId,
                  tableName:
                    ayce.tableName,
                  pax: ayce.pax,
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
        message: ayce.enabled
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
