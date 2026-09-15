import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";


export async function GET(req:NextRequest){


const id =
Number(
new URL(req.url).searchParams.get("id")
);



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

return new Response(
"Data tidak ditemukan",
{
status:404
}
);

}



const rows =
opname.items.map(
(item,index)=>({

No:index+1,

Barang:item.barang.name,

Stock_Sistem:item.systemQty,

Stock_Fisik:item.physicalQty,

Selisih:item.difference

})

);



const sheet =
XLSX.utils.json_to_sheet(rows);


const book =
XLSX.utils.book_new();


XLSX.utils.book_append_sheet(
book,
sheet,
"Stock Opname"
);



const buffer =
XLSX.write(
book,
{
type:"buffer",
bookType:"xlsx"
}
);



return new Response(buffer,{

headers:{

"Content-Type":
"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

"Content-Disposition":
`attachment; filename=stock-opname-${id}.xlsx`

}

});


}