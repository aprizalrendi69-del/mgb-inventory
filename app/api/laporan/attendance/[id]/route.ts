import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(
  req: Request,
  {
    params
  }: {
    params: Promise<{
      id:string
    }>
  }
){


  try{


    const { id } = await params;



    const { searchParams } =
      new URL(req.url);



    const month =
      Number(
        searchParams.get("month")
      )
      ||
      new Date().getMonth()+1;



    const year =
      Number(
        searchParams.get("year")
      )
      ||
      new Date().getFullYear();





    const start =
      new Date(
        year,
        month-1,
        1,
        0,
        0,
        0
      );



    const end =
      new Date(
        year,
        month,
        0,
        23,
        59,
        59
      );






    const employee =
      await prisma.employee.findUnique({

        where:{

          id:Number(id)

        },


        include:{


          attendances:{


            where:{


              date:{


                gte:start,

                lte:end


              }


            },


            orderBy:{


              date:"desc"


            }


          }


        }


      });







    if(!employee){


      return NextResponse.json({

        success:false,

        message:"Data karyawan tidak ditemukan"

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