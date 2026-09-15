import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{
      barangId:string
    }>
  }
){

  try {


    const { barangId } =
      await context.params;


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



    const history =
      await prisma.masterHarga.findMany({

        where:{
          barangId:id
        },

        orderBy:{
          createdAt:"desc"
        },

        include:{
          barang:true,
          supplier:true
        }

      });



    if(history.length === 0){

      return NextResponse.json({

        success:true,

        data:null

      });

    }



    const hargaTerakhir =
      history[0];



    const hargaTertinggi =
      Math.max(
        ...history.map(
          h=>h.hargaBaru
        )
      );


    const hargaTerendah =
      Math.min(
        ...history.map(
          h=>h.hargaBaru
        )
      );



    const totalQty =
      history.reduce(
        (a,b)=>a+b.qty,
        0
      );


    const totalNilai =
      history.reduce(
        (a,b)=>a+b.total,
        0
      );


    const hargaRata =
      totalQty === 0
      ? 0
      :
      totalNilai / totalQty;



    return NextResponse.json({

      success:true,

      data:{

        barangId:id,

        barang:
          hargaTerakhir.barang.name,


        hargaTerakhir:
          hargaTerakhir.hargaBaru,


        hargaTertinggi,


        hargaTerendah,


        hargaRata,


        supplier:
          hargaTerakhir.supplier.name,


        tanggalTerima:
          hargaTerakhir.receiveDate

      }

    });



  }catch(error:any){

    console.error(error);


    return NextResponse.json({

      success:false,

      message:error.message

    },{
      status:500
    });


  }

}