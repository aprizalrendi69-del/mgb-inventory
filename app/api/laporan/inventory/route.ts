import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {

  try {

    const { searchParams } = new URL(req.url);

    const category = searchParams.get("category");

    const where: any = {};

    if (category) {

      where.category = category;

    }

    const data = await prisma.barang.findMany({

      where,

      orderBy: {

        name: "asc"

      }

    });

    const totalItem = data.length;

    let totalStock = 0;

    let totalAsset = 0;

    let lowStock = 0;

    data.forEach((item) => {

      totalStock += item.stock;

      totalAsset += item.stock * item.purchasePrice;

      if (item.stock <= item.minStock) {

        lowStock++;

      }

    });

    return NextResponse.json({

      success: true,

      totalItem,

      totalStock,

      totalAsset,

      lowStock,

      data

    });

  } catch (error) {

    console.log(error);

    return NextResponse.json({

      success: false,

      message: "Gagal mengambil laporan inventory"

    }, {

      status: 500

    });

  }

}