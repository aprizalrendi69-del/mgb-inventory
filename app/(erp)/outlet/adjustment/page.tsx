"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileCheck2,
  History,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  X,
  XCircle,
} from "lucide-react";

type Outlet = {
  id: number;
  code: string;
  name: string;
  active?: boolean;
};

type Barang = {
  id: number;
  code: string;
  barcode?: string | null;
  name: string;
  unit: string;
  baseUnit?: string | null;
  conversionRate?: number | null;
  purchasePrice?: number | null;
  outletStock?: number;
};

type AdjustmentItem = {
  barangId: number;
  qty: number;
  price: number;
  type: "IN" | "OUT";
  barang: Barang;
};

type Adjustment = {
  id: number;
  number: string;
  outletId: number;
  adjustmentDate: string;
  type: string;
  reason?: string | null;
  remarks?: string | null;
  status: string;
  outlet?: Outlet | null;
  items: AdjustmentItem[];
};

type User = {
  id: number;
  fullname: string;
  role: string;
  outletId?: number | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
  }).format(Number(value || 0));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value: string) {
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function roleLabel(role: string) {
  const value = String(role || "").toUpperCase();

  if (value === "ADMIN") {
    return "ADMIN PUSAT";
  }

  if (value === "MANAGER") {
    return "MANAGER";
  }

  if (value === "OUTLET_ADMIN") {
    return "OUTLET ADMIN";
  }

  return value || "-";
}

function statusLabel(status: string) {
  const value = String(status || "").toUpperCase();

  if (value === "APPROVED") {
    return "APPROVED";
  }

  if (value === "REJECTED") {
    return "REJECTED";
  }

  return "DRAFT";
}

export default function OutletAdjustmentPage() {
  const [user, setUser] =
    useState<User | null>(null);

  const [outlets, setOutlets] =
    useState<Outlet[]>([]);

  const [selectedOutletId, setSelectedOutletId] =
    useState("");

  const [data, setData] =
    useState<Adjustment[]>([]);

  const [barangList, setBarangList] =
    useState<Barang[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [processingId, setProcessingId] =
    useState<number | null>(null);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [openForm, setOpenForm] =
    useState(false);

  const [barangSearch, setBarangSearch] =
    useState("");

  const [form, setForm] =
    useState({
      date: today(),
      type: "IN" as "IN" | "OUT",
      reason: "",
      remarks: "",
    });

  const [items, setItems] =
    useState<AdjustmentItem[]>([]);

  const role =
    String(user?.role ?? "").toUpperCase();

  const isAdmin =
    role === "ADMIN";

  const isOutletAdmin =
    role === "OUTLET_ADMIN";

  const canApprove =
    isAdmin;

  const canReject =
    role === "ADMIN" ||
    role === "MANAGER" ||
    role === "OUTLET_ADMIN";

  const selectedOutlet = useMemo(
    () =>
      outlets.find(
        (outlet) =>
          outlet.id ===
          Number(selectedOutletId)
      ) ?? null,
    [outlets, selectedOutletId]
  );

  const selectedOutletName =
    selectedOutlet
      ? `${selectedOutlet.code} — ${selectedOutlet.name}`
      : "Pilih outlet";

  async function loadUser() {
    const response =
      await fetch("/api/me", {
        cache: "no-store",
      });

    const json =
      await response.json();

    if (
      !response.ok ||
      !json?.user
    ) {
      throw new Error(
        json?.message ||
          "Gagal mengambil user"
      );
    }

    const currentUser =
      json.user as User;

    setUser(currentUser);

    if (
      String(
        currentUser.role
      ).toUpperCase() ===
        "OUTLET_ADMIN" &&
      currentUser.outletId
    ) {
      setSelectedOutletId(
        String(
          currentUser.outletId
        )
      );
    }
  }

  async function loadOutlets() {
    const response =
      await fetch(
        "/api/outlet",
        {
          cache: "no-store",
        }
      );

    const json =
      await response.json();

    if (
      !response.ok ||
      !json.success
    ) {
      throw new Error(
        json.message ||
          "Gagal mengambil outlet"
      );
    }

    const rows =
      (
        json.data ??
        json.outlets ??
        []
      ).filter(
        (outlet: Outlet) =>
          outlet.active !== false
      );

    setOutlets(rows);
  }

  async function loadData(
    outletId = selectedOutletId
  ) {
    if (!outletId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          `/api/outlet/adjustment?outletId=${encodeURIComponent(
            outletId
          )}`,
          {
            cache: "no-store",
          }
        );

      const json =
        await response.json();

      if (
        !response.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Gagal mengambil adjustment"
        );
      }

      setData(
        json.data ?? []
      );
    } catch (error: any) {
      console.error(error);

      alert(
        error?.message ||
          "Gagal mengambil adjustment"
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await loadUser();
        await loadOutlets();
      } catch (error: any) {
        console.error(error);

        alert(
          error?.message ||
            "Gagal memuat halaman"
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedOutletId) {
      loadData(
        selectedOutletId
      );
    }
  }, [selectedOutletId]);

  async function searchBarang(
    value: string
  ) {
    setBarangSearch(value);

    if (
      value.trim().length < 2 ||
      !selectedOutletId
    ) {
      setBarangList([]);
      return;
    }

    try {
      const response =
        await fetch(
          `/api/master/barang?search=${encodeURIComponent(
            value.trim()
          )}`,
          {
            cache: "no-store",
          }
        );

      const json =
        await response.json();

      if (
        !response.ok ||
        !json.success
      ) {
        setBarangList([]);
        return;
      }

      const master =
        (json.data ?? []) as Barang[];

      const stockResponse =
        await fetch(
          `/api/outlet/stock?outletId=${encodeURIComponent(
            selectedOutletId
          )}`,
          {
            cache: "no-store",
          }
        );

      const stockJson =
        await stockResponse.json();

      const stockRows =
        stockJson?.success
          ? stockJson.data ?? []
          : [];

      const stockMap =
        new Map<number, number>();

      for (const row of stockRows) {
        stockMap.set(
          Number(row.barangId),
          Number(row.stock ?? 0)
        );
      }

      const result =
        master.map(
          (barang) => ({
            ...barang,

            outletStock:
              stockMap.get(
                Number(barang.id)
              ) ?? 0,
          })
        );

      setBarangList(result);
    } catch (error) {
      console.error(error);
      setBarangList([]);
    }
  }

  function stockOf(
    barang: Barang
  ) {
    return Number(
      barang.outletStock ?? 0
    );
  }

  function addItem(
    barang: Barang
  ) {
    const exists =
      items.some(
        (item) =>
          item.barangId ===
          barang.id
      );

    if (exists) {
      setBarangSearch("");
      setBarangList([]);
      return;
    }

    setItems((current) => [
      ...current,

      {
        barangId:
          barang.id,

        qty: 1,

        price:
          Number(
            barang.purchasePrice ??
              0
          ),

        type:
          form.type,

        barang,
      },
    ]);

    setBarangSearch("");
    setBarangList([]);
  }

  function updateQty(
    barangId: number,
    value: string
  ) {
    const qty =
      Number(value);

    setItems((current) =>
      current.map(
        (item) =>
          item.barangId ===
          barangId
            ? {
                ...item,
                qty:
                  Number.isFinite(
                    qty
                  )
                    ? qty
                    : 0,
              }
            : item
      )
    );
  }

  function removeItem(
    barangId: number
  ) {
    setItems((current) =>
      current.filter(
        (item) =>
          item.barangId !==
          barangId
      )
    );
  }

  function resetForm() {
    setItems([]);
    setBarangSearch("");

    setForm({
      date: today(),
      type: "IN",
      reason: "",
      remarks: "",
    });
  }

  async function saveDraft() {
    if (!selectedOutletId) {
      alert(
        "Pilih outlet terlebih dahulu"
      );
      return;
    }

    if (items.length === 0) {
      alert(
        "Tambahkan minimal 1 barang"
      );
      return;
    }

    if (!form.reason.trim()) {
      alert(
        "Reason wajib diisi"
      );
      return;
    }

    for (const item of items) {
      const qty =
        Number(item.qty);

      if (
        !Number.isFinite(qty) ||
        qty <= 0
      ) {
        alert(
          `Qty ${item.barang.name} harus lebih besar dari 0`
        );
        return;
      }

      if (
        item.type === "OUT" &&
        qty >
          stockOf(item.barang) +
            0.000001
      ) {
        alert(
          `Stock ${item.barang.name} tidak mencukupi. ` +
            `Tersedia ${formatNumber(
              stockOf(
                item.barang
              )
            )}`
        );
        return;
      }
    }

    setSaving(true);

    try {
      const response =
        await fetch(
          "/api/outlet/adjustment",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              outletId:
                Number(
                  selectedOutletId
                ),

              adjustmentDate:
                form.date,

              type:
                form.type,

              reason:
                form.reason.trim(),

              remarks:
                form.remarks.trim() ||
                null,

              status:
                "DRAFT",

              items:
                items.map(
                  (item) => ({
                    barangId:
                      item.barangId,

                    qty:
                      item.qty,

                    price:
                      item.price,

                    type:
                      item.type,
                  })
                ),
            }),
          }
        );

      const json =
        await response.json();

      if (
        !response.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Gagal menyimpan adjustment"
        );
      }

      setOpenForm(false);

      resetForm();

      await loadData(
        selectedOutletId
      );
    } catch (error: any) {
      console.error(error);

      alert(
        error?.message ||
          "Gagal menyimpan adjustment"
      );
    } finally {
      setSaving(false);
    }
  }

  async function processAdjustment(
    id: number,
    action:
      | "APPROVE"
      | "REJECT"
  ) {
    /*
     * SECURITY:
     * APPROVE hanya boleh dilakukan ADMIN pusat.
     *
     * Ini juga harus divalidasi di API.
     */
    if (
      action === "APPROVE" &&
      !isAdmin
    ) {
      alert(
        "Approve Adjustment Outlet hanya dapat dilakukan oleh Admin Pusat."
      );
      return;
    }

    const message =
      action === "APPROVE"
        ? "Approve adjustment ini?\n\nStock outlet akan berubah dan transaksi tidak dapat di-approve ulang."
        : "Tolak adjustment ini?";

    if (
      !window.confirm(
        message
      )
    ) {
      return;
    }

    setProcessingId(id);

    try {
      const response =
        await fetch(
          "/api/outlet/adjustment",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              id,
              action,
            }),
          }
        );

      const json =
        await response.json();

      if (
        !response.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Gagal memproses adjustment"
        );
      }

      await loadData(
        selectedOutletId
      );
    } catch (error: any) {
      console.error(error);

      alert(
        error?.message ||
          "Gagal memproses adjustment"
      );
    } finally {
      setProcessingId(null);
    }
  }

  const filteredData =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return data.filter(
        (row) => {
          const matchesSearch =
            !keyword ||
            row.number
              .toLowerCase()
              .includes(
                keyword
              ) ||
            row.reason
              ?.toLowerCase()
              .includes(
                keyword
              ) ||
            row.items.some(
              (item) =>
                item.barang.name
                  .toLowerCase()
                  .includes(
                    keyword
                  ) ||
                item.barang.code
                  .toLowerCase()
                  .includes(
                    keyword
                  )
            );

          const matchesStatus =
            statusFilter ===
              "ALL" ||
            row.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      data,
      search,
      statusFilter,
    ]);

  const draftCount =
    data.filter(
      (row) =>
        row.status ===
        "DRAFT"
    ).length;

  const approvedCount =
    data.filter(
      (row) =>
        row.status ===
        "APPROVED"
    ).length;

  const rejectedCount =
    data.filter(
      (row) =>
        row.status ===
        "REJECTED"
    ).length;

  const totalItems =
    data.reduce(
      (total, row) =>
        total +
        row.items.length,
      0
    );

  const pendingApprovalCount =
    data.filter(
      (row) =>
        row.status ===
        "DRAFT"
    ).length;

  return (
    <div className="min-h-screen bg-[#f6f8fb]">

      {/* TOP ACCENT */}
      <div className="h-1 bg-slate-900" />

      <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6 lg:p-8">

        {/* ===================================================== */}
        {/* HEADER */}
        {/* ===================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <div className="relative px-5 py-6 md:px-7">

            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-slate-100 blur-3xl" />

            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

              <div className="flex items-start gap-4">

                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
                  <History size={25} />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">

                    <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                      Adjustment Outlet
                    </h1>

                    {user && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                        <ShieldCheck
                          size={13}
                        />
                        {roleLabel(
                          user.role
                        )}
                      </span>
                    )}

                  </div>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    Koreksi stock outlet secara terkontrol.
                    Perubahan stock hanya terjadi setelah
                    adjustment disetujui.
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">

                    <span className="inline-flex items-center gap-1.5">
                      <Store size={13} />
                      {selectedOutletName}
                    </span>

                    <span className="text-slate-300">
                      •
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                      <Package size={13} />
                      Stock Outlet
                    </span>

                    <span className="text-slate-300">
                      •
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck size={13} />
                      Approval Admin Pusat
                    </span>

                  </div>
                </div>

              </div>

              <div className="flex flex-col gap-2 sm:flex-row">

                <div className="relative">

                  <Store
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <select
                    value={
                      selectedOutletId
                    }
                    disabled={
                      isOutletAdmin
                    }
                    onChange={(
                      event
                    ) =>
                      setSelectedOutletId(
                        event.target.value
                      )
                    }
                    className="h-11 min-w-[250px] appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <option value="">
                      Pilih Outlet
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
                          {outlet.code} —{" "}
                          {outlet.name}
                        </option>
                      )
                    )}
                  </select>

                  <ChevronDown
                    size={15}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                </div>

                <button
                  onClick={() =>
                    loadData(
                      selectedOutletId
                    )
                  }
                  disabled={
                    loading ||
                    !selectedOutletId
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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

                <button
                  disabled={
                    !selectedOutletId
                  }
                  onClick={() => {
                    resetForm();
                    setOpenForm(true);
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus size={17} />
                  Adjustment Baru
                </button>

              </div>

            </div>

          </div>

        </section>

        {/* ===================================================== */}
        {/* KPI */}
        {/* ===================================================== */}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total
              </span>

              <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                <FileCheck2 size={16} />
              </div>
            </div>

            <div className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
              {data.length}
            </div>

            <div className="mt-1 text-xs text-slate-400">
              Adjustment
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                Draft
              </span>

              <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                <Clock3 size={16} />
              </div>
            </div>

            <div className="mt-3 text-3xl font-bold tracking-tight text-amber-950">
              {draftCount}
            </div>

            <div className="mt-1 text-xs text-amber-700/60">
              Menunggu proses
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Approved
              </span>

              <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <CheckCircle2 size={16} />
              </div>
            </div>

            <div className="mt-3 text-3xl font-bold tracking-tight text-emerald-950">
              {approvedCount}
            </div>

            <div className="mt-1 text-xs text-emerald-700/60">
              Stock sudah diperbarui
            </div>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                Rejected
              </span>

              <div className="rounded-lg bg-rose-100 p-2 text-rose-700">
                <XCircle size={16} />
              </div>
            </div>

            <div className="mt-3 text-3xl font-bold tracking-tight text-rose-950">
              {rejectedCount}
            </div>

            <div className="mt-1 text-xs text-rose-700/60">
              Tidak diproses
            </div>
          </div>

          <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-900 p-5 shadow-sm lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Pending Approval
              </span>

              <div className="rounded-lg bg-white/10 p-2 text-white">
                <ShieldCheck size={16} />
              </div>
            </div>

            <div className="mt-3 text-3xl font-bold tracking-tight text-white">
              {pendingApprovalCount}
            </div>

            <div className="mt-1 text-xs text-slate-400">
              {isAdmin
                ? "Siap diproses Admin Pusat"
                : "Approval oleh Admin Pusat"}
            </div>
          </div>

        </section>

        {/* ===================================================== */}
        {/* MAIN TABLE */}
        {/* ===================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          {/* TABLE TOOLBAR */}

          <div className="border-b border-slate-200 p-4 md:p-5">

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">

              <div>
                <h2 className="text-base font-bold text-slate-950">
                  Riwayat Adjustment
                </h2>

                <p className="mt-0.5 text-xs text-slate-400">
                  {filteredData.length} transaksi ditampilkan
                  {totalItems > 0 &&
                    ` • ${totalItems} detail barang`}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">

                <div className="relative min-w-[280px]">

                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={search}
                    onChange={(
                      event
                    ) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Cari nomor, barang, atau reason..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                  />

                </div>

                <select
                  value={
                    statusFilter
                  }
                  onChange={(
                    event
                  ) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-slate-400"
                >
                  <option value="ALL">
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

            </div>

          </div>

          {/* ADMIN NOTICE */}

          {data.some(
            (row) =>
              row.status ===
              "DRAFT"
          ) && (
            <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 md:mx-5">

              <ShieldCheck
                size={18}
                className="mt-0.5 shrink-0 text-blue-600"
              />

              <div className="text-xs leading-5 text-blue-800">
                <span className="font-bold">
                  Kontrol Approval:
                </span>{" "}
                Adjustment hanya mengubah stock outlet
                setelah di-approve oleh{" "}
                <span className="font-bold">
                  Admin Pusat
                </span>.
              </div>

            </div>
          )}

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1180px] text-sm">

              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] uppercase tracking-wider text-slate-400">

                  <th className="px-5 py-4 font-bold">
                    Tanggal
                  </th>

                  <th className="px-5 py-4 font-bold">
                    Nomor Adjustment
                  </th>

                  <th className="px-5 py-4 font-bold">
                    Outlet
                  </th>

                  <th className="px-5 py-4 font-bold">
                    Jenis
                  </th>

                  <th className="px-5 py-4 font-bold">
                    Barang
                  </th>

                  <th className="px-5 py-4 font-bold">
                    Qty
                  </th>

                  <th className="px-5 py-4 font-bold">
                    Reason
                  </th>

                  <th className="px-5 py-4 font-bold">
                    Status
                  </th>

                  <th className="px-5 py-4 text-right font-bold">
                    Aksi
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {loading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-20"
                    >
                      <div className="flex flex-col items-center justify-center">

                        <Loader2
                          size={25}
                          className="animate-spin text-slate-400"
                        />

                        <div className="mt-3 text-sm font-semibold text-slate-600">
                          Memuat adjustment...
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          Mengambil data stock outlet
                        </div>

                      </div>
                    </td>
                  </tr>
                ) : filteredData.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-20"
                    >
                      <div className="flex flex-col items-center justify-center">

                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                          <Package size={25} />
                        </div>

                        <div className="mt-4 text-sm font-bold text-slate-700">
                          Belum ada adjustment
                        </div>

                        <div className="mt-1 max-w-sm text-center text-xs leading-5 text-slate-400">
                          Belum ditemukan transaksi
                          adjustment untuk outlet dan filter
                          yang dipilih.
                        </div>

                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map(
                    (row) => {
                      const rowType =
                        String(
                          row.type
                        ).toUpperCase();

                      const isIn =
                        rowType ===
                        "IN";

                      const rowQty =
                        row.items.reduce(
                          (
                            total,
                            item
                          ) =>
                            total +
                            Number(
                              item.qty ||
                                0
                            ),
                          0
                        );

                      const isProcessing =
                        processingId ===
                        row.id;

                      return (
                        <tr
                          key={
                            row.id
                          }
                          className="group transition hover:bg-slate-50/70"
                        >

                          {/* DATE */}

                          <td className="whitespace-nowrap px-5 py-4">

                            <div className="flex items-center gap-2">

                              <CalendarDays
                                size={15}
                                className="text-slate-400"
                              />

                              <span className="font-semibold text-slate-700">
                                {formatDate(
                                  row.adjustmentDate
                                )}
                              </span>

                            </div>

                          </td>

                          {/* NUMBER */}

                          <td className="px-5 py-4">

                            <div className="font-mono text-xs font-bold text-slate-900">
                              {row.number}
                            </div>

                            <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                              ID #{row.id}
                            </div>

                          </td>

                          {/* OUTLET */}

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-2.5">

                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                <Store size={15} />
                              </div>

                              <div>
                                <div className="font-bold text-slate-800">
                                  {row.outlet
                                    ?.name ||
                                    "-"}
                                </div>

                                <div className="text-[11px] text-slate-400">
                                  {row.outlet
                                    ?.code ||
                                    "-"}
                                </div>
                              </div>

                            </div>

                          </td>

                          {/* TYPE */}

                          <td className="px-5 py-4">

                            <span
                              className={
                                isIn
                                  ? "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700"
                                  : "inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700"
                              }
                            >
                              {isIn
                                ? "PLUS / IN"
                                : "MINUS / OUT"}
                            </span>

                          </td>

                          {/* ITEMS */}

                          <td className="px-5 py-4">

                            <div className="font-bold text-slate-800">
                              {row.items.length}{" "}
                              item
                            </div>

                            <div className="mt-1 max-w-[250px] truncate text-xs text-slate-400">
                              {row.items
                                .map(
                                  (
                                    item
                                  ) =>
                                    item
                                      .barang
                                      .name
                                )
                                .join(
                                  ", "
                                )}
                            </div>

                          </td>

                          {/* QTY */}

                          <td className="px-5 py-4">

                            <div
                              className={
                                isIn
                                  ? "font-bold text-emerald-700"
                                  : "font-bold text-rose-700"
                              }
                            >
                              {isIn
                                ? "+"
                                : "-"}
                              {formatNumber(
                                rowQty
                              )}
                            </div>

                            <div className="text-[10px] text-slate-400">
                              Base Unit
                            </div>

                          </td>

                          {/* REASON */}

                          <td className="max-w-[220px] px-5 py-4">

                            <div className="truncate font-semibold text-slate-700">
                              {row.reason ||
                                "-"}
                            </div>

                            {row.remarks && (
                              <div className="mt-1 truncate text-xs text-slate-400">
                                {row.remarks}
                              </div>
                            )}

                          </td>

                          {/* STATUS */}

                          <td className="px-5 py-4">

                            {row.status ===
                            "APPROVED" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold tracking-wide text-emerald-700">

                                <CheckCircle2
                                  size={13}
                                />

                                {statusLabel(
                                  row.status
                                )}

                              </span>
                            ) : row.status ===
                              "REJECTED" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[10px] font-bold tracking-wide text-rose-700">

                                <XCircle
                                  size={13}
                                />

                                {statusLabel(
                                  row.status
                                )}

                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold tracking-wide text-amber-700">

                                <Clock3
                                  size={13}
                                />

                                DRAFT

                              </span>
                            )}

                          </td>

                          {/* ACTION */}

                          <td className="px-5 py-4">

                            {row.status ===
                              "DRAFT" && (
                              <div className="flex justify-end gap-2">

                                {/* APPROVE - ADMIN ONLY */}

                                {canApprove && (
                                  <button
                                    disabled={
                                      isProcessing
                                    }
                                    onClick={() =>
                                      processAdjustment(
                                        row.id,
                                        "APPROVE"
                                      )
                                    }
                                    title="Approve hanya untuk Admin Pusat"
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isProcessing ? (
                                      <Loader2
                                        size={14}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <CheckCircle2
                                        size={14}
                                      />
                                    )}

                                    Approve
                                  </button>
                                )}

                                {/* REJECT */}

                                {canReject && (
                                  <button
                                    disabled={
                                      isProcessing
                                    }
                                    onClick={() =>
                                      processAdjustment(
                                        row.id,
                                        "REJECT"
                                      )
                                    }
                                    title="Tolak adjustment"
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isProcessing ? (
                                      <Loader2
                                        size={14}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <XCircle
                                        size={14}
                                      />
                                    )}

                                    Reject
                                  </button>
                                )}

                                {/* NON ADMIN */}

                                {!canApprove &&
                                  !canReject && (
                                    <span className="text-xs text-slate-400">
                                      Menunggu Admin
                                    </span>
                                  )}

                              </div>
                            )}

                            {row.status ===
                              "APPROVED" && (
                              <div className="flex justify-end">
                                <span className="text-[11px] font-semibold text-slate-400">
                                  Stock telah diperbarui
                                </span>
                              </div>
                            )}

                            {row.status ===
                              "REJECTED" && (
                              <div className="flex justify-end">
                                <span className="text-[11px] font-semibold text-slate-400">
                                  Tidak diproses
                                </span>
                              </div>
                            )}

                          </td>

                        </tr>
                      );
                    }
                  )
                )}

              </tbody>

            </table>

          </div>

        </section>

      </div>

      {/* ======================================================= */}
      {/* FORM MODAL */}
      {/* ======================================================= */}

      {openForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm md:p-6">

          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">

            {/* MODAL HEADER */}

            <div className="relative overflow-hidden border-b border-slate-200 bg-slate-950 px-5 py-5 text-white md:px-7">

              <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

              <div className="relative flex items-center justify-between">

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                    <History size={21} />
                  </div>

                  <div>
                    <h2 className="text-lg font-bold">
                      Adjustment Outlet Baru
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-400">
                      {selectedOutletName}
                    </p>
                  </div>

                </div>

                <button
                  onClick={() =>
                    setOpenForm(false)
                  }
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={20} />
                </button>

              </div>

            </div>

            {/* MODAL BODY */}

            <div className="overflow-y-auto bg-[#fafbfc] p-4 md:p-6">

              <div className="space-y-5">

                {/* BASIC INFORMATION */}

                <div className="rounded-2xl border border-slate-200 bg-white p-5">

                  <div className="mb-5 flex items-center gap-2">

                    <div className="h-1.5 w-1.5 rounded-full bg-slate-900" />

                    <h3 className="text-sm font-bold text-slate-900">
                      Informasi Adjustment
                    </h3>

                  </div>

                  <div className="grid gap-4 md:grid-cols-3">

                    {/* DATE */}

                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Tanggal
                      </label>

                      <div className="relative">

                        <CalendarDays
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />

                        <input
                          type="date"
                          value={
                            form.date
                          }
                          onChange={(
                            event
                          ) =>
                            setForm(
                              (
                                current
                              ) => ({
                                ...current,
                                date:
                                  event
                                    .target
                                    .value,
                              })
                            )
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                        />

                      </div>
                    </div>

                    {/* OUTLET */}

                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Outlet
                      </label>

                      <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-bold text-slate-700">

                        <Store
                          size={16}
                          className="mr-2 text-slate-500"
                        />

                        {selectedOutletName}

                      </div>
                    </div>

                    {/* TYPE */}

                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Jenis Adjustment
                      </label>

                      <div className="grid grid-cols-2 gap-2">

                        <button
                          type="button"
                          onClick={() => {
                            setForm(
                              (
                                current
                              ) => ({
                                ...current,
                                type:
                                  "IN",
                              })
                            );

                            setItems(
                              []
                            );
                          }}
                          className={
                            form.type ===
                            "IN"
                              ? "h-11 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-sm"
                              : "h-11 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50"
                          }
                        >
                          PLUS / IN
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setForm(
                              (
                                current
                              ) => ({
                                ...current,
                                type:
                                  "OUT",
                              })
                            );

                            setItems(
                              []
                            );
                          }}
                          className={
                            form.type ===
                            "OUT"
                              ? "h-11 rounded-xl bg-rose-600 text-xs font-bold text-white shadow-sm"
                              : "h-11 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50"
                          }
                        >
                          MINUS / OUT
                        </button>

                      </div>
                    </div>

                  </div>

                </div>

                {/* SEARCH BARANG */}

                <div className="rounded-2xl border border-slate-200 bg-white p-5">

                  <div className="mb-4">

                    <div className="flex items-center justify-between">

                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Pilih Barang
                        </h3>

                        <p className="mt-0.5 text-xs text-slate-400">
                          Stock yang ditampilkan adalah stock outlet.
                        </p>
                      </div>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Base Unit
                      </span>

                    </div>

                  </div>

                  <div className="relative">

                    <Search
                      size={17}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      value={
                        barangSearch
                      }
                      onChange={(
                        event
                      ) =>
                        searchBarang(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="Cari nama, kode, atau barcode..."
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                    />

                    {barangList.length >
                      0 && (
                      <div className="absolute left-0 right-0 top-14 z-30 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">

                        {barangList.map(
                          (
                            barang
                          ) => {
                            const alreadyAdded =
                              items.some(
                                (
                                  item
                                ) =>
                                  item.barangId ===
                                  barang.id
                              );

                            return (
                              <button
                                type="button"
                                key={
                                  barang.id
                                }
                                disabled={
                                  alreadyAdded
                                }
                                onClick={() =>
                                  addItem(
                                    barang
                                  )
                                }
                                className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3.5 text-left transition last:border-0 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >

                                <div className="flex min-w-0 items-center gap-3">

                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                                    <Package
                                      size={
                                        18
                                      }
                                    />
                                  </div>

                                  <div className="min-w-0">

                                    <div className="truncate font-bold text-slate-900">
                                      {
                                        barang.name
                                      }
                                    </div>

                                    <div className="mt-0.5 text-xs text-slate-400">
                                      {
                                        barang.code
                                      }{" "}
                                      ·{" "}
                                      {barang.baseUnit ||
                                        barang.unit}
                                    </div>

                                  </div>

                                </div>

                                <div className="ml-4 shrink-0 text-right">

                                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                    Stock Outlet
                                  </div>

                                  <div className="mt-0.5 font-bold text-slate-900">
                                    {formatNumber(
                                      stockOf(
                                        barang
                                      )
                                    )}
                                  </div>

                                  {alreadyAdded && (
                                    <div className="text-[10px] text-emerald-600">
                                      Sudah dipilih
                                    </div>
                                  )}

                                </div>

                              </button>
                            );
                          }
                        )}

                      </div>
                    )}

                  </div>

                </div>

                {/* ITEMS */}

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

                  <div className="border-b border-slate-200 px-5 py-4">

                    <div className="flex items-center justify-between">

                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Detail Barang
                        </h3>

                        <p className="mt-0.5 text-xs text-slate-400">
                          Tentukan quantity adjustment.
                        </p>
                      </div>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                        {items.length} item
                      </span>

                    </div>

                  </div>

                  <div className="overflow-x-auto">

                    <table className="w-full min-w-[850px] text-sm">

                      <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-400">

                        <tr>

                          <th className="px-5 py-3 font-bold">
                            Barang
                          </th>

                          <th className="px-5 py-3 font-bold">
                            Stock Saat Ini
                          </th>

                          <th className="w-44 px-5 py-3 font-bold">
                            Qty
                          </th>

                          <th className="px-5 py-3 font-bold">
                            Stock Setelah
                          </th>

                          <th className="px-5 py-3 text-right font-bold">
                            Aksi
                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-slate-100">

                        {items.length ===
                        0 ? (
                          <tr>

                            <td
                              colSpan={5}
                              className="px-5 py-14 text-center"
                            >

                              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                                <Package size={21} />
                              </div>

                              <div className="mt-3 text-xs font-bold text-slate-600">
                                Belum ada barang
                              </div>

                              <div className="mt-1 text-[11px] text-slate-400">
                                Gunakan pencarian di atas
                                untuk menambahkan barang.
                              </div>

                            </td>

                          </tr>
                        ) : (
                          items.map(
                            (
                              item
                            ) => {
                              const current =
                                stockOf(
                                  item.barang
                                );

                              const qty =
                                Number(
                                  item.qty ||
                                    0
                                );

                              const after =
                                item.type ===
                                "IN"
                                  ? current +
                                    qty
                                  : current -
                                    qty;

                              const invalid =
                                after <
                                -0.000001;

                              return (
                                <tr
                                  key={
                                    item.barangId
                                  }
                                  className="hover:bg-slate-50/60"
                                >

                                  <td className="px-5 py-4">

                                    <div className="flex items-center gap-3">

                                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                        <Package
                                          size={
                                            16
                                          }
                                        />
                                      </div>

                                      <div>
                                        <div className="font-bold text-slate-800">
                                          {
                                            item
                                              .barang
                                              .name
                                          }
                                        </div>

                                        <div className="mt-0.5 text-[11px] text-slate-400">
                                          {
                                            item
                                              .barang
                                              .code
                                          }{" "}
                                          ·{" "}
                                          {item
                                            .barang
                                            .baseUnit ||
                                            item
                                              .barang
                                              .unit}
                                        </div>
                                      </div>

                                    </div>

                                  </td>

                                  <td className="px-5 py-4">

                                    <div className="font-bold text-slate-800">
                                      {formatNumber(
                                        current
                                      )}
                                    </div>

                                    <div className="text-[10px] uppercase tracking-wide text-slate-400">
                                      Stock Outlet
                                    </div>

                                  </td>

                                  <td className="px-5 py-4">

                                    <input
                                      type="number"
                                      min="0.001"
                                      step="any"
                                      value={
                                        item.qty
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        updateQty(
                                          item.barangId,
                                          event
                                            .target
                                            .value
                                        )
                                      }
                                      className={
                                        invalid
                                          ? "h-10 w-full rounded-lg border border-rose-300 bg-rose-50 px-3 font-bold text-rose-700 outline-none"
                                          : "h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-bold text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                                      }
                                    />

                                    {invalid && (
                                      <div className="mt-1 text-[10px] font-semibold text-rose-600">
                                        Stock tidak mencukupi
                                      </div>
                                    )}

                                  </td>

                                  <td className="px-5 py-4">

                                    <div
                                      className={
                                        invalid
                                          ? "font-bold text-rose-600"
                                          : item.type ===
                                            "IN"
                                          ? "font-bold text-emerald-700"
                                          : "font-bold text-slate-900"
                                      }
                                    >
                                      {formatNumber(
                                        after
                                      )}
                                    </div>

                                    <div className="text-[10px] uppercase tracking-wide text-slate-400">
                                      Setelah Adjustment
                                    </div>

                                  </td>

                                  <td className="px-5 py-4 text-right">

                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeItem(
                                          item.barangId
                                        )
                                      }
                                      className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                      title="Hapus barang"
                                    >
                                      <X
                                        size={
                                          17
                                        }
                                      />
                                    </button>

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

                {/* REASON + REMARKS */}

                <div className="grid gap-5 md:grid-cols-2">

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">

                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Reason
                    </label>

                    <input
                      value={
                        form.reason
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            reason:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      placeholder="Contoh: Koreksi hasil stock opname"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                    />

                    <p className="mt-2 text-[11px] text-slate-400">
                      Wajib diisi untuk audit transaksi.
                    </p>

                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">

                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Keterangan
                    </label>

                    <textarea
                      value={
                        form.remarks
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            remarks:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      rows={2}
                      placeholder="Keterangan tambahan (opsional)"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                    />

                  </div>

                </div>

                {/* WARNING */}

                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">

                  <ShieldCheck
                    size={18}
                    className="mt-0.5 shrink-0 text-amber-600"
                  />

                  <div>
                    <div className="text-xs font-bold text-amber-900">
                      Approval Control
                    </div>

                    <div className="mt-1 text-xs leading-5 text-amber-800">
                      Transaksi akan disimpan sebagai{" "}
                      <b>DRAFT</b>. Stock outlet tidak
                      berubah sampai adjustment di-approve
                      oleh <b>Admin Pusat</b>.
                    </div>
                  </div>

                </div>

              </div>

            </div>

            {/* MODAL FOOTER */}

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">

              <div className="text-xs text-slate-400">
                {items.length > 0
                  ? `${items.length} barang • ${formatNumber(
                      items.reduce(
                        (
                          total,
                          item
                        ) =>
                          total +
                          Number(
                            item.qty ||
                              0
                          ),
                        0
                      )
                    )} total qty`
                  : "Belum ada barang dipilih"}
              </div>

              <div className="flex justify-end gap-2">

                <button
                  type="button"
                  onClick={() =>
                    setOpenForm(false)
                  }
                  className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Batal
                </button>

                <button
                  type="button"
                  disabled={
                    saving ||
                    items.length ===
                      0
                  }
                  onClick={
                    saveDraft
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <FileCheck2
                        size={16}
                      />
                      Simpan Draft
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