"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock3,
  RefreshCw,
  Search,
  X,
  History as HistoryIcon,
  UserRound,
  Database,
  CalendarDays,
  ChevronRight,
} from "lucide-react";

export default function HistoryPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // ==========================================
  // LOAD DATA
  // ==========================================

  async function load() {
    try {
      setLoading(true);

      const res = await fetch("/api/history", {
        cache: "no-store",
      });

      const result = await res.json();

      console.log("HISTORY:", result);

      if (result.success) {
        setData(Array.isArray(result.data) ? result.data : []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error("LOAD HISTORY ERROR:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ==========================================
  // USER NAME
  // ==========================================

  function getUserName(item: any) {
    const user = item?.user;
    const createdBy = item?.createdBy;

    const candidates = [
      user?.fullname,
      user?.fullName,
      user?.name,
      user?.username,

      createdBy?.fullname,
      createdBy?.fullName,
      createdBy?.name,
      createdBy?.username,

      item?.fullname,
      item?.fullName,
      item?.userName,
      item?.username,
      item?.createdByName,
      item?.actorName,
    ];

    const found = candidates.find((value) => {
      return (
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
      );
    });

    if (found) {
      return String(found).trim();
    }

    if (
      item?.userId !== null &&
      item?.userId !== undefined &&
      String(item.userId).trim() !== ""
    ) {
      return `User #${item.userId}`;
    }

    if (
      item?.createdById !== null &&
      item?.createdById !== undefined &&
      String(item.createdById).trim() !== ""
    ) {
      return `User #${item.createdById}`;
    }

    return "System";
  }

  // ==========================================
  // USER INITIAL
  // ==========================================

  function getUserInitial(item: any) {
    const name = getUserName(item);

    if (!name || name === "System") {
      return "S";
    }

    const words = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length >= 2) {
      return (
        words[0].charAt(0) +
        words[words.length - 1].charAt(0)
      ).toUpperCase();
    }

    return name.slice(0, 2).toUpperCase();
  }

  // ==========================================
  // USER META
  // ==========================================

  function getUserMeta(item: any) {
    const user = item?.user;
    const createdBy = item?.createdBy;

    return (
      user?.role ||
      user?.position ||
      user?.outlet?.name ||
      user?.outletName ||
      createdBy?.role ||
      createdBy?.position ||
      createdBy?.outlet?.name ||
      item?.outletName ||
      ""
    );
  }

  // ==========================================
  // TRANSACTION TYPE
  // ==========================================

  function getTransactionType(item: any) {
    return String(item?.transactionType ?? "").toUpperCase();
  }

  function isIncoming(item: any) {
    const type = getTransactionType(item);

    return (
      type.includes("IN") ||
      type.includes("MASUK") ||
      type.includes("RECEIVE") ||
      type.includes("RECEIPT")
    );
  }

  function isOutgoing(item: any) {
    const type = getTransactionType(item);

    return (
      type.includes("OUT") ||
      type.includes("KELUAR") ||
      type.includes("DELIVERY")
    );
  }

  function getTransactionLabel(item: any) {
    const type = getTransactionType(item);

    if (
      type.includes("RECEIVE") ||
      type.includes("RECEIPT") ||
      type.includes("MASUK")
    ) {
      return "Barang Masuk";
    }

    if (
      type.includes("DELIVERY") ||
      type.includes("OUT") ||
      type.includes("KELUAR")
    ) {
      return "Barang Keluar";
    }

    return item?.transactionType || "Transaksi";
  }

  // ==========================================
  // DATE FORMAT
  // ==========================================

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

  function formatTime(value: any) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ==========================================
  // FILTER
  // ==========================================

  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return data;
    }

    return data.filter((item: any) => {
      const type = String(
        item?.transactionType ?? ""
      ).toLowerCase();

      const reference = String(
        item?.reference ?? ""
      ).toLowerCase();

      const description = String(
        item?.description ?? ""
      ).toLowerCase();

      const user = getUserName(item).toLowerCase();

      return (
        type.includes(keyword) ||
        reference.includes(keyword) ||
        description.includes(keyword) ||
        user.includes(keyword)
      );
    });
  }, [data, search]);

  // ==========================================
  // SUMMARY
  // ==========================================

  const totalHistory = data.length;

  const barangMasuk = data.filter((item: any) => {
    return isIncoming(item);
  }).length;

  const barangKeluar = data.filter((item: any) => {
    return isOutgoing(item);
  }).length;

  const aktivitasLain = Math.max(
    totalHistory - barangMasuk - barangKeluar,
    0
  );

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="min-h-full bg-[#F4F7F5] text-[#18352D]">
      {/* ======================================
          PREMIUM TOP HEADER
      ====================================== */}

      <div className="relative overflow-hidden border-b border-[#DCE8E2] bg-white">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#EAF3EF] blur-3xl" />

        <div className="absolute -bottom-28 left-1/3 h-52 w-52 rounded-full bg-[#F0F6F3] blur-3xl" />

        <div className="relative mx-auto max-w-[1600px] px-5 py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            {/* TITLE */}

            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#18352D] text-white shadow-[0_10px_25px_rgba(24,53,45,0.16)]">
                <div className="absolute inset-0 bg-gradient-to-br from-[#5E9887] via-[#497F70] to-[#18352D]" />

                <HistoryIcon
                  size={25}
                  strokeWidth={1.8}
                  className="relative"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6D8B80]">
                  <Database size={12} />
                  Inventory Control
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-[30px]">
                  History Transaksi
                </h1>

                <p className="mt-1 text-sm text-[#71827C]">
                  Pantau seluruh aktivitas dan pergerakan inventory
                </p>
              </div>
            </div>

            {/* REFRESH */}

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="group inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl border border-[#D5E3DD] bg-white px-4 text-sm font-semibold text-[#35564C] shadow-[0_4px_14px_rgba(31,72,60,0.05)] transition-all duration-200 hover:border-[#AFCBBE] hover:bg-[#F7FAF8] hover:shadow-[0_8px_20px_rgba(31,72,60,0.08)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                strokeWidth={2}
                className={
                  loading
                    ? "animate-spin text-[#497F70]"
                    : "text-[#497F70] transition-transform duration-300 group-hover:rotate-90"
                }
              />

              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ======================================
          CONTENT
      ====================================== */}

      <div className="mx-auto max-w-[1600px] px-5 py-6 md:px-8 md:py-7">
        {/* ====================================
            SUMMARY CARDS
        ==================================== */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* TOTAL */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DCE8E2] bg-white p-5 shadow-[0_5px_20px_rgba(31,72,60,0.045)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(31,72,60,0.08)]">
            <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#F0F6F3] transition-transform duration-300 group-hover:scale-125" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#83938E]">
                  Total History
                </p>

                <p className="mt-2 text-[30px] font-bold tracking-tight text-[#18352D]">
                  {totalHistory}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <Activity size={20} />
              </div>
            </div>

            <div className="relative mt-4 flex items-center gap-2 border-t border-[#EEF3F0] pt-3 text-xs text-[#8A9994]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />

              Seluruh aktivitas transaksi
            </div>
          </div>

          {/* BARANG MASUK */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DCE8E2] bg-white p-5 shadow-[0_5px_20px_rgba(31,72,60,0.045)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(31,72,60,0.08)]">
            <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#EEF8F2] transition-transform duration-300 group-hover:scale-125" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#83938E]">
                  Barang Masuk
                </p>

                <p className="mt-2 text-[30px] font-bold tracking-tight text-[#277653]">
                  {barangMasuk}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF8F2] text-[#31815B]">
                <ArrowDownToLine size={20} />
              </div>
            </div>

            <div className="relative mt-4 flex items-center gap-2 border-t border-[#EEF3F0] pt-3 text-xs text-[#8A9994]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4B9B72]" />

              Transaksi penerimaan barang
            </div>
          </div>

          {/* BARANG KELUAR */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DCE8E2] bg-white p-5 shadow-[0_5px_20px_rgba(31,72,60,0.045)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(31,72,60,0.08)]">
            <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#FBF2F0] transition-transform duration-300 group-hover:scale-125" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#83938E]">
                  Barang Keluar
                </p>

                <p className="mt-2 text-[30px] font-bold tracking-tight text-[#B6534B]">
                  {barangKeluar}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FBF2F0] text-[#B6534B]">
                <ArrowUpFromLine size={20} />
              </div>
            </div>

            <div className="relative mt-4 flex items-center gap-2 border-t border-[#EEF3F0] pt-3 text-xs text-[#8A9994]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C56A61]" />

              Transaksi pengeluaran barang
            </div>
          </div>

          {/* AKTIVITAS LAIN */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DCE8E2] bg-white p-5 shadow-[0_5px_20px_rgba(31,72,60,0.045)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(31,72,60,0.08)]">
            <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#F1F5F3] transition-transform duration-300 group-hover:scale-125" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#83938E]">
                  Aktivitas Lain
                </p>

                <p className="mt-2 text-[30px] font-bold tracking-tight text-[#497F70]">
                  {aktivitasLain}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <Clock3 size={20} />
              </div>
            </div>

            <div className="relative mt-4 flex items-center gap-2 border-t border-[#EEF3F0] pt-3 text-xs text-[#8A9994]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#71988C]" />

              Aktivitas inventory lainnya
            </div>
          </div>
        </div>

        {/* ====================================
            HISTORY PANEL
        ==================================== */}

        <div className="overflow-hidden rounded-2xl border border-[#DCE8E2] bg-white shadow-[0_6px_25px_rgba(31,72,60,0.055)]">
          {/* PANEL HEADER */}

          <div className="border-b border-[#E7EEEA] bg-white px-5 py-5 md:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                    <HistoryIcon size={16} />
                  </div>

                  <h2 className="text-base font-bold text-[#18352D]">
                    Riwayat Aktivitas
                  </h2>
                </div>

                <p className="mt-1 pl-10 text-xs text-[#8A9994]">
                  Semua transaksi inventory yang tercatat dalam sistem
                </p>
              </div>

              {/* SEARCH */}

              <div className="relative w-full lg:max-w-[460px]">
                <Search
                  size={17}
                  strokeWidth={2}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A9994]"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari transaksi, referensi, keterangan, atau user..."
                  className="h-11 w-full rounded-xl border border-[#D7E4DE] bg-[#F8FAF9] pl-10 pr-10 text-sm font-medium text-[#35564C] outline-none transition-all placeholder:text-[#9BA9A4] focus:border-[#6A998A] focus:bg-white focus:ring-4 focus:ring-[#497F70]/[0.07]"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-lg p-1 text-[#9BA9A4] transition hover:bg-[#EAF3EF] hover:text-[#497F70]"
                    title="Hapus pencarian"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* RESULT META */}

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#EEF3F0] pt-4 text-xs text-[#8A9994]">
              <div className="flex items-center gap-2">
                <Database size={14} />

                Menampilkan

                <span className="font-bold text-[#35564C]">
                  {filteredData.length}
                </span>

                dari

                <span className="font-bold text-[#35564C]">
                  {data.length}
                </span>

                transaksi
              </div>

              {search && (
                <div className="flex items-center gap-1.5 rounded-full bg-[#EAF3EF] px-3 py-1 font-semibold text-[#497F70]">
                  <Search size={12} />
                  Filter aktif
                </div>
              )}
            </div>
          </div>

          {/* ====================================
              TABLE
          ==================================== */}

          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-sm">
              <thead>
                <tr className="border-b border-[#E4ECE8] bg-[#F7F9F8]">
                  <th className="w-[70px] px-5 py-4 text-center text-[11px] font-bold uppercase tracking-[0.1em] text-[#789087]">
                    No
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#789087]">
                    Waktu
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#789087]">
                    Jenis Transaksi
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#789087]">
                    Referensi
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#789087]">
                    Keterangan
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#789087]">
                    User
                  </th>
                </tr>
              </thead>

              <tbody>
                {/* LOADING */}

                {loading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-20">
                      <div className="flex flex-col items-center justify-center">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                          <RefreshCw
                            size={21}
                            className="animate-spin"
                          />
                        </div>

                        <p className="text-sm font-semibold text-[#4C655D]">
                          Memuat history transaksi...
                        </p>

                        <p className="mt-1 text-xs text-[#9AA7A2]">
                          Mengambil data terbaru dari sistem
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

                {/* EMPTY */}

                {!loading && filteredData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-20">
                      <div className="flex flex-col items-center justify-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#DCE8E2] bg-[#F2F7F4] text-[#719389]">
                          {search ? (
                            <Search size={26} />
                          ) : (
                            <HistoryIcon size={27} />
                          )}
                        </div>

                        <p className="text-sm font-bold text-[#35564C]">
                          {search
                            ? "Data tidak ditemukan"
                            : "Belum ada history transaksi"}
                        </p>

                        <p className="mt-1 max-w-md text-center text-xs leading-5 text-[#9AA7A2]">
                          {search
                            ? "Coba gunakan kata pencarian yang berbeda."
                            : "Riwayat aktivitas transaksi akan muncul di sini setelah ada aktivitas inventory."}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

                {/* DATA */}

                {!loading &&
                  filteredData.map(
                    (item: any, index: number) => {
                      const incoming = isIncoming(item);
                      const outgoing = isOutgoing(item);
                      const userName = getUserName(item);
                      const userMeta = getUserMeta(item);

                      return (
                        <tr
                          key={
                            item?.id ??
                            `${item?.reference ?? "history"}-${item?.createdAt ?? "date"}-${index}`
                          }
                          className="group border-b border-[#EDF2EF] transition-colors duration-150 hover:bg-[#FAFCFB]"
                        >
                          {/* NO */}

                          <td className="px-5 py-4 text-center">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#F3F6F4] text-xs font-semibold text-[#82928C] transition-colors group-hover:bg-[#EAF3EF] group-hover:text-[#497F70]">
                              {index + 1}
                            </span>
                          </td>

                          {/* WAKTU */}

                          <td className="whitespace-nowrap px-5 py-4">
                            <div className="flex items-start gap-2.5">
                              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F2F6F4] text-[#6E8A80]">
                                <CalendarDays size={15} />
                              </div>

                              <div>
                                <div className="font-semibold text-[#35564C]">
                                  {formatDate(item?.createdAt)}
                                </div>

                                {formatTime(item?.createdAt) && (
                                  <div className="mt-0.5 text-[11px] text-[#98A6A1]">
                                    {formatTime(item?.createdAt)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* JENIS */}

                          <td className="px-5 py-4">
                            {incoming ? (
                              <span className="inline-flex items-center gap-2 rounded-lg border border-[#D6EBDD] bg-[#F0F8F3] px-3 py-1.5 text-xs font-bold text-[#317655]">
                                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#DCEFE3]">
                                  <ArrowDownToLine size={12} />
                                </span>

                                {getTransactionLabel(item)}
                              </span>
                            ) : outgoing ? (
                              <span className="inline-flex items-center gap-2 rounded-lg border border-[#F0DCD9] bg-[#FCF3F1] px-3 py-1.5 text-xs font-bold text-[#A94F47]">
                                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#F5E2DF]">
                                  <ArrowUpFromLine size={12} />
                                </span>

                                {getTransactionLabel(item)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 rounded-lg border border-[#DCE8E2] bg-[#F1F6F3] px-3 py-1.5 text-xs font-bold text-[#52796D]">
                                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#E2EEE9]">
                                  <Activity size={12} />
                                </span>

                                {getTransactionLabel(item)}
                              </span>
                            )}
                          </td>

                          {/* REFERENSI */}

                          <td className="max-w-[220px] px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span className="max-w-[190px] truncate font-bold text-[#294B41]">
                                {item?.reference || "-"}
                              </span>

                              {item?.reference && (
                                <ChevronRight
                                  size={14}
                                  className="shrink-0 text-[#B0BCB7] transition-transform group-hover:translate-x-0.5"
                                />
                              )}
                            </div>
                          </td>

                          {/* KETERANGAN */}

                          <td className="max-w-[390px] px-5 py-4">
                            <div
                              className="truncate text-sm text-[#667771]"
                              title={item?.description || "-"}
                            >
                              {item?.description || "-"}
                            </div>
                          </td>

                          {/* USER */}

                          <td className="min-w-[230px] px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#5E9887] to-[#315F51] text-[11px] font-bold text-white shadow-sm">
                                {getUserInitial(item)}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-[#35564C]">
                                  {userName}
                                </div>

                                <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.06em] text-[#9AA7A2]">
                                  <UserRound size={10} />

                                  {userMeta || "Pengguna Sistem"}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
              </tbody>
            </table>
          </div>

          {/* ====================================
              FOOTER
          ==================================== */}

          {!loading && filteredData.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-[#E7EEEA] bg-[#FAFCFB] px-5 py-3.5 text-xs text-[#8A9994] sm:flex-row sm:items-center sm:justify-between md:px-6">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#5B927F]" />

                Data history tersinkron dengan sistem inventory
              </div>

              <div className="font-medium text-[#82928C]">
                {filteredData.length} transaksi ditampilkan
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}