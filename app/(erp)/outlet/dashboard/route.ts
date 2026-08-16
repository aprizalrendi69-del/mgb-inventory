"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  ShoppingCart,
  Package,
  PackageCheck,
  Clock3,
  AlertTriangle,
  ClipboardList,
  ArrowRight,
  RefreshCw,
  CalendarDays,
  Send,
  Boxes,
  ChevronRight,
  FileText,
  Warehouse,
  CheckCircle2,
  CircleAlert,
  Truck,
} from "lucide-react";

type DashboardData = {
  totalPurchase: number;
  totalDraft: number;
  totalApproved: number;
  totalReceived: number;
  totalReceipt: number;
  totalStock: number;
  lowStock: number;

  recentPurchase: {
    id: number;
    number: string;
    purchaseDate: string;
    status: string;
    total: number;
    supplier: {
      code: string;
      name: string;
    };
  }[];
};

type UserData = {
  id?: number;
  username?: string;
  fullname?: string;
  outlet?: {
    id?: number;
    code?: string;
    name?: string;
  };
};

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

export default function OutletDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [user, setUser] = useState<UserData | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadDashboard(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const res = await fetch("/api/outlet/dashboard", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Dashboard outlet gagal dimuat");
      }

      const json = await res.json();

      if (!json.success) {
        throw new Error(
          json.message || "Gagal mengambil dashboard outlet"
        );
      }

      setData(json.data);
      setUser(json.user);
    } catch (error) {
      console.error("OUTLET DASHBOARD ERROR:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const today = useMemo(() => {
    return new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, []);

  function formatDate(value: string) {
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

  function statusBadge(status: string) {
    const normalized = String(status || "").toUpperCase();

    if (normalized === "DRAFT") {
      return (
        <span className="rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-bold tracking-wide text-amber-600">
          DRAFT
        </span>
      );
    }

    if (normalized === "APPROVED") {
      return (
        <span className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold tracking-wide text-blue-600">
          APPROVED
        </span>
      );
    }

    if (normalized === "RECEIVED") {
      return (
        <span className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold tracking-wide text-emerald-600">
          RECEIVED
        </span>
      );
    }

    return (
      <span className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-bold tracking-wide text-slate-500">
        {normalized || "-"}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F8F7] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="h-36 animate-pulse rounded-[28px] bg-white shadow-sm" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-2xl bg-white shadow-sm"
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="h-96 animate-pulse rounded-[28px] bg-white xl:col-span-2" />
            <div className="h-96 animate-pulse rounded-[28px] bg-white" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F5F8F7] p-6 sm:p-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="rounded-[28px] border border-red-100 bg-red-50 p-6 text-red-700 shadow-sm">
            <div className="flex items-center gap-3">
              <CircleAlert className="h-5 w-5" />

              <div>
                <p className="font-bold">
                  Dashboard outlet gagal dimuat
                </p>

                <p className="mt-1 text-sm">
                  Silakan refresh halaman atau coba beberapa saat lagi.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const outletName = user?.outlet?.name || "Outlet";
  const outletCode = user?.outlet?.code || "";

  const cards = [
    {
      title: "Total Purchase",
      value: formatNumber(data.totalPurchase),
      icon: ShoppingCart,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
      accent: "bg-amber-400",
      href: "/outlet/purchase",
    },
    {
      title: "Purchase Draft",
      value: formatNumber(data.totalDraft),
      icon: Clock3,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-500",
      accent: "bg-orange-400",
      href: "/outlet/purchase?status=DRAFT",
    },
    {
      title: "Menunggu Receive",
      value: formatNumber(data.totalApproved),
      icon: PackageCheck,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      accent: "bg-blue-400",
      href: "/outlet/purchase?status=APPROVED",
    },
    {
      title: "Barang Received",
      value: formatNumber(data.totalReceived),
      icon: CheckCircle2,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-500",
      accent: "bg-emerald-400",
      href: "/outlet/barang-masuk",
    },
    {
      title: "Total Receipt",
      value: formatNumber(data.totalReceipt),
      icon: FileText,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-500",
      accent: "bg-violet-400",
      href: "/outlet/barang-masuk",
    },
    {
      title: "Item Stok Outlet",
      value: formatNumber(data.totalStock),
      icon: Boxes,
      iconBg: "bg-cyan-50",
      iconColor: "text-cyan-500",
      accent: "bg-cyan-400",
      href: "/outlet/stock",
    },
    {
      title: "Stock Alert",
      value: formatNumber(data.lowStock),
      icon: AlertTriangle,
      iconBg: "bg-rose-50",
      iconColor: "text-rose-500",
      accent: "bg-rose-400",
      href: "/outlet/stock",
    },
  ];

  const menus = [
    {
      title: "Purchase",
      description: "Purchase order outlet",
      href: "/outlet/purchase",
      icon: ShoppingCart,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
      hover: "hover:border-amber-200 hover:bg-amber-50/40",
    },
    {
      title: "Purchase Baru",
      description: "Buat purchase order",
      href: "/outlet/purchase/new",
      icon: FileText,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      hover: "hover:border-blue-200 hover:bg-blue-50/40",
    },
    {
      title: "Barang Masuk",
      description: "Penerimaan barang outlet",
      href: "/outlet/barang-masuk",
      icon: PackageCheck,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-500",
      hover: "hover:border-emerald-200 hover:bg-emerald-50/40",
    },
    {
      title: "Stock",
      description: "Stock barang outlet",
      href: "/outlet/stock",
      icon: Package,
      iconBg: "bg-cyan-50",
      iconColor: "text-cyan-500",
      hover: "hover:border-cyan-200 hover:bg-cyan-50/40",
    },
    {
      title: "Stock Opname",
      description: "Cek stok fisik outlet",
      href: "/outlet/stock-opname",
      icon: ClipboardList,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-500",
      hover: "hover:border-violet-200 hover:bg-violet-50/40",
    },
    {
      title: "Barang Masuk",
      description: "Riwayat penerimaan",
      href: "/outlet/barang-masuk",
      icon: Truck,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-500",
      hover: "hover:border-indigo-200 hover:bg-indigo-50/40",
    },
  ];

  const receivedPercentage =
    data.totalPurchase > 0
      ? Math.min(
          100,
          Math.round(
            (data.totalReceived / data.totalPurchase) * 100
          )
        )
      : 0;

  const approvedPercentage =
    data.totalPurchase > 0
      ? Math.min(
          100,
          Math.round(
            (data.totalApproved / data.totalPurchase) * 100
          )
        )
      : 0;

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
                  MGB ERP • OUTLET
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
                Hallo, selamat datang di dashboard outlet
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Pantau purchase, penerimaan barang, dan kondisi
                inventory outlet dari sini.
              </p>

              <div className="mt-4 inline-flex items-center rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                <Warehouse className="mr-2 h-4 w-4 text-emerald-600" />

                <span className="text-xs font-semibold text-emerald-700">
                  {outletName}
                  {outletCode ? ` • ${outletCode}` : ""}
                </span>
              </div>
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
                onClick={() => loadDashboard(true)}
                disabled={refreshing}
                title="Refresh dashboard"
                className="ml-2 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* STATISTIC CARD */}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.title}
                href={card.href}
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

                  <ArrowRight
                    className={`h-4 w-4 ${card.iconColor} opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-100`}
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
                    Data outlet realtime
                  </span>
                </div>
              </Link>
            );
          })}
        </section>

        {/* OVERVIEW + INFORMATION */}

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">

          {/* PURCHASE OVERVIEW */}

          <div className="rounded-[28px] border border-white bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.045)] xl:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                  <ShoppingCart className="h-5 w-5 text-emerald-600" />
                </div>

                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    Overview Purchase Outlet
                  </h2>

                  <p className="text-xs text-slate-400">
                    Ringkasan proses purchase order
                  </p>
                </div>
              </div>

              <Link
                href="/outlet/purchase"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                Lihat Purchase
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-amber-500" />

                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600">
                    Draft
                  </span>
                </div>

                <p className="mt-2 text-2xl font-bold text-amber-700">
                  {formatNumber(data.totalDraft)}
                </p>

                <p className="mt-1 text-[10px] text-slate-400">
                  Menunggu diproses
                </p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 text-blue-500" />

                  <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">
                    Approved
                  </span>
                </div>

                <p className="mt-2 text-2xl font-bold text-blue-700">
                  {formatNumber(data.totalApproved)}
                </p>

                <p className="mt-1 text-[10px] text-slate-400">
                  Menunggu receive
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />

                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                    Received
                  </span>
                </div>

                <p className="mt-2 text-2xl font-bold text-emerald-700">
                  {formatNumber(data.totalReceived)}
                </p>

                <p className="mt-1 text-[10px] text-slate-400">
                  Sudah diterima
                </p>
              </div>
            </div>

            {/* PROGRESS */}

            <div className="mt-6 rounded-2xl bg-slate-50 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600">
                    Progress Purchase
                  </p>

                  <p className="mt-1 text-[10px] text-slate-400">
                    Perbandingan purchase dan barang yang sudah diterima
                  </p>
                </div>

                <span className="text-sm font-bold text-emerald-600">
                  {receivedPercentage}%
                </span>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{
                    width: `${receivedPercentage}%`,
                  }}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400">
                    Total Purchase
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-700">
                    {formatNumber(data.totalPurchase)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] text-slate-400">
                    Sudah Received
                  </p>

                  <p className="mt-1 text-sm font-bold text-emerald-600">
                    {formatNumber(data.totalReceived)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Menunggu Receive
                  </span>

                  <span className="text-xs font-bold text-blue-600">
                    {approvedPercentage}%
                  </span>
                </div>

                <p className="mt-1 text-lg font-bold text-blue-600">
                  {formatNumber(data.totalApproved)}
                </p>
              </div>

              <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
                <span className="text-xs text-slate-500">
                  Total Receipt
                </span>

                <p className="mt-1 text-lg font-bold text-violet-600">
                  {formatNumber(data.totalReceipt)}
                </p>
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
                  Informasi Outlet
                </h2>

                <p className="text-xs text-slate-400">
                  Ringkasan inventory outlet
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-emerald-50/70 to-teal-50 p-4">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-200/30 blur-2xl" />

                <div className="relative">
                  <p className="text-xs font-medium text-slate-500">
                    Outlet Aktif
                  </p>

                  <p className="mt-1 truncate text-xl font-bold tracking-tight text-emerald-600">
                    {outletName}
                  </p>

                  {outletCode && (
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {outletCode}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/outlet/stock"
                  className="rounded-2xl border border-cyan-100 bg-cyan-50/30 p-4 transition hover:bg-cyan-50"
                >
                  <Package className="h-4 w-4 text-cyan-500" />

                  <p className="mt-2 text-xs text-slate-500">
                    Item Stok
                  </p>

                  <p className="mt-1 text-lg font-bold text-cyan-600">
                    {formatNumber(data.totalStock)}
                  </p>
                </Link>

                <Link
                  href="/outlet/barang-masuk"
                  className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4 transition hover:bg-emerald-50"
                >
                  <PackageCheck className="h-4 w-4 text-emerald-500" />

                  <p className="mt-2 text-xs text-slate-500">
                    Receipt
                  </p>

                  <p className="mt-1 text-lg font-bold text-emerald-600">
                    {formatNumber(data.totalReceipt)}
                  </p>
                </Link>
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
              Akses cepat modul outlet
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {menus.map((menu) => {
              const Icon = menu.icon;

              return (
                <Link
                  key={`${menu.title}-${menu.href}`}
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

        {/* STOCK ALERT + PURCHASE ACTIVITY */}

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">

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
                      Stock Alert Outlet
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-400">
                      Monitoring stok outlet
                    </p>
                  </div>
                </div>
              </div>

              {data.lowStock > 0 && (
                <span className="rounded-xl bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-600">
                  {formatNumber(data.lowStock)} Alert
                </span>
              )}
            </div>

            {data.lowStock > 0 ? (
              <div className="mt-5">
                <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100">
                      <AlertTriangle className="h-6 w-6 text-orange-500" />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-orange-700">
                        Perhatian Stok
                      </p>

                      <p className="mt-1 text-xs text-orange-600">
                        {formatNumber(data.lowStock)} item outlet
                        memiliki stok habis atau di bawah batas minimum.
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/outlet/stock"
                    className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-orange-700 hover:text-orange-800"
                  >
                    Lihat Stock
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>

                <p className="mt-3 text-sm font-semibold text-emerald-600">
                  Semua stock aman
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Tidak ada alert stock outlet.
                </p>
              </div>
            )}
          </div>

          {/* RECENT PURCHASE */}

          <div className="rounded-[28px] border border-white bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Purchase Terbaru
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Aktivitas purchase terakhir outlet
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                <Clock3 className="h-4 w-4 text-amber-600" />
              </div>
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              {data.recentPurchase.length > 0 ? (
                data.recentPurchase
                  .slice(0, 6)
                  .map((item) => (
                    <Link
                      key={item.id}
                      href={`/outlet/purchase/${item.id}`}
                      className="flex items-center gap-3 py-3 transition hover:bg-slate-50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                        <ShoppingCart className="h-4 w-4 text-amber-500" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-700">
                          {item.number}
                        </p>

                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {item.supplier?.name || "-"} •{" "}
                          {formatDate(item.purchaseDate)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {statusBadge(item.status)}

                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </div>
                    </Link>
                  ))
              ) : (
                <div className="py-10 text-center text-sm text-slate-400">
                  Belum ada Purchase Order.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* PURCHASE TABLE */}

        <section className="overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Purchase Order Terbaru
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Daftar purchase order outlet terbaru
              </p>
            </div>

            <Link
              href="/outlet/purchase"
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700"
            >
              Lihat Semua
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80">
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    No. PO
                  </th>

                  <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Tanggal
                  </th>

                  <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Supplier
                  </th>

                  <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Total
                  </th>

                  <th className="px-6 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-6 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.recentPurchase.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-slate-400"
                    >
                      Belum ada Purchase Order.
                    </td>
                  </tr>
                ) : (
                  data.recentPurchase.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-100 transition hover:bg-slate-50/70"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/outlet/purchase/${item.id}`}
                          className="font-semibold text-slate-700 hover:text-emerald-600"
                        >
                          {item.number}
                        </Link>
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-500">
                        {formatDate(item.purchaseDate)}
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-700">
                          {item.supplier?.name || "-"}
                        </p>

                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {item.supplier?.code || "-"}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-right font-semibold text-slate-700">
                        Rp {formatNumber(item.total)}
                      </td>

                      <td className="px-6 py-4 text-center">
                        {statusBadge(item.status)}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <Link
                          href={`/outlet/purchase/${item.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600"
                          title="Lihat Purchase"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* FOOTER */}

        <footer className="border-t border-slate-200 py-5 text-center">
          <p className="text-xs text-slate-400">
            PT. Mitra Garam Bogatama • ERP Inventory System •{" "}
            {outletName}
          </p>
        </footer>
      </div>
    </div>
  );
}