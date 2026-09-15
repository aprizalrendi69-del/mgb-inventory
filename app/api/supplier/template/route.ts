import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {

  const data = [

    {
      Code: "SUP001",
      Name: "PT Maju Jaya",
      Address: "Jl. Industri No. 1",
      City: "Bekasi",
      Phone: "081234567890",
      Email: "supplier@email.com",
      "Contact Person": "Budi",
    },

    {
      Code: "SUP002",
      Name: "PT Sumber Makmur",
      Address: "Jl. Raya No. 25",
      City: "Jakarta",
      Phone: "081298765432",
      Email: "purchasing@supplier.com",
      "Contact Person": "Andi",
    },

  ];

  const workbook = XLSX.utils.book_new();

  const worksheet = XLSX.utils.json_to_sheet(data);

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Supplier"
  );

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  return new NextResponse(buffer, {

    headers: {

      "Content-Disposition":
        'attachment; filename="Template Supplier.xlsx"',

      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    },

  });

}