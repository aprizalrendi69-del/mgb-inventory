import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PurchaseStatus } from "@prisma/client";


export async function POST(req: NextRequest) {

  try {

    const body = await req.json();

    const {
      purchaseId,
      items,
      remarks
    } = body;


    if(
      !purchaseId ||
      !Array.isArray(items) ||
      items.length === 0
    ){

      return NextResponse.json(
        {
          success:false,
          message:"Data penerimaan tidak lengkap"
        },
        {
          status:400
        }
      );

    }



    const purchase =
    await prisma.purchase.findUnique({

      where:{
        id:Number(purchaseId)
      },

      include:{
        items:true
      }

    });



    if(!purchase){

      return NextResponse.json(
        {
          success:false,
          message:"Purchase tidak ditemukan"
        },
        {
          status:404
        }
      );

    }



    if(
      purchase.status !== PurchaseStatus.APPROVED
    ){

      return NextResponse.json(
        {
          success:false,
          message:"Purchase harus APPROVED"
        },
        {
          status:400
        }
      );

    }




    for (const item of items) {

  const barangId = Number(item.barangId);

  const poItem = purchase.items.find(
    (p) => p.barangId === barangId
  );

  if (!poItem) {
    throw new Error("Barang tidak ada dalam PO");
  }

  const sisa =
    poItem.qty - poItem.receivedQty;

  if (Number(item.qty) > sisa) {
    throw new Error("Qty melebihi sisa PO");
  }

  if (Number(item.qty) <= 0) {
    throw new Error("Qty harus lebih dari 0");
  }

}





    const result =
    await prisma.$transaction(async(tx)=>{


      const receiptNumber =
      "GR-" + Date.now();




      const receipt =
      await tx.receipt.create({

        data:{

          number:
          receiptNumber,

          purchaseId:
          purchase.id,

          supplierId:
          purchase.supplierId,

          remarks

        }

      });





     

       await tx.receiptItem.createMany({

  data:

  items.map((item:any)=>{

    const poItem =
      purchase.items.find(
        p => p.barangId === Number(item.barangId)
      );

    return {

      receiptId:
      receipt.id,

      barangId:
      Number(item.barangId),

      qty:
      Number(item.qty),

      price:
      Number(item.price),

      subtotal:
      Number(item.qty) *
      Number(item.price)

    };

  })

});







      for(const item of items){

  const barangId =
  Number(item.barangId);

  const qty =
  Number(item.qty);

  const price =
  Number(item.price);

  const poItem =
  purchase.items.find(
    p => p.barangId === barangId
  );

  if(!poItem){

    throw new Error(
      "Purchase Item tidak ditemukan"
    );

  }





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

if (!poItem) {
  throw new Error("Purchase Item tidak ditemukan");
}




        // =========================
        // BATCH STOCK EXPIRED
        // =========================


        if(barang.hasExpired){


          if(!item.expiredDate){


            throw new Error(
              `Expired date wajib untuk ${barang.name}`
            );


          }




          await tx.batchStock.create({

            data:{

              barangId,

              batchNumber:
              receipt.number,

              expiredDate:
              new Date(item.expiredDate),

              qty

            }

          });


        }







        let inventory =
        await tx.inventory.findUnique({

          where:{
            barangId
          }

        });





        if(!inventory){


          inventory =
          await tx.inventory.create({

            data:{


              barangId,


              warehouse:"MAIN",


              stock:0,


              availableStock:0,


              minimumStock:
              barang.minimumStock ?? 0,


              maximumStock:0,


              lastPurchase:0,


              averageCost:0


            }

          });


        }







        const oldStock =
        inventory.stock;



        const newStock =
        oldStock + qty;





        const averageCost =
        oldStock === 0

        ?

        price

        :

        (
          oldStock *
          inventory.averageCost
          +
          qty *
          price

        )
        /
        newStock;







        await tx.inventory.update({

          where:{
            barangId
          },

          data:{


            stock:
            newStock,


            availableStock:
            newStock,


            lastPurchase:
            price,


            averageCost


          }

        });







        await tx.barang.update({

          where:{
            id:barangId
          },

          data:{


            stock:
            newStock,


            purchasePrice:
            price


          }

        });

// ====================================
// SIMPAN MASTER HARGA
// ====================================

const hargaLama = barang.purchasePrice;
const hargaBaru = price;

const selisihHarga =
  hargaBaru - hargaLama;

const persenNaik =
  hargaLama > 0
    ? (selisihHarga / hargaLama) * 100
    : 0;

const qtyHistory =
await tx.masterHarga.aggregate({

  where:{
    barangId
  },

  _sum:{
    qty:true
  }

});

const akumulasi =
(qtyHistory._sum.qty ?? 0)
+
qty;

await tx.masterHarga.create({
  data: {
    barangId: barangId,

    supplierId: purchase.supplierId,

    purchaseId: purchase.id,

    purchaseItemId: poItem.id,

    poNumber: purchase.number,

    hargaLama: hargaLama,

    hargaBaru: hargaBaru,

    selisihHarga: selisihHarga,

    persenNaik: persenNaik,

    qty: qty,

    total: qty * hargaBaru,

    akumulasi: akumulasi,

    status: "RECEIVED",

    receiveDate: receipt.receiptDate,

    createdAt: new Date(),
  },
});

// ====================================
// UPDATE PRICE SUMMARY
// ====================================

const histories =
await tx.masterHarga.findMany({

  where:{
    barangId
  },

  orderBy:{
    receiveDate:"desc"
  }

});

const hargaTerakhir =
histories[0]?.hargaBaru ?? 0;

const hargaTertinggi =
Math.max(
  ...histories.map(h=>h.hargaBaru)
);

const hargaTerendah =
Math.min(
  ...histories.map(h=>h.hargaBaru)
);

const totalQty =
histories.reduce(
  (a,b)=>a+b.qty,
  0
);

const totalNilai =
histories.reduce(
  (a,b)=>a+b.total,
  0
);

const hargaRata =
totalQty===0
?0
:totalNilai/totalQty;

await tx.priceSummary.upsert({

  where:{
    barangId
  },

  update:{

    supplierId:
    purchase.supplierId,

    lastPrice:
    hargaTerakhir,

    highestPrice:
    hargaTertinggi,

    lowestPrice:
    hargaTerendah,

    averagePrice:
    hargaRata,

    lastReceiveDate:
    receipt.receiptDate,

    totalPurchase:
    totalQty

  },

  create:{

    barangId,

    supplierId:
    purchase.supplierId,

    lastPrice:
    hargaTerakhir,

    highestPrice:
    hargaTertinggi,

    lowestPrice:
    hargaTerendah,

    averagePrice:
    hargaRata,

    lastReceiveDate:
    receipt.receiptDate,

    totalPurchase:
    totalQty

  }

});






        await tx.stockCard.create({

          data:{


            barangId,


            trxDate:
            new Date(),


            trxType:
            "RECEIVE",


            trxNumber:
            receipt.number,


            referenceId:
            receipt.id,


            warehouse:
            "MAIN",


            qtyIn:
            qty,


            qtyOut:
            0,


            balance:
            newStock,


            unitPrice:
            price,


            totalValue:
            qty * price,


            note:
            "Goods Receipt"


          }

        });







        await tx.stockMutation.create({

          data:{


            barangId,


            type:
            "MASUK",


            qty,


            stockBefore:
            oldStock,


            stockAfter:
            newStock,


            reference:
            receipt.number,


            description:
            "Receive Barang"


          }

        });







        await tx.purchaseItem.updateMany({

          where:{


            purchaseId:
            purchase.id,


            barangId


          },

          data:{


            receivedQty:{


              increment:
              qty


            }


          }

        });




      }








      await tx.purchase.update({

        where:{
          id:purchase.id
        },

        data:{

          status:
          PurchaseStatus.RECEIVED

        }

      });








      await tx.history.create({

        data:{


          transactionType:
          "RECEIPT",


          referenceNumber:
          receipt.number,


          description:
          "Goods Receipt "
          +
          receipt.number


        }

      });






      return receipt;


    });







    return NextResponse.json({

      success:true,

      message:
      "Barang berhasil diterima",

      receipt:result

    });



  }

  catch(error){


    console.error(
      "GOODS RECEIPT ERROR:",
      error
    );



    return NextResponse.json({

      success:false,

      message:
      error instanceof Error
      ?
      error.message
      :
      "Gagal menerima barang"


    },
    {
      status:500
    });


  }

}