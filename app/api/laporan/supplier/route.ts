import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {

    const purchases = await prisma.purchase.findMany({
      include: {
        supplier: true,
      },
      orderBy: {
        purchaseDate: "desc",
      },
    });

    const map = new Map<number, any>();

    for (const po of purchases) {

      const id = po.supplier.id;

      if (!map.has(id)) {

        map.set(id, {
          id: po.supplier.id,
          name: po.supplier.name,
          city: po.supplier.city,
          totalPO: 0,
          totalValue: 0,
          lastTransaction: po.purchaseDate,
        });

      }

      const item = map.get(id);

      item.totalPO += 1;
      item.totalValue += po.total;

      if (
        new Date(po.purchaseDate) >
        new Date(item.lastTransaction)
      ) {
        item.lastTransaction = po.purchaseDate;
      }

    }

    return NextResponse.json({
      success: true,
      data: Array.from(map.values()),
    });

  } catch (err) {

    console.log(err);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil laporan supplier",
      },
      {
        status: 500,
      }
    );

  }
}