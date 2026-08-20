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
        message:
          error?.message ??
          "Gagal mengambil data user",
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
      !username?.trim() ||
      !fullname?.trim() ||
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
    // VALIDASI PASSWORD
    // =================================================

    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: "Password minimal 6 karakter",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // VALIDASI OUTLET ADMIN
    // =================================================

    if (
      role === "OUTLET_ADMIN" &&
      !outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet wajib dipilih untuk OUTLET ADMIN",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // CEK USERNAME
    // =================================================

    const exist =
      await prisma.user.findUnique({
        where: {
          username: username.trim(),
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

      if (
        !Number.isInteger(
          selectedOutletId
        ) ||
        selectedOutletId <= 0
      ) {
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

      const outlet =
        await prisma.outlet.findUnique({
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

    const user =
      await prisma.user.create({
        data: {
          username: username.trim(),
          fullname: fullname.trim(),
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
      message: "User berhasil dibuat",
      data: user,
    });
  } catch (error: any) {
    console.error(
      "CREATE USER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ??
          "Gagal membuat user",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// UPDATE USER
// =====================================================

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      id,
      username,
      fullname,
      password,
      role,
      outletId,
      active,
    } = body;

    // =================================================
    // VALIDASI ID
    // =================================================

    const userId = Number(id);

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "ID user tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // VALIDASI DATA
    // =================================================

    if (!username?.trim()) {
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

    if (!fullname?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Nama lengkap wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    if (!role) {
      return NextResponse.json(
        {
          success: false,
          message: "Role wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // CEK USER
    // =================================================

    const existingUser =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (!existingUser) {
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

    // =================================================
    // CEK USERNAME
    // =================================================

    const usernameOwner =
      await prisma.user.findUnique({
        where: {
          username: username.trim(),
        },
      });

    if (
      usernameOwner &&
      usernameOwner.id !== userId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Username sudah digunakan user lain",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // OUTLET
    // =================================================

    let selectedOutletId: number | null =
      null;

    if (role === "OUTLET_ADMIN") {
      if (!outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet wajib dipilih untuk OUTLET ADMIN",
          },
          {
            status: 400,
          }
        );
      }

      selectedOutletId = Number(outletId);

      if (
        !Number.isInteger(
          selectedOutletId
        ) ||
        selectedOutletId <= 0
      ) {
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

      const outlet =
        await prisma.outlet.findUnique({
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
    // DATA UPDATE
    // =================================================

    const updateData: {
      username: string;
      fullname: string;
      role: string;
      active: boolean;
      outletId: number | null;
      password?: string;
    } = {
      username: username.trim(),
      fullname: fullname.trim(),
      role,
      active:
        typeof active === "boolean"
          ? active
          : existingUser.active,
      outletId: selectedOutletId,
    };

    // =================================================
    // PASSWORD
    // Password hanya diganti jika diisi
    // =================================================

    if (
      typeof password === "string" &&
      password.trim()
    ) {
      if (password.length < 6) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Password minimal 6 karakter",
          },
          {
            status: 400,
          }
        );
      }

      updateData.password =
        await bcrypt.hash(password, 10);
    }

    // =================================================
    // UPDATE USER
    // =================================================

    const user =
      await prisma.user.update({
        where: {
          id: userId,
        },

        data: updateData,

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
      message: "User berhasil diperbarui",
      data: user,
    });
  } catch (error: any) {
    console.error(
      "UPDATE USER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ??
          "Gagal memperbarui user",
      },
      {
        status: 500,
      }
    );
  }
}