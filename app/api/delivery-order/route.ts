import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DeliveryStatus, HistoryType } from "@prisma/client";

export async function GET() {
  try {
    const data = await prisma.delivery.findMany({
      select:{
        id:true,
        number:true,
        deliveryDate:true,
        status:true,
        totalQty:true,
        remarks:true,

        customer:{
          select:{
            id:true,
            name:true,
            address:true,
          }
        },

        suratJalan:{
          select:{
            id:true,
            number:true,
          }
        },

        items:{
          select:{
            id:true,
            qty:true,
            note:true,

            barang:{
              select:{
                id:true,
                code:true,
                name:true,
              }
            }
          }
        }
      },

      orderBy:{
        deliveryDate:"desc",
      },
    });


    return NextResponse.json({
      success:true,
      data,
    });


  } catch(error){

    console.error(error);

    return NextResponse.json(
      {
        success:false,
        message:"Gagal mengambil Delivery Order",
      },
      {
        status:500,
      }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.customerId) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Barang belum dipilih",
        },
        {
          status: 400,
        }
      );
    }

    let totalQty = 0;

    for (const item of body.items) {
      const barang = await prisma.barang.findUnique({
        where: {
          id: Number(item.barangId),
        },
      });

      if (!barang) {
        return NextResponse.json(
          {
            success: false,
            message: "Barang tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }

      if (barang.stock < Number(item.qty)) {
        return NextResponse.json(
          {
            success: false,
            message: `Stock ${barang.name} tidak mencukupi`,
          },
          {
            status: 400,
          }
        );
      }

      totalQty += Number(item.qty);
    }

    const number =
      "DO-" +
      new Date().toISOString().slice(0, 10).replace(/-/g, "") +
      "-" +
      Date.now();

    const delivery = await prisma.delivery.create({
      data: {
        number,
        customerId: Number(body.customerId),
        remarks: body.remarks,
        totalQty,
        status: DeliveryStatus.DRAFT,

        items: {
          create: body.items.map((item: any) => ({
            barangId: Number(item.barangId),
            qty: Number(item.qty),
            note: item.note ?? null,
          })),
        },
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

    await prisma.history.create({
      data: {
        transactionType: HistoryType.DELIVERY,
        referenceNumber: delivery.number,
        description: `Membuat Delivery Order ${delivery.number}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Delivery Order berhasil dibuat",
      data: delivery,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal membuat Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}