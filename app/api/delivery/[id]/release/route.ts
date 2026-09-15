import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DeliveryStatus,
  HistoryType,
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

    const delivery =
      await prisma.delivery.findUnique({
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
      return NextResponse.json(
        {
          success: false,
          message:
            "Delivery Order tidak ditemukan",
        },
        { status: 404 }
      );
    }

    if (
      delivery.status !==
      DeliveryStatus.DRAFT
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Delivery ${delivery.number} sudah diproses`,
        },
        { status: 400 }
      );
    }

    if (!delivery.items.length) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Delivery tidak memiliki item",
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
    // AMBIL OUTLET DARI outletId
    // =====================================================

    const outlet =
      await prisma.outlet.findUnique({
        where: {
          id: delivery.outletId,
        },
      });

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tujuan tidak ditemukan",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // TRANSACTION
    // =====================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // ===============================================
          // 1. RELEASE DELIVERY
          // ===============================================

          const releasedDelivery =
            await tx.delivery.update({
              where: {
                id: delivery.id,
              },

              data: {
                status:
                  DeliveryStatus.RELEASED,
              },
            });

          // ===============================================
          // 2. SURAT JALAN
          // ===============================================

          const sjNumber =
            "SJ-" +
            new Date()
              .toISOString()
              .slice(0, 10)
              .replace(/-/g, "") +
            "-" +
            delivery.id;

          const suratJalan =
            await tx.suratJalan.create({
              data: {
                number: sjNumber,
                deliveryId:
                  delivery.id,
              },
            });

          // ===============================================
          // 3. KURANGI STOCK GUDANG
          // ===============================================

          for (
            const item of delivery.items
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

            const qty =
              Number(item.qty);

            if (
              !Number.isFinite(qty) ||
              qty <= 0
            ) {
              throw new Error(
                `Qty ${barang.name} tidak valid`
              );
            }

            const stockBefore =
              Number(barang.stock);

            const stockAfter =
              stockBefore - qty;

            if (stockAfter < 0) {
              throw new Error(
                `Stock ${barang.name} tidak mencukupi. ` +
                  `Tersedia ${stockBefore}, ` +
                  `diperlukan ${qty}`
              );
            }

            // =============================================
            // FEFO
            // =============================================

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
                qty
              ) {
                throw new Error(
                  `Stock batch ${barang.name} tidak cukup. ` +
                    `Batch tersedia ${totalBatchStock}, ` +
                    `diperlukan ${qty}`
                );
              }

              let remainingQty =
                qty;

              for (
                const batch of batches
              ) {
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

                await tx.batchStock.update(
                  {
                    where: {
                      id: batch.id,
                    },

                    data: {
                      qty:
                        batchQty -
                        usedQty,
                    },
                  }
                );

                remainingQty -=
                  usedQty;
              }
            }

            // =============================================
            // BARANG STOCK
            // =============================================

            await tx.barang.update({
              where: {
                id: barang.id,
              },

              data: {
                stock: stockAfter,
              },
            });

            // =============================================
            // INVENTORY
            // =============================================

            const inventory =
              await tx.inventory.findUnique(
                {
                  where: {
                    barangId:
                      barang.id,
                  },
                }
              );

            if (inventory) {
              await tx.inventory.update(
                {
                  where: {
                    id: inventory.id,
                  },

                  data: {
                    stock:
                      stockAfter,

                    availableStock:
                      stockAfter,
                  },
                }
              );
            }

            // =============================================
            // STOCK CARD
            // =============================================

            const price =
              Number(
                item.price
              ) || 0;

            await tx.stockCard.create({
              data: {
                barangId:
                  barang.id,

                trxType:
                  "DELIVERY",

                trxNumber:
                  sjNumber,

                referenceId:
                  delivery.id,

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
                  `Surat Jalan ${sjNumber}`,
              },
            });

            // =============================================
            // STOCK MUTATION
            // =============================================

            await tx.stockMutation.create({
              data: {
                barangId:
                  barang.id,

                type: "OUT",

                qty,

                stockBefore,

                stockAfter,

                reference:
                  delivery.number,

                description:
                  `Release Delivery ${delivery.number}`,
              },
            });
          }

          // ===============================================
          // 4. CARI TRANSFER OUTLET
          // ===============================================

          const existingTransfer =
            await tx.outletTransfer.findFirst(
              {
                where: {
                  outletId:
                    outlet.id,

                  remarks: {
                    contains:
                      delivery.number,
                  },
                },

                include: {
                  items: {
                    include: {
                      barang: true,
                    },
                  },
                },
              }
            );

          let transfer;

          // ===============================================
          // 5. BUAT TRANSFER
          // ===============================================

          if (!existingTransfer) {
            const transferNumber =
              "TRF-" +
              new Date()
                .toISOString()
                .slice(0, 10)
                .replace(/-/g, "") +
              "-" +
              delivery.id;

            transfer =
              await tx.outletTransfer.create(
                {
                  data: {
                    number:
                      transferNumber,

                    outletId:
                      outlet.id,

                    status:
                      "SENT",

                    remarks:
                      `Pengiriman dari gudang - ${delivery.number}`,

                    items: {
                      create:
                        delivery.items.map(
                          (
                            item
                          ) => ({
                            barangId:
                              item.barangId,

                            qty:
                              Number(
                                item.qty
                              ),

                            receivedQty:
                              0,
                          })
                        ),
                    },
                  },

                  include: {
                    outlet: true,

                    items: {
                      include: {
                        barang:
                          true,
                      },
                    },
                  },
                }
              );
          } else {
            transfer =
              await tx.outletTransfer.update(
                {
                  where: {
                    id:
                      existingTransfer.id,
                  },

                  data: {
                    status:
                      "SENT",
                  },

                  include: {
                    outlet: true,

                    items: {
                      include: {
                        barang:
                          true,
                      },
                    },
                  },
                }
              );
          }

          // ===============================================
          // 6. HISTORY
          // ===============================================

          await tx.history.create({
            data: {
              transactionType:
                HistoryType.STOCK_OUT,

              referenceNumber:
                sjNumber,

              description:
                `Release Delivery ${delivery.number} ke ${outlet.name}`,
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