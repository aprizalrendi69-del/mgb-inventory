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
  ChevronDown,
  Database,
  Sparkles,
  CreditCard,
  Banknote,
  WalletCards,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Activity,
  X,
  SlidersHorizontal,
  TrendingUp,
  PackageOpen,
  Building2,
  CalendarDays,
  MoreHorizontal,
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

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    dot: string;
    bg: string;
    text: string;
    border: string;
  }
> = {
  DRAFT: {
    label: "Draft",
    dot: "bg-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  APPROVED: {
    label: "Approved",
    dot: "bg-blue-500",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  RECEIVED: {
    label: "Received",
    dot: "bg-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  COMPLETED: {
    label: "Completed",
    dot: "bg-purple-500",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  CANCELLED: {
    label: "Cancelled",
    dot: "bg-red-500",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
  },
};

export default function PurchasePage() {
  const [purchase, setPurchase] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("SEMUA");
  const [source, setSource] = useState("SEMUA");
  const [paymentFilter, setPaymentFilter] = useState("SEMUA");

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

      if (!json.success || !Array.isArray(json.data)) {
        setPurchase([]);
        return;
      }

      const normalized: PurchaseRow[] = json.data.map(
        (item: any) => ({
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
        })
      );

      setPurchase(normalized);
    } catch (error) {
      console.error("PURCHASE ERROR:", error);
      setPurchase([]);
    } finally {
      setLoading(false);
    }
  }

  function getPaymentMethod(item: PurchaseRow) {
    const raw =
      item.paymentMethod ??
      item.payment_method ??
      item.paymentType ??
      item.payment;

    if (!raw) return null;

    return String(raw).trim().toUpperCase();
  }

  function paymentLabel(value: string | null) {
    if (!value) return "Belum Ditentukan";

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
        <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold text-slate-400">
          <ReceiptText size={12} />
          Belum Ditentukan
        </span>
      );
    }

    const normalized = method.toUpperCase();

    let icon = <WalletCards size={12} />;
    let className =
      "border-slate-200 bg-slate-50 text-slate-600";

    if (normalized === "CASH") {
      icon = <Banknote size={12} />;
      className =
        "border-emerald-100 bg-emerald-50 text-emerald-700";
    } else if (normalized === "TRANSFER") {
      icon = <Landmark size={12} />;
      className =
        "border-blue-100 bg-blue-50 text-blue-700";
    } else if (normalized === "QRIS") {
      icon = <CreditCard size={12} />;
      className =
        "border-purple-100 bg-purple-50 text-purple-700";
    } else if (
      normalized === "CARD" ||
      normalized === "DEBIT" ||
      normalized === "CREDIT"
    ) {
      icon = <CreditCard size={12} />;
      className =
        "border-indigo-100 bg-indigo-50 text-indigo-700";
    } else if (
      normalized === "COD" ||
      normalized === "CBD"
    ) {
      icon = <WalletCards size={12} />;
      className =
        "border-amber-100 bg-amber-50 text-amber-700";
    } else if (normalized === "TEMPO") {
      icon = <Clock3 size={12} />;
      className =
        "border-orange-100 bg-orange-50 text-orange-700";
    }

    return (
      <span
        className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${className}`}
      >
        {icon}
        {paymentLabel(normalized)}
      </span>
    );
  }

  async function deletePurchase(
    id: number,
    number: string,
    purchaseSource: "PUSAT" | "OUTLET"
  ) {
    const sourceLabel =
      purchaseSource === "OUTLET"
        ? "Purchase Order Outlet"
        : "Purchase Order Pusat";

    const ok = window.confirm(
      `Hapus ${sourceLabel} ${number || ""}?\n\nPurchase Order yang masih DRAFT akan dihapus permanen.`
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

      if (json.success) {
        window.alert(
          json.message ||
            `${sourceLabel} berhasil dihapus.`
        );

        await loadPurchase();
      } else {
        window.alert(
          json.message ||
            `Gagal menghapus ${sourceLabel}.`
        );
      }
    } catch (error) {
      console.error(
        "DELETE PURCHASE ERROR:",
        error
      );

      window.alert(
        `Terjadi kesalahan saat menghapus ${sourceLabel}.`
      );
    }
  }

  const filteredPurchase = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return purchase.filter((item) => {
      const itemSource =
        item.source === "OUTLET"
          ? "OUTLET"
          : "PUSAT";

      const paymentMethod =
        getPaymentMethod(item);

      const cocokSearch =
        !keyword ||
        item.number
          ?.toLowerCase()
          .includes(keyword) ||
        item.supplier?.name
          ?.toLowerCase()
          .includes(keyword) ||
        item.supplier?.code
          ?.toLowerCase()
          .includes(keyword) ||
        item.outlet?.name
          ?.toLowerCase()
          .includes(keyword) ||
        item.outlet?.code
          ?.toLowerCase()
          .includes(keyword) ||
        paymentMethod
          ?.toLowerCase()
          .includes(keyword);

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

  const totalPurchase = purchase.length;

  const totalPusat = purchase.filter(
    (item) => item.source !== "OUTLET"
  ).length;

  const totalOutlet = purchase.filter(
    (item) => item.source === "OUTLET"
  ).length;

  const totalDraft = purchase.filter(
    (item) => item.status === "DRAFT"
  ).length;

  const totalApproved = purchase.filter(
    (item) => item.status === "APPROVED"
  ).length;

  const totalReceived = purchase.filter(
    (item) =>
      item.status === "RECEIVED" ||
      item.status === "COMPLETED"
  ).length;

  const totalValue = purchase.reduce(
    (total, item) =>
      total + Number(item.total || 0),
    0
  );

  const paymentSummary = useMemo(() => {
    const summary: Record<string, number> = {};

    purchase.forEach((item) => {
      const method =
        getPaymentMethod(item) || "UNSET";

      summary[method] =
        (summary[method] || 0) + 1;
    });

    return summary;
  }, [purchase]);

  const availablePaymentMethods = useMemo(() => {
    const methods = new Set<string>();

    purchase.forEach((item) => {
      const method = getPaymentMethod(item);

      if (method) methods.add(method);
    });

    return Array.from(methods).sort();
  }, [purchase]);

  function formatRupiah(value: any) {
    return Number(value || 0).toLocaleString(
      "id-ID"
    );
  }

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

  function StatusBadge({
    status,
  }: {
    status: string;
  }) {
    const config =
      STATUS_CONFIG[status] ||
      {
        label: status || "Unknown",
        dot: "bg-slate-400",
        bg: "bg-slate-50",
        text: "text-slate-600",
        border: "border-slate-200",
      };

    return (
      <span
        className={`inline-flex items-center gap-2 rounded-lg border ${config.border} ${config.bg} px-2.5 py-1.5 text-[10px] font-extrabold ${config.text}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${config.dot}`}
        />
        {config.label}
      </span>
    );
  }

  const hasFilter =
    !!search ||
    status !== "SEMUA" ||
    source !== "SEMUA" ||
    paymentFilter !== "SEMUA";

  function resetFilter() {
    setSearch("");
    setStatus("SEMUA");
    setSource("SEMUA");
    setPaymentFilter("SEMUA");
  }

  return (
    <div className="min-h-full bg-[#F4F7F6] p-4 md:p-6 lg:p-8">

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="relative mb-6 overflow-hidden rounded-[30px] border border-[#D9E6E0] bg-white shadow-[0_18px_55px_rgba(24,53,45,0.07)]">

        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 -top-32 h-[330px] w-[330px] rounded-full bg-[#497F70]/10 blur-3xl" />
          <div className="absolute -bottom-32 left-[35%] h-[260px] w-[260px] rounded-full bg-emerald-100/50 blur-3xl" />

          <div className="absolute right-0 top-0 h-full w-[45%] opacity-40 [background-image:linear-gradient(rgba(73,127,112,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(73,127,112,0.08)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:linear-gradient(to_left,black,transparent)]" />
        </div>

        <div className="relative px-5 py-6 md:px-8 md:py-8">

          <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">

            <div className="flex items-start gap-4">

              <div className="relative shrink-0">

                <div className="flex h-[68px] w-[68px] items-center justify-center rounded-[22px] bg-gradient-to-br from-[#497F70] via-[#3B6D5F] to-[#18352D] text-white shadow-[0_16px_34px_rgba(73,127,112,0.28)]">
                  <ShoppingCart
                    size={29}
                    strokeWidth={1.7}
                  />
                </div>

                <div className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-[3px] border-white bg-emerald-500 text-white shadow-sm">
                  <Sparkles size={10} />
                </div>

              </div>

              <div className="min-w-0">

                <div className="mb-2 flex flex-wrap items-center gap-2">

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4E5DD] bg-[#EFF7F3] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#497F70]">
                    <Activity size={10} />
                    Procurement
                  </span>

                  <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-gray-400">
                    ERP / Purchase Management
                  </span>

                </div>

                <h1 className="text-[27px] font-black tracking-[-0.045em] text-[#18352D] md:text-[34px]">
                  Purchase Order
                </h1>

                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-gray-500">
                  Pusat kontrol procurement untuk memantau
                  Purchase Order pusat dan outlet, supplier,
                  tujuan pembelian, pembayaran, nilai transaksi,
                  hingga proses penerimaan barang.
                </p>

              </div>

            </div>

            <div className="flex flex-col gap-3 sm:flex-row">

              <div className="flex items-center gap-3 rounded-2xl border border-[#DCE8E3] bg-[#F8FBF9] px-4 py-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#497F70] shadow-sm">
                  <Database size={16} />
                </div>

                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-gray-400">
                    Procurement Database
                  </p>

                  <p className="mt-0.5 text-sm font-black text-[#35564C]">
                    {totalPurchase}
                    <span className="ml-1.5 text-xs font-semibold text-gray-400">
                      dokumen
                    </span>
                  </p>
                </div>

              </div>

              <Link
                href="/purchase/new"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#497F70] px-5 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(73,127,112,0.23)] transition-all hover:-translate-y-0.5 hover:bg-[#3D6D60] hover:shadow-[0_16px_34px_rgba(73,127,112,0.28)]"
              >
                <Plus
                  size={17}
                  className="transition-transform duration-300 group-hover:rotate-90"
                />
                Purchase Baru
                <ArrowUpRight
                  size={14}
                  className="opacity-60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </Link>

            </div>

          </div>

          {/* MINI METRICS */}

          <div className="mt-7 grid grid-cols-2 gap-2 border-t border-[#E7EFEB] pt-5 sm:grid-cols-4">

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                <ShoppingCart size={14} />
              </div>
              <div>
                <p className="text-[8px] font-black uppercase tracking-wider text-gray-400">
                  Pusat
                </p>
                <p className="text-sm font-black text-[#35564C]">
                  {totalPusat}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Store size={14} />
              </div>
              <div>
                <p className="text-[8px] font-black uppercase tracking-wider text-gray-400">
                  Outlet
                </p>
                <p className="text-sm font-black text-[#35564C]">
                  {totalOutlet}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Clock3 size={14} />
              </div>
              <div>
                <p className="text-[8px] font-black uppercase tracking-wider text-gray-400">
                  Draft
                </p>
                <p className="text-sm font-black text-[#35564C]">
                  {totalDraft}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <PackageCheck size={14} />
              </div>
              <div>
                <p className="text-[8px] font-black uppercase tracking-wider text-gray-400">
                  Received
                </p>
                <p className="text-sm font-black text-[#35564C]">
                  {totalReceived}
                </p>
              </div>
            </div>

          </div>

        </div>

      </section>

      {/* =====================================================
          KPI GRID
      ===================================================== */}

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="group relative overflow-hidden rounded-[23px] border border-[#DCE8E3] bg-white p-5 shadow-[0_7px_28px_rgba(24,53,45,0.045)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(24,53,45,0.09)]">

          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#497F70]/5 transition-transform duration-500 group-hover:scale-150" />

          <div className="relative flex items-start justify-between">

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-400">
                Total Purchase
              </p>

              <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#18352D]">
                {totalPurchase}
              </p>

              <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-gray-400">
                <TrendingUp size={11} className="text-emerald-500" />
                Seluruh dokumen procurement
              </div>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <FileText size={20} strokeWidth={1.8} />
            </div>

          </div>

        </div>

        <div className="group relative overflow-hidden rounded-[23px] border border-[#DCE8E3] bg-white p-5 shadow-[0_7px_28px_rgba(24,53,45,0.045)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(24,53,45,0.09)]">

          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/5 transition-transform duration-500 group-hover:scale-150" />

          <div className="relative flex items-start justify-between">

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-400">
                Purchase Pusat
              </p>

              <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-blue-600">
                {totalPusat}
              </p>

              <p className="mt-2 text-[10px] font-semibold text-gray-400">
                Procurement gudang pusat
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Building2 size={20} strokeWidth={1.8} />
            </div>

          </div>

        </div>

        <div className="group relative overflow-hidden rounded-[23px] border border-[#DCE8E3] bg-white p-5 shadow-[0_7px_28px_rgba(24,53,45,0.045)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(24,53,45,0.09)]">

          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-indigo-500/5 transition-transform duration-500 group-hover:scale-150" />

          <div className="relative flex items-start justify-between">

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-400">
                Purchase Outlet
              </p>

              <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-indigo-600">
                {totalOutlet}
              </p>

              <p className="mt-2 text-[10px] font-semibold text-gray-400">
                Procurement langsung outlet
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Store size={20} strokeWidth={1.8} />
            </div>

          </div>

        </div>

        <div className="relative overflow-hidden rounded-[23px] border border-[#18352D] bg-gradient-to-br from-[#18352D] via-[#244D41] to-[#497F70] p-5 text-white shadow-[0_12px_35px_rgba(24,53,45,0.16)]">

          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-sm" />

          <div className="relative flex items-start justify-between">

            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/50">
                Total Nilai Purchase
              </p>

              <p className="mt-2 truncate text-[22px] font-black tracking-[-0.04em]">
                Rp {formatRupiah(totalValue)}
              </p>

              <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-white/55">
                <CircleDollarSign size={11} />
                Nilai seluruh PO
              </p>
            </div>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <CircleDollarSign size={20} />
            </div>

          </div>

        </div>

      </section>

      {/* =====================================================
          WORKFLOW SUMMARY
      ===================================================== */}

      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">

        <div className="rounded-[23px] border border-[#DCE8E3] bg-white p-5 shadow-[0_7px_28px_rgba(24,53,45,0.04)]">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Clock3 size={18} />
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">
                  Menunggu Approval
                </p>

                <p className="mt-0.5 text-xl font-black text-[#18352D]">
                  {totalDraft}
                  <span className="ml-1.5 text-[10px] font-bold text-gray-400">
                    PO
                  </span>
                </p>
              </div>
            </div>

            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-black text-amber-600">
              DRAFT
            </span>

          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{
                width:
                  totalPurchase > 0
                    ? `${Math.min(
                        100,
                        (totalDraft /
                          totalPurchase) *
                          100
                      )}%`
                    : "0%",
              }}
            />
          </div>

        </div>

        <div className="rounded-[23px] border border-[#DCE8E3] bg-white p-5 shadow-[0_7px_28px_rgba(24,53,45,0.04)]">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <CheckCircle2 size={18} />
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">
                  Siap Diterima
                </p>

                <p className="mt-0.5 text-xl font-black text-[#18352D]">
                  {totalApproved}
                  <span className="ml-1.5 text-[10px] font-bold text-gray-400">
                    PO
                  </span>
                </p>
              </div>
            </div>

            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-black text-blue-600">
              APPROVED
            </span>

          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{
                width:
                  totalPurchase > 0
                    ? `${Math.min(
                        100,
                        (totalApproved /
                          totalPurchase) *
                          100
                      )}%`
                    : "0%",
              }}
            />
          </div>

        </div>

        <div className="rounded-[23px] border border-[#DCE8E3] bg-white p-5 shadow-[0_7px_28px_rgba(24,53,45,0.04)]">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <PackageOpen size={18} />
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">
                  Sudah Diterima
                </p>

                <p className="mt-0.5 text-xl font-black text-[#18352D]">
                  {totalReceived}
                  <span className="ml-1.5 text-[10px] font-bold text-gray-400">
                    PO
                  </span>
                </p>
              </div>
            </div>

            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-600">
              RECEIVED
            </span>

          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{
                width:
                  totalPurchase > 0
                    ? `${Math.min(
                        100,
                        (totalReceived /
                          totalPurchase) *
                          100
                      )}%`
                    : "0%",
              }}
            />
          </div>

        </div>

      </section>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <section className="overflow-hidden rounded-[28px] border border-[#DCE8E3] bg-white shadow-[0_14px_48px_rgba(24,53,45,0.06)]">

        {/* HEADER */}

        <div className="border-b border-[#E7EEEA] px-5 py-5 md:px-6">

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <Layers3 size={18} />
              </div>

              <div>
                <h2 className="text-base font-black tracking-tight text-[#18352D]">
                  Purchase Order
                </h2>

                <p className="mt-0.5 text-[10px] text-gray-400">
                  Daftar procurement dan status penerimaan
                </p>
              </div>

            </div>

            <div className="flex items-center gap-2">

              <div className="hidden items-center gap-2 rounded-xl bg-[#F7FAF8] px-3 py-2 sm:flex">
                <Activity
                  size={13}
                  className="text-[#497F70]"
                />
                <span className="text-[10px] font-bold text-gray-500">
                  {filteredPurchase.length} ditampilkan
                </span>
              </div>

              <button
                type="button"
                onClick={loadPurchase}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-[#DCE8E3] bg-white px-3.5 py-2.5 text-xs font-black text-gray-600 transition-all hover:border-[#BFD4CB] hover:bg-[#F7FAF8] hover:text-[#497F70] disabled:cursor-not-allowed disabled:opacity-50"
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

          {/* FILTER */}

          <div className="mt-5 rounded-[20px] border border-[#E2EBE6] bg-[#F7FAF8] p-3">

            <div className="mb-3 flex items-center justify-between">

              <div className="flex items-center gap-2">
                <SlidersHorizontal
                  size={14}
                  className="text-[#497F70]"
                />
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-500">
                  Filter & Search
                </span>
              </div>

              {hasFilter && (
                <button
                  type="button"
                  onClick={resetFilter}
                  className="inline-flex items-center gap-1 text-[9px] font-black text-[#497F70] hover:text-[#315E51]"
                >
                  <X size={11} />
                  Reset
                </button>
              )}

            </div>

            <div className="flex flex-col gap-2.5 xl:flex-row">

              <div className="relative min-w-0 flex-1">

                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Cari No PO, supplier, outlet, metode pembayaran..."
                  className="w-full rounded-xl border border-[#DCE7E1] bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-[#35564C] outline-none transition-all placeholder:text-gray-400 focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                />

              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:flex">

                <FilterSelect
                  value={source}
                  onChange={setSource}
                  options={[
                    ["SEMUA", "Semua Purchase"],
                    ["PUSAT", "Purchase Pusat"],
                    ["OUTLET", "Purchase Outlet"],
                  ]}
                />

                <FilterSelect
                  value={status}
                  onChange={setStatus}
                  options={[
                    ["SEMUA", "Semua Status"],
                    ["DRAFT", "Draft"],
                    ["APPROVED", "Approved"],
                    ["RECEIVED", "Received"],
                    ["COMPLETED", "Completed"],
                    ["CANCELLED", "Cancelled"],
                  ]}
                />

                <FilterSelect
                  value={paymentFilter}
                  onChange={setPaymentFilter}
                  options={[
                    ["SEMUA", "Semua Pembayaran"],
                    ...availablePaymentMethods.map(
                      (method) => [
                        method,
                        paymentLabel(method),
                      ] as [string, string]
                    ),
                  ]}
                />

              </div>

            </div>

          </div>

          <div className="mt-4 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-2 text-gray-400">
              <span>Menampilkan</span>

              <span className="rounded-lg bg-[#EAF3EF] px-2 py-1 font-black text-[#497F70]">
                {filteredPurchase.length}
              </span>

              <span>dari</span>

              <strong className="text-[#35564C]">
                {purchase.length}
              </strong>

              <span>Purchase Order</span>
            </div>

            {hasFilter && (
              <button
                type="button"
                onClick={resetFilter}
                className="font-black text-[#497F70] transition hover:text-[#315E51]"
              >
                Reset semua filter
              </button>
            )}

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="min-w-[1450px] w-full text-sm">

            <thead>
              <tr className="border-b border-[#E4ECE8] bg-[#F8FAF9]">

                {[
                  ["No", "text-left"],
                  ["Purchase Order", "text-left"],
                  ["Jenis", "text-center"],
                  ["Tanggal", "text-left"],
                  ["Supplier", "text-left"],
                  ["Tujuan", "text-left"],
                  ["Pembayaran", "text-left"],
                  ["Total", "text-right"],
                  ["Status", "text-center"],
                  ["Aksi", "text-center"],
                ].map(([label, align]) => (
                  <th
                    key={label}
                    className={`px-5 py-3.5 ${align} text-[8px] font-black uppercase tracking-[0.16em] text-gray-400`}
                  >
                    {label}
                  </th>
                ))}

              </tr>
            </thead>

            <tbody>

              {loading ? (

                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-24 text-center"
                  >
                    <div className="flex flex-col items-center">

                      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#EAF3EF] text-[#497F70]">
                        <RefreshCw
                          size={24}
                          className="animate-spin"
                        />
                      </div>

                      <p className="font-black text-[#35564C]">
                        Memuat Purchase Order
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Mengambil data procurement terbaru...
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

                      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#EAF3EF] text-[#497F70]">
                        <ShoppingCart size={27} />
                      </div>

                      <p className="font-black text-[#35564C]">
                        Tidak ada Purchase Order
                      </p>

                      <p className="mt-1 max-w-sm text-xs leading-5 text-gray-400">
                        Tidak ditemukan Purchase Order
                        yang sesuai dengan pencarian
                        atau filter yang dipilih.
                      </p>

                      {hasFilter && (
                        <button
                          type="button"
                          onClick={resetFilter}
                          className="mt-4 rounded-xl bg-[#497F70] px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-[#497F70]/15 transition hover:bg-[#3D6D60]"
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

                    const detailHref =
                      isOutlet
                        ? `/outlet/purchase/${item.id}`
                        : `/purchase/${item.id}`;

                    const receiveHref =
                      isOutlet
                        ? "/outlet/barang-masuk"
                        : "/barang-masuk";

                    return (
                      <tr
                        key={`${purchaseSource}-${item.id}`}
                        className="group border-b border-[#EDF2EF] transition-colors hover:bg-[#FAFCFB]"
                      >

                        {/* NO */}

                        <td className="px-5 py-4">
                          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-[#F3F6F4] px-2 text-[9px] font-black text-gray-400">
                            {String(
                              index + 1
                            ).padStart(2, "0")}
                          </span>
                        </td>

                        {/* PO */}

                        <td className="px-5 py-4">

                          <Link
                            href={detailHref}
                            className="group/po flex w-fit items-center gap-3"
                          >

                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70] transition-all group-hover/po:bg-[#DDECE6] group-hover/po:shadow-sm">
                              <FileText size={16} />
                            </div>

                            <div>
                              <p className="font-black text-[#18352D] transition-colors group-hover/po:text-[#497F70]">
                                {item.number || "-"}
                              </p>

                              <div className="mt-0.5 flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.12em] text-gray-400">
                                <ReceiptText size={9} />
                                Purchase Order
                              </div>
                            </div>

                          </Link>

                        </td>

                        {/* JENIS */}

                        <td className="px-5 py-4 text-center">

                          {isOutlet ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide text-blue-700">
                              <Store size={11} />
                              Outlet
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8E9E2] bg-[#EAF3EF] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide text-[#497F70]">
                              <Building2 size={11} />
                              Pusat
                            </span>
                          )}

                        </td>

                        {/* DATE */}

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-2">

                            <CalendarDays
                              size={14}
                              className="text-gray-300"
                            />

                            <span className="font-semibold text-gray-600">
                              {formatDate(
                                item.purchaseDate
                              )}
                            </span>

                          </div>

                        </td>

                        {/* SUPPLIER */}

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-3">

                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F2F6F4] text-[#497F70]">
                              <Truck size={15} />
                            </div>

                            <div className="min-w-0">

                              <div className="max-w-[190px] truncate font-bold text-gray-700">
                                {item.supplier?.name ||
                                  "-"}
                              </div>

                              {item.supplier?.code && (
                                <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-gray-400">
                                  {item.supplier.code}
                                </div>
                              )}

                            </div>

                          </div>

                        </td>

                        {/* DESTINATION */}

                        <td className="px-5 py-4">

                          {isOutlet ? (

                            <div className="flex items-center gap-3">

                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                <Store size={15} />
                              </div>

                              <div className="min-w-0">

                                <div className="max-w-[180px] truncate font-bold text-gray-700">
                                  {item.outlet?.name ||
                                    item.destinationName ||
                                    "-"}
                                </div>

                                {(item.outlet?.code ||
                                  item.destinationCode) && (
                                  <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-gray-400">
                                    {item.outlet?.code ||
                                      item.destinationCode}
                                  </div>
                                )}

                              </div>

                            </div>

                          ) : (

                            <div className="flex items-center gap-2">

                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3F6F4] text-gray-400">
                                <Database size={13} />
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

                          <div className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-gray-400">
                            Nilai PO
                          </div>

                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-4 text-center">
                          <StatusBadge
                            status={item.status}
                          />
                        </td>

                        {/* ACTION */}

                        <td className="px-5 py-4">

                          <div className="flex items-center justify-center gap-1.5">

                            <Link
                              href={detailHref}
                              title="Detail Purchase"
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#DCE8E3] bg-white px-2.5 text-[9px] font-black text-[#497F70] shadow-sm transition hover:border-[#BFD4CB] hover:bg-[#EAF3EF]"
                            >
                              <Eye size={12} />
                              Detail
                            </Link>

                            {item.status ===
                              "APPROVED" && (
                              <Link
                                href={receiveHref}
                                title={
                                  isOutlet
                                    ? "Barang Masuk Outlet"
                                    : "Barang Masuk Pusat"
                                }
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-[9px] font-black text-white shadow-sm transition hover:bg-emerald-700"
                              >
                                <PackageCheck
                                  size={12}
                                />
                                Receive
                              </Link>
                            )}

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
                                title="Hapus Purchase Draft"
                                className="inline-flex h-8 items-center justify-center rounded-lg bg-red-500 px-2.5 text-[9px] font-black text-white shadow-sm transition hover:bg-red-600"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}

                            <a
                              href={
                                isOutlet
                                  ? `/outlet/purchase/print?id=${item.id}`
                                  : `/purchase/print?id=${item.id}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Print Purchase Order"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCE8E3] bg-white text-gray-500 shadow-sm transition hover:border-[#BFD4CB] hover:bg-[#F5F8F6] hover:text-[#497F70]"
                            >
                              <Printer size={12} />
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

        {/* FOOTER */}

        {!loading &&
          filteredPurchase.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-[#E7EEEA] bg-[#FAFCFB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">

              <div className="flex items-center gap-2">

                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500">
                  <ShieldCheck size={13} />
                </div>

                <span className="text-[10px] font-semibold text-gray-400">
                  Data Purchase Order berhasil dimuat
                </span>

              </div>

              <div className="flex flex-wrap items-center gap-4 text-[10px]">

                <span className="text-gray-400">
                  Total{" "}
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
                  <CreditCard size={12} />
                  {
                    filteredPurchase.filter(
                      (item) =>
                        !!getPaymentMethod(item)
                    ).length
                  }{" "}
                  dengan pembayaran
                </span>

              </div>

            </div>
          )}

      </section>

    </div>
  );
}

/* =========================================================
   FILTER SELECT
========================================================= */

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="relative">

      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="w-full min-w-[155px] appearance-none rounded-xl border border-[#DCE7E1] bg-white px-4 py-2.5 pr-10 text-sm font-semibold text-gray-600 outline-none transition-all hover:border-[#BFD4CB] focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
      >
        {options.map(
          ([optionValue, label]) => (
            <option
              key={optionValue}
              value={optionValue}
            >
              {label}
            </option>
          )
        )}
      </select>

      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
      />

    </div>
  );
}