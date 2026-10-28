import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getCompanyPdfBrand } from "@/lib/company-pdf";


export async function GET(
  req:NextRequest,
  {
    params
  }:{
    params:Promise<{
      id:string
    }>
  }
){

try{


const {id} =
await params;


const opnameId =
Number(id);



const opname =
await prisma.stockOpname.findUnique({

where:{
 id:opnameId
},

include:{

items:{

include:{
barang:true
}

}

}

});





if(!opname){

return NextResponse.json(
{
message:"Data tidak ditemukan"
},
{
status:404
}
);

}





const doc =
new jsPDF();




const companyBrand = await getCompanyPdfBrand();
if (companyBrand.logoBuffer && companyBrand.logoFormat) {
  const dataUrl = `data:image/${companyBrand.logoFormat === "JPEG" ? "jpeg" : "png"};base64,${companyBrand.logoBuffer.toString("base64")}`;
  try { doc.addImage(dataUrl, companyBrand.logoFormat, 14, 10, 18, 18); } catch (error) { console.error("PDF_COMPANY_LOGO_ERROR", error); }
  doc.setFontSize(14);
  doc.text(companyBrand.name, 37, 18);
  if (companyBrand.address) { doc.setFontSize(7); doc.text(companyBrand.address, 37, 23); }
} else {
  doc.setFontSize(16);
  doc.text(companyBrand.name, 14, 20);
}



doc.setFontSize(12);

doc.text(
"STOCK OPNAME",
14,
30
);



doc.text(
`Kode : ${opname.code}`,
14,
40
);


doc.text(
`Tanggal : ${new Date(opname.date).toLocaleDateString("id-ID")}`,
14,
48
);



doc.text(
`Status : ${opname.status}`,
14,
56
);





const rows =
opname.items.map(
(item,index)=>[

index+1,

item.barang.code,

item.barang.name,

item.systemQty,

item.physicalQty,

item.physicalQty -
item.systemQty

]
);





autoTable(doc,{

startY:65,


head:[

[
"No",
"Kode",
"Barang",
"System",
"Fisik",
"Selisih"
]

],


body:rows


});






const pdf =
doc.output(
"arraybuffer"
);



return new NextResponse(
pdf,
{

headers:{

"Content-Type":
"application/pdf",


"Content-Disposition":
`attachment; filename=stock-opname-${opname.code}.pdf`

}

}

);




}catch(error){


console.error(
error
);


return NextResponse.json(
{
message:"Gagal export PDF"
},
{
status:500
}
);


}


}