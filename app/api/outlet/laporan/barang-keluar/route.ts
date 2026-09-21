import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

// =====================================================
// TYPES
// =====================================================

type ReportRow = {
  id: string;
  date: string;
  number: string;
  outletId: number | null;
  outletCode: string;
  outletName: string;

  source: string;
  sourceLabel: string;

  type: string;
  typeLabel: string;

  barangId: number;
  barangCode: string;
  barcode: string | null;
  barangName: string;
  unit: string;

  qtyOut: number;
  unitCost: number;
  totalCost: number;

  referenceId: number | null;
  reference: string | null;

  status: string | null;
  userName: string | null;

  note: string | null;
};

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

  const role =
    String(user.role).toUpperCase();

  // ===================================================
  // REPORT OUTLET
  // ===================================================

  if (
    role !== "ADMIN" &&
    role !== "MANAGER" &&
    role !== "OUTLET_ADMIN"
  ) {
    return {
      error:
        "Anda tidak memiliki akses laporan barang keluar outlet",
      status: 403,
    } as const;
  }

  const isOutletAdmin =
    role === "OUTLET_ADMIN";

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
// HELPERS
// =====================================================

function safeNumber(
  value: unknown
): number {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function normalizeText(
  value: unknown
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getSourceFromTrxType(
  trxType: string
) {
  switch (
    String(trxType)
      .toUpperCase()
  ) {
    case "OUTLET_STOCK_OUT":
      return {
        source: "BARANG_KELUAR",
        sourceLabel: "Barang Keluar",
      };

    case "POS_OUT":
      return {
        source: "POS",
        sourceLabel: "POS / BOM",
      };

    case "MANUFACTURE_CONSUME":
      return {
        source: "MANUFACTURE",
        sourceLabel:
          "Manufacture / Produksi",
      };

    case "OUTLET_TRANSFER_OUT":
      return {
        source: "TRANSFER",
        sourceLabel:
          "Transfer Antar Outlet",
      };

    case "STOCK_OPNAME_OUT":
      return {
        source: "STOCK_OPNAME",
        sourceLabel:
          "Stock Opname Bulanan",
      };

    default:
      return null;
  }
}

function getTypeLabel(
  trxType: string
): string {
  switch (
    String(trxType)
      .toUpperCase()
  ) {
    case "OUTLET_STOCK_OUT":
      return "Barang Keluar";

    case "POS_OUT":
      return "POS / BOM";

    case "MANUFACTURE_CONSUME":
      return "Manufacture";

    case "OUTLET_TRANSFER_OUT":
      return "Transfer Outlet";

    case "STOCK_OPNAME_OUT":
      return "Stock Opname";

    case "ADJUSTMENT_OUT":
      return "Adjustment MINUS";

    default:
      return trxType;
  }
}

function getStatusLabel(
  status: string | null
): string | null {
  if (!status) {
    return null;
  }

  switch (
    String(status)
      .toUpperCase()
  ) {
    case "PENDING":
      return "Pending";

    case "APPROVED":
      return "Approved";

    case "REJECTED":
      return "Rejected";

    case "SENT":
      return "Sent";

    case "PARTIAL":
      return "Partial";

    case "RECEIVED":
      return "Received";

    default:
      return status;
  }
}

// =====================================================
// GET
//
// SUMBER OUTBOUND:
// 1. StockCard
//    - OUTLET_STOCK_OUT
//    - POS_OUT
//    - MANUFACTURE_CONSUME
//    - OUTLET_TRANSFER_OUT
//    - STOCK_OPNAME_OUT
//
// 2. StockMutation
//    - ADJUSTMENT_OUT
//
// Tidak menggunakan:
// - History
// - OutletStockOut sebagai qty kedua
// - OutletSaleItem
// - ManufactureOrderItem
// - OutletTransferItem
// =====================================================

export async function GET(
  req: NextRequest
) {
  try {
    const login =
      await getLoginUser();

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
    // QUERY
    // =================================================

    const requestedOutletId =
      Number(
        searchParams.get(
          "outletId"
        ) ?? 0
      );

    const dateFrom =
      searchParams
        .get("dateFrom")
        ?.trim() || "";

    const dateTo =
      searchParams
        .get("dateTo")
        ?.trim() || "";

    const source =
      searchParams
        .get("source")
        ?.trim()
        .toUpperCase() || "";

    const search =
      searchParams
        .get("search")
        ?.trim() || "";

    const page =
      Math.max(
        1,
        Number(
          searchParams.get(
            "page"
          ) ?? 1
        ) || 1
      );

    const pageSizeRaw =
      Number(
        searchParams.get(
          "pageSize"
        ) ?? 25
      );

    const pageSize = Math.min(
      100,
      Math.max(
        10,
        Number.isFinite(
          pageSizeRaw
        )
          ? pageSizeRaw
          : 25
      )
    );

    // =================================================
    // OUTLET ACCESS
    // =================================================

    let allowedOutletIds:
      | number[]
      | null = null;

    if (isOutletAdmin) {
      allowedOutletIds = [
        Number(user.outletId),
      ];
    } else {
      const outlets =
        await prisma.outlet.findMany({
          where: {
            active: true,
          },

          select: {
            id: true,
          },
        });

      allowedOutletIds =
        outlets.map(
          (outlet) => outlet.id
        );
    }

    // =================================================
    // OUTLET FILTER
    // =================================================

    let selectedOutletIds =
      allowedOutletIds;

    if (
      Number.isInteger(
        requestedOutletId
      ) &&
      requestedOutletId > 0
    ) {
      if (
        !allowedOutletIds.includes(
          requestedOutletId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda tidak memiliki akses ke outlet tersebut",
          },
          {
            status: 403,
          }
        );
      }

      selectedOutletIds = [
        requestedOutletId,
      ];
    }

    // =================================================
    // DATE
    // =================================================

    let fromDate:
      | Date
      | undefined;

    let toDate:
      | Date
      | undefined;

    if (dateFrom) {
      const date =
        new Date(
          `${dateFrom}T00:00:00`
        );

      if (
        !Number.isNaN(
          date.getTime()
        )
      ) {
        fromDate = date;
      }
    }

    if (dateTo) {
      const date =
        new Date(
          `${dateTo}T23:59:59.999`
        );

      if (
        !Number.isNaN(
          date.getTime()
        )
      ) {
        toDate = date;
      }
    }

    // =================================================
    // STOCK CARD
    // =================================================

    const stockCardWhere: any = {
      trxType: {
        in: [
          "OUTLET_STOCK_OUT",
          "POS_OUT",
          "MANUFACTURE_CONSUME",
          "OUTLET_TRANSFER_OUT",
          "STOCK_OPNAME_OUT",
        ],
      },

      qtyOut: {
        gt: 0,
      },
    };

    if (
      fromDate ||
      toDate
    ) {
      stockCardWhere.trxDate = {};

      if (fromDate) {
        stockCardWhere.trxDate.gte =
          fromDate;
      }

      if (toDate) {
        stockCardWhere.trxDate.lte =
          toDate;
      }
    }

    const stockCards =
      await prisma.stockCard.findMany({
        where: stockCardWhere,

        include: {
          barang: {
            select: {
              id: true,
              code: true,
              barcode: true,
              name: true,
              unit: true,
            },
          },
        },

        orderBy: [
          {
            trxDate: "desc",
          },
          {
            id: "desc",
          },
        ],
      });

    // =================================================
    // OUTLET MAP
    //
    // StockCard tidak memiliki outletId.
    //
    // Outlet ditentukan dari:
    // warehouse = OUTLET:<OUTLET_CODE>
    // =================================================

    const outletRows =
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

    const outletByWarehouse =
      new Map<
        string,
        (typeof outletRows)[number]
      >();

    for (
      const outlet of outletRows
    ) {
      outletByWarehouse.set(
        `OUTLET:${outlet.code}`.toUpperCase(),
        outlet
      );
    }

    // =================================================
    // STOCK MUTATION
    //
    // HANYA ADJUSTMENT_OUT
    // =================================================

    const mutationWhere: any = {
      type: "ADJUSTMENT_OUT",

      qty: {
        gt: 0,
      },
    };

    if (
      selectedOutletIds &&
      selectedOutletIds.length > 0
    ) {
      mutationWhere.outletId = {
        in: selectedOutletIds,
      };
    }

    if (
      fromDate ||
      toDate
    ) {
      mutationWhere.createdAt = {};

      if (fromDate) {
        mutationWhere.createdAt.gte =
          fromDate;
      }

      if (toDate) {
        mutationWhere.createdAt.lte =
          toDate;
      }
    }

    const mutations =
      await prisma.stockMutation.findMany({
        where: mutationWhere,

        include: {
          barang: {
            select: {
              id: true,
              code: true,
              barcode: true,
              name: true,
              unit: true,
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

        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],
      });

    // =================================================
    // BUILD STOCK CARD ROWS
    // =================================================

    const rows: ReportRow[] = [];

    for (
      const card of stockCards
    ) {
      const sourceInfo =
        getSourceFromTrxType(
          card.trxType
        );

      if (!sourceInfo) {
        continue;
      }

      const warehouse =
        String(
          card.warehouse ?? ""
        ).toUpperCase();

      const outlet =
        outletByWarehouse.get(
          warehouse
        );

      // -------------------------------------------------
      // Hanya transaksi outlet
      // -------------------------------------------------

      if (!outlet) {
        continue;
      }

      // -------------------------------------------------
      // Security
      // -------------------------------------------------

      if (
        !selectedOutletIds.includes(
          outlet.id
        )
      ) {
        continue;
      }

      // -------------------------------------------------
      // Search
      // -------------------------------------------------

      if (search) {
        const needle =
          normalizeText(
            search
          );

        const haystack =
          normalizeText(
            [
              card.trxNumber,
              card.barang?.code,
              card.barang?.barcode,
              card.barang?.name,
              card.note,
              outlet.code,
              outlet.name,
            ].join(" ")
          );

        if (
          !haystack.includes(
            needle
          )
        ) {
          continue;
        }
      }

      // -------------------------------------------------
      // Source filter
      // -------------------------------------------------

      if (
        source &&
        source !==
          sourceInfo.source
      ) {
        continue;
      }

      const qtyOut =
        Math.abs(
          safeNumber(
            card.qtyOut
          )
        );

      if (qtyOut <= 0) {
        continue;
      }

      const unitCost =
        safeNumber(
          card.unitPrice
        );

      const totalCost =
        safeNumber(
          card.totalValue
        ) ||
        qtyOut * unitCost;

      rows.push({
        id:
          `SC-${card.id}`,

        date:
          card.trxDate.toISOString(),

        number:
          card.trxNumber,

        outletId:
          outlet.id,

        outletCode:
          outlet.code,

        outletName:
          outlet.name,

        source:
          sourceInfo.source,

        sourceLabel:
          sourceInfo.sourceLabel,

        type:
          String(
            card.trxType
          ),

        typeLabel:
          getTypeLabel(
            card.trxType
          ),

        barangId:
          card.barang.id,

        barangCode:
          card.barang.code,

        barcode:
          card.barang.barcode,

        barangName:
          card.barang.name,

        unit:
          card.barang.unit,

        qtyOut,

        unitCost,

        totalCost,

        referenceId:
          card.referenceId ??
          null,

        reference:
          card.trxNumber,

        status:
          null,

        userName:
          null,

        note:
          card.note ??
          null,
      });
    }

    // =================================================
    // BUILD ADJUSTMENT ROWS
    // =================================================

    for (
      const mutation of mutations
    ) {
      if (
        !mutation.outlet
      ) {
        continue;
      }

      if (
        !selectedOutletIds.includes(
          mutation.outlet.id
        )
      ) {
        continue;
      }

      // -------------------------------------------------
      // Search
      // -------------------------------------------------

      if (search) {
        const needle =
          normalizeText(
            search
          );

        const haystack =
          normalizeText(
            [
              mutation.reference,
              mutation.description,
              mutation.barang?.code,
              mutation.barang?.barcode,
              mutation.barang?.name,
              mutation.outlet.code,
              mutation.outlet.name,
            ].join(" ")
          );

        if (
          !haystack.includes(
            needle
          )
        ) {
          continue;
        }
      }

      // -------------------------------------------------
      // Source filter
      // -------------------------------------------------

      if (
        source &&
        source !==
          "ADJUSTMENT"
      ) {
        continue;
      }

      const qtyOut =
        Math.abs(
          safeNumber(
            mutation.qty
          )
        );

      if (qtyOut <= 0) {
        continue;
      }

      // -------------------------------------------------
      // Adjustment menggunakan stockBefore/after.
      //
      // Tidak ada unit cost khusus di StockMutation.
      // Ambil averageCost saat ini sebagai fallback.
      // -------------------------------------------------

      const outletStock =
        await prisma.outletStock.findUnique({
          where: {
            outletId_barangId: {
              outletId:
                mutation.outlet.id,

              barangId:
                mutation.barang.id,
            },
          },

          select: {
            averageCost: true,
          },
        });

      const unitCost =
        safeNumber(
          outletStock?.averageCost
        );

      const totalCost =
        qtyOut *
        unitCost;

      rows.push({
        id:
          `SM-${mutation.id}`,

        date:
          mutation.createdAt.toISOString(),

        number:
          mutation.reference ||
          `ADJ-${mutation.id}`,

        outletId:
          mutation.outlet.id,

        outletCode:
          mutation.outlet.code,

        outletName:
          mutation.outlet.name,

        source:
          "ADJUSTMENT",

        sourceLabel:
          "Adjustment MINUS",

        type:
          "ADJUSTMENT_OUT",

        typeLabel:
          "Adjustment MINUS",

        barangId:
          mutation.barang.id,

        barangCode:
          mutation.barang.code,

        barcode:
          mutation.barang.barcode,

        barangName:
          mutation.barang.name,

        unit:
          mutation.barang.unit,

        qtyOut,

        unitCost,

        totalCost,

        referenceId:
          mutation.id,

        reference:
          mutation.reference ??
          null,

        status:
          "APPROVED",

        userName:
          null,

        note:
          mutation.description ??
          null,
      });
    }

    // =================================================
    // FINAL SORT
    // =================================================

    rows.sort(
      (a, b) => {
        const dateDiff =
          new Date(b.date).getTime() -
          new Date(a.date).getTime();

        if (
          dateDiff !== 0
        ) {
          return dateDiff;
        }

        return (
          b.id.localeCompare(
            a.id
          )
        );
      }
    );

    // =================================================
    // PAGINATION
    // =================================================

    const total =
      rows.length;

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          total / pageSize
        )
      );

    const safePage =
      Math.min(
        page,
        totalPages
      );

    const start =
      (safePage - 1) *
      pageSize;

    const paginatedRows =
      rows.slice(
        start,
        start + pageSize
      );

    // =================================================
    // SUMMARY
    // =================================================

    const summary = {
      totalTransactions:
        total,

      totalQtyOut:
        rows.reduce(
          (
            sum,
            row
          ) =>
            sum +
            safeNumber(
              row.qtyOut
            ),
          0
        ),

      totalCost:
        rows.reduce(
          (
            sum,
            row
          ) =>
            sum +
            safeNumber(
              row.totalCost
            ),
          0
        ),

      barangKeluar:
        rows.filter(
          (row) =>
            row.source ===
            "BARANG_KELUAR"
        ).length,

      pos:
        rows.filter(
          (row) =>
            row.source ===
            "POS"
        ).length,

      manufacture:
        rows.filter(
          (row) =>
            row.source ===
            "MANUFACTURE"
        ).length,

      transfer:
        rows.filter(
          (row) =>
            row.source ===
            "TRANSFER"
        ).length,

      stockOpname:
        rows.filter(
          (row) =>
            row.source ===
            "STOCK_OPNAME"
        ).length,

      adjustment:
        rows.filter(
          (row) =>
            row.source ===
            "ADJUSTMENT"
        ).length,
    };

    // =================================================
    // RETURN
    // =================================================

    return NextResponse.json({
      success: true,

      data: paginatedRows,

      outlets:
        isOutletAdmin
          ? user.outlet
            ? [user.outlet]
            : []
          : outletRows,

      user: {
        id: user.id,
        fullname: user.fullname,
        role,
        outletId:
          user.outletId,
      },

      pagination: {
        page: safePage,
        pageSize,
        total,
        totalPages,
      },

      summary,

      meta: {
        report:
          "SEMUA_BARANG_KELUAR_OUTLET",

        deliveryIncluded:
          false,

        authoritativeLedger: [
          "STOCKCARD",
          "STOCKMUTATION_ADJUSTMENT_OUT",
        ],

        stockCardTypes: [
          "OUTLET_STOCK_OUT",
          "POS_OUT",
          "MANUFACTURE_CONSUME",
          "OUTLET_TRANSFER_OUT",
          "STOCK_OPNAME_OUT",
        ],

        stockMutationTypes: [
          "ADJUSTMENT_OUT",
        ],

        doubleCountProtection:
          true,
      },
    });
  } catch (error: any) {
    console.error(
      "GET LAPORAN SEMUA BARANG KELUAR OUTLET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil laporan semua barang keluar outlet",
      },
      {
        status: 500,
      }
    );
  }
}