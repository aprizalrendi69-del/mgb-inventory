import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session) return null;

  try {
    const sessionData = JSON.parse(session.value);

    return await prisma.user.findUnique({
      where: {
        id: sessionData.id,
      },
      select: {
        id: true,
        role: true,
        outletId: true,
      },
    });
  } catch {
    return null;
  }
}

// =========================================================
// GET
// =========================================================

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);

    const search =
      searchParams.get("search")?.trim() || "";

    const requestedOutletId =
      searchParams.get("outletId");

    let outletId: number | null = null;

    // OUTLET ADMIN hanya boleh melihat outlet sendiri
    if (user.role === "OUTLET_ADMIN") {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message: "User belum memiliki outlet",
          },
          { status: 400 }
        );
      }

      outletId = user.outletId;
    }

    // ADMIN / MANAGER / role pusat
    else if (requestedOutletId) {
      const parsed = Number(requestedOutletId);

      if (
        Number.isInteger(parsed) &&
        parsed > 0
      ) {
        outletId = parsed;
      }
    }

    const where: any = {};

    if (outletId) {
      where.outletId = outletId;
    }

    if (search) {
      where.barang = {
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

    const data =
      await prisma.outletBarang.findMany({
        where,

        include: {
          outlet: true,

          barang: {
            include: {
              outletStocks: {
                where: outletId
                  ? {
                      outletId,
                    }
                  : undefined,
              },
            },
          },
        },

        orderBy: {
          id: "desc",
        },
      });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "GET OUTLET MASTER BARANG ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil master barang outlet",
      },
      { status: 500 }
    );
  }
}

// =========================================================
// POST
// DAFTARKAN BARANG CENTRAL KE OUTLET
// =========================================================

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        { status: 401 }
      );
    }

    const body = await req.json();

    const bodyOutletId = body.outletId;
    const bodyBarangId = body.barangId;
    const harga = body.harga;

    let outletId: number;

    // OUTLET ADMIN
    if (user.role === "OUTLET_ADMIN") {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message: "User belum memiliki outlet",
          },
          { status: 400 }
        );
      }

      outletId = user.outletId;
    } else {
      outletId = Number(bodyOutletId);
    }

    if (
      !Number.isInteger(outletId) ||
      outletId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet wajib dipilih",
        },
        { status: 400 }
      );
    }

    const barangId = Number(bodyBarangId);

    if (
      !Number.isInteger(barangId) ||
      barangId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang dari Master Barang Pusat wajib dipilih",
        },
        { status: 400 }
      );
    }

    // CEK OUTLET
    const outlet =
      await prisma.outlet.findUnique({
        where: {
          id: outletId,
        },
      });

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // CEK BARANG CENTRAL
    const barang =
      await prisma.barang.findFirst({
        where: {
          id: barangId,
          source: "CENTRAL",
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

    // CEK SUDAH TERDAFTAR
    const existing =
      await prisma.outletBarang.findUnique({
        where: {
          outletId_barangId: {
            outletId,
            barangId,
          },
        },
      });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang sudah terdaftar di outlet ini",
        },
        { status: 400 }
      );
    }

    // TRANSACTION
    const result =
      await prisma.$transaction(
        async (tx) => {
          const outletBarang =
            await tx.outletBarang.create({
              data: {
                outletId,
                barangId,
                harga:
                  Number(harga) || 0,
                aktif: true,
              },

              include: {
                outlet: true,
                barang: true,
              },
            });

          // BUAT STOCK OUTLET OTOMATIS
          await tx.outletStock.create({
            data: {
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

    return NextResponse.json({
      success: true,
      message:
        "Barang berhasil didaftarkan ke outlet",
      data: result,
    });
  } catch (error) {
    console.error(
      "POST OUTLET MASTER BARANG ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal menambahkan barang outlet",
      },
      { status: 500 }
    );
  }
}