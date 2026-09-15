import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const session =
    cookieStore.get("erp-session") || cookieStore.get("session");

  if (!session) return null;

  let userId: number | null = null;

  try {
    const dbSession = await prisma.session.findUnique({
      where: { token: session.value },
      select: { expiresAt: true, user: { select: { id: true } } },
    });

    if (dbSession) {
      if (dbSession.expiresAt < new Date()) return null;
      userId = dbSession.user.id;
    }
  } catch {}

  if (!userId) {
    try {
      const data = JSON.parse(session.value);
      userId = Number(data?.user?.id ?? data?.id ?? 0);
    } catch {
      return null;
    }
  }

  if (!Number.isInteger(userId) || userId <= 0) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      fullname: true,
      role: true,
      active: true,
    },
  });

  return user?.active ? user : null;
}

function error(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

function monthRange(month: string) {
  const [year, m] = month.split("-").map(Number);
  return {
    start: new Date(year, m - 1, 1),
    end: new Date(year, m, 1),
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return error("Tidak login.", 401);

    const role = String(user.role).toUpperCase();
    if (!["ADMIN", "MANAGER", "GUDANG"].includes(role)) {
      return error("Anda tidak memiliki akses ke Waste Pusat.", 403);
    }

    const params = new URL(req.url).searchParams;
    const month = params.get("month") || "all";
    const status = String(params.get("status") || "APPROVED").toUpperCase();

    const where: any = { type: "WASTE", ...(status !== "ALL" ? { status } : {}) };

    if (month !== "all") {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return error("Format periode tidak valid. Gunakan YYYY-MM atau all.");
      }
      const { start, end } = monthRange(month);
      where.trxDate = { gte: start, lt: end };
    }

    const rows = await prisma.stockWaste.findMany({
      where,
      orderBy: { trxDate: "desc" },
      include: {
        barang: {
          select: { id: true, code: true, name: true, category: true, unit: true, stock: true },
        },
        user: { select: { id: true, username: true, fullname: true } },
      },
    });

    const data = rows.map((item) => ({
      ...item,
      qtyProcessed: Number(item.qtyProcessed || 0),
      wasteQty: Number(item.wasteQty || 0),
      netQty: Number(item.netQty || 0),
      unitCost: Number(item.unitCost || 0),
      totalCost: Number(item.totalCost || 0),
    }));

    const totalWasteQty = data.reduce((sum, x) => sum + x.wasteQty, 0);
    const totalWasteValue = data.reduce((sum, x) => sum + x.totalCost, 0);

    const pendingCount = data.filter((x) => x.status === "PENDING").length;
    const approvedCount = data.filter((x) => x.status === "APPROVED").length;
    const rejectedCount = data.filter((x) => x.status === "REJECTED").length;

    return NextResponse.json({
      success: true,
      role,
      data,
      summary: {
        month,
        totalTransactions: data.length,
        totalWasteQty,
        totalWasteValue,
        pendingCount,
        approvedCount,
        rejectedCount,
      },
    });
  } catch (e: any) {
    console.error("CENTRAL WASTE GET ERROR:", e);
    return error(e?.message || "Gagal mengambil Waste Pusat.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return error("Tidak login.", 401);

    const role = String(user.role).toUpperCase();
    if (!["ADMIN", "GUDANG"].includes(role)) {
      return error("Hanya ADMIN atau GUDANG yang dapat membuat Waste Pusat.", 403);
    }

    const body = await req.json().catch(() => null);
    if (!body) return error("Body request tidak valid.");

    const barangId = Number(body.barangId || 0);
    const wasteQty = Number(body.wasteQty || 0);
    const requestedUnitCost = Number(body.unitCost || 0);
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

    if (!Number.isInteger(barangId) || barangId <= 0) return error("Barang wajib dipilih.");
    if (!Number.isFinite(wasteQty) || wasteQty <= 0) return error("Qty Waste harus lebih besar dari 0.");
    if (!Number.isFinite(requestedUnitCost) || requestedUnitCost < 0) return error("Unit Cost tidak valid.");

    const barang = await prisma.barang.findUnique({
      where: { id: barangId },
      select: {
        id: true, code: true, name: true, category: true, unit: true,
        stock: true, purchasePrice: true, active: true,
        inventory: { select: { averageCost: true, stock: true } },
      },
    });

    if (!barang) return error("Barang tidak ditemukan.", 404);
    if (!barang.active) return error("Barang sudah tidak aktif.");

    const currentStock = Number(barang.stock ?? barang.inventory?.stock ?? 0);
    if (wasteQty > currentStock) {
      return error(`Qty Waste melebihi stock pusat. Stock saat ini ${currentStock} ${barang.unit}.`);
    }

    const unitCost = requestedUnitCost > 0
      ? requestedUnitCost
      : Number(barang.inventory?.averageCost ?? barang.purchasePrice ?? 0);

    const now = new Date();
    const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const period = `${wib.getUTCFullYear()}${String(wib.getUTCMonth() + 1).padStart(2, "0")}${String(wib.getUTCDate()).padStart(2, "0")}`;
    const prefix = `WSP-${period}-`;

    const waste = await prisma.$transaction(async (tx) => {
      let document = await tx.documentNumber.findUnique({
        where: { type_period: { type: "WASTE_CENTRAL", period } },
      });

      let sequence = 1;
      if (!document) {
        const last = await tx.stockWaste.findFirst({
          where: { number: { startsWith: prefix } },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        if (last?.number) {
          const parsed = Number(last.number.split("-").pop());
          if (Number.isInteger(parsed) && parsed > 0) sequence = parsed + 1;
        }
        await tx.documentNumber.create({
          data: { type: "WASTE_CENTRAL", prefix: "WSP", period, lastNumber: sequence },
        });
      } else {
        sequence = document.lastNumber + 1;
        await tx.documentNumber.update({
          where: { id: document.id },
          data: { lastNumber: sequence },
        });
      }

      return tx.stockWaste.create({
        data: {
          number: `${prefix}${String(sequence).padStart(4, "0")}`,
          barangId,
          userId: user.id,
          trxDate: now,
          type: "WASTE",
          status: "PENDING",
          qtyProcessed: wasteQty,
          wasteQty,
          netQty: 0,
          unitCost,
          totalCost: wasteQty * unitCost,
          note,
        },
        include: {
          barang: { select: { id: true, code: true, name: true, category: true, unit: true, stock: true } },
          user: { select: { id: true, username: true, fullname: true } },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Waste Pusat berhasil dibuat dan menunggu approval.",
      data: waste,
    }, { status: 201 });
  } catch (e: any) {
    console.error("CENTRAL WASTE POST ERROR:", e);
    return error(e?.message || "Gagal membuat Waste Pusat.", 500);
  }
}
