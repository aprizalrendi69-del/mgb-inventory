import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// =====================================================
// CURRENT LOGIN USER
// =====================================================

async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  let sessionData: any;

  try {
    sessionData = JSON.parse(session.value);
  } catch {
    return null;
  }

  const userId = Number(
    sessionData?.id ?? sessionData?.user?.id
  );

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return prisma.user.findUnique({
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
// RESPONSE HELPER
// =====================================================

function unauthorized(message = "Tidak login") {
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

// =====================================================
// ROLE HELPER
// =====================================================

function isAdmin(user: any) {
  return (
    String(user?.role || "").toUpperCase() ===
    "ADMIN"
  );
}

function isOutletAdmin(user: any) {
  return (
    String(user?.role || "").toUpperCase() ===
    "OUTLET_ADMIN"
  );
}

// =====================================================
// ID VALIDATION
// =====================================================

function validId(value: any) {
  const id = Number(value);

  return (
    Number.isInteger(id) &&
    id > 0
  );
}

// =====================================================
// NUMBER VALIDATION
// =====================================================

function validNumber(value: any) {
  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number >= 0
  );
}

// =====================================================
// SAFE NUMBER
// =====================================================

function numberValue(value: any) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : 0;
}

// =====================================================
// PERIOD HELPER
//
// Format:
// YYYY-MM
//
// Contoh:
// 2026-10
// =====================================================

function getPeriodRange(
  periodParam: string | null
) {
  const now = new Date();

  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  if (
    periodParam &&
    /^\d{4}-\d{2}$/.test(periodParam)
  ) {
    const parts = periodParam.split("-");

    const parsedYear = Number(parts[0]);
    const parsedMonth = Number(parts[1]);

    if (
      Number.isInteger(parsedYear) &&
      Number.isInteger(parsedMonth) &&
      parsedMonth >= 1 &&
      parsedMonth <= 12
    ) {
      year = parsedYear;
      month = parsedMonth;
    }
  }

  const start = new Date(
    year,
    month - 1,
    1,
    0,
    0,
    0,
    0
  );

  const end = new Date(
    year,
    month,
    1,
    0,
    0,
    0,
    0
  );

  const previousStart = new Date(
    year,
    month - 2,
    1,
    0,
    0,
    0,
    0
  );

  const previousEnd = new Date(
    year,
    month - 1,
    1,
    0,
    0,
    0,
    0
  );

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const isCurrentPeriod =
    year === currentYear &&
    month === currentMonth;

  return {
    year,
    month,

    period:
      `${year}-${String(month).padStart(2, "0")}`,

    start,
    end,

    previousStart,
    previousEnd,

    isCurrentPeriod,
  };
}

// =====================================================
// MAP HELPERS
// =====================================================

type OpeningData = {
  qty: number;
  opnameId: number;
  opnameCode: string;
  opnameDate: Date;
};

type NumericMap = Map<string, number>;

function makeKey(
  outletId: number,
  barangId: number
) {
  return `${outletId}:${barangId}`;
}

function addToMap(
  map: NumericMap,
  key: string,
  value: number
) {
  map.set(
    key,
    numberValue(map.get(key)) +
      numberValue(value)
  );
}

// =====================================================
// COST PERCENT
//
// COST % bukan averageCost.
//
// Formula:
//
// Nilai Pemakaian
// ------------------------------- x 100
// Nilai Stock Awal + Nilai Masuk
//
// =====================================================

function calculateCostPercent(
  openingValue: number,
  incomingValue: number,
  usageValue: number
) {
  const denominator =
    numberValue(openingValue) +
    numberValue(incomingValue);

  if (denominator <= 0) {
    return 0;
  }

  return (
    (numberValue(usageValue) /
      denominator) *
    100
  );
}

// =====================================================
// GET APPROVED STOCK OPNAME
//
// KONTRAK STOCK AWAL:
//
// Periode Oktober 2026
// -> ambil Stock Opname APPROVED September 2026
//
// Jika terdapat beberapa Stock Opname APPROVED:
//
// -> tanggal terbaru
// -> jika tanggal sama, id terbesar
//
// physicalQty menjadi Stock Awal.
//
// Tidak menggunakan:
// - current OutletStock
// - stockOpname generic
// - opening dari saldo live
//
// =====================================================

async function getApprovedOpeningMap(
  outletIds: number[],
  previousStart: Date,
  previousEnd: Date
) {
  if (!outletIds.length) {
    return new Map<string, OpeningData>();
  }

  const opnames =
    await prisma.stockOpname.findMany({
      where: {
        outletId: {
          in: outletIds,
        },

        status: "APPROVED",

        date: {
          gte: previousStart,
          lt: previousEnd,
        },
      },

      orderBy: [
        {
          date: "desc",
        },
        {
          id: "desc",
        },
      ],

      select: {
        id: true,
        code: true,
        date: true,
        outletId: true,

        items: {
          select: {
            barangId: true,
            physicalQty: true,
          },
        },
      },
    });

  const map =
    new Map<string, OpeningData>();

  for (const opname of opnames) {
    if (!opname.outletId) {
      continue;
    }

    for (const item of opname.items) {
      const key = makeKey(
        opname.outletId,
        item.barangId
      );

      /*
       * Karena query sudah:
       *
       * date DESC
       * id DESC
       *
       * maka data pertama yang masuk
       * adalah Stock Opname APPROVED
       * paling akhir.
       */
      if (map.has(key)) {
        continue;
      }

      map.set(key, {
        qty: numberValue(
          item.physicalQty
        ),

        opnameId: opname.id,

        opnameCode:
          opname.code,

        opnameDate:
          opname.date,
      });
    }
  }

  return map;
}

// =====================================================
// GET OUTLET RECEIPT / BARANG MASUK
//
// IMPORTANT:
//
// OutletReceipt adalah sumber barang yang
// benar-benar sudah diterima outlet.
//
// Delivery Order TIDAK langsung dihitung sebagai
// barang masuk karena RELEASED/DELIVERED belum tentu
// berarti transaksi penerimaan sudah tercatat.
//
// Ini mencegah:
//
// Delivery + Receipt
//
// dihitung dua kali.
// =====================================================

async function getIncomingReceiptMap(
  outletId: number | null,
  start: Date,
  end: Date
) {
  const receiptWhere: any = {
    receipt: {
      receiptDate: {
        gte: start,
        lt: end,
      },
    },
  };

  if (outletId !== null) {
    receiptWhere.receipt.outletId =
      outletId;
  }

  const receiptItems =
    await prisma.outletReceiptItem.findMany({
      where: receiptWhere,

      select: {
        barangId: true,
        qty: true,

        receipt: {
          select: {
            outletId: true,
            receiptDate: true,
          },
        },
      },
    });

  const incomingMap =
    new Map<string, number>();

  for (const item of receiptItems) {
    if (!item.receipt.outletId) {
      continue;
    }

    const key = makeKey(
      item.receipt.outletId,
      item.barangId
    );

    addToMap(
      incomingMap,
      key,
      numberValue(item.qty)
    );
  }

  return incomingMap;
}

// =====================================================
// GET TRANSFER MASUK
//
// Hanya receivedQty yang dianggap benar-benar
// masuk ke outlet.
//
// Status yang dipakai:
// - RECEIVED
// - PARTIAL
//
// =====================================================

async function getIncomingTransferMap(
  outletId: number | null,
  start: Date,
  end: Date
) {
  const transferWhere: any = {
    transferDate: {
      gte: start,
      lt: end,
    },

    status: {
      in: [
        "RECEIVED",
        "PARTIAL",
      ],
    },
  };

  if (outletId !== null) {
    transferWhere.outletId =
      outletId;
  }

  const transfers =
    await prisma.outletTransfer.findMany({
      where: transferWhere,

      select: {
        outletId: true,

        items: {
          select: {
            barangId: true,
            receivedQty: true,
          },
        },
      },
    });

  const incomingMap =
    new Map<string, number>();

  for (const transfer of transfers) {
    if (!transfer.outletId) {
      continue;
    }

    for (const item of transfer.items) {
      const key = makeKey(
        transfer.outletId,
        item.barangId
      );

      addToMap(
        incomingMap,
        key,
        numberValue(
          item.receivedQty
        )
      );
    }
  }

  return incomingMap;
}

// =====================================================
// MERGE INCOMING MAP
// =====================================================

function mergeIncomingMaps(
  first: NumericMap,
  second: NumericMap
) {
  const result =
    new Map<string, number>();

  for (const [
    key,
    value,
  ] of first.entries()) {
    addToMap(
      result,
      key,
      value
    );
  }

  for (const [
    key,
    value,
  ] of second.entries()) {
    addToMap(
      result,
      key,
      value
    );
  }

  return result;
}

// =====================================================
// GET PEMAKAIAN
//
// OutletStockOut APPROVED adalah sumber langsung
// pemakaian.
//
// netQty dipakai sebagai pemakaian bersih.
//
// totalCost dipakai sebagai nilai pemakaian jika
// tersedia.
// =====================================================

async function getUsageMaps(
  outletId: number | null,
  start: Date,
  end: Date
) {
  const stockOutWhere: any = {
    status: "APPROVED",

    trxDate: {
      gte: start,
      lt: end,
    },
  };

  if (outletId !== null) {
    stockOutWhere.outletId =
      outletId;
  }

  const stockOuts =
    await prisma.outletStockOut.findMany({
      where: stockOutWhere,

      select: {
        outletId: true,
        barangId: true,
        qtyProcessed: true,
        wasteQty: true,
        netQty: true,
        unitCost: true,
        totalCost: true,
      },
    });

  const usageMap =
    new Map<string, number>();

  const usageValueMap =
    new Map<string, number>();

  for (const item of stockOuts) {
    if (!item.outletId) {
      continue;
    }

    const key = makeKey(
      item.outletId,
      item.barangId
    );

    const qty =
      numberValue(
        item.netQty
      );

    const totalCost =
      numberValue(
        item.totalCost
      );

    addToMap(
      usageMap,
      key,
      qty
    );

    addToMap(
      usageValueMap,
      key,
      totalCost
    );
  }

  return {
    usageMap,
    usageValueMap,
  };
}

// =====================================================
// GET OUTLET STOCK
//
// ADMIN
// -> semua outlet
// -> optional filter outlet
//
// OUTLET_ADMIN
// -> hanya outlet sendiri
//
// QUERY:
//
// ?outletId=1
// ?period=2026-10
//
// =====================================================

export async function GET(
  req: NextRequest
) {
  try {
    // ===================================================
    // 1. SESSION
    // ===================================================

    const user =
      await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    if (!user.active) {
      return forbidden(
        "User tidak aktif"
      );
    }

    // ===================================================
    // 2. ROLE
    // ===================================================

    if (
      !isAdmin(user) &&
      !isOutletAdmin(user)
    ) {
      return forbidden(
        "Anda tidak memiliki akses stock outlet"
      );
    }

    // ===================================================
    // 3. QUERY
    // ===================================================

    const {
      searchParams,
    } = new URL(req.url);

    const outletIdParam =
      searchParams.get(
        "outletId"
      );

    const periodParam =
      searchParams.get(
        "period"
      );

    const period =
      getPeriodRange(
        periodParam
      );

    let outletId:
      | number
      | null = null;

    // ===================================================
    // 4. ADMIN
    // ===================================================

    if (isAdmin(user)) {
      if (
        outletIdParam !== null
      ) {
        if (
          !validId(
            outletIdParam
          )
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Outlet ID tidak valid",
            },
            {
              status: 400,
            }
          );
        }

        outletId =
          Number(
            outletIdParam
          );
      }
    }

    // ===================================================
    // 5. OUTLET ADMIN
    //
    // WAJIB menggunakan outlet dari session.
    // Request outletId tidak boleh override.
    // ===================================================

    if (isOutletAdmin(user)) {
      if (
        !user.outletId ||
        !validId(user.outletId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum terhubung dengan outlet",
          },
          {
            status: 400,
          }
        );
      }

      outletId =
        Number(
          user.outletId
        );
    }

    // ===================================================
    // 6. VALIDASI OUTLET
    // ===================================================

    if (outletId !== null) {
      const outlet =
        await prisma.outlet.findUnique({
          where: {
            id: outletId,
          },

          select: {
            id: true,
            code: true,
            name: true,
            active: true,
          },
        });

      if (!outlet) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }

      if (!outlet.active) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet tidak aktif",
          },
          {
            status: 400,
          }
        );
      }
    }

    // ===================================================
    // 7. STOCK WHERE
    // ===================================================

    const stockWhere: {
      outletId?: number;
    } = {};

    if (
      outletId !== null
    ) {
      stockWhere.outletId =
        outletId;
    }

    // ===================================================
    // 8. CURRENT OUTLET STOCK
    //
    // Catatan penting:
    //
    // OutletStock.stock adalah saldo LIVE.
    //
    // Karena itu:
    //
    // - periode berjalan:
    //   boleh dipakai sebagai ending stock.
    //
    // - periode lampau:
    //   TIDAK dipakai langsung.
    //
    // Untuk periode lampau, closing dihitung dari:
    //
    // Stock Awal
    // + Barang Masuk
    // - Pemakaian
    //
    // ===================================================

    const data =
      await prisma.outletStock.findMany({
        where: stockWhere,

        select: {
          id: true,
          outletId: true,
          barangId: true,
          stock: true,
          averageCost: true,
          minimumStock: true,
          updatedAt: true,

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
          },

          barang: {
            select: {
              id: true,
              code: true,
              barcode: true,
              name: true,
              category: true,
              unit: true,
              baseUnit: true,
              conversionRate: true,
              purchasePrice: true,
              sellingPrice: true,
              minimumStock: true,
              source: true,
              active: true,
            },
          },
        },

        orderBy: [
          {
            outletId: "asc",
          },

          {
            barangId: "asc",
          },
        ],
      });

    // ===================================================
    // 9. OUTLET IDS
    // ===================================================

    const outletIds =
      Array.from(
        new Set(
          data.map(
            (item) =>
              item.outletId
          )
        )
      );

    // ===================================================
    // 10. STOCK OPNAME APPROVED
    //
    // Previous month -> opening current period.
    // ===================================================

    const openingMap =
      await getApprovedOpeningMap(
        outletIds,
        period.previousStart,
        period.previousEnd
      );

    // ===================================================
    // 11. BARANG MASUK
    //
    // SOURCE:
    //
    // 1. OutletReceipt
    // 2. Transfer received
    //
    // Delivery TIDAK dihitung langsung.
    //
    // Alasannya:
    //
    // Delivery RELEASED/DELIVERED merupakan
    // dokumen pengiriman, sedangkan OutletReceipt
    // adalah bukti penerimaan barang.
    //
    // Menghitung keduanya dapat menyebabkan:
    //
    // 10 qty Delivery
    // +
    // 10 qty Receipt
    // =
    // 20 qty masuk
    //
    // padahal fisiknya hanya 10.
    // ===================================================

    const receiptIncomingMap =
      await getIncomingReceiptMap(
        outletId,
        period.start,
        period.end
      );

    const transferIncomingMap =
      await getIncomingTransferMap(
        outletId,
        period.start,
        period.end
      );

    const incomingMap =
      mergeIncomingMaps(
        receiptIncomingMap,
        transferIncomingMap
      );

    // ===================================================
    // 12. PEMAKAIAN
    // ===================================================

    const {
      usageMap,
      usageValueMap,
    } =
      await getUsageMaps(
        outletId,
        period.start,
        period.end
      );

    // ===================================================
    // 13. BUILD REPORT
    // ===================================================

    const reportData =
      data.map((item) => {
        const key =
          makeKey(
            item.outletId,
            item.barangId
          );

        const liveStock =
          numberValue(
            item.stock
          );

        const averageCost =
          numberValue(
            item.averageCost
          );

        const openingData =
          openingMap.get(
            key
          );

        // =================================================
        // STOCK AWAL
        //
        // HANYA:
        //
        // APPROVED STOCK OPNAME
        // BULAN SEBELUMNYA
        //
        // Tidak menggunakan:
        // - current stock
        // - stock opname bulan berjalan
        // - stock live
        // =================================================

        const stockAwal =
          openingData
            ? numberValue(
                openingData.qty
              )
            : 0;

        // =================================================
        // BARANG MASUK
        // =================================================

        const barangMasuk =
          numberValue(
            incomingMap.get(
              key
            )
          );

        // =================================================
        // PEMAKAIAN
        //
        // Prioritas:
        //
        // OutletStockOut APPROVED
        //
        // Jika tidak ada transaksi:
        // 0
        //
        // Tidak lagi menggunakan:
        //
        // opening + incoming - stock
        //
        // sebagai pemakaian utama.
        //
        // Dengan begitu angka pemakaian tidak
        // diam-diam berubah hanya karena ada
        // adjustment / transaksi lain.
        // =================================================

        const pemakaian =
          numberValue(
            usageMap.get(
              key
            )
          );

        // =================================================
        // STOCK BERJALAN / STOCK AKHIR
        //
        // PERIODE BERJALAN:
        //
        // OutletStock.stock
        //
        // PERIODE HISTORIS:
        //
        // Stock Awal
        // + Barang Masuk
        // - Pemakaian
        //
        // Ini jauh lebih benar daripada membaca
        // OutletStock.stock yang sudah berubah
        // karena transaksi bulan-bulan berikutnya.
        // =================================================

        let stockBerjalan =
          0;

        let closingSource =
          "PERIOD_MOVEMENT_CALCULATION";

        if (
          period.isCurrentPeriod
        ) {
          stockBerjalan =
            liveStock;

          closingSource =
            "LIVE_OUTLET_STOCK";
        } else {
          stockBerjalan =
            stockAwal +
            barangMasuk -
            pemakaian;

          /*
           * Stock tidak boleh negatif pada
           * laporan fisik.
           *
           * Jika transaksi menghasilkan angka
           * negatif, berarti data transaksi / opening
           * belum lengkap.
           */
          stockBerjalan =
            Math.max(
              0,
              stockBerjalan
            );
        }

        // =================================================
        // NILAI STOCK
        // =================================================

        const nilaiStock =
          stockBerjalan *
          averageCost;

        // =================================================
        // NILAI STOCK AWAL
        // =================================================

        const nilaiOpening =
          stockAwal *
          averageCost;

        // =================================================
        // NILAI BARANG MASUK
        // =================================================

        const nilaiBarangMasuk =
          barangMasuk *
          averageCost;

        // =================================================
        // NILAI PEMAKAIAN
        //
        // Prioritas:
        // totalCost OutletStockOut
        //
        // Jika tidak tersedia:
        // qty x averageCost
        // =================================================

        const recordedUsageValue =
          numberValue(
            usageValueMap.get(
              key
            )
          );

        const nilaiPemakaian =
          recordedUsageValue > 0
            ? recordedUsageValue
            : pemakaian *
              averageCost;

        // =================================================
        // COST %
        // =================================================

        const costPercent =
          calculateCostPercent(
            nilaiOpening,
            nilaiBarangMasuk,
            nilaiPemakaian
          );

        // =================================================
        // MINIMUM STOCK
        // =================================================

        const outletMinimum =
          numberValue(
            item.minimumStock
          );

        const barangMinimum =
          numberValue(
            item.barang.minimumStock
          );

        const minimumStock =
          outletMinimum > 0
            ? outletMinimum
            : barangMinimum;

        // =================================================
        // STATUS
        // =================================================

        let status =
          "AMAN";

        if (
          stockBerjalan <= 0
        ) {
          status =
            "HABIS";
        } else if (
          minimumStock > 0 &&
          stockBerjalan <=
            minimumStock
        ) {
          status =
            "MINIMUM";
        }

        // =================================================
        // DATA QUALITY
        // =================================================

        const hasOpening =
          Boolean(
            openingData
          );

        const hasUsage =
          pemakaian > 0;

        const hasIncoming =
          barangMasuk > 0;

        return {
          id:
            item.id,

          outletId:
            item.outletId,

          barangId:
            item.barangId,

          outlet:
            item.outlet,

          barang:
            item.barang,

          period:
            period.period,

          // =================================================
          // STOCK
          // =================================================

          stockAwal:
            stockAwal,

          openingStock:
            stockAwal,

          barangMasuk:
            barangMasuk,

          stockBerjalan:
            stockBerjalan,

          stock:
            stockBerjalan,

          pemakaian:
            pemakaian,

          // =================================================
          // VALUE
          // =================================================

          harga:
            averageCost,

          averageCost:
            averageCost,

          nilaiStock:
            nilaiStock,

          nilaiOpening:
            nilaiOpening,

          nilaiBarangMasuk:
            nilaiBarangMasuk,

          nilaiPemakaian:
            nilaiPemakaian,

          // =================================================
          // COST %
          // =================================================

          costPercent:
            costPercent,

          costPercentage:
            costPercent,

          costPct:
            costPercent,

          // =================================================
          // OPENING SOURCE
          // =================================================

          openingSource:
            openingData
              ? "APPROVED_STOCK_OPNAME_PREVIOUS_MONTH"
              : "NO_APPROVED_STOCK_OPNAME",

          openingOpname:
            openingData
              ? {
                  id:
                    openingData.opnameId,

                  code:
                    openingData.opnameCode,

                  date:
                    openingData.opnameDate,
                }
              : null,

          // =================================================
          // CLOSING SOURCE
          // =================================================

          closingSource,

          // =================================================
          // PERIOD MODE
          // =================================================

          calculationMode:
            period.isCurrentPeriod
              ? "CURRENT_PERIOD"
              : "HISTORICAL_PERIOD",

          // =================================================
          // DATA QUALITY
          // =================================================

          dataQuality: {
            hasOpening,
            hasIncoming,
            hasUsage,

            warning:
              !hasOpening &&
              !period.isCurrentPeriod
                ? "Stock Opname APPROVED bulan sebelumnya belum ditemukan."
                : null,
          },

          // =================================================
          // MASTER / STOCK
          // =================================================

          minimumStock,

          status,

          updatedAt:
            item.updatedAt,
        };
      });

    // ===================================================
    // 14. SUMMARY
    // ===================================================

    const summary =
      reportData.reduce(
        (acc, item) => {
          acc.totalItems += 1;

          acc.stockAwal +=
            numberValue(
              item.stockAwal
            );

          acc.barangMasuk +=
            numberValue(
              item.barangMasuk
            );

          acc.stockBerjalan +=
            numberValue(
              item.stockBerjalan
            );

          acc.pemakaian +=
            numberValue(
              item.pemakaian
            );

          acc.nilaiStock +=
            numberValue(
              item.nilaiStock
            );

          acc.nilaiOpening +=
            numberValue(
              item.nilaiOpening
            );

          acc.nilaiBarangMasuk +=
            numberValue(
              item.nilaiBarangMasuk
            );

          acc.nilaiPemakaian +=
            numberValue(
              item.nilaiPemakaian
            );

          if (
            item.status ===
            "HABIS"
          ) {
            acc.habis += 1;
          }

          if (
            item.status ===
            "MINIMUM"
          ) {
            acc.minimum += 1;
          }

          return acc;
        },
        {
          totalItems: 0,

          stockAwal: 0,
          barangMasuk: 0,
          stockBerjalan: 0,
          pemakaian: 0,

          nilaiStock: 0,
          nilaiOpening: 0,
          nilaiBarangMasuk: 0,
          nilaiPemakaian: 0,

          habis: 0,
          minimum: 0,
        }
      );

    // ===================================================
    // 15. RESPONSE
    // ===================================================

    return NextResponse.json({
      success: true,

      scope: {
        role:
          user.role,

        outletId:
          outletId,

        isAllOutlets:
          outletId === null,
      },

      period: {
        value:
          period.period,

        year:
          period.year,

        month:
          period.month,

        start:
          period.start,

        end:
          period.end,

        previousPeriod:
          `${period.previousStart.getFullYear()}-${String(
            period.previousStart.getMonth() + 1
          ).padStart(2, "0")}`,

        isCurrentPeriod:
          period.isCurrentPeriod,
      },

      calculationRule: {
        stockAwal:
          "APPROVED_STOCK_OPNAME_PREVIOUS_MONTH",

        barangMasuk:
          "OUTLET_RECEIPT + RECEIVED/PARTIAL TRANSFER",

        pemakaian:
          "APPROVED_OUTLET_STOCK_OUT",

        currentPeriodStock:
          "LIVE_OUTLET_STOCK",

        historicalPeriodStock:
          "STOCK_AWAL + BARANG_MASUK - PEMAKAIAN",

        costPercent:
          "NILAI_PEMAKAIAN / (NILAI_STOCK_AWAL + NILAI_BARANG_MASUK) * 100",

        deliveryOrder:
          "NOT_COUNTED_DIRECTLY_TO_PREVENT_DOUBLE_COUNTING_WITH_OUTLET_RECEIPT",
      },

      openingRule: {
        source:
          "APPROVED_STOCK_OPNAME_PREVIOUS_MONTH",

        description:
          "Stock Awal periode diambil dari physicalQty Stock Opname APPROVED pada bulan sebelumnya. Jika belum ada Stock Opname APPROVED, openingStock dikembalikan 0.",
      },

      closingRule: {
        currentPeriod:
          "OutletStock.stock",

        historicalPeriod:
          "Stock Awal + Barang Masuk - Pemakaian",

        description:
          "OutletStock.stock adalah saldo live sehingga hanya digunakan untuk periode berjalan. Periode historis dihitung dari transaksi periode agar tidak membaca saldo masa kini.",
      },

      incomingRule: {
        receipt:
          "OutletReceipt dianggap sebagai barang yang benar-benar diterima.",

        transfer:
          "OutletTransfer hanya menggunakan receivedQty.",

        delivery:
          "Delivery Order tidak dihitung langsung sebagai barang masuk karena dapat sudah memiliki OutletReceipt.",
      },

      summary,

      user: {
        id:
          user.id,

        fullname:
          user.fullname,

        role:
          user.role,

        outletId:
          user.outletId,
      },

      data:
        reportData,
    });
  } catch (error: any) {
    console.error(
      "GET STOCK OUTLET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal mengambil stock outlet",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// POST STOCK AWAL OUTLET
//
// Membuat OutletStock.
//
// Jika sudah ada:
// -> tidak overwrite
// -> tidak menambah
// -> 409
//
// Tidak mengubah:
// Barang.stock
// Barang.purchasePrice
// =====================================================

export async function POST(
  req: NextRequest
) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    if (!user.active) {
      return forbidden(
        "User tidak aktif"
      );
    }

    if (
      !isAdmin(user) &&
      !isOutletAdmin(user)
    ) {
      return forbidden(
        "Anda tidak memiliki akses stock outlet"
      );
    }

    let body: any;

    try {
      body =
        await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Body request tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const {
      outletId:
        requestedOutletId,
      barangId,
      qty,
      averageCost,
      minimumStock,
    } = body;

    let outletId: number;

    // ===================================================
    // OUTLET ADMIN
    // ===================================================

    if (isOutletAdmin(user)) {
      if (
        !user.outletId ||
        !validId(
          user.outletId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum terhubung dengan outlet",
          },
          {
            status: 400,
          }
        );
      }

      outletId =
        Number(
          user.outletId
        );
    } else {
      // =================================================
      // ADMIN
      // =================================================

      if (
        !validId(
          requestedOutletId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet wajib dipilih",
          },
          {
            status: 400,
          }
        );
      }

      outletId =
        Number(
          requestedOutletId
        );
    }

    // ===================================================
    // VALIDASI BARANG
    // ===================================================

    if (!validId(barangId)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    const barangIdNumber =
      Number(barangId);

    if (!validNumber(qty)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Qty stock awal tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const jumlah =
      Number(qty);

    if (
      !validNumber(
        averageCost ?? 0
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Harga modal tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const harga =
      Number(
        averageCost ?? 0
      );

    if (
      !validNumber(
        minimumStock ?? 0
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Minimum stock tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const minimum =
      Number(
        minimumStock ?? 0
      );

    // ===================================================
    // OUTLET
    // ===================================================

    const outlet =
      await prisma.outlet.findUnique({
        where: {
          id: outletId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },
      });

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (!outlet.active) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak aktif",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // MASTER BARANG PUSAT
    // ===================================================

    const barang =
      await prisma.barang.findFirst({
        where: {
          id:
            barangIdNumber,

          source:
            "CENTRAL",

          active:
            true,
        },

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
          minimumStock: true,
          source: true,
        },
      });

    if (!barang) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang tidak ditemukan di Master Barang Pusat",
        },
        {
          status: 404,
        }
      );
    }

    // ===================================================
    // TRANSACTION
    // ===================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          let outletBarang =
            await tx.outletBarang.findUnique({
              where: {
                outletId_barangId: {
                  outletId,
                  barangId:
                    barangIdNumber,
                },
              },

              select: {
                id: true,
                outletId: true,
                barangId: true,
                aktif: true,
                harga: true,
              },
            });

          // =================================================
          // AUTO CREATE MASTER BARANG OUTLET
          // =================================================

          if (!outletBarang) {
            outletBarang =
              await tx.outletBarang.create({
                data: {
                  outletId,

                  barangId:
                    barangIdNumber,

                  harga:
                    Number(
                      barang.sellingPrice ??
                        0
                    ),

                  aktif:
                    true,
                },

                select: {
                  id: true,
                  outletId: true,
                  barangId: true,
                  aktif: true,
                  harga: true,
                },
              });
          }

          if (!outletBarang.aktif) {
            return {
              action:
                "INACTIVE" as const,

              data:
                outletBarang,
            };
          }

          // =================================================
          // CHECK EXISTING STOCK
          // =================================================

          const existing =
            await tx.outletStock.findUnique({
              where: {
                outletId_barangId: {
                  outletId,
                  barangId:
                    barangIdNumber,
                },
              },
            });

          if (existing) {
            return {
              action:
                "EXISTS" as const,

              data:
                existing,
            };
          }

          // =================================================
          // CREATE
          // =================================================

          const created =
            await tx.outletStock.create({
              data: {
                outletId,

                barangId:
                  barangIdNumber,

                stock:
                  jumlah,

                minimumStock:
                  minimum > 0
                    ? minimum
                    : Number(
                        barang.minimumStock ??
                          0
                      ),

                averageCost:
                  harga,
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

                barang: {
                  select: {
                    id: true,
                    code: true,
                    barcode: true,
                    name: true,
                    category: true,
                    unit: true,
                    baseUnit: true,
                    conversionRate: true,
                    purchasePrice: true,
                    sellingPrice: true,
                    minimumStock: true,
                    source: true,
                  },
                },
              },
            });

          return {
            action:
              "CREATE" as const,

            data:
              created,
          };
        }
      );

    // ===================================================
    // INACTIVE
    // ===================================================

    if (
      result.action ===
      "INACTIVE"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Barang outlet sedang tidak aktif",

          data:
            result.data,
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // EXISTS
    // ===================================================

    if (
      result.action ===
      "EXISTS"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Stock barang untuk outlet tersebut sudah tersedia. Gunakan PUT untuk mengedit stock.",

          data:
            result.data,
        },
        {
          status: 409,
        }
      );
    }

    // ===================================================
    // SUCCESS
    // ===================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Stock awal outlet berhasil dibuat",

        data:
          result.data,
      },
      {
        status: 201,
      }
    );
  } catch (error: any) {
    console.error(
      "POST STOCK AWAL OUTLET ERROR:",
      error
    );

    if (
      error?.code ===
      "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock barang untuk outlet tersebut sudah tersedia. Gunakan PUT untuk mengedit.",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal menyimpan stock awal outlet",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// PUT STOCK AWAL OUTLET
// =====================================================

export async function PUT(
  req: NextRequest
) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    if (!user.active) {
      return forbidden(
        "User tidak aktif"
      );
    }

    if (
      !isAdmin(user) &&
      !isOutletAdmin(user)
    ) {
      return forbidden(
        "Anda tidak memiliki akses stock outlet"
      );
    }

    let body: any;

    try {
      body =
        await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Body request tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const {
      id,
      outletId:
        requestedOutletId,
      barangId,
      qty,
      averageCost,
      minimumStock,
    } = body;

    if (!validId(id)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock ID tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const stockId =
      Number(id);

    let outletId: number;

    // ===================================================
    // OUTLET ADMIN
    // ===================================================

    if (isOutletAdmin(user)) {
      if (
        !user.outletId ||
        !validId(
          user.outletId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum terhubung dengan outlet",
          },
          {
            status: 400,
          }
        );
      }

      outletId =
        Number(
          user.outletId
        );
    } else {
      // =================================================
      // ADMIN
      // =================================================

      if (
        !validId(
          requestedOutletId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet wajib dipilih",
          },
          {
            status: 400,
          }
        );
      }

      outletId =
        Number(
          requestedOutletId
        );
    }

    // ===================================================
    // BARANG
    // ===================================================

    if (!validId(barangId)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    const barangIdNumber =
      Number(barangId);

    if (!validNumber(qty)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Qty stock tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const jumlah =
      Number(qty);

    if (
      !validNumber(
        averageCost ?? 0
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Harga modal tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const harga =
      Number(
        averageCost ?? 0
      );

    if (
      !validNumber(
        minimumStock ?? 0
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Minimum stock tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const minimum =
      Number(
        minimumStock ?? 0
      );

    // ===================================================
    // OUTLET
    // ===================================================

    const outlet =
      await prisma.outlet.findUnique({
        where: {
          id: outletId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },
      });

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (!outlet.active) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak aktif",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // MASTER BARANG
    // ===================================================

    const barang =
      await prisma.barang.findFirst({
        where: {
          id:
            barangIdNumber,

          source:
            "CENTRAL",

          active:
            true,
        },

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
          minimumStock: true,
          source: true,
        },
      });

    if (!barang) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang tidak ditemukan di Master Barang Pusat",
        },
        {
          status: 404,
        }
      );
    }

    // ===================================================
    // MASTER BARANG OUTLET
    // ===================================================

    const outletBarang =
      await prisma.outletBarang.findUnique({
        where: {
          outletId_barangId: {
            outletId,
            barangId:
              barangIdNumber,
          },
        },

        select: {
          id: true,
          outletId: true,
          barangId: true,
          aktif: true,
          harga: true,
        },
      });

    if (!outletBarang) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang belum terdaftar di Master Barang Outlet",
        },
        {
          status: 400,
        }
      );
    }

    if (!outletBarang.aktif) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang outlet sedang tidak aktif",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // EXISTING STOCK
    // ===================================================

    const existing =
      await prisma.outletStock.findFirst({
        where: {
          id:
            stockId,

          outletId,

          barangId:
            barangIdNumber,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data stock outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // ===================================================
    // UPDATE
    // ===================================================

    const updated =
      await prisma.outletStock.update({
        where: {
          id:
            existing.id,
        },

        data: {
          stock:
            jumlah,

          averageCost:
            harga,

          minimumStock:
            minimum > 0
              ? minimum
              : Number(
                  barang.minimumStock ??
                    0
                ),
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

          barang: {
            select: {
              id: true,
              code: true,
              barcode: true,
              name: true,
              category: true,
              unit: true,
              baseUnit: true,
              conversionRate: true,
              purchasePrice: true,
              sellingPrice: true,
              minimumStock: true,
              source: true,
            },
          },
        },
      });

    return NextResponse.json(
      {
        success: true,

        message:
          "Stock awal outlet berhasil diperbarui",

        data:
          updated,
      },
      {
        status: 200,
      }
    );
  } catch (error: any) {
    console.error(
      "PUT STOCK AWAL OUTLET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal memperbarui stock awal outlet",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// DELETE STOCK AWAL OUTLET
//
// ADMIN
// -> semua outlet
//
// OUTLET_ADMIN
// -> outlet sendiri
//
// Tidak mengubah Barang.stock.
// =====================================================

export async function DELETE(
  req: NextRequest
) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    if (!user.active) {
      return forbidden(
        "User tidak aktif"
      );
    }

    if (
      !isAdmin(user) &&
      !isOutletAdmin(user)
    ) {
      return forbidden(
        "Anda tidak memiliki akses stock outlet"
      );
    }

    const {
      searchParams,
    } = new URL(req.url);

    const idParam =
      searchParams.get(
        "id"
      );

    if (!validId(idParam)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock ID tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const stockId =
      Number(idParam);

    // ===================================================
    // EXISTING
    // ===================================================

    const existing =
      await prisma.outletStock.findUnique({
        where: {
          id:
            stockId,
        },

        select: {
          id: true,
          outletId: true,
          barangId: true,
          stock: true,

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
          },

          barang: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data stock outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // ===================================================
    // OUTLET ADMIN SECURITY
    // ===================================================

    if (isOutletAdmin(user)) {
      if (
        !user.outletId ||
        !validId(
          user.outletId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum terhubung dengan outlet",
          },
          {
            status: 400,
          }
        );
      }

      if (
        existing.outletId !==
        Number(
          user.outletId
        )
      ) {
        return forbidden(
          "Anda hanya dapat menghapus stock outlet sendiri"
        );
      }
    }

    // ===================================================
    // DELETE
    // ===================================================

    await prisma.outletStock.delete({
      where: {
        id:
          existing.id,
      },
    });

    return NextResponse.json(
      {
        success: true,

        message:
          `Stock ${existing.barang.name} di ${existing.outlet.name} berhasil dihapus`,

        data: {
          id:
            existing.id,

          outletId:
            existing.outletId,

          barangId:
            existing.barangId,
        },
      },
      {
        status: 200,
      }
    );
  } catch (error: any) {
    console.error(
      "DELETE STOCK AWAL OUTLET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal menghapus stock outlet",
      },
      {
        status: 500,
      }
    );
  }
}