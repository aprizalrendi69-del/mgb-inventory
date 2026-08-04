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
  } catch (error) {
    console.log(error);

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

    if (!body.code)
      return NextResponse.json({
        success: false,
        message: "Kode barang wajib diisi",
      });

    if (!body.name)
      return NextResponse.json({
        success: false,
        message: "Nama barang wajib diisi",
      });

    if (!body.unit)
      return NextResponse.json({
        success: false,
        message: "Satuan wajib diisi",
      });

    const cekKode = await prisma.barang.findUnique({
      where: {
        code: body.code,
      },
    });

    if (cekKode) {
      return NextResponse.json({
        success: false,
        message: "Kode barang sudah digunakan",
      });
    }

    const barcode =
      body.barcode && body.barcode !== ""
        ? body.barcode
        : `MGB-${body.code}`;

    const cekBarcode = await prisma.barang.findFirst({
      where: {
        barcode,
      },
    });

    if (cekBarcode) {
      return NextResponse.json({
        success: false,
        message: "Barcode sudah digunakan",
      });
    }

    const barang = await prisma.barang.create({
      data: {
        code: body.code,
        barcode,

        name: body.name,

        category: body.category || null,

        brand: body.brand || null,

        unit: body.unit,

        minimumStock: Number(body.minimumStock || 0),

        stock: 0,

        purchasePrice: Number(body.purchasePrice || 0),

        sellingPrice: Number(body.sellingPrice || 0),

        hasExpired: Boolean(body.hasExpired),

        active: true,

        expiredWarning: 30,
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