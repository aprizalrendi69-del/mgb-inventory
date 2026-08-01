import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";


// GET USER

export async function GET(){

try{


const users = await prisma.user.findMany({

orderBy:{
id:"asc"
},

select:{
id:true,
username:true,
fullname:true,
role:true,
active:true
}

});


return NextResponse.json({

success:true,
data:users

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



// CREATE USER

export async function POST(
req:NextRequest
){

try{


const body = await req.json();


const {
username,
fullname,
password,
role
}=body;



if(
!username ||
!fullname ||
!password
){

return NextResponse.json({

success:false,
message:"Data belum lengkap"

},{
status:400
});

}



const exist =
await prisma.user.findUnique({

where:{
username
}

});


if(exist){

return NextResponse.json({

success:false,
message:"Username sudah ada"

},{
status:400
});

}



const hash =
await bcrypt.hash(
password,
10
);



const user =
await prisma.user.create({

data:{

username,

fullname,

password:hash,

role,

active:true

}

});



return NextResponse.json({

success:true,
data:user

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