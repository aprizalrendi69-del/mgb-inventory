import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message: "File Excel tidak ditemukan.",
        },
        {
          status: 400,
        }
      );
    }

    const bytes = await file.arrayBuffer();

    const workbook = XLSX.read(bytes, {
      type: "array",
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows: any[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
    });

    let berhasil = 0;
    let gagal = 0;

    for (const row of rows) {
      const code = String(row["Code"] ?? "").trim();
      const name = String(row["Name"] ?? "").trim();

      const address = String(row["Address"] ?? "").trim();
      const city = String(row["City"] ?? "").trim();
      const phone = String(row["Phone"] ?? "").trim();
      const email = String(row["Email"] ?? "").trim();
      const contactPerson = String(
        row["Contact Person"] ?? ""
      ).trim();

      if (!code || !name) {
        gagal++;
        continue;
      }

      const exist = await prisma.supplier.findUnique({
        where: {
          code,
        },
      });

      if (exist) {
        gagal++;
        continue;
      }

      await prisma.supplier.create({
        data: {
          code,
          name,
          address: address || null,
          city: city || null,
          phone: phone || null,
          email: email || null,
          contactPerson: contactPerson || null,
        },
      });

      berhasil++;
    }

    return NextResponse.json({
      success: true,
      message: `Import selesai.\n\nBerhasil : ${berhasil}\nGagal : ${gagal}`,
    });
  } catch (error) {
    console.log("IMPORT SUPPLIER ERROR :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Import supplier gagal",
      },
      {
        status: 500,
      }
    );
  }
}