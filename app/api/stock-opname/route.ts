import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";



export async function GET(){

try{


const data =
await prisma.stockOpname.findMany({

include:{

items:{
include:{
barang:true
}
}

},

orderBy:{
opnameDate:"desc"
}

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

message:"Gagal mengambil data opname"

},{
status:500
});


}

}






export async function POST(
req:NextRequest
){

try{


const body =
await req.json();




const opname =
await prisma.stockOpname.create({

data:{


number:
"OPN-" + Date.now(),



items:{


create:

await Promise.all(

body.items.map(
async(item:any)=>{


const barang =
await prisma.barang.findUnique({

where:{
id:Number(item.barangId)
}

});



return {


barangId:
Number(item.barangId),


systemQty:
barang?.stock ?? 0,


physicalQty:
Number(item.physicalQty),


difference:
Number(item.physicalQty)
-
Number(barang?.stock ?? 0)


};


}

)


)


}


},


include:{


items:true


}


});




return NextResponse.json({

success:true,

data:opname,

message:
"Stock Opname berhasil disimpan"

});


}
catch(error){


console.log(error);


return NextResponse.json({

success:false,

message:
"Gagal membuat opname"

},{
status:500
});


}


}