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
 * Contoh:
 *
 * /api/outlet/stock?outletId=99
 *
 * Jika user adalah OUTLET_ADMIN dan outlet miliknya
 * adalah outlet 3:
 *
 * hasil tetap:
 *
 * outletId = 3
 *
 * BUKAN outletId = 99.
 *
 * =========================================================
 * SATUAN
 * =========================================================
 *
 * SATUAN UTAMA:
 *
 * Barang.unit
 *
 * Contoh:
 *
 * unit           = DUS
 * baseUnit       = PCS
 * conversionRate = 24
 *
 * Stock:
 *
 * 10 DUS
 *
 * Informasi konversi:
 *
 * 10 DUS = 240 PCS
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
  const normalizedRole = normalizeRole(role);

  return (
    normalizedRole === "OUTLET_ADMIN" ||
    normalizedRole === "ADMIN_OUTLET"
  );
}

function isCentralRole(role: unknown): boolean {
  const normalizedRole = normalizeRole(role);

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
    //
    // OUTLET_ADMIN / ADMIN_OUTLET:
    //
    // outletId URL DIABAIKAN.
    //
    // Authority berasal dari:
    //
    // user.outletId
    //
    // ADMIN / MANAGER:
    //
    // boleh:
    //
    // outletId kosong -> semua outlet
    //
    // outletId ada -> outlet tersebut
    //
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
       * ===================================================
       * SECURITY:
       * ===================================================
       *
       * outletIdParam SENGAJA TIDAK DIGUNAKAN.
       *
       * Outlet admin hanya boleh menggunakan
       * outlet yang terhubung pada account user.
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
       * ===================================================
       * SECURITY CHECK
       * ===================================================
       *
       * Untuk outlet admin, outlet yang dipakai HARUS
       * sama persis dengan user.outletId.
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
       * ===================================================
       * SECURITY CHECK RELASI USER -> OUTLET
       * ===================================================
       *
       * Outlet admin WAJIB memiliki relation outlet.
       *
       * Relation tersebut juga WAJIB sama dengan
       * user.outletId.
       *
       * Ini mencegah kondisi data user yang tidak konsisten.
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
       * ===================================================
       * SECURITY CHECK STATUS OUTLET USER
       * ===================================================
       *
       * Outlet yang terhubung ke outlet admin juga
       * harus aktif.
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

                /*
                 * SATUAN UTAMA
                 */
                unit: true,

                /*
                 * KONVERSI
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
    // 13. MAP OPNAME HISTORY
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
    // 14. BUILD OPNAME HISTORY
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
    // 15. COMBINE STOCK + OPNAME
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

      /*
       * ===================================================
       * ACCESS SCOPE
       * ===================================================
       */

      scope: {
        role:
          role,

        /*
         * null =
         * semua outlet
         *
         * number =
         * outlet tertentu
         */
        outletId,

        /*
         * true untuk:
         *
         * OUTLET_ADMIN
         * ADMIN_OUTLET
         */
        locked:
          outletLocked,

        /*
         * Informasi untuk frontend
         */
        canViewAll:
          centralRole,

        canFilterOutlet:
          centralRole,

        /*
         * Informasi eksplisit
         * agar frontend dapat mengetahui
         * bahwa outletId URL tidak dipercaya.
         */
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