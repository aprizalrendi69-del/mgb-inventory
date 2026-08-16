import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  try {
    // =====================================================
    // SESSION
    // =====================================================

    const cookieStore = await cookies();
    const session = cookieStore.get("erp-session");

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        { status: 401 }
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
        { status: 401 }
      );
    }

    // =====================================================
    // USER LOGIN
    // =====================================================

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
      return NextResponse.json(
        {
          success: false,
          message: "User tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // =====================================================
    // VALIDASI ROLE
    // =====================================================

    if (user.role !== "OUTLET_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Akses khusus admin outlet",
        },
        { status: 403 }
      );
    }

    if (!user.outletId) {
      return NextResponse.json(
        {
          success: false,
          message: "User belum memiliki outlet",
        },
        { status: 400 }
      );
    }

    const outletId = Number(user.outletId);

    // =====================================================
    // DATA DASHBOARD
    // =====================================================

    const [
      totalPurchase,
      totalDraft,
      totalApproved,
      totalReceived,
      totalReceipt,

      // Semua stock outlet
      outletStocks,

      recentPurchase,
    ] = await Promise.all([
      // ===================================================
      // TOTAL PURCHASE
      // ===================================================

      prisma.outletPurchase.count({
        where: {
          outletId,
        },
      }),

      // ===================================================
      // DRAFT
      // ===================================================

      prisma.outletPurchase.count({
        where: {
          outletId,
          status: "DRAFT",
        },
      }),

      // ===================================================
      // APPROVED / MENUNGGU RECEIVE
      // ===================================================

      prisma.outletPurchase.count({
        where: {
          outletId,
          status: "APPROVED",
        },
      }),

      // ===================================================
      // RECEIVED
      // ===================================================

      prisma.outletPurchase.count({
        where: {
          outletId,
          status: "RECEIVED",
        },
      }),

      // ===================================================
      // TOTAL RECEIPT
      // ===================================================

      prisma.outletReceipt.count({
        where: {
          outletId,
        },
      }),

      // ===================================================
      // STOCK OUTLET
      //
      // PENTING:
      // Jangan pakai count().
      //
      // Karena stock awal outlet tersimpan di OutletStock,
      // maka kita harus membaca nilai stock sebenarnya.
      // ===================================================

      prisma.outletStock.findMany({
        where: {
          outletId,
        },

        select: {
          id: true,
          outletId: true,
          barangId: true,
          stock: true,
          minimumStock: true,
          averageCost: true,
        },
      }),

      // ===================================================
      // PURCHASE TERBARU
      // ===================================================

      prisma.outletPurchase.findMany({
        where: {
          outletId,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 5,

        select: {
          id: true,
          number: true,
          purchaseDate: true,
          status: true,
          total: true,

          supplier: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      }),
    ]);

    // =====================================================
    // HITUNG STOCK OUTLET
    // =====================================================

    let totalStock = 0;
    let lowStock = 0;

    for (const item of outletStocks) {
      const stock = Number(item.stock ?? 0);
      const minimum = Number(item.minimumStock ?? 0);

      // Total seluruh qty stock outlet
      totalStock += stock;

      // Stock alert:
      // habis ATAU sudah menyentuh batas minimum
      if (stock <= minimum) {
        lowStock++;
      }
    }

    // =====================================================
    // NILAI PERSEDIAAN OUTLET
    // =====================================================

    let totalStockValue = 0;

    for (const item of outletStocks) {
      const stock = Number(item.stock ?? 0);
      const averageCost = Number(item.averageCost ?? 0);

      totalStockValue += stock * averageCost;
    }

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      user,

      data: {
        // Purchase
        totalPurchase,
        totalDraft,
        totalApproved,
        totalReceived,
        totalReceipt,

        // Stock outlet
        totalStock,

        // Jumlah item yang habis / minimum
        lowStock,

        // Nilai seluruh stock outlet
        totalStockValue,

        // Jumlah jenis barang yang memiliki OutletStock
        totalStockItem: outletStocks.length,

        // Purchase terbaru
        recentPurchase,
      },
    });
  } catch (error: any) {
    console.error(
      "OUTLET DASHBOARD ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil dashboard outlet",
      },
      {
        status: 500,
      }
    );
  }
}