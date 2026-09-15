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
  Receipt,
  Hash,
  Building2,
  ChevronRight,
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

  /**
   * Nomor invoice dari supplier.
   *
   * Pastikan API /api/laporan/barang-masuk
   * mengembalikan field ini.
   */
  invoiceNumber?: string | null;

  supplier?: {
    name?: string;
  };

  items?: BarangMasukItem[];
};

type ReportRow = {
  noReceive: string;
  invoiceSupplier: string;
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
      console.error("Gagal mengambil laporan barang masuk:", error);
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

        const tanggalISO = date.toISOString().split("T")[0];

        result.push({
          noReceive: receipt.number,

          invoiceSupplier:
            receipt.invoiceNumber?.trim() || "-",

          tanggal: tanggalISO,

          supplier:
            receipt.supplier?.name?.trim() || "-",

          kodeBarang:
            item.barang?.code?.trim() || "-",

          barang:
            item.barang?.name?.trim() || "-",

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
    const keyword = search.trim().toLowerCase();

    return rowsData.filter((row) => {
      const cocokSearch =
        !keyword ||
        row.noReceive.toLowerCase().includes(keyword) ||
        row.invoiceSupplier.toLowerCase().includes(keyword) ||
        row.supplier.toLowerCase().includes(keyword) ||
        row.kodeBarang.toLowerCase().includes(keyword) ||
        row.barang.toLowerCase().includes(keyword);

      const cocokStart =
        !startDate || row.tanggal >= startDate;

      const cocokEnd =
        !endDate || row.tanggal <= endDate;

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
      filteredRows.map((row) => row.noReceive)
    ).size;
  }, [filteredRows]);

  const totalInvoice = useMemo(() => {
    return new Set(
      filteredRows
        .map((row) => row.invoiceSupplier)
        .filter(
          (invoice) =>
            invoice &&
            invoice !== "-"
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

    return new Date(value).toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  function formatTanggalLong(value: string) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    );
  }

  // =====================================================
  // EXPORT
  // =====================================================

  const exportColumns = [
    "No Receive",
    "Invoice Supplier",
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
      row.invoiceSupplier,
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
    <div className="min-h-full bg-[#F6F9F7] p-4 md:p-6 lg:p-8">

      {/* ================================================= */}
      {/* HERO HEADER */}
      {/* ================================================= */}

      <div className="mb-7 overflow-hidden rounded-3xl border border-[#DCE8E3] bg-white shadow-sm">

        <div className="relative overflow-hidden bg-gradient-to-br from-[#173A31] via-[#214C40] to-[#315F52] px-6 py-7 md:px-8">

          {/* decorative */}
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-28 right-20 h-72 w-72 rounded-full bg-white/[0.035]" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

            <div className="flex items-center gap-4">

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white shadow-inner">
                <ClipboardList size={27} />
              </div>

              <div>

                <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-100/70">
                  <span>Inventory</span>
                  <ChevronRight size={13} />
                  <span>Receiving</span>
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                  Laporan Barang Masuk
                </h1>

                <p className="mt-1 text-sm text-emerald-50/70">
                  Monitoring penerimaan barang dari supplier
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
                border-white/15
                bg-white/10
                px-4
                py-2.5
                text-sm
                font-semibold
                text-white
                backdrop-blur
                transition
                hover:bg-white/15
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

              Refresh Data
            </button>

          </div>

        </div>

        {/* HERO META */}

        <div className="grid grid-cols-1 divide-y divide-[#E7EEEB] md:grid-cols-3 md:divide-x md:divide-y-0">

          <div className="flex items-center gap-3 px-6 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF5F2] text-[#497F70]">
              <Receipt size={17} />
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Invoice Supplier
              </p>

              <p className="text-sm font-semibold text-[#18352D]">
                {totalInvoice.toLocaleString("id-ID")} Invoice
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-6 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF5F2] text-[#497F70]">
              <Building2 size={17} />
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Supplier
              </p>

              <p className="text-sm font-semibold text-[#18352D]">
                {new Set(
                  filteredRows.map(
                    (row) => row.supplier
                  )
                ).size.toLocaleString("id-ID")}{" "}
                Supplier
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-6 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF5F2] text-[#497F70]">
              <CalendarDays size={17} />
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Periode
              </p>

              <p className="text-sm font-semibold text-[#18352D]">
                {startDate || endDate
                  ? `${startDate || "..."} — ${endDate || "..."}`
                  : "Semua tanggal"}
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* SUMMARY */}
      {/* ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* TRANSAKSI */}

        <SummaryCard
          label="Total Transaksi"
          value={totalTransaksi.toLocaleString("id-ID")}
          description="Nomor penerimaan"
          icon={<PackageCheck size={21} />}
          iconClass="bg-[#EAF3EF] text-[#497F70]"
        />

        {/* QTY */}

        <SummaryCard
          label="Total Qty Masuk"
          value={totalQty.toLocaleString("id-ID")}
          description="Seluruh barang diterima"
          icon={<Boxes size={21} />}
          iconClass="bg-blue-50 text-blue-600"
        />

        {/* JENIS */}

        <SummaryCard
          label="Jenis Barang"
          value={totalJenisBarang.toLocaleString("id-ID")}
          description="Barang yang diterima"
          icon={<ClipboardList size={21} />}
          iconClass="bg-amber-50 text-amber-600"
        />

        {/* NILAI */}

        <SummaryCard
          label="Total Nilai"
          value={formatRupiah(totalNilai)}
          description="Berdasarkan harga penerimaan"
          icon={<Wallet size={21} />}
          iconClass="bg-emerald-50 text-emerald-600"
          valueClass="text-lg"
        />

      </div>

      {/* ================================================= */}
      {/* FILTER */}
      {/* ================================================= */}

      <div className="mb-6 overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        <div className="border-b border-[#E5ECE9] bg-gradient-to-r from-white to-[#F8FBF9] px-5 py-4 md:px-6">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Search size={19} />
            </div>

            <div>
              <h2 className="font-semibold text-[#18352D]">
                Filter Laporan
              </h2>

              <p className="mt-0.5 text-xs text-gray-500">
                Cari berdasarkan invoice, supplier, penerimaan atau barang
              </p>
            </div>

          </div>

        </div>

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
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Invoice supplier, no receive, supplier, kode atau nama barang..."
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
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
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
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
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

          {/* FILTER STATUS */}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">

            <div className="flex flex-wrap gap-2">

              {search && (
                <FilterBadge>
                  Search: {search}
                </FilterBadge>
              )}

              {startDate && (
                <FilterBadge>
                  Dari: {formatTanggalLong(startDate)}
                </FilterBadge>
              )}

              {endDate && (
                <FilterBadge>
                  Sampai: {formatTanggalLong(endDate)}
                </FilterBadge>
              )}

            </div>

            {hasFilter && (
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
            )}

          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* ACTION BAR */}
      {/* ================================================= */}

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

        <div>

          <p className="text-sm text-gray-500">
            Menampilkan{" "}
            <span className="font-semibold text-[#18352D]">
              {filteredRows.length.toLocaleString("id-ID")}
            </span>{" "}
            baris data
          </p>

          {filteredRows.length > 0 && (
            <p className="mt-0.5 text-xs text-gray-400">
              {totalInvoice.toLocaleString("id-ID")} invoice supplier terkait
            </p>
          )}

        </div>

        <div className="flex flex-wrap gap-2">

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={filteredRows.length === 0}
            className="
              inline-flex
              items-center
              gap-2
              rounded-xl
              bg-[#B42318]
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-sm
              transition
              hover:bg-[#981B12]
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            <FileText size={17} />
            Export PDF
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredRows.length === 0}
            className="
              inline-flex
              items-center
              gap-2
              rounded-xl
              bg-[#18794E]
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-sm
              transition
              hover:bg-[#12603D]
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            <FileSpreadsheet size={17} />
            Export Excel
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={filteredRows.length === 0}
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

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        {/* TABLE HEADER */}

        <div className="flex flex-col gap-3 border-b border-[#E5ECE9] bg-gradient-to-r from-white to-[#F8FBF9] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <PackageCheck size={19} />
            </div>

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Data Barang Masuk
              </h2>

              <p className="mt-0.5 text-xs text-gray-500">
                Detail penerimaan dan invoice supplier
              </p>

            </div>

          </div>

          <div className="flex flex-wrap items-center gap-2">

            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF3EF] px-3 py-1 text-xs font-semibold text-[#497F70]">
              <PackageCheck size={13} />
              {filteredRows.length} Data
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F2F4F3] px-3 py-1 text-xs font-semibold text-gray-600">
              <Receipt size={13} />
              {totalInvoice} Invoice
            </div>

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1250px] text-sm">

            <thead>

              <tr className="border-b border-[#E1E9E5] bg-[#F4F7F5]">

                <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#5F766D]">
                  No Receive
                </th>

                <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#5F766D]">
                  Invoice Supplier
                </th>

                <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#5F766D]">
                  Tanggal
                </th>

                <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#5F766D]">
                  Supplier
                </th>

                <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#5F766D]">
                  Kode
                </th>

                <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#5F766D]">
                  Barang
                </th>

                <th className="whitespace-nowrap px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-[#5F766D]">
                  Qty
                </th>

                <th className="whitespace-nowrap px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-[#5F766D]">
                  Harga
                </th>

                <th className="whitespace-nowrap px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-[#5F766D]">
                  Total
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan={9}
                    className="px-5 py-16 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3EF]">
                        <RefreshCw
                          size={24}
                          className="animate-spin text-[#497F70]"
                        />
                      </div>

                      <p className="mt-3 text-sm font-medium text-gray-500">
                        Memuat laporan barang masuk...
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Mohon tunggu sebentar
                      </p>

                    </div>

                  </td>

                </tr>

              ) : filteredRows.length === 0 ? (

                <tr>

                  <td
                    colSpan={9}
                    className="px-5 py-16 text-center"
                  >

                    <div className="mx-auto flex max-w-md flex-col items-center">

                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#8AA89E]">
                        <ClipboardList size={29} />
                      </div>

                      <h3 className="mt-4 font-semibold text-[#35564C]">
                        Tidak ada data
                      </h3>

                      <p className="mt-1 text-sm text-gray-400">
                        Tidak ditemukan data barang masuk sesuai filter.
                      </p>

                      {hasFilter && (
                        <button
                          type="button"
                          onClick={resetFilter}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#DDE9E4] px-4 py-2 text-sm font-medium text-[#497F70] hover:bg-[#F5F8F6]"
                        >
                          <RotateCcw size={15} />
                          Reset Filter
                        </button>
                      )}

                    </div>

                  </td>

                </tr>

              ) : (

                filteredRows.map(
                  (row, index) => (

                    <tr
                      key={`${row.noReceive}-${row.invoiceSupplier}-${row.kodeBarang}-${index}`}
                      className="
                        border-b
                        border-[#EEF2F0]
                        transition
                        hover:bg-[#FAFCFB]
                      "
                    >

                      {/* NO RECEIVE */}

                      <td className="px-5 py-4">

                        <div className="flex items-center gap-2">

                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F1F5F3] text-[#71857E]">
                            <Hash size={14} />
                          </div>

                          <span className="font-semibold text-[#18352D]">
                            {row.noReceive}
                          </span>

                        </div>

                      </td>

                      {/* INVOICE SUPPLIER */}

                      <td className="px-5 py-4">

                        {row.invoiceSupplier !== "-" ? (

                          <div className="inline-flex max-w-[190px] items-center gap-2 rounded-xl border border-[#D9E8E2] bg-[#F1F8F5] px-3 py-2">

                            <Receipt
                              size={15}
                              className="shrink-0 text-[#497F70]"
                            />

                            <span
                              className="truncate font-semibold text-[#285548]"
                              title={row.invoiceSupplier}
                            >
                              {row.invoiceSupplier}
                            </span>

                          </div>

                        ) : (

                          <span className="text-xs italic text-gray-400">
                            Tidak ada invoice
                          </span>

                        )}

                      </td>

                      {/* TANGGAL */}

                      <td className="px-5 py-4 text-gray-600">

                        <div className="flex items-center gap-2 whitespace-nowrap">

                          <CalendarDays
                            size={15}
                            className="text-gray-400"
                          />

                          {formatTanggal(row.tanggal)}

                        </div>

                      </td>

                      {/* SUPPLIER */}

                      <td className="px-5 py-4">

                        <div className="flex items-center gap-2">

                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                            <Building2 size={14} />
                          </div>

                          <span
                            className="max-w-[180px] truncate font-medium text-gray-700"
                            title={row.supplier}
                          >
                            {row.supplier}
                          </span>

                        </div>

                      </td>

                      {/* KODE */}

                      <td className="px-5 py-4">

                        <span className="inline-flex rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-600">
                          {row.kodeBarang}
                        </span>

                      </td>

                      {/* BARANG */}

                      <td className="px-5 py-4">

                        <span
                          className="block max-w-[230px] truncate font-medium text-[#18352D]"
                          title={row.barang}
                        >
                          {row.barang}
                        </span>

                      </td>

                      {/* QTY */}

                      <td className="px-5 py-4 text-right">

                        <span className="font-semibold text-gray-700">
                          {row.qty.toLocaleString("id-ID")}
                        </span>

                      </td>

                      {/* HARGA */}

                      <td className="whitespace-nowrap px-5 py-4 text-right text-gray-600">

                        {formatRupiah(row.harga)}

                      </td>

                      {/* TOTAL */}

                      <td className="whitespace-nowrap px-5 py-4 text-right">

                        <span className="font-bold text-[#18352D]">
                          {formatRupiah(row.total)}
                        </span>

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

        {/* TABLE FOOTER */}

        {!loading &&
          filteredRows.length > 0 && (
            <div className="flex flex-col justify-between gap-3 border-t border-[#E5ECE9] bg-[#F5F8F6] px-5 py-4 md:flex-row md:items-center md:px-6">

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">

                <span>
                  <strong className="text-[#18352D]">
                    {filteredRows.length.toLocaleString("id-ID")}
                  </strong>{" "}
                  baris
                </span>

                <span>
                  <strong className="text-[#18352D]">
                    {totalInvoice.toLocaleString("id-ID")}
                  </strong>{" "}
                  invoice
                </span>

                <span>
                  <strong className="text-[#18352D]">
                    {totalQty.toLocaleString("id-ID")}
                  </strong>{" "}
                  qty
                </span>

              </div>

              <div className="flex items-center gap-2 font-medium text-[#35564C]">

                <PackageCheck
                  size={15}
                  className="text-[#497F70]"
                />

                Laporan Barang Masuk Supplier

              </div>

            </div>
          )}

      </div>

    </div>
  );
}

// =====================================================
// COMPONENTS
// =====================================================

function SummaryCard({
  label,
  value,
  description,
  icon,
  iconClass,
  valueClass = "text-2xl",
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  iconClass: string;
  valueClass?: string;
}) {
  return (
    <div className="group rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">

      <div className="flex items-start justify-between gap-4">

        <div className="min-w-0">

          <p className="text-sm font-medium text-gray-500">
            {label}
          </p>

          <p
            className={`mt-1 truncate font-bold tracking-tight text-[#18352D] ${valueClass}`}
          >
            {value}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            {description}
          </p>

        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          {icon}
        </div>

      </div>

    </div>
  );
}

function FilterBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex max-w-full items-center rounded-lg bg-[#EEF5F2] px-2.5 py-1.5 text-xs font-medium text-[#497F70]">
      <span className="truncate">
        {children}
      </span>
    </span>
  );
}