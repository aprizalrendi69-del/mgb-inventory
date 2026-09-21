import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { toBaseQty } from "@/lib/base-unit";

export const dynamic = "force-dynamic";

const ROLE_ADMIN = "ADMIN";
const ROLE_MANAGER = "MANAGER";
const ROLE_OUTLET_ADMIN = "OUTLET_ADMIN";
const ROLE_ADMIN_PUSAT = "ADMIN_PUSAT";

const ALLOWED_ROLES = new Set([
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_ADMIN_PUSAT,
  ROLE_OUTLET_ADMIN,
]);

type CurrentUser = {
  id: number;
  role: string;
  outletId: number | null;
  active: boolean;
};

type RecipeItemInput = {
  barangId: number;
  qty: number;
  unit: string;
};

function roleOf(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, message, ...extra }, { status });
}

function numberOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("erp-session") || cookieStore.get("session");
  if (!sessionCookie?.value) return null;

  try {
    const bySession = await prisma.user.findFirst({
      where: {
        sessions: {
          some: {
            token: sessionCookie.value,
            expiresAt: { gt: new Date() },
          },
        },
      },
      select: { id: true, role: true, outletId: true, active: true },
    });
    if (bySession?.active) return bySession;
  } catch {
    // Fall through to legacy JSON session.
  }

  try {
    const parsed = JSON.parse(sessionCookie.value);
    const userId = Number(parsed?.user?.id ?? parsed?.id ?? 0);
    if (!Number.isInteger(userId) || userId <= 0) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, outletId: true, active: true },
    });
    return user?.active ? user : null;
  } catch {
    return null;
  }
}

function canManageRecipe(role: unknown) {
  return ALLOWED_ROLES.has(roleOf(role));
}

function resolveOutletId(user: CurrentUser, requested: unknown) {
  const role = roleOf(user.role);
  if (role === ROLE_OUTLET_ADMIN) {
    const own = Number(user.outletId ?? 0);
    if (!Number.isInteger(own) || own <= 0) {
      throw new Error("User Outlet Admin belum terhubung dengan outlet");
    }
    if (requested !== undefined && requested !== null && requested !== "" && Number(requested) !== own) {
      throw new Error("Anda tidak dapat mengelola Recipe di outlet lain");
    }
    return own;
  }

  const outletId = Number(requested ?? 0);
  if (!Number.isInteger(outletId) || outletId <= 0) {
    throw new Error("Outlet wajib dipilih");
  }
  return outletId;
}

async function validateRecipePayload(tx: any, body: any, currentId?: number) {
  const code = String(body?.code ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const outletId = Number(body?.outletId ?? 0);
  const outputBarangId = Number(body?.outputBarangId ?? 0);
  const outputQty = Number(body?.outputQty ?? 0);
  const productCkId = body?.productCkId === null || body?.productCkId === "" || body?.productCkId === undefined
    ? null
    : Number(body.productCkId);
  const menuId = body?.menuId === null || body?.menuId === "" || body?.menuId === undefined
    ? null
    : Number(body.menuId);
  const active = body?.active === undefined ? true : Boolean(body.active);

  if (!code) throw new Error("Code Recipe wajib diisi");
  if (!name) throw new Error("Nama Recipe wajib diisi");
  if (!Number.isInteger(outletId) || outletId <= 0) throw new Error("Outlet wajib dipilih");
  if (!Number.isInteger(outputBarangId) || outputBarangId <= 0) throw new Error("Barang output Recipe wajib dipilih");
  if (!Number.isFinite(outputQty) || outputQty <= 0) throw new Error("Output quantity Recipe tidak valid");
  if (menuId !== null) throw new Error("Recipe Manufacture tidak boleh menggunakan Menu POS");
  if (productCkId !== null && (!Number.isInteger(productCkId) || productCkId <= 0)) {
    throw new Error("Product CK tidak valid");
  }

  const outlet = await tx.outlet.findUnique({
    where: { id: outletId },
    select: { id: true, code: true, name: true, active: true },
  });
  if (!outlet) throw new Error("Outlet tidak ditemukan");
  if (!outlet.active) throw new Error("Outlet tidak aktif");

  const duplicate = await tx.recipe.findFirst({
    where: {
      code,
      ...(currentId ? { NOT: { id: currentId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) throw new Error("Code Recipe sudah digunakan");

  const outputBarang = await tx.barang.findUnique({
    where: { id: outputBarangId },
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
  if (!outputBarang) throw new Error("Barang output Recipe tidak ditemukan");
  if (!outputBarang.active) throw new Error("Barang output Recipe tidak aktif");

  let productCk = null;
  if (productCkId !== null) {
    productCk = await tx.productCk.findUnique({
      where: { id: productCkId },
      select: { id: true, code: true, name: true, active: true, outputBarangId: true },
    });
    if (!productCk) throw new Error("Product CK tidak ditemukan");
    if (!productCk.active) throw new Error("Product CK tidak aktif");
    if (productCk.outputBarangId !== outputBarangId) {
      throw new Error("Output Barang Recipe tidak sesuai dengan Product CK");
    }
  }

  const rawItems = Array.isArray(body?.items) ? body.items : [];
  if (!rawItems.length) throw new Error("Recipe / BOM harus memiliki minimal 1 bahan");

  const merged = new Map<number, RecipeItemInput>();
  for (const raw of rawItems) {
    const barangId = Number(raw?.barangId ?? 0);
    const qty = Number(raw?.qty ?? 0);
    const unit = String(raw?.unit ?? "").trim();
    if (!Number.isInteger(barangId) || barangId <= 0) throw new Error("Barang bahan tidak valid");
    if (!Number.isFinite(qty) || qty <= 0) throw new Error("Qty bahan harus lebih besar dari 0");
    if (!unit) throw new Error("Satuan bahan wajib diisi");

    const barang = await tx.barang.findUnique({
      where: { id: barangId },
      select: { id: true, name: true, unit: true, baseUnit: true, conversionRate: true, active: true },
    });
    if (!barang) throw new Error(`Barang bahan ID ${barangId} tidak ditemukan`);
    if (!barang.active) throw new Error(`Barang bahan ${barang.name} tidak aktif`);

    try {
      const baseQty = toBaseQty(qty, unit, barang);
      if (!Number.isFinite(baseQty) || baseQty <= 0) throw new Error("invalid");
    } catch {
      throw new Error(`Satuan "${unit}" pada bahan "${barang.name}" tidak sesuai dengan unit master/base unit`);
    }

    const old = merged.get(barangId);
    merged.set(barangId, {
      barangId,
      qty: (old?.qty ?? 0) + qty,
      unit,
    });
  }

  return {
    code,
    name,
    outletId,
    productCkId,
    outputBarangId,
    outputQty,
    active,
    items: Array.from(merged.values()),
    outputBarang,
    productCk,
  };
}

function recipeInclude() {
  return {
    menu: { select: { id: true, code: true, name: true, active: true, price: true } },
    productCk: { select: { id: true, code: true, name: true, active: true, outputBarangId: true } },
    outputBarang: {
      select: {
        id: true, code: true, barcode: true, name: true, unit: true,
        baseUnit: true, conversionRate: true, minimumStock: true, active: true,
      },
    },
    items: {
      orderBy: { id: "asc" },
      include: {
        barang: {
          select: {
            id: true, code: true, barcode: true, name: true, category: true,
            brand: true, unit: true, baseUnit: true, conversionRate: true, active: true,
          },
        },
      },
    },
  } as const;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Tidak login atau session tidak valid", 401);
    if (!canManageRecipe(user.role)) return jsonError("Anda tidak memiliki akses Manufacture", 403);

    const { searchParams } = new URL(req.url);
    const requestedOutlet = searchParams.get("outletId");
    const search = searchParams.get("search")?.trim() ?? "";
    const activeParam = searchParams.get("active");
    const idParam = searchParams.get("id");

    if (idParam) {
      const id = Number(idParam);
      if (!Number.isInteger(id) || id <= 0) return jsonError("ID Recipe tidak valid");
      const recipe = await prisma.recipe.findUnique({ where: { id }, include: recipeInclude() });
      if (!recipe) return jsonError("Recipe / BOM tidak ditemukan", 404);
      if (roleOf(user.role) === ROLE_OUTLET_ADMIN && Number(recipe.outletId) !== Number(user.outletId)) {
        return jsonError("Anda tidak memiliki akses ke Recipe outlet ini", 403);
      }
      return NextResponse.json({ success: true, data: recipe });
    }

    let outletId: number | undefined;
    if (roleOf(user.role) === ROLE_OUTLET_ADMIN) {
      outletId = resolveOutletId(user, user.outletId);
    } else if (requestedOutlet) {
      outletId = Number(requestedOutlet);
      if (!Number.isInteger(outletId) || outletId <= 0) return jsonError("Outlet ID tidak valid");
    }

    const where: any = {};
    if (outletId) where.outletId = outletId;
    if (activeParam === "true" || activeParam === "false") where.active = activeParam === "true";
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
      ];
    }

    const data = await prisma.recipe.findMany({
      where,
      include: recipeInclude(),
      orderBy: [{ active: "desc" }, { name: "asc" }, { id: "desc" }],
    });

    return NextResponse.json({
      success: true,
      data,
      meta: { total: data.length, outletId: outletId ?? null, search, active: activeParam ?? null },
    });
  } catch (error: any) {
    console.error("GET /api/manufacture/recipes ERROR:", error);
    return jsonError(error?.message || "Gagal mengambil Recipe / BOM", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Tidak login atau session tidak valid", 401);
    if (!canManageRecipe(user.role)) return jsonError("Anda tidak memiliki akses Manufacture", 403);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError("Request body tidak valid");

    const outletId = resolveOutletId(user, body.outletId);
    const normalized = await prisma.$transaction(async (tx) => {
      const payload = await validateRecipePayload(tx, { ...body, outletId });
      const recipe = await tx.recipe.create({
        data: {
          code: payload.code,
          name: payload.name,
          outletId: payload.outletId,
          productCkId: payload.productCkId,
          outputBarangId: payload.outputBarangId,
          outputQty: payload.outputQty,
          active: payload.active,
          items: {
            create: payload.items.map((item) => ({
              barangId: item.barangId,
              qty: item.qty,
              unit: item.unit,
            })),
          },
        },
        include: recipeInclude(),
      });
      return recipe;
    });

    return NextResponse.json({ success: true, message: "Recipe / BOM berhasil dibuat", data: normalized }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/manufacture/recipes ERROR:", error);
    return jsonError(error?.message || "Gagal membuat Recipe / BOM", 400);
  }
}

async function updateRecipe(req: NextRequest, partial: boolean) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Tidak login atau session tidak valid", 401);
  if (!canManageRecipe(user.role)) return jsonError("Anda tidak memiliki akses Manufacture", 403);

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id") ?? 0);
  if (!Number.isInteger(id) || id <= 0) return jsonError("ID Recipe tidak valid");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Request body tidak valid");

  const existing = await prisma.recipe.findUnique({ where: { id }, include: { items: true } });
  if (!existing) return jsonError("Recipe / BOM tidak ditemukan", 404);
  if (roleOf(user.role) === ROLE_OUTLET_ADMIN && Number(existing.outletId) !== Number(user.outletId)) {
    return jsonError("Anda tidak memiliki akses ke Recipe outlet ini", 403);
  }

  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);

  const mergedBody = partial
    ? {
        code: has("code") ? body.code : existing.code,
        name: has("name") ? body.name : existing.name,
        outletId: has("outletId") ? body.outletId : existing.outletId,
        productCkId: has("productCkId") ? body.productCkId : existing.productCkId,
        outputBarangId: has("outputBarangId") ? body.outputBarangId : existing.outputBarangId,
        outputQty: has("outputQty") ? body.outputQty : existing.outputQty,
        active: has("active") ? body.active : existing.active,
        items: Array.isArray(body.items)
          ? body.items
          : existing.items.map((item: any) => ({ barangId: item.barangId, qty: item.qty, unit: item.unit })),
      }
    : body;

  const outletId = resolveOutletId(user, mergedBody.outletId);

  const result = await prisma.$transaction(async (tx) => {
    const payload = await validateRecipePayload(tx, { ...mergedBody, outletId }, id);
    await tx.recipeItem.deleteMany({ where: { recipeId: id } });
    const recipe = await tx.recipe.update({
      where: { id },
      data: {
        code: payload.code,
        name: payload.name,
        outletId: payload.outletId,
        productCkId: payload.productCkId,
        outputBarangId: payload.outputBarangId,
        outputQty: payload.outputQty,
        active: payload.active,
        items: {
          create: payload.items.map((item) => ({ barangId: item.barangId, qty: item.qty, unit: item.unit })),
        },
      },
      include: recipeInclude(),
    });
    return recipe;
  });

  return NextResponse.json({ success: true, message: "Recipe / BOM berhasil diperbarui", data: result });
}

export async function PUT(req: NextRequest) {
  try {
    return await updateRecipe(req, false);
  } catch (error: any) {
    console.error("PUT /api/manufacture/recipes ERROR:", error);
    return jsonError(error?.message || "Gagal memperbarui Recipe / BOM", 400);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    return await updateRecipe(req, true);
  } catch (error: any) {
    console.error("PATCH /api/manufacture/recipes ERROR:", error);
    return jsonError(error?.message || "Gagal memperbarui Recipe / BOM", 400);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Tidak login atau session tidak valid", 401);
    if (!canManageRecipe(user.role)) return jsonError("Anda tidak memiliki akses Manufacture", 403);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id") ?? 0);
    if (!Number.isInteger(id) || id <= 0) return jsonError("ID Recipe tidak valid");

    const existing = await prisma.recipe.findUnique({ where: { id }, select: { id: true, outletId: true, name: true } });
    if (!existing) return jsonError("Recipe / BOM tidak ditemukan", 404);
    if (roleOf(user.role) === ROLE_OUTLET_ADMIN && Number(existing.outletId) !== Number(user.outletId)) {
      return jsonError("Anda tidak memiliki akses ke Recipe outlet ini", 403);
    }

    const used = await prisma.manufactureOrder.count({ where: { recipeId: id } });
    if (used > 0) {
      return jsonError("Recipe tidak dapat dihapus karena sudah digunakan oleh Manufacture Order. Nonaktifkan Recipe jika tidak ingin digunakan lagi.", 409);
    }

    await prisma.$transaction(async (tx) => {
      await tx.recipeItem.deleteMany({ where: { recipeId: id } });
      await tx.recipe.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, message: "Recipe / BOM berhasil dihapus", data: { id } });
  } catch (error: any) {
    console.error("DELETE /api/manufacture/recipes ERROR:", error);
    return jsonError(error?.message || "Gagal menghapus Recipe / BOM", 400);
  }
}
