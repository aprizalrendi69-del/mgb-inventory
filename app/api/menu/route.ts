import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

/*
 * =========================================================
 * MENU + RECIPE / BOM API
 * =========================================================
 *
 * SOURCE:
 *   /api/menu-bom
 *
 * CATATAN:
 *
 * Recipe / BOM bersifat GLOBAL.
 *
 * Recipe TIDAK menyimpan outletId.
 *
 * Stock bahan manufacture TIDAK diambil di endpoint ini.
 *
 * Manufacture memakai:
 *
 *   Recipe
 *      ↓
 *   RecipeItem
 *      ↓
 *   /api/manufacture
 *      ↓
 *   OutletStock
 *
 * Jadi:
 *
 * MENU / BOM
 * = definisi produk & kebutuhan bahan
 *
 * MANUFACTURE
 * = eksekusi produksi pada outlet tertentu
 *
 * =========================================================
 */

/*
 * =========================================================
 * CURRENT USER
 * =========================================================
 *
 * Mendukung:
 *
 * 1. erp-session = session token
 *
 * 2. erp-session / session = JSON session
 *
 *    {"id":1}
 *    {"user":{"id":1}}
 * =========================================================
 */

async function getUser() {
  const cookieStore = await cookies();

  const session =
    cookieStore.get("erp-session") ??
    cookieStore.get("session");

  if (!session?.value) {
    return null;
  }

  /*
   * -------------------------------------------------------
   * SESSION TOKEN
   * -------------------------------------------------------
   */

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
              role: true,
              active: true,
              outletId: true,
            },
          },
        },
      });

    if (
      dbSession &&
      dbSession.expiresAt > new Date() &&
      dbSession.user.active
    ) {
      return dbSession.user;
    }
  } catch {
    /*
     * Jika format cookie bukan token session,
     * lanjut ke JSON session.
     */
  }

  /*
   * -------------------------------------------------------
   * JSON SESSION
   * -------------------------------------------------------
   */

  try {
    const parsed = JSON.parse(
      session.value
    );

    const userId = Number(
      parsed?.user?.id ??
        parsed?.id ??
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

        select: {
          id: true,
          role: true,
          active: true,
          outletId: true,
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
 * ACCESS
 * =========================================================
 *
 * Menu / BOM dapat dilihat oleh:
 *
 * ADMIN
 * MANAGER
 * OUTLET_ADMIN
 *
 * =========================================================
 */

function canView(
  user: {
    role: string;
  }
) {
  return [
    "ADMIN",
    "MANAGER",
    "OUTLET_ADMIN",
  ].includes(
    String(user.role).toUpperCase()
  );
}

/*
 * =========================================================
 * BOM MANAGEMENT
 * =========================================================
 *
 * Untuk membuat / mengubah definisi Menu + BOM,
 * hanya:
 *
 * ADMIN
 * MANAGER
 *
 * =========================================================
 */

function canManage(
  user: {
    role: string;
  }
) {
  return [
    "ADMIN",
    "MANAGER",
  ].includes(
    String(user.role).toUpperCase()
  );
}

/*
 * =========================================================
 * RESPONSE ERROR
 * =========================================================
 */

function fail(
  message: string,
  status = 400,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...(extra ?? {}),
    },
    {
      status,
    }
  );
}

/*
 * =========================================================
 * NORMALIZE RECIPE
 * =========================================================
 *
 * Supaya frontend Manufacture tidak perlu memahami
 * seluruh struktur Prisma.
 *
 * Payload recipe tetap mengandung:
 *
 * - menu
 * - productCk
 * - outputBarang legacy
 * - items
 *
 * Stock TIDAK dimasukkan dari Barang.stock.
 *
 * Manufacture akan membaca OutletStock saat eksekusi.
 *
 * =========================================================
 *
 * PERBAIKAN:
 *
 * RecipeItem sekarang juga mengembalikan:
 *
 *   maxPrice
 *
 * maxPrice adalah batas maksimum HPP material
 * PER BASE UNIT.
 *
 * null = tidak ada batas.
 *
 * =========================================================
 */

function formatRecipe(
  recipe: any
) {
  return {
    id: recipe.id,
    code: recipe.code,
    name: recipe.name,

    menuId: recipe.menuId,
    productCkId: recipe.productCkId,

    outputBarangId:
      recipe.outputBarangId,

    outputQty:
      Number(recipe.outputQty ?? 1),

    notes: recipe.notes,
    active: recipe.active,

    menu: recipe.menu
      ? {
          id: recipe.menu.id,
          code: recipe.menu.code,
          name: recipe.menu.name,
          category:
            recipe.menu.category,
          price:
            Number(
              recipe.menu.price ?? 0
            ),
          active:
            recipe.menu.active,
        }
      : null,

    productCk: recipe.productCk
      ? {
          id: recipe.productCk.id,
          code: recipe.productCk.code,
          name: recipe.productCk.name,
          active:
            recipe.productCk.active,

          outputBarang:
            recipe.productCk.outputBarang
              ? {
                  id:
                    recipe.productCk
                      .outputBarang.id,

                  code:
                    recipe.productCk
                      .outputBarang.code,

                  name:
                    recipe.productCk
                      .outputBarang.name,

                  unit:
                    recipe.productCk
                      .outputBarang.unit,

                  baseUnit:
                    recipe.productCk
                      .outputBarang.baseUnit,

                  conversionRate:
                    Number(
                      recipe.productCk
                        .outputBarang
                        .conversionRate ?? 1
                    ),
                }
              : null,
        }
      : null,

    outputBarang:
      recipe.outputBarang
        ? {
            id:
              recipe.outputBarang.id,

            code:
              recipe.outputBarang.code,

            name:
              recipe.outputBarang.name,

            unit:
              recipe.outputBarang.unit,

            baseUnit:
              recipe.outputBarang.baseUnit,

            conversionRate:
              Number(
                recipe.outputBarang
                  .conversionRate ?? 1
              ),

            active:
              recipe.outputBarang.active,
          }
        : null,

    /*
     * =======================================================
     * RECIPE ITEMS
     * =======================================================
     */

    items: (
      recipe.items ?? []
    ).map(
      (item: any) => ({
        id: item.id,

        recipeId:
          item.recipeId,

        barangId:
          item.barangId,

        qty: Number(
          item.qty ?? 0
        ),

        unit:
          item.unit ??
          item.barang?.unit ??
          null,

        /*
         * ===================================================
         * PERBAIKAN UTAMA
         * ===================================================
         *
         * maxPrice sekarang dikirim ke frontend.
         *
         * Jika database NULL:
         *   => null
         *
         * Jika ada nilai:
         *   => Number
         *
         * maxPrice bukan stock.
         * maxPrice bukan purchasePrice.
         * maxPrice adalah batas HPP per base unit.
         * ===================================================
         */

        maxPrice:
          item.maxPrice === null ||
          item.maxPrice === undefined
            ? null
            : Number(
                item.maxPrice
              ),

        barang: item.barang
          ? {
              id:
                item.barang.id,

              code:
                item.barang.code,

              barcode:
                item.barang.barcode,

              name:
                item.barang.name,

              category:
                item.barang.category,

              brand:
                item.barang.brand,

              unit:
                item.barang.unit,

              baseUnit:
                item.barang.baseUnit,

              conversionRate:
                Number(
                  item.barang
                    .conversionRate ?? 1
                ),

              active:
                item.barang.active,
            }
          : null,
      })
    ),
  };
}

/*
 * =========================================================
 * GET
 * =========================================================
 *
 * Mengambil:
 *
 * Menu
 *   +
 * Recipe / BOM aktif
 *   +
 * RecipeItem
 *   +
 * maxPrice
 *
 * Query:
 *
 * ?q=ayam
 *
 * Tidak ada outletId.
 *
 * Karena Menu + BOM GLOBAL.
 *
 * =========================================================
 */

export async function GET(
  req: NextRequest
) {
  try {
    /*
     * -------------------------------------------------------
     * AUTH
     * -------------------------------------------------------
     */

    const user =
      await getUser();

    if (!user) {
      return fail(
        "Tidak login.",
        401
      );
    }

    /*
     * -------------------------------------------------------
     * ACCESS
     * -------------------------------------------------------
     */

    if (!canView(user)) {
      return fail(
        "Tidak memiliki akses.",
        403
      );
    }

    /*
     * -------------------------------------------------------
     * SEARCH
     * -------------------------------------------------------
     */

    const q =
      (
        req.nextUrl.searchParams.get(
          "q"
        ) ?? ""
      ).trim();

    /*
     * -------------------------------------------------------
     * MENU
     * -------------------------------------------------------
     */

    const menus =
      await prisma.menu.findMany({
        where: q
          ? {
              OR: [
                {
                  name: {
                    contains: q,
                  },
                },

                {
                  code: {
                    contains: q,
                  },
                },

                {
                  category: {
                    contains: q,
                  },
                },
              ],
            }
          : undefined,

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

                orderBy: {
                  id: "asc",
                },
              },

              productCk: {
                include: {
                  outputBarang: true,
                },
              },

              outputBarang: true,
            },

            orderBy: {
              id: "asc",
            },
          },
        },

        orderBy: [
          {
            active: "desc",
          },

          {
            category: "asc",
          },

          {
            name: "asc",
          },
        ],
      });

    /*
     * -------------------------------------------------------
     * FORMAT
     * -------------------------------------------------------
     */

    const data =
      menus.map(
        (menu) => ({
          id: menu.id,

          code: menu.code,

          name: menu.name,

          category:
            menu.category,

          description:
            menu.description,

          image:
            menu.image,

          price:
            Number(
              menu.price ?? 0
            ),

          active:
            menu.active,

          recipes:
            menu.recipes.map(
              (recipe) =>
                formatRecipe(recipe)
            ),
        })
      );

    /*
     * -------------------------------------------------------
     * RESPONSE
     * -------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      /*
       * Menjelaskan bahwa endpoint ini hanya
       * master Menu + BOM.
       */

      scope: {
        type:
          "GLOBAL_MENU_BOM",

        stockSource:
          "OutletStock",

        hppPolicy: {
          actualHppSource:
            "OutletStock.averageCost",

          maxPriceSource:
            "RecipeItem.maxPrice",

          maxPriceUnit:
            "BASE_UNIT",

          nullMeans:
            "NO_LIMIT",
        },
      },

      total:
        data.length,

      data,
    });
  } catch (error: any) {
    console.error(
      "GET MENU/BOM ERROR:",
      error
    );

    return fail(
      error?.message ??
        "Gagal mengambil menu dan BOM.",
      500
    );
  }
}

/*
 * =========================================================
 * POST
 * =========================================================
 *
 * Membuat MENU baru.
 *
 * CATATAN:
 *
 * POST ini TIDAK melakukan manufacture.
 *
 * POST ini TIDAK memotong stock.
 *
 * Manufacture hanya melalui:
 *
 *   POST /api/manufacture
 *
 * =========================================================
 */

export async function POST(
  req: NextRequest
) {
  try {
    /*
     * -------------------------------------------------------
     * AUTH
     * -------------------------------------------------------
     */

    const user =
      await getUser();

    if (!user) {
      return fail(
        "Tidak login.",
        401
      );
    }

    /*
     * -------------------------------------------------------
     * ACCESS
     * -------------------------------------------------------
     */

    if (!canManage(user)) {
      return fail(
        "Hanya Admin/Manager yang dapat menambah menu.",
        403
      );
    }

    /*
     * -------------------------------------------------------
     * BODY
     * -------------------------------------------------------
     */

    let body: any;

    try {
      body = await req.json();
    } catch {
      return fail(
        "Request body tidak valid."
      );
    }

    /*
     * -------------------------------------------------------
     * CODE
     * -------------------------------------------------------
     */

    const code =
      String(
        body?.code ?? ""
      ).trim();

    /*
     * -------------------------------------------------------
     * NAME
     * -------------------------------------------------------
     */

    const name =
      String(
        body?.name ?? ""
      ).trim();

    if (!code || !name) {
      return fail(
        "Kode dan nama menu wajib diisi."
      );
    }

    /*
     * -------------------------------------------------------
     * VALIDATE CODE
     * -------------------------------------------------------
     */

    const existing =
      await prisma.menu.findUnique({
        where: {
          code,
        },

        select: {
          id: true,
        },
      });

    if (existing) {
      return fail(
        "Kode menu sudah digunakan."
      );
    }

    /*
     * -------------------------------------------------------
     * PRICE
     * -------------------------------------------------------
     */

    const price =
      Number(
        body?.price ?? 0
      );

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      return fail(
        "Harga menu tidak valid."
      );
    }

    /*
     * -------------------------------------------------------
     * CREATE
     * -------------------------------------------------------
     *
     * Hanya membuat master Menu.
     *
     * BOM dibuat melalui:
     *
     *   /api/menu-bom/[menuId]
     *
     * Stock tidak disentuh.
     * -------------------------------------------------------
     */

    const menu =
      await prisma.menu.create({
        data: {
          code,

          name,

          category:
            body?.category
              ? String(
                  body.category
                ).trim()
              : null,

          description:
            body?.description
              ? String(
                  body.description
                ).trim()
              : null,

          image:
            body?.image
              ? String(
                  body.image
                ).trim()
              : null,

          price,

          active:
            body?.active !== false,
        },
      });

    /*
     * -------------------------------------------------------
     * RESPONSE
     * -------------------------------------------------------
     */

    return NextResponse.json(
      {
        success: true,

        message:
          "Menu berhasil dibuat.",

        data: menu,

        policy: {
          type:
            "GLOBAL_MENU",

          bomEndpoint:
            `/api/menu-bom/${menu.id}`,

          stockTouched:
            false,

          centralStockTouched:
            false,

          outletStockTouched:
            false,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error: any) {
    console.error(
      "POST MENU ERROR:",
      error
    );

    /*
     * -------------------------------------------------------
     * PRISMA UNIQUE
     * -------------------------------------------------------
     */

    if (
      error?.code ===
      "P2002"
    ) {
      return fail(
        "Kode menu sudah digunakan."
      );
    }

    return fail(
      error?.message ??
        "Gagal menambah menu.",
      500
    );
  }
}