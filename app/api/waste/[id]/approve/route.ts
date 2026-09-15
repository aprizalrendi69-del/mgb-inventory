import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

async function currentUser() {
  const c = await cookies();
  const s = c.get("erp-session") || c.get("session");
  if (!s) return null;
  let id = 0;
  try {
    const db = await prisma.session.findUnique({ where: { token: s.value }, select: { expiresAt: true, user: { select: { id: true } } } });
    if (db) { if (db.expiresAt <= new Date()) return null; id = db.user.id; }
  } catch {}
  if (!id) { try { const x = JSON.parse(s.value); id = Number(x?.user?.id ?? x?.id ?? 0); } catch { return null; } }
  if (!Number.isInteger(id) || id <= 0) return null;
  return prisma.user.findUnique({ where: { id }, select: { id: true, role: true, active: true } }).then(u => u?.active ? u : null);
}
const json = (body: any, status = 200) => NextResponse.json(body, { status });

export async function PUT(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser();
    if (!user) return json({ success: false, message: "Tidak login." }, 401);
    if (!["ADMIN", "MANAGER"].includes(String(user.role).toUpperCase())) return json({ success: false, message: "Anda tidak memiliki akses untuk approve Waste Pusat." }, 403);
    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id <= 0) return json({ success: false, message: "ID Waste tidak valid." }, 400);

    const result = await prisma.$transaction(async tx => {
      const waste = await tx.stockWaste.findUnique({ where: { id } });
      if (!waste) throw new Error("Data Waste tidak ditemukan.");
      if (waste.type !== "WASTE") throw new Error("Data yang diproses bukan transaksi Waste.");
      if (waste.status !== "PENDING") throw new Error(`Waste sudah berstatus ${waste.status}.`);

      const qty = Number(waste.wasteQty);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error("Qty Waste tidak valid.");

      const barang = await tx.barang.findUnique({
        where: { id: waste.barangId },
        select: { id: true, code: true, name: true, unit: true, stock: true, purchasePrice: true, active: true, hasExpired: true, inventory: { select: { id: true, stock: true, availableStock: true, averageCost: true } } },
      });
      if (!barang) throw new Error("Barang tidak ditemukan.");
      if (!barang.active) throw new Error("Barang sudah tidak aktif.");

      const stockBefore = Number(barang.stock || 0);
      if (qty > stockBefore) throw new Error(`Stock pusat tidak mencukupi. Stock ${stockBefore} ${barang.unit}.`);

      // Waste physically consumes central stock. For expirable items, consume FEFO too.
      if (barang.hasExpired) {
        const batches = await tx.batchStock.findMany({ where: { barangId: barang.id, qty: { gt: 0 } }, orderBy: [{ expiredDate: "asc" }, { id: "asc" }] });
        const batchTotal = batches.reduce((s, b) => s + Number(b.qty), 0);
        if (batchTotal < qty) throw new Error(`Stock batch ${barang.name} tidak mencukupi. Batch tersedia ${batchTotal}, diperlukan ${qty}.`);
        let remaining = qty;
        for (const batch of batches) {
          if (remaining <= 0) break;
          const take = Math.min(Number(batch.qty), remaining);
          await tx.batchStock.update({ where: { id: batch.id }, data: { qty: { decrement: take } } });
          remaining -= take;
        }
      }

      const stockAfter = stockBefore - qty;
      const cost = Number(waste.unitCost || barang.inventory?.averageCost || barang.purchasePrice || 0);
      const approvedAt = new Date();

      const updated = await tx.stockWaste.updateMany({ where: { id, status: "PENDING" }, data: { status: "APPROVED", approvedBy: user.id, approvedAt } });
      if (updated.count !== 1) throw new Error("Waste sudah diproses atau statusnya sudah berubah.");

      await tx.barang.update({ where: { id: barang.id }, data: { stock: stockAfter } });
      if (barang.inventory) {
        await tx.inventory.update({ where: { id: barang.inventory.id }, data: { stock: stockAfter, availableStock: stockAfter } });
      } else {
        await tx.inventory.create({ data: { barangId: barang.id, stock: stockAfter, availableStock: stockAfter, minimumStock: 0 } });
      }

      await tx.stockCard.create({ data: { barangId: barang.id, trxDate: approvedAt, trxType: "WASTE", trxNumber: waste.number, referenceId: waste.id, warehouse: "MAIN", qtyIn: 0, qtyOut: qty, balance: stockAfter, unitPrice: cost, totalValue: qty * cost, note: waste.note || "Waste Pusat" } });
      await tx.stockMutation.create({ data: { barangId: barang.id, type: "WASTE", qty, stockBefore, stockAfter, reference: waste.number, description: waste.note || "Waste Pusat" } });
      await tx.history.create({ data: { transactionType: "STOCK_OUT", referenceNumber: waste.number, userId: user.id, description: `Approve Waste Pusat ${waste.number}: ${barang.name} ${qty} ${barang.unit}.` } });

      return tx.stockWaste.findUnique({ where: { id }, include: { barang: { select: { id: true, code: true, name: true, unit: true, stock: true } }, user: { select: { id: true, username: true, fullname: true } } } });
    });

    return json({ success: true, message: "Waste Pusat berhasil di-approve dan stock pusat telah dikurangi.", data: result });
  } catch (e: any) {
    console.error("CENTRAL WASTE APPROVE ERROR:", e);
    return json({ success: false, message: e?.message || "Gagal approve Waste Pusat." }, 400);
  }
}
