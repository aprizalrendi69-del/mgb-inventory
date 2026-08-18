import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY } from "@/lib/company";

// =====================================================
// GENERIC REPORT PDF
// =====================================================

export function exportReportPdf(
  title: string,
  columns: string[],
  rows: any[][]
) {
  const doc = new jsPDF("p", "mm", "a4");

  // ===================================================
  // HEADER
  // ===================================================

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);

  doc.text(COMPANY.name, 105, 15, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.text(COMPANY.address, 105, 21, {
    align: "center",
  });

  doc.text(
    `Telp : ${COMPANY.phone} | Email : ${COMPANY.email}`,
    105,
    26,
    {
      align: "center",
    }
  );

  doc.text(
    `Website : ${COMPANY.website}`,
    105,
    30,
    {
      align: "center",
    }
  );

  doc.line(14, 35, 196, 35);

  // ===================================================
  // TITLE
  // ===================================================

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);

  doc.text(title, 105, 43, {
    align: "center",
  });

  doc.line(14, 47, 196, 47);

  // ===================================================
  // PRINT DATE
  // ===================================================

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.text(
    "Tanggal Cetak : " +
      new Date().toLocaleString("id-ID"),
    14,
    55
  );

  // ===================================================
  // TABLE
  // ===================================================

  autoTable(doc, {
    startY: 62,

    head: [columns],

    body: rows,

    theme: "grid",

    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [210, 220, 215],
      lineWidth: 0.2,
    },

    headStyles: {
      fillColor: [73, 127, 112],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },

    margin: {
      left: 14,
      right: 14,
    },
  });

  // ===================================================
  // FOOTER
  // ===================================================

  doc.setFont("helvetica", "normal");
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

// =====================================================
// PURCHASE REPORT PDF
// =====================================================
//
// Format:
//
// SUPPLIER A
//
// No | No PO | Tanggal | Kode | Nama | Satuan | Qty
//    | Harga | Subtotal
//
// TOTAL SUPPLIER A
//
// SUPPLIER B
// ...
//
// GRAND TOTAL
// =====================================================

export function exportPurchaseReportPdf(
  title: string,
  columns: string[],
  rows: any[][]
) {
  const doc = new jsPDF("p", "mm", "a4");

  // ===================================================
  // HEADER
  // ===================================================

  function drawHeader() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);

    doc.text(COMPANY.name, 105, 15, {
      align: "center",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    doc.text(COMPANY.address, 105, 21, {
      align: "center",
    });

    doc.text(
      `Telp : ${COMPANY.phone} | Email : ${COMPANY.email}`,
      105,
      26,
      {
        align: "center",
      }
    );

    doc.text(
      `Website : ${COMPANY.website}`,
      105,
      30,
      {
        align: "center",
      }
    );

    doc.line(14, 35, 196, 35);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);

    doc.text(title, 105, 43, {
      align: "center",
    });

    doc.line(14, 47, 196, 47);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    doc.text(
      "Tanggal Cetak : " +
        new Date().toLocaleString("id-ID"),
      14,
      55
    );
  }

  // ===================================================
  // FOOTER
  // ===================================================

  function drawFooter() {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    doc.setTextColor(100, 100, 100);

    doc.text(
      "PT Mitra Garam Bogatama - MGB Inventory System",
      105,
      290,
      {
        align: "center",
      }
    );

    doc.setTextColor(0, 0, 0);
  }

  // ===================================================
  // RUPIAH
  // ===================================================

  function formatRupiah(value: any) {
    const number = Number(value ?? 0);

    return `Rp ${number.toLocaleString("id-ID")}`;
  }

  // ===================================================
  // STRUKTUR DATA
  // ===================================================
  //
  // 0  = No
  // 1  = No PO
  // 2  = Tanggal
  // 3  = Supplier
  // 4  = Status
  // 5  = Kode Barang
  // 6  = Nama Barang
  // 7  = Satuan
  // 8  = Qty
  // 9  = Harga
  // 10 = Subtotal
  // ===================================================

  const supplierIndex = 3;
  const subtotalIndex = 10;

  // ===================================================
  // GROUP SUPPLIER
  // ===================================================

  const supplierGroups = new Map<
    string,
    any[][]
  >();

  rows.forEach((row) => {
    const supplier =
      String(
        row[supplierIndex] ??
          "Tanpa Supplier"
      ).trim() || "Tanpa Supplier";

    if (!supplierGroups.has(supplier)) {
      supplierGroups.set(supplier, []);
    }

    supplierGroups
      .get(supplier)!
      .push(row);
  });

  // ===================================================
  // GRAND TOTAL
  // ===================================================

  let grandTotal = 0;

  rows.forEach((row) => {
    grandTotal += Number(
      row[subtotalIndex] ?? 0
    );
  });

  // ===================================================
  // START
  // ===================================================

  drawHeader();

  let currentY = 63;

  // ===================================================
  // EMPTY
  // ===================================================

  if (rows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    doc.text(
      "Tidak ada data purchase.",
      105,
      currentY,
      {
        align: "center",
      }
    );

    drawFooter();

    doc.save(`${title}.pdf`);

    return;
  }

  // ===================================================
  // SUPPLIER LOOP
  // ===================================================

  let supplierNumber = 0;

  supplierGroups.forEach(
    (supplierRows, supplierName) => {
      supplierNumber++;

      // =================================================
      // CEK HALAMAN
      // =================================================

      if (currentY > 250) {
        drawFooter();

        doc.addPage();

        drawHeader();

        currentY = 63;
      }

      // =================================================
      // SUPPLIER HEADER
      // =================================================

      doc.setFillColor(
        234,
        243,
        239
      );

      doc.roundedRect(
        14,
        currentY,
        182,
        9,
        1.5,
        1.5,
        "F"
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(10);

      doc.setTextColor(
        24,
        53,
        45
      );

      doc.text(
        `SUPPLIER ${supplierNumber} : ${supplierName}`,
        18,
        currentY + 6
      );

      doc.setTextColor(
        0,
        0,
        0
      );

      currentY += 13;

      // =================================================
      // TABLE ROWS
      // =================================================

      const tableRows =
        supplierRows.map(
          (row, index) => [
            index + 1,
            row[1] ?? "-",
            row[2] ?? "-",
            row[5] ?? "-",
            row[6] ?? "-",
            row[7] ?? "-",
            row[8] ?? 0,
            row[9] ?? 0,
            row[10] ?? 0,
          ]
        );

      // =================================================
      // SUPPLIER TOTAL
      // =================================================

      const supplierTotal =
        supplierRows.reduce(
          (sum, row) =>
            sum +
            Number(
              row[subtotalIndex] ?? 0
            ),
          0
        );

      // =================================================
      // TABLE
      // =================================================

      autoTable(doc, {
        startY: currentY,

        head: [
          [
            "No",
            "No PO",
            "Tanggal",
            "Kode Barang",
            "Nama Barang",
            "Satuan",
            "Qty",
            "Harga",
            "Subtotal",
          ],
        ],

        body: tableRows,

        theme: "grid",

        styles: {
          fontSize: 7.2,
          cellPadding: 1.7,
          lineColor: [
            210,
            220,
            215,
          ],
          lineWidth: 0.2,
          textColor: [
            40,
            40,
            40,
          ],
          valign: "middle",
        },

        headStyles: {
          fillColor: [
            73,
            127,
            112,
          ],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 7.2,
          halign: "center",
          valign: "middle",
        },

        columnStyles: {
          // No
          0: {
            cellWidth: 8,
            halign: "center",
          },

          // No PO
          1: {
            cellWidth: 21,
          },

          // Tanggal
          2: {
            cellWidth: 20,
            halign: "center",
          },

          // Kode
          3: {
            cellWidth: 22,
          },

          // Nama
          4: {
            cellWidth: 40,
          },

          // Satuan
          5: {
            cellWidth: 15,
            halign: "center",
          },

          // Qty
          6: {
            cellWidth: 13,
            halign: "right",
          },

          // Harga
          7: {
            cellWidth: 21,
            halign: "right",
          },

          // Subtotal
          8: {
            cellWidth: 22,
            halign: "right",
          },
        },

        margin: {
          left: 14,
          right: 14,
        },

        didParseCell(data) {
          // ---------------------------------------------
          // QTY
          // ---------------------------------------------

          if (
            data.section ===
              "body" &&
            data.column.index === 6
          ) {
            const raw =
              supplierRows[
                data.row.index
              ]?.[8];

            data.cell.text = [
              Number(
                raw ?? 0
              ).toLocaleString(
                "id-ID"
              ),
            ];

            data.cell.styles.halign =
              "right";
          }

          // ---------------------------------------------
          // HARGA
          // ---------------------------------------------

          if (
            data.section ===
              "body" &&
            data.column.index === 7
          ) {
            const raw =
              supplierRows[
                data.row.index
              ]?.[9];

            data.cell.text = [
              formatRupiah(raw),
            ];

            data.cell.styles.halign =
              "right";
          }

          // ---------------------------------------------
          // SUBTOTAL
          // ---------------------------------------------

          if (
            data.section ===
              "body" &&
            data.column.index === 8
          ) {
            const raw =
              supplierRows[
                data.row.index
              ]?.[10];

            data.cell.text = [
              formatRupiah(raw),
            ];

            data.cell.styles.halign =
              "right";
          }
        },

        didDrawPage() {
          drawFooter();
        },
      });

      currentY =
        (doc as any)
          .lastAutoTable
          .finalY + 3;

      // =================================================
      // TOTAL SUPPLIER
      // =================================================

      if (currentY > 270) {
        drawFooter();

        doc.addPage();

        drawHeader();

        currentY = 63;
      }

      doc.setFillColor(
        248,
        250,
        249
      );

      doc.roundedRect(
        14,
        currentY,
        182,
        10,
        1.5,
        1.5,
        "F"
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(9);

      doc.setTextColor(
        53,
        86,
        76
      );

      doc.text(
        `Total ${supplierName}`,
        18,
        currentY + 6.5
      );

      doc.setTextColor(
        73,
        127,
        112
      );

      doc.text(
        formatRupiah(
          supplierTotal
        ),
        192,
        currentY + 6.5,
        {
          align: "right",
        }
      );

      doc.setTextColor(
        0,
        0,
        0
      );

      currentY += 17;
    }
  );

  // ===================================================
  // GRAND TOTAL
  // ===================================================

  if (currentY > 260) {
    drawFooter();

    doc.addPage();

    drawHeader();

    currentY = 63;
  }

  doc.setFillColor(
    73,
    127,
    112
  );

  doc.roundedRect(
    14,
    currentY,
    182,
    14,
    2,
    2,
    "F"
  );

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(11);

  doc.setTextColor(
    255,
    255,
    255
  );

  doc.text(
    "GRAND TOTAL PURCHASE",
    18,
    currentY + 9
  );

  doc.text(
    formatRupiah(
      grandTotal
    ),
    192,
    currentY + 9,
    {
      align: "right",
    }
  );

  doc.setTextColor(
    0,
    0,
    0
  );

  drawFooter();

  // ===================================================
  // SAVE
  // ===================================================

  doc.save(`${title}.pdf`);
}

// =====================================================
// ALIAS
// =====================================================

export const exportReportPDF =
  exportReportPdf;