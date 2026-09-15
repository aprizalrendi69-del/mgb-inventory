import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/*
===========================================================
MANUFACTURE RECIPE / BOM API
===========================================================

FLOW:

GET
- Admin / Manager / Gudang:
  - tanpa outletId = semua outlet
  - dengan outletId = outlet tertentu
- Outlet Admin:
  - selalu outlet miliknya

POST
- Membuat Recipe/BOM Manufacture Outlet
- Wajib memiliki outlet
- Tidak mengubah stock

PUT / PATCH
- Update Recipe/BOM
- Tidak mengubah stock
- ID dapat berasal dari:
  1. URL pathname
  2. ?id=
  3. body.id
- outletId dapat berasal dari:
  1. body.outletId
  2. ?outletId=
  3. outletId recipe lama
  4. user.outletId
- Outlet Admin selalu dipaksa ke outlet miliknya

DELETE
- Hapus Recipe hanya jika belum dipakai Manufacture Order
===========================================================
*/

const ALLOWED_ROLES = [
  "ADMIN",
  "MANAGER",
  "GUDANG",
  "OUTLET_ADMIN",
] as const;

type RecipeItemInput = {
  itemType?: string;
  barangId?: number | string | null;
  name?: string | null;
  qty?: number | string | null;
  unit?: string | null;
};

type RecipeBody = {
  id?: number | string | null;

  outletId?: number | string | null;

  code?: string | null;
  name?: string | null;

  menuId?: number | string | null;

  productCkId?: number | string | null;

  outputBarangId?: number | string | null;

  outputQty?: number | string | null;

  notes?: string | null;

  active?: boolean;

  items?: RecipeItemInput[];
};

/*
===========================================================
RESPONSE HELPER
===========================================================
*/

function fail(
  message: string,
  status = 400,
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
    },
  );
}

/*
===========================================================
TYPE CONVERTER
===========================================================
*/

function toInt(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const n = Number(value);

  if (!Number.isInteger(n)) {
    return null;
  }

  return n;
}

function toFloat(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const n = Number(value);

  if (!Number.isFinite(n)) {
    return null;
  }

  return n;
}

function cleanString(
  value: unknown,
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const result =
    String(value).trim();

  return result || null;
}

/*
===========================================================
AUTHENTICATION
===========================================================
*/

async function getUser() {
  const cookieStore =
    await cookies();

  const sessionCookie =
    cookieStore.get("erp-session") ||
    cookieStore.get("session");

  if (!sessionCookie) {
    return null;
  }

  let userId = 0;

  /*
   * -------------------------------------------------------
   * SESSION TABLE
   * -------------------------------------------------------
   */

  try {
    const session =
      await prisma.session.findUnique({
        where: {
          token:
            sessionCookie.value,
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
      session &&
      session.expiresAt >
        new Date()
    ) {
      userId =
        session.user.id;
    }
  } catch {
    /*
     * Fallback ke format
     * session lama.
     */
  }

  /*
   * -------------------------------------------------------
   * LEGACY JSON SESSION
   * -------------------------------------------------------
   */

  if (!userId) {
    try {
      const parsed =
        JSON.parse(
          sessionCookie.value,
        );

      userId = Number(
        parsed?.user?.id ??
          parsed?.id ??
          0,
      );
    } catch {
      // ignore
    }
  }

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      username: true,
      fullname: true,
      role: true,
      outletId: true,
      active: true,
    },
  });
}

/*
===========================================================
ROLE
===========================================================
*/

function canAccessManufacture(
  role: unknown,
) {
  return ALLOWED_ROLES.includes(
    String(role).toUpperCase() as any,
  );
}

/*
===========================================================
OUTLET VALIDATION
===========================================================
*/

async function validateOutlet(
  outletId: number,
) {
  if (
    !Number.isInteger(outletId) ||
    outletId <= 0
  ) {
    throw new Error(
      "Outlet ID tidak valid.",
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
    throw new Error(
      "Outlet tidak ditemukan.",
    );
  }

  if (!outlet.active) {
    throw new Error(
      "Outlet tidak aktif.",
    );
  }

  return outlet;
}

/*
===========================================================
RESOLVE OUTLET CREATE
===========================================================
*/

async function resolveOutletId(
  user: {
    id: number;
    role: any;
    outletId: number | null;
  },
  requestedOutletId?: unknown,
) {
  const role =
    String(user.role).toUpperCase();

  /*
   * -------------------------------------------------------
   * OUTLET ADMIN
   * -------------------------------------------------------
   *
   * Tidak boleh memilih outlet lain.
   */

  if (
    role === "OUTLET_ADMIN"
  ) {
    if (!user.outletId) {
      throw new Error(
        "User Outlet Admin belum memiliki outlet.",
      );
    }

    const outlet =
      await validateOutlet(
        user.outletId,
      );

    return outlet.id;
  }

  /*
   * -------------------------------------------------------
   * ADMIN / MANAGER / GUDANG
   * -------------------------------------------------------
   */

  const outletId =
    toInt(requestedOutletId);

  /*
   * Penting:
   * untuk CREATE outlet memang wajib.
   */

  if (
    !outletId ||
    outletId <= 0
  ) {
    /*
     * Bila user pusat juga memiliki
     * outletId, boleh dipakai sebagai
     * fallback.
     *
     * Ini membantu frontend lama
     * yang belum mengirim outletId.
     */

    if (user.outletId) {
      const outlet =
        await validateOutlet(
          user.outletId,
        );

      return outlet.id;
    }

    throw new Error(
      "Outlet wajib dipilih.",
    );
  }

  const outlet =
    await validateOutlet(
      outletId,
    );

  return outlet.id;
}

/*
===========================================================
RESOLVE OUTLET GET
===========================================================
*/

async function resolveGetOutletFilter(
  user: {
    id: number;
    role: any;
    outletId: number | null;
  },
  requestedOutletId?: unknown,
) {
  const role =
    String(user.role).toUpperCase();

  /*
   * Outlet Admin:
   * selalu outlet sendiri.
   */

  if (
    role === "OUTLET_ADMIN"
  ) {
    if (!user.outletId) {
      throw new Error(
        "User Outlet Admin belum memiliki outlet.",
      );
    }

    const outlet =
      await validateOutlet(
        user.outletId,
      );

    return outlet.id;
  }

  /*
   * Tidak ada filter:
   * pusat melihat semua outlet.
   */

  if (
    requestedOutletId ===
      undefined ||
    requestedOutletId ===
      null ||
    requestedOutletId === ""
  ) {
    return undefined;
  }

  const outletId =
    toInt(requestedOutletId);

  if (
    !outletId ||
    outletId <= 0
  ) {
    throw new Error(
      "Outlet ID tidak valid.",
    );
  }

  const outlet =
    await validateOutlet(
      outletId,
    );

  return outlet.id;
}

/*
===========================================================
GET RECIPE ID DARI REQUEST
===========================================================
*/

function getRecipeIdFromRequest(
  req: NextRequest,
  body?: RecipeBody | null,
) {
  /*
   * URL pathname:
   *
   * /api/manufacture/recipes/1
   */

  const pathname =
    new URL(req.url)
      .pathname;

  const segments =
    pathname
      .split("/")
      .filter(Boolean);

  const recipesIndex =
    segments.lastIndexOf(
      "recipes",
    );

  if (
    recipesIndex >= 0 &&
    segments[
      recipesIndex + 1
    ]
  ) {
    const pathnameId =
      toInt(
        segments[
          recipesIndex + 1
        ],
      );

    if (pathnameId) {
      return pathnameId;
    }
  }

  /*
   * Query:
   *
   * ?id=1
   */

  const { searchParams } =
    new URL(req.url);

  const queryId =
    toInt(
      searchParams.get("id"),
    );

  if (queryId) {
    return queryId;
  }

  /*
   * Body:
   *
   * { id: 1 }
   */

  const bodyId =
    toInt(body?.id);

  if (bodyId) {
    return bodyId;
  }

  return null;
}

/*
===========================================================
FORMAT BARANG
===========================================================
*/

function formatRecipeItem(
  item: any,
) {
  const barang =
    item.barang;

  if (!barang) {
    return item;
  }

  const unit =
    barang.unit ??
    item.unit ??
    "";

  const baseUnit =
    barang.baseUnit ??
    unit;

  const conversionRate =
    Number(
      barang.conversionRate ??
        1,
    );

  const hasConversion =
    Boolean(
      unit &&
        baseUnit &&
        unit !== baseUnit &&
        conversionRate > 1,
    );

  return {
    ...item,

    barang: {
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
    },
  };
}

/*
===========================================================
FORMAT RECIPE
===========================================================
*/

async function formatRecipe(
  recipe: any,
) {
  let outlet = null;

  if (recipe.outletId) {
    outlet =
      await prisma.outlet.findUnique({
        where: {
          id: Number(
            recipe.outletId,
          ),
        },

        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },
      });
  }

  return {
    ...recipe,

    outlet,

    outletId:
      recipe.outletId,

    items:
      Array.isArray(
        recipe.items,
      )
        ? recipe.items.map(
            formatRecipeItem,
          )
        : [],
  };
}

/*
===========================================================
GET
===========================================================
*/

export async function GET(
  req: NextRequest,
) {
  try {
    const user =
      await getUser();

    if (
      !user ||
      !user.active
    ) {
      return fail(
        "Tidak login.",
        401,
      );
    }

    const role =
      String(user.role).toUpperCase();

    if (
      !canAccessManufacture(role)
    ) {
      return fail(
        "Tidak memiliki akses.",
        403,
      );
    }

    const { searchParams } =
      new URL(req.url);

    const requestedOutletId =
      searchParams.get(
        "outletId",
      );

    const search =
      searchParams
        .get("search")
        ?.trim() || "";

    const activeParam =
      searchParams.get(
        "active",
      );

    const outletId =
      await resolveGetOutletFilter(
        user,
        requestedOutletId,
      );

    /*
     * Manufacture Outlet:
     * menuId harus null.
     */

    const where: any = {
      menuId: null,
    };

    if (
      outletId !== undefined
    ) {
      where.outletId =
        outletId;
    }

    if (
      activeParam === "true"
    ) {
      where.active = true;
    }

    if (
      activeParam === "false"
    ) {
      where.active = false;
    }

    if (search) {
      where.OR = [
        {
          code: {
            contains: search,
          },
        },

        {
          name: {
            contains: search,
          },
        },

        {
          productCk: {
            name: {
              contains: search,
            },
          },
        },

        {
          outputBarang: {
            name: {
              contains: search,
            },
          },
        },
      ];
    }

    const recipes =
      await prisma.recipe.findMany({
        where,

        orderBy: {
          id: "desc",
        },

        include: {
          productCk: {
            include: {
              outputBarang: true,
            },
          },

          outputBarang: true,

          items: {
            include: {
              barang: true,
            },

            orderBy: {
              id: "asc",
            },
          },

          orders: {
            orderBy: {
              id: "desc",
            },

            take: 10,
          },
        },
      });

    const formattedRecipes =
      await Promise.all(
        recipes.map(
          formatRecipe,
        ),
      );

    return NextResponse.json({
      success: true,

      scope: {
        role,

        outletId:
          role ===
          "OUTLET_ADMIN"
            ? user.outletId
            : outletId ?? null,

        allOutlets:
          role !==
            "OUTLET_ADMIN" &&
          outletId ===
            undefined,
      },

      total:
        formattedRecipes.length,

      data:
        formattedRecipes,
    });
  } catch (error: any) {
    console.error(
      "GET /api/manufacture/recipes:",
      error,
    );

    return fail(
      error?.message ||
        "Gagal mengambil Recipe/BOM Outlet.",
      500,
    );
  }
}

/*
===========================================================
POST
===========================================================
*/

export async function POST(
  req: NextRequest,
) {
  try {
    const user =
      await getUser();

    if (
      !user ||
      !user.active
    ) {
      return fail(
        "Tidak login.",
        401,
      );
    }

    const role =
      String(user.role).toUpperCase();

    if (
      !canAccessManufacture(role)
    ) {
      return fail(
        "Tidak memiliki akses.",
        403,
      );
    }

    let body: RecipeBody;

    try {
      body =
        (await req.json()) as RecipeBody;
    } catch {
      return fail(
        "Body request tidak valid.",
      );
    }

    /*
     * -------------------------------------------------------
     * OUTLET
     * -------------------------------------------------------
     */

    const outletId =
      await resolveOutletId(
        user,
        body.outletId,
      );

    /*
     * -------------------------------------------------------
     * BASIC
     * -------------------------------------------------------
     */

    const code =
      cleanString(body.code);

    const name =
      cleanString(body.name);

    if (!code) {
      return fail(
        "Code Recipe/BOM wajib diisi.",
      );
    }

    if (!name) {
      return fail(
        "Nama Recipe/BOM wajib diisi.",
      );
    }

    /*
     * Manufacture Outlet tidak boleh
     * memakai Menu POS.
     */

    if (
      body.menuId !==
        undefined &&
      body.menuId !==
        null &&
      body.menuId !== ""
    ) {
      return fail(
        "BOM Manufacture Outlet tidak boleh menggunakan Menu POS.",
      );
    }

    /*
     * -------------------------------------------------------
     * PRODUCT CK
     * -------------------------------------------------------
     */

    const productCkId =
      toInt(
        body.productCkId,
      );

    const requestedOutputBarangId =
      toInt(
        body.outputBarangId,
      );

    const outputQty =
      toFloat(
        body.outputQty,
      );

    if (
      outputQty === null ||
      outputQty <= 0
    ) {
      return fail(
        "Qty output harus lebih dari 0.",
      );
    }

    let finalOutputBarangId =
      requestedOutputBarangId;

    if (
      productCkId !== null
    ) {
      const productCk =
        await prisma.productCK.findUnique({
          where: {
            id: productCkId,
          },

          select: {
            id: true,
            name: true,
            outputBarangId: true,
            active: true,
          },
        });

      if (!productCk) {
        return fail(
          "Product CK tidak ditemukan.",
        );
      }

      if (!productCk.active) {
        return fail(
          "Product CK tidak aktif.",
        );
      }

      if (
        finalOutputBarangId ===
        null
      ) {
        finalOutputBarangId =
          productCk.outputBarangId;
      }
    }

    if (
      finalOutputBarangId ===
      null
    ) {
      return fail(
        "Output barang wajib dipilih.",
      );
    }

    /*
     * -------------------------------------------------------
     * OUTPUT BARANG
     * -------------------------------------------------------
     */

    const outputBarang =
      await prisma.barang.findUnique({
        where: {
          id:
            finalOutputBarangId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          baseUnit: true,
          conversionRate: true,
          active: true,
        },
      });

    if (!outputBarang) {
      return fail(
        "Barang output tidak ditemukan.",
      );
    }

    if (!outputBarang.active) {
      return fail(
        "Barang output tidak aktif.",
      );
    }

    /*
     * -------------------------------------------------------
     * ITEMS
     * -------------------------------------------------------
     */

    const rawItems =
      Array.isArray(body.items)
        ? body.items
        : [];

    if (!rawItems.length) {
      return fail(
        "Minimal harus ada 1 bahan Recipe.",
      );
    }

    let recipeItems:
      {
        barangId: number;
        qty: number;
        unit: string | null;
      }[];

    try {
      recipeItems =
        rawItems.map(
          (item, index) => {
            const barangId =
              toInt(
                item.barangId,
              );

            const qty =
              toFloat(
                item.qty,
              );

            const unit =
              cleanString(
                item.unit,
              );

            if (
              barangId === null
            ) {
              throw new Error(
                `Barang pada item ke-${index + 1} tidak valid.`,
              );
            }

            if (
              qty === null ||
              qty <= 0
            ) {
              throw new Error(
                `Qty pada item ke-${index + 1} harus lebih dari 0.`,
              );
            }

            return {
              barangId,
              qty,
              unit,
            };
          },
        );
    } catch (error: any) {
      return fail(
        error?.message ||
          "Item Recipe tidak valid.",
      );
    }

    const barangIds = [
      ...new Set(
        recipeItems.map(
          (item) =>
            item.barangId,
        ),
      ),
    ];

    const existingBarangs =
      await prisma.barang.findMany({
        where: {
          id: {
            in: barangIds,
          },
        },

        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          baseUnit: true,
          conversionRate: true,
          active: true,
        },
      });

    const existingIds =
      new Set(
        existingBarangs.map(
          (item) => item.id,
        ),
      );

    const missing =
      barangIds.filter(
        (id) =>
          !existingIds.has(id),
      );

    if (missing.length) {
      return fail(
        `Ada barang bahan yang tidak ditemukan: ${missing.join(
          ", ",
        )}`,
      );
    }

    const inactive =
      existingBarangs.filter(
        (item) =>
          !item.active,
      );

    if (inactive.length) {
      return fail(
        `Ada bahan yang tidak aktif: ${inactive
          .map(
            (item) =>
              item.name,
          )
          .join(", ")}`,
      );
    }

    /*
     * -------------------------------------------------------
     * DUPLICATE CODE
     * -------------------------------------------------------
     */

    const duplicate =
      await prisma.recipe.findUnique({
        where: {
          code,
        },

        select: {
          id: true,
        },
      });

    if (duplicate) {
      return fail(
        `Code Recipe/BOM "${code}" sudah digunakan.`,
      );
    }

    /*
     * -------------------------------------------------------
     * CREATE
     * -------------------------------------------------------
     */

    const recipe =
      await prisma.recipe.create({
        data: {
          code,

          name,

          outletId,

          menuId: null,

          productCkId:
            productCkId !== null
              ? productCkId
              : null,

          outputBarangId:
            finalOutputBarangId,

          outputQty,

          notes:
            cleanString(
              body.notes,
            ),

          active:
            typeof body.active ===
            "boolean"
              ? body.active
              : true,

          items: {
            create:
              recipeItems.map(
                (item) => ({
                  barangId:
                    item.barangId,

                  qty:
                    item.qty,

                  unit:
                    item.unit,
                }),
              ),
          },
        },

        include: {
          productCk: {
            include: {
              outputBarang: true,
            },
          },

          outputBarang: true,

          items: {
            include: {
              barang: true,
            },

            orderBy: {
              id: "asc",
            },
          },

          orders: true,
        },
      });

    const formatted =
      await formatRecipe(
        recipe,
      );

    return NextResponse.json(
      {
        success: true,

        message:
          "Recipe/BOM Outlet berhasil dibuat.",

        data: formatted,
      },
      {
        status: 201,
      },
    );
  } catch (error: any) {
    console.error(
      "POST /api/manufacture/recipes:",
      error,
    );

    if (
      error?.code ===
      "P2002"
    ) {
      return fail(
        "Code Recipe/BOM sudah digunakan.",
      );
    }

    if (
      error?.code ===
      "P2003"
    ) {
      return fail(
        "Relasi Outlet/Barang/Product CK tidak valid.",
      );
    }

    /*
     * Error validasi bisnis
     * harus 400, bukan 500.
     */

    const message =
      error?.message ||
      "Gagal membuat Recipe/BOM Outlet.";

    if (
      message.includes(
        "Outlet",
      ) ||
      message.includes(
        "Barang",
      ) ||
      message.includes(
        "Product CK",
      ) ||
      message.includes(
        "Qty",
      )
    ) {
      return fail(
        message,
        400,
      );
    }

    return fail(
      message,
      500,
    );
  }
}

/*
===========================================================
PUT
===========================================================
*/

export async function PUT(
  req: NextRequest,
) {
  try {
    const user =
      await getUser();

    if (
      !user ||
      !user.active
    ) {
      return fail(
        "Tidak login.",
        401,
      );
    }

    const role =
      String(user.role).toUpperCase();

    if (
      !canAccessManufacture(role)
    ) {
      return fail(
        "Tidak memiliki akses.",
        403,
      );
    }

    /*
     * -------------------------------------------------------
     * BODY
     * -------------------------------------------------------
     */

    let body: RecipeBody;

    try {
      body =
        (await req.json()) as RecipeBody;
    } catch {
      /*
       * Beberapa frontend bisa
       * mengirim body kosong.
       */

      body = {};
    }

    /*
     * -------------------------------------------------------
     * ID
     * -------------------------------------------------------
     *
     * Support:
     *
     * /recipes/1
     * /recipes/1?id=1
     * body { id: 1 }
     * -------------------------------------------------------
     */

    const id =
      getRecipeIdFromRequest(
        req,
        body,
      );

    console.log(
      "PUT Recipe ID:",
      id,
      "URL:",
      req.url,
    );

    if (!id) {
      return fail(
        "ID Recipe wajib diisi.",
      );
    }

    /*
     * -------------------------------------------------------
     * EXISTING
     * -------------------------------------------------------
     */

    const existing =
      await prisma.recipe.findUnique({
        where: {
          id,
        },

        include: {
          items: true,

          orders: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

    if (!existing) {
      return fail(
        "Recipe/BOM tidak ditemukan.",
        404,
      );
    }

    /*
     * -------------------------------------------------------
     * MENU POS PROTECTION
     * -------------------------------------------------------
     */

    if (
      body.menuId !==
        undefined &&
      body.menuId !==
        null &&
      body.menuId !== ""
    ) {
      return fail(
        "BOM Manufacture Outlet tidak boleh menggunakan Menu POS.",
      );
    }

    /*
     * -------------------------------------------------------
     * OUTLET
     * -------------------------------------------------------
     *
     * INI BAGIAN UTAMA PERBAIKAN.
     *
     * Prioritas:
     *
     * 1. body.outletId
     * 2. query ?outletId=
     * 3. existing.outletId
     * 4. user.outletId
     *
     * Dengan demikian frontend lama
     * yang hanya mengirim:
     *
     * PUT /recipes/1?id=1
     *
     * tidak langsung gagal hanya karena
     * body tidak membawa outletId.
     * -------------------------------------------------------
     */

    const { searchParams } =
      new URL(req.url);

    const requestedOutletId =
      body.outletId ??
      searchParams.get(
        "outletId",
      ) ??
      existing.outletId ??
      user.outletId;

    let outletId: number;

    try {
      outletId =
        await resolveOutletId(
          user,
          requestedOutletId,
        );
    } catch (error: any) {
      return fail(
        error?.message ||
          "Outlet wajib dipilih.",
        400,
      );
    }

    /*
     * -------------------------------------------------------
     * OUTLET OWNERSHIP
     * -------------------------------------------------------
     */

    /*
     * Bila recipe lama belum memiliki
     * outletId, sekarang akan diberikan
     * ke outlet hasil resolve.
     *
     * Bila sudah memiliki outlet,
     * tidak boleh dipindahkan sembarangan.
     */

    if (
      existing.outletId &&
      outletId !==
        existing.outletId
    ) {
      return fail(
        "Recipe bukan milik outlet tersebut.",
        403,
      );
    }

    /*
     * -------------------------------------------------------
     * BASIC DATA
     * -------------------------------------------------------
     */

    const code =
      body.code !==
      undefined
        ? cleanString(
            body.code,
          )
        : existing.code;

    const name =
      body.name !==
      undefined
        ? cleanString(
            body.name,
          )
        : existing.name;

    if (!code) {
      return fail(
        "Code Recipe/BOM wajib diisi.",
      );
    }

    if (!name) {
      return fail(
        "Nama Recipe/BOM wajib diisi.",
      );
    }

    /*
     * -------------------------------------------------------
     * DUPLICATE CODE
     * -------------------------------------------------------
     */

    if (
      code !==
      existing.code
    ) {
      const duplicate =
        await prisma.recipe.findFirst({
          where: {
            code,

            NOT: {
              id,
            },
          },

          select: {
            id: true,
            code: true,
          },
        });

      if (duplicate) {
        return fail(
          `Code Recipe/BOM "${code}" sudah digunakan.`,
        );
      }
    }

    /*
     * -------------------------------------------------------
     * OUTPUT BARANG
     * -------------------------------------------------------
     */

    let finalOutputBarangId =
      existing.outputBarangId;

    if (
      body.outputBarangId !==
      undefined
    ) {
      const parsed =
        toInt(
          body.outputBarangId,
        );

      /*
       * Jangan menerima 0
       * sebagai output barang.
       */

      if (
        parsed === null ||
        parsed <= 0
      ) {
        return fail(
          "Output barang tidak valid.",
        );
      }

      finalOutputBarangId =
        parsed;
    }

    /*
     * -------------------------------------------------------
     * OUTPUT QTY
     * -------------------------------------------------------
     */

    let finalOutputQty =
      Number(
        existing.outputQty,
      );

    if (
      body.outputQty !==
      undefined
    ) {
      const parsed =
        toFloat(
          body.outputQty,
        );

      if (
        parsed === null ||
        parsed <= 0
      ) {
        return fail(
          "Qty output harus lebih dari 0.",
        );
      }

      finalOutputQty =
        parsed;
    }

    if (
      !Number.isFinite(
        finalOutputQty,
      ) ||
      finalOutputQty <= 0
    ) {
      return fail(
        "Qty output harus lebih dari 0.",
      );
    }

    /*
     * -------------------------------------------------------
     * PRODUCT CK
     * -------------------------------------------------------
     */

    let productCkId =
      existing.productCkId;

    if (
      body.productCkId !==
      undefined
    ) {
      productCkId =
        toInt(
          body.productCkId,
        );
    }

    if (
      productCkId !== null
    ) {
      const productCk =
        await prisma.productCK.findUnique({
          where: {
            id: productCkId,
          },

          select: {
            id: true,
            outputBarangId: true,
            active: true,
          },
        });

      if (!productCk) {
        return fail(
          "Product CK tidak ditemukan.",
        );
      }

      if (!productCk.active) {
        return fail(
          "Product CK tidak aktif.",
        );
      }

      /*
       * Bila recipe belum memiliki
       * output barang dan Product CK
       * menyediakan output barang,
       * gunakan output Product CK.
       */

      if (
        finalOutputBarangId ===
          null ||
        finalOutputBarangId ===
          undefined
      ) {
        finalOutputBarangId =
          productCk.outputBarangId;
      }
    }

    if (
      finalOutputBarangId ===
        null ||
      finalOutputBarangId ===
        undefined
    ) {
      return fail(
        "Output barang wajib dipilih.",
      );
    }

    /*
     * -------------------------------------------------------
     * VALIDATE OUTPUT BARANG
     * -------------------------------------------------------
     */

    const outputBarang =
      await prisma.barang.findUnique({
        where: {
          id:
            finalOutputBarangId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          baseUnit: true,
          conversionRate: true,
          active: true,
        },
      });

    if (!outputBarang) {
      return fail(
        "Barang output tidak ditemukan.",
      );
    }

    if (!outputBarang.active) {
      return fail(
        "Barang output tidak aktif.",
      );
    }

    /*
     * -------------------------------------------------------
     * ITEMS
     * -------------------------------------------------------
     *
     * Bila body.items tidak dikirim:
     * item lama dipertahankan.
     *
     * Bila body.items dikirim:
     * item lama diganti dengan item baru.
     * -------------------------------------------------------
     */

    let recipeItems:
      | {
          barangId: number;
          qty: number;
          unit: string | null;
        }[]
      | null = null;

    if (
      body.items !==
      undefined
    ) {
      const rawItems =
        Array.isArray(
          body.items,
        )
          ? body.items
          : [];

      if (!rawItems.length) {
        return fail(
          "Minimal harus ada 1 bahan Recipe.",
        );
      }

      try {
        recipeItems =
          rawItems.map(
            (item, index) => {
              const barangId =
                toInt(
                  item.barangId,
                );

              const qty =
                toFloat(
                  item.qty,
                );

              const unit =
                cleanString(
                  item.unit,
                );

              if (
                barangId ===
                null
              ) {
                throw new Error(
                  `Barang pada item ke-${index + 1} tidak valid.`,
                );
              }

              if (
                qty === null ||
                qty <= 0
              ) {
                throw new Error(
                  `Qty pada item ke-${index + 1} harus lebih dari 0.`,
                );
              }

              return {
                barangId,
                qty,
                unit,
              };
            },
          );
      } catch (error: any) {
        return fail(
          error?.message ||
            "Item Recipe tidak valid.",
        );
      }

      const barangIds = [
        ...new Set(
          recipeItems.map(
            (item) =>
              item.barangId,
          ),
        ),
      ];

      const existingBarangs =
        await prisma.barang.findMany({
          where: {
            id: {
              in: barangIds,
            },
          },

          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            baseUnit: true,
            conversionRate: true,
            active: true,
          },
        });

      const existingIds =
        new Set(
          existingBarangs.map(
            (item) =>
              item.id,
          ),
        );

      const missing =
        barangIds.filter(
          (barangId) =>
            !existingIds.has(
              barangId,
            ),
        );

      if (missing.length) {
        return fail(
          `Barang bahan tidak ditemukan: ${missing.join(
            ", ",
          )}`,
        );
      }

      const inactive =
        existingBarangs.filter(
          (item) =>
            !item.active,
        );

      if (inactive.length) {
        return fail(
          `Ada bahan Recipe yang tidak aktif: ${inactive
            .map(
              (item) =>
                item.name,
            )
            .join(", ")}`,
        );
      }
    }

    /*
     * -------------------------------------------------------
     * TRANSACTION
     * -------------------------------------------------------
     */

    const updated =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Ganti Recipe Item hanya
           * jika items dikirim.
           */

          if (
            recipeItems !==
            null
          ) {
            await tx.recipeItem.deleteMany(
              {
                where: {
                  recipeId: id,
                },
              },
            );

            await tx.recipeItem.createMany(
              {
                data:
                  recipeItems.map(
                    (item) => ({
                      recipeId:
                        id,

                      barangId:
                        item.barangId,

                      qty:
                        item.qty,

                      unit:
                        item.unit,
                    }),
                  ),
              },
            );
          }

          /*
           * Update recipe.
           */

          return tx.recipe.update({
            where: {
              id,
            },

            data: {
              code,

              name,

              /*
               * Ini bagian penting:
               *
               * Recipe lama yang outletId null
               * sekarang akan mendapatkan outlet.
               */

              outletId,

              /*
               * Manufacture Recipe
               * selalu bukan Menu POS.
               */

              menuId: null,

              productCkId,

              outputBarangId:
                finalOutputBarangId,

              outputQty:
                finalOutputQty,

              notes:
                body.notes !==
                undefined
                  ? cleanString(
                      body.notes,
                    )
                  : undefined,

              active:
                typeof body.active ===
                "boolean"
                  ? body.active
                  : undefined,
            },

            include: {
              productCk: {
                include: {
                  outputBarang:
                    true,
                },
              },

              outputBarang:
                true,

              items: {
                include: {
                  barang: true,
                },

                orderBy: {
                  id: "asc",
                },
              },

              orders: {
                orderBy: {
                  id: "desc",
                },
              },
            },
          });
        },
      );

    /*
     * -------------------------------------------------------
     * FORMAT RESPONSE
     * -------------------------------------------------------
     */

    const formatted =
      await formatRecipe(
        updated,
      );

    return NextResponse.json({
      success: true,

      message:
        "Recipe/BOM Outlet berhasil diperbarui.",

      data: formatted,
    });
  } catch (error: any) {
    console.error(
      "PUT /api/manufacture/recipes:",
      error,
    );

    if (
      error?.code ===
      "P2002"
    ) {
      return fail(
        "Code Recipe/BOM sudah digunakan.",
      );
    }

    if (
      error?.code ===
      "P2003"
    ) {
      return fail(
        "Relasi data tidak valid.",
      );
    }

    /*
     * Jangan menjadikan error validasi
     * sebagai HTTP 500.
     */

    const message =
      error?.message ||
      "Gagal memperbarui Recipe/BOM Outlet.";

    if (
      message.includes(
        "Outlet",
      ) ||
      message.includes(
        "Barang",
      ) ||
      message.includes(
        "Product CK",
      ) ||
      message.includes(
        "Qty",
      ) ||
      message.includes(
        "Recipe",
      )
    ) {
      return fail(
        message,
        400,
      );
    }

    return fail(
      message,
      500,
    );
  }
}

/*
===========================================================
PATCH
===========================================================
*/

export async function PATCH(
  req: NextRequest,
) {
  return PUT(req);
}

/*
===========================================================
DELETE
===========================================================
*/

export async function DELETE(
  req: NextRequest,
) {
  try {
    const user =
      await getUser();

    if (
      !user ||
      !user.active
    ) {
      return fail(
        "Tidak login.",
        401,
      );
    }

    const role =
      String(user.role).toUpperCase();

    if (
      !canAccessManufacture(role)
    ) {
      return fail(
        "Tidak memiliki akses.",
        403,
      );
    }

    const { searchParams } =
      new URL(req.url);

    let body: any = null;

    try {
      body =
        await req.json();
    } catch {
      body = null;
    }

    const id =
      getRecipeIdFromRequest(
        req,
        body,
      );

    if (!id) {
      return fail(
        "ID Recipe wajib diisi.",
      );
    }

    /*
     * -------------------------------------------------------
     * FIND RECIPE
     * -------------------------------------------------------
     */

    const recipe =
      await prisma.recipe.findUnique({
        where: {
          id,
        },

        include: {
          orders: {
            select: {
              id: true,
              number: true,
              status: true,
            },
          },
        },
      });

    if (!recipe) {
      return fail(
        "Recipe/BOM tidak ditemukan.",
        404,
      );
    }

    /*
     * Recipe tanpa outlet
     * bukan Recipe Outlet yang valid.
     */

    if (!recipe.outletId) {
      return fail(
        "Recipe ini belum memiliki Outlet.",
        400,
      );
    }

    /*
     * -------------------------------------------------------
     * OUTLET
     * -------------------------------------------------------
     */

    const requestedOutletId =
      body?.outletId ??
      searchParams.get(
        "outletId",
      ) ??
      recipe.outletId;

    let outletId: number;

    try {
      outletId =
        await resolveOutletId(
          user,
          requestedOutletId,
        );
    } catch (error: any) {
      return fail(
        error?.message ||
          "Outlet tidak valid.",
        400,
      );
    }

    if (
      outletId !==
      recipe.outletId
    ) {
      return fail(
        "Recipe bukan milik outlet tersebut.",
        403,
      );
    }

    /*
     * -------------------------------------------------------
     * PROTECT USED RECIPE
     * -------------------------------------------------------
     */

    if (
      recipe.orders.length >
      0
    ) {
      return fail(
        "Recipe/BOM tidak dapat dihapus karena sudah digunakan pada Manufacture Order.",
      );
    }

    /*
     * -------------------------------------------------------
     * DELETE
     * -------------------------------------------------------
     */

    await prisma.recipe.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,

      message:
        "Recipe/BOM Outlet berhasil dihapus.",
    });
  } catch (error: any) {
    console.error(
      "DELETE /api/manufacture/recipes:",
      error,
    );

    if (
      error?.code ===
      "P2003"
    ) {
      return fail(
        "Recipe/BOM tidak dapat dihapus karena masih digunakan.",
      );
    }

    return fail(
      error?.message ||
        "Gagal menghapus Recipe/BOM Outlet.",
      500,
    );
  }
}