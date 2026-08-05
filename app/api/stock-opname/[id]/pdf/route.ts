import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import PDFDocument from "pdfkit";


export async function GET(
  req:NextRequest,
  {
    params
  }:{
    params:{
      id:string
    }
  }
){

try{


const id =
Number(params.id);



const opname =
await prisma.stockOpname.findUnique({

where:{
 id
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
new PDFDocument({
 size:"A4",
 margin:40
});



const chunks:any[]=[];



doc.on(
"data",
(chunk)=>chunks.push(chunk)
);



const bufferPromise =
new Promise<Buffer>(
(resolve)=>{

doc.on(
"end",
()=>{

resolve(
Buffer.concat(chunks)
);

}

);

}

);





doc.fontSize(18)
.text(
"STOCK OPNAME",
{
align:"center"
}
);



doc.moveDown();



doc.fontSize(11)
.text(
`Nomor : ${opname.code}`
);



doc.text(
`Tanggal : ${
new Date(opname.date)
.toLocaleDateString("id-ID")
}`
);



doc.text(
`Status : ${opname.status}`
);



doc.moveDown();



doc.text(
"------------------------------------------------"
);



opname.items.forEach(
(item)=>{


doc.text(

`${item.barang.code} | ${item.barang.name}`

);


doc.text(

`Sistem : ${item.systemQty}   Fisik : ${item.physicalQty}   Selisih : ${item.difference}`

);



doc.moveDown(.5);


}

);



doc.moveDown();



doc.text(
"Mengetahui,"
);



doc.moveDown(2);



doc.text(
"____________________"
);



doc.end();




const buffer =
await bufferPromise;




return new NextResponse(
buffer,
{

headers:{

"Content-Type":
"application/pdf",

"Content-Disposition":
`inline; filename=stock-opname-${opname.code}.pdf`

}

}

);



}catch(error){


console.error(error);


return NextResponse.json(
{
message:"Gagal membuat PDF"
},
{
status:500
}
);


}

}