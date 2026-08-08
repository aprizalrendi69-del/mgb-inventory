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

    const data = await prisma.delivery.findMany({
      where,

      orderBy: {
        deliveryDate: "desc",
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

    /*
     * Ambil semua barangId yang ada di laporan
     */
    const barangIds = [
      ...new Set(
        data.flatMap((delivery) =>
          delivery.items.map((item) => item.barangId)
        )
      ),
    ];

    /*
     * Ambil harga terakhir dari PriceSummary
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
     * Buat Map agar pencarian harga cepat
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

    const result = data.map((delivery) => {
      const items = delivery.items.map((item) => {
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
         * 1. Harga transaksi
         * 2. PriceSummary.lastPrice
         * 3. Harga jual Barang
         */
        const harga =
          deliveryPrice > 0
            ? deliveryPrice
            : summaryPrice > 0
            ? summaryPrice
            : sellingPrice;

        /*
         * Kalau DeliveryItem subtotal sudah benar
         * dan harga transaksi tersedia, gunakan subtotal.
         *
         * Kalau harga sebelumnya 0, hitung ulang.
         */
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

          code: item.barang?.code ?? "-",

          name: item.barang?.name ?? "-",

          unit: item.barang?.unit ?? "-",

          qty,

          price: harga,

          subtotal,
        };
      });

      return {
        id: delivery.id,

        number: delivery.number,

        deliveryDate: delivery.deliveryDate,

        status: delivery.status,

        customer: {
          id: delivery.customer?.id ?? null,

          name: delivery.customer?.name ?? "-",
        },

        totalQty: items.reduce(
          (sum, item) => sum + item.qty,
          0
        ),

        totalNominal: items.reduce(
          (sum, item) => sum + item.subtotal,
          0
        ),

        items,
      };
    });

    return NextResponse.json({
      success: true,

      totalTransaksi: data.length,

      totalQty,

      totalNominal,

      data: result,
    });
  } catch (error) {
    console.error(
      "LAPORAN BARANG KELUAR ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Gagal mengambil laporan barang keluar",
      },
      {
        status: 500,
      }
    );
  }
}