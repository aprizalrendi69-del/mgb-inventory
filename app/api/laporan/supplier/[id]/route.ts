import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;

    const supplier = await prisma.supplier.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!supplier) {
      return NextResponse.json({
        success: false,
        message: "Supplier tidak ditemukan",
      });
    }

    const purchases = await prisma.purchase.findMany({
      where: {
        supplierId: Number(id),
      },
      include: {
        items: {
          include: {
            barang: true,
          },
        },
      },
      orderBy: {
        purchaseDate: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      supplier,
      purchases,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan",
      },
      {
        status: 500,
      }
    );
  }
}