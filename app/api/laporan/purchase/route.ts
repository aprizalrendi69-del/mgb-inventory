import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(){

try{


const data = await prisma.purchase.findMany({

include:{
supplier:true,
items:{
include:{
barang:true
}
}
},

orderBy:{
createdAt:"desc"
}

});



const result=data.map((item)=>({


id:item.id,

number:item.number,

date:item.createdAt,

supplier:item.supplier?.name ?? "-",


status:item.status,


total:item.items.reduce(
(sum,row)=>
sum + ((row.qty ?? 0) * (row.price ?? 0)),
0
)


}));



return NextResponse.json({

success:true,

data:result

});


}catch(error){

console.log(error);


return NextResponse.json({

success:false,

message:"Gagal mengambil laporan purchase"

},
{
status:500
});

}

}