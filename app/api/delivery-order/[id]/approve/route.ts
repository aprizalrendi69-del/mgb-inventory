import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DeliveryStatus,
  HistoryType,
} from "@prisma/client";

export async function PUT(
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
          message: "ID Delivery tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // AMBIL DELIVERY
    // =====================================================

    const delivery =
      await prisma.delivery.findUnique({
        where: {
          id: deliveryId,
        },
        include: {
          customer: true,
          items: {
            include: {
              barang: true,
            },
            orderBy: {
              id: "asc",
            },
          },
        },
      });

    if (!delivery) {
      return NextResponse.json(
        {
          success: false,
          message: "Delivery Order tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =====================================================
    // HANYA DRAFT YANG BOLEH DI-RELEASE
    // =====================================================

    if (
      delivery.status !==
      DeliveryStatus.DRAFT
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Delivery Order ${delivery.number} sudah ${delivery.status}`,
        },
        {
          status: 400,
        }
      );
    }

    if (
      !delivery.items ||
      delivery.items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Delivery Order tidak memiliki barang",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // TRANSACTION
    // =====================================================

    await prisma.$transaction(
      async (tx) => {
        for (const item of delivery.items) {
          // =================================================
          // AMBIL BARANG TERBARU
          // =================================================

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

          const qtyKeluar =
            Number(item.qty);

          if (
            !qtyKeluar ||
            qtyKeluar <= 0
          ) {
            throw new Error(
              `Qty barang ${barang.name} tidak valid`
            );
          }

          // =================================================
          // STOCK SEBELUM
          // =================================================

          const stockSebelum =
            Number(barang.stock);

          if (
            stockSebelum <
            qtyKeluar
          ) {
            throw new Error(
              `Stock ${barang.name} tidak cukup. Stock tersedia: ${stockSebelum}, kebutuhan: ${qtyKeluar}`
            );
          }

          const stockSesudah =
            stockSebelum -
            qtyKeluar;

          // =================================================
          // FEFO
          // =================================================

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

            if (
              batches.length === 0
            ) {
              throw new Error(
                `Batch ${barang.name} tidak ditemukan`
              );
            }

            const totalBatchStock =
              batches.reduce(
                (
                  total,
                  batch
                ) =>
                  total +
                  Number(
                    batch.qty
                  ),
                0
              );

            if (
              totalBatchStock <
              qtyKeluar
            ) {
              throw new Error(
                `Stock batch ${barang.name} tidak cukup. Tersedia: ${totalBatchStock}, kebutuhan: ${qtyKeluar}`
              );
            }

            let remainingQty =
              qtyKeluar;

            for (const batch of batches) {
              if (
                remainingQty <=
                0
              ) {
                break;
              }

              const batchQty =
                Number(
                  batch.qty
                );

              const usedQty =
                Math.min(
                  batchQty,
                  remainingQty
                );

              const newQty =
                batchQty -
                usedQty;

              await tx.batchStock.update(
                {
                  where: {
                    id: batch.id,
                  },
                  data: {
                    qty: newQty,
                  },
                }
              );

              remainingQty -=
                usedQty;
            }

            if (
              remainingQty > 0
            ) {
              throw new Error(
                `Gagal menjalankan FEFO untuk ${barang.name}`
              );
            }
          }

          // =================================================
          // UPDATE BARANG STOCK
          // =================================================

          const updatedBarang =
            await tx.barang.update({
              where: {
                id: barang.id,
              },
              data: {
                stock:
                  stockSesudah,
              },
            });

          // =================================================
          // UPDATE / CREATE INVENTORY
          // =================================================

          await tx.inventory.upsert({
            where: {
              barangId:
                barang.id,
            },
            update: {
              stock:
                stockSesudah,
              availableStock:
                stockSesudah,
            },
            create: {
              barangId:
                barang.id,
              stock:
                stockSesudah,
              availableStock:
                stockSesudah,
              minimumStock:
                barang.minimumStock,
            },
          });

          // =================================================
          // HARGA TRANSAKSI
          // =================================================

          const unitPrice =
            Number(
              item.price ??
                barang.sellingPrice ??
                0
            );

          const totalValue =
            unitPrice *
            qtyKeluar;

          // =================================================
          // STOCK CARD
          // =================================================

          await tx.stockCard.create({
            data: {
              barangId:
                barang.id,

              trxType:
                "DELIVERY",

              trxNumber:
                delivery.number,

              referenceId:
                delivery.id,

              qtyIn: 0,

              qtyOut:
                qtyKeluar,

              balance:
                updatedBarang.stock,

              unitPrice,

              totalValue,

              note:
                delivery.remarks ??
                "Barang keluar Delivery Order",
            },
          });

          // =================================================
          // STOCK MUTATION
          // =================================================

          await tx.stockMutation.create({
            data: {
              barangId:
                barang.id,

              type:
                "OUT",

              qty:
                qtyKeluar,

              stockBefore:
                stockSebelum,

              stockAfter:
                stockSesudah,

              reference:
                delivery.number,

              description:
                "Release Delivery Order",
            },
          });
        }

        // ===================================================
        // UPDATE DELIVERY
        // ===================================================

        await tx.delivery.update({
          where: {
            id: delivery.id,
          },
          data: {
            status:
              DeliveryStatus.RELEASED,
          },
        });

        // ===================================================
        // SURAT JALAN
        // ===================================================

        const suratJalan =
          await tx.suratJalan.findUnique({
            where: {
              deliveryId:
                delivery.id,
            },
          });

        if (!suratJalan) {
          await tx.suratJalan.create({
            data: {
              number:
                `SJ-${delivery.number}`,
              deliveryId:
                delivery.id,
            },
          });
        }

        // ===================================================
        // HISTORY
        // ===================================================

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
      }
    );

    // =====================================================
    // SUCCESS
    // =====================================================

    return NextResponse.json({
      success: true,
      message:
        `Delivery Order ${delivery.number} berhasil di-Release. Stock, FEFO, inventory, stock card, dan stock mutation telah diperbarui.`,
    });
  } catch (error: any) {
    console.error(
      "APPROVE DELIVERY ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ??
          "Gagal melakukan release Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}