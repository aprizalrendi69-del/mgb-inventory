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

  // ===================================================
  // SUPPORT SESSION TOKEN
  // ===================================================

  const userBySession = await prisma.user.findFirst({
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

  if (userBySession && userBySession.active) {
    return userBySession;
  }

  // ===================================================
  // SUPPORT JSON SESSION
  // ===================================================

  try {
    const sessionData = JSON.parse(session.value);

    const userId = Number(
      sessionData?.user?.id ??
        sessionData?.id
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

        include: {
          outlet: true,
        },
      });

    if (!user || !user.active) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

// =====================================================
// GET
// HISTORY TRANSFER OUTLET
//
// ADMIN / MANAGER
// -> semua transfer
//
// OUTLET_ADMIN
// -> transfer yang masuk ke outlet sendiri
//
// =====================================================

export async function GET() {
  try {
    const user = await getCurrentUser();

    // ===================================================
    // AUTH
    // ===================================================

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
    // ROLE
    // ===================================================

    const isAdminPusat =
      user.role === "ADMIN" ||
      user.role === "MANAGER";

    const isOutletAdmin =
      user.role === "OUTLET_ADMIN";

    if (
      !isAdminPusat &&
      !isOutletAdmin
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Akses transfer ditolak",
        },
        {
          status: 403,
        }
      );
    }

    // ===================================================
    // OUTLET ADMIN WAJIB PUNYA OUTLET
    // ===================================================

    if (
      isOutletAdmin &&
      !user.outletId
    ) {
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

    // ===================================================
    // FILTER
    //
    // OUTLET_ADMIN:
    // hanya transfer yang masuk ke outlet sendiri
    //
    // ADMIN / MANAGER:
    // semua transfer
    // ===================================================

    const where = isOutletAdmin
      ? {
          outletId: user.outletId!,
        }
      : {};

    // ===================================================
    // GET TRANSFERS
    // ===================================================

    const transfers =
      await prisma.outletTransfer.findMany({
        where,

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
                  source: true,
                  purchasePrice: true,
                },
              },
            },
          },
        },

        orderBy: {
          transferDate: "desc",
        },
      });

    // ===================================================
    // RESPONSE
    // ===================================================

    return NextResponse.json({
      success: true,

      data: transfers.map((transfer) => {
        const totalQty =
          transfer.items.reduce(
            (total, item) =>
              total + Number(item.qty || 0),
            0
          );

        const totalReceived =
          transfer.items.reduce(
            (total, item) =>
              total +
              Number(item.receivedQty || 0),
            0
          );

        const remainingQty = Math.max(
          0,
          totalQty - totalReceived
        );

        let status =
          transfer.status;

        // =================================================
        // STATUS OTOMATIS
        // =================================================

        if (
          totalReceived > 0 &&
          totalReceived < totalQty
        ) {
          status = "PARTIAL";
        }

        if (
          totalQty > 0 &&
          totalReceived >= totalQty
        ) {
          status = "RECEIVED";
        }

        return {
          id: transfer.id,

          number: transfer.number,

          sourceOutletId:
            transfer.sourceOutletId,

          outletId:
            transfer.outletId,

          sourceOutlet:
            transfer.sourceOutlet
              ? {
                  id:
                    transfer.sourceOutlet.id,

                  code:
                    transfer.sourceOutlet.code,

                  name:
                    transfer.sourceOutlet.name,

                  active:
                    transfer.sourceOutlet.active,
                }
              : null,

          destinationOutlet:
            transfer.outlet
              ? {
                  id:
                    transfer.outlet.id,

                  code:
                    transfer.outlet.code,

                  name:
                    transfer.outlet.name,

                  active:
                    transfer.outlet.active,
                }
              : null,

          // Alias FE lama
          outlet:
            transfer.outlet
              ? {
                  id:
                    transfer.outlet.id,

                  code:
                    transfer.outlet.code,

                  name:
                    transfer.outlet.name,
                }
              : null,

          transferDate:
            transfer.transferDate,

          status,

          remarks:
            transfer.remarks,

          createdAt:
            transfer.createdAt,

          updatedAt:
            transfer.updatedAt,

          totalQty,

          totalReceived,

          remainingQty,

          items:
            transfer.items.map(
              (item) => ({
                id: item.id,

                transferId:
                  item.transferId,

                barangId:
                  item.barangId,

                qty:
                  Number(item.qty),

                receivedQty:
                  Number(
                    item.receivedQty
                  ),

                remainingQty:
                  Math.max(
                    0,
                    Number(item.qty) -
                      Number(
                        item.receivedQty
                      )
                  ),

                barang:
                  item.barang,
              })
            ),
        };
      }),
    });
  } catch (error) {
    console.error(
      "GET OUTLET TRANSFER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil data transfer",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// POST
// BUAT TRANSFER OUTLET -> OUTLET
//
// SOURCE:
// user.outletId
//
// DESTINATION:
// body.destinationOutletId
//
// SAAT TRANSFER DIBUAT:
// - stok outlet asal berkurang
// - receivedQty = 0
// - status = SENT
//
// SAAT DITERIMA:
// - stok outlet tujuan bertambah
// - receivedQty bertambah
// - status PARTIAL / RECEIVED
//
// RECEIVE DILAKUKAN DI:
// /api/outlet/transfer/[id]/receive
// =====================================================

export async function POST(
  req: NextRequest
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
    // 2. PERMISSION
    // ===================================================

    const allowed =
      user.role === "OUTLET_ADMIN" ||
      user.role === "ADMIN" ||
      user.role === "MANAGER";

    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses membuat transfer",
        },
        {
          status: 403,
        }
      );
    }

    // ===================================================
    // 3. OUTLET ASAL
    //
    // Untuk transfer outlet -> outlet,
    // source wajib berasal dari session user.
    // Tidak menerima sourceOutletId dari frontend.
    // ===================================================

    if (!user.outletId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User tidak memiliki outlet asal",
        },
        {
          status: 400,
        }
      );
    }

    const sourceOutletId =
      Number(user.outletId);

    // ===================================================
    // 4. BODY
    // ===================================================

    const body = await req.json();

    const destinationOutletId =
      Number(
        body.destinationOutletId
      );

    const items =
      Array.isArray(body.items)
        ? body.items
        : [];

    const remarks =
      typeof body.remarks === "string"
        ? body.remarks.trim()
        : null;

    // ===================================================
    // 5. VALIDASI TUJUAN
    // ===================================================

    if (
      !Number.isInteger(
        destinationOutletId
      ) ||
      destinationOutletId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tujuan wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 6. VALIDASI ITEMS
    // ===================================================

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang transfer wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 7. OUTLET ASAL ≠ TUJUAN
    // ===================================================

    if (
      sourceOutletId ===
      destinationOutletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tujuan tidak boleh sama dengan outlet asal",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 8. CEK OUTLET ASAL
    // ===================================================

    const sourceOutlet =
      await prisma.outlet.findUnique({
        where: {
          id: sourceOutletId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },
      });

    if (
      !sourceOutlet ||
      !sourceOutlet.active
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet asal tidak ditemukan atau tidak aktif",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 9. CEK OUTLET TUJUAN
    // ===================================================

    const destinationOutlet =
      await prisma.outlet.findUnique({
        where: {
          id: destinationOutletId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },
      });

    if (
      !destinationOutlet ||
      !destinationOutlet.active
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tujuan tidak ditemukan atau tidak aktif",
        },
        {
          status: 404,
        }
      );
    }

    // ===================================================
    // 10. VALIDASI ITEM
    // ===================================================

    const validatedItems: {
      barangId: number;
      qty: number;
    }[] = [];

    for (const item of items) {
      const barangId =
        Number(item.barangId);

      const qty =
        Number(item.qty);

      if (
        !Number.isInteger(
          barangId
        ) ||
        barangId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Barang tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !Number.isFinite(qty) ||
        qty <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Qty barang harus lebih dari 0",
          },
          {
            status: 400,
          }
        );
      }

      validatedItems.push({
        barangId,
        qty,
      });
    }

    // ===================================================
    // 11. GABUNG BARANG YANG SAMA
    // ===================================================

    const groupedItems =
      new Map<number, number>();

    for (const item of validatedItems) {
      groupedItems.set(
        item.barangId,
        (groupedItems.get(
          item.barangId
        ) || 0) + item.qty
      );
    }

    const finalItems =
      Array.from(
        groupedItems.entries()
      ).map(
        ([barangId, qty]) => ({
          barangId,
          qty,
        })
      );

    // ===================================================
    // 12. TRANSACTION
    // ===================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          const now = new Date();

          // =============================================
          // VALIDASI STOCK
          // =============================================

          const stockData: {
            barangId: number;
            qty: number;
            stockId: number;
            stockBefore: number;
            stockAfter: number;
            barangName: string;
            unit: string;
            averageCost: number;
          }[] = [];

          for (const item of finalItems) {
            const stock =
              await tx.outletStock.findUnique({
                where: {
                  outletId_barangId: {
                    outletId:
                      sourceOutletId,

                    barangId:
                      item.barangId,
                  },
                },

                include: {
                  barang: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      unit: true,
                      source: true,
                      active: true,
                      purchasePrice: true,
                    },
                  },
                },
              });

            if (!stock) {
              throw new Error(
                `Barang ID ${item.barangId} tidak tersedia di outlet ${sourceOutlet.name}`
              );
            }

            if (!stock.barang.active) {
              throw new Error(
                `Barang ${stock.barang.name} sudah tidak aktif`
              );
            }

            // ===========================================
            // HANYA BARANG CENTRAL
            // ===========================================

            if (
              stock.barang.source !==
              "CENTRAL"
            ) {
              throw new Error(
                `Barang ${stock.barang.name} bukan barang CENTRAL dan tidak dapat ditransfer`
              );
            }

            const stockBefore =
              Number(stock.stock);

            if (
              stockBefore <
              item.qty
            ) {
              throw new Error(
                `Stok ${stock.barang.name} tidak mencukupi. ` +
                  `Tersedia: ${stockBefore} ${stock.barang.unit}, ` +
                  `transfer: ${item.qty} ${stock.barang.unit}`
              );
            }

            const stockAfter =
              stockBefore -
              item.qty;

            stockData.push({
              barangId:
                item.barangId,

              qty:
                item.qty,

              stockId:
                stock.id,

              stockBefore,

              stockAfter,

              barangName:
                stock.barang.name,

              unit:
                stock.barang.unit,

              averageCost:
                Number(
                  stock.averageCost ||
                    stock.barang
                      .purchasePrice ||
                    0
                ),
            });
          }

          // =============================================
          // 13. NOMOR TRANSFER
          // =============================================

          const period =
            `${now.getFullYear()}${String(
              now.getMonth() + 1
            ).padStart(2, "0")}`;

          const counter =
            await tx.documentNumber.upsert({
              where: {
                type_period: {
                  type:
                    "OUTLET_TRANSFER",

                  period,
                },
              },

              update: {
                lastNumber: {
                  increment: 1,
                },
              },

              create: {
                type:
                  "OUTLET_TRANSFER",

                prefix: "OT",

                period,

                lastNumber: 1,
              },
            });

          const number =
            `${counter.prefix}-${period}-${String(
              counter.lastNumber
            ).padStart(4, "0")}`;

          // =============================================
          // 14. CREATE TRANSFER
          //
          // sourceOutletId = ASAL
          // outletId       = TUJUAN
          // =============================================

          const transfer =
            await tx.outletTransfer.create({
              data: {
                number,

                sourceOutletId:
                  sourceOutletId,

                outletId:
                  destinationOutletId,

                transferDate:
                  now,

                status: "SENT",

                remarks:
                  remarks,

                items: {
                  create:
                    finalItems.map(
                      (item) => ({
                        barangId:
                          item.barangId,

                        qty:
                          item.qty,

                        receivedQty: 0,
                      })
                    ),
                },
              },

              include: {
                items: {
                  include: {
                    barang: true,
                  },
                },

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
              },
            });

          // =============================================
          // 15. KURANGI STOCK OUTLET ASAL
          // =============================================

          for (const item of stockData) {
            await tx.outletStock.update({
              where: {
                id: item.stockId,
              },

              data: {
                stock:
                  item.stockAfter,
              },
            });

            // ===========================================
            // STOCK CARD OUT
            // ===========================================

            await tx.stockCard.create({
              data: {
                barangId:
                  item.barangId,

                trxDate: now,

                trxType:
                  "OUTLET_TRANSFER_OUT",

                trxNumber:
                  number,

                referenceId:
                  transfer.id,

                warehouse:
                  `OUTLET:${sourceOutlet.code}`,

                qtyIn: 0,

                qtyOut:
                  item.qty,

                balance:
                  item.stockAfter,

                unitPrice:
                  item.averageCost,

                totalValue:
                  item.qty *
                  item.averageCost,

                note:
                  `Transfer ${sourceOutlet.name} → ${destinationOutlet.name}`,
              },
            });
          }

          // =============================================
          // 16. HISTORY
          // =============================================

          const totalQty =
            finalItems.reduce(
              (total, item) =>
                total + item.qty,
              0
            );

          await tx.history.create({
            data: {
              transactionType:
                "STOCK_OUT",

              referenceNumber:
                number,

              userId:
                user.id,

              description:
                `Transfer barang ${number}: ` +
                `${sourceOutlet.name} → ` +
                `${destinationOutlet.name}. ` +
                `Total ${totalQty} item.`,
            },
          });

          return {
            transfer,
            stockData,
            totalQty,
          };
        }
      );

    // ===================================================
    // 17. RESPONSE
    // ===================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Transfer berhasil dibuat",

        data: {
          id:
            result.transfer.id,

          number:
            result.transfer.number,

          sourceOutletId:
            result.transfer
              .sourceOutletId,

          destinationOutletId:
            result.transfer
              .outletId,

          sourceOutlet:
            result.transfer
              .sourceOutlet,

          destinationOutlet:
            result.transfer
              .outlet,

          status:
            result.transfer.status,

          transferDate:
            result.transfer
              .transferDate,

          remarks:
            result.transfer.remarks,

          totalQty:
            result.totalQty,

          totalReceived: 0,

          remainingQty:
            result.totalQty,

          items:
            result.transfer.items.map(
              (item) => ({
                id:
                  item.id,

                transferId:
                  item.transferId,

                barangId:
                  item.barangId,

                qty:
                  Number(
                    item.qty
                  ),

                receivedQty:
                  Number(
                    item.receivedQty
                  ),

                remainingQty:
                  Math.max(
                    0,
                    Number(
                      item.qty
                    ) -
                      Number(
                        item.receivedQty
                      )
                  ),

                barang: {
                  id:
                    item.barang.id,

                  code:
                    item.barang.code,

                  name:
                    item.barang.name,

                  unit:
                    item.barang.unit,
                },
              })
            ),
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST OUTLET TRANSFER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Gagal membuat transfer",
      },
      {
        status: 500,
      }
    );
  }
}