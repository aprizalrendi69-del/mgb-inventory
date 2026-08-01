import * as XLSX from "xlsx";

export function exportSuratJalanExcel(data: any) {

  const rows = data.items.map((i:any)=>({

    Kode:i.barang.code,

    Barang:i.barang.name,

    Satuan:i.barang.unit,

    Qty:i.qty,

    Harga:i.price,

    Subtotal:i.subtotal

  }));

  const ws =
    XLSX.utils.json_to_sheet(rows);

  const wb =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    ws,
    "Surat Jalan"
  );

  XLSX.writeFile(
    wb,
    `${data.number}.xlsx`
  );

}