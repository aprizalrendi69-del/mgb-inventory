import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(req:Request){

try{


const {searchParams}=new URL(req.url);


const month =
Number(searchParams.get("month"));


const year =
Number(searchParams.get("year"));



const start =
new Date(
year,
month-1,
1
);


const end =
new Date(
year,
month,
0,
23,
59,
59
);



const employees =
await prisma.employee.findMany({

where:{
active:true
},

include:{


attendances:{


where:{


date:{
gte:start,
lte:end
}


}


}


}


});





const data =
employees.map((e)=>{


const hadir =
e.attendances.length;


const selesai =
e.attendances.filter(
(a)=>a.checkOut
).length;


const belumPulang =
e.attendances.filter(
(a)=>!a.checkOut
).length;



return {

id:e.id,

nik:e.nik,

name:e.name,

department:e.department,

totalHadir:hadir,

totalSelesai:selesai,

totalBelumPulang:belumPulang


};


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