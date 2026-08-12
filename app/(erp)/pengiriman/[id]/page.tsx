"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  CalendarDays,
  CheckCircle2,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
  Truck,
  User,
  XCircle,
} from "lucide-react";

export default function PengirimanDetail() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function load() {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/delivery-order/${id}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      console.log("DELIVERY DETAIL:", json);

      if (!res.ok || !json.success) {
        setData(null);
        return;
      }

      setData(json.data);
    } catch (error) {
      console.error(
        "LOAD DELIVERY DETAIL ERROR:",
        error
      );

      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) {
      load();
    }
  }, [id]);

  // =====================================================
  // RELEASE
  // =====================================================

  async function prosesKirim() {
    if (!data) return;

    if (data.status !== "DRAFT") {
      alert(
        "Delivery Order ini sudah RELEASED dan tidak dapat diproses kembali."
      );
      return;
    }

    const yakin = confirm(
      `Release Delivery Order ${data.number}?\n\n` +
        `Setelah di-release:\n` +
        `- Stock akan berkurang\n` +
        `- Batch akan diproses FEFO\n` +
        `- Inventory akan diperbarui\n` +
        `- Stock Card akan dibuat\n` +
        `- Stock Mutation akan dibuat\n\n` +
        `Proses ini tidak dapat dibatalkan.`
    );

    if (!yakin) return;

    try {
      setProcessing(true);

      const res = await fetch(
        `/api/delivery-order/${id}/approve`,
        {
          method: "PUT",
        }
      );

      const json = await res.json();

      if (json.success) {
        alert(
          json.message ||
            "Delivery Order berhasil di-release"
        );

        await load();
      } else {
        alert(
          json.message ||
            "Gagal release Delivery Order"
        );
      }
    } catch (error) {
      console.error(
        "RELEASE DELIVERY ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat release Delivery Order"
      );
    } finally {
      setProcessing(false);
    }
  }

  // =====================================================
  // EDIT
  // =====================================================

  function editDelivery() {
    if (!data) return;

    if (data.status !== "DRAFT") {
      alert(
        "Delivery Order yang sudah RELEASED tidak dapat diedit."
      );
      return;
    }

    router.push(
      `/barang-keluar/${data.id}`
    );
  }

  // =====================================================
  // DELETE
  // =====================================================

  async function deleteDelivery() {
    if (!data) return;

    if (data.status !== "DRAFT") {
      alert(
        "Delivery Order yang sudah RELEASED tidak dapat dihapus."
      );
      return;
    }

    const yakin = confirm(
      `Hapus Delivery Order ${data.number}?\n\n` +
        `Data draft dan detail barang akan dihapus.`
    );

    if (!yakin) return;

    try {
      setProcessing(true);

      const res = await fetch(
        `/api/delivery-order/${data.id}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      if (json.success) {
        alert(
          json.message ||
            "Delivery Order berhasil dihapus"
        );

        router.push("/pengiriman");
      } else {
        alert(
          json.message ||
            "Gagal menghapus Delivery Order"
        );
      }
    } catch (error) {
      console.error(
        "DELETE DELIVERY ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menghapus Delivery Order"
      );
    } finally {
      setProcessing(false);
    }
  }

  // =====================================================
  // FORMAT
  // =====================================================

  function formatDate(value: any) {
    if (!value) return "-";

    return new Date(
      value
    ).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  function formatNumber(value: any) {
    return Number(
      value || 0
    ).toLocaleString("id-ID");
  }

  function formatCurrency(value: any) {
    return Number(
      value || 0
    ).toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    });
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">

          <RefreshCw
            size={28}
            className="animate-spin text-emerald-600"
          />

          <p className="text-sm text-slate-500">
            Memuat Delivery Order...
          </p>

        </div>
      </div>
    );
  }

  // =====================================================
  // NOT FOUND
  // =====================================================

  if (!data) {
    return (
      <div className="min-h-[500px] bg-slate-50 p-8">

        <div className="rounded-2xl border border-red-100 bg-white p-10 text-center shadow-sm">

          <XCircle
            size={42}
            className="mx-auto text-red-400"
          />

          <h2 className="mt-4 text-lg font-semibold text-slate-800">
            Data pengiriman tidak ditemukan
          </h2>

          <button
            type="button"
            onClick={() =>
              router.push("/pengiriman")
            }
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900"
          >
            <ArrowLeft size={16} />
            Kembali
          </button>

        </div>

      </div>
    );
  }

  const isDraft =
    data.status === "DRAFT";

  const isReleased =
    data.status === "RELEASED";

  const totalValue =
    data.items?.reduce(
      (
        total: number,
        item: any
      ) =>
        total +
        Number(
          item.subtotal ??
            Number(item.price || 0) *
              Number(item.qty || 0)
        ),
      0
    ) || 0;

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div className="mb-6">

        <button
          type="button"
          onClick={() =>
            router.push("/pengiriman")
          }
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft size={17} />
          Kembali ke Delivery Order
        </button>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

          <div className="flex items-start gap-4">

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100">
              <Truck
                size={24}
                className="text-blue-600"
              />
            </div>

            <div>

              <div className="flex flex-wrap items-center gap-3">

                <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                  {data.number}
                </h1>

                {isDraft && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    DRAFT
                  </span>
                )}

                {isReleased && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={14} />
                    RELEASED
                  </span>
                )}

              </div>

              <p className="mt-1 text-sm text-slate-500">
                Detail Delivery Order
              </p>

            </div>

          </div>

          {/* ACTION */}

          <div className="flex flex-wrap gap-2">

            {isDraft && (
              <>
                <button
                  type="button"
                  onClick={editDelivery}
                  disabled={processing}
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Pencil size={16} />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={deleteDelivery}
                  disabled={processing}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  Hapus
                </button>

                <button
                  type="button"
                  onClick={prosesKirim}
                  disabled={processing}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing ? (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Send size={16} />
                  )}

                  Release
                </button>
              </>
            )}

            {isReleased && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={17} />
                Pengiriman Sudah Released
              </div>
            )}

          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* INFO */}
      {/* ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
              <User
                size={19}
                className="text-slate-600"
              />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Customer
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {data.customer?.name || "-"}
              </p>

            </div>

          </div>

        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
              <CalendarDays
                size={19}
                className="text-slate-600"
              />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Tanggal
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {formatDate(
                  data.deliveryDate
                )}
              </p>

            </div>

          </div>

        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
              <Boxes
                size={19}
                className="text-slate-600"
              />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Total Qty
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {formatNumber(
                  data.totalQty
                )}
              </p>

            </div>

          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* DRAFT INFO */}
      {/* ================================================= */}

      {isDraft && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">

          <div className="flex gap-3">

            <div className="mt-0.5 shrink-0">

              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                <RefreshCw
                  size={16}
                  className="text-amber-600"
                />
              </span>

            </div>

            <div>

              <p className="font-semibold text-amber-800">
                Delivery Order masih DRAFT
              </p>

              <p className="mt-1 text-sm leading-6 text-amber-700">
                Stock belum dikurangi, batch belum
                diproses FEFO, inventory belum
                diperbarui, dan Stock Card serta
                Stock Mutation belum dibuat.
                Semua transaksi tersebut baru
                dijalankan saat Delivery Order
                di-release.
              </p>

            </div>

          </div>

        </div>
      )}

      {/* ================================================= */}
      {/* TABLE */}
      {/* ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 px-5 py-4">

          <h2 className="font-semibold text-slate-800">
            Detail Barang
          </h2>

          <p className="mt-0.5 text-xs text-slate-500">
            Barang yang terdapat pada Delivery Order
          </p>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[900px]">

            <thead>

              <tr className="border-b border-slate-200 bg-slate-50">

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  No
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Kode
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Barang
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Qty
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Harga
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Subtotal
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-100">

              {data.items?.length > 0 ? (

                data.items.map(
                  (
                    item: any,
                    index: number
                  ) => {

                    const price =
                      Number(
                        item.price ??
                          item.barang
                            ?.sellingPrice ??
                          0
                      );

                    const subtotal =
                      Number(
                        item.subtotal ??
                          price *
                            Number(
                              item.qty || 0
                            )
                      );

                    return (
                      <tr
                        key={item.id}
                        className="transition hover:bg-slate-50"
                      >

                        <td className="px-5 py-4 text-sm text-slate-500">
                          {index + 1}
                        </td>

                        <td className="px-5 py-4">

                          <span className="font-mono text-sm font-semibold text-slate-700">
                            {item.barang?.code ||
                              "-"}
                          </span>

                        </td>

                        <td className="px-5 py-4">

                          <div className="font-medium text-slate-800">
                            {item.barang?.name ||
                              "-"}
                          </div>

                        </td>

                        <td className="px-5 py-4 text-right">

                          <span className="font-semibold text-slate-700">
                            {formatNumber(
                              item.qty
                            )}
                          </span>

                        </td>

                        <td className="px-5 py-4 text-right">

                          <span className="text-sm text-slate-600">
                            {formatCurrency(
                              price
                            )}
                          </span>

                        </td>

                        <td className="px-5 py-4 text-right">

                          <span className="font-semibold text-slate-800">
                            {formatCurrency(
                              subtotal
                            )}
                          </span>

                        </td>

                      </tr>
                    );
                  }
                )

              ) : (

                <tr>

                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-slate-400"
                  >
                    Tidak ada detail barang.
                  </td>

                </tr>

              )}

            </tbody>

            <tfoot>

              <tr className="border-t border-slate-200 bg-slate-50">

                <td
                  colSpan={5}
                  className="px-5 py-4 text-right text-sm font-semibold text-slate-600"
                >
                  Total Nilai
                </td>

                <td className="px-5 py-4 text-right">

                  <span className="text-base font-bold text-slate-900">
                    {formatCurrency(
                      totalValue
                    )}
                  </span>

                </td>

              </tr>

            </tfoot>

          </table>

        </div>

      </div>

      {/* ================================================= */}
      {/* NOTE */}
      {/* ================================================= */}

      {data.remarks && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <h3 className="font-semibold text-slate-800">
            Keterangan
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {data.remarks}
          </p>

        </div>
      )}

    </div>
  );
}