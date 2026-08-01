import * as XLSX from "xlsx";
import { COMPANY } from "@/lib/company";

export function exportPurchaseExcel(purchase: any) {

  const rows = [

    {
      Kode: COMPANY.name,
      Barang: "",
      Satuan: "",
      Qty: "",
      Harga: "",
      Subtotal: ""
    },

    {
      Kode: COMPANY.address,
      Barang: "",
      Satuan: "",
      Qty: "",
      Harga: "",
      Subtotal: ""
    },

    {
      Kode: `Telp : ${COMPANY.phone}`,
      Barang: "",
      Satuan: "",
      Qty: "",
      Harga: "",
      Subtotal: ""
    },

    {
      Kode: `Email : ${COMPANY.email}`,
      Barang: "",
      Satuan: "",
      Qty: "",
      Harga: "",
      Subtotal: ""
    },

    {
      Kode: `Website : ${COMPANY.website}`,
      Barang: "",
      Satuan: "",
      Qty: "",
      Harga: "",
      Subtotal: ""
    },

    {
      Kode: "",
      Barang: "",
      Satuan: "",
      Qty: "",
      Harga: "",
      Subtotal: ""
    },

    {
      Kode: "Kode",
      Barang: "Barang",
      Satuan: "Satuan",
      Qty: "Qty",
      Harga: "Harga",
      Subtotal: "Subtotal"
    }

  ];

  purchase.items.forEach((item: any) => {

    rows.push({

      Kode: item.barang?.code,

      Barang: item.barang?.name,

      Satuan: item.barang?.unit,

      Qty: item.qty,

      Harga: Number(item.price),

      Subtotal: Number(item.subtotal)

    } as any);

  });

  rows.push({

    Kode: "",

    Barang: "",

    Satuan: "",

    Qty: "",

    Harga: "TOTAL",

    Subtotal: Number(purchase.total)

  } as any);

  const ws = XLSX.utils.json_to_sheet(rows, {
    skipHeader: true
  });

  ws["!cols"] = [
    { wch: 15 },
    { wch: 35 },
    { wch: 12 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 }
  ];

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    ws,
    "Purchase Order"
  );

  XLSX.writeFile(
    wb,
    `${purchase.number}.xlsx`
  );

}