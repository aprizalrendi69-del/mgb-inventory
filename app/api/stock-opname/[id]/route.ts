import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


// =================================
// GET DETAIL STOCK OPNAME
// =================================

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id:string
    }>
  }
){

  try{


    const {id} =
      await params;


    const opnameId =
      Number(id);



    if(!opnameId){

      return NextResponse.json(
        {
          success:false,
          message:"ID tidak valid"
        },
        {
          status:400
        }
      );

    }




    const opname =
      await prisma.stockOpname.findUnique({

        where:{
          id:opnameId
        },


        include:{

          items:{

            include:{

              barang:true

            },


            orderBy:{
              id:"asc"
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




    return NextResponse.json({

      success:true,

      data:{

        ...opname,


        items:
        opname.items.map(item=>({

          ...item,

          difference:
          item.physicalQty -
          item.systemQty


        }))


      }


    });



  }catch(error){

    console.error(error);


    return NextResponse.json(
      {
        success:false,
        message:"Gagal mengambil detail"
      },
      {
        status:500
      }
    );

  }

}







// =================================
// UPDATE QTY FISIK
// =================================

export async function PATCH(
  req:NextRequest
){

  try{


    const body =
      await req.json();



    const itemId =
      Number(body.itemId);



    const physicalQty =
      Number(body.physicalQty);




    const item =
      await prisma.stockOpnameItem.findUnique({

        where:{
          id:itemId
        }

      });





    if(!item){

      return NextResponse.json(
        {
          success:false,
          message:"Item tidak ditemukan"
        },
        {
          status:404
        }
      );

    }





    await prisma.stockOpnameItem.update({

      where:{
        id:itemId
      },


      data:{

        physicalQty,

        difference:
        physicalQty -
        item.systemQty

      }

    });





    return NextResponse.json({

      success:true,

      message:"Qty berhasil disimpan"

    });



  }catch(error){

    console.error(error);


    return NextResponse.json(
      {
        success:false,
        message:"Update qty gagal"
      },
      {
        status:500
      }
    );

  }

}







// =================================
// APPROVE STOCK OPNAME
// =================================


export async function POST(
  req:NextRequest,
  {
    params,
  }:{
    params:Promise<{
      id:string
    }>
  }
){


try{


const {id}=await params;


const opnameId =
Number(id);




const opname =
await prisma.stockOpname.findUnique({

where:{
 id:opnameId
},


include:{
 items:true
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





if(opname.status==="APPROVED"){

return NextResponse.json({

success:false,

message:"Stock Opname sudah approve"

});

}







await prisma.$transaction(async(tx)=>{



for(
const item of opname.items
){


const difference =
item.physicalQty -
item.systemQty;





if(difference !== 0){



// update stok barang

await tx.barang.update({

where:{
id:item.barangId
},


data:{

stock:item.physicalQty

}

});






// kartu stok

await tx.stockCard.create({

data:{


barangId:
item.barangId,


trxType:
"STOCK_OPNAME",


trxNumber:
opname.code,


qtyIn:
difference > 0
?
difference
:
0,


qtyOut:
difference < 0
?
Math.abs(difference)
:
0,


balance:
item.physicalQty,


note:
`Penyesuaian Stock Opname ${opname.code}`


}


});







// history opname

await tx.stockOpnameHistory.create({

data:{


opnameId:
opname.id,


barangId:
item.barangId,


systemQty:
item.systemQty,


physicalQty:
item.physicalQty,


difference,


createdBy:1


}


});



}



}





// update status opname


await tx.stockOpname.update({

where:{
id:opnameId
},


data:{


status:"APPROVED",


approvedBy:1


}

});







// history global ERP


await tx.history.create({

data:{


transactionType:
"STOCK_OPNAME",


referenceNumber:
opname.code,


description:
`Approve Stock Opname ${opname.code}`,


userId:1


}


});





});







return NextResponse.json({

success:true,

message:
"Stock Opname berhasil approve"

});






}catch(error){


console.error(
"APPROVE STOCK OPNAME ERROR",
error
);



return NextResponse.json(
{
success:false,
message:"Approve gagal"
},
{
status:500
}
);


}



}