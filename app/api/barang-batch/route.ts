import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(){

try{

const data = await prisma.barangBatch.findMany({

include:{
barang:true
},

orderBy:{
expiredDate:"asc"
}

});


return NextResponse.json({

success:true,

data

});


}catch(error){

return NextResponse.json({

success:false,
message:"Gagal mengambil batch"

},{
status:500
});

}

}