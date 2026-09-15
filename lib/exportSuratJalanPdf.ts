import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY } from "@/lib/company";

export function exportSuratJalanPDF(data: any) {
  const doc = new jsPDF("p", "mm", "a4");

  // =========================================================
  // PAGE CONFIG
  // =========================================================

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginLeft = 12;
  const marginRight = 12;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // =========================================================
  // PDF METADATA
  // =========================================================

  doc.setProperties({
    title: `Surat Jalan ${
      data?.suratJalan?.number ??
      data?.number ??
      ""
    }`,
    subject: "Dokumen Surat Jalan",
    author: COMPANY.name,
    creator: "MGB ERP",
    keywords:
      "MGB ERP, Surat Jalan, Delivery Order",
  });

  // =========================================================
  // PREMIUM CORPORATE PALETTE
  // =========================================================

  const COLORS = {
    primary: [39, 111, 94] as [number, number, number],
    primaryDark: [24, 70, 59] as [number, number, number],
    primaryLight: [237, 247, 243] as [number, number, number],

    text: [28, 37, 41] as [number, number, number],
    textSoft: [82, 94, 99] as [number, number, number],
    muted: [117, 128, 133] as [number, number, number],

    border: [214, 224, 220] as [number, number, number],
    borderSoft: [232, 237, 235] as [number, number, number],

    white: [255, 255, 255] as [number, number, number],
    background: [248, 250, 249] as [number, number, number],

    success: [22, 128, 93] as [number, number, number],
    successLight: [235, 248, 242] as [number, number, number],

    warning: [177, 113, 21] as [number, number, number],
    warningLight: [255, 248, 232] as [number, number, number],

    danger: [190, 57, 57] as [number, number, number],
    dangerLight: [253, 240, 240] as [number, number, number],
  };

  // =========================================================
  // HELPERS
  // =========================================================

  function formatNumber(value: any) {
    const number = Number(value ?? 0);

    return number.toLocaleString("id-ID", {
      maximumFractionDigits: 2,
    });
  }

  function formatCurrency(value: any) {
    const number = Number(value ?? 0);

    return `Rp ${number.toLocaleString("id-ID", {
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(value: any) {
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
  }

  function safeText(value: any) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      return "-";
    }

    return String(value);
  }

  function setFont(style: "normal" | "bold") {
    doc.setFont("helvetica", style);
  }

  function roundedBox(
    x: number,
    y: number,
    w: number,
    h: number,
    radius = 3,
    fill = COLORS.white,
    stroke = COLORS.border
  ) {
    doc.setFillColor(...fill);
    doc.setDrawColor(...stroke);
    doc.setLineWidth(0.25);

    doc.roundedRect(
      x,
      y,
      w,
      h,
      radius,
      radius,
      "FD"
    );
  }

  function getStatusLabel() {
    return String(
      data?.status ?? "DRAFT"
    ).toUpperCase();
  }

  function getStatusColors() {
    const status = getStatusLabel();

    if (
      [
        "RELEASED",
        "DELIVERED",
        "RECEIVED",
        "SELESAI",
      ].includes(status)
    ) {
      return {
        bg: COLORS.successLight,
        text: COLORS.success,
        border: [190, 230, 214] as [
          number,
          number,
          number
        ],
      };
    }

    if (
      [
        "CANCELLED",
        "VOID",
        "VOIDED",
      ].includes(status)
    ) {
      return {
        bg: COLORS.dangerLight,
        text: COLORS.danger,
        border: [243, 202, 202] as [
          number,
          number,
          number
        ],
      };
    }

    return {
      bg: COLORS.warningLight,
      text: COLORS.warning,
      border: [244, 220, 172] as [
        number,
        number,
        number
      ],
    };
  }

  // =========================================================
  // FOOTER
  // =========================================================

  function drawPageFooter() {
    const pageNumber =
      doc.internal.getCurrentPageInfo().pageNumber;

    const pageCount =
      (doc as any).internal.getNumberOfPages();

    const footerY = pageHeight - 9;

    doc.setDrawColor(...COLORS.borderSoft);
    doc.setLineWidth(0.25);

    doc.line(
      marginLeft,
      pageHeight - 15,
      pageWidth - marginRight,
      pageHeight - 15
    );

    setFont("bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.primaryDark);

    doc.text(
      COMPANY.name ?? "MGB ERP",
      marginLeft,
      footerY
    );

    setFont("normal");
    doc.setFontSize(6.2);
    doc.setTextColor(...COLORS.muted);

    doc.text(
      `SURAT JALAN • ${
        data?.suratJalan?.number ??
        data?.number ??
        "-"
      }`,
      pageWidth / 2,
      footerY,
      {
        align: "center",
      }
    );

    doc.text(
      `Halaman ${pageNumber} / ${pageCount}`,
      pageWidth - marginRight,
      footerY,
      {
        align: "right",
      }
    );
  }

  // =========================================================
  // DATA
  // =========================================================

  const items = Array.isArray(data?.items)
    ? data.items
    : [];

  const activeItems = items.filter(
    (item: any) => !item?.voided
  );

  const voidItems = items.filter(
    (item: any) => Boolean(item?.voided)
  );

  // =========================================================
  // TOTAL
  // =========================================================

  const total = activeItems.reduce(
    (acc: number, item: any) => {
      const qty = Number(item?.qty ?? 0);
      const price = Number(item?.price ?? 0);

      const subtotal =
        item?.subtotal != null &&
        Number(item.subtotal) > 0
          ? Number(item.subtotal)
          : qty * price;

      return acc + subtotal;
    },
    0
  );

  const activeQty = activeItems.reduce(
    (acc: number, item: any) =>
      acc + Number(item?.qty ?? 0),
    0
  );

  const voidQty = voidItems.reduce(
    (acc: number, item: any) =>
      acc + Number(item?.qty ?? 0),
    0
  );

  // =========================================================
  // COMPANY HEADER
  // =========================================================

  function drawCompanyHeader() {
    const y = 10;

    // =======================================================
    // MGB WORDMARK
    //
    // Tidak menggunakan logo grafis.
    // MGB dibuat sebagai wordmark horizontal.
    // =======================================================

    const mgbX = marginLeft;
    const mgbY = y + 12;

    setFont("bold");
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.primaryDark);

    doc.text(
      "MGB",
      mgbX,
      mgbY
    );

    // =======================================================
    // COMPANY NAME
    // =======================================================

    const companyX = marginLeft + 25;

    setFont("bold");
    doc.setFontSize(13.5);
    doc.setTextColor(...COLORS.primaryDark);

    doc.text(
      safeText(COMPANY.name).toUpperCase(),
      companyX,
      y + 8
    );

    // =======================================================
    // COMPANY DETAILS
    // =======================================================

    const details: string[] = [];

    if (COMPANY.address) {
      details.push(COMPANY.address);
    }

    if (COMPANY.phone) {
      details.push(`Telp. ${COMPANY.phone}`);
    }

    if (COMPANY.email) {
      details.push(COMPANY.email);
    }

    const detailText = details.join("  •  ");

    if (detailText) {
      setFont("normal");
      doc.setFontSize(6.7);
      doc.setTextColor(...COLORS.textSoft);

      doc.text(
        detailText,
        companyX,
        y + 13,
        {
          maxWidth: 112,
        }
      );
    }

    // =======================================================
    // WEBSITE
    // =======================================================

    if (COMPANY.website) {
      setFont("normal");
      doc.setFontSize(6.7);
      doc.setTextColor(...COLORS.primary);

      doc.text(
        COMPANY.website,
        companyX,
        y + 18
      );
    }

    // =======================================================
    // STATUS BADGE
    // =======================================================

    const statusColors =
      getStatusColors();

    const statusWidth = 47;
    const statusHeight = 21;

    const statusX =
      pageWidth -
      marginRight -
      statusWidth;

    doc.setFillColor(
      ...statusColors.bg
    );

    doc.setDrawColor(
      ...statusColors.border
    );

    doc.setLineWidth(0.3);

    doc.roundedRect(
      statusX,
      y,
      statusWidth,
      statusHeight,
      3,
      3,
      "FD"
    );

    setFont("bold");
    doc.setFontSize(5.6);
    doc.setTextColor(
      ...statusColors.text
    );

    doc.text(
      "STATUS DOKUMEN",
      statusX + statusWidth / 2,
      y + 7,
      {
        align: "center",
      }
    );

    doc.setFontSize(9.2);

    doc.text(
      getStatusLabel(),
      statusX + statusWidth / 2,
      y + 15,
      {
        align: "center",
      }
    );

    // =======================================================
    // PREMIUM DIVIDER
    // =======================================================

    const dividerY = y + 26;

    doc.setDrawColor(
      ...COLORS.primary
    );

    doc.setLineWidth(0.85);

    doc.line(
      marginLeft,
      dividerY,
      pageWidth - marginRight,
      dividerY
    );

    doc.setDrawColor(
      ...COLORS.border
    );

    doc.setLineWidth(0.2);

    doc.line(
      marginLeft,
      dividerY + 1.6,
      pageWidth - marginRight,
      dividerY + 1.6
    );

    return dividerY + 1.6;
  }

  // =========================================================
  // HEADER
  // =========================================================

  const headerBottomY =
    drawCompanyHeader();

  // =========================================================
  // DOCUMENT TITLE
  // =========================================================

  let cursorY =
    headerBottomY + 9;

  setFont("bold");
  doc.setFontSize(17);
  doc.setTextColor(
    ...COLORS.primaryDark
  );

  doc.text(
    "SURAT JALAN",
    marginLeft,
    cursorY
  );

  setFont("normal");
  doc.setFontSize(6.7);
  doc.setTextColor(
    ...COLORS.muted
  );

  doc.text(
    "DOKUMEN PENGIRIMAN BARANG",
    marginLeft,
    cursorY + 5
  );

  // =========================================================
  // DOCUMENT NUMBER
  // =========================================================

  setFont("bold");
  doc.setFontSize(6);
  doc.setTextColor(
    ...COLORS.muted
  );

  doc.text(
    "NO. DOKUMEN",
    pageWidth - marginRight,
    cursorY - 1,
    {
      align: "right",
    }
  );

  setFont("bold");
  doc.setFontSize(10);
  doc.setTextColor(
    ...COLORS.primary
  );

  doc.text(
    safeText(
      data?.suratJalan?.number ??
      data?.number
    ),
    pageWidth - marginRight,
    cursorY + 5,
    {
      align: "right",
    }
  );

  cursorY += 12;

  // =========================================================
  // INFORMATION CARDS
  // =========================================================

  const infoHeight = 37;
  const cardGap = 5;

  const cardWidth =
    (contentWidth - cardGap) / 2;

  // =========================================================
  // LEFT CARD
  // =========================================================

  roundedBox(
    marginLeft,
    cursorY,
    cardWidth,
    infoHeight,
    3,
    COLORS.white,
    COLORS.border
  );

  // Accent bar

  doc.setFillColor(
    ...COLORS.primary
  );

  doc.roundedRect(
    marginLeft,
    cursorY,
    1.4,
    infoHeight,
    1,
    1,
    "F"
  );

  setFont("bold");
  doc.setFontSize(6.7);
  doc.setTextColor(
    ...COLORS.primaryDark
  );

  doc.text(
    "INFORMASI DOKUMEN",
    marginLeft + 7,
    cursorY + 9
  );

  const leftX =
    marginLeft + 7;

  const leftValueX =
    marginLeft + 39;

  setFont("normal");
  doc.setFontSize(6.7);
  doc.setTextColor(
    ...COLORS.muted
  );

  doc.text(
    "No Surat Jalan",
    leftX,
    cursorY + 17
  );

  doc.text(
    "No Delivery",
    leftX,
    cursorY + 24
  );

  doc.text(
    "Tanggal",
    leftX,
    cursorY + 31
  );

  setFont("bold");
  doc.setFontSize(7.4);
  doc.setTextColor(
    ...COLORS.text
  );

  doc.text(
    safeText(
      data?.suratJalan?.number
    ),
    leftValueX,
    cursorY + 17
  );

  doc.text(
    safeText(data?.number),
    leftValueX,
    cursorY + 24
  );

  doc.text(
    formatDate(
      data?.deliveryDate
    ),
    leftValueX,
    cursorY + 31
  );

  // =========================================================
  // RIGHT CARD
  // =========================================================

  const rightX =
    marginLeft +
    cardWidth +
    cardGap;

  roundedBox(
    rightX,
    cursorY,
    cardWidth,
    infoHeight,
    3,
    COLORS.white,
    COLORS.border
  );

  doc.setFillColor(
    ...COLORS.primary
  );

  doc.roundedRect(
    rightX,
    cursorY,
    1.4,
    infoHeight,
    1,
    1,
    "F"
  );

  setFont("bold");
  doc.setFontSize(6.7);
  doc.setTextColor(
    ...COLORS.primaryDark
  );

  doc.text(
    "INFORMASI CUSTOMER",
    rightX + 7,
    cursorY + 9
  );

  setFont("normal");
  doc.setFontSize(6.7);
  doc.setTextColor(
    ...COLORS.muted
  );

  doc.text(
    "Customer",
    rightX + 7,
    cursorY + 17
  );

  doc.text(
    "Alamat",
    rightX + 7,
    cursorY + 24
  );

  setFont("bold");
  doc.setFontSize(7.4);
  doc.setTextColor(
    ...COLORS.text
  );

  doc.text(
    safeText(
      data?.customer?.name
    ),
    rightX + 39,
    cursorY + 17,
    {
      maxWidth: cardWidth - 46,
    }
  );

  const customerAddress =
    safeText(
      data?.customer?.address
    );

  const addressLines =
    doc.splitTextToSize(
      customerAddress,
      cardWidth - 46
    );

  setFont("normal");
  doc.setFontSize(6.7);
  doc.setTextColor(
    ...COLORS.textSoft
  );

  doc.text(
    addressLines.slice(0, 2),
    rightX + 39,
    cursorY + 24
  );

  cursorY +=
    infoHeight + 9;

  // =========================================================
  // DETAIL HEADER
  // =========================================================

  setFont("bold");
  doc.setFontSize(9.2);
  doc.setTextColor(
    ...COLORS.primaryDark
  );

  doc.text(
    "DETAIL PENGIRIMAN",
    marginLeft,
    cursorY
  );

  setFont("normal");
  doc.setFontSize(6.7);
  doc.setTextColor(
    ...COLORS.muted
  );

  const itemSummary =
    `${activeItems.length} item aktif  •  ${formatNumber(
      activeQty
    )} qty`;

  doc.text(
    itemSummary,
    pageWidth - marginRight,
    cursorY,
    {
      align: "right",
    }
  );

  doc.setDrawColor(
    ...COLORS.primary
  );

  doc.setLineWidth(0.6);

  doc.line(
    marginLeft,
    cursorY + 3,
    marginLeft + 20,
    cursorY + 3
  );

  cursorY += 7;

  // =========================================================
  // TABLE
  // =========================================================

  autoTable(doc, {
    startY: cursorY,

    margin: {
      top: 18,
      left: marginLeft,
      right: marginRight,
      bottom: 18,
    },

    theme: "grid",
    pageBreak: "auto",
    showHead: "everyPage",
    rowPageBreak: "avoid",

    // =======================================================
    // BODY TYPOGRAPHY
    // =======================================================

    styles: {
      font: "helvetica",
      fontSize: 7.2,

      cellPadding: {
        top: 2.8,
        right: 2,
        bottom: 2.8,
        left: 2,
      },

      overflow: "linebreak",
      valign: "middle",

      textColor: COLORS.text,
      lineColor: COLORS.borderSoft,
      lineWidth: 0.15,

      minCellHeight: 8,
    },

    // =======================================================
    // HEADER
    // =======================================================

    headStyles: {
      fillColor: COLORS.primaryDark,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 6.8,
      halign: "center",
      valign: "middle",

      cellPadding: {
        top: 2.8,
        right: 1.5,
        bottom: 2.8,
        left: 1.5,
      },

      minCellHeight: 9,
      overflow: "linebreak",
      lineWidth: 0,
    },

    // =======================================================
    // BODY
    // =======================================================

    bodyStyles: {
      fillColor: COLORS.white,
    },

    alternateRowStyles: {
      fillColor: [
        249,
        251,
        250,
      ],
    },

    // =======================================================
    // COLUMN WIDTH
    //
    // TOTAL = 186 MM
    //
    // NO       9
    // KODE     25
    // NAMA     57
    // SATUAN   18
    // QTY      15
    // HARGA    30
    // SUBTOTAL 32
    // =======================================================

    columnStyles: {
      0: {
        cellWidth: 9,
        halign: "center",
      },

      1: {
        cellWidth: 25,
        overflow: "hidden",
      },

      2: {
        cellWidth: 57,
        halign: "left",
      },

      3: {
        cellWidth: 18,
        halign: "center",
      },

      4: {
        cellWidth: 15,
        halign: "right",
      },

      5: {
        cellWidth: 30,
        halign: "right",
      },

      6: {
        cellWidth: 32,
        halign: "right",
      },
    },

    // =======================================================
    // TABLE HEADER
    // =======================================================

    head: [
      [
        "NO",
        "KODE",
        "NAMA BARANG",
        "SATUAN",
        "QTY",
        "HARGA",
        "SUBTOTAL",
      ],
    ],

    // =======================================================
    // TABLE BODY
    // =======================================================

    body:
      items.length === 0
        ? [
            [
              "-",
              "-",
              "Tidak ada barang",
              "-",
              "-",
              "-",
              "-",
            ],
          ]
        : items.map(
            (
              item: any,
              index: number
            ) => {
              const qty =
                Number(
                  item?.qty ?? 0
                );

              const price =
                Number(
                  item?.price ?? 0
                );

              const subtotal =
                item?.subtotal != null &&
                Number(
                  item.subtotal
                ) > 0
                  ? Number(
                      item.subtotal
                    )
                  : qty * price;

              return [
                String(index + 1),

                safeText(
                  item?.barang?.code
                ),

                safeText(
                  item?.barang?.name
                ),

                safeText(
                  item?.barang?.unit
                ),

                formatNumber(qty),

                formatNumber(price),

                formatNumber(
                  subtotal
                ),
              ];
            }
          ),

    // =======================================================
    // CELL PARSING
    // =======================================================

    didParseCell(
      hookData: any
    ) {
      if (
        hookData.section !==
        "body"
      ) {
        return;
      }

      const rowIndex =
        hookData.row.index;

      const item =
        items[rowIndex];

      // VOID ROW

      if (item?.voided) {
        hookData.cell.styles.fillColor =
          COLORS.dangerLight;

        hookData.cell.styles.textColor =
          COLORS.danger;
      }

      // NO

      if (
        hookData.column.index ===
        0
      ) {
        hookData.cell.styles.halign =
          "center";
      }

      // SATUAN

      if (
        hookData.column.index ===
        3
      ) {
        hookData.cell.styles.halign =
          "center";
      }

      // NUMERIC

      if (
        hookData.column.index === 4 ||
        hookData.column.index === 5 ||
        hookData.column.index === 6
      ) {
        hookData.cell.styles.halign =
          "right";
      }

      // NAMA BARANG

      if (
        hookData.column.index === 2
      ) {
        hookData.cell.styles.fontSize =
          7.3;
      }

      // SUBTOTAL LEBIH TEGAS

      if (
        hookData.column.index === 6 &&
        !item?.voided
      ) {
        hookData.cell.styles.fontStyle =
          "bold";
      }
    },

    // =======================================================
    // VOID LABEL
    // =======================================================

    didDrawCell(
      hookData: any
    ) {
      if (
        hookData.section !== "body" ||
        hookData.column.index !== 2
      ) {
        return;
      }

      const rowIndex =
        hookData.row.index;

      const item =
        items[rowIndex];

      if (!item?.voided) {
        return;
      }

      const cell =
        hookData.cell;

      setFont("bold");
      doc.setFontSize(5.2);
      doc.setTextColor(
        ...COLORS.danger
      );

      doc.text(
        "VOID",
        cell.x +
          cell.width -
          2,
        cell.y + 3.7,
        {
          align: "right",
        }
      );
    },

    // =======================================================
    // PAGE HEADER
    // =======================================================

    willDrawPage(
      hookData: any
    ) {
      const pageNumber =
        hookData.pageNumber;

      if (
        pageNumber <= 1
      ) {
        return;
      }

      // Thin top header for continuation pages

      doc.setFillColor(
        ...COLORS.background
      );

      doc.rect(
        0,
        0,
        pageWidth,
        14,
        "F"
      );

      // MGB wordmark

      setFont("bold");
      doc.setFontSize(9);
      doc.setTextColor(
        ...COLORS.primaryDark
      );

      doc.text(
        "MGB",
        marginLeft,
        8
      );

      // Document title

      setFont("bold");
      doc.setFontSize(7.8);
      doc.setTextColor(
        ...COLORS.primaryDark
      );

      doc.text(
        "SURAT JALAN",
        marginLeft + 13,
        8
      );

      // Document number

      setFont("normal");
      doc.setFontSize(6.5);
      doc.setTextColor(
        ...COLORS.muted
      );

      doc.text(
        safeText(
          data?.suratJalan?.number ??
          data?.number
        ),
        pageWidth -
          marginRight,
        8,
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
        11,
        pageWidth -
          marginRight,
        11
      );
    },
  });

  // =========================================================
  // AFTER TABLE
  // =========================================================

  let finalY =
    (
      (doc as any)
        .lastAutoTable
        ?.finalY ??
      cursorY
    ) + 8;

  // =========================================================
  // SUMMARY CARD
  // =========================================================

  const summaryHeight =
    voidQty > 0
      ? 32
      : 25;

  if (
    finalY +
      summaryHeight >
    pageHeight - 23
  ) {
    doc.addPage();
    finalY = 20;
  }

  const summaryWidth = 88;

  const summaryX =
    pageWidth -
    marginRight -
    summaryWidth;

  roundedBox(
    summaryX,
    finalY,
    summaryWidth,
    summaryHeight,
    3,
    COLORS.primaryLight,
    [
      201,
      225,
      214,
    ]
  );

  // SUMMARY LABEL

  setFont("bold");
  doc.setFontSize(6.2);
  doc.setTextColor(
    ...COLORS.primaryDark
  );

  doc.text(
    "RINGKASAN PENGIRIMAN",
    summaryX + 6,
    finalY + 7
  );

  // ACTIVE QTY

  setFont("normal");
  doc.setFontSize(6.5);
  doc.setTextColor(
    ...COLORS.textSoft
  );

  doc.text(
    "QTY AKTIF",
    summaryX + 6,
    finalY + 14
  );

  setFont("bold");
  doc.setFontSize(7.5);
  doc.setTextColor(
    ...COLORS.primaryDark
  );

  doc.text(
    formatNumber(activeQty),
    summaryX +
      summaryWidth -
      6,
    finalY + 14,
    {
      align: "right",
    }
  );

  // VOID QTY

  if (voidQty > 0) {
    setFont("normal");
    doc.setFontSize(6.5);
    doc.setTextColor(
      ...COLORS.danger
    );

    doc.text(
      "QTY VOID",
      summaryX + 6,
      finalY + 21
    );

    setFont("bold");
    doc.setFontSize(7.5);

    doc.text(
      formatNumber(voidQty),
      summaryX +
        summaryWidth -
        6,
      finalY + 21,
      {
        align: "right",
      }
    );
  }

  // TOTAL DIVIDER

  const totalY =
    voidQty > 0
      ? finalY + 27
      : finalY + 21;

  doc.setDrawColor(
    ...COLORS.border
  );

  doc.setLineWidth(0.25);

  doc.line(
    summaryX + 5,
    totalY - 5,
    summaryX +
      summaryWidth -
      5,
    totalY - 5
  );

  // TOTAL LABEL

  setFont("bold");
  doc.setFontSize(6.3);
  doc.setTextColor(
    ...COLORS.primaryDark
  );

  doc.text(
    "TOTAL PENGIRIMAN",
    summaryX + 6,
    totalY
  );

  // TOTAL VALUE

  setFont("bold");
  doc.setFontSize(9.2);
  doc.setTextColor(
    ...COLORS.primary
  );

  doc.text(
    formatCurrency(total),
    summaryX +
      summaryWidth -
      6,
    totalY,
    {
      align: "right",
    }
  );

  finalY +=
    summaryHeight + 8;

  // =========================================================
  // NOTE
  // =========================================================

  const note =
    data?.note ??
    data?.remarks ??
    "";

  if (
    String(note).trim()
  ) {
    const noteText =
      String(note).trim();

    const noteLines =
      doc.splitTextToSize(
        noteText,
        contentWidth - 30
      );

    const noteHeight =
      Math.max(
        20,
        12 +
          noteLines.length *
            4
      );

    if (
      finalY +
        noteHeight >
      pageHeight - 23
    ) {
      doc.addPage();
      finalY = 20;
    }

    roundedBox(
      marginLeft,
      finalY,
      contentWidth,
      noteHeight,
      3,
      [
        252,
        249,
        239,
      ],
      [
        241,
        225,
        183,
      ]
    );

    // Accent

    doc.setFillColor(
      ...COLORS.warning
    );

    doc.roundedRect(
      marginLeft + 5,
      finalY + 5,
      6,
      6,
      1.2,
      1.2,
      "F"
    );

    setFont("bold");
    doc.setFontSize(6.5);
    doc.setTextColor(
      ...COLORS.warning
    );

    doc.text(
      "CATATAN",
      marginLeft + 15,
      finalY + 10
    );

    setFont("normal");
    doc.setFontSize(7.1);
    doc.setTextColor(
      ...COLORS.textSoft
    );

    doc.text(
      noteLines,
      marginLeft + 15,
      finalY + 16
    );

    finalY +=
      noteHeight + 8;
  }

  // =========================================================
  // VOID INFORMATION
  // =========================================================

  if (
    voidItems.length > 0
  ) {
    const voidText =
      `${voidItems.length} item telah di-VOID dan tidak termasuk dalam total pengiriman.`;

    if (
      finalY + 17 >
      pageHeight - 23
    ) {
      doc.addPage();
      finalY = 20;
    }

    roundedBox(
      marginLeft,
      finalY,
      contentWidth,
      17,
      3,
      COLORS.dangerLight,
      [
        244,
        210,
        210,
      ]
    );

    doc.setFillColor(
      ...COLORS.danger
    );

    doc.roundedRect(
      marginLeft + 5,
      finalY + 5,
      6,
      6,
      1.2,
      1.2,
      "F"
    );

    setFont("bold");
    doc.setFontSize(6.5);
    doc.setTextColor(
      ...COLORS.danger
    );

    doc.text(
      "PERHATIAN VOID",
      marginLeft + 15,
      finalY + 9
    );

    setFont("normal");
    doc.setFontSize(6.8);
    doc.setTextColor(
      ...COLORS.textSoft
    );

    doc.text(
      voidText,
      marginLeft + 15,
      finalY + 14
    );

    finalY += 24;
  }

  // =========================================================
  // SIGNATURE SECTION
  // =========================================================

  const signatureHeight = 55;

  if (
    finalY +
      signatureHeight >
    pageHeight - 21
  ) {
    doc.addPage();
    finalY = 20;
  }

  setFont("bold");
  doc.setFontSize(8.3);
  doc.setTextColor(
    ...COLORS.primaryDark
  );

  doc.text(
    "KONFIRMASI PENGIRIMAN",
    marginLeft,
    finalY
  );

  setFont("normal");
  doc.setFontSize(6.5);
  doc.setTextColor(
    ...COLORS.muted
  );

  doc.text(
    "Dokumen ini digunakan sebagai bukti proses pengiriman barang.",
    marginLeft,
    finalY + 5
  );

  finalY += 10;

  // =========================================================
  // SIGNATURE CARDS
  // =========================================================

  const signatureGap = 4;

  const signatureWidth =
    (contentWidth -
      signatureGap * 3) /
    4;

  const signatureTitles = [
    "DIBUAT",
    "GUDANG",
    "PENGIRIM",
    "PENERIMA",
  ];

  signatureTitles.forEach(
    (
      title,
      index
    ) => {
      const x =
        marginLeft +
        index *
          (signatureWidth +
            signatureGap);

      roundedBox(
        x,
        finalY,
        signatureWidth,
        39,
        3,
        COLORS.white,
        COLORS.border
      );

      // Top accent

      doc.setFillColor(
        ...COLORS.primary
      );

      doc.roundedRect(
        x + 5,
        finalY + 5,
        signatureWidth - 10,
        0.8,
        0.4,
        0.4,
        "F"
      );

      // Title

      setFont("bold");
      doc.setFontSize(6.5);
      doc.setTextColor(
        ...COLORS.primaryDark
      );

      doc.text(
        title,
        x +
          signatureWidth / 2,
        finalY + 11,
        {
          align: "center",
        }
      );

      // Signature line

      doc.setDrawColor(
        ...COLORS.border
      );

      doc.setLineWidth(0.25);

      doc.line(
        x + 7,
        finalY + 29,
        x +
          signatureWidth -
          7,
        finalY + 29
      );

      // Caption

      setFont("normal");
      doc.setFontSize(5.5);
      doc.setTextColor(
        ...COLORS.muted
      );

      doc.text(
        "Nama / Tanda Tangan",
        x +
          signatureWidth / 2,
        finalY + 35,
        {
          align: "center",
        }
      );
    }
  );

  // =========================================================
  // FINAL FOOTER
  //
  // Sengaja hanya digambar sekali setelah seluruh halaman
  // selesai dibuat agar "Halaman X / Y" akurat.
  // =========================================================

  const totalPages =
    (doc as any).internal.getNumberOfPages();

  for (
    let page = 1;
    page <= totalPages;
    page++
  ) {
    doc.setPage(page);
    drawPageFooter();
  }

  // =========================================================
  // SAVE
  // =========================================================

  const fileName = String(
    data?.suratJalan?.number ??
      data?.number ??
      "surat-jalan"
  )
    .trim()
    .replace(
      /[\\/:*?"<>|]+/g,
      "-"
    );

  doc.save(
    `${fileName}.pdf`
  );
}