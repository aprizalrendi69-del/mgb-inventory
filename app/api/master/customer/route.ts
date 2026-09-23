import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const data = await prisma.customer.findMany({
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
        message: "Gagal mengambil customer",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.code || !body.name) {
      return NextResponse.json(
        {
          success: false,
          message: "Kode dan Nama wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    const cek = await prisma.customer.findUnique({
      where: {
        code: body.code,
      },
    });

    if (cek) {
      return NextResponse.json(
        {
          success: false,
          message: "Kode customer sudah digunakan",
        },
        {
          status: 400,
        }
      );
    }

    const customer = await prisma.customer.create({
      data: {
        code: body.code,
        name: body.name,
        address: body.address || null,
        city: body.city || null,
        phone: body.phone || null,
        email: body.email || null,
        contactPerson: body.pic || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Customer berhasil disimpan",
      data: customer,
    });
  } catch (error) {
    console.error("CUSTOMER ERROR :", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan",
      },
      {
        status: 500,
      }
    );
  }
}