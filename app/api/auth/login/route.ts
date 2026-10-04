import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    const user = await prisma.user.findUnique({
      where: {
        username,
      },
      include: {
        outlet: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        message: "Username tidak ditemukan",
      });
    }

    if (!user.active) {
      return NextResponse.json({
        success: false,
        message: "User tidak aktif",
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return NextResponse.json({
        success: false,
        message: "Password salah",
      });
    }

    /*
     * STAFF_OUTLET wajib mempunyai outlet.
     *
     * Role lain tetap boleh mempunyai outletId null
     * sesuai struktur user yang sekarang.
     */
    if (user.role === "STAFF_OUTLET" && !user.outletId) {
      return NextResponse.json({
        success: false,
        message: "User STAFF_OUTLET belum memiliki outlet",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        outletId: user.outletId ?? null,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "1d",
      }
    );

    const response = NextResponse.json({
      success: true,
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch {
    return NextResponse.json({
      success: false,
      message: "Server Error",
    });
  }
}