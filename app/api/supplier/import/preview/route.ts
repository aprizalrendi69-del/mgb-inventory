import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {

  try {

    const formData = await req.formData();

    const file = formData.get("file") as File;

    if (!file) {

      return NextResponse.json(
        {
          success: false,
          message: "File tidak ditemukan"
        },
        {
          status: 400
        }
      );

    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const workbook = XLSX.read(buffer);

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json<any>(sheet);

    const preview = rows.map((row, index) => ({

      no: index + 1,

      code: row["Kode Supplier"] ?? "",

      name: row["Nama Supplier"] ?? "",

      address: row["Alamat"] ?? "",

      city: row["Kota"] ?? "",

      phone: row["Telepon"] ?? "",

      email: row["Email"] ?? "",

      contactPerson: row["Contact Person"] ?? ""

    }));

    return NextResponse.json({

      success: true,

      total: preview.length,

      data: preview

    });

  } catch (error) {

    console.log(error);

    return NextResponse.json(
      {
        success: false,
        message: "Preview gagal"
      },
      {
        status: 500
      }
    );

  }

}