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
// HELPER: AMBIL MASTER BARANG OUTLET TERBARU
//
// HANYA BARANG MASTER OUTLET YANG AKTIF
//
// OutletBarang:
//   outletId
//   barangId
//   aktif
//
// Barang:
//   category
//   code
//   name
//   unit
// =====================================================

async function getOutletMasterBarang(
  outletId: number
) {
  return prisma.outletBarang.findMany({
    where: {
      outletId,
      aktif: true,
    },

    select: {
      id: true,
      outletId: true,
      barangId: true,
      harga: true,
      aktif: true,

      barang: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          unit: true,
          baseUnit: true,
          conversionRate: true,
          purchasePrice: true,
          sellingPrice: true,
          active: true,
        },
      },
    },

    orderBy: {
      barang: {
        name: "asc",
      },
    },
  });
}

// =====================================================
// HELPER: MERGE DETAIL OPNAME DENGAN MASTER BARANG OUTLET
//
// RULE:
// - COUNTING:
//   otomatis membaca Master Barang Outlet terbaru
//
// - Barang yang belum ada di StockOpnameItem:
//   dibuat sebagai virtual detail dengan:
//   masterBaru = true
//
// - systemQty barang baru:
//   membaca OutletStock terbaru
//
// - physicalQty barang baru:
//   0
//
// - Barang lama:
//   TETAP menggunakan StockOpnameItem existing
//
// - Barang yang sudah tidak ada di Master Barang Outlet:
//   TETAP dipertahankan jika sudah menjadi detail opname
//
// Ini penting supaya perubahan master tidak menghapus
// histori/detail yang sudah ada.
// =====================================================

async function mergeCountingWithOutletMaster(
  opname: any
) {
  const outletId = Number(opname.outletId);

  if (!Number.isInteger(outletId) || outletId <= 0) {
    return opname;
  }

  const masterBarang =
    await getOutletMasterBarang(outletId);

  const existingItems =
    Array.isArray(opname.items)
      ? opname.items
      : [];

  const existingBarangIds =
    new Set<number>();

  const existingItemsByBarangId =
    new Map<number, any>();

  for (const item of existingItems) {
    const barangId = Number(item.barangId);

    if (
      Number.isInteger(barangId) &&
      barangId > 0
    ) {
      existingBarangIds.add(barangId);
      existingItemsByBarangId.set(
        barangId,
        item
      );
    }
  }

  const missingMaster =
    masterBarang.filter(
      (master) =>
        !existingBarangIds.has(
          Number(master.barangId)
        )
    );

  // =====================================================
  // TIDAK ADA BARANG BARU
  // =====================================================

  if (missingMaster.length === 0) {
    return {
      ...opname,

      items: existingItems.map(
        (item: any) => ({
          ...item,

          masterBaru: false,

          barang: item.barang
            ? {
                ...item.barang,

                category:
                  item.barang.category ??
                  null,
              }
            : null,
        })
      ),

      meta: {
        ...(opname.meta || {}),
        masterSynced: true,
        masterBarangCount:
          masterBarang.length,
        masterBaruCount: 0,
      },
    };
  }

  // =====================================================
  // AMBIL STOCK OUTLET TERKINI UNTUK BARANG BARU
  // =====================================================

  const missingBarangIds =
    missingMaster.map(
      (master) => Number(master.barangId)
    );

  const outletStocks =
    missingBarangIds.length > 0
      ? await prisma.outletStock.findMany({
          where: {
            outletId,

            barangId: {
              in: missingBarangIds,
            },
          },

          select: {
            id: true,
            outletId: true,
            barangId: true,
            stock: true,
            minimumStock: true,
            averageCost: true,
          },
        })
      : [];

  const stockMap =
    new Map<number, any>();

  for (const stock of outletStocks) {
    stockMap.set(
      Number(stock.barangId),
      stock
    );
  }

  // =====================================================
  // TAMBAHKAN MASTER BARU KE DETAIL
  // =====================================================

  const newItems =
    missingMaster.map(
      (master, index) => {
        const barangId =
          Number(master.barangId);

        const outletStock =
          stockMap.get(barangId);

        const systemQty = Number(
          outletStock?.stock ?? 0
        );

        const safeSystemQty =
          Number.isFinite(systemQty) &&
          systemQty >= 0
            ? systemQty
            : 0;

        return {
          id: null,

          // PENTING:
          // Frontend harus menganggap null sebagai
          // detail baru dan ketika PUT mengirim
          // barangId.
          opnameId: opname.id,

          barangId,

          systemQty:
            safeSystemQty,

          physicalQty: 0,

          difference:
            0 - safeSystemQty,

          note: null,

          masterBaru: true,

          // temporary ordering supaya berada
          // bersama daftar barang.
          _masterOrder: index,

          barang: {
            id: master.barang.id,
            code: master.barang.code,
            name: master.barang.name,

            // =================================================
            // KATEGORI
            // =================================================
            category:
              master.barang.category ??
              null,

            unit: master.barang.unit,
            baseUnit:
              master.barang.baseUnit ??
              null,

            conversionRate:
              Number(
                master.barang.conversionRate ??
                  1
              ),

            purchasePrice:
              Number(
                master.barang.purchasePrice ??
                  0
              ),

            sellingPrice:
              Number(
                master.barang.sellingPrice ??
                  0
              ),
          },

          outletMaster: {
            id: master.id,
            outletId: master.outletId,
            barangId: master.barangId,
            harga:
              Number(master.harga ?? 0),
            aktif: master.aktif,
          },
        };
      }
    );

  // =====================================================
  // NORMALISASI ITEM LAMA
  // =====================================================

  const oldItems =
    existingItems.map(
      (item: any) => ({
        ...item,

        masterBaru: false,

        barang: item.barang
          ? {
              ...item.barang,

              category:
                item.barang.category ??
                null,
            }
          : null,

        outletMaster:
          null,
      })
    );

  // =====================================================
  // GABUNGKAN
  // =====================================================

  const mergedItems = [
    ...oldItems,
    ...newItems,
  ].sort((a: any, b: any) => {
    const nameA =
      String(
        a?.barang?.name ?? ""
      ).toLowerCase();

    const nameB =
      String(
        b?.barang?.name ?? ""
      ).toLowerCase();

    return nameA.localeCompare(
      nameB,
      "id"
    );
  });

  return {
    ...opname,

    items: mergedItems,

    meta: {
      ...(opname.meta || {}),
      masterSynced: true,
      masterBarangCount:
        masterBarang.length,
      masterBaruCount:
        newItems.length,
    },
  };
}

// =====================================================
// HELPER: NORMALISASI ITEM RESPONSE
//
// Semua response item sekarang konsisten memiliki:
// - category
// - masterBaru
// =====================================================

function normalizeOpnameItems(
  items: any[]
) {
  return items.map((item: any) => ({
    ...item,

    masterBaru:
      item.masterBaru === true,

    barang: item.barang
      ? {
          ...item.barang,

          category:
            item.barang.category ??
            null,
        }
      : null,
  }));
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
//
// KHUSUS COUNTING:
// -> detail otomatis disinkronkan dengan
//    Master Barang Outlet terbaru.
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

    const rawData =
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

                  // =================================================
                  // KATEGORI SEKARANG IKUT DIKIRIM
                  // =================================================
                  category: true,

                  unit: true,
                  baseUnit: true,
                  conversionRate: true,
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
    // SINKRONISASI MASTER BARANG
    //
    // HANYA COUNTING
    //
    // APPROVED TIDAK BOLEH DITAMBAH OTOMATIS
    // COMPLETED JUGA TIDAK.
    // =================================================

    const data = [];

    for (const opname of rawData) {
      const status =
        String(
          opname.status || ""
        ).toUpperCase();

      if (
        status === "COUNTING" &&
        opname.outletId
      ) {
        const merged =
          await mergeCountingWithOutletMaster(
            opname
          );

        data.push(merged);
      } else {
        data.push({
          ...opname,

          items: normalizeOpnameItems(
            opname.items || []
          ),

          meta: {
            masterSynced: false,
            masterBarangCount: 0,
            masterBaruCount: 0,
          },
        });
      }
    }

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
        // MASTER BARANG OUTLET
        // =================================================

        countingReadsLatestOutletMaster:
          true,

        approvedReadsLatestOutletMaster:
          false,

        masterBarangSource:
          "OutletBarang",

        masterBarangOnlyActive:
          true,

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
                  category: true,
                  unit: true,
                  baseUnit: true,
                  conversionRate: true,
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
                        category: true,
                        unit: true,
                        baseUnit: true,
                        conversionRate: true,
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

                movementSummary.inCount +=
                  1;

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
                `Stock outlet tidak valid untuk barang ${
                  item.barang?.name ||
                  barangId
                }`
              );
            }

            // =======================================
            // SELISIH
            // =======================================

            const difference =
              physicalQty -
              stockBefore;

            // =======================================
            // OUTBOUND
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
                (
                  Number.isFinite(
                    averageCost
                  )
                    ? averageCost
                    : 0
                );

              movementSummary.totalOut +=
                qtyOut;

              movementSummary.outCount +=
                1;

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
                        category: true,
                        unit: true,
                        baseUnit: true,
                        conversionRate: true,
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

        outboundLedger:
          "STOCK_OPNAME_OUT",

        inboundLedger:
          "STOCK_OPNAME_IN",

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
// PUT EDIT STOCK OPNAME
//
// COUNTING ONLY
//
// ITEM LAMA:
// {
//   itemId,
//   physicalQty,
//   note
// }
//
// ITEM BARU:
// {
//   barangId,
//   physicalQty,
//   note
// }
//
// BARANG BARU:
// -> wajib ada pada OutletBarang aktif
// -> outlet harus sesuai
// -> StockOpnameItem dibuat
// -> systemQty mengambil OutletStock terbaru
// -> difference = physicalQty - systemQty
//
// PUT TIDAK:
// -> mengubah OutletStock
// -> membuat StockCard
// -> membuat StockMutation
// -> mengubah status
//
// STATUS TETAP COUNTING.
// =====================================================

export async function PUT(
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
    // MANAGER READ ONLY
    // =================================================

    if (role === "MANAGER") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Manager hanya dapat melihat stock opname",
        },
        {
          status: 403,
        }
      );
    }

    if (
      role !== "ADMIN" &&
      role !== "OUTLET_ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses edit stock opname",
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

    if (
      !Array.isArray(body?.items) ||
      body.items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak ada perubahan item stock opname",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // NORMALISASI INPUT
    //
    // EXISTING:
    // itemId
    //
    // BARANG BARU:
    // barangId
    // =================================================

    const requestedItems =
      body.items.map(
        (item: any) => {
          const rawItemId =
            Number(
              item?.itemId ??
                item?.id ??
                0
            );

          const rawBarangId =
            Number(
              item?.barangId ??
                0
            );

          return {
            itemId:
              Number.isInteger(
                rawItemId
              ) &&
              rawItemId > 0
                ? rawItemId
                : null,

            barangId:
              Number.isInteger(
                rawBarangId
              ) &&
              rawBarangId > 0
                ? rawBarangId
                : null,

            physicalQty:
              Number(
                item?.physicalQty ??
                  0
              ),

            note:
              item?.note === null ||
              item?.note === undefined
                ? null
                : String(
                    item.note
                  ).trim(),
          };
        }
      );

    // =================================================
    // VALIDASI INPUT DASAR
    // =================================================

    const itemIdSet =
      new Set<number>();

    const barangIdSet =
      new Set<number>();

    for (
      const item
        of requestedItems
    ) {
      // ===============================================
      // HARUS MEMILIKI IDENTITAS
      //
      // Existing:
      // itemId
      //
      // New:
      // barangId
      // ===============================================

      if (
        !item.itemId &&
        !item.barangId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Detail stock opname harus memiliki itemId atau barangId",
          },
          {
            status: 400,
          }
        );
      }

      // ===============================================
      // ITEM ID DUPLIKAT
      // ===============================================

      if (item.itemId) {
        if (
          itemIdSet.has(
            item.itemId
          )
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Terdapat detail stock opname duplikat",
            },
            {
              status: 400,
            }
          );
        }

        itemIdSet.add(
          item.itemId
        );
      }

      // ===============================================
      // BARANG ID DUPLIKAT
      //
      // Ini mencegah frontend mengirim barang yang sama
      // sebagai item lama dan item baru sekaligus.
      // ===============================================

      if (item.barangId) {
        if (
          barangIdSet.has(
            item.barangId
          )
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Terdapat barang duplikat pada perubahan stock opname",
            },
            {
              status: 400,
            }
          );
        }

        barangIdSet.add(
          item.barangId
        );
      }

      // ===============================================
      // QTY FISIK
      // ===============================================

      if (
        !Number.isFinite(
          item.physicalQty
        ) ||
        item.physicalQty < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Qty fisik harus berupa angka yang valid dan tidak boleh kurang dari 0",
          },
          {
            status: 400,
          }
        );
      }

      // ===============================================
      // BATAS DESIMAL
      // ===============================================

      const physicalText =
        String(
          item.physicalQty
        );

      const decimalPart =
        physicalText.includes(".")
          ? physicalText.split(".")[1]
          : "";

      if (
        decimalPart.length > 6
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Qty fisik maksimal 6 angka desimal",
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
                        category: true,
                        unit: true,
                        baseUnit: true,
                        conversionRate: true,
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
            });

          if (!currentOpname) {
            throw new Error(
              "Stock opname tidak ditemukan"
            );
          }

          // =============================================
          // WAJIB STOCK OPNAME OUTLET
          // =============================================

          if (
            !currentOpname.outletId
          ) {
            throw new Error(
              "Stock opname ini bukan stock opname outlet"
            );
          }

          if (!currentOpname.outlet) {
            throw new Error(
              "Outlet stock opname tidak ditemukan"
            );
          }

          const outletId =
            Number(
              currentOpname.outletId
            );

          // =============================================
          // SECURITY OUTLET
          // =============================================

          if (
            isOutletAdmin &&
            (
              !user.outletId ||
              Number(user.outletId) !==
                outletId
            )
          ) {
            throw new Error(
              "Anda tidak dapat mengedit stock opname outlet lain"
            );
          }

          // =============================================
          // STATUS
          //
          // HANYA COUNTING
          // =============================================

          const currentStatus =
            String(
              currentOpname.status ||
                ""
            ).toUpperCase();

          if (
            currentStatus !==
            "COUNTING"
          ) {
            throw new Error(
              `Stock Opname tidak dapat diedit karena status saat ini ${currentOpname.status}`
            );
          }

          // =============================================
          // TYPE
          // =============================================

          const currentType =
            String(
              currentOpname.type ||
                ""
            ).toUpperCase();

          if (
            currentType !==
            "MONTHLY"
          ) {
            throw new Error(
              "Stock Opname Mingguan tidak memerlukan approval"
            );
          }

          // =============================================
          // MAP ITEM EXISTING
          // =============================================

          const currentItemMap =
            new Map<
              number,
              any
            >();

          const existingBarangIdSet =
            new Set<number>();

          for (
            const item
              of currentOpname.items
          ) {
            const itemId =
              Number(item.id);

            const barangId =
              Number(
                item.barangId
              );

            currentItemMap.set(
              itemId,
              item
            );

            if (
              Number.isInteger(
                barangId
              ) &&
              barangId > 0
            ) {
              existingBarangIdSet.add(
                barangId
              );
            }
          }

          // =============================================
          // AMBIL MASTER BARANG OUTLET TERBARU
          //
          // Barang baru hanya boleh berasal dari sini.
          // =============================================

          const masterBarang =
            await tx.outletBarang.findMany({
              where: {
                outletId,

                aktif: true,
              },

              select: {
                id: true,
                outletId: true,
                barangId: true,
                harga: true,
                aktif: true,

                barang: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    category: true,
                    unit: true,
                    baseUnit: true,
                    conversionRate: true,
                    purchasePrice: true,
                    sellingPrice: true,
                    active: true,
                  },
                },
              },
            });

          const masterBarangMap =
            new Map<number, any>();

          for (
            const master
              of masterBarang
          ) {
            masterBarangMap.set(
              Number(
                master.barangId
              ),
              master
            );
          }

          // =============================================
          // VALIDASI SEMUA REQUEST
          // =============================================

          for (
            const requestedItem
              of requestedItems
          ) {
            // ===========================================
            // ITEM LAMA
            // ===========================================

            if (
              requestedItem.itemId
            ) {
              const currentItem =
                currentItemMap.get(
                  requestedItem.itemId
                );

              if (!currentItem) {
                throw new Error(
                  `Detail stock opname ${requestedItem.itemId} tidak ditemukan pada ${currentOpname.code}`
                );
              }

              // Jika frontend mengirim barangId bersamaan
              // dengan itemId, pastikan tidak mengarah
              // ke barang yang berbeda.
              if (
                requestedItem.barangId &&
                Number(
                  currentItem.barangId
                ) !==
                  Number(
                    requestedItem.barangId
                  )
              ) {
                throw new Error(
                  `Barang pada detail stock opname ${requestedItem.itemId} tidak sesuai`
                );
              }

              continue;
            }

            // ===========================================
            // ITEM BARU
            // ===========================================

            const barangId =
              Number(
                requestedItem.barangId
              );

            if (
              !Number.isInteger(
                barangId
              ) ||
              barangId <= 0
            ) {
              throw new Error(
                "Barang baru tidak memiliki barangId yang valid"
              );
            }

            // ===========================================
            // JANGAN IZINKAN BARANG YANG SUDAH ADA
            // ===========================================

            if (
              existingBarangIdSet.has(
                barangId
              )
            ) {
              throw new Error(
                `Barang ${barangId} sudah menjadi detail stock opname`
              );
            }

            // ===========================================
            // WAJIB ADA DI MASTER BARANG OUTLET AKTIF
            // ===========================================

            const master =
              masterBarangMap.get(
                barangId
              );

            if (!master) {
              throw new Error(
                `Barang ${barangId} bukan merupakan Master Barang Outlet aktif`
              );
            }

            // ===========================================
            // BARANG HARUS AKTIF
            // ===========================================

            if (
              master.barang &&
              master.barang.active === false
            ) {
              throw new Error(
                `Barang ${master.barang.name || barangId} tidak aktif`
              );
            }
          }

          // =============================================
          // UPDATE ITEM EXISTING
          // =============================================

          for (
            const requestedItem
              of requestedItems
          ) {
            if (
              !requestedItem.itemId
            ) {
              continue;
            }

            const currentItem =
              currentItemMap.get(
                requestedItem.itemId
              );

            if (!currentItem) {
              continue;
            }

            const systemQty =
              Number(
                currentItem.systemQty ??
                  0
              );

            if (
              !Number.isFinite(
                systemQty
              )
            ) {
              throw new Error(
                `System Qty barang ${
                  currentItem.barang?.name ||
                  currentItem.barangId
                } tidak valid`
              );
            }

            const physicalQty =
              requestedItem.physicalQty;

            const difference =
              physicalQty -
              systemQty;

            await tx.stockOpnameItem.update({
              where: {
                id: currentItem.id,
              },

              data: {
                physicalQty,

                difference,

                note:
                  requestedItem.note,
              },
            });
          }

          // =============================================
          // CREATE ITEM BARU
          //
          // PENTING:
          // systemQty dibaca dari OutletStock saat save.
          //
          // Ini menjaga snapshot systemQty untuk opname.
          // =============================================

          for (
            const requestedItem
              of requestedItems
          ) {
            if (
              requestedItem.itemId
            ) {
              continue;
            }

            const barangId =
              Number(
                requestedItem.barangId
              );

            const master =
              masterBarangMap.get(
                barangId
              );

            if (!master) {
              throw new Error(
                `Master Barang Outlet untuk barang ${barangId} tidak ditemukan`
              );
            }

            // ===========================================
            // AMBIL STOCK TERKINI
            // ===========================================

            const outletStock =
              await tx.outletStock.findUnique({
                where: {
                  outletId_barangId: {
                    outletId,
                    barangId,
                  },
                },

                select: {
                  id: true,
                  outletId: true,
                  barangId: true,
                  stock: true,
                  minimumStock: true,
                  averageCost: true,
                },
              });

            const rawSystemQty =
              Number(
                outletStock?.stock ??
                  0
              );

            const systemQty =
              Number.isFinite(
                rawSystemQty
              ) &&
              rawSystemQty >= 0
                ? rawSystemQty
                : 0;

            const physicalQty =
              requestedItem.physicalQty;

            const difference =
              physicalQty -
              systemQty;

            // ===========================================
            // CREATE DETAIL BARU
            // ===========================================

            await tx.stockOpnameItem.create({
              data: {
                opnameId:
                  currentOpname.id,

                barangId,

                systemQty,

                physicalQty,

                difference,

                note:
                  requestedItem.note,
              },
            });

            // ===========================================
            // TAMBAHKAN KE SET AGAR TIDAK ADA DUPLIKAT
            // DALAM REQUEST YANG SAMA
            // ===========================================

            existingBarangIdSet.add(
              barangId
            );
          }

          // =============================================
          // AMBIL ULANG DATA TERBARU
          // =============================================

          const updated =
            await tx.stockOpname.findUnique({
              where: {
                id: currentOpname.id,
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
                        category: true,
                        unit: true,
                        baseUnit: true,
                        conversionRate: true,
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
            });

          if (!updated) {
            throw new Error(
              "Gagal mengambil data stock opname setelah disimpan"
            );
          }

          return updated;
        }
      );

    // =================================================
    // RESPONSE
    //
    // STATUS TIDAK DIUBAH.
    // =================================================

    return NextResponse.json({
      success: true,

      message:
        "Perubahan Stock Opname berhasil disimpan",

      data: {
        ...result,

        items:
          normalizeOpnameItems(
            result.items || []
          ),
      },

      meta: {
        type: String(
          result.type || ""
        ).toUpperCase(),

        status: String(
          result.status || ""
        ).toUpperCase(),

        stockChanged: false,

        outletStockChanged: false,

        stockCardCreated: false,

        stockMutationCreated: false,

        approvalRequired: true,

        statusPreserved:
          String(
            result.status || ""
          ).toUpperCase() ===
          "COUNTING",

        masterBarangSupported:
          true,
      },
    });
  } catch (error: any) {
    console.error(
      "EDIT OUTLET STOCK OPNAME ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menyimpan perubahan stock opname",
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