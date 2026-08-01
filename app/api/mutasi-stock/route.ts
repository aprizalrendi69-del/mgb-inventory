import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(){

try{


const data =
await prisma.stockMutation.findMany({

include:{
barang:true
},

orderBy:{
createdAt:"desc"
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
message:"Gagal mengambil mutasi"

},{
status:500
});


}

}