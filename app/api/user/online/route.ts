import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("erp-session");

    if (!session) {
      return NextResponse.json(
        { success: false },
        { status: 401 }
      );
    }

    const users = await prisma.user.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        fullname: true,
        username: true,
        role: true,
        lastSeen: true,
        outlet: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        fullname: "asc",
      },
    });

    const now = Date.now();

    const data = users.map((user) => {
      const lastSeen = user.lastSeen
        ? new Date(user.lastSeen).getTime()
        : 0;

      // Online jika heartbeat terakhir <= 2 menit
      const online =
        lastSeen > 0 &&
        now - lastSeen <= 120000;

      return {
        id: user.id,
        fullname: user.fullname,
        username: user.username,
        role: user.role,
        outlet: user.outlet?.name ?? "Pusat",
        lastSeen: user.lastSeen,
        online,
      };
    });

    return NextResponse.json({
      success: true,
      users: data,
    });
  } catch (error) {
    console.error("ONLINE USER ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil status user",
      },
      { status: 500 }
    );
  }
}