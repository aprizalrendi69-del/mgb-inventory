import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * CURRENT USER
 * =========================================================
 */

async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session) return null;

  try {
    const data = JSON.parse(session.value);
    return data?.user ?? data;
  } catch {
    return null;
  }
}

/*
 * =========================================================
 * APPROVE WASTE OUTLET
 *
 * PUT /api/outlet/waste/:id/approve
 *
 * FLOW:
 *
 * Barang Keluar Outlet
 *   -> stock sudah berkurang qtyProcessed
 *
 * Waste
 *   -> PENDING
 *
 * Approve Waste
 *   -> PENDING -> APPROVED
 *   -> TIDAK mengurangi stock lagi
 *   -> TIDAK membuat StockCard lagi
 *   -> TIDAK membuat StockMutation lagi
 *
 * Waste hanya menjadi data:
 * - Waste Report
 * - Cost Control
 *
 * =========================================================
 */

export async function PUT(
  req: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    /*
     * =======================================================
     * CURRENT USER
     * =======================================================
     */

    const user: any = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login.",
        },
        { status: 401 }
      );
    }

    /*
     * =======================================================
     * ROLE ACCESS
     * =======================================================
     */

    const allowedRoles = [
      "ADMIN",
      "MANAGER",
    ];

    if (!allowedRoles.includes(String(user.role))) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses untuk approve Waste.",
        },
        { status: 403 }
      );
    }

    /*
     * =======================================================
     * USER ID
     * =======================================================
     */

    const approverId = Number(user.id);

    if (
      !Number.isInteger(approverId) ||
      approverId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "User session tidak valid.",
        },
        { status: 401 }
      );
    }

    /*
     * =======================================================
     * PARAMETER
     * =======================================================
     */

    const { id } = await context.params;

    const wasteId = Number(id);

    if (
      !Number.isInteger(wasteId) ||
      wasteId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Waste tidak valid.",
        },
        { status: 400 }
      );
    }

    /*
     * =======================================================
     * TRANSACTION
     *
     * Semua proses approval dilakukan atomic.
     * Tidak ada perubahan stock.
     * =======================================================
     */

    const result = await prisma.$transaction(
      async (tx) => {
        /*
         * ===================================================
         * AMBIL WASTE
         * ===================================================
         */

        const waste =
          await tx.outletStockOut.findUnique({
            where: {
              id: wasteId,
            },

            select: {
              id: true,
              number: true,
              outletId: true,
              barangId: true,
              userId: true,
              trxDate: true,
              type: true,
              status: true,
              qtyProcessed: true,
              wasteQty: true,
              netQty: true,
              unitCost: true,
              totalCost: true,
              note: true,
              approvedBy: true,
              approvedAt: true,
            },
          });

        if (!waste) {
          throw new Error(
            "Data Waste tidak ditemukan."
          );
        }

        /*
         * ===================================================
         * TYPE CHECK
         *
         * Route ini hanya untuk WASTE.
         * ===================================================
         */

        if (
          String(waste.type).toUpperCase() !==
          "WASTE"
        ) {
          throw new Error(
            "Data yang diproses bukan transaksi Waste."
          );
        }

        /*
         * ===================================================
         * STATUS CHECK
         * ===================================================
         */

        if (waste.status === "APPROVED") {
          throw new Error(
            "Waste sudah di-approve sebelumnya."
          );
        }

        if (waste.status === "REJECTED") {
          throw new Error(
            "Waste yang sudah ditolak tidak dapat di-approve."
          );
        }

        if (waste.status !== "PENDING") {
          throw new Error(
            `Status Waste tidak valid: ${waste.status}`
          );
        }

        /*
         * ===================================================
         * VALIDASI QTY
         * ===================================================
         */

        const wasteQty = Number(
          waste.wasteQty || 0
        );

        const qtyProcessed = Number(
          waste.qtyProcessed || 0
        );

        if (
          !Number.isFinite(qtyProcessed) ||
          qtyProcessed <= 0
        ) {
          throw new Error(
            "Qty Processed tidak valid."
          );
        }

        if (
          !Number.isFinite(wasteQty) ||
          wasteQty <= 0
        ) {
          throw new Error(
            "Waste Qty harus lebih besar dari 0."
          );
        }

        if (wasteQty > qtyProcessed) {
          throw new Error(
            "Waste Qty tidak boleh lebih besar dari Qty Processed."
          );
        }

        const approvedAt = new Date();
        const claimed = await tx.outletStockOut.updateMany({
          where: { id: waste.id, status: "PENDING" },
          data: { status: "APPROVED", approvedBy: approverId, approvedAt },
        });
        if (claimed.count !== 1) {
          throw new Error("Waste sudah diproses atau statusnya sudah berubah.");
        }

        /*
         * ===================================================
         * POST STOCK ON APPROVAL
         * ===================================================
         * Waste baru tidak mengurangi saldo ketika dibuat PENDING.
         * Untuk kompatibilitas data lama, jika StockCard dengan referenceId
         * ini sudah ada, artinya versi lama sudah memotong saldo saat create;
         * jangan potong dua kali.
         */
        const existingPostedCard = await tx.stockCard.findFirst({
          where: {
            referenceId: waste.id,
            trxNumber: waste.number,
            trxType: "OUTLET_STOCK_OUT",
          },
          select: { id: true },
        });

        if (!existingPostedCard) {
          const stock = await tx.outletStock.findUnique({
            where: {
              outletId_barangId: {
                outletId: waste.outletId,
                barangId: waste.barangId,
              },
            },
            include: {
              barang: { select: { id: true, name: true, unit: true } },
              outlet: { select: { id: true, code: true, name: true } },
            },
          });

          if (!stock) {
            throw new Error("Saldo barang outlet tidak ditemukan untuk posting Waste.");
          }

          const stockBefore = Number(stock.stock);
          const stockAfter = stockBefore - qtyProcessed;
          const unitCost = Number(stock.averageCost ?? waste.unitCost ?? 0);

          if (!Number.isFinite(stockBefore) || stockBefore < qtyProcessed - 0.000001) {
            throw new Error(
              `Stok ${stock.barang.name} tidak cukup untuk approval Waste. Tersedia ${stockBefore} ${stock.barang.unit}, diperlukan ${qtyProcessed} ${stock.barang.unit}.`
            );
          }

          const safeStockAfter = Math.abs(stockAfter) < 0.000001 ? 0 : stockAfter;

          await tx.outletStock.update({
            where: { id: stock.id },
            data: { stock: safeStockAfter },
          });

          await tx.stockMutation.create({
            data: {
              outletId: waste.outletId,
              barangId: waste.barangId,
              type: "WASTE_OUT",
              qty: qtyProcessed,
              stockBefore,
              stockAfter: safeStockAfter,
              reference: waste.number,
              description: `Waste approved ${waste.number} • ${qtyProcessed} ${stock.barang.unit}`,
            },
          });

          await tx.stockCard.create({
            data: {
              barangId: waste.barangId,
              trxDate: waste.trxDate,
              trxType: "OUTLET_STOCK_OUT",
              trxNumber: waste.number,
              referenceId: waste.id,
              warehouse: `OUTLET:${stock.outlet.code}`,
              qtyIn: 0,
              qtyOut: qtyProcessed,
              balance: safeStockAfter,
              unitPrice: unitCost,
              totalValue: qtyProcessed * unitCost,
              note: `WASTE APPROVED | ${qtyProcessed} ${stock.barang.unit}`,
            },
          });
        }

        /*
         * ===================================================
         * AMBIL DATA TERBARU
         * ===================================================
         */

        const approvedWaste =
          await tx.outletStockOut.findUnique({
            where: {
              id: waste.id,
            },

            include: {
              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },

              barang: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  category: true,
                  unit: true,
                },
              },

              user: {
                select: {
                  id: true,
                  username: true,
                  fullname: true,
                },
              },
            },
          });

        if (!approvedWaste) {
          throw new Error(
            "Waste berhasil di-approve tetapi data tidak ditemukan."
          );
        }

        return approvedWaste;
      }
    );

    /*
     * =======================================================
     * RESPONSE
     * =======================================================
     */

    const wasteQty = Number(
      result.wasteQty || 0
    );

    const unitCost = Number(
      result.unitCost || 0
    );

    const totalCost =
      Number(result.totalCost || 0) ||
      wasteQty * unitCost;

    return NextResponse.json({
      success: true,

      message:
        "Waste berhasil di-approve.",

      data: {
        id: result.id,

        number: result.number,

        status: result.status,

        trxDate: result.trxDate,

        outletId: result.outletId,

        outlet: result.outlet,

        barangId: result.barangId,

        barang: result.barang,

        type: result.type,

        qtyProcessed: Number(
          result.qtyProcessed || 0
        ),

        wasteQty,

        netQty: Number(
          result.netQty || 0
        ),

        unitCost,

        totalCost,

        note: result.note,

        approvedBy:
          result.approvedBy,

        approvedAt:
          result.approvedAt,

        user: result.user,
      },
    });
  } catch (error: any) {
    console.error(
      "OUTLET WASTE APPROVE ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    const knownErrors = [
      "Data Waste tidak ditemukan.",
      "Data yang diproses bukan transaksi Waste.",
      "Waste sudah di-approve sebelumnya.",
      "Waste yang sudah ditolak tidak dapat di-approve.",
      "Status Waste tidak valid:",
      "Qty Processed tidak valid.",
      "Waste Qty harus lebih besar dari 0.",
      "Waste Qty tidak boleh lebih besar dari Qty Processed.",
      "Waste sudah diproses atau statusnya sudah berubah.",
    ];

    const isClientError =
      knownErrors.some((item) =>
        message.startsWith(item)
      );

    return NextResponse.json(
      {
        success: false,
        message:
          message ||
          "Gagal approve Waste Outlet.",
      },
      {
        status: isClientError
          ? 400
          : 500,
      }
    );
  }
}