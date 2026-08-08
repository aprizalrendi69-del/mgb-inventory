import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    /* =====================================================
       1. MASTER DATA
    ===================================================== */

    const [
      totalBarang,
      totalSupplier,
      totalCustomer,
      totalPurchase,
      totalDelivery,
    ] = await Promise.all([
      prisma.barang.count({
        where: {
          active: true,
        },
      }),

      prisma.supplier.count(),

      prisma.customer.count(),

      prisma.purchase.count(),

      prisma.delivery.count(),
    ]);

    /* =====================================================
       2. NILAI PERSEDIAAN
    ===================================================== */

    const inventories = await prisma.inventory.findMany({
      select: {
        stock: true,
        averageCost: true,
      },
    });

    const nilaiPersediaan = inventories.reduce(
      (total, item) => {
        const stock = Number(item.stock || 0);
        const cost = Number(item.averageCost || 0);

        return total + stock * cost;
      },
      0
    );

    /* =====================================================
       3. STOCK ALERT
       
       LEVEL:
       - OUT_OF_STOCK = stock 0
       - CRITICAL     = <= 50% minimum stock
       - LOW          = <= minimum stock
    ===================================================== */

    const stockData = await prisma.barang.findMany({
      where: {
        active: true,
        minimumStock: {
          gt: 0,
        },
      },

      select: {
        id: true,
        code: true,
        name: true,
        stock: true,
        minimumStock: true,
        unit: true,
      },

      orderBy: {
        stock: "asc",
      },

      take: 100,
    });

    const stockAlerts = stockData
      .map((item) => {
        const stock = Number(item.stock || 0);
        const minimumStock = Number(item.minimumStock || 0);

        const percentage =
          minimumStock > 0
            ? (stock / minimumStock) * 100
            : 100;

        let status:
          | "OUT_OF_STOCK"
          | "CRITICAL"
          | "LOW";

        let priority = 3;

        if (stock <= 0) {
          status = "OUT_OF_STOCK";
          priority = 1;
        } else if (stock <= minimumStock * 0.5) {
          status = "CRITICAL";
          priority = 2;
        } else {
          status = "LOW";
          priority = 3;
        }

        return {
          id: item.id,
          code: item.code,
          name: item.name,

          stock,
          minimumStock,

          unit: item.unit,

          percentage: Math.min(
            Math.max(percentage, 0),
            100
          ),

          shortage: Math.max(
            minimumStock - stock,
            0
          ),

          status,
          priority,
        };
      })

      .filter(
        (item) =>
          item.stock <= item.minimumStock
      )

      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }

        return a.stock - b.stock;
      })

      .slice(0, 20);

    /* =====================================================
       4. PURCHASE PENDING
    ===================================================== */

    const purchasePending =
      await prisma.purchase.findMany({
        where: {
          status: {
            in: [
              "DRAFT",
              "APPROVED",
            ],
          },
        },

        include: {
          supplier: true,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 10,
      });

    /* =====================================================
       5. DELIVERY PENDING
    ===================================================== */

    const deliveryPending =
      await prisma.delivery.findMany({
        where: {
          status: {
            in: [
              "DRAFT",
              "RELEASED",
            ],
          },
        },

        include: {
          customer: true,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 10,
      });

    /* =====================================================
       6. BARANG EXPIRED
    ===================================================== */

    const batchStocks =
      await prisma.batchStock.findMany({
        where: {
          qty: {
            gt: 0,
          },
        },

        include: {
          barang: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
              expiredWarning: true,
              hasExpired: true,
            },
          },
        },

        orderBy: {
          expiredDate: "asc",
        },

        take: 100,
      });

    const now = new Date();

    const expiredItems = batchStocks
      .map((item) => {
        const expiredDate =
          new Date(item.expiredDate);

        const diffMs =
          expiredDate.getTime() -
          now.getTime();

        const sisaHari = Math.ceil(
          diffMs /
            (1000 * 60 * 60 * 24)
        );

        const warningDays =
          Number(
            item.barang.expiredWarning || 30
          );

        let status:
          | "EXPIRED"
          | "WARNING"
          | "SAFE";

        if (sisaHari < 0) {
          status = "EXPIRED";
        } else if (
          sisaHari <= warningDays
        ) {
          status = "WARNING";
        } else {
          status = "SAFE";
        }

        return {
          id: item.id,

          barangId: item.barang.id,

          code: item.barang.code,

          name: item.barang.name,

          unit: item.barang.unit,

          batch: item.batchNumber,

          qty: Number(item.qty || 0),

          expired: item.expiredDate,

          sisaHari,

          status,

          expiredWarning: warningDays,
        };
      })

      .filter(
        (item) =>
          item.status === "EXPIRED" ||
          item.status === "WARNING"
      )

      .sort(
        (a, b) =>
          a.sisaHari -
          b.sisaHari
      )

      .slice(0, 10);

    /* =====================================================
       7. AKTIVITAS TERBARU
    ===================================================== */

    const purchases =
      await prisma.purchase.findMany({
        select: {
          id: true,
          number: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 10,
      });

    const deliveries =
      await prisma.delivery.findMany({
        select: {
          id: true,
          number: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 10,
      });

    const activities = [
      ...purchases.map((item) => ({
        id: `purchase-${item.id}`,

        type: "purchase",

        title:
          item.number ||
          `PO #${item.id}`,

        description:
          `Purchase Order • ${item.status}`,

        createdAt:
          item.updatedAt ||
          item.createdAt,
      })),

      ...deliveries.map((item) => ({
        id: `delivery-${item.id}`,

        type: "delivery",

        title:
          item.number ||
          `Delivery #${item.id}`,

        description:
          `Delivery Order • ${item.status}`,

        createdAt:
          item.updatedAt ||
          item.createdAt,
      })),
    ]
      .sort(
        (a, b) =>
          new Date(
            b.createdAt
          ).getTime() -
          new Date(
            a.createdAt
          ).getTime()
      )
      .slice(0, 10);

    /* =====================================================
       8. GRAFIK INVENTORY
    ===================================================== */

    const stockCards =
      await prisma.stockCard.findMany({
        select: {
          trxDate: true,
          qtyIn: true,
          qtyOut: true,
        },

        orderBy: {
          trxDate: "desc",
        },

        take: 500,
      });

    const chartMap = new Map<
      string,
      {
        masuk: number;
        keluar: number;
        date: Date;
      }
    >();

    for (const card of stockCards) {
      const date =
        new Date(card.trxDate);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        continue;
      }

      const key =
        `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}-${String(
          date.getDate()
        ).padStart(2, "0")}`;

      if (!chartMap.has(key)) {
        chartMap.set(key, {
          masuk: 0,
          keluar: 0,
          date,
        });
      }

      const current =
        chartMap.get(key)!;

      current.masuk += Number(
        card.qtyIn || 0
      );

      current.keluar += Number(
        card.qtyOut || 0
      );
    }

    const chart = Array.from(
      chartMap.entries()
    )
      .sort(
        ([, a], [, b]) =>
          a.date.getTime() -
          b.date.getTime()
      )
      .slice(-7)
      .map(
        ([, value]) => ({
          label:
            String(
              value.date.getDate()
            ).padStart(2, "0"),

          masuk: value.masuk,

          keluar: value.keluar,
        })
      );

    /* =====================================================
       9. RESPONSE
    ===================================================== */

    return NextResponse.json({
      success: true,

      data: {
        stats: {
          totalBarang,

          totalSupplier,

          totalCustomer,

          totalPurchase,

          totalDelivery,

          nilaiPersediaan,

          stockAlertCount:
            stockAlerts.length,

          stockOutCount:
            stockAlerts.filter(
              (item) =>
                item.status ===
                "OUT_OF_STOCK"
            ).length,

          stockCriticalCount:
            stockAlerts.filter(
              (item) =>
                item.status ===
                "CRITICAL"
            ).length,

          stockLowCount:
            stockAlerts.filter(
              (item) =>
                item.status ===
                "LOW"
            ).length,

          purchaseTrend: 0,

          deliveryTrend: 0,

          stockTrend: 0,
        },

        stockAlerts,

        expiredItems,

        activities,

        purchasePending,

        deliveryPending,

        chart,
      },
    });
  } catch (error) {
    console.error(
      "DASHBOARD ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Gagal mengambil dashboard",

        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },

      {
        status: 500,
      }
    );
  }
}