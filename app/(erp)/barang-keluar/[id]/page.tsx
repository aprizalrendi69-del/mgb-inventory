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
  Plus,
  Search,
  X,
  Check,
} from "lucide-react";

type BarangSearch = {
  id: number;
  code: string;
  name: string;
  stock: number;
  sellingPrice?: number | null;
  priceSummary?: {
    lastPrice?: number | null;
  } | null;
};

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
    priceSummary?: {
      lastPrice?: number;
    } | null;
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

  // =====================================================
  // TAMBAH BARANG
  // =====================================================

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchBarang, setSearchBarang] = useState("");
  const [barangList, setBarangList] = useState<BarangSearch[]>([]);
  const [loadingBarang, setLoadingBarang] = useState(false);

  // =====================================================
  // LOAD DATA DELIVERY
  // =====================================================

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/barang-keluar/${id}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil data barang keluar"
        );
      }

      const delivery = json.data;

      const normalizedItems: Item[] = (
        delivery.items || []
      ).map((item: any) => {
        const priceFromItem = Number(
          item.price ?? 0
        );

        const priceFromSummary = Number(
          item.barang?.priceSummary?.lastPrice ?? 0
        );

        const priceFromBarang = Number(
          item.barang?.sellingPrice ?? 0
        );

        let price = 0;

        if (priceFromItem > 0) {
          price = priceFromItem;
        } else if (priceFromSummary > 0) {
          price = priceFromSummary;
        } else if (priceFromBarang > 0) {
          price = priceFromBarang;
        }

        const qty = Number(item.qty ?? 0);

        return {
          ...item,
          qty,
          price,
          subtotal: qty * price,
        };
      });

      setData({
        ...delivery,
        items: normalizedItems,
      });

      setNote(delivery?.remarks || "");
    } catch (error: any) {
      console.error(
        "LOAD BARANG KELUAR ERROR:",
        error
      );

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

  // =====================================================
  // LOAD MASTER BARANG
  // =====================================================

  async function loadBarang() {
    try {
      setLoadingBarang(true);

      const keyword =
        searchBarang.trim();

      const url = keyword
        ? `/api/master/barang?search=${encodeURIComponent(
            keyword
          )}`
        : `/api/master/barang`;

      const res = await fetch(url, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json.message ||
            "Gagal mengambil data barang"
        );
      }

      /*
       * API master barang di project bisa
       * mengembalikan beberapa bentuk response.
       *
       * Kita normalisasi di sini supaya
       * halaman tetap aman.
       */

      let list: any[] = [];

      if (Array.isArray(json)) {
        list = json;
      } else if (Array.isArray(json.data)) {
        list = json.data;
      } else if (
        Array.isArray(json.data?.items)
      ) {
        list = json.data.items;
      } else if (
        Array.isArray(json.items)
      ) {
        list = json.items;
      }

      const normalized: BarangSearch[] =
        list.map((barang: any) => ({
          id: Number(barang.id),

          code:
            barang.code ??
            barang.kodeBarang ??
            barang.kode ??
            "",

          name:
            barang.name ??
            barang.namaBarang ??
            barang.nama ??
            "",

          stock: Number(
            barang.stock ?? 0
          ),

          sellingPrice:
            barang.sellingPrice != null
              ? Number(
                  barang.sellingPrice
                )
              : 0,

          priceSummary:
            barang.priceSummary
              ? {
                  lastPrice:
                    barang.priceSummary
                      .lastPrice != null
                      ? Number(
                          barang
                            .priceSummary
                            .lastPrice
                        )
                      : 0,
                }
              : null,
        }));

      setBarangList(normalized);
    } catch (error: any) {
      console.error(
        "LOAD MASTER BARANG ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal mengambil data barang"
      );

      setBarangList([]);
    } finally {
      setLoadingBarang(false);
    }
  }

  // =====================================================
  // BUKA MODAL TAMBAH
  // =====================================================

  function openAddModal() {
    if (!data) return;

    if (data.status !== "DRAFT") {
      alert(
        "Delivery Order yang sudah RELEASED tidak dapat diubah."
      );
      return;
    }

    setSearchBarang("");
    setBarangList([]);
    setShowAddModal(true);

    /*
     * Load daftar barang ketika modal dibuka.
     */
    loadBarang();
  }

  // =====================================================
  // CLOSE MODAL
  // =====================================================

  function closeAddModal() {
    if (loadingBarang) return;

    setShowAddModal(false);
    setSearchBarang("");
    setBarangList([]);
  }

  // =====================================================
  // SEARCH BARANG
  // =====================================================

  useEffect(() => {
    if (!showAddModal) return;

    const timer = setTimeout(() => {
      loadBarang();
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [searchBarang, showAddModal]);

  // =====================================================
  // TAMBAH BARANG KE DELIVERY
  // =====================================================

  function addBarang(barang: BarangSearch) {
    if (!data) return;

    if (data.status !== "DRAFT") {
      alert(
        "Delivery Order yang sudah RELEASED tidak dapat diubah."
      );
      return;
    }

    /*
     * Cek apakah barang sudah ada.
     */

    const alreadyExists =
      data.items.some(
        (item) =>
          Number(item.barangId) ===
          Number(barang.id)
      );

    if (alreadyExists) {
      alert(
        `${barang.name} sudah ada dalam Delivery Order.`
      );
      return;
    }

    /*
     * =====================================================
     * HARGA BARANG BARU
     * =====================================================
     *
     * Prioritas:
     *
     * 1. PriceSummary.lastPrice
     * 2. sellingPrice
     *
     * Jangan langsung menggunakan 0.
     */

    const summaryPrice = Number(
      barang.priceSummary?.lastPrice ?? 0
    );

    const sellingPrice = Number(
      barang.sellingPrice ?? 0
    );

    let price = 0;

    if (summaryPrice > 0) {
      price = summaryPrice;
    } else if (sellingPrice > 0) {
      price = sellingPrice;
    }

    /*
     * Qty default = 1
     */

    const qty = 1;

    const newItem: Item = {
      /*
       * Item baru belum memiliki
       * DeliveryItem ID.
       */
      id: undefined,

      barangId: barang.id,

      qty,

      price,

      subtotal: qty * price,

      barang: {
        id: barang.id,
        code: barang.code,
        name: barang.name,
        stock: Number(
          barang.stock ?? 0
        ),
        sellingPrice:
          sellingPrice,

        priceSummary:
          barang.priceSummary
            ? {
                lastPrice:
                  summaryPrice,
              }
            : null,
      },
    };

    setData({
      ...data,

      items: [
        ...data.items,
        newItem,
      ],
    });

    setShowAddModal(false);
    setSearchBarang("");
    setBarangList([]);

    /*
     * Kalau harga benar-benar tidak ditemukan,
     * beri informasi supaya user tahu.
     */
    if (price <= 0) {
      alert(
        `Harga ${barang.name} belum tersedia.\n\n` +
          `Silakan isi/update harga barang terlebih dahulu.`
      );
    }
  }

  // =====================================================
  // UPDATE QTY
  // =====================================================

  function updateQty(
    itemId: number | undefined,
    value: string
  ) {
    if (!data) return;

    /*
     * Untuk item baru, ID belum ada.
     *
     * Karena itu kita tidak menggunakan
     * item.id sebagai satu-satunya identifier.
     *
     * Fungsi ini dipanggil berdasarkan
     * index melalui updateQtyByIndex.
     */

    if (itemId === undefined) return;

    const qty = Number(value);

    setData({
      ...data,

      items: data.items.map(
        (item) =>
          item.id === itemId
            ? {
                ...item,
                qty,
                subtotal:
                  Number(
                    item.price || 0
                  ) * qty,
              }
            : item
      ),
    });
  }

  // =====================================================
  // UPDATE QTY BERDASARKAN INDEX
  // =====================================================

  function updateQtyByIndex(
    index: number,
    value: string
  ) {
    if (!data) return;

    const qty = Number(value);

    setData({
      ...data,

      items: data.items.map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,

                qty,

                subtotal:
                  Number(
                    item.price || 0
                  ) * qty,
              }
            : item
      ),
    });
  }

  // =====================================================
  // HAPUS ITEM
  // =====================================================

  function removeItem(
    index: number
  ) {
    if (!data) return;

    if (data.status !== "DRAFT") {
      alert(
        "Delivery Order yang sudah RELEASED tidak dapat diubah."
      );
      return;
    }

    if (data.items.length <= 1) {
      alert(
        "Minimal harus ada 1 barang dalam Delivery Order."
      );
      return;
    }

    const item =
      data.items[index];

    if (!item) return;

    const namaBarang =
      item.barang?.name ||
      "barang";

    const qty = Number(
      item.qty || 0
    );

    const yakin = confirm(
      `Hapus barang "${namaBarang}" dari Delivery Order?\n\n` +
        `Qty: ${qty.toLocaleString(
          "id-ID"
        )}\n\n` +
        `Karena dokumen masih DRAFT, penghapusan ini tidak akan mengubah stock.`
    );

    if (!yakin) return;

    setData({
      ...data,

      items: data.items.filter(
        (_, itemIndex) =>
          itemIndex !== index
      ),
    });
  }

  // =====================================================
  // SAVE DRAFT
  // =====================================================

  async function saveDraft() {
    if (!data) return;

    if (data.status !== "DRAFT") {
      alert(
        "Delivery Order yang sudah RELEASED tidak dapat diedit."
      );
      return;
    }

    if (data.items.length === 0) {
      alert(
        "Delivery Order harus memiliki minimal 1 barang."
      );
      return;
    }

    /*
     * Validasi setiap item.
     */

    for (const item of data.items) {
      if (
        !item.qty ||
        Number(item.qty) <= 0
      ) {
        alert(
          `Qty ${
            item.barang?.name ||
            "barang"
          } tidak valid.`
        );
        return;
      }

      if (
        item.price === undefined ||
        item.price === null ||
        Number(item.price) < 0
      ) {
        alert(
          `Harga ${
            item.barang?.name ||
            "barang"
          } tidak valid.`
        );
        return;
      }

      /*
       * Validasi stock.
       */

      const stock = Number(
        item.barang?.stock ?? 0
      );

      if (
        Number(item.qty) >
        stock
      ) {
        alert(
          `Stock ${
            item.barang?.name ||
            "barang"
          } tidak cukup.\n\n` +
            `Stock tersedia: ${stock.toLocaleString(
              "id-ID"
            )}\n` +
            `Qty diminta: ${Number(
              item.qty
            ).toLocaleString(
              "id-ID"
            )}`
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
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            customerId:
              data.customer?.id ??
              null,

            remarks: note,

            items: data.items.map(
              (item) => ({
                id: item.id,

                barangId:
                  item.barangId,

                qty: Number(
                  item.qty
                ),

                price: Number(
                  item.price || 0
                ),

                subtotal:
                  Number(
                    item.qty || 0
                  ) *
                  Number(
                    item.price || 0
                  ),
              })
            ),
          }),
        }
      );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Gagal menyimpan perubahan"
        );
      }

      alert(
        "Draft berhasil diperbarui."
      );

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

  // =====================================================
  // DELETE DRAFT
  // =====================================================

  async function deleteDraft() {
    if (!data) return;

    if (data.status !== "DRAFT") {
      alert(
        "Delivery Order yang sudah RELEASED tidak dapat dihapus."
      );
      return;
    }

    const yakin = confirm(
      `Hapus Draft ${data.number}?\n\n` +
        `Stock tidak akan berubah karena dokumen masih DRAFT.`
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

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Gagal menghapus draft"
        );
      }

      alert(
        "Draft berhasil dihapus."
      );

      router.push(
        "/pengiriman"
      );
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

  // =====================================================
  // LOADING
  // =====================================================

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

  // =====================================================
  // DATA TIDAK ADA
  // =====================================================

  if (!data) {
    return null;
  }

  // =====================================================
  // STATUS
  // =====================================================

  const isDraft =
    data.status === "DRAFT";

  // =====================================================
  // TOTAL
  // =====================================================

  const totalQty =
    data.items.reduce(
      (total, item) =>
        total +
        Number(item.qty || 0),
      0
    );

  const totalValue =
    data.items.reduce(
      (total, item) =>
        total +
        Number(item.qty || 0) *
          Number(
            item.price || 0
          ),
      0
    );

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <button
            type="button"
            onClick={() =>
              router.push(
                "/pengiriman"
              )
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

        {/* ================================================= */}
        {/* ACTION HEADER */}
        {/* ================================================= */}

        {isDraft ? (
          <div className="flex gap-2">

            {/* HAPUS DRAFT */}

            <button
              type="button"
              onClick={
                deleteDraft
              }
              disabled={
                saving ||
                deleting
              }
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}

              Hapus Draft
            </button>

            {/* SIMPAN */}

            <button
              type="button"
              onClick={
                saveDraft
              }
              disabled={
                saving ||
                deleting
              }
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

      {/* ================================================= */}
      {/* INFO */}
      {/* ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

        {/* CUSTOMER */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Customer
          </p>

          <p className="mt-2 font-semibold text-slate-800">
            {data.customer?.name ||
              "-"}
          </p>

          {data.customer?.code && (
            <p className="mt-1 text-xs text-slate-400">
              {data.customer.code}
            </p>
          )}

        </div>

        {/* TANGGAL */}

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

        {/* TOTAL QTY */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Total Qty
          </p>

          <p className="mt-2 text-xl font-bold text-slate-900">
            {totalQty.toLocaleString(
              "id-ID"
            )}
          </p>

        </div>

      </div>

      {/* ================================================= */}
      {/* NOTE */}
      {/* ================================================= */}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <label className="text-sm font-semibold text-slate-700">
          Keterangan
        </label>

        {isDraft ? (
          <textarea
            value={note}
            onChange={(e) =>
              setNote(
                e.target.value
              )
            }
            rows={3}
            placeholder="Keterangan barang keluar..."
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
          />
        ) : (
          <p className="mt-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {data.remarks ||
              "-"}
          </p>
        )}

      </div>

      {/* ================================================= */}
      {/* ITEMS */}
      {/* ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {/* ITEMS HEADER */}

        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">

          <div className="flex items-center gap-3">

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

          {/* TAMBAH BARANG */}

          {isDraft && (
            <button
              type="button"
              onClick={
                openAddModal
              }
              disabled={
                saving ||
                deleting
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />

              Tambah Barang
            </button>
          )}

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="w-full min-w-[980px]">

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

                <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Aksi
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-100">

              {data.items.length >
              0 ? (
                data.items.map(
                  (
                    item,
                    index
                  ) => (
                    <tr
                      key={
                        item.id ??
                        `new-${item.barangId}-${index}`
                      }
                      className="transition hover:bg-slate-50"
                    >

                      {/* KODE */}

                      <td className="px-5 py-4">

                        <span className="font-mono text-sm font-semibold text-slate-700">
                          {item.barang
                            ?.code ||
                            "-"}
                        </span>

                      </td>

                      {/* BARANG */}

                      <td className="px-5 py-4">

                        <div className="font-medium text-slate-800">
                          {item.barang
                            ?.name ||
                            "-"}
                        </div>

                      </td>

                      {/* STOCK */}

                      <td className="px-5 py-4 text-right text-sm text-slate-500">

                        {Number(
                          item.barang
                            ?.stock ||
                            0
                        ).toLocaleString(
                          "id-ID"
                        )}

                      </td>

                      {/* QTY */}

                      <td className="px-5 py-4 text-right">

                        {isDraft ? (
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={
                              item.qty
                            }
                            onChange={(
                              e
                            ) =>
                              updateQtyByIndex(
                                index,
                                e.target
                                  .value
                              )
                            }
                            disabled={
                              saving ||
                              deleting
                            }
                            className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        ) : (
                          <span className="font-semibold text-slate-700">
                            {Number(
                              item.qty
                            ).toLocaleString(
                              "id-ID"
                            )}
                          </span>
                        )}

                      </td>

                      {/* HARGA */}

                      <td className="px-5 py-4 text-right">

                        <span className="text-sm font-medium text-slate-700">
                          Rp{" "}
                          {Number(
                            item.price ||
                              0
                          ).toLocaleString(
                            "id-ID"
                          )}
                        </span>

                      </td>

                      {/* SUBTOTAL */}

                      <td className="px-5 py-4 text-right">

                        <span className="font-semibold text-slate-800">
                          Rp{" "}
                          {(
                            Number(
                              item.qty ||
                                0
                            ) *
                            Number(
                              item.price ||
                                0
                            )
                          ).toLocaleString(
                            "id-ID"
                          )}
                        </span>

                      </td>

                      {/* AKSI */}

                      <td className="px-5 py-4 text-center">

                        {isDraft ? (
                          <button
                            type="button"
                            onClick={() =>
                              removeItem(
                                index
                              )
                            }
                            disabled={
                              saving ||
                              deleting
                            }
                            title="Hapus item"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">
                            -
                          </span>
                        )}

                      </td>

                    </tr>
                  )
                )
              ) : (
                <tr>

                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <Package className="h-8 w-8 text-slate-300" />

                      <p className="mt-2 text-sm text-slate-400">
                        Tidak ada barang.
                      </p>

                      {isDraft && (
                        <button
                          type="button"
                          onClick={
                            openAddModal
                          }
                          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <Plus className="h-4 w-4" />
                          Tambah Barang
                        </button>
                      )}

                    </div>

                  </td>

                </tr>
              )}

            </tbody>

            {/* TOTAL */}

            <tfoot>

              <tr className="border-t border-slate-200 bg-slate-50">

                <td
                  colSpan={6}
                  className="px-5 py-4 text-right text-sm font-semibold text-slate-600"
                >
                  Total
                </td>

                <td className="px-5 py-4 text-right text-base font-bold text-slate-900">

                  Rp{" "}
                  {totalValue.toLocaleString(
                    "id-ID"
                  )}

                </td>

              </tr>

            </tfoot>

          </table>

        </div>

      </div>

      {/* ================================================= */}
      {/* RELEASE WARNING */}
      {/* ================================================= */}

      {isDraft && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">

          <strong>
            Draft:
          </strong>{" "}

          perubahan pada dokumen ini belum
          mengurangi stock, batch expired,
          inventory, stock card, atau stock
          mutation. Semua transaksi stock baru
          dijalankan ketika Delivery Order
          di-Release.

        </div>
      )}

      {/* ================================================= */}
      {/* MODAL TAMBAH BARANG */}
      {/* ================================================= */}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">

              <div>

                <h2 className="text-lg font-bold text-slate-900">
                  Tambah Barang
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Pilih barang untuk ditambahkan ke Delivery Order
                </p>

              </div>

              <button
                type="button"
                onClick={
                  closeAddModal
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            {/* SEARCH */}

            <div className="border-b border-slate-200 p-5">

              <div className="relative">

                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  value={
                    searchBarang
                  }
                  onChange={(
                    e
                  ) =>
                    setSearchBarang(
                      e.target.value
                    )
                  }
                  autoFocus
                  placeholder="Cari kode atau nama barang..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />

              </div>

            </div>

            {/* LIST */}

            <div className="flex-1 overflow-y-auto">

              {loadingBarang ? (
                <div className="flex min-h-[250px] items-center justify-center">

                  <div className="flex flex-col items-center gap-3">

                    <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />

                    <p className="text-sm text-slate-500">
                      Memuat barang...
                    </p>

                  </div>

                </div>
              ) : barangList.length >
                0 ? (
                <div className="divide-y divide-slate-100">

                  {barangList.map(
                    (
                      barang
                    ) => {

                      const alreadyExists =
                        data.items.some(
                          (
                            item
                          ) =>
                            Number(
                              item.barangId
                            ) ===
                            Number(
                              barang.id
                            )
                        );

                      const summaryPrice =
                        Number(
                          barang
                            .priceSummary
                            ?.lastPrice ??
                            0
                        );

                      const sellingPrice =
                        Number(
                          barang.sellingPrice ??
                            0
                        );

                      const displayPrice =
                        summaryPrice >
                        0
                          ? summaryPrice
                          : sellingPrice;

                      return (
                        <button
                          key={
                            barang.id
                          }
                          type="button"
                          onClick={() =>
                            !alreadyExists &&
                            addBarang(
                              barang
                            )
                          }
                          disabled={
                            alreadyExists
                          }
                          className={`flex w-full items-center gap-4 px-5 py-4 text-left transition ${
                            alreadyExists
                              ? "cursor-not-allowed bg-slate-50 opacity-60"
                              : "hover:bg-emerald-50"
                          }`}
                        >

                          {/* ICON */}

                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                            {alreadyExists ? (
                              <Check className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <Package className="h-5 w-5 text-emerald-600" />
                            )}
                          </div>

                          {/* INFO */}

                          <div className="min-w-0 flex-1">

                            <div className="flex items-center gap-2">

                              <p className="truncate font-semibold text-slate-800">
                                {
                                  barang.name
                                }
                              </p>

                              {alreadyExists && (
                                <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                  SUDAH DITAMBAHKAN
                                </span>
                              )}

                            </div>

                            <p className="mt-1 font-mono text-xs text-slate-400">
                              {
                                barang.code
                              }
                            </p>

                          </div>

                          {/* STOCK */}

                          <div className="shrink-0 text-right">

                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Stock
                            </p>

                            <p
                              className={`mt-1 text-sm font-bold ${
                                Number(
                                  barang.stock
                                ) >
                                0
                                  ? "text-slate-700"
                                  : "text-red-600"
                              }`}
                            >
                              {Number(
                                barang.stock
                              ).toLocaleString(
                                "id-ID"
                              )}
                            </p>

                          </div>

                          {/* HARGA */}

                          <div className="w-32 shrink-0 text-right">

                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Harga
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-700">
                              Rp{" "}
                              {displayPrice.toLocaleString(
                                "id-ID"
                              )}
                            </p>

                          </div>

                        </button>
                      );
                    }
                  )}

                </div>
              ) : (
                <div className="flex min-h-[250px] flex-col items-center justify-center px-5 text-center">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">

                    <Package className="h-7 w-7 text-slate-300" />

                  </div>

                  <p className="mt-4 font-semibold text-slate-600">
                    Barang tidak ditemukan
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    Coba gunakan kode atau nama barang yang berbeda.
                  </p>

                </div>
              )}

            </div>

            {/* MODAL FOOTER */}

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4">

              <p className="text-xs text-slate-500">
                Harga otomatis mengambil{" "}
                <strong>
                  Last Price
                </strong>{" "}
                terlebih dahulu.
              </p>

              <button
                type="button"
                onClick={
                  closeAddModal
                }
                disabled={
                  loadingBarang
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Tutup
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}