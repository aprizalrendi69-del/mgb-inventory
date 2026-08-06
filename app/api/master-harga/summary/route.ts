import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const history = await prisma.masterHarga.findMany({
      include: {
        barang: true,
        supplier: true,
      },
      orderBy: {
        receiveDate: "desc",
      },
    });

    const map = new Map<number, any>();

    for (const row of history) {
      if (!map.has(row.barangId)) {
        map.set(row.barangId, row);
      }
    }

    return NextResponse.json({
      success: true,
      data: Array.from(map.values()),
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil ringkasan harga",
      },
      {
        status: 500,
      }
    );
  }
}