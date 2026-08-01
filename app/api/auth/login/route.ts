import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {

    try{

        const {username,password}=await req.json();

        const user = await prisma.user.findUnique({

            where:{
                username
            }

        });

        if(!user){

            return NextResponse.json({

                success:false,
                message:"Username tidak ditemukan"

            });

        }

        const match = await bcrypt.compare(password,user.password);

        if(!match){

            return NextResponse.json({

                success:false,
                message:"Password salah"

            });

        }

        const token = jwt.sign(

            {

                id:user.id,
                username:user.username,
                role:user.role

            },

            process.env.JWT_SECRET!,

            {

                expiresIn:"1d"

            }

        );

        const response = NextResponse.json({

            success:true

        });

        response.cookies.set("token",token,{

            httpOnly:true,
            path:"/"

        });

        return response;

    }

    catch{

        return NextResponse.json({

            success:false,
            message:"Server Error"

        });

    }

}