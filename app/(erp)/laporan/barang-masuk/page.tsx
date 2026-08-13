"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  RefreshCw,
  Search,
  CalendarDays,
  RotateCcw,
  FileText,
  FileSpreadsheet,
  Printer,
  PackageCheck,
  Boxes,
  Wallet,
} from "lucide-react";

import { exportReportPDF } from "@/lib/exportReportPdf";
import { exportReportExcel } from "@/lib/exportReportExcel";
import { printTable } from "@/lib/print";

type BarangMasukItem = {
  barang?: {
    name?: string;
    code?: string;
  };
  qty?: number;
  price?: number;
  subtotal?: number;
};

type Receipt = {
  id: number;
  number: string;
  receiptDate: string;
  supplier?: {
    name?: string;
  };
  items?: BarangMasukItem[];
};

type ReportRow = {
  noReceive: string;
  tanggal: string;
  supplier: string;
  kodeBarang: string;
  barang: string;
  qty: number;
  harga: number;
  total: number;
};

export default function LaporanBarangMasuk() {
  const [data, setData] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch("/api/laporan/barang-masuk", {
        cache: "no-store",
      });

      const result = await res.json();

      if (result.success) {
        setData(result.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error(
        "Gagal mengambil laporan barang masuk:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // FLATTEN DATA
  // =====================================================

  const rowsData = useMemo<ReportRow[]>(() => {
    const result: ReportRow[] = [];

    data.forEach((receipt) => {
      receipt.items?.forEach((item) => {
        const date = new Date(receipt.receiptDate);

        const tanggalISO =
          date.toISOString().split("T")[0];

        result.push({
          noReceive: receipt.number,
          tanggal: tanggalISO,
          supplier:
            receipt.supplier?.name ?? "-",
          kodeBarang:
            item.barang?.code ?? "-",
          barang:
            item.barang?.name ?? "-",
          qty: Number(item.qty ?? 0),
          harga: Number(item.price ?? 0),
          total: Number(item.subtotal ?? 0),
        });
      });
    });

    return result;
  }, [data]);

  // =====================================================
  // FILTER
  // =====================================================

  const filteredRows = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    return rowsData.filter((row) => {
      const cocokSearch =
        !keyword ||
        row.noReceive
          .toLowerCase()
          .includes(keyword) ||
        row.supplier
          .toLowerCase()
          .includes(keyword) ||
        row.kodeBarang
          .toLowerCase()
          .includes(keyword) ||
        row.barang
          .toLowerCase()
          .includes(keyword);

      const cocokStart =
        !startDate ||
        row.tanggal >= startDate;

      const cocokEnd =
        !endDate ||
        row.tanggal <= endDate;

      return (
        cocokSearch &&
        cocokStart &&
        cocokEnd
      );
    });
  }, [
    rowsData,
    search,
    startDate,
    endDate,
  ]);

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalTransaksi = useMemo(() => {
    return new Set(
      filteredRows.map(
        (row) => row.noReceive
      )
    ).size;
  }, [filteredRows]);

  const totalQty = useMemo(() => {
    return filteredRows.reduce(
      (sum, row) => sum + row.qty,
      0
    );
  }, [filteredRows]);

  const totalNilai = useMemo(() => {
    return filteredRows.reduce(
      (sum, row) => sum + row.total,
      0
    );
  }, [filteredRows]);

  const totalJenisBarang = useMemo(() => {
    return new Set(
      filteredRows.map(
        (row) => row.kodeBarang
      )
    ).size;
  }, [filteredRows]);

  // =====================================================
  // FORMAT
  // =====================================================

  function formatRupiah(value: number) {
    return (
      "Rp " +
      Number(value || 0).toLocaleString(
        "id-ID"
      )
    );
  }

  function formatTanggal(value: string) {
    if (!value) return "-";

    return new Date(
      value
    ).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  // =====================================================
  // EXPORT
  // =====================================================

  const exportColumns = [
    "No Receive",
    "Tanggal",
    "Supplier",
    "Kode Barang",
    "Barang",
    "Qty",
    "Harga",
    "Total",
  ];

  const exportRows = filteredRows.map(
    (row) => [
      row.noReceive,
      formatTanggal(row.tanggal),
      row.supplier,
      row.kodeBarang,
      row.barang,
      row.qty,
      formatRupiah(row.harga),
      formatRupiah(row.total),
    ]
  );

  function handleExportPDF() {
    if (filteredRows.length === 0) return;

    exportReportPDF(
      "Laporan Barang Masuk",
      exportColumns,
      exportRows
    );
  }

  function handleExportExcel() {
    if (filteredRows.length === 0) return;

    exportReportExcel(
      "Laporan Barang Masuk",
      exportColumns,
      exportRows
    );
  }

  function handlePrint() {
    if (filteredRows.length === 0) return;

    printTable(
      exportColumns,
      exportRows
    );
  }

  function resetFilter() {
    setSearch("");
    setStartDate("");
    setEndDate("");
  }

  const hasFilter =
    search !== "" ||
    startDate !== "" ||
    endDate !== "";

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="min-h-full bg-[#F8FBF9] p-4 md:p-6 lg:p-8">

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
              bg-[#EAF3EF]
              text-[#497F70]
              shadow-sm
            "
          >
            <ClipboardList size={23} />
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
              Laporan Barang Masuk
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Riwayat penerimaan barang dari supplier
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

      {/* ================================================= */}
      {/* SUMMARY */}
      {/* ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* TRANSAKSI */}

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

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Total Transaksi
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {totalTransaksi.toLocaleString(
                  "id-ID"
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Nomor penerimaan
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
              <PackageCheck size={21} />
            </div>

          </div>

        </div>

        {/* QTY */}

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

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Total Qty Masuk
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {totalQty.toLocaleString(
                  "id-ID"
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Seluruh barang diterima
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
              <Boxes size={21} />
            </div>

          </div>

        </div>

        {/* JENIS BARANG */}

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

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Jenis Barang
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {totalJenisBarang.toLocaleString(
                  "id-ID"
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Barang yang diterima
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
              "
            >
              <ClipboardList size={21} />
            </div>

          </div>

        </div>

        {/* NILAI */}

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

          <div className="flex items-center justify-between">

            <div className="min-w-0">

              <p className="text-sm text-gray-500">
                Total Nilai Barang
              </p>

              <p className="mt-1 truncate text-xl font-bold text-[#18352D]">
                {formatRupiah(totalNilai)}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Berdasarkan harga penerimaan
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
                bg-emerald-50
                text-emerald-600
              "
            >
              <Wallet size={21} />
            </div>

          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* FILTER */}
      {/* ================================================= */}

      <div
        className="
          mb-6
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-white
          shadow-sm
        "
      >

        {/* FILTER HEADER */}

        <div
          className="
            border-b
            border-[#E5ECE9]
            px-5
            py-4
            md:px-6
          "
        >

          <div className="flex items-center gap-3">

            <div
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                bg-[#EAF3EF]
                text-[#497F70]
              "
            >
              <Search size={19} />
            </div>

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Filter Laporan
              </h2>

              <p className="mt-0.5 text-xs text-gray-500">
                Cari data atau batasi laporan berdasarkan tanggal
              </p>

            </div>

          </div>

        </div>

        {/* FILTER BODY */}

        <div className="p-5 md:p-6">

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">

            {/* SEARCH */}

            <div className="lg:col-span-2">

              <label className="mb-1.5 block text-sm font-medium text-[#35564C]">
                Pencarian
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
                    setSearch(e.target.value)
                  }
                  placeholder="Cari nomor receive, supplier, kode atau nama barang..."
                  className="
                    w-full
                    rounded-xl
                    border
                    border-[#DDE9E4]
                    bg-[#FAFCFB]
                    py-3
                    pl-10
                    pr-4
                    text-sm
                    text-gray-700
                    outline-none
                    transition
                    placeholder:text-gray-400
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-2
                    focus:ring-[#EAF3EF]
                  "
                />

              </div>

            </div>

            {/* START */}

            <div>

              <label className="mb-1.5 block text-sm font-medium text-[#35564C]">
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
                  value={startDate}
                  onChange={(e) =>
                    setStartDate(
                      e.target.value
                    )
                  }
                  className="
                    w-full
                    rounded-xl
                    border
                    border-[#DDE9E4]
                    bg-[#FAFCFB]
                    px-4
                    py-3
                    pl-10
                    text-sm
                    text-gray-700
                    outline-none
                    transition
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-2
                    focus:ring-[#EAF3EF]
                  "
                />

              </div>

            </div>

            {/* END */}

            <div>

              <label className="mb-1.5 block text-sm font-medium text-[#35564C]">
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
                  value={endDate}
                  onChange={(e) =>
                    setEndDate(
                      e.target.value
                    )
                  }
                  className="
                    w-full
                    rounded-xl
                    border
                    border-[#DDE9E4]
                    bg-[#FAFCFB]
                    px-4
                    py-3
                    pl-10
                    text-sm
                    text-gray-700
                    outline-none
                    transition
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-2
                    focus:ring-[#EAF3EF]
                  "
                />

              </div>

            </div>

          </div>

          {/* RESET */}

          {hasFilter && (
            <div className="mt-4">

              <button
                type="button"
                onClick={resetFilter}
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-xl
                  border
                  border-[#DDE9E4]
                  bg-white
                  px-4
                  py-2.5
                  text-sm
                  font-medium
                  text-[#497F70]
                  transition
                  hover:bg-[#F5F8F6]
                "
              >
                <RotateCcw size={16} />
                Reset Filter
              </button>

            </div>
          )}

        </div>

      </div>

      {/* ================================================= */}
      {/* ACTION BAR */}
      {/* ================================================= */}

      <div
        className="
          mb-4
          flex
          flex-col
          gap-3
          md:flex-row
          md:items-center
          md:justify-between
        "
      >

        <div>

          <p className="text-sm text-gray-500">
            Menampilkan{" "}
            <span className="font-semibold text-[#18352D]">
              {filteredRows.length}
            </span>{" "}
            baris data
          </p>

        </div>

        <div className="flex flex-wrap gap-2">

          {/* PDF */}

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={
              filteredRows.length === 0
            }
            className="
              inline-flex
              items-center
              gap-2
              rounded-xl
              bg-red-600
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-sm
              transition
              hover:bg-red-700
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            <FileText size={17} />
            PDF
          </button>

          {/* EXCEL */}

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={
              filteredRows.length === 0
            }
            className="
              inline-flex
              items-center
              gap-2
              rounded-xl
              bg-emerald-600
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-sm
              transition
              hover:bg-emerald-700
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            <FileSpreadsheet size={17} />
            Excel
          </button>

          {/* PRINT */}

          <button
            type="button"
            onClick={handlePrint}
            disabled={
              filteredRows.length === 0
            }
            className="
              inline-flex
              items-center
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
            <Printer size={17} />
            Print
          </button>

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

        {/* TABLE HEADER */}

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

          <div className="flex items-center gap-3">

            <div
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                bg-[#EAF3EF]
                text-[#497F70]
              "
            >
              <PackageCheck size={19} />
            </div>

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Data Barang Masuk
              </h2>

              <p className="mt-0.5 text-xs text-gray-500">
                Riwayat penerimaan barang dari supplier
              </p>

            </div>

          </div>

          <div
            className="
              inline-flex
              w-fit
              items-center
              rounded-full
              bg-[#EAF3EF]
              px-3
              py-1
              text-xs
              font-semibold
              text-[#497F70]
            "
          >
            {filteredRows.length} Data
          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1050px] text-sm">

            <thead>

              <tr className="border-b border-[#E5ECE9] bg-[#F5F8F6]">

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5F766D]">
                  No Receive
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5F766D]">
                  Tanggal
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5F766D]">
                  Supplier
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5F766D]">
                  Kode
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5F766D]">
                  Barang
                </th>

                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5F766D]">
                  Qty
                </th>

                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5F766D]">
                  Harga
                </th>

                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5F766D]">
                  Total
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan={8}
                    className="px-5 py-14 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <RefreshCw
                        size={25}
                        className="animate-spin text-[#497F70]"
                      />

                      <p className="mt-3 text-sm text-gray-500">
                        Memuat laporan barang masuk...
                      </p>

                    </div>

                  </td>

                </tr>

              ) : filteredRows.length === 0 ? (

                <tr>

                  <td
                    colSpan={8}
                    className="px-5 py-14 text-center"
                  >

                    <div className="mx-auto flex max-w-md flex-col items-center">

                      <div
                        className="
                          flex
                          h-14
                          w-14
                          items-center
                          justify-center
                          rounded-2xl
                          bg-[#EAF3EF]
                          text-[#8AA89E]
                        "
                      >
                        <ClipboardList size={27} />
                      </div>

                      <h3 className="mt-4 font-semibold text-[#35564C]">
                        Tidak ada data
                      </h3>

                      <p className="mt-1 text-sm text-gray-400">
                        Tidak ditemukan data barang masuk sesuai filter.
                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                filteredRows.map(
                  (row, index) => (

                    <tr
                      key={`${row.noReceive}-${row.kodeBarang}-${index}`}
                      className="
                        border-b
                        border-[#EEF2F0]
                        transition
                        hover:bg-[#FAFCFB]
                      "
                    >

                      {/* NO RECEIVE */}

                      <td className="px-5 py-4">

                        <span className="font-semibold text-[#18352D]">
                          {row.noReceive}
                        </span>

                      </td>

                      {/* TANGGAL */}

                      <td className="px-5 py-4 text-gray-600">

                        <div className="flex items-center gap-2">

                          <CalendarDays
                            size={15}
                            className="text-gray-400"
                          />

                          {formatTanggal(
                            row.tanggal
                          )}

                        </div>

                      </td>

                      {/* SUPPLIER */}

                      <td className="px-5 py-4">

                        <span className="font-medium text-gray-700">
                          {row.supplier}
                        </span>

                      </td>

                      {/* KODE */}

                      <td className="px-5 py-4">

                        <span
                          className="
                            rounded-lg
                            bg-gray-100
                            px-2.5
                            py-1
                            text-xs
                            font-medium
                            text-gray-600
                          "
                        >
                          {row.kodeBarang}
                        </span>

                      </td>

                      {/* BARANG */}

                      <td className="px-5 py-4">

                        <span className="font-medium text-[#18352D]">
                          {row.barang}
                        </span>

                      </td>

                      {/* QTY */}

                      <td className="px-5 py-4 text-right">

                        <span className="font-semibold text-gray-700">
                          {row.qty.toLocaleString(
                            "id-ID"
                          )}
                        </span>

                      </td>

                      {/* HARGA */}

                      <td className="px-5 py-4 text-right text-gray-600">

                        {formatRupiah(
                          row.harga
                        )}

                      </td>

                      {/* TOTAL */}

                      <td className="px-5 py-4 text-right">

                        <span className="font-semibold text-[#18352D]">
                          {formatRupiah(
                            row.total
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

        {/* FOOTER */}

        {!loading &&
          filteredRows.length > 0 && (
            <div
              className="
                flex
                flex-col
                justify-between
                gap-2
                border-t
                border-[#E5ECE9]
                bg-[#F5F8F6]
                px-5
                py-4
                text-sm
                md:flex-row
                md:items-center
                md:px-6
              "
            >

              <div className="text-gray-500">

                Menampilkan{" "}

                <span className="font-semibold text-[#18352D]">
                  {filteredRows.length}
                </span>{" "}

                baris laporan

              </div>

              <div className="flex items-center gap-2 font-medium text-[#35564C]">

                <PackageCheck
                  size={15}
                  className="text-[#497F70]"
                />

                Laporan Barang Masuk

              </div>

            </div>
          )}

      </div>

    </div>
  );
}