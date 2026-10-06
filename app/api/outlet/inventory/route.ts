import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/*
 * =========================================================
 * OUTLET INVENTORY MONTHLY API
 * =========================================================
 *
 * ATURAN INVENTORY OUTLET
 * =========================================================
 *
 * 1. Periode menggunakan YYYY-MM.
 *
 * 2. Stock Awal:
 *
 *    PRIORITAS:
 *
 *    A. APPROVED Monthly Stock Opname
 *       bulan sebelumnya.
 *
 *    B. Jika belum tersedia:
 *       Ending Stock snapshot bulan sebelumnya.
 *
 *    C. Jika belum tersedia:
 *       0.
 *
 *    IMPORTANT:
 *    Stock Awal TIDAK diambil dari OutletStock.stock
 *    sebagai sumber utama.
 *
 * 3. Barang Masuk / Barang Keluar:
 *
 *    berasal dari StockCard:
 *
 *       warehouse = OUTLET:<OUTLET_CODE>
 *
 * 4. StockCard yang merupakan STOCK OPNAME tidak dihitung
 *    sebagai Barang Masuk / Barang Keluar.
 *
 *    Tujuannya agar opname bulan berjalan TIDAK mengubah
 *    Ending Stock laporan bulan tersebut.
 *
 * 5. Ending Stock:
 *
 *       Opening
 *       + Incoming
 *       - Outgoing
 *
 * 6. BULAN BERJALAN:
 *
 *    Snapshot selalu diperbarui setiap GET.
 *
 * 7. BULAN YANG SUDAH LEWAT:
 *
 *    Jika snapshot sudah ada:
 *      TIDAK BOLEH dihitung ulang.
 *      TIDAK BOLEH disesuaikan dengan opname bulan itu.
 *
 *    Jika snapshot belum ada:
 *      dibuat satu kali berdasarkan transaksi bulan tersebut.
 *
 * 8. OUTLET_ADMIN:
 *
 *    hanya boleh melihat outlet dari session user.outletId.
 *
 * 9. ADMIN / MANAGER:
 *
 *    dapat memilih outlet.
 *
 * =========================================================
 */

const ALLOWED_ROLES = [
  "ADMIN",
  "MANAGER",
  "OUTLET_ADMIN",
];

const COST_STABLE_TOLERANCE = 5;

/*
 * =========================================================
 * SESSION
 * =========================================================
 *
 * Mengikuti persis pola /api/me.
 *
 * Cookie:
 *
 *   erp-session
 *
 * Value:
 *
 *   {"id":123}
 *
 * TIDAK menggunakan prisma.session.
 */
async function getSessionUser() {
  const cookieStore = await cookies();

  const session = cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  let sessionData: {
    id?: number;
  };

  try {
    sessionData = JSON.parse(session.value);
  } catch (error) {
    console.error(
      "OUTLET INVENTORY INVALID ERP SESSION:",
      error,
    );

    return null;
  }

  if (!sessionData?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: Number(sessionData.id),
    },
    include: {
      outlet: true,
    },
  });

  if (!user) {
    return null;
  }

  if (!user.active) {
    return null;
  }

  return user;
}

/*
 * =========================================================
 * PERIOD HELPERS
 * =========================================================
 */

function getCurrentPeriod() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const year = Number(
    parts.find((item) => item.type === "year")?.value,
  );

  const month = Number(
    parts.find((item) => item.type === "month")?.value,
  );

  return {
    year,
    month,
  };
}

function parsePeriod(value: string | null) {
  const current = getCurrentPeriod();

  if (!value) {
    return current;
  }

  const match = /^(\d{4})-(\d{2})$/.exec(value);

  if (!match) {
    return current;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return current;
  }

  return {
    year,
    month,
  };
}

function periodValue(
  year: number,
  month: number,
) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/*
 * Membuat tanggal berdasarkan timezone Asia/Jakarta.
 *
 * Database menyimpan DateTime UTC.
 * 00:00 WIB = 17:00 UTC hari sebelumnya.
 */
function periodStart(
  year: number,
  month: number,
) {
  return new Date(
    Date.UTC(
      year,
      month - 1,
      1,
      0,
      0,
      0,
      0,
    ) -
      7 * 60 * 60 * 1000,
  );
}

function periodEnd(
  year: number,
  month: number,
) {
  return new Date(
    Date.UTC(
      year,
      month,
      1,
      0,
      0,
      0,
      0,
    ) -
      7 * 60 * 60 * 1000,
  );
}

function previousPeriod(
  year: number,
  month: number,
) {
  if (month === 1) {
    return {
      year: year - 1,
      month: 12,
    };
  }

  return {
    year,
    month: month - 1,
  };
}

function isCurrentPeriod(
  year: number,
  month: number,
) {
  const current = getCurrentPeriod();

  return (
    current.year === year &&
    current.month === month
  );
}

function isFuturePeriod(
  year: number,
  month: number,
) {
  const current = getCurrentPeriod();

  if (year > current.year) {
    return true;
  }

  if (
    year === current.year &&
    month > current.month
  ) {
    return true;
  }

  return false;
}

/*
 * =========================================================
 * NUMBER HELPERS
 * =========================================================
 */

function numberValue(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
}

function round(
  value: number,
  decimals = 4,
) {
  const factor = Math.pow(
    10,
    decimals,
  );

  return (
    Math.round(
      (value + Number.EPSILON) *
        factor,
    ) / factor
  );
}

/*
 * =========================================================
 * STATUS
 * =========================================================
 */

function getCostStatus(
  changePercentage: number,
) {
  if (
    changePercentage >
    COST_STABLE_TOLERANCE
  ) {
    return "NAIK";
  }

  if (
    changePercentage <
    -COST_STABLE_TOLERANCE
  ) {
    return "TURUN";
  }

  return "STABIL";
}

function getStockStatus(
  stock: number,
  minimumStock: number,
) {
  if (stock <= 0) {
    return "HABIS";
  }

  if (
    minimumStock > 0 &&
    stock <= minimumStock
  ) {
    return "LOW STOCK";
  }

  return "AMAN";
}

/*
 * =========================================================
 * GET
 * =========================================================
 */

export async function GET(
  request: NextRequest,
) {
  try {
    /*
     * =======================================================
     * SESSION
     * =======================================================
     */

    const user =
      await getSessionUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        {
          status: 401,
        },
      );
    }

    /*
     * =======================================================
     * ROLE
     * =======================================================
     */

    if (
      !ALLOWED_ROLES.includes(
        user.role,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses ke Inventory Outlet.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * =======================================================
     * PERIOD
     * =======================================================
     */

    const { searchParams } =
      new URL(request.url);

    const {
      year,
      month,
    } = parsePeriod(
      searchParams.get("month"),
    );

    /*
     * Inventory tidak boleh melihat periode future.
     */
    if (
      isFuturePeriod(
        year,
        month,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Inventory Outlet untuk bulan yang akan datang belum tersedia.",
        },
        {
          status: 400,
        },
      );
    }

    const requestedOutletId =
      searchParams.get(
        "outletId",
      );

    /*
     * =======================================================
     * OUTLET
     * =======================================================
     */

    let outletId: number | null =
      null;

    /*
     * OUTLET_ADMIN:
     * SELALU pakai outlet dari session.
     *
     * Tidak boleh percaya outletId dari URL.
     */
    if (
      user.role ===
      "OUTLET_ADMIN"
    ) {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User Outlet Admin belum memiliki outlet.",
          },
          {
            status: 400,
          },
        );
      }

      outletId =
        user.outletId;
    } else {
      /*
       * ADMIN / MANAGER
       */

      if (requestedOutletId) {
        const parsed =
          Number(
            requestedOutletId,
          );

        if (
          Number.isInteger(
            parsed,
          ) &&
          parsed > 0
        ) {
          outletId = parsed;
        }
      }

      /*
       * Jika belum memilih outlet,
       * otomatis gunakan outlet aktif pertama.
       */
      if (!outletId) {
        const firstOutlet =
          await prisma.outlet.findFirst(
            {
              where: {
                active: true,
              },
              orderBy: {
                name: "asc",
              },
              select: {
                id: true,
              },
            },
          );

        outletId =
          firstOutlet?.id ??
          null;
      }
    }

    /*
     * Tidak ada outlet.
     */
    if (!outletId) {
      return NextResponse.json({
        success: true,
        outlet: null,
        outlets: [],
        period: {
          year,
          month,
          value: periodValue(
            year,
            month,
          ),
          isCurrent:
            isCurrentPeriod(
              year,
              month,
            ),
        },
        data: [],
        summary: {
          totalItems: 0,
          totalIncoming: 0,
          totalOutgoing: 0,
          totalOutgoingCost: 0,
          totalEndingStock: 0,
          lowStockCount: 0,
          emptyStockCount: 0,
        },
      });
    }

    /*
     * =======================================================
     * GET OUTLET
     * =======================================================
     */

    const outlet =
      await prisma.outlet.findUnique(
        {
          where: {
            id: outletId,
          },
          select: {
            id: true,
            code: true,
            name: true,
            active: true,
          },
        },
      );

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * =======================================================
     * OUTLET LIST
     * =======================================================
     */

    let outlets: Array<{
      id: number;
      code: string;
      name: string;
    }> = [];

    if (
      user.role ===
      "OUTLET_ADMIN"
    ) {
      outlets = [
        {
          id: outlet.id,
          code: outlet.code,
          name: outlet.name,
        },
      ];
    } else {
      outlets =
        await prisma.outlet.findMany(
          {
            where: {
              active: true,
            },
            orderBy: {
              name: "asc",
            },
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        );
    }

    /*
     * =======================================================
     * PERIOD
     * =======================================================
     */

    const start =
      periodStart(
        year,
        month,
      );

    const end =
      periodEnd(
        year,
        month,
      );

    const currentPeriod =
      isCurrentPeriod(
        year,
        month,
      );

    const previous =
      previousPeriod(
        year,
        month,
      );

    const previousStart =
      periodStart(
        previous.year,
        previous.month,
      );

    const previousEnd =
      periodEnd(
        previous.year,
        previous.month,
      );

    /*
     * =======================================================
     * WAREHOUSE
     * =======================================================
     */

    const warehouse =
      `OUTLET:${outlet.code}`;

    /*
     * =======================================================
     * OUTLET STOCK
     * =======================================================
     *
     * Digunakan untuk mengetahui barang yang memang
     * tersedia / pernah tersedia di outlet.
     */

    const outletStocks =
      await prisma.outletStock.findMany(
        {
          where: {
            outletId,
            barang: {
              active: true,
            },
          },
          include: {
            barang: true,
          },
          orderBy: {
            barang: {
              name: "asc",
            },
          },
        },
      );

    /*
     * =======================================================
     * CURRENT PERIOD STOCK CARD
     * =======================================================
     *
     * Semua transaksi outlet bulan tersebut.
     *
     * Stock Opname TIDAK dihitung sebagai movement.
     */

    const periodStockCards =
      await prisma.stockCard.findMany(
        {
          where: {
            warehouse,
            trxDate: {
              gte: start,
              lt: end,
            },
          },
          select: {
            barangId: true,
            qtyIn: true,
            qtyOut: true,
            unitPrice: true,
            totalValue: true,
            trxType: true,
            trxDate: true,
          },
        },
      );

    /*
     * =======================================================
     * PREVIOUS PERIOD STOCK CARD
     * =======================================================
     *
     * Digunakan untuk fallback cost jika snapshot bulan
     * sebelumnya belum tersedia.
     */

    const previousStockCards =
      await prisma.stockCard.findMany(
        {
          where: {
            warehouse,
            trxDate: {
              gte: previousStart,
              lt: previousEnd,
            },
          },
          select: {
            barangId: true,
            qtyIn: true,
            qtyOut: true,
            unitPrice: true,
            totalValue: true,
            trxType: true,
          },
        },
      );

    /*
     * =======================================================
     * BARANG MAP
     * =======================================================
     */

    const barangMap = new Map<
      number,
      {
        barang: (typeof outletStocks)[number]["barang"];
        outletStock:
          | (typeof outletStocks)[number]
          | null;
      }
    >();

    for (
      const item of outletStocks
    ) {
      barangMap.set(
        item.barangId,
        {
          barang: item.barang,
          outletStock: item,
        },
      );
    }

    /*
     * Tambahkan barang yang memiliki StockCard tetapi
     * belum memiliki OutletStock.
     */

    const additionalBarangIds =
      new Set<number>();

    for (
      const card of periodStockCards
    ) {
      additionalBarangIds.add(
        card.barangId,
      );
    }

    for (
      const card of previousStockCards
    ) {
      additionalBarangIds.add(
        card.barangId,
      );
    }

    const missingBarangIds =
      Array.from(
        additionalBarangIds,
      ).filter(
        (id) =>
          !barangMap.has(id),
      );

    if (
      missingBarangIds.length >
      0
    ) {
      const missingBarangs =
        await prisma.barang.findMany(
          {
            where: {
              id: {
                in: missingBarangIds,
              },
              active: true,
            },
          },
        );

      for (
        const barang of missingBarangs
      ) {
        barangMap.set(
          barang.id,
          {
            barang,
            outletStock: null,
          },
        );
      }
    }

    /*
     * =======================================================
     * CURRENT STOCK MAP
     * =======================================================
     */

    const currentOutletStocks =
      await prisma.outletStock.findMany(
        {
          where: {
            outletId,
          },
          select: {
            barangId: true,
            stock: true,
            minimumStock: true,
            averageCost: true,
          },
        },
      );

    const currentStockMap =
      new Map(
        currentOutletStocks.map(
          (item) => [
            item.barangId,
            item,
          ],
        ),
      );

    /*
     * =======================================================
     * CURRENT STOCK CARD MAP
     * =======================================================
     */

    const cardMap = new Map<
      number,
      {
        incomingQty: number;
        outgoingQty: number;
        incomingCost: number;
        outgoingCost: number;
      }
    >();

    for (
      const card of periodStockCards
    ) {
      /*
       * Jangan masukkan Stock Opname ke movement.
       *
       * Dengan begitu:
       *
       * opname bulan Oktober
       * tidak mengubah
       * ending Oktober.
       */

      const trxType =
        String(
          card.trxType ??
            "",
        ).toUpperCase();

      if (
        trxType.includes(
          "OPNAME",
        )
      ) {
        continue;
      }

      const existing =
        cardMap.get(
          card.barangId,
        ) ?? {
          incomingQty: 0,
          outgoingQty: 0,
          incomingCost: 0,
          outgoingCost: 0,
        };

      const qtyIn =
        numberValue(
          card.qtyIn,
        );

      const qtyOut =
        numberValue(
          card.qtyOut,
        );

      const unitPrice =
        numberValue(
          card.unitPrice,
        );

      const totalValue =
        numberValue(
          card.totalValue,
        );

      existing.incomingQty +=
        qtyIn;

      existing.outgoingQty +=
        qtyOut;

      /*
       * Incoming cost.
       */

      if (qtyIn > 0) {
        existing.incomingCost +=
          totalValue > 0
            ? totalValue
            : qtyIn *
              unitPrice;
      }

      /*
       * Outgoing cost.
       */

      if (qtyOut > 0) {
        existing.outgoingCost +=
          unitPrice > 0
            ? qtyOut *
              unitPrice
            : totalValue > 0
              ? totalValue
              : 0;
      }

      cardMap.set(
        card.barangId,
        existing,
      );
    }

    /*
     * =======================================================
     * PREVIOUS STOCK CARD COST MAP
     * =======================================================
     */

    const previousCardMap =
      new Map<
        number,
        {
          incomingQty: number;
          outgoingQty: number;
          incomingCost: number;
          outgoingCost: number;
        }
      >();

    for (
      const card of previousStockCards
    ) {
      const trxType =
        String(
          card.trxType ??
            "",
        ).toUpperCase();

      /*
       * Opname tidak dihitung sebagai movement.
       */
      if (
        trxType.includes(
          "OPNAME",
        )
      ) {
        continue;
      }

      const existing =
        previousCardMap.get(
          card.barangId,
        ) ?? {
          incomingQty: 0,
          outgoingQty: 0,
          incomingCost: 0,
          outgoingCost: 0,
        };

      const qtyIn =
        numberValue(
          card.qtyIn,
        );

      const qtyOut =
        numberValue(
          card.qtyOut,
        );

      const unitPrice =
        numberValue(
          card.unitPrice,
        );

      const totalValue =
        numberValue(
          card.totalValue,
        );

      existing.incomingQty +=
        qtyIn;

      existing.outgoingQty +=
        qtyOut;

      if (qtyIn > 0) {
        existing.incomingCost +=
          totalValue > 0
            ? totalValue
            : qtyIn *
              unitPrice;
      }

      if (qtyOut > 0) {
        existing.outgoingCost +=
          unitPrice > 0
            ? qtyOut *
              unitPrice
            : totalValue > 0
              ? totalValue
              : 0;
      }

      previousCardMap.set(
        card.barangId,
        existing,
      );
    }

    /*
     * =======================================================
     * APPROVED MONTHLY OPNAME
     * =======================================================
     *
     * KHUSUS BULAN SEBELUMNYA.
     *
     * Contoh:
     *
     * Inventory Oktober
     *       ↓
     * Stock Awal dari
     * Approved Monthly Opname September
     *
     * Kita TIDAK mengambil opname Oktober untuk opening.
     */

    const approvedPreviousOpname =
      await prisma.stockOpname.findFirst(
        {
          where: {
            outletId,
            type: "MONTHLY",
            status: "APPROVED",
            date: {
              gte: previousStart,
              lt: start,
            },
          },
          orderBy: {
            date: "desc",
          },
          include: {
            items: true,
          },
        },
      );

    const previousOpnameMap =
      new Map<
        number,
        number
      >();

    if (
      approvedPreviousOpname
    ) {
      for (
        const item of
          approvedPreviousOpname.items
      ) {
        previousOpnameMap.set(
          item.barangId,
          numberValue(
            item.physicalQty,
          ),
        );
      }
    }

    /*
     * =======================================================
     * SNAPSHOT CURRENT PERIOD
     * =======================================================
     */

    const currentSnapshots =
      await prisma.outletInventoryMonthly.findMany(
        {
          where: {
            outletId,
            periodYear: year,
            periodMonth: month,
          },
        },
      );

    const currentSnapshotMap =
      new Map(
        currentSnapshots.map(
          (item) => [
            item.barangId,
            item,
          ],
        ),
      );

    /*
     * =======================================================
     * SNAPSHOT PREVIOUS PERIOD
     * =======================================================
     */

    const previousSnapshots =
      await prisma.outletInventoryMonthly.findMany(
        {
          where: {
            outletId,
            periodYear:
              previous.year,
            periodMonth:
              previous.month,
          },
        },
      );

    const previousSnapshotMap =
      new Map(
        previousSnapshots.map(
          (item) => [
            item.barangId,
            item,
          ],
        ),
      );

    /*
     * =======================================================
     * BUILD ROWS
     * =======================================================
     */

    const rows: any[] = [];

    for (
      const [
        barangId,
        source,
      ] of barangMap.entries()
    ) {
      const barang =
        source.barang;

      const outletStock =
        currentStockMap.get(
          barangId,
        );

      const card =
        cardMap.get(
          barangId,
        ) ?? {
          incomingQty: 0,
          outgoingQty: 0,
          incomingCost: 0,
          outgoingCost: 0,
        };

      const previousCard =
        previousCardMap.get(
          barangId,
        ) ?? {
          incomingQty: 0,
          outgoingQty: 0,
          incomingCost: 0,
          outgoingCost: 0,
        };

      const previousSnapshot =
        previousSnapshotMap.get(
          barangId,
        );

      const currentSnapshot =
        currentSnapshotMap.get(
          barangId,
        );

      /*
       * =====================================================
       * OPENING STOCK
       * =====================================================
       *
       * PRIORITAS:
       *
       * 1. Approved Monthly Opname bulan sebelumnya
       * 2. Ending snapshot bulan sebelumnya
       * 3. 0
       *
       * Kenapa opname prioritas?
       *
       * Karena aturan inventory kamu:
       *
       * Stock Awal bulan baru
       * berasal dari APPROVED Stock Opname bulan sebelumnya.
       */

      let openingStock = 0;

      let openingSource =
        "NONE";

      if (
        previousOpnameMap.has(
          barangId,
        )
      ) {
        openingStock =
          numberValue(
            previousOpnameMap.get(
              barangId,
            ),
          );

        openingSource =
          "APPROVED_MONTHLY_OPNAME";
      } else if (
        previousSnapshot
      ) {
        openingStock =
          numberValue(
            previousSnapshot.endingStock,
          );

        openingSource =
          "PREVIOUS_MONTH_ENDING";
      }

      /*
       * =====================================================
       * ENDING STOCK
       * =====================================================
       */

      let endingStock =
        openingStock +
        card.incomingQty -
        card.outgoingQty;

      /*
       * =====================================================
       * HISTORICAL SNAPSHOT
       * =====================================================
       *
       * Kalau bulan sudah lewat dan snapshot sudah ada,
       * snapshot tersebut adalah sumber kebenaran.
       *
       * TIDAK dihitung ulang.
       * TIDAK disesuaikan dengan opname bulan itu.
       */

      if (
        !currentPeriod &&
        currentSnapshot
      ) {
        openingStock =
          numberValue(
            currentSnapshot.openingStock,
          );

        endingStock =
          numberValue(
            currentSnapshot.endingStock,
          );
      }

      /*
       * =====================================================
       * COST
       * =====================================================
       *
       * Bulan berjalan:
       *
       * 1. OutletStock.averageCost
       * 2. Weighted incoming cost
       * 3. Previous snapshot cost
       * 4. Barang.purchasePrice
       *
       * Historical baru:
       *
       * 1. Weighted incoming cost
       * 2. Previous snapshot cost
       * 3. Barang.purchasePrice
       *
       * Historical snapshot lama:
       * gunakan nilai snapshot.
       */

      let averageCost = 0;

      if (
        !currentPeriod &&
        currentSnapshot
      ) {
        averageCost =
          numberValue(
            currentSnapshot.averageCost,
          );
      }

      if (
        averageCost <= 0
      ) {
        if (
          currentPeriod &&
          numberValue(
            outletStock?.averageCost,
          ) > 0
        ) {
          averageCost =
            numberValue(
              outletStock?.averageCost,
            );
        }
      }

      /*
       * Weighted average incoming.
       */

      if (
        averageCost <= 0 &&
        card.incomingQty > 0 &&
        card.incomingCost > 0
      ) {
        averageCost =
          card.incomingCost /
          card.incomingQty;
      }

      /*
       * Previous snapshot cost.
       */

      if (
        averageCost <= 0 &&
        previousSnapshot
      ) {
        averageCost =
          numberValue(
            previousSnapshot.averageCost,
          );
      }

      /*
       * Previous StockCard weighted outgoing.
       */

      if (
        averageCost <= 0 &&
        previousCard.outgoingQty >
          0 &&
        previousCard.outgoingCost >
          0
      ) {
        averageCost =
          previousCard.outgoingCost /
          previousCard.outgoingQty;
      }

      /*
       * Final fallback.
       */

      if (
        averageCost <= 0
      ) {
        averageCost =
          numberValue(
            barang.purchasePrice,
          );
      }

      /*
       * =====================================================
       * OUTGOING COST
       * =====================================================
       */

      let outgoingCost =
        card.outgoingCost;

      if (
        outgoingCost <= 0 &&
        card.outgoingQty > 0
      ) {
        outgoingCost =
          card.outgoingQty *
          averageCost;
      }

      /*
       * =====================================================
       * INCOMING COST
       * =====================================================
       */

      const incomingCost =
        card.incomingCost;

      /*
       * =====================================================
       * PREVIOUS COST
       * =====================================================
       *
       * Untuk perbandingan cost bulan ke bulan:
       *
       * Current averageCost
       * vs
       * Previous averageCost
       */

      let previousAverageCost = 0;

      if (
        previousSnapshot
      ) {
        previousAverageCost =
          numberValue(
            previousSnapshot.averageCost,
          );
      }

      if (
        previousAverageCost <= 0 &&
        previousCard.incomingQty >
          0 &&
        previousCard.incomingCost >
          0
      ) {
        previousAverageCost =
          previousCard.incomingCost /
          previousCard.incomingQty;
      }

      if (
        previousAverageCost <= 0 &&
        previousCard.outgoingQty >
          0 &&
        previousCard.outgoingCost >
          0
      ) {
        previousAverageCost =
          previousCard.outgoingCost /
          previousCard.outgoingQty;
      }

      if (
        previousAverageCost <= 0
      ) {
        previousAverageCost =
          numberValue(
            barang.purchasePrice,
          );
      }

      /*
       * =====================================================
       * COST CHANGE
       * =====================================================
       */

      let costChangePercentage =
        0;

      if (
        previousAverageCost > 0
      ) {
        costChangePercentage =
          (
            (
              averageCost -
              previousAverageCost
            ) /
            previousAverageCost
          ) *
          100;
      } else if (
        averageCost > 0
      ) {
        costChangePercentage =
          100;
      }

      const costStatus =
        getCostStatus(
          costChangePercentage,
        );

      /*
       * =====================================================
       * USAGE %
       * =====================================================
       *
       * Persentase barang keluar terhadap total barang
       * yang tersedia pada periode:
       *
       *   opening + incoming
       *
       * Contoh:
       *
       * Opening 100
       * Incoming 50
       * Outgoing 30
       *
       * Usage =
       *
       * 30 / 150 × 100
       * = 20%
       */

      const availableQty =
        openingStock +
        card.incomingQty;

      const usagePercentage =
        availableQty > 0
          ? (
              card.outgoingQty /
              availableQty
            ) *
            100
          : 0;

      /*
       * =====================================================
       * STOCK STATUS
       * =====================================================
       */

      const minimumStock =
        numberValue(
          outletStock?.minimumStock ??
            barang.minimumStock,
        );

      const stockStatus =
        getStockStatus(
          endingStock,
          minimumStock,
        );

      /*
       * =====================================================
       * SNAPSHOT DATA
       * =====================================================
       */

      const snapshotData = {
        openingStock:
          round(
            openingStock,
          ),

        incomingQty:
          round(
            card.incomingQty,
          ),

        outgoingQty:
          round(
            card.outgoingQty,
          ),

        endingStock:
          round(
            endingStock,
          ),

        averageCost:
          round(
            averageCost,
            2,
          ),

        outgoingCost:
          round(
            outgoingCost,
            2,
          ),

        usagePercentage:
          round(
            usagePercentage,
            2,
          ),

        /*
         * Disimpan untuk kompatibilitas dengan schema
         * monthly inventory yang sudah dibuat.
         *
         * Nilai ini adalah cost barang keluar bulan
         * sebelumnya, bukan cost unit.
         */
        previousOutgoingCost:
          previousSnapshot
            ? round(
                numberValue(
                  previousSnapshot.outgoingCost,
                ),
                2,
              )
            : round(
                previousCard.outgoingCost,
                2,
              ),

        costChangePercentage:
          round(
            costChangePercentage,
            2,
          ),

        costStatus,

        stockStatus,
      };

      /*
       * =====================================================
       * SAVE SNAPSHOT
       * =====================================================
       */

      if (
        currentPeriod
      ) {
        /*
         * BULAN BERJALAN:
         *
         * Selalu update.
         */

        await prisma.outletInventoryMonthly.upsert(
          {
            where: {
              outletId_barangId_periodYear_periodMonth:
                {
                  outletId,
                  barangId,
                  periodYear:
                    year,
                  periodMonth:
                    month,
                },
            },

            create: {
              outletId,
              barangId,
              periodYear:
                year,
              periodMonth:
                month,
              ...snapshotData,
            },

            update:
              snapshotData,
          },
        );
      } else if (
        !currentSnapshot
      ) {
        /*
         * BULAN LAMA tetapi snapshot belum ada:
         *
         * Buat SATU KALI.
         *
         * Setelah dibuat, bulan tersebut tidak akan
         * dihitung ulang.
         */

        try {
          await prisma.outletInventoryMonthly.create(
            {
              data: {
                outletId,
                barangId,
                periodYear:
                  year,
                periodMonth:
                  month,
                ...snapshotData,
              },
            },
          );
        } catch (error: any) {
          /*
           * Jika ada request bersamaan dan snapshot
           * sudah dibuat request lain, abaikan P2002.
           */

          if (
            error?.code !==
            "P2002"
          ) {
            throw error;
          }
        }
      }

      /*
       * =====================================================
       * RESPONSE ROW
       * =====================================================
       */

      rows.push({
        id: barangId,
        barangId,

        code:
          barang.code,

        category:
          barang.category ??
          "-",

        name:
          barang.name,

        unit:
          barang.unit,

        baseUnit:
          barang.baseUnit ??
          barang.unit,

        conversionRate:
          numberValue(
            barang.conversionRate,
          ) || 1,

        openingStock:
          round(
            openingStock,
          ),

        openingSource,

        incomingQty:
          round(
            card.incomingQty,
          ),

        outgoingQty:
          round(
            card.outgoingQty,
          ),

        endingStock:
          round(
            endingStock,
          ),

        averageCost:
          round(
            averageCost,
            2,
          ),

        outgoingCost:
          round(
            outgoingCost,
            2,
          ),

        usagePercentage:
          round(
            usagePercentage,
            2,
          ),

        previousAverageCost:
          round(
            previousAverageCost,
            2,
          ),

        costChangePercentage:
          round(
            costChangePercentage,
            2,
          ),

        costStatus,

        stockStatus,

        minimumStock:
          round(
            minimumStock,
          ),
      });
    }

    /*
     * =======================================================
     * SORT
     * =======================================================
     */

    rows.sort(
      (a, b) =>
        String(
          a.name,
        ).localeCompare(
          String(
            b.name,
          ),
          "id",
        ),
    );

    /*
     * =======================================================
     * SUMMARY
     * =======================================================
     */

    const summary = {
      totalItems:
        rows.length,

      totalIncoming:
        round(
          rows.reduce(
            (
              total,
              item,
            ) =>
              total +
              numberValue(
                item.incomingQty,
              ),
            0,
          ),
        ),

      totalOutgoing:
        round(
          rows.reduce(
            (
              total,
              item,
            ) =>
              total +
              numberValue(
                item.outgoingQty,
              ),
            0,
          ),
        ),

      totalOutgoingCost:
        round(
          rows.reduce(
            (
              total,
              item,
            ) =>
              total +
              numberValue(
                item.outgoingCost,
              ),
            0,
          ),
          2,
        ),

      totalEndingStock:
        round(
          rows.reduce(
            (
              total,
              item,
            ) =>
              total +
              numberValue(
                item.endingStock,
              ),
            0,
          ),
        ),

      lowStockCount:
        rows.filter(
          (item) =>
            item.stockStatus ===
            "LOW STOCK",
        ).length,

      emptyStockCount:
        rows.filter(
          (item) =>
            item.stockStatus ===
            "HABIS",
        ).length,
    };

    /*
     * =======================================================
     * RESPONSE
     * =======================================================
     */

    return NextResponse.json({
      success: true,

      outlet: {
        id:
          outlet.id,

        code:
          outlet.code,

        name:
          outlet.name,
      },

      outlets,

      period: {
        year,
        month,

        value:
          periodValue(
            year,
            month,
          ),

        start:
          start.toISOString(),

        end:
          end.toISOString(),

        isCurrent:
          currentPeriod,
      },

      /*
       * Informasi sumber opening untuk debugging/UI.
       */
      opening: {
        previousPeriod:
          periodValue(
            previous.year,
            previous.month,
          ),

        approvedMonthlyOpname:
          approvedPreviousOpname
            ? {
                id:
                  approvedPreviousOpname.id,
                code:
                  approvedPreviousOpname.code,
                date:
                  approvedPreviousOpname.date,
              }
            : null,

        source:
          approvedPreviousOpname
            ? "APPROVED_MONTHLY_OPNAME"
            : previousSnapshots.length >
                0
              ? "PREVIOUS_MONTH_ENDING"
              : "NONE",
      },

      data:
        rows,

      summary,
    });
  } catch (error) {
    console.error(
      "GET /api/outlet/inventory error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal mengambil Inventory Outlet.",
      },
      {
        status: 500,
      },
    );
  }
}