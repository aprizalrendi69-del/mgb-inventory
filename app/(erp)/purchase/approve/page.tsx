
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Eye,
  RefreshCw,
  FileText,
  Store,
  Warehouse,
  ArrowUpRight,
  Clock3,
  Receipt,
  ShieldCheck,
  Package,
  CalendarDays,
  UserRound,
  Sparkles,
  ChevronRight,
  X,
  CircleDollarSign,
  LockKeyhole,
  Send,
  Search,
  SlidersHorizontal,
  MapPin,
  RotateCcw,
} from "lucide-react";

type PurchaseItem = {
  id: number;
  barangId: number;
  qty: number;
  price: number;
  subtotal: number;
  barang?: {
    id: number;
    code?: string;
    name?: string;
    unit?: string;
  };
};

type PurchaseData = {
  id: number;
  number: string;
  status: string;
  purchaseDate?: string;
  total?: number;
  source?: "PUSAT" | "OUTLET";
  destinationType?: "PUSAT" | "OUTLET";
  destinationId?: number | null;
  destinationName?: string | null;
  destinationCode?: string | null;
  supplier?: {
    id: number;
    name: string;
  };
  outlet?: {
    id: number;
    code: string;
    name: string;
  };
  items?: PurchaseItem[];
};

type PurchaseFilter = "ALL" | "PUSAT" | "OUTLET";

type OutletOption = {
  key: string;
  id?: number;
  code: string;
  name: string;
};

const formatRupiah = (value: number) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

const formatDate = (value?: string) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function ApprovePage() {
  const [data, setData] = useState<PurchaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [approvingSource, setApprovingSource] = useState<
    "PUSAT" | "OUTLET" | null
  >(null);
  const [approveTarget, setApproveTarget] =
    useState<PurchaseData | null>(null);

  const [filter, setFilter] = useState<PurchaseFilter>("PUSAT");
  const [search, setSearch] = useState("");
  const [selectedOutlet, setSelectedOutlet] = useState("ALL");

  // =========================================================
  // IDENTIFIKASI JENIS PURCHASE
  // =========================================================

  const isOutletPurchase = useCallback(
    (purchase: PurchaseData): boolean => {
      return (
        purchase.source === "OUTLET" ||
        purchase.destinationType === "OUTLET"
      );
    },
    []
  );

  const isPusatPurchase = useCallback(
    (purchase: PurchaseData): boolean => {
      return (
        !isOutletPurchase(purchase) &&
        (
          purchase.source === "PUSAT" ||
          purchase.destinationType === "PUSAT" ||
          (!purchase.source && !purchase.destinationType)
        )
      );
    },
    [isOutletPurchase]
  );

  const getOutletKey = useCallback(
    (purchase: PurchaseData): string => {
      const id =
        purchase.outlet?.id ??
        purchase.destinationId;

      if (id != null) return `ID:${id}`;

      const code =
        purchase.outlet?.code ??
        purchase.destinationCode;

      if (code) return `CODE:${code}`;

      const name =
        purchase.outlet?.name ??
        purchase.destinationName;

      return name ? `NAME:${name}` : "";
    },
    []
  );

  // =========================================================
  // LOAD DATA
  // =========================================================

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/purchase", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Gagal mengambil Purchase Order"
        );
      }

      const draftData: PurchaseData[] = (
        Array.isArray(json.data) ? json.data : []
      ).filter(
        (item: PurchaseData) => item.status === "DRAFT"
      );

      setData(draftData);
    } catch (error) {
      console.error("LOAD PURCHASE APPROVE ERROR:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // =========================================================
  // MODAL BEHAVIOR
  // =========================================================

  useEffect(() => {
    if (!approveTarget) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && approvingId === null) {
        setApproveTarget(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [approveTarget, approvingId]);

  // =========================================================
  // FILTER OUTLET
  // Outlet diambil dari PO yang tersedia.
  // =========================================================

  const outletOptions = useMemo<OutletOption[]>(() => {
    const options = new Map<string, OutletOption>();

    data.filter(isOutletPurchase).forEach((item) => {
      const key = getOutletKey(item);
      if (!key) return;

      const name =
        item.outlet?.name ||
        item.destinationName ||
        "Outlet tanpa nama";

      const code =
        item.outlet?.code ||
        item.destinationCode ||
        "";

      const id =
        item.outlet?.id ??
        item.destinationId ??
        undefined;

      const existing = options.get(key);

      if (!existing) {
        options.set(key, {
          key,
          id: id ?? undefined,
          name,
          code,
        });
      }
    });

    return Array.from(options.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "id")
    );
  }, [data, isOutletPurchase, getOutletKey]);

  // Reset pilihan outlet jika outlet tersebut tidak lagi tersedia.
  useEffect(() => {
    if (
      selectedOutlet !== "ALL" &&
      !outletOptions.some((item) => item.key === selectedOutlet)
    ) {
      setSelectedOutlet("ALL");
    }
  }, [outletOptions, selectedOutlet]);

  // =========================================================
  // SEARCH + FILTER
  // =========================================================

  const filteredData = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("id");

    return data.filter((item) => {
      const isOutlet = isOutletPurchase(item);
      const isPusat = isPusatPurchase(item);

      // Filter jenis PO.
      if (filter === "PUSAT" && !isPusat) return false;
      if (filter === "OUTLET" && !isOutlet) return false;

      // Filter outlet tertentu.
      if (
        filter === "OUTLET" &&
        selectedOutlet !== "ALL" &&
        getOutletKey(item) !== selectedOutlet
      ) {
        return false;
      }

      // Filter pencarian.
      if (keyword) {
        const searchable = [
          item.number,
          item.supplier?.name,
          item.outlet?.name,
          item.outlet?.code,
          item.destinationName,
          item.destinationCode,
          item.source,
          item.destinationType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("id");

        if (!searchable.includes(keyword)) return false;
      }

      return true;
    });
  }, [
    data,
    filter,
    search,
    selectedOutlet,
    isOutletPurchase,
    isPusatPurchase,
    getOutletKey,
  ]);

  // =========================================================
  // SUMMARY
  // Semua ringkasan mengikuti hasil filter aktif.
  // =========================================================

  const totalPurchase = useMemo(
    () =>
      filteredData.reduce(
        (total, item) => total + Number(item.total || 0),
        0
      ),
    [filteredData]
  );

  const totalPusat = useMemo(
    () => filteredData.filter(isPusatPurchase).length,
    [filteredData, isPusatPurchase]
  );

  const totalOutlet = useMemo(
    () => filteredData.filter(isOutletPurchase).length,
    [filteredData, isOutletPurchase]
  );

  const totalItems = useMemo(
    () =>
      filteredData.reduce(
        (total, item) => total + (item.items?.length || 0),
        0
      ),
    [filteredData]
  );

  const totalAll = data.length;

  const totalPusatAll = useMemo(
    () => data.filter(isPusatPurchase).length,
    [data, isPusatPurchase]
  );

  const totalOutletAll = useMemo(
    () => data.filter(isOutletPurchase).length,
    [data, isOutletPurchase]
  );

  const filterLabel =
    filter === "PUSAT"
      ? "PO Pusat"
      : filter === "OUTLET"
        ? "PO Outlet"
        : "Semua PO";

  const activeOutlet = outletOptions.find(
    (item) => item.key === selectedOutlet
  );

  // =========================================================
  // RESET FILTER
  // =========================================================

  function resetFilters() {
    setSearch("");
    setFilter("ALL");
    setSelectedOutlet("ALL");
  }

  // =========================================================
  // OPEN APPROVAL MODAL
  // =========================================================

  function openApproveModal(purchase: PurchaseData) {
    if (!purchase?.id) return;

    if (purchase.status !== "DRAFT") {
      alert("Purchase Order ini sudah tidak berstatus DRAFT.");
      return;
    }

    setApproveTarget(purchase);
  }

  // =========================================================
  // APPROVE
  // =========================================================

  async function approvePurchase(purchase: PurchaseData) {
    if (!purchase?.id) return;
    if (approvingId !== null) return;

    if (purchase.status !== "DRAFT") {
      alert("Purchase Order ini sudah tidak berstatus DRAFT.");
      setApproveTarget(null);
      return;
    }

    const isOutlet = isOutletPurchase(purchase);
    const source: "PUSAT" | "OUTLET" = isOutlet
      ? "OUTLET"
      : "PUSAT";

    try {
      setApprovingId(purchase.id);
      setApprovingSource(source);

      const endpoint = isOutlet
        ? `/api/outlet/purchase/${purchase.id}/approve`
        : `/api/purchase/${purchase.id}/approve`;

      const res = await fetch(endpoint, {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal melakukan approve Purchase Order"
        );
      }

      // Hapus hanya PO dengan ID dan sumber yang sama.
      setData((prev) =>
        prev.filter(
          (item) =>
            !(
              item.id === purchase.id &&
              (isOutletPurchase(item) ? "OUTLET" : "PUSAT") ===
                source
            )
        )
      );

      setApproveTarget(null);

      alert(
        `${isOutlet ? "Purchase Order Outlet" : "Purchase Order"} ${
          purchase.number
        } berhasil diapprove.`
      );
    } catch (error: unknown) {
      console.error("APPROVE PURCHASE ERROR:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal melakukan approve Purchase Order"
      );
    } finally {
      setApprovingId(null);
      setApprovingSource(null);
    }
  }

  // =========================================================
  // MODAL DATA
  // =========================================================

  const approveIsOutlet = approveTarget
    ? isOutletPurchase(approveTarget)
    : false;

  const approveDestination = approveTarget
    ? approveIsOutlet
      ? approveTarget.outlet?.name ||
        approveTarget.destinationName ||
        "-"
      : "Gudang Pusat"
    : "-";

  const approveDestinationCode = approveTarget
    ? approveIsOutlet
      ? approveTarget.outlet?.code ||
        approveTarget.destinationCode ||
        ""
      : ""
    : "";

  const approveItemCount = approveTarget?.items?.length || 0;
  const approveTotal = Number(approveTarget?.total || 0);

  const approveIsProcessing =
    approveTarget !== null &&
    approvingId === approveTarget.id &&
    approvingSource ===
      (approveIsOutlet ? "OUTLET" : "PUSAT");

  return (
    <div className="min-h-full bg-[#F5F8F6] text-[#18352D]">
      <div className="mx-auto w-full max-w-[1500px] px-3 py-4 sm:px-4 sm:py-5 lg:px-5 lg:py-6">

        {/* HEADER */}
        <div className="relative mb-6 overflow-hidden rounded-[28px] border border-[#DDE9E4] bg-white shadow-[0_12px_40px_rgba(24,53,45,0.06)]">
          <div className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-[#497F70]/5" />

          <div className="relative flex flex-col gap-5 px-5 py-6 md:flex-row md:items-center md:justify-between md:px-7">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#497F70] text-white shadow-lg shadow-[#497F70]/20">
                <ShieldCheck size={23} />
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#EAF3EF] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#497F70]">
                    Approval Center
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Menunggu Tindakan
                  </span>
                </div>

                <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                  Purchase Approve
                </h1>

                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-gray-500">
                  Review dan setujui Purchase Order Pusat maupun Outlet
                  yang masih berstatus draft.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || approvingId !== null}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-5 text-sm font-bold text-[#35564C] shadow-sm transition hover:bg-[#F2F7F4] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={loading ? "animate-spin" : ""}
              />
              {loading ? "Memuat..." : "Refresh Data"}
            </button>
          </div>

          <div className="border-t border-[#E8EEEB] bg-[#FAFCFB] px-5 py-3.5 md:px-7">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <Clock3 size={14} className="text-[#497F70]" />
                <span>{filteredData.length} {filterLabel} menunggu approval</span>
              </div>

              <div className="flex items-center gap-2">
                <Package size={14} className="text-[#497F70]" />
                <span>{totalItems} total item</span>
              </div>

              <div className="flex items-center gap-2">
                <Receipt size={14} className="text-[#497F70]" />
                <span>Nilai {formatRupiah(totalPurchase)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* FILTER JENIS PO */}
        <section className="mb-4 rounded-[24px] border border-[#DDE9E4] bg-white p-4 shadow-[0_8px_30px_rgba(24,53,45,0.045)] sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <SlidersHorizontal size={19} />
            </div>

            <div>
              <h2 className="text-sm font-black text-[#18352D]">
                Filter Purchase Order
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Pilih jenis transaksi, outlet, atau cari PO berdasarkan kata kunci.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              aria-pressed={filter === "ALL"}
              className={`flex min-h-[58px] items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                filter === "ALL"
                  ? "border-[#18352D] bg-[#18352D] text-white shadow-md"
                  : "border-[#DDE9E4] bg-white text-[#35564C] hover:bg-[#F5F9F7]"
              }`}
            >
              <span className="flex items-center gap-3">
                <Receipt size={18} />
                <span>
                  <span className="block text-xs font-black">Semua PO</span>
                  <span className={`mt-1 block text-[10px] ${filter === "ALL" ? "text-white/60" : "text-gray-400"}`}>
                    Seluruh jenis
                  </span>
                </span>
              </span>
              <span className="text-lg font-black">{totalAll}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilter("PUSAT");
                setSelectedOutlet("ALL");
              }}
              aria-pressed={filter === "PUSAT"}
              className={`flex min-h-[58px] items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                filter === "PUSAT"
                  ? "border-[#497F70] bg-[#497F70] text-white shadow-md"
                  : "border-[#DDE9E4] bg-white text-[#35564C] hover:bg-[#F5F9F7]"
              }`}
            >
              <span className="flex items-center gap-3">
                <Warehouse size={18} />
                <span>
                  <span className="block text-xs font-black">PO Pusat</span>
                  <span className={`mt-1 block text-[10px] ${filter === "PUSAT" ? "text-white/70" : "text-gray-400"}`}>
                    Gudang pusat
                  </span>
                </span>
              </span>
              <span className="text-lg font-black">{totalPusatAll}</span>
            </button>

            <button
              type="button"
              onClick={() => setFilter("OUTLET")}
              aria-pressed={filter === "OUTLET"}
              className={`flex min-h-[58px] items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                filter === "OUTLET"
                  ? "border-blue-600 bg-blue-600 text-white shadow-md"
                  : "border-[#DDE9E4] bg-white text-[#35564C] hover:bg-blue-50/40"
              }`}
            >
              <span className="flex items-center gap-3">
                <Store size={18} />
                <span>
                  <span className="block text-xs font-black">PO Outlet</span>
                  <span className={`mt-1 block text-[10px] ${filter === "OUTLET" ? "text-white/70" : "text-gray-400"}`}>
                    Purchase outlet
                  </span>
                </span>
              </span>
              <span className="text-lg font-black">{totalOutletAll}</span>
            </button>
          </div>

          {/* PENCARIAN + FILTER OUTLET */}
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr_auto]">
            <div>
              <label
                htmlFor="purchase-search"
                className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#607A70]"
              >
                Pencarian
              </label>

              <div className="flex h-11 items-center gap-2.5 rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-3.5 transition focus-within:border-[#497F70] focus-within:ring-2 focus-within:ring-[#497F70]/10">
                <Search size={17} className="shrink-0 text-[#789087]" />

                <input
                  id="purchase-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari nomor PO, supplier, outlet, kode..."
                  className="w-full min-w-0 bg-transparent text-xs font-medium text-[#18352D] outline-none placeholder:text-gray-400"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Hapus pencarian"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-[#EAF3EF] hover:text-[#35564C]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="purchase-outlet"
                className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#607A70]"
              >
                Filter Outlet
              </label>

              <div className="relative">
                <Store
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#789087]"
                />

                <select
                  id="purchase-outlet"
                  value={selectedOutlet}
                  onChange={(event) => setSelectedOutlet(event.target.value)}
                  disabled={filter !== "OUTLET" || outletOptions.length === 0}
                  className="h-11 w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] pl-10 pr-9 text-xs font-semibold text-[#35564C] outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="ALL">Semua outlet</option>

                  {outletOptions.map((outlet) => (
                    <option key={outlet.key} value={outlet.key}>
                      {outlet.code
                        ? `${outlet.code} - ${outlet.name}`
                        : outlet.name}
                    </option>
                  ))}
                </select>

                <MapPin
                  size={14}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>

              <p className="mt-1.5 text-[10px] text-gray-400">
                {filter !== "OUTLET"
                  ? "Pilih PO Outlet untuk mengaktifkan filter ini."
                  : `${outletOptions.length} outlet tersedia pada data PO.`}
              </p>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={resetFilters}
                disabled={
                  filter === "ALL" &&
                  search === "" &&
                  selectedOutlet === "ALL"
                }
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 text-xs font-bold text-[#497F70] transition hover:bg-[#F2F7F4] disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto"
              >
                <RotateCcw size={14} />
                Reset Filter
              </button>
            </div>
          </div>

          {/* FILTER AKTIF */}
          {(search.trim() || selectedOutlet !== "ALL") && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#E8EEEB] pt-3">
              <span className="text-[10px] font-bold text-gray-400">
                Filter aktif:
              </span>

              {search.trim() && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#EAF3EF] px-2.5 py-1.5 text-[10px] font-bold text-[#35564C]">
                  <Search size={11} />
                  {search.trim()}
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Hapus filter pencarian"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {activeOutlet && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-700">
                  <Store size={11} />
                  {activeOutlet.name}
                  <button
                    type="button"
                    onClick={() => setSelectedOutlet("ALL")}
                    aria-label="Hapus filter outlet"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
          )}
        </section>

        {/* SUMMARY CARDS */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-[#DDE9E4] bg-white p-5 shadow-[0_8px_30px_rgba(24,53,45,0.045)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
                  Menunggu Approval
                </p>
                <p className="mt-2 text-3xl font-black">{filteredData.length}</p>
                <p className="mt-1 text-xs text-gray-400">{filterLabel}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Clock3 size={21} />
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[#DDE9E4] bg-white p-5 shadow-[0_8px_30px_rgba(24,53,45,0.045)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
                  PO Pusat
                </p>
                <p className="mt-2 text-3xl font-black">{totalPusat}</p>
                <p className="mt-1 text-xs text-gray-400">Sesuai filter aktif</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                <Warehouse size={21} />
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[#DDE9E4] bg-white p-5 shadow-[0_8px_30px_rgba(24,53,45,0.045)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
                  PO Outlet
                </p>
                <p className="mt-2 text-3xl font-black">{totalOutlet}</p>
                <p className="mt-1 text-xs text-gray-400">Sesuai filter aktif</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Store size={21} />
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[#18352D] bg-[#18352D] p-5 text-white shadow-[0_10px_35px_rgba(24,53,45,0.12)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">
                  Nilai Purchase
                </p>
                <p className="mt-2 truncate text-xl font-black">
                  {formatRupiah(totalPurchase)}
                </p>
                <p className="mt-1 text-xs text-white/40">{filterLabel}</p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <Receipt size={21} />
              </div>
            </div>
          </div>
        </div>

        {/* TABLE */}
        <section className="overflow-hidden rounded-[24px] border border-[#DDE9E4] bg-white shadow-[0_10px_35px_rgba(24,53,45,0.05)]">
          <div className="flex flex-col gap-3 border-b border-[#E8EEEB] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <CheckCircle2 size={19} />
              </div>

              <div>
                <h2 className="font-bold">Approval Queue</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {filterLabel} yang membutuhkan persetujuan.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#F2F7F4] px-3 py-2 text-xs font-bold text-[#497F70]">
                {filteredData.length} hasil
              </span>
              {search.trim() && (
                <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                  Pencarian aktif
                </span>
              )}
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1050px] text-xs">
              <thead>
                <tr className="border-b border-[#E8EEEB] bg-[#F7FAF8]">
                  {[
                    "#",
                    "Purchase Order",
                    "Jenis",
                    "Tujuan / Outlet",
                    "Supplier",
                    "Tanggal",
                    "Item",
                    "Total",
                    "Status",
                    "Aksi",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="whitespace-nowrap px-3 py-3 text-left text-[9px] font-black uppercase tracking-[0.08em] text-[#607A70]"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading &&
                  [1, 2, 3].map((row) => (
                    <tr key={row} className="border-b border-[#EDF2EF]">
                      {Array.from({ length: 10 }).map((_, index) => (
                        <td key={index} className="px-3 py-5">
                          <div className="h-4 w-16 animate-pulse rounded-lg bg-[#EEF3F0]" />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!loading && filteredData.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-20">
                      <div className="flex flex-col items-center text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                          {search.trim() || selectedOutlet !== "ALL" ? (
                            <Search size={29} />
                          ) : (
                            <CheckCircle2 size={31} />
                          )}
                        </div>

                        <h3 className="text-base font-bold">
                          {search.trim() || selectedOutlet !== "ALL"
                            ? "Purchase Order tidak ditemukan"
                            : "Tidak ada Purchase Order menunggu approval"}
                        </h3>

                        <p className="mt-2 max-w-md text-sm leading-6 text-gray-400">
                          {search.trim() || selectedOutlet !== "ALL"
                            ? "Coba ubah kata kunci pencarian atau sesuaikan filter jenis PO dan outlet."
                            : "Tidak ada Purchase Order berstatus DRAFT yang sesuai dengan filter ini."}
                        </p>

                        {(search.trim() ||
                          selectedOutlet !== "ALL" ||
                          filter !== "ALL") && (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-xs font-bold text-[#497F70] transition hover:bg-[#F2F7F4]"
                          >
                            <RotateCcw size={14} />
                            Reset Semua Filter
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => void load()}
                          className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-gray-500 transition hover:bg-gray-50"
                        >
                          <RefreshCw size={13} />
                          Refresh Data
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredData.map((item, index) => {
                    const isOutlet = isOutletPurchase(item);

                    const destination = isOutlet
                      ? item.outlet?.name ||
                        item.destinationName ||
                        "-"
                      : "Gudang Pusat";

                    const destinationCode = isOutlet
                      ? item.outlet?.code ||
                        item.destinationCode ||
                        ""
                      : "";

                    const isApproving =
                      approvingId === item.id &&
                      approvingSource ===
                        (isOutlet ? "OUTLET" : "PUSAT");

                    return (
                      <tr
                        key={`${isOutlet ? "OUTLET" : "PUSAT"}-${item.id}`}
                        className="border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                      >
                        <td className="px-3 py-4">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#F1F6F3] text-[10px] font-bold text-[#607A70]">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        </td>

                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F0F6F3] text-[#497F70]">
                              <FileText size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-black text-[#18352D]">
                                {item.number}
                              </p>
                              <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-gray-400">
                                Purchase Order
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-4">
                          {isOutlet ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">
                              <Store size={12} />
                              Outlet
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D9E9E1] bg-[#EAF3EF] px-2 py-1 text-[9px] font-black text-[#497F70]">
                              <Warehouse size={12} />
                              Pusat
                            </span>
                          )}
                        </td>

                        <td className="max-w-[180px] px-3 py-4">
                          <p className="truncate font-bold text-[#35564C]">
                            {destination}
                          </p>
                          {destinationCode && (
                            <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wider text-gray-400">
                              {destinationCode}
                            </p>
                          )}
                        </td>

                        <td className="max-w-[180px] px-3 py-4">
                          <div className="flex items-center gap-2">
                            <UserRound
                              size={14}
                              className="shrink-0 text-gray-400"
                            />
                            <span className="truncate font-semibold text-gray-600">
                              {item.supplier?.name || "-"}
                            </span>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-3 py-4">
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <CalendarDays size={14} className="text-gray-400" />
                            {formatDate(item.purchaseDate)}
                          </div>
                        </td>

                        <td className="px-3 py-4 text-center">
                          <span className="inline-flex min-w-8 items-center justify-center rounded-lg bg-[#F5F8F6] px-2.5 py-1.5 font-bold text-[#35564C]">
                            {item.items?.length || 0}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-3 py-4 text-right">
                          <p className="font-black text-[#18352D]">
                            {formatRupiah(Number(item.total || 0))}
                          </p>
                        </td>

                        <td className="px-3 py-4 text-center">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-2 py-1 text-[9px] font-black uppercase text-amber-700">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                            Draft
                          </span>
                        </td>

                        <td className="px-3 py-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <Link
                              href={
                                isOutlet
                                  ? `/outlet/purchase/${item.id}`
                                  : `/purchase/${item.id}`
                              }
                              title="Lihat detail"
                              aria-label={`Lihat detail ${item.number}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D5E5DC] bg-white text-[#35564C] transition hover:bg-[#F2F7F4]"
                            >
                              <Eye size={15} />
                            </Link>

                            <button
                              type="button"
                              onClick={() => openApproveModal(item)}
                              disabled={
                                loading || approvingId !== null
                              }
                              title="Approve Purchase Order"
                              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#497F70] to-[#3D6D60] px-2.5 text-[10px] font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isApproving ? (
                                <RefreshCw
                                  size={12}
                                  className="animate-spin"
                                />
                              ) : (
                                <CheckCircle2 size={13} />
                              )}
                              Approve
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {!loading && filteredData.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-[#E8EEEB] bg-[#FAFCFB] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Sparkles size={14} className="text-[#497F70]" />
                <span>
                  Menampilkan {filteredData.length} dari {data.length} PO draft.
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-[#35564C]">
                <span>Nilai {formatRupiah(totalPurchase)}</span>
                <ArrowUpRight size={14} className="text-[#497F70]" />
              </div>
            </div>
          )}
        </section>

        {/* NOTICE */}
        {!loading && filteredData.length > 0 && (
          <div className="mt-4 rounded-2xl border border-[#DDE9E4] bg-white px-4 py-3.5 shadow-sm sm:px-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <ShieldCheck size={17} />
              </div>
              <div>
                <p className="text-xs font-bold text-[#35564C]">
                  Perhatian sebelum approval
                </p>
                <p className="mt-1 text-[11px] leading-5 text-gray-400">
                  Periksa detail Purchase Order sebelum disetujui.
                  Setelah approval berhasil, PO akan dikeluarkan dari
                  antrean draft sesuai alur sistem.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* APPROVAL MODAL */}
      {approveTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-purchase-title"
        >
          <button
            type="button"
            aria-label="Tutup modal"
            disabled={approveIsProcessing}
            onClick={() => setApproveTarget(null)}
            className="absolute inset-0 bg-[#102D25]/55 backdrop-blur-[6px] disabled:cursor-not-allowed"
          />

          <div className="relative z-10 flex max-h-[94vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[26px] border border-white/70 bg-white shadow-[0_30px_100px_rgba(14,45,36,0.28)] sm:rounded-[30px]">
            <div className="h-1.5 shrink-0 bg-gradient-to-r from-[#315E50] via-[#497F70] to-[#7BAE9E]" />

            {/* MODAL HEADER */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E7EFEB] bg-gradient-to-br from-[#F8FCFA] via-white to-[#EEF6F2] px-5 py-5 sm:px-7">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#497F70] to-[#315E50] text-white shadow-lg">
                  <ShieldCheck size={22} />
                </div>

                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#CFE2D9] bg-[#EAF3EF] px-2 py-1 text-[8px] font-black uppercase tracking-wider text-[#497F70]">
                      Approval Review
                    </span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[8px] font-black uppercase text-amber-700">
                      Draft
                    </span>
                  </div>

                  <h2
                    id="approve-purchase-title"
                    className="text-base font-black tracking-tight text-[#18352D] sm:text-xl"
                  >
                    Approve Purchase Order
                  </h2>

                  <p className="mt-1 text-[10px] text-[#82938D]">
                    Periksa detail transaksi sebelum menyetujui.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setApproveTarget(null)}
                disabled={approveIsProcessing}
                aria-label="Tutup"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DDE9E4] bg-white text-[#81918B] transition hover:bg-[#F2F7F4] disabled:opacity-40"
              >
                <X size={16} />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
              <div className="rounded-2xl border border-[#DDE9E4] bg-[#FAFCFB] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#497F70] shadow-sm ring-1 ring-[#E2ECE7]">
                      <FileText size={19} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#95A39E]">
                        Purchase Order
                      </p>
                      <p className="mt-1 break-all text-sm font-black text-[#18352D]">
                        {approveTarget.number}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex w-fit items-center gap-2 rounded-xl border bg-white px-3 py-2 text-[10px] font-black ${
                      approveIsOutlet
                        ? "border-blue-100 text-blue-700"
                        : "border-[#DCE8E2] text-[#497F70]"
                    }`}
                  >
                    {approveIsOutlet ? (
                      <Store size={14} />
                    ) : (
                      <Warehouse size={14} />
                    )}
                    {approveIsOutlet ? "Purchase Outlet" : "Purchase Pusat"}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#E1EAE6] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F6F3] text-[#607A70]">
                      <UserRound size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-wider text-[#9AA7A2]">
                        Supplier
                      </p>
                      <p className="mt-1 break-words text-xs font-black text-[#35564C]">
                        {approveTarget.supplier?.name || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E1EAE6] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F6F3] text-[#607A70]">
                      <CalendarDays size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-[#9AA7A2]">
                        Purchase Date
                      </p>
                      <p className="mt-1 text-xs font-black text-[#35564C]">
                        {formatDate(approveTarget.purchaseDate)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E1EAE6] p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        approveIsOutlet
                          ? "bg-blue-50 text-blue-600"
                          : "bg-[#EAF3EF] text-[#497F70]"
                      }`}
                    >
                      {approveIsOutlet ? (
                        <Store size={16} />
                      ) : (
                        <Warehouse size={16} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-wider text-[#9AA7A2]">
                        Tujuan
                      </p>
                      <p className="mt-1 break-words text-xs font-black text-[#35564C]">
                        {approveDestination}
                      </p>
                      {approveDestinationCode && (
                        <p className="mt-1 text-[9px] font-bold text-gray-400">
                          {approveDestinationCode}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E1EAE6] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F6F3] text-[#607A70]">
                      <Package size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-[#9AA7A2]">
                        Total Item
                      </p>
                      <p className="mt-1 text-xs font-black text-[#35564C]">
                        {approveItemCount.toLocaleString("id-ID")} item
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative mt-4 overflow-hidden rounded-2xl border border-[#CFE1D9] bg-gradient-to-br from-[#18352D] via-[#244D41] to-[#497F70] p-5 text-white">
                <div className="relative flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/50">
                      Nilai Purchase Order
                    </p>
                    <p className="mt-2 text-xl font-black sm:text-2xl">
                      {formatRupiah(approveTotal)}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <CircleDollarSign size={21} />
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[#497F70]" />
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#35564C]">
                    Dampak Approval
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    {
                      icon: CheckCircle2,
                      title: "Status PO",
                      description: "DRAFT → APPROVED",
                    },
                    {
                      icon: Package,
                      title: "Procurement",
                      description: "Siap diproses",
                    },
                    {
                      icon: Receipt,
                      title: "Nilai Transaksi",
                      description: formatRupiah(approveTotal),
                    },
                    {
                      icon: LockKeyhole,
                      title: "Alur Draft",
                      description: "Keluar dari antrean draft",
                    },
                  ].map((detail) => {
                    const Icon = detail.icon;

                    return (
                      <div
                        key={detail.title}
                        className="flex items-center gap-3 rounded-xl border border-[#DDE9E4] bg-[#FAFCFB] px-3 py-3"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-[#456158]">
                            {detail.title}
                          </p>
                          <p className="mt-0.5 break-words text-[9px] text-[#8E9D97]">
                            {detail.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <ShieldCheck
                  size={17}
                  className="mt-0.5 shrink-0 text-amber-700"
                />
                <div>
                  <p className="text-[10px] font-black text-amber-800">
                    Pastikan detail sudah benar
                  </p>
                  <p className="mt-1 text-[10px] leading-5 text-amber-700/80">
                    Pastikan nomor PO, supplier, tujuan, dan nilai transaksi
                    sudah sesuai sebelum melanjutkan approval.
                  </p>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="shrink-0 border-t border-[#E7EFEB] bg-[#FAFCFB] px-5 py-4 sm:px-7">
              <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  disabled={approveIsProcessing}
                  onClick={() => setApproveTarget(null)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-5 text-[11px] font-black uppercase tracking-wider text-[#506860] transition hover:bg-[#F2F7F4] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X size={14} />
                  Batal
                </button>

                <button
                  type="button"
                  disabled={approveIsProcessing || approvingId !== null}
                  onClick={() => void approvePurchase(approveTarget)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#497F70] via-[#3F7061] to-[#315E50] px-6 text-[11px] font-black uppercase tracking-wider text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {approveIsProcessing ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Approve Purchase Order
                    </>
                  )}
                </button>
              </div>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-[9px] text-[#9AA7A2]">
                <LockKeyhole size={10} />
                Approval diproses melalui transaksi sistem.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
