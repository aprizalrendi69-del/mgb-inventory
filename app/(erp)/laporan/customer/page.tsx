"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  Users,
  Search,
  FileDown,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Wallet,
  ShoppingCart,
  Package,
  X,
  CalendarDays,
  RotateCcw,
  TrendingUp,
  BarChart3,
} from "lucide-react";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { exportReportExcel } from "@/lib/exportReportExcel";
import { printTable } from "@/lib/print";

type CustomerReport = {
  id: number;
  name?: string;
  pic?: string;
  transaksi?: number;
  qty?: number;
  nominal?: number;
};

export default function LaporanCustomer() {
  const [data, setData] =
    useState<CustomerReport[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [start, setStart] =
    useState("");

  const [end, setEnd] =
    useState("");

  // =========================================================
  // LOAD DATA
  // =========================================================

  useEffect(() => {
    loadData();
  }, []);

  async function loadData(
    customStart = start,
    customEnd = end
  ) {
    try {
      setLoading(true);

      let url =
        "/api/laporan/customer";

      const params =
        new URLSearchParams();

      if (customStart) {
        params.append(
          "start",
          customStart
        );
      }

      if (customEnd) {
        params.append(
          "end",
          customEnd
        );
      }

      const query =
        params.toString();

      if (query) {
        url += `?${query}`;
      }

      console.log(
        "LAPORAN CUSTOMER API:",
        url
      );

      const res = await fetch(
        url,
        {
          cache: "no-store",
        }
      );

      const json =
        await res.json();

      if (json.success) {
        setData(
          json.data ?? []
        );
      } else {
        setData([]);
      }
    } catch (error) {
      console.error(
        "Gagal mengambil laporan customer:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // FILTER LOCAL SEARCH
  // =========================================================

  const filteredData =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (!keyword) {
        return data;
      }

      return data.filter(
        (item) =>
          item.name
            ?.toLowerCase()
            .includes(keyword) ||
          item.pic
            ?.toLowerCase()
            .includes(keyword)
      );
    }, [data, search]);

  // =========================================================
  // SUMMARY
  // =========================================================

  const totalCustomer =
    filteredData.length;

  const totalTransaksi =
    useMemo(() => {
      return filteredData.reduce(
        (sum, item) =>
          sum +
          Number(
            item.transaksi ?? 0
          ),
        0
      );
    }, [filteredData]);

  const totalQty =
    useMemo(() => {
      return filteredData.reduce(
        (sum, item) =>
          sum +
          Number(
            item.qty ?? 0
          ),
        0
      );
    }, [filteredData]);

  const totalNominal =
    useMemo(() => {
      return filteredData.reduce(
        (sum, item) =>
          sum +
          Number(
            item.nominal ?? 0
          ),
        0
      );
    }, [filteredData]);

  // =========================================================
  // FORMAT
  // =========================================================

  function formatNumber(
    value: number
  ) {
    return Number(
      value ?? 0
    ).toLocaleString(
      "id-ID"
    );
  }

  function formatRupiah(
    value: number
  ) {
    return (
      "Rp " +
      Number(
        value ?? 0
      ).toLocaleString(
        "id-ID"
      )
    );
  }

  function formatDate(
    value: string
  ) {
    if (!value) {
      return "-";
    }

    const date =
      new Date(
        `${value}T00:00:00`
      );

    return date.toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  function formatLongDate(
    value: string
  ) {
    if (!value) {
      return "-";
    }

    const date =
      new Date(
        `${value}T00:00:00`
      );

    return date.toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    );
  }

  // =========================================================
  // PERIOD LABEL
  // =========================================================

  const periodLabel =
    useMemo(() => {
      if (start && end) {
        return `${formatDate(
          start
        )} — ${formatDate(end)}`;
      }

      if (start) {
        return `Mulai ${formatDate(
          start
        )}`;
      }

      if (end) {
        return `Sampai ${formatDate(
          end
        )}`;
      }

      return "Semua Periode";
    }, [start, end]);

  const hasDateFilter =
    Boolean(start || end);

  const hasAnyFilter =
    Boolean(
      search ||
        start ||
        end
    );

  // =========================================================
  // APPLY FILTER
  // =========================================================

  function handleFilter() {
    if (
      start &&
      end &&
      start > end
    ) {
      alert(
        "Tanggal mulai tidak boleh lebih besar dari tanggal akhir."
      );

      return;
    }

    loadData(
      start,
      end
    );
  }

  // =========================================================
  // RESET
  // =========================================================

  function resetFilter() {
    setSearch("");
    setStart("");
    setEnd("");

    loadData(
      "",
      ""
    );
  }

  // =========================================================
  // EXPORT DATA
  // =========================================================

  const columns = [
    "No",
    "Customer",
    "PIC",
    "Total Transaksi",
    "Total Qty",
    "Total Nominal",
  ];

  const rows =
    filteredData.map(
      (item, index) => [
        index + 1,
        item.name ?? "-",
        item.pic ?? "-",
        Number(
          item.transaksi ?? 0
        ),
        Number(
          item.qty ?? 0
        ),
        formatRupiah(
          Number(
            item.nominal ?? 0
          )
        ),
      ]
    );

  // =========================================================
  // PREMIUM PDF
  // =========================================================

  function exportPremiumPDF() {
    if (
      filteredData.length === 0
    ) {
      return;
    }

    const doc =
      new jsPDF(
        "p",
        "mm",
        "a4"
      );

    const pageWidth =
      doc.internal.pageSize.getWidth();

    const pageHeight =
      doc.internal.pageSize.getHeight();

    const margin = 14;

    // -------------------------------------------------------
    // COLORS
    // -------------------------------------------------------

    const green = [
      73,
      127,
      112,
    ];

    const dark = [
      24,
      53,
      45,
    ];

    const text = [
      55,
      65,
      81,
    ];

    const muted = [
      107,
      114,
      128,
    ];

    const border = [
      221,
      233,
      228,
    ];

    const soft = [
      234,
      243,
      239,
    ];

    const light = [
      247,
      250,
      248,
    ];

    const white = [
      255,
      255,
      255,
    ];

    // -------------------------------------------------------
    // TOP ACCENT
    // -------------------------------------------------------

    doc.setFillColor(
      green[0],
      green[1],
      green[2]
    );

    doc.rect(
      0,
      0,
      pageWidth,
      8,
      "F"
    );

    // -------------------------------------------------------
    // HEADER
    // -------------------------------------------------------

    doc.setTextColor(
      dark[0],
      dark[1],
      dark[2]
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(20);

    doc.text(
      "LAPORAN CUSTOMER",
      margin,
      23
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(9);

    doc.setTextColor(
      muted[0],
      muted[1],
      muted[2]
    );

    doc.text(
      "Ringkasan transaksi customer, quantity dan nilai penjualan",
      margin,
      29
    );

    const printedAt =
      new Date().toLocaleString(
        "id-ID",
        {
          dateStyle: "long",
          timeStyle: "short",
        }
      );

    doc.setFontSize(8);

    doc.text(
      `Dicetak: ${printedAt}`,
      pageWidth - margin,
      22,
      {
        align: "right",
      }
    );

    doc.text(
      `Periode: ${periodLabel}`,
      pageWidth - margin,
      27,
      {
        align: "right",
      }
    );

    // -------------------------------------------------------
    // REPORT INFORMATION CARD
    // -------------------------------------------------------

    let y = 38;

    doc.setFillColor(
      soft[0],
      soft[1],
      soft[2]
    );

    doc.roundedRect(
      margin,
      y,
      pageWidth -
        margin * 2,
      19,
      4,
      4,
      "F"
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(8);

    doc.setTextColor(
      dark[0],
      dark[1],
      dark[2]
    );

    doc.text(
      "INFORMASI LAPORAN",
      margin + 5,
      y + 7
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setTextColor(
      muted[0],
      muted[1],
      muted[2]
    );

    doc.text(
      `Periode transaksi: ${periodLabel}`,
      margin + 5,
      y + 13
    );

    if (search.trim()) {
      doc.text(
        `Pencarian: ${search.trim()}`,
        pageWidth -
          margin -
          5,
        y + 13,
        {
          align: "right",
        }
      );
    }

    y += 27;

    // -------------------------------------------------------
    // SUMMARY CARDS
    // -------------------------------------------------------

    const gap = 4;

    const cardWidth =
      (pageWidth -
        margin * 2 -
        gap * 3) /
      4;

    const cardHeight = 27;

    const cards = [
      {
        label:
          "TOTAL CUSTOMER",
        value:
          formatNumber(
            totalCustomer
          ),
      },
      {
        label:
          "TOTAL TRANSAKSI",
        value:
          formatNumber(
            totalTransaksi
          ),
      },
      {
        label:
          "TOTAL QTY",
        value:
          formatNumber(
            totalQty
          ),
      },
      {
        label:
          "TOTAL NOMINAL",
        value:
          formatRupiah(
            totalNominal
          ),
      },
    ];

    cards.forEach(
      (
        card,
        index
      ) => {
        const x =
          margin +
          index *
            (cardWidth + gap);

        doc.setFillColor(
          white[0],
          white[1],
          white[2]
        );

        doc.setDrawColor(
          border[0],
          border[1],
          border[2]
        );

        doc.roundedRect(
          x,
          y,
          cardWidth,
          cardHeight,
          3,
          3,
          "FD"
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(6.5);

        doc.setTextColor(
          muted[0],
          muted[1],
          muted[2]
        );

        doc.text(
          card.label,
          x + 4,
          y + 7
        );

        doc.setFontSize(
          index === 3
            ? 8.5
            : 12
        );

        doc.setTextColor(
          index === 3
            ? green[0]
            : dark[0],
          index === 3
            ? green[1]
            : dark[1],
          index === 3
            ? green[2]
            : dark[2]
        );

        doc.text(
          card.value,
          x + 4,
          y + 18
        );
      }
    );

    y += 35;

    // -------------------------------------------------------
    // TABLE
    // -------------------------------------------------------

    const tableBody =
      filteredData.map(
        (item, index) => [
          index + 1,
          item.name ?? "-",
          item.pic ?? "-",
          formatNumber(
            Number(
              item.transaksi ?? 0
            )
          ),
          formatNumber(
            Number(
              item.qty ?? 0
            )
          ),
          formatRupiah(
            Number(
              item.nominal ?? 0
            )
          ),
        ]
      );

    autoTable(
      doc,
      {
        startY: y,

        head: [[
          "No",
          "Customer",
          "PIC",
          "Transaksi",
          "Qty",
          "Total Nominal",
        ]],

        body: tableBody,

        margin: {
          left: margin,
          right: margin,
          bottom: 20,
        },

        theme: "grid",

        styles: {
          font:
            "helvetica",
          fontSize: 8,
          cellPadding: 3.2,
          lineColor:
            border,
          lineWidth: 0.2,
          textColor:
            text,
          valign:
            "middle",
        },

        headStyles: {
          fillColor:
            green,
          textColor:
            white,
          fontStyle:
            "bold",
          halign:
            "center",
          valign:
            "middle",
        },

        alternateRowStyles: {
          fillColor:
            light,
        },

        columnStyles: {
          0: {
            cellWidth: 11,
            halign:
              "center",
          },

          1: {
            cellWidth: 50,
            fontStyle:
              "bold",
          },

          2: {
            cellWidth: 38,
          },

          3: {
            cellWidth: 25,
            halign:
              "right",
          },

          4: {
            cellWidth: 21,
            halign:
              "right",
          },

          5: {
            cellWidth: 38,
            halign:
              "right",
            fontStyle:
              "bold",
          },
        },

        foot: [[
          "",
          "",
          "TOTAL",
          formatNumber(
            totalTransaksi
          ),
          formatNumber(
            totalQty
          ),
          formatRupiah(
            totalNominal
          ),
        ]],

        footStyles: {
          fillColor:
            soft,
          textColor:
            dark,
          fontStyle:
            "bold",
          halign:
            "right",
        },

        didDrawPage:
          () => {
            const pageNumber =
              doc.getNumberOfPages();

            // FOOTER LINE

            doc.setDrawColor(
              border[0],
              border[1],
              border[2]
            );

            doc.line(
              margin,
              pageHeight - 14,
              pageWidth -
                margin,
              pageHeight - 14
            );

            doc.setFont(
              "helvetica",
              "normal"
            );

            doc.setFontSize(7);

            doc.setTextColor(
              muted[0],
              muted[1],
              muted[2]
            );

            doc.text(
              "MGB ERP • Laporan Customer",
              margin,
              pageHeight - 8
            );

            doc.text(
              `Halaman ${pageNumber}`,
              pageWidth -
                margin,
              pageHeight - 8,
              {
                align:
                  "right",
              }
            );
          },
      }
    );

    // -------------------------------------------------------
    // SAVE
    // -------------------------------------------------------

    const safeName =
      "Laporan-Customer";

    let fileName =
      safeName;

    if (start || end) {
      fileName +=
        `-${start || "awal"}-${end || "akhir"}`;
    }

    if (search.trim()) {
      fileName +=
        `-filter`;
    }

    fileName +=
      ".pdf";

    doc.save(
      fileName
    );
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center">

          <div
            className="
              flex
              h-14
              w-14
              items-center
              justify-center
              rounded-2xl
              bg-[#EAF3EF]
              text-[#497F70]
              shadow-sm
            "
          >
            <RefreshCw
              size={24}
              className="animate-spin"
            />
          </div>

          <p className="mt-4 text-sm font-semibold text-gray-600">
            Memuat laporan customer...
          </p>

          <p className="mt-1 text-xs text-gray-400">
            Menyiapkan data transaksi
          </p>

        </div>
      </div>
    );
  }

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="space-y-6 pb-10">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div
        className="
          flex
          flex-col
          gap-5
          md:flex-row
          md:items-center
          md:justify-between
        "
      >

        <div className="flex items-center gap-4">

          <div
            className="
              flex
              h-14
              w-14
              shrink-0
              items-center
              justify-center
              rounded-2xl
              bg-[#497F70]
              text-white
              shadow-lg
              shadow-[#497F70]/20
            "
          >
            <Users size={26} />
          </div>

          <div>

            <div className="flex items-center gap-2">

              <h1
                className="
                  text-2xl
                  font-bold
                  tracking-tight
                  text-[#18352D]
                  md:text-3xl
                "
              >
                Laporan Customer
              </h1>

              <span
                className="
                  hidden
                  rounded-full
                  bg-[#EAF3EF]
                  px-2.5
                  py-1
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-wider
                  text-[#497F70]
                  sm:inline-flex
                "
              >
                Sales Report
              </span>

            </div>

            <p className="mt-1 text-sm text-gray-500">
              Ringkasan transaksi, quantity,
              dan nilai penjualan customer
            </p>

          </div>

        </div>

        <button
          type="button"
          onClick={() =>
            loadData(
              start,
              end
            )
          }
          disabled={loading}
          className="
            inline-flex
            items-center
            justify-center
            gap-2
            rounded-xl
            border
            border-[#DDE9E4]
            bg-white
            px-4
            py-2.5
            text-sm
            font-semibold
            text-[#35564C]
            shadow-sm
            transition
            hover:bg-[#F5F8F6]
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>

      </div>

      {/* =====================================================
          PERIOD BANNER
      ===================================================== */}

      <div
        className="
          flex
          flex-col
          gap-3
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-gradient-to-r
          from-[#EAF3EF]
          to-white
          p-4
          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >

        <div className="flex items-center gap-3">

          <div
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-white
              text-[#497F70]
              shadow-sm
            "
          >
            <CalendarDays size={18} />
          </div>

          <div>

            <p className="text-[10px] font-bold uppercase tracking-wider text-[#497F70]">
              Periode Laporan
            </p>

            <p className="mt-0.5 text-sm font-bold text-[#18352D]">
              {periodLabel}
            </p>

          </div>

        </div>

        <div className="flex flex-wrap items-center gap-2">

          {search && (
            <span
              className="
                rounded-full
                bg-white
                px-3
                py-1.5
                text-xs
                font-semibold
                text-gray-600
                shadow-sm
              "
            >
              Search: {search}
            </span>
          )}

          <span
            className="
              rounded-full
              bg-[#497F70]
              px-3
              py-1.5
              text-xs
              font-bold
              text-white
            "
          >
            {formatNumber(
              filteredData.length
            )}{" "}
            customer
          </span>

        </div>

      </div>

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div
        className="
          grid
          grid-cols-1
          gap-4
          sm:grid-cols-2
          xl:grid-cols-4
        "
      >

        {/* CUSTOMER */}

        <div
          className="
            group
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
            transition
            hover:-translate-y-0.5
            hover:shadow-md
          "
        >

          <div className="flex items-start justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Total Customer
              </p>

              <p className="mt-2 text-3xl font-bold tracking-tight text-[#18352D]">
                {formatNumber(
                  totalCustomer
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Customer dalam laporan
              </p>

            </div>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-[#EAF3EF]
                text-[#497F70]
                transition
                group-hover:scale-105
              "
            >
              <Users size={20} />
            </div>

          </div>

        </div>

        {/* TRANSAKSI */}

        <div
          className="
            group
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
            transition
            hover:-translate-y-0.5
            hover:shadow-md
          "
        >

          <div className="flex items-start justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Total Transaksi
              </p>

              <p className="mt-2 text-3xl font-bold tracking-tight text-[#18352D]">
                {formatNumber(
                  totalTransaksi
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Total delivery customer
              </p>

            </div>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-blue-50
                text-blue-600
                transition
                group-hover:scale-105
              "
            >
              <ShoppingCart size={20} />
            </div>

          </div>

        </div>

        {/* QTY */}

        <div
          className="
            group
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
            transition
            hover:-translate-y-0.5
            hover:shadow-md
          "
        >

          <div className="flex items-start justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Total Qty
              </p>

              <p className="mt-2 text-3xl font-bold tracking-tight text-[#18352D]">
                {formatNumber(
                  totalQty
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Jumlah barang keluar
              </p>

            </div>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-amber-50
                text-amber-600
                transition
                group-hover:scale-105
              "
            >
              <Package size={20} />
            </div>

          </div>

        </div>

        {/* NOMINAL */}

        <div
          className="
            group
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
            transition
            hover:-translate-y-0.5
            hover:shadow-md
          "
        >

          <div className="flex items-start justify-between">

            <div className="min-w-0">

              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Total Nominal
              </p>

              <p
                className="
                  mt-2
                  truncate
                  text-2xl
                  font-bold
                  tracking-tight
                  text-[#497F70]
                "
              >
                {formatRupiah(
                  totalNominal
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Nilai transaksi customer
              </p>

            </div>

            <div
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-[#EAF3EF]
                text-[#497F70]
                transition
                group-hover:scale-105
              "
            >
              <Wallet size={20} />
            </div>

          </div>

        </div>

      </div>

      {/* =====================================================
          FILTER
      ===================================================== */}

      <div
        className="
          overflow-hidden
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-white
          shadow-sm
        "
      >

        <div
          className="
            border-b
            border-[#E5ECE9]
            px-5
            py-5
            md:px-6
          "
        >

          <div className="flex items-center gap-3">

            <div
              className="
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-xl
                bg-[#EAF3EF]
                text-[#497F70]
              "
            >
              <BarChart3 size={17} />
            </div>

            <div>

              <h2 className="font-bold text-[#18352D]">
                Filter Laporan
              </h2>

              <p className="mt-0.5 text-xs text-gray-500">
                Tentukan customer dan periode transaksi
              </p>

            </div>

          </div>

        </div>

        <div className="p-5 md:p-6">

          <div
            className="
              grid
              grid-cols-1
              gap-4
              lg:grid-cols-4
            "
          >

            {/* SEARCH */}

            <div className="lg:col-span-2">

              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#35564C]">
                Cari Customer / PIC
              </label>

              <div className="relative">

                <Search
                  size={18}
                  className="
                    absolute
                    left-3.5
                    top-1/2
                    -translate-y-1/2
                    text-gray-400
                  "
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Nama customer atau PIC..."
                  className="
                    w-full
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    bg-[#FAFCFB]
                    py-3
                    pl-10
                    pr-10
                    text-sm
                    outline-none
                    transition
                    placeholder:text-gray-400
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-4
                    focus:ring-[#497F70]/10
                  "
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="
                      absolute
                      right-3
                      top-1/2
                      -translate-y-1/2
                      rounded-lg
                      p-1
                      text-gray-400
                      transition
                      hover:bg-[#EAF3EF]
                      hover:text-[#497F70]
                    "
                  >
                    <X size={16} />
                  </button>
                )}

              </div>

            </div>

            {/* START */}

            <div>

              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#35564C]">
                Dari Tanggal
              </label>

              <div className="relative">

                <CalendarDays
                  size={17}
                  className="
                    absolute
                    left-3.5
                    top-1/2
                    -translate-y-1/2
                    text-gray-400
                  "
                />

                <input
                  type="date"
                  value={start}
                  onChange={(e) =>
                    setStart(
                      e.target.value
                    )
                  }
                  className="
                    w-full
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    bg-[#FAFCFB]
                    py-3
                    pl-10
                    pr-3
                    text-sm
                    outline-none
                    transition
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-4
                    focus:ring-[#497F70]/10
                  "
                />

              </div>

            </div>

            {/* END */}

            <div>

              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#35564C]">
                Sampai Tanggal
              </label>

              <div className="relative">

                <CalendarDays
                  size={17}
                  className="
                    absolute
                    left-3.5
                    top-1/2
                    -translate-y-1/2
                    text-gray-400
                  "
                />

                <input
                  type="date"
                  value={end}
                  onChange={(e) =>
                    setEnd(
                      e.target.value
                    )
                  }
                  className="
                    w-full
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    bg-[#FAFCFB]
                    py-3
                    pl-10
                    pr-3
                    text-sm
                    outline-none
                    transition
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-4
                    focus:ring-[#497F70]/10
                  "
                />

              </div>

            </div>

          </div>

          {/* ACTION */}

          <div
            className="
              mt-5
              flex
              flex-wrap
              gap-2
              border-t
              border-[#EDF2EF]
              pt-5
            "
          >

            <button
              type="button"
              onClick={handleFilter}
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-[#497F70]
                px-5
                py-2.5
                text-sm
                font-bold
                text-white
                shadow-sm
                shadow-[#497F70]/20
                transition
                hover:bg-[#3D6D60]
              "
            >
              <Search size={17} />
              Terapkan Filter
            </button>

            <button
              type="button"
              onClick={resetFilter}
              disabled={!hasAnyFilter}
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-xl
                border
                border-[#D5E5DC]
                bg-white
                px-5
                py-2.5
                text-sm
                font-semibold
                text-[#35564C]
                transition
                hover:bg-[#F5F8F6]
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              <RotateCcw size={16} />
              Reset
            </button>

          </div>

          {/* ACTIVE FILTER */}

          <div className="mt-4 flex flex-wrap items-center gap-2">

            <span className="text-xs font-semibold text-gray-400">
              Filter aktif:
            </span>

            <span
              className="
                rounded-full
                bg-[#EAF3EF]
                px-3
                py-1.5
                text-xs
                font-bold
                text-[#497F70]
              "
            >
              <CalendarDays
                size={12}
                className="mr-1 inline"
              />
              {periodLabel}
            </span>

            {search && (
              <span
                className="
                  rounded-full
                  bg-gray-100
                  px-3
                  py-1.5
                  text-xs
                  font-semibold
                  text-gray-600
                "
              >
                <Search
                  size={12}
                  className="mr-1 inline"
                />
                {search}
              </span>
            )}

          </div>

          {/* EXPORT */}

          <div
            className="
              mt-5
              flex
              flex-col
              gap-3
              border-t
              border-[#EDF2EF]
              pt-5
              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >

            <div>

              <p className="text-sm text-gray-500">

                Menampilkan{" "}

                <span className="font-bold text-[#35564C]">
                  {formatNumber(
                    filteredData.length
                  )}
                </span>

                {" "}customer

              </p>

              {hasDateFilter && (
                <p className="mt-1 text-xs text-gray-400">
                  Data berdasarkan periode{" "}
                  <span className="font-semibold">
                    {periodLabel}
                  </span>
                </p>
              )}

            </div>

            <div className="flex flex-wrap gap-2">

              <button
                type="button"
                disabled={
                  filteredData.length === 0
                }
                onClick={
                  exportPremiumPDF
                }
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-[#497F70]
                  px-4
                  py-2.5
                  text-sm
                  font-bold
                  text-white
                  shadow-sm
                  transition
                  hover:bg-[#3D6D60]
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              >
                <FileDown size={17} />
                PDF
              </button>

              <button
                type="button"
                disabled={
                  filteredData.length === 0
                }
                onClick={() =>
                  exportReportExcel(
                    "Laporan Customer",
                    columns,
                    rows
                  )
                }
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-white
                  px-4
                  py-2.5
                  text-sm
                  font-semibold
                  text-[#35564C]
                  transition
                  hover:bg-[#F5F8F6]
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              >
                <FileSpreadsheet size={17} />
                Excel
              </button>

              <button
                type="button"
                disabled={
                  filteredData.length === 0
                }
                onClick={() =>
                  printTable(
                    columns,
                    rows
                  )
                }
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-white
                  px-4
                  py-2.5
                  text-sm
                  font-semibold
                  text-[#35564C]
                  transition
                  hover:bg-[#F5F8F6]
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              >
                <Printer size={17} />
                Print
              </button>

            </div>

          </div>

        </div>

      </div>

      {/* =====================================================
          TABLE
      ===================================================== */}

      <div
        className="
          overflow-hidden
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-white
          shadow-sm
        "
      >

        {/* TABLE HEADER */}

        <div
          className="
            flex
            flex-col
            gap-3
            border-b
            border-[#E5ECE9]
            px-5
            py-5
            md:flex-row
            md:items-center
            md:justify-between
            md:px-6
          "
        >

          <div className="flex items-center gap-3">

            <div
              className="
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-xl
                bg-[#EAF3EF]
                text-[#497F70]
              "
            >
              <TrendingUp size={17} />
            </div>

            <div>

              <h2 className="font-bold text-[#18352D]">
                Data Customer
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Klik nama customer untuk melihat detail transaksi
              </p>

            </div>

          </div>

          <div
            className="
              flex
              items-center
              gap-2
              rounded-xl
              bg-[#F5F8F6]
              px-3
              py-2
              text-xs
              font-semibold
              text-[#35564C]
            "
          >
            <Users size={14} />

            {formatNumber(
              filteredData.length
            )}{" "}
            Customer

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table
            className="
              min-w-[900px]
              w-full
              text-sm
            "
          >

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="w-16 px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#35564C]">
                  Customer
                </th>

                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#35564C]">
                  PIC
                </th>

                <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-[#35564C]">
                  Transaksi
                </th>

                <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-[#35564C]">
                  Qty
                </th>

                <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-[#35564C]">
                  Total Nominal
                </th>

              </tr>

            </thead>

            <tbody>

              {filteredData.length ===
              0 ? (

                <tr>

                  <td
                    colSpan={6}
                    className="px-5 py-16 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <div
                        className="
                          mb-4
                          flex
                          h-14
                          w-14
                          items-center
                          justify-center
                          rounded-2xl
                          bg-[#EAF3EF]
                          text-[#497F70]
                        "
                      >
                        <Users size={25} />
                      </div>

                      <p className="font-semibold text-gray-700">
                        Tidak ada data customer
                      </p>

                      <p className="mt-1 max-w-sm text-xs text-gray-400">
                        Tidak ditemukan customer
                        berdasarkan filter atau
                        pencarian yang digunakan.
                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                filteredData.map(
                  (
                    item,
                    index
                  ) => (

                    <tr
                      key={item.id}
                      className="
                        border-b
                        border-[#EDF2EF]
                        transition
                        hover:bg-[#FAFCFB]
                      "
                    >

                      {/* NO */}

                      <td className="px-5 py-4 text-center">

                        <span
                          className="
                            inline-flex
                            h-7
                            w-7
                            items-center
                            justify-center
                            rounded-lg
                            bg-gray-100
                            text-xs
                            font-semibold
                            text-gray-500
                          "
                        >
                          {index + 1}
                        </span>

                      </td>

                      {/* CUSTOMER */}

                      <td className="px-5 py-4">

                        <Link
                          href={`/laporan/customer/${item.id}`}
                          className="
                            inline-flex
                            items-center
                            gap-2
                            font-semibold
                            text-[#497F70]
                            transition
                            hover:text-[#3D6D60]
                            hover:underline
                          "
                        >
                          {item.name ?? "-"}

                        </Link>

                      </td>

                      {/* PIC */}

                      <td className="px-5 py-4 text-gray-600">
                        {item.pic ?? "-"}
                      </td>

                      {/* TRANSAKSI */}

                      <td className="px-5 py-4 text-right">

                        <span
                          className="
                            inline-flex
                            min-w-[55px]
                            justify-center
                            rounded-lg
                            bg-blue-50
                            px-2.5
                            py-1.5
                            text-xs
                            font-bold
                            text-blue-700
                          "
                        >
                          {formatNumber(
                            Number(
                              item.transaksi ??
                                0
                            )
                          )}
                        </span>

                      </td>

                      {/* QTY */}

                      <td className="px-5 py-4 text-right">

                        <span
                          className="
                            inline-flex
                            min-w-[55px]
                            justify-center
                            rounded-lg
                            bg-amber-50
                            px-2.5
                            py-1.5
                            text-xs
                            font-bold
                            text-amber-700
                          "
                        >
                          {formatNumber(
                            Number(
                              item.qty ??
                                0
                            )
                          )}
                        </span>

                      </td>

                      {/* NOMINAL */}

                      <td className="px-5 py-4 text-right">

                        <span className="font-bold text-[#497F70]">
                          {formatRupiah(
                            Number(
                              item.nominal ??
                                0
                            )
                          )}
                        </span>

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

            {/* =================================================
                TOTAL
            ================================================= */}

            {filteredData.length >
              0 && (

              <tfoot>

                <tr
                  className="
                    border-t-2
                    border-[#DDE9E4]
                    bg-[#F5F8F6]
                  "
                >

                  <td
                    colSpan={3}
                    className="
                      px-5
                      py-5
                      text-right
                      text-sm
                      font-bold
                      text-[#35564C]
                    "
                  >
                    TOTAL
                  </td>

                  <td className="px-5 py-5 text-right text-sm font-bold text-[#18352D]">
                    {formatNumber(
                      totalTransaksi
                    )}
                  </td>

                  <td className="px-5 py-5 text-right text-sm font-bold text-[#18352D]">
                    {formatNumber(
                      totalQty
                    )}
                  </td>

                  <td className="px-5 py-5 text-right text-sm font-bold text-[#497F70]">
                    {formatRupiah(
                      totalNominal
                    )}
                  </td>

                </tr>

              </tfoot>

            )}

          </table>

        </div>

        {/* =====================================================
            TABLE FOOTER
        ===================================================== */}

        <div
          className="
            flex
            flex-col
            gap-3
            border-t
            border-[#E5ECE9]
            bg-[#FAFCFB]
            px-5
            py-4
            md:flex-row
            md:items-center
            md:justify-between
            md:px-6
          "
        >

          <div className="text-xs text-gray-500">

            Menampilkan{" "}

            <span className="font-bold text-[#35564C]">
              {formatNumber(
                filteredData.length
              )}
            </span>{" "}
            customer

          </div>

          <div className="flex items-center gap-2">

            <span className="text-xs text-gray-400">
              Total Nominal
            </span>

            <span className="text-sm font-bold text-[#497F70]">
              {formatRupiah(
                totalNominal
              )}
            </span>

          </div>

        </div>

      </div>

    </div>
  );
}