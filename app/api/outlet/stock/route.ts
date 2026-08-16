import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  try {
    // =====================================================
    // CEK SESSION USER LOGIN
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
    // PARSE SESSION
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

    if (!sessionData?.id) {
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
    // AMBIL USER LOGIN
    // =====================================================

    const user = await prisma.user.findUnique({
      where: {
        id: Number(sessionData.id),
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
    // USER HARUS MEMILIKI OUTLET
    // =====================================================

    if (!user.outletId || !user.outlet) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak terhubung dengan outlet",
        },
        {
          status: 400,
        }
      );
    }

    const outletId = Number(user.outletId);

    // =====================================================
    // AMBIL STOCK HANYA OUTLET LOGIN
    // =====================================================

    const stocks = await prisma.outletStock.findMany({
      where: {
        outletId: outletId,
      },

      include: {
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
            purchasePrice: true,
            sellingPrice: true,
          },
        },
      },

      orderBy: {
        barang: {
          name: "asc",
        },
      },
    });

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      outlet: {
        id: user.outlet.id,
        code: user.outlet.code,
        name: user.outlet.name,
      },

      data: stocks,
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