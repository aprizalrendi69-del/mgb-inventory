import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { baseToMainQty, toBaseQty } from "@/lib/base-unit";
import { changeOutletStock } from "@/lib/outlet-stock-ledger";

const fail = (message: string, status = 400) =>
  NextResponse.json(
    {
      success: false,
      message,
    },
    { status },
  );

async function getUser() {
  const cookieStore = await cookies();
  const sessionCookie =
    cookieStore.get("erp-session") ?? cookieStore.get("session");

  if (!sessionCookie) return null;

  let userId = 0;

  // Session database
  try {
    const session = await prisma.session.findUnique({
      where: {
        token: sessionCookie.value,
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

    if (session && session.expiresAt > new Date()) {
      userId = session.user.id;
    }
  } catch {
    // Fallback ke session cookie JSON di bawah.
  }

  // Legacy JSON session fallback
  if (!userId) {
    try {
      const parsed = JSON.parse(sessionCookie.value);

      userId = Number(
        parsed?.user?.id ??
          parsed?.id ??
          0,
      );
    } catch {
      // Ignore invalid JSON.
    }
  }

  if (!userId) return null;

  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
      active: true,
      outletId: true,
    },
  }).then((user) => (user?.active ? user : null));
}

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const user = await getUser();

    if (!user) {
      return fail("Tidak login.", 401);
    }

    const role = String(user.role).toUpperCase();

    if (!["ADMIN", "MANAGER", "OUTLET_ADMIN"].includes(role)) {
      return fail("Tidak memiliki akses POS.", 403);
    }

    const { id } = await params;

    const saleId = Number(id);

    if (!Number.isInteger(saleId) || saleId <= 0) {
      return fail("ID transaksi POS tidak valid.");
    }

    const body = await req.json().catch(() => ({}));

    const reason = String(body?.reason ?? "").trim();

    if (reason.length < 3) {
      return fail("Alasan void minimal 3 karakter.");
    }

    const result = await prisma.$transaction(async (tx) => {
      /*
       * ============================================================
       * 1. AMBIL TRANSAKSI
       * ============================================================
       *
       * POS menggunakan:
       *
       * OutletSale
       *   └── OutletSaleItem
       *         └── Menu
       *               └── Recipe
       *                     └── RecipeItem
       *                           └── Barang
       */
      const sale = await tx.outletSale.findUnique({
        where: {
          id: saleId,
        },
        include: {
          outlet: true,

          items: {
            include: {
              menu: {
                include: {
                  recipes: {
                    where: {
                      active: true,
                    },
                    include: {
                      items: {
                        include: {
                          barang: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!sale) {
        throw new Error("Transaksi POS tidak ditemukan.");
      }

      /*
       * ============================================================
       * 2. CEK STATUS
       * ============================================================
       */
      if (sale.status === "VOID") {
        throw new Error("Transaksi POS sudah di-void.");
      }

      if (sale.status !== "PAID") {
        throw new Error(
          `Hanya transaksi PAID yang dapat di-void. Status transaksi: ${sale.status}`,
        );
      }

      /*
       * ============================================================
       * 3. CEK AKSES OUTLET
       * ============================================================
       */
      if (
        role === "OUTLET_ADMIN" &&
        Number(user.outletId) !== Number(sale.outletId)
      ) {
        throw new Error("Transaksi bukan milik outlet Anda.");
      }

      /*
       * ============================================================
       * 4. AMBIL STOCK MOVEMENT ASLI TRANSAKSI
       * ============================================================
       *
       * Void tidak boleh menghitung ulang BOM karena Recipe dapat
       * berubah setelah transaksi dibuat. Gunakan StockCard POS_OUT
       * yang dibuat saat checkout.
       */
      const movements = await tx.stockCard.findMany({
        where: {
          referenceId: sale.id,
          trxType: "POS_OUT",
          trxNumber: sale.number,
        },
        orderBy: { id: "asc" },
      });

      if (!movements.length) {
        throw new Error(
          "Riwayat pemakaian stock POS tidak ditemukan. Void dibatalkan agar stock tidak salah.",
        );
      }

      const returns = new Map<number, { qtyMain: number; unitCost: number; name: string }>();

      for (const movement of movements) {
        const barang = await tx.barang.findUnique({
          where: { id: movement.barangId },
          select: { id: true, name: true, unit: true, baseUnit: true, conversionRate: true },
        });
        if (!barang) throw new Error(`Barang ${movement.barangId} tidak ditemukan.`);

        const qtyMain = Number(movement.qtyOut || 0);
        if (!Number.isFinite(qtyMain) || qtyMain <= 0) throw new Error(`Qty stock POS untuk ${barang.name} tidak valid.`);

        const old = returns.get(barang.id);
        returns.set(barang.id, {
          qtyMain: (old?.qtyMain || 0) + qtyMain,
          unitCost: old?.unitCost ?? Number(movement.unitPrice || 0),
          name: old?.name ?? barang.name,
        });
      }

      /*
       * ============================================================
       * 5. KEMBALIKAN STOCK MELALUI BASE UNIT
       * ============================================================
       */
      for (const [barangId, item] of returns) {
        const barang = await tx.barang.findUnique({
          where: { id: barangId },
          select: { id: true, name: true, unit: true, baseUnit: true, conversionRate: true },
        });
        if (!barang) throw new Error(`Barang ${barangId} tidak ditemukan.`);

        const qtyBase = toBaseQty(item.qtyMain, barang.unit, barang);
        const ledger = await changeOutletStock(tx, {
          outletId: sale.outletId,
          barangId,
          deltaBaseQty: qtyBase,
          reference: `${sale.number}-VOID`,
          description: `VOID POS ${sale.number} - stock BOM dikembalikan`,
        });

        await tx.stockCard.create({
          data: {
            barangId,
            trxDate: new Date(),
            trxType: "POS_VOID",
            trxNumber: sale.number,
            referenceId: sale.id,
            warehouse: `OUTLET:${sale.outlet.code}`,
            qtyIn: Math.abs(ledger.deltaStockUnit),
            qtyOut: 0,
            balance: ledger.stockAfter,
            unitPrice: item.unitCost,
            totalValue: Math.abs(ledger.deltaStockUnit) * item.unitCost,
            note: `Void POS ${sale.number}. Stock BOM dikembalikan [${qtyBase} ${barang.baseUnit || barang.unit}]. Alasan: ${reason}`,
          },
        });
      }

      /*
       * ============================================================
       * 6. UPDATE TRANSAKSI MENJADI VOID
       * ============================================================
       */
      const now = new Date();

      const updated = await tx.outletSale.update({
        where: {
          id: sale.id,
        },
        data: {
          status: "VOID",
          voidedAt: now,
          voidedById: user.id,
          voidReason: reason,
        },
        include: {
          outlet: true,

          items: {
            include: {
              barang: true,
              menu: true,
            },
          },

        },
      });

      /*
       * ============================================================
       * 7. HISTORY
       * ============================================================
       */
      await tx.history.create({
        data: {
          transactionType: "STOCK_IN",
          referenceNumber: sale.number,
          userId: user.id,
          description:
            `Void POS ${sale.outlet.name} ${sale.number}. ` +
            `Stock BOM dikembalikan. ` +
            `Alasan: ${reason}`,
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      message:
        "Transaksi POS berhasil di-void dan stock BOM dikembalikan.",
      data: result,
    });
  } catch (error: any) {
    console.error("POS VOID ERROR", error);

    const message =
      error?.message ||
      "Gagal void transaksi POS.";

    const status =
      message.includes("sudah di-void") ||
      message.includes("Hanya transaksi PAID") ||
      message.includes("bukan milik outlet")
        ? 409
        : 400;

    return fail(message, status);
  }
}