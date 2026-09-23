"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  RefreshCw,
  ShoppingCart,
  Eye,
  ChevronDown,
  CreditCard,
  Store,
  Truck,
  Package,
  CheckCircle2,
  Clock3,
  CircleDollarSign,
  FileText,
  Sparkles,
  ArrowUpRight,
  CalendarDays,
  Database,
  RotateCcw,
  WalletCards,
} from "lucide-react";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Supplier = {
  id: number;
  code: string;
  name: string;
};

type Barang = {
  id: number;
  code: string;
  name: string;
  unit: string;
};

type PurchaseItem = {
  id: number;
  barangId: number;
  qty: number;
  receivedQty?: number;
  price: number;
  subtotal: number;
  barang: Barang;
};

type OutletPurchase = {
  id: number;
  number: string;
  outletId: number;
  supplierId: number;
  total: number;

  status:
    | "DRAFT"
    | "APPROVED"
    | "RECEIVED";

  paymentMethod?: string | null;

  purchaseDate?: string;

  createdAt?: string;

  remarks: string | null;

  outlet: Outlet;
  supplier: Supplier;
  items: PurchaseItem[];
};

type UserInfo = {
  id: number;
  fullname?: string;
  role: string;
  outletId?: number | null;
};

export default function OutletPurchasePage() {
  const router = useRouter();

  // =====================================================
  // DATA
  // =====================================================

  const [data, setData] =
    useState<OutletPurchase[]>([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  // =====================================================
  // FILTER
  // =====================================================

  const [selectedOutlet, setSelectedOutlet] =
    useState<string>("ALL");

  const [tanggalMulai, setTanggalMulai] =
    useState("");

  const [tanggalSelesai, setTanggalSelesai] =
    useState("");

  // =====================================================
  // USER
  // =====================================================

  const [user, setUser] =
    useState<UserInfo | null>(null);

  const [loadingUser, setLoadingUser] =
    useState(true);

  // =====================================================
  // LOAD USER
  // =====================================================

  async function loadUser() {
    try {
      setLoadingUser(true);

      const res = await fetch(
        "/api/me",
        {
          cache: "no-store",
        }
      );

      const json =
        await res.json();

      if (!res.ok) {
        setUser(null);
        return;
      }

      const currentUser =
        json?.user ??
        json?.data ??
        json;

      if (currentUser?.id) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error(
        "LOAD CURRENT USER ERROR:",
        error
      );

      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }

  // =====================================================
  // LOAD PURCHASE
  // =====================================================

  async function loadPurchase() {
    try {
      setLoading(true);

      const res =
        await fetch(
          "/api/outlet/purchase",
          {
            cache: "no-store",
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
            "Gagal mengambil Purchase Outlet"
        );
      }

      setData(
        Array.isArray(
          json.data
        )
          ? json.data
          : []
      );
    } catch (error) {
      console.error(
        "LOAD OUTLET PURCHASE ERROR:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    loadUser();
    loadPurchase();
  }, []);

  // =====================================================
  // ROLE
  // =====================================================

  const role =
    String(
      user?.role || ""
    ).toUpperCase();

  /**
   * ADMIN = ADMIN PUSAT
   *
   * Hanya role ini yang boleh
   * melihat tombol Payment.
   */
  const isAdminPusat =
    role === "ADMIN";

  // =====================================================
  // DAFTAR OUTLET
  // =====================================================

  const outletOptions =
    useMemo(() => {
      const map =
        new Map<
          number,
          Outlet
        >();

      data.forEach(
        (item) => {
          if (!item.outlet) {
            return;
          }

          if (
            !map.has(
              item.outlet.id
            )
          ) {
            map.set(
              item.outlet.id,
              item.outlet
            );
          }
        }
      );

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          a.name.localeCompare(
            b.name
          )
      );
    }, [data]);

  // =====================================================
  // FILTER DATA
  // =====================================================

  const filteredData =
    useMemo(() => {
      const keyword =
        search
          .toLowerCase()
          .trim();

      return data.filter(
        (item) => {
          // ---------------------------------------------
          // SEARCH
          // ---------------------------------------------

          const matchesSearch =
            !keyword ||
            item.number
              ?.toLowerCase()
              .includes(
                keyword
              ) ||
            item.outlet?.code
              ?.toLowerCase()
              .includes(
                keyword
              ) ||
            item.outlet?.name
              ?.toLowerCase()
              .includes(
                keyword
              ) ||
            item.supplier?.code
              ?.toLowerCase()
              .includes(
                keyword
              ) ||
            item.supplier?.name
              ?.toLowerCase()
              .includes(
                keyword
              ) ||
            item.status
              ?.toLowerCase()
              .includes(
                keyword
              ) ||
            item.paymentMethod
              ?.toLowerCase()
              .includes(
                keyword
              );

          if (
            !matchesSearch
          ) {
            return false;
          }

          // ---------------------------------------------
          // FILTER OUTLET
          // ---------------------------------------------

          if (
            isAdminPusat &&
            selectedOutlet !==
              "ALL"
          ) {
            if (
              String(
                item.outletId
              ) !==
              selectedOutlet
            ) {
              return false;
            }
          }

          // ---------------------------------------------
          // FILTER TANGGAL
          // ---------------------------------------------

          const dateValue =
            item.purchaseDate;

          if (
            tanggalMulai ||
            tanggalSelesai
          ) {
            if (!dateValue) {
              return false;
            }

            const itemDate =
              new Date(
                dateValue
              );

            if (
              Number.isNaN(
                itemDate.getTime()
              )
            ) {
              return false;
            }

            const year =
              itemDate.getFullYear();

            const month =
              String(
                itemDate.getMonth() +
                  1
              ).padStart(
                2,
                "0"
              );

            const day =
              String(
                itemDate.getDate()
              ).padStart(
                2,
                "0"
              );

            const itemDateOnly =
              `${year}-${month}-${day}`;

            if (
              tanggalMulai &&
              itemDateOnly <
                tanggalMulai
            ) {
              return false;
            }

            if (
              tanggalSelesai &&
              itemDateOnly >
                tanggalSelesai
            ) {
              return false;
            }
          }

          return true;
        }
      );
    }, [
      data,
      search,
      selectedOutlet,
      tanggalMulai,
      tanggalSelesai,
      isAdminPusat,
    ]);

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalPurchase =
    filteredData.length;

  const totalDraft =
    filteredData.filter(
      (item) =>
        item.status ===
        "DRAFT"
    ).length;

  const totalApproved =
    filteredData.filter(
      (item) =>
        item.status ===
        "APPROVED"
    ).length;

  const totalReceived =
    filteredData.filter(
      (item) =>
        item.status ===
        "RECEIVED"
    ).length;

  const totalValue =
    filteredData.reduce(
      (sum, item) =>
        sum +
        Number(
          item.total || 0
        ),
      0
    );

  const totalItems =
    filteredData.reduce(
      (sum, item) =>
        sum +
        (item.items?.length || 0),
      0
    );

  // =====================================================
  // FORMAT RUPIAH
  // =====================================================

  function formatRupiah(
    value: number
  ) {
    return Number(
      value || 0
    ).toLocaleString(
      "id-ID"
    );
  }

  // =====================================================
  // FORMAT DATE
  // =====================================================

  function formatDate(
    value?: string
  ) {
    if (!value) {
      return "-";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
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

  // =====================================================
  // PAYMENT METHOD DISPLAY
  // =====================================================

  function normalizePaymentMethod(
    value?: string | null
  ) {
    if (!value) {
      return "-";
    }

    const normalized =
      String(value)
        .trim()
        .toUpperCase();

    const labels: Record<
      string,
      string
    > = {
      CASH: "Cash",
      TRANSFER: "Transfer",
      COD: "COD",
      CBD: "CBD",
      TEMPO: "Tempo",
      CREDIT: "Credit",
      DEBIT: "Debit",
      QRIS: "QRIS",
    };

    return (
      labels[normalized] ||
      normalized
    );
  }

  function renderPaymentMethod(
    value?: string | null
  ) {
    if (!value) {
      return (
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <WalletCards
            size={14}
            className="text-slate-400"
          />

          <span className="text-[10px] font-bold text-slate-400">
            -
          </span>
        </div>
      );
    }

    const normalized =
      String(value)
        .trim()
        .toUpperCase();

    let iconClass =
      "bg-[#EAF3EF] text-[#497F70] border-[#DCE8E3]";

    if (
      normalized ===
      "TRANSFER"
    ) {
      iconClass =
        "bg-blue-50 text-blue-600 border-blue-100";
    }

    if (
      normalized ===
      "CASH"
    ) {
      iconClass =
        "bg-emerald-50 text-emerald-600 border-emerald-100";
    }

    if (
      normalized ===
        "TEMPO" ||
      normalized ===
        "COD" ||
      normalized ===
        "CBD"
    ) {
      iconClass =
        "bg-amber-50 text-amber-600 border-amber-100";
    }

    if (
      normalized ===
        "CREDIT" ||
      normalized ===
        "DEBIT"
    ) {
      iconClass =
        "bg-violet-50 text-violet-600 border-violet-100";
    }

    if (
      normalized ===
      "QRIS"
    ) {
      iconClass =
        "bg-indigo-50 text-indigo-600 border-indigo-100";
    }

    return (
      <div
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 ${iconClass}`}
      >
        <CreditCard
          size={14}
        />

        <span className="text-[10px] font-extrabold uppercase tracking-wide">
          {
            normalizePaymentMethod(
              value
            )
          }
        </span>
      </div>
    );
  }

  // =====================================================
  // STATUS
  // =====================================================

  function renderStatus(
    status: OutletPurchase["status"]
  ) {
    if (
      status ===
      "APPROVED"
    ) {
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-blue-700 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.10)]" />
          Approved
        </span>
      );
    }

    if (
      status ===
      "RECEIVED"
    ) {
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.10)]" />
          Received
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-700 shadow-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.10)]" />
        Draft
      </span>
    );
  }

  // =====================================================
  // RESET FILTER
  // =====================================================

  function resetFilter() {
    setSearch("");
    setSelectedOutlet("ALL");
    setTanggalMulai("");
    setTanggalSelesai("");
  }

  // =====================================================
  // DELIVERY REQUEST
  // =====================================================

  function handleNewDeliveryRequest() {
    router.push(
      "/outlet/delivery-request/new"
    );
  }

  // =====================================================
  // NEW PURCHASE
  // =====================================================

  function handleNewPurchase() {
    router.push(
      "/outlet/purchase/new"
    );
  }

  // =====================================================
  // PAYMENT
  // =====================================================

  function handlePayment(
    purchaseId: number
  ) {
    /**
     * SECURITY GUARD CLIENT
     *
     * Hanya ADMIN / ADMIN PUSAT
     * yang boleh masuk ke halaman payment.
     */
    if (!isAdminPusat) {
      return;
    }

    router.push(
      `/outlet/purchase/${purchaseId}/payment`
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-full bg-[#F3F7F5] p-4 md:p-6 lg:p-8">

      {/* =================================================
          HERO HEADER
      ================================================= */}

      <div className="relative mb-6 overflow-hidden rounded-[28px] border border-[#D9E7E1] bg-white shadow-[0_12px_40px_rgba(24,53,45,0.07)]">

        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#497F70]/10 blur-3xl" />

        <div className="absolute -bottom-28 left-[38%] h-60 w-60 rounded-full bg-emerald-100/50 blur-3xl" />

        <div className="relative px-5 py-6 md:px-7 md:py-7">

          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

            <div className="flex items-center gap-4">

              <div className="relative">

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#497F70] to-[#315E51] text-white shadow-[0_10px_25px_rgba(73,127,112,0.25)]">
                  <ShoppingCart
                    size={25}
                    strokeWidth={2}
                  />
                </div>

                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white">
                  <Sparkles size={9} />
                </div>

              </div>

              <div>

                <div className="mb-1.5 flex items-center gap-2">

                  <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#497F70]">
                    Procurement
                  </span>

                  <span className="h-1 w-1 rounded-full bg-[#B6C9C1]" />

                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Outlet Management
                  </span>

                </div>

                <h1 className="text-2xl font-black tracking-tight text-[#18352D] md:text-3xl">
                  Purchase Outlet
                </h1>

                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-gray-500">
                  Kelola Purchase Order outlet,
                  supplier, penerimaan barang,
                  metode pembayaran, dan
                  pembayaran dalam satu
                  dashboard terintegrasi.
                </p>

              </div>

            </div>

            <div className="flex flex-wrap items-center gap-2.5">

              <div className="hidden items-center gap-2 rounded-xl border border-[#DDEAE4] bg-[#F7FAF8] px-3.5 py-2.5 sm:flex">

                <Database
                  size={15}
                  className="text-[#497F70]"
                />

                <span className="text-xs font-bold text-[#58736A]">
                  {data.length} Purchase
                </span>

              </div>

              <button
                type="button"
                onClick={
                  loadPurchase
                }
                disabled={
                  loading
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-xs font-bold text-[#58736A] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#BFD4CB] hover:bg-[#F6FAF8] hover:text-[#497F70] disabled:cursor-not-allowed disabled:opacity-50"
              >

                <RefreshCw
                  size={15}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh

              </button>

              {/* =================================================
                  DELIVERY REQUEST NEW
              ================================================= */}

              <button
                type="button"
                onClick={
                  handleNewDeliveryRequest
                }
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-[#BFD4CB] bg-white px-4 py-2.5 text-xs font-extrabold text-[#497F70] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#9FBFB3] hover:bg-[#F2F8F5] hover:shadow-md"
              >

                <Truck
                  size={16}
                  className="transition-transform duration-200 group-hover:-translate-y-0.5"
                />

                Delivery Request New

                <ArrowUpRight
                  size={14}
                  className="opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />

              </button>

              {/* =================================================
                  PURCHASE BARU
              ================================================= */}

              <button
                type="button"
                onClick={
                  handleNewPurchase
                }
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-4.5 py-2.5 text-xs font-extrabold text-white shadow-[0_8px_20px_rgba(73,127,112,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#3D6D60] hover:shadow-[0_12px_25px_rgba(73,127,112,0.22)]"
              >

                <Plus
                  size={16}
                  className="transition-transform duration-200 group-hover:rotate-90"
                />

                Purchase Baru

                <ArrowUpRight
                  size={14}
                  className="opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />

              </button>

            </div>

          </div>

        </div>

      </div>

      {/* =================================================
          KPI
      ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* TOTAL */}

        <div className="group relative overflow-hidden rounded-2xl border border-[#DCE8E3] bg-white p-5 shadow-[0_5px_24px_rgba(24,53,45,0.045)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(24,53,45,0.08)]">

          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#497F70]/5 transition-transform duration-300 group-hover:scale-125" />

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                Total Purchase
              </p>

              <p className="mt-2 text-3xl font-black tracking-tight text-[#18352D]">
                {totalPurchase}
              </p>

              <p className="mt-1 text-xs font-medium text-gray-400">
                PO sesuai filter
              </p>

            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <FileText size={19} />
            </div>

          </div>

        </div>

        {/* DRAFT */}

        <div className="group relative overflow-hidden rounded-2xl border border-[#F1E3BD] bg-white p-5 shadow-[0_5px_24px_rgba(24,53,45,0.045)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(24,53,45,0.08)]">

          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-400/5 transition-transform duration-300 group-hover:scale-125" />

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                Draft
              </p>

              <p className="mt-2 text-3xl font-black tracking-tight text-amber-600">
                {totalDraft}
              </p>

              <p className="mt-1 text-xs font-medium text-gray-400">
                Menunggu approval
              </p>

            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock3 size={19} />
            </div>

          </div>

        </div>

        {/* APPROVED */}

        <div className="group relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-5 shadow-[0_5px_24px_rgba(24,53,45,0.045)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(24,53,45,0.08)]">

          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-500/5 transition-transform duration-300 group-hover:scale-125" />

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                Approved
              </p>

              <p className="mt-2 text-3xl font-black tracking-tight text-blue-600">
                {totalApproved}
              </p>

              <p className="mt-1 text-xs font-medium text-gray-400">
                Siap diproses
              </p>

            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <CheckCircle2 size={19} />
            </div>

          </div>

        </div>

        {/* RECEIVED */}

        <div className="group relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_5px_24px_rgba(24,53,45,0.045)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(24,53,45,0.08)]">

          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/5 transition-transform duration-300 group-hover:scale-125" />

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                Received
              </p>

              <p className="mt-2 text-3xl font-black tracking-tight text-emerald-600">
                {totalReceived}
              </p>

              <p className="mt-1 text-xs font-medium text-gray-400">
                Barang sudah diterima
              </p>

            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Package size={19} />
            </div>

          </div>

        </div>

      </div>

      {/* =================================================
          VALUE SUMMARY
      ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">

        <div className="relative overflow-hidden rounded-2xl border border-[#DCE8E3] bg-white p-5 shadow-[0_5px_24px_rgba(24,53,45,0.045)]">

          <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#497F70]/5 blur-xl" />

          <div className="relative flex items-center gap-4">

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <CircleDollarSign size={21} />
            </div>

            <div className="min-w-0">

              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                Total Nilai Purchase
              </p>

              <p className="mt-1 truncate text-2xl font-black tracking-tight text-[#18352D]">
                Rp {formatRupiah(totalValue)}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Nilai seluruh PO yang tampil
              </p>

            </div>

          </div>

        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[#DCE8E3] bg-white p-5 shadow-[0_5px_24px_rgba(24,53,45,0.045)]">

          <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-blue-500/5 blur-xl" />

          <div className="relative flex items-center gap-4">

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Package size={21} />
            </div>

            <div>

              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                Total Line Item
              </p>

              <p className="mt-1 text-2xl font-black tracking-tight text-[#18352D]">
                {totalItems}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Total jenis barang pada PO
              </p>

            </div>

          </div>

        </div>

      </div>

      {/* =================================================
          MAIN TABLE CARD
      ================================================= */}

      <div className="overflow-hidden rounded-[26px] border border-[#DCE8E3] bg-white shadow-[0_10px_35px_rgba(24,53,45,0.055)]">

        {/* =================================================
            TABLE HEADER
        ================================================= */}

        <div className="border-b border-[#E7EEEA] px-5 py-5 md:px-6">

          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <ShoppingCart size={17} />
                </div>

                <div>

                  <h2 className="text-base font-black text-[#18352D]">
                    Daftar Purchase Outlet
                  </h2>

                  <p className="mt-0.5 text-xs text-gray-400">
                    Monitoring Purchase Order outlet
                    secara terpusat.
                  </p>

                </div>

              </div>

            </div>

            <div className="flex items-center gap-2">

              <div className="hidden rounded-xl border border-[#E0EAE5] bg-[#F7FAF8] px-3 py-2 text-[11px] font-bold text-gray-500 sm:block">
                {filteredData.length} ditampilkan
              </div>

              {(search ||
                selectedOutlet !==
                  "ALL" ||
                tanggalMulai ||
                tanggalSelesai) && (

                <button
                  type="button"
                  onClick={
                    resetFilter
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE7E1] bg-white px-3 py-2 text-[11px] font-bold text-[#497F70] transition hover:bg-[#F5F9F7]"
                >
                  <RotateCcw
                    size={13}
                  />
                  Reset
                </button>

              )}

            </div>

          </div>

          {/* FILTER */}

          <div className="rounded-2xl border border-[#E1EBE6] bg-[#F8FAF9] p-3.5">

            <div
              className={`grid gap-3 ${
                isAdminPusat
                  ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
                  : "grid-cols-1 md:grid-cols-2"
              }`}
            >

              {/* SEARCH */}

              <div
                className={
                  isAdminPusat
                    ? "xl:col-span-1"
                    : "md:col-span-2"
                }
              >

                <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#6D857B]">
                  Pencarian
                </label>

                <div className="relative">

                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                    placeholder="Cari nomor PO, supplier, metode pembayaran..."
                    className="w-full rounded-xl border border-[#D9E5DF] bg-white py-2.5 pl-10 pr-4 text-xs font-medium text-[#35564C] outline-none transition-all placeholder:text-gray-400 focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                  />

                </div>

              </div>

              {/* OUTLET */}

              {isAdminPusat && (
                <div>

                  <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#6D857B]">
                    Outlet
                  </label>

                  <div className="relative">

                    <select
                      value={
                        selectedOutlet
                      }
                      onChange={(e) =>
                        setSelectedOutlet(
                          e.target.value
                        )
                      }
                      className="w-full appearance-none rounded-xl border border-[#D9E5DF] bg-white px-3.5 py-2.5 pr-10 text-xs font-semibold text-gray-700 outline-none transition-all hover:border-[#BFD4CB] focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    >

                      <option value="ALL">
                        Semua Outlet
                      </option>

                      {outletOptions.map(
                        (
                          outlet
                        ) => (
                          <option
                            key={
                              outlet.id
                            }
                            value={String(
                              outlet.id
                            )}
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
                      size={15}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                  </div>

                </div>
              )}

              {/* TANGGAL MULAI */}

              {isAdminPusat && (
                <div>

                  <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#6D857B]">
                    Tanggal Mulai
                  </label>

                  <div className="relative">

                    <CalendarDays
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      type="date"
                      value={
                        tanggalMulai
                      }
                      onChange={(e) =>
                        setTanggalMulai(
                          e.target.value
                        )
                      }
                      className="w-full rounded-xl border border-[#D9E5DF] bg-white py-2.5 pl-9 pr-3 text-xs font-medium text-gray-700 outline-none transition-all focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    />

                  </div>

                </div>
              )}

              {/* TANGGAL SELESAI */}

              {isAdminPusat && (
                <div>

                  <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#6D857B]">
                    Tanggal Selesai
                  </label>

                  <div className="relative">

                    <CalendarDays
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      type="date"
                      value={
                        tanggalSelesai
                      }
                      onChange={(e) =>
                        setTanggalSelesai(
                          e.target.value
                        )
                      }
                      className="w-full rounded-xl border border-[#D9E5DF] bg-white py-2.5 pl-9 pr-3 text-xs font-medium text-gray-700 outline-none transition-all focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    />

                  </div>

                </div>
              )}

            </div>

          </div>

          {/* FILTER INFO */}

          <div className="mt-4 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-2 text-gray-400">

              <span>
                Menampilkan
              </span>

              <span className="rounded-lg bg-[#EAF3EF] px-2 py-1 font-extrabold text-[#497F70]">
                {filteredData.length}
              </span>

              <span>
                dari
              </span>

              <span className="font-extrabold text-[#35564C]">
                {data.length}
              </span>

              <span>
                Purchase Outlet
              </span>

            </div>

            {isAdminPusat && (
              <div className="flex items-center gap-2 text-[11px] text-gray-400">

                <Store
                  size={13}
                  className="text-[#497F70]"
                />

                <span>
                  {selectedOutlet ===
                  "ALL"
                    ? "Semua outlet"
                    : "Filter outlet aktif"}
                </span>

              </div>
            )}

          </div>

        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="overflow-x-auto">

          <table className="min-w-[1480px] w-full text-sm">

            <thead>

              <tr className="border-b border-[#E5ECE9] bg-[#F7F9F8]">

                <th className="w-16 px-5 py-4 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-400">
                  No
                </th>

                <th className="px-5 py-4 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-400">
                  Purchase Order
                </th>

                <th className="px-5 py-4 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-400">
                  Outlet
                </th>

                <th className="px-5 py-4 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-400">
                  Supplier
                </th>

                <th className="px-5 py-4 text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-400">
                  Item
                </th>

                <th className="px-5 py-4 text-right text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-400">
                  Total
                </th>

                <th className="px-5 py-4 text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-400">
                  Metode Pembayaran
                </th>

                <th className="px-5 py-4 text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-400">
                  Status
                </th>

                <th className="px-5 py-4 text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-400">
                  Tanggal
                </th>

                <th className="px-5 py-4 text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-400">
                  Aksi
                </th>

              </tr>

            </thead>

            <tbody>

              {/* LOADING */}

              {loading ||
              loadingUser ? (

                <tr>

                  <td
                    colSpan={10}
                    className="px-5 py-20 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                        <RefreshCw
                          size={23}
                          className="animate-spin"
                        />
                      </div>

                      <p className="font-bold text-[#35564C]">
                        Memuat Purchase Outlet
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Mengambil transaksi terbaru...
                      </p>

                    </div>

                  </td>

                </tr>

              ) : filteredData.length ===
                0 ? (

                <tr>

                  <td
                    colSpan={10}
                    className="px-5 py-20 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <div className="relative mb-5">

                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                          <ShoppingCart
                            size={27}
                          />
                        </div>

                        <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-gray-400">
                          <Search size={11} />
                        </div>

                      </div>

                      <p className="font-bold text-[#35564C]">
                        Belum ada Purchase Outlet
                      </p>

                      <p className="mt-1 max-w-sm text-xs leading-5 text-gray-400">
                        Tidak ada Purchase Order
                        yang sesuai dengan
                        filter yang dipilih.
                      </p>

                      {(search ||
                        selectedOutlet !==
                          "ALL" ||
                        tanggalMulai ||
                        tanggalSelesai) && (

                        <button
                          type="button"
                          onClick={
                            resetFilter
                          }
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#3D6D60]"
                        >
                          <RotateCcw
                            size={13}
                          />
                          Reset Filter
                        </button>

                      )}

                    </div>

                  </td>

                </tr>

              ) : (

                filteredData.map(
                  (
                    item,
                    index
                  ) => (

                    <tr
                      key={
                        item.id
                      }
                      className="group border-b border-[#EDF2EF] transition-colors duration-150 hover:bg-[#FAFCFB]"
                    >

                      {/* NO */}

                      <td className="px-5 py-4">

                        <span className="text-xs font-bold text-gray-400">
                          {String(
                            index + 1
                          ).padStart(
                            2,
                            "0"
                          )}
                        </span>

                      </td>

                      {/* NOMOR PO */}

                      <td className="px-5 py-4">

                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/outlet/purchase/${item.id}`
                            )
                          }
                          className="group/po flex items-center gap-3 text-left"
                        >

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70] transition-all duration-200 group-hover/po:bg-[#DCEBE5] group-hover/po:shadow-sm">
                            <FileText
                              size={16}
                            />
                          </div>

                          <div className="min-w-0">

                            <div className="font-extrabold text-[#18352D] transition-colors group-hover/po:text-[#497F70]">
                              {
                                item.number
                              }
                            </div>

                            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                              Purchase Outlet
                            </div>

                          </div>

                        </button>

                      </td>

                      {/* OUTLET */}

                      <td className="px-5 py-4">

                        <div className="flex items-center gap-3">

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <Store
                              size={16}
                            />
                          </div>

                          <div className="min-w-0">

                            <div className="max-w-[190px] truncate font-bold text-gray-700">
                              {
                                item
                                  .outlet
                                  ?.name ||
                                "-"
                              }
                            </div>

                            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                              {
                                item
                                  .outlet
                                  ?.code ||
                                "-"
                              }
                            </div>

                          </div>

                        </div>

                      </td>

                      {/* SUPPLIER */}

                      <td className="px-5 py-4">

                        <div className="flex items-center gap-3">

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F2F6F4] text-[#497F70]">
                            <Truck
                              size={16}
                            />
                          </div>

                          <div className="min-w-0">

                            <div className="max-w-[190px] truncate font-bold text-gray-700">
                              {
                                item
                                  .supplier
                                  ?.name ||
                                "-"
                              }
                            </div>

                            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                              {
                                item
                                  .supplier
                                  ?.code ||
                                "-"
                              }
                            </div>

                          </div>

                        </div>

                      </td>

                      {/* ITEM */}

                      <td className="px-5 py-4 text-center">

                        <div className="inline-flex items-center gap-2 rounded-xl border border-[#DCE8E3] bg-[#F7FAF8] px-3 py-2">

                          <Package
                            size={14}
                            className="text-[#497F70]"
                          />

                          <span className="text-xs font-extrabold text-[#35564C]">
                            {
                              item.items
                                ?.length ||
                              0
                            }
                          </span>

                          <span className="text-[10px] font-medium text-gray-400">
                            item
                          </span>

                        </div>

                      </td>

                      {/* TOTAL */}

                      <td className="px-5 py-4 text-right">

                        <div className="font-black tracking-tight text-[#18352D]">
                          Rp{" "}
                          {
                            formatRupiah(
                              item.total
                            )
                          }
                        </div>

                        <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                          Total Purchase
                        </div>

                      </td>

                      {/* METODE PEMBAYARAN */}

                      <td className="px-5 py-4 text-center">

                        {renderPaymentMethod(
                          item.paymentMethod
                        )}

                      </td>

                      {/* STATUS */}

                      <td className="px-5 py-4 text-center">

                        {renderStatus(
                          item.status
                        )}

                      </td>

                      {/* TANGGAL */}

                      <td className="px-5 py-4 text-center">

                        <div className="inline-flex items-center gap-2 rounded-lg bg-[#F7F9F8] px-2.5 py-2 text-xs font-semibold text-gray-600">

                          <CalendarDays
                            size={13}
                            className="text-[#497F70]"
                          />

                          {
                            formatDate(
                              item.purchaseDate
                            )
                          }

                        </div>

                      </td>

                      {/* AKSI */}

                      <td className="px-5 py-4">

                        <div className="flex items-center justify-center gap-2">

                          {/* DETAIL */}

                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/outlet/purchase/${item.id}`
                              )
                            }
                            className="group/action inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DCE8E3] bg-white px-3 text-[10px] font-extrabold text-[#497F70] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#BFD4CB] hover:bg-[#EAF3EF] hover:shadow-md"
                            title="Lihat Detail"
                          >

                            <Eye
                              size={14}
                            />

                            <span>
                              Detail
                            </span>

                          </button>

                          {/* =================================================
                              PAYMENT
                              HANYA ADMIN PUSAT
                          ================================================= */}

                          {isAdminPusat &&
                            item.status ===
                              "APPROVED" && (

                              <button
                                type="button"
                                onClick={() =>
                                  handlePayment(
                                    item.id
                                  )
                                }
                                className="group/action inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[10px] font-extrabold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md"
                                title="Payment - Admin Pusat"
                              >

                                <CreditCard
                                  size={14}
                                />

                                <span>
                                  Payment
                                </span>

                              </button>

                            )}

                        </div>

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

            {/* =================================================
                FOOTER
            ================================================= */}

            {!loading &&
              !loadingUser &&
              filteredData.length >
                0 && (

                <tfoot>

                  <tr className="border-t border-[#DCE8E3] bg-[#F7FAF8]">

                    <td
                      colSpan={5}
                      className="px-5 py-4 text-right"
                    >

                      <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                        Ringkasan
                      </div>

                      <div className="mt-0.5 text-xs font-bold text-[#35564C]">
                        {filteredData.length} Purchase Order
                      </div>

                    </td>

                    <td className="px-5 py-4 text-right">

                      <div className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400">
                        Total Nilai
                      </div>

                      <div className="mt-1 font-black tracking-tight text-[#18352D]">
                        Rp{" "}
                        {
                          formatRupiah(
                            filteredData.reduce(
                              (
                                sum,
                                item
                              ) =>
                                sum +
                                Number(
                                  item.total ||
                                    0
                                ),
                              0
                            )
                          )
                        }
                      </div>

                    </td>

                    <td className="px-5 py-4 text-center">

                      <div className="inline-flex items-center gap-2 rounded-xl border border-[#DCE8E3] bg-white px-3 py-2">

                        <WalletCards
                          size={14}
                          className="text-[#497F70]"
                        />

                        <span className="text-[10px] font-extrabold text-[#35564C]">
                          Payment
                        </span>

                      </div>

                    </td>

                    <td
                      colSpan={3}
                      className="px-5 py-4"
                    >

                      <div className="flex items-center justify-end gap-2 text-[10px] font-semibold text-gray-400">

                        <CheckCircle2
                          size={14}
                          className="text-emerald-500"
                        />

                        Data Purchase Outlet
                        berhasil dimuat

                      </div>

                    </td>

                  </tr>

                </tfoot>

              )}

          </table>

        </div>

        {/* =================================================
            BOTTOM BAR
        ================================================= */}

        {!loading &&
          !loadingUser &&
          filteredData.length >
            0 && (

            <div className="flex flex-col gap-3 border-t border-[#E7EEEA] bg-white px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">

              <div className="flex items-center gap-2">

                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <CheckCircle2
                    size={14}
                  />
                </div>

                <div>

                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    System Status
                  </p>

                  <p className="text-xs font-semibold text-[#35564C]">
                    Data Purchase Outlet
                    tersinkronisasi
                  </p>

                </div>

              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">

                <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span className="font-bold">
                    {totalDraft} Draft
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-blue-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="font-bold">
                    {totalApproved} Approved
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="font-bold">
                    {totalReceived} Received
                  </span>
                </div>

              </div>

            </div>

          )}

      </div>

    </div>
  );
}