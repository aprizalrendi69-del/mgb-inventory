import {NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";

export async function POST(

req:Request,

{params}:{params:Promise<{id:string}>}

){

try{

const {id}=await params;

const purchase=await prisma.purchase.findUnique({

where:{

id:Number(id)

},

include:{

items:true

}

});

if(!purchase){

return NextResponse.json({

success:false

},{status:404});

}

await prisma.purchase.update({

where:{

id:purchase.id

},

data:{

status:"RECEIVED"

}

});

for(const item of purchase.items){

await prisma.barang.update({

where:{

id:item.barangId

},

data:{

stock:{

increment:item.qty

}

}

});

}

return NextResponse.json({

success:true

});

}catch(error){

console.log(error);

return NextResponse.json({

success:false

},{status:500});

}

}