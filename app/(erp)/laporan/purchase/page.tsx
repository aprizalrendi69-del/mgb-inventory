"use client";

import { useEffect, useMemo, useState } from "react";

import {
  FileText,
  Search,
  FileDown,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  ShoppingCart,
  CheckCircle2,
  Clock3,
  XCircle,
  CalendarDays,
  X,
  Package,
} from "lucide-react";

import {
  exportPurchaseReportPdf,
} from "@/lib/exportReportPdf";

import {
  exportReportExcel,
} from "@/lib/exportReportExcel";

import {
  printTable,
} from "@/lib/print";

type PurchaseItem = {
  id: number;
  barangId: number | null;
  kode: string;
  nama: string;
  satuan: string;
  qty: number;
  harga: number;
  subtotal: number;
};

type Purchase = {
  id: number;
  number: string;
  date: string;
  supplier: string;
  status: string;
  total: number;
  items: PurchaseItem[];
};

export default function LaporanPurchase() {
  const [data, setData] =
    useState<Purchase[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch(
        "/api/laporan/purchase",
        {
          cache: "no-store",
        }
      );

      const result =
        await res.json();

      console.log(
        "LAPORAN PURCHASE:",
        result
      );

      if (result.success) {
        setData(
          result.data ?? []
        );
      } else {
        setData([]);
      }
    } catch (error) {
      console.error(
        "Gagal mengambil laporan purchase:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // =====================================================
  // FILTER
  // =====================================================

  const filteredData =
    useMemo(() => {
      const keyword =
        search
          .toLowerCase()
          .trim();

      return data.filter(
        (item) => {
          const matchesSearch =
            !keyword ||
            item.number
              ?.toLowerCase()
              .includes(keyword) ||
            item.supplier
              ?.toLowerCase()
              .includes(keyword) ||
            item.items?.some(
              (barang) =>
                barang.kode
                  ?.toLowerCase()
                  .includes(keyword) ||
                barang.nama
                  ?.toLowerCase()
                  .includes(keyword)
            );

          const matchesStatus =
            statusFilter === "ALL" ||
            String(
              item.status
            ).toUpperCase() ===
              statusFilter;

          const itemDate =
            item.date
              ? new Date(
                  item.date
                )
                  .toISOString()
                  .split("T")[0]
              : "";

          const matchesStart =
            !startDate ||
            itemDate >=
              startDate;

          const matchesEnd =
            !endDate ||
            itemDate <=
              endDate;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesStart &&
            matchesEnd
          );
        }
      );
    }, [
      data,
      search,
      statusFilter,
      startDate,
      endDate,
    ]);

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalPurchase =
    useMemo(() => {
      return filteredData.reduce(
        (sum, item) =>
          sum +
          Number(
            item.total ?? 0
          ),
        0
      );
    }, [filteredData]);

  const totalDraft =
    useMemo(() => {
      return filteredData.filter(
        (item) =>
          String(
            item.status
          ).toUpperCase() ===
          "DRAFT"
      ).length;
    }, [filteredData]);

  const totalApproved =
    useMemo(() => {
      return filteredData.filter(
        (item) =>
          String(
            item.status
          ).toUpperCase() ===
          "APPROVED"
      ).length;
    }, [filteredData]);

  const totalReceived =
    useMemo(() => {
      return filteredData.filter(
        (item) =>
          String(
            item.status
          ).toUpperCase() ===
          "RECEIVED"
      ).length;
    }, [filteredData]);

  // =====================================================
  // FORMAT
  // =====================================================

  function formatNumber(
    value: any
  ) {
    return Number(
      value ?? 0
    ).toLocaleString(
      "id-ID"
    );
  }

  function formatDate(
    value: string
  ) {
    if (!value) {
      return "-";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
    }

    return date.toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  // =====================================================
  // STATUS
  // =====================================================

  function getStatusLabel(
    status: string
  ) {
    const value =
      String(
        status ?? ""
      ).toUpperCase();

    switch (value) {
      case "DRAFT":
        return "Draft";

      case "APPROVED":
        return "Approved";

      case "RECEIVED":
        return "Received";

      case "CANCELLED":
        return "Cancelled";

      default:
        return status || "-";
    }
  }

  function getStatusClass(
    status: string
  ) {
    const value =
      String(
        status ?? ""
      ).toUpperCase();

    switch (value) {
      case "APPROVED":
        return "bg-blue-50 text-blue-700 border-blue-200";

      case "RECEIVED":
        return "bg-green-50 text-green-700 border-green-200";

      case "DRAFT":
        return "bg-gray-50 text-gray-700 border-gray-200";

      case "CANCELLED":
        return "bg-red-50 text-red-700 border-red-200";

      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  }

  function getStatusIcon(
    status: string
  ) {
    const value =
      String(
        status ?? ""
      ).toUpperCase();

    switch (value) {
      case "APPROVED":
        return (
          <CheckCircle2
            size={14}
          />
        );

      case "RECEIVED":
        return (
          <CheckCircle2
            size={14}
          />
        );

      case "DRAFT":
        return (
          <Clock3
            size={14}
          />
        );

      case "CANCELLED":
        return (
          <XCircle
            size={14}
          />
        );

      default:
        return (
          <Clock3
            size={14}
          />
        );
    }
  }

  // =====================================================
  // EXPORT TABLE
  // =====================================================

  const columns = [
    "No",
    "No PO",
    "Tanggal",
    "Supplier",
    "Status",
    "Kode Barang",
    "Nama Barang",
    "Satuan",
    "Qty",
    "Harga",
    "Subtotal",
  ];

  // =====================================================
  // EXPORT ROWS
  // =====================================================
  //
  // SATU BARIS = SATU DETAIL BARANG
  //
  // Jadi kalau 1 PO mempunyai 5 barang,
  // PDF akan mempunyai 5 baris.
  // =====================================================

  const purchaseRows =
    useMemo(() => {
      const result: any[][] = [];

      filteredData.forEach(
        (purchase) => {
          const items =
            purchase.items ??
            [];

          if (
            items.length === 0
          ) {
            result.push([
              1,
              purchase.number ??
                "-",
              formatDate(
                purchase.date
              ),
              purchase.supplier ??
                "-",
              getStatusLabel(
                purchase.status
              ),
              "-",
              "Tidak ada detail barang",
              "-",
              0,
              0,
              0,
            ]);

            return;
          }

          items.forEach(
            (
              barang,
              index
            ) => {
              result.push([
                index + 1,

                purchase.number ??
                  "-",

                formatDate(
                  purchase.date
                ),

                purchase.supplier ??
                  "-",

                getStatusLabel(
                  purchase.status
                ),

                barang.kode ??
                  "-",

                barang.nama ??
                  "-",

                barang.satuan ??
                  "-",

                Number(
                  barang.qty ?? 0
                ),

                Number(
                  barang.harga ?? 0
                ),

                Number(
                  barang.subtotal ??
                    0
                ),
              ]);
            }
          );
        }
      );

      return result;
    }, [filteredData]);

  // =====================================================
  // EXCEL / PRINT ROWS
  // =====================================================

  const summaryRows =
    useMemo(() => {
      return filteredData.map(
        (item, index) => [
          index + 1,
          item.number ?? "-",
          formatDate(
            item.date
          ),
          item.supplier ?? "-",
          getStatusLabel(
            item.status
          ),
          "Rp " +
            formatNumber(
              item.total
            ),
        ]
      );
    }, [filteredData]);

  // =====================================================
  // EXPORT PDF
  // =====================================================

  function handleExportPdf() {
    if (
      purchaseRows.length === 0
    ) {
      return;
    }

    exportPurchaseReportPdf(
      "Laporan Purchase Order",
      columns,
      purchaseRows
    );
  }

  // =====================================================
  // EXPORT EXCEL
  // =====================================================

  function handleExportExcel() {
    if (
      summaryRows.length === 0
    ) {
      return;
    }

    exportReportExcel(
      "Laporan Purchase Order",
      [
        "No",
        "No PO",
        "Tanggal",
        "Supplier",
        "Status",
        "Total",
      ],
      summaryRows
    );
  }

  // =====================================================
  // PRINT
  // =====================================================

  function handlePrint() {
    if (
      summaryRows.length === 0
    ) {
      return;
    }

    printTable(
      [
        "No",
        "No PO",
        "Tanggal",
        "Supplier",
        "Status",
        "Total",
      ],
      summaryRows
    );
  }

  // =====================================================
  // RESET
  // =====================================================

  function resetFilter() {
    setSearch("");
    setStatusFilter(
      "ALL"
    );
    setStartDate("");
    setEndDate("");
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-xl
              bg-[#EAF3EF]
              text-[#497F70]
            "
          >
            <RefreshCw
              size={22}
              className="animate-spin"
            />
          </div>

          <p className="text-sm font-medium text-gray-500">
            Memuat laporan purchase...
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="space-y-6 pb-8">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-xl
              bg-[#497F70]
              text-white
              shadow-sm
            "
          >
            <FileText
              size={23}
            />
          </div>

          <div>
            <h1
              className="
                text-2xl
                font-bold
                tracking-tight
                text-[#18352D]
                md:text-3xl
              "
            >
              Laporan Purchase
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Ringkasan Purchase Order dan transaksi pembelian
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
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
            disabled:opacity-60
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

      {/* ================================================= */}
      {/* SUMMARY */}
      {/* ================================================= */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div
          className="
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
          "
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Total Purchase
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  filteredData.length
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Purchase Order
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
              "
            >
              <ShoppingCart
                size={20}
              />
            </div>
          </div>

          <div className="mt-3 border-t border-[#EDF2EF] pt-3">
            <p className="text-xs text-gray-400">
              Nilai purchase
            </p>

            <p className="mt-1 font-semibold text-[#497F70]">
              Rp{" "}
              {formatNumber(
                totalPurchase
              )}
            </p>
          </div>
        </div>

        <div
          className="
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
          "
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Draft
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalDraft
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Purchase masih draft
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
                bg-gray-100
                text-gray-600
              "
            >
              <Clock3
                size={20}
              />
            </div>
          </div>
        </div>

        <div
          className="
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
          "
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Approved
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalApproved
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Purchase disetujui
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
              "
            >
              <CheckCircle2
                size={20}
              />
            </div>
          </div>
        </div>

        <div
          className="
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
          "
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Received
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalReceived
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Barang sudah diterima
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
              "
            >
              <CheckCircle2
                size={20}
              />
            </div>
          </div>
        </div>

      </div>

      {/* ================================================= */}
      {/* FILTER */}
      {/* ================================================= */}

      <div
        className="
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-white
          p-5
          shadow-sm
          md:p-6
        "
      >

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

          <div className="relative w-full xl:max-w-xl">
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
              placeholder="Cari No PO, supplier, kode atau nama barang..."
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
                text-gray-700
                outline-none
                transition
                placeholder:text-gray-400
                focus:border-[#497F70]
                focus:bg-white
                focus:ring-2
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

          {/* EXPORT */}

          <div className="flex flex-wrap gap-2">

            <button
              type="button"
              onClick={
                handleExportPdf
              }
              disabled={
                purchaseRows.length ===
                0
              }
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-[#497F70]
                px-4
                py-3
                text-sm
                font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-[#3D6D60]
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              <FileDown
                size={17}
              />
              PDF
            </button>

            <button
              type="button"
              onClick={
                handleExportExcel
              }
              disabled={
                summaryRows.length ===
                0
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
                py-3
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
              <FileSpreadsheet
                size={17}
              />
              Excel
            </button>

            <button
              type="button"
              onClick={
                handlePrint
              }
              disabled={
                summaryRows.length ===
                0
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
                py-3
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
              <Printer
                size={17}
              />
              Print
            </button>

          </div>
        </div>

        {/* FILTER ROW */}

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-600">
              Status
            </label>

            <select
              value={
                statusFilter
              }
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
              className="
                w-full
                rounded-xl
                border
                border-[#D5E5DC]
                bg-[#FAFCFB]
                px-4
                py-3
                text-sm
                text-gray-700
                outline-none
                transition
                focus:border-[#497F70]
                focus:bg-white
                focus:ring-2
                focus:ring-[#497F70]/10
              "
            >
              <option value="ALL">
                Semua Status
              </option>

              <option value="DRAFT">
                Draft
              </option>

              <option value="APPROVED">
                Approved
              </option>

              <option value="RECEIVED">
                Received
              </option>

              <option value="CANCELLED">
                Cancelled
              </option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-600">
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
                value={
                  startDate
                }
                onChange={(e) =>
                  setStartDate(
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
                  pr-4
                  text-sm
                  text-gray-700
                  outline-none
                  transition
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-600">
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
                value={
                  endDate
                }
                onChange={(e) =>
                  setEndDate(
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
                  pr-4
                  text-sm
                  text-gray-700
                  outline-none
                  transition
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />
            </div>
          </div>

        </div>

        {/* INFO */}

        <div
          className="
            mt-5
            flex
            flex-col
            gap-2
            border-t
            border-[#EDF2EF]
            pt-4
            text-xs
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <p className="text-gray-500">
            Menampilkan{" "}
            <span className="font-semibold text-[#35564C]">
              {formatNumber(
                filteredData.length
              )}
            </span>{" "}
            dari{" "}
            <span className="font-semibold text-[#35564C]">
              {formatNumber(
                data.length
              )}
            </span>{" "}
            purchase
          </p>

          {(search ||
            statusFilter !==
              "ALL" ||
            startDate ||
            endDate) && (
            <button
              type="button"
              onClick={
                resetFilter
              }
              className="
                font-semibold
                text-[#497F70]
                transition
                hover:text-[#3D6D60]
              "
            >
              Reset filter
            </button>
          )}
        </div>
      </div>

      {/* ================================================= */}
      {/* TABLE */}
      {/* ================================================= */}

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
            flex
            flex-col
            gap-2
            border-b
            border-[#E5ECE9]
            px-5
            py-4
            md:flex-row
            md:items-center
            md:justify-between
            md:px-6
          "
        >
          <div>
            <h2 className="font-semibold text-[#18352D]">
              Daftar Purchase Order
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Purchase Order beserta detail barang
            </p>
          </div>

          <div
            className="
              w-fit
              rounded-full
              bg-[#EAF3EF]
              px-3
              py-1
              text-xs
              font-semibold
              text-[#497F70]
            "
          >
            {formatNumber(
              filteredData.length
            )}{" "}
            PO
          </div>
        </div>

        <div>

          {filteredData.length ===
          0 ? (
            <div className="px-5 py-14 text-center">
              <div className="flex flex-col items-center">
                <div
                  className="
                    mb-3
                    flex
                    h-14
                    w-14
                    items-center
                    justify-center
                    rounded-full
                    bg-[#EAF3EF]
                    text-[#497F70]
                  "
                >
                  <FileText
                    size={25}
                  />
                </div>

                <p className="font-semibold text-gray-700">
                  Tidak ada data purchase
                </p>

                <p className="mt-1 text-sm text-gray-400">
                  Coba ubah pencarian atau filter
                </p>
              </div>
            </div>
          ) : (
            filteredData.map(
              (
                item,
                index
              ) => (
                <div
                  key={item.id}
                  className="
                    border-b
                    border-[#DDE9E4]
                    last:border-b-0
                  "
                >

                  {/* PO HEADER */}

                  <div
                    className="
                      bg-white
                      px-5
                      py-4
                      transition
                      hover:bg-[#FAFCFB]
                      md:px-6
                    "
                  >
                    <div
                      className="
                        grid
                        grid-cols-1
                        gap-4
                        lg:grid-cols-[70px_minmax(220px,1.4fr)_150px_minmax(180px,1fr)_140px_180px]
                        lg:items-center
                      "
                    >
                      <div className="text-sm text-gray-500 lg:text-center">
                        {index + 1}
                      </div>

                      <div className="flex items-center gap-3">
                        <div
                          className="
                            flex
                            h-10
                            w-10
                            shrink-0
                            items-center
                            justify-center
                            rounded-lg
                            bg-[#EAF3EF]
                            text-[#497F70]
                          "
                        >
                          <ShoppingCart
                            size={18}
                          />
                        </div>

                        <div>
                          <p className="font-semibold text-[#18352D]">
                            {item.number ??
                              "-"}
                          </p>

                          <p className="text-xs text-gray-400">
                            Purchase Order
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                          Tanggal
                        </p>

                        <p className="text-sm text-gray-600">
                          {formatDate(
                            item.date
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                          Supplier
                        </p>

                        <p className="font-semibold text-[#18352D]">
                          {item.supplier ??
                            "-"}
                        </p>
                      </div>

                      <div className="lg:text-center">
                        <span
                          className={`
                            inline-flex
                            items-center
                            gap-1.5
                            rounded-full
                            border
                            px-3
                            py-1
                            text-xs
                            font-semibold
                            ${getStatusClass(
                              item.status
                            )}
                          `}
                        >
                          {getStatusIcon(
                            item.status
                          )}

                          {getStatusLabel(
                            item.status
                          )}
                        </span>
                      </div>

                      <div className="lg:text-right">
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                          Total PO
                        </p>

                        <p className="font-semibold text-[#497F70]">
                          Rp{" "}
                          {formatNumber(
                            item.total
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* DETAIL BARANG */}

                  <div
                    className="
                      bg-[#F8FAF9]
                      px-5
                      pb-5
                      md:px-6
                    "
                  >
                    <div
                      className="
                        overflow-hidden
                        rounded-xl
                        border
                        border-[#DDE9E4]
                        bg-white
                      "
                    >
                      <div
                        className="
                          flex
                          items-center
                          gap-2
                          border-b
                          border-[#E5ECE9]
                          bg-[#F1F6F3]
                          px-4
                          py-3
                        "
                      >
                        <Package
                          size={16}
                          className="text-[#497F70]"
                        />

                        <span className="text-sm font-semibold text-[#35564C]">
                          Detail Barang
                        </span>

                        <span
                          className="
                            rounded-full
                            bg-[#EAF3EF]
                            px-2
                            py-0.5
                            text-[11px]
                            font-semibold
                            text-[#497F70]
                          "
                        >
                          {item.items
                            ?.length ??
                            0}{" "}
                          item
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-[850px] w-full text-sm">
                          <thead>
                            <tr
                              className="
                                border-b
                                border-[#E5ECE9]
                                bg-white
                              "
                            >
                              <th className="w-12 px-4 py-3 text-center text-xs font-semibold text-[#35564C]">
                                No
                              </th>

                              <th className="px-4 py-3 text-left text-xs font-semibold text-[#35564C]">
                                Kode Barang
                              </th>

                              <th className="px-4 py-3 text-left text-xs font-semibold text-[#35564C]">
                                Nama Barang
                              </th>

                              <th className="px-4 py-3 text-center text-xs font-semibold text-[#35564C]">
                                Satuan
                              </th>

                              <th className="px-4 py-3 text-right text-xs font-semibold text-[#35564C]">
                                Qty
                              </th>

                              <th className="px-4 py-3 text-right text-xs font-semibold text-[#35564C]">
                                Harga
                              </th>

                              <th className="px-4 py-3 text-right text-xs font-semibold text-[#35564C]">
                                Subtotal
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {!item.items ||
                            item.items.length ===
                              0 ? (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="
                                    px-4
                                    py-6
                                    text-center
                                    text-sm
                                    text-gray-400
                                  "
                                >
                                  Tidak ada detail barang
                                </td>
                              </tr>
                            ) : (
                              item.items.map(
                                (
                                  barang,
                                  barangIndex
                                ) => (
                                  <tr
                                    key={
                                      barang.id
                                    }
                                    className="
                                      border-b
                                      border-[#EDF2EF]
                                      last:border-b-0
                                      hover:bg-[#FAFCFB]
                                    "
                                  >
                                    <td className="px-4 py-3 text-center text-gray-400">
                                      {barangIndex +
                                        1}
                                    </td>

                                    <td className="px-4 py-3">
                                      <span
                                        className="
                                          inline-flex
                                          rounded-lg
                                          bg-[#EAF3EF]
                                          px-2.5
                                          py-1
                                          font-mono
                                          text-xs
                                          font-semibold
                                          text-[#497F70]
                                        "
                                      >
                                        {barang.kode ??
                                          "-"}
                                      </span>
                                    </td>

                                    <td className="px-4 py-3">
                                      <p className="font-semibold text-[#18352D]">
                                        {barang.nama ??
                                          "-"}
                                      </p>
                                    </td>

                                    <td className="px-4 py-3 text-center">
                                      <span className="text-gray-600">
                                        {barang.satuan ??
                                          "-"}
                                      </span>
                                    </td>

                                    <td className="px-4 py-3 text-right">
                                      <span className="font-semibold text-[#35564C]">
                                        {formatNumber(
                                          barang.qty
                                        )}
                                      </span>
                                    </td>

                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                      Rp{" "}
                                      {formatNumber(
                                        barang.harga
                                      )}
                                    </td>

                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                      <span className="font-semibold text-[#497F70]">
                                        Rp{" "}
                                        {formatNumber(
                                          barang.subtotal
                                        )}
                                      </span>
                                    </td>
                                  </tr>
                                )
                              )
                            )}
                          </tbody>
                        </table>
                      </div>

                      {item.items &&
                        item.items.length >
                          0 && (
                          <div
                            className="
                              flex
                              flex-col
                              gap-2
                              border-t
                              border-[#E5ECE9]
                              bg-[#F8FAF9]
                              px-4
                              py-3
                              text-sm
                              sm:flex-row
                              sm:items-center
                              sm:justify-between
                            "
                          >
                            <span className="text-gray-500">
                              Total{" "}
                              {
                                item.items
                                  .length
                              }{" "}
                              jenis barang
                            </span>

                            <span className="font-semibold text-[#35564C]">
                              Total PO:{" "}
                              <span className="text-[#497F70]">
                                Rp{" "}
                                {formatNumber(
                                  item.total
                                )}
                              </span>
                            </span>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              )
            )
          )}
        </div>

        {/* FOOTER */}

        <div
          className="
            border-t
            border-[#E5ECE9]
            bg-[#F5F8F6]
            px-5
            py-4
            md:px-6
          "
        >
          <div
            className="
              flex
              flex-col
              gap-2
              text-sm
              md:flex-row
              md:items-center
              md:justify-between
            "
          >
            <div className="text-gray-500">
              Menampilkan{" "}
              <span className="font-semibold text-[#35564C]">
                {formatNumber(
                  filteredData.length
                )}
              </span>{" "}
              purchase
            </div>

            <div className="font-semibold text-[#35564C]">
              Total Purchase:{" "}
              <span className="text-[#497F70]">
                Rp{" "}
                {formatNumber(
                  totalPurchase
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}