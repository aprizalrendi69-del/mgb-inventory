import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DeliveryStatus,
  DeliveryRequestStatus,
  HistoryType,
  OutletTransferStatus,
} from "@prisma/client";

export async function POST(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await context.params;

    const deliveryId = Number(id);

    if (!Number.isInteger(deliveryId) || deliveryId <= 0) {
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

        deliveryRequest: {
          include: {
            outlet: true,
          },
        },

        items: {
          include: {
            barang: true,
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

    if (delivery.status !== DeliveryStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          message: `Delivery ${delivery.number} sudah diproses`,
        },
        { status: 400 }
      );
    }

    if (!delivery.items.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Delivery tidak memiliki item",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // WAJIB ADA OUTLET
    // =====================================================

    if (!delivery.outletId) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Delivery ${delivery.number} belum terhubung ke outlet`,
        },
        { status: 400 }
      );
    }

    // =====================================================
    // OUTLET
    // =====================================================

    const outlet = await prisma.outlet.findUnique({
      where: {
        id: delivery.outletId,
      },
    });

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet tujuan tidak ditemukan",
        },
        { status: 400 }
      );
    }

    if (outlet.active === false) {
      return NextResponse.json(
        {
          success: false,
          message: `Outlet ${outlet.name} tidak aktif`,
        },
        { status: 400 }
      );
    }

    // =====================================================
    // DELIVERY REQUEST VALIDATION
    //
    // Jika Delivery berasal dari Delivery Request,
    // request harus berada di PROCESSING.
    //
    // RELEASE TIDAK membuat request COMPLETED.
    //
    // COMPLETED hanya setelah OutletTransfer RECEIVED.
    // =====================================================

    if (delivery.deliveryRequest) {
      if (
        delivery.deliveryRequest.outletId !==
        delivery.outletId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet Delivery tidak sesuai dengan Delivery Request",
          },
          { status: 400 }
        );
      }

      if (
        delivery.deliveryRequest.status !==
        DeliveryRequestStatus.PROCESSING
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Delivery Request ${delivery.deliveryRequest.number} ` +
              `tidak berada pada status PROCESSING`,
          },
          { status: 400 }
        );
      }
    }

    // =====================================================
    // TRANSACTION
    // =====================================================

    const result = await prisma.$transaction(
      async (tx) => {
        // =================================================
        // 1. RELOAD DELIVERY
        // =================================================

        const currentDelivery =
          await tx.delivery.findUnique({
            where: {
              id: delivery.id,
            },

            include: {
              deliveryRequest: true,

              items: {
                include: {
                  barang: true,
                },
              },
            },
          });

        if (!currentDelivery) {
          throw new Error(
            "Delivery Order tidak ditemukan"
          );
        }

        // =================================================
        // 2. RECHECK STATUS
        // =================================================

        if (
          currentDelivery.status !==
          DeliveryStatus.DRAFT
        ) {
          throw new Error(
            `Delivery ${currentDelivery.number} sudah diproses`
          );
        }

        // =================================================
        // 3. RECHECK DELIVERY REQUEST
        // =================================================

        if (currentDelivery.deliveryRequest) {
          if (
            currentDelivery.deliveryRequest.status !==
            DeliveryRequestStatus.PROCESSING
          ) {
            throw new Error(
              `Delivery Request ${currentDelivery.deliveryRequest.number} ` +
                `tidak berada pada status PROCESSING`
            );
          }

          if (
            currentDelivery.deliveryRequest.outletId !==
            currentDelivery.outletId
          ) {
            throw new Error(
              "Outlet Delivery tidak sesuai dengan Delivery Request"
            );
          }
        }

        // =================================================
        // 4. SURAT JALAN NUMBER
        // =================================================

        const sjNumber =
          "SJ-" +
          new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "") +
          "-" +
          currentDelivery.id;

        // =================================================
        // 5. CEK SURAT JALAN
        // =================================================

        const existingSuratJalan =
          await tx.suratJalan.findUnique({
            where: {
              deliveryId:
                currentDelivery.id,
            },
          });

        const finalSjNumber =
          existingSuratJalan?.number ??
          sjNumber;

        // =================================================
        // 6. STOCK MOVEMENT
        // =================================================

        for (
          const item of currentDelivery.items
        ) {
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

          const qty = Number(item.qty);

          if (
            !Number.isFinite(qty) ||
            qty <= 0
          ) {
            throw new Error(
              `Qty ${barang.name} tidak valid`
            );
          }

          // ===============================================
          // STOCK BEFORE
          // ===============================================

          const stockBefore =
            Number(barang.stock);

          if (
            !Number.isFinite(stockBefore) ||
            stockBefore < 0
          ) {
            throw new Error(
              `Stock ${barang.name} tidak valid`
            );
          }

          // ===============================================
          // STOCK SUFFICIENT
          // ===============================================

          const stockAfter =
            stockBefore - qty;

          if (stockAfter < 0) {
            throw new Error(
              `Stock ${barang.name} tidak mencukupi. ` +
                `Tersedia ${stockBefore}, ` +
                `diperlukan ${qty}`
            );
          }

          // ===============================================
          // FEFO
          // ===============================================

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
                `Stock batch ${barang.name} tidak cukup. ` +
                  `Batch tersedia ${totalBatchStock}, ` +
                  `diperlukan ${qty}`
              );
            }

            let remainingQty = qty;

            for (
              const batch of batches
            ) {
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

              await tx.batchStock.update({
                where: {
                  id: batch.id,
                },

                data: {
                  qty:
                    batchQty -
                    usedQty,
                },
              });

              remainingQty -=
                usedQty;
            }
          }

          // ===============================================
          // UPDATE BARANG STOCK
          // ===============================================

          await tx.barang.update({
            where: {
              id: barang.id,
            },

            data: {
              stock: stockAfter,
            },
          });

          // ===============================================
          // INVENTORY
          // ===============================================

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
                id: inventory.id,
              },

              data: {
                stock:
                  stockAfter,

                availableStock:
                  stockAfter,
              },
            });
          }

          // ===============================================
          // STOCK CARD
          // ===============================================

          const price =
            Number(item.price) || 0;

          await tx.stockCard.create({
            data: {
              barangId:
                barang.id,

              trxType:
                "DELIVERY",

              trxNumber:
                finalSjNumber,

              referenceId:
                currentDelivery.id,

              warehouse:
                "MAIN",

              qtyIn: 0,

              qtyOut: qty,

              balance:
                stockAfter,

              unitPrice:
                price,

              totalValue:
                price * qty,

              note:
                `Surat Jalan ${finalSjNumber}`,
            },
          });

          // ===============================================
          // STOCK MUTATION
          // ===============================================

          await tx.stockMutation.create({
            data: {
              barangId:
                barang.id,

              type: "OUT",

              qty,

              stockBefore,

              stockAfter,

              reference:
                currentDelivery.number,

              description:
                `Release Delivery ${currentDelivery.number}`,
            },
          });
        }

        // =================================================
        // 7. RELEASE DELIVERY
        // =================================================

        const releasedDelivery =
          await tx.delivery.update({
            where: {
              id: currentDelivery.id,
            },

            data: {
              status:
                DeliveryStatus.RELEASED,
            },
          });

        // =================================================
        // 8. SURAT JALAN
        // =================================================

        const suratJalan =
          existingSuratJalan ??
          await tx.suratJalan.create({
            data: {
              number:
                finalSjNumber,

              deliveryId:
                currentDelivery.id,
            },
          });

        // =================================================
        // 9. OUTLET TRANSFER
        //
        // Untuk Delivery Request:
        // satu Delivery = satu Transfer.
        //
        // Tidak menggunakan pencarian remarks.
        // =================================================

        let transfer =
          await tx.outletTransfer.findFirst({
            where: {
              remarks: {
                contains:
                  currentDelivery.number,
              },
              outletId:
                currentDelivery.outletId!,
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

        if (!transfer) {
          const transferNumber =
            "TRF-" +
            new Date()
              .toISOString()
              .slice(0, 10)
              .replace(/-/g, "") +
            "-" +
            currentDelivery.id;

          transfer =
            await tx.outletTransfer.create({
              data: {
                number:
                  transferNumber,

                outletId:
                  currentDelivery.outletId!,

                status:
                  OutletTransferStatus.SENT,

                remarks:
                  `Pengiriman dari gudang - ${currentDelivery.number}`,

                items: {
                  create:
                    currentDelivery.items.map(
                      (item) => ({
                        barangId:
                          item.barangId,

                        qty:
                          Number(item.qty),

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
        } else {
          if (
            transfer.status ===
              OutletTransferStatus.RECEIVED ||
            transfer.status ===
              OutletTransferStatus.PARTIAL
          ) {
            throw new Error(
              `Transfer ${transfer.number} sudah memiliki penerimaan`
            );
          }

          transfer =
            await tx.outletTransfer.update({
              where: {
                id: transfer.id,
              },

              data: {
                status:
                  OutletTransferStatus.SENT,
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

        // =================================================
        // 10. HISTORY
        // =================================================

        await tx.history.create({
          data: {
            transactionType:
              HistoryType.STOCK_OUT,

            referenceNumber:
              finalSjNumber,

            description:
              `Release Delivery ${currentDelivery.number} ke ${outlet.name}`,
          },
        });

        return {
          delivery:
            releasedDelivery,

          suratJalan,

          transfer,

          outlet,
        };
      }
    );

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      message:
        `Delivery ${delivery.number} berhasil direlease ` +
        `dan dikirim ke ${result.outlet.name}. ` +
        `Status transfer: SENT`,

      data: {
        deliveryId:
          result.delivery.id,

        deliveryNumber:
          result.delivery.number,

        suratJalan:
          result.suratJalan.number,

        transferId:
          result.transfer.id,

        transferNumber:
          result.transfer.number,

        transferStatus:
          result.transfer.status,

        outlet: {
          id:
            result.outlet.id,

          code:
            result.outlet.code,

          name:
            result.outlet.name,
        },
      },
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
          "Gagal Release Delivery",
      },
      {
        status: 500,
      }
    );
  }
}