"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Eye,
  RefreshCw,
  FileText,
  Store,
  Warehouse,
  ArrowUpRight,
  Clock3,
  Receipt,
  ShieldCheck,
  Package,
  CalendarDays,
  UserRound,
  Sparkles,
  ChevronRight,
  X,
  ArrowRight,
  CircleDollarSign,
  LockKeyhole,
  Send,
} from "lucide-react";

type PurchaseItem = {
  id: number;
  barangId: number;
  qty: number;
  price: number;
  subtotal: number;
  barang?: {
    id: number;
    code?: string;
    name?: string;
    unit?: string;
  };
};

type PurchaseData = {
  id: number;
  number: string;
  status: string;
  purchaseDate?: string;
  total?: number;

  source?: "PUSAT" | "OUTLET";

  destinationType?: "PUSAT" | "OUTLET";
  destinationId?: number | null;
  destinationName?: string | null;
  destinationCode?: string | null;

  supplier?: {
    id: number;
    name: string;
  };

  outlet?: {
    id: number;
    code: string;
    name: string;
  };

  items?: PurchaseItem[];
};

type PurchaseFilter = "ALL" | "PUSAT" | "OUTLET";

export default function ApprovePage() {
  const [data, setData] = useState<PurchaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] =
    useState<number | null>(null);

  const [approveTarget, setApproveTarget] =
    useState<PurchaseData | null>(null);

  /*
   * =========================================================
   * FILTER
   * =========================================================
   */

  const [filter, setFilter] =
    useState<PurchaseFilter>("ALL");

  // =========================================================
  // LOAD DATA
  // =========================================================

  useEffect(() => {
    load();
  }, []);

  // =========================================================
  // APPROVAL MODAL BEHAVIOR
  // =========================================================

  useEffect(() => {
    if (!approveTarget) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        event.key === "Escape" &&
        approvingId === null
      ) {
        setApproveTarget(null);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [approveTarget, approvingId]);

  async function load() {
    try {
      setLoading(true);

      const res = await fetch("/api/purchase", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil Purchase Order"
        );
      }

      const draftData = (json.data || []).filter(
        (item: PurchaseData) =>
          item.status === "DRAFT"
      );

      setData(draftData);
    } catch (error) {
      console.error(
        "LOAD PURCHASE APPROVE ERROR:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // IDENTIFIKASI JENIS PURCHASE
  // =========================================================

  function isOutletPurchase(
    purchase: PurchaseData
  ): boolean {
    return (
      purchase.source === "OUTLET" ||
      purchase.destinationType === "OUTLET"
    );
  }

  function isPusatPurchase(
    purchase: PurchaseData
  ): boolean {
    return (
      purchase.source === "PUSAT" ||
      purchase.destinationType === "PUSAT"
    );
  }

  // =========================================================
  // FILTERED DATA
  // =========================================================

  const filteredData = useMemo(() => {
    if (filter === "ALL") {
      return data;
    }

    if (filter === "OUTLET") {
      return data.filter((item) =>
        isOutletPurchase(item)
      );
    }

    if (filter === "PUSAT") {
      return data.filter((item) =>
        isPusatPurchase(item)
      );
    }

    return data;
  }, [data, filter]);

  // =========================================================
  // OPEN APPROVAL MODAL
  // =========================================================

  function openApproveModal(
    purchase: PurchaseData
  ) {
    if (!purchase?.id) return;

    if (purchase.status !== "DRAFT") {
      alert(
        "Purchase Order ini sudah tidak berstatus DRAFT."
      );
      return;
    }

    setApproveTarget(purchase);
  }

  // =========================================================
  // APPROVE
  // =========================================================

  async function approvePurchase(
    purchase: PurchaseData
  ) {
    if (!purchase?.id) return;

    if (purchase.status !== "DRAFT") {
      alert(
        "Purchase Order ini sudah tidak berstatus DRAFT."
      );
      setApproveTarget(null);
      return;
    }

    const isOutlet =
      isOutletPurchase(purchase);

    try {
      setApprovingId(purchase.id);

      const endpoint = isOutlet
        ? `/api/outlet/purchase/${purchase.id}/approve`
        : `/api/purchase/${purchase.id}/approve`;

      const res = await fetch(endpoint, {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal melakukan approve Purchase Order"
        );
      }

      setApproveTarget(null);

      alert(
        `${
          isOutlet
            ? "Purchase Order Outlet"
            : "Purchase Order"
        } ${purchase.number} berhasil diapprove.`
      );

      /*
       * Hapus dari DATA UTAMA.
       *
       * Jika sedang menggunakan filter,
       * item otomatis hilang dari filteredData.
       */

      setData((prev) =>
        prev.filter(
          (item) =>
            item.id !== purchase.id ||
            item.source !== purchase.source
        )
      );
    } catch (error: any) {
      console.error(
        "APPROVE PURCHASE ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal melakukan approve Purchase Order"
      );
    } finally {
      setApprovingId(null);
    }
  }

  // =========================================================
  // SUMMARY - MENGIKUTI FILTER
  // =========================================================

  const totalPurchase = useMemo(() => {
    return filteredData.reduce(
      (total, item) =>
        total + Number(item.total || 0),
      0
    );
  }, [filteredData]);

  const totalPusat = useMemo(() => {
    return filteredData.filter((item) =>
      isPusatPurchase(item)
    ).length;
  }, [filteredData]);

  const totalOutlet = useMemo(() => {
    return filteredData.filter((item) =>
      isOutletPurchase(item)
    ).length;
  }, [filteredData]);

  const totalItems = useMemo(() => {
    return filteredData.reduce(
      (total, item) =>
        total + (item.items?.length || 0),
      0
    );
  }, [filteredData]);

  // =========================================================
  // LABEL FILTER
  // =========================================================

  const filterLabel = useMemo(() => {
    if (filter === "PUSAT") {
      return "PO Pusat";
    }

    if (filter === "OUTLET") {
      return "PO Outlet";
    }

    return "Semua PO";
  }, [filter]);

  // =========================================================
  // APPROVE MODAL DATA
  // =========================================================

  const approveIsOutlet =
    approveTarget
      ? isOutletPurchase(approveTarget)
      : false;

  const approveDestination =
    approveTarget
      ? approveIsOutlet
        ? approveTarget.outlet?.name ||
          approveTarget.destinationName ||
          "-"
        : "Gudang Pusat"
      : "-";

  const approveDestinationCode =
    approveTarget
      ? approveIsOutlet
        ? approveTarget.outlet?.code ||
          approveTarget.destinationCode ||
          ""
        : ""
      : "";

  const approveItemCount =
    approveTarget?.items?.length || 0;

  const approveTotal = Number(
    approveTarget?.total || 0
  );

  const approveIsProcessing =
    approveTarget !== null &&
    approvingId === approveTarget.id;

  return (
    <div className="min-h-full bg-[#F5F8F6] text-[#18352D]">

      <div className="mx-auto max-w-[1500px] p-5 md:p-8">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="relative mb-7 overflow-hidden rounded-[28px] border border-[#DDE9E4] bg-white shadow-[0_12px_40px_rgba(24,53,45,0.06)]">

          <div className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-[#497F70]/5" />

          <div className="pointer-events-none absolute -bottom-36 right-48 h-72 w-72 rounded-full bg-[#497F70]/5" />

          <div className="relative px-5 py-6 md:px-7 md:py-7">

            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

              <div className="flex items-start gap-4">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#497F70] text-white shadow-lg shadow-[#497F70]/20">
                  <ShieldCheck size={23} />
                </div>

                <div>

                  <div className="mb-2 flex flex-wrap items-center gap-2">

                    <span className="rounded-full bg-[#EAF3EF] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#497F70]">
                      Approval Center
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Menunggu Tindakan
                    </span>

                  </div>

                  <h1 className="text-2xl font-black tracking-tight text-[#18352D] md:text-3xl">
                    Purchase Approve
                  </h1>

                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-gray-500">
                    Review dan setujui Purchase Order Pusat maupun
                    Purchase Order Outlet yang masih berstatus draft.
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-5 text-sm font-bold text-[#35564C] shadow-sm transition hover:border-[#BFD3CA] hover:bg-[#F2F7F4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  size={17}
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

          {/* =====================================================
              HEADER FOOTER
          ===================================================== */}

          <div className="border-t border-[#E8EEEB] bg-[#FAFCFB] px-5 py-3.5 md:px-7">

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500">

              <div className="flex items-center gap-2">
                <Clock3
                  size={14}
                  className="text-[#497F70]"
                />

                <span>
                  {filteredData.length}{" "}
                  {filterLabel} menunggu approval
                </span>
              </div>

              <div className="hidden h-4 w-px bg-[#DDE9E4] sm:block" />

              <div className="flex items-center gap-2">
                <Package
                  size={14}
                  className="text-[#497F70]"
                />

                <span>
                  {totalItems} total item
                </span>
              </div>

              <div className="hidden h-4 w-px bg-[#DDE9E4] sm:block" />

              <div className="flex items-center gap-2">
                <Receipt
                  size={14}
                  className="text-[#497F70]"
                />

                <span>
                  Nilai Rp{" "}
                  {totalPurchase.toLocaleString(
                    "id-ID"
                  )}
                </span>
              </div>

            </div>

          </div>

        </div>

        {/* =====================================================
            FILTER
        ===================================================== */}

        <div className="mb-7 rounded-[24px] border border-[#DDE9E4] bg-white p-4 shadow-[0_8px_30px_rgba(24,53,45,0.045)]">

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

            <div>

              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
                Filter Purchase Order
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Pilih sumber Purchase Order yang ingin ditampilkan.
              </p>

            </div>

            <div className="flex flex-wrap items-center gap-2">

              {/* SEMUA */}

              <button
                type="button"
                onClick={() =>
                  setFilter("ALL")
                }
                className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold transition ${
                  filter === "ALL"
                    ? "bg-[#18352D] text-white shadow-sm"
                    : "border border-[#D5E5DC] bg-white text-[#35564C] hover:bg-[#F2F7F4]"
                }`}
              >
                <Receipt size={15} />
                Semua

                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    filter === "ALL"
                      ? "bg-white/15 text-white"
                      : "bg-[#F2F7F4] text-[#497F70]"
                  }`}
                >
                  {data.length}
                </span>
              </button>

              {/* PUSAT */}

              <button
                type="button"
                onClick={() =>
                  setFilter("PUSAT")
                }
                className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold transition ${
                  filter === "PUSAT"
                    ? "bg-[#497F70] text-white shadow-sm"
                    : "border border-[#D5E5DC] bg-white text-[#35564C] hover:bg-[#F2F7F4]"
                }`}
              >
                <Warehouse size={15} />
                Pusat

                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    filter === "PUSAT"
                      ? "bg-white/15 text-white"
                      : "bg-[#EAF3EF] text-[#497F70]"
                  }`}
                >
                  {data.filter((item) =>
                    isPusatPurchase(item)
                  ).length}
                </span>
              </button>

              {/* OUTLET */}

              <button
                type="button"
                onClick={() =>
                  setFilter("OUTLET")
                }
                className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold transition ${
                  filter === "OUTLET"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-[#D5E5DC] bg-white text-[#35564C] hover:bg-[#F2F7F4]"
                }`}
              >
                <Store size={15} />
                Outlet

                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    filter === "OUTLET"
                      ? "bg-white/15 text-white"
                      : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {data.filter((item) =>
                    isOutletPurchase(item)
                  ).length}
                </span>
              </button>

            </div>

          </div>

        </div>

        {/* =====================================================
            SUMMARY CARDS
        ===================================================== */}

        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* WAITING */}

          <div className="group relative overflow-hidden rounded-[24px] border border-[#DDE9E4] bg-white p-5 shadow-[0_8px_30px_rgba(24,53,45,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(24,53,45,0.07)]">

            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-50" />

            <div className="relative flex items-start justify-between">

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
                  Menunggu Approval
                </p>

                <p className="mt-2 text-3xl font-black tracking-tight text-[#18352D]">
                  {filteredData.length}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  {filterLabel}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Clock3 size={21} />
              </div>

            </div>

          </div>

          {/* PUSAT */}

          <div className="group relative overflow-hidden rounded-[24px] border border-[#DDE9E4] bg-white p-5 shadow-[0_8px_30px_rgba(24,53,45,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(24,53,45,0.07)]">

            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#EAF3EF]" />

            <div className="relative flex items-start justify-between">

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
                  PO Pusat
                </p>

                <p className="mt-2 text-3xl font-black tracking-tight text-[#18352D]">
                  {totalPusat}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Tujuan gudang pusat
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                <Warehouse size={21} />
              </div>

            </div>

          </div>

          {/* OUTLET */}

          <div className="group relative overflow-hidden rounded-[24px] border border-[#DDE9E4] bg-white p-5 shadow-[0_8px_30px_rgba(24,53,45,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(24,53,45,0.07)]">

            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-50" />

            <div className="relative flex items-start justify-between">

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
                  PO Outlet
                </p>

                <p className="mt-2 text-3xl font-black tracking-tight text-[#18352D]">
                  {totalOutlet}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Purchase dari outlet
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Store size={21} />
              </div>

            </div>

          </div>

          {/* VALUE */}

          <div className="group relative overflow-hidden rounded-[24px] border border-[#DDE9E4] bg-[#18352D] p-5 text-white shadow-[0_10px_35px_rgba(24,53,45,0.12)] transition hover:-translate-y-0.5">

            <div className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-white/5" />

            <div className="relative flex items-start justify-between">

              <div className="min-w-0">

                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">
                  Nilai Purchase
                </p>

                <p className="mt-2 truncate text-2xl font-black tracking-tight md:text-[26px]">
                  Rp{" "}
                  {totalPurchase.toLocaleString(
                    "id-ID"
                  )}
                </p>

                <p className="mt-1 text-xs text-white/40">
                  {filterLabel}
                </p>

              </div>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                <Receipt size={21} />
              </div>

            </div>

          </div>

        </div>

        {/* =====================================================
            MAIN TABLE CARD
        ===================================================== */}

        <section className="overflow-hidden rounded-[28px] border border-[#DDE9E4] bg-white shadow-[0_10px_35px_rgba(24,53,45,0.05)]">

          {/* TABLE HEADER */}

          <div className="flex flex-col gap-4 border-b border-[#E8EEEB] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <CheckCircle2 size={19} />
              </div>

              <div>

                <h2 className="font-bold text-[#18352D]">
                  Approval Queue
                </h2>

                <p className="mt-0.5 text-xs text-gray-500">
                  {filterLabel} yang membutuhkan persetujuan.
                </p>

              </div>

            </div>

            <div className="flex items-center gap-2 rounded-full bg-[#F2F7F4] px-3.5 py-2 text-xs font-bold text-[#497F70]">

              <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />

              {filteredData.length} PO Pending

            </div>

          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1250px] text-sm">

              <thead>

                <tr className="border-b border-[#E8EEEB] bg-[#F7FAF8]">

                  <th className="w-16 px-5 py-4 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#607A70]">
                    #
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#607A70]">
                    Purchase Order
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#607A70]">
                    Jenis
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#607A70]">
                    Tujuan
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#607A70]">
                    Supplier
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#607A70]">
                    Tanggal
                  </th>

                  <th className="px-5 py-4 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#607A70]">
                    Item
                  </th>

                  <th className="px-5 py-4 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-[#607A70]">
                    Total
                  </th>

                  <th className="px-5 py-4 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#607A70]">
                    Status
                  </th>

                  <th className="px-5 py-4 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#607A70]">
                    Aksi
                  </th>

                </tr>

              </thead>

              <tbody>

                {/* =================================================
                    LOADING
                ================================================= */}

                {loading && (
                  <>
                    {[1, 2, 3].map((row) => (
                      <tr
                        key={row}
                        className="border-b border-[#EDF2EF]"
                      >

                        {Array.from({
                          length: 10,
                        }).map(
                          (_, index) => (
                            <td
                              key={index}
                              className="px-5 py-5"
                            >
                              <div
                                className={`h-4 animate-pulse rounded-lg bg-[#EEF3F0] ${
                                  index === 1
                                    ? "w-36"
                                    : index === 9
                                    ? "w-28"
                                    : "w-20"
                                }`}
                              />
                            </td>
                          )
                        )}

                      </tr>
                    ))}
                  </>
                )}

                {/* =================================================
                    EMPTY
                ================================================= */}

                {!loading &&
                  filteredData.length === 0 && (
                    <tr>

                      <td
                        colSpan={10}
                        className="px-6 py-20"
                      >

                        <div className="flex flex-col items-center justify-center text-center">

                          <div className="relative mb-5">

                            <div className="absolute inset-0 animate-pulse rounded-3xl bg-[#497F70]/10" />

                            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-[#EAF3EF] text-[#497F70]">
                              <CheckCircle2 size={35} />
                            </div>

                          </div>

                          <h3 className="text-base font-bold text-[#18352D]">
                            {filter === "ALL"
                              ? "Semua Purchase Order sudah diproses"
                              : `Tidak ada ${
                                  filter === "PUSAT"
                                    ? "Purchase Order Pusat"
                                    : "Purchase Order Outlet"
                                } yang menunggu approval`}
                          </h3>

                          <p className="mt-1.5 max-w-md text-sm leading-6 text-gray-400">
                            Tidak ada Purchase Order berstatus DRAFT
                            yang sesuai dengan filter yang dipilih.
                          </p>

                          <button
                            type="button"
                            onClick={load}
                            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-xs font-bold text-[#497F70] transition hover:bg-[#F2F7F4]"
                          >
                            <RefreshCw size={14} />
                            Periksa Lagi
                          </button>

                        </div>

                      </td>

                    </tr>
                  )}

                {/* =================================================
                    DATA
                ================================================= */}

                {!loading &&
                  filteredData.map(
                    (
                      item,
                      index
                    ) => {

                      const isOutlet =
                        isOutletPurchase(item);

                      const destination =
                        isOutlet
                          ? item.outlet?.name ||
                            item.destinationName ||
                            "-"
                          : "Gudang Pusat";

                      const destinationCode =
                        isOutlet
                          ? item.outlet?.code ||
                            item.destinationCode ||
                            ""
                          : "";

                      const isApproving =
                        approvingId ===
                        item.id;

                      return (
                        <tr
                          key={`${item.source}-${item.id}`}
                          className="group border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                        >

                          {/* NUMBER */}

                          <td className="px-5 py-5">

                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#F1F6F3] text-[10px] font-bold text-[#607A70]">
                              {String(
                                index + 1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </span>

                          </td>

                          {/* PO */}

                          <td className="px-5 py-5">

                            <div className="flex items-center gap-3">

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F6F3] text-[#497F70]">
                                <FileText size={17} />
                              </div>

                              <div>

                                <p className="font-black text-[#18352D]">
                                  {item.number}
                                </p>

                                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                  Purchase Order
                                </p>

                              </div>

                            </div>

                          </td>

                          {/* JENIS */}

                          <td className="px-5 py-5">

                            {isOutlet ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                                <Store size={12} />
                                Outlet
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D9E9E1] bg-[#EAF3EF] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#497F70]">
                                <Warehouse size={12} />
                                Pusat
                              </span>
                            )}

                          </td>

                          {/* TUJUAN */}

                          <td className="px-5 py-5">

                            <div className="flex items-center gap-2.5">

                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F5F8F6] text-gray-400">
                                {isOutlet ? (
                                  <Store size={15} />
                                ) : (
                                  <Warehouse size={15} />
                                )}
                              </div>

                              <div className="min-w-0">

                                <p className="truncate font-bold text-[#35564C]">
                                  {destination}
                                </p>

                                {destinationCode && (
                                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
                                    {destinationCode}
                                  </p>
                                )}

                              </div>

                            </div>

                          </td>

                          {/* SUPPLIER */}

                          <td className="px-5 py-5">

                            <div className="flex items-center gap-2.5">

                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F5F8F6] text-gray-400">
                                <UserRound size={15} />
                              </div>

                              <span className="max-w-[180px] truncate font-semibold text-gray-600">
                                {item.supplier?.name ||
                                  "-"}
                              </span>

                            </div>

                          </td>

                          {/* DATE */}

                          <td className="px-5 py-5">

                            <div className="flex items-center gap-2 text-gray-500">

                              <CalendarDays
                                size={15}
                                className="text-gray-400"
                              />

                              <span className="text-xs font-medium">
                                {item.purchaseDate
                                  ? new Date(
                                      item.purchaseDate
                                    ).toLocaleDateString(
                                      "id-ID",
                                      {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      }
                                    )
                                  : "-"}
                              </span>

                            </div>

                          </td>

                          {/* ITEM */}

                          <td className="px-5 py-5 text-center">

                            <span className="inline-flex min-w-8 items-center justify-center rounded-lg bg-[#F5F8F6] px-2.5 py-1.5 text-xs font-bold text-[#35564C]">
                              {item.items?.length ||
                                0}
                            </span>

                          </td>

                          {/* TOTAL */}

                          <td className="px-5 py-5 text-right">

                            <p className="font-black text-[#18352D]">
                              Rp{" "}
                              {Number(
                                item.total ||
                                  0
                              ).toLocaleString(
                                "id-ID"
                              )}
                            </p>

                          </td>

                          {/* STATUS */}

                          <td className="px-5 py-5 text-center">

                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">

                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />

                              Draft

                            </span>

                          </td>

                          {/* ACTION */}

                          <td className="px-5 py-5">

                            <div className="flex items-center justify-center gap-2">

                              <Link
                                href={
                                  isOutlet
                                    ? `/outlet/purchase/${item.id}`
                                    : `/purchase/${item.id}`
                                }
                                className="group/detail inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#D5E5DC] bg-white px-3 text-[11px] font-bold text-[#35564C] transition hover:border-[#BFD3CA] hover:bg-[#F2F7F4]"
                              >
                                <Eye size={14} />

                                Detail

                                <ChevronRight
                                  size={12}
                                  className="transition group-hover/detail:translate-x-0.5"
                                />
                              </Link>

                              <button
                                type="button"
                                onClick={() =>
                                  openApproveModal(
                                    item
                                  )
                                }
                                disabled={
                                  loading ||
                                  approvingId !==
                                    null
                                }
                                className="group/approve inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#497F70] to-[#3D6D60] px-3.5 text-[11px] font-bold text-white shadow-[0_5px_14px_rgba(73,127,112,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(73,127,112,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
                              >

                                <CheckCircle2
                                  size={14}
                                  className="transition-transform group-hover/approve:scale-110"
                                />

                                Approve

                              </button>

                            </div>

                          </td>

                        </tr>
                      );
                    }
                  )}

              </tbody>

            </table>

          </div>

          {/* =====================================================
              TABLE FOOTER
          ===================================================== */}

          {!loading &&
            filteredData.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-[#E8EEEB] bg-[#FAFCFB] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">

                <div className="flex items-center gap-2 text-xs text-gray-400">

                  <Sparkles
                    size={14}
                    className="text-[#497F70]"
                  />

                  <span>
                    Review detail sebelum melakukan approval.
                  </span>

                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-[#35564C]">

                  <span>
                    {filteredData.length}{" "}
                    {filterLabel}
                  </span>

                  <ArrowUpRight
                    size={14}
                    className="text-[#497F70]"
                  />

                </div>

              </div>
            )}

        </section>

        {/* =====================================================
            APPROVAL NOTICE
        ===================================================== */}

        {!loading &&
          filteredData.length > 0 && (
            <div className="mt-5 rounded-2xl border border-[#DDE9E4] bg-white px-5 py-4 shadow-[0_5px_20px_rgba(24,53,45,0.03)]">

              <div className="flex items-start gap-3">

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <ShieldCheck size={17} />
                </div>

                <div>

                  <p className="text-xs font-bold text-[#35564C]">
                    Perhatian sebelum approval
                  </p>

                  <p className="mt-1 text-[11px] leading-5 text-gray-400">
                    Setelah Purchase Order diapprove,
                    transaksi tidak dapat diedit atau dihapus
                    melalui alur draft.
                  </p>

                </div>

              </div>

            </div>
          )}

      </div>

      {/* =======================================================
          PREMIUM APPROVAL MODAL
      ======================================================= */}

      {approveTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-purchase-title"
        >

          {/* BACKDROP */}

          <button
            type="button"
            aria-label="Tutup modal"
            disabled={approveIsProcessing}
            onClick={() =>
              setApproveTarget(null)
            }
            className="absolute inset-0 bg-[#102D25]/55 backdrop-blur-[6px] transition-opacity disabled:cursor-not-allowed"
          />

          {/* MODAL */}

          <div className="relative z-10 w-full max-w-[720px] overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_30px_100px_rgba(14,45,36,0.28)]">

            {/* TOP ACCENT */}

            <div className="h-1.5 bg-gradient-to-r from-[#315E50] via-[#497F70] to-[#7BAE9E]" />

            {/* HEADER */}

            <div className="relative overflow-hidden border-b border-[#E7EFEB] bg-gradient-to-br from-[#F8FCFA] via-white to-[#EEF6F2] px-5 py-5 md:px-7 md:py-6">

              <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#497F70]/10 blur-2xl" />

              <div className="relative flex items-start justify-between gap-4">

                <div className="flex items-center gap-3.5">

                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#497F70] to-[#315E50] text-white shadow-[0_10px_25px_rgba(73,127,112,0.25)]">

                    <ShieldCheck
                      size={23}
                      strokeWidth={1.8}
                    />

                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#18352D]">
                      <CheckCircle2 size={9} />
                    </span>

                  </div>

                  <div>

                    <div className="mb-1 flex flex-wrap items-center gap-2">

                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CFE2D9] bg-[#EAF3EF] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-[#497F70]">
                        <Sparkles size={9} />
                        Approval Review
                      </span>

                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-amber-700">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                        Draft
                      </span>

                    </div>

                    <h2
                      id="approve-purchase-title"
                      className="text-lg font-black tracking-tight text-[#18352D] md:text-xl"
                    >
                      Approve Purchase Order
                    </h2>

                    <p className="mt-0.5 text-[10px] text-[#82938D]">
                      Periksa detail transaksi sebelum memberikan persetujuan.
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setApproveTarget(null)
                  }
                  disabled={approveIsProcessing}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DDE9E4] bg-white text-[#81918B] shadow-sm transition hover:border-[#C5D8D0] hover:bg-[#F2F7F4] hover:text-[#497F70] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Tutup"
                >
                  <X size={16} />
                </button>

              </div>

            </div>

            {/* BODY */}

            <div className="max-h-[calc(100vh-260px)] overflow-y-auto px-5 py-5 md:px-7 md:py-6">

              {/* PO IDENTITY */}

              <div className="rounded-2xl border border-[#DDE9E4] bg-[#FAFCFB] p-4">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                  <div className="flex items-center gap-3">

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#497F70] shadow-sm ring-1 ring-[#E2ECE7]">
                      <FileText size={19} />
                    </div>

                    <div>

                      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#95A39E]">
                        Purchase Order
                      </p>

                      <p className="mt-1 text-base font-black text-[#18352D]">
                        {approveTarget.number}
                      </p>

                    </div>

                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-[#DCE8E2] bg-white px-3 py-2">

                    {approveIsOutlet ? (
                      <>
                        <Store
                          size={14}
                          className="text-blue-600"
                        />

                        <div>
                          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#9AA7A2]">
                            Jenis
                          </p>

                          <p className="text-[10px] font-black text-blue-700">
                            Purchase Outlet
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Warehouse
                          size={14}
                          className="text-[#497F70]"
                        />

                        <div>
                          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#9AA7A2]">
                            Jenis
                          </p>

                          <p className="text-[10px] font-black text-[#497F70]">
                            Purchase Pusat
                          </p>
                        </div>
                      </>
                    )}

                  </div>

                </div>

              </div>

              {/* DETAIL GRID */}

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">

                {/* SUPPLIER */}

                <div className="rounded-2xl border border-[#E1EAE6] bg-white p-4 shadow-sm">

                  <div className="flex items-start gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F6F3] text-[#607A70]">
                      <UserRound size={16} />
                    </div>

                    <div className="min-w-0">

                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#9AA7A2]">
                        Supplier
                      </p>

                      <p className="mt-1 truncate text-[11px] font-black text-[#35564C]">
                        {approveTarget.supplier?.name ||
                          "-"}
                      </p>

                    </div>

                  </div>

                </div>

                {/* DATE */}

                <div className="rounded-2xl border border-[#E1EAE6] bg-white p-4 shadow-sm">

                  <div className="flex items-start gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F6F3] text-[#607A70]">
                      <CalendarDays size={16} />
                    </div>

                    <div>

                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#9AA7A2]">
                        Purchase Date
                      </p>

                      <p className="mt-1 text-[11px] font-black text-[#35564C]">
                        {approveTarget.purchaseDate
                          ? new Date(
                              approveTarget.purchaseDate
                            ).toLocaleDateString(
                              "id-ID",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )
                          : "-"}
                      </p>

                    </div>

                  </div>

                </div>

                {/* DESTINATION */}

                <div className="rounded-2xl border border-[#E1EAE6] bg-white p-4 shadow-sm">

                  <div className="flex items-start gap-3">

                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        approveIsOutlet
                          ? "bg-blue-50 text-blue-600"
                          : "bg-[#EAF3EF] text-[#497F70]"
                      }`}
                    >
                      {approveIsOutlet ? (
                        <Store size={16} />
                      ) : (
                        <Warehouse size={16} />
                      )}
                    </div>

                    <div className="min-w-0">

                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#9AA7A2]">
                        Tujuan
                      </p>

                      <p className="mt-1 truncate text-[11px] font-black text-[#35564C]">
                        {approveDestination}
                      </p>

                      {approveDestinationCode && (
                        <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-[#9AA7A2]">
                          {approveDestinationCode}
                        </p>
                      )}

                    </div>

                  </div>

                </div>

                {/* ITEM */}

                <div className="rounded-2xl border border-[#E1EAE6] bg-white p-4 shadow-sm">

                  <div className="flex items-start gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F6F3] text-[#607A70]">
                      <Package size={16} />
                    </div>

                    <div>

                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#9AA7A2]">
                        Total Item
                      </p>

                      <p className="mt-1 text-[11px] font-black text-[#35564C]">
                        {approveItemCount.toLocaleString(
                          "id-ID"
                        )}{" "}
                        item
                      </p>

                    </div>

                  </div>

                </div>

              </div>

              {/* TOTAL VALUE */}

              <div className="relative mt-4 overflow-hidden rounded-2xl border border-[#CFE1D9] bg-gradient-to-br from-[#18352D] via-[#244D41] to-[#497F70] p-5 text-white shadow-[0_12px_30px_rgba(24,53,45,0.18)]">

                <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-white/5" />

                <div className="pointer-events-none absolute -bottom-20 left-[30%] h-36 w-36 rounded-full bg-white/5 blur-xl" />

                <div className="relative flex items-center justify-between gap-4">

                  <div>

                    <p className="text-[8px] font-black uppercase tracking-[0.17em] text-white/50">
                      Nilai Purchase Order
                    </p>

                    <p className="mt-1 text-xl font-black tracking-tight md:text-2xl">
                      Rp{" "}
                      {approveTotal.toLocaleString(
                        "id-ID"
                      )}
                    </p>

                  </div>

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                    <CircleDollarSign size={21} />
                  </div>

                </div>

              </div>

              {/* APPROVAL IMPACT */}

              <div className="mt-5">

                <div className="mb-3 flex items-center gap-2">

                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                    <ShieldCheck size={13} />
                  </div>

                  <div>

                    <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#35564C]">
                      Approval Impact
                    </p>

                    <p className="text-[8px] text-[#9AA7A2]">
                      Perubahan setelah approval
                    </p>

                  </div>

                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">

                  <div className="flex items-center gap-3 rounded-xl border border-[#DDE9E4] bg-[#FAFCFB] px-3 py-3">

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                      <CheckCircle2 size={14} />
                    </div>

                    <div>
                      <p className="text-[9px] font-black text-[#456158]">
                        Status PO
                      </p>

                      <p className="text-[8px] text-[#8E9D97]">
                        DRAFT → APPROVED
                      </p>
                    </div>

                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-[#DDE9E4] bg-[#FAFCFB] px-3 py-3">

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                      <Package size={14} />
                    </div>

                    <div>
                      <p className="text-[9px] font-black text-[#456158]">
                        Procurement
                      </p>

                      <p className="text-[8px] text-[#8E9D97]">
                        Siap diproses
                      </p>
                    </div>

                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-[#DDE9E4] bg-[#FAFCFB] px-3 py-3">

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                      <Receipt size={14} />
                    </div>

                    <div>
                      <p className="text-[9px] font-black text-[#456158]">
                        Nilai Transaksi
                      </p>

                      <p className="text-[8px] text-[#8E9D97]">
                        Rp{" "}
                        {approveTotal.toLocaleString(
                          "id-ID"
                        )}
                      </p>
                    </div>

                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-[#DDE9E4] bg-[#FAFCFB] px-3 py-3">

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                      <LockKeyhole size={14} />
                    </div>

                    <div>
                      <p className="text-[9px] font-black text-[#456158]">
                        Draft Lock
                      </p>

                      <p className="text-[8px] text-[#8E9D97]">
                        Tidak dapat diedit
                      </p>
                    </div>

                  </div>

                </div>

              </div>

              {/* WARNING */}

              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-[#FFFDF7] p-4">

                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <ShieldCheck size={15} />
                </div>

                <div>

                  <p className="text-[10px] font-black text-amber-800">
                    Pastikan detail sudah benar
                  </p>

                  <p className="mt-1 text-[9px] leading-4 text-amber-700/80">
                    Setelah Purchase Order diapprove,
                    dokumen keluar dari alur draft dan
                    tidak dapat diedit atau dihapus melalui
                    alur draft.
                  </p>

                </div>

              </div>

            </div>

            {/* FOOTER */}

            <div className="border-t border-[#E7EFEB] bg-[#FAFCFB] px-5 py-4 md:px-7">

              <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-between">

                <button
                  type="button"
                  disabled={approveIsProcessing}
                  onClick={() =>
                    setApproveTarget(null)
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-5 text-[11px] font-black uppercase tracking-[0.08em] text-[#506860] shadow-sm transition hover:border-[#BFD3CA] hover:bg-[#F2F7F4] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X size={14} />
                  Batal
                </button>

                <button
                  type="button"
                  disabled={approveIsProcessing}
                  onClick={() =>
                    approvePurchase(
                      approveTarget
                    )
                  }
                  className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#497F70] via-[#3F7061] to-[#315E50] px-6 text-[11px] font-black uppercase tracking-[0.08em] text-white shadow-[0_8px_22px_rgba(73,127,112,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(73,127,112,0.32)] disabled:cursor-not-allowed disabled:opacity-60"
                >

                  {approveIsProcessing ? (
                    <>
                      <RefreshCw
                        size={15}
                        className="animate-spin"
                      />

                      Processing...
                    </>
                  ) : (
                    <>
                      <Send
                        size={14}
                        className="transition-transform group-hover:translate-x-0.5"
                      />

                      Approve Purchase Order
                    </>
                  )}

                </button>

              </div>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-[8px] text-[#9AA7A2]">

                <LockKeyhole size={10} />

                Approval akan diproses melalui transaksi sistem.

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}