import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PurchaseStatus } from "@prisma/client";

// =====================================================
// HELPERS
// =====================================================

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundQty(value: number) {
  return Math.round((value + Number.EPSILON) * 1000000) / 1000000;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isValidPositiveNumber(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0;
}

function generateReceiptNumber() {
  const random = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();

  return `GR-${Date.now()}-${random}`;
}

// =====================================================
// POST GOODS RECEIPT
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const purchaseId = Number(body.purchaseId);
    const items = Array.isArray(body.items) ? body.items : [];

    const remarks =
      typeof body.remarks === "string"
        ? body.remarks.trim() || null
        : null;

    // ===================================================
    // INVOICE SUPPLIER
    //
    // Diinput manual pada saat Goods Receipt Pusat.
    //
    // TEMPO:
    // - WAJIB
    //
    // CASH / TRANSFER / COD / CBD:
    // - OPSIONAL
    //
    // Invoice supplier disimpan pada:
    //
    // 1. Receipt.invoiceNumber
    // 2. PurchasePayable.invoiceNumber untuk TEMPO
    //
    // Keduanya menggunakan nomor invoice supplier yang sama.
    // ===================================================

    const invoiceNumber =
      typeof body.invoiceNumber === "string"
        ? body.invoiceNumber.trim()
        : "";

    // ===================================================
    // VALIDASI REQUEST
    // ===================================================

    if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase ID tidak valid.",
        },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Data penerimaan barang tidak boleh kosong.",
        },
        { status: 400 }
      );
    }

    if (invoiceNumber.length > 100) {
      return NextResponse.json(
        {
          success: false,
          message: "Nomor Invoice Supplier maksimal 100 karakter.",
        },
        { status: 400 }
      );
    }

    // ===================================================
    // TRANSACTION
    // ===================================================

    const result = await prisma.$transaction(async (tx) => {
      // =================================================
      // LOAD PURCHASE DI DALAM TRANSACTION
      // =================================================

      const purchase = await tx.purchase.findUnique({
        where: {
          id: purchaseId,
        },

        include: {
          supplier: true,

          items: {
            include: {
              barang: true,
            },
          },

          receipts: {
            select: {
              id: true,
              number: true,
            },
          },

          payable: true,
        },
      });

      if (!purchase) {
        throw new Error("Purchase tidak ditemukan.");
      }

      // =================================================
      // STATUS HARUS APPROVED
      // =================================================

      if (purchase.status !== PurchaseStatus.APPROVED) {
        throw new Error(
          "Purchase harus berstatus APPROVED untuk diterima."
        );
      }

      // =================================================
      // TIDAK BOLEH RECEIPT KEDUA
      //
      // FINAL RULE:
      // TIDAK ADA PARTIAL RECEIPT.
      // =================================================

      if (purchase.receipts.length > 0) {
        throw new Error(
          "Purchase Order ini sudah memiliki Goods Receipt."
        );
      }

      // =================================================
      // PO HARUS MEMILIKI ITEM
      // =================================================

      if (purchase.items.length === 0) {
        throw new Error("Purchase Order tidak memiliki item.");
      }

      // =================================================
      // NORMALISASI PAYMENT METHOD
      // =================================================

      const paymentMethod = String(
        purchase.paymentMethod ?? ""
      )
        .trim()
        .toUpperCase();

      // =================================================
      // TEMPO
      //
      // Invoice Supplier WAJIB.
      // =================================================

      if (paymentMethod === "TEMPO" && !invoiceNumber) {
        throw new Error(
          "Nomor Invoice Supplier wajib diisi untuk pembayaran TEMPO."
        );
      }

      // =================================================
      // NORMALISASI INPUT
      // =================================================

      type NormalizedItem = {
        barangId: number;
        qty: number;
        price: number;
        batchNumber: string | null;
        expiredDate: string | null;
      };

      const normalizedItems: NormalizedItem[] = items.map(
        (item: any) => {
          const barangId = Number(item.barangId);

          const qty = roundQty(Number(item.qty));

          const price = roundMoney(Number(item.price ?? 0));

          const batchNumber =
            item.batchNumber !== null &&
            item.batchNumber !== undefined
              ? String(item.batchNumber).trim() || null
              : null;

          const expiredDate =
            item.expiredDate !== null &&
            item.expiredDate !== undefined
              ? String(item.expiredDate).trim() || null
              : null;

          return {
            barangId,
            qty,
            price,
            batchNumber,
            expiredDate,
          };
        }
      );

      // =================================================
      // VALIDASI ITEM INPUT
      // =================================================

      for (const item of normalizedItems) {
        if (
          !Number.isInteger(item.barangId) ||
          item.barangId <= 0
        ) {
          throw new Error("Barang ID tidak valid.");
        }

        if (!isValidPositiveNumber(item.qty)) {
          throw new Error("Qty penerimaan harus lebih dari 0.");
        }

        if (!Number.isFinite(item.price) || item.price < 0) {
          throw new Error("Harga barang tidak valid.");
        }

        const poItem = purchase.items.find(
          (row) => row.barangId === item.barangId
        );

        if (!poItem) {
          throw new Error(
            `Barang ID ${item.barangId} tidak terdapat dalam Purchase Order.`
          );
        }
      }

      // =================================================
      // AGGREGATE QTY PER BARANG
      //
      // Satu barang boleh mempunyai beberapa batch.
      // Total seluruh batch harus = Qty PO.
      // =================================================

      const inputQtyByBarang = new Map<number, number>();

      for (const item of normalizedItems) {
        const current =
          inputQtyByBarang.get(item.barangId) ?? 0;

        inputQtyByBarang.set(
          item.barangId,
          roundQty(current + item.qty)
        );
      }

      // =================================================
      // BARANG UNIK DI PO
      // =================================================

      const poBarangIds = [
        ...new Set(
          purchase.items.map((item) => item.barangId)
        ),
      ];

      // =================================================
      // VALIDASI TIDAK BOLEH PARTIAL
      // =================================================

      for (const barangId of poBarangIds) {
        const poItemsForBarang = purchase.items.filter(
          (item) => item.barangId === barangId
        );

        const poQty = poItemsForBarang.reduce(
          (total, item) => total + Number(item.qty),
          0
        );

        const receivedBefore = poItemsForBarang.reduce(
          (total, item) =>
            total + Number(item.receivedQty ?? 0),
          0
        );

        const remainingQty = roundQty(
          poQty - receivedBefore
        );

        const inputQty = roundQty(
          inputQtyByBarang.get(barangId) ?? 0
        );

        if (
          Math.abs(inputQty - remainingQty) >
          0.000001
        ) {
          const barang =
            poItemsForBarang[0]?.barang;

          throw new Error(
            `Penerimaan ${
              barang?.name ?? `Barang ID ${barangId}`
            } harus lengkap. ` +
              `Sisa PO: ${remainingQty}, ` +
              `Qty diterima: ${inputQty}. ` +
              `Partial receipt tidak diperbolehkan.`
          );
        }
      }

      // =================================================
      // PASTIKAN TIDAK ADA BARANG EXTRA
      // =================================================

      for (const [
        barangId,
        inputQty,
      ] of inputQtyByBarang.entries()) {
        if (!poBarangIds.includes(barangId)) {
          throw new Error(
            `Barang ID ${barangId} tidak terdapat dalam PO.`
          );
        }

        if (inputQty <= 0) {
          throw new Error(
            `Qty barang ID ${barangId} tidak valid.`
          );
        }
      }

      // =================================================
      // VALIDASI BARANG + BATCH
      // =================================================

      const barangMap =
        new Map<
          number,
          typeof purchase.items[number]["barang"]
        >();

      for (const poItem of purchase.items) {
        barangMap.set(
          poItem.barangId,
          poItem.barang
        );
      }

      for (const item of normalizedItems) {
        const barang =
          barangMap.get(item.barangId);

        if (!barang) {
          throw new Error(
            `Barang ID ${item.barangId} tidak ditemukan.`
          );
        }

        // ===============================================
        // BARANG EXPIRED
        // ===============================================

        if (barang.hasExpired) {
          if (!item.batchNumber) {
            throw new Error(
              `Batch Number wajib diisi untuk ${barang.name}.`
            );
          }

          if (!item.expiredDate) {
            throw new Error(
              `Expired Date wajib diisi untuk batch ${item.batchNumber}.`
            );
          }

          const expiredDate =
            new Date(item.expiredDate);

          if (Number.isNaN(expiredDate.getTime())) {
            throw new Error(
              `Expired Date tidak valid untuk ${barang.name}.`
            );
          }

          // =============================================
          // BATCH DUPLIKAT DALAM RECEIPT
          // =============================================

          const duplicateBatch =
            normalizedItems.some(
              (other) =>
                other !== item &&
                other.barangId === item.barangId &&
                other.batchNumber
                  ?.trim()
                  .toLowerCase() ===
                  item.batchNumber
                    ?.trim()
                    .toLowerCase()
            );

          if (duplicateBatch) {
            throw new Error(
              `Batch "${item.batchNumber}" digunakan lebih dari satu kali untuk ${barang.name}.`
            );
          }
        } else {
          // =============================================
          // NON-EXPIRED TIDAK BOLEH BATCH
          // =============================================

          if (
            item.batchNumber ||
            item.expiredDate
          ) {
            throw new Error(
              `Barang ${barang.name} tidak menggunakan Batch / Expired Date.`
            );
          }
        }
      }

      // =================================================
      // VALIDASI BATCH EXISTING
      //
      // Jika batch sudah ada, Expired Date harus sama.
      // =================================================

      for (const item of normalizedItems) {
        if (!item.batchNumber) {
          continue;
        }

        const existingBatch =
          await tx.batchStock.findFirst({
            where: {
              barangId: item.barangId,
              batchNumber: item.batchNumber,
            },
          });

        if (existingBatch) {
          const existingDate =
            new Date(existingBatch.expiredDate);

          const incomingDate =
            new Date(item.expiredDate!);

          const existingDateOnly =
            existingDate
              .toISOString()
              .substring(0, 10);

          const incomingDateOnly =
            incomingDate
              .toISOString()
              .substring(0, 10);

          if (
            existingDateOnly !==
            incomingDateOnly
          ) {
            const barang =
              barangMap.get(item.barangId);

            throw new Error(
              `Batch "${item.batchNumber}" untuk ${
                barang?.name ?? "barang"
              } sudah memiliki Expired Date ${existingDateOnly}.`
            );
          }
        }
      }

      // =================================================
      // RECEIPT DATE
      //
      // INILAH TITIK AWAL TEMPO.
      // =================================================

      const receiptDate = new Date();

      // =================================================
      // RECEIPT NUMBER
      // =================================================

      let receiptNumber =
        generateReceiptNumber();

      let receiptNumberExists =
        await tx.receipt.findUnique({
          where: {
            number: receiptNumber,
          },

          select: {
            id: true,
          },
        });

      while (receiptNumberExists) {
        receiptNumber =
          generateReceiptNumber();

        receiptNumberExists =
          await tx.receipt.findUnique({
            where: {
              number: receiptNumber,
            },

            select: {
              id: true,
            },
          });
      }

      // =================================================
      // CREATE RECEIPT
      //
      // INVOICE SUPPLIER DISIMPAN LANGSUNG PADA RECEIPT.
      //
      // Untuk TEMPO:
      // Receipt.invoiceNumber
      // dan
      // PurchasePayable.invoiceNumber
      // menggunakan invoice supplier yang sama.
      //
      // Untuk non-TEMPO:
      // invoiceNumber boleh null.
      // =================================================

      const receipt =
        await tx.receipt.create({
          data: {
            number: receiptNumber,

            purchaseId: purchase.id,

            supplierId: purchase.supplierId,

            receiptDate,

            invoiceNumber:
              invoiceNumber || null,

            remarks,
          },
        });

      // =================================================
      // PROCESS RECEIPT ITEMS
      // =================================================

      for (const item of normalizedItems) {
        const barang =
          barangMap.get(item.barangId);

        if (!barang) {
          throw new Error(
            "Barang tidak ditemukan."
          );
        }

        const poItem =
          purchase.items.find(
            (row) =>
              row.barangId ===
              item.barangId
          );

        if (!poItem) {
          throw new Error(
            "Purchase Item tidak ditemukan."
          );
        }

        const qty =
          roundQty(item.qty);

        const price =
          roundMoney(item.price);

        // ===============================================
        // RECEIPT ITEM
        // ===============================================

        await tx.receiptItem.create({
          data: {
            receiptId: receipt.id,

            barangId: item.barangId,

            qty,

            price,

            subtotal:
              roundMoney(
                qty * price
              ),
          },
        });

        // ===============================================
        // INVENTORY
        // ===============================================

        let inventory =
          await tx.inventory.findUnique({
            where: {
              barangId:
                item.barangId,
            },
          });

        if (!inventory) {
          inventory =
            await tx.inventory.create({
              data: {
                barangId:
                  item.barangId,

                warehouse:
                  "MAIN",

                stock: 0,

                reservedStock:
                  0,

                availableStock:
                  0,

                minimumStock:
                  Number(
                    barang.minimumStock ??
                      0
                  ),

                maximumStock:
                  0,

                lastPurchase:
                  0,

                averageCost:
                  0,
              },
            });
        }

        // ===============================================
        // STOCK BEFORE
        // ===============================================

        const stockBefore =
          Number(
            inventory.stock ?? 0
          );

        const reservedStock =
          Number(
            inventory.reservedStock ??
              0
          );

        const stockAfter =
          roundQty(
            stockBefore + qty
          );

        // ===============================================
        // AVERAGE COST
        // ===============================================

        const oldAverageCost =
          Number(
            inventory.averageCost ??
              0
          );

        const averageCost =
          stockBefore <= 0
            ? price
            : roundMoney(
                (
                  stockBefore *
                    oldAverageCost +
                  qty * price
                ) /
                  stockAfter
              );

        // ===============================================
        // AVAILABLE STOCK
        // ===============================================

        const availableStock =
          roundQty(
            Math.max(
              0,
              stockAfter -
                reservedStock
            )
          );

        // ===============================================
        // UPDATE INVENTORY
        // ===============================================

        await tx.inventory.update({
          where: {
            barangId:
              item.barangId,
          },

          data: {
            stock:
              stockAfter,

            availableStock,

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
            id:
              item.barangId,
          },

          data: {
            stock:
              stockAfter,

            purchasePrice:
              price,
          },
        });

        // ===============================================
        // BATCH STOCK
        // ===============================================

        if (
          barang.hasExpired &&
          item.batchNumber &&
          item.expiredDate
        ) {
          const batchNumber =
            item.batchNumber.trim();

          const expiredDate =
            new Date(
              item.expiredDate
            );

          const existingBatch =
            await tx.batchStock.findFirst({
              where: {
                barangId:
                  item.barangId,

                batchNumber,
              },
            });

          if (existingBatch) {
            await tx.batchStock.update({
              where: {
                id:
                  existingBatch.id,
              },

              data: {
                qty: {
                  increment:
                    qty,
                },
              },
            });
          } else {
            await tx.batchStock.create({
              data: {
                barangId:
                  item.barangId,

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
          Number(
            barang.purchasePrice ?? 0
          );

        const hargaBaru =
          price;

        const selisihHarga =
          roundMoney(
            hargaBaru -
              hargaLama
          );

        const persenNaik =
          hargaLama > 0
            ? (
                selisihHarga /
                  hargaLama
              ) *
              100
            : 0;

        const qtyHistory =
          await tx.masterHarga.aggregate({
            where: {
              barangId:
                item.barangId,
            },

            _sum: {
              qty: true,
            },
          });

        const akumulasi =
          roundQty(
            Number(
              qtyHistory._sum
                .qty ?? 0
            ) + qty
          );

        await tx.masterHarga.create({
          data: {
            barangId:
              item.barangId,

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
              roundMoney(
                qty *
                  hargaBaru
              ),

            akumulasi,

            status:
              "RECEIVED",

            receiveDate:
              receiptDate,

            createdAt:
              receiptDate,
          },
        });

        // ===============================================
        // PRICE SUMMARY
        // ===============================================

        const histories =
          await tx.masterHarga.findMany({
            where: {
              barangId:
                item.barangId,
            },

            orderBy: {
              receiveDate:
                "desc",
            },
          });

        const hargaTerakhir =
          Number(
            histories[0]
              ?.hargaBaru ?? 0
          );

        const hargaTertinggi =
          histories.length > 0
            ? Math.max(
                ...histories.map(
                  (history) =>
                    Number(
                      history.hargaBaru
                    )
                )
              )
            : 0;

        const hargaTerendah =
          histories.length > 0
            ? Math.min(
                ...histories.map(
                  (history) =>
                    Number(
                      history.hargaBaru
                    )
                )
              )
            : 0;

        const totalQty =
          histories.reduce(
            (total, history) =>
              total +
              Number(
                history.qty
              ),
            0
          );

        const totalNilai =
          histories.reduce(
            (total, history) =>
              total +
              Number(
                history.total
              ),
            0
          );

        const hargaRata =
          totalQty <= 0
            ? 0
            : roundMoney(
                totalNilai /
                  totalQty
              );

        await tx.priceSummary.upsert({
          where: {
            barangId:
              item.barangId,
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
              receiptDate,

            totalPurchase:
              totalQty,
          },

          create: {
            barangId:
              item.barangId,

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
              receiptDate,

            totalPurchase:
              totalQty,
          },
        });

        // ===============================================
        // STOCK CARD
        // ===============================================

        await tx.stockCard.create({
          data: {
            barangId:
              item.barangId,

            trxDate:
              receiptDate,

            trxType:
              "RECEIPT",

            trxNumber:
              receipt.number,

            referenceId:
              receipt.id,

            warehouse:
              "MAIN",

            qtyIn:
              qty,

            qtyOut:
              0,

            balance:
              stockAfter,

            unitPrice:
              price,

            totalValue:
              roundMoney(
                qty * price
              ),

            note:
              "Goods Receipt",
          },
        });

        // ===============================================
        // STOCK MUTATION
        // ===============================================

        await tx.stockMutation.create({
          data: {
            barangId:
              item.barangId,

            type:
              "RECEIPT",

            qty,

            stockBefore,

            stockAfter,

            reference:
              receipt.number,

            description:
              "Goods Receipt",
          },
        });

        // ===============================================
        // UPDATE PURCHASE ITEM
        // ===============================================

        await tx.purchaseItem.update({
          where: {
            id:
              poItem.id,
          },

          data: {
            receivedQty:
              roundQty(
                Number(
                  poItem.receivedQty ??
                    0
                ) + qty
              ),
          },
        });
      }

      // =================================================
      // FINAL VALIDATION RECEIVED QTY
      // =================================================

      const updatedPurchaseItems =
        await tx.purchaseItem.findMany({
          where: {
            purchaseId:
              purchase.id,
          },
        });

      for (const item of updatedPurchaseItems) {
        const qtyPO =
          roundQty(
            Number(item.qty)
          );

        const receivedQty =
          roundQty(
            Number(
              item.receivedQty
            )
          );

        if (
          Math.abs(
            qtyPO -
              receivedQty
          ) > 0.000001
        ) {
          throw new Error(
            `Qty penerimaan ${item.barangId} belum sama dengan Qty PO.`
          );
        }
      }

      // =================================================
      // UPDATE PURCHASE STATUS
      // =================================================

      await tx.purchase.update({
        where: {
          id:
            purchase.id,
        },

        data: {
          status:
            PurchaseStatus.RECEIVED,
        },
      });

      // =================================================
      // PURCHASE PAYABLE — TEMPO
      //
      // TEMPO DIMULAI DARI RECEIPT DATE.
      //
      // Invoice supplier disimpan pada:
      //
      // Receipt.invoiceNumber
      // PurchasePayable.invoiceNumber
      //
      // menggunakan nomor invoice yang sama.
      //
      // RULE:
      //
      // 1. Payable belum ada
      //    -> CREATE
      //
      // 2. Payable sudah ada
      //    -> REUSE
      //
      // 3. Payable sudah ada tetapi invoice berbeda
      //    -> ERROR
      //
      // Tidak membuat duplicate payable.
      // Tidak menghapus payable lama.
      // =================================================

      let payable = null;

      if (paymentMethod === "TEMPO") {
        // ===============================================
        // DOUBLE SAFETY CHECK
        // ===============================================

        if (!invoiceNumber) {
          throw new Error(
            "Nomor Invoice Supplier wajib diisi untuk pembayaran TEMPO."
          );
        }

        // ===============================================
        // SUPPLIER TEMPO DAYS
        // ===============================================

        const tempoDays =
          Math.max(
            0,
            Number(
              purchase.supplier
                .tempoDays ?? 0
            )
          );

        // ===============================================
        // DUE DATE
        //
        // receiptDate + tempoDays
        // ===============================================

        const dueDate =
          addDays(
            receiptDate,
            tempoDays
          );

        // ===============================================
        // PAYABLE AMOUNT
        // ===============================================

        const amount =
          roundMoney(
            Number(
              purchase.total ?? 0
            )
          );

        // ===============================================
        // EXACT SUPPLIER INVOICE
        // ===============================================

        const payableInvoiceNumber =
          invoiceNumber.trim();

        // ===============================================
        // PAYABLE SUDAH ADA
        //
        // Jangan membuat duplicate.
        // ===============================================

        if (purchase.payable) {
          const existingInvoice =
            String(
              purchase.payable.invoiceNumber ??
                ""
            ).trim();

          // ---------------------------------------------
          // Existing payable punya invoice
          // ---------------------------------------------

          if (existingInvoice) {
            if (
              existingInvoice.toUpperCase() !==
              payableInvoiceNumber.toUpperCase()
            ) {
              throw new Error(
                `Purchase Payable sudah memiliki Invoice "${existingInvoice}". ` +
                  `Invoice yang dimasukkan "${payableInvoiceNumber}" berbeda.`
              );
            }

            // -------------------------------------------
            // Invoice sama -> REUSE
            // -------------------------------------------

            payable =
              purchase.payable;

            console.log(
              "PURCHASE PAYABLE REUSED:",
              {
                purchaseId:
                  purchase.id,

                payableId:
                  purchase.payable.id,

                invoiceNumber:
                  existingInvoice,

                reason:
                  "Purchase Payable sudah ada dan invoice sama.",
              }
            );
          } else {
            // -------------------------------------------
            // Existing payable tidak mempunyai invoice
            //
            // Karena TEMPO wajib mempunyai invoice,
            // isi invoice yang dimasukkan user.
            // -------------------------------------------

            payable =
              await tx.purchasePayable.update({
                where: {
                  id:
                    purchase.payable.id,
                },

                data: {
                  invoiceNumber:
                    payableInvoiceNumber,

                  invoiceDate:
                    purchase.payable.invoiceDate ??
                    receiptDate,
                },
              });

            console.log(
              "PURCHASE PAYABLE UPDATED WITH INVOICE:",
              {
                purchaseId:
                  purchase.id,

                payableId:
                  purchase.payable.id,

                invoiceNumber:
                  payableInvoiceNumber,
              }
            );
          }
        } else {
          // =============================================
          // PAYABLE BELUM ADA
          //
          // CREATE BARU
          // =============================================

          payable =
            await tx.purchasePayable.create({
              data: {
                purchaseId:
                  purchase.id,

                outletPurchaseId:
                  null,

                supplierId:
                  purchase.supplierId,

                outletId:
                  null,

                invoiceNumber:
                  payableInvoiceNumber,

                invoiceDate:
                  receiptDate,

                dueDate,

                amount,

                paidAmount:
                  0,

                outstanding:
                  amount,

                status:
                  "OUTSTANDING",
              },
            });

          console.log(
            "PURCHASE PAYABLE CREATED:",
            {
              purchaseId:
                purchase.id,

              payableId:
                payable.id,

              invoiceNumber:
                payableInvoiceNumber,

              invoiceDate:
                receiptDate,

              tempoDays,

              dueDate,

              amount,
            }
          );
        }
      }

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
            `Goods Receipt ${receipt.number} - PO ${purchase.number}`,
        },
      });

      // =================================================
      // RETURN
      // =================================================

      return {
        receipt,

        payable,

        purchase: {
          id:
            purchase.id,

          number:
            purchase.number,

          status:
            PurchaseStatus.RECEIVED,

          paymentMethod:
            purchase.paymentMethod,

          supplier: {
            id:
              purchase.supplier.id,

            name:
              purchase.supplier.name,

            tempoDays:
              purchase.supplier
                .tempoDays,
          },
        },
      };
    });

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      message:
        "Barang berhasil diterima.",

      receipt:
        result.receipt,

      purchase:
        result.purchase,

      payable:
        result.payable,

      dueDate:
        result.payable?.dueDate ??
        null,
    });
  } catch (error) {
    console.error(
      "GOODS RECEIPT ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Gagal menerima barang.";

    // =====================================================
    // VALIDATION ERROR
    // =====================================================

    const validationMessages = [
      "tidak ditemukan",
      "harus",
      "wajib",
      "tidak valid",
      "tidak terdapat",
      "sudah",
      "partial",
      "lengkap",
      "tidak menggunakan",
      "berbeda",
      "maksimal",
    ];

    const isValidationError =
      validationMessages.some(
        (keyword) =>
          message
            .toLowerCase()
            .includes(
              keyword.toLowerCase()
            )
      );

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status:
          isValidationError
            ? 400
            : 500,
      }
    );
  }
}