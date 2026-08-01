import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(
req: Request,
{ params }: { params: Promise<{ id:string }> }
){

try{


const {id} = await params;


const customerId = Number(id);



if(!customerId){

return NextResponse.json({

success:false,

message:"ID customer tidak ditemukan"

});

}



const {searchParams}=new URL(req.url);


const start = searchParams.get("start");
const end = searchParams.get("end");



const where:any={

customerId: customerId

};



if(start && end){

where.deliveryDate={

gte:new Date(start),

lte:new Date(end+"T23:59:59")

};

}



const deliveries = await prisma.delivery.findMany({

where:where,

include:{

customer:true,

items:{

include:{

barang:true

}

}

},

orderBy:{

deliveryDate:"desc"

}

});



if(deliveries.length===0){

return NextResponse.json({

success:false,

message:"Belum ada transaksi"

});

}



let qty=0;
let nominal=0;


deliveries.forEach((d:any)=>{

d.items.forEach((i:any)=>{

qty += i.qty;

nominal += i.subtotal;

});

});



return NextResponse.json({

success:true,

data:{

customer:deliveries[0].customer,

deliveries,

summary:{

transaksi:deliveries.length,

qty,

nominal

}

}

});



}catch(error:any){


console.log(error);


return NextResponse.json({

success:false,

message:error.message

},

{
status:500
});


}


}