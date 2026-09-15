import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

export async function POST(
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
    const { id } = await params;

    const barangId = Number(id);

    if (!Number.isInteger(barangId)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID barang tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * CEK BARANG
     * =====================================================
     */

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
            "Barang tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * =====================================================
     * CEK PEMAKAIAN
     * =====================================================
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
          barangId,
        },
      }),

      prisma.receiptItem.count({
        where: {
          barangId,
        },
      }),

      prisma.outletPurchaseItem.count({
        where: {
          barangId,
        },
      }),

      prisma.outletReceiptItem.count({
        where: {
          barangId,
        },
      }),

      prisma.deliveryItem.count({
        where: {
          barangId,
        },
      }),

      prisma.outletSaleItem.count({
        where: {
          barangId,
        },
      }),

      prisma.outletTransferItem.count({
        where: {
          barangId,
        },
      }),

      prisma.manufactureOrderItem.count({
        where: {
          barangId,
        },
      }),

      prisma.recipeItem.count({
        where: {
          barangId,
        },
      }),

      prisma.recipe.count({
        where: {
          outputBarangId: barangId,
        },
      }),

      prisma.adjustmentItem.count({
        where: {
          barangId,
        },
      }),

      prisma.stockMutation.count({
        where: {
          barangId,
        },
      }),

      prisma.stockCard.count({
        where: {
          barangId,
        },
      }),

      prisma.stockOpnameItem.count({
        where: {
          barangId,
        },
      }),

      prisma.stockOpnameHistory.count({
        where: {
          barangId,
        },
      }),

      prisma.masterHarga.count({
        where: {
          barangId,
        },
      }),

      prisma.stockWaste.count({
        where: {
          barangId,
        },
      }),

      prisma.outletStock.count({
        where: {
          barangId,
        },
      }),

      prisma.outletBarang.count({
        where: {
          barangId,
        },
      }),

      prisma.batchStock.count({
        where: {
          barangId,
        },
      }),

      prisma.barangBatch.count({
        where: {
          barangId,
        },
      }),

      prisma.inventory.findUnique({
        where: {
          barangId,
        },
      }),
    ]);

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

    const hasStock =
      Number(barang.stock || 0) !== 0 ||
      Number(
        inventory?.stock || 0
      ) !== 0 ||
      Number(
        inventory?.availableStock || 0
      ) !== 0 ||
      Number(
        inventory?.reservedStock || 0
      ) !== 0 ||
      batchStockCount > 0 ||
      barangBatchCount > 0 ||
      outletStockCount > 0;

    const hasOutletRelation =
      outletBarangCount > 0;

    /*
     * =====================================================
     * BARANG TIDAK BOLEH DINONAKTIFKAN
     * =====================================================
     */

    if (
      transactionCount > 0 ||
      hasStock ||
      hasOutletRelation
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Barang tidak bisa dinonaktifkan karena sudah digunakan dalam transaksi, memiliki stok, atau terdaftar di outlet.",

          data: {
            id: barang.id,
            code: barang.code,
            name: barang.name,

            transactionCount,

            hasStock,

            outletBarangCount,
          },
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =====================================================
     * NONAKTIFKAN
     * =====================================================
     */

    const updated =
      await prisma.$transaction(
        async (tx) => {
          const result =
            await tx.barang.update({
              where: {
                id: barangId,
              },

              data: {
                active: false,
              },
            });

          /*
           * History memakai MASTER_CREATE
           * karena enum saat ini tidak punya
           * MASTER_UPDATE / MASTER_DEACTIVATE.
           */

          await tx.history.create({
            data: {
              transactionType:
                "MASTER_CREATE",

              referenceNumber:
                result.code,

              description:
                `Nonaktif barang duplikat ${result.name} (${result.code})`,
            },
          });

          return result;
        }
      );

    return NextResponse.json({
      success: true,

      message:
        "Barang duplikat berhasil dinonaktifkan",

      data: updated,
    });
  } catch (error: any) {
    console.error(
      "DEACTIVATE DUPLICATE BARANG ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menonaktifkan barang duplikat",
      },
      {
        status: 500,
      }
    );
  }
}