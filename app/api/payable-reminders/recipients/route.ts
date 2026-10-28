import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const REMINDER_ROLES = ["ADMIN", "MANAGER", "PURCHASING"] as const;

async function currentUser() {
  const store = await cookies();
  const token = store.get("erp-session")?.value ?? store.get("session")?.value;
  if (!token) return null;
  try {
    const session = await prisma.session.findUnique({
      where: { token },
      select: { expiresAt: true, user: { select: { id: true, role: true, active: true } } },
    });
    if (session) {
      if (session.expiresAt <= new Date() || !session.user.active) return null;
      return session.user;
    }
  } catch {}
  try {
    const parsed = JSON.parse(decodeURIComponent(token));
    const id = Number(parsed?.user?.id ?? parsed?.data?.user?.id ?? parsed?.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    return await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, active: true } });
  } catch { return null; }
}

export async function GET() {
  const user = await currentUser();
  if (!user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!REMINDER_ROLES.includes(user.role as (typeof REMINDER_ROLES)[number])) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: [...REMINDER_ROLES] } },
    orderBy: [{ role: "asc" }, { fullname: "asc" }],
    select: { id: true, fullname: true, username: true, role: true, whatsappPhone: true },
  });
  return NextResponse.json({
    users,
    canEdit: ["ADMIN"].includes(user.role),
  });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Hanya ADMIN yang dapat mengatur nomor WhatsApp." }, { status: 403 });

  try {
    const body = await request.json();
    const userId = Number(body?.userId);
    const phone = String(body?.whatsappPhone ?? "").trim();
    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "User tidak valid." }, { status: 400 });
    }
    if (phone && !/^[+()\d\s.-]{8,25}$/.test(phone)) {
      return NextResponse.json({ error: "Format nomor WhatsApp tidak valid." }, { status: 400 });
    }
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, active: true },
    });
    if (!target || !target.active || !REMINDER_ROLES.includes(target.role as (typeof REMINDER_ROLES)[number])) {
      return NextResponse.json({ error: "Penerima tidak ditemukan atau tidak aktif." }, { status: 404 });
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { whatsappPhone: phone || null },
      select: { id: true, fullname: true, username: true, role: true, whatsappPhone: true },
    });
    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    console.error("[PATCH /api/payable-reminders/recipients]", error);
    return NextResponse.json({ error: "Gagal menyimpan nomor WhatsApp." }, { status: 500 });
  }
}
