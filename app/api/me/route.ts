import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  try {
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

    const sessionData = JSON.parse(session.value);

    const user = await prisma.user.findUnique({
      where: {
        id: sessionData.id,
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

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error: any) {
    console.log("ME ERROR:", error);

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