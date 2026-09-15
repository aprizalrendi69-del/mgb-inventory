"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ArrowDownCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  Landmark,
  LockKeyhole,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";

/*
===========================================================
PAYMENT PAGE — PREMIUM ERP
===========================================================

DATA
-----------------------------------------------------------
1. Payment
   -> histori pembayaran

2. PurchasePayable
   -> hutang TEMPO / outstanding supplier

3. Supplier Invoice
   -> invoice seluruh metode pembayaran

SCOPE
-----------------------------------------------------------
Purchase        = PUSAT
OutletPurchase  = OUTLET

ACCESS
-----------------------------------------------------------
ADMIN OUTLET:
- boleh melihat histori
- tidak boleh membuat pembayaran
- outlet dikunci ke outlet user

ADMIN / MANAGER / PURCHASING / ADMIN PUSAT:
- boleh membuat pembayaran
- dapat filter outlet

===========================================================
*/

/* =========================================================
   TYPES
========================================================= */

type PaymentMethod =
  | "PETTY_CASH"
  | "TRANSFER"
  | "CASH"
  | "COD"
  | "CBD"
  | "TEMPO"
  | string;

type PaymentStatus =
  | "UNPAID"
  | "PARTIAL"
  | "PAID"
  | string;

type PayableStatus =
  | "UNPAID"
  | "PARTIAL"
  | "PAID"
  | string;

type Supplier = {
  id: number;
  code: string;
  name: string;
};

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type PurchaseReference = {
  id: number;
  number: string;
  purchaseDate?: string | null;
  supplier?: Supplier | null;
  outlet?: Outlet | null;
};

type Payable = {
  id: number;

  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;

  amount: number;
  paidAmount: number;
  outstanding: number;

  status: PayableStatus;

  supplier?: Supplier | null;
  outlet?: Outlet | null;

  purchaseId?: number | null;
  outletPurchaseId?: number | null;

  purchase?: PurchaseReference | null;
  outletPurchase?: PurchaseReference | null;

  source?: "PURCHASE" | "OUTLET_PURCHASE" | string;
  transactionNumber?: string | null;
  supplierName?: string | null;
  outletName?: string | null;
};

type Payment = {
  id: number;

  number: string;

  payableId?: number | null;

  paymentDate: string;

  amount: number;

  method: PaymentMethod;

  referenceNumber?: string | null;

  remarks?: string | null;

  invoiceNumber?: string | null;
  invoiceDate?: string | null;

  purchaseId?: number | null;
  outletPurchaseId?: number | null;

  purchaseNumber?: string | null;
  outletPurchaseNumber?: string | null;

  supplier?: Supplier | null;
  supplierName?: string | null;
  supplierCode?: string | null;

  outlet?: Outlet | null;
  outletName?: string | null;

  payable?: Payable | null;
};

type EnrichedPayment = Payment & {
  payable: Payable | null;
};

type TransactionScope =
  | "PUSAT"
  | "OUTLET"
  | "UNKNOWN";

type UserInfo = {
  id: number;
  fullname?: string;
  role: string;
  outletId?: number | null;
};

/* =========================================================
   FORMAT
========================================================= */

function formatRupiah(value: number) {
  return Number(value || 0).toLocaleString("id-ID");
}

function parseRupiah(value: string) {
  const raw = String(value || "").replace(/\D/g, "");

  if (!raw) return 0;

  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================================================
   LABEL
========================================================= */

function getPaymentMethodLabel(method: string) {
  switch (method) {
    case "PETTY_CASH":
      return "PETTY CASH";

    case "TRANSFER":
      return "TRANSFER";

    case "CASH":
      return "CASH";

    case "COD":
      return "COD";

    case "CBD":
      return "CBD";

    case "TEMPO":
      return "TEMPO";

    default:
      return method || "-";
  }
}

function getPaymentStatusLabel(status: string) {
  switch (status) {
    case "UNPAID":
      return "BELUM BAYAR";

    case "PARTIAL":
      return "SEBAGIAN";

    case "PAID":
      return "LUNAS";

    default:
      return status || "-";
  }
}

/* =========================================================
   STATUS
========================================================= */

function normalizePayableStatus(
  status: unknown,
  outstanding: number,
  paidAmount: number
): PayableStatus {
  const raw = String(status || "")
    .trim()
    .toUpperCase();

  if (
    raw === "PAID" ||
    raw === "LUNAS" ||
    raw === "FULLY_PAID"
  ) {
    return "PAID";
  }

  if (
    raw === "PARTIAL" ||
    raw === "SEBAGIAN" ||
    raw === "PARTIALLY_PAID"
  ) {
    return "PARTIAL";
  }

  if (
    raw === "UNPAID" ||
    raw === "BELUM BAYAR" ||
    raw === "BELUM_BAYAR" ||
    raw === "OPEN" ||
    raw === "PENDING"
  ) {
    if (outstanding <= 0) return "PAID";

    if (paidAmount > 0) return "PARTIAL";

    return "UNPAID";
  }

  if (outstanding <= 0) return "PAID";

  if (paidAmount > 0) return "PARTIAL";

  return "UNPAID";
}

function getStatusClass(status: string) {
  switch (status) {
    case "PAID":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "PARTIAL":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "UNPAID":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getMethodClass(method: string) {
  switch (method) {
    case "PETTY_CASH":
      return "border-violet-200 bg-violet-50 text-violet-700";

    case "TRANSFER":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "CASH":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "COD":
      return "border-orange-200 bg-orange-50 text-orange-700";

    case "CBD":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";

    case "TEMPO":
      return "border-slate-200 bg-slate-100 text-slate-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

/* =========================================================
   TRANSACTION SCOPE
========================================================= */

function getTransactionScope(
  payment: EnrichedPayment
): TransactionScope {
  if (
    payment.purchaseId ||
    payment.payable?.purchaseId ||
    payment.payable?.purchase?.id
  ) {
    return "PUSAT";
  }

  if (
    payment.outletPurchaseId ||
    payment.payable?.outletPurchaseId ||
    payment.payable?.outletPurchase?.id
  ) {
    return "OUTLET";
  }

  return "UNKNOWN";
}

function getScopeLabel(scope: TransactionScope) {
  switch (scope) {
    case "PUSAT":
      return "PUSAT";

    case "OUTLET":
      return "OUTLET";

    default:
      return "LAINNYA";
  }
}

function getScopeDescription(scope: TransactionScope) {
  switch (scope) {
    case "PUSAT":
      return "Pembelian Pusat";

    case "OUTLET":
      return "Pembelian Outlet";

    default:
      return "Transaksi";
  }
}

/* =========================================================
   NORMALIZE PAYABLE
========================================================= */

function normalizePayable(item: any): Payable | null {
  const id = Number(item?.id);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const amount = Math.max(
    0,
    Number(item?.amount ?? 0)
  );

  const paidAmount = Math.max(
    0,
    Number(item?.paidAmount ?? 0)
  );

  const rawOutstanding = Number(
    item?.outstanding
  );

  const outstanding = Number.isFinite(
    rawOutstanding
  )
    ? Math.max(rawOutstanding, 0)
    : Math.max(
        amount - paidAmount,
        0
      );

  const status = normalizePayableStatus(
    item?.status,
    outstanding,
    paidAmount
  );

  const purchaseIdRaw =
    item?.purchaseId ??
    item?.purchase?.id ??
    null;

  const purchaseId =
    purchaseIdRaw !== null &&
    purchaseIdRaw !== undefined &&
    Number.isInteger(
      Number(purchaseIdRaw)
    ) &&
    Number(purchaseIdRaw) > 0
      ? Number(purchaseIdRaw)
      : null;

  const outletPurchaseIdRaw =
    item?.outletPurchaseId ??
    item?.outletPurchase?.id ??
    null;

  const outletPurchaseId =
    outletPurchaseIdRaw !== null &&
    outletPurchaseIdRaw !== undefined &&
    Number.isInteger(
      Number(outletPurchaseIdRaw)
    ) &&
    Number(outletPurchaseIdRaw) > 0
      ? Number(outletPurchaseIdRaw)
      : null;

  const purchase = item?.purchase
    ? {
        ...item.purchase,
        id: Number(item.purchase.id),
      }
    : null;

  const outletPurchase =
    item?.outletPurchase
      ? {
          ...item.outletPurchase,
          id: Number(
            item.outletPurchase.id
          ),
        }
      : null;

  return {
    id,

    invoiceNumber:
      item?.invoiceNumber ??
      item?.invoiceNo ??
      item?.invoice ??
      null,

    invoiceDate:
      item?.invoiceDate ?? null,

    dueDate:
      item?.dueDate ?? null,

    amount,

    paidAmount,

    outstanding,

    status,

    supplier:
      item?.supplier ?? null,

    outlet:
      item?.outlet ?? null,

    purchaseId,

    outletPurchaseId,

    purchase,

    outletPurchase,

    source:
      item?.source ??
      (purchaseId
        ? "PURCHASE"
        : outletPurchaseId
        ? "OUTLET_PURCHASE"
        : "UNKNOWN"),

    transactionNumber:
      item?.transactionNumber ??
      purchase?.number ??
      outletPurchase?.number ??
      item?.invoiceNumber ??
      null,

    supplierName:
      item?.supplierName ??
      item?.supplier?.name ??
      purchase?.supplier?.name ??
      outletPurchase?.supplier?.name ??
      "-",

    outletName:
      item?.outletName ??
      item?.outlet?.name ??
      outletPurchase?.outlet?.name ??
      "-",
  };
}

/* =========================================================
   PAGE
========================================================= */

export default function PaymentPage() {
  const [user, setUser] =
    useState<UserInfo | null>(null);

  const [loadingUser, setLoadingUser] =
    useState(true);

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [payables, setPayables] =
    useState<Payable[]>([]);

  const [loadingPayables, setLoadingPayables] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [methodFilter, setMethodFilter] =
    useState("ALL");

  const [outletFilter, setOutletFilter] =
    useState("ALL");

  const [tanggalMulai, setTanggalMulai] =
    useState("");

  const [tanggalSelesai, setTanggalSelesai] =
    useState("");

  const [showPayment, setShowPayment] =
    useState(false);

  const [savingPayment, setSavingPayment] =
    useState(false);

  const [selectedPayable, setSelectedPayable] =
    useState<Payable | null>(null);

  const [paymentPayableId, setPaymentPayableId] =
    useState("");

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>(
      "PETTY_CASH"
    );

  const [paymentDate, setPaymentDate] =
    useState("");

  const [paymentReference, setPaymentReference] =
    useState("");

  const [paymentRemarks, setPaymentRemarks] =
    useState("");

  /* =======================================================
     LOAD USER
  ======================================================= */

  async function loadUser() {
    try {
      setLoadingUser(true);

      const res = await fetch(
        "/api/me",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      const currentUser =
        json?.user ??
        json?.data?.user ??
        json?.data ??
        json;

      if (
        res.ok &&
        currentUser?.id
      ) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error(
        "LOAD USER ERROR:",
        error
      );

      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }

  /* =======================================================
     LOAD PAYMENT
  ======================================================= */

  async function loadPayments() {
    try {
      setLoading(true);

      const res = await fetch(
        "/api/payment",
        {
          cache: "no-store",
        }
      );

      const contentType =
        res.headers.get(
          "content-type"
        ) || "";

      if (
        !contentType.includes(
          "application/json"
        )
      ) {
        const text =
          await res.text();

        throw new Error(
          `API payment mengembalikan response bukan JSON (${res.status}). ${text.slice(
            0,
            150
          )}`
        );
      }

      const json =
        await res.json();

      if (!res.ok) {
        throw new Error(
          json?.message ||
            json?.error ||
            "Gagal mengambil data pembayaran."
        );
      }

      const payload =
        json?.data ??
        json?.payments ??
        json;

      const paymentData =
        Array.isArray(payload)
          ? payload
          : payload?.payments ??
            payload?.data ??
            [];

      setPayments(
        Array.isArray(
          paymentData
        )
          ? paymentData
          : []
      );
    } catch (error) {
      console.error(
        "LOAD PAYMENT ERROR:",
        error
      );

      setPayments([]);
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     LOAD PAYABLE
  ======================================================= */

  async function loadPayables() {
    try {
      setLoadingPayables(true);

      const res = await fetch(
        "/api/purchase-payable",
        {
          cache: "no-store",
        }
      );

      const contentType =
        res.headers.get(
          "content-type"
        ) || "";

      if (
        !contentType.includes(
          "application/json"
        )
      ) {
        const text =
          await res.text();

        throw new Error(
          `API purchase-payable mengembalikan response bukan JSON (${res.status}). ${text.slice(
            0,
            150
          )}`
        );
      }

      const json =
        await res.json();

      if (!res.ok) {
        throw new Error(
          json?.message ||
            json?.error ||
            "Gagal mengambil data payable."
        );
      }

      const payload =
        json?.data ??
        json?.payables ??
        json;

      const payableData =
        Array.isArray(payload)
          ? payload
          : payload?.payables ??
            payload?.data ??
            [];

      const normalized =
        Array.isArray(
          payableData
        )
          ? payableData
              .map(normalizePayable)
              .filter(
                (
                  item
                ): item is Payable =>
                  item !== null
              )
          : [];

      setPayables(normalized);

      return normalized;
    } catch (error) {
      console.error(
        "LOAD PAYABLE ERROR:",
        error
      );

      setPayables([]);

      return [];
    } finally {
      setLoadingPayables(false);
    }
  }

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    void loadUser();
    void loadPayments();
    void loadPayables();
  }, []);

  /* =======================================================
     ROLE
  ======================================================= */

  const role = String(
    user?.role || ""
  )
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  const isOutletAdmin =
    role === "OUTLET_ADMIN" ||
    role === "ADMIN_OUTLET";

  const canPay =
    !isOutletAdmin &&
    (
      role === "ADMIN" ||
      role === "MANAGER" ||
      role === "PURCHASING" ||
      role === "ADMIN_PUSAT" ||
      role === "PUSAT_ADMIN" ||
      role === "SUPER_ADMIN" ||
      role === "SUPERADMIN"
    );

  /* =======================================================
     ENRICH PAYMENT
  ======================================================= */

  const enrichedPayments =
    useMemo<EnrichedPayment[]>(
      () => {
        const payableMap =
          new Map<
            number,
            Payable
          >();

        for (
          const payable of payables
        ) {
          payableMap.set(
            payable.id,
            payable
          );
        }

        return payments.map(
          (payment) => {
            const payableFromApi =
              payment.payable &&
              Number(
                payment.payable.id
              ) > 0
                ? payment.payable
                : null;

            const paymentPayableId =
              Number(
                payment.payableId ?? 0
              );

            const payable =
              paymentPayableId > 0
                ? payableMap.get(
                    paymentPayableId
                  ) ??
                  payableFromApi ??
                  null
                : payableFromApi;

            return {
              ...payment,
              payable,
            };
          }
        );
      },
      [
        payments,
        payables,
      ]
    );

  /* =======================================================
     HELPERS
  ======================================================= */

  function getInvoiceNumber(
    payment: EnrichedPayment
  ) {
    return (
      payment.invoiceNumber?.trim() ||
      payment.payable?.invoiceNumber?.trim() ||
      "-"
    );
  }

  function getSupplierName(
    payment: EnrichedPayment
  ) {
    return (
      payment.supplier?.name ||
      payment.supplierName ||
      payment.payable?.supplier?.name ||
      payment.payable?.supplierName ||
      "-"
    );
  }

  function getSupplierCode(
    payment: EnrichedPayment
  ) {
    return (
      payment.supplier?.code ||
      payment.supplierCode ||
      payment.payable?.supplier?.code ||
      "-"
    );
  }

  function getOutletName(
    payment: EnrichedPayment
  ) {
    const scope =
      getTransactionScope(
        payment
      );

    if (
      scope === "PUSAT"
    ) {
      return "Pusat";
    }

    return (
      payment.outlet?.name ||
      payment.outletName ||
      payment.payable?.outlet?.name ||
      payment.payable?.outletName ||
      payment.payable
        ?.outletPurchase
        ?.outlet?.name ||
      "-"
    );
  }

  function getOutletId(
    payment: EnrichedPayment
  ) {
    if (
      payment.outlet?.id
    ) {
      return Number(
        payment.outlet.id
      );
    }

    if (
      payment.payable?.outlet?.id
    ) {
      return Number(
        payment.payable.outlet.id
      );
    }

    if (
      payment.payable
        ?.outletPurchase
        ?.outlet?.id
    ) {
      return Number(
        payment.payable
          .outletPurchase
          .outlet.id
      );
    }

    return null;
  }

  function getPurchaseNumber(
    payment: EnrichedPayment
  ) {
    return (
      payment.purchaseNumber ||
      payment.outletPurchaseNumber ||
      payment.payable?.purchase?.number ||
      payment.payable?.outletPurchase?.number ||
      payment.payable?.transactionNumber ||
      "-"
    );
  }

  function getDisplayStatus(
    payment: EnrichedPayment
  ): PayableStatus {
    if (
      !payment.payable
    ) {
      return "PAID";
    }

    return (
      payment.payable.status ||
      "UNPAID"
    );
  }

  /* =======================================================
     OUTLET OPTIONS
  ======================================================= */

  const outletOptions =
    useMemo(() => {
      const map =
        new Map<
          number,
          Outlet
        >();

      const addOutlet = (
        outlet?: Outlet | null
      ) => {
        if (
          !outlet?.id
        ) {
          return;
        }

        const id =
          Number(
            outlet.id
          );

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {
          return;
        }

        map.set(
          id,
          {
            id,
            code:
              outlet.code ||
              `OUTLET-${id}`,
            name:
              outlet.name ||
              `Outlet ${id}`,
          }
        );
      };

      for (
        const payment of enrichedPayments
      ) {
        addOutlet(
          payment.outlet
        );

        addOutlet(
          payment.payable?.outlet
        );

        addOutlet(
          payment.payable
            ?.outletPurchase
            ?.outlet
        );
      }

      for (
        const payable of payables
      ) {
        addOutlet(
          payable.outlet
        );

        addOutlet(
          payable.outletPurchase
            ?.outlet
        );
      }

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
            "id"
          )
      );
    }, [
      enrichedPayments,
      payables,
    ]);

  /* =======================================================
     FORCE OUTLET ADMIN
  ======================================================= */

  useEffect(() => {
    if (
      isOutletAdmin &&
      user?.outletId
    ) {
      setOutletFilter(
        String(
          user.outletId
        )
      );
    }
  }, [
    isOutletAdmin,
    user?.outletId,
  ]);

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredPayments =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return enrichedPayments.filter(
        (payment) => {
          const displayStatus =
            getDisplayStatus(
              payment
            );

          if (
            statusFilter !==
              "ALL" &&
            displayStatus !==
              statusFilter
          ) {
            return false;
          }

          if (
            methodFilter !==
              "ALL" &&
            payment.method !==
              methodFilter
          ) {
            return false;
          }

          if (
            outletFilter !==
              "ALL"
          ) {
            const selectedOutletId =
              Number(
                outletFilter
              );

            const paymentOutletId =
              getOutletId(
                payment
              );

            if (
              paymentOutletId !==
              selectedOutletId
            ) {
              return false;
            }
          }

          const paymentDateValue =
            new Date(
              payment.paymentDate
            );

          if (
            Number.isNaN(
              paymentDateValue.getTime()
            )
          ) {
            return false;
          }

          const year =
            paymentDateValue.getFullYear();

          const month =
            String(
              paymentDateValue.getMonth() +
                1
            ).padStart(2, "0");

          const day =
            String(
              paymentDateValue.getDate()
            ).padStart(2, "0");

          const dateOnly =
            `${year}-${month}-${day}`;

          if (
            tanggalMulai &&
            dateOnly <
              tanggalMulai
          ) {
            return false;
          }

          if (
            tanggalSelesai &&
            dateOnly >
              tanggalSelesai
          ) {
            return false;
          }

          if (!keyword) {
            return true;
          }

          const invoice =
            getInvoiceNumber(
              payment
            );

          const supplier =
            getSupplierName(
              payment
            );

          const supplierCode =
            getSupplierCode(
              payment
            );

          const po =
            getPurchaseNumber(
              payment
            );

          const outlet =
            getOutletName(
              payment
            );

          const scope =
            getTransactionScope(
              payment
            );

          return (
            payment.number
              ?.toLowerCase()
              .includes(
                keyword
              ) ||

            payment.referenceNumber
              ?.toLowerCase()
              .includes(
                keyword
              ) ||

            payment.remarks
              ?.toLowerCase()
              .includes(
                keyword
              ) ||

            invoice
              .toLowerCase()
              .includes(
                keyword
              ) ||

            supplier
              .toLowerCase()
              .includes(
                keyword
              ) ||

            supplierCode
              .toLowerCase()
              .includes(
                keyword
              ) ||

            po
              .toLowerCase()
              .includes(
                keyword
              ) ||

            outlet
              .toLowerCase()
              .includes(
                keyword
              ) ||

            scope
              .toLowerCase()
              .includes(
                keyword
              )
          );
        }
      );
    }, [
      enrichedPayments,
      search,
      statusFilter,
      methodFilter,
      outletFilter,
      tanggalMulai,
      tanggalSelesai,
    ]);

  /* =======================================================
     SUMMARY
  ======================================================= */

  const totalPayment =
    useMemo(
      () =>
        payments.reduce(
          (
            sum,
            payment
          ) =>
            sum +
            Number(
              payment.amount || 0
            ),
          0
        ),
      [payments]
    );

  const totalTransaction =
    payments.length;

  const totalPaidInvoice =
    useMemo(
      () =>
        enrichedPayments.filter(
          (payment) =>
            getDisplayStatus(
              payment
            ) === "PAID"
        ).length,
      [enrichedPayments]
    );

  const totalPartialInvoice =
    useMemo(
      () =>
        enrichedPayments.filter(
          (payment) =>
            getDisplayStatus(
              payment
            ) === "PARTIAL"
        ).length,
      [enrichedPayments]
    );

  const totalOutstanding =
    useMemo(
      () =>
        payables
          .filter(
            (payable) =>
              payable.outstanding >
              0
          )
          .reduce(
            (
              sum,
              payable
            ) =>
              sum +
              Number(
                payable.outstanding ||
                  0
              ),
            0
          ),
      [payables]
    );

  const totalPusat =
    useMemo(
      () =>
        enrichedPayments.filter(
          (payment) =>
            getTransactionScope(
              payment
            ) === "PUSAT"
        ).length,
      [enrichedPayments]
    );

  const totalOutlet =
    useMemo(
      () =>
        enrichedPayments.filter(
          (payment) =>
            getTransactionScope(
              payment
            ) === "OUTLET"
        ).length,
      [enrichedPayments]
    );

  const filteredPaymentAmount =
    useMemo(
      () =>
        filteredPayments.reduce(
          (
            sum,
            payment
          ) =>
            sum +
            Number(
              payment.amount || 0
            ),
          0
        ),
      [filteredPayments]
    );

  /* =======================================================
     FILTER STATE
  ======================================================= */

  const hasActiveFilter =
    Boolean(
      search ||
        statusFilter !==
          "ALL" ||
        methodFilter !==
          "ALL" ||
        outletFilter !==
          "ALL" ||
        tanggalMulai ||
        tanggalSelesai
    );

  function resetFilter() {
    setSearch("");
    setStatusFilter("ALL");
    setMethodFilter("ALL");

    if (
      isOutletAdmin &&
      user?.outletId
    ) {
      setOutletFilter(
        String(
          user.outletId
        )
      );
    } else {
      setOutletFilter("ALL");
    }

    setTanggalMulai("");
    setTanggalSelesai("");
  }

  /* =======================================================
     PAYMENT FORM
  ======================================================= */

  function resetPaymentForm() {
    setSelectedPayable(null);
    setPaymentPayableId("");
    setPaymentAmount("");
    setPaymentMethod(
      "PETTY_CASH"
    );

    setPaymentDate(
      new Date()
        .toISOString()
        .slice(0, 10)
    );

    setPaymentReference("");
    setPaymentRemarks("");
  }

  function closePayment() {
    if (savingPayment) return;

    setShowPayment(false);
    resetPaymentForm();
  }

  /* =======================================================
     OPEN PAYMENT
  ======================================================= */

  async function openPayment(
    payableId?: number
  ) {
    if (!canPay) {
      alert(
        "User Admin Outlet tidak memiliki akses pembayaran."
      );

      return;
    }

    resetPaymentForm();
    setShowPayment(true);

    const freshPayables =
      await loadPayables();

    if (
      payableId &&
      payableId > 0
    ) {
      const selected =
        freshPayables.find(
          (item) =>
            item.id ===
              payableId &&
            item.outstanding >
              0
        );

      if (selected) {
        setSelectedPayable(
          selected
        );

        setPaymentPayableId(
          String(
            selected.id
          )
        );

        setPaymentAmount(
          formatRupiah(
            selected.outstanding
          )
        );
      }
    }
  }

  /* =======================================================
     SELECT PAYABLE
  ======================================================= */

  function handleSelectPayable(
    payableId: string
  ) {
    if (!canPay) return;

    if (!payableId) {
      setSelectedPayable(null);
      setPaymentPayableId("");
      setPaymentAmount("");

      return;
    }

    const payable =
      payables.find(
        (item) =>
          String(item.id) ===
            payableId &&
          item.outstanding > 0
      );

    if (!payable) {
      setSelectedPayable(null);
      setPaymentPayableId("");
      setPaymentAmount("");

      return;
    }

    setSelectedPayable(
      payable
    );

    setPaymentPayableId(
      String(
        payable.id
      )
    );

    setPaymentAmount(
      formatRupiah(
        payable.outstanding
      )
    );
  }

  /* =======================================================
     GET PO REFERENCE
  ======================================================= */

  function getPurchaseReference(
    payable: Payable
  ) {
    const purchaseId =
      Number(
        payable.purchaseId ??
          payable.purchase?.id ??
          0
      );

    const outletPurchaseId =
      Number(
        payable.outletPurchaseId ??
          payable.outletPurchase?.id ??
          0
      );

    return {
      purchaseId:
        Number.isInteger(
          purchaseId
        ) &&
        purchaseId > 0
          ? purchaseId
          : null,

      outletPurchaseId:
        Number.isInteger(
          outletPurchaseId
        ) &&
        outletPurchaseId > 0
          ? outletPurchaseId
          : null,
    };
  }

  /* =======================================================
     SUBMIT PAYMENT
  ======================================================= */

  async function submitPayment() {
    if (!canPay) {
      alert(
        "Anda tidak memiliki akses untuk melakukan pembayaran."
      );

      return;
    }

    const payableId =
      Number(
        paymentPayableId
      );

    const amount =
      parseRupiah(
        paymentAmount
      );

    if (
      !Number.isInteger(
        payableId
      ) ||
      payableId <= 0
    ) {
      alert(
        "Pilih invoice/payable terlebih dahulu."
      );

      return;
    }

    const payable =
      payables.find(
        (item) =>
          item.id ===
          payableId
      );

    if (!payable) {
      alert(
        "Invoice/payable tidak ditemukan."
      );

      return;
    }

    const outstanding =
      Number(
        payable.outstanding ||
          0
      );

    if (
      outstanding <= 0
    ) {
      alert(
        "Invoice tersebut sudah lunas."
      );

      return;
    }

    const {
      purchaseId,
      outletPurchaseId,
    } =
      getPurchaseReference(
        payable
      );

    if (
      !purchaseId &&
      !outletPurchaseId
    ) {
      alert(
        "Invoice ini tidak memiliki referensi PO pusat atau PO outlet. Silakan periksa data PurchasePayable."
      );

      return;
    }

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      alert(
        "Nominal pembayaran harus lebih dari 0."
      );

      return;
    }

    const EPSILON =
      0.000001;

    if (
      amount -
        outstanding >
      EPSILON
    ) {
      alert(
        `Nominal pembayaran tidak boleh melebihi outstanding Rp ${formatRupiah(
          outstanding
        )}.`
      );

      return;
    }

    if (!paymentMethod) {
      alert(
        "Pilih metode pembayaran."
      );

      return;
    }

    if (
      paymentMethod ===
      "TEMPO"
    ) {
      alert(
        "Metode TEMPO tidak dapat digunakan untuk pembayaran hutang."
      );

      return;
    }

    try {
      setSavingPayment(
        true
      );

      const paymentBody: Record<
        string,
        unknown
      > = {
        payableId,

        amount,

        method:
          paymentMethod ===
          "PETTY_CASH"
            ? "CASH"
            : paymentMethod,

        paymentDate:
          paymentDate ||
          undefined,

        referenceNumber:
          paymentReference.trim() ||
          undefined,

        remarks:
          paymentRemarks.trim() ||
          undefined,
      };

      if (purchaseId) {
        paymentBody.purchaseId =
          purchaseId;
      }

      if (
        outletPurchaseId
      ) {
        paymentBody.outletPurchaseId =
          outletPurchaseId;
      }

      const res =
        await fetch(
          "/api/payment",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              paymentBody
            ),
          }
        );

      const contentType =
        res.headers.get(
          "content-type"
        ) || "";

      if (
        !contentType.includes(
          "application/json"
        )
      ) {
        const text =
          await res.text();

        throw new Error(
          `Server mengembalikan response bukan JSON (${res.status}). ${text.slice(
            0,
            150
          )}`
        );
      }

      const json =
        await res.json();

      if (
        !res.ok ||
        json?.success ===
          false
      ) {
        throw new Error(
          json?.message ||
            json?.error ||
            "Gagal menyimpan pembayaran."
        );
      }

      setShowPayment(
        false
      );

      resetPaymentForm();

      await Promise.all([
        loadPayments(),
        loadPayables(),
      ]);

      alert(
        "Pembayaran berhasil disimpan."
      );
    } catch (error) {
      console.error(
        "SUBMIT PAYMENT ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan pembayaran."
      );
    } finally {
      setSavingPayment(
        false
      );
    }
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-h-full bg-[#F3F7F5]">

      {/* ===================================================
          PREMIUM HERO
      =================================================== */}

      <section className="relative overflow-hidden border-b border-[#DCE8E2] bg-white">

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(73,127,112,0.10),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(24,53,45,0.05),transparent_35%)]" />

        <div className="relative px-5 py-7 md:px-7 md:py-8 xl:px-9">

          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

            <div className="flex items-start gap-4">

              <div className="relative shrink-0">

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#18352D] text-white shadow-xl shadow-[#18352D]/15 md:h-16 md:w-16">

                  <CreditCard
                    size={27}
                    strokeWidth={2}
                  />

                </div>

                <div className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-[3px] border-white bg-emerald-500 text-white shadow-sm">

                  <CheckCircle2
                    size={12}
                    strokeWidth={3}
                  />

                </div>

              </div>

              <div className="min-w-0">

                <div className="flex flex-wrap items-center gap-2">

                  <span className="rounded-full border border-[#D3E4DD] bg-[#F0F7F3] px-2.5 py-1 text-[9px] font-extrabold tracking-[0.16em] text-[#497F70]">
                    FINANCE
                  </span>

                  {isOutletAdmin && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[9px] font-extrabold tracking-wide text-violet-700">
                      <LockKeyhole
                        size={10}
                      />
                      VIEW ONLY
                    </span>
                  )}

                </div>

                <h1 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#18352D] md:text-3xl">
                  Pembayaran Supplier
                </h1>

                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#71817B]">
                  Kelola pembayaran supplier,
                  invoice, outstanding,
                  dan histori transaksi
                  secara terpusat.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CDE0D7] bg-[#EEF6F2] px-3 py-1.5 text-[10px] font-extrabold text-[#497F70]">
                    <Landmark size={11} />
                    PUSAT
                    <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[9px]">
                      {totalPusat}
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold text-blue-700">
                    <Building2 size={11} />
                    OUTLET
                    <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[9px]">
                      {totalOutlet}
                    </span>
                  </span>

                  <span className="text-[10px] font-medium text-gray-400">
                    Sumber transaksi
                  </span>

                </div>

              </div>

            </div>

            <div className="flex flex-wrap items-center gap-2">

              <button
                type="button"
                onClick={() => {
                  void loadPayments();
                  void loadPayables();
                }}
                disabled={
                  loading ||
                  loadingPayables
                }
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E3DD] bg-white px-4 py-3 text-xs font-bold text-[#52645D] shadow-sm transition hover:-translate-y-0.5 hover:border-[#B9D0C6] hover:bg-[#F8FBF9] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={
                    loading ||
                    loadingPayables
                      ? "animate-spin"
                      : "transition-transform group-hover:rotate-90"
                  }
                />
                Refresh
              </button>

              {canPay && (
                <button
                  type="button"
                  onClick={() => {
                    void openPayment();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-5 py-3 text-xs font-extrabold text-white shadow-lg shadow-[#497F70]/20 transition hover:-translate-y-0.5 hover:bg-[#3D6D60] hover:shadow-xl"
                >
                  <Plus size={16} />
                  Pembayaran Baru
                </button>
              )}

            </div>

          </div>

        </div>

      </section>

      <div className="space-y-6 px-5 py-6 md:px-7 md:py-7 xl:px-9">

        {/* =================================================
            OUTLET ADMIN NOTICE
        ================================================= */}

        {isOutletAdmin && (
          <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">

            <div className="flex items-start gap-4 bg-gradient-to-r from-violet-50 via-white to-white px-5 py-4">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                <LockKeyhole size={18} />
              </div>

              <div className="min-w-0">

                <div className="flex flex-wrap items-center gap-2">

                  <p className="text-sm font-extrabold text-violet-900">
                    Mode lihat saja
                  </p>

                  {user?.outletId && (
                    <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-extrabold text-violet-600 ring-1 ring-violet-200">
                      OUTLET #{user.outletId}
                    </span>
                  )}

                </div>

                <p className="mt-1 text-xs leading-5 text-violet-700/80">
                  Akun Admin Outlet dapat
                  melihat histori pembayaran
                  outletnya, tetapi tidak dapat
                  membuat pembayaran baru.
                </p>

              </div>

            </div>

          </div>
        )}

        {/* =================================================
            SUMMARY CARDS
        ================================================= */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

          {/* TOTAL PAYMENT */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DCE8E2] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl">

            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#497F70]/5 blur-2xl transition group-hover:bg-[#497F70]/10" />

            <div className="relative">

              <div className="flex items-start justify-between">

                <div>

                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#82948D]">
                    Total Pembayaran
                  </p>

                  <p className="mt-2 text-lg font-black tracking-tight text-[#18352D]">
                    Rp {formatRupiah(totalPayment)}
                  </p>

                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <Wallet size={19} />
                </div>

              </div>

              <div className="mt-4 flex items-center gap-2 text-[10px] text-gray-400">

                <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />

                Akumulasi seluruh pembayaran

              </div>

            </div>

          </div>

          {/* TRANSACTIONS */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DCE8E2] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl">

            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-blue-500/5 blur-2xl" />

            <div className="relative">

              <div className="flex items-start justify-between">

                <div>

                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#82948D]">
                    Transaksi
                  </p>

                  <p className="mt-2 text-2xl font-black tracking-tight text-[#18352D]">
                    {totalTransaction}
                  </p>

                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <ReceiptText size={19} />
                </div>

              </div>

              <div className="mt-4 text-[10px] text-gray-400">
                Jumlah transaksi pembayaran
              </div>

            </div>

          </div>

          {/* PAID */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DCE8E2] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl">

            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-emerald-500/5 blur-2xl" />

            <div className="relative">

              <div className="flex items-start justify-between">

                <div>

                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#82948D]">
                    Invoice Lunas
                  </p>

                  <p className="mt-2 text-2xl font-black text-emerald-600">
                    {totalPaidInvoice}
                  </p>

                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={19} />
                </div>

              </div>

              <div className="mt-4 text-[10px] text-gray-400">
                Transaksi yang sudah selesai
              </div>

            </div>

          </div>

          {/* PARTIAL */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DCE8E2] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl">

            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-amber-500/5 blur-2xl" />

            <div className="relative">

              <div className="flex items-start justify-between">

                <div>

                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#82948D]">
                    Sebagian
                  </p>

                  <p className="mt-2 text-2xl font-black text-amber-600">
                    {totalPartialInvoice}
                  </p>

                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Clock3 size={19} />
                </div>

              </div>

              <div className="mt-4 text-[10px] text-gray-400">
                Invoice masih memiliki saldo
              </div>

            </div>

          </div>

          {/* OUTSTANDING */}

          <div className="group relative overflow-hidden rounded-2xl border border-red-100 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl">

            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-red-500/5 blur-2xl" />

            <div className="relative">

              <div className="flex items-start justify-between">

                <div>

                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-red-400">
                    Outstanding
                  </p>

                  <p className="mt-2 text-lg font-black tracking-tight text-red-600">
                    Rp {formatRupiah(totalOutstanding)}
                  </p>

                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <Landmark size={19} />
                </div>

              </div>

              <div className="mt-4 text-[10px] text-gray-400">
                Total payable belum lunas
              </div>

            </div>

          </div>

        </div>

        {/* =================================================
            MAIN PAYMENT PANEL
        ================================================= */}

        <section className="overflow-hidden rounded-3xl border border-[#DCE8E2] bg-white shadow-sm">

          {/* PANEL HEADER */}

          <div className="border-b border-[#E7EEEA] bg-gradient-to-r from-white via-white to-[#F7FAF8] px-5 py-5 md:px-6">

            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">

              <div>

                <div className="flex flex-wrap items-center gap-2">

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#18352D] text-white">
                    <ReceiptText size={17} />
                  </div>

                  <h2 className="text-base font-black tracking-tight text-[#18352D]">
                    Riwayat Pembayaran
                  </h2>

                  <span className="rounded-full bg-[#EAF3EF] px-2.5 py-1 text-[9px] font-extrabold text-[#497F70]">
                    {filteredPayments.length} transaksi
                  </span>

                </div>

                <p className="mt-2 text-xs text-gray-400">
                  Invoice supplier ditampilkan
                  berdasarkan dokumen penerimaan
                  dan relasi Purchase.
                </p>

              </div>

              <div className="rounded-2xl border border-[#DCE8E2] bg-[#F8FBF9] px-4 py-3">

                <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#82948D]">
                  Nilai hasil filter
                </p>

                <p className="mt-1 text-sm font-black text-[#18352D]">
                  Rp {formatRupiah(filteredPaymentAmount)}
                </p>

              </div>

            </div>

            {/* FILTERS */}

            <div className="mt-5 rounded-2xl border border-[#E1EBE6] bg-[#F9FBFA] p-4">

              <div className="mb-3 flex items-center justify-between">

                <div className="flex items-center gap-2">

                  <SlidersHorizontal
                    size={14}
                    className="text-[#497F70]"
                  />

                  <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#647870]">
                    Filter Transaksi
                  </span>

                </div>

                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={
                      resetFilter
                    }
                    className="text-[10px] font-extrabold text-[#497F70] transition hover:text-[#18352D]"
                  >
                    Reset Filter
                  </button>
                )}

              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">

                {/* SEARCH */}

                <div className="xl:col-span-2">

                  <label className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#82948D]">
                    Pencarian
                  </label>

                  <div className="relative">

                    <Search
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      type="text"
                      value={search}
                      onChange={(e) =>
                        setSearch(
                          e.target.value
                        )
                      }
                      placeholder="Invoice, supplier, PO, pembayaran..."
                      className="h-11 w-full rounded-xl border border-[#D6E4DE] bg-white pl-10 pr-3 text-xs font-medium text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    />

                  </div>

                </div>

                {/* OUTLET */}

                <div>

                  <label className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#82948D]">
                    Outlet
                  </label>

                  <div className="relative">

                    <Building2
                      size={15}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#497F70]"
                    />

                    <select
                      value={
                        outletFilter
                      }
                      onChange={(e) =>
                        setOutletFilter(
                          e.target.value
                        )
                      }
                      disabled={
                        isOutletAdmin
                      }
                      className="h-11 w-full appearance-none rounded-xl border border-[#D6E4DE] bg-white pl-10 pr-9 text-xs font-semibold text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10 disabled:cursor-not-allowed disabled:bg-[#F1F4F2] disabled:text-gray-500"
                    >

                      {!isOutletAdmin && (
                        <option value="ALL">
                          Semua Outlet
                        </option>
                      )}

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
                            {outlet.name}
                            {" — "}
                            {outlet.code}
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

                {/* STATUS */}

                <div>

                  <label className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#82948D]">
                    Status
                  </label>

                  <div className="relative">

                    <select
                      value={
                        statusFilter
                      }
                      onChange={(e) =>
                        setStatusFilter(
                          e.target.value
                        )
                      }
                      className="h-11 w-full appearance-none rounded-xl border border-[#D6E4DE] bg-white px-3 pr-9 text-xs font-semibold text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    >

                      <option value="ALL">
                        Semua Status
                      </option>

                      <option value="UNPAID">
                        Belum Bayar
                      </option>

                      <option value="PARTIAL">
                        Sebagian
                      </option>

                      <option value="PAID">
                        Lunas
                      </option>

                    </select>

                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                  </div>

                </div>

                {/* METHOD */}

                <div>

                  <label className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#82948D]">
                    Metode
                  </label>

                  <div className="relative">

                    <select
                      value={
                        methodFilter
                      }
                      onChange={(e) =>
                        setMethodFilter(
                          e.target.value
                        )
                      }
                      className="h-11 w-full appearance-none rounded-xl border border-[#D6E4DE] bg-white px-3 pr-9 text-xs font-semibold text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    >

                      <option value="ALL">
                        Semua Metode
                      </option>

                      <option value="PETTY_CASH">
                        Petty Cash
                      </option>

                      <option value="TRANSFER">
                        Transfer
                      </option>

                      <option value="CASH">
                        Cash
                      </option>

                      <option value="COD">
                        COD
                      </option>

                      <option value="CBD">
                        CBD
                      </option>

                      <option value="TEMPO">
                        Tempo
                      </option>

                    </select>

                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                  </div>

                </div>

                {/* START DATE */}

                <div>

                  <label className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#82948D]">
                    Dari
                  </label>

                  <div className="relative">

                    <CalendarDays
                      size={14}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
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
                      className="h-11 w-full rounded-xl border border-[#D6E4DE] bg-white pl-9 pr-3 text-xs font-medium text-gray-700 outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    />

                  </div>

                </div>

                {/* END DATE */}

                <div>

                  <label className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#82948D]">
                    Sampai
                  </label>

                  <div className="relative">

                    <CalendarDays
                      size={14}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
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
                      className="h-11 w-full rounded-xl border border-[#D6E4DE] bg-white pl-9 pr-3 text-xs font-medium text-gray-700 outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    />

                  </div>

                </div>

              </div>

              {hasActiveFilter && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E7EEEA] pt-3">

                  <span className="text-[10px] font-medium text-gray-400">
                    Filter aktif:
                  </span>

                  {outletFilter !==
                    "ALL" && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-bold text-blue-700">
                      Outlet
                    </span>
                  )}

                  {statusFilter !==
                    "ALL" && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-700">
                      Status
                    </span>
                  )}

                  {methodFilter !==
                    "ALL" && (
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[9px] font-bold text-violet-700">
                      Metode
                    </span>
                  )}

                  {(tanggalMulai ||
                    tanggalSelesai) && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-600">
                      Periode
                    </span>
                  )}

                </div>
              )}

            </div>

          </div>

          {/* =================================================
              TABLE
          ================================================= */}

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1750px] text-sm">

              <thead>

                <tr className="border-b border-[#E4ECE8] bg-[#F7FAF8]">

                  <th className="w-14 px-5 py-4 text-left text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#73867E]">
                    No
                  </th>

                  <th className="px-5 py-4 text-left text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#73867E]">
                    Pembayaran
                  </th>

                  <th className="px-5 py-4 text-left text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#73867E]">
                    Invoice Supplier
                  </th>

                  <th className="px-5 py-4 text-left text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#73867E]">
                    Supplier
                  </th>

                  <th className="px-5 py-4 text-left text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#73867E]">
                    Sumber
                  </th>

                  <th className="px-5 py-4 text-left text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#73867E]">
                    Outlet
                  </th>

                  <th className="px-5 py-4 text-left text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#73867E]">
                    Tanggal
                  </th>

                  <th className="px-5 py-4 text-left text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#73867E]">
                    Metode
                  </th>

                  <th className="px-5 py-4 text-right text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#73867E]">
                    Dibayar
                  </th>

                  <th className="px-5 py-4 text-right text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#73867E]">
                    Outstanding
                  </th>

                  <th className="px-5 py-4 text-center text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#73867E]">
                    Status
                  </th>

                  <th className="px-5 py-4 text-center text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#73867E]">
                    Aksi
                  </th>

                </tr>

              </thead>

              <tbody>

                {loading ||
                loadingUser ? (

                  <tr>

                    <td
                      colSpan={12}
                      className="px-5 py-20"
                    >

                      <div className="flex flex-col items-center">

                        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">

                          <div className="absolute inset-0 animate-ping rounded-2xl bg-[#497F70]/5" />

                          <RefreshCw
                            size={21}
                            className="relative animate-spin"
                          />

                        </div>

                        <p className="mt-4 text-sm font-extrabold text-[#18352D]">
                          Memuat pembayaran
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          Mengambil histori dan
                          outstanding supplier...
                        </p>

                      </div>

                    </td>

                  </tr>

                ) : filteredPayments.length ===
                  0 ? (

                  <tr>

                    <td
                      colSpan={12}
                      className="px-5 py-20"
                    >

                      <div className="flex flex-col items-center">

                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                          <ReceiptText
                            size={27}
                          />
                        </div>

                        <p className="mt-4 text-sm font-extrabold text-[#18352D]">
                          Tidak ada transaksi
                        </p>

                        <p className="mt-1 max-w-md text-center text-xs leading-5 text-gray-400">
                          Belum ada pembayaran yang
                          sesuai dengan filter yang
                          dipilih.
                        </p>

                        {hasActiveFilter && (
                          <button
                            type="button"
                            onClick={
                              resetFilter
                            }
                            className="mt-4 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-xs font-extrabold text-[#497F70] shadow-sm transition hover:bg-[#F5F8F6]"
                          >
                            Bersihkan Filter
                          </button>
                        )}

                      </div>

                    </td>

                  </tr>

                ) : (

                  filteredPayments.map(
                    (
                      payment,
                      index
                    ) => {

                      const payable =
                        payment.payable;

                      const outstanding =
                        Number(
                          payable?.outstanding ??
                            0
                        );

                      const displayStatus =
                        getDisplayStatus(
                          payment
                        );

                      const invoiceNumber =
                        getInvoiceNumber(
                          payment
                        );

                      const supplierName =
                        getSupplierName(
                          payment
                        );

                      const supplierCode =
                        getSupplierCode(
                          payment
                        );

                      const poNumber =
                        getPurchaseNumber(
                          payment
                        );

                      const outletName =
                        getOutletName(
                          payment
                        );

                      const scope =
                        getTransactionScope(
                          payment
                        );

                      const hasInvoice =
                        invoiceNumber !==
                        "-";

                      const isTempo =
                        payment.method ===
                        "TEMPO";

                      return (
                        <tr
                          key={
                            payment.id
                          }
                          className="group border-b border-[#EDF2EF] transition hover:bg-[#FBFDFC]"
                        >

                          {/* NO */}

                          <td className="px-5 py-5 align-top text-[10px] font-bold text-gray-300">
                            {String(
                              index + 1
                            ).padStart(
                              2,
                              "0"
                            )}
                          </td>

                          {/* PAYMENT */}

                          <td className="px-5 py-5 align-top">

                            <div className="flex items-start gap-3">

                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                  scope ===
                                  "PUSAT"
                                    ? "bg-[#EAF3EF] text-[#497F70]"
                                    : scope ===
                                      "OUTLET"
                                    ? "bg-blue-50 text-blue-600"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >

                                {scope ===
                                "PUSAT" ? (
                                  <Landmark
                                    size={17}
                                  />
                                ) : (
                                  <Building2
                                    size={17}
                                  />
                                )}

                              </div>

                              <div className="min-w-0">

                                <div className="flex flex-wrap items-center gap-1.5">

                                  <span className="font-extrabold tracking-tight text-[#18352D]">
                                    {payment.number ||
                                      "-"}
                                  </span>

                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-extrabold tracking-[0.12em] ${
                                      scope ===
                                      "PUSAT"
                                        ? "border-[#C9DED5] bg-[#EAF3EF] text-[#497F70]"
                                        : scope ===
                                          "OUTLET"
                                        ? "border-blue-200 bg-blue-50 text-blue-700"
                                        : "border-slate-200 bg-slate-50 text-slate-500"
                                    }`}
                                  >

                                    {scope ===
                                    "PUSAT" ? (
                                      <Landmark
                                        size={9}
                                      />
                                    ) : (
                                      <Building2
                                        size={9}
                                      />
                                    )}

                                    {getScopeLabel(
                                      scope
                                    )}

                                  </span>

                                </div>

                                <div className="mt-1 text-[9px] font-medium text-gray-400">
                                  {getScopeDescription(
                                    scope
                                  )}
                                </div>

                                {payment.referenceNumber && (
                                  <div className="mt-2 inline-flex rounded-lg bg-[#F5F8F6] px-2.5 py-1.5 text-[9px] font-medium text-gray-500">
                                    Ref:{" "}
                                    {
                                      payment.referenceNumber
                                    }
                                  </div>
                                )}

                              </div>

                            </div>

                          </td>

                          {/* INVOICE */}

                          <td className="px-5 py-5 align-top">

                            <div className="min-w-[230px]">

                              {hasInvoice ? (

                                <div className="rounded-xl border border-[#DDE9E4] bg-[#F8FBF9] p-3">

                                  <div className="flex items-start gap-2.5">

                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                                      <FileText
                                        size={14}
                                      />
                                    </div>

                                    <div className="min-w-0">

                                      <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#82948D]">
                                        Invoice Supplier
                                      </p>

                                      <p className="mt-1 break-all text-xs font-black tracking-tight text-[#18352D]">
                                        {
                                          invoiceNumber
                                        }
                                      </p>

                                      {payment.invoiceDate && (
                                        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-gray-400">
                                          <Clock3
                                            size={9}
                                          />
                                          {formatDate(
                                            payment.invoiceDate
                                          )}
                                        </div>
                                      )}

                                    </div>

                                  </div>

                                </div>

                              ) : (

                                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-3">

                                  <span className="text-[10px] font-medium text-gray-400">
                                    Tidak ada nomor invoice
                                  </span>

                                </div>

                              )}

                              <div className="mt-2 flex items-center gap-1.5 text-[9px] text-gray-400">
                                <ReceiptText
                                  size={10}
                                />
                                PO:
                                <span className="font-semibold text-gray-500">
                                  {poNumber}
                                </span>
                              </div>

                              {isTempo &&
                                payable?.dueDate && (
                                  <div className="mt-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-extrabold text-amber-700">
                                    Jatuh tempo{" "}
                                    {formatDate(
                                      payable.dueDate
                                    )}
                                  </div>
                                )}

                            </div>

                          </td>

                          {/* SUPPLIER */}

                          <td className="px-5 py-5 align-top">

                            <div className="max-w-[180px]">

                              <div className="truncate text-xs font-extrabold text-gray-700">
                                {
                                  supplierName
                                }
                              </div>

                              <div className="mt-1 text-[9px] font-medium uppercase tracking-wide text-gray-400">
                                {
                                  supplierCode
                                }
                              </div>

                            </div>

                          </td>

                          {/* SCOPE */}

                          <td className="px-5 py-5 align-top">

                            {scope ===
                            "PUSAT" ? (

                              <div className="flex items-center gap-2">

                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                                  <Landmark
                                    size={14}
                                  />
                                </div>

                                <div>

                                  <span className="inline-flex rounded-full border border-[#C9DED5] bg-[#EAF3EF] px-2.5 py-1 text-[8px] font-extrabold tracking-wider text-[#497F70]">
                                    PUSAT
                                  </span>

                                  <div className="mt-1 text-[9px] text-gray-400">
                                    Pembelian Pusat
                                  </div>

                                </div>

                              </div>

                            ) : scope ===
                              "OUTLET" ? (

                              <div className="flex items-center gap-2">

                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                  <Building2
                                    size={14}
                                  />
                                </div>

                                <div>

                                  <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[8px] font-extrabold tracking-wider text-blue-700">
                                    OUTLET
                                  </span>

                                  <div className="mt-1 text-[9px] text-gray-400">
                                    Pembelian Outlet
                                  </div>

                                </div>

                              </div>

                            ) : (
                              <span className="text-gray-300">
                                —
                              </span>
                            )}

                          </td>

                          {/* OUTLET */}

                          <td className="px-5 py-5 align-top">

                            {scope ===
                            "PUSAT" ? (

                              <div className="flex items-center gap-2">

                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                                  <Landmark
                                    size={14}
                                  />
                                </div>

                                <div>

                                  <div className="text-xs font-extrabold text-[#18352D]">
                                    Pusat
                                  </div>

                                  <div className="mt-0.5 text-[9px] text-gray-400">
                                    Gudang Pusat
                                  </div>

                                </div>

                              </div>

                            ) : scope ===
                              "OUTLET" ? (

                              <div className="flex items-center gap-2">

                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                  <Building2
                                    size={14}
                                  />
                                </div>

                                <div className="min-w-0">

                                  <div className="max-w-[150px] truncate text-xs font-extrabold text-gray-700">
                                    {
                                      outletName
                                    }
                                  </div>

                                  {payment.outlet?.code && (
                                    <div className="mt-0.5 text-[9px] uppercase tracking-wide text-gray-400">
                                      {
                                        payment.outlet.code
                                      }
                                    </div>
                                  )}

                                </div>

                              </div>

                            ) : (
                              <span className="text-gray-300">
                                —
                              </span>
                            )}

                          </td>

                          {/* DATE */}

                          <td className="px-5 py-5 align-top">

                            <div className="flex items-start gap-2">

                              <CalendarDays
                                size={14}
                                className="mt-0.5 shrink-0 text-gray-400"
                              />

                              <div>

                                <div className="whitespace-nowrap text-[10px] font-bold text-gray-600">
                                  {formatDate(
                                    payment.paymentDate
                                  )}
                                </div>

                                <div className="mt-1 whitespace-nowrap text-[9px] text-gray-400">
                                  {formatDateTime(
                                    payment.paymentDate
                                  )
                                    .split(
                                      ", "
                                    )[1] ||
                                    ""}
                                </div>

                              </div>

                            </div>

                          </td>

                          {/* METHOD */}

                          <td className="px-5 py-5 align-top">

                            <span
                              className={`inline-flex rounded-full border px-3 py-1.5 text-[9px] font-extrabold tracking-wide ${getMethodClass(
                                payment.method
                              )}`}
                            >
                              {getPaymentMethodLabel(
                                payment.method
                              )}
                            </span>

                          </td>

                          {/* PAID */}

                          <td className="px-5 py-5 text-right align-top">

                            <div className="font-black text-red-600">
                              Rp{" "}
                              {formatRupiah(
                                payment.amount
                              )}
                            </div>

                            <div className="mt-1 text-[9px] text-gray-400">
                              pembayaran
                            </div>

                          </td>

                          {/* OUTSTANDING */}

                          <td className="px-5 py-5 text-right align-top">

                            {payable ? (

                              <div>

                                <div
                                  className={`font-black ${
                                    outstanding >
                                    0
                                      ? "text-red-600"
                                      : "text-emerald-600"
                                  }`}
                                >
                                  Rp{" "}
                                  {formatRupiah(
                                    outstanding
                                  )}
                                </div>

                                {outstanding >
                                  0 && (
                                  <div className="mt-1 text-[9px] text-red-400">
                                    masih terutang
                                  </div>
                                )}

                              </div>

                            ) : (

                              <div>

                                <div className="font-black text-emerald-600">
                                  Rp 0
                                </div>

                                <div className="mt-1 text-[9px] text-gray-400">
                                  dibayar langsung
                                </div>

                              </div>

                            )}

                          </td>

                          {/* STATUS */}

                          <td className="px-5 py-5 text-center align-top">

                            <span
                              className={`inline-flex rounded-full border px-3 py-1.5 text-[9px] font-extrabold tracking-wide ${getStatusClass(
                                displayStatus
                              )}`}
                            >
                              {getPaymentStatusLabel(
                                displayStatus
                              )}
                            </span>

                          </td>

                          {/* ACTION */}

                          <td className="px-5 py-5 text-center align-top">

                            {isOutletAdmin ? (

                              <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[9px] font-extrabold text-slate-400">
                                <LockKeyhole
                                  size={11}
                                />
                                TERKUNCI
                              </span>

                            ) : payable &&
                              outstanding >
                                0 &&
                              canPay ? (

                              <button
                                type="button"
                                onClick={() => {
                                  void openPayment(
                                    payable.id
                                  );
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#497F70] px-3 py-2 text-[10px] font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#3D6D60] hover:shadow-md"
                              >
                                <ArrowDownCircle
                                  size={13}
                                />
                                Bayar Lagi
                              </button>

                            ) : (

                              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[9px] font-extrabold text-emerald-600">
                                <CheckCircle2
                                  size={12}
                                />
                                SELESAI
                              </span>

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

      {/* ===================================================
          PAYMENT MODAL
      =================================================== */}

      {showPayment &&
        canPay && (

          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#071713]/55 p-4 backdrop-blur-md">

            <div className="relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.25)]">

              {/* MODAL TOP ACCENT */}

              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#18352D] via-[#497F70] to-[#8CB5A6]" />

              {/* HEADER */}

              <div className="flex items-center justify-between border-b border-[#E5ECE9] bg-gradient-to-r from-[#F7FAF8] via-white to-white px-6 py-5">

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#18352D] text-white shadow-lg shadow-[#18352D]/15">
                    <CircleDollarSign
                      size={21}
                    />
                  </div>

                  <div>

                    <div className="flex items-center gap-2">

                      <h2 className="text-lg font-black tracking-tight text-[#18352D]">
                        Pembayaran Supplier
                      </h2>

                      <span className="rounded-full bg-[#EAF3EF] px-2.5 py-1 text-[8px] font-extrabold tracking-[0.12em] text-[#497F70]">
                        PAYMENT
                      </span>

                    </div>

                    <p className="mt-1 text-[11px] text-gray-400">
                      Pilih invoice outstanding
                      dan masukkan detail pembayaran.
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  disabled={
                    savingPayment
                  }
                  onClick={
                    closePayment
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                >
                  <X size={18} />
                </button>

              </div>

              {/* BODY */}

              <div className="min-h-0 flex-1 overflow-y-auto">

                <div className="space-y-5 p-6">

                  {/* PAYABLE */}

                  <div>

                    <div className="mb-2 flex items-center justify-between">

                      <label className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#58736A]">
                        Invoice / Payable
                      </label>

                      <span className="text-[9px] font-medium text-gray-400">
                        Required
                      </span>

                    </div>

                    <div className="relative">

                      <select
                        value={
                          paymentPayableId
                        }
                        onChange={(e) =>
                          handleSelectPayable(
                            e.target.value
                          )
                        }
                        disabled={
                          savingPayment ||
                          loadingPayables
                        }
                        className="w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3.5 pr-10 text-xs font-semibold text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10 disabled:bg-gray-100"
                      >

                        <option value="">
                          {loadingPayables
                            ? "Memuat invoice..."
                            : payables.length ===
                              0
                            ? "Tidak ada invoice outstanding"
                            : "Pilih invoice / payable"}
                        </option>

                        {payables
                          .filter(
                            (
                              payable
                            ) =>
                              payable.outstanding >
                              0
                          )
                          .map(
                            (
                              payable
                            ) => {

                              const poNumber =
                                payable.purchase?.number ||
                                payable.outletPurchase?.number ||
                                payable.transactionNumber ||
                                "-";

                              const supplier =
                                payable.supplier?.name ||
                                payable.supplierName ||
                                "-";

                              const payableScope =
                                payable.purchaseId ||
                                payable.purchase?.id
                                  ? "PUSAT"
                                  : payable.outletPurchaseId ||
                                    payable.outletPurchase?.id
                                  ? "OUTLET"
                                  : "LAINNYA";

                              return (
                                <option
                                  key={
                                    payable.id
                                  }
                                  value={String(
                                    payable.id
                                  )}
                                >
                                  {payableScope}
                                  {" — "}
                                  {payable.invoiceNumber ||
                                    `PAYABLE-${payable.id}`}
                                  {" — "}
                                  {supplier}
                                  {" — PO "}
                                  {poNumber}
                                  {" — Rp "}
                                  {formatRupiah(
                                    payable.outstanding
                                  )}
                                </option>
                              );
                            }
                          )}

                      </select>

                      <ChevronDown
                        size={17}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">

                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF3EF] px-2.5 py-1 text-[8px] font-extrabold text-[#497F70]">
                        <Landmark size={9} />
                        PUSAT
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[8px] font-extrabold text-blue-700">
                        <Building2 size={9} />
                        OUTLET
                      </span>

                      <span className="text-[9px] text-gray-400">
                        Scope ditentukan dari PO
                      </span>

                    </div>

                  </div>

                  {/* DETAIL */}

                  {selectedPayable && (() => {

                    const selectedScope =
                      selectedPayable.purchaseId ||
                      selectedPayable.purchase?.id
                        ? "PUSAT"
                        : selectedPayable.outletPurchaseId ||
                          selectedPayable.outletPurchase?.id
                        ? "OUTLET"
                        : "LAINNYA";

                    return (
                      <div className="overflow-hidden rounded-2xl border border-[#DCE8E2] bg-gradient-to-br from-[#F4F9F6] via-white to-white">

                        <div className="border-b border-[#E4ECE8] px-5 py-4">

                          <div className="flex items-start justify-between gap-4">

                            <div className="min-w-0">

                              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#82948D]">
                                Detail Hutang
                              </p>

                              <p className="mt-1 truncate text-base font-black tracking-tight text-[#18352D]">
                                {selectedPayable.invoiceNumber ||
                                  `PAYABLE-${selectedPayable.id}`}
                              </p>

                              <div className="mt-2 flex flex-wrap items-center gap-2">

                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] font-extrabold tracking-wide ${
                                    selectedScope ===
                                    "PUSAT"
                                      ? "border-[#C9DED5] bg-[#EAF3EF] text-[#497F70]"
                                      : selectedScope ===
                                        "OUTLET"
                                      ? "border-blue-200 bg-blue-50 text-blue-700"
                                      : "border-slate-200 bg-slate-50 text-slate-500"
                                  }`}
                                >

                                  {selectedScope ===
                                  "PUSAT" ? (
                                    <Landmark
                                      size={9}
                                    />
                                  ) : (
                                    <Building2
                                      size={9}
                                    />
                                  )}

                                  {selectedScope}

                                </span>

                                <span className="text-[9px] text-gray-400">
                                  {selectedScope ===
                                  "PUSAT"
                                    ? "Pembelian Pusat"
                                    : selectedScope ===
                                      "OUTLET"
                                    ? "Pembelian Outlet"
                                    : "Transaksi"}
                                </span>

                              </div>

                            </div>

                            <span
                              className={`shrink-0 rounded-full border px-3 py-1.5 text-[8px] font-extrabold ${getStatusClass(
                                selectedPayable.status
                              )}`}
                            >
                              {getPaymentStatusLabel(
                                selectedPayable.status
                              )}
                            </span>

                          </div>

                        </div>

                        <div className="grid gap-4 p-5 md:grid-cols-2">

                          <div>

                            <p className="text-[9px] font-extrabold uppercase tracking-wide text-gray-400">
                              Supplier
                            </p>

                            <p className="mt-1 text-xs font-extrabold text-gray-700">
                              {selectedPayable.supplier?.name ||
                                selectedPayable.supplierName ||
                                "-"}
                            </p>

                            <p className="mt-1 text-[9px] text-gray-400">
                              {selectedPayable.supplier?.code ||
                                "-"}
                            </p>

                          </div>

                          <div>

                            <p className="text-[9px] font-extrabold uppercase tracking-wide text-gray-400">
                              Purchase Order
                            </p>

                            <p className="mt-1 text-xs font-extrabold text-gray-700">
                              {selectedPayable.purchase?.number ||
                                selectedPayable.outletPurchase?.number ||
                                selectedPayable.transactionNumber ||
                                "-"}
                            </p>

                          </div>

                          {selectedScope ===
                            "OUTLET" && (
                            <div>

                              <p className="text-[9px] font-extrabold uppercase tracking-wide text-gray-400">
                                Outlet
                              </p>

                              <p className="mt-1 text-xs font-extrabold text-gray-700">
                                {selectedPayable.outlet?.name ||
                                  selectedPayable.outletName ||
                                  selectedPayable
                                    .outletPurchase
                                    ?.outlet
                                    ?.name ||
                                  "-"}
                              </p>

                            </div>
                          )}

                          {selectedScope ===
                            "PUSAT" && (
                            <div>

                              <p className="text-[9px] font-extrabold uppercase tracking-wide text-gray-400">
                                Lokasi
                              </p>

                              <div className="mt-1 flex items-center gap-2">

                                <Landmark
                                  size={14}
                                  className="text-[#497F70]"
                                />

                                <span className="text-xs font-extrabold text-[#18352D]">
                                  Gudang / Pusat
                                </span>

                              </div>

                            </div>
                          )}

                          <div>

                            <p className="text-[9px] font-extrabold uppercase tracking-wide text-gray-400">
                              Total Invoice
                            </p>

                            <p className="mt-1 text-xs font-extrabold text-gray-700">
                              Rp{" "}
                              {formatRupiah(
                                selectedPayable.amount
                              )}
                            </p>

                          </div>

                          <div>

                            <p className="text-[9px] font-extrabold uppercase tracking-wide text-gray-400">
                              Sudah Dibayar
                            </p>

                            <p className="mt-1 text-xs font-extrabold text-gray-700">
                              Rp{" "}
                              {formatRupiah(
                                selectedPayable.paidAmount
                              )}
                            </p>

                          </div>

                          <div className="md:col-span-2">

                            <div className="flex items-center justify-between rounded-xl border border-red-100 bg-gradient-to-r from-red-50 to-white px-4 py-3.5">

                              <div>

                                <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-red-500">
                                  Outstanding
                                </p>

                                <p className="mt-0.5 text-[9px] text-red-400">
                                  Saldo yang dapat dibayar
                                </p>

                              </div>

                              <p className="text-lg font-black tracking-tight text-red-600">
                                Rp{" "}
                                {formatRupiah(
                                  selectedPayable.outstanding
                                )}
                              </p>

                            </div>

                          </div>

                        </div>

                      </div>
                    );
                  })()}

                  {/* AMOUNT */}

                  <div>

                    <label className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#58736A]">
                      Nominal Pembayaran
                    </label>

                    <div className="relative">

                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">
                        Rp
                      </span>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={
                          paymentAmount
                        }
                        onChange={(e) => {

                          const raw =
                            e.target.value.replace(
                              /\D/g,
                              ""
                            );

                          setPaymentAmount(
                            raw
                              ? Number(
                                  raw
                                ).toLocaleString(
                                  "id-ID"
                                )
                              : ""
                          );

                        }}
                        placeholder="0"
                        disabled={
                          savingPayment
                        }
                        className="h-14 w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-12 pr-4 text-lg font-black tracking-tight text-[#18352D] outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                      />

                    </div>

                    {selectedPayable && (
                      <div className="mt-2 flex items-center justify-between rounded-xl border border-[#E5ECE9] bg-[#F7FAF8] px-3.5 py-2.5">

                        <span className="text-[10px] font-medium text-gray-500">
                          Maksimal pembayaran
                        </span>

                        <span className="text-xs font-black text-[#18352D]">
                          Rp{" "}
                          {formatRupiah(
                            selectedPayable.outstanding
                          )}
                        </span>

                      </div>
                    )}

                  </div>

                  {/* METHOD */}

                  <div>

                    <label className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#58736A]">
                      Metode Pembayaran
                    </label>

                    <div className="relative">

                      <select
                        value={
                          paymentMethod
                        }
                        onChange={(e) =>
                          setPaymentMethod(
                            e.target.value
                          )
                        }
                        disabled={
                          savingPayment
                        }
                        className="h-12 w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 pr-10 text-xs font-bold text-gray-700 outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                      >

                        <option value="PETTY_CASH">
                          Petty Cash
                        </option>

                        <option value="TRANSFER">
                          Transfer
                        </option>

                        <option value="CASH">
                          Cash
                        </option>

                        <option value="COD">
                          COD
                        </option>

                        <option value="CBD">
                          CBD
                        </option>

                        <option value="TEMPO">
                          Tempo
                        </option>

                      </select>

                      <ChevronDown
                        size={16}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                    </div>

                    {paymentMethod ===
                      "TEMPO" && (
                      <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[10px] font-medium leading-5 text-amber-700">
                        TEMPO digunakan ketika
                        membuat hutang supplier,
                        bukan untuk membayar
                        hutang yang sudah ada.
                      </p>
                    )}

                  </div>

                  {/* DATE */}

                  <div>

                    <label className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#58736A]">
                      Tanggal Pembayaran
                    </label>

                    <div className="relative">

                      <CalendarDays
                        size={15}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        type="date"
                        value={
                          paymentDate
                        }
                        onChange={(e) =>
                          setPaymentDate(
                            e.target.value
                          )
                        }
                        disabled={
                          savingPayment
                        }
                        className="h-12 w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 pl-10 text-xs font-semibold text-gray-700 outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                      />

                    </div>

                  </div>

                  {/* REFERENCE */}

                  <div>

                    <label className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#58736A]">
                      Nomor Referensi
                    </label>

                    <input
                      type="text"
                      value={
                        paymentReference
                      }
                      onChange={(e) =>
                        setPaymentReference(
                          e.target.value
                        )
                      }
                      disabled={
                        savingPayment
                      }
                      placeholder="No. transfer / bukti pembayaran"
                      className="h-12 w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 text-xs font-medium text-gray-700 outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    />

                  </div>

                  {/* REMARKS */}

                  <div>

                    <label className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#58736A]">
                      Keterangan
                    </label>

                    <textarea
                      value={
                        paymentRemarks
                      }
                      onChange={(e) =>
                        setPaymentRemarks(
                          e.target.value
                        )
                      }
                      disabled={
                        savingPayment
                      }
                      rows={3}
                      placeholder="Keterangan pembayaran..."
                      className="w-full resize-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-xs font-medium text-gray-700 outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    />

                  </div>

                </div>

              </div>

              {/* FOOTER */}

              <div className="flex flex-col-reverse gap-2 border-t border-[#E5ECE9] bg-[#FAFCFB] px-6 py-4 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  disabled={
                    savingPayment
                  }
                  onClick={
                    closePayment
                  }
                  className="rounded-xl border border-[#D5E5DC] bg-white px-5 py-3 text-xs font-extrabold text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="button"
                  disabled={
                    savingPayment ||
                    !paymentPayableId ||
                    !paymentAmount ||
                    !paymentMethod ||
                    paymentMethod ===
                      "TEMPO" ||
                    !selectedPayable ||
                    (
                      !selectedPayable.purchaseId &&
                      !selectedPayable.outletPurchaseId &&
                      !selectedPayable.purchase?.id &&
                      !selectedPayable.outletPurchase?.id
                    )
                  }
                  onClick={
                    submitPayment
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#18352D] px-6 py-3 text-xs font-extrabold text-white shadow-lg shadow-[#18352D]/15 transition hover:bg-[#23483E] disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {savingPayment && (
                    <RefreshCw
                      size={15}
                      className="animate-spin"
                    />
                  )}

                  {savingPayment
                    ? "Memproses Pembayaran..."
                    : "Simpan Pembayaran"}

                </button>

              </div>

            </div>

          </div>
        )}

    </div>
  );
}