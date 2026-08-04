import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function POST(req:Request){

try{


const body =
await req.json();



const {
employeeId,
type,
photo,
note
}=body;




console.log(
"DATA ABSENSI MASUK:",
{
employeeId,
type,
photo
}
);





if(!employeeId){


return NextResponse.json({

success:false,

message:"Pegawai belum dipilih"

},{
status:400
});


}






if(
type !== "IN" &&
type !== "OUT"
){


return NextResponse.json({

success:false,

message:"Type absensi tidak valid"

},{
status:400
});


}






const employee =
await prisma.employee.findUnique({

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








const todayStart =
new Date();


todayStart.setHours(
0,
0,
0,
0
);



const todayEnd =
new Date();


todayEnd.setHours(
23,
59,
59,
999
);








// =================
// CHECK IN
// =================


if(type==="IN"){





const exist =
await prisma.attendance.findFirst({

where:{


employeeId:Number(employeeId),


date:{

gte:todayStart,

lte:todayEnd

}


}


});





if(exist){


return NextResponse.json({

success:false,

message:"Pegawai sudah Check In hari ini"

},{
status:400
});


}







const data = {


employeeId:Number(employeeId),


date:new Date(),


checkIn:new Date(),



photoIn:
photo
?
String(photo)
:
null,



note:
note
?
String(note)
:
null


};




console.log(
"SIMPAN CHECK IN:",
data
);






const attendance =
await prisma.attendance.create({

data

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





const attendance =
await prisma.attendance.findFirst({

where:{


employeeId:Number(employeeId),


date:{

gte:todayStart,

lte:todayEnd

},


checkOut:null


},


orderBy:{


id:"desc"


}


});






if(!attendance){


return NextResponse.json({

success:false,

message:
"Belum Check In atau sudah Check Out"

},{
status:400
});


}







const update =
await prisma.attendance.update({

where:{


id:attendance.id


},


data:{


checkOut:new Date(),



photoOut:
photo
?
String(photo)
:
null



}


});







console.log(
"SIMPAN CHECK OUT:",
update
);







return NextResponse.json({

success:true,

message:"Check Out berhasil",

data:update

});




}





return NextResponse.json({

success:false,

message:"Request tidak valid"

},{
status:400
});






}catch(error:any){



console.log(
"ERROR ATTENDANCE:",
error
);



return NextResponse.json({

success:false,

message:error.message

},{
status:500
});


}



}