import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// =====================================================
// CURRENT LOGIN USER
// =====================================================

async function getLoginUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session) {
    return {
      error: "Tidak login",
      status: 401,
    } as const;
  }

  let sessionData: any;

  try {
    sessionData = JSON.parse(session.value);
  } catch {
    return {
      error: "Session tidak valid",
      status: 401,
    } as const;
  }

  const userId = Number(
    sessionData?.id ??
      sessionData?.user?.id ??
      0
  );

  if (!Number.isInteger(userId) || userId <= 0) {
    return {
      error: "Session tidak valid",
      status: 401,
    } as const;
  }

  const user = await prisma.user.findUnique({
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

  if (!user) {
    return {
      error: "User tidak ditemukan",
      status: 404,
    } as const;
  }

  if (!user.active) {
    return {
      error: "User tidak aktif",
      status: 403,
    } as const;
  }

  const role = String(user.role).toUpperCase();

  // =====================================================
  // ROLE YANG BOLEH AKSES
  // =====================================================

  if (
    role !== "ADMIN" &&
    role !== "MANAGER" &&
    role !== "OUTLET_ADMIN"
  ) {
    return {
      error:
        "Anda tidak memiliki akses approval stock opname outlet",
      status: 403,
    } as const;
  }

  const isOutletAdmin =
    role === "OUTLET_ADMIN";

  // =====================================================
  // OUTLET ADMIN WAJIB TERHUBUNG OUTLET
  // =====================================================

  if (
    isOutletAdmin &&
    (!user.outletId || !user.outlet)
  ) {
    return {
      error:
        "User outlet belum terhubung dengan outlet",
      status: 400,
    } as const;
  }

  return {
    user,
    role,
    isOutletAdmin,
  } as const;
}

// =====================================================
// GET APPROVAL STOCK OPNAME
//
// ADMIN
// -> semua outlet
// -> filter outlet
// -> filter tanggal
// -> filter type
// -> filter status
//
// MANAGER
// -> semua outlet
// -> read only
//
// OUTLET_ADMIN
// -> hanya outlet sendiri
// =====================================================

export async function GET(
  req: NextRequest
) {
  try {
    const login = await getLoginUser();

    if ("error" in login) {
      return NextResponse.json(
        {
          success: false,
          message: login.error,
        },
        {
          status: login.status,
        }
      );
    }

    const {
      user,
      role,
      isOutletAdmin,
    } = login;

    const { searchParams } =
      new URL(req.url);

    // =================================================
    // FILTER
    // =================================================

    const requestedOutletId = Number(
      searchParams.get("outletId") ?? 0
    );

    const dateFrom =
      searchParams.get("dateFrom")?.trim() ||
      "";

    const dateTo =
      searchParams.get("dateTo")?.trim() ||
      "";

    const requestedType =
      searchParams
        .get("type")
        ?.trim()
        .toUpperCase() || "";

    const requestedStatus =
      searchParams
        .get("status")
        ?.trim()
        .toUpperCase() || "";

    // =================================================
    // WHERE
    // =================================================

    const where: any = {
      outletId: {
        not: null,
      },
    };

    // =================================================
    // OUTLET ADMIN
    // =================================================

    if (isOutletAdmin) {
      where.outletId =
        Number(user.outletId);
    }

    // =================================================
    // ADMIN / MANAGER
    // =================================================

    if (!isOutletAdmin) {
      if (
        Number.isInteger(
          requestedOutletId
        ) &&
        requestedOutletId > 0
      ) {
        where.outletId =
          requestedOutletId;
      }
    }

    // =================================================
    // TYPE
    // =================================================

    if (
      requestedType === "WEEKLY" ||
      requestedType === "MONTHLY"
    ) {
      where.type = requestedType;
    }

    // =================================================
    // STATUS
    // =================================================

    if (
      requestedStatus === "COUNTING" ||
      requestedStatus === "COMPLETED" ||
      requestedStatus === "APPROVED"
    ) {
      where.status = requestedStatus;
    }

    // =================================================
    // DATE FILTER
    // =================================================

    if (dateFrom || dateTo) {
      where.date = {};

      if (dateFrom) {
        const start = new Date(
          `${dateFrom}T00:00:00`
        );

        if (!Number.isNaN(start.getTime())) {
          where.date.gte = start;
        }
      }

      if (dateTo) {
        const end = new Date(
          `${dateTo}T23:59:59.999`
        );

        if (!Number.isNaN(end.getTime())) {
          where.date.lte = end;
        }
      }

      if (
        Object.keys(where.date).length === 0
      ) {
        delete where.date;
      }
    }

    // =================================================
    // DATA
    // =================================================

    const data =
      await prisma.stockOpname.findMany({
        where,

        include: {
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
                  purchasePrice: true,
                  sellingPrice: true,
                },
              },
            },

            orderBy: {
              barang: {
                name: "asc",
              },
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    // =================================================
    // LIST OUTLET
    // =================================================

    let outlets: any[] = [];

    if (!isOutletAdmin) {
      outlets =
        await prisma.outlet.findMany({
          select: {
            id: true,
            code: true,
            name: true,
          },

          orderBy: {
            name: "asc",
          },
        });
    }

    return NextResponse.json({
      success: true,

      user: {
        id: user.id,
        fullname: user.fullname,
        role,
        outletId: user.outletId,
      },

      outlet:
        isOutletAdmin
          ? user.outlet || null
          : null,

      outlets,

      data,

      meta: {
        approvalType: "MONTHLY",
        weeklyRequiresApproval: false,
        adminCanDeleteAll: true,

        // =================================================
        // REPORT LEDGER
        // =================================================
        stockOpnameOutboundLedger:
          "STOCK_OPNAME_OUT",
        stockOpnameInboundLedger:
          "STOCK_OPNAME_IN",
      },
    });
  } catch (error: any) {
    console.error(
      "GET OUTLET STOCK OPNAME APPROVAL ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil data approval stock opname",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// POST APPROVE
//
// HANYA MONTHLY
//
// COUNTING
//   ↓
// APPROVED
//   ↓
// outletStock.stock = physicalQty
//
// SEKALIGUS:
// physicalQty < stockBefore
//   -> STOCK_OPNAME_OUT
//
// physicalQty > stockBefore
//   -> STOCK_OPNAME_IN
//
// physicalQty === stockBefore
//   -> tidak membuat movement
//
// WEEKLY
//   ↓
// TIDAK BOLEH APPROVE
// =====================================================

export async function POST(
  req: NextRequest
) {
  try {
    const login = await getLoginUser();

    if ("error" in login) {
      return NextResponse.json(
        {
          success: false,
          message: login.error,
        },
        {
          status: login.status,
        }
      );
    }

    const {
      user,
      role,
      isOutletAdmin,
    } = login;

    // =================================================
    // APPROVAL STOCK OPNAME MONTHLY
    //
    // Tetap mengikuti rule existing:
    // ADMIN / MANAGER / OUTLET_ADMIN
    // dapat melakukan endpoint approval sesuai
    // security outlet yang berlaku.
    // =================================================

    if (
      role !== "ADMIN" &&
      role !== "MANAGER" &&
      role !== "OUTLET_ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses approve stock opname",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // BODY
    // =================================================

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Body request tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const opnameId = Number(
      body?.opnameId ?? 0
    );

    if (
      !Number.isInteger(opnameId) ||
      opnameId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID stock opname tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // AMBIL OPNAME
    // =================================================

    const opname =
      await prisma.stockOpname.findUnique({
        where: {
          id: opnameId,
        },

        include: {
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
                  purchasePrice: true,
                  sellingPrice: true,
                },
              },
            },
          },
        },
      });

    if (!opname) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock opname tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // WAJIB OUTLET
    // =================================================

    if (!opname.outletId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock opname ini bukan stock opname outlet",
        },
        {
          status: 400,
        }
      );
    }

    if (!opname.outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet stock opname tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // SECURITY OUTLET
    // =================================================

    if (isOutletAdmin) {
      if (
        !user.outletId ||
        Number(user.outletId) !==
          Number(opname.outletId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda tidak dapat approve stock opname outlet lain",
          },
          {
            status: 403,
          }
        );
      }
    }

    // =================================================
    // TYPE
    // =================================================

    const opnameType =
      String(
        opname.type
      ).toUpperCase();

    if (opnameType !== "MONTHLY") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock Opname Mingguan tidak memerlukan approval",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // STATUS
    // =================================================

    const currentStatus =
      String(
        opname.status
      ).toUpperCase();

    if (currentStatus === "APPROVED") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock Opname Bulanan ini sudah disetujui",
        },
        {
          status: 400,
        }
      );
    }

    if (currentStatus !== "COUNTING") {
      return NextResponse.json(
        {
          success: false,
          message:
            `Stock Opname Bulanan tidak dapat diapprove karena status saat ini ${opname.status}`,
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // VALIDASI ITEM
    // =================================================

    if (
      !opname.items ||
      opname.items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock opname tidak memiliki barang",
        },
        {
          status: 400,
        }
      );
    }

    const barangIdSet =
      new Set<number>();

    for (const item of opname.items) {
      const barangId =
        Number(item.barangId);

      if (
        !Number.isInteger(barangId) ||
        barangId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Terdapat barang pada stock opname yang tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      if (
        barangIdSet.has(barangId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Terdapat barang duplikat pada stock opname",
          },
          {
            status: 400,
          }
        );
      }

      barangIdSet.add(barangId);

      const physicalQty =
        Number(
          item.physicalQty ?? 0
        );

      if (
        !Number.isFinite(
          physicalQty
        ) ||
        physicalQty < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Qty fisik barang ${
                item.barang?.name ||
                item.barangId
              } tidak valid`,
          },
          {
            status: 400,
          }
        );
      }
    }

    // =================================================
    // TRANSACTION
    // =================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          const currentOpname =
            await tx.stockOpname.findUnique({
              where: {
                id: opnameId,
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
                      },
                    },
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

          if (!currentOpname) {
            throw new Error(
              "Stock opname tidak ditemukan"
            );
          }

          if (
            !currentOpname.outletId
          ) {
            throw new Error(
              "Stock opname tidak memiliki outlet"
            );
          }

          if (!currentOpname.outlet) {
            throw new Error(
              "Outlet stock opname tidak ditemukan"
            );
          }

          // =========================================
          // SECURITY OUTLET
          // =========================================

          if (
            isOutletAdmin &&
            Number(user.outletId) !==
              Number(
                currentOpname.outletId
              )
          ) {
            throw new Error(
              "Stock opname bukan milik outlet user"
            );
          }

          // =========================================
          // TYPE
          // =========================================

          if (
            String(
              currentOpname.type
            ).toUpperCase() !==
            "MONTHLY"
          ) {
            throw new Error(
              "Stock Opname Mingguan tidak memerlukan approval"
            );
          }

          // =========================================
          // STATUS
          // =========================================

          if (
            String(
              currentOpname.status
            ).toUpperCase() !==
            "COUNTING"
          ) {
            throw new Error(
              "Stock Opname Bulanan sudah diproses"
            );
          }

          // =========================================
          // ITEMS
          // =========================================

          if (
            !currentOpname.items ||
            currentOpname.items.length === 0
          ) {
            throw new Error(
              "Stock opname tidak memiliki barang"
            );
          }

          // =========================================
          // UPDATE STOCK OUTLET
          //
          // PENTING:
          // stockBefore harus dibaca SEBELUM stock
          // diganti menjadi physicalQty.
          //
          // Ini menjadi dasar ledger:
          //
          // stockBefore > physicalQty
          // -> STOCK_OPNAME_OUT
          //
          // stockBefore < physicalQty
          // -> STOCK_OPNAME_IN
          // =========================================

          const movementSummary = {
            totalOut: 0,
            totalIn: 0,
            outCount: 0,
            inCount: 0,
            unchangedCount: 0,
          };

          for (
            const item of currentOpname.items
          ) {
            const barangId =
              Number(item.barangId);

            const physicalQty =
              Math.max(
                0,
                Number(
                  item.physicalQty ?? 0
                )
              );

            // =======================================
            // AMBIL STOCK TERKINI
            // =======================================

            const outletStock =
              await tx.outletStock.findUnique({
                where: {
                  outletId_barangId: {
                    outletId:
                      Number(
                        currentOpname.outletId
                      ),
                    barangId,
                  },
                },
              });

            // =======================================
            // STOCK BELUM ADA
            //
            // Tidak ada stockBefore yang bisa
            // dianggap sebagai outbound.
            //
            // Stock langsung dibuat sesuai fisik.
            // =======================================

            if (!outletStock) {
              await tx.outletStock.create({
                data: {
                  outletId:
                    Number(
                      currentOpname.outletId
                    ),
                  barangId,
                  stock: physicalQty,
                  minimumStock: 0,
                  averageCost: 0,
                },
              });

              if (physicalQty > 0) {
                movementSummary.totalIn +=
                  physicalQty;

                movementSummary.inCount += 1;

                // =================================
                // STOCK OPNAME IN
                // =================================

                await tx.stockCard.create({
                  data: {
                    barangId,
                    trxDate:
                      currentOpname.date ??
                      new Date(),

                    trxType:
                      "STOCK_OPNAME_IN",

                    trxNumber:
                      currentOpname.code,

                    referenceId:
                      currentOpname.id,

                    warehouse:
                      `OUTLET:${currentOpname.outlet.code}`,

                    qtyIn:
                      physicalQty,

                    qtyOut: 0,

                    balance:
                      physicalQty,

                    unitPrice: 0,

                    totalValue: 0,

                    note:
                      `Stock Opname Bulanan ${currentOpname.code} - penyesuaian stock awal outlet`,
                  },
                });
              } else {
                movementSummary.unchangedCount +=
                  1;
              }

              continue;
            }

            // =======================================
            // STOCK BEFORE
            // =======================================

            const stockBefore =
              Number(
                outletStock.stock ?? 0
              );

            if (
              !Number.isFinite(stockBefore) ||
              stockBefore < 0
            ) {
              throw new Error(
                `Stock outlet tidak valid untuk barang ${item.barang?.name || barangId}`
              );
            }

            // =======================================
            // SELISIH STOCK OPNAME
            // =======================================

            const difference =
              physicalQty -
              stockBefore;

            // =======================================
            // OUTBOUND
            //
            // physical < stockBefore
            //
            // Contoh:
            // stockBefore = 100
            // physical    = 92
            // difference  = -8
            //
            // Maka:
            // STOCK_OPNAME_OUT = 8
            // =======================================

            if (difference < 0) {
              const qtyOut =
                Math.abs(difference);

              const averageCost =
                Number(
                  outletStock.averageCost ??
                    0
                );

              const totalValue =
                qtyOut *
                (Number.isFinite(
                  averageCost
                )
                  ? averageCost
                  : 0);

              movementSummary.totalOut +=
                qtyOut;

              movementSummary.outCount +=
                1;

              // =====================================
              // STOCK CARD OUT
              // =====================================

              await tx.stockCard.create({
                data: {
                  barangId,

                  trxDate:
                    currentOpname.date ??
                    new Date(),

                  trxType:
                    "STOCK_OPNAME_OUT",

                  trxNumber:
                    currentOpname.code,

                  referenceId:
                    currentOpname.id,

                  warehouse:
                    `OUTLET:${currentOpname.outlet.code}`,

                  qtyIn: 0,

                  qtyOut,

                  balance:
                    physicalQty,

                  unitPrice:
                    Number.isFinite(
                      averageCost
                    )
                      ? averageCost
                      : 0,

                  totalValue,

                  note:
                    `Stock Opname Bulanan ${currentOpname.code} - selisih fisik (${stockBefore} → ${physicalQty})`,
                },
              });

              // =====================================
              // STOCK MUTATION
              //
              // Dipakai sebagai audit tambahan.
              // Qty tetap tidak digunakan sebagai
              // sumber utama report agar tidak
              // double-count dengan StockCard.
              // =====================================

              await tx.stockMutation.create({
                data: {
                  outletId:
                    Number(
                      currentOpname.outletId
                    ),

                  barangId,

                  type:
                    "ADJUSTMENT_OUT",

                  qty: qtyOut,

                  stockBefore,

                  stockAfter:
                    physicalQty,

                  reference:
                    currentOpname.code,

                  description:
                    `Stock Opname Bulanan OUT - ${stockBefore} → ${physicalQty}`,
                },
              });
            }

            // =======================================
            // INBOUND
            //
            // physical > stockBefore
            //
            // Contoh:
            // stockBefore = 92
            // physical    = 100
            //
            // STOCK_OPNAME_IN = 8
            // =======================================

            else if (difference > 0) {
              const qtyIn =
                difference;

              const currentAverageCost =
                Number(
                  outletStock.averageCost ??
                    0
                );

              const safeAverageCost =
                Number.isFinite(
                  currentAverageCost
                )
                  ? currentAverageCost
                  : 0;

              movementSummary.totalIn +=
                qtyIn;

              movementSummary.inCount +=
                1;

              // =====================================
              // STOCK CARD IN
              // =====================================

              await tx.stockCard.create({
                data: {
                  barangId,

                  trxDate:
                    currentOpname.date ??
                    new Date(),

                  trxType:
                    "STOCK_OPNAME_IN",

                  trxNumber:
                    currentOpname.code,

                  referenceId:
                    currentOpname.id,

                  warehouse:
                    `OUTLET:${currentOpname.outlet.code}`,

                  qtyIn,

                  qtyOut: 0,

                  balance:
                    physicalQty,

                  unitPrice:
                    safeAverageCost,

                  totalValue:
                    qtyIn *
                    safeAverageCost,

                  note:
                    `Stock Opname Bulanan ${currentOpname.code} - selisih fisik (${stockBefore} → ${physicalQty})`,
                },
              });

              // =====================================
              // STOCK MUTATION
              //
              // Audit tambahan.
              // Tidak dijadikan sumber utama report.
              // =====================================

              await tx.stockMutation.create({
                data: {
                  outletId:
                    Number(
                      currentOpname.outletId
                    ),

                  barangId,

                  type:
                    "ADJUSTMENT_IN",

                  qty: qtyIn,

                  stockBefore,

                  stockAfter:
                    physicalQty,

                  reference:
                    currentOpname.code,

                  description:
                    `Stock Opname Bulanan IN - ${stockBefore} → ${physicalQty}`,
                },
              });
            }

            // =======================================
            // TIDAK ADA SELISIH
            // =======================================

            else {
              movementSummary.unchangedCount +=
                1;
            }

            // =======================================
            // UPDATE STOCK
            // =======================================

            await tx.outletStock.update({
              where: {
                id: outletStock.id,
              },

              data: {
                stock: physicalQty,
              },
            });
          }

          // =========================================
          // APPROVED
          // =========================================

          const approved =
            await tx.stockOpname.update({
              where: {
                id: currentOpname.id,
              },

              data: {
                status: "APPROVED",
                approvedBy: user.id,
              },

              include: {
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
                      },
                    },
                  },
                },
              },
            });

          return {
            opname: approved,
            movementSummary,
          };
        }
      );

    return NextResponse.json({
      success: true,

      message:
        "Stock Opname Bulanan berhasil disetujui dan stock outlet telah diperbarui",

      data: result.opname,

      outlet:
        result.opname.outlet,

      meta: {
        type: "MONTHLY",
        status: "APPROVED",

        stockChanged: true,
        centralStockChanged: false,

        // =================================================
        // LEDGER
        // =================================================

        outboundLedger:
          "STOCK_OPNAME_OUT",

        inboundLedger:
          "STOCK_OPNAME_IN",

        // =================================================
        // SUMMARY
        // =================================================

        movementSummary:
          result.movementSummary,
      },
    });
  } catch (error: any) {
    console.error(
      "APPROVE OUTLET STOCK OPNAME ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menyetujui stock opname",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// DELETE STOCK OPNAME
//
// HANYA ADMIN PUSAT
//
// ADMIN PUSAT BOLEH HAPUS:
// -> COUNTING
// -> COMPLETED
// -> APPROVED
//
// DELETE TIDAK MENGUBAH STOCK OUTLET
//
// CATATAN:
// Jika APPROVED sudah membuat StockCard,
// penghapusan StockOpname tidak otomatis
// menghapus StockCard karena StockCard adalah
// historical ledger.
// =====================================================

export async function DELETE(
  req: NextRequest
) {
  try {
    const login = await getLoginUser();

    if ("error" in login) {
      return NextResponse.json(
        {
          success: false,
          message: login.error,
        },
        {
          status: login.status,
        }
      );
    }

    const {
      user,
      role,
    } = login;

    // =================================================
    // HANYA ADMIN PUSAT
    // =================================================

    if (role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya Admin Pusat yang dapat menghapus stock opname",
        },
        {
          status: 403,
        }
      );
    }

    const { searchParams } =
      new URL(req.url);

    const opnameId = Number(
      searchParams.get(
        "opnameId"
      ) ?? 0
    );

    if (
      !Number.isInteger(opnameId) ||
      opnameId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID stock opname tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // CEK OPNAME
    // =================================================

    const opname =
      await prisma.stockOpname.findUnique({
        where: {
          id: opnameId,
        },

        select: {
          id: true,
          code: true,
          type: true,
          status: true,
          outletId: true,
        },
      });

    if (!opname) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock opname tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // DELETE
    //
    // Tetap mengikuti business rule existing:
    //
    // ADMIN PUSAT BOLEH HAPUS:
    // COUNTING
    // COMPLETED
    // APPROVED
    //
    // Stock outlet tidak disentuh.
    //
    // IMPORTANT:
    // StockCard historical ledger tetap ada.
    // =================================================

    await prisma.stockOpname.delete({
      where: {
        id: opnameId,
      },
    });

    console.log(
      `STOCK OPNAME DELETED: ${opname.code} (${opname.type}/${opname.status}) by user ${user.id}`
    );

    return NextResponse.json({
      success: true,

      message:
        `Stock Opname ${opname.code} berhasil dihapus`,

      meta: {
        stockChanged: false,
        ledgerChanged: false,
      },
    });
  } catch (error: any) {
    console.error(
      "DELETE OUTLET STOCK OPNAME ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menghapus stock opname",
      },
      {
        status: 500,
      }
    );
  }
}