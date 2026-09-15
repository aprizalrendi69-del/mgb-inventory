export type HargaStatus =
  | "SEMUA"
  | "NAIK"
  | "TETAP"
  | "TURUN";

export type MasterHargaExportOptions = {
  rows: any[];

  statusFilter?: HargaStatus;

  dateFrom?: string;

  dateTo?: string;
};

function escapeHtml(value: any) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getStatus(row: any): HargaStatus {
  const hargaLama = Number(row?.hargaLama ?? 0);
  const hargaBaru = Number(row?.hargaBaru ?? 0);

  if (hargaBaru > hargaLama) {
    return "NAIK";
  }

  if (hargaBaru < hargaLama) {
    return "TURUN";
  }

  return "TETAP";
}

function formatNumber(value: any) {
  return Number(value ?? 0).toLocaleString("id-ID");
}

function formatPercent(value: any) {
  return Number(value ?? 0).toFixed(2);
}

function formatDate(value: any) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusLabel(status: HargaStatus) {
  switch (status) {
    case "NAIK":
      return "Harga Naik";

    case "TURUN":
      return "Harga Turun";

    case "TETAP":
      return "Harga Tetap";

    default:
      return "Semua Status";
  }
}

function getDateLabel(
  dateFrom?: string,
  dateTo?: string
) {
  if (!dateFrom && !dateTo) {
    return "Semua Periode";
  }

  return `${dateFrom || "Awal"} s/d ${
    dateTo || "Sekarang"
  }`;
}

function createRowsHtml(rows: any[]) {
  return rows
    .map((row, index) => {
      const hargaLama = Number(
        row?.hargaLama ?? 0
      );

      const hargaBaru = Number(
        row?.hargaBaru ?? 0
      );

      const selisih = Number(
        row?.selisihHarga ?? hargaBaru - hargaLama
      );

      const persen = Number(
        row?.persenNaik ?? 0
      );

      const status = getStatus(row);

      const statusClass =
        status === "NAIK"
          ? "up"
          : status === "TURUN"
          ? "down"
          : "same";

      const statusText =
        status === "NAIK"
          ? "NAIK"
          : status === "TURUN"
          ? "TURUN"
          : "TETAP";

      const sign =
        status === "NAIK"
          ? "+"
          : "";

      return `
        <tr>

          <td class="center number-cell">
            ${index + 1}
          </td>

          <td class="nowrap">
            <div class="date-main">
              ${escapeHtml(
                formatDate(row?.receiveDate)
              )}
            </div>

            <div class="muted">
              Penerimaan
            </div>
          </td>

          <td class="nowrap">
            <div class="po">
              ${escapeHtml(
                row?.poNumber || "-"
              )}
            </div>
          </td>

          <td>
            <div class="supplier">
              ${escapeHtml(
                row?.supplier?.name || "-"
              )}
            </div>

            ${
              row?.supplier?.code
                ? `
                  <div class="muted mono">
                    ${escapeHtml(
                      row.supplier.code
                    )}
                  </div>
                `
                : ""
            }
          </td>

          <td>
            <div class="barang">
              ${escapeHtml(
                row?.barang?.name || "-"
              )}
            </div>

            ${
              row?.barang?.code ||
              row?.barang?.barcode
                ? `
                  <div class="muted mono">
                    ${
                      row?.barang?.code
                        ? escapeHtml(
                            row.barang.code
                          )
                        : ""
                    }

                    ${
                      row?.barang?.code &&
                      row?.barang?.barcode
                        ? " • "
                        : ""
                    }

                    ${
                      row?.barang?.barcode
                        ? escapeHtml(
                            row.barang.barcode
                          )
                        : ""
                    }
                  </div>
                `
                : ""
            }
          </td>

          <td class="center nowrap">
            <span class="unit">
              ${escapeHtml(
                row?.barang?.unit || "-"
              )}
            </span>
          </td>

          <td class="right nowrap">
            Rp ${formatNumber(hargaLama)}
          </td>

          <td class="right nowrap price-new">
            Rp ${formatNumber(hargaBaru)}
          </td>

          <td
            class="right nowrap change ${statusClass}"
          >
            ${sign}Rp ${formatNumber(
              Math.abs(selisih)
            )}
          </td>

          <td
            class="right nowrap change ${statusClass}"
          >
            ${sign}${formatPercent(
              persen
            )}%
          </td>

          <td class="center">
            <span
              class="status ${statusClass}"
            >
              ${statusText}
            </span>
          </td>

          <td class="right nowrap">
            ${formatNumber(row?.qty)}
          </td>

          <td class="right nowrap total">
            Rp ${formatNumber(row?.total)}
          </td>

        </tr>
      `;
    })
    .join("");
}

export function exportMasterHargaPdf({
  rows,
  statusFilter = "SEMUA",
  dateFrom = "",
  dateTo = "",
}: MasterHargaExportOptions) {
  if (typeof window === "undefined") {
    return;
  }

  if (!rows || rows.length === 0) {
    window.alert(
      "Tidak ada data yang dapat diexport."
    );

    return;
  }

  const reportWindow = window.open(
    "",
    "_blank",
    "width=1500,height=950"
  );

  if (!reportWindow) {
    window.alert(
      "Popup diblokir browser. Izinkan popup untuk melakukan export PDF."
    );

    return;
  }

  const totalData = rows.length;

  const totalNaik = rows.filter(
    (row) => getStatus(row) === "NAIK"
  ).length;

  const totalTurun = rows.filter(
    (row) => getStatus(row) === "TURUN"
  ).length;

  const totalTetap = rows.filter(
    (row) => getStatus(row) === "TETAP"
  ).length;

  const totalPurchaseValue =
    rows.reduce(
      (total, row) =>
        total +
        Number(row?.total ?? 0),
      0
    );

  const averagePriceChange =
    rows.length > 0
      ? rows.reduce(
          (total, row) =>
            total +
            Number(row?.persenNaik ?? 0),
          0
        ) / rows.length
      : 0;

  const statusLabel =
    getStatusLabel(statusFilter);

  const dateLabel = getDateLabel(
    dateFrom,
    dateTo
  );

  const generatedAt =
    new Date().toLocaleString(
      "id-ID",
      {
        dateStyle: "long",
        timeStyle: "short",
      }
    );

  const rowsHtml =
    createRowsHtml(rows);

  reportWindow.document.open();

  reportWindow.document.write(`
    <!DOCTYPE html>

    <html lang="id">

      <head>

        <meta charset="UTF-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <title>
          Laporan Master Harga
        </title>

        <style>

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
          }

          body {
            background: #ffffff;
            color: #18352d;
            font-family:
              Arial,
              Helvetica,
              sans-serif;

            font-size: 8px;
          }

          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          .report {
            width: 100%;
          }

          /* ==================================================
             HEADER
             ================================================== */

          .header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;

            gap: 24px;

            padding-bottom: 13px;

            border-bottom:
              2px solid #497f70;

            margin-bottom: 13px;
          }

          .brand {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .logo {
            width: 38px;
            height: 38px;

            flex: 0 0 38px;

            border-radius: 10px;

            display: flex;
            align-items: center;
            justify-content: center;

            background:
              linear-gradient(
                135deg,
                #568c7b,
                #386c5d
              );

            color: #ffffff;

            font-size: 17px;
            font-weight: 900;

            box-shadow:
              0 5px 14px
              rgba(
                73,
                127,
                112,
                0.20
              );
          }

          .eyebrow {
            margin-bottom: 3px;

            color: #6f8179;

            font-size: 7px;
            font-weight: 800;

            letter-spacing: 1.7px;

            text-transform:
              uppercase;
          }

          h1 {
            margin: 0;

            color: #18352d;

            font-size: 19px;
            font-weight: 900;

            letter-spacing: -0.4px;
          }

          .subtitle {
            margin-top: 4px;

            color: #7d8b85;

            font-size: 8px;
          }

          .meta {
            text-align: right;

            color: #7c8984;

            font-size: 8px;

            line-height: 1.65;
          }

          .meta strong {
            color: #30483f;
          }

          /* ==================================================
             SUMMARY
             ================================================== */

          .summary {
            display: grid;

            grid-template-columns:
              repeat(4, 1fr);

            gap: 7px;

            margin-bottom: 11px;
          }

          .summary-card {
            min-height: 52px;

            padding: 8px 10px;

            border:
              1px solid #dfe8e3;

            border-radius: 8px;

            background: #f9fbfa;
          }

          .summary-label {
            color: #82908a;

            font-size: 6.5px;
            font-weight: 800;

            letter-spacing: 1px;

            text-transform:
              uppercase;
          }

          .summary-value {
            margin-top: 4px;

            color: #18352d;

            font-size: 14px;
            font-weight: 900;
          }

          .summary-sub {
            margin-top: 2px;

            color: #9aa49f;

            font-size: 6.5px;
          }

          .red {
            color: #d95660;
          }

          .green {
            color: #3d956f;
          }

          .blue {
            color: #4d7eae;
          }

          /* ==================================================
             FILTER INFO
             ================================================== */

          .filter-info {
            display: flex;
            align-items: center;
            justify-content: space-between;

            gap: 15px;

            margin-bottom: 9px;

            padding: 7px 9px;

            border:
              1px solid #e1e9e5;

            border-radius: 7px;

            background: #f5f8f6;

            color: #718079;

            font-size: 7px;
          }

          .filter-info strong {
            color: #30483f;
          }

          /* ==================================================
             TABLE
             ================================================== */

          table {
            width: 100%;

            border-collapse:
              collapse;

            table-layout:
              auto;
          }

          thead {
            display: table-header-group;
          }

          thead th {
            padding:
              6px 5px;

            background: #edf4f1;

            color: #53675f;

            border-bottom:
              1px solid #d8e3de;

            font-size: 6.2px;
            font-weight: 900;

            letter-spacing: .45px;

            text-align: left;

            text-transform:
              uppercase;

            white-space:
              nowrap;
          }

          tbody tr {
            page-break-inside:
              avoid;
          }

          tbody td {
            padding:
              5px 5px;

            color: #52645c;

            border-bottom:
              1px solid #edf1ef;

            vertical-align:
              middle;
          }

          tbody tr:nth-child(even) {
            background: #fbfcfb;
          }

          .center {
            text-align: center;
          }

          .right {
            text-align: right;
          }

          .nowrap {
            white-space:
              nowrap;
          }

          .number-cell {
            color: #98a49f;
          }

          .date-main {
            color: #4b6259;
            font-weight: 800;
          }

          .po {
            color: #3d5b50;

            font-family:
              Consolas,
              "Courier New",
              monospace;

            font-size: 7px;
            font-weight: 800;
          }

          .supplier {
            max-width: 130px;

            color: #52645c;

            font-weight: 700;
          }

          .barang {
            max-width: 190px;

            color: #30483f;

            font-weight: 800;
          }

          .muted {
            margin-top: 2px;

            color: #98a49f;

            font-size: 6px;
          }

          .mono {
            font-family:
              Consolas,
              "Courier New",
              monospace;
          }

          .unit {
            display: inline-block;

            min-width: 28px;

            padding:
              3px 5px;

            border:
              1px solid #e2e9e6;

            border-radius: 5px;

            background: #f6f8f7;

            color: #697a73;

            font-size: 6px;
            font-weight: 800;
          }

          .price-new {
            color: #18352d;

            font-weight: 900;
          }

          .total {
            color: #18352d;

            font-weight: 900;
          }

          .change {
            font-weight: 900;
          }

          .up {
            color: #d6535d;
          }

          .down {
            color: #39916c;
          }

          .same {
            color: #708079;
          }

          .status {
            display: inline-block;

            min-width: 42px;

            padding:
              3px 5px;

            border-radius: 999px;

            font-size: 5.5px;
            font-weight: 900;

            letter-spacing: .35px;

            text-align: center;
          }

          .status.up {
            background: #fff0f1;
            color: #d6535d;
          }

          .status.down {
            background: #edf8f2;
            color: #39916c;
          }

          .status.same {
            background: #edf4fb;
            color: #4d7eae;
          }

          /* ==================================================
             FOOTER
             ================================================== */

          .footer {
            display: flex;

            align-items: center;
            justify-content:
              space-between;

            gap: 15px;

            margin-top: 10px;

            padding-top: 7px;

            border-top:
              1px solid #e2eae6;

            color: #8a9791;

            font-size: 6.5px;
          }

          .footer strong {
            color: #52655d;
          }

          /* ==================================================
             PRINT
             ================================================== */

          @media print {

            body {
              -webkit-print-color-adjust:
                exact;

              print-color-adjust:
                exact;
            }

            .no-print {
              display: none !important;
            }

          }

        </style>

      </head>

      <body>

        <div class="report">

          <!-- HEADER -->

          <div class="header">

            <div class="brand">

              <div class="logo">
                M
              </div>

              <div>

                <div class="eyebrow">
                  Procurement • Master Data
                </div>

                <h1>
                  Laporan Master Harga
                </h1>

                <div class="subtitle">
                  Histori perubahan harga pembelian berdasarkan penerimaan barang
                </div>

              </div>

            </div>

            <div class="meta">

              <div>
                <strong>
                  Periode:
                </strong>

                ${escapeHtml(
                  dateLabel
                )}
              </div>

              <div>
                <strong>
                  Status:
                </strong>

                ${escapeHtml(
                  statusLabel
                )}
              </div>

              <div>
                <strong>
                  Generated:
                </strong>

                ${escapeHtml(
                  generatedAt
                )}
              </div>

            </div>

          </div>

          <!-- SUMMARY -->

          <div class="summary">

            <div class="summary-card">

              <div class="summary-label">
                Total Records
              </div>

              <div class="summary-value">
                ${formatNumber(
                  totalData
                )}
              </div>

              <div class="summary-sub">
                Data hasil filter
              </div>

            </div>

            <div class="summary-card">

              <div class="summary-label">
                Harga Naik
              </div>

              <div class="summary-value red">
                ${formatNumber(
                  totalNaik
                )}
              </div>

              <div class="summary-sub">
                Perlu perhatian
              </div>

            </div>

            <div class="summary-card">

              <div class="summary-label">
                Harga Turun
              </div>

              <div class="summary-value green">
                ${formatNumber(
                  totalTurun
                )}
              </div>

              <div class="summary-sub">
                Potensi efisiensi
              </div>

            </div>

            <div class="summary-card">

              <div class="summary-label">
                Nilai Pembelian
              </div>

              <div class="summary-value blue">
                Rp ${formatNumber(
                  totalPurchaseValue
                )}
              </div>

              <div class="summary-sub">
                Total nilai record
              </div>

            </div>

          </div>

          <!-- FILTER INFO -->

          <div class="filter-info">

            <div>
              Menampilkan

              <strong>
                ${formatNumber(
                  totalData
                )}
              </strong>

              histori harga
            </div>

            <div>
              Rata-rata perubahan:

              <strong>
                ${averagePriceChange.toFixed(
                  2
                )}%
              </strong>
            </div>

          </div>

          <!-- TABLE -->

          <table>

            <thead>

              <tr>

                <th class="center">
                  No
                </th>

                <th>
                  Tanggal
                </th>

                <th>
                  Purchase Order
                </th>

                <th>
                  Supplier
                </th>

                <th>
                  Barang
                </th>

                <th class="center">
                  Satuan
                </th>

                <th class="right">
                  Harga Lama
                </th>

                <th class="right">
                  Harga Baru
                </th>

                <th class="right">
                  Selisih
                </th>

                <th class="right">
                  Perubahan
                </th>

                <th class="center">
                  Status
                </th>

                <th class="right">
                  Qty
                </th>

                <th class="right">
                  Total
                </th>

              </tr>

            </thead>

            <tbody>

              ${rowsHtml}

            </tbody>

          </table>

          <!-- FOOTER -->

          <div class="footer">

            <div>
              <strong>
                MGB ERP
              </strong>

              • Master Harga

              • Procurement
            </div>

            <div>
              ${formatNumber(
                totalData
              )}
              record
            </div>

          </div>

        </div>

        <script>

          window.onload = function () {

            setTimeout(function () {

              window.focus();

              window.print();

            }, 400);

          };

          window.onafterprint = function () {

            setTimeout(function () {

              window.close();

            }, 300);

          };

        </script>

      </body>

    </html>
  `);

  reportWindow.document.close();
}