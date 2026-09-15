import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deliveryId = Number(id);

    if (!deliveryId || Number.isNaN(deliveryId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID delivery tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // =====================================================
      // AMBIL DELIVERY
      // =====================================================

      const delivery = await tx.delivery.findUnique({
        where: {
          id: deliveryId,
        },
        include: {
          customer: true,
          items: {
            include: {
              barang: true,
            },
          },
        },
      });

      if (!delivery) {
        throw new Error("Delivery Order tidak ditemukan");
      }

      // =====================================================
      // HANYA DRAFT YANG BOLEH DIPROSES
      // =====================================================

      if (delivery.status !== "DRAFT") {
        throw new Error(
          `Delivery Order ${delivery.number} bukan DRAFT. Status saat ini: ${delivery.status}`
        );
      }

      if (
        !delivery.items ||
        delivery.items.length === 0
      ) {
        throw new Error(
          "Delivery Order tidak memiliki barang"
        );
      }

      // =====================================================
      // PROSES SETIAP BARANG
      // =====================================================

      for (const item of delivery.items) {
        const barang = await tx.barang.findUnique({
          where: {
            id: item.barangId,
          },
        });

        if (!barang) {
          throw new Error(
            `Barang ID ${item.barangId} tidak ditemukan`
          );
        }

        const keluarQty = Number(item.qty);

        if (!keluarQty || keluarQty <= 0) {
          throw new Error(
            `Qty barang ${barang.name} tidak valid`
          );
        }

        // ===================================================
        // CEK STOCK UTAMA
        // ===================================================

        const currentStock = Number(barang.stock);

        if (currentStock < keluarQty) {
          throw new Error(
            `Stock ${barang.name} tidak cukup. ` +
            `Stock tersedia: ${currentStock}, ` +
            `permintaan: ${keluarQty}`
          );
        }

        const before = currentStock;
        const after = before - keluarQty;

        // ===================================================
        // FEFO
        // ===================================================

        if (barang.hasExpired) {
          const batches =
            await tx.batchStock.findMany({
              where: {
                barangId: barang.id,
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
              `Batch untuk ${barang.name} tidak ditemukan`
            );
          }

          const totalBatchStock =
            batches.reduce(
              (total, batch) =>
                total + Number(batch.qty),
              0
            );

          if (totalBatchStock < keluarQty) {
            throw new Error(
              `Stock batch ${barang.name} tidak cukup. ` +
              `Tersedia: ${totalBatchStock}, ` +
              `permintaan: ${keluarQty}`
            );
          }

          let remainingQty = keluarQty;

          // =================================================
          // KURANGI DARI BATCH TERDEKAT EXPIRED
          // =================================================

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
              `FEFO gagal untuk ${barang.name}`
            );
          }
        }

        // ===================================================
        // UPDATE STOCK BARANG
        // ===================================================

        await tx.barang.update({
          where: {
            id: barang.id,
          },
          data: {
            stock: after,
          },
        });

        // ===================================================
        // UPDATE INVENTORY
        // ===================================================

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

        // ===================================================
        // STOCK CARD
        // ===================================================

        await tx.stockCard.create({
          data: {
            barangId: barang.id,
            trxType: "OUT",
            trxNumber: delivery.number,
            qtyIn: 0,
            qtyOut: keluarQty,
            balance: after,
            unitPrice: Number(
              item.price ?? barang.sellingPrice ?? 0
            ),
            totalValue:
              Number(
                item.price ?? barang.sellingPrice ?? 0
              ) * keluarQty,
            note:
              delivery.remarks ||
              "Barang Keluar",
          },
        });

        // ===================================================
        // STOCK MUTATION
        // ===================================================

        await tx.stockMutation.create({
          data: {
            barangId: barang.id,
            type: "OUT",
            qty: keluarQty,
            stockBefore: before,
            stockAfter: after,
            reference: delivery.number,
            description:
              "Barang Keluar - " +
              delivery.number,
          },
        });
      }

      // =====================================================
      // UPDATE DELIVERY MENJADI DELIVERED
      // =====================================================

      const updatedDelivery =
        await tx.delivery.update({
          where: {
            id: delivery.id,
          },
          data: {
            status: "DELIVERED",
          },
          include: {
            customer: true,
            items: {
              include: {
                barang: true,
              },
            },
          },
        });

      // =====================================================
      // HISTORY
      // =====================================================

      await tx.history.create({
        data: {
          transactionType: "DELIVERY",
          referenceNumber: delivery.number,
          description:
            `Barang keluar ${delivery.number}`,
        },
      });

      return updatedDelivery;
    });

    return NextResponse.json({
      success: true,
      message:
        "Delivery Order berhasil menjadi DELIVERED dan stock telah diproses",
      data: result,
    });
  } catch (error: any) {
    console.error(
      "DELIVERY DELIVERED ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal memproses Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}