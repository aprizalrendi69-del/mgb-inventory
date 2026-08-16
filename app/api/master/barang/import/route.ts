import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "File Excel tidak ditemukan",
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const workbook = XLSX.read(buffer, {
      type: "buffer",
    });

    if (!workbook.SheetNames.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Excel tidak memiliki sheet",
        },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json<any>(sheet, {
      defval: "",
    });

    if (!rows.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Excel kosong",
        },
        { status: 400 }
      );
    }

    let baru = 0;
    let update = 0;
    let dilewati = 0;
    let gagal = 0;

    for (const row of rows) {
      const kode = String(
        row["Kode Barang"] ??
          row["Kode"] ??
          row["kode"] ??
          row["code"] ??
          ""
      ).trim();

      const nama = String(
        row["Nama Barang"] ??
          row["Nama"] ??
          row["nama"] ??
          ""
      ).trim();

      const kategori = String(
        row["Kategori"] ??
          row["kategori"] ??
          ""
      ).trim();

      const satuan = String(
        row["Satuan"] ??
          row["Unit"] ??
          row["satuan"] ??
          row["unit"] ??
          "PCS"
      ).trim();

      if (!kode || !nama) {
        gagal++;
        continue;
      }

      try {
        const existing = await prisma.barang.findUnique({
          where: {
            code: kode,
          },
        });

        // ============================================
        // BARANG SUDAH ADA
        // ============================================

        if (existing) {
          // Barang outlet tidak boleh disentuh
          if (existing.source === "OUTLET") {
            dilewati++;
            continue;
          }

          // Barang CENTRAL -> update master pusat
          await prisma.barang.update({
            where: {
              id: existing.id,
            },
            data: {
              barcode: existing.barcode || kode,
              name: nama,
              category: kategori || null,
              unit: satuan || "PCS",

              // Tetap CENTRAL
              source: "CENTRAL",
              sourceOutletId: null,
            },
          });

          update++;
          continue;
        }

        // ============================================
        // BARANG BARU
        // ============================================

        await prisma.barang.create({
          data: {
            code: kode,
            barcode: kode,
            name: nama,
            category: kategori || null,
            unit: satuan || "PCS",

            stock: 0,
            minimumStock: 0,
            purchasePrice: 0,
            sellingPrice: 0,
            hasExpired: false,
            active: true,

            // IMPORT MASTER = CENTRAL
            source: "CENTRAL",
            sourceOutletId: null,
          },
        });

        baru++;
      } catch (error) {
        console.error(
          `Gagal import barang ${kode}:`,
          error
        );

        gagal++;
      }
    }

    return NextResponse.json({
      success: true,
      message:
        `Import selesai. ` +
        `Baru: ${baru}, ` +
        `Update: ${update}, ` +
        `Barang outlet dilewati: ${dilewati}, ` +
        `Gagal: ${gagal}.`,
      summary: {
        totalExcel: rows.length,
        baru,
        update,
        dilewati,
        gagal,
      },
    });
  } catch (error: any) {
    console.error("IMPORT MASTER BARANG ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message || "Gagal import master barang",
      },
      { status: 500 }
    );
  }
}