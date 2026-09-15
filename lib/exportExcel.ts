import * as XLSX from "xlsx";

export function exportPurchaseExcel(purchase: any) {

  const rows = purchase.items.map((i: any) => ({
    Kode: i.barang.code,
    Barang: i.barang.name,
    Qty: i.qty,
    Satuan: i.barang.unit,
    Harga: i.price,
    Subtotal: i.subtotal,
  }));

  rows.push({
    Kode: "",
    Barang: "",
    Qty: "",
    Satuan: "",
    Harga: "TOTAL",
    Subtotal: purchase.total,
  } as any);

  const ws = XLSX.utils.json_to_sheet(rows);

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
export const exportExcel = exportPurchaseExcel;