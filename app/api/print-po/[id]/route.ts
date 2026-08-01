import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  req: NextRequest,
  { params }: Params
) {

  try {

    const { id } = await params;

    const purchase = await prisma.purchase.findUnique({

      where: {

        id: Number(id)

      },

      include: {

        supplier: true,

        items: {

          include: {

            barang: true

          }

        }

      }

    });

    if (!purchase) {

      return NextResponse.json({

        success: false,

        message: "Purchase Order tidak ditemukan"

      });

    }

    return NextResponse.json({

      success: true,

      data: purchase

    });

  }

  catch (error) {

    console.log(error);

    return NextResponse.json({

      success: false,

      message: "Gagal mengambil Purchase Order"

    }, {

      status: 500

    });

  }

}