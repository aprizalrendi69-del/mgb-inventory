import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await context.params;

    const deliveryId = Number(id);

    if (!Number.isInteger(deliveryId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Delivery Order tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const delivery = await prisma.delivery.findUnique({
      where: {
        id: deliveryId,
      },

      include: {
        customer: true,

        suratJalan: true,

        items: {
          include: {
            barang: {
              include: {
                priceSummary: true,
              },
            },
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

    const items = delivery.items.map((item) => {
      const qty = Number(item.qty ?? 0);

      const deliveryPrice = Number(item.price ?? 0);

      const summaryPrice = Number(
        item.barang?.priceSummary?.lastPrice ?? 0
      );

      // Prioritas:
      // 1. Harga yang sudah tersimpan di DeliveryItem
      // 2. PriceSummary.lastPrice
      const price =
        deliveryPrice > 0
          ? deliveryPrice
          : summaryPrice;

      const subtotal = qty * price;

      return {
        ...item,

        price,

        subtotal,

        barang: {
          ...item.barang,

          priceSummary: undefined,
        },
      };
    });

    const total = items.reduce(
      (sum, item) => {
        return sum + Number(item.subtotal ?? 0);
      },
      0
    );

    return NextResponse.json({
      success: true,

      data: {
        ...delivery,

        items,

        total,
      },
    });
  } catch (error) {
    console.error(
      "GET DELIVERY ORDER DETAIL ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}