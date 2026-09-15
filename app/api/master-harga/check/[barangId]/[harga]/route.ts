import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(
  req: NextRequest,
  context:{
    params:Promise<{
      barangId:string;
      harga:string;
    }>
  }
){

  try{


    const {
      barangId,
      harga
    } =
    await context.params;



    const id =
    Number(barangId);


    const hargaBaru =
    Number(harga);



    const last =
    await prisma.masterHarga.findFirst({

      where:{
        barangId:id
      },

      orderBy:{
        createdAt:"desc"
      },

      include:{
        supplier:true
      }

    });



    if(!last){

      return NextResponse.json({

        success:true,

        data:null

      });

    }



    const selisih =
    hargaBaru -
    last.hargaBaru;



    const persen =
    last.hargaBaru > 0

    ?

    (
      selisih /
      last.hargaBaru
    )
    *100

    :

    0;



    return NextResponse.json({

      success:true,

      data:{

        hargaLama:
        last.hargaBaru,


        hargaBaru,


        selisih,


        persen,


        supplier:
        last.supplier.name

      }

    });



  }
  catch(error:any){

    return NextResponse.json({

      success:false,

      message:error.message

    },{
      status:500
    });

  }

}