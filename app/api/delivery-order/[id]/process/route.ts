import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DeliveryStatus, HistoryType } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const delivery = await prisma.delivery.findUnique({
      where: {
        id: Number(id),
      },
      include: {
        items: true,
      },
    });

    if (!delivery) {
      return NextResponse.json(
        {
          success: false,
          message: "Delivery Order tidak ditemukan",
        },
        { status: 404 }
      );
    }

    if (delivery.status === DeliveryStatus.DELIVERED) {
      return NextResponse.json(
        {
          success: false,
          message: "Delivery Order sudah diproses",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const item of delivery.items) {
        const barang = await tx.barang.findUnique({
          where: {
            id: item.barangId,
          },
        });

        if (!barang) {
          throw new Error("Barang tidak ditemukan");
        }

        if (barang.stock < item.qty) {
          throw new Error(`Stock ${barang.name} tidak mencukupi`);
        }

        const stockBaru = barang.stock - item.qty;

        await tx.barang.update({
          where: {
            id: barang.id,
          },
          data: {
            stock: stockBaru,
          },
        });

        await tx.inventory.updateMany({
          where: {
            barangId: barang.id,
          },
          data: {
            stock: stockBaru,
            availableStock: stockBaru,
          },
        });

        await tx.stockCard.create({
          data: {
            barangId: barang.id,
            trxType: "DELIVERY",
            trxNumber: delivery.number,
            referenceId: delivery.id,
            qtyOut: item.qty,
            balance: stockBaru,
            unitPrice: barang.sellingPrice,
            totalValue: item.qty * barang.sellingPrice,
            note: "Barang Keluar Delivery",
          },
        });
      }

      await tx.delivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          status: DeliveryStatus.DELIVERED,
        },
      });

      await tx.history.create({
        data: {
          transactionType: HistoryType.DELIVERY,
          referenceNumber: delivery.number,
          description: `Delivery ${delivery.number} telah diproses`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Delivery berhasil diproses",
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: 500,
      }
    );
  }
}