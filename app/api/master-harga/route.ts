import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function POST(req: NextRequest) {

  try {

    const body = await req.json();


    const {
      barangId,
      supplierId,

      purchaseId,
      purchaseItemId,

      poNumber,

      hargaLama,
      hargaBaru,

      qty,

      status,

      receiveDate,

    } = body;



    if (
      !barangId ||
      !supplierId ||
      hargaBaru === undefined
    ) {

      return NextResponse.json(
        {
          success:false,
          message:"Data harga tidak lengkap"
        },
        {
          status:400
        }
      );

    }



    const selisihHarga =
      Number(hargaBaru) -
      Number(hargaLama || 0);



    const persenNaik =
      hargaLama
      ? (
          (selisihHarga /
          Number(hargaLama))
          *100
        )
      : 0;



    const total =
      Number(hargaBaru) *
      Number(qty || 0);



    const masterHarga =
      await prisma.masterHarga.create({

        data:{

          barangId:Number(barangId),

          supplierId:Number(supplierId),


          purchaseId:
            purchaseId
            ? Number(purchaseId)
            : null,


          purchaseItemId:
            purchaseItemId
            ? Number(purchaseItemId)
            : null,


          poNumber:
            poNumber || null,


          hargaLama:
            Number(hargaLama || 0),


          hargaBaru:
            Number(hargaBaru),


          selisihHarga,


          persenNaik,


          qty:
            Number(qty || 0),


          total,


          akumulasi:
            total,


          status:
            status || "ACTIVE",


          receiveDate:
            receiveDate
            ? new Date(receiveDate)
            : null,

        }

      });



    return NextResponse.json({

      success:true,

      data:masterHarga

    });


  }
  catch(error:any){

    console.error(error);


    return NextResponse.json(

      {
        success:false,
        message:error.message
      },

      {
        status:500
      }

    );

  }

}
export async function GET(req: NextRequest){

  try {

    const { searchParams } =
      new URL(req.url);


    const search =
      searchParams.get("search") || "";


    const supplierId =
      searchParams.get("supplierId");


    const startDate =
      searchParams.get("startDate");


    const endDate =
      searchParams.get("endDate");



    const data =
      await prisma.masterHarga.findMany({

        where: {

          AND: [

            search
            ? {
                barang:{
                  name:{
                    contains:search
                  }
                }
              }
            : {},


            supplierId
            ? {
                supplierId:
                Number(supplierId)
              }
            : {},


            startDate
            ? {
                createdAt:{
                  gte:
                  new Date(startDate)
                }
              }
            : {},


            endDate
            ? {
                createdAt:{
                  lte:
                  new Date(
                    endDate +
                    "T23:59:59"
                  )
                }
              }
            : {}

          ]

        },


        orderBy:{
          createdAt:"desc"
        },


        include:{
          barang:true,
          supplier:true
        }

      });



    return NextResponse.json({

      success:true,

      data

    });



  } catch(error:any){

    console.error(error);


    return NextResponse.json({

      success:false,

      message:error.message

    },{
      status:500
    });

  }

}