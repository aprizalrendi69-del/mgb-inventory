import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const data = await prisma.purchase.findMany({
      include: {
        supplier: true,

        items: {
          include: {
            barang: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    const result = data.map((item) => ({
      id: item.id,
      number: item.number,
      date: item.createdAt,
      supplier: item.supplier?.name ?? "-",
      status: item.status,

      total: item.items.reduce(
        (sum, row) =>
          sum +
          Number(row.qty ?? 0) *
            Number(row.price ?? 0),
        0
      ),

      // =====================================================
      // DETAIL BARANG PO
      // =====================================================

      items: item.items.map((row) => ({
        id: row.id,

        barangId: row.barang?.id ?? null,

        kode:
          row.barang?.code ??
          row.barang?.kode ??
          "-",

        nama:
          row.barang?.name ??
          row.barang?.nama ??
          "-",

        satuan:
          row.barang?.satuan ??
          row.barang?.unit ??
          "-",

        qty: Number(row.qty ?? 0),

        harga: Number(row.price ?? 0),

        subtotal:
          Number(row.qty ?? 0) *
          Number(row.price ?? 0),
      })),
    }));

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "Gagal mengambil laporan purchase:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil laporan purchase",
      },
      {
        status: 500,
      }
    );
  }
}