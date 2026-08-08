import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const where: any = {};

    if (start && end) {
      where.deliveryDate = {
        gte: new Date(`${start}T00:00:00`),
        lte: new Date(`${end}T23:59:59`),
      };
    }

    /*
     * Ambil PriceSummary sebagai fallback
     * untuk transaksi lama yang harga = 0.
     */
    const priceSummaries = await prisma.priceSummary.findMany({
      select: {
        barangId: true,
        lastPrice: true,
      },
    });

    const priceMap = new Map<number, number>();

    priceSummaries.forEach((item) => {
      const price = Number(item.lastPrice ?? 0);

      if (price > 0) {
        priceMap.set(item.barangId, price);
      }
    });

    const customers = await prisma.customer.findMany({
      include: {
        deliveries: {
          where,

          include: {
            items: {
              include: {
                barang: true,
              },
            },
          },
        },
      },
    });

    const data = customers.map((customer) => {
      let qty = 0;

      let nominal = 0;

      customer.deliveries.forEach((delivery) => {
        delivery.items.forEach((item) => {
          const itemQty = Number(item.qty ?? 0);

          let harga = Number(item.price ?? 0);

          /*
           * Prioritas:
           *
           * 1. DeliveryItem.price
           * 2. PriceSummary.lastPrice
           * 3. Barang.sellingPrice
           */
          if (harga <= 0) {
            harga = priceMap.get(item.barangId) ?? 0;
          }

          if (harga <= 0) {
            harga = Number(item.barang?.sellingPrice ?? 0);
          }

          let subtotal = Number(item.subtotal ?? 0);

          /*
           * Jika subtotal lama 0,
           * hitung menggunakan harga fallback.
           */
          if (subtotal <= 0 && itemQty > 0 && harga > 0) {
            subtotal = itemQty * harga;
          }

          qty += itemQty;

          nominal += subtotal;
        });
      });

      return {
        id: customer.id,

        name: customer.name,

        pic: customer.contactPerson ?? "-",

        transaksi: customer.deliveries.length,

        qty,

        nominal,
      };
    });

    return NextResponse.json({
      success: true,

      data,
    });
  } catch (error: any) {
    console.error("LAPORAN CUSTOMER ERROR:", error);

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ??
          "Gagal mengambil laporan customer",
      },
      {
        status: 500,
      }
    );
  }
}