import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * CURRENT USER
 * =========================================================
 */

async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  try {
    const sessionData = JSON.parse(session.value);

    const userId = Number(
      sessionData?.id ??
        sessionData?.user?.id
    );

    if (!Number.isInteger(userId) || userId <= 0) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        role: true,
        outletId: true,
        active: true,
      },
    });

    if (!user || !user.active) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/*
 * =========================================================
 * ROLE
 * =========================================================
 */

function isCenterUser(role: string) {
  return (
    role === "ADMIN" ||
    role === "MANAGER"
  );
}

function isOutletAdmin(role: string) {
  return role === "OUTLET_ADMIN";
}

function isAllowedRole(role: string) {
  return (
    isCenterUser(role) ||
    isOutletAdmin(role) ||
    role === "PURCHASING"
  );
}

/*
 * =========================================================
 * ID
 * =========================================================
 */

function validId(value: unknown) {
  const id = Number(value);

  return (
    Number.isInteger(id) &&
    id > 0
  );
}

/*
 * =========================================================
 * NUMBER
 * =========================================================
 */

function normalizeNumber(
  value: unknown,
  fallback = 0
) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function normalizeConversionRate(
  value: unknown
) {
  const rate = Number(value);

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
 * UNIT
 *
 * KONSEP BARU:
 *
 * barang.unit
 * -> PURCHASE UNIT
 *
 * barang.baseUnit
 * -> BASE UNIT
 *
 * OutletStock.stock
 * -> SELALU BASE UNIT
 *
 * BOM / RECIPE
 * -> SELALU BASE UNIT
 *
 * MANUFACTURE
 * -> SELALU BASE UNIT
 *
 * Conversion hanya dilakukan saat:
 *
 * PURCHASE / RECEIPT
 * purchase unit -> base unit
 * =========================================================
 */

function getUnitInfo(barang: {
  unit: string;
  baseUnit: string | null;
  conversionRate: number;
}) {
  const purchaseUnit =
    String(
      barang.unit || ""
    ).trim();

  const baseUnit =
    String(
      barang.baseUnit ||
        purchaseUnit
    ).trim();

  const conversionRate =
    normalizeConversionRate(
      barang.conversionRate
    );

  const hasConversion =
    Boolean(
      purchaseUnit &&
        baseUnit &&
        purchaseUnit !==
          baseUnit &&
        conversionRate !== 1
    );

  return {
    purchaseUnit,
    baseUnit,
    conversionRate,
    hasConversion,

    conversionLabel:
      hasConversion
        ? `1 ${purchaseUnit} = ${conversionRate} ${baseUnit}`
        : `1 ${purchaseUnit}`,

    /*
     * Stock selalu base unit.
     */
    stockUnit:
      baseUnit,

    /*
     * BOM selalu base unit.
     */
    bomUnit:
      baseUnit,

    /*
     * Manufacture selalu base unit.
     */
    manufactureUnit:
      baseUnit,
  };
}

/*
 * =========================================================
 * GET DETAIL
 *
 * PARAMETER ID = OutletBarang.id
 *
 * Mengembalikan:
 *
 * - Barang Central
 * - Outlet
 * - OutletBarang
 * - OutletStock
 * - Purchase Unit
 * - Base Unit
 * - Stock Base Unit
 *
 * PENTING:
 *
 * OutletStock.stock sekarang dianggap BASE UNIT.
 *
 * Contoh:
 *
 * Purchase:
 * 5 DUS
 *
 * Conversion:
 * 1 DUS = 24 PCS
 *
 * Receipt:
 * 5 DUS -> 120 PCS
 *
 * OutletStock.stock:
 * 120
 *
 * Maka:
 *
 * stock = 120 PCS
 * baseStock = 120 PCS
 *
 * BUKAN:
 *
 * 120 x 24
 * =========================================================
 */

export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    /*
     * =====================================================
     * SESSION
     * =====================================================
     */

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session sudah tidak aktif",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * =====================================================
     * ROLE
     * =====================================================
     */

    if (!isAllowedRole(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak memiliki akses",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * ID
     * =====================================================
     */

    const { id } =
      await context.params;

    if (!validId(id)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID master barang outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const outletBarangId =
      Number(id);

    /*
     * =====================================================
     * QUERY
     * =====================================================
     */

    const data =
      await prisma.outletBarang.findUnique(
        {
          where: {
            id:
              outletBarangId,
          },

          include: {
            outlet: true,

            barang: {
              include: {
                outletStocks: {
                  where: {
                    outletId:
                      undefined,
                  },
                },
              },
            },
          },
        }
      );

    /*
     * Karena Prisma tidak membutuhkan outletStocks
     * semua outlet, kita ambil stock spesifik outlet
     * secara terpisah setelah mendapatkan data.
     */

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * =====================================================
     * SECURITY OUTLET ADMIN
     * =====================================================
     */

    if (
      isOutletAdmin(
        user.role
      )
    ) {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User belum memiliki outlet",
          },
          {
            status: 400,
          }
        );
      }

      if (
        data.outletId !==
        Number(
          user.outletId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda tidak memiliki akses ke barang outlet ini",
          },
          {
            status: 403,
          }
        );
      }
    }

    /*
     * =====================================================
     * BARANG HARUS CENTRAL
     * =====================================================
     */

    if (
      data.barang.source !==
      "CENTRAL"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang outlet harus berasal dari Master Barang Central",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * STOCK SPESIFIK OUTLET
     * =====================================================
     */

    const stockRecord =
      await prisma.outletStock.findUnique(
        {
          where: {
            outletId_barangId: {
              outletId:
                data.outletId,

              barangId:
                data.barangId,
            },
          },
        }
      );

    /*
     * =====================================================
     * UNIT
     * =====================================================
     */

    const unitInfo =
      getUnitInfo(
        data.barang
      );

    /*
     * =====================================================
     * STOCK
     *
     * STOCK = BASE UNIT
     * =====================================================
     */

    const stock =
      normalizeNumber(
        stockRecord?.stock,
        0
      );

    const minimumStock =
      normalizeNumber(
        stockRecord?.minimumStock ??
          data.barang.minimumStock,
        0
      );

    const averageCost =
      normalizeNumber(
        stockRecord?.averageCost,
        0
      );

    /*
     * Jangan dikali conversion lagi.
     *
     * Karena OutletStock.stock sudah base unit.
     */

    const baseStock =
      stock;

    const baseMinimumStock =
      minimumStock;

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      data: {
        ...data,

        /*
         * OutletBarang
         */
        outletBarang: {
          id:
            data.id,

          outletId:
            data.outletId,

          barangId:
            data.barangId,

          harga:
            data.harga,

          aktif:
            data.aktif,

          createdAt:
            data.createdAt,

          updatedAt:
            data.updatedAt,
        },

        barang: {
          ...data.barang,

          /*
           * Purchase Unit
           */
          unit:
            unitInfo.purchaseUnit,

          purchaseUnit:
            unitInfo.purchaseUnit,

          /*
           * Base Unit
           */
          baseUnit:
            unitInfo.baseUnit,

          conversionRate:
            unitInfo.conversionRate,

          hasConversion:
            unitInfo.hasConversion,

          conversionLabel:
            unitInfo.conversionLabel,

          /*
           * Semua operasi inventory
           * menggunakan base unit.
           */
          stockUnit:
            unitInfo.stockUnit,

          stockBaseUnit:
            unitInfo.baseUnit,

          bomUnit:
            unitInfo.bomUnit,

          manufactureUnit:
            unitInfo.manufactureUnit,

          /*
           * Stock outlet.
           */
          outletStock:
            stockRecord
              ? {
                  ...stockRecord,

                  stock,

                  /*
                   * Alias eksplisit.
                   */
                  baseStock,

                  minimumStock,

                  baseMinimumStock,

                  averageCost,

                  purchaseUnit:
                    unitInfo.purchaseUnit,

                  unit:
                    unitInfo.stockUnit,

                  stockUnit:
                    unitInfo.stockUnit,

                  baseUnit:
                    unitInfo.baseUnit,

                  conversionRate:
                    unitInfo.conversionRate,
                }
              : {
                  id: null,

                  outletId:
                    data.outletId,

                  barangId:
                    data.barangId,

                  stock: 0,

                  baseStock: 0,

                  minimumStock,

                  baseMinimumStock,

                  averageCost,

                  updatedAt: null,

                  purchaseUnit:
                    unitInfo.purchaseUnit,

                  unit:
                    unitInfo.stockUnit,

                  stockUnit:
                    unitInfo.stockUnit,

                  baseUnit:
                    unitInfo.baseUnit,

                  conversionRate:
                    unitInfo.conversionRate,
                },
        },

        /*
         * =================================================
         * UNIT OBJECT
         * =================================================
         */

        unit: {
          purchaseUnit:
            unitInfo.purchaseUnit,

          baseUnit:
            unitInfo.baseUnit,

          conversionRate:
            unitInfo.conversionRate,

          hasConversion:
            unitInfo.hasConversion,

          conversionLabel:
            unitInfo.conversionLabel,

          stockUnit:
            unitInfo.stockUnit,

          bomUnit:
            unitInfo.bomUnit,

          manufactureUnit:
            unitInfo.manufactureUnit,

          policy:
            "Purchase menggunakan purchase unit. Stock, BOM, dan Manufacture menggunakan base unit.",
        },

        /*
         * =================================================
         * STOCK OBJECT
         * =================================================
         */

        stockInfo: {
          stock,

          baseStock,

          unit:
            unitInfo.baseUnit,

          baseUnit:
            unitInfo.baseUnit,

          minimumStock,

          baseMinimumStock,

          averageCost,

          policy:
            "OutletStock.stock disimpan dalam base unit.",
        },
      },
    });
  } catch (error: any) {
    console.error(
      "GET DETAIL MASTER BARANG OUTLET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil detail barang outlet",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * =========================================================
 * PUT
 *
 * Yang boleh diubah:
 *
 * - harga outlet
 * - aktif
 *
 * Yang TIDAK boleh:
 *
 * - barangId
 * - outletId
 * - unit
 * - baseUnit
 * - conversionRate
 * - Barang Central
 * - stock
 * - averageCost
 *
 * Satuan selalu mengikuti Master Barang Central.
 * =========================================================
 */

export async function PUT(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    /*
     * =====================================================
     * SESSION
     * =====================================================
     */

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session sudah tidak aktif",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * =====================================================
     * ROLE
     * =====================================================
     */

    if (!isAllowedRole(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak memiliki akses",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * ID
     * =====================================================
     */

    const { id } =
      await context.params;

    if (!validId(id)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID master barang outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const outletBarangId =
      Number(id);

    /*
     * =====================================================
     * DATA EXISTING
     * =====================================================
     */

    const existing =
      await prisma.outletBarang.findUnique(
        {
          where: {
            id:
              outletBarangId,
          },

          include: {
            outlet: true,
            barang: true,
          },
        }
      );

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * =====================================================
     * SECURITY
     * =====================================================
     */

    if (
      isOutletAdmin(
        user.role
      )
    ) {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User belum memiliki outlet",
          },
          {
            status: 400,
          }
        );
      }

      if (
        existing.outletId !==
        Number(
          user.outletId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda tidak memiliki akses mengubah barang outlet ini",
          },
          {
            status: 403,
          }
        );
      }
    }

    /*
     * =====================================================
     * OUTLET AKTIF
     * =====================================================
     */

    if (
      !existing.outlet.active
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
     * =====================================================
     * BARANG CENTRAL
     * =====================================================
     */

    if (
      existing.barang.source !==
      "CENTRAL"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang outlet harus berasal dari Master Barang Central",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * BODY
     * =====================================================
     */

    let body: any;

    try {
      body =
        await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Request tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * HARGA
     * =====================================================
     */

    let harga =
      Number(
        existing.harga ?? 0
      );

    if (
      body?.harga !==
        undefined &&
      body?.harga !==
        null &&
      body?.harga !== ""
    ) {
      harga =
        Number(
          body.harga
        );

      if (
        !Number.isFinite(
          harga
        ) ||
        harga < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Harga outlet tidak valid",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * =====================================================
     * AKTIF
     * =====================================================
     */

    let aktif =
      Boolean(
        existing.aktif
      );

    if (
      body?.aktif !==
      undefined
    ) {
      if (
        typeof body.aktif !==
        "boolean"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Status aktif tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      aktif =
        body.aktif;
    }

    /*
     * =====================================================
     * UPDATE
     *
     * HANYA:
     *
     * harga
     * aktif
     *
     * Tidak menyentuh Barang Central.
     * =====================================================
     */

    const updated =
      await prisma.outletBarang.update(
        {
          where: {
            id:
              outletBarangId,
          },

          data: {
            harga,
            aktif,
          },

          include: {
            outlet: true,
            barang: true,
          },
        }
      );

    /*
     * =====================================================
     * UNIT RESPONSE
     * =====================================================
     */

    const unitInfo =
      getUnitInfo(
        updated.barang
      );

    return NextResponse.json({
      success: true,

      message:
        "Barang outlet berhasil diperbarui",

      data: {
        ...updated,

        unit:
          unitInfo.purchaseUnit,

        purchaseUnit:
          unitInfo.purchaseUnit,

        baseUnit:
          unitInfo.baseUnit,

        conversionRate:
          unitInfo.conversionRate,

        hasConversion:
          unitInfo.hasConversion,

        conversionLabel:
          unitInfo.conversionLabel,

        stockUnit:
          unitInfo.stockUnit,

        bomUnit:
          unitInfo.bomUnit,

        manufactureUnit:
          unitInfo.manufactureUnit,
      },

      policy: {
        masterBarang:
          "Barang tetap berasal dari Master Barang Central.",

        editable:
          "Outlet hanya dapat mengubah harga outlet dan status aktif.",

        unit:
          "Satuan mengikuti Master Barang Central.",

        stock:
          "Stock tidak diubah melalui endpoint master barang outlet.",
      },
    });
  } catch (error: any) {
    console.error(
      "PUT MASTER BARANG OUTLET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal memperbarui barang outlet",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * =========================================================
 * DELETE
 *
 * PENTING:
 *
 * JANGAN DELETE ROW OutletBarang.
 *
 * Karena:
 *
 * Barang Central
 * + OutletBarang
 * + OutletStock
 *
 * adalah struktur master baru.
 *
 * Maka DELETE dari UI diterjemahkan menjadi:
 *
 * OutletBarang.aktif = false
 *
 * Barang Central TIDAK DIHAPUS.
 *
 * OutletStock TIDAK DIHAPUS.
 *
 * Dengan demikian barang dapat diaktifkan kembali.
 *
 * Data transaksi lama tetap aman.
 * =========================================================
 */

export async function DELETE(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    /*
     * =====================================================
     * SESSION
     * =====================================================
     */

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session sudah tidak aktif",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * =====================================================
     * ROLE
     * =====================================================
     */

    if (!isAllowedRole(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak memiliki akses",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * ID
     * =====================================================
     */

    const { id } =
      await context.params;

    if (!validId(id)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID master barang outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const outletBarangId =
      Number(id);

    /*
     * =====================================================
     * DATA EXISTING
     * =====================================================
     */

    const existing =
      await prisma.outletBarang.findUnique(
        {
          where: {
            id:
              outletBarangId,
          },

          include: {
            outlet: true,
            barang: true,
          },
        }
      );

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * =====================================================
     * SECURITY OUTLET ADMIN
     * =====================================================
     */

    if (
      isOutletAdmin(
        user.role
      )
    ) {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User belum memiliki outlet",
          },
          {
            status: 400,
          }
        );
      }

      if (
        existing.outletId !==
        Number(
          user.outletId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda tidak memiliki akses mengubah barang outlet ini",
          },
          {
            status: 403,
          }
        );
      }
    }

    /*
     * =====================================================
     * OUTLET AKTIF
     * =====================================================
     */

    if (
      !existing.outlet.active
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
     * =====================================================
     * BARANG HARUS CENTRAL
     * =====================================================
     */

    if (
      existing.barang.source !==
      "CENTRAL"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang outlet harus berasal dari Master Barang Central",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * CEK STOCK
     *
     * OutletStock.stock = BASE UNIT
     * =====================================================
     */

    const stock =
      await prisma.outletStock.findUnique(
        {
          where: {
            outletId_barangId: {
              outletId:
                existing.outletId,

              barangId:
                existing.barangId,
            },
          },

          select: {
            stock: true,
          },
        }
      );

    const currentStock =
      normalizeNumber(
        stock?.stock,
        0
      );

    /*
     * Jika masih ada stock,
     * jangan nonaktifkan mapping.
     *
     * Stock harus dibereskan melalui:
     *
     * - penjualan
     * - transfer
     * - waste
     * - adjustment
     * - stock opname
     *
     * sesuai alur inventory.
     */

    if (
      currentStock > 0
    ) {
      const unitInfo =
        getUnitInfo(
          existing.barang
        );

      return NextResponse.json(
        {
          success: false,

          message:
            `Barang tidak dapat dinonaktifkan karena stock outlet masih ${currentStock} ${unitInfo.baseUnit}.`,

          stock: {
            quantity:
              currentStock,

            unit:
              unitInfo.baseUnit,

            purchaseUnit:
              unitInfo.purchaseUnit,

            baseUnit:
              unitInfo.baseUnit,
          },
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * SOFT DELETE
     *
     * HANYA NONAKTIFKAN MAPPING.
     *
     * TIDAK MENGHAPUS:
     *
     * - Barang
     * - OutletStock
     * - transaksi
     * - histori
     * =====================================================
     */

    const updated =
      await prisma.outletBarang.update(
        {
          where: {
            id:
              outletBarangId,
          },

          data: {
            aktif:
              false,
          },

          include: {
            outlet: true,
            barang: true,
          },
        }
      );

    return NextResponse.json({
      success: true,

      message:
        "Barang berhasil dinonaktifkan dari outlet. Master Barang Central dan data stock tetap aman.",

      data: {
        id:
          updated.id,

        outletId:
          updated.outletId,

        barangId:
          updated.barangId,

        aktif:
          updated.aktif,

        harga:
          updated.harga,

        barang: {
          id:
            updated.barang.id,

          code:
            updated.barang.code,

          name:
            updated.barang.name,

          unit:
            updated.barang.unit,

          baseUnit:
            updated.barang.baseUnit ||
            updated.barang.unit,

          conversionRate:
            normalizeConversionRate(
              updated.barang
                .conversionRate
            ),
        },
      },

      policy: {
        delete:
          "Delete outlet menggunakan soft delete melalui aktif=false.",

        barang:
          "Barang Central tidak dihapus.",

        stock:
          "OutletStock tidak dihapus.",

        transactions:
          "Transaksi lama tidak diubah.",

        restore:
          "Barang dapat diaktifkan kembali melalui PUT aktif=true.",
      },
    });
  } catch (error: any) {
    console.error(
      "DELETE MASTER BARANG OUTLET ERROR:",
      error
    );

    if (
      error?.code ===
      "P2003"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang tidak dapat diubah karena masih memiliki relasi transaksi.",
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menonaktifkan barang outlet",
      },
      {
        status: 500,
      }
    );
  }
}
