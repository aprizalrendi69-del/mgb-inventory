import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const outlets = await prisma.outlet.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: outlets,
    });
  } catch (error) {
    console.error("GET OUTLET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil data outlet",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();
    const address = body.address
      ? String(body.address).trim()
      : null;
    const city = body.city
      ? String(body.city).trim()
      : null;
    const phone = body.phone
      ? String(body.phone).trim()
      : null;

    if (!code || !name) {
      return NextResponse.json(
        {
          success: false,
          message: "Kode dan nama outlet wajib diisi",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.outlet.findUnique({
      where: {
        code,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Kode outlet sudah digunakan",
        },
        { status: 400 }
      );
    }

    const outlet = await prisma.outlet.create({
      data: {
        code,
        name,
        address,
        city,
        phone,
      },
    });

    return NextResponse.json({
      success: true,
      data: outlet,
    });
  } catch (error) {
    console.error("CREATE OUTLET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal membuat outlet",
      },
      { status: 500 }
    );
  }
}