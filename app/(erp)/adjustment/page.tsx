"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Eye,
  FileText,
  Filter,
  Loader2,
  MinusCircle,
  Package,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";

/* =========================================================
   TYPES
========================================================= */

type Barang = {
  id: number;
  code: string;
  name: string;
  barcode: string | null;
  unit: string | null;
  stock: number;
  purchasePrice?: number | null;
  sellingPrice?: number | null;
};

type AdjustmentItem = {
  id: number;
  barangId: number;
  qty: number;
  price: number;
  type: string;
  barang: Barang;
};

type Adjustment = {
  id: number;
  number: string;
  adjustmentDate: string;
  warehouse: string;
  type: string;
  reason: string | null;
  remarks: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  items: AdjustmentItem[];
};

type DraftItem = {
  tempId: string;
  barang: Barang;
  qty: string;
  price: string;
};

/* =========================================================
   CONSTANTS
========================================================= */

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const numberFormat = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

const API_URL = "/api/adjustment";

/* =========================================================
   HELPERS
========================================================= */

function formatDate(value: string | Date) {
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

function formatDateTime(value: string | Date) {
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

function formatQty(value: number | string) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return numberFormat.format(number);
}

/**
 * Normalisasi harga input Indonesia.
 *
 * Contoh:
 * "25000"   -> 25000
 * "25.000"  -> 25000
 * "25,000"  -> 25000
 * "Rp 25.000" -> 25000
 *
 * Kita sengaja hanya menyimpan digit karena harga ERP
 * tidak membutuhkan pecahan rupiah.
 */
function normalizePriceInput(value: string) {
  return value.replace(/\D/g, "");
}

function priceToNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  const normalized = normalizePriceInput(String(value));

  if (!normalized) {
    return 0;
  }

  const result = Number(normalized);

  return Number.isFinite(result)
    ? Math.max(0, result)
    : 0;
}

function formatPriceInput(value: string | number) {
  const number = priceToNumber(value);

  if (!number) {
    return "";
  }

  return new Intl.NumberFormat("id-ID").format(number);
}

function getToday() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function statusClass(status: string) {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "REJECTED":
      return "bg-red-50 text-red-700 border-red-200";

    case "DRAFT":
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

function typeClass(type: string) {
  return type === "MINUS"
    ? "bg-red-50 text-red-700 border-red-200"
    : "bg-emerald-50 text-emerald-700 border-emerald-200";
}

/* =========================================================
   BADGES
========================================================= */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(
        status
      )}`}
    >
      {status === "APPROVED" ? (
        <CheckCircle2 size={12} />
      ) : status === "REJECTED" ? (
        <X size={12} />
      ) : (
        <Clock3 size={12} />
      )}

      {status}
    </span>
  );
}

function TypeBadge({
  type,
}: {
  type: string;
}) {
  const isMinus = type === "MINUS";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${typeClass(
        type
      )}`}
    >
      {isMinus ? (
        <MinusCircle size={12} />
      ) : (
        <PlusCircle size={12} />
      )}

      {isMinus ? "PENGURANGAN" : "PENAMBAHAN"}
    </span>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function AdjustmentPage() {
  /* =======================================================
     DATA
  ======================================================= */

  const [data, setData] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* =======================================================
     FILTER
  ======================================================= */

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("SEMUA");
  const [typeFilter, setTypeFilter] = useState("SEMUA");

  /* =======================================================
     DETAIL
  ======================================================= */

  const [selected, setSelected] =
    useState<Adjustment | null>(null);

  /* =======================================================
     CREATE MODAL
  ======================================================= */

  const [showCreate, setShowCreate] = useState(false);

  const [formType, setFormType] =
    useState<"PLUS" | "MINUS">("PLUS");

  const [formDate, setFormDate] =
    useState(getToday());

  const [formWarehouse, setFormWarehouse] =
    useState("MAIN");

  const [formReason, setFormReason] =
    useState("");

  const [formRemarks, setFormRemarks] =
    useState("");

  const [draftItems, setDraftItems] =
    useState<DraftItem[]>([]);

  /* =======================================================
     BARANG SEARCH
  ======================================================= */

  const [barangSearch, setBarangSearch] =
    useState("");

  const [barangResults, setBarangResults] =
    useState<Barang[]>([]);

  const [searchingBarang, setSearchingBarang] =
    useState(false);

  /* =======================================================
     ACTION STATE
  ======================================================= */

  const [saving, setSaving] =
    useState(false);

  const [approvingId, setApprovingId] =
    useState<number | null>(null);

  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  const [error, setError] =
    useState("");

  /* =======================================================
     LOAD DATA
  ======================================================= */

  const load = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await fetch(API_URL, {
          method: "GET",
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ||
              "Gagal mengambil data adjustment"
          );
        }

        setData(
          Array.isArray(result.data)
            ? result.data
            : []
        );
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Gagal mengambil data adjustment"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  /* =======================================================
     SEARCH BARANG
  ======================================================= */

  useEffect(() => {
    const keyword = barangSearch.trim();

    if (!keyword) {
      setBarangResults([]);
      return;
    }

    const controller =
      new AbortController();

    const timer = window.setTimeout(
      async () => {
        try {
          setSearchingBarang(true);

          const response =
            await fetch(
              `/api/master/barang?search=${encodeURIComponent(
                keyword
              )}`,
              {
                signal:
                  controller.signal,
                cache: "no-store",
              }
            );

          const result =
            await response.json();

          if (
            response.ok &&
            result.success
          ) {
            const rows =
              Array.isArray(result.data)
                ? result.data
                : [];

            setBarangResults(
              rows.filter(
                (item: Barang) =>
                  item.active !== false
              )
            );
          } else {
            setBarangResults([]);
          }
        } catch (err) {
          if (
            err instanceof DOMException &&
            err.name === "AbortError"
          ) {
            return;
          }

          console.error(err);
          setBarangResults([]);
        } finally {
          setSearchingBarang(false);
        }
      },
      250
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [barangSearch]);

  /* =======================================================
     FORM RESET
  ======================================================= */

  const resetForm = useCallback(() => {
    setFormType("PLUS");
    setFormDate(getToday());
    setFormWarehouse("MAIN");
    setFormReason("");
    setFormRemarks("");
    setDraftItems([]);
    setBarangSearch("");
    setBarangResults([]);
    setError("");
  }, []);

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const closeCreate = () => {
    if (saving) {
      return;
    }

    setShowCreate(false);
    resetForm();
  };

  /* =======================================================
     ADD BARANG
  ======================================================= */

  const addBarang = (
    barang: Barang
  ) => {
    const exists = draftItems.some(
      (item) =>
        item.barang.id === barang.id
    );

    if (exists) {
      setError(
        `"${barang.name}" sudah ada di adjustment`
      );

      return;
    }

    setDraftItems((current) => [
      ...current,
      {
        tempId:
          `${barang.id}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,

        barang,

        qty: "",

        /**
         * IMPORTANT:
         * Harga default kosong, bukan mengambil
         * stock barang dan bukan dipaksa 0.
         *
         * User wajib mengisi harga jika diperlukan.
         */
        price: "",
      },
    ]);

    setBarangSearch("");
    setBarangResults([]);
    setError("");
  };

  /* =======================================================
     UPDATE DRAFT ITEM
  ======================================================= */

  const updateDraftItem = (
    tempId: string,
    field: "qty" | "price",
    value: string
  ) => {
    setDraftItems((current) =>
      current.map((item) => {
        if (item.tempId !== tempId) {
          return item;
        }

        if (field === "price") {
          /**
           * Harga disimpan sebagai string digit.
           *
           * "25.000" -> "25000"
           * "Rp 25.000" -> "25000"
           */
          return {
            ...item,
            price:
              normalizePriceInput(
                value
              ),
          };
        }

        /**
         * Qty tetap menerima angka desimal.
         */
        return {
          ...item,
          qty: value,
        };
      })
    );
  };

  /* =======================================================
     REMOVE DRAFT ITEM
  ======================================================= */

  const removeDraftItem = (
    tempId: string
  ) => {
    setDraftItems((current) =>
      current.filter(
        (item) =>
          item.tempId !== tempId
      )
    );
  };

  /* =======================================================
     SAVE ADJUSTMENT
  ======================================================= */

  const saveAdjustment = async () => {
    setError("");

    if (!formDate) {
      setError(
        "Tanggal adjustment wajib diisi"
      );
      return;
    }

    if (!formWarehouse.trim()) {
      setError(
        "Warehouse wajib diisi"
      );
      return;
    }

    if (!formReason.trim()) {
      setError(
        "Alasan adjustment wajib diisi"
      );
      return;
    }

    if (draftItems.length === 0) {
      setError(
        "Minimal harus ada 1 barang"
      );
      return;
    }

    for (
      let index = 0;
      index < draftItems.length;
      index++
    ) {
      const item =
        draftItems[index];

      const qty = Number(
        item.qty
      );

      const price =
        priceToNumber(
          item.price
        );

      if (
        !Number.isFinite(qty) ||
        qty <= 0
      ) {
        setError(
          `Qty "${item.barang.name}" harus lebih besar dari 0`
        );
        return;
      }

      if (
        !Number.isFinite(price) ||
        price < 0
      ) {
        setError(
          `Harga "${item.barang.name}" tidak valid`
        );
        return;
      }

      /**
       * Untuk MINUS, validasi stock di frontend
       * sebagai feedback cepat.
       *
       * Backend tetap menjadi validasi utama.
       */
      if (
        formType === "MINUS" &&
        qty >
          Number(
            item.barang.stock ?? 0
          ) +
            0.000001
      ) {
        setError(
          `Stock "${item.barang.name}" tidak mencukupi. Stock tersedia ${formatQty(
            item.barang.stock
          )}`
        );
        return;
      }
    }

    try {
      setSaving(true);

      /**
       * IMPORTANT:
       * Payload price SELALU dikirim sebagai NUMBER.
       *
       * Contoh:
       * input "25.000"
       * =>
       * price: 25000
       */
      const payload = {
        type: formType,

        adjustmentDate:
          formDate,

        warehouse:
          formWarehouse.trim(),

        reason:
          formReason.trim(),

        remarks:
          formRemarks.trim() || null,

        status: "DRAFT",

        items: draftItems.map(
          (item) => ({
            barangId:
              item.barang.id,

            qty: Number(
              item.qty
            ),

            price:
              priceToNumber(
                item.price
              ),
          })
        ),
      };

      console.log(
        "ADJUSTMENT PAYLOAD:",
        payload
      );

      const response =
        await fetch(API_URL, {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            payload
          ),
        });

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
            "Gagal menyimpan adjustment"
        );
      }

      setShowCreate(false);
      resetForm();

      await load(true);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan adjustment"
      );
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     APPROVE
  ======================================================= */

  const approveAdjustment = async (
    id: number
  ) => {
    const confirmed =
      window.confirm(
        "Approve adjustment ini?\n\nStock akan langsung diperbarui dan StockCard akan dibuat."
      );

    if (!confirmed) {
      return;
    }

    try {
      setApprovingId(id);
      setError("");

      const response =
        await fetch(API_URL, {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            id,
            action: "APPROVE",
          }),
        });

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
            "Gagal approve adjustment"
        );
      }

      setSelected(null);

      await load(true);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Gagal approve adjustment"
      );
    } finally {
      setApprovingId(null);
    }
  };

  /* =======================================================
     DELETE DRAFT
  ======================================================= */

  const deleteAdjustment = async (
    id: number
  ) => {
    const target =
      data.find(
        (item) => item.id === id
      );

    if (
      !target ||
      target.status !== "DRAFT"
    ) {
      setError(
        "Hanya adjustment DRAFT yang dapat dihapus"
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Hapus Draft Adjustment ${target.number}?\n\nData item adjustment akan ikut dihapus. Stock tidak akan berubah.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(id);
      setError("");

      const response =
        await fetch(
          `${API_URL}?id=${id}`,
          {
            method: "DELETE",
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
            "Gagal menghapus draft"
        );
      }

      if (
        selected?.id === id
      ) {
        setSelected(null);
      }

      await load(true);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Gagal menghapus draft"
      );
    } finally {
      setDeletingId(null);
    }
  };

  /* =======================================================
     FILTERED DATA
  ======================================================= */

  const filteredData =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return data.filter(
        (item) => {
          const matchesSearch =
            !keyword ||
            item.number
              .toLowerCase()
              .includes(keyword) ||
            String(
              item.reason ?? ""
            )
              .toLowerCase()
              .includes(keyword) ||
            item.items.some(
              (detail) =>
                detail.barang.name
                  .toLowerCase()
                  .includes(keyword) ||
                detail.barang.code
                  .toLowerCase()
                  .includes(keyword)
            );

          const matchesStatus =
            statusFilter ===
              "SEMUA" ||
            item.status ===
              statusFilter;

          const matchesType =
            typeFilter === "SEMUA" ||
            item.type ===
              typeFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesType
          );
        }
      );
    }, [
      data,
      search,
      statusFilter,
      typeFilter,
    ]);

  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary =
    useMemo(() => {
      return {
        total: data.length,

        draft: data.filter(
          (item) =>
            item.status ===
            "DRAFT"
        ).length,

        approved: data.filter(
          (item) =>
            item.status ===
            "APPROVED"
        ).length,

        rejected: data.filter(
          (item) =>
            item.status ===
            "REJECTED"
        ).length,
      };
    }, [data]);

  /* =======================================================
     FORM TOTAL
  ======================================================= */

  const formTotal =
    useMemo(() => {
      return draftItems.reduce(
        (total, item) => {
          const qty =
            Number(item.qty) || 0;

          const price =
            priceToNumber(
              item.price
            );

          return (
            total +
            qty * price
          );
        },
        0
      );
    }, [draftItems]);

  /* =======================================================
     DETAIL TOTAL
  ======================================================= */

  const selectedTotal =
    useMemo(() => {
      if (!selected) {
        return 0;
      }

      return selected.items.reduce(
        (total, item) => {
          return (
            total +
            Number(item.qty || 0) *
              Number(
                item.price || 0
              )
          );
        },
        0
      );
    }, [selected]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#497F70]/10">
            <Loader2
              className="animate-spin text-[#497F70]"
              size={24}
            />
          </div>

          <p className="text-sm font-medium text-slate-500">
            Memuat data adjustment...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#f6f8f7] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-5">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#18352D] via-[#244d41] to-[#497F70] p-6 text-white shadow-xl shadow-[#18352D]/10">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/5" />
          <div className="absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-white/5" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-white/70">
                <ClipboardCheck
                  size={16}
                />
                <span className="text-xs font-bold uppercase tracking-[0.18em]">
                  Inventory Control
                </span>
              </div>

              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                Stock Adjustment
              </h1>

              <p className="mt-1 max-w-2xl text-sm text-white/70">
                Koreksi penambahan atau pengurangan
                stock dengan histori transaksi yang
                terkontrol.
              </p>
            </div>

            <button
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#18352D] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <Plus size={18} />
              Buat Adjustment
            </button>
          </div>
        </div>

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400">
                  Total
                </p>
                <p className="mt-1 text-2xl font-black text-slate-800">
                  {summary.total}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <FileText size={19} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-600">
                  Draft
                </p>
                <p className="mt-1 text-2xl font-black text-amber-700">
                  {summary.draft}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <Clock3 size={19} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-600">
                  Approved
                </p>
                <p className="mt-1 text-2xl font-black text-emerald-700">
                  {summary.approved}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={19} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-red-600">
                  Rejected
                </p>
                <p className="mt-1 text-2xl font-black text-red-700">
                  {summary.rejected}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <X size={19} />
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div className="flex-1">
              <p className="font-bold">
                Terjadi masalah
              </p>
              <p className="mt-0.5">
                {error}
              </p>
            </div>

            <button
              onClick={() =>
                setError("")
              }
              className="rounded-lg p-1 hover:bg-red-100"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* =================================================
            FILTER
        ================================================= */}

        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Cari nomor adjustment, alasan, atau barang..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <SlidersHorizontal
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <select
                  value={
                    statusFilter
                  }
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value
                    )
                  }
                  className="h-11 min-w-[150px] appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm font-semibold text-slate-700 outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
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
                  <option value="REJECTED">
                    Rejected
                  </option>
                </select>
              </div>

              <div className="relative">
                <Filter
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <select
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(
                      e.target.value
                    )
                  }
                  className="h-11 min-w-[150px] appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm font-semibold text-slate-700 outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                >
                  <option value="SEMUA">
                    Semua Tipe
                  </option>
                  <option value="PLUS">
                    Penambahan
                  </option>
                  <option value="MINUS">
                    Pengurangan
                  </option>
                </select>
              </div>

              <button
                onClick={() =>
                  load(true)
                }
                disabled={refreshing}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={16}
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Adjustment
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Tanggal
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Warehouse
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Type
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Items
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Status
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                          <ClipboardCheck
                            size={25}
                          />
                        </div>

                        <p className="mt-4 text-sm font-bold text-slate-700">
                          Belum ada data
                          adjustment
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          Data adjustment yang sesuai
                          filter akan muncul di sini.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map(
                    (item) => (
                      <tr
                        key={item.id}
                        className="group transition hover:bg-[#497F70]/[0.025]"
                      >
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-sm font-black text-slate-800">
                              {item.number}
                            </p>

                            <p className="mt-1 max-w-[260px] truncate text-xs text-slate-400">
                              {item.reason ||
                                "Tanpa alasan"}
                            </p>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                            <CalendarDays
                              size={15}
                              className="text-slate-400"
                            />
                            {formatDate(
                              item.adjustmentDate
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                              <Warehouse
                                size={15}
                              />
                            </div>

                            <span className="text-sm font-bold text-slate-700">
                              {item.warehouse}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <TypeBadge
                            type={item.type}
                          />
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-[#497F70]/10 px-2 text-xs font-black text-[#497F70]">
                              {item.items.length}
                            </span>

                            <span className="text-xs font-medium text-slate-500">
                              barang
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            status={
                              item.status
                            }
                          />
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {item.status ===
                              "DRAFT" && (
                              <button
                                onClick={() =>
                                  deleteAdjustment(
                                    item.id
                                  )
                                }
                                disabled={
                                  deletingId ===
                                  item.id
                                }
                                title="Hapus Draft"
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                              >
                                {deletingId ===
                                item.id ? (
                                  <Loader2
                                    size={15}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Trash2
                                    size={15}
                                  />
                                )}
                              </button>
                            )}

                            <button
                              onClick={() =>
                                setSelected(
                                  item
                                )
                              }
                              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#497F70]/30 hover:bg-[#497F70]/5 hover:text-[#497F70]"
                            >
                              <Eye
                                size={15}
                              />
                              Detail
                            </button>

                            <ChevronRight
                              size={15}
                              className="text-slate-300 transition group-hover:text-[#497F70]"
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ===================================================
          CREATE MODAL
      =================================================== */}

      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">

            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#497F70]/10 text-[#497F70]">
                  <ClipboardCheck
                    size={21}
                  />
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-800">
                    Buat Stock Adjustment
                  </h2>

                  <p className="text-xs text-slate-400">
                    Buat draft koreksi stock
                  </p>
                </div>
              </div>

              <button
                onClick={closeCreate}
                disabled={saving}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* BODY */}

            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              <div className="space-y-6">

                {/* BASIC */}

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-2 block text-xs font-bold text-slate-600">
                      Type
                    </label>

                    <select
                      value={formType}
                      onChange={(e) =>
                        setFormType(
                          e.target
                            .value as
                            | "PLUS"
                            | "MINUS"
                        )
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    >
                      <option value="PLUS">
                        PLUS — Penambahan
                      </option>
                      <option value="MINUS">
                        MINUS — Pengurangan
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold text-slate-600">
                      Tanggal
                    </label>

                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) =>
                        setFormDate(
                          e.target.value
                        )
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold text-slate-600">
                      Warehouse
                    </label>

                    <div className="relative">
                      <Warehouse
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        value={
                          formWarehouse
                        }
                        onChange={(e) =>
                          setFormWarehouse(
                            e.target.value
                          )
                        }
                        placeholder="MAIN"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold text-slate-600">
                      Alasan
                    </label>

                    <input
                      value={formReason}
                      onChange={(e) =>
                        setFormReason(
                          e.target.value
                        )
                      }
                      placeholder="Koreksi stock opname"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-600">
                    Remarks
                    <span className="ml-1 font-normal text-slate-400">
                      (opsional)
                    </span>
                  </label>

                  <textarea
                    value={formRemarks}
                    onChange={(e) =>
                      setFormRemarks(
                        e.target.value
                      )
                    }
                    rows={2}
                    placeholder="Catatan tambahan..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                  />
                </div>

                {/* SEARCH BARANG */}

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Package
                      size={17}
                      className="text-[#497F70]"
                    />

                    <div>
                      <p className="text-sm font-black text-slate-800">
                        Tambahkan Barang
                      </p>

                      <p className="text-xs text-slate-400">
                        Cari berdasarkan kode,
                        nama, atau barcode.
                      </p>
                    </div>
                  </div>

                  <div className="relative">
                    <Search
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      value={
                        barangSearch
                      }
                      onChange={(e) =>
                        setBarangSearch(
                          e.target.value
                        )
                      }
                      placeholder="Cari barang..."
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-sm font-medium outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    />

                    {searchingBarang && (
                      <Loader2
                        size={17}
                        className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[#497F70]"
                      />
                    )}

                    {barangResults.length >
                      0 && (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                        {barangResults.map(
                          (barang) => (
                            <button
                              key={
                                barang.id
                              }
                              type="button"
                              onClick={() =>
                                addBarang(
                                  barang
                                )
                              }
                              className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-[#497F70]/5"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-800">
                                  {
                                    barang.name
                                  }
                                </p>

                                <p className="mt-0.5 text-xs text-slate-400">
                                  {
                                    barang.code
                                  }

                                  {barang.unit
                                    ? ` • ${barang.unit}`
                                    : ""}
                                </p>
                              </div>

                              <div className="ml-4 shrink-0 text-right">
                                <p className="text-xs font-bold text-slate-500">
                                  Stock
                                </p>

                                <p className="text-sm font-black text-[#497F70]">
                                  {formatQty(
                                    barang.stock
                                  )}
                                </p>
                              </div>
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ITEMS */}

                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-black text-slate-800">
                        Detail Barang
                      </p>

                      <p className="text-xs text-slate-400">
                        {draftItems.length} barang
                        dipilih
                      </p>
                    </div>

                    <div
                      className={`rounded-xl px-3 py-2 text-xs font-bold ${
                        formType ===
                        "MINUS"
                          ? "bg-red-50 text-red-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {formType ===
                      "MINUS"
                        ? "STOCK OUT"
                        : "STOCK IN"}
                    </div>
                  </div>

                  {draftItems.length ===
                  0 ? (
                    <div className="px-6 py-14 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <Package
                          size={25}
                        />
                      </div>

                      <p className="mt-4 text-sm font-bold text-slate-700">
                        Belum ada barang
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Gunakan pencarian barang di
                        atas untuk menambahkan item.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[950px]">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/70">
                            <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                              Barang
                            </th>

                            <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">
                              Stock
                            </th>

                            <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">
                              Qty
                            </th>

                            <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">
                              Harga Satuan
                            </th>

                            <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">
                              Total
                            </th>

                            <th className="w-12 px-3 py-3" />
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {draftItems.map(
                            (item) => {
                              const qty =
                                Number(
                                  item.qty
                                ) || 0;

                              const price =
                                priceToNumber(
                                  item.price
                                );

                              const total =
                                qty *
                                price;

                              const insufficient =
                                formType ===
                                  "MINUS" &&
                                qty >
                                  Number(
                                    item
                                      .barang
                                      .stock ??
                                      0
                                  ) +
                                    0.000001;

                              return (
                                <tr
                                  key={
                                    item.tempId
                                  }
                                  className="bg-white"
                                >
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#497F70]/10 text-[#497F70]">
                                        <Package
                                          size={
                                            18
                                          }
                                        />
                                      </div>

                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-slate-800">
                                          {
                                            item
                                              .barang
                                              .name
                                          }
                                        </p>

                                        <p className="mt-0.5 text-xs text-slate-400">
                                          {
                                            item
                                              .barang
                                              .code
                                          }

                                          {item
                                            .barang
                                            .unit
                                            ? ` • ${item.barang.unit}`
                                            : ""}
                                        </p>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-4 py-4 text-right">
                                    <span
                                      className={`text-sm font-black ${
                                        insufficient
                                          ? "text-red-600"
                                          : "text-slate-700"
                                      }`}
                                    >
                                      {formatQty(
                                        item
                                          .barang
                                          .stock
                                      )}
                                    </span>
                                  </td>

                                  <td className="px-4 py-4">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={
                                        item.qty
                                      }
                                      onChange={(
                                        e
                                      ) =>
                                        updateDraftItem(
                                          item.tempId,
                                          "qty",
                                          e
                                            .target
                                            .value
                                        )
                                      }
                                      placeholder="0"
                                      className={`h-10 w-28 rounded-xl border bg-white px-3 text-right text-sm font-bold outline-none transition ${
                                        insufficient
                                          ? "border-red-300 text-red-700 focus:ring-4 focus:ring-red-100"
                                          : "border-slate-200 text-slate-700 focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                                      }`}
                                    />

                                    {insufficient && (
                                      <p className="mt-1 text-right text-[10px] font-bold text-red-500">
                                        Melebihi stock
                                      </p>
                                    )}
                                  </td>

                                  <td className="px-4 py-4">
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                        Rp
                                      </span>

                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={formatPriceInput(
                                          item.price
                                        )}
                                        onChange={(
                                          e
                                        ) =>
                                          updateDraftItem(
                                            item.tempId,
                                            "price",
                                            e
                                              .target
                                              .value
                                          )
                                        }
                                        placeholder="0"
                                        className="h-10 w-36 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-right text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                                      />
                                    </div>

                                    <p className="mt-1 text-right text-[10px] font-semibold text-slate-400">
                                      {price > 0
                                        ? money.format(
                                            price
                                          )
                                        : "Belum diisi"}
                                    </p>
                                  </td>

                                  <td className="px-4 py-4 text-right">
                                    <p className="text-sm font-black text-[#18352D]">
                                      {money.format(
                                        total
                                      )}
                                    </p>
                                  </td>

                                  <td className="px-3 py-4 text-center">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeDraftItem(
                                          item.tempId
                                        )
                                      }
                                      className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                      title="Hapus item"
                                    >
                                      <Trash2
                                        size={
                                          16
                                        }
                                      />
                                    </button>
                                  </td>
                                </tr>
                              );
                            }
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* TOTAL */}

                <div className="flex flex-col gap-4 rounded-2xl bg-[#18352D] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-white/50">
                      Total Nilai Adjustment
                    </p>

                    <p className="mt-1 text-2xl font-black">
                      {money.format(
                        formTotal
                      )}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-xs text-white/50">
                      Status saat disimpan
                    </p>

                    <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-bold text-amber-300">
                      <Clock3
                        size={13}
                      />
                      DRAFT
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER */}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <button
                onClick={closeCreate}
                disabled={saving}
                className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                onClick={
                  saveAdjustment
                }
                disabled={
                  saving ||
                  draftItems.length ===
                    0
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#497F70] px-6 text-sm font-black text-white shadow-lg shadow-[#497F70]/20 transition hover:bg-[#3f6f62] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <CheckCircle2
                      size={17}
                    />
                    Simpan Draft
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          DETAIL DRAWER
      =================================================== */}

      {selected && (
        <div className="fixed inset-0 z-[110] bg-slate-950/45 backdrop-blur-sm">
          <div className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col bg-white shadow-2xl">

            {/* DRAWER HEADER */}

            <div className="border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#497F70]/10 text-[#497F70]">
                    <ClipboardCheck
                      size={21}
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-slate-800">
                        {selected.number}
                      </h2>

                      <StatusBadge
                        status={
                          selected.status
                        }
                      />
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      Dibuat{" "}
                      {formatDateTime(
                        selected.createdAt
                      )}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() =>
                    setSelected(null)
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* DRAWER BODY */}

            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              <div className="space-y-5">

                {/* INFO */}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Tanggal
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <CalendarDays
                        size={16}
                        className="text-[#497F70]"
                      />

                      <p className="text-sm font-black text-slate-700">
                        {formatDate(
                          selected.adjustmentDate
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Warehouse
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <Warehouse
                        size={16}
                        className="text-[#497F70]"
                      />

                      <p className="text-sm font-black text-slate-700">
                        {
                          selected.warehouse
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* REASON */}

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Adjustment
                      </p>

                      <div className="mt-2">
                        <TypeBadge
                          type={
                            selected.type
                          }
                        />
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Total Nilai
                      </p>

                      <p className="mt-1 text-lg font-black text-[#18352D]">
                        {money.format(
                          selectedTotal
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="text-xs font-bold text-slate-400">
                      Alasan
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {selected.reason ||
                        "-"}
                    </p>

                    {selected.remarks && (
                      <div className="mt-3">
                        <p className="text-xs font-bold text-slate-400">
                          Remarks
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          {
                            selected.remarks
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ITEMS */}

                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p className="text-sm font-black text-slate-800">
                      Detail Barang
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      {selected.items.length} item
                    </p>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {selected.items.map(
                      (item) => {
                        const qty =
                          Number(
                            item.qty ||
                              0
                          );

                        const price =
                          Number(
                            item.price ||
                              0
                          );

                        const lineTotal =
                          qty *
                          price;

                        return (
                          <div
                            key={
                              item.id
                            }
                            className="p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex min-w-0 items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#497F70]/10 text-[#497F70]">
                                  <Package
                                    size={
                                      17
                                    }
                                  />
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-slate-800">
                                    {
                                      item
                                        .barang
                                        .name
                                    }
                                  </p>

                                  <p className="mt-0.5 text-xs text-slate-400">
                                    {
                                      item
                                        .barang
                                        .code
                                    }

                                    {item
                                      .barang
                                      .unit
                                      ? ` • ${item.barang.unit}`
                                      : ""}
                                  </p>
                                </div>
                              </div>

                              <p className="shrink-0 text-sm font-black text-[#18352D]">
                                {money.format(
                                  lineTotal
                                )}
                              </p>
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-2">
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-[10px] font-bold text-slate-400">
                                  Qty
                                </p>

                                <p className="mt-1 text-sm font-black text-slate-700">
                                  {formatQty(
                                    qty
                                  )}
                                </p>
                              </div>

                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-[10px] font-bold text-slate-400">
                                  Harga
                                </p>

                                <p className="mt-1 text-sm font-black text-slate-700">
                                  {money.format(
                                    price
                                  )}
                                </p>
                              </div>

                              <div className="rounded-xl bg-[#497F70]/5 p-3">
                                <p className="text-[10px] font-bold text-[#497F70]">
                                  Total
                                </p>

                                <p className="mt-1 text-sm font-black text-[#18352D]">
                                  {money.format(
                                    lineTotal
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* DRAWER FOOTER */}

            <div className="border-t border-slate-200 bg-slate-50/80 p-4 sm:p-5">
              {selected.status ===
                "DRAFT" ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <button
                    onClick={() =>
                      deleteAdjustment(
                        selected.id
                      )
                    }
                    disabled={
                      deletingId ===
                      selected.id
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    {deletingId ===
                    selected.id ? (
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <Trash2
                        size={16}
                      />
                    )}

                    Hapus Draft
                  </button>

                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        setSelected(null)
                      }
                      className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
                    >
                      Tutup
                    </button>

                    <button
                      onClick={() =>
                        approveAdjustment(
                          selected.id
                        )
                      }
                      disabled={
                        approvingId ===
                        selected.id
                      }
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#497F70] px-5 text-sm font-black text-white shadow-lg shadow-[#497F70]/20 transition hover:bg-[#3f6f62] disabled:opacity-50"
                    >
                      {approvingId ===
                      selected.id ? (
                        <>
                          <Loader2
                            size={16}
                            className="animate-spin"
                          />
                          Memproses...
                        </>
                      ) : (
                        <>
                          <CheckCircle2
                            size={16}
                          />
                          Approve
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button
                    onClick={() =>
                      setSelected(null)
                    }
                    className="h-11 rounded-xl bg-[#18352D] px-6 text-sm font-black text-white transition hover:bg-[#244d41]"
                  >
                    Tutup
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}