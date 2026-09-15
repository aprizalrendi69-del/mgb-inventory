import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

// =====================================================
// TYPES
// =====================================================

type SessionData = {
  id?: number;
};

type CurrentUser = {
  id: number;
  username: string;
  fullname: string;
  role: string;
  active: boolean;
  outletId: number | null;
};

// =====================================================
// GET CURRENT SESSION USER
// =====================================================

async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  let sessionData: SessionData;

  try {
    sessionData = JSON.parse(session.value);
  } catch (error) {
    console.error("INVALID ERP SESSION:", error);
    return null;
  }

  if (
    !sessionData?.id ||
    !Number.isInteger(Number(sessionData.id)) ||
    Number(sessionData.id) <= 0
  ) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: Number(sessionData.id),
    },

    select: {
      id: true,
      username: true,
      fullname: true,
      role: true,
      active: true,
      outletId: true,
    },
  });

  return user;
}

// =====================================================
// USER SELECT
// =====================================================

const userSelect = {
  id: true,
  username: true,
  fullname: true,
  photo: true,
  role: true,
  active: true,
  outletId: true,

  outlet: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

// =====================================================
// ROLE HELPERS
// =====================================================
//
// OUTLET_ADMIN dan KASIR wajib memiliki outlet.
//
// Role pusat seperti ADMIN, MANAGER, PURCHASING,
// GUDANG tidak membutuhkan outlet.
//

function isOutletRole(role: string) {
  return (
    role === "OUTLET_ADMIN" ||
    role === "KASIR"
  );
}

// =====================================================
// GET USER
// =====================================================
//
// ADMIN
// -> melihat semua user
//
// OUTLET_ADMIN
// -> hanya melihat dirinya sendiri
//
// KASIR
// -> tidak memiliki akses Master User
//
// =====================================================

export async function GET() {
  try {
    // =================================================
    // GET CURRENT USER
    // =================================================

    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login atau session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    // =================================================
    // CEK USER ACTIVE
    // =================================================

    if (!currentUser.active) {
      return NextResponse.json(
        {
          success: false,
          message: "Akun tidak aktif",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // OUTLET ADMIN
    // HANYA BOLEH MELIHAT DIRI SENDIRI
    // =================================================

    if (currentUser.role === "OUTLET_ADMIN") {
      const user = await prisma.user.findUnique({
        where: {
          id: currentUser.id,
        },

        select: userSelect,
      });

      return NextResponse.json({
        success: true,
        data: user ? [user] : [],
        currentUser: {
          id: currentUser.id,
          role: currentUser.role,
          outletId: currentUser.outletId,
        },
      });
    }

    // =================================================
    // ADMIN PUSAT
    // BOLEH MELIHAT SEMUA USER
    // =================================================

    if (currentUser.role === "ADMIN") {
      const users = await prisma.user.findMany({
        orderBy: {
          id: "asc",
        },

        select: userSelect,
      });

      return NextResponse.json({
        success: true,
        data: users,
        currentUser: {
          id: currentUser.id,
          role: currentUser.role,
          outletId: currentUser.outletId,
        },
      });
    }

    // =================================================
    // ROLE LAIN
    // =================================================

    return NextResponse.json(
      {
        success: false,
        message: "Anda tidak memiliki akses ke Master User",
      },
      {
        status: 403,
      }
    );
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
//
// HANYA ADMIN PUSAT
//
// KASIR
// -> wajib outlet
//
// OUTLET_ADMIN
// -> wajib outlet
//
// =====================================================

export async function POST(req: NextRequest) {
  try {
    // =================================================
    // GET CURRENT USER
    // =================================================

    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login atau session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    // =================================================
    // CEK ACTIVE
    // =================================================

    if (!currentUser.active) {
      return NextResponse.json(
        {
          success: false,
          message: "Akun tidak aktif",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // HANYA ADMIN
    // =================================================

    if (currentUser.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya ADMIN pusat yang dapat membuat user",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // BODY
    // =================================================

    const body = await req.json();

    const {
      username,
      fullname,
      password,
      role,
      outletId,
      photo,
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
    // VALIDASI PHOTO
    // =================================================

    const selectedPhoto =
      typeof photo === "string" &&
      photo.trim()
        ? photo.trim()
        : null;

    // =================================================
    // CEK APAKAH ROLE MEMBUTUHKAN OUTLET
    // =================================================

    const outletRequired = isOutletRole(role);

    // =================================================
    // VALIDASI OUTLET WAJIB
    // =================================================

    if (outletRequired && !outletId) {
      return NextResponse.json(
        {
          success: false,
          message:
            role === "KASIR"
              ? "Outlet wajib dipilih untuk KASIR"
              : "Outlet wajib dipilih untuk OUTLET ADMIN",
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
    // VALIDASI OUTLET
    // =================================================

    let selectedOutletId: number | null = null;

    if (outletRequired) {
      selectedOutletId = Number(outletId);

      if (
        !Number.isInteger(selectedOutletId) ||
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
          photo: selectedPhoto,
          role,
          active: true,
          outletId: selectedOutletId,
        },

        select: userSelect,
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
//
// ADMIN
// -> boleh edit semua user
//
// OUTLET_ADMIN
// -> hanya boleh edit dirinya sendiri
//
// OUTLET_ADMIN TIDAK BOLEH:
// -> mengganti role
// -> mengganti outlet
// -> mengganti active
//
// OUTLET_ADMIN BOLEH:
// -> username
// -> fullname
// -> password
// -> photo
//
// KASIR
// -> tidak boleh mengedit Master User
//
// =====================================================

export async function PUT(req: NextRequest) {
  try {
    // =================================================
    // GET CURRENT USER
    // =================================================

    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login atau session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    // =================================================
    // CEK ACTIVE
    // =================================================

    if (!currentUser.active) {
      return NextResponse.json(
        {
          success: false,
          message: "Akun tidak aktif",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // BODY
    // =================================================

    const body = await req.json();

    const {
      id,
      username,
      fullname,
      password,
      role,
      outletId,
      active,
      photo,
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
    // OUTLET ADMIN
    // =================================================
    //
    // WAJIB EDIT DIRI SENDIRI
    //
    // Bahkan jika client mengirim ID user lain,
    // request akan ditolak.
    //
    // =================================================

    if (
      currentUser.role === "OUTLET_ADMIN" &&
      userId !== currentUser.id
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "OUTLET ADMIN hanya dapat mengedit akun sendiri",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // ROLE TIDAK DIIZINKAN
    // =================================================

    if (
      currentUser.role !== "ADMIN" &&
      currentUser.role !== "OUTLET_ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Anda tidak memiliki akses",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // VALIDASI USERNAME
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

    // =================================================
    // VALIDASI FULLNAME
    // =================================================

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

    // =================================================
    // CEK USER TARGET
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
    // OUTLET ADMIN
    // HANYA FIELD TERBATAS
    // =================================================

    if (
      currentUser.role === "OUTLET_ADMIN"
    ) {
      const updateData: {
        username: string;
        fullname: string;
        password?: string;
        photo?: string | null;
      } = {
        username: username.trim(),
        fullname: fullname.trim(),
      };

      // ===============================================
      // PHOTO
      // ===============================================

      if (typeof photo === "string") {
        updateData.photo =
          photo.trim() || null;
      }

      // ===============================================
      // PASSWORD
      // ===============================================

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

      // ===============================================
      // UPDATE SELF
      // ===============================================

      const user =
        await prisma.user.update({
          where: {
            id: currentUser.id,
          },

          data: updateData,

          select: userSelect,
        });

      return NextResponse.json({
        success: true,
        message:
          "Akun berhasil diperbarui",
        data: user,
      });
    }

    // =================================================
    // ADMIN PUSAT
    // =================================================

    if (currentUser.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Akses ditolak",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // ADMIN VALIDASI ROLE
    // =================================================

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
    // ADMIN VALIDASI OUTLET
    // =================================================

    let selectedOutletId: number | null =
      null;

    const outletRequired = isOutletRole(role);

    if (outletRequired) {
      if (!outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              role === "KASIR"
                ? "Outlet wajib dipilih untuk KASIR"
                : "Outlet wajib dipilih untuk OUTLET ADMIN",
          },
          {
            status: 400,
          }
        );
      }

      selectedOutletId = Number(outletId);

      if (
        !Number.isInteger(selectedOutletId) ||
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
    // PHOTO
    // =================================================

    let selectedPhoto:
      | string
      | null
      | undefined = undefined;

    if (typeof photo === "string") {
      selectedPhoto =
        photo.trim() || null;
    }

    // =================================================
    // UPDATE DATA ADMIN
    // =================================================

    const updateData: {
      username: string;
      fullname: string;
      role: string;
      active: boolean;
      outletId: number | null;
      password?: string;
      photo?: string | null;
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
    // PHOTO
    // =================================================

    if (selectedPhoto !== undefined) {
      updateData.photo =
        selectedPhoto;
    }

    // =================================================
    // PASSWORD
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
    // UPDATE
    // =================================================

    const user =
      await prisma.user.update({
        where: {
          id: userId,
        },

        data: updateData,

        select: userSelect,
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