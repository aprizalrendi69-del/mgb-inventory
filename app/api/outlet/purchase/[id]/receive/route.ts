import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import {
  OutletPurchaseStatus,
  PaymentMethod,
  Role,
} from "@prisma/client";

import { cookies } from "next/headers";

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

// =====================================================
// GET CURRENT USER
// =====================================================

async function getCurrentUser() {
  const cookieStore = await cookies();

  const sessionCookie =
    cookieStore.get("session") ||
    cookieStore.get("erp-session");

  if (!sessionCookie) {
    return null;
  }

  let userId: number | null = null;

  // ===================================================
  // DATABASE SESSION
  // ===================================================

  try {
    const dbSession =
      await prisma.session.findUnique({
        where: {
          token: sessionCookie.value,
        },

        include: {
          user: {
            select: {
              id: true,
              fullname: true,
              role: true,
              active: true,
              outletId: true,

              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      });

    if (dbSession) {
      if (
        dbSession.expiresAt <
        new Date()
      ) {
        return null;
      }

      if (!dbSession.user.active) {
        return null;
      }

      userId = dbSession.user.id;
    }
  } catch (error) {
    console.error(
      "DATABASE SESSION CHECK ERROR:",
      error
    );
  }

  // ===================================================
  // SESSION JSON FALLBACK
  // ===================================================

  if (!userId) {
    try {
      const parsed =
        JSON.parse(
          sessionCookie.value
        );

      userId = Number(
        parsed?.user?.id ??
          parsed?.id ??
          0
      );
    } catch {
      return null;
    }
  }

  if (!userId) {
    return null;
  }

  // ===================================================
  // USER
  // ===================================================

  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        fullname: true,
        role: true,
        active: true,
        outletId: true,

        outlet: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

  if (!user || !user.active) {
    return null;
  }

  return user;
}

// =====================================================
// POST RECEIVE OUTLET PURCHASE
// =====================================================

export async function POST(
  req: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // =================================================
    // 1. PURCHASE ID
    // =================================================

    const { id } = await params;

    const purchaseId = Number(id);

    if (
      !Number.isInteger(purchaseId) ||
      purchaseId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Purchase Outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // 2. BODY
    // =================================================

    let body: any = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const invoiceNumberInput =
      typeof body?.invoiceNumber === "string"
        ? body.invoiceNumber.trim()
        : "";

    // =================================================
    // 3. CURRENT USER
    // =================================================

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Belum login",
        },
        {
          status: 401,
        }
      );
    }

    // =================================================
    // 4. SECURITY ROLE
    // =================================================

    if (
      user.role !== Role.OUTLET_ADMIN
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya Admin Outlet yang boleh menerima Purchase Outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // 5. USER HARUS PUNYA OUTLET
    // =================================================

    if (!user.outletId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User belum terhubung dengan outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // 6. TRANSACTION
    // =================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // ===========================================
          // AMBIL PURCHASE TERBARU
          // ===========================================

          const purchase =
            await tx.outletPurchase.findUnique({
              where: {
                id: purchaseId,
              },

              include: {
                outlet: true,

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
            throw new Error(
              "Purchase Order Outlet tidak ditemukan"
            );
          }

          // ===========================================
          // SECURITY OUTLET
          // ===========================================

          if (
            purchase.outletId !==
            user.outletId
          ) {
            throw new Error(
              "Purchase Order ini bukan milik outlet Anda"
            );
          }

          // ===========================================
          // STATUS
          // ===========================================

          if (
            purchase.status !==
            OutletPurchaseStatus.APPROVED
          ) {
            if (
              purchase.status ===
              OutletPurchaseStatus.RECEIVED
            ) {
              throw new Error(
                "Purchase Order ini sudah diterima"
              );
            }

            throw new Error(
              `Purchase Order Outlet harus APPROVED sebelum diterima. Status saat ini: ${purchase.status}`
            );
          }

          // ===========================================
          // ITEM
          // ===========================================

          if (
            !purchase.items ||
            purchase.items.length === 0
          ) {
            throw new Error(
              "Purchase Order Outlet tidak memiliki barang"
            );
          }

          // ===========================================
          // TIDAK BOLEH ADA RECEIPT SEBELUMNYA
          // ===========================================

          if (
            purchase.receipts &&
            purchase.receipts.length > 0
          ) {
            throw new Error(
              `Purchase Order sudah memiliki Receipt ${purchase.receipts[0].number}`
            );
          }

          // ===========================================
          // PAYMENT METHOD
          // ===========================================

          const paymentMethod =
            purchase.paymentMethod;

          const isTempo =
            paymentMethod ===
            PaymentMethod.TEMPO;

          // ===========================================
          // VALIDASI INVOICE
          //
          // HANYA TEMPO
          //
          // CASH / COD / CBD / TRANSFER
          // tidak membutuhkan invoice untuk payable.
          // ===========================================

          if (
            isTempo &&
            !invoiceNumberInput
          ) {
            throw new Error(
              "No. Invoice Supplier wajib diisi untuk Purchase Outlet dengan pembayaran TEMPO"
            );
          }

          // ===========================================
          // NORMALISASI INVOICE
          //
          // Invoice hanya digunakan untuk TEMPO.
          // ===========================================

          const invoiceNumber =
            isTempo
              ? invoiceNumberInput
              : null;

          // ===========================================
          // VALIDASI QTY
          //
          // TIDAK ADA PARTIAL RECEIPT
          // ===========================================

          for (
            const item of purchase.items
          ) {
            const qty =
              Number(item.qty);

            if (
              !Number.isFinite(qty) ||
              qty <= 0
            ) {
              throw new Error(
                `Qty barang ${item.barang.name} tidak valid`
              );
            }

            const existingReceived =
              Number(
                item.receivedQty ?? 0
              );

            if (
              existingReceived > 0
            ) {
              throw new Error(
                `Barang ${item.barang.name} sudah memiliki receivedQty`
              );
            }

            if (!item.barang) {
              throw new Error(
                `Barang ID ${item.barangId} tidak ditemukan`
              );
            }
          }

          // ===========================================
          // RECEIPT NUMBER
          // ===========================================

          const lastReceipt =
            await tx.outletReceipt.findFirst({
              orderBy: {
                id: "desc",
              },

              select: {
                id: true,
              },
            });

          const nextNumber =
            (lastReceipt?.id ?? 0) + 1;

          const receiptNumber =
            `OR-${String(
              nextNumber
            ).padStart(5, "0")}`;

          // ===========================================
          // RECEIPT DATE
          //
          // Untuk TEMPO:
          // tanggal ini menjadi tanggal mulai tempo.
          // ===========================================

          const receiptDate =
            new Date();

          // ===========================================
          // CREATE RECEIPT
          // ===========================================

          const receipt =
            await tx.outletReceipt.create({
              data: {
                number:
                  receiptNumber,

                purchaseId:
                  purchase.id,

                outletId:
                  purchase.outletId,

                supplierId:
                  purchase.supplierId,

                receiptDate,

                remarks:
                  `Penerimaan ${purchase.number}`,

                items: {
                  create:
                    purchase.items.map(
                      (item) => {
                        const qty =
                          roundQty(
                            Number(
                              item.qty
                            )
                          );

                        const price =
                          roundMoney(
                            Number(
                              item.price ??
                                0
                            )
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
                outlet: true,

                supplier: true,

                items: {
                  include: {
                    barang: true,
                  },
                },
              },
            });

          // ===========================================
          // UPDATE STOCK OUTLET
          // ===========================================

          for (
            const item of purchase.items
          ) {
            const qty =
              roundQty(
                Number(item.qty)
              );

            const price =
              roundMoney(
                Number(
                  item.price ?? 0
                )
              );

            // =========================================
            // BARANG
            // =========================================

            if (!item.barang) {
              throw new Error(
                `Barang ID ${item.barangId} tidak ditemukan`
              );
            }

            // =========================================
            // OUTLET STOCK
            // =========================================

            const existingStock =
              await tx.outletStock.findUnique(
                {
                  where: {
                    outletId_barangId: {
                      outletId:
                        purchase.outletId,

                      barangId:
                        item.barangId,
                    },
                  },
                }
              );

            if (existingStock) {
              const oldStock =
                roundQty(
                  Number(
                    existingStock.stock ??
                      0
                  )
                );

              const oldAverage =
                Number(
                  existingStock.averageCost ??
                    0
                );

              const newStock =
                roundQty(
                  oldStock + qty
                );

              const newAverage =
                newStock > 0
                  ? (
                      oldStock *
                        oldAverage +
                      qty *
                        price
                    ) /
                    newStock
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
                    newAverage,
                },
              });
            } else {
              await tx.outletStock.create({
                data: {
                  outletId:
                    purchase.outletId,

                  barangId:
                    item.barangId,

                  stock:
                    qty,

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

            // =========================================
            // RECEIVED QTY
            // =========================================

            await tx.outletPurchaseItem.update({
              where: {
                id:
                  item.id,
              },

              data: {
                receivedQty:
                  qty,
              },
            });

            // =========================================
            // STOCK MUTATION
            // =========================================

            const outletStockAfter =
              await tx.outletStock.findUnique({
                where: {
                  outletId_barangId: {
                    outletId:
                      purchase.outletId,

                    barangId:
                      item.barangId,
                  },
                },

                select: {
                  stock: true,
                },
              });

            const stockAfter =
              roundQty(
                Number(
                  outletStockAfter?.stock ??
                    qty
                )
              );

            const stockBefore =
              roundQty(
                stockAfter - qty
              );

            await tx.stockMutation.create({
              data: {
                outletId:
                  purchase.outletId,

                barangId:
                  item.barangId,

                type:
                  "OUTLET_RECEIPT",

                qty,

                stockBefore,

                stockAfter,

                reference:
                  receipt.number,

                description:
                  `Penerimaan ${purchase.number}`,
              },
            });
          }

          // ===========================================
          // PURCHASE -> RECEIVED
          // ===========================================

          const updatedPurchase =
            await tx.outletPurchase.update({
              where: {
                id:
                  purchase.id,
              },

              data: {
                status:
                  OutletPurchaseStatus.RECEIVED,
              },

              include: {
                outlet: true,

                supplier: true,

                items: {
                  include: {
                    barang: true,
                  },
                },

                payable: true,
              },
            });

          // ===========================================
          // PURCHASE PAYABLE
          //
          // HANYA TEMPO
          //
          // PAYABLE DIBUAT SAAT RECEIPT
          //
          // BUKAN SAAT APPROVE
          // ===========================================

          let payable = null;

          if (isTempo) {
            // =========================================
            // SAFETY CHECK
            // =========================================

            if (purchase.payable) {
              throw new Error(
                "Purchase Payable untuk Purchase Outlet ini sudah ada"
              );
            }

            // =========================================
            // SUPPLIER TEMPO DAYS
            // =========================================

            const tempoDays =
              Math.max(
                0,
                Number(
                  purchase.supplier?.tempoDays ??
                    0
                )
              );

            if (
              !Number.isFinite(
                tempoDays
              )
            ) {
              throw new Error(
                "Tempo Days supplier tidak valid"
              );
            }

            // =========================================
            // DUE DATE
            //
            // receiptDate + tempoDays
            // =========================================

            const dueDate =
              addDays(
                receiptDate,
                tempoDays
              );

            // =========================================
            // TOTAL PAYABLE
            //
            // Menggunakan total Purchase.
            // =========================================

            const amount =
              roundMoney(
                Number(
                  purchase.total ?? 0
                )
              );

            if (
              !Number.isFinite(
                amount
              ) ||
              amount <= 0
            ) {
              throw new Error(
                "Total Purchase Payable tidak valid"
              );
            }

            // =========================================
            // CREATE PAYABLE
            //
            // INVOICE MANUAL DARI USER
            // =========================================

            payable =
              await tx.purchasePayable.create({
                data: {
                  purchaseId:
                    null,

                  outletPurchaseId:
                    purchase.id,

                  supplierId:
                    purchase.supplierId,

                  outletId:
                    purchase.outletId,

                  invoiceNumber:
                    invoiceNumber!,

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
          }

          // ===========================================
          // HISTORY
          // ===========================================

          await tx.history.create({
            data: {
              transactionType:
                "RECEIPT",

              referenceNumber:
                receipt.number,

              description:
                `Menerima Purchase Outlet ${purchase.number} untuk outlet ${purchase.outlet.name}`,

              userId:
                user.id,
            },
          });

          // ===========================================
          // RETURN
          // ===========================================

          return {
            receipt,

            purchase:
              updatedPurchase,

            payable,

            receiptDate,

            dueDate:
              payable?.dueDate ??
              null,
          };
        },
        {
          maxWait: 10000,
          timeout: 20000,
        }
      );

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json({
      success: true,

      message:
        result.payable
          ? "Barang berhasil diterima, stok outlet bertambah, dan Purchase Payable berhasil dibuat."
          : "Barang berhasil diterima dan stok outlet bertambah.",

      data: result,

      outlet: user.outlet,
    });
  } catch (error: any) {
    console.error(
      "RECEIVE OUTLET PURCHASE ERROR:",
      error
    );

    const message =
      error?.message ||
      "Gagal menerima Purchase Order Outlet";

    let status = 500;

    if (
      message.includes(
        "tidak valid"
      ) ||
      message.includes(
        "wajib diisi"
      ) ||
      message.includes(
        "sudah"
      ) ||
      message.includes(
        "bukan milik"
      ) ||
      message.includes(
        "harus APPROVED"
      ) ||
      message.includes(
        "sudah memiliki"
      )
    ) {
      status = 400;
    }

    if (
      message.includes(
        "tidak ditemukan"
      )
    ) {
      status = 404;
    }

    if (
      message.includes(
        "Hanya Admin Outlet"
      )
    ) {
      status = 403;
    }

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status,
      }
    );
  }
}