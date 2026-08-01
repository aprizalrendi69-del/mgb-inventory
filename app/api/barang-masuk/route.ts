import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(){

try{


const receipts = await prisma.receipt.findMany({

orderBy:{
createdAt:"desc"
},

include:{

supplier:true,

purchase:true,

items:{

include:{

barang:true

}

}

}

});



const data = receipts.map((receipt,index)=>{


const jumlahItem = receipt.items.reduce(
(total,item)=> total + item.qty,
0
);



return {

id:receipt.id,

no:index+1,


tanggal:receipt.receiptDate,


noPO:receipt.purchase?.number ?? "-",


supplier:receipt.supplier?.name ?? "-",


jumlahItem,


items:receipt.items.map(item=>({


barang:item.barang.name,


qty:item.qty,


harga:item.price


}))


};


});



return NextResponse.json({

success:true,

data


});


}
catch(error){


console.log(error);


return NextResponse.json({

success:false,

message:"Gagal mengambil barang masuk"

},{
status:500
});


}

}