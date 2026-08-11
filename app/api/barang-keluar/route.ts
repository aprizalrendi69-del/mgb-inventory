import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      customerId,
      note,
      items,
    } = body;

    if (
      !customerId ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Data tidak lengkap",
        },
        {
          status: 400,
        }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // =====================================================
      // NOMOR DELIVERY
      // =====================================================

      const count = await tx.delivery.count();

      const number =
        `DO-${String(count + 1).padStart(5, "0")}`;

      let totalQty = 0;

      // =====================================================
      // CREATE DELIVERY
      // =====================================================

      const delivery = await tx.delivery.create({
        data: {
          number,
          customerId: Number(customerId),
          status: "DELIVERED",
          remarks: note,
          totalQty: 0,
        },
      });

      // =====================================================
      // PROCESS ITEMS
      // =====================================================

      for (const item of items) {
        const barangId = Number(item.barangId);
        const keluarQty = Number(item.qty);

        if (
          !barangId ||
          !keluarQty ||
          keluarQty <= 0
        ) {
          throw new Error(
            "Data barang keluar tidak valid"
          );
        }

        // =================================================
        // BARANG
        // =================================================

        const barang = await tx.barang.findUnique({
          where: {
            id: barangId,
          },
        });

        if (!barang) {
          throw new Error(
            "Barang tidak ditemukan"
          );
        }

        // =================================================
        // CEK STOCK TOTAL
        // =================================================

        if (barang.stock < keluarQty) {
          throw new Error(
            `Stock ${barang.name} tidak cukup`
          );
        }

        const before = barang.stock;
        const after = before - keluarQty;

        // =================================================
        // FEFO
        // =================================================

        if (barang.hasExpired) {
          const batches = await tx.batchStock.findMany({
            where: {
              barangId,
              qty: {
                gt: 0,
              },
            },
            orderBy: [
              {
                expiredDate: "asc",
              },
              {
                id: "asc",
              },
            ],
          });

          if (batches.length === 0) {
            throw new Error(
              `Batch ${barang.name} tidak ditemukan`
            );
          }

          const totalBatchStock = batches.reduce(
            (total, batch) =>
              total + Number(batch.qty),
            0
          );

          if (totalBatchStock < keluarQty) {
            throw new Error(
              `Stock batch ${barang.name} tidak cukup`
            );
          }

          let remainingQty = keluarQty;

          for (const batch of batches) {
            if (remainingQty <= 0) {
              break;
            }

            const batchQty = Number(batch.qty);

            const usedQty = Math.min(
              batchQty,
              remainingQty
            );

            const newBatchQty =
              batchQty - usedQty;

            await tx.batchStock.update({
              where: {
                id: batch.id,
              },
              data: {
                qty: newBatchQty,
              },
            });

            remainingQty -= usedQty;
          }

          if (remainingQty > 0) {
            throw new Error(
              `Gagal menjalankan FEFO untuk ${barang.name}`
            );
          }
        }

        // =================================================
        // KURANGI STOCK BARANG
        // =================================================

        await tx.barang.update({
          where: {
            id: barang.id,
          },
          data: {
            stock: after,
          },
        });

        // =================================================
        // DELIVERY ITEM
        // =================================================

        await tx.deliveryItem.create({
          data: {
            deliveryId: delivery.id,
            barangId: barang.id,
            qty: keluarQty,
            price: barang.sellingPrice,
            subtotal:
              barang.sellingPrice * keluarQty,
          },
        });

        // =================================================
        // INVENTORY
        // =================================================

        await tx.inventory.upsert({
          where: {
            barangId: barang.id,
          },
          update: {
            stock: after,
            availableStock: after,
          },
          create: {
            barangId: barang.id,
            stock: after,
            availableStock: after,
            minimumStock: barang.minimumStock,
          },
        });

        // =================================================
        // STOCK CARD
        // =================================================

        await tx.stockCard.create({
          data: {
            barangId: barang.id,
            trxType: "OUT",
            trxNumber: number,
            qtyIn: 0,
            qtyOut: keluarQty,
            balance: after,
            unitPrice: barang.sellingPrice,
            totalValue:
              barang.sellingPrice * keluarQty,
            note:
              note || "Barang Keluar",
          },
        });

        // =================================================
        // STOCK MUTATION
        // =================================================

        await tx.stockMutation.create({
          data: {
            barangId: barang.id,
            type: "OUT",
            qty: keluarQty,
            stockBefore: before,
            stockAfter: after,
            reference: number,
            description: "Barang Keluar",
          },
        });

        totalQty += keluarQty;
      }

      // =====================================================
      // UPDATE TOTAL DELIVERY
      // =====================================================

      await tx.delivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          totalQty,
        },
      });

      // =====================================================
      // HISTORY
      // =====================================================

      await tx.history.create({
        data: {
          transactionType: "DELIVERY",
          referenceNumber: number,
          description:
            `Barang keluar ${number}`,
        },
      });

      return delivery;
    });

    return NextResponse.json({
      success: true,
      message: "Barang keluar berhasil",
      data: result,
    });
  } catch (error: any) {
    console.error(
      "BARANG KELUAR ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Server error",
      },
      {
        status: 500,
      }
    );
  }
}