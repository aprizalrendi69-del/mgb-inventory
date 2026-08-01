import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";



export async function GET(
req:NextRequest
){


try{


const {searchParams} =
new URL(req.url);



const barangId =
searchParams.get("barangId");





const where:any = {};



if(barangId){


where.barangId =
Number(barangId);


}





const data =
await prisma.stockCard.findMany({

where,


include:{


barang:true


},


orderBy:{


createdAt:"asc"


}


});





let saldo = 0;



const result =
data.map(
(item:any)=>{


if(item.type==="IN"){


saldo += item.qty;


}
else{


saldo -= item.qty;


}



return {


...item,


saldo


};


}

);





return NextResponse.json({

success:true,

data:result

});



}
catch(error){


console.log(error);



return NextResponse.json({

success:false,

message:
"Gagal mengambil stock card"

},{
status:500
});


}



}