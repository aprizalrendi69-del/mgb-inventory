import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * GET STOCK OUTLET
 * =========================================================
 *
 * ATURAN:
 *
 * ADMIN
 * -> bisa melihat semua outlet
 * -> bisa filter outletId
 *
 * MANAGER
 * -> bisa melihat semua outlet
 * -> bisa filter outletId
 *
 * OUTLET_ADMIN
 * -> hanya bisa melihat outlet miliknya
 * -> outletId dari URL diabaikan
 *
 * =========================================================
 * SATUAN
 * =========================================================
 *
 * SATUAN UTAMA TETAP:
 *
 * Barang.unit
 *
 * Jangan mengganti satuan utama dengan baseUnit.
 *
 * Contoh:
 *
 * unit           = DUS
 * baseUnit       = PCS
 * conversionRate = 24
 *
 * Tampilan utama:
 *
 * 10 DUS
 *
 * Informasi konversi:
 *
 * 10 DUS = 240 PCS
 *
 * =========================================================
 * STOCK
 * =========================================================
 *
 * Endpoint ini hanya READ.
 *
 * Tidak melakukan:
 *
 * -> adjustment
 * -> stock opname adjustment
 * -> update OutletStock
 * -> update Barang.stock
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

function getSafeNumber(value: unknown): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
}

function getConversionRate(
  barang: BarangUnitInfo
): number {
  const rate = Number(barang.conversionRate);

  if (!Number.isFinite(rate) || rate <= 0) {
    return 1;
  }

  return rate;
}

/*
 * SATUAN UTAMA.
 *
 * Selalu ambil dari Barang.unit terlebih dahulu.
 */
function getMainUnit(
  barang: BarangUnitInfo
): string {
  return (
    String(barang.unit || "").trim() ||
    String(barang.baseUnit || "").trim() ||
    ""
  );
}

function getBaseUnit(
  barang: BarangUnitInfo
): string {
  return (
    String(barang.baseUnit || "").trim() ||
    getMainUnit(barang)
  );
}

/*
 * Stock utama menggunakan satuan Barang.unit.
 *
 * Nilai stock yang diterima dari OutletStock
 * dianggap sebagai stock utama yang sudah digunakan
 * oleh sistem outlet.
 *
 * Konversi hanya ditampilkan sebagai informasi tambahan.
 */
function calculateConvertedStock(
  stockQty: number,
  barang: BarangUnitInfo
) {
  const mainUnit = getMainUnit(barang);
  const baseUnit = getBaseUnit(barang);
  const conversionRate = getConversionRate(barang);

  /*
   * Stock setelah konversi.
   *
   * Contoh:
   *
   * stock = 10
   * unit = DUS
   * baseUnit = PCS
   * rate = 24
   *
   * convertedQty = 240 PCS
   */
  const convertedQty =
    stockQty * conversionRate;

  return {
    mainQty: stockQty,
    mainUnit,

    convertedQty,
    convertedUnit: baseUnit,

    conversionRate,

    conversionLabel:
      conversionRate !== 1
        ? `1 ${mainUnit} = ${conversionRate} ${baseUnit}`
        : `1 ${mainUnit}`,
  };
}

export async function GET(
  req: NextRequest
) {
  try {
    // =====================================================
    // 1. SESSION
    // =====================================================

    const cookieStore = await cookies();

    const session =
      cookieStore.get("erp-session");

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
      sessionData = JSON.parse(
        session.value
      );
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

    const userId = Number(
      sessionData?.id
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
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
    // 3. USER LOGIN
    // =====================================================

    const user =
      await prisma.user.findUnique({
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
    // 4. USER AKTIF
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
    // 5. ROLE ACCESS
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
            "Anda tidak memiliki akses stock outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // 6. QUERY PARAMETER
    // =====================================================

    const { searchParams } =
      new URL(req.url);

    const outletIdParam =
      searchParams.get("outletId");

    let outletId:
      | number
      | null = null;

    // =====================================================
    // 7. OUTLET ADMIN
    // =====================================================

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

      /*
       * SECURITY:
       *
       * outletId dari URL tidak dipercaya.
       */
      outletId =
        user.outletId;
    }

    // =====================================================
    // 8. ADMIN / MANAGER
    // =====================================================

    else if (
      user.role === "ADMIN" ||
      user.role === "MANAGER"
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
    // 9. VALIDASI OUTLET
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
    // 10. WHERE STOCK
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
    // 11. AMBIL OUTLET STOCK
    // =====================================================

    const stocks =
      await prisma.outletStock.findMany(
        {
          where: stockWhere,

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

                /*
                 * SATUAN UTAMA.
                 *
                 * Ini yang dipakai frontend sebagai
                 * satuan utama.
                 */
                unit: true,

                /*
                 * Informasi tambahan konversi.
                 */
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
    // 12. STOCK OPNAME
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
          where: opnameWhere,

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
    // 13. MAP HISTORY OPNAME
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
    // 14. BANGUN HISTORY
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

        const conversionRate =
          Number(
            item.barang
              ?.conversionRate ?? 1
          );

        const safeConversionRate =
          Number.isFinite(
            conversionRate
          ) &&
          conversionRate > 0
            ? conversionRate
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
            opname.status,

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
    // 15. GABUNGKAN STOCK
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
            opnameHistory.length > 0
              ? opnameHistory[0]
              : null;

          const barang =
            stock.barang as BarangUnitInfo;

          /*
           * SATUAN UTAMA.
           *
           * Tidak diganti baseUnit.
           */
          const mainUnit =
            getMainUnit(barang);

          const baseUnit =
            getBaseUnit(barang);

          const conversionRate =
            getConversionRate(barang);

          /*
           * Stock utama.
           */
          const stockQty =
            getSafeNumber(
              stock.stock
            );

          /*
           * Stock setelah konversi.
           *
           * Hanya informasi tambahan.
           */
          const converted =
            calculateConvertedStock(
              stockQty,
              barang
            );

          /*
           * Minimum stock.
           */
          const minimumStock =
            getSafeNumber(
              stock.minimumStock
            );

          const minimumConvertedQty =
            minimumStock *
            conversionRate;

          return {
            ...stock,

            /*
             * =================================================
             * STOCK UTAMA
             * =================================================
             *
             * Tetap menggunakan angka stock yang sekarang.
             */
            stock: stockQty,

            minimumStock,

            averageCost:
              getSafeNumber(
                stock.averageCost
              ),

            /*
             * =================================================
             * BARANG
             * =================================================
             */
            barang: {
              ...stock.barang,

              /*
               * SATUAN LAMA / UTAMA
               */
              unit:
                stock.barang.unit,

              /*
               * INFORMASI KONVERSI
               */
              baseUnit,

              conversionRate,

              /*
               * Untuk frontend.
               */
              displayUnit:
                mainUnit,

              conversionLabel:
                converted.conversionLabel,

              /*
               * Stock utama.
               */
              stockDisplayQty:
                stockQty,

              stockDisplayUnit:
                mainUnit,

              /*
               * Stock setelah konversi.
               */
              convertedStockQty:
                converted.convertedQty,

              convertedStockUnit:
                converted.convertedUnit,

              /*
               * Minimum stock.
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
             * FIELD UTAMA STOCK
             * =================================================
             */

            displayQty:
              stockQty,

            displayUnit:
              mainUnit,

            /*
             * =================================================
             * STOCK SETELAH KONVERSI
             * =================================================
             */

            convertedStockQty:
              converted.convertedQty,

            convertedStockUnit:
              converted.convertedUnit,

            /*
             * =================================================
             * KONVERSI
             * =================================================
             */

            baseQty:
              stockQty,

            baseUnit,

            conversionRate,

            conversionLabel:
              converted.conversionLabel,

            /*
             * =================================================
             * MINIMUM
             * =================================================
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
             * =================================================
             * STOCK OPNAME
             * =================================================
             */

            lastOpname,

            opnameHistory,
          };
        }
      );

    // =====================================================
    // 16. SUMMARY
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
    // 17. RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      scope: {
        role: user.role,
        outletId,
      },

      user: {
        id: user.id,
        fullname:
          user.fullname,
        role: user.role,
        outletId:
          user.outletId,
        outlet:
          user.outlet,
      },

      selected: {
        outlet:
          selectedOutlet,
      },

      data,

      summary: {
        totalStockItems:
          data.length,

        /*
         * Stock utama.
         */
        totalStockQty,

        /*
         * Stock setelah konversi.
         */
        totalConvertedStockQty,

        itemsWithOpname,

        itemsWithoutOpname,

        opnameLoaded:
          opnameList.length,

        approvedOpnameCount,

        pendingOpnameCount,
      },

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
         * Stock utama tidak diubah
         * oleh endpoint ini.
         */
        stockSource:
          "OutletStock.stock",

        stockLocked: true,

        opnameIsInformational:
          true,

        adjustmentRequiresApproval:
          true,

        /*
         * =================================================
         * SATUAN
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