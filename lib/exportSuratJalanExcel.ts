import * as XLSX from "xlsx";

import { COMPANY } from "@/lib/company";

export function exportSuratJalanExcel(data: any) {
  // =========================
  // DATA BARANG
  // =========================

  const rows = (data.items ?? []).map((i: any) => ({
    Kode: i.barang?.code ?? "-",
    Barang: i.barang?.name ?? "-",
    Satuan: i.barang?.unit ?? "-",
    Qty: i.qty ?? 0,
    Harga: Number(i.price ?? 0),
    Subtotal: Number(
      i.subtotal ??
        Number(i.qty ?? 0) * Number(i.price ?? 0)
    ),
  }));

  // =========================
  // WORKSHEET
  // =========================

  const ws = XLSX.utils.json_to_sheet(rows);

  // =========================
  // HEADER PERUSAHAAN
  // =========================

  // Sisipkan 6 baris kosong di bagian atas
  XLSX.utils.sheet_add_aoa(
    ws,
    [
      [COMPANY.name.toUpperCase()],

      [COMPANY.address],

      [COMPANY.phone ? `Telp : ${COMPANY.phone}` : ""],

      [
        COMPANY.email
          ? `Email : ${COMPANY.email}`
          : "",
      ],

      [
        COMPANY.website
          ? `Website : ${COMPANY.website}`
          : "",
      ],

      ["SURAT JALAN"],

      [],
    ],
    {
      origin: "A1",
    }
  );

  // =========================
  // INFORMASI DOKUMEN
  // =========================

  XLSX.utils.sheet_add_aoa(
    ws,
    [
      [
        "No Surat Jalan",
        data.suratJalan?.number ?? "-",
      ],

      [
        "No Delivery",
        data.number ?? "-",
      ],

      [
        "Customer",
        data.customer?.name ?? "-",
      ],

      [
        "Alamat Customer",
        data.customer?.address ?? "-",
      ],

      [
        "Tanggal",
        data.deliveryDate
          ? new Date(
              data.deliveryDate
            ).toLocaleDateString("id-ID")
          : "-",
      ],

      [],
    ],
    {
      origin: "A8",
    }
  );

  // =========================
  // TABEL BARANG
  // =========================

  const tableStartRow = 14;

  XLSX.utils.sheet_add_aoa(
    ws,
    [
      [
        "Kode",
        "Barang",
        "Satuan",
        "Qty",
        "Harga",
        "Subtotal",
      ],
    ],
    {
      origin: `A${tableStartRow}`,
    }
  );

  const tableRows = rows.map((row) => [
    row.Kode,
    row.Barang,
    row.Satuan,
    row.Qty,
    row.Harga,
    row.Subtotal,
  ]);

  XLSX.utils.sheet_add_aoa(
    ws,
    tableRows,
    {
      origin: `A${tableStartRow + 1}`,
    }
  );

  // =========================
  // TOTAL
  // =========================

  const total = rows.reduce(
    (sum, row) =>
      sum + Number(row.Subtotal ?? 0),
    0
  );

  const totalRow =
    tableStartRow + tableRows.length + 2;

  XLSX.utils.sheet_add_aoa(
    ws,
    [
      [
        "",
        "",
        "",
        "",
        "TOTAL",
        total,
      ],
    ],
    {
      origin: `A${totalRow}`,
    }
  );

  // =========================
  // FORMAT KOLOM
  // =========================

  ws["!cols"] = [
    { wch: 18 },
    { wch: 35 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 20 },
  ];

  // =========================
  // MERGE HEADER
  // =========================

  ws["!merges"] = [
    {
      s: { r: 0, c: 0 },
      e: { r: 0, c: 5 },
    },

    {
      s: { r: 1, c: 0 },
      e: { r: 1, c: 5 },
    },

    {
      s: { r: 2, c: 0 },
      e: { r: 2, c: 5 },
    },

    {
      s: { r: 3, c: 0 },
      e: { r: 3, c: 5 },
    },

    {
      s: { r: 4, c: 0 },
      e: { r: 4, c: 5 },
    },

    {
      s: { r: 5, c: 0 },
      e: { r: 5, c: 5 },
    },
  ];

  // =========================
  // WORKBOOK
  // =========================

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    ws,
    "Surat Jalan"
  );

  // =========================
  // SIMPAN EXCEL
  // =========================

  XLSX.writeFile(
    wb,
    `${data.number}.xlsx`
  );
}