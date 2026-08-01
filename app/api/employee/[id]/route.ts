import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


// =======================
// GET DETAIL EMPLOYEE
// =======================

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>
  }
){

  try {


    const { id } = await params;


    const employeeId = Number(id);



    if(!employeeId || isNaN(employeeId)){

      return NextResponse.json({

        success:false,

        message:"ID employee tidak valid"

      },{
        status:400
      });

    }



    const employee = await prisma.employee.findUnique({

      where:{
        id:employeeId
      }

    });



    if(!employee){

      return NextResponse.json({

        success:false,

        message:"Data employee tidak ditemukan"

      },{
        status:404
      });

    }



    return NextResponse.json({

      success:true,

      data:employee

    });



  }catch(error){


    console.error(error);



    return NextResponse.json({

      success:false,

      message:"Gagal mengambil data employee"

    },{
      status:500
    });


  }

}





// =======================
// UPDATE EMPLOYEE
// =======================

export async function PUT(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id:string }>
  }
){

  try {


    const {id}=await params;


    const employeeId = Number(id);



    if(!employeeId || isNaN(employeeId)){


      return NextResponse.json({

        success:false,

        message:"ID employee tidak valid"

      },{
        status:400
      });


    }



    const body = await req.json();



    const check = await prisma.employee.findUnique({

      where:{
        id:employeeId
      }

    });



    if(!check){


      return NextResponse.json({

        success:false,

        message:"Employee tidak ditemukan"

      },{
        status:404
      });


    }




    const employee = await prisma.employee.update({

      where:{
        id:employeeId
      },


      data:{


        nik:body.nik ?? null,


        name:body.name,


        department:body.department ?? null,


        position:body.position ?? null,


        phone:body.phone ?? null,


        address:body.address ?? null,


        active:body.active ?? true


      }


    });




    return NextResponse.json({

      success:true,

      message:"Employee berhasil diperbarui",

      data:employee

    });




  }catch(error){


    console.error(error);



    return NextResponse.json({

      success:false,

      message:"Gagal update employee"

    },{
      status:500
    });


  }

}







// =======================
// DELETE EMPLOYEE
// =======================

export async function DELETE(
  req:NextRequest,
  {
    params,
  }: {
    params:Promise<{id:string}>
  }
){

  try {


    const {id}=await params;


    const employeeId = Number(id);



    if(!employeeId || isNaN(employeeId)){


      return NextResponse.json({

        success:false,

        message:"ID employee tidak valid"

      },{
        status:400
      });


    }





    const check = await prisma.employee.findUnique({

      where:{
        id:employeeId
      }

    });



    if(!check){


      return NextResponse.json({

        success:false,

        message:"Employee tidak ditemukan"

      },{
        status:404
      });


    }





    await prisma.employee.delete({

      where:{
        id:employeeId
      }

    });





    return NextResponse.json({

      success:true,

      message:"Employee berhasil dihapus"

    });





  }catch(error){


    console.error(error);



    return NextResponse.json({

      success:false,

      message:"Gagal menghapus employee"

    },{
      status:500
    });


  }

}