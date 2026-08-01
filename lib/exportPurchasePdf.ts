import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY } from "@/lib/company";

export function exportPurchasePDF(purchase: any) {
  const doc = new jsPDF("p", "mm", "a4");

  // ===================================================
  // HEADER PERUSAHAAN
  // ===================================================

doc.setFont("helvetica","bold");
doc.setFontSize(18);
doc.text(COMPANY.name,105,15,{align:"center"});

doc.setFont("helvetica","normal");
doc.setFontSize(9);

doc.text(COMPANY.address,105,21,{align:"center"});

doc.text(
`Telp : ${COMPANY.phone} | Email : ${COMPANY.email}`,
105,
26,
{align:"center"}
);

doc.text(
`Website : ${COMPANY.website}`,
105,
30,
{align:"center"}
);

doc.line(14,35,196,35);

doc.setFont("helvetica","bold");
doc.setFontSize(14);

doc.text(
"PURCHASE ORDER",
105,
43,
{
align:"center"
}
);

doc.line(14,47,196,47);

doc.setFont("helvetica","bold");
doc.setFontSize(14);

  doc.setDrawColor(0);
  doc.line(14, 45, 196, 45);

  // ===================================================
  // INFORMASI PURCHASE
  // ===================================================

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

doc.text("No PO", 14, 57);
doc.text(": " + purchase.number, 40, 57);

doc.text("Tanggal", 14, 63);
doc.text(
  ": " + new Date(purchase.purchaseDate).toLocaleDateString("id-ID"),
  40,
  63
);

doc.text("Supplier", 14, 69);
doc.text(": " + (purchase.supplier?.name ?? "-"), 40, 69);

doc.text("Alamat", 14, 75);
doc.text(": " + (purchase.supplier?.address ?? "-"), 40, 75);

doc.text("Telepon", 14, 81);
doc.text(": " + (purchase.supplier?.phone ?? "-"), 40, 81);

doc.text("Status", 14, 87);
doc.text(": " + purchase.status, 40, 87);

  // ===================================================
  // TABEL
  // ===================================================

  autoTable(doc, {
    startY: 95,

    head: [[
      "No",
      "Kode",
      "Nama Barang",
      "Qty",
      "Satuan",
      "Harga",
      "Subtotal",
    ]],

    body: purchase.items.map((item: any, index: number) => [
      index + 1,
      item.barang?.code ?? "-",
      item.barang?.name ?? "-",
      item.qty,
      item.barang?.unit ?? "-",
      Number(item.price).toLocaleString("id-ID"),
      (
        Number(item.qty) *
        Number(item.price)
      ).toLocaleString("id-ID"),
    ]),

    styles: {
      fontSize: 9,
      cellPadding: 2,
    },

    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      halign: "center",
    },

    columnStyles: {
      0: {
        halign: "center",
        cellWidth: 12,
      },
      3: {
        halign: "center",
        cellWidth: 18,
      },
      4: {
        halign: "center",
        cellWidth: 20,
      },
      5: {
        halign: "right",
      },
      6: {
        halign: "right",
      },
    },
  });

  // ===================================================
  // TOTAL
  // ===================================================

  const finalY =
    (doc as any).lastAutoTable.finalY + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);

  doc.text(
    "TOTAL : Rp " +
      Number(purchase.total).toLocaleString("id-ID"),
    196,
    finalY,
    {
      align: "right",
    }
  );

  // ===================================================
  // CATATAN
  // ===================================================

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.text("Catatan :", 14, finalY + 15);

  doc.rect(14, finalY + 18, 182, 20);

  // ===================================================
  // TANDA TANGAN
  // ===================================================

  const signY = finalY + 55;

  doc.text("Purchasing", 30, signY);
  doc.text("Gudang", 95, signY);
  doc.text("Supplier", 160, signY);

  doc.line(18, signY + 25, 52, signY + 25);
  doc.line(83, signY + 25, 117, signY + 25);
  doc.line(148, signY + 25, 182, signY + 25);

  // ===================================================
  // FOOTER
  // ===================================================

  doc.setFontSize(8);

  doc.text(
    "PT Mitra Garam Bogatama - MGB Inventory System",
    105,
    290,
    {
      align: "center",
    }
  );

  doc.save(`${purchase.number}.pdf`);
}