import type { Barang } from "@prisma/client";

export type UnitInfo = Pick<
  Barang,
  "unit" | "baseUnit" | "conversionRate"
>;

export type NormalizedBarangUnit = {
  unit: string;
  baseUnit: string;
  conversionRate: number;
};

export function getMainUnit(item: UnitInfo): string {
  return String(item.unit || "PCS").trim() || "PCS";
}

export function getBaseUnit(item: UnitInfo): string {
  const main = getMainUnit(item);
  const base = String(item.baseUnit || "").trim();

  return base || main;
}

export function getConversionRate(item: UnitInfo): number {
  const main = getMainUnit(item);
  const base = getBaseUnit(item);

  if (main.toLowerCase() === base.toLowerCase()) {
    return 1;
  }

  const rate = Number(item.conversionRate);

  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

/**
 * Normalisasi informasi satuan barang.
 *
 * Contoh:
 * unit = "box"
 * baseUnit = "pcs"
 * conversionRate = 100
 *
 * berarti:
 * 1 box = 100 pcs
 */
export function normalizeBarangUnit(
  item: UnitInfo,
): NormalizedBarangUnit {
  return {
    unit: getMainUnit(item),
    baseUnit: getBaseUnit(item),
    conversionRate: getConversionRate(item),
  };
}

/**
 * Mengubah qty dari satuan tertentu ke base unit.
 *
 * Contoh:
 * barang:
 * unit = box
 * baseUnit = pcs
 * conversionRate = 100
 *
 * 2 box -> 200 pcs
 */
export function toBaseQty(
  qty: number,
  unit: string | null | undefined,
  item: UnitInfo,
): number {
  const q = Number(qty);

  if (!Number.isFinite(q)) {
    throw new Error("Qty tidak valid.");
  }

  const units = normalizeBarangUnit(item);

  const requested = String(unit || "")
    .trim()
    .toLowerCase();

  const main = units.unit.toLowerCase();
  const base = units.baseUnit.toLowerCase();

  if (!requested || requested === base) {
    return q;
  }

  if (requested === main) {
    return q * units.conversionRate;
  }

  throw new Error(
    `Satuan ${unit} tidak sesuai dengan ${units.unit}/${units.baseUnit}.`,
  );
}

/**
 * Mengubah qty base unit menjadi qty satuan utama.
 *
 * Contoh:
 * 200 pcs -> 2 box
 */
export function baseToMainQty(
  qty: number,
  item: UnitInfo,
): number {
  const q = Number(qty);

  if (!Number.isFinite(q)) {
    throw new Error("Qty tidak valid.");
  }

  return q / getConversionRate(item);
}

/**
 * Alias yang dipakai oleh outlet-stock-ledger.
 *
 * Base quantity -> stock quantity dalam satuan utama barang.
 */
export function fromBaseQty(
  qtyBase: number,
  conversionRate: number,
): number {
  const q = Number(qtyBase);
  const rate = Number(conversionRate);

  if (!Number.isFinite(q)) {
    throw new Error("Qty base tidak valid.");
  }

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Conversion rate tidak valid.");
  }

  return q / rate;
}