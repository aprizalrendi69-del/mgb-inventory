"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  ShoppingCart,
  Plus,
  Search,
  RefreshCw,
  FileText,
  CheckCircle2,
  PackageCheck,
  Clock3,
  Eye,
  Printer,
  Truck,
  Store,
  Trash2,
  ArrowUpRight,
  Layers3,
  CircleDollarSign,
  ChevronRight,
  Database,
  Sparkles,
  CreditCard,
  Banknote,
  WalletCards,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Activity,
} from "lucide-react";

type PaymentMethod =
  | "CASH"
  | "TRANSFER"
  | "QRIS"
  | "CARD"
  | "DEBIT"
  | "CREDIT"
  | "COD"
  | "CBD"
  | "TEMPO"
  | string;

type PurchaseRow = {
  id: number;
  number: string;
  purchaseDate?: string;
  total: number;
  status: string;

  supplier?: {
    id: number;
    code?: string;
    name: string;
  };

  outlet?: {
    id: number;
    code?: string;
    name: string;
  };

  outletId?: number | null;
  supplierId?: number;

  source?: "PUSAT" | "OUTLET" | string;

  destinationType?: "PUSAT" | "OUTLET";
  destinationId?: number | null;
  destinationName?: string;
  destinationCode?: string | null;

  paymentMethod?: PaymentMethod | null;
  payment_method?: PaymentMethod | null;
  paymentType?: PaymentMethod | null;
  payment?: PaymentMethod | null;
};

export default function PurchasePage() {
  const [purchase, setPurchase] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("SEMUA");
  const [source, setSource] = useState("SEMUA");
  const [paymentFilter, setPaymentFilter] =
    useState("SEMUA");

  useEffect(() => {
    loadPurchase();
  }, []);

  async function loadPurchase() {
    try {
      setLoading(true);

      const res = await fetch("/api/purchase", {
        cache: "no-store",
      });

      const json = await res.json();

      console.log("PURCHASE DATA:", json);

      if (!json.success || !Array.isArray(json.data)) {
        setPurchase([]);
        return;
      }

      const normalized: PurchaseRow[] =
        json.data.map((item: any) => ({
          ...item,

          source:
            item.source === "OUTLET" ||
            (item.outletId !== null &&
              item.outletId !== undefined)
              ? "OUTLET"
              : "PUSAT",

          paymentMethod:
            item.paymentMethod ??
            item.payment_method ??
            item.paymentType ??
            item.payment ??
            null,
        }));

      setPurchase(normalized);
    } catch (error) {
      console.error("PURCHASE ERROR:", error);
      setPurchase([]);
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     PAYMENT METHOD
  ========================================================= */

  function getPaymentMethod(item: PurchaseRow) {
    const raw =
      item.paymentMethod ??
      item.payment_method ??
      item.paymentType ??
      item.payment;

    if (!raw) {
      return null;
    }

    return String(raw).trim().toUpperCase();
  }

  function paymentLabel(
    value: string | null
  ) {
    if (!value) {
      return "Belum Ditentukan";
    }

    const labels: Record<string, string> = {
      CASH: "Cash",
      TRANSFER: "Transfer",
      QRIS: "QRIS",
      CARD: "Card",
      DEBIT: "Debit",
      CREDIT: "Credit",
      COD: "COD",
      CBD: "CBD",
      TEMPO: "Tempo",
    };

    return labels[value] || value;
  }

  function PaymentBadge({
    method,
  }: {
    method: string | null;
  }) {
    if (!method) {
      return (
        <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-400">
          <ReceiptText size={13} />
          Belum Ditentukan
        </span>
      );
    }

    const normalized = method.toUpperCase();

    let icon = <WalletCards size={13} />;
    let className =
      "border-slate-200 bg-slate-50 text-slate-600";

    if (normalized === "CASH") {
      icon = <Banknote size={13} />;
      className =
        "border-emerald-100 bg-emerald-50 text-emerald-700";
    } else if (
      normalized === "TRANSFER"
    ) {
      icon = <Landmark size={13} />;
      className =
        "border-blue-100 bg-blue-50 text-blue-700";
    } else if (
      normalized === "QRIS"
    ) {
      icon = <CreditCard size={13} />;
      className =
        "border-purple-100 bg-purple-50 text-purple-700";
    } else if (
      normalized === "CARD" ||
      normalized === "DEBIT" ||
      normalized === "CREDIT"
    ) {
      icon = <CreditCard size={13} />;
      className =
        "border-indigo-100 bg-indigo-50 text-indigo-700";
    } else if (
      normalized === "COD" ||
      normalized === "CBD"
    ) {
      icon = <WalletCards size={13} />;
      className =
        "border-amber-100 bg-amber-50 text-amber-700";
    } else if (
      normalized === "TEMPO"
    ) {
      icon = <Clock3 size={13} />;
      className =
        "border-orange-100 bg-orange-50 text-orange-700";
    }

    return (
      <span
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold ${className}`}
      >
        {icon}
        {paymentLabel(normalized)}
      </span>
    );
  }

  /* =========================================================
     DELETE PURCHASE
  ========================================================= */

  async function deletePurchase(
    id: number,
    number: string,
    purchaseSource: "PUSAT" | "OUTLET"
  ) {
    const sourceLabel =
      purchaseSource === "OUTLET"
        ? "Purchase Order Outlet"
        : "Purchase Order Pusat";

    const ok = confirm(
      `Hapus ${sourceLabel} ${number || ""}?\n\n` +
        `Purchase Order yang masih DRAFT akan dihapus permanen.`
    );

    if (!ok) return;

    try {
      const res = await fetch(
        `/api/purchase/${id}?source=${purchaseSource}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      console.log(
        "DELETE PURCHASE RESPONSE:",
        json
      );

      if (json.success) {
        alert(
          json.message ||
            `${sourceLabel} berhasil dihapus.`
        );

        await loadPurchase();
      } else {
        alert(
          json.message ||
            `Gagal menghapus ${sourceLabel}.`
        );
      }
    } catch (error) {
      console.error(
        "DELETE PURCHASE ERROR:",
        error
      );

      alert(
        `Terjadi kesalahan saat menghapus ${sourceLabel}.`
      );
    }
  }

  /* =========================================================
     RECEIVE PURCHASE
  ========================================================= */

  async function receivePurchase(id: number) {
    const ok = confirm(
      "Terima barang dari Purchase Order ini?"
    );

    if (!ok) return;

    try {
      const res = await fetch(
        `/api/purchase/${id}/receive`,
        {
          method: "PUT",
        }
      );

      const json = await res.json();

      if (json.success) {
        alert("Barang berhasil diterima");

        await loadPurchase();
      } else {
        alert(
          json.message ||
            "Gagal menerima barang"
        );
      }
    } catch (error) {
      console.error(
        "RECEIVE PURCHASE ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menerima barang"
      );
    }
  }

  /* =========================================================
     FILTER
  ========================================================= */

  const filteredPurchase = useMemo(() => {
    const keyword =
      search.toLowerCase().trim();

    return purchase.filter((item) => {
      const itemSource =
        item.source === "OUTLET"
          ? "OUTLET"
          : "PUSAT";

      const paymentMethod =
        getPaymentMethod(item);

      const nomorPO =
        item.number
          ?.toLowerCase()
          .includes(keyword);

      const namaSupplier =
        item.supplier?.name
          ?.toLowerCase()
          .includes(keyword);

      const kodeSupplier =
        item.supplier?.code
          ?.toLowerCase()
          .includes(keyword);

      const namaOutlet =
        item.outlet?.name
          ?.toLowerCase()
          .includes(keyword);

      const kodeOutlet =
        item.outlet?.code
          ?.toLowerCase()
          .includes(keyword);

      const paymentSearch =
        paymentMethod
          ?.toLowerCase()
          .includes(keyword);

      const cocokSearch =
        !keyword ||
        nomorPO ||
        namaSupplier ||
        kodeSupplier ||
        namaOutlet ||
        kodeOutlet ||
        paymentSearch;

      const cocokStatus =
        status === "SEMUA" ||
        item.status === status;

      const cocokSource =
        source === "SEMUA" ||
        itemSource === source;

      const cocokPayment =
        paymentFilter === "SEMUA" ||
        paymentMethod === paymentFilter;

      return (
        cocokSearch &&
        cocokStatus &&
        cocokSource &&
        cocokPayment
      );
    });
  }, [
    purchase,
    search,
    status,
    source,
    paymentFilter,
  ]);

  /* =========================================================
     SUMMARY
  ========================================================= */

  const totalPurchase =
    purchase.length;

  const totalPusat =
    purchase.filter(
      (item) =>
        item.source !== "OUTLET"
    ).length;

  const totalOutlet =
    purchase.filter(
      (item) =>
        item.source === "OUTLET"
    ).length;

  const totalDraft =
    purchase.filter(
      (item) =>
        item.status === "DRAFT"
    ).length;

  const totalApproved =
    purchase.filter(
      (item) =>
        item.status === "APPROVED"
    ).length;

  const totalReceived =
    purchase.filter(
      (item) =>
        item.status === "RECEIVED"
    ).length;

  const totalValue =
    purchase.reduce(
      (total, item) =>
        total +
        Number(item.total || 0),
      0
    );

  const paymentSummary = useMemo(() => {
    const summary: Record<
      string,
      number
    > = {};

    purchase.forEach((item) => {
      const method =
        getPaymentMethod(item) ||
        "UNSET";

      summary[method] =
        (summary[method] || 0) + 1;
    });

    return summary;
  }, [purchase]);

  const availablePaymentMethods =
    useMemo(() => {
      const methods = new Set<string>();

      purchase.forEach((item) => {
        const method =
          getPaymentMethod(item);

        if (method) {
          methods.add(method);
        }
      });

      return Array.from(methods).sort();
    }, [purchase]);

  /* =========================================================
     FORMAT
  ========================================================= */

  function formatRupiah(value: any) {
    return Number(
      value || 0
    ).toLocaleString("id-ID");
  }

  function formatDate(value: any) {
    if (!value) return "-";

    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
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

  /* =========================================================
     STATUS BADGE
  ========================================================= */

  function StatusBadge({
    status,
  }: {
    status: string;
  }) {
    if (status === "DRAFT") {
      return (
        <span className="inline-flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50 px-3 py-2 text-[10px] font-extrabold text-amber-700 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.10)]" />
          Draft
        </span>
      );
    }

    if (status === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-2 rounded-xl border border-blue-200/70 bg-blue-50 px-3 py-2 text-[10px] font-extrabold text-blue-700 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.10)]" />
          Approved
        </span>
      );
    }

    if (status === "RECEIVED") {
      return (
        <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50 px-3 py-2 text-[10px] font-extrabold text-emerald-700 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.10)]" />
          Received
        </span>
      );
    }

    if (status === "COMPLETED") {
      return (
        <span className="inline-flex items-center gap-2 rounded-xl border border-purple-200/70 bg-purple-50 px-3 py-2 text-[10px] font-extrabold text-purple-700 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shadow-[0_0_0_3px_rgba(168,85,247,0.10)]" />
          Completed
        </span>
      );
    }

    if (status === "CANCELLED") {
      return (
        <span className="inline-flex items-center gap-2 rounded-xl border border-red-200/70 bg-red-50 px-3 py-2 text-[10px] font-extrabold text-red-700 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.10)]" />
          Cancelled
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-extrabold text-gray-600">
        {status || "Unknown"}
      </span>
    );
  }

  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <div className="min-h-full bg-[#F3F7F5] p-4 md:p-6 lg:p-8">

      {/* =====================================================
          PREMIUM HERO
      ===================================================== */}

      <div className="relative mb-7 overflow-hidden rounded-[28px] border border-[#D8E6DF] bg-white shadow-[0_14px_45px_rgba(24,53,45,0.07)]">

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(73,127,112,0.12),transparent_32%),radial-gradient(circle_at_20%_100%,rgba(16,185,129,0.07),transparent_28%)]" />

        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#497F70]/10 blur-3xl" />

        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-emerald-100/40 blur-3xl" />

        <div className="relative px-5 py-6 md:px-8 md:py-8">

          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

            <div className="flex items-start gap-4">

              <div className="relative shrink-0">

                <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#497F70] via-[#3E7162] to-[#244D41] text-white shadow-[0_12px_28px_rgba(73,127,112,0.28)]">
                  <ShoppingCart size={27} strokeWidth={1.8} />
                </div>

                <div className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-[3px] border-white bg-emerald-500 text-white shadow-sm">
                  <Sparkles size={10} />
                </div>

              </div>

              <div className="min-w-0">

                <div className="mb-2 flex flex-wrap items-center gap-2">

                  <span className="rounded-full border border-[#D5E7DE] bg-[#EFF7F3] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#497F70]">
                    Procurement
                  </span>

                  <span className="h-1 w-1 rounded-full bg-[#B8C9C2]" />

                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400">
                    ERP / Purchase Management
                  </span>

                </div>

                <h1 className="text-2xl font-black tracking-[-0.035em] text-[#18352D] md:text-3xl">
                  Purchase Order
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                  Kelola seluruh Purchase Order pusat dan outlet,
                  termasuk status, nilai transaksi, supplier,
                  tujuan pembelian, serta metode pembayaran.
                </p>

              </div>

            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

              <div className="flex items-center gap-3 rounded-2xl border border-[#DDEAE4] bg-[#F8FBF9] px-4 py-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#497F70] shadow-sm">
                  <Activity size={16} />
                </div>

                <div>

                  <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                    Purchase Database
                  </p>

                  <p className="mt-0.5 text-sm font-black text-[#35564C]">
                    {purchase.length}{" "}
                    <span className="font-semibold text-gray-400">
                      dokumen
                    </span>
                  </p>

                </div>

              </div>

              <Link
                href="/purchase/new"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#497F70] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_10px_25px_rgba(73,127,112,0.20)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#3D6D60] hover:shadow-[0_14px_30px_rgba(73,127,112,0.25)]"
              >
                <Plus
                  size={17}
                  className="transition-transform duration-300 group-hover:rotate-90"
                />

                Purchase Baru

                <ArrowUpRight
                  size={15}
                  className="opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>

            </div>

          </div>

        </div>

      </div>

      {/* =====================================================
          KPI
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {[
          {
            label: "Total Purchase",
            value: totalPurchase,
            description: "Seluruh dokumen PO",
            icon: FileText,
            tone: "green",
          },
          {
            label: "Purchase Pusat",
            value: totalPusat,
            description: "Gudang pusat",
            icon: ShoppingCart,
            tone: "green",
          },
          {
            label: "Purchase Outlet",
            value: totalOutlet,
            description: "Pembelian outlet",
            icon: Store,
            tone: "blue",
          },
          {
            label: "Barang Diterima",
            value: totalReceived,
            description: "Purchase sudah diterima",
            icon: PackageCheck,
            tone: "emerald",
          },
        ].map((card) => {
          const Icon = card.icon;

          const iconClass =
            card.tone === "blue"
              ? "bg-blue-50 text-blue-600"
              : card.tone === "emerald"
                ? "bg-emerald-50 text-emerald-600"
                : "bg-[#EAF3EF] text-[#497F70]";

          const valueClass =
            card.tone === "blue"
              ? "text-blue-600"
              : card.tone === "emerald"
                ? "text-emerald-600"
                : "text-[#497F70]";

          return (
            <div
              key={card.label}
              className="group relative overflow-hidden rounded-[22px] border border-[#DCE8E3] bg-white p-5 shadow-[0_5px_24px_rgba(24,53,45,0.045)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(24,53,45,0.08)]"
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#497F70]/5 transition-transform duration-500 group-hover:scale-150" />

              <div className="relative flex items-start justify-between">

                <div>

                  <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-gray-400">
                    {card.label}
                  </p>

                  <p
                    className={`mt-2 text-3xl font-black tracking-[-0.04em] ${valueClass}`}
                  >
                    {card.value}
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    {card.description}
                  </p>

                </div>

                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}
                >
                  <Icon size={20} strokeWidth={1.8} />
                </div>

              </div>
            </div>
          );
        })}

      </div>

      {/* =====================================================
          SECONDARY SUMMARY
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-4">

        <div className="rounded-[22px] border border-[#DCE8E3] bg-white p-5 shadow-[0_5px_24px_rgba(24,53,45,0.04)]">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock3 size={19} />
            </div>

            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                Draft
              </p>

              <p className="mt-0.5 text-2xl font-black text-amber-600">
                {totalDraft}
                <span className="ml-2 text-xs font-semibold text-gray-400">
                  dokumen
                </span>
              </p>
            </div>

          </div>

        </div>

        <div className="rounded-[22px] border border-[#DCE8E3] bg-white p-5 shadow-[0_5px_24px_rgba(24,53,45,0.04)]">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <CheckCircle2 size={19} />
            </div>

            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                Approved
              </p>

              <p className="mt-0.5 text-2xl font-black text-blue-600">
                {totalApproved}
                <span className="ml-2 text-xs font-semibold text-gray-400">
                  menunggu penerimaan
                </span>
              </p>
            </div>

          </div>

        </div>

        <div className="rounded-[22px] border border-[#DCE8E3] bg-white p-5 shadow-[0_5px_24px_rgba(24,53,45,0.04)]">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <CircleDollarSign size={19} />
            </div>

            <div className="min-w-0">

              <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                Total Nilai Purchase
              </p>

              <p className="mt-1 truncate text-xl font-black tracking-tight text-[#18352D]">
                Rp {formatRupiah(totalValue)}
              </p>

            </div>

          </div>

        </div>

        <div className="rounded-[22px] border border-[#DCE8E3] bg-gradient-to-br from-[#18352D] to-[#315E51] p-5 text-white shadow-[0_10px_30px_rgba(24,53,45,0.14)]">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-white/55">
                Payment Tracking
              </p>

              <p className="mt-1 text-xl font-black">
                {Object.keys(paymentSummary).length}
                <span className="ml-2 text-xs font-semibold text-white/55">
                  metode
                </span>
              </p>

            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
              <CreditCard size={19} />
            </div>

          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">

            {Object.entries(paymentSummary)
              .slice(0, 4)
              .map(([method, count]) => (
                <span
                  key={method}
                  className="rounded-lg bg-white/10 px-2 py-1 text-[9px] font-bold text-white/80"
                >
                  {paymentLabel(
                    method === "UNSET"
                      ? null
                      : method
                  )}{" "}
                  · {count}
                </span>
              ))}

          </div>

        </div>

      </div>

      {/* =====================================================
          TABLE CONTAINER
      ===================================================== */}

      <div className="overflow-hidden rounded-[28px] border border-[#DCE8E3] bg-white shadow-[0_12px_45px_rgba(24,53,45,0.06)]">

        {/* TABLE HEADER */}

        <div className="border-b border-[#E7EEEA] px-5 py-5 md:px-6">

          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <div className="flex items-center gap-2.5">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <Layers3 size={17} />
                </div>

                <div>

                  <h2 className="text-base font-black tracking-tight text-[#18352D]">
                    Daftar Purchase Order
                  </h2>

                  <p className="mt-0.5 text-[11px] text-gray-400">
                    Monitor procurement, payment, supplier,
                    destination, dan status penerimaan.
                  </p>

                </div>

              </div>

            </div>

            <div className="flex items-center gap-2">

              <span className="hidden rounded-xl border border-[#E1EAE5] bg-[#F7FAF8] px-3 py-2 text-[10px] font-bold text-gray-500 sm:inline-flex">
                {filteredPurchase.length} ditampilkan
              </span>

              <button
                type="button"
                onClick={loadPurchase}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-3.5 py-2.5 text-xs font-extrabold text-gray-600 transition-all hover:border-[#BFD4CB] hover:bg-[#F7FAF8] hover:text-[#497F70] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />
                Refresh
              </button>

            </div>

          </div>

          {/* FILTER BAR */}

          <div className="rounded-[20px] border border-[#E2EBE6] bg-[#F7FAF8] p-3">

            <div className="flex flex-col gap-3 xl:flex-row">

              <div className="relative min-w-0 flex-1">

                <Search
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Cari No PO, supplier, outlet, atau metode pembayaran..."
                  className="w-full rounded-xl border border-[#DCE7E1] bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-[#35564C] outline-none transition-all placeholder:text-gray-400 focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                />

              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:flex">

                {/* SOURCE */}

                <div className="relative">

                  <select
                    value={source}
                    onChange={(e) =>
                      setSource(e.target.value)
                    }
                    className="w-full appearance-none rounded-xl border border-[#DCE7E1] bg-white px-4 py-2.5 pr-10 text-sm font-semibold text-gray-600 outline-none transition-all hover:border-[#BFD4CB] focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10 xl:min-w-[175px]"
                  >
                    <option value="SEMUA">
                      Semua Purchase
                    </option>
                    <option value="PUSAT">
                      Purchase Pusat
                    </option>
                    <option value="OUTLET">
                      Purchase Outlet
                    </option>
                  </select>

                  <ChevronRight
                    size={15}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-gray-400"
                  />

                </div>

                {/* STATUS */}

                <div className="relative">

                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value)
                    }
                    className="w-full appearance-none rounded-xl border border-[#DCE7E1] bg-white px-4 py-2.5 pr-10 text-sm font-semibold text-gray-600 outline-none transition-all hover:border-[#BFD4CB] focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10 xl:min-w-[155px]"
                  >
                    <option value="SEMUA">
                      Semua Status
                    </option>
                    <option value="DRAFT">
                      Draft
                    </option>
                    <option value="APPROVED">
                      Approved
                    </option>
                    <option value="RECEIVED">
                      Received
                    </option>
                    <option value="COMPLETED">
                      Completed
                    </option>
                    <option value="CANCELLED">
                      Cancelled
                    </option>
                  </select>

                  <ChevronRight
                    size={15}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-gray-400"
                  />

                </div>

                {/* PAYMENT */}

                <div className="relative">

                  <select
                    value={paymentFilter}
                    onChange={(e) =>
                      setPaymentFilter(
                        e.target.value
                      )
                    }
                    className="w-full appearance-none rounded-xl border border-[#DCE7E1] bg-white px-4 py-2.5 pr-10 text-sm font-semibold text-gray-600 outline-none transition-all hover:border-[#BFD4CB] focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10 xl:min-w-[160px]"
                  >
                    <option value="SEMUA">
                      Semua Pembayaran
                    </option>

                    {availablePaymentMethods.map(
                      (method) => (
                        <option
                          key={method}
                          value={method}
                        >
                          {paymentLabel(method)}
                        </option>
                      )
                    )}

                  </select>

                  <ChevronRight
                    size={15}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-gray-400"
                  />

                </div>

              </div>

            </div>

          </div>

          {/* RESULT INFO */}

          <div className="mt-4 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">

            <div className="flex flex-wrap items-center gap-2 text-gray-400">

              <span>
                Menampilkan
              </span>

              <span className="rounded-lg bg-[#EAF3EF] px-2 py-1 font-black text-[#497F70]">
                {filteredPurchase.length}
              </span>

              <span>
                dari
              </span>

              <span className="font-black text-[#35564C]">
                {purchase.length}
              </span>

              <span>
                Purchase Order
              </span>

            </div>

            {(search ||
              status !== "SEMUA" ||
              source !== "SEMUA" ||
              paymentFilter !== "SEMUA") && (

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("SEMUA");
                  setSource("SEMUA");
                  setPaymentFilter("SEMUA");
                }}
                className="font-bold text-[#497F70] transition hover:text-[#315E51]"
              >
                Reset semua filter
              </button>

            )}

          </div>

        </div>

        {/* ===================================================
            TABLE
        =================================================== */}

        <div className="overflow-x-auto">

          <table className="min-w-[1450px] w-full text-sm">

            <thead>

              <tr className="border-b border-[#E5ECE9] bg-[#F7F9F8]">

                <th className="w-16 px-5 py-4 text-left text-[9px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                  No
                </th>

                <th className="px-5 py-4 text-left text-[9px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                  Purchase Order
                </th>

                <th className="px-5 py-4 text-center text-[9px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                  Jenis
                </th>

                <th className="px-5 py-4 text-left text-[9px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                  Tanggal
                </th>

                <th className="px-5 py-4 text-left text-[9px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                  Supplier
                </th>

                <th className="px-5 py-4 text-left text-[9px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                  Tujuan
                </th>

                <th className="px-5 py-4 text-left text-[9px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                  Metode Pembayaran
                </th>

                <th className="px-5 py-4 text-right text-[9px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                  Total
                </th>

                <th className="px-5 py-4 text-center text-[9px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                  Status
                </th>

                <th className="px-5 py-4 text-center text-[9px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                  Aksi
                </th>

              </tr>

            </thead>

            <tbody>

              {/* LOADING */}

              {loading ? (

                <tr>

                  <td
                    colSpan={10}
                    className="px-5 py-24 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <div className="relative mb-5">

                        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#EAF3EF] text-[#497F70]">
                          <RefreshCw
                            size={25}
                            className="animate-spin"
                          />
                        </div>

                        <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.10)]" />

                      </div>

                      <p className="font-black text-[#35564C]">
                        Memuat Purchase Order
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Mengambil data transaksi terbaru...
                      </p>

                    </div>

                  </td>

                </tr>

              ) : filteredPurchase.length === 0 ? (

                <tr>

                  <td
                    colSpan={10}
                    className="px-5 py-24 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <div className="relative mb-5">

                        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#EAF3EF] text-[#497F70]">
                          <ShoppingCart size={28} />
                        </div>

                        <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-gray-400">
                          <Search size={11} />
                        </div>

                      </div>

                      <p className="font-black text-[#35564C]">
                        Tidak ada Purchase Order
                      </p>

                      <p className="mt-1 max-w-sm text-xs leading-5 text-gray-400">
                        Tidak ditemukan Purchase Order
                        yang sesuai dengan pencarian
                        atau filter yang dipilih.
                      </p>

                      {(search ||
                        status !== "SEMUA" ||
                        source !== "SEMUA" ||
                        paymentFilter !== "SEMUA") && (

                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setStatus("SEMUA");
                            setSource("SEMUA");
                            setPaymentFilter("SEMUA");
                          }}
                          className="mt-4 rounded-xl bg-[#497F70] px-4 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-[#497F70]/15 transition hover:bg-[#3D6D60]"
                        >
                          Reset Filter
                        </button>

                      )}

                    </div>

                  </td>

                </tr>

              ) : (

                filteredPurchase.map(
                  (item, index) => {

                    const isOutlet =
                      item.source === "OUTLET";

                    const purchaseSource:
                      | "PUSAT"
                      | "OUTLET" =
                      isOutlet
                        ? "OUTLET"
                        : "PUSAT";

                    const paymentMethod =
                      getPaymentMethod(item);

                    return (
                      <tr
                        key={`${purchaseSource}-${item.id}`}
                        className="group border-b border-[#EDF2EF] transition-all duration-150 hover:bg-[#FAFCFB]"
                      >

                        {/* NO */}

                        <td className="px-5 py-4">

                          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-[#F4F7F5] px-2 text-[10px] font-black text-gray-400">
                            {String(
                              index + 1
                            ).padStart(2, "0")}
                          </span>

                        </td>

                        {/* PO */}

                        <td className="px-5 py-4">

                          <Link
                            href={
                              isOutlet
                                ? `/outlet/purchase/${item.id}`
                                : `/purchase/${item.id}`
                            }
                            className="group/po inline-flex items-center gap-3"
                          >

                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70] transition-all group-hover/po:bg-[#DCEBE5] group-hover/po:shadow-sm">
                              <FileText size={16} />
                            </div>

                            <div className="min-w-0">

                              <div className="font-black text-[#18352D] transition-colors group-hover/po:text-[#497F70]">
                                {item.number || "-"}
                              </div>

                              <div className="mt-0.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-gray-400">
                                <ReceiptText size={9} />
                                Purchase Order
                              </div>

                            </div>

                          </Link>

                        </td>

                        {/* JENIS */}

                        <td className="px-5 py-4 text-center">

                          {isOutlet ? (

                            <span className="inline-flex items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-blue-700">
                              <Store size={12} />
                              Outlet
                            </span>

                          ) : (

                            <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#D8E9E2] bg-[#EAF3EF] px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-[#497F70]">
                              <ShoppingCart size={12} />
                              Pusat
                            </span>

                          )}

                        </td>

                        {/* TANGGAL */}

                        <td className="px-5 py-4">

                          <div className="font-semibold text-gray-600">
                            {formatDate(
                              item.purchaseDate
                            )}
                          </div>

                        </td>

                        {/* SUPPLIER */}

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-3">

                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F2F6F4] text-[#497F70]">
                              <Truck size={16} />
                            </div>

                            <div className="min-w-0">

                              <div className="max-w-[190px] truncate font-bold text-gray-700">
                                {item.supplier?.name ||
                                  "-"}
                              </div>

                              {item.supplier?.code && (
                                <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">
                                  {item.supplier.code}
                                </div>
                              )}

                            </div>

                          </div>

                        </td>

                        {/* TUJUAN */}

                        <td className="px-5 py-4">

                          {isOutlet ? (

                            <div className="flex items-center gap-3">

                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                <Store size={16} />
                              </div>

                              <div className="min-w-0">

                                <div className="max-w-[180px] truncate font-bold text-gray-700">
                                  {item.outlet?.name ||
                                    item.destinationName ||
                                    "-"}
                                </div>

                                {(item.outlet?.code ||
                                  item.destinationCode) && (

                                  <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">
                                    {item.outlet?.code ||
                                      item.destinationCode}
                                  </div>

                                )}

                              </div>

                            </div>

                          ) : (

                            <div className="flex items-center gap-2">

                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3F6F4] text-gray-400">
                                <Database size={14} />
                              </div>

                              <span className="text-xs font-bold text-gray-500">
                                Gudang Pusat
                              </span>

                            </div>

                          )}

                        </td>

                        {/* PAYMENT */}

                        <td className="px-5 py-4">

                          <PaymentBadge
                            method={paymentMethod}
                          />

                        </td>

                        {/* TOTAL */}

                        <td className="px-5 py-4 text-right">

                          <div className="font-black tracking-tight text-[#18352D]">
                            Rp{" "}
                            {formatRupiah(
                              item.total
                            )}
                          </div>

                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-4 text-center">

                          <StatusBadge
                            status={
                              item.status
                            }
                          />

                        </td>

                        {/* ACTION */}

                        <td className="px-5 py-4">

                          <div className="flex flex-wrap items-center justify-center gap-1.5">

                            {/* DETAIL */}

                            <Link
                              href={
                                isOutlet
                                  ? `/outlet/purchase/${item.id}`
                                  : `/purchase/${item.id}`
                              }
                              title="Detail Purchase"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE8E3] bg-white px-2.5 py-2 text-[10px] font-extrabold text-[#497F70] shadow-sm transition-all hover:border-[#BFD4CB] hover:bg-[#EAF3EF]"
                            >
                              <Eye size={13} />
                              Detail
                            </Link>

                            {/* DELETE */}

                            {item.status ===
                              "DRAFT" && (

                              <button
                                type="button"
                                onClick={() =>
                                  deletePurchase(
                                    item.id,
                                    item.number,
                                    purchaseSource
                                  )
                                }
                                title={
                                  isOutlet
                                    ? "Hapus Purchase Outlet Draft"
                                    : "Hapus Purchase Pusat Draft"
                                }
                                className="inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-2.5 py-2 text-[10px] font-extrabold text-white shadow-sm transition-all hover:bg-red-600 hover:shadow-md"
                              >
                                <Trash2
                                  size={13}
                                />
                                Delete
                              </button>

                            )}

                            {/* RECEIVE */}

                            {!isOutlet &&
                              item.status ===
                                "APPROVED" && (

                                <button
                                  type="button"
                                  onClick={() =>
                                    receivePurchase(
                                      item.id
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-2.5 py-2 text-[10px] font-extrabold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md"
                                >
                                  <PackageCheck
                                    size={13}
                                  />
                                  Receive
                                </button>

                              )}

                            {isOutlet &&
                              item.status ===
                                "APPROVED" && (

                                <Link
                                  href={`/outlet/purchase/${item.id}`}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-2.5 py-2 text-[10px] font-extrabold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md"
                                >
                                  <PackageCheck
                                    size={13}
                                  />
                                  Receive
                                </Link>

                              )}

                            {/* PRINT */}

                            <a
                              href={
                                isOutlet
                                  ? `/outlet/purchase/print?id=${item.id}`
                                  : `/purchase/print?id=${item.id}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Print Purchase Order"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE8E3] bg-white px-2.5 py-2 text-[10px] font-extrabold text-gray-500 shadow-sm transition-all hover:border-[#BFD4CB] hover:bg-[#F5F8F6] hover:text-[#497F70]"
                            >
                              <Printer size={13} />
                              Print
                            </a>

                          </div>

                        </td>

                      </tr>
                    );
                  }
                )

              )}

            </tbody>

          </table>

        </div>

        {/* ===================================================
            TABLE FOOTER
        =================================================== */}

        {!loading &&
          filteredPurchase.length > 0 && (

            <div className="flex flex-col gap-3 border-t border-[#E7EEEA] bg-[#FAFCFB] px-5 py-4 text-xs sm:flex-row sm:items-center sm:justify-between md:px-6">

              <div className="flex items-center gap-2 text-gray-400">

                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500">
                  <ShieldCheck size={14} />
                </div>

                <span className="font-medium">
                  Data Purchase Order berhasil dimuat
                </span>

              </div>

              <div className="flex flex-wrap items-center gap-4">

                <span className="text-gray-400">
                  Total:
                  {" "}
                  <strong className="text-[#35564C]">
                    {filteredPurchase.length}
                  </strong>
                </span>

                <span className="hidden h-4 w-px bg-[#DCE7E1] sm:block" />

                <span className="font-black text-[#497F70]">
                  Rp{" "}
                  {formatRupiah(
                    filteredPurchase.reduce(
                      (sum, item) =>
                        sum +
                        Number(
                          item.total || 0
                        ),
                      0
                    )
                  )}
                </span>

                <span className="hidden h-4 w-px bg-[#DCE7E1] sm:block" />

                <span className="flex items-center gap-1.5 font-semibold text-gray-400">
                  <CreditCard size={13} />
                  {filteredPurchase.filter(
                    (item) =>
                      !!getPaymentMethod(item)
                  ).length}{" "}
                  dengan metode pembayaran
                </span>

              </div>

            </div>

          )}

      </div>

    </div>
  );
}