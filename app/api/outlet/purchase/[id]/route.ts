import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  try {
    const sessionData = JSON.parse(session.value);

    return await prisma.user.findUnique({
      where: {
        id: sessionData.id,
      },
      select: {
        id: true,
        role: true,
        outletId: true,
      },
    });
  } catch {
    return null;
  }
}

// =====================================================
// FILTER AKSES OUTLET
//
// ADMIN PUSAT
// -> {}
// -> bisa mengakses semua outlet
//
// OUTLET_ADMIN
// -> { outletId: user.outletId }
// -> hanya outlet sendiri
// =====================================================

function getOutletFilter(user: {
  role: string;
  outletId: number | null;
}) {
  if (user.role === "OUTLET_ADMIN") {
    return {
      outletId: user.outletId ?? -1,
    };
  }

  return {};
}

// =====================================================
// GET DETAIL PURCHASE OUTLET
// =====================================================

export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const purchaseId = Number(id);

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Purchase tidak valid",
        },
        { status: 400 }
      );
    }

    const outletFilter = getOutletFilter(user);

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
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    console.error(
      "GET OUTLET PURCHASE DETAIL ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil detail Purchase Outlet",
      },
      { status: 500 }
    );
  }
}

// =====================================================
// PATCH PURCHASE OUTLET
// =====================================================

export async function PATCH(
  req: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const purchaseId = Number(id);

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Purchase tidak valid",
        },
        { status: 400 }
      );
    }

    const body = await req.json();

    const {
      supplierId,
      remarks,
      items,
    } = body;

    // =====================================================
    // PURCHASE HARUS SESUAI HAK AKSES USER
    // =====================================================

    const outletFilter = getOutletFilter(user);

    const existing =
      await prisma.outletPurchase.findFirst({
        where: {
          id: purchaseId,
          ...outletFilter,
        },

        include: {
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
        { status: 404 }
      );
    }

    // =====================================================
    // EDIT HANYA DRAFT
    // =====================================================

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet hanya dapat diedit jika status masih DRAFT",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // VALIDASI SUPPLIER
    // =====================================================

    if (!supplierId) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier wajib dipilih",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // VALIDASI ITEMS
    // =====================================================

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Minimal harus ada 1 barang",
        },
        { status: 400 }
      );
    }

    const supplier =
      await prisma.supplier.findUnique({
        where: {
          id: Number(supplierId),
        },
      });

    if (!supplier) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // =====================================================
    // VALIDASI BARANG + HITUNG TOTAL
    // =====================================================

    let total = 0;

    for (const item of items) {
      const barangId = Number(
        item.barangId
      );

      const qty = Number(item.qty);

      const price = Number(item.price);

      if (
        !barangId ||
        qty <= 0 ||
        price <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Barang, Qty, dan Harga harus valid",
          },
          { status: 400 }
        );
      }

      const barang =
        await prisma.barang.findUnique({
          where: {
            id: barangId,
          },
        });

      if (!barang) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ID ${barangId} tidak ditemukan`,
          },
          { status: 404 }
        );
      }

      total += qty * price;
    }

    // =====================================================
    // UPDATE PURCHASE
    // =====================================================

    const purchase =
      await prisma.$transaction(
        async (tx) => {
          await tx.outletPurchaseItem.deleteMany({
            where: {
              purchaseId,
            },
          });

          return tx.outletPurchase.update({
            where: {
              id: purchaseId,
            },

            data: {
              // ADMIN PUSAT
              // -> mempertahankan outlet existing
              //
              // OUTLET_ADMIN
              // -> mempertahankan outlet miliknya
              //
              // Tidak pernah mengambil outletId
              // dari frontend.

              outletId:
                existing.outletId,

              supplierId:
                Number(supplierId),

              remarks:
                remarks?.trim() || null,

              total,

              items: {
                create:
                  items.map(
                    (item: any) => {
                      const qty =
                        Number(
                          item.qty
                        );

                      const price =
                        Number(
                          item.price
                        );

                      return {
                        barangId:
                          Number(
                            item.barangId
                          ),

                        qty,

                        price,

                        subtotal:
                          qty * price,
                      };
                    }
                  ),
              },
            },

            include: {
              outlet: true,

              supplier: true,

              items: {
                include: {
                  barang: true,
                },
              },
            },
          });
        }
      );

    // =====================================================
    // HISTORY
    // =====================================================

    await prisma.history.create({
      data: {
        transactionType: "PURCHASE",

        referenceNumber:
          purchase.number,

        description:
          "Mengubah Purchase Order Outlet " +
          purchase.number,
      },
    });

    return NextResponse.json({
      success: true,

      message:
        "Purchase Outlet berhasil diubah",

      data: purchase,
    });
  } catch (error) {
    console.error(
      "PATCH OUTLET PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengubah Purchase Outlet",
      },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE PURCHASE OUTLET
// =====================================================

export async function DELETE(
  req: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const purchaseId = Number(id);

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Purchase tidak valid",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // PURCHASE HARUS SESUAI HAK AKSES USER
    // =====================================================

    const outletFilter = getOutletFilter(user);

    const existing =
      await prisma.outletPurchase.findFirst({
        where: {
          id: purchaseId,
          ...outletFilter,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // =====================================================
    // HAPUS HANYA DRAFT
    // =====================================================

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet hanya dapat dihapus jika status masih DRAFT",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // DELETE
    // =====================================================

    await prisma.$transaction(
      async (tx) => {
        await tx.outletPurchaseItem.deleteMany({
          where: {
            purchaseId,
          },
        });

        await tx.outletPurchase.delete({
          where: {
            id: purchaseId,
          },
        });
      }
    );

    // =====================================================
    // HISTORY
    // =====================================================

    await prisma.history.create({
      data: {
        transactionType: "PURCHASE",

        referenceNumber:
          existing.number,

        description:
          "Menghapus Purchase Order Outlet " +
          existing.number,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Purchase Outlet berhasil dihapus",
    });
  } catch (error) {
    console.error(
      "DELETE OUTLET PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal menghapus Purchase Outlet",
      },
      { status: 500 }
    );
  }
}