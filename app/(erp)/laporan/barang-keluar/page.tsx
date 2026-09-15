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
  Truck,
  ChevronRight,
  Building2,
  ChevronDown,
} from "lucide-react";

import { exportReportPdf } from "@/lib/exportReportPdf";
import { exportReportExcel } from "@/lib/exportReportExcel";
import { printTable } from "@/lib/print";

// =====================================================
// TYPES
// =====================================================

type Customer = {
  id: number;
  code?: string;
  name?: string;
};

type DeliveryItem = {
  id: number;
  barangId?: number;
  code?: string;
  name?: string;
  unit?: string;
  qty?: number;
  price?: number;
  subtotal?: number;
};

type Delivery = {
  id: number;
  number?: string;
  deliveryDate: string;

  customer?: {
    id?: number | null;
    name?: string;
  };

  items?: DeliveryItem[];
};

type ReportRow = {
  no: number;
  noDelivery: string;
  tanggal: string;
  customer: string;
  customerId?: number | null;
  kodeBarang: string;
  barang: string;
  qty: number;
  harga: number;
  subtotal: number;
};

// =====================================================
// PAGE
// =====================================================

export default function LaporanBarangKeluar() {
  const [data, setData] = useState<Delivery[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingCustomer, setLoadingCustomer] =
    useState(true);

  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [customerId, setCustomerId] = useState("");

  // =====================================================
  // LOAD CUSTOMER
  // =====================================================

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    try {
      setLoadingCustomer(true);

      const res = await fetch("/api/customer", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status}`
        );
      }

      const result = await res.json();

      if (
        result.success &&
        Array.isArray(result.data)
      ) {
        setCustomers(result.data);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error(
        "Gagal mengambil data customer:",
        error
      );

      setCustomers([]);
    } finally {
      setLoadingCustomer(false);
    }
  }

  // =====================================================
  // LOAD DATA
  // =====================================================

  useEffect(() => {
    loadData();
  }, [
    customerId,
    startDate,
    endDate,
  ]);

  async function loadData() {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      // -------------------------------------------------
      // CUSTOMER
      // -------------------------------------------------

      if (customerId) {
        params.set(
          "customerId",
          customerId
        );
      }

      // -------------------------------------------------
      // DATE
      // -------------------------------------------------

      if (startDate) {
        params.set("start", startDate);
      }

      if (endDate) {
        params.set("end", endDate);
      }

      const query = params.toString();

      const url = query
        ? `/api/laporan/barang-keluar?${query}`
        : "/api/laporan/barang-keluar";

      const res = await fetch(url, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status}`
        );
      }

      const result = await res.json();

      if (result.success) {
        setData(
          Array.isArray(result.data)
            ? result.data
            : []
        );
      } else {
        setData([]);
      }
    } catch (error) {
      console.error(
        "Gagal mengambil laporan barang keluar:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // SELECTED CUSTOMER
  // =====================================================

  const selectedCustomer = useMemo(() => {
    if (!customerId) {
      return null;
    }

    return (
      customers.find(
        (customer) =>
          String(customer.id) ===
          customerId
      ) ?? null
    );
  }, [customers, customerId]);

  const selectedCustomerName =
    selectedCustomer
      ? `${
          selectedCustomer.code
            ? `${selectedCustomer.code} — `
            : ""
        }${selectedCustomer.name ?? ""}`
      : "Semua Customer";

  // =====================================================
  // FLATTEN DATA
  // =====================================================

  const rowsData = useMemo<ReportRow[]>(() => {
    const result: ReportRow[] = [];

    let nomor = 1;

    data.forEach((delivery) => {
      delivery.items?.forEach((item) => {
        const qty = Number(
          item.qty ?? 0
        );

        const harga = Number(
          item.price ?? 0
        );

        const subtotal = Number(
          item.subtotal ??
            qty * harga
        );

        const deliveryCustomerId =
          delivery.customer?.id ??
          null;

        const deliveryCustomerName =
          delivery.customer?.name?.trim() ||
          "-";

        result.push({
          no: nomor++,

          noDelivery:
            delivery.number ?? "-",

          tanggal:
            delivery.deliveryDate,

          customer:
            deliveryCustomerName,

          customerId:
            deliveryCustomerId,

          kodeBarang:
            item.code?.trim() || "-",

          barang:
            item.name?.trim() || "-",

          qty,

          harga,

          subtotal,
        });
      });
    });

    return result;
  }, [data]);

  // =====================================================
  // FRONTEND FILTER
  // =====================================================

  const filteredRows = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    return rowsData.filter((row) => {
      // -------------------------------------------------
      // SEARCH
      // -------------------------------------------------

      const cocokSearch =
        !keyword ||
        row.noDelivery
          .toLowerCase()
          .includes(keyword) ||
        row.customer
          .toLowerCase()
          .includes(keyword) ||
        row.kodeBarang
          .toLowerCase()
          .includes(keyword) ||
        row.barang
          .toLowerCase()
          .includes(keyword);

      // -------------------------------------------------
      // DATE
      // -------------------------------------------------

      const tanggal =
        row.tanggal?.slice(0, 10) ?? "";

      const cocokStart =
        !startDate ||
        tanggal >= startDate;

      const cocokEnd =
        !endDate ||
        tanggal <= endDate;

      // -------------------------------------------------
      // CUSTOMER SAFETY FILTER
      // -------------------------------------------------

      const cocokCustomer =
        !customerId ||
        String(
          row.customerId ?? ""
        ) === customerId;

      return (
        cocokSearch &&
        cocokStart &&
        cocokEnd &&
        cocokCustomer
      );
    });
  }, [
    rowsData,
    search,
    startDate,
    endDate,
    customerId,
  ]);

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalDelivery = useMemo(() => {
    return new Set(
      filteredRows.map(
        (row) => row.noDelivery
      )
    ).size;
  }, [filteredRows]);

  const totalCustomer = useMemo(() => {
    return new Set(
      filteredRows
        .map(
          (row) => row.customer
        )
        .filter(
          (customer) =>
            customer &&
            customer !== "-"
        )
    ).size;
  }, [filteredRows]);

  const totalQty = useMemo(() => {
    return filteredRows.reduce(
      (sum, row) =>
        sum +
        Number(row.qty ?? 0),
      0
    );
  }, [filteredRows]);

  const totalNilai = useMemo(() => {
    return filteredRows.reduce(
      (sum, row) =>
        sum +
        Number(
          row.subtotal ?? 0
        ),
      0
    );
  }, [filteredRows]);

  const totalJenisBarang = useMemo(() => {
    return new Set(
      filteredRows
        .map(
          (row) =>
            row.kodeBarang
        )
        .filter(
          (kode) =>
            kode &&
            kode !== "-"
        )
    ).size;
  }, [filteredRows]);

  // =====================================================
  // FORMAT
  // =====================================================

  function formatRupiah(value: number) {
    return (
      "Rp " +
      Number(
        value || 0
      ).toLocaleString("id-ID")
    );
  }

  function formatTanggal(
    value: string
  ) {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

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
        month: "short",
        year: "numeric",
      }
    );
  }

  function formatTanggalLong(
    value: string
  ) {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

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
        month: "long",
        year: "numeric",
      }
    );
  }

  // =====================================================
  // EXPORT
  // =====================================================

  const exportColumns = [
    "No",
    "No Delivery",
    "Tanggal",
    "Customer",
    "Kode Barang",
    "Barang",
    "Qty",
    "Harga",
    "Subtotal",
  ];

  const exportRows = filteredRows.map(
    (row) => [
      row.no,
      row.noDelivery,
      formatTanggal(
        row.tanggal
      ),
      row.customer,
      row.kodeBarang,
      row.barang,
      row.qty,
      formatRupiah(
        row.harga
      ),
      formatRupiah(
        row.subtotal
      ),
    ]
  );

  const periodText =
    startDate || endDate
      ? `${
          startDate
            ? formatTanggal(
                startDate
              )
            : "..."
        } — ${
          endDate
            ? formatTanggal(
                endDate
              )
            : "..."
        }`
      : "Semua tanggal";

  const exportTitle = useMemo(() => {
    return `Laporan Barang Keluar - ${selectedCustomerName} - ${periodText}`;
  }, [
    selectedCustomerName,
    periodText,
  ]);

  // =====================================================
  // PDF
  // =====================================================

  function handleExportPDF() {
    if (
      filteredRows.length === 0
    ) {
      return;
    }

    exportReportPdf(
      exportTitle,
      exportColumns,
      exportRows
    );
  }

  // =====================================================
  // EXCEL
  // =====================================================

  function handleExportExcel() {
    if (
      filteredRows.length === 0
    ) {
      return;
    }

    exportReportExcel(
      exportTitle,
      exportColumns,
      exportRows
    );
  }

  // =====================================================
  // PRINT
  // =====================================================

  function handlePrint() {
    if (
      filteredRows.length === 0
    ) {
      return;
    }

    printTable(
      exportColumns,
      exportRows
    );
  }

  // =====================================================
  // RESET
  // =====================================================

  function resetFilter() {
    setSearch("");
    setStartDate("");
    setEndDate("");
    setCustomerId("");
  }

  const hasFilter =
    search.trim() !== "" ||
    startDate !== "" ||
    endDate !== "" ||
    customerId !== "";

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="min-h-full bg-[#F6F9F7] p-4 md:p-6 lg:p-8">

      {/* ================================================= */}
      {/* HERO */}
      {/* ================================================= */}

      <div className="mb-7 overflow-hidden rounded-3xl border border-[#DCE8E3] bg-white shadow-sm">

        <div className="relative overflow-hidden bg-gradient-to-br from-[#173A31] via-[#214C40] to-[#315F52] px-6 py-7 md:px-8">

          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/5" />

          <div className="pointer-events-none absolute -bottom-28 right-20 h-72 w-72 rounded-full bg-white/[0.035]" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

            <div className="flex items-center gap-4">

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white shadow-inner">
                <span className="text-sm font-black tracking-widest">
                  MGB
                </span>
              </div>

              <div>

                <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-100/70">

                  <span>
                    Inventory
                  </span>

                  <ChevronRight
                    size={13}
                  />

                  <span>
                    Shipping
                  </span>

                </div>

                <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                  Laporan Barang Keluar
                </h1>

                <p className="mt-1 text-sm text-emerald-50/70">
                  Monitoring pengeluaran barang melalui Delivery Order
                </p>

              </div>

            </div>

            <button
              type="button"
              onClick={
                loadData
              }
              disabled={
                loading
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
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

        {/* ================================================= */}
        {/* HERO META */}
        {/* ================================================= */}

        <div className="grid grid-cols-1 divide-y divide-[#E7EEEB] md:grid-cols-4 md:divide-x md:divide-y-0">

          {/* DELIVERY */}

          <div className="flex items-center gap-3 px-6 py-4">

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF5F2] text-[#497F70]">
              <Truck size={17} />
            </div>

            <div>

              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Delivery
              </p>

              <p className="text-sm font-semibold text-[#18352D]">
                {totalDelivery.toLocaleString(
                  "id-ID"
                )}{" "}
                Delivery
              </p>

            </div>

          </div>

          {/* CUSTOMER */}

          <div className="flex items-center gap-3 px-6 py-4">

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF5F2] text-[#497F70]">
              <Building2 size={17} />
            </div>

            <div className="min-w-0">

              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Customer
              </p>

              <p
                className="truncate text-sm font-semibold text-[#18352D]"
                title={
                  selectedCustomerName
                }
              >
                {selectedCustomerName}
              </p>

            </div>

          </div>

          {/* TOTAL CUSTOMER */}

          <div className="flex items-center gap-3 px-6 py-4">

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF5F2] text-[#497F70]">
              <ClipboardList
                size={17}
              />
            </div>

            <div>

              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Customer Terdata
              </p>

              <p className="text-sm font-semibold text-[#18352D]">
                {totalCustomer.toLocaleString(
                  "id-ID"
                )}{" "}
                Customer
              </p>

            </div>

          </div>

          {/* PERIODE */}

          <div className="flex items-center gap-3 px-6 py-4">

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF5F2] text-[#497F70]">
              <CalendarDays
                size={17}
              />
            </div>

            <div>

              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Periode
              </p>

              <p className="text-sm font-semibold text-[#18352D]">
                {periodText}
              </p>

            </div>

          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* SUMMARY */}
      {/* ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <SummaryCard
          label="Total Delivery"
          value={totalDelivery.toLocaleString(
            "id-ID"
          )}
          description="Nomor pengiriman"
          icon={
            <Truck
              size={21}
            />
          }
          iconClass="bg-[#EAF3EF] text-[#497F70]"
        />

        <SummaryCard
          label="Total Qty Keluar"
          value={totalQty.toLocaleString(
            "id-ID"
          )}
          description="Seluruh barang keluar"
          icon={
            <Boxes
              size={21}
            />
          }
          iconClass="bg-blue-50 text-blue-600"
        />

        <SummaryCard
          label="Jenis Barang"
          value={totalJenisBarang.toLocaleString(
            "id-ID"
          )}
          description="Barang yang dikirim"
          icon={
            <ClipboardList
              size={21}
            />
          }
          iconClass="bg-amber-50 text-amber-600"
        />

        <SummaryCard
          label="Total Nilai"
          value={formatRupiah(
            totalNilai
          )}
          description="Berdasarkan harga barang"
          icon={
            <Wallet
              size={21}
            />
          }
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
              <Search
                size={19}
              />
            </div>

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Filter Laporan
              </h2>

              <p className="mt-0.5 text-xs text-gray-500">
                Filter customer, periode, atau barang
              </p>

            </div>

          </div>

        </div>

        <div className="p-5 md:p-6">

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">

            {/* CUSTOMER */}

            <div>

              <label
                htmlFor="barang-keluar-customer"
                className="mb-1.5 block text-sm font-medium text-[#35564C]"
              >
                Customer
              </label>

              <div className="relative">

                <Building2
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <select
                  id="barang-keluar-customer"
                  value={
                    customerId
                  }
                  onChange={(
                    e
                  ) =>
                    setCustomerId(
                      e.target.value
                    )
                  }
                  disabled={
                    loadingCustomer
                  }
                  className="w-full appearance-none rounded-xl border border-[#DDE9E4] bg-[#FAFCFB] py-3 pl-10 pr-10 text-sm text-gray-700 outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-2 focus:ring-[#EAF3EF] disabled:cursor-not-allowed disabled:opacity-60"
                >

                  <option value="">
                    Semua Customer
                  </option>

                  {customers.map(
                    (
                      customer
                    ) => (
                      <option
                        key={
                          customer.id
                        }
                        value={
                          customer.id
                        }
                      >
                        {customer.code
                          ? `${customer.code} — ${
                              customer.name ??
                              ""
                            }`
                          : customer.name ??
                            "-"}
                      </option>
                    )
                  )}

                </select>

                <ChevronDown
                  size={17}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

              </div>

            </div>

            {/* SEARCH */}

            <div className="lg:col-span-2">

              <label
                htmlFor="barang-keluar-search"
                className="mb-1.5 block text-sm font-medium text-[#35564C]"
              >
                Pencarian
              </label>

              <div className="relative">

                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  id="barang-keluar-search"
                  type="text"
                  value={
                    search
                  }
                  onChange={(
                    e
                  ) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="No Delivery, customer, kode atau nama barang..."
                  className="w-full rounded-xl border border-[#DDE9E4] bg-[#FAFCFB] py-3 pl-10 pr-4 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#497F70] focus:bg-white focus:ring-2 focus:ring-[#EAF3EF]"
                />

              </div>

            </div>

            {/* START */}

            <div>

              <label
                htmlFor="barang-keluar-start"
                className="mb-1.5 block text-sm font-medium text-[#35564C]"
              >
                Dari Tanggal
              </label>

              <div className="relative">

                <CalendarDays
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  id="barang-keluar-start"
                  type="date"
                  value={
                    startDate
                  }
                  onChange={(
                    e
                  ) =>
                    setStartDate(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[#DDE9E4] bg-[#FAFCFB] px-4 py-3 pl-10 text-sm text-gray-700 outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-2 focus:ring-[#EAF3EF]"
                />

              </div>

            </div>

            {/* END */}

            <div>

              <label
                htmlFor="barang-keluar-end"
                className="mb-1.5 block text-sm font-medium text-[#35564C]"
              >
                Sampai Tanggal
              </label>

              <div className="relative">

                <CalendarDays
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  id="barang-keluar-end"
                  type="date"
                  value={
                    endDate
                  }
                  onChange={(
                    e
                  ) =>
                    setEndDate(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[#DDE9E4] bg-[#FAFCFB] px-4 py-3 pl-10 text-sm text-gray-700 outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-2 focus:ring-[#EAF3EF]"
                />

              </div>

            </div>

          </div>

          {/* FILTER STATUS */}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">

            <div className="flex flex-wrap gap-2">

              {customerId && (
                <FilterBadge>
                  Customer:{" "}
                  {
                    selectedCustomerName
                  }
                </FilterBadge>
              )}

              {search && (
                <FilterBadge>
                  Search:{" "}
                  {search}
                </FilterBadge>
              )}

              {startDate && (
                <FilterBadge>
                  Dari:{" "}
                  {formatTanggalLong(
                    startDate
                  )}
                </FilterBadge>
              )}

              {endDate && (
                <FilterBadge>
                  Sampai:{" "}
                  {formatTanggalLong(
                    endDate
                  )}
                </FilterBadge>
              )}

            </div>

            {hasFilter && (
              <button
                type="button"
                onClick={
                  resetFilter
                }
                className="inline-flex items-center gap-2 rounded-xl border border-[#DDE9E4] bg-white px-4 py-2.5 text-sm font-medium text-[#497F70] transition hover:bg-[#F5F8F6]"
              >

                <RotateCcw
                  size={16}
                />

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
              {filteredRows.length.toLocaleString(
                "id-ID"
              )}
            </span>{" "}

            baris data

          </p>

          {filteredRows.length >
            0 && (
            <p className="mt-0.5 text-xs text-gray-400">
              {
                selectedCustomerName
              }{" "}
              •{" "}
              {totalDelivery.toLocaleString(
                "id-ID"
              )}{" "}
              delivery terkait
            </p>
          )}

        </div>

        <div className="flex flex-wrap gap-2">

          {/* PDF */}

          <button
            type="button"
            onClick={
              handleExportPDF
            }
            disabled={
              filteredRows.length ===
              0
            }
            className="inline-flex items-center gap-2 rounded-xl bg-[#B42318] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#981B12] disabled:cursor-not-allowed disabled:opacity-50"
          >

            <FileText
              size={17}
            />

            Export PDF

          </button>

          {/* EXCEL */}

          <button
            type="button"
            onClick={
              handleExportExcel
            }
            disabled={
              filteredRows.length ===
              0
            }
            className="inline-flex items-center gap-2 rounded-xl bg-[#18794E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#12603D] disabled:cursor-not-allowed disabled:opacity-50"
          >

            <FileSpreadsheet
              size={17}
            />

            Export Excel

          </button>

          {/* PRINT */}

          <button
            type="button"
            onClick={
              handlePrint
            }
            disabled={
              filteredRows.length ===
              0
            }
            className="inline-flex items-center gap-2 rounded-xl border border-[#DDE9E4] bg-white px-4 py-2.5 text-sm font-semibold text-[#35564C] shadow-sm transition hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-50"
          >

            <Printer
              size={17}
            />

            Print

          </button>

        </div>

      </div>

      {/* ================================================= */}
      {/* TABLE */}
      {/* ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        <div className="flex flex-col gap-3 border-b border-[#E5ECE9] bg-gradient-to-r from-white to-[#F8FBF9] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <PackageCheck
                size={19}
              />
            </div>

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Data Barang Keluar
              </h2>

              <p className="mt-0.5 text-xs text-gray-500">
                Detail pengeluaran berdasarkan Delivery Order
              </p>

            </div>

          </div>

          <div className="flex flex-wrap items-center gap-2">

            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF3EF] px-3 py-1 text-xs font-semibold text-[#497F70]">

              <PackageCheck
                size={13}
              />

              {filteredRows.length.toLocaleString(
                "id-ID"
              )}{" "}
              Data

            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F2F4F3] px-3 py-1 text-xs font-semibold text-gray-600">

              <Truck
                size={13}
              />

              {totalDelivery.toLocaleString(
                "id-ID"
              )}{" "}
              Delivery

            </div>

            <div className="inline-flex max-w-[260px] items-center gap-1.5 truncate rounded-full bg-[#EEF5F2] px-3 py-1 text-xs font-semibold text-[#497F70]">

              <Building2
                size={13}
              />

              <span className="truncate">
                {
                  selectedCustomerName
                }
              </span>

            </div>

          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1250px] text-sm">

            <thead>

              <tr className="border-b border-[#E1E9E5] bg-[#F4F7F5]">

                <th className="w-16 whitespace-nowrap px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-[#5F766D]">
                  No
                </th>

                <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#5F766D]">
                  Tanggal
                </th>

                <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#5F766D]">
                  No Delivery
                </th>

                <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#5F766D]">
                  Customer
                </th>

                <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#5F766D]">
                  Kode Barang
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

              {/* LOADING */}

              {loading && (
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
                        Memuat laporan barang keluar...
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Mohon tunggu sebentar
                      </p>

                    </div>

                  </td>

                </tr>
              )}

              {/* EMPTY */}

              {!loading &&
                filteredRows.length ===
                  0 && (
                  <tr>

                    <td
                      colSpan={9}
                      className="px-5 py-16 text-center"
                    >

                      <div className="mx-auto flex max-w-md flex-col items-center">

                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#8AA89E]">
                          <ClipboardList
                            size={29}
                          />
                        </div>

                        <h3 className="mt-4 font-semibold text-[#35564C]">
                          Tidak ada data barang keluar
                        </h3>

                        <p className="mt-1 text-sm text-gray-400">
                          Tidak ditemukan data barang keluar sesuai filter.
                        </p>

                        {hasFilter && (
                          <button
                            type="button"
                            onClick={
                              resetFilter
                            }
                            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#DDE9E4] px-4 py-2 text-sm font-medium text-[#497F70] transition hover:bg-[#F5F8F6]"
                          >

                            <RotateCcw
                              size={15}
                            />

                            Reset Filter

                          </button>
                        )}

                      </div>

                    </td>

                  </tr>
                )}

              {/* DATA */}

              {!loading &&
                filteredRows.length >
                  0 &&
                filteredRows.map(
                  (row) => (
                    <tr
                      key={`${row.noDelivery}-${row.kodeBarang}-${row.no}`}
                      className="border-b border-[#EEF2F0] transition hover:bg-[#FAFCFB]"
                    >

                      {/* NO */}

                      <td className="px-5 py-4 text-center">

                        <span className="font-medium text-gray-400">
                          {row.no}
                        </span>

                      </td>

                      {/* DATE */}

                      <td className="px-5 py-4 text-gray-600">

                        <div className="flex items-center gap-2 whitespace-nowrap">

                          <CalendarDays
                            size={15}
                            className="text-gray-400"
                          />

                          {formatTanggal(
                            row.tanggal
                          )}

                        </div>

                      </td>

                      {/* DELIVERY */}

                      <td className="px-5 py-4">

                        <div className="flex items-center gap-2">

                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                            <Truck
                              size={14}
                            />
                          </div>

                          <span className="font-semibold text-[#18352D]">
                            {
                              row.noDelivery
                            }
                          </span>

                        </div>

                      </td>

                      {/* CUSTOMER */}

                      <td className="px-5 py-4">

                        <div className="flex items-center gap-2">

                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                            <Building2
                              size={14}
                            />
                          </div>

                          <span
                            className="max-w-[180px] truncate font-medium text-gray-700"
                            title={
                              row.customer
                            }
                          >
                            {
                              row.customer
                            }
                          </span>

                        </div>

                      </td>

                      {/* KODE */}

                      <td className="px-5 py-4">

                        <span className="inline-flex rounded-lg bg-gray-100 px-2.5 py-1.5 font-mono text-xs font-semibold text-gray-600">
                          {
                            row.kodeBarang
                          }
                        </span>

                      </td>

                      {/* BARANG */}

                      <td className="px-5 py-4">

                        <div className="flex items-center gap-2">

                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F3] text-[#71857E]">
                            <Boxes
                              size={14}
                            />
                          </div>

                          <span
                            className="block max-w-[230px] truncate font-medium text-[#18352D]"
                            title={
                              row.barang
                            }
                          >
                            {
                              row.barang
                            }
                          </span>

                        </div>

                      </td>

                      {/* QTY */}

                      <td className="px-5 py-4 text-right">

                        <span className="font-semibold tabular-nums text-gray-700">
                          {row.qty.toLocaleString(
                            "id-ID"
                          )}
                        </span>

                      </td>

                      {/* PRICE */}

                      <td className="whitespace-nowrap px-5 py-4 text-right text-gray-600">
                        {formatRupiah(
                          row.harga
                        )}
                      </td>

                      {/* TOTAL */}

                      <td className="whitespace-nowrap px-5 py-4 text-right">

                        <span className="font-bold text-[#18352D]">
                          {formatRupiah(
                            row.subtotal
                          )}
                        </span>

                      </td>

                    </tr>
                  )
                )}

            </tbody>

          </table>

        </div>

        {/* TABLE FOOTER */}

        {!loading &&
          filteredRows.length >
            0 && (
            <div className="flex flex-col justify-between gap-3 border-t border-[#E5ECE9] bg-[#F5F8F6] px-5 py-4 md:flex-row md:items-center md:px-6">

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">

                <span>

                  <strong className="text-[#18352D]">
                    {filteredRows.length.toLocaleString(
                      "id-ID"
                    )}
                  </strong>{" "}
                  baris

                </span>

                <span>

                  <strong className="text-[#18352D]">
                    {totalDelivery.toLocaleString(
                      "id-ID"
                    )}
                  </strong>{" "}
                  delivery

                </span>

                <span>

                  <strong className="text-[#18352D]">
                    {totalQty.toLocaleString(
                      "id-ID"
                    )}
                  </strong>{" "}
                  qty

                </span>

              </div>

              <div className="flex items-center gap-2 font-medium text-[#35564C]">

                <PackageCheck
                  size={15}
                  className="text-[#497F70]"
                />

                {
                  selectedCustomerName
                }

              </div>

            </div>
          )}

      </div>

      {/* ================================================= */}
      {/* FOOTER */}
      {/* ================================================= */}

      <div className="mt-5 flex flex-col gap-2 px-1 text-[11px] text-gray-400 sm:flex-row sm:items-center sm:justify-between">

        <div className="flex items-center gap-2">

          <span className="font-bold tracking-wider text-[#35564C]">
            MGB INVENTORY
          </span>

          <span className="text-gray-300">
            •
          </span>

          <span>
            Laporan Barang Keluar
          </span>

        </div>

        <div className="flex items-center gap-2">

          <span>
            {
              selectedCustomerName
            }
          </span>

          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

          <span>
            Data tersinkronisasi dengan sistem
          </span>

        </div>

      </div>

    </div>
  );
}

// =====================================================
// SUMMARY CARD
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

// =====================================================
// FILTER BADGE
// =====================================================

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