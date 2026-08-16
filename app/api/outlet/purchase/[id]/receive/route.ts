import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  OutletPurchaseStatus,
  Role,
} from "@prisma/client";
import { cookies } from "next/headers";

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
  // SESSION DATABASE
  // ===================================================

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

    userId = dbSession.user.id;
  } else {
    // =================================================
    // SESSION JSON
    // =================================================

    try {
      const parsed = JSON.parse(
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
// POST RECEIVE PURCHASE OUTLET
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
    // ID
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
    // CURRENT USER
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
    // SECURITY ROLE
    //
    // HANYA OUTLET_ADMIN
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
    // USER HARUS PUNYA OUTLET
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
    // AMBIL PURCHASE
    // =================================================

    const purchase =
      await prisma.outletPurchase.findUnique({
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
        },
      });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Order Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // SECURITY OUTLET
    //
    // ADMIN OUTLET HANYA BOLEH
    // MENERIMA PURCHASE MILIK OUTLET SENDIRI
    // =================================================

    if (
      purchase.outletId !==
      user.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Order ini bukan milik outlet Anda",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // STATUS HARUS APPROVED
    // =================================================

    if (
      purchase.status !==
      OutletPurchaseStatus.APPROVED
    ) {
      if (
        purchase.status ===
        OutletPurchaseStatus.RECEIVED
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase Order ini sudah diterima",
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
            `Purchase Order Outlet harus APPROVED sebelum diterima. Status saat ini: ${purchase.status}`,
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // HARUS ADA ITEM
    // =================================================

    if (
      !purchase.items ||
      purchase.items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Order Outlet tidak memiliki barang",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // CEK RECEIPT SEBELUM TRANSACTION
    // =================================================

    const existingReceipt =
      await prisma.outletReceipt.findFirst({
        where: {
          purchaseId: purchase.id,
        },

        select: {
          id: true,
          number: true,
        },
      });

    if (existingReceipt) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Purchase Order sudah diterima dengan nomor ${existingReceipt.number}`,
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // TRANSACTION
    // =================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // ===========================================
          // AMBIL ULANG PURCHASE
          //
          // Penting untuk mencegah race condition
          // ===========================================

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
                },
              },
            });

          if (!currentPurchase) {
            throw new Error(
              "Purchase Order Outlet tidak ditemukan"
            );
          }

          // ===========================================
          // CEK OUTLET ULANG
          // ===========================================

          if (
            currentPurchase.outletId !==
            user.outletId
          ) {
            throw new Error(
              "Purchase Order bukan milik outlet user"
            );
          }

          // ===========================================
          // CEK STATUS ULANG
          // ===========================================

          if (
            currentPurchase.status !==
            OutletPurchaseStatus.APPROVED
          ) {
            throw new Error(
              `Purchase Order sudah diproses. Status: ${currentPurchase.status}`
            );
          }

          // ===========================================
          // CEK RECEIPT ULANG
          // ===========================================

          const duplicateReceipt =
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

          if (duplicateReceipt) {
            throw new Error(
              `Purchase Order sudah diterima dengan nomor ${duplicateReceipt.number}`
            );
          }

          // ===========================================
          // VALIDASI ITEM ULANG
          // ===========================================

          if (
            currentPurchase.items.length ===
            0
          ) {
            throw new Error(
              "Purchase Order tidak memiliki barang"
            );
          }

          // ===========================================
          // NOMOR RECEIPT
          //
          // Gunakan ID sequence database.
          // Tetap aman dari bentrok karena create
          // berada dalam transaction.
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
          // CREATE RECEIPT
          // ===========================================

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

                remarks:
                  `Penerimaan ${currentPurchase.number}`,

                items: {
                  create:
                    currentPurchase.items.map(
                      (item) => ({
                        barangId:
                          item.barangId,

                        qty:
                          Number(
                            item.qty
                          ),

                        price:
                          Number(
                            item.price
                          ),

                        subtotal:
                          Number(
                            item.subtotal
                          ),
                      })
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

          for (const item of
            currentPurchase.items) {
            const qty =
              Number(item.qty);

            const price =
              Number(item.price);

            if (
              !Number.isFinite(qty) ||
              qty <= 0
            ) {
              throw new Error(
                `Qty barang ${item.barang.name} tidak valid`
              );
            }

            if (
              !Number.isFinite(price) ||
              price < 0
            ) {
              throw new Error(
                `Harga barang ${item.barang.name} tidak valid`
              );
            }

            // =========================================
            // STOCK OUTLET
            // =========================================

            const existingStock =
              await tx.outletStock.findUnique(
                {
                  where: {
                    outletId_barangId: {
                      outletId:
                        currentPurchase.outletId,

                      barangId:
                        item.barangId,
                    },
                  },
                }
              );

            if (existingStock) {
              const oldStock =
                Number(
                  existingStock.stock
                );

              const oldAverage =
                Number(
                  existingStock.averageCost
                );

              const newStock =
                oldStock + qty;

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
                    currentPurchase.outletId,

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
                id: item.id,
              },

              data: {
                receivedQty: qty,
              },
            });
          }

          // ===========================================
          // UPDATE PURCHASE -> RECEIVED
          // ===========================================

          const updatedPurchase =
            await tx.outletPurchase.update({
              where: {
                id:
                  currentPurchase.id,
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
              },
            });

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
                `Menerima Purchase Outlet ${currentPurchase.number} untuk outlet ${currentPurchase.outlet.name}`,

              userId:
                user.id,
            },
          });

          return {
            receipt,

            purchase:
              updatedPurchase,
          };
        }
      );

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json({
      success: true,

      message:
        "Barang berhasil diterima dan stok outlet bertambah",

      data: result,

      outlet: user.outlet,
    });
  } catch (error: any) {
    console.error(
      "RECEIVE OUTLET PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal menerima Purchase Order Outlet",
      },
      {
        status: 500,
      }
    );
  }
}