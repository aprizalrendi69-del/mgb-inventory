import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { OutletTransferStatus } from "@prisma/client";

// =====================================================
// CURRENT LOGIN USER
// =====================================================

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

  const userId = Number(
    sessionData?.user?.id ??
      sessionData?.data?.user?.id ??
      sessionData?.data?.id ??
      sessionData?.id
  );

  if (!Number.isInteger(userId) || userId <= 0) {
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
// RESPONSE HELPERS
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

// =====================================================
// NUMBER HELPERS
// =====================================================

function toNumber(
  value: unknown
) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : NaN;
}

function roundQty(
  value: number
) {
  return Math.round(
    (value + Number.EPSILON) * 1000000
  ) / 1000000;
}

// =====================================================
// TYPES
// =====================================================

type ReceiveItemInput = {
  id: number;
  receivedQty: number;
};

// =====================================================
// POST RECEIVE OUTLET TRANSFER
//
// FLOW:
//
// ADMIN / MANAGER
// -> boleh menerima transfer outlet mana pun
//
// OUTLET_ADMIN
// -> hanya boleh menerima transfer untuk outlet sendiri
//
// ITEM VOID
// -> tidak masuk stock
// -> tidak membuat stock mutation
// -> receivedQty tidak diubah
//
// ITEM NORMAL
// -> stock outlet bertambah sesuai qty aktual
// -> receivedQty disimpan
// -> stock mutation dibuat sesuai qty baru
//
// PARTIAL RECEIVE
// -> hanya selisih qty yang belum pernah diterima
//    yang ditambahkan ke stock.
//
// Contoh:
//
// qty kirim       = 10
// sudah diterima  = 3
// input baru      = 5
//
// stock bertambah = 2
//
// STATUS:
//
// seluruh item aktif selesai
// -> RECEIVED
//
// masih ada qty aktif yang belum diterima
// -> PARTIAL
//
// Tidak ada qty baru
// -> ditolak
//
// Barang.stock pusat TIDAK disentuh.
// =====================================================

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
    // ===================================================
    // 1. CURRENT USER
    // ===================================================

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

    // ===================================================
    // 2. ROLE
    // ===================================================

    const role = String(
      user.role ?? ""
    )
      .trim()
      .toUpperCase();

    const allowedRoles = [
      "ADMIN",
      "MANAGER",
      "OUTLET_ADMIN",
    ];

    if (
      !allowedRoles.includes(role)
    ) {
      return forbidden(
        "Anda tidak memiliki akses menerima transfer outlet"
      );
    }

    // ===================================================
    // 3. PARAMETER
    // ===================================================

    const { id } =
      await params;

    const rawId = String(
      id ?? ""
    ).trim();

    const transferId = Number(
      rawId.replace(
        /^TRANSFER-/i,
        ""
      )
    );

    if (
      !Number.isInteger(
        transferId
      ) ||
      transferId <= 0
    ) {
      return badRequest(
        "ID transfer tidak valid"
      );
    }

    // ===================================================
    // 4. BODY
    // ===================================================

    let body: any;

    try {
      body = await req.json();
    } catch {
      return badRequest(
        "Body request tidak valid"
      );
    }

    if (
      !body ||
      !Array.isArray(body.items)
    ) {
      return badRequest(
        "Data item penerimaan tidak valid"
      );
    }

    // ===================================================
    // 5. NORMALIZE INPUT
    // ===================================================

    const inputItems: ReceiveItemInput[] =
      [];

    for (
      const rawItem of body.items
    ) {
      const itemId = Number(
        rawItem?.id
      );

      const receivedQty =
        toNumber(
          rawItem?.receivedQty
        );

      if (
        !Number.isInteger(
          itemId
        ) ||
        itemId <= 0
      ) {
        return badRequest(
          "ID item transfer tidak valid"
        );
      }

      if (
        !Number.isFinite(
          receivedQty
        ) ||
        receivedQty < 0
      ) {
        return badRequest(
          `Qty diterima item ${itemId} tidak valid`
        );
      }

      inputItems.push({
        id: itemId,

        receivedQty:
          roundQty(
            receivedQty
          ),
      });
    }

    // ===================================================
    // 6. DUPLICATE ITEM CHECK
    // ===================================================

    const uniqueItemIds =
      new Set(
        inputItems.map(
          (item) => item.id
        )
      );

    if (
      uniqueItemIds.size !==
      inputItems.length
    ) {
      return badRequest(
        "Item transfer tidak boleh dikirim lebih dari satu kali"
      );
    }

    // ===================================================
    // 7. LOAD TRANSFER
    // ===================================================

    const transfer =
      await prisma.outletTransfer.findUnique(
        {
          where: {
            id: transferId,
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

              orderBy: {
                id: "asc",
              },
            },
          },
        }
      );

    // ===================================================
    // 8. NOT FOUND
    // ===================================================

    if (!transfer) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Transfer tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // ===================================================
    // 9. SECURITY OUTLET
    // ===================================================

    if (
      role === "OUTLET_ADMIN"
    ) {
      if (
        !user.outletId ||
        !Number.isInteger(
          user.outletId
        )
      ) {
        return forbidden(
          "User outlet belum terhubung dengan outlet"
        );
      }

      if (
        transfer.outletId !==
        user.outletId
      ) {
        return forbidden(
          "Anda tidak boleh menerima transfer untuk outlet lain"
        );
      }
    }

    // ===================================================
    // 10. OUTLET TUJUAN
    // ===================================================

    if (!transfer.outlet) {
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
      transfer.outlet.active ===
      false
    ) {
      return badRequest(
        "Outlet tujuan tidak aktif"
      );
    }

    // ===================================================
    // 11. STATUS
    // ===================================================

    if (
      transfer.status ===
      OutletTransferStatus.RECEIVED
    ) {
      return badRequest(
        "Transfer sudah diterima"
      );
    }

    // ===================================================
    // 12. ITEM CHECK
    // ===================================================

    if (
      !transfer.items ||
      transfer.items.length === 0
    ) {
      return badRequest(
        "Transfer tidak memiliki barang"
      );
    }

    // ===================================================
    // 13. TRANSACTION
    // ===================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // =================================================
          // RELOAD TRANSFER
          // =================================================

          const currentTransfer =
            await tx.outletTransfer.findUnique(
              {
                where: {
                  id: transfer.id,
                },

                select: {
                  id: true,
                  number: true,
                  status: true,
                  outletId: true,
                },
              }
            );

          if (!currentTransfer) {
            throw new Error(
              "Transfer tidak ditemukan"
            );
          }

          // =================================================
          // STATUS RECHECK
          // =================================================

          if (
            currentTransfer.status ===
            OutletTransferStatus.RECEIVED
          ) {
            throw new Error(
              "Transfer sudah diterima"
            );
          }

          // =================================================
          // OUTLET SECURITY RECHECK
          // =================================================

          if (
            role === "OUTLET_ADMIN" &&
            currentTransfer.outletId !==
              user.outletId
          ) {
            throw new Error(
              "Anda tidak boleh menerima transfer untuk outlet lain"
            );
          }

          // =================================================
          // CURRENT ITEMS
          // =================================================

          const currentItems =
            await tx.outletTransferItem.findMany(
              {
                where: {
                  transferId:
                    currentTransfer.id,
                },

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

                orderBy: {
                  id: "asc",
                },
              }
            );

          if (
            currentItems.length === 0
          ) {
            throw new Error(
              "Transfer tidak memiliki barang"
            );
          }

          // =================================================
          // INPUT MAP
          // =================================================

          const inputMap =
            new Map<number, number>();

          for (
            const inputItem of inputItems
          ) {
            inputMap.set(
              inputItem.id,
              inputItem.receivedQty
            );
          }

          // =================================================
          // VALIDATE INPUT ITEM ID
          // =================================================

          for (
            const inputItem of inputItems
          ) {
            const exists =
              currentItems.some(
                (item) =>
                  item.id ===
                  inputItem.id
              );

            if (!exists) {
              throw new Error(
                `Item transfer ID ${inputItem.id} tidak ditemukan pada transfer ini`
              );
            }
          }

          // =================================================
          // TRACKING
          // =================================================

          let receivedItemCount = 0;
          let partialItemCount = 0;
          let voidItemCount = 0;

          let receivedTotalQty = 0;
          let skippedTotalQty = 0;

          let totalActiveQty = 0;
          let totalReceivedAfter = 0;

          const receivedItems: Array<{
            itemId: number;
            barangId: number;
            barang: string;
            qtyKirim: number;
            qtyDiterima: number;
            qtyBaruMasuk: number;
            stockBefore: number;
            stockAfter: number;
          }> = [];

          const voidItems: Array<{
            itemId: number;
            barangId: number;
            barang: string;
            qty: number;
            voidedAt: Date | null;
            voidReason: string | null;
          }> = [];

          // =================================================
          // PROCESS EACH ITEM
          // =================================================

          for (
            const item of currentItems
          ) {
            // ===============================================
            // VOID ITEM
            // ===============================================

            if (
              item.voided === true
            ) {
              voidItemCount++;

              skippedTotalQty +=
                Number(
                  item.qty || 0
                );

              voidItems.push({
                itemId:
                  item.id,

                barangId:
                  item.barangId,

                barang:
                  item.barang?.name ??
                  `Barang ${item.barangId}`,

                qty:
                  Number(
                    item.qty || 0
                  ),

                voidedAt:
                  item.voidedAt,

                voidReason:
                  item.voidReason,
              });

              // Jangan:
              // - update receivedQty
              // - update stock
              // - create mutation

              continue;
            }

            // ===============================================
            // BARANG
            // ===============================================

            if (!item.barang) {
              throw new Error(
                `Barang transfer ID ${item.barangId} tidak ditemukan`
              );
            }

            // ===============================================
            // BARANG SOURCE
            // ===============================================

            if (
              item.barang.source !==
              "CENTRAL"
            ) {
              throw new Error(
                `Barang ${item.barang.name} bukan barang Master Pusat`
              );
            }

            // ===============================================
            // QTY KIRIM
            // ===============================================

            const qtyKirim =
              toNumber(
                item.qty
              );

            if (
              !Number.isFinite(
                qtyKirim
              ) ||
              qtyKirim <= 0
            ) {
              throw new Error(
                `Qty ${item.barang.name} tidak valid`
              );
            }

            // ===============================================
            // INPUT QTY
            // ===============================================

            const requestedQty =
              inputMap.get(
                item.id
              );

            if (
              requestedQty ===
              undefined
            ) {
              throw new Error(
                `Qty diterima untuk ${item.barang.name} belum dikirim`
              );
            }

            // ===============================================
            // PREVIOUS RECEIVED
            // ===============================================

            const previousReceivedQty =
              toNumber(
                item.receivedQty
              );

            if (
              !Number.isFinite(
                previousReceivedQty
              ) ||
              previousReceivedQty < 0
            ) {
              throw new Error(
                `Qty diterima sebelumnya untuk ${item.barang.name} tidak valid`
              );
            }

            // ===============================================
            // NORMALIZE
            // ===============================================

            const normalizedQtyKirim =
              roundQty(
                qtyKirim
              );

            const normalizedPrevious =
              roundQty(
                previousReceivedQty
              );

            const normalizedRequested =
              roundQty(
                requestedQty
              );

            // ===============================================
            // REQUEST CANNOT DECREASE
            // ===============================================

            if (
              normalizedRequested <
              normalizedPrevious
            ) {
              throw new Error(
                `Qty diterima ${item.barang.name} tidak boleh lebih kecil dari qty yang sudah diterima (${normalizedPrevious})`
              );
            }

            // ===============================================
            // REQUEST CANNOT EXCEED SENT QTY
            // ===============================================

            if (
              normalizedRequested >
              normalizedQtyKirim
            ) {
              throw new Error(
                `Qty diterima ${item.barang.name} tidak boleh lebih besar dari qty kirim (${normalizedQtyKirim})`
              );
            }

            // ===============================================
            // ACTIVE TOTAL
            // ===============================================

            totalActiveQty +=
              normalizedQtyKirim;

            // ===============================================
            // QTY BARU MASUK
            // ===============================================

            const qtyToAdd =
              roundQty(
                normalizedRequested -
                  normalizedPrevious
              );

            if (
              qtyToAdd < 0
            ) {
              throw new Error(
                `Selisih qty penerimaan ${item.barang.name} tidak valid`
              );
            }

            // ===============================================
            // OUTLET MASTER BARANG
            // ===============================================

            const outletBarang =
              await tx.outletBarang.findUnique(
                {
                  where: {
                    outletId_barangId: {
                      outletId:
                        currentTransfer.outletId,

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

            // ===============================================
            // OUTLET MASTER ACTIVE
            // ===============================================

            if (
              outletBarang.aktif !==
              true
            ) {
              throw new Error(
                `Barang ${item.barang.name} sedang tidak aktif di outlet`
              );
            }

            // ===============================================
            // FIND OUTLET STOCK
            // ===============================================

            let stock =
              await tx.outletStock.findUnique(
                {
                  where: {
                    outletId_barangId: {
                      outletId:
                        currentTransfer.outletId,

                      barangId:
                        item.barangId,
                    },
                  },
                }
              );

            // ===============================================
            // STOCK BEFORE
            // ===============================================

            const stockBefore =
              stock
                ? Number(
                    stock.stock || 0
                  )
                : 0;

            if (
              !Number.isFinite(
                stockBefore
              ) ||
              stockBefore < 0
            ) {
              throw new Error(
                `Stock outlet ${item.barang.name} tidak valid`
              );
            }

            // ===============================================
            // CREATE STOCK
            // ===============================================

            if (
              !stock &&
              qtyToAdd > 0
            ) {
              const initialAverageCost =
                Number(
                  item.barang.purchasePrice ??
                    0
                );

              stock =
                await tx.outletStock.create(
                  {
                    data: {
                      outletId:
                        currentTransfer.outletId,

                      barangId:
                        item.barangId,

                      stock:
                        qtyToAdd,

                      minimumStock:
                        Number(
                          item.barang
                            .minimumStock ??
                            0
                        ),

                      averageCost:
                        Number.isFinite(
                          initialAverageCost
                        ) &&
                        initialAverageCost >= 0
                          ? initialAverageCost
                          : 0,
                    },
                  }
                );
            }

            // ===============================================
            // UPDATE EXISTING STOCK
            // ===============================================

            else if (
              stock &&
              qtyToAdd > 0
            ) {
              await tx.outletStock.update(
                {
                  where: {
                    id: stock.id,
                  },

                  data: {
                    stock: {
                      increment:
                        qtyToAdd,
                    },
                  },
                }
              );
            }

            // ===============================================
            // STOCK AFTER
            // ===============================================

            const stockAfter =
              stockBefore +
              qtyToAdd;

            // ===============================================
            // STOCK MUTATION
            //
            // HANYA QTY BARU.
            // ===============================================

            if (
              qtyToAdd > 0
            ) {
              await tx.stockMutation.create(
                {
                  data: {
                    outletId:
                      currentTransfer.outletId,

                    barangId:
                      item.barangId,

                    type:
                      "TRANSFER_IN",

                    qty:
                      qtyToAdd,

                    stockBefore,

                    stockAfter,

                    reference:
                      currentTransfer.number,

                    description:
                      `Penerimaan transfer ${currentTransfer.number}`,
                  },
                }
              );
            }

            // ===============================================
            // UPDATE RECEIVED QTY
            // ===============================================

            if (
              normalizedRequested !==
              normalizedPrevious
            ) {
              await tx.outletTransferItem.update(
                {
                  where: {
                    id: item.id,
                  },

                  data: {
                    receivedQty:
                      normalizedRequested,
                  },
                }
              );
            }

            // ===============================================
            // TRACKING
            // ===============================================

            totalReceivedAfter +=
              normalizedRequested;

            receivedTotalQty +=
              qtyToAdd;

            if (
              normalizedRequested >=
              normalizedQtyKirim
            ) {
              receivedItemCount++;
            } else if (
              normalizedRequested > 0
            ) {
              partialItemCount++;
            }

            if (
              qtyToAdd > 0
            ) {
              receivedItems.push({
                itemId:
                  item.id,

                barangId:
                  item.barangId,

                barang:
                  item.barang.name,

                qtyKirim:
                  normalizedQtyKirim,

                qtyDiterima:
                  normalizedRequested,

                qtyBaruMasuk:
                  qtyToAdd,

                stockBefore,

                stockAfter,
              });
            }
          }

          // =================================================
          // HARUS ADA BARANG BARU
          // =================================================

          if (
            receivedTotalQty <= 0
          ) {
            throw new Error(
              "Tidak ada barang baru yang akan diterima"
            );
          }

          // =================================================
          // FINAL ITEMS
          // =================================================

          const finalItems =
            await tx.outletTransferItem.findMany(
              {
                where: {
                  transferId:
                    currentTransfer.id,
                },

                select: {
                  id: true,
                  qty: true,
                  receivedQty: true,
                  voided: true,
                },

                orderBy: {
                  id: "asc",
                },
              }
            );

          // =================================================
          // FINAL STATUS
          // =================================================

          let allActiveFullyReceived =
            true;

          let hasAnyReceived =
            false;

          let finalTotalQty = 0;
          let finalTotalReceivedQty = 0;

          let activeItemCount = 0;

          for (
            const item of finalItems
          ) {
            // ===============================================
            // VOID
            // ===============================================

            if (
              item.voided === true
            ) {
              continue;
            }

            activeItemCount++;

            const qty =
              Number(
                item.qty || 0
              );

            const received =
              Number(
                item.receivedQty ?? 0
              );

            if (
              !Number.isFinite(
                qty
              ) ||
              qty < 0
            ) {
              throw new Error(
                `Qty transfer item ${item.id} tidak valid`
              );
            }

            if (
              !Number.isFinite(
                received
              ) ||
              received < 0
            ) {
              throw new Error(
                `Qty diterima transfer item ${item.id} tidak valid`
              );
            }

            finalTotalQty +=
              qty;

            finalTotalReceivedQty +=
              received;

            if (
              received > 0
            ) {
              hasAnyReceived = true;
            }

            if (
              received <
              qty
            ) {
              allActiveFullyReceived =
                false;
            }
          }

          // =================================================
          // SEMUA ITEM VOID
          // =================================================

          if (
            activeItemCount === 0
          ) {
            throw new Error(
              "Transfer tidak memiliki item aktif yang dapat diterima"
            );
          }

          // =================================================
          // STATUS AKHIR
          // =================================================

          let finalStatus:
            OutletTransferStatus;

          if (
            allActiveFullyReceived
          ) {
            finalStatus =
              OutletTransferStatus.RECEIVED;
          } else if (
            hasAnyReceived
          ) {
            finalStatus =
              OutletTransferStatus.PARTIAL;
          } else {
            throw new Error(
              "Status penerimaan transfer tidak valid"
            );
          }

          // =================================================
          // UPDATE TRANSFER
          // =================================================

          await tx.outletTransfer.update(
            {
              where: {
                id:
                  currentTransfer.id,
              },

              data: {
                status:
                  finalStatus,
              },
            }
          );

          // =================================================
          // RETURN TRANSACTION RESULT
          // =================================================

          return {
            receivedItemCount,

            partialItemCount,

            voidItemCount,

            receivedTotalQty:
              roundQty(
                receivedTotalQty
              ),

            skippedTotalQty:
              roundQty(
                skippedTotalQty
              ),

            finalTotalQty:
              roundQty(
                finalTotalQty
              ),

            finalTotalReceivedQty:
              roundQty(
                finalTotalReceivedQty
              ),

            totalActiveQty:
              roundQty(
                totalActiveQty
              ),

            totalReceivedAfter:
              roundQty(
                totalReceivedAfter
              ),

            finalStatus,

            receivedItems,

            voidItems,
          };
        }
      );

    // =====================================================
    // SUCCESS MESSAGE
    // =====================================================

    let message =
      `Transfer ${transfer.number} berhasil diterima`;

    if (
      result.finalStatus ===
      OutletTransferStatus.PARTIAL
    ) {
      message =
        `Transfer ${transfer.number} berhasil diterima sebagian`;
    }

    if (
      result.finalStatus ===
      OutletTransferStatus.RECEIVED
    ) {
      message =
        `Transfer ${transfer.number} berhasil diterima seluruhnya`;
    }

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      message,

      data: {
        transferId:
          transfer.id,

        transferNumber:
          transfer.number,

        outletId:
          transfer.outletId,

        outlet:
          transfer.outlet.name,

        status:
          result.finalStatus,

        receivedItemCount:
          result.receivedItemCount,

        partialItemCount:
          result.partialItemCount,

        voidItemCount:
          result.voidItemCount,

        receivedTotalQty:
          result.receivedTotalQty,

        skippedTotalQty:
          result.skippedTotalQty,

        totalQty:
          result.finalTotalQty,

        totalReceivedQty:
          result.finalTotalReceivedQty,

        totalActiveQty:
          result.totalActiveQty,

        totalReceivedAfter:
          result.totalReceivedAfter,

        receivedItems:
          result.receivedItems,

        voidItems:
          result.voidItems,
      },
    });
  } catch (error: any) {
    // =====================================================
    // ERROR LOG
    // =====================================================

    console.error(
      "RECEIVE OUTLET TRANSFER ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Gagal menerima barang transfer";

    // =====================================================
    // BUSINESS ERROR DETECTION
    // =====================================================

    const businessErrorPatterns = [
      "Transfer sudah diterima",
      "Transfer tidak ditemukan",
      "Transfer tidak memiliki barang",
      "Transfer tidak memiliki item aktif",
      "Barang transfer",
      "Barang ",
      "Qty ",
      "Item transfer",
      "Tidak ada barang baru",
      "Status penerimaan",
      "Anda tidak boleh menerima",
      "Barang ",
    ];

    const isBusinessError =
      businessErrorPatterns.some(
        (prefix) =>
          message.startsWith(
            prefix
          )
      );

    // =====================================================
    // RESPONSE
    // =====================================================

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