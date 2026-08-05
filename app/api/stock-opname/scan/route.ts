import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {

  try {

    const body = await req.json();

    const sessionId = Number(body.sessionId);

    const barcode = String(body.barcode).trim();

    if (!sessionId || !barcode) {

      return NextResponse.json({
        success: false,
        message: "Data tidak lengkap"
      });

    }

    const session =
      await prisma.stockOpname.findUnique({

        where: {
          id: sessionId
        }

      });

    if (!session) {

      return NextResponse.json({
        success: false,
        message: "Session tidak ditemukan"
      });

    }

    if (session.status !== "OPEN") {

      return NextResponse.json({
        success: false,
        message: "Stock Opname sudah selesai"
      });

    }

    const item =
      await prisma.stockOpnameItem.findFirst({

        where: {

          stockOpnameId: sessionId,

          barcode

        },

        include: {

          barang: true

        }

      });

    if (!item) {

      return NextResponse.json({
        success: false,
        message: "Barcode tidak ditemukan"
      });

    }

    const qty = item.physicalQty + 1;

    const update =
      await prisma.stockOpnameItem.update({

        where: {

          id: item.id

        },

        data: {

          scanned: true,

          scannedAt: new Date(),

          physicalQty: qty,

          difference: qty - item.systemQty

        },

        include: {

          barang: true

        }

      });

    return NextResponse.json({

      success: true,

      message: `${update.barang.name} berhasil discan`,

      data: update

    });

  } catch (error) {

    console.log(error);

    return NextResponse.json({

      success: false,

      message: "Gagal scan barcode"

    });

  }

}