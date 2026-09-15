import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";


export async function POST(req: NextRequest) {

  try {

    console.log("========== LOGIN API ==========");

    const body = await req.json();

    const {
      username,
      password
    } = body;


    console.log("BODY:", body);


    const user = await prisma.user.findUnique({
      where:{
        username
      }
    });


    console.log("USER:", user);


    if(!user){

      return NextResponse.json({
        success:false,
        message:"Username tidak ditemukan"
      },{
        status:401
      });

    }


    if(!user.active){

      return NextResponse.json({
        success:false,
        message:"User tidak aktif"
      },{
        status:401
      });

    }


    const valid = await bcrypt.compare(
      password,
      user.password
    );


    console.log(
      "PASSWORD VALID:",
      valid
    );


    if(!valid){

      return NextResponse.json({
        success:false,
        message:"Password salah"
      },{
        status:401
      });

    }


    const response = NextResponse.json({

      success:true,

      user:{
        id:user.id,
        username:user.username,
        fullname:user.fullname,
        role:user.role
      }

    });


    // SESSION COOKIE
    response.cookies.set(
      "erp-session",
      JSON.stringify({
        id:user.id,
        username:user.username,
        role:user.role
      }),
      {
        httpOnly:true,
        secure:false,
        sameSite:"lax",
        path:"/",
        maxAge:60*60*24
      }
    );


    return response;


  } catch(error:any){

    console.log(
      "LOGIN ERROR:",
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