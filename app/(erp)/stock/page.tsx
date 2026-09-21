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
  FileText,
  ReceiptText,
  CircleDot,
  DollarSign,
  Calculator,
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

type MasterHarga = {
  id?: number;
  barangId: number;
  supplierId?: number | null;
  hargaLama?: number | null;
  hargaBaru?: number | null;
  selisihHarga?: number | null;
  persenNaik?: number | null;
  persen?: number | null;
  qty?: number | null;
  total?: number | null;
  akumulasi?: number | null;
  status?: string | null;
  receiveDate?: string | null;
  createdAt?: string | null;

  barang?: {
    id?: number;
    code?: string;
    name?: string;
  } | null;

  supplier?: {
    id?: number;
    name?: string;
  } | null;
};

type MasterHargaResponse = {
  success: boolean;
  data: MasterHarga[];
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
  const [priceData, setPriceData] = useState<MasterHarga[]>([]);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] =
    useState<FilterStatus>("ALL");

  const [loading, setLoading] = useState(true);
  const [priceLoading, setPriceLoading] = useState(true);
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

  const [historyError, setHistoryError] = useState("");

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

      const result: ApiResponse = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(
          result.message || "Gagal mengambil stock pusat"
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
  // LOAD MASTER HARGA
  // =====================================================

  async function loadPrices() {
    try {
      setPriceLoading(true);

      const res = await fetch(
        "/api/master-harga",
        {
          cache: "no-store",
        }
      );

      const result: MasterHargaResponse =
        await res.json();

      if (!res.ok || !result.success) {
        throw new Error(
          result.message ||
            "Gagal mengambil master harga"
        );
      }

      setPriceData(
        Array.isArray(result.data)
          ? result.data
          : []
      );
    } catch (error) {
      console.error(
        "LOAD MASTER HARGA ERROR:",
        error
      );

      setPriceData([]);
    } finally {
      setPriceLoading(false);
    }
  }

  // =====================================================
  // LOAD ALL
  // =====================================================

  async function loadAll() {
    await Promise.all([
      loadStock(),
      loadPrices(),
    ]);
  }

  useEffect(() => {
    loadAll();
  }, []);

  // =====================================================
  // LATEST PRICE MAP
  // =====================================================

  const latestPriceMap = useMemo(() => {
    const map = new Map<number, MasterHarga>();

    const sorted = [...priceData].sort(
      (a, b) => {
        const dateA = new Date(
          a.receiveDate ||
            a.createdAt ||
            0
        ).getTime();

        const dateB = new Date(
          b.receiveDate ||
            b.createdAt ||
            0
        ).getTime();

        return dateB - dateA;
      }
    );

    for (const item of sorted) {
      if (!item.barangId) continue;

      if (!map.has(item.barangId)) {
        map.set(item.barangId, item);
      }
    }

    return map;
  }, [priceData]);

  // =====================================================
  // PRICE HELPERS
  // =====================================================

  function getLatestPrice(item: Stock): number | null {
    const price = latestPriceMap.get(item.barangId);

    if (!price) {
      return null;
    }

    const value = Number(price.hargaBaru);

    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      return null;
    }

    return value;
  }

  function getStockValue(item: Stock): number {
    const price = getLatestPrice(item);

    if (price === null) {
      return 0;
    }

    return getTransactionStock(item) * price;
  }

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
    return (
      getTransactionStock(item) *
      getConversion(item)
    );
  }

  function getMinimumStock(item: Stock) {
    return Number(item.minimumStock || 0);
  }

  // =====================================================
  // SEARCH + FILTER
  // =====================================================

  const filteredData = useMemo(() => {
    const keyword =
      search.toLowerCase().trim();

    return data.filter((item) => {
      const code =
        item.barang?.code?.toLowerCase() || "";

      const name =
        item.barang?.name?.toLowerCase() || "";

      const barcode =
        item.barang?.barcode?.toLowerCase() || "";

      const unit =
        item.barang?.unit?.toLowerCase() || "";

      const baseUnit =
        item.barang?.baseUnit?.toLowerCase() || "";

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
          dot: "bg-emerald-500",
        };

      case "TRANSFER":
      case "TRANSFER_IN":
        return {
          text: "Transfer Masuk",
          className:
            "border-[#BFD9CE] bg-[#EEF7F3] text-[#497F70]",
          dot: "bg-[#497F70]",
        };

      case "DELIVERY":
      case "DELIVERY_OUT":
      case "STOCK_OUT":
        return {
          text: "Barang Keluar",
          className:
            "border-red-200 bg-red-50 text-red-700",
          dot: "bg-red-500",
        };

      case "ADJUSTMENT":
        return {
          text: "Adjustment Stock",
          className:
            "border-amber-200 bg-amber-50 text-amber-700",
          dot: "bg-amber-500",
        };

      case "OPNAME":
      case "STOCK_OPNAME":
        return {
          text: "Stock Opname",
          className:
            "border-purple-200 bg-purple-50 text-purple-700",
          dot: "bg-purple-500",
        };

      case "PURCHASE":
        return {
          text: "Purchase Order",
          className:
            "border-gray-200 bg-gray-50 text-gray-700",
          dot: "bg-gray-400",
        };

      default:
        return {
          text: type || "-",
          className:
            "border-gray-200 bg-gray-50 text-gray-600",
          dot: "bg-gray-400",
        };
    }
  }

  // =====================================================
  // HISTORY STATUS
  // =====================================================

  function getHistoryStatus(
    status?: string | null
  ) {
    const value = String(status || "").trim();
    const upper = value.toUpperCase();

    if (
      upper === "APPROVED" ||
      upper === "COMPLETED" ||
      upper === "RECEIVED" ||
      upper === "DONE" ||
      upper === "SUCCESS"
    ) {
      return {
        text: value || "APPROVED",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        dot: "bg-emerald-500",
      };
    }

    if (
      upper === "PENDING" ||
      upper === "WAITING" ||
      upper === "COUNTING"
    ) {
      return {
        text: value,
        className:
          "border-amber-200 bg-amber-50 text-amber-700",
        dot: "bg-amber-500",
      };
    }

    if (
      upper === "REJECTED" ||
      upper === "CANCELLED" ||
      upper === "CANCELED"
    ) {
      return {
        text: value,
        className:
          "border-red-200 bg-red-50 text-red-700",
        dot: "bg-red-500",
      };
    }

    return {
      text: value || "-",
      className:
        "border-gray-200 bg-gray-50 text-gray-600",
      dot: "bg-gray-400",
    };
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

  function formatCurrency(
    value: number | null | undefined
  ) {
    if (
      value === null ||
      value === undefined ||
      !Number.isFinite(Number(value))
    ) {
      return "-";
    }

    return Number(value).toLocaleString(
      "id-ID",
      {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }
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
        total + getTransactionStock(item),
      0
    );
  }, [filteredData]);

  const totalBaseStock = useMemo(() => {
    return filteredData.reduce(
      (total, item) =>
        total + getBaseStock(item),
      0
    );
  }, [filteredData]);

  const totalStockValue = useMemo(() => {
    return filteredData.reduce(
      (total, item) =>
        total + getStockValue(item),
      0
    );
  }, [filteredData, latestPriceMap]);

  const totalPricedItems = useMemo(() => {
    return filteredData.filter(
      (item) =>
        getLatestPrice(item) !== null
    ).length;
  }, [filteredData, latestPriceMap]);

  const totalWithOpname = useMemo(() => {
    return filteredData.filter(
      (item) =>
        item.lastOpname !== null
    ).length;
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

  async function openHistory(stock: Stock) {
    try {
      setSelectedHistory(stock);
      setHistoryData([]);
      setHistoryError("");
      setHistoryLoading(true);

      const params = new URLSearchParams();

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
            result.summary?.informational || 0
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
    <div className="min-h-full bg-[#F3F7F5] text-[#18352D]">

      {/* =================================================
          PREMIUM HEADER
      ================================================= */}

      <section className="relative overflow-hidden border-b border-[#183F33] bg-[#071F18]">

        <div className="pointer-events-none absolute -left-28 -top-32 h-80 w-80 rounded-full bg-emerald-400/[0.09] blur-[100px]" />

        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-teal-300/[0.07] blur-[110px]" />

        <div className="pointer-events-none absolute bottom-[-100px] left-1/2 h-56 w-[600px] -translate-x-1/2 rounded-full bg-emerald-300/[0.035] blur-[100px]" />

        <div className="relative px-6 py-7 md:px-8 md:py-8">

          <div className="flex flex-col gap-7 xl:flex-row xl:items-center xl:justify-between">

            <div className="flex min-w-0 items-start gap-4">

              <div className="relative flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-[20px] border border-emerald-300/[0.14] bg-emerald-300/[0.07] text-emerald-300 shadow-[0_15px_50px_rgba(16,185,129,0.10)]">

                <Warehouse
                  size={27}
                  strokeWidth={1.7}
                />

                <span className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />

              </div>

              <div className="min-w-0">

                <div className="flex flex-wrap items-center gap-2.5">

                  <h1 className="text-[28px] font-bold tracking-[-0.04em] text-white md:text-[33px]">
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
                  stock opname, nilai persediaan,
                  harga terbaru, dan seluruh riwayat
                  pergerakan barang.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">

                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.035] px-2.5 py-1.5 text-[10px] font-semibold text-slate-300">
                    <Warehouse size={12} />
                    Gudang Pusat
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/[0.10] bg-emerald-300/[0.05] px-2.5 py-1.5 text-[10px] font-semibold text-emerald-300">
                    <LockKeyhole size={12} />
                    Read Only
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.035] px-2.5 py-1.5 text-[10px] font-semibold text-slate-400">
                    <Activity size={12} />
                    Monitoring Aktif
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/[0.10] bg-emerald-300/[0.05] px-2.5 py-1.5 text-[10px] font-semibold text-emerald-300">
                    <DollarSign size={12} />
                    Master Harga Aktif
                  </span>

                </div>

              </div>

            </div>

            <button
              type="button"
              onClick={loadAll}
              disabled={
                loading ||
                priceLoading
              }
              className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300/[0.14] bg-emerald-300/[0.08] px-5 text-sm font-bold text-emerald-200 shadow-[0_10px_35px_rgba(16,185,129,0.07)] transition-all hover:-translate-y-0.5 hover:border-emerald-300/[0.22] hover:bg-emerald-300/[0.13] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >

              <RefreshCw
                size={16}
                className={`transition-transform ${
                  loading ||
                  priceLoading
                    ? "animate-spin"
                    : "group-hover:rotate-180"
                }`}
              />

              {loading ||
              priceLoading
                ? "Memuat..."
                : "Refresh Data"}

            </button>

          </div>

        </div>

        <div className="relative h-px bg-gradient-to-r from-transparent via-emerald-300/[0.16] to-transparent" />

      </section>

      {/* =================================================
          CONTENT
      ================================================= */}

      <div className="px-6 py-6 md:px-8 md:py-7">

        {/* SECURITY */}

        <div className="mb-6 overflow-hidden rounded-[20px] border border-[#CFE1D9] bg-white shadow-[0_7px_30px_rgba(30,70,58,0.045)]">

          <div className="relative flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:px-6">

            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-400 to-[#497F70]" />

            <div className="flex items-start gap-3">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <ShieldCheck size={20} />
              </div>

              <div>

                <div className="flex flex-wrap items-center gap-2">

                  <p className="text-sm font-bold text-[#285346]">
                    Stock pusat terkunci
                  </p>

                  <span className="rounded-full bg-[#EAF3EF] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#497F70]">
                    Protected
                  </span>

                </div>

                <p className="mt-1 max-w-4xl text-xs leading-5 text-[#56766B]">
                  Nilai stock merupakan stock sistem
                  dan tidak dapat diubah secara manual.
                  Harga satuan menggunakan Master Harga
                  terbaru yang tercatat dari proses
                  penerimaan barang.
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

        {/* CONVERSION */}

        <div className="mb-6 overflow-hidden rounded-[20px] border border-[#CFE1D9] bg-gradient-to-br from-[#EEF7F3] via-white to-[#F8FBF9] shadow-[0_7px_30px_rgba(30,70,58,0.035)]">

          <div className="relative p-5 md:p-6">

            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-100/50 blur-3xl" />

            <div className="relative flex items-start gap-3">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#DDEEE7] text-[#497F70]">
                <Boxes size={20} />
              </div>

              <div className="min-w-0">

                <div className="flex flex-wrap items-center gap-2">

                  <p className="text-sm font-bold text-[#285346]">
                    Tampilan Stock Dasar & Nilai
                    Persediaan
                  </p>

                  <span className="rounded-full bg-[#DDEEE7] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#497F70]">
                    Monitoring
                  </span>

                </div>

                <p className="mt-1 max-w-4xl text-xs leading-5 text-[#56766B]">
                  Stock transaksi tetap menggunakan
                  satuan utama barang. Stock dasar hanya
                  merupakan hasil perhitungan monitoring.
                  Total nilai stock menggunakan harga
                  Master Harga terbaru × stock transaksi.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">

                  <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-[#DCEBE4] bg-white/80 px-3 py-2 text-[10px] font-semibold text-[#497F70] shadow-sm">

                    <span>Stock Dasar</span>
                    <span className="text-[#A8C6BA]">=</span>

                    <span className="rounded-lg bg-[#EAF3EF] px-2 py-1">
                      Stock Transaksi
                    </span>

                    <span className="text-[#A8C6BA]">×</span>

                    <span className="rounded-lg bg-[#EAF3EF] px-2 py-1">
                      Konversi
                    </span>

                  </div>

                  <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-[#DCEBE4] bg-white/80 px-3 py-2 text-[10px] font-semibold text-[#497F70] shadow-sm">

                    <span>Total Nilai</span>
                    <span className="text-[#A8C6BA]">=</span>

                    <span className="rounded-lg bg-[#EAF3EF] px-2 py-1">
                      Stock
                    </span>

                    <span className="text-[#A8C6BA]">×</span>

                    <span className="rounded-lg bg-[#EAF3EF] px-2 py-1">
                      Harga Terbaru
                    </span>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

        {/* ERROR */}

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

        {/* KPI */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

          {[
            {
              label: "Jenis Barang",
              value: filteredData.length,
              description:
                "Barang terdaftar di pusat",
              icon: Package,
              iconClass:
                "bg-[#EAF3EF] text-[#497F70]",
              lineClass:
                "bg-[#497F70]",
              glow:
                "bg-emerald-50/80",
              isCurrency: false,
            },
            {
              label: "Total Stock Transaksi",
              value: totalStock,
              description:
                "Akumulasi satuan transaksi",
              icon: Boxes,
              iconClass:
                "bg-[#EEF6F3] text-[#497F70]",
              lineClass:
                "bg-[#497F70]",
              glow:
                "bg-teal-50/80",
              isCurrency: false,
            },
            {
              label: "Total Stock Dasar",
              value: totalBaseStock,
              description:
                "Hasil konversi monitoring",
              icon: TrendingUp,
              iconClass:
                "bg-[#EEF6F3] text-[#497F70]",
              lineClass:
                "bg-[#497F70]",
              glow:
                "bg-emerald-50/70",
              isCurrency: false,
            },
            {
              label: "Total Nilai Stock",
              value: totalStockValue,
              description:
                `${formatNumber(
                  totalPricedItems
                )} barang memiliki harga`,
              icon: DollarSign,
              iconClass:
                "bg-[#F0F6F3] text-[#497F70]",
              lineClass:
                "bg-[#497F70]",
              glow:
                "bg-emerald-50/80",
              isCurrency: true,
            },
            {
              label: "Sudah Stock Opname",
              value: totalWithOpname,
              description:
                `Dari ${formatNumber(
                  data.length
                )} jenis`,
              icon: ClipboardCheck,
              iconClass:
                "bg-[#F2F0FA] text-purple-600",
              lineClass:
                "bg-purple-500",
              glow:
                "bg-purple-50/80",
              isCurrency: false,
            },
          ].map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.label}
                className="group relative overflow-hidden rounded-[20px] border border-[#DDE9E4] bg-white p-5 shadow-[0_6px_25px_rgba(30,70,58,0.045)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(30,70,58,0.085)]"
              >

                <div
                  className={`absolute right-0 top-0 h-24 w-24 rounded-full ${card.glow} blur-2xl transition-transform duration-500 group-hover:scale-125`}
                />

                <div
                  className={`absolute left-0 top-0 h-1 w-12 rounded-br-full ${card.lineClass}`}
                />

                <div className="relative flex items-start justify-between gap-3">

                  <div className="min-w-0">

                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-gray-400">
                      {card.label}
                    </p>

                    <p className="mt-2 truncate text-[24px] font-bold tracking-[-0.03em] text-[#18352D]">
                      {card.isCurrency
                        ? formatCurrency(card.value)
                        : formatNumber(card.value)}
                    </p>

                    <p className="mt-1 text-[10px] text-gray-400">
                      {card.description}
                    </p>

                  </div>

                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.iconClass} transition-transform duration-300 group-hover:scale-105`}
                  >
                    <Icon size={20} />
                  </div>

                </div>

              </div>
            );
          })}

        </div>

        {/* STATUS */}

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">

          {[
            {
              value: "AMAN" as FilterStatus,
              label: "Stock Aman",
              count: totalAman,
              icon: CheckCircle2,
              iconClass:
                "bg-emerald-50 text-emerald-600",
              active:
                "border-emerald-300 ring-2 ring-emerald-100",
              hover:
                "group-hover:text-emerald-600",
            },
            {
              value: "MINIMUM" as FilterStatus,
              label: "Stock Minimum",
              count: totalMinimum,
              icon: AlertTriangle,
              iconClass:
                "bg-amber-50 text-amber-600",
              active:
                "border-amber-300 ring-2 ring-amber-100",
              hover:
                "group-hover:text-amber-600",
            },
            {
              value: "HABIS" as FilterStatus,
              label: "Stock Habis",
              count: totalHabis,
              icon: PackageX,
              iconClass:
                "bg-red-50 text-red-600",
              active:
                "border-red-300 ring-2 ring-red-100",
              hover:
                "group-hover:text-red-600",
            },
          ].map((status) => {
            const Icon = status.icon;

            return (
              <button
                key={status.value}
                type="button"
                onClick={() =>
                  setFilterStatus(
                    filterStatus ===
                    status.value
                      ? "ALL"
                      : status.value
                  )
                }
                className={`group relative overflow-hidden rounded-[20px] border bg-white p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                  filterStatus ===
                  status.value
                    ? status.active
                    : "border-[#DDE9E4]"
                }`}
              >

                <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-gray-50 blur-2xl transition-transform group-hover:scale-125" />

                <div className="relative flex items-center justify-between">

                  <div className="flex items-center gap-3">

                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${status.iconClass}`}
                    >
                      <Icon size={19} />
                    </div>

                    <div>

                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        {status.label}
                      </p>

                      <p className="mt-0.5 text-xl font-bold text-[#18352D]">
                        {formatNumber(
                          status.count
                        )}
                      </p>

                    </div>

                  </div>

                  <ChevronRight
                    size={16}
                    className={`text-gray-300 transition-transform group-hover:translate-x-1 ${status.hover}`}
                  />

                </div>

              </button>
            );
          })}

        </div>

        {/* FILTER */}

        <div className="mb-6 overflow-hidden rounded-[20px] border border-[#DDE9E4] bg-white shadow-[0_6px_25px_rgba(30,70,58,0.045)]">

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
                      setSearch(e.target.value)
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
                          setFilterStatus(value)
                        }
                        className={`flex-1 rounded-lg px-2 py-2 text-[10px] font-bold transition-all ${
                          filterStatus === value
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

              <span className="rounded-full border border-[#DCEBE4] bg-[#F4F9F6] px-3 py-1 text-[10px] font-semibold text-[#497F70]">
                Harga tersedia:{" "}
                {formatNumber(
                  totalPricedItems
                )}
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
                    setFilterStatus("ALL");
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

        <div className="overflow-hidden rounded-[22px] border border-[#DDE9E4] bg-white shadow-[0_8px_30px_rgba(30,70,58,0.055)]">

          <div className="flex flex-col gap-3 border-b border-[#E5ECE9] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">

            <div>

              <div className="flex items-center gap-2.5">

                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                  <Warehouse size={16} />
                </div>

                <div>

                  <h2 className="text-sm font-bold tracking-[-0.01em] text-[#18352D]">
                    Persediaan Gudang Pusat
                  </h2>

                  <p className="mt-0.5 text-[9px] text-gray-400">
                    Monitoring stock sistem, harga
                    terbaru, dan total nilai persediaan.
                  </p>

                </div>

              </div>

            </div>

            <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">

              <div className="flex items-center gap-1.5 rounded-lg border border-[#DDE9E4] bg-[#FAFCFB] px-2.5 py-1.5">

                <LockKeyhole
                  size={11}
                  className="text-[#497F70]"
                />

                <span className="text-[9px] font-bold text-gray-500">
                  Stock Terkunci
                </span>

              </div>

              <div className="flex items-center gap-1.5 rounded-lg border border-[#DDE9E4] bg-[#FAFCFB] px-2.5 py-1.5">

                <DollarSign
                  size={11}
                  className="text-[#497F70]"
                />

                <span className="text-[9px] font-bold text-gray-500">
                  Harga Master
                </span>

              </div>

            </div>

          </div>

          <div className="overflow-x-auto">

            {/* DIPERKECIL DARI 2100px -> 1750px */}

            <table className="min-w-[1750px] w-full table-fixed text-sm">

              <colgroup>
                <col className="w-[48px]" />
                <col className="w-[245px]" />
                <col className="w-[125px]" />
                <col className="w-[105px]" />
                <col className="w-[125px]" />
                <col className="w-[145px]" />
                <col className="w-[165px]" />
                <col className="w-[125px]" />
                <col className="w-[80px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[95px]" />
                <col className="w-[105px]" />
                <col className="w-[190px]" />
              </colgroup>

              <thead className="bg-[#F7F9F8]">

                <tr className="border-b border-[#E5ECE9]">

                  {[
                    ["No", "text-left"],
                    ["Barang", "text-left"],
                    ["Stock Transaksi", "text-right"],
                    ["Konversi", "text-right"],
                    ["Stock Dasar", "text-right"],
                    ["Harga Satuan", "text-right"],
                    ["Total Nilai Stock", "text-right"],
                    ["SO Terakhir", "text-left"],
                    ["Fisik", "text-right"],
                    ["Selisih", "text-right"],
                    ["Status SO", "text-center"],
                    ["Minimum", "text-right"],
                    ["Status Stock", "text-center"],
                    ["History / Invoice / Status", "text-left"],
                  ].map(
                    ([label, align]) => (
                      <th
                        key={label}
                        className={`whitespace-nowrap px-2.5 py-3 ${align} text-[8px] font-bold uppercase tracking-[0.11em] text-gray-400`}
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
                      colSpan={14}
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
                      colSpan={14}
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
                            setFilterStatus("ALL");
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
                    (item, index) => {

                      const stockStatus =
                        getStatus(
                          Number(item.stock),
                          Number(item.minimumStock)
                        );

                      const StatusIcon =
                        stockStatus.icon;

                      const lastOpname =
                        item.lastOpname;

                      const difference =
                        Number(
                          lastOpname?.difference || 0
                        );

                      const opnameStatus =
                        getOpnameStatus(
                          lastOpname?.status
                        );

                      const transactionStock =
                        getTransactionStock(item);

                      const conversion =
                        getConversion(item);

                      const baseStock =
                        getBaseStock(item);

                      const minimumStock =
                        getMinimumStock(item);

                      const latestPrice =
                        getLatestPrice(item);

                      const stockValue =
                        getStockValue(item);

                      const transactionUnit =
                        item.barang?.unit || "-";

                      const baseUnit =
                        item.barang?.baseUnit ||
                        transactionUnit;

                      return (
                        <tr
                          key={item.id}
                          className="group border-b border-[#EDF2EF] transition-colors hover:bg-[#FBFDFC]"
                        >

                          {/* NO */}

                          <td className="whitespace-nowrap px-2.5 py-2.5 text-[10px] font-medium text-gray-400">
                            {String(
                              index + 1
                            ).padStart(2, "0")}
                          </td>

                          {/* BARANG */}

                          <td className="px-2.5 py-2.5">

                            <div className="flex items-center gap-2">

                              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F0F6F3] text-[#497F70] transition-all group-hover:bg-[#E4F0EB]">

                                <Package size={15} />

                                <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border border-white bg-emerald-400" />

                              </div>

                              <div className="min-w-0">

                                <div className="truncate text-[11px] font-bold text-[#18352D]">
                                  {item.barang?.name || "-"}
                                </div>

                                <div className="mt-0.5 flex min-w-0 items-center gap-1">

                                  <span className="max-w-[80px] truncate rounded bg-[#F0F6F3] px-1.5 py-0.5 font-mono text-[8px] font-bold text-[#497F70]">
                                    {item.barang?.code || "-"}
                                  </span>

                                  <span className="text-[8px] text-gray-300">
                                    •
                                  </span>

                                  <span className="text-[8px] text-gray-400">
                                    {transactionUnit}
                                  </span>

                                  <span className="text-[8px] text-gray-300">
                                    •
                                  </span>

                                  <span className="truncate text-[8px] font-semibold text-[#497F70]">
                                    Dasar: {baseUnit}
                                  </span>

                                </div>

                                {item.barang?.barcode && (
                                  <div className="mt-0.5 truncate font-mono text-[7px] text-gray-400">
                                    BC: {item.barang.barcode}
                                  </div>
                                )}

                              </div>

                            </div>

                          </td>

                          {/* STOCK TRANSAKSI */}

                          <td className="px-2.5 py-2.5 text-right">

                            <div className="inline-flex min-w-[92px] flex-col items-end rounded-lg border border-[#E8EFEC] bg-[#F8FAF9] px-2 py-1.5">

                              <div className="flex items-center gap-1">

                                <LockKeyhole
                                  size={9}
                                  className="text-gray-400"
                                />

                                <span className="text-[12px] font-bold text-[#18352D]">
                                  {formatNumber(
                                    transactionStock
                                  )}
                                </span>

                                <span className="text-[8px] font-bold text-[#497F70]">
                                  {transactionUnit}
                                </span>

                              </div>

                            </div>

                          </td>

                          {/* KONVERSI */}

                          <td className="px-2.5 py-2.5 text-right">

                            <div className="inline-flex flex-col items-end">

                              <span className="rounded-md border border-[#DCEBE4] bg-[#EAF3EF] px-2 py-1 text-[8px] font-bold text-[#497F70]">
                                1 {transactionUnit}
                              </span>

                              <span className="mt-0.5 whitespace-nowrap text-[8px] font-semibold text-gray-400">
                                = {formatNumber(conversion)}{" "}
                                {baseUnit}
                              </span>

                            </div>

                          </td>

                          {/* STOCK DASAR */}

                          <td className="px-2.5 py-2.5 text-right">

                            <div className="inline-flex min-w-[92px] flex-col items-end rounded-lg border border-[#DCEBE4] bg-[#F4F9F6] px-2 py-1.5">

                              <span className="text-[12px] font-bold text-[#285346]">
                                {formatNumber(baseStock)}
                              </span>

                              <span className="text-[8px] font-bold uppercase tracking-wide text-[#497F70]">
                                {baseUnit}
                              </span>

                            </div>

                          </td>

                          {/* HARGA SATUAN */}

                          <td className="px-2.5 py-2.5 text-right">

                            {latestPrice !== null ? (
                              <div className="inline-flex min-w-[118px] flex-col items-end rounded-lg border border-[#DCEBE4] bg-[#F8FBF9] px-2 py-1.5">

                                <div className="flex items-center gap-1">

                                  <DollarSign
                                    size={9}
                                    className="text-[#497F70]"
                                  />

                                  <span className="text-[10px] font-bold text-[#285346]">
                                    {formatCurrency(
                                      latestPrice
                                    )}
                                  </span>

                                </div>

                                <span className="mt-0.5 text-[7px] font-medium text-gray-400">
                                  per {transactionUnit}
                                </span>

                              </div>
                            ) : (
                              <div className="inline-flex min-w-[118px] flex-col items-end rounded-lg border border-dashed border-[#DDE9E4] bg-[#FAFCFB] px-2 py-1.5">

                                <span className="text-[10px] font-bold text-gray-400">
                                  -
                                </span>

                                <span className="mt-0.5 text-[7px] text-gray-400">
                                  Harga belum tersedia
                                </span>

                              </div>
                            )}

                          </td>

                          {/* TOTAL NILAI STOCK */}

                          <td className="px-2.5 py-2.5 text-right">

                            {latestPrice !== null ? (
                              <div className="inline-flex min-w-[135px] flex-col items-end rounded-lg border border-[#BFD9CE] bg-gradient-to-br from-[#EEF7F3] to-[#F8FBF9] px-2 py-1.5">

                                <div className="flex items-center gap-1">

                                  <Calculator
                                    size={9}
                                    className="text-[#497F70]"
                                  />

                                  <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#497F70]">
                                    Nilai Stock
                                  </span>

                                </div>

                                <span className="mt-0.5 text-[11px] font-bold tracking-[-0.02em] text-[#18352D]">
                                  {formatCurrency(stockValue)}
                                </span>

                                <span className="mt-0.5 whitespace-nowrap text-[7px] text-gray-400">
                                  {formatNumber(transactionStock)} ×{" "}
                                  {formatCurrency(latestPrice)}
                                </span>

                              </div>
                            ) : (
                              <div className="inline-flex min-w-[135px] flex-col items-end rounded-lg border border-dashed border-[#DDE9E4] bg-[#FAFCFB] px-2 py-1.5">

                                <span className="text-[10px] font-bold text-gray-400">
                                  -
                                </span>

                                <span className="mt-0.5 text-[7px] text-gray-400">
                                  Tidak dapat dihitung
                                </span>

                              </div>
                            )}

                          </td>

                          {/* SO TERAKHIR */}

                          <td className="px-2.5 py-2.5">

                            {lastOpname ? (
                              <div>

                                <div className="flex items-center gap-1.5">

                                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-50">
                                    <CalendarDays
                                      size={10}
                                      className="text-purple-500"
                                    />
                                  </div>

                                  <span className="whitespace-nowrap text-[9px] font-bold text-[#35564C]">
                                    {formatDate(
                                      lastOpname.date
                                    )}
                                  </span>

                                </div>

                                <div className="mt-0.5 truncate font-mono text-[7px] text-gray-400">
                                  {lastOpname.code}
                                </div>

                              </div>
                            ) : (
                              <span className="inline-flex whitespace-nowrap rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[8px] font-medium text-gray-400">
                                Belum ada SO
                              </span>
                            )}

                          </td>

                          {/* FISIK */}

                          <td className="px-2.5 py-2.5 text-right">

                            {lastOpname ? (
                              <div className="inline-flex flex-col items-end">

                                <span className="text-[10px] font-bold text-[#18352D]">
                                  {formatNumber(
                                    Number(
                                      lastOpname.physicalQty
                                    )
                                  )}
                                </span>

                                <span className="text-[7px] text-gray-400">
                                  {transactionUnit}
                                </span>

                              </div>
                            ) : (
                              <span className="text-gray-300">
                                -
                              </span>
                            )}

                          </td>

                          {/* SELISIH */}

                          <td className="px-2.5 py-2.5 text-right">

                            {!lastOpname ? (
                              <span className="text-gray-300">
                                -
                              </span>
                            ) : difference > 0 ? (
                              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 font-bold text-[8px] text-emerald-700">

                                <ArrowUp size={9} />

                                +{formatNumber(difference)}{" "}
                                {transactionUnit}

                              </span>
                            ) : difference < 0 ? (
                              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-red-100 bg-red-50 px-2 py-1 font-bold text-[8px] text-red-700">

                                <ArrowDown size={9} />

                                {formatNumber(difference)}{" "}
                                {transactionUnit}

                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-semibold text-[8px] text-gray-500">

                                <Minus size={9} />

                                0 {transactionUnit}

                              </span>
                            )}

                          </td>

                          {/* STATUS SO */}

                          <td className="px-2.5 py-2.5 text-center">

                            {lastOpname ? (
                              <span
                                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-1 text-[8px] font-bold ${opnameStatus.className}`}
                              >
                                {opnameStatus.text}
                              </span>
                            ) : (
                              <span className="text-[9px] text-gray-300">
                                -
                              </span>
                            )}

                          </td>

                          {/* MINIMUM */}

                          <td className="px-2.5 py-2.5 text-right">

                            <div className="inline-flex flex-col items-end">

                              <span className="text-[10px] font-semibold text-gray-600">
                                {formatNumber(
                                  minimumStock
                                )}
                              </span>

                              <span className="text-[7px] text-gray-400">
                                {transactionUnit}
                              </span>

                            </div>

                          </td>

                          {/* STATUS STOCK */}

                          <td className="px-2.5 py-2.5 text-center">

                            <span
                              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-1 text-[8px] font-bold ${stockStatus.className}`}
                            >

                              <StatusIcon size={9} />

                              {stockStatus.text}

                            </span>

                          </td>

                          {/* HISTORY */}

                          <td className="px-2.5 py-2.5">

                            <button
                              type="button"
                              onClick={() =>
                                openHistory(item)
                              }
                              className="group/history flex min-w-[170px] items-center gap-2 rounded-lg border border-[#CFE1D9] bg-white px-2.5 py-2 text-left shadow-[0_2px_8px_rgba(30,70,58,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#AFCDBF] hover:bg-[#F8FCFA] hover:shadow-[0_6px_15px_rgba(30,70,58,0.07)]"
                            >

                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#EAF3EF] text-[#497F70] transition-colors group-hover/history:bg-[#DDEEE7]">

                                <History size={13} />

                              </div>

                              <div className="min-w-0 flex-1">

                                <div className="flex items-center gap-1">

                                  <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-gray-400">
                                    History
                                  </span>

                                  <ChevronRight
                                    size={8}
                                    className="text-gray-300 transition-transform group-hover/history:translate-x-0.5"
                                  />

                                </div>

                                <div className="mt-0.5 flex items-center gap-1">

                                  <FileText
                                    size={9}
                                    className="shrink-0 text-[#497F70]"
                                  />

                                  <span className="truncate font-mono text-[8px] font-bold text-[#35564C]">
                                    Klik untuk lihat
                                  </span>

                                </div>

                                <div className="mt-1">

                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[7px] font-bold ${stockStatus.className}`}
                                  >

                                    <span className="h-0.5 w-0.5 rounded-full bg-current" />

                                    {stockStatus.text}

                                  </span>

                                </div>

                              </div>

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
              <div className="flex flex-col gap-3 border-t border-[#E5ECE9] bg-[#FAFCFB] px-4 py-3 text-[9px] text-gray-400 md:px-5">

                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">

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

                  <div className="flex flex-wrap items-center gap-1.5">

                    <span className="inline-flex items-center gap-1 border border-[#DDE9E4] bg-white px-2 py-1 rounded-md">
                      <LockKeyhole size={9} />
                      Stock terkunci
                    </span>

                    <span className="inline-flex items-center gap-1 border border-[#DDE9E4] bg-[#F4F9F6] px-2 py-1 rounded-md text-[#497F70]">
                      <DollarSign size={9} />
                      Nilai:{" "}
                      <strong>
                        {formatCurrency(
                          totalStockValue
                        )}
                      </strong>
                    </span>

                    <span className="inline-flex items-center gap-1 border border-[#DDE9E4] bg-white px-2 py-1 rounded-md">
                      Harga tersedia:{" "}
                      <strong className="text-gray-600">
                        {formatNumber(
                          totalPricedItems
                        )}
                      </strong>
                    </span>

                  </div>

                </div>

              </div>
            )}

        </div>

      </div>

      {/* =====================================================
          HISTORY MODAL
      ===================================================== */}

      {selectedHistory && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#061B15]/70 p-3 backdrop-blur-md md:p-5"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeHistory();
            }
          }}
        >

          <div className="flex max-h-[95vh] w-full max-w-[1450px] flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_40px_120px_rgba(6,27,21,0.35)]">

            {/* MODAL HEADER */}

            <div className="relative overflow-hidden border-b border-[#E4ECE8] bg-gradient-to-br from-[#F7FBF9] via-white to-[#EFF7F3] px-5 py-5 md:px-7 md:py-6">

              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-100/70 blur-3xl" />

              <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-80 rounded-full bg-[#DDEEE7]/50 blur-3xl" />

              <div className="relative flex items-start justify-between gap-4">

                <div className="flex min-w-0 items-start gap-4">

                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#CFE1D9] bg-[#EAF3EF] text-[#497F70] shadow-sm">

                    <History size={23} />

                    <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500">

                      <LockKeyhole
                        size={8}
                        className="text-white"
                      />

                    </span>

                  </div>

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <h2 className="text-xl font-bold tracking-[-0.025em] text-[#18352D]">
                        History Stock
                      </h2>

                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CFE1D9] bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#497F70] shadow-sm">

                        <LockKeyhole size={10} />

                        Read Only

                      </span>

                    </div>

                    <p className="mt-1 truncate text-sm font-semibold text-gray-500">
                      {selectedHistory.barang?.name || "-"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1.5">

                      <span className="inline-flex items-center gap-1 rounded-lg bg-[#EAF3EF] px-2.5 py-1 text-[9px] font-bold text-[#497F70]">

                        <Package size={10} />

                        {selectedHistory.barang?.code || "-"}

                      </span>

                      <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-[9px] font-medium text-gray-500">

                        Satuan:{" "}
                        {selectedHistory.barang?.unit || "-"}

                      </span>

                      {selectedHistory.barang?.baseUnit && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#EEF7F3] px-2.5 py-1 text-[9px] font-bold text-[#497F70]">

                          Dasar:{" "}
                          {selectedHistory.barang.baseUnit}

                        </span>
                      )}

                      {selectedHistory.barang?.conversion &&
                        Number(
                          selectedHistory.barang.conversion
                        ) > 0 && (
                          <span className="rounded-lg bg-[#F2F7F4] px-2.5 py-1 text-[9px] font-bold text-[#497F70]">

                            1{" "}
                            {selectedHistory.barang.unit}{" "}
                            ={" "}
                            {formatNumber(
                              Number(
                                selectedHistory.barang.conversion
                              )
                            )}{" "}
                            {selectedHistory.barang.baseUnit ||
                              selectedHistory.barang.unit}

                          </span>
                        )}

                      <span className="rounded-lg bg-[#FFF8E7] px-2.5 py-1 text-[9px] font-bold text-[#8A6A1E]">

                        Stock:{" "}
                        {formatNumber(
                          Number(
                            selectedHistory.stock
                          )
                        )}{" "}
                        {selectedHistory.barang?.unit || "-"}

                      </span>

                      <span className="rounded-lg bg-[#EAF3EF] px-2.5 py-1 text-[9px] font-bold text-[#497F70]">
                        Gudang Pusat
                      </span>

                      {getLatestPrice(
                        selectedHistory
                      ) !== null && (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#EEF7F3] px-2.5 py-1 text-[9px] font-bold text-[#497F70]">

                            <DollarSign size={10} />

                            Harga:{" "}
                            {formatCurrency(
                              getLatestPrice(
                                selectedHistory
                              )
                            )}

                          </span>

                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#EAF3EF] px-2.5 py-1 text-[9px] font-bold text-[#285346]">

                            <Calculator size={10} />

                            Nilai Stock:{" "}
                            {formatCurrency(
                              getStockValue(
                                selectedHistory
                              )
                            )}

                          </span>
                        </>
                      )}

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

            {/* SUMMARY */}

            <div className="grid grid-cols-2 gap-3 border-b border-[#E5ECE9] bg-[#FAFCFB] p-4 md:grid-cols-4 md:p-5">

              {[
                {
                  label: "Transaksi",
                  value:
                    historySummary.total,
                  description:
                    "Total aktivitas",
                  icon: History,
                  className:
                    "bg-[#EAF3EF] text-[#497F70]",
                  valueClass:
                    "text-[#18352D]",
                },
                {
                  label: "Masuk",
                  value:
                    historySummary.stockIn,
                  prefix: "+",
                  description:
                    "Stock masuk",
                  icon: ArrowDownCircle,
                  className:
                    "bg-emerald-50 text-emerald-600",
                  valueClass:
                    "text-emerald-700",
                },
                {
                  label: "Keluar",
                  value:
                    historySummary.stockOut,
                  prefix: "-",
                  description:
                    "Stock keluar",
                  icon: ArrowUpCircle,
                  className:
                    "bg-red-50 text-red-600",
                  valueClass:
                    "text-red-700",
                },
                {
                  label: "Informasi",
                  value:
                    historySummary.informational,
                  description:
                    "Aktivitas informasi",
                  icon: Info,
                  className:
                    "bg-[#F0F6F3] text-[#497F70]",
                  valueClass:
                    "text-[#497F70]",
                },
              ].map((card) => {
                const Icon = card.icon;

                return (
                  <div
                    key={card.label}
                    className="group rounded-2xl border border-[#DDE9E4] bg-white p-4 shadow-[0_3px_15px_rgba(30,70,58,0.03)] transition hover:shadow-md"
                  >

                    <div className="flex items-center justify-between">

                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.className}`}
                      >
                        <Icon size={14} />
                      </div>

                      <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-gray-400">
                        {card.label}
                      </span>

                    </div>

                    <p
                      className={`mt-3 text-xl font-bold ${card.valueClass}`}
                    >
                      {card.prefix || ""}
                      {formatNumber(card.value)}
                    </p>

                    <p className="mt-0.5 text-[9px] text-gray-400">
                      {card.description}
                    </p>

                  </div>
                );
              })}

            </div>

            {/* PRICE SUMMARY */}

            <div className="grid grid-cols-1 gap-3 border-b border-[#E5ECE9] bg-[#F8FBF9] p-4 md:grid-cols-3 md:p-5">

              <div className="rounded-2xl border border-[#DDE9E4] bg-white p-4 shadow-sm">

                <div className="flex items-center gap-2">

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                    <DollarSign size={14} />
                  </div>

                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400">
                    Harga Terbaru
                  </span>

                </div>

                <p className="mt-3 text-lg font-bold text-[#18352D]">
                  {formatCurrency(
                    getLatestPrice(
                      selectedHistory
                    )
                  )}
                </p>

                <p className="mt-0.5 text-[9px] text-gray-400">
                  Per{" "}
                  {selectedHistory.barang?.unit || "-"}
                </p>

              </div>

              <div className="rounded-2xl border border-[#DDE9E4] bg-white p-4 shadow-sm">

                <div className="flex items-center gap-2">

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF7F3] text-[#497F70]">
                    <Boxes size={14} />
                  </div>

                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400">
                    Stock Saat Ini
                  </span>

                </div>

                <p className="mt-3 text-lg font-bold text-[#18352D]">
                  {formatNumber(
                    getTransactionStock(
                      selectedHistory
                    )
                  )}
                </p>

                <p className="mt-0.5 text-[9px] text-gray-400">
                  {selectedHistory.barang?.unit || "-"}
                </p>

              </div>

              <div className="rounded-2xl border border-[#BFD9CE] bg-gradient-to-br from-[#EEF7F3] to-white p-4 shadow-sm">

                <div className="flex items-center gap-2">

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#DDEEE7] text-[#497F70]">
                    <Calculator size={14} />
                  </div>

                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#497F70]">
                    Total Nilai Stock
                  </span>

                </div>

                <p className="mt-3 text-lg font-bold text-[#18352D]">
                  {formatCurrency(
                    getStockValue(
                      selectedHistory
                    )
                  )}
                </p>

                <p className="mt-0.5 text-[9px] text-gray-400">
                  Stock × harga terbaru
                </p>

              </div>

            </div>

            {/* BODY */}

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

                <div className="overflow-hidden rounded-[20px] border border-[#DDE9E4] shadow-sm">

                  <div className="overflow-x-auto">

                    <table className="min-w-[1450px] w-full text-sm">

                      <thead className="bg-[#F7F9F8]">

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
                            No. Invoice / Transaksi
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

                            const status =
                              getHistoryStatus(
                                history.status
                              );

                            const isIn =
                              history.direction ===
                              "IN";

                            const isOut =
                              history.direction ===
                              "OUT";

                            return (
                              <tr
                                key={history.id}
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

                                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F3F7F5]">

                                      <CalendarDays
                                        size={12}
                                        className="text-[#497F70]"
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
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold ${type.className}`}
                                  >

                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${type.dot}`}
                                    />

                                    {type.text}

                                  </span>

                                </td>

                                <td className="px-4 py-4">

                                  <div className="min-w-[190px]">

                                    <div className="flex items-center gap-2">

                                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">

                                        <ReceiptText
                                          size={13}
                                        />

                                      </div>

                                      <div className="min-w-0">

                                        <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-gray-400">
                                          No. Invoice / Transaksi
                                        </p>

                                        <p className="mt-0.5 truncate font-mono text-[10px] font-bold text-[#35564C]">
                                          {history.number || "-"}
                                        </p>

                                      </div>

                                    </div>

                                  </div>

                                </td>

                                <td className="px-4 py-4 text-right">

                                  {isIn ? (
                                    <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-[10px] font-bold text-emerald-700">

                                      <ArrowDownCircle size={12} />

                                      +{formatNumber(
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

                                      <ArrowUpCircle size={12} />

                                      -{formatNumber(
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

                                  <span
                                    className={`inline-flex min-w-[82px] items-center justify-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[9px] font-bold ${status.className}`}
                                  >

                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                                    />

                                    {status.text}

                                  </span>

                                </td>

                                <td className="px-4 py-4">

                                  <div className="max-w-[410px]">

                                    <p className="text-[10px] leading-5 text-gray-600">
                                      {history.description || "-"}
                                    </p>

                                    {(history.stockBefore !== null ||
                                      history.stockAfter !== null) && (
                                      <div className="mt-2 flex items-center gap-2 text-[9px] text-gray-400">

                                        <span className="font-medium">
                                          Stock
                                        </span>

                                        <span className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-semibold text-gray-500">
                                          {history.stockBefore !== null
                                            ? formatNumber(
                                                Number(
                                                  history.stockBefore
                                                )
                                              )
                                            : "-"}
                                        </span>

                                        <ChevronRight size={10} />

                                        <span className="rounded-md border border-[#DCEBE4] bg-[#EAF3EF] px-1.5 py-0.5 font-semibold text-[#497F70]">
                                          {history.stockAfter !== null
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

            {/* FOOTER */}

            <div className="flex flex-col gap-3 border-t border-[#E5ECE9] bg-[#FAFCFB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">

              <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400">

                <span className="flex items-center gap-2">
                  <LockKeyhole size={12} />
                  History hanya untuk monitoring.
                </span>

                <span className="h-1 w-1 rounded-full bg-gray-300" />

                <span className="flex items-center gap-1.5">
                  <CircleDot size={10} />
                  Harga berasal dari Master Harga terbaru.
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