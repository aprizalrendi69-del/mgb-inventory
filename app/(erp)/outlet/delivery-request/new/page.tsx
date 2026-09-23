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
    barang.satuanTransaksi ||
    barang.unit ||
    barang.satuan ||
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
  // TANGGAL DELIVERY / TRANSAKSI
  // ==========================================================

  const [deliveryDate, setDeliveryDate] = useState(getTodayDate());

  const [remarks, setRemarks] = useState("");

  const [search, setSearch] = useState("");

  const [showBarangDropdown, setShowBarangDropdown] =
    useState(false);

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
  // CUSTOMER DARI USER LOGIN
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

      const [meRes, outletRes, barangRes] = await Promise.all([
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
        throw new Error("Gagal mengambil data user.");
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

      // ========================================================
      // NORMALIZE OUTLET
      // ========================================================

      const normalizedOutlets: Outlet[] =
        Array.isArray(outletData)
          ? outletData
          : Array.isArray(outletData?.outlets)
          ? outletData.outlets
          : Array.isArray(outletData?.data)
          ? outletData.data
          : [];

      // ========================================================
      // NORMALIZE BARANG
      // ========================================================

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

      // ========================================================
      // OUTLET ADMIN
      // ========================================================

      if (currentUser?.outletId) {
        setOutletId(Number(currentUser.outletId));
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
    const keyword = search.trim().toLowerCase();

    const availableBarang = barangList.filter(
      (barang) =>
        !items.some(
          (item) =>
            Number(item.barangId) === Number(barang.id)
        )
    );

    if (!keyword) {
      return availableBarang.slice(0, 12);
    }

    return availableBarang
      .filter((barang) => {
        const name = getBarangName(barang).toLowerCase();
        const code = getBarangCode(barang).toLowerCase();

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
  // ADD BARANG
  // ==========================================================

  function addBarang(barang: Barang) {
    setError("");

    const existing = items.find(
      (item) => item.barangId === barang.id
    );

    if (existing) {
      setItems((current) =>
        current.map((item) =>
          item.barangId === barang.id
            ? {
                ...item,
                qty: Number(item.qty) + 1,
              }
            : item
        )
      );
    } else {
      setItems((current) => [
        ...current,
        {
          barangId: barang.id,
          barang,
          qty: 1,
          note: "",
        },
      ]);
    }

    setSearch("");
    setShowBarangDropdown(false);
  }

  // ==========================================================
  // UPDATE QTY
  // ==========================================================

  function updateQty(
    barangId: number,
    value: string
  ) {
    const numericValue = Number(value);

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
  // UPDATE CATATAN PER BARANG
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

      // ======================================================
      // SECURITY FRONTEND
      // ======================================================

      if (!isOutletAdmin) {
        setError(
          "Hanya ADMIN OUTLET yang dapat membuat Delivery Request."
        );
        return;
      }

      if (!outletId) {
        setError("Outlet user belum tersedia.");
        return;
      }

      if (!customerId) {
        setError(
          "Customer belum terhubung dengan user yang sedang login."
        );
        return;
      }

      // ======================================================
      // VALIDASI TANGGAL DELIVERY
      // ======================================================

      if (!deliveryDate) {
        setError(
          "Tanggal Delivery wajib dipilih."
        );
        return;
      }

      if (!items.length) {
        setError(
          "Minimal pilih 1 barang."
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

      // ======================================================
      // STOCK PUSAT BUKAN SYARAT REQUEST
      // ======================================================
      //
      // Request tetap boleh dibuat walaupun:
      // - stock = 0
      // - stock kurang dari qty request
      // - qty request melebihi stock pusat
      //
      // Stock menjadi validasi saat PROCESS / RELEASE.
      //
      // ======================================================

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
      <main className="min-h-screen bg-[#F4F7F5] px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex min-h-[720px] items-center justify-center">
            <div className="relative overflow-hidden rounded-[28px] border border-[#DCE8E2] bg-white px-8 py-6 shadow-[0_20px_60px_rgba(24,53,45,0.08)]">
              <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#EEF6F3]" />

              <div className="relative flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF4EF]">
                  <Loader2
                    size={21}
                    className="animate-spin text-[#497F70]"
                  />
                </div>

                <div>
                  <div className="text-sm font-black text-[#24332E]">
                    Memuat Delivery Request
                  </div>

                  <div className="mt-1 text-xs font-medium text-[#8A9791]">
                    Menyiapkan data outlet,
                    customer, dan Master Barang...
                  </div>
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
      <main className="min-h-screen bg-[#F4F7F5] px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto flex min-h-[720px] max-w-2xl items-center justify-center">
          <div className="w-full overflow-hidden rounded-[30px] border border-[#DCE8E2] bg-white shadow-[0_25px_70px_rgba(35,65,52,0.10)]">
            <div className="relative overflow-hidden bg-[#18352D] px-6 py-12 text-center text-white md:px-10">
              <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/[0.06]" />
              <div className="absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-white/[0.04]" />

              <div className="relative">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
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
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#497F70] px-5 py-3.5 text-sm font-black text-white shadow-[0_10px_25px_rgba(73,127,112,0.18)] transition hover:-translate-y-0.5 hover:bg-[#3D6D60]"
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
    <main className="min-h-screen bg-[#F4F7F5] px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-[1600px] space-y-6">

        {/* ====================================================
            TOP ACCENT
        ==================================================== */}

        <div className="h-1 w-full overflow-hidden rounded-full bg-[#DCE8E2]">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#497F70] via-[#5F9383] to-[#8BB7A7]" />
        </div>

        {/* ====================================================
            BREADCRUMB
        ==================================================== */}

        <div className="flex flex-wrap items-center gap-2 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#899690]">
          <button
            type="button"
            onClick={() => router.back()}
            className="transition hover:text-[#497F70]"
          >
            Outlet
          </button>

          <span className="text-[#C1CCC6]">/</span>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/outlet/delivery-request"
              )
            }
            className="transition hover:text-[#497F70]"
          >
            Delivery Request
          </button>

          <span className="text-[#C1CCC6]">/</span>

          <span className="text-[#497F70]">
            Buat Baru
          </span>
        </div>

        {/* ====================================================
            HERO
        ==================================================== */}

        <section className="relative overflow-hidden rounded-[30px] border border-[#DCE8E2] bg-white shadow-[0_18px_55px_rgba(24,53,45,0.07)]">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full bg-[#EEF6F3]" />
            <div className="absolute -bottom-48 right-[18%] h-[380px] w-[380px] rounded-full bg-[#F5FAF8]" />
            <div className="absolute -left-32 bottom-[-180px] h-[360px] w-[360px] rounded-full bg-[#F8FBF9]" />
          </div>

          <div className="relative p-6 md:p-8 lg:p-10">
            <button
              type="button"
              onClick={() => router.back()}
              className="group inline-flex items-center gap-2 rounded-xl border border-[#DCE8E2] bg-white px-4 py-2.5 text-xs font-black text-[#53645D] shadow-sm transition hover:-translate-x-0.5 hover:border-[#C4D8CF] hover:bg-[#F8FBF9] hover:text-[#497F70]"
            >
              <ArrowLeft
                size={16}
                className="transition-transform group-hover:-translate-x-0.5"
              />
              Kembali
            </button>

            <div className="mt-7 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#DCE8E2] bg-[#F2F8F5] px-3.5 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-[#497F70]">
                  <Sparkles size={13} />
                  Outlet Supply Request
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-[-0.035em] text-[#18352D] md:text-4xl lg:text-[46px]">
                  Buat Delivery Request
                </h1>

                <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[#74827C] md:text-base">
                  Ajukan kebutuhan barang outlet
                  ke Gudang Pusat. Outlet dan
                  customer otomatis mengikuti akun
                  user yang sedang login.
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
                    text="Stock pusat belum berubah"
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
                  label="Perlu Diproses"
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

        {/* ====================================================
            ALERT
        ==================================================== */}

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

        {/* ====================================================
            MAIN GRID
        ==================================================== */}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">

          {/* ==================================================
              LEFT
          ================================================== */}

          <div className="min-w-0 space-y-6">

            {/* =================================================
                IDENTITAS
            ================================================= */}

            <section className="rounded-[26px] border border-[#DCE8E2] bg-white p-5 shadow-[0_10px_32px_rgba(24,53,45,0.045)] md:p-6">
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

            {/* =================================================
                TANGGAL
            ================================================= */}

            <section className="rounded-[26px] border border-[#DCE8E2] bg-white p-5 shadow-[0_10px_32px_rgba(24,53,45,0.045)] md:p-6">
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
                    className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-[#899690]"
                  >
                    Tanggal Delivery / Transaksi
                  </label>

                  <div className="group flex items-center rounded-2xl border border-[#DCE8E2] bg-[#FAFCFB] px-4 transition focus-within:border-[#497F70] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#497F70]/10">
                    <CalendarDays
                      size={18}
                      className="shrink-0 text-[#497F70]"
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
                      className="w-full bg-transparent px-3 py-3.5 text-sm font-bold text-[#293832] outline-none"
                    />
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-[#8A9791]">
                    <CheckCircle2
                      size={13}
                      className="text-[#497F70]"
                    />
                    Dipilih:
                    <span className="font-black text-[#497F70]">
                      {formatDateIndonesia(
                        deliveryDate
                      )}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#DCE8E2] bg-[#F7FAF8] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8F2ED] text-[#497F70]">
                      <Truck size={18} />
                    </div>

                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.15em] text-[#899690]">
                        Tanggal Transaksi
                      </div>

                      <div className="mt-1 text-sm font-black text-[#293832]">
                        {formatDateIndonesia(
                          deliveryDate
                        )}
                      </div>

                      <p className="mt-1 text-[10px] font-semibold leading-4 text-[#899690]">
                        Tanggal ini mengikuti
                        request sampai release
                        dan penerimaan outlet.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* =================================================
                BARANG
            ================================================= */}

            <section className="rounded-[26px] border border-[#DCE8E2] bg-white p-5 shadow-[0_10px_32px_rgba(24,53,45,0.045)] md:p-6">
              <SectionHeader
                icon={<Boxes size={20} />}
                eyebrow="03 · ITEM REQUEST"
                title="Barang yang Diminta"
                description="Pilih barang dari Master Barang Pusat lalu tentukan jumlah dan catatan khusus."
              />

              {/* SEARCH */}
              <div className="relative mt-6">
                <div className="flex items-center rounded-2xl border border-[#DCE8E2] bg-[#FAFCFB] px-4 transition focus-within:border-[#497F70] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#497F70]/10">
                  <Search
                    size={18}
                    className="shrink-0 text-[#8A9993]"
                  />

                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(
                        event.target.value
                      );

                      setShowBarangDropdown(true);
                    }}
                    onFocus={() =>
                      setShowBarangDropdown(true)
                    }
                    placeholder="Cari kode atau nama barang..."
                    className="w-full bg-transparent px-3 py-3.5 text-sm font-semibold text-[#263630] outline-none placeholder:text-[#9BA7A2]"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setShowBarangDropdown(false);
                      }}
                      className="rounded-lg p-1.5 text-[#899790] transition hover:bg-[#EFF3F1] hover:text-[#364840]"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* DROPDOWN */}
                {showBarangDropdown && (
                  <>
                    <button
                      type="button"
                      aria-label="Tutup daftar barang"
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() =>
                        setShowBarangDropdown(false)
                      }
                    />

                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-[430px] overflow-y-auto rounded-2xl border border-[#DCE8E2] bg-white p-2 shadow-[0_28px_70px_rgba(24,53,45,0.16)]">
                      <div className="sticky top-0 z-10 mb-1 flex items-center justify-between border-b border-[#EEF2F0] bg-white px-3 py-2.5">
                        <div>
                          <div className="text-[9px] font-black uppercase tracking-[0.15em] text-[#8A9791]">
                            Master Barang
                          </div>

                          <div className="mt-0.5 text-[10px] font-semibold text-[#A0AAA5]">
                            Pilih barang untuk request
                          </div>
                        </div>

                        <span className="rounded-full bg-[#EFF7F3] px-2.5 py-1 text-[9px] font-black text-[#497F70]">
                          {filteredBarang.length} tersedia
                        </span>
                      </div>

                      {filteredBarang.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFF7F3] text-[#8EA09A]">
                            <Package size={23} />
                          </div>

                          <p className="mt-3 text-sm font-black text-[#697871]">
                            Barang tidak ditemukan
                          </p>

                          <p className="mt-1 text-xs font-medium text-[#9AA59F]">
                            Coba gunakan nama atau kode
                            barang lainnya.
                          </p>
                        </div>
                      ) : (
                        filteredBarang.map(
                          (barang) => {
                            const stock =
                              getStock(barang);

                            return (
                              <button
                                key={barang.id}
                                type="button"
                                onClick={() =>
                                  addBarang(barang)
                                }
                                className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-[#F1F7F4]"
                              >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF7F3] text-[#497F70] transition group-hover:bg-[#E4F1EB]">
                                  <Package size={18} />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-black text-[#293832]">
                                    {getBarangName(
                                      barang
                                    )}
                                  </div>

                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-[#84918B]">
                                    <span>
                                      {getBarangCode(
                                        barang
                                      )}
                                    </span>

                                    <span className="text-[#C1CCC6]">
                                      •
                                    </span>

                                    <span>
                                      {getUnit(
                                        barang
                                      )}
                                    </span>
                                  </div>
                                </div>

                                <div className="shrink-0 rounded-xl border border-[#E0E9E4] bg-[#F8FBF9] px-3 py-2 text-right">
                                  <div className="text-[8px] font-black uppercase tracking-wider text-[#98A49E]">
                                    Stock Pusat
                                  </div>

                                  <div
                                    className={[
                                      "mt-0.5 text-xs font-black",
                                      stock > 0
                                        ? "text-[#497F70]"
                                        : "text-red-500",
                                    ].join(" ")}
                                  >
                                    {formatNumber(
                                      stock
                                    )}{" "}
                                    {getUnit(
                                      barang
                                    )}
                                  </div>
                                </div>

                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F0F6F3] text-[#497F70] transition group-hover:bg-[#497F70] group-hover:text-white">
                                  <Plus size={17} />
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

              {/* ITEM LIST */}
              <div className="mt-5 space-y-3">
                {items.length === 0 ? (
                  <div className="relative overflow-hidden rounded-[22px] border border-dashed border-[#C9D9D1] bg-[#FAFCFB] px-6 py-16 text-center">
                    <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#F0F7F3]" />
                    <div className="absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-[#F6FAF8]" />

                    <div className="relative">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EFF7F3] text-[#497F70] shadow-sm">
                        <ShoppingCart size={27} />
                      </div>

                      <h3 className="mt-5 text-sm font-black text-[#35453E]">
                        Belum ada barang
                      </h3>

                      <p className="mx-auto mt-2 max-w-sm text-xs font-medium leading-5 text-[#8A9791]">
                        Gunakan kolom pencarian
                        di atas untuk memilih
                        barang yang akan diminta
                        dari Gudang Pusat.
                      </p>

                      <div className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#EFF7F3] px-3 py-1.5 text-[9px] font-black text-[#497F70]">
                        <Search size={11} />
                        Cari barang di atas
                      </div>
                    </div>
                  </div>
                ) : (
                  items.map(
                    (item, index) => {
                      const stock =
                        getStock(item.barang);

                      const qty =
                        Number(
                          item.qty || 0
                        );

                      const stockWarning =
                        qty > stock;

                      const stockPercent =
                        stock > 0
                          ? Math.min(
                              100,
                              (qty /
                                stock) *
                                100
                            )
                          : 100;

                      return (
                        <div
                          key={
                            item.barangId
                          }
                          className="group rounded-[22px] border border-[#E0E9E4] bg-[#FCFDFC] p-4 transition hover:border-[#C9DCD3] hover:bg-white hover:shadow-[0_8px_28px_rgba(24,53,45,0.045)] md:p-5"
                        >
                          {/* ITEM HEADER */}

                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF7F3] text-[10px] font-black text-[#497F70]">
                              {String(
                                index + 1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-black text-[#293832] md:text-[15px]">
                                {getBarangName(
                                  item.barang
                                )}
                              </div>

                              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-[#89958F]">
                                <span className="rounded-md bg-[#F0F4F2] px-1.5 py-1">
                                  {getBarangCode(
                                    item.barang
                                  )}
                                </span>

                                <span className="text-[#C4CEC9]">
                                  •
                                </span>

                                <span>
                                  Satuan:{" "}
                                  {getUnit(
                                    item.barang
                                  )}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                removeItem(
                                  item.barangId
                                )
                              }
                              className="rounded-xl p-2 text-[#A0AAA5] transition hover:bg-red-50 hover:text-red-600"
                              aria-label={`Hapus ${getBarangName(
                                item.barang
                              )}`}
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>

                          {/* QTY / STOCK */}

                          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                            <div
                              className={[
                                "rounded-2xl border p-4",
                                stockWarning
                                  ? "border-amber-200 bg-amber-50"
                                  : "border-[#DCE8E2] bg-white",
                              ].join(" ")}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                  <div className="text-[9px] font-black uppercase tracking-[0.15em] text-[#89958F]">
                                    Stock Gudang Pusat
                                  </div>

                                  <div
                                    className={[
                                      "mt-1 text-base font-black",
                                      stockWarning
                                        ? "text-amber-600"
                                        : "text-[#497F70]",
                                    ].join(" ")}
                                  >
                                    {formatNumber(
                                      stock
                                    )}{" "}
                                    <span className="text-xs">
                                      {getUnit(
                                        item.barang
                                      )}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="text-[9px] font-black uppercase tracking-[0.15em] text-[#89958F]">
                                    Qty Request
                                  </div>

                                  <div
                                    className={[
                                      "mt-1 text-base font-black",
                                      stockWarning
                                        ? "text-amber-600"
                                        : "text-[#293832]",
                                    ].join(" ")}
                                  >
                                    {formatNumber(
                                      qty
                                    )}{" "}
                                    <span className="text-xs">
                                      {getUnit(
                                        item.barang
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* STOCK BAR */}

                              <div className="mt-4">
                                <div className="mb-1.5 flex items-center justify-between text-[8px] font-bold uppercase tracking-wider text-[#9AA59F]">
                                  <span>
                                    Referensi stock
                                  </span>

                                  <span>
                                    {stockWarning
                                      ? "Qty > Stock"
                                      : "Dalam batas stock"}
                                  </span>
                                </div>

                                <div className="h-1.5 overflow-hidden rounded-full bg-[#E9EFEC]">
                                  <div
                                    className={[
                                      "h-full rounded-full transition-all",
                                      stockWarning
                                        ? "bg-amber-400"
                                        : "bg-[#497F70]",
                                    ].join(" ")}
                                    style={{
                                      width: `${Math.max(
                                        4,
                                        Math.min(
                                          100,
                                          stockPercent
                                        )
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              {stockWarning && (
                                <div className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-[10px] font-bold leading-4 text-amber-700">
                                  Stock pusat saat ini
                                  tidak mencukupi qty
                                  request. Request
                                  tetap dapat dikirim.
                                  Validasi stock dilakukan
                                  Gudang Pusat saat
                                  PROCESS / RELEASE.
                                </div>
                              )}

                              {!stockWarning && (
                                <div className="mt-3 flex items-center gap-1.5 text-[9px] font-semibold text-[#8B9892]">
                                  <Info
                                    size={12}
                                    className="text-[#497F70]"
                                  />
                                  Stock hanya sebagai
                                  informasi pada tahap
                                  request.
                                </div>
                              )}
                            </div>

                            {/* QTY CONTROL */}

                            <div className="flex items-center justify-center rounded-2xl border border-[#DCE8E2] bg-white p-1">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQty(
                                    item.barangId,
                                    String(
                                      Math.max(
                                        0,
                                        qty - 1
                                      )
                                    )
                                  )
                                }
                                className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-black text-[#497F70] transition hover:bg-[#EFF7F3]"
                                aria-label="Kurangi qty"
                              >
                                −
                              </button>

                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.qty}
                                onChange={(
                                  event
                                ) =>
                                  updateQty(
                                    item.barangId,
                                    event.target.value
                                  )
                                }
                                className="h-11 w-20 border-x border-[#E3EAE6] bg-transparent text-center text-sm font-black text-[#293832] outline-none"
                                aria-label={`Qty ${getBarangName(
                                  item.barang
                                )}`}
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  updateQty(
                                    item.barangId,
                                    String(
                                      qty + 1
                                    )
                                  )
                                }
                                className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-black text-[#497F70] transition hover:bg-[#EFF7F3]"
                                aria-label="Tambah qty"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* NOTE */}

                          <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between">
                              <label
                                htmlFor={`item-note-${item.barangId}`}
                                className="text-[9px] font-black uppercase tracking-[0.15em] text-[#89958F]"
                              >
                                Catatan Barang
                              </label>

                              <span className="text-[9px] font-medium text-[#A0AAA5]">
                                {item.note.length}/500
                              </span>
                            </div>

                            <textarea
                              id={`item-note-${item.barangId}`}
                              value={item.note}
                              onChange={(
                                event
                              ) =>
                                updateItemNote(
                                  item.barangId,
                                  event.target.value
                                )
                              }
                              rows={2}
                              maxLength={500}
                              placeholder={`Contoh: Packing terpisah, kebutuhan event, atau permintaan khusus ${getBarangName(
                                item.barang
                              )}...`}
                              className="w-full resize-none rounded-xl border border-[#DCE8E2] bg-white px-3.5 py-3 text-xs font-medium leading-5 text-[#293832] outline-none transition placeholder:text-[#A0AAA5] focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                            />
                          </div>
                        </div>
                      );
                    }
                  )
                )}
              </div>
            </section>

            {/* =================================================
                CATATAN REQUEST
            ================================================= */}

            <section className="rounded-[26px] border border-[#DCE8E2] bg-white p-5 shadow-[0_10px_32px_rgba(24,53,45,0.045)] md:p-6">
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
                  className="w-full resize-none rounded-2xl border border-[#DCE8E2] bg-[#FAFCFB] px-4 py-3.5 text-sm font-medium leading-6 text-[#293832] outline-none transition placeholder:text-[#9BA7A2] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                />

                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[10px] font-semibold text-[#9AA59F]">
                    Catatan ini akan terlihat oleh
                    tim Gudang/Pusat.
                  </div>

                  <div className="text-[9px] font-medium text-[#A0AAA5]">
                    {remarks.length}/1000
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ==================================================
              RIGHT SUMMARY
          ================================================== */}

          <aside className="xl:sticky xl:top-6 xl:h-fit">
            <div className="overflow-hidden rounded-[28px] border border-[#DCE8E2] bg-white shadow-[0_18px_55px_rgba(24,53,45,0.075)]">

              {/* SUMMARY HEADER */}

              <div className="relative overflow-hidden border-b border-[#E5ECE8] bg-[#18352D] p-5 text-white md:p-6">
                <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/[0.06]" />
                <div className="absolute -bottom-24 left-1/3 h-44 w-44 rounded-full bg-white/[0.035]" />

                <div className="relative flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                    <ShoppingCart size={19} />
                  </div>

                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/50">
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
                      <span className="h-2 w-2 rounded-full bg-amber-300" />
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

                {/* DATE */}

                <SummaryInfo
                  icon={<CalendarDays size={17} />}
                  label="Tanggal Delivery"
                  value={formatDateIndonesia(
                    deliveryDate
                  )}
                  description="Menjadi tanggal transaksi delivery."
                />

                {/* CUSTOMER */}

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

                {/* OUTLET */}

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

                {/* KPI */}

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

                {/* WARNING */}

                {warningItems > 0 && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                        <Info size={16} />
                      </div>

                      <div>
                        <div className="text-xs font-black text-amber-800">
                          {warningItems} item melebihi
                          stock saat ini
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

                {/* ITEM DETAIL */}

                {items.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-[#DCE8E2] bg-[#FAFCFB] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8A9791]">
                          Detail Barang
                        </div>

                        <div className="mt-1 text-[10px] font-medium text-[#9AA59F]">
                          Barang yang akan diminta
                        </div>
                      </div>

                      <span className="rounded-full bg-[#E8F3ED] px-2.5 py-1 text-[9px] font-black text-[#497F70]">
                        {totalItems} Barang
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      {items.map(
                        (item, index) => (
                          <div
                            key={
                              item.barangId
                            }
                            className="rounded-xl border border-[#E8EEEB] bg-white p-3"
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EFF7F3] text-[8px] font-black text-[#497F70]">
                                {String(
                                  index + 1
                                ).padStart(
                                  2,
                                  "0"
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[11px] font-black text-[#35453E]">
                                  {getBarangName(
                                    item.barang
                                  )}
                                </div>

                                <div className="mt-0.5 text-[9px] font-semibold text-[#929D98]">
                                  {getBarangCode(
                                    item.barang
                                  )}
                                </div>
                              </div>

                              <div className="shrink-0 rounded-lg bg-[#EFF7F3] px-2.5 py-1.5 text-right">
                                <div className="text-xs font-black text-[#497F70]">
                                  {formatNumber(
                                    Number(
                                      item.qty
                                    )
                                  )}
                                </div>

                                <div className="text-[8px] font-bold uppercase text-[#8A9791]">
                                  {getUnit(
                                    item.barang
                                  )}
                                </div>
                              </div>
                            </div>

                            {item.note.trim() && (
                              <div className="mt-2 rounded-lg border border-[#E4ECE7] bg-[#F8FBF9] px-2.5 py-2">
                                <div className="text-[8px] font-black uppercase tracking-[0.12em] text-[#8A9791]">
                                  Catatan
                                </div>

                                <div className="mt-1 line-clamp-3 text-[10px] font-semibold leading-4 text-[#66756E]">
                                  {item.note}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* DIVIDER */}

                <div className="my-6 border-t border-dashed border-[#DCE5E0]" />

                {/* FLOW */}

                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8A9791]">
                        Workflow
                      </div>

                      <div className="mt-1 text-[10px] font-medium text-[#A0AAA5]">
                        Alur Delivery Request
                      </div>
                    </div>

                    <div className="rounded-full bg-[#EFF7F3] px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-[#497F70]">
                      1 / 5
                    </div>
                  </div>

                  <div className="mt-4 space-y-1">
                    <FlowStep
                      number="01"
                      icon={<ClipboardList size={15} />}
                      title="Request"
                      description={`Outlet membuat kebutuhan — ${formatDateIndonesia(
                        deliveryDate
                      )}`}
                      active
                    />

                    <FlowLine />

                    <FlowStep
                      number="02"
                      icon={<FileCheck2 size={15} />}
                      title="Approval"
                      description="Pusat melakukan approval"
                    />

                    <FlowLine />

                    <FlowStep
                      number="03"
                      icon={<Warehouse size={15} />}
                      title="Process"
                      description="Pusat membuat Delivery Order"
                    />

                    <FlowLine />

                    <FlowStep
                      number="04"
                      icon={<Truck size={15} />}
                      title="Release"
                      description="Barang keluar dari Gudang Pusat"
                    />

                    <FlowLine />

                    <FlowStep
                      number="05"
                      icon={<Store size={15} />}
                      title="Barang Masuk"
                      description="Outlet menerima dan stock bertambah"
                    />
                  </div>
                </div>

                {/* BUSINESS RULE */}

                <div className="mt-6 rounded-2xl border border-[#DCE8E2] bg-[#FAFCFB] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E8F2ED] text-[#497F70]">
                      <CheckCircle2 size={17} />
                    </div>

                    <div>
                      <div className="text-xs font-black text-[#35453E]">
                        Business Rule
                      </div>

                      <p className="mt-1.5 text-[10px] font-semibold leading-5 text-[#687770]">
                        Tanggal{" "}
                        <strong className="text-[#497F70]">
                          {formatDateIndonesia(
                            deliveryDate
                          )}
                        </strong>{" "}
                        menjadi tanggal transaksi
                        delivery dan harus
                        dipertahankan sampai
                        barang diterima outlet.
                      </p>

                      <div className="my-3 border-t border-dashed border-[#DCE5E0]" />

                      <p className="text-[10px] font-semibold leading-5 text-[#687770]">
                        Membuat Delivery Request{" "}
                        <strong className="text-[#35453E]">
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

                <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-[#F7FAF8] px-3.5 py-3">
                  <Check
                    size={14}
                    className="mt-0.5 shrink-0 text-[#497F70]"
                  />

                  <div className="text-[9px] font-semibold leading-4 text-[#899690]">
                    Request dibuat atas nama{" "}
                    <strong className="text-[#53645D]">
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
                  className="group mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#497F70] px-5 py-4 text-sm font-black text-white shadow-[0_14px_32px_rgba(73,127,112,0.22)] transition hover:-translate-y-0.5 hover:bg-[#3D6D60] hover:shadow-[0_18px_40px_rgba(73,127,112,0.28)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50"
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

                <p className="mt-3 text-center text-[9px] font-semibold leading-4 text-[#9AA59F]">
                  Delivery dijadwalkan untuk{" "}
                  <strong className="text-[#687770]">
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
    <div className="inline-flex items-center gap-2 rounded-xl border border-[#DCE8E2] bg-white px-3 py-2 text-[10px] font-bold text-[#62716B] shadow-sm">
      <span className="text-[#497F70]">
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
          : "border-[#DCE8E2] bg-[#F8FBF9]",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span
          className={[
            "flex h-7 w-7 items-center justify-center rounded-lg",
            warning
              ? "bg-amber-100 text-amber-600"
              : "bg-[#E8F2ED] text-[#497F70]",
          ].join(" ")}
        >
          {icon}
        </span>

        <span className="text-[8px] font-black uppercase tracking-[0.13em] text-[#899690]">
          {label}
        </span>
      </div>

      <div
        className={[
          "mt-2 text-lg font-black",
          warning
            ? "text-amber-600"
            : "text-[#24332E]",
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
    <div className="group flex items-center gap-3 rounded-2xl border border-[#DCE8E2] bg-[#F8FBF9] p-4 transition hover:border-[#C9DCD3] hover:bg-white">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E8F2ED] text-[#497F70]">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8A9791]">
          {label}
        </div>

        <div className="mt-1 truncate text-sm font-black text-[#293832]">
          {value}
        </div>

        <div className="mt-1 truncate text-[10px] font-semibold text-[#8A9791]">
          {meta}
        </div>
      </div>

      <div
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
          verified
            ? "bg-[#E8F3ED] text-[#497F70]"
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
    <div className="rounded-2xl border border-[#DCE8E2] bg-[#F7FAF8] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E8F2ED] text-[#497F70]">
          {icon}
        </div>

        <div className="min-w-0">
          <div className="text-[9px] font-black uppercase tracking-[0.15em] text-[#8A9791]">
            {label}
          </div>

          <div className="mt-1 truncate text-sm font-black text-[#293832]">
            {value}
          </div>

          <div className="mt-0.5 truncate text-[9px] font-semibold text-[#929D98]">
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
    <div className="rounded-2xl border border-[#E2EAE5] bg-white p-3.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[#497F70]">
          {icon}
        </span>

        <div className="text-[8px] font-black uppercase tracking-[0.12em] text-[#909C96]">
          {label}
        </div>
      </div>

      <div className="mt-1.5 text-lg font-black text-[#293832]">
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
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EFF7F3] text-[#497F70]">
        {icon}
      </div>

      <div className="min-w-0">
        <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#497F70]">
          {eyebrow}
        </div>

        <h2 className="mt-1 text-base font-black text-[#24332E]">
          {title}
        </h2>

        <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-[#7B8A84]">
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
            ? "bg-[#497F70] text-white shadow-[0_7px_18px_rgba(73,127,112,0.20)]"
            : "bg-[#EEF3F0] text-[#7D8A84]",
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
                ? "text-[#293832]"
                : "text-[#697771]",
            ].join(" ")}
          >
            {title}
          </span>

          {active && (
            <span className="rounded-full bg-[#E8F3ED] px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#497F70]">
              Saat ini
            </span>
          )}
        </div>

        <div className="mt-0.5 text-[10px] font-medium leading-4 text-[#929D98]">
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
    <div className="ml-[17px] h-3 border-l border-dashed border-[#D4DFD9]" />
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
            : "bg-emerald-100",
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