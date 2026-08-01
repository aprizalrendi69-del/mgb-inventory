import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function POST(req:Request){

try{


const body = await req.json();


const {
 employeeId,
 type,
 photo,
 note,
 latitude,
 longitude
}=body;



if(!employeeId){

return NextResponse.json({

success:false,

message:"Pegawai belum dipilih"

},{
status:400
});

}




const employee = await prisma.employee.findUnique({

where:{
id:Number(employeeId)
}

});



if(!employee){

return NextResponse.json({

success:false,

message:"Pegawai tidak ditemukan"

},{
status:404
});

}





// =================
// CHECK IN
// =================

if(type==="IN"){



const start = new Date();

start.setHours(0,0,0,0);



const end = new Date();

end.setHours(23,59,59,999);



const exist = await prisma.attendance.findFirst({

where:{

employeeId:Number(employeeId),

checkIn:{
gte:start,
lte:end
}

}

});



if(exist){

return NextResponse.json({

success:false,

message:"Sudah melakukan Check In hari ini"

},{
status:400
});

}





const attendance = await prisma.attendance.create({

data:{


employeeId:Number(employeeId),

photo:photo || null,

note:note || null,

latitude:Number(latitude) || null,

longitude:Number(longitude) || null,


}

});



return NextResponse.json({

success:true,

message:"Check In berhasil",

data:attendance

});



}





// =================
// CHECK OUT
// =================

if(type==="OUT"){



const today = new Date();

today.setHours(0,0,0,0);



const attendance = await prisma.attendance.findFirst({

where:{

employeeId:Number(employeeId),

checkIn:{
gte:today
}

},

orderBy:{

checkIn:"desc"

}

});



if(!attendance){

return NextResponse.json({

success:false,

message:"Belum Check In hari ini"

},{
status:400
});

}




const update = await prisma.attendance.update({

where:{
id:attendance.id
},

data:{

checkOut:new Date()

}

});




return NextResponse.json({

success:true,

message:"Check Out berhasil",

data:update

});



}



return NextResponse.json({

success:false,

message:"Tipe absensi tidak valid"

},{
status:400
});



}catch(error:any){


console.log(error);



return NextResponse.json({

success:false,

message:error.message

},{
status:500
});

}


}