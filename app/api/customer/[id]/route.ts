import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;

    const customerId = Number(id);

    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId,
      },
    });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    await prisma.customer.delete({
      where: {
        id: customerId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Customer berhasil dihapus",
    });

  } catch (error: any) {

    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message:
          error.code === "P2003"
            ? "Customer masih digunakan pada transaksi Delivery."
            : "Gagal menghapus customer",
      },
      {
        status: 500,
      }
    );
  }
}