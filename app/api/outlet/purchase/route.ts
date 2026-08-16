import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  try {
    // =====================================================
    // 1. CEK SESSION
    // =====================================================

    const cookieStore = await cookies();
    const session = cookieStore.get("erp-session");

    if (!session) {
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

    let sessionData: any;

    try {
      sessionData = JSON.parse(session.value);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: sessionData.id,
      },
      select: {
        id: true,
        role: true,
        outletId: true,
      },
    });

    if (!user) {
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

    // =====================================================
    // 2. FILTER OUTLET
    //
    // ADMIN PUSAT
    // -> {}
    // -> melihat semua outlet
    //
    // OUTLET_ADMIN
    // -> { outletId: user.outletId }
    // -> hanya outlet sendiri
    // =====================================================

    const outletFilter =
      user.role === "OUTLET_ADMIN"
        ? {
            outletId: user.outletId ?? -1,
          }
        : {};

    // =====================================================
    // 3. GET PURCHASE OUTLET
    // =====================================================

    const data =
      await prisma.outletPurchase.findMany({
        where: outletFilter,

        include: {
          outlet: true,

          supplier: true,

          items: {
            include: {
              barang: true,
            },
          },
        },

        orderBy: {
          id: "desc",
        },
      });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "GET OUTLET PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil data Purchase Outlet",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // =====================================================
    // 1. CEK SESSION
    // =====================================================

    const cookieStore = await cookies();
    const session = cookieStore.get("erp-session");

    if (!session) {
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

    let sessionData: any;

    try {
      sessionData = JSON.parse(session.value);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: sessionData.id,
      },
      select: {
        id: true,
        role: true,
        outletId: true,
      },
    });

    if (!user) {
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

    // =====================================================
    // 2. AMBIL BODY
    // =====================================================

    const body = await req.json();

    const {
      outletId: requestedOutletId,
      supplierId,
      remarks,
      items,
    } = body;

    // =====================================================
    // 3. TENTUKAN OUTLET
    //
    // ADMIN PUSAT
    // -> boleh memilih outlet
    //
    // OUTLET_ADMIN
    // -> wajib menggunakan outlet dari session
    // -> tidak boleh memilih outlet lain
    // =====================================================

    let outletId: number;

    if (user.role === "OUTLET_ADMIN") {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum memiliki outlet",
          },
          {
            status: 400,
          }
        );
      }

      outletId = user.outletId;
    } else {
      if (!requestedOutletId) {
        return NextResponse.json(
          {
            success: false,
            message: "Outlet wajib dipilih",
          },
          {
            status: 400,
          }
        );
      }

      outletId = Number(requestedOutletId);
    }

    // =====================================================
    // 4. VALIDASI SUPPLIER
    // =====================================================

    if (!supplierId) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // 5. VALIDASI ITEMS
    // =====================================================

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Barang belum dipilih",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // 6. CEK OUTLET
    // =====================================================

    const outlet =
      await prisma.outlet.findUnique({
        where: {
          id: outletId,
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

    // =====================================================
    // 7. CEK SUPPLIER
    // =====================================================

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
        {
          status: 404,
        }
      );
    }

    // =====================================================
    // 8. VALIDASI BARANG + HITUNG TOTAL
    // =====================================================

    let total = 0;

    for (const item of items) {
      const barangId = Number(item.barangId);
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
          {
            status: 400,
          }
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
          {
            status: 404,
          }
        );
      }

      total += qty * price;
    }

    // =====================================================
    // 9. GENERATE NOMOR PURCHASE
    // =====================================================

    const lastPurchase =
      await prisma.outletPurchase.findFirst({
        orderBy: {
          id: "desc",
        },
        select: {
          id: true,
        },
      });

    const nextNumber =
      (lastPurchase?.id ?? 0) + 1;

    const number =
      `OP-${String(nextNumber).padStart(5, "0")}`;

    // =====================================================
    // 10. CREATE PURCHASE
    // =====================================================

    const purchase =
      await prisma.outletPurchase.create({
        data: {
          number,

          outletId,

          supplierId: Number(supplierId),

          total,

          remarks: remarks || null,

          items: {
            create: items.map(
              (item: any) => {
                const qty =
                  Number(item.qty);

                const price =
                  Number(item.price);

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

    // =====================================================
    // 11. HISTORY
    // =====================================================

    await prisma.history.create({
      data: {
        transactionType: "PURCHASE",

        referenceNumber:
          purchase.number,

        description:
          "Membuat Purchase Order Outlet " +
          purchase.number,
      },
    });

    // =====================================================
    // 12. RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      message:
        "Purchase Order Outlet berhasil dibuat",

      data: purchase,
    });
  } catch (error) {
    console.error(
      "POST OUTLET PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal membuat Purchase Order Outlet",
      },
      {
        status: 500,
      }
    );
  }
}