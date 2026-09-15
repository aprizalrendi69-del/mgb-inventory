import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/*
 * =========================================================
 * NORMALISASI NAMA
 * =========================================================
 *
 * Contoh:
 *
 * "Gula Pasir"
 * "GULA PASIR"
 * "  gula   pasir  "
 *
 * semuanya menjadi:
 *
 * "GULA PASIR"
 */

function normalizeName(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/*
 * =========================================================
 * GET DUPLICATE BARANG
 * =========================================================
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const search =
      searchParams.get("search")?.trim() || "";

    /*
     * =====================================================
     * AMBIL SEMUA BARANG
     * =====================================================
     */

    const barang = await prisma.barang.findMany({
      where: search
        ? {
            OR: [
              {
                code: {
                  contains: search,
                },
              },
              {
                name: {
                  contains: search,
                },
              },
              {
                barcode: {
                  contains: search,
                },
              },
            ],
          }
        : undefined,

      orderBy: {
        id: "asc",
      },
    });

    /*
     * =====================================================
     * KELOMPOKKAN BERDASARKAN NAMA
     * =====================================================
     */

    const groups = new Map<
      string,
      typeof barang
    >();

    for (const item of barang) {
      const key = normalizeName(item.name);

      if (!key) continue;

      const existing = groups.get(key);

      if (existing) {
        existing.push(item);
      } else {
        groups.set(key, [item]);
      }
    }

    /*
     * =====================================================
     * HANYA NAMA YANG LEBIH DARI 1
     * =====================================================
     */

    const duplicateGroups = Array.from(
      groups.entries()
    ).filter(
      ([, items]) => items.length > 1
    );

    /*
     * =====================================================
     * HASIL
     * =====================================================
     */

    const result = [];

    for (const [normalizedName, items] of duplicateGroups) {
      const detail = [];

      for (const item of items) {
        /*
         * =================================================
         * HITUNG PEMAKAIAN
         * =================================================
         */

        const [
          purchaseCount,
          receiptCount,
          outletPurchaseCount,
          outletReceiptCount,
          deliveryCount,
          saleCount,
          transferCount,
          manufactureCount,
          recipeItemCount,
          recipeOutputCount,
          adjustmentCount,
          stockMutationCount,
          stockCardCount,
          stockOpnameCount,
          stockOpnameHistoryCount,
          masterHargaCount,
          stockWasteCount,
          outletStockCount,
          outletBarangCount,
          batchStockCount,
          barangBatchCount,
          inventory,
        ] = await Promise.all([
          prisma.purchaseItem.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.receiptItem.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.outletPurchaseItem.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.outletReceiptItem.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.deliveryItem.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.outletSaleItem.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.outletTransferItem.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.manufactureOrderItem.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.recipeItem.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.recipe.count({
            where: {
              outputBarangId: item.id,
            },
          }),

          prisma.adjustmentItem.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.stockMutation.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.stockCard.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.stockOpnameItem.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.stockOpnameHistory.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.masterHarga.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.stockWaste.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.outletStock.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.outletBarang.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.batchStock.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.barangBatch.count({
            where: {
              barangId: item.id,
            },
          }),

          prisma.inventory.findUnique({
            where: {
              barangId: item.id,
            },
          }),
        ]);

        /*
         * =================================================
         * TOTAL PEMAKAIAN
         * =================================================
         */

        const transactionCount =
          purchaseCount +
          receiptCount +
          outletPurchaseCount +
          outletReceiptCount +
          deliveryCount +
          saleCount +
          transferCount +
          manufactureCount +
          recipeItemCount +
          recipeOutputCount +
          adjustmentCount +
          stockMutationCount +
          stockCardCount +
          stockOpnameCount +
          stockOpnameHistoryCount +
          masterHargaCount +
          stockWasteCount;

        /*
         * =================================================
         * ADA STOCK / RELASI INVENTORY
         * =================================================
         */

        const hasStock =
          Number(item.stock || 0) !== 0 ||
          Number(inventory?.stock || 0) !== 0 ||
          Number(inventory?.availableStock || 0) !== 0 ||
          Number(inventory?.reservedStock || 0) !== 0 ||
          batchStockCount > 0 ||
          barangBatchCount > 0 ||
          outletStockCount > 0;

        /*
         * =================================================
         * DIPAKAI ATAU TIDAK
         * =================================================
         */

        const used =
          transactionCount > 0 ||
          hasStock ||
          outletBarangCount > 0;

        /*
         * =================================================
         * STATUS KEAMANAN
         * =================================================
         */

        let status:
          | "DIPAKAI"
          | "BELUM_DIPAKAI"
          | "TIDAK_AKTIF";

        if (!item.active) {
          status = "TIDAK_AKTIF";
        } else if (used) {
          status = "DIPAKAI";
        } else {
          status = "BELUM_DIPAKAI";
        }

        detail.push({
          id: item.id,
          code: item.code,
          barcode: item.barcode,
          name: item.name,
          category: item.category,
          brand: item.brand,
          unit: item.unit,
          baseUnit: item.baseUnit,
          conversionRate: item.conversionRate,

          stock: item.stock,
          minimumStock: item.minimumStock,

          purchasePrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,

          active: item.active,
          source: item.source,

          transactionCount,

          hasStock,

          status,

          usage: {
            purchase: purchaseCount,
            receipt: receiptCount,
            outletPurchase: outletPurchaseCount,
            outletReceipt: outletReceiptCount,
            delivery: deliveryCount,
            outletSale: saleCount,
            outletTransfer: transferCount,
            manufacture: manufactureCount,
            recipeItem: recipeItemCount,
            recipeOutput: recipeOutputCount,
            adjustment: adjustmentCount,
            stockMutation: stockMutationCount,
            stockCard: stockCardCount,
            stockOpname: stockOpnameCount,
            stockOpnameHistory:
              stockOpnameHistoryCount,
            masterHarga: masterHargaCount,
            stockWaste: stockWasteCount,
            outletStock: outletStockCount,
            outletBarang: outletBarangCount,
            batchStock: batchStockCount,
            barangBatch: barangBatchCount,
            inventory: inventory ? 1 : 0,
          },

          /*
           * Barang yang aman dinonaktifkan:
           *
           * - masih aktif
           * - tidak pernah dipakai
           * - tidak punya stock
           * - tidak punya outlet registration
           */

          safeToDeactivate:
            item.active &&
            !used,
        });
      }

      /*
       * ===================================================
       * TENTUKAN REKOMENDASI UTAMA
       * ===================================================
       *
       * Prioritas:
       *
       * 1. Yang sudah dipakai
       * 2. Yang punya stock
       * 3. Yang aktif
       * 4. ID paling kecil
       */

      const sorted = [...detail].sort(
        (a, b) => {
          if (
            a.status === "DIPAKAI" &&
            b.status !== "DIPAKAI"
          ) {
            return -1;
          }

          if (
            a.status !== "DIPAKAI" &&
            b.status === "DIPAKAI"
          ) {
            return 1;
          }

          if (
            a.hasStock &&
            !b.hasStock
          ) {
            return -1;
          }

          if (
            !a.hasStock &&
            b.hasStock
          ) {
            return 1;
          }

          if (
            a.active &&
            !b.active
          ) {
            return -1;
          }

          if (
            !a.active &&
            b.active
          ) {
            return 1;
          }

          return a.id - b.id;
        }
      );

      const recommendedId =
        sorted[0]?.id ?? null;

      result.push({
        name: items[0].name,

        normalizedName,

        total: detail.length,

        recommendedId,

        items: detail,
      });
    }

    /*
     * =====================================================
     * SORT
     * =====================================================
     */

    result.sort((a, b) =>
      a.name.localeCompare(
        b.name,
        "id"
      )
    );

    /*
     * =====================================================
     * SUMMARY
     * =====================================================
     */

    const totalGroups =
      result.length;

    const totalDuplicateItems =
      result.reduce(
        (sum, group) =>
          sum + group.items.length,
        0
      );

    const safeItems =
      result.reduce(
        (sum, group) =>
          sum +
          group.items.filter(
            (item) =>
              item.safeToDeactivate
          ).length,
        0
      );

    const usedItems =
      result.reduce(
        (sum, group) =>
          sum +
          group.items.filter(
            (item) =>
              item.status ===
              "DIPAKAI"
          ).length,
        0
      );

    return NextResponse.json({
      success: true,

      data: result,

      summary: {
        totalGroups,
        totalDuplicateItems,
        safeItems,
        usedItems,
      },
    });
  } catch (error: any) {
    console.error(
      "GET BARANG DUPLICATES ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengecek barang duplikat",
      },
      {
        status: 500,
      }
    );
  }
}