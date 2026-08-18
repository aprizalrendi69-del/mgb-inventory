"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownCircle,
  CheckCircle2,
  Loader2,
  Package,
  RefreshCw,
  Search,
  XCircle,
  ChevronDown,
} from "lucide-react";

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

  const [transactions, setTransactions] = useState<
    Transaction[]
  >([]);

  const [barangId, setBarangId] = useState("");

  // =====================================================
  // SEARCH BARANG
  // =====================================================

  const [barangSearch, setBarangSearch] = useState("");

  const [barangDropdownOpen, setBarangDropdownOpen] =
    useState(false);

  // =====================================================
  // PEMAKAIAN
  // =====================================================

  const [qtyProcessed, setQtyProcessed] =
    useState("");

  const [wasteQty, setWasteQty] =
    useState("");

  const [note, setNote] = useState("");

  // =====================================================
  // FILTER ADMIN
  // =====================================================

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // =====================================================
  // STATE
  // =====================================================

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
          params.set(
            "outletId",
            selectedOutletId
          );
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
        `/api/outlet/barang-keluar${
          query ? `?${query}` : ""
        }`,
        {
          cache: "no-store",
        }
      );

      const json: ApiResponse =
        await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil data pemakaian outlet"
        );
      }

      setRole(json.role || "");

      setOutlets(json.outlets || []);

      setCurrentOutlet(
        json.currentOutlet || null
      );

      setBarang(json.stocks || []);

      setTransactions(
        json.transactions || []
      );

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
  // LOAD CURRENT USER
  // =====================================================

  useEffect(() => {
    async function loadMe() {
      try {
        const res = await fetch(
          "/api/me",
          {
            cache: "no-store",
          }
        );

        const json = await res.json();

        if (
          !res.ok ||
          !json.success
        ) {
          throw new Error(
            json.message ||
              "Tidak login"
          );
        }

        const userRole =
          json.user?.role;

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
          setCurrentOutlet(
            json.user.outlet
          );

          setSelectedOutletId(
            String(
              json.user.outlet.id
            )
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
  // FILTER ADMIN
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
  // BARANG TERSEDIA
  // =====================================================

  const availableBarang = useMemo(() => {
    return barang.filter((item) => {
      if (
        role === "OUTLET_ADMIN"
      ) {
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
    const keyword =
      barangSearch
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
  // BARANG TERPILIH
  // =====================================================

  const selectedBarang = useMemo(() => {
    return barang.find(
      (item) =>
        item.barangId ===
          Number(barangId) &&
        (
          role ===
            "OUTLET_ADMIN" ||
          item.outletId ===
            Number(
              selectedOutletId
            )
        )
    );
  }, [
    barang,
    barangId,
    role,
    selectedOutletId,
  ]);

  // =====================================================
  // PILIH BARANG
  // =====================================================

  function handleSelectBarang(
    item: BarangStock
  ) {
    setBarangId(
      String(item.barangId)
    );

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
  // QTY
  //
  // Qty diproses = barang yang diambil dari stock
  // Waste = bagian dari qty diproses
  // Bersih = qty diproses - waste
  // =====================================================

  const processed =
    Number(qtyProcessed) || 0;

  const waste =
    Number(wasteQty) || 0;

  const netQty = Math.max(
    processed - waste,
    0
  );

  // =====================================================
  // WASTE PERCENTAGE
  // =====================================================

  const wastePercentage =
    processed > 0
      ? (waste / processed) *
        100
      : 0;

  // =====================================================
  // STOCK AFTER
  // =====================================================

  const estimatedStockAfter =
    selectedBarang
      ? Math.max(
          selectedBarang.stock -
            processed,
          0
        )
      : null;

  // =====================================================
  // RESET FORM
  // =====================================================

  function resetForm() {
    setBarangId("");
    setBarangSearch("");
    setBarangDropdownOpen(false);

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

    // ---------------------------------------------------
    // VALIDASI OUTLET
    // ---------------------------------------------------

    if (
      role === "ADMIN" &&
      !selectedOutletId
    ) {
      setError(
        "Silakan pilih outlet terlebih dahulu"
      );
      return;
    }

    // ---------------------------------------------------
    // VALIDASI BARANG
    // ---------------------------------------------------

    if (!barangId) {
      setError(
        "Silakan pilih barang"
      );
      return;
    }

    // ---------------------------------------------------
    // VALIDASI QTY
    // ---------------------------------------------------

    if (
      !processed ||
      processed <= 0
    ) {
      setError(
        "Qty dipakai harus lebih dari 0"
      );
      return;
    }

    if (waste < 0) {
      setError(
        "Qty waste tidak valid"
      );
      return;
    }

    if (waste > processed) {
      setError(
        "Qty waste tidak boleh lebih besar dari qty dipakai"
      );
      return;
    }

    // ---------------------------------------------------
    // VALIDASI STOCK
    // ---------------------------------------------------

    if (
      selectedBarang &&
      processed >
        selectedBarang.stock
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

            barangId:
              Number(barangId),

            // =================================================
            // SESUAI KONSEP:
            // SEMUA BARANG KELUAR OUTLET ADALAH PEMAKAIAN
            // WASTE HANYA BAGIAN DARI PEMAKAIAN
            // =================================================

            type: "PEMAKAIAN",

            qtyProcessed:
              processed,

            wasteQty:
              waste,

            note,
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
            "Gagal menyimpan pemakaian outlet"
        );
      }

      setMessage(
        `${json.data.barang} berhasil dicatat sebagai pemakaian. ` +
          `Pemakaian ${json.data.qtyProcessed} ${json.data.unit}, ` +
          `waste ${json.data.wasteQty} ${json.data.unit}, ` +
          `bersih ${json.data.netQty} ${json.data.unit}. ` +
          `Stock ${json.data.stockBefore} → ${json.data.stockAfter} ${json.data.unit}.`
      );

      resetForm();

      await loadData();
    } catch (err: any) {
      setError(
        err?.message ||
          "Gagal menyimpan pemakaian outlet"
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
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            {error ||
              "Akses ditolak"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-red-50 p-2.5 text-red-600">
                <ArrowDownCircle
                  size={23}
                />
              </div>

              <div>
                <h1 className="text-xl font-bold text-slate-800">
                  Pemakaian & Waste Outlet
                </h1>

                <p className="text-sm text-slate-500">
                  {role === "ADMIN"
                    ? "Admin Pusat"
                    : currentOutlet?.name ||
                      "Outlet"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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

        {/* =================================================
            ADMIN FILTER
        ================================================= */}

        {role === "ADMIN" && (
          <div className="rounded-2xl bg-white p-5 shadow-sm">

            <div className="mb-4 flex items-center gap-2">
              <Search
                size={18}
                className="text-slate-500"
              />

              <div>
                <h2 className="font-semibold text-slate-800">
                  Filter Pemakaian Outlet
                </h2>

                <p className="text-xs text-slate-400">
                  Lihat pemakaian dan waste berdasarkan outlet dan tanggal
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">

              {/* OUTLET */}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Outlet
                </label>

                <select
                  value={
                    selectedOutletId
                  }
                  onChange={(e) => {
                    setSelectedOutletId(
                      e.target.value
                    );

                    setBarangId("");
                    setBarangSearch("");
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                >
                  <option value="">
                    Semua Outlet
                  </option>

                  {outlets.map(
                    (outlet) => (
                      <option
                        key={
                          outlet.id
                        }
                        value={
                          outlet.id
                        }
                      >
                        {outlet.code} -{" "}
                        {outlet.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* FROM */}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Dari Tanggal
                </label>

                <input
                  type="date"
                  value={from}
                  onChange={(e) =>
                    setFrom(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </div>

              {/* TO */}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Sampai Tanggal
                </label>

                <input
                  type="date"
                  value={to}
                  onChange={(e) =>
                    setTo(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </div>

              {/* BUTTON */}

              <div className="flex items-end gap-2">

                <button
                  type="button"
                  onClick={
                    applyFilter
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
                >
                  <Search
                    size={16}
                  />

                  Filter
                </button>

                <button
                  type="button"
                  onClick={
                    resetFilter
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-slate-600 hover:bg-slate-50"
                  title="Reset"
                >
                  <XCircle
                    size={17}
                  />
                </button>

              </div>
            </div>
          </div>
        )}

        {/* =================================================
            ALERT
        ================================================= */}

        {message && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle2
              size={19}
              className="mt-0.5 shrink-0"
            />

            <div>
              {message}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* =================================================
            FORM + SUMMARY
        ================================================= */}

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">

          {/* =================================================
              FORM
          ================================================= */}

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl bg-white p-5 shadow-sm"
          >

            <div className="mb-5">
              <h2 className="font-semibold text-slate-800">
                Catat Pemakaian Barang
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Masukkan jumlah barang yang digunakan dari stock
                outlet. Jika ada waste, masukkan pada kolom waste.
              </p>
            </div>

            <div className="space-y-4">

              {/* =================================================
                  OUTLET ADMIN
              ================================================= */}

              {role === "ADMIN" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Outlet
                  </label>

                  <select
                    value={
                      selectedOutletId
                    }
                    onChange={(e) => {
                      setSelectedOutletId(
                        e.target.value
                      );

                      setBarangId("");
                      setBarangSearch("");
                    }}
                    disabled={saving}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  >
                    <option value="">
                      -- Pilih Outlet --
                    </option>

                    {outlets.map(
                      (outlet) => (
                        <option
                          key={
                            outlet.id
                          }
                          value={
                            outlet.id
                          }
                        >
                          {outlet.code} -{" "}
                          {outlet.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}

              {/* =================================================
                  OUTLET CURRENT
              ================================================= */}

              {role ===
                "OUTLET_ADMIN" &&
                currentOutlet && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                    <p className="text-xs text-green-600">
                      Outlet
                    </p>

                    <p className="font-semibold text-green-800">
                      {
                        currentOutlet.code
                      }{" "}
                      -{" "}
                      {
                        currentOutlet.name
                      }
                    </p>
                  </div>
                )}

              {/* =================================================
                  BARANG
              ================================================= */}

              <div className="relative">

                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Barang
                </label>

                <div className="relative">

                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={
                      barangSearch
                    }
                    onChange={(e) => {
                      setBarangSearch(
                        e.target.value
                      );

                      setBarangId("");

                      setBarangDropdownOpen(
                        true
                      );
                    }}
                    onFocus={() => {
                      setBarangDropdownOpen(
                        true
                      );
                    }}
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
                        role ===
                          "ADMIN" &&
                        !selectedOutletId
                      )
                    }
                    placeholder={
                      role ===
                        "ADMIN" &&
                      !selectedOutletId
                        ? "Pilih outlet terlebih dahulu"
                        : "Ketik kode atau nama barang..."
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:bg-slate-50"
                  />

                  {barangSearch && (
                    <button
                      type="button"
                      onClick={
                        clearBarang
                      }
                      className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <XCircle
                        size={16}
                      />
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

                {/* =================================================
                    DROPDOWN
                ================================================= */}

                {barangDropdownOpen &&
                  !loading &&
                  !saving &&
                  !(
                    role ===
                      "ADMIN" &&
                    !selectedOutletId
                  ) && (
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">

                      <div className="max-h-[280px] overflow-y-auto">

                        {filteredBarang.length ===
                        0 ? (
                          <div className="px-4 py-8 text-center">

                            <Package
                              size={25}
                              className="mx-auto mb-2 text-slate-300"
                            />

                            <p className="text-sm font-medium text-slate-500">
                              Barang tidak ditemukan
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Coba ketik kode atau nama barang lain
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

                              return (
                                <button
                                  type="button"
                                  key={`${item.outletId}-${item.barangId}`}
                                  onClick={() =>
                                    handleSelectBarang(
                                      item
                                    )
                                  }
                                  className={`flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-green-50 ${
                                    selected
                                      ? "bg-green-50"
                                      : "bg-white"
                                  }`}
                                >

                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                    <Package
                                      size={18}
                                    />
                                  </div>

                                  <div className="min-w-0 flex-1">

                                    <div className="flex items-center gap-2">

                                      <p className="truncate text-sm font-semibold text-slate-800">
                                        {
                                          item.name
                                        }
                                      </p>

                                      {selected && (
                                        <CheckCircle2
                                          size={15}
                                          className="shrink-0 text-green-600"
                                        />
                                      )}

                                    </div>

                                    <p className="mt-0.5 text-xs text-slate-400">
                                      {
                                        item.code
                                      }

                                      {" • "}

                                      {
                                        item.unit
                                      }
                                    </p>

                                  </div>

                                  <div className="shrink-0 text-right">

                                    <p className="text-sm font-bold text-slate-700">
                                      {
                                        item.stock
                                      }
                                    </p>

                                    <p className="text-[10px] uppercase text-slate-400">
                                      Stock
                                    </p>

                                  </div>

                                </button>
                              );
                            }
                          )
                        )}

                      </div>

                      <div className="border-t border-slate-100 bg-slate-50 px-4 py-2">
                        <p className="text-[11px] text-slate-400">
                          {
                            filteredBarang.length
                          }{" "}
                          barang ditemukan
                        </p>
                      </div>

                    </div>
                  )}
              </div>

              {/* =================================================
                  CLICK OUTSIDE
              ================================================= */}

              {barangDropdownOpen && (
                <button
                  type="button"
                  aria-label="Tutup pilihan barang"
                  onClick={() =>
                    setBarangDropdownOpen(
                      false
                    )
                  }
                  className="fixed inset-0 z-40 cursor-default"
                  style={{
                    background:
                      "transparent",
                  }}
                />
              )}

              {/* =================================================
                  BARANG TERPILIH
              ================================================= */}

              {selectedBarang && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">

                  <div className="flex items-center gap-3">

                    <div className="rounded-xl bg-white p-2 text-green-600 shadow-sm">
                      <Package
                        size={20}
                      />
                    </div>

                    <div className="min-w-0">

                      <p className="truncate text-sm font-semibold text-slate-800">
                        {
                          selectedBarang.name
                        }
                      </p>

                      <p className="text-xs text-slate-500">
                        {
                          selectedBarang.code
                        }
                      </p>

                    </div>

                    <div className="ml-auto text-right">

                      <p className="text-lg font-bold text-slate-800">
                        {
                          selectedBarang.stock
                        }
                      </p>

                      <p className="text-xs text-slate-500">
                        {
                          selectedBarang.unit
                        }
                      </p>

                    </div>

                  </div>

                </div>
              )}

              {/* =================================================
                  QTY DIPAKAI
              ================================================= */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Qty Dipakai
                </label>

                <p className="mb-2 text-xs text-slate-400">
                  Jumlah barang yang diambil/digunakan dari stock outlet.
                </p>

                <div className="relative">

                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={
                      qtyProcessed
                    }
                    onChange={(e) =>
                      setQtyProcessed(
                        e.target.value
                      )
                    }
                    disabled={saving}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-14 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />

                  {selectedBarang && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      {
                        selectedBarang.unit
                      }
                    </span>
                  )}

                </div>
              </div>

              {/* =================================================
                  WASTE
              ================================================= */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Qty Waste
                </label>

                <p className="mb-2 text-xs text-slate-400">
                  Bagian dari barang yang dipakai tetapi terbuang.
                </p>

                <div className="relative">

                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={
                      wasteQty
                    }
                    onChange={(e) =>
                      setWasteQty(
                        e.target.value
                      )
                    }
                    disabled={saving}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-14 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />

                  {selectedBarang && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      {
                        selectedBarang.unit
                      }
                    </span>
                  )}

                </div>
              </div>

              {/* =================================================
                  HASIL PERHITUNGAN
              ================================================= */}

              {selectedBarang &&
                processed > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

                    <div className="grid gap-3 sm:grid-cols-3">

                      <div>
                        <p className="text-xs text-slate-400">
                          Qty Dipakai
                        </p>

                        <p className="mt-1 text-lg font-bold text-slate-800">
                          {processed}{" "}
                          <span className="text-xs font-medium text-slate-400">
                            {
                              selectedBarang.unit
                            }
                          </span>
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          Waste
                        </p>

                        <p className="mt-1 text-lg font-bold text-red-600">
                          {waste}{" "}
                          <span className="text-xs font-medium text-slate-400">
                            {
                              selectedBarang.unit
                            }
                          </span>
                        </p>

                        {waste > 0 && (
                          <p className="text-[11px] text-red-500">
                            {wastePercentage.toFixed(
                              1
                            )}
                            %
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          Pemakaian Bersih
                        </p>

                        <p className="mt-1 text-lg font-bold text-green-700">
                          {netQty}{" "}
                          <span className="text-xs font-medium text-slate-400">
                            {
                              selectedBarang.unit
                            }
                          </span>
                        </p>
                      </div>

                    </div>

                  </div>
                )}

              {/* =================================================
                  NOTE
              ================================================= */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Keterangan
                </label>

                <textarea
                  value={note}
                  onChange={(e) =>
                    setNote(
                      e.target.value
                    )
                  }
                  disabled={saving}
                  rows={3}
                  placeholder="Contoh: produksi shift pagi, bahan untuk menu A, dll..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </div>

              {/* =================================================
                  BUTTON
              ================================================= */}

              <button
                type="submit"
                disabled={
                  saving ||
                  loading ||
                  !barangId ||
                  !qtyProcessed ||
                  (
                    role ===
                      "ADMIN" &&
                    !selectedOutletId
                  )
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >

                {saving ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />

                    Menyimpan...
                  </>
                ) : (
                  <>
                    <ArrowDownCircle
                      size={18}
                    />

                    Simpan Pemakaian
                  </>
                )}

              </button>

            </div>
          </form>

          {/* =================================================
              SUMMARY
          ================================================= */}

          <div className="space-y-4">

            <div className="rounded-2xl bg-white p-5 shadow-sm">

              <h2 className="font-semibold text-slate-800">
                Ringkasan Pemakaian
              </h2>

              <div className="mt-4 space-y-3">

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
                  label="Barang"
                  value={
                    selectedBarang?.name ||
                    "-"
                  }
                />

                <SummaryRow
                  label="Qty Dipakai"
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
                      ? `${waste} ${selectedBarang.unit}`
                      : "-"
                  }
                />

                <div className="border-t border-slate-100 pt-3">

                  <SummaryRow
                    label="Pemakaian Bersih"
                    value={
                      selectedBarang
                        ? `${netQty} ${selectedBarang.unit}`
                        : "-"
                    }
                    strong
                  />

                </div>

              </div>

            </div>

            {/* =================================================
                STOCK SETELAH PEMAKAIAN
            ================================================= */}

            {selectedBarang && (
              <div className="rounded-2xl bg-white p-5 shadow-sm">

                <p className="text-sm font-medium text-slate-500">
                  Stock setelah pemakaian
                </p>

                <p className="mt-1 text-3xl font-bold text-slate-800">

                  {estimatedStockAfter}

                  <span className="ml-1 text-sm font-medium text-slate-400">
                    {
                      selectedBarang.unit
                    }
                  </span>

                </p>

                <div className="mt-3 flex items-center justify-between text-xs">

                  <span className="text-slate-400">
                    Stock awal
                  </span>

                  <span className="font-medium text-slate-600">
                    {
                      selectedBarang.stock
                    }{" "}
                    {
                      selectedBarang.unit
                    }
                  </span>

                </div>

                <div className="mt-1 flex items-center justify-between text-xs">

                  <span className="text-slate-400">
                    Keluar
                  </span>

                  <span className="font-medium text-red-600">
                    -{processed}{" "}
                    {
                      selectedBarang.unit
                    }
                  </span>

                </div>

              </div>
            )}

            {/* =================================================
                PENJELASAN KONSEP
            ================================================= */}

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">

              <p className="text-sm font-semibold text-amber-800">
                Cara pencatatan
              </p>

              <div className="mt-2 space-y-2 text-sm leading-6 text-amber-700">

                <p>
                  <b>Qty Dipakai</b> adalah seluruh barang yang diambil dari stock outlet.
                </p>

                <p>
                  <b>Waste</b> adalah bagian dari barang tersebut yang terbuang.
                </p>

                <p>
                  Stock tetap berkurang sebesar{" "}
                  <b>Qty Dipakai</b>, bukan Qty Bersih.
                </p>

                <p>
                  Contoh: ambil 10 kg, waste 2 kg → stock berkurang 10 kg dan pemakaian bersih 8 kg.
                </p>

                <p className="font-medium">
                  Data waste nantinya dapat digunakan untuk Cost Control dan evaluasi waste outlet.
                </p>

              </div>

            </div>

          </div>
        </div>

        {/* =================================================
            RIWAYAT
        ================================================= */}

        <div className="rounded-2xl bg-white shadow-sm">

          <div className="flex items-center justify-between border-b border-slate-100 p-5">

            <div>
              <h2 className="font-semibold text-slate-800">
                Riwayat Pemakaian Outlet
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {
                  transactions.length
                }{" "}
                transaksi
              </p>
            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1100px] text-sm">

              <thead>

                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">

                  <th className="px-5 py-3">
                    Tanggal
                  </th>

                  <th className="px-5 py-3">
                    Nomor
                  </th>

                  {role ===
                    "ADMIN" && (
                    <th className="px-5 py-3">
                      Outlet
                    </th>
                  )}

                  <th className="px-5 py-3">
                    Barang
                  </th>

                  <th className="px-5 py-3 text-right">
                    Dipakai
                  </th>

                  <th className="px-5 py-3 text-right">
                    Waste
                  </th>

                  <th className="px-5 py-3 text-right">
                    Bersih
                  </th>

                  <th className="px-5 py-3">
                    Keterangan
                  </th>

                  <th className="px-5 py-3">
                    User
                  </th>

                </tr>

              </thead>

              <tbody>

                {loading ? (
                  <tr>
                    <td
                      colSpan={
                        role ===
                        "ADMIN"
                          ? 9
                          : 8
                      }
                      className="px-5 py-10 text-center text-slate-400"
                    >

                      <Loader2
                        size={20}
                        className="mx-auto animate-spin"
                      />

                    </td>
                  </tr>
                ) : transactions.length ===
                  0 ? (
                  <tr>

                    <td
                      colSpan={
                        role ===
                        "ADMIN"
                          ? 9
                          : 8
                      }
                      className="px-5 py-10 text-center text-slate-400"
                    >
                      Belum ada pemakaian
                    </td>

                  </tr>
                ) : (
                  transactions.map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                        className="border-b border-slate-50 hover:bg-slate-50"
                      >

                        {/* TANGGAL */}

                        <td className="whitespace-nowrap px-5 py-3">
                          {formatDate(
                            item.trxDate
                          )}
                        </td>

                        {/* NOMOR */}

                        <td className="px-5 py-3 font-medium text-slate-700">
                          {
                            item.number
                          }
                        </td>

                        {/* OUTLET */}

                        {role ===
                          "ADMIN" && (
                          <td className="px-5 py-3">
                            {
                              item.outlet
                            }
                          </td>
                        )}

                        {/* BARANG */}

                        <td className="px-5 py-3">

                          <div className="font-medium text-slate-700">
                            {
                              item.barang
                            }
                          </div>

                          <div className="text-xs text-slate-400">
                            {
                              item.code
                            }
                          </div>

                        </td>

                        {/* DIPAKAI */}

                        <td className="px-5 py-3 text-right font-medium">
                          {
                            item.qtyProcessed
                          }{" "}
                          {
                            item.unit
                          }
                        </td>

                        {/* WASTE */}

                        <td className="px-5 py-3 text-right">

                          <span
                            className={
                              item.wasteQty >
                              0
                                ? "font-semibold text-red-600"
                                : "text-slate-400"
                            }
                          >
                            {
                              item.wasteQty
                            }{" "}
                            {
                              item.unit
                            }
                          </span>

                        </td>

                        {/* BERSIH */}

                        <td className="px-5 py-3 text-right font-semibold text-green-700">
                          {
                            item.netQty
                          }{" "}
                          {
                            item.unit
                          }
                        </td>

                        {/* NOTE */}

                        <td className="max-w-[260px] px-5 py-3">

                          <p className="truncate text-xs text-slate-500">
                            {
                              item.note ||
                              "-"
                            }
                          </p>

                        </td>

                        {/* USER */}

                        <td className="px-5 py-3 text-xs text-slate-500">
                          {item.user
                            ?.fullname ||
                            "-"}
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
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">

      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span
        className={
          strong
            ? "text-right text-sm font-bold text-slate-800"
            : "text-right text-sm font-medium text-slate-700"
        }
      >
        {value}
      </span>

    </div>
  );
}

// =====================================================
// FORMAT DATE
// =====================================================

function formatDate(
  value: string
) {
  return new Date(
    value
  ).toLocaleString(
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