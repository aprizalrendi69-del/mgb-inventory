import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";

/**
 * ============================================================
 * MENU BOM API
 * ============================================================
 *
 * maxPrice:
 * - Disimpan pada RecipeItem
 * - Merupakan batas maksimum HPP material PER BASE UNIT
 * - null = tidak ada batas maksimum
 * - Tidak mengubah stock / OutletStock
 * - Tidak mengubah purchasePrice Barang
 *
 * Contoh:
 * Barang unit = "KG"
 * conversionRate = 1000
 * averageCost = 25000 / KG
 *
 * HPP base unit = 25000 / 1000 = 25 / gram
 *
 * Jika maxPrice = 30
 * maka warning jika HPP aktual > 30 / base unit.
 * ============================================================
 */

type SessionUser = {
  id: number;
  role: string;
  outletId?: number | null;
  name?: string | null;
  email?: string | null;
};

/**
 * ------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------
 */

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * maxPrice:
 * - undefined / null / "" => null
 * - harus angka finite
 * - harus > 0 jika diisi
 * - dibulatkan 2 decimal
 */
function normalizeMaxPrice(value: unknown): number | null {
  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error("Batas maksimum HPP harus berupa angka yang valid.");
  }

  if (numberValue <= 0) {
    throw new Error(
      "Batas maksimum HPP harus lebih besar dari 0. Kosongkan jika tidak ada batas."
    );
  }

  return roundMoney(numberValue);
}

/**
 * ------------------------------------------------------------
 * Auth
 * ------------------------------------------------------------
 */

async function getUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();

    const token =
      cookieStore.get("erp-session")?.value ||
      cookieStore.get("session")?.value;

    if (!token) {
      return null;
    }

    /**
     * --------------------------------------------------------
     * Primary session: database session
     * --------------------------------------------------------
     */
    try {
      const session = await prisma.session.findUnique({
        where: {
          token,
        },
        include: {
          user: true,
        },
      });

      if (session?.user) {
        return {
          id: session.user.id,
          role: session.user.role,
          outletId: session.user.outletId ?? null,
          name: session.user.name ?? null,
          email: session.user.email ?? null,
        };
      }
    } catch {
      /**
       * Beberapa versi project bisa saja belum memiliki
       * struktur Session yang sama.
       *
       * Jangan langsung gagal di sini.
       * Lanjutkan ke legacy session JSON.
       */
    }

    /**
     * --------------------------------------------------------
     * Legacy session JSON fallback
     * --------------------------------------------------------
     */
    try {
      const decoded = decodeURIComponent(token);
      const parsed = JSON.parse(decoded);

      if (parsed?.user) {
        return {
          id: Number(parsed.user.id),
          role: String(parsed.user.role),
          outletId:
            parsed.user.outletId !== undefined &&
            parsed.user.outletId !== null
              ? Number(parsed.user.outletId)
              : null,
          name: parsed.user.name ?? null,
          email: parsed.user.email ?? null,
        };
      }

      if (parsed?.id && parsed?.role) {
        return {
          id: Number(parsed.id),
          role: String(parsed.role),
          outletId:
            parsed.outletId !== undefined && parsed.outletId !== null
              ? Number(parsed.outletId)
              : null,
          name: parsed.name ?? null,
          email: parsed.email ?? null,
        };
      }
    } catch {
      // Ignore invalid legacy session.
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Role yang boleh mengelola BOM.
 */
function canManageBom(role: string) {
  return ["ADMIN", "MANAGER", "GUDANG"].includes(role);
}

/**
 * ------------------------------------------------------------
 * PUT
 * ------------------------------------------------------------
 *
 * Update / create BOM untuk Menu.
 *
 * Payload:
 * {
 *   items: [
 *     {
 *       barangId: number,
 *       qty: number,
 *       unit: string,
 *       maxPrice?: number | null
 *     }
 *   ],
 *   outputQty?: number,
 *   notes?: string | null
 * }
 *
 * maxPrice TIDAK dikonversi karena nilainya sudah merupakan
 * batas HPP per base unit.
 * ------------------------------------------------------------
 */

export async function PUT(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    /**
     * --------------------------------------------------------
     * AUTH
     * --------------------------------------------------------
     */
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    if (!canManageBom(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message: "Anda tidak memiliki akses untuk mengelola BOM.",
        },
        {
          status: 403,
        }
      );
    }

    /**
     * --------------------------------------------------------
     * PARAMS
     * --------------------------------------------------------
     */
    const { id } = await params;

    const menuId = Number(id);

    if (!Number.isInteger(menuId) || menuId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "ID menu tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    /**
     * --------------------------------------------------------
     * BODY
     * --------------------------------------------------------
     */
    const body = await req.json();

    const rawItems = body?.items;

    if (!Array.isArray(rawItems)) {
      return NextResponse.json(
        {
          success: false,
          message: "items harus berupa array.",
        },
        {
          status: 400,
        }
      );
    }

    /**
     * outputQty tetap menggunakan behavior lama.
     */
    const outputQty =
      body?.outputQty === undefined ||
      body?.outputQty === null ||
      body?.outputQty === ""
        ? 1
        : Number(body.outputQty);

    if (!Number.isFinite(outputQty) || outputQty <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "outputQty harus lebih besar dari 0.",
        },
        {
          status: 400,
        }
      );
    }

    const notes =
      body?.notes === undefined || body?.notes === null
        ? null
        : String(body.notes);

    /**
     * --------------------------------------------------------
     * CLEAN ITEMS
     * --------------------------------------------------------
     *
     * PERBAIKAN UTAMA:
     *
     * Sebelumnya hanya:
     *   barangId
     *   qty
     *   unit
     *
     * Sekarang:
     *   barangId
     *   qty
     *   unit
     *   maxPrice
     *
     * maxPrice dipertahankan sampai createMany().
     */
    const cleanItems: Array<{
      barangId: number;
      qty: number;
      unit: string | null;
      maxPrice: number | null;
    }> = [];

    for (let index = 0; index < rawItems.length; index++) {
      const item = rawItems[index];

      const barangId = Number(item?.barangId);
      const qty = Number(item?.qty);

      if (!Number.isInteger(barangId) || barangId <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Barang pada item ke-${index + 1} tidak valid.`,
          },
          {
            status: 400,
          }
        );
      }

      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Qty pada item ke-${index + 1} harus lebih besar dari 0.`,
          },
          {
            status: 400,
          }
        );
      }

      let maxPrice: number | null;

      try {
        maxPrice = normalizeMaxPrice(item?.maxPrice);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Batas maksimum HPP tidak valid.";

        return NextResponse.json(
          {
            success: false,
            message: `Item ke-${index + 1}: ${message}`,
          },
          {
            status: 400,
          }
        );
      }

      const unit =
        item?.unit === undefined ||
        item?.unit === null ||
        String(item.unit).trim() === ""
          ? null
          : String(item.unit).trim();

      cleanItems.push({
        barangId,
        qty,
        unit,
        maxPrice,
      });
    }

    /**
     * --------------------------------------------------------
     * DUPLICATE BARANG CHECK
     * --------------------------------------------------------
     */
    const barangIds = cleanItems.map((item) => item.barangId);

    const duplicateBarangIds = barangIds.filter(
      (barangId, index) => barangIds.indexOf(barangId) !== index
    );

    if (duplicateBarangIds.length > 0) {
      const uniqueDuplicates = [...new Set(duplicateBarangIds)];

      return NextResponse.json(
        {
          success: false,
          message: `Barang tidak boleh muncul lebih dari satu kali dalam BOM. Duplikat: ${uniqueDuplicates.join(
            ", "
          )}`,
        },
        {
          status: 400,
        }
      );
    }

    /**
     * --------------------------------------------------------
     * GET MENU
     * --------------------------------------------------------
     */
    const menu = await prisma.menu.findUnique({
      where: {
        id: menuId,
      },
    });

    if (!menu) {
      return NextResponse.json(
        {
          success: false,
          message: "Menu tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    if (!menu.active) {
      return NextResponse.json(
        {
          success: false,
          message: "Menu sudah tidak aktif.",
        },
        {
          status: 400,
        }
      );
    }

    /**
     * --------------------------------------------------------
     * GET BARANG
     * --------------------------------------------------------
     *
     * Ambil seluruh Barang yang dipakai BOM sekaligus.
     */
    const barangList =
      cleanItems.length > 0
        ? await prisma.barang.findMany({
            where: {
              id: {
                in: barangIds,
              },
            },
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
              active: true,
            },
          })
        : [];

    /**
     * --------------------------------------------------------
     * VALIDASI BARANG
     * --------------------------------------------------------
     */
    const barangMap = new Map(
      barangList.map((barang) => [barang.id, barang])
    );

    for (const item of cleanItems) {
      const barang = barangMap.get(item.barangId);

      if (!barang) {
        return NextResponse.json(
          {
            success: false,
            message: `Barang ID ${item.barangId} tidak ditemukan.`,
          },
          {
            status: 404,
          }
        );
      }

      if (!barang.active) {
        return NextResponse.json(
          {
            success: false,
            message: `Barang "${barang.name}" sudah tidak aktif.`,
          },
          {
            status: 400,
          }
        );
      }
    }

    /**
     * --------------------------------------------------------
     * BASE UNIT HELPER
     * --------------------------------------------------------
     *
     * Mengikuti konsep existing project:
     * qty BOM disimpan dalam base unit.
     */
    function getBaseUnit(barang: {
      unit: string;
      baseUnit: string | null;
    }) {
      return barang.baseUnit || barang.unit;
    }

    function getConversionRate(barang: {
      conversionRate: number | null;
    }) {
      const rate = Number(barang.conversionRate ?? 1);

      if (!Number.isFinite(rate) || rate <= 0) {
        return 1;
      }

      return rate;
    }

    function toBaseQty(
      qty: number,
      unit: string | null,
      barang: {
        unit: string;
        baseUnit: string | null;
        conversionRate: number | null;
      }
    ) {
      const baseUnit = getBaseUnit(barang);
      const mainUnit = barang.unit;

      /**
       * Jika unit kosong -> anggap qty sudah base unit.
       */
      if (!unit) {
        return qty;
      }

      /**
       * Jika unit sama dengan base unit -> tidak perlu konversi.
       */
      if (unit === baseUnit) {
        return qty;
      }

      /**
       * Jika unit sama dengan unit utama Barang:
       * main unit -> base unit.
       */
      if (unit === mainUnit) {
        return qty * getConversionRate(barang);
      }

      /**
       * Untuk kompatibilitas dengan data lama:
       * jika unit tidak dikenal, pertahankan qty.
       */
      return qty;
    }

    /**
     * --------------------------------------------------------
     * NORMALIZE ITEMS
     * --------------------------------------------------------
     *
     * Qty disimpan dalam BASE UNIT.
     *
     * maxPrice TIDAK ikut dikalikan conversionRate.
     *
     * Karena maxPrice adalah:
     *
     *     maksimum HPP / 1 BASE UNIT
     *
     * bukan maksimum harga / main unit.
     */
    const normalizedItems = cleanItems.map((item) => {
      const barang = barangMap.get(item.barangId)!;

      const normalizedQty = toBaseQty(
        item.qty,
        item.unit,
        barang
      );

      return {
        barangId: item.barangId,
        qty: normalizedQty,
        unit: getBaseUnit(barang),

        /**
         * ====================================================
         * PERBAIKAN:
         * maxPrice dibawa sampai database.
         * ====================================================
         */
        maxPrice: item.maxPrice,
      };
    });

    /**
     * --------------------------------------------------------
     * TRANSACTION
     * --------------------------------------------------------
     *
     * Tidak ada data lama yang dihapus dari database secara
     * permanen.
     *
     * Behavior existing:
     * RecipeItem lama direplace saat BOM disimpan.
     *
     * Recipe sendiri tetap dipertahankan.
     */
    const recipe = await prisma.$transaction(
      async (tx) => {
        /**
         * ----------------------------------------------------
         * Cari Recipe berdasarkan menu
         * ----------------------------------------------------
         */
        const existingRecipe = await tx.recipe.findFirst({
          where: {
            menuId,
          },
          orderBy: {
            id: "asc",
          },
        });

        let recipeId: number;

        if (existingRecipe) {
          /**
           * --------------------------------------------------
           * UPDATE RECIPE
           * --------------------------------------------------
           */
          const updatedRecipe = await tx.recipe.update({
            where: {
              id: existingRecipe.id,
            },
            data: {
              name: menu.name,
              outputQty,
              notes,
              active: true,

              /**
               * Menu BOM tetap merupakan Recipe menu.
               * ProductCK tidak dipakai oleh route ini.
               */
              productCkId: null,
            },
          });

          recipeId = updatedRecipe.id;

          /**
           * --------------------------------------------------
           * Replace RecipeItem
           * --------------------------------------------------
           *
           * Ini mengikuti behavior existing endpoint.
           *
           * maxPrice dari item lama tidak perlu dipertahankan
           * secara terpisah karena frontend mengirim ulang
           * seluruh BOM termasuk maxPrice.
           *
           * Data Recipe / Menu / Barang tidak disentuh.
           */
          await tx.recipeItem.deleteMany({
            where: {
              recipeId,
            },
          });
        } else {
          /**
           * --------------------------------------------------
           * CREATE RECIPE
           * --------------------------------------------------
           */
          const newRecipe = await tx.recipe.create({
            data: {
              code: `MENU-${menu.id}`,
              name: menu.name,
              menuId: menu.id,
              outputQty,
              notes,
              active: true,
              productCkId: null,
            },
          });

          recipeId = newRecipe.id;
        }

        /**
         * ----------------------------------------------------
         * CREATE RECIPE ITEMS
         * ----------------------------------------------------
         *
         * PERBAIKAN UTAMA:
         *
         * maxPrice sekarang benar-benar ditulis ke DB.
         */
        if (normalizedItems.length > 0) {
          await tx.recipeItem.createMany({
            data: normalizedItems.map((item) => ({
              recipeId,
              barangId: item.barangId,
              qty: item.qty,
              unit: item.unit,

              /**
               * ==================================================
               * INI YANG SEBELUMNYA HILANG.
               * Sekarang tersimpan permanen.
               * ==================================================
               */
              maxPrice: item.maxPrice,
            })),
          });
        }

        /**
         * ----------------------------------------------------
         * RETURN RECIPE
         * ----------------------------------------------------
         */
        return tx.recipe.findUnique({
          where: {
            id: recipeId,
          },
          include: {
            menu: true,
            productCk: true,
            outputBarang: true,
            items: {
              include: {
                barang: true,
              },
              orderBy: {
                id: "asc",
              },
            },
          },
        });
      },
      {
        /**
         * Menggunakan timeout yang cukup untuk transaksi BOM.
         */
        timeout: 15000,
      }
    );

    if (!recipe) {
      return NextResponse.json(
        {
          success: false,
          message: "Recipe gagal dibuat atau diperbarui.",
        },
        {
          status: 500,
        }
      );
    }

    /**
     * --------------------------------------------------------
     * RESPONSE
     * --------------------------------------------------------
     *
     * Karena include RecipeItem mengambil seluruh kolom,
     * maxPrice otomatis ikut dikembalikan oleh Prisma.
     */
    return NextResponse.json(
      {
        success: true,
        message: "BOM menu berhasil disimpan.",
        recipe,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("PUT /api/menu-bom/[id] error:", error);

    /**
     * Prisma known error.
     */
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        {
          success: false,
          message: "Terjadi kesalahan database saat menyimpan BOM.",
          code: error.code,
        },
        {
          status: 500,
        }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan saat menyimpan BOM.",
      },
      {
        status: 500,
      }
    );
  }
}

/**
 * ------------------------------------------------------------
 * DELETE
 * ------------------------------------------------------------
 *
 * Tidak menghapus Recipe secara fisik.
 * Recipe hanya dinonaktifkan.
 *
 * Ini dipertahankan agar data lama tetap aman.
 * ------------------------------------------------------------
 */

export async function DELETE(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    /**
     * --------------------------------------------------------
     * AUTH
     * --------------------------------------------------------
     */
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    if (!canManageBom(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message: "Anda tidak memiliki akses untuk menghapus BOM.",
        },
        {
          status: 403,
        }
      );
    }

    /**
     * --------------------------------------------------------
     * PARAMS
     * --------------------------------------------------------
     */
    const { id } = await params;

    const menuId = Number(id);

    if (!Number.isInteger(menuId) || menuId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "ID menu tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    /**
     * --------------------------------------------------------
     * FIND RECIPE
     * --------------------------------------------------------
     */
    const recipe = await prisma.recipe.findFirst({
      where: {
        menuId,
      },
    });

    if (!recipe) {
      return NextResponse.json(
        {
          success: false,
          message: "BOM menu tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    /**
     * --------------------------------------------------------
     * SOFT DELETE
     * --------------------------------------------------------
     *
     * Jangan delete Recipe secara fisik.
     * Jangan delete Barang.
     * Jangan delete Menu.
     * Jangan ubah stock.
     */
    const updatedRecipe = await prisma.recipe.update({
      where: {
        id: recipe.id,
      },
      data: {
        active: false,
      },
      include: {
        menu: true,
        productCk: true,
        outputBarang: true,
        items: {
          include: {
            barang: true,
          },
          orderBy: {
            id: "asc",
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "BOM menu berhasil dinonaktifkan.",
        recipe: updatedRecipe,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("DELETE /api/menu-bom/[id] error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        {
          success: false,
          message: "Terjadi kesalahan database saat menonaktifkan BOM.",
          code: error.code,
        },
        {
          status: 500,
        }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan saat menonaktifkan BOM.",
      },
      {
        status: 500,
      }
    );
  }
}