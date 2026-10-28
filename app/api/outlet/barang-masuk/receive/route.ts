
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  roundQty,
  roundMoney,
} from "@/lib/unit-conversion";

type AnyRecord = Record<string, any>;

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUnit(value: unknown): string {
  return cleanString(value)
    .toLocaleLowerCase("id-ID")
    .replace(/\s+/g, " ");
}

function normalizeQty(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const qty = Number(value);

  return Number.isFinite(qty) && qty > 0 ? qty : null;
}

function safeRoundQty(value: number): number {
  return Number.isFinite(value) ? roundQty(value) : 0;
}

/**
 * Base Unit tersimpan merupakan sumber utama.
 *
 * Untuk data lama yang Base Unit-nya kosong, fallback hanya
 * diizinkan jika Unit merupakan satuan standar yang dikenal.
 * Fallback ini mengasumsikan Unit tersebut sama dengan Base Unit.
 *
 * Untuk jerigen, dus, karung, dan satuan kemasan lainnya,
 * Base Unit harus diisi secara eksplisit.
 */
function getEffectiveBaseUnit(barang: AnyRecord): string {
  const baseUnit = cleanString(barang?.baseUnit);

  if (baseUnit) {
    return baseUnit;
  }

  const unit = cleanString(barang?.unit);
  const normalizedUnit = normalizeUnit(unit);

  const standardUnits = new Set([
    "kg",
    "g",
    "gram",
    "mg",
    "ton",
    "l",
    "liter",
    "ltr",
    "ml",
    "mililiter",
    "pcs",
    "pc",
    "piece",
    "unit",
    "buah",
  ]);

  return standardUnits.has(normalizedUnit) ? unit : "";
}

function getConversionRate(barang: AnyRecord): number {
  return Number(barang?.conversionRate);
}

function getRequestItemId(requestItem: AnyRecord): number | null {
  const rawId =
    requestItem?.itemId ??
    requestItem?.purchaseItemId ??
    requestItem?.id;

  const id = Number(rawId);

  return Number.isInteger(id) && id > 0 ? id : null;
}

function getRequestedReceivedQty(
  requestItem: AnyRecord,
  purchaseItem: AnyRecord
): number | null {
  const candidates = [
    requestItem?.receivedQty,
    requestItem?.qtyDiterima,
    requestItem?.receiveQty,
    requestItem?.qtyTerima,
    requestItem?.received,
    requestItem?.qty,
  ];

  for (const value of candidates) {
    if (value !== undefined && value !== null && value !== "") {
      return normalizeQty(value);
    }
  }

  return normalizeQty(purchaseItem.qty);
}

function buildReceivedQtyMap(
  body: AnyRecord,
  purchaseItems: AnyRecord[]
): Map<number, number> {
  const rawItems = Array.isArray(body?.items)
    ? body.items
    : Array.isArray(body?.receivedItems)
      ? body.receivedItems
      : Array.isArray(body?.itemQuantities)
        ? body.itemQuantities
        : null;

  const result = new Map<number, number>();

  if (rawItems) {
    for (const requestItem of rawItems) {
      const itemId = getRequestItemId(requestItem);

      if (!itemId) continue;

      const purchaseItem = purchaseItems.find(
        (item) => item.id === itemId
      );

      if (!purchaseItem) continue;

      const qty = getRequestedReceivedQty(
        requestItem,
        purchaseItem
      );

      result.set(itemId, qty ?? Number.NaN);
    }
  }

  for (const item of purchaseItems) {
    if (!result.has(item.id)) {
      result.set(
        item.id,
        normalizeQty(item.qty) ?? Number.NaN
      );
    }
  }

  return result;
}

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session =
    cookieStore.get("erp-session") ??
    cookieStore.get("session");

  if (!session?.value) return null;

  let sessionData: AnyRecord;

  try {
    sessionData = JSON.parse(session.value);
  } catch {
    return null;
  }

  const userId = Number(
    sessionData?.user?.id ??
      sessionData?.data?.user?.id ??
      sessionData?.data?.id ??
      sessionData?.id
  );

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { outlet: true },
  });

  if (!user || user.active === false) return null;

  return user;
}

function validateReceivedItem(
  item: AnyRecord,
  receivedQty: number | undefined
) {
  const barang = item.barang;

  if (!barang) {
    throw new Error(
      `Barang pada item Purchase ID ${item.id} tidak ditemukan.`
    );
  }

  if (barang.source !== "CENTRAL") {
    throw new Error(
      `Barang "${barang.name}" bukan Barang Central. Purchase supplier outlet hanya boleh menggunakan Barang Central.`
    );
  }

  const unit = cleanString(barang.unit);
  const baseUnit = getEffectiveBaseUnit(barang);

  if (!unit) {
    throw new Error(
      `Unit transaksi barang "${barang.name}" belum diatur.`
    );
  }

  if (!baseUnit) {
    throw new Error(
      `Barang "${barang.name}" belum memiliki Base Unit yang valid. Lengkapi Base Unit pada Master Barang.`
    );
  }

  const sameUnit =
    normalizeUnit(unit) === normalizeUnit(baseUnit);

  const conversionRate = getConversionRate(barang);

  if (
    !sameUnit &&
    (!Number.isFinite(conversionRate) || conversionRate <= 0)
  ) {
    throw new Error(
      `Conversion Rate barang "${barang.name}" tidak valid. Unit "${unit}" berbeda dengan Base Unit "${baseUnit}".`
    );
  }

  const poQty = Number(item.qty);

  if (!Number.isFinite(poQty) || poQty <= 0) {
    throw new Error(
      `Qty Purchase Order barang "${barang.name}" tidak valid.`
    );
  }

  if (
    receivedQty === undefined ||
    !Number.isFinite(receivedQty) ||
    receivedQty <= 0
  ) {
    throw new Error(
      `Qty diterima barang "${barang.name}" tidak valid.`
    );
  }

  const price = Number(item.price);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error(
      `Harga barang "${barang.name}" tidak valid.`
    );
  }

  return { unit, baseUnit, price };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const allowedRoles = ["ADMIN", "MANAGER", "OUTLET_ADMIN"];

    if (!allowedRoles.includes(String(user.role))) {
      return NextResponse.json(
        {
          success: false,
          message: "Anda tidak memiliki akses untuk menerima barang.",
        },
        { status: 403 }
      );
    }

    let body: AnyRecord;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Request body tidak valid.",
        },
        { status: 400 }
      );
    }

    const purchaseId = Number(body?.purchaseId);
    const invoiceNumber = cleanString(body?.invoiceNumber);
    const remarks = cleanString(body?.remarks) || null;

    if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
      return NextResponse.json(
        { success: false, message: "Purchase ID tidak valid." },
        { status: 400 }
      );
    }

    const purchaseWhere: AnyRecord = { id: purchaseId };

    if (String(user.role) === "OUTLET_ADMIN") {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message: "User outlet tidak memiliki outlet.",
          },
          { status: 403 }
        );
      }

      purchaseWhere.outletId = user.outletId;
    }

    const purchase = await prisma.outletPurchase.findFirst({
      where: purchaseWhere,
      include: {
        outlet: true,
        supplier: true,
        items: {
          include: { barang: true },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase Outlet tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    if (
      String(user.role) === "OUTLET_ADMIN" &&
      purchase.outletId !== user.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Anda tidak memiliki akses ke Purchase Outlet ini.",
        },
        { status: 403 }
      );
    }

    if (!purchase.outlet?.active) {
      return NextResponse.json(
        { success: false, message: "Outlet tujuan tidak aktif." },
        { status: 400 }
      );
    }

    if (purchase.status !== "APPROVED") {
      return NextResponse.json(
        {
          success: false,
          message:
            purchase.status === "RECEIVED"
              ? "Purchase Outlet ini sudah pernah diterima."
              : "Purchase Outlet harus berstatus APPROVED sebelum menerima barang.",
        },
        { status: 400 }
      );
    }

    if (!purchase.supplier) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier Purchase Outlet tidak ditemukan.",
        },
        { status: 400 }
      );
    }

    if (!purchase.items?.length) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak memiliki item yang dapat diterima.",
        },
        { status: 400 }
      );
    }

    const receivedQtyMap = buildReceivedQtyMap(
      body,
      purchase.items
    );

    const paymentMethod = String(purchase.paymentMethod)
      .trim()
      .toUpperCase();

    const supportedPaymentMethods = [
      "CASH",
      "TRANSFER",
      "COD",
      "CBD",
      "TEMPO",
    ];

    if (!supportedPaymentMethods.includes(paymentMethod)) {
      return NextResponse.json(
        {
          success: false,
          message: `Payment Method "${paymentMethod}" tidak didukung untuk penerimaan barang.`,
        },
        { status: 400 }
      );
    }

    const isTempo = paymentMethod === "TEMPO";

    if (isTempo && !invoiceNumber) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No. Invoice Supplier wajib diisi untuk Purchase dengan pembayaran TEMPO.",
        },
        { status: 400 }
      );
    }

    for (const item of purchase.items) {
      try {
        validateReceivedItem(
          item,
          receivedQtyMap.get(item.id)
        );
      } catch (error: any) {
        return NextResponse.json(
          {
            success: false,
            message:
              error?.message ??
              "Data item penerimaan tidak valid.",
          },
          { status: 400 }
        );
      }
    }

    const receiptDate = new Date();

    const receivedTotal = roundMoney(
      purchase.items.reduce((sum, item) => {
        const qty = receivedQtyMap.get(item.id);
        const price = Number(item.price);

        return sum + Number(qty) * price;
      }, 0)
    );

    if (!Number.isFinite(receivedTotal) || receivedTotal < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Total nilai barang yang diterima tidak valid.",
        },
        { status: 400 }
      );
    }

    let dueDate: Date | null = null;

    if (isTempo) {
      const tempoDays = Number(purchase.supplier.tempoDays ?? 0);

      if (!Number.isInteger(tempoDays) || tempoDays < 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Tempo Days supplier tidak valid.",
          },
          { status: 400 }
        );
      }

      dueDate = new Date(receiptDate);
      dueDate.setDate(dueDate.getDate() + tempoDays);
    }

    const result = await prisma.$transaction(async (tx) => {
      const currentPurchase = await tx.outletPurchase.findUnique({
        where: { id: purchase.id },
        include: {
          outlet: true,
          supplier: true,
          items: {
            include: { barang: true },
            orderBy: { id: "asc" },
          },
        },
      });

      if (!currentPurchase) {
        throw new Error("Purchase Outlet tidak ditemukan.");
      }

      if (currentPurchase.status !== "APPROVED") {
        throw new Error(
          currentPurchase.status === "RECEIVED"
            ? "Purchase Outlet ini sudah pernah diterima."
            : "Purchase Outlet tidak lagi berstatus APPROVED."
        );
      }

      if (
        String(user.role) === "OUTLET_ADMIN" &&
        currentPurchase.outletId !== user.outletId
      ) {
        throw new Error(
          "Anda tidak memiliki akses ke Purchase Outlet ini."
        );
      }

      if (!currentPurchase.outlet?.active) {
        throw new Error("Outlet tujuan tidak aktif.");
      }

      const currentPaymentMethod = String(
        currentPurchase.paymentMethod
      )
        .trim()
        .toUpperCase();

      if (!supportedPaymentMethods.includes(currentPaymentMethod)) {
        throw new Error(
          `Payment Method "${currentPaymentMethod}" tidak didukung.`
        );
      }

      const currentIsTempo = currentPaymentMethod === "TEMPO";

      if (currentIsTempo && !invoiceNumber) {
        throw new Error(
          "No. Invoice Supplier wajib diisi untuk Purchase dengan pembayaran TEMPO."
        );
      }

      const existingReceipt = await tx.outletReceipt.findFirst({
        where: { purchaseId: currentPurchase.id },
        select: { id: true, number: true },
      });

      if (existingReceipt) {
        throw new Error(
          `Purchase Outlet ini sudah memiliki dokumen penerimaan ${existingReceipt.number}.`
        );
      }

      if (invoiceNumber) {
        const duplicateReceipt = await tx.outletReceipt.findFirst({
          where: {
            supplierId: currentPurchase.supplierId,
            invoiceNumber,
          },
          select: {
            id: true,
            number: true,
            purchaseId: true,
          },
        });

        if (
          duplicateReceipt &&
          duplicateReceipt.purchaseId !== currentPurchase.id
        ) {
          throw new Error(
            `Invoice supplier "${invoiceNumber}" sudah digunakan pada penerimaan lain untuk supplier ini.`
          );
        }

        if (currentIsTempo) {
          const duplicatePayable =
            await tx.purchasePayable.findFirst({
              where: {
                supplierId: currentPurchase.supplierId,
                invoiceNumber,
              },
              select: {
                id: true,
                outletPurchaseId: true,
              },
            });

          if (
            duplicatePayable &&
            duplicatePayable.outletPurchaseId !== currentPurchase.id
          ) {
            throw new Error(
              `Invoice supplier "${invoiceNumber}" sudah digunakan pada Purchase Payable lain.`
            );
          }
        }
      }

      const validatedItems = currentPurchase.items.map((item) => {
        const qty = receivedQtyMap.get(item.id);
        validateReceivedItem(item, qty);

        return {
          item,
          qty: Number(qty),
          price: Number(item.price),
          subtotal: roundMoney(
            Number(qty) * Number(item.price)
          ),
        };
      });

      const currentReceivedTotal = roundMoney(
        validatedItems.reduce(
          (sum, item) => sum + item.subtotal,
          0
        )
      );

      const receiptNumber =
        `OR-${Date.now()}-${currentPurchase.id}`;

      const receipt = await tx.outletReceipt.create({
        data: {
          number: receiptNumber,
          purchaseId: currentPurchase.id,
          outletId: currentPurchase.outletId,
          supplierId: currentPurchase.supplierId,
          invoiceNumber: invoiceNumber || null,
          receiptDate,
          remarks:
            remarks ||
            currentPurchase.remarks ||
            null,
          items: {
            create: validatedItems.map(({ item, qty, price, subtotal }) => ({
              barangId: item.barangId,
              qty,
              price,
              subtotal,
            })),
          },
        },
        include: { items: true },
      });

      if (receipt.items.length !== validatedItems.length) {
        throw new Error(
          "Jumlah item Outlet Receipt tidak sesuai dengan item Purchase."
        );
      }

      /*
       * Validasi berdasarkan purchaseItemId jika relasi tersedia.
       * Fallback ke barangId untuk skema ReceiptItem yang tidak
       * menyimpan purchaseItemId.
       */
      for (const expected of validatedItems) {
        const actual = receipt.items.find(
          (receiptItem: AnyRecord) =>
            receiptItem.purchaseItemId === expected.item.id
        ) ?? receipt.items.find(
          (receiptItem: AnyRecord) =>
            receiptItem.barangId === expected.item.barangId
        );

        if (
          !actual ||
          Math.abs(
            safeRoundQty(Number(actual.qty)) -
            safeRoundQty(expected.qty)
          ) > 0.000001
        ) {
          throw new Error(
            `Qty Receipt untuk barang "${expected.item.barang?.name ?? expected.item.barangId}" tidak konsisten.`
          );
        }
      }

      /*
       * KANONIKAL STOCK OUTLET:
       * OutletStock.stock dan averageCost menggunakan unit utama Barang
       * (Barang.unit), agar konsisten dengan transfer, adjustment, waste,
       * stock opname, POS dan manufacture yang membaca saldo dalam unit ini.
       *
       * ReceiptItem.qty / receivedQty tetap menyimpan kuantitas transaksi.
       * Jangan mengalikan conversionRate pada saldo di sini. Konversi ke base
       * unit hanya dilakukan saat menghitung kebutuhan resep/manufacture.
       */
      for (const { item, qty, price } of validatedItems) {
        const barang = item.barang;

        if (!barang) {
          throw new Error(
            `Barang pada Purchase Item ID ${item.id} tidak ditemukan.`
          );
        }

        const stockQty = safeRoundQty(Number(qty));
        const stockUnitCost = roundMoney(Number(price));

        if (
          !Number.isFinite(stockQty) ||
          stockQty <= 0 ||
          !Number.isFinite(stockUnitCost) ||
          stockUnitCost < 0
        ) {
          throw new Error(
            `Qty/harga penerimaan barang "${barang.name}" tidak valid.`
          );
        }

        const existingStock = await tx.outletStock.findUnique({
          where: {
            outletId_barangId: {
              outletId: currentPurchase.outletId,
              barangId: item.barangId,
            },
          },
        });

        const stockBefore = safeRoundQty(Number(existingStock?.stock ?? 0));
        const oldAverageCost = Number(existingStock?.averageCost ?? 0);
        const stockAfter = safeRoundQty(stockBefore + stockQty);

        if (
          !Number.isFinite(stockBefore) || stockBefore < 0 ||
          !Number.isFinite(oldAverageCost) || oldAverageCost < 0
        ) {
          throw new Error(
            `Saldo/harga rata-rata barang "${barang.name}" tidak valid.`
          );
        }

        const newAverageCost = stockAfter > 0
          ? roundMoney(
              (stockBefore * oldAverageCost + stockQty * stockUnitCost) /
              stockAfter
            )
          : stockUnitCost;

        if (!existingStock) {
          await tx.outletStock.create({
            data: {
              outletId: currentPurchase.outletId,
              barangId: item.barangId,
              stock: stockAfter,
              minimumStock: Number(barang.minimumStock ?? 0),
              averageCost: newAverageCost,
            },
          });
        } else {
          await tx.outletStock.update({
            where: { id: existingStock.id },
            data: {
              stock: stockAfter,
              averageCost: newAverageCost,
            },
          });
        }

        // Ledger dibuat dalam transaksi yang sama dengan pembaruan saldo.
        // qty / before / after memakai unit utama Barang yang sama dengan OutletStock.
        await tx.stockMutation.create({
          data: {
            outletId: currentPurchase.outletId,
            barangId: item.barangId,
            type: "OUTLET_RECEIPT",
            qty: stockQty,
            stockBefore,
            stockAfter,
            reference: receipt.number,
            description: `Penerimaan ${currentPurchase.number} (${stockQty} ${barang.unit})`,
          },
        });

        /*
         * receivedQty tetap unit transaksi, sama dengan ReceiptItem.qty.
         */
        await tx.outletPurchaseItem.update({
          where: { id: item.id },
          data: { receivedQty: qty },
        });
      }

      /*
       * Periksa konsistensi akhir antara Purchase Item dan Receipt Item.
       */
      const finalPurchaseItems =
        await tx.outletPurchaseItem.findMany({
          where: { purchaseId: currentPurchase.id },
          select: {
            id: true,
            barangId: true,
            receivedQty: true,
          },
          orderBy: { id: "asc" },
        });

      const finalReceipt = await tx.outletReceipt.findUnique({
        where: { id: receipt.id },
        include: { items: true },
      });

      if (!finalReceipt) {
        throw new Error(
          "Outlet Receipt tidak ditemukan setelah proses penerimaan."
        );
      }

      if (finalPurchaseItems.length !== finalReceipt.items.length) {
        throw new Error(
          "Jumlah Purchase Item dan Receipt Item tidak konsisten."
        );
      }

      for (const purchaseItem of finalPurchaseItems) {
        const receiptItem = finalReceipt.items.find(
          (item: AnyRecord) =>
            item.purchaseItemId === purchaseItem.id
        ) ?? finalReceipt.items.find(
          (item: AnyRecord) =>
            item.barangId === purchaseItem.barangId
        );

        if (!receiptItem) {
          throw new Error(
            `Receipt Item barang ID ${purchaseItem.barangId} tidak ditemukan.`
          );
        }

        if (
          Math.abs(
            safeRoundQty(Number(purchaseItem.receivedQty)) -
            safeRoundQty(Number(receiptItem.qty))
          ) > 0.000001
        ) {
          throw new Error(
            `Received Qty dan Receipt Qty tidak konsisten untuk barang ID ${purchaseItem.barangId}.`
          );
        }
      }

      /*
       * Purchase Payable hanya dibuat/diperbarui untuk TEMPO.
       * Payable existing dipertahankan dan paidAmount tidak diubah.
       */
      let payable: AnyRecord | null = null;

      if (currentIsTempo) {
        const existingPayable =
          await tx.purchasePayable.findUnique({
            where: {
              outletPurchaseId: currentPurchase.id,
            },
          });

        if (existingPayable) {
          if (
            existingPayable.supplierId !== currentPurchase.supplierId ||
            existingPayable.outletId !== currentPurchase.outletId
          ) {
            throw new Error(
              "Purchase Payable existing tidak sesuai dengan supplier atau outlet Purchase ini."
            );
          }

          const existingInvoice = cleanString(
            existingPayable.invoiceNumber
          );

          if (
            existingInvoice &&
            invoiceNumber &&
            existingInvoice !== invoiceNumber
          ) {
            throw new Error(
              `Purchase Payable sudah menggunakan Invoice "${existingInvoice}", sedangkan invoice penerimaan adalah "${invoiceNumber}".`
            );
          }

          const finalInvoiceNumber =
            existingInvoice || invoiceNumber;

          if (!finalInvoiceNumber) {
            throw new Error(
              "Purchase Payable TEMPO tidak memiliki Invoice Supplier."
            );
          }

          const existingAmount = roundMoney(
            Number(existingPayable.amount)
          );

          const existingPaidAmount = roundMoney(
            Number(existingPayable.paidAmount)
          );

          if (
            !Number.isFinite(existingAmount) ||
            existingAmount < 0 ||
            !Number.isFinite(existingPaidAmount) ||
            existingPaidAmount < 0
          ) {
            throw new Error(
              "Nilai Purchase Payable existing tidak valid."
            );
          }

          if (
            Math.abs(existingAmount - currentReceivedTotal) > 0.01
          ) {
            throw new Error(
              `Purchase Payable existing bernilai Rp${existingAmount.toLocaleString("id-ID")}, sedangkan nilai penerimaan Rp${currentReceivedTotal.toLocaleString("id-ID")}. Periksa payable sebelum menerima barang.`
            );
          }

          const outstanding = Math.max(
            0,
            roundMoney(existingAmount - existingPaidAmount)
          );

          payable = await tx.purchasePayable.update({
            where: { id: existingPayable.id },
            data: {
              invoiceNumber: finalInvoiceNumber,
              invoiceDate:
                existingPayable.invoiceDate ?? receiptDate,
              dueDate: existingPayable.dueDate ?? dueDate,
              amount: existingPayable.amount,
              paidAmount: existingPaidAmount,
              outstanding,
              status: outstanding <= 0.01
                ? "PAID"
                : "OUTSTANDING",
            },
          });
        } else {
          payable = await tx.purchasePayable.create({
            data: {
              outletPurchaseId: currentPurchase.id,
              supplierId: currentPurchase.supplierId,
              outletId: currentPurchase.outletId,
              invoiceNumber,
              invoiceDate: receiptDate,
              dueDate,
              amount: currentReceivedTotal,
              paidAmount: 0,
              outstanding: currentReceivedTotal,
              status: "OUTSTANDING",
            },
          });
        }
      }

      const updatedPurchase = await tx.outletPurchase.update({
        where: { id: currentPurchase.id },
        data: { status: "RECEIVED" },
      });

      return {
        receipt,
        payable,
        purchase: updatedPurchase,
        paymentMethod: currentPaymentMethod,
        invoiceNumber: invoiceNumber || null,
        receivedTotal: currentReceivedTotal,
      };
    });

    let successMessage = "Barang berhasil diterima.";

    if (result.payable) {
      successMessage =
        "Barang berhasil diterima dan Purchase Payable TEMPO berhasil diproses.";
    } else if (result.invoiceNumber) {
      successMessage =
        "Barang berhasil diterima dan Invoice Supplier berhasil disimpan.";
    }

    return NextResponse.json({
      success: true,
      message: successMessage,
      data: {
        receipt: result.receipt,
        payable: result.payable,
        purchase: result.purchase,
        paymentMethod: result.paymentMethod,
        invoiceNumber: result.invoiceNumber,
        receivedTotal: result.receivedTotal,
      },
    });
  } catch (error: any) {
    console.error(
      "OUTLET BARANG MASUK RECEIVE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat menerima barang.",
      },
      { status: 400 }
    );
  }
}
