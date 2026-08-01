import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DeliveryStatus, HistoryType } from "@prisma/client";

export async function PUT(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;

    const delivery = await prisma.delivery.findUnique({
      where: {
        id: Number(id),
      },
      include: {
        items: {
          include: {
            barang: true,
          },
        },
      },
    });

    if (!delivery) {
      return NextResponse.json(
        {
          success: false,
          message: "Delivery tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (delivery.status !== DeliveryStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          message: "Delivery sudah diproses",
        },
        {
          status: 400,
        }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const item of delivery.items) {
        // Ambil stok terbaru
        const barang = await tx.barang.findUnique({
          where: {
            id: item.barangId,
          },
        });

        if (!barang) {
          throw new Error("Barang tidak ditemukan");
        }

        if (barang.stock < item.qty) {
          throw new Error(`Stock ${barang.name} tidak cukup`);
        }

        // Kurangi stok barang
        const updatedBarang = await tx.barang.update({
          where: {
            id: item.barangId,
          },
          data: {
            stock: {
              decrement: item.qty,
            },
          },
        });

        // Update Inventory
        await tx.inventory.update({
          where: {
            barangId: item.barangId,
          },
          data: {
            stock: {
              decrement: item.qty,
            },
            availableStock: {
              decrement: item.qty,
            },
          },
        });

        // Simpan Stock Card
        await tx.stockCard.create({
          data: {
            barangId: item.barangId,
            trxType: "DELIVERY",
            trxNumber: delivery.number,
            referenceId: delivery.id,
            qtyIn: 0,
            qtyOut: item.qty,
            balance: updatedBarang.stock,
            unitPrice: updatedBarang.sellingPrice,
            totalValue: updatedBarang.sellingPrice * item.qty,
            note: "Barang keluar Delivery Order",
          },
        });
      }

      // Update Status Delivery
      await tx.delivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          status: DeliveryStatus.RELEASED,
        },
      });

      // Cek Surat Jalan
      const suratJalan = await tx.suratJalan.findUnique({
        where: {
          deliveryId: delivery.id,
        },
      });

      if (!suratJalan) {
        await tx.suratJalan.create({
          data: {
            number: `SJ-${delivery.number}`,
            deliveryId: delivery.id,
          },
        });
      }

      // History
      await tx.history.create({
        data: {
          transactionType: HistoryType.DELIVERY,
          referenceNumber: delivery.number,
          description: `Release Delivery Order ${delivery.number}`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Delivery berhasil di Release",
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error.message ?? "Server Error",
      },
      {
        status: 500,
      }
    );
  }
}