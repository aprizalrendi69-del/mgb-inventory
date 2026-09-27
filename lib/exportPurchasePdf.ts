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
  const marginBottom = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // =========================================================
  // COLORS
  // =========================================================

  const navy = [24, 39, 75] as [number, number, number];
  const navyDark = [15, 23, 42] as [number, number, number];
  const blue = [37, 99, 235] as [number, number, number];
  const blueSoft = [239, 246, 255] as [number, number, number];

  const dark = [31, 41, 55] as [number, number, number];
  const gray = [107, 114, 128] as [number, number, number];
  const grayDark = [75, 85, 99] as [number, number, number];

  const lightGray = [248, 250, 252] as [number, number, number];
  const lighterGray = [249, 250, 251] as [number, number, number];
  const borderGray = [220, 225, 232] as [number, number, number];

  const green = [22, 163, 74] as [number, number, number];
  const greenSoft = [240, 253, 244] as [number, number, number];

  const white = [255, 255, 255] as [number, number, number];

  // =========================================================
  // HELPERS
  // =========================================================

  const safeText = (value: any, fallback = "-") => {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      return fallback;
    }

    return String(value);
  };

  const formatCurrency = (value: any) => {
    const amount = Number(value || 0);

    return amount.toLocaleString("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const formatQty = (value: any) => {
    const amount = Number(value || 0);

    return amount.toLocaleString("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
  };

  const formatDate = (value: any) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const getTotal = () => {
    if (
      purchase?.total !== undefined &&
      purchase?.total !== null &&
      purchase?.total !== ""
    ) {
      return Number(purchase.total || 0);
    }

    return (purchase?.items || []).reduce(
      (sum: number, item: any) =>
        sum +
        Number(item?.qty || 0) *
          Number(item?.price || 0),
      0
    );
  };

  const totalPurchase = getTotal();

  const getStatusColors = (status: string) => {
    const normalized = status.toUpperCase();

    if (
      normalized.includes("APPROVED") ||
      normalized.includes("RECEIVED") ||
      normalized.includes("COMPLETED") ||
      normalized.includes("DONE")
    ) {
      return {
        bg: greenSoft,
        text: green,
      };
    }

    return {
      bg: blueSoft,
      text: blue,
    };
  };

  // =========================================================
  // FOOTER
  // =========================================================

  const drawFooter = () => {
    const y = pageHeight - 13;

    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.35);

    doc.line(
      marginLeft,
      pageHeight - 18,
      pageWidth - marginRight,
      pageHeight - 18
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...gray);

    doc.text(
      `${safeText(COMPANY.name)} • MGB Inventory System`,
      marginLeft,
      y
    );

    doc.text(
      `PO ${safeText(purchase.number)}`,
      pageWidth / 2,
      y,
      {
        align: "center",
      }
    );

    const pageNumber =
      doc.getCurrentPageInfo().pageNumber;

    const totalPages = doc.getNumberOfPages();

    doc.text(
      `Halaman ${pageNumber} / ${totalPages}`,
      pageWidth - marginRight,
      y,
      {
        align: "right",
      }
    );
  };

  // =========================================================
  // FIRST PAGE HEADER ONLY
  // =========================================================

  const drawFirstPageHeader = () => {
    // Top accent bar
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageWidth, 4.5, "F");

    // Small blue accent
    doc.setFillColor(...blue);
    doc.rect(14, 10, 3, 24, "F");

    // Company name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(...navyDark);

    doc.text(
      safeText(COMPANY.name),
      21,
      17
    );

    // Company address
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...gray);

    doc.text(
      safeText(COMPANY.address),
      21,
      23
    );

    // Company contact
    const contactParts = [
      COMPANY.phone
        ? `Telp ${safeText(COMPANY.phone)}`
        : null,
      COMPANY.email
        ? `Email ${safeText(COMPANY.email)}`
        : null,
      COMPANY.website
        ? safeText(COMPANY.website)
        : null,
    ].filter(Boolean);

    doc.text(
      contactParts.join("   •   "),
      21,
      28
    );

    // Document badge
    doc.setFillColor(...navy);

    doc.roundedRect(
      143,
      10,
      53,
      27,
      3,
      3,
      "F"
    );

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    doc.setFontSize(7);

    doc.text(
      "DOCUMENT",
      169.5,
      17,
      {
        align: "center",
      }
    );

    doc.setFontSize(12);

    doc.text(
      "PURCHASE",
      169.5,
      25,
      {
        align: "center",
      }
    );

    doc.setFontSize(12);

    doc.text(
      "ORDER",
      169.5,
      32,
      {
        align: "center",
      }
    );

    // Separator
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.45);

    doc.line(
      marginLeft,
      43,
      pageWidth - marginRight,
      43
    );
  };

  // =========================================================
  // FIRST PAGE
  // =========================================================

  drawFirstPageHeader();

  // =========================================================
  // DOCUMENT META
  // =========================================================

  const metaY = 52;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...blue);

  doc.text(
    "PURCHASE ORDER",
    marginLeft,
    metaY
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...dark);

  doc.text(
    safeText(purchase.number),
    marginLeft,
    metaY + 7
  );

  // Date
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...gray);

  doc.text(
    "TANGGAL",
    102,
    metaY
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...dark);

  doc.text(
    formatDate(purchase.purchaseDate),
    102,
    metaY + 7
  );

  // Status
  const status = safeText(
    purchase.status,
    "DRAFT"
  ).toUpperCase();

  const statusColors = getStatusColors(status);

  doc.setFillColor(...statusColors.bg);

  doc.roundedRect(
    165,
    47,
    31,
    14,
    3,
    3,
    "F"
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...statusColors.text);

  doc.text(
    status,
    180.5,
    55.5,
    {
      align: "center",
    }
  );

  // =========================================================
  // SUPPLIER
  // =========================================================

  const supplierY = 68;
  const supplierHeight = 32;

  doc.setFillColor(...lightGray);

  doc.roundedRect(
    marginLeft,
    supplierY,
    contentWidth,
    supplierHeight,
    3,
    3,
    "F"
  );

  // Vertical accent
  doc.setFillColor(...blue);

  doc.roundedRect(
    marginLeft,
    supplierY,
    2.5,
    supplierHeight,
    1.5,
    1.5,
    "F"
  );

  // Label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...blue);

  doc.text(
    "SUPPLIER",
    marginLeft + 7,
    supplierY + 8
  );

  // Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...dark);

  doc.text(
    safeText(purchase.supplier?.name),
    marginLeft + 7,
    supplierY + 16
  );

  // Address
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...gray);

  const supplierAddress = safeText(
    purchase.supplier?.address
  );

  const supplierAddressLines =
    doc.splitTextToSize(
      supplierAddress,
      105
    );

  doc.text(
    supplierAddressLines.slice(0, 2),
    marginLeft + 7,
    supplierY + 23
  );

  // Contact
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...gray);

  doc.text(
    "KONTAK",
    145,
    supplierY + 8
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...dark);

  doc.text(
    `Telp : ${safeText(
      purchase.supplier?.phone
    )}`,
    145,
    supplierY + 16
  );

  if (purchase.supplier?.email) {
    doc.text(
      `Email : ${safeText(
        purchase.supplier.email
      )}`,
      145,
      supplierY + 23
    );
  }

  // =========================================================
  // ITEMS TABLE
  // =========================================================

  const tableStartY =
    supplierY + supplierHeight + 9;

  const items = Array.isArray(purchase.items)
    ? purchase.items
    : [];

  const tableBody =
    items.length > 0
      ? items.map(
          (item: any, index: number) => {
            const qty = Number(
              item?.qty || 0
            );

            const price = Number(
              item?.price || 0
            );

            return [
              String(index + 1).padStart(
                2,
                "0"
              ),
              safeText(
                item?.barang?.code
              ),
              safeText(
                item?.barang?.name
              ),
              formatQty(qty),
              safeText(
                item?.barang?.unit
              ),
              `Rp ${formatCurrency(
                price
              )}`,
              `Rp ${formatCurrency(
                qty * price
              )}`,
            ];
          }
        )
      : [
          [
            "—",
            "—",
            "Tidak ada item",
            "—",
            "—",
            "—",
            "—",
          ],
        ];

  autoTable(doc, {
    startY: tableStartY,

    margin: {
      left: marginLeft,
      right: marginRight,
      bottom: marginBottom,
    },

    head: [
      [
        "NO",
        "KODE",
        "NAMA BARANG",
        "QTY",
        "SATUAN",
        "HARGA",
        "SUBTOTAL",
      ],
    ],

    body: tableBody,

    theme: "grid",

    // =======================================================
    // COMPACT TABLE
    // =======================================================

    styles: {
      font: "helvetica",
      fontSize: 7.6,
      textColor: dark,
      lineColor: borderGray,
      lineWidth: 0.2,

      cellPadding: {
        top: 1.8,
        bottom: 1.8,
        left: 2.2,
        right: 2.2,
      },

      valign: "middle",
      overflow: "linebreak",
      minCellHeight: 6.5,
    },

    headStyles: {
      fillColor: navy,
      textColor: white,
      fontStyle: "bold",
      fontSize: 7,

      halign: "center",
      valign: "middle",

      cellPadding: {
        top: 2.4,
        bottom: 2.4,
        left: 2,
        right: 2,
      },

      minCellHeight: 7.5,
    },

    alternateRowStyles: {
      fillColor: lighterGray,
    },

    columnStyles: {
      0: {
        halign: "center",
        cellWidth: 10,
      },

      1: {
        halign: "left",
        cellWidth: 25,
      },

      2: {
        halign: "left",
        cellWidth: 48,
      },

      3: {
        halign: "center",
        cellWidth: 17,
      },

      4: {
        halign: "center",
        cellWidth: 18,
      },

      5: {
        halign: "right",
        cellWidth: 34,
      },

      6: {
        halign: "right",
        cellWidth: 36,
      },
    },

    // =======================================================
    // NO HEADER ON NEXT PAGES
    // =======================================================

    didDrawPage: () => {
      /*
       * Sengaja kosong.
       *
       * Halaman 2, 3, dst. tidak akan memiliki:
       * - Header perusahaan
       * - Badge PURCHASE ORDER
       * - PO metadata
       * - Supplier card
       *
       * Hanya tabel yang dilanjutkan oleh autoTable.
       */
    },
  });

  // =========================================================
  // TOTAL + NOTES + SIGNATURE
  // =========================================================

  let currentY =
    (doc as any).lastAutoTable?.finalY ||
    tableStartY + 20;

  const estimateRequiredSpace = 88;

  if (
    currentY + estimateRequiredSpace >
    pageHeight - marginBottom
  ) {
    doc.addPage();

    /*
     * Tidak ada header pada halaman baru.
     * Area dimulai langsung dari bagian total.
     */
    currentY = 18;
  }

  // =========================================================
  // TOTAL BOX
  // =========================================================

  const totalY = currentY + 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...gray);

  doc.text(
    "RINGKASAN PEMBAYARAN",
    marginLeft,
    totalY + 5
  );

  doc.setFillColor(...navy);

  doc.roundedRect(
    112,
    totalY,
    84,
    20,
    3,
    3,
    "F"
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(
    190,
    202,
    224
  );

  doc.text(
    "TOTAL PURCHASE",
    119,
    totalY + 8
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...white);

  doc.text(
    `Rp ${formatCurrency(
      totalPurchase
    )}`,
    190,
    totalY + 15,
    {
      align: "right",
    }
  );

  // =========================================================
  // NOTES
  // =========================================================

  const notesY = totalY + 29;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...dark);

  doc.text(
    "CATATAN",
    marginLeft,
    notesY
  );

  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.35);

  doc.roundedRect(
    marginLeft,
    notesY + 4,
    contentWidth,
    22,
    2.5,
    2.5,
    "S"
  );

  if (purchase.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(...grayDark);

    const noteLines =
      doc.splitTextToSize(
        String(purchase.notes),
        contentWidth - 8
      );

    doc.text(
      noteLines.slice(0, 3),
      marginLeft + 4,
      notesY + 11
    );
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...gray);

    doc.text(
      "Tidak ada catatan.",
      marginLeft + 4,
      notesY + 12
    );
  }

  // =========================================================
  // ELECTRONIC DOCUMENT NOTICE
  // =========================================================

  const signY = notesY + 39;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...gray);

  doc.text(
    "Dokumen ini dibuat secara elektronik melalui",
    pageWidth / 2,
    signY - 5,
    {
      align: "center",
    }
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...dark);

  doc.text(
    "MGB Inventory System",
    pageWidth / 2,
    signY,
    {
      align: "center",
    }
  );

  // =========================================================
  // SIGNATURE SECTION
  // =========================================================

  const signatureColumns = [
    {
      x: 42,
      title: "PURCHASING",
      subtitle: "Dibuat / Diajukan",
    },
    {
      x: 105,
      title: "GUDANG",
      subtitle: "Diperiksa",
    },
    {
      x: 168,
      title: "SUPPLIER",
      subtitle: "Diterima / Disetujui",
    },
  ];

  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.35);

  doc.line(
    marginLeft,
    signY + 7,
    pageWidth - marginRight,
    signY + 7
  );

  signatureColumns.forEach(
    (item) => {
      doc.setFont(
        "helvetica",
        "bold"
      );
      doc.setFontSize(7.5);
      doc.setTextColor(...dark);

      doc.text(
        item.title,
        item.x,
        signY + 16,
        {
          align: "center",
        }
      );

      doc.setFont(
        "helvetica",
        "normal"
      );
      doc.setFontSize(6.5);
      doc.setTextColor(...gray);

      doc.text(
        item.subtitle,
        item.x,
        signY + 21,
        {
          align: "center",
        }
      );

      // Signature line
      doc.setDrawColor(...gray);
      doc.setLineWidth(0.45);

      doc.line(
        item.x - 21,
        signY + 39,
        item.x + 21,
        signY + 39
      );

      doc.setFont(
        "helvetica",
        "normal"
      );
      doc.setFontSize(6.5);
      doc.setTextColor(...gray);

      doc.text(
        "Nama / Tanda Tangan",
        item.x,
        signY + 44,
        {
          align: "center",
        }
      );
    }
  );

  // =========================================================
  // FOOTER ALL PAGES
  // =========================================================

  const totalPages = doc.getNumberOfPages();

  for (
    let page = 1;
    page <= totalPages;
    page++
  ) {
    doc.setPage(page);
    drawFooter();
  }

  // =========================================================
  // SAVE
  // =========================================================

  const filename = safeText(
    purchase.number,
    "purchase-order"
  ).replace(
    /[\\/:*?"<>|]/g,
    "-"
  );

  doc.save(`${filename}.pdf`);
}