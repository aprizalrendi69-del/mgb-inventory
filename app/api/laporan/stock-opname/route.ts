import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(){


try{


const data =
await prisma.stockOpname.findMany({

orderBy:{
id:"desc"
},


include:{


items:true


}


});





const result =
data.map(item=>{


let totalDifference=0;


item.items.forEach(x=>{


totalDifference += Math.abs(

x.physicalQty -
x.systemQty

);


});




return {

id:item.id,

code:item.code,

date:item.date,

status:item.status,

totalItem:item.items.length,

totalDifference


};


});





return NextResponse.json({

success:true,

data:result


});




}catch(error){


console.error(error);



return NextResponse.json({

success:false,

message:"Gagal mengambil laporan"

},

{
status:500
}

);


}


}