import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportPurchasePDF(purchase: any) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("PT MITRA GARAM BOGATAMA", 14, 15);

  doc.setFontSize(14);
  doc.text("PURCHASE ORDER", 14, 24);

  doc.setFontSize(10);

  doc.text(`No PO : ${purchase.number}`, 14, 35);
  doc.text(
    `Tanggal : ${new Date(
      purchase.purchaseDate
    ).toLocaleDateString("id-ID")}`,
    14,
    41
  );

  doc.text(
    `Supplier : ${purchase.supplier.name}`,
    14,
    47
  );

  autoTable(doc, {
    startY: 55,

    head: [[
      "Kode",
      "Barang",
      "Qty",
      "Satuan",
      "Harga",
      "Subtotal"
    ]],

    body: purchase.items.map((i: any) => [
      i.barang.code,
      i.barang.name,
      i.qty,
      i.barang.unit,
      i.price.toLocaleString("id-ID"),
      i.subtotal.toLocaleString("id-ID"),
    ]),
  });

  const y = (doc as any).lastAutoTable.finalY + 10;

  doc.text(
    `Grand Total : Rp ${purchase.total.toLocaleString("id-ID")}`,
    14,
    y
  );

  doc.save(`${purchase.number}.pdf`);
}
export const exportPdf = exportPurchasePDF;