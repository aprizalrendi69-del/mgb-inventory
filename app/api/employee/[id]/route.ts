import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(
  req:Request,
  {
    params
  }:{
    params:Promise<{id:string}>
  }
){


  try{


    const {id} = await params;



    const employee =
      await prisma.employee.findUnique({

        where:{
          id:Number(id)
        },


        include:{


          attendances:{


            orderBy:{


              date:"desc"


            }


          }


        }


      });





    if(!employee){


      return NextResponse.json({

        success:false,

        message:"Karyawan tidak ditemukan"

      },{

        status:404

      });


    }






    return NextResponse.json({

      success:true,

      data:employee

    });





  }catch(error:any){


    console.log(error);


    return NextResponse.json({

      success:false,

      message:error.message

    },{

      status:500

    });


  }


}