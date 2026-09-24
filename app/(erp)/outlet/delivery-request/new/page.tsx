"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  Info,
  Loader2,
  Package,
  Plus,
  Search,
  Send,
  ShoppingCart,
  Sparkles,
  Store,
  Trash2,
  Truck,
  User,
  Warehouse,
  X,
  AlertTriangle,
  ChevronDown,
  Minus,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

type Outlet = {
  id: number;
  name: string;
  code?: string | null;
  active?: boolean;
};

type Customer = {
  id: number;
  code?: string | null;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  contactPerson?: string | null;
};

type Barang = {
  id: number;
  code?: string | null;
  kode?: string | null;
  name?: string | null;
  nama?: string | null;
  stock?: number | null;
  baseUnit?: string | null;
  satuan?: string | null;
  unit?: string | null;
  satuanTransaksi?: string | null;
  active?: boolean;
};

type RequestItem = {
  barangId: number;
  barang: Barang;
  qty: number;
  note: string;
};

type CurrentUser = {
  id?: number;
  username?: string;
  fullname?: string;
  role?: string;

  outletId?: number | null;
  outlet?: Outlet | null;

  customerId?: number | null;
  customer?: Customer | null;
};

// ============================================================
// HELPERS
// ============================================================

function getBarangName(barang: Barang) {
  return barang.name || barang.nama || `Barang #${barang.id}`;
}

function getBarangCode(barang: Barang) {
  return barang.code || barang.kode || `ID-${barang.id}`;
}

function getUnit(barang: Barang) {
  return (
    barang.unit ||
    barang.satuan ||
    barang.satuanTransaksi ||
    barang.baseUnit ||
    "PCS"
  );
}

function getStock(barang: Barang) {
  return Number(barang.stock ?? 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
  }).format(value);
}

function getTodayDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateIndonesia(value: string) {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

// ============================================================
// PAGE
// ============================================================

export default function DeliveryRequestNewPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [user, setUser] = useState<CurrentUser | null>(null);

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [barangList, setBarangList] = useState<Barang[]>([]);

  const [outletId, setOutletId] = useState<number | "">("");

  // ==========================================================
  // TANGGAL
  // ==========================================================

  const [deliveryDate, setDeliveryDate] =
    useState(getTodayDate());

  const [remarks, setRemarks] = useState("");

  // ==========================================================
  // ADD BARANG FORM
  // ==========================================================

  const [search, setSearch] = useState("");
  const [showBarangDropdown, setShowBarangDropdown] =
    useState(false);

  const [selectedBarang, setSelectedBarang] =
    useState<Barang | null>(null);

  const [itemQty, setItemQty] = useState("1");
  const [itemNote, setItemNote] = useState("");

  const [items, setItems] = useState<RequestItem[]>([]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ==========================================================
  // ROLE
  // ==========================================================

  const userRole = String(user?.role || "")
    .trim()
    .toUpperCase();

  const isOutletAdmin = userRole === "OUTLET_ADMIN";

  // ==========================================================
  // CUSTOMER
  // ==========================================================

  const customerId = user?.customerId ?? null;
  const selectedCustomer = user?.customer ?? null;

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [meRes, outletRes, barangRes] =
        await Promise.all([
          fetch("/api/me", {
            cache: "no-store",
          }),

          fetch("/api/outlet", {
            cache: "no-store",
          }),

          fetch("/api/barang", {
            cache: "no-store",
          }),
        ]);

      if (!meRes.ok) {
        throw new Error(
          "Gagal mengambil data user."
        );
      }

      const meData = await meRes.json();

      const outletData = outletRes.ok
        ? await outletRes.json()
        : [];

      const barangData = barangRes.ok
        ? await barangRes.json()
        : [];

      const currentUser: CurrentUser =
        meData?.user ||
        meData?.data ||
        meData ||
        null;

      setUser(currentUser);

      const normalizedOutlets: Outlet[] =
        Array.isArray(outletData)
          ? outletData
          : Array.isArray(outletData?.outlets)
          ? outletData.outlets
          : Array.isArray(outletData?.data)
          ? outletData.data
          : [];

      const normalizedBarang: Barang[] =
        Array.isArray(barangData)
          ? barangData
          : Array.isArray(barangData?.barang)
          ? barangData.barang
          : Array.isArray(barangData?.data)
          ? barangData.data
          : [];

      setOutlets(
        normalizedOutlets.filter(
          (outlet) => outlet.active !== false
        )
      );

      setBarangList(
        normalizedBarang.filter(
          (barang) => barang.active !== false
        )
      );

      if (currentUser?.outletId) {
        setOutletId(
          Number(currentUser.outletId)
        );
      }
    } catch (err) {
      console.error(
        "LOAD DELIVERY REQUEST ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Gagal memuat Delivery Request."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================
  // SELECTED OUTLET
  // ==========================================================

  const selectedOutlet = useMemo(() => {
    if (!outletId) {
      return null;
    }

    return outlets.find(
      (outlet) =>
        Number(outlet.id) === Number(outletId)
    );
  }, [outletId, outlets]);

  // ==========================================================
  // BARANG SEARCH
  // ==========================================================

  const filteredBarang = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    const availableBarang =
      barangList.filter(
        (barang) =>
          !items.some(
            (item) =>
              Number(item.barangId) ===
              Number(barang.id)
          )
      );

    if (!keyword) {
      return availableBarang.slice(0, 15);
    }

    return availableBarang
      .filter((barang) => {
        const name =
          getBarangName(barang).toLowerCase();

        const code =
          getBarangCode(barang).toLowerCase();

        return (
          name.includes(keyword) ||
          code.includes(keyword)
        );
      })
      .slice(0, 20);
  }, [barangList, items, search]);

  // ==========================================================
  // SUMMARY
  // ==========================================================

  const totalItems = items.length;

  const totalQty = useMemo(() => {
    return items.reduce(
      (sum, item) =>
        sum + Number(item.qty || 0),
      0
    );
  }, [items]);

  const totalNotes = useMemo(() => {
    return items.filter(
      (item) => item.note.trim()
    ).length;
  }, [items]);

  const warningItems = useMemo(() => {
    return items.filter(
      (item) =>
        Number(item.qty || 0) >
        getStock(item.barang)
    ).length;
  }, [items]);

  // ==========================================================
  // SELECT BARANG
  // ==========================================================

  function selectBarang(barang: Barang) {
    setError("");

    setSelectedBarang(barang);
    setSearch(getBarangName(barang));
    setShowBarangDropdown(false);

    setItemQty("1");
    setItemNote("");
  }

  // ==========================================================
  // CLEAR BARANG FORM
  // ==========================================================

  function clearBarangForm() {
    setSelectedBarang(null);
    setSearch("");
    setItemQty("1");
    setItemNote("");
    setShowBarangDropdown(false);
  }

  // ==========================================================
  // ADD BARANG KE TABLE
  // ==========================================================

  function addBarangToRequest() {
    setError("");

    if (!selectedBarang) {
      setError(
        "Silakan pilih barang terlebih dahulu."
      );
      return;
    }

    const qty = Number(itemQty);

    if (
      !Number.isFinite(qty) ||
      qty <= 0
    ) {
      setError(
        `Qty untuk ${getBarangName(
          selectedBarang
        )} harus lebih dari 0.`
      );
      return;
    }

    const existing = items.find(
      (item) =>
        Number(item.barangId) ===
        Number(selectedBarang.id)
    );

    if (existing) {
      setError(
        `${getBarangName(
          selectedBarang
        )} sudah ada di daftar request.`
      );
      return;
    }

    setItems((current) => [
      ...current,
      {
        barangId: selectedBarang.id,
        barang: selectedBarang,
        qty,
        note: itemNote.trim(),
      },
    ]);

    clearBarangForm();
  }

  // ==========================================================
  // UPDATE QTY
  // ==========================================================

  function updateQty(
    barangId: number,
    value: string
  ) {
    const numericValue = Number(value);

    if (value === "") {
      setItems((current) =>
        current.map((item) =>
          item.barangId === barangId
            ? {
                ...item,
                qty: 0,
              }
            : item
        )
      );

      return;
    }

    if (!Number.isFinite(numericValue)) {
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.barangId === barangId
          ? {
              ...item,
              qty: Math.max(
                0,
                numericValue
              ),
            }
          : item
      )
    );
  }

  // ==========================================================
  // UPDATE NOTE
  // ==========================================================

  function updateItemNote(
    barangId: number,
    value: string
  ) {
    setItems((current) =>
      current.map((item) =>
        item.barangId === barangId
          ? {
              ...item,
              note: value,
            }
          : item
      )
    );
  }

  // ==========================================================
  // REMOVE
  // ==========================================================

  function removeItem(barangId: number) {
    setItems((current) =>
      current.filter(
        (item) =>
          item.barangId !== barangId
      )
    );
  }

  // ==========================================================
  // SUBMIT
  // ==========================================================

  async function submitRequest() {
    try {
      setError("");
      setSuccess("");

      if (!isOutletAdmin) {
        setError(
          "Hanya ADMIN OUTLET yang dapat membuat Delivery Request."
        );
        return;
      }

      if (!outletId) {
        setError(
          "Outlet user belum tersedia."
        );
        return;
      }

      if (!customerId) {
        setError(
          "Customer belum terhubung dengan user yang sedang login."
        );
        return;
      }

      if (!deliveryDate) {
        setError(
          "Tanggal Delivery wajib dipilih."
        );
        return;
      }

      if (!items.length) {
        setError(
          "Minimal tambahkan 1 barang."
        );
        return;
      }

      const invalidItem = items.find(
        (item) =>
          !Number.isFinite(item.qty) ||
          item.qty <= 0
      );

      if (invalidItem) {
        setError(
          `Qty untuk ${getBarangName(
            invalidItem.barang
          )} harus lebih dari 0.`
        );
        return;
      }

      setSubmitting(true);

      const response = await fetch(
        "/api/delivery-request",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            outletId: Number(outletId),

            customerId: Number(
              customerId
            ),

            requestDate: deliveryDate,

            remarks:
              remarks.trim() || null,

            items: items.map(
              (item) => ({
                barangId:
                  item.barangId,

                qty: Number(
                  item.qty
                ),

                note:
                  item.note.trim() ||
                  null,
              })
            ),
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Gagal membuat Delivery Request."
        );
      }

      setSuccess(
        data?.message ||
          `Delivery Request berhasil dibuat untuk tanggal ${formatDateIndonesia(
            deliveryDate
          )} dan menunggu approval.`
      );

      setTimeout(() => {
        router.push(
          "/outlet/delivery-request"
        );

        router.refresh();
      }, 700);
    } catch (err) {
      console.error(
        "CREATE DELIVERY REQUEST ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Gagal membuat Delivery Request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F2F8F5] px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto flex min-h-[720px] max-w-[1600px] items-center justify-center">
          <div className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-emerald-100 bg-white p-8 shadow-[0_30px_90px_rgba(6,78,59,0.12)]">
            <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-50" />

            <div className="relative flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Loader2
                  size={23}
                  className="animate-spin"
                />
              </div>

              <div>
                <div className="text-sm font-black text-emerald-950">
                  Memuat Delivery Request
                </div>

                <div className="mt-1 text-xs font-medium text-slate-400">
                  Menyiapkan outlet, customer,
                  dan Master Barang...
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================================
  // ACCESS DENIED
  // ==========================================================

  if (!isOutletAdmin) {
    return (
      <main className="min-h-screen bg-[#F2F8F5] px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto flex min-h-[720px] max-w-2xl items-center justify-center">
          <div className="w-full overflow-hidden rounded-[32px] border border-emerald-100 bg-white shadow-[0_30px_90px_rgba(6,78,59,0.12)]">
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 px-6 py-14 text-center text-white md:px-10">
              <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/[0.06]" />
              <div className="absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-emerald-400/[0.08]" />

              <div className="relative">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-2xl">
                  <Store size={30} />
                </div>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/80">
                  <Truck size={12} />
                  Outlet Supply Request
                </div>

                <h1 className="mt-4 text-2xl font-black tracking-tight">
                  Delivery Request Outlet
                </h1>

                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/70">
                  Halaman ini digunakan oleh
                  ADMIN OUTLET untuk mengajukan
                  kebutuhan barang ke Gudang Pusat.
                </p>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <X size={18} />
                  </div>

                  <div>
                    <div className="text-sm font-black text-amber-800">
                      Akses tidak tersedia
                    </div>

                    <div className="mt-1 text-xs font-medium leading-5 text-amber-700">
                      Hanya ADMIN OUTLET yang
                      dapat membuat Delivery Request.
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.back()}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-700/20 transition hover:-translate-y-0.5 hover:bg-emerald-800"
              >
                <ArrowLeft size={17} />
                Kembali
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================================
  // MAIN
  // ==========================================================

  return (
    <main className="min-h-screen bg-[#F2F8F5] px-3 py-4 md:px-6 md:py-7 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-5">

        {/* TOP ACCENT */}

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-100">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-emerald-700 via-emerald-500 to-teal-400" />
        </div>

        {/* BREADCRUMB */}

        <div className="flex flex-wrap items-center gap-2 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
          <button
            type="button"
            onClick={() => router.back()}
            className="transition hover:text-emerald-700"
          >
            Outlet
          </button>

          <span className="text-slate-300">/</span>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/outlet/delivery-request"
              )
            }
            className="transition hover:text-emerald-700"
          >
            Delivery Request
          </button>

          <span className="text-slate-300">/</span>

          <span className="text-emerald-700">
            Buat Baru
          </span>
        </div>

        {/* HERO */}

        <section className="relative overflow-hidden rounded-[32px] border border-emerald-100 bg-white shadow-[0_22px_70px_rgba(6,78,59,0.08)]">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -right-28 -top-36 h-[460px] w-[460px] rounded-full bg-emerald-50" />
            <div className="absolute -bottom-52 right-[18%] h-[400px] w-[400px] rounded-full bg-teal-50/60" />
            <div className="absolute -left-32 bottom-[-180px] h-[360px] w-[360px] rounded-full bg-slate-50" />
          </div>

          <div className="relative p-5 md:p-8 lg:p-10">
            <button
              type="button"
              onClick={() => router.back()}
              className="group inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-white px-4 py-2.5 text-xs font-black text-slate-600 shadow-sm transition hover:-translate-x-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <ArrowLeft
                size={16}
                className="transition-transform group-hover:-translate-x-0.5"
              />
              Kembali
            </button>

            <div className="mt-7 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  <Sparkles size={13} />
                  Premium Outlet Supply
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-emerald-950 md:text-4xl lg:text-[48px]">
                  Buat Delivery Request
                </h1>

                <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-500 md:text-base">
                  Ajukan kebutuhan barang outlet
                  ke Gudang Pusat dengan detail
                  item, qty, catatan, dan informasi
                  ketersediaan stock secara real-time
                  dari Master Barang.
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <HeaderBadge
                    icon={<Store size={13} />}
                    text={
                      selectedOutlet?.name ||
                      user?.outlet?.name ||
                      "Outlet Anda"
                    }
                  />

                  <HeaderBadge
                    icon={<User size={13} />}
                    text={
                      selectedCustomer?.name ||
                      "Customer belum terhubung"
                    }
                  />

                  <HeaderBadge
                    icon={<CalendarDays size={13} />}
                    text={`Delivery: ${formatDateIndonesia(
                      deliveryDate
                    )}`}
                  />

                  <HeaderBadge
                    icon={<ClipboardList size={13} />}
                    text="Status awal: PENDING"
                  />

                  <HeaderBadge
                    icon={<Warehouse size={13} />}
                    text="Stock pusat sebagai referensi"
                  />
                </div>
              </div>

              <div className="grid w-full max-w-md grid-cols-2 gap-3 xl:w-[350px] xl:max-w-none">
                <HeroMetric
                  icon={<Boxes size={17} />}
                  label="Jenis Barang"
                  value={formatNumber(totalItems)}
                />

                <HeroMetric
                  icon={<ShoppingCart size={17} />}
                  label="Total Qty"
                  value={formatNumber(totalQty)}
                />

                <HeroMetric
                  icon={<ClipboardList size={17} />}
                  label="Catatan Item"
                  value={formatNumber(totalNotes)}
                />

                <HeroMetric
                  icon={<Info size={17} />}
                  label="Stock Warning"
                  value={
                    warningItems > 0
                      ? `${warningItems} Item`
                      : "Normal"
                  }
                  warning={warningItems > 0}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ALERT */}

        {error && (
          <Alert
            type="error"
            message={error}
          />
        )}

        {success && (
          <Alert
            type="success"
            message={success}
          />
        )}

        {/* MAIN */}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">

          {/* LEFT */}

          <div className="min-w-0 space-y-6">

            {/* IDENTITAS */}

            <section className="rounded-[28px] border border-emerald-100 bg-white p-5 shadow-[0_12px_40px_rgba(6,78,59,0.045)] md:p-6">
              <SectionHeader
                icon={<User size={20} />}
                eyebrow="01 · IDENTITAS"
                title="Identitas Request"
                description="Outlet dan customer dikunci berdasarkan user yang sedang login."
              />

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <IdentityCard
                  icon={<Store size={19} />}
                  label="Outlet Tujuan"
                  value={
                    selectedOutlet?.name ||
                    user?.outlet?.name ||
                    "Outlet belum tersedia"
                  }
                  meta={
                    selectedOutlet?.code ||
                    user?.outlet?.code ||
                    "-"
                  }
                  verified={Boolean(outletId)}
                />

                <IdentityCard
                  icon={<User size={19} />}
                  label="Customer"
                  value={
                    selectedCustomer?.name ||
                    "Customer belum terhubung"
                  }
                  meta={
                    selectedCustomer?.code
                      ? `Kode: ${selectedCustomer.code}`
                      : customerId
                      ? `ID: ${customerId}`
                      : "Belum tersedia"
                  }
                  verified={Boolean(customerId)}
                />
              </div>

              {!customerId && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                      <X size={17} />
                    </div>

                    <div>
                      <div className="text-xs font-black text-amber-800">
                        Customer belum terhubung
                      </div>

                      <p className="mt-1 text-[11px] font-semibold leading-5 text-amber-700">
                        User yang sedang login belum
                        memiliki Customer. Delivery
                        Request tidak dapat dibuat
                        sebelum customer user diatur.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* TANGGAL */}

            <section className="rounded-[28px] border border-emerald-100 bg-white p-5 shadow-[0_12px_40px_rgba(6,78,59,0.045)] md:p-6">
              <SectionHeader
                icon={<CalendarDays size={20} />}
                eyebrow="02 · DELIVERY"
                title="Tanggal Delivery"
                description="Tanggal yang dipilih menjadi tanggal transaksi dan dipertahankan sepanjang proses delivery."
              />

              <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px]">
                <div>
                  <label
                    htmlFor="delivery-date"
                    className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500"
                  >
                    Tanggal Delivery / Transaksi
                  </label>

                  <div className="group flex items-center rounded-2xl border border-emerald-100 bg-[#FAFDFC] px-4 transition focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-500/10">
                    <CalendarDays
                      size={18}
                      className="shrink-0 text-emerald-600"
                    />

                    <input
                      id="delivery-date"
                      type="date"
                      value={deliveryDate}
                      onChange={(event) => {
                        setDeliveryDate(
                          event.target.value
                        );
                        setError("");
                      }}
                      className="w-full bg-transparent px-3 py-3.5 text-sm font-bold text-emerald-950 outline-none"
                    />
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                    <CheckCircle2
                      size={13}
                      className="text-emerald-600"
                    />
                    Dipilih:
                    <span className="font-black text-emerald-700">
                      {formatDateIndonesia(
                        deliveryDate
                      )}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
                      <Truck size={18} />
                    </div>

                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">
                        Tanggal Transaksi
                      </div>

                      <div className="mt-1 text-sm font-black text-emerald-950">
                        {formatDateIndonesia(
                          deliveryDate
                        )}
                      </div>

                      <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">
                        Tanggal ini mengikuti
                        request sampai release
                        dan penerimaan outlet.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* BARANG */}

            <section className="overflow-visible rounded-[28px] border border-emerald-100 bg-white p-5 shadow-[0_12px_40px_rgba(6,78,59,0.045)] md:p-6">
              <SectionHeader
                icon={<Boxes size={20} />}
                eyebrow="03 · ITEM REQUEST"
                title="Tambah Barang"
                description="Cari barang, pilih dari dropdown, tentukan qty dan catatan, kemudian tambahkan ke tabel request."
              />

              {/* ADD FORM */}

              <div className="mt-6 rounded-[24px] border border-emerald-100 bg-gradient-to-br from-[#F7FCF9] via-white to-emerald-50/40 p-4 md:p-5">

                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                      Form Tambah Barang
                    </div>

                    <div className="mt-1 text-xs font-medium text-slate-400">
                      Pilih barang terlebih dahulu
                    </div>
                  </div>

                  <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-[9px] font-black text-emerald-700 sm:flex">
                    <Plus size={12} />
                    ADD ITEM
                  </div>
                </div>

                {/* SEARCH */}

                <div className="relative">
                  <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">
                    Barang
                  </label>

                  <div
                    className={[
                      "flex items-center rounded-2xl border bg-white px-4 transition",
                      selectedBarang
                        ? "border-emerald-300 ring-4 ring-emerald-500/5"
                        : "border-emerald-100 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10",
                    ].join(" ")}
                  >
                    <Search
                      size={18}
                      className="shrink-0 text-emerald-600"
                    />

                    <input
                      value={search}
                      onChange={(event) => {
                        const value =
                          event.target.value;

                        setSearch(value);
                        setSelectedBarang(null);
                        setShowBarangDropdown(true);
                      }}
                      onFocus={() =>
                        setShowBarangDropdown(true)
                      }
                      placeholder="Ketik nama atau kode barang..."
                      className="w-full bg-transparent px-3 py-3.5 text-sm font-semibold text-emerald-950 outline-none placeholder:text-slate-400"
                    />

                    {selectedBarang ? (
                      <button
                        type="button"
                        onClick={
                          clearBarangForm
                        }
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                      >
                        <X size={16} />
                      </button>
                    ) : search ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setShowBarangDropdown(
                            true
                          );
                        }}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <X size={16} />
                      </button>
                    ) : (
                      <ChevronDown
                        size={17}
                        className="text-slate-400"
                      />
                    )}
                  </div>

                  {/* DROPDOWN */}

                  {showBarangDropdown && (
                    <>
                      <button
                        type="button"
                        aria-label="Tutup daftar barang"
                        className="fixed inset-0 z-30 cursor-default"
                        onClick={() =>
                          setShowBarangDropdown(
                            false
                          )
                        }
                      />

                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 max-h-[430px] overflow-y-auto rounded-[22px] border border-emerald-100 bg-white p-2 shadow-[0_30px_80px_rgba(6,78,59,0.18)]">

                        <div className="sticky top-0 z-10 mb-1 flex items-center justify-between border-b border-emerald-50 bg-white px-3 py-3">
                          <div>
                            <div className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-700">
                              Master Barang
                            </div>

                            <div className="mt-0.5 text-[10px] font-semibold text-slate-400">
                              Pilih barang untuk request
                            </div>
                          </div>

                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700">
                            {filteredBarang.length} tersedia
                          </span>
                        </div>

                        {filteredBarang.length ===
                        0 ? (
                          <div className="px-4 py-12 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
                              <Package size={23} />
                            </div>

                            <p className="mt-3 text-sm font-black text-slate-700">
                              Barang tidak ditemukan
                            </p>

                            <p className="mt-1 text-xs font-medium text-slate-400">
                              Coba nama atau kode
                              barang lainnya.
                            </p>
                          </div>
                        ) : (
                          filteredBarang.map(
                            (barang) => {
                              const stock =
                                getStock(
                                  barang
                                );

                              return (
                                <button
                                  key={
                                    barang.id
                                  }
                                  type="button"
                                  onClick={() =>
                                    selectBarang(
                                      barang
                                    )
                                  }
                                  className="group flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition hover:bg-emerald-50"
                                >
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-600 group-hover:text-white">
                                    <Package
                                      size={
                                        18
                                      }
                                    />
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-black text-emerald-950">
                                      {getBarangName(
                                        barang
                                      )}
                                    </div>

                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-400">
                                      <span>
                                        {getBarangCode(
                                          barang
                                        )}
                                      </span>

                                      <span className="text-slate-300">
                                        •
                                      </span>

                                      <span>
                                        {getUnit(
                                          barang
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  <div
                                    className={[
                                      "shrink-0 rounded-xl border px-3 py-2 text-right",
                                      stock >
                                      0
                                        ? "border-emerald-100 bg-emerald-50"
                                        : "border-red-100 bg-red-50",
                                    ].join(
                                      " "
                                    )}
                                  >
                                    <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                                      Stock Pusat
                                    </div>

                                    <div
                                      className={[
                                        "mt-0.5 text-xs font-black",
                                        stock >
                                        0
                                          ? "text-emerald-700"
                                          : "text-red-500",
                                      ].join(
                                        " "
                                      )}
                                    >
                                      {formatNumber(
                                        stock
                                      )}{" "}
                                      {getUnit(
                                        barang
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-600 group-hover:text-white">
                                    <Plus
                                      size={
                                        17
                                      }
                                    />
                                  </div>
                                </button>
                              );
                            }
                          )
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* SELECTED BARANG */}

                {selectedBarang && (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <Package size={19} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-emerald-950">
                          {getBarangName(
                            selectedBarang
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-400">
                          <span>
                            {getBarangCode(
                              selectedBarang
                            )}
                          </span>

                          <span className="text-slate-300">
                            •
                          </span>

                          <span>
                            Satuan:{" "}
                            {getUnit(
                              selectedBarang
                            )}
                          </span>
                        </div>
                      </div>

                      <div
                        className={[
                          "rounded-xl px-3 py-2 text-right",
                          getStock(
                            selectedBarang
                          ) > 0
                            ? "bg-emerald-50"
                            : "bg-red-50",
                        ].join(" ")}
                      >
                        <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                          Stock Pusat
                        </div>

                        <div
                          className={[
                            "mt-0.5 text-sm font-black",
                            getStock(
                              selectedBarang
                            ) > 0
                              ? "text-emerald-700"
                              : "text-red-500",
                          ].join(" ")}
                        >
                          {formatNumber(
                            getStock(
                              selectedBarang
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* QTY + NOTE */}

                <div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
                  <div>
                    <label
                      htmlFor="new-item-qty"
                      className="mb-2 block text-[9px] font-black uppercase tracking-[0.15em] text-slate-500"
                    >
                      Qty Request
                    </label>

                    <div className="flex items-center rounded-2xl border border-emerald-100 bg-white p-1 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10">
                      <button
                        type="button"
                        disabled={
                          Number(
                            itemQty
                          ) <= 0
                        }
                        onClick={() => {
                          const current =
                            Number(
                              itemQty
                            ) || 0;

                          setItemQty(
                            String(
                              Math.max(
                                0,
                                current -
                                  1
                              )
                            )
                          );
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-30"
                      >
                        <Minus
                          size={16}
                        />
                      </button>

                      <input
                        id="new-item-qty"
                        type="number"
                        min="0"
                        step="any"
                        value={itemQty}
                        onChange={(event) =>
                          setItemQty(
                            event.target
                              .value
                          )
                        }
                        placeholder="0"
                        className="h-11 min-w-0 flex-1 border-x border-emerald-50 bg-transparent text-center text-sm font-black text-emerald-950 outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          const current =
                            Number(
                              itemQty
                            ) || 0;

                          setItemQty(
                            String(
                              current + 1
                            )
                          );
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-emerald-700 transition hover:bg-emerald-50"
                      >
                        <Plus
                          size={17}
                        />
                      </button>
                    </div>

                    {selectedBarang && (
                      <div className="mt-2 flex items-center gap-1.5 text-[9px] font-semibold text-slate-400">
                        Satuan:
                        <strong className="text-emerald-700">
                          {getUnit(
                            selectedBarang
                          )}
                        </strong>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label
                        htmlFor="new-item-note"
                        className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500"
                      >
                        Catatan Barang
                      </label>

                      <span className="text-[9px] font-medium text-slate-400">
                        {itemNote.length}/500
                      </span>
                    </div>

                    <textarea
                      id="new-item-note"
                      value={itemNote}
                      onChange={(event) =>
                        setItemNote(
                          event.target.value
                        )
                      }
                      rows={3}
                      maxLength={500}
                      placeholder={
                        selectedBarang
                          ? `Catatan untuk ${getBarangName(
                              selectedBarang
                            )}...`
                          : "Pilih barang terlebih dahulu..."
                      }
                      disabled={
                        !selectedBarang
                      }
                      className="w-full resize-none rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-xs font-medium leading-5 text-emerald-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>
                </div>

                {/* ADD BUTTON */}

                <button
                  type="button"
                  onClick={
                    addBarangToRequest
                  }
                  disabled={
                    !selectedBarang
                  }
                  className="group mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 px-5 py-4 text-sm font-black text-white shadow-[0_14px_30px_rgba(5,150,105,0.20)] transition hover:-translate-y-0.5 hover:from-emerald-800 hover:via-emerald-700 hover:to-teal-700 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-40"
                >
                  <Plus
                    size={19}
                    className="transition-transform group-hover:rotate-90"
                  />

                  Tambah Barang

                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </button>

                <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-3 text-[9px] font-semibold leading-4 text-emerald-700">
                  <Info
                    size={13}
                    className="shrink-0"
                  />

                  <span>
                    Stock Gudang Pusat hanya
                    sebagai informasi saat membuat
                    request. Jika qty melebihi stock,
                    item tetap dapat ditambahkan dan
                    dikirim.
                  </span>
                </div>
              </div>

              {/* TABLE HEADER */}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">
                    Daftar Barang Request
                  </div>

                  <div className="mt-1 text-xs font-medium text-slate-400">
                    Barang yang sudah ditambahkan
                    akan muncul di tabel berikut.
                  </div>
                </div>

                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[9px] font-black text-emerald-700">
                  <Boxes size={12} />
                  {totalItems} Barang ·{" "}
                  {formatNumber(totalQty)} Qty
                </div>
              </div>

              {/* EMPTY */}

              {items.length === 0 ? (
                <div className="relative mt-4 overflow-hidden rounded-[24px] border border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white px-6 py-16 text-center">
                  <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-100/50" />
                  <div className="absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-teal-50" />

                  <div className="relative">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-[0_12px_30px_rgba(6,78,59,0.08)]">
                      <ShoppingCart
                        size={27}
                      />
                    </div>

                    <h3 className="mt-5 text-sm font-black text-emerald-950">
                      Belum ada barang
                    </h3>

                    <p className="mx-auto mt-2 max-w-sm text-xs font-medium leading-5 text-slate-400">
                      Pilih barang dari dropdown di
                      atas, isi qty dan catatan,
                      kemudian tekan{" "}
                      <strong className="text-emerald-700">
                        Tambah Barang
                      </strong>
                      .
                    </p>

                    <div className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[9px] font-black text-emerald-700 shadow-sm">
                      <Search size={11} />
                      Cari barang di atas
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-[24px] border border-emerald-100 bg-white shadow-sm">

                  {/* DESKTOP TABLE */}

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[900px] border-collapse">
                      <thead>
                        <tr className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50/50">
                          <th className="px-4 py-3.5 text-left text-[8px] font-black uppercase tracking-[0.14em] text-emerald-700">
                            #
                          </th>

                          <th className="px-4 py-3.5 text-left text-[8px] font-black uppercase tracking-[0.14em] text-emerald-700">
                            Barang
                          </th>

                          <th className="px-4 py-3.5 text-right text-[8px] font-black uppercase tracking-[0.14em] text-emerald-700">
                            Stock Pusat
                          </th>

                          <th className="px-4 py-3.5 text-center text-[8px] font-black uppercase tracking-[0.14em] text-emerald-700">
                            Qty Request
                          </th>

                          <th className="px-4 py-3.5 text-left text-[8px] font-black uppercase tracking-[0.14em] text-emerald-700">
                            Catatan
                          </th>

                          <th className="px-4 py-3.5 text-center text-[8px] font-black uppercase tracking-[0.14em] text-emerald-700">
                            Status
                          </th>

                          <th className="px-4 py-3.5 text-center text-[8px] font-black uppercase tracking-[0.14em] text-emerald-700">
                            Aksi
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {items.map(
                          (
                            item,
                            index
                          ) => {
                            const stock =
                              getStock(
                                item.barang
                              );

                            const qty =
                              Number(
                                item.qty ||
                                  0
                              );

                            const stockWarning =
                              qty > stock;

                            return (
                              <tr
                                key={
                                  item.barangId
                                }
                                className="group border-b border-slate-100 last:border-b-0 hover:bg-emerald-50/30"
                              >
                                <td className="px-4 py-4 align-top">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-[9px] font-black text-emerald-700">
                                    {String(
                                      index +
                                        1
                                    ).padStart(
                                      2,
                                      "0"
                                    )}
                                  </div>
                                </td>

                                <td className="max-w-[260px] px-4 py-4 align-top">
                                  <div className="font-black text-emerald-950">
                                    {getBarangName(
                                      item.barang
                                    )}
                                  </div>

                                  <div className="mt-1 text-[10px] font-semibold text-slate-400">
                                    {getBarangCode(
                                      item.barang
                                    )}
                                  </div>

                                  <div className="mt-1 inline-flex rounded-md bg-slate-50 px-2 py-1 text-[9px] font-bold text-slate-500">
                                    {getUnit(
                                      item.barang
                                    )}
                                  </div>
                                </td>

                                <td className="px-4 py-4 text-right align-top">
                                  <div
                                    className={[
                                      "inline-flex flex-col rounded-xl border px-3 py-2",
                                      stockWarning
                                        ? "border-amber-200 bg-amber-50"
                                        : "border-emerald-100 bg-emerald-50",
                                    ].join(
                                      " "
                                    )}
                                  >
                                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                                      Stock
                                    </span>

                                    <span
                                      className={[
                                        "mt-0.5 text-sm font-black",
                                        stockWarning
                                          ? "text-amber-700"
                                          : "text-emerald-700",
                                      ].join(
                                        " "
                                      )}
                                    >
                                      {formatNumber(
                                        stock
                                      )}
                                    </span>

                                    <span className="text-[8px] font-bold uppercase text-slate-400">
                                      {getUnit(
                                        item.barang
                                      )}
                                    </span>
                                  </div>
                                </td>

                                <td className="px-4 py-4 align-top">
                                  <div className="mx-auto flex w-[130px] items-center rounded-xl border border-emerald-100 bg-white p-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateQty(
                                          item.barangId,
                                          String(
                                            Math.max(
                                              0,
                                              qty -
                                                1
                                            )
                                          )
                                        )
                                      }
                                      className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-50"
                                    >
                                      <Minus
                                        size={
                                          14
                                        }
                                      />
                                    </button>

                                    <input
                                      type="number"
                                      min="0"
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
                                      className="h-8 min-w-0 flex-1 border-x border-emerald-50 bg-transparent text-center text-xs font-black text-emerald-950 outline-none"
                                    />

                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateQty(
                                          item.barangId,
                                          String(
                                            qty +
                                              1
                                          )
                                        )
                                      }
                                      className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-50"
                                    >
                                      <Plus
                                        size={
                                          14
                                        }
                                      />
                                    </button>
                                  </div>

                                  <div className="mt-1 text-center text-[8px] font-bold uppercase text-slate-400">
                                    {getUnit(
                                      item.barang
                                    )}
                                  </div>
                                </td>

                                <td className="min-w-[190px] px-4 py-4 align-top">
                                  <textarea
                                    value={
                                      item.note
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateItemNote(
                                        item.barangId,
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                    rows={3}
                                    maxLength={
                                      500
                                    }
                                    placeholder="Catatan..."
                                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-medium leading-4 text-slate-700 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
                                  />
                                </td>

                                <td className="px-4 py-4 align-top text-center">
                                  {stockWarning ? (
                                    <div className="inline-flex flex-col items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                                      <AlertTriangle
                                        size={
                                          15
                                        }
                                      />

                                      <span className="text-[8px] font-black uppercase tracking-wider">
                                        Stock Kurang
                                      </span>

                                      <span className="text-[8px] font-semibold">
                                        Request tetap boleh
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="inline-flex flex-col items-center gap-1 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-700">
                                      <CheckCircle2
                                        size={
                                          15
                                        }
                                      />

                                      <span className="text-[8px] font-black uppercase tracking-wider">
                                        Tersedia
                                      </span>

                                      <span className="text-[8px] font-semibold">
                                        Stock mencukupi
                                      </span>
                                    </div>
                                  )}
                                </td>

                                <td className="px-4 py-4 align-top text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeItem(
                                        item.barangId
                                      )
                                    }
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                    aria-label={`Hapus ${getBarangName(
                                      item.barang
                                    )}`}
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

                  {/* MOBILE CARDS */}

                  <div className="space-y-3 p-3 md:hidden">
                    {items.map(
                      (
                        item,
                        index
                      ) => {
                        const stock =
                          getStock(
                            item.barang
                          );

                        const qty =
                          Number(
                            item.qty ||
                              0
                          );

                        const stockWarning =
                          qty > stock;

                        return (
                          <div
                            key={
                              item.barangId
                            }
                            className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[9px] font-black text-emerald-700">
                                {String(
                                  index +
                                    1
                                ).padStart(
                                  2,
                                  "0"
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="font-black text-emerald-950">
                                  {getBarangName(
                                    item.barang
                                  )}
                                </div>

                                <div className="mt-1 text-[9px] font-semibold text-slate-400">
                                  {getBarangCode(
                                    item.barang
                                  )}{" "}
                                  ·{" "}
                                  {getUnit(
                                    item.barang
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  removeItem(
                                    item.barangId
                                  )
                                }
                                className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2
                                  size={
                                    16
                                  }
                                />
                              </button>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <div
                                className={[
                                  "rounded-xl border p-3",
                                  stockWarning
                                    ? "border-amber-200 bg-amber-50"
                                    : "border-emerald-100 bg-emerald-50",
                                ].join(
                                  " "
                                )}
                              >
                                <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                                  Stock Pusat
                                </div>

                                <div
                                  className={[
                                    "mt-1 text-sm font-black",
                                    stockWarning
                                      ? "text-amber-700"
                                      : "text-emerald-700",
                                  ].join(
                                    " "
                                  )}
                                >
                                  {formatNumber(
                                    stock
                                  )}{" "}
                                  {getUnit(
                                    item.barang
                                  )}
                                </div>
                              </div>

                              <div className="rounded-xl border border-emerald-100 bg-white p-3">
                                <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                                  Status
                                </div>

                                <div
                                  className={[
                                    "mt-1 flex items-center gap-1.5 text-[10px] font-black",
                                    stockWarning
                                      ? "text-amber-700"
                                      : "text-emerald-700",
                                  ].join(
                                    " "
                                  )}
                                >
                                  {stockWarning ? (
                                    <>
                                      <AlertTriangle
                                        size={
                                          13
                                        }
                                      />
                                      Stock Kurang
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2
                                        size={
                                          13
                                        }
                                      />
                                      Tersedia
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="mt-3">
                              <div className="mb-1.5 text-[8px] font-black uppercase tracking-wider text-slate-400">
                                Qty Request
                              </div>

                              <div className="flex items-center rounded-xl border border-emerald-100 bg-white p-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQty(
                                      item.barangId,
                                      String(
                                        Math.max(
                                          0,
                                          qty -
                                            1
                                        )
                                      )
                                    )
                                  }
                                  className="flex h-10 w-10 items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-50"
                                >
                                  <Minus
                                    size={
                                      15
                                    }
                                  />
                                </button>

                                <input
                                  type="number"
                                  min="0"
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
                                  className="h-10 flex-1 border-x border-emerald-50 text-center text-sm font-black text-emerald-950 outline-none"
                                />

                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQty(
                                      item.barangId,
                                      String(
                                        qty +
                                          1
                                      )
                                    )
                                  }
                                  className="flex h-10 w-10 items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-50"
                                >
                                  <Plus
                                    size={
                                      15
                                    }
                                  />
                                </button>
                              </div>
                            </div>

                            <div className="mt-3">
                              <div className="mb-1.5 text-[8px] font-black uppercase tracking-wider text-slate-400">
                                Catatan Barang
                              </div>

                              <textarea
                                value={
                                  item.note
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateItemNote(
                                    item.barangId,
                                    event
                                      .target
                                      .value
                                  )
                                }
                                rows={3}
                                maxLength={
                                  500
                                }
                                placeholder="Catatan barang..."
                                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[10px] font-medium leading-4 outline-none focus:border-emerald-400 focus:bg-white"
                              />
                            </div>

                            {stockWarning && (
                              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[9px] font-bold leading-4 text-amber-700">
                                Qty request melebihi
                                stock Gudang Pusat.
                                Request tetap dapat
                                dikirim.
                              </div>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* CATATAN REQUEST */}

            <section className="rounded-[28px] border border-emerald-100 bg-white p-5 shadow-[0_12px_40px_rgba(6,78,59,0.045)] md:p-6">
              <SectionHeader
                icon={<ClipboardList size={20} />}
                eyebrow="04 · INFORMASI"
                title="Catatan Request"
                description="Tambahkan informasi umum yang membantu Gudang Pusat menyiapkan request."
              />

              <div className="mt-6">
                <textarea
                  value={remarks}
                  onChange={(event) =>
                    setRemarks(
                      event.target.value
                    )
                  }
                  rows={5}
                  maxLength={1000}
                  placeholder="Contoh: Mohon dikirim bersama delivery besok pagi..."
                  className="w-full resize-none rounded-2xl border border-emerald-100 bg-[#FAFDFC] px-4 py-3.5 text-sm font-medium leading-6 text-emerald-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                />

                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[10px] font-semibold text-slate-400">
                    Catatan ini akan terlihat oleh
                    tim Gudang/Pusat.
                  </div>

                  <div className="text-[9px] font-medium text-slate-400">
                    {remarks.length}/1000
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT */}

          <aside className="xl:sticky xl:top-6 xl:h-fit">
            <div className="overflow-hidden rounded-[30px] border border-emerald-100 bg-white shadow-[0_22px_70px_rgba(6,78,59,0.09)]">

              {/* HEADER */}

              <div className="relative overflow-hidden border-b border-emerald-800/30 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 p-5 text-white md:p-6">
                <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-400/[0.08]" />
                <div className="absolute -bottom-24 left-1/3 h-44 w-44 rounded-full bg-teal-300/[0.05]" />

                <div className="relative flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 shadow-inner">
                    <ShoppingCart size={19} />
                  </div>

                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200/60">
                      Review Sebelum Submit
                    </div>

                    <h2 className="mt-1 text-base font-black">
                      Ringkasan Request
                    </h2>
                  </div>
                </div>

                <div className="relative mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-white/45">
                      Status Awal
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-sm font-black">
                      <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.6)]" />
                      PENDING
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/10 px-3 py-2 text-right">
                    <div className="text-[8px] font-bold uppercase tracking-wider text-white/45">
                      Item
                    </div>

                    <div className="mt-0.5 text-lg font-black">
                      {totalItems}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-6">

                <SummaryInfo
                  icon={<CalendarDays size={17} />}
                  label="Tanggal Delivery"
                  value={formatDateIndonesia(
                    deliveryDate
                  )}
                  description="Menjadi tanggal transaksi delivery."
                />

                <div className="mt-3">
                  <SummaryInfo
                    icon={<User size={17} />}
                    label="Customer"
                    value={
                      selectedCustomer?.name ||
                      "Customer belum terhubung"
                    }
                    description={
                      selectedCustomer?.code ||
                      "Belum tersedia"
                    }
                  />
                </div>

                <div className="mt-3">
                  <SummaryInfo
                    icon={<Store size={17} />}
                    label="Outlet Tujuan"
                    value={
                      selectedOutlet?.name ||
                      user?.outlet?.name ||
                      "Outlet belum tersedia"
                    }
                    description={
                      selectedOutlet?.code ||
                      user?.outlet?.code ||
                      "-"
                    }
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MiniStat
                    icon={<Boxes size={14} />}
                    label="Jenis Barang"
                    value={formatNumber(
                      totalItems
                    )}
                  />

                  <MiniStat
                    icon={<ShoppingCart size={14} />}
                    label="Total Qty"
                    value={formatNumber(
                      totalQty
                    )}
                  />
                </div>

                {warningItems > 0 && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                        <AlertTriangle size={16} />
                      </div>

                      <div>
                        <div className="text-xs font-black text-amber-800">
                          {warningItems} item stock kurang
                        </div>

                        <p className="mt-1 text-[10px] font-semibold leading-4 text-amber-700">
                          Ini tidak menghalangi
                          pembuatan request.
                          Validasi dilakukan oleh
                          Gudang Pusat saat proses
                          berikutnya.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {items.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-emerald-100 bg-[#FAFDFC] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">
                          Detail Barang
                        </div>

                        <div className="mt-1 text-[10px] font-medium text-slate-400">
                          Barang yang akan diminta
                        </div>
                      </div>

                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-black text-emerald-700">
                        {totalItems} Barang
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      {items.map(
                        (item, index) => {
                          const stock =
                            getStock(
                              item.barang
                            );

                          const stockWarning =
                            Number(
                              item.qty
                            ) > stock;

                          return (
                            <div
                              key={
                                item.barangId
                              }
                              className="rounded-xl border border-emerald-100 bg-white p-3"
                            >
                              <div className="flex items-start gap-2.5">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[8px] font-black text-emerald-700">
                                  {String(
                                    index +
                                      1
                                  ).padStart(
                                    2,
                                    "0"
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-[11px] font-black text-emerald-950">
                                    {getBarangName(
                                      item.barang
                                    )}
                                  </div>

                                  <div className="mt-0.5 text-[9px] font-semibold text-slate-400">
                                    {getBarangCode(
                                      item.barang
                                    )}
                                  </div>

                                  <div
                                    className={[
                                      "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-black",
                                      stockWarning
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-emerald-50 text-emerald-700",
                                    ].join(
                                      " "
                                    )}
                                  >
                                    {stockWarning ? (
                                      <AlertTriangle
                                        size={
                                          10
                                        }
                                      />
                                    ) : (
                                      <CheckCircle2
                                        size={
                                          10
                                        }
                                      />
                                    )}

                                    {stockWarning
                                      ? "Stock kurang"
                                      : "Tersedia"}
                                  </div>
                                </div>

                                <div className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-right">
                                  <div className="text-xs font-black text-emerald-700">
                                    {formatNumber(
                                      Number(
                                        item.qty
                                      )
                                    )}
                                  </div>

                                  <div className="text-[8px] font-bold uppercase text-slate-400">
                                    {getUnit(
                                      item.barang
                                    )}
                                  </div>
                                </div>
                              </div>

                              {item.note.trim() && (
                                <div className="mt-2 rounded-lg border border-emerald-50 bg-emerald-50/40 px-2.5 py-2">
                                  <div className="text-[8px] font-black uppercase tracking-[0.12em] text-emerald-700">
                                    Catatan
                                  </div>

                                  <div className="mt-1 line-clamp-3 text-[10px] font-semibold leading-4 text-slate-600">
                                    {item.note}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}

                <div className="my-6 border-t border-dashed border-emerald-100" />

                {/* FLOW */}

                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">
                        Workflow
                      </div>

                      <div className="mt-1 text-[10px] font-medium text-slate-400">
                        Alur Delivery Request
                      </div>
                    </div>

                    <div className="rounded-full bg-emerald-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-700">
                      1 / 5
                    </div>
                  </div>

                  <div className="mt-4 space-y-1">
                    <FlowStep
                      number="01"
                      icon={
                        <ClipboardList
                          size={15}
                        />
                      }
                      title="Request"
                      description={`Outlet membuat kebutuhan — ${formatDateIndonesia(
                        deliveryDate
                      )}`}
                      active
                    />

                    <FlowLine />

                    <FlowStep
                      number="02"
                      icon={
                        <FileCheck2
                          size={15}
                        />
                      }
                      title="Approval"
                      description="Pusat melakukan approval"
                    />

                    <FlowLine />

                    <FlowStep
                      number="03"
                      icon={
                        <Warehouse
                          size={15}
                        />
                      }
                      title="Process"
                      description="Pusat membuat Delivery Order"
                    />

                    <FlowLine />

                    <FlowStep
                      number="04"
                      icon={
                        <Truck size={15} />
                      }
                      title="Release"
                      description="Barang keluar dari Gudang Pusat"
                    />

                    <FlowLine />

                    <FlowStep
                      number="05"
                      icon={
                        <Store size={15} />
                      }
                      title="Barang Masuk"
                      description="Outlet menerima dan stock bertambah"
                    />
                  </div>
                </div>

                {/* BUSINESS RULE */}

                <div className="mt-6 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 to-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
                      <CheckCircle2 size={17} />
                    </div>

                    <div>
                      <div className="text-xs font-black text-emerald-950">
                        Business Rule
                      </div>

                      <p className="mt-1.5 text-[10px] font-semibold leading-5 text-slate-600">
                        Tanggal{" "}
                        <strong className="text-emerald-700">
                          {formatDateIndonesia(
                            deliveryDate
                          )}
                        </strong>{" "}
                        menjadi tanggal transaksi
                        delivery dan harus
                        dipertahankan sampai
                        barang diterima outlet.
                      </p>

                      <div className="my-3 border-t border-dashed border-emerald-100" />

                      <p className="text-[10px] font-semibold leading-5 text-slate-600">
                        Membuat Delivery Request{" "}
                        <strong className="text-emerald-950">
                          tidak mengurangi stock
                          Gudang Pusat.
                        </strong>{" "}
                        Request tetap dapat dibuat
                        walaupun stock kosong atau
                        belum mencukupi. Validasi
                        stock dilakukan saat
                        PROCESS / RELEASE.
                      </p>
                    </div>
                  </div>
                </div>

                {/* SECURITY */}

                <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-emerald-50/60 px-3.5 py-3">
                  <Check
                    size={14}
                    className="mt-0.5 shrink-0 text-emerald-600"
                  />

                  <div className="text-[9px] font-semibold leading-4 text-slate-500">
                    Request dibuat atas nama{" "}
                    <strong className="text-emerald-800">
                      {user?.fullname ||
                        user?.username ||
                        "user login"}
                    </strong>{" "}
                    dan customer mengikuti
                    akun tersebut.
                  </div>
                </div>

                {/* SUBMIT */}

                <button
                  type="button"
                  disabled={
                    submitting ||
                    !outletId ||
                    !customerId ||
                    !deliveryDate ||
                    items.length === 0
                  }
                  onClick={submitRequest}
                  className="group mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 px-5 py-4 text-sm font-black text-white shadow-[0_16px_35px_rgba(5,150,105,0.22)] transition hover:-translate-y-0.5 hover:from-emerald-800 hover:via-emerald-700 hover:to-teal-700 hover:shadow-[0_20px_45px_rgba(5,150,105,0.28)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-40"
                >
                  {submitting ? (
                    <>
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                      Mengirim Request...
                    </>
                  ) : (
                    <>
                      <Send
                        size={18}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                      Kirim Delivery Request
                      <ArrowRight
                        size={16}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </>
                  )}
                </button>

                <p className="mt-3 text-center text-[9px] font-semibold leading-4 text-slate-400">
                  Delivery dijadwalkan untuk{" "}
                  <strong className="text-slate-600">
                    {formatDateIndonesia(
                      deliveryDate
                    )}
                  </strong>
                  . Setelah dikirim, request
                  masuk status PENDING dan
                  menunggu approval Gudang/Pusat.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// HEADER BADGE
// ============================================================

function HeaderBadge({
  icon,
  text,
}: {
  icon: ReactNode;
  text: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 shadow-sm">
      <span className="text-emerald-600">
        {icon}
      </span>

      {text}
    </div>
  );
}

// ============================================================
// HERO METRIC
// ============================================================

function HeroMetric({
  icon,
  label,
  value,
  warning = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border px-4 py-3.5",
        warning
          ? "border-amber-200 bg-amber-50"
          : "border-emerald-100 bg-emerald-50/60",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span
          className={[
            "flex h-7 w-7 items-center justify-center rounded-lg",
            warning
              ? "bg-amber-100 text-amber-600"
              : "bg-white text-emerald-600",
          ].join(" ")}
        >
          {icon}
        </span>

        <span className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-500">
          {label}
        </span>
      </div>

      <div
        className={[
          "mt-2 text-lg font-black",
          warning
            ? "text-amber-700"
            : "text-emerald-950",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

// ============================================================
// IDENTITY CARD
// ============================================================

function IdentityCard({
  icon,
  label,
  value,
  meta,
  verified,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
  verified: boolean;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 transition hover:border-emerald-200 hover:bg-white hover:shadow-sm">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
          {label}
        </div>

        <div className="mt-1 truncate text-sm font-black text-emerald-950">
          {value}
        </div>

        <div className="mt-1 truncate text-[10px] font-semibold text-slate-400">
          {meta}
        </div>
      </div>

      <div
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
          verified
            ? "bg-emerald-100 text-emerald-600"
            : "bg-amber-100 text-amber-600",
        ].join(" ")}
      >
        {verified ? (
          <CheckCircle2 size={17} />
        ) : (
          <X size={16} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// SUMMARY INFO
// ============================================================

function SummaryInfo({
  icon,
  label,
  value,
  description,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
          {icon}
        </div>

        <div className="min-w-0">
          <div className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
            {label}
          </div>

          <div className="mt-1 truncate text-sm font-black text-emerald-950">
            {value}
          </div>

          <div className="mt-0.5 truncate text-[9px] font-semibold text-slate-400">
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MINI STAT
// ============================================================

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-emerald-600">
          {icon}
        </span>

        <div className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">
          {label}
        </div>
      </div>

      <div className="mt-1.5 text-lg font-black text-emerald-950">
        {value}
      </div>
    </div>
  );
}

// ============================================================
// SECTION HEADER
// ============================================================

function SectionHeader({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        {icon}
      </div>

      <div className="min-w-0">
        <div className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">
          {eyebrow}
        </div>

        <h2 className="mt-1 text-base font-black text-emerald-950">
          {title}
        </h2>

        <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// FLOW STEP
// ============================================================

function FlowStep({
  number,
  icon,
  title,
  description,
  active = false,
}: {
  number: string;
  icon: ReactNode;
  title: string;
  description: string;
  active?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={[
          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-black",
          active
            ? "bg-emerald-600 text-white shadow-[0_7px_18px_rgba(5,150,105,0.22)]"
            : "bg-emerald-50 text-slate-400",
        ].join(" ")}
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2">
          <span
            className={[
              "text-xs font-black",
              active
                ? "text-emerald-950"
                : "text-slate-600",
            ].join(" ")}
          >
            {title}
          </span>

          {active && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-700">
              Saat ini
            </span>
          )}
        </div>

        <div className="mt-0.5 text-[10px] font-medium leading-4 text-slate-400">
          {description}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FLOW LINE
// ============================================================

function FlowLine() {
  return (
    <div className="ml-[17px] h-3 border-l border-dashed border-emerald-200" />
  );
}

// ============================================================
// ALERT
// ============================================================

function Alert({
  type,
  message,
}: {
  type: "error" | "success";
  message: string;
}) {
  const isError = type === "error";

  return (
    <div
      className={[
        "flex items-start gap-3 rounded-2xl border px-4 py-4 text-sm font-semibold shadow-sm",
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
          isError
            ? "bg-red-100"
            : "bg-white",
        ].join(" ")}
      >
        {isError ? (
          <X size={17} />
        ) : (
          <CheckCircle2 size={17} />
        )}
      </div>

      <div className="pt-1">
        {message}
      </div>
    </div>
  );
}