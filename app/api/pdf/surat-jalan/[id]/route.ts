import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPDF } from "@/lib/pdf";
import { getCompanyPdfBrand } from "@/lib/company-pdf";



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



const companyBrand = await getCompanyPdfBrand();
if (companyBrand.logoBuffer && companyBrand.logoFormat) {
  try { doc.image(companyBrand.logoBuffer, 50, 35, { fit: [64, 64] }); } catch (error) { console.error("PDF_COMPANY_LOGO_ERROR", error); }
  doc.fontSize(16).text(companyBrand.name, 125, 40, { width: 390, align: "left" });
  if (companyBrand.address) doc.fontSize(8).text(companyBrand.address, 125, 61, { width: 390 });
  doc.y = 105;
} else {
  doc.fontSize(18).text(companyBrand.name, { align: "center" });
}




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