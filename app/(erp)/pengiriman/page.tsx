"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PackageCheck,
  RefreshCw,
  Truck,
  Users,
  Boxes,
  Pencil,
  Trash2,
  Send,
  Search,
  ChevronRight,
  CalendarDays,
  FileText,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Clock3,
  Filter,
  Sparkles,
  X,
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Package,
  Database,
  Layers3,
} from "lucide-react";

export default function PengirimanPage() {
  const [delivery, setDelivery] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [processingId, setProcessingId] =
    useState<number | null>(null);
  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  // =========================================================
  // RELEASE MODAL
  // =========================================================

  const [releaseTarget, setReleaseTarget] =
    useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // =========================================================
  // LOAD DATA
  // =========================================================

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch("/api/delivery-order", {
        cache: "no-store",
      });

      const json = await res.json();

      setDelivery(
        Array.isArray(json.data)
          ? json.data
          : []
      );
    } catch (error) {
      console.error(
        "LOAD DELIVERY ORDER ERROR:",
        error
      );

      setDelivery([]);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // OPEN RELEASE MODAL
  // =========================================================

  function openReleaseModal(id: number) {
    const target = delivery.find(
      (item) => item.id === id
    );

    if (!target) return;

    if (target.status !== "DRAFT") {
      alert(
        "Delivery Order ini sudah RELEASED."
      );
      return;
    }

    setReleaseTarget(target);
  }

  // =========================================================
  // RELEASE DELIVERY
  // =========================================================

  async function approve(id: number) {
    const target = delivery.find(
      (item) => item.id === id
    );

    if (!target) return;

    if (target.status !== "DRAFT") {
      alert(
        "Delivery Order ini sudah RELEASED."
      );
      return;
    }

    try {
      setProcessingId(id);
      setLoading(true);

      const res = await fetch(
        `/api/delivery-order/${id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );

      const text = await res.text();

      let json: any = {};

      try {
        json = text
          ? JSON.parse(text)
          : {};
      } catch {
        console.error(
          "RELEASE DELIVERY INVALID JSON:",
          text
        );
      }

      if (!res.ok) {
        alert(
          json.message ||
            `Gagal release Delivery Order (${res.status})`
        );
        return;
      }

      if (json.success) {
        setReleaseTarget(null);

        alert(
          json.message ||
            "Delivery Order berhasil di-release."
        );

        await loadData();
      } else {
        alert(
          json.message ||
            "Gagal release Delivery Order."
        );
      }
    } catch (error) {
      console.error(
        "APPROVE DELIVERY ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat release Delivery Order."
      );
    } finally {
      setProcessingId(null);
      setLoading(false);
    }
  }

  // =========================================================
  // EDIT
  // =========================================================

  function editDelivery(id: number) {
    window.location.href =
      `/barang-keluar/${id}`;
  }

  // =========================================================
  // DELETE
  // =========================================================

  async function deleteDelivery(id: number) {
    const target = delivery.find(
      (item) => item.id === id
    );

    if (!target) return;

    if (target.status !== "DRAFT") {
      alert(
        "Delivery Order yang sudah RELEASED tidak dapat dihapus."
      );
      return;
    }

    const confirmed = confirm(
      `Hapus Delivery Order ${target.number}?\n\n` +
        `Data draft dan detail barang akan dihapus.\n` +
        `Stock tidak berubah karena dokumen masih DRAFT.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(id);
      setLoading(true);

      const res = await fetch(
        `/api/barang-keluar/${id}`,
        {
          method: "DELETE",
        }
      );

      const text = await res.text();

      let json: any = {};

      try {
        json = text
          ? JSON.parse(text)
          : {};
      } catch {
        console.error(
          "DELETE DELIVERY INVALID JSON:",
          text
        );
      }

      if (!res.ok) {
        alert(
          json.message ||
            `Gagal menghapus Delivery Order (${res.status})`
        );
        return;
      }

      if (json.success) {
        alert(
          json.message ||
            "Delivery Order berhasil dihapus."
        );

        await loadData();
      } else {
        alert(
          json.message ||
            "Gagal menghapus Delivery Order."
        );
      }
    } catch (error) {
      console.error(
        "DELETE DELIVERY ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menghapus Delivery Order."
      );
    } finally {
      setDeletingId(null);
      setLoading(false);
    }
  }

  // =========================================================
  // FORMAT DATE
  // =========================================================

  function formatDate(value: any) {
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

  // =========================================================
  // FORMAT NUMBER
  // =========================================================

  function formatNumber(value: any) {
    return Number(
      value || 0
    ).toLocaleString("id-ID");
  }

  // =========================================================
  // STATUS
  // =========================================================

  function StatusBadge({
    status,
  }: {
    status: string;
  }) {
    const normalized =
      String(status || "")
        .toUpperCase();

    const isReleased =
      normalized === "RELEASED";

    const isDraft =
      normalized === "DRAFT";

    const isCompleted =
      [
        "DELIVERED",
        "RECEIVED",
        "SELESAI",
      ].includes(normalized);

    return (
      <span
        className={`
          inline-flex
          items-center
          gap-2
          rounded-full
          border
          px-3
          py-1.5
          text-[9px]
          font-extrabold
          uppercase
          tracking-[0.12em]
          ${
            isReleased
              ? "border-[#C9DED5] bg-[#EAF3EF] text-[#3F7565]"
              : isDraft
              ? "border-[#EEDBAA] bg-[#FFF8E8] text-[#A46A00]"
              : isCompleted
              ? "border-blue-100 bg-blue-50 text-blue-700"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }
        `}
      >
        <span
          className={`
            h-1.5
            w-1.5
            rounded-full
            ${
              isReleased
                ? "bg-[#497F70]"
                : isDraft
                ? "bg-amber-500"
                : isCompleted
                ? "bg-blue-500"
                : "bg-slate-400"
            }
          `}
        />

        {status || "UNKNOWN"}
      </span>
    );
  }

  // =========================================================
  // FILTER
  // =========================================================

  const filteredDelivery = useMemo(() => {
    return delivery.filter((item) => {
      const keyword =
        search.trim().toLowerCase();

      const matchesSearch =
        !keyword ||
        String(item.number || "")
          .toLowerCase()
          .includes(keyword) ||
        String(
          item.customer?.name || ""
        )
          .toLowerCase()
          .includes(keyword) ||
        String(
          item.customer?.code || ""
        )
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        !statusFilter ||
        item.status === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    delivery,
    search,
    statusFilter,
  ]);

  // =========================================================
  // SUMMARY
  // =========================================================

  const totalDelivery =
    delivery.length;

  const totalDraft =
    delivery.filter(
      (item) =>
        item.status === "DRAFT"
    ).length;

  const totalReleased =
    delivery.filter(
      (item) =>
        item.status === "RELEASED"
    ).length;

  const totalQty =
    delivery.reduce(
      (total, item) =>
        total +
        Number(
          item.totalQty || 0
        ),
      0
    );

  const releaseRate =
    totalDelivery > 0
      ? Math.round(
          (totalReleased /
            totalDelivery) *
            100
        )
      : 0;

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="min-h-screen bg-[#F5F8F6] text-[#18352D]">
      {/* =====================================================
          BACKGROUND DECORATION
      ===================================================== */}

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-[#DDEDE7]/50 blur-3xl" />

        <div className="absolute -right-40 top-[25%] h-[360px] w-[360px] rounded-full bg-[#EAF3EF]/70 blur-3xl" />

        <div className="absolute bottom-[-180px] left-[35%] h-[400px] w-[400px] rounded-full bg-white/80 blur-3xl" />
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-5 md:px-7 md:py-7 xl:px-9">
        {/* ===================================================
            HERO HEADER
        =================================================== */}

        <div className="relative mb-7 overflow-hidden rounded-[26px] border border-[#D9E7E1] bg-white shadow-[0_18px_55px_rgba(34,74,61,0.08)]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#F8FCFA] via-white to-[#EEF6F2]" />

          <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#DCECE6]/50 blur-2xl" />

          <div className="absolute -bottom-28 left-[35%] h-60 w-60 rounded-full bg-[#F1F7F4] blur-2xl" />

          <div className="relative px-5 py-6 md:px-7 md:py-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="mb-4 flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.22em] text-[#81948D]">
                  <span>Logistics</span>

                  <ChevronRight size={11} />

                  <span className="text-[#497F70]">
                    Outbound
                  </span>

                  <ChevronRight size={11} />

                  <span className="text-[#274B40]">
                    Delivery
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#497F70] to-[#315E50] text-white shadow-[0_10px_24px_rgba(73,127,112,0.24)]">
                    <Truck
                      size={25}
                      strokeWidth={1.8}
                    />

                    <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#18352D]">
                      <ArrowUpRight
                        size={10}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-[27px] font-black tracking-[-0.035em] text-[#18352D] md:text-[32px]">
                        Delivery Order
                      </h1>

                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D7E6E0] bg-white px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-[0.14em] text-[#648078] shadow-sm">
                        <Sparkles
                          size={10}
                        />

                        Logistics
                      </span>
                    </div>

                    <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[#7B8B85] md:text-sm">
                      Kelola dokumen pengiriman,
                      release stock, dan monitoring
                      proses outbound secara terpusat.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-[#DDE9E4] bg-white/90 px-3 py-2 shadow-sm">
                    <Activity
                      size={13}
                      className="text-[#497F70]"
                    />

                    <span className="text-[9px] font-bold uppercase tracking-wide text-[#73857E]">
                      Release Rate
                    </span>

                    <span className="text-[10px] font-black text-[#315E50]">
                      {releaseRate}%
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-xl border border-[#DDE9E4] bg-white/90 px-3 py-2 shadow-sm">
                    <ShieldCheck
                      size={13}
                      className="text-[#497F70]"
                    />

                    <span className="text-[9px] font-bold uppercase tracking-wide text-[#73857E]">
                      Stock Control
                    </span>

                    <span className="text-[10px] font-black text-[#315E50]">
                      Active
                    </span>
                  </div>
                </div>
              </div>

              {/* =================================================
                  HEADER ACTION
              ================================================= */}

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  className="
                    group
                    inline-flex
                    h-11
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    border
                    border-[#D7E4DF]
                    bg-white
                    px-4
                    text-[11px]
                    font-extrabold
                    text-[#35564C]
                    shadow-[0_5px_18px_rgba(30,68,56,0.06)]
                    transition-all
                    hover:-translate-y-0.5
                    hover:border-[#AFCBC0]
                    hover:bg-[#F8FBF9]
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  <RefreshCw
                    size={15}
                    className={
                      loading
                        ? "animate-spin"
                        : "transition-transform group-hover:rotate-45"
                    }
                  />

                  Refresh Data
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================
            SUMMARY CARDS
        =================================================== */}

        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* TOTAL */}

          <div className="group relative overflow-hidden rounded-[22px] border border-[#DDE9E4] bg-white p-5 shadow-[0_7px_25px_rgba(35,72,61,0.055)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_35px_rgba(35,72,61,0.10)]">
            <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#EAF3EF]" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#8A9A94]">
                    Total Delivery
                  </p>

                  <p className="mt-2 text-[30px] font-black tracking-[-0.04em] text-[#18352D]">
                    {totalDelivery.toLocaleString(
                      "id-ID"
                    )}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <Truck size={20} />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EEF3F0]">
                  <div
                    className="h-full rounded-full bg-[#497F70]"
                    style={{
                      width: "100%",
                    }}
                  />
                </div>

                <span className="text-[9px] font-bold text-[#8B9B95]">
                  All
                </span>
              </div>
            </div>
          </div>

          {/* DRAFT */}

          <div className="group relative overflow-hidden rounded-[22px] border border-[#EDE4CD] bg-white p-5 shadow-[0_7px_25px_rgba(35,72,61,0.055)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_35px_rgba(35,72,61,0.10)]">
            <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#FFF7E5]" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#8A9A94]">
                    Draft
                  </p>

                  <p className="mt-2 text-[30px] font-black tracking-[-0.04em] text-amber-600">
                    {totalDraft.toLocaleString(
                      "id-ID"
                    )}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF7E5] text-amber-600">
                  <Clock3 size={20} />
                </div>
              </div>

              <p className="mt-4 text-[10px] font-medium text-[#9AA7A3]">
                Menunggu proses release
              </p>
            </div>
          </div>

          {/* RELEASED */}

          <div className="group relative overflow-hidden rounded-[22px] border border-[#DDE9E4] bg-white p-5 shadow-[0_7px_25px_rgba(35,72,61,0.055)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_35px_rgba(35,72,61,0.10)]">
            <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#EAF3EF]" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#8A9A94]">
                    Released
                  </p>

                  <p className="mt-2 text-[30px] font-black tracking-[-0.04em] text-[#497F70]">
                    {totalReleased.toLocaleString(
                      "id-ID"
                    )}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <CheckCircle2
                    size={20}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EEF3F0]">
                  <div
                    className="h-full rounded-full bg-[#497F70] transition-all"
                    style={{
                      width: `${releaseRate}%`,
                    }}
                  />
                </div>

                <span className="text-[9px] font-black text-[#497F70]">
                  {releaseRate}%
                </span>
              </div>
            </div>
          </div>

          {/* QTY */}

          <div className="group relative overflow-hidden rounded-[22px] border border-[#DDE9E4] bg-white p-5 shadow-[0_7px_25px_rgba(35,72,61,0.055)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_35px_rgba(35,72,61,0.10)]">
            <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#F1F4F3]" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#8A9A94]">
                    Total Quantity
                  </p>

                  <p className="mt-2 text-[30px] font-black tracking-[-0.04em] text-[#18352D]">
                    {totalQty.toLocaleString(
                      "id-ID"
                    )}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F1F4F3] text-[#667A73]">
                  <Boxes size={20} />
                </div>
              </div>

              <p className="mt-4 text-[10px] font-medium text-[#9AA7A3]">
                Total item dalam pengiriman
              </p>
            </div>
          </div>
        </div>

        {/* ===================================================
            MAIN CARD
        =================================================== */}

        <div className="overflow-hidden rounded-[24px] border border-[#DDE9E4] bg-white shadow-[0_12px_40px_rgba(35,72,61,0.065)]">
          {/* CARD HEADER */}

          <div className="border-b border-[#E7EFEB] bg-gradient-to-r from-white to-[#FAFCFB] px-5 py-5 md:px-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70] shadow-sm">
                  <PackageCheck size={19} />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black text-[#18352D]">
                      Daftar Delivery Order
                    </h2>

                    <span className="rounded-full border border-[#DDE9E4] bg-white px-2.5 py-1 text-[9px] font-black text-[#60746C] shadow-sm">
                      {filteredDelivery.length}
                    </span>
                  </div>

                  <p className="mt-1 text-[10px] text-[#8B9A95]">
                    Monitoring dokumen outbound dan status
                    release stock.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EEDBAA] bg-[#FFF8E8] px-3 py-1.5 text-[9px] font-extrabold text-[#A46A00]">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />

                  {totalDraft} Draft
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C9DED5] bg-[#EAF3EF] px-3 py-1.5 text-[9px] font-extrabold text-[#497F70]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />

                  {totalReleased} Released
                </span>
              </div>
            </div>
          </div>

          {/* FILTER */}

          <div className="border-b border-[#E7EFEB] bg-[#FBFDFC] px-5 py-4 md:px-7">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA9A4]"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Cari nomor DO, customer, atau kode customer..."
                  className="
                    h-11
                    w-full
                    rounded-xl
                    border
                    border-[#DCE7E2]
                    bg-white
                    pl-10
                    pr-10
                    text-[11px]
                    font-medium
                    text-[#35564C]
                    outline-none
                    transition
                    placeholder:text-[#A5B0AC]
                    focus:border-[#497F70]
                    focus:ring-4
                    focus:ring-[#497F70]/10
                  "
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#9AA7A3] transition hover:bg-[#EEF4F1] hover:text-[#497F70]"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="relative">
                <Filter
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#82948C]"
                />

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value
                    )
                  }
                  className="
                    h-11
                    min-w-[185px]
                    appearance-none
                    rounded-xl
                    border
                    border-[#DCE7E2]
                    bg-white
                    pl-9
                    pr-9
                    text-[11px]
                    font-bold
                    text-[#50635C]
                    outline-none
                    transition
                    focus:border-[#497F70]
                    focus:ring-4
                    focus:ring-[#497F70]/10
                  "
                >
                  <option value="">
                    Semua Status
                  </option>

                  <option value="DRAFT">
                    Draft
                  </option>

                  <option value="RELEASED">
                    Released
                  </option>
                </select>

                <ChevronRight
                  size={13}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-[#879891]"
                />
              </div>
            </div>
          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px]">
              <thead>
                <tr className="border-b border-[#E3ECE8] bg-[#F6F9F7]">
                  <th className="px-7 py-4 text-left text-[8px] font-black uppercase tracking-[0.17em] text-[#7B8D86]">
                    Delivery Order
                  </th>

                  <th className="px-5 py-4 text-left text-[8px] font-black uppercase tracking-[0.17em] text-[#7B8D86]">
                    Tanggal
                  </th>

                  <th className="px-5 py-4 text-left text-[8px] font-black uppercase tracking-[0.17em] text-[#7B8D86]">
                    Customer
                  </th>

                  <th className="px-5 py-4 text-right text-[8px] font-black uppercase tracking-[0.17em] text-[#7B8D86]">
                    Quantity
                  </th>

                  <th className="px-5 py-4 text-center text-[8px] font-black uppercase tracking-[0.17em] text-[#7B8D86]">
                    Status
                  </th>

                  <th className="px-7 py-4 text-center text-[8px] font-black uppercase tracking-[0.17em] text-[#7B8D86]">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {/* LOADING */}

                {loading &&
                  delivery.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-20 text-center"
                      >
                        <div className="mx-auto flex max-w-xs flex-col items-center">
                          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D8E8E1] bg-[#EFF7F3] text-[#497F70]">
                            <RefreshCw
                              size={22}
                              className="animate-spin"
                            />

                            <div className="absolute inset-0 rounded-2xl ring-4 ring-[#497F70]/5" />
                          </div>

                          <p className="mt-5 text-xs font-black text-[#50635C]">
                            Memuat Delivery Order
                          </p>

                          <p className="mt-1 text-[10px] text-[#9AA7A3]">
                            Mengambil data terbaru...
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                {/* EMPTY */}

                {!loading &&
                  filteredDelivery.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-20 text-center"
                      >
                        <div className="mx-auto flex max-w-md flex-col items-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-[#DDE9E4] bg-gradient-to-br from-[#F4F8F6] to-[#EAF3EF] text-[#719187]">
                            <Truck
                              size={27}
                              strokeWidth={
                                1.6
                              }
                            />
                          </div>

                          <h3 className="mt-5 text-sm font-black text-[#35564C]">
                            Tidak ada Delivery Order
                          </h3>

                          <p className="mt-1 max-w-sm text-[10px] leading-5 text-[#9AA7A3]">
                            Tidak ditemukan data yang
                            sesuai dengan pencarian
                            atau filter yang dipilih.
                          </p>

                          {(search ||
                            statusFilter) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSearch(
                                  ""
                                );
                                setStatusFilter(
                                  ""
                                );
                              }}
                              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#DCE7E2] bg-white px-3 py-2 text-[10px] font-bold text-[#497F70] shadow-sm transition hover:bg-[#F3F8F5]"
                            >
                              Reset Filter
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                {/* DATA */}

                {!loading &&
                  filteredDelivery.map(
                    (d: any) => {
                      const isProcessing =
                        processingId ===
                        d.id;

                      const isDeleting =
                        deletingId ===
                        d.id;

                      return (
                        <tr
                          key={d.id}
                          className="
                            group
                            border-b
                            border-[#EEF3F0]
                            transition-all
                            hover:bg-[#FBFDFC]
                          "
                        >
                          {/* DO */}

                          <td className="px-7 py-4.5">
                            <div className="flex items-center gap-3.5">
                              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#DDE9E4] bg-gradient-to-br from-[#F7FAF8] to-[#EEF5F1] text-[#497F70] shadow-sm transition-all group-hover:border-[#C6DBD3] group-hover:shadow-md">
                                <FileText
                                  size={17}
                                />

                                {d.status ===
                                  "RELEASED" && (
                                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-[#497F70] text-white">
                                    <CheckCircle2
                                      size={
                                        8
                                      }
                                    />
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-[11px] font-black text-[#274B40]">
                                    {d.number ||
                                      "-"}
                                  </span>

                                  <ArrowUpRight
                                    size={
                                      11
                                    }
                                    className="shrink-0 text-[#A6B4AF] opacity-0 transition group-hover:opacity-100"
                                  />
                                </div>

                                <div className="mt-1 flex items-center gap-1.5">
                                  <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#A0ACA7]">
                                    Outbound
                                  </span>

                                  <span className="h-1 w-1 rounded-full bg-[#C7D2CE]" />

                                  <span className="text-[8px] font-medium text-[#A0ACA7]">
                                    ID #
                                    {d.id}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* DATE */}

                          <td className="px-5 py-4.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F8F6] text-[#758A82]">
                                <CalendarDays
                                  size={
                                    14
                                  }
                                />
                              </div>

                              <div>
                                <div className="text-[10px] font-bold text-[#52645D]">
                                  {formatDate(
                                    d.deliveryDate
                                  )}
                                </div>

                                <div className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-[#A1ADA9]">
                                  Delivery Date
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* CUSTOMER */}

                          <td className="px-5 py-4.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                                <Users
                                  size={
                                    16
                                  }
                                />
                              </div>

                              <div className="min-w-0">
                                <div className="max-w-[250px] truncate text-[10px] font-black text-[#3F514B]">
                                  {d.customer
                                    ?.name ||
                                    "-"}
                                </div>

                                {d.customer
                                  ?.code ? (
                                  <div className="mt-1 inline-flex rounded-md border border-[#E8EFEC] bg-[#F6F9F7] px-2 py-0.5 text-[8px] font-black tracking-wide text-[#8A9893]">
                                    {
                                      d
                                        .customer
                                        .code
                                    }
                                  </div>
                                ) : (
                                  <div className="mt-1 text-[8px] text-[#A6B1AD]">
                                    Customer
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* QUANTITY */}

                          <td className="px-5 py-4.5 text-right">
                            <div className="inline-flex flex-col items-end">
                              <span className="text-[13px] font-black text-[#35564C]">
                                {Number(
                                  d.totalQty ||
                                    0
                                ).toLocaleString(
                                  "id-ID"
                                )}
                              </span>

                              <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-[#A0ACA7]">
                                Items
                              </span>
                            </div>
                          </td>

                          {/* STATUS */}

                          <td className="px-5 py-4.5 text-center">
                            <StatusBadge
                              status={
                                d.status
                              }
                            />
                          </td>

                          {/* ACTION */}

                          <td className="px-7 py-4.5">
                            {d.status ===
                            "DRAFT" ? (
                              <div className="flex items-center justify-center gap-1.5">
                                {/* EDIT */}

                                <button
                                  type="button"
                                  disabled={
                                    loading
                                  }
                                  onClick={() =>
                                    editDelivery(
                                      d.id
                                    )
                                  }
                                  title="Edit Draft"
                                  className="
                                    inline-flex
                                    h-9
                                    w-9
                                    items-center
                                    justify-center
                                    rounded-lg
                                    border
                                    border-[#DCE7E2]
                                    bg-white
                                    text-[#55776C]
                                    shadow-sm
                                    transition-all
                                    hover:-translate-y-0.5
                                    hover:border-[#AFCBC0]
                                    hover:bg-[#F1F7F4]
                                    hover:text-[#3F7161]
                                    disabled:cursor-not-allowed
                                    disabled:opacity-50
                                  "
                                >
                                  <Pencil
                                    size={
                                      14
                                    }
                                  />
                                </button>

                                {/* DELETE */}

                                <button
                                  type="button"
                                  disabled={
                                    loading
                                  }
                                  onClick={() =>
                                    deleteDelivery(
                                      d.id
                                    )
                                  }
                                  title="Hapus Draft"
                                  className="
                                    inline-flex
                                    h-9
                                    w-9
                                    items-center
                                    justify-center
                                    rounded-lg
                                    border
                                    border-red-100
                                    bg-red-50
                                    text-red-500
                                    shadow-sm
                                    transition-all
                                    hover:-translate-y-0.5
                                    hover:bg-red-100
                                    hover:text-red-600
                                    disabled:cursor-not-allowed
                                    disabled:opacity-50
                                  "
                                >
                                  {isDeleting ? (
                                    <Loader2
                                      size={
                                        14
                                      }
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Trash2
                                      size={
                                        14
                                      }
                                    />
                                  )}
                                </button>

                                {/* PREMIUM RELEASE */}

                                <button
                                  type="button"
                                  disabled={
                                    loading
                                  }
                                  onClick={() =>
                                    openReleaseModal(
                                      d.id
                                    )
                                  }
                                  title="Release Delivery Order"
                                  className="
                                    group/release
                                    relative
                                    ml-1
                                    inline-flex
                                    h-10
                                    min-w-[108px]
                                    items-center
                                    justify-center
                                    gap-2
                                    overflow-hidden
                                    rounded-xl
                                    bg-gradient-to-r
                                    from-[#497F70]
                                    via-[#3F7161]
                                    to-[#315E50]
                                    px-3.5
                                    text-[9px]
                                    font-black
                                    uppercase
                                    tracking-[0.09em]
                                    text-white
                                    shadow-[0_7px_20px_rgba(73,127,112,0.25)]
                                    transition-all
                                    hover:-translate-y-0.5
                                    hover:shadow-[0_10px_26px_rgba(73,127,112,0.34)]
                                    active:translate-y-0
                                    disabled:cursor-not-allowed
                                    disabled:opacity-60
                                  "
                                >
                                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 transition-all duration-700 group-hover/release:translate-x-full group-hover/release:opacity-100" />

                                  {isProcessing ? (
                                    <>
                                      <Loader2
                                        size={
                                          13
                                        }
                                        className="animate-spin"
                                      />

                                      Processing
                                    </>
                                  ) : (
                                    <>
                                      <Send
                                        size={
                                          12
                                        }
                                        className="transition-transform group-hover/release:translate-x-0.5"
                                      />

                                      Release
                                    </>
                                  )}
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center">
                                <div className="inline-flex items-center gap-2 rounded-xl border border-[#D6E6DF] bg-[#F4F9F6] px-3.5 py-2">
                                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#E0EFE9] text-[#497F70]">
                                    <PackageCheck
                                      size={
                                        12
                                      }
                                    />
                                  </div>

                                  <div className="text-left">
                                    <div className="text-[9px] font-black text-[#497F70]">
                                      Released
                                    </div>

                                    <div className="text-[7px] font-bold uppercase tracking-wide text-[#91A29B]">
                                      Stock Processed
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
              </tbody>
            </table>
          </div>

          {/* =================================================
              FOOTER
          ================================================= */}

          <div className="flex flex-col justify-between gap-4 border-t border-[#E5ECE9] bg-gradient-to-r from-[#F8FAF9] to-[#FBFCFB] px-5 py-4 md:flex-row md:items-center md:px-7">
            <div className="text-[9px] text-[#7E8E88]">
              Menampilkan{" "}
              <span className="font-black text-[#35564C]">
                {filteredDelivery.length}
              </span>{" "}
              dari{" "}
              <span className="font-black text-[#35564C]">
                {delivery.length}
              </span>{" "}
              Delivery Order
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden h-5 w-px bg-[#DCE6E1] md:block" />

              <div className="inline-flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                  <Truck size={12} />
                </div>

                <div>
                  <div className="text-[8px] font-black uppercase tracking-[0.12em] text-[#49645A]">
                    Modul Pengiriman
                  </div>

                  <div className="text-[7px] text-[#9AA7A3]">
                    Outbound Logistics
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================
            OPERATIONAL FLOW
        =================================================== */}

        <div className="mt-5 rounded-[22px] border border-[#DDE9E4] bg-white/80 p-5 shadow-[0_6px_25px_rgba(35,72,61,0.04)] backdrop-blur md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                  <Activity size={14} />
                </div>

                <h3 className="text-[11px] font-black text-[#274B40]">
                  Operational Flow
                </h3>
              </div>

              <p className="mt-1 pl-10 text-[9px] text-[#91A09A]">
                Alur dokumen outbound dari draft sampai
                pengiriman.
              </p>
            </div>

            <div className="flex flex-1 flex-wrap items-center justify-center gap-2 lg:max-w-[800px]">
              <div className="flex items-center gap-2 rounded-xl border border-[#E5ECE9] bg-white px-3 py-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#FFF7E5] text-amber-600">
                  <FileText size={11} />
                </div>

                <span className="text-[8px] font-black text-[#60736B]">
                  DRAFT
                </span>
              </div>

              <ArrowRight
                size={13}
                className="text-[#A3B1AC]"
              />

              <div className="flex items-center gap-2 rounded-xl border border-[#D7E6E0] bg-[#F4F9F6] px-3 py-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#E0EFE9] text-[#497F70]">
                  <Send size={11} />
                </div>

                <span className="text-[8px] font-black text-[#497F70]">
                  RELEASE
                </span>
              </div>

              <ArrowRight
                size={13}
                className="text-[#A3B1AC]"
              />

              <div className="flex items-center gap-2 rounded-xl border border-[#D7E6E0] bg-white px-3 py-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                  <Boxes size={11} />
                </div>

                <span className="text-[8px] font-black text-[#60736B]">
                  STOCK
                </span>
              </div>

              <ArrowRight
                size={13}
                className="text-[#A3B1AC]"
              />

              <div className="flex items-center gap-2 rounded-xl border border-[#D7E6E0] bg-white px-3 py-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                  <Truck size={11} />
                </div>

                <span className="text-[8px] font-black text-[#60736B]">
                  OUTBOUND
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          PREMIUM RELEASE MODAL
      ===================================================== */}

      {releaseTarget && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[#102B24]/55 px-4 py-6 backdrop-blur-md">
          <div
            className="
              relative
              w-full
              max-w-[540px]
              overflow-hidden
              rounded-[28px]
              border
              border-white/70
              bg-white
              shadow-[0_30px_100px_rgba(15,45,36,0.28)]
            "
          >
            {/* TOP DECORATION */}

            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-[#EAF5F0] via-[#F5FAF8] to-white" />

            <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#D7EAE2]/60 blur-2xl" />

            <div className="absolute -left-16 top-20 h-32 w-32 rounded-full bg-[#EEF7F3] blur-2xl" />

            <div className="relative">
              {/* HEADER */}

              <div className="flex items-start justify-between px-6 pb-4 pt-6 md:px-7">
                <div className="flex items-center gap-3.5">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#497F70] to-[#315E50] text-white shadow-[0_10px_24px_rgba(73,127,112,0.25)]">
                    <Send
                      size={20}
                      strokeWidth={1.8}
                    />

                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-[#18352D]">
                      <ShieldCheck
                        size={8}
                      />
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-[#CFE2DA] bg-[#F0F8F4] px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-[#497F70]">
                        Release Control
                      </span>
                    </div>

                    <h2 className="mt-1.5 text-[20px] font-black tracking-[-0.03em] text-[#18352D]">
                      Release Delivery Order
                    </h2>

                    <p className="mt-1 text-[10px] text-[#899993]">
                      Konfirmasi sebelum stock diproses.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    processingId === null &&
                    setReleaseTarget(null)
                  }
                  disabled={
                    processingId !== null
                  }
                  className="
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-lg
                    border
                    border-[#E1EAE6]
                    bg-white
                    text-[#879790]
                    transition
                    hover:border-[#CBDDD5]
                    hover:bg-[#F5F9F7]
                    hover:text-[#497F70]
                    disabled:cursor-not-allowed
                    disabled:opacity-40
                  "
                >
                  <X size={15} />
                </button>
              </div>

              {/* DOCUMENT CARD */}

              <div className="px-6 md:px-7">
                <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-gradient-to-br from-[#F8FBF9] to-white">
                  <div className="border-b border-[#E5ECE9] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#8B9A95]">
                          Delivery Order
                        </p>

                        <p className="mt-1 text-[16px] font-black text-[#18352D]">
                          {releaseTarget.number ||
                            "-"}
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EEDBAA] bg-[#FFF8E8] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-wide text-[#A46A00]">
                        <Clock3
                          size={10}
                        />

                        DRAFT
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-[#E5ECE9] sm:grid-cols-4">
                    <div className="bg-white px-4 py-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[#91A09A]">
                        <Users size={11} />

                        <span className="text-[7px] font-extrabold uppercase tracking-wide">
                          Customer
                        </span>
                      </div>

                      <p className="truncate text-[10px] font-black text-[#35564C]">
                        {releaseTarget
                          .customer
                          ?.name ||
                          "-"}
                      </p>

                      {releaseTarget
                        .customer
                        ?.code && (
                        <p className="mt-0.5 text-[7px] font-bold text-[#9AA7A3]">
                          {
                            releaseTarget
                              .customer
                              .code
                          }
                        </p>
                      )}
                    </div>

                    <div className="bg-white px-4 py-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[#91A09A]">
                        <CalendarDays
                          size={11}
                        />

                        <span className="text-[7px] font-extrabold uppercase tracking-wide">
                          Tanggal
                        </span>
                      </div>

                      <p className="text-[10px] font-black text-[#35564C]">
                        {formatDate(
                          releaseTarget.deliveryDate
                        )}
                      </p>
                    </div>

                    <div className="bg-white px-4 py-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[#91A09A]">
                        <Boxes size={11} />

                        <span className="text-[7px] font-extrabold uppercase tracking-wide">
                          Quantity
                        </span>
                      </div>

                      <p className="text-[10px] font-black text-[#35564C]">
                        {formatNumber(
                          releaseTarget.totalQty
                        )}
                      </p>

                      <p className="mt-0.5 text-[7px] font-bold text-[#9AA7A3]">
                        Total item
                      </p>
                    </div>

                    <div className="bg-white px-4 py-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[#91A09A]">
                        <Truck size={11} />

                        <span className="text-[7px] font-extrabold uppercase tracking-wide">
                          Tujuan
                        </span>
                      </div>

                      <p className="truncate text-[10px] font-black text-[#35564C]">
                        {releaseTarget
                          .outlet
                          ?.name ||
                          releaseTarget
                            .outlet
                            ?.code ||
                          "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* WARNING */}

              <div className="px-6 pt-4 md:px-7">
                <div className="rounded-2xl border border-[#EEDBAA] bg-gradient-to-r from-[#FFF9EA] to-[#FFFDF7] p-4">
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF0C8] text-[#B77A0B]">
                      <AlertTriangle
                        size={17}
                      />
                    </div>

                    <div>
                      <p className="text-[10px] font-black text-[#805C19]">
                        Perhatian sebelum release
                      </p>

                      <p className="mt-1 text-[9px] leading-5 text-[#9A7B43]">
                        Setelah Delivery Order di-release,
                        dokumen tidak dapat diedit atau
                        dihapus. Sistem akan memproses
                        pengurangan stock sesuai item
                        pengiriman.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PROCESS PREVIEW */}

              <div className="px-6 pt-4 md:px-7">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-[#E0EAE6] bg-[#F8FBF9] p-3">
                    <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                      <Package
                        size={13}
                      />
                    </div>

                    <p className="text-[8px] font-black text-[#35564C]">
                      Stock
                    </p>

                    <p className="mt-0.5 text-[7px] text-[#93A19C]">
                      Update quantity
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E0EAE6] bg-[#F8FBF9] p-3">
                    <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                      <Layers3
                        size={13}
                      />
                    </div>

                    <p className="text-[8px] font-black text-[#35564C]">
                      Batch
                    </p>

                    <p className="mt-0.5 text-[7px] text-[#93A19C]">
                      FEFO processing
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E0EAE6] bg-[#F8FBF9] p-3">
                    <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                      <Database
                        size={13}
                      />
                    </div>

                    <p className="text-[8px] font-black text-[#35564C]">
                      Ledger
                    </p>

                    <p className="mt-0.5 text-[7px] text-[#93A19C]">
                      Stock Card & Mutation
                    </p>
                  </div>
                </div>
              </div>

              {/* ACTIONS */}

              <div className="flex flex-col-reverse gap-2 px-6 pb-6 pt-5 sm:flex-row sm:justify-end md:px-7">
                <button
                  type="button"
                  disabled={
                    processingId !== null
                  }
                  onClick={() =>
                    setReleaseTarget(null)
                  }
                  className="
                    inline-flex
                    h-11
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-[#DCE7E2]
                    bg-white
                    px-5
                    text-[10px]
                    font-black
                    uppercase
                    tracking-[0.08em]
                    text-[#60736B]
                    shadow-sm
                    transition
                    hover:border-[#BFD3CB]
                    hover:bg-[#F6F9F7]
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  Batal
                </button>

                <button
                  type="button"
                  disabled={
                    processingId !== null
                  }
                  onClick={() =>
                    approve(
                      releaseTarget.id
                    )
                  }
                  className="
                    relative
                    inline-flex
                    h-11
                    flex-1
                    items-center
                    justify-center
                    gap-2
                    overflow-hidden
                    rounded-xl
                    bg-gradient-to-r
                    from-[#497F70]
                    via-[#3E6F61]
                    to-[#315E50]
                    px-6
                    text-[10px]
                    font-black
                    uppercase
                    tracking-[0.09em]
                    text-white
                    shadow-[0_8px_24px_rgba(73,127,112,0.27)]
                    transition-all
                    hover:-translate-y-0.5
                    hover:shadow-[0_12px_30px_rgba(73,127,112,0.34)]
                    active:translate-y-0
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                    sm:flex-none
                  "
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 transition-all duration-700 hover:translate-x-full" />

                  {processingId !== null ? (
                    <>
                      <Loader2
                        size={14}
                        className="animate-spin"
                      />

                      Memproses Release...
                    </>
                  ) : (
                    <>
                      <Send size={13} />

                      Konfirmasi Release

                      <ArrowRight
                        size={13}
                      />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}