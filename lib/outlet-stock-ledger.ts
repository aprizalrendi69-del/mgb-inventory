import { Prisma } from "@prisma/client";
import {
  baseToMainQty,
  getBaseUnit,
  getConversionRate,
  getMainUnit,
} from "@/lib/base-unit";

export async function changeOutletStock(
  tx: Prisma.TransactionClient,
  args: {
    outletId: number;
    barangId: number;
    deltaBaseQty: number;
    reference: string;
    description: string;
    unitCostBase?: number;
  },
) {
  if (!Number.isFinite(args.deltaBaseQty) || args.deltaBaseQty === 0) {
    throw new Error("Perubahan stock harus valid dan tidak boleh nol");
  }

  const barang = await tx.barang.findUnique({
    where: { id: args.barangId },
    select: {
      id: true,
      code: true,
      name: true,
      unit: true,
      baseUnit: true,
      conversionRate: true,
    },
  });

  if (!barang) {
    throw new Error("Barang tidak ditemukan");
  }

  const mainUnit = getMainUnit(barang);
  const baseUnit = getBaseUnit(barang);
  const conversionRate = getConversionRate(barang);

  // OutletStock.stock disimpan dalam main/display unit.
  // deltaBaseQty datang dalam base unit.
  const deltaStockUnit = baseToMainQty(args.deltaBaseQty, barang);

  const existing = await tx.outletStock.findUnique({
    where: {
      outletId_barangId: {
        outletId: args.outletId,
        barangId: args.barangId,
      },
    },
    select: {
      id: true,
      stock: true,
      averageCost: true,
      minimumStock: true,
    },
  });

  const stockBefore = existing?.stock ?? 0;
  const stockAfter = stockBefore + deltaStockUnit;

  const epsilon = 1e-9;

  if (stockAfter < -epsilon) {
    throw new Error(
      `Stock ${barang.name} tidak cukup. Tersedia ${stockBefore} ${mainUnit}`,
    );
  }

  const safeAfter = Math.abs(stockAfter) < epsilon ? 0 : stockAfter;

  let averageCost = existing?.averageCost ?? 0;

  // averageCost disimpan sebagai cost per MAIN/DISPLAY unit.
  // unitCostBase adalah cost per BASE unit.
  if (
    deltaStockUnit > 0 &&
    args.unitCostBase !== undefined &&
    Number.isFinite(args.unitCostBase) &&
    args.unitCostBase >= 0
  ) {
    const incomingCostPerStockUnit =
      args.unitCostBase * conversionRate;

    const oldValue = stockBefore * averageCost;
    const newValue = deltaStockUnit * incomingCostPerStockUnit;

    averageCost =
      safeAfter > 0
        ? (oldValue + newValue) / safeAfter
        : incomingCostPerStockUnit;
  }

  if (existing) {
    await tx.outletStock.update({
      where: { id: existing.id },
      data: {
        stock: safeAfter,
        averageCost,
      },
    });
  } else {
    await tx.outletStock.create({
      data: {
        outletId: args.outletId,
        barangId: args.barangId,
        stock: safeAfter,
        averageCost,
        minimumStock: 0,
      },
    });
  }

  await tx.stockMutation.create({
    data: {
      outletId: args.outletId,
      barangId: args.barangId,
      type: deltaStockUnit > 0 ? "OUTLET_IN" : "OUTLET_OUT",
      qty: Math.abs(deltaStockUnit),
      stockBefore,
      stockAfter: safeAfter,
      reference: args.reference,
      description:
        `Outlet ${args.outletId}: ${args.description} ` +
        `[${Math.abs(args.deltaBaseQty)} ${baseUnit}]`,
    },
  });

  return {
    stockBefore,
    stockAfter: safeAfter,
    deltaStockUnit,
    unit: mainUnit,
    baseUnit,
  };
}