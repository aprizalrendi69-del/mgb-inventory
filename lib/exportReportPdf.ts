import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY } from "@/lib/company";

export function exportReportPdf(
  title: string,
  columns: string[],
  rows: any[][]
) {
  const doc = new jsPDF("p", "mm", "a4");

  // HEADER
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(COMPANY.name, 105, 15, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.text(COMPANY.address, 105, 21, { align: "center" });

  doc.text(
    `Telp : ${COMPANY.phone} | Email : ${COMPANY.email}`,
    105,
    26,
    { align: "center" }
  );

  doc.text(
    `Website : ${COMPANY.website}`,
    105,
    30,
    { align: "center" }
  );

  doc.line(14, 35, 196, 35);

  // JUDUL
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);

  doc.text(title, 105, 43, {
    align: "center",
  });

  doc.line(14, 47, 196, 47);

  // TANGGAL CETAK
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.text(
    "Tanggal Cetak : " +
      new Date().toLocaleString("id-ID"),
    14,
    55
  );

  // TABEL
  autoTable(doc, {
    startY: 62,

    head: [columns],

    body: rows,

    styles: {
      fontSize: 9,
      cellPadding: 2,
    },

    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      halign: "center",
    },
  });

  const finalY =
    (doc as any).lastAutoTable.finalY + 15;

  // FOOTER
  doc.setFontSize(8);

  doc.text(
    "PT Mitra Garam Bogatama - MGB Inventory System",
    105,
    290,
    {
      align: "center",
    }
  );

doc.save(`${title}.pdf`);
}

export const exportReportPDF = exportReportPdf;
