import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * ============================================================
 * RECEIVE PURCHASE
 * ============================================================
 *
 * RULE:
 * - Purchase harus APPROVED
 * - Tidak ada partial receipt
 * - Semua item PO harus diterima penuh
 * - Stock pusat bertambah
 * - Inventory.stock bertambah
 * - Inventory.availableStock bertambah
 * - Barang.stock bertambah
 * - StockCard dibuat
 * - StockMutation dibuat
 * - Purchase menjadi RECEIVED
 * - Jika TEMPO:
 *      PurchasePayable dibuat
 *      invoiceDate = receiptDate
 *      dueDate = receiptDate + Supplier.tempoDays
 *
 * IMPORTANT:
 * Semua proses menggunakan satu transaction.
 * ============================================================
 */

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const purchaseId = Number(body?.purchaseId);
    const inputItems = Array.isArray(body?.items) ? body.items : [];

    const inputInvoiceNumber =
      typeof body?.invoiceNumber === "string"
        ? body.invoiceNumber.trim()
        : "";

    if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "purchaseId tidak valid",
        },
        { status: 400 }
      );
    }

    if (inputItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Item penerimaan tidak boleh kosong",
        },
        { status: 400 }
      );
    }

    /**
     * ========================================================
     * NORMALIZE INPUT ITEM
     * ========================================================
     */

    const normalizedItems = inputItems.map((item: any) => ({
      barangId: Number(item?.barangId),
      qty: Number(item?.qty),
    }));

    /**
     * ========================================================
     * BASIC VALIDATION
     * ========================================================
     */

    for (const item of normalizedItems) {
      if (!Number.isInteger(item.barangId) || item.barangId <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "barangId tidak valid",
          },
          { status: 400 }
        );
      }

      if (!Number.isFinite(item.qty) || item.qty <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Qty barang ${item.barangId} harus lebih dari 0`,
          },
          { status: 400 }
        );
      }
    }

    /**
     * ========================================================
     * CEK DUPLICATE BARANG DALAM INPUT
     * ========================================================
     */

    const barangIds = normalizedItems.map((item) => item.barangId);

    if (new Set(barangIds).size !== barangIds.length) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang yang sama tidak boleh muncul lebih dari satu kali dalam Receipt",
        },
        { status: 400 }
      );
    }

    /**
     * ========================================================
     * TRANSACTION
     * ========================================================
     */

    const result = await prisma.$transaction(async (tx) => {
      /**
       * ======================================================
       * LOAD PURCHASE TERBARU DI DALAM TRANSACTION
       * ======================================================
       */

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
          payable: true,
          receipts: {
            include: {
              items: true,
            },
          },
        },
      });

      if (!purchase) {
        throw new Error("Purchase Order tidak ditemukan");
      }

      /**
       * ======================================================
       * STATUS VALIDATION
       * ======================================================
       */

      if (purchase.status !== "APPROVED") {
        throw new Error(
          `Purchase tidak dapat diterima karena status saat ini ${purchase.status}`
        );
      }

      /**
       * ======================================================
       * NO DUPLICATE RECEIPT
       * ======================================================
       */

      if (purchase.receipts.length > 0) {
        throw new Error(
          "Purchase Order ini sudah memiliki Receipt. Penerimaan tidak boleh dilakukan dua kali."
        );
      }

      /**
       * ======================================================
       * ITEM COUNT HARUS SAMA
       * ======================================================
       *
       * Karena tidak ada partial receipt:
       *
       * jumlah item Receipt harus sama dengan jumlah item PO.
       */

      if (normalizedItems.length !== purchase.items.length) {
        throw new Error(
          "Semua item Purchase harus diterima. Partial Receipt tidak diperbolehkan."
        );
      }

      /**
       * ======================================================
       * MAP PO ITEM
       * ======================================================
       */

      const purchaseItemMap = new Map(
        purchase.items.map((item) => [item.barangId, item])
      );

      /**
       * ======================================================
       * VALIDATE SETIAP ITEM
       * ======================================================
       */

      for (const item of normalizedItems) {
        const purchaseItem = purchaseItemMap.get(item.barangId);

        if (!purchaseItem) {
          throw new Error(
            `Barang ID ${item.barangId} tidak terdapat pada Purchase Order`
          );
        }

        const orderedQty = roundQty(purchaseItem.qty);
        const receivedQty = roundQty(item.qty);

        /**
         * Tidak boleh menerima lebih sedikit
         */
        if (receivedQty !== orderedQty) {
          throw new Error(
            `Qty barang ${purchaseItem.barang.name} harus diterima penuh. PO: ${orderedQty}, Receipt: ${receivedQty}`
          );
        }
      }

      /**
       * ======================================================
       * RECEIPT DATE
       * ======================================================
       */

      const receiptDate = new Date();

      /**
       * ======================================================
       * RECEIPT NUMBER
       * ======================================================
       */

      const receiptNumber = `GR-${Date.now()}-${Math.floor(
        Math.random() * 1000
      )
        .toString()
        .padStart(3, "0")}`;

      /**
       * ======================================================
       * INVOICE NUMBER
       * ======================================================
       *
       * Jika UI mengirim invoiceNumber:
       * gunakan invoice tersebut.
       *
       * Jika tidak:
       * fallback ke nomor Receipt.
       *
       * Untuk TEMPO sebaiknya UI mengirim nomor invoice supplier.
       */

      const invoiceNumber =
        inputInvoiceNumber || receiptNumber;

      /**
       * ======================================================
       * CREATE RECEIPT
       * ======================================================
       */

      const receipt = await tx.receipt.create({
        data: {
          number: receiptNumber,
          purchaseId: purchase.id,
          supplierId: purchase.supplierId,
          receiptDate,
          items: {
            create: normalizedItems.map((item) => {
              const purchaseItem = purchaseItemMap.get(item.barangId)!;

              const qty = roundQty(item.qty);
              const price = Number(purchaseItem.price ?? 0);
              const subtotal = roundMoney(qty * price);

              return {
                barangId: item.barangId,
                qty,
                price,
                subtotal,
              };
            }),
          },
        },
        include: {
          items: true,
          supplier: true,
          purchase: true,
        },
      });

      /**
       * ======================================================
       * UPDATE STOCK
       * ======================================================
       */

      for (const item of normalizedItems) {
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

        const qty = roundQty(item.qty);

        const stockBefore = roundQty(Number(barang.stock ?? 0));
        const stockAfter = roundQty(stockBefore + qty);

        /**
         * ----------------------------------------------------
         * BARANG.STOCK
         * ----------------------------------------------------
         */

        await tx.barang.update({
          where: {
            id: item.barangId,
          },
          data: {
            stock: stockAfter,
          },
        });

        /**
         * ----------------------------------------------------
         * INVENTORY
         * ----------------------------------------------------
         */

        const inventory = await tx.inventory.findUnique({
          where: {
            barangId: item.barangId,
          },
        });

        if (inventory) {
          const inventoryStock = roundQty(
            Number(inventory.stock ?? 0) + qty
          );

          const availableStock = roundQty(
            inventoryStock - Number(inventory.reservedStock ?? 0)
          );

          await tx.inventory.update({
            where: {
              barangId: item.barangId,
            },
            data: {
              stock: inventoryStock,
              availableStock,
            },
          });
        } else {
          await tx.inventory.create({
            data: {
              barangId: item.barangId,
              warehouse: "MAIN",
              stock: qty,
              reservedStock: 0,
              availableStock: qty,
              minimumStock: Number(barang.minimumStock ?? 0),
              maximumStock: 0,
              lastPurchase: Number(
                purchaseItemMap.get(item.barangId)?.price ?? 0
              ),
              averageCost: Number(
                purchaseItemMap.get(item.barangId)?.price ?? 0
              ),
            },
          });
        }

        /**
         * ----------------------------------------------------
         * STOCK CARD
         * ----------------------------------------------------
         */

        const purchaseItem = purchaseItemMap.get(item.barangId)!;

        await tx.stockCard.create({
          data: {
            barangId: item.barangId,
            trxDate: receiptDate,
            trxType: "RECEIPT",
            trxNumber: receipt.number,
            referenceId: receipt.id,
            warehouse: "MAIN",
            qtyIn: qty,
            qtyOut: 0,
            balance: stockAfter,
            unitPrice: Number(purchaseItem.price ?? 0),
            totalValue: roundMoney(
              qty * Number(purchaseItem.price ?? 0)
            ),
            note: `Penerimaan Purchase ${purchase.number}`,
          },
        });

        /**
         * ----------------------------------------------------
         * STOCK MUTATION
         * ----------------------------------------------------
         */

        await tx.stockMutation.create({
          data: {
            barangId: item.barangId,
            outletId: null,
            type: "RECEIPT",
            qty,
            stockBefore,
            stockAfter,
            reference: receipt.number,
            description: `Barang masuk dari Purchase ${purchase.number}`,
          },
        });
      }

      /**
       * ======================================================
       * UPDATE PURCHASE ITEM
       * ======================================================
       */

      for (const item of normalizedItems) {
        await tx.purchaseItem.updateMany({
          where: {
            purchaseId: purchase.id,
            barangId: item.barangId,
          },
          data: {
            receivedQty: roundQty(item.qty),
          },
        });
      }

      /**
       * ======================================================
       * UPDATE PURCHASE STATUS
       * ======================================================
       */

      await tx.purchase.update({
        where: {
          id: purchase.id,
        },
        data: {
          status: "RECEIVED",
        },
      });

      /**
       * ======================================================
       * CREATE PURCHASE PAYABLE
       * ======================================================
       *
       * HANYA UNTUK TEMPO.
       *
       * Tempo dimulai dari receiptDate.
       */

      let payable = null;

      if (purchase.paymentMethod === "TEMPO") {
        /**
         * Supplier tempo.
         *
         * Contoh:
         * tempoDays = 30
         */

        const tempoDays = Math.max(
          0,
          Number(purchase.supplier.tempoDays ?? 0)
        );

        /**
         * Jatuh tempo:
         *
         * receiptDate + tempoDays
         */

        const dueDate = addDays(receiptDate, tempoDays);

        /**
         * Pastikan belum ada payable.
         */

        if (purchase.payable) {
          throw new Error(
            "Purchase Payable untuk Purchase ini sudah ada."
          );
        }

        payable = await tx.purchasePayable.create({
          data: {
            purchaseId: purchase.id,
            outletPurchaseId: null,
            supplierId: purchase.supplierId,
            outletId: null,

            invoiceNumber,
            invoiceDate: receiptDate,
            dueDate,

            amount: roundMoney(Number(purchase.total ?? 0)),
            paidAmount: 0,
            outstanding: roundMoney(Number(purchase.total ?? 0)),
            status: "OUTSTANDING",
          },
        });
      }

      /**
       * ======================================================
       * RETURN
       * ======================================================
       */

      return {
        receipt,
        payable,
        receiptDate,
        dueDate: payable?.dueDate ?? null,
      };
    });

    /**
     * ========================================================
     * SUCCESS
     * ========================================================
     */

    return NextResponse.json({
      success: true,
      message:
        result.payable
          ? "Barang berhasil diterima dan Purchase Payable berhasil dibuat."
          : "Barang berhasil diterima.",
      data: {
        receipt: result.receipt,
        payable: result.payable,
        receiptDate: result.receiptDate,
        dueDate: result.dueDate,
      },
    });
  } catch (error) {
    console.error("POST /api/receipt ERROR:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Gagal menerima barang";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 500,
      }
    );
  }
}