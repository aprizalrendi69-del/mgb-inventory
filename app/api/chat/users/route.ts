import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function getCurrentUser(request: NextRequest) {
  try {
    const cookie = request.cookies.get("erp-session");

    if (!cookie?.value) {
      return null;
    }

    const sessionData = JSON.parse(cookie.value);

    if (!sessionData?.id) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: Number(sessionData.id),
      },
    });

    if (!user) {
      return null;
    }

    if (!user.active) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("CHAT AUTH ERROR:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const users = await prisma.user.findMany({
      where: {
        active: true,
        id: {
          not: currentUser.id,
        },
      },

      select: {
        id: true,
        username: true,
        fullname: true,
        role: true,
        outletId: true,
        lastSeen: true,

        outlet: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },

      orderBy: {
        fullname: "asc",
      },
    });

    const now = Date.now();

    const result = users.map((user) => {
      const lastSeen = user.lastSeen?.getTime() ?? 0;

      const online =
        lastSeen > 0 &&
        now - lastSeen <= 60 * 1000;

      return {
        ...user,
        online,
      };
    });

    return NextResponse.json({
      success: true,

      currentUser: {
        id: currentUser.id,
        username: currentUser.username,
        fullname: currentUser.fullname,
        role: currentUser.role,
        outletId: currentUser.outletId,
      },

      users: result,
    });
  } catch (error) {
    console.error(
      "GET /api/chat/users error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil daftar user",
      },
      {
        status: 500,
      },
    );
  }
}