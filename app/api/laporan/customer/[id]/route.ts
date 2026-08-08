import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const customerId = Number(id);

    if (!customerId) {
      return NextResponse.json(
        {
          success: false,
          message: "ID customer tidak ditemukan",
        },
        {
          status: 400,
        }
      );
    }

    const { searchParams } = new URL(req.url);

    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const where: any = {
      customerId,
    };

    if (start && end) {
      where.deliveryDate = {
        gte: new Date(`${start}T00:00:00`),
        lte: new Date(`${end}T23:59:59`),
      };
    }

    const deliveries = await prisma.delivery.findMany({
      where,

      include: {
        customer: true,

        items: {
          include: {
            barang: true,
          },
        },
      },

      orderBy: {
        deliveryDate: "desc",
      },
    });

    /*
     * Kalau tidak ada transaksi
     */
    if (deliveries.length === 0) {
      return NextResponse.json({
        success: true,

        data: {
          customer: null,

          deliveries: [],

          summary: {
            transaksi: 0,
            qty: 0,
            nominal: 0,
          },
        },
      });
    }

    /*
     * Ambil semua barangId
     */
    const barangIds = [
      ...new Set(
        deliveries.flatMap((delivery) =>
          delivery.items.map(
            (item) => item.barangId
          )
        )
      ),
    ];

    /*
     * Ambil PriceSummary
     */
    const priceSummaries =
      await prisma.priceSummary.findMany({
        where: {
          barangId: {
            in: barangIds,
          },
        },

        select: {
          barangId: true,
          lastPrice: true,
        },
      });

    /*
     * Map harga
     */
    const priceMap = new Map<number, number>();

    priceSummaries.forEach((item) => {
      priceMap.set(
        item.barangId,
        Number(item.lastPrice ?? 0)
      );
    });

    let totalQty = 0;
    let totalNominal = 0;

    /*
     * Bentuk ulang data delivery
     */
    const resultDeliveries = deliveries.map(
      (delivery) => {
        const items = delivery.items.map(
          (item) => {
            const qty = Number(item.qty ?? 0);

            const deliveryPrice = Number(
              item.price ?? 0
            );

            const summaryPrice = Number(
              priceMap.get(item.barangId) ?? 0
            );

            const sellingPrice = Number(
              item.barang?.sellingPrice ?? 0
            );

            /*
             * Prioritas harga:
             *
             * DeliveryItem.price
             * ↓
             * PriceSummary.lastPrice
             * ↓
             * Barang.sellingPrice
             */
            const harga =
              deliveryPrice > 0
                ? deliveryPrice
                : summaryPrice > 0
                ? summaryPrice
                : sellingPrice;

            const originalSubtotal = Number(
              item.subtotal ?? 0
            );

            const subtotal =
              deliveryPrice > 0 &&
              originalSubtotal > 0
                ? originalSubtotal
                : qty * harga;

            totalQty += qty;

            totalNominal += subtotal;

            return {
              id: item.id,

              barangId: item.barangId,

              barang: {
                id: item.barang?.id,

                code:
                  item.barang?.code ?? "-",

                name:
                  item.barang?.name ?? "-",

                unit:
                  item.barang?.unit ?? "-",
              },

              qty,

              price: harga,

              subtotal,
            };
          }
        );

        return {
          id: delivery.id,

          number: delivery.number,

          deliveryDate:
            delivery.deliveryDate,

          status: delivery.status,

          items,
        };
      }
    );

    /*
     * Customer ambil dari delivery pertama
     */
    const customer =
      deliveries[0]?.customer ?? null;

    return NextResponse.json({
      success: true,

      data: {
        customer,

        deliveries: resultDeliveries,

        summary: {
          transaksi: deliveries.length,

          qty: totalQty,

          nominal: totalNominal,
        },
      },
    });
  } catch (error: any) {
    console.error(
      "DETAIL CUSTOMER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ??
          "Gagal mengambil detail customer",
      },
      {
        status: 500,
      }
    );
  }
}