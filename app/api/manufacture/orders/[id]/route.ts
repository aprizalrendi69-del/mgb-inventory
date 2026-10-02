import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// =====================================================
// CURRENT LOGIN USER
// =====================================================

async function currentUser() {
  const cookieStore = await cookies();

  const sessionCookie =
    cookieStore.get("erp-session") ||
    cookieStore.get("session");

  if (!sessionCookie) {
    return null;
  }

  let userId = 0;

  // ===================================================
  // SESSION TOKEN DARI DATABASE
  // ===================================================

  try {
    const session =
      await prisma.session.findUnique({
        where: {
          token: sessionCookie.value,
        },
        select: {
          expiresAt: true,
          user: {
            select: {
              id: true,
            },
          },
        },
      });

    if (
      session &&
      session.expiresAt > new Date() &&
      session.user?.id
    ) {
      userId = Number(
        session.user.id
      );
    }
  } catch (error) {
    console.error(
      "MANUFACTURE ORDER SESSION DB ERROR:",
      error
    );
  }

  // ===================================================
  // FALLBACK SESSION JSON
  // ===================================================

  if (!userId) {
    try {
      const parsed =
        JSON.parse(
          sessionCookie.value
        );

      userId = Number(
        parsed?.user?.id ??
          parsed?.id ??
          0
      );
    } catch {
      // ignore
    }
  }

  if (!userId) {
    return null;
  }

  // ===================================================
  // AMBIL USER TERBARU
  // ===================================================

  try {
    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
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

    if (
      !user ||
      !user.active
    ) {
      return null;
    }

    return user;
  } catch (error) {
    console.error(
      "MANUFACTURE ORDER CURRENT USER ERROR:",
      error
    );

    return null;
  }
}

// =====================================================
// RESPONSE HELPER
// =====================================================

function fail(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
    }
  );
}

// =====================================================
// GET DETAIL ORDER
// =====================================================

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const user =
      await currentUser();

    if (!user) {
      return fail(
        "Session login tidak ditemukan atau sudah expired. Silakan login ulang.",
        401
      );
    }

    const role =
      String(user.role || "")
        .trim()
        .toUpperCase();

    if (
      ![
        "ADMIN",
        "MANAGER",
        "GUDANG",
      ].includes(role)
    ) {
      return fail(
        "Anda tidak memiliki akses Manufacture.",
        403
      );
    }

    const { id: rawId } =
      await params;

    const id =
      Number(rawId);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return fail(
        "ID order produksi tidak valid."
      );
    }

    const order =
      await prisma.manufactureOrder.findUnique(
        {
          where: {
            id,
          },
          include: {
            recipe: {
              include: {
                outputBarang: true,
              },
            },
            creator: {
              select: {
                id: true,
                fullname: true,
                username: true,
              },
            },
            items: {
              include: {
                barang: true,
              },
              orderBy: {
                id: "asc",
              },
            },
          },
        }
      );

    if (!order) {
      return fail(
        "Order produksi tidak ditemukan.",
        404
      );
    }

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    console.error(
      "GET MANUFACTURE ORDER DETAIL ERROR:",
      error
    );

    return fail(
      error?.message ||
        "Gagal mengambil detail order produksi.",
      500
    );
  }
}

// =====================================================
// DELETE ORDER PRODUKSI
//
// ADMIN ONLY
//
// BOLEH DIHAPUS:
// - DRAFT
// - PLANNED
// - order yang belum menghasilkan produksi
//
// TIDAK BOLEH:
// - COMPLETED
// - CANCELLED
// - sudah producedQty > 0
// - sudah actualQty > 0
// =====================================================

export async function DELETE(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // =================================================
    // AUTH
    // =================================================

    const user =
      await currentUser();

    if (!user) {
      return fail(
        "Session login tidak ditemukan atau sudah expired. Silakan login ulang.",
        401
      );
    }

    const role =
      String(user.role || "")
        .trim()
        .toUpperCase();

    console.log(
      "DELETE MANUFACTURE ORDER AUTH:",
      {
        userId: user.id,
        username: user.username,
        role,
      }
    );

    // =================================================
    // ADMIN ONLY
    // =================================================

    if (role !== "ADMIN") {
      return fail(
        "Hanya user ADMIN yang dapat menghapus order produksi.",
        403
      );
    }

    // =================================================
    // PARAM ID
    // =================================================

    const { id: rawId } =
      await params;

    const id =
      Number(rawId);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return fail(
        "ID order produksi tidak valid."
      );
    }

    // =================================================
    // CARI ORDER
    // =================================================

    const order =
      await prisma.manufactureOrder.findUnique(
        {
          where: {
            id,
          },
          select: {
            id: true,
            number: true,
            status: true,
            plannedQty: true,
            producedQty: true,
            items: {
              select: {
                id: true,
                actualQty: true,
              },
            },
          },
        }
      );

    if (!order) {
      return fail(
        "Order produksi tidak ditemukan.",
        404
      );
    }

    console.log(
      "DELETE MANUFACTURE ORDER TARGET:",
      {
        id: order.id,
        number: order.number,
        status: order.status,
        plannedQty: order.plannedQty,
        producedQty: order.producedQty,
        items: order.items.length,
      }
    );

    // =================================================
    // STATUS
    // =================================================

    const status =
      String(order.status || "")
        .trim()
        .toUpperCase();

    // =================================================
    // COMPLETED TIDAK BOLEH DIHAPUS
    // =================================================

    if (
      status === "COMPLETED"
    ) {
      return fail(
        `Order ${order.number} sudah COMPLETED dan tidak dapat dihapus.`,
        409
      );
    }

    // =================================================
    // CANCELLED TIDAK BOLEH DIHAPUS
    // =================================================

    if (
      status === "CANCELLED"
    ) {
      return fail(
        `Order ${order.number} sudah CANCELLED dan tidak dapat dihapus.`,
        409
      );
    }

    // =================================================
    // CEK PRODUCED QTY
    // =================================================

    const producedQty =
      Number(
        order.producedQty || 0
      );

    if (
      producedQty > 0
    ) {
      return fail(
        `Order ${order.number} sudah memiliki hasil produksi sebanyak ${producedQty} dan tidak dapat dihapus.`,
        409
      );
    }

    // =================================================
    // CEK ACTUAL QTY
    // =================================================

    const hasActualQty =
      order.items.some(
        (item) =>
          Number(
            item.actualQty || 0
          ) > 0
      );

    if (hasActualQty) {
      return fail(
        `Order ${order.number} sudah memiliki qty produksi aktual dan tidak dapat dihapus.`,
        409
      );
    }

    // =================================================
    // DELETE
    //
    // ManufactureOrderItem memiliki:
    //
    // order ManufactureOrder
    //   @relation(
    //      fields: [orderId],
    //      references: [id],
    //      onDelete: Cascade
    //   )
    //
    // Jadi item order akan ikut terhapus.
    // =================================================

    await prisma.manufactureOrder.delete(
      {
        where: {
          id: order.id,
        },
      }
    );

    // =================================================
    // SUCCESS
    // =================================================

    return NextResponse.json({
      success: true,
      message:
        `Order produksi ${order.number} berhasil dihapus.`,
      data: {
        id: order.id,
        number: order.number,
      },
    });
  } catch (error: any) {
    console.error(
      "DELETE MANUFACTURE ORDER ERROR:",
      error
    );

    // =================================================
    // FOREIGN KEY
    // =================================================

    if (
      error?.code === "P2003"
    ) {
      return fail(
        "Order produksi tidak dapat dihapus karena masih memiliki data transaksi yang terhubung.",
        409
      );
    }

    // =================================================
    // NOT FOUND
    // =================================================

    if (
      error?.code === "P2025"
    ) {
      return fail(
        "Order produksi sudah tidak ditemukan.",
        404
      );
    }

    return fail(
      error?.message ||
        "Gagal menghapus order produksi.",
      500
    );
  }
}