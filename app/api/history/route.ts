import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";



export async function GET(){


try{


const data =
await prisma.history.findMany({

include:{


user:true


},


orderBy:{


createdAt:"desc"


}


});



return NextResponse.json({

success:true,

data:data

});


}
catch(error){


console.log(error);



return NextResponse.json({

success:false,

message:"Gagal mengambil history"

},{
status:500
});


}


}