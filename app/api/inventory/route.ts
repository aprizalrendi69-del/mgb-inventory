import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const barang = await prisma.barang.findMany({
      include: {
        inventory: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    const data = barang.map((item) => {
      const inventory = item.inventory;

      return {
        id: item.id,
        code: item.code,
        barcode: item.barcode,
        name: item.name,
        category: item.category,
        brand: item.brand,
        unit: item.unit,

        stock: item.stock,

        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice,

        warehouse: inventory?.warehouse ?? "MAIN",

        minimumStock:
          inventory?.minimumStock ?? item.minimumStock,

        maximumStock:
          inventory?.maximumStock ?? 0,

        availableStock:
          inventory?.availableStock ?? item.stock,

        reservedStock:
          inventory?.reservedStock ?? 0,

        averageCost:
          inventory?.averageCost ?? item.purchasePrice,

        lastPurchase:
          inventory?.lastPurchase ?? item.purchasePrice,

        active: item.active,

        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      total: data.length,
      data,
    });
  } catch (error) {
    console.error("Inventory API Error:", error);

    return NextResponse.json(
      {
        success: false,
        total: 0,
        data: [],
        message: "Gagal mengambil data inventory",
      },
      {
        status: 500,
      }
    );
  }
}