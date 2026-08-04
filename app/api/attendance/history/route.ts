import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(req:Request){

try{


const {searchParams} =
new URL(req.url);



const employeeId =
searchParams.get("employeeId");


const startDate =
searchParams.get("start");


const endDate =
searchParams.get("end");





const data =
await prisma.attendance.findMany({

where:{


...(employeeId && {

employeeId:Number(employeeId)

}),



...(startDate && endDate && {

date:{

gte:new Date(startDate),

lte:new Date(
endDate+"T23:59:59"
)

}

})


},


include:{


employee:{


select:{


nik:true,

name:true,

department:true,

position:true


}


}


},



orderBy:{


date:"desc"


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