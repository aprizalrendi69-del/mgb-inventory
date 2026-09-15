"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  RefreshCw,
  Tag,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  Filter,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  ChevronRight,
  CalendarDays,
  FileDown,
  Printer,
  CheckCircle2,
  SlidersHorizontal,
  Activity,
  Layers3,
  CircleDollarSign,
} from "lucide-react";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type HargaStatus = "SEMUA" | "NAIK" | "TETAP" | "TURUN";

export default function MasterHargaPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<HargaStatus>("SEMUA");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch("/api/master-harga", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setRows(json.data ?? []);
      } else {
        setRows([]);
      }
    } catch (error) {
      console.error("Gagal mengambil master harga:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // STATUS HARGA
  // =========================================================

  function getStatus(row: any): HargaStatus {
    const hargaLama = Number(row.hargaLama ?? 0);
    const hargaBaru = Number(row.hargaBaru ?? 0);

    if (hargaBaru > hargaLama) {
      return "NAIK";
    }

    if (hargaBaru < hargaLama) {
      return "TURUN";
    }

    return "TETAP";
  }

  // =========================================================
  // DATE HELPER
  // =========================================================

  function getRowDate(row: any) {
    if (!row.receiveDate) {
      return null;
    }

    const date = new Date(row.receiveDate);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  function normalizeDateOnly(value: string) {
    if (!value) {
      return null;
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    date.setHours(0, 0, 0, 0);

    return date;
  }

  // =========================================================
  // FILTER DATA
  // =========================================================

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const fromDate = normalizeDateOnly(dateFrom);
    const toDate = normalizeDateOnly(dateTo);

    if (toDate) {
      toDate.setHours(23, 59, 59, 999);
    }

    return rows.filter((row) => {
      const rowStatus = getStatus(row);

      if (
        statusFilter !== "SEMUA" &&
        rowStatus !== statusFilter
      ) {
        return false;
      }

      const rowDate = getRowDate(row);

      if (fromDate) {
        if (!rowDate || rowDate < fromDate) {
          return false;
        }
      }

      if (toDate) {
        if (!rowDate || rowDate > toDate) {
          return false;
        }
      }

      if (!keyword) {
        return true;
      }

      const po = String(
        row.poNumber ?? ""
      ).toLowerCase();

      const supplier = String(
        row.supplier?.name ?? ""
      ).toLowerCase();

      const barang = String(
        row.barang?.name ?? ""
      ).toLowerCase();

      const kodeBarang = String(
        row.barang?.code ?? ""
      ).toLowerCase();

      const barcode = String(
        row.barang?.barcode ?? ""
      ).toLowerCase();

      const unit = String(
        row.barang?.unit ?? ""
      ).toLowerCase();

      return (
        po.includes(keyword) ||
        supplier.includes(keyword) ||
        barang.includes(keyword) ||
        kodeBarang.includes(keyword) ||
        barcode.includes(keyword) ||
        unit.includes(keyword)
      );
    });
  }, [
    rows,
    search,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  // =========================================================
  // FORMAT
  // =========================================================

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

  // =========================================================
  // SUMMARY
  // =========================================================

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

  const filteredTotal = filteredRows.length;

  const filteredNaik = filteredRows.filter(
    (row) => getStatus(row) === "NAIK"
  ).length;

  const filteredTurun = filteredRows.filter(
    (row) => getStatus(row) === "TURUN"
  ).length;

  const filteredTetap = filteredRows.filter(
    (row) => getStatus(row) === "TETAP"
  ).length;

  const totalPurchaseValue =
    filteredRows.reduce(
      (total, row) =>
        total + Number(row.total ?? 0),
      0
    );

  const averagePriceChange =
    filteredRows.length > 0
      ? filteredRows.reduce(
          (total, row) =>
            total +
            Number(row.persenNaik ?? 0),
          0
        ) / filteredRows.length
      : 0;

  // =========================================================
  // FILTER
  // =========================================================

  function resetFilter() {
    setSearch("");
    setStatusFilter("SEMUA");
    setDateFrom("");
    setDateTo("");
  }

  const hasFilter =
    search.trim() !== "" ||
    statusFilter !== "SEMUA" ||
    dateFrom !== "" ||
    dateTo !== "";

  const activeFilterCount =
    [
      search.trim() !== "",
      statusFilter !== "SEMUA",
      dateFrom !== "",
      dateTo !== "",
    ].filter(Boolean).length;

  // =========================================================
  // STATUS UI
  // =========================================================

  function StatusBadge({
    status,
  }: {
    status: HargaStatus;
  }) {
    if (status === "NAIK") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-gradient-to-r from-red-50 to-rose-50 px-3 py-1.5 text-[11px] font-bold text-red-600 shadow-sm">
          <TrendingUp size={13} />
          Naik
        </span>
      );
    }

    if (status === "TURUN") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-gradient-to-r from-emerald-50 to-green-50 px-3 py-1.5 text-[11px] font-bold text-emerald-600 shadow-sm">
          <TrendingDown size={13} />
          Turun
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50 px-3 py-1.5 text-[11px] font-bold text-blue-600 shadow-sm">
        <Minus size={13} />
        Tetap
      </span>
    );
  }

  // =========================================================
  // EXPORT PDF
  // =========================================================

  function exportPdf() {
    if (filteredRows.length === 0) {
      alert("Tidak ada data yang dapat diexport.");
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageWidth =
        doc.internal.pageSize.getWidth();

      const pageHeight =
        doc.internal.pageSize.getHeight();

      const marginX = 10;

      // =====================================================
      // META
      // =====================================================

      const statusLabel =
        statusFilter === "SEMUA"
          ? "Semua Status"
          : statusFilter === "NAIK"
          ? "Harga Naik"
          : statusFilter === "TURUN"
          ? "Harga Turun"
          : "Harga Tetap";

      const dateLabel =
        dateFrom || dateTo
          ? `${dateFrom || "Awal"} s/d ${
              dateTo || "Sekarang"
            }`
          : "Semua Periode";

      const generatedAt =
        new Date().toLocaleString("id-ID", {
          dateStyle: "long",
          timeStyle: "short",
        });

      // =====================================================
      // HEADER
      // =====================================================

      doc.setFillColor(
        73,
        127,
        112
      );

      doc.roundedRect(
        marginX,
        10,
        13,
        13,
        2.5,
        2.5,
        "F"
      );

      doc.setTextColor(
        255,
        255,
        255
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(13);

      doc.text(
        "M",
        marginX + 6.5,
        19,
        {
          align: "center",
        }
      );

      doc.setTextColor(
        73,
        127,
        112
      );

      doc.setFontSize(6.5);

      doc.text(
        "PROCUREMENT • MASTER DATA",
        marginX + 17,
        13
      );

      doc.setTextColor(
        24,
        53,
        45
      );

      doc.setFontSize(16);

      doc.text(
        "Laporan Master Harga",
        marginX + 17,
        20
      );

      doc.setTextColor(
        125,
        139,
        133
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(7);

      doc.text(
        "Histori perubahan harga pembelian berdasarkan penerimaan barang",
        marginX + 17,
        25
      );

      // =====================================================
      // META KANAN
      // =====================================================

      doc.setFontSize(6.8);

      doc.setTextColor(
        100,
        115,
        108
      );

      doc.text(
        `Periode: ${dateLabel}`,
        pageWidth - marginX,
        12.5,
        {
          align: "right",
        }
      );

      doc.text(
        `Status: ${statusLabel}`,
        pageWidth - marginX,
        17,
        {
          align: "right",
        }
      );

      doc.text(
        `Generated: ${generatedAt}`,
        pageWidth - marginX,
        21.5,
        {
          align: "right",
        }
      );

      // =====================================================
      // HEADER LINE
      // =====================================================

      doc.setDrawColor(
        73,
        127,
        112
      );

      doc.setLineWidth(0.5);

      doc.line(
        marginX,
        29,
        pageWidth - marginX,
        29
      );

      // =====================================================
      // SUMMARY CARDS
      // =====================================================

      const cardY = 33;

      const cardGap = 3;

      const cardWidth =
        (pageWidth -
          marginX * 2 -
          cardGap * 3) /
        4;

      const cardHeight = 16;

      const summaryCards = [
        {
          label: "TOTAL RECORDS",
          value: formatNumber(
            filteredTotal
          ),
          color: [
            24,
            53,
            45,
          ] as [
            number,
            number,
            number
          ],
        },
        {
          label: "HARGA NAIK",
          value: formatNumber(
            filteredNaik
          ),
          color: [
            217,
            79,
            89,
          ] as [
            number,
            number,
            number
          ],
        },
        {
          label: "HARGA TURUN",
          value: formatNumber(
            filteredTurun
          ),
          color: [
            59,
            150,
            111,
          ] as [
            number,
            number,
            number
          ],
        },
        {
          label: "NILAI PEMBELIAN",
          value: `Rp ${formatNumber(
            totalPurchaseValue
          )}`,
          color: [
            75,
            127,
            180,
          ] as [
            number,
            number,
            number
          ],
        },
      ];

      summaryCards.forEach(
        (card, index) => {
          const x =
            marginX +
            index *
              (cardWidth + cardGap);

          doc.setFillColor(
            249,
            251,
            250
          );

          doc.setDrawColor(
            222,
            232,
            227
          );

          doc.roundedRect(
            x,
            cardY,
            cardWidth,
            cardHeight,
            2,
            2,
            "FD"
          );

          doc.setTextColor(
            129,
            144,
            137
          );

          doc.setFont(
            "helvetica",
            "bold"
          );

          doc.setFontSize(5);

          doc.text(
            card.label,
            x + 3,
            cardY + 5
          );

          doc.setTextColor(
            card.color[0],
            card.color[1],
            card.color[2]
          );

          doc.setFontSize(
            card.value.length > 20
              ? 7
              : 10
          );

          doc.text(
            card.value,
            x + 3,
            cardY + 12
          );
        }
      );

      // =====================================================
      // INFO BAR
      // =====================================================

      const infoY = 52;

      doc.setFillColor(
        244,
        248,
        246
      );

      doc.setDrawColor(
        226,
        235,
        230
      );

      doc.roundedRect(
        marginX,
        infoY,
        pageWidth - marginX * 2,
        8,
        1.8,
        1.8,
        "FD"
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(6.3);

      doc.setTextColor(
        101,
        117,
        110
      );

      doc.text(
        "Menampilkan",
        marginX + 3,
        infoY + 5.3
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setTextColor(
        24,
        53,
        45
      );

      doc.text(
        formatNumber(
          filteredTotal
        ),
        marginX + 19,
        infoY + 5.3
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setTextColor(
        101,
        117,
        110
      );

      doc.text(
        "histori harga",
        marginX + 29,
        infoY + 5.3
      );

      doc.text(
        "Rata-rata perubahan:",
        pageWidth - 52,
        infoY + 5.3
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setTextColor(
        24,
        53,
        45
      );

      doc.text(
        `${averagePriceChange.toFixed(
          2
        )}%`,
        pageWidth - marginX - 3,
        infoY + 5.3,
        {
          align: "right",
        }
      );

      // =====================================================
      // TABLE DATA
      // =====================================================

      const tableData =
        filteredRows.map(
          (
            row: any,
            index: number
          ) => {
            const hargaLama =
              Number(
                row.hargaLama ?? 0
              );

            const hargaBaru =
              Number(
                row.hargaBaru ?? 0
              );

            const selisih =
              Number(
                row.selisihHarga ?? 0
              );

            const percent =
              Number(
                row.persenNaik ?? 0
              );

            const status =
              getStatus(row);

            return [
              index + 1,
              formatDate(
                row.receiveDate
              ),
              row.poNumber || "-",
              row.supplier?.name ||
                "-",
              row.barang?.name ||
                "-",
              row.barang?.unit ||
                "-",
              `Rp ${formatNumber(
                hargaLama
              )}`,
              `Rp ${formatNumber(
                hargaBaru
              )}`,
              `${
                status === "NAIK"
                  ? "+"
                  : status === "TURUN"
                  ? "-"
                  : ""
              }Rp ${formatNumber(
                Math.abs(selisih)
              )}`,
              `${
                status === "NAIK"
                  ? "+"
                  : status === "TURUN"
                  ? "-"
                  : ""
              }${formatPercent(
                percent
              )}%`,
              status,
              formatNumber(
                row.qty
              ),
              `Rp ${formatNumber(
                row.total
              )}`,
            ];
          }
        );

      // =====================================================
      // PDF TABLE
      //
      // PENTING:
      //
      // startY = 64 hanya menentukan posisi awal tabel
      // pada halaman pertama.
      //
      // margin.top = 10 digunakan ketika tabel otomatis
      // pindah ke halaman berikutnya.
      //
      // Jadi halaman 2+ tidak lagi mempunyai jarak kosong
      // sebesar 64mm.
      // =====================================================

      autoTable(doc, {
        startY: 64,

        margin: {
          left: marginX,
          right: marginX,

          // JANGAN menggunakan 64 di sini.
          // Ini berlaku untuk halaman 2+.
          top: 10,

          bottom: 17,
        },

        tableWidth:
          pageWidth - marginX * 2,

        head: [
          [
            "No",
            "Tanggal",
            "Purchase Order",
            "Supplier",
            "Barang",
            "Satuan",
            "Harga Lama",
            "Harga Baru",
            "Selisih",
            "Perubahan",
            "Status",
            "Qty",
            "Total",
          ],
        ],

        body: tableData,

        theme: "grid",

        styles: {
          font: "helvetica",
          fontSize: 5.2,
          cellPadding: 1.35,

          textColor: [
            78,
            97,
            89,
          ],

          lineColor: [
            225,
            233,
            228,
          ],

          lineWidth: 0.12,

          valign: "middle",

          overflow: "linebreak",

          cellWidth: "wrap",
        },

        headStyles: {
          fillColor: [
            237,
            244,
            241,
          ],

          textColor: [
            83,
            103,
            95,
          ],

          fontStyle: "bold",

          fontSize: 5,

          halign: "center",

          valign: "middle",

          lineColor: [
            217,
            228,
            223,
          ],

          lineWidth: 0.15,

          cellPadding: 1.6,

          overflow: "linebreak",
        },

        alternateRowStyles: {
          fillColor: [
            251,
            252,
            251,
          ],
        },

        columnStyles: {
          // 6
          0: {
            halign: "center",
            cellWidth: 6,
          },

          // 16
          1: {
            cellWidth: 16,
            halign: "center",
          },

          // 23
          2: {
            cellWidth: 23,
          },

          // 29
          3: {
            cellWidth: 29,
          },

          // 39
          4: {
            cellWidth: 39,
          },

          // 12
          5: {
            halign: "center",
            cellWidth: 12,
          },

          // 23
          6: {
            halign: "right",
            cellWidth: 23,
          },

          // 23
          7: {
            halign: "right",
            cellWidth: 23,
          },

          // 20
          8: {
            halign: "right",
            cellWidth: 20,
          },

          // 17
          9: {
            halign: "right",
            cellWidth: 17,
          },

          // 18
          10: {
            halign: "center",
            cellWidth: 18,
          },

          // 13
          11: {
            halign: "right",
            cellWidth: 13,
          },

          // 38
          12: {
            halign: "right",
            cellWidth: 38,
          },
        },

        // ===================================================
        // CELL STYLE
        // ===================================================

        didParseCell(data) {
          if (
            data.section !==
            "body"
          ) {
            return;
          }

          // STATUS
          if (
            data.column.index === 10
          ) {
            const status =
              String(
                data.cell.raw ?? ""
              );

            if (
              status === "NAIK"
            ) {
              data.cell.styles.textColor =
                [217, 79, 89];

              data.cell.styles.fontStyle =
                "bold";
            }

            if (
              status === "TURUN"
            ) {
              data.cell.styles.textColor =
                [59, 150, 111];

              data.cell.styles.fontStyle =
                "bold";
            }

            if (
              status === "TETAP"
            ) {
              data.cell.styles.textColor =
                [75, 127, 180];

              data.cell.styles.fontStyle =
                "bold";
            }
          }

          // SELISIH + PERUBAHAN
          if (
            data.column.index === 8 ||
            data.column.index === 9
          ) {
            const row =
              filteredRows[
                data.row.index
              ];

            if (!row) {
              return;
            }

            const status =
              getStatus(row);

            if (
              status === "NAIK"
            ) {
              data.cell.styles.textColor =
                [217, 79, 89];
            } else if (
              status === "TURUN"
            ) {
              data.cell.styles.textColor =
                [59, 150, 111];
            } else {
              data.cell.styles.textColor =
                [111, 129, 121];
            }

            data.cell.styles.fontStyle =
              "bold";
          }

          // HARGA BARU + TOTAL
          if (
            data.column.index === 7 ||
            data.column.index === 12
          ) {
            data.cell.styles.fontStyle =
              "bold";

            data.cell.styles.textColor =
              [24, 53, 45];
          }
        },

        // ===================================================
        // PAGE FOOTER
        // ===================================================

        didDrawPage() {
          const pageNumber =
            doc.getNumberOfPages();

          // Footer separator
          doc.setDrawColor(
            227,
            235,
            231
          );

          doc.setLineWidth(0.2);

          doc.line(
            marginX,
            pageHeight - 11,
            pageWidth - marginX,
            pageHeight - 11
          );

          doc.setFont(
            "helvetica",
            "normal"
          );

          doc.setFontSize(5.8);

          doc.setTextColor(
            139,
            152,
            146
          );

          doc.text(
            "MGB ERP • Master Harga",
            marginX,
            pageHeight - 6
          );

          doc.text(
            `${formatNumber(
              filteredTotal
            )} record`,
            pageWidth / 2,
            pageHeight - 6,
            {
              align: "center",
            }
          );

          doc.text(
            `Halaman ${pageNumber}`,
            pageWidth - marginX,
            pageHeight - 6,
            {
              align: "right",
            }
          );
        },
      });

      // =====================================================
      // NAMA FILE
      // =====================================================

      const now = new Date();

      const timestamp =
        [
          now.getFullYear(),

          String(
            now.getMonth() + 1
          ).padStart(2, "0"),

          String(
            now.getDate()
          ).padStart(2, "0"),

          String(
            now.getHours()
          ).padStart(2, "0"),

          String(
            now.getMinutes()
          ).padStart(2, "0"),

          String(
            now.getSeconds()
          ).padStart(2, "0"),
        ].join("");

      const fileName =
        `Laporan-Master-Harga-${timestamp}.pdf`;

      // =====================================================
      // DIRECT DOWNLOAD
      // =====================================================

      doc.save(fileName);
    } catch (error) {
      console.error(
        "Gagal membuat PDF:",
        error
      );

      alert(
        "Gagal membuat PDF. Silakan coba lagi."
      );
    }
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="min-h-screen bg-[#F2F6F4] text-[#18352D]">

      {/* PREMIUM BACKGROUND */}

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">

        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#DDEEE7]/60 blur-3xl" />

        <div className="absolute -right-32 top-40 h-96 w-96 rounded-full bg-[#E8F1ED]/70 blur-3xl" />

      </div>

      {/* HEADER */}

      <header className="sticky top-0 z-40 border-b border-[#DCE6E1]/90 bg-white/90 shadow-[0_2px_20px_rgba(24,53,45,0.035)] backdrop-blur-2xl">

        <div className="mx-auto max-w-[1650px] px-5 py-4 lg:px-8">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex min-w-0 items-center gap-3.5">

              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#568C7B] to-[#386C5D] text-white shadow-[0_8px_24px_rgba(73,127,112,0.22)]">

                <div className="absolute -right-3 -top-3 h-9 w-9 rounded-full bg-white/10" />

                <Tag
                  size={21}
                  strokeWidth={2.2}
                />

              </div>

              <div className="min-w-0">

                <div className="flex items-center gap-2">

                  <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#497F70]">
                    Procurement
                  </span>

                  <ChevronRight
                    size={11}
                    className="text-[#B5C1BC]"
                  />

                  <span className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#9AA7A1]">
                    Master Data
                  </span>

                </div>

                <h1 className="mt-0.5 truncate text-xl font-extrabold tracking-[-0.025em] text-[#18352D] sm:text-[25px]">
                  Master Harga
                </h1>

              </div>

            </div>

            <div className="flex items-center gap-2.5">

              <div className="hidden items-center gap-2 rounded-xl border border-[#DDE7E2] bg-[#F8FAF9] px-3.5 py-2.5 sm:flex">

                <span className="relative flex h-2 w-2">

                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#70A894] opacity-50" />

                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#497F70]" />

                </span>

                <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71817A]">
                  Live Data
                </span>

              </div>

              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D5E1DC] bg-white px-4 text-xs font-bold text-[#4D655C] shadow-[0_3px_10px_rgba(31,59,50,0.04)] transition-all hover:-translate-y-0.5 hover:border-[#BFD2C9] hover:bg-[#F8FAF9] hover:shadow-[0_6px_15px_rgba(31,59,50,0.07)] disabled:cursor-not-allowed disabled:opacity-50"
              >

                <RefreshCw
                  size={15}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />

                <span className="hidden sm:inline">
                  Refresh
                </span>

              </button>

              <button
                type="button"
                onClick={exportPdf}
                disabled={
                  loading ||
                  filteredRows.length === 0
                }
                className="group inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#497F70] to-[#386C5D] px-4 text-xs font-bold text-white shadow-[0_7px_18px_rgba(73,127,112,0.22)] transition-all hover:-translate-y-0.5 hover:from-[#416F63] hover:to-[#315D50] hover:shadow-[0_10px_25px_rgba(73,127,112,0.28)] disabled:cursor-not-allowed disabled:opacity-40"
              >

                <FileDown
                  size={15}
                  className="transition-transform group-hover:-translate-y-0.5"
                />

                <span>
                  Export PDF
                </span>

              </button>

            </div>

          </div>

        </div>

      </header>

      <main className="mx-auto max-w-[1650px] px-5 py-6 pb-12 lg:px-8">

        {/* INTRO */}

        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">

          <div>

            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#DCE8E2] bg-white/80 px-3 py-1.5 shadow-sm">

              <Activity
                size={12}
                className="text-[#497F70]"
              />

              <span className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#708078]">
                Price Intelligence
              </span>

            </div>

            <h2 className="text-lg font-extrabold tracking-tight text-[#29463D] sm:text-xl">
              Monitoring Harga Pembelian
            </h2>

            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#819089] sm:text-sm">
              Pantau perubahan harga barang berdasarkan histori penerimaan dan identifikasi perubahan biaya pembelian dengan cepat.
            </p>

          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[#DDE7E2] bg-white px-4 py-3 shadow-[0_5px_18px_rgba(31,59,50,0.04)]">

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF3EE] text-[#497F70]">
              <Database size={16} />
            </div>

            <div>

              <div className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#98A49F]">
                Total Records
              </div>

              <div className="mt-0.5 text-lg font-extrabold tabular-nums text-[#18352D]">
                {formatNumber(
                  totalData
                )}
              </div>

            </div>

          </div>

        </div>

        {/* KPI */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* TOTAL */}

          <button
            type="button"
            onClick={() =>
              setStatusFilter("SEMUA")
            }
            className={`group relative overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-[0_5px_22px_rgba(31,59,50,0.045)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(31,59,50,0.09)] ${
              statusFilter === "SEMUA"
                ? "border-[#497F70] ring-4 ring-[#497F70]/5"
                : "border-[#DDE7E2]"
            }`}
          >

            <div className="absolute -right-9 -top-9 h-28 w-28 rounded-full bg-[#EAF3EE] opacity-80 transition-transform duration-500 group-hover:scale-125" />

            <div className="absolute bottom-0 right-0 h-20 w-20 translate-x-8 translate-y-8 rounded-full bg-[#F5F9F7]" />

            <div className="relative">

              <div className="flex items-start justify-between">

                <div>

                  <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#899690]">
                    Total Histori
                  </p>

                  <p className="mt-2 text-[28px] font-black tracking-[-0.04em] text-[#18352D]">
                    {formatNumber(
                      totalData
                    )}
                  </p>

                  <p className="mt-1 text-[10px] text-[#98A49F]">
                    Semua perubahan harga
                  </p>

                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#EAF3EE] to-[#DDEDE6] text-[#497F70] shadow-sm">
                  <Layers3 size={19} />
                </div>

              </div>

              <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#EEF3F0]">

                <div className="h-full w-full rounded-full bg-[#497F70]" />

              </div>

            </div>

          </button>

          {/* NAIK */}

          <button
            type="button"
            onClick={() =>
              setStatusFilter("NAIK")
            }
            className={`group relative overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-[0_5px_22px_rgba(31,59,50,0.045)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(31,59,50,0.09)] ${
              statusFilter === "NAIK"
                ? "border-red-300 ring-4 ring-red-50"
                : "border-[#F0DEDE]"
            }`}
          >

            <div className="absolute -right-9 -top-9 h-28 w-28 rounded-full bg-red-50 opacity-80 transition-transform duration-500 group-hover:scale-125" />

            <div className="relative">

              <div className="flex items-start justify-between">

                <div>

                  <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#899690]">
                    Harga Naik
                  </p>

                  <p className="mt-2 text-[28px] font-black tracking-[-0.04em] text-red-600">
                    {formatNumber(
                      totalNaik
                    )}
                  </p>

                  <p className="mt-1 text-[10px] text-[#98A49F]">
                    Perlu perhatian
                  </p>

                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-red-50 to-rose-100 text-red-600 shadow-sm">
                  <TrendingUp size={19} />
                </div>

              </div>

              <div className="mt-4 flex items-center justify-between">

                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-red-50">

                  <div
                    className="h-full rounded-full bg-red-400 transition-all"
                    style={{
                      width: `${
                        totalData
                          ? Math.min(
                              100,
                              (totalNaik /
                                totalData) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />

                </div>

                <span className="ml-3 text-[9px] font-bold text-red-500">

                  {totalData
                    ? (
                        (totalNaik /
                          totalData) *
                        100
                      ).toFixed(1)
                    : "0.0"}
                  %

                </span>

              </div>

            </div>

          </button>

          {/* TURUN */}

          <button
            type="button"
            onClick={() =>
              setStatusFilter("TURUN")
            }
            className={`group relative overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-[0_5px_22px_rgba(31,59,50,0.045)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(31,59,50,0.09)] ${
              statusFilter === "TURUN"
                ? "border-emerald-300 ring-4 ring-emerald-50"
                : "border-[#DDEDE2]"
            }`}
          >

            <div className="absolute -right-9 -top-9 h-28 w-28 rounded-full bg-emerald-50 opacity-80 transition-transform duration-500 group-hover:scale-125" />

            <div className="relative">

              <div className="flex items-start justify-between">

                <div>

                  <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#899690]">
                    Harga Turun
                  </p>

                  <p className="mt-2 text-[28px] font-black tracking-[-0.04em] text-emerald-600">
                    {formatNumber(
                      totalTurun
                    )}
                  </p>

                  <p className="mt-1 text-[10px] text-[#98A49F]">
                    Harga lebih rendah
                  </p>

                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-green-100 text-emerald-600 shadow-sm">
                  <TrendingDown size={19} />
                </div>

              </div>

              <div className="mt-4 flex items-center justify-between">

                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-emerald-50">

                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{
                      width: `${
                        totalData
                          ? Math.min(
                              100,
                              (totalTurun /
                                totalData) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />

                </div>

                <span className="ml-3 text-[9px] font-bold text-emerald-500">

                  {totalData
                    ? (
                        (totalTurun /
                          totalData) *
                        100
                      ).toFixed(1)
                    : "0.0"}
                  %

                </span>

              </div>

            </div>

          </button>

          {/* TETAP */}

          <button
            type="button"
            onClick={() =>
              setStatusFilter("TETAP")
            }
            className={`group relative overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-[0_5px_22px_rgba(31,59,50,0.045)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(31,59,50,0.09)] ${
              statusFilter === "TETAP"
                ? "border-blue-300 ring-4 ring-blue-50"
                : "border-[#DDE4ED]"
            }`}
          >

            <div className="absolute -right-9 -top-9 h-28 w-28 rounded-full bg-blue-50 opacity-80 transition-transform duration-500 group-hover:scale-125" />

            <div className="relative">

              <div className="flex items-start justify-between">

                <div>

                  <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#899690]">
                    Harga Tetap
                  </p>

                  <p className="mt-2 text-[28px] font-black tracking-[-0.04em] text-blue-600">
                    {formatNumber(
                      totalTetap
                    )}
                  </p>

                  <p className="mt-1 text-[10px] text-[#98A49F]">
                    Tidak berubah
                  </p>

                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-sky-100 text-blue-600 shadow-sm">
                  <Minus size={19} />
                </div>

              </div>

              <div className="mt-4 flex items-center gap-2">

                <CheckCircle2
                  size={13}
                  className="text-blue-500"
                />

                <span className="text-[9px] font-semibold text-[#7D8D86]">
                  Harga stabil
                </span>

              </div>

            </div>

          </button>

        </div>

        {/* FILTER */}

        <section className="mb-6 overflow-hidden rounded-2xl border border-[#DCE6E1] bg-white shadow-[0_6px_25px_rgba(31,59,50,0.045)]">

          <div className="flex flex-col gap-3 border-b border-[#E8EEEB] bg-gradient-to-r from-white to-[#FAFCFB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#EAF3EE] to-[#DDEDE6] text-[#497F70] shadow-sm">
                <SlidersHorizontal size={17} />
              </div>

              <div>

                <div className="flex items-center gap-2">

                  <h2 className="text-xs font-extrabold uppercase tracking-[0.11em] text-[#35564C]">
                    Filter & Pencarian
                  </h2>

                  {activeFilterCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#497F70] px-1.5 text-[9px] font-extrabold text-white">
                      {activeFilterCount}
                    </span>
                  )}

                </div>

                <p className="mt-0.5 text-[10px] text-[#9AA6A1]">
                  Saring histori berdasarkan barang, status dan periode penerimaan.
                </p>

              </div>

            </div>

            {hasFilter && (
              <button
                type="button"
                onClick={resetFilter}
                className="inline-flex items-center gap-1.5 self-start rounded-lg px-3 py-2 text-[10px] font-extrabold text-red-500 transition hover:bg-red-50 sm:self-auto"
              >
                <X size={14} />
                Reset Semua
              </button>
            )}

          </div>

          <div className="p-5">

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_230px_230px_210px]">

              {/* SEARCH */}

              <div>

                <label className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#77867F]">
                  Pencarian
                </label>

                <div className="relative">

                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA7A2]"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                    placeholder="PO, supplier, kode, barcode, nama barang..."
                    className="h-11 w-full rounded-xl border border-[#D6E2DD] bg-[#FBFCFB] pl-10 pr-10 text-sm font-medium text-[#354840] outline-none transition-all placeholder:text-[#A1ACA7] hover:border-[#C5D5CE] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() =>
                        setSearch("")
                      }
                      className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#9AA7A2] transition hover:bg-[#EEF3F0] hover:text-[#596A63]"
                      title="Hapus pencarian"
                    >
                      <X size={14} />
                    </button>
                  )}

                </div>

              </div>

              {/* DATE FROM */}

              <div>

                <label className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#77867F]">
                  Tanggal Mulai
                </label>

                <div className="relative">

                  <CalendarDays
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[#9BA7A2]"
                  />

                  <input
                    type="date"
                    value={dateFrom}
                    max={
                      dateTo || undefined
                    }
                    onChange={(e) =>
                      setDateFrom(
                        e.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-[#D6E2DD] bg-[#FBFCFB] pl-10 pr-3 text-sm font-medium text-[#354840] outline-none transition-all hover:border-[#C5D5CE] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  />

                </div>

              </div>

              {/* DATE TO */}

              <div>

                <label className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#77867F]">
                  Tanggal Akhir
                </label>

                <div className="relative">

                  <CalendarDays
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[#9BA7A2]"
                  />

                  <input
                    type="date"
                    value={dateTo}
                    min={
                      dateFrom || undefined
                    }
                    onChange={(e) =>
                      setDateTo(
                        e.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-[#D6E2DD] bg-[#FBFCFB] pl-10 pr-3 text-sm font-medium text-[#354840] outline-none transition-all hover:border-[#C5D5CE] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  />

                </div>

              </div>

              {/* STATUS */}

              <div>

                <label className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#77867F]">
                  Status Harga
                </label>

                <div className="relative">

                  <BarChart3
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[#9BA7A2]"
                  />

                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(
                        e.target
                          .value as HargaStatus
                      )
                    }
                    className="h-11 w-full appearance-none rounded-xl border border-[#D6E2DD] bg-[#FBFCFB] pl-10 pr-9 text-sm font-medium text-[#354840] outline-none transition-all hover:border-[#C5D5CE] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  >

                    <option value="SEMUA">
                      Semua Status
                    </option>

                    <option value="NAIK">
                      Harga Naik
                    </option>

                    <option value="TETAP">
                      Harga Tetap
                    </option>

                    <option value="TURUN">
                      Harga Turun
                    </option>

                  </select>

                  <ChevronRight
                    size={15}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-[#899690]"
                  />

                </div>

              </div>

            </div>

            {/* FILTER INFO */}

            <div className="mt-4 flex flex-col gap-3 border-t border-[#EDF2EF] pt-4 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex flex-wrap items-center gap-2">

                {dateFrom && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDE8E3] bg-[#F7FAF8] px-2.5 py-1.5 text-[10px] font-bold text-[#60736B]">

                    <CalendarDays size={12} />

                    Dari{" "}
                    {formatDate(
                      dateFrom
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setDateFrom("")
                      }
                      className="ml-1 rounded p-0.5 hover:bg-[#E8EFEB]"
                    >
                      <X size={11} />
                    </button>

                  </span>
                )}

                {dateTo && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDE8E3] bg-[#F7FAF8] px-2.5 py-1.5 text-[10px] font-bold text-[#60736B]">

                    <CalendarDays size={12} />

                    Sampai{" "}
                    {formatDate(
                      dateTo
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setDateTo("")
                      }
                      className="ml-1 rounded p-0.5 hover:bg-[#E8EFEB]"
                    >
                      <X size={11} />
                    </button>

                  </span>
                )}

                {statusFilter !==
                  "SEMUA" && (
                  <StatusBadge
                    status={
                      statusFilter
                    }
                  />
                )}

              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-[#E1E9E5] bg-[#F7FAF8] px-3 py-2 lg:min-w-[190px]">

                <div className="flex items-center gap-2">

                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#EAF3EE] text-[#497F70]">
                    <Database size={12} />
                  </span>

                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#85938D]">
                    Hasil
                  </span>

                </div>

                <span className="text-sm font-black tabular-nums text-[#18352D]">
                  {formatNumber(
                    filteredTotal
                  )}
                </span>

              </div>

            </div>

          </div>

        </section>

        {/* FILTERED OVERVIEW */}

        {hasFilter && (
          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">

            <div className="rounded-xl border border-[#DDE7E2] bg-white px-4 py-3 shadow-sm">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#8A9791]">
                    Hasil Filter
                  </p>

                  <p className="mt-1 text-lg font-black text-[#18352D]">
                    {formatNumber(
                      filteredTotal
                    )}
                  </p>

                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF3EE] text-[#497F70]">
                  <Filter size={15} />
                </div>

              </div>

            </div>

            <div className="rounded-xl border border-[#F0DEDE] bg-white px-4 py-3 shadow-sm">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#8A9791]">
                    Harga Naik
                  </p>

                  <p className="mt-1 text-lg font-black text-red-600">
                    {formatNumber(
                      filteredNaik
                    )}
                  </p>

                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <TrendingUp size={15} />
                </div>

              </div>

            </div>

            <div className="rounded-xl border border-[#DDE7E2] bg-white px-4 py-3 shadow-sm">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#8A9791]">
                    Nilai Pembelian
                  </p>

                  <p className="mt-1 text-lg font-black text-[#18352D]">
                    Rp{" "}
                    {formatNumber(
                      totalPurchaseValue
                    )}
                  </p>

                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF3EE] text-[#497F70]">
                  <CircleDollarSign size={15} />
                </div>

              </div>

            </div>

          </div>
        )}

        {/* TABLE */}

        <section className="overflow-hidden rounded-2xl border border-[#DCE6E1] bg-white shadow-[0_7px_28px_rgba(31,59,50,0.05)]">

          {/* TABLE HEADER */}

          <div className="flex flex-col gap-4 border-b border-[#E8EEEB] bg-gradient-to-r from-white via-white to-[#FAFCFB] px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#EAF3EE] to-[#DDEDE6] text-[#497F70] shadow-sm">
                <Tag size={17} />
              </div>

              <div>

                <div className="flex items-center gap-2">

                  <h2 className="text-xs font-extrabold uppercase tracking-[0.11em] text-[#35564C]">
                    Histori Harga Pembelian
                  </h2>

                  <span className="hidden rounded-md bg-[#F0F5F2] px-2 py-1 text-[8px] font-extrabold uppercase tracking-wider text-[#819089] sm:inline-flex">
                    Audit Trail
                  </span>

                </div>

                <p className="mt-0.5 text-[10px] text-[#9AA6A1]">
                  Riwayat perubahan harga berdasarkan penerimaan barang.
                </p>

              </div>

            </div>

            <div className="flex items-center gap-2">

              <span className="inline-flex items-center gap-2 rounded-lg border border-[#E0E8E4] bg-[#F8FAF9] px-3 py-2 text-[10px] font-bold text-[#75847D]">

                <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />

                {formatNumber(
                  filteredRows.length
                )}{" "}
                Records

              </span>

              <button
                type="button"
                onClick={exportPdf}
                disabled={
                  loading ||
                  filteredRows.length === 0
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4E2DB] bg-white px-3 py-2 text-[10px] font-extrabold text-[#4B665C] transition hover:border-[#BFD1C8] hover:bg-[#F7FAF8] disabled:cursor-not-allowed disabled:opacity-40"
              >

                <Printer size={13} />

                PDF

              </button>

            </div>

          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">

            <table className="min-w-[1500px] w-full text-sm">

              <thead className="sticky top-0 z-10 bg-[#F5F8F6]">

                <tr className="border-b border-[#E0E8E4]">

                  <th className="whitespace-nowrap px-5 py-3.5 text-left text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#87948E]">
                    Tanggal
                  </th>

                  <th className="whitespace-nowrap px-5 py-3.5 text-left text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#87948E]">
                    Purchase Order
                  </th>

                  <th className="whitespace-nowrap px-5 py-3.5 text-left text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#87948E]">
                    Supplier
                  </th>

                  <th className="whitespace-nowrap px-5 py-3.5 text-left text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#87948E]">
                    Barang
                  </th>

                  <th className="whitespace-nowrap px-5 py-3.5 text-center text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#87948E]">
                    Satuan
                  </th>

                  <th className="whitespace-nowrap px-5 py-3.5 text-right text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#87948E]">
                    Harga Lama
                  </th>

                  <th className="whitespace-nowrap px-5 py-3.5 text-right text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#87948E]">
                    Harga Baru
                  </th>

                  <th className="whitespace-nowrap px-5 py-3.5 text-right text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#87948E]">
                    Selisih
                  </th>

                  <th className="whitespace-nowrap px-5 py-3.5 text-right text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#87948E]">
                    Perubahan
                  </th>

                  <th className="whitespace-nowrap px-5 py-3.5 text-center text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#87948E]">
                    Status
                  </th>

                  <th className="whitespace-nowrap px-5 py-3.5 text-right text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#87948E]">
                    Qty
                  </th>

                  <th className="whitespace-nowrap px-5 py-3.5 text-right text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#87948E]">
                    Total
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-[#EDF1EF]">

                {/* LOADING */}

                {loading && (
                  <>
                    {Array.from({
                      length: 7,
                    }).map(
                      (_, index) => (
                        <tr
                          key={index}
                          className="animate-pulse"
                        >

                          {Array.from({
                            length: 12,
                          }).map(
                            (
                              __,
                              cellIndex
                            ) => (
                              <td
                                key={
                                  cellIndex
                                }
                                className="px-5 py-5"
                              >

                                <div
                                  className={`h-4 rounded-md bg-gradient-to-r from-[#EDF2EF] via-[#F5F8F6] to-[#EDF2EF] ${
                                    cellIndex ===
                                    3
                                      ? "w-56"
                                      : cellIndex ===
                                        6
                                      ? "ml-auto w-28"
                                      : "w-24"
                                  }`}
                                />

                              </td>
                            )
                          )}

                        </tr>
                      )
                    )}
                  </>
                )}

                {/* EMPTY */}

                {!loading &&
                  filteredRows.length ===
                    0 && (
                    <tr>

                      <td
                        colSpan={12}
                        className="px-5 py-20 text-center"
                      >

                        <div className="mx-auto flex max-w-md flex-col items-center">

                          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#EAF3EE] to-[#DDEDE6] text-[#497F70] shadow-inner">

                            <div className="absolute inset-2 rounded-2xl border border-white/80" />

                            {hasFilter ? (
                              <Search
                                size={29}
                              />
                            ) : (
                              <Tag
                                size={29}
                              />
                            )}

                          </div>

                          <h3 className="mt-5 text-sm font-extrabold text-[#354840]">

                            {hasFilter
                              ? "Data tidak ditemukan"
                              : "Belum ada histori harga"}

                          </h3>

                          <p className="mt-2 max-w-sm text-xs leading-5 text-[#98A49F]">

                            {hasFilter
                              ? "Tidak ada data yang sesuai dengan pencarian, status atau periode tanggal yang dipilih."
                              : "Histori perubahan harga akan muncul di halaman ini setelah tersedia."}

                          </p>

                          {hasFilter && (
                            <button
                              type="button"
                              onClick={
                                resetFilter
                              }
                              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#497F70] to-[#386C5D] px-4 py-2.5 text-xs font-bold text-white shadow-[0_7px_18px_rgba(73,127,112,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(73,127,112,0.25)]"
                            >

                              <X size={14} />

                              Reset Filter

                            </button>
                          )}

                        </div>

                      </td>

                    </tr>
                  )}

                {/* DATA */}

                {!loading &&
                  filteredRows.map(
                    (row: any) => {

                      const hargaLama =
                        Number(
                          row.hargaLama ??
                            0
                        );

                      const hargaBaru =
                        Number(
                          row.hargaBaru ??
                            0
                        );

                      const selisih =
                        Number(
                          row.selisihHarga ??
                            0
                        );

                      const status =
                        getStatus(row);

                      const naik =
                        status ===
                        "NAIK";

                      const turun =
                        status ===
                        "TURUN";

                      return (
                        <tr
                          key={row.id}
                          className="group border-b border-[#EDF1EF] bg-white transition-all hover:bg-[#FAFCFB]"
                        >

                          {/* TANGGAL */}

                          <td className="whitespace-nowrap px-5 py-4">

                            <div className="flex items-center gap-2.5">

                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F1F6F3] text-[#6D8178] transition group-hover:bg-[#E7F0EC] group-hover:text-[#497F70]">

                                <CalendarDays
                                  size={14}
                                />

                              </div>

                              <div>

                                <div className="font-bold text-[#4F6259]">
                                  {formatDate(
                                    row.receiveDate
                                  )}
                                </div>

                                <div className="mt-0.5 text-[9px] text-[#A0AAA5]">
                                  Penerimaan
                                </div>

                              </div>

                            </div>

                          </td>

                          {/* PO */}

                          <td className="whitespace-nowrap px-5 py-4">

                            <div className="inline-flex items-center gap-2 rounded-lg border border-[#E0E9E5] bg-[#F6F9F7] px-2.5 py-1.5">

                              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#E3EEE9] text-[#497F70]">

                                <Package size={11} />

                              </span>

                              <span className="font-mono text-[11px] font-extrabold text-[#3F5E53]">
                                {row.poNumber ||
                                  "-"}
                              </span>

                            </div>

                          </td>

                          {/* SUPPLIER */}

                          <td className="px-5 py-4">

                            <div className="max-w-[190px]">

                              <div className="truncate font-semibold text-[#53645D]">
                                {row.supplier
                                  ?.name ||
                                  "-"}
                              </div>

                              {row.supplier
                                ?.code && (
                                <div className="mt-1 truncate font-mono text-[9px] text-[#9AA6A1]">
                                  {
                                    row
                                      .supplier
                                      .code
                                  }
                                </div>
                              )}

                            </div>

                          </td>

                          {/* BARANG */}

                          <td className="px-5 py-4">

                            <div className="max-w-[310px]">

                              <div className="truncate font-extrabold text-[#30483F]">
                                {row.barang
                                  ?.name ||
                                  "-"}
                              </div>

                              {(row.barang
                                ?.code ||
                                row.barang
                                  ?.barcode) && (
                                <div className="mt-1.5 flex items-center gap-1.5 truncate text-[9px] text-[#9AA6A1]">

                                  {row.barang
                                    ?.code && (
                                    <span className="rounded bg-[#F3F6F4] px-1.5 py-0.5 font-mono font-semibold">
                                      {
                                        row
                                          .barang
                                          .code
                                      }
                                    </span>
                                  )}

                                  {row.barang
                                    ?.barcode && (
                                    <>
                                      <span className="text-[#C0C8C4]">
                                        •
                                      </span>

                                      <span className="font-mono">
                                        {
                                          row
                                            .barang
                                            .barcode
                                        }
                                      </span>
                                    </>
                                  )}

                                </div>
                              )}

                            </div>

                          </td>

                          {/* SATUAN */}

                          <td className="px-5 py-4 text-center">

                            <span className="inline-flex rounded-lg border border-[#E4EAE7] bg-[#F6F8F7] px-2.5 py-1.5 text-[10px] font-extrabold text-[#687871]">
                              {row.barang
                                ?.unit ||
                                "-"}
                            </span>

                          </td>

                          {/* HARGA LAMA */}

                          <td className="whitespace-nowrap px-5 py-4 text-right">

                            <span className="font-medium tabular-nums text-[#8D9994]">
                              Rp{" "}
                              {formatNumber(
                                hargaLama
                              )}
                            </span>

                          </td>

                          {/* HARGA BARU */}

                          <td className="whitespace-nowrap px-5 py-4 text-right">

                            <div className="inline-flex items-center gap-2">

                              {naik && (
                                <ArrowUpRight
                                  size={13}
                                  className="text-red-400"
                                />
                              )}

                              {turun && (
                                <ArrowDownRight
                                  size={13}
                                  className="text-emerald-500"
                                />
                              )}

                              <span className="font-black tabular-nums text-[#18352D]">
                                Rp{" "}
                                {formatNumber(
                                  hargaBaru
                                )}
                              </span>

                            </div>

                          </td>

                          {/* SELISIH */}

                          <td
                            className={`whitespace-nowrap px-5 py-4 text-right font-extrabold tabular-nums ${
                              naik
                                ? "text-red-600"
                                : turun
                                ? "text-emerald-600"
                                : "text-[#89958F]"
                            }`}
                          >

                            <span className="inline-flex items-center gap-1">

                              {naik && (
                                <ArrowUpRight
                                  size={13}
                                />
                              )}

                              {turun && (
                                <ArrowDownRight
                                  size={13}
                                />
                              )}

                              {naik
                                ? "+"
                                : ""}

                              Rp{" "}
                              {formatNumber(
                                selisih
                              )}

                            </span>

                          </td>

                          {/* PERSEN */}

                          <td
                            className={`whitespace-nowrap px-5 py-4 text-right font-black tabular-nums ${
                              naik
                                ? "text-red-600"
                                : turun
                                ? "text-emerald-600"
                                : "text-[#89958F]"
                            }`}
                          >

                            {naik &&
                              "+"}

                            {formatPercent(
                              row.persenNaik
                            )}
                            %

                          </td>

                          {/* STATUS */}

                          <td className="px-5 py-4 text-center">

                            <StatusBadge
                              status={
                                status
                              }
                            />

                          </td>

                          {/* QTY */}

                          <td className="whitespace-nowrap px-5 py-4 text-right">

                            <span className="font-bold tabular-nums text-[#53645D]">
                              {formatNumber(
                                row.qty
                              )}
                            </span>

                          </td>

                          {/* TOTAL */}

                          <td className="whitespace-nowrap px-5 py-4 text-right">

                            <div className="font-black tabular-nums text-[#18352D]">
                              Rp{" "}
                              {formatNumber(
                                row.total
                              )}
                            </div>

                          </td>

                        </tr>
                      );
                    }
                  )}

              </tbody>

            </table>

          </div>

          {/* TABLE FOOTER */}

          {!loading &&
            filteredRows.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-[#E8EEEB] bg-gradient-to-r from-[#FAFCFB] to-white px-5 py-4 text-[10px] text-[#8A9791] sm:flex-row sm:items-center sm:justify-between">

                <div className="flex items-center gap-2">

                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF3EE] text-[#497F70]">
                    <Database size={12} />
                  </div>

                  <div>

                    <span className="font-semibold text-[#687871]">
                      Histori harga pembelian
                    </span>

                    <span className="mx-1.5 text-[#C5CDC9]">
                      •
                    </span>

                    <span>
                      Berdasarkan penerimaan barang
                    </span>

                  </div>

                </div>

                <div className="flex items-center gap-4">

                  <div>

                    <span className="font-black text-[#18352D]">
                      {formatNumber(
                        filteredRows.length
                      )}
                    </span>{" "}
                    record

                  </div>

                  <div className="hidden h-4 w-px bg-[#DDE5E1] sm:block" />

                  <div>

                    Nilai{" "}

                    <span className="font-black text-[#18352D]">
                      Rp{" "}
                      {formatNumber(
                        totalPurchaseValue
                      )}
                    </span>

                  </div>

                </div>

              </div>
            )}

        </section>

      </main>

    </div>
  );
}