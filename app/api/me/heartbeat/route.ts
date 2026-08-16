import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("erp-session");

    if (!session) {
      return NextResponse.json(
        { success: false },
        { status: 401 }
      );
    }

    let sessionData: { id?: number };

    try {
      sessionData = JSON.parse(session.value);
    } catch {
      return NextResponse.json(
        { success: false },
        { status: 401 }
      );
    }

    if (!sessionData.id) {
      return NextResponse.json(
        { success: false },
        { status: 401 }
      );
    }

    await prisma.user.update({
      where: {
        id: sessionData.id,
      },
      data: {
        lastSeen: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("HEARTBEAT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal update status online",
      },
      { status: 500 }
    );
  }
}