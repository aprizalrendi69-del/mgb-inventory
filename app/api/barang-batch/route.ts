import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const today = new Date();

    const batches = await prisma.batchStock.findMany({
      where: {
        qty: {
          gt: 0,
        },
      },
      include: {
        barang: true,
      },
      orderBy: {
        expiredDate: "asc",
      },
    });

    const data = batches.map((batch) => {

      const sisaHari = Math.ceil(
        (
          batch.expiredDate.getTime() -
          today.getTime()
        ) / (1000 * 60 * 60 * 24)
      );

      let status = "AMAN";

      if (sisaHari < 0) {

        status = "EXPIRED";

      } else if (
        sisaHari <= (batch.barang.expiredWarning ?? 30)
      ) {

        status = "WARNING";

      }

      return {

        id: batch.id,

        barangId: batch.barangId,

        namaBarang: batch.barang.name,

        kodeBarang: batch.barang.code,

        batchNumber: batch.batchNumber,

        qty: batch.qty,

        expiredDate: batch.expiredDate,

        sisaHari,

        status,

      };

    });

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil data batch",
      },
      {
        status: 500,
      }
    );
  }
}