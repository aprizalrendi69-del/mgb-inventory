import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

type SessionUser = {
  id: number;
  role: string;
  outletId: number | null;
  name?: string | null;
  email?: string | null;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeMaxPrice(value: unknown): number | null {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error("Batas maksimum HPP tidak valid.");
  }

  if (numberValue <= 0) {
    throw new Error(
      "Batas maksimum HPP harus lebih besar dari 0. Kosongkan jika tidak ada batas."
    );
  }

  return roundMoney(numberValue);
}

/**
 * Ambil user dari session.
 *
 * Mendukung:
 * - erp-session
 * - session
 * - DB Session
 * - legacy JSON session
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
     * Primary session: database
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
          name: session.user.fullname ?? null,
          email: null,
        };
      }
    } catch {
      // Lanjut legacy session.
    }

    /**
     * Legacy JSON session
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
          name:
            parsed.user.name ??
            parsed.user.fullname ??
            null,
          email: parsed.user.email ?? null,
        };
      }

      if (parsed?.id && parsed?.role) {
        return {
          id: Number(parsed.id),
          role: String(parsed.role),
          outletId:
            parsed.outletId !== undefined &&
            parsed.outletId !== null
              ? Number(parsed.outletId)
              : null,
          name:
            parsed.name ??
            parsed.fullname ??
            null,
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

function canManageBom(role: string) {
  return ["ADMIN", "MANAGER", "GUDANG"].includes(role);
}

/**
 * GET
 *
 * Mengambil BOM berdasarkan Menu ID.
 */
export async function GET(
  _req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
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
          message: "Anda tidak memiliki akses untuk melihat BOM.",
        },
        {
          status: 403,
        }
      );
    }

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

    const menu = await prisma.menu.findUnique({
      where: {
        id: menuId,
      },
      include: {
        recipes: {
          where: {
            active: true,
          },
          orderBy: {
            id: "asc",
          },
          include: {
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
        },
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

    const recipe = menu.recipes[0] ?? null;

    return NextResponse.json({
      success: true,
      menu,
      recipe,
      items: recipe?.items ?? [],
    });
  } catch (error) {
    console.error("GET /api/menu-bom/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil BOM menu.",
      },
      {
        status: 500,
      }
    );
  }
}

/**
 * PUT
 *
 * Create / update BOM Menu.
 *
 * Payload:
 *
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
 * maxPrice = batas maksimum HPP per BASE UNIT.
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
          message:
            "Anda tidak memiliki hak untuk mengelola BOM.",
        },
        {
          status: 403,
        }
      );
    }

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

    const body = await req.json();

    const rawItems = Array.isArray(body?.items)
      ? body.items
      : [];

    if (rawItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Minimal satu bahan harus ada di dalam BOM.",
        },
        {
          status: 400,
        }
      );
    }

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

    /**
     * Output quantity.
     *
     * Default 1.
     */
    let outputQty = Number(body?.outputQty ?? 1);

    if (!Number.isFinite(outputQty) || outputQty <= 0) {
      outputQty = 1;
    }

    const notes =
      body?.notes === undefined
        ? null
        : body.notes === null
          ? null
          : String(body.notes);

    /**
     * Ambil seluruh Barang yang dikirim.
     */
    const barangIds = [
      ...new Set(
        rawItems
          .map((item: any) => Number(item?.barangId))
          .filter(
            (id: number) =>
              Number.isInteger(id) && id > 0
          )
      ),
    ];

    if (barangIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Bahan BOM tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    const barangs = await prisma.barang.findMany({
      where: {
        id: {
          in: barangIds,
        },
      },
    });

    const barangMap = new Map(
      barangs.map((barang) => [
        barang.id,
        barang,
      ])
    );

    /**
     * Normalisasi item.
     *
     * qty disimpan dalam BASE UNIT.
     *
     * maxPrice tidak dikonversi karena
     * merupakan batas HPP per base unit.
     */
    const normalizedItems: Array<{
      barangId: number;
      qty: number;
      unit: string | null;
      maxPrice: number | null;
    }> = [];

    for (const rawItem of rawItems) {
      const barangId = Number(rawItem?.barangId);

      if (
        !Number.isInteger(barangId) ||
        barangId <= 0
      ) {
        continue;
      }

      const barang = barangMap.get(barangId);

      if (!barang) {
        throw new Error(
          `Barang dengan ID ${barangId} tidak ditemukan.`
        );
      }

      if (!barang.active) {
        throw new Error(
          `Barang "${barang.name}" sudah tidak aktif.`
        );
      }

      let qty = Number(rawItem?.qty ?? 0);

      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error(
          `Qty bahan "${barang.name}" harus lebih besar dari 0.`
        );
      }

      const unit =
        String(
          rawItem?.unit ??
            barang.baseUnit ??
            barang.unit ??
            ""
        ).trim() || null;

      /**
       * Konversi ke BASE UNIT.
       *
       * Jika unit yang dikirim adalah unit utama
       * dan Barang memiliki conversionRate,
       * qty dikalikan conversionRate.
       *
       * Jika unit sudah baseUnit, qty tidak dikali.
       */
      const baseUnit =
        String(
          barang.baseUnit ??
            barang.unit ??
            ""
        )
          .trim()
          .toLowerCase();

      const selectedUnit =
        String(unit ?? "")
          .trim()
          .toLowerCase();

      const conversionRate =
        Number(barang.conversionRate);

      const safeConversionRate =
        Number.isFinite(conversionRate) &&
        conversionRate > 0
          ? conversionRate
          : 1;

      const isAlreadyBaseUnit =
        selectedUnit !== "" &&
        baseUnit !== "" &&
        selectedUnit === baseUnit;

      if (!isAlreadyBaseUnit) {
        qty *= safeConversionRate;
      }

      qty = Math.round(
        (qty + Number.EPSILON) * 1000000
      ) / 1000000;

      const maxPrice = normalizeMaxPrice(
        rawItem?.maxPrice
      );

      normalizedItems.push({
        barangId,
        qty,
        unit:
          barang.baseUnit ??
          barang.unit ??
          unit,
        maxPrice,
      });
    }

    if (normalizedItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak ada bahan BOM yang valid.",
        },
        {
          status: 400,
        }
      );
    }

    /**
     * Gabungkan barang yang sama.
     *
     * Jika bahan yang sama muncul lebih dari satu kali,
     * qty dijumlahkan.
     *
     * maxPrice menggunakan nilai yang dikirim
     * pada baris terakhir yang mempunyai nilai.
     */
    const mergedMap = new Map<
      number,
      {
        barangId: number;
        qty: number;
        unit: string | null;
        maxPrice: number | null;
      }
    >();

    for (const item of normalizedItems) {
      const existing = mergedMap.get(
        item.barangId
      );

      if (!existing) {
        mergedMap.set(item.barangId, {
          ...item,
        });
      } else {
        existing.qty += item.qty;

        if (item.maxPrice !== null) {
          existing.maxPrice =
            item.maxPrice;
        }
      }
    }

    const finalItems = Array.from(
      mergedMap.values()
    ).map((item) => ({
      ...item,
      qty:
        Math.round(
          (item.qty + Number.EPSILON) * 1000000
        ) / 1000000,
    }));

    /**
     * Simpan dalam satu transaction.
     *
     * Menu / Barang tidak dihapus.
     *
     * Recipe lama dipakai jika sudah ada.
     */
    const recipe = await prisma.$transaction(
      async (tx) => {
        const existingRecipe =
          await tx.recipe.findFirst({
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
           * UPDATE RECIPE
           */
          const updatedRecipe =
            await tx.recipe.update({
              where: {
                id: existingRecipe.id,
              },
              data: {
                name: menu.name,
                outputQty,
                notes,
                active: true,

                /**
                 * Menu BOM adalah Recipe Menu.
                 * ProductCK tidak digunakan di route ini.
                 */
                productCkId: null,
              },
            });

          recipeId =
            updatedRecipe.id;

          /**
           * Ganti isi RecipeItem.
           *
           * Recipe/Menu/Barang tidak dihapus.
           * Yang diperbarui hanya isi BOM.
           */
          await tx.recipeItem.deleteMany({
            where: {
              recipeId,
            },
          });
        } else {
          /**
           * CREATE RECIPE
           */
          const newRecipe =
            await tx.recipe.create({
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
         * CREATE RECIPE ITEMS
         *
         * maxPrice ditulis langsung ke database.
         */
        await tx.recipeItem.createMany({
          data: finalItems.map(
            (item) => ({
              recipeId,
              barangId:
                item.barangId,
              qty: item.qty,
              unit: item.unit,
              maxPrice:
                item.maxPrice,
            })
          ),
        });

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
        timeout: 15000,
      }
    );

    if (!recipe) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Recipe gagal dibuat atau diperbarui.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "BOM menu berhasil disimpan.",
        recipe,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "PUT /api/menu-bom/[id] error:",
      error
    );

    if (
      error instanceof
      Prisma.PrismaClientKnownRequestError
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Terjadi kesalahan database saat menyimpan BOM.",
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
        message:
          "Terjadi kesalahan saat menyimpan BOM.",
      },
      {
        status: 500,
      }
    );
  }
}

/**
 * DELETE
 *
 * Tidak menghapus Recipe secara fisik.
 * Recipe hanya dinonaktifkan.
 */
export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
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
          message:
            "Anda tidak memiliki hak untuk menghapus BOM.",
        },
        {
          status: 403,
        }
      );
    }

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

    const result =
      await prisma.recipe.updateMany({
        where: {
          menuId,
          active: true,
        },
        data: {
          active: false,
        },
      });

    return NextResponse.json({
      success: true,
      message:
        result.count > 0
          ? "BOM menu berhasil dinonaktifkan."
          : "BOM menu tidak ditemukan.",
      count: result.count,
    });
  } catch (error) {
    console.error(
      "DELETE /api/menu-bom/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal menonaktifkan BOM menu.",
      },
      {
        status: 500,
      }
    );
  }
}