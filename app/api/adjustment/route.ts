import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";



export async function GET(){


try{


const data =
await prisma.adjustment.findMany({

include:{


items:{


include:{


barang:true


}


}


},


orderBy:{
   adjustmentDate:"desc"
}


});



return NextResponse.json({

success:true,

data:data

});


}
catch(error){


console.log(error);



return NextResponse.json({

success:false,

message:"Gagal mengambil adjustment"

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



const {


type,

reason,

items


}=body;





const adjustment =
await prisma.adjustment.create({

data:{


number:
"ADJ-" + Date.now(),


type:
difference > 0
?
"PLUS"
:
"MINUS",


reason:
"Selisih hasil Stock Opname",


note:
"Adjustment dari Stock Opname " + opname.number,


items:{
create:
adjustmentItems
}


},


include:{


items:true


}


});







for(
const item of items
){



if(type==="IN"){



await prisma.inventory.update({

where:{


barangId:
Number(item.barangId)

},


data:{


qty:{


increment:
Number(item.qty)


}


}


});



}





if(type==="OUT"){



await prisma.stock.update({

where:{


barangId:
Number(item.barangId)

},


data:{


qty:{


decrement:
Number(item.qty)


}


}


});



}





await prisma.stockCard.create({

data:{


barangId:
Number(item.barangId),


type:
type==="IN"
?
"IN"
:
"OUT",


qty:
Number(item.qty),


reference:
`ADJUSTMENT-${adjustment.id}`


}


});





}



return NextResponse.json({

success:true,

data:adjustment,

message:
"Adjustment berhasil"

});




}
catch(error){


console.log(error);



return NextResponse.json({

success:false,

message:
"Gagal adjustment"

},{
status:500
});


}


}