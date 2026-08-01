import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";



export async function GET(
req:NextRequest
){


try{


const {searchParams}=

new URL(req.url);



const type =
searchParams.get("type");





if(type==="stock"){



const stock =
await prisma.inventory.findMany({

include:{


barang:true


}

});



return NextResponse.json({

success:true,

data:stock

});


}







if(type==="barang-masuk"){



const masuk =
await prisma.receipt.findMany({

include:{


supplier:true,


items:{


include:{


barang:true


}


}


},


orderBy:{


receiptDate:"desc"


}


});



return NextResponse.json({

success:true,

data:masuk

});


}







if(type==="barang-keluar"){



const keluar =
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

data:keluar

});


}







if(type==="purchase"){



const purchase =
await prisma.purchase.findMany({

include:{


supplier:true,


items:true


},


orderBy:{


date:"desc"


}


});



return NextResponse.json({

success:true,

data:purchase

});


}






return NextResponse.json({

success:false,

message:"Jenis laporan tidak ditemukan"

});



}
catch(error){


console.log(error);



return NextResponse.json({

success:false,

message:"Gagal mengambil laporan"

},{
status:500
});


}


}