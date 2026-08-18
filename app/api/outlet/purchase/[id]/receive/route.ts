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
                active: true,
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

    userId =
      dbSession.user.id;
  } else {
    // =================================================
    // SESSION JSON
    // =================================================

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

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
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
            active: true,
          },
        },
      },
    });

  if (
    !user ||
    !user.active
  ) {
    return null;
  }

  return user;
}

// =====================================================
// POST RECEIVE PURCHASE OUTLET
//
// ALUR:
//
// PURCHASE OUTLET
// APPROVED
//      ↓
// OUTLET ADMIN RECEIVE
//      ↓
// VALIDASI BARANG CENTRAL
//      ↓
// VALIDASI OUTLET BARANG
//      ↓
// OUTLET STOCK + QTY
//      ↓
// OUTLET RECEIPT
//      ↓
// PURCHASE RECEIVED
//      ↓
// HISTORY
//
// SECURITY:
//
// OUTLET_ADMIN
// -> hanya outlet sendiri
//
// TIDAK BOLEH:
// -> menerima Purchase outlet lain
// -> menerima barang non-CENTRAL
// -> menerima barang yang tidak terdaftar
//    di OutletBarang
// -> menerima barang OutletBarang yang nonaktif
// -> mengubah Barang.stock pusat
// -> membuat receipt dua kali
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
    // 1. PARAMETER
    // =================================================

    const { id } =
      await params;

    const purchaseId =
      Number(id);

    if (
      !Number.isInteger(
        purchaseId
      ) ||
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
    // 2. CURRENT USER
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
    // 3. ROLE
    //
    // HANYA OUTLET_ADMIN
    // =================================================

    if (
      user.role !==
      Role.OUTLET_ADMIN
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
    // 4. USER HARUS PUNYA OUTLET
    // =================================================

    if (
      !user.outletId ||
      !Number.isInteger(
        user.outletId
      ) ||
      user.outletId <= 0
    ) {
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
    // 5. AMBIL PURCHASE
    // =================================================

    const purchase =
      await prisma.outletPurchase.findUnique(
        {
          where: {
            id: purchaseId,
          },

          include: {
            outlet: {
              select: {
                id: true,
                code: true,
                name: true,
                active: true,
              },
            },

            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },

            items: {
              include: {
                barang: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    category: true,
                    unit: true,
                    purchasePrice: true,
                    sellingPrice: true,
                    minimumStock: true,
                    source: true,
                  },
                },
              },
            },
          },
        }
      );

    // =================================================
    // 6. PURCHASE TIDAK DITEMUKAN
    // =================================================

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
    // 7. SECURITY OUTLET
    //
    // Admin Outlet hanya boleh menerima
    // Purchase milik outlet sendiri.
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
    // 8. OUTLET HARUS ADA DAN AKTIF
    // =================================================

    if (!purchase.outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tujuan tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (
      !purchase.outlet.active
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tujuan tidak aktif",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // 9. STATUS PURCHASE
    // =================================================

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

    if (
      purchase.status !==
      OutletPurchaseStatus.APPROVED
    ) {
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
    // 10. HARUS ADA ITEM
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
    // 11. VALIDASI BARANG SEBELUM TRANSACTION
    // =================================================

    for (const item of purchase.items) {
      // -----------------------------------------------
      // Barang harus ada
      // -----------------------------------------------

      if (!item.barang) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ID ${item.barangId} tidak ditemukan`,
          },
          {
            status: 400,
          }
        );
      }

      // -----------------------------------------------
      // Barang wajib CENTRAL
      // -----------------------------------------------

      if (
        item.barang.source !==
        "CENTRAL"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ${item.barang.name} bukan berasal dari Master Barang Pusat`,
          },
          {
            status: 400,
          }
        );
      }

      // -----------------------------------------------
      // Qty
      // -----------------------------------------------

      const qty =
        Number(item.qty);

      if (
        !Number.isFinite(qty) ||
        qty <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Qty barang ${item.barang.name} tidak valid`,
          },
          {
            status: 400,
          }
        );
      }

      // -----------------------------------------------
      // Harga
      // -----------------------------------------------

      const price =
        Number(item.price);

      if (
        !Number.isFinite(price) ||
        price < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Harga barang ${item.barang.name} tidak valid`,
          },
          {
            status: 400,
          }
        );
      }
    }

    // =================================================
    // 12. CEK OUTLET BARANG
    //
    // Barang harus sudah terdaftar di Master
    // Barang Outlet dan harus aktif.
    // =================================================

    for (const item of purchase.items) {
      const outletBarang =
        await prisma.outletBarang.findUnique(
          {
            where: {
              outletId_barangId: {
                outletId:
                  purchase.outletId,

                barangId:
                  item.barangId,
              },
            },

            select: {
              id: true,
              aktif: true,
            },
          }
        );

      if (!outletBarang) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ${item.barang?.name} belum terdaftar di Master Barang Outlet`,
          },
          {
            status: 400,
          }
        );
      }

      if (
        !outletBarang.aktif
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ${item.barang?.name} sedang tidak aktif di outlet`,
          },
          {
            status: 400,
          }
        );
      }
    }

    // =================================================
    // 13. CEK RECEIPT DUPLIKAT
    // =================================================

    const existingReceipt =
      await prisma.outletReceipt.findFirst(
        {
          where: {
            purchaseId:
              purchase.id,
          },

          select: {
            id: true,
            number: true,
          },
        }
      );

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
    // 14. TRANSACTION
    // =================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // ===========================================
          // AMBIL ULANG PURCHASE
          // ===========================================

          const currentPurchase =
            await tx.outletPurchase.findUnique(
              {
                where: {
                  id:
                    purchase.id,
                },

                include: {
                  outlet: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      active: true,
                    },
                  },

                  supplier: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                    },
                  },

                  items: {
                    include: {
                      barang: {
                        select: {
                          id: true,
                          code: true,
                          name: true,
                          category: true,
                          unit: true,
                          purchasePrice: true,
                          sellingPrice: true,
                          minimumStock: true,
                          source: true,
                        },
                      },
                    },
                  },
                },
              }
            );

          if (!currentPurchase) {
            throw new Error(
              "Purchase Order Outlet tidak ditemukan"
            );
          }

          // ===========================================
          // SECURITY OUTLET ULANG
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
          // OUTLET AKTIF
          // ===========================================

          if (
            !currentPurchase.outlet ||
            !currentPurchase
              .outlet.active
          ) {
            throw new Error(
              "Outlet tujuan tidak aktif"
            );
          }

          // ===========================================
          // STATUS ULANG
          // ===========================================

          if (
            currentPurchase.status !==
            OutletPurchaseStatus.APPROVED
          ) {
            if (
              currentPurchase.status ===
              OutletPurchaseStatus.RECEIVED
            ) {
              throw new Error(
                "Purchase Order ini sudah diterima"
              );
            }

            throw new Error(
              `Purchase Order harus APPROVED. Status saat ini: ${currentPurchase.status}`
            );
          }

          // ===========================================
          // ITEM HARUS ADA
          // ===========================================

          if (
            currentPurchase.items
              .length === 0
          ) {
            throw new Error(
              "Purchase Order tidak memiliki barang"
            );
          }

          // ===========================================
          // CEK RECEIPT DUPLIKAT ULANG
          // ===========================================

          const duplicateReceipt =
            await tx.outletReceipt.findFirst(
              {
                where: {
                  purchaseId:
                    currentPurchase.id,
                },

                select: {
                  id: true,
                  number: true,
                },
              }
            );

          if (duplicateReceipt) {
            throw new Error(
              `Purchase Order sudah diterima dengan nomor ${duplicateReceipt.number}`
            );
          }

          // ===========================================
          // VALIDASI SEMUA ITEM
          // ===========================================

          for (const item of currentPurchase.items) {
            if (!item.barang) {
              throw new Error(
                `Barang ID ${item.barangId} tidak ditemukan`
              );
            }

            // -----------------------------------------
            // HARUS CENTRAL
            // -----------------------------------------

            if (
              item.barang.source !==
              "CENTRAL"
            ) {
              throw new Error(
                `Barang ${item.barang.name} bukan berasal dari Master Barang Pusat`
              );
            }

            // -----------------------------------------
            // QTY
            // -----------------------------------------

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

            // -----------------------------------------
            // PRICE
            // -----------------------------------------

            const price =
              Number(item.price);

            if (
              !Number.isFinite(price) ||
              price < 0
            ) {
              throw new Error(
                `Harga barang ${item.barang.name} tidak valid`
              );
            }

            // -----------------------------------------
            // OUTLET BARANG
            // -----------------------------------------

            const outletBarang =
              await tx.outletBarang.findUnique(
                {
                  where: {
                    outletId_barangId: {
                      outletId:
                        currentPurchase.outletId,

                      barangId:
                        item.barangId,
                    },
                  },

                  select: {
                    id: true,
                    aktif: true,
                  },
                }
              );

            if (!outletBarang) {
              throw new Error(
                `Barang ${item.barang.name} belum terdaftar di Master Barang Outlet`
              );
            }

            if (
              !outletBarang.aktif
            ) {
              throw new Error(
                `Barang ${item.barang.name} sedang tidak aktif di outlet`
              );
            }
          }

          // ===========================================
          // NOMOR RECEIPT
          //
          // Ambil sequence terakhir.
          // Jika bentrok karena concurrent request,
          // unique constraint akan menggagalkan transaction.
          // ===========================================

          const lastReceipt =
            await tx.outletReceipt.findFirst(
              {
                orderBy: {
                  id: "desc",
                },

                select: {
                  id: true,
                },
              }
            );

          const nextNumber =
            (lastReceipt?.id ??
              0) + 1;

          const receiptNumber =
            `OR-${String(
              nextNumber
            ).padStart(5, "0")}`;

          // ===========================================
          // CREATE RECEIPT
          // ===========================================

          const receipt =
            await tx.outletReceipt.create(
              {
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
                              item.subtotal ??
                                Number(
                                  item.qty
                                ) *
                                  Number(
                                    item.price
                                  )
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
              }
            );

          // ===========================================
          // UPDATE STOCK OUTLET
          //
          // PENTING:
          // TIDAK ADA UPDATE Barang.stock
          // ===========================================

          for (const item of currentPurchase.items) {
            const qty =
              Number(item.qty);

            const price =
              Number(item.price);

            // =========================================
            // CARI STOCK OUTLET
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

            // =========================================
            // STOCK SUDAH ADA
            // =========================================

            if (existingStock) {
              const oldStock =
                Number(
                  existingStock.stock ??
                    0
                );

              const oldAverage =
                Number(
                  existingStock.averageCost ??
                    0
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

              await tx.outletStock.update(
                {
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
                }
              );
            }

            // =========================================
            // STOCK BELUM ADA
            // =========================================

            else {
              await tx.outletStock.create(
                {
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
                          ?.minimumStock ??
                          0
                      ),

                    averageCost:
                      price,
                  },
                }
              );
            }

            // =========================================
            // UPDATE RECEIVED QTY
            // =========================================

            await tx.outletPurchaseItem.update(
              {
                where: {
                  id:
                    item.id,
                },

                data: {
                  receivedQty:
                    qty,
                },
              }
            );
          }

          // ===========================================
          // PURCHASE -> RECEIVED
          // ===========================================

          const updatedPurchase =
            await tx.outletPurchase.update(
              {
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
              }
            );

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

          // ===========================================
          // RETURN
          // ===========================================

          return {
            receipt,

            purchase:
              updatedPurchase,
          };
        }
      );

    // =================================================
    // 15. RESPONSE
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