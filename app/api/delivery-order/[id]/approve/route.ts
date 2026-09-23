import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  DeliveryStatus,
  DeliveryRequestStatus,
  OutletTransferStatus,
  HistoryType,
} from "@prisma/client";

// ============================================================
// TYPES
// ============================================================

type SessionUser = {
  id: number;
  username: string;
  fullname: string;
  role: string;
  active: boolean;
  outletId: number | null;
};

// ============================================================
// CURRENT USER
// ============================================================

async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();

  const sessionCookie =
    cookieStore.get("erp-session") ??
    cookieStore.get("session");

  if (!sessionCookie?.value) {
    return null;
  }

  // ----------------------------------------------------------
  // TRY DB SESSION
  // ----------------------------------------------------------

  try {
    const sessionData = JSON.parse(
      sessionCookie.value
    );

    const userId = Number(
      sessionData?.user?.id ??
        sessionData?.data?.user?.id ??
        sessionData?.data?.id ??
        sessionData?.id
    );

    if (
      Number.isInteger(userId) &&
      userId > 0
    ) {
      const user =
        await prisma.user.findUnique({
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
          },
        });

      if (user) {
        return {
          id: user.id,
          username: user.username,
          fullname: user.fullname,
          role: String(user.role ?? ""),
          active: Boolean(user.active),
          outletId:
            user.outletId ?? null,
        };
      }
    }
  } catch {
    // lanjut ke fallback JSON
  }

  // ----------------------------------------------------------
  // FALLBACK JSON SESSION
  // ----------------------------------------------------------

  try {
    const parsed = JSON.parse(
      sessionCookie.value
    );

    const rawUser =
      parsed?.user ??
      parsed?.data?.user ??
      parsed?.data ??
      parsed;

    const userId = Number(
      rawUser?.id
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return null;
    }

    return {
      id: userId,
      username:
        String(
          rawUser?.username ?? ""
        ),
      fullname:
        String(
          rawUser?.fullname ?? ""
        ),
      role:
        String(
          rawUser?.role ?? ""
        ),
      active:
        rawUser?.active !== false,
      outletId:
        rawUser?.outletId != null
          ? Number(
              rawUser.outletId
            )
          : null,
    };
  } catch {
    return null;
  }
}

// ============================================================
// RESPONSE HELPERS
// ============================================================

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

function badRequest(
  message: string
) {
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

// ============================================================
// POST
//
// FLOW:
//
// DRAFT DELIVERY
//      ↓
// RELEASE
//      ↓
// VALIDATE STOCK
//      ↓
// BARANG.STOCK PUSAT BERKURANG
//      ↓
// STOCK CARD OUT
//      ↓
// STOCK MUTATION OUT
//      ↓
// DELIVERY = RELEASED
//      ↓
// SURAT JALAN
//      ↓
// OUTLET TRANSFER = SENT
//      ↓
// JIKA ASAL DELIVERY REQUEST
// DELIVERY REQUEST = COMPLETED
//
// IMPORTANT:
//
// - TIDAK menambah OutletStock.
// - OutletStock bertambah saat outlet menerima transfer.
// - Tidak boleh double release.
// - Manual Delivery tanpa DeliveryRequest tetap berjalan normal.
// - OutletTransfer diidentifikasi berdasarkan number.
// - OutletTransfer TIDAK menggunakan deliveryId.
// ============================================================

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // ========================================================
    // 1. CURRENT USER
    // ========================================================

    const user =
      await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    if (user.active === false) {
      return forbidden(
        "User tidak aktif"
      );
    }

    // ========================================================
    // 2. ROLE
    // ========================================================

    const role = String(
      user.role ?? ""
    )
      .trim()
      .toUpperCase();

    const allowedRoles = [
      "ADMIN",
      "MANAGER",
      "GUDANG",
    ];

    if (
      !allowedRoles.includes(role)
    ) {
      return forbidden(
        "Anda tidak memiliki akses untuk release Delivery"
      );
    }

    // ========================================================
    // 3. PARAMETER
    // ========================================================

    const { id } =
      await params;

    const deliveryId = Number(
      String(id ?? "").trim()
    );

    if (
      !Number.isInteger(
        deliveryId
      ) ||
      deliveryId <= 0
    ) {
      return badRequest(
        "ID Delivery tidak valid"
      );
    }

    // ========================================================
    // 4. LOAD DELIVERY
    //
    // Load di luar transaction hanya untuk mendapatkan
    // informasi awal / response.
    //
    // Status final tetap dicek ulang DI DALAM transaction.
    // ========================================================

    const delivery =
      await prisma.delivery.findUnique(
        {
          where: {
            id: deliveryId,
          },

          include: {
            customer: true,

            outlet: {
              select: {
                id: true,
                code: true,
                name: true,
                active: true,
              },
            },

            items: {
              include: {
                barang: true,
              },

              orderBy: {
                id: "asc",
              },
            },

            suratJalan: true,

            deliveryRequest: {
              select: {
                id: true,
                number: true,
                status: true,
                outletId: true,
              },
            },
          },
        }
      );

    // ========================================================
    // 5. NOT FOUND
    // ========================================================

    if (!delivery) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Delivery tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // ========================================================
    // 6. EARLY STATUS CHECK
    //
    // Hanya sebagai feedback cepat.
    // Security final tetap dilakukan di transaction.
    // ========================================================

    if (
      delivery.status !==
      DeliveryStatus.DRAFT
    ) {
      return badRequest(
        `Delivery tidak dapat di-release karena status saat ini ${delivery.status}`
      );
    }

    // ========================================================
    // 7. ITEMS
    // ========================================================

    if (
      !delivery.items ||
      delivery.items.length === 0
    ) {
      return badRequest(
        "Delivery tidak memiliki barang"
      );
    }

    // ========================================================
    // 8. OUTLET
    // ========================================================

    if (!delivery.outletId) {
      return badRequest(
        "Delivery belum memiliki outlet tujuan"
      );
    }

    if (!delivery.outlet) {
      return badRequest(
        "Outlet tujuan tidak ditemukan"
      );
    }

    if (
      delivery.outlet.active ===
      false
    ) {
      return badRequest(
        "Outlet tujuan tidak aktif"
      );
    }

    // ========================================================
    // 9. TRANSACTION
    // ========================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // ==================================================
          // 9A. RELOAD DELIVERY DI DALAM TRANSACTION
          //
          // Ini penting supaya dua request release bersamaan
          // tidak sama-sama mengurangi stock.
          // ==================================================

          const currentDelivery =
            await tx.delivery.findUnique(
              {
                where: {
                  id: deliveryId,
                },

                select: {
                  id: true,
                  number: true,
                  status: true,
                  outletId: true,
                  deliveryDate: true,
                  remarks: true,

                  deliveryRequest: {
                    select: {
                      id: true,
                      number: true,
                      status: true,
                      outletId: true,
                    },
                  },

                  items: {
                    select: {
                      id: true,
                      barangId: true,
                      qty: true,
                      price: true,
                      subtotal: true,
                      note: true,
                      voided: true,

                      barang: {
                        select: {
                          id: true,
                          code: true,
                          name: true,
                          stock: true,
                          purchasePrice: true,
                          sellingPrice: true,
                          hasExpired: true,
                        },
                      },
                    },

                    orderBy: {
                      id: "asc",
                    },
                  },
                },
              }
            );

          if (!currentDelivery) {
            throw new Error(
              "Delivery tidak ditemukan"
            );
          }

          // ==================================================
          // 9B. STATUS RECHECK
          // ==================================================

          if (
            currentDelivery.status !==
            DeliveryStatus.DRAFT
          ) {
            throw new Error(
              `Delivery sudah diproses. Status saat ini ${currentDelivery.status}`
            );
          }

          // ==================================================
          // 9C. OUTLET RECHECK
          // ==================================================

          if (
            !currentDelivery.outletId
          ) {
            throw new Error(
              "Delivery belum memiliki outlet tujuan"
            );
          }

          const targetOutlet =
            await tx.outlet.findUnique(
              {
                where: {
                  id:
                    currentDelivery.outletId,
                },

                select: {
                  id: true,
                  code: true,
                  name: true,
                  active: true,
                },
              }
            );

          if (!targetOutlet) {
            throw new Error(
              "Outlet tujuan tidak ditemukan"
            );
          }

          if (
            targetOutlet.active ===
            false
          ) {
            throw new Error(
              "Outlet tujuan tidak aktif"
            );
          }

          // ==================================================
          // 9D. DELIVERY REQUEST SECURITY
          //
          // Kalau Delivery berasal dari Delivery Request,
          // outlet Delivery harus sama dengan outlet request.
          // ==================================================

          if (
            currentDelivery.deliveryRequest
          ) {
            if (
              currentDelivery.deliveryRequest
                .outletId !==
              currentDelivery.outletId
            ) {
              throw new Error(
                "Outlet Delivery tidak sesuai dengan Delivery Request"
              );
            }

            if (
              currentDelivery.deliveryRequest
                .status !==
              DeliveryRequestStatus.PROCESSING
            ) {
              throw new Error(
                `Delivery Request ${currentDelivery.deliveryRequest.number} tidak dapat diselesaikan karena statusnya ${currentDelivery.deliveryRequest.status}`
              );
            }
          }

          // ==================================================
          // 9E. ITEMS RECHECK
          // ==================================================

          if (
            currentDelivery.items.length ===
            0
          ) {
            throw new Error(
              "Delivery tidak memiliki barang"
            );
          }

          // ==================================================
          // TRACKING
          // ==================================================

          const releasedItems: Array<{
            itemId: number;
            barangId: number;
            barang: string;
            qty: number;
            stockBefore: number;
            stockAfter: number;
          }> = [];

          let totalQty = 0;

          // ==================================================
          // 10. PROCESS ITEMS
          // ==================================================

          for (
            const item of currentDelivery.items
          ) {
            // ------------------------------------------------
            // VOID ITEM
            // ------------------------------------------------

            if (
              item.voided === true
            ) {
              continue;
            }

            // ------------------------------------------------
            // BARANG
            // ------------------------------------------------

            if (!item.barang) {
              throw new Error(
                `Barang ID ${item.barangId} tidak ditemukan`
              );
            }

            // ------------------------------------------------
            // QTY
            // ------------------------------------------------

            const qty = Number(
              item.qty
            );

            if (
              !Number.isFinite(qty) ||
              qty <= 0
            ) {
              throw new Error(
                `Qty ${item.barang.name} tidak valid`
              );
            }

            totalQty += qty;

            // ------------------------------------------------
            // RELOAD BARANG
            //
            // Ambil stock terbaru di transaction.
            // ------------------------------------------------

            const currentBarang =
              await tx.barang.findUnique(
                {
                  where: {
                    id: item.barangId,
                  },

                  select: {
                    id: true,
                    code: true,
                    name: true,
                    stock: true,
                    purchasePrice: true,
                    sellingPrice: true,
                    hasExpired: true,
                  },
                }
              );

            if (!currentBarang) {
              throw new Error(
                `Barang ${item.barangId} tidak ditemukan`
              );
            }

            // ------------------------------------------------
            // STOCK BEFORE
            // ------------------------------------------------

            const stockBefore =
              Number(
                currentBarang.stock ?? 0
              );

            if (
              !Number.isFinite(
                stockBefore
              ) ||
              stockBefore < 0
            ) {
              throw new Error(
                `Stock ${currentBarang.name} tidak valid`
              );
            }

            // ------------------------------------------------
            // STOCK CHECK
            // ------------------------------------------------

            if (
              stockBefore < qty
            ) {
              throw new Error(
                `Stock ${currentBarang.name} tidak cukup. Stock tersedia ${stockBefore}, kebutuhan ${qty}`
              );
            }

            // ------------------------------------------------
            // STOCK AFTER
            // ------------------------------------------------

            const stockAfter =
              stockBefore - qty;

            // ------------------------------------------------
            // FEFO
            //
            // Jika barang menggunakan expiry/batch,
            // kurangi batch berdasarkan expiredDate terdekat.
            // ------------------------------------------------

            if (
              currentBarang.hasExpired ===
              true
            ) {
              const batches =
                await tx.batchStock.findMany(
                  {
                    where: {
                      barangId:
                        item.barangId,

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
                  }
                );

              if (
                !batches ||
                batches.length ===
                  0
              ) {
                throw new Error(
                  `Batch stock ${currentBarang.name} tidak ditemukan`
                );
              }

              let remainingQty =
                qty;

              let totalBatchQty =
                0;

              for (
                const batch of batches
              ) {
                totalBatchQty +=
                  Number(
                    batch.qty ?? 0
                  );
              }

              if (
                totalBatchQty <
                qty
              ) {
                throw new Error(
                  `Batch stock ${currentBarang.name} tidak cukup untuk FEFO`
                );
              }

              for (
                const batch of batches
              ) {
                if (
                  remainingQty <= 0
                ) {
                  break;
                }

                const batchQty =
                  Number(
                    batch.qty ?? 0
                  );

                if (
                  !Number.isFinite(
                    batchQty
                  ) ||
                  batchQty <= 0
                ) {
                  continue;
                }

                const takeQty =
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
                        takeQty,
                    },
                  }
                );

                remainingQty -=
                  takeQty;
              }

              if (
                remainingQty >
                0.000001
              ) {
                throw new Error(
                  `Gagal mengurangi batch FEFO ${currentBarang.name}`
                );
              }
            }

            // ------------------------------------------------
            // UPDATE BARANG STOCK PUSAT
            // ------------------------------------------------

            const updatedBarang =
              await tx.barang.update(
                {
                  where: {
                    id:
                      item.barangId,
                  },

                  data: {
                    stock:
                      stockAfter,
                  },
                }
              );

            // ------------------------------------------------
            // INVENTORY
            // ------------------------------------------------

            await tx.inventory.upsert(
              {
                where: {
                  barangId:
                    item.barangId,
                },

                create: {
                  barangId:
                    item.barangId,

                  stock:
                    stockAfter,

                  availableStock:
                    stockAfter,

                  minimumStock:
                    0,
                },

                update: {
                  stock:
                    stockAfter,

                  availableStock:
                    stockAfter,
                },
              }
            );

            // ------------------------------------------------
            // UNIT PRICE
            // ------------------------------------------------

            const unitPrice =
              Number(
                item.price ??
                  currentBarang.purchasePrice ??
                  currentBarang.sellingPrice ??
                  0
              );

            const safeUnitPrice =
              Number.isFinite(
                unitPrice
              ) &&
              unitPrice >= 0
                ? unitPrice
                : 0;

            const totalValue =
              qty *
              safeUnitPrice;

            // ------------------------------------------------
            // STOCK CARD
            // ------------------------------------------------

            await tx.stockCard.create(
              {
                data: {
                  barangId:
                    item.barangId,

                  trxDate:
                    currentDelivery.deliveryDate,

                  trxType:
                    "DELIVERY",

                  trxNumber:
                    currentDelivery.number,

                  referenceId:
                    currentDelivery.id,

                  warehouse:
                    "MAIN",

                  qtyIn: 0,

                  qtyOut: qty,

                  balance:
                    updatedBarang.stock,

                  unitPrice:
                    safeUnitPrice,

                  totalValue,

                  note:
                    currentDelivery.remarks ??
                    `Release Delivery ${currentDelivery.number}`,
                },
              }
            );

            // ------------------------------------------------
            // STOCK MUTATION
            // ------------------------------------------------

            await tx.stockMutation.create(
              {
                data: {
                  barangId:
                    item.barangId,

                  type:
                    "OUT",

                  qty,

                  stockBefore,

                  stockAfter,

                  reference:
                    currentDelivery.number,

                  description:
                    `Release Delivery Order ${currentDelivery.number}`,
                },
              }
            );

            // ------------------------------------------------
            // TRACKING
            // ------------------------------------------------

            releasedItems.push({
              itemId:
                item.id,

              barangId:
                item.barangId,

              barang:
                currentBarang.name,

              qty,

              stockBefore,

              stockAfter,
            });
          }

          // ==================================================
          // 11. TOTAL QTY VALIDATION
          // ==================================================

          if (
            totalQty <= 0
          ) {
            throw new Error(
              "Tidak ada barang aktif yang dapat di-release"
            );
          }

          // ==================================================
          // 12. UPDATE DELIVERY RELEASED
          // ==================================================

          const releasedDelivery =
            await tx.delivery.update(
              {
                where: {
                  id:
                    currentDelivery.id,
                },

                data: {
                  status:
                    DeliveryStatus.RELEASED,

                  totalQty,
                },

                select: {
                  id: true,
                  number: true,
                  status: true,
                  outletId: true,
                  deliveryDate: true,
                  totalQty: true,
                },
              }
            );

          // ==================================================
          // 13. SURAT JALAN
          //
          // Gunakan nomor deterministic berdasarkan DO.
          // ==================================================

          const suratJalanNumber =
            `SJ-${currentDelivery.number}`;

          let suratJalan =
            await tx.suratJalan.findUnique(
              {
                where: {
                  deliveryId:
                    currentDelivery.id,
                },
              }
            );

          if (!suratJalan) {
            suratJalan =
              await tx.suratJalan.create(
                {
                  data: {
                    deliveryId:
                      currentDelivery.id,

                    number:
                      suratJalanNumber,
                  },
                }
              );
          }

          // ==================================================
          // 14. OUTLET TRANSFER
          //
          // CENTRAL -> OUTLET
          //
          // IMPORTANT:
          //
          // OutletTransfer TIDAK memiliki deliveryId.
          // Transfer diidentifikasi dengan nomor:
          //
          // TRF-${currentDelivery.number}
          //
          // OutletStock BELUM bertambah di sini.
          // ==================================================

          const transferNumber =
            `TRF-${currentDelivery.number}`;

          let outletTransfer =
            await tx.outletTransfer.findUnique(
              {
                where: {
                  number:
                    transferNumber,
                },

                include: {
                  items: true,
                },
              }
            );

          // --------------------------------------------------
          // CREATE TRANSFER
          // --------------------------------------------------

          if (!outletTransfer) {
            outletTransfer =
              await tx.outletTransfer.create(
                {
                  data: {
                    number:
                      transferNumber,

                    sourceOutletId:
                      null,

                    outletId:
                      currentDelivery.outletId,

                    transferDate:
                      currentDelivery.deliveryDate,

                    status:
                      OutletTransferStatus.SENT,

                    remarks:
                      `Pengiriman dari gudang pusat - ${currentDelivery.number}`,

                    items: {
                      create:
                        currentDelivery.items
                          .filter(
                            (item) =>
                              item.voided !==
                              true
                          )
                          .map(
                            (item) => ({
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
                    items: true,
                  },
                }
              );
          } else {
            // ------------------------------------------------
            // TRANSFER SUDAH ADA
            //
            // Jangan membuat stock outlet di sini.
            //
            // Jika transfer masih DRAFT, ubah menjadi SENT.
            // Jika sudah SENT / RECEIVED / status lainnya,
            // jangan menimpa statusnya.
            // ------------------------------------------------

            if (
              outletTransfer.status ===
              OutletTransferStatus.DRAFT
            ) {
              outletTransfer =
                await tx.outletTransfer.update(
                  {
                    where: {
                      id:
                        outletTransfer.id,
                    },

                    data: {
                      status:
                        OutletTransferStatus.SENT,
                    },

                    include: {
                      items: true,
                    },
                  }
                );
            }
          }

          // ==================================================
          // 15. DELIVERY REQUEST -> COMPLETED
          //
          // HANYA jika Delivery ini berasal dari
          // Delivery Request.
          //
          // Manual Delivery tidak tersentuh.
          // ==================================================

          let completedDeliveryRequest:
            | {
                id: number;
                number: string;
                status: DeliveryRequestStatus;
              }
            | null = null;

          if (
            currentDelivery.deliveryRequest
          ) {
            const updatedRequest =
              await tx.deliveryRequest.update(
                {
                  where: {
                    id:
                      currentDelivery
                        .deliveryRequest
                        .id,
                  },

                  data: {
                    status:
                      DeliveryRequestStatus.COMPLETED,
                  },

                  select: {
                    id: true,
                    number: true,
                    status: true,
                  },
                }
              );

            completedDeliveryRequest =
              updatedRequest;
          }

          // ==================================================
          // 16. HISTORY
          // ==================================================

          await tx.history.create(
            {
              data: {
                transactionType:
                  HistoryType.DELIVERY,

                userId:
                  user.id,

                referenceNumber:
                  currentDelivery.number,

                description:
                  currentDelivery
                    .deliveryRequest
                    ? `Release Delivery ${currentDelivery.number} dari Delivery Request ${currentDelivery.deliveryRequest.number}. Stock pusat berkurang dan transfer dikirim ke outlet ${targetOutlet.name}.`
                    : `Release Delivery ${currentDelivery.number}. Stock pusat berkurang dan transfer dikirim ke outlet ${targetOutlet.name}.`,
              },
            }
          );

          // ==================================================
          // 17. RESULT
          // ==================================================

          return {
            delivery:
              releasedDelivery,

            outlet: {
              id:
                targetOutlet.id,

              code:
                targetOutlet.code,

              name:
                targetOutlet.name,
            },

            suratJalan: {
              id:
                suratJalan.id,

              number:
                suratJalan.number,
            },

            outletTransfer: {
              id:
                outletTransfer.id,

              number:
                outletTransfer.number,

              status:
                outletTransfer.status,
            },

            deliveryRequest:
              completedDeliveryRequest,

            totalQty,

            releasedItems,
          };
        }
      );

    // ========================================================
    // 18. SUCCESS RESPONSE
    // ========================================================

    return NextResponse.json({
      success: true,

      message:
        result.deliveryRequest
          ? `Delivery ${result.delivery.number} berhasil di-release dan Delivery Request ${result.deliveryRequest.number} selesai`
          : `Delivery ${result.delivery.number} berhasil di-release`,

      data: {
        deliveryId:
          result.delivery.id,

        deliveryNumber:
          result.delivery.number,

        deliveryStatus:
          result.delivery.status,

        totalQty:
          result.totalQty,

        outlet:
          result.outlet,

        suratJalan:
          result.suratJalan,

        outletTransfer:
          result.outletTransfer,

        deliveryRequest:
          result.deliveryRequest,

        releasedItems:
          result.releasedItems,
      },
    });
  } catch (error: any) {
    // ========================================================
    // ERROR LOG
    // ========================================================

    console.error(
      "RELEASE DELIVERY ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Gagal release Delivery";

    // ========================================================
    // BUSINESS ERROR
    // ========================================================

    const businessPatterns = [
      "Delivery tidak ditemukan",
      "Delivery sudah diproses",
      "Delivery tidak dapat",
      "Delivery tidak memiliki",
      "Delivery belum",
      "Outlet tujuan",
      "Outlet Delivery",
      "Delivery Request",
      "Stock ",
      "Barang ",
      "Qty ",
      "Batch ",
      "Gagal mengurangi batch",
      "Tidak ada barang aktif",
      "User",
    ];

    const isBusinessError =
      businessPatterns.some(
        (pattern) =>
          message.startsWith(
            pattern
          )
      );

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status:
          isBusinessError
            ? 400
            : 500,
      }
    );
  }
}