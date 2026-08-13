"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  Package,
  Printer,
  RefreshCw,
  Truck,
  User,
  MapPin,
  ReceiptText,
} from "lucide-react";

import { exportSuratJalanPDF } from "@/lib/exportSuratJalanPdf";
import { exportSuratJalanExcel } from "@/lib/exportSuratJalanExcel";

export default function SuratJalanDetailPage() {
  const params = useParams();
  const router = useRouter();

  const id = String(params.id);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  async function load() {
    try {
      setLoading(true);

      const res = await fetch(`/api/delivery-order/${id}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setData(json.data);
      } else {
        alert(json.message || "Data Surat Jalan tidak ditemukan");
      }
    } catch (error) {
      console.error(error);
      alert("Gagal mengambil data Surat Jalan");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) {
      load();
    }
  }, [id]);

  async function processDelivery() {
    if (!confirm("Release Delivery Order?")) {
      return;
    }

    try {
      setProcessing(true);

      const res = await fetch(
        `/api/delivery-order/${id}/approve`,
        {
          method: "PUT",
        }
      );

      const json = await res.json();

      alert(json.message);

      if (json.success) {
        await load();
      }
    } catch (error) {
      console.error(error);
      alert("Gagal memproses pengiriman");
    } finally {
      setProcessing(false);
    }
  }

  const items = data?.items ?? [];

  const total = useMemo(() => {
    return items.reduce((sum: number, item: any) => {
      const qty = Number(item.qty ?? 0);
      const price = Number(item.price ?? 0);

      const subtotal =
        item.subtotal != null && Number(item.subtotal) > 0
          ? Number(item.subtotal)
          : qty * price;

      return sum + subtotal;
    }, 0);
  }, [items]);

  function formatNumber(value: any) {
    return Number(value || 0).toLocaleString("id-ID");
  }

  function formatCurrency(value: any) {
    return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
  }

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

  function getStatusStyle(status: string) {
    switch (status) {
      case "DRAFT":
        return "border-amber-100 bg-amber-50 text-amber-600";

      case "APPROVED":
        return "border-blue-100 bg-blue-50 text-blue-600";

      case "DELIVERED":
        return "border-emerald-100 bg-emerald-50 text-emerald-600";

      case "CANCELLED":
        return "border-rose-100 bg-rose-50 text-rose-600";

      default:
        return "border-slate-100 bg-slate-50 text-slate-600";
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F8F7] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="rounded-[28px] border border-white bg-white p-8 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
            <div className="space-y-4">
              <div className="h-8 w-64 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-4 w-96 animate-pulse rounded-lg bg-slate-100" />

              <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-20 animate-pulse rounded-2xl bg-slate-50"
                  />
                ))}
              </div>

              <div className="mt-8 h-64 animate-pulse rounded-2xl bg-slate-50" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F5F8F7] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="rounded-[28px] border border-white bg-white p-10 text-center shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50">
              <ReceiptText className="h-7 w-7 text-rose-500" />
            </div>

            <h2 className="mt-4 text-lg font-bold text-slate-800">
              Data Surat Jalan tidak ditemukan
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Data mungkin sudah dihapus atau tidak tersedia.
            </p>

            <button
              onClick={() => router.back()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F8F7] text-slate-800">
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">

        {/* HEADER */}
        <section className="relative overflow-hidden rounded-[30px] border border-white bg-white shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-100/50 blur-3xl" />

          <div className="absolute -bottom-24 right-56 h-52 w-52 rounded-full bg-teal-100/40 blur-3xl" />

          <div className="relative p-6 sm:p-8">

            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

              {/* TITLE */}
              <div>
                <button
                  onClick={() => router.back()}
                  className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali
                </button>

                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_5px_rgba(52,211,153,0.10)]" />

                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                    MGB ERP
                  </span>
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
                  Surat Jalan
                </h1>

                <p className="mt-2 text-sm text-slate-500">
                  Detail pengiriman barang dan informasi delivery order.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    {data.suratJalan?.number ?? "-"}
                  </span>

                  <span className="text-slate-300">•</span>

                  <span className="text-xs font-medium text-slate-500">
                    Delivery {data.number ?? "-"}
                  </span>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="flex flex-wrap gap-2">

                {data.status === "DRAFT" && (
                  <button
                    onClick={processDelivery}
                    disabled={processing}
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Truck className="h-4 w-4" />

                    {processing
                      ? "Memproses..."
                      : "Proses Pengiriman"}
                  </button>
                )}

                <button
                  onClick={() => exportSuratJalanPDF(data)}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600"
                >
                  <FileDown className="h-4 w-4" />
                  Export PDF
                </button>

                <button
                  onClick={() => exportSuratJalanExcel(data)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </button>

                <a
                  href={`/surat-jalan/print?id=${data.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* STATUS + SUMMARY */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-2xl border border-white bg-white p-5 shadow-[0_8px_25px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                <Truck className="h-5 w-5 text-emerald-600" />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Status
                </p>

                <span
                  className={`mt-1 inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${getStatusStyle(
                    data.status
                  )}`}
                >
                  {data.status}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white bg-white p-5 shadow-[0_8px_25px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                <CalendarDays className="h-5 w-5 text-blue-600" />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Tanggal
                </p>

                <p className="mt-1 text-sm font-bold text-slate-700">
                  {formatDate(data.deliveryDate)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white bg-white p-5 shadow-[0_8px_25px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50">
                <User className="h-5 w-5 text-violet-600" />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Customer
                </p>

                <p className="mt-1 truncate text-sm font-bold text-slate-700">
                  {data.customer?.name ?? "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white bg-white p-5 shadow-[0_8px_25px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50">
                <Package className="h-5 w-5 text-amber-600" />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total Item
                </p>

                <p className="mt-1 text-sm font-bold text-slate-700">
                  {items.length.toLocaleString("id-ID")} barang
                </p>
              </div>
            </div>
          </div>

        </section>

        {/* INFORMATION */}
        <section className="rounded-[28px] border border-white bg-white shadow-[0_8px_30px_rgba(15,23,42,0.045)]">

          <div className="border-b border-slate-100 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                <ReceiptText className="h-5 w-5 text-emerald-600" />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Informasi Surat Jalan
                </h2>

                <p className="mt-0.5 text-xs text-slate-400">
                  Informasi utama dokumen pengiriman.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2 lg:grid-cols-3">

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                No Surat Jalan
              </p>

              <p className="mt-2 text-sm font-bold text-slate-700">
                {data.suratJalan?.number ?? "-"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                No Delivery
              </p>

              <p className="mt-2 text-sm font-bold text-slate-700">
                {data.number ?? "-"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tanggal
              </p>

              <p className="mt-2 text-sm font-bold text-slate-700">
                {formatDate(data.deliveryDate)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2 lg:col-span-3">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Alamat Customer
                  </p>

                  <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                    {data.customer?.address ?? "-"}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ITEMS */}
        <section className="overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_8px_30px_rgba(15,23,42,0.045)]">

          <div className="border-b border-slate-100 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                <Package className="h-5 w-5 text-emerald-600" />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Detail Barang
                </h2>

                <p className="mt-0.5 text-xs text-slate-400">
                  Daftar barang yang dikirim.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">

                  <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    No
                  </th>

                  <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Kode
                  </th>

                  <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Nama Barang
                  </th>

                  <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Satuan
                  </th>

                  <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Qty
                  </th>

                  <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Harga
                  </th>

                  <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Subtotal
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-14 text-center text-sm text-slate-400"
                    >
                      Tidak ada barang.
                    </td>
                  </tr>
                ) : (
                  items.map((item: any, index: number) => {
                    const qty = Number(item.qty ?? 0);
                    const price = Number(item.price ?? 0);

                    const subtotal =
                      item.subtotal != null &&
                      Number(item.subtotal) > 0
                        ? Number(item.subtotal)
                        : qty * price;

                    return (
                      <tr
                        key={item.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-6 py-4 text-center text-sm font-medium text-slate-400">
                          {index + 1}
                        </td>

                        <td className="px-6 py-4">
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                            {item.barang?.code ?? "-"}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-slate-700">
                            {item.barang?.name ?? "-"}
                          </p>
                        </td>

                        <td className="px-6 py-4 text-center text-sm text-slate-500">
                          {item.barang?.unit ?? "-"}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-slate-700">
                            {formatNumber(qty)}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right whitespace-nowrap text-sm text-slate-500">
                          {formatCurrency(price)}
                        </td>

                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <span className="text-sm font-bold text-slate-700">
                            {formatCurrency(subtotal)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}

              </tbody>
            </table>
          </div>

          {/* TOTAL */}
          <div className="border-t border-slate-100 bg-slate-50/50 p-6">
            <div className="flex justify-end">
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-500">
                    Total Pengiriman
                  </span>

                  <span className="text-xl font-bold text-slate-800">
                    {formatCurrency(total)}
                  </span>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* REMARKS */}
        {data.remarks && (
          <section className="rounded-[28px] border border-white bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">

            <div className="flex items-start gap-3">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                <ReceiptText className="h-5 w-5 text-amber-600" />
              </div>

              <div>
                <h2 className="text-sm font-bold text-slate-700">
                  Catatan
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {data.remarks}
                </p>
              </div>

            </div>
          </section>
        )}

        {/* SIGNATURE */}
        <section className="rounded-[28px] border border-white bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">

          <div className="mb-6">
            <h2 className="text-base font-bold text-slate-800">
              Tanda Tangan
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              Konfirmasi dokumen pengiriman.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-12 text-center md:grid-cols-3">

            <div>
              <p className="text-sm font-semibold text-slate-600">
                Dibuat
              </p>

              <div className="h-24" />

              <div className="mx-auto max-w-[180px] border-b border-slate-300" />

              <p className="mt-2 text-xs text-slate-400">
                Nama / Tanda Tangan
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-600">
                Gudang
              </p>

              <div className="h-24" />

              <div className="mx-auto max-w-[180px] border-b border-slate-300" />

              <p className="mt-2 text-xs text-slate-400">
                Nama / Tanda Tangan
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-600">
                Penerima
              </p>

              <div className="h-24" />

              <div className="mx-auto max-w-[180px] border-b border-slate-300" />

              <p className="mt-2 text-xs text-slate-400">
                Nama / Tanda Tangan
              </p>
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