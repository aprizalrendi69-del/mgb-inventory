import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;
    const outletId = Number(id);

    if (!outletId) {
      return NextResponse.json(
        {
          success: false,
          message: "ID outlet tidak valid",
        },
        { status: 400 }
      );
    }

    const body = await req.json();

    const {
      code,
      name,
      address,
      city,
      phone,
      active,
    } = body;

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
        id: outletId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet tidak ditemukan",
        },
        { status: 404 }
      );
    }

    const duplicate = await prisma.outlet.findFirst({
      where: {
        code,
        NOT: {
          id: outletId,
        },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          message: "Kode outlet sudah digunakan",
        },
        { status: 400 }
      );
    }

    const outlet = await prisma.outlet.update({
      where: {
        id: outletId,
      },
      data: {
        code,
        name,
        address: address || null,
        city: city || null,
        phone: phone || null,
        active:
          typeof active === "boolean"
            ? active
            : existing.active,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Outlet berhasil diperbarui",
      data: outlet,
    });
  } catch (error: any) {
    console.error("UPDATE OUTLET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal memperbarui outlet",
      },
      { status: 500 }
    );
  }
}