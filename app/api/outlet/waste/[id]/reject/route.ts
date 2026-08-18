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
     * =======================================================
     * REJECT
     * =======================================================
     *
     * PENTING:
     *
     * Tidak ada perubahan:
     * - OutletStock
     * - Barang.stock
     * - BatchStock
     *
     * Karena transaksi stock sudah diproses
     * ketika Waste dibuat.
     *
     * Reject hanya membuat transaksi tidak masuk
     * ke laporan Waste / Cost Control karena
     * laporan hanya mengambil status APPROVED.
     *
     * Schema saat ini tidak memiliki:
     * rejectedBy
     * rejectedAt
     *
     * sehingga kita tidak membuat field baru di sini.
     */

    const updatedNote = reason
      ? waste.note
        ? `${waste.note}\nAlasan Reject: ${reason}`
        : `Alasan Reject: ${reason}`
      : waste.note;

    const result =
      await prisma.outletStockOut.update({
        where: {
          id: waste.id,
        },

        data: {
          status: "REJECTED",

          note: updatedNote,
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