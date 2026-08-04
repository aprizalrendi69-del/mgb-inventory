import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";



export async function GET(){

try{


const data =
await prisma.employee.findMany({

orderBy:{
id:"desc"
}

});



return NextResponse.json({

success:true,

data

});



}catch(error:any){


return NextResponse.json({

success:false,

message:error.message

},{
status:500
});


}

}







export async function POST(
req:Request
){


try{


const body =
await req.json();



const employee =
await prisma.employee.create({

data:{


nik:body.nik,

name:body.name,

gender:body.gender || null,

position:body.position,

department:
body.department || null,

phone:
body.phone || null,

address:
body.address || null,


}


});




return NextResponse.json({

success:true,

message:"Karyawan berhasil ditambahkan",

data:employee

});



}catch(error:any){



return NextResponse.json({

success:false,

message:error.message

},{
status:500
});


}


}