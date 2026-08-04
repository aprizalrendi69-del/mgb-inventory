import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message: "File tidak ditemukan",
        },
        {
          status: 400,
        }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const workbook = XLSX.read(buffer, {
      type: "buffer",
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json<any>(sheet, {
      defval: "",
    });

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Excel kosong",
      });
    }

    console.log("TOTAL ROW:", rows.length);
    console.log("HEADER:", Object.keys(rows[0]));

    let total = 0;
    let gagal = 0;

    for (const row of rows) {
      const kode =
        row["Kode"] ||
        row["Kode Barang"] ||
        row["kode"] ||
        row["code"] ||
        "";

      const nama =
        row["Nama Barang"] ||
        row["Nama"] ||
        row["nama"] ||
        "";

      const kategori =
        row["Kategori"] ||
        row["kategori"] ||
        "";

      const satuan =
        row["Satuan"] ||
        row["Unit"] ||
        row["satuan"] ||
        row["unit"] ||
        "PCS";

      if (!kode || !nama) {
        gagal++;
        continue;
      }

      console.log({
        kode,
        nama,
        kategori,
        satuan,
      });

      try {
        await prisma.barang.upsert({
          where: {
            code: String(kode),
          },

          update: {
            barcode: String(kode),
            name: String(nama),
            category: kategori ? String(kategori) : null,
            unit: String(satuan),
          },

          create: {
            code: String(kode),
            barcode: String(kode),
            name: String(nama),
            category: kategori ? String(kategori) : null,
            unit: String(satuan),
            stock: 0,
            minimumStock: 0,
            purchasePrice: 0,
            sellingPrice: 0,
            hasExpired: false,
            active: true,
          },
        });

        total++;
      } catch (err) {
        console.error("GAGAL IMPORT:", err);
        gagal++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil import ${total} barang, ${gagal} gagal`,
    });
  } catch (error: any) {
    console.error("IMPORT BARANG ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: 500,
      }
    );
  }
}