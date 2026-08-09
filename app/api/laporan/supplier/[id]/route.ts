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

    const supplierId = Number(id);

    if (!Number.isInteger(supplierId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID supplier tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const supplier = await prisma.supplier.findUnique({
      where: {
        id: supplierId,
      },
    });

    if (!supplier) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    const { searchParams } = new URL(req.url);

    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: any = {
      supplierId,
    };

    // FILTER DARI TANGGAL
    if (from) {
      const fromDate = new Date(`${from}T00:00:00`);

      where.purchaseDate = {
        ...(where.purchaseDate || {}),
        gte: fromDate,
      };
    }

    // FILTER SAMPAI TANGGAL
    if (to) {
      const toDate = new Date(`${to}T23:59:59.999`);

      where.purchaseDate = {
        ...(where.purchaseDate || {}),
        lte: toDate,
      };
    }

    const purchases = await prisma.purchase.findMany({
      where,

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
    console.error("DETAIL SUPPLIER ERROR:", error);

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