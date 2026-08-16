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
        { status: 400 }
      );
    }

    // =====================================================
    // AMBIL DELIVERY
    // =====================================================

    const delivery = await prisma.delivery.findUnique({
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
        { status: 404 }
      );
    }

    // =====================================================
    // HANYA DRAFT
    // =====================================================

    if (delivery.status !== DeliveryStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Delivery Order ${delivery.number} sudah ${delivery.status}`,
        },
        { status: 400 }
      );
    }

    if (!delivery.items || delivery.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Delivery Order tidak memiliki barang",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // OUTLET
    // =====================================================
    // PENTING:
    // Delivery.outletId adalah sumber outlet.
    // JANGAN gunakan customerId sebagai outletId.
    // =====================================================

    let outlet = null;

    if (delivery.outletId) {
      outlet = await prisma.outlet.findUnique({
        where: {
          id: delivery.outletId,
        },
      });
    }

    // Kalau Delivery memang untuk outlet tetapi outletId kosong,
    // jangan release.
    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Delivery ${delivery.number} belum terhubung ke outlet. ` +
            `Pastikan outletId pada Delivery sudah terisi.`,
        },
        { status: 400 }
      );
    }

    // =====================================================
    // TRANSACTION
    // =====================================================

    const result = await prisma.$transaction(async (tx) => {
      // ===================================================
      // 1. PROSES STOCK SETIAP ITEM
      // ===================================================

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

        const qtyKeluar = Number(item.qty);

        if (!qtyKeluar || qtyKeluar <= 0) {
          throw new Error(
            `Qty barang ${barang.name} tidak valid`
          );
        }

        // ===============================================
        // STOCK SEBELUM
        // ===============================================

        const stockSebelum = Number(barang.stock);

        if (stockSebelum < qtyKeluar) {
          throw new Error(
            `Stock ${barang.name} tidak cukup. ` +
            `Stock tersedia: ${stockSebelum}, ` +
            `kebutuhan: ${qtyKeluar}`
          );
        }

        const stockSesudah =
          stockSebelum - qtyKeluar;

        // ===============================================
        // FEFO
        // ===============================================

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

          if (totalBatchStock < qtyKeluar) {
            throw new Error(
              `Stock batch ${barang.name} tidak cukup. ` +
              `Tersedia ${totalBatchStock}, ` +
              `kebutuhan ${qtyKeluar}`
            );
          }

          let remainingQty = qtyKeluar;

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
              `Gagal menjalankan FEFO untuk ${barang.name}`
            );
          }
        }

        // ===============================================
        // UPDATE BARANG STOCK
        // ===============================================

        const updatedBarang =
          await tx.barang.update({
            where: {
              id: barang.id,
            },
            data: {
              stock: stockSesudah,
            },
          });

        // ===============================================
        // INVENTORY
        // ===============================================

        await tx.inventory.upsert({
          where: {
            barangId: barang.id,
          },
          update: {
            stock: stockSesudah,
            availableStock: stockSesudah,
          },
          create: {
            barangId: barang.id,
            stock: stockSesudah,
            availableStock: stockSesudah,
            minimumStock: barang.minimumStock,
          },
        });

        // ===============================================
        // HARGA
        // ===============================================

        const unitPrice =
          Number(item.price) ||
          Number(barang.sellingPrice) ||
          0;

        const totalValue =
          unitPrice * qtyKeluar;

        // ===============================================
        // STOCK CARD
        // ===============================================

        await tx.stockCard.create({
          data: {
            barangId: barang.id,
            trxType: "DELIVERY",
            trxNumber: delivery.number,
            referenceId: delivery.id,
            warehouse: "MAIN",
            qtyIn: 0,
            qtyOut: qtyKeluar,
            balance: updatedBarang.stock,
            unitPrice,
            totalValue,
            note:
              delivery.remarks ||
              "Barang keluar Delivery Order",
          },
        });

        // ===============================================
        // STOCK MUTATION
        // ===============================================

        await tx.stockMutation.create({
          data: {
            barangId: barang.id,
            type: "OUT",
            qty: qtyKeluar,
            stockBefore: stockSebelum,
            stockAfter: stockSesudah,
            reference: delivery.number,
            description:
              "Release Delivery Order",
          },
        });
      }

      // ===================================================
      // 2. RELEASE DELIVERY
      // ===================================================

      const releasedDelivery =
        await tx.delivery.update({
          where: {
            id: delivery.id,
          },
          data: {
            status: DeliveryStatus.RELEASED,
          },
        });

      // ===================================================
      // 3. SURAT JALAN
      // ===================================================

      let suratJalan =
        await tx.suratJalan.findUnique({
          where: {
            deliveryId: delivery.id,
          },
        });

      if (!suratJalan) {
        const sjNumber =
          `SJ-${delivery.number}`;

        suratJalan =
          await tx.suratJalan.create({
            data: {
              number: sjNumber,
              deliveryId: delivery.id,
            },
          });
      }

      // ===================================================
      // 4. OUTLET TRANSFER
      // ===================================================

      let outletTransfer =
        await tx.outletTransfer.findFirst({
          where: {
            outletId: outlet.id,
            remarks: {
              contains: delivery.number,
            },
          },
          include: {
            outlet: true,
            items: {
              include: {
                barang: true,
              },
            },
          },
        });

      if (!outletTransfer) {
        const transferNumber =
          `TRF-${new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "")}-${delivery.id}`;

        outletTransfer =
          await tx.outletTransfer.create({
            data: {
              number: transferNumber,
              outletId: outlet.id,
              status: "SENT",
              remarks:
                `Pengiriman dari gudang - ${delivery.number}`,

              items: {
                create: delivery.items.map(
                  (item) => ({
                    barangId: item.barangId,
                    qty: Number(item.qty),
                    receivedQty: 0,
                  })
                ),
              },
            },

            include: {
              outlet: true,
              items: {
                include: {
                  barang: true,
                },
              },
            },
          });
      }

      // ===================================================
      // 5. HISTORY
      // ===================================================

      await tx.history.create({
        data: {
          transactionType:
            HistoryType.DELIVERY,

          referenceNumber:
            delivery.number,

          description:
            `Release Delivery Order ${delivery.number} ` +
            `dan kirim ke outlet ${outlet.name}`,
        },
      });

      return {
        delivery: releasedDelivery,
        suratJalan,
        outletTransfer,
        outlet,
      };
    });

    // =====================================================
    // SUCCESS
    // =====================================================

    return NextResponse.json({
      success: true,

      message:
        `Delivery Order ${delivery.number} berhasil di-Release ` +
        `dan dikirim ke ${result.outlet.name}`,

      data: {
        deliveryId:
          result.delivery.id,

        deliveryNumber:
          result.delivery.number,

        suratJalan:
          result.suratJalan,

        outletTransfer:
          result.outletTransfer,
      },
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
          error?.message ||
          "Gagal melakukan release Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}