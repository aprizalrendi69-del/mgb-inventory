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

  if (!session) return null;

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

function isAllowedRole(role: string) {
  return (
    role === "ADMIN" ||
    role === "MANAGER" ||
    role === "OUTLET_ADMIN"
  );
}

/*
 * =========================================================
 * GET MASTER BARANG OUTLET
 *
 * ADMIN / MANAGER
 * -> semua outlet
 * -> bisa filter outlet
 *
 * OUTLET_ADMIN
 * -> hanya outlet dari session
 *
 * SUMBER DATA:
 * OutletBarang
 *
 * BARANG:
 * -> tetap mengambil master Barang Central
 *
 * SATUAN:
 *
 * unit            = satuan transaksi / satuan utama
 * baseUnit        = satuan dasar
 * conversionRate  = jumlah satuan dasar dalam 1 satuan utama
 *
 * Contoh:
 *
 * unit           = DUS
 * baseUnit       = PCS
 * conversionRate = 24
 *
 * Artinya:
 *
 * 1 DUS = 24 PCS
 *
 * Stock Outlet tetap disimpan pada satuan utama
 * Barang.unit agar konsisten dengan sistem pusat.
 * =========================================================
 */

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session sudah tidak aktif",
        },
        { status: 401 }
      );
    }

    if (!isAllowedRole(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak memiliki akses",
        },
        { status: 403 }
      );
    }

    const { searchParams } =
      new URL(req.url);

    const search =
      searchParams.get("search")?.trim() || "";

    const requestedOutletId =
      searchParams.get("outletId");

    let outletId: number | null = null;

    /*
     * =====================================================
     * OUTLET ADMIN
     * =====================================================
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
              "User outlet belum memiliki outlet",
          },
          { status: 400 }
        );
      }

      outletId = user.outletId;
    }

    /*
     * =====================================================
     * ADMIN / MANAGER
     * =====================================================
     */

    if (isCenterUser(user.role)) {
      if (requestedOutletId !== null) {
        const parsed =
          Number(requestedOutletId);

        if (
          !Number.isInteger(parsed) ||
          parsed <= 0
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Outlet ID tidak valid",
            },
            { status: 400 }
          );
        }

        outletId = parsed;
      }
    }

    /*
     * =====================================================
     * WHERE
     * =====================================================
     */

    const where: any = {};

    if (outletId !== null) {
      where.outletId = outletId;
    }

    /*
     * =====================================================
     * HANYA BARANG CENTRAL
     * =====================================================
     */

    where.barang = {
      source: "CENTRAL",
    };

    /*
     * =====================================================
     * SEARCH
     * =====================================================
     */

    if (search) {
      where.barang = {
        source: "CENTRAL",

        OR: [
          {
            code: {
              contains: search,
            },
          },
          {
            name: {
              contains: search,
            },
          },
          {
            barcode: {
              contains: search,
            },
          },
        ],
      };
    }

    /*
     * =====================================================
     * GET MASTER BARANG OUTLET
     * =====================================================
     */

    const data =
      await prisma.outletBarang.findMany({
        where,

        select: {
          id: true,
          outletId: true,
          barangId: true,
          harga: true,
          aktif: true,
          createdAt: true,
          updatedAt: true,

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
          },

          barang: {
            select: {
              id: true,
              code: true,
              barcode: true,
              name: true,
              category: true,
              brand: true,

              /*
               * =================================================
               * SATUAN
               * =================================================
               *
               * unit:
               * satuan transaksi utama.
               *
               * baseUnit:
               * satuan dasar.
               *
               * conversionRate:
               * 1 unit = conversionRate baseUnit.
               */

              unit: true,
              baseUnit: true,
              conversionRate: true,

              source: true,
              active: true,

              minimumStock: true,
              purchasePrice: true,
              sellingPrice: true,

              outletStocks: {
                where:
                  outletId !== null
                    ? {
                        outletId,
                      }
                    : undefined,

                select: {
                  id: true,
                  stock: true,
                  minimumStock: true,
                  averageCost: true,
                  updatedAt: true,
                },

                take: 1,
              },
            },
          },
        },

        orderBy: {
          id: "desc",
        },
      });

    /*
     * =====================================================
     * FORMAT DATA
     *
     * Kita tambahkan informasi konversi yang siap
     * digunakan oleh frontend outlet.
     *
     * Contoh:
     *
     * unit = DUS
     * baseUnit = PCS
     * conversionRate = 24
     *
     * conversionLabel = "1 DUS = 24 PCS"
     * =====================================================
     */

    const formattedData = data.map(
      (item) => {
        const conversionRate =
          Number(
            item.barang.conversionRate
          ) > 0
            ? Number(
                item.barang.conversionRate
              )
            : 1;

        const unit =
          item.barang.unit || "";

        const baseUnit =
          item.barang.baseUnit ||
          unit;

        const hasConversion =
          Boolean(
            baseUnit &&
              unit &&
              baseUnit !== unit &&
              conversionRate > 1
          );

        return {
          ...item,

          barang: {
            ...item.barang,

            /*
             * Nilai asli master
             */
            unit,
            baseUnit,
            conversionRate,

            /*
             * Informasi tambahan untuk UI
             */
            hasConversion,

            conversionLabel:
              hasConversion
                ? `1 ${unit} = ${conversionRate} ${baseUnit}`
                : `1 ${unit}`,

            /*
             * Stock outlet tetap menggunakan
             * satuan utama Barang.unit.
             */
            stockUnit: unit,

            /*
             * Jika frontend membutuhkan tampilan
             * stock dalam satuan dasar.
             */
            stockBaseUnit:
              hasConversion
                ? baseUnit
                : unit,
          },
        };
      }
    );

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      scope: {
        role: user.role,
        outletId,
      },

      total: formattedData.length,

      data: formattedData,

      meta: {
        stockUnitPolicy:
          "OutletStock disimpan menggunakan satuan utama Barang.unit.",

        conversionPolicy:
          "Konversi mengikuti Barang.baseUnit dan Barang.conversionRate dari Master Barang Central.",

        example:
          "Jika unit = DUS, baseUnit = PCS, conversionRate = 24, maka 1 DUS = 24 PCS.",
      },
    });
  } catch (error: any) {
    console.error(
      "GET OUTLET MASTER BARANG ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil master barang outlet",
      },
      { status: 500 }
    );
  }
}

/*
 * =========================================================
 * POST
 *
 * DAFTARKAN BARANG CENTRAL KE OUTLET
 *
 * SATUAN TIDAK DIINPUT ULANG DI OUTLET.
 *
 * Outlet otomatis mengikuti:
 *
 * Barang.unit
 * Barang.baseUnit
 * Barang.conversionRate
 *
 * dari Master Barang Central.
 * =========================================================
 */

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session sudah tidak aktif",
        },
        { status: 401 }
      );
    }

    if (!isAllowedRole(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak memiliki akses",
        },
        { status: 403 }
      );
    }

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Request tidak valid",
        },
        { status: 400 }
      );
    }

    const requestedOutletId =
      body?.outletId;

    const barangId =
      Number(body?.barangId);

    const harga =
      Number(body?.harga ?? 0);

    /*
     * =====================================================
     * TENTUKAN OUTLET
     * =====================================================
     */

    let outletId: number;

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
              "User belum memiliki outlet",
          },
          { status: 400 }
        );
      }

      outletId = user.outletId;
    } else {
      outletId =
        Number(requestedOutletId);

      if (
        !Number.isInteger(outletId) ||
        outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet wajib dipilih",
          },
          { status: 400 }
        );
      }
    }

    /*
     * =====================================================
     * VALIDASI BARANG
     * =====================================================
     */

    if (
      !Number.isInteger(barangId) ||
      barangId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang Master Central wajib dipilih",
        },
        { status: 400 }
      );
    }

    /*
     * =====================================================
     * VALIDASI HARGA
     * =====================================================
     */

    if (
      !Number.isFinite(harga) ||
      harga < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Harga outlet tidak valid",
        },
        { status: 400 }
      );
    }

    /*
     * =====================================================
     * CEK OUTLET
     * =====================================================
     */

    const outlet =
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

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak ditemukan",
        },
        { status: 404 }
      );
    }

    if (!outlet.active) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet sedang tidak aktif",
        },
        { status: 400 }
      );
    }

    /*
     * =====================================================
     * CEK BARANG CENTRAL
     *
     * SEKALIGUS AMBIL SATUAN
     * =====================================================
     */

    const barang =
      await prisma.barang.findFirst({
        where: {
          id: barangId,
          source: "CENTRAL",
          active: true,
        },

        select: {
          id: true,
          code: true,
          name: true,
          barcode: true,

          /*
           * SATUAN MASTER
           */
          unit: true,
          baseUnit: true,
          conversionRate: true,

          minimumStock: true,
          purchasePrice: true,
          sellingPrice: true,

          source: true,
        },
      });

    if (!barang) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang tidak ditemukan di Master Barang Central",
        },
        { status: 404 }
      );
    }

    /*
     * =====================================================
     * VALIDASI KONVERSI MASTER
     * =====================================================
     *
     * conversionRate minimal 1.
     *
     * Kalau baseUnit kosong:
     * dianggap sama dengan unit.
     *
     * Kita tidak mengubah data master di sini.
     */

    const conversionRate =
      Number(
        barang.conversionRate
      );

    if (
      !Number.isFinite(conversionRate) ||
      conversionRate <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Konversi satuan barang ${barang.code} tidak valid. Conversion rate harus lebih besar dari 0.`,
        },
        { status: 400 }
      );
    }

    const unit =
      barang.unit?.trim() || "";

    const baseUnit =
      barang.baseUnit?.trim() ||
      unit;

    if (!unit) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Satuan utama barang ${barang.code} belum diatur di Master Barang Central.`,
        },
        { status: 400 }
      );
    }

    /*
     * =====================================================
     * TRANSACTION
     *
     * OutletBarang + OutletStock
     * =====================================================
     */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * =================================================
           * CEK OUTLET BARANG
           * =================================================
           */

          const existing =
            await tx.outletBarang.findUnique({
              where: {
                outletId_barangId: {
                  outletId,
                  barangId,
                },
              },
            });

          if (existing) {
            /*
             * Kalau sudah ada:
             *
             * jangan duplicate.
             * aktifkan kembali.
             *
             * Satuan tetap mengikuti Master Barang.
             */

            const updated =
              await tx.outletBarang.update({
                where: {
                  id: existing.id,
                },

                data: {
                  harga,
                  aktif: true,
                },

                include: {
                  outlet: true,
                  barang: true,
                },
              });

            /*
             * =================================================
             * PASTIKAN STOCK OUTLET ADA
             * =================================================
             */

            await tx.outletStock.upsert({
              where: {
                outletId_barangId: {
                  outletId,
                  barangId,
                },
              },

              update: {},

              create: {
                outletId,
                barangId,
                stock: 0,

                minimumStock:
                  barang.minimumStock || 0,

                averageCost:
                  barang.purchasePrice || 0,
              },
            });

            return updated;
          }

          /*
           * =================================================
           * BUAT OUTLET BARANG
           * =================================================
           */

          const outletBarang =
            await tx.outletBarang.create({
              data: {
                outletId,
                barangId,
                harga,
                aktif: true,
              },

              include: {
                outlet: true,
                barang: true,
              },
            });

          /*
           * =================================================
           * BUAT STOCK OUTLET
           * =================================================
           *
           * Stock disimpan dalam satuan utama Barang.unit.
           *
           * Contoh:
           *
           * unit = DUS
           * baseUnit = PCS
           * conversionRate = 24
           *
           * stock = 10
           *
           * berarti:
           *
           * 10 DUS = 240 PCS
           *
           * BUKAN:
           *
           * stock = 240
           */

          await tx.outletStock.upsert({
            where: {
              outletId_barangId: {
                outletId,
                barangId,
              },
            },

            update: {},

            create: {
              outletId,
              barangId,
              stock: 0,

              minimumStock:
                barang.minimumStock || 0,

              averageCost:
                barang.purchasePrice || 0,
            },
          });

          return outletBarang;
        }
      );

    /*
     * =====================================================
     * RESPONSE DATA
     * =====================================================
     */

    const resultBarang =
      result.barang;

    const resultConversionRate =
      Number(
        resultBarang.conversionRate
      ) > 0
        ? Number(
            resultBarang.conversionRate
          )
        : 1;

    const resultUnit =
      resultBarang.unit || "";

    const resultBaseUnit =
      resultBarang.baseUnit ||
      resultUnit;

    const hasConversion =
      Boolean(
        resultUnit &&
          resultBaseUnit &&
          resultUnit !== resultBaseUnit &&
          resultConversionRate > 1
      );

    return NextResponse.json(
      {
        success: true,

        message:
          "Barang berhasil didaftarkan ke Master Barang Outlet",

        data: {
          ...result,

          barang: {
            ...resultBarang,

            /*
             * Satuan Master Central
             */
            unit: resultUnit,
            baseUnit: resultBaseUnit,
            conversionRate:
              resultConversionRate,

            hasConversion,

            conversionLabel:
              hasConversion
                ? `1 ${resultUnit} = ${resultConversionRate} ${resultBaseUnit}`
                : `1 ${resultUnit}`,

            stockUnit: resultUnit,
            stockBaseUnit:
              hasConversion
                ? resultBaseUnit
                : resultUnit,
          },
        },

        unit: {
          unit: resultUnit,
          baseUnit: resultBaseUnit,
          conversionRate:
            resultConversionRate,

          hasConversion,

          conversionLabel:
            hasConversion
              ? `1 ${resultUnit} = ${resultConversionRate} ${resultBaseUnit}`
              : `1 ${resultUnit}`,

          policy:
            "Satuan outlet mengikuti Master Barang Central dan tidak disimpan ulang di OutletBarang.",
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error(
      "POST OUTLET MASTER BARANG ERROR:",
      error
    );

    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang sudah terdaftar di outlet ini",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mendaftarkan barang ke outlet",
      },
      { status: 500 }
    );
  }
}