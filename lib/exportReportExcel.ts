import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { COMPANY } from "@/lib/company";

export async function exportReportExcel(
  title: string,
  columns: string[],
  rows: any[][]
) {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "MGB Inventory";
  workbook.company = COMPANY.name;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Laporan", {
    properties: {
      defaultRowHeight: 22,
    },
    views: [
      {
        state: "frozen",
        ySplit: 8,
      },
    ],
  });

  // ============================
  // HEADER PERUSAHAAN
  // ============================

  sheet.mergeCells(`A1:${String.fromCharCode(64 + columns.length)}1`);
  sheet.getCell("A1").value = COMPANY.name;
  sheet.getCell("A1").font = {
    bold: true,
    size: 18,
  };
  sheet.getCell("A1").alignment = {
    horizontal: "center",
  };

  sheet.mergeCells(`A2:${String.fromCharCode(64 + columns.length)}2`);
  sheet.getCell("A2").value = COMPANY.address;
  sheet.getCell("A2").alignment = {
    horizontal: "center",
  };

  sheet.mergeCells(`A3:${String.fromCharCode(64 + columns.length)}3`);
  sheet.getCell("A3").value =
    `Telp : ${COMPANY.phone} | Email : ${COMPANY.email}`;
  sheet.getCell("A3").alignment = {
    horizontal: "center",
  };

  sheet.mergeCells(`A4:${String.fromCharCode(64 + columns.length)}4`);
  sheet.getCell("A4").value =
    `Website : ${COMPANY.website}`;
  sheet.getCell("A4").alignment = {
    horizontal: "center",
  };

  // ============================
  // JUDUL
  // ============================

  sheet.mergeCells(`A6:${String.fromCharCode(64 + columns.length)}6`);

  sheet.getCell("A6").value = title;

  sheet.getCell("A6").font = {
    bold: true,
    size: 15,
  };

  sheet.getCell("A6").alignment = {
    horizontal: "center",
  };

  sheet.getCell("A7").value =
    "Tanggal Cetak : " +
    new Date().toLocaleString("id-ID");

  // ============================
  // HEADER TABEL
  // ============================

  const headerRow = sheet.addRow(columns);

  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: {
        argb: "FFFFFFFF",
      },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "1E40AF",
      },
    };

    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    cell.border = {
      top: {
        style: "thin",
      },
      bottom: {
        style: "thin",
      },
      left: {
        style: "thin",
      },
      right: {
        style: "thin",
      },
    };
  });

  // ============================
  // DATA
  // ============================

  rows.forEach((row) => {
    const excelRow = sheet.addRow(row);

    excelRow.eachCell((cell) => {
      cell.border = {
        top: {
          style: "thin",
        },
        bottom: {
          style: "thin",
        },
        left: {
          style: "thin",
        },
        right: {
          style: "thin",
        },
      };
    });
  });

  // ============================
  // AUTO WIDTH
  // ============================

  sheet.columns.forEach((column) => {
    let maxLength = 20;

    column.eachCell?.({
      includeEmpty: true,
    }, (cell) => {
      const len = cell.value
        ? cell.value.toString().length
        : 10;

      if (len > maxLength) {
        maxLength = len;
      }
    });

    column.width = maxLength + 3;
  });

  // ============================
  // AUTO FILTER
  // ============================

  sheet.autoFilter = {
    from: {
      row: 8,
      column: 1,
    },
    to: {
      row: 8,
      column: columns.length,
    },
  };

  // ============================
  // FOOTER
  // ============================

  const footer = sheet.addRow([]);

  footer.commit();

  const totalRow = sheet.addRow([
    `Jumlah Data : ${rows.length}`,
  ]);

  totalRow.font = {
    bold: true,
  };

  // ============================
  // DOWNLOAD
  // ============================

  const buffer =
    await workbook.xlsx.writeBuffer();

  saveAs(
    new Blob([buffer]),
    `${title}.xlsx`
  );
}

// Alias supaya tetap kompatibel
export const exportReportEXCEL = exportReportExcel;