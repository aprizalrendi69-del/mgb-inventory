import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

// =========================================================
// CURRENT USER
// =========================================================

async function currentUser() {
  const c = await cookies();

  const sessionCookie =
    c.get("erp-session") ||
    c.get("session");

  if (!sessionCookie) {
    return null;
  }

  let userId = 0;

  // -------------------------------------------------------
  // SESSION TOKEN
  // -------------------------------------------------------

  try {
    const session =
      await prisma.session.findUnique({
        where: {
          token: sessionCookie.value,
        },
        select: {
          expiresAt: true,
          user: {
            select: {
              id: true,
            },
          },
        },
      });

    if (
      session &&
      session.expiresAt > new Date()
    ) {
      userId = session.user.id;
    }
  } catch {
    // fallback ke JSON session
  }

  // -------------------------------------------------------
  // JSON SESSION FALLBACK
  // -------------------------------------------------------

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
      // ignore
    }
  }

  if (!userId) {
    return null;
  }

  return prisma.user
    .findUnique({
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
    })
    .then((user) =>
      user?.active
        ? user
        : null
    );
}

// =========================================================
// RESPONSE HELPER
// =========================================================

function fail(
  message: string,
  status = 400
) {
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

// =========================================================
// NUMBER HELPER
// =========================================================

function num(value: unknown) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : 0;
}

// =========================================================
// VOID DELIVERY ITEM
//
// PUT
// /api/delivery/[id]/items/[itemId]/void
//
// Body:
//
// {
//   "reason": "Alasan void"
// }
//
// =========================================================

export async function PUT(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
      itemId: string;
    }>;
  }
) {
  try {
    // =====================================================
    // AUTH
    // =====================================================

    const user =
      await currentUser();

    if (!user) {
      return fail(
        "Tidak login.",
        401
      );
    }

    // =====================================================
    // PARAMETER
    // =====================================================

    const {
      id,
      itemId,
    } = await context.params;

    const deliveryId =
      Number(id);

    const deliveryItemId =
      Number(itemId);

    if (
      !Number.isInteger(
        deliveryId
      ) ||
      deliveryId <= 0
    ) {
      return fail(
        "ID Delivery tidak valid.",
        400
      );
    }

    if (
      !Number.isInteger(
        deliveryItemId
      ) ||
      deliveryItemId <= 0
    ) {
      return fail(
        "ID item Delivery tidak valid.",
        400
      );
    }

    // =====================================================
    // BODY
    // =====================================================

    let body: any = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const reason =
      String(
        body?.reason ??
          body?.voidReason ??
          ""
      ).trim();

    if (!reason) {
      return fail(
        "Alasan void wajib diisi.",
        400
      );
    }

    // =====================================================
    // TRANSACTION
    // =====================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // =================================================
          // AMBIL DELIVERY
          // =================================================

          const delivery =
            await tx.delivery.findUnique({
              where: {
                id: deliveryId,
              },

              include: {
                customer: true,

                suratJalan: true,

                items: {
                  where: {
                    id:
                      deliveryItemId,
                  },

                  include: {
                    barang: true,
                  },
                },
              },
            });

          if (!delivery) {
            throw new Error(
              "Delivery Order tidak ditemukan."
            );
          }

          // =================================================
          // DELIVERY HARUS RELEASED
          // =================================================

          if (
            String(
              delivery.status
            ) !== "RELEASED"
          ) {
            throw new Error(
              "Item hanya dapat di-void setelah Delivery Order berstatus RELEASED."
            );
          }

          // =================================================
          // ITEM DELIVERY
          // =================================================

          const item =
            delivery.items[0];

          if (!item) {
            throw new Error(
              "Item Delivery tidak ditemukan."
            );
          }

          // =================================================
          // SUDAH VOID
          // =================================================

          if (item.voided) {
            throw new Error(
              "Item ini sudah pernah di-void."
            );
          }

          // =================================================
          // QTY
          // =================================================

          const qty =
            num(item.qty);

          if (!(qty > 0)) {
            throw new Error(
              "Qty item tidak valid."
            );
          }

          const barangId =
            item.barangId;

          // =================================================
          // BARANG TERKINI
          // =================================================

          const barang =
            await tx.barang.findUnique({
              where: {
                id: barangId,
              },
            });

          if (!barang) {
            throw new Error(
              "Barang untuk item Delivery tidak ditemukan."
            );
          }

          // =================================================
          // CARI OUTLET TRANSFER
          //
          // Delivery:
          //
          // DELIVERY
          //    ↓
          // OUTLET TRANSFER
          //    ↓
          // OUTLET TRANSFER ITEM
          //
          // Nomor transfer:
          //
          // TRF-{delivery.number}
          // =================================================

          const outletTransfer =
            await tx.outletTransfer.findUnique({
              where: {
                number:
                  `TRF-${delivery.number}`,
              },
            });

          // =================================================
          // CARI ITEM TRANSFER
          //
          // PENTING:
          //
          // Schema Prisma kamu menggunakan:
          //
          // transferId
          //
          // BUKAN:
          //
          // outletTransferId
          // =================================================

          let transferItem:
            | {
                id: number;
                transferId: number;
                barangId: number;
                qty: number;
                receivedQty: number;
                voided: boolean;
              }
            | null = null;

          if (outletTransfer) {
            transferItem =
              await tx.outletTransferItem.findFirst({
                where: {
                  transferId:
                    outletTransfer.id,

                  barangId:
                    barangId,
                },

                select: {
                  id: true,
                  transferId: true,
                  barangId: true,
                  qty: true,
                  receivedQty: true,
                  voided: true,
                },
              });
          }

          // =================================================
          // JIKA ITEM TRANSFER SUDAH VOID
          // =================================================

          if (
            transferItem?.voided
          ) {
            throw new Error(
              "Item transfer outlet ini sudah pernah di-void."
            );
          }

          // =================================================
          // JIKA SUDAH DITERIMA OUTLET
          //
          // Tidak boleh di-void dari Delivery.
          //
          // Karena stok outlet sudah bertambah.
          // =================================================

          if (
            transferItem &&
            num(
              transferItem.receivedQty
            ) > 0
          ) {
            throw new Error(
              `Item ${barang.name} sudah diterima outlet sebanyak ${transferItem.receivedQty}. Item yang sudah diterima outlet tidak dapat di-void dari Delivery.`
            );
          }

          // =================================================
          // STOCK BARANG
          // =================================================

          const stockBefore =
            num(barang.stock);

          const stockAfter =
            stockBefore + qty;

          // =================================================
          // BATCH STOCK
          //
          // Schema lama belum menyimpan batch allocation
          // langsung pada DeliveryItem.
          //
          // Maka untuk kompatibilitas:
          //
          // - cari batch berdasarkan expiredDate ASC
          // - kembalikan qty ke batch tersebut
          //
          // Catatan:
          // jika nanti DeliveryItem memiliki batchId,
          // bagian ini sebaiknya diarahkan langsung ke batch
          // asal pengeluaran.
          // =================================================

          const batchStocks =
            await tx.batchStock.findMany({
              where: {
                barangId,
              },

              orderBy: [
                {
                  expiredDate:
                    "asc",
                },

                {
                  id:
                    "asc",
                },
              ],
            });

          const targetBatch =
            batchStocks.length > 0
              ? batchStocks[0]
              : null;

          let batchBefore:
            number | null = null;

          let batchAfter:
            number | null = null;

          // =================================================
          // UPDATE STOCK BARANG
          // =================================================

          await tx.barang.update({
            where: {
              id: barangId,
            },

            data: {
              stock:
                stockAfter,
            },
          });

          // =================================================
          // UPDATE BATCH STOCK
          // =================================================

          if (targetBatch) {
            batchBefore =
              num(
                targetBatch.qty
              );

            batchAfter =
              batchBefore + qty;

            await tx.batchStock.update({
              where: {
                id:
                  targetBatch.id,
              },

              data: {
                qty:
                  batchAfter,
              },
            });
          }

          // =================================================
          // INVENTORY
          // =================================================

          const inventory =
            await tx.inventory.findUnique({
              where: {
                barangId,
              },
            });

          let inventoryAfter =
            stockAfter;

          if (inventory) {
            inventoryAfter =
              num(
                inventory.stock
              ) + qty;

            const reserved =
              num(
                inventory.reservedStock
              );

            await tx.inventory.update({
              where: {
                barangId,
              },

              data: {
                stock:
                  inventoryAfter,

                availableStock:
                  Math.max(
                    0,
                    inventoryAfter -
                      reserved
                  ),
              },
            });
          } else {
            await tx.inventory.create({
              data: {
                barangId,

                warehouse:
                  "MAIN",

                stock:
                  qty,

                reservedStock:
                  0,

                availableStock:
                  qty,

                minimumStock:
                  num(
                    barang.minimumStock
                  ),
              },
            });

            inventoryAfter =
              qty;
          }

          // =================================================
          // STOCK CARD
          // =================================================

          const referenceNumber =
            delivery.suratJalan
              ?.number ||
            delivery.number;

          await tx.stockCard.create({
            data: {
              barangId,

              trxDate:
                new Date(),

              trxType:
                "VOID_DELIVERY",

              trxNumber:
                referenceNumber,

              referenceId:
                delivery.id,

              warehouse:
                "MAIN",

              qtyIn:
                qty,

              qtyOut:
                0,

              balance:
                stockAfter,

              unitPrice:
                num(
                  item.price
                ),

              totalValue:
                qty *
                num(
                  item.price
                ),

              note:
                `VOID item Delivery ${delivery.number} / item ${item.id}. ${reason}`,
            },
          });

          // =================================================
          // STOCK MUTATION
          // =================================================

          await tx.stockMutation.create({
            data: {
              barangId,

              type:
                "IN",

              qty,

              stockBefore,

              stockAfter,

              reference:
                `VOID_DELIVERY:${delivery.id}:${item.id}`,

              description:
                `Pengembalian stock karena void item Delivery ${delivery.number}. ${reason}`,
            },
          });

          // =================================================
          // MARK DELIVERY ITEM VOID
          // =================================================

          const voidedAt =
            new Date();

          await tx.deliveryItem.update({
            where: {
              id:
                item.id,
            },

            data: {
              voided:
                true,

              voidedAt,

              voidedById:
                user.id,

              voidReason:
                reason,
            },
          });

          // =================================================
          // SINKRONISASI OUTLET TRANSFER
          // =================================================
          //
          // Hanya dilakukan jika:
          //
          // 1. Transfer ditemukan
          // 2. Item transfer ditemukan
          // 3. receivedQty = 0
          //
          // Item TIDAK DIHAPUS.
          //
          // Hanya ditandai VOID.
          //
          // Ini penting agar histori barang masuk outlet
          // tetap ada.
          // =================================================

          if (
            outletTransfer &&
            transferItem
          ) {
            await tx.outletTransferItem.update({
              where: {
                id:
                  transferItem.id,
              },

              data: {
                voided:
                  true,

                voidedAt,

                voidedById:
                  user.id,

                voidReason:
                  reason,
              },
            });
          }

          // =================================================
          // HITUNG TOTAL QTY DELIVERY AKTIF
          //
          // Item VOID tidak dihitung.
          // =================================================

          const activeItems =
            await tx.deliveryItem.findMany({
              where: {
                deliveryId:
                  delivery.id,

                voided:
                  false,
              },

              select: {
                qty: true,
              },
            });

          const remainingQty =
            activeItems.reduce(
              (
                total,
                current
              ) =>
                total +
                num(
                  current.qty
                ),
              0
            );

          // =================================================
          // UPDATE TOTAL DELIVERY
          //
          // Status tetap RELEASED.
          // =================================================

          await tx.delivery.update({
            where: {
              id:
                delivery.id,
            },

            data: {
              totalQty:
                remainingQty,
            },
          });

          // =================================================
          // RESPONSE DATA
          // =================================================

          return {
            deliveryId:
              delivery.id,

            deliveryNumber:
              delivery.number,

            itemId:
              item.id,

            barangId,

            barangName:
              barang.name,

            qty,

            stockBefore,

            stockAfter,

            // -------------------------------------------------
            // BATCH
            // -------------------------------------------------

            batchId:
              targetBatch?.id ??
              null,

            batchNumber:
              targetBatch?.batchNumber ??
              null,

            batchBefore,

            batchAfter,

            // -------------------------------------------------
            // INVENTORY
            // -------------------------------------------------

            inventoryStock:
              inventoryAfter,

            // -------------------------------------------------
            // DELIVERY
            // -------------------------------------------------

            remainingQty,

            // -------------------------------------------------
            // OUTLET TRANSFER
            // -------------------------------------------------

            outletTransferId:
              outletTransfer?.id ??
              null,

            outletTransferItemId:
              transferItem?.id ??
              null,

            outletTransferItemVoided:
              Boolean(
                transferItem
              ),

            // -------------------------------------------------
            // USER
            // -------------------------------------------------

            voidedBy:
              user.fullname ||
              user.username,

            reason,
          };
        }
      );

    // =====================================================
    // SUCCESS MESSAGE
    // =====================================================

    const batchMessage =
      result.batchId
        ? ` Batch ${result.batchNumber} juga dikembalikan ${result.qty}.`
        : "";

    const transferMessage =
      result.outletTransferItemId
        ? " Item transfer outlet juga ditandai VOID."
        : "";

    return NextResponse.json({
      success: true,

      message:
        `Item ${result.barangName} berhasil di-void. ` +
        `Stock bertambah ${result.qty}.` +
        batchMessage +
        transferMessage,

      data:
        result,
    });
  } catch (error: any) {
    // =====================================================
    // ERROR
    // =====================================================

    console.error(
      "VOID DELIVERY ITEM ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal melakukan void item Delivery.",

        error:
          process.env.NODE_ENV ===
          "development"
            ? String(error)
            : undefined,
      },

      {
        status: 500,
      }
    );
  }
}

// =========================================================
// POST COMPATIBILITY
//
// Frontend lama menggunakan POST.
// Tetap diarahkan ke PUT.
// =========================================================

export async function POST(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
      itemId: string;
    }>;
  }
) {
  return PUT(
    req,
    context
  );
}