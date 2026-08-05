import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      barangId:string;
    }>;
  }
){

  try{


    const { barangId } =
      await params;



    const id =
      Number(barangId);



    if(!id){

      return NextResponse.json(
        {
          success:false,
          message:"Barang ID tidak valid"
        },
        {
          status:400
        }
      );

    }




    const barang =
      await prisma.barang.findUnique({

        where:{
          id:id
        }

      });



    if(!barang){

      return NextResponse.json(
        {
          success:false,
          message:"Barang tidak ditemukan"
        },
        {
          status:404
        }
      );

    }




    const stockCard =
      await prisma.stockCard.findMany({

        where:{
          barangId:id
        },

        orderBy:{
          trxDate:"asc"
        }

      });





    return NextResponse.json({

      success:true,

      data:{

        barang,

        stockCard

      }

    });



  }catch(error){


    console.error(
      "GET STOCK CARD ERROR",
      error
    );


    return NextResponse.json(
      {
        success:false,
        message:"Gagal mengambil kartu stok"
      },
      {
        status:500
      }
    );


  }

}