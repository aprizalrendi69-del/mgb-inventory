import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPDF } from "@/lib/pdf";



export async function GET(

req:NextRequest,

context:{
params:Promise<{
id:string
}>
}

){


const {id} =
await context.params;



const purchase =
await prisma.purchase.findUnique({

where:{

id:Number(id)

},

include:{


supplier:true,


items:{


include:{


barang:true


}


}


}


});





const doc =
createPDF();



const buffers:any[]=[];



doc.on(
"data",
(chunk)=>buffers.push(chunk)
);



const result =
new Promise(
async(resolve)=>{


doc.on(
"end",
()=>{

resolve(
Buffer.concat(buffers)
);

}

);



doc.fontSize(18)
.text(
"PT. MITRA GARAM BOGATAMA",
{
align:"center"
}
);



doc.moveDown();



doc.fontSize(14)
.text(
"PURCHASE ORDER",
{
align:"center"
}
);



doc.moveDown();



doc.fontSize(11)
.text(
`Nomor PO : ${purchase?.number}`
);



doc.text(
`Supplier : ${purchase?.supplier.name}`
);



doc.moveDown();



purchase?.items.forEach(

(item:any,index)=>{


doc.text(

`${index+1}. ${item.barang.name} - Qty ${item.qty}`

);


}

);



doc.end();


}

);



return new Response(
await result as any,
{

headers:{

"Content-Type":
"application/pdf",

"Content-Disposition":
"inline; filename=purchase-order.pdf"

}

}

);


}