import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY } from "@/lib/company";

export function exportPurchasePDF(purchase: any) {
  const doc = new jsPDF("p", "mm", "a4");

  // =========================================================
  // PAGE CONFIG
  // =========================================================

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginLeft = 14;
  const marginRight = 14;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // =========================================================
  // HELPERS
  // =========================================================

  const formatCurrency = (value: any) => {
    return Number(value || 0).toLocaleString("id-ID");
  };

  const formatDate = (value: any) => {
    if (!value) return "-";

    return new Date(value).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const safeText = (value: any) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    return String(value);
  };

  // =========================================================
  // COLORS
  // =========================================================

  const navy = [24, 39, 75] as [number, number, number];
  const blue = [37, 99, 235] as [number, number, number];
  const lightBlue = [239, 246, 255] as [number, number, number];

  const dark = [31, 41, 55] as [number, number, number];
  const gray = [107, 114, 128] as [number, number, number];
  const lightGray = [243, 244, 246] as [number, number, number];
  const borderGray = [221, 225, 231] as [number, number, number];

  const white = [255, 255, 255] as [number, number, number];

  // =========================================================
  // HEADER
  // =========================================================

  // Top accent bar
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageWidth, 4, "F");

  // Company name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...navy);

  doc.text(
    safeText(COMPANY.name),
    marginLeft,
    17
  );

  // Company contact
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...gray);

  doc.text(
    safeText(COMPANY.address),
    marginLeft,
    23
  );

  doc.text(
    `Telp : ${safeText(COMPANY.phone)}   •   Email : ${safeText(
      COMPANY.email
    )}`,
    marginLeft,
    28
  );

  doc.text(
    `Website : ${safeText(COMPANY.website)}`,
    marginLeft,
    33
  );

  // =========================================================
  // DOCUMENT TITLE AREA
  // =========================================================

  doc.setFillColor(...navy);
  doc.roundedRect(
    143,
    12,
    53,
    24,
    3,
    3,
    "F"
  );

  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);

  doc.text(
    "PURCHASE",
    169.5,
    22,
    { align: "center" }
  );

  doc.setFontSize(14);

  doc.text(
    "ORDER",
    169.5,
    29,
    { align: "center" }
  );

  // Separator
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.5);

  doc.line(
    marginLeft,
    40,
    pageWidth - marginRight,
    40
  );

  // =========================================================
  // PO META
  // =========================================================

  const metaY = 48;

  // Left metadata
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...gray);

  doc.text("PURCHASE ORDER", marginLeft, metaY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...dark);

  doc.text(
    safeText(purchase.number),
    marginLeft,
    metaY + 6
  );

  // Right metadata
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...gray);

  doc.text(
    "TANGGAL PO",
    120,
    metaY
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...dark);

  doc.text(
    formatDate(purchase.purchaseDate),
    120,
    metaY + 6
  );

  // Status badge
  const status = safeText(purchase.status).toUpperCase();

  doc.setFillColor(...lightBlue);

  doc.roundedRect(
    166,
    45,
    30,
    12,
    3,
    3,
    "F"
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...blue);

  doc.text(
    status,
    181,
    52.5,
    { align: "center" }
  );

  // =========================================================
  // SUPPLIER SECTION
  // =========================================================

  const supplierY = 67;

  doc.setFillColor(...lightGray);

  doc.roundedRect(
    marginLeft,
    supplierY,
    contentWidth,
    31,
    3,
    3,
    "F"
  );

  // Section label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...blue);

  doc.text(
    "SUPPLIER",
    marginLeft + 6,
    supplierY + 7
  );

  // Supplier name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...dark);

  doc.text(
    safeText(purchase.supplier?.name),
    marginLeft + 6,
    supplierY + 15
  );

  // Supplier address
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...gray);

  doc.text(
    safeText(purchase.supplier?.address),
    marginLeft + 6,
    supplierY + 22
  );

  // Supplier phone
  doc.text(
    `Telp : ${safeText(purchase.supplier?.phone)}`,
    145,
    supplierY + 22
  );

  // =========================================================
  // ITEMS TABLE
  // =========================================================

  const tableStartY = supplierY + 39;

  autoTable(doc, {
    startY: tableStartY,

    margin: {
      left: marginLeft,
      right: marginRight,
    },

    head: [[
      "NO",
      "KODE",
      "NAMA BARANG",
      "QTY",
      "SATUAN",
      "HARGA",
      "SUBTOTAL",
    ]],

    body: (purchase.items || []).map(
      (item: any, index: number) => [
        index + 1,
        safeText(item.barang?.code),
        safeText(item.barang?.name),
        Number(item.qty || 0).toLocaleString("id-ID"),
        safeText(item.barang?.unit),
        `Rp ${formatCurrency(item.price)}`,
        `Rp ${formatCurrency(
          Number(item.qty || 0) *
            Number(item.price || 0)
        )}`,
      ]
    ),

    theme: "grid",

    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: dark,
      cellPadding: {
        top: 3,
        bottom: 3,
        left: 3,
        right: 3,
      },
      lineColor: borderGray,
      lineWidth: 0.25,
      valign: "middle",
    },

    headStyles: {
      fillColor: navy,
      textColor: white,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      valign: "middle",
      cellPadding: 3.5,
    },

    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },

    columnStyles: {
      0: {
        halign: "center",
        cellWidth: 11,
      },

      1: {
        halign: "left",
        cellWidth: 25,
      },

      2: {
        halign: "left",
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
        cellWidth: 32,
      },

      6: {
        halign: "right",
        cellWidth: 36,
      },
    },

    didDrawPage: () => {
      // Nothing here intentionally.
      // Footer is handled after table.
    },
  });

  // =========================================================
  // TOTAL BOX
  // =========================================================

  const lastTableY =
    (doc as any).lastAutoTable?.finalY ||
    tableStartY + 20;

  const totalY = lastTableY + 7;

  doc.setFillColor(...navy);

  doc.roundedRect(
    112,
    totalY,
    84,
    18,
    3,
    3,
    "F"
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(210, 220, 240);

  doc.text(
    "TOTAL PURCHASE",
    118,
    totalY + 7
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...white);

  doc.text(
    `Rp ${formatCurrency(purchase.total)}`,
    190,
    totalY + 14,
    { align: "right" }
  );

  // =========================================================
  // NOTES
  // =========================================================

  const notesY = totalY + 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...dark);

  doc.text(
    "CATATAN",
    marginLeft,
    notesY
  );

  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.4);

  doc.roundedRect(
    marginLeft,
    notesY + 4,
    contentWidth,
    22,
    2,
    2,
    "S"
  );

  // Optional note if available
  if (purchase.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...gray);

    const noteLines = doc.splitTextToSize(
      String(purchase.notes),
      contentWidth - 8
    );

    doc.text(
      noteLines.slice(0, 3),
      marginLeft + 4,
      notesY + 11
    );
  }

  // =========================================================
  // SIGNATURE
  // =========================================================

  const signY = notesY + 39;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...gray);

  doc.text(
    "Dokumen ini dibuat secara elektronik melalui",
    pageWidth / 2,
    signY - 5,
    { align: "center" }
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...dark);

  doc.text(
    "MGB Inventory System",
    pageWidth / 2,
    signY,
    { align: "center" }
  );

  // Signature labels
  const signatureColumns = [
    {
      x: 42,
      title: "PURCHASING",
    },
    {
      x: 105,
      title: "GUDANG",
    },
    {
      x: 168,
      title: "SUPPLIER",
    },
  ];

  signatureColumns.forEach((item) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...dark);

    doc.text(
      item.title,
      item.x,
      signY + 15,
      { align: "center" }
    );

    doc.setDrawColor(...gray);
    doc.setLineWidth(0.4);

    doc.line(
      item.x - 20,
      signY + 36,
      item.x + 20,
      signY + 36
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...gray);

    doc.text(
      "Nama / Tanda Tangan",
      item.x,
      signY + 41,
      { align: "center" }
    );
  });

  // =========================================================
  // FOOTER
  // =========================================================

  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.4);

  doc.line(
    marginLeft,
    pageHeight - 16,
    pageWidth - marginRight,
    pageHeight - 16
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...gray);

  doc.text(
    "PT Mitra Garam Bogatama • MGB Inventory System",
    marginLeft,
    pageHeight - 9
  );

  doc.text(
    `PO ${safeText(purchase.number)}`,
    pageWidth - marginRight,
    pageHeight - 9,
    { align: "right" }
  );

  // =========================================================
  // SAVE
  // =========================================================

  doc.save(`${purchase.number}.pdf`);
}