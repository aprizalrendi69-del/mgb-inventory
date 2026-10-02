// ============================================================
// CENTRAL UNIT CONVERSION HELPER
// ============================================================
// RULE MGB:
//
// 1. PURCHASE UNIT
//    - Hanya dipakai pada transaksi pembelian.
//    - Contoh:
//        1 jerigen = 13.000 gram
//
// 2. BASE UNIT
//    - Stock database disimpan dalam BASE UNIT.
//    - BOM memakai BASE UNIT.
//    - Manufacture memakai BASE UNIT.
//    - Waste memakai BASE UNIT.
//    - POS memakai BASE UNIT.
//    - Stock Card / Stock Mutation memakai BASE UNIT.
//
// 3. PENTING
//    - Helper ini TIDAK mengubah database.
//    - Helper ini TIDAK reset database.
//    - Helper ini TIDAK delete data.
//    - Helper ini TIDAK pernah otomatis mengonversi Barang.stock.
//    - Barang.stock dianggap SUDAH dalam BASE UNIT.
//
// 4. DOUBLE CONVERSION DILARANG
//
//    SALAH:
//      stock = 4 gram
//      lalu dikali conversionRate lagi.
//
//    BENAR:
//      stock = 4 gram
//      tetap 4 gram.
//
// 5. PURCHASE → BASE
//
//      qtyPurchase × conversionRate = qtyBase
//
//    Contoh:
//      4.3 jerigen
//      1 jerigen = 13.000 gram
//
//      4.3 × 13.000
//      = 55.900 gram
//
// 6. BASE → PURCHASE
//
//      qtyBase ÷ conversionRate = qtyPurchase
//
// ============================================================

export type UnitConvertibleItem = {
  /**
   * Purchase unit / unit pembelian.
   *
   * Field ini opsional karena helper tidak membutuhkan
   * purchase unit untuk semua operasi.
   */
  unit?: string | null;

  /**
   * Base unit inventory.
   *
   * Contoh:
   *   unit     = "pack"
   *   baseUnit = "gram"
   */
  baseUnit?: string | null;

  /**
   * Conversion:
   *
   *   1 purchase unit = conversionRate base unit
   *
   * Contoh:
   *   1 pack = 500 gram
   *   conversionRate = 500
   */
  conversionRate?: number | null;

  /**
   * Beberapa nama field lama/alternatif
   * yang mungkin masih dipakai oleh module lain.
   */
  purchaseConversion?: number | null;
  conversionQty?: number | null;
  unitConversion?: number | null;
  unitConversionRate?: number | null;
};

// ============================================================
// INTERNAL NUMBER HELPERS
// ============================================================

function finiteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : fallback;
}

// ============================================================
// UNIT NORMALIZATION
// ============================================================

/**
 * Normalisasi nama unit supaya perbandingan tidak sensitif
 * terhadap spasi dan huruf besar/kecil.
 *
 * Contoh:
 *
 *   " Gram " → "gram"
 *   "PACK"   → "pack"
 */
export function normalizeUnit(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

// ============================================================
// UNIT COMPARISON
// ============================================================

/**
 * Mengecek apakah dua unit sama.
 *
 * Jika keduanya kosong, hasil false.
 */
export function isSameUnit(
  firstUnit: unknown,
  secondUnit: unknown,
): boolean {
  const first = normalizeUnit(firstUnit);
  const second = normalizeUnit(secondUnit);

  if (!first || !second) {
    return false;
  }

  return first === second;
}

// ============================================================
// ROUNDING
// ============================================================

/**
 * Pembulatan quantity.
 *
 * Menggunakan 6 angka desimal agar quantity seperti:
 *
 *   4.333333
 *   0.125
 *   55.9
 *
 * tetap aman.
 */
export function roundQty(value: number): number {
  const n = finiteNumber(value);

  return Math.round((n + Number.EPSILON) * 1_000_000) / 1_000_000;
}

/**
 * Pembulatan nominal uang.
 */
export function roundMoney(value: number): number {
  const n = finiteNumber(value);

  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ============================================================
// BASE UNIT
// ============================================================

/**
 * Mengambil BASE UNIT barang.
 *
 * Contoh:
 *
 *   barang.baseUnit = "gram"
 *
 * hasil:
 *
 *   "gram"
 */
export function getBaseUnit(
  barang: UnitConvertibleItem | null | undefined,
): string {
  return String(barang?.baseUnit ?? "").trim();
}

// ============================================================
// PURCHASE UNIT
// ============================================================

/**
 * Mengambil purchase unit / unit pembelian.
 *
 * Ini hanya informasi unit transaksi pembelian.
 */
export function getPurchaseUnit(
  barang: UnitConvertibleItem | null | undefined,
): string {
  return String(barang?.unit ?? "").trim();
}

// ============================================================
// CONVERSION RATE
// ============================================================

/**
 * Mengambil conversion rate dari Barang.
 *
 * Makna conversion rate:
 *
 *   1 PURCHASE UNIT = conversionRate BASE UNIT
 *
 * Contoh:
 *
 *   unit     = "pack"
 *   baseUnit = "gram"
 *   rate     = 500
 *
 * berarti:
 *
 *   1 pack = 500 gram
 *
 * Contoh:
 *
 *   unit     = "jerigen"
 *   baseUnit = "gram"
 *   rate     = 13000
 *
 * berarti:
 *
 *   1 jerigen = 13.000 gram
 *
 * ------------------------------------------------------------
 * PRIORITAS FIELD
 * ------------------------------------------------------------
 *
 * conversionRate
 * purchaseConversion
 * conversionQty
 * unitConversion
 * unitConversionRate
 *
 * Field pertama yang memiliki angka > 0 akan digunakan.
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

  /**
   * Jika tidak ada conversion rate:
   *
   * anggap purchase unit = base unit.
   */
  return 1;
}

// ============================================================
// HAS CONVERSION
// ============================================================

/**
 * Mengecek apakah barang benar-benar mempunyai konversi
 * purchase → base.
 */
export function hasConversion(
  barang: UnitConvertibleItem | null | undefined,
): boolean {
  const purchaseUnit = getPurchaseUnit(barang);
  const baseUnit = getBaseUnit(barang);
  const rate = getConversionRate(barang);

  /**
   * Jika unit tidak tersedia, kita tidak memaksakan
   * conversion berdasarkan nama unit.
   */
  if (!purchaseUnit || !baseUnit) {
    return false;
  }

  if (isSameUnit(purchaseUnit, baseUnit)) {
    return false;
  }

  return rate !== 1;
}

// ============================================================
// IS BASE UNIT
// ============================================================

/**
 * Mengecek apakah unit tertentu sudah merupakan BASE UNIT.
 *
 * Ini penting agar tidak terjadi double conversion.
 *
 * Contoh:
 *
 *   barang.baseUnit = "gram"
 *
 *   isBaseUnit("gram", barang)
 *   → true
 *
 *   isBaseUnit("jerigen", barang)
 *   → false
 */
export function isBaseUnit(
  unit: string | null | undefined,
  barang: UnitConvertibleItem | null | undefined,
): boolean {
  const source = normalizeUnit(unit);
  const base = normalizeUnit(getBaseUnit(barang));

  if (!source || !base) {
    return false;
  }

  return source === base;
}

// ============================================================
// PURCHASE → BASE
// ============================================================

/**
 * Konversi quantity PURCHASE UNIT menjadi BASE UNIT.
 *
 * Formula:
 *
 *   purchaseQty × conversionRate = baseQty
 *
 * Contoh:
 *
 *   4.3 jerigen
 *   rate = 13.000
 *
 *   4.3 × 13.000
 *   = 55.900 gram
 *
 * ------------------------------------------------------------
 * PENTING
 * ------------------------------------------------------------
 *
 * Fungsi ini dipakai HANYA apabila qty yang diberikan
 * memang masih dalam PURCHASE UNIT.
 *
 * Jangan kirim Barang.stock ke fungsi ini.
 *
 * Barang.stock sudah BASE UNIT.
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

  if (rate <= 0) {
    return roundQty(qty);
  }

  return roundQty(qty * rate);
}

// ============================================================
// UNIT → BASE
// ============================================================

/**
 * Konversi quantity berdasarkan UNIT sumber.
 *
 * Ini adalah fungsi yang lebih aman untuk BOM / Manufacture.
 *
 * Jika sourceUnit sudah sama dengan baseUnit:
 *
 *   TIDAK DIKONVERSI.
 *
 * Jika sourceUnit berbeda:
 *
 *   qty × conversionRate
 *
 * Contoh:
 *
 *   qty = 4.3
 *   sourceUnit = "jerigen"
 *   baseUnit = "gram"
 *   rate = 13.000
 *
 *   hasil = 55.900 gram
 *
 * Contoh penting:
 *
 *   qty = 4
 *   sourceUnit = "gram"
 *   baseUnit = "gram"
 *
 *   hasil = 4 gram
 *
 * BUKAN:
 *
 *   4 × 13.000
 */
export function convertQtyToBase(
  qty: number,
  sourceUnit: string | null | undefined,
  barang: UnitConvertibleItem | null | undefined,
): number {
  const value = finiteNumber(qty);

  if (value <= 0) {
    return 0;
  }

  /**
   * Jika source unit sudah base unit,
   * jangan lakukan conversion.
   */
  if (isBaseUnit(sourceUnit, barang)) {
    return roundQty(value);
  }

  /**
   * Jika source unit tidak diketahui,
   * jangan melakukan conversion secara agresif.
   *
   * Ini lebih aman daripada mengalikan stock
   * secara tidak sengaja.
   */
  const source = normalizeUnit(sourceUnit);

  if (!source) {
    return roundQty(value);
  }

  return toBaseQty(value, barang);
}

// ============================================================
// BASE → PURCHASE
// ============================================================

/**
 * Konversi BASE UNIT kembali ke PURCHASE UNIT.
 *
 * Formula:
 *
 *   baseQty ÷ conversionRate = purchaseQty
 *
 * Contoh:
 *
 *   55.900 gram
 *   rate = 13.000
 *
 *   55.900 ÷ 13.000
 *   = 4.3 jerigen
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
// BASE QUANTITY NORMALIZATION
// ============================================================

/**
 * Menandai quantity bahwa quantity tersebut SUDAH BASE UNIT.
 *
 * Fungsi ini sengaja TIDAK melakukan conversion.
 *
 * Dipakai oleh:
 *
 * - Manufacture
 * - Waste
 * - POS
 * - Stock Mutation
 * - Stock Card
 * - Inventory adjustment
 *
 * Contoh:
 *
 *   stock = 4
 *   baseUnit = gram
 *
 *   normalizeBaseQty(4)
 *   → 4
 *
 * Bukan 4 × conversionRate.
 */
export function normalizeBaseQty(value: number): number {
  const qty = finiteNumber(value);

  if (qty <= 0) {
    return 0;
  }

  return roundQty(qty);
}

// ============================================================
// PURCHASE PRICE → BASE UNIT COST
// ============================================================

/**
 * Mengubah harga PURCHASE UNIT menjadi harga per BASE UNIT.
 *
 * Contoh:
 *
 *   Harga 1 jerigen = Rp130.000
 *   1 jerigen = 13.000 gram
 *
 *   Rp130.000 ÷ 13.000
 *   = Rp10 / gram
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

/**
 * Mengubah harga BASE UNIT menjadi harga PURCHASE UNIT.
 *
 * Contoh:
 *
 *   Rp10 / gram
 *   13.000 gram / jerigen
 *
 *   Rp10 × 13.000
 *   = Rp130.000 / jerigen
 */
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
// BASE UNIT TOTAL VALUE
// ============================================================

/**
 * Menghitung total nilai berdasarkan BASE UNIT.
 *
 * Contoh:
 *
 *   baseQty = 55.900 gram
 *   baseUnitCost = Rp10 / gram
 *
 *   total = Rp559.000
 */
export function calculateBaseTotal(
  baseQty: number,
  baseUnitCost: number,
): number {
  const qty = finiteNumber(baseQty);
  const cost = finiteNumber(baseUnitCost);

  if (qty <= 0 || cost < 0) {
    return 0;
  }

  return roundMoney(qty * cost);
}

// ============================================================
// PURCHASE TOTAL
// ============================================================

/**
 * Menghitung total transaksi pembelian.
 *
 * Ini menggunakan PURCHASE UNIT.
 *
 * Contoh:
 *
 *   4.3 jerigen × Rp130.000
 *   = Rp559.000
 */
export function calculatePurchaseTotal(
  purchaseQty: number,
  purchaseUnitPrice: number,
): number {
  const qty = finiteNumber(purchaseQty);
  const price = finiteNumber(purchaseUnitPrice);

  if (qty <= 0 || price < 0) {
    return 0;
  }

  return roundMoney(qty * price);
}

// ============================================================
// PURCHASE LINE CONVERSION
// ============================================================

/**
 * Mengubah satu baris pembelian menjadi informasi
 * PURCHASE UNIT dan BASE UNIT.
 *
 * Contoh:
 *
 *   qty       = 4.3
 *   price     = 130.000
 *   rate      = 13.000
 *
 * hasil:
 *
 *   purchaseQty       = 4.3
 *   purchaseUnitPrice = 130.000
 *
 *   baseQty           = 55.900
 *   baseUnitCost      = 10
 *
 *   totalPurchase     = 559.000
 *   totalBase         = 559.000
 */
export function convertPurchaseLine(params: {
  qty: number;
  price: number;
  barang: UnitConvertibleItem | null | undefined;
}) {
  const { qty, price, barang } = params;

  const purchaseQty = roundQty(qty);
  const purchaseUnitPrice = roundMoney(price);

  const baseQty = toBaseQty(purchaseQty, barang);
  const baseUnitCost = getBaseUnitCost(
    purchaseUnitPrice,
    barang,
  );

  const totalPurchase = calculatePurchaseTotal(
    purchaseQty,
    purchaseUnitPrice,
  );

  const totalBase = calculateBaseTotal(
    baseQty,
    baseUnitCost,
  );

  return {
    // --------------------------------------------------------
    // PURCHASE
    // --------------------------------------------------------

    purchaseQty,

    purchaseUnit: getPurchaseUnit(barang),

    purchaseUnitPrice,

    totalPurchase,

    // --------------------------------------------------------
    // BASE
    // --------------------------------------------------------

    baseQty,

    baseUnit: getBaseUnit(barang),

    baseUnitCost,

    totalBase,

    // --------------------------------------------------------
    // CONVERSION
    // --------------------------------------------------------

    conversionRate: getConversionRate(barang),

    hasConversion: hasConversion(barang),
  };
}

// ============================================================
// BOM QUANTITY → BASE UNIT
// ============================================================

/**
 * Konversi quantity BOM ke BASE UNIT.
 *
 * BOM sebaiknya menyimpan quantity bahan dalam BASE UNIT.
 *
 * Tetapi fungsi ini tetap tersedia untuk menangani
 * BOM lama yang masih mempunyai unit purchase.
 *
 * Contoh BOM lama:
 *
 *   qty  = 4.3
 *   unit = jerigen
 *
 * menjadi:
 *
 *   55.900 gram
 *
 * Contoh BOM baru:
 *
 *   qty  = 55.900
 *   unit = gram
 *
 * hasil:
 *
 *   55.900 gram
 *
 * Tidak dikonversi lagi.
 */
export function convertBomQtyToBase(params: {
  qty: number;
  unit?: string | null;
  barang: UnitConvertibleItem | null | undefined;
}): number {
  const { qty, unit, barang } = params;

  return convertQtyToBase(
    qty,
    unit,
    barang,
  );
}

// ============================================================
// STOCK QTY
// ============================================================

/**
 * Quantity stock DATABASE.
 *
 * RULE:
 *
 *   Barang.stock SUDAH BASE UNIT.
 *
 * Fungsi ini sengaja hanya melakukan normalisasi angka.
 *
 * JANGAN:
 *
 *   normalizeStock(4, barang)
 *
 * lalu mengalikan conversionRate.
 *
 * Karena stock sudah base.
 */
export function normalizeStockQty(value: number): number {
  return normalizeBaseQty(value);
}

// Alias kompatibilitas jika file lama menggunakan normalizeStock.
export function normalizeStock(value: number): number {
  return normalizeStockQty(value);
}

// ============================================================
// STOCK AFTER
// ============================================================

/**
 * Menghitung stock setelah mutation.
 *
 * Semua quantity harus BASE UNIT.
 *
 * Contoh:
 *
 *   stockBefore = 55.900 gram
 *   qtyOut      = 1.000 gram
 *
 *   stockAfter = 54.900 gram
 */
export function calculateStockAfter(params: {
  stockBefore: number;
  qtyIn?: number;
  qtyOut?: number;
}) {
  const stockBefore = normalizeBaseQty(
    params.stockBefore,
  );

  const qtyIn = normalizeBaseQty(
    params.qtyIn ?? 0,
  );

  const qtyOut = normalizeBaseQty(
    params.qtyOut ?? 0,
  );

  const stockAfter = roundQty(
    stockBefore + qtyIn - qtyOut,
  );

  return {
    stockBefore,
    qtyIn,
    qtyOut,
    stockAfter,
  };
}

// ============================================================
// ENOUGH STOCK
// ============================================================

/**
 * Mengecek apakah BASE UNIT stock mencukupi.
 *
 * Semua parameter wajib BASE UNIT.
 *
 * Tidak ada conversion di sini.
 */
export function hasEnoughStock(
  stock: number,
  requiredQty: number,
): boolean {
  const available = normalizeBaseQty(stock);
  const required = normalizeBaseQty(requiredQty);

  return available + 0.0000001 >= required;
}

/**
 * Validasi stock BASE UNIT.
 *
 * Melempar Error jika tidak cukup.
 */
export function assertEnoughStock(
  stock: number,
  requiredQty: number,
  itemName = "Barang",
): void {
  const available = normalizeBaseQty(stock);
  const required = normalizeBaseQty(requiredQty);

  if (!hasEnoughStock(available, required)) {
    throw new Error(
      `${itemName}: stock tidak cukup. ` +
        `Tersedia ${available}, membutuhkan ${required}.`,
    );
  }
}

// ============================================================
// BASE STOCK MUTATION
// ============================================================

/**
 * Utility untuk membuat nilai stock mutation.
 *
 * Semua nilai dianggap BASE UNIT.
 *
 * Tidak ada conversion.
 */
export function createBaseStockMutation(params: {
  stockBefore: number;
  qtyIn?: number;
  qtyOut?: number;
}) {
  const result = calculateStockAfter(params);

  return {
    stockBefore: result.stockBefore,
    qtyIn: result.qtyIn,
    qtyOut: result.qtyOut,
    stockAfter: result.stockAfter,
  };
}

// ============================================================
// SAFE PURCHASE → BASE RESULT
// ============================================================

/**
 * Helper lengkap untuk transaksi yang menerima
 * PURCHASE UNIT tetapi harus menghasilkan stock BASE UNIT.
 *
 * Contoh:
 *
 *   purchaseQty = 4.3
 *   purchaseUnit = jerigen
 *   baseUnit = gram
 *   rate = 13.000
 *
 * hasil:
 *
 *   purchaseQty = 4.3
 *   baseQty = 55.900
 *   baseUnit = gram
 */
export function convertPurchaseQtyToStock(params: {
  purchaseQty: number;
  barang: UnitConvertibleItem | null | undefined;
}) {
  const purchaseQty = roundQty(
    params.purchaseQty,
  );

  const baseQty = toBaseQty(
    purchaseQty,
    params.barang,
  );

  return {
    purchaseQty,

    purchaseUnit: getPurchaseUnit(
      params.barang,
    ),

    baseQty,

    baseUnit: getBaseUnit(
      params.barang,
    ),

    conversionRate: getConversionRate(
      params.barang,
    ),
  };
}

// ============================================================
// SAFE BASE STOCK RESULT
// ============================================================

/**
 * Helper untuk module yang sudah bekerja dengan BASE UNIT.
 *
 * Digunakan oleh:
 *
 * - Manufacture
 * - Waste
 * - POS
 * - Stock Adjustment
 * - Stock Mutation
 *
 * Tidak melakukan conversion.
 */
export function createBaseQty(
  qty: number,
  baseUnit?: string | null,
) {
  return {
    qty: normalizeBaseQty(qty),
    unit: String(baseUnit ?? "").trim(),
  };
}

// ============================================================
// DEBUG / INFORMATION
// ============================================================

/**
 * Menghasilkan informasi conversion tanpa mengubah
 * quantity apa pun.
 *
 * Berguna untuk logging/debugging.
 */
export function getConversionInfo(
  barang: UnitConvertibleItem | null | undefined,
) {
  const purchaseUnit = getPurchaseUnit(barang);
  const baseUnit = getBaseUnit(barang);
  const conversionRate = getConversionRate(barang);

  return {
    purchaseUnit,
    baseUnit,
    conversionRate,
    hasConversion: hasConversion(barang),

    /**
     * Contoh kalimat:
     *
     * "1 jerigen = 13000 gram"
     */
    description:
      purchaseUnit && baseUnit
        ? `1 ${purchaseUnit} = ${conversionRate} ${baseUnit}`
        : baseUnit
          ? `Stock menggunakan ${baseUnit}`
          : "Tidak ada base unit",
  };
}

// ============================================================
// EXAMPLE
// ============================================================
//
// Barang:
//
//   unit           = "jerigen"
//   baseUnit       = "gram"
//   conversionRate = 13000
//
// Purchase:
//
//   qty = 4.3
//
//   toBaseQty(4.3, barang)
//   = 55.900
//
// Stock database:
//
//   stock = 55.900
//
// Manufacture:
//
//   requiredQty = 1.000 gram
//
//   calculateStockAfter({
//     stockBefore: 55.900,
//     qtyOut: 1.000,
//   })
//
//   = 54.900 gram
//
// ------------------------------------------------------------
//
// CONTOH DOUBLE CONVERSION YANG HARUS DIHINDARI:
//
//   stock = 4 gram
//   conversionRate = 13.000
//
//   JANGAN:
//
//     toBaseQty(stock, barang)
//
//   karena akan menjadi:
//
//     4 × 13.000
//     = 52.000 gram
//
//   Yang benar:
//
//     normalizeStock(4)
//     = 4 gram
//
// ------------------------------------------------------------
//
// CONTOH BOM SUDAH BASE UNIT:
//
//   qty  = 4
//   unit = "gram"
//   base = "gram"
//
//   convertBomQtyToBase({
//     qty: 4,
//     unit: "gram",
//     barang,
//   })
//
//   = 4 gram
//
//   TIDAK menjadi 52.000 gram.
//
// ============================================================