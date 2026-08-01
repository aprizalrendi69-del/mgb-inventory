import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


// GET ALL EMPLOYEE
export async function GET(){

  try {

    const data = await prisma.employee.findMany({

      orderBy:{
        id:"desc"
      }

    });


    return NextResponse.json({

      success:true,
      data

    });


  } catch(error){

    console.error(error);

    return NextResponse.json({

      success:false,
      message:"Gagal mengambil data pegawai"

    },{
      status:500
    });

  }

}



// CREATE EMPLOYEE
export async function POST(req: NextRequest){

  try {


    const body = await req.json();


    console.log("DATA EMPLOYEE MASUK:", body);



    const nik = String(body.nik ?? "").trim();

    const name = String(body.name ?? "").trim();


    const department = body.department || null;

    const position = body.position || null;

    const phone = body.phone || null;

    const address = body.address || null;



    if(nik === "" || name === ""){


      return NextResponse.json({

        success:false,

        message:"NIK dan Nama wajib diisi"

      },{
        status:400
      });


    }



    const cek = await prisma.employee.findUnique({

      where:{
        nik
      }

    });



    if(cek){

      return NextResponse.json({

        success:false,

        message:"NIK sudah terdaftar"

      },{
        status:400
      });

    }




    const employee = await prisma.employee.create({

      data:{

        nik,

        name,

        department,

        position,

        phone,

        address

      }

    });



    return NextResponse.json({

      success:true,

      message:"Pegawai berhasil ditambahkan",

      data:employee

    });



  } catch(error:any){


    console.error(
      "EMPLOYEE ERROR:",
      error
    );


    return NextResponse.json({

      success:false,

      message:error.message || "Gagal menyimpan pegawai"

    },{
      status:500
    });


  }

}