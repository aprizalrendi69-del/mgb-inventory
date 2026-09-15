import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const data = [
      {
        "Kode Barang": "",
        "Nama Barang": "",
        "Kategori": "",
        "Satuan": "",
      },
    ];

    const workbook = XLSX.utils.book_new();

    const worksheet = XLSX.utils.json_to_sheet(data);

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Master Barang"
    );

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Disposition":
          'attachment; filename="Template_Master_Barang.xlsx"',
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal membuat template",
      },
      {
        status: 500,
      }
    );
  }
}