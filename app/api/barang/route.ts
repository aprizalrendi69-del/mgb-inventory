import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const data = await prisma.barang.findMany({
      where: {
        active: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (e) {
    console.error(e);

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("DATA BARANG MASUK:", body);

    if (!body.code?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Kode Barang wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    if (!body.name?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Nama Barang wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    if (!body.unit?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Satuan wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    const cek = await prisma.barang.findFirst({
      where: {
        code: body.code.trim(),
      },
    });

    if (cek) {
      return NextResponse.json(
        {
          success: false,
          message: "Kode Barang sudah digunakan",
        },
        {
          status: 400,
        }
      );
    }

    const conversionRate =
      Number(body.conversionRate ?? 1) || 1;

    if (conversionRate <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Konversi harus lebih besar dari 0",
        },
        {
          status: 400,
        }
      );
    }

    const barang = await prisma.$transaction(async (tx) => {
      const item = await tx.barang.create({
        data: {
          code: body.code.trim(),

          barcode:
            body.barcode?.trim() || null,

          name: body.name.trim(),

          category:
            body.category?.trim() || null,

          brand: null,

          // SATUAN TRANSAKSI
          unit: body.unit.trim(),

          // SATUAN DASAR
          baseUnit:
            body.baseUnit?.trim() ||
            body.unit.trim(),

          // CONTOH:
          // 1 Dus = 24 PCS
          conversionRate,

          minimumStock:
            Number(body.minStock ?? 0),

          purchasePrice:
            Number(body.purchasePrice ?? 0),

          sellingPrice:
            Number(body.sellingPrice ?? 0),

          hasExpired:
            Boolean(body.hasExpired),

          expiredWarning:
            Number(body.expiredWarning ?? 30),

          stock: 0,

          active: true,
        },
      });

      await tx.inventory.create({
        data: {
          barangId: item.id,

          stock: 0,

          reservedStock: 0,

          availableStock: 0,

          minimumStock:
            Number(body.minStock ?? 0),

          maximumStock: 0,

          lastPurchase: 0,

          averageCost: 0,
        },
      });

      await tx.history.create({
        data: {
          transactionType: "MASTER_CREATE",

          referenceNumber: item.code,

          description:
            `Tambah Master Barang ${item.name}`,
        },
      });

      return item;
    });

    return NextResponse.json({
      success: true,
      message: "Barang berhasil disimpan",
      data: barang,
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal menyimpan barang",
      },
      {
        status: 500,
      }
    );
  }
}