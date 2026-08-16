import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OutletTransferStatus } from "@prisma/client";

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;

    // id dari halaman = TRANSFER-1
    const transferId = Number(
      String(id).replace("TRANSFER-", "")
    );

    if (!transferId) {
      return NextResponse.json(
        {
          success: false,
          message: "ID transfer tidak valid",
        },
        { status: 400 }
      );
    }

    const transfer =
      await prisma.outletTransfer.findUnique({
        where: {
          id: transferId,
        },
        include: {
          outlet: true,
          items: {
            include: {
              barang: true,
            },
          },
        },
      });

    if (!transfer) {
      return NextResponse.json(
        {
          success: false,
          message: "Transfer tidak ditemukan",
        },
        { status: 404 }
      );
    }

    if (
      transfer.status ===
      OutletTransferStatus.RECEIVED
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Transfer sudah diterima",
        },
        { status: 400 }
      );
    }

    if (!transfer.items.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Transfer tidak memiliki barang",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        const qty = Number(item.qty);

        if (qty <= 0) {
          throw new Error(
            `Qty ${item.barang.name} tidak valid`
          );
        }

        const stock =
          await tx.outletStock.findUnique({
            where: {
              outletId_barangId: {
                outletId: transfer.outletId,
                barangId: item.barangId,
              },
            },
          });

        if (stock) {
          await tx.outletStock.update({
            where: {
              id: stock.id,
            },
            data: {
              stock: {
                increment: qty,
              },
            },
          });
        } else {
          await tx.outletStock.create({
            data: {
              outletId: transfer.outletId,
              barangId: item.barangId,
              stock: qty,
              minimumStock:
                item.barang.minimumStock,
              averageCost:
                item.barang.purchasePrice,
            },
          });
        }

        await tx.outletTransferItem.update({
          where: {
            id: item.id,
          },
          data: {
            receivedQty: qty,
          },
        });
      }

      await tx.outletTransfer.update({
        where: {
          id: transfer.id,
        },
        data: {
          status:
            OutletTransferStatus.RECEIVED,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message:
        `Transfer ${transfer.number} berhasil diterima`,
    });
  } catch (error: any) {
    console.error(
      "RECEIVE OUTLET TRANSFER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menerima barang transfer",
      },
      { status: 500 }
    );
  }
}