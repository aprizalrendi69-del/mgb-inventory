import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/*
 * =========================================================
 * MANUFACTURE ORDERS API
 * =========================================================
 *
 * ATURAN UNIT MANUFACTURE
 * =========================================================
 *
 * RecipeItem.qty:
 *   - SUDAH merupakan qty BASE UNIT.
 *   - TIDAK boleh dikonversi lagi.
 *
 * ManufactureOrderItem.plannedQty:
 *   - Selalu BASE UNIT.
 *
 * Contoh:
 *
 * Barang:
 *   unit           = botol
 *   baseUnit       = ml
 *   conversionRate = 650
 *
 * BOM:
 *   qty  = 0.03
 *   unit = ml
 *
 * Manufacture:
 *   plannedQty = 1
 *
 * Maka:
 *
 *   ManufactureOrderItem.plannedQty = 0.03
 *
 * BUKAN:
 *
 *   19.5
 *   30
 *   650
 *
 * =========================================================
 *
 * PENTING:
 *
 * plannedQty pada Manufacture Order diperlakukan sebagai
 * JUMLAH PRODUKSI / JUMLAH BATCH.
 *
 * Jadi:
 *
 *   BOM 0.03 × produksi 1  = 0.03
 *   BOM 0.03 × produksi 10 = 0.30
 *
 * recipe.outputQty TIDAK dipakai untuk mengubah kebutuhan
 * bahan karena RecipeItem.qty sudah merupakan kebutuhan
 * BASE UNIT per 1 unit/batch produksi yang dibuat.
 *
 * =========================================================
 *
 * KONVERSI
 * =========================================================
 *
 * Konversi purchase unit -> base unit hanya dilakukan
 * pada saat STOCK MASUK.
 *
 * Manufacture TIDAK melakukan konversi lagi.
 *
 * Alur:
 *
 * Purchase Unit
 *      ↓
 * Barang Masuk / Receive
 *      ↓
 * Base Stock
 *      ↓
 * OutletStock
 *
 * Sedangkan:
 *
 * Recipe/BOM
 *      ↓
 * Manufacture Order
 *      ↓
 * Manufacture Complete
 *
 * menggunakan qty base unit apa adanya.
 *
 * =========================================================
 *
 * STOCK MANUFACTURE
 * =========================================================
 *
 * Manufacture hanya menggunakan:
 *
 *   OutletStock
 *
 * Tidak menyentuh:
 *
 *   Barang.stock
 *   Inventory.stock pusat
 *
 * Create Manufacture Order:
 *   TIDAK mengubah stock.
 *
 * Complete Manufacture:
 *   baru mengurangi/menambah OutletStock.
 *
 * =========================================================
 */

export const dynamic = "force-dynamic";

/*
 * =========================================================
 * CURRENT USER
 * =========================================================
 */

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session =
    cookieStore.get("erp-session") ||
    cookieStore.get("session");

  if (!session?.value) {
    return null;
  }

  /*
   * =======================================================
   * SESSION TOKEN
   * =======================================================
   */

  try {
    const userBySession =
      await prisma.user.findFirst({
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

    if (
      userBySession &&
      userBySession.active
    ) {
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
    const sessionData =
      JSON.parse(session.value);

    const userId = Number(
      sessionData?.user?.id ??
        sessionData?.id ??
        0
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return null;
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },

        include: {
          outlet: true,
        },
      });

    if (
      !user ||
      !user.active
    ) {
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

function canManufacture(
  role: string
) {
  return (
    role === "ADMIN" ||
    role === "MANAGER" ||
    role === "OUTLET_ADMIN"
  );
}

/*
 * =========================================================
 * RECIPE ITEM QTY
 * =========================================================
 *
 * RecipeItem.qty dianggap SUDAH BASE UNIT.
 *
 * SANGAT PENTING:
 *
 * Tidak ada:
 *
 *   toBaseQty()
 *
 * Tidak ada:
 *
 *   conversionRate
 *
 * Tidak ada:
 *
 *   purchase unit conversion
 *
 * Tidak ada:
 *
 *   recipe.outputQty scaling
 *
 * di sini.
 *
 * Nilai RecipeItem.qty dipakai langsung sebagai qty base.
 *
 * =========================================================
 */

function getRecipeItemBaseQty(
  item: any
) {
  const qty = Number(
    item?.qty ?? 0
  );

  if (
    !Number.isFinite(qty)
  ) {
    throw new Error(
      `Qty bahan Recipe tidak valid untuk ${
        item?.barang?.name ||
        "barang"
      }.`
    );
  }

  if (qty <= 0) {
    throw new Error(
      `Qty bahan Recipe harus lebih besar dari 0 untuk ${
        item?.barang?.name ||
        "barang"
      }.`
    );
  }

  return qty;
}

/*
 * =========================================================
 * POST
 * =========================================================
 *
 * Membuat Manufacture Order.
 *
 * IMPORTANT:
 *
 * POST ini TIDAK mengubah stock.
 *
 * Stock hanya berubah ketika:
 *
 * /api/manufacture/orders/[id]/complete
 *
 * =========================================================
 */

export async function POST(
  req: NextRequest
) {
  try {
    /*
     * =======================================================
     * AUTH
     * =======================================================
     */

    const user =
      await getCurrentUser();

    if (
      !user ||
      !user.active
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login.",
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

    const role =
      String(
        user.role
      ).toUpperCase();

    if (
      !canManufacture(role)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak memiliki akses Manufacture.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =======================================================
     * REQUEST BODY
     * =======================================================
     */

    const body =
      await req
        .json()
        .catch(() => ({}));

    const requestedOutletId =
      Number(
        body?.outletId || 0
      );

    /*
     * OUTLET_ADMIN:
     * hanya boleh menggunakan outlet sendiri.
     *
     * ADMIN / MANAGER:
     * menggunakan outletId dari request.
     */

    const outletId =
      role === "OUTLET_ADMIN"
        ? Number(
            user.outletId || 0
          )
        : requestedOutletId;

    if (
      !Number.isInteger(
        outletId
      ) ||
      outletId <= 0
    ) {
      throw new Error(
        "Outlet produksi wajib dipilih."
      );
    }

    if (
      role === "OUTLET_ADMIN" &&
      Number(
        user.outletId
      ) !== outletId
    ) {
      throw new Error(
        "Akses outlet ditolak."
      );
    }

    /*
     * =======================================================
     * RECIPE ID
     * =======================================================
     */

    const recipeId =
      Number(
        body?.recipeId || 0
      );

    if (
      !Number.isInteger(
        recipeId
      ) ||
      recipeId <= 0
    ) {
      throw new Error(
        "Recipe ID tidak valid."
      );
    }

    /*
     * =======================================================
     * PLANNED PRODUCTION QTY
     * =======================================================
     *
     * plannedQty = jumlah produksi / batch.
     *
     * Contoh:
     *
     * BOM Cuka = 0.03 ml
     *
     * plannedQty 1:
     *   0.03 × 1 = 0.03
     *
     * plannedQty 10:
     *   0.03 × 10 = 0.30
     *
     * =======================================================
     */

    const plannedQty =
      Number(
        body?.plannedQty || 0
      );

    if (
      !Number.isFinite(
        plannedQty
      ) ||
      plannedQty <= 0
    ) {
      throw new Error(
        "Qty produksi harus lebih besar dari 0."
      );
    }

    /*
     * =======================================================
     * TRANSACTION
     * =======================================================
     */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * =================================================
           * OUTLET
           * =================================================
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

          if (
            !outlet ||
            !outlet.active
          ) {
            throw new Error(
              "Outlet produksi tidak ditemukan atau tidak aktif."
            );
          }

          /*
           * =================================================
           * RECIPE / BOM
           * =================================================
           */

          const recipe =
            await tx.recipe.findUnique({
              where: {
                id: recipeId,
              },

              include: {
                items: {
                  include: {
                    barang: true,
                  },

                  orderBy: {
                    id: "asc",
                  },
                },

                outputBarang: true,

                productCk: true,
              },
            });

          if (
            !recipe ||
            !recipe.active
          ) {
            throw new Error(
              "Recipe / BOM tidak ditemukan atau tidak aktif."
            );
          }

          /*
           * Manufacture Recipe tidak boleh
           * berasal dari Menu POS.
           */

          if (
            recipe.menuId !== null
          ) {
            throw new Error(
              "Recipe Manufacture tidak boleh menggunakan Menu POS."
            );
          }

          /*
           * Jika Recipe memiliki outlet,
           * harus sesuai outlet produksi.
           */

          if (
            recipe.outletId &&
            recipe.outletId !==
              outletId
          ) {
            throw new Error(
              "Recipe / BOM bukan milik outlet tersebut."
            );
          }

          /*
           * =================================================
           * OUTPUT BARANG
           * =================================================
           */

          if (
            !recipe.outputBarangId ||
            !recipe.outputBarang?.active
          ) {
            throw new Error(
              "Barang output Recipe tidak valid."
            );
          }

          /*
           * =================================================
           * RECIPE ITEMS
           * =================================================
           */

          if (
            !recipe.items.length
          ) {
            throw new Error(
              "Recipe / BOM belum memiliki bahan."
            );
          }

          /*
           * =================================================
           * IMPORTANT UNIT POLICY
           * =================================================
           *
           * recipe.outputQty SENGAJA TIDAK digunakan
           * untuk menghitung kebutuhan bahan.
           *
           * RecipeItem.qty sudah disimpan sebagai BASE UNIT.
           *
           * Dengan demikian:
           *
           * RecipeItem:
           *   qty = 0.03
           *   unit = ml
           *
           * Manufacture:
           *   plannedQty = 1
           *
           * kebutuhan:
           *   0.03 × 1 = 0.03
           *
           * Tidak ada lagi:
           *
           *   plannedQty / recipe.outputQty
           *
           * karena itu dapat membuat:
           *
           * 0.03 -> 30
           *
           * apabila outputQty lama tersimpan 0.001.
           * =================================================
           */

          /*
           * =================================================
           * BUILD REQUIREMENTS
           * =================================================
           */

          const requirements =
            recipe.items.map(
              (item) => {
                /*
                 * RecipeItem.qty SUDAH BASE UNIT.
                 *
                 * Tidak ada konversi lagi.
                 */

                const recipeQtyBase =
                  getRecipeItemBaseQty(
                    item
                  );

                /*
                 * Hanya dikalikan jumlah produksi.
                 */

                const qtyBase =
                  recipeQtyBase *
                  plannedQty;

                if (
                  !Number.isFinite(
                    qtyBase
                  ) ||
                  qtyBase <= 0
                ) {
                  throw new Error(
                    `Qty kebutuhan bahan tidak valid untuk ${
                      item?.barang?.name ||
                      "barang"
                    }.`
                  );
                }

                return {
                  barangId:
                    item.barangId,

                  qtyBase,

                  barang:
                    item.barang,
                };
              }
            );

          /*
           * =================================================
           * MERGE DUPLICATE BARANG
           * =================================================
           *
           * Kalau barang yang sama muncul beberapa kali
           * dalam Recipe, kebutuhan digabung.
           * =================================================
           */

          const merged =
            new Map<
              number,
              {
                barangId: number;
                qtyBase: number;
                barang: any;
              }
            >();

          for (
            const requirement of
              requirements
          ) {
            const old =
              merged.get(
                requirement.barangId
              );

            merged.set(
              requirement.barangId,
              {
                barangId:
                  requirement.barangId,

                qtyBase:
                  (old?.qtyBase || 0) +
                  requirement.qtyBase,

                barang:
                  requirement.barang,
              }
            );
          }

          /*
           * =================================================
           * DOCUMENT NUMBER
           * =================================================
           */

          const now =
            new Date();

          const period =
            `${now.getFullYear()}${String(
              now.getMonth() + 1
            ).padStart(
              2,
              "0"
            )}`;

          const doc =
            await tx.documentNumber.upsert(
              {
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
                  lastNumber:
                    true,
                },
              }
            );

          const number =
            `${doc.prefix}-${String(
              doc.lastNumber
            ).padStart(
              4,
              "0"
            )}`;

          /*
           * =================================================
           * CREATE MANUFACTURE ORDER
           * =================================================
           *
           * TIDAK ADA STOCK UPDATE DI SINI.
           *
           * ManufactureOrderItem.plannedQty:
           *   sudah BASE UNIT.
           * =================================================
           */

          const order =
            await tx.manufactureOrder.create(
              {
                data: {
                  number,

                  outletId,

                  recipeId,

                  plannedQty,

                  producedQty: 0,

                  status:
                    "PLANNED",

                  productionDate:
                    now,

                  note:
                    body?.note
                      ? String(
                          body.note
                        ).trim()
                      : null,

                  createdBy:
                    user.id,

                  items: {
                    create:
                      Array.from(
                        merged.values()
                      ).map(
                        (
                          requirement
                        ) => ({
                          barangId:
                            requirement.barangId,

                          /*
                           * FINAL BASE QTY
                           *
                           * Tidak dikonversi.
                           */

                          plannedQty:
                            requirement.qtyBase,

                          actualQty: 0,
                        })
                      ),
                  },
                },

                include: {
                  /*
                   * Tetap mempertahankan response
                   * yang digunakan frontend.
                   */

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
                  },
                },
              }
            );

          return order;
        }
      );

    /*
     * =======================================================
     * SUCCESS
     * =======================================================
     */

    return NextResponse.json(
      {
        success: true,

        message:
          "Manufacture Order berhasil dibuat. Stock belum berubah sampai order diselesaikan.",

        data: result,
      },
      {
        status: 201,
      }
    );
  } catch (error: any) {
    console.error(
      "POST /api/manufacture/orders ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal membuat Manufacture Order.",
      },
      {
        status: 400,
      }
    );
  }
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
 *
 * =========================================================
 */

export async function GET(
  req: NextRequest
) {
  try {
    /*
     * =======================================================
     * AUTH
     * =======================================================
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
        }
      );
    }

    /*
     * =======================================================
     * ROLE
     * =======================================================
     */

    if (
      !canManufacture(
        String(
          user.role
        ).toUpperCase()
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
        }
      );
    }

    const {
      searchParams,
    } = new URL(req.url);

    const requestedOutletId =
      searchParams.get(
        "outletId"
      );

    const status =
      searchParams.get(
        "status"
      );

    const search =
      searchParams
        .get("search")
        ?.trim();

    /*
     * =======================================================
     * OUTLET FILTER
     * =======================================================
     */

    let outletId:
      | number
      | undefined;

    /*
     * OUTLET_ADMIN:
     * selalu menggunakan outlet sendiri.
     */

    if (
      String(
        user.role
      ).toUpperCase() ===
      "OUTLET_ADMIN"
    ) {
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

      outletId =
        Number(
          user.outletId
        );

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
     * Jika outletId diberikan,
     * filter outlet tersebut.
     *
     * Jika tidak diberikan:
     * semua outlet.
     */

    else if (
      requestedOutletId
    ) {
      const parsed =
        Number(
          requestedOutletId
        );

      if (
        !Number.isInteger(
          parsed
        ) ||
        parsed <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet ID tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      outletId =
        parsed;
    }

    /*
     * =======================================================
     * WHERE
     * =======================================================
     */

    const where: any = {};

    if (
      outletId !== undefined
    ) {
      where.outletId =
        outletId;
    }

    if (status) {
      where.status =
        status;
    }

    if (search) {
      where.OR = [
        {
          number: {
            contains:
              search,
          },
        },

        {
          recipe: {
            name: {
              contains:
                search,
            },
          },
        },

        {
          recipe: {
            code: {
              contains:
                search,
            },
          },
        },
      ];
    }

    /*
     * =======================================================
     * QUERY MANUFACTURE ORDER
     * =======================================================
     */

    const data =
      await prisma.manufactureOrder.findMany(
        {
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
                    outputBarang:
                      true,
                  },
                },

                outputBarang:
                  true,

                menu:
                  true,

                items: {
                  include: {
                    barang:
                      true,
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
              productionDate:
                "desc",
            },

            {
              id:
                "desc",
            },
          ],
        }
      );

    /*
     * =======================================================
     * AMBIL OUTLET TERPISAH
     * =======================================================
     */

    const outletIds =
      Array.from(
        new Set(
          data
            .map((order) =>
              Number(
                order.outletId
              )
            )
            .filter(
              (id) =>
                Number.isInteger(
                  id
                ) &&
                id > 0
            )
        )
      );

    const outlets =
      outletIds.length > 0
        ? await prisma.outlet.findMany(
            {
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
            }
          )
        : [];

    const outletMap =
      new Map(
        outlets.map(
          (outlet) => [
            outlet.id,
            outlet,
          ]
        )
      );

    /*
     * =======================================================
     * FORMAT RESPONSE
     * =======================================================
     */

    const formattedData =
      await Promise.all(
        data.map(
          async (order) => {
            /*
             * -----------------------------------------------
             * OUTLET
             * -----------------------------------------------
             */

            const orderOutletId =
              Number(
                order.outletId
              );

            const outlet =
              outletMap.get(
                orderOutletId
              ) ?? null;

            /*
             * -----------------------------------------------
             * BARANG IDS
             * -----------------------------------------------
             */

            const barangIds =
              Array.from(
                new Set(
                  order.items
                    .map(
                      (item) =>
                        Number(
                          item.barangId
                        )
                    )
                    .filter(
                      (id) =>
                        Number.isInteger(
                          id
                        ) &&
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
             *
             *   Barang.stock
             *   Inventory.stock
             * -----------------------------------------------
             */

            const outletStocks =
              orderOutletId > 0 &&
              barangIds.length > 0
                ? await prisma.outletStock.findMany(
                    {
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
                        minimumStock:
                          true,
                        averageCost:
                          true,
                      },
                    }
                  )
                : [];

            /*
             * -----------------------------------------------
             * STOCK MAP
             * -----------------------------------------------
             */

            const stockMap =
              new Map(
                outletStocks.map(
                  (stock) => [
                    Number(
                      stock.barangId
                    ),
                    stock,
                  ]
                )
              );

            /*
             * -----------------------------------------------
             * FORMAT ITEMS
             * -----------------------------------------------
             */

            const items =
              order.items.map(
                (item) => {
                  const barangId =
                    Number(
                      item.barangId
                    );

                  const stock =
                    stockMap.get(
                      barangId
                    );

                  const barang =
                    item.barang;

                  /*
                   * -----------------------------------------
                   * UNIT
                   * -----------------------------------------
                   */

                  const unit =
                    barang?.unit ??
                    "";

                  const baseUnit =
                    barang?.baseUnit ??
                    unit;

                  const conversionRate =
                    Number(
                      barang?.conversionRate ??
                        1
                    );

                  const hasConversion =
                    Boolean(
                      unit &&
                        baseUnit &&
                        unit !==
                          baseUnit &&
                        conversionRate >
                          1
                    );

                  /*
                   * -----------------------------------------
                   * DEFAULT OUTLET STOCK
                   * -----------------------------------------
                   *
                   * Jangan fallback ke Barang.stock.
                   *
                   * Kalau belum ada OutletStock,
                   * dianggap 0.
                   * -----------------------------------------
                   */

                  const outletStock =
                    stock ?? {
                      id: null,

                      outletId:
                        orderOutletId,

                      barangId,

                      stock: 0,

                      minimumStock:
                        0,

                      averageCost:
                        0,
                    };

                  /*
                   * -----------------------------------------
                   * BARANG RESPONSE
                   * -----------------------------------------
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

                          /*
                           * OutletStock Manufacture
                           * menggunakan BASE UNIT.
                           */

                          stockUnit:
                            baseUnit,

                          stockBaseUnit:
                            baseUnit,
                        }
                      : barang;

                  return {
                    ...item,

                    outletStock,

                    barang:
                      formattedBarang,
                  };
                }
              );

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
          }
        )
      );

    /*
     * =======================================================
     * RESPONSE
     * =======================================================
     */

    return NextResponse.json({
      success: true,

      scope: {
        role:
          user.role,

        outletId:
          String(
            user.role
          ).toUpperCase() ===
          "OUTLET_ADMIN"
            ? Number(
                user.outletId
              )
            : outletId ??
              null,
      },

      total:
        formattedData.length,

      data:
        formattedData,

      policy: {
        manufactureStockSource:
          "OutletStock",

        centralBarangStockTouched:
          false,

        centralInventoryStockTouched:
          false,

        outletStockOnly:
          true,

        recipeQtyPolicy:
          "RecipeItem.qty is already BASE UNIT and is multiplied only by Manufacture plannedQty.",

        conversionAtManufacture:
          false,

        outputQtyUsedForMaterialScaling:
          false,
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