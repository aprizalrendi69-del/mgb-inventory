import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(
req: NextRequest,
context: any
){

try {


const { id } = await context.params;

const pengirimanId = Number(id);



const data = await prisma.delivery.findUnique({

where:{
id: pengirimanId
},

include:{

customer:true,

items:{
include:{
barang:true
}
}

}

});



if(!data){

return NextResponse.json(
{
success:false,
message:"Data pengiriman tidak ditemukan"
},
{
status:404
}
);

}



return NextResponse.json({

success:true,

data

});



}catch(error){

console.log("DETAIL PENGIRIMAN ERROR",error);


return NextResponse.json(
{
success:false,
message:"Gagal mengambil detail pengiriman"
},
{
status:500
}
);


}

}