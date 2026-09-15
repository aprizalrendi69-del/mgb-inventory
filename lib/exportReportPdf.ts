import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY } from "@/lib/company";

// =====================================================
// MGB PREMIUM REPORT PDF
// =====================================================
//
// DESIGN SYSTEM
// -----------------------------------------------------
// - MGB branding tanpa logo
// - Corporate green
// - A4 landscape untuk generic report tabel
// - A4 portrait khusus Purchase Report
// - Premium header
// - KPI summary
// - Zebra table
// - Status badge
// - Automatic number formatting
// - Page numbering
// - Safe filename
// - Multi-page safe
//
// COMPATIBILITY
// -----------------------------------------------------
// exportReportPdf(title, columns, rows)
// exportPurchaseReportPdf(title, columns, rows)
// exportReportPDF
//
// Tidak membutuhkan perubahan frontend.
// =====================================================

// =====================================================
// COLOR SYSTEM
// =====================================================

const COLORS = {
  dark: [24, 53, 45] as [number, number, number],
  dark2: [35, 74, 64] as [number, number, number],

  green: [73, 127, 112] as [number, number, number],
  greenDark: [52, 103, 88] as [number, number, number],
  greenLight: [234, 243, 239] as [number, number, number],
  greenPale: [247, 250, 248] as [number, number, number],

  blue: [55, 105, 160] as [number, number, number],
  blueLight: [235, 243, 252] as [number, number, number],

  orange: [180, 120, 45] as [number, number, number],
  orangeLight: [252, 246, 232] as [number, number, number],

  red: [175, 65, 65] as [number, number, number],
  redLight: [253, 239, 239] as [number, number, number],

  purple: [104, 82, 150] as [number, number, number],
  purpleLight: [243, 239, 250] as [number, number, number],

  text: [45, 55, 51] as [number, number, number],
  muted: [115, 125, 120] as [number, number, number],
  border: [220, 228, 224] as [number, number, number],

  white: [255, 255, 255] as [number, number, number],
  black: [20, 20, 20] as [number, number, number],

  zebra: [250, 252, 251] as [number, number, number],
};

// =====================================================
// BASIC HELPERS
// =====================================================

function parseNumericValue(value: any) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const text = String(value).trim();

  if (!text) {
    return 0;
  }

  // Support values already formatted as Indonesian Rupiah,
  // for example: "Rp 25.000" or "Rp 25.000,50".
  if (/^rp\s*/i.test(text)) {
    const cleaned = text
      .replace(/^rp\s*/i, "")
      .replace(/\./g, "")
      .replace(/,/g, ".");

    const number = Number(cleaned);

    return Number.isFinite(number) ? number : 0;
  }

  const number = Number(text);

  return Number.isFinite(number) ? number : 0;
}

function formatRupiah(value: any) {
  const number = parseNumericValue(value);

  return `Rp ${number.toLocaleString("id-ID")}`;
}

function formatNumber(value: any) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toLocaleString("id-ID");
}

function formatDate(value: any) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: any) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeFileName(value: string) {
  return String(value || "Laporan")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
}

function upper(value: any) {
  return String(value ?? "").trim().toUpperCase();
}

function cleanText(value: any) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  return String(value);
}

// =====================================================
// COLUMN DETECTION
// =====================================================

function findColumn(
  columns: string[],
  candidates: string[]
) {
  const normalizedColumns = columns.map((column) =>
    upper(column)
  );

  for (const candidate of candidates) {
    const index =
      normalizedColumns.indexOf(
        upper(candidate)
      );

    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function findColumnContains(
  columns: string[],
  candidates: string[]
) {
  const normalizedColumns = columns.map((column) =>
    upper(column)
  );

  for (const candidate of candidates) {
    const index = normalizedColumns.findIndex(
      (column) =>
        column.includes(upper(candidate))
    );

    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function isCurrencyColumn(
  columnName: string
) {
  const value = upper(columnName);

  // Jangan menganggap kolom quantity/stock sebagai nominal
  // hanya karena namanya mengandung kata TOTAL.
  if (isQuantityColumn(value)) {
    return false;
  }

  return (
    value.includes("HARGA") ||
    value.includes("SUBTOTAL") ||
    value.includes("NILAI") ||
    value.includes("AMOUNT") ||
    value.includes("COST") ||
    value.includes("BIAYA") ||
    value.includes("NOMINAL") ||
    value.includes("GRAND TOTAL") ||
    value.includes("TOTAL PEMBELIAN") ||
    value.includes("TOTAL PENJUALAN") ||
    value.includes("TOTAL NILAI") ||
    value.includes("TOTAL AMOUNT") ||
    value.includes("RP") ||
    value === "TOTAL"
  );
}

function isQuantityColumn(
  columnName: string
) {
  const value = upper(columnName);

  return (
    value === "QTY" ||
    value.includes("QUANTITY") ||
    value.includes("JUMLAH") ||
    value.includes("STOCK") ||
    value.includes("STOK")
  );
}

function isDateColumn(
  columnName: string
) {
  const value = upper(columnName);

  return (
    value.includes("TANGGAL") ||
    value.includes("DATE") ||
    value.includes("WAKTU") ||
    value.includes("DUE")
  );
}

function isStatusColumn(
  columnName: string
) {
  const value = upper(columnName);

  return (
    value.includes("STATUS") ||
    value.includes("STATE")
  );
}

// =====================================================
// STATUS COLORS
// =====================================================

function getStatusStyle(status: string) {
  const value = upper(status);

  if (
    value.includes("RECEIVED") ||
    value.includes("RECEIVE") ||
    value.includes("APPROVED") ||
    value.includes("SELESAI") ||
    value.includes("COMPLETED") ||
    value.includes("PAID") ||
    value.includes("LUNAS") ||
    value.includes("ACTIVE")
  ) {
    return {
      fill: COLORS.greenLight,
      text: COLORS.greenDark,
    };
  }

  if (
    value.includes("DRAFT") ||
    value.includes("PENDING") ||
    value.includes("WAIT") ||
    value.includes("MENUNGGU")
  ) {
    return {
      fill: COLORS.orangeLight,
      text: COLORS.orange,
    };
  }

  if (
    value.includes("VOID") ||
    value.includes("CANCEL") ||
    value.includes("REJECT") ||
    value.includes("FAILED") ||
    value.includes("BATAL")
  ) {
    return {
      fill: COLORS.redLight,
      text: COLORS.red,
    };
  }

  if (
    value.includes("SENT") ||
    value.includes("TRANSFER") ||
    value.includes("PROCESS")
  ) {
    return {
      fill: COLORS.blueLight,
      text: COLORS.blue,
    };
  }

  return {
    fill: COLORS.greenPale,
    text: COLORS.dark2,
  };
}

// =====================================================
// REPORT DATE RANGE
// =====================================================

function detectDateRange(
  columns: string[],
  rows: any[][]
) {
  const dateIndex = findColumnContains(
    columns,
    [
      "TANGGAL",
      "DATE",
      "WAKTU",
      "RECEIVED",
      "RECEIPT",
      "CREATED",
    ]
  );

  if (dateIndex < 0) {
    return "Semua Periode";
  }

  const dates = rows
    .map((row) => row[dateIndex])
    .filter(Boolean)
    .map((value) => {
      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return date.getTime();
    })
    .filter(
      (value): value is number =>
        value !== null
    );

  if (dates.length === 0) {
    return "Semua Periode";
  }

  const minDate = new Date(
    Math.min(...dates)
  );

  const maxDate = new Date(
    Math.max(...dates)
  );

  if (
    minDate.toDateString() ===
    maxDate.toDateString()
  ) {
    return formatDate(minDate);
  }

  return `${formatDate(
    minDate
  )} - ${formatDate(maxDate)}`;
}

// =====================================================
// REPORT ID
// =====================================================

function generateReportId() {
  return (
    new Date()
      .getTime()
      .toString()
      .slice(-8)
  );
}

// =====================================================
// PREMIUM HEADER
// =====================================================

function drawPremiumHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  periodText: string,
  marginLeft: number,
  marginRight: number,
  reportCategory: string
) {
  const pageWidth =
    doc.internal.pageSize.getWidth();

  // ---------------------------------------------------
  // TOP ACCENT
  // ---------------------------------------------------

  doc.setFillColor(...COLORS.green);

  doc.rect(
    0,
    0,
    pageWidth,
    2.8,
    "F"
  );

  // ---------------------------------------------------
  // MGB BRAND
  // ---------------------------------------------------

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(25);

  doc.setTextColor(...COLORS.dark);

  doc.text(
    "MGB",
    marginLeft,
    17
  );

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(7.5);

  doc.setTextColor(...COLORS.green);

  doc.text(
    "INVENTORY SYSTEM",
    marginLeft,
    22
  );

  // ---------------------------------------------------
  // RIGHT META
  // ---------------------------------------------------

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(7);

  doc.setTextColor(...COLORS.muted);

  doc.text(
    upper(reportCategory),
    pageWidth - marginRight,
    13,
    {
      align: "right",
    }
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(7);

  doc.text(
    `Report ID : ${generateReportId()}`,
    pageWidth - marginRight,
    18,
    {
      align: "right",
    }
  );

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(8.5);

  doc.setTextColor(...COLORS.dark);

  doc.text(
    COMPANY.name,
    pageWidth - marginRight,
    24,
    {
      align: "right",
    }
  );

  // ---------------------------------------------------
  // DIVIDER
  // ---------------------------------------------------

  doc.setDrawColor(...COLORS.border);

  doc.setLineWidth(0.3);

  doc.line(
    marginLeft,
    29,
    pageWidth - marginRight,
    29
  );

  // ---------------------------------------------------
  // TITLE
  // ---------------------------------------------------

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(
    title.length > 45 ? 14 : 17
  );

  doc.setTextColor(...COLORS.dark);

  doc.text(
    title,
    marginLeft,
    39
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(8);

  doc.setTextColor(...COLORS.muted);

  doc.text(
    subtitle,
    marginLeft,
    45
  );

  // ---------------------------------------------------
  // META BOX
  // ---------------------------------------------------

  const metaY = 50;
  const metaH = 13;

  const contentWidth =
    pageWidth -
    marginLeft -
    marginRight;

  doc.setFillColor(...COLORS.greenPale);

  doc.roundedRect(
    marginLeft,
    metaY,
    contentWidth,
    metaH,
    2,
    2,
    "F"
  );

  // Period

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(6.5);

  doc.setTextColor(...COLORS.muted);

  doc.text(
    "PERIODE",
    marginLeft + 5,
    metaY + 5
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(7.5);

  doc.setTextColor(...COLORS.dark);

  doc.text(
    periodText,
    marginLeft + 5,
    metaY + 9.5
  );

  // Divider

  const dividerX =
    marginLeft + 100;

  doc.setDrawColor(...COLORS.border);

  doc.line(
    dividerX,
    metaY + 2.5,
    dividerX,
    metaY + metaH - 2.5
  );

  // Printed

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(6.5);

  doc.setTextColor(...COLORS.muted);

  doc.text(
    "DICETAK",
    dividerX + 6,
    metaY + 5
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(7.5);

  doc.setTextColor(...COLORS.dark);

  doc.text(
    formatDateTime(new Date()),
    dividerX + 6,
    metaY + 9.5
  );

  return metaY + metaH;
}

// =====================================================
// COMPACT CONTINUATION HEADER
// =====================================================
// Dipakai pada halaman 2, 3, dst. supaya tabel tidak
// menyisakan ruang kosong sebesar header premium.
function drawContinuationHeader(
  doc: jsPDF,
  title: string,
  marginLeft: number,
  marginRight: number
) {
  const pageWidth =
    doc.internal.pageSize.getWidth();

  doc.setFillColor(...COLORS.green);
  doc.rect(0, 0, pageWidth, 2.4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.dark);
  doc.text("MGB", marginLeft, 11);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.green);
  doc.text("INVENTORY SYSTEM", marginLeft + 18, 11);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(title.length > 65 ? 7 : 8);
  doc.setTextColor(...COLORS.dark2);
  doc.text(
    `${title} — Lanjutan`,
    pageWidth - marginRight,
    11,
    { align: "right" }
  );

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.25);
  doc.line(
    marginLeft,
    16,
    pageWidth - marginRight,
    16
  );
}

// =====================================================
// FOOTER
// =====================================================

function drawFooter(
  doc: jsPDF,
  marginLeft: number,
  marginRight: number
) {
  const pageWidth =
    doc.internal.pageSize.getWidth();

  const pageHeight =
    doc.internal.pageSize.getHeight();

  const footerY =
    pageHeight - 7;

  doc.setDrawColor(...COLORS.border);

  doc.setLineWidth(0.2);

  doc.line(
    marginLeft,
    footerY - 4,
    pageWidth - marginRight,
    footerY - 4
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(7.2);

  doc.setTextColor(...COLORS.muted);

  doc.text(
    "MGB Inventory System",
    marginLeft,
    footerY
  );

  doc.text(
    "Confidential Internal Report",
    pageWidth / 2,
    footerY,
    {
      align: "center",
    }
  );

  // Nomor halaman final digambar sekali oleh finalizePageNumbers().
}

// =====================================================
// FINALIZE PAGE NUMBERS
// =====================================================

function finalizePageNumbers(
  doc: jsPDF,
  marginLeft: number,
  marginRight: number
) {
  const pageWidth =
    doc.internal.pageSize.getWidth();

  const pageHeight =
    doc.internal.pageSize.getHeight();

  const totalPages =
    doc.internal.getNumberOfPages();

  const footerY =
    pageHeight - 7;

  for (
    let page = 1;
    page <= totalPages;
    page++
  ) {
    doc.setPage(page);

    doc.setDrawColor(...COLORS.border);

    doc.setLineWidth(0.2);

    doc.line(
      marginLeft,
      footerY - 4,
      pageWidth - marginRight,
      footerY - 4
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(7.2);

    doc.setTextColor(...COLORS.muted);

    doc.text(
      "MGB Inventory System",
      marginLeft,
      footerY
    );

    doc.text(
      "Confidential Internal Report",
      pageWidth / 2,
      footerY,
      {
        align: "center",
      }
    );

    doc.text(
      `Page ${page} of ${totalPages}`,
      pageWidth - marginRight,
      footerY,
      {
        align: "right",
      }
    );
  }
}

// =====================================================
// KPI CARD
// =====================================================

function drawKpiCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  accent: [number, number, number]
) {
  doc.setFillColor(...COLORS.white);

  doc.setDrawColor(...COLORS.border);

  doc.setLineWidth(0.25);

  doc.roundedRect(
    x,
    y,
    width,
    20,
    2,
    2,
    "FD"
  );

  // Accent

  doc.setFillColor(...accent);

  doc.roundedRect(
    x,
    y,
    2.2,
    20,
    1,
    1,
    "F"
  );

  // Label

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(6.5);

  doc.setTextColor(...COLORS.muted);

  doc.text(
    upper(label),
    x + 7,
    y + 6
  );

  // Value

  doc.setFont(
    "helvetica",
    "bold"
  );

  let fontSize = 13;

  if (value.length > 25) {
    fontSize = 8.5;
  } else if (value.length > 17) {
    fontSize = 10;
  } else if (value.length > 12) {
    fontSize = 11;
  }

  doc.setFontSize(fontSize);

  doc.setTextColor(...COLORS.dark);

  doc.text(
    value,
    x + 7,
    y + 14
  );
}

// =====================================================
// GENERIC REPORT KPI DETECTION
// =====================================================

function buildGenericSummary(
  columns: string[],
  rows: any[][]
) {
  const qtyIndex =
    findColumn(
      columns,
      ["Qty", "Quantity", "Jumlah"]
    ) >= 0
      ? findColumn(
          columns,
          ["Qty", "Quantity", "Jumlah"]
        )
      : findColumnContains(
          columns,
          ["QTY", "QUANTITY"]
        );

  const totalIndex =
    findColumnContains(
      columns,
      [
        "GRAND TOTAL",
        "TOTAL NILAI",
        "TOTAL PEMBELIAN",
        "TOTAL PENJUALAN",
        "SUBTOTAL",
        "NILAI",
        "AMOUNT",
        "HARGA",
        "TOTAL",
      ]
    );

  const statusIndex =
    findColumnContains(
      columns,
      ["STATUS"]
    );

  let totalQty = 0;

  if (qtyIndex >= 0) {
    totalQty = rows.reduce(
      (sum, row) =>
        sum +
        Number(row[qtyIndex] ?? 0),
      0
    );
  }

  let grandTotal = 0;

  if (totalIndex >= 0) {
    grandTotal = rows.reduce(
      (sum, row) =>
        sum +
        parseNumericValue(row[totalIndex]),
      0
    );
  }

  const statuses =
    statusIndex >= 0
      ? new Set(
          rows.map((row) =>
            String(
              row[statusIndex] ?? ""
            )
          )
        ).size
      : 0;

  return {
    totalRows: rows.length,
    totalQty,
    grandTotal,
    statuses,
    qtyIndex,
    totalIndex,
    statusIndex,
  };
}

// =====================================================
// GENERIC PREMIUM REPORT
// =====================================================
//
// Dipakai oleh:
// - Barang Masuk
// - Barang Keluar
// - Stock
// - Transfer
// - Report lain
//
// Signature sengaja dipertahankan.
// =====================================================

export function exportReportPdf(
  title: string,
  columns: string[],
  rows: any[][]
) {
  // ===================================================
  // AUTO LANDSCAPE
  // ===================================================

  const isWide =
    columns.length >= 7;

  const doc = new jsPDF(
    isWide ? "l" : "p",
    "mm",
    "a4"
  );

  const pageWidth =
    doc.internal.pageSize.getWidth();

  const pageHeight =
    doc.internal.pageSize.getHeight();

  const marginLeft =
    isWide ? 12 : 14;

  const marginRight =
    isWide ? 12 : 14;

  const contentWidth =
    pageWidth -
    marginLeft -
    marginRight;

  // ===================================================
  // SUMMARY
  // ===================================================

  const summary =
    buildGenericSummary(
      columns,
      rows
    );

  const periodText =
    detectDateRange(
      columns,
      rows
    );

  // ===================================================
  // CATEGORY
  // ===================================================

  let reportCategory =
    "MGB INVENTORY";

  const titleUpper =
    upper(title);

  if (
    titleUpper.includes("BARANG MASUK")
  ) {
    reportCategory =
      "INBOUND / RECEIVING";
  } else if (
    titleUpper.includes("BARANG KELUAR")
  ) {
    reportCategory =
      "OUTBOUND / ISSUE";
  } else if (
    titleUpper.includes("STOCK") ||
    titleUpper.includes("STOK")
  ) {
    reportCategory =
      "INVENTORY / STOCK";
  } else if (
    titleUpper.includes("TRANSFER")
  ) {
    reportCategory =
      "INVENTORY TRANSFER";
  }

  // ===================================================
  // HEADER
  // ===================================================

  let currentY =
    drawPremiumHeader(
      doc,
      title,
      `Laporan ${title} — MGB Inventory Management`,
      periodText,
      marginLeft,
      marginRight,
      reportCategory
    );

  // ===================================================
  // KPI
  // ===================================================

  currentY += 5;

  const gap = 4;

  const cardCount =
    isWide ? 4 : 2;

  const cardWidth =
    (contentWidth -
      gap * (cardCount - 1)) /
    cardCount;

  drawKpiCard(
    doc,
    marginLeft,
    currentY,
    cardWidth,
    "Total Data",
    formatNumber(
      summary.totalRows
    ),
    COLORS.green
  );

  if (isWide) {
    drawKpiCard(
      doc,
      marginLeft +
        cardWidth +
        gap,
      currentY,
      cardWidth,
      "Total Quantity",
      formatNumber(
        summary.totalQty
      ),
      COLORS.blue
    );

    drawKpiCard(
      doc,
      marginLeft +
        (cardWidth + gap) * 2,
      currentY,
      cardWidth,
      "Status",
      formatNumber(
        summary.statuses
      ),
      COLORS.orange
    );

    drawKpiCard(
      doc,
      marginLeft +
        (cardWidth + gap) * 3,
      currentY,
      cardWidth,
      "Grand Total",
      summary.totalIndex >= 0
        ? formatRupiah(
            summary.grandTotal
          )
        : "-",
      COLORS.green
    );
  } else {
    drawKpiCard(
      doc,
      marginLeft +
        cardWidth +
        gap,
      currentY,
      cardWidth,
      "Grand Total",
      summary.totalIndex >= 0
        ? formatRupiah(
            summary.grandTotal
          )
        : "-",
      COLORS.green
    );
  }

  currentY += 26;

  // ===================================================
  // EMPTY STATE
  // ===================================================

  if (rows.length === 0) {
    doc.setFillColor(
      ...COLORS.greenPale
    );

    doc.roundedRect(
      marginLeft,
      currentY,
      contentWidth,
      40,
      3,
      3,
      "F"
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(12);

    doc.setTextColor(...COLORS.dark);

    doc.text(
      "Tidak Ada Data",
      pageWidth / 2,
      currentY + 16,
      {
        align: "center",
      }
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(8);

    doc.setTextColor(...COLORS.muted);

    doc.text(
      "Tidak terdapat transaksi atau data pada periode yang dipilih.",
      pageWidth / 2,
      currentY + 24,
      {
        align: "center",
      }
    );

    finalizePageNumbers(
      doc,
      marginLeft,
      marginRight
    );

    doc.save(
      `${safeFileName(title)}.pdf`
    );

    return;
  }

  // ===================================================
  // TABLE
  // ===================================================

  // Gunakan nilai asli sebagai input AutoTable.
  // Formatting dilakukan satu kali di didParseCell().
  const bodyRows = rows.map((row) =>
    columns.map((_, index) => row[index])
  );

  // ===================================================
  // COLUMN WIDTH
  // ===================================================

  const dynamicCellWidth =
    contentWidth /
    Math.max(columns.length, 1);

  const columnStyles: Record<
    number,
    any
  > = {};

  columns.forEach(
    (column, index) => {
      const normalized =
        upper(column);

      if (
        normalized === "NO" ||
        normalized === "#" ||
        normalized === "NO."
      ) {
        columnStyles[index] = {
          cellWidth: Math.min(
            10,
            dynamicCellWidth
          ),
          halign: "center",
        };

        return;
      }

      if (
        isQuantityColumn(column)
      ) {
        columnStyles[index] = {
          cellWidth: Math.min(
            20,
            dynamicCellWidth
          ),
          halign: "right",
          fontStyle: "bold",
        };

        return;
      }

      if (
        isCurrencyColumn(column)
      ) {
        columnStyles[index] = {
          cellWidth: Math.min(
            35,
            dynamicCellWidth * 1.4
          ),
          halign: "right",
        };

        return;
      }

      if (
        isStatusColumn(column)
      ) {
        columnStyles[index] = {
          cellWidth: Math.min(
            27,
            dynamicCellWidth * 1.2
          ),
          halign: "center",
        };

        return;
      }

      if (
        isDateColumn(column)
      ) {
        columnStyles[index] = {
          cellWidth: Math.min(
            27,
            dynamicCellWidth * 1.2
          ),
          halign: "center",
        };

        return;
      }

      columnStyles[index] = {
        cellWidth:
          dynamicCellWidth,
      };
    }
  );

  // ===================================================
  // TABLE
  // ===================================================

  const tableStartPage =
    doc.internal.getNumberOfPages();

  autoTable(doc, {
    startY: currentY,

    head: [
      columns.map((column) =>
        upper(column)
      ),
    ],

    body: bodyRows,

    theme: "plain",

    margin: {
      left: marginLeft,
      right: marginRight,
      top: 22,
      bottom: 14,
    },

    styles: {
      font: "helvetica",
      fontSize: isWide
        ? 7
        : 7.5,

      cellPadding: {
        top: 2.2,
        right: 2.5,
        bottom: 2.2,
        left: 2.5,
      },

      textColor: COLORS.text,

      lineColor:
        COLORS.border,

      lineWidth: 0.15,

      valign: "middle",

      overflow: "linebreak",
    },

    headStyles: {
      fillColor: COLORS.green,

      textColor:
        COLORS.white,

      fontStyle: "bold",

      fontSize: isWide
        ? 6.7
        : 7,

      halign: "center",

      valign: "middle",

      cellPadding: 2.8,
    },

    alternateRowStyles: {
      fillColor: COLORS.zebra,
    },

    columnStyles,

    didParseCell(data) {
      if (
        data.section !==
        "body"
      ) {
        return;
      }

      const column =
        columns[
          data.column.index
        ];

      const originalRow =
        rows[data.row.index];

      if (!originalRow) {
        return;
      }

      const raw =
        originalRow[
          data.column.index
        ];

      // ------------------------------------------------
      // STATUS
      // ------------------------------------------------

      if (
        isStatusColumn(column)
      ) {
        const status =
          cleanText(raw);

        const statusStyle =
          getStatusStyle(
            status
          );

        data.cell.styles.fillColor =
          statusStyle.fill;

        data.cell.styles.textColor =
          statusStyle.text;

        data.cell.styles.fontStyle =
          "bold";

        data.cell.styles.halign =
          "center";

        return;
      }

      // ------------------------------------------------
      // CURRENCY
      // ------------------------------------------------

      if (
        isCurrencyColumn(column)
      ) {
        data.cell.text = [
          formatRupiah(raw),
        ];

        data.cell.styles.halign =
          "right";

        return;
      }

      // ------------------------------------------------
      // QUANTITY
      // ------------------------------------------------

      if (
        isQuantityColumn(column)
      ) {
        data.cell.text = [
          formatNumber(raw),
        ];

        data.cell.styles.halign =
          "right";

        return;
      }

      // ------------------------------------------------
      // DATE
      // ------------------------------------------------

      if (
        isDateColumn(column)
      ) {
        data.cell.text = [
          formatDate(raw),
        ];

        data.cell.styles.halign =
          "center";
      }
    },

    didDrawPage() {
      const currentPage =
        doc.internal.getNumberOfPages();

      if (currentPage > tableStartPage) {
        drawContinuationHeader(
          doc,
          title,
          marginLeft,
          marginRight
        );
      }

      drawFooter(
        doc,
        marginLeft,
        marginRight
      );
    },
  });

  // ===================================================
  // FINALIZE
  // ===================================================

  finalizePageNumbers(
    doc,
    marginLeft,
    marginRight
  );

  doc.save(
    `${safeFileName(title)}.pdf`
  );
}

// =====================================================
// PURCHASE REPORT PDF
// =====================================================
//
// Purchase memiliki layout khusus:
//
// MGB
// Purchase / Procurement
// Period
// KPI 2 x 2
// Supplier Section
// Purchase Detail
// Supplier Total
// Grand Total
//
// KHUSUS PURCHASE:
// - A4 PORTRAIT
// - Lebar tabel disesuaikan dengan 190mm content width
// - Multi-page header aman
// =====================================================

export function exportPurchaseReportPdf(
  title: string,
  columns: string[],
  rows: any[][]
) {
  // ===================================================
  // DOCUMENT
  // ===================================================

  // KHUSUS PURCHASE -> PORTRAIT
  const doc = new jsPDF(
    "p",
    "mm",
    "a4"
  );

  const pageWidth =
    doc.internal.pageSize.getWidth();

  const pageHeight =
    doc.internal.pageSize.getHeight();

  const marginLeft = 10;
  const marginRight = 10;

  const contentWidth =
    pageWidth -
    marginLeft -
    marginRight;

  // ===================================================
  // DATA INDEX
  // ===================================================

  const supplierIndex =
    findColumn(
      columns,
      ["Supplier"]
    ) >= 0
      ? findColumn(
          columns,
          ["Supplier"]
        )
      : 3;

  const statusIndex =
    findColumn(
      columns,
      ["Status"]
    );

  const subtotalIndex =
    findColumn(
      columns,
      ["Subtotal", "Total"]
    ) >= 0
      ? findColumn(
          columns,
          ["Subtotal", "Total"]
        )
      : 10;

  const qtyIndex =
    findColumn(
      columns,
      ["Qty", "Quantity"]
    ) >= 0
      ? findColumn(
          columns,
          ["Qty", "Quantity"]
        )
      : 8;

  const poIndex =
    findColumn(
      columns,
      ["No PO", "PO", "Purchase Order"]
    ) >= 0
      ? findColumn(
          columns,
          ["No PO", "PO", "Purchase Order"]
        )
      : 1;

  const dateIndex =
    findColumn(
      columns,
      ["Tanggal", "Date"]
    ) >= 0
      ? findColumn(
          columns,
          ["Tanggal", "Date"]
        )
      : 2;

  const codeIndex =
    findColumn(
      columns,
      [
        "Kode Barang",
        "Kode",
      ]
    ) >= 0
      ? findColumn(
          columns,
          [
            "Kode Barang",
            "Kode",
          ]
        )
      : 5;

  const nameIndex =
    findColumn(
      columns,
      [
        "Nama Barang",
        "Barang",
      ]
    ) >= 0
      ? findColumn(
          columns,
          [
            "Nama Barang",
            "Barang",
          ]
        )
      : 6;

  const unitIndex =
    findColumn(
      columns,
      ["Satuan", "Unit"]
    ) >= 0
      ? findColumn(
          columns,
          ["Satuan", "Unit"]
        )
      : 7;

  const priceIndex =
    findColumn(
      columns,
      ["Harga", "Price"]
    ) >= 0
      ? findColumn(
          columns,
          ["Harga", "Price"]
        )
      : 9;

  // ===================================================
  // GROUP SUPPLIER
  // ===================================================

  const supplierGroups =
    new Map<
      string,
      any[][]
    >();

  rows.forEach((row) => {
    const supplier =
      String(
        row[supplierIndex] ??
          "Tanpa Supplier"
      ).trim() ||
      "Tanpa Supplier";

    if (
      !supplierGroups.has(
        supplier
      )
    ) {
      supplierGroups.set(
        supplier,
        []
      );
    }

    supplierGroups
      .get(supplier)!
      .push(row);
  });

  // ===================================================
  // SUMMARY
  // ===================================================

  const totalPO =
    new Set(
      rows.map((row) =>
        String(
          row[poIndex] ?? ""
        )
      )
    ).size;

  const totalQty =
    rows.reduce(
      (sum, row) =>
        sum +
        Number(
          row[qtyIndex] ?? 0
        ),
      0
    );

  const totalDetail =
    rows.length;

  const totalSupplier =
    supplierGroups.size;

  const grandTotal =
    rows.reduce(
      (sum, row) =>
        sum +
        parseNumericValue(row[subtotalIndex]),
      0
    );

  // ===================================================
  // PERIOD
  // ===================================================

  const periodText =
    detectDateRange(
      columns,
      rows
    );

  // ===================================================
  // FOOTER
  // ===================================================

  function footer() {
    drawFooter(
      doc,
      marginLeft,
      marginRight
    );
  }

  // ===================================================
  // HEADER
  // ===================================================

  function header() {
    return drawPremiumHeader(
      doc,
      title,
      "Laporan detail Purchase Order dan transaksi pembelian",
      periodText,
      marginLeft,
      marginRight,
      "PURCHASE / PROCUREMENT"
    );
  }

  // ===================================================
  // START
  // ===================================================

  let currentY =
    header();

  // ===================================================
  // KPI - PORTRAIT 2 x 2
  // ===================================================

  currentY += 5;

  const gap = 4;

  const kpiCardWidth =
    (contentWidth - gap) /
    2;

  // Row 1

  drawKpiCard(
    doc,
    marginLeft,
    currentY,
    kpiCardWidth,
    "Total Purchase",
    formatNumber(totalPO),
    COLORS.green
  );

  drawKpiCard(
    doc,
    marginLeft +
      kpiCardWidth +
      gap,
    currentY,
    kpiCardWidth,
    "Total Quantity",
    formatNumber(totalQty),
    COLORS.blue
  );

  // Row 2

  currentY += 24;

  drawKpiCard(
    doc,
    marginLeft,
    currentY,
    kpiCardWidth,
    "Supplier",
    formatNumber(totalSupplier),
    COLORS.orange
  );

  drawKpiCard(
    doc,
    marginLeft +
      kpiCardWidth +
      gap,
    currentY,
    kpiCardWidth,
    "Grand Total",
    formatRupiah(
      grandTotal
    ),
    COLORS.green
  );

  currentY += 26;

  // ===================================================
  // EMPTY
  // ===================================================

  if (rows.length === 0) {
    doc.setFillColor(
      ...COLORS.greenPale
    );

    doc.roundedRect(
      marginLeft,
      currentY,
      contentWidth,
      40,
      3,
      3,
      "F"
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(12);

    doc.setTextColor(...COLORS.dark);

    doc.text(
      "Tidak Ada Data Purchase",
      pageWidth / 2,
      currentY + 16,
      {
        align: "center",
      }
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(8);

    doc.setTextColor(...COLORS.muted);

    doc.text(
      "Tidak terdapat transaksi purchase pada periode yang dipilih.",
      pageWidth / 2,
      currentY + 24,
      {
        align: "center",
      }
    );

    finalizePageNumbers(
      doc,
      marginLeft,
      marginRight
    );

    doc.save(
      `${safeFileName(title)}.pdf`
    );

    return;
  }

  // ===================================================
  // SUPPLIER HEADER
  // ===================================================

  function drawSupplierHeader(
    y: number,
    supplierNumber: number,
    supplierName: string,
    supplierRows: any[][]
  ) {
    const supplierTotal =
      supplierRows.reduce(
        (sum, row) =>
          sum +
          parseNumericValue(row[subtotalIndex]),
        0
      );

    const supplierQty =
      supplierRows.reduce(
        (sum, row) =>
          sum +
          Number(
            row[qtyIndex] ?? 0
          ),
        0
      );

    const supplierPO =
      new Set(
        supplierRows.map(
          (row) =>
            String(
              row[poIndex] ?? ""
            )
        )
      ).size;

    doc.setFillColor(
      ...COLORS.dark
    );

    doc.roundedRect(
      marginLeft,
      y,
      contentWidth,
      13,
      2,
      2,
      "F"
    );

    // Supplier number

    doc.setFillColor(
      ...COLORS.green
    );

    doc.roundedRect(
      marginLeft + 3,
      y + 2.5,
      20,
      8,
      1.5,
      1.5,
      "F"
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(6.8);

    doc.setTextColor(
      ...COLORS.white
    );

    doc.text(
      `SUPPLIER ${supplierNumber}`,
      marginLeft + 13,
      y + 7.7,
      {
        align: "center",
      }
    );

    // Name

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(8.5);

    doc.setTextColor(
      ...COLORS.white
    );

    // Area nama dibuat lebih lebar
    // karena portrait.

    const nameStartX =
      marginLeft + 28;

    const statsStartX =
      pageWidth -
      marginRight -
      62;

    const maxNameWidth =
      statsStartX -
      nameStartX -
      4;

    let displayName =
      supplierName;

    while (
      doc.getTextWidth(
        displayName
      ) > maxNameWidth &&
      displayName.length > 5
    ) {
      displayName =
        displayName.slice(
          0,
          -4
        ) + "...";
    }

    doc.text(
      displayName,
      nameStartX,
      y + 7.8
    );

    // Stats

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(6.2);

    doc.setTextColor(
      195,
      215,
      207
    );

    doc.text(
      `${formatNumber(
        supplierPO
      )} PO • ${formatNumber(
        supplierQty
      )} Qty`,
      pageWidth -
        marginRight -
        5,
      y + 5.5,
      {
        align: "right",
      }
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(7.2);

    doc.setTextColor(
      ...COLORS.white
    );

    doc.text(
      formatRupiah(
        supplierTotal
      ),
      pageWidth -
        marginRight -
        5,
      y + 9.5,
      {
        align: "right",
      }
    );

    return y + 16;
  }

  // ===================================================
  // SUPPLIER TABLE
  // ===================================================

  function drawSupplierTable(
    y: number,
    supplierRows: any[][]
  ) {
    const tableRows =
      supplierRows.map(
        (row, index) => [
          index + 1,
          cleanText(
            row[poIndex]
          ),
          formatDate(
            row[dateIndex]
          ),
          cleanText(
            row[codeIndex]
          ),
          cleanText(
            row[nameIndex]
          ),
          cleanText(
            row[unitIndex]
          ),
          formatNumber(
            row[qtyIndex]
          ),
          formatRupiah(
            row[priceIndex]
          ),
          formatRupiah(
            row[subtotalIndex]
          ),
        ]
      );

    // ---------------------------------------------------
    // Portrait width:
    //
    // 6 + 19 + 19 + 21 + 43 + 11 + 12 + 29 + 29
    // = 189mm
    //
    // Content width = 190mm
    //
    // Jadi aman dengan margin 10mm.
    // ---------------------------------------------------

    const purchaseColumnStyles = {
      0: {
        cellWidth: 6,
        halign: "center" as const,
      },

      1: {
        cellWidth: 19,
        fontStyle: "bold" as const,
        textColor: COLORS.dark,
      },

      2: {
        cellWidth: 19,
        halign: "center" as const,
      },

      3: {
        cellWidth: 21,
      },

      4: {
        cellWidth: 43,
      },

      5: {
        cellWidth: 11,
        halign: "center" as const,
      },

      6: {
        cellWidth: 12,
        halign: "right" as const,
        fontStyle: "bold" as const,
      },

      7: {
        cellWidth: 29,
        halign: "right" as const,
      },

      8: {
        cellWidth: 29,
        halign: "right" as const,
        fontStyle: "bold" as const,
        textColor: COLORS.green,
      },
    };

    // Simpan nomor halaman tempat tabel dimulai.
    // Dipakai agar header hanya digambar pada
    // halaman lanjutan, bukan dua kali di halaman pertama.

    const tableStartPage =
      doc.internal.getNumberOfPages();

    autoTable(doc, {
      startY: y,

      head: [
        [
          "NO",
          "NO PO",
          "TANGGAL",
          "KODE BARANG",
          "NAMA BARANG",
          "SATUAN",
          "QTY",
          "HARGA",
          "SUBTOTAL",
        ],
      ],

      body: tableRows,

      theme: "plain",

      margin: {
        left: marginLeft,
        right: marginRight,
        top: 22,
        bottom: 14,
      },

      styles: {
        font: "helvetica",

        // Sedikit lebih kecil karena portrait.
        fontSize: 6.2,

        cellPadding: {
          top: 1.8,
          right: 1.4,
          bottom: 1.8,
          left: 1.4,
        },

        textColor:
          COLORS.text,

        lineColor:
          COLORS.border,

        lineWidth: 0.15,

        valign: "middle",

        overflow: "linebreak",
      },

      headStyles: {
        fillColor:
          COLORS.green,

        textColor:
          COLORS.white,

        fontStyle: "bold",

        fontSize: 6,

        halign: "center",

        valign: "middle",

        cellPadding: {
          top: 2,
          right: 1,
          bottom: 2,
          left: 1,
        },
      },

      alternateRowStyles: {
        fillColor:
          COLORS.zebra,
      },

      columnStyles:
        purchaseColumnStyles,

      didParseCell(data) {
        if (
          data.section !==
          "body"
        ) {
          return;
        }

        const originalRow =
          supplierRows[
            data.row.index
          ];

        if (!originalRow) {
          return;
        }

        // ------------------------------------------------
        // QTY
        // ------------------------------------------------

        if (
          data.column.index ===
          6
        ) {
          data.cell.text = [
            formatNumber(
              originalRow[
                qtyIndex
              ]
            ),
          ];

          data.cell.styles.halign =
            "right";
        }

        // ------------------------------------------------
        // HARGA
        // ------------------------------------------------

        if (
          data.column.index ===
          7
        ) {
          data.cell.text = [
            formatRupiah(
              originalRow[
                priceIndex
              ]
            ),
          ];

          data.cell.styles.halign =
            "right";
        }

        // ------------------------------------------------
        // SUBTOTAL
        // ------------------------------------------------

        if (
          data.column.index ===
          8
        ) {
          data.cell.text = [
            formatRupiah(
              originalRow[
                subtotalIndex
              ]
            ),
          ];

          data.cell.styles.halign =
            "right";
        }

        // ------------------------------------------------
        // STATUS
        //
        // Status tidak ditampilkan sebagai kolom
        // Purchase Detail saat ini, jadi tidak dipaksa
        // masuk ke index tabel.
        // ------------------------------------------------

        if (
          statusIndex >= 0
        ) {
          // Sengaja tidak melakukan styling status
          // karena kolom status tidak ada di tabel.
        }
      },

      didDrawPage() {
        const currentPage =
          doc.internal.getNumberOfPages();

        if (currentPage > tableStartPage) {
          drawContinuationHeader(
            doc,
            title,
            marginLeft,
            marginRight
          );
        }

        footer();
      },
    });

    return (
      (doc as any)
        .lastAutoTable
        ?.finalY ?? y
    );
  }

  // ===================================================
  // SUPPLIER LOOP
  // ===================================================

  let supplierNumber = 0;

  supplierGroups.forEach(
    (
      supplierRows,
      supplierName
    ) => {
      supplierNumber++;

      // ------------------------------------------------
      // Page safety
      // ------------------------------------------------

      // Portrait lebih pendek daripada landscape,
      // jadi supplier header + minimal table
      // harus dijaga supaya tidak terlalu bawah.

      if (
        currentY >
        pageHeight - 65
      ) {
        doc.addPage();

        currentY =
          header();

        currentY += 26;
      }

      // ------------------------------------------------
      // Supplier
      // ------------------------------------------------

      currentY =
        drawSupplierHeader(
          currentY,
          supplierNumber,
          supplierName,
          supplierRows
        );

      // ------------------------------------------------
      // Table
      // ------------------------------------------------

      currentY =
        drawSupplierTable(
          currentY,
          supplierRows
        ) + 4;

      // ------------------------------------------------
      // Supplier total
      // ------------------------------------------------

      const supplierTotal =
        supplierRows.reduce(
          (sum, row) =>
            sum +
            parseNumericValue(
              row[subtotalIndex]
            ),
          0
        );

      if (
        currentY >
        pageHeight - 35
      ) {
        doc.addPage();

        currentY =
          header();

        currentY += 26;
      }

      doc.setFillColor(
        ...COLORS.greenPale
      );

      doc.roundedRect(
        marginLeft,
        currentY,
        contentWidth,
        11,
        2,
        2,
        "F"
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(7);

      doc.setTextColor(
        ...COLORS.dark2
      );

      let supplierTotalLabel =
        `TOTAL ${upper(
          supplierName
        )}`;

      // Supplier total label jangan terlalu
      // panjang sampai mendekati nominal.

      const totalAmountX =
        pageWidth -
        marginRight -
        5;

      const maxTotalLabelWidth =
        contentWidth - 65;

      while (
        doc.getTextWidth(
          supplierTotalLabel
        ) >
          maxTotalLabelWidth &&
        supplierTotalLabel.length > 15
      ) {
        supplierTotalLabel =
          supplierTotalLabel.slice(
            0,
            -4
          ) + "...";
      }

      doc.text(
        supplierTotalLabel,
        marginLeft + 5,
        currentY + 7
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(8);

      doc.setTextColor(
        ...COLORS.green
      );

      doc.text(
        formatRupiah(
          supplierTotal
        ),
        totalAmountX,
        currentY + 7,
        {
          align: "right",
        }
      );

      currentY += 17;
    }
  );

  // ===================================================
  // GRAND TOTAL SAFETY
  // ===================================================

  if (
    currentY >
    pageHeight - 42
  ) {
    doc.addPage();

    currentY =
      header();

    currentY += 26;
  }

  // ===================================================
  // GRAND TOTAL
  // ===================================================

  doc.setFillColor(
    ...COLORS.dark
  );

  doc.roundedRect(
    marginLeft,
    currentY,
    contentWidth,
    25,
    3,
    3,
    "F"
  );

  // Accent

  doc.setFillColor(
    ...COLORS.green
  );

  doc.roundedRect(
    marginLeft,
    currentY,
    4,
    25,
    2,
    2,
    "F"
  );

  // Summary label

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(7);

  doc.setTextColor(
    185,
    210,
    201
  );

  doc.text(
    "SUMMARY",
    marginLeft + 10,
    currentY + 7
  );

  // Title

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(11);

  doc.setTextColor(
    ...COLORS.white
  );

  doc.text(
    "GRAND TOTAL PURCHASE",
    marginLeft + 10,
    currentY + 16
  );

  // Amount

  doc.setFont(
    "helvetica",
    "bold"
  );

  // Portrait -> nominal dibuat sedikit lebih kecil
  // supaya tetap aman dengan lebar halaman.

  doc.setFontSize(12.5);

  doc.text(
    formatRupiah(
      grandTotal
    ),
    pageWidth -
      marginRight -
      8,
    currentY + 14,
    {
      align: "right",
    }
  );

  // Meta

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(6.3);

  doc.setTextColor(
    190,
    210,
    202
  );

  doc.text(
    `${formatNumber(
      totalPO
    )} Purchase Order`,
    marginLeft + 10,
    currentY + 21
  );

  doc.text(
    `${formatNumber(
      totalSupplier
    )} Supplier`,
    marginLeft + 60,
    currentY + 21
  );

  doc.text(
    `${formatNumber(
      totalQty
    )} Quantity`,
    marginLeft + 99,
    currentY + 21
  );

  doc.text(
    `${formatNumber(
      totalDetail
    )} Detail`,
    marginLeft + 143,
    currentY + 21
  );

  // ===================================================
  // FINALIZE
  // ===================================================

  finalizePageNumbers(
    doc,
    marginLeft,
    marginRight
  );

  doc.save(
    `${safeFileName(title)}.pdf`
  );
}

// =====================================================
// ALIAS
// =====================================================

export const exportReportPDF =
  exportReportPdf;