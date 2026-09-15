"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Hash,
  Info,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  Printer,
  RefreshCw,
  Send,
  ShieldCheck,
  Truck,
  UserRound,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { exportSuratJalanPDF } from "@/lib/exportSuratJalanPdf";
import { exportSuratJalanExcel } from "@/lib/exportSuratJalanExcel";

/* =========================================================
   TYPES
========================================================= */

type Barang = {
  id: number;
  code?: string | null;
  barcode?: string | null;
  name?: string | null;
  unit?: string | null;
  sellingPrice?: number | null;
  purchasePrice?: number | null;
};

type Customer = {
  id: number;
  code?: string | null;
  name?: string | null;
};

type Outlet = {
  id: number;
  code?: string | null;
  name?: string | null;
};

type SuratJalan = {
  id: number;
  number: string;
  driver?: string | null;
  vehicleNumber?: string | null;
  expedition?: string | null;
  receiver?: string | null;
  receiveDate?: string | null;
};

type DeliveryItem = {
  id: number;
  barangId: number;
  qty: number;
  price?: number | null;
  subtotal?: number | null;
  note?: string | null;

  voided?: boolean;
  voidedAt?: string | null;
  voidedById?: number | null;
  voidReason?: string | null;

  isVoided?: boolean;
  isReceived?: boolean;
  isPartial?: boolean;

  barang?: Barang | null;
};

type Delivery = {
  id: number;
  number: string;
  deliveryDate: string;
  status: string;
  remarks?: string | null;
  totalQty?: number | null;

  customer?: Customer | null;
  outlet?: Outlet | null;
  suratJalan?: SuratJalan | null;

  items: DeliveryItem[];

  createdAt?: string | null;
  updatedAt?: string | null;

  releasedAt?: string | null;
  releasedBy?: {
    id?: number;
    username?: string | null;
    fullname?: string | null;
  } | null;

  receivedAt?: string | null;
  receivedBy?: {
    id?: number;
    username?: string | null;
    fullname?: string | null;
  } | null;

  deliveryStatus?: string | null;
};

/* =========================================================
   HELPERS
========================================================= */

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: unknown): string {
  return num(value).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  });
}

function formatCurrency(value: unknown): string {
  return `Rp ${num(value).toLocaleString("id-ID", {
    maximumFractionDigits: 0,
  })}`;
}

function formatDate(value?: string | null): string {
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

function formatDateTime(value?: string | null): string {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getItemVoided(item: DeliveryItem): boolean {
  return Boolean(item.voided || item.isVoided);
}

function getStatusLabel(status?: string | null): string {
  const value = String(status || "").toUpperCase();

  switch (value) {
    case "DRAFT":
      return "Draft";

    case "APPROVED":
      return "Approved";

    case "RELEASED":
      return "Released";

    case "DELIVERED":
      return "Delivered";

    case "RECEIVED":
      return "Received";

    case "SELESAI":
      return "Selesai";

    case "CANCELLED":
      return "Cancelled";

    default:
      return value || "-";
  }
}

/* =========================================================
   STATUS STYLE
========================================================= */

function getStatusConfig(status?: string | null) {
  const value = String(status || "").toUpperCase();

  switch (value) {
    case "DRAFT":
      return {
        label: "DRAFT",
        icon: Clock3,
        wrapper:
          "border-amber-200 bg-amber-50 text-amber-700",
        dot: "bg-amber-500",
        description: "Dokumen masih dapat diproses",
      };

    case "APPROVED":
      return {
        label: "APPROVED",
        icon: BadgeCheck,
        wrapper:
          "border-blue-200 bg-blue-50 text-blue-700",
        dot: "bg-blue-500",
        description: "Dokumen telah disetujui",
      };

    case "RELEASED":
      return {
        label: "RELEASED",
        icon: Send,
        wrapper:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        dot: "bg-emerald-500",
        description: "Barang telah keluar dari gudang",
      };

    case "DELIVERED":
      return {
        label: "DELIVERED",
        icon: Truck,
        wrapper:
          "border-indigo-200 bg-indigo-50 text-indigo-700",
        dot: "bg-indigo-500",
        description: "Pengiriman telah dilakukan",
      };

    case "RECEIVED":
      return {
        label: "RECEIVED",
        icon: PackageCheck,
        wrapper:
          "border-green-200 bg-green-50 text-green-700",
        dot: "bg-green-500",
        description: "Barang telah diterima",
      };

    case "SELESAI":
      return {
        label: "SELESAI",
        icon: CheckCircle2,
        wrapper:
          "border-green-200 bg-green-50 text-green-700",
        dot: "bg-green-500",
        description: "Proses pengiriman selesai",
      };

    case "CANCELLED":
      return {
        label: "CANCELLED",
        icon: XCircle,
        wrapper:
          "border-red-200 bg-red-50 text-red-700",
        dot: "bg-red-500",
        description: "Dokumen dibatalkan",
      };

    default:
      return {
        label: value || "UNKNOWN",
        icon: Info,
        wrapper:
          "border-slate-200 bg-slate-50 text-slate-600",
        dot: "bg-slate-400",
        description: "Status dokumen",
      };
  }
}

/* =========================================================
   PAGE
========================================================= */

export default function SuratJalanDetailPage() {
  const params = useParams();
  const router = useRouter();

  const id = String(params?.id ?? "");

  const [data, setData] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [voidingItemId, setVoidingItemId] =
    useState<number | null>(null);
  const [showReleaseModal, setShowReleaseModal] =
    useState(false);

  /* =======================================================
     LOAD DETAIL
  ======================================================= */

  const load = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);

      const res = await fetch(
        `/api/delivery-order/${id}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil detail Delivery Order."
        );
      }

      setData(json.data);
    } catch (error: any) {
      console.error(
        "LOAD DELIVERY DETAIL ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal mengambil detail Delivery Order."
      );

      router.push("/surat-jalan");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  /* =======================================================
     CALCULATIONS
  ======================================================= */

  const activeItems = useMemo(() => {
    return (
      data?.items?.filter(
        (item) => !getItemVoided(item)
      ) ?? []
    );
  }, [data]);

  const voidedItems = useMemo(() => {
    return (
      data?.items?.filter(
        (item) => getItemVoided(item)
      ) ?? []
    );
  }, [data]);

  const totalQty = useMemo(() => {
    return activeItems.reduce(
      (total, item) =>
        total + num(item.qty),
      0
    );
  }, [activeItems]);

  const totalAllQty = useMemo(() => {
    return (
      data?.items?.reduce(
        (total, item) =>
          total + num(item.qty),
        0
      ) ?? 0
    );
  }, [data]);

  const totalValue = useMemo(() => {
    return activeItems.reduce(
      (total, item) => {
        const qty = num(item.qty);
        const price = num(item.price);

        return total + qty * price;
      },
      0
    );
  }, [activeItems]);

  const voidedQty = useMemo(() => {
    return voidedItems.reduce(
      (total, item) =>
        total + num(item.qty),
      0
    );
  }, [voidedItems]);

  const isDraft =
    data?.status === "DRAFT";

  const isReleased =
    data?.status === "RELEASED";

  const statusConfig =
    getStatusConfig(data?.status);

  const StatusIcon = statusConfig.icon;

  /* =======================================================
     RELEASE DELIVERY
  ======================================================= */

  async function processDelivery() {
    if (!data || processing) return;

    if (data.status !== "DRAFT") {
      alert(
        "Delivery Order ini sudah diproses."
      );
      return;
    }

    if (!data.items?.length) {
      alert(
        "Delivery Order tidak memiliki item."
      );
      return;
    }

    setShowReleaseModal(false);

    try {
      setProcessing(true);

      const res = await fetch(
        `/api/delivery-order/${data.id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const json = await res
        .json()
        .catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal memproses pengiriman."
        );
      }

      alert(
        json.message ||
          "Delivery Order berhasil direlease."
      );

      await load();
    } catch (error: any) {
      console.error(
        "PROCESS DELIVERY ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal memproses pengiriman."
      );
    } finally {
      setProcessing(false);
    }
  }

  /* =======================================================
     VOID ITEM
  ======================================================= */

  async function processVoidItem(
    item: DeliveryItem
  ) {
    if (
      !data ||
      data.status !== "RELEASED" ||
      !item.id ||
      getItemVoided(item)
    ) {
      return;
    }

    const itemName =
      item.barang?.name ||
      "barang";

    const reason = window.prompt(
      `Alasan Void item "${itemName}":`
    );

    if (reason === null) {
      return;
    }

    const cleanReason =
      reason.trim();

    if (cleanReason.length < 3) {
      alert(
        "Alasan Void minimal 3 karakter."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Void item "${itemName}" sebanyak ${formatNumber(
          item.qty
        )}?\n\n` +
          `Stock pusat akan dikembalikan dan histori stock akan dicatat.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setVoidingItemId(item.id);

      const res = await fetch(
        `/api/delivery/${data.id}/items/${item.id}/void`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            reason: cleanReason,
          }),
        }
      );

      const json = await res
        .json()
        .catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal melakukan Void Item."
        );
      }

      alert(
        json.message ||
          "Item berhasil di-Void."
      );

      await load();
    } catch (error: any) {
      console.error(
        "VOID ITEM ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal melakukan Void Item."
      );
    } finally {
      setVoidingItemId(null);
    }
  }

  /* =======================================================
     WHATSAPP
     
     FORMAT:
     - Header perusahaan
     - Surat Jalan
     - Delivery Order
     - Tanggal
     - Tujuan
     - Kode Outlet
     - Detail barang hanya Nama + Qty
     - Grand Total
     - Status
     - Footer
  ======================================================= */

  function buildWhatsAppMessage() {
    if (!data) return "";

    const suratJalanNumber =
      data.suratJalan?.number ||
      data.number;

    const destination =
      data.outlet?.name ||
      data.customer?.name ||
      "-";

    const destinationCode =
      data.outlet?.code ||
      data.customer?.code ||
      "";

    const status =
      getStatusLabel(data.status);

    const lines: string[] = [];

    lines.push(
      "🏢 *PT. MITRA GARAM BOGATAMA*"
    );

    lines.push(
      "━━━━━━━━━━━━━━━━━━━━"
    );

    lines.push("");

    lines.push(
      "> 🚚 *SURAT JALAN PENGIRIMAN*"
    );

    lines.push("");

    lines.push(
      `No. Surat Jalan : *${suratJalanNumber}*`
    );

    lines.push(
      `Delivery Order  : *${data.number}*`
    );

    lines.push(
      `Tanggal         : *${formatDate(
        data.deliveryDate
      )}*`
    );

    lines.push(
      `Tujuan          : *${destination}*`
    );

    if (destinationCode) {
      lines.push(
        `Kode Outlet     : *${destinationCode}*`
      );
    }

    /* =====================================================
       DETAIL BARANG
       HANYA NAMA + QTY
    ===================================================== */

    lines.push("");

    lines.push(
      "> 📦 *DETAIL BARANG*"
    );

    lines.push(
      "━━━━━━━━━━━━━━━━━━━━"
    );

    if (activeItems.length === 0) {
      lines.push(
        "Tidak terdapat barang aktif."
      );
    } else {
activeItems.forEach((item, index) => {
  const itemName = item.barang?.name || "-";
  const qty = num(item.qty);
  const unit = item.barang?.unit || "unit";

  lines.push(
    `${String(index + 1).padStart(2, "0")}. *${itemName}* — *${formatNumber(qty)} ${unit}*`
  );
});

      if (
        lines[lines.length - 1] === ""
      ) {
        lines.pop();
      }
    }

    /* =====================================================
       RINGKASAN
    ===================================================== */

    lines.push("");

    lines.push(
      "> 💰 *RINGKASAN TRANSAKSI*"
    );

    lines.push(
      "━━━━━━━━━━━━━━━━━━━━"
    );

    lines.push(
      `Jenis Barang    : *${activeItems.length} jenis*`
    );

    lines.push(
      `Total Quantity  : *${formatNumber(
        totalQty
      )}*`
    );

    lines.push(
      `Grand Total     : *${formatCurrency(
        totalValue
      )}*`
    );

    lines.push(
      `Status          : *${status}*` 
    );

    /* =====================================================
       FOOTER
    ===================================================== */

    lines.push("");

    lines.push(
      "━━━━━━━━━━━━━━━━━━━━"
    );

    lines.push("");

    lines.push(
      "_Mohon dilakukan pengecekan jumlah dan kondisi barang pada saat penerimaan._"
    );

    lines.push("");

    lines.push(
      "_Terima kasih_ atas kerjasamanya."
    );

    lines.push("");

    lines.push(
      "🏢 *PT. MITRA GARAM BOGATAMA*"
    );

    lines.push(
      "_Referensi transaksi resmi MGB Inventory._"
    );

    return lines.join("\n");
  }

  function shareWhatsApp() {
    const message =
      buildWhatsAppMessage();

    const url =
      `https://web.whatsapp.com/send?text=${encodeURIComponent(
        message
      )}`;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  /* =======================================================
     PRINT
  ======================================================= */

  function printSuratJalan() {
    if (!data) return;

    window.open(
      `/surat-jalan/print?id=${data.id}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  /* =======================================================
     EXPORT PDF
  ======================================================= */

  function handleExportPDF() {
    if (!data) return;

    try {
      exportSuratJalanPDF(data);
    } catch (error) {
      console.error(
        "EXPORT PDF ERROR:",
        error
      );

      alert(
        "Gagal membuat PDF Surat Jalan."
      );
    }
  }

  /* =======================================================
     EXPORT EXCEL
  ======================================================= */

  function handleExportExcel() {
    if (!data) return;

    try {
      exportSuratJalanExcel(data);
    } catch (error) {
      console.error(
        "EXPORT EXCEL ERROR:",
        error
      );

      alert(
        "Gagal membuat Excel Surat Jalan."
      );
    }
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="min-h-full bg-[#F5F8F6]">
        <div className="mx-auto max-w-[1500px] p-5 md:p-8">
          <div className="mb-6 h-6 w-28 animate-pulse rounded-lg bg-slate-200" />

          <div className="overflow-hidden rounded-[28px] border border-[#DCE8E2] bg-white shadow-[0_20px_60px_rgba(31,61,49,0.07)]">
            <div className="h-56 animate-pulse bg-gradient-to-br from-[#DCEAE4] via-[#EAF3EF] to-white" />

            <div className="space-y-5 p-7">
              <div className="h-7 w-72 animate-pulse rounded-lg bg-slate-200" />

              <div className="h-4 w-96 max-w-full animate-pulse rounded-lg bg-slate-100" />

              <div className="grid gap-4 md:grid-cols-4">
                {Array.from({
                  length: 4,
                }).map((_, index) => (
                  <div
                    key={index}
                    className="h-28 animate-pulse rounded-2xl bg-slate-100"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-h-[220px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
              <RefreshCw className="h-5 w-5 animate-spin text-[#497F70]" />
              Memuat detail Surat Jalan...
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     DATA NOT FOUND
  ======================================================= */

  if (!data) {
    return (
      <div className="flex min-h-[500px] items-center justify-center bg-[#F5F8F6] p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
            <FileText className="h-7 w-7 text-slate-400" />
          </div>

          <h2 className="text-lg font-bold text-slate-800">
            Dokumen tidak ditemukan
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Delivery Order yang diminta
            tidak tersedia.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push("/surat-jalan")
            }
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#29483A] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#29483A]/15 transition hover:-translate-y-0.5 hover:bg-[#203C31]"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Surat Jalan
          </button>
        </div>
      </div>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-full bg-[#F5F8F6]">
      <div className="mx-auto max-w-[1550px] p-4 md:p-6 xl:p-8">

        {/* =================================================
            TOP NAV
        ================================================= */}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              router.push("/surat-jalan")
            }
            className="group inline-flex items-center gap-2 rounded-xl border border-[#D9E5DF] bg-white px-4 py-2.5 text-sm font-semibold text-[#35564C] shadow-sm transition hover:-translate-y-0.5 hover:border-[#BFD3CA] hover:bg-[#FBFDFC]"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Surat Jalan
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              title="Refresh"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#D9E5DF] bg-white text-[#497F70] shadow-sm transition hover:bg-[#F5FAF7] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  loading
                    ? "animate-spin"
                    : ""
                }`}
              />
            </button>

            <div className="hidden h-5 w-px bg-[#DDE7E2] md:block" />

            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Delivery Management
            </span>
          </div>
        </div>

        {/* =================================================
            PREMIUM HERO
        ================================================= */}

        <section className="relative mb-6 overflow-hidden rounded-[30px] border border-[#D6E5DE] bg-white shadow-[0_24px_70px_rgba(34,70,56,0.09)]">

          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-32 -top-40 h-[420px] w-[420px] rounded-full bg-[#E7F2ED] blur-3xl" />
            <div className="absolute -bottom-48 left-1/3 h-[360px] w-[360px] rounded-full bg-[#F0F6F3] blur-3xl" />
          </div>

          <div className="relative p-5 md:p-7 xl:p-8">

            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">

              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D6E6DF] bg-[#F5FAF7] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#497F70]">
                    <FileText className="h-3.5 w-3.5" />
                    Surat Jalan
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                    Delivery
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="break-all text-2xl font-black tracking-tight text-[#18352D] md:text-3xl xl:text-4xl">
                    {data.suratJalan?.number ||
                      data.number}
                  </h1>

                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-extrabold ${statusConfig.wrapper}`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${statusConfig.dot}`}
                    />
                    <StatusIcon className="h-4 w-4" />
                    {statusConfig.label}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <Hash className="h-4 w-4 text-[#719287]" />
                    <span>
                      Delivery Order:
                    </span>

                    <strong className="text-[#35564C]">
                      {data.number}
                    </strong>
                  </div>

                  <div className="hidden h-4 w-px bg-slate-200 md:block" />

                  <div className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-[#719287]" />
                    {formatDate(
                      data.deliveryDate
                    )}
                  </div>
                </div>

                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">
                  {statusConfig.description}.
                  Dokumen ini menjadi referensi
                  utama proses pengeluaran barang
                  dari gudang pusat menuju tujuan
                  pengiriman.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:max-w-[470px] xl:justify-end">

                {isDraft && (
                  <button
                    type="button"
                    onClick={() =>
                      setShowReleaseModal(true)
                    }
                    disabled={processing}
                    className="group inline-flex items-center gap-2 rounded-2xl bg-[#29483A] px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(41,72,58,0.22)] transition hover:-translate-y-0.5 hover:bg-[#203C31] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {processing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    )}

                    {processing
                      ? "Memproses..."
                      : "Proses Pengiriman"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={printSuratJalan}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#D9E5DF] bg-white px-4 py-3.5 text-sm font-bold text-[#35564C] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#F7FAF8]"
                >
                  <Printer className="h-4 w-4" />

                  <span className="hidden sm:inline">
                    Print
                  </span>
                </button>

                <button
                  type="button"
                  onClick={shareWhatsApp}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#D9E5DF] bg-white px-4 py-3.5 text-sm font-bold text-[#35564C] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#F7FAF8]"
                >
                  <Send className="h-4 w-4" />

                  <span className="hidden sm:inline">
                    WhatsApp
                  </span>
                </button>
              </div>
            </div>

            {/* =================================================
                STATUS TIMELINE
            ================================================= */}

            <div className="mt-8 rounded-2xl border border-[#E0EBE5] bg-[#F9FBFA] p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#78938A]">
                    Workflow
                  </div>

                  <div className="mt-1 text-sm font-bold text-[#29483A]">
                    Progress Pengiriman
                  </div>
                </div>

                <div className="hidden items-center gap-2 text-xs font-semibold text-slate-400 md:flex">
                  <ShieldCheck className="h-4 w-4 text-[#497F70]" />
                  Stock-controlled transaction
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">

                <div
                  className={`flex min-w-[130px] items-center gap-2 rounded-xl border px-3 py-2.5 ${
                    data.status ===
                    "DRAFT"
                      ? "border-amber-200 bg-amber-50"
                      : "border-[#DDE8E2] bg-white"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      data.status ===
                      "DRAFT"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-[#EAF3EF] text-[#497F70]"
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                  </div>

                  <div>
                    <div className="text-xs font-bold text-[#35564C]">
                      Draft
                    </div>

                    <div className="text-[10px] text-slate-400">
                      Dokumen
                    </div>
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />

                <div
                  className={`flex min-w-[150px] items-center gap-2 rounded-xl border px-3 py-2.5 ${
                    data.status ===
                    "RELEASED"
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-[#DDE8E2] bg-white"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      data.status ===
                      "RELEASED"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-[#EAF3EF] text-[#497F70]"
                    }`}
                  >
                    <Send className="h-4 w-4" />
                  </div>

                  <div>
                    <div className="text-xs font-bold text-[#35564C]">
                      Released
                    </div>

                    <div className="text-[10px] text-slate-400">
                      Stock keluar
                    </div>
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />

                <div
                  className={`flex min-w-[150px] items-center gap-2 rounded-xl border px-3 py-2.5 ${
                    ["RECEIVED", "SELESAI"].includes(
                      String(data.status).toUpperCase()
                    )
                      ? "border-green-200 bg-green-50"
                      : "border-[#DDE8E2] bg-white"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      ["RECEIVED", "SELESAI"].includes(
                        String(data.status).toUpperCase()
                      )
                        ? "bg-green-100 text-green-700"
                        : "bg-[#EAF3EF] text-[#497F70]"
                    }`}
                  >
                    <PackageCheck className="h-4 w-4" />
                  </div>

                  <div>
                    <div className="text-xs font-bold text-[#35564C]">
                      Received
                    </div>

                    <div className="text-[10px] text-slate-400">
                      Tujuan terima
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================
            SUMMARY CARDS
        ================================================= */}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <div className="group relative overflow-hidden rounded-[22px] border border-[#DDE9E3] bg-white p-5 shadow-[0_10px_30px_rgba(35,70,55,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_15px_35px_rgba(35,70,55,0.08)]">
            <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-[#EAF3EF] blur-2xl transition group-hover:scale-125" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                  <Package className="h-5 w-5" />
                </div>

                <span className="rounded-full bg-[#F4F8F6] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#719287]">
                  Items
                </span>
              </div>

              <div className="mt-5">
                <div className="text-3xl font-black tracking-tight text-[#18352D]">
                  {formatNumber(
                    activeItems.length
                  )}
                </div>

                <div className="mt-1 text-xs font-semibold text-slate-400">
                  Jenis barang aktif
                </div>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-[22px] border border-[#DDE9E3] bg-white p-5 shadow-[0_10px_30px_rgba(35,70,55,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_15px_35px_rgba(35,70,55,0.08)]">
            <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-[#EAF3EF] blur-2xl transition group-hover:scale-125" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                  <BoxesIcon />
                </div>

                <span className="rounded-full bg-[#F4F8F6] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#719287]">
                  Qty
                </span>
              </div>

              <div className="mt-5">
                <div className="text-3xl font-black tracking-tight text-[#18352D]">
                  {formatNumber(
                    totalQty
                  )}
                </div>

                <div className="mt-1 text-xs font-semibold text-slate-400">
                  Total quantity aktif
                </div>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-[22px] border border-[#DDE9E3] bg-white p-5 shadow-[0_10px_30px_rgba(35,70,55,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_15px_35px_rgba(35,70,55,0.08)]">
            <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-[#EAF3EF] blur-2xl transition group-hover:scale-125" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                  <Hash className="h-5 w-5" />
                </div>

                <span className="rounded-full bg-[#F4F8F6] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#719287]">
                  Value
                </span>
              </div>

              <div className="mt-5">
                <div className="truncate text-2xl font-black tracking-tight text-[#18352D]">
                  {formatCurrency(
                    totalValue
                  )}
                </div>

                <div className="mt-1 text-xs font-semibold text-slate-400">
                  Nilai barang aktif
                </div>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-[22px] border border-[#DDE9E3] bg-white p-5 shadow-[0_10px_30px_rgba(35,70,55,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_15px_35px_rgba(35,70,55,0.08)]">
            <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-red-50 blur-2xl transition group-hover:scale-125" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                  <XCircle className="h-5 w-5" />
                </div>

                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-500">
                  Void
                </span>
              </div>

              <div className="mt-5">
                <div className="text-3xl font-black tracking-tight text-[#18352D]">
                  {formatNumber(
                    voidedQty
                  )}
                </div>

                <div className="mt-1 text-xs font-semibold text-slate-400">
                  Qty item di-void
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================
            MAIN GRID
        ================================================= */}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">

          <div className="min-w-0 space-y-6">

            {/* DOCUMENT INFO */}

            <section className="overflow-hidden rounded-[26px] border border-[#DDE9E3] bg-white shadow-[0_12px_35px_rgba(35,70,55,0.05)]">

              <div className="border-b border-[#E8EFEB] px-5 py-5 md:px-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#78938A]">
                      Document Overview
                    </div>

                    <h2 className="mt-1 text-lg font-black text-[#18352D]">
                      Informasi Pengiriman
                    </h2>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                    <Truck className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="grid gap-px bg-[#E8EFEB] md:grid-cols-2">

                <InfoCell
                  icon={
                    <FileText className="h-4 w-4" />
                  }
                  label="Delivery Order"
                  value={data.number}
                />

                <InfoCell
                  icon={
                    <CalendarDays className="h-4 w-4" />
                  }
                  label="Tanggal Pengiriman"
                  value={formatDate(
                    data.deliveryDate
                  )}
                />

                <InfoCell
                  icon={
                    <Building2 className="h-4 w-4" />
                  }
                  label="Tujuan Outlet"
                  value={
                    data.outlet?.name ||
                    "-"
                  }
                  secondary={
                    data.outlet?.code ||
                    undefined
                  }
                />

                <InfoCell
                  icon={
                    <Users className="h-4 w-4" />
                  }
                  label="Customer"
                  value={
                    data.customer?.name ||
                    "-"
                  }
                  secondary={
                    data.customer?.code ||
                    undefined
                  }
                />

                <InfoCell
                  icon={
                    <Truck className="h-4 w-4" />
                  }
                  label="Nomor Surat Jalan"
                  value={
                    data.suratJalan?.number ||
                    "-"
                  }
                />

                <InfoCell
                  icon={
                    <UserRound className="h-4 w-4" />
                  }
                  label="Driver"
                  value={
                    data.suratJalan?.driver ||
                    "-"
                  }
                />

                <InfoCell
                  icon={
                    <Truck className="h-4 w-4" />
                  }
                  label="Kendaraan"
                  value={
                    data.suratJalan
                      ?.vehicleNumber ||
                    "-"
                  }
                />

                <InfoCell
                  icon={
                    <Send className="h-4 w-4" />
                  }
                  label="Ekspedisi"
                  value={
                    data.suratJalan
                      ?.expedition ||
                    "-"
                  }
                />
              </div>
            </section>

            {/* =================================================
                ITEM TABLE
            ================================================= */}

            <section className="overflow-hidden rounded-[26px] border border-[#DDE9E3] bg-white shadow-[0_12px_35px_rgba(35,70,55,0.05)]">

              <div className="flex flex-col gap-4 border-b border-[#E8EFEB] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">

                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#78938A]">
                    Shipment Items
                  </div>

                  <h2 className="mt-1 text-lg font-black text-[#18352D]">
                    Detail Barang
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#DDE9E3] bg-[#F8FBF9] px-3 py-1.5 text-xs font-bold text-[#497F70]">
                    <Package className="h-3.5 w-3.5" />

                    {formatNumber(
                      activeItems.length
                    )}{" "}
                    item
                  </span>

                  {voidedItems.length > 0 && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">
                      <XCircle className="h-3.5 w-3.5" />

                      {formatNumber(
                        voidedItems.length
                      )}{" "}
                      void
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4ECE8] bg-[#F8FAF9]">
                      <th className="w-14 px-5 py-4 text-center text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#78938A]">
                        No
                      </th>

                      <th className="px-5 py-4 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#78938A]">
                        Barang
                      </th>

                      <th className="w-32 px-5 py-4 text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#78938A]">
                        Qty
                      </th>

                      <th className="w-40 px-5 py-4 text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#78938A]">
                        Harga
                      </th>

                      <th className="w-44 px-5 py-4 text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#78938A]">
                        Subtotal
                      </th>

                      <th className="w-32 px-5 py-4 text-center text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#78938A]">
                        Status
                      </th>

                      {isReleased && (
                        <th className="w-28 px-5 py-4 text-center text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#78938A]">
                          Action
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {data.items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={
                            isReleased
                              ? 7
                              : 6
                          }
                          className="px-6 py-16 text-center"
                        >
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F5F3] text-slate-400">
                            <Package className="h-6 w-6" />
                          </div>

                          <div className="mt-3 text-sm font-bold text-slate-600">
                            Belum ada barang
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            Delivery Order tidak memiliki detail item.
                          </div>
                        </td>
                      </tr>
                    ) : (
                      data.items.map(
                        (item, index) => {
                          const voided =
                            getItemVoided(
                              item
                            );

                          const qty =
                            num(item.qty);

                          const price =
                            num(item.price);

                          const subtotal =
                            qty * price;

                          const isVoiding =
                            voidingItemId ===
                            item.id;

                          return (
                            <tr
                              key={item.id}
                              className={`border-b border-[#EDF2EF] transition last:border-b-0 ${
                                voided
                                  ? "bg-red-50/40"
                                  : "hover:bg-[#FAFCFB]"
                              }`}
                            >
                              <td className="px-5 py-5 text-center align-top">
                                <span
                                  className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                                    voided
                                      ? "bg-red-100 text-red-500"
                                      : "bg-[#F0F5F2] text-[#497F70]"
                                  }`}
                                >
                                  {index +
                                    1}
                                </span>
                              </td>

                              <td className="px-5 py-5 align-top">
                                <div
                                  className={
                                    voided
                                      ? "opacity-60"
                                      : ""
                                  }
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                                      <Package className="h-4 w-4" />
                                    </div>

                                    <div className="min-w-0">
                                      <div
                                        className={`font-bold ${
                                          voided
                                            ? "text-slate-500 line-through"
                                            : "text-[#18352D]"
                                        }`}
                                      >
                                        {item
                                          .barang
                                          ?.name ||
                                          "-"}
                                      </div>

                                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                                        <span className="font-semibold">
                                          {item
                                            .barang
                                            ?.code ||
                                            "-"}
                                        </span>

                                        {item
                                          .barang
                                          ?.barcode && (
                                          <>
                                            <span>
                                              •
                                            </span>

                                            <span>
                                              {
                                                item
                                                  .barang
                                                  .barcode
                                              }
                                            </span>
                                          </>
                                        )}
                                      </div>

                                      {item.note && (
                                        <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs leading-5 text-slate-500">
                                          {
                                            item.note
                                          }
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {voided && (
                                  <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5">
                                    <div className="flex items-start gap-2">
                                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />

                                      <div>
                                        <div className="text-xs font-bold text-red-700">
                                          Item di-void
                                        </div>

                                        {item.voidReason && (
                                          <div className="mt-1 text-xs leading-5 text-red-600/80">
                                            {
                                              item.voidReason
                                            }
                                          </div>
                                        )}

                                        {item.voidedAt && (
                                          <div className="mt-1 text-[10px] text-red-500/70">
                                            {formatDateTime(
                                              item.voidedAt
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </td>

                              <td className="px-5 py-5 text-right align-top">
                                <div
                                  className={`font-black ${
                                    voided
                                      ? "text-slate-400 line-through"
                                      : "text-[#29483A]"
                                  }`}
                                >
                                  {formatNumber(
                                    qty
                                  )}
                                </div>

                                <div className="mt-1 text-xs font-medium text-slate-400">
                                  {item
                                    .barang
                                    ?.unit ||
                                    "unit"}
                                </div>
                              </td>

                              <td className="px-5 py-5 text-right align-top">
                                <div
                                  className={`font-semibold ${
                                    voided
                                      ? "text-slate-400 line-through"
                                      : "text-slate-600"
                                  }`}
                                >
                                  {formatCurrency(
                                    price
                                  )}
                                </div>
                              </td>

                              <td className="px-5 py-5 text-right align-top">
                                <div
                                  className={`font-black ${
                                    voided
                                      ? "text-slate-400 line-through"
                                      : "text-[#18352D]"
                                  }`}
                                >
                                  {formatCurrency(
                                    subtotal
                                  )}
                                </div>
                              </td>

                              <td className="px-5 py-5 text-center align-top">
                                {voided ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-red-600">
                                    <XCircle className="h-3.5 w-3.5" />
                                    Void
                                  </span>
                                ) : item.isReceived ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-green-100 bg-green-50 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-green-600">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Received
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DCEAE3] bg-[#F3F8F5] px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#497F70]">
                                    <Send className="h-3.5 w-3.5" />
                                    Aktif
                                  </span>
                                )}
                              </td>

                              {isReleased && (
                                <td className="px-5 py-5 text-center align-top">
                                  {!voided && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        processVoidItem(
                                          item
                                        )
                                      }
                                      disabled={
                                        isVoiding ||
                                        processing
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-bold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {isVoiding ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <XCircle className="h-3.5 w-3.5" />
                                      )}

                                      {isVoiding
                                        ? "..."
                                        : "Void"}
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        }
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-[#E6EEEA] bg-[#FAFCFB] px-5 py-4 md:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-slate-400">
                    Total seluruh dokumen:{" "}
                    <strong className="text-slate-600">
                      {formatNumber(
                        totalAllQty
                      )}
                    </strong>{" "}
                    qty
                  </div>

                  <div className="flex items-center gap-5">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Qty Aktif
                      </div>

                      <div className="mt-0.5 text-lg font-black text-[#29483A]">
                        {formatNumber(
                          totalQty
                        )}
                      </div>
                    </div>

                    <div className="h-9 w-px bg-slate-200" />

                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Nilai
                      </div>

                      <div className="mt-0.5 text-lg font-black text-[#29483A]">
                        {formatCurrency(
                          totalValue
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* =================================================
                REMARKS
            ================================================= */}

            {data.remarks && (
              <section className="rounded-[26px] border border-[#DDE9E3] bg-white p-5 shadow-[0_12px_35px_rgba(35,70,55,0.05)] md:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                    <FileText className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#78938A]">
                      Remarks
                    </div>

                    <h2 className="mt-1 text-base font-black text-[#18352D]">
                      Keterangan Pengiriman
                    </h2>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-500">
                      {data.remarks}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* =================================================
                VOID SUMMARY
            ================================================= */}

            {voidedItems.length > 0 && (
              <section className="rounded-[26px] border border-red-100 bg-white shadow-[0_12px_35px_rgba(127,29,29,0.04)]">
                <div className="border-b border-red-100 bg-red-50/60 px-5 py-5 md:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
                      <XCircle className="h-5 w-5" />
                    </div>

                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-red-400">
                        Adjustment
                      </div>

                      <h2 className="mt-1 text-base font-black text-red-800">
                        Riwayat Void Item
                      </h2>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-red-50">
                  {voidedItems.map(
                    (item) => (
                      <div
                        key={item.id}
                        className="px-5 py-4 md:px-6"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="font-bold text-slate-700">
                              {item
                                .barang
                                ?.name ||
                                "-"}
                            </div>

                            <div className="mt-1 text-xs text-slate-400">
                              {
                                item
                                  .barang
                                  ?.code
                              }{" "}
                              • Qty{" "}
                              {formatNumber(
                                item.qty
                              )}
                            </div>
                          </div>

                          <div className="max-w-xl rounded-xl bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-600">
                            {item.voidReason ||
                              "Tidak ada alasan void."}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </section>
            )}
          </div>

          {/* =================================================
              RIGHT SIDEBAR
          ================================================= */}

          <aside className="space-y-6">

            {/* DESTINATION CARD */}

            <section className="overflow-hidden rounded-[26px] border border-[#DDE9E3] bg-white shadow-[0_12px_35px_rgba(35,70,55,0.05)]">

              <div className="relative overflow-hidden bg-[#29483A] px-5 py-6">
                <div className="absolute -right-12 -top-20 h-44 w-44 rounded-full bg-white/10 blur-2xl" />

                <div className="relative">
                  <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#BFD8CE]">
                    <MapPin className="h-3.5 w-3.5" />
                    Destination
                  </div>

                  <div className="mt-3 text-xl font-black text-white">
                    {data.outlet?.name ||
                      data.customer?.name ||
                      "Tujuan Pengiriman"}
                  </div>

                  {data.outlet?.code && (
                    <div className="mt-1 text-sm font-medium text-[#C7DDD4]">
                      {data.outlet.code}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5">
                <div className="space-y-4">
                  <SidebarRow
                    icon={
                      <Building2 className="h-4 w-4" />
                    }
                    label="Outlet"
                    value={
                      data.outlet?.name ||
                      "-"
                    }
                  />

                  <SidebarRow
                    icon={
                      <Users className="h-4 w-4" />
                    }
                    label="Customer"
                    value={
                      data.customer?.name ||
                      "-"
                    }
                  />

                  <SidebarRow
                    icon={
                      <CalendarDays className="h-4 w-4" />
                    }
                    label="Tanggal"
                    value={formatDate(
                      data.deliveryDate
                    )}
                  />
                </div>
              </div>
            </section>

            {/* STOCK IMPACT */}

            <section className="rounded-[26px] border border-[#DDE9E3] bg-white p-5 shadow-[0_12px_35px_rgba(35,70,55,0.05)]">

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#78938A]">
                    Stock Flow
                  </div>

                  <h3 className="mt-1 text-base font-black text-[#18352D]">
                    Dampak Transaksi
                  </h3>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <Zap className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 space-y-1">

                <FlowStep
                  number="01"
                  title="Gudang Pusat"
                  description="Stock utama"
                  active
                />

                <div className="ml-[18px] h-5 w-px bg-[#DCE8E2]" />

                <FlowStep
                  number="02"
                  title="Release"
                  description={
                    isReleased
                      ? "Stock sudah keluar"
                      : "Menunggu proses"
                  }
                  active={isReleased}
                />

                <div className="ml-[18px] h-5 w-px bg-[#DCE8E2]" />

                <FlowStep
                  number="03"
                  title="Outlet Transfer"
                  description={
                    isReleased
                      ? "Transfer SENT"
                      : "Belum dibuat"
                  }
                  active={isReleased}
                />

                <div className="ml-[18px] h-5 w-px bg-[#DCE8E2]" />

                <FlowStep
                  number="04"
                  title="Penerimaan"
                  description={
                    data.status ===
                      "RECEIVED" ||
                    data.status ===
                      "SELESAI"
                      ? "Barang diterima"
                      : "Menunggu outlet"
                  }
                  active={
                    data.status ===
                      "RECEIVED" ||
                    data.status ===
                      "SELESAI"
                  }
                />
              </div>
            </section>

            {/* RECEIVING INFO */}

            <section className="rounded-[26px] border border-[#DDE9E3] bg-white p-5 shadow-[0_12px_35px_rgba(35,70,55,0.05)]">

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <PackageCheck className="h-5 w-5" />
                </div>

                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#78938A]">
                    Receiving
                  </div>

                  <h3 className="mt-1 text-base font-black text-[#18352D]">
                    Informasi Penerimaan
                  </h3>
                </div>
              </div>

              <div className="mt-5 space-y-4">

                <SidebarRow
                  icon={
                    <CheckCircle2 className="h-4 w-4" />
                  }
                  label="Status"
                  value={
                    data.deliveryStatus ||
                    getStatusLabel(
                      data.status
                    )
                  }
                />

                <SidebarRow
                  icon={
                    <CalendarDays className="h-4 w-4" />
                  }
                  label="Tanggal Terima"
                  value={
                    data.receivedAt
                      ? formatDateTime(
                          data.receivedAt
                        )
                      : data.suratJalan
                          ?.receiveDate
                      ? formatDateTime(
                          data.suratJalan
                            .receiveDate
                        )
                      : "Belum diterima"
                  }
                />

                <SidebarRow
                  icon={
                    <UserRound className="h-4 w-4" />
                  }
                  label="Diterima Oleh"
                  value={
                    data.receivedBy
                      ?.fullname ||
                    data.receivedBy
                      ?.username ||
                    data.suratJalan
                      ?.receiver ||
                    "Belum ada"
                  }
                />
              </div>
            </section>

            {/* EXPORT */}

            <section className="rounded-[26px] border border-[#DDE9E3] bg-white p-5 shadow-[0_12px_35px_rgba(35,70,55,0.05)]">

              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#78938A]">
                  Document Tools
                </div>

                <h3 className="mt-1 text-base font-black text-[#18352D]">
                  Export Dokumen
                </h3>
              </div>

              <div className="mt-4 grid gap-2">

                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="group flex items-center justify-between rounded-xl border border-[#DDE9E3] bg-[#FAFCFB] px-3.5 py-3 text-left transition hover:border-[#C5DAD0] hover:bg-[#F4F9F6]"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-500">
                      <FileText className="h-4 w-4" />
                    </span>

                    <span>
                      <span className="block text-xs font-bold text-[#35564C]">
                        Export PDF
                      </span>

                      <span className="block text-[10px] text-slate-400">
                        Surat Jalan
                      </span>
                    </span>
                  </span>

                  <Download className="h-4 w-4 text-slate-300 transition group-hover:text-[#497F70]" />
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="group flex items-center justify-between rounded-xl border border-[#DDE9E3] bg-[#FAFCFB] px-3.5 py-3 text-left transition hover:border-[#C5DAD0] hover:bg-[#F4F9F6]"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-600">
                      <FileSpreadsheet className="h-4 w-4" />
                    </span>

                    <span>
                      <span className="block text-xs font-bold text-[#35564C]">
                        Export Excel
                      </span>

                      <span className="block text-[10px] text-slate-400">
                        Data transaksi
                      </span>
                    </span>
                  </span>

                  <Download className="h-4 w-4 text-slate-300 transition group-hover:text-[#497F70]" />
                </button>
              </div>
            </section>
          </aside>
        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="mt-8 flex flex-col gap-3 border-t border-[#DCE7E2] pt-5 text-xs text-slate-400 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#719287]" />

            <span>
              Dokumen ini merupakan bagian dari
              workflow inventory MGB.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span>
              ID:{" "}
              <strong className="text-slate-500">
                #{data.id}
              </strong>
            </span>

            <span className="h-1 w-1 rounded-full bg-slate-300" />

            <span>
              {formatDateTime(
                data.updatedAt ||
                  data.createdAt
              )}
            </span>
          </div>
        </footer>
      </div>

      {/* =====================================================
          RELEASE CONFIRMATION MODAL
      ===================================================== */}

      {showReleaseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#10231C]/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_30px_100px_rgba(16,35,28,0.28)]">

            <div className="relative overflow-hidden bg-[#29483A] px-6 py-6 text-white">
              <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-2xl" />

              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                    <Send className="h-6 w-6" />
                  </div>

                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#BFD8CE]">
                      Release Transaction
                    </div>

                    <h3 className="mt-1 text-xl font-black">
                      Proses Pengiriman
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowReleaseModal(false)
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6">

              <div className="rounded-2xl border border-[#DDE9E3] bg-[#F8FBF9] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                    <Info className="h-5 w-5" />
                  </div>

                  <div>
                    <div className="text-sm font-bold text-[#29483A]">
                      Anda akan me-release dokumen ini
                    </div>

                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      {data.number} →{" "}
                      {data.outlet?.name ||
                        data.customer?.name ||
                        "Tujuan pengiriman"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">

                <ReleaseImpact
                  icon={
                    <Package className="h-4 w-4" />
                  }
                  title="Stock pusat berkurang"
                  description={`${formatNumber(
                    totalQty
                  )} qty barang aktif akan dikeluarkan dari stock pusat.`}
                />

                <ReleaseImpact
                  icon={
                    <Zap className="h-4 w-4" />
                  }
                  title="FEFO diproses"
                  description="Barang dengan batch/expired akan menggunakan mekanisme FEFO sesuai API release."
                />

                <ReleaseImpact
                  icon={
                    <FileText className="h-4 w-4" />
                  }
                  title="Surat Jalan dibuat"
                  description="Sistem akan membuat nomor Surat Jalan untuk transaksi ini."
                />

                <ReleaseImpact
                  icon={
                    <Send className="h-4 w-4" />
                  }
                  title="Outlet Transfer dibuat"
                  description="Transfer ke outlet akan dibuat dengan status SENT."
                />
              </div>

              <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

                  <p className="text-xs leading-5 text-amber-700">
                    Pastikan barang dan quantity
                    sudah benar. Setelah release,
                    dokumen tidak lagi berstatus
                    DRAFT dan perubahan stock akan
                    dicatat ke histori transaksi.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setShowReleaseModal(false)
                  }
                  className="rounded-xl border border-[#D9E5DF] bg-white px-5 py-3 text-sm font-bold text-[#35564C] transition hover:bg-[#F7FAF8]"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={processDelivery}
                  disabled={processing}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#29483A] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#29483A]/15 transition hover:bg-[#203C31] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Ya, Proses Pengiriman
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

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function InfoCell({
  icon,
  label,
  value,
  secondary,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="bg-white px-5 py-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F5F2] text-[#497F70]">
          {icon}
        </div>

        <div className="min-w-0">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
            {label}
          </div>

          <div className="mt-1 truncate text-sm font-bold text-[#35564C]">
            {value}
          </div>

          {secondary && (
            <div className="mt-0.5 text-xs font-medium text-slate-400">
              {secondary}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F0F5F2] text-[#497F70]">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
          {label}
        </div>

        <div className="mt-1 break-words text-sm font-bold text-[#35564C]">
          {value}
        </div>
      </div>
    </div>
  );
}

function FlowStep({
  number,
  title,
  description,
  active,
}: {
  number: string;
  title: string;
  description: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-black ${
          active
            ? "bg-[#29483A] text-white shadow-sm"
            : "bg-[#F0F5F2] text-[#719287]"
        }`}
      >
        {active ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          number
        )}
      </div>

      <div className="min-w-0">
        <div className="text-xs font-bold text-[#35564C]">
          {title}
        </div>

        <div className="mt-0.5 text-[10px] text-slate-400">
          {description}
        </div>
      </div>
    </div>
  );
}

function ReleaseImpact({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E1EBE6] bg-white p-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
        {icon}
      </div>

      <div className="min-w-0">
        <div className="text-xs font-bold text-[#35564C]">
          {title}
        </div>

        <div className="mt-1 text-xs leading-5 text-slate-400">
          {description}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ICON HELPER
========================================================= */

function BoxesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="m21 8-9-5-9 5 9 5 9-5Z" />
      <path d="m3 8 9 5 9-5" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}