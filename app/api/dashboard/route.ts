import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const totalBarang = await prisma.barang.count();

    const totalSupplier = await prisma.supplier.count();

    const totalCustomer = await prisma.customer.count();

    const stock = await prisma.barang.aggregate({
      _sum: {
        stock: true,
      },
    });

    const totalStock = stock._sum.stock ?? 0;

    const limitStock = await prisma.barang.count({
      where: {
        stock: {
          lte: 5,
        },
      },
    });

    const barangSold = await prisma.deliveryItem.aggregate({
      _sum: {
        qty: true,
      },
    });

    const inventory = await prisma.barang.findMany();

    const totalAsset = inventory.reduce(
      (acc, item) =>
        acc + (item.stock ?? 0) * (item.purchasePrice ?? 0),
      0
    );

    // ==========================
    // AKTIVITAS
    // ==========================

    const history = await prisma.history.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
      include: {
        user: true,
      },
    });

    // ==========================
    // STOCK MINIMUM
    // ==========================

    const stockMinimum = await prisma.barang.findMany({
      where: {
        stock: {
          lte: 5,
        },
      },
      orderBy: {
        stock: "asc",
      },
      take: 10,
    });

    // ==========================
    // PURCHASE PENDING
    // ==========================

    const purchasePending = await prisma.purchase.findMany({
      where: {
        status: {
          not: "RECEIVED",
        },
      },
      include: {
        supplier: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    // ==========================
    // DELIVERY PENDING
    // ==========================

    const deliveryPending = await prisma.delivery.findMany({
      where: {
        status: {
          not: "DELIVERED",
        },
      },
      include: {
        customer: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    // ==========================
    // EXPIRED & WARNING
    // ==========================

    const today = new Date();

    const batches = await prisma.batchStock.findMany({
      where: {
        qty: {
          gt: 0,
        },
      },
      include: {
        barang: true,
      },
      orderBy: {
        expiredDate: "asc",
      },
    });

    const expired = batches
      .map((batch) => {
        const sisaHari = Math.ceil(
          (batch.expiredDate.getTime() - today.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        let status = "AMAN";

        if (sisaHari < 0) {
          status = "EXPIRED";
        } else if (
          sisaHari <= (batch.barang.expiredWarning ?? 30)
        ) {
          status = "WARNING";
        }

        return {
          id: batch.id,
          name: batch.barang.name,
          batch: batch.batchNumber,
          qty: batch.qty,
          expired: batch.expiredDate,
          sisaHari,
          status,
        };
      })
      .filter((x) => x.status !== "AMAN")
      .slice(0, 10);

    return NextResponse.json({
      success: true,

      totalBarang,

      totalSupplier,

      totalCustomer,

      totalStock,

      barangSold: barangSold._sum.qty ?? 0,

      limitStock,

      inventory: totalAsset,

      history,

      stockMinimum,

      purchasePending,

      deliveryPending,

      expired,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Dashboard Error",
        error: String(error),
      },
      {
        status: 500,
      }
    );
  }
}