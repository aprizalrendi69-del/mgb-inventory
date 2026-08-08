import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { COMPANY } from "@/lib/company";

export function exportSuratJalanPDF(data: any) {
  const doc = new jsPDF();

  // =========================
  // HEADER PERUSAHAAN
  // =========================

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);

  doc.text(COMPANY.name.toUpperCase(), 105, 15, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  // Alamat
  if (COMPANY.address) {
    doc.text(COMPANY.address, 105, 21, {
      align: "center",
    });
  }

  // Telepon
  if (COMPANY.phone) {
    doc.text(`Telp : ${COMPANY.phone}`, 105, 26, {
      align: "center",
    });
  }

  // Email jika ada
  let headerLineY = 30;

  if (COMPANY.email) {
    doc.text(`Email : ${COMPANY.email}`, 105, 31, {
      align: "center",
    });

    headerLineY = 35;
  }

  // Website jika ada
  if (COMPANY.website) {
    doc.text(`Website : ${COMPANY.website}`, 105, headerLineY, {
      align: "center",
    });

    headerLineY += 4;
  }

  // Garis header
  doc.setLineWidth(0.8);
  doc.line(14, headerLineY, 196, headerLineY);

  doc.setLineWidth(0.2);
  doc.line(14, headerLineY + 1.5, 196, headerLineY + 1.5);

  // =========================
  // JUDUL
  // =========================

  const titleY = headerLineY + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);

  doc.text("SURAT JALAN", 105, titleY, {
    align: "center",
  });

  // =========================
  // INFORMASI DOKUMEN
  // =========================

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const infoStartY = titleY + 10;

  doc.text("No Surat Jalan", 14, infoStartY);

  doc.text(
    ": " + (data.suratJalan?.number ?? "-"),
    50,
    infoStartY
  );

  doc.text("No Delivery", 14, infoStartY + 7);

  doc.text(
    ": " + (data.number ?? "-"),
    50,
    infoStartY + 7
  );

  doc.text("Customer", 14, infoStartY + 14);

  doc.text(
    ": " + (data.customer?.name ?? "-"),
    50,
    infoStartY + 14
  );

  doc.text("Alamat", 14, infoStartY + 21);

  doc.text(
    ": " + (data.customer?.address ?? "-"),
    50,
    infoStartY + 21
  );

  doc.text("Tanggal", 130, infoStartY);

  doc.text(
    ": " +
      new Date(data.deliveryDate).toLocaleDateString("id-ID"),
    155,
    infoStartY
  );

  // =========================
  // TABEL BARANG
  // =========================

  const tableStartY = infoStartY + 29;

  autoTable(doc, {
    startY: tableStartY,

    tableWidth: "auto",

    margin: {
      left: 14,
      right: 14,
    },

    theme: "grid",

    headStyles: {
      fillColor: [22, 163, 74],
      textColor: 255,
      halign: "center",
      fontStyle: "bold",
    },

    bodyStyles: {
      halign: "left",
    },

    columnStyles: {
      0: {
        halign: "center",
        cellWidth: 10,
      },

      1: {
        cellWidth: 22,
      },

      2: {
        cellWidth: 52,
      },

      3: {
        halign: "center",
        cellWidth: 18,
      },

      4: {
        halign: "right",
        cellWidth: 14,
      },

      5: {
        halign: "right",
        cellWidth: 28,
      },

      6: {
        halign: "right",
        cellWidth: 32,
      },
    },

    head: [
      [
        "No",
        "Kode",
        "Nama Barang",
        "Satuan",
        "Qty",
        "Harga",
        "Subtotal",
      ],
    ],

    body: (data.items ?? []).map(
      (item: any, index: number) => [
        index + 1,

        item.barang?.code ?? "-",

        item.barang?.name ?? "-",

        item.barang?.unit ?? "-",

        item.qty,

        Number(item.price ?? 0).toLocaleString("id-ID"),

        Number(
          item.subtotal ??
            Number(item.qty ?? 0) * Number(item.price ?? 0)
        ).toLocaleString("id-ID"),
      ]
    ),
  });

  // =========================
  // TOTAL
  // =========================

  const total = (data.items ?? []).reduce(
    (a: number, b: any) =>
      a +
      Number(
        b.subtotal ??
          Number(b.qty ?? 0) * Number(b.price ?? 0)
      ),
    0
  );

  const y =
    ((doc as any).lastAutoTable?.finalY ?? tableStartY) + 15;

  doc.setDrawColor(120);

  doc.line(120, y - 4, 195, y - 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);

  doc.text(
    "TOTAL : Rp " + total.toLocaleString("id-ID"),
    125,
    y + 2
  );

  // =========================
  // CATATAN
  // =========================

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.text(
    "Catatan : " + (data.note ?? data.remarks ?? "-"),
    14,
    y + 15
  );

  // =========================
  // TANDA TANGAN
  // =========================

  const signY = y + 35;

  doc.text("Dibuat", 25, signY);
  doc.text("Gudang", 75, signY);
  doc.text("Pengirim", 125, signY);
  doc.text("Penerima", 175, signY);

  doc.line(12, signY + 28, 42, signY + 28);
  doc.line(62, signY + 28, 92, signY + 28);
  doc.line(112, signY + 28, 142, signY + 28);
  doc.line(162, signY + 28, 192, signY + 28);

  // =========================
  // SIMPAN PDF
  // =========================

  doc.save(`${data.number}.pdf`);
}