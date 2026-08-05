import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";



// =================================
// LIST STOCK OPNAME
// =================================

export async function GET(){

  try{


    const data =
      await prisma.stockOpname.findMany({

        include:{

          items:true

        },


        orderBy:{

          id:"desc"

        }

      });





    const result =
      data.map((item)=>({


        id:item.id,

        code:item.code,

        date:item.date,

        status:item.status,

        totalItem:item.items.length



      }));





    return NextResponse.json({

      success:true,

      data:result

    });




  }catch(error){


    console.error(
      "GET STOCK OPNAME ERROR",
      error
    );


    return NextResponse.json(
      {
        success:false,
        message:"Gagal mengambil data"
      },
      {
        status:500
      }
    );


  }


}








// =================================
// CREATE STOCK OPNAME
// =================================

export async function POST(
  req:NextRequest
){

  try{


    const total =
      await prisma.stockOpname.count();



    const nomor =
      String(total + 1)
      .padStart(4,"0");



    const code =
      `SO-${new Date().getFullYear()}-${nomor}`;







    const barang =
      await prisma.barang.findMany({

        orderBy:{

          name:"asc"

        }

      });





    if(barang.length===0){


      return NextResponse.json(
        {
          success:false,
          message:"Master barang masih kosong"
        },
        {
          status:400
        }
      );


    }






    const opname =
      await prisma.stockOpname.create({

        data:{


          code,


          createdBy:1,


          status:"COUNTING"


        }

      });








    await prisma.stockOpnameItem.createMany({

      data:

      barang.map((b)=>({


        opnameId:opname.id,


        barangId:b.id,


        systemQty:b.stock ?? 0,


        physicalQty:b.stock ?? 0,


        difference:0



      }))


    });








    const detail =
      await prisma.stockOpname.findUnique({

        where:{

          id:opname.id

        },


        include:{


          items:true


        }


      });







    return NextResponse.json({

      success:true,


      message:
      "Stock Opname berhasil dibuat",


      data:detail



    });





  }catch(error){


    console.error(

      "CREATE STOCK OPNAME ERROR",

      error

    );



    return NextResponse.json(
      {
        success:false,
        message:"Gagal membuat Stock Opname"
      },
      {
        status:500
      }
    );



  }


}