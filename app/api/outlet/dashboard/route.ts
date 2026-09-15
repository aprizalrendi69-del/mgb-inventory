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
    // VALIDATE SESSION ID
    // =====================================================

    const userId = Number(sessionData?.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Session user tidak valid",
        },
        { status: 401 }
      );
    }

    // =====================================================
    // USER
    // =====================================================

    const user = await prisma.user.findUnique({
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
    // ACTIVE USER
    // =====================================================

    if (!user.active) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak aktif",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // ROLE
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

    // =====================================================
    // OUTLET
    // =====================================================

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

    if (!Number.isInteger(outletId) || outletId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet user tidak valid",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // RANGE 6 BULAN
    // =====================================================

    const now = new Date();

    const sixMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 5,
      1
    );

    // =====================================================
    // DASHBOARD DATA
    // =====================================================

    const [
      totalPurchase,
      totalDraft,
      totalApproved,
      totalReceived,
      totalReceipt,

      outletStocks,

      recentPurchase,

      purchaseChart,

      receiptChart,

      stockOutChart,

      lowStockItems,

      transferChart,
    ] = await Promise.all([
      // ===================================================
      // PURCHASE TOTAL
      // ===================================================

      prisma.outletPurchase.count({
        where: {
          outletId,
        },
      }),

      // ===================================================
      // PURCHASE DRAFT
      // ===================================================

      prisma.outletPurchase.count({
        where: {
          outletId,
          status: "DRAFT",
        },
      }),

      // ===================================================
      // PURCHASE APPROVED
      // ===================================================

      prisma.outletPurchase.count({
        where: {
          outletId,
          status: "APPROVED",
        },
      }),

      // ===================================================
      // PURCHASE RECEIVED
      // ===================================================

      prisma.outletPurchase.count({
        where: {
          outletId,
          status: "RECEIVED",
        },
      }),

      // ===================================================
      // RECEIPT
      // ===================================================

      prisma.outletReceipt.count({
        where: {
          outletId,
        },
      }),

      // ===================================================
      // OUTLET STOCK
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

          barang: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
            },
          },
        },
      }),

      // ===================================================
      // RECENT PURCHASE
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

      // ===================================================
      // PURCHASE 6 BULAN
      // ===================================================

      prisma.outletPurchase.findMany({
        where: {
          outletId,

          purchaseDate: {
            gte: sixMonthsAgo,
          },
        },

        select: {
          purchaseDate: true,
          total: true,
          status: true,
        },

        orderBy: {
          purchaseDate: "asc",
        },
      }),

      // ===================================================
      // RECEIPT 6 BULAN
      // ===================================================

      prisma.outletReceipt.findMany({
        where: {
          outletId,

          receiptDate: {
            gte: sixMonthsAgo,
          },
        },

        select: {
          id: true,
          receiptDate: true,

          items: {
            select: {
              qty: true,
            },
          },
        },

        orderBy: {
          receiptDate: "asc",
        },
      }),

      // ===================================================
      // STOCK OUT 6 BULAN
      // ===================================================

      prisma.outletStockOut.findMany({
        where: {
          outletId,

          trxDate: {
            gte: sixMonthsAgo,
          },

          status: "APPROVED",
        },

        select: {
          id: true,
          trxDate: true,
          qtyProcessed: true,
          wasteQty: true,
          netQty: true,
          totalCost: true,

          barang: {
            select: {
              name: true,
              unit: true,
            },
          },
        },

        orderBy: {
          trxDate: "asc",
        },
      }),

      // ===================================================
      // LOW STOCK
      // ===================================================

      prisma.outletStock.findMany({
        where: {
          outletId,
        },

        orderBy: {
          stock: "asc",
        },

        take: 5,

        select: {
          id: true,
          stock: true,
          minimumStock: true,

          barang: {
            select: {
              code: true,
              name: true,
              unit: true,
            },
          },
        },
      }),

      // ===================================================
      // TRANSFER 6 BULAN
      // ===================================================

      prisma.outletTransfer.findMany({
        where: {
          outletId,

          transferDate: {
            gte: sixMonthsAgo,
          },
        },

        select: {
          transferDate: true,
          status: true,

          items: {
            select: {
              qty: true,
              receivedQty: true,
            },
          },
        },

        orderBy: {
          transferDate: "asc",
        },
      }),
    ]);

    // =====================================================
    // STOCK CALCULATION
    // =====================================================

    let totalStock = 0;
    let lowStock = 0;
    let totalStockValue = 0;

    for (const item of outletStocks) {
      const stock = Number(item.stock ?? 0);
      const minimum = Number(item.minimumStock ?? 0);
      const averageCost = Number(item.averageCost ?? 0);

      totalStock += stock;

      if (stock <= minimum) {
        lowStock++;
      }

      totalStockValue += stock * averageCost;
    }

    // =====================================================
    // BULAN HELPER
    // =====================================================

    const monthKey = (date: Date) => {
      return `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
    };

    const monthLabel = (key: string) => {
      const [year, month] = key.split("-");

      const date = new Date(
        Number(year),
        Number(month) - 1,
        1
      );

      return date.toLocaleDateString("id-ID", {
        month: "short",
        year: "numeric",
      });
    };

    // =====================================================
    // GENERATE 6 BULAN
    // =====================================================

    const months: string[] = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - i,
        1
      );

      months.push(monthKey(date));
    }

    // =====================================================
    // PURCHASE TREND
    // =====================================================

    const purchaseByMonth: Record<
      string,
      {
        total: number;
        count: number;
      }
    > = {};

    for (const month of months) {
      purchaseByMonth[month] = {
        total: 0,
        count: 0,
      };
    }

    for (const purchase of purchaseChart) {
      const key = monthKey(
        new Date(purchase.purchaseDate)
      );

      if (!purchaseByMonth[key]) {
        continue;
      }

      purchaseByMonth[key].total += Number(
        purchase.total ?? 0
      );

      purchaseByMonth[key].count++;
    }

    const purchaseTrend = months.map((month) => ({
      month: monthLabel(month),

      total: purchaseByMonth[month].total,

      count: purchaseByMonth[month].count,
    }));

    // =====================================================
    // STOCK MOVEMENT
    // =====================================================

    const movementByMonth: Record<
      string,
      {
        stockIn: number;
        stockOut: number;
        waste: number;
      }
    > = {};

    for (const month of months) {
      movementByMonth[month] = {
        stockIn: 0,
        stockOut: 0,
        waste: 0,
      };
    }

    // =====================================================
    // STOCK IN DARI RECEIPT
    // =====================================================

    for (const receipt of receiptChart) {
      const key = monthKey(
        new Date(receipt.receiptDate)
      );

      if (!movementByMonth[key]) {
        continue;
      }

      for (const item of receipt.items) {
        movementByMonth[key].stockIn += Number(
          item.qty ?? 0
        );
      }
    }

    // =====================================================
    // STOCK OUT + WASTE
    // =====================================================

    for (const stockOut of stockOutChart) {
      const key = monthKey(
        new Date(stockOut.trxDate)
      );

      if (!movementByMonth[key]) {
        continue;
      }

      const qtyProcessed = Number(
        stockOut.qtyProcessed ?? 0
      );

      const wasteQty = Number(
        stockOut.wasteQty ?? 0
      );

      const netQtyRaw = Number(
        stockOut.netQty ?? 0
      );

      /*
       * Barang Keluar:
       *
       * Prioritas menggunakan netQty dari database.
       *
       * Jika netQty tidak tersedia, fallback:
       *
       * qtyProcessed - wasteQty
       */

      const stockOutQty =
        Number.isFinite(netQtyRaw) && netQtyRaw > 0
          ? netQtyRaw
          : Math.max(
              0,
              qtyProcessed - wasteQty
            );

      movementByMonth[key].stockOut +=
        stockOutQty;

      movementByMonth[key].waste += wasteQty;
    }

    // =====================================================
    // STOCK MOVEMENT TREND
    // =====================================================

    const stockMovementTrend = months.map(
      (month) => {
        const stockIn =
          movementByMonth[month].stockIn;

        const stockOut =
          movementByMonth[month].stockOut;

        const waste =
          movementByMonth[month].waste;

        return {
          month: monthLabel(month),

          stockIn,

          stockOut,

          waste,

          net:
            stockIn -
            stockOut -
            waste,
        };
      }
    );

    // =====================================================
    // STOCK MOVEMENT SUMMARY
    // =====================================================

    const stockMovementSummary =
      stockMovementTrend.reduce(
        (summary, item) => {
          summary.stockIn += Number(
            item.stockIn ?? 0
          );

          summary.stockOut += Number(
            item.stockOut ?? 0
          );

          summary.waste += Number(
            item.waste ?? 0
          );

          summary.net += Number(
            item.net ?? 0
          );

          return summary;
        },
        {
          stockIn: 0,
          stockOut: 0,
          waste: 0,
          net: 0,
        }
      );

    // =====================================================
    // TRANSFER TREND
    // =====================================================

    const transferByMonth: Record<
      string,
      {
        sent: number;
        partial: number;
        received: number;
      }
    > = {};

    for (const month of months) {
      transferByMonth[month] = {
        sent: 0,
        partial: 0,
        received: 0,
      };
    }

    for (const transfer of transferChart) {
      const key = monthKey(
        new Date(transfer.transferDate)
      );

      if (!transferByMonth[key]) {
        continue;
      }

      let qty = 0;

      for (const item of transfer.items) {
        qty += Number(
          item.receivedQty ??
            item.qty ??
            0
        );
      }

      const status = String(
        transfer.status || ""
      ).toUpperCase();

      if (status === "SENT") {
        transferByMonth[key].sent += qty;
      }

      if (status === "PARTIAL") {
        transferByMonth[key].partial += qty;
      }

      if (status === "RECEIVED") {
        transferByMonth[key].received += qty;
      }
    }

    const transferTrend = months.map(
      (month) => ({
        month: monthLabel(month),

        sent:
          transferByMonth[month].sent,

        partial:
          transferByMonth[month].partial,

        received:
          transferByMonth[month].received,
      })
    );

    // =====================================================
    // PURCHASE STATUS
    // =====================================================

    const purchaseStatus = [
      {
        name: "Draft",
        value: totalDraft,
      },

      {
        name: "Approved",
        value: totalApproved,
      },

      {
        name: "Received",
        value: totalReceived,
      },
    ];

    // =====================================================
    // LOW STOCK
    // =====================================================

    const lowStockChart =
      lowStockItems.map((item) => ({
        id: item.id,

        code: item.barang.code,

        name: item.barang.name,

        stock: Number(
          item.stock ?? 0
        ),

        minimum: Number(
          item.minimumStock ?? 0
        ),

        unit: item.barang.unit,
      }));

    // =====================================================
    // KPI / SUMMARY
    // =====================================================

    const approvedPercentage =
      totalPurchase > 0
        ? Math.min(
            100,
            Math.round(
              (totalApproved /
                totalPurchase) *
                100
            )
          )
        : 0;

    const receivedPercentage =
      totalPurchase > 0
        ? Math.min(
            100,
            Math.round(
              (totalReceived /
                totalPurchase) *
                100
            )
          )
        : 0;

    const draftPercentage =
      totalPurchase > 0
        ? Math.min(
            100,
            Math.round(
              (totalDraft /
                totalPurchase) *
                100
            )
          )
        : 0;

    // =====================================================
    // STOCK HEALTH
    // =====================================================

    const stockHealth = {
      totalItem: outletStocks.length,

      totalStock,

      lowStock,

      healthyItem:
        outletStocks.length -
        lowStock,

      lowStockPercentage:
        outletStocks.length > 0
          ? Math.round(
              (lowStock /
                outletStocks.length) *
                100
            )
          : 0,

      totalStockValue,
    };

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      // ===================================================
      // CURRENT USER
      // ===================================================

      user,

      // ===================================================
      // OUTLET
      // ===================================================

      outlet: user.outlet,

      // ===================================================
      // DASHBOARD
      // ===================================================

      data: {
        // ===============================================
        // SUMMARY
        // ===============================================

        totalPurchase,

        totalDraft,

        totalApproved,

        totalReceived,

        totalReceipt,

        totalStock,

        lowStock,

        totalStockValue,

        totalStockItem:
          outletStocks.length,

        // ===============================================
        // PERCENTAGE
        // ===============================================

        percentages: {
          approved:
            approvedPercentage,

          received:
            receivedPercentage,

          draft:
            draftPercentage,
        },

        // ===============================================
        // STOCK HEALTH
        // ===============================================

        stockHealth,

        // ===============================================
        // RECENT PURCHASE
        // ===============================================

        recentPurchase,

        // ===============================================
        // LOW STOCK ITEMS
        // ===============================================

        lowStockItems:
          lowStockChart,

        // ===============================================
        // CHARTS
        // ===============================================

        charts: {
          purchaseTrend,

          stockMovementTrend,

          stockMovementSummary,

          purchaseStatus,

          lowStockChart,

          transferTrend,
        },

        // ===============================================
        // PERIOD
        // ===============================================

        period: {
          months: 6,

          from: sixMonthsAgo,

          to: now,

          monthKeys: months,
        },
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