import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function POST(
 req:NextRequest
){

try{


const body =
await req.json();



const {
 customerId,
 note,
 items
}=body;




if(
!customerId ||
!items ||
items.length===0
){

return NextResponse.json({

success:false,

message:"Data tidak lengkap"

},{
status:400
});

}




const result =
await prisma.$transaction(
async(tx)=>{



// nomor delivery

const count =
await tx.delivery.count();



const number =
`DO-${String(count+1).padStart(5,"0")}`;



let totalQty = 0;



const delivery =
await tx.delivery.create({

data:{


number,


customerId:Number(customerId),


status:"DELIVERED",


remarks:note,


totalQty:0


}

});





for(
const item of items
){



const barang =
await tx.barang.findUnique({

where:{
id:item.barangId
}

});



if(!barang){

throw new Error(
"Barang tidak ditemukan"
);

}





if(
barang.stock < item.qty
){

throw new Error(

`Stock ${barang.name} tidak cukup`

);

}




const before =
barang.stock;



const after =
before - item.qty;




// kurangi stock

await tx.barang.update({

where:{
id:barang.id
},

data:{

stock:after

}

});





// delivery item

await tx.deliveryItem.create({

data:{


deliveryId:
delivery.id,


barangId:
barang.id,


qty:item.qty,


price:
barang.sellingPrice,


subtotal:
barang.sellingPrice *
item.qty


}

});





// inventory

await tx.inventory.upsert({

where:{
barangId:barang.id
},

update:{

stock:after,

availableStock:after

},

create:{


barangId:
barang.id,


stock:after,


availableStock:after,


minimumStock:
barang.minimumStock


}

});






// stock card

await tx.stockCard.create({

data:{


barangId:
barang.id,


trxType:
"OUT",


trxNumber:
number,


qtyIn:0,


qtyOut:
item.qty,


balance:
after,


unitPrice:
barang.sellingPrice,


totalValue:
barang.sellingPrice *
item.qty,


note:
note || "Barang Keluar"


}

});





// stock mutation

await tx.stockMutation.create({

data:{


barangId:
barang.id,


type:
"OUT",


qty:
item.qty,


stockBefore:
before,


stockAfter:
after,


reference:
number,


description:
"Barang Keluar"


}

});





totalQty += item.qty;



}





await tx.delivery.update({

where:{
id:delivery.id
},

data:{

totalQty

}

});





// history

await tx.history.create({

data:{


transactionType:
"DELIVERY",


referenceNumber:
number,


description:
`Barang keluar ${number}`


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




}catch(error:any){


console.error(error);



return NextResponse.json({

success:false,

message:
error.message ||
"Server error"

},{
status:500
});

}



}