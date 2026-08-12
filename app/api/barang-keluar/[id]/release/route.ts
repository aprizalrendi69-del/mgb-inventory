import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DeliveryStatus,
  HistoryType,
} from "@prisma/client";

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;

    const deliveryId = Number(id);

    if (!deliveryId) {
      return NextResponse.json(
        {
          success: false,
          message: "ID delivery tidak valid",
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        // =============================================
        // AMBIL DELIVERY
        // =============================================

        const delivery =
          await tx.delivery.findUnique({
            where: {
              id: deliveryId,
            },
            include: {
              items: {
                include: {
                  barang: true,
                },
              },
            },
          });

        if (!delivery) {
          throw new Error(
            "Delivery tidak ditemukan"
          );
        }

        // =============================================
        // HANYA DRAFT YANG BOLEH RELEASE
        // =============================================

        if (
          delivery.status !==
          DeliveryStatus.DRAFT
        ) {
          throw new Error(
            "Delivery sudah pernah di-release"
          );
        }

        if (
          !delivery.items ||
          delivery.items.length === 0
        ) {
          throw new Error(
            "Delivery tidak memiliki item"
          );
        }

        // =============================================
        // PROSES SETIAP BARANG
        // =============================================

        for (const item of delivery.items) {
          const barang =
            await tx.barang.findUnique({
              where: {
                id: item.barangId,
              },
            });

          if (!barang) {
            throw new Error(
              `Barang ID ${item.barangId} tidak ditemukan`
            );
          }

          const qty =
            Number(item.qty);

          if (!qty || qty <= 0) {
            throw new Error(
              `Qty ${barang.name} tidak valid`
            );
          }

          // ==========================================
          // CEK STOCK TERBARU
          // ==========================================

          const currentStock =
            Number(barang.stock);

          if (
            currentStock < qty
          ) {
            throw new Error(
              `Stock ${barang.name} tidak cukup. Tersedia ${currentStock}, diperlukan ${qty}`
            );
          }

          const stockBefore =
            currentStock;

          const stockAfter =
            currentStock - qty;

          // ==========================================
          // FEFO
          // ==========================================

          if (barang.hasExpired) {
            const batches =
              await tx.batchStock.findMany({
                where: {
                  barangId:
                    barang.id,
                  qty: {
                    gt: 0,
                  },
                },
                orderBy: [
                  {
                    expiredDate:
                      "asc",
                  },
                  {
                    id: "asc",
                  },
                ],
              });

            const totalBatchStock =
              batches.reduce(
                (total, batch) =>
                  total +
                  Number(batch.qty),
                0
              );

            if (
              totalBatchStock < qty
            ) {
              throw new Error(
                `Stock batch ${barang.name} tidak cukup`
              );
            }

            let remainingQty =
              qty;

            for (const batch of batches) {
              if (
                remainingQty <= 0
              ) {
                break;
              }

              const batchQty =
                Number(batch.qty);

              const usedQty =
                Math.min(
                  batchQty,
                  remainingQty
                );

              const newQty =
                batchQty -
                usedQty;

              await tx.batchStock.update({
                where: {
                  id: batch.id,
                },
                data: {
                  qty: newQty,
                },
              });

              remainingQty -=
                usedQty;
            }

            if (
              remainingQty > 0
            ) {
              throw new Error(
                `FEFO gagal untuk ${barang.name}`
              );
            }
          }

          // ==========================================
          // KURANGI BARANG.STOCK
          // ==========================================

          const updatedBarang =
            await tx.barang.update({
              where: {
                id: barang.id,
              },
              data: {
                stock: {
                  decrement: qty,
                },
              },
            });

          // ==========================================
          // INVENTORY
          // ==========================================

          const inventory =
            await tx.inventory.findUnique({
              where: {
                barangId:
                  barang.id,
              },
            });

          if (inventory) {
            await tx.inventory.update({
              where: {
                barangId:
                  barang.id,
              },
              data: {
                stock: {
                  decrement: qty,
                },
                availableStock: {
                  decrement: qty,
                },
              },
            });
          } else {
            await tx.inventory.create({
              data: {
                barangId:
                  barang.id,
                stock:
                  updatedBarang.stock,
                availableStock:
                  updatedBarang.stock,
                minimumStock:
                  barang.minimumStock,
              },
            });
          }

          // ==========================================
          // STOCK CARD
          //
          // PAKAI HARGA DARI DELIVERY ITEM
          // BUKAN MASTER HARGA SAAT PRINT
          // ==========================================

          const price =
            Number(item.price) || 0;

          await tx.stockCard.create({
            data: {
              barangId:
                barang.id,
              trxType: "DELIVERY",
              trxNumber:
                delivery.number,
              referenceId:
                delivery.id,
              qtyIn: 0,
              qtyOut: qty,
              balance:
                updatedBarang.stock,
              unitPrice: price,
              totalValue:
                price * qty,
              note:
                delivery.remarks ||
                "Barang keluar Delivery Order",
            },
          });

          // ==========================================
          // STOCK MUTATION
          // ==========================================

          await tx.stockMutation.create({
            data: {
              barangId:
                barang.id,
              type: "OUT",
              qty,
              stockBefore,
              stockAfter:
                updatedBarang.stock,
              reference:
                delivery.number,
              description:
                "Release Delivery Order",
            },
          });
        }

        // =============================================
        // UPDATE DELIVERY → RELEASED
        // =============================================

        const updatedDelivery =
          await tx.delivery.update({
            where: {
              id: delivery.id,
            },
            data: {
              status:
                DeliveryStatus.RELEASED,
            },
          });

        // =============================================
        // BUAT SURAT JALAN
        // =============================================

        let suratJalan =
          await tx.suratJalan.findUnique({
            where: {
              deliveryId:
                delivery.id,
            },
          });

        if (!suratJalan) {
          suratJalan =
            await tx.suratJalan.create({
              data: {
                number:
                  `SJ-${delivery.number}`,
                deliveryId:
                  delivery.id,
              },
            });
        }

        // =============================================
        // HISTORY
        // =============================================

        await tx.history.create({
          data: {
            transactionType:
              HistoryType.DELIVERY,
            referenceNumber:
              delivery.number,
            description:
              `Release Delivery Order ${delivery.number}`,
          },
        });

        return {
          delivery:
            updatedDelivery,
          suratJalan,
        };
      }
    );

    return NextResponse.json({
      success: true,
      message:
        "Delivery berhasil di-release. Stock, batch, inventory, kartu stock, dan mutasi stock telah diperbarui.",
      data: result,
    });
  } catch (error: any) {
    console.error(
      "RELEASE DELIVERY ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal release Delivery Order",
      },
      { status: 500 }
    );
  }
}