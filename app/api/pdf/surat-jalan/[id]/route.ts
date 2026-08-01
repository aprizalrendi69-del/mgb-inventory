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



const delivery =
await prisma.delivery.findUnique({

where:{

id:Number(id)

},


include:{


customer:true,


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



const pdf =
new Promise(
resolve=>{


doc.on(
"end",
()=>{

resolve(
Buffer.concat(buffers)
)

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
"SURAT JALAN",
{
align:"center"
}
);



doc.moveDown();



doc.fontSize(11)
.text(
`Nomor : ${delivery?.number}`
);



doc.text(
`Customer : ${delivery?.customer.name}`
);



doc.moveDown();



delivery?.items.forEach(

(item:any,index)=>{


doc.text(

`${index+1}. ${item.barang.name} Qty ${item.qty}`

);


}

);



doc.end();


}

);



return new Response(
await pdf as any,
{

headers:{

"Content-Type":
"application/pdf",

"Content-Disposition":
"inline; filename=surat-jalan.pdf"

}

}

);


}