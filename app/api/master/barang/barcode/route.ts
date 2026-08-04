import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const ids = searchParams.get("ids");

    let barang;

    if (ids) {
      const idList = ids
        .split(",")
        .map((id) => Number(id))
        .filter((id) => !isNaN(id));

      barang = await prisma.barang.findMany({
        where: {
          id: {
            in: idList,
          },
        },
        orderBy: {
          code: "asc",
        },
      });
    } else {
      barang = await prisma.barang.findMany({
        orderBy: {
          code: "asc",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: barang,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: 500,
      }
    );
  }
}