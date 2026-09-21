import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    /* =====================================================
       PERIOD GRAFIK
    ===================================================== */

    const { searchParams } = new URL(req.url);

    const periodParam = searchParams.get("period");

    const period =
      periodParam === "30" || periodParam === "90"
        ? Number(periodParam)
        : 7;

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
       2. NILAI PERSEDIAAN PUSAT
    ===================================================== */

    const inventories = await prisma.inventory.findMany({
      select: {
        stock: true,
        averageCost: true,
      },
    });

    const nilaiPersediaanPusat = inventories.reduce(
      (total, item) => {
        const stock = Number(item.stock || 0);
        const cost = Number(item.averageCost || 0);

        return total + stock * cost;
      },
      0
    );

    /* =====================================================
       2B. NILAI PERSEDIAAN OUTLET

       Setiap outlet memiliki OutletStock sendiri.

       Nilai:
       stock × averageCost

       Sekaligus dibuat breakdown per outlet supaya dashboard
       bisa menampilkan:

       Outlet A     Rp 10.000.000
       Outlet B     Rp  7.500.000
       Outlet C     Rp  3.200.000

       Nilai tetap menggunakan averageCost milik OutletStock.
    ===================================================== */

    const outletStocks = await prisma.outletStock.findMany({
      select: {
        stock: true,
        averageCost: true,

        outlet: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    /* =====================================================
       BREAKDOWN NILAI PERSEDIAAN PER OUTLET
    ===================================================== */

    type OutletInventoryBreakdown = {
      outletId: number;
      outletCode: string;
      outletName: string;
      value: number;
    };

    const outletInventoryMap =
      new Map<number, OutletInventoryBreakdown>();

    for (const item of outletStocks) {
      const stock = Number(item.stock || 0);
      const cost = Number(item.averageCost || 0);

      const value = stock * cost;

      /*
       * Jika relasi outlet tidak ditemukan, skip.
       * OutletStock normalnya selalu mempunyai outlet.
       */
      if (!item.outlet) {
        continue;
      }

      const existing =
        outletInventoryMap.get(item.outlet.id);

      if (existing) {
        existing.value += value;
      } else {
        outletInventoryMap.set(item.outlet.id, {
          outletId: item.outlet.id,

          outletCode:
            item.outlet.code ||
            `OUTLET-${item.outlet.id}`,

          outletName:
            item.outlet.name ||
            `Outlet ${item.outlet.id}`,

          value,
        });
      }
    }

    /*
     * Urutkan berdasarkan nama outlet
     * supaya dashboard konsisten.
     */
    const nilaiPersediaanOutletBreakdown =
      Array.from(
        outletInventoryMap.values()
      ).sort((a, b) =>
        a.outletName.localeCompare(
          b.outletName,
          "id"
        )
      );

    /*
     * Total seluruh outlet dihitung dari breakdown.
     *
     * Dengan cara ini:
     *
     * nilaiPersediaanOutlet
     *
     * selalu sama dengan total:
     *
     * Outlet A + Outlet B + Outlet C + ...
     */
    const nilaiPersediaanOutlet =
      nilaiPersediaanOutletBreakdown.reduce(
        (total, outlet) =>
          total + outlet.value,
        0
      );

    /* =====================================================
       2C. TOTAL SELURUH PERSEDIAAN

       Pusat + seluruh outlet
    ===================================================== */

    const nilaiPersediaanTotal =
      nilaiPersediaanPusat +
      nilaiPersediaanOutlet;

    /* =====================================================
       3. STOCK ALERT
    ===================================================== */

    const stockData =
      await prisma.barang.findMany({
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
        const stock = Number(
          item.stock || 0
        );

        const minimumStock =
          Number(
            item.minimumStock || 0
          );

        const percentage =
          minimumStock > 0
            ? (stock / minimumStock) *
              100
            : 100;

        let status:
          | "OUT_OF_STOCK"
          | "CRITICAL"
          | "LOW";

        let priority = 3;

        if (stock <= 0) {
          status = "OUT_OF_STOCK";
          priority = 1;
        } else if (
          stock <= minimumStock * 0.5
        ) {
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
            Math.max(
              percentage,
              0
            ),
            100
          ),

          shortage: Math.max(
            minimumStock -
              stock,
            0
          ),

          status,
          priority,
        };
      })
      .filter(
        (item) =>
          item.stock <=
          item.minimumStock
      )
      .sort((a, b) => {
        if (
          a.priority !==
          b.priority
        ) {
          return (
            a.priority -
            b.priority
          );
        }

        return (
          a.stock -
          b.stock
        );
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

    const expiredItems =
      batchStocks
        .map((item) => {
          const expiredDate =
            new Date(
              item.expiredDate
            );

          const diffMs =
            expiredDate.getTime() -
            now.getTime();

          const sisaHari =
            Math.ceil(
              diffMs /
                (1000 *
                  60 *
                  60 *
                  24)
            );

          const warningDays =
            Number(
              item.barang
                .expiredWarning ||
                30
            );

          let status:
            | "EXPIRED"
            | "WARNING"
            | "SAFE";

          if (sisaHari < 0) {
            status = "EXPIRED";
          } else if (
            sisaHari <=
            warningDays
          ) {
            status = "WARNING";
          } else {
            status = "SAFE";
          }

          return {
            id: item.id,

            barangId:
              item.barang.id,

            code:
              item.barang.code,

            name:
              item.barang.name,

            unit:
              item.barang.unit,

            batch:
              item.batchNumber,

            qty: Number(
              item.qty || 0
            ),

            expired:
              item.expiredDate,

            sisaHari,

            status,

            expiredWarning:
              warningDays,
          };
        })
        .filter(
          (item) =>
            item.status ===
              "EXPIRED" ||
            item.status ===
              "WARNING"
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
      ...purchases.map(
        (item) => ({
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
        })
      ),

      ...deliveries.map(
        (item) => ({
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
        })
      ),
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

       7 / 30 / 90 HARI
    ===================================================== */

    const startDate =
      new Date();

    startDate.setHours(
      0,
      0,
      0,
      0
    );

    startDate.setDate(
      startDate.getDate() -
        (period - 1)
    );

    const stockCards =
      await prisma.stockCard.findMany({
        where: {
          trxDate: {
            gte: startDate,
          },
        },

        select: {
          trxDate: true,
          qtyIn: true,
          qtyOut: true,
        },

        orderBy: {
          trxDate: "asc",
        },
      });

    /* =====================================================
       SIAPKAN SEMUA TANGGAL

       Tanggal tanpa transaksi tetap muncul.
    ===================================================== */

    const chartMap = new Map<
      string,
      {
        masuk: number;
        keluar: number;
        date: Date;
      }
    >();

    for (
      let i = 0;
      i < period;
      i++
    ) {
      const date =
        new Date(
          startDate
        );

      date.setDate(
        startDate.getDate() +
          i
      );

      const key =
        `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}-${String(
          date.getDate()
        ).padStart(2, "0")}`;

      chartMap.set(
        key,
        {
          masuk: 0,
          keluar: 0,
          date,
        }
      );
    }

    /* =====================================================
       MASUKKAN DATA STOCK CARD
    ===================================================== */

    for (
      const card of stockCards
    ) {
      const date =
        new Date(
          card.trxDate
        );

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

      const current =
        chartMap.get(key);

      if (!current) {
        continue;
      }

      current.masuk += Number(
        card.qtyIn || 0
      );

      current.keluar += Number(
        card.qtyOut || 0
      );
    }

    /* =====================================================
       FORMAT CHART
    ===================================================== */

    const chart =
      Array.from(
        chartMap.entries()
      ).map(
        ([dateKey, value]) => ({
          id: dateKey,

          date: dateKey,

          label:
            value.date.toLocaleDateString(
              "id-ID",
              {
                day: "2-digit",
                month:
                  period <= 7
                    ? "short"
                    : undefined,
              }
            ),

          masuk:
            value.masuk,

          keluar:
            value.keluar,
        })
      );

    /* =====================================================
       9. USER ONLINE
    ===================================================== */

    const onlineThreshold =
      new Date(
        Date.now() -
          2 * 60 * 1000
      );

    const onlineUsers =
      await prisma.user.findMany({
        where: {
          active: true,

          lastSeen: {
            gte: onlineThreshold,
          },
        },

        select: {
          id: true,
          username: true,
          fullname: true,
          role: true,
          lastSeen: true,

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },

        orderBy: {
          lastSeen: "desc",
        },
      });

    /* =====================================================
       FORMAT USER ONLINE
    ===================================================== */

    const formattedOnlineUsers =
      onlineUsers.map(
        (user) => ({
          id: user.id,

          username:
            user.username,

          fullname:
            user.fullname ||
            user.username,

          role: user.role,

          outlet:
            user.outlet
              ? {
                  id:
                    user.outlet
                      .id,

                  code:
                    user.outlet
                      .code,

                  name:
                    user.outlet
                      .name,
                }
              : null,

          lastSeen:
            user.lastSeen,

          status:
            "ONLINE" as const,
        })
      );

    /* =====================================================
       10. RESPONSE
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

          /*
           * BACKWARD COMPATIBILITY
           *
           * nilaiPersediaan tetap menunjuk
           * inventory pusat.
           */
          nilaiPersediaan:
            nilaiPersediaanPusat,

          /*
           * INVENTORY PUSAT
           */
          nilaiPersediaanPusat,

          /*
           * TOTAL INVENTORY SELURUH OUTLET
           */
          nilaiPersediaanOutlet,

          /*
           * BREAKDOWN INVENTORY PER OUTLET
           *
           * Contoh:
           *
           * [
           *   {
           *     outletId: 1,
           *     outletCode: "OUT-A",
           *     outletName: "Outlet A",
           *     value: 10000000
           *   },
           *   {
           *     outletId: 2,
           *     outletCode: "OUT-B",
           *     outletName: "Outlet B",
           *     value: 7500000
           *   }
           * ]
           */
          nilaiPersediaanOutletBreakdown,

          /*
           * INVENTORY PUSAT +
           * SELURUH OUTLET
           */
          nilaiPersediaanTotal,

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

          /* JUMLAH USER ONLINE */
          onlineUserCount:
            formattedOnlineUsers.length,
        },

        /* USER ONLINE */
        onlineUsers:
          formattedOnlineUsers,

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