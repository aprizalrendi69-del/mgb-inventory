import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  try {
    // =========================================================
    // GET SESSION
    // =========================================================
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

    // =========================================================
    // PARSE SESSION
    // =========================================================
    let sessionData: { id?: number };

    try {
      sessionData = JSON.parse(session.value);
    } catch (error) {
      console.error("INVALID ERP SESSION:", error);

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
          message: "Session user tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    // =========================================================
    // GET CURRENT USER
    // =========================================================
    const user = await prisma.user.findUnique({
      where: {
        id: Number(sessionData.id),
      },

      select: {
        // =====================================================
        // BASIC USER
        // =====================================================
        id: true,
        username: true,
        fullname: true,
        role: true,
        active: true,
        photo: true,

        // =====================================================
        // OUTLET
        // =====================================================
        outletId: true,

        outlet: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },

        // =====================================================
        // CUSTOMER
        //
        // Customer otomatis mengikuti User yang login.
        // Tidak perlu dipilih dari form Delivery Request.
        // =====================================================
        customerId: true,

        customer: {
          select: {
            id: true,
            code: true,
            name: true,
            address: true,
            city: true,
            phone: true,
            email: true,
            contactPerson: true,
          },
        },
      },
    });

    // =========================================================
    // USER NOT FOUND
    // =========================================================
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

    // =========================================================
    // USER INACTIVE
    // =========================================================
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

    // =========================================================
    // RESPONSE
    // =========================================================
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        role: user.role,
        active: user.active,
        photo: user.photo,

        // Outlet user
        outletId: user.outletId,
        outlet: user.outlet,

        // Customer user
        customerId: user.customerId,
        customer: user.customer,
      },
    });
  } catch (error: any) {
    console.error("ME ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil data user",
      },
      {
        status: 500,
      }
    );
  }
}