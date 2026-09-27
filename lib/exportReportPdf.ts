import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY } from "@/lib/company";

// =====================================================
// MGB PREMIUM REPORT PDF
// =====================================================
//
// DESIGN
// -----------------------------------------------------
// - Premium corporate MGB
// - Clean executive-report layout
// - Deep green / ivory / neutral palette
// - Strong typography hierarchy
// - Elegant KPI cards
// - Compact zebra tables
// - Modern status badges
// - Supplier grouping
// - Premium grand total
// - Automatic page numbering
// - Multi-page safe
// - Safe filename
//
// EXPORTS
// -----------------------------------------------------
// exportReportPdf()
// exportPurchaseReportPdf()
// exportReportPDF
//
// =====================================================

// =====================================================
// COLOR SYSTEM
// =====================================================

const COLORS = {
  dark: [22, 45, 38] as [number, number, number],
  dark2: [36, 70, 59] as [number, number, number],

  green: [58, 119, 98] as [number, number, number],
  greenDark: [42, 91, 74] as [number, number, number],
  greenMid: [91, 143, 123] as [number, number, number],

  greenLight: [233, 243, 238] as [number, number, number],
  greenPale: [247, 250, 248] as [number, number, number],

  ivory: [250, 249, 246] as [number, number, number],

  blue: [61, 106, 157] as [number, number, number],
  blueLight: [236, 243, 250] as [number, number, number],

  orange: [181, 119, 42] as [number, number, number],
  orangeLight: [252, 246, 235] as [number, number, number],

  red: [174, 69, 69] as [number, number, number],
  redLight: [253, 239, 239] as [number, number, number],

  purple: [105, 83, 148] as [number, number, number],
  purpleLight: [244, 240, 250] as [number, number, number],

  text: [48, 58, 53] as [number, number, number],
  muted: [116, 126, 121] as [number, number, number],
  muted2: [151, 159, 154] as [number, number, number],

  border: [220, 228, 224] as [number, number, number],
  borderDark: [204, 216, 210] as [number, number, number],

  white: [255, 255, 255] as [number, number, number],
  black: [20, 20, 20] as [number, number, number],

  zebra: [249, 251, 250] as [number, number, number],
};

// =====================================================
// BASIC HELPERS
// =====================================================

function parseNumericValue(value: any) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const text = String(value).trim();

  if (!text) {
    return 0;
  }

  // Support Indonesian currency:
  // Rp 25.000
  // Rp 25.000,50
  if (/^rp\s*/i.test(text)) {
    const cleaned = text
      .replace(/^rp\s*/i, "")
      .replace(/\./g, "")
      .replace(/,/g, ".");

    const number = Number(cleaned);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  // Support formatted number such as:
  // 25.000
  // 25.000,50
  if (
    text.includes(".") &&
    text.includes(",")
  ) {
    const cleaned = text
      .replace(/\./g, "")
      .replace(/,/g, ".");

    const number = Number(cleaned);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  const number = Number(text);

  return Number.isFinite(number)
    ? number
    : 0;
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
  return String(value ?? "")
    .trim()
    .toUpperCase();
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

function truncateText(
  doc: jsPDF,
  value: string,
  maxWidth: number
) {
  let result = value;

  if (
    doc.getTextWidth(result) <= maxWidth
  ) {
    return result;
  }

  while (
    doc.getTextWidth(`${result}...`) >
      maxWidth &&
    result.length > 4
  ) {
    result = result.slice(0, -1);
  }

  return `${result}...`;
}

// =====================================================
// COLUMN DETECTION
// =====================================================

function findColumn(
  columns: string[],
  candidates: string[]
) {
  const normalizedColumns =
    columns.map((column) => upper(column));

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
  const normalizedColumns =
    columns.map((column) => upper(column));

  for (const candidate of candidates) {
    const index =
      normalizedColumns.findIndex(
        (column) =>
          column.includes(
            upper(candidate)
          )
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
// STATUS STYLE
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
  const dateIndex =
    findColumnContains(columns, [
      "TANGGAL",
      "DATE",
      "WAKTU",
      "RECEIVED",
      "RECEIPT",
      "CREATED",
    ]);

  if (dateIndex < 0) {
    return "Semua Periode";
  }

  const dates = rows
    .map((row) => row[dateIndex])
    .filter(Boolean)
    .map((value) => {
      const date = new Date(value);

      if (
        Number.isNaN(date.getTime())
      ) {
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
  return new Date()
    .getTime()
    .toString()
    .slice(-8);
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

  const contentWidth =
    pageWidth -
    marginLeft -
    marginRight;

  // ---------------------------------------------------
  // TOP ACCENT
  // ---------------------------------------------------

  doc.setFillColor(...COLORS.green);

  doc.rect(
    0,
    0,
    pageWidth,
    3.2,
    "F"
  );

  // Thin secondary accent
  doc.setFillColor(...COLORS.greenLight);

  doc.rect(
    0,
    3.2,
    pageWidth,
    1,
    "F"
  );

  // ---------------------------------------------------
  // BRAND
  // ---------------------------------------------------

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(26);

  doc.setTextColor(...COLORS.dark);

  doc.text(
    "MGB",
    marginLeft,
    17
  );

  doc.setFontSize(7.2);

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

  doc.setFontSize(6.8);

  doc.setTextColor(...COLORS.greenDark);

  doc.text(
    upper(reportCategory),
    pageWidth - marginRight,
    12,
    {
      align: "right",
    }
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(6.8);

  doc.setTextColor(...COLORS.muted);

  doc.text(
    `REPORT ID  ${generateReportId()}`,
    pageWidth - marginRight,
    17,
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
    23,
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
    title.length > 48
      ? 13.5
      : 17
  );

  doc.setTextColor(...COLORS.dark);

  const safeTitle =
    truncateText(
      doc,
      title,
      contentWidth * 0.72
    );

  doc.text(
    safeTitle,
    marginLeft,
    39
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(7.8);

  doc.setTextColor(...COLORS.muted);

  doc.text(
    subtitle,
    marginLeft,
    45
  );

  // ---------------------------------------------------
  // META CARD
  // ---------------------------------------------------

  const metaY = 50;
  const metaH = 14;

  doc.setFillColor(
    ...COLORS.greenPale
  );

  doc.roundedRect(
    marginLeft,
    metaY,
    contentWidth,
    metaH,
    2.5,
    2.5,
    "F"
  );

  // Small accent
  doc.setFillColor(...COLORS.green);

  doc.roundedRect(
    marginLeft,
    metaY,
    2.5,
    metaH,
    1.2,
    1.2,
    "F"
  );

  // Period label
  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(6.2);

  doc.setTextColor(...COLORS.muted);

  doc.text(
    "PERIODE",
    marginLeft + 7,
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
    marginLeft + 7,
    metaY + 10
  );

  // Divider
  const dividerX =
    marginLeft + 100;

  doc.setDrawColor(
    ...COLORS.border
  );

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

  doc.setFontSize(6.2);

  doc.setTextColor(...COLORS.muted);

  doc.text(
    "DICETAK",
    dividerX + 7,
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
    dividerX + 7,
    metaY + 10
  );

  return metaY + metaH;
}

// =====================================================
// CONTINUATION HEADER
// =====================================================

function drawContinuationHeader(
  doc: jsPDF,
  title: string,
  marginLeft: number,
  marginRight: number
) {
  const pageWidth =
    doc.internal.pageSize.getWidth();

  doc.setFillColor(...COLORS.green);

  doc.rect(
    0,
    0,
    pageWidth,
    2.6,
    "F"
  );

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(12);

  doc.setTextColor(...COLORS.dark);

  doc.text(
    "MGB",
    marginLeft,
    11
  );

  doc.setFontSize(7);

  doc.setTextColor(...COLORS.green);

  doc.text(
    "INVENTORY SYSTEM",
    marginLeft + 18,
    11
  );

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(
    title.length > 65
      ? 6.8
      : 7.8
  );

  doc.setTextColor(...COLORS.dark2);

  const continuationTitle =
    truncateText(
      doc,
      `${title} — Lanjutan`,
      pageWidth -
        marginLeft -
        marginRight -
        55
    );

  doc.text(
    continuationTitle,
    pageWidth - marginRight,
    11,
    {
      align: "right",
    }
  );

  doc.setDrawColor(
    ...COLORS.border
  );

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

  doc.setDrawColor(
    ...COLORS.border
  );

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

  doc.setFontSize(6.8);

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
}

// =====================================================
// PAGE NUMBERS
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

    doc.setDrawColor(
      ...COLORS.border
    );

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

    doc.setFontSize(6.8);

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

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setTextColor(...COLORS.dark2);

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
  // Outer
  doc.setFillColor(...COLORS.white);

  doc.setDrawColor(
    ...COLORS.border
  );

  doc.setLineWidth(0.25);

  doc.roundedRect(
    x,
    y,
    width,
    21,
    2.5,
    2.5,
    "FD"
  );

  // Accent bar
  doc.setFillColor(...accent);

  doc.roundedRect(
    x,
    y,
    2.5,
    21,
    1.2,
    1.2,
    "F"
  );

  // Label
  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(6.3);

  doc.setTextColor(...COLORS.muted);

  doc.text(
    upper(label),
    x + 7,
    y + 6.5
  );

  // Value
  doc.setFont(
    "helvetica",
    "bold"
  );

  let fontSize = 13;

  if (value.length > 26) {
    fontSize = 8.2;
  } else if (value.length > 19) {
    fontSize = 9.5;
  } else if (value.length > 14) {
    fontSize = 11;
  }

  doc.setFontSize(fontSize);

  doc.setTextColor(...COLORS.dark);

  const safeValue =
    truncateText(
      doc,
      value,
      width - 14
    );

  doc.text(
    safeValue,
    x + 7,
    y + 15
  );

  // Bottom accent dot
  doc.setFillColor(...accent);

  doc.circle(
    x + width - 7,
    y + 7,
    1.4,
    "F"
  );
}

// =====================================================
// GENERIC SUMMARY
// =====================================================

function buildGenericSummary(
  columns: string[],
  rows: any[][]
) {
  const qtyExact =
    findColumn(
      columns,
      [
        "Qty",
        "Quantity",
        "Jumlah",
      ]
    );

  const qtyIndex =
    qtyExact >= 0
      ? qtyExact
      : findColumnContains(
          columns,
          [
            "QTY",
            "QUANTITY",
          ]
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
        Number(
          row[qtyIndex] ?? 0
        ),
      0
    );
  }

  let grandTotal = 0;

  if (totalIndex >= 0) {
    grandTotal = rows.reduce(
      (sum, row) =>
        sum +
        parseNumericValue(
          row[totalIndex]
        ),
      0
    );
  }

  const statuses =
    statusIndex >= 0
      ? new Set(
          rows.map((row) =>
            String(
              row[
                statusIndex
              ] ?? ""
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

export function exportReportPdf(
  title: string,
  columns: string[],
  rows: any[][]
) {
  // ===================================================
  // DOCUMENT
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
    titleUpper.includes(
      "BARANG MASUK"
    )
  ) {
    reportCategory =
      "INBOUND / RECEIVING";
  } else if (
    titleUpper.includes(
      "BARANG KELUAR"
    )
  ) {
    reportCategory =
      "OUTBOUND / ISSUE";
  } else if (
    titleUpper.includes(
      "STOCK"
    ) ||
    titleUpper.includes(
      "STOK"
    )
  ) {
    reportCategory =
      "INVENTORY / STOCK";
  } else if (
    titleUpper.includes(
      "TRANSFER"
    )
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

  currentY += 27;

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
      45,
      3,
      3,
      "F"
    );

    doc.setFillColor(
      ...COLORS.green
    );

    doc.roundedRect(
      pageWidth / 2 - 18,
      currentY + 7,
      36,
      1.8,
      0.9,
      0.9,
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
      currentY + 20,
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
      currentY + 29,
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
  // TABLE DATA
  // ===================================================

  const bodyRows =
    rows.map((row) =>
      columns.map(
        (_, index) =>
          row[index]
      )
    );

  // ===================================================
  // COLUMN WIDTH
  // ===================================================

  const dynamicCellWidth =
    contentWidth /
    Math.max(
      columns.length,
      1
    );

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
      columns.map(
        (column) =>
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
        : 7.4,

      cellPadding: {
        top: 2.1,
        right: 2.4,
        bottom: 2.1,
        left: 2.4,
      },

      textColor:
        COLORS.text,

      lineColor:
        COLORS.border,

      lineWidth: 0.12,

      valign: "middle",

      overflow: "linebreak",
    },

    headStyles: {
      fillColor:
        COLORS.dark,

      textColor:
        COLORS.white,

      fontStyle: "bold",

      fontSize: isWide
        ? 6.6
        : 6.9,

      halign: "center",

      valign: "middle",

      cellPadding: {
        top: 2.8,
        right: 2,
        bottom: 2.8,
        left: 2,
      },
    },

    alternateRowStyles: {
      fillColor:
        COLORS.zebra,
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
        rows[
          data.row.index
        ];

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

      if (
        currentPage >
        tableStartPage
      ) {
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

export function exportPurchaseReportPdf(
  title: string,
  columns: string[],
  rows: any[][]
) {
  // ===================================================
  // DOCUMENT
  // ===================================================

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

  const supplierExact =
    findColumn(
      columns,
      ["Supplier"]
    );

  const supplierIndex =
    supplierExact >= 0
      ? supplierExact
      : 3;

  const statusIndex =
    findColumn(
      columns,
      ["Status"]
    );

  const subtotalExact =
    findColumn(
      columns,
      [
        "Subtotal",
        "Total",
      ]
    );

  const subtotalIndex =
    subtotalExact >= 0
      ? subtotalExact
      : 10;

  const qtyExact =
    findColumn(
      columns,
      [
        "Qty",
        "Quantity",
      ]
    );

  const qtyIndex =
    qtyExact >= 0
      ? qtyExact
      : 8;

  const poExact =
    findColumn(
      columns,
      [
        "No PO",
        "PO",
        "Purchase Order",
      ]
    );

  const poIndex =
    poExact >= 0
      ? poExact
      : 1;

  const dateExact =
    findColumn(
      columns,
      [
        "Tanggal",
        "Date",
      ]
    );

  const dateIndex =
    dateExact >= 0
      ? dateExact
      : 2;

  const codeExact =
    findColumn(
      columns,
      [
        "Kode Barang",
        "Kode",
      ]
    );

  const codeIndex =
    codeExact >= 0
      ? codeExact
      : 5;

  const nameExact =
    findColumn(
      columns,
      [
        "Nama Barang",
        "Barang",
      ]
    );

  const nameIndex =
    nameExact >= 0
      ? nameExact
      : 6;

  const unitExact =
    findColumn(
      columns,
      [
        "Satuan",
        "Unit",
      ]
    );

  const unitIndex =
    unitExact >= 0
      ? unitExact
      : 7;

  const priceExact =
    findColumn(
      columns,
      [
        "Harga",
        "Price",
      ]
    );

  const priceIndex =
    priceExact >= 0
      ? priceExact
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
        row[
          supplierIndex
        ] ??
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
          row[poIndex] ??
            ""
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
        parseNumericValue(
          row[
            subtotalIndex
          ]
        ),
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
  // KPI
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
    formatNumber(
      totalPO
    ),
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
    formatNumber(
      totalQty
    ),
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
    formatNumber(
      totalSupplier
    ),
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

  currentY += 27;

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
      45,
      3,
      3,
      "F"
    );

    doc.setFillColor(
      ...COLORS.green
    );

    doc.roundedRect(
      pageWidth / 2 - 18,
      currentY + 7,
      36,
      1.8,
      0.9,
      0.9,
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
      currentY + 20,
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
      currentY + 29,
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
          parseNumericValue(
            row[
              subtotalIndex
            ]
          ),
        0
      );

    const supplierQty =
      supplierRows.reduce(
        (sum, row) =>
          sum +
          Number(
            row[
              qtyIndex
            ] ?? 0
          ),
        0
      );

    const supplierPO =
      new Set(
        supplierRows.map(
          (row) =>
            String(
              row[
                poIndex
              ] ?? ""
            )
        )
      ).size;

    // Main block
    doc.setFillColor(
      ...COLORS.dark
    );

    doc.roundedRect(
      marginLeft,
      y,
      contentWidth,
      14,
      2.5,
      2.5,
      "F"
    );

    // Number badge
    doc.setFillColor(
      ...COLORS.green
    );

    doc.roundedRect(
      marginLeft + 3,
      y + 3,
      22,
      8,
      1.5,
      1.5,
      "F"
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(6.5);

    doc.setTextColor(
      ...COLORS.white
    );

    doc.text(
      `SUPPLIER ${supplierNumber}`,
      marginLeft + 14,
      y + 8.2,
      {
        align: "center",
      }
    );

    // Supplier name
    const nameStartX =
      marginLeft + 30;

    const statsStartX =
      pageWidth -
      marginRight -
      66;

    const maxNameWidth =
      statsStartX -
      nameStartX -
      4;

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(8.5);

    doc.setTextColor(
      ...COLORS.white
    );

    const displayName =
      truncateText(
        doc,
        supplierName,
        maxNameWidth
      );

    doc.text(
      displayName,
      nameStartX,
      y + 8.4
    );

    // Stats
    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(6.1);

    doc.setTextColor(
      190,
      213,
      202
    );

    doc.text(
      `${formatNumber(
        supplierPO
      )} PO  •  ${formatNumber(
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

    doc.setFontSize(7.3);

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
      y + 10,
      {
        align: "right",
      }
    );

    return y + 17;
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
            row[
              subtotalIndex
            ]
          ),
        ]
      );

    // =================================================
    // PORTRAIT WIDTH
    // =================================================
    //
    // 6 + 19 + 19 + 21 + 43
    // + 11 + 12 + 29 + 29
    // = 189mm
    //
    // Content = 190mm
    //
    // =================================================

    const purchaseColumnStyles = {
      0: {
        cellWidth: 6,
        halign:
          "center" as const,
      },

      1: {
        cellWidth: 19,
        fontStyle:
          "bold" as const,
        textColor:
          COLORS.dark,
      },

      2: {
        cellWidth: 19,
        halign:
          "center" as const,
      },

      3: {
        cellWidth: 21,
      },

      4: {
        cellWidth: 43,
      },

      5: {
        cellWidth: 11,
        halign:
          "center" as const,
      },

      6: {
        cellWidth: 12,
        halign:
          "right" as const,
        fontStyle:
          "bold" as const,
      },

      7: {
        cellWidth: 29,
        halign:
          "right" as const,
      },

      8: {
        cellWidth: 29,
        halign:
          "right" as const,
        fontStyle:
          "bold" as const,
        textColor:
          COLORS.green,
      },
    };

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

        fontSize: 6.15,

        cellPadding: {
          top: 1.75,
          right: 1.35,
          bottom: 1.75,
          left: 1.35,
        },

        textColor:
          COLORS.text,

        lineColor:
          COLORS.border,

        lineWidth: 0.12,

        valign: "middle",

        overflow:
          "linebreak",
      },

      headStyles: {
        fillColor:
          COLORS.green,

        textColor:
          COLORS.white,

        fontStyle:
          "bold",

        fontSize: 5.9,

        halign:
          "center",

        valign:
          "middle",

        cellPadding: {
          top: 2.2,
          right: 1,
          bottom: 2.2,
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
        // PRICE
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

        // Status sengaja tidak ditampilkan
        // pada purchase detail.
        if (
          statusIndex >= 0
        ) {
          // intentionally unused
        }
      },

      didDrawPage() {
        const currentPage =
          doc.internal.getNumberOfPages();

        if (
          currentPage >
          tableStartPage
        ) {
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
      // PAGE SAFETY
      // ------------------------------------------------

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
      // SUPPLIER HEADER
      // ------------------------------------------------

      currentY =
        drawSupplierHeader(
          currentY,
          supplierNumber,
          supplierName,
          supplierRows
        );

      // ------------------------------------------------
      // SUPPLIER TABLE
      // ------------------------------------------------

      currentY =
        drawSupplierTable(
          currentY,
          supplierRows
        ) + 4;

      // ------------------------------------------------
      // SUPPLIER TOTAL
      // ------------------------------------------------

      const supplierTotal =
        supplierRows.reduce(
          (sum, row) =>
            sum +
            parseNumericValue(
              row[
                subtotalIndex
              ]
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

      // Total card
      doc.setFillColor(
        ...COLORS.greenPale
      );

      doc.roundedRect(
        marginLeft,
        currentY,
        contentWidth,
        12,
        2.2,
        2.2,
        "F"
      );

      // Accent
      doc.setFillColor(
        ...COLORS.green
      );

      doc.roundedRect(
        marginLeft,
        currentY,
        2.5,
        12,
        1.2,
        1.2,
        "F"
      );

      // Label
      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(6.8);

      doc.setTextColor(
        ...COLORS.dark2
      );

      let supplierTotalLabel =
        `TOTAL ${upper(
          supplierName
        )}`;

      const totalAmountX =
        pageWidth -
        marginRight -
        5;

      const maxTotalLabelWidth =
        contentWidth - 68;

      supplierTotalLabel =
        truncateText(
          doc,
          supplierTotalLabel,
          maxTotalLabelWidth
        );

      doc.text(
        supplierTotalLabel,
        marginLeft + 7,
        currentY + 7.6
      );

      // Amount
      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(8.2);

      doc.setTextColor(
        ...COLORS.greenDark
      );

      doc.text(
        formatRupiah(
          supplierTotal
        ),
        totalAmountX,
        currentY + 7.6,
        {
          align: "right",
        }
      );

      currentY += 18;
    }
  );

  // ===================================================
  // GRAND TOTAL SAFETY
  // ===================================================

  if (
    currentY >
    pageHeight - 45
  ) {
    doc.addPage();

    currentY =
      header();

    currentY += 26;
  }

  // ===================================================
  // GRAND TOTAL CARD
  // ===================================================

  doc.setFillColor(
    ...COLORS.dark
  );

  doc.roundedRect(
    marginLeft,
    currentY,
    contentWidth,
    28,
    3.5,
    3.5,
    "F"
  );

  // Left accent
  doc.setFillColor(
    ...COLORS.green
  );

  doc.roundedRect(
    marginLeft,
    currentY,
    4,
    28,
    2,
    2,
    "F"
  );

  // SUMMARY
  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(6.5);

  doc.setTextColor(
    185,
    211,
    201
  );

  doc.text(
    "PURCHASE SUMMARY",
    marginLeft + 11,
    currentY + 7
  );

  // Main title
  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(10.8);

  doc.setTextColor(
    ...COLORS.white
  );

  doc.text(
    "GRAND TOTAL PURCHASE",
    marginLeft + 11,
    currentY + 16
  );

  // Meta
  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(6.2);

  doc.setTextColor(
    185,
    208,
    199
  );

  doc.text(
    `${formatNumber(
      totalPO
    )} Purchase Order`,
    marginLeft + 11,
    currentY + 23
  );

  doc.text(
    `${formatNumber(
      totalSupplier
    )} Supplier`,
    marginLeft + 61,
    currentY + 23
  );

  doc.text(
    `${formatNumber(
      totalQty
    )} Quantity`,
    marginLeft + 101,
    currentY + 23
  );

  doc.text(
    `${formatNumber(
      totalDetail
    )} Detail`,
    marginLeft + 144,
    currentY + 23
  );

  // Amount background
  const amountBoxWidth = 63;

  const amountBoxX =
    pageWidth -
    marginRight -
    amountBoxWidth -
    6;

  doc.setFillColor(
    ...COLORS.dark2
  );

  doc.roundedRect(
    amountBoxX,
    currentY + 4,
    amountBoxWidth,
    18,
    2.5,
    2.5,
    "F"
  );

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(6);

  doc.setTextColor(
    174,
    201,
    191
  );

  doc.text(
    "TOTAL",
    amountBoxX + 5,
    currentY + 9
  );

  doc.setFontSize(11.5);

  doc.setTextColor(
    ...COLORS.white
  );

  const grandTotalText =
    formatRupiah(
      grandTotal
    );

  doc.text(
    grandTotalText,
    amountBoxX +
      amountBoxWidth -
      5,
    currentY + 16.5,
    {
      align: "right",
    }
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