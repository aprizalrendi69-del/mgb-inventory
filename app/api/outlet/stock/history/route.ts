import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * GET /api/outlet/stock/history
 *
 * FINAL HISTORY STOCK OUTLET
 * =========================================================
 *
 * TUJUAN:
 *
 * API ini hanya membaca transaksi yang benar-benar
 * berhubungan dengan perubahan stock outlet.
 *
 * BARANG MASUK:
 *
 * 1. OutletReceiptItem
 *    Supplier -> Outlet
 *
 * 2. OutletTransferItem
 *    Pusat / Outlet lain -> Outlet
 *
 * 3. StockCard MANUFACTURE_OUTPUT
 *    Manufacture outlet -> menghasilkan stock
 *
 * 4. OutletAdjustmentItem type IN
 *    Adjustment APPROVED -> stock bertambah
 *
 * BARANG KELUAR:
 *
 * 5. StockCard POS_OUT
 *    Penjualan POS outlet
 *
 * 6. StockCard MANUFACTURE_CONSUME
 *    Pemakaian bahan manufacture outlet
 *
 * 7. OutletStockOut
 *    Pemakaian / waste outlet
 *
 * 8. OutletAdjustmentItem type OUT
 *    Adjustment APPROVED -> stock berkurang
 *
 * STOCK OPNAME:
 *
 * 9. StockOpnameItem
 *
 *    HANYA:
 *    - opname APPROVED
 *    - memiliki selisih stock
 *
 *    Jika difference = 0:
 *    -> TIDAK dianggap movement
 *    -> TIDAK ditampilkan
 *
 *    Jika difference > 0:
 *    -> IN
 *
 *    Jika difference < 0:
 *    -> OUT
 *
 * YANG TIDAK DIMASUKKAN:
 *
 * - OutletPurchaseItem / PO
 * - DeliveryItem
 * - StockMutation
 * - StockOpnameHistory
 * - data pending / draft yang belum mengubah stock
 * - adjustment selain APPROVED
 * - transfer yang belum diterima
 * - stock out selain APPROVED
 * - manufacture pusat
 * - StockCard pusat
 * - opname APPROVED dengan difference = 0
 *
 * =========================================================
 *
 * HARGA TERAKHIR
 *
 * Harga yang dikirim ke frontend:
 *
 * PRIORITAS:
 *
 * 1. OutletReceiptItem.price
 *    -> transaksi supplier -> outlet yang sudah received
 *
 * 2. StockCard MANUFACTURE_OUTPUT.unitPrice
 *    -> cost base unit
 *    -> dikonversi menjadi harga per Barang.unit
 *
 * 3. OutletAdjustmentItem.price
 *    -> adjustment IN APPROVED
 *    -> dianggap cost base unit
 *    -> dikonversi menjadi harga per Barang.unit
 *
 * 4. OutletBarang.harga
 *    -> fallback harga master outlet
 *
 * 5. Barang.purchasePrice
 *    -> fallback master barang
 *
 * OutletTransferItem TIDAK memiliki field harga pada schema.
 * Karena itu harga transfer tidak ditebak.
 *
 * Harga dikembalikan dalam satuan Barang.unit karena:
 *
 * OutletStock.stock
 * -> menggunakan Barang.unit
 *
 * Contoh:
 *
 * Barang:
 * unit = botol
 * baseUnit = ml
 * conversionRate = 650
 *
 * Harga receipt:
 * Rp 20.000 / botol
 *
 * Maka:
 * lastPurchasePrice = 20.000
 *
 * Untuk StockCard yang unitPrice = Rp 30 / ml:
 *
 * 30 x 650 = Rp 19.500 / botol
 *
 * =========================================================
 *
 * RESPONSE PRICE ALIASES
 *
 * Agar kompatibel dengan berbagai frontend:
 *
 * lastPurchasePrice
 * price
 * unitPrice
 * purchasePrice
 * costPrice
 * transactionPrice
 *
 * semuanya berisi harga terakhir per Barang.unit.
 *
 * =========================================================
 *
 * FILTER SERVER-SIDE
 *
 * API menerima:
 *
 * direction:
 *   ALL
 *   IN
 *   OUT
 *
 * type:
 *   ALL
 *   POS_OUT
 *   MANUFACTURE_CONSUME
 *   MANUFACTURE_OUTPUT
 *   OUTLET_RECEIPT
 *   TRANSFER_IN
 *   STOCK_OUT
 *   OUTLET_ADJUSTMENT
 *   STOCK_OPNAME
 *
 * status:
 *   ALL
 *   APPROVED
 *   RECEIVED
 *   COMPLETED
 *   RELEASED
 *   dll
 *
 * =========================================================
 *
 * KOMPATIBILITAS FRONTEND
 *
 * Frontend boleh mengirim:
 *
 * ?outletId=1
 * &scope=ALL
 * &includeAll=true
 * &includeAllSources=true
 * &includeAllTypes=true
 * &direction=ALL
 * &limit=10000
 *
 * Parameter legacy tersebut diterima dan tidak menyebabkan
 * HTTP 400.
 *
 * =========================================================
 *
 * SATUAN
 *
 * Stock movement internal:
 *   BASE UNIT
 *
 * Barang:
 *   unit            = satuan transaksi
 *   baseUnit        = satuan dasar
 *   conversionRate  = konversi
 *
 * Contoh:
 *
 * 1 Dus = 24 PCS
 *
 * StockCard:
 *   qtyOut = 48
 *
 * History:
 *   baseQty        = 48 PCS
 *   transactionQty = 2 Dus
 *
 * OutletAdjustmentItem.qty:
 *   SUDAH BASE UNIT
 *
 * Jangan dikalikan conversionRate lagi.
 *
 * =========================================================
 */

type HistoryDirection = "IN" | "OUT";

type PriceSource =
  | "OUTLET_RECEIPT"
  | "MANUFACTURE_OUTPUT"
  | "OUTLET_ADJUSTMENT"
  | "OUTLET_BARANG"
  | "BARANG_MASTER"
  | null;

type BarangUnitInfo = {
  id: number;
  code: string;
  name: string;
  unit: string;
  baseUnit: string | null;
  conversionRate: number;
  barcode: string | null;
};

type HistoryRow = {
  id: string;
  date: Date;
  type: string;
  direction: HistoryDirection;
  number: string | null;

  outletId: number | null;
  barangId: number;

  /*
   * SEMUA QTY MOVEMENT DALAM BASE UNIT.
   */
  qty: number;

  /*
   * QTY DALAM SATUAN TRANSAKSI.
   */
  transactionQty: number | null;

  transactionUnit: string | null;

  stockBefore: number | null;
  stockAfter: number | null;

  status: string | null;
  description: string | null;
  source: string;

  /*
   * Harga transaksi row jika tersedia.
   *
   * Tidak wajib diisi oleh setiap source.
   */
  price?: number | null;
};

type PriceSnapshot = {
  price: number;
  date: Date;
  source: Exclude<PriceSource, null>;
};

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function getConversionRate(
  barang: BarangUnitInfo
): number {
  const rate = Number(barang.conversionRate);

  if (!Number.isFinite(rate) || rate <= 0) {
    return 1;
  }

  return rate;
}

function getTransactionUnit(
  barang: BarangUnitInfo
): string {
  return (
    barang.unit?.trim() ||
    barang.baseUnit?.trim() ||
    ""
  );
}

function getBaseUnit(
  barang: BarangUnitInfo
): string {
  return (
    barang.baseUnit?.trim() ||
    barang.unit?.trim() ||
    ""
  );
}

/*
 * TRANSACTION UNIT -> BASE UNIT
 *
 * Dipakai untuk:
 * - OutletReceiptItem
 * - OutletTransferItem
 * - OutletStockOut
 *
 * Sumber tersebut menyimpan qty dalam satuan transaksi.
 */
function toBaseQty(
  qty: number,
  barang: BarangUnitInfo
): number {
  const safeQty = Number(qty);

  if (!Number.isFinite(safeQty)) {
    return 0;
  }

  return (
    safeQty *
    getConversionRate(barang)
  );
}

/*
 * BASE UNIT -> TRANSACTION UNIT
 *
 * Dipakai untuk:
 * - StockCard
 * - OutletAdjustmentItem
 * - StockOpname
 *
 * karena sumber tersebut sudah menggunakan BASE UNIT.
 */
function fromBaseQty(
  qty: number,
  barang: BarangUnitInfo
): number {
  const safeQty = Number(qty);

  if (!Number.isFinite(safeQty)) {
    return 0;
  }

  const rate =
    getConversionRate(barang);

  if (rate <= 0) {
    return safeQty;
  }

  return safeQty / rate;
}

function roundQty(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return (
    Math.round(
      (value + Number.EPSILON) *
        1000000
    ) / 1000000
  );
}

function roundPrice(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return (
    Math.round(
      (value + Number.EPSILON) *
        100
    ) / 100
  );
}

/*
 * Harga sumber yang berupa BASE UNIT
 * dikonversi menjadi harga Barang.unit.
 *
 * Contoh:
 *
 * 1 botol = 650 ml
 *
 * cost = Rp30/ml
 *
 * harga per botol:
 * 30 x 650 = Rp19.500
 */
function baseUnitPriceToTransactionUnitPrice(
  price: number,
  barang: BarangUnitInfo
): number {
  const safePrice =
    Number(price);

  if (
    !Number.isFinite(
      safePrice
    ) ||
    safePrice <= 0
  ) {
    return 0;
  }

  return roundPrice(
    safePrice *
      getConversionRate(
        barang
      )
  );
}

/*
 * =========================================================
 * PRICE MAP HELPERS
 * =========================================================
 */

function makePriceKey(
  outletId: number | null,
  barangId: number
): string {
  return `${outletId ?? "NULL"}:${barangId}`;
}

function isValidPrice(
  value: unknown
): value is number {
  const price =
    Number(value);

  return (
    Number.isFinite(
      price
    ) &&
    price > 0
  );
}

function setLatestPrice(
  map: Map<string, PriceSnapshot>,
  outletId: number | null,
  barangId: number,
  price: number,
  date: Date,
  source: Exclude<
    PriceSource,
    null
  >
) {
  if (
    !isValidPrice(price)
  ) {
    return;
  }

  const key =
    makePriceKey(
      outletId,
      barangId
    );

  const existing =
    map.get(key);

  /*
   * Hanya transaksi yang lebih baru
   * yang boleh menggantikan harga lama.
   */
  if (
    existing &&
    existing.date.getTime() >=
      date.getTime()
  ) {
    return;
  }

  map.set(
    key,
    {
      price:
        roundPrice(price),
      date,
      source,
    }
  );
}

/*
 * =========================================================
 * FILTER HELPERS
 * =========================================================
 */

function normalizeFilter(
  value: string | null
): string | null {
  if (value === null) {
    return null;
  }

  const normalized =
    value.trim().toUpperCase();

  if (
    !normalized ||
    normalized === "ALL"
  ) {
    return null;
  }

  return normalized;
}

/*
 * =========================================================
 * GET
 * =========================================================
 */

export async function GET(
  req: NextRequest
) {
  try {
    // =====================================================
    // 1. SESSION
    // =====================================================

    const cookieStore =
      await cookies();

    const session =
      cookieStore.get(
        "erp-session"
      );

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        {
          status: 401,
        }
      );
    }

    // =====================================================
    // 2. PARSE SESSION
    // =====================================================

    let sessionData: any;

    try {
      sessionData =
        JSON.parse(
          session.value
        );
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    const userId =
      Number(sessionData?.id);

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    // =====================================================
    // 3. USER
    // =====================================================

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
          fullname: true,
          role: true,
          active: true,
          outletId: true,

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
          },
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =====================================================
    // 4. USER ACTIVE
    // =====================================================

    if (!user.active) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User tidak aktif",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // 5. ROLE
    // =====================================================

    const allowedRoles = [
      "ADMIN",
      "MANAGER",
      "OUTLET_ADMIN",
    ];

    if (
      !allowedRoles.includes(
        user.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses history stock outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // 6. QUERY PARAMETER
    // =====================================================

    const {
      searchParams,
    } = new URL(req.url);

    const outletIdParam =
      searchParams.get(
        "outletId"
      );

    const barangIdParam =
      searchParams.get(
        "barangId"
      );

    const limitParam =
      searchParams.get(
        "limit"
      );

    /*
     * Filter utama.
     *
     * ALL -> null
     * sehingga tidak membatasi filter.
     */
    const directionFilter =
      normalizeFilter(
        searchParams.get(
          "direction"
        )
      );

    const typeFilter =
      normalizeFilter(
        searchParams.get(
          "type"
        )
      );

    const statusFilter =
      normalizeFilter(
        searchParams.get(
          "status"
        )
      );

    /*
     * Parameter frontend lama.
     *
     * Sengaja dibaca agar:
     *
     * scope=ALL
     * includeAll=true
     * includeAllSources=true
     * includeAllTypes=true
     *
     * tidak menyebabkan 400.
     */
    const scopeParam =
      searchParams.get(
        "scope"
      );

    const includeAll =
      searchParams.get(
        "includeAll"
      );

    const includeAllSources =
      searchParams.get(
        "includeAllSources"
      );

    const includeAllTypes =
      searchParams.get(
        "includeAllTypes"
      );

    // =====================================================
    // 7. VALIDATE BARANG ID
    // =====================================================

    let barangId:
      | number
      | null = null;

    if (
      barangIdParam !== null
    ) {
      const parsedBarangId =
        Number(
          barangIdParam
        );

      if (
        !Number.isInteger(
          parsedBarangId
        ) ||
        parsedBarangId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Barang ID tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      barangId =
        parsedBarangId;
    }

    // =====================================================
    // 8. LIMIT
    // =====================================================

    let limit = 500;

    if (
      limitParam !== null
    ) {
      const parsedLimit =
        Number(
          limitParam
        );

      if (
        !Number.isInteger(
          parsedLimit
        ) ||
        parsedLimit <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Limit tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      /*
       * Frontend stock saat ini menggunakan
       * limit=10000.
       *
       * Izinkan sampai 10000.
       */
      limit =
        Math.min(
          parsedLimit,
          10000
        );
    }

    // =====================================================
    // 9. VALIDATE DIRECTION
    // =====================================================

    if (
      directionFilter !== null &&
      directionFilter !== "IN" &&
      directionFilter !== "OUT"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Direction tidak valid. Gunakan IN, OUT, atau ALL",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // 10. OUTLET SCOPE
    // =====================================================

    let outletId:
      | number
      | null = null;

    /*
     * OUTLET_ADMIN:
     *
     * selalu dikunci ke outlet session.
     *
     * Query outletId dari browser diabaikan.
     */
    if (
      user.role ===
      "OUTLET_ADMIN"
    ) {
      if (
        !user.outletId ||
        !Number.isInteger(
          user.outletId
        ) ||
        user.outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum terhubung dengan outlet",
          },
          {
            status: 400,
          }
        );
      }

      outletId =
        user.outletId;
    }

    /*
     * ADMIN / MANAGER:
     *
     * boleh memilih outlet.
     */
    if (
      user.role ===
        "ADMIN" ||
      user.role ===
        "MANAGER"
    ) {
      if (
        outletIdParam !== null
      ) {
        const parsedOutletId =
          Number(
            outletIdParam
          );

        if (
          !Number.isInteger(
            parsedOutletId
          ) ||
          parsedOutletId <= 0
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Outlet ID tidak valid",
            },
            {
              status: 400,
            }
          );
        }

        outletId =
          parsedOutletId;
      }
    }

    // =====================================================
    // 11. VALIDATE OUTLET
    // =====================================================

    let selectedOutlet:
      | {
          id: number;
          code: string;
          name: string;
          active: boolean;
        }
      | null = null;

    if (
      outletId !== null
    ) {
      selectedOutlet =
        await prisma.outlet.findUnique(
          {
            where: {
              id: outletId,
            },

            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
          }
        );

      if (!selectedOutlet) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }

      if (
        !selectedOutlet.active
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet sedang tidak aktif",
          },
          {
            status: 400,
          }
        );
      }
    }

    // =====================================================
    // 12. VALIDATE BARANG
    // =====================================================

    let selectedBarang:
      | BarangUnitInfo
      | null = null;

    if (
      barangId !== null
    ) {
      selectedBarang =
        await prisma.barang.findUnique(
          {
            where: {
              id: barangId,
            },

            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
              baseUnit: true,
              conversionRate: true,
              barcode: true,
            },
          }
        );

      if (!selectedBarang) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Barang tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }
    }

    // =====================================================
    // 13. HISTORY
    // =====================================================

    const history:
      HistoryRow[] = [];

    // =====================================================
    // 14. OUTLET RECEIPT
    //
    // SUPPLIER -> OUTLET
    //
    // Ini adalah STOCK IN.
    //
    // Receipt item sudah diterima sehingga
    // dianggap benar-benar masuk stock.
    //
    // PRICE:
    // OutletReceiptItem.price adalah harga transaksi
    // per Barang.unit.
    // =====================================================

    const receiptWhere: any =
      {};

    if (
      outletId !== null
    ) {
      receiptWhere.receipt = {
        outletId,
        purchase: {
          status:
            "RECEIVED",
        },
      };
    } else {
      receiptWhere.receipt = {
        purchase: {
          status:
            "RECEIVED",
        },
      };
    }

    if (
      barangId !== null
    ) {
      receiptWhere.barangId =
        barangId;
    }

    const receiptItems =
      await prisma.outletReceiptItem.findMany(
        {
          where:
            receiptWhere,

          select: {
            id: true,
            barangId: true,
            qty: true,
            price: true,

            receipt: {
              select: {
                id: true,
                number: true,
                receiptDate: true,
                remarks: true,

                purchase: {
                  select: {
                    id: true,
                    number: true,
                    status: true,
                  },
                },

                outlet: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },

                supplier: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
              },
            },

            barang: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                baseUnit: true,
                conversionRate: true,
                barcode: true,
              },
            },
          },

          orderBy: {
            receipt: {
              receiptDate:
                "desc",
            },
          },
        }
      );

    for (
      const item of
        receiptItems
    ) {
      const barang =
        item.barang as BarangUnitInfo;

      const transactionQty =
        Number(item.qty);

      const baseQty =
        toBaseQty(
          transactionQty,
          barang
        );

      if (
        baseQty <= 0
      ) {
        continue;
      }

      const transactionPrice =
        Number(item.price);

      history.push({
        id:
          `OUTLET_RECEIPT-${item.id}`,

        date:
          item.receipt
            .receiptDate,

        type:
          "OUTLET_RECEIPT",

        direction:
          "IN",

        number:
          item.receipt
            .number,

        outletId:
          item.receipt
            .outlet.id,

        barangId:
          item.barangId,

        qty:
          baseQty,

        transactionQty,

        transactionUnit:
          getTransactionUnit(
            barang
          ),

        stockBefore:
          null,

        stockAfter:
          null,

        status:
          "RECEIVED",

        description:
          item.receipt
            .supplier
            ? `Barang masuk dari supplier ${item.receipt.supplier.name}`
            : "Barang masuk dari supplier",

        source:
          "OutletReceiptItem",

        /*
         * Harga receipt sudah merupakan
         * harga per Barang.unit.
         */
        price:
          isValidPrice(
            transactionPrice
          )
            ? roundPrice(
                transactionPrice
              )
            : null,
      });
    }

    // =====================================================
    // 15. OUTLET TRANSFER
    //
    // PUSAT / OUTLET LAIN -> OUTLET
    //
    // HANYA receivedQty > 0.
    //
    // OutletTransferItem tidak memiliki field price.
    // Karena itu harga tidak ditebak dari transfer.
    // Harga terakhir tetap berasal dari transaksi
    // incoming berharga yang paling baru.
    // =====================================================

    const transferWhere: any =
      {};

    if (
      outletId !== null
    ) {
      transferWhere.transfer = {
        outletId,
      };
    }

    if (
      barangId !== null
    ) {
      transferWhere.barangId =
        barangId;
    }

    const transferItems =
      await prisma.outletTransferItem.findMany(
        {
          where:
            transferWhere,

          select: {
            id: true,
            barangId: true,
            qty: true,
            receivedQty: true,
            voided: true,

            transfer: {
              select: {
                id: true,
                number: true,
                transferDate: true,
                status: true,
                remarks: true,

                sourceOutlet: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },

                outlet: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
              },
            },

            barang: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                baseUnit: true,
                conversionRate: true,
                barcode: true,
              },
            },
          },

          orderBy: {
            transfer: {
              transferDate:
                "desc",
            },
          },
        }
      );

    for (
      const item of
        transferItems
    ) {
      /*
       * VOID tidak pernah menjadi
       * stock movement.
       */
      if (item.voided) {
        continue;
      }

      const receivedQty =
        Number(
          item.receivedQty
        );

      if (
        receivedQty <= 0
      ) {
        continue;
      }

      const barang =
        item.barang as BarangUnitInfo;

      const baseQty =
        toBaseQty(
          receivedQty,
          barang
        );

      if (
        baseQty <= 0
      ) {
        continue;
      }

      const sourceName =
        item.transfer
          .sourceOutlet
          ?.name ||
        "Gudang Pusat";

      history.push({
        id:
          `TRANSFER-${item.id}`,

        date:
          item.transfer
            .transferDate,

        type:
          "TRANSFER_IN",

        direction:
          "IN",

        number:
          item.transfer
            .number,

        outletId:
          item.transfer
            .outlet.id,

        barangId:
          item.barangId,

        qty:
          baseQty,

        transactionQty:
          receivedQty,

        transactionUnit:
          getTransactionUnit(
            barang
          ),

        stockBefore:
          null,

        stockAfter:
          null,

        status:
          item.transfer
            .status,

        description:
          `Barang masuk dari ${sourceName}`,

        source:
          "OutletTransferItem",
      });
    }

    // =====================================================
    // 16. STOCKCARD
    //
    // HANYA:
    //
    // POS_OUT
    // MANUFACTURE_CONSUME
    // MANUFACTURE_OUTPUT
    //
    // StockCard TIDAK punya outletId.
    //
    // POS:
    // StockCard.trxNumber
    // -> OutletSale.number
    //
    // Manufacture:
    // StockCard.trxNumber
    // -> ManufactureOrder.number
    //
    // ManufactureOrder.outletId harus NOT NULL.
    // =====================================================

    const stockCardWhere: any =
      {
        trxType: {
          in: [
            "POS_OUT",
            "MANUFACTURE_CONSUME",
            "MANUFACTURE_OUTPUT",
          ],
        },
      };

    if (
      barangId !== null
    ) {
      stockCardWhere.barangId =
        barangId;
    }

    /*
     * Kalau type filter spesifik dan termasuk
     * StockCard, batasi query dari awal.
     *
     * Ini tetap server-side.
     */
    if (
      typeFilter &&
      [
        "POS_OUT",
        "MANUFACTURE_CONSUME",
        "MANUFACTURE_OUTPUT",
      ].includes(
        typeFilter
      )
    ) {
      stockCardWhere.trxType =
        typeFilter;
    }

    /*
     * Kalau typeFilter adalah sumber lain,
     * StockCard tidak perlu query sama sekali.
     */
    const shouldLoadStockCard =
      !typeFilter ||
      [
        "POS_OUT",
        "MANUFACTURE_CONSUME",
        "MANUFACTURE_OUTPUT",
      ].includes(
        typeFilter
      );

    const stockCards =
      shouldLoadStockCard
        ? await prisma.stockCard.findMany(
            {
              where:
                stockCardWhere,

              select: {
                id: true,
                barangId: true,
                trxDate: true,
                trxType: true,
                trxNumber: true,
                referenceId: true,
                warehouse: true,
                qtyIn: true,
                qtyOut: true,
                balance: true,
                unitPrice: true,
                totalValue: true,
                note: true,

                barang: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    unit: true,
                    baseUnit: true,
                    conversionRate: true,
                    barcode: true,
                  },
                },
              },

              orderBy: {
                trxDate:
                  "desc",
              },
            }
          )
        : [];

    // =====================================================
    // 16A. NOMOR POS
    // =====================================================

    const posNumbers = [
      ...new Set(
        stockCards
          .filter(
            (card) =>
              card.trxType ===
              "POS_OUT"
          )
          .map(
            (card) =>
              card.trxNumber
          )
          .filter(Boolean)
      ),
    ];

    // =====================================================
    // 16B. NOMOR MANUFACTURE
    // =====================================================

    const manufactureNumbers = [
      ...new Set(
        stockCards
          .filter(
            (card) =>
              card.trxType ===
                "MANUFACTURE_CONSUME" ||
              card.trxType ===
                "MANUFACTURE_OUTPUT"
          )
          .map(
            (card) =>
              card.trxNumber
          )
          .filter(Boolean)
      ),
    ];

    // =====================================================
    // 16C. LOAD POS
    // =====================================================

    const outletSales =
      posNumbers.length > 0
        ? await prisma.outletSale.findMany(
            {
              where: {
                number: {
                  in: posNumbers,
                },

                ...(outletId !==
                null
                  ? {
                      outletId,
                    }
                  : {}),
              },

              select: {
                id: true,
                number: true,
                outletId: true,
                saleDate: true,
                status: true,
                voidedAt: true,
                voidReason: true,

                outlet: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
              },
            }
          )
        : [];

    const outletSaleMap =
      new Map<
        string,
        (typeof outletSales)[number]
      >(
        outletSales.map(
          (sale) => [
            sale.number,
            sale,
          ]
        )
      );

    // =====================================================
    // 16D. LOAD MANUFACTURE
    // =====================================================

    const manufactureOrders =
      manufactureNumbers.length >
      0
        ? await prisma.manufactureOrder.findMany(
            {
              where: {
                number: {
                  in:
                    manufactureNumbers,
                },

                outletId: {
                  not: null,
                },

                ...(outletId !==
                null
                  ? {
                      outletId,
                    }
                  : {}),
              },

              select: {
                id: true,
                number: true,
                outletId: true,
                plannedQty: true,
                producedQty: true,
                status: true,
                productionDate: true,
                note: true,

                outlet: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },

                recipe: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    outputQty:
                      true,

                    outputBarang: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            }
          )
        : [];

    const manufactureMap =
      new Map<
        string,
        (typeof manufactureOrders)[number]
      >(
        manufactureOrders.map(
          (order) => [
            order.number,
            order,
          ]
        )
      );

    // =====================================================
    // 16E. PROCESS STOCKCARD
    // =====================================================

    for (
      const card of
        stockCards
    ) {
      const trxType =
        String(
          card.trxType || ""
        )
          .trim()
          .toUpperCase();

      // ===================================================
      // POS OUT
      // ===================================================

      if (
        trxType ===
        "POS_OUT"
      ) {
        const sale =
          outletSaleMap.get(
            card.trxNumber
          );

        /*
         * Tidak ditemukan OutletSale:
         * kemungkinan StockCard pusat.
         *
         * Jangan masukkan.
         */
        if (!sale) {
          continue;
        }

        const qtyOut =
          Number(
            card.qtyOut
          );

        if (
          qtyOut <= 0
        ) {
          continue;
        }

        const barang =
          card.barang as BarangUnitInfo;

        history.push({
          id:
            `STOCKCARD-POS-${card.id}`,

          date:
            card.trxDate,

          type:
            "POS_OUT",

          direction:
            "OUT",

          number:
            card.trxNumber,

          outletId:
            sale.outletId,

          barangId:
            card.barangId,

          qty:
            qtyOut,

          transactionQty:
            roundQty(
              fromBaseQty(
                qtyOut,
                barang
              )
            ),

          transactionUnit:
            getTransactionUnit(
              barang
            ),

          stockBefore:
            null,

          stockAfter:
            null,

          status:
            sale.status,

          description:
            card.note ||
            `Pemakaian POS ${sale.number}`,

          source:
            "StockCard",

          /*
           * POS adalah OUT.
           * Harga tidak dijadikan sumber
           * last purchase price.
           */
          price:
            null,
        });

        continue;
      }

      // ===================================================
      // MANUFACTURE
      // ===================================================

      if (
        trxType ===
          "MANUFACTURE_CONSUME" ||
        trxType ===
          "MANUFACTURE_OUTPUT"
      ) {
        const order =
          manufactureMap.get(
            card.trxNumber
          );

        /*
         * Manufacture pusat:
         * outletId null -> jangan masuk.
         */
        if (
          !order ||
          order.outletId === null
        ) {
          continue;
        }

        const barang =
          card.barang as BarangUnitInfo;

        // ===============================================
        // CONSUME
        // ===============================================

        if (
          trxType ===
          "MANUFACTURE_CONSUME"
        ) {
          const qtyOut =
            Number(
              card.qtyOut
            );

          if (
            qtyOut <= 0
          ) {
            continue;
          }

          history.push({
            id:
              `STOCKCARD-MANUFACTURE-CONSUME-${card.id}`,

            date:
              card.trxDate,

            type:
              "MANUFACTURE_CONSUME",

            direction:
              "OUT",

            number:
              card.trxNumber,

            outletId:
              order.outletId,

            barangId:
              card.barangId,

            qty:
              qtyOut,

            transactionQty:
              roundQty(
                fromBaseQty(
                  qtyOut,
                  barang
                )
              ),

            transactionUnit:
              getTransactionUnit(
                barang
              ),

            stockBefore:
              null,

            stockAfter:
              null,

            status:
              order.status,

            description:
              card.note ||
              `Konsumsi bahan manufacture ${order.number}`,

            source:
              "StockCard",

            price:
              null,
          });

          continue;
        }

        // ===============================================
        // OUTPUT
        // ===============================================

        if (
          trxType ===
          "MANUFACTURE_OUTPUT"
        ) {
          const qtyIn =
            Number(
              card.qtyIn
            );

          if (
            qtyIn <= 0
          ) {
            continue;
          }

          history.push({
            id:
              `STOCKCARD-MANUFACTURE-OUTPUT-${card.id}`,

            date:
              card.trxDate,

            type:
              "MANUFACTURE_OUTPUT",

            direction:
              "IN",

            number:
              card.trxNumber,

            outletId:
              order.outletId,

            barangId:
              card.barangId,

            qty:
              qtyIn,

            transactionQty:
              roundQty(
                fromBaseQty(
                  qtyIn,
                  barang
                )
              ),

            transactionUnit:
              getTransactionUnit(
                barang
              ),

            stockBefore:
              null,

            stockAfter:
              null,

            status:
              order.status,

            description:
              card.note ||
              `Hasil manufacture ${order.number}`,

            source:
              "StockCard",

            /*
             * StockCard unitPrice adalah cost BASE UNIT.
             * Nanti dikonversi ke Barang.unit ketika
             * menentukan lastPurchasePrice.
             */
            price:
              isValidPrice(
                Number(
                  card.unitPrice
                )
              )
                ? baseUnitPriceToTransactionUnitPrice(
                    Number(
                      card.unitPrice
                    ),
                    barang
                  )
                : null,
          });
        }
      }
    }

    // =====================================================
    // 17. OUTLET STOCK OUT
    //
    // HANYA APPROVED.
    //
    // Ini benar-benar mengurangi stock outlet.
    // =====================================================

    const stockOutWhere: any =
      {};

    if (
      outletId !== null
    ) {
      stockOutWhere.outletId =
        outletId;
    }

    if (
      barangId !== null
    ) {
      stockOutWhere.barangId =
        barangId;
    }

    const shouldLoadStockOut =
      !typeFilter ||
      typeFilter ===
        "STOCK_OUT";

    const stockOuts =
      shouldLoadStockOut
        ? await prisma.outletStockOut.findMany(
            {
              where:
                stockOutWhere,

              select: {
                id: true,
                number: true,
                barangId: true,
                trxDate: true,
                type: true,
                status: true,
                qtyProcessed:
                  true,
                wasteQty: true,
                netQty: true,
                unitCost: true,
                totalCost: true,
                note: true,
                outletId: true,

                outlet: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },

                barang: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    unit: true,
                    baseUnit: true,
                    conversionRate:
                      true,
                    barcode: true,
                  },
                },

                user: {
                  select: {
                    id: true,
                    fullname: true,
                  },
                },
              },

              orderBy: {
                trxDate:
                  "desc",
              },
            }
          )
        : [];

    for (
      const item of
        stockOuts
    ) {
      /*
       * HANYA APPROVED
       */
      if (
        String(
          item.status
        )
          .trim()
          .toUpperCase() !==
        "APPROVED"
      ) {
        continue;
      }

      const transactionQty =
        Number(
          item.netQty
        ) > 0
          ? Number(
              item.netQty
            )
          : Number(
              item.qtyProcessed
            );

      if (
        transactionQty <= 0
      ) {
        continue;
      }

      const barang =
        item.barang as BarangUnitInfo;

      const baseQty =
        toBaseQty(
          transactionQty,
          barang
        );

      if (
        baseQty <= 0
      ) {
        continue;
      }

      history.push({
        id:
          `STOCK_OUT-${item.id}`,

        date:
          item.trxDate,

        type:
          "STOCK_OUT",

        direction:
          "OUT",

        number:
          item.number,

        outletId:
          item.outletId,

        barangId:
          item.barangId,

        qty:
          baseQty,

        transactionQty,

        transactionUnit:
          getTransactionUnit(
            barang
          ),

        stockBefore:
          null,

        stockAfter:
          null,

        status:
          "APPROVED",

        description:
          item.note ||
          `Pemakaian / ${item.type}`,

        source:
          "OutletStockOut",

        price:
          null,
      });
    }

    // =====================================================
    // 18. OUTLET ADJUSTMENT
    //
    // HANYA APPROVED.
    //
    // qty SUDAH BASE UNIT.
    //
    // IN  -> STOCK IN
    // OUT -> STOCK OUT
    //
    // Tidak ada double conversion.
    // =====================================================

    const adjustmentItemWhere: any =
      {
        adjustment: {
          status:
            "APPROVED",
        },
      };

    if (
      outletId !== null
    ) {
      adjustmentItemWhere
        .adjustment.outletId =
        outletId;
    }

    if (
      barangId !== null
    ) {
      adjustmentItemWhere.barangId =
        barangId;
    }

    const shouldLoadAdjustment =
      !typeFilter ||
      typeFilter ===
        "OUTLET_ADJUSTMENT";

    const adjustmentItems =
      shouldLoadAdjustment
        ? await prisma.outletAdjustmentItem.findMany(
            {
              where:
                adjustmentItemWhere,

              select: {
                id: true,
                outletAdjustmentId:
                  true,
                barangId: true,
                qty: true,
                price: true,
                type: true,

                adjustment: {
                  select: {
                    id: true,
                    number: true,
                    outletId: true,
                    adjustmentDate:
                      true,
                    type: true,
                    reason: true,
                    remarks: true,
                    status: true,

                    outlet: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                      },
                    },
                  },
                },

                barang: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    unit: true,
                    baseUnit: true,
                    conversionRate:
                      true,
                    barcode: true,
                  },
                },
              },

              orderBy: {
                adjustment: {
                  adjustmentDate:
                    "desc",
                },
              },
            }
          )
        : [];

    for (
      const item of
        adjustmentItems
    ) {
      if (
        String(
          item.adjustment
            .status
        )
          .trim()
          .toUpperCase() !==
        "APPROVED"
      ) {
        continue;
      }

      /*
       * QTY SUDAH BASE UNIT.
       */
      const baseQty =
        Number(item.qty);

      if (
        !Number.isFinite(
          baseQty
        ) ||
        baseQty <= 0
      ) {
        continue;
      }

      const barang =
        item.barang as BarangUnitInfo;

      const adjustmentType =
        String(
          item.type ||
            item.adjustment
              .type ||
            ""
        )
          .trim()
          .toUpperCase();

      if (
        adjustmentType !==
          "IN" &&
        adjustmentType !==
          "OUT"
      ) {
        continue;
      }

      const direction:
        HistoryDirection =
        adjustmentType ===
        "IN"
          ? "IN"
          : "OUT";

      const transactionQty =
        fromBaseQty(
          baseQty,
          barang
        );

      const reason =
        item.adjustment
          .reason
          ?.trim();

      const remarks =
        item.adjustment
          .remarks
          ?.trim();

      let description =
        direction ===
        "IN"
          ? "Adjustment penambahan stock outlet"
          : "Adjustment pengurangan stock outlet";

      if (reason) {
        description +=
          ` - ${reason}`;
      }

      if (remarks) {
        description +=
          ` (${remarks})`;
      }

      /*
       * Adjustment IN mempunyai price.
       *
       * qty dan price disimpan sebagai BASE UNIT.
       * Jadi price dikonversi menjadi Barang.unit.
       *
       * Adjustment OUT tidak dijadikan sumber
       * last purchase price.
       */
      const adjustmentPrice =
        direction ===
        "IN" &&
        isValidPrice(
          Number(item.price)
        )
          ? baseUnitPriceToTransactionUnitPrice(
              Number(item.price),
              barang
            )
          : null;

      history.push({
        id:
          `OUTLET-ADJUSTMENT-${item.id}`,

        date:
          item.adjustment
            .adjustmentDate,

        type:
          "OUTLET_ADJUSTMENT",

        direction,

        number:
          item.adjustment
            .number,

        outletId:
          item.adjustment
            .outletId,

        barangId:
          item.barangId,

        qty:
          baseQty,

        transactionQty:
          roundQty(
            transactionQty
          ),

        transactionUnit:
          getTransactionUnit(
            barang
          ),

        stockBefore:
          null,

        stockAfter:
          null,

        status:
          "APPROVED",

        description,

        source:
          "OutletAdjustmentItem",

        price:
          adjustmentPrice,
      });
    }

    // =====================================================
    // 19. STOCK OPNAME
    //
    // HANYA APPROVED.
    //
    // HANYA YANG BENAR-BENAR MENGUBAH STOCK.
    //
    // difference = physical - system
    //
    // > 0 -> IN
    // < 0 -> OUT
    // = 0 -> tidak ditampilkan
    // =====================================================

    const opnameItemWhere: any =
      {
        opname: {
          status:
            "APPROVED",
        },
      };

    if (
      outletId !== null
    ) {
      opnameItemWhere.opname.outletId =
        outletId;
    }

    if (
      barangId !== null
    ) {
      opnameItemWhere.barangId =
        barangId;
    }

    const shouldLoadOpname =
      !typeFilter ||
      typeFilter ===
        "STOCK_OPNAME";

    const opnameItems =
      shouldLoadOpname
        ? await prisma.stockOpnameItem.findMany(
            {
              where:
                opnameItemWhere,

              select: {
                id: true,
                opnameId: true,
                barangId: true,
                systemQty: true,
                physicalQty: true,
                difference: true,
                note: true,

                barang: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    unit: true,
                    baseUnit: true,
                    conversionRate:
                      true,
                    barcode: true,
                  },
                },

                opname: {
                  select: {
                    id: true,
                    code: true,
                    date: true,
                    status: true,
                    outletId: true,

                    outlet: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                      },
                    },
                  },
                },
              },

              orderBy: {
                opname: {
                  date:
                    "desc",
                },
              },
            }
          )
        : [];

    for (
      const item of
        opnameItems
    ) {
      /*
       * Safety check.
       */
      if (
        String(
          item.opname
            .status
        )
          .trim()
          .toUpperCase() !==
        "APPROVED"
      ) {
        continue;
      }

      const systemQty =
        Number(
          item.systemQty
        );

      const physicalQty =
        Number(
          item.physicalQty
        );

      const difference =
        Number(
          item.difference
        );

      /*
       * Opname tanpa selisih TIDAK mengubah stock.
       */
      if (
        !Number.isFinite(
          difference
        ) ||
        difference === 0
      ) {
        continue;
      }

      const barang =
        item.barang as BarangUnitInfo;

      const baseUnit =
        getBaseUnit(
          barang
        );

      /*
       * StockOpnameItem umumnya menggunakan
       * BASE UNIT.
       *
       * Jadi difference juga BASE UNIT.
       */
      const baseQty =
        Math.abs(
          difference
        );

      const direction:
        HistoryDirection =
        difference > 0
          ? "IN"
          : "OUT";

      const transactionQty =
        fromBaseQty(
          baseQty,
          barang
        );

      history.push({
        id:
          `STOCK_OPNAME-${item.id}`,

        date:
          item.opname
            .date,

        type:
          "STOCK_OPNAME",

        direction,

        number:
          item.opname
            .code,

        outletId:
          item.opname
            .outletId,

        barangId:
          item.barangId,

        /*
         * qty selalu positif.
         *
         * Direction menentukan apakah
         * stock bertambah atau berkurang.
         */
        qty:
          baseQty,

        transactionQty:
          roundQty(
            transactionQty
          ),

        transactionUnit:
          baseUnit,

        /*
         * Opname:
         * systemQty -> physicalQty
         */
        stockBefore:
          systemQty,

        stockAfter:
          physicalQty,

        status:
          "APPROVED",

        description:
          item.note ||
          (
            direction ===
            "IN"
              ? `Stock opname menambah ${baseQty} ${baseUnit}: sistem ${systemQty} ${baseUnit}, fisik ${physicalQty} ${baseUnit}`
              : `Stock opname mengurangi ${baseQty} ${baseUnit}: sistem ${systemQty} ${baseUnit}, fisik ${physicalQty} ${baseUnit}`
          ),

        source:
          "StockOpnameItem",

        price:
          null,
      });
    }

    // =====================================================
    // 20. FILTER SERVER-SIDE
    //
    // Setelah masing-masing source hanya mengambil
    // transaksi stock movement yang relevan,
    // filter gabungan diterapkan di server sebelum
    // response dikirim.
    //
    // Tidak ada filtering history di frontend.
    // =====================================================

    let filteredHistory =
      history;

    // =====================================================
    // DIRECTION
    // =====================================================

    if (
      directionFilter !==
      null
    ) {
      filteredHistory =
        filteredHistory.filter(
          (item) =>
            item.direction ===
            directionFilter
        );
    }

    // =====================================================
    // TYPE
    // =====================================================

    if (
      typeFilter !== null
    ) {
      filteredHistory =
        filteredHistory.filter(
          (item) =>
            item.type ===
            typeFilter
        );
    }

    // =====================================================
    // STATUS
    // =====================================================

    if (
      statusFilter !==
      null
    ) {
      filteredHistory =
        filteredHistory.filter(
          (item) =>
            String(
              item.status ||
                ""
            )
              .trim()
              .toUpperCase() ===
            statusFilter
        );
    }

    // =====================================================
    // 21. SORT
    // =====================================================

    filteredHistory.sort(
      (a, b) =>
        b.date.getTime() -
        a.date.getTime()
    );

    // =====================================================
    // 22. TOTAL SEBELUM LIMIT
    // =====================================================

    const totalBeforeLimit =
      filteredHistory.length;

    /*
     * PENTING:
     *
     * Price lookup dilakukan berdasarkan
     * SELURUH filteredHistory sebelum limit.
     *
     * Jadi transaksi harga terbaru tidak hilang
     * hanya karena limit history kecil.
     */

    const priceBarangIds = [
      ...new Set(
        filteredHistory.map(
          (item) =>
            item.barangId
        )
      ),
    ];

    // =====================================================
    // 23. MASTER BARANG
    // =====================================================

    const barangList =
      priceBarangIds.length > 0
        ? await prisma.barang.findMany(
            {
              where: {
                id: {
                  in:
                    priceBarangIds,
                },
              },

              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                baseUnit: true,
                conversionRate:
                  true,
                barcode: true,
                purchasePrice:
                  true,
              },
            }
          )
        : [];

    /*
     * BarangUnitInfo membutuhkan field yang sama
     * dengan sebelumnya.
     *
     * purchasePrice disimpan terpisah untuk fallback.
     */
    const barangMap =
      new Map<
        number,
        BarangUnitInfo
      >(
        barangList.map(
          (barang) => [
            barang.id,
            barang as BarangUnitInfo,
          ]
        )
      );

    const barangPurchasePriceMap =
      new Map<
        number,
        number
      >(
        barangList.map(
          (barang) => [
            barang.id,
            Number(
              barang.purchasePrice
            ),
          ]
        )
      );

    // =====================================================
    // 24. LATEST TRANSACTION PRICE
    //
    // PRICE SOURCE:
    //
    // A. OutletReceiptItem
    // B. Manufacture Output
    // C. OutletAdjustment IN
    //
    // Semua dicari dari seluruh transaksi yang relevan,
    // bukan hanya row yang terkena LIMIT.
    // =====================================================

    const latestTransactionPriceMap =
      new Map<
        string,
        PriceSnapshot
      >();

    // =====================================================
    // 24A. OUTLET RECEIPT PRICE
    //
    // HANYA purchase RECEIVED.
    //
    // price sudah per Barang.unit.
    // =====================================================

    const priceReceiptWhere: any =
      {
        receipt: {
          purchase: {
            status:
              "RECEIVED",
          },
        },
        barangId: {
          in:
            priceBarangIds,
        },
      };

    if (
      outletId !== null
    ) {
      priceReceiptWhere.receipt.outletId =
        outletId;
    }

    const priceReceiptItems =
      priceBarangIds.length > 0
        ? await prisma.outletReceiptItem.findMany(
            {
              where:
                priceReceiptWhere,

              select: {
                id: true,
                barangId: true,
                price: true,

                receipt: {
                  select: {
                    receiptDate:
                      true,
                    outletId:
                      true,
                    purchase: {
                      select: {
                        status:
                          true,
                      },
                    },
                  },
                },
              },

              orderBy: {
                receipt: {
                  receiptDate:
                    "desc",
                },
              },
            }
          )
        : [];

    for (
      const item of
        priceReceiptItems
    ) {
      if (
        String(
          item.receipt
            .purchase
            .status
        )
          .trim()
          .toUpperCase() !==
        "RECEIVED"
      ) {
        continue;
      }

      const price =
        Number(
          item.price
        );

      if (
        !isValidPrice(price)
      ) {
        continue;
      }

      setLatestPrice(
        latestTransactionPriceMap,
        item.receipt
          .outletId,
        item.barangId,
        price,
        item.receipt
          .receiptDate,
        "OUTLET_RECEIPT"
      );
    }

    // =====================================================
    // 24B. OUTLET ADJUSTMENT PRICE
    //
    // HANYA:
    // - APPROVED
    // - type IN
    //
    // price dianggap BASE UNIT.
    // Konversi menjadi Barang.unit.
    // =====================================================

    const priceAdjustmentWhere: any =
      {
        adjustment: {
          status:
            "APPROVED",
        },
        type:
          "IN",
        barangId: {
          in:
            priceBarangIds,
        },
      };

    if (
      outletId !== null
    ) {
      priceAdjustmentWhere.adjustment.outletId =
        outletId;
    }

    const priceAdjustmentItems =
      priceBarangIds.length > 0
        ? await prisma.outletAdjustmentItem.findMany(
            {
              where:
                priceAdjustmentWhere,

              select: {
                id: true,
                barangId: true,
                price: true,

                adjustment: {
                  select: {
                    outletId:
                      true,
                    adjustmentDate:
                      true,
                    status:
                      true,
                    type:
                      true,
                  },
                },

                barang: {
                  select: {
                    id: true,
                    unit: true,
                    baseUnit: true,
                    conversionRate:
                      true,
                  },
                },
              },

              orderBy: {
                adjustment: {
                  adjustmentDate:
                    "desc",
                },
              },
            }
          )
        : [];

    for (
      const item of
        priceAdjustmentItems
    ) {
      if (
        String(
          item.adjustment
            .status
        )
          .trim()
          .toUpperCase() !==
        "APPROVED"
      ) {
        continue;
      }

      if (
        String(
          item.adjustment
            .type ||
            ""
        )
          .trim()
          .toUpperCase() !==
        "IN"
      ) {
        continue;
      }

      const barang =
        item.barang as BarangUnitInfo;

      const basePrice =
        Number(
          item.price
        );

      if (
        !isValidPrice(
          basePrice
        )
      ) {
        continue;
      }

      const transactionPrice =
        baseUnitPriceToTransactionUnitPrice(
          basePrice,
          barang
        );

      if (
        !isValidPrice(
          transactionPrice
        )
      ) {
        continue;
      }

      setLatestPrice(
        latestTransactionPriceMap,
        item.adjustment
          .outletId,
        item.barangId,
        transactionPrice,
        item.adjustment
          .adjustmentDate,
        "OUTLET_ADJUSTMENT"
      );
    }

    // =====================================================
    // 24C. MANUFACTURE OUTPUT PRICE
    //
    // StockCard:
    //   trxType = MANUFACTURE_OUTPUT
    //
    // StockCard tidak punya outletId.
    //
    // Cocokkan:
    // StockCard.trxNumber
    // ->
    // ManufactureOrder.number
    //
    // Hanya ManufactureOrder outlet yang dipakai.
    //
    // unitPrice StockCard dianggap BASE UNIT.
    // Konversi menjadi Barang.unit.
    // =====================================================

    if (
      priceBarangIds.length > 0
    ) {
      const manufacturePriceCards =
        await prisma.stockCard.findMany(
          {
            where: {
              trxType:
                "MANUFACTURE_OUTPUT",

              barangId: {
                in:
                  priceBarangIds,
              },
            },

            select: {
              id: true,
              barangId: true,
              trxDate: true,
              trxNumber: true,
              unitPrice: true,
              qtyIn: true,

              barang: {
                select: {
                  id: true,
                  unit: true,
                  baseUnit: true,
                  conversionRate:
                    true,
                },
              },
            },

            orderBy: {
              trxDate:
                "desc",
            },
          }
        );

      const manufacturePriceNumbers = [
        ...new Set(
          manufacturePriceCards
            .map(
              (card) =>
                card.trxNumber
            )
            .filter(Boolean)
        ),
      ];

      if (
        manufacturePriceNumbers.length >
        0
      ) {
        const manufacturePriceOrders =
          await prisma.manufactureOrder.findMany(
            {
              where: {
                number: {
                  in:
                    manufacturePriceNumbers,
                },

                outletId: {
                  not: null,
                },

                ...(outletId !==
                null
                  ? {
                      outletId,
                    }
                  : {}),
              },

              select: {
                number: true,
                outletId: true,
                status: true,
              },
            }
          );

        const manufacturePriceOrderMap =
          new Map<
            string,
            (typeof manufacturePriceOrders)[number]
          >(
            manufacturePriceOrders.map(
              (order) => [
                order.number,
                order,
              ]
            )
          );

        for (
          const card of
            manufacturePriceCards
        ) {
          const order =
            manufacturePriceOrderMap.get(
              card.trxNumber
            );

          if (
            !order ||
            order.outletId ===
              null
          ) {
            continue;
          }

          const barang =
            card.barang as BarangUnitInfo;

          const basePrice =
            Number(
              card.unitPrice
            );

          const qtyIn =
            Number(
              card.qtyIn
            );

          if (
            qtyIn <= 0
          ) {
            continue;
          }

          if (
            !isValidPrice(
              basePrice
            )
          ) {
            continue;
          }

          const transactionPrice =
            baseUnitPriceToTransactionUnitPrice(
              basePrice,
              barang
            );

          if (
            !isValidPrice(
              transactionPrice
            )
          ) {
            continue;
          }

          setLatestPrice(
            latestTransactionPriceMap,
            order.outletId,
            card.barangId,
            transactionPrice,
            card.trxDate,
            "MANUFACTURE_OUTPUT"
          );
        }
      }
    }

    // =====================================================
    // 25. OUTLET MASTER PRICE
    //
    // FALLBACK:
    //
    // OutletBarang.harga
    //
    // hanya dipakai jika tidak ada
    // transaction price.
    // =====================================================

    const outletPriceWhere: any = {
      barangId: {
        in:
          priceBarangIds,
      },

      aktif:
        true,
    };

    if (
      outletId !== null
    ) {
      outletPriceWhere.outletId =
        outletId;
    }

    const outletBarangPrices =
      priceBarangIds.length > 0
        ? await prisma.outletBarang.findMany(
            {
              where:
                outletPriceWhere,

              select: {
                outletId: true,
                barangId: true,
                harga: true,
                aktif: true,
                updatedAt: true,
              },
            }
          )
        : [];

    const outletPriceMap =
      new Map<
        string,
        number
      >();

    for (
      const item of
        outletBarangPrices
    ) {
      const harga =
        Number(
          item.harga
        );

      if (
        !isValidPrice(harga)
      ) {
        continue;
      }

      outletPriceMap.set(
        makePriceKey(
          item.outletId,
          item.barangId
        ),
        roundPrice(harga)
      );
    }

    // =====================================================
    // 26. LIMIT HISTORY
    // =====================================================

    const limitedHistory =
      filteredHistory.slice(
        0,
        limit
      );

    // =====================================================
    // 27. FORMAT DATA
    // =====================================================

    const data =
      limitedHistory.map(
        (item) => {
          const barang =
            barangMap.get(
              item.barangId
            ) || null;

          const conversionRate =
            barang
              ? getConversionRate(
                  barang
                )
              : 1;

          const transactionUnit =
            barang
              ? getTransactionUnit(
                  barang
                )
              : item.transactionUnit;

          const baseUnit =
            barang
              ? getBaseUnit(
                  barang
                )
              : null;

          const baseQty =
            Number(
              item.qty
            );

          const transactionQty =
            item.transactionQty !==
            null
              ? Number(
                  item.transactionQty
                )
              : null;

          /*
           * =================================================
           * HARGA TERAKHIR
           * =================================================
           *
           * Cari berdasarkan:
           *
           * outletId + barangId
           *
           * supaya ADMIN/MANAGER yang melihat
           * semua outlet tetap mendapatkan harga
           * outlet yang benar.
           */

          const priceKey =
            makePriceKey(
              item.outletId,
              item.barangId
            );

          const transactionPrice =
            latestTransactionPriceMap.get(
              priceKey
            );

          let lastPurchasePrice:
            number | null = null;

          let priceSource:
            PriceSource = null;

          let lastPurchaseDate:
            Date | null = null;

          /*
           * PRIORITAS 1:
           * harga transaksi incoming terbaru.
           */
          if (
            transactionPrice &&
            isValidPrice(
              transactionPrice.price
            )
          ) {
            lastPurchasePrice =
              transactionPrice.price;

            priceSource =
              transactionPrice.source;

            lastPurchaseDate =
              transactionPrice.date;
          }

          /*
           * PRIORITAS 2:
           * harga master outlet.
           */
          if (
            !isValidPrice(
              lastPurchasePrice
            )
          ) {
            const outletMasterPrice =
              outletPriceMap.get(
                priceKey
              );

            if (
              isValidPrice(
                outletMasterPrice
              )
            ) {
              lastPurchasePrice =
                roundPrice(
                  outletMasterPrice
                );

              priceSource =
                "OUTLET_BARANG";

              lastPurchaseDate =
                null;
            }
          }

          /*
           * PRIORITAS 3:
           * Barang.purchasePrice.
           */
          if (
            !isValidPrice(
              lastPurchasePrice
            )
          ) {
            const masterPrice =
              barangPurchasePriceMap.get(
                item.barangId
              );

            if (
              isValidPrice(
                masterPrice
              )
            ) {
              lastPurchasePrice =
                roundPrice(
                  masterPrice
                );

              priceSource =
                "BARANG_MASTER";

              lastPurchaseDate =
                null;
            }
          }

          /*
           * =================================================
           * TRANSACTION PRICE ROW
           * =================================================
           *
           * Jika row itu sendiri mempunyai harga transaksi,
           * gunakan harga tersebut sebagai price.
           *
           * Tetapi field lastPurchasePrice tetap mewakili
           * harga incoming TERAKHIR untuk barang/outlet.
           */
          const rowTransactionPrice =
            isValidPrice(
              item.price
            )
              ? roundPrice(
                  Number(
                    item.price
                  )
                )
              : null;

          return {
            id:
              item.id,

            date:
              item.date,

            type:
              item.type,

            direction:
              item.direction,

            number:
              item.number,

            outletId:
              item.outletId,

            barangId:
              item.barangId,

            barang,

            /*
             * BASE UNIT
             */
            qty:
              baseQty,

            baseQty,

            baseUnit,

            /*
             * TRANSACTION UNIT
             */
            transactionQty,

            transactionUnit,

            /*
             * MASTER CONVERSION
             */
            conversionRate,

            conversionLabel:
              barang &&
              conversionRate !==
                1
                ? `1 ${transactionUnit} = ${conversionRate} ${baseUnit}`
                : `1 ${transactionUnit}`,

            stockBefore:
              item.stockBefore ===
              null
                ? null
                : Number(
                    item.stockBefore
                  ),

            stockAfter:
              item.stockAfter ===
              null
                ? null
                : Number(
                    item.stockAfter
                  ),

            status:
              item.status,

            description:
              item.description,

            source:
              item.source,

            /*
             * =================================================
             * HARGA
             * =================================================
             *
             * Harga terakhir per Barang.unit.
             */
            lastPurchasePrice,

            /*
             * Alias untuk kompatibilitas frontend.
             */
            price:
              lastPurchasePrice,

            unitPrice:
              lastPurchasePrice,

            purchasePrice:
              lastPurchasePrice,

            costPrice:
              lastPurchasePrice,

            transactionPrice:
              lastPurchasePrice,

            /*
             * Harga transaksi pada row ini,
             * jika source memang mempunyai harga langsung.
             *
             * Ini berbeda dengan lastPurchasePrice.
             */
            rowTransactionPrice,

            priceSource,

            lastPurchaseDate,

            priceUnit:
              transactionUnit,

            priceIsPerTransactionUnit:
              true,
          };
        }
      );

    // =====================================================
    // 28. SUMMARY
    // =====================================================

    const stockIn =
      data
        .filter(
          (item) =>
            item.direction ===
            "IN"
        )
        .reduce(
          (total, item) =>
            total +
            Number(
              item.baseQty
            ),
          0
        );

    const stockOut =
      data
        .filter(
          (item) =>
            item.direction ===
            "OUT"
        )
        .reduce(
          (total, item) =>
            total +
            Number(
              item.baseQty
            ),
          0
        );

    // =====================================================
    // 29. BY TYPE
    // =====================================================

    const byType:
      Record<
        string,
        number
      > = {};

    for (
      const item of
        data
    ) {
      byType[
        item.type
      ] =
        (byType[
          item.type
        ] || 0) + 1;
    }

    // =====================================================
    // 30. PRICE SUMMARY
    //
    // Informasi tambahan agar frontend yang ingin
    // mengambil harga per barang tidak perlu menebak
    // dari row history.
    // =====================================================

    const priceSummary =
      data.reduce(
        (
          map,
          item
        ) => {
          const key =
            makePriceKey(
              item.outletId,
              item.barangId
            );

          /*
           * Jangan overwrite entry yang sudah ada
           * karena beberapa history row untuk barang
           * yang sama memiliki harga yang sama.
           */
          if (
            !map[key]
          ) {
            map[key] = {
              outletId:
                item.outletId,

              barangId:
                item.barangId,

              lastPurchasePrice:
                item.lastPurchasePrice,

              price:
                item.lastPurchasePrice,

              unitPrice:
                item.lastPurchasePrice,

              purchasePrice:
                item.lastPurchasePrice,

              costPrice:
                item.lastPurchasePrice,

              transactionPrice:
                item.lastPurchasePrice,

              priceSource:
                item.priceSource,

              lastPurchaseDate:
                item.lastPurchaseDate,

              priceUnit:
                item.transactionUnit,

              priceIsPerTransactionUnit:
                true,
            };
          }

          return map;
        },
        {} as Record<
          string,
          {
            outletId:
              number | null;
            barangId:
              number;
            lastPurchasePrice:
              number | null;
            price:
              number | null;
            unitPrice:
              number | null;
            purchasePrice:
              number | null;
            costPrice:
              number | null;
            transactionPrice:
              number | null;
            priceSource:
              PriceSource;
            lastPurchaseDate:
              Date | null;
            priceUnit:
              string | null;
            priceIsPerTransactionUnit:
              boolean;
          }
        >
      );

    // =====================================================
    // 31. RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      scope: {
        role:
          user.role,

        outletId,
      },

      user: {
        id:
          user.id,

        fullname:
          user.fullname,

        role:
          user.role,

        outletId:
          user.outletId,

        outlet:
          user.outlet,
      },

      /*
       * Filter yang benar-benar digunakan
       * oleh server.
       */
      filter: {
        outletId,

        barangId,

        direction:
          directionFilter ||
          "ALL",

        type:
          typeFilter ||
          "ALL",

        status:
          statusFilter ||
          "ALL",

        limit,

        /*
         * Compatibility frontend.
         */
        scope:
          scopeParam ||
          "ALL",

        includeAll:
          includeAll ===
          "true",

        includeAllSources:
          includeAllSources ===
          "true",

        includeAllTypes:
          includeAllTypes ===
          "true",
      },

      selected: {
        outlet:
          selectedOutlet,

        barang:
          selectedBarang,
      },

      data,

      /*
       * Harga terakhir per outlet + barang.
       *
       * Frontend dapat menggunakan:
       *
       * data[].lastPurchasePrice
       *
       * atau:
       *
       * priceSummary["outletId:barangId"]
       */
      priceSummary,

      summary: {
        total:
          data.length,

        totalBeforeLimit,

        stockIn,

        stockOut,

        netMovement:
          stockIn -
          stockOut,

        byType,

        /*
         * Informasi harga yang dipakai.
         */
        priceMode:
          "LATEST_RECEIVED_TRANSACTION_WITH_MASTER_FALLBACK",

        priceFallbackOrder: [
          "LATEST_RECEIVED_TRANSACTION",
          "OutletBarang.harga",
          "Barang.purchasePrice",
        ],
      },

      meta: {
        limit,

        hasMore:
          totalBeforeLimit >
          limit,

        /*
         * History ini hanya stock movement.
         */
        movementOnly:
          true,

        informational:
          false,

        /*
         * Harga:
         *
         * lastPurchasePrice selalu dalam
         * Barang.unit.
         */
        priceSystem: {
          field:
            "lastPurchasePrice",

          aliases: [
            "price",
            "unitPrice",
            "purchasePrice",
            "costPrice",
            "transactionPrice",
          ],

          unit:
            "Barang.unit",

          priority: [
            "OutletReceiptItem.price",
            "StockCard:MANUFACTURE_OUTPUT.unitPrice",
            "OutletAdjustmentItem.price",
            "OutletBarang.harga",
            "Barang.purchasePrice",
          ],

          incomingTransactionSources: [
            "OutletReceiptItem",
            "StockCard:MANUFACTURE_OUTPUT",
            "OutletAdjustmentItem:IN",
          ],

          excludedPriceSources: [
            "OutletTransferItem",
            "StockCard:POS_OUT",
            "StockCard:MANUFACTURE_CONSUME",
            "OutletStockOut",
            "StockOpnameItem",
          ],

          note:
            "OutletTransferItem tidak mempunyai field harga sehingga tidak ditebak. Harga terakhir tetap berasal dari incoming transaction berharga terbaru. Harga StockCard MANUFACTURE_OUTPUT dan OutletAdjustmentItem dikonversi dari BASE_UNIT menjadi Barang.unit.",
        },

        unitSystem: {
          stockStorageUnit:
            "BASE_UNIT",

          stockCardUnit:
            "BASE_UNIT",

          outletAdjustmentUnit:
            "BASE_UNIT",

          stockOpnameUnit:
            "BASE_UNIT",

          transactionUnit:
            "BARANG_UNIT",

          baseUnit:
            "Barang.baseUnit",

          conversionRate:
            "Barang.conversionRate",

          outletStockPriceUnit:
            "BARANG_UNIT",
        },

        sources: [
          "OutletReceiptItem",
          "OutletTransferItem",
          "StockCard",
          "OutletStockOut",
          "OutletAdjustmentItem",
          "StockOpnameItem",
        ],

        stockInSources: [
          "OutletReceiptItem",
          "OutletTransferItem",
          "StockCard:MANUFACTURE_OUTPUT",
          "OutletAdjustmentItem:IN",
          "StockOpnameItem:difference>0",
        ],

        stockOutSources: [
          "StockCard:POS_OUT",
          "StockCard:MANUFACTURE_CONSUME",
          "OutletStockOut",
          "OutletAdjustmentItem:OUT",
          "StockOpnameItem:difference<0",
        ],

        priceSources: [
          "OutletReceiptItem.price",
          "StockCard:MANUFACTURE_OUTPUT.unitPrice",
          "OutletAdjustmentItem.price",
          "OutletBarang.harga",
          "Barang.purchasePrice",
        ],

        stockCardTypes: [
          "POS_OUT",
          "MANUFACTURE_CONSUME",
          "MANUFACTURE_OUTPUT",
        ],

        excludedSources: [
          "OutletPurchaseItem",
          "DeliveryItem",
          "StockMutation",
          "StockOpnameHistory",
          "StockWaste",
        ],

        excludedTransactions: [
          "Transfer VOID",
          "Transfer belum received",
          "StockOut selain APPROVED",
          "Adjustment selain APPROVED",
          "Opname selain APPROVED",
          "Opname difference = 0",
          "Manufacture pusat",
          "StockCard pusat",
          "Purchase Order",
        ],

        outletIsolation: {
          stockCard:
            "StockCard tidak memiliki outletId. POS_OUT dicocokkan melalui OutletSale.number. MANUFACTURE_* dicocokkan melalui ManufactureOrder.number dan hanya ManufactureOrder dengan outletId yang tidak null yang dimasukkan.",

          centralStock:
            "StockCard pusat tidak dimasukkan apabila tidak memiliki transaksi POS/Manufacture outlet yang sesuai.",

          adjustment:
            "OutletAdjustmentItem hanya APPROVED. Qty sudah BASE UNIT dan tidak dikalikan conversionRate. Harga adjustment IN dikonversi dari BASE UNIT ke Barang.unit.",

          opname:
            "StockOpnameItem hanya APPROVED dan hanya difference != 0 yang dianggap sebagai stock movement.",

          delivery:
            "DeliveryItem tidak dimasukkan karena history ini khusus perubahan stock outlet.",

          price:
            "Harga transaksi dibatasi berdasarkan outlet + barang. OUTLET_ADMIN selalu menggunakan outlet dari session. ADMIN/MANAGER dapat melihat harga masing-masing outlet.",
        },

        filterMode:
          "SERVER_SIDE",

        note:
          "History Stock Outlet hanya mengembalikan transaksi yang benar-benar menyebabkan perubahan stock. Barang masuk dan barang keluar dipisahkan melalui direction IN/OUT. Purchase Order tidak dianggap stock movement. Stock opname hanya APPROVED dengan difference != 0. Harga terakhir mengambil incoming transaction berharga terbaru dari sumber yang tersedia, kemudian fallback ke OutletBarang.harga dan Barang.purchasePrice.",
      },
    });
  } catch (
    error: any
  ) {
    console.error(
      "GET OUTLET STOCK HISTORY ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal mengambil history stock outlet",
      },
      {
        status: 500,
      }
    );
  }
}