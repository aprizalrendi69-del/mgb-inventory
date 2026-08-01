import {NextRequest,NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";


export async function POST(
req:NextRequest,
context:{
params:Promise<{id:string}>
}
){


try{


const {id}=await context.params;


const opnameId =
Number(id);



const opname =
await prisma.stockOpname.findUnique({

where:{
id:opnameId
},

include:{

items:true

}

});



if(!opname){

return NextResponse.json({

success:false,

message:"Stock Opname tidak ditemukan"

},{
status:404
});

}




const adjustmentItems =

opname.items

.filter(
(item:any)=>
item.difference !== 0
)

.map(
(item:any)=>({

barangId:item.barangId,

qty:Math.abs(item.difference)

})
);





if(adjustmentItems.length===0){


return NextResponse.json({

success:false,

message:
"Tidak ada selisih stock"

});

}




const type =

opname.items.some(
(item:any)=>
item.difference > 0
)

?

"PLUS"

:

"MINUS";






const adjustment =

await prisma.adjustment.create({

data:{


number:
"ADJ-" + Date.now(),


type:type,


reason:
"Selisih hasil Stock Opname",


items:{
create:adjustmentItems
}


},


include:{
items:true
}

});





return NextResponse.json({

success:true,

data:adjustment,

message:
"Adjustment berhasil dibuat"

});




}
catch(error){


console.log(error);


return NextResponse.json({

success:false,

message:
"Gagal membuat adjustment"

},{
status:500
});


}


}