import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const token = store.get("erp-session")?.value ?? store.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let userId = 0;
  try {
    const session = await prisma.session.findUnique({
      where: { token },
      select: { expiresAt: true, user: { select: { id: true, active: true, role: true } } },
    });
    if (session) {
      if (session.expiresAt <= new Date() || !session.user.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      userId = session.user.id;
      if (!["ADMIN", "MANAGER", "PURCHASING"].includes(session.user.role)) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    } else {
      const parsed = JSON.parse(decodeURIComponent(token));
      userId = Number(parsed?.user?.id ?? parsed?.data?.user?.id ?? parsed?.id);
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const reminderId = Number(id);
  if (!Number.isInteger(reminderId) || reminderId <= 0 || !userId) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  const result = await prisma.payableReminderLog.updateMany({
    where: { id: reminderId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true, updated: result.count });
}
