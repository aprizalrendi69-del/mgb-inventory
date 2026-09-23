"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Edit3,
  Eye,
  FileText,
  Loader2,
  Package,
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  Search,
  Store,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";

import { useRouter } from "next/navigation";

// ============================================================
// TYPES
// ============================================================

type DeliveryRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PROCESSING"
  | "COMPLETED"
  | "CANCELLED";

type CurrentUser = {
  id: number;
  username: string;
  fullname: string;
  role: string;
  active: boolean;
  outletId: number | null;
  customerId: number | null;
};

type Outlet = {
  id: number;
  code: string;
  name: string;
  active: boolean;
};

type Customer = {
  id: number;
  code: string;
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  contactPerson?: string | null;
};

type Barang = {
  id: number;
  code: string;
  name: string;

  // Delivery Request menggunakan SATUAN TRANSAKSI.
  unit?: string | null;

  // Legacy compatibility.
  baseUnit?: string | null;

  stock?: number | null;
};

type Delivery = {
  id: number;
  number: string;
  status: string;
  deliveryDate?: string | null;
  totalQty?: number | null;

  customer?: {
    id: number;
    code: string;
    name: string;
  } | null;
};

type DeliveryRequestItem = {
  id: number;
  barangId: number;
  qty: number;
  note?: string | null;
  barang: Barang;
};

type DeliveryRequest = {
  id: number;
  number: string;
  requestDate: string;
  status: DeliveryRequestStatus;
  remarks?: string | null;

  outlet: Outlet;

  createdBy: {
    id: number;
    username: string;
    fullname: string;
    role: string;
    customerId?: number | null;
    customer?: Customer | null;
  };

  customer: Customer;

  delivery?: Delivery | null;

  items: DeliveryRequestItem[];

  createdAt?: string;
  updatedAt?: string;
};

// ============================================================
// DESIGN TOKENS
// ============================================================

const UI = {
  primary: "#041C17",
  secondary: "#09261F",
  emerald: "#0B6B55",
  emeraldBright: "#10B981",
  soft: "#ECF7F3",
  page: "#F3F8F6",
  border: "#DCEAE5",
  text: "#10201C",
  muted: "#70817C",
};

// ============================================================
// HELPERS
// ============================================================

function formatDate(
  value: string | Date | null | undefined
) {
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

function formatDateTime(
  value: string | Date | null | undefined
) {
  if (!value) return "-";

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

function formatNumber(
  value: number | null | undefined
) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function pdfSafeText(value: unknown) {
  return String(value ?? "-")
    .replace(/[•●▪▫]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/–/g, "-")
    .replace(/—/g, "-");
}

function getTransactionUnit(
  barang: Barang | null | undefined
) {
  return barang?.unit || "-";
}

function normalizeRole(role: unknown) {
  return String(role ?? "")
    .trim()
    .toUpperCase();
}

// ============================================================
// DELETE PERMISSION
// ============================================================

function canDeleteDeliveryRequest(
  user: CurrentUser | null,
  request: DeliveryRequest
) {
  if (!user) {
    return false;
  }

  const role = normalizeRole(user.role);

  if (role === "ADMIN") {
    return true;
  }

  if (role === "OUTLET_ADMIN") {
    if (!user.outletId) {
      return false;
    }

    return (
      Number(request.outlet?.id) ===
      Number(user.outletId)
    );
  }

  return false;
}

// ============================================================
// EDIT PERMISSION
// ============================================================

function canEditDeliveryRequest(
  user: CurrentUser | null,
  request: DeliveryRequest
) {
  if (!user || request.status !== "PENDING" || request.delivery) {
    return false;
  }

  const role = normalizeRole(user.role);

  if (role === "ADMIN") {
    return true;
  }

  if (role === "OUTLET_ADMIN") {
    if (!user.outletId) {
      return false;
    }

    return (
      Number(request.outlet?.id) ===
      Number(user.outletId)
    );
  }

  return false;
}

// ============================================================
// STATUS DELETE RULE
// ============================================================

function canDeleteRequestStatus(
  request: DeliveryRequest
) {
  const protectedStatuses: DeliveryRequestStatus[] = [
    "PROCESSING",
    "COMPLETED",
  ];

  if (
    protectedStatuses.includes(
      request.status
    )
  ) {
    return false;
  }

  if (request.delivery) {
    return false;
  }

  return true;
}

// ============================================================
// STATUS
// ============================================================

function getStatusLabel(
  status: DeliveryRequestStatus
) {
  switch (status) {
    case "PENDING":
      return "Menunggu Approval";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Ditolak";
    case "PROCESSING":
      return "Diproses";
    case "COMPLETED":
      return "Selesai";
    case "CANCELLED":
      return "Dibatalkan";
    default:
      return status;
  }
}

function getStatusClass(
  status: DeliveryRequestStatus
) {
  switch (status) {
    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "PROCESSING":
      return "border-violet-200 bg-violet-50 text-violet-700";

    case "COMPLETED":
      return "border-green-200 bg-green-50 text-green-700";

    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-700";

    case "CANCELLED":
      return "border-slate-200 bg-slate-100 text-slate-600";

    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function getStatusIcon(
  status: DeliveryRequestStatus
) {
  switch (status) {
    case "PENDING":
      return Clock3;
    case "APPROVED":
      return CheckCircle2;
    case "PROCESSING":
      return PackageCheck;
    case "COMPLETED":
      return CheckCircle2;
    case "REJECTED":
      return XCircle;
    case "CANCELLED":
      return XCircle;
    default:
      return Clock3;
  }
}

// ============================================================
// PAGE
// ============================================================

export default function DeliveryRequestPage() {
  const router = useRouter();

  const [data, setData] =
    useState<DeliveryRequest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<
      "ALL" | DeliveryRequestStatus
    >("ALL");

  const [selectedRequest, setSelectedRequest] =
    useState<DeliveryRequest | null>(null);

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  const [loadingUser, setLoadingUser] =
    useState(true);

  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  const [barangs, setBarangs] =
    useState<Barang[]>([]);

  const [loadingBarang, setLoadingBarang] =
    useState(false);

  // ==========================================================
  // MASTER BARANG
  // ==========================================================

  const loadBarang = useCallback(async () => {
    try {
      setLoadingBarang(true);

      const response = await fetch(
        "/api/master/barang",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message ||
            "Gagal mengambil master barang"
        );
      }

      const rows =
        Array.isArray(result.data)
          ? result.data
          : Array.isArray(result.barang)
            ? result.barang
            : [];

      setBarangs(
        rows.map((item: any) => ({
          id: Number(item.id),
          code: item.code || "",
          name: item.name || "",
          unit: item.unit || item.baseUnit || null,
          baseUnit: item.baseUnit || null,
          stock:
            item.stock != null
              ? Number(item.stock)
              : 0,
        }))
      );
    } catch (err) {
      console.error(
        "LOAD MASTER BARANG ERROR:",
        err
      );
    } finally {
      setLoadingBarang(false);
    }
  }, []);

  // ==========================================================
  // CURRENT USER
  // ==========================================================

  const loadCurrentUser =
    useCallback(async () => {
      try {
        setLoadingUser(true);

        const response = await fetch(
          "/api/me",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result?.success
        ) {
          throw new Error(
            result?.message ||
              "Gagal mengambil data user"
          );
        }

        const rawUser =
          result?.user ??
          result?.data ??
          result?.currentUser ??
          null;

        if (!rawUser) {
          throw new Error(
            "Data user tidak ditemukan"
          );
        }

        setCurrentUser({
          id: Number(rawUser.id),
          username:
            rawUser.username || "",
          fullname:
            rawUser.fullname || "",
          role:
            normalizeRole(rawUser.role),
          active:
            rawUser.active !== false,
          outletId:
            rawUser.outletId != null
              ? Number(rawUser.outletId)
              : null,
          customerId:
            rawUser.customerId != null
              ? Number(rawUser.customerId)
              : null,
        });
      } catch (err) {
        console.error(
          "LOAD CURRENT USER ERROR:",
          err
        );

        setCurrentUser(null);
      } finally {
        setLoadingUser(false);
      }
    }, []);

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  const loadData = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const params =
          new URLSearchParams();

        if (
          statusFilter !== "ALL"
        ) {
          params.set(
            "status",
            statusFilter
          );
        }

        const query =
          params.toString();

        const response =
          await fetch(
            `/api/delivery-request${
              query
                ? `?${query}`
                : ""
            }`,
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result?.success
        ) {
          throw new Error(
            result?.message ||
              "Gagal mengambil Delivery Request"
          );
        }

        setData(
          Array.isArray(result.data)
            ? result.data
            : []
        );
      } catch (err) {
        console.error(
          "LOAD DELIVERY REQUEST ERROR:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Gagal mengambil Delivery Request"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter]
  );

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    loadBarang();
  }, [loadBarang]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==========================================================
  // SEARCH
  // ==========================================================

  const filteredData =
    useMemo(() => {
      const keyword =
        search.trim().toLowerCase();

      if (!keyword) {
        return data;
      }

      return data.filter(
        (item) => {
          const values = [
            item.number,
            item.outlet?.code,
            item.outlet?.name,
            item.customer?.code,
            item.customer?.name,
            item.createdBy?.username,
            item.createdBy?.fullname,
            item.remarks,
            ...item.items.flatMap(
              (requestItem) => [
                requestItem.barang?.code,
                requestItem.barang?.name,
                requestItem.note,
              ]
            ),
          ];

          return values.some(
            (value) =>
              String(value ?? "")
                .toLowerCase()
                .includes(keyword)
          );
        }
      );
    }, [data, search]);

  // ==========================================================
  // SUMMARY
  // ==========================================================

  const summary = useMemo(() => {
    const pending =
      data.filter(
        (item) =>
          item.status === "PENDING"
      ).length;

    const approved =
      data.filter(
        (item) =>
          item.status === "APPROVED"
      ).length;

    const processing =
      data.filter(
        (item) =>
          item.status === "PROCESSING"
      ).length;

    const completed =
      data.filter(
        (item) =>
          item.status === "COMPLETED"
      ).length;

    const totalQty =
      data.reduce(
        (total, request) =>
          total +
          request.items.reduce(
            (sum, item) =>
              sum +
              Number(
                item.qty || 0
              ),
            0
          ),
        0
      );

    const totalNotes =
      data.reduce(
        (total, request) =>
          total +
          request.items.filter(
            (item) =>
              Boolean(
                item.note?.trim()
              )
          ).length,
        0
      );

    return {
      pending,
      approved,
      processing,
      completed,
      totalQty,
      totalNotes,
    };
  }, [data]);

  // ==========================================================
  // ACTIONS
  // ==========================================================

  function handleCreate() {
    router.push(
      "/outlet/delivery-request/new"
    );
  }

  function handleOpenDetail(
    request: DeliveryRequest
  ) {
    setSelectedRequest(request);
  }

  function handleCloseDetail() {
    setSelectedRequest(null);
  }

  // ==========================================================
  // UPDATE DETAIL SETELAH EDIT
  // ==========================================================

  function handleRequestUpdated(
    updatedRequest: DeliveryRequest
  ) {
    setSelectedRequest(updatedRequest);

    setData((previous) =>
      previous.map((item) =>
        item.id === updatedRequest.id
          ? updatedRequest
          : item
      )
    );
  }

  // ==========================================================
  // DELETE
  // ==========================================================

  const handleDeleteRequest =
    useCallback(
      async (
        request: DeliveryRequest
      ) => {
        if (
          !canDeleteDeliveryRequest(
            currentUser,
            request
          )
        ) {
          setError(
            "Anda tidak memiliki akses untuk menghapus Delivery Request ini."
          );
          return;
        }

        if (
          !canDeleteRequestStatus(
            request
          )
        ) {
          setError(
            "Delivery Request yang sudah diproses atau sudah memiliki Delivery tidak dapat dihapus."
          );
          return;
        }

        const confirmed =
          window.confirm(
            `Hapus Delivery Request ${request.number}?\n\nSemua item dalam request ini juga akan dihapus.\n\nStock Gudang Pusat tidak akan berubah karena request belum merupakan transaksi stock.`
          );

        if (!confirmed) {
          return;
        }

        try {
          setDeletingId(
            request.id
          );

          setError("");

          const response =
            await fetch(
              `/api/delivery-request?id=${request.id}`,
              {
                method: "DELETE",
                cache: "no-store",
              }
            );

          const result =
            await response.json();

          if (
            !response.ok ||
            !result?.success
          ) {
            throw new Error(
              result?.message ||
                "Gagal menghapus Delivery Request"
            );
          }

          setData(
            (previous) =>
              previous.filter(
                (item) =>
                  item.id !==
                  request.id
              )
          );

          setSelectedRequest(
            (previous) =>
              previous?.id ===
              request.id
                ? null
                : previous
          );
        } catch (err) {
          console.error(
            "DELETE DELIVERY REQUEST ERROR:",
            err
          );

          setError(
            err instanceof Error
              ? err.message
              : "Gagal menghapus Delivery Request"
          );
        } finally {
          setDeletingId(null);
        }
      },
      [currentUser]
    );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      className="min-h-screen bg-[#F3F8F6] p-4 md:p-6"
      style={{
        backgroundImage:
          "radial-gradient(circle at 10% 0%, rgba(16,185,129,0.055), transparent 28%), radial-gradient(circle at 90% 15%, rgba(4,28,23,0.045), transparent 30%)",
      }}
    >
      <div className="mx-auto max-w-[1480px] space-y-5">

        {/* ==================================================
            PREMIUM HEADER
        ================================================== */}

        <section className="relative overflow-hidden rounded-[30px] border border-[#12382F] bg-[#041C17] shadow-[0_24px_70px_rgba(4,28,23,0.18)]">
          <div
            className="absolute inset-0 opacity-90"
            style={{
              background:
                "radial-gradient(circle at 90% 0%, rgba(16,185,129,0.24), transparent 30%), radial-gradient(circle at 65% 110%, rgba(16,185,129,0.10), transparent 38%)",
            }}
          />

          <div className="absolute right-[-100px] top-[-120px] h-72 w-72 rounded-full border border-emerald-400/10" />
          <div className="absolute right-[-55px] top-[-75px] h-48 w-48 rounded-full border border-emerald-400/10" />

          <div className="relative p-6 md:p-8">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-start gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-emerald-300/20 bg-[#09261F] text-emerald-300 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                  <Package className="h-7 w-7" />

                  <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-[3px] border-[#041C17] bg-emerald-400" />
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      Outlet Logistics
                    </span>

                    <span className="text-xs font-medium text-emerald-100/45">
                      / Delivery Request
                    </span>
                  </div>

                  <h1 className="text-2xl font-black tracking-tight text-white md:text-[30px]">
                    Delivery Request
                  </h1>

                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-emerald-100/65">
                    Kelola permintaan barang outlet
                    menuju Gudang Pusat secara
                    terkontrol, terukur, dan
                    terdokumentasi.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    loadData(true)
                  }
                  disabled={refreshing}
                  className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 text-sm font-bold text-emerald-50 backdrop-blur-sm transition-all hover:border-emerald-300/30 hover:bg-emerald-300/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-4 w-4 transition-transform ${
                      refreshing
                        ? "animate-spin"
                        : "group-hover:rotate-180"
                    }`}
                  />

                  Refresh
                </button>

                <button
                  type="button"
                  onClick={handleCreate}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-black text-[#041C17] shadow-[0_10px_28px_rgba(16,185,129,0.22)] transition-all hover:-translate-y-0.5 hover:bg-emerald-400 hover:shadow-[0_15px_34px_rgba(16,185,129,0.30)]"
                >
                  <Package className="h-4 w-4" />
                  Buat Delivery Request
                </button>
              </div>
            </div>

            {/* HEADER MINI STATS */}

            <div className="mt-7 grid grid-cols-2 gap-3 border-t border-white/[0.08] pt-5 md:grid-cols-4">
              <HeaderMiniStat
                label="Total Request"
                value={data.length}
              />

              <HeaderMiniStat
                label="Menunggu Approval"
                value={summary.pending}
                positive
              />

              <HeaderMiniStat
                label="Sedang Diproses"
                value={summary.processing}
              />

              <HeaderMiniStat
                label="Total Qty"
                value={formatNumber(
                  summary.totalQty
                )}
              />
            </div>
          </div>
        </section>

        {/* ==================================================
            FLOW
        ================================================== */}

        <section className="overflow-hidden rounded-[26px] border border-[#CFE3DC] bg-white shadow-[0_12px_38px_rgba(4,28,23,0.055)]">
          <div className="p-5 md:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#09261F] text-emerald-300 shadow-[0_8px_20px_rgba(4,28,23,0.14)]">
                <PackageCheck className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-sm font-extrabold text-[#10201C]">
                  Alur Delivery Request
                </h2>

                <p className="mt-0.5 text-xs text-[#70817C]">
                  Request outlet diproses melalui
                  Gudang Pusat.
                </p>
              </div>
            </div>

            <div className="grid gap-2.5 md:grid-cols-5">
              {[
                {
                  no: "01",
                  title: "Request",
                  text: "Outlet membuat kebutuhan barang",
                  active: true,
                },
                {
                  no: "02",
                  title: "Approval",
                  text: "Pusat melakukan approval",
                },
                {
                  no: "03",
                  title: "Barang Keluar",
                  text: "Request masuk ke Barang Keluar Pusat",
                },
                {
                  no: "04",
                  title: "Release",
                  text: "Barang keluar dari Gudang Pusat",
                },
                {
                  no: "05",
                  title: "Barang Masuk",
                  text: "Outlet menerima dan stock bertambah",
                },
              ].map((step, index) => (
                <div
                  key={step.no}
                  className={`group relative rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    step.active
                      ? "border-emerald-200 bg-[#F3FAF7] shadow-sm"
                      : "border-[#E1EBE7] bg-[#FAFCFB]"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className={`text-[11px] font-black tracking-wider ${
                        step.active
                          ? "text-[#0B6B55]"
                          : "text-[#9AA9A4]"
                      }`}
                    >
                      {step.no}
                    </span>

                    {index < 4 && (
                      <ArrowRight className="h-3.5 w-3.5 text-[#C3D2CD]" />
                    )}
                  </div>

                  <p className="text-sm font-extrabold text-[#10201C]">
                    {step.title}
                  </p>

                  <p className="mt-1 text-[11px] leading-5 text-[#70817C]">
                    {step.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================================================
            SUMMARY CARDS
        ================================================== */}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryCard
            title="Total Request"
            value={data.length}
            icon={FileText}
          />

          <SummaryCard
            title="Pending"
            value={summary.pending}
            icon={Clock3}
            highlight="amber"
          />

          <SummaryCard
            title="Approved"
            value={summary.approved}
            icon={CheckCircle2}
            highlight="emerald"
          />

          <SummaryCard
            title="Processing"
            value={summary.processing}
            icon={PackageCheck}
            highlight="violet"
          />

          <SummaryCard
            title="Total Qty"
            value={formatNumber(
              summary.totalQty
            )}
            icon={Package}
            highlight="green"
          />

          <SummaryCard
            title="Catatan Item"
            value={summary.totalNotes}
            icon={FileText}
            highlight="slate"
          />
        </div>

        {/* ==================================================
            FILTER
        ================================================== */}

        <section className="rounded-[26px] border border-[#DCEAE5] bg-white shadow-[0_10px_32px_rgba(4,28,23,0.045)]">
          <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A9B95]" />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Cari nomor request, customer, outlet, user, barang, catatan..."
                className="h-11 w-full rounded-xl border border-[#DCEAE5] bg-[#F7FAF9] pl-10 pr-10 text-sm font-medium text-[#10201C] outline-none transition placeholder:text-[#9AA9A4] focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg text-[#8A9B95] hover:bg-[#EAF4F0] hover:text-[#09261F]"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | "ALL"
                      | DeliveryRequestStatus
                  )
                }
                className="h-11 min-w-[200px] appearance-none rounded-xl border border-[#DCEAE5] bg-white pl-4 pr-10 text-sm font-bold text-[#30443E] outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              >
                <option value="ALL">
                  Semua Status
                </option>
                <option value="PENDING">
                  Pending
                </option>
                <option value="APPROVED">
                  Approved
                </option>
                <option value="PROCESSING">
                  Processing
                </option>
                <option value="COMPLETED">
                  Completed
                </option>
                <option value="REJECTED">
                  Rejected
                </option>
                <option value="CANCELLED">
                  Cancelled
                </option>
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A9B95]" />
            </div>
          </div>
        </section>

        {/* ==================================================
            ERROR
        ================================================== */}

        {error && (
          <div className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
            <div className="border-l-4 border-red-500 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <XCircle className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-bold text-red-900">
                    Gagal memproses data
                  </p>

                  <p className="mt-1 text-xs leading-5 text-red-700">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================
            LOADING
        ================================================== */}

        {loading ? (
          <div className="rounded-[26px] border border-[#DCEAE5] bg-white p-16 text-center shadow-[0_10px_35px_rgba(4,28,23,0.045)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#EAF5F1]">
              <Loader2 className="h-7 w-7 animate-spin text-[#0B6B55]" />
            </div>

            <p className="mt-5 text-sm font-extrabold text-[#10201C]">
              Memuat Delivery Request...
            </p>

            <p className="mt-1 text-xs text-[#8A9B95]">
              Menyiapkan data transaksi.
            </p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="rounded-[26px] border border-dashed border-[#BFD3CC] bg-white p-14 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#EAF5F1] text-[#0B6B55]">
              <Package className="h-8 w-8" />
            </div>

            <h3 className="mt-5 text-lg font-black text-[#10201C]">
              Belum ada Delivery Request
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#70817C]">
              Belum ada permintaan barang yang
              sesuai dengan filter saat ini.
            </p>

            <button
              type="button"
              onClick={handleCreate}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#09261F] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(4,28,23,0.18)] transition hover:-translate-y-0.5 hover:bg-[#0D3329] hover:shadow-[0_14px_30px_rgba(4,28,23,0.22)]"
            >
              <Package className="h-4 w-4" />
              Buat Delivery Request
            </button>
          </div>
        ) : (
          /* ==================================================
             TABLE
          ================================================== */

          <section className="overflow-hidden rounded-[26px] border border-[#DCEAE5] bg-white shadow-[0_14px_40px_rgba(4,28,23,0.055)]">
            <div className="flex flex-col gap-3 border-b border-[#E3ECE9] bg-[#F8FBFA] px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-[#10201C]">
                  Daftar Delivery Request
                </p>

                <p className="mt-0.5 text-xs text-[#70817C]">
                  Request outlet yang tercatat
                  dalam sistem.
                </p>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-[#EAF6F1] px-3 py-1.5 text-xs font-bold text-[#0B6B55]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_7px_rgba(16,185,129,0.5)]" />
                {filteredData.length} Request
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full">
                <thead>
                  <tr className="border-b border-[#173B32] bg-[#09261F]">
                    <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/60">
                      Request
                    </th>

                    <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/60">
                      Outlet
                    </th>

                    <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/60">
                      Customer
                    </th>

                    <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/60">
                      Barang
                    </th>

                    <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/60">
                      Tanggal
                    </th>

                    <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/60">
                      Status
                    </th>

                    <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/60">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E8EFEC]">
                  {filteredData.map(
                    (request) => {
                      const StatusIcon =
                        getStatusIcon(
                          request.status
                        );

                      const totalQty =
                        request.items.reduce(
                          (sum, item) =>
                            sum +
                            Number(
                              item.qty || 0
                            ),
                          0
                        );

                      const noteCount =
                        request.items.filter(
                          (item) =>
                            Boolean(
                              item.note?.trim()
                            )
                        ).length;

                      const canDelete =
                        canDeleteDeliveryRequest(
                          currentUser,
                          request
                        ) &&
                        canDeleteRequestStatus(
                          request
                        );

                      const isDeleting =
                        deletingId ===
                        request.id;

                      return (
                        <tr
                          key={request.id}
                          className="group transition-all hover:bg-[#F1F8F5]"
                        >
                          {/* REQUEST */}

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D5E8E1] bg-[#EAF5F1] text-[#0B6B55] transition group-hover:border-emerald-200 group-hover:bg-[#DDF1EA]">
                                <FileText className="h-4 w-4" />
                              </div>

                              <div>
                                <p className="font-black text-[#10201C]">
                                  {request.number}
                                </p>

                                <p className="mt-1 text-[11px] text-[#70817C]">
                                  Dibuat oleh{" "}
                                  <span className="font-semibold text-[#40534D]">
                                    {request
                                      .createdBy
                                      ?.fullname ||
                                      request
                                        .createdBy
                                        ?.username ||
                                      "-"}
                                  </span>
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* OUTLET */}

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF5F1] text-[#0B6B55]">
                                <Store className="h-4 w-4" />
                              </div>

                              <div>
                                <p className="text-sm font-bold text-[#243A34]">
                                  {
                                    request
                                      .outlet
                                      ?.name
                                  }
                                </p>

                                <p className="mt-0.5 text-[11px] font-medium text-[#8A9B95]">
                                  {
                                    request
                                      .outlet
                                      ?.code
                                  }
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* CUSTOMER */}

                          <td className="px-5 py-4">
                            <p className="text-sm font-bold text-[#243A34]">
                              {
                                request
                                  .customer
                                  ?.name
                              }
                            </p>

                            <p className="mt-0.5 text-[11px] font-medium text-[#8A9B95]">
                              {
                                request
                                  .customer
                                  ?.code
                              }
                            </p>
                          </td>

                          {/* ITEMS */}

                          <td className="px-5 py-4">
                            <p className="text-sm font-bold text-[#243A34]">
                              {
                                request.items
                                  .length
                              }{" "}
                              jenis barang
                            </p>

                            <p className="mt-1 text-[11px] text-[#70817C]">
                              Total qty:{" "}
                              <span className="font-bold text-[#40534D]">
                                {formatNumber(
                                  totalQty
                                )}
                              </span>
                            </p>

                            {noteCount > 0 && (
                              <p className="mt-1 text-[11px] font-bold text-[#0B6B55]">
                                {noteCount}{" "}
                                catatan barang
                              </p>
                            )}
                          </td>

                          {/* DATE */}

                          <td className="px-5 py-4">
                            <div className="inline-flex items-center gap-2 rounded-lg border border-[#E3ECE9] bg-[#F7FAF9] px-2.5 py-1.5">
                              <CalendarDays className="h-3.5 w-3.5 text-[#0B8064]" />

                              <span className="text-xs font-semibold text-[#40534D]">
                                {formatDate(
                                  request.requestDate
                                )}
                              </span>
                            </div>
                          </td>

                          {/* STATUS */}

                          <td className="px-5 py-4">
                            <div
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black ${getStatusClass(
                                request.status
                              )}`}
                            >
                              <StatusIcon className="h-3.5 w-3.5" />

                              {getStatusLabel(
                                request.status
                              )}
                            </div>
                          </td>

                          {/* ACTION */}

                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenDetail(
                                    request
                                  )
                                }
                                className="inline-flex items-center gap-2 rounded-xl border border-[#D6E4DF] bg-white px-3.5 py-2 text-xs font-bold text-[#30443E] shadow-sm transition-all hover:border-emerald-300 hover:bg-[#EAF5F1] hover:text-[#09261F] hover:shadow"
                              >
                                <Eye className="h-4 w-4" />
                                Detail
                              </button>

                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteRequest(
                                      request
                                    )
                                  }
                                  disabled={
                                    isDeleting
                                  }
                                  title="Hapus Delivery Request"
                                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-bold text-red-600 shadow-sm transition-all hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isDeleting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}

                                  {isDeleting
                                    ? "Menghapus..."
                                    : "Hapus"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-[#E3ECE9] bg-[#F7FAF9] px-5 py-4 text-[11px] text-[#70817C] md:flex-row md:items-center md:justify-between">
              <span>
                Menampilkan{" "}
                <strong className="text-[#243A34]">
                  {filteredData.length}
                </strong>{" "}
                dari{" "}
                <strong className="text-[#243A34]">
                  {data.length}
                </strong>{" "}
                request
              </span>

              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Stock Gudang Pusat belum
                berkurang pada tahap request.
              </span>
            </div>
          </section>
        )}
      </div>

      {/* ======================================================
          DETAIL MODAL
      ====================================================== */}

      {selectedRequest && (
        <DetailModal
          request={selectedRequest}
          currentUser={currentUser}
          deletingId={deletingId}
          barangs={barangs}
          loadingBarang={loadingBarang}
          onClose={handleCloseDetail}
          onDelete={handleDeleteRequest}
          onUpdated={handleRequestUpdated}
        />
      )}
    </div>
  );
}

// ============================================================
// HEADER MINI STAT
// ============================================================

function HeaderMiniStat({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: string | number;
  positive?: boolean;
}) {
  return (
    <div className="border-l border-white/[0.08] pl-3 first:border-l-0 first:pl-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/45">
        {label}
      </p>

      <div className="mt-1 flex items-center gap-2">
        <p className="text-lg font-black text-white">
          {value}
        </p>

        {positive && (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.8)]" />
        )}
      </div>
    </div>
  );
}

// ============================================================
// SUMMARY CARD
// ============================================================

function SummaryCard({
  title,
  value,
  icon: Icon,
  highlight = "slate",
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  highlight?:
    | "slate"
    | "amber"
    | "emerald"
    | "violet"
    | "green";
}) {
  const styles = {
    slate: {
      icon: "border-[#DCE7E3] bg-[#F1F5F3] text-[#52645E]",
      glow: "group-hover:border-[#BFD2CB]",
    },

    amber: {
      icon: "border-amber-100 bg-amber-50 text-amber-600",
      glow: "group-hover:border-amber-200",
    },

    emerald: {
      icon: "border-emerald-100 bg-emerald-50 text-[#0B6B55]",
      glow: "group-hover:border-emerald-200",
    },

    violet: {
      icon: "border-violet-100 bg-violet-50 text-violet-600",
      glow: "group-hover:border-violet-200",
    },

    green: {
      icon: "border-green-100 bg-green-50 text-green-600",
      glow: "group-hover:border-green-200",
    },
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-[22px] border border-[#DCE7E3] bg-white p-4 shadow-[0_7px_24px_rgba(4,28,23,0.035)] transition-all hover:-translate-y-1 hover:shadow-[0_15px_34px_rgba(4,28,23,0.08)] ${styles[highlight].glow}`}
    >
      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-emerald-100/50 opacity-0 blur-2xl transition group-hover:opacity-100" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-wider text-[#879892]">
            {title}
          </p>

          <p className="mt-1.5 text-xl font-black tracking-tight text-[#10201C]">
            {value}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${styles[highlight].icon}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SEARCHABLE BARANG SELECT
// ============================================================

function SearchableBarangSelect({
  value,
  barangs,
  disabled,
  excludeIds,
  onChange,
}: {
  value: number;
  barangs: Barang[];
  disabled?: boolean;
  excludeIds?: Set<number>;
  onChange: (barangId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedBarang =
    barangs.find(
      (barang) =>
        Number(barang.id) === Number(value)
    ) ?? null;

  const normalizedQuery =
    query.trim().toLowerCase();

  const filteredBarangs = barangs.filter((barang) => {
    const matchesSearch =
      !normalizedQuery ||
      `${barang.code} ${barang.name}`
        .toLowerCase()
        .includes(normalizedQuery);

    return matchesSearch;
  });

  function handleSelect(barang: Barang) {
    if (
      excludeIds?.has(Number(barang.id)) &&
      Number(barang.id) !== Number(value)
    ) {
      return;
    }

    onChange(Number(barang.id));
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <div
        className={`flex min-h-11 w-full items-center rounded-xl border bg-[#F8FBFA] transition ${
          open
            ? "border-emerald-500 bg-white ring-4 ring-emerald-500/10"
            : "border-[#DCE7E3]"
        } ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : ""
        }`}
      >
        <input
          type="text"
          value={open ? query : ""}
          onFocus={() => {
            if (!disabled) {
              setOpen(true);
              setQuery("");
            }
          }}
          onChange={(event) => {
            if (!disabled) {
              setQuery(event.target.value);
              setOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setQuery("");
              setOpen(false);
            }
          }}
          disabled={disabled}
          placeholder={
            open
              ? "Ketik kode / nama barang..."
              : selectedBarang
                ? `${selectedBarang.code} - ${selectedBarang.name}`
                : "Pilih barang..."
          }
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-bold text-[#243A34] outline-none placeholder:text-[#9AA9A4] disabled:cursor-not-allowed"
        />

        <button
          type="button"
          onClick={() => {
            if (!disabled) {
              setOpen((previous) => !previous);
              setQuery("");
            }
          }}
          disabled={disabled}
          className="flex h-10 w-10 shrink-0 items-center justify-center text-[#70817C] transition hover:text-[#0B6B55] disabled:cursor-not-allowed"
          aria-label="Buka pilihan barang"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {open && !disabled && (
        <div className="absolute left-0 right-0 z-[80] mt-2 max-h-72 overflow-hidden rounded-2xl border border-[#DCE7E3] bg-white shadow-[0_18px_45px_rgba(4,28,23,0.16)]">
          <div className="border-b border-[#E8EFEC] bg-[#F7FAF9] px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#8A9B95]">
              Pilih Barang
            </p>
            <p className="mt-0.5 text-[10px] text-[#70817C]">
              Ketik kode atau nama barang untuk mencari.
            </p>
          </div>

          <div className="max-h-56 overflow-y-auto p-1.5">
            {filteredBarangs.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <Package className="mx-auto h-5 w-5 text-[#A7B8B2]" />
                <p className="mt-2 text-xs font-bold text-[#52645E]">
                  Barang tidak ditemukan
                </p>
                <p className="mt-1 text-[10px] text-[#8A9B95]">
                  Coba ketik kode atau nama yang berbeda.
                </p>
              </div>
            ) : (
              filteredBarangs.map((barang) => {
                const isExcluded =
                  excludeIds?.has(Number(barang.id)) &&
                  Number(barang.id) !== Number(value);

                const isSelected =
                  Number(barang.id) === Number(value);

                return (
                  <button
                    key={barang.id}
                    type="button"
                    onMouseDown={(event) =>
                      event.preventDefault()
                    }
                    onClick={() =>
                      handleSelect(barang)
                    }
                    disabled={isExcluded}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      isSelected
                        ? "bg-[#EAF5F1] text-[#0B6B55]"
                        : isExcluded
                          ? "cursor-not-allowed opacity-35"
                          : "text-[#243A34] hover:bg-[#F1F8F5]"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isSelected
                          ? "bg-[#09261F] text-emerald-300"
                          : "bg-[#F1F6F4] text-[#0B6B55]"
                      }`}
                    >
                      <Package className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black">
                        {barang.name}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[#70817C]">
                        <span className="font-bold text-[#40534D]">
                          {barang.code}
                        </span>
                        <span>•</span>
                        <span>
                          Satuan:{" "}
                          {getTransactionUnit(barang)}
                        </span>
                        <span>•</span>
                        <span>
                          Stock:{" "}
                          {formatNumber(
                            barang.stock ?? 0
                          )}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#0B6B55]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// DETAIL MODAL
// ============================================================

function DetailModal({
  request,
  currentUser,
  deletingId,
  barangs,
  loadingBarang,
  onClose,
  onDelete,
  onUpdated,
}: {
  request: DeliveryRequest;
  currentUser: CurrentUser | null;
  deletingId: number | null;
  barangs: Barang[];
  loadingBarang: boolean;
  onClose: () => void;
  onDelete: (
    request: DeliveryRequest
  ) => void;
  onUpdated: (
    request: DeliveryRequest
  ) => void;
}) {
  const [downloadingPdf, setDownloadingPdf] =
    useState(false);

  const [editingRequest, setEditingRequest] =
    useState(false);

  const [savingEdit, setSavingEdit] =
    useState(false);

  const [editItems, setEditItems] =
    useState<
      Array<{
        id?: number;
        barangId: number;
        qty: number;
        note: string;
      }>
    >([]);

  const totalQty =
    request.items.reduce(
      (sum, item) =>
        sum + Number(item.qty || 0),
      0
    );

  const totalNotes =
    request.items.filter(
      (item) =>
        Boolean(item.note?.trim())
    ).length;

  const canDelete =
    canDeleteDeliveryRequest(
      currentUser,
      request
    ) &&
    canDeleteRequestStatus(
      request
    );

  const isDeleting =
    deletingId === request.id;

  const canEdit =
    canEditDeliveryRequest(
      currentUser,
      request
    );

  function startEditRequest() {
    if (!canEdit) {
      return;
    }

    setEditItems(
      request.items.map((item) => ({
        id: item.id,
        barangId: Number(item.barangId),
        qty: Number(item.qty || 0),
        note: item.note || "",
      }))
    );

    setEditingRequest(true);
  }

  function cancelEditRequest() {
    setEditingRequest(false);
    setEditItems([]);
  }

  function addEditItem() {
    const selectedIds = new Set(
      editItems.map((item) =>
        Number(item.barangId)
      )
    );

    const available = barangs.find(
      (barang) =>
        !selectedIds.has(Number(barang.id))
    );

    if (!available) {
      window.alert(
        "Semua barang yang tersedia sudah ada di request."
      );
      return;
    }

    setEditItems((previous) => [
      ...previous,
      {
        barangId: Number(available.id),
        qty: 1,
        note: "",
      },
    ]);
  }

  function removeEditItem(index: number) {
    if (editItems.length <= 1) {
      window.alert(
        "Delivery Request harus memiliki minimal satu barang."
      );
      return;
    }

    setEditItems((previous) =>
      previous.filter((_, itemIndex) =>
        itemIndex !== index
      )
    );
  }

  function updateEditItem(
    index: number,
    field: "barangId" | "qty" | "note",
    value: number | string
  ) {
    setEditItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  async function saveEditRequest() {
    if (!canEdit) {
      window.alert(
        "Delivery Request hanya dapat diedit ketika status masih Menunggu Approval."
      );
      return;
    }

    if (editItems.length === 0) {
      window.alert(
        "Delivery Request harus memiliki minimal satu barang."
      );
      return;
    }

    const seen = new Set<number>();

    for (const item of editItems) {
      const barangId = Number(item.barangId);
      const qty = Number(item.qty);
      const masterBarang = barangs.find(
        (barang) =>
          Number(barang.id) === barangId
      );

      if (!masterBarang) {
        window.alert(
          "Barang yang dipilih tidak ditemukan."
        );
        return;
      }

      if (seen.has(barangId)) {
        window.alert(
          `Barang ${masterBarang.name} dipilih lebih dari satu kali. Gabungkan menjadi satu item.`
        );
        return;
      }

      seen.add(barangId);

      if (!Number.isFinite(qty) || qty <= 0) {
        window.alert(
          `Qty ${masterBarang.name} harus lebih dari 0.`
        );
        return;
      }

    }

    const confirmed = window.confirm(
      `Simpan perubahan Delivery Request ${request.number}?\n\nItem baru akan ditambahkan, item yang dihapus akan dikeluarkan, dan qty/catatan akan diperbarui.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setSavingEdit(true);

      const response = await fetch(
        `/api/delivery-request/${request.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: editItems.map((item) => ({
              id: item.id,
              barangId: Number(item.barangId),
              qty: Number(item.qty),
              note: item.note || "",
            })),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message ||
            "Gagal mengubah Delivery Request"
        );
      }

      const updatedRequest =
        result.data || result.request;

      if (!updatedRequest) {
        throw new Error(
          "Server tidak mengembalikan Delivery Request yang telah diperbarui."
        );
      }

      setEditingRequest(false);
      setEditItems([]);
      onUpdated(updatedRequest);

      window.alert(
        result.message ||
          "Delivery Request berhasil diperbarui."
      );
    } catch (err) {
      console.error(
        "SAVE DELIVERY REQUEST EDIT ERROR:",
        err
      );

      window.alert(
        err instanceof Error
          ? err.message
          : "Gagal mengubah Delivery Request"
      );
    } finally {
      setSavingEdit(false);
    }
  }

  // ==========================================================
  // DOWNLOAD PDF
  // ==========================================================

  const handleDownloadPDF =
    useCallback(async () => {
      if (downloadingPdf) {
        return;
      }

      try {
        setDownloadingPdf(true);

        const { default: JsPDF } =
          await import("jspdf");

        const doc =
          new JsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
          });

        const pageWidth =
          doc.internal.pageSize.getWidth();

        const pageHeight =
          doc.internal.pageSize.getHeight();

        const margin = 16;

        let y = 18;

        // ====================================================
        // PREMIUM DARK EMERALD PDF PALETTE
        // ====================================================

        const primary = {
          r: 4,
          g: 28,
          b: 23,
        };

        const secondary = {
          r: 9,
          g: 38,
          b: 31,
        };

        const emerald = {
          r: 16,
          g: 185,
          b: 129,
        };

        const emeraldDark = {
          r: 11,
          g: 107,
          b: 85,
        };

        const emeraldSoft = {
          r: 234,
          g: 246,
          b: 241,
        };

        const dark = {
          r: 16,
          g: 32,
          b: 28,
        };

        const muted = {
          r: 105,
          g: 125,
          b: 117,
        };

        const lightMuted = {
          r: 139,
          g: 157,
          b: 150,
        };

        const border = {
          r: 218,
          g: 232,
          b: 226,
        };

        const white = {
          r: 255,
          g: 255,
          b: 255,
        };

        // ====================================================
        // DRAW HELPERS
        // ====================================================

        const drawLine = (
          x1: number,
          y1: number,
          x2: number,
          y2: number
        ) => {
          doc.setDrawColor(
            border.r,
            border.g,
            border.b
          );

          doc.setLineWidth(0.25);

          doc.line(
            x1,
            y1,
            x2,
            y2
          );
        };

        const drawLabelValue = (
          label: string,
          value: string,
          x: number,
          valueY: number,
          width: number
        ) => {
          doc.setFont(
            "helvetica",
            "normal"
          );

          doc.setFontSize(7);

          doc.setTextColor(
            muted.r,
            muted.g,
            muted.b
          );

          doc.text(
            pdfSafeText(label).toUpperCase(),
            x,
            valueY
          );

          doc.setFont(
            "helvetica",
            "bold"
          );

          doc.setFontSize(9.5);

          doc.setTextColor(
            dark.r,
            dark.g,
            dark.b
          );

          const wrapped =
            doc.splitTextToSize(
              pdfSafeText(value),
              width
            );

          doc.text(
            wrapped,
            x,
            valueY + 5
          );
        };

        // ====================================================
        // PDF HEADER
        // ====================================================

        const drawPdfHeader = (
          compact = false
        ) => {
          // Main dark emerald header.
          doc.setFillColor(
            primary.r,
            primary.g,
            primary.b
          );

          doc.roundedRect(
            margin,
            y,
            pageWidth -
              margin * 2,
            compact ? 15 : 29,
            4,
            4,
            "F"
          );

          // Secondary emerald glow block.
          doc.setFillColor(
            secondary.r,
            secondary.g,
            secondary.b
          );

          doc.roundedRect(
            pageWidth - margin - 58,
            y,
            58,
            compact ? 15 : 29,
            4,
            4,
            "F"
          );

          // Accent line.
          doc.setFillColor(
            emerald.r,
            emerald.g,
            emerald.b
          );

          doc.roundedRect(
            margin,
            y,
            3,
            compact ? 15 : 29,
            2,
            2,
            "F"
          );

          doc.setTextColor(
            white.r,
            white.g,
            white.b
          );

          doc.setFont(
            "helvetica",
            "bold"
          );

          doc.setFontSize(
            compact ? 10 : 16
          );

          doc.text(
            "MGB ERP",
            margin + 8,
            y + (compact ? 10 : 11)
          );

          if (!compact) {
            doc.setFontSize(7.5);

            doc.setFont(
              "helvetica",
              "normal"
            );

            doc.setTextColor(
              191,
              221,
              211
            );

            doc.text(
              "PT. Mitra Garam Bogatama",
              margin + 8,
              y + 17
            );

            doc.setFont(
              "helvetica",
              "bold"
            );

            doc.setFontSize(10);

            doc.setTextColor(
              white.r,
              white.g,
              white.b
            );

            doc.text(
              "DELIVERY REQUEST",
              pageWidth -
                margin -
                7,
              y + 11,
              {
                align: "right",
              }
            );

            doc.setFont(
              "helvetica",
              "normal"
            );

            doc.setFontSize(7.5);

            doc.setTextColor(
              175,
              210,
              199
            );

            doc.text(
              pdfSafeText(
                request.number
              ),
              pageWidth -
                margin -
                7,
              y + 18,
              {
                align: "right",
              }
            );
          }

          y += compact ? 22 : 36;
        };

        const ensureSpace = (
          requiredHeight: number
        ) => {
          if (
            y + requiredHeight >
            pageHeight - 18
          ) {
            doc.addPage();

            y = 18;

            drawPdfHeader(true);
          }
        };

        // ====================================================
        // HEADER
        // ====================================================

        drawPdfHeader();

        // ====================================================
        // SUMMARY
        // ====================================================

        ensureSpace(34);

        doc.setFillColor(
          247,
          251,
          249
        );

        doc.roundedRect(
          margin,
          y,
          pageWidth -
            margin * 2,
          27,
          3,
          3,
          "F"
        );

        drawLabelValue(
          "Nomor Request",
          request.number,
          margin + 6,
          y + 7,
          48
        );

        drawLabelValue(
          "Tanggal Request",
          formatDate(
            request.requestDate
          ),
          margin + 62,
          y + 7,
          48
        );

        drawLabelValue(
          "Status",
          getStatusLabel(
            request.status
          ),
          margin + 118,
          y + 7,
          48
        );

        drawLabelValue(
          "Dibuat Oleh",
          request.createdBy
            ?.fullname ||
            request.createdBy
              ?.username ||
            "-",
          margin + 6,
          y + 18,
          105
        );

        drawLabelValue(
          "Total",
          `${formatNumber(
            request.items.length
          )} jenis / ${formatNumber(
            totalQty
          )} qty`,
          margin + 118,
          y + 18,
          48
        );

        y += 35;

        // ====================================================
        // TRANSACTION INFO
        // ====================================================

        ensureSpace(42);

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(10);

        doc.setTextColor(
          primary.r,
          primary.g,
          primary.b
        );

        doc.text(
          "INFORMASI TRANSAKSI",
          margin,
          y
        );

        // Accent underline.
        doc.setFillColor(
          emerald.r,
          emerald.g,
          emerald.b
        );

        doc.roundedRect(
          margin,
          y + 3,
          24,
          1.2,
          0.5,
          0.5,
          "F"
        );

        y += 8;

        const boxGap = 5;

        const boxWidth =
          (pageWidth -
            margin * 2 -
            boxGap) /
          2;

        const boxHeight = 31;

        // Outlet box.
        doc.setFillColor(
          247,
          251,
          249
        );

        doc.roundedRect(
          margin,
          y,
          boxWidth,
          boxHeight,
          3,
          3,
          "F"
        );

        doc.setFillColor(
          emeraldSoft.r,
          emeraldSoft.g,
          emeraldSoft.b
        );

        doc.roundedRect(
          margin + 5,
          y + 5,
          7,
          7,
          2,
          2,
          "F"
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(7);

        doc.setTextColor(
          muted.r,
          muted.g,
          muted.b
        );

        doc.text(
          "OUTLET",
          margin + 16,
          y + 10
        );

        doc.setFontSize(10);

        doc.setTextColor(
          dark.r,
          dark.g,
          dark.b
        );

        doc.text(
          pdfSafeText(
            request.outlet?.name
          ),
          margin + 6,
          y + 18
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(8);

        doc.setTextColor(
          muted.r,
          muted.g,
          muted.b
        );

        doc.text(
          pdfSafeText(
            request.outlet?.code
          ),
          margin + 6,
          y + 25
        );

        // Customer box.
        const customerX =
          margin +
          boxWidth +
          boxGap;

        doc.setFillColor(
          247,
          251,
          249
        );

        doc.roundedRect(
          customerX,
          y,
          boxWidth,
          boxHeight,
          3,
          3,
          "F"
        );

        doc.setFillColor(
          emeraldSoft.r,
          emeraldSoft.g,
          emeraldSoft.b
        );

        doc.roundedRect(
          customerX + 5,
          y + 5,
          7,
          7,
          2,
          2,
          "F"
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(7);

        doc.setTextColor(
          muted.r,
          muted.g,
          muted.b
        );

        doc.text(
          "CUSTOMER",
          customerX + 16,
          y + 10
        );

        doc.setFontSize(10);

        doc.setTextColor(
          dark.r,
          dark.g,
          dark.b
        );

        doc.text(
          pdfSafeText(
            request.customer?.name
          ),
          customerX + 6,
          y + 18
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(8);

        doc.setTextColor(
          muted.r,
          muted.g,
          muted.b
        );

        doc.text(
          pdfSafeText(
            request.customer?.code
          ),
          customerX + 6,
          y + 25
        );

        y += boxHeight + 10;

        // ====================================================
        // DETAIL BARANG
        // ====================================================

        ensureSpace(20);

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(10);

        doc.setTextColor(
          primary.r,
          primary.g,
          primary.b
        );

        doc.text(
          "DETAIL BARANG",
          margin,
          y
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(7.5);

        doc.setTextColor(
          muted.r,
          muted.g,
          muted.b
        );

        doc.text(
          `${request.items.length} jenis barang`,
          pageWidth -
            margin,
          y,
          {
            align: "right",
          }
        );

        y += 6;

        const tableX = margin;

        const colNo = 9;
        const colBarang = 59;
        const colQty = 25;
        const colUnit = 24;

        const colNote =
          pageWidth -
          margin * 2 -
          colNo -
          colBarang -
          colQty -
          colUnit;

        const headerHeight = 9;

        const drawTableHeader = () => {
          doc.setFillColor(
            secondary.r,
            secondary.g,
            secondary.b
          );

          doc.roundedRect(
            tableX,
            y,
            pageWidth -
              margin * 2,
            headerHeight,
            2,
            2,
            "F"
          );

          doc.setFont(
            "helvetica",
            "bold"
          );

          doc.setFontSize(7);

          doc.setTextColor(
            207,
            235,
            225
          );

          doc.text(
            "NO",
            tableX + 3,
            y + 6
          );

          doc.text(
            "BARANG",
            tableX +
              colNo +
              3,
            y + 6
          );

          doc.text(
            "QTY",
            tableX +
              colNo +
              colBarang +
              colQty -
              3,
            y + 6,
            {
              align: "right",
            }
          );

          doc.text(
            "SATUAN",
            tableX +
              colNo +
              colBarang +
              colQty +
              3,
            y + 6
          );

          doc.text(
            "CATATAN",
            tableX +
              colNo +
              colBarang +
              colQty +
              colUnit +
              3,
            y + 6
          );

          y += headerHeight;
        };

        drawTableHeader();

        request.items.forEach(
          (item, index) => {
            const note =
              item.note?.trim() ||
              "-";

            const itemName =
              item.barang?.name ||
              "-";

            const itemCode =
              item.barang?.code ||
              "-";

            const unit =
              getTransactionUnit(
                item.barang
              );

            const noteLines =
              doc.splitTextToSize(
                pdfSafeText(note),
                colNote - 7
              );

            const nameLines =
              doc.splitTextToSize(
                pdfSafeText(
                  itemName
                ),
                colBarang - 7
              );

            const rowLines =
              Math.max(
                noteLines.length,
                nameLines.length,
                1
              );

            const rowHeight =
              Math.max(
                13,
                rowLines * 4.2 + 7
              );

            if (
              y + rowHeight >
              pageHeight - 20
            ) {
              doc.addPage();

              y = 18;

              drawPdfHeader(true);

              drawTableHeader();
            }

            if (index % 2 === 0) {
              doc.setFillColor(
                247,
                251,
                249
              );

              doc.rect(
                tableX,
                y,
                pageWidth -
                  margin * 2,
                rowHeight,
                "F"
              );
            }

            drawLine(
              tableX,
              y + rowHeight,
              pageWidth - margin,
              y + rowHeight
            );

            doc.setFont(
              "helvetica",
              "normal"
            );

            doc.setFontSize(7.5);

            doc.setTextColor(
              dark.r,
              dark.g,
              dark.b
            );

            doc.text(
              String(index + 1),
              tableX + 3,
              y + 7
            );

            doc.setFont(
              "helvetica",
              "bold"
            );

            doc.setFontSize(8);

            doc.text(
              nameLines,
              tableX +
                colNo +
                3,
              y + 6
            );

            doc.setFont(
              "helvetica",
              "normal"
            );

            doc.setFontSize(6.5);

            doc.setTextColor(
              muted.r,
              muted.g,
              muted.b
            );

            doc.text(
              pdfSafeText(
                itemCode
              ),
              tableX +
                colNo +
                3,
              y +
                6 +
                nameLines.length *
                  4
            );

            doc.setFont(
              "helvetica",
              "bold"
            );

            doc.setFontSize(8);

            doc.setTextColor(
              dark.r,
              dark.g,
              dark.b
            );

            doc.text(
              formatNumber(
                item.qty
              ),
              tableX +
                colNo +
                colBarang +
                colQty -
                3,
              y + 7,
              {
                align: "right",
              }
            );

            doc.setFont(
              "helvetica",
              "normal"
            );

            doc.setFontSize(7.5);

            doc.text(
              pdfSafeText(unit),
              tableX +
                colNo +
                colBarang +
                colQty +
                3,
              y + 7
            );

            doc.setTextColor(
              item.note?.trim()
                ? dark.r
                : muted.r,
              item.note?.trim()
                ? dark.g
                : muted.g,
              item.note?.trim()
                ? dark.b
                : muted.b
            );

            doc.text(
              noteLines,
              tableX +
                colNo +
                colBarang +
                colQty +
                colUnit +
                3,
              y + 6
            );

            y += rowHeight;
          }
        );

        // ====================================================
        // TOTAL
        // ====================================================

        y += 8;

        ensureSpace(18);

        doc.setFillColor(
          emeraldSoft.r,
          emeraldSoft.g,
          emeraldSoft.b
        );

        doc.roundedRect(
          margin,
          y,
          pageWidth -
            margin * 2,
          14,
          3,
          3,
          "F"
        );

        doc.setFillColor(
          emerald.r,
          emerald.g,
          emerald.b
        );

        doc.roundedRect(
          margin,
          y,
          3,
          14,
          1.5,
          1.5,
          "F"
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(8);

        doc.setTextColor(
          emeraldDark.r,
          emeraldDark.g,
          emeraldDark.b
        );

        doc.text(
          "TOTAL PERMINTAAN",
          margin + 6,
          y + 9
        );

        doc.text(
          `${formatNumber(
            request.items.length
          )} jenis`,
          pageWidth -
            margin -
            55,
          y + 9,
          {
            align: "right",
          }
        );

        doc.text(
          `${formatNumber(
            totalQty
          )} qty`,
          pageWidth -
            margin -
            6,
          y + 9,
          {
            align: "right",
          }
        );

        y += 22;

        // ====================================================
        // REMARKS
        // ====================================================

        if (
          request.remarks?.trim()
        ) {
          const remarksLines =
            doc.splitTextToSize(
              pdfSafeText(
                request.remarks
              ),
              pageWidth -
                margin * 2 -
                12
            );

          const remarksHeight =
            Math.max(
              22,
              remarksLines.length *
                4.5 +
                15
            );

          ensureSpace(
            remarksHeight
          );

          doc.setFillColor(
            247,
            251,
            249
          );

          doc.roundedRect(
            margin,
            y,
            pageWidth -
              margin * 2,
            remarksHeight,
            3,
            3,
            "F"
          );

          doc.setFont(
            "helvetica",
            "bold"
          );

          doc.setFontSize(8);

          doc.setTextColor(
            primary.r,
            primary.g,
            primary.b
          );

          doc.text(
            "KETERANGAN REQUEST",
            margin + 6,
            y + 8
          );

          doc.setFont(
            "helvetica",
            "normal"
          );

          doc.setFontSize(8);

          doc.setTextColor(
            71,
            91,
            83
          );

          doc.text(
            remarksLines,
            margin + 6,
            y + 15
          );

          y += remarksHeight + 8;
        }

        // ====================================================
        // DELIVERY
        // ====================================================

        if (request.delivery) {
          ensureSpace(30);

          doc.setFillColor(
            emeraldSoft.r,
            emeraldSoft.g,
            emeraldSoft.b
          );

          doc.roundedRect(
            margin,
            y,
            pageWidth -
              margin * 2,
            24,
            3,
            3,
            "F"
          );

          doc.setFillColor(
            emerald.r,
            emerald.g,
            emerald.b
          );

          doc.roundedRect(
            margin,
            y,
            3,
            24,
            1.5,
            1.5,
            "F"
          );

          doc.setFont(
            "helvetica",
            "bold"
          );

          doc.setFontSize(8);

          doc.setTextColor(
            emeraldDark.r,
            emeraldDark.g,
            emeraldDark.b
          );

          doc.text(
            "DELIVERY TERBENTUK",
            margin + 7,
            y + 8
          );

          doc.setFontSize(9);

          doc.setTextColor(
            dark.r,
            dark.g,
            dark.b
          );

          doc.text(
            pdfSafeText(
              request.delivery
                .number
            ),
            margin + 7,
            y + 16
          );

          doc.setFont(
            "helvetica",
            "normal"
          );

          doc.setFontSize(7.5);

          doc.setTextColor(
            muted.r,
            muted.g,
            muted.b
          );

          doc.text(
            `Status: ${pdfSafeText(
              request.delivery
                .status
            )}`,
            pageWidth -
              margin -
              6,
            y + 8,
            {
              align: "right",
            }
          );

          if (
            request.delivery
              .deliveryDate
          ) {
            doc.text(
              `Tanggal: ${formatDate(
                request.delivery
                  .deliveryDate
              )}`,
              pageWidth -
                margin -
                6,
              y + 16,
              {
                align: "right",
              }
            );
          }

          y += 32;
        }

        // ====================================================
        // STOCK INFORMATION
        // ====================================================

        ensureSpace(30);

        doc.setFillColor(
          242,
          248,
          246
        );

        doc.roundedRect(
          margin,
          y,
          pageWidth -
            margin * 2,
          24,
          3,
          3,
          "F"
        );

        doc.setFillColor(
          secondary.r,
          secondary.g,
          secondary.b
        );

        doc.roundedRect(
          margin,
          y,
          3,
          24,
          1.5,
          1.5,
          "F"
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(8);

        doc.setTextColor(
          primary.r,
          primary.g,
          primary.b
        );

        doc.text(
          "INFORMASI STOCK",
          margin + 7,
          y + 8
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(7.5);

        doc.setTextColor(
          56,
          82,
          73
        );

        const stockText =
          "Delivery Request belum mengurangi stock Gudang Pusat. " +
          "Pengurangan stock dilakukan ketika Delivery diproses dan direlease.";

        const stockLines =
          doc.splitTextToSize(
            stockText,
            pageWidth -
              margin * 2 -
              12
          );

        doc.text(
          stockLines,
          margin + 7,
          y + 15
        );

        // ====================================================
        // FOOTER
        // ====================================================

        const pageCount =
          doc.getNumberOfPages();

        for (
          let page = 1;
          page <= pageCount;
          page++
        ) {
          doc.setPage(page);

          doc.setDrawColor(
            border.r,
            border.g,
            border.b
          );

          doc.setLineWidth(
            0.25
          );

          doc.line(
            margin,
            pageHeight - 12,
            pageWidth - margin,
            pageHeight - 12
          );

          doc.setFont(
            "helvetica",
            "normal"
          );

          doc.setFontSize(6.5);

          doc.setTextColor(
            lightMuted.r,
            lightMuted.g,
            lightMuted.b
          );

          doc.text(
            "MGB ERP - Delivery Request",
            margin,
            pageHeight - 7
          );

          doc.text(
            `Halaman ${page} / ${pageCount}`,
            pageWidth -
              margin,
            pageHeight - 7,
            {
              align: "right",
            }
          );
        }

        // ====================================================
        // SAVE
        // ====================================================

        const safeNumber =
          request.number
            .replace(
              /[^a-zA-Z0-9-_]/g,
              "-"
            )
            .replace(
              /-+/g,
              "-"
            );

        doc.save(
          `Delivery-Request-${safeNumber}.pdf`
        );
      } catch (err) {
        console.error(
          "DOWNLOAD DELIVERY REQUEST PDF ERROR:",
          err
        );

        window.alert(
          err instanceof Error
            ? err.message
            : "Gagal membuat PDF Delivery Request."
        );
      } finally {
        setDownloadingPdf(false);
      }
    }, [
      downloadingPdf,
      request,
      totalQty,
    ]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#041C17]/80 p-3 backdrop-blur-md md:p-5"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-[30px] border border-emerald-900/20 bg-white shadow-[0_35px_120px_rgba(4,28,23,0.35)]">

        {/* ==================================================
            MODAL HEADER
        ================================================== */}

        <div className="relative overflow-hidden border-b border-[#12382F] bg-[#041C17]">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 85% 10%, rgba(16,185,129,0.20), transparent 32%), radial-gradient(circle at 65% 100%, rgba(16,185,129,0.08), transparent 35%)",
            }}
          />

          <div className="absolute right-[-70px] top-[-100px] h-60 w-60 rounded-full border border-emerald-400/10" />

          <div className="relative flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-[#09261F] text-emerald-300 shadow-[0_12px_28px_rgba(0,0,0,0.20)]">
                <FileText className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-black text-white md:text-xl">
                    {request.number}
                  </h2>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${getStatusClass(
                      request.status
                    )}`}
                  >
                    {(() => {
                      const Icon =
                        getStatusIcon(
                          request.status
                        );

                      return (
                        <Icon className="h-3 w-3" />
                      );
                    })()}

                    {getStatusLabel(
                      request.status
                    )}
                  </span>
                </div>

                <p className="mt-1 text-xs text-emerald-100/55">
                  Detail Delivery Request •{" "}
                  {formatDate(
                    request.requestDate
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canEdit && !editingRequest && (
                <button
                  type="button"
                  onClick={startEditRequest}
                  disabled={
                    savingEdit ||
                    downloadingPdf ||
                    isDeleting ||
                    loadingBarang
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-white/[0.055] px-4 text-sm font-black text-emerald-100 transition hover:border-emerald-300/40 hover:bg-emerald-300/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </button>
              )}

              <button
                type="button"
                onClick={
                  handleDownloadPDF
                }
                disabled={
                  downloadingPdf ||
                  isDeleting
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-black text-[#041C17] shadow-[0_10px_26px_rgba(16,185,129,0.20)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {downloadingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}

                {downloadingPdf
                  ? "Membuat PDF..."
                  : "Download PDF"}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.055] text-emerald-100/65 transition hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-50"
                title="Tutup detail"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* ==================================================
            MODAL BODY
        ================================================== */}

        <div className="overflow-y-auto bg-[#F3F8F6] p-4 md:p-6">
          <div className="space-y-5">

            {/* METRICS */}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <DetailMetric
                label="Tanggal Request"
                value={formatDate(
                  request.requestDate
                )}
                icon={CalendarDays}
              />

              <DetailMetric
                label="Jenis Barang"
                value={`${formatNumber(
                  request.items.length
                )} jenis`}
                icon={Package}
              />

              <DetailMetric
                label="Total Qty"
                value={`${formatNumber(
                  totalQty
                )} qty`}
                icon={PackageCheck}
              />

              <DetailMetric
                label="Catatan Item"
                value={`${formatNumber(
                  totalNotes
                )} catatan`}
                icon={FileText}
              />
            </div>

            {/* INFO */}

            <div className="grid gap-3 md:grid-cols-3">
              <InfoBox
                icon={Store}
                label="Outlet"
                value={
                  request.outlet?.name ||
                  "-"
                }
                subValue={
                  request.outlet?.code
                }
              />

              <InfoBox
                icon={UserRound}
                label="Customer"
                value={
                  request.customer?.name ||
                  "-"
                }
                subValue={
                  request.customer?.code
                }
              />

              <InfoBox
                icon={CalendarDays}
                label="Tanggal Request"
                value={formatDate(
                  request.requestDate
                )}
                subValue={`Dibuat ${formatDateTime(
                  request.createdAt
                )}`}
              />
            </div>

            {/* STATUS */}

            <div className="overflow-hidden rounded-2xl border border-[#CFE3DC] bg-white shadow-sm">
              <div className="h-1 bg-gradient-to-r from-[#041C17] via-emerald-500 to-[#09261F]" />

              <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#879892]">
                    Status Request
                  </p>

                  <div
                    className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${getStatusClass(
                      request.status
                    )}`}
                  >
                    {(() => {
                      const Icon =
                        getStatusIcon(
                          request.status
                        );

                      return (
                        <Icon className="h-3.5 w-3.5" />
                      );
                    })()}

                    {getStatusLabel(
                      request.status
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[#DCEAE5] bg-[#F7FAF9] px-4 py-3 md:min-w-[200px] md:text-right">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#879892]">
                    Total Permintaan
                  </p>

                  <p className="mt-1 text-xl font-black text-[#09261F]">
                    {formatNumber(
                      totalQty
                    )}
                  </p>

                  <p className="text-xs text-[#70817C]">
                    qty dari{" "}
                    {request.items.length}{" "}
                    jenis barang
                  </p>
                </div>
              </div>
            </div>

            {/* ITEMS */}

            <div>
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-black text-[#10201C]">
                    Barang yang Diminta
                  </h3>

                  <p className="text-xs text-[#70817C]">
                    {editingRequest
                      ? "Atur barang, quantity, satuan, dan catatan sebelum request di-approve."
                      : "Detail barang, satuan, quantity, dan catatan khusus."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {totalNotes > 0 && (
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-[#EAF5F1] px-3 py-1.5 text-xs font-bold text-[#0B6B55]">
                      <FileText className="h-3.5 w-3.5" />
                      {totalNotes} catatan
                    </div>
                  )}

                  {canEdit && !editingRequest && (
                    <button
                      type="button"
                      onClick={startEditRequest}
                      disabled={savingEdit || loadingBarang}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#09261F] px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#0B6B55] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit Request
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#DCE7E3] bg-white shadow-sm">
                {editingRequest ? (
                  <>
                    <div className="border-b border-[#DCE7E3] bg-[#F7FAF9] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-black text-[#09261F]">
                            Mode Edit Request
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[#70817C]">
                            Status masih Menunggu Approval. Kamu dapat mengubah qty, catatan, menghapus item, dan menambah barang baru. Qty tidak boleh melebihi stock Gudang Pusat.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={addEditItem}
                          disabled={
                            savingEdit ||
                            loadingBarang ||
                            editItems.length >= barangs.length
                          }
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-[#EAF5F1] px-4 py-2.5 text-xs font-black text-[#0B6B55] transition hover:border-emerald-300 hover:bg-[#DDF1EA] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {loadingBarang ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          Tambah Barang
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-[900px] w-full">
                        <thead>
                          <tr className="border-b border-[#173B32] bg-[#09261F]">
                            <th className="w-[32%] px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-emerald-100/60">
                              Barang
                            </th>
                            <th className="w-[15%] px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-emerald-100/60">
                              Qty
                            </th>
                            <th className="w-[12%] px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-emerald-100/60">
                              Satuan
                            </th>
                            <th className="w-[30%] px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-emerald-100/60">
                              Catatan
                            </th>
                            <th className="w-[11%] px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-emerald-100/60">
                              Action
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-[#E8EFEC]">
                          {editItems.map((item, index) => {
                            const selectedBarang = barangs.find(
                              (barang) =>
                                Number(barang.id) ===
                                Number(item.barangId)
                            );

                            const selectedIds = new Set(
                              editItems
                                .filter((_, itemIndex) => itemIndex !== index)
                                .map((editItem) => Number(editItem.barangId))
                            );

                            return (
                              <tr key={`${item.id ?? "new"}-${index}`} className="bg-white transition hover:bg-[#F7FBF9]">
                                <td className="px-4 py-3">
                                  <SearchableBarangSelect
                                    value={Number(item.barangId)}
                                    barangs={barangs}
                                    disabled={savingEdit}
                                    excludeIds={selectedIds}
                                    onChange={(barangId) =>
                                      updateEditItem(
                                        index,
                                        "barangId",
                                        Number(barangId)
                                      )
                                    }
                                  />
                                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#8A9B95]">
                                    <span>
                                      Stock pusat: {formatNumber(selectedBarang?.stock ?? 0)}
                                    </span>
                                    {selectedBarang && Number(item.qty) > Number(selectedBarang.stock ?? 0) && (
                                      <span className="font-black text-red-600">
                                        Melebihi stock
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={item.qty}
                                    onChange={(event) =>
                                      updateEditItem(
                                        index,
                                        "qty",
                                        Number(event.target.value)
                                      )
                                    }
                                    disabled={savingEdit}
                                    className="h-11 w-full rounded-xl border border-[#DCE7E3] bg-[#F8FBFA] px-3 text-right text-sm font-black text-[#10201C] outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                                  />
                                </td>

                                <td className="px-4 py-3">
                                  <span className="inline-flex rounded-lg border border-emerald-200 bg-[#EAF5F1] px-2.5 py-1 text-xs font-bold text-[#0B6B55]">
                                    {getTransactionUnit(selectedBarang)}
                                  </span>
                                </td>

                                <td className="px-4 py-3">
                                  <textarea
                                    rows={2}
                                    value={item.note}
                                    onChange={(event) =>
                                      updateEditItem(
                                        index,
                                        "note",
                                        event.target.value
                                      )
                                    }
                                    disabled={savingEdit}
                                    placeholder="Catatan barang (opsional)"
                                    className="w-full resize-none rounded-xl border border-[#DCE7E3] bg-[#F8FBFA] px-3 py-2.5 text-xs font-medium text-[#40534D] outline-none transition placeholder:text-[#9AA9A4] focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                                  />
                                </td>

                                <td className="px-4 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeEditItem(index)}
                                    disabled={savingEdit || editItems.length <= 1}
                                    title="Hapus item"
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-[#E3ECE9] bg-[#F7FAF9] p-4 md:flex-row md:items-center md:justify-between">
                      <p className="text-xs text-[#70817C]">
                        {editItems.length} jenis barang • Perubahan belum tersimpan
                      </p>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEditRequest}
                          disabled={savingEdit}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#D6E4DF] bg-white px-4 py-2.5 text-xs font-black text-[#40534D] transition hover:bg-[#F1F8F5] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <XCircle className="h-4 w-4" />
                          Batal
                        </button>

                        <button
                          type="button"
                          onClick={saveEditRequest}
                          disabled={savingEdit || loadingBarang}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#041C17] px-4 py-2.5 text-xs font-black text-white shadow-[0_8px_20px_rgba(4,28,23,0.18)] transition hover:bg-[#09261F] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingEdit ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          {savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-[720px] w-full">
                        <thead>
                          <tr className="border-b border-[#173B32] bg-[#09261F]">
                            <th className="w-[45%] px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-emerald-100/60">
                              Barang
                            </th>
                            <th className="w-[15%] px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-emerald-100/60">
                              Qty
                            </th>
                            <th className="w-[15%] px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-emerald-100/60">
                              Satuan
                            </th>
                            <th className="w-[25%] px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-emerald-100/60">
                              Catatan
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-[#E8EFEC]">
                          {request.items.map((item) => (
                            <tr key={item.id} className="transition hover:bg-[#F1F8F5]">
                              <td className="px-4 py-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D5E8E1] bg-[#EAF5F1] text-[#0B6B55]">
                                    <Package className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-black text-[#243A34]">
                                      {item.barang?.name}
                                    </p>
                                    <p className="mt-0.5 text-xs font-medium text-[#8A9B95]">
                                      {item.barang?.code}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <span className="text-sm font-black text-[#10201C]">
                                  {formatNumber(item.qty)}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="inline-flex rounded-lg border border-emerald-200 bg-[#EAF5F1] px-2.5 py-1 text-xs font-bold text-[#0B6B55]">
                                  {getTransactionUnit(item.barang)}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                {item.note?.trim() ? (
                                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                                    <div className="flex items-start gap-2">
                                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                                      <p className="whitespace-pre-wrap text-xs leading-5 text-amber-800">
                                        {item.note}
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-[#9AA9A4]">
                                    Tidak ada
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-[#E3ECE9] bg-[#F7FAF9] px-4 py-3 text-xs md:flex-row md:items-center md:justify-between">
                      <span className="text-[#70817C]">
                        {request.items.length} jenis barang
                      </span>
                      <span className="font-black text-[#243A34]">
                        Total {formatNumber(totalQty)} qty
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* REMARKS */}

            {request.remarks && (
              <div className="rounded-2xl border border-[#DCE7E3] bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5F1] text-[#0B6B55]">
                    <FileText className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#879892]">
                      Keterangan Request
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#40534D]">
                      {request.remarks}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* CREATED BY */}

            <div className="rounded-2xl border border-[#DCE7E3] bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF5F1] text-[#0B6B55]">
                  <UserRound className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#879892]">
                    Dibuat oleh
                  </p>

                  <p className="mt-1 text-sm font-black text-[#10201C]">
                    {
                      request.createdBy
                        ?.fullname
                    }
                  </p>

                  <p className="text-xs text-[#70817C]">
                    @
                    {
                      request.createdBy
                        ?.username
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* DELIVERY */}

            {request.delivery && (
              <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-[#EAF6F1] shadow-sm">
                <div className="h-1 bg-gradient-to-r from-[#041C17] via-emerald-500 to-[#09261F]" />

                <div className="flex items-start gap-4 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white bg-white text-[#0B6B55] shadow-sm">
                    <PackageCheck className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-[#0B6B55]">
                          Delivery sudah terbentuk
                        </p>

                        <p className="mt-1 text-base font-black text-[#10201C]">
                          {
                            request
                              .delivery
                              .number
                          }
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/80 bg-white/80 px-3 py-2 md:text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#879892]">
                          Status Delivery
                        </p>

                        <p className="mt-1 text-xs font-black text-[#243A34]">
                          {
                            request
                              .delivery
                              .status
                          }
                        </p>
                      </div>
                    </div>

                    {request.delivery
                      .deliveryDate && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-[#40534D]">
                        <CalendarDays className="h-3.5 w-3.5 text-[#0B6B55]" />

                        Tanggal Delivery:{" "}
                        <strong>
                          {formatDate(
                            request
                              .delivery
                              .deliveryDate
                          )}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* BUSINESS RULE */}

            <div className="overflow-hidden rounded-2xl border border-[#BFD3CC] bg-white shadow-sm">
              <div className="h-1 bg-[#09261F]" />

              <div className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5F1] text-[#09261F]">
                  <Package className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-black text-[#09261F]">
                    Informasi Stock
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#536A62]">
                    Pembuatan Delivery Request
                    belum mengurangi stock
                    Gudang Pusat. Pengurangan
                    stock dilakukan ketika barang
                    benar-benar diproses dan
                    direlease oleh Gudang Pusat.
                  </p>
                </div>
              </div>
            </div>

            {/* DELETE INFO */}

            {canDelete && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

                  <div>
                    <p className="text-sm font-black text-red-900">
                      Hapus Delivery Request
                    </p>

                    <p className="mt-1 text-xs leading-5 text-red-700">
                      Request ini masih dapat
                      dihapus. Seluruh item di
                      dalam transaksi akan ikut
                      terhapus. Penghapusan ini
                      tidak mengubah stock Gudang
                      Pusat.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!canDelete &&
              !request.delivery &&
              [
                "PROCESSING",
                "COMPLETED",
              ].includes(
                request.status
              ) && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                    <div>
                      <p className="text-sm font-black text-amber-900">
                        Request sudah diproses
                      </p>

                      <p className="mt-1 text-xs leading-5 text-amber-700">
                        Delivery Request yang
                        sudah masuk proses tidak
                        dapat dihapus karena
                        berhubungan dengan
                        pergerakan barang.
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* ==================================================
            FOOTER
        ================================================== */}

        <div className="flex flex-col gap-3 border-t border-[#DCE7E3] bg-white p-4 md:flex-row md:items-center md:justify-between">
          <div>
            {canDelete && (
              <button
                type="button"
                onClick={() =>
                  onDelete(request)
                }
                disabled={
                  isDeleting ||
                  downloadingPdf
                }
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}

                {isDeleting
                  ? "Menghapus..."
                  : "Hapus Request"}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={
                handleDownloadPDF
              }
              disabled={
                downloadingPdf ||
                isDeleting
              }
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-[#EAF5F1] px-4 py-2.5 text-sm font-black text-[#0B6B55] transition hover:border-emerald-300 hover:bg-[#DDF1EA] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloadingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}

              {downloadingPdf
                ? "Membuat PDF..."
                : "Download PDF"}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={
                isDeleting ||
                downloadingPdf
              }
              className="inline-flex items-center gap-2 rounded-xl bg-[#041C17] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(4,28,23,0.18)] transition hover:bg-[#09261F] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowLeft className="h-4 w-4" />
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DETAIL METRIC
// ============================================================

function DetailMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="group rounded-2xl border border-[#DCE7E3] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D5E8E1] bg-[#EAF5F1] text-[#0B6B55] transition group-hover:bg-[#DDF1EA]">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-wider text-[#879892]">
            {label}
          </p>

          <p className="mt-1 truncate text-sm font-black text-[#10201C]">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// INFO BOX
// ============================================================

function InfoBox({
  icon: Icon,
  label,
  value,
  subValue,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string | null;
}) {
  return (
    <div className="group rounded-2xl border border-[#DCE7E3] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D5E8E1] bg-[#EAF5F1] text-[#0B6B55] transition group-hover:bg-[#DDF1EA]">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#879892]">
            {label}
          </p>

          <p className="mt-1 truncate text-sm font-black text-[#10201C]">
            {value}
          </p>

          {subValue && (
            <p className="mt-0.5 truncate text-xs font-medium text-[#70817C]">
              {subValue}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}