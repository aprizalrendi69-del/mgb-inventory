import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportSuratJalanPDF(data: any) {
  const doc = new jsPDF();

//=========================
// HEADER PERUSAHAAN
//=========================

doc.setFont("helvetica", "bold");
doc.setFontSize(18);
doc.text("PT. MITRA GARAM BOGATAMA", 105, 15, {
  align: "center",
});

doc.setFont("helvetica", "normal");
doc.setFontSize(9);

doc.text(
  "Jl. Alamat Perusahaan",
  105,
  21,
  { align: "center" }
);

doc.text(
  "Telp : 021-xxxxxxx",
  105,
  26,
  { align: "center" }
);

doc.setLineWidth(0.8);
doc.line(14, 30, 196, 30);

doc.setLineWidth(0.2);
doc.line(14, 31.5, 196, 31.5);

doc.setFont("helvetica", "bold");
doc.setFontSize(15);

doc.text("SURAT JALAN", 105, 40, {
  align: "center",
});

//=========================
// INFORMASI DOKUMEN
//=========================

doc.setFont("helvetica", "normal");
doc.setFontSize(10);

doc.text("No Surat Jalan", 14, 50);
doc.text(
  ": " + (data.suratJalan?.number ?? "-"),50,50);
doc.text("No Delivery", 14, 57);
doc.text(": " + data.number, 50, 57);

doc.text("Customer", 14, 64);
doc.text(": " + (data.customer?.name ?? "-"), 50, 64);

doc.text("Alamat", 14, 71);
doc.text(
  ": " + (data.customer?.address ?? "-"),
  50,
  71
);

doc.text("Tanggal", 130, 50);
doc.text(
  ": " +
    new Date(data.deliveryDate).toLocaleDateString("id-ID"),
  155,
  50
);


autoTable(doc, {
  startY: 90,

  tableWidth: "auto",

  margin: {
    left: 14,
    right: 14,
  },

  theme: "grid",

  headStyles: {
    fillColor: [21, 128, 61],
    textColor: 255,
    halign: "center",
    fontStyle: "bold",
  },

 headStyles: {
  fillColor: [22, 163, 74], // Hijau
  textColor: 255,
  halign: "center",
  fontStyle: "bold",
},

  bodyStyles: {
    halign: "left",
  },

  columnStyles: {
    0: { halign: "center", cellWidth: 10 },
    1: { cellWidth: 22 },
    2: { cellWidth: 52 },
    3: { halign: "center", cellWidth: 18 },
    4: { halign: "right", cellWidth: 14 },
    5: { halign: "right", cellWidth: 28 },
    6: { halign: "right", cellWidth: 32 },
  },

  head: [[
    "No",
    "Kode",
    "Nama Barang",
    "Satuan",
    "Qty",
    "Harga",
    "Subtotal",
  ]],

  body: data.items.map((item: any, index: number) => [
    index + 1,
    item.barang?.code ?? "-",
    item.barang?.name ?? "-",
    item.barang?.unit ?? "-",
    item.qty,
    Number(item.price ?? 0).toLocaleString("id-ID"),
    Number(item.subtotal ?? item.qty * item.price).toLocaleString("id-ID"),
  ]),
});

  const total =
    data.items.reduce(
      (a: number, b: any) =>
        a + Number(b.subtotal),
      0
    );

  const y =
    (doc as any).lastAutoTable.finalY + 15;

    doc.setDrawColor(120);

doc.line(120, y - 4, 195, y - 4);

doc.setFont("helvetica", "bold");

doc.setFontSize(12);

doc.text(
  "TOTAL : Rp " +
    total.toLocaleString("id-ID"),
  125,
  y + 2
);
doc.setFont("helvetica", "normal");

doc.setFontSize(10);

doc.text(
  "Catatan : " + (data.note ?? "-"),
  14,
  y + 15
);
const signY = y + 35;

doc.text("Dibuat", 25, signY);
doc.text("Gudang", 75, signY);
doc.text("Pengirim", 125, signY);
doc.text("Penerima", 175, signY);

doc.line(12, signY + 28, 42, signY + 28);
doc.line(62, signY + 28, 92, signY + 28);
doc.line(112, signY + 28, 142, signY + 28);
doc.line(162, signY + 28, 192, signY + 28);

// Simpan PDF
doc.save(`${data.number}.pdf`);
}