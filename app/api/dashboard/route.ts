import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET() {

  try {


    const totalBarang = await prisma.barang.count();


    const totalSupplier = await prisma.supplier.count();


    const totalCustomer = await prisma.customer.count();



    const stock = await prisma.barang.aggregate({

      _sum:{
        stock:true
      }

    });


    const totalStock = stock._sum.stock ?? 0;



    const limitStock = await prisma.barang.count({

      where:{
        stock:{
          lte:5
        }
      }

    });



    const barangSold = await prisma.deliveryItem.aggregate({

      _sum:{
        qty:true
      }

    });



    const inventory = await prisma.barang.findMany();



    const totalAsset = inventory.reduce(

      (acc,item)=>
        acc + ((item.stock ?? 0) * (item.purchasePrice ?? 0)),

      0

    );




    // AKTIVITAS TERBARU

    const activities = await prisma.history.findMany({

      orderBy:{
        createdAt:"desc"
      },

      take:10

    }).catch(()=>[]);





    // STOCK MINIMUM

    const stockMinimum = await prisma.barang.findMany({

      where:{
        stock:{
          lte:5
        }
      },

      select:{

        id:true,

        code:true,

        name:true,

        stock:true

      },


      orderBy:{
        stock:"asc"
      },


      take:10

    });





    // PURCHASE PENDING

    const purchasePending = await prisma.purchase.findMany({

      where:{

        status:{
          not:"RECEIVED"
        }

      },


      select:{

        id:true,

        number:true,

        status:true,


        supplier:{

          select:{

            name:true

          }

        }

      },


      orderBy:{

        createdAt:"desc"

      },


      take:10


    });






    // DELIVERY PENDING

    const deliveryPending = await prisma.delivery.findMany({

      where:{

        status:{

          not:"DELIVERED"

        }

      },


      select:{

        id:true,

        number:true,

        status:true,


        customer:{

          select:{

            name:true

          }

        }

      },


      orderBy:{

        createdAt:"desc"

      },


      take:10


    });






    return NextResponse.json({

      success:true,


      totalBarang,


      totalSupplier,


      totalCustomer,


      totalStock,


      barangSold:
      barangSold._sum.qty ?? 0,


      limitStock,


      inventory:
      totalAsset,


      activities,


      stockMinimum,


      purchasePending,


      deliveryPending


    });



  } catch(error){


    console.log(
      "DASHBOARD ERROR :",
      error
    );


    return NextResponse.json(

      {

        success:false,

        message:"Dashboard Error",

        error:String(error)

      },

      {

        status:500

      }

    );


  }

}