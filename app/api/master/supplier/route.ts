import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    console.error(error);

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
        phone: body.phone,
      },
    });

    return NextResponse.json({
      success: true,
      data: supplier,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal menyimpan supplier",
      },
      {
        status: 500,
      }
    );
  }
}