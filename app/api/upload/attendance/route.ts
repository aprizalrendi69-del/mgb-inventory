import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";


export async function POST(
  req:Request
){

try{


const formData =
await req.formData();



const file =
formData.get("file") as File;



if(!file){

return NextResponse.json({

success:false,

message:"File tidak ditemukan"

},{
status:400
});

}




const bytes =
await file.arrayBuffer();


const buffer =
Buffer.from(bytes);




const filename =
`${Date.now()}-${file.name.replace(/\s/g,"-")}`;





const uploadDir =
path.join(
process.cwd(),
"public",
"uploads",
"attendance"
);





await fs.mkdir(
uploadDir,
{
recursive:true
}
);





const filepath =
path.join(
uploadDir,
filename
);





await fs.writeFile(
filepath,
buffer
);





const photoUrl =
`/uploads/attendance/${filename}`;





return NextResponse.json({

success:true,

photo:photoUrl

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