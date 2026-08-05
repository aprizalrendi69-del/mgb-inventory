import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: {
      id: string;
    };
  }
) {


  try {


    const id =
      Number(params.id);



    const opname =
      await prisma.stockOpname.findUnique({

        where:{
          id
        },

        include:{

          items:{
            include:{
              barang:true
            }
          }

        }

      });




    if(!opname){


      return NextResponse.json(
        {
          success:false,
          message:"Stock Opname tidak ditemukan"
        },
        {
          status:404
        }
      );


    }





    if(opname.status !== "COUNTING"){


      return NextResponse.json(
        {
          success:false,
          message:"Stock Opname sudah diproses"
        }
      );


    }







    await prisma.$transaction(

      async(tx)=>{



        for(const item of opname.items){



          const stockLama =
            item.systemQty;



          const stockBaru =
            item.physicalQty;



          const selisih =
            stockBaru - stockLama;





          if(selisih !== 0){



            // UPDATE BARANG

            await tx.barang.update({

              where:{
                id:item.barangId
              },

              data:{

                stock:
                stockBaru

              }

            });








            // UPDATE INVENTORY

            await tx.inventory.upsert({

              where:{
                barangId:item.barangId
              },


              update:{

                stock:
                stockBaru,


                availableStock:
                stockBaru

              },


              create:{

                barangId:
                item.barangId,


                warehouse:
                "MAIN",


                stock:
                stockBaru,


                availableStock:
                stockBaru,


                minimumStock:
                item.barang.minimumStock

              }


            });









            // STOCK CARD

            await tx.stockCard.create({

              data:{

                barangId:
                item.barangId,


                trxType:
                "STOCK_OPNAME",


                trxNumber:
                opname.code,


                qtyIn:
                selisih > 0
                ?
                selisih
                :
                0,


                qtyOut:
                selisih < 0
                ?
                Math.abs(selisih)
                :
                0,


                balance:
                stockBaru,


                unitPrice:
                item.barang.purchasePrice,


                totalValue:
                stockBaru *
                item.barang.purchasePrice,


                note:
                `Penyesuaian Stock Opname ${opname.code}`


              }

            });



          }



        }






        await tx.stockOpname.update({

          where:{
            id
          },


          data:{

            status:
            "APPROVED",


            approvedBy:
            1

          }


        });




      }

    );







    return NextResponse.json({

      success:true,

      message:
      "Stock Opname berhasil approve dan stok diperbarui"

    });






  }catch(error){


    console.error(
      "APPROVE STOCK OPNAME ERROR",
      error
    );



    return NextResponse.json(

      {
        success:false,
        message:"Gagal approve Stock Opname"
      },

      {
        status:500
      }

    );


  }


}