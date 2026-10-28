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