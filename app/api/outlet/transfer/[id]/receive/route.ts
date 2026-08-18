import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// =====================================================
// CURRENT USER
// =====================================================

async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session?.value) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      sessions: {
        some: {
          token: session.value,
          expiresAt: {
            gt: new Date(),
          },
        },
      },
    },
    include: {
      outlet: true,
    },
  });

  if (!user || !user.active) {
    return null;
  }

  return user;
}

// =====================================================
// POST
// RECEIVE TRANSFER OUTLET
//
// Transfer:
// OUTLET A
//    ↓
// OUTLET B
//
// Saat SEND:
// - stock OUTLET A sudah berkurang
//
// Saat RECEIVE:
// - stock OUTLET B bertambah
// - receivedQty bertambah
// - status transfer berubah
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

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        {
          status: 401,
        }
      );
    }

    // ===================================================
    // 2. ROLE
    // ===================================================

    if (
      user.role !== "OUTLET_ADMIN" &&
      user.role !== "ADMIN" &&
      user.role !== "MANAGER"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Akses ditolak",
        },
        {
          status: 403,
        }
      );
    }

    // ===================================================
    // 3. PARAM ID
    // ===================================================

    const { id } = await context.params;

    const transferId = Number(id);

    if (
      !Number.isInteger(transferId) ||
      transferId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "ID transfer tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 4. BODY
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

    const requestedItems = Array.isArray(
      body?.items
    )
      ? body.items
      : null;

    // ===================================================
    // 5. GET TRANSFER
    // ===================================================

    const transfer =
      await prisma.outletTransfer.findUnique({
        where: {
          id: transferId,
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
                },
              },
            },
          },
        },
      });

    if (!transfer) {
      return NextResponse.json(
        {
          success: false,
          message: "Transfer tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // ===================================================
    // 6. VALIDASI OUTLET TUJUAN
    // ===================================================

    if (
      !transfer.outlet ||
      !transfer.outlet.active
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet tujuan tidak aktif",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 7. SECURITY OUTLET ADMIN
    //
    // OUTLET_ADMIN hanya boleh menerima
    // transfer yang ditujukan ke outlet sendiri.
    // ===================================================

    if (
      user.role === "OUTLET_ADMIN"
    ) {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User belum terhubung ke outlet",
          },
          {
            status: 400,
          }
        );
      }

      if (
        transfer.outlet.id !==
        user.outletId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Transfer bukan untuk outlet Anda",
          },
          {
            status: 403,
          }
        );
      }
    }

    // ===================================================
    // 8. VALIDASI STATUS
    // ===================================================

    if (
      transfer.status === "RECEIVED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Transfer sudah diterima seluruhnya",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 9. VALIDASI SOURCE
    // ===================================================

    if (
      transfer.sourceOutlet.id ===
      transfer.outlet.id
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet asal dan tujuan tidak boleh sama",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 10. VALIDASI ITEM + HITUNG QTY RECEIVE
    // ===================================================

    const receiveItems: {
      itemId: number;
      barangId: number;
      qty: number;
      previousReceived: number;
      remaining: number;
    }[] = [];

    for (const item of transfer.items) {
      const qty =
        Number(item.qty);

      const receivedQty =
        Number(item.receivedQty || 0);

      const remaining =
        qty - receivedQty;

      if (remaining <= 0) {
        continue;
      }

      // -------------------------------------------------
      // Jika frontend mengirim items
      // -------------------------------------------------

      let receiveQty = remaining;

      if (requestedItems) {
        const requested =
          requestedItems.find(
            (x: any) =>
              Number(x?.itemId) ===
              item.id
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
          return NextResponse.json(
            {
              success: false,
              message:
                `Qty receive ${item.barang.name} tidak valid`,
            },
            {
              status: 400,
            }
          );
        }

        if (
          receiveQty > remaining
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                `Qty receive ${item.barang.name} melebihi sisa transfer. Sisa: ${remaining} ${item.barang.unit}`,
            },
            {
              status: 400,
            }
          );
        }
      }

      receiveItems.push({
        itemId: item.id,
        barangId: item.barangId,
        qty: receiveQty,
        previousReceived: receivedQty,
        remaining,
      });
    }

    if (
      receiveItems.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak ada barang yang dapat diterima",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 11. TRANSACTION
    // ===================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          const now = new Date();

          // ---------------------------------------------
          // RELOAD TRANSFER DALAM TRANSACTION
          // ---------------------------------------------

          const current =
            await tx.outletTransfer.findUnique(
              {
                where: {
                  id: transferId,
                },

                include: {
                  items: true,
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

          if (
            current.status ===
            "RECEIVED"
          ) {
            throw new Error(
              "Transfer sudah diterima"
            );
          }

          // ---------------------------------------------
          // PROSES ITEM
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

            const receiveQty =
              Math.min(
                requested.qty,
                remaining
              );

            if (
              receiveQty <= 0
            ) {
              continue;
            }

            // -------------------------------------------
            // GET / CREATE OUTLET STOCK
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
            // COST
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

            const stockAfter =
              stockBefore +
              receiveQty;

            const totalCost =
              unitCost *
              receiveQty;

            // -------------------------------------------
            // UPDATE / CREATE STOCK OUTLET
            // -------------------------------------------

            if (stock) {
              const oldStock =
                Number(
                  stock.stock
                );

              const oldAverage =
                Number(
                  stock.averageCost ||
                    0
                );

              const oldQty =
                oldStock;

              const newAverage =
                oldQty +
                  receiveQty >
                0
                  ? (
                      oldQty *
                        oldAverage +
                      receiveQty *
                        unitCost
                    ) /
                    (
                      oldQty +
                      receiveQty
                    )
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
                      0,

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
                item.qty
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
          // PER ITEM
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
                    `Transfer masuk dari ${current.sourceOutlet.name}`,
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
    // 12. RESPONSE
    // ===================================================

    return NextResponse.json({
      success: true,

      message:
        result.status === "RECEIVED"
          ? "Transfer berhasil diterima seluruhnya"
          : "Sebagian transfer berhasil diterima",

      data: {
        id:
          result.transfer.id,

        number:
          result.transfer.number,

        sourceOutlet:
          result.transfer
            .sourceOutlet,

        destinationOutlet:
          result.transfer
            .outlet,

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