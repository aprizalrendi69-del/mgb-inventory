"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Package,
  RefreshCw,
  Search,
  Trash2,
  Warehouse,
  X,
  XCircle,
} from "lucide-react";

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Barang = {
  id: number;
  code: string;
  name: string;
  category: string | null;
  unit: string | null;
};

type WasteUser = {
  id: number;
  username: string | null;
  fullname: string | null;
};

type WasteItem = {
  id: number;
  number: string | null;
  trxDate: string;

  outletId: number;
  outlet: Outlet | null;

  barangId: number;
  barang: Barang | null;

  type: string;
  status: string;

  qtyProcessed: number;
  wasteQty: number;
  netQty: number;

  unitCost: number;
  totalCost: number;

  note: string | null;

  approvedBy?: number | null;
  approvedAt?: string | null;

  user: WasteUser | null;
};

type WasteSummary = {
  month: string;
  totalTransactions: number;
  totalWasteQty: number;
  totalWasteValue: number;

  byOutlet: {
    outletId: number;
    outletName: string;
    wasteQty: number;
    wasteValue: number;
  }[];
};

type WasteResponse = {
  success: boolean;

  role?: string;

  isOutletAdmin?: boolean;

  outletId?: number | null;

  data: WasteItem[];

  summary: WasteSummary;

  message?: string;
};

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
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

function formatMonth(value: string) {
  if (!value) return "-";

  const [year, month] = value.split("-");

  const date = new Date(
    Number(year),
    Number(month) - 1,
    1
  );

  return date.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function getCurrentMonth() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
}

function changeMonth(
  currentMonth: string,
  offset: number
) {
  const [year, month] = currentMonth
    .split("-")
    .map(Number);

  const date = new Date(
    year,
    month - 1 + offset,
    1
  );

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

/*
 * =========================================================
 * STATUS
 * =========================================================
 */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized =
    String(status || "").toUpperCase();

  if (normalized === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
        <CheckCircle2 size={12} />
        APPROVED
      </span>
    );
  }

  if (normalized === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">
        <XCircle size={12} />
        REJECTED
      </span>
    );
  }

  if (normalized === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
        <Clock3 size={12} />
        PENDING
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
      {normalized || "-"}
    </span>
  );
}

/*
 * =========================================================
 * PAGE
 * =========================================================
 */

export default function WasteOutletPage() {
  /*
   * =======================================================
   * STATE
   * =======================================================
   */

  const [month, setMonth] = useState(
    getCurrentMonth()
  );

  const [wastes, setWastes] = useState<
    WasteItem[]
  >([]);

  const [summary, setSummary] =
    useState<WasteSummary | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [selectedOutlet, setSelectedOutlet] =
    useState("ALL");

  const [isOutletAdmin, setIsOutletAdmin] =
    useState(false);

  const [currentRole, setCurrentRole] =
    useState("");

  const [currentOutlet, setCurrentOutlet] =
    useState<Outlet | null>(null);

  const [approvingId, setApprovingId] =
    useState<number | null>(null);

  const [approveError, setApproveError] =
    useState("");

  /*
   * =======================================================
   * APPROVE PERMISSION
   *
   * HANYA ADMIN / MANAGER
   * =======================================================
   */

  const canApprove =
    currentRole === "ADMIN" ||
    currentRole === "MANAGER";

  /*
   * =======================================================
   * FETCH
   * =======================================================
   */

  const fetchWaste = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const params = new URLSearchParams();

        params.set(
          "month",
          month
        );

        if (
          !isOutletAdmin &&
          selectedOutlet !== "ALL"
        ) {
          params.set(
            "outletId",
            selectedOutlet
          );
        }

        const response = await fetch(
          `/api/outlet/waste?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const result =
          (await response.json()) as WasteResponse;

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.message ||
              "Gagal mengambil data Waste Outlet"
          );
        }

        const outletAdmin =
          Boolean(
            result.isOutletAdmin
          );

        setIsOutletAdmin(
          outletAdmin
        );

        setCurrentRole(
          String(result.role || "")
            .toUpperCase()
        );

        if (
          outletAdmin &&
          result.data.length > 0
        ) {
          const outlet =
            result.data[0].outlet;

          if (outlet) {
            setCurrentOutlet(
              outlet
            );
          }
        }

        setWastes(
          Array.isArray(result.data)
            ? result.data
            : []
        );

        setSummary(
          result.summary || {
            month,
            totalTransactions: 0,
            totalWasteQty: 0,
            totalWasteValue: 0,
            byOutlet: [],
          }
        );
      } catch (err) {
        console.error(
          "FETCH WASTE OUTLET ERROR:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Gagal mengambil data Waste Outlet"
        );

        setWastes([]);
        setSummary(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      month,
      selectedOutlet,
      isOutletAdmin,
    ]
  );

  useEffect(() => {
    fetchWaste();
  }, [fetchWaste]);

  /*
   * =======================================================
   * APPROVE WASTE
   * =======================================================
   */

  async function approveWaste(
    wasteId: number
  ) {
    if (!canApprove) {
      return;
    }

    const confirmed =
      window.confirm(
        "Approve transaksi Waste ini?\n\nStock TIDAK akan dikurangi lagi."
      );

    if (!confirmed) {
      return;
    }

    try {
      setApprovingId(wasteId);
      setApproveError("");

      const response = await fetch(
        `/api/outlet/waste/${wasteId}/approve`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
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
            "Gagal approve Waste"
        );
      }

      /*
       * Update langsung di state supaya UI
       * berubah tanpa menunggu refresh penuh.
       */

      setWastes((current) =>
        current.map((item) =>
          item.id === wasteId
            ? {
                ...item,
                status:
                  result.data?.status ||
                  "APPROVED",
                approvedBy:
                  result.data?.approvedBy ??
                  item.approvedBy,
                approvedAt:
                  result.data?.approvedAt ??
                  item.approvedAt,
              }
            : item
        )
      );
    } catch (err) {
      console.error(
        "APPROVE WASTE ERROR:",
        err
      );

      setApproveError(
        err instanceof Error
          ? err.message
          : "Gagal approve Waste"
      );
    } finally {
      setApprovingId(null);
    }
  }

  /*
   * =======================================================
   * OUTLET OPTIONS
   * =======================================================
   */

  const outletOptions = useMemo(() => {
    const map = new Map<
      number,
      Outlet
    >();

    for (const item of wastes) {
      if (item.outlet) {
        map.set(
          item.outlet.id,
          item.outlet
        );
      }
    }

    return Array.from(
      map.values()
    ).sort((a, b) =>
      a.name.localeCompare(
        b.name
      )
    );
  }, [wastes]);

  /*
   * =======================================================
   * OUTLET ADMIN CURRENT OUTLET
   * =======================================================
   */

  useEffect(() => {
    if (
      !isOutletAdmin ||
      wastes.length === 0
    ) {
      return;
    }

    const outlet =
      wastes[0]?.outlet;

    if (outlet) {
      setCurrentOutlet(
        outlet
      );
    }
  }, [
    wastes,
    isOutletAdmin,
  ]);

  /*
   * =======================================================
   * FILTER DATA
   * =======================================================
   */

  const filteredWastes = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    if (!keyword) {
      return wastes;
    }

    return wastes.filter((item) => {
      const values = [
        item.number,
        item.status,
        item.outlet?.code,
        item.outlet?.name,
        item.barang?.code,
        item.barang?.name,
        item.barang?.category,
        item.note,
        item.user?.username,
        item.user?.fullname,
      ];

      return values.some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(keyword)
      );
    });
  }, [
    wastes,
    search,
  ]);

  /*
   * =======================================================
   * FILTERED TOTAL
   * =======================================================
   */

  const filteredTotals = useMemo(() => {
    return filteredWastes.reduce(
      (acc, item) => {
        const wasteQty =
          Number(
            item.wasteQty || 0
          );

        const unitCost =
          Number(
            item.unitCost || 0
          );

        /*
         * NILAI WASTE =
         * WASTE QTY x UNIT COST
         */

        acc.qty += wasteQty;

        acc.value +=
          wasteQty * unitCost;

        return acc;
      },
      {
        qty: 0,
        value: 0,
      }
    );
  }, [filteredWastes]);

  /*
   * =======================================================
   * MONTH NAVIGATION
   * =======================================================
   */

  function previousMonth() {
    if (isOutletAdmin) {
      return;
    }

    setMonth(
      changeMonth(
        month,
        -1
      )
    );
  }

  function nextMonth() {
    if (isOutletAdmin) {
      return;
    }

    setMonth(
      changeMonth(
        month,
        1
      )
    );
  }

  function resetSearch() {
    setSearch("");
  }

  /*
   * =======================================================
   * RENDER
   * =======================================================
   */

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">

        {/* HEADER */}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <Trash2
                  size={22}
                  strokeWidth={2.2}
                />
              </div>

              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-800 md:text-2xl">
                  Waste Outlet
                </h1>

                <p className="mt-0.5 text-sm text-slate-500">
                  {isOutletAdmin
                    ? currentOutlet
                      ? `Monitoring waste ${currentOutlet.name}`
                      : "Monitoring waste outlet"
                    : "Monitoring dan riwayat waste barang outlet"}
                </p>
              </div>

            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              fetchWaste(true)
            }
            disabled={
              refreshing
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            {refreshing
              ? "Memuat..."
              : "Refresh"}
          </button>

        </div>

        {/* OUTLET ADMIN INFO */}

        {isOutletAdmin &&
          currentOutlet && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm">
                <Warehouse
                  size={18}
                />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Outlet Anda
                </p>

                <p className="mt-0.5 text-sm font-bold text-emerald-900">
                  {currentOutlet.name}
                </p>

                {currentOutlet.code && (
                  <p className="text-[11px] text-emerald-700">
                    {currentOutlet.code}
                  </p>
                )}
              </div>

            </div>
          )}

        {/* ERROR */}

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">

            <AlertTriangle
              size={20}
              className="mt-0.5 shrink-0"
            />

            <div className="flex-1">

              <p className="font-semibold">
                Gagal memuat data
              </p>

              <p className="mt-1 text-sm">
                {error}
              </p>

            </div>

            <button
              type="button"
              onClick={() =>
                fetchWaste(true)
              }
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Coba Lagi
            </button>

          </div>
        )}

        {/* APPROVE ERROR */}

        {approveError && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

            <AlertTriangle
              size={18}
              className="shrink-0"
            />

            <span className="flex-1">
              {approveError}
            </span>

            <button
              type="button"
              onClick={() =>
                setApproveError("")
              }
              className="text-red-500 hover:text-red-700"
            >
              <X size={16} />
            </button>

          </div>
        )}

        {/* FILTER */}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

          <div
            className={
              isOutletAdmin
                ? "flex flex-col gap-4"
                : "flex flex-col gap-4 xl:flex-row xl:items-end"
            }
          >

            {!isOutletAdmin && (
              <div className="w-full xl:w-[220px]">

                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Periode
                </label>

                <div className="flex h-10 items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">

                  <button
                    type="button"
                    onClick={
                      previousMonth
                    }
                    className="flex h-full w-10 items-center justify-center border-r border-slate-200 text-slate-500 transition hover:bg-white hover:text-emerald-600"
                    title="Bulan sebelumnya"
                  >
                    <ChevronLeft
                      size={17}
                    />
                  </button>

                  <div className="relative flex flex-1 items-center justify-center">

                    <CalendarDays
                      size={15}
                      className="mr-2 text-emerald-600"
                    />

                    <input
                      type="month"
                      value={
                        month
                      }
                      onChange={(
                        event
                      ) =>
                        setMonth(
                          event
                            .target
                            .value
                        )
                      }
                      className="w-full bg-transparent text-center text-sm font-semibold text-slate-700 outline-none"
                    />

                  </div>

                  <button
                    type="button"
                    onClick={
                      nextMonth
                    }
                    className="flex h-full w-10 items-center justify-center border-l border-slate-200 text-slate-500 transition hover:bg-white hover:text-emerald-600"
                    title="Bulan berikutnya"
                  >
                    <ChevronRight
                      size={17}
                    />
                  </button>

                </div>

              </div>
            )}

            {!isOutletAdmin && (
              <div className="w-full xl:w-[260px]">

                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Outlet
                </label>

                <div className="relative">

                  <Warehouse
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <select
                    value={
                      selectedOutlet
                    }
                    onChange={(
                      event
                    ) =>
                      setSelectedOutlet(
                        event
                          .target
                          .value
                      )
                    }
                    className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                            outlet.name
                          }
                        </option>
                      )
                    )}

                  </select>

                </div>

              </div>
            )}

            <div className="min-w-0 flex-1">

              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cari
              </label>

              <div className="relative">

                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={
                    search
                  }
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="Cari nomor, barang, outlet, kategori, user, status..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />

                {search && (
                  <button
                    type="button"
                    onClick={
                      resetSearch
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X
                      size={16}
                    />
                  </button>
                )}

              </div>

            </div>

          </div>

          <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">

            <p className="text-xs text-slate-500">

              {isOutletAdmin ? (
                <>
                  Periode berjalan{" "}
                  <span className="font-semibold text-slate-700">
                    {formatMonth(
                      month
                    )}
                  </span>
                </>
              ) : (
                <>
                  Periode{" "}
                  <span className="font-semibold text-slate-700">
                    {formatMonth(
                      month
                    )}
                  </span>
                </>
              )}

            </p>

            {search && (
              <p className="text-xs text-slate-500">
                Menampilkan{" "}
                <span className="font-semibold text-slate-700">
                  {
                    filteredWastes.length
                  }
                </span>{" "}
                dari{" "}
                <span className="font-semibold text-slate-700">
                  {
                    wastes.length
                  }
                </span>{" "}
                transaksi
              </p>
            )}

          </div>

        </div>

        {/* SUMMARY */}

        <div
          className={
            isOutletAdmin
              ? "grid grid-cols-1 gap-4 sm:grid-cols-3"
              : "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          }
        >

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total Transaksi
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-800">
                  {loading
                    ? "..."
                    : formatNumber(
                        summary?.totalTransactions ||
                          0
                      )}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Transaksi waste periode ini
                </p>

              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Trash2
                  size={19}
                />
              </div>

            </div>

          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total Waste Qty
                </p>

                <p className="mt-2 text-2xl font-bold text-amber-600">
                  {loading
                    ? "..."
                    : formatNumber(
                        summary?.totalWasteQty ||
                          0
                      )}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Jumlah barang terbuang
                </p>

              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Package
                  size={19}
                />
              </div>

            </div>

          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nilai Waste
                </p>

                <p className="mt-2 text-2xl font-bold text-red-600">
                  {loading
                    ? "..."
                    : formatCurrency(
                        summary?.totalWasteValue ||
                          0
                      )}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Waste Qty × Unit Cost
                </p>

              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <CircleDollarSign
                  size={19}
                />
              </div>

            </div>

          </div>

          {!isOutletAdmin && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

              <div className="flex items-start justify-between">

                <div>

                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Outlet
                  </p>

                  <p className="mt-2 text-2xl font-bold text-emerald-600">
                    {loading
                      ? "..."
                      : formatNumber(
                          summary?.byOutlet
                            ?.length ||
                            0
                        )}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Outlet yang memiliki waste
                  </p>

                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Warehouse
                    size={19}
                  />
                </div>

              </div>

            </div>
          )}

        </div>

        {/* OUTLET SUMMARY */}

        {!isOutletAdmin &&
          !loading &&
          summary &&
          summary.byOutlet.length >
            0 &&
          selectedOutlet ===
            "ALL" && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">

              <div className="border-b border-slate-100 px-4 py-3">

                <h2 className="text-sm font-bold text-slate-800">
                  Rekap Waste per Outlet
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Ringkasan waste berdasarkan outlet
                </p>

              </div>

              <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">

                {summary.byOutlet.map(
                  (item) => (
                    <div
                      key={
                        item.outletId
                      }
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <p className="truncate text-sm font-semibold text-slate-800">
                            {
                              item.outletName
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Waste Qty
                          </p>

                          <p className="mt-0.5 text-sm font-bold text-amber-600">
                            {formatNumber(
                              item.wasteQty
                            )}
                          </p>

                        </div>

                        <div className="shrink-0 rounded-lg bg-white p-2 text-emerald-600 shadow-sm">
                          <Warehouse
                            size={17}
                          />
                        </div>

                      </div>

                      <div className="mt-3 border-t border-slate-200 pt-3">

                        <p className="text-xs text-slate-500">
                          Nilai Waste
                        </p>

                        <p className="mt-0.5 text-sm font-bold text-red-600">
                          {formatCurrency(
                            item.wasteValue
                          )}
                        </p>

                      </div>

                    </div>
                  )
                )}

              </div>

            </div>
          )}

        {/* TABLE */}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 md:flex-row md:items-center md:justify-between">

            <div>

              <h2 className="text-sm font-bold text-slate-800">
                Riwayat Waste
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                {isOutletAdmin
                  ? "Detail transaksi waste outlet Anda"
                  : "Detail transaksi waste outlet"}
              </p>

            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">

              <span>
                {
                  filteredWastes.length
                }{" "}
                transaksi
              </span>

              {search && (
                <>
                  <span className="text-slate-300">
                    |
                  </span>

                  <span>
                    Qty{" "}
                    <span className="font-semibold text-slate-700">
                      {formatNumber(
                        filteredTotals.qty
                      )}
                    </span>
                  </span>

                  <span className="text-slate-300">
                    |
                  </span>

                  <span>
                    Nilai{" "}
                    <span className="font-semibold text-red-600">
                      {formatCurrency(
                        filteredTotals.value
                      )}
                    </span>
                  </span>
                </>
              )}

            </div>

          </div>

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">

              <div className="flex flex-col items-center gap-3">

                <RefreshCw
                  size={28}
                  className="animate-spin text-emerald-600"
                />

                <p className="text-sm text-slate-500">
                  Memuat data Waste Outlet...
                </p>

              </div>

            </div>
          ) : filteredWastes.length ===
            0 ? (

            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">

              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Trash2
                  size={25}
                />
              </div>

              <h3 className="mt-4 text-sm font-semibold text-slate-700">
                Belum ada data waste
              </h3>

              <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
                Tidak ditemukan transaksi waste
                untuk periode atau filter yang
                dipilih.
              </p>

              {search && (
                <button
                  type="button"
                  onClick={
                    resetSearch
                  }
                  className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                >
                  Reset Pencarian
                </button>
              )}

            </div>
          ) : (

            <div className="overflow-x-auto">

              <table className="min-w-[1600px] w-full text-left text-sm">

                <thead>

                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      No
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Tanggal
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Nomor
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Outlet
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Kode Barang
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Nama Barang
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Category
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      Qty Processed
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      Waste Qty
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      Net Qty
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      Unit Cost
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      Total Waste
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      User
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Status
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Keterangan
                    </th>

                    {canApprove && (
                      <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                        Aksi
                      </th>
                    )}

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-100">

                  {filteredWastes.map(
                    (
                      item,
                      index
                    ) => {

                      const wasteValue =
                        Number(
                          item.wasteQty || 0
                        ) *
                        Number(
                          item.unitCost || 0
                        );

                      return (
                        <tr
                          key={
                            item.id
                          }
                          className="transition hover:bg-emerald-50/40"
                        >

                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                            {
                              index +
                                1
                            }
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-700">
                            {formatDate(
                              item.trxDate
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">

                            <span className="font-mono text-xs font-semibold text-slate-700">
                              {item.number ||
                                `WASTE-${item.id}`}
                            </span>

                          </td>

                          <td className="whitespace-nowrap px-4 py-3">

                            <div>

                              <p className="text-xs font-semibold text-slate-700">
                                {item
                                  .outlet
                                  ?.name ||
                                  "-"}
                              </p>

                              {item
                                .outlet
                                ?.code && (
                                <p className="mt-0.5 text-[10px] text-slate-400">
                                  {
                                    item
                                      .outlet
                                      .code
                                  }
                                </p>
                              )}

                            </div>

                          </td>

                          <td className="whitespace-nowrap px-4 py-3">

                            <span className="font-mono text-xs text-slate-600">
                              {item
                                .barang
                                ?.code ||
                                "-"}
                            </span>

                          </td>

                          <td className="max-w-[220px] px-4 py-3">

                            <p className="truncate text-xs font-semibold text-slate-700">
                              {item
                                .barang
                                ?.name ||
                                "-"}
                            </p>

                            {item
                              .barang
                              ?.unit && (
                              <p className="mt-0.5 text-[10px] text-slate-400">
                                Unit:{" "}
                                {
                                  item
                                    .barang
                                    .unit
                                }
                              </p>
                            )}

                          </td>

                          <td className="whitespace-nowrap px-4 py-3">

                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                              {item
                                .barang
                                ?.category ||
                                "-"}
                            </span>

                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-600">
                            {formatNumber(
                              item.qtyProcessed
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-right">

                            <span className="font-semibold text-amber-600">
                              {formatNumber(
                                item.wasteQty
                              )}
                            </span>

                            {item
                              .barang
                              ?.unit && (
                              <span className="ml-1 text-[10px] text-slate-400">
                                {
                                  item
                                    .barang
                                    .unit
                                }
                              </span>
                            )}

                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium text-slate-700">
                            {formatNumber(
                              item.netQty
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-600">
                            {formatCurrency(
                              item.unitCost
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-right">

                            <span className="font-semibold text-red-600">
                              {formatCurrency(
                                wasteValue
                              )}
                            </span>

                          </td>

                          <td className="whitespace-nowrap px-4 py-3">

                            <p className="text-xs font-medium text-slate-700">
                              {item
                                .user
                                ?.fullname ||
                                item
                                  .user
                                  ?.username ||
                                "-"}
                            </p>

                            {item
                              .user
                              ?.username &&
                              item
                                .user
                                ?.fullname && (
                                <p className="mt-0.5 text-[10px] text-slate-400">
                                  @
                                  {
                                    item
                                      .user
                                      .username
                                  }
                                </p>
                              )}

                          </td>

                          {/* STATUS */}

                          <td className="whitespace-nowrap px-4 py-3">

                            <StatusBadge
                              status={
                                item.status
                              }
                            />

                          </td>

                          {/* NOTE */}

                          <td className="max-w-[240px] px-4 py-3">

                            {item.note ? (
                              <p
                                className="truncate text-xs text-slate-600"
                                title={
                                  item.note
                                }
                              >
                                {
                                  item.note
                                }
                              </p>
                            ) : (
                              <span className="text-xs text-slate-400">
                                -
                              </span>
                            )}

                          </td>

                          {/* ACTION */}

                          {canApprove && (
                            <td className="whitespace-nowrap px-4 py-3 text-center">

                              {String(
                                item.status
                              ).toUpperCase() ===
                              "PENDING" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    approveWaste(
                                      item.id
                                    )
                                  }
                                  disabled={
                                    approvingId ===
                                    item.id
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >

                                  {approvingId ===
                                  item.id ? (
                                    <>
                                      <RefreshCw
                                        size={13}
                                        className="animate-spin"
                                      />
                                      Approving...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2
                                        size={13}
                                      />
                                      Approve
                                    </>
                                  )}

                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400">
                                  Tidak ada aksi
                                </span>
                              )}

                            </td>
                          )}

                        </tr>
                      );
                    }
                  )}

                </tbody>

                {/* FOOTER */}

                <tfoot>

                  <tr className="border-t-2 border-slate-200 bg-slate-50">

                    <td
                      colSpan={
                        8
                      }
                      className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600"
                    >
                      Total
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs font-bold text-amber-600">
                      {formatNumber(
                        filteredTotals.qty
                      )}
                    </td>

                    <td />

                    <td />

                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs font-bold text-red-600">
                      {formatCurrency(
                        filteredTotals.value
                      )}
                    </td>

                    <td
                      colSpan={
                        canApprove
                          ? 4
                          : 3
                      }
                    />

                  </tr>

                </tfoot>

              </table>

            </div>
          )}

        </div>

        {/* FOOTER INFO */}

        {!loading &&
          wastes.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 md:flex-row md:items-center md:justify-between">

              <div className="flex items-center gap-2">

                <AlertTriangle
                  size={15}
                  className="shrink-0"
                />

                <span>
                  Data Waste Outlet periode{" "}
                  <strong>
                    {formatMonth(
                      month
                    )}
                  </strong>{" "}
                  terhubung dengan perhitungan
                  Waste pada Cost Control.
                </span>

              </div>

              <span className="font-semibold">
                {formatNumber(
                  summary?.totalWasteQty ||
                    0
                )}{" "}
                qty ·{" "}
                {formatCurrency(
                  summary?.totalWasteValue ||
                    0
                )}
              </span>

            </div>
          )}

      </div>
    </div>
  );
}