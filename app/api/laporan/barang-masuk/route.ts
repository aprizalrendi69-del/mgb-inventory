import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {

  try {

    const { searchParams } = new URL(req.url);

    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const where: any = {};

    if (start && end) {

      where.receiptDate = {

        gte: new Date(start),

        lte: new Date(end + "T23:59:59")

      };

    }

    const data = await prisma.receipt.findMany({

      where,

      orderBy: {

        receiptDate: "desc"

      },

      include: {

        supplier: true,

        purchase: true,

        items: {

          include: {

            barang: true

          }

        }

      }

    });

    let totalQty = 0;
    let totalNominal = 0;

    data.forEach((receipt) => {

      receipt.items.forEach((item) => {

        totalQty += item.qty;
        totalNominal += item.subtotal;

      });

    });

    return NextResponse.json({

      success: true,

      totalTransaksi: data.length,

      totalQty,

      totalNominal,

      data

    });

  } catch (error) {

    console.log(error);

    return NextResponse.json({

      success: false,

      message: "Gagal mengambil laporan barang masuk"

    }, {

      status: 500

    });

  }

}