"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Trash2,
  RefreshCw,
  Package,
  Lock,
} from "lucide-react";

type Item = {
  id?: number;
  barangId: number;
  qty: number;
  price: number;
  subtotal: number;
  barang?: {
    id: number;
    code: string;
    name: string;
    stock: number;
    sellingPrice?: number;
  };
};

type Delivery = {
  id: number;
  number: string;
  status: string;
  deliveryDate: string;
  remarks: string | null;
  totalQty: number;
  customer?: {
    id: number;
    code?: string;
    name: string;
  };
  items: Item[];
};

export default function BarangKeluarDetailPage() {
  const params = useParams();
  const router = useRouter();

  const id = String(params.id);

  const [data, setData] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [note, setNote] = useState("");

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch(`/api/barang-keluar/${id}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Gagal mengambil data barang keluar"
        );
      }

      const delivery = json.data;

      /*
       * PENTING:
       * Kalau price dari DeliveryItem kosong/0,
       * ambil harga dari Barang.sellingPrice.
       *
       * Ini membuat halaman edit tetap menampilkan
       * harga seperti yang muncul di Surat Jalan.
       */
      const normalizedItems = (delivery.items || []).map(
        (item: any) => {
          const priceFromItem = Number(item.price ?? 0);

          const priceFromBarang = Number(
            item.barang?.sellingPrice ?? 0
          );

          const price =
            priceFromItem > 0
              ? priceFromItem
              : priceFromBarang;

          const qty = Number(item.qty ?? 0);

          return {
            ...item,
            qty,
            price,
            subtotal: qty * price,
          };
        }
      );

      setData({
        ...delivery,
        items: normalizedItems,
      });

      setNote(delivery?.remarks || "");
    } catch (error: any) {
      console.error("LOAD BARANG KELUAR ERROR:", error);

      alert(
        error?.message ||
          "Gagal mengambil data barang keluar"
      );

      router.push("/pengiriman");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  function updateQty(
    itemId: number | undefined,
    value: string
  ) {
    if (!data || !itemId) return;

    const qty = Number(value);

    setData({
      ...data,
      items: data.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              qty,
              subtotal:
                Number(item.price || 0) * qty,
            }
          : item
      ),
    });
  }

  async function saveDraft() {
    if (!data) return;

    if (data.status !== "DRAFT") {
      alert(
        "Delivery Order yang sudah RELEASED tidak dapat diedit."
      );
      return;
    }

    for (const item of data.items) {
      if (!item.qty || Number(item.qty) <= 0) {
        alert(
          `Qty ${item.barang?.name || "barang"} tidak valid.`
        );
        return;
      }

      if (
        item.price === undefined ||
        item.price === null ||
        Number(item.price) < 0
      ) {
        alert(
          `Harga ${item.barang?.name || "barang"} tidak valid.`
        );
        return;
      }
    }

    try {
      setSaving(true);

      const res = await fetch(
        `/api/barang-keluar/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerId: data.customer?.id ?? null,
            remarks: note,

            items: data.items.map((item) => ({
              id: item.id,
              barangId: item.barangId,
              qty: Number(item.qty),

              /*
               * HARGA SEKARANG DIKIRIM
               */
              price: Number(item.price || 0),

              /*
               * Sekalian kirim subtotal
               */
              subtotal:
                Number(item.qty || 0) *
                Number(item.price || 0),
            })),
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal menyimpan perubahan"
        );
      }

      alert("Draft berhasil diperbarui.");

      await loadData();
    } catch (error: any) {
      console.error(
        "SAVE BARANG KELUAR ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal menyimpan perubahan"
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraft() {
    if (!data) return;

    if (data.status !== "DRAFT") {
      alert(
        "Delivery Order yang sudah RELEASED tidak dapat dihapus."
      );
      return;
    }

    const yakin = confirm(
      `Hapus Draft ${data.number}?\n\nStock tidak akan berubah karena dokumen masih DRAFT.`
    );

    if (!yakin) return;

    try {
      setDeleting(true);

      const res = await fetch(
        `/api/barang-keluar/${id}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal menghapus draft"
        );
      }

      alert("Draft berhasil dihapus.");

      router.push("/pengiriman");
    } catch (error: any) {
      console.error(
        "DELETE BARANG KELUAR ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal menghapus draft"
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-7 w-7 animate-spin text-emerald-600" />

          <p className="text-sm text-slate-500">
            Memuat Delivery Order...
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const isDraft = data.status === "DRAFT";

  const totalQty = data.items.reduce(
    (total, item) =>
      total + Number(item.qty || 0),
    0
  );

  const totalValue = data.items.reduce(
    (total, item) =>
      total +
      Number(item.qty || 0) *
        Number(item.price || 0),
    0
  );

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">

      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">

          <button
            type="button"
            onClick={() =>
              router.push("/pengiriman")
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div>
            <div className="flex items-center gap-3">

              <h1 className="text-2xl font-bold text-slate-900">
                {data.number}
              </h1>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isDraft
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {data.status}
              </span>

            </div>

            <p className="mt-1 text-sm text-slate-500">
              Detail Barang Keluar / Delivery Order
            </p>
          </div>
        </div>

        {isDraft ? (
          <div className="flex gap-2">

            <button
              type="button"
              onClick={deleteDraft}
              disabled={saving || deleting}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}

              Hapus Draft
            </button>

            <button
              type="button"
              onClick={saveDraft}
              disabled={saving || deleting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}

              Simpan Perubahan
            </button>

          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500">
            <Lock className="h-4 w-4" />
            Dokumen sudah RELEASED
          </div>
        )}
      </div>

      {/* INFO */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Customer
          </p>

          <p className="mt-2 font-semibold text-slate-800">
            {data.customer?.name || "-"}
          </p>

          {data.customer?.code && (
            <p className="mt-1 text-xs text-slate-400">
              {data.customer.code}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Tanggal
          </p>

          <p className="mt-2 font-semibold text-slate-800">
            {data.deliveryDate
              ? new Date(
                  data.deliveryDate
                ).toLocaleDateString(
                  "id-ID",
                  {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  }
                )
              : "-"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Total Qty
          </p>

          <p className="mt-2 text-xl font-bold text-slate-900">
            {totalQty.toLocaleString("id-ID")}
          </p>
        </div>

      </div>

      {/* NOTE */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <label className="text-sm font-semibold text-slate-700">
          Keterangan
        </label>

        {isDraft ? (
          <textarea
            value={note}
            onChange={(e) =>
              setNote(e.target.value)
            }
            rows={3}
            placeholder="Keterangan barang keluar..."
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
          />
        ) : (
          <p className="mt-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {data.remarks || "-"}
          </p>
        )}

      </div>

      {/* ITEMS */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">

          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
            <Package className="h-5 w-5 text-emerald-600" />
          </div>

          <div>
            <h2 className="font-semibold text-slate-800">
              Detail Barang
            </h2>

            <p className="text-xs text-slate-500">
              {data.items.length} item
            </p>
          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[850px]">

            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Kode
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Barang
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Stock
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

              {data.items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50"
                >

                  <td className="px-5 py-4">
                    <span className="font-mono text-sm font-semibold text-slate-700">
                      {item.barang?.code || "-"}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-800">
                      {item.barang?.name || "-"}
                    </div>
                  </td>

                  <td className="px-5 py-4 text-right text-sm text-slate-500">
                    {Number(
                      item.barang?.stock || 0
                    ).toLocaleString("id-ID")}
                  </td>

                  <td className="px-5 py-4 text-right">

                    {isDraft ? (
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) =>
                          updateQty(
                            item.id,
                            e.target.value
                          )
                        }
                        className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                      />
                    ) : (
                      <span className="font-semibold text-slate-700">
                        {Number(
                          item.qty
                        ).toLocaleString("id-ID")}
                      </span>
                    )}

                  </td>

                  <td className="px-5 py-4 text-right">

                    <span className="text-sm font-medium text-slate-700">
                      Rp{" "}
                      {Number(
                        item.price || 0
                      ).toLocaleString("id-ID")}
                    </span>

                  </td>

                  <td className="px-5 py-4 text-right">

                    <span className="font-semibold text-slate-800">
                      Rp{" "}
                      {(
                        Number(item.qty || 0) *
                        Number(item.price || 0)
                      ).toLocaleString("id-ID")}
                    </span>

                  </td>

                </tr>
              ))}

            </tbody>

            <tfoot>

              <tr className="border-t border-slate-200 bg-slate-50">

                <td
                  colSpan={5}
                  className="px-5 py-4 text-right text-sm font-semibold text-slate-600"
                >
                  Total
                </td>

                <td className="px-5 py-4 text-right text-base font-bold text-slate-900">
                  Rp{" "}
                  {totalValue.toLocaleString("id-ID")}
                </td>

              </tr>

            </tfoot>

          </table>
        </div>
      </div>

      {/* RELEASE WARNING */}
      {isDraft && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Draft:</strong>{" "}
          perubahan pada dokumen ini belum
          mengurangi stock, batch expired,
          inventory, stock card, atau stock
          mutation. Semua transaksi stock baru
          dijalankan ketika Delivery Order
          di-Release.
        </div>
      )}

    </div>
  );
}