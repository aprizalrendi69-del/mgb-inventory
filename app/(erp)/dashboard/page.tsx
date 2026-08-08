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
} from "lucide-react";

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

export default function Dashboard() {
  const [data, setData] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [period, setPeriod] =
    useState<Period>("7");

  const [refreshing, setRefreshing] =
    useState(false);

  async function loadDashboard(
    showRefresh = false
  ) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      }

      const res = await fetch(
        "/api/dashboard",
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error(
          "Dashboard gagal dimuat"
        );
      }

      const json =
        await res.json();

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

  useEffect(() => {
    loadDashboard();
  }, []);

  const chartData =
    useMemo(() => {
      if (!data?.chart?.length) {
        return [];
      }

      return data.chart.map(
        (item) => ({
          label: item.label,

          masuk: Number(
            item.masuk || 0
          ),

          keluar: Number(
            item.keluar || 0
          ),

          value:
            Number(
              item.masuk || 0
            ) +
            Number(
              item.keluar || 0
            ),
        })
      );
    }, [data]);

  const maxChartValue =
    Math.max(
      ...chartData.map(
        (item) => item.value
      ),
      1
    );

  /* =====================================================
     STOCK ALERT SUMMARY
  ===================================================== */

  const stockAlertCount =
    data?.stats.stockAlertCount ??
    data?.stockAlerts?.length ??
    0;

  const stockOutCount =
    data?.stats.stockOutCount ?? 0;

  const stockCriticalCount =
    data?.stats.stockCriticalCount ??
    0;

  const stockLowCount =
    data?.stats.stockLowCount ?? 0;

  /* =====================================================
     STATISTIC CARDS
  ===================================================== */

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

      value: `Rp ${
        data?.stats.nilaiPersediaan?.toLocaleString(
          "id-ID"
        ) ?? "0"
      }`,

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

  /* =====================================================
     QUICK MENU
  ===================================================== */

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

  /* =====================================================
     STOCK STATUS HELPER
  ===================================================== */

  function getStockStatus(
    status: StockAlert["status"]
  ) {
    if (status === "OUT_OF_STOCK") {
      return {
        label: "HABIS",

        badge:
          "bg-rose-50 text-rose-600 border-rose-100",

        bar: "bg-rose-400",

        icon:
          "bg-rose-50 text-rose-500",
      };
    }

    if (status === "CRITICAL") {
      return {
        label: "KRITIS",

        badge:
          "bg-orange-50 text-orange-600 border-orange-100",

        bar: "bg-orange-400",

        icon:
          "bg-orange-50 text-orange-500",
      };
    }

    return {
      label: "RENDAH",

      badge:
        "bg-amber-50 text-amber-600 border-amber-100",

      bar: "bg-amber-400",

      icon:
        "bg-amber-50 text-amber-500",
    };
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F8F7] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px] space-y-6">

          <div className="h-36 animate-pulse rounded-[28px] bg-white shadow-sm" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">

            {Array.from({
              length: 7,
            }).map((_, i) => (
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

  return (
    <div className="min-h-screen bg-[#F5F8F7] text-slate-800">

      <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">

        {/* =================================================
            HEADER
        ================================================= */}

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
                onClick={() =>
                  loadDashboard(true)
                }
                disabled={refreshing}
                title="Refresh dashboard"
                className="ml-2 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing
                      ? "animate-spin"
                      : ""
                  }`}
                />
              </button>

            </div>

          </div>

        </section>

        {/* =================================================
            STATISTIC CARD
        ================================================= */}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">

          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.title}
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

        {/* =================================================
            CHART + INFORMATION
        ================================================= */}

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
                      setPeriod(
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

            <div className="mt-8 flex h-64 items-end gap-3 overflow-x-auto border-b border-slate-100 pb-0 sm:gap-5">

              {chartData.length ? (
                chartData.map((item) => {

                  const masukHeight =
                    Math.max(
                      (item.masuk /
                        maxChartValue) *
                        100,

                      item.masuk > 0
                        ? 8
                        : 0
                    );

                  const keluarHeight =
                    Math.max(
                      (item.keluar /
                        maxChartValue) *
                        100,

                      item.keluar > 0
                        ? 8
                        : 0
                    );

                  return (
                    <div
                      key={item.label}
                      className="flex min-w-[44px] flex-1 flex-col items-center justify-end"
                    >

                      <div className="mb-3 flex h-52 w-full items-end justify-center gap-1">

                        <div
                          title={`Masuk: ${item.masuk}`}
                          className="w-3 rounded-t-md bg-emerald-300 transition-all duration-500 sm:w-4"
                          style={{
                            height: `${masukHeight}%`,
                          }}
                        />

                        <div
                          title={`Keluar: ${item.keluar}`}
                          className="w-3 rounded-t-md bg-slate-300 transition-all duration-500 sm:w-4"
                          style={{
                            height: `${keluarHeight}%`,
                          }}
                        />

                      </div>

                      <span className="mb-3 whitespace-nowrap text-[10px] font-medium text-slate-400">
                        {item.label}
                      </span>

                    </div>
                  );
                })
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                  Belum ada aktivitas inventory
                </div>
              )}

            </div>

            <div className="mt-4 flex items-center gap-5">

              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />

                <span className="text-xs text-slate-500">
                  Barang Masuk
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />

                <span className="text-xs text-slate-500">
                  Barang Keluar
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

              <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4">

                <p className="text-xs text-slate-500">
                  Nilai Persediaan
                </p>

                <p className="mt-1 text-xl font-bold text-emerald-600">
                  Rp{" "}
                  {data?.stats.nilaiPersediaan?.toLocaleString(
                    "id-ID"
                  )}
                </p>

              </div>

              <div className="grid grid-cols-2 gap-3">

                <div className="rounded-2xl border border-slate-100 bg-blue-50/30 p-4">

                  <p className="text-xs text-slate-500">
                    Total Purchase
                  </p>

                  <p className="mt-1 text-lg font-bold text-blue-600">
                    {data?.stats.totalPurchase?.toLocaleString(
                      "id-ID"
                    )}
                  </p>

                </div>

                <div className="rounded-2xl border border-slate-100 bg-indigo-50/30 p-4">

                  <p className="text-xs text-slate-500">
                    Total Delivery
                  </p>

                  <p className="mt-1 text-lg font-bold text-indigo-600">
                    {data?.stats.totalDelivery?.toLocaleString(
                      "id-ID"
                    )}
                  </p>

                </div>

              </div>

            </div>

          </div>

        </section>

        {/* =================================================
            QUICK MENU
        ================================================= */}

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

        {/* =================================================
            ACTIVITY + STOCK ALERT
        ================================================= */}

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
                  .map(
                    (item: any) => (
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
                    )
                  )
              ) : (
                <div className="py-10 text-center text-sm text-slate-400">
                  Belum ada aktivitas
                </div>
              )}

            </div>

          </div>

          {/* =================================================
              STOCK ALERT
          ================================================= */}

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

            {/* SUMMARY */}

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

            {/* LIST */}

            <div className="mt-5 divide-y divide-slate-100">

              {data?.stockAlerts?.length ? (

                data.stockAlerts
                  .slice(0, 6)
                  .map(
                    (item) => {

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

                              {/* STOCK INFO */}

                              <div className="mt-3 flex items-center justify-between gap-3">

                                <div>

                                  <p className="text-[10px] text-slate-400">
                                    Stock saat ini
                                  </p>

                                  <p className="mt-0.5 text-sm font-bold text-slate-700">

                                    {item.stock.toLocaleString(
                                      "id-ID"
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

                                    {item.minimumStock.toLocaleString(
                                      "id-ID"
                                    )}

                                    <span className="ml-1 text-[10px] font-medium text-slate-400">
                                      {item.unit}
                                    </span>

                                  </p>

                                </div>

                              </div>

                              {/* PROGRESS */}

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
                                        item.stock > 0
                                          ? 4
                                          : 0
                                      )}%`,
                                    }}
                                  />

                                </div>

                              </div>

                              {/* SHORTAGE */}

                              <div className="mt-2 flex items-center justify-between">

                                <span className="text-[10px] text-slate-400">
                                  {Math.round(
                                    item.percentage
                                  )}
                                  % dari minimum
                                </span>

                                <span className="text-[10px] font-semibold text-slate-500">

                                  Kurang{" "}

                                  {item.shortage.toLocaleString(
                                    "id-ID"
                                  )}{" "}

                                  {item.unit}

                                </span>

                              </div>

                            </div>

                          </div>

                        </div>
                      );
                    }
                  )

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

        {/* =================================================
            PURCHASE / DELIVERY / EXPIRED
        ================================================= */}

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
                  .map(
                    (item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-3"
                      >

                        <div className="min-w-0">

                          <p className="truncate text-sm font-semibold text-slate-700">
                            {item.number ?? "-"}
                          </p>

                          <p className="truncate text-xs text-slate-400">
                            {item.supplier?.name ?? "-"}
                          </p>

                        </div>

                        <span className="shrink-0 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-600">
                          {item.status ?? "PENDING"}
                        </span>

                      </div>
                    )
                  )

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
                  .map(
                    (item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-3"
                      >

                        <div className="min-w-0">

                          <p className="truncate text-sm font-semibold text-slate-700">
                            {item.number ?? "-"}
                          </p>

                          <p className="truncate text-xs text-slate-400">
                            {item.customer?.name ?? "-"}
                          </p>

                        </div>

                        <span className="shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600">
                          {item.status ?? "PENDING"}
                        </span>

                      </div>
                    )
                  )

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
                  .map(
                    (item: any) => (
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
                            {item.batch ??
                              "-"}
                          </span>

                          <span>
                            Qty:{" "}
                            {item.qty ??
                              0}
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
                    )
                  )

              ) : (

                <div className="flex items-center justify-center py-10 text-sm text-emerald-600">
                  Tidak ada barang expired
                </div>

              )}

            </div>

          </div>

        </section>

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="border-t border-slate-200 py-5 text-center">

          <p className="text-xs text-slate-400">
            PT. Mitra Garam Bogatama • ERP Inventory System
          </p>

        </footer>

      </div>

    </div>
  );
}