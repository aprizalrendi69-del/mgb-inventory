// ============================================================
// CENTRAL UNIT CONVERSION HELPER
// ============================================================
// RULE:
// - Purchase unit hanya dipakai pada transaksi pembelian.
// - Saat stock masuk, qty dikonversi ke BASE UNIT.
// - BOM / Manufacture / Waste / POS memakai BASE UNIT.
// - Helper ini TIDAK mengubah database.
// - Helper ini TIDAK melakukan reset / delete data.
// ============================================================

export type UnitConvertibleItem = {
  baseUnit?: string | null;

  // Support beberapa kemungkinan nama field conversion
  // agar helper tetap kompatibel dengan schema yang sudah ada.
  conversionRate?: number | null;
  purchaseConversion?: number | null;
  conversionQty?: number | null;
  unitConversion?: number | null;
  unitConversionRate?: number | null;
};

function finiteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : fallback;
}

// ============================================================
// ROUNDING
// ============================================================

export function roundQty(value: number): number {
  const n = finiteNumber(value);

  return Math.round((n + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function roundMoney(value: number): number {
  const n = finiteNumber(value);

  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ============================================================
// BASE UNIT
// ============================================================

export function getBaseUnit(
  barang: UnitConvertibleItem | null | undefined,
): string {
  return String(barang?.baseUnit ?? "").trim();
}

// ============================================================
// CONVERSION RATE
// ============================================================

/**
 * Mengambil conversion rate dari Barang.
 *
 * Makna:
 *
 *   1 purchase unit = conversionRate base unit
 *
 * Contoh:
 *
 *   Purchase unit = BOX
 *   Base unit     = PCS
 *   conversion    = 12
 *
 * Maka:
 *
 *   1 BOX = 12 PCS
 */
export function getConversionRate(
  barang: UnitConvertibleItem | null | undefined,
): number {
  if (!barang) {
    return 1;
  }

  const candidates = [
    barang.conversionRate,
    barang.purchaseConversion,
    barang.conversionQty,
    barang.unitConversion,
    barang.unitConversionRate,
  ];

  for (const value of candidates) {
    const rate = finiteNumber(value, 0);

    if (rate > 0) {
      return rate;
    }
  }

  // Jika tidak ada conversion tersimpan,
  // anggap purchase unit == base unit.
  return 1;
}

// ============================================================
// PURCHASE → BASE
// ============================================================

/**
 * Konversi quantity pembelian menjadi BASE UNIT.
 *
 * Contoh:
 *
 *   qty purchase = 5 BOX
 *   rate         = 12
 *
 *   hasil = 60 PCS
 */
export function toBaseQty(
  purchaseQty: number,
  barang: UnitConvertibleItem | null | undefined,
): number {
  const qty = finiteNumber(purchaseQty);

  if (qty <= 0) {
    return 0;
  }

  const rate = getConversionRate(barang);

  return roundQty(qty * rate);
}

// ============================================================
// BASE → PURCHASE
// ============================================================

/**
 * Konversi quantity BASE UNIT kembali ke purchase unit.
 *
 * Dipakai bila UI / dokumen pembelian perlu menampilkan
 * quantity dalam unit pembelian.
 */
export function toPurchaseQty(
  baseQty: number,
  barang: UnitConvertibleItem | null | undefined,
): number {
  const qty = finiteNumber(baseQty);

  if (qty <= 0) {
    return 0;
  }

  const rate = getConversionRate(barang);

  if (rate <= 0) {
    return roundQty(qty);
  }

  return roundQty(qty / rate);
}

// ============================================================
// PURCHASE PRICE → BASE UNIT COST
// ============================================================

/**
 * Mengubah harga purchase unit menjadi harga per BASE UNIT.
 *
 * Contoh:
 *
 *   Harga 1 BOX = Rp120.000
 *   1 BOX = 12 PCS
 *
 *   cost / PCS = Rp10.000
 */
export function getBaseUnitCost(
  purchaseUnitPrice: number,
  barang: UnitConvertibleItem | null | undefined,
): number {
  const price = finiteNumber(purchaseUnitPrice);

  if (price < 0) {
    return 0;
  }

  const rate = getConversionRate(barang);

  if (rate <= 0) {
    return roundMoney(price);
  }

  return roundMoney(price / rate);
}

// ============================================================
// BASE UNIT COST → PURCHASE UNIT PRICE
// ============================================================

export function getPurchaseUnitCost(
  baseUnitCost: number,
  barang: UnitConvertibleItem | null | undefined,
): number {
  const cost = finiteNumber(baseUnitCost);

  if (cost < 0) {
    return 0;
  }

  const rate = getConversionRate(barang);

  return roundMoney(cost * rate);
}

// ============================================================
// PURCHASE LINE CONVERSION
// ============================================================

export function convertPurchaseLine(params: {
  qty: number;
  price: number;
  barang: UnitConvertibleItem | null | undefined;
}) {
  const { qty, price, barang } = params;

  const baseQty = toBaseQty(qty, barang);
  const baseUnitCost = getBaseUnitCost(price, barang);

  return {
    purchaseQty: roundQty(qty),
    purchaseUnitPrice: roundMoney(price),

    baseQty,
    baseUnitCost,

    baseUnit: getBaseUnit(barang),
    conversionRate: getConversionRate(barang),

    totalPurchase: roundMoney(qty * price),
    totalBase: roundMoney(baseQty * baseUnitCost),
  };
}