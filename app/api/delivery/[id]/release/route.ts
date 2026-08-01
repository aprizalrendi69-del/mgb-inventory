import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DeliveryStatus, HistoryType } from "@prisma/client";

export async function POST(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await context.params;

    const delivery = await prisma.delivery.findUnique({
      where: {
        id: Number(id),
      },
      include: {
        customer: true,
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
          message: "Delivery Order tidak ditemukan",
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
      await tx.delivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          status: DeliveryStatus.RELEASED,
        },
      });

      const sjNumber =
        "SJ-" +
        new Date().toISOString().slice(0, 10).replace(/-/g, "") +
        "-" +
        delivery.id;

      await tx.suratJalan.create({
        data: {
          number: sjNumber,
          deliveryId: delivery.id,
        },
      });

      for (const item of delivery.items) {
        const barang = await tx.barang.findUnique({
          where: {
            id: item.barangId,
          },
        });

        if (!barang) continue;

        const stockBaru = barang.stock - item.qty;

        if (stockBaru < 0) {
          throw new Error(
            `Stock ${barang.name} tidak mencukupi`
          );
        }

        await tx.barang.update({
          where: {
            id: barang.id,
          },
          data: {
            stock: stockBaru,
          },
        });

        const inventory = await tx.inventory.findUnique({
          where: {
            barangId: barang.id,
          },
        });

        if (inventory) {
          await tx.inventory.update({
            where: {
              id: inventory.id,
            },
            data: {
              stock: stockBaru,
              availableStock: stockBaru,
            },
          });
        }

        await tx.stockCard.create({
          data: {
            barangId: barang.id,
            trxType: "DELIVERY",
            trxNumber: sjNumber,
            referenceId: delivery.id,
            warehouse: "MAIN",
            qtyIn: 0,
            qtyOut: item.qty,
            balance: stockBaru,
            unitPrice: barang.sellingPrice,
            totalValue: barang.sellingPrice * item.qty,
            note: `Surat Jalan ${sjNumber}`,
          },
        });
      }

      await tx.history.create({
        data: {
          transactionType: HistoryType.STOCK_OUT,
          referenceNumber: sjNumber,
          description: `Release Delivery ${delivery.number}`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Delivery berhasil direlease",
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error.message ?? "Gagal Release Delivery",
      },
      {
        status: 500,
      }
    );
  }
}