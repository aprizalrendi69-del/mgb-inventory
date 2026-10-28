
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOutletActor } from "@/lib/outlet-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TIME_ZONE = "Asia/Jakarta";

const n = (value: unknown): number => {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
};

const sum = <T,>(items: T[], getValue: (item: T) => number) =>
  items.reduce((total, item) => total + n(getValue(item)), 0);

const jakartaDateKey = (date: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
};

const validDateKey = (value: string | null): boolean => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};

const startOfJakartaDay = (dateKey: string) =>
  new Date(`${dateKey}T00:00:00.000+07:00`);

const endOfJakartaDay = (dateKey: string) =>
  new Date(`${dateKey}T23:59:59.999+07:00`);

const outletSelect = {
  id: true,
  code: true,
  name: true,
} as const;

const barangSelect = {
  id: true,
  code: true,
  name: true,
  unit: true,
  baseUnit: true,
  conversionRate: true,
  minimumStock: true,
  purchasePrice: true,
  sellingPrice: true,
  hasExpired: true,
  active: true,
} as const;

const supplierSelect = {
  id: true,
  code: true,
  name: true,
  tempoDays: true,
} as const;

const errorResponse = (message: string, status: number) =>
  NextResponse.json(
    { success: false, message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );

export async function GET(request: NextRequest) {
  try {
    // ============================================================
    // 1. AKSES
    // ============================================================

    const actor = await getOutletActor();

    if (!actor?.active) {
      return errorResponse(
        "Sesi tidak valid. Silakan login kembali.",
        401
      );
    }

    if (!["ADMIN", "MANAGER"].includes(actor.role)) {
      return errorResponse(
        "Akses laporan owner ditolak.",
        403
      );
    }

    // ============================================================
    // 2. PERIODE — MENGGUNAKAN WAKTU ASIA/JAKARTA
    // ============================================================

    const now = new Date();
    const todayKey = jakartaDateKey(now);
    const currentMonth = `${todayKey.slice(0, 7)}-01`;

    const requestedFrom = request.nextUrl.searchParams.get("from");
    const requestedTo = request.nextUrl.searchParams.get("to");

    if (
      (requestedFrom && !validDateKey(requestedFrom)) ||
      (requestedTo && !validDateKey(requestedTo))
    ) {
      return errorResponse(
        "Format tanggal tidak valid. Gunakan YYYY-MM-DD.",
        400
      );
    }

    const fromKey = requestedFrom || currentMonth;
    const toKey = requestedTo || todayKey;

    if (fromKey > toKey) {
      return errorResponse(
        "Tanggal awal tidak boleh melebihi tanggal akhir.",
        400
      );
    }

    const from = startOfJakartaDay(fromKey);
    const to = endOfJakartaDay(toKey);
    const range = { gte: from, lte: to };

    // ============================================================
    // 3. AMBIL SUMBER DATA
    //
    // Semua query hanya membaca data.
    // Tidak ada update, delete, atau perubahan struktur database.
    // ============================================================

    const [
      activeItems,
      supplierCount,
      outlets,

      centralStocks,
      outletStocks,

      sales,
      centralPurchases,
      outletPurchases,

      centralWaste,
      outletWaste,

      allPayables,
      payments,
      pendingPaymentCount,
      pettyCashTransactions,
      pendingPettyCashCount,
      cashAccounts,

      stockCards,
      centralMutations,
      outletMutations,
      transfers,
      centralReceipts,
      outletReceipts,
      stockOpnames,
      manufactureOrders,

      centralLowStock,
      outletLowStock,
    ] = await Promise.all([
      // Master data
      prisma.barang.count({
        where: { active: true },
      }),

      prisma.supplier.count(),

      prisma.outlet.findMany({
        where: { active: true },
        select: outletSelect,
        orderBy: { name: "asc" },
      }),

      // Posisi persediaan saat laporan dibuka
      prisma.inventory.findMany({
        select: {
          id: true,
          barangId: true,
          warehouse: true,
          stock: true,
          reservedStock: true,
          availableStock: true,
          minimumStock: true,
          averageCost: true,
          updatedAt: true,
          barang: { select: barangSelect },
        },
      }),

      prisma.outletStock.findMany({
        select: {
          id: true,
          outletId: true,
          barangId: true,
          stock: true,
          minimumStock: true,
          averageCost: true,
          updatedAt: true,
          outlet: { select: outletSelect },
          barang: { select: barangSelect },
        },
      }),

      // Penjualan POS — hanya PAID, tidak menghitung VOID
      prisma.outletSale.findMany({
        where: {
          saleDate: range,
          status: "PAID",
        },
        orderBy: { saleDate: "desc" },
        include: {
          outlet: { select: outletSelect },
          user: {
            select: {
              id: true,
              fullname: true,
              username: true,
            },
          },
          items: {
            include: {
              barang: { select: barangSelect },
              menu: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  category: true,
                },
              },
            },
          },
        },
      }),

      // Pembelian pusat
      prisma.purchase.findMany({
        where: { purchaseDate: range },
        orderBy: { purchaseDate: "desc" },
        include: {
          supplier: { select: supplierSelect },
          items: {
            include: {
              barang: { select: barangSelect },
            },
          },
          receipts: {
            orderBy: { receiptDate: "desc" },
            include: {
              items: {
                include: {
                  barang: { select: barangSelect },
                },
              },
            },
          },
        },
      }),

      // Pembelian outlet
      prisma.outletPurchase.findMany({
        where: { purchaseDate: range },
        orderBy: { purchaseDate: "desc" },
        include: {
          outlet: { select: outletSelect },
          supplier: { select: supplierSelect },
          items: {
            include: {
              barang: { select: barangSelect },
            },
          },
          receipts: {
            orderBy: { receiptDate: "desc" },
            include: {
              items: {
                include: {
                  barang: { select: barangSelect },
                },
              },
            },
          },
        },
      }),

      // Waste pusat yang disetujui
      prisma.stockWaste.findMany({
        where: {
          trxDate: range,
          status: "APPROVED",
        },
        orderBy: { trxDate: "desc" },
        include: {
          barang: { select: barangSelect },
          user: {
            select: {
              id: true,
              fullname: true,
            },
          },
        },
      }),

      // Waste / pemakaian / stock-out outlet
      prisma.outletStockOut.findMany({
        where: {
          trxDate: range,
          status: "APPROVED",
        },
        orderBy: { trxDate: "desc" },
        include: {
          outlet: { select: outletSelect },
          barang: { select: barangSelect },
          user: {
            select: {
              id: true,
              fullname: true,
            },
          },
        },
      }),

      // Semua tagihan — posisi utang saat ini
      prisma.purchasePayable.findMany({
        orderBy: [
          { dueDate: "asc" },
          { invoiceDate: "desc" },
        ],
        include: {
          supplier: { select: supplierSelect },
          outlet: { select: outletSelect },
          purchase: {
            select: {
              id: true,
              number: true,
              purchaseDate: true,
              status: true,
              total: true,
            },
          },
          outletPurchase: {
            select: {
              id: true,
              number: true,
              purchaseDate: true,
              status: true,
              total: true,
              outlet: { select: outletSelect },
            },
          },
          payments: {
            orderBy: { paymentDate: "desc" },
            select: {
              id: true,
              number: true,
              paymentDate: true,
              amount: true,
              method: true,
              status: true,
              referenceNumber: true,
              note: true,
            },
          },
        },
      }),

      // Pembayaran supplier dalam periode
      prisma.payment.findMany({
        where: { paymentDate: range },
        orderBy: { paymentDate: "desc" },
        include: {
          supplier: { select: supplierSelect },
          purchase: {
            select: {
              id: true,
              number: true,
              total: true,
            },
          },
          outletPurchase: {
            select: {
              id: true,
              number: true,
              total: true,
              outlet: { select: outletSelect },
            },
          },
          payable: {
            select: {
              id: true,
              invoiceNumber: true,
              amount: true,
              paidAmount: true,
              outstanding: true,
              dueDate: true,
            },
          },
        },
      }),

      prisma.payment.count({
        where: { status: "PENDING" },
      }),

      // Mutasi petty cash pada periode
      prisma.pettyCash.findMany({
        where: { trxDate: range },
        orderBy: { trxDate: "desc" },
        include: {
          outlet: { select: outletSelect },
          account: {
            select: {
              id: true,
              code: true,
              name: true,
              outletId: true,
            },
          },
        },
      }),

      prisma.pettyCash.count({
        where: { status: "PENDING" },
      }),

      // Saldo rekening petty cash terkini
      prisma.pettyCashAccount.findMany({
        orderBy: { name: "asc" },
        include: {
          outlet: { select: outletSelect },
        },
      }),

      // Kartu stok pada periode
      prisma.stockCard.findMany({
        where: { trxDate: range },
        orderBy: { trxDate: "desc" },
        include: {
          barang: { select: barangSelect },
        },
      }),

      // Mutasi gudang pusat
      prisma.mutationStock.findMany({
        where: { mutationDate: range },
        orderBy: { mutationDate: "desc" },
        include: {
          barang: { select: barangSelect },
        },
      }),

      // Mutasi stok outlet
      prisma.stockMutation.findMany({
        where: { createdAt: range },
        orderBy: { createdAt: "desc" },
        include: {
          outlet: { select: outletSelect },
          barang: { select: barangSelect },
        },
      }),

      // Transfer antar gudang/outlet
      prisma.outletTransfer.findMany({
        where: { transferDate: range },
        orderBy: { transferDate: "desc" },
        include: {
          sourceOutlet: { select: outletSelect },
          outlet: { select: outletSelect },
          items: {
            include: {
              barang: { select: barangSelect },
            },
          },
        },
      }),

      // Penerimaan pembelian pusat
      prisma.receipt.findMany({
        where: { receiptDate: range },
        orderBy: { receiptDate: "desc" },
        include: {
          supplier: { select: supplierSelect },
          purchase: {
            select: {
              id: true,
              number: true,
              status: true,
              total: true,
            },
          },
          items: {
            include: {
              barang: { select: barangSelect },
            },
          },
        },
      }),

      // Penerimaan pembelian outlet
      prisma.outletReceipt.findMany({
        where: { receiptDate: range },
        orderBy: { receiptDate: "desc" },
        include: {
          outlet: { select: outletSelect },
          supplier: { select: supplierSelect },
          purchase: {
            select: {
              id: true,
              number: true,
              status: true,
              total: true,
            },
          },
          items: {
            include: {
              barang: { select: barangSelect },
            },
          },
        },
      }),

      // Stock opname
      prisma.stockOpname.findMany({
        where: { date: range },
        orderBy: { date: "desc" },
        include: {
          outlet: { select: outletSelect },
          items: {
            include: {
              barang: { select: barangSelect },
            },
          },
        },
      }),

      // Produksi / manufacture
      prisma.manufactureOrder.findMany({
        where: { productionDate: range },
        orderBy: { productionDate: "desc" },
        include: {
          outlet: { select: outletSelect },
          recipe: {
            include: {
              menu: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  price: true,
                },
              },
              productCk: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
              outputBarang: {
                select: barangSelect,
              },
              items: {
                include: {
                  barang: { select: barangSelect },
                },
              },
            },
          },
          items: {
            include: {
              barang: { select: barangSelect },
            },
          },
          creator: {
            select: {
              id: true,
              fullname: true,
            },
          },
        },
      }),

      // Stok pusat nol/negatif
      prisma.inventory.findMany({
        where: { stock: { lte: 0 } },
        orderBy: { stock: "asc" },
        include: {
          barang: { select: barangSelect },
        },
      }),

      // Stok outlet nol/negatif
      prisma.outletStock.findMany({
        where: { stock: { lte: 0 } },
        orderBy: { stock: "asc" },
        include: {
          outlet: { select: outletSelect },
          barang: { select: barangSelect },
        },
      }),
    ]);

    // Ambil BOM/recipe aktif untuk estimasi HPP menu berdasarkan biaya bahan.
    // Ini hanya estimasi berbasis averageCost saat ini, bukan HPP historis.
    const recipes = await prisma.recipe.findMany({
      where: { active: true },
      include: {
        menu: { select: { id: true, name: true } },
        items: {
          include: {
            barang: {
              select: {
                id: true,
                name: true,
                purchasePrice: true,
                conversionRate: true,
              },
            },
          },
        },
      },
    });

    // ============================================================
    // 4. HITUNG RINGKASAN UTAMA
    // ============================================================

    const centralInventoryValue = sum(
      centralStocks,
      (item) => n(item.stock) * n(item.averageCost)
    );

    const outletInventoryValue = sum(
      outletStocks,
      (item) => n(item.stock) * n(item.averageCost)
    );

    const salesTotal = sum(sales, (item) => item.total);
    const salesGrossTotal = sum(sales, (item) => item.subtotal);
    const salesDiscountTotal = sum(sales, (item) => item.discount);

    const unitCostFor = (barangId: number, outletId: number, purchasePrice = 0, conversionRate = 1) => {
      const outletStock = outletStocks.find((row) => row.outletId === outletId && row.barangId === barangId);
      if (outletStock && n(outletStock.averageCost) > 0) return n(outletStock.averageCost);
      const centralStock = centralStocks.find((row) => row.barangId === barangId);
      if (centralStock && n(centralStock.averageCost) > 0) return n(centralStock.averageCost);
      const rate = n(conversionRate) > 0 ? n(conversionRate) : 1;
      return n(purchasePrice) / rate;
    };

    let estimatedCogs = 0;
    let costedSalesItemCount = 0;
    let uncostedSalesItemCount = 0;
    let totalSalesItemCount = 0;
    const cogsByOutlet = new Map<number, number>();

    for (const sale of sales) {
      for (const item of sale.items) {
        totalSalesItemCount += 1;
        let itemUnitCost = 0;

        if (item.barangId && item.barang) {
          itemUnitCost = unitCostFor(
            item.barangId,
            sale.outletId,
            item.barang.purchasePrice,
            item.barang.conversionRate
          );
        } else if (item.menuId) {
          const candidates = recipes.filter((recipe) => recipe.menuId === item.menuId);
          const recipe = candidates.find((candidate) => candidate.outletId === sale.outletId) ??
            candidates.find((candidate) => candidate.outletId === null);
          if (recipe && n(recipe.outputQty) > 0 && recipe.items.length > 0) {
            const recipeCost = recipe.items.reduce((sumCost, recipeItem) => {
              const cost = unitCostFor(
                recipeItem.barangId,
                sale.outletId,
                recipeItem.barang.purchasePrice,
                recipeItem.barang.conversionRate
              );
              return sumCost + n(recipeItem.qty) * cost;
            }, 0);
            itemUnitCost = recipeCost / n(recipe.outputQty);
          }
        }

        const qty = Math.max(0, n(item.qty));
        if (itemUnitCost > 0) {
          const lineCost = qty * itemUnitCost;
          estimatedCogs += lineCost;
          costedSalesItemCount += 1;
          cogsByOutlet.set(sale.outletId, (cogsByOutlet.get(sale.outletId) ?? 0) + lineCost);
        } else {
          uncostedSalesItemCount += 1;
        }
      }
    }

    const cogsCoverage = totalSalesItemCount > 0
      ? (costedSalesItemCount / totalSalesItemCount) * 100
      : 100;
    // Pendapatan untuk estimasi laba memakai subtotal dikurangi diskon;
    // PPN dan service charge tidak dianggap otomatis sebagai pendapatan usaha.
    const profitNetSales = Math.max(0, salesGrossTotal - salesDiscountTotal);
    const estimatedGrossProfit = profitNetSales - estimatedCogs;
    const hasCompleteCostCoverage = uncostedSalesItemCount === 0;

    // Total pembelian yang direalisasikan hanya dari PO APPROVED/RECEIVED.
    // Dokumen DRAFT/CANCELLED tetap dikirim sebagai detail untuk audit,
    // tetapi tidak ikut menaikkan angka pembelian pada ringkasan owner.
    const centralCommittedPurchases = centralPurchases.filter(
      (item) => item.status === "APPROVED" || item.status === "RECEIVED"
    );
    const outletCommittedPurchases = outletPurchases.filter(
      (item) => item.status === "APPROVED" || item.status === "RECEIVED"
    );

    const centralPurchaseDocumentTotal = sum(
      centralPurchases,
      (item) => item.total
    );
    const outletPurchaseDocumentTotal = sum(
      outletPurchases,
      (item) => item.total
    );

    const centralPurchaseTotal = sum(
      centralCommittedPurchases,
      (item) => item.total
    );

    const outletPurchaseTotal = sum(
      outletCommittedPurchases,
      (item) => item.total
    );

    const centralWasteValue = sum(
      centralWaste,
      (item) => item.totalCost
    );

    const outletWasteValue = sum(
      outletWaste,
      (item) => item.totalCost
    );

    const outstandingPayables = sum(
      allPayables,
      (item) => Math.max(0, n(item.outstanding))
    );

    // APPROVED belum tentu uang sudah keluar: pembayaran TEMPO bisa
    // berstatus APPROVED. Hanya PAID dihitung sebagai pembayaran aktual.
    const paidPayments = payments.filter(
      (item) => item.status === "PAID"
    );

    const actualSupplierPaymentTotal = sum(
      paidPayments,
      (item) => item.amount
    );

    const approvedPettyCash = pettyCashTransactions.filter(
      (item) => item.status === "APPROVED"
    );

    const pettyCashIn = sum(
      approvedPettyCash.filter((item) => item.type === "IN"),
      (item) => item.amount
    );

    const pettyCashOut = sum(
      approvedPettyCash.filter((item) => item.type === "OUT"),
      (item) => item.amount
    );

    const pettyCashBalance = sum(
      cashAccounts,
      (item) => item.currentBalance
    );

    const lowStockCount =
      centralLowStock.length + outletLowStock.length;

    // ============================================================
    // 5. AGREGASI PER OUTLET
    // ============================================================

    type OutletSummary = {
      id: number;
      code: string;
      name: string;
      sales: number;
      purchases: number;
      inventoryValue: number;
      wasteValue: number;
      estimatedCogs: number;
      estimatedGrossProfit: number;
      salesTransactions: number;
      stockItemCount: number;
    };

    const byOutlet = new Map<number, OutletSummary>(
      outlets.map((outlet) => [
        outlet.id,
        {
          ...outlet,
          sales: 0,
          purchases: 0,
          inventoryValue: 0,
          wasteValue: 0,
          estimatedCogs: 0,
          estimatedGrossProfit: 0,
          salesTransactions: 0,
          stockItemCount: 0,
        },
      ])
    );

    for (const sale of sales) {
      const row = byOutlet.get(sale.outletId);
      if (!row) continue;

      row.sales += n(sale.total);
      row.salesTransactions += 1;
    }

    for (const [outletId, cost] of cogsByOutlet.entries()) {
      const row = byOutlet.get(outletId);
      if (row) {
        row.estimatedCogs = cost;
        row.estimatedGrossProfit = row.sales - cost;
      }
    }

    for (const purchase of outletCommittedPurchases) {
      const row = byOutlet.get(purchase.outletId);
      if (row) row.purchases += n(purchase.total);
    }

    for (const stock of outletStocks) {
      const row = byOutlet.get(stock.outletId);
      if (!row) continue;

      row.inventoryValue += n(stock.stock) * n(stock.averageCost);
      row.stockItemCount += 1;
    }

    for (const waste of outletWaste) {
      const row = byOutlet.get(waste.outletId);
      if (row) row.wasteValue += n(waste.totalCost);
    }

    const outletRows = Array.from(byOutlet.values()).sort(
      (a, b) => b.sales - a.sales || a.name.localeCompare(b.name, "id")
    );

    // ============================================================
    // 6. TREN PENJUALAN HARIAN
    // ============================================================

    const trendMap = new Map<string, { date: string; sales: number }>();

    for (const sale of sales) {
      const key = jakartaDateKey(new Date(sale.saleDate));
      const row = trendMap.get(key) ?? { date: key, sales: 0 };

      row.sales += n(sale.total);
      trendMap.set(key, row);
    }

    const trend = Array.from(trendMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // ============================================================
    // 7. RINGKASAN KEUANGAN PER REKENING
    // ============================================================

    const pettyCashByAccount = cashAccounts.map((account) => {
      const transactions = approvedPettyCash.filter(
        (transaction) => transaction.accountId === account.id
      );

      return {
        id: account.id,
        code: account.code,
        name: account.name,
        outletId: account.outletId,
        outlet: account.outlet,
        openingBalance: n(account.openingBalance),
        currentBalance: n(account.currentBalance),
        periodIn: sum(
          transactions.filter((item) => item.type === "IN"),
          (item) => item.amount
        ),
        periodOut: sum(
          transactions.filter((item) => item.type === "OUT"),
          (item) => item.amount
        ),
        transactionCount: transactions.length,
      };
    });

    const paymentsByStatus = {
      pending: payments.filter((item) => item.status === "PENDING").length,
      approved: payments.filter((item) => item.status === "APPROVED").length,
      paid: payments.filter((item) => item.status === "PAID").length,
      rejected: payments.filter((item) => item.status === "REJECTED").length,
      cancelled: payments.filter((item) => item.status === "CANCELLED").length,
    };

    // ============================================================
    // 8. DATA STATUS / KETERBATASAN SUMBER
    //
    // Jangan membuat laba bersih dari penjualan - pembelian.
    // Jangan menyamakan omzet dengan saldo kas.
    // ============================================================

    const dataAvailability = {
      sales: {
        available: true,
        source: "OutletSale",
        includesItems: true,
        note:
          "Penjualan hanya mencakup transaksi POS berstatus PAID. Transaksi VOID dikecualikan.",
      },
      purchases: {
        available: true,
        source: "Purchase dan OutletPurchase",
        includesItems: true,
        note:
          "Angka pembelian ringkasan hanya mencakup PO APPROVED/RECEIVED. Rincian tetap menyertakan semua status agar dokumen DRAFT/CANCELLED dapat diaudit.",
      },
      profitAndLoss: {
        available: true,
        source: "Estimasi HPP dari averageCost stok saat ini dan BOM/recipe aktif",
        note:
          "Laba kotor merupakan estimasi. Biaya memakai averageCost saat ini atau fallback harga beli master, bukan HPP historis pada tanggal transaksi. Laba bersih belum dapat dihitung karena biaya operasional dan retur belum lengkap.",
        cogsCoveragePercentage: cogsCoverage,
        costedSalesItemCount,
        uncostedSalesItemCount,
      },
      cash: {
        available: true,
        source: "PettyCashAccount, PettyCash, dan Payment",
        note:
          "Saldo rekening petty cash tersedia. Saldo bank dan rekonsiliasi kas menyeluruh tidak disimpulkan dari omzet atau pembayaran supplier.",
      },
      payables: {
        available: true,
        source: "PurchasePayable",
        note:
          "Nilai outstanding merupakan posisi saat laporan dibuka, bukan saldo historis pada akhir periode yang dipilih.",
      },
      inventory: {
        available: true,
        source: "Inventory, OutletStock, StockCard, StockMutation, dan dokumen terkait",
        note:
          "Valuasi menggunakan stok saat ini dikalikan averageCost saat ini. Bukan snapshot historis akhir periode.",
      },
      production: {
        available: true,
        source: "ManufactureOrder dan Recipe",
        note:
          "Data pesanan dan BOM/recipe dikirim untuk penelusuran. Biaya produksi historis tidak disamakan dengan valuasi stok saat ini.",
      },
    };

    // ============================================================
    // 9. RESPONS API
    //
    // Mempertahankan field lama:
    // period, summary, outlets, trend, notes.
    //
    // Field details/finance/profit tersedia untuk pengembangan
    // tabel rincian di halaman laporan owner.
    // ============================================================

    const response = {
      success: true,

      period: {
        from: from.toISOString(),
        to: to.toISOString(),
        fromDate: fromKey,
        toDate: toKey,
        timeZone: TIME_ZONE,
      },

      summary: {
        activeItems,
        suppliers: supplierCount,
        activeOutlets: outlets.length,

        centralInventoryValue,
        outletInventoryValue,
        totalInventoryValue:
          centralInventoryValue + outletInventoryValue,

        salesTotal,
        salesGrossTotal,
        salesDiscountTotal,
        salesTransactions: sales.length,

        centralPurchaseTotal,
        outletPurchaseTotal,
        totalPurchase: centralPurchaseTotal + outletPurchaseTotal,

        approvedWasteValue: centralWasteValue + outletWasteValue,
        centralWasteValue,
        outletWasteValue,

        outstandingPayables,

        pendingPayments: pendingPaymentCount,
        pendingPettyCash: pendingPettyCashCount,
        lowStockCount,
      },

      // Data untuk grafik dan tabel performa outlet
      outlets: outletRows,
      trend,

      // Ringkasan untuk bagian Laba Rugi.
      // HPP/laba ditandai null sampai sumber historis tervalidasi.
      profit: {
        grossSales: salesGrossTotal,
        discount: salesDiscountTotal,
        netSales: profitNetSales,
        costOfGoodsSold: estimatedCogs,
        grossProfit: estimatedGrossProfit,
        estimated: true,
        costCoveragePercentage: cogsCoverage,
        costedSalesItemCount,
        uncostedSalesItemCount,
        operatingExpenses: null,
        netProfit: null,
        status: hasCompleteCostCoverage ? "ESTIMATED_GROSS_PROFIT" : "PARTIAL_ESTIMATE",
        explanation:
          "HPP/laba kotor dihitung sebagai estimasi dari BOM aktif dan averageCost saat ini. Laba bersih tidak ditampilkan karena biaya operasional lengkap, retur, dan HPP historis belum tersedia.",
      },

      // Ringkasan untuk Kas & Keuangan
      finance: {
        pettyCashOpeningBalance: sum(
          cashAccounts,
          (item) => item.openingBalance
        ),
        pettyCashCurrentBalance: pettyCashBalance,
        pettyCashPeriodIn: pettyCashIn,
        pettyCashPeriodOut: pettyCashOut,
        supplierPaymentsPeriod: actualSupplierPaymentTotal,
        paymentsByStatus,
        accounts: pettyCashByAccount,
        note:
          "Saldo petty cash tidak sama dengan saldo seluruh kas dan bank perusahaan.",
      },

      // Ringkasan untuk Pembelian & Utang
      purchasing: {
        centralDocumentCount: centralPurchases.length,
        outletDocumentCount: outletPurchases.length,
        centralCommittedDocumentCount: centralCommittedPurchases.length,
        outletCommittedDocumentCount: outletCommittedPurchases.length,
        centralPurchaseDocumentTotal,
        outletPurchaseDocumentTotal,
        purchaseDocumentTotal: centralPurchaseDocumentTotal + outletPurchaseDocumentTotal,
        centralPurchaseTotal,
        outletPurchaseTotal,
        totalPurchase: centralPurchaseTotal + outletPurchaseTotal,
        outstandingPayables,
        payableCount: allPayables.length,
        overduePayables: allPayables.filter(
          (payable) =>
            n(payable.outstanding) > 0 &&
            payable.dueDate !== null &&
            payable.dueDate < now
        ).length,
      },

      // Ringkasan untuk Stok & Produksi
      inventory: {
        centralStockItemCount: centralStocks.length,
        outletStockItemCount: outletStocks.length,
        centralInventoryValue,
        outletInventoryValue,
        totalInventoryValue:
          centralInventoryValue + outletInventoryValue,
        centralLowStockCount: centralLowStock.length,
        outletLowStockCount: outletLowStock.length,
        stockCardCount: stockCards.length,
        centralMutationCount: centralMutations.length,
        outletMutationCount: outletMutations.length,
        transferCount: transfers.length,
        stockOpnameCount: stockOpnames.length,
        manufactureOrderCount: manufactureOrders.length,
      },

      // Data detail untuk tabel per bagian.
      // Tidak ada field sensitif seperti password/session.
      details: {
        sales,

        centralPurchases,
        outletPurchases,

        payables: allPayables,
        payments,

        pettyCash: pettyCashTransactions,
        cashAccounts: pettyCashByAccount,

        centralStocks,
        outletStocks,
        centralLowStock,
        outletLowStock,

        stockCards,
        centralMutations,
        outletMutations,
        transfers,

        centralWaste,
        outletWaste,

        centralReceipts,
        outletReceipts,

        stockOpnames,
        manufactureOrders,
      },

      dataAvailability,

      notes: [
        "Penjualan POS hanya menghitung transaksi PAID. Transaksi VOID tidak dihitung.",
        "Nilai persediaan adalah snapshot saat laporan dibuka, bukan saldo historis akhir periode.",
        "Outstanding utang dan saldo rekening adalah posisi saat laporan dibuka.",
        "Ringkasan total pembelian hanya menghitung PO APPROVED/RECEIVED; rincian dokumen tetap menampilkan status DRAFT/CANCELLED untuk audit.",
        "Waste hanya menghitung transaksi berstatus APPROVED.",
        "Transfer internal bukan penjualan dan tidak boleh dihitung sebagai omzet.",
        "Laba kotor adalah estimasi berdasarkan BOM aktif dan averageCost saat ini; cek persentase cakupan HPP. Laba bersih belum tersedia karena seluruh biaya operasional dan retur belum tervalidasi.",
        "Saldo petty cash tidak sama dengan omzet atau laba bersih.",
        "Tanggal laporan mengikuti zona waktu Asia/Jakarta.",
      ],
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("GET /api/laporan/owner error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Laporan owner gagal dimuat. Periksa log server dan pastikan skema Prisma yang aktif sesuai dengan model laporan.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
