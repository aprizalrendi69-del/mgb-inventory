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
  AlertTriangle,
  CheckCircle2,
  PackageX,
  ChevronRight,
  Activity,
  Boxes,
  TrendingUp,
  ShieldCheck,
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
    baseUnit?: string | null;
    conversion?: number | null;
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
  baseUnit?: string | null;
  conversion?: number | null;
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
  // SATUAN / KONVERSI
  // =====================================================

  function getConversion(item: Stock) {
    const conversion = Number(
      item.barang?.conversion ?? 1
    );

    if (
      !Number.isFinite(conversion) ||
      conversion <= 0
    ) {
      return 1;
    }

    return conversion;
  }

  function getTransactionStock(item: Stock) {
    return Number(item.stock || 0);
  }

  function getBaseStock(item: Stock) {
    const stock =
      getTransactionStock(item);

    const conversion =
      getConversion(item);

    return stock * conversion;
  }

  function getMinimumStock(item: Stock) {
    return Number(
      item.minimumStock || 0
    );
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

      const unit =
        item.barang?.unit
          ?.toLowerCase() || "";

      const baseUnit =
        item.barang?.baseUnit
          ?.toLowerCase() || "";

      const matchesSearch =
        !keyword ||
        code.includes(keyword) ||
        name.includes(keyword) ||
        barcode.includes(keyword) ||
        unit.includes(keyword) ||
        baseUnit.includes(keyword);

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

  function getHistoryType(type: string) {
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

  function getOpnameStatus(status?: string) {
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
  // FORMAT
  // =====================================================

  function formatNumber(value: number) {
    return Number(value ?? 0).toLocaleString(
      "id-ID"
    );
  }

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
        getTransactionStock(item),
      0
    );
  }, [filteredData]);

  const totalBaseStock = useMemo(() => {
    return filteredData.reduce(
      (total, item) =>
        total +
        getBaseStock(item),
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
    <div className="min-h-full bg-[#F3F7F5]">

      {/* =================================================
          PREMIUM PAGE HEADER
      ================================================= */}

      <section className="relative overflow-hidden border-b border-[#D9E7E1] bg-[#08231C]">

        {/* Ambient glow */}

        <div className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-emerald-400/[0.10] blur-[90px]" />

        <div className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-teal-300/[0.08] blur-[100px]" />

        <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-96 rounded-full bg-emerald-300/[0.04] blur-[80px]" />

        <div className="relative px-6 py-7 md:px-8 md:py-8">

          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

            <div className="flex items-start gap-4">

              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-emerald-300/[0.15] bg-emerald-400/[0.08] text-emerald-300 shadow-[0_12px_40px_rgba(16,185,129,0.10)]">

                <Warehouse
                  size={28}
                  strokeWidth={1.7}
                />

                <div className="absolute -right-5 -top-5 h-14 w-14 rounded-full bg-emerald-300/[0.07]" />

                <div className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" />

              </div>

              <div className="min-w-0">

                <div className="flex flex-wrap items-center gap-2.5">

                  <h1 className="text-[27px] font-bold tracking-[-0.035em] text-white md:text-[32px]">
                    Stock Pusat
                  </h1>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/[0.14] bg-emerald-300/[0.07] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-300">

                    <span className="relative flex h-1.5 w-1.5">

                      <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-40" />

                      <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />

                    </span>

                    Live System

                  </span>

                </div>

                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-400">
                  Monitoring persediaan gudang pusat,
                  stock opname, dan seluruh riwayat
                  pergerakan barang.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">

                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-semibold text-slate-300">

                    <Warehouse size={12} />

                    Gudang Pusat

                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/[0.10] bg-emerald-300/[0.05] px-2.5 py-1.5 text-[10px] font-semibold text-emerald-300">

                    <LockKeyhole size={12} />

                    Read Only

                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-semibold text-slate-400">

                    <Activity size={12} />

                    Monitoring Aktif

                  </span>

                </div>

              </div>

            </div>

            <button
              type="button"
              onClick={loadStock}
              disabled={loading}
              className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300/[0.14] bg-emerald-300/[0.09] px-5 text-sm font-bold text-emerald-200 shadow-[0_8px_30px_rgba(16,185,129,0.08)] transition-all hover:-translate-y-0.5 hover:border-emerald-300/[0.22] hover:bg-emerald-300/[0.14] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >

              <RefreshCw
                size={16}
                className={`transition-transform ${
                  loading
                    ? "animate-spin"
                    : "group-hover:rotate-180"
                }`}
              />

              {loading
                ? "Memuat..."
                : "Refresh Data"}

            </button>

          </div>

        </div>

        {/* Bottom line */}

        <div className="relative h-px bg-gradient-to-r from-transparent via-emerald-300/[0.16] to-transparent" />

      </section>

      {/* =================================================
          CONTENT
      ================================================= */}

      <div className="px-6 py-6 md:px-8 md:py-7">

        {/* =================================================
            CONTROL / SECURITY BANNER
        ================================================= */}

        <div className="mb-6 overflow-hidden rounded-2xl border border-[#CFE1D9] bg-white shadow-[0_5px_25px_rgba(30,70,58,0.04)]">

          <div className="relative flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:px-6">

            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-400 to-teal-500" />

            <div className="flex items-start gap-3">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#497F70]">

                <ShieldCheck
                  size={20}
                />

              </div>

              <div>

                <div className="flex flex-wrap items-center gap-2">

                  <p className="text-sm font-bold text-[#285346]">
                    Stock pusat terkunci
                  </p>

                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-600">
                    Protected
                  </span>

                </div>

                <p className="mt-1 max-w-4xl text-xs leading-5 text-[#56766B]">
                  Nilai stock pada halaman ini
                  merupakan stock sistem dan tidak
                  dapat diubah secara manual.
                  Stock opname hanya digunakan sebagai
                  kontrol dan pembanding kondisi fisik
                  gudang.
                </p>

              </div>

            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-[#DCE7E2] bg-[#FAFCFB] px-3.5 py-2.5">

              <span className="relative flex h-2 w-2">

                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-40" />

                <span className="relative h-2 w-2 rounded-full bg-emerald-500" />

              </span>

              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Sistem Aktif
              </span>

            </div>

          </div>

        </div>

        {/* =================================================
            CONVERSION INFORMATION
        ================================================= */}

        <div className="mb-6 overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50 via-white to-[#F8FBFF] shadow-[0_5px_25px_rgba(30,80,130,0.03)]">

          <div className="relative p-5 md:p-6">

            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-100/50 blur-3xl" />

            <div className="relative flex items-start gap-3">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">

                <Boxes size={20} />

              </div>

              <div className="min-w-0">

                <div className="flex flex-wrap items-center gap-2">

                  <p className="text-sm font-bold text-blue-800">
                    Tampilan Stock Dasar
                  </p>

                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-blue-600">
                    Monitoring
                  </span>

                </div>

                <p className="mt-1 max-w-4xl text-xs leading-5 text-blue-700/75">
                  Stock transaksi tetap menggunakan
                  satuan utama barang. Stock dasar
                  hanya merupakan hasil perhitungan
                  monitoring berdasarkan konversi
                  satuan. Transaksi PO, Receive,
                  Barang Keluar, Transfer, dan Stock
                  Opname tidak dikonversi.
                </p>

                <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-white/80 px-3 py-2 text-[10px] font-semibold text-blue-700 shadow-sm">

                  <span>
                    Stock Dasar
                  </span>

                  <span className="text-blue-300">
                    =
                  </span>

                  <span className="rounded-lg bg-blue-50 px-2 py-1">
                    Stock Transaksi
                  </span>

                  <span className="text-blue-300">
                    ×
                  </span>

                  <span className="rounded-lg bg-blue-50 px-2 py-1">
                    Konversi
                  </span>

                </div>

              </div>

            </div>

          </div>

        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-red-200 bg-red-50 shadow-sm">

            <div className="flex items-start gap-3 px-5 py-4">

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-red-500 shadow-sm">

                <Info size={17} />

              </div>

              <div>

                <p className="text-sm font-bold text-red-700">
                  Gagal memuat stock pusat
                </p>

                <p className="mt-1 text-xs leading-5 text-red-600">
                  {error}
                </p>

              </div>

            </div>

          </div>
        )}

        {/* =================================================
            KPI
        ================================================= */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* TOTAL ITEM */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_5px_22px_rgba(30,70,58,0.045)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_35px_rgba(30,70,58,0.09)]">

            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-emerald-50/80 blur-2xl transition-transform duration-500 group-hover:scale-125" />

            <div className="absolute left-0 top-0 h-1 w-12 rounded-br-full bg-[#497F70]" />

            <div className="relative flex items-start justify-between">

              <div>

                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-gray-400">
                  Jenis Barang
                </p>

                <p className="mt-2 text-[29px] font-bold tracking-[-0.03em] text-[#18352D]">
                  {formatNumber(
                    filteredData.length
                  )}
                </p>

                <p className="mt-1 text-[10px] text-gray-400">
                  Barang terdaftar di pusat
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70] transition-transform duration-300 group-hover:scale-105">

                <Package size={20} />

              </div>

            </div>

          </div>

          {/* TOTAL STOCK */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_5px_22px_rgba(30,70,58,0.045)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_35px_rgba(30,70,58,0.09)]">

            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-teal-50/80 blur-2xl transition-transform duration-500 group-hover:scale-125" />

            <div className="absolute left-0 top-0 h-1 w-12 rounded-br-full bg-teal-500" />

            <div className="relative flex items-start justify-between">

              <div>

                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-gray-400">
                  Total Stock Transaksi
                </p>

                <p className="mt-2 text-[29px] font-bold tracking-[-0.03em] text-[#18352D]">
                  {formatNumber(totalStock)}
                </p>

                <p className="mt-1 text-[10px] text-gray-400">
                  Akumulasi satuan transaksi
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF6F3] text-[#497F70] transition-transform duration-300 group-hover:scale-105">

                <Boxes size={20} />

              </div>

            </div>

          </div>

          {/* BASE STOCK */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_5px_22px_rgba(30,70,58,0.045)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_35px_rgba(30,70,58,0.09)]">

            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-blue-50/80 blur-2xl transition-transform duration-500 group-hover:scale-125" />

            <div className="absolute left-0 top-0 h-1 w-12 rounded-br-full bg-blue-500" />

            <div className="relative flex items-start justify-between">

              <div>

                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-gray-400">
                  Total Stock Dasar
                </p>

                <p className="mt-2 text-[29px] font-bold tracking-[-0.03em] text-[#18352D]">
                  {formatNumber(
                    totalBaseStock
                  )}
                </p>

                <p className="mt-1 text-[10px] text-gray-400">
                  Hasil konversi monitoring
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF5FB] text-blue-600 transition-transform duration-300 group-hover:scale-105">

                <TrendingUp size={20} />

              </div>

            </div>

          </div>

          {/* OPNAME */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_5px_22px_rgba(30,70,58,0.045)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_35px_rgba(30,70,58,0.09)]">

            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-purple-50/80 blur-2xl transition-transform duration-500 group-hover:scale-125" />

            <div className="absolute left-0 top-0 h-1 w-12 rounded-br-full bg-purple-500" />

            <div className="relative flex items-start justify-between">

              <div>

                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-gray-400">
                  Sudah Stock Opname
                </p>

                <p className="mt-2 text-[29px] font-bold tracking-[-0.03em] text-[#18352D]">
                  {formatNumber(
                    totalWithOpname
                  )}
                </p>

                <p className="mt-1 text-[10px] text-gray-400">
                  Dari {formatNumber(data.length)} jenis
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F2F0FA] text-purple-600 transition-transform duration-300 group-hover:scale-105">

                <ClipboardCheck size={20} />

              </div>

            </div>

          </div>

        </div>

        {/* =================================================
            STATUS OVERVIEW
        ================================================= */}

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">

          {/* AMAN */}

          <button
            type="button"
            onClick={() =>
              setFilterStatus(
                filterStatus === "AMAN"
                  ? "ALL"
                  : "AMAN"
              )
            }
            className={`group relative overflow-hidden rounded-2xl border bg-white p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
              filterStatus === "AMAN"
                ? "border-emerald-300 ring-2 ring-emerald-100"
                : "border-[#DDE9E4]"
            }`}
          >

            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-emerald-50 blur-2xl transition-transform group-hover:scale-125" />

            <div className="relative flex items-center justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">

                  <CheckCircle2 size={19} />

                </div>

                <div>

                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Stock Aman
                  </p>

                  <p className="mt-0.5 text-xl font-bold text-[#18352D]">
                    {formatNumber(totalAman)}
                  </p>

                </div>

              </div>

              <ChevronRight
                size={16}
                className="text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-emerald-500"
              />

            </div>

          </button>

          {/* MINIMUM */}

          <button
            type="button"
            onClick={() =>
              setFilterStatus(
                filterStatus === "MINIMUM"
                  ? "ALL"
                  : "MINIMUM"
              )
            }
            className={`group relative overflow-hidden rounded-2xl border bg-white p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
              filterStatus === "MINIMUM"
                ? "border-amber-300 ring-2 ring-amber-100"
                : "border-[#DDE9E4]"
            }`}
          >

            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-amber-50 blur-2xl transition-transform group-hover:scale-125" />

            <div className="relative flex items-center justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">

                  <AlertTriangle size={19} />

                </div>

                <div>

                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Stock Minimum
                  </p>

                  <p className="mt-0.5 text-xl font-bold text-[#18352D]">
                    {formatNumber(totalMinimum)}
                  </p>

                </div>

              </div>

              <ChevronRight
                size={16}
                className="text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-amber-500"
              />

            </div>

          </button>

          {/* HABIS */}

          <button
            type="button"
            onClick={() =>
              setFilterStatus(
                filterStatus === "HABIS"
                  ? "ALL"
                  : "HABIS"
              )
            }
            className={`group relative overflow-hidden rounded-2xl border bg-white p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
              filterStatus === "HABIS"
                ? "border-red-300 ring-2 ring-red-100"
                : "border-[#DDE9E4]"
            }`}
          >

            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-red-50 blur-2xl transition-transform group-hover:scale-125" />

            <div className="relative flex items-center justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">

                  <PackageX size={19} />

                </div>

                <div>

                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Stock Habis
                  </p>

                  <p className="mt-0.5 text-xl font-bold text-[#18352D]">
                    {formatNumber(totalHabis)}
                  </p>

                </div>

              </div>

              <ChevronRight
                size={16}
                className="text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-red-500"
              />

            </div>

          </button>

        </div>

        {/* =================================================
            FILTER PANEL
        ================================================= */}

        <div className="mb-6 overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-[0_5px_22px_rgba(30,70,58,0.045)]">

          <div className="p-5 md:p-6">

            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">

              <div className="flex-1">

                <label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.16em] text-gray-400">
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
                    className="h-11 w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] pl-10 pr-10 text-sm text-[#18352D] outline-none transition-all placeholder:text-gray-400 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() =>
                        setSearch("")
                      }
                      className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  )}

                </div>

              </div>

              <div className="xl:w-[360px]">

                <label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.16em] text-gray-400">
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
                        className={`flex-1 rounded-lg px-2 py-2 text-[10px] font-bold transition-all ${
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

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#EEF2F0] pt-4">

              <span className="text-[11px] text-gray-400">
                Menampilkan
              </span>

              <span className="rounded-full border border-[#DCEBE4] bg-[#EAF3EF] px-3 py-1 text-[10px] font-bold text-[#497F70]">
                {formatNumber(
                  filteredData.length
                )}{" "}
                barang
              </span>

              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[10px] font-medium text-gray-500">
                Gudang Pusat
              </span>

              {filterStatus !== "ALL" && (
                <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] font-semibold text-gray-600">
                  Status: {filterStatus}
                </span>
              )}

              {search && (
                <span className="max-w-full truncate rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] font-medium text-gray-500">
                  Pencarian: "{search}"
                </span>
              )}

              {(search ||
                filterStatus !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setFilterStatus(
                      "ALL"
                    );
                  }}
                  className="ml-auto rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-[#497F70] transition hover:bg-[#EAF3EF]"
                >
                  Reset Filter
                </button>
              )}

            </div>

          </div>

        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-[0_6px_25px_rgba(30,70,58,0.05)]">

          <div className="flex flex-col gap-3 border-b border-[#E5ECE9] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">

            <div>

              <div className="flex items-center gap-2.5">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">

                  <Warehouse size={17} />

                </div>

                <div>

                  <h2 className="font-bold tracking-[-0.01em] text-[#18352D]">
                    Persediaan Gudang Pusat
                  </h2>

                  <p className="mt-0.5 text-[10px] text-gray-400">
                    Monitoring stock sistem secara
                    real-time.
                  </p>

                </div>

              </div>

            </div>

            <div className="flex items-center gap-2 self-start rounded-xl border border-[#DDE9E4] bg-[#FAFCFB] px-3 py-2 md:self-auto">

              <LockKeyhole
                size={13}
                className="text-[#497F70]"
              />

              <span className="text-[10px] font-bold text-gray-500">
                Stock Terkunci
              </span>

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="min-w-[1600px] w-full text-sm">

              <thead className="sticky top-0 z-10 bg-[#F7F9F8]/95 backdrop-blur">

                <tr className="border-b border-[#E5ECE9]">

                  {[
                    ["No", "text-left"],
                    ["Barang", "text-left"],
                    ["Stock Transaksi", "text-right"],
                    ["Konversi", "text-right"],
                    ["Stock Dasar", "text-right"],
                    ["SO Terakhir", "text-left"],
                    ["Fisik", "text-right"],
                    ["Selisih", "text-right"],
                    ["Status SO", "text-center"],
                    ["Minimum", "text-right"],
                    ["Status Stock", "text-center"],
                    ["History", "text-center"],
                  ].map(
                    ([label, align]) => (
                      <th
                        key={label}
                        className={`px-5 py-4 ${align} text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400`}
                      >
                        {label}
                      </th>
                    )
                  )}

                </tr>

              </thead>

              <tbody>

                {loading ? (

                  <tr>

                    <td
                      colSpan={12}
                      className="px-5 py-20 text-center"
                    >

                      <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">

                        <div className="absolute inset-0 rounded-2xl bg-emerald-100 blur-xl" />

                        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

                          <RefreshCw
                            size={22}
                            className="animate-spin text-[#497F70]"
                          />

                        </div>

                      </div>

                      <p className="font-semibold text-[#35564C]">
                        Memuat stock pusat...
                      </p>

                      <p className="mt-1 text-[11px] text-gray-400">
                        Mengambil data persediaan
                        terbaru.
                      </p>

                    </td>

                  </tr>

                ) : filteredData.length === 0 ? (

                  <tr>

                    <td
                      colSpan={12}
                      className="px-5 py-20 text-center"
                    >

                      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 text-gray-300">

                        <Package size={28} />

                      </div>

                      <p className="font-semibold text-gray-500">
                        Tidak ada data ditemukan
                      </p>

                      <p className="mt-1 text-[11px] text-gray-400">
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
                          className="mt-5 rounded-xl border border-[#CFE1D9] bg-white px-4 py-2.5 text-[11px] font-bold text-[#497F70] shadow-sm transition hover:bg-[#EAF3EF]"
                        >
                          Reset Filter
                        </button>
                      )}

                    </td>

                  </tr>

                ) : (

                  filteredData.map(
                    (
                      item,
                      index
                    ) => {

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

                      const transactionStock =
                        getTransactionStock(
                          item
                        );

                      const conversion =
                        getConversion(
                          item
                        );

                      const baseStock =
                        getBaseStock(
                          item
                        );

                      const minimumStock =
                        getMinimumStock(
                          item
                        );

                      const transactionUnit =
                        item.barang
                          ?.unit ||
                        "-";

                      const baseUnit =
                        item.barang
                          ?.baseUnit ||
                        transactionUnit;

                      return (
                        <tr
                          key={item.id}
                          className="group border-b border-[#EDF2EF] transition-colors hover:bg-[#FBFDFC]"
                        >

                          {/* NO */}

                          <td className="px-5 py-4 text-xs font-medium text-gray-400">
                            {String(
                              index + 1
                            ).padStart(
                              2,
                              "0"
                            )}
                          </td>

                          {/* BARANG */}

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-3">

                              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F6F3] text-[#497F70] transition-all group-hover:bg-[#E4F0EB] group-hover:shadow-sm">

                                <Package
                                  size={18}
                                />

                                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-white bg-emerald-400" />

                              </div>

                              <div className="min-w-0">

                                <div className="font-bold text-[#18352D]">
                                  {item.barang
                                    ?.name ||
                                    "-"}
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-2">

                                  <span className="rounded-md bg-[#F0F6F3] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#497F70]">
                                    {item.barang
                                      ?.code ||
                                      "-"}
                                  </span>

                                  <span className="h-1 w-1 rounded-full bg-gray-300" />

                                  <span className="text-[10px] text-gray-400">
                                    {transactionUnit}
                                  </span>

                                  <span className="h-1 w-1 rounded-full bg-gray-300" />

                                  <span className="text-[10px] font-semibold text-blue-500">
                                    Dasar:{" "}
                                    {baseUnit}
                                  </span>

                                </div>

                                {item.barang
                                  ?.barcode && (
                                  <div className="mt-1 font-mono text-[9px] text-gray-400">
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

                          {/* TRANSACTION STOCK */}

                          <td className="px-5 py-4 text-right">

                            <div className="inline-flex min-w-[105px] flex-col items-end rounded-xl border border-[#E8EFEC] bg-[#F8FAF9] px-3 py-2">

                              <div className="flex items-center gap-2">

                                <LockKeyhole
                                  size={11}
                                  className="text-gray-400"
                                />

                                <span className="text-base font-bold text-[#18352D]">
                                  {formatNumber(
                                    transactionStock
                                  )}
                                </span>

                                <span className="text-[10px] font-bold text-[#497F70]">
                                  {transactionUnit}
                                </span>

                              </div>

                            </div>

                          </td>

                          {/* CONVERSION */}

                          <td className="px-5 py-4 text-right">

                            <div className="inline-flex flex-col items-end">

                              <span className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-700">
                                1{" "}
                                {transactionUnit}
                              </span>

                              <span className="mt-1 text-[9px] font-semibold text-gray-400">
                                ={" "}
                                {formatNumber(
                                  conversion
                                )}{" "}
                                {baseUnit}
                              </span>

                            </div>

                          </td>

                          {/* BASE STOCK */}

                          <td className="px-5 py-4 text-right">

                            <div className="inline-flex min-w-[105px] flex-col items-end rounded-xl border border-blue-100 bg-[#F4F8FC] px-3 py-2">

                              <span className="text-base font-bold text-blue-800">
                                {formatNumber(
                                  baseStock
                                )}
                              </span>

                              <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-500">
                                {baseUnit}
                              </span>

                            </div>

                          </td>

                          {/* SO */}

                          <td className="px-5 py-4">

                            {lastOpname ? (

                              <div>

                                <div className="flex items-center gap-2">

                                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-50">

                                    <CalendarDays
                                      size={12}
                                      className="text-purple-500"
                                    />

                                  </div>

                                  <span className="text-xs font-bold text-[#35564C]">
                                    {formatDate(
                                      lastOpname.date
                                    )}
                                  </span>

                                </div>

                                <div className="mt-1 font-mono text-[9px] text-gray-400">
                                  {
                                    lastOpname.code
                                  }
                                </div>

                              </div>

                            ) : (

                              <span className="inline-flex rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[10px] font-medium text-gray-400">
                                Belum ada SO
                              </span>

                            )}

                          </td>

                          {/* FISIK */}

                          <td className="px-5 py-4 text-right">

                            {lastOpname ? (

                              <div className="inline-flex flex-col items-end">

                                <span className="font-bold text-[#18352D]">
                                  {formatNumber(
                                    Number(
                                      lastOpname.physicalQty
                                    )
                                  )}
                                </span>

                                <span className="text-[9px] text-gray-400">
                                  {transactionUnit}
                                </span>

                              </div>

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

                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 font-bold text-emerald-700">

                                <ArrowUp
                                  size={12}
                                />

                                +
                                {formatNumber(
                                  difference
                                )}{" "}
                                {transactionUnit}

                              </span>

                            ) : difference < 0 ? (

                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 font-bold text-red-700">

                                <ArrowDown
                                  size={12}
                                />

                                {formatNumber(
                                  difference
                                )}{" "}
                                {transactionUnit}

                              </span>

                            ) : (

                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-semibold text-gray-500">

                                <Minus
                                  size={12}
                                />

                                0{" "}
                                {transactionUnit}

                              </span>

                            )}

                          </td>

                          {/* OPNAME STATUS */}

                          <td className="px-5 py-4 text-center">

                            {lastOpname ? (

                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold ${opnameStatus.className}`}
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

                            <div className="inline-flex flex-col items-end">

                              <span className="font-semibold text-gray-600">
                                {formatNumber(
                                  minimumStock
                                )}
                              </span>

                              <span className="text-[9px] text-gray-400">
                                {transactionUnit}
                              </span>

                            </div>

                          </td>

                          {/* STATUS */}

                          <td className="px-5 py-4 text-center">

                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9px] font-bold ${stockStatus.className}`}
                            >

                              <StatusIcon
                                size={11}
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
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[#CFE1D9] bg-white px-3 py-2 text-[10px] font-bold text-[#497F70] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#EAF3EF] hover:shadow-md"
                            >

                              <History
                                size={12}
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
              <div className="flex flex-col gap-2 border-t border-[#E5ECE9] bg-[#FAFCFB] px-5 py-3.5 text-[10px] text-gray-400 sm:flex-row sm:items-center sm:justify-between md:px-6">

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

                  <LockKeyhole size={11} />

                  Stock transaksi tidak dikonversi

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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#081C16]/65 p-3 backdrop-blur-md md:p-5"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeHistory();
            }
          }}
        >

          <div className="flex max-h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-[26px] border border-white/60 bg-white shadow-[0_35px_100px_rgba(8,28,22,0.30)]">

            {/* MODAL HEADER */}

            <div className="relative overflow-hidden border-b border-[#E5ECE9] bg-gradient-to-br from-[#F9FCFA] via-white to-[#F3F8F5] px-5 py-5 md:px-7 md:py-6">

              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-100/70 blur-3xl" />

              <div className="relative flex items-start justify-between gap-4">

                <div className="flex min-w-0 items-start gap-4">

                  <div className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70] shadow-sm">

                    <History size={22} />

                    <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500">

                      <LockKeyhole
                        size={8}
                        className="text-white"
                      />

                    </span>

                  </div>

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <h2 className="text-lg font-bold tracking-[-0.02em] text-[#18352D]">
                        History Stock
                      </h2>

                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CFE1D9] bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#497F70] shadow-sm">

                        <LockKeyhole
                          size={10}
                        />

                        Read Only

                      </span>

                    </div>

                    <p className="mt-1 truncate text-sm font-semibold text-gray-500">
                      {
                        selectedHistory
                          .barang
                          .name
                      }
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1.5">

                      <span className="rounded-lg bg-[#EAF3EF] px-2.5 py-1 text-[9px] font-bold text-[#497F70]">
                        {
                          selectedHistory
                            .barang.code
                        }
                      </span>

                      <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-[9px] font-medium text-gray-500">
                        Satuan:{" "}
                        {
                          selectedHistory
                            .barang.unit
                        }
                      </span>

                      {selectedHistory
                        .barang
                        ?.baseUnit && (
                        <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[9px] font-bold text-blue-700">
                          Dasar:{" "}
                          {
                            selectedHistory
                              .barang
                              .baseUnit
                          }
                        </span>
                      )}

                      {selectedHistory
                        .barang
                        ?.conversion &&
                        Number(
                          selectedHistory
                            .barang
                            .conversion
                        ) > 0 && (
                          <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[9px] font-bold text-indigo-700">
                            1{" "}
                            {
                              selectedHistory
                                .barang
                                .unit
                            }{" "}
                            ={" "}
                            {formatNumber(
                              Number(
                                selectedHistory
                                  .barang
                                  .conversion
                              )
                            )}{" "}
                            {
                              selectedHistory
                                .barang
                                .baseUnit ||
                              selectedHistory
                                .barang
                                .unit
                            }
                          </span>
                        )}

                      <span className="rounded-lg bg-[#FFF8E7] px-2.5 py-1 text-[9px] font-bold text-[#8A6A1E]">
                        Stock:{" "}
                        {formatNumber(
                          Number(
                            selectedHistory.stock
                          )
                        )}{" "}
                        {
                          selectedHistory
                            .barang
                            .unit
                        }
                      </span>

                      <span className="rounded-lg bg-[#EAF3EF] px-2.5 py-1 text-[9px] font-bold text-[#497F70]">
                        Gudang Pusat
                      </span>

                    </div>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={closeHistory}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-transparent text-gray-400 transition-all hover:border-gray-200 hover:bg-white hover:text-gray-600 hover:shadow-sm"
                >
                  <X size={18} />
                </button>

              </div>

            </div>

            {/* MODAL SUMMARY */}

            <div className="grid grid-cols-2 gap-3 border-b border-[#E5ECE9] bg-[#FAFCFB] p-4 md:grid-cols-4 md:p-5">

              {/* TRANSAKSI */}

              <div className="group rounded-2xl border border-[#DDE9E4] bg-white p-4 shadow-[0_3px_15px_rgba(30,70,58,0.03)] transition hover:shadow-md">

                <div className="flex items-center justify-between">

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">

                    <History size={14} />

                  </div>

                  <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-gray-400">
                    Transaksi
                  </span>

                </div>

                <p className="mt-3 text-xl font-bold text-[#18352D]">
                  {formatNumber(
                    historySummary.total
                  )}
                </p>

                <p className="mt-0.5 text-[9px] text-gray-400">
                  Total aktivitas
                </p>

              </div>

              {/* MASUK */}

              <div className="group rounded-2xl border border-[#DDE9E4] bg-white p-4 shadow-[0_3px_15px_rgba(30,70,58,0.03)] transition hover:shadow-md">

                <div className="flex items-center justify-between">

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">

                    <ArrowDownCircle
                      size={14}
                    />

                  </div>

                  <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-gray-400">
                    Masuk
                  </span>

                </div>

                <p className="mt-3 text-xl font-bold text-emerald-700">
                  +
                  {formatNumber(
                    historySummary.stockIn
                  )}
                </p>

                <p className="mt-0.5 text-[9px] text-gray-400">
                  Stock masuk
                </p>

              </div>

              {/* KELUAR */}

              <div className="group rounded-2xl border border-[#DDE9E4] bg-white p-4 shadow-[0_3px_15px_rgba(30,70,58,0.03)] transition hover:shadow-md">

                <div className="flex items-center justify-between">

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">

                    <ArrowUpCircle
                      size={14}
                    />

                  </div>

                  <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-gray-400">
                    Keluar
                  </span>

                </div>

                <p className="mt-3 text-xl font-bold text-red-700">
                  -
                  {formatNumber(
                    historySummary.stockOut
                  )}
                </p>

                <p className="mt-0.5 text-[9px] text-gray-400">
                  Stock keluar
                </p>

              </div>

              {/* INFO */}

              <div className="group rounded-2xl border border-[#DDE9E4] bg-white p-4 shadow-[0_3px_15px_rgba(30,70,58,0.03)] transition hover:shadow-md">

                <div className="flex items-center justify-between">

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">

                    <Info size={14} />

                  </div>

                  <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-gray-400">
                    Informasi
                  </span>

                </div>

                <p className="mt-3 text-xl font-bold text-blue-700">
                  {formatNumber(
                    historySummary.informational
                  )}
                </p>

                <p className="mt-0.5 text-[9px] text-gray-400">
                  Aktivitas informasi
                </p>

              </div>

            </div>

            {/* MODAL BODY */}

            <div className="min-h-0 flex-1 overflow-y-auto bg-white p-4 md:p-6">

              {historyLoading ? (

                <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-[#DDE9E4] bg-[#FAFCFB]">

                  <div className="relative flex h-16 w-16 items-center justify-center">

                    <div className="absolute inset-0 rounded-2xl bg-emerald-100 blur-xl" />

                    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

                      <RefreshCw
                        size={24}
                        className="animate-spin text-[#497F70]"
                      />

                    </div>

                  </div>

                  <p className="mt-5 font-semibold text-gray-500">
                    Memuat history transaksi...
                  </p>

                  <p className="mt-1 text-[10px] text-gray-400">
                    Mengambil aktivitas stock barang.
                  </p>

                </div>

              ) : historyError ? (

                <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-red-400 shadow-sm">

                    <Info size={25} />

                  </div>

                  <p className="mt-4 font-bold text-red-700">
                    Gagal mengambil history
                  </p>

                  <p className="mt-1 max-w-md text-center text-xs leading-5 text-red-600">
                    {historyError}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      openHistory(
                        selectedHistory
                      )
                    }
                    className="mt-5 rounded-xl bg-[#497F70] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#3D6D60] hover:shadow-md"
                  >
                    Coba Lagi
                  </button>

                </div>

              ) : historyData.length === 0 ? (

                <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#DDE9E4] bg-[#FAFCFB]">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-300">

                    <History size={27} />

                  </div>

                  <p className="mt-4 font-semibold text-gray-500">
                    Belum ada history transaksi
                  </p>

                  <p className="mt-1 max-w-md text-center text-[10px] leading-5 text-gray-400">
                    Barang ini belum memiliki
                    transaksi stock pusat.
                  </p>

                </div>

              ) : (

                <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] shadow-sm">

                  <div className="overflow-x-auto">

                    <table className="min-w-[1250px] w-full text-sm">

                      <thead className="sticky top-0 z-10 bg-[#F7F9F8]/95 backdrop-blur">

                        <tr className="border-b border-[#E5ECE9]">

                          <th className="px-4 py-3.5 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400">
                            No
                          </th>

                          <th className="px-4 py-3.5 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400">
                            Waktu
                          </th>

                          <th className="px-4 py-3.5 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400">
                            Transaksi
                          </th>

                          <th className="px-4 py-3.5 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400">
                            No. Transaksi
                          </th>

                          <th className="px-4 py-3.5 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400">
                            Masuk
                          </th>

                          <th className="px-4 py-3.5 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400">
                            Keluar
                          </th>

                          <th className="px-4 py-3.5 text-center text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400">
                            Status
                          </th>

                          <th className="px-4 py-3.5 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400">
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
                                className="border-b border-[#EDF2EF] transition last:border-b-0 hover:bg-[#FBFDFC]"
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

                                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gray-50">

                                      <CalendarDays
                                        size={12}
                                        className="text-gray-400"
                                      />

                                    </div>

                                    <div>

                                      <div className="font-semibold text-[#18352D]">
                                        {formatDate(
                                          history.date
                                        )}
                                      </div>

                                      <div className="mt-0.5 text-[9px] text-gray-400">
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
                                    className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold ${type.className}`}
                                  >
                                    {type.text}
                                  </span>

                                </td>

                                <td className="px-4 py-4">

                                  <span className="rounded-md bg-gray-50 px-2 py-1 font-mono text-[10px] font-bold text-[#35564C]">
                                    {history.number ||
                                      "-"}
                                  </span>

                                </td>

                                <td className="px-4 py-4 text-right">

                                  {isIn ? (

                                    <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-[10px] font-bold text-emerald-700">

                                      <ArrowDownCircle
                                        size={12}
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

                                    <span className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2 py-1.5 text-[10px] font-bold text-red-700">

                                      <ArrowUpCircle
                                        size={12}
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

                                    <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[9px] font-bold text-gray-600">
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

                                    <p className="text-[10px] leading-5 text-gray-600">
                                      {
                                        history.description ||
                                        "-"
                                      }
                                    </p>

                                    {(history.stockBefore !==
                                      null ||
                                      history.stockAfter !==
                                        null) && (
                                      <div className="mt-2 flex items-center gap-2 text-[9px] text-gray-400">

                                        <span>
                                          Stock
                                        </span>

                                        <span className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-semibold text-gray-500">
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
                                          size={10}
                                        />

                                        <span className="rounded-md border border-[#DCEBE4] bg-[#EAF3EF] px-1.5 py-0.5 font-semibold text-[#497F70]">
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

            <div className="flex flex-col gap-3 border-t border-[#E5ECE9] bg-[#FAFCFB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">

              <div className="flex items-center gap-2 text-[10px] text-gray-400">

                <LockKeyhole size={12} />

                <span>
                  History hanya untuk monitoring.
                </span>

              </div>

              <button
                type="button"
                onClick={closeHistory}
                className="rounded-xl bg-[#497F70] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#3D6D60] hover:shadow-md"
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