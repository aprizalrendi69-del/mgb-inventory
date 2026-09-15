import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// ======================================================
// PUT - EDIT BATCH
// ======================================================

export async function PUT(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { id } = await params;

    const batchId = Number(id);

    if (!Number.isInteger(batchId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID batch tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const body = await req.json();

    const {
      batchNumber,
      qty,
      expiredDate,
    } = body;

    // ==================================================
    // VALIDASI
    // ==================================================

    if (qty === undefined || qty === null || qty === "") {
      return NextResponse.json(
        {
          success: false,
          message: "Qty wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    const numericQty = Number(qty);

    if (!Number.isFinite(numericQty) || numericQty < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Qty tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    if (!expiredDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Tanggal expired wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    const parsedExpiredDate = new Date(expiredDate);

    if (Number.isNaN(parsedExpiredDate.getTime())) {
      return NextResponse.json(
        {
          success: false,
          message: "Tanggal expired tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // ==================================================
    // CEK BATCH
    // ==================================================

    const existingBatch =
      await prisma.batchStock.findUnique({
        where: {
          id: batchId,
        },
      });

    if (!existingBatch) {
      return NextResponse.json(
        {
          success: false,
          message: "Batch tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // ==================================================
    // UPDATE
    // ==================================================

    const updatedBatch =
      await prisma.batchStock.update({
        where: {
          id: batchId,
        },
        data: {
          batchNumber:
            batchNumber !== undefined
              ? String(batchNumber).trim()
              : existingBatch.batchNumber,

          qty: numericQty,

          expiredDate: parsedExpiredDate,
        },

        include: {
          barang: true,
        },
      });

    // ==================================================
    // RESPONSE
    // ==================================================

    return NextResponse.json({
      success: true,
      message: "Batch berhasil diperbarui",
      data: updatedBatch,
    });

  } catch (error) {

    console.error(
      "PUT /api/barang-batch/[id] ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengubah data batch",
      },
      {
        status: 500,
      }
    );
  }
}


// ======================================================
// DELETE - HAPUS BATCH
// ======================================================

export async function DELETE(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { id } = await params;

    const batchId = Number(id);

    if (!Number.isInteger(batchId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID batch tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // ==================================================
    // CEK BATCH
    // ==================================================

    const existingBatch =
      await prisma.batchStock.findUnique({
        where: {
          id: batchId,
        },
      });

    if (!existingBatch) {
      return NextResponse.json(
        {
          success: false,
          message: "Batch tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // ==================================================
    // HAPUS BATCH
    // ==================================================

    await prisma.batchStock.delete({
      where: {
        id: batchId,
      },
    });

    // ==================================================
    // RESPONSE
    // ==================================================

    return NextResponse.json({
      success: true,
      message: "Batch berhasil dihapus",
    });

  } catch (error) {

    console.error(
      "DELETE /api/barang-batch/[id] ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Gagal menghapus data batch",
      },
      {
        status: 500,
      }
    );
  }
}