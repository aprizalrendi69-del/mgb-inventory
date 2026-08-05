import { NextRequest,NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";


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


const {id}=await params;


const opnameId=
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







const rows = [


[

"NO",

"KODE",

"BARANG",

"SYSTEM QTY",

"FISIK",

"SELISIH"

],



...opname.items.map(

(item,index)=>[


index+1,


item.barang.code,


item.barang.name,


item.systemQty,


item.physicalQty,


item.physicalQty -
item.systemQty



]


)


];







const sheet =
XLSX.utils.aoa_to_sheet(rows);



const workbook =
XLSX.utils.book_new();



XLSX.utils.book_append_sheet(

workbook,

sheet,

"Stock Opname"

);





const buffer =
XLSX.write(

workbook,

{

type:"buffer",

bookType:"xlsx"

}

);





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
message:"Gagal export Excel"
},

{
status:500
}

);


}


}