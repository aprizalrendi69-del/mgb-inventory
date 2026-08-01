import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(req:NextRequest){

try{


const {searchParams}=new URL(req.url);


const start = searchParams.get("start");
const end = searchParams.get("end");



const where:any={};


if(start && end){

where.deliveryDate={

gte:new Date(start),

lte:new Date(end+"T23:59:59")

};

}



const customers = await prisma.customer.findMany({

include:{

deliveries:{

where,

include:{

items:true

}

}

}

});



const data = customers.map((customer)=>{


let qty=0;

let nominal=0;



customer.deliveries.forEach((delivery)=>{


delivery.items.forEach((item)=>{


qty += item.qty;

nominal += item.subtotal;


});


});



return {

id:customer.id,

name:customer.name,

pic:customer.contactPerson ?? "-",

transaksi:customer.deliveries.length,

qty,

nominal

};


});



return NextResponse.json({

success:true,

data

});



}catch(error:any){


console.log(error);


return NextResponse.json({

success:false,

message:error.message

},

{
status:500
}

);


}

}