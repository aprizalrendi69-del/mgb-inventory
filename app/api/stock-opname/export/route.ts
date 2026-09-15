import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";


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





const workbook =
new ExcelJS.Workbook();


const sheet =
workbook.addWorksheet(
"Stock Opname"
);



sheet.columns=[

{
 header:"Kode",
 key:"code",
 width:15
},

{
 header:"Nama Barang",
 key:"name",
 width:30
},

{
 header:"Stock Sistem",
 key:"system",
 width:15
},

{
 header:"Stock Fisik",
 key:"physical",
 width:15
},

{
 header:"Selisih",
 key:"difference",
 width:15
}

];





opname.items.forEach(
(item)=>{


sheet.addRow({

code:
item.barang.code,

name:
item.barang.name,

system:
item.systemQty,

physical:
item.physicalQty,

difference:
item.difference


});


}

);




const buffer =
await workbook.xlsx.writeBuffer();



return new NextResponse(
buffer,
{

headers:{

"Content-Type":
"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

"Content-Disposition":
`attachment; filename=stock-opname-${opname.code}.xlsx`

}

}
);



}catch(error){


console.error(error);


return NextResponse.json(
{
message:"Gagal export"
},
{
status:500
}
);


}


}