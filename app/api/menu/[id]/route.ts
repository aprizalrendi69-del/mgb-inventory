import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * MENU API
 * =========================================================
 *
 * Endpoint:
 *
 *   /api/menu/[id]
 *
 * PUT
 *   Update master Menu.
 *
 * DELETE
 *   Nonaktifkan Menu.
 *
 * =========================================================
 *
 * ARCHITECTURE
 *
 * Menu
 *   ↓
 * Recipe / BOM
 *   ↓
 * RecipeItem
 *   ↓
 * Barang
 *
 * Recipe/BOM bersifat GLOBAL.
 *
 * TIDAK ADA outletId di Recipe.
 *
 * Stock TIDAK disentuh oleh API Menu.
 *
 * Stock hanya diproses ketika:
 *
 *   /api/manufacture
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
 * 1. erp-session = token Session
 *
 * 2. erp-session = JSON
 *
 *    {"id":1}
 *    {"user":{"id":1}}
 *
 * 3. session = token / JSON
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
     * Bukan token session.
     * Lanjut mencoba JSON session.
     */
  }

  /*
   * -------------------------------------------------------
   * JSON SESSION
   * -------------------------------------------------------
   */

  try {
    const parsed =
      JSON.parse(session.value);

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
 * ERROR RESPONSE
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
 * ROLE
 * =========================================================
 *
 * Pengelolaan master Menu:
 *
 * ADMIN
 * MANAGER
 *
 * OUTLET_ADMIN tidak boleh mengubah Menu global.
 *
 * =========================================================
 */

function canManageMenu(
  role: unknown
) {
  return [
    "ADMIN",
    "MANAGER",
  ].includes(
    String(role).toUpperCase()
  );
}

/*
 * =========================================================
 * MENU ID
 * =========================================================
 */

function parseMenuId(
  value: string
) {
  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

/*
 * =========================================================
 * PUT
 * =========================================================
 *
 * Update master Menu.
 *
 * Body yang didukung:
 *
 * {
 *   "code": "MENU001",
 *   "name": "Korean BBQ",
 *   "category": "MAIN",
 *   "description": "...",
 *   "image": "...",
 *   "price": 150000,
 *   "active": true
 * }
 *
 * =========================================================
 *
 * CATATAN:
 *
 * API ini TIDAK:
 *
 *   - mengubah Recipe
 *   - mengubah RecipeItem
 *   - mengubah Barang
 *   - mengubah Barang.stock
 *   - mengubah Inventory
 *   - mengubah OutletStock
 *   - melakukan Manufacture
 *
 * BOM dikelola melalui:
 *
 *   /api/menu-bom/[menuId]
 *
 * =========================================================
 */

export async function PUT(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
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
     * ROLE
     * -------------------------------------------------------
     */

    if (
      !canManageMenu(
        user.role
      )
    ) {
      return fail(
        "Tidak memiliki akses.",
        403
      );
    }

    /*
     * -------------------------------------------------------
     * MENU ID
     * -------------------------------------------------------
     */

    const menuId =
      parseMenuId(
        (await params).id
      );

    if (!menuId) {
      return fail(
        "ID menu tidak valid."
      );
    }

    /*
     * -------------------------------------------------------
     * CHECK MENU
     * -------------------------------------------------------
     */

    const existingMenu =
      await prisma.menu.findUnique({
        where: {
          id: menuId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },
      });

    if (!existingMenu) {
      return fail(
        "Menu tidak ditemukan.",
        404
      );
    }

    /*
     * -------------------------------------------------------
     * BODY
     * -------------------------------------------------------
     */

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return fail(
        "Request body tidak valid."
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return fail(
        "Data menu tidak valid."
      );
    }

    const input =
      body as Record<
        string,
        unknown
      >;

    /*
     * -------------------------------------------------------
     * BUILD UPDATE DATA
     * -------------------------------------------------------
     */

    const data: Record<
      string,
      unknown
    > = {};

    /*
     * -------------------------------------------------------
     * CODE
     * -------------------------------------------------------
     */

    if (
      input.code !== undefined
    ) {
      const code =
        String(
          input.code ?? ""
        ).trim();

      if (!code) {
        return fail(
          "Kode menu wajib diisi."
        );
      }

      data.code = code;
    }

    /*
     * -------------------------------------------------------
     * NAME
     * -------------------------------------------------------
     */

    if (
      input.name !== undefined
    ) {
      const name =
        String(
          input.name ?? ""
        ).trim();

      if (!name) {
        return fail(
          "Nama menu wajib diisi."
        );
      }

      data.name = name;
    }

    /*
     * -------------------------------------------------------
     * CATEGORY
     * -------------------------------------------------------
 */

    if (
      input.category !== undefined
    ) {
      const category =
        input.category === null
          ? null
          : String(
              input.category
            ).trim();

      data.category =
        category || null;
    }

    /*
     * -------------------------------------------------------
     * DESCRIPTION
     * -------------------------------------------------------
 */

    if (
      input.description !== undefined
    ) {
      const description =
        input.description === null
          ? null
          : String(
              input.description
            ).trim();

      data.description =
        description || null;
    }

    /*
     * -------------------------------------------------------
     * IMAGE
     * -------------------------------------------------------
 */

    if (
      input.image !== undefined
    ) {
      const image =
        input.image === null
          ? null
          : String(
              input.image
            ).trim();

      data.image =
        image || null;
    }

    /*
     * -------------------------------------------------------
     * PRICE
     * -------------------------------------------------------
 */

    if (
      input.price !== undefined
    ) {
      const price =
        Number(
          input.price
        );

      if (
        !Number.isFinite(price) ||
        price < 0
      ) {
        return fail(
          "Harga menu tidak valid."
        );
      }

      data.price = price;
    }

    /*
     * -------------------------------------------------------
     * ACTIVE
     * -------------------------------------------------------
 */

    if (
      input.active !== undefined
    ) {
      /*
       * Jangan menggunakan Boolean("false")
       * karena hasilnya true.
       */

      if (
        typeof input.active ===
        "boolean"
      ) {
        data.active =
          input.active;
      } else if (
        input.active ===
          "true" ||
        input.active === 1 ||
        input.active === "1"
      ) {
        data.active = true;
      } else if (
        input.active ===
          "false" ||
        input.active === 0 ||
        input.active === "0"
      ) {
        data.active = false;
      } else {
        return fail(
          "Status active tidak valid."
        );
      }
    }

    /*
     * -------------------------------------------------------
     * NOTHING TO UPDATE
     * -------------------------------------------------------
 */

    if (
      Object.keys(data).length === 0
    ) {
      return fail(
        "Tidak ada data menu yang diubah."
      );
    }

    /*
     * -------------------------------------------------------
     * UNIQUE CODE CHECK
     * -------------------------------------------------------
     */

    if (
      data.code !== undefined
    ) {
      const duplicate =
        await prisma.menu.findFirst({
          where: {
            code:
              data.code as string,

            NOT: {
              id: menuId,
            },
          },

          select: {
            id: true,
          },
        });

      if (duplicate) {
        return fail(
          "Kode menu sudah digunakan."
        );
      }
    }

    /*
     * -------------------------------------------------------
     * UPDATE
     * -------------------------------------------------------
     *
     * Hanya update Menu.
     *
     * Tidak ada include Recipe di sini.
     *
     * BOM memiliki endpoint sendiri:
     *
     *   /api/menu-bom/[menuId]
     *
     * -------------------------------------------------------
     */

    const menu =
      await prisma.menu.update({
        where: {
          id: menuId,
        },

        data,

        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          description: true,
          image: true,
          price: true,
          active: true,
        },
      });

    /*
     * -------------------------------------------------------
     * RESPONSE
     * -------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      message:
        "Menu berhasil diperbarui.",

      data: menu,

      policy: {
        type:
          "GLOBAL_MENU",

        recipePolicy:
          "RECIPE_IS_GLOBAL",

        stockTouched:
          false,

        centralStockTouched:
          false,

        outletStockTouched:
          false,

        bomEndpoint:
          `/api/menu-bom/${menu.id}`,

        manufactureEndpoint:
          "/api/manufacture",
      },
    });
  } catch (error: any) {
    console.error(
      "PUT MENU ERROR:",
      error
    );

    /*
     * -------------------------------------------------------
     * PRISMA UNIQUE
     * -------------------------------------------------------
     */

    if (
      error?.code === "P2002"
    ) {
      return fail(
        "Kode menu sudah digunakan."
      );
    }

    /*
     * -------------------------------------------------------
     * PRISMA NOT FOUND
     * -------------------------------------------------------
     */

    if (
      error?.code === "P2025"
    ) {
      return fail(
        "Menu tidak ditemukan.",
        404
      );
    }

    return fail(
      error?.message ??
        "Gagal mengubah menu.",
      500
    );
  }
}

/*
 * =========================================================
 * DELETE
 * =========================================================
 *
 * DELETE Menu = soft delete.
 *
 * Tidak menghapus Recipe.
 * Tidak menghapus RecipeItem.
 *
 * Menu hanya:
 *
 *   active = false
 *
 * Ini penting supaya histori ManufactureOrder
 * dan relasi Recipe lama tetap aman.
 *
 * =========================================================
 */

export async function DELETE(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
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
     * ROLE
     * -------------------------------------------------------
 */

    if (
      !canManageMenu(
        user.role
      )
    ) {
      return fail(
        "Tidak memiliki akses.",
        403
      );
    }

    /*
     * -------------------------------------------------------
     * MENU ID
     * -------------------------------------------------------
 */

    const menuId =
      parseMenuId(
        (await params).id
      );

    if (!menuId) {
      return fail(
        "ID menu tidak valid."
      );
    }

    /*
     * -------------------------------------------------------
     * CHECK MENU
     * -------------------------------------------------------
 */

    const existingMenu =
      await prisma.menu.findUnique({
        where: {
          id: menuId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },
      });

    if (!existingMenu) {
      return fail(
        "Menu tidak ditemukan.",
        404
      );
    }

    /*
     * -------------------------------------------------------
     * ALREADY INACTIVE
     * -------------------------------------------------------
     *
     * Idempotent.
     *
     * Tidak error kalau menu memang
     * sudah dinonaktifkan.
     * -------------------------------------------------------
 */

    if (!existingMenu.active) {
      return NextResponse.json({
        success: true,

        message:
          "Menu sudah dinonaktifkan.",

        data: existingMenu,

        policy: {
          stockTouched:
            false,

          centralStockTouched:
            false,

          outletStockTouched:
            false,
        },
      });
    }

    /*
     * -------------------------------------------------------
     * SOFT DELETE
     * -------------------------------------------------------
 */

    const menu =
      await prisma.menu.update({
        where: {
          id: menuId,
        },

        data: {
          active: false,
        },

        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          description: true,
          image: true,
          price: true,
          active: true,
        },
      });

    /*
     * -------------------------------------------------------
     * RESPONSE
     * -------------------------------------------------------
 */

    return NextResponse.json({
      success: true,

      message:
        "Menu dinonaktifkan.",

      data: menu,

      policy: {
        type:
          "GLOBAL_MENU",

        recipePolicy:
          "RECIPE_PRESERVED",

        stockTouched:
          false,

        centralStockTouched:
          false,

        outletStockTouched:
          false,

        bomEndpoint:
          `/api/menu-bom/${menu.id}`,

        manufactureEndpoint:
          "/api/manufacture",
      },
    });
  } catch (error: any) {
    console.error(
      "DELETE MENU ERROR:",
      error
    );

    /*
     * -------------------------------------------------------
     * PRISMA NOT FOUND
     * -------------------------------------------------------
     */

    if (
      error?.code === "P2025"
    ) {
      return fail(
        "Menu tidak ditemukan.",
        404
      );
    }

    return fail(
      error?.message ??
        "Gagal menonaktifkan menu.",
      500
    );
  }
}