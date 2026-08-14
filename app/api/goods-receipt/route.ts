import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PurchaseStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      purchaseId,
      items,
      remarks,
    } = body;

    // =====================================================
    // VALIDASI REQUEST
    // =====================================================

    if (
      !purchaseId ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Data penerimaan tidak lengkap",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // AMBIL PURCHASE
    // =====================================================

    const purchase =
      await prisma.purchase.findUnique({
        where: {
          id: Number(purchaseId),
        },
        include: {
          items: true,
        },
      });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =====================================================
    // PURCHASE HARUS APPROVED
    // =====================================================

    if (
      purchase.status !==
      PurchaseStatus.APPROVED
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase harus APPROVED",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // VALIDASI SEMUA ITEM
    // =====================================================

    for (const item of items) {
      const barangId = Number(item.barangId);
      const qty = Number(item.qty);

      const poItem =
        purchase.items.find(
          (p) => p.barangId === barangId
        );

      if (!poItem) {
        throw new Error(
          "Barang tidak ada dalam PO"
        );
      }

      const sisa =
        poItem.qty - poItem.receivedQty;

      if (qty > sisa) {
        throw new Error(
          `Qty barang melebihi sisa PO`
        );
      }

      if (qty <= 0) {
        throw new Error(
          "Qty harus lebih dari 0"
        );
      }

      // ===================================================
      // CEK BARANG
      // ===================================================

      const barang =
        await prisma.barang.findUnique({
          where: {
            id: barangId,
          },
        });

      if (!barang) {
        throw new Error(
          "Barang tidak ditemukan"
        );
      }

      // ===================================================
      // BARANG EXPIRED
      // ===================================================

      if (barang.hasExpired) {
        if (!item.batchNumber) {
          throw new Error(
            `Batch Number wajib diisi untuk ${barang.name}`
          );
        }

        if (!item.expiredDate) {
          throw new Error(
            `Expired Date wajib diisi untuk ${barang.name}`
          );
        }

        const expiredDate =
          new Date(item.expiredDate);

        if (
          isNaN(
            expiredDate.getTime()
          )
        ) {
          throw new Error(
            `Expired Date tidak valid untuk ${barang.name}`
          );
        }
      }
    }

    // =====================================================
    // TRANSACTION
    // =====================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // =================================================
          // NOMOR RECEIPT
          // =================================================

          const receiptNumber =
            "GR-" + Date.now();

          // =================================================
          // CREATE RECEIPT
          // =================================================

          const receipt =
            await tx.receipt.create({
              data: {
                number:
                  receiptNumber,

                purchaseId:
                  purchase.id,

                supplierId:
                  purchase.supplierId,

                remarks,
              },
            });

          // =================================================
          // RECEIPT ITEM
          // =================================================

          await tx.receiptItem.createMany({
            data: items.map(
              (item: any) => ({
                receiptId:
                  receipt.id,

                barangId:
                  Number(item.barangId),

                qty:
                  Number(item.qty),

                price:
                  Number(item.price),

                subtotal:
                  Number(item.qty) *
                  Number(item.price),
              })
            ),
          });

          // =================================================
          // PROCESS ITEM
          // =================================================

          for (const item of items) {
            const barangId =
              Number(item.barangId);

            const qty =
              Number(item.qty);

            const price =
              Number(item.price);

            const poItem =
              purchase.items.find(
                (p) =>
                  p.barangId ===
                  barangId
              );

            if (!poItem) {
              throw new Error(
                "Purchase Item tidak ditemukan"
              );
            }

            // ===============================================
            // BARANG
            // ===============================================

            const barang =
              await tx.barang.findUnique({
                where: {
                  id: barangId,
                },
              });

            if (!barang) {
              throw new Error(
                "Barang tidak ditemukan"
              );
            }

            // ===============================================
            // STOCK BARANG
            // ===============================================

            let inventory =
              await tx.inventory.findUnique({
                where: {
                  barangId,
                },
              });

            if (!inventory) {
              inventory =
                await tx.inventory.create({
                  data: {
                    barangId,

                    warehouse:
                      "MAIN",

                    stock: 0,

                    availableStock: 0,

                    minimumStock:
                      barang.minimumStock ??
                      0,

                    maximumStock: 0,

                    lastPurchase: 0,

                    averageCost: 0,
                  },
                });
            }

            const oldStock =
              inventory.stock;

            const newStock =
              oldStock + qty;

            // ===============================================
            // AVERAGE COST
            // ===============================================

            const averageCost =
              oldStock === 0
                ? price
                : (
                    oldStock *
                      inventory.averageCost +
                    qty * price
                  ) /
                  newStock;

            // ===============================================
            // UPDATE INVENTORY
            // ===============================================

            await tx.inventory.update({
              where: {
                barangId,
              },

              data: {
                stock:
                  newStock,

                availableStock:
                  newStock,

                lastPurchase:
                  price,

                averageCost,
              },
            });

            // ===============================================
            // UPDATE BARANG
            // ===============================================

            await tx.barang.update({
              where: {
                id: barangId,
              },

              data: {
                stock:
                  newStock,

                purchasePrice:
                  price,
              },
            });

            // ===============================================
            // BATCH STOCK
            // ===============================================

            if (barang.hasExpired) {
              const batchNumber =
                String(
                  item.batchNumber
                ).trim();

              const expiredDate =
                new Date(
                  item.expiredDate
                );

              // ---------------------------------------------
              // CEK BATCH SUDAH ADA
              // ---------------------------------------------

              const existingBatch =
                await tx.batchStock.findFirst({
                  where: {
                    barangId,

                    batchNumber,
                  },
                });

              if (existingBatch) {
                // -------------------------------------------
                // BATCH SUDAH ADA
                // TAMBAHKAN QTY
                // -------------------------------------------

                await tx.batchStock.update({
                  where: {
                    id:
                      existingBatch.id,
                  },

                  data: {
                    qty: {
                      increment: qty,
                    },

                    /*
                     * Expired date tetap mengikuti
                     * batch yang sudah ada.
                     */
                  },
                });
              } else {
                // -------------------------------------------
                // BATCH BARU
                // -------------------------------------------

                await tx.batchStock.create({
                  data: {
                    barangId,

                    batchNumber,

                    expiredDate,

                    qty,
                  },
                });
              }
            }

            // ===============================================
            // MASTER HARGA
            // ===============================================

            const hargaLama =
              barang.purchasePrice;

            const hargaBaru =
              price;

            const selisihHarga =
              hargaBaru -
              hargaLama;

            const persenNaik =
              hargaLama > 0
                ? (selisihHarga /
                    hargaLama) *
                  100
                : 0;

            const qtyHistory =
              await tx.masterHarga.aggregate({
                where: {
                  barangId,
                },

                _sum: {
                  qty: true,
                },
              });

            const akumulasi =
              (qtyHistory._sum
                .qty ?? 0) + qty;

            await tx.masterHarga.create({
              data: {
                barangId,

                supplierId:
                  purchase.supplierId,

                purchaseId:
                  purchase.id,

                purchaseItemId:
                  poItem.id,

                poNumber:
                  purchase.number,

                hargaLama,

                hargaBaru,

                selisihHarga,

                persenNaik,

                qty,

                total:
                  qty * hargaBaru,

                akumulasi,

                status:
                  "RECEIVED",

                receiveDate:
                  receipt.receiptDate,

                createdAt:
                  new Date(),
              },
            });

            // ===============================================
            // PRICE SUMMARY
            // ===============================================

            const histories =
              await tx.masterHarga.findMany({
                where: {
                  barangId,
                },

                orderBy: {
                  receiveDate:
                    "desc",
                },
              });

            const hargaTerakhir =
              histories[0]
                ?.hargaBaru ?? 0;

            const hargaTertinggi =
              histories.length > 0
                ? Math.max(
                    ...histories.map(
                      (h) =>
                        h.hargaBaru
                    )
                  )
                : 0;

            const hargaTerendah =
              histories.length > 0
                ? Math.min(
                    ...histories.map(
                      (h) =>
                        h.hargaBaru
                    )
                  )
                : 0;

            const totalQty =
              histories.reduce(
                (a, b) =>
                  a + b.qty,
                0
              );

            const totalNilai =
              histories.reduce(
                (a, b) =>
                  a + b.total,
                0
              );

            const hargaRata =
              totalQty === 0
                ? 0
                : totalNilai /
                  totalQty;

            await tx.priceSummary.upsert({
              where: {
                barangId,
              },

              update: {
                supplierId:
                  purchase.supplierId,

                lastPrice:
                  hargaTerakhir,

                highestPrice:
                  hargaTertinggi,

                lowestPrice:
                  hargaTerendah,

                averagePrice:
                  hargaRata,

                lastReceiveDate:
                  receipt.receiptDate,

                totalPurchase:
                  totalQty,
              },

              create: {
                barangId,

                supplierId:
                  purchase.supplierId,

                lastPrice:
                  hargaTerakhir,

                highestPrice:
                  hargaTertinggi,

                lowestPrice:
                  hargaTerendah,

                averagePrice:
                  hargaRata,

                lastReceiveDate:
                  receipt.receiptDate,

                totalPurchase:
                  totalQty,
              },
            });

            // ===============================================
            // STOCK CARD
            // ===============================================

            await tx.stockCard.create({
              data: {
                barangId,

                trxDate:
                  new Date(),

                trxType:
                  "RECEIVE",

                trxNumber:
                  receipt.number,

                referenceId:
                  receipt.id,

                warehouse:
                  "MAIN",

                qtyIn:
                  qty,

                qtyOut: 0,

                balance:
                  newStock,

                unitPrice:
                  price,

                totalValue:
                  qty * price,

                note:
                  "Goods Receipt",
              },
            });

            // ===============================================
            // STOCK MUTATION
            // ===============================================

            await tx.stockMutation.create({
              data: {
                barangId,

                type:
                  "MASUK",

                qty,

                stockBefore:
                  oldStock,

                stockAfter:
                  newStock,

                reference:
                  receipt.number,

                description:
                  "Receive Barang",
              },
            });

            // ===============================================
            // UPDATE RECEIVED QTY PO
            // ===============================================

            await tx.purchaseItem.updateMany({
              where: {
                purchaseId:
                  purchase.id,

                barangId,
              },

              data: {
                receivedQty: {
                  increment:
                    qty,
                },
              },
            });
          }

          // =================================================
          // UPDATE STATUS PURCHASE
          // =================================================

          await tx.purchase.update({
            where: {
              id: purchase.id,
            },

            data: {
              status:
                PurchaseStatus.RECEIVED,
            },
          });

          // =================================================
          // HISTORY
          // =================================================

          await tx.history.create({
            data: {
              transactionType:
                "RECEIPT",

              referenceNumber:
                receipt.number,

              description:
                "Goods Receipt " +
                receipt.number,
            },
          });

          return receipt;
        }
      );

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      message:
        "Barang berhasil diterima",

      receipt: result,
    });
  } catch (error) {
    console.error(
      "GOODS RECEIPT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Gagal menerima barang",
      },
      {
        status: 500,
      }
    );
  }
}