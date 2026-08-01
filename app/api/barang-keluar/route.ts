import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {

    const body = await req.json();

    const {
      customerId,
      customer,
      note,
      items
    } = body;


    if (!Array.isArray(items) || items.length === 0) {

      return NextResponse.json(
        {
          success:false,
          message:"Barang belum dipilih"
        },
        {
          status:400
        }
      );

    }



    let idCustomer = Number(customerId);



    // =========================
    // BUAT / CARI CUSTOMER
    // =========================

    if (!idCustomer) {

      const namaCustomer =
        customer || "UMUM";


      let customerData =
        await prisma.customer.findFirst({
          where:{
            name:namaCustomer
          }
        });



      if (!customerData) {

        customerData =
          await prisma.customer.create({

            data:{
              code:
              "CUST-" + Date.now(),

              name:namaCustomer

            }

          });

      }


      idCustomer = customerData.id;

    }




    const number =
      "OUT-" + Date.now();



    const result =
    await prisma.$transaction(async(tx)=>{


      let totalQty = 0;



      // =========================
      // CEK SEMUA STOCK DULU
      // =========================


      for (const item of items) {


        const barangId =
          Number(item.barangId);


        const qty =
          Number(item.qty);



        const inventory =
          await tx.inventory.findUnique({

            where:{
              barangId
            },

            include:{
              barang:true
            }

          });



        if(!inventory){

          throw new Error(
            "Inventory tidak ditemukan"
          );

        }



        if(inventory.stock < qty){

          throw new Error(
            `Stock ${inventory.barang.name} tidak cukup`
          );

        }


      }




// =========================
// BUAT DELIVERY HEADER
// =========================

const delivery = await tx.delivery.create({

  data:{

    number,

    customerId:idCustomer,

    status:"DELIVERED",

    remarks:note || "Barang Keluar",

    totalQty:0

  }

});





      // =========================
      // PROSES ITEM
      // =========================


      for (const item of items) {


        const barangId =
          Number(item.barangId);


        const qty =
          Number(item.qty);



        const barang =
        await tx.barang.findUnique({

          where:{
            id:barangId
          }

        });



        if(!barang){

          throw new Error(
            "Barang tidak ditemukan"
          );

        }



        const inventory =
        await tx.inventory.findUnique({

          where:{
            barangId
          }

        });



        const newStock =
          inventory!.stock - qty;




        // update inventory

        await tx.inventory.update({

          where:{
            barangId
          },

          data:{

            stock:newStock,

            availableStock:
            Math.max(
              inventory!.availableStock - qty,
              0
            )

          }

        });




        // update barang

        await tx.barang.update({

          where:{
            id:barangId
          },

          data:{
            stock:newStock
          }

        });





        // delivery detail


await tx.deliveryItem.create({

  data:{

    deliveryId:delivery.id,

    barangId,

    qty,

    price:barang.sellingPrice,

    subtotal:barang.sellingPrice * qty,

    note:item.note || null

  }

});





        // stock card


        await tx.stockCard.create({

          data:{

            barangId,

            trxDate:new Date(),

            trxType:"OUT",

            trxNumber:number,

            warehouse:"MAIN",

            qtyIn:0,

            qtyOut:qty,

            balance:newStock,

            unitPrice:
            barang.purchasePrice,

            totalValue:
            barang.purchasePrice * qty,

            note:
            note || "Barang Keluar"

          }

        });





        await tx.history.create({

          data:{

            transactionType:
            "STOCK_OUT",

            referenceNumber:number,

            description:
            `${barang.name} keluar sebanyak ${qty}`

          }

        });



        totalQty += qty;


      }





      await tx.delivery.update({

        where:{
          id:delivery.id
        },

        data:{
          totalQty
        }

      });



      return delivery;


    });




    return NextResponse.json({

      success:true,

      message:
      "Barang keluar berhasil",

      data:result

    });



  } catch(error:any){


    console.error(error);


    return NextResponse.json({

      success:false,

      message:
      error.message ||
      "Gagal proses barang keluar"

    },{

      status:500

    });


  }
}