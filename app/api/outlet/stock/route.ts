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
 * ADMIN / MANAGER
 * -> bisa melihat semua outlet
 * -> bisa filter outletId
 *
 * OUTLET_ADMIN / ADMIN_OUTLET / STAFF_OUTLET
 * -> hanya bisa melihat outlet miliknya
 * -> outletId dari URL TIDAK dipercaya
 * -> outletId selalu berasal dari user.outletId
 *
 * =========================================================
 * SECURITY
 * =========================================================
 *
 * Authority outlet untuk outlet user:
 *
 *     user.outletId
 *
 * BUKAN:
 *
 *     ?outletId=
 *
 * Endpoint ini READ ONLY.
 *
 * =========================================================
 * STOCK SOURCE
 * =========================================================
 *
 * Sumber stock:
 *
 *     OutletStock.stock
 *
 * Endpoint ini TIDAK:
 *
 * -> melakukan adjustment
 * -> mengubah OutletStock
 * -> mengubah Barang.stock
 * -> melakukan stock opname adjustment
 *
 * =========================================================
 * UNIT
 * =========================================================
 *
 * Main Unit:
 *
 *     Barang.unit
 *
 * Base Unit:
 *
 *     Barang.baseUnit
 *
 * Conversion:
 *
 *     Barang.conversionRate
 *
 * Rule:
 *
 *     stock utama tetap menggunakan Barang.unit.
 *
 * Hasil konversi hanya informasi tambahan.
 *
 * =========================================================
 * CATEGORY
 * =========================================================
 *
 * Kategori barang berasal dari:
 *
 *     Barang.category
 *
 * Category merupakan field scalar String pada Barang,
 * bukan relation Prisma.
 *
 * =========================================================
 * PRICE
 * =========================================================
 *
 * Harga outlet menggunakan prioritas:
 *
 * 1. OutletReceiptItem.price dari transaksi outlet TERAKHIR
 *    berdasarkan kombinasi:
 *
 *       outletId + barangId
 *
 * 2. Jika belum ada transaksi outlet:
 *
 *       OutletBarang.harga
 *
 * 3. Jika keduanya tidak tersedia:
 *
 *       null
 *
 * PENTING:
 *
 * Barang.purchasePrice TIDAK digunakan sebagai fallback
 * harga outlet.
 *
 * Barang.purchasePrice tetap dikirim sebagai:
 *
 *     masterPurchasePrice
 *
 * hanya sebagai informasi master barang.
 *
 * =========================================================
 */

type BarangUnitInfo = {
  id: number;
  code: string;
  name: string;
  category: string | null;
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
  outletId: number;

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

  source:
    | "OutletReceiptItem.price"
    | "OutletBarang.harga"
    | "NO_PRICE";

  hasTransaction: boolean;
};

/*
 * =========================================================
 * SAFE NUMBER
 * =========================================================
 */

function getSafeNumber(value: unknown): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
}

/*
 * =========================================================
 * RUPIAH
 * =========================================================
 */

function formatRupiah(
  value: number | null
): string | null {
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
 * ROLE
 * =========================================================
 */

function normalizeRole(
  value: unknown
): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function isOutletAdminRole(
  role: unknown
): boolean {
  const normalizedRole =
    normalizeRole(role);

  return (
    normalizedRole === "OUTLET_ADMIN" ||
    normalizedRole === "ADMIN_OUTLET"
  );
}

/*
 * =========================================================
 * OUTLET USER ROLE
 * =========================================================
 *
 * Role yang hanya boleh melihat outlet miliknya.
 *
 * Authority outlet tetap:
 *
 *     user.outletId
 *
 * Bukan:
 *
 *     query ?outletId=
 */

function isOutletScopedRole(
  role: unknown
): boolean {
  const normalizedRole =
    normalizeRole(role);

  return (
    normalizedRole === "OUTLET_ADMIN" ||
    normalizedRole === "ADMIN_OUTLET" ||
    normalizedRole === "STAFF_OUTLET"
  );
}

function isCentralRole(
  role: unknown
): boolean {
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
 * PRIORITAS:
 *
 * 1. Barang.unit
 * 2. Barang.baseUnit
 *
 * Untuk data lama yang mungkin kosong.
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
 * STOCK CONVERSION
 * =========================================================
 *
 * Contoh:
 *
 * stock = 10
 * unit = BOX
 * conversionRate = 12
 * baseUnit = PCS
 *
 * hasil:
 *
 * mainQty       = 10
 * mainUnit      = BOX
 * convertedQty  = 120
 * convertedUnit = PCS
 *
 * Stock utama TIDAK diubah.
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
    /*
     * =====================================================
     * 1. SESSION
     * =====================================================
     */

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

    /*
     * =====================================================
     * 2. PARSE SESSION
     * =====================================================
     */

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

    /*
     * =====================================================
     * 3. LOAD USER
     * =====================================================
     */

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

    /*
     * =====================================================
     * 4. USER ACTIVE
     * =====================================================
     */

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

    /*
     * =====================================================
     * 5. ROLE
     * =====================================================
     */

    const role =
      normalizeRole(
        user.role
      );

    /*
     * OUTLET_ADMIN / ADMIN_OUTLET / STAFF_OUTLET
     * semuanya menggunakan outlet dari session/user.
     */

    const outletScopedRole =
      isOutletScopedRole(
        role
      );

    const outletAdmin =
      isOutletAdminRole(
        role
      );

    const centralRole =
      isCentralRole(
        role
      );

    /*
     * Variabel tetap dipertahankan untuk kompatibilitas
     * dengan logic role existing.
     */

    void outletAdmin;

    const allowedRoles = [
      "ADMIN",
      "MANAGER",
      "OUTLET_ADMIN",
      "ADMIN_OUTLET",
      "STAFF_OUTLET",
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

    /*
     * =====================================================
     * 6. QUERY PARAMETER
     * =====================================================
     */

    const searchParams =
      new URL(
        req.url
      ).searchParams;

    const outletIdParam =
      searchParams.get(
        "outletId"
      );

    /*
     * =====================================================
     * 7. RESOLVE OUTLET SCOPE
     * =====================================================
     */

    let outletId:
      | number
      | null = null;

    let outletLocked =
      false;

    /*
     * =====================================================
     * OUTLET-SCOPED ROLE
     * =====================================================
     *
     * OUTLET_ADMIN / ADMIN_OUTLET / STAFF_OUTLET
     *
     * outletId dari URL DIABAIKAN.
     */

    if (outletScopedRole) {
      outletLocked = true;

      /*
       * User outlet wajib valid.
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

      /*
       * Authority berasal dari user.outletId.
       */

      outletId =
        user.outletId;
    }

    /*
     * =====================================================
     * ADMIN / MANAGER
     * =====================================================
     */

    else if (centralRole) {
      /*
       * Tanpa outletId:
       *
       * -> semua outlet
       */

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

    /*
     * =====================================================
     * 8. VALIDATE SELECTED OUTLET
     * =====================================================
     */

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
       * SECURITY:
       * OUTLET-SCOPED USER TIDAK BOLEH PINDAH OUTLET
       * ===================================================
       */

      if (
        outletScopedRole &&
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
       * SECURITY:
       * RELASI USER -> OUTLET
       * ===================================================
       */

      if (
        outletScopedRole &&
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
       * SECURITY:
       * OUTLET USER HARUS AKTIF
       * ===================================================
       */

      if (
        outletScopedRole &&
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

    /*
     * =====================================================
     * 9. OUTLET STOCK WHERE
     * =====================================================
     */

    const stockWhere: {
      outletId?: number;
    } = {};

    if (
      outletId !== null
    ) {
      stockWhere.outletId =
        outletId;
    }

    /*
     * =====================================================
     * 10. GET OUTLET STOCK
     * =====================================================
     */

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
                 * =================================================
                 * CATEGORY BARANG
                 * =================================================
                 *
                 * Barang.category adalah field scalar String.
                 */

                category: true,

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

    /*
     * =====================================================
     * 11. BARANG IDS
     * =====================================================
     */

    const barangIds =
      Array.from(
        new Set(
          stocks.map(
            (stock) =>
              stock.barangId
          )
        )
      );

    /*
     * =====================================================
     * 12. GET LAST OUTLET RECEIPT PRICE
     * =====================================================
     *
     * PENTING:
     *
     * Harga transaksi harus spesifik berdasarkan:
     *
     *     outletId + barangId
     *
     * BUKAN hanya barangId.
     *
     * Sumber:
     *
     *     OutletReceiptItem.price
     *
     * Relasi:
     *
     *     OutletReceiptItem.receipt
     *
     * Urutan:
     *
     *     OutletReceipt.receiptDate DESC
     *     OutletReceiptItem.id DESC
     *
     * Jika outletId null, berarti ADMIN/MANAGER melihat
     * semua outlet. Karena harga bersifat outlet-specific,
     * hasil transaksi dipetakan berdasarkan kombinasi
     * outletId + barangId.
     */

    const latestOutletReceiptItems =
      barangIds.length > 0
        ? await prisma.outletReceiptItem.findMany(
            {
              where: {
                barangId: {
                  in: barangIds,
                },

                ...(outletId !== null
                  ? {
                      receipt: {
                        outletId,
                      },
                    }
                  : {}),
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

                    outletId: true,

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

    /*
     * =====================================================
     * 13. MAP LAST OUTLET PRICE
     * =====================================================
     *
     * Key:
     *
     *     outletId-barangId
     *
     * Dengan begitu barang yang sama di outlet berbeda
     * tidak akan memakai harga transaksi outlet lain.
     */

    const latestPriceByOutletBarang =
      new Map<
        string,
        LatestPriceInfo
      >();

    for (
      const item of latestOutletReceiptItems
    ) {
      const itemOutletId =
        Number(
          item.receipt?.outletId
        );

      if (
        !Number.isInteger(
          itemOutletId
        ) ||
        itemOutletId <= 0
      ) {
        continue;
      }

      const key =
        `${itemOutletId}-${item.barangId}`;

      /*
       * Karena data sudah diurutkan DESC,
       * item pertama adalah transaksi terakhir.
       */

      if (
        latestPriceByOutletBarang.has(
          key
        )
      ) {
        continue;
      }

      const rawPrice =
        Number(
          item.price
        );

      /*
       * Price yang tidak valid dianggap null,
       * bukan dipaksakan menjadi harga master Barang.
       */

      const safePrice =
        Number.isFinite(
          rawPrice
        )
          ? rawPrice
          : null;

      latestPriceByOutletBarang.set(
        key,
        {
          barangId:
            item.barangId,

          outletId:
            itemOutletId,

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
            "OutletReceiptItem.price",

          hasTransaction:
            true,
        }
      );
    }

    /*
     * =====================================================
     * 14. GET OUTLET BARANG MASTER
     * =====================================================
     *
     * OutletBarang merupakan mapping barang ke outlet.
     *
     * Unique:
     *
     *     outletId + barangId
     *
     * Harga:
     *
     *     OutletBarang.harga
     *
     * Ini menjadi FALLBACK jika belum ada transaksi
     * OutletReceiptItem untuk outlet + barang tersebut.
     */

    const outletBarangList =
      stocks.length > 0
        ? await prisma.outletBarang.findMany(
            {
              where: {
                OR: stocks.map(
                  (stock) => ({
                    outletId:
                      stock.outletId,

                    barangId:
                      stock.barangId,
                  })
                ),
              },

              select: {
                id: true,

                outletId: true,

                barangId: true,

                harga: true,

                aktif: true,
              },
            }
          )
        : [];

    /*
     * =====================================================
     * 15. MAP OUTLET BARANG PRICE
     * =====================================================
     */

    const outletBarangPriceByKey =
      new Map<
        string,
        number | null
      >();

    for (
      const outletBarang
      of outletBarangList
    ) {
      const key =
        `${outletBarang.outletId}-${outletBarang.barangId}`;

      const rawHarga =
        outletBarang.harga === null ||
        outletBarang.harga === undefined
          ? null
          : Number(
              outletBarang.harga
            );

      const safeHarga =
        rawHarga !== null &&
        Number.isFinite(
          rawHarga
        )
          ? rawHarga
          : null;

      outletBarangPriceByKey.set(
        key,
        safeHarga
      );
    }

    /*
     * =====================================================
     * 16. STOCK OPNAME
     * =====================================================
     *
     * Stock opname di endpoint ini hanya INFORMASI.
     *
     * Tidak melakukan adjustment.
     */

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

                    /*
                     * Category juga ditambahkan
                     * pada data stock opname.
                     */

                    category: true,

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

    /*
     * =====================================================
     * 17. OPNAME HISTORY TYPE
     * =====================================================
     */

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
        category: string | null;
        unit: string;
        baseUnit: string | null;
        conversionRate: number;
      } | null;
    };

    /*
     * =====================================================
     * 18. OPNAME HISTORY MAP
     * =====================================================
     */

    const opnameHistoryByBarang =
      new Map<
        string,
        OpnameHistoryItem[]
      >();

    /*
     * =====================================================
     * 19. BUILD OPNAME HISTORY
     * =====================================================
     */

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

                  category:
                    item.barang
                      .category ??
                    null,

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

    /*
     * =====================================================
     * 20. COMBINE STOCK + PRICE + OPNAME
     * =====================================================
     */

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

          /*
           * =================================================
           * CATEGORY
           * =================================================
           */

          const category =
            String(
              barang.category ??
              ""
            ).trim() || null;

          /*
           * =================================================
           * UNIT
           * =================================================
           */

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

          /*
           * =================================================
           * STOCK
           * =================================================
           */

          const stockQty =
            getSafeNumber(
              stock.stock
            );

          /*
           * =================================================
           * CONVERSION
           * =================================================
           */

          const converted =
            calculateConvertedStock(
              stockQty,
              barang
            );

          /*
           * =================================================
           * MINIMUM STOCK
           * =================================================
           */

          const minimumStock =
            getSafeNumber(
              stock.minimumStock
            );

          const minimumConvertedQty =
            minimumStock *
            conversionRate;

          /*
           * =================================================
           * LAST OUTLET PRICE
           * =================================================
           *
           * PRIORITAS:
           *
           * 1. OutletReceiptItem.price
           * 2. OutletBarang.harga
           * 3. null
           *
           * Tidak pernah mengambil Barang.purchasePrice
           * sebagai fallback harga outlet.
           */

          const transactionPrice =
            latestPriceByOutletBarang.get(
              key
            );

          const outletMasterPrice =
            outletBarangPriceByKey.get(
              key
            );

          let price:
            LatestPriceInfo;

          if (
            transactionPrice
          ) {
            /*
             * Harga transaksi outlet terakhir.
             */

            price =
              transactionPrice;
          } else if (
            outletMasterPrice !==
              undefined &&
            outletMasterPrice !==
              null
          ) {
            /*
             * Belum ada transaksi.
             * Gunakan harga mapping OutletBarang.
             */

            price = {
              barangId:
                stock.barangId,

              outletId:
                stock.outletId,

              latestPurchasePrice:
                outletMasterPrice,

              latestPurchasePriceFormatted:
                formatRupiah(
                  outletMasterPrice
                ),

              latestTransactionDate:
                null,

              latestReceiptNumber:
                null,

              latestSupplierId:
                null,

              latestSupplier:
                null,

              source:
                "OutletBarang.harga",

              hasTransaction:
                false,
            };
          } else {
            /*
             * Tidak ada transaksi dan tidak ada
             * harga OutletBarang.
             */

            price = {
              barangId:
                stock.barangId,

              outletId:
                stock.outletId,

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
                "NO_PRICE",

              hasTransaction:
                false,
            };
          }

          /*
           * =================================================
           * MASTER PURCHASE PRICE
           * =================================================
           *
           * Tetap disediakan sebagai informasi master Barang.
           *
           * TIDAK digunakan sebagai harga outlet.
           */

          const masterPurchasePrice =
            getSafeNumber(
              stock.barang
                .purchasePrice
            );

          /*
           * =================================================
           * RETURN ITEM
           * =================================================
           */

          return {
            ...stock,

            /*
             * =================================================
             * STOCK UTAMA
             * =================================================
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
             * =================================================
             * BARANG
             * =================================================
             */

            barang: {
              ...stock.barang,

              /*
               * Category barang.
               */

              category,

              /*
               * Main unit tetap Barang.unit.
               */

              unit:
                stock.barang.unit,

              baseUnit,

              conversionRate,

              displayUnit:
                mainUnit,

              conversionLabel:
                converted.conversionLabel,

              /*
               * Stock utama
               */

              stockDisplayQty:
                stockQty,

              stockDisplayUnit:
                mainUnit,

              /*
               * Stock hasil konversi
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
             * CATEGORY
             * =================================================
             */

            category,

            /*
             * =================================================
             * PRICE
             * =================================================
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
               * Master price tetap terpisah.
               *
               * Ini BUKAN fallback harga outlet.
               */

              masterPurchasePrice,

              masterPurchasePriceFormatted:
                formatRupiah(
                  masterPurchasePrice
                ),
            },

            /*
             * =================================================
             * DISPLAY
             * =================================================
             */

            displayQty:
              stockQty,

            displayUnit:
              mainUnit,

            /*
             * =================================================
             * CONVERTED STOCK
             * =================================================
             */

            convertedStockQty:
              converted.convertedQty,

            convertedStockUnit:
              converted.convertedUnit,

            /*
             * =================================================
             * CONVERSION
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
             * OPNAME
             * =================================================
             */

            lastOpname,

            opnameHistory,
          };
        }
      );

    /*
     * =====================================================
     * 21. PRICE SUMMARY
     * =====================================================
     */

    const itemsWithLatestPrice =
      data.filter(
        (item) =>
          item.price
            ?.latestPurchasePrice !==
          null
      ).length;

    const itemsWithTransactionPrice =
      data.filter(
        (item) =>
          item.price
            ?.source ===
          "OutletReceiptItem.price"
      ).length;

    const itemsWithOutletMasterPrice =
      data.filter(
        (item) =>
          item.price
            ?.source ===
          "OutletBarang.harga"
      ).length;

    const itemsWithoutLatestPrice =
      data.filter(
        (item) =>
          item.price
            ?.latestPurchasePrice ===
          null
      ).length;

    /*
     * =====================================================
     * 22. STOCK SUMMARY
     * =====================================================
     */

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

    /*
     * =====================================================
     * 23. OPNAME SUMMARY
     * =====================================================
     */

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

    /*
     * =====================================================
     * 24. CATEGORY SUMMARY
     * =====================================================
     */

    const categories =
      Array.from(
        new Set(
          data
            .map(
              (item) =>
                item.category
            )
            .filter(
              (
                category
              ): category is string =>
                Boolean(
                  category
                )
            )
        )
      ).sort(
        (
          a,
          b
        ) =>
          a.localeCompare(
            b,
            "id-ID"
          )
      );

    /*
     * =====================================================
     * 25. CATEGORY SUMMARY COUNT
     * =====================================================
     */

    const categorySummary =
      categories.map(
        (category) => ({
          category,

          itemCount:
            data.filter(
              (item) =>
                item.category ===
                category
            ).length,

          totalStockQty:
            data
              .filter(
                (item) =>
                  item.category ===
                  category
              )
              .reduce(
                (
                  total,
                  item
                ) =>
                  total +
                  getSafeNumber(
                    item.stock
                  ),
                0
              ),

          totalConvertedStockQty:
            data
              .filter(
                (item) =>
                  item.category ===
                  category
              )
              .reduce(
                (
                  total,
                  item
                ) =>
                  total +
                  getSafeNumber(
                    item.convertedStockQty
                  ),
                0
              ),
        })
      );

    /*
     * =====================================================
     * 26. RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      /*
       * ===================================================
       * ACCESS SCOPE
       * ===================================================
       */

      scope: {
        role,

        outletId,

        locked:
          outletLocked,

        canViewAll:
          centralRole,

        canFilterOutlet:
          centralRole,

        outletSource:
          outletScopedRole
            ? "user.outletId"
            : "query-or-all",

        /*
         * Tetap ditampilkan untuk debugging.
         * Tidak menjadi authority outlet scoped user.
         */

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
       * CATEGORY
       * ===================================================
       */

      categoryTable: {
        source:
          "Barang.category",

        totalCategories:
          categories.length,

        categories,

        summary:
          categorySummary,
      },

      /*
       * ===================================================
       * PRICE TABLE
       * ===================================================
       */

      priceTable: {
        source:
          "OutletReceiptItem.price",

        fallbackSource:
          "OutletBarang.harga",

        dateSource:
          "OutletReceipt.receiptDate",

        order:
          "OutletReceipt.receiptDate DESC, OutletReceiptItem.id DESC",

        lookupKey:
          "outletId + barangId",

        description:
          "Harga terakhir diambil dari transaksi Barang Masuk outlet terakhir untuk kombinasi outlet dan barang. Jika belum ada transaksi outlet, digunakan harga OutletBarang.harga.",

        itemsWithLatestPrice,

        itemsWithTransactionPrice,

        itemsWithOutletMasterPrice,

        itemsWithoutLatestPrice,

        fallbackMasterPrice:
          "OutletBarang.harga",

        barangPurchasePriceUsedAsFallback:
          false,
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

        itemsWithLatestPrice,

        itemsWithTransactionPrice,

        itemsWithOutletMasterPrice,

        itemsWithoutLatestPrice,

        latestPriceTransactionsLoaded:
          latestOutletReceiptItems.length,

        outletBarangPriceMappingsLoaded:
          outletBarangList.length,

        totalCategories:
          categories.length,
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
         * CATEGORY
         * =================================================
         */

        category: {
          source:
            "Barang.category",

          type:
            "scalar",

          relation:
            false,

          description:
            "Kategori barang berasal langsung dari field Barang.category.",

          totalCategories:
            categories.length,

          categories,
        },

        /*
         * =================================================
         * PRICE
         * =================================================
         */

        price: {
          source:
            "OutletReceiptItem.price",

          transactionSource:
            "OutletReceipt",

          dateField:
            "OutletReceipt.receiptDate",

          receiptNumberField:
            "OutletReceipt.number",

          supplierSource:
            "OutletReceipt.supplier",

          lookupKey:
            "outletId + barangId",

          latestPriceRule:
            "Untuk setiap kombinasi outlet dan barang, gunakan harga OutletReceiptItem.price dari OutletReceipt dengan receiptDate paling baru.",

          outletMasterFallback:
            "OutletBarang.harga",

          barangPurchasePriceFallback:
            false,

          transactionPriceIsAuthoritative:
            true,

          fallbackOrder: [
            "OutletReceiptItem.price",
            "OutletBarang.harga",
            "NO_PRICE",
          ],
        },

        /*
         * =================================================
         * STOCK
         * =================================================
         */

        stockSource:
          "OutletStock.stock",

        stockLocked:
          true,

        /*
         * =================================================
         * STOCK OPNAME
         * =================================================
         */

        opnameIsInformational:
          true,

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
            "Stock utama tetap menggunakan Barang.unit. Stock hasil konversi hanya informasi tambahan.",
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

          STAFF_OUTLET:
            "Hanya bisa melihat outlet miliknya. outletId dari URL diabaikan.",
        },

        /*
         * =================================================
         * SECURITY
         * =================================================
         */

        security: {
          outletScopedAuthority:
            "user.outletId",

          outletAdminAuthority:
            "user.outletId",

          staffOutletAuthority:
            "user.outletId",

          queryOutletIdTrusted:
            false,

          outletAdminCanOverrideOutletId:
            false,

          staffOutletCanOverrideOutletId:
            false,

          endpointReadOnly:
            true,

          outletRelationRequired:
            true,

          outletRelationMustMatchOutletId:
            true,

          outletAdminOutletMustBeActive:
            true,

          staffOutletOutletMustBeActive:
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