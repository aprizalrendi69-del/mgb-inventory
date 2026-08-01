import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search") || "";

    const category = searchParams.get("category") || "";

    const data = await prisma.barang.findMany({
      where: {
        AND: [
          search
            ? {
                OR: [
                  {
                    code: {
                      contains: search,
                    },
                  },
                  {
                    name: {
                      contains: search,
                    },
                  },
                ],
              }
            : {},

          category
            ? {
                category,
              }
            : {},
        ],
      },

      orderBy: {
        id: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil data barang",
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

    const barang = await prisma.barang.create({
      data: {
        code: body.code,
        barcode: body.barcode,
        name: body.name,
        category: body.category,
        unit: body.unit,
        minStock: Number(body.minStock),
        purchasePrice: Number(body.purchasePrice),
        sellingPrice: Number(body.sellingPrice),
      },
    });

    return NextResponse.json({
      success: true,
      data: barang,
    });
  } catch (err: any) {
    console.log(err);

    return NextResponse.json(
      {
        success: false,
        message: err.message,
      },
      {
        status: 500,
      }
    );
  }
}