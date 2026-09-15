import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export type OutletActor = {
  id: number;
  username: string;
  fullname: string;
  role: string;
  active: boolean;
  outletId: number | null;
};

export async function getOutletActor(): Promise<OutletActor | null> {
  const store = await cookies();
  const token = store.get("erp-session")?.value ?? store.get("session")?.value ?? store.get("token")?.value;
  if (!token) return null;

  let userId = 0;
  try {
    const session = await prisma.session.findUnique({
      where: { token },
      select: { expiresAt: true, user: { select: { id: true } } },
    });
    if (session) {
      if (session.expiresAt <= new Date()) return null;
      userId = session.user.id;
    }
  } catch {
    // Older installations can use the JSON session cookie.
  }

  if (!userId) {
    try {
      const parsed = JSON.parse(token);
      userId = Number(parsed?.user?.id ?? parsed?.id ?? 0);
    } catch {
      return null;
    }
  }

  if (!Number.isInteger(userId) || userId <= 0) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, fullname: true, role: true, active: true, outletId: true },
  });
}

export function resolveOutletId(actor: OutletActor, requested: unknown): number | null {
  if (actor.role === "OUTLET_ADMIN") return actor.outletId && actor.outletId > 0 ? actor.outletId : null;
  const value = Number(requested);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function canOperateOutlet(actor: OutletActor): boolean {
  return actor.active && ["ADMIN", "MANAGER", "OUTLET_ADMIN"].includes(actor.role);
}
