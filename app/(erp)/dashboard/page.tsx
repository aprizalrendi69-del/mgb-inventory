"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  Package,
  Users,
  Truck,
  Boxes,
  AlertTriangle,
  DollarSign,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  ChevronRight,
  Clock3,
  PackageX,
  Warehouse,
  RefreshCw,
  CalendarDays,
  Send,
  AlertCircle,
  Activity,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  CircleDollarSign,
  Gauge,
  TimerReset,
  PackageCheck,
  CheckCircle2,
  BarChart3,
  CircleCheck,
  Layers3,
  Command,
  Radio,
} from "lucide-react";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* =========================================================
TYPES
========================================================= */

type StockAlert = {
  id: number;
  code: string;
  name: string;
  stock: number;
  minimumStock: number;
  unit: string;
  percentage: number;
  shortage: number;
  status: "OUT_OF_STOCK" | "CRITICAL" | "LOW";
  priority: number;
};

type OnlineUser = {
  id: number;
  name?: string | null;
  fullname?: string | null;
  username?: string | null;
  role?: string | null;
  photo?: string | null;

  outlet?: {
    id?: number;
    name?: string | null;
  } | null;

  lastSeen?: string | null;
  isOnline?: boolean;
};

type DashboardStats = {
  totalBarang: number;
  totalSupplier: number;
  totalCustomer: number;
  totalPurchase: number;
  totalDelivery: number;

  nilaiPersediaan: number;

  nilaiPersediaanPusat?: number;
  nilaiPersediaanOutlet?: number;
  nilaiPersediaanTotal?: number;

  nilaiPersediaanOutletBreakdown?: {
    outletId: number;
    outletCode: string;
    outletName: string;
    value: number;
  }[];

  stockAlertCount: number;
  stockOutCount: number;
  stockCriticalCount: number;
  stockLowCount: number;
  purchaseTrend: number;
  deliveryTrend: number;
  stockTrend: number;
};

type DashboardData = {
  stats: DashboardStats;

  stockAlerts: StockAlert[];
  expiredItems: any[];
  activities: any[];
  purchasePending: any[];
  deliveryPending: any[];

  chart: {
    label: string;
    masuk: number;
    keluar: number;
  }[];
};

type Period = "7" | "30" | "90";

/* =========================================================
HELPERS
========================================================= */

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatCurrency(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function formatCompactCurrency(value: number) {
  const number = Number(value || 0);

  if (number >= 1_000_000_000_000) {
    return `Rp ${(number / 1_000_000_000_000)
      .toFixed(2)
      .replace(".", ",")} T`;
  }

  if (number >= 1_000_000_000) {
    return `Rp ${(number / 1_000_000_000)
      .toFixed(2)
      .replace(".", ",")} M`;
  }

  if (number >= 1_000_000) {
    return `Rp ${(number / 1_000_000)
      .toFixed(2)
      .replace(".", ",")} jt`;
  }

  if (number >= 1_000) {
    return `Rp ${(number / 1_000)
      .toFixed(1)
      .replace(".", ",")} rb`;
  }

  return formatCurrency(number);
}

function formatRole(role?: string | null) {
  if (!role) return "User";

  return role
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getUserDisplayName(user: OnlineUser) {
  const fullname =
    typeof user.fullname === "string"
      ? user.fullname.trim()
      : "";

  if (fullname) return fullname;

  const name =
    typeof user.name === "string"
      ? user.name.trim()
      : "";

  if (name) return name;

  const username =
    typeof user.username === "string"
      ? user.username.trim()
      : "";

  if (username) return username;

  return "User";
}

function getInitials(name?: string | null) {
  const safeName =
    typeof name === "string"
      ? name.trim()
      : "";

  if (!safeName) return "U";

  const words = safeName
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${
    words[words.length - 1][0]
  }`.toUpperCase();
}

function getOnlineDuration(lastSeen?: string | null) {
  if (!lastSeen) return "Aktif";

  const timestamp = new Date(lastSeen).getTime();

  if (!Number.isFinite(timestamp)) {
    return "Aktif";
  }

  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 1000)
  );

  if (diffSeconds < 10) return "Baru saja";

  if (diffSeconds < 60) {
    return `${diffSeconds} detik lalu`;
  }

  const minutes = Math.floor(diffSeconds / 60);

  if (minutes < 60) {
    return `${minutes} menit lalu`;
  }

  return `${Math.floor(minutes / 60)} jam lalu`;
}

function normalizeOnlineUser(
  user: any,
  index: number
): OnlineUser {
  const rawName =
    typeof user?.name === "string"
      ? user.name
      : null;

  const rawFullname =
    typeof user?.fullname === "string"
      ? user.fullname
      : null;

  const rawUsername =
    typeof user?.username === "string"
      ? user.username
      : null;

  const rawPhoto =
    typeof user?.photo === "string"
      ? user.photo.trim()
      : "";

  const displayName =
    rawFullname?.trim() ||
    rawName?.trim() ||
    rawUsername?.trim() ||
    "User";

  const numericId = Number(user?.id);

  return {
    id:
      Number.isFinite(numericId) && numericId > 0
        ? numericId
        : -(index + 1),

    name: displayName,

    fullname:
      rawFullname?.trim() || null,

    username:
      rawUsername?.trim() || null,

    role:
      typeof user?.role === "string"
        ? user.role
        : null,

    photo: rawPhoto || null,

    outlet:
      user?.outlet &&
      typeof user.outlet === "object"
        ? {
            id:
              Number.isFinite(
                Number(user.outlet.id)
              )
                ? Number(user.outlet.id)
                : undefined,

            name:
              typeof user.outlet.name === "string"
                ? user.outlet.name
                : null,
          }
        : null,

    lastSeen:
      typeof user?.lastSeen === "string"
        ? user.lastSeen
        : null,

    isOnline:
      typeof user?.isOnline === "boolean"
        ? user.isOnline
        : true,
  };
}

/* =========================================================
PROFILE AVATAR
========================================================= */

function ProfileAvatar({
  user,
  displayName,
}: {
  user: OnlineUser;
  displayName: string;
}) {
  const [imageError, setImageError] =
    useState(false);

  const photo =
    typeof user.photo === "string"
      ? user.photo.trim()
      : "";

  const showPhoto =
    Boolean(photo) && !imageError;

  return (
    <div className="relative shrink-0">
      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-[11px] bg-emerald-300/[0.10] text-[8px] font-bold text-emerald-300 ring-1 ring-white/[0.07]">
        {showPhoto ? (
          <img
            src={photo}
            alt={displayName}
            className="h-full w-full object-cover"
            onError={() => {
              setImageError(true);
            }}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            {getInitials(displayName)}
          </span>
        )}
      </div>

      <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[#0B211B] bg-emerald-400" />
    </div>
  );
}

/* =========================================================
TOOLTIP
========================================================= */

function ChartTooltip({
  active,
  payload,
  label,
}: any) {
  if (!active || !payload?.length) {
    return null;
  }

  const masuk = Number(
    payload.find(
      (item: any) => item.dataKey === "masuk"
    )?.value || 0
  );

  const keluar = Number(
    payload.find(
      (item: any) => item.dataKey === "keluar"
    )?.value || 0
  );

  return (
    <div className="min-w-[235px] overflow-hidden rounded-[20px] border border-slate-200/80 bg-white/95 shadow-[0_25px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl">
      <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3.5">
        <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-emerald-600">
          Inventory Activity
        </p>

        <p className="mt-1 text-sm font-bold text-slate-800">
          {label}
        </p>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />

            <span className="text-[10px] text-slate-500">
              Barang Masuk
            </span>
          </div>

          <span className="text-xs font-bold text-emerald-600">
            {formatNumber(masuk)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-400" />

            <span className="text-[10px] text-slate-500">
              Barang Keluar
            </span>
          </div>

          <span className="text-xs font-bold text-slate-600">
            {formatNumber(keluar)}
          </span>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Total Activity
            </span>

            <span className="text-sm font-bold text-slate-800">
              {formatNumber(masuk + keluar)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
SECTION HEADER
========================================================= */

function SectionHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: any;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      {Icon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-emerald-50 ring-1 ring-emerald-100">
          <Icon className="h-4 w-4 text-emerald-600" />
        </div>
      )}

      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-emerald-600">
            {eyebrow}
          </p>
        )}

        <h2 className="mt-0.5 truncate text-[16px] font-bold tracking-tight text-slate-800">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-[10px] leading-4 text-slate-400">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/* =========================================================
EMPTY STATE
========================================================= */

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-emerald-50 ring-1 ring-emerald-100">
        <Icon className="h-5 w-5 text-emerald-500" />
      </div>

      <p className="mt-3 text-xs font-bold text-slate-700">
        {title}
      </p>

      <p className="mt-1 max-w-xs text-[10px] leading-5 text-slate-400">
        {description}
      </p>
    </div>
  );
}

/* =========================================================
COMPACT INVENTORY VALUE
========================================================= */

function InventoryValueMini({
  label,
  value,
  icon: Icon,
  tone = "emerald",
  featured = false,
}: {
  label: string;
  value: number;
  icon: any;
  tone?: "emerald" | "blue" | "violet";
  featured?: boolean;
}) {
  const toneMap = {
    emerald: {
      iconBg: "bg-emerald-50",
      iconText: "text-emerald-600",
      dot: "bg-emerald-500",
      value: "text-emerald-700",
    },
    blue: {
      iconBg: "bg-blue-50",
      iconText: "text-blue-600",
      dot: "bg-blue-500",
      value: "text-blue-700",
    },
    violet: {
      iconBg: "bg-violet-50",
      iconText: "text-violet-600",
      dot: "bg-violet-500",
      value: "text-violet-700",
    },
  };

  const colors = toneMap[tone];

  return (
    <div
      title={formatCurrency(value)}
      className={`group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-[19px] border p-3 transition-all duration-300 hover:-translate-y-0.5 ${
        featured
          ? "border-emerald-100 bg-gradient-to-r from-emerald-50/80 via-white to-white shadow-[0_8px_25px_rgba(16,185,129,0.06)]"
          : "border-slate-100 bg-slate-50/55 hover:border-slate-200 hover:bg-white hover:shadow-[0_10px_28px_rgba(15,23,42,0.06)]"
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${colors.iconBg}`}
      >
        <Icon className={`h-4 w-4 ${colors.iconText}`} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${colors.dot}`}
          />

          <p className="truncate text-[8px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </p>
        </div>

        <p
          className={`mt-1 truncate font-bold tracking-[-0.025em] ${
            featured
              ? "text-[16px] text-emerald-700"
              : `text-[15px] ${colors.value}`
          }`}
        >
          {formatCompactCurrency(value)}
        </p>
      </div>

      {featured && (
        <span className="shrink-0 rounded-full bg-emerald-100/80 px-2 py-1 text-[6px] font-bold uppercase tracking-[0.12em] text-emerald-700">
          Total
        </span>
      )}
    </div>
  );
}

/* =========================================================
OUTLET VALUE MINI
========================================================= */

function OutletValueMini({
  code,
  name,
  value,
  index,
}: {
  code: string;
  name: string;
  value: number;
  index: number;
}) {
  const accentStyles = [
    "bg-emerald-500",
    "bg-teal-500",
    "bg-green-500",
    "bg-lime-500",
    "bg-cyan-500",
    "bg-emerald-600",
  ];

  const accent =
    accentStyles[index % accentStyles.length];

  return (
    <div className="group relative min-w-0 overflow-hidden rounded-[17px] border border-slate-100 bg-white px-3.5 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-100 hover:shadow-[0_10px_28px_rgba(15,23,42,0.07)]">
      <div
        className={`absolute bottom-0 left-0 top-0 w-[2px] ${accent}`}
      />

      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-slate-50 text-[7px] font-black tracking-tight text-slate-500 ring-1 ring-slate-100">
            {code?.slice(0, 4) || "OUT"}
          </div>

          <div className="min-w-0">
            <p className="truncate text-[9px] font-bold text-slate-700">
              {name}
            </p>

            <p className="mt-0.5 truncate text-[7px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {code}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[12px] font-bold tracking-tight text-slate-800">
            {formatCompactCurrency(value)}
          </p>

          <p className="mt-0.5 text-[6px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Inventory
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
DASHBOARD
========================================================= */

export default function Dashboard() {
  const [data, setData] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [period, setPeriod] =
    useState<Period>("7");

  const [refreshing, setRefreshing] =
    useState(false);

  const [onlineUsers, setOnlineUsers] =
    useState<OnlineUser[]>([]);

  const [onlineLoading, setOnlineLoading] =
    useState(true);

  const [onlineRefreshing, setOnlineRefreshing] =
    useState(false);

  /* =======================================================
  LOAD DASHBOARD
  ======================================================= */

  async function loadDashboard(
    selectedPeriod: Period = period,
    showRefresh = false
  ) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      }

      const res = await fetch(
        `/api/dashboard?period=${selectedPeriod}`,
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error(
          "Dashboard gagal dimuat"
        );
      }

      const json = await res.json();

      if (json.success) {
        setData(json.data);
      }
    } catch (error) {
      console.error(
        "DASHBOARD ERROR",
        error
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /* =======================================================
  ONLINE USERS
  ======================================================= */

  async function loadOnlineUsers(
    showRefresh = false
  ) {
    try {
      if (showRefresh) {
        setOnlineRefreshing(true);
      }

      const res = await fetch(
        "/api/me/online-users",
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error(
          "Data user online gagal dimuat"
        );
      }

      const json = await res.json();

      if (json.success) {
        const rawUsers = Array.isArray(
          json.data
        )
          ? json.data
          : Array.isArray(json.users)
          ? json.users
          : [];

        setOnlineUsers(
          rawUsers.map(
            (user: any, index: number) =>
              normalizeOnlineUser(
                user,
                index
              )
          )
        );
      } else {
        setOnlineUsers([]);
      }
    } catch (error) {
      console.error(
        "ONLINE USERS ERROR",
        error
      );
    } finally {
      setOnlineLoading(false);
      setOnlineRefreshing(false);
    }
  }

  /* =======================================================
  INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadDashboard("7");
    loadOnlineUsers();

    const onlineInterval =
      window.setInterval(() => {
        loadOnlineUsers();
      }, 15_000);

    return () => {
      window.clearInterval(
        onlineInterval
      );
    };
  }, []);

  /* =======================================================
  PERIOD
  ======================================================= */

  const handlePeriodChange = (
    newPeriod: Period
  ) => {
    setPeriod(newPeriod);
    loadDashboard(newPeriod);
  };

  /* =======================================================
  CHART
  ======================================================= */

  const chartData = useMemo(() => {
    if (!data?.chart?.length) {
      return [];
    }

    return data.chart.map((item) => ({
      label: item.label,
      masuk: Number(item.masuk || 0),
      keluar: Number(item.keluar || 0),
    }));
  }, [data]);

  const chartSummary = useMemo(() => {
    return chartData.reduce(
      (summary, item) => {
        summary.masuk += item.masuk;
        summary.keluar += item.keluar;

        return summary;
      },
      {
        masuk: 0,
        keluar: 0,
      }
    );
  }, [chartData]);

  const totalActivity =
    chartSummary.masuk +
    chartSummary.keluar;

  /* =======================================================
  METRICS
  ======================================================= */

  const stockAlertCount =
    data?.stats.stockAlertCount ??
    data?.stockAlerts?.length ??
    0;

  const stockOutCount =
    data?.stats.stockOutCount ?? 0;

  const stockCriticalCount =
    data?.stats.stockCriticalCount ?? 0;

  const stockLowCount =
    data?.stats.stockLowCount ?? 0;

  const inventoryValuePusat =
    Number(
      data?.stats.nilaiPersediaanPusat ?? 0
    );

  const inventoryValueOutlet =
    Number(
      data?.stats.nilaiPersediaanOutlet ?? 0
    );

  const legacyInventoryValue =
    Number(
      data?.stats.nilaiPersediaan ?? 0
    );

  const inventoryValueTotal =
    data?.stats.nilaiPersediaanTotal != null
      ? Number(
          data.stats.nilaiPersediaanTotal
        )
      : inventoryValuePusat +
            inventoryValueOutlet >
          0
      ? inventoryValuePusat +
        inventoryValueOutlet
      : legacyInventoryValue;

  const hasInventoryBreakdown =
    data?.stats.nilaiPersediaanPusat != null ||
    data?.stats.nilaiPersediaanOutlet != null ||
    data?.stats.nilaiPersediaanTotal != null;

  const stockHealth = Math.max(
    0,
    100 -
      Math.min(
        100,
        stockAlertCount * 8
      )
  );

  const today =
    new Date().toLocaleDateString(
      "id-ID",
      {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    );

  const stockHealthLabel =
    stockHealth >= 90
      ? "Excellent"
      : stockHealth >= 75
      ? "Healthy"
      : stockHealth >= 50
      ? "Attention"
      : "Critical";

  /* =======================================================
  KPI
  ======================================================= */

  const cards = [
    {
      title: "Total Barang",
      value:
        data?.stats.totalBarang?.toLocaleString(
          "id-ID"
        ) ?? "0",
      description: "Master item aktif",
      icon: Package,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      accent: "bg-blue-500",
    },
    {
      title: "Supplier",
      value:
        data?.stats.totalSupplier?.toLocaleString(
          "id-ID"
        ) ?? "0",
      description: "Partner procurement",
      icon: Warehouse,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      accent: "bg-violet-500",
    },
    {
      title: "Customer",
      value:
        data?.stats.totalCustomer?.toLocaleString(
          "id-ID"
        ) ?? "0",
      description: "Customer terdaftar",
      icon: Users,
      iconBg: "bg-sky-50",
      iconColor: "text-sky-600",
      accent: "bg-sky-500",
    },
    {
      title: "Purchase",
      value:
        data?.stats.totalPurchase?.toLocaleString(
          "id-ID"
        ) ?? "0",
      description: "Purchase order",
      icon: ShoppingCart,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      accent: "bg-amber-500",
    },
    {
      title: "Delivery",
      value:
        data?.stats.totalDelivery?.toLocaleString(
          "id-ID"
        ) ?? "0",
      description: "Dokumen pengiriman",
      icon: Send,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-600",
      accent: "bg-indigo-500",
    },
    {
      title: "Stock Alert",
      value:
        stockAlertCount.toLocaleString(
          "id-ID"
        ),
      description:
        stockAlertCount > 0
          ? "Perlu perhatian"
          : "Semua aman",
      icon: AlertTriangle,
      iconBg:
        stockAlertCount > 0
          ? "bg-orange-50"
          : "bg-emerald-50",
      iconColor:
        stockAlertCount > 0
          ? "text-orange-600"
          : "text-emerald-600",
      accent:
        stockAlertCount > 0
          ? "bg-orange-500"
          : "bg-emerald-500",
    },
  ];

  /* =======================================================
  QUICK ACCESS
  ======================================================= */

  const menus = [
    {
      title: "Barang",
      description: "Master barang",
      href: "/master-barang",
      icon: Package,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      code: "01",
    },
    {
      title: "Supplier",
      description: "Data supplier",
      href: "/supplier",
      icon: Warehouse,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      code: "02",
    },
    {
      title: "Customer",
      description: "Data customer",
      href: "/customer",
      icon: Users,
      iconBg: "bg-sky-50",
      iconColor: "text-sky-600",
      code: "03",
    },
    {
      title: "Purchase",
      description: "Purchase order",
      href: "/purchase",
      icon: ShoppingCart,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      code: "04",
    },
    {
      title: "Delivery",
      description: "Pengiriman",
      href: "/surat-jalan",
      icon: Send,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-600",
      code: "05",
    },
    {
      title: "Inventory",
      description: "Stock inventory",
      href: "/inventory",
      icon: Boxes,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      code: "06",
    },
    {
      title: "Laporan",
      description: "Report ERP",
      href: "/laporan",
      icon: FileText,
      iconBg: "bg-cyan-50",
      iconColor: "text-cyan-600",
      code: "07",
    },
  ];

  /* =======================================================
  STOCK STATUS
  ======================================================= */

  function getStockStatus(
    status: StockAlert["status"]
  ) {
    if (status === "OUT_OF_STOCK") {
      return {
        label: "HABIS",
        badge:
          "border-rose-100 bg-rose-50 text-rose-600",
        bar: "bg-rose-500",
        icon:
          "bg-rose-50 text-rose-500",
      };
    }

    if (status === "CRITICAL") {
      return {
        label: "KRITIS",
        badge:
          "border-orange-100 bg-orange-50 text-orange-600",
        bar: "bg-orange-500",
        icon:
          "bg-orange-50 text-orange-500",
      };
    }

    return {
      label: "RENDAH",
      badge:
        "border-amber-100 bg-amber-50 text-amber-600",
      bar: "bg-amber-500",
      icon:
        "bg-amber-50 text-amber-500",
    };
  }

  /* =======================================================
  LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F5F4] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1780px] space-y-5">

          <div className="relative h-[250px] overflow-hidden rounded-[30px] bg-[#071B16]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(52,211,153,0.13),transparent_30%)]" />

            <div className="relative space-y-4 p-6 sm:p-8">
              <div className="h-5 w-28 animate-pulse rounded-full bg-white/10" />

              <div className="h-10 max-w-xl animate-pulse rounded-xl bg-white/10" />

              <div className="h-4 max-w-lg animate-pulse rounded-lg bg-white/5" />

              <div className="mt-7 grid max-w-2xl grid-cols-4 gap-3">
                <div className="h-14 animate-pulse rounded-xl bg-white/5" />
                <div className="h-14 animate-pulse rounded-xl bg-white/5" />
                <div className="h-14 animate-pulse rounded-xl bg-white/5" />
                <div className="h-14 animate-pulse rounded-xl bg-white/5" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }).map(
              (_, index) => (
                <div
                  key={index}
                  className="h-[158px] animate-pulse rounded-[25px] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
                />
              )
            )}
          </div>

          <div className="h-[120px] animate-pulse rounded-[28px] bg-white" />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="h-[560px] animate-pulse rounded-[32px] bg-white xl:col-span-2" />

            <div className="h-[560px] animate-pulse rounded-[32px] bg-white" />
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
  RENDER
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#F2F5F4] text-slate-800">
      <div className="mx-auto max-w-[1780px] space-y-5 p-4 sm:p-6 lg:p-8">

        {/* ===================================================
            PREMIUM EXECUTIVE COMMAND CENTER
        =================================================== */}

        <section className="relative overflow-hidden rounded-[30px] bg-[#071B16] shadow-[0_24px_70px_rgba(8,35,28,0.15)]">

          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-24 -top-28 h-[330px] w-[330px] rounded-full border border-emerald-300/[0.055]" />

            <div className="absolute right-[8%] top-[12%] h-[190px] w-[190px] rounded-full border border-white/[0.025]" />

            <div className="absolute bottom-[-160px] left-[38%] h-[330px] w-[330px] rounded-full bg-emerald-400/[0.05] blur-3xl" />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_10%,rgba(52,211,153,0.12),transparent_30%),linear-gradient(120deg,rgba(255,255,255,0.02),transparent_60%)]" />
          </div>

          <div className="relative p-5 sm:p-6 lg:p-7 xl:p-8">

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_370px]">

              {/* HERO LEFT */}

              <div className="min-w-0">

                <div className="flex flex-wrap items-center gap-2">

                  <div className="flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.08] px-3 py-1.5">
                    <Sparkles className="h-3 w-3 text-emerald-300" />

                    <span className="text-[8px] font-bold uppercase tracking-[0.23em] text-emerald-200">
                      MGB ERP
                    </span>
                  </div>

                  <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:block" />

                  <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Executive Command Center
                  </span>
                </div>

                <div className="mt-4 max-w-4xl">
                  <h1 className="text-[29px] font-bold leading-[1.04] tracking-[-0.045em] text-white sm:text-[36px] lg:text-[42px]">
                    PT. MITRA GARAM BOGATAMA
                  </h1>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-[22px] font-bold tracking-[-0.04em] text-emerald-300 sm:text-[27px]">
                      Dashboard Pusat
                    </span>

                    <span className="hidden h-1 w-1 rounded-full bg-emerald-400/50 sm:block" />

                    <span className="text-[8px] font-medium uppercase tracking-[0.15em] text-slate-500">
                      Enterprise Resource Planning
                    </span>
                  </div>
                </div>

                <p className="mt-3 max-w-2xl text-[11px] leading-5 text-slate-300/80 sm:text-xs">
                  Pusat kendali operasional untuk
                  inventory, procurement, delivery,
                  customer, dan aktivitas bisnis
                  perusahaan dalam satu ekosistem ERP.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">

                  <div className="flex items-center gap-2 rounded-lg border border-emerald-300/10 bg-emerald-300/[0.07] px-2.5 py-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </span>

                    <span className="text-[7px] font-bold text-emerald-200">
                      SYSTEM ONLINE
                    </span>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.035] px-2.5 py-1.5">
                    <ShieldCheck className="h-3 w-3 text-slate-400" />

                    <span className="text-[7px] font-semibold text-slate-400">
                      SECURE MONITORING
                    </span>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.035] px-2.5 py-1.5">
                    <Radio className="h-3 w-3 text-emerald-300" />

                    <span className="text-[7px] font-semibold text-slate-400">
                      LIVE OPERATIONS
                    </span>
                  </div>

                </div>

                <div className="mt-5 grid grid-cols-2 border-t border-white/[0.07] pt-4 sm:grid-cols-4">

                  <div className="px-0 sm:px-3">
                    <p className="text-[7px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Total Inventory
                    </p>

                    <p className="mt-1.5 text-[17px] font-bold tracking-tight text-white">
                      {formatCompactCurrency(
                        inventoryValueTotal
                      )}
                    </p>

                    <p className="mt-0.5 text-[7px] text-emerald-300/60">
                      Pusat + Outlet
                    </p>
                  </div>

                  <div className="border-l border-white/[0.07] px-3">
                    <p className="text-[7px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Activity
                    </p>

                    <p className="mt-1.5 text-[17px] font-bold tracking-tight text-white">
                      {formatNumber(
                        totalActivity
                      )}
                    </p>

                    <p className="mt-0.5 text-[7px] text-slate-500">
                      Movement recorded
                    </p>
                  </div>

                  <div className="mt-4 border-l border-white/[0.07] px-3 sm:mt-0">
                    <p className="text-[7px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Users Active
                    </p>

                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[17px] font-bold text-white">
                        {onlineUsers.length}
                      </span>

                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />

                        <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      </span>
                    </div>

                    <p className="mt-0.5 text-[7px] text-slate-500">
                      Live monitoring
                    </p>
                  </div>

                  <div className="mt-4 border-l border-white/[0.07] px-3 sm:mt-0">
                    <p className="text-[7px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Stock Health
                    </p>

                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[17px] font-bold text-emerald-300">
                        {stockHealth}%
                      </span>

                      <span className="rounded-full bg-emerald-400/[0.08] px-1.5 py-0.5 text-[6px] font-bold text-emerald-300">
                        {stockHealthLabel}
                      </span>
                    </div>

                    <p className="mt-0.5 text-[7px] text-slate-500">
                      Inventory condition
                    </p>
                  </div>

                </div>
              </div>

              {/* RIGHT COMMAND PANEL */}

              <div className="relative">
                <div className="overflow-hidden rounded-[23px] border border-emerald-300/[0.10] bg-white/[0.04] p-3 backdrop-blur-2xl">

                  <div className="flex items-center gap-2.5 rounded-[17px] border border-white/[0.06] bg-black/[0.09] p-2.5">

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/[0.08] ring-1 ring-emerald-300/[0.08]">
                      <CalendarDays className="h-4 w-4 text-emerald-300" />
                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[7px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          Hari ini
                        </p>

                        <div className="flex items-center gap-1 rounded-full bg-emerald-400/[0.08] px-2 py-0.5">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />

                            <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          </span>

                          <span className="text-[6px] font-bold text-emerald-300">
                            {onlineLoading
                              ? "..."
                              : `${onlineUsers.length} ONLINE`}
                          </span>
                        </div>
                      </div>

                      <p className="mt-1 truncate text-[11px] font-semibold text-white">
                        {today}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        loadDashboard(
                          period,
                          true
                        );

                        loadOnlineUsers(true);
                      }}
                      disabled={
                        refreshing ||
                        onlineRefreshing
                      }
                      title="Refresh dashboard"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-slate-300 transition-all duration-300 hover:bg-emerald-400/[0.12] hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${
                          refreshing ||
                          onlineRefreshing
                            ? "animate-spin"
                            : ""
                        }`}
                      />
                    </button>
                  </div>

                  {/* ONLINE USERS */}

                  <div className="mt-2.5 rounded-[17px] border border-white/[0.06] bg-black/[0.07] p-3">

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3 w-3 text-emerald-400" />

                        <span className="text-[7px] font-bold uppercase tracking-[0.17em] text-slate-500">
                          Active Users
                        </span>
                      </div>

                      <span className="text-[6px] font-semibold uppercase tracking-wider text-slate-600">
                        Live
                      </span>
                    </div>

                    <div className="mt-2.5 space-y-1.5">

                      {onlineLoading ? (
                        <>
                          <div className="h-8 animate-pulse rounded-lg bg-white/[0.05]" />
                          <div className="h-8 animate-pulse rounded-lg bg-white/[0.04]" />
                          <div className="h-8 animate-pulse rounded-lg bg-white/[0.03]" />
                        </>
                      ) : onlineUsers.length > 0 ? (
                        <>
                          {onlineUsers
                            .slice(0, 3)
                            .map((user) => {
                              const displayName =
                                getUserDisplayName(
                                  user
                                );

                              return (
                                <div
                                  key={user.id}
                                  title={`${displayName} • ${formatRole(
                                    user.role
                                  )}${
                                    user.outlet?.name
                                      ? ` • ${user.outlet.name}`
                                      : ""
                                  } • ${getOnlineDuration(
                                    user.lastSeen
                                  )}`}
                                  className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.03] px-2 py-1.5"
                                >
                                  <ProfileAvatar
                                    user={user}
                                    displayName={
                                      displayName
                                    }
                                  />

                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[8px] font-semibold text-slate-200">
                                      {displayName}
                                    </p>

                                    <p className="truncate text-[6px] text-slate-500">
                                      {formatRole(
                                        user.role
                                      )}

                                      {user.outlet?.name
                                        ? ` • ${user.outlet.name}`
                                        : ""}
                                    </p>
                                  </div>

                                  <span className="shrink-0 text-[6px] text-slate-600">
                                    {getOnlineDuration(
                                      user.lastSeen
                                    )}
                                  </span>
                                </div>
                              );
                            })}

                          {onlineUsers.length > 3 && (
                            <div className="flex items-center justify-center rounded-lg border border-dashed border-white/[0.07] py-1.5">
                              <span className="text-[6px] font-bold text-emerald-300">
                                +{onlineUsers.length - 3} pengguna lainnya
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-center rounded-lg border border-dashed border-white/[0.07] py-5">
                          <span className="text-[7px] text-slate-600">
                            Tidak ada user aktif
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SYSTEM STATUS */}

                  <div className="mt-2.5 grid grid-cols-2 gap-2">

                    <div className="rounded-[15px] border border-white/[0.06] bg-white/[0.03] p-2.5">
                      <div className="flex items-center justify-between">
                        <Command className="h-3 w-3 text-slate-500" />

                        <span className="text-[6px] font-bold uppercase tracking-wider text-emerald-400">
                          READY
                        </span>
                      </div>

                      <p className="mt-1.5 text-[7px] text-slate-500">
                        ERP Core
                      </p>

                      <p className="mt-0.5 text-[10px] font-bold text-slate-200">
                        Operational
                      </p>
                    </div>

                    <div className="rounded-[15px] border border-white/[0.06] bg-white/[0.03] p-2.5">
                      <div className="flex items-center justify-between">
                        <Activity className="h-3 w-3 text-emerald-400" />

                        <span className="text-[6px] font-bold uppercase tracking-wider text-emerald-400">
                          LIVE
                        </span>
                      </div>

                      <p className="mt-1.5 text-[7px] text-slate-500">
                        Monitoring
                      </p>

                      <p className="mt-0.5 text-[10px] font-bold text-slate-200">
                        Active
                      </p>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================
            KPI GRID
        =================================================== */}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">

          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.title}
                className="group relative overflow-hidden rounded-[23px] border border-white bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(15,23,42,0.09)]"
              >

                <div
                  className={`absolute left-0 right-0 top-0 h-[2px] ${card.accent}`}
                />

                <div className="flex items-start justify-between">

                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-[14px] ${card.iconBg} transition-transform duration-300 group-hover:scale-105`}
                  >
                    <Icon
                      className={`h-[18px] w-[18px] ${card.iconColor}`}
                    />
                  </div>

                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-300 transition-all duration-300 group-hover:bg-slate-100 group-hover:text-slate-500">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </div>

                </div>

                <p className="mt-5 text-[8px] font-bold uppercase tracking-[0.13em] text-slate-400">
                  {card.title}
                </p>

                <p className="mt-1 truncate text-[23px] font-bold tracking-[-0.04em] text-slate-800">
                  {card.value}
                </p>

                <div className="mt-3 flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${card.accent}`}
                  />

                  <span className="truncate text-[9px] font-medium text-slate-400">
                    {card.description}
                  </span>
                </div>

              </div>
            );
          })}

        </section>

        {/* ===================================================
            COMPACT INVENTORY VALUATION
        =================================================== */}

        <section className="relative overflow-hidden rounded-[27px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.045)]">

          <div className="pointer-events-none absolute right-[-80px] top-[-100px] h-[250px] w-[250px] rounded-full bg-emerald-50 blur-3xl" />

          <div className="relative p-4 sm:p-5">

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">

              {/* TITLE */}

              <div className="flex min-w-[230px] items-center gap-3 xl:w-[270px]">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-emerald-50 ring-1 ring-emerald-100">
                  <CircleDollarSign className="h-4 w-4 text-emerald-600" />
                </div>

                <div className="min-w-0">
                  <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                    Executive Valuation
                  </p>

                  <h2 className="mt-0.5 text-[15px] font-bold tracking-tight text-slate-800">
                    Nilai Persediaan
                  </h2>

                  <p className="mt-0.5 truncate text-[8px] text-slate-400">
                    Pusat + seluruh outlet
                  </p>
                </div>

              </div>

              {/* VALUE CARDS */}

              <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3">

                <InventoryValueMini
                  label="Gudang Pusat"
                  value={inventoryValuePusat}
                  icon={Warehouse}
                  tone="emerald"
                />

                <InventoryValueMini
                  label="Seluruh Outlet"
                  value={inventoryValueOutlet}
                  icon={Boxes}
                  tone="blue"
                />

                <InventoryValueMini
                  label="Total Inventory"
                  value={inventoryValueTotal}
                  icon={CircleDollarSign}
                  tone="violet"
                  featured
                />

              </div>

            </div>

            {!hasInventoryBreakdown && (
              <div className="mt-3 flex items-center gap-2 rounded-[13px] border border-amber-100 bg-amber-50/60 px-3 py-2">
                <AlertCircle className="h-3 w-3 shrink-0 text-amber-500" />

                <span className="text-[7px] font-medium text-amber-600">
                  Dashboard menggunakan legacy inventory value karena breakdown persediaan belum tersedia dari API.
                </span>
              </div>
            )}

          </div>
        </section>

        {/* ===================================================
            OUTLET INVENTORY — COMPACT
        =================================================== */}

        <section className="rounded-[27px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-5">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-blue-50 ring-1 ring-blue-100">
                <Boxes className="h-4 w-4 text-blue-600" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                    Outlet Inventory
                  </p>

                  <span className="h-1 w-1 rounded-full bg-emerald-300" />
                  
                  <span className="text-[7px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Valuation
                  </span>
                </div>

                <h2 className="mt-0.5 text-[15px] font-bold tracking-tight text-slate-800">
                  Nilai Persediaan Per Outlet
                </h2>
              </div>

            </div>

            <div className="flex items-center gap-2">

              <span className="hidden text-[7px] text-slate-400 sm:block">
                Stock × average cost
              </span>

              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[7px] font-bold uppercase tracking-[0.12em] text-blue-600">
                {data?.stats.nilaiPersediaanOutletBreakdown?.length ?? 0} Outlet
              </span>

            </div>

          </div>

          {data?.stats.nilaiPersediaanOutletBreakdown?.length ? (

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

              {data.stats.nilaiPersediaanOutletBreakdown.map(
                (outlet, index) => (
                  <OutletValueMini
                    key={outlet.outletId}
                    code={outlet.outletCode}
                    name={outlet.outletName}
                    value={outlet.value}
                    index={index}
                  />
                )
              )}

            </div>

          ) : (

            <div className="mt-4 rounded-[18px] border border-dashed border-slate-200 bg-slate-50/60">
              <EmptyState
                icon={Boxes}
                title="Belum ada data outlet"
                description="Nilai persediaan outlet akan muncul setelah stok outlet tersedia."
              />
            </div>

          )}

          <div className="mt-3 flex items-center justify-between rounded-[15px] border border-emerald-100 bg-emerald-50/55 px-3.5 py-2.5">

            <div className="flex items-center gap-2">
              <CircleCheck className="h-3.5 w-3.5 text-emerald-500" />

              <span className="text-[8px] font-semibold text-emerald-700">
                Total seluruh persediaan outlet
              </span>
            </div>

            <span className="text-[12px] font-bold tracking-tight text-emerald-700">
              {formatCompactCurrency(
                inventoryValueOutlet
              )}
            </span>

          </div>

        </section>

        {/* ===================================================
            OPERATIONAL SNAPSHOT
        =================================================== */}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">

          <div className="relative overflow-hidden rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-5">

            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-100/50 blur-2xl" />

            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-emerald-600">
                  Inventory Flow
                </p>

                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Barang masuk periode
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-emerald-100">
                <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
              </div>
            </div>

            <div className="relative mt-5 flex items-end justify-between">

              <div>
                <p className="text-2xl font-bold tracking-tight text-emerald-700">
                  {formatNumber(
                    chartSummary.masuk
                  )}
                </p>

                <p className="mt-1 text-[8px] text-emerald-600/70">
                  Unit tercatat
                </p>
              </div>

              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[7px] font-bold text-emerald-700">
                INBOUND
              </span>

            </div>
          </div>

          <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5">

            <div className="relative flex items-center justify-between">

              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Inventory Flow
                </p>

                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Barang keluar periode
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-100">
                <ArrowUpRight className="h-4 w-4 text-slate-500" />
              </div>

            </div>

            <div className="mt-5 flex items-end justify-between">

              <div>
                <p className="text-2xl font-bold tracking-tight text-slate-700">
                  {formatNumber(
                    chartSummary.keluar
                  )}
                </p>

                <p className="mt-1 text-[8px] text-slate-400">
                  Unit tercatat
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[7px] font-bold text-slate-500">
                OUTBOUND
              </span>

            </div>
          </div>

          <div className="relative overflow-hidden rounded-[24px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-5">

            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-100/50 blur-2xl" />

            <div className="relative flex items-center justify-between">

              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-blue-600">
                  Operational Volume
                </p>

                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Total aktivitas periode
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-blue-100">
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>

            </div>

            <div className="relative mt-5 flex items-end justify-between">

              <div>
                <p className="text-2xl font-bold tracking-tight text-blue-700">
                  {formatNumber(
                    totalActivity
                  )}
                </p>

                <p className="mt-1 text-[8px] text-blue-600/70">
                  Movement recorded
                </p>
              </div>

              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[7px] font-bold text-blue-700">
                TOTAL
              </span>

            </div>
          </div>

        </section>

        {/* ===================================================
            ANALYTICS
        =================================================== */}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">

          {/* CHART */}

          <div className="overflow-hidden rounded-[30px] border border-white bg-white p-6 shadow-[0_8px_32px_rgba(15,23,42,0.045)] xl:col-span-2">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

              <SectionHeader
                eyebrow="Operational Analytics"
                title="Aktivitas Inventory"
                description="Pergerakan barang masuk dan keluar"
                icon={BarChart3}
              />

              <div className="flex shrink-0 rounded-xl bg-slate-100 p-1">

                {[
                  ["7", "7 Hari"],
                  ["30", "30 Hari"],
                  ["90", "90 Hari"],
                ].map((item) => (
                  <button
                    key={item[0]}
                    onClick={() =>
                      handlePeriodChange(
                        item[0] as Period
                      )
                    }
                    className={`rounded-lg px-3 py-1.5 text-[9px] font-semibold transition ${
                      period === item[0]
                        ? "bg-white text-emerald-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {item[1]}
                  </button>
                ))}

              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">

              <div className="rounded-[20px] border border-emerald-100 bg-emerald-50/60 p-3.5">

                <div className="flex items-center justify-between">
                  <ArrowDownLeft className="h-4 w-4 text-emerald-500" />

                  <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-emerald-600">
                    IN
                  </span>
                </div>

                <p className="mt-2 text-lg font-bold text-emerald-700">
                  {formatNumber(
                    chartSummary.masuk
                  )}
                </p>

                <p className="mt-0.5 text-[8px] text-emerald-600/70">
                  Barang masuk
                </p>

              </div>

              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-3.5">

                <div className="flex items-center justify-between">
                  <ArrowUpRight className="h-4 w-4 text-slate-500" />

                  <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    OUT
                  </span>
                </div>

                <p className="mt-2 text-lg font-bold text-slate-700">
                  {formatNumber(
                    chartSummary.keluar
                  )}
                </p>

                <p className="mt-0.5 text-[8px] text-slate-400">
                  Barang keluar
                </p>

              </div>

              <div className="rounded-[20px] border border-blue-100 bg-blue-50/60 p-3.5">

                <div className="flex items-center justify-between">
                  <TrendingUp className="h-4 w-4 text-blue-500" />

                  <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-blue-600">
                    TOTAL
                  </span>
                </div>

                <p className="mt-2 text-lg font-bold text-blue-700">
                  {formatNumber(
                    totalActivity
                  )}
                </p>

                <p className="mt-0.5 text-[8px] text-blue-500/70">
                  Total aktivitas
                </p>

              </div>

            </div>

            <div className="mt-5 h-[330px] w-full">

              {chartData.length ? (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <AreaChart
                    data={chartData}
                    margin={{
                      top: 15,
                      right: 8,
                      left: -20,
                      bottom: 5,
                    }}
                  >
                    <defs>

                      <linearGradient
                        id="mgbPremiumIn"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#10B981"
                          stopOpacity={0.24}
                        />

                        <stop
                          offset="65%"
                          stopColor="#10B981"
                          stopOpacity={0.055}
                        />

                        <stop
                          offset="100%"
                          stopColor="#10B981"
                          stopOpacity={0}
                        />
                      </linearGradient>

                      <linearGradient
                        id="mgbPremiumOut"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#94A3B8"
                          stopOpacity={0.13}
                        />

                        <stop
                          offset="65%"
                          stopColor="#94A3B8"
                          stopOpacity={0.035}
                        />

                        <stop
                          offset="100%"
                          stopColor="#94A3B8"
                          stopOpacity={0}
                        />
                      </linearGradient>

                    </defs>

                    <CartesianGrid
                      vertical={false}
                      stroke="#E8EEF0"
                      strokeDasharray="3 7"
                    />

                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 9,
                        fill: "#94A3B8",
                      }}
                      tickMargin={12}
                      minTickGap={25}
                    />

                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 9,
                        fill: "#94A3B8",
                      }}
                      tickFormatter={(value) =>
                        Number(
                          value
                        ).toLocaleString(
                          "id-ID"
                        )
                      }
                      width={55}
                    />

                    <Tooltip
                      content={
                        <ChartTooltip />
                      }
                      cursor={{
                        stroke: "#CBD5E1",
                        strokeWidth: 1,
                        strokeDasharray:
                          "4 4",
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="masuk"
                      name="Barang Masuk"
                      stroke="#10B981"
                      strokeWidth={3}
                      fill="url(#mgbPremiumIn)"
                      dot={false}
                      activeDot={{
                        r: 6,
                        strokeWidth: 3,
                        stroke: "#10B981",
                        fill: "#FFFFFF",
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="keluar"
                      name="Barang Keluar"
                      stroke="#94A3B8"
                      strokeWidth={2.5}
                      fill="url(#mgbPremiumOut)"
                      dot={false}
                      activeDot={{
                        r: 5,
                        strokeWidth: 2.5,
                        stroke: "#94A3B8",
                        fill: "#FFFFFF",
                      }}
                    />

                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-[24px] bg-slate-50/70">
                  <EmptyState
                    icon={Activity}
                    title="Belum ada aktivitas"
                    description="Belum ada transaksi inventory pada periode ini."
                  />
                </div>
              )}

            </div>

            <div className="mt-2 flex flex-wrap items-center gap-5 border-t border-slate-100 pt-4">

              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />

                <span className="text-[9px] font-medium text-slate-500">
                  Barang Masuk
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-400" />

                <span className="text-[9px] font-medium text-slate-500">
                  Barang Keluar
                </span>
              </div>

              <div className="ml-auto text-[9px] text-slate-400">
                Periode{" "}
                <span className="font-bold text-slate-600">
                  {period === "7"
                    ? "7 Hari"
                    : period === "30"
                    ? "30 Hari"
                    : "90 Hari"}
                </span>
              </div>

            </div>
          </div>

          {/* INVENTORY HEALTH */}

          <div className="rounded-[30px] border border-white bg-white p-6 shadow-[0_8px_32px_rgba(15,23,42,0.045)]">

            <SectionHeader
              eyebrow="Inventory Intelligence"
              title="Inventory Health"
              description="Kondisi operasional inventory"
              icon={Gauge}
            />

            <div className="relative mt-6 overflow-hidden rounded-[27px] bg-[#0C2720] p-6">

              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-400/[0.08] blur-2xl" />

              <div className="absolute bottom-[-70px] left-[-30px] h-36 w-36 rounded-full bg-teal-400/[0.06] blur-2xl" />

              <div className="relative">

                <div className="flex items-center justify-between">

                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-emerald-200/50">
                      Overall Health
                    </p>

                    <p className="mt-1 text-[9px] text-slate-500">
                      Inventory condition index
                    </p>
                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/[0.08] ring-1 ring-emerald-300/[0.08]">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  </div>

                </div>

                <div className="mt-6 flex items-end gap-2">

                  <span className="text-[48px] font-bold leading-none tracking-[-0.05em] text-white">
                    {stockHealth}
                  </span>

                  <span className="mb-1 text-lg font-semibold text-emerald-300">
                    %
                  </span>

                  <span className="mb-1 ml-1 rounded-full bg-emerald-400/[0.09] px-2 py-1 text-[7px] font-bold uppercase tracking-wide text-emerald-300">
                    {stockHealthLabel}
                  </span>

                </div>

                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-700"
                    style={{
                      width: `${stockHealth}%`,
                    }}
                  />
                </div>

                <div className="mt-2 flex justify-between">
                  <span className="text-[7px] text-slate-600">
                    0
                  </span>

                  <span className="text-[7px] text-slate-600">
                    100
                  </span>
                </div>

              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">

              <div className="rounded-[20px] border border-rose-100 bg-rose-50/60 p-3">
                <PackageX className="h-4 w-4 text-rose-500" />

                <p className="mt-2 text-[8px] font-bold uppercase tracking-wide text-rose-400">
                  Habis
                </p>

                <p className="mt-0.5 text-lg font-bold text-rose-600">
                  {stockOutCount}
                </p>
              </div>

              <div className="rounded-[20px] border border-orange-100 bg-orange-50/60 p-3">
                <AlertCircle className="h-4 w-4 text-orange-500" />

                <p className="mt-2 text-[8px] font-bold uppercase tracking-wide text-orange-400">
                  Kritis
                </p>

                <p className="mt-0.5 text-lg font-bold text-orange-600">
                  {stockCriticalCount}
                </p>
              </div>

              <div className="rounded-[20px] border border-amber-100 bg-amber-50/60 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-500" />

                <p className="mt-2 text-[8px] font-bold uppercase tracking-wide text-amber-500">
                  Rendah
                </p>

                <p className="mt-0.5 text-lg font-bold text-amber-600">
                  {stockLowCount}
                </p>
              </div>

            </div>

            <div className="mt-4 rounded-[22px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Total Persediaan
                  </p>

                  <p className="mt-1 text-xl font-bold tracking-tight text-emerald-600">
                    {formatCompactCurrency(
                      inventoryValueTotal
                    )}
                  </p>

                  <p className="mt-1 text-[8px] text-slate-400">
                    Pusat + Outlet
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-emerald-50">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                </div>

              </div>

              <div className="mt-4 space-y-2">

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[8px] font-medium text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Pusat
                  </span>

                  <span className="text-[9px] font-bold text-slate-700">
                    {formatCompactCurrency(
                      inventoryValuePusat
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[8px] font-medium text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    Outlet
                  </span>

                  <span className="text-[9px] font-bold text-slate-700">
                    {formatCompactCurrency(
                      inventoryValueOutlet
                    )}
                  </span>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* ===================================================
            QUICK ACCESS
        =================================================== */}

        <section>

          <div className="mb-4 flex items-end justify-between">

            <div>
              <div className="flex items-center gap-2">

                <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-emerald-600">
                  Navigation
                </p>

                <span className="h-1 w-1 rounded-full bg-emerald-300" />

                <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Core Modules
                </span>

              </div>

              <h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-slate-800">
                Quick Access
              </h2>

              <p className="mt-1 text-[10px] text-slate-400">
                Akses cepat ke modul utama ERP
              </p>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm sm:flex">
              <Layers3 className="h-3 w-3 text-slate-400" />

              <span className="text-[8px] font-bold text-slate-500">
                {menus.length} MODULES
              </span>
            </div>

          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">

            {menus.map((menu) => {
              const Icon = menu.icon;

              return (
                <Link
                  key={menu.title}
                  href={menu.href}
                  className="group relative overflow-hidden rounded-[23px] border border-white bg-white p-4 shadow-[0_7px_26px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(15,23,42,0.09)]"
                >

                  <div className="flex items-start justify-between">

                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-[14px] ${menu.iconBg} transition-transform duration-300 group-hover:scale-105`}
                    >
                      <Icon
                        className={`h-[18px] w-[18px] ${menu.iconColor}`}
                      />
                    </div>

                    <span className="text-[7px] font-bold tracking-[0.15em] text-slate-300">
                      {menu.code}
                    </span>

                  </div>

                  <p className="mt-5 text-sm font-bold text-slate-700">
                    {menu.title}
                  </p>

                  <p className="mt-1 text-[9px] text-slate-400">
                    {menu.description}
                  </p>

                  <div className="mt-4 flex items-center justify-between">

                    <span className="text-[7px] font-bold uppercase tracking-[0.16em] text-slate-300 transition group-hover:text-emerald-500">
                      Open module
                    </span>

                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-50 transition group-hover:bg-emerald-50">
                      <ChevronRight className="h-3 w-3 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                    </div>

                  </div>

                  <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-emerald-500 transition-all duration-300 group-hover:w-full" />

                </Link>
              );
            })}

          </div>
        </section>

        {/* ===================================================
            MONITORING
        =================================================== */}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">

          {/* ACTIVITY */}

          <div className="rounded-[30px] border border-white bg-white p-6 shadow-[0_8px_32px_rgba(15,23,42,0.045)]">

            <div className="flex items-start justify-between">

              <SectionHeader
                eyebrow="Monitoring"
                title="Aktivitas Terbaru"
                description="Aktivitas terakhir yang tercatat"
                icon={Clock3}
              />

              <div className="flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1.5">

                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />

                  <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>

                <span className="text-[7px] font-bold text-emerald-600">
                  LIVE
                </span>

              </div>

            </div>

            <div className="mt-5 divide-y divide-slate-100">

              {data?.activities?.length ? (
                data.activities
                  .slice(0, 6)
                  .map((item: any) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-3 py-3.5"
                    >

                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-slate-50 transition-all group-hover:bg-emerald-50">

                        {item.type ===
                        "delivery" ? (
                          <Send className="h-4 w-4 text-indigo-500" />
                        ) : (
                          <ShoppingCart className="h-4 w-4 text-emerald-600" />
                        )}

                        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-white bg-emerald-400" />

                      </div>

                      <div className="min-w-0 flex-1">

                        <p className="truncate text-[10px] font-bold text-slate-700">
                          {item.title}
                        </p>

                        <p className="mt-0.5 truncate text-[9px] text-slate-400">
                          {item.description}
                        </p>

                      </div>

                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-200 transition group-hover:translate-x-0.5 group-hover:text-slate-400" />

                    </div>
                  ))
              ) : (
                <EmptyState
                  icon={Clock3}
                  title="Belum ada aktivitas"
                  description="Aktivitas operasional akan muncul di sini."
                />
              )}

            </div>
          </div>

          {/* STOCK ALERT */}

          <div className="rounded-[30px] border border-white bg-white p-6 shadow-[0_8px_32px_rgba(15,23,42,0.045)]">

            <div className="flex items-start justify-between">

              <SectionHeader
                eyebrow="Attention Center"
                title="Stock Alert"
                description="Barang yang membutuhkan perhatian"
                icon={AlertTriangle}
              />

              {stockAlertCount > 0 ? (
                <span className="rounded-xl bg-orange-50 px-3 py-1.5 text-[8px] font-bold text-orange-600">
                  {stockAlertCount} ALERT
                </span>
              ) : (
                <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5">

                  <CircleCheck className="h-3 w-3 text-emerald-500" />

                  <span className="text-[8px] font-bold text-emerald-600">
                    SAFE
                  </span>

                </div>
              )}

            </div>

            {stockAlertCount > 0 && (
              <div className="mt-5 grid grid-cols-3 gap-2">

                <div className="rounded-[19px] border border-rose-100 bg-rose-50/50 p-3">
                  <p className="text-[8px] font-bold uppercase tracking-wide text-rose-400">
                    Habis
                  </p>

                  <p className="mt-1 text-lg font-bold text-rose-600">
                    {stockOutCount}
                  </p>
                </div>

                <div className="rounded-[19px] border border-orange-100 bg-orange-50/50 p-3">
                  <p className="text-[8px] font-bold uppercase tracking-wide text-orange-400">
                    Kritis
                  </p>

                  <p className="mt-1 text-lg font-bold text-orange-600">
                    {stockCriticalCount}
                  </p>
                </div>

                <div className="rounded-[19px] border border-amber-100 bg-amber-50/50 p-3">
                  <p className="text-[8px] font-bold uppercase tracking-wide text-amber-500">
                    Rendah
                  </p>

                  <p className="mt-1 text-lg font-bold text-amber-600">
                    {stockLowCount}
                  </p>
                </div>

              </div>
            )}

            <div className="mt-5 divide-y divide-slate-100">

              {data?.stockAlerts?.length ? (
                data.stockAlerts
                  .slice(0, 6)
                  .map((item) => {
                    const status =
                      getStockStatus(
                        item.status
                      );

                    return (
                      <div
                        key={item.id}
                        className="py-4"
                      >

                        <div className="flex items-start gap-3">

                          <div
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${status.icon}`}
                          >
                            {item.status ===
                            "OUT_OF_STOCK" ? (
                              <PackageX className="h-4 w-4" />
                            ) : (
                              <AlertCircle className="h-4 w-4" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">

                            <div className="flex items-start justify-between gap-3">

                              <div className="min-w-0">

                                <p className="truncate text-[10px] font-bold text-slate-700">
                                  {item.name}
                                </p>

                                <p className="mt-0.5 text-[8px] text-slate-400">
                                  {item.code}
                                </p>

                              </div>

                              <span
                                className={`shrink-0 rounded-lg border px-2 py-1 text-[7px] font-bold tracking-wide ${status.badge}`}
                              >
                                {status.label}
                              </span>

                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3">

                              <div>
                                <p className="text-[8px] text-slate-400">
                                  Stock
                                </p>

                                <p className="mt-0.5 text-xs font-bold text-slate-700">
                                  {formatNumber(
                                    item.stock
                                  )}

                                  <span className="ml-1 text-[8px] font-medium text-slate-400">
                                    {item.unit}
                                  </span>
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="text-[8px] text-slate-400">
                                  Minimum
                                </p>

                                <p className="mt-0.5 text-xs font-semibold text-slate-600">
                                  {formatNumber(
                                    item.minimumStock
                                  )}

                                  <span className="ml-1 text-[8px] font-medium text-slate-400">
                                    {item.unit}
                                  </span>
                                </p>
                              </div>

                            </div>

                            <div className="mt-2">

                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">

                                <div
                                  className={`h-full rounded-full ${status.bar} transition-all duration-500`}
                                  style={{
                                    width: `${Math.max(
                                      Math.min(
                                        Number(
                                          item.percentage ||
                                            0
                                        ),
                                        100
                                      ),
                                      item.stock > 0
                                        ? 4
                                        : 0
                                    )}%`,
                                  }}
                                />

                              </div>

                            </div>

                            <div className="mt-2 flex items-center justify-between">

                              <span className="text-[8px] text-slate-400">
                                {Math.round(
                                  item.percentage
                                )}
                                % dari minimum
                              </span>

                              <span className="text-[8px] font-semibold text-slate-500">
                                Kurang{" "}
                                {formatNumber(
                                  item.shortage
                                )}{" "}
                                {item.unit}
                              </span>

                            </div>

                          </div>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="Semua stock aman"
                  description="Tidak ada barang yang berada di bawah minimum stock."
                />
              )}

            </div>
          </div>
        </section>

        {/* ===================================================
            PENDING OPERATIONS
        =================================================== */}

        <section>

          <div className="mb-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-emerald-600">
              Operational Queue
            </p>

            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-800">
              Pending Operations
            </h2>

            <p className="mt-1 text-[10px] text-slate-400">
              Aktivitas operasional yang masih membutuhkan proses
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

            {/* PURCHASE */}

            <div className="group rounded-[30px] border border-white bg-white p-6 shadow-[0_8px_32px_rgba(15,23,42,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.075)]">

              <div className="flex items-start justify-between">

                <SectionHeader
                  eyebrow="Procurement"
                  title="Purchase Pending"
                  description="Purchase order menunggu proses"
                  icon={ShoppingCart}
                />

                <TimerReset className="h-4 w-4 text-slate-300" />

              </div>

              <div className="mt-5 divide-y divide-slate-100">

                {data?.purchasePending?.length ? (
                  data.purchasePending
                    .slice(0, 6)
                    .map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-3.5"
                      >

                        <div className="min-w-0">

                          <p className="truncate text-[10px] font-bold text-slate-700">
                            {item.number ?? "-"}
                          </p>

                          <p className="mt-0.5 truncate text-[9px] text-slate-400">
                            {item.supplier?.name ?? "-"}
                          </p>

                        </div>

                        <span className="shrink-0 rounded-lg bg-amber-50 px-2 py-1 text-[7px] font-bold text-amber-600">
                          {item.status ?? "PENDING"}
                        </span>

                      </div>
                    ))
                ) : (
                  <EmptyState
                    icon={CheckCircle2}
                    title="Tidak ada PO pending"
                    description="Semua purchase order sudah tertangani."
                  />
                )}

              </div>
            </div>

            {/* DELIVERY */}

            <div className="group rounded-[30px] border border-white bg-white p-6 shadow-[0_8px_32px_rgba(15,23,42,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.075)]">

              <div className="flex items-start justify-between">

                <SectionHeader
                  eyebrow="Logistics"
                  title="Delivery Pending"
                  description="Pengiriman yang masih berjalan"
                  icon={Send}
                />

                <Truck className="h-4 w-4 text-slate-300" />

              </div>

              <div className="mt-5 divide-y divide-slate-100">

                {data?.deliveryPending?.length ? (
                  data.deliveryPending
                    .slice(0, 6)
                    .map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-3.5"
                      >

                        <div className="min-w-0">

                          <p className="truncate text-[10px] font-bold text-slate-700">
                            {item.number ?? "-"}
                          </p>

                          <p className="mt-0.5 truncate text-[9px] text-slate-400">
                            {item.customer?.name ?? "-"}
                          </p>

                        </div>

                        <span className="shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-[7px] font-bold text-indigo-600">
                          {item.status ?? "PENDING"}
                        </span>

                      </div>
                    ))
                ) : (
                  <EmptyState
                    icon={PackageCheck}
                    title="Tidak ada delivery pending"
                    description="Semua pengiriman sudah tertangani."
                  />
                )}

              </div>
            </div>

            {/* EXPIRED */}

            <div className="group rounded-[30px] border border-white bg-white p-6 shadow-[0_8px_32px_rgba(15,23,42,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.075)]">

              <div className="flex items-start justify-between">

                <SectionHeader
                  eyebrow="Quality Control"
                  title="Barang Expired"
                  description="Monitoring masa berlaku barang"
                  icon={PackageX}
                />

                <AlertTriangle className="h-4 w-4 text-slate-300" />

              </div>

              <div className="mt-5 divide-y divide-slate-100">

                {data?.expiredItems?.length ? (
                  data.expiredItems
                    .slice(0, 6)
                    .map((item: any) => (
                      <div
                        key={item.id}
                        className="py-3.5"
                      >

                        <div className="flex items-center justify-between gap-3">

                          <p className="truncate text-[10px] font-bold text-slate-700">
                            {item.name}
                          </p>

                          <span
                            className={`shrink-0 rounded-lg px-2 py-1 text-[7px] font-bold ${
                              item.status ===
                              "EXPIRED"
                                ? "bg-rose-50 text-rose-600"
                                : "bg-amber-50 text-amber-600"
                            }`}
                          >
                            {item.status ===
                            "EXPIRED"
                              ? "EXPIRED"
                              : "WARNING"}
                          </span>

                        </div>

                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[8px] text-slate-400">

                          <span>
                            Batch:{" "}
                            {item.batch ?? "-"}
                          </span>

                          <span>
                            Qty: {item.qty ?? 0}
                          </span>

                          <span>
                            Expired:{" "}
                            {item.expired
                              ? new Date(
                                  item.expired
                                ).toLocaleDateString(
                                  "id-ID"
                                )
                              : "-"}
                          </span>

                        </div>

                      </div>
                    ))
                ) : (
                  <EmptyState
                    icon={CheckCircle2}
                    title="Tidak ada barang expired"
                    description="Tidak ditemukan barang yang melewati masa berlaku."
                  />
                )}

              </div>
            </div>

          </div>
        </section>

        {/* ===================================================
            EXECUTIVE FOOTER
        =================================================== */}

        <footer className="flex flex-col items-center justify-between gap-4 border-t border-slate-200/80 py-8 sm:flex-row">

          <div>
            <div className="flex items-center gap-2">

              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0D2922]">
                <span className="text-[8px] font-black tracking-tight text-emerald-300">
                  MGB
                </span>
              </div>

              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600">
                  PT. Mitra Garam Bogatama
                </p>

                <p className="mt-0.5 text-[8px] text-slate-400">
                  Enterprise Resource Planning System
                </p>
              </div>

            </div>
          </div>

          <div className="flex items-center gap-3">

            <div className="hidden text-right sm:block">
              <p className="text-[7px] font-bold uppercase tracking-[0.16em] text-slate-400">
                System Status
              </p>

              <p className="mt-0.5 text-[8px] font-semibold text-slate-500">
                All systems operational
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3.5 py-2 shadow-sm">

              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />

                <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>

              <p className="text-[8px] font-bold text-slate-500">
                MGB ERP • Command Center
              </p>

            </div>

          </div>

        </footer>

      </div>
    </div>
  );
}