import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const data = await prisma.supplier.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.log(error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil supplier",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const supplier = await prisma.supplier.create({
      data: {
        code: body.code,
        name: body.name,
        address: body.address,
        city: body.city,
        phone: body.phone,
        email: body.email,
        contactPerson: body.contactPerson,
      },
    });

    return NextResponse.json({
      success: true,
      data: supplier,
    });
  } catch (error) {
    console.log(error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal menambah supplier",
      },
      {
        status: 500,
      }
    );
  }
}