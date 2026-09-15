import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * GET /api/outlet/stock/history
 *
 * HISTORY STOCK OUTLET
 *
 * SUMBER:
 *
 * 1. OutletReceiptItem
 *    Supplier -> Outlet
 *
 * 2. OutletTransferItem
 *    Pusat / Outlet lain -> Outlet
 *
 * 3. StockCard
 *    - POS_OUT
 *    - MANUFACTURE_CONSUME
 *    - MANUFACTURE_OUTPUT
 *
 *    StockCard TIDAK memiliki outletId.
 *    Karena itu outlet ditentukan melalui:
 *
 *      POS_OUT
 *        StockCard.trxNumber
 *          -> OutletSale.number
 *
 *      MANUFACTURE_*
 *        StockCard.trxNumber
 *          -> ManufactureOrder.number
 *
 *    Dengan demikian StockCard pusat tidak ikut.
 *
 * 4. OutletStockOut
 *    Pemakaian / Waste outlet
 *
 * 5. OutletAdjustmentItem
 *    Adjustment stock outlet
 *
 *    Hanya adjustment APPROVED yang dianggap
 *    sebagai stock movement.
 *
 *    IN  -> Stock Outlet bertambah
 *    OUT -> Stock Outlet berkurang
 *
 *    Qty adjustment SUDAH BASE UNIT.
 *
 * 6. StockOpnameItem
 *    Informasi opname
 *
 * 7. OutletPurchaseItem
 *    Informasi PO outlet
 *
 * =========================================================
 *
 * SATUAN:
 *
 * OutletStock.stock = BASE UNIT
 *
 * StockCard qtyIn / qtyOut = BASE UNIT
 *
 * OutletAdjustmentItem.qty = BASE UNIT
 *
 * Barang.unit = SATUAN TRANSAKSI
 * Barang.baseUnit = SATUAN DASAR
 * Barang.conversionRate = KONVERSI
 *
 * Contoh:
 *
 * unit           = Dus
 * baseUnit       = PCS
 * conversionRate = 24
 *
 * StockCard:
 * qtyOut = 48
 *
 * History:
 * baseQty        = 48 PCS
 * transactionQty = 2 Dus
 *
 * Adjustment:
 * qty = 48
 *
 * History:
 * baseQty        = 48 PCS
 * transactionQty = 2 Dus
 *
 * PENTING:
 *
 * OutletAdjustmentItem.qty SUDAH BASE UNIT.
 * Jadi TIDAK boleh dikalikan conversionRate lagi.
 *
 * =========================================================
 *
 * DELIVERY:
 *
 * DeliveryItem sengaja TIDAK dimasukkan.
 *
 * History Stock Outlet bukan History Delivery.
 *
 * =========================================================
 */

type HistoryDirection = "IN" | "OUT" | "INFO";

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
   * SEMUA QTY STOCK DALAM BASE UNIT.
   */
  qty: number;

  /*
   * QTY DALAM SATUAN TRANSAKSI.
   *
   * Untuk StockCard, qty berasal dari BASE UNIT,
   * kemudian dikonversi kembali untuk display.
   *
   * Untuk OutletAdjustmentItem, qty juga sudah
   * BASE UNIT, kemudian dikonversi kembali
   * untuk display.
   */
  transactionQty: number | null;

  transactionUnit: string | null;

  stockBefore: number | null;
  stockAfter: number | null;

  status: string | null;
  description: string | null;
  source: string;
};

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function getConversionRate(barang: BarangUnitInfo): number {
  const rate = Number(barang.conversionRate);

  if (!Number.isFinite(rate) || rate <= 0) {
    return 1;
  }

  return rate;
}

function getTransactionUnit(barang: BarangUnitInfo): string {
  return (
    barang.unit?.trim() ||
    barang.baseUnit?.trim() ||
    ""
  );
}

function getBaseUnit(barang: BarangUnitInfo): string {
  return (
    barang.baseUnit?.trim() ||
    barang.unit?.trim() ||
    ""
  );
}

/*
 * =========================================================
 * TRANSACTION -> BASE UNIT
 *
 * Digunakan untuk:
 * - OutletReceiptItem
 * - OutletTransferItem
 * - OutletStockOut
 * - OutletPurchaseItem
 *
 * Karena sumber tersebut menyimpan qty
 * dalam satuan transaksi.
 * =========================================================
 */

function toBaseQty(
  qty: number,
  barang: BarangUnitInfo
): number {
  const safeQty = Number(qty);

  if (!Number.isFinite(safeQty)) {
    return 0;
  }

  return safeQty * getConversionRate(barang);
}

/*
 * =========================================================
 * BASE UNIT -> TRANSACTION UNIT
 *
 * Contoh:
 *
 * 48 PCS / 24
 * = 2 Dus
 *
 * Digunakan untuk:
 * - StockCard
 * - OutletAdjustmentItem
 *
 * karena keduanya sudah BASE UNIT.
 * =========================================================
 */

function fromBaseQty(
  qty: number,
  barang: BarangUnitInfo
): number {
  const safeQty = Number(qty);

  if (!Number.isFinite(safeQty)) {
    return 0;
  }

  const rate = getConversionRate(barang);

  if (rate <= 0) {
    return safeQty;
  }

  return safeQty / rate;
}

/*
 * =========================================================
 * ROUND DISPLAY QTY
 * =========================================================
 */

function roundQty(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return (
    Math.round(
      (value + Number.EPSILON) * 1000000
    ) / 1000000
  );
}

/*
 * =========================================================
 * GET
 * =========================================================
 */

export async function GET(req: NextRequest) {
  try {
    // =====================================================
    // 1. SESSION
    // =====================================================

    const cookieStore = await cookies();

    const session = cookieStore.get("erp-session");

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
      sessionData = JSON.parse(session.value);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    const userId = Number(sessionData?.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    // =====================================================
    // 3. USER
    // =====================================================

    const user = await prisma.user.findUnique({
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
          message: "User tidak ditemukan",
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
          message: "User tidak aktif",
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

    if (!allowedRoles.includes(user.role)) {
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

    const { searchParams } = new URL(req.url);

    const outletIdParam =
      searchParams.get("outletId");

    const barangIdParam =
      searchParams.get("barangId");

    const limitParam =
      searchParams.get("limit");

    // =====================================================
    // 7. BARANG ID
    // =====================================================

    let barangId: number | null = null;

    if (barangIdParam !== null) {
      const parsedBarangId =
        Number(barangIdParam);

      if (
        !Number.isInteger(parsedBarangId) ||
        parsedBarangId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Barang ID tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      barangId = parsedBarangId;
    }

    // =====================================================
    // 8. LIMIT
    // =====================================================

    let limit = 500;

    if (limitParam !== null) {
      const parsedLimit =
        Number(limitParam);

      if (
        !Number.isInteger(parsedLimit) ||
        parsedLimit <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Limit tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      limit = Math.min(parsedLimit, 2000);
    }

    // =====================================================
    // 9. OUTLET SCOPE
    // =====================================================

    let outletId: number | null = null;

    /*
     * OUTLET_ADMIN:
     *
     * Tidak boleh memilih outlet lain.
     */

    if (user.role === "OUTLET_ADMIN") {
      if (
        !user.outletId ||
        !Number.isInteger(user.outletId) ||
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

      outletId = user.outletId;
    }

    /*
     * ADMIN / MANAGER:
     *
     * Bisa melihat semua outlet.
     */

    if (
      user.role === "ADMIN" ||
      user.role === "MANAGER"
    ) {
      if (outletIdParam !== null) {
        const parsedOutletId =
          Number(outletIdParam);

        if (
          !Number.isInteger(parsedOutletId) ||
          parsedOutletId <= 0
        ) {
          return NextResponse.json(
            {
              success: false,
              message: "Outlet ID tidak valid",
            },
            {
              status: 400,
            }
          );
        }

        outletId = parsedOutletId;
      }
    }

    // =====================================================
    // 10. VALIDASI OUTLET
    // =====================================================

    let selectedOutlet: {
      id: number;
      code: string;
      name: string;
      active: boolean;
    } | null = null;

    if (outletId !== null) {
      selectedOutlet =
        await prisma.outlet.findUnique({
          where: {
            id: outletId,
          },

          select: {
            id: true,
            code: true,
            name: true,
            active: true,
          },
        });

      if (!selectedOutlet) {
        return NextResponse.json(
          {
            success: false,
            message: "Outlet tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }

      if (!selectedOutlet.active) {
        return NextResponse.json(
          {
            success: false,
            message: "Outlet sedang tidak aktif",
          },
          {
            status: 400,
          }
        );
      }
    }

    // =====================================================
    // 11. VALIDASI BARANG
    // =====================================================

    let selectedBarang: BarangUnitInfo | null = null;

    if (barangId !== null) {
      selectedBarang =
        await prisma.barang.findUnique({
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
        });

      if (!selectedBarang) {
        return NextResponse.json(
          {
            success: false,
            message: "Barang tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }
    }

    // =====================================================
    // 12. HISTORY
    // =====================================================

    const history: HistoryRow[] = [];

    // =====================================================
    // 13. OUTLET RECEIPT
    //
    // SUPPLIER -> OUTLET
    // =====================================================

    const receiptWhere: any = {};

    if (outletId !== null) {
      receiptWhere.receipt = {
        outletId,
      };
    }

    if (barangId !== null) {
      receiptWhere.barangId = barangId;
    }

    const receiptItems =
      await prisma.outletReceiptItem.findMany({
        where: receiptWhere,

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
            receiptDate: "desc",
          },
        },
      });

    for (const item of receiptItems) {
      const barang =
        item.barang as BarangUnitInfo;

      const transactionQty =
        Number(item.qty);

      const baseQty =
        toBaseQty(
          transactionQty,
          barang
        );

      if (baseQty <= 0) {
        continue;
      }

      history.push({
        id:
          `OUTLET_RECEIPT-${item.id}`,

        date:
          item.receipt.receiptDate,

        type:
          "OUTLET_RECEIPT",

        direction:
          "IN",

        number:
          item.receipt.number,

        outletId:
          item.receipt.outlet.id,

        barangId:
          item.barangId,

        qty:
          baseQty,

        transactionQty,

        transactionUnit:
          getTransactionUnit(barang),

        stockBefore: null,
        stockAfter: null,

        status:
          "RECEIVED",

        description:
          item.receipt.supplier
            ? `Barang masuk dari supplier ${item.receipt.supplier.name}`
            : "Barang masuk dari supplier",

        source:
          "OutletReceiptItem",
      });
    }

    // =====================================================
    // 14. OUTLET TRANSFER
    //
    // PUSAT / OUTLET LAIN -> OUTLET
    // =====================================================

    const transferWhere: any = {};

    if (outletId !== null) {
      transferWhere.transfer = {
        outletId,
      };
    }

    if (barangId !== null) {
      transferWhere.barangId = barangId;
    }

    const transferItems =
      await prisma.outletTransferItem.findMany({
        where: transferWhere,

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
            transferDate: "desc",
          },
        },
      });

    for (const item of transferItems) {
      /*
       * Item VOID tidak boleh menjadi
       * penerimaan stock outlet.
       */

      if (item.voided) {
        continue;
      }

      const receivedQty =
        Number(item.receivedQty);

      if (receivedQty <= 0) {
        continue;
      }

      const barang =
        item.barang as BarangUnitInfo;

      const baseQty =
        toBaseQty(
          receivedQty,
          barang
        );

      const sourceName =
        item.transfer.sourceOutlet?.name ||
        "Gudang Pusat";

      history.push({
        id:
          `TRANSFER-${item.id}`,

        date:
          item.transfer.transferDate,

        type:
          "TRANSFER_IN",

        direction:
          "IN",

        number:
          item.transfer.number,

        outletId:
          item.transfer.outlet.id,

        barangId:
          item.barangId,

        qty:
          baseQty,

        transactionQty:
          receivedQty,

        transactionUnit:
          getTransactionUnit(barang),

        stockBefore: null,
        stockAfter: null,

        status:
          item.transfer.status,

        description:
          `Barang masuk dari ${sourceName}`,

        source:
          "OutletTransferItem",
      });
    }

    // =====================================================
    // 15. STOCKCARD
    //
    // POS_OUT
    // MANUFACTURE_CONSUME
    // MANUFACTURE_OUTPUT
    //
    // PENTING:
    //
    // StockCard TIDAK memiliki outletId.
    //
    // Maka:
    //
    // POS:
    // StockCard.trxNumber
    // -> OutletSale.number
    //
    // Manufacture:
    // StockCard.trxNumber
    // -> ManufactureOrder.number
    //
    // Hanya StockCard yang berhasil
    // menemukan transaksi outlet yang dimasukkan.
    //
    // Dengan demikian:
    //
    // Stock Pusat tidak tercampur.
    // =====================================================

    const stockCardWhere: any = {
      trxType: {
        in: [
          "POS_OUT",
          "MANUFACTURE_CONSUME",
          "MANUFACTURE_OUTPUT",
        ],
      },
    };

    if (barangId !== null) {
      stockCardWhere.barangId = barangId;
    }

    const stockCards =
      await prisma.stockCard.findMany({
        where: stockCardWhere,

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
          trxDate: "desc",
        },
      });

    // =====================================================
    // 15A. KUMPULKAN NOMOR TRANSAKSI
    // =====================================================

    const posNumbers = [
      ...new Set(
        stockCards
          .filter(
            (card) =>
              card.trxType === "POS_OUT"
          )
          .map(
            (card) =>
              card.trxNumber
          )
          .filter(Boolean)
      ),
    ];

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
    // 15B. LOAD POS
    // =====================================================

    const outletSales =
      posNumbers.length > 0
        ? await prisma.outletSale.findMany({
            where: {
              number: {
                in: posNumbers,
              },

              ...(outletId !== null
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
          })
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
    // 15C. LOAD MANUFACTURE
    // =====================================================

    const manufactureOrders =
      manufactureNumbers.length > 0
        ? await prisma.manufactureOrder.findMany({
            where: {
              number: {
                in: manufactureNumbers,
              },

              /*
               * HANYA manufacture yang
               * benar-benar punya outlet.
               *
               * Manufacture pusat:
               * outletId = null
               *
               * TIDAK MASUK.
               */

              outletId: {
                not: null,
              },

              ...(outletId !== null
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
                  outputQty: true,

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
          })
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
    // 15D. PROSES STOCKCARD
    // =====================================================

    for (const card of stockCards) {
      const trxType =
        String(card.trxType || "").trim();

      /*
       * ===================================================
       * POS OUT
       * ===================================================
       */

      if (trxType === "POS_OUT") {
        const sale =
          outletSaleMap.get(
            card.trxNumber
          );

        /*
         * Tidak ditemukan POS outlet.
         *
         * Jangan masukkan.
         *
         * Ini penting supaya StockCard pusat
         * tidak ikut.
         */

        if (!sale) {
          continue;
        }

        const qtyOut =
          Number(card.qtyOut);

        if (qtyOut <= 0) {
          continue;
        }

        const barang =
          card.barang as BarangUnitInfo;

        const transactionQty =
          fromBaseQty(
            qtyOut,
            barang
          );

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

          /*
           * StockCard sudah BASE UNIT.
           */
          qty:
            qtyOut,

          transactionQty:
            roundQty(
              transactionQty
            ),

          transactionUnit:
            getTransactionUnit(
              barang
            ),

          stockBefore: null,

          stockAfter: null,

          status:
            sale.status,

          description:
            card.note ||
            `Pemakaian POS ${sale.number}`,

          source:
            "StockCard",
        });

        continue;
      }

      /*
       * ===================================================
       * MANUFACTURE
       * ===================================================
       */

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
         * Tidak ada ManufactureOrder outlet.
         *
         * Jangan masukkan.
         *
         * Ini mencegah manufacture pusat
         * masuk ke history outlet.
         */

        if (!order || order.outletId === null) {
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
            Number(card.qtyOut);

          if (qtyOut <= 0) {
            continue;
          }

          const transactionQty =
            fromBaseQty(
              qtyOut,
              barang
            );

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
                transactionQty
              ),

            transactionUnit:
              getTransactionUnit(
                barang
              ),

            stockBefore: null,
            stockAfter: null,

            status:
              order.status,

            description:
              card.note ||
              `Konsumsi bahan manufacture ${order.number}`,

            source:
              "StockCard",
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
            Number(card.qtyIn);

          if (qtyIn <= 0) {
            continue;
          }

          const transactionQty =
            fromBaseQty(
              qtyIn,
              barang
            );

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
                transactionQty
              ),

            transactionUnit:
              getTransactionUnit(
                barang
              ),

            stockBefore: null,
            stockAfter: null,

            status:
              order.status,

            description:
              card.note ||
              `Hasil manufacture ${order.number}`,

            source:
              "StockCard",
          });
        }
      }
    }

    // =====================================================
    // 16. OUTLET STOCK OUT
    //
    // PEMAKAIAN / WASTE
    // =====================================================

    const stockOutWhere: any = {};

    if (outletId !== null) {
      stockOutWhere.outletId =
        outletId;
    }

    if (barangId !== null) {
      stockOutWhere.barangId =
        barangId;
    }

    const stockOuts =
      await prisma.outletStockOut.findMany({
        where: stockOutWhere,

        select: {
          id: true,
          number: true,
          barangId: true,
          trxDate: true,
          type: true,
          status: true,
          qtyProcessed: true,
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
              conversionRate: true,
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
          trxDate: "desc",
        },
      });

    for (const item of stockOuts) {
      /*
       * Hanya transaksi yang benar-benar
       * approved yang dianggap sebagai
       * stock movement.
       */

      if (
        String(item.status) !==
        "APPROVED"
      ) {
        continue;
      }

      const transactionQty =
        Number(item.netQty) > 0
          ? Number(item.netQty)
          : Number(item.qtyProcessed);

      if (transactionQty <= 0) {
        continue;
      }

      const barang =
        item.barang as BarangUnitInfo;

      const baseQty =
        toBaseQty(
          transactionQty,
          barang
        );

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
          getTransactionUnit(barang),

        stockBefore: null,
        stockAfter: null,

        status:
          item.status,

        description:
          item.note ||
          `Pemakaian / ${item.type}`,

        source:
          "OutletStockOut",
      });
    }

    // =====================================================
    // 17. OUTLET ADJUSTMENT
    //
    // ADJUSTMENT STOCK OUTLET
    //
    // HANYA APPROVED YANG MENJADI
    // STOCK MOVEMENT.
    //
    // IN:
    //    OutletStock bertambah
    //
    // OUT:
    //    OutletStock berkurang
    //
    // PENTING:
    //
    // OutletAdjustmentItem.qty SUDAH BASE UNIT.
    //
    // JANGAN:
    //
    // qty * conversionRate
    //
    // Karena itu akan membuat qty menjadi
    // salah / double conversion.
    // =====================================================

    const adjustmentItemWhere: any = {
      adjustment: {
        status: "APPROVED",
      },
    };

    if (outletId !== null) {
      adjustmentItemWhere.adjustment.outletId =
        outletId;
    }

    if (barangId !== null) {
      adjustmentItemWhere.barangId =
        barangId;
    }

    const adjustmentItems =
      await prisma.outletAdjustmentItem.findMany({
        where: adjustmentItemWhere,

        select: {
          id: true,
          outletAdjustmentId: true,
          barangId: true,
          qty: true,
          price: true,
          type: true,

          adjustment: {
            select: {
              id: true,
              number: true,
              outletId: true,
              adjustmentDate: true,
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
              conversionRate: true,
              barcode: true,
            },
          },
        },

        orderBy: {
          adjustment: {
            adjustmentDate: "desc",
          },
        },
      });

    for (const item of adjustmentItems) {
      /*
       * Safety check.
       *
       * Walaupun query sudah memfilter APPROVED,
       * status tetap dicek kembali di application layer.
       */

      if (
        String(item.adjustment.status)
          .trim()
          .toUpperCase() !== "APPROVED"
      ) {
        continue;
      }

      /*
       * QTY ADJUSTMENT SUDAH BASE UNIT.
       */
      const baseQty =
        Number(item.qty);

      if (
        !Number.isFinite(baseQty) ||
        baseQty <= 0
      ) {
        continue;
      }

      const barang =
        item.barang as BarangUnitInfo;

      /*
       * Type item menjadi prioritas.
       *
       * Jika type item kosong, gunakan
       * type adjustment sebagai fallback.
       */
      const adjustmentType =
        String(
          item.type ||
            item.adjustment.type ||
            ""
        )
          .trim()
          .toUpperCase();

      /*
       * Hanya IN dan OUT yang merupakan
       * stock movement.
       */
      if (
        adjustmentType !== "IN" &&
        adjustmentType !== "OUT"
      ) {
        continue;
      }

      /*
       * Karena baseQty sudah BASE UNIT,
       * conversion hanya untuk display.
       */
      const transactionQty =
        fromBaseQty(
          baseQty,
          barang
        );

      const direction: HistoryDirection =
        adjustmentType === "IN"
          ? "IN"
          : "OUT";

      const reason =
        item.adjustment.reason?.trim();

      const remarks =
        item.adjustment.remarks?.trim();

      let description =
        adjustmentType === "IN"
          ? "Adjustment penambahan stock outlet"
          : "Adjustment pengurangan stock outlet";

      if (reason) {
        description += ` - ${reason}`;
      }

      if (remarks) {
        description += ` (${remarks})`;
      }

      history.push({
        id:
          `OUTLET-ADJUSTMENT-${item.id}`,

        date:
          item.adjustment.adjustmentDate,

        type:
          "OUTLET_ADJUSTMENT",

        direction,

        number:
          item.adjustment.number,

        outletId:
          item.adjustment.outletId,

        barangId:
          item.barangId,

        /*
         * SUDAH BASE UNIT.
         */
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

        /*
         * OutletAdjustmentItem belum menyimpan
         * stockBefore / stockAfter.
         */
        stockBefore:
          null,

        stockAfter:
          null,

        status:
          item.adjustment.status,

        description,

        source:
          "OutletAdjustmentItem",
      });
    }

    // =====================================================
    // 18. STOCK OPNAME
    //
    // INFO SAJA
    // =====================================================

    const opnameItemWhere: any = {};

    if (outletId !== null) {
      opnameItemWhere.opname = {
        outletId,
      };
    }

    if (barangId !== null) {
      opnameItemWhere.barangId =
        barangId;
    }

    const opnameItems =
      await prisma.stockOpnameItem.findMany({
        where: opnameItemWhere,

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
              conversionRate: true,
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
            date: "desc",
          },
        },
      });

    for (const item of opnameItems) {
      const systemQty =
        Number(item.systemQty);

      const physicalQty =
        Number(item.physicalQty);

      const difference =
        Number(item.difference);

      const barang =
        item.barang as BarangUnitInfo;

      const baseUnit =
        getBaseUnit(barang);

      history.push({
        id:
          `STOCK_OPNAME-${item.id}`,

        date:
          item.opname.date,

        type:
          "STOCK_OPNAME",

        direction:
          "INFO",

        number:
          item.opname.code,

        outletId:
          item.opname.outletId,

        barangId:
          item.barangId,

        qty:
          difference,

        transactionQty:
          null,

        transactionUnit:
          baseUnit,

        stockBefore:
          systemQty,

        stockAfter:
          physicalQty,

        status:
          item.opname.status,

        description:
          item.note ||
          `Stock opname: sistem ${systemQty} ${baseUnit}, fisik ${physicalQty} ${baseUnit}, selisih ${difference} ${baseUnit}`,

        source:
          "StockOpnameItem",
      });
    }

    // =====================================================
    // 19. OUTLET PURCHASE
    //
    // INFO SAJA
    // =====================================================

    const purchaseWhere: any = {};

    if (outletId !== null) {
      purchaseWhere.purchase = {
        outletId,
      };
    }

    if (barangId !== null) {
      purchaseWhere.barangId =
        barangId;
    }

    const purchaseItems =
      await prisma.outletPurchaseItem.findMany({
        where: purchaseWhere,

        select: {
          id: true,
          barangId: true,
          qty: true,
          receivedQty: true,
          price: true,
          subtotal: true,

          purchase: {
            select: {
              id: true,
              number: true,
              purchaseDate: true,
              status: true,
              remarks: true,

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
          purchase: {
            purchaseDate: "desc",
          },
        },
      });

    for (const item of purchaseItems) {
      const barang =
        item.barang as BarangUnitInfo;

      const transactionQty =
        Number(item.qty);

      const baseQty =
        toBaseQty(
          transactionQty,
          barang
        );

      history.push({
        id:
          `OUTLET_PURCHASE-${item.id}`,

        date:
          item.purchase.purchaseDate,

        type:
          "OUTLET_PURCHASE",

        direction:
          "INFO",

        number:
          item.purchase.number,

        outletId:
          item.purchase.outlet.id,

        barangId:
          item.barangId,

        qty:
          baseQty,

        transactionQty,

        transactionUnit:
          getTransactionUnit(barang),

        stockBefore: null,
        stockAfter: null,

        status:
          item.purchase.status,

        description:
          item.purchase.supplier
            ? `PO ke supplier ${item.purchase.supplier.name}`
            : "Purchase Order outlet",

        source:
          "OutletPurchaseItem",
      });
    }

    // =====================================================
    // 20. SORT
    // =====================================================

    history.sort(
      (a, b) =>
        b.date.getTime() -
        a.date.getTime()
    );

    // =====================================================
    // 21. LIMIT
    // =====================================================

    const totalBeforeLimit =
      history.length;

    const limitedHistory =
      history.slice(0, limit);

    // =====================================================
    // 22. MASTER BARANG TERBARU
    // =====================================================

    const barangIds = [
      ...new Set(
        limitedHistory.map(
          (item) => item.barangId
        )
      ),
    ];

    const barangList =
      barangIds.length > 0
        ? await prisma.barang.findMany({
            where: {
              id: {
                in: barangIds,
              },
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
          })
        : [];

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

    // =====================================================
    // 23. FORMAT DATA
    // =====================================================

    const data =
      limitedHistory.map((item) => {
        const barang =
          barangMap.get(
            item.barangId
          ) || null;

        const conversionRate =
          barang
            ? getConversionRate(barang)
            : 1;

        const transactionUnit =
          barang
            ? getTransactionUnit(barang)
            : item.transactionUnit;

        const baseUnit =
          barang
            ? getBaseUnit(barang)
            : null;

        const baseQty =
          Number(item.qty);

        const transactionQty =
          item.transactionQty !== null
            ? Number(item.transactionQty)
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
            conversionRate !== 1
              ? `1 ${transactionUnit} = ${conversionRate} ${baseUnit}`
              : `1 ${transactionUnit}`,

          stockBefore:
            item.stockBefore === null
              ? null
              : Number(
                  item.stockBefore
                ),

          stockAfter:
            item.stockAfter === null
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
        };
      });

    // =====================================================
    // 24. SUMMARY
    // =====================================================

    const stockIn =
      data
        .filter(
          (item) =>
            item.direction === "IN"
        )
        .reduce(
          (total, item) =>
            total +
            Number(item.baseQty),
          0
        );

    const stockOut =
      data
        .filter(
          (item) =>
            item.direction === "OUT"
        )
        .reduce(
          (total, item) =>
            total +
            Number(item.baseQty),
          0
        );

    const informational =
      data.filter(
        (item) =>
          item.direction === "INFO"
      ).length;

    // =====================================================
    // 25. BY TYPE
    // =====================================================

    const byType: Record<
      string,
      number
    > = {};

    for (const item of data) {
      byType[item.type] =
        (byType[item.type] || 0) + 1;
    }

    // =====================================================
    // 26. RESPONSE
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

      filter: {
        outletId,
        barangId,
        limit,
      },

      selected: {
        outlet:
          selectedOutlet,

        barang:
          selectedBarang,
      },

      data,

      summary: {
        total:
          data.length,

        totalBeforeLimit,

        stockIn,

        stockOut,

        informational,

        netMovement:
          stockIn - stockOut,

        byType,
      },

      meta: {
        limit,

        hasMore:
          totalBeforeLimit >
          limit,

        unitSystem: {
          stockStorageUnit:
            "BASE_UNIT",

          stockCardUnit:
            "BASE_UNIT",

          outletAdjustmentUnit:
            "BASE_UNIT",

          transactionUnit:
            "BARANG_UNIT",

          baseUnit:
            "Barang.baseUnit",

          conversionRate:
            "Barang.conversionRate",
        },

        sources: [
          "OutletReceiptItem",
          "OutletTransferItem",
          "StockCard",
          "OutletStockOut",
          "OutletAdjustmentItem",
          "StockOpnameItem",
          "OutletPurchaseItem",
        ],

        stockCardTypes: [
          "POS_OUT",
          "MANUFACTURE_CONSUME",
          "MANUFACTURE_OUTPUT",
        ],

        stockMovementSources: [
          "OutletReceiptItem",
          "OutletTransferItem",
          "StockCard",
          "OutletStockOut",
          "OutletAdjustmentItem",
        ],

        informationalSources: [
          "StockOpnameItem",
          "OutletPurchaseItem",
        ],

        excludedSources: [
          "DeliveryItem",
          "StockMutation",
          "StockOpnameHistory",
          "StockWaste",
        ],

        outletIsolation: {
          stockCard:
            "StockCard tidak memiliki outletId. POS_OUT dicocokkan melalui OutletSale.number. MANUFACTURE_* dicocokkan melalui ManufactureOrder.number dan hanya ManufactureOrder dengan outletId yang tidak null yang dimasukkan.",

          centralStock:
            "StockCard pusat tidak dimasukkan ke History Stock Outlet apabila tidak memiliki transaksi POS/Manufacture outlet yang sesuai.",

          adjustment:
            "OutletAdjustmentItem hanya dimasukkan apabila OutletAdjustment berstatus APPROVED. Qty adjustment sudah BASE UNIT dan tidak dikalikan conversionRate.",

          delivery:
            "DeliveryItem sengaja tidak dimasukkan karena History Stock Outlet bukan History Delivery.",
        },

        note:
          "History Stock Outlet menggunakan BASE UNIT untuk seluruh stock movement. StockCard POS_OUT, MANUFACTURE_CONSUME, dan MANUFACTURE_OUTPUT dimasukkan hanya setelah berhasil dihubungkan ke transaksi outlet. OutletAdjustmentItem hanya dari adjustment APPROVED dan qty-nya sudah BASE UNIT. DeliveryItem tidak ditampilkan.",
      },
    });
  } catch (error: any) {
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