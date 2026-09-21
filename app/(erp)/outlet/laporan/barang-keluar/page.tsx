"use client";

import {
  Activity,
  ArrowDown,
  ArrowDownCircle,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardMinus,
  Factory,
  Filter,
  PackageMinus,
  RefreshCw,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

// =====================================================
// TYPES
// =====================================================

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type ReportRow = {
  id: string;
  date: string;
  number: string;

  outletId: number | null;
  outletCode: string;
  outletName: string;

  source: string;
  sourceLabel: string;

  type: string;
  typeLabel: string;

  barangId: number;
  barangCode: string;
  barcode: string | null;
  barangName: string;
  unit: string;

  qtyOut: number;
  unitCost: number;
  totalCost: number;

  referenceId: number | null;
  reference: string | null;

  status: string | null;
  userName: string | null;

  note: string | null;
};

type Summary = {
  totalTransactions: number;
  totalQtyOut: number;
  totalCost: number;

  barangKeluar: number;
  pos: number;
  manufacture: number;
  transfer: number;
  stockOpname: number;
  adjustment: number;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

// =====================================================
// HELPERS
// =====================================================

function formatNumber(
  value: number,
  maximumFractionDigits = 3
) {
  return new Intl.NumberFormat(
    "id-ID",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function formatDate(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "id-ID",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function getToday() {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthStart() {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  return `${year}-${month}-01`;
}

// =====================================================
// SOURCE CONFIG
// =====================================================

const SOURCE_OPTIONS = [
  {
    value: "",
    label: "Semua Sumber",
  },
  {
    value: "BARANG_KELUAR",
    label: "Barang Keluar",
  },
  {
    value: "POS",
    label: "POS / BOM",
  },
  {
    value: "MANUFACTURE",
    label: "Manufacture",
  },
  {
    value: "TRANSFER",
    label: "Transfer Outlet",
  },
  {
    value: "STOCK_OPNAME",
    label: "Stock Opname",
  },
  {
    value: "ADJUSTMENT",
    label: "Adjustment MINUS",
  },
];

// =====================================================
// BADGE
// =====================================================

function SourceBadge({
  source,
  label,
}: {
  source: string;
  label: string;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap";

  switch (source) {
    case "BARANG_KELUAR":
      return (
        <span
          className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}
        >
          <PackageMinus
            size={12}
          />
          {label}
        </span>
      );

    case "POS":
      return (
        <span
          className={`${base} border-blue-200 bg-blue-50 text-blue-700`}
        >
          <ShoppingCart
            size={12}
          />
          {label}
        </span>
      );

    case "MANUFACTURE":
      return (
        <span
          className={`${base} border-purple-200 bg-purple-50 text-purple-700`}
        >
          <Factory
            size={12}
          />
          {label}
        </span>
      );

    case "TRANSFER":
      return (
        <span
          className={`${base} border-orange-200 bg-orange-50 text-orange-700`}
        >
          <Truck
            size={12}
          />
          {label}
        </span>
      );

    case "STOCK_OPNAME":
      return (
        <span
          className={`${base} border-red-200 bg-red-50 text-red-700`}
        >
          <ClipboardMinus
            size={12}
          />
          {label}
        </span>
      );

    case "ADJUSTMENT":
      return (
        <span
          className={`${base} border-rose-200 bg-rose-50 text-rose-700`}
        >
          <SlidersHorizontal
            size={12}
          />
          {label}
        </span>
      );

    default:
      return (
        <span
          className={`${base} border-slate-200 bg-slate-50 text-slate-700`}
        >
          {label}
        </span>
      );
  }
}

// =====================================================
// SUMMARY CARD
// =====================================================

function SummaryCard({
  title,
  value,
  icon,
  description,
  className = "",
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="absolute -right-7 -top-7 h-20 w-20 rounded-full bg-emerald-50" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-xl font-black tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-xs font-medium text-slate-500">
            {description}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// PAGE
// =====================================================

export default function BarangKeluarOutletPage() {
  const [rows, setRows] =
    useState<ReportRow[]>(
      []
    );

  const [outlets, setOutlets] =
    useState<Outlet[]>(
      []
    );

  const [summary, setSummary] =
    useState<Summary>({
      totalTransactions: 0,
      totalQtyOut: 0,
      totalCost: 0,
      barangKeluar: 0,
      pos: 0,
      manufacture: 0,
      transfer: 0,
      stockOpname: 0,
      adjustment: 0,
    });

  const [pagination, setPagination] =
    useState<Pagination>({
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 1,
    });

  const [role, setRole] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [searchInput, setSearchInput] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [outletId, setOutletId] =
    useState("");

  const [source, setSource] =
    useState("");

  const [dateFrom, setDateFrom] =
    useState(
      getMonthStart()
    );

  const [dateTo, setDateTo] =
    useState(
      getToday()
    );

  const [showFilters, setShowFilters] =
    useState(false);

  // ===================================================
  // FETCH
  // ===================================================

  const loadData =
    useCallback(
      async (
        targetPage = 1
      ) => {
        try {
          setLoading(true);
          setError("");

          const params =
            new URLSearchParams();

          params.set(
            "page",
            String(targetPage)
          );

          params.set(
            "pageSize",
            "25"
          );

          if (search) {
            params.set(
              "search",
              search
            );
          }

          if (outletId) {
            params.set(
              "outletId",
              outletId
            );
          }

          if (source) {
            params.set(
              "source",
              source
            );
          }

          if (dateFrom) {
            params.set(
              "dateFrom",
              dateFrom
            );
          }

          if (dateTo) {
            params.set(
              "dateTo",
              dateTo
            );
          }

          const response =
            await fetch(
              `/api/outlet/laporan/barang-keluar?${params.toString()}`,
              {
                method: "GET",
                cache: "no-store",
              }
            );

          const json =
            await response.json();

          if (
            !response.ok ||
            !json?.success
          ) {
            throw new Error(
              json?.message ||
                "Gagal mengambil laporan"
            );
          }

          setRows(
            Array.isArray(
              json.data
            )
              ? json.data
              : []
          );

          setOutlets(
            Array.isArray(
              json.outlets
            )
              ? json.outlets
              : []
          );

          setSummary(
            json.summary || {
              totalTransactions: 0,
              totalQtyOut: 0,
              totalCost: 0,
              barangKeluar: 0,
              pos: 0,
              manufacture: 0,
              transfer: 0,
              stockOpname: 0,
              adjustment: 0,
            }
          );

          setPagination(
            json.pagination || {
              page: 1,
              pageSize: 25,
              total: 0,
              totalPages: 1,
            }
          );

          setRole(
            String(
              json?.user?.role ||
                ""
            )
          );
        } catch (err: any) {
          console.error(err);

          setError(
            err?.message ||
              "Gagal mengambil laporan barang keluar"
          );

          setRows([]);
        } finally {
          setLoading(false);
        }
      },
      [
        search,
        outletId,
        source,
        dateFrom,
        dateTo,
      ]
    );

  // ===================================================
  // INITIAL
  // ===================================================

  useEffect(() => {
    loadData(1);
  }, [
    loadData,
  ]);

  // ===================================================
  // SEARCH
  // ===================================================

  function submitSearch() {
    setSearch(
      searchInput.trim()
    );
  }

  function clearSearch() {
    setSearchInput("");
    setSearch("");
  }

  // ===================================================
  // RESET
  // ===================================================

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setOutletId("");
    setSource("");
    setDateFrom(
      getMonthStart()
    );
    setDateTo(
      getToday()
    );
  }

  // ===================================================
  // ACTIVE FILTER COUNT
  // ===================================================

  const activeFilterCount =
    useMemo(() => {
      let count = 0;

      if (outletId) {
        count++;
      }

      if (source) {
        count++;
      }

      if (dateFrom) {
        count++;
      }

      if (dateTo) {
        count++;
      }

      if (search) {
        count++;
      }

      return count;
    }, [
      outletId,
      source,
      dateFrom,
      dateTo,
      search,
    ]);

  // ===================================================
  // CURRENT PAGE INFO
  // ===================================================

  const showingFrom =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) *
          pagination.pageSize +
        1;

  const showingTo =
    Math.min(
      pagination.page *
        pagination.pageSize,
      pagination.total
    );

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="min-h-screen bg-slate-50">
      {/* =================================================
          HEADER
      ================================================= */}

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
                <ArrowDownCircle
                  size={25}
                  strokeWidth={2.4}
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                    Semua Barang Keluar Outlet
                  </h1>

                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                    Unified Ledger
                  </span>
                </div>

                <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-500">
                  Seluruh transaksi yang benar-benar
                  mengurangi stock outlet dalam satu
                  laporan terpusat.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setShowFilters(
                    (value) =>
                      !value
                  )
                }
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <Filter
                  size={16}
                />

                Filter

                {activeFilterCount >
                  0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-black text-white">
                    {
                      activeFilterCount
                    }
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  loadData(
                    pagination.page
                  )
                }
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={16}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6 lg:px-8">
        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Transaksi"
            value={formatNumber(
              summary.totalTransactions,
              0
            )}
            description="Semua sumber outbound"
            icon={
              <Activity
                size={20}
              />
            }
          />

          <SummaryCard
            title="Total Qty Keluar"
            value={formatNumber(
              summary.totalQtyOut
            )}
            description="Akumulasi barang keluar"
            icon={
              <Boxes
                size={20}
              />
            }
          />

          <SummaryCard
            title="Total Cost"
            value={formatCurrency(
              summary.totalCost
            )}
            description="Estimasi nilai stock keluar"
            icon={
              <ArrowDown
                size={20}
              />
            }
          />

          <SummaryCard
            title="Adjustment / Opname"
            value={formatNumber(
              summary.adjustment +
                summary.stockOpname,
              0
            )}
            description="Penyesuaian stock minus"
            icon={
              <ClipboardMinus
                size={20}
              />
            }
          />
        </div>

        {/* =================================================
            SOURCE MINI SUMMARY
        ================================================= */}

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Barang Keluar
            </p>
            <p className="mt-1 text-lg font-black text-emerald-700">
              {formatNumber(
                summary.barangKeluar,
                0
              )}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              POS / BOM
            </p>
            <p className="mt-1 text-lg font-black text-blue-700">
              {formatNumber(
                summary.pos,
                0
              )}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Manufacture
            </p>
            <p className="mt-1 text-lg font-black text-purple-700">
              {formatNumber(
                summary.manufacture,
                0
              )}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Transfer
            </p>
            <p className="mt-1 text-lg font-black text-orange-700">
              {formatNumber(
                summary.transfer,
                0
              )}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Stock Opname
            </p>
            <p className="mt-1 text-lg font-black text-red-700">
              {formatNumber(
                summary.stockOpname,
                0
              )}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Adjustment
            </p>
            <p className="mt-1 text-lg font-black text-rose-700">
              {formatNumber(
                summary.adjustment,
                0
              )}
            </p>
          </div>
        </div>

        {/* =================================================
            FILTER PANEL
        ================================================= */}

        {showFilters && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal
                    size={17}
                    className="text-emerald-600"
                  />

                  <h2 className="text-sm font-black text-slate-900">
                    Filter Laporan
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={
                    resetFilters
                  }
                  className="text-xs font-bold text-slate-500 transition hover:text-emerald-700"
                >
                  Reset Filter
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
              {/* SEARCH */}

              <div className="xl:col-span-2">
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Cari Barang / Transaksi
                </label>

                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={
                      searchInput
                    }
                    onChange={(event) =>
                      setSearchInput(
                        event.target
                          .value
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        submitSearch();
                      }
                    }}
                    placeholder="Kode barang, nama barang, nomor transaksi..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                  />

                  {searchInput && (
                    <button
                      type="button"
                      onClick={
                        clearSearch
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X
                        size={16}
                      />
                    </button>
                  )}
                </div>
              </div>

              {/* OUTLET */}

              {role !==
                "OUTLET_ADMIN" && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Outlet
                  </label>

                  <select
                    value={
                      outletId
                    }
                    onChange={(event) =>
                      setOutletId(
                        event.target
                          .value
                      )
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                  >
                    <option value="">
                      Semua Outlet
                    </option>

                    {outlets.map(
                      (
                        outlet
                      ) => (
                        <option
                          key={
                            outlet.id
                          }
                          value={
                            outlet.id
                          }
                        >
                          {
                            outlet.name
                          }{" "}
                          —{" "}
                          {
                            outlet.code
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}

              {/* SOURCE */}

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Sumber Transaksi
                </label>

                <select
                  value={source}
                  onChange={(event) =>
                    setSource(
                      event.target
                        .value
                    )
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                >
                  {SOURCE_OPTIONS.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {
                          option.label
                        }
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* DATE FROM */}

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Dari Tanggal
                </label>

                <div className="relative">
                  <CalendarDays
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="date"
                    value={
                      dateFrom
                    }
                    onChange={(event) =>
                      setDateFrom(
                        event.target
                          .value
                      )
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>
              </div>

              {/* DATE TO */}

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Sampai Tanggal
                </label>

                <div className="relative">
                  <CalendarDays
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="date"
                    value={
                      dateTo
                    }
                    onChange={(event) =>
                      setDateTo(
                        event.target
                          .value
                      )
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>
              </div>

              {/* APPLY */}

              <div className="flex items-end xl:col-span-2">
                <button
                  type="button"
                  onClick={() =>
                    loadData(1)
                  }
                  className="h-10 w-full rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
                >
                  Terapkan Filter
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            SEARCH BAR QUICK
        ================================================= */}

        {!showFilters && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={
                  searchInput
                }
                onChange={(event) =>
                  setSearchInput(
                    event.target
                      .value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    submitSearch();
                  }
                }}
                placeholder="Cari kode barang, nama barang, nomor transaksi..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>

            <button
              type="button"
              onClick={
                submitSearch
              }
              className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-black text-white transition hover:bg-emerald-700"
            >
              Cari
            </button>
          </div>
        )}

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-red-800">
                  Gagal memuat laporan
                </p>

                <p className="mt-1 text-sm font-medium text-red-700">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  loadData(
                    pagination.page
                  )
                }
                className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-700 shadow-sm"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        )}

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <ArrowDown
                    size={16}
                  />
                </div>

                <h2 className="text-sm font-black text-slate-900">
                  Detail Barang Keluar
                </h2>
              </div>

              <p className="mt-1 pl-10 text-xs font-medium text-slate-500">
                {pagination.total >
                0
                  ? `Menampilkan ${formatNumber(
                      showingFrom,
                      0
                    )}–${formatNumber(
                      showingTo,
                      0
                    )} dari ${formatNumber(
                      pagination.total,
                      0
                    )} transaksi`
                  : "Tidak ada transaksi"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {search && (
                <button
                  type="button"
                  onClick={
                    clearSearch
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Search: "
                  {search}"
                  <X
                    size={13}
                  />
                </button>
              )}

              <span className="hidden rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 sm:inline-flex">
                {formatNumber(
                  summary.totalQtyOut
                )}{" "}
                qty keluar
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1250px] w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Tanggal
                  </th>

                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Transaksi
                  </th>

                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Outlet
                  </th>

                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Sumber
                  </th>

                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Barang
                  </th>

                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Qty Keluar
                  </th>

                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Unit Cost
                  </th>

                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Total Cost
                  </th>

                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Keterangan
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({
                    length: 8,
                  }).map(
                    (_, index) => (
                      <tr
                        key={
                          index
                        }
                      >
                        {Array.from(
                          {
                            length: 9,
                          }
                        ).map(
                          (
                            __,
                            cellIndex
                          ) => (
                            <td
                              key={
                                cellIndex
                              }
                              className="px-4 py-4"
                            >
                              <div className="h-4 animate-pulse rounded bg-slate-100" />
                            </td>
                          )
                        )}
                      </tr>
                    )
                  )
                ) : rows.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto flex max-w-md flex-col items-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                          <PackageMinus
                            size={25}
                          />
                        </div>

                        <p className="mt-4 text-sm font-black text-slate-800">
                          Tidak ada barang keluar
                        </p>

                        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                          Tidak ditemukan transaksi
                          outbound sesuai filter yang
                          dipilih.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map(
                    (row) => (
                      <tr
                        key={
                          row.id
                        }
                        className="group transition hover:bg-emerald-50/30"
                      >
                        {/* DATE */}

                        <td className="whitespace-nowrap px-4 py-4 align-top">
                          <p className="text-xs font-bold text-slate-800">
                            {formatDate(
                              row.date
                            )}
                          </p>
                        </td>

                        {/* NUMBER */}

                        <td className="px-4 py-4 align-top">
                          <p className="font-mono text-xs font-black text-slate-900">
                            {
                              row.number
                            }
                          </p>

                          {row.reference &&
                            row.reference !==
                              row.number && (
                              <p className="mt-1 text-[10px] font-medium text-slate-400">
                                Ref:{" "}
                                {
                                  row.reference
                                }
                              </p>
                            )}
                        </td>

                        {/* OUTLET */}

                        <td className="px-4 py-4 align-top">
                          <p className="text-xs font-black text-slate-800">
                            {
                              row.outletName
                            }
                          </p>

                          <p className="mt-0.5 font-mono text-[10px] font-bold text-slate-400">
                            {
                              row.outletCode
                            }
                          </p>
                        </td>

                        {/* SOURCE */}

                        <td className="px-4 py-4 align-top">
                          <SourceBadge
                            source={
                              row.source
                            }
                            label={
                              row.sourceLabel
                            }
                          />

                          {row.status && (
                            <p className="mt-1.5 text-[10px] font-bold text-slate-400">
                              {
                                row.status
                              }
                            </p>
                          )}
                        </td>

                        {/* BARANG */}

                        <td className="min-w-[260px] px-4 py-4 align-top">
                          <p className="text-sm font-black text-slate-900">
                            {
                              row.barangName
                            }
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-emerald-700">
                              {
                                row.barangCode
                              }
                            </span>

                            {row.barcode && (
                              <>
                                <span className="text-slate-300">
                                  •
                                </span>

                                <span className="font-mono text-[10px] font-medium text-slate-400">
                                  {
                                    row.barcode
                                  }
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* QTY */}

                        <td className="px-4 py-4 text-right align-top">
                          <div className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5">
                            <ArrowDown
                              size={12}
                              className="text-red-600"
                            />

                            <span className="text-sm font-black text-red-700">
                              -
                              {formatNumber(
                                row.qtyOut
                              )}
                            </span>

                            <span className="text-[10px] font-bold text-red-500">
                              {
                                row.unit
                              }
                            </span>
                          </div>
                        </td>

                        {/* UNIT COST */}

                        <td className="whitespace-nowrap px-4 py-4 text-right align-top">
                          <p className="text-xs font-bold text-slate-700">
                            {formatCurrency(
                              row.unitCost
                            )}
                          </p>
                        </td>

                        {/* TOTAL COST */}

                        <td className="whitespace-nowrap px-4 py-4 text-right align-top">
                          <p className="text-sm font-black text-slate-900">
                            {formatCurrency(
                              row.totalCost
                            )}
                          </p>
                        </td>

                        {/* NOTE */}

                        <td className="max-w-[300px] px-4 py-4 align-top">
                          <p
                            className="truncate text-xs font-medium text-slate-500"
                            title={
                              row.note ||
                              ""
                            }
                          >
                            {row.note ||
                              "—"}
                          </p>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>

              {!loading &&
                rows.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td
                        colSpan={5}
                        className="px-4 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-500"
                      >
                        Total Halaman
                      </td>

                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-black text-red-700">
                          -
                          {formatNumber(
                            rows.reduce(
                              (
                                sum,
                                row
                              ) =>
                                sum +
                                row.qtyOut,
                              0
                            )
                          )}
                        </span>
                      </td>

                      <td />

                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-black text-slate-900">
                          {formatCurrency(
                            rows.reduce(
                              (
                                sum,
                                row
                              ) =>
                                sum +
                                row.totalCost,
                              0
                            )
                          )}
                        </span>
                      </td>

                      <td />
                    </tr>
                  </tfoot>
                )}
            </table>
          </div>

          {/* =================================================
              PAGINATION
          ================================================= */}

          {!loading &&
            pagination.total >
              0 && (
              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-medium text-slate-500">
                  Halaman{" "}
                  <span className="font-black text-slate-800">
                    {
                      pagination.page
                    }
                  </span>{" "}
                  dari{" "}
                  <span className="font-black text-slate-800">
                    {
                      pagination.totalPages
                    }
                  </span>
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={
                      pagination.page <=
                      1
                    }
                    onClick={() =>
                      loadData(
                        pagination.page -
                          1
                      )
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft
                      size={15}
                    />
                    Sebelumnya
                  </button>

                  <div className="hidden items-center gap-1 sm:flex">
                    {Array.from(
                      {
                        length: Math.min(
                          pagination.totalPages,
                          5
                        ),
                      },
                      (
                        _,
                        index
                      ) => {
                        let pageNumber =
                          index +
                          1;

                        if (
                          pagination.totalPages >
                          5
                        ) {
                          pageNumber =
                            Math.max(
                              1,
                              Math.min(
                                pagination.page -
                                  2 +
                                  index,
                                pagination.totalPages -
                                  4
                              )
                            );
                        }

                        const active =
                          pageNumber ===
                          pagination.page;

                        return (
                          <button
                            key={
                              pageNumber
                            }
                            type="button"
                            onClick={() =>
                              loadData(
                                pageNumber
                              )
                            }
                            className={`h-9 min-w-9 rounded-lg px-2 text-xs font-black transition ${
                              active
                                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                                : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                            }`}
                          >
                            {
                              pageNumber
                            }
                          </button>
                        );
                      }
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={
                      pagination.page >=
                      pagination.totalPages
                    }
                    onClick={() =>
                      loadData(
                        pagination.page +
                          1
                      )
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Berikutnya
                    <ChevronRight
                      size={15}
                    />
                  </button>
                </div>
              </div>
            )}
        </div>

        {/* =================================================
            FOOTNOTE / LEDGER INFO
        ================================================= */}

        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
              <Activity
                size={17}
              />
            </div>

            <div>
              <p className="text-xs font-black text-emerald-900">
                Unified Stock Out Ledger
              </p>

              <p className="mt-1 max-w-4xl text-xs font-medium leading-5 text-emerald-800/80">
                Laporan ini hanya menghitung transaksi
                yang mempunyai dampak nyata terhadap
                stock outlet. StockCard digunakan sebagai
                ledger utama, sedangkan Adjustment MINUS
                menggunakan StockMutation. Tabel turunan
                tidak dijumlahkan kembali sehingga transaksi
                tidak terhitung dua kali.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}