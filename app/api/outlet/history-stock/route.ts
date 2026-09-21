import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

// ============================================================
// TYPES
// ============================================================

type Direction = "IN" | "OUT";

type HistoryUser = {
  id: number;
  fullname: string;
  username: string;
};

type HistoryItem = {
  id: string;
  sourceId: number;
  source: string;

  direction: Direction;

  trxDate: Date;
  trxNumber: string;

  outletId: number;
  outlet: {
    id: number;
    code: string;
    name: string;
  };

  barangId: number;
  code: string;
  barang: string;
  unit: string;

  qtyIn: number;
  qtyOut: number;

  quantity: number;

  balance: number;

  unitCost: number;
  totalCost: number;

  type: string;
  status?: string | null;

  note?: string | null;

  user?: HistoryUser | null;

  referenceId?: number | null;
};

// ============================================================
// CURRENT USER
// ============================================================

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session =
    cookieStore.get("erp-session") ||
    cookieStore.get("session");

  if (!session?.value) {
    return null;
  }

  try {
    const parsed = JSON.parse(session.value);

    if (!parsed?.id) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

// ============================================================
// SAFE NUMBER
// ============================================================

function num(value: unknown): number {
  const result = Number(value ?? 0);

  return Number.isFinite(result) ? result : 0;
}

// ============================================================
// DATE HELPERS
// ============================================================

function startOfDay(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function endOfDay(value: string) {
  const date = new Date(`${value}T23:59:59.999`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

// ============================================================
// TYPE LABEL
// ============================================================

function getTypeLabel(value: unknown): string {
  const raw = String(value || "").toUpperCase();

  switch (raw) {
    case "OUTLET_STOCK_OUT":
      return "PEMAKAIAN";

    case "POS_OUT":
      return "POS / BOM";

    case "MANUFACTURE_CONSUME":
      return "MANUFACTURE";

    case "MANUFACTURE_OUTPUT":
      return "HASIL MANUFACTURE";

    case "OUTLET_TRANSFER_OUT":
      return "TRANSFER KELUAR";

    case "OUTLET_TRANSFER_IN":
      return "TRANSFER MASUK";

    case "STOCK_OPNAME_OUT":
      return "STOCK OPNAME -";

    case "STOCK_OPNAME_IN":
      return "STOCK OPNAME +";

    case "ADJUSTMENT_OUT":
      return "ADJUSTMENT -";

    case "ADJUSTMENT_IN":
      return "ADJUSTMENT +";

    case "OUTLET_STOCK_IN":
      return "PENERIMAAN";

    case "OUTLET_RECEIVE":
      return "PENERIMAAN";

    default:
      return String(value || "-");
  }
}

// ============================================================
// NORMALIZE USER
// ============================================================

function normalizeUser(
  user: any
): HistoryUser | null {
  if (!user) {
    return null;
  }

  const id = Number(user.id || 0);

  if (!id) {
    return null;
  }

  return {
    id,
    fullname:
      String(user.fullname || "").trim() ||
      String(user.username || "").trim() ||
      "-",

    username:
      String(user.username || "").trim() ||
      "-",
  };
}

// ============================================================
// GET OUTLET STOCK OUT USERS
//
// OutletStockOut mempunyai userId dan relasi user.
// StockCard sendiri tidak mempunyai userId.
//
// Jadi untuk STOCK_CARD dengan:
// trxType = OUTLET_STOCK_OUT
//
// referenceId diarahkan ke OutletStockOut.id.
// ============================================================

async function getOutletStockOutUsers(
  referenceIds: number[]
): Promise<Map<number, HistoryUser>> {
  const result =
    new Map<number, HistoryUser>();

  const ids = Array.from(
    new Set(
      referenceIds.filter(
        (id) => Number(id) > 0
      )
    )
  );

  if (ids.length === 0) {
    return result;
  }

  try {
    const rows =
      await (prisma as any).outletStockOut.findMany(
        {
          where: {
            id: {
              in: ids,
            },
          },

          select: {
            id: true,
            userId: true,

            user: {
              select: {
                id: true,
                fullname: true,
                username: true,
              },
            },
          },
        }
      );

    for (const row of rows || []) {
      const normalized =
        normalizeUser(row.user);

      if (normalized) {
        result.set(
          Number(row.id),
          normalized
        );
      }
    }
  } catch (error) {
    /*
     * Jangan membuat seluruh history gagal hanya karena
     * lookup user transaksi tidak tersedia.
     *
     * History tetap dikembalikan.
     */
    console.error(
      "GET OUTLET STOCK OUT USERS ERROR:",
      error
    );
  }

  return result;
}

// ============================================================
// GET
// ============================================================

export async function GET(
  req: NextRequest
) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const role = String(
      user.role || ""
    ).toUpperCase();

    // ========================================================
    // ACCESS
    // ========================================================

    const allowedRoles = [
      "ADMIN",
      "MANAGER",
      "OUTLET_ADMIN",
    ];

    if (
      !allowedRoles.includes(role)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses ke history stock outlet",
        },
        {
          status: 403,
        }
      );
    }

    const { searchParams } =
      new URL(req.url);

    const requestedOutletId =
      Number(
        searchParams.get(
          "outletId"
        ) || 0
      );

    const fromParam =
      searchParams.get("from") ||
      searchParams.get("dateFrom") ||
      "";

    const toParam =
      searchParams.get("to") ||
      searchParams.get("dateTo") ||
      "";

    const sourceParam =
      String(
        searchParams.get(
          "source"
        ) || ""
      ).toUpperCase();

    const directionParam =
      String(
        searchParams.get(
          "direction"
        ) || ""
      ).toUpperCase();

    const typeParam =
      String(
        searchParams.get(
          "type"
        ) || ""
      ).toUpperCase();

    const searchParam =
      String(
        searchParams.get(
          "search"
        ) || ""
      )
        .trim()
        .toLowerCase();

    // ========================================================
    // USER FILTER
    //
    // Ditambahkan supaya API juga bisa menerima userId.
    // Frontend tetap boleh melakukan filter client-side.
    // ========================================================

    const requestedUserId =
      Number(
        searchParams.get(
          "userId"
        ) || 0
      );

    // ========================================================
    // OUTLET SCOPE
    // ========================================================

    let outletId: number | null =
      null;

    if (
      role ===
      "OUTLET_ADMIN"
    ) {
      outletId = Number(
        user.outletId || 0
      );

      if (!outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum terpasang",
          },
          {
            status: 400,
          }
        );
      }
    } else if (
      requestedOutletId > 0
    ) {
      outletId =
        requestedOutletId;
    }

    // ========================================================
    // OUTLET LIST
    // ========================================================

    const outlets =
      await prisma.outlet.findMany({
        where:
          role ===
          "OUTLET_ADMIN"
            ? {
                id: outletId!,
              }
            : undefined,

        select: {
          id: true,
          code: true,
          name: true,
        },

        orderBy: {
          name: "asc",
        },
      });

    // ========================================================
    // DATE FILTER
    // ========================================================

    const dateFrom =
      fromParam
        ? startOfDay(
            fromParam
          )
        : null;

    const dateTo =
      toParam
        ? endOfDay(
            toParam
          )
        : null;

    // ========================================================
    // RESULT
    // ========================================================

    const history: HistoryItem[] =
      [];

    // ========================================================
    // 1. STOCK CARD
    //
    // LEDGER UTAMA.
    // ========================================================

    const stockCardWhere: any =
      {
        warehouse: {
          startsWith:
            "OUTLET:",
        },
      };

    if (
      dateFrom ||
      dateTo
    ) {
      stockCardWhere.trxDate =
        {};

      if (dateFrom) {
        stockCardWhere.trxDate.gte =
          dateFrom;
      }

      if (dateTo) {
        stockCardWhere.trxDate.lte =
          dateTo;
      }
    }

    // ========================================================
    // SELECTED OUTLET
    // ========================================================

    const selectedOutlet =
      outletId
        ? outlets.find(
            (item) =>
              item.id ===
              outletId
          )
        : null;

    if (
      selectedOutlet
    ) {
      stockCardWhere.warehouse =
        `OUTLET:${selectedOutlet.code}`;
    }

    // ========================================================
    // STOCK CARDS
    // ========================================================

    const stockCards =
      await prisma.stockCard.findMany(
        {
          where:
            stockCardWhere,

          include: {
            barang: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                purchasePrice: true,
              },
            },
          },

          orderBy: {
            trxDate: "desc",
          },
        }
      );

    // ========================================================
    // LOAD USER UNTUK STOCK OUT
    // ========================================================

    const stockOutReferenceIds =
      stockCards
        .filter(
          (card) =>
            String(
              card.trxType || ""
            ).toUpperCase() ===
              "OUTLET_STOCK_OUT" &&
            Number(
              card.referenceId ||
                0
            ) > 0
        )
        .map(
          (card) =>
            Number(
              card.referenceId
            )
        );

    const stockOutUsers =
      await getOutletStockOutUsers(
        stockOutReferenceIds
      );

    // ========================================================
    // MAP STOCK CARD
    // ========================================================

    for (
      const card of stockCards
    ) {
      const warehouse =
        String(
          card.warehouse ||
            ""
        );

      const outletCode =
        warehouse
          .replace(
            /^OUTLET:/,
            ""
          )
          .trim();

      const outlet =
        outlets.find(
          (item) =>
            item.code ===
            outletCode
        );

      if (!outlet) {
        continue;
      }

      const qtyIn =
        num(card.qtyIn);

      const qtyOut =
        num(card.qtyOut);

      if (
        qtyIn === 0 &&
        qtyOut === 0
      ) {
        continue;
      }

      const direction: Direction =
        qtyIn > 0 &&
        qtyOut <= 0
          ? "IN"
          : "OUT";

      const quantity =
        direction === "IN"
          ? qtyIn
          : qtyOut;

      const rawType =
        String(
          card.trxType ||
            ""
        ).toUpperCase();

      const type =
        getTypeLabel(
          rawType
        );

      const unitCost =
        num(
          card.unitPrice
        );

      const totalCost =
        Math.abs(
          num(
            card.totalValue
          )
        ) ||
        quantity *
          unitCost;

      // ======================================================
      // USER TRANSAKSI
      //
      // StockCard tidak menyimpan user.
      // Untuk OUTLET_STOCK_OUT, ambil dari OutletStockOut.
      // ======================================================

      let transactionUser:
        | HistoryUser
        | null = null;

      const referenceId =
        Number(
          card.referenceId ||
            0
        );

      if (
        rawType ===
          "OUTLET_STOCK_OUT" &&
        referenceId > 0
      ) {
        transactionUser =
          stockOutUsers.get(
            referenceId
          ) || null;
      }

      history.push({
        id: `SC-${card.id}`,

        sourceId:
          card.id,

        source:
          "STOCK_CARD",

        direction,

        trxDate:
          card.trxDate,

        trxNumber:
          card.trxNumber ||
          `SC-${card.id}`,

        outletId:
          outlet.id,

        outlet,

        barangId:
          card.barang.id,

        code:
          card.barang.code,

        barang:
          card.barang.name,

        unit:
          card.barang.unit,

        qtyIn,

        qtyOut,

        quantity,

        balance:
          num(card.balance),

        unitCost,

        totalCost,

        type,

        status: null,

        note:
          card.note ||
          null,

        user:
          transactionUser,

        referenceId:
          card.referenceId ||
          null,
      });
    }

    // ========================================================
    // 2. STOCK MUTATION
    //
    // Adjustment outlet.
    // ========================================================

    const mutationWhere: any =
      {
        type: {
          in: [
            "ADJUSTMENT_IN",
            "ADJUSTMENT_OUT",
          ],
        },
      };

    if (
      dateFrom ||
      dateTo
    ) {
      mutationWhere.createdAt =
        {};

      if (dateFrom) {
        mutationWhere.createdAt.gte =
          dateFrom;
      }

      if (dateTo) {
        mutationWhere.createdAt.lte =
          dateTo;
      }
    }

    const mutations =
      await prisma.stockMutation.findMany(
        {
          where:
            mutationWhere,

          include: {
            barang: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                purchasePrice: true,
              },
            },
          },

          orderBy: {
            createdAt: "desc",
          },
        }
      );

    // ========================================================
    // MAP STOCK MUTATION
    // ========================================================

    for (
      const mutation of mutations
    ) {
      const mutationType =
        String(
          mutation.type ||
            ""
        ).toUpperCase();

      const direction: Direction =
        mutationType ===
        "ADJUSTMENT_IN"
          ? "IN"
          : "OUT";

      const quantity =
        Math.abs(
          num(mutation.qty)
        );

      if (
        quantity <= 0
      ) {
        continue;
      }

      const mutationOutletId =
        Number(
          (mutation as any)
            .outletId || 0
        );

      if (
        mutationOutletId >
        0
      ) {
        if (
          outletId &&
          mutationOutletId !==
            outletId
        ) {
          continue;
        }

        const outlet =
          outlets.find(
            (item) =>
              item.id ===
              mutationOutletId
          );

        if (!outlet) {
          continue;
        }

        history.push({
          id: `SM-${mutation.id}`,

          sourceId:
            mutation.id,

          source:
            "STOCK_MUTATION",

          direction,

          trxDate:
            mutation.createdAt,

          trxNumber:
            mutation.reference ||
            `ADJ-${mutation.id}`,

          outletId:
            outlet.id,

          outlet,

          barangId:
            mutation.barang.id,

          code:
            mutation.barang.code,

          barang:
            mutation.barang.name,

          unit:
            mutation.barang.unit,

          qtyIn:
            direction ===
            "IN"
              ? quantity
              : 0,

          qtyOut:
            direction ===
            "OUT"
              ? quantity
              : 0,

          quantity,

          balance:
            num(
              mutation.stockAfter
            ),

          unitCost:
            num(
              mutation
                .barang
                .purchasePrice
            ),

          totalCost:
            quantity *
            num(
              mutation
                .barang
                .purchasePrice
            ),

          type:
            direction ===
            "IN"
              ? "ADJUSTMENT +"
              : "ADJUSTMENT -",

          status: null,

          note:
            mutation.description ||
            null,

          /*
           * StockMutation tidak mempunyai userId/user relation
           * pada schema yang digunakan.
           */
          user: null,

          referenceId:
            mutation.id,
        });
      }
    }

    // ========================================================
    // 3. OUTLET RECEIPT FALLBACK
    // ========================================================

    const receiptWhere: any =
      {};

    if (outletId) {
      receiptWhere.outletId =
        outletId;
    }

    if (
      dateFrom ||
      dateTo
    ) {
      receiptWhere.receiptDate =
        {};

      if (dateFrom) {
        receiptWhere.receiptDate.gte =
          dateFrom;
      }

      if (dateTo) {
        receiptWhere.receiptDate.lte =
          dateTo;
      }
    }

    const receipts =
      await prisma.outletReceipt.findMany(
        {
          where:
            receiptWhere,

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
                  },
                },
              },
            },
          },

          orderBy: {
            receiptDate:
              "desc",
          },
        }
      );

    // ========================================================
    // EXISTING STOCK CARD REFERENCES
    // ========================================================

    const existingReceiptRefs =
      new Set(
        stockCards
          .filter(
            (card) =>
              card.referenceId !==
              null
          )
          .map(
            (card) =>
              `RECEIPT:${card.referenceId}`
          )
      );

    // ========================================================
    // MAP RECEIPTS
    // ========================================================

    for (
      const receipt of receipts
    ) {
      if (
        existingReceiptRefs.has(
          `RECEIPT:${receipt.id}`
        )
      ) {
        continue;
      }

      for (
        const item of receipt.items
      ) {
        const quantity =
          num(item.qty);

        if (
          quantity <= 0
        ) {
          continue;
        }

        const unitCost =
          num(item.price) ||
          num(
            item.barang
              .purchasePrice
          );

        history.push({
          id: `OR-${item.id}`,

          sourceId:
            item.id,

          source:
            "OUTLET_RECEIPT",

          direction:
            "IN",

          trxDate:
            receipt.receiptDate,

          trxNumber:
            receipt.number,

          outletId:
            receipt.outlet.id,

          outlet:
            receipt.outlet,

          barangId:
            item.barang.id,

          code:
            item.barang.code,

          barang:
            item.barang.name,

          unit:
            item.barang.unit,

          qtyIn:
            quantity,

          qtyOut: 0,

          quantity,

          balance: 0,

          unitCost,

          totalCost:
            quantity *
            unitCost,

          type:
            "PENERIMAAN",

          status: null,

          note:
            receipt.remarks ||
            "Penerimaan barang outlet",

          /*
           * OutletReceipt tidak mempunyai creator/user field
           * pada schema yang digunakan.
           */
          user: null,

          referenceId:
            receipt.id,
        });
      }
    }

    // ========================================================
    // 4. FINAL FILTER
    // ========================================================

    let result =
      history;

    // ========================================================
    // DIRECTION
    // ========================================================

    if (
      directionParam ===
        "IN" ||
      directionParam ===
        "OUT"
    ) {
      result =
        result.filter(
          (item) =>
            item.direction ===
            directionParam
        );
    }

    // ========================================================
    // SOURCE
    // ========================================================

    if (sourceParam) {
      result =
        result.filter(
          (item) =>
            item.source
              .toUpperCase() ===
            sourceParam
        );
    }

    // ========================================================
    // TYPE
    // ========================================================

    if (typeParam) {
      result =
        result.filter(
          (item) =>
            item.type
              .toUpperCase()
              .includes(
                typeParam
              ) ||
            getTypeLabel(
              item.type
            )
              .toUpperCase()
              .includes(
                typeParam
              )
        );
    }

    // ========================================================
    // USER
    // ========================================================

    if (
      requestedUserId >
      0
    ) {
      result =
        result.filter(
          (item) =>
            Number(
              item.user?.id ||
                0
            ) ===
            requestedUserId
        );
    }

    // ========================================================
    // SEARCH
    // ========================================================

    if (searchParam) {
      result =
        result.filter(
          (item) => {
            const text = [
              item.trxNumber,

              item.type,

              item.source,

              item.code,

              item.barang,

              item.unit,

              item.outlet.code,

              item.outlet.name,

              item.note ||
                "",

              item.user
                ?.fullname ||
                "",

              item.user
                ?.username ||
                "",
            ]
              .join(" ")
              .toLowerCase();

            return text.includes(
              searchParam
            );
          }
        );
    }

    // ========================================================
    // SORT
    // ========================================================

    result.sort(
      (a, b) => {
        const dateDiff =
          new Date(
            b.trxDate
          ).getTime() -
          new Date(
            a.trxDate
          ).getTime();

        if (
          dateDiff !== 0
        ) {
          return dateDiff;
        }

        return (
          b.sourceId -
          a.sourceId
        );
      }
    );

    // ========================================================
    // SUMMARY
    // ========================================================

    const summary =
      result.reduce(
        (acc, item) => {
          acc.transactionCount +=
            1;

          acc.totalIn +=
            item.qtyIn;

          acc.totalOut +=
            item.qtyOut;

          acc.totalValueIn +=
            item.direction ===
            "IN"
              ? item.totalCost
              : 0;

          acc.totalValueOut +=
            item.direction ===
            "OUT"
              ? item.totalCost
              : 0;

          return acc;
        },
        {
          transactionCount: 0,
          totalIn: 0,
          totalOut: 0,
          totalValueIn: 0,
          totalValueOut: 0,
        }
      );

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json({
      success: true,

      role,

      currentOutlet:
        role ===
        "OUTLET_ADMIN"
          ? outlets[0] ||
            null
          : null,

      outlets,

      transactions:
        result,

      summary,

      meta: {
        total:
          result.length,

        generatedAt:
          new Date().toISOString(),

        ledger:
          "STOCK_CARD + STOCK_MUTATION + OUTLET_RECEIPT_FALLBACK",

        directions: [
          "IN",
          "OUT",
        ],
      },
    });
  } catch (error: any) {
    console.error(
      "GET OUTLET HISTORY STOCK ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal mengambil history stock outlet",
      },
      {
        status: 500,
      }
    );
  }
}