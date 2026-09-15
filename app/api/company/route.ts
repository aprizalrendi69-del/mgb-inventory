import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {

  let company = await prisma.company.findFirst();

  if (!company) {

    company = await prisma.company.create({

      data:{

        name:"PT. Mitra Garam Bogatama"

      }

    });

  }

  return NextResponse.json({

    success:true,

    data:company

  });

}

export async function PUT(req:NextRequest){

  try{

    const body=await req.json();

    const company=await prisma.company.findFirst();

    if(!company){

      return NextResponse.json({

        success:false,

        message:"Company tidak ditemukan"

      });

    }

    const update=await prisma.company.update({

      where:{
        id:company.id
      },

      data:body

    });

    return NextResponse.json({

      success:true,

      data:update

    });

  }

  catch{

    return NextResponse.json({

      success:false,

      message:"Gagal menyimpan"

    });

  }

}