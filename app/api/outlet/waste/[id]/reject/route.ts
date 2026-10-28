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
 * REJECT WASTE OUTLET
 *
 * PUT /api/outlet/waste/:id/reject
 *
 * ADMIN
 * MANAGER
 * GUDANG
 * → boleh reject
 *
 * PURCHASING
 * OUTLET_ADMIN
 * → tidak boleh reject
 *
 * RULE:
 * - Hanya PENDING yang dapat di-reject
 * - APPROVED tidak dapat di-reject
 * - REJECTED tidak dapat di-reject lagi
 * - Reject TIDAK mengubah stock
 * - Reject hanya mengubah status transaksi
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
          message: "Tidak login",
        },
        { status: 401 }
      );
    }

    /*
     * =======================================================
     * ROLE CHECK
     * =======================================================
     */

    const allowedRoles = [
      "ADMIN",
      "MANAGER",
      "GUDANG",
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses untuk reject Waste.",
        },
        { status: 403 }
      );
    }

    /*
     * =======================================================
     * PARAMETER ID
     * =======================================================
     */

    const { id } = await context.params;

    const wasteId = Number(id);

    if (!Number.isInteger(wasteId) || wasteId <= 0) {
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
     * FIND WASTE
     * =======================================================
     */

    const waste =
      await prisma.outletStockOut.findUnique({
        where: {
          id: wasteId,
        },
      });

    if (!waste) {
      return NextResponse.json(
        {
          success: false,
          message: "Data Waste tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    /*
     * =======================================================
     * STATUS VALIDATION
     * =======================================================
     */

    if (waste.status === "APPROVED") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Waste yang sudah APPROVED tidak dapat ditolak.",
        },
        { status: 400 }
      );
    }

    if (waste.status === "REJECTED") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Waste sudah berstatus REJECTED.",
        },
        { status: 400 }
      );
    }

    if (waste.status !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          message:
            `Status Waste tidak valid: ${waste.status}`,
        },
        { status: 400 }
      );
    }

    /*
     * =======================================================
     * REQUEST BODY
     * =======================================================
     *
     * Body:
     * {
     *   "reason": "Alasan reject"
     * }
     *
     * Reason OPTIONAL.
     */

    let body: any = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const reason =
      typeof body?.reason === "string"
        ? body.reason.trim()
        : "";

    /*
     * Reject transaksi baru tidak mengubah stok karena Waste PENDING
     * belum diposting. Untuk transaksi legacy yang sudah memotong stok
     * ketika dibuat, StockCard lama menjadi penanda bahwa stok perlu dibalik.
     * Semua aksi dibungkus satu transaksi agar status dan saldo tetap sinkron.
     */
    const updatedNote = reason
      ? waste.note
        ? `${waste.note}\nAlasan Reject: ${reason}`
        : `Alasan Reject: ${reason}`
      : waste.note;

    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.outletStockOut.updateMany({
        where: { id: waste.id, status: "PENDING" },
        data: { status: "REJECTED", note: updatedNote },
      });
      if (claimed.count !== 1) {
        throw new Error("Waste sudah diproses atau statusnya sudah berubah.");
      }

      const legacyPostedCard = await tx.stockCard.findFirst({
        where: {
          referenceId: waste.id,
          trxNumber: waste.number,
          trxType: "OUTLET_STOCK_OUT",
        },
        select: { id: true },
      });

      if (legacyPostedCard) {
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
          throw new Error("Saldo barang outlet tidak ditemukan untuk membalik Waste legacy.");
        }

        const stockBefore = Number(stock.stock);
        const qty = Number(waste.qtyProcessed);
        const stockAfter = stockBefore + qty;
        const unitCost = Number(waste.unitCost ?? stock.averageCost ?? 0);

        if (!Number.isFinite(stockBefore) || !Number.isFinite(qty) || qty <= 0) {
          throw new Error("Saldo atau kuantitas Waste legacy tidak valid.");
        }

        await tx.outletStock.update({
          where: { id: stock.id },
          data: { stock: stockAfter },
        });

        await tx.stockMutation.create({
          data: {
            outletId: waste.outletId,
            barangId: waste.barangId,
            type: "WASTE_REJECT_IN",
            qty,
            stockBefore,
            stockAfter,
            reference: `${waste.number}-REJECT`,
            description: `Pembalikan Waste ditolak ${waste.number} • ${qty} ${stock.barang.unit}`,
          },
        });

        await tx.stockCard.create({
          data: {
            barangId: waste.barangId,
            trxDate: new Date(),
            trxType: "WASTE_REJECT_IN",
            trxNumber: `${waste.number}-REJECT`,
            referenceId: waste.id,
            warehouse: `OUTLET:${stock.outlet.code}`,
            qtyIn: qty,
            qtyOut: 0,
            balance: stockAfter,
            unitPrice: unitCost,
            totalValue: qty * unitCost,
            note: `Pembalikan otomatis karena Waste ${waste.number} ditolak.`,
          },
        });
      }

      const rejected = await tx.outletStockOut.findUnique({
        where: { id: waste.id },
        include: {
          outlet: { select: { id: true, code: true, name: true } },
          barang: {
            select: {
              id: true,
              code: true,
              name: true,
              category: true,
              unit: true,
            },
          },
          user: { select: { id: true, username: true, fullname: true } },
        },
      });
      if (!rejected) throw new Error("Data Waste tidak ditemukan setelah reject.");
      return rejected;
    });

    /*
     * =======================================================
     * RESPONSE
     * =======================================================
     */

    return NextResponse.json({
      success: true,

      message: "Waste berhasil ditolak.",

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

        wasteQty: Number(
          result.wasteQty || 0
        ),

        netQty: Number(
          result.netQty || 0
        ),

        unitCost: Number(
          result.unitCost || 0
        ),

        totalCost:
          Number(result.totalCost || 0) ||
          Number(result.wasteQty || 0) *
            Number(result.unitCost || 0),

        note: result.note,

        approvedBy: result.approvedBy,

        approvedAt: result.approvedAt,

        user: result.user,
      },
    });
  } catch (error) {
    console.error(
      "OUTLET WASTE REJECT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Gagal reject Waste Outlet.",

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}