import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    /*
     * User dianggap ONLINE apabila heartbeat
     * terakhir masih dalam 2 menit terakhir.
     */
    const cutoff = new Date(Date.now() - 2 * 60 * 1000);

    const users = await prisma.user.findMany({
      where: {
        lastSeen: {
          gte: cutoff,
        },
        active: true,
      },
      select: {
        id: true,
        fullname: true,
        username: true,
        role: true,
        lastSeen: true,
        outletId: true,
        outlet: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        lastSeen: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("GET ONLINE USERS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Data user online gagal dimuat",
      },
      { status: 500 }
    );
  }
}