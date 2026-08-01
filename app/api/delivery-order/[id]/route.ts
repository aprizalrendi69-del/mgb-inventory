import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await params;

    const delivery = await prisma.delivery.findUnique({
      where: {
        id: Number(id),
      },

      select: {
        id: true,
        deliveryDate: true,
        status: true,
        remarks: true,

        customer: {
          select: {
            id: true,
            code: true,
            name: true,
            address: true,
            phone: true,
          },
        },

        suratJalan: {
          select: {
            id: true,
            number: true,
            createdAt:true,
          },
        },

        items: {
          select: {
            id: true,
            qty: true,
            price: true,
            subtotal: true,

            barang: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });


    if (!delivery) {
      return NextResponse.json(
        {
          success:false,
          message:"Delivery Order tidak ditemukan",
        },
        {
          status:404,
        }
      );
    }


    return NextResponse.json({
      success:true,
      data:delivery,
    });


  } catch(error){

    console.error(error);

    return NextResponse.json(
      {
        success:false,
        message:"Server Error",
      },
      {
        status:500,
      }
    );
  }
}