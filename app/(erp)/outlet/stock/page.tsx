"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Search,
  RefreshCw,
  Package,
  Warehouse,
  ChevronDown,
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
  Boxes,
  TrendingUp,
  TrendingDown,
  Activity,
  ShieldCheck,
  Barcode,
  Scale,
  CircleCheck,
  AlertTriangle,
  CircleX,
  SlidersHorizontal,
  ChevronRight,
} from "lucide-react";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type CurrentUser = {
  id: number;
  role: string;
  outletId: number | null;
  outlet?: {
    id: number;
    code: string;
    name: string;
  } | null;
};

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

type Barang = {
  id: number;
  code: string;
  name: string;
  unit: string;

  baseUnit: string | null;
  conversionRate: number;

  barcode: string | null;

  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;

  displayUnit?: string;
  conversionLabel?: string;

  stockDisplayQty?: number;
  stockDisplayUnit?: string;

  convertedStockQty?: number;
  convertedStockUnit?: string;

  minimumStockDisplayQty?: number;
  minimumStockDisplayUnit?: string;

  minimumStockConvertedQty?: number;
  minimumStockConvertedUnit?: string;
};

type Stock = {
  id: number;
  outletId: number;
  barangId: number;

  stock: number;

  minimumStock: number;
  averageCost: number;

  displayQty?: number;
  displayUnit?: string;

  convertedStockQty?: number;
  convertedStockUnit?: string;

  baseQty?: number;
  baseUnit?: string;

  conversionRate?: number;
  conversionLabel?: string;

  minimumStockBaseQty?: number;
  minimumStockDisplayQty?: number;
  minimumStockDisplayUnit?: string;

  minimumStockConvertedQty?: number;
  minimumStockConvertedUnit?: string;

  barang: Barang;

  outlet: {
    id: number;
    code: string;
    name: string;
  };

  lastOpname: LastOpname | null;
};

type ApiResponse = {
  success: boolean;
  data: Stock[];

  summary?: {
    totalStockItems?: number;
    totalStockQty?: number;
    totalConvertedStockQty?: number;
    itemsWithOpname?: number;
    itemsWithoutOpname?: number;
  };

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

export default function OutletStockPage() {
  const [data, setData] = useState<Stock[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState("");
  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  const [loadingUser, setLoadingUser] =
    useState(true);

  const [search, setSearch] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [loadingOutlet, setLoadingOutlet] =
    useState(true);

  const [error, setError] = useState("");

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
  // ROLE
  // =====================================================

  function normalizeRole(
    role: unknown
  ) {
    return String(role || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
  }

  function isOutletAdmin(
    user: CurrentUser | null = currentUser
  ) {
    const role = normalizeRole(
      user?.role
    );

    return (
      role === "ADMIN_OUTLET" ||
      role === "OUTLET_ADMIN"
    );
  }

  const lockedOutletId =
    currentUser?.outletId !== null &&
    currentUser?.outletId !== undefined
      ? String(currentUser.outletId)
      : "";

  const outletLocked =
    isOutletAdmin(currentUser) &&
    lockedOutletId !== "";

  // =====================================================
  // FORMAT
  // =====================================================

  function formatNumber(value: number) {
    return Number(value ?? 0).toLocaleString(
      "id-ID",
      {
        maximumFractionDigits: 4,
      }
    );
  }

  function formatDate(value?: string | null) {
    if (!value) return "-";

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

  function formatDateTime(value?: string | null) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // =====================================================
  // LOAD CURRENT USER
  // =====================================================

  async function loadCurrentUser() {
    try {
      setLoadingUser(true);

      const res = await fetch("/api/me", {
        cache: "no-store",
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(
          result?.message ||
            "Gagal mengambil data user"
        );
      }

      /*
       * /api/me mengembalikan:
       *
       * {
       *   success: true,
       *   user: {
       *     id,
       *     role,
       *     outletId,
       *     outlet
       *   }
       * }
       *
       * Jadi user HARUS diambil dari result.user.
       *
       * Fallback tetap dipertahankan agar frontend
       * kompatibel jika response API berubah menjadi
       * result.data atau langsung object user.
       */
      const user =
        result?.user ??
        result?.data?.user ??
        result?.data ??
        result;

      const normalizedUser: CurrentUser = {
        id: Number(user?.id || 0),

        role: String(
          user?.role || ""
        )
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "_"),

        outletId:
          user?.outletId !== null &&
          user?.outletId !== undefined
            ? Number(user.outletId)
            : null,

        outlet: user?.outlet
          ? {
              id: Number(
                user.outlet.id
              ),
              code: String(
                user.outlet.code || ""
              ),
              name: String(
                user.outlet.name || ""
              ),
            }
          : null,
      };

      setCurrentUser(normalizedUser);

      const role = normalizeRole(
        normalizedUser.role
      );

      const isAdminOutlet =
        role === "ADMIN_OUTLET" ||
        role === "OUTLET_ADMIN";

      // ===================================================
      // HARD LOCK OUTLET SESUAI AKUN
      // ===================================================

      if (
        isAdminOutlet &&
        normalizedUser.outletId !== null &&
        normalizedUser.outletId !== undefined
      ) {
        setOutletId(
          String(
            normalizedUser.outletId
          )
        );
      }
    } catch (error) {
      console.error(
        "LOAD CURRENT USER ERROR:",
        error
      );

      setCurrentUser(null);
    } finally {
      setLoadingUser(false);
    }
  }

  // =====================================================
  // LOAD OUTLET
  // =====================================================

  async function loadOutlets() {
    try {
      setLoadingOutlet(true);

      const res = await fetch("/api/outlet", {
        cache: "no-store",
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(
          result?.message ||
            "Gagal mengambil data outlet"
        );
      }

      const list = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
        ? result.data
        : [];

      setOutlets(list);
    } catch (error) {
      console.error(
        "LOAD OUTLET ERROR:",
        error
      );

      setOutlets([]);
    } finally {
      setLoadingOutlet(false);
    }
  }

  // =====================================================
  // LOAD STOCK
  // =====================================================

  async function loadStock(
    selectedOutlet = outletId
  ) {
    try {
      setLoading(true);
      setError("");

      let targetOutlet = selectedOutlet;

      // =================================================
      // HARD LOCK ADMIN OUTLET / OUTLET ADMIN
      // =================================================

      if (
        isOutletAdmin(currentUser) &&
        currentUser?.outletId !== null &&
        currentUser?.outletId !== undefined
      ) {
        targetOutlet = String(
          currentUser.outletId
        );
      }

      const url = targetOutlet
        ? `/api/outlet/stock?outletId=${encodeURIComponent(
            targetOutlet
          )}`
        : "/api/outlet/stock";

      const res = await fetch(url, {
        cache: "no-store",
      });

      const result: ApiResponse =
        await res.json();

      if (!res.ok || !result.success) {
        throw new Error(
          result.message ||
            "Gagal mengambil stock outlet"
        );
      }

      setData(
        Array.isArray(result.data)
          ? result.data
          : []
      );
    } catch (error: any) {
      console.error(
        "LOAD OUTLET STOCK ERROR:",
        error
      );

      setData([]);

      setError(
        error?.message ||
          "Gagal mengambil stock outlet"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // INITIAL
  // =====================================================

  useEffect(() => {
    loadCurrentUser();
    loadOutlets();
  }, []);

  // =====================================================
  // LOAD STOCK AFTER USER
  // =====================================================

  useEffect(() => {
    if (loadingUser) return;

    // ===================================================
    // ADMIN OUTLET / OUTLET ADMIN
    // SELALU KE OUTLET AKUN
    // ===================================================

    if (
      isOutletAdmin(currentUser) &&
      currentUser?.outletId !== null &&
      currentUser?.outletId !== undefined
    ) {
      const id = String(
        currentUser.outletId
      );

      setOutletId(id);
      loadStock(id);

      return;
    }

    // ===================================================
    // ROLE LAIN
    // DEFAULT SEMUA OUTLET
    // ===================================================

    setOutletId("");
    loadStock("");
  }, [
    loadingUser,
    currentUser?.outletId,
    currentUser?.role,
  ]);

  // =====================================================
  // OUTLET CHANGE
  // =====================================================

  function handleOutletChange(
    value: string
  ) {
    // ===================================================
    // HARD LOCK
    // ADMIN_OUTLET / OUTLET_ADMIN
    // ===================================================

    if (isOutletAdmin(currentUser)) {
      const accountOutletId =
        currentUser?.outletId;

      if (
        accountOutletId === null ||
        accountOutletId === undefined
      ) {
        setOutletId("");

        setError(
          "Akun outlet tidak memiliki outlet yang terhubung."
        );

        return;
      }

      const lockedId =
        String(accountOutletId);

      // Selalu paksa kembali ke outlet akun
      setOutletId(lockedId);

      // Jangan pernah gunakan value
      // dari dropdown untuk role outlet
      loadStock(lockedId);

      return;
    }

    // ===================================================
    // ROLE LAIN
    // BOLEH MEMILIH OUTLET
    // ===================================================

    setOutletId(value);
    loadStock(value);
  }

  // =====================================================
  // SEARCH
  // =====================================================

  const filteredData = useMemo(() => {
    const keyword = search
      .toLowerCase()
      .trim();

    if (!keyword) return data;

    return data.filter((item) => {
      const code =
        item.barang?.code?.toLowerCase() ||
        "";

      const name =
        item.barang?.name?.toLowerCase() ||
        "";

      const barcode =
        item.barang?.barcode?.toLowerCase() ||
        "";

      return (
        code.includes(keyword) ||
        name.includes(keyword) ||
        barcode.includes(keyword)
      );
    });
  }, [data, search]);

  // =====================================================
  // STATUS
  // =====================================================

  function getStatus(
    stock: number,
    minimum: number
  ) {
    if (stock <= 0) {
      return {
        text: "HABIS",
        icon: CircleX,
        className:
          "border-red-200 bg-red-50 text-red-700",
        dot: "bg-red-500",
      };
    }

    if (stock <= minimum) {
      return {
        text: "MINIMUM",
        icon: AlertTriangle,
        className:
          "border-amber-200 bg-amber-50 text-amber-700",
        dot: "bg-amber-500",
      };
    }

    return {
      text: "AMAN",
      icon: CircleCheck,
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
    };
  }

  function getOpnameStatus(
    status?: string
  ) {
    const value = String(status || "")
      .toUpperCase();

    if (value === "APPROVED") {
      return {
        text: "APPROVED",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    }

    if (
      value === "COUNTING" ||
      value === "PENDING" ||
      value === "WAITING"
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
  // HISTORY TYPE
  // =====================================================

  function getHistoryType(type: string) {
    switch (
      String(type || "").toUpperCase()
    ) {
      case "OUTLET_RECEIPT":
        return {
          text: "Barang Masuk Supplier",
          className:
            "border-emerald-200 bg-emerald-50 text-emerald-700",
        };

      case "TRANSFER_IN":
        return {
          text: "Transfer Masuk",
          className:
            "border-blue-200 bg-blue-50 text-blue-700",
        };

      case "TRANSFER_OUT":
        return {
          text: "Transfer Keluar",
          className:
            "border-orange-200 bg-orange-50 text-orange-700",
        };

      case "DELIVERY_IN":
        return {
          text: "Delivery Masuk",
          className:
            "border-blue-200 bg-blue-50 text-blue-700",
        };

      case "POS_OUT":
        return {
          text: "Pemakaian POS",
          className:
            "border-red-200 bg-red-50 text-red-700",
        };

      case "MANUFACTURE_CONSUME":
        return {
          text: "Konsumsi Manufacture",
          className:
            "border-orange-200 bg-orange-50 text-orange-700",
        };

      case "MANUFACTURE_OUTPUT":
        return {
          text: "Hasil Manufacture",
          className:
            "border-emerald-200 bg-emerald-50 text-emerald-700",
        };

      case "STOCK_OUT":
        return {
          text: "Pemakaian / Waste",
          className:
            "border-red-200 bg-red-50 text-red-700",
        };

      case "STOCK_OPNAME":
        return {
          text: "Stock Opname",
          className:
            "border-purple-200 bg-purple-50 text-purple-700",
        };

      case "STOCK_OPNAME_HISTORY":
        return {
          text: "History Stock Opname",
          className:
            "border-purple-200 bg-purple-50 text-purple-700",
        };

      case "OUTLET_PURCHASE":
        return {
          text: "Purchase Order",
          className:
            "border-gray-200 bg-gray-50 text-gray-700",
        };

      case "ADJUSTMENT_IN":
        return {
          text: "Adjustment Masuk",
          className:
            "border-emerald-200 bg-emerald-50 text-emerald-700",
        };

      case "ADJUSTMENT_OUT":
        return {
          text: "Adjustment Keluar",
          className:
            "border-red-200 bg-red-50 text-red-700",
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
  // SUMMARY
  // =====================================================

  const totalStock = useMemo(() => {
    return filteredData.reduce(
      (total, item) =>
        total + Number(item.stock || 0),
      0
    );
  }, [filteredData]);

  const totalConvertedStock = useMemo(() => {
    return filteredData.reduce(
      (total, item) =>
        total +
        Number(
          item.convertedStockQty || 0
        ),
      0
    );
  }, [filteredData]);

  const totalWithOpname = useMemo(() => {
    return filteredData.filter(
      (item) =>
        item.lastOpname !== null
    ).length;
  }, [filteredData]);

  const totalWithoutOpname =
    Math.max(
      filteredData.length -
        totalWithOpname,
      0
    );

  const totalDifference = useMemo(() => {
    return filteredData.reduce(
      (total, item) =>
        total +
        Number(
          item.lastOpname?.difference ||
            0
        ),
      0
    );
  }, [filteredData]);

  const stockSafeCount = useMemo(() => {
    return filteredData.filter(
      (item) =>
        Number(item.stock || 0) >
        Number(item.minimumStock || 0)
    ).length;
  }, [filteredData]);

  const stockMinimumCount = useMemo(() => {
    return filteredData.filter(
      (item) => {
        const stock = Number(
          item.stock || 0
        );

        const minimum = Number(
          item.minimumStock || 0
        );

        return (
          stock > 0 &&
          stock <= minimum
        );
      }
    ).length;
  }, [filteredData]);

  const stockEmptyCount = useMemo(() => {
    return filteredData.filter(
      (item) =>
        Number(item.stock || 0) <= 0
    ).length;
  }, [filteredData]);

  // =====================================================
  // SELECTED OUTLET
  // =====================================================

  const selectedOutlet = outlets.find(
    (item) =>
      String(item.id) === outletId
  );

  const userOutlet =
    outlets.find(
      (item) =>
        String(item.id) ===
        lockedOutletId
    ) ||
    currentUser?.outlet ||
    null;

  // =====================================================
  // HISTORY
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

      const targetOutletId =
        isOutletAdmin(currentUser) &&
        currentUser?.outletId !== null &&
        currentUser?.outletId !== undefined
          ? String(
              currentUser.outletId
            )
          : outletId ||
            String(stock.outletId);

      params.set(
        "outletId",
        targetOutletId
      );

      params.set(
        "barangId",
        String(stock.barangId)
      );

      const res = await fetch(
        `/api/outlet/stock/history?${params.toString()}`,
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
        total: Number(
          result.summary?.total || 0
        ),
        stockIn: Number(
          result.summary?.stockIn || 0
        ),
        stockOut: Number(
          result.summary?.stockOut || 0
        ),
        informational: Number(
          result.summary?.informational ||
            0
        ),
      });
    } catch (error: any) {
      console.error(
        "LOAD HISTORY ERROR:",
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
    <div className="min-h-full bg-[#F3F7F5] p-4 md:p-6 lg:p-8">

      {/* =================================================
          PREMIUM BACKGROUND
      ================================================= */}

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">

        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#497F70]/10 blur-3xl" />

        <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-[#18352D]/5 blur-3xl" />

      </div>

      {/* =================================================
          TOP HEADER
      ================================================= */}

      <div className="mb-6 overflow-hidden rounded-[28px] border border-[#D9E8E2] bg-[#173B31] shadow-[0_18px_55px_rgba(24,53,45,0.14)]">

        <div className="relative px-5 py-5 md:px-7 md:py-6">

          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-white/5 blur-3xl" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

            {/* BRAND */}

            <div className="flex items-center gap-4">

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur">

                <Warehouse
                  size={27}
                  className="text-white"
                />

              </div>

              <div>

                <div className="flex flex-wrap items-center gap-2">

                  <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">
                    Stock Outlet
                  </h1>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200">

                    <Activity size={11} />

                    Inventory Live

                  </span>

                </div>

                <p className="mt-1.5 max-w-2xl text-xs leading-5 text-white/60 md:text-sm">
                  Monitoring persediaan outlet,
                  stock opname, konversi satuan,
                  dan seluruh pergerakan barang.
                </p>

              </div>

            </div>

            {/* HEADER RIGHT */}

            <div className="flex flex-wrap items-center gap-3">

              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur">

                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">

                  <ShieldCheck
                    size={15}
                    className="text-emerald-300"
                  />

                </div>

                <div>

                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                    Access
                  </p>

                  <p className="text-xs font-semibold text-white">
                    {outletLocked
                      ? "Outlet Restricted"
                      : "Central Access"}
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={() =>
                  loadStock(
                    outletLocked
                      ? lockedOutletId
                      : outletId
                  )
                }
                disabled={
                  loading ||
                  loadingUser
                }
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  rounded-2xl
                  border
                  border-white/10
                  bg-white
                  px-4
                  py-3
                  text-xs
                  font-bold
                  text-[#173B31]
                  shadow-lg
                  transition
                  hover:bg-emerald-50
                  active:scale-[0.98]
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >

                <RefreshCw
                  size={15}
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

          {/* MINI STATUS BAR */}

          <div className="relative mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">

            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">

              <p className="text-[9px] font-bold uppercase tracking-wider text-white/35">
                Barang
              </p>

              <p className="mt-1 text-lg font-bold text-white">
                {formatNumber(
                  filteredData.length
                )}
              </p>

            </div>

            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">

              <p className="text-[9px] font-bold uppercase tracking-wider text-white/35">
                Stock Aman
              </p>

              <p className="mt-1 text-lg font-bold text-emerald-300">
                {formatNumber(
                  stockSafeCount
                )}
              </p>

            </div>

            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">

              <p className="text-[9px] font-bold uppercase tracking-wider text-white/35">
                Perlu Perhatian
              </p>

              <p className="mt-1 text-lg font-bold text-amber-300">
                {formatNumber(
                  stockMinimumCount
                )}
              </p>

            </div>

            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">

              <p className="text-[9px] font-bold uppercase tracking-wider text-white/35">
                Habis
              </p>

              <p className="mt-1 text-lg font-bold text-red-300">
                {formatNumber(
                  stockEmptyCount
                )}
              </p>

            </div>

          </div>

        </div>

      </div>

      {/* =================================================
          ACCESS INFO
      ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">

        <div className="relative overflow-hidden rounded-2xl border border-[#CFE3DA] bg-gradient-to-br from-[#ECF7F2] to-white p-5 shadow-sm">

          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#497F70]/10" />

          <div className="relative flex items-start gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DCEDE5] text-[#497F70]">

              {outletLocked ? (
                <LockKeyhole size={18} />
              ) : (
                <ShieldCheck size={18} />
              )}

            </div>

            <div className="min-w-0">

              <div className="flex flex-wrap items-center gap-2">

                <p className="text-sm font-bold text-[#285346]">
                  {outletLocked
                    ? "Outlet akun terkunci"
                    : "Stock sistem terkunci"}
                </p>

                <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#497F70] shadow-sm">
                  Protected
                </span>

              </div>

              <p className="mt-1 text-xs leading-5 text-[#56766B]">
                {outletLocked
                  ? "Akun Admin Outlet hanya dapat melihat stock dari outlet yang terhubung dengan akun."
                  : "Stock utama menggunakan satuan Master Barang. Konversi hanya ditampilkan sebagai informasi tambahan."}
              </p>

              {userOutlet && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#D7E7E0] bg-white px-3 py-2 text-xs font-bold text-[#497F70] shadow-sm">

                  <Warehouse size={13} />

                  {userOutlet.code} —{" "}
                  {userOutlet.name}

                </div>
              )}

            </div>

          </div>

        </div>

        <div className="rounded-2xl border border-[#DCE7E2] bg-white p-5 shadow-sm">

          <div className="flex items-start gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F3] text-[#497F70]">
              <Scale size={18} />
            </div>

            <div>

              <p className="text-sm font-bold text-[#18352D]">
                Kontrol satuan & konversi
              </p>

              <p className="mt-1 text-xs leading-5 text-gray-500">
                Qty utama tetap mengikuti
                satuan barang. Nilai konversi
                tidak mengubah stock sistem.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">

                <span className="rounded-lg bg-[#F5F8F6] px-2.5 py-1 text-[10px] font-semibold text-[#56766B]">
                  Stock Utama
                </span>

                <span className="rounded-lg bg-[#F5F8F6] px-2.5 py-1 text-[10px] font-semibold text-[#56766B]">
                  Konversi
                </span>

                <span className="rounded-lg bg-[#F5F8F6] px-2.5 py-1 text-[10px] font-semibold text-[#56766B]">
                  Stock Opname
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
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">

          <CircleX
            size={19}
            className="mt-0.5 shrink-0"
          />

          <div>

            <p className="font-bold">
              Gagal memuat stock
            </p>

            <p className="mt-0.5 text-xs text-red-600">
              {error}
            </p>

          </div>

        </div>
      )}

      {/* =================================================
          FILTER BAR
      ================================================= */}

      <div className="mb-6 rounded-[24px] border border-[#DCE8E3] bg-white p-4 shadow-[0_8px_30px_rgba(24,53,45,0.05)] md:p-5">

        <div className="mb-4 flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <SlidersHorizontal size={17} />
            </div>

            <div>

              <h2 className="text-sm font-bold text-[#18352D]">
                Filter Persediaan
              </h2>

              <p className="text-[11px] text-gray-400">
                Atur outlet dan pencarian barang
              </p>

            </div>

          </div>

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="hidden rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 md:block"
            >
              Reset pencarian
            </button>
          )}

        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[0.8fr_1.2fr]">

          {/* =================================================
              OUTLET
          ================================================= */}

          <div>

            <div className="mb-1.5 flex items-center justify-between">

              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Outlet
              </label>

              {outletLocked && (
                <span className="inline-flex items-center gap-1 rounded-md border border-[#DCE8E3] bg-[#F4F8F6] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#497F70]">

                  <LockKeyhole size={10} />

                  Terkunci

                </span>
              )}

            </div>

            {/* =================================================
                SELECT OUTLET

                ADMIN_OUTLET / OUTLET_ADMIN:
                - TIDAK merender <select>
                - benar-benar tidak bisa dibuka
                - tidak bisa memilih outlet lain
                - tidak ada "Semua Outlet"
            ================================================= */}

            <div className="relative">

              <Warehouse
                size={16}
                className={`
                  pointer-events-none
                  absolute
                  left-3.5
                  top-1/2
                  z-10
                  -translate-y-1/2
                  ${
                    outletLocked
                      ? "text-gray-400"
                      : "text-[#497F70]"
                  }
                `}
              />

              {outletLocked ? (

                /*
                 * PENTING:
                 * Untuk outlet admin TIDAK ADA <select>.
                 *
                 * Jadi browser tidak mungkin membuka
                 * native dropdown meskipun diklik.
                 */
                <div
                  aria-disabled="true"
                  className="
                    w-full
                    select-none
                    rounded-xl
                    border
                    border-[#DCE5E1]
                    bg-[#F1F5F3]
                    px-4
                    py-3
                    pl-10
                    pr-10
                    text-sm
                    font-semibold
                    text-[#587168]
                    shadow-inner
                    cursor-default
                  "
                >
                  {userOutlet
                    ? `${userOutlet.code} — ${userOutlet.name}`
                    : "Outlet Anda"}
                </div>

              ) : (

                <select
                  value={outletId}
                  onChange={(e) =>
                    handleOutletChange(
                      e.target.value
                    )
                  }
                  disabled={
                    loadingOutlet ||
                    loadingUser
                  }
                  className="
                    w-full
                    appearance-none
                    rounded-xl
                    border
                    border-[#D6E4DE]
                    bg-[#F9FBFA]
                    px-4
                    py-3
                    pl-10
                    pr-10
                    text-sm
                    font-semibold
                    text-[#35564C]
                    outline-none
                    transition
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-4
                    focus:ring-[#497F70]/10
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                >

                  <option value="">
                    Semua Outlet
                  </option>

                  {outlets.map(
                    (outlet) => (
                      <option
                        key={outlet.id}
                        value={String(
                          outlet.id
                        )}
                      >
                        {outlet.code} —{" "}
                        {outlet.name}
                      </option>
                    )
                  )}

                </select>

              )}

              {outletLocked ? (

                <LockKeyhole
                  size={15}
                  className="
                    pointer-events-none
                    absolute
                    right-3.5
                    top-1/2
                    -translate-y-1/2
                    text-gray-400
                  "
                />

              ) : (

                <ChevronDown
                  size={16}
                  className="
                    pointer-events-none
                    absolute
                    right-3.5
                    top-1/2
                    -translate-y-1/2
                    text-gray-400
                  "
                />

              )}

            </div>

            {outletLocked ? (

              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-gray-400">

                <ShieldCheck size={11} />

                Outlet dikunci sesuai outlet akun login

              </div>

            ) : (

              <div className="mt-1.5 text-[10px] font-medium text-gray-400">

                Admin pusat dapat memilih outlet

              </div>

            )}

          </div>

          {/* =================================================
              SEARCH
          ================================================= */}

          <div>

            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Cari Barang
            </label>

            <div className="relative">

              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#497F70]"
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
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D6E4DE]
                  bg-[#F9FBFA]
                  py-3
                  pl-10
                  pr-4
                  text-sm
                  font-medium
                  text-[#18352D]
                  outline-none
                  transition
                  placeholder:text-gray-400
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-4
                  focus:ring-[#497F70]/10
                "
              />

              {!search && (
                <span className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded-md bg-white px-2 py-1 text-[9px] font-bold text-gray-300 shadow-sm ring-1 ring-gray-100 md:block">
                  SEARCH
                </span>
              )}

            </div>

          </div>

        </div>

        {/* ACTIVE FILTER */}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#EEF3F0] pt-4">

          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            View:
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE9E3] bg-[#F4F9F7] px-2.5 py-1.5 text-[10px] font-bold text-[#497F70]">

            <Warehouse size={11} />

            {outletLocked
              ? userOutlet
                ? `${userOutlet.code} — ${userOutlet.name}`
                : "Outlet Anda"
              : selectedOutlet
              ? `${selectedOutlet.code} — ${selectedOutlet.name}`
              : "Semua Outlet"}

          </span>

          {outletLocked && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[10px] font-semibold text-gray-500">

              <LockKeyhole size={10} />

              Restricted

            </span>
          )}

          {search && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[10px] font-semibold text-blue-600">

              <Search size={10} />

              "{search}"

            </span>
          )}

          <span className="ml-auto text-[10px] font-medium text-gray-400">

            {formatNumber(
              filteredData.length
            )}{" "}
            barang

          </span>

        </div>

      </div>

      {/* =================================================
          KPI CARDS
      ================================================= */}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">

        {/* BARANG */}

        <div className="group relative overflow-hidden rounded-2xl border border-[#DCE8E3] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-5">

          <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-[#497F70]/5 blur-2xl transition group-hover:bg-[#497F70]/10" />

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Jenis Barang
              </p>

              <p className="mt-2 text-2xl font-black tracking-tight text-[#18352D]">
                {formatNumber(
                  filteredData.length
                )}
              </p>

              <p className="mt-1 text-[10px] text-gray-400">
                item terdaftar
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Boxes size={19} />
            </div>

          </div>

        </div>

        {/* STOCK */}

        <div className="group relative overflow-hidden rounded-2xl border border-[#DCE8E3] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-5">

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Total Stock
              </p>

              <p className="mt-2 text-2xl font-black tracking-tight text-[#18352D]">
                {formatNumber(
                  totalStock
                )}
              </p>

              <p className="mt-1 text-[10px] text-gray-400">
                qty satuan utama
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EDF6F1] text-[#497F70]">
              <Warehouse size={19} />
            </div>

          </div>

        </div>

        {/* OPNAME */}

        <div className="group relative overflow-hidden rounded-2xl border border-[#DCE8E3] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-5">

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Stock Opname
              </p>

              <p className="mt-2 text-2xl font-black tracking-tight text-[#18352D]">
                {formatNumber(
                  totalWithOpname
                )}
              </p>

              <p className="mt-1 text-[10px] text-gray-400">

                {formatNumber(
                  totalWithoutOpname
                )}{" "}
                belum SO

              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ClipboardCheck size={19} />
            </div>

          </div>

        </div>

        {/* DIFFERENCE */}

        <div className="group relative overflow-hidden rounded-2xl border border-[#DCE8E3] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-5">

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Selisih SO
              </p>

              <p
                className={`mt-2 text-2xl font-black tracking-tight ${
                  totalDifference > 0
                    ? "text-emerald-600"
                    : totalDifference < 0
                    ? "text-red-600"
                    : "text-[#18352D]"
                }`}
              >

                {totalDifference > 0
                  ? "+"
                  : ""}

                {formatNumber(
                  totalDifference
                )}

              </p>

              <p className="mt-1 text-[10px] text-gray-400">
                hasil opname terakhir
              </p>

            </div>

            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                totalDifference > 0
                  ? "bg-emerald-50 text-emerald-600"
                  : totalDifference < 0
                  ? "bg-red-50 text-red-600"
                  : "bg-gray-50 text-gray-500"
              }`}
            >

              {totalDifference > 0 ? (
                <TrendingUp size={19} />
              ) : totalDifference < 0 ? (
                <TrendingDown size={19} />
              ) : (
                <Minus size={19} />
              )}

            </div>

          </div>

        </div>

      </div>

      {/* =================================================
          MAIN INVENTORY
      ================================================= */}

      <div className="overflow-hidden rounded-[26px] border border-[#DCE8E3] bg-white shadow-[0_12px_40px_rgba(24,53,45,0.06)]">

        {/* TABLE HEADER */}

        <div className="flex flex-col gap-4 border-b border-[#E8EFEC] bg-gradient-to-r from-white to-[#F8FBF9] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173B31] text-white shadow-sm">
              <Package size={18} />
            </div>

            <div>

              <div className="flex items-center gap-2">

                <h2 className="text-sm font-bold text-[#18352D] md:text-base">
                  Persediaan Outlet
                </h2>

                <span className="rounded-full bg-[#EAF3EF] px-2 py-0.5 text-[9px] font-bold text-[#497F70]">
                  LIVE
                </span>

              </div>

              <p className="mt-0.5 text-[11px] text-gray-400">
                Data stock berdasarkan outlet
                yang dipilih
              </p>

            </div>

          </div>

          <div className="flex flex-wrap items-center gap-2">

            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDE9E4] bg-[#F8FAF9] px-3 py-2 text-[10px] font-semibold text-gray-500">
              <LockKeyhole size={12} />
              Read Only
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDE9E4] bg-[#F8FAF9] px-3 py-2 text-[10px] font-semibold text-gray-500">
              <Scale size={12} />
              Base Unit
            </span>

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="min-w-[1650px] w-full text-sm">

            <thead className="bg-[#F7FAF8]">

              <tr className="border-b border-[#E4ECE8]">

                {[
                  "No",
                  "Outlet",
                  "Barang",
                  "Satuan",
                  "Stock Sistem",
                  "Konversi",
                  "SO Terakhir",
                  "Fisik",
                  "Selisih",
                  "Status SO",
                  "Minimum",
                  "Status Stock",
                  "History",
                ].map((header) => (
                  <th
                    key={header}
                    className={`px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-[#587168] ${
                      [
                        "Stock Sistem",
                        "Konversi",
                        "SO Terakhir",
                        "Fisik",
                        "Selisih",
                        "Minimum",
                      ].includes(header)
                        ? "text-right"
                        : ""
                    } ${
                      [
                        "Status SO",
                        "Status Stock",
                        "History",
                      ].includes(header)
                        ? "text-center"
                        : ""
                    }`}
                  >
                    {header}
                  </th>
                ))}

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan={13}
                    className="px-5 py-20 text-center"
                  >

                    <div className="mx-auto flex max-w-xs flex-col items-center">

                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3EF]">

                        <RefreshCw
                          size={24}
                          className="animate-spin text-[#497F70]"
                        />

                      </div>

                      <p className="text-sm font-bold text-[#35564C]">
                        Memuat persediaan
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Mengambil data stock outlet...
                      </p>

                    </div>

                  </td>

                </tr>

              ) : filteredData.length === 0 ? (

                <tr>

                  <td
                    colSpan={13}
                    className="px-5 py-20 text-center"
                  >

                    <div className="mx-auto flex max-w-sm flex-col items-center">

                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F1F5F3] text-gray-300">
                        <Package size={30} />
                      </div>

                      <p className="font-bold text-gray-500">
                        Belum ada data stock
                      </p>

                      <p className="mt-1 text-xs leading-5 text-gray-400">
                        Tidak ditemukan barang
                        sesuai filter atau outlet
                        belum memiliki persediaan.
                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                filteredData.map(
                  (item, index) => {

                    const stockStatus =
                      getStatus(
                        Number(item.stock),
                        Number(
                          item.minimumStock
                        )
                      );

                    const lastOpname =
                      item.lastOpname;

                    const difference =
                      Number(
                        lastOpname?.difference ||
                          0
                      );

                    const opnameStatus =
                      getOpnameStatus(
                        lastOpname?.status
                      );

                    const mainUnit =
                      item.barang?.unit ||
                      item.displayUnit ||
                      "-";

                    const convertedQty =
                      Number(
                        item.convertedStockQty ||
                          0
                      );

                    const convertedUnit =
                      item.convertedStockUnit ||
                      item.barang?.baseUnit ||
                      "";

                    const conversionRate =
                      Number(
                        item.conversionRate ||
                          item.barang
                            ?.conversionRate ||
                          1
                      );

                    const StatusIcon =
                      stockStatus.icon;

                    return (
                      <tr
                        key={item.id}
                        className="
                          group
                          border-b
                          border-[#EDF2EF]
                          transition
                          hover:bg-[#FAFCFB]
                        "
                      >

                        {/* NO */}

                        <td className="px-5 py-4 text-xs font-semibold text-gray-400">
                          {String(
                            index + 1
                          ).padStart(
                            2,
                            "0"
                          )}
                        </td>

                        {/* OUTLET */}

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-2.5">

                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EDF5F1] text-[#497F70]">
                              <Warehouse size={14} />
                            </div>

                            <div>

                              <div className="font-bold text-[#18352D]">
                                {item.outlet
                                  ?.name ||
                                  "-"}
                              </div>

                              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                {item.outlet
                                  ?.code ||
                                  "-"}
                              </div>

                            </div>

                          </div>

                        </td>

                        {/* BARANG */}

                        <td className="px-5 py-4">

                          <div className="min-w-[220px]">

                            <div className="flex items-center gap-2">

                              <span className="font-black text-[#35564C]">
                                {item.barang
                                  ?.code ||
                                  "-"}
                              </span>

                              {item.barang
                                ?.barcode && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-400">
                                  <Barcode size={9} />
                                  Barcode
                                </span>
                              )}

                            </div>

                            <div className="mt-1 font-medium text-[#18352D]">
                              {item.barang
                                ?.name ||
                                "-"}
                            </div>

                            {item.barang
                              ?.barcode && (
                              <div className="mt-0.5 font-mono text-[10px] text-gray-400">
                                {
                                  item.barang
                                    .barcode
                                }
                              </div>
                            )}

                          </div>

                        </td>

                        {/* SATUAN */}

                        <td className="px-5 py-4">

                          <div className="font-bold text-[#35564C]">
                            {mainUnit}
                          </div>

                          {conversionRate !==
                            1 &&
                            item.barang
                              ?.baseUnit && (
                              <div className="mt-1 rounded-md bg-[#F5F8F6] px-2 py-1 text-[9px] font-medium text-gray-400">
                                1 {mainUnit} ={" "}
                                {
                                  conversionRate
                                }{" "}
                                {
                                  item.barang
                                    .baseUnit
                                }
                              </div>
                            )}

                        </td>

                        {/* STOCK SISTEM */}

                        <td className="px-5 py-4 text-right">

                          <div className="inline-flex flex-col items-end">

                            <div className="flex items-center gap-1.5">

                              <LockKeyhole
                                size={11}
                                className="text-gray-300"
                              />

                              <span className="text-base font-black text-[#18352D]">
                                {formatNumber(
                                  Number(
                                    item.stock
                                  )
                                )}
                              </span>

                            </div>

                            <span className="text-[9px] font-semibold uppercase text-gray-400">
                              {mainUnit}
                            </span>

                          </div>

                        </td>

                        {/* KONVERSI */}

                        <td className="px-5 py-4 text-right">

                          {conversionRate !==
                            1 &&
                          convertedUnit ? (

                            <div>

                              <div className="font-black text-[#497F70]">
                                {formatNumber(
                                  convertedQty
                                )}
                              </div>

                              <div className="text-[9px] font-semibold uppercase text-gray-400">
                                {convertedUnit}
                              </div>

                            </div>

                          ) : (

                            <span className="text-xs text-gray-300">
                              —
                            </span>

                          )}

                        </td>

                        {/* SO */}

                        <td className="px-5 py-4 text-right">

                          {lastOpname ? (

                            <div>

                              <div className="font-bold text-[#35564C]">
                                {formatDate(
                                  lastOpname.date
                                )}
                              </div>

                              <div className="mt-0.5 font-mono text-[9px] text-gray-400">
                                {
                                  lastOpname.code
                                }
                              </div>

                            </div>

                          ) : (

                            <span className="rounded-lg bg-gray-50 px-2.5 py-1.5 text-[10px] font-semibold text-gray-400">
                              Belum SO
                            </span>

                          )}

                        </td>

                        {/* FISIK */}

                        <td className="px-5 py-4 text-right">

                          {lastOpname ? (

                            <div>

                              <span className="font-black text-[#18352D]">
                                {formatNumber(
                                  Number(
                                    lastOpname.physicalQty
                                  )
                                )}
                              </span>

                              <div className="text-[9px] uppercase text-gray-400">
                                {mainUnit}
                              </div>

                            </div>

                          ) : (

                            <span className="text-gray-300">
                              —
                            </span>

                          )}

                        </td>

                        {/* DIFFERENCE */}

                        <td className="px-5 py-4 text-right">

                          {!lastOpname ? (

                            <span className="text-gray-300">
                              —
                            </span>

                          ) : difference > 0 ? (

                            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 font-black text-emerald-700">

                              <ArrowUp size={12} />

                              +
                              {formatNumber(
                                difference
                              )}

                            </span>

                          ) : difference < 0 ? (

                            <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 font-black text-red-700">

                              <ArrowDown size={12} />

                              {formatNumber(
                                difference
                              )}

                            </span>

                          ) : (

                            <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1.5 font-bold text-gray-500">

                              <Minus size={12} />

                              0

                            </span>

                          )}

                        </td>

                        {/* STATUS SO */}

                        <td className="px-5 py-4 text-center">

                          {lastOpname ? (

                            <span
                              className={`
                                inline-flex
                                rounded-lg
                                border
                                px-2.5
                                py-1.5
                                text-[9px]
                                font-black
                                tracking-wide
                                ${opnameStatus.className}
                              `}
                            >
                              {
                                opnameStatus.text
                              }
                            </span>

                          ) : (

                            <span className="text-gray-300">
                              —
                            </span>

                          )}

                        </td>

                        {/* MINIMUM */}

                        <td className="px-5 py-4 text-right">

                          <div className="font-bold text-gray-600">
                            {formatNumber(
                              Number(
                                item.minimumStock
                              )
                            )}
                          </div>

                          <div className="text-[9px] uppercase text-gray-400">
                            {mainUnit}
                          </div>

                          {conversionRate !==
                            1 &&
                            item.minimumStockConvertedQty !==
                              undefined &&
                            item.barang
                              ?.baseUnit && (
                              <div className="mt-1 text-[9px] text-gray-400">

                                ≈{" "}

                                {formatNumber(
                                  Number(
                                    item.minimumStockConvertedQty
                                  )
                                )}{" "}

                                {
                                  item.barang
                                    .baseUnit
                                }

                              </div>
                            )}

                        </td>

                        {/* STATUS STOCK */}

                        <td className="px-5 py-4 text-center">

                          <span
                            className={`
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-lg
                              border
                              px-2.5
                              py-1.5
                              text-[9px]
                              font-black
                              tracking-wide
                              ${stockStatus.className}
                            `}
                          >

                            <span
                              className={`h-1.5 w-1.5 rounded-full ${stockStatus.dot}`}
                            />

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
                            className="
                              group/history
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-xl
                              border
                              border-[#D2E2DB]
                              bg-[#F7FBF9]
                              px-3
                              py-2
                              text-[10px]
                              font-black
                              text-[#497F70]
                              transition
                              hover:border-[#497F70]
                              hover:bg-[#497F70]
                              hover:text-white
                              active:scale-95
                            "
                          >

                            <History
                              size={13}
                            />

                            History

                            <ChevronRight
                              size={11}
                              className="transition group-hover/history:translate-x-0.5"
                            />

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

        {/* TABLE FOOTER */}

        {!loading &&
          filteredData.length > 0 && (

            <div className="flex flex-col gap-2 border-t border-[#E8EFEC] bg-[#FAFCFB] px-5 py-3.5 text-[10px] text-gray-400 md:flex-row md:items-center md:justify-between md:px-6">

              <div className="flex items-center gap-2">

                <Activity
                  size={12}
                  className="text-[#497F70]"
                />

                Menampilkan{" "}

                <strong className="text-gray-600">
                  {formatNumber(
                    filteredData.length
                  )}
                </strong>{" "}

                item persediaan

              </div>

              <div className="flex items-center gap-3">

                <span className="inline-flex items-center gap-1">

                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                  Aman{" "}
                  {stockSafeCount}

                </span>

                <span className="inline-flex items-center gap-1">

                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />

                  Minimum{" "}
                  {stockMinimumCount}

                </span>

                <span className="inline-flex items-center gap-1">

                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />

                  Habis{" "}
                  {stockEmptyCount}

                </span>

              </div>

            </div>

          )}

      </div>

      {/* =================================================
          HISTORY MODAL
      ================================================= */}

      {selectedHistory && (

        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-[#10251F]/70
            p-3
            backdrop-blur-md
            md:p-6
          "
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeHistory();
            }
          }}
        >

          <div className="flex max-h-[94vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.28)]">

            {/* MODAL HEADER */}

            <div className="relative overflow-hidden border-b border-[#E3ECE8] bg-[#173B31] px-5 py-5 text-white md:px-7 md:py-6">

              <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/5 blur-3xl" />

              <div className="relative flex items-start justify-between gap-4">

                <div className="min-w-0">

                  <div className="flex items-center gap-3">

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                      <History size={20} />
                    </div>

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-2">

                        <h2 className="text-lg font-black tracking-tight md:text-xl">
                          History Stock
                        </h2>

                        <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-200">
                          Audit Trail
                        </span>

                      </div>

                      <p className="mt-0.5 truncate text-xs text-white/55 md:text-sm">
                        {
                          selectedHistory
                            .barang.name
                        }
                      </p>

                    </div>

                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">

                    <span className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[10px] font-bold text-white">
                      {
                        selectedHistory
                          .barang.code
                      }
                    </span>

                    <span className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/70">
                      Unit:{" "}
                      {
                        selectedHistory
                          .barang.unit
                      }
                    </span>

                    <span className="rounded-lg bg-emerald-400/10 px-2.5 py-1.5 text-[10px] font-bold text-emerald-200">

                      Stock:{" "}

                      {formatNumber(
                        Number(
                          selectedHistory.stock
                        )
                      )}{" "}

                      {
                        selectedHistory
                          .barang.unit
                      }

                    </span>

                    {Number(
                      selectedHistory
                        .conversionRate ||
                        selectedHistory
                          .barang
                          .conversionRate ||
                        1
                    ) !== 1 &&
                      selectedHistory
                        .barang
                        .baseUnit && (

                        <span className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/70">

                          Konversi:{" "}

                          {formatNumber(
                            Number(
                              selectedHistory.convertedStockQty ||
                                0
                            )
                          )}{" "}

                          {
                            selectedHistory
                              .barang
                              .baseUnit
                          }

                        </span>

                      )}

                    <span className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/70">

                      Outlet:{" "}

                      {
                        selectedHistory
                          .outlet.name
                      }

                    </span>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={closeHistory}
                  aria-label="Tutup history"
                  className="
                    flex
                    h-10
                    w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    bg-white/10
                    text-white/60
                    ring-1
                    ring-white/10
                    transition
                    hover:bg-white/15
                    hover:text-white
                  "
                >
                  <X size={19} />
                </button>

              </div>

            </div>

            {/* HISTORY KPI */}

            <div className="grid grid-cols-2 gap-3 border-b border-[#E6EEEA] bg-[#F8FAF9] p-4 md:grid-cols-4 md:p-5">

              <div className="rounded-2xl border border-[#DDE9E4] bg-white p-4 shadow-sm">

                <div className="flex items-center gap-2 text-gray-400">

                  <History
                    size={14}
                    className="text-[#497F70]"
                  />

                  <span className="text-[9px] font-black uppercase tracking-wider">
                    Total
                  </span>

                </div>

                <p className="mt-2 text-xl font-black text-[#18352D]">
                  {formatNumber(
                    historySummary.total
                  )}
                </p>

                <p className="mt-0.5 text-[9px] text-gray-400">
                  transaksi
                </p>

              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">

                <div className="flex items-center gap-2 text-emerald-600">

                  <ArrowDownCircle size={14} />

                  <span className="text-[9px] font-black uppercase tracking-wider">
                    Stock In
                  </span>

                </div>

                <p className="mt-2 text-xl font-black text-emerald-700">
                  +
                  {formatNumber(
                    historySummary.stockIn
                  )}
                </p>

                <p className="mt-0.5 text-[9px] text-emerald-600/60">
                  barang masuk
                </p>

              </div>

              <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">

                <div className="flex items-center gap-2 text-red-600">

                  <ArrowUpCircle size={14} />

                  <span className="text-[9px] font-black uppercase tracking-wider">
                    Stock Out
                  </span>

                </div>

                <p className="mt-2 text-xl font-black text-red-700">
                  -
                  {formatNumber(
                    historySummary.stockOut
                  )}
                </p>

                <p className="mt-0.5 text-[9px] text-red-600/60">
                  barang keluar
                </p>

              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">

                <div className="flex items-center gap-2 text-blue-600">

                  <Info size={14} />

                  <span className="text-[9px] font-black uppercase tracking-wider">
                    Informasi
                  </span>

                </div>

                <p className="mt-2 text-xl font-black text-blue-700">
                  {formatNumber(
                    historySummary.informational
                  )}
                </p>

                <p className="mt-0.5 text-[9px] text-blue-600/60">
                  aktivitas informasi
                </p>

              </div>

            </div>

            {/* BODY */}

            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">

              {historyLoading ? (

                <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-[#DDE9E4] bg-[#FAFCFB]">

                  <div className="text-center">

                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3EF]">

                      <RefreshCw
                        size={25}
                        className="animate-spin text-[#497F70]"
                      />

                    </div>

                    <p className="text-sm font-bold text-[#35564C]">
                      Memuat audit trail
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      Mengambil seluruh pergerakan
                      barang...
                    </p>

                  </div>

                </div>

              ) : historyError ? (

                <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-red-100 bg-red-50/50">

                  <div className="max-w-sm text-center">

                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-500">
                      <CircleX size={26} />
                    </div>

                    <p className="font-bold text-red-700">
                      Gagal mengambil history
                    </p>

                    <p className="mt-1 text-xs leading-5 text-red-600">
                      {historyError}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        openHistory(
                          selectedHistory
                        )
                      }
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#173B31] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#245447]"
                    >

                      <RefreshCw size={13} />

                      Coba Lagi

                    </button>

                  </div>

                </div>

              ) : historyData.length === 0 ? (

                <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-[#DDE9E4] bg-[#FAFCFB]">

                  <div className="max-w-sm text-center">

                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F1F5F3] text-gray-300">
                      <History size={30} />
                    </div>

                    <p className="font-bold text-gray-500">
                      Belum ada aktivitas
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-400">
                      Barang ini belum memiliki
                      riwayat transaksi yang
                      tercatat.
                    </p>

                  </div>

                </div>

              ) : (

                <div className="overflow-hidden rounded-2xl border border-[#DDE9E4]">

                  <div className="overflow-x-auto">

                    <table className="min-w-[1250px] w-full text-sm">

                      <thead className="bg-[#F6F9F7]">

                        <tr className="border-b border-[#E3ECE8]">

                          {[
                            "No",
                            "Tanggal",
                            "Jenis Transaksi",
                            "No. Transaksi",
                            "Masuk",
                            "Keluar",
                            "Status",
                            "Keterangan",
                          ].map(
                            (header) => (

                              <th
                                key={header}
                                className={`px-4 py-3 text-left text-[9px] font-black uppercase tracking-wider text-[#587168] ${
                                  [
                                    "Masuk",
                                    "Keluar",
                                  ].includes(
                                    header
                                  )
                                    ? "text-right"
                                    : ""
                                } ${
                                  header ===
                                  "Status"
                                    ? "text-center"
                                    : ""
                                }`}
                              >
                                {header}
                              </th>

                            )
                          )}

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
                                className="
                                  border-b
                                  border-[#EDF2EF]
                                  last:border-b-0
                                  transition
                                  hover:bg-[#FAFCFB]
                                "
                              >

                                <td className="px-4 py-4 text-[10px] font-bold text-gray-400">
                                  {String(
                                    index + 1
                                  ).padStart(
                                    2,
                                    "0"
                                  )}
                                </td>

                                <td className="px-4 py-4">

                                  <div className="flex items-center gap-2.5">

                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F1F5F3] text-gray-400">

                                      <CalendarDays
                                        size={13}
                                      />

                                    </div>

                                    <div>

                                      <div className="font-bold text-[#35564C]">

                                        {formatDate(
                                          history.date
                                        )}

                                      </div>

                                      <div className="mt-0.5 text-[9px] text-gray-400">

                                        {formatDateTime(
                                          history.date
                                        ).split(
                                          ", "
                                        )[1] ||
                                          ""}

                                      </div>

                                    </div>

                                  </div>

                                </td>

                                <td className="px-4 py-4">

                                  <span
                                    className={`
                                      inline-flex
                                      rounded-lg
                                      border
                                      px-2.5
                                      py-1.5
                                      text-[9px]
                                      font-black
                                      ${type.className}
                                    `}
                                  >
                                    {
                                      type.text
                                    }
                                  </span>

                                </td>

                                <td className="px-4 py-4">

                                  <span className="rounded-lg bg-[#F5F8F6] px-2.5 py-1.5 font-mono text-[10px] font-bold text-[#35564C]">
                                    {history.number ||
                                      "-"}
                                  </span>

                                </td>

                                <td className="px-4 py-4 text-right">

                                  {isIn ? (

                                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black text-emerald-700">

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
                                      —
                                    </span>

                                  )}

                                </td>

                                <td className="px-4 py-4 text-right">

                                  {isOut ? (

                                    <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[10px] font-black text-red-700">

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
                                      —
                                    </span>

                                  )}

                                </td>

                                <td className="px-4 py-4 text-center">

                                  {history.status ? (

                                    <span className="inline-flex rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[9px] font-bold uppercase text-gray-600">
                                      {
                                        history.status
                                      }
                                    </span>

                                  ) : (

                                    <span className="text-gray-200">
                                      —
                                    </span>

                                  )}

                                </td>

                                <td className="px-4 py-4">

                                  <div className="max-w-[380px]">

                                    <p className="text-xs font-medium leading-5 text-gray-600">

                                      {
                                        history.description ||
                                        "-"
                                      }

                                    </p>

                                    {(history.stockBefore !==
                                      null ||
                                      history.stockAfter !==
                                        null) && (

                                      <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#F7FAF8] px-2.5 py-1.5 text-[9px] font-semibold text-gray-400">

                                        <span>
                                          Stock
                                        </span>

                                        <span className="font-bold text-gray-600">

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

                                        <span className="font-bold text-[#497F70]">

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

            {/* FOOTER */}

            <div className="flex flex-col gap-3 border-t border-[#E4ECE8] bg-[#F8FAF9] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">

              <div className="flex items-center gap-2 text-[10px] font-medium text-gray-400">

                <ShieldCheck
                  size={13}
                  className="text-[#497F70]"
                />

                Audit trail bersifat read-only.
                Stock sistem tidak diubah dari
                halaman ini.

              </div>

              <button
                type="button"
                onClick={closeHistory}
                className="
                  inline-flex
                  items-center
                  justify-center
                  rounded-xl
                  bg-[#173B31]
                  px-5
                  py-2.5
                  text-xs
                  font-bold
                  text-white
                  shadow-sm
                  transition
                  hover:bg-[#245447]
                  active:scale-[0.98]
                "
              >
                Tutup History
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}