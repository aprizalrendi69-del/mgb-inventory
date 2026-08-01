import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(
req:NextRequest,
context:{
 params:Promise<{id:string}>
}
){

try{


const {id}=await context.params;


const data =
await prisma.stockOpname.findUnique({

where:{
id:Number(id)
},

include:{

items:{
include:{
barang:true
}
}

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
message:"Gagal mengambil detail opname"

},{
status:500
});


}

}