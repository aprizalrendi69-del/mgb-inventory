import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {

  try {

    const { searchParams } = new URL(req.url);

    const start = searchParams.get("start");
    const end = searchParams.get("end");


    const where:any = {};


    if(start && end){

      where.deliveryDate = {

        gte:new Date(start),

        lte:new Date(end + "T23:59:59")

      };

    }


    const data = await prisma.delivery.findMany({

      where,

      orderBy:{
        deliveryDate:"desc"
      },

      include:{

        customer:true,

        items:{

          include:{

            barang:true

          }

        }

      }

    });


    let totalQty = 0;
    let totalNominal = 0;


    data.forEach((delivery)=>{


      delivery.items.forEach((item)=>{


        const qty = Number(item.qty || 0);


        // ambil harga jual barang
        const harga = Number(
          item.barang?.sellingPrice || 0
        );


        totalQty += qty;


        totalNominal += qty * harga;


      });


    });



    return NextResponse.json({

      success:true,

      totalTransaksi:data.length,

      totalQty,

      totalNominal,

      data

    });


  } catch(error){


    console.log(error);


    return NextResponse.json({

      success:false,

      message:"Gagal mengambil laporan barang keluar"

    },{

      status:500

    });


  }

}