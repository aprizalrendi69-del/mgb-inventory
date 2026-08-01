import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(

req:Request,

{params}:{params:{id:string}}

){

const data=

await prisma.purchase.update({

where:{

id:Number(params.id)

},

data:{

status:"APPROVED"

}

});

return NextResponse.json({

success:true,

data

});

}