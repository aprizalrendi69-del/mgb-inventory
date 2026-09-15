import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{
      barcode: string;
    }>;
  }
) {
  try {
    const { barcode } = await context.params;

    if (!barcode) {
      return NextResponse.json(
        {
          success: false,
          message: "Barcode kosong",
        },
        { status: 400 }
      );
    }

    const decodedBarcode = decodeURIComponent(barcode);

    /*
     * FORMAT BARCODE BATCH
     *
     * MGB|358|BVG026|GR-1786280838834|2027-05-31T00:00:00.000Z
     *
     * 0 = prefix
     * 1 = barangId
     * 2 = kode barang
     * 3 = batch number
     * 4 = expired date
     */
    if (decodedBarcode.startsWith("MGB|")) {
      const parts = decodedBarcode.split("|");

      if (parts.length >= 5) {
        const barangId = Number(parts[1]);
        const kodeBarang = parts[2];
        const batchNumber = parts[3];
        const expiredDate = parts.slice(4).join("|");

        if (!Number.isNaN(barangId)) {
          const barang = await prisma.barang.findUnique({
            where: {
              id: barangId,
            },
          });

          if (barang) {
            return NextResponse.json({
              success: true,
              type: "BATCH",
              data: {
                ...barang,
                batchNumber,
                expiredDate,
                barcode: decodedBarcode,
                kodeBarang,
              },
            });
          }
        }

        /*
         * Fallback kalau barangId tidak ditemukan:
         * cari berdasarkan kode barang.
         */
        if (kodeBarang) {
          const barang = await prisma.barang.findUnique({
            where: {
              code: kodeBarang,
            },
          });

          if (barang) {
            return NextResponse.json({
              success: true,
              type: "BATCH",
              data: {
                ...barang,
                batchNumber,
                expiredDate,
                barcode: decodedBarcode,
                kodeBarang,
              },
            });
          }
        }
      }
    }

    /*
     * BARCODE BARANG BIASA
     */
    const barang = await prisma.barang.findUnique({
      where: {
        barcode: decodedBarcode,
      },
    });

    if (!barang) {
      return NextResponse.json(
        {
          success: false,
          message: "Barang tidak ditemukan",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      type: "BARANG",
      data: barang,
    });
  } catch (error) {
    console.error("GET /api/barang/barcode/[barcode] ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Server error",
      },
      { status: 500 }
    );
  }
}