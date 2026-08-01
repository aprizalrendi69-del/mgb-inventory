import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {

  const data = await prisma.purchase.findMany({

    include:{

      supplier:true,

      items:{
        include:{
          barang:true
        }
      }

    },

    orderBy:{
      id:"desc"
    }

  });

  return NextResponse.json({

    success:true,

    data

  });

}

export async function POST(req:NextRequest){

  try{

    const body=await req.json();

    const {

      supplierId,

      items

    }=body;

    if(!supplierId){

      return NextResponse.json({

        success:false,

        message:"Supplier wajib dipilih"

      });

    }

    if(items.length==0){

      return NextResponse.json({

        success:false,

        message:"Barang belum dipilih"

      });

    }

    const count=await prisma.purchase.count();

    const number="PO-"+String(count+1).padStart(5,"0");

    let total=0;

    for(const item of items){

      total+=Number(item.qty)*Number(item.price);

    }

    const purchase=await prisma.purchase.create({

      data:{

        number,

        supplierId:Number(supplierId),

        total,

        items:{

          create:items.map((i:any)=>({

            barangId:Number(i.barangId),

            qty:Number(i.qty),

            price:Number(i.price),

            subtotal:Number(i.qty)*Number(i.price)

          }))

        }

      },

      include:{

        supplier:true,

        items:{

          include:{

            barang:true

          }

        }

      }

    });

    return NextResponse.json({

      success:true,

      data:purchase

    });

  }

  catch(err){

    console.log(err);

    return NextResponse.json({

      success:false,

      message:"Gagal membuat PO"

    },{

      status:500

    });

  }

}