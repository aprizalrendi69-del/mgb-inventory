import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {

  try {

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

    const today = new Date();

    const warningDate = new Date();

    warningDate.setDate(
      warningDate.getDate() + 30
    );

    const expired = batches.filter(
      x => new Date(x.expiredDate) < today
    );

    const warning = batches.filter(
      x =>
        new Date(x.expiredDate) >= today &&
        new Date(x.expiredDate) <= warningDate
    );

    const aman = batches.filter(
      x =>
        new Date(x.expiredDate) > warningDate
    );

    return NextResponse.json({

      success: true,

      totalBatch: batches.length,

      expired: expired.length,

      warning: warning.length,

      aman: aman.length,

      data: warning

    });

  } catch (e) {

    console.error(e);

    return NextResponse.json({

      success: false,

      message: "Gagal mengambil dashboard"

    }, {
      status: 500
    });

  }

}