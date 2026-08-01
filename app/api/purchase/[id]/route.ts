import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PurchaseStatus } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const purchase = await prisma.purchase.findUnique({
      where: {
        id: Number(id),
      },
      include: {
        supplier: true,
        items: {
          include: {
            barang: true,
          },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase Order tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,
      data: purchase,
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil data Purchase",
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

    const {
      supplierId,
      remarks,
      items,
    } = body;

    if (!supplierId) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Item Purchase kosong",
        },
        {
          status: 400,
        }
      );
    }

    const supplier = await prisma.supplier.findUnique({
      where: {
        id: Number(supplierId),
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

    const purchase = await prisma.purchase.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase Order tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (purchase.status !== PurchaseStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase yang sudah APPROVED tidak boleh diubah",
        },
        {
          status: 400,
        }
      );
    }

    let total = 0;

    for (const item of items) {

      if (
        !item.barangId ||
        Number(item.qty) <= 0 ||
        Number(item.price) <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Qty dan Harga harus lebih dari 0",
          },
          {
            status: 400,
          }
        );
      }

      const barang = await prisma.barang.findUnique({
        where: {
          id: Number(item.barangId),
        },
      });

      if (!barang) {
        return NextResponse.json(
          {
            success: false,
            message: `Barang ID ${item.barangId} tidak ditemukan`,
          },
          {
            status: 404,
          }
        );
      }

      total += Number(item.qty) * Number(item.price);

    }

    const result = await prisma.$transaction(async (tx) => {

      await tx.purchaseItem.deleteMany({
        where: {
          purchaseId: purchase.id,
        },
      });

      const update = await tx.purchase.update({
        where: {
          id: purchase.id,
        },
        data: {
          supplierId: Number(supplierId),
          remarks,
          total,
          items: {
            create: items.map((i: any) => ({
              barangId: Number(i.barangId),
              qty: Number(i.qty),
              price: Number(i.price),
              subtotal: Number(i.qty) * Number(i.price),
            })),
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              barang: true,
            },
          },
        },
      });

      await tx.history.create({
        data: {
          transactionType: "PURCHASE",
          referenceNumber: update.number,
          description:
            "Edit Purchase Order " + update.number,
        },
      });

      return update;

    });

    return NextResponse.json({
      success: true,
      message: "Purchase Order berhasil diubah",
      data: result,
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengubah Purchase Order",
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

    const purchase = await prisma.purchase.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase Order tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (purchase.status !== PurchaseStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase Order yang sudah diapprove tidak boleh dihapus",
        },
        {
          status: 400,
        }
      );
    }

    await prisma.$transaction(async (tx) => {

      await tx.purchaseItem.deleteMany({
        where: {
          purchaseId: purchase.id,
        },
      });

      await tx.purchase.delete({
        where: {
          id: purchase.id,
        },
      });

      await tx.history.create({
        data: {
          transactionType: "PURCHASE",
          referenceNumber: purchase.number,
          description:
            "Hapus Purchase Order " + purchase.number,
        },
      });

    });

    return NextResponse.json({
      success: true,
      message: "Purchase Order berhasil dihapus",
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal menghapus Purchase Order",
      },
      {
        status: 500,
      }
    );

  }
}