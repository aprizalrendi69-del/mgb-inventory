import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";


// =====================================================
// GET USER
// =====================================================

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        id: "asc",
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
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: users,
    });

  } catch (error: any) {
    console.error("GET USER ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: 500,
      }
    );
  }
}


// =====================================================
// CREATE USER
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      username,
      fullname,
      password,
      role,
      outletId,
    } = body;


    // =================================================
    // VALIDASI
    // =================================================

    if (
      !username ||
      !fullname ||
      !password ||
      !role
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Data belum lengkap",
        },
        {
          status: 400,
        }
      );
    }


    // =================================================
    // VALIDASI OUTLET ADMIN
    // =================================================

    if (role === "OUTLET_ADMIN" && !outletId) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet wajib dipilih untuk OUTLET ADMIN",
        },
        {
          status: 400,
        }
      );
    }


    // =================================================
    // CEK USERNAME
    // =================================================

    const exist = await prisma.user.findUnique({
      where: {
        username,
      },
    });

    if (exist) {
      return NextResponse.json(
        {
          success: false,
          message: "Username sudah ada",
        },
        {
          status: 400,
        }
      );
    }


    // =================================================
    // CEK OUTLET
    // =================================================

    let selectedOutletId: number | null = null;

    if (role === "OUTLET_ADMIN") {
      selectedOutletId = Number(outletId);

      if (!Number.isInteger(selectedOutletId)) {
        return NextResponse.json(
          {
            success: false,
            message: "Outlet tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      const outlet = await prisma.outlet.findUnique({
        where: {
          id: selectedOutletId,
        },
      });

      if (!outlet) {
        return NextResponse.json(
          {
            success: false,
            message: "Outlet tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }
    }


    // =================================================
    // HASH PASSWORD
    // =================================================

    const hash = await bcrypt.hash(
      password,
      10
    );


    // =================================================
    // CREATE USER
    // =================================================

    const user = await prisma.user.create({
      data: {
        username,
        fullname,
        password: hash,
        role,
        active: true,

        outletId: selectedOutletId,
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
            name: true,
          },
        },
      },
    });


    return NextResponse.json({
      success: true,
      data: user,
    });


  } catch (error: any) {

    console.error("CREATE USER ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: 500,
      }
    );
  }
}