import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * GET /api/outlet/stock/history
 *
 * HISTORY SELURUH AKTIVITAS BARANG OUTLET
 *
 * SUMBER DATA:
 *
 * 1. OutletReceiptItem
 *    -> Barang masuk dari supplier
 *
 * 2. OutletTransferItem
 *    -> Barang masuk dari gudang pusat / outlet lain
 *
 * 3. DeliveryItem
 *    -> Barang dikirim dari gudang pusat ke outlet
 *
 * 4. OutletStockOut
 *    -> Pemakaian / waste outlet
 *
 * 5. StockOpnameItem
 *    -> Stock opname outlet
 *
 * 6. OutletPurchaseItem
 *    -> PO outlet
 *       (INFORMASI, bukan stock movement)
 *
 * TIDAK MEMASUKKAN:
 *
 * - StockCard
 * - StockMutation
 *
 * Karena kedua model tersebut adalah stock pusat
 * dan tidak mempunyai outletId.
 *
 * StockOpnameHistory juga tidak ditampilkan sebagai
 * transaksi terpisah agar Stock Opname tidak muncul dua kali.
 *
 * ---------------------------------------------------------
 *
 * ACCESS:
 *
 * ADMIN
 * -> semua outlet
 * -> bisa filter outletId
 *
 * MANAGER
 * -> semua outlet
 * -> bisa filter outletId
 *
 * OUTLET_ADMIN
 * -> hanya outlet miliknya
 * -> outletId dari query diabaikan
 *
 * ---------------------------------------------------------
 *
 * QUERY:
 *
 * /api/outlet/stock/history
 *
 * /api/outlet/stock/history?outletId=1
 *
 * /api/outlet/stock/history?barangId=10
 *
 * /api/outlet/stock/history?outletId=1&barangId=10
 *
 * /api/outlet/stock/history?outletId=1&barangId=10&limit=100
 *
 * =========================================================
 */

type HistoryDirection = "IN" | "OUT" | "INFO";

type HistoryRow = {
  id: string;
  date: Date;

  type: string;
  direction: HistoryDirection;

  number: string | null;

  outletId: number | null;
  barangId: number;

  qty: number;

  stockBefore: number | null;
  stockAfter: number | null;

  status: string | null;

  description: string | null;

  source: string;
};

export async function GET(req: NextRequest) {
  try {
    // =====================================================
    // 1. SESSION
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

    // =====================================================
    // 2. PARSE SESSION
    // =====================================================

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

    const userId = Number(sessionData?.id);

    if (!Number.isInteger(userId) || userId <= 0) {
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

    // =====================================================
    // 3. USER LOGIN
    // =====================================================

    const user = await prisma.user.findUnique({
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
            active: true,
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
        {
          status: 404,
        }
      );
    }

    // =====================================================
    // 4. USER AKTIF
    // =====================================================

    if (!user.active) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak aktif",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // 5. ROLE
    // =====================================================

    const allowedRoles = [
      "ADMIN",
      "MANAGER",
      "OUTLET_ADMIN",
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses history stock outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // 6. QUERY PARAMETER
    // =====================================================

    const { searchParams } = new URL(req.url);

    const outletIdParam =
      searchParams.get("outletId");

    const barangIdParam =
      searchParams.get("barangId");

    const limitParam =
      searchParams.get("limit");

    // =====================================================
    // 7. BARANG ID
    // =====================================================

    let barangId: number | null = null;

    if (barangIdParam !== null) {
      const parsedBarangId =
        Number(barangIdParam);

      if (
        !Number.isInteger(parsedBarangId) ||
        parsedBarangId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Barang ID tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      barangId = parsedBarangId;
    }

    // =====================================================
    // 8. LIMIT
    // =====================================================

    let limit = 500;

    if (limitParam !== null) {
      const parsedLimit =
        Number(limitParam);

      if (
        !Number.isInteger(parsedLimit) ||
        parsedLimit <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Limit tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      limit = Math.min(parsedLimit, 2000);
    }

    // =====================================================
    // 9. OUTLET SCOPE
    // =====================================================

    let outletId: number | null = null;

    // -----------------------------------------------------
    // OUTLET ADMIN
    // -----------------------------------------------------

    if (user.role === "OUTLET_ADMIN") {
      /*
       * OUTLET_ADMIN SELALU MENGGUNAKAN outletId
       * DARI SESSION.
       *
       * Query outletId sengaja diabaikan.
       */

      if (
        !user.outletId ||
        !Number.isInteger(user.outletId) ||
        user.outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum terhubung dengan outlet",
          },
          {
            status: 400,
          }
        );
      }

      outletId = user.outletId;
    }

    // -----------------------------------------------------
    // ADMIN / MANAGER
    // -----------------------------------------------------

    else if (
      user.role === "ADMIN" ||
      user.role === "MANAGER"
    ) {
      if (outletIdParam !== null) {
        const parsedOutletId =
          Number(outletIdParam);

        if (
          !Number.isInteger(parsedOutletId) ||
          parsedOutletId <= 0
        ) {
          return NextResponse.json(
            {
              success: false,
              message: "Outlet ID tidak valid",
            },
            {
              status: 400,
            }
          );
        }

        outletId = parsedOutletId;
      }
    }

    // =====================================================
    // 10. VALIDASI OUTLET
    // =====================================================

    let selectedOutlet: {
      id: number;
      code: string;
      name: string;
      active: boolean;
    } | null = null;

    if (outletId !== null) {
      selectedOutlet =
        await prisma.outlet.findUnique({
          where: {
            id: outletId,
          },

          select: {
            id: true,
            code: true,
            name: true,
            active: true,
          },
        });

      if (!selectedOutlet) {
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

      if (!selectedOutlet.active) {
        return NextResponse.json(
          {
            success: false,
            message: "Outlet sedang tidak aktif",
          },
          {
            status: 400,
          }
        );
      }
    }

    // =====================================================
    // 11. VALIDASI BARANG
    // =====================================================

    let selectedBarang: {
      id: number;
      code: string;
      name: string;
      unit: string;
      barcode: string | null;
    } | null = null;

    if (barangId !== null) {
      selectedBarang =
        await prisma.barang.findUnique({
          where: {
            id: barangId,
          },

          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            barcode: true,
          },
        });

      if (!selectedBarang) {
        return NextResponse.json(
          {
            success: false,
            message: "Barang tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }
    }

    // =====================================================
    // 12. HISTORY ARRAY
    // =====================================================

    const history: HistoryRow[] = [];

    // =====================================================
    // 13. OUTLET RECEIPT
    //
    // Barang masuk dari supplier
    // =====================================================

    const receiptWhere: any = {};

    if (outletId !== null) {
      receiptWhere.receipt = {
        outletId,
      };
    }

    if (barangId !== null) {
      receiptWhere.barangId = barangId;
    }

    const receiptItems =
      await prisma.outletReceiptItem.findMany({
        where: receiptWhere,

        select: {
          id: true,
          barangId: true,
          qty: true,
          price: true,

          receipt: {
            select: {
              id: true,
              number: true,
              receiptDate: true,
              remarks: true,

              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },

              supplier: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },

          barang: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
              barcode: true,
            },
          },
        },

        orderBy: {
          receipt: {
            receiptDate: "desc",
          },
        },
      });

    for (const item of receiptItems) {
      history.push({
        id: `OUTLET_RECEIPT-${item.id}`,

        date: item.receipt.receiptDate,

        type: "OUTLET_RECEIPT",

        direction: "IN",

        number: item.receipt.number,

        outletId: item.receipt.outlet.id,

        barangId: item.barangId,

        qty: Number(item.qty),

        stockBefore: null,
        stockAfter: null,

        status: "RECEIVED",

        description: item.receipt.supplier
          ? `Barang masuk dari supplier ${item.receipt.supplier.name}`
          : "Barang masuk dari supplier",

        source: "OutletReceiptItem",
      });
    }

    // =====================================================
    // 14. OUTLET TRANSFER
    //
    // Barang masuk dari pusat / outlet lain
    // =====================================================

    const transferWhere: any = {};

    if (outletId !== null) {
      transferWhere.transfer = {
        outletId,
      };
    }

    if (barangId !== null) {
      transferWhere.barangId = barangId;
    }

    const transferItems =
      await prisma.outletTransferItem.findMany({
        where: transferWhere,

        select: {
          id: true,
          barangId: true,
          qty: true,
          receivedQty: true,

          transfer: {
            select: {
              id: true,
              number: true,
              transferDate: true,
              status: true,
              remarks: true,

              sourceOutlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },

              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },

          barang: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
              barcode: true,
            },
          },
        },

        orderBy: {
          transfer: {
            transferDate: "desc",
          },
        },
      });

    for (const item of transferItems) {
      const sourceName =
        item.transfer.sourceOutlet?.name ||
        "Gudang Pusat";

      /*
       * Hanya barang yang benar-benar diterima
       * dianggap sebagai transaksi masuk.
       *
       * Jika receivedQty = 0, transfer belum diterima.
       */
      const receivedQty =
        Number(item.receivedQty);

      if (receivedQty <= 0) {
        continue;
      }

      history.push({
        id: `TRANSFER-${item.id}`,

        date: item.transfer.transferDate,

        type: "TRANSFER_IN",

        direction: "IN",

        number: item.transfer.number,

        outletId: item.transfer.outlet.id,

        barangId: item.barangId,

        qty: receivedQty,

        stockBefore: null,
        stockAfter: null,

        status: item.transfer.status,

        description:
          `Barang masuk dari ${sourceName}`,

        source: "OutletTransferItem",
      });
    }

    // =====================================================
    // 15. DELIVERY KE OUTLET
    //
    // Delivery hanya diambil jika:
    //
    // Delivery.outletId = outlet tujuan
    //
    // Jadi delivery customer tidak ikut.
    // =====================================================

    const deliveryWhere: any = {
      outletId: {
        not: null,
      },
    };

    if (outletId !== null) {
      deliveryWhere.outletId = outletId;
    }

    if (barangId !== null) {
      deliveryWhere.items = {
        some: {
          barangId,
        },
      };
    }

    const deliveries =
      await prisma.delivery.findMany({
        where: deliveryWhere,

        select: {
          id: true,
          number: true,
          deliveryDate: true,
          status: true,
          remarks: true,
          outletId: true,

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          items: {
            where:
              barangId !== null
                ? {
                    barangId,
                  }
                : undefined,

            select: {
              id: true,
              barangId: true,
              qty: true,
              note: true,
            },
          },
        },

        orderBy: {
          deliveryDate: "desc",
        },
      });

    for (const delivery of deliveries) {
      /*
       * outletId sudah dipastikan tidak null
       * oleh where di atas.
       */

      if (delivery.outletId === null) {
        continue;
      }

      /*
       * Delivery belum tentu sudah benar-benar
       * menjadi stock outlet.
       *
       * Hanya RELEASED / DELIVERED yang dianggap
       * sebagai transaksi barang keluar dari pusat
       * menuju outlet.
       */

      if (
        delivery.status !== "RELEASED" &&
        delivery.status !== "DELIVERED"
      ) {
        continue;
      }

      for (const item of delivery.items) {
        history.push({
          id: `DELIVERY-${item.id}`,

          date: delivery.deliveryDate,

          type: "DELIVERY_IN",

          direction: "IN",

          number: delivery.number,

          outletId: delivery.outletId,

          barangId: item.barangId,

          qty: Number(item.qty),

          stockBefore: null,
          stockAfter: null,

          status: delivery.status,

          description:
            item.note ||
            "Barang dikirim dari gudang pusat ke outlet",

          source: "DeliveryItem",
        });
      }
    }

    // =====================================================
    // 16. OUTLET STOCK OUT
    //
    // Pemakaian / waste
    // =====================================================

    const stockOutWhere: any = {};

    if (outletId !== null) {
      stockOutWhere.outletId = outletId;
    }

    if (barangId !== null) {
      stockOutWhere.barangId = barangId;
    }

    const stockOuts =
      await prisma.outletStockOut.findMany({
        where: stockOutWhere,

        select: {
          id: true,
          number: true,
          barangId: true,
          trxDate: true,
          type: true,
          status: true,
          qtyProcessed: true,
          wasteQty: true,
          netQty: true,
          unitCost: true,
          totalCost: true,
          note: true,
          outletId: true,

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          barang: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
              barcode: true,
            },
          },

          user: {
            select: {
              id: true,
              fullname: true,
            },
          },
        },

        orderBy: {
          trxDate: "desc",
        },
      });

    for (const item of stockOuts) {
      /*
       * Stock hanya berkurang dari netQty.
       *
       * Contoh:
       *
       * qtyProcessed = 10
       * wasteQty     = 2
       * netQty       = 8
       *
       * Maka stock keluar = 8.
       */

      const qty =
        Number(item.netQty) > 0
          ? Number(item.netQty)
          : Number(item.qtyProcessed);

      if (qty <= 0) {
        continue;
      }

      history.push({
        id: `STOCK_OUT-${item.id}`,

        date: item.trxDate,

        type: "STOCK_OUT",

        direction: "OUT",

        number: item.number,

        outletId: item.outletId,

        barangId: item.barangId,

        qty,

        stockBefore: null,
        stockAfter: null,

        status: item.status,

        description:
          item.note ||
          `Pemakaian / ${item.type}`,

        source: "OutletStockOut",
      });
    }

    // =====================================================
    // 17. STOCK OPNAME
    //
    // HANYA StockOpnameItem
    //
    // StockOpnameHistory tidak ditampilkan sebagai
    // transaksi terpisah agar tidak duplicate.
    // =====================================================

    const opnameItemWhere: any = {};

    if (outletId !== null) {
      opnameItemWhere.opname = {
        outletId,
      };
    }

    if (barangId !== null) {
      opnameItemWhere.barangId = barangId;
    }

    const opnameItems =
      await prisma.stockOpnameItem.findMany({
        where: opnameItemWhere,

        select: {
          id: true,
          opnameId: true,
          barangId: true,
          systemQty: true,
          physicalQty: true,
          difference: true,
          note: true,

          barang: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
              barcode: true,
            },
          },

          opname: {
            select: {
              id: true,
              code: true,
              date: true,
              status: true,
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

        orderBy: {
          opname: {
            date: "desc",
          },
        },
      });

    for (const item of opnameItems) {
      const systemQty =
        Number(item.systemQty);

      const physicalQty =
        Number(item.physicalQty);

      const difference =
        Number(item.difference);

      /*
       * Stock opname bukan transaksi stock biasa.
       *
       * Karena SO hanya audit fisik:
       *
       * direction = INFO
       *
       * stockBefore = systemQty
       * stockAfter  = physicalQty
       *
       * qty = difference
       */

      history.push({
        id: `STOCK_OPNAME-${item.id}`,

        date: item.opname.date,

        type: "STOCK_OPNAME",

        direction: "INFO",

        number: item.opname.code,

        outletId: item.opname.outletId,

        barangId: item.barangId,

        qty: difference,

        stockBefore: systemQty,

        stockAfter: physicalQty,

        status: item.opname.status,

        description:
          item.note ||
          `Stock opname: sistem ${systemQty}, fisik ${physicalQty}, selisih ${difference}`,

        source: "StockOpnameItem",
      });
    }

    // =====================================================
    // 18. OUTLET PURCHASE
    //
    // PO outlet ditampilkan sebagai INFO.
    //
    // PO bukan stock movement.
    // =====================================================

    const purchaseWhere: any = {};

    if (outletId !== null) {
      purchaseWhere.purchase = {
        outletId,
      };
    }

    if (barangId !== null) {
      purchaseWhere.barangId = barangId;
    }

    const purchaseItems =
      await prisma.outletPurchaseItem.findMany({
        where: purchaseWhere,

        select: {
          id: true,
          barangId: true,
          qty: true,
          receivedQty: true,
          price: true,
          subtotal: true,

          purchase: {
            select: {
              id: true,
              number: true,
              purchaseDate: true,
              status: true,
              remarks: true,

              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },

              supplier: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },

          barang: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
              barcode: true,
            },
          },
        },

        orderBy: {
          purchase: {
            purchaseDate: "desc",
          },
        },
      });

    for (const item of purchaseItems) {
      history.push({
        id: `OUTLET_PURCHASE-${item.id}`,

        date: item.purchase.purchaseDate,

        type: "OUTLET_PURCHASE",

        direction: "INFO",

        number: item.purchase.number,

        outletId: item.purchase.outlet.id,

        barangId: item.barangId,

        qty: Number(item.qty),

        stockBefore: null,
        stockAfter: null,

        status: item.purchase.status,

        description: item.purchase.supplier
          ? `PO ke supplier ${item.purchase.supplier.name}`
          : "Purchase Order outlet",

        source: "OutletPurchaseItem",
      });
    }

    // =====================================================
    // 19. SORT HISTORY
    //
    // Terbaru -> terlama
    // =====================================================

    history.sort(
      (a, b) =>
        b.date.getTime() -
        a.date.getTime()
    );

    // =====================================================
    // 20. LIMIT
    //
    // Limit dilakukan SETELAH semua sumber
    // digabung dan diurutkan.
    // =====================================================

    const totalBeforeLimit =
      history.length;

    const limitedHistory =
      history.slice(0, limit);

    // =====================================================
    // 21. MASTER BARANG
    //
    // Satu query saja untuk melengkapi barang
    // yang muncul di history.
    // =====================================================

    const barangIds = [
      ...new Set(
        limitedHistory.map(
          (item) => item.barangId
        )
      ),
    ];

    const barangList =
      barangIds.length > 0
        ? await prisma.barang.findMany({
            where: {
              id: {
                in: barangIds,
              },
            },

            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
              barcode: true,
            },
          })
        : [];

    const barangMap = new Map(
      barangList.map((barang) => [
        barang.id,
        barang,
      ])
    );

    // =====================================================
    // 22. FORMAT DATA
    // =====================================================

    const data =
      limitedHistory.map((item) => {
        const barang =
          barangMap.get(
            item.barangId
          ) || null;

        return {
          id: item.id,

          date: item.date,

          type: item.type,

          direction: item.direction,

          number: item.number,

          outletId: item.outletId,

          barangId: item.barangId,

          barang,

          qty: Number(item.qty),

          stockBefore:
            item.stockBefore === null
              ? null
              : Number(item.stockBefore),

          stockAfter:
            item.stockAfter === null
              ? null
              : Number(item.stockAfter),

          status: item.status,

          description:
            item.description,

          source: item.source,
        };
      });

    // =====================================================
    // 23. SUMMARY
    //
    // SUMMARY DARI DATA YANG DIKEMBALIKAN
    // =====================================================

    const stockIn =
      data
        .filter(
          (item) =>
            item.direction === "IN"
        )
        .reduce(
          (total, item) =>
            total +
            Number(item.qty),
          0
        );

    const stockOut =
      data
        .filter(
          (item) =>
            item.direction === "OUT"
        )
        .reduce(
          (total, item) =>
            total +
            Number(item.qty),
          0
        );

    const informational =
      data.filter(
        (item) =>
          item.direction === "INFO"
      ).length;

    // =====================================================
    // 24. SUMMARY PER TYPE
    // =====================================================

    const byType: Record<
      string,
      number
    > = {};

    for (const item of data) {
      byType[item.type] =
        (byType[item.type] || 0) + 1;
    }

    // =====================================================
    // 25. RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      scope: {
        role: user.role,
        outletId,
      },

      user: {
        id: user.id,
        fullname: user.fullname,
        role: user.role,
        outletId: user.outletId,
        outlet: user.outlet,
      },

      filter: {
        outletId,
        barangId,
        limit,
      },

      selected: {
        outlet: selectedOutlet,
        barang: selectedBarang,
      },

      data,

      summary: {
        total: data.length,

        totalBeforeLimit,

        stockIn,

        stockOut,

        informational,

        netMovement:
          stockIn - stockOut,

        byType,
      },

      meta: {
        limit,

        hasMore:
          totalBeforeLimit > limit,

        sources: [
          "OutletReceiptItem",
          "OutletTransferItem",
          "DeliveryItem",
          "OutletStockOut",
          "StockOpnameItem",
          "OutletPurchaseItem",
        ],

        stockMovementSources: [
          "OutletReceiptItem",
          "OutletTransferItem",
          "DeliveryItem",
          "OutletStockOut",
        ],

        informationalSources: [
          "StockOpnameItem",
          "OutletPurchaseItem",
        ],

        excludedSources: [
          "StockCard",
          "StockMutation",
          "StockOpnameHistory",
        ],

        note:
          "History merupakan gabungan aktivitas barang yang berkaitan dengan outlet. Receipt, Transfer, Delivery, dan Stock Out merupakan transaksi pergerakan barang. Stock Opname dan Purchase Order hanya bersifat informasi dan tidak digunakan untuk menghitung stock OutletStock.",
      },
    });
  } catch (error: any) {
    console.error(
      "GET OUTLET STOCK HISTORY ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil history stock outlet",
      },
      {
        status: 500,
      }
    );
  }
}