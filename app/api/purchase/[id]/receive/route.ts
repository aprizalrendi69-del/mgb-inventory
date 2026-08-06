import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function PUT(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {

  try {


    const { id } = await params;

    const purchaseId = Number(id);


    const body = await req.json();

    const receiveItems = body.items;



    if (!Array.isArray(receiveItems)) {

      return NextResponse.json({

        success: false,

        message: "Item receive kosong"

      }, {
        status: 400
      });

    }



    // cek expired date

    for (const item of receiveItems) {


      const barang = await prisma.barang.findUnique({

        where: {

          id: item.barangId

        }

      });



      if (barang?.hasExpired && !item.expiredDate) {


        return NextResponse.json({

          success: false,

          message:
            `Barang ${barang.name} harus memiliki expired date`

        }, {
          status: 400
        });


      }


    }





    // ambil PO

    const purchase = await prisma.purchase.findUnique({

      where: {

        id: purchaseId

      },

      include: {

        supplier: true,

        items: {

          include: {

            barang: true

          }

        }

      }

    });





    if (!purchase) {


      return NextResponse.json({

        success: false,

        message: "Purchase tidak ditemukan"

      }, {
        status: 404
      });


    }





    if (purchase.status === "RECEIVED") {


      return NextResponse.json({

        success: false,

        message: "Purchase sudah diterima"

      }, {
        status: 400
      });


    }







    const receipt = await prisma.$transaction(async (tx) => {



      // HEADER RECEIPT

      const newReceipt = await tx.receipt.create({

        data: {


          number:
            "RC-" + Date.now(),


          receiptDate:
            new Date(),


          purchaseId:
            purchase.id,


          supplierId:
            purchase.supplierId,


          remarks:
            "Receive Purchase " + purchase.number


        }

      });







      // DETAIL BARANG

      for (const item of receiveItems) {



        const barang = await tx.barang.findUnique({

          where: {

            id: item.barangId

          }

        });




        if (!barang) {

          throw new Error(
            "Barang tidak ditemukan ID : " + item.barangId
          );

        }





        const stockBefore = barang.stock;




        const updatedBarang = await tx.barang.update({

          where: {

            id: item.barangId

          },

          data: {

            stock: {

              increment: Number(item.qty)

            }

          }

        });






        // STOCK MUTATION

        await tx.stockMutation.create({

          data: {


            barangId:
              item.barangId,


            type:
              "MASUK",


            qty:
              Number(item.qty),


            stockBefore:
              stockBefore,


            stockAfter:
              updatedBarang.stock,


            reference:
              "RC-" + purchase.number,


            description:
              "Receive Purchase " + purchase.number


          }

        });








        // RECEIPT ITEM

        await tx.receiptItem.create({

          data: {


            receiptId:
              newReceipt.id,


            barangId:
              item.barangId,


            qty:
              Number(item.qty),


            price:
              barang.purchasePrice ?? 0,


            subtotal:
              Number(item.qty) *
              (barang.purchasePrice ?? 0)


          }

        });







        // BATCH EXPIRED

        if (barang.hasExpired) {



          await tx.batchStock.create({

            data: {


              barangId:
                item.barangId,


              batchNumber:
                "RC-" + purchase.number,


              expiredDate:
                new Date(item.expiredDate),


              qty:
                Number(item.qty)


            }

          });



        }




      }







      // UPDATE STATUS PURCHASE

      await tx.purchase.update({

        where: {

          id: purchase.id

        },

        data: {

          status:
            "RECEIVED"

        }

      });




      return newReceipt;



    });








    return NextResponse.json({

      success: true,

      message:
        "Barang berhasil diterima",

      data:
        receipt


    });






  } catch (error) {


    console.log(
      "RECEIVE ERROR :",
      error
    );



    return NextResponse.json({

      success: false,

      message:
        "Receive gagal"

    }, {
      status: 500
    });


  }

}