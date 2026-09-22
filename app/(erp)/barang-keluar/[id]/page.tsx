"use client";

import { useEffect, useMemo, useState } from "react";
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
  CalendarDays,
  UserRound,
  Boxes,
  FileText,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  CircleDollarSign,
  Warehouse,
  Minus,
  Sparkles,
  CheckCircle2,
  Ban,
  Info,
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
  voided?: boolean;
  voidedAt?: string | null;
  voidedById?: number | null;
  voidReason?: string | null;
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
  const [deliveryDate, setDeliveryDate] = useState("");

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

      const normalizedItems: Item[] = (delivery.items || []).map(
        (item: any) => {
          const priceFromItem = Number(item.price ?? 0);

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
        }
      );

      setData({
        ...delivery,
        items: normalizedItems,
      });

      setNote(delivery?.remarks || "");
      setDeliveryDate(formatDateInput(delivery?.deliveryDate));
    } catch (error: any) {
      console.error("LOAD BARANG KELUAR ERROR:", error);

      alert(error?.message || "Gagal mengambil data barang keluar");

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

      const keyword = searchBarang.trim();

      const url = keyword
        ? `/api/master/barang?search=${encodeURIComponent(keyword)}`
        : `/api/master/barang`;

      const res = await fetch(url, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json.message || "Gagal mengambil data barang"
        );
      }

      let list: any[] = [];

      if (Array.isArray(json)) {
        list = json;
      } else if (Array.isArray(json.data)) {
        list = json.data;
      } else if (Array.isArray(json.data?.items)) {
        list = json.data.items;
      } else if (Array.isArray(json.items)) {
        list = json.items;
      }

      const normalized: BarangSearch[] = list.map((barang: any) => ({
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

        stock: Number(barang.stock ?? 0),

        sellingPrice:
          barang.sellingPrice != null
            ? Number(barang.sellingPrice)
            : 0,

        priceSummary: barang.priceSummary
          ? {
              lastPrice:
                barang.priceSummary.lastPrice != null
                  ? Number(barang.priceSummary.lastPrice)
                  : 0,
            }
          : null,
      }));

      setBarangList(normalized);
    } catch (error: any) {
      console.error("LOAD MASTER BARANG ERROR:", error);

      alert(error?.message || "Gagal mengambil data barang");

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
  // TAMBAH BARANG
  // =====================================================

  function addBarang(barang: BarangSearch) {
    if (!data) return;

    if (data.status !== "DRAFT") {
      alert(
        "Delivery Order yang sudah RELEASED tidak dapat diubah."
      );
      return;
    }

    const alreadyExists = data.items.some(
      (item) =>
        Number(item.barangId) === Number(barang.id)
    );

    if (alreadyExists) {
      alert(`${barang.name} sudah ada dalam Delivery Order.`);
      return;
    }

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

    const qty = 1;

    const newItem: Item = {
      id: undefined,
      barangId: barang.id,
      qty,
      price,
      subtotal: qty * price,

      barang: {
        id: barang.id,
        code: barang.code,
        name: barang.name,
        stock: Number(barang.stock ?? 0),
        sellingPrice,
        priceSummary: barang.priceSummary
          ? {
              lastPrice: summaryPrice,
            }
          : null,
      },
    };

    setData({
      ...data,
      items: [...data.items, newItem],
    });

    setShowAddModal(false);
    setSearchBarang("");
    setBarangList([]);

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

    if (itemId === undefined) return;

    const qty = Number(value);

    setData({
      ...data,

      items: data.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              qty,
              subtotal: Number(item.price || 0) * qty,
            }
          : item
      ),
    });
  }

  // =====================================================
  // UPDATE QTY INDEX
  // =====================================================

  function updateQtyByIndex(
    index: number,
    value: string
  ) {
    if (!data) return;

    const qty = Number(value);

    setData({
      ...data,

      items: data.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              qty,
              subtotal: Number(item.price || 0) * qty,
            }
          : item
      ),
    });
  }

  // =====================================================
  // HAPUS ITEM
  // =====================================================

  function removeItem(index: number) {
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

    const item = data.items[index];

    if (!item) return;

    const namaBarang = item.barang?.name || "barang";

    const qty = Number(item.qty || 0);

    const yakin = confirm(
      `Hapus barang "${namaBarang}" dari Delivery Order?\n\n` +
        `Qty: ${qty.toLocaleString("id-ID")}\n\n` +
        `Karena dokumen masih DRAFT, penghapusan ini tidak akan mengubah stock.`
    );

    if (!yakin) return;

    setData({
      ...data,
      items: data.items.filter(
        (_, itemIndex) => itemIndex !== index
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

    if (!deliveryDate) {
      alert("Tanggal Delivery Order wajib diisi.");
      return;
    }

    if (data.items.length === 0) {
      alert(
        "Delivery Order harus memiliki minimal 1 barang."
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

      const stock = Number(item.barang?.stock ?? 0);

      if (Number(item.qty) > stock) {
        alert(
          `Stock ${item.barang?.name || "barang"} tidak cukup.\n\n` +
            `Stock tersedia: ${stock.toLocaleString("id-ID")}\n` +
            `Qty diminta: ${Number(item.qty).toLocaleString("id-ID")}`
        );

        return;
      }
    }

    try {
      setSaving(true);

      const res = await fetch(`/api/barang-keluar/${id}`, {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          customerId: data.customer?.id ?? null,

          deliveryDate,

          remarks: note,

          items: data.items.map((item) => ({
            id: item.id,

            barangId: item.barangId,

            qty: Number(item.qty),

            price: Number(item.price || 0),

            subtotal:
              Number(item.qty || 0) *
              Number(item.price || 0),
          })),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Gagal menyimpan perubahan"
        );
      }

      alert("Draft berhasil diperbarui.");

      await loadData();
    } catch (error: any) {
      console.error("SAVE BARANG KELUAR ERROR:", error);

      alert(
        error?.message || "Gagal menyimpan perubahan"
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

      const res = await fetch(`/api/barang-keluar/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Gagal menghapus draft"
        );
      }

      alert("Draft berhasil dihapus.");

      router.push("/pengiriman");
    } catch (error: any) {
      console.error("DELETE BARANG KELUAR ERROR:", error);

      alert(
        error?.message || "Gagal menghapus draft"
      );
    } finally {
      setDeleting(false);
    }
  }

  // =====================================================
  // VOID ITEM
  // =====================================================

  async function voidItem(item: Item) {
    if (
      !data ||
      data.status !== "RELEASED" ||
      !item.id ||
      item.voided
    ) {
      return;
    }

    const reason = window.prompt(
      `Alasan Void item ${item.barang?.name || ""}:`
    );

    if (reason === null) return;

    if (reason.trim().length < 3) {
      alert("Alasan Void minimal 3 karakter.");
      return;
    }

    if (
      !window.confirm(
        `Void item ${item.barang?.name || ""} sebanyak ${
          item.qty
        }?\n\nStock pusat akan dikembalikan dan transfer outlet akan disesuaikan.`
      )
    ) {
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(
        `/api/delivery/${data.id}/items/${item.id}/void`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: reason.trim(),
          }),
        }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Gagal melakukan Void Item."
        );
      }

      alert(json.message || "Item berhasil di-Void.");

      await loadData();
    } catch (e: any) {
      alert(
        e?.message || "Gagal melakukan Void Item."
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // HELPERS
  // =====================================================

  function formatCurrency(value: number) {
    return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
  }

  function formatNumber(value: number) {
    return Number(value || 0).toLocaleString("id-ID");
  }

  function formatDate(value: string) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    );
  }

  function formatDateInput(value: string) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="min-h-full bg-[#F4F7F5]">
        <div className="flex min-h-[620px] items-center justify-center px-6">
          <div className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-slate-200/80 bg-white p-10 text-center shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF6F3]">
              <div className="absolute inset-0 animate-ping rounded-2xl bg-[#DCEDE7] opacity-30" />

              <RefreshCw className="relative h-6 w-6 animate-spin text-[#497F70]" />
            </div>

            <p className="mt-5 text-sm font-bold text-slate-800">
              Memuat Delivery Order
            </p>

            <p className="mt-1.5 text-xs leading-5 text-slate-400">
              Menyiapkan detail dokumen dan informasi
              barang...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // =====================================================
  // DERIVED DATA
  // =====================================================

  const isDraft = data.status === "DRAFT";
  const isReleased = data.status === "RELEASED";

  const activeItems = data.items.filter(
    (item) => !item.voided
  );

  const voidedItems = data.items.filter(
    (item) => item.voided
  );

  const totalQty = activeItems.reduce(
    (total, item) =>
      total + Number(item.qty || 0),
    0
  );

  const totalValue = activeItems.reduce(
    (total, item) =>
      total +
      Number(item.qty || 0) *
        Number(item.price || 0),
    0
  );

  const totalItemCount = data.items.length;

  const totalStockValue = activeItems.reduce(
    (total, item) =>
      total +
      Number(item.barang?.stock || 0),
    0
  );

  const zeroStockItems = activeItems.filter(
    (item) =>
      Number(item.barang?.stock || 0) <= 0
  ).length;

  const statusLabel = isDraft
    ? "DRAFT"
    : "RELEASED";

  return (
    <div className="min-h-full bg-[#F4F7F5]">
      {/* ================================================= */}
      {/* TOP ACCENT */}
      {/* ================================================= */}

      <div className="h-1 bg-gradient-to-r from-[#18352D] via-[#497F70] to-[#8DB5A8]" />

      <div className="mx-auto max-w-[1600px] px-4 py-5 md:px-6 md:py-7 xl:px-8">

        {/* ================================================= */}
        {/* BREADCRUMB */}
        {/* ================================================= */}

        <div className="mb-5 flex items-center gap-2 text-xs font-medium text-slate-400">
          <button
            type="button"
            onClick={() => router.push("/pengiriman")}
            className="transition hover:text-[#497F70]"
          >
            Pengiriman
          </button>

          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />

          <span className="text-slate-500">
            Detail
          </span>

          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />

          <span className="font-semibold text-slate-700">
            {data.number}
          </span>
        </div>

        {/* ================================================= */}
        {/* HERO HEADER */}
        {/* ================================================= */}

        <div className="relative mb-6 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_8px_35px_rgba(15,23,42,0.055)]">

          <div className="absolute right-[-80px] top-[-100px] h-64 w-64 rounded-full bg-[#E8F3EF] blur-3xl" />

          <div className="absolute bottom-[-100px] left-[35%] h-52 w-52 rounded-full bg-slate-100/70 blur-3xl" />

          <div className="relative px-5 py-6 md:px-7 md:py-7 xl:px-8">

            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

              <div className="flex min-w-0 items-start gap-4">

                <button
                  type="button"
                  onClick={() => router.push("/pengiriman")}
                  className="group mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-[#C7DDD6] hover:bg-[#F4F9F7] hover:text-[#315F52]"
                  title="Kembali"
                >
                  <ArrowLeft className="h-5 w-5 transition group-hover:-translate-x-0.5" />
                </button>

                <div className="min-w-0">

                  <div className="mb-2.5 flex flex-wrap items-center gap-2">

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D8E8E2] bg-[#F0F7F4] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[#497F70]">
                      <FileText className="h-3 w-3" />
                      Delivery Order
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] ${
                        isDraft
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isDraft
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                      />

                      {statusLabel}
                    </span>

                    {isReleased && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-blue-600">
                        <Lock className="h-3 w-3" />
                        Locked
                      </span>
                    )}

                  </div>

                  <div className="flex flex-wrap items-center gap-2">

                    <h1 className="max-w-full truncate text-2xl font-black tracking-[-0.025em] text-slate-950 md:text-[32px]">
                      {data.number}
                    </h1>

                    <ChevronRight className="hidden h-5 w-5 text-slate-300 md:block" />

                    <span className="hidden text-sm font-medium text-slate-400 md:block">
                      Detail Barang Keluar
                    </span>

                  </div>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Kelola detail barang, quantity, harga,
                    customer, dan informasi transaksi Delivery
                    Order.
                  </p>

                </div>

              </div>

              {/* ACTIONS */}

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">

                {isDraft ? (
                  <>
                    <button
                      type="button"
                      onClick={deleteDraft}
                      disabled={saving || deleting}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#18352D] px-5 text-sm font-bold text-white shadow-[0_7px_20px_rgba(24,53,45,0.16)] transition hover:bg-[#24483E] hover:shadow-[0_9px_25px_rgba(24,53,45,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}

                      Simpan Perubahan
                    </button>
                  </>
                ) : (
                  <div className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-500">
                    <Lock className="h-4 w-4" />
                    Dokumen sudah RELEASED
                  </div>
                )}

              </div>

            </div>

            {/* HERO META */}

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-100 pt-5">

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <CalendarDays className="h-4 w-4 text-slate-300" />
                {isDraft ? (
                  <label className="flex items-center gap-2">
                    <span>Tanggal</span>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      disabled={saving || deleting}
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </label>
                ) : (
                  <span>
                    Tanggal{" "}
                    <strong className="ml-1 font-semibold text-slate-600">
                      {formatDate(data.deliveryDate)}
                    </strong>
                  </span>
                )}
              </div>

              <div className="hidden h-4 w-px bg-slate-200 sm:block" />

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <UserRound className="h-4 w-4 text-slate-300" />
                <span>
                  Customer{" "}
                  <strong className="ml-1 font-semibold text-slate-600">
                    {data.customer?.name || "-"}
                  </strong>
                </span>
              </div>

              <div className="hidden h-4 w-px bg-slate-200 sm:block" />

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Package className="h-4 w-4 text-slate-300" />
                <span>
                  {formatNumber(totalItemCount)} item
                </span>
              </div>

            </div>

          </div>
        </div>

        {/* ================================================= */}
        {/* KPI CARDS */}
        {/* ================================================= */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* CUSTOMER */}

          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]">

            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#EDF6F2] blur-2xl" />

            <div className="relative">

              <div className="mb-5 flex items-center justify-between">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF6F3] ring-4 ring-[#F7FBF9]">
                  <UserRound className="h-5 w-5 text-[#497F70]" />
                </div>

                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-300">
                  Customer
                </span>

              </div>

              <p className="truncate text-[15px] font-bold text-slate-800">
                {data.customer?.name || "-"}
              </p>

              <p className="mt-1 truncate text-xs font-medium text-slate-400">
                {data.customer?.code ||
                  "Tidak ada kode customer"}
              </p>

            </div>
          </div>

          {/* DATE */}

          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]">

            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-blue-50 blur-2xl" />

            <div className="relative">

              <div className="mb-5 flex items-center justify-between">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 ring-4 ring-blue-50/50">
                  <CalendarDays className="h-5 w-5 text-blue-600" />
                </div>

                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-300">
                  Tanggal
                </span>

              </div>

              <p className="text-[15px] font-bold text-slate-800">
                {formatDate(data.deliveryDate)}
              </p>

              <p className="mt-1 text-xs font-medium text-slate-400">
                Tanggal dokumen
              </p>

            </div>
          </div>

          {/* QUANTITY */}

          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]">

            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-violet-50 blur-2xl" />

            <div className="relative">

              <div className="mb-5 flex items-center justify-between">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 ring-4 ring-violet-50/50">
                  <Boxes className="h-5 w-5 text-violet-600" />
                </div>

                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-300">
                  Quantity
                </span>

              </div>

              <p className="text-[25px] font-black tracking-tight text-slate-900">
                {formatNumber(totalQty)}
              </p>

              <p className="mt-1 text-xs font-medium text-slate-400">
                Total quantity aktif
              </p>

            </div>
          </div>

          {/* VALUE */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDEAE5] bg-gradient-to-br from-white to-[#F5FAF8] p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]">

            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-50 blur-2xl" />

            <div className="relative">

              <div className="mb-5 flex items-center justify-between">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 ring-4 ring-emerald-50/50">
                  <CircleDollarSign className="h-5 w-5 text-emerald-600" />
                </div>

                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-300">
                  Total Nilai
                </span>

              </div>

              <p className="truncate text-[21px] font-black tracking-tight text-slate-900">
                {formatCurrency(totalValue)}
              </p>

              <p className="mt-1 text-xs font-medium text-slate-400">
                Nilai item aktif
              </p>

            </div>
          </div>

        </div>

        {/* ================================================= */}
        {/* STATUS INFORMATION */}
        {/* ================================================= */}

        <div className="mb-6">

          {isDraft ? (
            <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-[#FFFDF7] p-5">

              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-amber-100/50 blur-3xl" />

              <div className="relative flex items-start gap-4">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                  <ShieldCheck className="h-5 w-5 text-amber-600" />
                </div>

                <div className="min-w-0">

                  <div className="flex flex-wrap items-center gap-2">

                    <h3 className="text-sm font-bold text-amber-900">
                      Dokumen masih DRAFT
                    </h3>

                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                      Belum Posting Stock
                    </span>

                  </div>

                  <p className="mt-1.5 max-w-4xl text-xs leading-5 text-amber-800/70">
                    Perubahan pada dokumen belum mengurangi
                    stock, memproses batch FEFO, memperbarui
                    inventory, maupun membuat Stock Card dan
                    Stock Mutation. Transaksi stock baru
                    dijalankan ketika Delivery Order di-release.
                  </p>

                </div>

              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-[#F9FFFC] p-5">

              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-100/60 blur-3xl" />

              <div className="relative flex items-start gap-4">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>

                <div className="min-w-0">

                  <div className="flex flex-wrap items-center gap-2">

                    <h3 className="text-sm font-bold text-emerald-900">
                      Delivery Order sudah RELEASED
                    </h3>

                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                      Stock Posted
                    </span>

                  </div>

                  <p className="mt-1.5 max-w-4xl text-xs leading-5 text-emerald-800/70">
                    Dokumen sudah diproses sebagai transaksi
                    stock. Item aktif tidak dapat diedit. Jika
                    diperlukan koreksi, Void dilakukan per item
                    sehingga item lainnya tetap tidak berubah.
                  </p>

                </div>

              </div>
            </div>
          )}

        </div>

        {/* ================================================= */}
        {/* NOTE */}
        {/* ================================================= */}

        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.035)]">

          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 md:px-6">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                <FileText className="h-4 w-4 text-slate-500" />
              </div>

              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Keterangan Dokumen
                </h2>

                <p className="mt-0.5 text-[11px] text-slate-400">
                  Informasi tambahan Delivery Order
                </p>
              </div>

            </div>

            <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-400 sm:block">
              Remarks
            </span>

          </div>

          <div className="p-5 md:p-6">

            {isDraft ? (
              <textarea
                value={note}
                onChange={(e) =>
                  setNote(e.target.value)
                }
                rows={3}
                placeholder="Tambahkan keterangan barang keluar..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-[#F8FAF9] px-4 py-3.5 text-sm leading-6 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
              />
            ) : (
              <div className="rounded-xl border border-slate-100 bg-[#F8FAF9] px-4 py-3.5 text-sm leading-6 text-slate-600">
                {data.remarks || (
                  <span className="text-slate-400">
                    Tidak ada keterangan.
                  </span>
                )}
              </div>
            )}

          </div>
        </div>

        {/* ================================================= */}
        {/* DETAIL BARANG */}
        {/* ================================================= */}

        <div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_6px_24px_rgba(15,23,42,0.045)]">

          {/* HEADER */}

          <div className="border-b border-slate-100 px-5 py-5 md:px-6">

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF6F3] ring-4 ring-[#F8FBFA]">
                  <Package className="h-5 w-5 text-[#497F70]" />
                </div>

                <div>

                  <div className="flex items-center gap-2">

                    <h2 className="text-base font-black text-slate-800">
                      Detail Barang
                    </h2>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-500">
                      {totalItemCount} ITEM
                    </span>

                  </div>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Daftar barang dan nilai transaksi
                  </p>

                </div>

              </div>

              <div className="flex items-center gap-2">

                <div className="hidden items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 sm:flex">
                  <Warehouse className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[10px] font-semibold text-slate-500">
                    {zeroStockItems > 0
                      ? `${zeroStockItems} stock kosong`
                      : "Stock tersedia"}
                  </span>
                </div>

                {isDraft && (
                  <button
                    type="button"
                    onClick={openAddModal}
                    disabled={saving || deleting}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#18352D] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#24483E] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah Barang
                  </button>
                )}

              </div>

            </div>

          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1100px]">

              <thead>
                <tr className="border-b border-slate-100 bg-[#F8FAF9]">

                  <th className="w-16 px-5 py-3.5 text-left text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                    #
                  </th>

                  <th className="px-5 py-3.5 text-left text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Barang
                  </th>

                  <th className="px-5 py-3.5 text-right text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Stock
                  </th>

                  <th className="px-5 py-3.5 text-right text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Qty
                  </th>

                  <th className="px-5 py-3.5 text-right text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Harga
                  </th>

                  <th className="px-5 py-3.5 text-right text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Subtotal
                  </th>

                  <th className="px-5 py-3.5 text-center text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Status / Aksi
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {data.items.length > 0 ? (
                  data.items.map((item, index) => {

                    const itemSubtotal =
                      Number(item.qty || 0) *
                      Number(item.price || 0);

                    const stock =
                      Number(item.barang?.stock || 0);

                    const isStockLow =
                      stock <= 0;

                    return (
                      <tr
                        key={
                          item.id ??
                          `new-${item.barangId}-${index}`
                        }
                        className={`group transition ${
                          item.voided
                            ? "bg-red-50/40"
                            : "hover:bg-[#FBFDFC]"
                        }`}
                      >

                        {/* NUMBER */}

                        <td className="px-5 py-5">

                          <span className="text-xs font-bold text-slate-300">
                            {String(index + 1).padStart(
                              2,
                              "0"
                            )}
                          </span>

                        </td>

                        {/* BARANG */}

                        <td className="px-5 py-5">

                          <div className="flex items-center gap-3">

                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                item.voided
                                  ? "bg-red-100"
                                  : "bg-[#EEF6F3]"
                              }`}
                            >
                              {item.voided ? (
                                <Ban className="h-4 w-4 text-red-500" />
                              ) : (
                                <Package className="h-4 w-4 text-[#497F70]" />
                              )}
                            </div>

                            <div className="min-w-0">

                              <div className="flex flex-wrap items-center gap-2">

                                <p
                                  className={`truncate text-sm font-bold ${
                                    item.voided
                                      ? "text-slate-400 line-through"
                                      : "text-slate-800"
                                  }`}
                                >
                                  {item.barang?.name ||
                                    "-"}
                                </p>

                                {item.voided && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-red-700">
                                    <X className="h-2.5 w-2.5" />
                                    Void
                                  </span>
                                )}

                              </div>

                              <div className="mt-1.5 flex items-center gap-2">

                                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500">
                                  {item.barang?.code ||
                                    "-"}
                                </span>

                              </div>

                            </div>

                          </div>

                        </td>

                        {/* STOCK */}

                        <td className="px-5 py-5 text-right">

                          <div className="flex flex-col items-end">

                            <span
                              className={`text-sm font-bold ${
                                isStockLow
                                  ? "text-red-600"
                                  : "text-slate-700"
                              }`}
                            >
                              {formatNumber(stock)}
                            </span>

                            <span
                              className={`mt-0.5 text-[9px] font-medium ${
                                isStockLow
                                  ? "text-red-400"
                                  : "text-slate-400"
                              }`}
                            >
                              {isStockLow
                                ? "Stock kosong"
                                : "unit tersedia"}
                            </span>

                          </div>

                        </td>

                        {/* QTY */}

                        <td className="px-5 py-5 text-right">

                          {isDraft ? (
                            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-[#F8FAF9] p-0.5 shadow-inner">

                              <button
                                type="button"
                                onClick={() =>
                                  updateQtyByIndex(
                                    index,
                                    String(
                                      Math.max(
                                        1,
                                        Number(
                                          item.qty || 1
                                        ) - 1
                                      )
                                    )
                                  )
                                }
                                disabled={
                                  saving ||
                                  deleting ||
                                  Number(item.qty) <= 1
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>

                              <input
                                type="number"
                                min="1"
                                step="any"
                                value={item.qty}
                                onChange={(e) =>
                                  updateQtyByIndex(
                                    index,
                                    e.target.value
                                  )
                                }
                                disabled={
                                  saving || deleting
                                }
                                className="w-16 border-0 bg-transparent px-1 py-1.5 text-center text-sm font-black text-slate-700 outline-none"
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  updateQtyByIndex(
                                    index,
                                    String(
                                      Number(
                                        item.qty || 0
                                      ) + 1
                                    )
                                  )
                                }
                                disabled={
                                  saving || deleting
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-[#497F70] disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>

                            </div>
                          ) : (
                            <span className="text-sm font-black text-slate-700">
                              {formatNumber(
                                Number(item.qty)
                              )}
                            </span>
                          )}

                        </td>

                        {/* PRICE */}

                        <td className="px-5 py-5 text-right">

                          <span className="text-sm font-semibold text-slate-600">
                            {formatCurrency(
                              Number(item.price || 0)
                            )}
                          </span>

                        </td>

                        {/* SUBTOTAL */}

                        <td className="px-5 py-5 text-right">

                          <span
                            className={`text-sm font-black ${
                              item.voided
                                ? "text-slate-400 line-through"
                                : "text-slate-900"
                            }`}
                          >
                            {formatCurrency(
                              itemSubtotal
                            )}
                          </span>

                        </td>

                        {/* ACTION */}

                        <td className="px-5 py-5 text-center">

                          {isDraft ? (
                            <button
                              type="button"
                              onClick={() =>
                                removeItem(index)
                              }
                              disabled={
                                saving || deleting
                              }
                              title="Hapus item"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-500 transition hover:border-red-300 hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : item.voided ? (
                            <div className="flex min-w-[140px] flex-col items-center gap-1.5">

                              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-red-700">
                                <Ban className="h-3 w-3" />
                                VOID
                              </span>

                              {item.voidReason && (
                                <span
                                  title={item.voidReason}
                                  className="max-w-44 truncate text-[10px] font-medium text-slate-400"
                                >
                                  {item.voidReason}
                                </span>
                              )}

                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                voidItem(item)
                              }
                              disabled={saving}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                              Void Item
                            </button>
                          )}

                        </td>

                      </tr>
                    );
                  })
                ) : (
                  <tr>

                    <td
                      colSpan={7}
                      className="px-5 py-20 text-center"
                    >

                      <div className="mx-auto flex max-w-sm flex-col items-center">

                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                          <Package className="h-7 w-7 text-slate-300" />
                        </div>

                        <p className="mt-5 text-sm font-bold text-slate-700">
                          Belum ada barang
                        </p>

                        <p className="mt-1.5 text-xs leading-5 text-slate-400">
                          Tambahkan minimal satu barang ke
                          dalam Delivery Order ini.
                        </p>

                        {isDraft && (
                          <button
                            type="button"
                            onClick={openAddModal}
                            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#18352D] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#24483E]"
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

                <tr className="border-t border-slate-200 bg-[#F8FAF9]">

                  <td
                    colSpan={5}
                    className="px-5 py-5 text-right"
                  >

                    <div className="flex items-center justify-end gap-2">

                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Total Aktif
                      </span>

                      <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-black text-slate-400 shadow-sm">
                        {activeItems.length} ITEM
                      </span>

                    </div>

                  </td>

                  <td className="px-5 py-5 text-right">

                    <span className="text-base font-black tracking-tight text-slate-950">
                      {formatCurrency(totalValue)}
                    </span>

                  </td>

                  <td />

                </tr>

              </tfoot>

            </table>

          </div>

        </div>

        {/* ================================================= */}
        {/* LOWER SUMMARY */}
        {/* ================================================= */}

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)]">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF6F3]">
                <Package className="h-4 w-4 text-[#497F70]" />
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-400">
                  Item Aktif
                </p>

                <p className="mt-1 text-lg font-black text-slate-800">
                  {activeItems.length}
                </p>
              </div>

            </div>

          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)]">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
                <Boxes className="h-4 w-4 text-violet-600" />
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-400">
                  Total Quantity
                </p>

                <p className="mt-1 text-lg font-black text-slate-800">
                  {formatNumber(totalQty)}
                </p>
              </div>

            </div>

          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)]">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                <CircleDollarSign className="h-4 w-4 text-emerald-600" />
              </div>

              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-400">
                  Nilai Aktif
                </p>

                <p className="mt-1 truncate text-lg font-black text-slate-800">
                  {formatCurrency(totalValue)}
                </p>
              </div>

            </div>

          </div>

        </div>

        {/* ================================================= */}
        {/* VOID SUMMARY */}
        {/* ================================================= */}

        {isReleased && voidedItems.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-red-200/80 bg-gradient-to-r from-red-50 to-white">

            <div className="flex items-start gap-4 p-5">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>

              <div className="min-w-0 flex-1">

                <div className="flex flex-wrap items-center gap-2">

                  <p className="text-sm font-black text-red-800">
                    {voidedItems.length} item telah di-Void
                  </p>

                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-700">
                    Riwayat Koreksi
                  </span>

                </div>

                <p className="mt-1.5 text-xs leading-5 text-red-700/70">
                  Item yang di-Void tidak dihitung dalam total
                  nilai aktif Delivery Order. Riwayat Void tetap
                  tersedia pada tabel detail barang.
                </p>

              </div>

            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* FOOTER SECURITY INFO */}
        {/* ================================================= */}

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-2.5">

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
            </div>

            <p className="text-[11px] font-medium text-slate-500">
              Dokumen menggunakan kontrol transaksi berbasis
              status.
            </p>

          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
            <Info className="h-3.5 w-3.5" />
            {isDraft
              ? "Perubahan belum memengaruhi stock"
              : "Dokumen terkunci setelah RELEASED"}
          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* MODAL TAMBAH BARANG */}
      {/* ================================================= */}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">

          <div
            className="absolute inset-0"
            onClick={() => {
              if (!loadingBarang) {
                closeAddModal();
              }
            }}
          />

          <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.25)]">

            {/* MODAL HEADER */}

            <div className="relative overflow-hidden border-b border-slate-100">

              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#EAF4F0] blur-3xl" />

              <div className="relative flex items-center justify-between px-5 py-5 md:px-7">

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF6F3] ring-4 ring-[#F8FBFA]">
                    <Sparkles className="h-5 w-5 text-[#497F70]" />
                  </div>

                  <div>

                    <div className="flex items-center gap-2">

                      <h2 className="text-base font-black text-slate-900 md:text-lg">
                        Tambah Barang
                      </h2>

                      <span className="rounded-full bg-[#EEF6F3] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#497F70]">
                        Draft
                      </span>

                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      Pilih barang dari Master Barang untuk
                      ditambahkan ke dokumen.
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={closeAddModal}
                  disabled={loadingBarang}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>

              </div>
            </div>

            {/* SEARCH */}

            <div className="border-b border-slate-100 bg-[#FAFCFB] px-5 py-4 md:px-7">

              <div className="relative">

                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  value={searchBarang}
                  onChange={(e) =>
                    setSearchBarang(e.target.value)
                  }
                  autoFocus
                  placeholder="Cari kode atau nama barang..."
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                />

                {searchBarang && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearchBarang("")
                    }
                    className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}

              </div>

              <div className="mt-3 flex items-center justify-between">

                <div className="flex items-center gap-2">

                  <Search className="h-3 w-3 text-slate-300" />

                  <p className="text-[10px] font-medium text-slate-400">
                    {searchBarang
                      ? `Hasil pencarian untuk "${searchBarang}"`
                      : "Gunakan kode atau nama untuk mencari barang."}
                  </p>

                </div>

                {!loadingBarang && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
                    {barangList.length} barang
                  </span>
                )}

              </div>

            </div>

            {/* LIST */}

            <div className="min-h-0 flex-1 overflow-y-auto">

              {loadingBarang ? (
                <div className="flex min-h-[340px] items-center justify-center">

                  <div className="flex flex-col items-center text-center">

                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF6F3]">
                      <RefreshCw className="h-6 w-6 animate-spin text-[#497F70]" />
                    </div>

                    <p className="mt-4 text-sm font-black text-slate-700">
                      Memuat Master Barang
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Mengambil data barang terbaru...
                    </p>

                  </div>

                </div>
              ) : barangList.length > 0 ? (
                <div className="divide-y divide-slate-100">

                  {barangList.map((barang) => {

                    const alreadyExists =
                      data.items.some(
                        (item) =>
                          Number(item.barangId) ===
                          Number(barang.id)
                      );

                    const summaryPrice =
                      Number(
                        barang.priceSummary?.lastPrice ??
                          0
                      );

                    const sellingPrice =
                      Number(
                        barang.sellingPrice ?? 0
                      );

                    const displayPrice =
                      summaryPrice > 0
                        ? summaryPrice
                        : sellingPrice;

                    const stock =
                      Number(barang.stock || 0);

                    return (
                      <button
                        key={barang.id}
                        type="button"
                        onClick={() =>
                          !alreadyExists &&
                          addBarang(barang)
                        }
                        disabled={alreadyExists}
                        className={`group flex w-full items-center gap-4 px-5 py-4 text-left transition md:px-7 ${
                          alreadyExists
                            ? "cursor-not-allowed bg-slate-50/80"
                            : "hover:bg-[#F5FAF8]"
                        }`}
                      >

                        {/* ICON */}

                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                            alreadyExists
                              ? "bg-slate-100"
                              : "bg-[#EEF6F3] group-hover:bg-[#E4F2ED]"
                          }`}
                        >
                          {alreadyExists ? (
                            <Check className="h-5 w-5 text-[#497F70]" />
                          ) : (
                            <Package className="h-5 w-5 text-[#497F70]" />
                          )}
                        </div>

                        {/* INFO */}

                        <div className="min-w-0 flex-1">

                          <div className="flex flex-wrap items-center gap-2">

                            <p
                              className={`truncate text-sm font-bold ${
                                alreadyExists
                                  ? "text-slate-400"
                                  : "text-slate-800"
                              }`}
                            >
                              {barang.name}
                            </p>

                            {alreadyExists && (
                              <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-500">
                                Sudah Ditambahkan
                              </span>
                            )}

                          </div>

                          <div className="mt-1.5 flex items-center gap-2">

                            <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500">
                              {barang.code || "-"}
                            </span>

                          </div>

                        </div>

                        {/* STOCK */}

                        <div className="hidden shrink-0 text-right sm:block">

                          <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-400">
                            Stock
                          </p>

                          <p
                            className={`mt-1 text-sm font-black ${
                              stock > 0
                                ? "text-slate-700"
                                : "text-red-600"
                            }`}
                          >
                            {formatNumber(stock)}
                          </p>

                        </div>

                        {/* PRICE */}

                        <div className="hidden w-36 shrink-0 text-right md:block">

                          <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-400">
                            Last Price
                          </p>

                          <p
                            className={`mt-1 text-sm font-black ${
                              displayPrice > 0
                                ? "text-slate-700"
                                : "text-red-500"
                            }`}
                          >
                            {formatCurrency(
                              displayPrice
                            )}
                          </p>

                        </div>

                        {/* ACTION */}

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition group-hover:bg-[#18352D] group-hover:text-white">

                          {alreadyExists ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}

                        </div>

                      </button>
                    );
                  })}

                </div>
              ) : (
                <div className="flex min-h-[340px] flex-col items-center justify-center px-5 text-center">

                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                    <Search className="h-7 w-7 text-slate-300" />
                  </div>

                  <p className="mt-5 text-sm font-black text-slate-700">
                    Barang tidak ditemukan
                  </p>

                  <p className="mt-1.5 max-w-sm text-xs leading-5 text-slate-400">
                    Coba gunakan kode atau nama barang yang
                    berbeda.
                  </p>

                </div>
              )}

            </div>

            {/* MODAL FOOTER */}

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-[#FAFCFB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-7">

              <div className="flex items-center gap-2.5">

                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EEF6F3]">
                  <CircleDollarSign className="h-3.5 w-3.5 text-[#497F70]" />
                </div>

                <p className="text-[10px] font-medium leading-5 text-slate-500">
                  Harga otomatis mengambil{" "}
                  <strong className="font-bold text-slate-700">
                    Last Price
                  </strong>{" "}
                  terlebih dahulu.
                </p>

              </div>

              <button
                type="button"
                onClick={closeAddModal}
                disabled={loadingBarang}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
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