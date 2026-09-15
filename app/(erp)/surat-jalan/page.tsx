"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Truck,
  Search,
  RefreshCw,
  Eye,
  FileText,
  CheckCircle2,
  Clock3,
  PackageCheck,
  ArrowUpRight,
  ChevronRight,
  Filter,
  X,
  CalendarDays,
  Users,
  Activity,
  Sparkles,
} from "lucide-react";

export default function SuratJalanPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("SEMUA");

  // =========================================================
  // LOAD DATA
  // =========================================================

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch("/api/delivery", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();

      const result = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
        ? json.data
        : [];

      setData(result);
    } catch (err) {
      console.error("Load surat jalan error:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // =========================================================
  // FILTER
  // =========================================================

  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return data.filter((item: any) => {
      const nomor = String(item.number ?? "").toLowerCase();
      const customer = String(
        item.customer?.name ?? ""
      ).toLowerCase();
      const customerCode = String(
        item.customer?.code ?? ""
      ).toLowerCase();
      const itemStatus = String(
        item.status ?? ""
      ).toLowerCase();

      const cocokSearch =
        !keyword ||
        nomor.includes(keyword) ||
        customer.includes(keyword) ||
        customerCode.includes(keyword) ||
        itemStatus.includes(keyword);

      const cocokStatus =
        status === "SEMUA" ||
        String(item.status ?? "").toUpperCase() === status;

      return cocokSearch && cocokStatus;
    });
  }, [data, search, status]);

  // =========================================================
  // SUMMARY
  // =========================================================

  const totalData = data.length;

  const totalPending = data.filter((item: any) =>
    [
      "PENDING",
      "PROCESS",
      "PROCESSING",
      "DIKIRIM",
    ].includes(
      String(item.status ?? "").toUpperCase()
    )
  ).length;

  const totalDelivered = data.filter((item: any) =>
    [
      "DELIVERED",
      "RECEIVED",
      "SELESAI",
    ].includes(
      String(item.status ?? "").toUpperCase()
    )
  ).length;

  const totalCustomer = useMemo(() => {
    const customers = data
      .map((item: any) => item.customer?.id ?? item.customer?.name)
      .filter(Boolean);

    return new Set(customers).size;
  }, [data]);

  const completionRate =
    totalData > 0
      ? Math.round((totalDelivered / totalData) * 100)
      : 0;

  // =========================================================
  // HELPERS
  // =========================================================

  function formatDate(value: any) {
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

  function formatDateLong(value: any) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  function getStatusLabel(value: any) {
    const current = String(value || "").toUpperCase();

    if (current === "DELIVERED") return "Delivered";
    if (current === "RECEIVED") return "Received";
    if (current === "SELESAI") return "Selesai";
    if (current === "PENDING") return "Pending";
    if (current === "PROCESS") return "Process";
    if (current === "PROCESSING") return "Processing";
    if (current === "DIKIRIM") return "Dikirim";

    return value || "Unknown";
  }

  // =========================================================
  // STATUS BADGE
  // =========================================================

  function StatusBadge({
    value,
  }: {
    value: string;
  }) {
    const current = String(value || "").toUpperCase();

    if (
      [
        "DELIVERED",
        "RECEIVED",
        "SELESAI",
      ].includes(current)
    ) {
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-[10px] font-bold tracking-wide text-emerald-700 shadow-sm">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-3 w-3" />
          </span>

          {getStatusLabel(value)}
        </span>
      );
    }

    if (
      [
        "PENDING",
        "PROCESS",
        "PROCESSING",
        "DIKIRIM",
      ].includes(current)
    ) {
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/80 px-3 py-1.5 text-[10px] font-bold tracking-wide text-amber-700 shadow-sm">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100">
            <Clock3 className="h-3 w-3" />
          </span>

          {getStatusLabel(value)}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold tracking-wide text-slate-600">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />

        {getStatusLabel(value)}
      </span>
    );
  }

  // =========================================================
  // KPI CARD
  // =========================================================

  function SummaryCard({
    title,
    value,
    description,
    icon,
    iconClass,
    iconBg,
    valueClass,
    percentage,
  }: {
    title: string;
    value: number;
    description: string;
    icon: React.ReactNode;
    iconClass: string;
    iconBg: string;
    valueClass: string;
    percentage?: number;
  }) {
    return (
      <div className="group relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)] transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_16px_38px_rgba(15,23,42,0.075)]">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-slate-100/70 blur-3xl transition duration-500 group-hover:scale-150" />

        <div className="relative">
          <div className="flex items-start justify-between">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-[15px] ${iconBg} ${iconClass} ring-1 ring-inset ring-black/[0.025]`}
            >
              {icon}
            </div>

            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-300 transition group-hover:bg-slate-100 group-hover:text-slate-500">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {title}
            </p>

            <div className="mt-1 flex items-end gap-2">
              <p
                className={`text-[29px] font-bold tracking-[-0.04em] ${valueClass}`}
              >
                {value.toLocaleString("id-ID")}
              </p>

              {percentage !== undefined && (
                <span className="mb-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
                  {percentage}%
                </span>
              )}
            </div>

            <p className="mt-1 text-[11px] font-medium text-slate-400">
              {description}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="min-h-full bg-[#F4F7F6]">
      <div className="mx-auto w-full max-w-[1680px] p-4 md:p-6 lg:p-8">

        {/* ================================================= */}
        {/* HERO HEADER */}
        {/* ================================================= */}

        <section className="relative mb-7 overflow-hidden rounded-[28px] bg-[#16352D] shadow-[0_18px_50px_rgba(22,53,45,0.13)]">
          {/* Decorative background */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[#497F70]/25 blur-3xl" />
            <div className="absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-[#497F70]/10 blur-3xl" />

            <div className="absolute right-10 top-8 h-36 w-36 rounded-full border border-white/5" />
            <div className="absolute right-20 top-18 h-24 w-24 rounded-full border border-white/5" />
          </div>

          <div className="relative flex flex-col gap-7 px-6 py-7 md:px-8 md:py-8 xl:flex-row xl:items-center xl:justify-between">
            {/* LEFT */}
            <div className="flex min-w-0 items-start gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-white/10 shadow-lg backdrop-blur-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-[#5B9282]/60 to-transparent" />

                <Truck className="relative h-6 w-6 text-white" />
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#D5E9E2] backdrop-blur-sm">
                    <Sparkles className="h-3 w-3" />
                    Logistics
                  </span>

                  <ChevronRight className="h-3 w-3 text-white/30" />

                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/45">
                    Delivery Management
                  </span>
                </div>

                <h1 className="text-[27px] font-bold tracking-[-0.035em] text-white md:text-[32px]">
                  Surat Jalan
                </h1>

                <p className="mt-1.5 max-w-xl text-sm leading-6 text-white/55">
                  Monitor, lacak, dan kelola seluruh dokumen
                  pengiriman barang secara terpusat.
                </p>
              </div>
            </div>

            {/* RIGHT STATUS */}
            <div className="flex shrink-0 items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.07] px-4 py-3 backdrop-blur-md">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#497F70]/30">
                <Activity className="h-4 w-4 text-[#A9D0C3]" />
              </div>

              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-white/35">
                  System Status
                </p>

                <div className="mt-0.5 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />

                  <p className="text-xs font-semibold text-white/80">
                    Pengiriman Aktif
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* KPI */}
        {/* ================================================= */}

        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total Surat Jalan"
            value={totalData}
            description="Seluruh dokumen pengiriman"
            icon={<FileText className="h-5 w-5" />}
            iconClass="text-[#497F70]"
            iconBg="bg-[#EEF6F3]"
            valueClass="text-[#18352D]"
          />

          <SummaryCard
            title="Dalam Proses"
            value={totalPending}
            description="Pengiriman belum selesai"
            icon={<Clock3 className="h-5 w-5" />}
            iconClass="text-amber-600"
            iconBg="bg-amber-50"
            valueClass="text-amber-600"
          />

          <SummaryCard
            title="Selesai"
            value={totalDelivered}
            description="Pengiriman telah diterima"
            icon={<CheckCircle2 className="h-5 w-5" />}
            iconClass="text-emerald-600"
            iconBg="bg-emerald-50"
            valueClass="text-emerald-600"
            percentage={completionRate}
          />

          <SummaryCard
            title="Customer"
            value={totalCustomer}
            description="Customer dalam pengiriman"
            icon={<Users className="h-5 w-5" />}
            iconClass="text-blue-600"
            iconBg="bg-blue-50"
            valueClass="text-blue-600"
          />
        </div>

        {/* ================================================= */}
        {/* MAIN CARD */}
        {/* ================================================= */}

        <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_5px_25px_rgba(15,23,42,0.045)]">

          {/* ================================================= */}
          {/* CARD HEADER */}
          {/* ================================================= */}

          <div className="border-b border-slate-100">
            <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">

              {/* TITLE */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF6F3] text-[#497F70]">
                  <PackageCheck className="h-4.5 w-4.5" />
                </div>

                <div>
                  <h2 className="text-sm font-bold text-[#18352D]">
                    Daftar Surat Jalan
                  </h2>

                  <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                    Data pengiriman dan status terbaru
                  </p>
                </div>
              </div>

              {/* TOOLBAR */}
              <div className="flex flex-col gap-2.5 sm:flex-row">

                {/* SEARCH */}
                <div className="relative w-full sm:w-[340px]">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type="text"
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    placeholder="Cari nomor SJ atau customer..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-[#F8FAF9] pl-10 pr-10 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* FILTER */}
                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />

                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value)
                    }
                    className="h-11 min-w-[155px] appearance-none rounded-xl border border-slate-200 bg-[#F8FAF9] pl-9 pr-9 text-xs font-semibold text-slate-600 outline-none transition hover:border-slate-300 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  >
                    <option value="SEMUA">
                      Semua Status
                    </option>

                    <option value="PENDING">
                      Pending
                    </option>

                    <option value="PROCESS">
                      Process
                    </option>

                    <option value="PROCESSING">
                      Processing
                    </option>

                    <option value="DIKIRIM">
                      Dikirim
                    </option>

                    <option value="DELIVERED">
                      Delivered
                    </option>

                    <option value="RECEIVED">
                      Received
                    </option>

                    <option value="SELESAI">
                      Selesai
                    </option>
                  </select>

                  <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-slate-400" />
                </div>

                {/* REFRESH */}
                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition hover:border-[#C7DAD3] hover:bg-[#F8FAF9] hover:text-[#18352D] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      loading ? "animate-spin" : ""
                    }`}
                  />

                  Refresh
                </button>
              </div>
            </div>

            {/* RESULT STRIP */}
            <div className="flex flex-col gap-3 bg-[#FAFCFB] px-5 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
              <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />

                Menampilkan

                <span className="font-bold text-slate-700">
                  {filteredData.length.toLocaleString("id-ID")}
                </span>

                dari

                <span className="font-bold text-slate-700">
                  {data.length.toLocaleString("id-ID")}
                </span>

                dokumen
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden items-center gap-1.5 text-[10px] font-medium text-slate-400 sm:flex">
                  <CalendarDays className="h-3.5 w-3.5" />

                  Update data otomatis saat refresh
                </div>

                {(search || status !== "SEMUA") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setStatus("SEMUA");
                    }}
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#497F70] transition hover:text-[#18352D]"
                  >
                    <X className="h-3 w-3" />
                    Reset filter
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ================================================= */}
          {/* TABLE */}
          {/* ================================================= */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">

              <thead>
                <tr className="border-b border-slate-100 bg-[#F9FBFA]">
                  <th className="w-16 px-6 py-4 text-left text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    No
                  </th>

                  <th className="px-5 py-4 text-left text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Dokumen
                  </th>

                  <th className="px-5 py-4 text-left text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Tanggal
                  </th>

                  <th className="px-5 py-4 text-left text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Customer
                  </th>

                  <th className="px-5 py-4 text-center text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Status
                  </th>

                  <th className="w-36 px-6 py-4 text-center text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {/* ================================================= */}
                {/* LOADING */}
                {/* ================================================= */}

                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={6} className="px-6 py-5">
                        <div className="flex animate-pulse items-center gap-4">
                          <div className="h-8 w-8 rounded-lg bg-slate-100" />

                          <div className="h-4 w-36 rounded bg-slate-100" />

                          <div className="h-4 w-24 rounded bg-slate-100" />

                          <div className="h-4 w-40 rounded bg-slate-100" />

                          <div className="ml-auto h-7 w-24 rounded-full bg-slate-100" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : filteredData.length === 0 ? (

                  /* ================================================= */
                  /* EMPTY */
                  /* ================================================= */

                  <tr>
                    <td colSpan={6} className="px-6 py-24 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">

                        <div className="relative flex h-20 w-20 items-center justify-center rounded-[26px] border border-[#DCE9E4] bg-[#EEF6F3]">
                          <div className="absolute inset-2 rounded-[20px] border border-[#DCE9E4]" />

                          <Truck className="relative h-7 w-7 text-[#497F70]" />
                        </div>

                        <p className="mt-6 text-sm font-bold text-slate-700">
                          Tidak ada surat jalan
                        </p>

                        <p className="mt-1.5 text-xs leading-5 text-slate-400">
                          Tidak ditemukan dokumen yang sesuai
                          dengan pencarian atau filter saat ini.
                        </p>

                        {(search || status !== "SEMUA") && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearch("");
                              setStatus("SEMUA");
                            }}
                            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#18352D] px-4 py-2.5 text-[11px] font-bold text-white shadow-lg shadow-[#18352D]/10 transition hover:-translate-y-0.5 hover:bg-[#24483E]"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Reset Filter
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                ) : (

                  /* ================================================= */
                  /* DATA */
                  /* ================================================= */

                  filteredData.map(
                    (item: any, index: number) => (
                      <tr
                        key={item.id}
                        className="group transition-colors duration-200 hover:bg-[#FBFDFC]"
                      >

                        {/* NO */}
                        <td className="px-6 py-5">
                          <span className="font-mono text-[10px] font-bold text-slate-300">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        </td>

                        {/* DOCUMENT */}
                        <td className="px-5 py-5">
                          <div className="flex items-center gap-3">

                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DCE9E4] bg-[#EEF6F3] transition-all duration-200 group-hover:border-[#BCD5CA] group-hover:bg-[#E5F2ED]">
                              <FileText className="h-4 w-4 text-[#497F70]" />
                            </div>

                            <div className="min-w-0">
                              <p className="font-mono text-[13px] font-bold tracking-tight text-[#18352D]">
                                {item.number || "-"}
                              </p>

                              <div className="mt-1 flex items-center gap-1.5">
                                <span className="h-1 w-1 rounded-full bg-[#497F70]" />

                                <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                                  Delivery Document
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* DATE */}
                        <td className="px-5 py-5">
                          <div className="flex items-center gap-2.5">
                            <div className="hidden h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400 sm:flex">
                              <CalendarDays className="h-3.5 w-3.5" />
                            </div>

                            <div>
                              <p className="text-xs font-bold text-slate-700">
                                {formatDate(item.deliveryDate)}
                              </p>

                              <p className="mt-0.5 text-[9px] font-medium text-slate-400">
                                Tanggal pengiriman
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* CUSTOMER */}
                        <td className="px-5 py-5">
                          <div className="flex items-center gap-3">
                            <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 sm:flex">
                              <Users className="h-3.5 w-3.5" />
                            </div>

                            <div className="min-w-0 max-w-[250px]">
                              <p className="truncate text-xs font-bold text-slate-700">
                                {item.customer?.name || "-"}
                              </p>

                              {item.customer?.code ? (
                                <span className="mt-1 inline-flex rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-wide text-slate-400">
                                  {item.customer.code}
                                </span>
                              ) : (
                                <p className="mt-1 text-[9px] text-slate-400">
                                  Customer
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* STATUS */}
                        <td className="px-5 py-5 text-center">
                          <StatusBadge
                            value={item.status}
                          />
                        </td>

                        {/* ACTION */}
                        <td className="px-6 py-5">
                          <div className="flex justify-center">
                            <Link
                              href={`/surat-jalan/${item.id}`}
                              className="group/detail inline-flex h-9 items-center gap-2 rounded-xl border border-[#DCE9E4] bg-[#F1F8F5] px-3.5 text-[10px] font-bold text-[#497F70] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#18352D] hover:bg-[#18352D] hover:text-white hover:shadow-lg hover:shadow-[#18352D]/10"
                            >
                              <Eye className="h-3.5 w-3.5" />

                              Detail

                              <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover/detail:translate-x-0.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* ================================================= */}
          {/* TABLE FOOTER */}
          {/* ================================================= */}

          {!loading && filteredData.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-[#FAFCFB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">

              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EEF6F3]">
                  <Truck className="h-3 w-3 text-[#497F70]" />
                </div>

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Delivery Management
                  </p>

                  <p className="text-[10px] font-semibold text-slate-500">
                    {filteredData.length.toLocaleString("id-ID")} dokumen ditampilkan
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />

                <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-700">
                  Sistem Aktif
                </span>
              </div>
            </div>
          )}
        </section>

        {/* ================================================= */}
        {/* BOTTOM MICRO FOOTER */}
        {/* ================================================= */}

        <div className="mt-5 flex flex-col items-center justify-between gap-2 px-2 text-[9px] font-medium text-slate-400 sm:flex-row">
          <p>
            MGB Inventory System • Logistics Management
          </p>

          <p>
            Data pengiriman terintegrasi
          </p>
        </div>
      </div>
    </div>
  );
}