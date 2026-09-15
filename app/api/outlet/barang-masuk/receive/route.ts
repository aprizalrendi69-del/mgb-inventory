import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

/*
=============================================================
POST OUTLET BARANG MASUK - RECEIVE PURCHASE
=============================================================

FLOW
-------------------------------------------------------------
OUTLET PURCHASE
    ↓
APPROVED
    ↓
BARANG MASUK
    ↓
RECEIVE
    ↓
OUTLET RECEIPT
    ↓
INVOICE SUPPLIER disimpan di OutletReceipt
    ↓
OUTLET STOCK bertambah
    ↓
OUTLET PURCHASE = RECEIVED

KHUSUS TEMPO
    ↓
PurchasePayable dibuat jika belum ada
    ↓
Jika PurchasePayable sudah ada:
    ↓
gunakan PurchasePayable existing
    ↓
TIDAK membuat payable kedua

NON TEMPO
-------------------------------------------------------------
CASH
TRANSFER
COD
CBD

    ↓
Invoice tetap disimpan di OutletReceipt
    ↓
TIDAK membuat PurchasePayable

IMPORTANT
-------------------------------------------------------------
- Invoice Supplier hanya WAJIB untuk TEMPO.
- CASH/COD/CBD/TRANSFER invoice boleh kosong.
- Jika invoice diisi pada non-TEMPO, invoice tetap disimpan.
- TEMPO membuat PurchasePayable jika belum ada.
- TEMPO menggunakan PurchasePayable existing jika sudah ada.
- CASH/TRANSFER/COD/CBD TIDAK membuat PurchasePayable.
- Transfer Outlet tidak menggunakan endpoint ini.
- Tidak menghapus data existing.
- Tidak membuat payable duplikat.
- Tidak mengubah paidAmount payable existing.
- PurchasePayable adalah source of truth hutang.
- OutletReceipt adalah source of truth dokumen penerimaan
  dan invoice supplier.
=============================================================
*/

/*
=============================================================
CURRENT LOGIN USER
=============================================================
*/

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session = cookieStore.get("erp-session");

  if (!session?.value) {
    return null;
  }

  let sessionData: any;

  try {
    sessionData = JSON.parse(session.value);
  } catch {
    return null;
  }

  /*
   * Support beberapa kemungkinan struktur session:
   *
   * data.user.id
   * data.data.user.id
   * data.data.id
   * data.id
   */

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
    where: {
      id: userId,
    },

    include: {
      outlet: true,
    },
  });

  if (!user || user.active === false) {
    return null;
  }

  return user;
}

/*
=============================================================
NORMALIZE MONEY
=============================================================
*/

function roundMoney(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return (
    Math.round((value + Number.EPSILON) * 100) / 100
  );
}

/*
=============================================================
NORMALIZE STRING
=============================================================
*/

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

/*
=============================================================
POST
=============================================================
*/

export async function POST(req: NextRequest) {
  try {
    /*
    =========================================================
    AUTH
    =========================================================
    */

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    /*
    =========================================================
    ROLE
    =========================================================
    */

    const allowedRoles = [
      "ADMIN",
      "MANAGER",
      "OUTLET_ADMIN",
    ];

    if (!allowedRoles.includes(String(user.role))) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses untuk menerima barang.",
        },
        {
          status: 403,
        }
      );
    }

    /*
    =========================================================
    BODY
    =========================================================
    */

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Request body tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    const purchaseId = Number(body?.purchaseId);

    /*
    =========================================================
    INVOICE SUPPLIER
    =========================================================
    *
    * Semua payment method boleh mengisi invoice.
    *
    * TEMPO:
    *   WAJIB.
    *
    * NON TEMPO:
    *   OPTIONAL.
    */

    const invoiceNumber = cleanString(
      body?.invoiceNumber
    );

    const remarksRaw = cleanString(body?.remarks);

    const remarks = remarksRaw || null;

    /*
    =========================================================
    VALIDATE PURCHASE ID
    =========================================================
    */

    if (
      !Number.isInteger(purchaseId) ||
      purchaseId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase ID tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =========================================================
    FIND PURCHASE
    =========================================================
    */

    const purchaseWhere: any = {
      id: purchaseId,
    };

    /*
    ---------------------------------------------------------
    OUTLET ADMIN
    ---------------------------------------------------------
    */

    if (String(user.role) === "OUTLET_ADMIN") {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet tidak memiliki outlet.",
          },
          {
            status: 403,
          }
        );
      }

      purchaseWhere.outletId = user.outletId;
    }

    const purchase =
      await prisma.outletPurchase.findFirst({
        where: purchaseWhere,

        include: {
          outlet: true,

          supplier: true,

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

    /*
    =========================================================
    PURCHASE NOT FOUND
    =========================================================
    */

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    /*
    =========================================================
    SECURITY
    =========================================================
    */

    if (
      String(user.role) === "OUTLET_ADMIN" &&
      purchase.outletId !== user.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses ke Purchase Outlet ini.",
        },
        {
          status: 403,
        }
      );
    }

    /*
    =========================================================
    OUTLET CHECK
    =========================================================
    */

    if (!purchase.outlet?.active) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet tujuan tidak aktif.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =========================================================
    STATUS CHECK
    =========================================================
    */

    if (purchase.status !== "APPROVED") {
      if (purchase.status === "RECEIVED") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase Outlet ini sudah pernah diterima.",
          },
          {
            status: 400,
          }
        );
      }

      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet harus berstatus APPROVED sebelum menerima barang.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =========================================================
    SUPPLIER CHECK
    =========================================================
    */

    if (!purchase.supplier) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Supplier Purchase Outlet tidak ditemukan.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =========================================================
    ITEM CHECK
    =========================================================
    */

    if (
      !purchase.items ||
      purchase.items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak memiliki item yang dapat diterima.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =========================================================
    PAYMENT METHOD
    =========================================================
    */

    const paymentMethod = String(
      purchase.paymentMethod
    )
      .trim()
      .toUpperCase();

    const supportedPaymentMethods = [
      "CASH",
      "TRANSFER",
      "COD",
      "CBD",
      "TEMPO",
    ];

    if (
      !supportedPaymentMethods.includes(
        paymentMethod
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Payment Method "${paymentMethod}" tidak didukung untuk proses penerimaan barang.`,
        },
        {
          status: 400,
        }
      );
    }

    const isTempo = paymentMethod === "TEMPO";

    /*
    =========================================================
    INVOICE VALIDATION
    =========================================================
    */

    if (isTempo && !invoiceNumber) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No. Invoice Supplier wajib diisi untuk Purchase dengan pembayaran TEMPO.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =========================================================
    VALIDATE ITEMS
    =========================================================
    */

    for (const item of purchase.items) {
      /*
      -------------------------------------------------------
      BARANG
      -------------------------------------------------------
      */

      if (!item.barang) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang pada item Purchase ID ${item.id} tidak ditemukan.`,
          },
          {
            status: 400,
          }
        );
      }

      /*
      -------------------------------------------------------
      CENTRAL ITEM
      -------------------------------------------------------
      */

      if (item.barang.source !== "CENTRAL") {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang "${item.barang.name}" bukan Barang Central. Purchase supplier outlet hanya boleh menggunakan Barang Central.`,
          },
          {
            status: 400,
          }
        );
      }

      /*
      -------------------------------------------------------
      QTY
      -------------------------------------------------------
      */

      const qty = Number(item.qty);

      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Qty barang "${item.barang.name}" harus lebih besar dari 0.`,
          },
          {
            status: 400,
          }
        );
      }

      /*
      -------------------------------------------------------
      PRICE
      -------------------------------------------------------
      */

      const price = Number(item.price);

      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Harga barang "${item.barang.name}" tidak valid.`,
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
    =========================================================
    RECEIVE DATE
    =========================================================
    */

    const receiptDate = new Date();

    /*
    =========================================================
    CALCULATE RECEIVED TOTAL
    =========================================================
    */

    const receivedTotalRaw =
      purchase.items.reduce(
        (sum, item) => {
          const qty = Number(item.qty);
          const price = Number(item.price);

          return sum + qty * price;
        },
        0
      );

    const receivedTotal =
      roundMoney(receivedTotalRaw);

    if (
      !Number.isFinite(receivedTotal) ||
      receivedTotal < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Total nilai barang yang diterima tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =========================================================
    DUE DATE
    =========================================================
    */

    let dueDate: Date | null = null;

    if (isTempo) {
      const tempoDays = Number(
        purchase.supplier.tempoDays ?? 0
      );

      if (
        !Number.isInteger(tempoDays) ||
        tempoDays < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Tempo Days supplier tidak valid.",
          },
          {
            status: 400,
          }
        );
      }

      dueDate = new Date(receiptDate);

      dueDate.setDate(
        dueDate.getDate() + tempoDays
      );
    }

    /*
    =========================================================
    TRANSACTION
    =========================================================
    */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
          ===================================================
          RELOAD PURCHASE
          ===================================================
          */

          const currentPurchase =
            await tx.outletPurchase.findUnique({
              where: {
                id: purchase.id,
              },

              include: {
                outlet: true,

                supplier: true,

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

          if (!currentPurchase) {
            throw new Error(
              "Purchase Outlet tidak ditemukan."
            );
          }

          /*
          ===================================================
          STATUS RECHECK
          ===================================================
          */

          if (
            currentPurchase.status !==
            "APPROVED"
          ) {
            throw new Error(
              currentPurchase.status ===
                "RECEIVED"
                ? "Purchase Outlet ini sudah pernah diterima."
                : "Purchase Outlet tidak lagi berstatus APPROVED."
            );
          }

          /*
          ===================================================
          OUTLET RECHECK
          ===================================================
          */

          if (
            String(user.role) ===
              "OUTLET_ADMIN" &&
            currentPurchase.outletId !==
              user.outletId
          ) {
            throw new Error(
              "Anda tidak memiliki akses ke Purchase Outlet ini."
            );
          }

          /*
          ===================================================
          ITEM RECHECK
          ===================================================
          */

          if (
            !currentPurchase.items ||
            currentPurchase.items.length === 0
          ) {
            throw new Error(
              "Purchase Outlet tidak memiliki item."
            );
          }

          /*
          ===================================================
          PAYMENT METHOD RECHECK
          ===================================================
          */

          const currentPaymentMethod =
            String(
              currentPurchase.paymentMethod
            )
              .trim()
              .toUpperCase();

          const currentIsTempo =
            currentPaymentMethod === "TEMPO";

          /*
          ===================================================
          INVOICE RECHECK
          ===================================================
          */

          if (
            currentIsTempo &&
            !invoiceNumber
          ) {
            throw new Error(
              "No. Invoice Supplier wajib diisi untuk Purchase dengan pembayaran TEMPO."
            );
          }

          /*
          ===================================================
          EXISTING RECEIPT CHECK
          ===================================================
          *
          * Satu Purchase hanya boleh memiliki satu receipt.
          */

          const existingReceipt =
            await tx.outletReceipt.findFirst({
              where: {
                purchaseId:
                  currentPurchase.id,
              },

              select: {
                id: true,
                number: true,
              },
            });

          if (existingReceipt) {
            throw new Error(
              `Purchase Outlet ini sudah memiliki dokumen penerimaan ${existingReceipt.number}.`
            );
          }

          /*
          ===================================================
          DUPLICATE INVOICE CHECK
          ===================================================
          */

          if (invoiceNumber) {
            const duplicateReceipt =
              await tx.outletReceipt.findFirst({
                where: {
                  supplierId:
                    currentPurchase.supplierId,

                  invoiceNumber:
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
              duplicateReceipt.purchaseId !==
                currentPurchase.id
            ) {
              throw new Error(
                `Invoice supplier "${invoiceNumber}" sudah digunakan pada penerimaan lain untuk supplier ini.`
              );
            }

            /*
            -------------------------------------------------
            DUPLICATE PAYABLE CHECK
            -------------------------------------------------
            *
            * Jika invoice sudah digunakan oleh payable
            * Purchase lain, tolak.
            *
            * Jika payable adalah milik Purchase yang sedang
            * diterima, itu VALID dan akan digunakan kembali.
            */

            if (currentIsTempo) {
              const duplicatePayable =
                await tx.purchasePayable.findFirst({
                  where: {
                    supplierId:
                      currentPurchase.supplierId,

                    invoiceNumber:
                      invoiceNumber,
                  },

                  select: {
                    id: true,
                    outletPurchaseId:
                      true,
                  },
                });

              if (
                duplicatePayable &&
                duplicatePayable.outletPurchaseId !==
                  currentPurchase.id
              ) {
                throw new Error(
                  `Invoice supplier "${invoiceNumber}" sudah digunakan pada Purchase Payable lain untuk supplier ini.`
                );
              }
            }
          }

          /*
          ===================================================
          RECEIPT NUMBER
          ===================================================
          */

          const receiptNumber =
            `OR-${Date.now()}-${currentPurchase.id}`;

          /*
          ===================================================
          RECEIPT TOTAL RECHECK
          ===================================================
          */

          const currentReceivedTotalRaw =
            currentPurchase.items.reduce(
              (sum, item) => {
                const qty =
                  Number(item.qty);

                const price =
                  Number(item.price);

                return (
                  sum +
                  qty * price
                );
              },
              0
            );

          const currentReceivedTotal =
            roundMoney(
              currentReceivedTotalRaw
            );

          if (
            !Number.isFinite(
              currentReceivedTotal
            ) ||
            currentReceivedTotal < 0
          ) {
            throw new Error(
              "Total nilai barang yang diterima tidak valid."
            );
          }

          /*
          ===================================================
          CREATE OUTLET RECEIPT
          ===================================================
          *
          * Invoice disimpan untuk SEMUA payment method.
          *
          * NULL:
          *   jika invoice kosong.
          *
          * VALUE:
          *   jika user mengisi invoice.
          */

          const receipt =
            await tx.outletReceipt.create({
              data: {
                number:
                  receiptNumber,

                purchaseId:
                  currentPurchase.id,

                outletId:
                  currentPurchase.outletId,

                supplierId:
                  currentPurchase.supplierId,

                invoiceNumber:
                  invoiceNumber || null,

                receiptDate,

                remarks:
                  remarks ||
                  currentPurchase.remarks ||
                  null,

                items: {
                  create:
                    currentPurchase.items.map(
                      (item) => {
                        const qty =
                          Number(
                            item.qty
                          );

                        const price =
                          Number(
                            item.price
                          );

                        const subtotal =
                          roundMoney(
                            qty * price
                          );

                        return {
                          barangId:
                            item.barangId,

                          qty,

                          price,

                          subtotal,
                        };
                      }
                    ),
                },
              },

              include: {
                items: true,
              },
            });

          /*
          ===================================================
          UPDATE OUTLET STOCK
          ===================================================
          */

          for (
            const item of
            currentPurchase.items
          ) {
            const qty =
              Number(item.qty);

            const price =
              Number(item.price);

            if (
              !Number.isFinite(qty) ||
              qty <= 0
            ) {
              throw new Error(
                `Qty barang "${item.barang?.name ?? item.barangId}" tidak valid.`
              );
            }

            if (
              !Number.isFinite(price) ||
              price < 0
            ) {
              throw new Error(
                `Harga barang "${item.barang?.name ?? item.barangId}" tidak valid.`
              );
            }

            /*
            -------------------------------------------------
            FIND OUTLET STOCK
            -------------------------------------------------
            */

            const existingStock =
              await tx.outletStock.findUnique({
                where: {
                  outletId_barangId: {
                    outletId:
                      currentPurchase.outletId,

                    barangId:
                      item.barangId,
                  },
                },
              });

            /*
            -------------------------------------------------
            CREATE STOCK
            -------------------------------------------------
            */

            if (!existingStock) {
              await tx.outletStock.create({
                data: {
                  outletId:
                    currentPurchase.outletId,

                  barangId:
                    item.barangId,

                  stock: qty,

                  minimumStock:
                    Number(
                      item.barang
                        .minimumStock ??
                        0
                    ),

                  averageCost:
                    price,
                },
              });
            }

            /*
            -------------------------------------------------
            UPDATE STOCK
            -------------------------------------------------
            */

            else {
              const oldStock =
                Number(
                  existingStock.stock
                ) || 0;

              const oldAverageCost =
                Number(
                  existingStock.averageCost
                ) || 0;

              const newStock =
                oldStock + qty;

              const newAverageCost =
                newStock > 0
                  ? (
                      oldStock *
                        oldAverageCost +
                      qty * price
                    ) / newStock
                  : price;

              await tx.outletStock.update({
                where: {
                  id:
                    existingStock.id,
                },

                data: {
                  stock:
                    newStock,

                  averageCost:
                    roundMoney(
                      newAverageCost
                    ),
                },
              });
            }

            /*
            -------------------------------------------------
            UPDATE RECEIVED QTY
            -------------------------------------------------
            */

            await tx.outletPurchaseItem.update({
              where: {
                id: item.id,
              },

              data: {
                receivedQty: qty,
              },
            });
          }

          /*
          ===================================================
          PURCHASE PAYABLE - TEMPO ONLY
          ===================================================
          */

          let payable = null;

          if (currentIsTempo) {
            /*
            =================================================
            FIND EXISTING PAYABLE
            =================================================
            *
            * Payable mungkin sudah dibuat sebelumnya.
            *
            * JANGAN throw error hanya karena payable sudah
            * ada untuk Purchase yang sama.
            *
            * JANGAN membuat payable kedua.
            */

            const existingPayable =
              await tx.purchasePayable.findUnique({
                where: {
                  outletPurchaseId:
                    currentPurchase.id,
                },
              });

            /*
            =================================================
            EXISTING PAYABLE
            =================================================
            */

            if (existingPayable) {
              /*
              ------------------------------------------------
              VALIDATE SUPPLIER
              ------------------------------------------------
              */

              if (
                existingPayable.supplierId !==
                currentPurchase.supplierId
              ) {
                throw new Error(
                  "Purchase Payable existing tidak sesuai dengan supplier Purchase Outlet ini."
                );
              }

              /*
              ------------------------------------------------
              VALIDATE OUTLET
              ------------------------------------------------
              */

              if (
                existingPayable.outletId !==
                currentPurchase.outletId
              ) {
                throw new Error(
                  "Purchase Payable existing tidak sesuai dengan outlet Purchase Outlet ini."
                );
              }

              /*
              ------------------------------------------------
              EXISTING INVOICE
              ------------------------------------------------
              */

              const existingInvoice =
                cleanString(
                  existingPayable.invoiceNumber
                );

              /*
              ------------------------------------------------
              INVOICE MUST MATCH
              ------------------------------------------------
              */

              if (
                existingInvoice &&
                invoiceNumber &&
                existingInvoice !==
                  invoiceNumber
              ) {
                throw new Error(
                  `Purchase Payable sudah menggunakan Invoice Supplier "${existingInvoice}", sedangkan invoice penerimaan adalah "${invoiceNumber}".`
                );
              }

              /*
              ------------------------------------------------
              FINAL INVOICE
              ------------------------------------------------
              */

              const finalInvoiceNumber =
                existingInvoice ||
                invoiceNumber;

              if (!finalInvoiceNumber) {
                throw new Error(
                  "Purchase Payable TEMPO tidak memiliki Invoice Supplier."
                );
              }

              /*
              ------------------------------------------------
              EXISTING AMOUNT
              ------------------------------------------------
              */

              const existingAmount =
                roundMoney(
                  Number(
                    existingPayable.amount
                  )
                );

              const existingPaidAmount =
                roundMoney(
                  Number(
                    existingPayable.paidAmount
                  )
                );

              if (
                !Number.isFinite(
                  existingAmount
                ) ||
                existingAmount < 0
              ) {
                throw new Error(
                  "Nilai Purchase Payable existing tidak valid."
                );
              }

              if (
                !Number.isFinite(
                  existingPaidAmount
                ) ||
                existingPaidAmount < 0
              ) {
                throw new Error(
                  "Nilai pembayaran Purchase Payable existing tidak valid."
                );
              }

              /*
              ------------------------------------------------
              AMOUNT CONSISTENCY
              ------------------------------------------------
              *
              * Jangan mengubah nominal payable existing
              * secara otomatis.
              *
              * Jika beda signifikan, hentikan transaksi
              * supaya histori hutang/pembayaran aman.
              */

              const amountDifference =
                Math.abs(
                  existingAmount -
                    currentReceivedTotal
                );

              if (
                amountDifference >
                0.01
              ) {
                throw new Error(
                  `Purchase Payable sudah ada dengan nilai Rp${existingAmount.toLocaleString(
                    "id-ID"
                  )}, sedangkan nilai penerimaan adalah Rp${currentReceivedTotal.toLocaleString(
                    "id-ID"
                  )}. Silakan periksa Purchase Payable sebelum menerima barang.`
                );
              }

              /*
              ------------------------------------------------
              RECALCULATE OUTSTANDING
              ------------------------------------------------
              *
              * paidAmount existing TIDAK disentuh.
              */

              const calculatedOutstanding =
                Math.max(
                  0,
                  roundMoney(
                    existingAmount -
                      existingPaidAmount
                  )
                );

              /*
              ------------------------------------------------
              STATUS
              ------------------------------------------------
              */

              const payableStatus =
                calculatedOutstanding <=
                0.01
                  ? "PAID"
                  : "OUTSTANDING";

              /*
              ------------------------------------------------
              UPDATE EXISTING PAYABLE
              ------------------------------------------------
              *
              * Hanya melengkapi data yang aman.
              *
              * paidAmount tetap.
              * amount tetap.
              */

              payable =
                await tx.purchasePayable.update({
                  where: {
                    id:
                      existingPayable.id,
                  },

                  data: {
                    invoiceNumber:
                      finalInvoiceNumber,

                    invoiceDate:
                      existingPayable.invoiceDate ??
                      receiptDate,

                    dueDate:
                      existingPayable.dueDate ??
                      dueDate,

                    amount:
                      existingPayable.amount,

                    paidAmount:
                      existingPaidAmount,

                    outstanding:
                      calculatedOutstanding,

                    status:
                      payableStatus,
                  },
                });
            }

            /*
            =================================================
            CREATE PAYABLE BARU
            =================================================
            *
            * Hanya jika belum ada.
            */

            else {
              payable =
                await tx.purchasePayable.create({
                  data: {
                    outletPurchaseId:
                      currentPurchase.id,

                    supplierId:
                      currentPurchase.supplierId,

                    outletId:
                      currentPurchase.outletId,

                    invoiceNumber:
                      invoiceNumber,

                    /*
                    ========================================
                    INVOICE DATE
                    ========================================
                    *
                    * Karena OutletReceipt belum memiliki
                    * invoiceDate, tanggal penerimaan digunakan
                    * sebagai tanggal invoice untuk payable.
                    */

                    invoiceDate:
                      receiptDate,

                    /*
                    ========================================
                    DUE DATE
                    ========================================
                    */

                    dueDate,

                    /*
                    ========================================
                    AMOUNT
                    ========================================
                    */

                    amount:
                      currentReceivedTotal,

                    paidAmount:
                      0,

                    outstanding:
                      currentReceivedTotal,

                    status:
                      "OUTSTANDING",
                  },
                });
            }
          }

          /*
          ===================================================
          UPDATE PURCHASE STATUS
          ===================================================
          */

          const updatedPurchase =
            await tx.outletPurchase.update({
              where: {
                id:
                  currentPurchase.id,
              },

              data: {
                status:
                  "RECEIVED",
              },
            });

          /*
          ===================================================
          RETURN TRANSACTION
          ===================================================
          */

          return {
            receipt,

            payable,

            purchase:
              updatedPurchase,

            paymentMethod:
              currentPaymentMethod,

            invoiceNumber:
              invoiceNumber ||
              null,

            receivedTotal:
              currentReceivedTotal,
          };
        }
      );

    /*
    =========================================================
    SUCCESS MESSAGE
    =========================================================
    */

    let successMessage =
      "Barang berhasil diterima.";

    if (result.payable) {
      successMessage =
        "Barang berhasil diterima dan Purchase Payable TEMPO berhasil dibuat.";
    } else if (result.invoiceNumber) {
      successMessage =
        "Barang berhasil diterima dan Invoice Supplier berhasil disimpan.";
    }

    /*
    =========================================================
    SUCCESS RESPONSE
    =========================================================
    */

    return NextResponse.json({
      success: true,

      message:
        successMessage,

      data: {
        receipt:
          result.receipt,

        payable:
          result.payable,

        purchase:
          result.purchase,

        paymentMethod:
          result.paymentMethod,

        invoiceNumber:
          result.invoiceNumber,

        receivedTotal:
          result.receivedTotal,
      },
    });
  } catch (error: any) {
    /*
    =========================================================
    ERROR LOG
    =========================================================
    */

    console.error(
      "OUTLET BARANG MASUK RECEIVE ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat menerima barang.";

    /*
    =========================================================
    RESPONSE
    =========================================================
    */

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 400,
      }
    );
  }
}