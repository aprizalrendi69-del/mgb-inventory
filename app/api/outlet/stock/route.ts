import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * GET STOCK OUTLET
 * =========================================================
 *
 * ACCESS:
 *
 * ADMIN
 * -> bisa melihat semua outlet
 * -> bisa filter outletId
 *
 * MANAGER
 * -> bisa melihat semua outlet
 * -> bisa filter outletId
 *
 * OUTLET_ADMIN / ADMIN_OUTLET
 * -> hanya bisa melihat outlet miliknya
 * -> outletId dari URL TIDAK dipercaya
 * -> outletId selalu diambil dari user.outletId
 *
 * =========================================================
 * SECURITY RULE
 * =========================================================
 *
 * Jangan pernah menggunakan outletId dari URL sebagai
 * sumber authority untuk outlet admin.
 *
 * =========================================================
 * SATUAN
 * =========================================================
 *
 * SATUAN UTAMA:
 *
 * Barang.unit
 *
 * baseUnit:
 * Barang.baseUnit
 *
 * conversionRate:
 * Barang.conversionRate
 *
 * =========================================================
 * STOCK SOURCE
 * =========================================================
 *
 * Stock utama berasal dari:
 *
 * OutletStock.stock
 *
 * Endpoint ini READ ONLY.
 *
 * Tidak melakukan:
 *
 * -> adjustment
 * -> stock opname adjustment
 * -> update OutletStock
 * -> update Barang.stock
 *
 * =========================================================
 * PRICE SOURCE
 * =========================================================
 *
 * HARGA TERAKHIR:
 *
 * ReceiptItem.price
 *
 * Urutan:
 *
 * Receipt.receiptDate DESC
 * ReceiptItem.id DESC
 *
 * Jadi harga yang dikembalikan adalah harga dari transaksi
 * BARANG MASUK TERAKHIR.
 *
 * TIDAK menggunakan:
 *
 * -> Barang.purchasePrice sebagai sumber harga terakhir
 *
 * Barang.purchasePrice hanya tetap dikirim sebagai harga
 * master/fallback informasi.
 *
 * =========================================================
 */

type BarangUnitInfo = {
  id: number;
  code: string;
  name: string;
  unit: string;
  baseUnit: string | null;
  conversionRate: number;
  barcode: string | null;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;
};

type LatestPriceInfo = {
  barangId: number;

  latestPurchasePrice: number | null;

  latestPurchasePriceFormatted: string | null;

  latestTransactionDate: Date | null;

  latestReceiptNumber: string | null;

  latestSupplierId: number | null;

  latestSupplier: {
    id: number;
    code: string | null;
    name: string;
  } | null;

  source: "ReceiptItem.price" | "Barang.purchasePrice" | "NO_TRANSACTION";

  hasTransaction: boolean;
};

function getSafeNumber(value: unknown): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
}

function formatRupiah(value: number | null): string | null {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

/*
 * =========================================================
 * ROLE HELPERS
 * =========================================================
 */

function normalizeRole(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function isOutletAdminRole(role: unknown): boolean {
  const normalizedRole =
    normalizeRole(role);

  return (
    normalizedRole === "OUTLET_ADMIN" ||
    normalizedRole === "ADMIN_OUTLET"
  );
}

function isCentralRole(role: unknown): boolean {
  const normalizedRole =
    normalizeRole(role);

  return (
    normalizedRole === "ADMIN" ||
    normalizedRole === "MANAGER"
  );
}

/*
 * =========================================================
 * CONVERSION RATE
 * =========================================================
 */

function getConversionRate(
  barang: BarangUnitInfo
): number {
  const rate = Number(
    barang.conversionRate
  );

  if (
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    return 1;
  }

  return rate;
}

/*
 * =========================================================
 * MAIN UNIT
 * =========================================================
 *
 * Satuan utama HARUS Barang.unit.
 *
 * baseUnit hanya fallback apabila data lama
 * ternyata Barang.unit kosong.
 */

function getMainUnit(
  barang: BarangUnitInfo
): string {
  return (
    String(
      barang.unit || ""
    ).trim() ||
    String(
      barang.baseUnit || ""
    ).trim() ||
    ""
  );
}

/*
 * =========================================================
 * BASE UNIT
 * =========================================================
 */

function getBaseUnit(
  barang: BarangUnitInfo
): string {
  return (
    String(
      barang.baseUnit || ""
    ).trim() ||
    getMainUnit(barang)
  );
}

/*
 * =========================================================
 * CONVERTED STOCK
 * =========================================================
 *
 * Stock utama TIDAK diubah.
 *
 * Hanya menghitung informasi konversi.
 */

function calculateConvertedStock(
  stockQty: number,
  barang: BarangUnitInfo
) {
  const mainUnit =
    getMainUnit(barang);

  const baseUnit =
    getBaseUnit(barang);

  const conversionRate =
    getConversionRate(barang);

  const convertedQty =
    stockQty *
    conversionRate;

  return {
    mainQty: stockQty,

    mainUnit,

    convertedQty,

    convertedUnit:
      baseUnit,

    conversionRate,

    conversionLabel:
      conversionRate !== 1
        ? `1 ${mainUnit} = ${conversionRate} ${baseUnit}`
        : `1 ${mainUnit}`,
  };
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
      Number(
        sessionData?.id
      );

    if (
      !Number.isInteger(
        userId
      ) ||
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
    // 3. LOAD USER LOGIN
    // =====================================================

    const user =
      await prisma.user.findUnique(
        {
          where: {
            id: userId,
          },

          select: {
            id: true,
            username: true,
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
        }
      );

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
    // 5. NORMALIZE ROLE
    // =====================================================

    const role =
      normalizeRole(
        user.role
      );

    const outletAdmin =
      isOutletAdminRole(
        role
      );

    const centralRole =
      isCentralRole(
        role
      );

    // =====================================================
    // 6. ROLE ACCESS
    // =====================================================

    const allowedRoles = [
      "ADMIN",
      "MANAGER",
      "OUTLET_ADMIN",
      "ADMIN_OUTLET",
    ];

    if (
      !allowedRoles.includes(
        role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses stock outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // 7. QUERY PARAMETER
    // =====================================================

    const {
      searchParams,
    } = new URL(
      req.url
    );

    const outletIdParam =
      searchParams.get(
        "outletId"
      );

    // =====================================================
    // 8. RESOLVE OUTLET SCOPE
    // =====================================================

    let outletId:
      | number
      | null = null;

    let outletLocked =
      false;

    // =====================================================
    // OUTLET ADMIN
    // =====================================================

    if (
      outletAdmin
    ) {
      outletLocked = true;

      /*
       * SECURITY:
       *
       * outletIdParam SENGAJA TIDAK DIGUNAKAN.
       *
       * Authority berasal dari:
       *
       * user.outletId
       */

      if (
        user.outletId === null ||
        user.outletId === undefined ||
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

    // =====================================================
    // ADMIN / MANAGER
    // =====================================================

    else if (
      centralRole
    ) {
      /*
       * ADMIN dan MANAGER boleh melihat
       * semua outlet apabila outletId tidak dikirim.
       */

      if (
        outletIdParam !==
        null
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
    // 9. VALIDATE SELECTED OUTLET
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

      /*
       * SECURITY CHECK
       */

      if (
        outletAdmin &&
        selectedOutlet.id !==
          user.outletId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda tidak memiliki akses ke outlet ini",
          },
          {
            status: 403,
          }
        );
      }

      /*
       * SECURITY CHECK RELASI USER -> OUTLET
       */

      if (
        outletAdmin &&
        (
          !user.outlet ||
          user.outlet.id !==
            user.outletId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Relasi user dan outlet tidak valid",
          },
          {
            status: 403,
          }
        );
      }

      /*
       * SECURITY CHECK STATUS OUTLET USER
       */

      if (
        outletAdmin &&
        user.outlet &&
        !user.outlet.active
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet user sedang tidak aktif",
          },
          {
            status: 403,
          }
        );
      }
    }

    // =====================================================
    // 10. WHERE OUTLET STOCK
    // =====================================================

    const stockWhere: {
      outletId?: number;
    } = {};

    if (
      outletId !== null
    ) {
      stockWhere.outletId =
        outletId;
    }

    // =====================================================
    // 11. GET OUTLET STOCK
    // =====================================================

    const stocks =
      await prisma.outletStock.findMany(
        {
          where:
            stockWhere,

          select: {
            id: true,

            outletId: true,

            barangId: true,

            stock: true,

            minimumStock: true,

            averageCost: true,

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

                purchasePrice: true,

                sellingPrice: true,

                minimumStock: true,
              },
            },
          },

          orderBy: [
            {
              outlet: {
                name: "asc",
              },
            },
            {
              barang: {
                name: "asc",
              },
            },
          ],
        }
      );

    // =====================================================
    // 12. BUILD BARANG ID LIST
    // =====================================================

    const barangIds =
      Array.from(
        new Set(
          stocks.map(
            (stock) =>
              stock.barangId
          )
        )
      );

    // =====================================================
    // 13. GET LAST TRANSACTION PRICE
    // =====================================================
    //
    // SUMBER HARGA:
    //
    // ReceiptItem.price
    //
    // Urutan:
    //
    // Receipt.receiptDate DESC
    // ReceiptItem.id DESC
    //
    // Karena semua receipt dikumpulkan sekaligus,
    // kita kemudian mengambil transaksi pertama untuk
    // masing-masing barang.
    //
    // =====================================================

    const latestReceiptItems =
      barangIds.length > 0
        ? await prisma.receiptItem.findMany(
            {
              where: {
                barangId: {
                  in: barangIds,
                },
              },

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

                    supplierId: true,

                    supplier: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                      },
                    },
                  },
                },
              },

              orderBy: [
                {
                  receipt: {
                    receiptDate:
                      "desc",
                  },
                },
                {
                  id: "desc",
                },
              ],
            }
          )
        : [];

    // =====================================================
    // 14. MAP LAST PRICE
    // =====================================================

    const latestPriceByBarang =
      new Map<
        number,
        LatestPriceInfo
      >();

    /*
     * Karena data sudah diurutkan DESC,
     * item pertama yang ditemukan adalah transaksi
     * Barang Masuk terakhir untuk barang tersebut.
     */

    for (
      const item of latestReceiptItems
    ) {
      if (
        latestPriceByBarang.has(
          item.barangId
        )
      ) {
        continue;
      }

      const rawPrice =
        Number(
          item.price
        );

      const safePrice =
        Number.isFinite(
          rawPrice
        )
          ? rawPrice
          : 0;

      latestPriceByBarang.set(
        item.barangId,
        {
          barangId:
            item.barangId,

          latestPurchasePrice:
            safePrice,

          latestPurchasePriceFormatted:
            formatRupiah(
              safePrice
            ),

          latestTransactionDate:
            item.receipt
              ?.receiptDate ??
            null,

          latestReceiptNumber:
            item.receipt
              ?.number ??
            null,

          latestSupplierId:
            item.receipt
              ?.supplierId ??
            null,

          latestSupplier:
            item.receipt
              ?.supplier
              ? {
                  id:
                    item.receipt
                      .supplier.id,

                  code:
                    item.receipt
                      .supplier.code ??
                    null,

                  name:
                    item.receipt
                      .supplier.name,
                }
              : null,

          source:
            "ReceiptItem.price",

          hasTransaction:
            true,
        }
      );
    }

    // =====================================================
    // 15. STOCK OPNAME
    // =====================================================

    const opnameWhere: {
      outletId?: number;
    } = {};

    if (
      outletId !== null
    ) {
      opnameWhere.outletId =
        outletId;
    }

    const opnameList =
      await prisma.stockOpname.findMany(
        {
          where:
            opnameWhere,

          orderBy: [
            {
              date: "desc",
            },
            {
              id: "desc",
            },
          ],

          select: {
            id: true,

            code: true,

            outletId: true,

            date: true,

            status: true,

            createdAt: true,

            approvedBy: true,

            outlet: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },

            items: {
              select: {
                id: true,

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
                  },
                },
              },
            },
          },
        }
      );

    // =====================================================
    // 16. MAP OPNAME HISTORY
    // =====================================================

    type OpnameHistoryItem = {
      opnameId: number;
      code: string;
      outletId: number;
      date: Date;
      status: string;
      createdAt: Date;
      approvedBy: number | null;

      systemQty: number;
      physicalQty: number;
      difference: number;
      note: string | null;

      barang: {
        id: number;
        code: string;
        name: string;
        unit: string;
        baseUnit: string | null;
        conversionRate: number;
      } | null;
    };

    const opnameHistoryByBarang =
      new Map<
        string,
        OpnameHistoryItem[]
      >();

    // =====================================================
    // 17. BUILD OPNAME HISTORY
    // =====================================================

    for (
      const opname of opnameList
    ) {
      for (
        const item of opname.items
      ) {
        const key =
          `${opname.outletId}-${item.barangId}`;

        const history =
          opnameHistoryByBarang.get(
            key
          ) || [];

        const rawConversionRate =
          Number(
            item.barang
              ?.conversionRate ??
              1
          );

        const safeConversionRate =
          Number.isFinite(
            rawConversionRate
          ) &&
          rawConversionRate > 0
            ? rawConversionRate
            : 1;

        history.push({
          opnameId:
            opname.id,

          code:
            opname.code,

          outletId:
            opname.outletId!,

          date:
            opname.date,

          status:
            String(
              opname.status
            ),

          createdAt:
            opname.createdAt,

          approvedBy:
            opname.approvedBy ??
            null,

          systemQty:
            getSafeNumber(
              item.systemQty
            ),

          physicalQty:
            getSafeNumber(
              item.physicalQty
            ),

          difference:
            getSafeNumber(
              item.difference
            ),

          note:
            item.note ??
            null,

          barang:
            item.barang
              ? {
                  id:
                    item.barang.id,

                  code:
                    item.barang.code,

                  name:
                    item.barang.name,

                  unit:
                    item.barang.unit,

                  baseUnit:
                    item.barang
                      .baseUnit,

                  conversionRate:
                    safeConversionRate,
                }
              : null,
        });

        opnameHistoryByBarang.set(
          key,
          history
        );
      }
    }

    // =====================================================
    // 18. COMBINE STOCK + OPNAME + PRICE
    // =====================================================

    const data =
      stocks.map(
        (stock) => {
          const key =
            `${stock.outletId}-${stock.barangId}`;

          const opnameHistory =
            opnameHistoryByBarang.get(
              key
            ) || [];

          const lastOpname =
            opnameHistory.length >
            0
              ? opnameHistory[0]
              : null;

          const barang =
            stock.barang as BarangUnitInfo;

          // =================================================
          // MAIN UNIT
          // =================================================

          const mainUnit =
            getMainUnit(
              barang
            );

          const baseUnit =
            getBaseUnit(
              barang
            );

          const conversionRate =
            getConversionRate(
              barang
            );

          // =================================================
          // STOCK
          // =================================================

          const stockQty =
            getSafeNumber(
              stock.stock
            );

          // =================================================
          // CONVERSION
          // =================================================

          const converted =
            calculateConvertedStock(
              stockQty,
              barang
            );

          // =================================================
          // MINIMUM STOCK
          // =================================================

          const minimumStock =
            getSafeNumber(
              stock.minimumStock
            );

          const minimumConvertedQty =
            minimumStock *
            conversionRate;

          // =================================================
          // LAST PRICE
          // =================================================

          const transactionPrice =
            latestPriceByBarang.get(
              stock.barangId
            );

          /*
           * Jika belum pernah ada transaksi Barang Masuk,
           * jangan membuat harga transaksi palsu.
           *
           * Gunakan Barang.purchasePrice hanya sebagai
           * fallback informasi master.
           */

          const price: LatestPriceInfo =
            transactionPrice
              ? transactionPrice
              : {
                  barangId:
                    stock.barangId,

                  latestPurchasePrice:
                    null,

                  latestPurchasePriceFormatted:
                    null,

                  latestTransactionDate:
                    null,

                  latestReceiptNumber:
                    null,

                  latestSupplierId:
                    null,

                  latestSupplier:
                    null,

                  source:
                    "NO_TRANSACTION",

                  hasTransaction:
                    false,
                };

          const masterPurchasePrice =
            getSafeNumber(
              stock.barang
                .purchasePrice
            );

          // =================================================
          // RETURN ITEM
          // =================================================

          return {
            ...stock,

            /*
             * STOCK UTAMA
             */
            stock:
              stockQty,

            minimumStock:
              minimumStock,

            averageCost:
              getSafeNumber(
                stock.averageCost
              ),

            /*
             * BARANG
             */
            barang: {
              ...stock.barang,

              /*
               * Satuan utama tetap Barang.unit
               */
              unit:
                stock.barang.unit,

              /*
               * Informasi konversi
               */
              baseUnit,

              conversionRate,

              displayUnit:
                mainUnit,

              conversionLabel:
                converted.conversionLabel,

              /*
               * Display stock utama
               */
              stockDisplayQty:
                stockQty,

              stockDisplayUnit:
                mainUnit,

              /*
               * Display hasil konversi
               */
              convertedStockQty:
                converted.convertedQty,

              convertedStockUnit:
                converted.convertedUnit,

              /*
               * Minimum stock
               */
              minimumStockDisplayQty:
                minimumStock,

              minimumStockDisplayUnit:
                mainUnit,

              minimumStockConvertedQty:
                minimumConvertedQty,

              minimumStockConvertedUnit:
                baseUnit,
            },

            /*
             * =================================================
             * PRICE TABLE
             * =================================================
             *
             * Harga transaksi Barang Masuk terakhir.
             */
            price: {
              latestPurchasePrice:
                price.latestPurchasePrice,

              latestPurchasePriceFormatted:
                price.latestPurchasePriceFormatted,

              latestTransactionDate:
                price.latestTransactionDate,

              latestReceiptNumber:
                price.latestReceiptNumber,

              latestSupplierId:
                price.latestSupplierId,

              latestSupplier:
                price.latestSupplier,

              source:
                price.source,

              hasTransaction:
                price.hasTransaction,

              /*
               * Harga master tetap disimpan terpisah.
               */
              masterPurchasePrice,

              masterPurchasePriceFormatted:
                formatRupiah(
                  masterPurchasePrice
                ),
            },

            /*
             * FIELD DISPLAY UTAMA
             */
            displayQty:
              stockQty,

            displayUnit:
              mainUnit,

            /*
             * STOCK CONVERTED
             */
            convertedStockQty:
              converted.convertedQty,

            convertedStockUnit:
              converted.convertedUnit,

            /*
             * KONVERSI
             */
            baseQty:
              stockQty,

            baseUnit,

            conversionRate,

            conversionLabel:
              converted.conversionLabel,

            /*
             * MINIMUM
             */
            minimumStockBaseQty:
              minimumStock,

            minimumStockDisplayQty:
              minimumStock,

            minimumStockDisplayUnit:
              mainUnit,

            minimumStockConvertedQty:
              minimumConvertedQty,

            minimumStockConvertedUnit:
              baseUnit,

            /*
             * OPNAME
             */
            lastOpname,

            opnameHistory,
          };
        }
      );

    // =====================================================
    // 19. PRICE SUMMARY
    // =====================================================

    const itemsWithLatestPrice =
      data.filter(
        (item) =>
          item.price
            ?.hasTransaction ===
          true
      ).length;

    const itemsWithoutLatestPrice =
      data.length -
      itemsWithLatestPrice;

    // =====================================================
    // 20. STOCK SUMMARY
    // =====================================================

    const totalStockQty =
      data.reduce(
        (
          total,
          item
        ) =>
          total +
          getSafeNumber(
            item.stock
          ),
        0
      );

    const totalConvertedStockQty =
      data.reduce(
        (
          total,
          item
        ) =>
          total +
          getSafeNumber(
            item.convertedStockQty
          ),
        0
      );

    const itemsWithOpname =
      data.filter(
        (item) =>
          item.lastOpname !==
          null
      ).length;

    const itemsWithoutOpname =
      data.length -
      itemsWithOpname;

    const approvedOpnameCount =
      opnameList.filter(
        (item) =>
          String(
            item.status
          ).toUpperCase() ===
          "APPROVED"
      ).length;

    const pendingOpnameCount =
      opnameList.filter(
        (item) =>
          [
            "COUNTING",
            "PENDING",
            "WAITING",
          ].includes(
            String(
              item.status
            ).toUpperCase()
          )
      ).length;

    // =====================================================
    // 21. RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      /*
       * ===================================================
       * ACCESS SCOPE
       * ===================================================
       */

      scope: {
        role:
          role,

        outletId,

        locked:
          outletLocked,

        canViewAll:
          centralRole,

        canFilterOutlet:
          centralRole,

        outletSource:
          outletAdmin
            ? "user.outletId"
            : "query-or-all",

        queryOutletId:
          outletIdParam,
      },

      /*
       * ===================================================
       * USER
       * ===================================================
       */

      user: {
        id:
          user.id,

        username:
          user.username,

        fullname:
          user.fullname,

        role:
          role,

        outletId:
          user.outletId,

        outlet:
          user.outlet,
      },

      /*
       * ===================================================
       * SELECTED OUTLET
       * ===================================================
       */

      selected: {
        outlet:
          selectedOutlet,
      },

      /*
       * ===================================================
       * DATA
       * ===================================================
       */

      data,

      /*
       * ===================================================
       * PRICE TABLE META
       * ===================================================
       */

      priceTable: {
        source:
          "ReceiptItem.price",

        dateSource:
          "Receipt.receiptDate",

        order:
          "Receipt.receiptDate DESC, ReceiptItem.id DESC",

        description:
          "Harga terakhir diambil dari transaksi Barang Masuk terakhir untuk masing-masing barang.",

        itemsWithLatestPrice,

        itemsWithoutLatestPrice,

        fallbackMasterPrice:
          "Barang.purchasePrice",
      },

      /*
       * ===================================================
       * SUMMARY
       * ===================================================
       */

      summary: {
        totalStockItems:
          data.length,

        totalStockQty,

        totalConvertedStockQty,

        itemsWithOpname,

        itemsWithoutOpname,

        opnameLoaded:
          opnameList.length,

        approvedOpnameCount,

        pendingOpnameCount,

        /*
         * PRICE
         */
        itemsWithLatestPrice,

        itemsWithoutLatestPrice,

        latestPriceTransactionsLoaded:
          latestReceiptItems.length,
      },

      /*
       * ===================================================
       * META
       * ===================================================
       */

      meta: {
        totalStockItems:
          data.length,

        totalStockQty,

        totalConvertedStockQty,

        itemsWithOpname,

        itemsWithoutOpname,

        opnameLoaded:
          opnameList.length,

        approvedOpnameCount,

        pendingOpnameCount,

        /*
         * =================================================
         * PRICE
         * =================================================
         */

        price: {
          source:
            "ReceiptItem.price",

          transactionSource:
            "Receipt",

          dateField:
            "Receipt.receiptDate",

          receiptNumberField:
            "Receipt.number",

          supplierSource:
            "Receipt.supplier",

          latestPriceRule:
            "Untuk setiap barang, gunakan harga ReceiptItem.price dari Receipt dengan receiptDate paling baru.",

          masterPriceFallback:
            "Barang.purchasePrice",

          transactionPriceIsAuthoritative:
            true,
        },

        /*
         * =================================================
         * STOCK SOURCE
         * =================================================
         */

        stockSource:
          "OutletStock.stock",

        /*
         * Endpoint READ ONLY
         */
        stockLocked:
          true,

        /*
         * Stock opname hanya informasi
         */
        opnameIsInformational:
          true,

        /*
         * Adjustment harus melalui flow approval
         */
        adjustmentRequiresApproval:
          true,

        /*
         * =================================================
         * UNIT SYSTEM
         * =================================================
         */

        mainUnitSource:
          "Barang.unit",

        conversionSource:
          "Barang.conversionRate",

        convertedUnitSource:
          "Barang.baseUnit",

        unitSystem: {
          mainUnit:
            "Barang.unit",

          convertedUnit:
            "Barang.baseUnit",

          conversionRate:
            "Barang.conversionRate",

          rule:
            "Stock utama tetap menggunakan Barang.unit. Stock setelah konversi hanya informasi tambahan.",
        },

        /*
         * =================================================
         * ACCESS RULE
         * =================================================
         */

        accessRule: {
          ADMIN:
            "Bisa melihat semua outlet dan filter outlet.",

          MANAGER:
            "Bisa melihat semua outlet dan filter outlet.",

          OUTLET_ADMIN:
            "Hanya bisa melihat outlet miliknya. outletId dari URL diabaikan.",

          ADMIN_OUTLET:
            "Hanya bisa melihat outlet miliknya. outletId dari URL diabaikan.",
        },

        /*
         * =================================================
         * SECURITY
         * =================================================
         */

        security: {
          outletAdminAuthority:
            "user.outletId",

          queryOutletIdTrusted:
            false,

          outletAdminCanOverrideOutletId:
            false,

          endpointReadOnly:
            true,

          outletRelationRequired:
            true,

          outletRelationMustMatchOutletId:
            true,

          outletAdminOutletMustBeActive:
            true,
        },
      },
    });
  } catch (error: any) {
    console.error(
      "GET OUTLET STOCK ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil stock outlet",
      },
      {
        status: 500,
      }
    );
  }
}