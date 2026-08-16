import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// =====================================================
// CURRENT USER
// =====================================================

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session =
    cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  let sessionData: any;

  try {
    sessionData = JSON.parse(
      session.value
    );
  } catch {
    return null;
  }

  const userId = Number(
    sessionData?.id ??
      sessionData?.user?.id
  );

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return null;
  }

  return await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      username: true,
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
}

// =====================================================
// HELPERS
// =====================================================

function unauthorized(
  message = "Tidak login"
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status: 401,
    }
  );
}

function forbidden(
  message = "Anda tidak memiliki akses"
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status: 403,
    }
  );
}

// =====================================================
// RECEIVE OUTLET PURCHASE
//
// ALUR:
//
// OUTLET PURCHASE
//      ↓
// APPROVED
//      ↓
// RECEIVE
//      ↓
// OutletReceipt
//      ↓
// OutletStock
//      ↓
// Purchase = RECEIVED
//
// SECURITY:
//
// ADMIN
// -> boleh receive semua outlet
//
// MANAGER
// -> boleh receive semua outlet
//
// OUTLET_ADMIN
// -> hanya purchase outlet sendiri
//
// TIDAK PERNAH:
// -> menggunakan outletId dari frontend
// -> mengubah Barang.stock pusat
// =====================================================

export async function POST(
  req: Request
) {
  try {
    // ===================================================
    // 1. SESSION
    // ===================================================

    const user =
      await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    // ===================================================
    // 2. USER AKTIF
    // ===================================================

    if (!user.active) {
      return forbidden(
        "User tidak aktif"
      );
    }

    // ===================================================
    // 3. ROLE
    // ===================================================

    const role =
      String(
        user.role || ""
      ).toUpperCase();

    if (
      role !== "ADMIN" &&
      role !== "MANAGER" &&
      role !== "OUTLET_ADMIN"
    ) {
      return forbidden();
    }

    // ===================================================
    // 4. BODY
    // ===================================================

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Body request tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const purchaseId =
      Number(
        body?.purchaseId
      );

    const remarks =
      typeof body?.remarks ===
      "string"
        ? body.remarks.trim() ||
          null
        : null;

    // ---------------------------------------------------
    // purchaseId harus integer
    // ---------------------------------------------------

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
            "Purchase Outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 5. AMBIL PURCHASE
    // ===================================================
    //
    // PENTING:
    //
    // Untuk OUTLET_ADMIN kita langsung tambahkan:
    //
    // outletId = user.outletId
    //
    // Jadi purchase outlet lain tidak pernah
    // berhasil ditemukan.
    //
    // ===================================================

    const purchaseWhere: any = {
      id: purchaseId,
    };

    if (
      role === "OUTLET_ADMIN"
    ) {
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
              "User outlet belum terhubung dengan outlet",
          },
          {
            status: 400,
          }
        );
      }

      purchaseWhere.outletId =
        user.outletId;
    }

    const purchase =
      await prisma.outletPurchase.findFirst(
        {
          where: purchaseWhere,

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

    // ===================================================
    // 6. PURCHASE TIDAK DITEMUKAN
    // ===================================================

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak ditemukan atau bukan milik outlet Anda",
        },
        {
          status: 404,
        }
      );
    }

    // ===================================================
    // 7. VALIDASI OUTLET
    // ===================================================

    if (!purchase.outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet Purchase tidak ditemukan",
        },
        {
          status: 400,
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
            "Outlet tidak aktif",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 8. DOUBLE SECURITY OUTLET
    // ===================================================
    //
    // Walaupun query sudah difilter,
    // kita cek lagi sebelum transaksi.
    //
    // ===================================================

    if (
      role === "OUTLET_ADMIN" &&
      purchase.outletId !==
        user.outletId
    ) {
      return forbidden(
        "Purchase bukan milik outlet Anda"
      );
    }

    // ===================================================
    // 9. STATUS
    // ===================================================

    if (
      purchase.status !==
      "APPROVED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet harus berstatus APPROVED untuk diterima",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 10. ITEM
    // ===================================================

    if (
      !purchase.items.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak memiliki barang",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 11. VALIDASI SEMUA BARANG
    // ===================================================

    for (
      const item of purchase.items
    ) {
      // -------------------------------------------------
      // Barang harus ada
      // -------------------------------------------------

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

      // -------------------------------------------------
      // Barang harus dari CENTRAL
      // -------------------------------------------------

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

      // -------------------------------------------------
      // Qty harus positif
      // -------------------------------------------------

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

      // -------------------------------------------------
      // Harga tidak boleh negatif
      // -------------------------------------------------

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

    // ===================================================
    // 12. TRANSACTION
    // ===================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // =============================================
          // LOCK LOGICAL STATUS
          //
          // Ambil ulang purchase di dalam transaction.
          //
          // Ini penting untuk mencegah receive kedua
          // ketika request masuk hampir bersamaan.
          // =============================================

          const currentPurchase =
            await tx.outletPurchase.findUnique(
              {
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
              }
            );

          if (!currentPurchase) {
            throw new Error(
              "Purchase Outlet tidak ditemukan"
            );
          }

          // =============================================
          // CEK STATUS ULANG
          // =============================================

          if (
            currentPurchase.status !==
            "APPROVED"
          ) {
            throw new Error(
              "Purchase Outlet sudah diproses atau tidak berstatus APPROVED"
            );
          }

          // =============================================
          // CEK OUTLET ULANG
          // =============================================

          if (
            role ===
              "OUTLET_ADMIN" &&
            currentPurchase.outletId !==
              user.outletId
          ) {
            throw new Error(
              "Purchase bukan milik outlet Anda"
            );
          }

          if (
            !currentPurchase.outlet
              ?.active
          ) {
            throw new Error(
              "Outlet tidak aktif"
            );
          }

          // =============================================
          // RECEIPT NUMBER
          // =============================================

          const receiptNumber =
            `OR-${Date.now()}-${currentPurchase.id}`;

          // =============================================
          // CREATE RECEIPT
          // =============================================

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

                  remarks,

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
                              item.qty
                            ) *
                            Number(
                              item.price
                            ),
                        })
                      ),
                  },
                },

                include: {
                  items: true,
                },
              }
            );

          // =============================================
          // UPDATE OUTLET STOCK
          // =============================================

          for (
            const item of
              currentPurchase.items
          ) {
            const qty =
              Number(item.qty);

            const price =
              Number(item.price);

            // -------------------------------------------
            // Pastikan barang masih CENTRAL
            // -------------------------------------------

            if (
              !item.barang ||
              item.barang.source !==
                "CENTRAL"
            ) {
              throw new Error(
                `Barang ${item.barang?.name || item.barangId} bukan barang Central`
              );
            }

            // -------------------------------------------
            // Cari stock outlet
            // -------------------------------------------

            const currentStock =
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

            // -------------------------------------------
            // Jika belum ada OutletStock
            // -------------------------------------------

            if (!currentStock) {
              await tx.outletStock.create(
                {
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
                }
              );
            }

            // -------------------------------------------
            // Jika sudah ada OutletStock
            // -------------------------------------------

            else {
              const oldStock =
                Number(
                  currentStock.stock ??
                    0
                );

              const oldAverageCost =
                Number(
                  currentStock.averageCost ??
                    0
                );

              const newStock =
                oldStock + qty;

              let newAverageCost =
                oldAverageCost;

              if (
                newStock > 0
              ) {
                newAverageCost =
                  (
                    oldStock *
                      oldAverageCost +
                    qty * price
                  ) /
                  newStock;
              }

              await tx.outletStock.update(
                {
                  where: {
                    id:
                      currentStock.id,
                  },

                  data: {
                    stock:
                      newStock,

                    averageCost:
                      newAverageCost,
                  },
                }
              );
            }

            // -------------------------------------------
            // UPDATE RECEIVED QTY
            // -------------------------------------------

            await tx.outletPurchaseItem.update(
              {
                where: {
                  id: item.id,
                },

                data: {
                  receivedQty:
                    qty,
                },
              }
            );
          }

          // =============================================
          // UPDATE PURCHASE STATUS
          // =============================================

          const updatedPurchase =
            await tx.outletPurchase.update(
              {
                where: {
                  id:
                    currentPurchase.id,
                },

                data: {
                  status:
                    "RECEIVED",
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

          return {
            receipt,
            purchase:
              updatedPurchase,
          };
        }
      );

    // ===================================================
    // 13. RESPONSE
    // ===================================================

    return NextResponse.json({
      success: true,

      message:
        "Barang outlet berhasil diterima",

      data: result,
    });
  } catch (error: any) {
    console.error(
      "RECEIVE OUTLET BARANG ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal menerima barang outlet",
      },
      {
        status: 500,
      }
    );
  }
}