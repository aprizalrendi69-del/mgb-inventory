import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params {

  params: Promise<{

    id: string

  }>;

}

export async function GET(

  req: NextRequest,

  { params }: Params

) {

  try {

    const { id } = await params;

    const delivery = await prisma.delivery.findUnique({

      where: {

        id: Number(id)

      },

      include: {

        customer: true,

        items: {

          include: {

            barang: true

          }

        }

      }

    });

    if (!delivery) {

      return NextResponse.json({

        success: false,

        message: "Delivery Order tidak ditemukan"

      });

    }

    return NextResponse.json({

      success: true,

      data: delivery

    });

  }

  catch (error) {

    console.log(error);

    return NextResponse.json({

      success: false,

      message: "Gagal mengambil Surat Jalan"

    }, {

      status: 500

    });

  }

}