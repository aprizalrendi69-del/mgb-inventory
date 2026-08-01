import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";



export async function GET(){


try{


const data =
await prisma.delivery.findMany({

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



return NextResponse.json({

success:true,

data:data

});


}
catch(error){


return NextResponse.json({

success:false,

message:
"Gagal mengambil data"

},{
status:500
});


}


}