"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Search,
  RefreshCw,
  Package,
  Warehouse,
  ClipboardCheck,
  LockKeyhole,
  History,
  X,
  CalendarDays,
  ArrowUp,
  ArrowDown,
  Minus,
  ArrowDownCircle,
  ArrowUpCircle,
  Info,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  PackageX,
  ChevronRight,
  Activity,
  Boxes,
} from "lucide-react";

type LastOpname = {
  opnameId: number;
  code: string;
  date: string;
  status: string;
  systemQty: number;
  physicalQty: number;
  difference: number;
  note: string | null;
};

type Stock = {
  id: number;
  barangId: number;
  stock: number;
  minimumStock: number;
  averageCost: number;

  barang: {
    id: number;
    code: string;
    name: string;
    unit: string;
    barcode: string | null;
  };

  lastOpname: LastOpname | null;
};

type ApiResponse = {
  success: boolean;
  data: Stock[];
  message?: string;
};

type HistoryBarang = {
  id: number;
  code: string;
  name: string;
  unit: string;
  barcode: string | null;
};

type HistoryRow = {
  id: string;
  date: string;
  type: string;
  direction: "IN" | "OUT" | "INFO";
  number: string | null;
  outletId: number | null;
  barangId: number;
  qty: number;
  stockBefore: number | null;
  stockAfter: number | null;
  status: string | null;
  description: string | null;
  source: string;
  barang: HistoryBarang | null;
};

type HistoryResponse = {
  success: boolean;
  data: HistoryRow[];
  summary?: {
    total: number;
    stockIn: number;
    stockOut: number;
    informational: number;
  };
  message?: string;
};

type FilterStatus =
  | "ALL"
  | "AMAN"
  | "MINIMUM"
  | "HABIS";

export default function StockPusatPage() {
  const [data, setData] = useState<Stock[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] =
    useState<FilterStatus>("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =====================================================
  // HISTORY
  // =====================================================

  const [selectedHistory, setSelectedHistory] =
    useState<Stock | null>(null);

  const [historyData, setHistoryData] =
    useState<HistoryRow[]>([]);

  const [historySummary, setHistorySummary] =
    useState({
      total: 0,
      stockIn: 0,
      stockOut: 0,
      informational: 0,
    });

  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [historyError, setHistoryError] =
    useState("");

  // =====================================================
  // LOAD STOCK
  // =====================================================

  async function loadStock() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/stock", {
        cache: "no-store",
      });

      const result: ApiResponse =
        await res.json();

      if (!res.ok || !result.success) {
        throw new Error(
          result.message ||
            "Gagal mengambil stock pusat"
        );
      }

      setData(
        Array.isArray(result.data)
          ? result.data
          : []
      );
    } catch (error: any) {
      console.error(
        "LOAD CENTRAL STOCK ERROR:",
        error
      );

      setData([]);

      setError(
        error?.message ||
          "Gagal mengambil stock pusat"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // INITIAL
  // =====================================================

  useEffect(() => {
    loadStock();
  }, []);

  // =====================================================
  // STOCK STATUS
  // =====================================================

  function getStatus(
    stock: number,
    minimum: number
  ) {
    if (stock <= 0) {
      return {
        text: "HABIS",
        className:
          "border-red-200 bg-red-50 text-red-700",
        icon: PackageX,
      };
    }

    if (stock <= minimum) {
      return {
        text: "MINIMUM",
        className:
          "border-amber-200 bg-amber-50 text-amber-700",
        icon: AlertTriangle,
      };
    }

    return {
      text: "AMAN",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
    };
  }

  // =====================================================
  // SEARCH + FILTER
  // =====================================================

  const filteredData = useMemo(() => {
    const keyword =
      search.toLowerCase().trim();

    return data.filter((item) => {
      const code =
        item.barang?.code
          ?.toLowerCase() || "";

      const name =
        item.barang?.name
          ?.toLowerCase() || "";

      const barcode =
        item.barang?.barcode
          ?.toLowerCase() || "";

      const matchesSearch =
        !keyword ||
        code.includes(keyword) ||
        name.includes(keyword) ||
        barcode.includes(keyword);

      if (!matchesSearch) {
        return false;
      }

      if (filterStatus === "ALL") {
        return true;
      }

      const status = getStatus(
        Number(item.stock),
        Number(item.minimumStock)
      ).text;

      return status === filterStatus;
    });
  }, [data, search, filterStatus]);

  // =====================================================
  // HISTORY TYPE
  // =====================================================

  function getHistoryType(
    type: string
  ) {
    switch (
      String(type || "").toUpperCase()
    ) {
      case "RECEIVE":
      case "RECEIPT":
        return {
          text: "Barang Masuk Supplier",
          className:
            "border-emerald-200 bg-emerald-50 text-emerald-700",
        };

      case "TRANSFER":
      case "TRANSFER_IN":
        return {
          text: "Transfer Masuk",
          className:
            "border-blue-200 bg-blue-50 text-blue-700",
        };

      case "DELIVERY":
      case "DELIVERY_OUT":
      case "STOCK_OUT":
        return {
          text: "Barang Keluar",
          className:
            "border-red-200 bg-red-50 text-red-700",
        };

      case "ADJUSTMENT":
        return {
          text: "Adjustment Stock",
          className:
            "border-amber-200 bg-amber-50 text-amber-700",
        };

      case "OPNAME":
      case "STOCK_OPNAME":
        return {
          text: "Stock Opname",
          className:
            "border-purple-200 bg-purple-50 text-purple-700",
        };

      case "PURCHASE":
        return {
          text: "Purchase Order",
          className:
            "border-gray-200 bg-gray-50 text-gray-700",
        };

      default:
        return {
          text: type || "-",
          className:
            "border-gray-200 bg-gray-50 text-gray-600",
        };
    }
  }

  // =====================================================
  // OPNAME STATUS
  // =====================================================

  function getOpnameStatus(
    status?: string
  ) {
    const value = String(
      status || ""
    ).toUpperCase();

    if (value === "APPROVED") {
      return {
        text: "APPROVED",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    }

    if (
      value === "COUNTING" ||
      value === "PENDING"
    ) {
      return {
        text: "MENUNGGU",
        className:
          "border-amber-200 bg-amber-50 text-amber-700",
      };
    }

    if (value === "REJECTED") {
      return {
        text: "REJECTED",
        className:
          "border-red-200 bg-red-50 text-red-700",
      };
    }

    return {
      text: value || "-",
      className:
        "border-gray-200 bg-gray-50 text-gray-600",
    };
  }

  // =====================================================
  // FORMAT NUMBER
  // =====================================================

  function formatNumber(value: number) {
    return Number(value ?? 0).toLocaleString(
      "id-ID"
    );
  }

  // =====================================================
  // FORMAT DATE
  // =====================================================

  function formatDate(
    value?: string | null
  ) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
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

  // =====================================================
  // FORMAT DATE TIME
  // =====================================================

  function formatDateTime(
    value?: string | null
  ) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString(
      "id-ID",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalStock = useMemo(() => {
    return filteredData.reduce(
      (total, item) =>
        total +
        Number(item.stock || 0),
      0
    );
  }, [filteredData]);

  const totalWithOpname = useMemo(() => {
    return filteredData.filter(
      (item) =>
        item.lastOpname !== null
    ).length;
  }, [filteredData]);

  const totalDifference = useMemo(() => {
    return filteredData.reduce(
      (total, item) =>
        total +
        Number(
          item.lastOpname
            ?.difference || 0
        ),
      0
    );
  }, [filteredData]);

  const totalAman = useMemo(() => {
    return data.filter(
      (item) =>
        getStatus(
          Number(item.stock),
          Number(item.minimumStock)
        ).text === "AMAN"
    ).length;
  }, [data]);

  const totalMinimum = useMemo(() => {
    return data.filter(
      (item) =>
        getStatus(
          Number(item.stock),
          Number(item.minimumStock)
        ).text === "MINIMUM"
    ).length;
  }, [data]);

  const totalHabis = useMemo(() => {
    return data.filter(
      (item) =>
        getStatus(
          Number(item.stock),
          Number(item.minimumStock)
        ).text === "HABIS"
    ).length;
  }, [data]);

  // =====================================================
  // OPEN HISTORY
  // =====================================================

  async function openHistory(
    stock: Stock
  ) {
    try {
      setSelectedHistory(stock);
      setHistoryData([]);
      setHistoryError("");
      setHistoryLoading(true);

      const params =
        new URLSearchParams();

      params.set(
        "barangId",
        String(stock.barangId)
      );

      const res = await fetch(
        `/api/stock/history?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const result: HistoryResponse =
        await res.json();

      if (
        !res.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
            "Gagal mengambil history stock"
        );
      }

      setHistoryData(
        Array.isArray(result.data)
          ? result.data
          : []
      );

      setHistorySummary({
        total:
          Number(
            result.summary?.total || 0
          ),
        stockIn:
          Number(
            result.summary?.stockIn || 0
          ),
        stockOut:
          Number(
            result.summary?.stockOut || 0
          ),
        informational:
          Number(
            result.summary
              ?.informational || 0
          ),
      });
    } catch (error: any) {
      console.error(
        "LOAD CENTRAL HISTORY ERROR:",
        error
      );

      setHistoryData([]);

      setHistoryError(
        error?.message ||
          "Gagal mengambil history stock"
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  // =====================================================
  // CLOSE HISTORY
  // =====================================================

  function closeHistory() {
    setSelectedHistory(null);
    setHistoryData([]);
    setHistoryError("");
    setHistoryLoading(false);
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-full bg-[#F4F7F5]">

      {/* =================================================
          PREMIUM HEADER
      ================================================= */}

      <div className="border-b border-[#DCE7E2] bg-white">

        <div className="px-6 py-6 md:px-8">

          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

            <div className="flex items-start gap-4">

              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#497F70] text-white shadow-[0_8px_24px_rgba(73,127,112,0.22)]">

                <Warehouse size={25} />

                <div className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-white/10" />

              </div>

              <div>

                <div className="flex flex-wrap items-center gap-2">

                  <h1 className="text-[26px] font-bold tracking-[-0.03em] text-[#18352D] md:text-[30px]">
                    Stock Pusat
                  </h1>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CFE1D9] bg-[#EDF6F1] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#497F70]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />
                    Live System
                  </span>

                </div>

                <p className="mt-1 text-sm text-gray-500">
                  Monitoring persediaan gudang pusat,
                  stock opname, dan riwayat pergerakan
                  barang.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">

                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <Warehouse size={13} />
                    Gudang Pusat
                  </span>

                  <span className="h-1 w-1 rounded-full bg-gray-300" />

                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                    <LockKeyhole size={13} />
                    Stock Terkunci
                  </span>

                </div>

              </div>

            </div>

            <button
              type="button"
              onClick={loadStock}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#497F70] px-5 text-sm font-bold text-white shadow-[0_6px_18px_rgba(73,127,112,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              <RefreshCw
                size={16}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />

              {loading
                ? "Memuat..."
                : "Refresh Data"}
            </button>

          </div>

        </div>

      </div>

      <div className="px-6 py-6 md:px-8 md:py-7">

        {/* =================================================
            LOCK BANNER
        ================================================= */}

        <div className="mb-6 overflow-hidden rounded-2xl border border-[#CFE1D9] bg-gradient-to-r from-[#EDF6F1] via-white to-[#F8FBF9]">

          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:px-6">

            <div className="flex items-start gap-3">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DCEDE5] text-[#497F70]">
                <LockKeyhole size={19} />
              </div>

              <div>

                <p className="text-sm font-bold text-[#285346]">
                  Stock pusat terkunci
                </p>

                <p className="mt-1 max-w-3xl text-xs leading-5 text-[#56766B]">
                  Nilai stock pada halaman ini
                  merupakan stock sistem. Perubahan
                  stock tidak dilakukan secara manual
                  dari halaman ini. Hasil stock opname
                  digunakan sebagai kontrol dan
                  pembanding kondisi fisik gudang.
                </p>

              </div>

            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-[#DCE7E2] bg-white px-3 py-2">

              <Activity
                size={15}
                className="text-emerald-600"
              />

              <span className="text-xs font-semibold text-gray-600">
                Sistem Aktif
              </span>

            </div>

          </div>

        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">

            <Info
              size={18}
              className="mt-0.5 shrink-0 text-red-500"
            />

            <div>

              <p className="text-sm font-bold text-red-700">
                Gagal memuat stock pusat
              </p>

              <p className="mt-1 text-xs text-red-600">
                {error}
              </p>

            </div>

          </div>
        )}

        {/* =================================================
            KPI
        ================================================= */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* TOTAL ITEM */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_4px_18px_rgba(30,70,58,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(30,70,58,0.08)]">

            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#EAF3EF]" />

            <div className="relative flex items-start justify-between">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-gray-400">
                  Jenis Barang
                </p>

                <p className="mt-2 text-[28px] font-bold tracking-tight text-[#18352D]">
                  {formatNumber(
                    filteredData.length
                  )}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Barang terdaftar di pusat
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <Package size={20} />
              </div>

            </div>

          </div>

          {/* TOTAL STOCK */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_4px_18px_rgba(30,70,58,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(30,70,58,0.08)]">

            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#EEF6F3]" />

            <div className="relative flex items-start justify-between">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-gray-400">
                  Total Qty Stock
                </p>

                <p className="mt-2 text-[28px] font-bold tracking-tight text-[#18352D]">
                  {formatNumber(totalStock)}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Akumulasi stock sistem
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF6F3] text-[#497F70]">
                <Boxes size={20} />
              </div>

            </div>

          </div>

          {/* OPNAME */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_4px_18px_rgba(30,70,58,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(30,70,58,0.08)]">

            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#F2F0FA]" />

            <div className="relative flex items-start justify-between">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-gray-400">
                  Sudah Stock Opname
                </p>

                <p className="mt-2 text-[28px] font-bold tracking-tight text-[#18352D]">
                  {formatNumber(
                    totalWithOpname
                  )}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Dari {formatNumber(data.length)} jenis
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F2F0FA] text-purple-600">
                <ClipboardCheck size={20} />
              </div>

            </div>

          </div>

          {/* DIFFERENCE */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_4px_18px_rgba(30,70,58,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(30,70,58,0.08)]">

            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#FFF8E7]" />

            <div className="relative flex items-start justify-between">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-gray-400">
                  Selisih SO Terakhir
                </p>

                <p
                  className={`mt-2 text-[28px] font-bold tracking-tight ${
                    totalDifference === 0
                      ? "text-[#18352D]"
                      : totalDifference > 0
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {totalDifference > 0
                    ? "+"
                    : ""}
                  {formatNumber(
                    totalDifference
                  )}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Akumulasi selisih
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF8E7] text-[#9A751D]">
                <TrendingUp size={20} />
              </div>

            </div>

          </div>

        </div>

        {/* =================================================
            STOCK STATUS MINI CARDS
        ================================================= */}

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">

          {/* STOCK AMAN */}

          <button
            type="button"
            onClick={() =>
              setFilterStatus(
                filterStatus === "AMAN"
                  ? "ALL"
                  : "AMAN"
              )
            }
            className={`rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
              filterStatus === "AMAN"
                ? "border-emerald-300 ring-2 ring-emerald-100"
                : "border-[#DDE9E4]"
            }`}
          >

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={19} />
                </div>

                <div>

                  <p className="text-xs font-semibold text-gray-400">
                    Stock Aman
                  </p>

                  <p className="mt-0.5 text-xl font-bold text-[#18352D]">
                    {formatNumber(totalAman)}
                  </p>

                </div>

              </div>

              <ChevronRight
                size={16}
                className="text-gray-300"
              />

            </div>

          </button>

          {/* STOCK MINIMUM */}

          <button
            type="button"
            onClick={() =>
              setFilterStatus(
                filterStatus === "MINIMUM"
                  ? "ALL"
                  : "MINIMUM"
              )
            }
            className={`rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
              filterStatus === "MINIMUM"
                ? "border-amber-300 ring-2 ring-amber-100"
                : "border-[#DDE9E4]"
            }`}
          >

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <AlertTriangle size={19} />
                </div>

                <div>

                  <p className="text-xs font-semibold text-gray-400">
                    Stock Minimum
                  </p>

                  <p className="mt-0.5 text-xl font-bold text-[#18352D]">
                    {formatNumber(totalMinimum)}
                  </p>

                </div>

              </div>

              <ChevronRight
                size={16}
                className="text-gray-300"
              />

            </div>

          </button>

          {/* STOCK HABIS */}

          <button
            type="button"
            onClick={() =>
              setFilterStatus(
                filterStatus === "HABIS"
                  ? "ALL"
                  : "HABIS"
              )
            }
            className={`rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
              filterStatus === "HABIS"
                ? "border-red-300 ring-2 ring-red-100"
                : "border-[#DDE9E4]"
            }`}
          >

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <PackageX size={19} />
                </div>

                <div>

                  <p className="text-xs font-semibold text-gray-400">
                    Stock Habis
                  </p>

                  <p className="mt-0.5 text-xl font-bold text-[#18352D]">
                    {formatNumber(totalHabis)}
                  </p>

                </div>

              </div>

              <ChevronRight
                size={16}
                className="text-gray-300"
              />

            </div>

          </button>

        </div>

        {/* =================================================
            FILTER PANEL
        ================================================= */}

        <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_4px_18px_rgba(30,70,58,0.04)]">

          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">

            <div className="flex-1">

              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Cari Barang
              </label>

              <div className="relative">

                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  placeholder="Cari kode, barcode, atau nama barang..."
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] pl-10 pr-10 text-sm text-[#18352D] outline-none transition placeholder:text-gray-400 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X size={15} />
                  </button>
                )}

              </div>

            </div>

            <div className="xl:w-[330px]">

              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Filter Status
              </label>

              <div className="flex rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] p-1">

                {(
                  [
                    ["ALL", "Semua"],
                    ["AMAN", "Aman"],
                    ["MINIMUM", "Minimum"],
                    ["HABIS", "Habis"],
                  ] as [
                    FilterStatus,
                    string
                  ][]
                ).map(
                  ([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setFilterStatus(
                          value
                        )
                      }
                      className={`flex-1 rounded-lg px-2 py-2 text-[11px] font-bold transition ${
                        filterStatus ===
                        value
                          ? "bg-[#497F70] text-white shadow-sm"
                          : "text-gray-500 hover:bg-white hover:text-[#497F70]"
                      }`}
                    >
                      {label}
                    </button>
                  )
                )}

              </div>

            </div>

          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#EEF2F0] pt-4">

            <span className="text-xs text-gray-400">
              Menampilkan
            </span>

            <span className="rounded-full bg-[#EAF3EF] px-3 py-1 text-[11px] font-bold text-[#497F70]">
              {formatNumber(
                filteredData.length
              )}{" "}
              barang
            </span>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-500">
              Gudang Pusat
            </span>

            {filterStatus !== "ALL" && (
              <span className="rounded-full bg-[#F5F8F6] px-3 py-1 text-[11px] font-semibold text-gray-600">
                Status: {filterStatus}
              </span>
            )}

            {search && (
              <span className="rounded-full bg-[#F5F8F6] px-3 py-1 text-[11px] font-medium text-gray-500">
                Pencarian: "{search}"
              </span>
            )}

          </div>

        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-[0_4px_18px_rgba(30,70,58,0.04)]">

          <div className="flex flex-col gap-3 border-b border-[#E5ECE9] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">

            <div>

              <div className="flex items-center gap-2">

                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                  <Warehouse size={16} />
                </div>

                <h2 className="font-bold text-[#18352D]">
                  Persediaan Gudang Pusat
                </h2>

              </div>

              <p className="mt-1.5 text-xs text-gray-400">
                Stock sistem, stock opname terakhir,
                dan status persediaan.
              </p>

            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[#DDE9E4] bg-[#FAFCFB] px-3 py-2">

              <LockKeyhole
                size={14}
                className="text-[#497F70]"
              />

              <span className="text-[11px] font-bold text-gray-500">
                Stock Terkunci
              </span>

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="min-w-[1450px] w-full text-sm">

              <thead className="bg-[#F7F9F8]">

                <tr className="border-b border-[#E5ECE9]">

                  <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    No
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Barang
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Stock Sistem
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    SO Terakhir
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Fisik
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Selisih
                  </th>

                  <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Status SO
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Minimum
                  </th>

                  <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Status Stock
                  </th>

                  <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    History
                  </th>

                </tr>

              </thead>

              <tbody>

                {loading ? (

                  <tr>

                    <td
                      colSpan={10}
                      className="px-5 py-16 text-center"
                    >

                      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3EF]">

                        <RefreshCw
                          size={23}
                          className="animate-spin text-[#497F70]"
                        />

                      </div>

                      <p className="font-semibold text-gray-500">
                        Memuat stock pusat...
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Mengambil data persediaan
                        terbaru.
                      </p>

                    </td>

                  </tr>

                ) : filteredData.length === 0 ? (

                  <tr>

                    <td
                      colSpan={10}
                      className="px-5 py-16 text-center"
                    >

                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-300">
                        <Package size={27} />
                      </div>

                      <p className="font-semibold text-gray-500">
                        Tidak ada data ditemukan
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Coba ubah pencarian atau
                        filter status.
                      </p>

                      {(search ||
                        filterStatus !==
                          "ALL") && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setFilterStatus(
                              "ALL"
                            );
                          }}
                          className="mt-4 rounded-lg border border-[#CFE1D9] bg-white px-3 py-2 text-xs font-bold text-[#497F70] hover:bg-[#EAF3EF]"
                        >
                          Reset Filter
                        </button>
                      )}

                    </td>

                  </tr>

                ) : (

                  filteredData.map(
                    (item, index) => {

                      const stockStatus =
                        getStatus(
                          Number(
                            item.stock
                          ),
                          Number(
                            item.minimumStock
                          )
                        );

                      const StatusIcon =
                        stockStatus.icon;

                      const lastOpname =
                        item.lastOpname;

                      const difference =
                        Number(
                          lastOpname
                            ?.difference || 0
                        );

                      const opnameStatus =
                        getOpnameStatus(
                          lastOpname?.status
                        );

                      return (
                        <tr
                          key={item.id}
                          className="group border-b border-[#EDF2EF] transition hover:bg-[#FBFDFC]"
                        >

                          {/* NO */}

                          <td className="px-5 py-4 text-xs font-medium text-gray-400">
                            {String(
                              index + 1
                            ).padStart(2, "0")}
                          </td>

                          {/* BARANG */}

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-3">

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F6F3] text-[#497F70] transition group-hover:bg-[#E4F0EB]">
                                <Package
                                  size={18}
                                />
                              </div>

                              <div className="min-w-0">

                                <div className="font-bold text-[#18352D]">
                                  {item.barang
                                    ?.name ||
                                    "-"}
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-2">

                                  <span className="font-mono text-[11px] font-semibold text-[#497F70]">
                                    {item.barang
                                      ?.code ||
                                      "-"}
                                  </span>

                                  <span className="h-1 w-1 rounded-full bg-gray-300" />

                                  <span className="text-[11px] text-gray-400">
                                    {item.barang
                                      ?.unit ||
                                      "-"}
                                  </span>

                                </div>

                                {item.barang
                                  ?.barcode && (
                                  <div className="mt-1 font-mono text-[10px] text-gray-400">
                                    BC:{" "}
                                    {
                                      item
                                        .barang
                                        .barcode
                                    }
                                  </div>
                                )}

                              </div>

                            </div>

                          </td>

                          {/* SYSTEM STOCK */}

                          <td className="px-5 py-4 text-right">

                            <div className="inline-flex items-center gap-2 rounded-xl bg-[#F7F9F8] px-3 py-2">

                              <LockKeyhole
                                size={12}
                                className="text-gray-400"
                              />

                              <span className="text-base font-bold text-[#18352D]">
                                {formatNumber(
                                  Number(
                                    item.stock
                                  )
                                )}
                              </span>

                            </div>

                          </td>

                          {/* SO */}

                          <td className="px-5 py-4">

                            {lastOpname ? (

                              <div>

                                <div className="flex items-center gap-2">

                                  <CalendarDays
                                    size={13}
                                    className="text-gray-400"
                                  />

                                  <span className="text-xs font-bold text-[#35564C]">
                                    {formatDate(
                                      lastOpname.date
                                    )}
                                  </span>

                                </div>

                                <div className="mt-1 font-mono text-[10px] text-gray-400">
                                  {
                                    lastOpname.code
                                  }
                                </div>

                              </div>

                            ) : (

                              <span className="inline-flex rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] font-medium text-gray-400">
                                Belum ada SO
                              </span>

                            )}

                          </td>

                          {/* FISIK */}

                          <td className="px-5 py-4 text-right">

                            {lastOpname ? (

                              <span className="font-bold text-[#18352D]">
                                {formatNumber(
                                  Number(
                                    lastOpname.physicalQty
                                  )
                                )}
                              </span>

                            ) : (

                              <span className="text-gray-300">
                                -
                              </span>

                            )}

                          </td>

                          {/* DIFFERENCE */}

                          <td className="px-5 py-4 text-right">

                            {!lastOpname ? (

                              <span className="text-gray-300">
                                -
                              </span>

                            ) : difference > 0 ? (

                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 font-bold text-emerald-700">

                                <ArrowUp
                                  size={13}
                                />

                                +
                                {formatNumber(
                                  difference
                                )}

                              </span>

                            ) : difference < 0 ? (

                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 font-bold text-red-700">

                                <ArrowDown
                                  size={13}
                                />

                                {formatNumber(
                                  difference
                                )}

                              </span>

                            ) : (

                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5 font-semibold text-gray-500">

                                <Minus
                                  size={13}
                                />

                                0

                              </span>

                            )}

                          </td>

                          {/* OPNAME STATUS */}

                          <td className="px-5 py-4 text-center">

                            {lastOpname ? (

                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${opnameStatus.className}`}
                              >
                                {
                                  opnameStatus.text
                                }
                              </span>

                            ) : (

                              <span className="text-xs text-gray-300">
                                -
                              </span>

                            )}

                          </td>

                          {/* MINIMUM */}

                          <td className="px-5 py-4 text-right">

                            <span className="font-semibold text-gray-600">
                              {formatNumber(
                                Number(
                                  item.minimumStock
                                )
                              )}
                            </span>

                          </td>

                          {/* STATUS STOCK */}

                          <td className="px-5 py-4 text-center">

                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold ${stockStatus.className}`}
                            >

                              <StatusIcon
                                size={12}
                              />

                              {
                                stockStatus.text
                              }

                            </span>

                          </td>

                          {/* HISTORY */}

                          <td className="px-5 py-4 text-center">

                            <button
                              type="button"
                              onClick={() =>
                                openHistory(
                                  item
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[#CFE1D9] bg-white px-3 py-2 text-[11px] font-bold text-[#497F70] shadow-sm transition hover:bg-[#EAF3EF] hover:shadow"
                            >

                              <History
                                size={13}
                              />

                              History

                            </button>

                          </td>

                        </tr>
                      );
                    }
                  )

                )}

              </tbody>

            </table>

          </div>

          {!loading &&
            filteredData.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-[#E5ECE9] bg-[#FAFCFB] px-5 py-3 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">

                <span>
                  Menampilkan{" "}
                  <strong className="text-gray-600">
                    {formatNumber(
                      filteredData.length
                    )}
                  </strong>{" "}
                  dari{" "}
                  <strong className="text-gray-600">
                    {formatNumber(
                      data.length
                    )}
                  </strong>{" "}
                  barang
                </span>

                <span className="flex items-center gap-1.5">
                  <LockKeyhole size={12} />
                  Data stock bersifat sistem
                </span>

              </div>
            )}

        </div>

      </div>

      {/* =================================================
          HISTORY MODAL
      ================================================= */}

      {selectedHistory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#10251F]/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeHistory();
            }
          }}
        >

          <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/50 bg-white shadow-[0_30px_80px_rgba(16,37,31,0.25)]">

            {/* MODAL HEADER */}

            <div className="border-b border-[#E5ECE9] bg-gradient-to-r from-white to-[#F7FAF8] px-6 py-5 md:px-7">

              <div className="flex items-start justify-between gap-4">

                <div className="flex min-w-0 items-start gap-4">

                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                    <History size={22} />
                  </div>

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <h2 className="text-lg font-bold text-[#18352D]">
                        History Stock
                      </h2>

                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CFE1D9] bg-white px-2.5 py-1 text-[10px] font-bold text-[#497F70]">

                        <LockKeyhole
                          size={11}
                        />

                        Read Only

                      </span>

                    </div>

                    <p className="mt-1 truncate text-sm font-medium text-gray-500">
                      {
                        selectedHistory
                          .barang
                          .name
                      }
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">

                      <span className="rounded-lg bg-[#EAF3EF] px-2.5 py-1 text-[10px] font-bold text-[#497F70]">
                        {
                          selectedHistory
                            .barang.code
                        }
                      </span>

                      <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-[10px] font-medium text-gray-500">
                        Satuan:{" "}
                        {
                          selectedHistory
                            .barang.unit
                        }
                      </span>

                      <span className="rounded-lg bg-[#FFF8E7] px-2.5 py-1 text-[10px] font-bold text-[#8A6A1E]">
                        Stock:{" "}
                        {formatNumber(
                          Number(
                            selectedHistory.stock
                          )
                        )}
                      </span>

                      <span className="rounded-lg bg-[#EAF3EF] px-2.5 py-1 text-[10px] font-bold text-[#497F70]">
                        Gudang Pusat
                      </span>

                    </div>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={closeHistory}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                >
                  <X size={19} />
                </button>

              </div>

            </div>

            {/* MODAL SUMMARY */}

            <div className="grid grid-cols-2 gap-3 border-b border-[#E5ECE9] bg-[#FAFCFB] p-5 md:grid-cols-4">

              <div className="rounded-2xl border border-[#DDE9E4] bg-white p-4">

                <div className="flex items-center justify-between">

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                    <History size={15} />
                  </div>

                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                    Transaksi
                  </span>

                </div>

                <p className="mt-3 text-xl font-bold text-[#18352D]">
                  {formatNumber(
                    historySummary.total
                  )}
                </p>

                <p className="mt-0.5 text-[10px] text-gray-400">
                  Total aktivitas
                </p>

              </div>

              <div className="rounded-2xl border border-[#DDE9E4] bg-white p-4">

                <div className="flex items-center justify-between">

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <ArrowDownCircle
                      size={15}
                    />
                  </div>

                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                    Masuk
                  </span>

                </div>

                <p className="mt-3 text-xl font-bold text-emerald-700">
                  +
                  {formatNumber(
                    historySummary.stockIn
                  )}
                </p>

                <p className="mt-0.5 text-[10px] text-gray-400">
                  Stock masuk
                </p>

              </div>

              <div className="rounded-2xl border border-[#DDE9E4] bg-white p-4">

                <div className="flex items-center justify-between">

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
                    <ArrowUpCircle
                      size={15}
                    />
                  </div>

                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                    Keluar
                  </span>

                </div>

                <p className="mt-3 text-xl font-bold text-red-700">
                  -
                  {formatNumber(
                    historySummary.stockOut
                  )}
                </p>

                <p className="mt-0.5 text-[10px] text-gray-400">
                  Stock keluar
                </p>

              </div>

              <div className="rounded-2xl border border-[#DDE9E4] bg-white p-4">

                <div className="flex items-center justify-between">

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Info size={15} />
                  </div>

                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                    Informasi
                  </span>

                </div>

                <p className="mt-3 text-xl font-bold text-blue-700">
                  {formatNumber(
                    historySummary.informational
                  )}
                </p>

                <p className="mt-0.5 text-[10px] text-gray-400">
                  Aktivitas informasi
                </p>

              </div>

            </div>

            {/* MODAL BODY */}

            <div className="min-h-0 flex-1 overflow-y-auto bg-white p-5 md:p-6">

              {historyLoading ? (

                <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-[#DDE9E4] bg-[#FAFCFB]">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3EF]">

                    <RefreshCw
                      size={25}
                      className="animate-spin text-[#497F70]"
                    />

                  </div>

                  <p className="mt-4 font-semibold text-gray-500">
                    Memuat history transaksi...
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    Mengambil aktivitas stock barang.
                  </p>

                </div>

              ) : historyError ? (

                <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-red-400">
                    <Info size={26} />
                  </div>

                  <p className="mt-4 font-bold text-red-700">
                    Gagal mengambil history
                  </p>

                  <p className="mt-1 text-center text-sm text-red-600">
                    {historyError}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      openHistory(
                        selectedHistory
                      )
                    }
                    className="mt-5 rounded-xl bg-[#497F70] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#3D6D60]"
                  >
                    Coba Lagi
                  </button>

                </div>

              ) : historyData.length === 0 ? (

                <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#DDE9E4] bg-[#FAFCFB]">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-300">
                    <History size={27} />
                  </div>

                  <p className="mt-4 font-semibold text-gray-500">
                    Belum ada history transaksi
                  </p>

                  <p className="mt-1 text-center text-xs text-gray-400">
                    Barang ini belum memiliki
                    transaksi stock pusat.
                  </p>

                </div>

              ) : (

                <div className="overflow-hidden rounded-2xl border border-[#DDE9E4]">

                  <div className="overflow-x-auto">

                    <table className="min-w-[1250px] w-full text-sm">

                      <thead className="bg-[#F7F9F8]">

                        <tr className="border-b border-[#E5ECE9]">

                          <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            No
                          </th>

                          <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Waktu
                          </th>

                          <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Transaksi
                          </th>

                          <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            No. Transaksi
                          </th>

                          <th className="px-4 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Masuk
                          </th>

                          <th className="px-4 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Keluar
                          </th>

                          <th className="px-4 py-3.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Status
                          </th>

                          <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Keterangan
                          </th>

                        </tr>

                      </thead>

                      <tbody>

                        {historyData.map(
                          (
                            history,
                            index
                          ) => {

                            const type =
                              getHistoryType(
                                history.type
                              );

                            const isIn =
                              history.direction ===
                              "IN";

                            const isOut =
                              history.direction ===
                              "OUT";

                            return (
                              <tr
                                key={
                                  history.id
                                }
                                className="border-b border-[#EDF2EF] last:border-b-0 hover:bg-[#FBFDFC]"
                              >

                                <td className="px-4 py-4 text-xs font-medium text-gray-400">
                                  {String(
                                    index + 1
                                  ).padStart(
                                    2,
                                    "0"
                                  )}
                                </td>

                                <td className="px-4 py-4">

                                  <div className="flex items-start gap-2">

                                    <CalendarDays
                                      size={14}
                                      className="mt-0.5 text-gray-400"
                                    />

                                    <div>

                                      <div className="font-semibold text-[#18352D]">
                                        {formatDate(
                                          history.date
                                        )}
                                      </div>

                                      <div className="mt-0.5 text-[10px] text-gray-400">
                                        {
                                          formatDateTime(
                                            history.date
                                          ).split(
                                            ", "
                                          )[1]
                                        }
                                      </div>

                                    </div>

                                  </div>

                                </td>

                                <td className="px-4 py-4">

                                  <span
                                    className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${type.className}`}
                                  >
                                    {type.text}
                                  </span>

                                </td>

                                <td className="px-4 py-4">

                                  <span className="font-mono text-xs font-bold text-[#35564C]">
                                    {history.number ||
                                      "-"}
                                  </span>

                                </td>

                                <td className="px-4 py-4 text-right">

                                  {isIn ? (

                                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 font-bold text-emerald-700">

                                      <ArrowDownCircle
                                        size={13}
                                      />

                                      +
                                      {formatNumber(
                                        Number(
                                          history.qty
                                        )
                                      )}

                                    </span>

                                  ) : (

                                    <span className="text-gray-200">
                                      -
                                    </span>

                                  )}

                                </td>

                                <td className="px-4 py-4 text-right">

                                  {isOut ? (

                                    <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1.5 font-bold text-red-700">

                                      <ArrowUpCircle
                                        size={13}
                                      />

                                      -
                                      {formatNumber(
                                        Number(
                                          history.qty
                                        )
                                      )}

                                    </span>

                                  ) : (

                                    <span className="text-gray-200">
                                      -
                                    </span>

                                  )}

                                </td>

                                <td className="px-4 py-4 text-center">

                                  {history.status ? (

                                    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-600">
                                      {
                                        history.status
                                      }
                                    </span>

                                  ) : (

                                    <span className="text-gray-200">
                                      -
                                    </span>

                                  )}

                                </td>

                                <td className="px-4 py-4">

                                  <div className="max-w-[390px]">

                                    <p className="text-xs leading-5 text-gray-600">
                                      {
                                        history.description ||
                                        "-"
                                      }
                                    </p>

                                    {(history.stockBefore !==
                                      null ||
                                      history.stockAfter !==
                                        null) && (
                                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-gray-400">

                                        <span>
                                          Stock
                                        </span>

                                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-500">
                                          {history.stockBefore !==
                                          null
                                            ? formatNumber(
                                                Number(
                                                  history.stockBefore
                                                )
                                              )
                                            : "-"}
                                        </span>

                                        <ChevronRight
                                          size={11}
                                        />

                                        <span className="rounded-md bg-[#EAF3EF] px-1.5 py-0.5 font-semibold text-[#497F70]">
                                          {history.stockAfter !==
                                          null
                                            ? formatNumber(
                                                Number(
                                                  history.stockAfter
                                                )
                                              )
                                            : "-"}
                                        </span>

                                      </div>
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

                </div>

              )}

            </div>

            {/* MODAL FOOTER */}

            <div className="flex flex-col gap-3 border-t border-[#E5ECE9] bg-[#FAFCFB] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-center gap-2 text-xs text-gray-400">

                <LockKeyhole size={13} />

                <span>
                  History hanya untuk monitoring.
                </span>

              </div>

              <button
                type="button"
                onClick={closeHistory}
                className="rounded-xl bg-[#497F70] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#3D6D60]"
              >
                Tutup
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}