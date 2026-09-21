import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// =====================================================
// CURRENT USER
// =====================================================
//
// Mendukung:
//
// 1. erp-session sebagai token Prisma Session
//
// 2. erp-session sebagai JSON session
//    {"id": 1}
//    {"user": {"id": 1}}
//
// Ini dibuat konsisten dengan sistem login ERP.
// =====================================================

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session =
    cookieStore.get("erp-session") ||
    cookieStore.get("session");

  if (!session?.value) {
    return null;
  }

  // ===================================================
  // 1. SESSION TOKEN
  // ===================================================

  try {
    const dbSession =
      await prisma.session.findUnique({
        where: {
          token: session.value,
        },

        select: {
          expiresAt: true,

          user: {
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
          },
        },
      });

    if (
      dbSession &&
      dbSession.expiresAt > new Date() &&
      dbSession.user.active
    ) {
      return dbSession.user;
    }
  } catch (error) {
    console.warn(
      "GET CURRENT USER SESSION TOKEN ERROR:",
      error
    );
  }

  // ===================================================
  // 2. JSON SESSION
  // ===================================================

  try {
    const sessionData =
      JSON.parse(session.value);

    const userId = Number(
      sessionData?.id ??
        sessionData?.user?.id ??
        0
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return null;
    }

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
  } catch {
    return null;
  }
}

// =====================================================
// RESPONSE HELPERS
// =====================================================

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

// =====================================================
// POST
// RECEIVE TRANSFER ANTAR OUTLET
// =====================================================
//
// HANYA:
//
// OUTLET A
//    ↓
// OUTLET B
//
// BUKAN:
//
// GUDANG PUSAT
//    ↓
// OUTLET
//
// RULE:
//
// sourceOutletId != NULL
//     = transfer antar outlet
//
// sourceOutletId == NULL
//     = delivery pusat
//     = DITOLAK endpoint ini
//
// Saat SEND:
// - stock OUTLET A sudah berkurang
//
// Saat RECEIVE:
// - stock OUTLET B bertambah
// - receivedQty bertambah
// - status SENT / PARTIAL / RECEIVED
// - StockCard OUTLET_TRANSFER_IN dibuat
// - History dibuat
//
// Barang.stock pusat TIDAK disentuh.
// =====================================================

export async function POST(
  req: NextRequest,
  context: {
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
      return fail(
        "Tidak login",
        401
      );
    }

    // ===================================================
    // 2. USER ACTIVE
    // ===================================================

    if (!user.active) {
      return fail(
        "User tidak aktif",
        403
      );
    }

    // ===================================================
    // 3. ROLE
    // ===================================================

    const role =
      String(
        user.role || ""
      )
        .trim()
        .toUpperCase();

    if (
      role !== "OUTLET_ADMIN" &&
      role !== "ADMIN" &&
      role !== "MANAGER"
    ) {
      return fail(
        "Akses ditolak",
        403
      );
    }

    // ===================================================
    // 4. PARAM ID
    // ===================================================

    const { id } =
      await context.params;

    const rawId =
      String(id || "")
        .trim();

    const transferId =
      Number(
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
      return fail(
        "ID transfer tidak valid",
        400
      );
    }

    // ===================================================
    // 5. BODY
    // ===================================================
    //
    // Bisa:
    //
    // {
    //   "items": [
    //     {
    //       "itemId": 1,
    //       "receivedQty": 10
    //     }
    //   ]
    // }
    //
    // Jika items tidak dikirim:
    // semua sisa qty akan diterima.
    // ===================================================

    let body: any = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const requestedItems =
      Array.isArray(body?.items)
        ? body.items
        : null;

    // ===================================================
    // 6. GET TRANSFER
    // ===================================================
    //
    // PENTING:
    //
    // sourceOutletId WAJIB TIDAK NULL.
    //
    // Jadi delivery pusat tidak akan pernah diproses
    // oleh endpoint ini.
    // ===================================================

    const transfer =
      await prisma.outletTransfer.findFirst({
        where: {
          id: transferId,

          sourceOutletId: {
            not: null,
          },
        },

        include: {
          sourceOutlet: {
            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
          },

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
                  unit: true,
                  purchasePrice: true,
                  active: true,
                  source: true,
                  minimumStock: true,
                },
              },
            },
          },
        },
      });

    // ===================================================
    // 7. TRANSFER TIDAK DITEMUKAN
    // ===================================================

    if (!transfer) {
      return fail(
        "Transfer antar outlet tidak ditemukan",
        404
      );
    }

    // ===================================================
    // 8. SOURCE OUTLET WAJIB ADA
    // ===================================================

    if (
      !transfer.sourceOutletId ||
      !transfer.sourceOutlet
    ) {
      return fail(
        "Transfer ini bukan transfer antar outlet",
        400
      );
    }

    // ===================================================
    // 9. SOURCE DAN TUJUAN TIDAK BOLEH SAMA
    // ===================================================

    if (
      transfer.sourceOutletId ===
      transfer.outletId
    ) {
      return fail(
        "Outlet asal dan tujuan tidak boleh sama",
        400
      );
    }

    // ===================================================
    // 10. SOURCE OUTLET HARUS AKTIF
    // ===================================================

    if (
      !transfer.sourceOutlet.active
    ) {
      return fail(
        "Outlet asal tidak aktif",
        400
      );
    }

    // ===================================================
    // 11. OUTLET TUJUAN HARUS AKTIF
    // ===================================================

    if (
      !transfer.outlet ||
      !transfer.outlet.active
    ) {
      return fail(
        "Outlet tujuan tidak aktif",
        400
      );
    }

    // ===================================================
    // 12. SECURITY OUTLET ADMIN
    // ===================================================
    //
    // OUTLET_ADMIN hanya boleh menerima transfer
    // yang ditujukan ke outlet miliknya.
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
        return fail(
          "User belum terhubung ke outlet",
          400
        );
      }

      if (
        transfer.outletId !==
        user.outletId
      ) {
        return fail(
          "Transfer bukan untuk outlet Anda",
          403
        );
      }
    }

    // ===================================================
    // 13. STATUS
    // ===================================================

    if (
      String(
        transfer.status
      ).toUpperCase() ===
      "RECEIVED"
    ) {
      return fail(
        "Transfer sudah diterima seluruhnya",
        400
      );
    }

    // ===================================================
    // 14. TRANSFER HARUS MEMILIKI ITEM
    // ===================================================

    if (
      !transfer.items.length
    ) {
      return fail(
        "Transfer tidak memiliki barang",
        400
      );
    }

    // ===================================================
    // 15. VALIDASI ITEM + HITUNG QTY RECEIVE
    // =====================================================

    const receiveItems: {
      itemId: number;
      barangId: number;
      qty: number;
      previousReceived: number;
      remaining: number;
    }[] = [];

    for (
      const item of transfer.items
    ) {
      if (!item.barang) {
        return fail(
          `Barang transfer ID ${item.barangId} tidak ditemukan`,
          400
        );
      }

      const qty =
        Number(item.qty);

      const receivedQty =
        Number(
          item.receivedQty || 0
        );

      if (
        !Number.isFinite(qty) ||
        qty <= 0
      ) {
        return fail(
          `Qty transfer ${item.barang.name} tidak valid`,
          400
        );
      }

      if (
        !Number.isFinite(
          receivedQty
        ) ||
        receivedQty < 0
      ) {
        return fail(
          `Qty received ${item.barang.name} tidak valid`,
          400
        );
      }

      if (
        receivedQty > qty
      ) {
        return fail(
          `Qty received ${item.barang.name} melebihi qty transfer`,
          400
        );
      }

      const remaining =
        qty - receivedQty;

      if (remaining <= 0) {
        continue;
      }

      // -------------------------------------------------
      // DEFAULT:
      // Jika frontend tidak mengirim items,
      // terima seluruh sisa.
      // -------------------------------------------------

      let receiveQty =
        remaining;

      // -------------------------------------------------
      // Jika frontend mengirim items,
      // hanya item yang dikirim yang diproses.
      // -------------------------------------------------

      if (requestedItems) {
        const requested =
          requestedItems.find(
            (x: any) =>
              Number(
                x?.itemId
              ) === item.id
          );

        if (!requested) {
          continue;
        }

        receiveQty =
          Number(
            requested.receivedQty
          );

        if (
          !Number.isFinite(
            receiveQty
          ) ||
          receiveQty <= 0
        ) {
          return fail(
            `Qty receive ${item.barang.name} tidak valid`,
            400
          );
        }

        if (
          receiveQty >
          remaining
        ) {
          return fail(
            `Qty receive ${item.barang.name} melebihi sisa transfer. Sisa: ${remaining} ${item.barang.unit}`,
            400
          );
        }
      }

      receiveItems.push({
        itemId: item.id,

        barangId:
          item.barangId,

        qty:
          receiveQty,

        previousReceived:
          receivedQty,

        remaining,
      });
    }

    // ===================================================
    // 16. HARUS ADA ITEM YANG DITERIMA
    // ===================================================

    if (
      receiveItems.length === 0
    ) {
      return fail(
        "Tidak ada barang yang dapat diterima",
        400
      );
    }

    // ===================================================
    // 17. TRANSACTION
    // ===================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          const now =
            new Date();

          // ---------------------------------------------
          // RELOAD TRANSFER
          // ---------------------------------------------

          const current =
            await tx.outletTransfer.findUnique(
              {
                where: {
                  id: transferId,
                },

                include: {
                  items: {
                    include: {
                      barang: {
                        select: {
                          id: true,
                          code: true,
                          name: true,
                          unit: true,
                          purchasePrice:
                            true,
                          minimumStock:
                            true,
                          active:
                            true,
                          source:
                            true,
                        },
                      },
                    },
                  },

                  sourceOutlet: true,

                  outlet: true,
                },
              }
            );

          if (!current) {
            throw new Error(
              "Transfer tidak ditemukan"
            );
          }

          // ---------------------------------------------
          // WAJIB TRANSFER ANTAR OUTLET
          // ---------------------------------------------

          if (
            !current.sourceOutletId ||
            !current.sourceOutlet
          ) {
            throw new Error(
              "Transfer ini bukan transfer antar outlet"
            );
          }

          // ---------------------------------------------
          // SOURCE DAN TUJUAN
          // ---------------------------------------------

          if (
            current.sourceOutletId ===
            current.outletId
          ) {
            throw new Error(
              "Outlet asal dan tujuan tidak boleh sama"
            );
          }

          // ---------------------------------------------
          // OUTLET AKTIF
          // ---------------------------------------------

          if (
            !current.sourceOutlet.active
          ) {
            throw new Error(
              "Outlet asal tidak aktif"
            );
          }

          if (
            !current.outlet.active
          ) {
            throw new Error(
              "Outlet tujuan tidak aktif"
            );
          }

          // ---------------------------------------------
          // STATUS
          // ---------------------------------------------

          if (
            String(
              current.status
            ).toUpperCase() ===
            "RECEIVED"
          ) {
            throw new Error(
              "Transfer sudah diterima"
            );
          }

          // ---------------------------------------------
          // PROCESSED ITEMS
          // ---------------------------------------------

          const processedItems: {
            barangId: number;
            qty: number;
            receivedQty: number;
            stockBefore: number;
            stockAfter: number;
            unitCost: number;
            totalCost: number;
          }[] = [];

          // ---------------------------------------------
          // PROSES ITEM
          // ---------------------------------------------

          for (
            const requested of receiveItems
          ) {
            const item =
              current.items.find(
                (x) =>
                  x.id ===
                  requested.itemId
              );

            if (!item) {
              throw new Error(
                `Item transfer ${requested.itemId} tidak ditemukan`
              );
            }

            if (!item.barang) {
              throw new Error(
                `Barang transfer ID ${item.barangId} tidak ditemukan`
              );
            }

            // -------------------------------------------
            // BARANG HARUS CENTRAL
            // -------------------------------------------

            if (
              item.barang.source !==
              "CENTRAL"
            ) {
              throw new Error(
                `Barang ${item.barang.name} bukan barang Master Pusat`
              );
            }

            // -------------------------------------------
            // BARANG HARUS AKTIF
            // -------------------------------------------

            if (
              item.barang.active ===
              false
            ) {
              throw new Error(
                `Barang ${item.barang.name} sedang tidak aktif`
              );
            }

            const currentReceived =
              Number(
                item.receivedQty || 0
              );

            const transferQty =
              Number(
                item.qty
              );

            const remaining =
              transferQty -
              currentReceived;

            if (
              remaining <= 0
            ) {
              continue;
            }

            const requestedQty =
              Number(
                requested.qty
              );

            if (
              !Number.isFinite(
                requestedQty
              ) ||
              requestedQty <= 0
            ) {
              continue;
            }

            const receiveQty =
              Math.min(
                requestedQty,
                remaining
              );

            if (
              receiveQty <= 0
            ) {
              continue;
            }

            // -------------------------------------------
            // GET STOCK OUTLET TUJUAN
            // -------------------------------------------

            const stock =
              await tx.outletStock.findUnique(
                {
                  where: {
                    outletId_barangId: {
                      outletId:
                        current.outletId,

                      barangId:
                        item.barangId,
                    },
                  },
                }
              );

            const stockBefore =
              Number(
                stock?.stock || 0
              );

            // -------------------------------------------
            // UNIT COST
            // -------------------------------------------

            const barang =
              await tx.barang.findUnique(
                {
                  where: {
                    id:
                      item.barangId,
                  },

                  select: {
                    purchasePrice:
                      true,
                  },
                }
              );

            const unitCost =
              Number(
                stock?.averageCost ??
                  barang?.purchasePrice ??
                  0
              );

            // -------------------------------------------
            // STOCK AFTER
            // -------------------------------------------

            const stockAfter =
              stockBefore +
              receiveQty;

            const totalCost =
              unitCost *
              receiveQty;

            // -------------------------------------------
            // UPDATE / CREATE OUTLET STOCK
            // -------------------------------------------

            if (stock) {
              const oldStock =
                Number(
                  stock.stock || 0
                );

              const oldAverage =
                Number(
                  stock.averageCost || 0
                );

              const totalQtyAfter =
                oldStock +
                receiveQty;

              const newAverage =
                totalQtyAfter > 0
                  ? (
                      oldStock *
                        oldAverage +
                      receiveQty *
                        unitCost
                    ) /
                    totalQtyAfter
                  : unitCost;

              await tx.outletStock.update(
                {
                  where: {
                    id:
                      stock.id,
                  },

                  data: {
                    stock:
                      stockAfter,

                    averageCost:
                      newAverage,
                  },
                }
              );
            } else {
              await tx.outletStock.create(
                {
                  data: {
                    outletId:
                      current.outletId,

                    barangId:
                      item.barangId,

                    stock:
                      receiveQty,

                    minimumStock:
                      Number(
                        item.barang
                          .minimumStock ??
                          0
                      ),

                    averageCost:
                      unitCost,
                  },
                }
              );
            }

            // -------------------------------------------
            // UPDATE RECEIVED QTY
            // -------------------------------------------

            const newReceivedQty =
              currentReceived +
              receiveQty;

            await tx.outletTransferItem.update(
              {
                where: {
                  id:
                    item.id,
                },

                data: {
                  receivedQty:
                    newReceivedQty,
                },
              }
            );

            // -------------------------------------------
            // TRACK PROCESSED ITEM
            // -------------------------------------------

            processedItems.push({
              barangId:
                item.barangId,

              qty:
                receiveQty,

              receivedQty:
                newReceivedQty,

              stockBefore,

              stockAfter,

              unitCost,

              totalCost,
            });
          }

          // ---------------------------------------------
          // HARUS ADA YANG BERHASIL DIPROSES
          // ---------------------------------------------

          if (
            processedItems.length ===
            0
          ) {
            throw new Error(
              "Tidak ada barang yang dapat diterima"
            );
          }

          // ---------------------------------------------
          // HITUNG STATUS TRANSFER
          // ---------------------------------------------

          const updatedItems =
            await tx.outletTransferItem.findMany(
              {
                where: {
                  transferId:
                    transferId,
                },
              }
            );

          let totalQty = 0;
          let totalReceived = 0;

          for (
            const item of updatedItems
          ) {
            totalQty +=
              Number(
                item.qty || 0
              );

            totalReceived +=
              Number(
                item.receivedQty ||
                  0
              );
          }

          let status:
            | "SENT"
            | "PARTIAL"
            | "RECEIVED" =
            "SENT";

          if (
            totalReceived > 0 &&
            totalReceived <
              totalQty
          ) {
            status =
              "PARTIAL";
          }

          if (
            totalQty > 0 &&
            totalReceived >=
              totalQty
          ) {
            status =
              "RECEIVED";
          }

          // ---------------------------------------------
          // UPDATE TRANSFER
          // ---------------------------------------------

          const updatedTransfer =
            await tx.outletTransfer.update(
              {
                where: {
                  id:
                    transferId,
                },

                data: {
                  status,
                },

                include: {
                  sourceOutlet: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                    },
                  },

                  outlet: {
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
                          unit: true,
                          purchasePrice:
                            true,
                        },
                      },
                    },
                  },
                },
              }
            );

          // ---------------------------------------------
          // STOCK CARD
          //
          // SATU STOCK CARD PER ITEM YANG DITERIMA
          // ---------------------------------------------

          for (
            const item of processedItems
          ) {
            await tx.stockCard.create(
              {
                data: {
                  barangId:
                    item.barangId,

                  trxDate:
                    now,

                  trxType:
                    "OUTLET_TRANSFER_IN",

                  trxNumber:
                    current.number,

                  referenceId:
                    current.id,

                  warehouse:
                    `OUTLET:${current.outlet.code}`,

                  qtyIn:
                    item.qty,

                  qtyOut:
                    0,

                  balance:
                    item.stockAfter,

                  unitPrice:
                    item.unitCost,

                  totalValue:
                    item.totalCost,

                  note:
                    `Transfer masuk antar outlet dari ${current.sourceOutlet.name}`,
                },
              }
            );
          }

          // ---------------------------------------------
          // HISTORY
          // ---------------------------------------------

          const descriptionItems =
            processedItems.map(
              (item) =>
                `${item.qty} barang ID ${item.barangId}`
            );

          await tx.history.create(
            {
              data: {
                transactionType:
                  "STOCK_IN",

                referenceNumber:
                  current.number,

                userId:
                  user.id,

                description:
                  `Transfer ${current.number} diterima di outlet ${current.outlet.name} dari ${current.sourceOutlet.name}. ` +
                  `Item: ${descriptionItems.join(
                    ", "
                  )}. ` +
                  `Status: ${status}.`,
              },
            }
          );

          // ---------------------------------------------
          // RETURN TRANSACTION RESULT
          // ---------------------------------------------

          return {
            transfer:
              updatedTransfer,

            processedItems,

            totalQty,

            totalReceived,

            status,
          };
        }
      );

    // ===================================================
    // 18. RESPONSE
    // ===================================================

    return NextResponse.json({
      success: true,

      message:
        result.status ===
        "RECEIVED"
          ? "Transfer berhasil diterima seluruhnya"
          : "Sebagian transfer berhasil diterima",

      data: {
        id:
          result.transfer.id,

        number:
          result.transfer.number,

        sourceOutlet:
          result.transfer.sourceOutlet,

        destinationOutlet:
          result.transfer.outlet,

        status:
          result.status,

        totalQty:
          result.totalQty,

        totalReceived:
          result.totalReceived,

        items:
          result.transfer.items.map(
            (item) => ({
              id:
                item.id,

              barangId:
                item.barangId,

              code:
                item.barang.code,

              barang:
                item.barang.name,

              unit:
                item.barang.unit,

              qty:
                Number(
                  item.qty
                ),

              receivedQty:
                Number(
                  item.receivedQty
                ),

              remaining:
                Math.max(
                  0,
                  Number(
                    item.qty
                  ) -
                    Number(
                      item.receivedQty
                    )
                ),
            })
          ),
      },
    });
  } catch (error: any) {
    console.error(
      "POST OUTLET TRANSFER RECEIVE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menerima transfer",
      },
      {
        status: 500,
      }
    );
  }
}