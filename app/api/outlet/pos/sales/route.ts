import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

async function getUser() {
  const c = await cookies();
  const s = c.get("erp-session") || c.get("session");
  if (!s) return null;
  let id = 0;
  try {
    const db = await prisma.session.findUnique({ where: { token: s.value }, select: { expiresAt: true, user: { select: { id: true } } } });
    if (db && db.expiresAt > new Date()) id = db.user.id;
  } catch {}
  if (!id) { try { const x = JSON.parse(s.value); id = Number(x?.user?.id ?? x?.id ?? 0); } catch {} }
  if (!id) return null;
  return prisma.user.findUnique({ where: { id }, select: { id: true, role: true, active: true, outletId: true } }).then((u) => u?.active ? u : null);
}

const fail = (message: string, status = 400) => NextResponse.json({ success: false, message }, { status });

export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return fail("Tidak login.", 401);
    if (!["ADMIN", "MANAGER", "OUTLET_ADMIN"].includes(String(user.role).toUpperCase())) return fail("Tidak memiliki akses POS Outlet.", 403);
    const requested = Number(req.nextUrl.searchParams.get("outletId") || 0);
    const outletId = String(user.role).toUpperCase() === "OUTLET_ADMIN" ? Number(user.outletId || 0) : requested;
    if (!outletId) return fail("Outlet belum dipilih.");
    if (String(user.role).toUpperCase() === "OUTLET_ADMIN" && Number(user.outletId) !== outletId) return fail("Akses outlet ditolak.", 403);
    const data = await prisma.outletSale.findMany({
      where: { outletId },
      include: { items: { include: { barang: true, menu: true } }, outlet: true, user: { select: { id: true, fullname: true, username: true } } },
      orderBy: { saleDate: "desc" },
      take: 100,
    });
    return NextResponse.json({ success: true, data });
  } catch (e: any) { return fail(e?.message || "Gagal mengambil transaksi POS.", 500); }
}

/*
 * Compatibility endpoint for older clients.
 * The active Gangnam POS uses /api/outlet/pos and menuId + BOM.
 * This endpoint intentionally refuses direct-barang sales so stock cannot be
 * deducted outside the central POS/BOM flow.
 */
export async function POST(_req: NextRequest) {
  return fail("Endpoint POS lama dinonaktifkan. Gunakan POS Menu melalui /api/outlet/pos agar BOM dan satuan dasar diproses dengan benar.", 410);
}
