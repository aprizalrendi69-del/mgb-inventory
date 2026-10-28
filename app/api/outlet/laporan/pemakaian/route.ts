import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * =========================================================
 * LAPORAN PEMAKAIAN BAHAN OUTLET
 * =========================================================
 *
 * Read-only:
 * - Tidak mengubah OutletStock.
 * - Tidak mengubah StockOpname.
 * - Tidak membuat atau mengubah transaksi.
 *
 * Perhitungan:
 * Stok awal + seluruh barang masuk - stok akhir
 * = estimasi seluruh barang keluar.
 *
 * Estimasi pemakaian bersih:
 * Estimasi seluruh barang keluar - waste - pengeluaran lain.
 *
 * Catatan:
 * - POS dan Manufacture tidak diperlukan untuk laporan ini.
 * - Perhitungan menggunakan Stock Opname bulanan APPROVED.
 * - Bulan berjalan boleh memakai stok sistem sebagai stok akhir
 *   sementara jika Stock Opname akhir bulan belum tersedia.
 * - Saldo OutletStock dan Stock Opname diasumsikan menggunakan baseUnit.
 * - Penerimaan PO dan Delivery dikonversi ke baseUnit tepat satu kali.
 * - Transfer receivedQty, waste, adjustment, dan saldo sistem harus sudah
 *   berada dalam baseUnit sesuai kontrak jalur stok masing-masing.
 * - StockMutation tidak dijumlahkan di samping dokumen sumber agar tidak
 *   menghitung penerimaan/transfer/waste yang sama dua kali.
 * =========================================================
 */

type UserSession = {
  id: number;
  fullname: string | null;
  role: string;
  active: boolean;
  outletId: number | null;
};

type BarangUnit = {
  unit: string;
  baseUnit: string | null;
  conversionRate: number;
};

const allowedRoles = ["ADMIN", "MANAGER", "OUTLET_ADMIN"];

function fail(message: string, status = 400) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

function toBaseQty(
  qty: number,
  barang: BarangUnit
): number {
  const quantity = Number(qty || 0);
  const rate = Number(barang.conversionRate || 1);

  if (!Number.isFinite(quantity)) return 0;

  if (
    barang.baseUnit &&
    barang.baseUnit.trim() &&
    barang.baseUnit !== barang.unit &&
    Number.isFinite(rate) &&
    rate > 0
  ) {
    return quantity * rate;
  }

  return quantity;
}

/**
 * Batas bulan kalender Asia/Jakarta.
 * Prisma menyimpan DateTime sebagai UTC, jadi awal bulan WIB
 * dikonversi ke UTC dengan mengurangi 7 jam. Jangan gunakan
 * constructor lokal server karena server bisa berjalan di UTC.
 */
function dateRange(year: number, month: number) {
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - WIB_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - WIB_OFFSET_MS),
  };
}

function getJakartaYearMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
  };
}

function addQty(
  map: Map<number, number>,
  barangId: number,
  qty: number
) {
  const value = Number(qty || 0);

  if (!Number.isFinite(value)) return;

  map.set(
    barangId,
    (map.get(barangId) ?? 0) + value
  );
}

async function getCurrentUser(): Promise<UserSession | null> {
  const cookieStore = await cookies();

  const session =
    cookieStore.get("erp-session") ??
    cookieStore.get("session");

  if (!session?.value) return null;

  // Format sesi berupa token database.
  try {
    const byToken = await prisma.user.findFirst({
      where: {
        sessions: {
          some: {
            token: session.value,
            expiresAt: { gt: new Date() },
          },
        },
      },
      select: {
        id: true,
        fullname: true,
        role: true,
        active: true,
        outletId: true,
      },
    });

    if (byToken?.active) {
      return byToken as UserSession;
    }
  } catch (error) {
    console.error(
      "GET OUTLET PEMAKAIAN SESSION TOKEN ERROR:",
      error
    );
  }

  // Format sesi JSON yang dipakai beberapa halaman outlet.
  try {
    const data = JSON.parse(session.value);

    const userId = Number(
      data?.user?.id ??
        data?.data?.user?.id ??
        data?.data?.id ??
        data?.id
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullname: true,
        role: true,
        active: true,
        outletId: true,
      },
    });

    return user?.active
      ? (user as UserSession)
      : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    // =====================================================
    // 1. AUTHENTICATION & ROLE
    // =====================================================

    const user = await getCurrentUser();

    if (!user) {
      return fail("Tidak login.", 401);
    }

    const role = String(user.role).toUpperCase();

    if (!allowedRoles.includes(role)) {
      return fail(
        "Akses laporan pemakaian bahan ditolak.",
        403
      );
    }

    if (
      role === "OUTLET_ADMIN" &&
      !user.outletId
    ) {
      return fail(
        "Akun belum terhubung ke outlet.",
        400
      );
    }

    // =====================================================
    // 2. VALIDASI PERIODE
    // =====================================================

    const params = req.nextUrl.searchParams;
    const now = new Date();
    const jakartaNow = getJakartaYearMonth(now);

    const year = Number(
      params.get("year") ?? jakartaNow.year
    );

    const month = Number(
      params.get("month") ?? jakartaNow.month
    );

    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2200 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return fail(
        "Periode bulan/tahun tidak valid.",
        400
      );
    }

    // =====================================================
    // 3. DAFTAR OUTLET SESUAI AKSES USER
    // =====================================================

    const availableOutlets =
      role === "OUTLET_ADMIN"
        ? await prisma.outlet.findMany({
            where: {
              id: Number(user.outletId),
              active: true,
            },
            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
            orderBy: { name: "asc" },
          })
        : await prisma.outlet.findMany({
            where: { active: true },
            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
            orderBy: { name: "asc" },
          });

    let outletId = Number(
      params.get("outletId") ?? 0
    );

    // OUTLET_ADMIN tidak boleh memilih outlet lain.
    if (role === "OUTLET_ADMIN") {
      outletId = Number(user.outletId);
    }

    // Admin pusat boleh membuka halaman sebelum memilih outlet.
    if (
      !Number.isInteger(outletId) ||
      outletId <= 0
    ) {
      return NextResponse.json({
        success: true,
        requiresOutletSelection: true,
        outlets: availableOutlets,
        period: { year, month },
        rows: [],
        summary: {
          itemCount: 0,
          calculatedItemCount: 0,
          pendingItemCount: 0,
          incomingQty: 0,
          wasteQty: 0,
          usageQty: 0,
          usageCost: 0,
        },
      });
    }

    const outlet = await prisma.outlet.findFirst({
      where: {
        id: outletId,
        active: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        active: true,
      },
    });

    if (!outlet) {
      return fail(
        "Outlet tidak ditemukan atau tidak aktif.",
        404
      );
    }

    // =====================================================
    // 4. PERIODE LAPORAN
    // =====================================================

    const { start, end } = dateRange(year, month);

    const isCurrentPeriod =
      year === jakartaNow.year &&
      month === jakartaNow.month;

    // =====================================================
    // 5. STOCK OPNAME AWAL
    //    Ambil Stock Opname bulanan APPROVED terakhir
    //    sebelum periode laporan.
    // =====================================================

    const previousOpname =
      await prisma.stockOpname.findFirst({
        where: {
          outletId,
          type: "MONTHLY",
          status: "APPROVED",
          date: { lt: start },
        },
        orderBy: [
          { date: "desc" },
          { id: "desc" },
        ],
        include: {
          items: {
            include: {
              barang: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  unit: true,
                  baseUnit: true,
                  conversionRate: true,
                  category: true,
                },
              },
            },
          },
        },
      });

    // =====================================================
    // 6. STOCK OPNAME AKHIR
    //    Hanya Stock Opname bulanan APPROVED dalam periode.
    // =====================================================

    const endingOpname =
      await prisma.stockOpname.findFirst({
        where: {
          outletId,
          type: "MONTHLY",
          status: "APPROVED",
          date: {
            gte: start,
            lt: end,
          },
        },
        orderBy: [
          { date: "desc" },
          { id: "desc" },
        ],
        include: {
          items: {
            include: {
              barang: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  unit: true,
                  baseUnit: true,
                  conversionRate: true,
                  category: true,
                },
              },
            },
          },
        },
      });

    // =====================================================
    // 7. MASTER BARANG OUTLET
    // =====================================================

    const master = await prisma.outletBarang.findMany({
      where: {
        outletId,
        aktif: true,
        barang: { active: true },
      },
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
            active: true,
          },
        },
      },
      orderBy: {
        barang: { name: "asc" },
      },
    });

    // =====================================================
    // 8. MAP STOCK OPNAME
    // =====================================================

    const openingMap = new Map<number, number>();
    const endingMap = new Map<number, number>();

    for (const item of previousOpname?.items ?? []) {
      openingMap.set(
        item.barangId,
        Number(item.physicalQty || 0)
      );
    }

    for (const item of endingOpname?.items ?? []) {
      endingMap.set(
        item.barangId,
        Number(item.physicalQty || 0)
      );
    }

    // =====================================================
    // 9. BARANG MASUK DARI PURCHASE RECEIPT
    //    Qty receipt dikonversi sekali ke baseUnit.
    // =====================================================

    const receipts =
      await prisma.outletReceipt.findMany({
        where: {
          outletId,
          receiptDate: {
            gte: start,
            lt: end,
          },
        },
        include: {
          items: {
            include: {
              barang: {
                select: {
                  unit: true,
                  baseUnit: true,
                  conversionRate: true,
                },
              },
            },
          },
        },
      });

    const incomingMap = new Map<number, number>();

    for (const receipt of receipts) {
      for (const item of receipt.items) {
        const qty = toBaseQty(
          Number(item.qty || 0),
          item.barang
        );

        addQty(
          incomingMap,
          item.barangId,
          qty
        );
      }
    }

    // =====================================================
    // 10. BARANG MASUK DARI TRANSFER ANTAR OUTLET
    //     receivedQty sudah menggunakan satuan stok outlet.
    //     Jangan dikonversi ulang.
    // =====================================================

    const transfersIn =
      await prisma.outletTransfer.findMany({
        where: {
          outletId,
          transferDate: {
            gte: start,
            lt: end,
          },
          sourceOutletId: { not: null },
          // Hanya transfer yang sudah diterima sebagian/seluruhnya.
          // Status SENT saja belum berarti stok sudah masuk ke outlet tujuan.
          status: { in: ["PARTIAL", "RECEIVED"] },
        },
        include: {
          items: {
            where: { voided: false },
            include: {
              barang: {
                select: {
                  unit: true,
                  baseUnit: true,
                  conversionRate: true,
                },
              },
            },
          },
        },
      });

    const transferInMap =
      new Map<number, number>();

    for (const transfer of transfersIn) {
      for (const item of transfer.items) {
        addQty(
          transferInMap,
          item.barangId,
          Number(item.receivedQty || 0)
        );
      }
    }

    // =====================================================
    // 11. BARANG MASUK DARI DELIVERY GUDANG PUSAT
    //     Hanya dokumen berstatus DELIVERED.
    // =====================================================

    const deliveries =
      await prisma.delivery.findMany({
        where: {
          outletId,
          status: "DELIVERED",
          deliveryDate: {
            gte: start,
            lt: end,
          },
        },
        include: {
          items: {
            where: { voided: false },
            include: {
              barang: {
                select: {
                  unit: true,
                  baseUnit: true,
                  conversionRate: true,
                },
              },
            },
          },
        },
      });

    const deliveryInMap =
      new Map<number, number>();

    for (const delivery of deliveries) {
      for (const item of delivery.items) {
        const qty = toBaseQty(
          Number(item.qty || 0),
          item.barang
        );

        addQty(
          deliveryInMap,
          item.barangId,
          qty
        );
      }
    }

    // =====================================================
    // 12. ADJUSTMENT STOK YANG SUDAH DISETUJUI
    // =====================================================

    const adjustments =
      await prisma.outletAdjustment.findMany({
        where: {
          outletId,
          adjustmentDate: {
            gte: start,
            lt: end,
          },
          status: {
            in: [
              "APPROVED",
              "COMPLETED",
              "RECEIVED",
            ],
          },
        },
        include: {
          items: true,
        },
      });

    const adjustmentInMap =
      new Map<number, number>();

    const adjustmentOutMap =
      new Map<number, number>();

    for (const adjustment of adjustments) {
      for (const item of adjustment.items) {
        const direction = String(
          item.type || adjustment.type || "IN"
        ).toUpperCase();

        if (
          direction === "IN" ||
          direction === "PLUS"
        ) {
          addQty(
            adjustmentInMap,
            item.barangId,
            Number(item.qty || 0)
          );
        } else {
          addQty(
            adjustmentOutMap,
            item.barangId,
            Number(item.qty || 0)
          );
        }
      }
    }

    // =====================================================
    // 13. WASTE DAN BARANG KELUAR
    //     Hanya transaksi APPROVED.
    // =====================================================

    const stockOuts =
      await prisma.outletStockOut.findMany({
        where: {
          outletId,
          trxDate: {
            gte: start,
            lt: end,
          },
          status: "APPROVED",
        },
        select: {
          barangId: true,
          type: true,
          qtyProcessed: true,
          wasteQty: true,
          netQty: true,
        },
      });

    const wasteMap = new Map<number, number>();
    const otherOutMap = new Map<number, number>();

    for (const item of stockOuts) {
      const type = String(
        item.type || ""
      ).toUpperCase();

      if (
        type === "WASTE" ||
        type === "RUSAK"
      ) {
        const qty = Number(
          item.qtyProcessed ||
            item.wasteQty ||
            0
        );

        addQty(
          wasteMap,
          item.barangId,
          qty
        );

        continue;
      }

      // Pada transaksi PEMAKAIAN, wasteQty adalah bagian
      // dari qtyProcessed yang tidak menjadi pemakaian bersih.
      const recordedWaste = Number(
        item.wasteQty || 0
      );

      if (recordedWaste > 0) {
        addQty(
          wasteMap,
          item.barangId,
          recordedWaste
        );
      }

      // Transaksi PEMAKAIAN dihitung melalui rumus stok.
      // Pengeluaran lainnya dikurangkan dari estimasi pemakaian.
      if (type !== "PEMAKAIAN") {
        addQty(
          otherOutMap,
          item.barangId,
          Number(item.qtyProcessed || 0)
        );
      }
    }

    // =====================================================
    // 14. TRANSFER KELUAR
    // =====================================================

    const transfersOut =
      await prisma.outletTransfer.findMany({
        where: {
          sourceOutletId: outletId,
          transferDate: {
            gte: start,
            lt: end,
          },
          // Transfer keluar baru dihitung jika statusnya sudah dikirim.
          status: { in: ["SENT", "PARTIAL", "RECEIVED"] },
        },
        include: {
          items: {
            where: { voided: false },
          },
        },
      });

    const transferOutMap =
      new Map<number, number>();

    for (const transfer of transfersOut) {
      for (const item of transfer.items) {
        addQty(
          transferOutMap,
          item.barangId,
          Number(item.qty || 0)
        );
      }
    }

    // =====================================================
    // 15. STOK SISTEM SAAT INI
    //     Dipakai sebagai estimasi stok akhir sementara
    //     hanya untuk bulan berjalan.
    // =====================================================

    const liveStocks =
      await prisma.outletStock.findMany({
        where: { outletId },
        select: {
          barangId: true,
          stock: true,
          averageCost: true,
        },
      });

    const liveStockMap = new Map(
      liveStocks.map((stock) => [
        stock.barangId,
        {
          stock: Number(stock.stock || 0),
          averageCost: Number(
            stock.averageCost || 0
          ),
        },
      ])
    );

    // =====================================================
    // 16. PERHITUNGAN PER BARANG
    // =====================================================

    const rows = master.map(({ barang }) => {
      const id = barang.id;

      const opening = openingMap.get(id);
      const ending = endingMap.get(id);

      const incomingPurchase =
        incomingMap.get(id) ?? 0;

      const incomingTransfer =
        transferInMap.get(id) ?? 0;

      const incomingDelivery =
        deliveryInMap.get(id) ?? 0;

      const adjustmentIn =
        adjustmentInMap.get(id) ?? 0;

      const totalIncoming =
        incomingPurchase +
        incomingTransfer +
        incomingDelivery +
        adjustmentIn;

      const waste =
        wasteMap.get(id) ?? 0;

      const otherOut =
        (otherOutMap.get(id) ?? 0) +
        (transferOutMap.get(id) ?? 0) +
        (adjustmentOutMap.get(id) ?? 0);

      const live = liveStockMap.get(id);

      // Untuk periode lampau, stok akhir wajib berasal
      // dari Stock Opname bulanan APPROVED.
      // Untuk bulan berjalan, stok sistem menjadi sementara.
      const endingValue =
        ending !== undefined
          ? ending
          : isCurrentPeriod
            ? live?.stock
            : undefined;

      const openingValue =
        opening !== undefined
          ? opening
          : undefined;

      const canCalculate =
        openingValue !== undefined &&
        endingValue !== undefined;

      // Stok awal + seluruh barang masuk - stok akhir.
      const rawOut =
        canCalculate
          ? openingValue! +
            totalIncoming -
            endingValue!
          : null;

      // Pengeluaran bersih setelah waste dan pengeluaran lain.
      const usage =
        rawOut === null
          ? null
          : rawOut - waste - otherOut;

      const unitCost = Number(
        live?.averageCost ||
          barang.purchasePrice ||
          0
      );

      const usageQty =
        usage === null
          ? null
          : Math.max(0, usage);

      const usageCost =
        usageQty === null
          ? null
          : usageQty * unitCost;

      return {
        barangId: id,
        code: barang.code,
        name: barang.name,
        category: barang.category,
        unit: barang.baseUnit || barang.unit,

        openingStock:
          openingValue ?? null,

        purchaseIncoming:
          incomingPurchase,

        transferIncoming:
          incomingTransfer,

        deliveryIncoming:
          incomingDelivery,

        adjustmentIncoming:
          adjustmentIn,

        incomingQty:
          totalIncoming,

        endingStock:
          endingValue ?? null,

        endingSource:
          ending !== undefined
            ? "STOCK_OPNAME_APPROVED"
            : isCurrentPeriod && live
              ? "STOK_SISTEM_SEMENTARA"
              : "BELUM_ADA_STOCK_OPNAME",

        wasteQty: waste,
        otherOutQty: otherOut,

        grossStockOut: rawOut,

        usageQty,
        usageCost,

        // Nilai negatif menunjukkan stok akhir dan transaksi
        // tidak seimbang terhadap rumus stok.
        discrepancyQty:
          usage !== null &&
          usage < -0.000001
            ? usage
            : 0,

        unitCost,
        canCalculate,
      };
    });

    // =====================================================
    // 17. SUMMARY
    // =====================================================

    const calculated = rows.filter(
      (row) => row.usageQty !== null
    );

    const sum = (
      key:
        | "usageQty"
        | "usageCost"
        | "wasteQty"
        | "incomingQty"
    ) =>
      rows.reduce(
        (total, row) =>
          total + Number(row[key] ?? 0),
        0
      );

    // =====================================================
    // 18. RESPONS API
    // =====================================================

    return NextResponse.json({
      success: true,

      period: {
        year,
        month,
        start: start.toISOString(),
        end: new Date(
          end.getTime() - 1
        ).toISOString(),
      },

      outlet,
      outlets: availableOutlets,

      opname: {
        opening: previousOpname
          ? {
              id: previousOpname.id,
              code: previousOpname.code,
              date: previousOpname.date,
              status: previousOpname.status,
            }
          : null,

        ending: endingOpname
          ? {
              id: endingOpname.id,
              code: endingOpname.code,
              date: endingOpname.date,
              status: endingOpname.status,
            }
          : null,

        isProvisional:
          !endingOpname && isCurrentPeriod,
      },

      summary: {
        itemCount: rows.length,
        calculatedItemCount: calculated.length,
        pendingItemCount:
          rows.length - calculated.length,

        incomingQty: sum("incomingQty"),
        wasteQty: sum("wasteQty"),
        usageQty: sum("usageQty"),
        usageCost: sum("usageCost"),
      },

      rows,
    });
  } catch (error: unknown) {
    console.error(
      "GET OUTLET PEMAKAIAN REPORT ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Gagal memuat laporan pemakaian bahan outlet.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}