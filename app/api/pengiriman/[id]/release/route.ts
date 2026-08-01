import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function POST(
req: NextRequest,
context: any
){

try {


const { id } = await context.params;

const deliveryId = Number(id);



const result = await prisma.$transaction(async(tx)=>{


const delivery = await tx.delivery.findUnique({

where:{
id:deliveryId
},

include:{
items:{
include:{
barang:true
}
}
}

});



if(!delivery){

throw new Error("Delivery tidak ditemukan");

}



if(delivery.status !== "DRAFT"){

throw new Error("Delivery sudah diproses");

}




for(const item of delivery.items){


const barang = await tx.barang.findUnique({

where:{
id:item.barangId
}

});


if(!barang){

throw new Error(
`Barang ${item.barangId} tidak ditemukan`
);

}



if(barang.stock < item.qty){

throw new Error(
`Stock ${barang.name} tidak cukup`
);

}



const newStock =
barang.stock - item.qty;



await tx.barang.update({

where:{
id:item.barangId
},

data:{
stock:newStock
}

});



await tx.stockCard.create({

data:{


barangId:item.barangId,

trxType:"DELIVERY",

trxNumber:delivery.number,

referenceId:delivery.id,

qtyOut:item.qty,

balance:newStock,

unitPrice:barang.sellingPrice,

totalValue:item.qty * barang.sellingPrice,

note:"Pengiriman customer"


}

});


}



await tx.delivery.update({

where:{
id:deliveryId
},

data:{
status:"DELIVERED"
}

});



return delivery;


});



return NextResponse.json({

success:true,

message:"Pengiriman berhasil diproses",

data:result

});



}catch(error:any){


console.log("RELEASE DELIVERY ERROR",error);



return NextResponse.json({

success:false,

message:error.message

},
{
status:400
});


}

}