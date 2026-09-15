import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { toBaseQty } from "@/lib/base-unit";

/*
 * =========================================================
 * MANUFACTURE ORDERS API
 * =========================================================
 *
 * IMPORTANT:
 *
 * ManufactureOrder memiliki relation outlet. GET tetap menjaga response kompatibel.
 *
 * STOCK MANUFACTURE:
 *   Selalu OutletStock.
 *
 * TIDAK menyentuh:
 *   - Barang.stock
 *   - Inventory.stock pusat
 * =========================================================
 */

async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session?.value) {
    return null;
  }

  /*
   * =======================================================
   * SESSION TOKEN
   * =======================================================
   */

  try {
    const userBySession = await prisma.user.findFirst({
      where: {
        sessions: {
          some: {
            token: session.value,
            expiresAt: {
              gt: new Date(),
            },
          },
        },
      },
      include: {
        outlet: true,
      },
    });

    if (userBySession && userBySession.active) {
      return userBySession;
    }
  } catch {
    // Lanjut mencoba JSON session.
  }

  /*
   * =======================================================
   * JSON SESSION
   * =======================================================
   */

  try {
    const sessionData = JSON.parse(session.value);

    const userId = Number(
      sessionData?.user?.id ?? sessionData?.id
    );

    if (!Number.isInteger(userId) || userId <= 0) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        outlet: true,
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

/*
 * =========================================================
 * ROLE
 * =========================================================
 */

function canManufacture(role: string) {
  return (
    role === "ADMIN" ||
    role === "MANAGER" ||
    role === "OUTLET_ADMIN"
  );
}

/*
 * =========================================================
 * GET
 * =========================================================
 *
 * ADMIN / MANAGER:
 *   semua outlet jika outletId tidak diberikan.
 *
 * ADMIN / MANAGER:
 *   filter outlet tertentu jika outletId diberikan.
 *
 * OUTLET_ADMIN:
 *   hanya outlet sendiri.
 *
 * Query:
 *
 * ?outletId=4
 * ?status=COMPLETED
 * ?search=MO-202608
 * =========================================================
 */



export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.active) return NextResponse.json({ success: false, message: "Tidak login." }, { status: 401 });
    const role = String(user.role).toUpperCase();
    if (!canManufacture(role)) return NextResponse.json({ success: false, message: "Tidak memiliki akses Manufacture." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const requestedOutletId = Number(body?.outletId || 0);
    const outletId = role === "OUTLET_ADMIN" ? Number(user.outletId || 0) : requestedOutletId;
    if (!Number.isInteger(outletId) || outletId <= 0) throw new Error("Outlet produksi wajib dipilih.");
    if (role === "OUTLET_ADMIN" && Number(user.outletId) !== outletId) throw new Error("Akses outlet ditolak.");

    const recipeId = Number(body?.recipeId || 0);
    const plannedQty = Number(body?.plannedQty || 0);
    if (!Number.isInteger(recipeId) || recipeId <= 0) throw new Error("Recipe ID tidak valid.");
    if (!Number.isFinite(plannedQty) || plannedQty <= 0) throw new Error("Qty produksi harus lebih besar dari 0.");

    const result = await prisma.$transaction(async (tx) => {
      const outlet = await tx.outlet.findUnique({ where: { id: outletId }, select: { id: true, code: true, name: true, active: true } });
      if (!outlet || !outlet.active) throw new Error("Outlet produksi tidak ditemukan atau tidak aktif.");

      const recipe = await tx.recipe.findUnique({
        where: { id: recipeId },
        include: { items: { include: { barang: true }, orderBy: { id: "asc" } }, outputBarang: true, productCk: true },
      });
      if (!recipe || !recipe.active) throw new Error("Recipe / BOM tidak ditemukan atau tidak aktif.");
      if (recipe.menuId !== null) throw new Error("Recipe Manufacture tidak boleh menggunakan Menu POS.");
      if (recipe.outletId && recipe.outletId !== outletId) throw new Error("Recipe / BOM bukan milik outlet tersebut.");
      if (!recipe.outputBarangId || !recipe.outputBarang?.active) throw new Error("Barang output Recipe tidak valid.");
      if (!recipe.items.length) throw new Error("Recipe / BOM belum memiliki bahan.");

      const outputQty = Number(recipe.outputQty || 0);
      if (!Number.isFinite(outputQty) || outputQty <= 0) throw new Error("Output quantity Recipe tidak valid.");
      const factor = plannedQty / outputQty;

      const requirements = recipe.items.map((item) => {
        const qty = Number(item.qty) * factor;
        const qtyBase = toBaseQty(qty, item.unit, item.barang);
        return { barangId: item.barangId, qtyBase, barang: item.barang };
      });

      const merged = new Map<number, { barangId: number; qtyBase: number; barang: any }>();
      for (const r of requirements) {
        const old = merged.get(r.barangId);
        merged.set(r.barangId, { barangId: r.barangId, qtyBase: (old?.qtyBase || 0) + r.qtyBase, barang: r.barang });
      }

      const now = new Date();
      const period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
      const doc = await tx.documentNumber.upsert({
        where: { type_period: { type: "MANUFACTURE", period } },
        create: { type: "MANUFACTURE", prefix: `MO-${period}`, period, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
        select: { prefix: true, lastNumber: true },
      });
      const number = `${doc.prefix}-${String(doc.lastNumber).padStart(4, "0")}`;

      const order = await tx.manufactureOrder.create({
        data: {
          number, outletId, recipeId, plannedQty, producedQty: 0, status: "PLANNED", productionDate: now,
          note: body?.note ? String(body.note).trim() : null, createdBy: user.id,
          items: { create: Array.from(merged.values()).map((r) => ({ barangId: r.barangId, plannedQty: r.qtyBase, actualQty: 0 })) },
        },
        include: { outlet: true, recipe: { include: { menu: true, productCk: true, outputBarang: true } }, items: { include: { barang: true } } },
      });
      return order;
    });

    return NextResponse.json({ success: true, message: "Manufacture Order berhasil dibuat. Stock belum berubah sampai order diselesaikan.", data: result }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/manufacture/orders ERROR:", error);
    return NextResponse.json({ success: false, message: error?.message || "Gagal membuat Manufacture Order." }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  try {
    /*
     * =======================================================
     * AUTH
     * =======================================================
     */

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login atau session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * =======================================================
     * ROLE
     * =======================================================
     */

    if (!canManufacture(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message: "Anda tidak memiliki akses Manufacture",
        },
        {
          status: 403,
        }
      );
    }

    const { searchParams } = new URL(req.url);

    const requestedOutletId =
      searchParams.get("outletId");

    const status =
      searchParams.get("status");

    const search =
      searchParams.get("search")?.trim();

    /*
     * =======================================================
     * OUTLET FILTER
     * =======================================================
     */

    let outletId: number | undefined;

    /*
     * OUTLET_ADMIN:
     * Selalu dipaksa menggunakan outlet miliknya sendiri.
     *
     * Query ?outletId= tidak boleh digunakan untuk
     * berpindah outlet.
     */
    if (user.role === "OUTLET_ADMIN") {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User Outlet Admin belum terhubung dengan outlet",
          },
          {
            status: 403,
          }
        );
      }

      outletId = Number(user.outletId);

      if (
        !Number.isInteger(outletId) ||
        outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet user tidak valid",
          },
          {
            status: 403,
          }
        );
      }
    }

    /*
     * ADMIN / MANAGER:
     * Jika outletId diberikan, filter outlet tersebut.
     *
     * Jika tidak diberikan:
     * ambil semua outlet.
     */
    else if (requestedOutletId) {
      const parsed = Number(requestedOutletId);

      if (
        !Number.isInteger(parsed) ||
        parsed <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Outlet ID tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      outletId = parsed;
    }

    /*
     * =======================================================
     * WHERE
     * =======================================================
     */

    const where: any = {};

    if (outletId !== undefined) {
      where.outletId = outletId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        {
          number: {
            contains: search,
          },
        },
        {
          recipe: {
            name: {
              contains: search,
            },
          },
        },
        {
          recipe: {
            code: {
              contains: search,
            },
          },
        },
      ];
    }

    /*
     * =======================================================
     * QUERY MANUFACTURE ORDER
     * =======================================================
     *
     * PENTING:
     *
     * Tidak ada:
     *
     * include: {
     *   outlet: ...
     * }
     *
     * karena ManufactureOrder memang tidak mempunyai
     * Prisma relation `outlet`.
     * =======================================================
     */

    const data =
      await prisma.manufactureOrder.findMany({
        where,

        include: {
          /*
           * -------------------------------------------------
           * RECIPE
           * -------------------------------------------------
           */

          recipe: {
            include: {
              productCk: {
                include: {
                  outputBarang: true,
                },
              },

              outputBarang: true,

              menu: true,

              items: {
                include: {
                  barang: true,
                },

                orderBy: {
                  id: "asc",
                },
              },
            },
          },

          /*
           * -------------------------------------------------
           * CREATOR
           * -------------------------------------------------
           */

          creator: {
            select: {
              id: true,
              fullname: true,
              username: true,
              role: true,
              outletId: true,
            },
          },

          /*
           * -------------------------------------------------
           * MANUFACTURE ORDER ITEMS
           * -------------------------------------------------
           */

          items: {
            include: {
              barang: true,
            },

            orderBy: {
              id: "asc",
            },
          },
        },

        orderBy: [
          {
            productionDate: "desc",
          },
          {
            id: "desc",
          },
        ],
      });

    /*
     * =======================================================
     * AMBIL OUTLET TERPISAH
     * =======================================================
     *
     * Karena ManufactureOrder tidak punya relation outlet,
     * ambil outlet berdasarkan outletId.
     * =======================================================
     */

    const outletIds = Array.from(
      new Set(
        data
          .map((order) =>
            Number(order.outletId)
          )
          .filter(
            (id) =>
              Number.isInteger(id) &&
              id > 0
          )
      )
    );

    const outlets =
      outletIds.length > 0
        ? await prisma.outlet.findMany({
            where: {
              id: {
                in: outletIds,
              },
            },

            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
          })
        : [];

    const outletMap = new Map(
      outlets.map((outlet) => [
        outlet.id,
        outlet,
      ])
    );

    /*
     * =======================================================
     * FORMAT RESPONSE
     * =======================================================
     */

    const formattedData =
      await Promise.all(
        data.map(async (order) => {
          /*
           * -----------------------------------------------
           * OUTLET
           * -----------------------------------------------
           */

          const orderOutletId =
            Number(order.outletId);

          const outlet =
            outletMap.get(
              orderOutletId
            ) ?? null;

          /*
           * -----------------------------------------------
           * BARANG IDS
           * -----------------------------------------------
           */

          const barangIds = Array.from(
            new Set(
              order.items
                .map((item) =>
                  Number(item.barangId)
                )
                .filter(
                  (id) =>
                    Number.isInteger(id) &&
                    id > 0
                )
            )
          );

          /*
           * -----------------------------------------------
           * OUTLET STOCK
           * -----------------------------------------------
           *
           * Manufacture hanya membaca OutletStock.
           *
           * TIDAK membaca:
           *   Barang.stock
           *   Inventory pusat
           * -----------------------------------------------
           */

          const outletStocks =
            orderOutletId > 0 &&
            barangIds.length > 0
              ? await prisma.outletStock.findMany({
                  where: {
                    outletId:
                      orderOutletId,

                    barangId: {
                      in: barangIds,
                    },
                  },

                  select: {
                    id: true,
                    outletId: true,
                    barangId: true,
                    stock: true,
                    minimumStock: true,
                    averageCost: true,
                  },
                })
              : [];

          /*
           * -----------------------------------------------
           * STOCK MAP
           * -----------------------------------------------
           */

          const stockMap = new Map(
            outletStocks.map((stock) => [
              Number(stock.barangId),
              stock,
            ])
          );

          /*
           * -----------------------------------------------
           * FORMAT ITEMS
           * -----------------------------------------------
           */

          const items =
            order.items.map((item) => {
              const barangId =
                Number(item.barangId);

              const stock =
                stockMap.get(
                  barangId
                );

              const barang =
                item.barang;

              /*
               * -------------------------------------------
               * UNIT
               * -------------------------------------------
               */

              const unit =
                barang?.unit ?? "";

              const baseUnit =
                barang?.baseUnit ?? unit;

              const conversionRate =
                Number(
                  barang?.conversionRate ?? 1
                );

              const hasConversion =
                Boolean(
                  unit &&
                    baseUnit &&
                    unit !== baseUnit &&
                    conversionRate > 1
                );

              /*
               * -------------------------------------------
               * DEFAULT STOCK
               * -------------------------------------------
               *
               * Jika OutletStock belum ada, jangan
               * menggunakan Barang.stock.
               *
               * Manufacture tetap menganggap stock outlet
               * = 0.
               * -------------------------------------------
               */

              const outletStock =
                stock ?? {
                  id: null,

                  outletId:
                    orderOutletId,

                  barangId,

                  stock: 0,

                  minimumStock: 0,

                  averageCost: 0,
                };

              /*
               * -------------------------------------------
               * BARANG RESPONSE
               * -------------------------------------------
               */

              const formattedBarang =
                barang
                  ? {
                      ...barang,

                      unit,

                      baseUnit,

                      conversionRate,

                      hasConversion,

                      conversionLabel:
                        hasConversion
                          ? `1 ${unit} = ${conversionRate} ${baseUnit}`
                          : `1 ${unit}`,

                      stockUnit:
                        unit,

                      stockBaseUnit:
                        hasConversion
                          ? baseUnit
                          : unit,
                    }
                  : barang;

              return {
                ...item,

                outletStock,

                barang:
                  formattedBarang,
              };
            });

          /*
           * -----------------------------------------------
           * FINAL ORDER
           * -----------------------------------------------
           */

          return {
            ...order,

            outlet,

            items,
          };
        })
      );

    /*
     * =======================================================
     * RESPONSE
     * =======================================================
     */

    return NextResponse.json({
      success: true,

      scope: {
        role: user.role,

        outletId:
          user.role === "OUTLET_ADMIN"
            ? Number(user.outletId)
            : outletId ?? null,
      },

      total: formattedData.length,

      data: formattedData,

      policy: {
        manufactureStockSource:
          "OutletStock",

        centralBarangStockTouched:
          false,

        centralInventoryStockTouched:
          false,

        outletStockOnly:
          true,
      },
    });
  } catch (error: any) {
    console.error(
      "GET /api/manufacture/orders ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal mengambil data Manufacture Order",
      },
      {
        status: 500,
      }
    );
  }
}