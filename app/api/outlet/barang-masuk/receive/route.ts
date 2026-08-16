import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const purchaseId = Number(body.purchaseId);
    const remarks = body.remarks?.trim() || null;

    if (!purchaseId || Number.isNaN(purchaseId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase Outlet tidak valid",
        },
        { status: 400 }
      );
    }

    const purchase = await prisma.outletPurchase.findUnique({
      where: {
        id: purchaseId,
      },
      include: {
        outlet: true,
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
          message: "Purchase Outlet tidak ditemukan",
        },
        { status: 404 }
      );
    }

    if (purchase.status !== "APPROVED") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet harus berstatus APPROVED untuk diterima",
        },
        { status: 400 }
      );
    }

    if (purchase.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase Outlet tidak memiliki barang",
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const receiptNumber = `OR-${Date.now()}`;

      const receipt = await tx.outletReceipt.create({
        data: {
          number: receiptNumber,
          purchaseId: purchase.id,
          outletId: purchase.outletId,
          supplierId: purchase.supplierId,
          remarks,
          items: {
            create: purchase.items.map((item) => ({
              barangId: item.barangId,
              qty: item.qty,
              price: item.price,
              subtotal: item.qty * item.price,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      for (const item of purchase.items) {
        const currentStock = await tx.outletStock.findUnique({
          where: {
            outletId_barangId: {
              outletId: purchase.outletId,
              barangId: item.barangId,
            },
          },
        });

        const oldStock = currentStock?.stock || 0;
        const newStock = oldStock + item.qty;

        const oldAverageCost = currentStock?.averageCost || 0;

        const newAverageCost =
          newStock > 0
            ? ((oldStock * oldAverageCost) +
                (item.qty * item.price)) /
              newStock
            : item.price;

        await tx.outletStock.upsert({
          where: {
            outletId_barangId: {
              outletId: purchase.outletId,
              barangId: item.barangId,
            },
          },
          create: {
            outletId: purchase.outletId,
            barangId: item.barangId,
            stock: item.qty,
            minimumStock: item.barang.minimumStock,
            averageCost: item.price,
          },
          update: {
            stock: newStock,
            averageCost: newAverageCost,
          },
        });

        await tx.outletPurchaseItem.update({
          where: {
            id: item.id,
          },
          data: {
            receivedQty: item.qty,
          },
        });
      }

      const updatedPurchase =
        await tx.outletPurchase.update({
          where: {
            id: purchase.id,
          },
          data: {
            status: "RECEIVED",
          },
          include: {
            outlet: true,
            supplier: true,
            items: {
              include: {
                barang: true,
              },
            },
          },
        });

      return {
        receipt,
        purchase: updatedPurchase,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Barang outlet berhasil diterima",
      data: result,
    });
  } catch (error) {
    console.error(
      "RECEIVE OUTLET BARANG ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Gagal menerima barang outlet",
      },
      { status: 500 }
    );
  }
}