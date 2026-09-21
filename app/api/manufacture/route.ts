import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { toBaseQty, baseToMainQty } from "@/lib/base-unit";
import { changeOutletStock } from "@/lib/outlet-stock-ledger";

export const dynamic = "force-dynamic";

/*
 * =========================================================
 * MANUFACTURE OUTLET API
 * =========================================================
 *
 * POLICY:
 *
 * Recipe / BOM Outlet
 *        ↓
 * RecipeItem
 *        ↓
 * normalisasi unit -> baseUnit
 *        ↓
 * OutletStock bahan
 *        ↓
 * kurangi bahan
 *        ↓
 * hitung HPP produksi
 *        ↓
 * OutletStock output
 *
 * STOCK YANG BOLEH DISENTUH:
 *   OutletStock
 *
 * STOCK YANG TIDAK BOLEH DISENTUH:
 *   Barang.stock
 *   Inventory.stock
 *
 * TRANSACTION:
 *   Semua perubahan database dilakukan dalam satu transaction.
 *
 * Jika gagal:
 *   SEMUA perubahan rollback.
 * =========================================================
 */

/* =========================================================
 * CONSTANT
 * ========================================================= */

const ROLE_ADMIN = "ADMIN";
const ROLE_MANAGER = "MANAGER";
const ROLE_OUTLET_ADMIN = "OUTLET_ADMIN";
const ROLE_ADMIN_PUSAT = "ADMIN_PUSAT";

const MANUFACTURE_STATUS = "COMPLETED";

/* =========================================================
 * NUMBER HELPERS
 * ========================================================= */

function toFiniteNumber(value: unknown): number | null {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

function normalizeStock(value: number): number {
  if (Math.abs(value) < 0.000001) {
    return 0;
  }

  return value;
}

function roundNumber(value: number, decimals = 6): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const multiplier = 10 ** decimals;

  return Math.round(value * multiplier) / multiplier;
}

/* =========================================================
 * CURRENT USER
 * ========================================================= */

async function getCurrentUser() {
  const cookieStore = await cookies();

  const sessionCookie =
    cookieStore.get("erp-session") ||
    cookieStore.get("session");

  if (!sessionCookie?.value) {
    return null;
  }

  /*
   * SESSION TOKEN
   */

  try {
    const userBySession = await prisma.user.findFirst({
      where: {
        sessions: {
          some: {
            token: sessionCookie.value,
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
    /*
     * Lanjut mencoba JSON session.
     */
  }

  /*
   * JSON SESSION
   */

  try {
    const sessionData = JSON.parse(sessionCookie.value);

    const userId = Number(
      sessionData?.user?.id ??
        sessionData?.id ??
        0,
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
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

/* =========================================================
 * ROLE
 * ========================================================= */

function canManufacture(role: unknown): boolean {
  const normalizedRole = String(role)
    .trim()
    .toUpperCase();

  return (
    normalizedRole === ROLE_ADMIN ||
    normalizedRole === ROLE_MANAGER ||
    normalizedRole === ROLE_ADMIN_PUSAT ||
    normalizedRole === ROLE_OUTLET_ADMIN
  );
}

/* =========================================================
 * OUTLET
 * ========================================================= */

function resolveOutletId(
  user: {
    role: unknown;
    outletId: number | null;
  },
  requestedOutletId: unknown,
): number {
  const role = String(user.role)
    .trim()
    .toUpperCase();

  /*
   * OUTLET_ADMIN:
   * selalu outlet miliknya.
   */

  if (role === ROLE_OUTLET_ADMIN) {
    if (!user.outletId) {
      throw new Error(
        "User Outlet Admin belum terhubung dengan outlet",
      );
    }

    return Number(user.outletId);
  }

  /*
   * ADMIN / MANAGER:
   * outlet harus dikirim.
   */

  const outletId = Number(requestedOutletId);

  if (
    !Number.isInteger(outletId) ||
    outletId <= 0
  ) {
    throw new Error("Outlet wajib dipilih");
  }

  return outletId;
}

/* =========================================================
 * UNIT NORMALIZATION
 * ========================================================= */

type NormalizedUnitResult = {
  qty: number;
  unit: string;
  baseUnit: string;
  conversionRate: number;
};

function normalizeRecipeQuantity(
  qty: number,
  recipeUnit: string | null | undefined,
  barang: {
    name?: string;
    unit: string;
    baseUnit?: string | null;
    conversionRate?: number | null;
  },
): NormalizedUnitResult {
  const sourceUnit = String(
    recipeUnit ??
      barang.unit ??
      barang.baseUnit ??
      "",
  ).trim();

  const masterUnit = String(
    barang.unit ?? "",
  ).trim();

  const baseUnit = String(
    barang.baseUnit ??
      barang.unit ??
      "",
  ).trim();

  const conversionRate =
    toFiniteNumber(
      barang.conversionRate ?? 1,
    ) ?? 1;

  if (!sourceUnit) {
    throw new Error(
      `Satuan bahan "${barang.name ?? "Unknown"}" tidak valid`,
    );
  }

  if (!baseUnit) {
    throw new Error(
      `Satuan dasar bahan "${barang.name ?? "Unknown"}" belum tersedia`,
    );
  }

  if (
    !Number.isFinite(conversionRate) ||
    conversionRate <= 0
  ) {
    throw new Error(
      `Conversion rate bahan "${barang.name ?? "Unknown"}" tidak valid`,
    );
  }

  const sourceLower =
    sourceUnit.toLowerCase();

  const masterLower =
    masterUnit.toLowerCase();

  const baseLower =
    baseUnit.toLowerCase();

  /*
   * Jika recipe menggunakan base unit,
   * tidak perlu konversi.
   */

  if (sourceLower === baseLower) {
    return {
      qty,
      unit: sourceUnit,
      baseUnit,
      conversionRate,
    };
  }

  /*
   * Jika recipe menggunakan unit master
   * dan unit master berbeda dengan base unit,
   * gunakan conversionRate.
   */

  if (sourceLower === masterLower) {
    return {
      qty: qty * conversionRate,
      unit: sourceUnit,
      baseUnit,
      conversionRate,
    };
  }

  /*
   * Unit recipe tidak dikenali.
   */

  throw new Error(
    `Satuan "${sourceUnit}" pada bahan "${barang.name ?? "Unknown"}" tidak sesuai dengan unit "${masterUnit}" / base unit "${baseUnit}"`,
  );
}

/* =========================================================
 * GET
 * ========================================================= */

export async function GET(
  req: NextRequest,
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session tidak valid",
        },
        {
          status: 401,
        },
      );
    }

    if (!canManufacture(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses Manufacture",
        },
        {
          status: 403,
        },
      );
    }

    const { searchParams } =
      new URL(req.url);

    const requestedOutletId =
      searchParams.get("outletId");

    const status =
      searchParams
        .get("status")
        ?.trim() || "";

    const search =
      searchParams
        .get("search")
        ?.trim() || "";

    /*
     * OUTLET SCOPE
     */

    let outletId:
      | number
      | undefined;

    const role = String(user.role)
      .trim()
      .toUpperCase();

    if (role === ROLE_OUTLET_ADMIN) {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User Outlet Admin belum terhubung dengan outlet",
          },
          {
            status: 403,
          },
        );
      }

      outletId = Number(
        user.outletId,
      );
    } else if (requestedOutletId) {
      const parsedOutletId =
        Number(requestedOutletId);

      if (
        !Number.isInteger(
          parsedOutletId,
        ) ||
        parsedOutletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet ID tidak valid",
          },
          {
            status: 400,
          },
        );
      }

      outletId = parsedOutletId;
    }

    /*
     * WHERE
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
     * LOAD
     */

    const data =
      await prisma.manufactureOrder.findMany(
        {
          where,

          include: {
            outlet: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },

            recipe: {
              include: {
                menu: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    price: true,
                    active: true,
                  },
                },

                productCk: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    active: true,
                  },
                },

                outputBarang: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    unit: true,
                    baseUnit: true,
                    conversionRate: true,
                  },
                },

                items: {
                  include: {
                    barang: {
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
                      },
                    },
                  },

                  orderBy: {
                    id: "asc",
                  },
                },
              },
            },

            creator: {
              select: {
                id: true,
                fullname: true,
                username: true,
                role: true,
              },
            },

            items: {
              include: {
                barang: {
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
                  },
                },
              },

              orderBy: {
                id: "asc",
              },
            },
          },

          orderBy: {
            productionDate: "desc",
          },
        },
      );

    /*
     * CURRENT OUTLET STOCK
     */

    const formattedData =
      await Promise.all(
        data.map(
          async (order) => {
            const barangIds = [
              ...new Set([
                ...order.items.map(
                  (item) =>
                    item.barangId,
                ),

                ...(order.recipe
                  ?.outputBarang
                  ? [
                      order.recipe
                        .outputBarang
                        .id,
                    ]
                  : []),
              ]),
            ];

            const outletStocks =
              barangIds.length
                ? await prisma.outletStock.findMany(
                    {
                      where: {
                        outletId:
                          order.outletId,

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
                    },
                  )
                : [];

            const stockMap =
              new Map(
                outletStocks.map(
                  (stock) => [
                    stock.barangId,
                    stock,
                  ],
                ),
              );

            return {
              ...order,

              items:
                order.items.map(
                  (item) => ({
                    ...item,

                    outletStock:
                      stockMap.get(
                        item.barangId,
                      ) ?? {
                        barangId:
                          item.barangId,

                        stock: 0,

                        minimumStock:
                          0,

                        averageCost:
                          0,
                      },
                  }),
                ),

              outputOutletStock:
                order.recipe
                  ?.outputBarang
                  ? stockMap.get(
                      order.recipe
                        .outputBarang
                        .id,
                    ) ?? {
                      barangId:
                        order.recipe
                          .outputBarang
                          .id,

                      stock: 0,

                      minimumStock:
                        0,

                      averageCost:
                        0,
                    }
                  : null,
            };
          },
        ),
      );

    return NextResponse.json({
      success: true,

      scope: {
        role: user.role,

        outletId:
          role === ROLE_OUTLET_ADMIN
            ? user.outletId
            : outletId ?? null,
      },

      total:
        formattedData.length,

      data: formattedData,
    });
  } catch (error: any) {
    console.error(
      "GET MANUFACTURE ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil data Manufacture",
      },
      {
        status: 500,
      },
    );
  }
}

/* =========================================================
 * POST
 * ========================================================= */

export async function POST(
  req: NextRequest,
) {
  try {
    /*
     * AUTH
     */

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session tidak valid",
        },
        {
          status: 401,
        },
      );
    }

    /*
     * ROLE
     */

    if (
      !canManufacture(
        user.role,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses Manufacture",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * BODY
     */

    let body: any;

    try {
      body =
        await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Request body tidak valid",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * OUTLET
     */

    let outletId: number;

    try {
      outletId =
        resolveOutletId(
          user,
          body?.outletId,
        );
    } catch (error: any) {
      return NextResponse.json(
        {
          success: false,
          message:
            error?.message ||
            "Outlet tidak valid",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * RECIPE
     */

    const recipeId =
      Number(body?.recipeId);

    if (
      !Number.isInteger(
        recipeId,
      ) ||
      recipeId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Recipe ID tidak valid",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * PLANNED QTY
     */

    const plannedQty =
      Number(
        body?.plannedQty,
      );

    if (
      !Number.isFinite(
        plannedQty,
      ) ||
      plannedQty <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Planned quantity harus lebih besar dari 0",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * PRODUCED QTY
     */

    const producedQty =
      body?.producedQty ===
        undefined ||
      body?.producedQty ===
        null ||
      body?.producedQty ===
        ""
        ? plannedQty
        : Number(
            body.producedQty,
          );

    if (
      !Number.isFinite(
        producedQty,
      ) ||
      producedQty <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Produced quantity harus lebih besar dari 0",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * NOTE
     */

    const note =
      body?.note
        ? String(
            body.note,
          ).trim()
        : null;

    /*
     * TRANSACTION
     */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * OUTLET
           */

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
              },
            );

          if (!outlet) {
            throw new Error(
              "Outlet tidak ditemukan",
            );
          }

          if (!outlet.active) {
            throw new Error(
              "Outlet tidak aktif",
            );
          }

          /*
           * OUTLET ADMIN SECURITY
           */

          if (
            String(user.role)
              .trim()
              .toUpperCase() ===
            ROLE_OUTLET_ADMIN
          ) {
            if (!user.outletId) {
              throw new Error(
                "User Outlet Admin belum terhubung dengan outlet",
              );
            }

            if (
              Number(
                user.outletId,
              ) !==
              Number(
                outlet.id,
              )
            ) {
              throw new Error(
                "Anda tidak dapat melakukan manufacture di outlet lain",
              );
            }
          }

          /*
           * RECIPE
           */

          const recipe =
            await tx.recipe.findUnique(
              {
                where: {
                  id: recipeId,
                },

                include: {
                  menu: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      active: true,
                      price: true,
                    },
                  },

                  productCk: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      active: true,
                      outputBarangId:
                        true,
                    },
                  },

                  outputBarang: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      unit: true,
                      baseUnit: true,
                      conversionRate:
                        true,
                      minimumStock:
                        true,
                      active: true,
                    },
                  },

                  items: {
                    include: {
                      barang: {
                        select: {
                          id: true,
                          code: true,
                          barcode: true,
                          name: true,
                          category: true,
                          brand: true,
                          unit: true,
                          baseUnit: true,
                          conversionRate:
                            true,
                          active: true,
                        },
                      },
                    },

                    orderBy: {
                      id: "asc",
                    },
                  },
                },
              },
            );

          if (!recipe) {
            throw new Error(
              "Recipe / BOM tidak ditemukan",
            );
          }

          /*
           * RECIPE MUST BELONG TO OUTLET
           */

          if (
            recipe.outletId &&
            Number(recipe.outletId) !== Number(outlet.id)
          ) {
            throw new Error(
              "Recipe / BOM bukan milik outlet tersebut",
            );
          }

          /*
           * ACTIVE
           */

          if (!recipe.active) {
            throw new Error(
              "Recipe / BOM tidak aktif",
            );
          }

          /*
           * MANUFACTURE MUST NOT USE POS MENU
           */

          if (
            recipe.menuId !==
              null &&
            recipe.menuId !==
              undefined
          ) {
            throw new Error(
              "Recipe Manufacture Outlet tidak boleh menggunakan Menu POS",
            );
          }

          /*
           * ITEMS
           */

          if (
            !recipe.items ||
            recipe.items.length === 0
          ) {
            throw new Error(
              "Recipe / BOM belum memiliki bahan",
            );
          }

          /*
           * OUTPUT
           */

          if (
            !recipe.outputBarangId
          ) {
            throw new Error(
              "Recipe / BOM belum memiliki barang output",
            );
          }

          if (!recipe.outputBarang) {
            throw new Error(
              "Barang output Recipe tidak ditemukan",
            );
          }

          if (
            !recipe.outputBarang.active
          ) {
            throw new Error(
              "Barang output Recipe tidak aktif",
            );
          }

          /*
           * PRODUCT CK
           */

          if (
            recipe.productCkId !==
              null &&
            recipe.productCkId !==
              undefined
          ) {
            if (
              !recipe.productCk
            ) {
              throw new Error(
                "Product CK tidak ditemukan",
              );
            }

            if (
              !recipe.productCk.active
            ) {
              throw new Error(
                "Product CK tidak aktif",
              );
            }

            if (
              recipe.productCk
                .outputBarangId !==
              recipe.outputBarangId
            ) {
              throw new Error(
                "Output Barang Recipe tidak sesuai dengan Product CK",
              );
            }
          }

          /*
           * OUTPUT QTY RECIPE
           */

          const outputQty =
            Number(
              recipe.outputQty,
            );

          if (
            !Number.isFinite(
              outputQty,
            ) ||
            outputQty <= 0
          ) {
            throw new Error(
              "Output quantity Recipe tidak valid",
            );
          }

          /*
           * VALIDATE RECIPE ITEMS
           */

          for (
            const recipeItem of
              recipe.items
          ) {
            const itemQty =
              Number(
                recipeItem.qty,
              );

            if (
              !Number.isFinite(
                itemQty,
              ) ||
              itemQty <= 0
            ) {
              throw new Error(
                `Qty bahan "${recipeItem.barang?.name || recipeItem.barangId}" tidak valid`,
              );
            }

            if (
              !recipeItem.barang
            ) {
              throw new Error(
                `Barang ${recipeItem.barangId} tidak ditemukan`,
              );
            }

            if (
              !recipeItem.barang.active
            ) {
              throw new Error(
                `Barang "${recipeItem.barang.name}" tidak aktif`,
              );
            }

            normalizeRecipeQuantity(
              itemQty,
              recipeItem.unit,
              recipeItem.barang,
            );
          }

          /*
           * FACTOR
           */

          const factor =
            producedQty /
            outputQty;

          if (
            !Number.isFinite(
              factor,
            ) ||
            factor <= 0
          ) {
            throw new Error(
              "Factor manufacture tidak valid",
            );
          }

          /*
           * REQUIREMENTS
           */

          const requirements =
            recipe.items.map(
              (recipeItem) => {
                const recipeQty =
                  Number(
                    recipeItem.qty,
                  );

                const scaledQty =
                  recipeQty *
                  factor;

                const normalized =
                  normalizeRecipeQuantity(
                    scaledQty,
                    recipeItem.unit,
                    recipeItem.barang,
                  );

                return {
                  barangId:
                    recipeItem.barangId,

                  barang:
                    recipeItem.barang,

                  recipeQty,

                  scaledQty,

                  requiredQty:
                    normalized.qty,

                  recipeUnit:
                    normalized.unit,

                  unit:
                    normalized.baseUnit,

                  conversionRate:
                    normalized.conversionRate,
                };
              },
            );

          /*
           * COMBINE DUPLICATE INGREDIENT
           */

          const requirementMap =
            new Map<
              number,
              {
                barangId: number;
                barang: any;
                recipeQty: number;
                scaledQty: number;
                requiredQty: number;
                recipeUnit: string;
                unit: string;
                conversionRate: number;
              }
            >();

          for (
            const requirement of
              requirements
          ) {
            const existing =
              requirementMap.get(
                requirement.barangId,
              );

            if (existing) {
              existing.recipeQty +=
                requirement.recipeQty;

              existing.scaledQty +=
                requirement.scaledQty;

              existing.requiredQty +=
                requirement.requiredQty;
            } else {
              requirementMap.set(
                requirement.barangId,
                {
                  ...requirement,
                },
              );
            }
          }

          const normalizedRequirements =
            Array.from(
              requirementMap.values(),
            ).map(
              (item) => ({
                ...item,

                requiredQty:
                  roundNumber(
                    item.requiredQty,
                  ),
              }),
            );

          /*
           * INGREDIENT BARANG IDS
           */

          const ingredientBarangIds =
            normalizedRequirements.map(
              (item) =>
                item.barangId,
            );

          if (
            ingredientBarangIds.length ===
            0
          ) {
            throw new Error(
              "Recipe / BOM belum memiliki bahan",
            );
          }

          /*
           * LOAD OUTLET STOCK
           */

          const outletStocks =
            await tx.outletStock.findMany(
              {
                where: {
                  outletId,

                  barangId: {
                    in: ingredientBarangIds,
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
              },
            );

          const outletStockMap =
            new Map(
              outletStocks.map(
                (stock) => [
                  stock.barangId,
                  stock,
                ],
              ),
            );

          /*
           * PRE-CHECK STOCK
           */

          const insufficientItems:
            any[] = [];

          for (
            const requirement of
              normalizedRequirements
          ) {
            const outletStock =
              outletStockMap.get(
                requirement.barangId,
              );

            const required =
              Number(
                requirement.requiredQty,
              );

            if (
              !Number.isFinite(
                required,
              ) ||
              required <= 0
            ) {
              throw new Error(
                `Kebutuhan bahan "${requirement.barang.name}" tidak valid`,
              );
            }

            if (!outletStock) {
              insufficientItems.push(
                {
                  barangId:
                    requirement.barangId,

                  code:
                    requirement.barang
                      .code,

                  name:
                    requirement.barang
                      .name,

                  required,

                  available: 0,

                  shortage:
                    required,

                  unit:
                    requirement.unit,

                  reason:
                    "Barang belum memiliki stock di outlet",
                },
              );

              continue;
            }

            const available = toBaseQty(
              Number(outletStock.stock || 0),
              requirement.barang.unit,
              requirement.barang,
            );

            if (
              !Number.isFinite(
                available,
              )
            ) {
              throw new Error(
                `Stock outlet "${requirement.barang.name}" tidak valid`,
              );
            }

            if (
              available +
                0.000001 <
              required
            ) {
              insufficientItems.push(
                {
                  barangId:
                    requirement.barangId,

                  code:
                    requirement.barang
                      .code,

                  name:
                    requirement.barang
                      .name,

                  required,

                  available,

                  shortage:
                    roundNumber(
                      required -
                        available,
                    ),

                  unit:
                    requirement.unit,

                  reason:
                    "Stock outlet tidak mencukupi",
                },
              );
            }
          }

          if (
            insufficientItems.length >
            0
          ) {
            const error: any =
              new Error(
                "Stock outlet tidak mencukupi",
              );

            error.code =
              "INSUFFICIENT_OUTLET_STOCK";

            error.items =
              insufficientItems;

            throw error;
          }

          /*
           * DOCUMENT NUMBER
           *
           * FIX:
           * `select` harus berada di object
           * argument upsert yang sama.
           */

          const now =
            new Date();

          const year =
            now.getFullYear();

          const month =
            String(
              now.getMonth() + 1,
            ).padStart(
              2,
              "0",
            );

          const period =
            `${year}${month}`;

          const documentNumber =
            await tx.documentNumber.upsert({
              where: {
                type_period: {
                  type:
                    "MANUFACTURE",

                  period,
                },
              },

              create: {
                type:
                  "MANUFACTURE",

                prefix:
                  `MO-${period}`,

                period,

                lastNumber: 1,
              },

              update: {
                lastNumber: {
                  increment: 1,
                },
              },

              select: {
                prefix: true,

                lastNumber: true,
              },
            });

          const number =
            `${documentNumber.prefix}-${String(
              documentNumber.lastNumber,
            ).padStart(
              4,
              "0",
            )}`;

          /*
           * CREATE MANUFACTURE ORDER
           */

          const order =
            await tx.manufactureOrder.create(
              {
                data: {
                  number,

                  recipeId,

                  outletId,

                  plannedQty,

                  producedQty,

                  status:
                    MANUFACTURE_STATUS,

                  productionDate:
                    now,

                  note,

                  createdBy:
                    user.id,

                  items: {
                    create:
                      normalizedRequirements.map(
                        (
                          requirement,
                        ) => ({
                          barangId:
                            requirement.barangId,

                          plannedQty:
                            requirement.requiredQty,

                          actualQty:
                            requirement.requiredQty,
                        }),
                      ),
                  },
                },

                include: {
                  outlet: true,

                  recipe: {
                    include: {
                      menu: true,

                      productCk:
                        true,

                      outputBarang:
                        true,
                    },
                  },

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
            );

          /*
           * MATERIAL COST
           */

          let totalMaterialCost =
            0;

          const stockResults:
            any[] = [];

          /*
           * REDUCE INGREDIENT STOCK
           */

          for (
            const requirement of
              normalizedRequirements
          ) {
            const outletStock =
              outletStockMap.get(
                requirement.barangId,
              );

            if (!outletStock) {
              throw new Error(
                `Stock outlet "${requirement.barang.name}" tidak ditemukan`,
              );
            }

            const stockBefore = Number(outletStock.stock || 0);
            const qtyOutBase = Number(requirement.requiredQty);
            const qtyOut = baseToMainQty(qtyOutBase, requirement.barang);
            const averageCost = Number(outletStock.averageCost ?? 0);
            const unitCostBase = Number(requirement.conversionRate) > 0
              ? averageCost / Number(requirement.conversionRate)
              : averageCost;

            if (
              !Number.isFinite(
                stockBefore,
              ) ||
              stockBefore <
                -0.000001
            ) {
              throw new Error(
                `Stock outlet "${requirement.barang.name}" tidak valid`,
              );
            }

            if (
              !Number.isFinite(
                qtyOut,
              ) ||
              qtyOut <= 0
            ) {
              throw new Error(
                `Qty bahan "${requirement.barang.name}" tidak valid`,
              );
            }

            if (
              !Number.isFinite(
                averageCost,
              ) ||
              averageCost < 0
            ) {
              throw new Error(
                `Average cost "${requirement.barang.name}" tidak valid`,
              );
            }

            const materialCost = qtyOutBase * unitCostBase;

            totalMaterialCost +=
              materialCost;

            const stockAfter = normalizeStock(stockBefore - qtyOut);

            if (
              stockAfter <
              -0.000001
            ) {
              throw new Error(
                `Stock outlet "${requirement.barang.name}" menjadi minus`,
              );
            }

            const ledger = await changeOutletStock(tx, {
              outletId,
              barangId: requirement.barangId,
              deltaBaseQty: -qtyOutBase,
              reference: number,
              description: `Manufacture ${number} - konsumsi bahan`,
            });

            const updated = await tx.outletStock.findUnique({
              where: { outletId_barangId: { outletId, barangId: requirement.barangId } },
              select: { id: true, outletId: true, barangId: true, stock: true, averageCost: true, minimumStock: true },
            });

            if (!updated) throw new Error(`Stock outlet ${requirement.barang.name} tidak ditemukan setelah perubahan.`);

            await tx.stockCard.create({
              data: {
                barangId: requirement.barangId,
                trxDate: now,
                trxType: "MANUFACTURE_CONSUME",
                trxNumber: number,
                referenceId: order.id,
                warehouse: `OUTLET:${outlet.code}`,
                qtyIn: 0,
                qtyOut: qtyOut,
                balance: updated.stock,
                unitPrice: averageCost,
                totalValue: qtyOut * averageCost,
                note: `Manufacture ${number} - konsumsi ${qtyOutBase} ${requirement.unit}`,
              },
            });

            stockResults.push({
              barangId:
                requirement.barangId,

              code:
                requirement.barang
                  .code,

              name:
                requirement.barang
                  .name,

              recipeUnit:
                requirement.recipeUnit,

              baseUnit:
                requirement.unit,

              conversionRate:
                requirement.conversionRate,

              qtyOut,

              stockBefore,

              stockAfter:
                updated.stock,

              averageCost:
                updated.averageCost,

              materialCost:
                roundNumber(
                  materialCost,
                ),
            });
          }

          /*
           * TOTAL MATERIAL COST
           */

          totalMaterialCost =
            roundNumber(
              totalMaterialCost,
            );

          /*
           * OUTPUT COST
           */

          const outputProductionUnitCost =
            producedQty > 0
              ? roundNumber(
                  totalMaterialCost /
                    producedQty,
                )
              : 0;

          /*
           * OUTPUT BARANG
           */

          const outputBarangId =
            Number(
              recipe.outputBarangId,
            );

          if (
            !Number.isInteger(
              outputBarangId,
            ) ||
            outputBarangId <= 0
          ) {
            throw new Error(
              "Barang output Recipe tidak valid",
            );
          }

          /*
           * LOAD OUTPUT STOCK
           */

          const existingOutputStock =
            await tx.outletStock.findUnique(
              {
                where: {
                  outletId_barangId: {
                    outletId,

                    barangId:
                      outputBarangId,
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
              },
            );

          let outputStock:
            | {
                id: number;
                outletId: number;
                barangId: number;
                stock: number;
                minimumStock: number;
                averageCost: number;
              }
            | null = null;

          /*
           * OUTPUT STOCK ALREADY EXISTS
           */

          if (
            existingOutputStock
          ) {
            const oldStock =
              Number(
                existingOutputStock.stock ??
                  0,
              );

            const oldAverageCost =
              Number(
                existingOutputStock.averageCost ??
                  0,
              );

            if (
              !Number.isFinite(
                oldStock,
              ) ||
              oldStock <
                -0.000001
            ) {
              throw new Error(
                `Stock output "${recipe.outputBarang.name}" tidak valid`,
              );
            }

            if (
              !Number.isFinite(
                oldAverageCost,
              ) ||
              oldAverageCost < 0
            ) {
              throw new Error(
                `Average cost output "${recipe.outputBarang.name}" tidak valid`,
              );
            }

            const newStock =
              normalizeStock(
                oldStock +
                  producedQty,
              );

            const oldValue =
              oldStock *
              oldAverageCost;

            const productionValue =
              producedQty *
              outputProductionUnitCost;

            const newAverageCost =
              newStock > 0
                ? roundNumber(
                    (
                      oldValue +
                      productionValue
                    ) /
                      newStock,
                  )
                : 0;

            outputStock =
              await tx.outletStock.update(
                {
                  where: {
                    id:
                      existingOutputStock.id,
                  },

                  data: {
                    stock:
                      newStock,

                    averageCost:
                      Number.isFinite(
                        newAverageCost,
                      )
                        ? newAverageCost
                        : 0,
                  },

                  select: {
                    id: true,
                    outletId: true,
                    barangId: true,
                    stock: true,
                    minimumStock: true,
                    averageCost: true,
                  },
                },
              );
          } else {
            /*
             * OUTPUT STOCK BELUM ADA
             */

            outputStock =
              await tx.outletStock.create(
                {
                  data: {
                    outletId,

                    barangId:
                      outputBarangId,

                    stock:
                      producedQty,

                    minimumStock:
                      Number(
                        recipe
                          .outputBarang
                          .minimumStock ??
                          0,
                      ),

                    averageCost:
                      Number.isFinite(
                        outputProductionUnitCost,
                      )
                        ? outputProductionUnitCost
                        : 0,
                  },

                  select: {
                    id: true,
                    outletId: true,
                    barangId: true,
                    stock: true,
                    minimumStock: true,
                    averageCost: true,
                  },
                },
              );
          }

          /*
           * SAFETY CHECK
           */

          if (!outputStock) {
            throw new Error(
              "Gagal membuat stock output Manufacture",
            );
          }

          await tx.stockCard.create({
            data: {
              barangId: outputBarangId,
              trxDate: now,
              trxType: "MANUFACTURE_OUTPUT",
              trxNumber: number,
              referenceId: order.id,
              warehouse: `OUTLET:${outlet.code}`,
              qtyIn: producedQty,
              qtyOut: 0,
              balance: outputStock.stock,
              unitPrice: outputStock.averageCost,
              totalValue: producedQty * outputStock.averageCost,
              note: `Manufacture ${number} - hasil produksi`,
            },
          });

          /*
           * RETURN TRANSACTION RESULT
           */

          return {
            order,

            outlet: {
              id: outlet.id,

              code: outlet.code,

              name: outlet.name,
            },

            recipe: {
              id: recipe.id,

              code: recipe.code,

              name: recipe.name,

              outputQty:
                recipe.outputQty,

              menu: recipe.menu,

              productCk:
                recipe.productCk,

              outputBarang:
                recipe.outputBarang,
            },

            plannedQty,

            producedQty,

            factor:
              roundNumber(
                factor,
              ),

            materialCost:
              totalMaterialCost,

            outputUnitCost:
              outputProductionUnitCost,

            stockResults,

            outputStock: {
              barangId:
                outputBarangId,

              code:
                recipe.outputBarang
                  .code,

              name:
                recipe.outputBarang
                  .name,

              unit:
                recipe.outputBarang
                  .unit,

              baseUnit:
                recipe.outputBarang
                  .baseUnit,

              conversionRate:
                recipe.outputBarang
                  .conversionRate,

              qtyIn:
                producedQty,

              stockAfter:
                outputStock.stock,

              averageCost:
                outputStock.averageCost,
            },

            policy: {
              stockSource:
                "OutletStock",

              ingredientStock:
                "DECREASE",

              outputStock:
                "INCREASE",

              centralStockTouched:
                false,

              barangStockTouched:
                false,

              inventoryStockTouched:
                false,
            },
          };
        },
      );

    /*
     * SUCCESS
     */

    return NextResponse.json(
      {
        success: true,

        message:
          "Manufacture berhasil diproses. Bahan dikurangi dan hasil produksi ditambahkan ke stock outlet.",

        data: result,
      },
      {
        status: 201,
      },
    );
  } catch (error: any) {
    console.error(
      "POST MANUFACTURE ERROR:",
      error,
    );

    /*
     * INSUFFICIENT STOCK
     */

    if (
      error?.code ===
      "INSUFFICIENT_OUTLET_STOCK"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Stock outlet tidak mencukupi",

          code:
            "INSUFFICIENT_OUTLET_STOCK",

          items:
            error?.items || [],
        },
        {
          status: 400,
        },
      );
    }

    /*
     * VALIDATION MESSAGE
     */

    const message =
      error?.message ||
      "Gagal memproses Manufacture";

    const validationMessages = [
      "Outlet wajib dipilih",

      "Outlet ID tidak valid",

      "Outlet tidak ditemukan",

      "Outlet tidak aktif",

      "User Outlet Admin belum terhubung dengan outlet",

      "Anda tidak dapat melakukan manufacture di outlet lain",

      "Recipe / BOM tidak ditemukan",

      "Recipe / BOM ini bukan Recipe Outlet",

      "Recipe / BOM bukan milik outlet tersebut",

      "Recipe / BOM tidak aktif",

      "Recipe Manufacture Outlet tidak boleh menggunakan Menu POS",

      "Recipe / BOM belum memiliki bahan",

      "Recipe / BOM belum memiliki barang output",

      "Barang output Recipe tidak ditemukan",

      "Barang output Recipe tidak aktif",

      "Barang output Recipe tidak valid",

      "Product CK tidak ditemukan",

      "Product CK tidak aktif",

      "Output Barang Recipe tidak sesuai dengan Product CK",

      "Output quantity Recipe tidak valid",

      "Qty bahan",

      "Barang",

      "Satuan",

      "Conversion rate",

      "Factor manufacture tidak valid",

      "Stock outlet tidak mencukupi",

      "Stock outlet",

      "Average cost",

      "menjadi minus",

      "Gagal membuat stock output Manufacture",
    ];

    const isValidation =
      validationMessages.some(
        (item) =>
          message.includes(item),
      );

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status:
          isValidation
            ? 400
            : 500,
      },
    );
  }
}