"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileClock,
  RefreshCw,
  Search,
  WalletCards,
} from "lucide-react";

type Supplier = {
  id?: number;
  code?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
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

type Payment = {
  id?: number;

  purchaseId?: number | null;
  outletPurchaseId?: number | null;

  purchase?: {
    id?: number;
    number?: string;
  } | null;

  outletPurchase?: {
    id?: number;
    number?: string;
    outlet?: Outlet | null;
  } | null;

  amount?: number;
  paidAmount?: number;
  paymentAmount?: number;
  nominal?: number;
  total?: number;

  status?: string;
  paymentDate?: string;
  createdAt?: string;

  supplierId?: number | null;
  supplier?: Supplier | null;

  [key: string]: any;
};

type PayableStatus =
  | "BELUM BAYAR"
  | "SEBAGIAN"
  | "LUNAS";

type SourceType = "PUSAT" | "OUTLET";

type PayableRow = {
  source: SourceType;
  sourceKey: string;

  purchase: Purchase | OutletPurchase;

  total: number;
  paid: number;
  remaining: number;

  status: PayableStatus;

  payments: Payment[];

  outlet?: Outlet | null;
};

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(
    value || 0
  );
}

function formatDate(value?: string) {
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

function getPaymentAmount(payment: Payment) {
  const candidates = [
    payment.amount,
    payment.paidAmount,
    payment.paymentAmount,
    payment.nominal,
    payment.total,
  ];

  for (const value of candidates) {
    const number = Number(value);

    if (
      Number.isFinite(number) &&
      number > 0
    ) {
      return number;
    }
  }

  return 0;
}

function getPaymentStatus(payment: Payment) {
  return String(
    payment.status || ""
  ).toUpperCase();
}

function isPaymentCancelled(payment: Payment) {
  return [
    "CANCELLED",
    "CANCELED",
    "VOID",
    "REJECTED",
    "DRAFT",
  ].includes(
    getPaymentStatus(payment)
  );
}

function isPaymentValid(payment: Payment) {
  if (isPaymentCancelled(payment)) {
    return false;
  }

  return getPaymentAmount(payment) > 0;
}

function isPayablePurchaseStatus(
  status?: string
) {
  return [
    "APPROVED",
    "RECEIVED",
    "COMPLETED",
    "PARTIAL",
    "CLOSED",
  ].includes(
    String(status || "").toUpperCase()
  );
}

function getPurchasePaymentId(
  payment: Payment
) {
  if (
    payment.purchaseId !== undefined &&
    payment.purchaseId !== null
  ) {
    const id = Number(
      payment.purchaseId
    );

    if (
      Number.isInteger(id) &&
      id > 0
    ) {
      return id;
    }
  }

  if (
    payment.purchase?.id !== undefined &&
    payment.purchase?.id !== null
  ) {
    const id = Number(
      payment.purchase.id
    );

    if (
      Number.isInteger(id) &&
      id > 0
    ) {
      return id;
    }
  }

  return null;
}

function getOutletPurchasePaymentId(
  payment: Payment
) {
  if (
    payment.outletPurchaseId !==
      undefined &&
    payment.outletPurchaseId !== null
  ) {
    const id = Number(
      payment.outletPurchaseId
    );

    if (
      Number.isInteger(id) &&
      id > 0
    ) {
      return id;
    }
  }

  if (
    payment.outletPurchase?.id !==
      undefined &&
    payment.outletPurchase?.id !==
      null
  ) {
    const id = Number(
      payment.outletPurchase.id
    );

    if (
      Number.isInteger(id) &&
      id > 0
    ) {
      return id;
    }
  }

  return null;
}

function StatusBadge({
  status,
}: {
  status: PayableStatus;
}) {
  if (status === "LUNAS") {
    return (
      <span
        className="
          inline-flex
          items-center
          gap-1.5
          rounded-full
          border
          border-emerald-200
          bg-emerald-50
          px-2.5
          py-1
          text-[11px]
          font-bold
          text-emerald-700
        "
      >
        <CheckCircle2 size={13} />
        LUNAS
      </span>
    );
  }

  if (status === "SEBAGIAN") {
    return (
      <span
        className="
          inline-flex
          items-center
          gap-1.5
          rounded-full
          border
          border-amber-200
          bg-amber-50
          px-2.5
          py-1
          text-[11px]
          font-bold
          text-amber-700
        "
      >
        <Clock3 size={13} />
        SEBAGIAN
      </span>
    );
  }

  return (
    <span
      className="
        inline-flex
        items-center
        gap-1.5
        rounded-full
        border
        border-red-200
        bg-red-50
        px-2.5
        py-1
        text-[11px]
        font-bold
        text-red-700
      "
    >
      <AlertCircle size={13} />
      BELUM BAYAR
    </span>
  );
}

export default function PurchasePayablePage() {
  const [purchases, setPurchases] =
    useState<Purchase[]>([]);

  const [
    outletPurchases,
    setOutletPurchases,
  ] = useState<OutletPurchase[]>([]);

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

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

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  async function loadData(
    showRefresh = false
  ) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [
        purchaseResponse,
        outletPurchaseResponse,
        paymentResponse,
      ] = await Promise.all([
        fetch("/api/purchase", {
          cache: "no-store",
        }),

        fetch("/api/outlet/purchase", {
          cache: "no-store",
        }),

        fetch("/api/payment", {
          cache: "no-store",
        }),
      ]);

      if (!purchaseResponse.ok) {
        throw new Error(
          "Gagal mengambil data Purchase Pusat."
        );
      }

      if (!outletPurchaseResponse.ok) {
        throw new Error(
          "Gagal mengambil data Purchase Outlet."
        );
      }

      if (!paymentResponse.ok) {
        throw new Error(
          "Gagal mengambil data Payment."
        );
      }

      const purchaseJson =
        await purchaseResponse.json();

      const outletPurchaseJson =
        await outletPurchaseResponse.json();

      const paymentJson =
        await paymentResponse.json();

      const purchaseData =
        Array.isArray(purchaseJson)
          ? purchaseJson
          : Array.isArray(
              purchaseJson?.data
            )
          ? purchaseJson.data
          : Array.isArray(
              purchaseJson?.purchases
            )
          ? purchaseJson.purchases
          : [];

      const outletPurchaseData =
        Array.isArray(
          outletPurchaseJson
        )
          ? outletPurchaseJson
          : Array.isArray(
              outletPurchaseJson?.data
            )
          ? outletPurchaseJson.data
          : Array.isArray(
              outletPurchaseJson?.purchases
            )
          ? outletPurchaseJson.purchases
          : [];

      const paymentData =
        Array.isArray(paymentJson)
          ? paymentJson
          : Array.isArray(
              paymentJson?.data
            )
          ? paymentJson.data
          : Array.isArray(
              paymentJson?.payments
            )
          ? paymentJson.payments
          : [];

      setPurchases(
        purchaseData as Purchase[]
      );

      setOutletPurchases(
        outletPurchaseData as OutletPurchase[]
      );

      setPayments(
        paymentData as Payment[]
      );
    } catch (err: any) {
      console.error(
        "PURCHASE PAYABLE ERROR:",
        err
      );

      setError(
        err?.message ||
          "Terjadi kesalahan saat mengambil data."
      );

      setPurchases([]);
      setOutletPurchases([]);
      setPayments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const payableRows =
    useMemo<PayableRow[]>(() => {
      const pusatPaymentMap =
        new Map<
          number,
          Payment[]
        >();

      const outletPaymentMap =
        new Map<
          number,
          Payment[]
        >();

      for (const payment of payments) {
        if (!isPaymentValid(payment)) {
          continue;
        }

        const purchaseId =
          getPurchasePaymentId(
            payment
          );

        if (purchaseId) {
          const current =
            pusatPaymentMap.get(
              purchaseId
            ) || [];

          current.push(payment);

          pusatPaymentMap.set(
            purchaseId,
            current
          );
        }

        const outletPurchaseId =
          getOutletPurchasePaymentId(
            payment
          );

        if (outletPurchaseId) {
          const current =
            outletPaymentMap.get(
              outletPurchaseId
            ) || [];

          current.push(payment);

          outletPaymentMap.set(
            outletPurchaseId,
            current
          );
        }
      }

      /*
       * =====================================================
       * GABUNG DATA DENGAN MAP
       *
       * INI YANG MENCEGAH DUPLIKAT:
       *
       * pusat-1
       * outlet-1
       *
       * tetap boleh ada bersamaan.
       *
       * Tetapi pusat-1 tidak boleh muncul dua kali.
       * =====================================================
       */

      const uniqueRows =
        new Map<
          string,
          PayableRow
        >();

      /*
       * =====================================================
       * PURCHASE PUSAT
       * =====================================================
       */

      for (const purchase of purchases) {
        if (
          !isPayablePurchaseStatus(
            purchase.status
          )
        ) {
          continue;
        }

        const sourceKey =
          `pusat-${purchase.id}`;

        const total =
          Number(
            purchase.total || 0
          );

        const purchasePayments =
          pusatPaymentMap.get(
            purchase.id
          ) || [];

        const paid =
          purchasePayments.reduce(
            (
              sum,
              payment
            ) =>
              sum +
              getPaymentAmount(
                payment
              ),
            0
          );

        const remaining =
          Math.max(
            0,
            total - paid
          );

        let status: PayableStatus;

        if (
          remaining <= 0
        ) {
          status = "LUNAS";
        } else if (
          paid > 0
        ) {
          status = "SEBAGIAN";
        } else {
          status =
            "BELUM BAYAR";
        }

        /*
         * Jika data pusat ID yang sama
         * masuk dua kali dari API,
         * entry kedua akan menggantikan
         * entry pertama, bukan membuat
         * React row kedua.
         */
        uniqueRows.set(
          sourceKey,
          {
            source: "PUSAT",
            sourceKey,
            purchase,
            total,
            paid,
            remaining,
            status,
            payments:
              purchasePayments,
            outlet: null,
          }
        );
      }

      /*
       * =====================================================
       * PURCHASE OUTLET
       * =====================================================
       */

      for (const purchase of outletPurchases) {
        if (
          !isPayablePurchaseStatus(
            purchase.status
          )
        ) {
          continue;
        }

        const sourceKey =
          `outlet-${purchase.id}`;

        const total =
          Number(
            purchase.total || 0
          );

        const purchasePayments =
          outletPaymentMap.get(
            purchase.id
          ) || [];

        const paid =
          purchasePayments.reduce(
            (
              sum,
              payment
            ) =>
              sum +
              getPaymentAmount(
                payment
              ),
            0
          );

        const remaining =
          Math.max(
            0,
            total - paid
          );

        let status: PayableStatus;

        if (
          remaining <= 0
        ) {
          status = "LUNAS";
        } else if (
          paid > 0
        ) {
          status = "SEBAGIAN";
        } else {
          status =
            "BELUM BAYAR";
        }

        uniqueRows.set(
          sourceKey,
          {
            source: "OUTLET",
            sourceKey,
            purchase,
            total,
            paid,
            remaining,
            status,
            payments:
              purchasePayments,
            outlet:
              purchase.outlet ||
              null,
          }
        );
      }

      return Array.from(
        uniqueRows.values()
      ).sort((a, b) => {
        const dateA =
          new Date(
            a.purchase.purchaseDate ||
              ""
          ).getTime();

        const dateB =
          new Date(
            b.purchase.purchaseDate ||
              ""
          ).getTime();

        return dateB - dateA;
      });
    }, [
      purchases,
      outletPurchases,
      payments,
    ]);

  const suppliers =
    useMemo(() => {
      const map =
        new Map<
          number,
          Supplier
        >();

      for (const row of payableRows) {
        const supplier =
          row.purchase.supplier;

        if (
          supplier?.id !==
          undefined
        ) {
          map.set(
            supplier.id,
            supplier
          );
        }
      }

      return Array.from(
        map.values()
      ).sort((a, b) =>
        String(
          a.name || ""
        ).localeCompare(
          String(
            b.name || ""
          )
        )
      );
    }, [payableRows]);

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
            purchase.supplier;

          const outlet =
            row.outlet;

          const matchesSearch =
            !keyword ||
            String(
              purchase.number ||
                ""
            )
              .toLowerCase()
              .includes(
                keyword
              ) ||
            String(
              supplier?.name ||
                ""
            )
              .toLowerCase()
              .includes(
                keyword
              ) ||
            String(
              supplier?.code ||
                ""
            )
              .toLowerCase()
              .includes(
                keyword
              ) ||
            String(
              outlet?.name ||
                ""
            )
              .toLowerCase()
              .includes(
                keyword
              ) ||
            String(
              outlet?.code ||
                ""
            )
              .toLowerCase()
              .includes(
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
              supplier?.id ||
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
            acc.unpaid += 1;
          }

          if (
            row.status ===
            "SEBAGIAN"
          ) {
            acc.partial += 1;
          }

          if (
            row.status ===
            "LUNAS"
          ) {
            acc.paidCount += 1;
          }

          if (
            row.source ===
            "PUSAT"
          ) {
            acc.pusat += 1;
          }

          if (
            row.source ===
            "OUTLET"
          ) {
            acc.outlet += 1;
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
        }
      );
    }, [payableRows]);

  return (
    <div className="min-h-screen bg-[#F5F7F6]">

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-6 py-6">

          <div
            className="
              flex
              flex-col
              gap-4
              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >

            <div>
              <div className="flex items-center gap-3">

                <div
                  className="
                    flex
                    h-11
                    w-11
                    items-center
                    justify-center
                    rounded-xl
                    bg-[#527A6B]
                    text-white
                    shadow-sm
                  "
                >
                  <FileClock
                    size={21}
                    strokeWidth={1.9}
                  />
                </div>

                <div>
                  <h1
                    className="
                      text-2xl
                      font-bold
                      tracking-tight
                      text-slate-800
                    "
                  >
                    Purchase Payable
                  </h1>

                  <p
                    className="
                      mt-1
                      text-sm
                      text-slate-500
                    "
                  >
                    Hutang pembelian
                    supplier Pusat dan
                    Outlet
                  </p>
                </div>

              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                loadData(true)
              }
              disabled={
                loading ||
                refreshing
              }
              className="
                inline-flex
                h-10
                items-center
                justify-center
                gap-2
                rounded-xl
                border
                border-slate-200
                bg-white
                px-4
                text-sm
                font-semibold
                text-slate-700
                shadow-sm
                transition
                hover:bg-slate-50
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>

          </div>

        </div>
      </div>

      <main
        className="
          mx-auto
          max-w-[1600px]
          px-6
          py-6
        "
      >

        {error && (
          <div
            className="
              mb-5
              flex
              items-start
              gap-3
              rounded-xl
              border
              border-red-200
              bg-red-50
              px-4
              py-3
              text-sm
              text-red-700
            "
          >
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div>
              <p className="font-semibold">
                Gagal memuat data
              </p>

              <p className="mt-0.5">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* SUMMARY */}

        <div
          className="
            grid
            grid-cols-1
            gap-4
            md:grid-cols-2
            xl:grid-cols-4
          "
        >

          <div
            className="
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-5
              shadow-sm
            "
          >
            <div className="flex items-start justify-between">

              <div>
                <p
                  className="
                    text-xs
                    font-bold
                    uppercase
                    tracking-wider
                    text-slate-400
                  "
                >
                  Total Hutang
                </p>

                <p
                  className="
                    mt-2
                    text-xl
                    font-bold
                    text-red-600
                  "
                >
                  {formatRupiah(
                    summary.remaining
                  )}
                </p>
              </div>

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-red-50
                  text-red-600
                "
              >
                <FileClock
                  size={19}
                />
              </div>

            </div>

            <p className="mt-3 text-xs text-slate-500">
              Sisa hutang seluruh
              Purchase
            </p>
          </div>

          <div
            className="
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-5
              shadow-sm
            "
          >
            <div className="flex items-start justify-between">

              <div>
                <p
                  className="
                    text-xs
                    font-bold
                    uppercase
                    tracking-wider
                    text-slate-400
                  "
                >
                  Total Purchase
                </p>

                <p
                  className="
                    mt-2
                    text-xl
                    font-bold
                    text-slate-800
                  "
                >
                  {formatRupiah(
                    summary.total
                  )}
                </p>
              </div>

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-blue-50
                  text-blue-600
                "
              >
                <CreditCard
                  size={19}
                />
              </div>

            </div>

            <div className="mt-3 flex gap-4 text-xs text-slate-500">
              <span>
                Pusat:{" "}
                <b className="text-slate-700">
                  {summary.pusat}
                </b>
              </span>

              <span>
                Outlet:{" "}
                <b className="text-slate-700">
                  {summary.outlet}
                </b>
              </span>
            </div>
          </div>

          <div
            className="
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-5
              shadow-sm
            "
          >
            <div className="flex items-start justify-between">

              <div>
                <p
                  className="
                    text-xs
                    font-bold
                    uppercase
                    tracking-wider
                    text-slate-400
                  "
                >
                  Sudah Dibayar
                </p>

                <p
                  className="
                    mt-2
                    text-xl
                    font-bold
                    text-emerald-600
                  "
                >
                  {formatRupiah(
                    summary.paid
                  )}
                </p>
              </div>

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-emerald-50
                  text-emerald-600
                "
              >
                <CheckCircle2
                  size={19}
                />
              </div>

            </div>

            <p className="mt-3 text-xs text-slate-500">
              Total pembayaran tercatat
            </p>
          </div>

          <div
            className="
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-5
              shadow-sm
            "
          >
            <div className="flex items-start justify-between">

              <div>
                <p
                  className="
                    text-xs
                    font-bold
                    uppercase
                    tracking-wider
                    text-slate-400
                  "
                >
                  Status Hutang
                </p>

                <div className="mt-2 flex items-center gap-3">

                  <span
                    className="
                      text-xl
                      font-bold
                      text-red-600
                    "
                  >
                    {formatNumber(
                      summary.unpaid
                    )}
                  </span>

                  <span className="text-xs text-slate-500">
                    belum bayar
                  </span>

                </div>
              </div>

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-amber-50
                  text-amber-600
                "
              >
                <WalletCards
                  size={19}
                />
              </div>

            </div>

            <div className="mt-3 flex gap-4 text-xs text-slate-500">

              <span>
                Sebagian:{" "}
                <b className="text-amber-600">
                  {summary.partial}
                </b>
              </span>

              <span>
                Lunas:{" "}
                <b className="text-emerald-600">
                  {summary.paidCount}
                </b>
              </span>

            </div>
          </div>

        </div>

        {/* FILTER */}

        <div
          className="
            mt-6
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-4
            shadow-sm
          "
        >

          <div
            className="
              grid
              grid-cols-1
              gap-3
              lg:grid-cols-[1fr_170px_170px_220px_auto]
            "
          >

            <div className="relative">

              <Search
                size={17}
                className="
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-slate-400
                "
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Cari nomor PO, supplier, atau outlet..."
                className="
                  h-11
                  w-full
                  rounded-xl
                  border
                  border-slate-200
                  bg-slate-50
                  pl-10
                  pr-4
                  text-sm
                  text-slate-700
                  outline-none
                  transition
                  focus:border-[#527A6B]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#527A6B]/10
                "
              />

            </div>

            <select
              value={sourceFilter}
              onChange={(event) =>
                setSourceFilter(
                  event.target.value as
                    | "SEMUA"
                    | SourceType
                )
              }
              className="
                h-11
                rounded-xl
                border
                border-slate-200
                bg-slate-50
                px-3
                text-sm
                font-medium
                text-slate-700
                outline-none
                focus:border-[#527A6B]
                focus:bg-white
              "
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

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as
                    | "SEMUA"
                    | PayableStatus
                )
              }
              className="
                h-11
                rounded-xl
                border
                border-slate-200
                bg-slate-50
                px-3
                text-sm
                font-medium
                text-slate-700
                outline-none
                focus:border-[#527A6B]
                focus:bg-white
              "
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

            <select
              value={supplierFilter}
              onChange={(event) =>
                setSupplierFilter(
                  event.target.value
                )
              }
              className="
                h-11
                rounded-xl
                border
                border-slate-200
                bg-slate-50
                px-3
                text-sm
                font-medium
                text-slate-700
                outline-none
                focus:border-[#527A6B]
                focus:bg-white
              "
            >
              <option value="SEMUA">
                Semua Supplier
              </option>

              {suppliers.map(
                (supplier) => (
                  <option
                    key={`supplier-${supplier.id}`}
                    value={String(
                      supplier.id
                    )}
                  >
                    {supplier.name ||
                      supplier.code ||
                      `Supplier ${supplier.id}`}
                  </option>
                )
              )}
            </select>

            {(search ||
              statusFilter !==
                "SEMUA" ||
              sourceFilter !==
                "SEMUA" ||
              supplierFilter !==
                "SEMUA") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter(
                    "SEMUA"
                  );
                  setSourceFilter(
                    "SEMUA"
                  );
                  setSupplierFilter(
                    "SEMUA"
                  );
                }}
                className="
                  h-11
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-4
                  text-sm
                  font-semibold
                  text-slate-600
                  transition
                  hover:bg-slate-50
                "
              >
                Reset
              </button>
            )}

          </div>

          <div
            className="
              mt-3
              flex
              flex-wrap
              items-center
              justify-between
              gap-2
              text-xs
              text-slate-500
            "
          >
            <span>
              Menampilkan{" "}
              <b className="text-slate-700">
                {filteredRows.length}
              </b>{" "}
              dari{" "}
              <b className="text-slate-700">
                {payableRows.length}
              </b>{" "}
              transaksi hutang
            </span>

            <span>
              Total sisa:{" "}
              <b className="text-red-600">
                {formatRupiah(
                  filteredRows.reduce(
                    (
                      sum,
                      row
                    ) =>
                      sum +
                      row.remaining,
                    0
                  )
                )}
              </b>
            </span>
          </div>

        </div>

        {/* TABLE */}

        <div
          className="
            mt-5
            overflow-hidden
            rounded-2xl
            border
            border-slate-200
            bg-white
            shadow-sm
          "
        >

          {loading ? (
            <div
              className="
                flex
                min-h-[360px]
                flex-col
                items-center
                justify-center
                gap-3
                text-slate-500
              "
            >
              <RefreshCw
                size={25}
                className="animate-spin"
              />

              <p className="text-sm">
                Memuat data purchase
                payable...
              </p>
            </div>
          ) : filteredRows.length ===
            0 ? (
            <div
              className="
                flex
                min-h-[360px]
                flex-col
                items-center
                justify-center
                px-6
                text-center
              "
            >
              <div
                className="
                  flex
                  h-14
                  w-14
                  items-center
                  justify-center
                  rounded-2xl
                  bg-slate-100
                  text-slate-400
                "
              >
                <FileClock
                  size={25}
                />
              </div>

              <h3
                className="
                  mt-4
                  text-sm
                  font-bold
                  text-slate-700
                "
              >
                Tidak ada data hutang
              </h3>

              <p
                className="
                  mt-1
                  max-w-md
                  text-xs
                  leading-5
                  text-slate-500
                "
              >
                Belum ada Purchase
                Pusat atau Outlet yang
                masuk sebagai payable,
                atau filter tidak
                menemukan data.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table
                className="
                  w-full
                  min-w-[1450px]
                "
              >

                <thead
                  className="
                    border-b
                    border-slate-200
                    bg-slate-50
                  "
                >
                  <tr>

                    <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      No
                    </th>

                    <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Sumber
                    </th>

                    <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Purchase
                    </th>

                    <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Supplier
                    </th>

                    <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Outlet
                    </th>

                    <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Tanggal
                    </th>

                    <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Total
                    </th>

                    <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Dibayar
                    </th>

                    <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Sisa Hutang
                    </th>

                    <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Aksi
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {filteredRows.map(
                    (row, index) => {
                      const purchase =
                        row.purchase;

                      const supplier =
                        purchase.supplier;

                      const rowKey =
                        row.sourceKey;

                      const paymentUrl =
                        row.source ===
                        "PUSAT"
                          ? `/payment?purchaseId=${purchase.id}`
                          : `/payment?outletPurchaseId=${purchase.id}`;

                      return (
                        <tr
                          key={rowKey}
                          className="
                            transition
                            hover:bg-slate-50
                          "
                        >

                          <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-400">
                            {index + 1}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4">

                            {row.source ===
                            "PUSAT" ? (
                              <span
                                className="
                                  inline-flex
                                  items-center
                                  rounded-full
                                  border
                                  border-blue-200
                                  bg-blue-50
                                  px-2.5
                                  py-1
                                  text-[11px]
                                  font-bold
                                  text-blue-700
                                "
                              >
                                PUSAT
                              </span>
                            ) : (
                              <span
                                className="
                                  inline-flex
                                  items-center
                                  rounded-full
                                  border
                                  border-violet-200
                                  bg-violet-50
                                  px-2.5
                                  py-1
                                  text-[11px]
                                  font-bold
                                  text-violet-700
                                "
                              >
                                OUTLET
                              </span>
                            )}

                          </td>

                          <td className="whitespace-nowrap px-5 py-4">

                            <div>
                              <p className="text-sm font-bold text-slate-800">
                                {purchase.number}
                              </p>

                              <p className="mt-1 text-[11px] text-slate-400">
                                {row.source ===
                                "PUSAT"
                                  ? "PO Pusat"
                                  : "PO Outlet"}{" "}
                                · ID #
                                {purchase.id}
                              </p>
                            </div>

                          </td>

                          <td className="px-5 py-4">

                            <div>
                              <p className="max-w-[220px] truncate text-sm font-semibold text-slate-700">
                                {supplier?.name ||
                                  "-"}
                              </p>

                              {supplier?.code && (
                                <p className="mt-1 text-[11px] text-slate-400">
                                  {supplier.code}
                                </p>
                              )}
                            </div>

                          </td>

                          <td className="px-5 py-4">

                            {row.source ===
                            "OUTLET" ? (
                              <div>
                                <p className="max-w-[180px] truncate text-sm font-semibold text-slate-700">
                                  {row.outlet?.name ||
                                    "-"}
                                </p>

                                {row.outlet?.code && (
                                  <p className="mt-1 text-[11px] text-slate-400">
                                    {row.outlet.code}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">
                                -
                              </span>
                            )}

                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                            {formatDate(
                              purchase.purchaseDate
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-slate-700">
                            {formatRupiah(
                              row.total
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-emerald-600">
                            {formatRupiah(
                              row.paid
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right">

                            <span
                              className={`text-sm font-bold ${
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

                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-center">
                            <StatusBadge
                              status={
                                row.status
                              }
                            />
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-center">

                            {row.remaining >
                            0 ? (
                              <Link
                                href={
                                  paymentUrl
                                }
                                className="
                                  inline-flex
                                  items-center
                                  gap-1.5
                                  rounded-lg
                                  bg-[#527A6B]
                                  px-3
                                  py-2
                                  text-[11px]
                                  font-bold
                                  text-white
                                  transition
                                  hover:bg-[#456B5D]
                                "
                              >
                                <CreditCard
                                  size={13}
                                />

                                Bayar
                              </Link>
                            ) : (
                              <span
                                className="
                                  inline-flex
                                  items-center
                                  gap-1.5
                                  rounded-lg
                                  border
                                  border-emerald-200
                                  bg-emerald-50
                                  px-3
                                  py-2
                                  text-[11px]
                                  font-bold
                                  text-emerald-700
                                "
                              >
                                <CheckCircle2
                                  size={13}
                                />

                                Lunas
                              </span>
                            )}

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

                <tfoot
                  className="
                    border-t
                    border-slate-200
                    bg-slate-50
                  "
                >
                  <tr>

                    <td
                      colSpan={6}
                      className="
                        px-5
                        py-4
                        text-right
                        text-xs
                        font-bold
                        uppercase
                        tracking-wider
                        text-slate-500
                      "
                    >
                      Total
                    </td>

                    <td className="px-5 py-4 text-right text-sm font-bold text-slate-800">
                      {formatRupiah(
                        filteredRows.reduce(
                          (
                            sum,
                            row
                          ) =>
                            sum +
                            row.total,
                          0
                        )
                      )}
                    </td>

                    <td className="px-5 py-4 text-right text-sm font-bold text-emerald-600">
                      {formatRupiah(
                        filteredRows.reduce(
                          (
                            sum,
                            row
                          ) =>
                            sum +
                            row.paid,
                          0
                        )
                      )}
                    </td>

                    <td className="px-5 py-4 text-right text-sm font-bold text-red-600">
                      {formatRupiah(
                        filteredRows.reduce(
                          (
                            sum,
                            row
                          ) =>
                            sum +
                            row.remaining,
                          0
                        )
                      )}
                    </td>

                    <td colSpan={2} />

                  </tr>
                </tfoot>

              </table>

            </div>
          )}

        </div>

        <div
          className="
            mt-4
            flex
            items-start
            gap-3
            rounded-xl
            border
            border-slate-200
            bg-white
            px-4
            py-3
            text-xs
            text-slate-500
          "
        >

          <AlertCircle
            size={16}
            className="
              mt-0.5
              shrink-0
              text-[#527A6B]
            "
          />

          <p className="leading-5">
            Purchase Payable mencakup
            <b className="text-slate-700">
              {" "}
              Purchase Pusat
            </b>{" "}
            dan
            <b className="text-slate-700">
              {" "}
              Purchase Outlet
            </b>
            . PO yang sudah
            APPROVED, RECEIVED,
            COMPLETED, PARTIAL, atau
            CLOSED dihitung sebagai
            payable. Pembayaran dihitung
            berdasarkan Purchase yang
            bersangkutan.
          </p>

        </div>

      </main>
    </div>
  );
}