import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

// =====================================================
// CURRENT USER
// =====================================================

async function getCurrentUser() {
  const cookieStore = await cookies();

  const sessionCookie =
    cookieStore.get("session") ||
    cookieStore.get("erp-session");

  if (!sessionCookie) {
    return null;
  }

  let userId: number | null = null;

  // ===================================================
  // DATABASE SESSION
  // ===================================================

  const dbSession =
    await prisma.session.findUnique({
      where: {
        token: sessionCookie.value,
      },
      include: {
        user: {
          select: {
            id: true,
            fullname: true,
            role: true,
            active: true,
            outletId: true,

            outlet: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

  if (dbSession) {
    if (
      dbSession.expiresAt <
      new Date()
    ) {
      return null;
    }

    userId = dbSession.user.id;
  } else {
    // =================================================
    // JSON SESSION
    // =================================================

    try {
      const parsed = JSON.parse(
        sessionCookie.value
      );

      userId = Number(
        parsed?.user?.id ??
          parsed?.id ??
          0
      );
    } catch {
      return null;
    }
  }

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return null;
  }

  // ===================================================
  // USER
  // ===================================================

  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        fullname: true,
        role: true,
        active: true,
        outletId: true,

        outlet: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

  if (!user) {
    return null;
  }

  if (!user.active) {
    return null;
  }

  return user;
}

// =====================================================
// ROLE ACCESS
// =====================================================
//
// ADMIN
// -> Admin pusat
// -> boleh semua outlet
//
// MANAGER
// -> boleh semua outlet
//
// OUTLET_ADMIN
// -> hanya outlet sendiri
//
// ROLE LAIN
// -> tidak boleh akses endpoint
// =====================================================

function canAccessPurchase(
  role: Role
) {
  return (
    role === Role.ADMIN ||
    role === Role.MANAGER ||
    role === Role.OUTLET_ADMIN
  );
}

// =====================================================
// BUILD OUTLET FILTER
// =====================================================

function getOutletFilter(user: {
  role: Role;
  outletId: number | null;
}) {
  if (
    user.role === Role.OUTLET_ADMIN
  ) {
    if (!user.outletId) {
      return null;
    }

    return {
      outletId: user.outletId,
    };
  }

  return {};
}

// =====================================================
// VALIDATE PURCHASE ID
// =====================================================

function getPurchaseId(
  value: string
) {
  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

// =====================================================
// GET DETAIL PURCHASE OUTLET
// =====================================================

export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // =================================================
    // USER
    // =================================================

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        {
          status: 401,
        }
      );
    }

    // =================================================
    // ROLE
    // =================================================

    if (
      !canAccessPurchase(user.role)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses Purchase Outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // OUTLET ADMIN HARUS TERHUBUNG OUTLET
    // =================================================

    if (
      user.role ===
        Role.OUTLET_ADMIN &&
      !user.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User Outlet Admin belum terhubung dengan outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // ID
    // =================================================

    const { id } =
      await context.params;

    const purchaseId =
      getPurchaseId(id);

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Purchase Outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // FILTER OUTLET
    // =================================================

    const outletFilter =
      getOutletFilter(user);

    if (outletFilter === null) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User tidak memiliki outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // PURCHASE
    // =================================================

    const purchase =
      await prisma.outletPurchase.findFirst({
        where: {
          id: purchaseId,
          ...outletFilter,
        },

        include: {
          outlet: true,

          supplier: true,

          items: {
            include: {
              barang: true,
            },

            orderBy: {
              id: "asc",
            },
          },
        },
      });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,

      data: purchase,

      access: {
        role: user.role,
        outletId:
          user.outletId,
      },
    });
  } catch (error: any) {
    console.error(
      "GET OUTLET PURCHASE DETAIL ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil detail Purchase Outlet",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// PATCH PURCHASE OUTLET
// =====================================================

export async function PATCH(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // =================================================
    // USER
    // =================================================

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        {
          status: 401,
        }
      );
    }

    // =================================================
    // ROLE
    // =================================================

    if (
      !canAccessPurchase(user.role)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses mengubah Purchase Outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // OUTLET ADMIN
    // =================================================

    if (
      user.role ===
        Role.OUTLET_ADMIN &&
      !user.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User Outlet Admin belum terhubung dengan outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // ID
    // =================================================

    const { id } =
      await context.params;

    const purchaseId =
      getPurchaseId(id);

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Purchase Outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // BODY
    // =================================================

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Body request tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const supplierId =
      Number(body?.supplierId);

    const remarks =
      typeof body?.remarks ===
      "string"
        ? body.remarks.trim()
        : null;

    const items = Array.isArray(
      body?.items
    )
      ? body.items
      : [];

    // =================================================
    // VALIDASI SUPPLIER
    // =================================================

    if (
      !Number.isInteger(
        supplierId
      ) ||
      supplierId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Supplier wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // VALIDASI ITEMS
    // =================================================

    if (items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Minimal harus ada 1 barang",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // FILTER OUTLET
    // =================================================

    const outletFilter =
      getOutletFilter(user);

    if (outletFilter === null) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User tidak memiliki outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // AMBIL PURCHASE
    // =================================================

    const existing =
      await prisma.outletPurchase.findFirst({
        where: {
          id: purchaseId,
          ...outletFilter,
        },

        include: {
          outlet: true,

          supplier: true,

          items: true,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // HANYA DRAFT
    // =================================================

    if (
      existing.status !==
      "DRAFT"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet hanya dapat diedit jika status masih DRAFT",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // VALIDASI SUPPLIER
    // =================================================

    const supplier =
      await prisma.supplier.findUnique({
        where: {
          id: supplierId,
        },

        select: {
          id: true,
          name: true,
        },
      });

    if (!supplier) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Supplier tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // VALIDASI ITEM
    // =================================================

    const normalizedItems: Array<{
      barangId: number;
      qty: number;
      price: number;
      subtotal: number;
    }> = [];

    const barangIds =
      new Set<number>();

    let total = 0;

    for (const item of items) {
      const barangId =
        Number(item?.barangId);

      const qty =
        Number(item?.qty);

      const price =
        Number(item?.price);

      // ===============================================
      // ID
      // ===============================================

      if (
        !Number.isInteger(
          barangId
        ) ||
        barangId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Barang tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      // ===============================================
      // CEGAH DUPLIKAT BARANG
      // ===============================================

      if (
        barangIds.has(
          barangId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ID ${barangId} tidak boleh muncul lebih dari satu kali`,
          },
          {
            status: 400,
          }
        );
      }

      barangIds.add(
        barangId
      );

      // ===============================================
      // QTY
      // ===============================================

      if (
        !Number.isFinite(qty) ||
        qty <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Qty barang ID ${barangId} tidak valid`,
          },
          {
            status: 400,
          }
        );
      }

      // ===============================================
      // PRICE
      // ===============================================

      if (
        !Number.isFinite(price) ||
        price < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Harga barang ID ${barangId} tidak valid`,
          },
          {
            status: 400,
          }
        );
      }

      // ===============================================
      // BARANG
      // ===============================================

      const barang =
        await prisma.barang.findUnique({
          where: {
            id: barangId,
          },

          select: {
            id: true,
            name: true,
            active: true,
          },
        });

      if (!barang) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ID ${barangId} tidak ditemukan`,
          },
          {
            status: 404,
          }
        );
      }

      if (
        barang.active === false
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ${barang.name} sudah tidak aktif`,
          },
          {
            status: 400,
          }
        );
      }

      // ===============================================
      // SUBTOTAL
      // ===============================================

      const subtotal =
        qty * price;

      if (
        !Number.isFinite(
          subtotal
        ) ||
        subtotal < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Subtotal barang ${barang.name} tidak valid`,
          },
          {
            status: 400,
          }
        );
      }

      total += subtotal;

      normalizedItems.push({
        barangId,
        qty,
        price,
        subtotal,
      });
    }

    // =================================================
    // VALIDASI TOTAL
    // =================================================

    if (
      !Number.isFinite(total) ||
      total < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Total Purchase Outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // TRANSACTION
    // =================================================

    const purchase =
      await prisma.$transaction(
        async (tx) => {
          // ===========================================
          // CEK ULANG PURCHASE
          // ===========================================

          const current =
            await tx.outletPurchase.findUnique({
              where: {
                id: purchaseId,
              },

              select: {
                id: true,
                number: true,
                outletId: true,
                status: true,
              },
            });

          if (!current) {
            throw new Error(
              "Purchase Outlet tidak ditemukan"
            );
          }

          // ===========================================
          // CEK OUTLET ULANG
          // ===========================================

          if (
            user.role ===
              Role.OUTLET_ADMIN &&
            current.outletId !==
              user.outletId
          ) {
            throw new Error(
              "Purchase Outlet bukan milik outlet Anda"
            );
          }

          // ===========================================
          // CEK STATUS ULANG
          // ===========================================

          if (
            current.status !==
            "DRAFT"
          ) {
            throw new Error(
              "Purchase Outlet sudah diproses dan tidak dapat diedit"
            );
          }

          // ===========================================
          // DELETE ITEM LAMA
          // ===========================================

          await tx.outletPurchaseItem.deleteMany(
            {
              where: {
                purchaseId,
              },
            }
          );

          // ===========================================
          // UPDATE PURCHASE
          // ===========================================

          const updated =
            await tx.outletPurchase.update({
              where: {
                id: purchaseId,
              },

              data: {
                // Tidak pernah mengambil
                // outletId dari frontend.
                outletId:
                  current.outletId,

                supplierId,

                remarks:
                  remarks || null,

                total,

                items: {
                  create:
                    normalizedItems,
                },
              },

              include: {
                outlet: true,

                supplier: true,

                items: {
                  include: {
                    barang: true,
                  },

                  orderBy: {
                    id: "asc",
                  },
                },
              },
            });

          // ===========================================
          // HISTORY
          // ===========================================

          await tx.history.create({
            data: {
              transactionType:
                "PURCHASE",

              referenceNumber:
                updated.number,

              description:
                `Mengubah Purchase Order Outlet ${updated.number}`,

              userId:
                user.id,
            },
          });

          return updated;
        }
      );

    return NextResponse.json({
      success: true,

      message:
        "Purchase Outlet berhasil diubah",

      data: purchase,
    });
  } catch (error: any) {
    console.error(
      "PATCH OUTLET PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal mengubah Purchase Outlet",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// DELETE PURCHASE OUTLET
// =====================================================

export async function DELETE(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // =================================================
    // USER
    // =================================================

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        {
          status: 401,
        }
      );
    }

    // =================================================
    // ROLE
    // =================================================

    if (
      !canAccessPurchase(user.role)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses menghapus Purchase Outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // OUTLET ADMIN
    // =================================================

    if (
      user.role ===
        Role.OUTLET_ADMIN &&
      !user.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User Outlet Admin belum terhubung dengan outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // ID
    // =================================================

    const { id } =
      await context.params;

    const purchaseId =
      getPurchaseId(id);

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Purchase Outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // FILTER OUTLET
    // =================================================

    const outletFilter =
      getOutletFilter(user);

    if (outletFilter === null) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User tidak memiliki outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // CEK PURCHASE
    // =================================================

    const existing =
      await prisma.outletPurchase.findFirst({
        where: {
          id: purchaseId,
          ...outletFilter,
        },

        include: {
          outlet: true,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // HANYA DRAFT
    // =================================================

    if (
      existing.status !==
      "DRAFT"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet hanya dapat dihapus jika status masih DRAFT",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // TRANSACTION
    // =================================================

    await prisma.$transaction(
      async (tx) => {
        // =============================================
        // CEK ULANG
        // =============================================

        const current =
          await tx.outletPurchase.findUnique(
            {
              where: {
                id: purchaseId,
              },

              select: {
                id: true,
                number: true,
                outletId: true,
                status: true,
              },
            }
          );

        if (!current) {
          throw new Error(
            "Purchase Outlet tidak ditemukan"
          );
        }

        // =============================================
        // SECURITY OUTLET
        // =============================================

        if (
          user.role ===
            Role.OUTLET_ADMIN &&
          current.outletId !==
            user.outletId
        ) {
          throw new Error(
            "Purchase Outlet bukan milik outlet Anda"
          );
        }

        // =============================================
        // STATUS
        // =============================================

        if (
          current.status !==
          "DRAFT"
        ) {
          throw new Error(
            "Purchase Outlet sudah diproses dan tidak dapat dihapus"
          );
        }

        // =============================================
        // HAPUS ITEM
        // =============================================

        await tx.outletPurchaseItem.deleteMany(
          {
            where: {
              purchaseId,
            },
          }
        );

        // =============================================
        // HISTORY SEBELUM DELETE
        // =============================================

        await tx.history.create({
          data: {
            transactionType:
              "PURCHASE",

            referenceNumber:
              current.number,

            description:
              `Menghapus Purchase Order Outlet ${current.number}`,

            userId:
              user.id,
          },
        });

        // =============================================
        // DELETE PURCHASE
        // =============================================

        await tx.outletPurchase.delete({
          where: {
            id: purchaseId,
          },
        });
      }
    );

    return NextResponse.json({
      success: true,

      message:
        "Purchase Outlet berhasil dihapus",
    });
  } catch (error: any) {
    console.error(
      "DELETE OUTLET PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal menghapus Purchase Outlet",
      },
      {
        status: 500,
      }
    );
  }
}