import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("erp-session");

    if (!sessionCookie?.value) {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak ditemukan.",
        },
        { status: 401 }
      );
    }

    let session: { id?: number };

    try {
      session = JSON.parse(sessionCookie.value);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak valid.",
        },
        { status: 401 }
      );
    }

    const userId = Number(session.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak valid.",
        },
        { status: 401 }
      );
    }

    const body = await req.json();

    const photo =
      typeof body.photo === "string"
        ? body.photo.trim()
        : null;

    const fullname =
      typeof body.fullname === "string"
        ? body.fullname.trim()
        : undefined;

    if (fullname !== undefined && !fullname) {
      return NextResponse.json(
        {
          success: false,
          message: "Nama lengkap tidak boleh kosong.",
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        ...(fullname !== undefined
          ? { fullname }
          : {}),
        photo,
      },
      select: {
        id: true,
        username: true,
        fullname: true,
        photo: true,
        role: true,
        outletId: true,
        active: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("PROFILE_UPDATE_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal memperbarui profile.",
      },
      { status: 500 }
    );
  }
}