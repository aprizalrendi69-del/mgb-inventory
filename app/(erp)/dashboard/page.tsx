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
  FileText,
  ChevronRight,
  Clock3,
  PackageCheck,
  PackageX,
  Warehouse,
  RefreshCw,
  CalendarDays,
  Send,
  AlertCircle,
  ArrowDownRight,
  Circle,
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
  outlet?: {
    id?: number;
    name?: string | null;
  } | null;
  lastSeen?: string | null;
  isOnline?: boolean;
};

type DashboardData = {
  stats: {
    totalBarang: number;
    totalSupplier: number;
    totalCustomer: number;
    totalPurchase: number;
    totalDelivery: number;
    nilaiPersediaan: number;

    stockAlertCount: number;
    stockOutCount: number;
    stockCriticalCount: number;
    stockLowCount: number;

    purchaseTrend: number;
    deliveryTrend: number;
    stockTrend: number;
  };

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

/**
 * Mengambil nama user secara aman.
 *
 * Prioritas:
 * fullname -> name -> username -> User
 */
function getUserDisplayName(user: OnlineUser) {
  const fullname =
    typeof user.fullname === "string"
      ? user.fullname.trim()
      : "";

  if (fullname) {
    return fullname;
  }

  const name =
    typeof user.name === "string"
      ? user.name.trim()
      : "";

  if (name) {
    return name;
  }

  const username =
    typeof user.username === "string"
      ? user.username.trim()
      : "";

  if (username) {
    return username;
  }

  return "User";
}

function getInitials(name?: string | null) {
  const safeName =
    typeof name === "string"
      ? name.trim()
      : "";

  if (!safeName) {
    return "U";
  }

  const words = safeName
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "U";
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${words[0][0]}${
    words[words.length - 1][0]
  }`.toUpperCase();
}

function getOnlineDuration(lastSeen?: string | null) {
  if (!lastSeen) {
    return "Aktif";
  }

  const timestamp = new Date(lastSeen).getTime();

  if (!Number.isFinite(timestamp)) {
    return "Aktif";
  }

  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 1000)
  );

  if (diffSeconds < 10) {
    return "Baru saja";
  }

  if (diffSeconds < 60) {
    return `${diffSeconds} detik lalu`;
  }

  const minutes = Math.floor(diffSeconds / 60);

  if (minutes < 60) {
    return `${minutes} menit lalu`;
  }

  const hours = Math.floor(minutes / 60);

  return `${hours} jam lalu`;
}

/**
 * Normalisasi data dari API online-users.
 *
 * API bisa mengirim:
 * - name
 * - fullname
 * - username
 *
 * Dashboard tetap menggunakan struktur OnlineUser
 * yang aman.
 */
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
    <div className="min-w-[220px] rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.14)] backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-xs font-bold text-slate-700">
          {label}
        </p>

        <span className="rounded-lg bg-slate-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
          Aktivitas
        </span>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.10)]" />

            <span className="text-xs text-slate-500">
              Barang Masuk
            </span>
          </div>

          <span className="text-xs font-bold text-emerald-600">
            {formatNumber(masuk)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400 shadow-[0_0_0_4px_rgba(148,163,184,0.10)]" />

            <span className="text-xs text-slate-500">
              Barang Keluar
            </span>
          </div>

          <span className="text-xs font-bold text-slate-600">
            {formatNumber(keluar)}
          </span>
        </div>

        <div className="my-3 border-t border-slate-100" />

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Total Aktivitas
          </span>

          <span className="text-xs font-bold text-slate-700">
            {formatNumber(masuk + keluar)}
          </span>
        </div>
      </div>
    </div>
  );
}

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

        const normalizedUsers =
          rawUsers.map(
            (user: any, index: number) =>
              normalizeOnlineUser(
                user,
                index
              )
          );

        setOnlineUsers(normalizedUsers);
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

  const handlePeriodChange = (
    newPeriod: Period
  ) => {
    setPeriod(newPeriod);
    loadDashboard(newPeriod);
  };

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

  const inventoryValue =
    Number(
      data?.stats.nilaiPersediaan || 0
    );

  const cards = [
    {
      title: "Total Barang",
      value:
        data?.stats.totalBarang?.toLocaleString(
          "id-ID"
        ) ?? "0",
      icon: Package,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      accent: "bg-blue-400",
    },
    {
      title: "Total Supplier",
      value:
        data?.stats.totalSupplier?.toLocaleString(
          "id-ID"
        ) ?? "0",
      icon: Users,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-500",
      accent: "bg-violet-400",
    },
    {
      title: "Total Customer",
      value:
        data?.stats.totalCustomer?.toLocaleString(
          "id-ID"
        ) ?? "0",
      icon: Truck,
      iconBg: "bg-sky-50",
      iconColor: "text-sky-500",
      accent: "bg-sky-400",
    },
    {
      title: "Purchase",
      value:
        data?.stats.totalPurchase?.toLocaleString(
          "id-ID"
        ) ?? "0",
      icon: ShoppingCart,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
      accent: "bg-amber-400",
    },
    {
      title: "Delivery",
      value:
        data?.stats.totalDelivery?.toLocaleString(
          "id-ID"
        ) ?? "0",
      icon: Send,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-500",
      accent: "bg-indigo-400",
    },
    {
      title: "Nilai Persediaan",
      value:
        formatCompactCurrency(
          inventoryValue
        ),
      fullValue:
        formatCurrency(inventoryValue),
      icon: DollarSign,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-500",
      accent: "bg-emerald-400",
    },
    {
      title: "Stock Alert",
      value:
        stockAlertCount.toLocaleString(
          "id-ID"
        ),
      icon: AlertTriangle,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-500",
      accent: "bg-orange-400",
    },
  ];

  const menus = [
    {
      title: "Barang",
      description: "Master barang",
      href: "/master-barang",
      icon: Package,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      hover:
        "hover:border-blue-200 hover:bg-blue-50/40",
    },
    {
      title: "Supplier",
      description: "Data supplier",
      href: "/supplier",
      icon: Warehouse,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-500",
      hover:
        "hover:border-violet-200 hover:bg-violet-50/40",
    },
    {
      title: "Customer",
      description: "Data customer",
      href: "/customer",
      icon: Users,
      iconBg: "bg-sky-50",
      iconColor: "text-sky-500",
      hover:
        "hover:border-sky-200 hover:bg-sky-50/40",
    },
    {
      title: "Purchase",
      description: "Purchase order",
      href: "/purchase",
      icon: ShoppingCart,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
      hover:
        "hover:border-amber-200 hover:bg-amber-50/40",
    },
    {
      title: "Delivery",
      description: "Pengiriman barang",
      href: "/surat-jalan",
      icon: Send,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-500",
      hover:
        "hover:border-indigo-200 hover:bg-indigo-50/40",
    },
    {
      title: "Inventory",
      description: "Stock inventory",
      href: "/inventory",
      icon: Boxes,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-500",
      hover:
        "hover:border-emerald-200 hover:bg-emerald-50/40",
    },
    {
      title: "Laporan",
      description: "Report ERP",
      href: "/laporan",
      icon: FileText,
      iconBg: "bg-cyan-50",
      iconColor: "text-cyan-500",
      hover:
        "hover:border-cyan-200 hover:bg-cyan-50/40",
    },
  ];

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

  function getStockStatus(
    status: StockAlert["status"]
  ) {
    if (status === "OUT_OF_STOCK") {
      return {
        label: "HABIS",
        badge:
          "bg-rose-50 text-rose-600 border-rose-100",
        bar: "bg-rose-400",
        icon: "bg-rose-50 text-rose-500",
      };
    }

    if (status === "CRITICAL") {
      return {
        label: "KRITIS",
        badge:
          "bg-orange-50 text-orange-600 border-orange-100",
        bar: "bg-orange-400",
        icon: "bg-orange-50 text-orange-500",
      };
    }

    return {
      label: "RENDAH",
      badge:
        "bg-amber-50 text-amber-600 border-amber-100",
      bar: "bg-amber-400",
      icon: "bg-amber-50 text-amber-500",
    };
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F8F7] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="h-36 animate-pulse rounded-[28px] bg-white shadow-sm" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {Array.from({ length: 7 }).map(
              (_, i) => (
                <div
                  key={i}
                  className="h-36 animate-pulse rounded-2xl bg-white shadow-sm"
                />
              )
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="h-96 animate-pulse rounded-[28px] bg-white xl:col-span-2" />

            <div className="h-96 animate-pulse rounded-[28px] bg-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F8F7] text-slate-800">
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">

        {/* HEADER */}

        <section className="relative overflow-hidden rounded-[30px] border border-white bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.05)] sm:p-8">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-100/50 blur-3xl" />

          <div className="absolute -bottom-24 right-48 h-48 w-48 rounded-full bg-teal-100/40 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_5px_rgba(52,211,153,0.10)]" />

                <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                  MGB ERP
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
                Hallo... Selamat datang di dashboard PT.MGB
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Pantau aktivitas inventory,
                purchase, delivery, dan kondisi
                stock di sini ya guys.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                <CalendarDays className="h-5 w-5 text-emerald-600" />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Hari ini
                </p>

                <p className="mt-0.5 text-sm font-semibold text-slate-700">
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
                className="ml-2 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing ||
                    onlineRefreshing
                      ? "animate-spin"
                      : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* USER ONLINE */}

        <section className="rounded-[24px] border border-white bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.045)] sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                <Users className="h-4 w-4 text-emerald-600" />

                <span className="absolute right-1 top-1 h-2 w-2 rounded-full border border-white bg-emerald-500" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-800">
                    User Online
                  </h2>

                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">
                    {onlineUsers.length} Online
                  </span>
                </div>

                <p className="mt-0.5 text-[10px] text-slate-400">
                  Pengguna yang sedang aktif di sistem
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                loadOnlineUsers(true)
              }
              disabled={onlineRefreshing}
              className="flex items-center justify-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50 sm:self-auto"
            >
              <RefreshCw
                className={`h-3 w-3 ${
                  onlineRefreshing
                    ? "animate-spin"
                    : ""
                }`}
              />

              Refresh
            </button>
          </div>

          <div className="mt-4">
            {onlineLoading ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {Array.from({
                  length: 6,
                }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[58px] animate-pulse rounded-xl bg-slate-50"
                  />
                ))}
              </div>
            ) : onlineUsers.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {onlineUsers.map((user) => {
                  const displayName =
                    getUserDisplayName(
                      user
                    );

                  return (
                    <div
                      key={user.id}
                      className="group flex min-w-0 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-2.5 py-2 transition hover:border-emerald-100 hover:bg-emerald-50/40"
                    >
                      <div className="relative shrink-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[10px] font-bold text-emerald-600 shadow-sm ring-1 ring-slate-100">
                          {getInitials(
                            displayName
                          )}
                        </div>

                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold leading-4 text-slate-700">
                          {displayName}
                        </p>

                        <div className="flex min-w-0 items-center gap-1">
                          <span className="truncate text-[9px] font-medium leading-3 text-slate-400">
                            {formatRole(
                              user.role
                            )}
                          </span>

                          {user.outlet?.name && (
                            <>
                              <span className="shrink-0 text-[8px] text-slate-300">
                                •
                              </span>

                              <span className="truncate text-[9px] leading-3 text-slate-400">
                                {user.outlet.name}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="mt-0.5 flex items-center gap-1">
                          <Circle className="h-1.5 w-1.5 fill-emerald-500 text-emerald-500" />

                          <span className="truncate text-[8px] font-medium leading-3 text-emerald-600">
                            {getOnlineDuration(
                              user.lastSeen
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50/70 py-8 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                  <Users className="h-5 w-5 text-slate-400" />
                </div>

                <p className="mt-2 text-xs font-semibold text-slate-600">
                  Tidak ada user online
                </p>

                <p className="mt-1 text-[10px] text-slate-400">
                  Belum ada pengguna aktif saat ini.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* STATISTIC CARD */}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.title}
                title={
                  "fullValue" in card
                    ? card.fullValue
                    : undefined
                }
                className="group relative overflow-hidden rounded-2xl border border-white bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.045)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(15,23,42,0.07)]"
              >
                <div
                  className={`absolute left-0 top-0 h-1 w-full ${card.accent}`}
                />

                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.iconBg}`}
                  >
                    <Icon
                      className={`h-5 w-5 ${card.iconColor}`}
                    />
                  </div>

                  <ArrowUpRight
                    className={`h-4 w-4 ${card.iconColor} opacity-40 transition group-hover:opacity-100`}
                  />
                </div>

                <p className="mt-5 text-xs font-medium text-slate-400">
                  {card.title}
                </p>

                <p className="mt-1 truncate text-xl font-bold tracking-tight text-slate-800">
                  {card.value}
                </p>

                <div className="mt-3 flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${card.accent}`}
                  />

                  <span className="text-[10px] font-medium text-slate-400">
                    Data realtime
                  </span>
                </div>
              </div>
            );
          })}
        </section>

        {/* CHART + INFORMATION */}

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">

          {/* CHART */}

          <div className="rounded-[28px] border border-white bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.045)] xl:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                  <Boxes className="h-5 w-5 text-emerald-600" />
                </div>

                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    Aktivitas Inventory
                  </h2>

                  <p className="text-xs text-slate-400">
                    Barang masuk dan keluar
                  </p>
                </div>
              </div>

              <div className="flex rounded-xl bg-slate-100 p-1">
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
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      period === item[0]
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "text-slate-500 hover:bg-white hover:text-emerald-600"
                    }`}
                  >
                    {item[1]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-emerald-500" />

                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                    Masuk
                  </span>
                </div>

                <p className="mt-1 text-lg font-bold text-emerald-700">
                  {formatNumber(
                    chartSummary.masuk
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-slate-500" />

                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Keluar
                  </span>
                </div>

                <p className="mt-1 text-lg font-bold text-slate-700">
                  {formatNumber(
                    chartSummary.keluar
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                <div className="flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-blue-500" />

                  <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">
                    Aktivitas
                  </span>
                </div>

                <p className="mt-1 text-lg font-bold text-blue-700">
                  {formatNumber(
                    totalActivity
                  )}
                </p>
              </div>
            </div>

            <div className="mt-6">
              {chartData.length ? (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <AreaChart
                      data={chartData}
                      margin={{
                        top: 15,
                        right: 12,
                        left: -18,
                        bottom: 5,
                      }}
                    >
                      <defs>
                        <linearGradient
                          id="dashboardMasukGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#10B981"
                            stopOpacity={0.32}
                          />

                          <stop
                            offset="55%"
                            stopColor="#10B981"
                            stopOpacity={0.1}
                          />

                          <stop
                            offset="100%"
                            stopColor="#10B981"
                            stopOpacity={0}
                          />
                        </linearGradient>

                        <linearGradient
                          id="dashboardKeluarGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#94A3B8"
                            stopOpacity={0.2}
                          />

                          <stop
                            offset="55%"
                            stopColor="#94A3B8"
                            stopOpacity={0.07}
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
                        stroke="#E2E8F0"
                        strokeDasharray="3 6"
                      />

                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fill: "#94A3B8",
                        }}
                        tickMargin={12}
                        minTickGap={25}
                      />

                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
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
                        fill="url(#dashboardMasukGradient)"
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
                        fill="url(#dashboardKeluarGradient)"
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
                </div>
              ) : (
                <div className="flex h-[320px] items-center justify-center rounded-2xl bg-slate-50/70 text-sm text-slate-400">
                  Belum ada aktivitas inventory
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-5 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.10)]" />

                <span className="text-xs font-medium text-slate-500">
                  Barang Masuk
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400 shadow-[0_0_0_4px_rgba(148,163,184,0.10)]" />

                <span className="text-xs font-medium text-slate-500">
                  Barang Keluar
                </span>
              </div>

              <div className="ml-auto text-[10px] text-slate-400">
                Periode:{" "}
                <span className="font-semibold text-slate-600">
                  {period === "7"
                    ? "7 Hari"
                    : period === "30"
                    ? "30 Hari"
                    : "90 Hari"}
                </span>
              </div>
            </div>
          </div>

          {/* INFORMATION */}

          <div className="rounded-[28px] border border-white bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                <PackageCheck className="h-5 w-5 text-emerald-600" />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Informasi Inventory
                </h2>

                <p className="text-xs text-slate-400">
                  Ringkasan sistem
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div
                title={formatCurrency(
                  inventoryValue
                )}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-emerald-50/70 to-teal-50 p-4"
              >
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-200/30 blur-2xl" />

                <div className="relative">
                  <p className="text-xs font-medium text-slate-500">
                    Nilai Persediaan
                  </p>

                  <p className="mt-1 truncate text-2xl font-bold tracking-tight text-emerald-600">
                    {formatCompactCurrency(
                      inventoryValue
                    )}
                  </p>

                  <p className="mt-1 text-[10px] text-slate-400">
                    Hover untuk melihat nilai lengkap
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-100 bg-blue-50/30 p-4">
                  <p className="text-xs text-slate-500">
                    Total Purchase
                  </p>

                  <p className="mt-1 text-lg font-bold text-blue-600">
                    {formatNumber(
                      data?.stats
                        .totalPurchase ?? 0
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-indigo-50/30 p-4">
                  <p className="text-xs text-slate-500">
                    Total Delivery
                  </p>

                  <p className="mt-1 text-lg font-bold text-indigo-600">
                    {formatNumber(
                      data?.stats
                        .totalDelivery ?? 0
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* QUICK MENU */}

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-800">
              Quick Menu
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              Akses modul ERP
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {menus.map((menu) => {
              const Icon = menu.icon;

              return (
                <Link
                  key={menu.title}
                  href={menu.href}
                  className={`group rounded-2xl border border-white bg-white p-4 shadow-[0_6px_22px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)] ${menu.hover}`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${menu.iconBg}`}
                    >
                      <Icon
                        className={`h-5 w-5 ${menu.iconColor}`}
                      />
                    </div>

                    <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
                  </div>

                  <p className="mt-4 text-sm font-bold text-slate-700">
                    {menu.title}
                  </p>

                  <p className="mt-1 text-[11px] text-slate-400">
                    {menu.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ACTIVITY + STOCK ALERT */}

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">

          {/* ACTIVITY */}

          <div className="rounded-[28px] border border-white bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Aktivitas Terbaru
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Aktivitas terakhir ERP
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                <Clock3 className="h-4 w-4 text-emerald-600" />
              </div>
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              {data?.activities?.length ? (
                data.activities
                  .slice(0, 6)
                  .map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 py-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                        {item.type ===
                        "delivery" ? (
                          <Send className="h-4 w-4 text-indigo-500" />
                        ) : (
                          <ShoppingCart className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-700">
                          {item.title}
                        </p>

                        <p className="text-xs text-slate-400">
                          {item.description}
                        </p>
                      </div>

                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </div>
                  ))
              ) : (
                <div className="py-10 text-center text-sm text-slate-400">
                  Belum ada aktivitas
                </div>
              )}
            </div>
          </div>

          {/* STOCK ALERT */}

          <div className="rounded-[28px] border border-white bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-slate-800">
                      Stock Alert
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-400">
                      Barang di bawah batas minimum
                    </p>
                  </div>
                </div>
              </div>

              {stockAlertCount > 0 && (
                <span className="rounded-xl bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-600">
                  {stockAlertCount} Alert
                </span>
              )}
            </div>

            {stockAlertCount > 0 && (
              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-400">
                    Habis
                  </p>

                  <p className="mt-1 text-lg font-bold text-rose-600">
                    {stockOutCount}
                  </p>
                </div>

                <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-400">
                    Kritis
                  </p>

                  <p className="mt-1 text-lg font-bold text-orange-600">
                    {stockCriticalCount}
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500">
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
                                <p className="truncate text-sm font-semibold text-slate-700">
                                  {item.name}
                                </p>

                                <p className="mt-0.5 text-[11px] text-slate-400">
                                  {item.code}
                                </p>
                              </div>

                              <span
                                className={`shrink-0 rounded-lg border px-2 py-1 text-[9px] font-bold tracking-wide ${status.badge}`}
                              >
                                {status.label}
                              </span>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[10px] text-slate-400">
                                  Stock saat ini
                                </p>

                                <p className="mt-0.5 text-sm font-bold text-slate-700">
                                  {formatNumber(
                                    item.stock
                                  )}

                                  <span className="ml-1 text-[10px] font-medium text-slate-400">
                                    {item.unit}
                                  </span>
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="text-[10px] text-slate-400">
                                  Minimum
                                </p>

                                <p className="mt-0.5 text-sm font-semibold text-slate-600">
                                  {formatNumber(
                                    item.minimumStock
                                  )}

                                  <span className="ml-1 text-[10px] font-medium text-slate-400">
                                    {item.unit}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="mt-2">
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full transition-all ${status.bar}`}
                                  style={{
                                    width: `${Math.max(
                                      Math.min(
                                        item.percentage,
                                        100
                                      ),
                                      item.stock >
                                        0
                                        ? 4
                                        : 0
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400">
                                {Math.round(
                                  item.percentage
                                )}
                                % dari minimum
                              </span>

                              <span className="text-[10px] font-semibold text-slate-500">
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
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
                    <PackageCheck className="h-6 w-6 text-emerald-500" />
                  </div>

                  <p className="mt-3 text-sm font-semibold text-emerald-600">
                    Semua stock aman
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Tidak ada barang di bawah minimum stock.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* PURCHASE / DELIVERY / EXPIRED */}

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* PURCHASE */}

          <div className="rounded-[28px] border border-white bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                <ShoppingCart className="h-5 w-5 text-amber-500" />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Purchase Pending
                </h2>

                <p className="text-xs text-slate-400">
                  Purchase order menunggu proses
                </p>
              </div>
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              {data?.purchasePending?.length ? (
                data.purchasePending
                  .slice(0, 6)
                  .map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-700">
                          {item.number ?? "-"}
                        </p>

                        <p className="truncate text-xs text-slate-400">
                          {item.supplier?.name ??
                            "-"}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-600">
                        {item.status ??
                          "PENDING"}
                      </span>
                    </div>
                  ))
              ) : (
                <div className="py-10 text-center text-sm text-slate-400">
                  Tidak ada PO pending
                </div>
              )}
            </div>
          </div>

          {/* DELIVERY */}

          <div className="rounded-[28px] border border-white bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <Send className="h-5 w-5 text-indigo-500" />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Delivery Pending
                </h2>

                <p className="text-xs text-slate-400">
                  Pengiriman berjalan
                </p>
              </div>
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              {data?.deliveryPending?.length ? (
                data.deliveryPending
                  .slice(0, 6)
                  .map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-700">
                          {item.number ?? "-"}
                        </p>

                        <p className="truncate text-xs text-slate-400">
                          {item.customer?.name ??
                            "-"}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600">
                        {item.status ??
                          "PENDING"}
                      </span>
                    </div>
                  ))
              ) : (
                <div className="py-10 text-center text-sm text-slate-400">
                  Tidak ada delivery pending
                </div>
              )}
            </div>
          </div>

          {/* EXPIRED */}

          <div className="rounded-[28px] border border-white bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
                <PackageX className="h-5 w-5 text-rose-500" />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Barang Expired
                </h2>

                <p className="text-xs text-slate-400">
                  Monitoring expired barang
                </p>
              </div>
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              {data?.expiredItems?.length ? (
                data.expiredItems
                  .slice(0, 6)
                  .map((item: any) => (
                    <div
                      key={item.id}
                      className="py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-slate-700">
                          {item.name}
                        </p>

                        <span
                          className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ${
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

                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
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
                <div className="flex items-center justify-center py-10 text-sm text-emerald-600">
                  Tidak ada barang expired
                </div>
              )}
            </div>
          </div>
        </section>

        {/* FOOTER */}

        <footer className="border-t border-slate-200 py-5 text-center">
          <p className="text-xs text-slate-400">
            PT. Mitra Garam Bogatama • ERP Inventory System
          </p>
        </footer>
      </div>
    </div>
  );
}