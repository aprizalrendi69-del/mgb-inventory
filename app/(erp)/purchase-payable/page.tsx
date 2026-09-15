"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  FileClock,
  LockKeyhole,
  RefreshCw,
  Search,
  Store,
  WalletCards,
  X,
  SlidersHorizontal,
  ArrowUpRight,
  ReceiptText,
  CircleDollarSign,
  CalendarClock,
  Landmark,
  Sparkles,
  Command,
} from "lucide-react";

/*
============================================================
PURCHASE PAYABLE
============================================================

SUMBER RESMI
------------------------------------------------------------
PurchasePayable adalah sumber resmi untuk:

- amount
- paidAmount
- outstanding
- status
- invoiceNumber
- invoiceDate
- dueDate

TEMPO
------------------------------------------------------------
Prioritas:

1. PurchasePayable.tempoDays dari API
2. Supplier.tempoDays
3. Selisih invoiceDate -> dueDate

ACCESS
------------------------------------------------------------
ADMIN PUSAT:
- Melihat Purchase Pusat
- Melihat Purchase Outlet
- Dapat membuka pembayaran

ADMIN OUTLET:
- Hanya melihat PurchasePayable outlet miliknya
- Tidak melihat Purchase Pusat
- Tidak melihat Outlet lain
- Tidak dapat melakukan pembayaran dari halaman ini

SECURITY
------------------------------------------------------------
Frontend hanya untuk visibility/UX.

Authorization sebenarnya tetap dilakukan
di endpoint:

GET /api/purchase-payable
============================================================
*/

/*
============================================================
TYPE
============================================================
*/

type Supplier = {
  id?: number;
  code?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  tempoDays?: number | null;
};

type Outlet = {
  id?: number;
  code?: string;
  name?: string;
};

type Purchase = {
  id: number;
  number: string;
  supplierId?: number;
  purchaseDate?: string;
  status?: string;
  remarks?: string | null;
  total?: number;
  supplier?: Supplier | null;
  items?: any[];
};

type OutletPurchase = {
  id: number;
  number: string;
  supplierId?: number;
  outletId?: number;
  purchaseDate?: string;
  status?: string;
  remarks?: string | null;
  total?: number;
  supplier?: Supplier | null;
  outlet?: Outlet | null;
  items?: any[];
};

type PurchasePayable = {
  id: number;

  purchaseId?: number | null;

  outletPurchaseId?: number | null;

  supplierId?: number | null;

  outletId?: number | null;

  invoiceNumber?: string | null;

  invoiceDate?: string | null;

  dueDate?: string | null;

  tempoDays?: number | null;

  amount?: number;

  paidAmount?: number;

  outstanding?: number;

  status?: string;

  supplier?: Supplier | null;

  outlet?: Outlet | null;

  purchase?: Purchase | null;

  outletPurchase?: OutletPurchase | null;

  createdAt?: string;

  updatedAt?: string;

  [key: string]: any;
};

type PayableStatus =
  | "BELUM BAYAR"
  | "SEBAGIAN"
  | "LUNAS";

type SourceType =
  | "PUSAT"
  | "OUTLET";

type PayableRow = {
  payableId: number;

  source: SourceType;

  sourceKey: string;

  purchase: Purchase | OutletPurchase;

  supplier: Supplier | null;

  outlet: Outlet | null;

  invoiceNumber: string | null;

  invoiceDate: string | null;

  tempoDays: number | null;

  dueDate: string | null;

  total: number;

  paid: number;

  remaining: number;

  status: PayableStatus;

  rawStatus: string;
};

type UserContext = {
  role: string;
  outletId: number | null;
  outlet: Outlet | null;
};

/*
============================================================
NUMBER
============================================================
*/

function toNumber(
  value: unknown,
  fallback = 0
) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;
}

/*
============================================================
RUPIAH
============================================================
*/

function formatRupiah(
  value: number
) {
  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

/*
============================================================
NUMBER
============================================================
*/

function formatNumber(
  value: number
) {
  return new Intl.NumberFormat(
    "id-ID"
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

/*
============================================================
DATE
============================================================
*/

function formatDate(
  value?: string | null
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

/*
============================================================
TEMPO FALLBACK
============================================================
*/

function getTempoDaysFromDates(
  invoiceDate?: string | null,
  dueDate?: string | null
) {
  if (
    !invoiceDate ||
    !dueDate
  ) {
    return null;
  }

  const invoice =
    new Date(invoiceDate);

  const due =
    new Date(dueDate);

  if (
    Number.isNaN(
      invoice.getTime()
    ) ||
    Number.isNaN(
      due.getTime()
    )
  ) {
    return null;
  }

  const diffMs =
    due.getTime() -
    invoice.getTime();

  const days =
    Math.round(
      diffMs /
        (1000 *
          60 *
          60 *
          24)
    );

  return days < 0
    ? 0
    : days;
}

/*
============================================================
TEMPO RESOLUTION
============================================================
*/

function resolveTempoDays(
  payable: PurchasePayable,
  supplier: Supplier | null
) {
  if (
    payable.tempoDays !==
      null &&
    payable.tempoDays !==
      undefined
  ) {
    const value =
      Number(
        payable.tempoDays
      );

    if (
      Number.isFinite(value)
    ) {
      return Math.max(
        0,
        value
      );
    }
  }

  if (
    supplier?.tempoDays !==
      null &&
    supplier?.tempoDays !==
      undefined
  ) {
    const value =
      Number(
        supplier.tempoDays
      );

    if (
      Number.isFinite(value)
    ) {
      return Math.max(
        0,
        value
      );
    }
  }

  return getTempoDaysFromDates(
    payable.invoiceDate,
    payable.dueDate
  );
}

/*
============================================================
TEMPO LABEL
============================================================
*/

function formatTempo(
  tempoDays: number | null
) {
  if (
    tempoDays === null ||
    !Number.isFinite(
      tempoDays
    )
  ) {
    return "-";
  }

  if (
    tempoDays <= 0
  ) {
    return "COD / Hari Ini";
  }

  return `${tempoDays} Hari`;
}

/*
============================================================
ROLE
============================================================
*/

function normalizeRole(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /\s+/g,
      "_"
    );
}

function isOutletAdmin(
  role: string
) {
  return [
    "ADMIN_OUTLET",
    "OUTLET_ADMIN",
    "ADMINOUTLET",
    "OUTLET",
  ].includes(role);
}

function isCenterAdmin(
  role: string
) {
  return [
    "ADMIN_PUSAT",
    "PUSAT_ADMIN",
    "ADMINPUSAT",
    "SUPER_ADMIN",
    "SUPERADMIN",
    "ADMIN",
  ].includes(role);
}

/*
============================================================
STATUS
============================================================
*/

function normalizePayableStatus(
  payable: PurchasePayable,
  remaining: number,
  paid: number
): PayableStatus {
  const status =
    String(
      payable.status || ""
    )
      .trim()
      .toUpperCase();

  if (
    status === "PAID" ||
    status === "LUNAS" ||
    status === "FULLY_PAID"
  ) {
    return "LUNAS";
  }

  if (
    status === "PARTIAL" ||
    status === "SEBAGIAN" ||
    status === "PARTIALLY_PAID"
  ) {
    if (
      remaining <= 0
    ) {
      return "LUNAS";
    }

    return "SEBAGIAN";
  }

  if (
    status === "UNPAID" ||
    status === "BELUM BAYAR" ||
    status === "BELUM_BAYAR" ||
    status === "OPEN" ||
    status === "PENDING" ||
    status === "OUTSTANDING"
  ) {
    if (
      remaining <= 0
    ) {
      return "LUNAS";
    }

    if (
      paid > 0
    ) {
      return "SEBAGIAN";
    }

    return "BELUM BAYAR";
  }

  if (
    remaining <= 0
  ) {
    return "LUNAS";
  }

  if (
    paid > 0
  ) {
    return "SEBAGIAN";
  }

  return "BELUM BAYAR";
}

/*
============================================================
STATUS BADGE
============================================================
*/

function StatusBadge({
  status,
}: {
  status: PayableStatus;
}) {
  const config = {
    LUNAS: {
      icon: CheckCircle2,
      label: "LUNAS",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
    },

    SEBAGIAN: {
      icon: Clock3,
      label: "SEBAGIAN",
      className:
        "border-amber-200 bg-amber-50 text-amber-700",
    },

    "BELUM BAYAR": {
      icon: AlertCircle,
      label: "BELUM BAYAR",
      className:
        "border-red-200 bg-red-50 text-red-700",
    },
  }[status];

  const Icon =
    config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-wide ${config.className}`}
    >
      <Icon size={12} />
      {config.label}
    </span>
  );
}

/*
============================================================
SOURCE BADGE
============================================================
*/

function SourceBadge({
  source,
}: {
  source: SourceType;
}) {
  if (
    source === "PUSAT"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-blue-700">
        <Building2 size={12} />
        PUSAT
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-violet-700">
      <Store size={12} />
      OUTLET
    </span>
  );
}

/*
============================================================
STAT CARD
============================================================
*/

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: any;
  tone:
    | "red"
    | "slate"
    | "emerald"
    | "amber";
  accent: string;
}) {
  const tones = {
    red:
      "bg-red-50 text-red-600 border-red-100",
    slate:
      "bg-slate-100 text-slate-600 border-slate-200",
    emerald:
      "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber:
      "bg-amber-50 text-amber-600 border-amber-100",
  };

  return (
    <div className="group relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.045)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_42px_rgba(15,23,42,0.09)]">

      <div
        className={`absolute inset-x-0 top-0 h-[3px] ${accent}`}
      />

      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-slate-100/40 blur-2xl transition group-hover:scale-150" />

      <div className="relative flex items-start justify-between gap-4">

        <div className="min-w-0">

          <div className="flex items-center gap-2">

            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
              {label}
            </p>

          </div>

          <p className="mt-2 truncate text-[23px] font-black tracking-[-0.03em] text-slate-800">
            {value}
          </p>

          <p className="mt-2 text-[11px] leading-4 text-slate-500">
            {sub}
          </p>

        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${tones[tone]} shadow-sm`}
        >
          <Icon size={19} />
        </div>

      </div>
    </div>
  );
}

/*
============================================================
SUPPLIER SEARCH DROPDOWN
============================================================
*/

function SupplierSearchDropdown({
  suppliers,
  value,
  onChange,
}: {
  suppliers: Supplier[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] =
    useState(false);

  const [query, setQuery] =
    useState("");

  const wrapperRef =
    useRef<HTMLDivElement>(
      null
    );

  const selectedSupplier =
    suppliers.find(
      (supplier) =>
        String(
          supplier.id
        ) === value
    );

  const filteredSuppliers =
    useMemo(() => {
      const keyword =
        query
          .trim()
          .toLowerCase();

      if (!keyword) {
        return suppliers;
      }

      return suppliers.filter(
        (supplier) =>
          String(
            supplier.name ?? ""
          )
            .toLowerCase()
            .includes(
              keyword
            ) ||
          String(
            supplier.code ?? ""
          )
            .toLowerCase()
            .includes(
              keyword
            )
      );
    }, [
      suppliers,
      query,
    ]);

  useEffect(() => {
    function handleOutside(
      event: MouseEvent
    ) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutside
      );
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
        className={`flex h-11 w-full items-center justify-between rounded-xl border px-3.5 text-left text-sm font-semibold outline-none transition ${
          open
            ? "border-[#527A6B] bg-white ring-4 ring-[#527A6B]/10"
            : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5">

          <Search
            size={15}
            className="shrink-0 text-slate-400"
          />

          <span
            className={
              selectedSupplier
                ? "truncate text-slate-700"
                : "truncate text-slate-400"
            }
          >
            {selectedSupplier
              ? selectedSupplier.name ||
                selectedSupplier.code ||
                `Supplier ${selectedSupplier.id}`
              : "Cari / pilih supplier..."}
          </span>

        </div>

        <div className="flex items-center gap-1">

          {selectedSupplier && (
            <span
              onClick={(event) => {
                event.stopPropagation();
                onChange("SEMUA");
                setQuery("");
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={13} />
            </span>
          )}

          <ChevronDown
            size={15}
            className={`text-slate-400 transition ${
              open
                ? "rotate-180"
                : ""
            }`}
          />

        </div>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.15)]">

          <div className="border-b border-slate-100 bg-slate-50/80 p-2">

            <div className="relative">

              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                autoFocus
                type="text"
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value
                  )
                }
                placeholder="Ketik nama / kode supplier..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-700 outline-none focus:border-[#527A6B] focus:ring-4 focus:ring-[#527A6B]/10"
              />

            </div>

          </div>

          <div className="max-h-[280px] overflow-y-auto p-1.5">

            <button
              type="button"
              onClick={() => {
                onChange("SEMUA");
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                value === "SEMUA"
                  ? "bg-[#527A6B]/10 text-[#527A6B]"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2.5">

                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <SlidersHorizontal
                    size={14}
                  />
                </div>

                <div>
                  <p className="text-xs font-bold">
                    Semua Supplier
                  </p>
                  <p className="text-[9px] text-slate-400">
                    Tampilkan seluruh supplier
                  </p>
                </div>

              </div>

              {value === "SEMUA" && (
                <CheckCircle2
                  size={15}
                  className="text-[#527A6B]"
                />
              )}

            </button>

            {filteredSuppliers.length ===
            0 ? (
              <div className="px-4 py-8 text-center">

                <Search
                  size={22}
                  className="mx-auto text-slate-300"
                />

                <p className="mt-2 text-xs font-bold text-slate-500">
                  Supplier tidak ditemukan
                </p>

                <p className="mt-1 text-[10px] text-slate-400">
                  Coba nama atau kode supplier lain.
                </p>

              </div>
            ) : (
              filteredSuppliers.map(
                (supplier) => {
                  const supplierValue =
                    String(
                      supplier.id
                    );

                  const active =
                    value ===
                    supplierValue;

                  return (
                    <button
                      type="button"
                      key={`supplier-option-${supplier.id}`}
                      onClick={() => {
                        onChange(
                          supplierValue
                        );
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                        active
                          ? "bg-[#527A6B]/10"
                          : "hover:bg-slate-50"
                      }`}
                    >

                      <div className="flex min-w-0 items-center gap-2.5">

                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            active
                              ? "bg-[#527A6B] text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Landmark
                            size={14}
                          />
                        </div>

                        <div className="min-w-0">

                          <p
                            className={`truncate text-xs font-bold ${
                              active
                                ? "text-[#527A6B]"
                                : "text-slate-700"
                            }`}
                          >
                            {supplier.name ||
                              supplier.code ||
                              `Supplier ${supplier.id}`}
                          </p>

                          <div className="mt-0.5 flex items-center gap-2">

                            {supplier.code && (
                              <span className="text-[9px] font-medium text-slate-400">
                                {supplier.code}
                              </span>
                            )}

                            {supplier.tempoDays !=
                              null && (
                              <span className="text-[9px] font-medium text-slate-400">
                                ·{" "}
                                {
                                  supplier.tempoDays
                                }{" "}
                                hari
                              </span>
                            )}

                          </div>

                        </div>

                      </div>

                      {active && (
                        <CheckCircle2
                          size={15}
                          className="shrink-0 text-[#527A6B]"
                        />
                      )}

                    </button>
                  );
                }
              )
            )}

          </div>

          <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-2">

            <p className="text-[9px] font-medium text-slate-400">
              {filteredSuppliers.length} supplier tersedia
            </p>

          </div>

        </div>
      )}
    </div>
  );
}

/*
============================================================
PAGE
============================================================
*/

export default function PurchasePayablePage() {
  const [
    payables,
    setPayables,
  ] = useState<
    PurchasePayable[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /*
   * FILTER
   */

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    "SEMUA" | PayableStatus
  >("SEMUA");

  const [
    sourceFilter,
    setSourceFilter,
  ] = useState<
    "SEMUA" | SourceType
  >("SEMUA");

  const [
    supplierFilter,
    setSupplierFilter,
  ] = useState("SEMUA");

  /*
   * USER
   */

  const [
    userContext,
    setUserContext,
  ] = useState<UserContext>({
    role: "",
    outletId: null,
    outlet: null,
  });

  const [
    userLoading,
    setUserLoading,
  ] = useState(true);

  /*
   * ========================================================
   * LOAD USER
   * ========================================================
   */

  async function loadUser() {
    try {
      const response =
        await fetch(
          "/api/me",
          {
            cache:
              "no-store",
          }
        );

      if (
        !response.ok
      ) {
        return;
      }

      const json =
        await response.json();

      const user =
        json?.user ??
        json?.data ??
        json ??
        {};

      const rawOutlet =
        user?.outlet ??
        user?.currentOutlet ??
        json?.outlet ??
        json?.currentOutlet ??
        null;

      const outletIdRaw =
        user?.outletId ??
        rawOutlet?.id ??
        json?.outletId ??
        json?.currentOutletId ??
        null;

      const parsedOutletId =
        Number(
          outletIdRaw
        );

      setUserContext({
        role: normalizeRole(
          user?.role ??
            json?.role
        ),

        outletId:
          Number.isInteger(
            parsedOutletId
          ) &&
          parsedOutletId > 0
            ? parsedOutletId
            : null,

        outlet: rawOutlet
          ? {
              id: Number(
                rawOutlet.id
              ),
              code:
                rawOutlet.code,
              name:
                rawOutlet.name,
            }
          : null,
      });
    } catch (err) {
      console.error(
        "LOAD /api/me ERROR:",
        err
      );
    } finally {
      setUserLoading(
        false
      );
    }
  }

  /*
   * ========================================================
   * LOAD PAYABLE
   * ========================================================
   */

  async function loadData(
    showRefresh = false
  ) {
    try {
      if (
        showRefresh
      ) {
        setRefreshing(
          true
        );
      } else {
        setLoading(
          true
        );
      }

      setError("");

      const response =
        await fetch(
          "/api/purchase-payable",
          {
            cache:
              "no-store",
          }
        );

      if (
        !response.ok
      ) {
        let message =
          "Gagal mengambil data Purchase Payable.";

        try {
          const body =
            await response.json();

          if (
            body?.error
          ) {
            message =
              body.error;
          } else if (
            body?.message
          ) {
            message =
              body.message;
          }
        } catch {}

        throw new Error(
          message
        );
      }

      const json =
        await response.json();

      const data =
        Array.isArray(
          json
        )
          ? json
          : Array.isArray(
              json?.data
            )
          ? json.data
          : Array.isArray(
              json?.payables
            )
          ? json.payables
          : [];

      setPayables(
        data as PurchasePayable[]
      );
    } catch (err: any) {
      console.error(
        "PURCHASE PAYABLE ERROR:",
        err
      );

      setError(
        err?.message ||
          "Terjadi kesalahan saat mengambil data Purchase Payable."
      );

      setPayables([]);
    } finally {
      setLoading(
        false
      );

      setRefreshing(
        false
      );
    }
  }

  /*
   * ========================================================
   * INITIAL LOAD
   * ========================================================
   */

  useEffect(() => {
    loadUser();
    loadData();
  }, []);

  const outletAdmin =
    isOutletAdmin(
      userContext.role
    );

  const centerAdmin =
    isCenterAdmin(
      userContext.role
    );

  /*
   * ========================================================
   * BUILD ROWS
   * ========================================================
   */

  const payableRows =
    useMemo<
      PayableRow[]
    >(() => {
      const rows: PayableRow[] =
        [];

      for (
        const payable of payables
      ) {
        const purchase =
          payable.purchase ??
          payable.outletPurchase;

        if (
          !purchase
        ) {
          continue;
        }

        const isOutlet =
          payable.outletPurchaseId !==
            null &&
          payable.outletPurchaseId !==
            undefined;

        const source: SourceType =
          isOutlet
            ? "OUTLET"
            : "PUSAT";

        const sourcePurchaseId =
          isOutlet
            ? payable.outletPurchaseId
            : payable.purchaseId;

        if (
          sourcePurchaseId ===
            null ||
          sourcePurchaseId ===
            undefined
        ) {
          continue;
        }

        const purchaseId =
          Number(
            sourcePurchaseId
          );

        if (
          !Number.isInteger(
            purchaseId
          ) ||
          purchaseId <= 0
        ) {
          continue;
        }

        /*
         * OUTLET ADMIN SECURITY
         */

        if (
          outletAdmin
        ) {
          const rowOutletId =
            Number(
              payable.outletId ??
                payable.outlet?.id ??
                payable.outletPurchase
                  ?.outletId ??
                payable.outletPurchase
                  ?.outlet?.id ??
                0
            );

          if (
            source !==
              "OUTLET" ||
            !userContext.outletId ||
            rowOutletId !==
              userContext.outletId
          ) {
            continue;
          }
        }

        /*
         * AMOUNT
         */

        const amount =
          Math.max(
            0,
            toNumber(
              payable.amount
            )
          );

        const paidAmount =
          Math.min(
            amount,
            Math.max(
              0,
              toNumber(
                payable.paidAmount
              )
            )
          );

        /*
         * OUTSTANDING
         */

        const rawOutstanding =
          Number(
            payable.outstanding
          );

        const remaining =
          Number.isFinite(
            rawOutstanding
          )
            ? Math.max(
                0,
                rawOutstanding
              )
            : Math.max(
                0,
                amount -
                  paidAmount
              );

        /*
         * STATUS
         */

        const status =
          normalizePayableStatus(
            payable,
            remaining,
            paidAmount
          );

        /*
         * SUPPLIER
         */

        const supplier =
          payable.supplier ??
          purchase.supplier ??
          null;

        /*
         * OUTLET
         */

        const outlet =
          payable.outlet ??
          ("outlet" in purchase
            ? purchase.outlet ??
              null
            : null);

        /*
         * TEMPO
         */

        const tempoDays =
          resolveTempoDays(
            payable,
            supplier
          );

        /*
         * DUE DATE
         */

        const dueDate =
          payable.dueDate ??
          null;

        rows.push({
          payableId:
            payable.id,

          source,

          sourceKey:
            `${source.toLowerCase()}-${purchaseId}-payable-${payable.id}`,

          purchase,

          supplier,

          outlet,

          invoiceNumber:
            payable.invoiceNumber ??
            null,

          invoiceDate:
            payable.invoiceDate ??
            null,

          tempoDays,

          dueDate,

          total:
            amount,

          paid:
            paidAmount,

          remaining,

          status,

          rawStatus:
            String(
              payable.status ??
                ""
            ).toUpperCase(),
        });
      }

      return rows.sort(
        (a, b) => {
          const dateA =
            new Date(
              a.purchase
                .purchaseDate ??
                ""
            ).getTime();

          const dateB =
            new Date(
              b.purchase
                .purchaseDate ??
                ""
            ).getTime();

          if (
            Number.isFinite(
              dateA
            ) &&
            Number.isFinite(
              dateB
            ) &&
            dateA !== dateB
          ) {
            return (
              dateB -
              dateA
            );
          }

          return (
            b.payableId -
            a.payableId
          );
        }
      );
    }, [
      payables,
      outletAdmin,
      userContext.outletId,
    ]);

  /*
   * ========================================================
   * SUPPLIERS
   * ========================================================
   */

  const suppliers =
    useMemo(() => {
      const map =
        new Map<
          number,
          Supplier
        >();

      for (
        const row of payableRows
      ) {
        if (
          row.supplier?.id !=
          null
        ) {
          map.set(
            Number(
              row.supplier.id
            ),
            row.supplier
          );
        }
      }

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          String(
            a.name ??
              ""
          ).localeCompare(
            String(
              b.name ??
                ""
            )
          )
      );
    }, [
      payableRows,
    ]);

  /*
   * ========================================================
   * FILTER
   * ========================================================
   */

  const filteredRows =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return payableRows.filter(
        (row) => {
          const purchase =
            row.purchase;

          const supplier =
            row.supplier;

          const outlet =
            row.outlet;

          const matchesSearch =
            !keyword ||
            String(
              purchase.number ??
                ""
            )
              .toLowerCase()
              .includes(
                keyword
              ) ||
            String(
              supplier?.name ??
                ""
            )
              .toLowerCase()
              .includes(
                keyword
              ) ||
            String(
              supplier?.code ??
                ""
            )
              .toLowerCase()
              .includes(
                keyword
              ) ||
            String(
              outlet?.name ??
                ""
            )
              .toLowerCase()
              .includes(
                keyword
              ) ||
            String(
              outlet?.code ??
                ""
            )
              .toLowerCase()
              .includes(
                keyword
              ) ||
            String(
              row.invoiceNumber ??
                ""
            )
              .toLowerCase()
              .includes(
                keyword
              ) ||
            String(
              row.payableId
            ).includes(
              keyword
            );

          const matchesStatus =
            statusFilter ===
              "SEMUA" ||
            row.status ===
              statusFilter;

          const matchesSource =
            sourceFilter ===
              "SEMUA" ||
            row.source ===
              sourceFilter;

          const matchesSupplier =
            supplierFilter ===
              "SEMUA" ||
            String(
              supplier?.id ??
                ""
            ) ===
              supplierFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesSource &&
            matchesSupplier
          );
        }
      );
    }, [
      payableRows,
      search,
      statusFilter,
      sourceFilter,
      supplierFilter,
    ]);

  /*
   * ========================================================
   * SUMMARY
   * ========================================================
   */

  const summary =
    useMemo(() => {
      return payableRows.reduce(
        (acc, row) => {
          acc.total +=
            row.total;

          acc.paid +=
            row.paid;

          acc.remaining +=
            row.remaining;

          if (
            row.status ===
            "BELUM BAYAR"
          ) {
            acc.unpaid +=
              1;
          }

          if (
            row.status ===
            "SEBAGIAN"
          ) {
            acc.partial +=
              1;
          }

          if (
            row.status ===
            "LUNAS"
          ) {
            acc.paidCount +=
              1;
          }

          if (
            row.source ===
            "PUSAT"
          ) {
            acc.pusat +=
              1;
          }

          if (
            row.source ===
            "OUTLET"
          ) {
            acc.outlet +=
              1;
          }

          if (
            row.remaining >
              0 &&
            row.dueDate
          ) {
            const dueTime =
              new Date(
                row.dueDate
              ).getTime();

            if (
              Number.isFinite(
                dueTime
              ) &&
              dueTime <
                Date.now()
            ) {
              acc.overdue +=
                1;

              acc.overdueAmount +=
                row.remaining;
            }
          }

          return acc;
        },
        {
          total: 0,
          paid: 0,
          remaining: 0,
          unpaid: 0,
          partial: 0,
          paidCount: 0,
          pusat: 0,
          outlet: 0,
          overdue: 0,
          overdueAmount: 0,
        }
      );
    }, [
      payableRows,
    ]);

  /*
   * ========================================================
   * FILTER TOTAL
   * ========================================================
   */

  const filteredTotals =
    useMemo(
      () =>
        filteredRows.reduce(
          (acc, row) => {
            acc.total +=
              row.total;

            acc.paid +=
              row.paid;

            acc.remaining +=
              row.remaining;

            return acc;
          },
          {
            total: 0,
            paid: 0,
            remaining: 0,
          }
        ),
      [filteredRows]
    );

  /*
   * ========================================================
   * RESET
   * ========================================================
   */

  function resetFilters() {
    setSearch("");
    setStatusFilter(
      "SEMUA"
    );

    setSourceFilter(
      outletAdmin
        ? "OUTLET"
        : "SEMUA"
    );

    setSupplierFilter(
      "SEMUA"
    );
  }

  /*
   * ========================================================
   * LOCK SOURCE
   * ========================================================
   */

  useEffect(() => {
    if (
      outletAdmin
    ) {
      setSourceFilter(
        "OUTLET"
      );
    }
  }, [
    outletAdmin,
  ]);

  /*
   * ========================================================
   * LABEL
   * ========================================================
   */

  const outletLabel =
    userContext.outlet
      ?.name ||
    (userContext.outletId
      ? `Outlet #${userContext.outletId}`
      : "Outlet Anda");

  /*
   * ========================================================
   * ACTIVE FILTER
   * ========================================================
   */

  const hasActiveFilter =
    Boolean(
      search ||
        statusFilter !==
          "SEMUA" ||
        (!outletAdmin &&
          sourceFilter !==
            "SEMUA") ||
        supplierFilter !==
          "SEMUA"
    );

  /*
   * ========================================================
   * SELECTED SUPPLIER
   * ========================================================
   */

  const selectedSupplier =
    suppliers.find(
      (supplier) =>
        String(
          supplier.id
        ) ===
        supplierFilter
    );

  /*
   * ========================================================
   * RENDER
   * ========================================================
   */

  return (
    <div className="min-h-screen bg-[#F3F6F4] text-slate-800">

      {/* ==================================================
          HERO HEADER
      ================================================== */}

      <header className="relative overflow-hidden border-b border-slate-200/70 bg-white">

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(82,122,107,0.10),transparent_30%),radial-gradient(circle_at_15%_90%,rgba(99,102,241,0.045),transparent_28%)]" />

        <div className="relative mx-auto max-w-[1700px] px-5 py-6 lg:px-7">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-center gap-4">

              <div className="relative">

                <div className="absolute inset-0 rounded-[19px] bg-[#527A6B]/20 blur-md" />

                <div className="relative flex h-14 w-14 items-center justify-center rounded-[19px] bg-gradient-to-br from-[#5F8C7B] to-[#3F6658] text-white shadow-[0_10px_26px_rgba(63,102,88,0.24)]">

                  <FileClock
                    size={24}
                    strokeWidth={1.8}
                  />

                </div>

              </div>

              <div>

                <div className="flex flex-wrap items-center gap-2">

                  <h1 className="text-[25px] font-black tracking-[-0.035em] text-slate-800">
                    Purchase Payable
                  </h1>

                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-slate-500">
                    <Sparkles
                      size={10}
                    />
                    Finance
                  </span>

                  {outletAdmin && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-extrabold text-violet-700">
                      <LockKeyhole
                        size={11}
                      />
                      OUTLET TERKUNCI
                    </span>
                  )}

                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Monitoring hutang pembelian supplier secara terpusat.
                </p>

              </div>

            </div>

            <div className="flex items-center gap-3">

              {outletAdmin && (
                <div className="hidden items-center gap-2.5 rounded-2xl border border-violet-200 bg-violet-50/80 px-3.5 py-2.5 shadow-sm sm:flex">

                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                    <Store
                      size={15}
                    />
                  </div>

                  <div>

                    <p className="text-[8px] font-extrabold uppercase tracking-[0.14em] text-violet-400">
                      Outlet aktif
                    </p>

                    <p className="text-xs font-extrabold text-violet-700">
                      {outletLabel}
                    </p>

                  </div>

                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  loadData(true)
                }
                disabled={
                  loading ||
                  refreshing
                }
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-[#527A6B]/30 hover:bg-[#527A6B]/5 hover:text-[#527A6B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={
                    refreshing
                      ? "animate-spin"
                      : "transition group-hover:rotate-45"
                  }
                />

                Refresh
              </button>

            </div>

          </div>

        </div>
      </header>

      <main className="mx-auto max-w-[1700px] px-5 py-6 lg:px-7">

        {/* ==================================================
            ERROR
        ================================================== */}

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-white px-4 py-3.5 shadow-sm">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertCircle
                size={17}
              />
            </div>

            <div className="min-w-0">

              <p className="text-xs font-extrabold text-red-800">
                Gagal memuat data
              </p>

              <p className="mt-0.5 text-xs text-red-700">
                {error}
              </p>

            </div>

          </div>
        )}

        {/* ==================================================
            ROLE INFO
        ================================================== */}

        {!userLoading &&
          outletAdmin && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-white px-4 py-3.5 shadow-sm">

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                <LockKeyhole
                  size={17}
                />
              </div>

              <div>

                <p className="text-xs font-extrabold text-violet-800">
                  Akses Outlet Terkunci
                </p>

                <p className="mt-0.5 text-xs leading-5 text-violet-700/80">
                  Anda hanya dapat melihat Purchase Payable milik{" "}
                  <b>
                    {outletLabel}
                  </b>
                  . Pemilihan outlet lain dinonaktifkan.
                </p>

              </div>

            </div>
          )}

        {/* ==================================================
            SUMMARY
        ================================================== */}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

          <StatCard
            label="Total Hutang"
            value={formatRupiah(
              summary.remaining
            )}
            sub={`${formatNumber(
              summary.unpaid +
                summary.partial
            )} transaksi belum lunas`}
            icon={WalletCards}
            tone="red"
            accent="bg-red-500"
          />

          <StatCard
            label="Nilai Purchase"
            value={formatRupiah(
              summary.total
            )}
            sub={`${summary.pusat} Pusat · ${summary.outlet} Outlet`}
            icon={ReceiptText}
            tone="slate"
            accent="bg-slate-400"
          />

          <StatCard
            label="Sudah Dibayar"
            value={formatRupiah(
              summary.paid
            )}
            sub={`${formatNumber(
              summary.paidCount
            )} transaksi sudah lunas`}
            icon={CircleDollarSign}
            tone="emerald"
            accent="bg-emerald-500"
          />

          <StatCard
            label="Jatuh Tempo"
            value={formatNumber(
              summary.overdue
            )}
            sub={
              summary.overdue >
              0
                ? `${formatRupiah(
                    summary.overdueAmount
                  )} masih terutang`
                : "Tidak ada hutang jatuh tempo"
            }
            icon={CalendarClock}
            tone="amber"
            accent="bg-amber-500"
          />

        </div>

        {/* ==================================================
            FILTER PANEL
        ================================================== */}

        <section className="mt-6 overflow-visible rounded-[22px] border border-slate-200/80 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.045)]">

          <div className="border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/50 px-5 py-4">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#527A6B]/10 text-[#527A6B]">
                  <SlidersHorizontal
                    size={16}
                  />
                </div>

                <div>

                  <h2 className="text-sm font-extrabold text-slate-800">
                    Filter Purchase Payable
                  </h2>

                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Cari dan kelompokkan hutang berdasarkan sumber, status, dan supplier.
                  </p>

                </div>

              </div>

              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={
                    resetFilters
                  }
                  className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:self-auto"
                >
                  <X
                    size={13}
                  />
                  Reset Filter
                </button>
              )}

            </div>

          </div>

          <div className="p-5">

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,1fr)_190px_190px_230px]">

              {/* SEARCH */}

              <div className="relative">

                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Cari PO, supplier, invoice, atau outlet..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-[#527A6B] focus:bg-white focus:ring-4 focus:ring-[#527A6B]/10"
                />

                {search ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X size={13} />
                  </button>
                ) : (
                  <div className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[8px] font-bold text-slate-400 xl:flex">
                    <Command
                      size={9}
                    />
                    K
                  </div>
                )}

              </div>

              {/* SOURCE */}

              <div className="relative">

                <select
                  value={
                    sourceFilter
                  }
                  onChange={(e) =>
                    setSourceFilter(
                      e.target
                        .value as
                        | "SEMUA"
                        | SourceType
                    )
                  }
                  disabled={
                    outletAdmin
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 pr-9 text-sm font-semibold text-slate-700 outline-none transition hover:border-slate-300 hover:bg-white focus:border-[#527A6B] focus:bg-white focus:ring-4 focus:ring-[#527A6B]/10 disabled:cursor-not-allowed disabled:border-violet-200 disabled:bg-violet-50 disabled:text-violet-700"
                >
                  <option value="SEMUA">
                    Semua Sumber
                  </option>

                  <option value="PUSAT">
                    Purchase Pusat
                  </option>

                  <option value="OUTLET">
                    Purchase Outlet
                  </option>
                </select>

                {outletAdmin ? (
                  <LockKeyhole
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-500"
                  />
                ) : (
                  <ChevronDown
                    size={15}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                )}

              </div>

              {/* STATUS */}

              <div className="relative">

                <select
                  value={
                    statusFilter
                  }
                  onChange={(e) =>
                    setStatusFilter(
                      e.target
                        .value as
                        | "SEMUA"
                        | PayableStatus
                    )
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 pr-9 text-sm font-semibold text-slate-700 outline-none transition hover:border-slate-300 hover:bg-white focus:border-[#527A6B] focus:bg-white focus:ring-4 focus:ring-[#527A6B]/10"
                >
                  <option value="SEMUA">
                    Semua Status
                  </option>

                  <option value="BELUM BAYAR">
                    Belum Bayar
                  </option>

                  <option value="SEBAGIAN">
                    Sebagian
                  </option>

                  <option value="LUNAS">
                    Lunas
                  </option>
                </select>

                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

              </div>

              {/* SUPPLIER SEARCH */}

              <SupplierSearchDropdown
                suppliers={
                  suppliers
                }
                value={
                  supplierFilter
                }
                onChange={
                  setSupplierFilter
                }
              />

            </div>

            {/* ACTIVE FILTER CHIPS */}

            {(hasActiveFilter ||
              selectedSupplier) && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">

                <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                  Filter aktif
                </span>

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#527A6B]/20 bg-[#527A6B]/5 px-2.5 py-1 text-[10px] font-bold text-[#527A6B]"
                  >
                    <Search
                      size={10}
                    />
                    "{search}"
                    <X
                      size={10}
                    />
                  </button>
                )}

                {statusFilter !==
                  "SEMUA" && (
                  <button
                    type="button"
                    onClick={() =>
                      setStatusFilter(
                        "SEMUA"
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700"
                  >
                    Status:{" "}
                    {
                      statusFilter
                    }
                    <X
                      size={10}
                    />
                  </button>
                )}

                {!outletAdmin &&
                  sourceFilter !==
                    "SEMUA" && (
                    <button
                      type="button"
                      onClick={() =>
                        setSourceFilter(
                          "SEMUA"
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700"
                    >
                      Sumber:{" "}
                      {
                        sourceFilter
                      }
                      <X
                        size={10}
                      />
                    </button>
                  )}

                {selectedSupplier && (
                  <button
                    type="button"
                    onClick={() =>
                      setSupplierFilter(
                        "SEMUA"
                      )
                    }
                    className="inline-flex max-w-[250px] items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700"
                  >
                    <Landmark
                      size={10}
                    />
                    <span className="truncate">
                      {selectedSupplier.name ||
                        selectedSupplier.code}
                    </span>
                    <X
                      size={10}
                    />
                  </button>
                )}

              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">

              <span>
                Menampilkan{" "}
                <b className="text-slate-700">
                  {filteredRows.length}
                </b>{" "}
                dari{" "}
                <b className="text-slate-700">
                  {payableRows.length}
                </b>{" "}
                transaksi
              </span>

              <span className="inline-flex items-center gap-1.5">
                Sisa hasil filter:
                <b className="font-extrabold text-red-600">
                  {formatRupiah(
                    filteredTotals.remaining
                  )}
                </b>
              </span>

            </div>

          </div>

        </section>

        {/* ==================================================
            TABLE
        ================================================== */}

        <section className="mt-5 overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.045)]">

          {/* TABLE TOP BAR */}

          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/50 px-5 py-3.5">

            <div className="flex items-center gap-2.5">

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <ReceiptText
                  size={15}
                />
              </div>

              <div>

                <p className="text-xs font-extrabold text-slate-700">
                  Daftar Purchase Payable
                </p>

                <p className="text-[9px] text-slate-400">
                  Data berdasarkan PurchasePayable
                </p>

              </div>

            </div>

            <div className="hidden items-center gap-2 sm:flex">

              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-500">
                {filteredRows.length} transaksi
              </span>

              {summary.overdue >
                0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[9px] font-extrabold text-red-600">
                  <AlertCircle
                    size={10}
                  />
                  {summary.overdue} jatuh tempo
                </span>
              )}

            </div>

          </div>

          {loading ||
          userLoading ? (
            <div className="flex min-h-[470px] flex-col items-center justify-center gap-4 text-slate-500">

              <div className="relative">

                <div className="absolute inset-0 rounded-2xl bg-[#527A6B]/10 blur-xl" />

                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                  <RefreshCw
                    size={23}
                    className="animate-spin text-[#527A6B]"
                  />
                </div>

              </div>

              <div className="text-center">

                <p className="text-sm font-extrabold text-slate-700">
                  Memuat Purchase Payable...
                </p>

                <p className="mt-1 text-[10px] text-slate-400">
                  Menyiapkan data hutang supplier
                </p>

              </div>

            </div>
          ) : filteredRows.length ===
            0 ? (
            <div className="flex min-h-[470px] flex-col items-center justify-center px-6 text-center">

              <div className="relative">

                <div className="absolute inset-0 rounded-3xl bg-slate-200/60 blur-xl" />

                <div className="relative flex h-20 w-20 items-center justify-center rounded-[25px] border border-slate-200 bg-slate-50 text-slate-300">
                  <FileClock
                    size={32}
                  />
                </div>

              </div>

              <h3 className="mt-5 text-sm font-extrabold text-slate-700">
                Tidak ada data hutang
              </h3>

              <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
                Belum ada PurchasePayable yang sesuai dengan akses dan filter yang sedang digunakan.
              </p>

              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={
                    resetFilters
                  }
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#527A6B] px-4 py-2.5 text-xs font-bold text-white shadow-[0_7px_20px_rgba(82,122,107,0.2)] transition hover:bg-[#456B5D] hover:shadow-[0_10px_25px_rgba(82,122,107,0.25)]"
                >
                  <RefreshCw
                    size={13}
                  />
                  Bersihkan Filter
                </button>
              )}

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[1650px]">

                <thead className="border-b border-slate-200 bg-slate-50/95">

                  <tr>

                    {[
                      [
                        "No",
                        "left",
                      ],
                      [
                        "Sumber",
                        "left",
                      ],
                      [
                        "Purchase",
                        "left",
                      ],
                      [
                        "Supplier",
                        "left",
                      ],
                      [
                        "Outlet",
                        "left",
                      ],
                      [
                        "Tanggal",
                        "left",
                      ],
                      [
                        "Tempo",
                        "left",
                      ],
                      [
                        "Jatuh Tempo",
                        "left",
                      ],
                      [
                        "Total",
                        "right",
                      ],
                      [
                        "Dibayar",
                        "right",
                      ],
                      [
                        "Sisa Hutang",
                        "right",
                      ],
                      [
                        "Status",
                        "center",
                      ],
                      [
                        "Aksi",
                        "center",
                      ],
                    ].map(
                      ([
                        label,
                        align,
                      ]) => (
                        <th
                          key={
                            label
                          }
                          className={`px-5 py-4 text-${align} text-[9px] font-black uppercase tracking-[0.15em] text-slate-400`}
                        >
                          {label}
                        </th>
                      )
                    )}

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-100">

                  {filteredRows.map(
                    (
                      row,
                      index
                    ) => {
                      const purchase =
                        row.purchase;

                      const dueTime =
                        row.dueDate
                          ? new Date(
                              row.dueDate
                            ).getTime()
                          : NaN;

                      const overdue =
                        row.remaining >
                          0 &&
                        Number.isFinite(
                          dueTime
                        ) &&
                        dueTime <
                          Date.now();

                      const paymentUrl =
                        `/payment?payableId=${row.payableId}`;

                      return (
                        <tr
                          key={
                            row.sourceKey
                          }
                          className="group transition duration-200 hover:bg-[#F6FAF8]"
                        >

                          {/* NO */}

                          <td className="whitespace-nowrap px-5 py-4">

                            <span className="text-xs font-extrabold text-slate-300 group-hover:text-[#527A6B]">
                              {String(
                                index +
                                  1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </span>

                          </td>

                          {/* SOURCE */}

                          <td className="whitespace-nowrap px-5 py-4">
                            <SourceBadge
                              source={
                                row.source
                              }
                            />
                          </td>

                          {/* PURCHASE */}

                          <td className="px-5 py-4">

                            <div>

                              <div className="flex items-center gap-2">

                                <p className="font-extrabold text-slate-800">
                                  {purchase.number ||
                                    "-"}
                                </p>

                                <ArrowUpRight
                                  size={12}
                                  className="text-slate-300 transition group-hover:text-[#527A6B]"
                                />

                              </div>

                              <p className="mt-1 text-[9px] font-medium text-slate-400">
                                {row.source ===
                                "PUSAT"
                                  ? "PO Pusat"
                                  : "PO Outlet"}{" "}
                                · ID #
                                {
                                  purchase.id
                                }
                              </p>

                              <p className="mt-1 text-[9px] font-extrabold text-[#527A6B]">
                                Payable #
                                {
                                  row.payableId
                                }
                              </p>

                              {row.invoiceNumber && (
                                <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                                  <ReceiptText
                                    size={9}
                                  />
                                  {
                                    row.invoiceNumber
                                  }
                                </p>
                              )}

                            </div>

                          </td>

                          {/* SUPPLIER */}

                          <td className="px-5 py-4">

                            <div className="flex items-start gap-2.5">

                              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                <Landmark
                                  size={14}
                                />
                              </div>

                              <div className="min-w-0">

                                <p className="max-w-[190px] truncate text-sm font-bold text-slate-700">
                                  {row.supplier
                                    ?.name ||
                                    "-"}
                                </p>

                                {row.supplier
                                  ?.code && (
                                  <p className="mt-1 text-[9px] font-medium text-slate-400">
                                    {
                                      row
                                        .supplier
                                        .code
                                    }
                                  </p>
                                )}

                                {row.supplier
                                  ?.tempoDays !=
                                  null && (
                                  <p className="mt-1 text-[9px] font-medium text-slate-400">
                                    Master tempo:{" "}
                                    <b className="text-slate-500">
                                      {
                                        row
                                          .supplier
                                          .tempoDays
                                      }
                                    </b>{" "}
                                    hari
                                  </p>
                                )}

                              </div>

                            </div>

                          </td>

                          {/* OUTLET */}

                          <td className="px-5 py-4">

                            {row.source ===
                            "OUTLET" ? (
                              <div>

                                <p className="max-w-[180px] truncate text-sm font-bold text-slate-700">
                                  {row.outlet
                                    ?.name ||
                                    "-"}
                                </p>

                                {row.outlet
                                  ?.code && (
                                  <p className="mt-1 text-[9px] font-medium text-slate-400">
                                    {
                                      row
                                        .outlet
                                        .code
                                    }
                                  </p>
                                )}

                              </div>
                            ) : (
                              <span className="text-sm text-slate-300">
                                —
                              </span>
                            )}

                          </td>

                          {/* TANGGAL */}

                          <td className="whitespace-nowrap px-5 py-4">

                            <p className="text-sm font-bold text-slate-600">
                              {formatDate(
                                row.invoiceDate
                              )}
                            </p>

                            <p className="mt-1 text-[8px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                              Invoice
                            </p>

                          </td>

                          {/* TEMPO */}

                          <td className="whitespace-nowrap px-5 py-4">

                            {row.tempoDays !==
                            null ? (
                              <div>

                                <p
                                  className={`text-sm font-extrabold ${
                                    row.tempoDays <=
                                    0
                                      ? "text-violet-600"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {formatTempo(
                                    row.tempoDays
                                  )}
                                </p>

                                <p className="mt-1 text-[8px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                                  Snapshot
                                </p>

                              </div>
                            ) : (
                              <span className="text-sm text-slate-300">
                                —
                              </span>
                            )}

                          </td>

                          {/* DUE DATE */}

                          <td className="whitespace-nowrap px-5 py-4">

                            {row.dueDate ? (
                              <div>

                                <p
                                  className={`text-sm font-extrabold ${
                                    overdue
                                      ? "text-red-600"
                                      : "text-slate-600"
                                  }`}
                                >
                                  {formatDate(
                                    row.dueDate
                                  )}
                                </p>

                                {overdue ? (
                                  <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-red-500">

                                    <AlertCircle
                                      size={
                                        9
                                      }
                                    />

                                    Jatuh tempo

                                  </span>
                                ) : (
                                  <span className="mt-1 inline-flex items-center gap-1 text-[8px] font-medium uppercase tracking-wide text-slate-400">

                                    <Clock3
                                      size={
                                        9
                                      }
                                    />

                                    Belum jatuh tempo

                                  </span>
                                )}

                              </div>
                            ) : (
                              <span className="text-sm text-slate-300">
                                —
                              </span>
                            )}

                          </td>

                          {/* TOTAL */}

                          <td className="whitespace-nowrap px-5 py-4 text-right">

                            <span className="text-sm font-extrabold text-slate-700">
                              {formatRupiah(
                                row.total
                              )}
                            </span>

                          </td>

                          {/* PAID */}

                          <td className="whitespace-nowrap px-5 py-4 text-right">

                            <span className="text-sm font-extrabold text-emerald-600">
                              {formatRupiah(
                                row.paid
                              )}
                            </span>

                          </td>

                          {/* REMAINING */}

                          <td className="whitespace-nowrap px-5 py-4 text-right">

                            <div>

                              <span
                                className={`text-sm font-black ${
                                  row.remaining >
                                  0
                                    ? "text-red-600"
                                    : "text-emerald-600"
                                }`}
                              >
                                {formatRupiah(
                                  row.remaining
                                )}
                              </span>

                              {row.remaining >
                                0 && (
                                <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-red-100">

                                  <div
                                    className="h-full rounded-full bg-red-400"
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        Math.max(
                                          0,
                                          (row.remaining /
                                            Math.max(
                                              row.total,
                                              1
                                            )) *
                                            100
                                        )
                                      )}%`,
                                    }}
                                  />

                                </div>
                              )}

                            </div>

                          </td>

                          {/* STATUS */}

                          <td className="whitespace-nowrap px-5 py-4 text-center">

                            <StatusBadge
                              status={
                                row.status
                              }
                            />

                          </td>

                          {/* AKSI */}

                          <td className="whitespace-nowrap px-5 py-4 text-center">

                            {row.remaining <=
                            0 ? (
                              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-extrabold text-emerald-700">
                                <CheckCircle2
                                  size={12}
                                />
                                Lunas
                              </span>
                            ) : outletAdmin ? (
                              <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-400">
                                <LockKeyhole
                                  size={12}
                                />
                                Tidak tersedia
                              </span>
                            ) : (
                              <Link
                                href={
                                  paymentUrl
                                }
                                className="group/pay inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#527A6B] to-[#456B5D] px-3.5 py-2 text-[10px] font-extrabold text-white shadow-[0_5px_14px_rgba(82,122,107,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(82,122,107,0.28)]"
                              >
                                <CreditCard
                                  size={12}
                                  className="transition group-hover/pay:scale-110"
                                />
                                Bayar
                              </Link>
                            )}

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

                {/* FOOTER */}

                <tfoot className="border-t border-slate-200 bg-slate-50">

                  <tr>

                    <td
                      colSpan={
                        8
                      }
                      className="px-5 py-4 text-right text-[9px] font-black uppercase tracking-[0.15em] text-slate-400"
                    >
                      Total Hasil Filter
                    </td>

                    <td className="px-5 py-4 text-right text-sm font-black text-slate-800">
                      {formatRupiah(
                        filteredTotals.total
                      )}
                    </td>

                    <td className="px-5 py-4 text-right text-sm font-black text-emerald-600">
                      {formatRupiah(
                        filteredTotals.paid
                      )}
                    </td>

                    <td className="px-5 py-4 text-right text-sm font-black text-red-600">
                      {formatRupiah(
                        filteredTotals.remaining
                      )}
                    </td>

                    <td
                      colSpan={
                        2
                      }
                    />

                  </tr>

                </tfoot>

              </table>

            </div>
          )}

        </section>

        {/* ==================================================
            FOOTNOTE
        ================================================== */}

        <div className="mt-4 rounded-[22px] border border-slate-200/80 bg-white px-5 py-4 shadow-sm">

          <div className="flex items-start gap-3">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#527A6B]/10 text-[#527A6B]">
              <AlertCircle
                size={15}
              />
            </div>

            <div className="text-[11px] leading-5 text-slate-500">

              <p>
                <b className="text-slate-700">
                  PurchasePayable
                </b>{" "}
                adalah sumber resmi untuk Total, Dibayar, Sisa Hutang, dan Status.
              </p>

              <p className="mt-1.5">
                <b className="text-slate-700">
                  Tempo
                </b>{" "}
                mengambil nilai dari{" "}
                <b className="text-slate-700">
                  tempoDays
                </b>{" "}
                yang dikirim API. Jika tidak tersedia, sistem menggunakan tempo dari Supplier, kemudian menggunakan selisih Invoice dengan Jatuh Tempo sebagai fallback.
              </p>

              <p className="mt-1.5">
                <b className="text-slate-700">
                  Jatuh Tempo
                </b>{" "}
                menggunakan langsung{" "}
                <b className="text-slate-700">
                  PurchasePayable.dueDate
                </b>{" "}
                yang tersimpan. Sistem tidak menghitung ulang jatuh tempo transaksi lama berdasarkan Master Supplier saat ini.
              </p>

              <p className="mt-1.5">
                <b className="text-slate-700">
                  Pembayaran TEMPO
                </b>{" "}
                bukan dilakukan dengan membuat payable baru dari halaman pembayaran. Payable TEMPO harus sudah terbentuk saat proses Receipt, kemudian pembayaran berikutnya melakukan settlement terhadap payable tersebut.
              </p>

              {outletAdmin && (
                <p className="mt-1.5">
                  <b className="text-violet-700">
                    Admin Outlet:
                  </b>{" "}
                  data dibatasi berdasarkan outlet yang terhubung dengan session user. Purchase Pusat dan outlet lain tidak ditampilkan.
                </p>
              )}

              {centerAdmin && (
                <p className="mt-1.5">
                  <b className="text-blue-700">
                    Admin Pusat:
                  </b>{" "}
                  dapat memonitor Purchase Pusat dan Purchase Outlet serta membuka proses pembayaran untuk payable yang masih memiliki outstanding.
                </p>
              )}

            </div>

          </div>

        </div>

      </main>
    </div>
  );
}