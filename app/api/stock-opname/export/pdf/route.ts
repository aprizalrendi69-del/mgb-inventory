import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


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



const doc =
new jsPDF();



doc.text(
"STOCK OPNAME",
14,
15
);



doc.text(
`Nomor : ${opname.number}`,
14,
25
);


autoTable(doc,{

startY:35,

head:[[
"No",
"Barang",
"Stock Sistem",
"Stock Fisik",
"Selisih"
]],


body:

opname.items.map(
(item,index)=>[

index+1,

item.barang.name,

item.systemQty,

item.physicalQty,

item.difference

]

)

});



const pdf =
doc.output("arraybuffer");


return new Response(pdf,{

headers:{

"Content-Type":
"application/pdf",

"Content-Disposition":
`attachment; filename=stock-opname-${id}.pdf`

}

});


}