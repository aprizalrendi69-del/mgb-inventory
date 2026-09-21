import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    console.log("========== LOGIN API ==========");

    const body = await req.json();

    const { username, password } = body;

    console.log("LOGIN USERNAME:", username);

    // =========================================================
    // VALIDASI INPUT
    // =========================================================

    if (!username || typeof username !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Username wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Password wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    // =========================================================
    // CARI USER
    // =========================================================

    const user = await prisma.user.findUnique({
      where: {
        username: username.trim(),
      },
      select: {
        id: true,
        username: true,
        password: true,
        fullname: true,
        role: true,
        outletId: true,
        active: true,
        outlet: {
          select: {
            id: true,
            code: true,
            name: true,
            active: true,
          },
        },
      },
    });

    console.log(
      "USER:",
      user
        ? {
            id: user.id,
            username: user.username,
            fullname: user.fullname,
            role: user.role,
            outletId: user.outletId,
          }
        : null
    );

    // =========================================================
    // USER TIDAK DITEMUKAN
    // =========================================================

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Username tidak ditemukan",
        },
        {
          status: 401,
        }
      );
    }

    // =========================================================
    // USER TIDAK AKTIF
    // =========================================================

    if (!user.active) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak aktif",
        },
        {
          status: 401,
        }
      );
    }

    // =========================================================
    // VALIDASI OUTLET UNTUK OUTLET ROLE
    // =========================================================

    const outletRoles = [
      "OUTLET_ADMIN",
      "KASIR",
      "OUTLET_MANUFACTURE",
    ];

    if (outletRoles.includes(user.role)) {
      // Role outlet wajib memiliki outletId
      if (!user.outletId) {
        console.log(
          "LOGIN REJECTED: outletId kosong untuk role",
          user.role
        );

        return NextResponse.json(
          {
            success: false,
            message:
              "User belum terhubung ke outlet. Hubungi Administrator.",
          },
          {
            status: 403,
          }
        );
      }

      // Outlet harus tersedia
      if (!user.outlet) {
        console.log(
          "LOGIN REJECTED: outlet tidak ditemukan",
          user.outletId
        );

        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet user tidak ditemukan. Hubungi Administrator.",
          },
          {
            status: 403,
          }
        );
      }

      // Outlet harus aktif
      if (!user.outlet.active) {
        console.log(
          "LOGIN REJECTED: outlet tidak aktif",
          user.outletId
        );

        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet user sedang tidak aktif. Hubungi Administrator.",
          },
          {
            status: 403,
          }
        );
      }
    }

    // =========================================================
    // VALIDASI PASSWORD
    // =========================================================

    const valid = await bcrypt.compare(
      password,
      user.password
    );

    console.log("PASSWORD VALID:", valid);

    if (!valid) {
      return NextResponse.json(
        {
          success: false,
          message: "Password salah",
        },
        {
          status: 401,
        }
      );
    }

    // =========================================================
    // SESSION DATA
    // =========================================================

    const sessionData = {
      id: user.id,
      username: user.username,
      fullname: user.fullname,
      role: user.role,
      outletId: user.outletId,
    };

    console.log("SESSION:", sessionData);

    // =========================================================
    // RESPONSE
    // =========================================================

    const response = NextResponse.json({
      success: true,

      user: {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        role: user.role,
        outletId: user.outletId,

        outlet: user.outlet
          ? {
              id: user.outlet.id,
              code: user.outlet.code,
              name: user.outlet.name,
            }
          : null,
      },
    });

    // =========================================================
    // SESSION COOKIE
    // =========================================================

    response.cookies.set(
      "erp-session",
      JSON.stringify(sessionData),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      }
    );

    console.log(
      "LOGIN SUCCESS:",
      user.username,
      user.role,
      user.outletId
    );

    console.log("==============================");

    return response;
  } catch (error: any) {
    console.log("LOGIN ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message || "Terjadi kesalahan saat login",
      },
      {
        status: 500,
      }
    );
  }
}