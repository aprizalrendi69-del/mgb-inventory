import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { PurchaseStatus } from "@prisma/client";

export async function POST(
  req: Request,
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
          message: "Purchase Order sudah diapprove",
        },
        {
          status: 400,
        }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const approve = await tx.purchase.update({
        where: {
          id: purchase.id,
        },
        data: {
          status: PurchaseStatus.APPROVED,
        },
      });

      await tx.history.create({
        data: {
          transactionType: "PURCHASE",
          referenceNumber: purchase.number,
          description: `Approve Purchase Order ${purchase.number} - ${purchase.supplier.name}`,
        },
      });

      return approve;
    });

    return NextResponse.json({
      success: true,
      message: "Purchase Order berhasil diapprove",
      data: result,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Approve gagal",
      },
      {
        status: 500,
      }
    );
  }
}