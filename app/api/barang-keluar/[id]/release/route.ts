import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DeliveryStatus,
  HistoryType,
  OutletTransferStatus,
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

    if (!Number.isInteger(deliveryId) || deliveryId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "ID delivery tidak valid",
        },
        { status: 400 }
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
          outlet: true,
          items: {
            include: {
              barang: true,
            },
          },
        },
      });

      if (!delivery) {
        throw new Error("Delivery tidak ditemukan");
      }

      // =====================================================
      // HANYA DRAFT YANG BOLEH RELEASE
      // =====================================================

      if (delivery.status !== DeliveryStatus.DRAFT) {
        throw new Error("Delivery sudah pernah di-release");
      }

      if (!delivery.outletId || !delivery.outlet) {
        throw new Error("Delivery belum memiliki outlet tujuan");
      }

      if (!delivery.items || delivery.items.length === 0) {
        throw new Error("Delivery tidak memiliki item");
      }

      const outlet = delivery.outlet;

      // =====================================================
      // CEK SEMUA BARANG TERLEBIH DAHULU
      // Supaya kalau ada 1 barang kurang, transaksi batal semua
      // =====================================================

      for (const item of delivery.items) {
        const qty = Number(item.qty);

        if (!Number.isInteger(qty) || qty <= 0) {
          throw new Error(
            `Qty ${item.barang.name} tidak valid`
          );
        }

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

        // Hanya barang CENTRAL yang boleh dikirim
        if (barang.source !== "CENTRAL") {
          throw new Error(
            `Barang ${barang.name} bukan barang pusat`
          );
        }

        if (Number(barang.stock) < qty) {
          throw new Error(
            `Stock ${barang.name} tidak cukup. ` +
              `Tersedia ${barang.stock}, diperlukan ${qty}`
          );
        }

        // ===================================================
        // CEK BATCH UNTUK BARANG EXPIRED
        // ===================================================

        if (barang.hasExpired) {
          const batches = await tx.batchStock.findMany({
            where: {
              barangId: barang.id,
              qty: {
                gt: 0,
              },
            },
          });

          const totalBatchStock = batches.reduce(
            (total, batch) =>
              total + Number(batch.qty),
            0
          );

          if (totalBatchStock < qty) {
            throw new Error(
              `Stock batch ${barang.name} tidak cukup. ` +
                `Tersedia ${totalBatchStock}, diperlukan ${qty}`
            );
          }
        }
      }

      // =====================================================
      // PROSES BARANG
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

        const qty = Number(item.qty);
        const stockBefore = Number(barang.stock);

        // ===================================================
        // FEFO
        // ===================================================

        if (barang.hasExpired) {
          const batches = await tx.batchStock.findMany({
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

          let remainingQty = qty;

          for (const batch of batches) {
            if (remainingQty <= 0) {
              break;
            }

            const batchQty = Number(batch.qty);

            const usedQty = Math.min(
              batchQty,
              remainingQty
            );

            await tx.batchStock.update({
              where: {
                id: batch.id,
              },
              data: {
                qty: batchQty - usedQty,
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
        // KURANGI STOCK BARANG PUSAT
        // ===================================================

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

        // ===================================================
        // INVENTORY GUDANG PUSAT
        // ===================================================

        const inventory =
          await tx.inventory.findUnique({
            where: {
              barangId: barang.id,
            },
          });

        if (inventory) {
          await tx.inventory.update({
            where: {
              barangId: barang.id,
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
        }

        // ===================================================
        // STOCK CARD PUSAT
        // ===================================================

        const price = Number(item.price) || 0;

        await tx.stockCard.create({
          data: {
            barangId: barang.id,
            trxType: "DELIVERY",
            trxNumber: delivery.number,
            referenceId: delivery.id,
            warehouse: "MAIN",
            qtyIn: 0,
            qtyOut: qty,
            balance: Number(updatedBarang.stock),
            unitPrice: price,
            totalValue: price * qty,
            note:
              delivery.remarks ||
              `Barang keluar ke outlet ${outlet.name}`,
          },
        });

        // ===================================================
        // STOCK MUTATION PUSAT
        // ===================================================

        await tx.stockMutation.create({
          data: {
            barangId: barang.id,
            type: "OUT",
            qty,
            stockBefore,
            stockAfter: Number(updatedBarang.stock),
            reference: delivery.number,
            description:
              `Release Delivery ke outlet ${outlet.name}`,
          },
        });
      }

      // =====================================================
      // DELIVERY → RELEASED
      // =====================================================

      const updatedDelivery =
        await tx.delivery.update({
          where: {
            id: delivery.id,
          },
          data: {
            status: DeliveryStatus.RELEASED,
          },
        });

      // =====================================================
      // SURAT JALAN
      // =====================================================

      let suratJalan =
        await tx.suratJalan.findUnique({
          where: {
            deliveryId: delivery.id,
          },
        });

      if (!suratJalan) {
        suratJalan =
          await tx.suratJalan.create({
            data: {
              number: `SJ-${delivery.number}`,
              deliveryId: delivery.id,
            },
          });
      }

      // =====================================================
      // OUTLET TRANSFER
      // =====================================================

      let outletTransfer =
        await tx.outletTransfer.findUnique({
          where: {
            number: `TRF-${delivery.number}`,
          },
        });

      if (!outletTransfer) {
        outletTransfer =
          await tx.outletTransfer.create({
            data: {
              number: `TRF-${delivery.number}`,
              outletId: outlet.id,
              transferDate: new Date(),
              status: OutletTransferStatus.SENT,
              remarks:
                delivery.remarks ||
                `Transfer barang dari gudang ke ${outlet.name}`,

              items: {
                create: delivery.items.map((item) => ({
                  barangId: item.barangId,
                  qty: Number(item.qty),
                  receivedQty: 0,
                })),
              },
            },

            include: {
              items: true,
              outlet: true,
            },
          });
      }

      // =====================================================
      // HISTORY
      // =====================================================

      await tx.history.create({
        data: {
          transactionType: HistoryType.DELIVERY,
          referenceNumber: delivery.number,
          description:
            `Release Delivery ${delivery.number} → Outlet ${outlet.name}`,
        },
      });

      return {
        delivery: updatedDelivery,
        suratJalan,
        outletTransfer,
      };
    });

    return NextResponse.json({
      success: true,
      message:
        "Delivery berhasil di-release dan dikirim ke Barang Masuk Outlet.",
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
      {
        status: 500,
      }
    );
  }
}