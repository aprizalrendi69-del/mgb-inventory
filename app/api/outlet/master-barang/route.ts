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
 * Barang tetap berasal dari Master Barang Central.
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
     * HANYA BARANG CENTRAL
     */

    where.barang = {
      source: "CENTRAL",
    };

    /*
     * SEARCH
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
     * GET
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
              unit: true,
              source: true,
              active: true,

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
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      scope: {
        role: user.role,
        outletId,
      },

      total: data.length,

      data,
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
      Number(body?.harga || 0);

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
          minimumStock: true,
          purchasePrice: true,
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
     * TRANSACTION
     *
     * OutletBarang + OutletStock
     * =====================================================
     */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * CEK OUTLET BARANG
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
             * Pastikan OutletStock ada.
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
           * BUAT OUTLET BARANG
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
           * BUAT STOCK OUTLET
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

    return NextResponse.json(
      {
        success: true,

        message:
          "Barang berhasil didaftarkan ke Master Barang Outlet",

        data: result,
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