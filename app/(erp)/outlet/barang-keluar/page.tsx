"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownCircle,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  Factory,
  Filter,
  Loader2,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  TrendingDown,
  X,
  XCircle,
} from "lucide-react";

type TransactionType = "PEMAKAIAN" | "WASTE";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type BarangStock = {
  id: number;
  outletId: number;
  outlet: string;
  barangId: number;
  code: string;
  name: string;
  unit: string;
  stock: number;
  minimumStock: number;
  averageCost: number;
};

type Transaction = {
  id: number;
  number: string;

  outletId: number;
  outlet: string;

  barangId: number;
  code: string;
  barang: string;
  unit: string;

  type: string;

  qtyProcessed: number;
  wasteQty: number;
  netQty: number;

  unitCost: number;
  totalCost: number;

  note: string | null;
  trxDate: string;

  status?: string;

  user: {
    id: number;
    fullname: string;
    username: string;
  } | null;
};

type ApiResponse = {
  success: boolean;
  message?: string;

  role?: "ADMIN" | "OUTLET_ADMIN";

  currentOutlet?: Outlet | null;

  outlets?: Outlet[];

  stocks?: BarangStock[];

  transactions?: Transaction[];

  types?: string[];
};

export default function OutletBarangKeluarPage() {
  const [role, setRole] = useState<
    "ADMIN" | "OUTLET_ADMIN" | ""
  >("");

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [currentOutlet, setCurrentOutlet] =
    useState<Outlet | null>(null);

  const [selectedOutletId, setSelectedOutletId] =
    useState("");

  const [barang, setBarang] = useState<BarangStock[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>(
    []
  );

  const [barangId, setBarangId] = useState("");

  const [transactionType, setTransactionType] =
    useState<TransactionType>("PEMAKAIAN");

  const [barangSearch, setBarangSearch] = useState("");
  const [barangDropdownOpen, setBarangDropdownOpen] =
    useState(false);

  const [qtyProcessed, setQtyProcessed] = useState("");
  const [wasteQty, setWasteQty] = useState("");
  const [note, setNote] = useState("");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (role === "ADMIN") {
        if (selectedOutletId) {
          params.set("outletId", selectedOutletId);
        }

        if (from) {
          params.set("from", from);
        }

        if (to) {
          params.set("to", to);
        }
      }

      const query = params.toString();

      const res = await fetch(
        `/api/outlet/barang-keluar${query ? `?${query}` : ""}`,
        {
          cache: "no-store",
        }
      );

      const json: ApiResponse = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil data pemakaian outlet"
        );
      }

      setRole(json.role || "");
      setOutlets(json.outlets || []);
      setCurrentOutlet(json.currentOutlet || null);
      setBarang(json.stocks || []);
      setTransactions(json.transactions || []);

      if (
        json.role === "OUTLET_ADMIN" &&
        json.currentOutlet
      ) {
        setSelectedOutletId(
          String(json.currentOutlet.id)
        );
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Gagal mengambil data pemakaian outlet"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // CURRENT USER
  // =====================================================

  useEffect(() => {
    async function loadMe() {
      try {
        const res = await fetch("/api/me", {
          cache: "no-store",
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(
            json.message || "Tidak login"
          );
        }

        const userRole = json.user?.role;

        if (
          userRole !== "ADMIN" &&
          userRole !== "OUTLET_ADMIN"
        ) {
          setError("Akses ditolak");
          setLoading(false);
          return;
        }

        setRole(userRole);

        if (
          userRole === "OUTLET_ADMIN" &&
          json.user?.outlet
        ) {
          setCurrentOutlet(json.user.outlet);

          setSelectedOutletId(
            String(json.user.outlet.id)
          );
        }
      } catch (err: any) {
        setError(
          err?.message ||
            "Gagal mengambil user login"
        );

        setLoading(false);
      }
    }

    loadMe();
  }, []);

  useEffect(() => {
    if (role) {
      loadData();
    }
  }, [role]);

  // =====================================================
  // FILTER
  // =====================================================

  function applyFilter() {
    loadData();
  }

  function resetFilter() {
    setSelectedOutletId("");
    setFrom("");
    setTo("");

    setBarangId("");
    setBarangSearch("");

    setTimeout(() => {
      loadData();
    }, 0);
  }

  // =====================================================
  // AVAILABLE BARANG
  // =====================================================

  const availableBarang = useMemo(() => {
    return barang.filter((item) => {
      if (role === "OUTLET_ADMIN") {
        return true;
      }

      if (!selectedOutletId) {
        return false;
      }

      return (
        item.outletId ===
        Number(selectedOutletId)
      );
    });
  }, [
    barang,
    role,
    selectedOutletId,
  ]);

  // =====================================================
  // SEARCH BARANG
  // =====================================================

  const filteredBarang = useMemo(() => {
    const keyword = barangSearch
      .trim()
      .toLowerCase();

    if (!keyword) {
      return availableBarang;
    }

    return availableBarang.filter(
      (item) =>
        item.code
          .toLowerCase()
          .includes(keyword) ||
        item.name
          .toLowerCase()
          .includes(keyword) ||
        item.unit
          .toLowerCase()
          .includes(keyword)
    );
  }, [
    availableBarang,
    barangSearch,
  ]);

  // =====================================================
  // SELECTED BARANG
  // =====================================================

  const selectedBarang = useMemo(() => {
    return barang.find(
      (item) =>
        item.barangId === Number(barangId) &&
        (
          role === "OUTLET_ADMIN" ||
          item.outletId ===
            Number(selectedOutletId)
        )
    );
  }, [
    barang,
    barangId,
    role,
    selectedOutletId,
  ]);

  // =====================================================
  // BARANG HANDLER
  // =====================================================

  function handleSelectBarang(
    item: BarangStock
  ) {
    setBarangId(String(item.barangId));

    setBarangSearch(
      `${item.code} - ${item.name}`
    );

    setBarangDropdownOpen(false);
  }

  function clearBarang() {
    setBarangId("");
    setBarangSearch("");
    setBarangDropdownOpen(false);
  }

  // =====================================================
  // CALCULATION
  // =====================================================

  const processed =
    Number(qtyProcessed) || 0;

  const actualWaste =
    transactionType === "WASTE"
      ? processed
      : Number(wasteQty) || 0;

  const netQty =
    transactionType === "WASTE"
      ? 0
      : Math.max(
          processed - actualWaste,
          0
        );

  const wastePercentage =
    processed > 0
      ? (actualWaste / processed) * 100
      : 0;

  const estimatedStockAfter =
    selectedBarang
      ? Math.max(
          selectedBarang.stock -
            processed,
          0
        )
      : null;

  const stockPercentage =
    selectedBarang &&
    selectedBarang.stock > 0
      ? Math.min(
          100,
          ((estimatedStockAfter || 0) /
            selectedBarang.stock) *
            100
        )
      : 0;

  const isLowStock =
    selectedBarang &&
    estimatedStockAfter !== null
      ? estimatedStockAfter <=
        selectedBarang.minimumStock
      : false;

  // =====================================================
  // RESET FORM
  // =====================================================

  function resetForm() {
    setBarangId("");
    setBarangSearch("");
    setBarangDropdownOpen(false);

    setTransactionType("PEMAKAIAN");

    setQtyProcessed("");
    setWasteQty("");
    setNote("");
  }

  // =====================================================
  // SUBMIT
  // =====================================================

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setMessage("");
    setError("");

    if (
      role === "ADMIN" &&
      !selectedOutletId
    ) {
      setError(
        "Silakan pilih outlet terlebih dahulu"
      );
      return;
    }

    if (!barangId) {
      setError("Silakan pilih barang");
      return;
    }

    if (!processed || processed <= 0) {
      setError("Qty harus lebih dari 0");
      return;
    }

    if (
      transactionType === "PEMAKAIAN"
    ) {
      const enteredWaste =
        Number(wasteQty) || 0;

      if (enteredWaste < 0) {
        setError(
          "Qty waste tidak valid"
        );
        return;
      }

      if (enteredWaste > processed) {
        setError(
          "Qty waste tidak boleh lebih besar dari qty dipakai"
        );
        return;
      }
    }

    if (
      selectedBarang &&
      processed > selectedBarang.stock
    ) {
      setError(
        `Stock ${selectedBarang.name} hanya ${selectedBarang.stock} ${selectedBarang.unit}`
      );
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(
        "/api/outlet/barang-keluar",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            outletId:
              role === "ADMIN"
                ? Number(
                    selectedOutletId
                  )
                : undefined,

            barangId: Number(barangId),

            type: transactionType,

            qtyProcessed: processed,

            wasteQty:
              transactionType === "WASTE"
                ? processed
                : Number(wasteQty) || 0,

            note,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal menyimpan transaksi barang keluar"
        );
      }

      const data = json.data;

      const savedType =
        data?.type ||
        transactionType;

      const savedQty = Number(
        data?.qtyProcessed ??
          processed
      );

      const savedWaste = Number(
        data?.wasteQty ??
          actualWaste
      );

      const savedNet = Number(
        data?.netQty ??
          netQty
      );

      const savedUnit =
        data?.unit ||
        selectedBarang?.unit ||
        "";

      const stockBefore =
        data?.stockBefore ??
        selectedBarang?.stock ??
        0;

      const stockAfter =
        data?.stockAfter ??
        Math.max(
          Number(stockBefore) -
            savedQty,
          0
        );

      const typeLabel =
        savedType === "WASTE"
          ? "waste"
          : "pemakaian";

      setMessage(
        `${
          data?.barang ||
          selectedBarang?.name ||
          "Barang"
        } berhasil dicatat sebagai ${typeLabel}. Qty ${savedQty} ${savedUnit}, waste ${savedWaste} ${savedUnit}, bersih ${savedNet} ${savedUnit}. Stock ${stockBefore} → ${stockAfter} ${savedUnit}.`
      );

      resetForm();

      await loadData();
    } catch (err: any) {
      setError(
        err?.message ||
          "Gagal menyimpan transaksi barang keluar"
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // ACCESS DENIED
  // =====================================================

  if (
    !loading &&
    role !== "ADMIN" &&
    role !== "OUTLET_ADMIN"
  ) {
    return (
      <div className="min-h-screen bg-[#f4f7f6] p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-red-50 p-3 text-red-600">
                <XCircle size={24} />
              </div>

              <div>
                <h2 className="font-bold text-slate-800">
                  Akses Ditolak
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {error ||
                    "Anda tidak memiliki akses ke halaman ini."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-screen bg-[#f4f7f6] p-4 md:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">

        {/* =================================================
            PREMIUM HERO
        ================================================= */}

        <section className="relative overflow-hidden rounded-[28px] bg-slate-900 shadow-xl">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-green-500/20 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative p-5 md:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-3.5 text-green-300 backdrop-blur">
                  <ArrowDownCircle size={27} />
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-green-400/20 bg-green-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-green-300">
                      Outlet Inventory
                    </span>

                    {role === "ADMIN" ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                        Admin Pusat
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                        Outlet
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                    Pemakaian & Waste
                  </h1>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                    Catat barang yang keluar dari stock
                    outlet untuk pemakaian operasional,
                    produksi, maupun waste.
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck
                        size={14}
                        className="text-green-400"
                      />
                      Stock tercatat secara real-time
                    </div>

                    <span className="text-slate-700">
                      •
                    </span>

                    <div className="flex items-center gap-1.5">
                      <ClipboardList size={14} />
                      {transactions.length} transaksi
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15 disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
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
        </section>

        {/* =================================================
            QUICK KPI
        ================================================= */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <KpiCard
            icon={Package}
            label="Barang Tersedia"
            value={availableBarang.length}
            suffix="item"
            description="Stock outlet aktif"
          />

          <KpiCard
            icon={ClipboardList}
            label="Transaksi"
            value={transactions.length}
            suffix="trx"
            description="Sesuai filter saat ini"
          />

          <KpiCard
            icon={ArrowDownCircle}
            label="Pemakaian"
            value={
              transactions.filter(
                (item) =>
                  item.type ===
                  "PEMAKAIAN"
              ).length
            }
            suffix="trx"
            description="Pengeluaran operasional"
          />

          <KpiCard
            icon={Trash2}
            label="Waste"
            value={
              transactions.filter(
                (item) =>
                  item.type === "WASTE"
              ).length
            }
            suffix="trx"
            description="Transaksi waste"
            danger
          />

        </div>

        {/* =================================================
            ADMIN FILTER
        ================================================= */}

        {role === "ADMIN" && (
          <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">

            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">

              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                  <Filter size={18} />
                </div>

                <div>
                  <h2 className="font-bold text-slate-800">
                    Filter Data
                  </h2>

                  <p className="text-xs text-slate-400">
                    Batasi data berdasarkan outlet dan periode
                  </p>
                </div>
              </div>

              {(selectedOutletId ||
                from ||
                to) && (
                <span className="rounded-full bg-green-50 px-3 py-1 text-[11px] font-semibold text-green-700">
                  Filter aktif
                </span>
              )}
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-4">

              <FilterField label="Outlet">
                <select
                  value={selectedOutletId}
                  onChange={(e) => {
                    setSelectedOutletId(
                      e.target.value
                    );

                    setBarangId("");
                    setBarangSearch("");
                  }}
                  className="premium-input"
                >
                  <option value="">
                    Semua Outlet
                  </option>

                  {outlets.map((outlet) => (
                    <option
                      key={outlet.id}
                      value={outlet.id}
                    >
                      {outlet.code} -{" "}
                      {outlet.name}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Dari Tanggal">
                <input
                  type="date"
                  value={from}
                  onChange={(e) =>
                    setFrom(e.target.value)
                  }
                  className="premium-input"
                />
              </FilterField>

              <FilterField label="Sampai Tanggal">
                <input
                  type="date"
                  value={to}
                  onChange={(e) =>
                    setTo(e.target.value)
                  }
                  className="premium-input"
                />
              </FilterField>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={applyFilter}
                  className="flex h-[43px] flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-green-700"
                >
                  <Search size={16} />
                  Terapkan
                </button>

                <button
                  type="button"
                  onClick={resetFilter}
                  className="flex h-[43px] w-[43px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                  title="Reset filter"
                >
                  <XCircle size={17} />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* =================================================
            ALERTS
        ================================================= */}

        {message && (
          <div className="overflow-hidden rounded-2xl border border-green-200 bg-green-50 shadow-sm">
            <div className="flex items-start gap-3 px-4 py-3.5 text-sm text-green-700">
              <div className="mt-0.5 rounded-lg bg-white p-1.5 shadow-sm">
                <CheckCircle2 size={17} />
              </div>

              <div className="min-w-0 flex-1 leading-6">
                <p className="font-bold">
                  Transaksi berhasil
                </p>

                <p className="mt-0.5">
                  {message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMessage("")}
                className="text-green-500 hover:text-green-700"
              >
                <X size={17} />
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="overflow-hidden rounded-2xl border border-red-200 bg-red-50 shadow-sm">
            <div className="flex items-start gap-3 px-4 py-3.5 text-sm text-red-700">
              <div className="mt-0.5 rounded-lg bg-white p-1.5 shadow-sm">
                <CircleAlert size={17} />
              </div>

              <div className="flex-1">
                <p className="font-bold">
                  Transaksi tidak dapat diproses
                </p>

                <p className="mt-0.5">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setError("")}
                className="text-red-500 hover:text-red-700"
              >
                <X size={17} />
              </button>
            </div>
          </div>
        )}

        {/* =================================================
            MAIN CONTENT
        ================================================= */}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">

          {/* =================================================
              FORM
          ================================================= */}

          <form
            onSubmit={handleSubmit}
            className="overflow-visible rounded-3xl border border-slate-200/80 bg-white shadow-sm"
          >

            <div className="border-b border-slate-100 px-5 py-5 md:px-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-green-50 p-2.5 text-green-600">
                  <ArrowDownCircle size={20} />
                </div>

                <div>
                  <h2 className="font-bold text-slate-800">
                    Catat Barang Keluar
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Input transaksi stock outlet
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5 md:p-6">

              {/* OUTLET ADMIN */}

              {role === "ADMIN" && (
                <FormSection
                  number="01"
                  title="Pilih Outlet"
                  description="Tentukan outlet yang akan menerima transaksi."
                >
                  <select
                    value={selectedOutletId}
                    onChange={(e) => {
                      setSelectedOutletId(
                        e.target.value
                      );

                      setBarangId("");
                      setBarangSearch("");
                    }}
                    disabled={saving}
                    className="premium-input"
                  >
                    <option value="">
                      -- Pilih Outlet --
                    </option>

                    {outlets.map((outlet) => (
                      <option
                        key={outlet.id}
                        value={outlet.id}
                      >
                        {outlet.code} -{" "}
                        {outlet.name}
                      </option>
                    ))}
                  </select>
                </FormSection>
              )}

              {role === "OUTLET_ADMIN" &&
                currentOutlet && (
                  <div className="overflow-hidden rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                    <div className="flex items-center gap-3 p-4">
                      <div className="rounded-xl bg-white p-2.5 text-green-600 shadow-sm">
                        <Factory size={19} />
                      </div>

                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-green-600">
                          Outlet Aktif
                        </p>

                        <p className="mt-0.5 truncate text-sm font-bold text-slate-800">
                          {currentOutlet.code} -{" "}
                          {currentOutlet.name}
                        </p>
                      </div>

                      <div className="ml-auto rounded-full bg-green-600 px-2.5 py-1 text-[10px] font-bold text-white">
                        AKTIF
                      </div>
                    </div>
                  </div>
                )}

              {/* TYPE */}

              <FormSection
                number={
                  role === "ADMIN"
                    ? "02"
                    : "01"
                }
                title="Jenis Pengeluaran"
                description="Tentukan apakah barang digunakan atau dicatat sebagai waste."
              >
                <div className="grid gap-3 sm:grid-cols-2">

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setTransactionType(
                        "PEMAKAIAN"
                      );
                      setWasteQty("");
                    }}
                    className={`group rounded-2xl border p-4 text-left transition ${
                      transactionType ===
                      "PEMAKAIAN"
                        ? "border-green-300 bg-green-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`rounded-xl p-2.5 ${
                          transactionType ===
                          "PEMAKAIAN"
                            ? "bg-green-600 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <ArrowDownCircle
                          size={19}
                        />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-slate-800">
                            PEMAKAIAN
                          </p>

                          {transactionType ===
                            "PEMAKAIAN" && (
                            <CheckCircle2
                              size={17}
                              className="text-green-600"
                            />
                          )}
                        </div>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Untuk operasional,
                          produksi, atau
                          penggunaan normal.
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setTransactionType(
                        "WASTE"
                      );
                      setWasteQty(
                        qtyProcessed
                      );
                    }}
                    className={`group rounded-2xl border p-4 text-left transition ${
                      transactionType ===
                      "WASTE"
                        ? "border-red-300 bg-red-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`rounded-xl p-2.5 ${
                          transactionType ===
                          "WASTE"
                            ? "bg-red-600 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Trash2 size={19} />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-slate-800">
                            WASTE
                          </p>

                          {transactionType ===
                            "WASTE" && (
                            <CheckCircle2
                              size={17}
                              className="text-red-600"
                            />
                          )}
                        </div>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Untuk barang rusak,
                          expired, terbuang,
                          atau sebab waste lainnya.
                        </p>
                      </div>
                    </div>
                  </button>

                </div>
              </FormSection>

              {/* BARANG */}

              <FormSection
                number={
                  role === "ADMIN"
                    ? "03"
                    : "02"
                }
                title="Pilih Barang"
                description="Cari berdasarkan kode, nama, atau unit barang."
              >
                <div className="relative">

                  <div className="relative z-50">
                    <Search
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="text"
                      value={barangSearch}
                      onChange={(e) => {
                        setBarangSearch(
                          e.target.value
                        );

                        setBarangId("");
                        setBarangDropdownOpen(
                          true
                        );
                      }}
                      onFocus={() =>
                        setBarangDropdownOpen(
                          true
                        )
                      }
                      onKeyDown={(e) => {
                        if (
                          e.key ===
                          "Escape"
                        ) {
                          setBarangDropdownOpen(
                            false
                          );
                        }
                      }}
                      disabled={
                        loading ||
                        saving ||
                        (
                          role === "ADMIN" &&
                          !selectedOutletId
                        )
                      }
                      placeholder={
                        role === "ADMIN" &&
                        !selectedOutletId
                          ? "Pilih outlet terlebih dahulu"
                          : "Ketik kode atau nama barang..."
                      }
                      className="premium-input pl-10 pr-10"
                    />

                    {barangSearch && (
                      <button
                        type="button"
                        onClick={clearBarang}
                        className="absolute right-9 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <XCircle size={16} />
                      </button>
                    )}

                    <ChevronDown
                      size={17}
                      className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${
                        barangDropdownOpen
                          ? "rotate-180"
                          : ""
                      }`}
                    />
                  </div>

                  {barangDropdownOpen &&
                    !loading &&
                    !saving &&
                    !(
                      role === "ADMIN" &&
                      !selectedOutletId
                    ) && (
                      <>
                        <button
                          type="button"
                          aria-label="Tutup daftar barang"
                          onClick={() =>
                            setBarangDropdownOpen(
                              false
                            )
                          }
                          className="fixed inset-0 z-40 cursor-default"
                        />

                        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">

                          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Daftar Barang
                              </p>

                              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-500 shadow-sm">
                                {
                                  filteredBarang.length
                                }{" "}
                                item
                              </span>
                            </div>
                          </div>

                          <div className="max-h-[320px] overflow-y-auto">
                            {filteredBarang.length ===
                            0 ? (
                              <div className="px-4 py-10 text-center">
                                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
                                  <Package size={24} />
                                </div>

                                <p className="text-sm font-bold text-slate-600">
                                  Barang tidak ditemukan
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                  Coba gunakan kode atau
                                  nama barang lain.
                                </p>
                              </div>
                            ) : (
                              filteredBarang.map(
                                (item) => {
                                  const selected =
                                    Number(
                                      barangId
                                    ) ===
                                    item.barangId;

                                  const lowStock =
                                    item.stock <=
                                    item.minimumStock;

                                  return (
                                    <button
                                      type="button"
                                      key={`${item.outletId}-${item.barangId}`}
                                      onClick={() =>
                                        handleSelectBarang(
                                          item
                                        )
                                      }
                                      className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition ${
                                        selected
                                          ? "bg-green-50"
                                          : "bg-white hover:bg-slate-50"
                                      }`}
                                    >
                                      <div
                                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                          selected
                                            ? "bg-green-600 text-white"
                                            : "bg-slate-100 text-slate-500"
                                        }`}
                                      >
                                        <Package size={18} />
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="truncate text-sm font-bold text-slate-800">
                                            {item.name}
                                          </p>

                                          {selected && (
                                            <CheckCircle2
                                              size={15}
                                              className="shrink-0 text-green-600"
                                            />
                                          )}
                                        </div>

                                        <p className="mt-0.5 text-xs text-slate-400">
                                          {item.code} •{" "}
                                          {item.unit}
                                        </p>
                                      </div>

                                      <div className="shrink-0 text-right">
                                        <p
                                          className={`text-sm font-extrabold ${
                                            lowStock
                                              ? "text-amber-600"
                                              : "text-slate-800"
                                          }`}
                                        >
                                          {item.stock}
                                        </p>

                                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                          Stock
                                        </p>
                                      </div>
                                    </button>
                                  );
                                }
                              )
                            )}
                          </div>

                          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                            <p className="text-[10px] text-slate-400">
                              Pilih barang untuk melihat
                              stock dan simulasi transaksi.
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                </div>

                {/* SELECTED BARANG */}

                {selectedBarang && (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-white">

                    <div className="flex items-center gap-3 p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white shadow-sm">
                        <Package size={21} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {selectedBarang.name}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm">
                            {selectedBarang.code}
                          </span>

                          <span className="text-[10px] font-medium text-slate-400">
                            {selectedBarang.unit}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-xl font-extrabold text-slate-800">
                          {selectedBarang.stock}
                        </p>

                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Stock Saat Ini
                        </p>
                      </div>
                    </div>

                    {selectedBarang.minimumStock >
                      0 && (
                      <div className="border-t border-green-100 bg-white/70 px-4 py-2.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">
                            Minimum stock
                          </span>

                          <span className="font-bold text-slate-600">
                            {
                              selectedBarang.minimumStock
                            }{" "}
                            {
                              selectedBarang.unit
                            }
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </FormSection>

              {/* QTY */}

              <FormSection
                number={
                  role === "ADMIN"
                    ? "04"
                    : "03"
                }
                title={
                  transactionType ===
                  "WASTE"
                    ? "Qty Waste"
                    : "Qty Keluar"
                }
                description={
                  transactionType ===
                  "WASTE"
                    ? "Seluruh qty akan dicatat sebagai waste."
                    : "Jumlah barang yang diambil dari stock outlet."
                }
              >
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={qtyProcessed}
                    onChange={(e) => {
                      const value =
                        e.target.value;

                      setQtyProcessed(value);

                      if (
                        transactionType ===
                        "WASTE"
                      ) {
                        setWasteQty(value);
                      }
                    }}
                    disabled={saving}
                    placeholder="0"
                    className={`w-full rounded-2xl border bg-white px-4 py-4 pr-20 text-2xl font-bold outline-none transition ${
                      transactionType ===
                      "WASTE"
                        ? "border-red-200 focus:border-red-500 focus:ring-4 focus:ring-red-50"
                        : "border-slate-200 focus:border-green-500 focus:ring-4 focus:ring-green-50"
                    }`}
                  />

                  {selectedBarang && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-500">
                      {selectedBarang.unit}
                    </span>
                  )}
                </div>

                {selectedBarang &&
                  processed > 0 && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">

                      <MiniMetric
                        label="Stock Awal"
                        value={`${selectedBarang.stock} ${selectedBarang.unit}`}
                      />

                      <MiniMetric
                        label="Keluar"
                        value={`-${processed} ${selectedBarang.unit}`}
                        danger
                      />

                      <MiniMetric
                        label="Stock Akhir"
                        value={`${estimatedStockAfter} ${selectedBarang.unit}`}
                        warning={isLowStock}
                      />

                    </div>
                  )}
              </FormSection>

              {/* WASTE PEMAKAIAN */}

              {transactionType ===
                "PEMAKAIAN" && (
                <FormSection
                  number={
                    role === "ADMIN"
                      ? "05"
                      : "04"
                  }
                  title="Qty Waste"
                  description="Bagian dari barang yang digunakan tetapi terbuang."
                >
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={wasteQty}
                      onChange={(e) =>
                        setWasteQty(
                          e.target.value
                        )
                      }
                      disabled={saving}
                      placeholder="0"
                      className="premium-input pr-20 text-lg font-semibold"
                    />

                    {selectedBarang && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                        {
                          selectedBarang.unit
                        }
                      </span>
                    )}
                  </div>

                  {processed > 0 && (
                    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          Waste dari qty keluar
                        </span>

                        <span
                          className={`font-bold ${
                            actualWaste >
                            0
                              ? "text-red-600"
                              : "text-slate-500"
                          }`}
                        >
                          {wastePercentage.toFixed(
                            1
                          )}
                          %
                        </span>
                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-red-500 transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              wastePercentage
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </FormSection>
              )}

              {/* WASTE INFO */}

              {transactionType ===
                "WASTE" && (
                <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-red-100 p-2.5 text-red-600">
                      <Trash2 size={19} />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-red-800">
                        Mode Waste Aktif
                      </p>

                      <p className="mt-1 text-xs leading-5 text-red-600">
                        Seluruh qty yang dimasukkan
                        akan dianggap sebagai waste.
                        Stock berkurang sebesar qty
                        tersebut dan pemakaian bersih
                        bernilai 0.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* CALCULATION */}

              {selectedBarang &&
                processed > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 text-white">

                  <div className="border-b border-white/10 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <TrendingDown
                        size={16}
                        className="text-green-400"
                      />

                      <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Simulasi Stock
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-white/10">
                    <DarkMetric
                      label="Awal"
                      value={
                        selectedBarang.stock
                      }
                      unit={
                        selectedBarang.unit
                      }
                    />

                    <DarkMetric
                      label="Keluar"
                      value={`-${processed}`}
                      unit={
                        selectedBarang.unit
                      }
                      danger
                    />

                    <DarkMetric
                      label="Akhir"
                      value={
                        estimatedStockAfter ||
                        0
                      }
                      unit={
                        selectedBarang.unit
                      }
                    />
                  </div>

                  <div className="border-t border-white/10 px-4 py-3">
                    <div className="mb-1.5 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">
                        Sisa stock
                      </span>

                      <span className="font-bold text-slate-300">
                        {stockPercentage.toFixed(
                          0
                        )}
                        %
                      </span>
                    </div>

                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-green-400 transition-all"
                        style={{
                          width: `${stockPercentage}%`,
                        }}
                      />
                    </div>

                    {isLowStock && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-300">
                        <CircleAlert size={12} />
                        Stock setelah transaksi
                        mencapai batas minimum.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* NOTE */}

              <FormSection
                number={
                  role === "ADMIN"
                    ? transactionType ===
                      "PEMAKAIAN"
                      ? "06"
                      : "05"
                    : transactionType ===
                      "PEMAKAIAN"
                    ? "05"
                    : "04"
                }
                title="Keterangan"
                description="Tambahkan informasi untuk kebutuhan audit dan cost control."
              >
                <textarea
                  value={note}
                  onChange={(e) =>
                    setNote(e.target.value)
                  }
                  disabled={saving}
                  rows={4}
                  placeholder={
                    transactionType ===
                    "WASTE"
                      ? "Contoh: bahan rusak, jatuh, overproduction, expired, dll..."
                      : "Contoh: produksi shift pagi, bahan untuk menu A, dll..."
                  }
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-50"
                />
              </FormSection>

              {/* SUBMIT */}

              <div className="border-t border-slate-100 pt-5">
                <button
                  type="submit"
                  disabled={
                    saving ||
                    loading ||
                    !barangId ||
                    !qtyProcessed ||
                    (
                      role === "ADMIN" &&
                      !selectedOutletId
                    )
                  }
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    transactionType ===
                    "WASTE"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                      Menyimpan transaksi...
                    </>
                  ) : (
                    <>
                      {transactionType ===
                      "WASTE" ? (
                        <Trash2 size={18} />
                      ) : (
                        <ArrowDownCircle
                          size={18}
                        />
                      )}

                      {transactionType ===
                      "WASTE"
                        ? "Simpan Waste"
                        : "Simpan Pemakaian"}
                    </>
                  )}
                </button>

                <p className="mt-2 text-center text-[10px] text-slate-400">
                  Stock akan berkurang sesuai Qty Keluar
                  setelah transaksi berhasil disimpan.
                </p>
              </div>

            </div>
          </form>

          {/* =================================================
              RIGHT SUMMARY
          ================================================= */}

          <aside className="space-y-4">

            {/* TRANSACTION SUMMARY */}

            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">

              <div className="border-b border-slate-100 px-5 py-5">
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-xl p-2.5 ${
                      transactionType ===
                      "WASTE"
                        ? "bg-red-50 text-red-600"
                        : "bg-green-50 text-green-600"
                    }`}
                  >
                    {transactionType ===
                    "WASTE" ? (
                      <Trash2 size={19} />
                    ) : (
                      <ClipboardList
                        size={19}
                      />
                    )}
                  </div>

                  <div>
                    <h2 className="font-bold text-slate-800">
                      Ringkasan
                    </h2>

                    <p className="text-xs text-slate-400">
                      Preview transaksi
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5">

                <SummaryRow
                  label="Outlet"
                  value={
                    role ===
                    "OUTLET_ADMIN"
                      ? currentOutlet?.name ||
                        "-"
                      : outlets.find(
                          (o) =>
                            o.id ===
                            Number(
                              selectedOutletId
                            )
                        )?.name ||
                        "-"
                  }
                />

                <SummaryRow
                  label="Jenis"
                  value={
                    transactionType
                  }
                  strong
                  danger={
                    transactionType ===
                    "WASTE"
                  }
                />

                <SummaryRow
                  label="Barang"
                  value={
                    selectedBarang?.name ||
                    "-"
                  }
                />

                <SummaryRow
                  label="Qty Keluar"
                  value={
                    selectedBarang
                      ? `${processed} ${selectedBarang.unit}`
                      : "-"
                  }
                />

                <SummaryRow
                  label="Waste"
                  value={
                    selectedBarang
                      ? `${actualWaste} ${selectedBarang.unit}`
                      : "-"
                  }
                  danger={
                    actualWaste > 0
                  }
                />

                <div className="border-t border-slate-100 pt-4">
                  <SummaryRow
                    label="Pemakaian Bersih"
                    value={
                      selectedBarang
                        ? `${netQty} ${selectedBarang.unit}`
                        : "-"
                    }
                    strong
                    success
                  />
                </div>

              </div>
            </div>

            {/* STOCK CARD */}

            {selectedBarang && (
              <div className="overflow-hidden rounded-3xl bg-slate-900 text-white shadow-lg">

                <div className="border-b border-white/10 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Package
                      size={17}
                      className="text-green-400"
                    />

                    <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Stock Outlet
                    </p>
                  </div>
                </div>

                <div className="p-5">
                  <p className="text-xs text-slate-400">
                    Setelah transaksi
                  </p>

                  <div className="mt-1 flex items-end gap-2">
                    <p className="text-4xl font-extrabold tracking-tight">
                      {estimatedStockAfter}
                    </p>

                    <p className="mb-1 text-sm font-semibold text-slate-400">
                      {selectedBarang.unit}
                    </p>
                  </div>

                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        Stock awal
                      </span>

                      <span className="font-bold text-slate-200">
                        {
                          selectedBarang.stock
                        }{" "}
                        {
                          selectedBarang.unit
                        }
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        Barang keluar
                      </span>

                      <span className="font-bold text-red-400">
                        -{processed}{" "}
                        {
                          selectedBarang.unit
                        }
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        Minimum stock
                      </span>

                      <span className="font-bold text-slate-200">
                        {
                          selectedBarang.minimumStock
                        }{" "}
                        {
                          selectedBarang.unit
                        }
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-green-400 transition-all"
                      style={{
                        width: `${stockPercentage}%`,
                      }}
                    />
                  </div>

                  {isLowStock && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-300">
                      <CircleAlert
                        size={14}
                        className="mt-0.5 shrink-0"
                      />

                      <span>
                        Perhatian: stock setelah
                        transaksi berada pada atau
                        di bawah minimum stock.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CONCEPT */}

            <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">

              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-amber-100 p-2 text-amber-600">
                  <CircleAlert size={17} />
                </div>

                <p className="text-sm font-bold text-amber-800">
                  Konsep Pencatatan
                </p>
              </div>

              <div className="mt-4 space-y-3 text-xs leading-5 text-amber-700">

                <div>
                  <span className="font-extrabold">
                    PEMAKAIAN
                  </span>{" "}
                  digunakan untuk barang yang keluar
                  karena kegiatan operasional atau
                  produksi.
                </div>

                <div>
                  <span className="font-extrabold">
                    WASTE
                  </span>{" "}
                  digunakan untuk barang rusak,
                  expired, terbuang, overproduction,
                  atau penyebab waste lainnya.
                </div>

                <div className="rounded-xl border border-amber-200 bg-white/70 p-3 font-medium">
                  Stock selalu berkurang sebesar{" "}
                  <b>Qty Keluar</b>.
                </div>

                <div>
                  Contoh: ambil 10 kg dan waste 2 kg
                  → stock berkurang 10 kg,
                  pemakaian bersih 8 kg.
                </div>

                <div>
                  Data waste dapat digunakan untuk
                  <b> Cost Control</b> dan evaluasi
                  performa outlet.
                </div>

              </div>
            </div>

          </aside>
        </div>

        {/* =================================================
            HISTORY
        ================================================= */}

        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">

          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 md:flex-row md:items-center md:justify-between">

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                <ClipboardList size={19} />
              </div>

              <div>
                <h2 className="font-bold text-slate-800">
                  Riwayat Pemakaian & Waste
                </h2>

                <p className="mt-0.5 text-xs text-slate-400">
                  Histori transaksi barang keluar outlet
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                {transactions.length} transaksi
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1250px] text-sm">

              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">

                  <th className="px-5 py-3.5">
                    Tanggal
                  </th>

                  <th className="px-5 py-3.5">
                    Nomor
                  </th>

                  {role === "ADMIN" && (
                    <th className="px-5 py-3.5">
                      Outlet
                    </th>
                  )}

                  <th className="px-5 py-3.5">
                    Jenis
                  </th>

                  <th className="px-5 py-3.5">
                    Barang
                  </th>

                  <th className="px-5 py-3.5 text-right">
                    Qty Keluar
                  </th>

                  <th className="px-5 py-3.5 text-right">
                    Waste
                  </th>

                  <th className="px-5 py-3.5 text-right">
                    Bersih
                  </th>

                  <th className="px-5 py-3.5">
                    Keterangan
                  </th>

                  <th className="px-5 py-3.5">
                    User
                  </th>

                </tr>
              </thead>

              <tbody>

                {loading ? (
                  <tr>
                    <td
                      colSpan={
                        role === "ADMIN"
                          ? 10
                          : 9
                      }
                      className="px-5 py-16 text-center"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div className="rounded-2xl bg-slate-100 p-3">
                          <Loader2
                            size={22}
                            className="animate-spin text-slate-400"
                          />
                        </div>

                        <p className="mt-3 text-sm font-semibold text-slate-500">
                          Memuat histori...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : transactions.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={
                        role === "ADMIN"
                          ? 10
                          : 9
                      }
                      className="px-5 py-16 text-center"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="rounded-2xl bg-slate-100 p-4 text-slate-300">
                          <ClipboardList
                            size={28}
                          />
                        </div>

                        <p className="mt-4 text-sm font-bold text-slate-600">
                          Belum ada transaksi
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          Belum terdapat pencatatan
                          pemakaian atau waste sesuai
                          filter yang dipilih.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map(
                    (item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-50 transition hover:bg-slate-50/70"
                      >

                        <td className="whitespace-nowrap px-5 py-4">
                          <p className="text-xs font-semibold text-slate-700">
                            {formatDate(
                              item.trxDate
                            )}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600">
                            {item.number}
                          </span>
                        </td>

                        {role === "ADMIN" && (
                          <td className="px-5 py-4">
                            <p className="max-w-[150px] truncate text-xs font-semibold text-slate-700">
                              {item.outlet}
                            </p>
                          </td>
                        )}

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-extrabold ${
                              item.type ===
                              "WASTE"
                                ? "bg-red-50 text-red-600"
                                : "bg-green-50 text-green-700"
                            }`}
                          >
                            {item.type ===
                            "WASTE" ? (
                              <Trash2 size={11} />
                            ) : (
                              <ArrowDownCircle
                                size={11}
                              />
                            )}

                            {item.type}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                              <Package
                                size={16}
                              />
                            </div>

                            <div className="min-w-0">
                              <p className="max-w-[230px] truncate text-xs font-bold text-slate-700">
                                {item.barang}
                              </p>

                              <p className="mt-0.5 text-[10px] text-slate-400">
                                {item.code}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <p className="text-xs font-bold text-slate-700">
                            {item.qtyProcessed}
                          </p>

                          <p className="text-[10px] text-slate-400">
                            {item.unit}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <p
                            className={`text-xs font-bold ${
                              item.wasteQty > 0
                                ? "text-red-600"
                                : "text-slate-400"
                            }`}
                          >
                            {item.wasteQty}
                          </p>

                          <p className="text-[10px] text-slate-400">
                            {item.unit}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <p className="text-xs font-extrabold text-green-700">
                            {item.netQty}
                          </p>

                          <p className="text-[10px] text-slate-400">
                            {item.unit}
                          </p>
                        </td>

                        <td className="max-w-[280px] px-5 py-4">
                          <p
                            className="truncate text-xs text-slate-500"
                            title={
                              item.note ||
                              undefined
                            }
                          >
                            {item.note || "-"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                              {item.user?.fullname
                                ?.charAt(0)
                                ?.toUpperCase() ||
                                "U"}
                            </div>

                            <div>
                              <p className="max-w-[130px] truncate text-xs font-semibold text-slate-600">
                                {item.user
                                  ?.fullname ||
                                  "-"}
                              </p>

                              {item.user
                                ?.username && (
                                <p className="max-w-[130px] truncate text-[9px] text-slate-400">
                                  @
                                  {
                                    item.user
                                      .username
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                      </tr>
                    )
                  )
                )}

              </tbody>
            </table>
          </div>

        </section>

      </div>

      {/* =================================================
          SMALL LOCAL UTILITY CLASSES
      ================================================= */}

      <style jsx>{`
        .premium-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0.7rem 0.85rem;
          font-size: 0.875rem;
          outline: none;
          transition: all 150ms ease;
        }

        .premium-input:focus {
          border-color: rgb(34 197 94);
          box-shadow: 0 0 0 4px rgb(240 253 244);
        }

        .premium-input:disabled {
          cursor: not-allowed;
          background: rgb(248 250 252);
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}

// =====================================================
// KPI CARD
// =====================================================

function KpiCard({
  icon: Icon,
  label,
  value,
  suffix,
  description,
  danger = false,
}: {
  icon: any;
  label: string;
  value: number;
  suffix: string;
  description: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">

      <div className="flex items-start justify-between gap-3">

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {label}
          </p>

          <div className="mt-1 flex items-end gap-1.5">
            <p className="text-2xl font-extrabold tracking-tight text-slate-800">
              {value}
            </p>

            <p className="mb-1 text-[10px] font-semibold text-slate-400">
              {suffix}
            </p>
          </div>
        </div>

        <div
          className={`rounded-xl p-2.5 ${
            danger
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-600"
          }`}
        >
          <Icon size={18} />
        </div>

      </div>

      <p className="mt-2 text-[10px] text-slate-400">
        {description}
      </p>
    </div>
  );
}

// =====================================================
// FORM SECTION
// =====================================================

function FormSection({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-start gap-3">

        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-extrabold text-slate-500">
          {number}
        </span>

        <div>
          <h3 className="text-sm font-bold text-slate-800">
            {title}
          </h3>

          <p className="mt-0.5 text-[11px] leading-5 text-slate-400">
            {description}
          </p>
        </div>
      </div>

      {children}
    </section>
  );
}

// =====================================================
// FILTER FIELD
// =====================================================

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>

      {children}
    </div>
  );
}

// =====================================================
// MINI METRIC
// =====================================================

function MiniMetric({
  label,
  value,
  danger = false,
  warning = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        danger
          ? "border-red-100 bg-red-50"
          : warning
          ? "border-amber-100 bg-amber-50"
          : "border-slate-100 bg-slate-50"
      }`}
    >
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 text-xs font-extrabold ${
          danger
            ? "text-red-600"
            : warning
            ? "text-amber-600"
            : "text-slate-700"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// =====================================================
// DARK METRIC
// =====================================================

function DarkMetric({
  label,
  value,
  unit,
  danger = false,
}: {
  label: string;
  value: number | string;
  unit: string;
  danger?: boolean;
}) {
  return (
    <div className="p-4">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p
        className={`mt-1 text-xl font-extrabold ${
          danger
            ? "text-red-400"
            : "text-white"
        }`}
      >
        {value}
      </p>

      <p className="mt-0.5 text-[9px] font-medium text-slate-500">
        {unit}
      </p>
    </div>
  );
}

// =====================================================
// SUMMARY ROW
// =====================================================

function SummaryRow({
  label,
  value,
  strong = false,
  danger = false,
  success = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  danger?: boolean;
  success?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-xs text-slate-400">
        {label}
      </span>

      <span
        className={`max-w-[220px] truncate text-right text-xs ${
          strong
            ? "font-extrabold"
            : "font-semibold"
        } ${
          danger
            ? "text-red-600"
            : success
            ? "text-green-700"
            : "text-slate-700"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// =====================================================
// FORMAT DATE
// =====================================================

function formatDate(value: string) {
  return new Date(value).toLocaleString(
    "id-ID",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}