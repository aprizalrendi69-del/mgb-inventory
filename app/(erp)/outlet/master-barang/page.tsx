"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Plus,
  Upload,
  Search,
  RefreshCw,
  Package,
  X,
  ChevronDown,
  Check,
  Boxes,
  Building2,
  CircleDollarSign,
  Database,
  Link2,
  Power,
  AlertCircle,
  Sparkles,
} from "lucide-react";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Barang = {
  id: number;
  code: string;
  barcode: string | null;
  name: string;
  category: string | null;
  brand: string | null;
  unit: string;
  baseUnit: string | null;
  conversionRate: number;
  minimumStock: number;
  purchasePrice?: number | null;
  active?: boolean;
  source?: "CENTRAL" | "OUTLET";
};

type OutletStock = {
  id?: number;
  stock?: number | null;
  minimumStock?: number | null;
  averageCost?: number | null;
};

type OutletBarang = {
  /**
   * Bisa berupa:
   * - OutletBarang.id jika mapping sudah ada
   * - Barang.id jika row berasal langsung dari Central Catalog
   */
  id: number;

  /**
   * ID mapping OutletBarang jika tersedia.
   */
  outletBarangId?: number | null;

  /**
   * ID Barang Central.
   */
  barangId?: number | null;

  harga: number | null;
  aktif: boolean;

  /**
   * Tidak semua response memiliki outlet.
   * Central Barang yang belum mempunyai mapping
   * memang tidak memiliki relasi outlet.
   */
  outlet?: Outlet | null;

  barang: Barang;

  outletStock?: OutletStock | null;

  hargaTerakhir?: number | null;
  hargaDefault?: number | null;

  hargaSource?:
    | "OUTLET_PURCHASE_TERAKHIR"
    | "OUTLET_MASTER"
    | "CENTRAL_PURCHASE_PRICE"
    | "NONE";

  hargaTerakhirTanggal?: string | null;
  hargaTerakhirPurchase?: string | null;
  hargaTerakhirPurchaseId?: number | null;
};

type User = {
  role: string;
  outletId: number | null;
};

type FormState = {
  outletId: string;
  barangId: string;
  harga: string;
};

function formatNumber(value: number | null | undefined) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toLocaleString("id-ID", {
    maximumFractionDigits: 4,
  });
}

function formatCurrency(value: number | null | undefined) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return "Rp 0";
  }

  return `Rp ${number.toLocaleString("id-ID")}`;
}

function normalizeBarang(raw: any): Barang | null {
  if (!raw?.id) {
    return null;
  }

  const id = Number(raw.id);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  /**
   * Catalog ini hanya boleh membaca Barang Central.
   * Barang legacy OUTLET tidak diikutkan.
   */
  if (raw.source && raw.source !== "CENTRAL") {
    return null;
  }

  return {
    id,
    code: String(raw.code ?? ""),
    barcode:
      raw.barcode == null
        ? null
        : String(raw.barcode),
    name: String(raw.name ?? ""),
    category:
      raw.category == null
        ? null
        : String(raw.category),
    brand:
      raw.brand == null
        ? null
        : String(raw.brand),
    unit: String(raw.unit ?? ""),
    baseUnit:
      raw.baseUnit == null
        ? null
        : String(raw.baseUnit),
    conversionRate:
      Number(raw.conversionRate) > 0
        ? Number(raw.conversionRate)
        : 1,
    minimumStock:
      Number(raw.minimumStock) || 0,
    purchasePrice:
      raw.purchasePrice == null
        ? null
        : Number(raw.purchasePrice),
    active: raw.active === false ? false : true,
    source: "CENTRAL",
  };
}

function normalizeOutlet(raw: any): Outlet | null {
  if (!raw?.id) {
    return null;
  }

  const id = Number(raw.id);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return {
    id,
    code: String(raw.code ?? ""),
    name: String(raw.name ?? ""),
  };
}

function normalizeOutletBarang(row: any): OutletBarang | null {
  if (!row) {
    return null;
  }

  /**
   * Endpoint bisa mengembalikan:
   *
   * {
   *   id,
   *   barang: {...},
   *   outlet: {...}
   * }
   *
   * atau langsung:
   *
   * {
   *   id,
   *   code,
   *   name,
   *   ...
   * }
   */
  const rawBarang = row?.barang ?? row;

  const barang = normalizeBarang(rawBarang);

  if (!barang) {
    return null;
  }

  const outlet = normalizeOutlet(row?.outlet);

  const outletBarangId =
    row?.outletBarangId != null
      ? Number(row.outletBarangId)
      : row?.outletBarang?.id != null
        ? Number(row.outletBarang.id)
        : outlet
          ? Number(row.id)
          : null;

  return {
    id:
      Number(row?.id) > 0
        ? Number(row.id)
        : barang.id,

    outletBarangId:
      Number.isInteger(outletBarangId) &&
      Number(outletBarangId) > 0
        ? Number(outletBarangId)
        : null,

    barangId: barang.id,

    harga:
      row?.harga == null
        ? null
        : Number(row.harga),

    aktif:
      row?.aktif === false
        ? false
        : true,

    outlet,

    barang,

    outletStock:
      row?.outletStock ?? null,

    hargaTerakhir:
      row?.hargaTerakhir == null
        ? null
        : Number(row.hargaTerakhir),

    hargaDefault:
      row?.hargaDefault == null
        ? null
        : Number(row.hargaDefault),

    hargaSource:
      row?.hargaSource || "NONE",

    hargaTerakhirTanggal:
      row?.hargaTerakhirTanggal ?? null,

    hargaTerakhirPurchase:
      row?.hargaTerakhirPurchase ?? null,

    hargaTerakhirPurchaseId:
      row?.hargaTerakhirPurchaseId == null
        ? null
        : Number(row.hargaTerakhirPurchaseId),
  };
}

export default function OutletMasterBarangPage() {
  const [data, setData] = useState<OutletBarang[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [outletId, setOutletId] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [centralBarang, setCentralBarang] = useState<Barang[]>([]);
  const [loadingCentral, setLoadingCentral] = useState(false);
  const [centralSearch, setCentralSearch] = useState("");

  const [form, setForm] = useState<FormState>({
    outletId: "",
    barangId: "",
    harga: "",
  });

  useEffect(() => {
    loadUser();
    loadOutlets();
  }, []);

  useEffect(() => {
    if (user) {
      void loadData();
    }
  }, [search, outletId, user]);

  useEffect(() => {
    if (showForm) {
      void loadCentralBarang();
    }
  }, [showForm]);

  async function loadUser() {
    try {
      const res = await fetch("/api/me", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json?.user) {
        return;
      }

      const currentUser: User = {
        role: String(json.user.role ?? ""),
        outletId:
          json.user.outletId == null
            ? null
            : Number(json.user.outletId),
      };

      setUser(currentUser);

      if (
        currentUser.role === "OUTLET_ADMIN" &&
        currentUser.outletId
      ) {
        const id = String(currentUser.outletId);

        setOutletId(id);

        setForm((prev) => ({
          ...prev,
          outletId: id,
        }));
      }
    } catch (error) {
      console.error("Gagal mengambil user:", error);
    }
  }

  async function loadOutlets() {
    try {
      const res = await fetch("/api/outlet", {
        cache: "no-store",
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setOutlets(
          Array.isArray(json.data)
            ? json.data
                .map((item: any) => normalizeOutlet(item))
                .filter(
                  (item: Outlet | null): item is Outlet =>
                    Boolean(item)
                )
            : []
        );
      }
    } catch (error) {
      console.error("Gagal mengambil outlet:", error);
    }
  }

  async function loadData() {
    if (!user) {
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      /**
       * Outlet Admin hanya boleh membaca outlet miliknya.
       */
      const effectiveOutletId =
        user.role === "OUTLET_ADMIN"
          ? user.outletId
          : outletId
            ? Number(outletId)
            : null;

      if (effectiveOutletId) {
        params.set(
          "outletId",
          String(effectiveOutletId)
        );
      }

      const query = params.toString();

      const res = await fetch(
        `/api/outlet/master-barang${
          query ? `?${query}` : ""
        }`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        setData([]);
        return;
      }

      const rows = Array.isArray(json.data)
        ? json.data
        : [];

      const normalized: OutletBarang[] = [];

      for (const row of rows) {
        const item = normalizeOutletBarang(row);

        if (item) {
          normalized.push(item);
        }
      }

      /**
       * Hindari duplicate barang pada hasil API
       * apabila endpoint mengembalikan row mapping
       * dan row central secara bersamaan.
       *
       * Jika mapping outlet tersedia, mapping tersebut
       * diprioritaskan dibanding Central Catalog.
       */
      const unique = new Map<
        string,
        OutletBarang
      >();

      for (const item of normalized) {
        const key = `${item.barang.id}-${
          item.outlet?.id ?? "central"
        }`;

        const existing = unique.get(key);

        if (!existing) {
          unique.set(key, item);
          continue;
        }

        if (!existing.outlet && item.outlet) {
          unique.set(key, item);
        }
      }

      setData(
        Array.from(unique.values())
      );
    } catch (error) {
      console.error(
        "Gagal mengambil master barang:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * =========================================================
   * MASTER BARANG CENTRAL
   * =========================================================
   */
  async function loadCentralBarang(
    searchValue = "",
    selectedOutletOverride?: string
  ) {
    setLoadingCentral(true);

    try {
      const params = new URLSearchParams();

      const cleanSearch =
        searchValue.trim();

      if (cleanSearch) {
        params.set("search", cleanSearch);
      }

      const selectedOutlet =
        user?.role === "OUTLET_ADMIN"
          ? user.outletId
          : selectedOutletOverride ||
            form.outletId ||
            outletId;

      if (selectedOutlet) {
        params.set(
          "outletId",
          String(selectedOutlet)
        );
      }

      const query = params.toString();

      const res = await fetch(
        `/api/outlet/master-barang${
          query ? `?${query}` : ""
        }`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        setCentralBarang([]);
        return;
      }

      const rows = Array.isArray(json.data)
        ? json.data
        : [];

      const unique = new Map<
        number,
        Barang
      >();

      for (const row of rows) {
        const barang = normalizeBarang(
          row?.barang ?? row
        );

        if (!barang) {
          continue;
        }

        if (barang.active === false) {
          continue;
        }

        unique.set(
          barang.id,
          barang
        );
      }

      setCentralBarang(
        Array.from(unique.values())
      );
    } catch (error) {
      console.error(
        "Gagal mengambil Master Barang Central:",
        error
      );

      setCentralBarang([]);
    } finally {
      setLoadingCentral(false);
    }
  }

  function formatTanggalHarga(
    value?: string | null
  ) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
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

  function getDisplayPrice(
    item: OutletBarang
  ) {
    const hargaTerakhir = Number(
      item.hargaTerakhir
    );

    if (
      Number.isFinite(hargaTerakhir) &&
      hargaTerakhir > 0
    ) {
      return hargaTerakhir;
    }

    const hargaMaster = Number(
      item.harga
    );

    if (
      Number.isFinite(hargaMaster) &&
      hargaMaster > 0
    ) {
      return hargaMaster;
    }

    const hargaCentral = Number(
      item.barang.purchasePrice
    );

    if (
      Number.isFinite(hargaCentral) &&
      hargaCentral > 0
    ) {
      return hargaCentral;
    }

    return 0;
  }

  function getPriceSource(
    item: OutletBarang
  ) {
    const hargaTerakhir = Number(
      item.hargaTerakhir
    );

    if (
      Number.isFinite(hargaTerakhir) &&
      hargaTerakhir > 0
    ) {
      return "Harga terakhir pembelian";
    }

    const hargaMaster = Number(
      item.harga
    );

    if (
      Number.isFinite(hargaMaster) &&
      hargaMaster > 0
    ) {
      return "Harga master outlet";
    }

    const hargaCentral = Number(
      item.barang.purchasePrice
    );

    if (
      Number.isFinite(hargaCentral) &&
      hargaCentral > 0
    ) {
      return "Harga purchase central";
    }

    return "Belum ada harga";
  }

  function resetForm() {
    const selectedOutlet =
      user?.role === "OUTLET_ADMIN" &&
      user.outletId
        ? String(user.outletId)
        : outletId || "";

    setForm({
      outletId: selectedOutlet,
      barangId: "",
      harga: "",
    });

    setCentralSearch("");
  }

  function openAddForm() {
    resetForm();
    setShowForm(true);
  }

  function getSelectedCentralBarang() {
    if (!form.barangId) {
      return null;
    }

    return (
      centralBarang.find(
        (item) =>
          String(item.id) ===
          String(form.barangId)
      ) || null
    );
  }

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    const selectedOutlet =
      user?.role === "OUTLET_ADMIN"
        ? user.outletId
        : Number(form.outletId);

    if (!selectedOutlet) {
      alert(
        "Pilih outlet terlebih dahulu."
      );
      return;
    }

    if (!form.barangId) {
      alert(
        "Pilih Master Barang Central terlebih dahulu."
      );
      return;
    }

    const barangId = Number(
      form.barangId
    );

    if (
      !Number.isInteger(barangId) ||
      barangId <= 0
    ) {
      alert(
        "Master Barang Central tidak valid."
      );
      return;
    }

    const harga =
      form.harga.trim() === ""
        ? 0
        : Number(form.harga);

    if (
      !Number.isFinite(harga) ||
      harga < 0
    ) {
      alert("Harga tidak valid.");
      return;
    }

    const selectedBarang =
      getSelectedCentralBarang();

    if (!selectedBarang) {
      alert(
        "Master Barang Central tidak ditemukan."
      );
      return;
    }

    setSaving(true);

    try {
      /**
       * HANYA membuat mapping:
       *
       * Barang Central
       *        ↓
       * OutletBarang
       *
       * Tidak membuat Barang baru.
       * Tidak membuat source=OUTLET.
       */
      const payload = {
        outletId: String(
          selectedOutlet
        ),
        barangId,
        harga,
        aktif: true,
      };

      const res = await fetch(
        "/api/outlet/master-barang",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            payload
          ),
        }
      );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        alert(
          json.message ||
            "Gagal menghubungkan Master Barang Central ke outlet."
        );
        return;
      }

      alert(
        json.message ||
          `${selectedBarang.name} berhasil diaktifkan untuk outlet.`
      );

      setShowForm(false);
      resetForm();

      await loadData();
    } catch (error) {
      console.error(
        "Gagal menyimpan master barang outlet:",
        error
      );

      alert(
        "Terjadi kesalahan saat menghubungkan Master Barang Central."
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // IMPORT EXCEL
  // =========================================================

  async function handleImport(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      e.target.files?.[0];

    if (!file) {
      return;
    }

    const selectedOutlet =
      user?.role === "OUTLET_ADMIN"
        ? user.outletId
        : form.outletId ||
          outletId;

    if (!selectedOutlet) {
      alert(
        "Pilih outlet terlebih dahulu."
      );

      e.target.value = "";
      return;
    }

    try {
      setLoading(true);

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "outletId",
        String(selectedOutlet)
      );

      const res =
        await fetch(
          "/api/outlet/master-barang/import",
          {
            method: "POST",
            body: formData,
          }
        );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        alert(
          json.message ||
            "Import barang outlet gagal."
        );
        return;
      }

      const summary =
        json.summary || {};

      alert(
        json.message ||
          `Import selesai.\n\n` +
            `Total: ${
              summary.total || 0
            }\n` +
            `Berhasil: ${
              summary.berhasil || 0
            }\n` +
            `Dilewati: ${
              summary.dilewati || 0
            }\n` +
            `Gagal: ${
              summary.gagal || 0
            }`
      );

      await loadData();
    } catch (error) {
      console.error(
        "IMPORT BARANG OUTLET ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat import Excel."
      );
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  const filteredCentralBarang =
    useMemo(() => {
      const keyword =
        centralSearch
          .trim()
          .toLowerCase();

      if (!keyword) {
        return centralBarang;
      }

      return centralBarang.filter(
        (item) =>
          [
            item.code,
            item.barcode || "",
            item.name,
            item.category || "",
            item.brand || "",
          ].some((value) =>
            value
              .toLowerCase()
              .includes(keyword)
          )
      );
    }, [
      centralBarang,
      centralSearch,
    ]);

  const selectedCentralBarang =
    getSelectedCentralBarang();

  const stats = useMemo(() => {
    const total = data.length;

    const active =
      data.filter(
        (item) => item.aktif
      ).length;

    const inactive =
      data.filter(
        (item) => !item.aktif
      ).length;

    const baseUnitReady =
      data.filter(
        (item) =>
          Boolean(
            item.barang.baseUnit
          ) &&
          Number(
            item.barang
              .conversionRate
          ) > 0
      ).length;

    return {
      total,
      active,
      inactive,
      baseUnitReady,
    };
  }, [data]);

  return (
    <div className="min-h-screen bg-[#F6F8F7]">
      <div className="h-1.5 bg-gradient-to-r from-[#29483A] via-[#527A6B] to-[#A8C7B8]" />

      <div className="p-5 md:p-7 lg:p-8">
        {/* HEADER */}

        <div className="mb-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#29483A] text-white shadow-sm">
                  <Boxes size={18} />
                </div>

                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#527A6B]">
                  Outlet Catalog
                </span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-[#20372D]">
                Master Barang Outlet
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                Kelola barang yang
                tersedia di outlet
                dengan sumber Master
                Barang Central. Outlet
                tidak membuat master
                barang baru.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label
                className="
                  group flex cursor-pointer
                  items-center gap-2 rounded-xl
                  border border-[#C9D9D1]
                  bg-white px-4 py-2.5
                  text-sm font-semibold
                  text-[#29483A] shadow-sm
                  transition hover:border-[#527A6B]
                  hover:bg-[#F4F8F5]
                "
              >
                <Upload
                  size={17}
                  className="transition-transform group-hover:-translate-y-0.5"
                />

                {loading
                  ? "Mengimport..."
                  : "Import Excel"}

                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  disabled={loading}
                  onChange={
                    handleImport
                  }
                />
              </label>

              <button
                type="button"
                onClick={
                  openAddForm
                }
                className="
                  flex items-center gap-2
                  rounded-xl bg-[#29483A]
                  px-4 py-2.5 text-sm
                  font-semibold text-white
                  shadow-sm transition
                  hover:bg-[#1F382D]
                  hover:shadow-md
                  active:scale-[0.98]
                "
              >
                <Plus size={17} />
                Hubungkan Barang Central
              </button>
            </div>
          </div>
        </div>

        {/* ARCHITECTURE INFO */}

        <div className="mb-6 overflow-hidden rounded-2xl border border-[#D8E6DF] bg-white shadow-sm">
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF5F1] text-[#29483A]">
                <Database size={19} />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-[#29483A]">
                    Arsitektur Master Barang
                  </h2>

                  <span className="rounded-full bg-[#E9F3EE] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#527A6B]">
                    Central Source
                  </span>
                </div>

                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Data kode, nama,
                  satuan, satuan dasar,
                  dan konversi berasal
                  dari Master Barang
                  Central. Outlet hanya
                  mengaktifkan barang
                  untuk outletnya.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-[#F7FAF8] px-4 py-3 text-xs text-gray-600">
              <Link2
                size={15}
                className="text-[#527A6B]"
              />

              <span>
                <b className="text-[#29483A]">
                  Barang Central
                </b>{" "}
                → Mapping Outlet
              </span>
            </div>
          </div>
        </div>

        {/* STATISTICS */}

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Boxes size={19} />}
            label="Total Barang"
            value={stats.total}
            description="Barang Central yang tampil"
          />

          <StatCard
            icon={<Power size={19} />}
            label="Aktif"
            value={stats.active}
            description="Aktif pada outlet"
            tone="green"
          />

          <StatCard
            icon={<AlertCircle size={19} />}
            label="Nonaktif"
            value={stats.inactive}
            description="Mapping yang dinonaktifkan"
            tone="orange"
          />

          <StatCard
            icon={<Sparkles size={19} />}
            label="Base Unit Ready"
            value={stats.baseUnitReady}
            description="Siap untuk conversion"
            tone="blue"
          />
        </div>

        {/* FILTER */}

        <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F0F5F2] text-[#527A6B]">
              <Search size={14} />
            </div>

            <span className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              Filter & Pencarian
            </span>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row">
            {user?.role !==
              "OUTLET_ADMIN" && (
              <div className="relative min-w-[250px]">
                <Building2
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <select
                  value={outletId}
                  onChange={(e) => {
                    const value =
                      e.target.value;

                    setOutletId(
                      value
                    );

                    setForm(
                      (prev) => ({
                        ...prev,
                        outletId:
                          value,
                        barangId:
                          "",
                      })
                    );
                  }}
                  className="
                    w-full appearance-none
                    rounded-xl border
                    border-gray-300 bg-white
                    py-2.5 pl-10 pr-10
                    text-sm font-medium
                    text-gray-700 outline-none
                    transition focus:border-[#527A6B]
                    focus:ring-4 focus:ring-[#527A6B]/10
                  "
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

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>
            )}

            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Cari kode, barcode, nama, kategori..."
                className="
                  w-full rounded-xl border
                  border-gray-300 bg-white
                  py-2.5 pl-10 pr-4
                  text-sm outline-none transition
                  placeholder:text-gray-400
                  focus:border-[#527A6B]
                  focus:ring-4 focus:ring-[#527A6B]/10
                "
              />
            </div>

            <button
              type="button"
              onClick={() =>
                void loadData()
              }
              disabled={loading}
              className="
                flex items-center justify-center
                gap-2 rounded-xl border
                border-gray-300 bg-white
                px-4 py-2.5 text-sm
                font-semibold text-gray-700
                transition hover:border-[#527A6B]
                hover:bg-[#F7FAF8]
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
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

        {/* TABLE */}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#29483A]">
                Daftar Barang
              </h2>

              <p className="mt-0.5 text-xs text-gray-400">
                Master barang Central
                yang tersedia untuk
                outlet.
              </p>
            </div>

            <div className="rounded-full bg-[#F1F6F3] px-3 py-1.5 text-xs font-semibold text-[#527A6B]">
              {data.length.toLocaleString(
                "id-ID"
              )}{" "}
              item
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1350px] text-sm">
              <thead className="bg-[#F5F8F6]">
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    No
                  </th>

                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Outlet
                  </th>

                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Barang Central
                  </th>

                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Barcode
                  </th>

                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Kategori
                  </th>

                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Purchase Unit
                  </th>

                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Base Unit
                  </th>

                  <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Konversi
                  </th>

                  <th className="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Minimum
                  </th>

                  <th className="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Harga
                  </th>

                  <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="py-16 text-center"
                    >
                      <RefreshCw
                        size={24}
                        className="mx-auto mb-3 animate-spin text-[#527A6B]"
                      />

                      <p className="text-sm font-semibold text-gray-500">
                        Memuat data
                        barang...
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Mengambil Master
                        Barang Central
                      </p>
                    </td>
                  </tr>
                ) : data.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="py-16 text-center"
                    >
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F5F3] text-gray-300">
                        <Package
                          size={27}
                        />
                      </div>

                      <p className="font-semibold text-gray-500">
                        Belum ada
                        barang
                      </p>

                      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-gray-400">
                        Barang Central
                        akan tampil di
                        sini. Gunakan
                        tombol
                        Hubungkan Barang
                        Central untuk
                        mengaktifkan
                        mapping outlet.
                      </p>
                    </td>
                  </tr>
                ) : (
                  data.map(
                    (
                      item,
                      index
                    ) => {
                      const conversionRate =
                        Number(
                          item.barang
                            .conversionRate
                        ) > 0
                          ? Number(
                              item
                                .barang
                                .conversionRate
                            )
                          : 1;

                      const displayPrice =
                        getDisplayPrice(
                          item
                        );

                      const hasLatestPrice =
                        Number(
                          item.hargaTerakhir
                        ) > 0;

                      const tanggalHarga =
                        formatTanggalHarga(
                          item.hargaTerakhirTanggal
                        );

                      const priceSource =
                        getPriceSource(
                          item
                        );

                      const stock =
                        Number(
                          item
                            .outletStock
                            ?.stock ?? 0
                        );

                      const mappedOutlet =
                        item.outlet ??
                        null;

                      /**
                       * Jika mapping belum ada tetapi
                       * filter outlet sedang dipilih,
                       * outlet filter hanya digunakan
                       * sebagai konteks tampilan.
                       */
                      const selectedOutlet =
                        outletId
                          ? outlets.find(
                              (
                                outlet
                              ) =>
                                String(
                                  outlet.id
                                ) ===
                                String(
                                  outletId
                                )
                            ) ??
                            null
                          : null;

                      const displayOutlet =
                        mappedOutlet ??
                        selectedOutlet;

                      const isMapped =
                        Boolean(
                          mappedOutlet
                        );

                      /**
                       * FIX:
                       * Jangan campur ?? dengan || tanpa
                       * parentheses.
                       */
                      const rowScope =
                        mappedOutlet?.id ??
                        (outletId
                          ? outletId
                          : "central");

                      return (
                        <tr
                          key={`${item.barang.id}-${rowScope}`}
                          className="
                            border-b border-gray-50
                            transition hover:bg-[#FAFCFB]
                          "
                        >
                          <td className="px-4 py-4 text-xs font-medium text-gray-400">
                            {String(
                              index + 1
                            ).padStart(
                              2,
                              "0"
                            )}
                          </td>

                          <td className="px-4 py-4">
                            {isMapped &&
                            displayOutlet ? (
                              <>
                                <div className="inline-flex items-center gap-2 rounded-lg bg-[#F3F7F5] px-2.5 py-1.5">
                                  <Building2
                                    size={
                                      13
                                    }
                                    className="text-[#527A6B]"
                                  />

                                  <span className="font-semibold text-[#29483A]">
                                    {
                                      displayOutlet.code
                                    }
                                  </span>
                                </div>

                                <div className="mt-1 text-[11px] text-gray-400">
                                  {
                                    displayOutlet.name
                                  }
                                </div>
                              </>
                            ) : displayOutlet ? (
                              <>
                                <div className="inline-flex items-center gap-2 rounded-lg bg-sky-50 px-2.5 py-1.5">
                                  <Building2
                                    size={
                                      13
                                    }
                                    className="text-sky-600"
                                  />

                                  <span className="font-semibold text-sky-700">
                                    {
                                      displayOutlet.code
                                    }
                                  </span>
                                </div>

                                <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
                                  <Database
                                    size={
                                      10
                                    }
                                  />
                                  Belum ada
                                  mapping
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-600">
                                  <Database
                                    size={
                                      11
                                    }
                                  />
                                  Central
                                </span>

                                <div className="mt-1 text-[10px] text-gray-400">
                                  Belum ada
                                  mapping outlet
                                </div>
                              </>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF5F1] text-[#29483A]">
                                <Package
                                  size={
                                    17
                                  }
                                />
                              </div>

                              <div className="min-w-0">
                                <div className="font-bold text-[#263D33]">
                                  {
                                    item
                                      .barang
                                      .name
                                  }
                                </div>

                                <div className="mt-1 flex items-center gap-2">
                                  <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-600">
                                    {
                                      item
                                        .barang
                                        .code
                                    }
                                  </span>

                                  {item
                                    .barang
                                    .brand && (
                                    <span className="text-[11px] text-gray-400">
                                      {
                                        item
                                          .barang
                                          .brand
                                      }
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 font-mono text-xs text-gray-500">
                            {item
                              .barang
                              .barcode ||
                              "-"}
                          </td>

                          <td className="px-4 py-4">
                            {item
                              .barang
                              .category ? (
                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                                {
                                  item
                                    .barang
                                    .category
                                }
                              </span>
                            ) : (
                              <span className="text-gray-300">
                                —
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-semibold text-gray-700">
                              {item
                                .barang
                                .unit ||
                                "-"}
                            </div>

                            <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                              Purchase Unit
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-bold text-[#29483A]">
                              {item
                                .barang
                                .baseUnit ||
                                "-"}
                            </div>

                            <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                              Stock / Base Unit
                            </div>
                          </td>

                          <td className="px-4 py-4 text-center">
                            {item
                              .barang
                              .baseUnit ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="text-sm font-bold text-[#29483A]">
                                  {formatNumber(
                                    conversionRate
                                  )}
                                </span>

                                <span className="mt-1 whitespace-nowrap text-[10px] text-gray-400">
                                  1{" "}
                                  {
                                    item
                                      .barang
                                      .unit
                                  }{" "}
                                  ={" "}
                                  {formatNumber(
                                    conversionRate
                                  )}{" "}
                                  {
                                    item
                                      .barang
                                      .baseUnit
                                  }
                                </span>
                              </div>
                            ) : (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-600">
                                Belum
                                diset
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-4 text-right">
                            <div className="font-semibold text-gray-700">
                              {formatNumber(
                                item
                                  .barang
                                  .minimumStock
                              )}
                            </div>

                            <div className="mt-1 text-[10px] text-gray-400">
                              {item
                                .barang
                                .baseUnit ||
                                item
                                  .barang
                                  .unit}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-right">
                            <div
                              className={
                                hasLatestPrice
                                  ? "font-bold text-[#29483A]"
                                  : "font-semibold text-gray-600"
                              }
                            >
                              {formatCurrency(
                                displayPrice
                              )}
                            </div>

                            <div
                              className={`mt-1 text-[10px] font-medium ${
                                hasLatestPrice
                                  ? "text-[#527A6B]"
                                  : "text-gray-400"
                              }`}
                            >
                              {
                                priceSource
                              }
                            </div>

                            {hasLatestPrice &&
                              (tanggalHarga ||
                                item.hargaTerakhirPurchase) && (
                                <div className="mt-0.5 whitespace-nowrap text-[10px] text-gray-400">
                                  {
                                    tanggalHarga
                                  }

                                  {tanggalHarga &&
                                    item.hargaTerakhirPurchase &&
                                    " • "}

                                  {item.hargaTerakhirPurchase ||
                                    ""}
                                </div>
                              )}

                            {stock > 0 && (
                              <div className="mt-1 text-[10px] text-gray-400">
                                Stock:{" "}
                                {formatNumber(
                                  stock
                                )}{" "}
                                {
                                  item
                                    .barang
                                    .baseUnit
                                }
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-4 text-center">
                            <span
                              className={`
                                inline-flex items-center
                                gap-1.5 rounded-full
                                px-3 py-1.5 text-[11px]
                                font-bold
                                ${
                                  item.aktif
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-gray-100 text-gray-500"
                                }
                              `}
                            >
                              <span
                                className={`
                                  h-1.5 w-1.5 rounded-full
                                  ${
                                    item.aktif
                                      ? "bg-emerald-500"
                                      : "bg-gray-400"
                                  }
                                `}
                              />

                              {item.aktif
                                ? "Aktif"
                                : "Nonaktif"}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =====================================================
          ADD / CONNECT CENTRAL BARANG MODAL
      ===================================================== */}

      {showForm && (
        <div
          className="
            fixed inset-0 z-50
            flex items-center justify-center
            bg-[#102019]/55 p-4
            backdrop-blur-sm
          "
        >
          <div
            className="
              flex max-h-[92vh] w-full max-w-4xl
              flex-col overflow-hidden rounded-3xl
              border border-white/60 bg-white
              shadow-[0_30px_80px_rgba(25,55,43,0.22)]
            "
          >
            {/* MODAL HEADER */}

            <div className="relative overflow-hidden border-b border-gray-100 bg-gradient-to-br from-[#F4F8F5] via-white to-[#EDF5F1] px-6 py-5">
              <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#DCEBE3]/60 blur-2xl" />

              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#29483A] text-white shadow-sm">
                    <Link2 size={19} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-[#20372D]">
                        Hubungkan Master Barang
                      </h2>

                      <span className="rounded-full bg-[#E1F0E8] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#527A6B]">
                        Central
                      </span>
                    </div>

                    <p className="mt-1 max-w-xl text-xs leading-5 text-gray-500">
                      Pilih barang yang
                      sudah terdaftar di
                      Master Barang
                      Central. Data master
                      tidak dibuat ulang
                      dan tidak diduplikasi
                      untuk outlet.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowForm(false)
                  }
                  className="
                    rounded-xl p-2 text-gray-400
                    transition hover:bg-white
                    hover:text-gray-700
                  "
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            {/* MODAL BODY */}

            <form
              onSubmit={
                handleSubmit
              }
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                {/* OUTLET */}

                {user?.role !==
                  "OUTLET_ADMIN" && (
                  <div className="mb-5">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">
                      Outlet
                    </label>

                    <div className="relative">
                      <Building2
                        size={17}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#527A6B]"
                      />

                      <select
                        required
                        value={
                          form.outletId
                        }
                        onChange={async (
                          e
                        ) => {
                          const value =
                            e.target
                              .value;

                          setForm(
                            (
                              prev
                            ) => ({
                              ...prev,
                              outletId:
                                value,
                              barangId:
                                "",
                            })
                          );

                          await loadCentralBarang(
                            centralSearch,
                            value
                          );
                        }}
                        className="
                          w-full appearance-none
                          rounded-xl border
                          border-gray-300 bg-white
                          py-3 pl-11 pr-10
                          text-sm font-medium
                          outline-none transition
                          focus:border-[#527A6B]
                          focus:ring-4
                          focus:ring-[#527A6B]/10
                        "
                      >
                        <option value="">
                          Pilih outlet
                        </option>

                        {outlets.map(
                          (
                            outlet
                          ) => (
                            <option
                              key={
                                outlet.id
                              }
                              value={
                                outlet.id
                              }
                            >
                              {
                                outlet.code
                              }{" "}
                              -{" "}
                              {
                                outlet.name
                              }
                            </option>
                          )
                        )}
                      </select>

                      <ChevronDown
                        size={16}
                        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                    </div>
                  </div>
                )}

                {/* SELECT CENTRAL BARANG */}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wide text-gray-500">
                      Master Barang Central
                    </label>

                    <span className="text-[10px] font-medium text-[#527A6B]">
                      Wajib pilih dari Central
                    </span>
                  </div>

                  <div className="rounded-2xl border border-[#D7E4DE] bg-[#FAFCFB] p-3">
                    <div className="relative">
                      <Search
                        size={17}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        value={
                          centralSearch
                        }
                        onChange={(
                          e
                        ) => {
                          const value =
                            e.target
                              .value;

                          setCentralSearch(
                            value
                          );

                          if (
                            value.length >=
                            2
                          ) {
                            void loadCentralBarang(
                              value
                            );
                          }
                        }}
                        placeholder="Cari kode, barcode, nama atau kategori..."
                        className="
                          w-full rounded-xl border
                          border-gray-200 bg-white
                          py-3 pl-10 pr-4
                          text-sm outline-none
                          transition
                          focus:border-[#527A6B]
                          focus:ring-4 focus:ring-[#527A6B]/10
                        "
                      />
                    </div>

                    <div className="mt-3 max-h-64 overflow-y-auto">
                      {loadingCentral ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <RefreshCw
                            size={21}
                            className="mb-2 animate-spin text-[#527A6B]"
                          />

                          <p className="text-xs font-semibold text-gray-500">
                            Memuat Master
                            Barang Central...
                          </p>
                        </div>
                      ) : filteredCentralBarang.length ===
                        0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center">
                          <Package
                            size={25}
                            className="mx-auto mb-2 text-gray-300"
                          />

                          <p className="text-xs font-semibold text-gray-500">
                            Master Barang
                            tidak
                            ditemukan
                          </p>

                          <p className="mt-1 text-[11px] text-gray-400">
                            Pastikan barang
                            sudah dibuat di
                            Master Barang
                            Central.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredCentralBarang.map(
                            (
                              item
                            ) => {
                              const selected =
                                String(
                                  item.id
                                ) ===
                                String(
                                  form.barangId
                                );

                              const rate =
                                Number(
                                  item.conversionRate
                                ) > 0
                                  ? Number(
                                      item.conversionRate
                                    )
                                  : 1;

                              return (
                                <button
                                  key={
                                    item.id
                                  }
                                  type="button"
                                  onClick={() =>
                                    setForm(
                                      (
                                        prev
                                      ) => ({
                                        ...prev,
                                        barangId:
                                          String(
                                            item.id
                                          ),
                                      })
                                    )
                                  }
                                  className={`
                                    w-full rounded-xl
                                    border p-3 text-left
                                    transition
                                    ${
                                      selected
                                        ? "border-[#527A6B] bg-[#EEF6F1] ring-2 ring-[#527A6B]/10"
                                        : "border-gray-200 bg-white hover:border-[#BFD4C9] hover:bg-[#F8FBF9]"
                                    }
                                  `}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`
                                        flex h-10 w-10
                                        shrink-0 items-center
                                        justify-center rounded-xl
                                        ${
                                          selected
                                            ? "bg-[#29483A] text-white"
                                            : "bg-[#F0F5F2] text-[#527A6B]"
                                        }
                                      `}
                                    >
                                      {selected ? (
                                        <Check
                                          size={
                                            18
                                          }
                                        />
                                      ) : (
                                        <Package
                                          size={
                                            17
                                          }
                                        />
                                      )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-[#29483A]">
                                          {
                                            item.name
                                          }
                                        </span>

                                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-600">
                                          {
                                            item.code
                                          }
                                        </span>
                                      </div>

                                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                                        {item.category && (
                                          <span>
                                            {
                                              item.category
                                            }
                                          </span>
                                        )}

                                        {item.category && (
                                          <span>
                                            •
                                          </span>
                                        )}

                                        <span>
                                          Purchase:{" "}
                                          <b className="text-gray-500">
                                            {
                                              item.unit
                                            }
                                          </b>
                                        </span>

                                        <span>
                                          •
                                        </span>

                                        <span>
                                          Base:{" "}
                                          <b className="text-[#527A6B]">
                                            {item.baseUnit ||
                                              "-"}
                                          </b>
                                        </span>

                                        {item.baseUnit && (
                                          <>
                                            <span>
                                              •
                                            </span>

                                            <span>
                                              1{" "}
                                              {
                                                item.unit
                                              }{" "}
                                              ={" "}
                                              {formatNumber(
                                                rate
                                              )}{" "}
                                              {
                                                item.baseUnit
                                              }
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    <ChevronDown
                                      size={
                                        17
                                      }
                                      className={`shrink-0 -rotate-90 ${
                                        selected
                                          ? "text-[#29483A]"
                                          : "text-gray-300"
                                      }`}
                                    />
                                  </div>
                                </button>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* SELECTED PREVIEW */}

                {selectedCentralBarang && (
                  <div className="mt-5 overflow-hidden rounded-2xl border border-[#CFE0D7] bg-gradient-to-br from-[#F4F8F5] to-white">
                    <div className="border-b border-[#DDEAE3] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Check
                          size={15}
                          className="text-[#527A6B]"
                        />

                        <span className="text-xs font-bold text-[#29483A]">
                          Barang Central
                          terpilih
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                      <InfoMini
                        label="Kode"
                        value={
                          selectedCentralBarang.code
                        }
                      />

                      <InfoMini
                        label="Nama"
                        value={
                          selectedCentralBarang.name
                        }
                      />

                      <InfoMini
                        label="Purchase Unit"
                        value={
                          selectedCentralBarang.unit
                        }
                      />

                      <InfoMini
                        label="Base Unit"
                        value={
                          selectedCentralBarang.baseUnit ||
                          "-"
                        }
                      />

                      <InfoMini
                        label="Konversi"
                        value={
                          selectedCentralBarang.baseUnit
                            ? `1 ${selectedCentralBarang.unit} = ${formatNumber(
                                selectedCentralBarang.conversionRate
                              )} ${selectedCentralBarang.baseUnit}`
                            : "Belum diset"
                        }
                      />

                      <InfoMini
                        label="Minimum Stock"
                        value={`${formatNumber(
                          selectedCentralBarang.minimumStock
                        )} ${
                          selectedCentralBarang.baseUnit ||
                          selectedCentralBarang.unit
                        }`}
                      />

                      <InfoMini
                        label="Purchase Price Central"
                        value={formatCurrency(
                          selectedCentralBarang.purchasePrice
                        )}
                      />

                      <InfoMini
                        label="Source"
                        value="CENTRAL"
                        accent
                      />
                    </div>
                  </div>
                )}

                {/* HARGA OUTLET */}

                <div className="mt-5">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">
                    Harga Master Outlet
                  </label>

                  <div className="relative">
                    <CircleDollarSign
                      size={17}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#527A6B]"
                    />

                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={
                        form.harga
                      }
                      onChange={(
                        e
                      ) =>
                        setForm(
                          (
                            prev
                          ) => ({
                            ...prev,
                            harga:
                              e.target
                                .value,
                          })
                        )
                      }
                      className="
                        w-full rounded-xl border
                        border-gray-300 bg-white
                        py-3 pl-10 pr-4
                        text-sm font-semibold
                        outline-none transition
                        focus:border-[#527A6B]
                        focus:ring-4
                        focus:ring-[#527A6B]/10
                      "
                      placeholder="0"
                    />
                  </div>

                  <p className="mt-2 text-[11px] leading-5 text-gray-400">
                    Harga ini hanya
                    menjadi fallback.
                    Harga terakhir
                    pembelian outlet
                    tetap dapat menjadi
                    harga transaksi
                    Purchase Outlet.
                  </p>
                </div>

                {/* SAFETY INFO */}

                <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle
                      size={17}
                      className="mt-0.5 shrink-0 text-amber-600"
                    />

                    <div>
                      <p className="text-xs font-bold text-amber-800">
                        Data master tetap
                        terpusat
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-amber-700">
                        Proses ini tidak
                        membuat Barang
                        baru, tidak
                        menggandakan kode,
                        dan tidak mengubah
                        satuan atau konversi
                        Master Barang
                        Central.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* MODAL FOOTER */}

              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 bg-[#FBFCFB] px-6 py-4">
                <div className="hidden items-center gap-2 text-[10px] text-gray-400 sm:flex">
                  <Database
                    size={13}
                  />

                  Master data berasal
                  dari Central
                </div>

                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setShowForm(
                        false
                      )
                    }
                    className="
                      rounded-xl border
                      border-gray-300 bg-white
                      px-5 py-2.5 text-sm
                      font-semibold text-gray-700
                      transition hover:bg-gray-50
                    "
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    disabled={
                      saving ||
                      !form.barangId ||
                      !form.outletId
                    }
                    className="
                      flex items-center gap-2
                      rounded-xl bg-[#29483A]
                      px-5 py-2.5 text-sm
                      font-semibold text-white
                      shadow-sm transition
                      hover:bg-[#1F382D]
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                  >
                    {saving ? (
                      <>
                        <RefreshCw
                          size={16}
                          className="animate-spin"
                        />

                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Link2
                          size={16}
                        />

                        Hubungkan Barang
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  icon,
  label,
  value,
  description,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: number;
  description: string;
  tone?:
    | "default"
    | "green"
    | "orange"
    | "blue";
}) {
  const toneClass = {
    default: {
      icon: "bg-[#EEF5F1] text-[#29483A]",
      value: "text-[#29483A]",
    },
    green: {
      icon: "bg-emerald-50 text-emerald-600",
      value: "text-emerald-700",
    },
    orange: {
      icon: "bg-amber-50 text-amber-600",
      value: "text-amber-700",
    },
    blue: {
      icon: "bg-sky-50 text-sky-600",
      value: "text-sky-700",
    },
  }[tone];

  return (
    <div className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
            {label}
          </p>

          <p
            className={`mt-2 text-2xl font-bold tracking-tight ${toneClass.value}`}
          >
            {value.toLocaleString(
              "id-ID"
            )}
          </p>

          <p className="mt-1 text-[11px] text-gray-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClass.icon}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MINI INFO
========================================================= */

function InfoMini({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">
        {label}
      </div>

      <div
        className={`mt-1.5 truncate text-xs font-bold ${
          accent
            ? "text-[#527A6B]"
            : "text-[#29483A]"
        }`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}