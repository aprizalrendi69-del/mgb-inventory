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
  customerId: number | null;
};

// =====================================================
// CURRENT SESSION USER
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
      customerId: true,
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
  customerId: true,

  outlet: {
    select: {
      id: true,
      name: true,
    },
  },

  customer: {
    select: {
      id: true,
      code: true,
      name: true,
      address: true,
      city: true,
      phone: true,
      email: true,
      contactPerson: true,
    },
  },
} as const;

// =====================================================
// ROLE HELPERS
// =====================================================

function isOutletRole(role: string) {
  return role === "OUTLET_ADMIN" || role === "KASIR";
}

function requiresCustomer(role: string) {
  return role === "OUTLET_ADMIN";
}

// =====================================================
// PHOTO HELPER
// =====================================================

function normalizePhoto(
  photo: unknown
): string | null | undefined {
  if (photo === undefined) {
    return undefined;
  }

  if (photo === null) {
    return null;
  }

  if (typeof photo === "string") {
    const trimmed = photo.trim();

    return trimmed ? trimmed : null;
  }

  return null;
}

// =====================================================
// PARSE OPTIONAL INTEGER
// =====================================================

function parseOptionalPositiveInt(
  value: unknown
): number | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

// =====================================================
// CUSTOMER VALIDATION
// =====================================================

async function validateCustomer(
  customerId: unknown,
  required: boolean
): Promise<
  | {
      ok: true;
      customerId: number | null;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  // ===================================================
  // TIDAK WAJIB
  // ===================================================

  if (
    !required &&
    (
      customerId === undefined ||
      customerId === null ||
      customerId === ""
    )
  ) {
    return {
      ok: true,
      customerId: null,
    };
  }

  // ===================================================
  // WAJIB
  // ===================================================

  if (
    required &&
    (
      customerId === undefined ||
      customerId === null ||
      customerId === ""
    )
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message:
            "Customer wajib dipilih untuk OUTLET ADMIN",
        },
        {
          status: 400,
        }
      ),
    };
  }

  const selectedCustomerId =
    parseOptionalPositiveInt(customerId);

  if (!selectedCustomerId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Customer tidak valid",
        },
        {
          status: 400,
        }
      ),
    };
  }

  // ===================================================
  // CEK CUSTOMER DI DATABASE
  // ===================================================

  const customer =
    await prisma.customer.findUnique({
      where: {
        id: selectedCustomerId,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

  if (!customer) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Customer tidak ditemukan",
        },
        {
          status: 404,
        }
      ),
    };
  }

  return {
    ok: true,
    customerId: customer.id,
  };
}

// =====================================================
// OUTLET VALIDATION
// =====================================================

async function validateOutlet(
  outletId: unknown,
  required: boolean
): Promise<
  | {
      ok: true;
      outletId: number | null;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  // ===================================================
  // TIDAK WAJIB
  // ===================================================

  if (
    !required &&
    (
      outletId === undefined ||
      outletId === null ||
      outletId === ""
    )
  ) {
    return {
      ok: true,
      outletId: null,
    };
  }

  // ===================================================
  // WAJIB
  // ===================================================

  if (
    required &&
    (
      outletId === undefined ||
      outletId === null ||
      outletId === ""
    )
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Outlet wajib dipilih",
        },
        {
          status: 400,
        }
      ),
    };
  }

  const selectedOutletId =
    parseOptionalPositiveInt(outletId);

  if (!selectedOutletId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Outlet tidak valid",
        },
        {
          status: 400,
        }
      ),
    };
  }

  const outlet =
    await prisma.outlet.findUnique({
      where: {
        id: selectedOutletId,
      },
      select: {
        id: true,
        name: true,
      },
    });

  if (!outlet) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      ),
    };
  }

  return {
    ok: true,
    outletId: outlet.id,
  };
}

// =====================================================
// GET USER
// =====================================================

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

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
    // =================================================

    if (currentUser.role === "OUTLET_ADMIN") {
      const user =
        await prisma.user.findUnique({
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
          customerId: currentUser.customerId,
        },
      });
    }

    // =================================================
    // ADMIN PUSAT
    // =================================================

    if (currentUser.role === "ADMIN") {
      const users =
        await prisma.user.findMany({
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
          customerId: currentUser.customerId,
        },
      });
    }

    // =================================================
    // ROLE LAIN
    // =================================================

    return NextResponse.json(
      {
        success: false,
        message:
          "Anda tidak memiliki akses ke Master User",
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

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

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

    const body = await req.json();

    const {
      username,
      fullname,
      password,
      role,
      outletId,
      customerId,
      photo,
    } = body;

    // =================================================
    // VALIDASI DASAR
    // =================================================

    if (
      typeof username !== "string" ||
      !username.trim() ||
      typeof fullname !== "string" ||
      !fullname.trim() ||
      typeof password !== "string" ||
      !password ||
      typeof role !== "string" ||
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
    // PASSWORD
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
    // PHOTO
    // =================================================

    const selectedPhoto =
      normalizePhoto(photo);

    // =================================================
    // ROLE
    // =================================================

    const outletRequired =
      isOutletRole(role);

    const customerRequired =
      requiresCustomer(role);

    // =================================================
    // VALIDASI OUTLET
    // =================================================

    const outletValidation =
      await validateOutlet(
        outletId,
        outletRequired
      );

    if (!outletValidation.ok) {
      return outletValidation.response;
    }

    // =================================================
    // VALIDASI CUSTOMER
    // =================================================

    const customerValidation =
      await validateCustomer(
        customerId,
        customerRequired
      );

    if (!customerValidation.ok) {
      return customerValidation.response;
    }

    // =================================================
    // FINAL VALUE
    // =================================================

    const selectedOutletId =
      outletRequired
        ? outletValidation.outletId
        : null;

    const selectedCustomerId =
      customerRequired
        ? customerValidation.customerId
        : null;

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
    // HASH PASSWORD
    // =================================================

    const hash =
      await bcrypt.hash(password, 10);

    // =================================================
    // CREATE USER
    // =================================================

    const user =
      await prisma.user.create({
        data: {
          username: username.trim(),
          fullname: fullname.trim(),
          password: hash,
          photo: selectedPhoto ?? null,
          role,
          active: true,
          outletId: selectedOutletId,
          customerId: selectedCustomerId,
        },
        select: userSelect,
      });

    console.log(
      "CREATE USER SUCCESS:",
      {
        id: user.id,
        username: user.username,
        role: user.role,
        outletId: user.outletId,
        customerId: user.customerId,
        customer: user.customer,
      }
    );

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
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

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

    const body = await req.json();

    const {
      id,
      username,
      fullname,
      password,
      role,
      outletId,
      customerId,
      active,
      photo,
    } = body;

    // =================================================
    // DEBUG REQUEST
    // =================================================

    console.log(
      "========================================"
    );
    console.log("UPDATE USER REQUEST");
    console.log("BODY:", body);
    console.log(
      "========================================"
    );

    // =================================================
    // USER ID
    // =================================================

    const userId =
      parseOptionalPositiveInt(id);

    if (!userId) {
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
    // ROLE ACCESS
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
    // USERNAME
    // =================================================

    if (
      typeof username !== "string" ||
      !username.trim()
    ) {
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
    // FULLNAME
    // =================================================

    if (
      typeof fullname !== "string" ||
      !fullname.trim()
    ) {
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
    // EXISTING USER
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
    // USERNAME DUPLICATE
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
    // PHOTO
    // =================================================

    const normalizedPhoto =
      normalizePhoto(photo);

    // =================================================
    // OUTLET ADMIN
    // HANYA EDIT DATA DIRI
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

      if (
        normalizedPhoto !== undefined
      ) {
        updateData.photo =
          normalizedPhoto;
      }

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
          normalizedPhoto === null
            ? "Akun berhasil diperbarui dan foto profil dihapus"
            : "Akun berhasil diperbarui",
        data: user,
      });
    }

    // =================================================
    // ADMIN
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
    // ROLE
    // =================================================

    if (
      typeof role !== "string" ||
      !role
    ) {
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
    // VALIDASI OUTLET
    // =================================================

    const outletRequired =
      isOutletRole(role);

    const outletValidation =
      await validateOutlet(
        outletId,
        outletRequired
      );

    if (!outletValidation.ok) {
      return outletValidation.response;
    }

    // =================================================
    // VALIDASI CUSTOMER
    // =================================================

    const customerRequired =
      requiresCustomer(role);

    console.log(
      "CUSTOMER UPDATE INPUT:",
      {
        userId,
        role,
        customerId,
        customerRequired,
      }
    );

    const customerValidation =
      await validateCustomer(
        customerId,
        customerRequired
      );

    if (!customerValidation.ok) {
      return customerValidation.response;
    }

    // =================================================
    // FINAL VALUE
    // =================================================

    const selectedOutletId =
      outletRequired
        ? outletValidation.outletId
        : null;

    const selectedCustomerId =
      customerRequired
        ? customerValidation.customerId
        : null;

    console.log(
      "CUSTOMER UPDATE VALIDATED:",
      {
        userId,
        selectedCustomerId,
        selectedOutletId,
      }
    );

    // =================================================
    // UPDATE DATA
    // =================================================

    const updateData: {
      username: string;
      fullname: string;
      role: string;
      active: boolean;
      outletId: number | null;
      customerId?: number | null;
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
    // CUSTOMER
    //
    // Tetap simpan scalar customerId agar database
    // langsung memiliki FK yang sesuai.
    // =================================================

    updateData.customerId =
      selectedCustomerId;

    // =================================================
    // PHOTO
    // =================================================

    if (
      normalizedPhoto !== undefined
    ) {
      updateData.photo =
        normalizedPhoto;
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
    // UPDATE DATABASE
    // =================================================

    const user =
      await prisma.user.update({
        where: {
          id: userId,
        },
        data: updateData,
        select: userSelect,
      });

    // =================================================
    // VERIFY DATABASE
    // =================================================

    const verifyUser =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          username: true,
          role: true,
          outletId: true,
          customerId: true,

          customer: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

    // =================================================
    // LOG HASIL UPDATE
    // =================================================

    console.log(
      "========================================"
    );

    console.log(
      "UPDATE USER SUCCESS:",
      {
        id: user.id,
        username: user.username,
        role: user.role,
        outletId: user.outletId,
        customerId: user.customerId,
        customer: user.customer,
      }
    );

    console.log(
      "DATABASE VERIFY:",
      {
        id: verifyUser?.id,
        customerId:
          verifyUser?.customerId ?? null,
        customer:
          verifyUser?.customer ?? null,
      }
    );

    console.log(
      "========================================"
    );

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json({
      success: true,

      message:
        normalizedPhoto === null
          ? "User berhasil diperbarui dan foto profil dihapus"
          : "User berhasil diperbarui",

      data: user,

      // =================================================
      // DEBUG
      //
      // Sementara kita tampilkan agar gampang memastikan
      // customer benar-benar tersimpan.
      // =================================================

      debug: {
        requestedCustomerId:
          customerId ?? null,

        selectedCustomerId:
          selectedCustomerId ?? null,

        savedCustomerId:
          verifyUser?.customerId ?? null,

        savedCustomer:
          verifyUser?.customer ?? null,
      },
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