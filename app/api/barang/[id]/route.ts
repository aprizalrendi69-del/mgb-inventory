import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const barang = await prisma.barang.findUnique({
      where: {
        id: Number(id),
      },
      include: {
        inventory: true,
      },
    });

    if (!barang) {
      return NextResponse.json(
        {
          success: false,
          message: "Barang tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,
      data: barang,
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {

  try {

    const { id } = await params;

    const body = await req.json();

    const barang = await prisma.$transaction(async (tx) => {

      const updateBarang = await tx.barang.update({

        where: {
          id: Number(id),
        },

        data: {

          code: body.code,

          barcode: body.barcode || null,

          name: body.name,

          category: body.category || null,

          unit: body.unit,

          minimumStock: Number(body.minStock ?? 0),

          purchasePrice: Number(body.purchasePrice ?? 0),

          sellingPrice: Number(body.sellingPrice ?? 0),

        },

      });

      const inventory = await tx.inventory.findUnique({

        where: {

          barangId: Number(id),

        },

      });

      if (inventory) {

        await tx.inventory.update({

          where: {

            barangId: Number(id),

          },

          data: {

            minimumStock: Number(body.minStock ?? 0),

          },

        });

      } else {

        await tx.inventory.create({

          data: {

            barangId: Number(id),

            warehouse: "MAIN",

            stock: updateBarang.stock,

            availableStock: updateBarang.stock,

            reservedStock: 0,

            minimumStock: Number(body.minStock ?? 0),

            maximumStock: 0,

            lastPurchase: Number(body.purchasePrice ?? 0),

            averageCost: Number(body.purchasePrice ?? 0),

          },

        });

      }

      await tx.history.create({

        data: {

          transactionType: "STOCK_IN",

          referenceNumber: updateBarang.code,

          description:
            "Edit Master Barang " + updateBarang.name,

        },

      });

      return updateBarang;

    });

    return NextResponse.json({

      success: true,

      data: barang,

    });

  } catch (error) {

    console.log(error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal update barang",
      },
      {
        status: 500,
      }
    );

  }

}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {

  try {

    const { id } = await params;

    const barang = await prisma.$transaction(async (tx) => {

      const item = await tx.barang.update({

        where: {

          id: Number(id),

        },

        data: {

          active: false,

        },

      });

      await tx.history.create({

        data: {

          transactionType: "STOCK_OUT",

          referenceNumber: item.code,

          description:
            "Nonaktif Master Barang " + item.name,

        },

      });

      return item;

    });

    return NextResponse.json({

      success: true,

      data: barang,

    });

  } catch (error) {

    console.log(error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal menghapus barang",
      },
      {
        status: 500,
      }
    );

  }

}