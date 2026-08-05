import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{
      barcode:string;
    }>
  }
){

  try {

    const { barcode } = await context.params;


    if(!barcode){

      return NextResponse.json({
        success:false,
        message:"Barcode kosong"
      },{
        status:400
      });

    }



    const barang =
      await prisma.barang.findUnique({

        where:{
          barcode
        }

      });



    if(!barang){

      return NextResponse.json({

        success:false,
        message:"Barang tidak ditemukan"

      },{
        status:404
      });

    }



    return NextResponse.json({

      success:true,

      data:barang

    });



  } catch(error){

    console.error(error);


    return NextResponse.json({

      success:false,
      message:"Server error"

    },{
      status:500
    });

  }

}