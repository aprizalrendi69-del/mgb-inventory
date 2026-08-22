"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ArrowDownCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react";

/*
===========================================================
TYPE
===========================================================
*/

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

  /*
  =========================================================
  REFERENSI PO
  =========================================================

  Payment API membutuhkan salah satu:

  purchaseId
  atau
  outletPurchaseId
  =========================================================
  */

  purchaseId?: number | null;

  outletPurchaseId?: number | null;

  purchase?: PurchaseReference | null;

  outletPurchase?: PurchaseReference | null;
};

type Payment = {
  id: number;

  number: string;

  payableId: number;

  accountId: number;

  paymentDate: string;

  amount: number;

  method: PaymentMethod;

  referenceNumber?: string | null;

  remarks?: string | null;

  payable?: Payable | null;

  account?: {
    id: number;
    code: string;
    name: string;
    type: string;
  } | null;
};

type CashAccount = {
  id: number;

  code: string;

  name: string;

  type: string;

  outletId?: number | null;

  currentBalance: number;

  active: boolean;
};

type UserInfo = {
  id: number;

  fullname?: string;

  role: string;

  outletId?: number | null;
};

/*
===========================================================
FORMAT
===========================================================
*/

function formatRupiah(value: number) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

function getStatusClass(status: string) {
  switch (status) {
    case "PAID":
      return "bg-green-100 text-green-700";

    case "PARTIAL":
      return "bg-amber-100 text-amber-700";

    case "UNPAID":
      return "bg-red-100 text-red-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getMethodClass(method: string) {
  switch (method) {
    case "PETTY_CASH":
      return "bg-purple-100 text-purple-700";

    case "TRANSFER":
      return "bg-blue-100 text-blue-700";

    case "CASH":
      return "bg-emerald-100 text-emerald-700";

    case "COD":
      return "bg-orange-100 text-orange-700";

    case "CBD":
      return "bg-cyan-100 text-cyan-700";

    case "TEMPO":
      return "bg-gray-100 text-gray-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

/*
===========================================================
NORMALIZE PAYABLE
===========================================================

PurchasePayable adalah sumber resmi:

- amount
- paidAmount
- outstanding
- status

Selain itu kita pertahankan:

- purchaseId
- outletPurchaseId
- purchase
- outletPurchase

Karena Payment API membutuhkan referensi PO.
===========================================================
*/

function normalizePayable(item: any): Payable | null {
  const id = Number(item?.id);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const amount = Number(item?.amount ?? 0);

  const paidAmount = Number(item?.paidAmount ?? 0);

  const rawOutstanding = Number(item?.outstanding);

  const outstanding = Number.isFinite(rawOutstanding)
    ? Math.max(rawOutstanding, 0)
    : Math.max(amount - paidAmount, 0);

  let status: PayableStatus = item?.status;

  if (!status || typeof status !== "string") {
    if (outstanding <= 0) {
      status = "PAID";
    } else if (paidAmount > 0) {
      status = "PARTIAL";
    } else {
      status = "UNPAID";
    }
  }

  /*
  ---------------------------------------------------------
  PURCHASE ID
  ---------------------------------------------------------
  */

  const rawPurchaseId =
    item?.purchaseId ??
    item?.purchase?.id ??
    null;

  const purchaseId =
    rawPurchaseId !== null &&
    rawPurchaseId !== undefined &&
    Number.isInteger(Number(rawPurchaseId)) &&
    Number(rawPurchaseId) > 0
      ? Number(rawPurchaseId)
      : null;

  /*
  ---------------------------------------------------------
  OUTLET PURCHASE ID
  ---------------------------------------------------------
  */

  const rawOutletPurchaseId =
    item?.outletPurchaseId ??
    item?.outletPurchase?.id ??
    null;

  const outletPurchaseId =
    rawOutletPurchaseId !== null &&
    rawOutletPurchaseId !== undefined &&
    Number.isInteger(Number(rawOutletPurchaseId)) &&
    Number(rawOutletPurchaseId) > 0
      ? Number(rawOutletPurchaseId)
      : null;

  return {
    id,

    invoiceNumber:
      item?.invoiceNumber ??
      item?.invoiceNo ??
      item?.invoice ??
      null,

    invoiceDate:
      item?.invoiceDate ??
      null,

    dueDate:
      item?.dueDate ??
      null,

    amount,

    paidAmount,

    outstanding,

    status,

    supplier:
      item?.supplier ??
      null,

    outlet:
      item?.outlet ??
      null,

    purchaseId,

    outletPurchaseId,

    purchase:
      item?.purchase ??
      null,

    outletPurchase:
      item?.outletPurchase ??
      null,
  };
}

/*
===========================================================
PAGE
===========================================================
*/

export default function PaymentPage() {
  /*
  =========================================================
  USER
  =========================================================
  */

  const [user, setUser] =
    useState<UserInfo | null>(null);

  const [loadingUser, setLoadingUser] =
    useState(true);

  /*
  =========================================================
  PAYMENT
  =========================================================
  */

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [loading, setLoading] =
    useState(true);

  /*
  =========================================================
  PAYABLE
  =========================================================
  */

  const [payables, setPayables] =
    useState<Payable[]>([]);

  const [loadingPayables, setLoadingPayables] =
    useState(false);

  /*
  =========================================================
  CASH ACCOUNT
  =========================================================
  */

  const [accounts, setAccounts] =
    useState<CashAccount[]>([]);

  /*
  =========================================================
  FILTER
  =========================================================
  */

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [methodFilter, setMethodFilter] =
    useState("ALL");

  const [tanggalMulai, setTanggalMulai] =
    useState("");

  const [tanggalSelesai, setTanggalSelesai] =
    useState("");

  /*
  =========================================================
  PAYMENT MODAL
  =========================================================
  */

  const [showPayment, setShowPayment] =
    useState(false);

  const [savingPayment, setSavingPayment] =
    useState(false);

  /*
  =========================================================
  SELECTED PAYABLE
  =========================================================
  */

  const [selectedPayable, setSelectedPayable] =
    useState<Payable | null>(null);

  const [paymentPayableId, setPaymentPayableId] =
    useState("");

  const [paymentAccountId, setPaymentAccountId] =
    useState("");

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("PETTY_CASH");

  const [paymentDate, setPaymentDate] =
    useState("");

  const [paymentReference, setPaymentReference] =
    useState("");

  const [paymentRemarks, setPaymentRemarks] =
    useState("");

  /*
  =========================================================
  USER
  =========================================================
  */

  async function loadUser() {
    try {
      setLoadingUser(true);

      const res = await fetch("/api/me", {
        cache: "no-store",
      });

      const json = await res.json();

      const currentUser =
        json?.user ??
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

  /*
  =========================================================
  PAYMENT
  =========================================================
  */

  async function loadPayments() {
    try {
      setLoading(true);

      const res = await fetch("/api/payment", {
        cache: "no-store",
      });

      const json = await res.json();

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
        Array.isArray(paymentData)
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

  /*
  =========================================================
  PURCHASE PAYABLE
  =========================================================
  */

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
        Array.isArray(payableData)
          ? payableData
              .map(
                normalizePayable
              )
              .filter(
                (
                  item
                ): item is Payable =>
                  item !== null
              )
              .filter(
                (item) =>
                  Number(
                    item.outstanding
                  ) > 0
              )
          : [];

      setPayables(
        normalized
      );
    } catch (error) {
      console.error(
        "LOAD PAYABLE ERROR:",
        error
      );

      setPayables([]);
    } finally {
      setLoadingPayables(false);
    }
  }

  /*
  =========================================================
  CASH ACCOUNT
  =========================================================
  */

  async function loadAccounts() {
    try {
      const res = await fetch(
        "/api/petty-cash",
        {
          cache: "no-store",
        }
      );

      const json =
        await res.json();

      if (!res.ok) {
        throw new Error(
          json?.message ||
            json?.error ||
            "Gagal mengambil akun kas."
        );
      }

      const payload =
        json?.data ??
        json;

      const accountData =
        Array.isArray(payload)
          ? payload
          : payload?.accounts ??
            payload?.cashAccounts ??
            [];

      setAccounts(
        Array.isArray(
          accountData
        )
          ? accountData
          : []
      );
    } catch (error) {
      console.error(
        "LOAD CASH ACCOUNT ERROR:",
        error
      );

      setAccounts([]);
    }
  }

  /*
  =========================================================
  INITIAL LOAD
  =========================================================
  */

  useEffect(() => {
    void loadUser();
    void loadPayments();
    void loadPayables();
    void loadAccounts();
  }, []);

  /*
  =========================================================
  ROLE
  =========================================================
  */

  const role =
    String(
      user?.role || ""
    ).toUpperCase();

  const canPay =
    role === "ADMIN" ||
    role === "MANAGER" ||
    role === "PURCHASING" ||
    role === "OUTLET_ADMIN" ||
    role === "ADMIN_OUTLET";

  /*
  =========================================================
  FILTER PAYMENT
  =========================================================
  */

  const filteredPayments =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return payments.filter(
        (payment) => {
          const payable =
            payment.payable;

          if (
            statusFilter !==
              "ALL" &&
            payable?.status !==
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

          return (
            payment.number
              ?.toLowerCase()
              .includes(keyword) ||

            payment.referenceNumber
              ?.toLowerCase()
              .includes(keyword) ||

            payment.remarks
              ?.toLowerCase()
              .includes(keyword) ||

            payable?.invoiceNumber
              ?.toLowerCase()
              .includes(keyword) ||

            payable?.supplier?.name
              ?.toLowerCase()
              .includes(keyword) ||

            payable?.supplier?.code
              ?.toLowerCase()
              .includes(keyword) ||

            payable?.purchase?.number
              ?.toLowerCase()
              .includes(keyword) ||

            payable?.outletPurchase?.number
              ?.toLowerCase()
              .includes(keyword)
          );
        }
      );
    }, [
      payments,
      search,
      statusFilter,
      methodFilter,
      tanggalMulai,
      tanggalSelesai,
    ]);

  /*
  =========================================================
  SUMMARY
  =========================================================
  */

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
        payments.filter(
          (payment) =>
            payment.payable
              ?.status ===
            "PAID"
        ).length,
      [payments]
    );

  const totalPartialInvoice =
    useMemo(
      () =>
        payments.filter(
          (payment) =>
            payment.payable
              ?.status ===
            "PARTIAL"
        ).length,
      [payments]
    );

  const totalOutstanding =
    useMemo(
      () =>
        payables.reduce(
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

  /*
  =========================================================
  RESET FILTER
  =========================================================
  */

  function resetFilter() {
    setSearch("");
    setStatusFilter("ALL");
    setMethodFilter("ALL");
    setTanggalMulai("");
    setTanggalSelesai("");
  }

  /*
  =========================================================
  RESET PAYMENT FORM
  =========================================================
  */

  function resetPaymentForm() {
    setSelectedPayable(null);
    setPaymentPayableId("");
    setPaymentAccountId("");
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

  /*
  =========================================================
  OPEN NEW PAYMENT
  =========================================================
  */

  async function openPayment(
    payableId?: number
  ) {
    resetPaymentForm();

    setShowPayment(true);

    await loadPayables();

    if (
      payableId &&
      payableId > 0
    ) {
      try {
        const res =
          await fetch(
            "/api/purchase-payable",
            {
              cache: "no-store",
            }
          );

        if (
          res.ok &&
          (
            res.headers
              .get(
                "content-type"
              ) || ""
          ).includes(
            "application/json"
          )
        ) {
          const json =
            await res.json();

          const payload =
            json?.data ??
            json?.payables ??
            json;

          const payableData =
            Array.isArray(
              payload
            )
              ? payload
              : payload?.payables ??
                payload?.data ??
                [];

          const normalized =
            Array.isArray(
              payableData
            )
              ? payableData
                  .map(
                    normalizePayable
                  )
                  .filter(
                    (
                      item
                    ): item is Payable =>
                      item !== null
                  )
                  .filter(
                    (item) =>
                      item.outstanding >
                      0
                  )
              : [];

          const selected =
            normalized.find(
              (item) =>
                item.id ===
                payableId
            );

          if (selected) {
            setPayables(
              normalized
            );

            setSelectedPayable(
              selected
            );

            setPaymentPayableId(
              String(
                selected.id
              )
            );

            setPaymentAmount(
              Number(
                selected.outstanding
              ).toLocaleString(
                "id-ID"
              )
            );
          }
        }
      } catch (error) {
        console.error(
          "SELECT PAYABLE AFTER REFRESH ERROR:",
          error
        );
      }
    }
  }

  /*
  =========================================================
  SELECT PAYABLE
  =========================================================
  */

  function handleSelectPayable(
    payableId: string
  ) {
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
          payableId
      );

    if (!payable) {
      return;
    }

    setSelectedPayable(
      payable
    );

    setPaymentPayableId(
      String(payable.id)
    );

    setPaymentAmount(
      Number(
        payable.outstanding || 0
      ).toLocaleString(
        "id-ID"
      )
    );
  }

  /*
  =========================================================
  GET PO REFERENCE
  =========================================================

  Payment API wajib menerima:

  purchaseId
  ATAU
  outletPurchaseId

  Prioritas:

  1. purchaseId langsung
  2. purchase.id
  3. outletPurchaseId langsung
  4. outletPurchase.id
  =========================================================
  */

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

  /*
  =========================================================
  SUBMIT PAYMENT
  =========================================================
  */

  async function submitPayment() {
    const payableId =
      Number(
        paymentPayableId
      );

    const accountId =
      Number(
        paymentAccountId
      );

    const amount =
      Number(
        paymentAmount
          .replace(/\./g, "")
          .replace(/,/g, "")
      );

    /*
    -------------------------------------------------------
    PAYABLE
    -------------------------------------------------------
    */

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
        payable.outstanding || 0
      );

    if (
      outstanding <= 0
    ) {
      alert(
        "Invoice tersebut sudah lunas."
      );

      return;
    }

    /*
    -------------------------------------------------------
    PO REFERENCE
    -------------------------------------------------------

    INI BAGIAN UTAMA PERBAIKAN.

    API /api/payment membutuhkan PO pusat
    atau PO outlet.
    */

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
      console.error(
        "PAYABLE TANPA REFERENSI PO:",
        payable
      );

      alert(
        "Invoice ini tidak memiliki referensi PO pusat atau PO outlet. Silakan periksa data PurchasePayable."
      );

      return;
    }

    /*
    -------------------------------------------------------
    ACCOUNT
    -------------------------------------------------------
    */

    if (
      !Number.isInteger(
        accountId
      ) ||
      accountId <= 0
    ) {
      alert(
        "Pilih akun pembayaran."
      );

      return;
    }

    /*
    -------------------------------------------------------
    AMOUNT
    -------------------------------------------------------
    */

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

    if (
      amount >
      outstanding
    ) {
      alert(
        `Nominal pembayaran tidak boleh melebihi outstanding Rp ${formatRupiah(
          outstanding
        )}.`
      );

      return;
    }

    /*
    -------------------------------------------------------
    METHOD
    -------------------------------------------------------
    */

    if (!paymentMethod) {
      alert(
        "Pilih metode pembayaran."
      );

      return;
    }

    try {
      setSavingPayment(
        true
      );

      /*
      -----------------------------------------------------
      BODY PAYMENT
      -----------------------------------------------------

      Sekarang bukan hanya payableId.

      Kita kirim juga:

      purchaseId
      outletPurchaseId

      sehingga API bisa menghubungkan Payment
      langsung ke PO yang benar.
      */

      const paymentBody: Record<
        string,
        unknown
      > = {
        payableId,

        accountId,

        amount,

        method:
          paymentMethod,

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

      console.log(
        "SUBMIT PAYMENT BODY:",
        paymentBody
      );

      const res =
        await fetch(
          "/api/payment",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
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
        json?.success === false
      ) {
        throw new Error(
          json?.message ||
            json?.error ||
            "Gagal menyimpan pembayaran."
        );
      }

      /*
      -------------------------------------------------------
      CLOSE MODAL
      -------------------------------------------------------
      */

      setShowPayment(
        false
      );

      resetPaymentForm();

      /*
      -------------------------------------------------------
      REFRESH DATA
      -------------------------------------------------------
      */

      await Promise.all([
        loadPayments(),
        loadPayables(),
        loadAccounts(),
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

  /*
  =========================================================
  RENDER
  =========================================================
  */

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <CreditCard size={23} />
          </div>

          <div>

            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Pembayaran
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Kelola pembayaran hutang supplier dan transaksi kas
            </p>

          </div>

        </div>

        <div className="flex flex-wrap gap-2">

          <button
            type="button"
            onClick={() => {
              void loadPayments();
              void loadPayables();
              void loadAccounts();
            }}
            disabled={
              loading ||
              loadingPayables
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-50"
          >

            <RefreshCw
              size={17}
              className={
                loading ||
                loadingPayables
                  ? "animate-spin"
                  : ""
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
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3D6D60]"
            >

              <Plus size={17} />

              Pembayaran

            </button>
          )}

        </div>

      </div>

      {/* =================================================
          SUMMARY
      ================================================= */}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">

        {/* TOTAL PAYMENT */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-start justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Total Pembayaran
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                Rp{" "}
                {formatRupiah(
                  totalPayment
                )}
              </p>

            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Wallet size={21} />
            </div>

          </div>

          <p className="mt-3 text-xs text-gray-400">
            Seluruh transaksi pembayaran
          </p>

        </div>

        {/* TRANSACTION */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-start justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Transaksi
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {totalTransaction}
              </p>

            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EDF1F8] text-[#526A91]">
              <FileText size={21} />
            </div>

          </div>

          <p className="mt-3 text-xs text-gray-400">
            Jumlah transaksi pembayaran
          </p>

        </div>

        {/* PAID */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-start justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Invoice Lunas
              </p>

              <p className="mt-2 text-2xl font-bold text-green-700">
                {totalPaidInvoice}
              </p>

            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <CheckCircle2 size={21} />
            </div>

          </div>

          <p className="mt-3 text-xs text-gray-400">
            Invoice dengan status PAID
          </p>

        </div>

        {/* PARTIAL */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-start justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Pembayaran Sebagian
              </p>

              <p className="mt-2 text-2xl font-bold text-amber-600">
                {totalPartialInvoice}
              </p>

            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock3 size={21} />
            </div>

          </div>

          <p className="mt-3 text-xs text-gray-400">
            Invoice dengan status PARTIAL
          </p>

        </div>

        {/* OUTSTANDING */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-start justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Hutang Outstanding
              </p>

              <p className="mt-2 text-2xl font-bold text-red-600">
                Rp{" "}
                {formatRupiah(
                  totalOutstanding
                )}
              </p>

            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <CreditCard size={21} />
            </div>

          </div>

          <p className="mt-3 text-xs text-gray-400">
            Payable yang belum lunas
          </p>

        </div>

      </div>

      {/* =================================================
          MAIN
      ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        {/* FILTER */}

        <div className="border-b border-[#E5ECE9] p-5">

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">

            {/* SEARCH */}

            <div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Pencarian
              </label>

              <div className="relative">

                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Cari pembayaran..."
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                />

              </div>

            </div>

            {/* STATUS */}

            <div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
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
                  className="w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 pr-10 text-sm text-gray-700 outline-none focus:border-[#497F70]"
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
                  size={17}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

              </div>

            </div>

            {/* METHOD */}

            <div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
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
                  className="w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 pr-10 text-sm text-gray-700 outline-none focus:border-[#497F70]"
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
                  size={17}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

              </div>

            </div>

            {/* START */}

            <div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Tanggal Mulai
              </label>

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
                className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm text-gray-700 outline-none focus:border-[#497F70]"
              />

            </div>

            {/* END */}

            <div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Tanggal Selesai
              </label>

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
                className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm text-gray-700 outline-none focus:border-[#497F70]"
              />

            </div>

          </div>

          <div className="mt-4 flex items-center justify-between">

            <div className="text-xs text-gray-500">

              Menampilkan{" "}

              <span className="font-semibold text-[#497F70]">
                {filteredPayments.length}
              </span>{" "}

              pembayaran

            </div>

            {(search ||
              statusFilter !==
                "ALL" ||
              methodFilter !==
                "ALL" ||
              tanggalMulai ||
              tanggalSelesai) && (

              <button
                type="button"
                onClick={
                  resetFilter
                }
                className="rounded-lg border border-[#D5E5DC] bg-white px-3 py-2 text-xs font-semibold text-[#497F70] hover:bg-[#F5F8F6]"
              >
                Reset Filter
              </button>

            )}

          </div>

        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="overflow-x-auto">

          <table className="min-w-[1450px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Pembayaran
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Invoice
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Supplier
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Tanggal
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Metode
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Akun
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Dibayar
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Outstanding
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Status
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Aksi
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ||
              loadingUser ? (

                <tr>

                  <td
                    colSpan={11}
                    className="px-5 py-14 text-center"
                  >

                    <div className="flex items-center justify-center gap-2 text-gray-500">

                      <RefreshCw
                        size={18}
                        className="animate-spin text-[#497F70]"
                      />

                      Memuat pembayaran...

                    </div>

                  </td>

                </tr>

              ) : filteredPayments.length ===
                0 ? (

                <tr>

                  <td
                    colSpan={11}
                    className="px-5 py-14 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF3EF] text-[#497F70]">
                        <CreditCard size={25} />
                      </div>

                      <p className="font-semibold text-gray-700">
                        Belum ada pembayaran
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        Belum terdapat transaksi pembayaran.
                      </p>

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

                    return (

                      <tr
                        key={
                          payment.id
                        }
                        className="border-b border-[#EDF2EF] hover:bg-[#FAFCFB]"
                      >

                        <td className="px-5 py-4 text-gray-500">
                          {index + 1}
                        </td>

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {
                              payment.number
                            }
                          </div>

                          {payment.referenceNumber && (

                            <div className="mt-1 text-xs text-gray-400">
                              Ref:{" "}
                              {
                                payment.referenceNumber
                              }
                            </div>

                          )}

                        </td>

                        <td className="px-5 py-4">

                          <div className="font-semibold text-gray-700">
                            {
                              payable?.invoiceNumber ||
                              "-"
                            }
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            PO:{" "}
                            {
                              payable
                                ?.purchase
                                ?.number ||
                              payable
                                ?.outletPurchase
                                ?.number ||
                              "-"
                            }
                          </div>

                        </td>

                        <td className="px-5 py-4">

                          <div className="font-medium text-gray-700">
                            {
                              payable
                                ?.supplier
                                ?.name ||
                              "-"
                            }
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {
                              payable
                                ?.supplier
                                ?.code ||
                              "-"
                            }
                          </div>

                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {formatDateTime(
                            payment.paymentDate
                          )}
                        </td>

                        <td className="px-5 py-4">

                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getMethodClass(
                              payment.method
                            )}`}
                          >
                            {
                              getPaymentMethodLabel(
                                payment.method
                              )
                            }
                          </span>

                        </td>

                        <td className="px-5 py-4">

                          <div className="font-medium text-gray-700">
                            {
                              payment.account
                                ?.name ||
                              accounts.find(
                                (
                                  account
                                ) =>
                                  account.id ===
                                  payment.accountId
                              )?.name ||
                              "-"
                            }
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {
                              payment.account
                                ?.code ||
                              accounts.find(
                                (
                                  account
                                ) =>
                                  account.id ===
                                  payment.accountId
                              )?.code ||
                              "-"
                            }
                          </div>

                        </td>

                        <td className="px-5 py-4 text-right font-bold text-red-600">
                          Rp{" "}
                          {formatRupiah(
                            payment.amount
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-gray-700">
                          Rp{" "}
                          {formatRupiah(
                            outstanding
                          )}
                        </td>

                        <td className="px-5 py-4 text-center">

                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                              payable?.status ||
                                "UNPAID"
                            )}`}
                          >
                            {
                              getPaymentStatusLabel(
                                payable?.status ||
                                  "UNPAID"
                              )
                            }
                          </span>

                        </td>

                        <td className="px-5 py-4 text-center">

                          {outstanding >
                            0 &&
                          canPay ? (

                            <button
                              type="button"
                              onClick={() => {
                                void openPayment(
                                  payment.payableId
                                );
                              }}
                              className="inline-flex items-center gap-2 rounded-lg bg-[#497F70] px-3 py-2 text-xs font-semibold text-white hover:bg-[#3D6D60]"
                            >

                              <ArrowDownCircle
                                size={15}
                              />

                              Bayar Lagi

                            </button>

                          ) : (

                            <span className="text-xs font-semibold text-green-600">
                              Lunas
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

      </div>

      {/* =================================================
          PAYMENT MODAL
      ================================================= */}

      {showPayment && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            {/* HEADER */}

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E5ECE9] bg-white px-6 py-5">

              <div>

                <h2 className="text-lg font-bold text-[#18352D]">
                  Pembayaran Supplier
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Pilih invoice/payable yang masih memiliki outstanding
                </p>

              </div>

              <button
                type="button"
                disabled={
                  savingPayment
                }
                onClick={() =>
                  setShowPayment(
                    false
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>

            </div>

            {/* FORM */}

            <div className="space-y-4 p-6">

              {/* INVOICE */}

              <div>

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                  Invoice / Payable
                </label>

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
                    className="w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 pr-10 text-sm text-gray-700 outline-none focus:border-[#497F70] disabled:bg-gray-100"
                  >

                    <option value="">
                      {loadingPayables
                        ? "Memuat invoice..."
                        : payables.length ===
                          0
                        ? "Tidak ada invoice outstanding"
                        : "Pilih invoice / payable"}
                    </option>

                    {payables.map(
                      (
                        payable
                      ) => {

                        const poNumber =
                          payable
                            .purchase
                            ?.number ||
                          payable
                            .outletPurchase
                            ?.number ||
                          "-";

                        const supplier =
                          payable
                            .supplier
                            ?.name ||
                          "-";

                        return (

                          <option
                            key={
                              payable.id
                            }
                            value={String(
                              payable.id
                            )}
                          >

                            {payable.invoiceNumber ||
                              `PAYABLE-${payable.id}`}
                            {" — "}
                            {supplier}
                            {" — "}
                            PO {poNumber}
                            {" — "}
                            Rp{" "}
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

              </div>

              {/* SELECTED PAYABLE */}

              {selectedPayable && (

                <div className="rounded-xl border border-[#DDE9E4] bg-[#F5F8F6] p-4">

                  <div className="mb-3 flex items-center justify-between">

                    <div>

                      <p className="text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                        Detail Hutang
                      </p>

                      <p className="mt-1 text-sm font-bold text-[#18352D]">
                        {
                          selectedPayable.invoiceNumber ||
                          `PAYABLE-${selectedPayable.id}`
                        }
                      </p>

                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                        selectedPayable.status
                      )}`}
                    >
                      {
                        getPaymentStatusLabel(
                          selectedPayable.status
                        )
                      }
                    </span>

                  </div>

                  <div className="grid gap-3 md:grid-cols-2">

                    <div>

                      <p className="text-xs text-gray-400">
                        Supplier
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-700">
                        {
                          selectedPayable
                            .supplier
                            ?.name ||
                          "-"
                        }
                      </p>

                      <p className="text-xs text-gray-400">
                        {
                          selectedPayable
                            .supplier
                            ?.code ||
                          "-"
                        }
                      </p>

                    </div>

                    <div>

                      <p className="text-xs text-gray-400">
                        Purchase Order
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-700">
                        {
                          selectedPayable
                            .purchase
                            ?.number ||
                          selectedPayable
                            .outletPurchase
                            ?.number ||
                          "-"
                        }
                      </p>

                      {selectedPayable
                        .purchaseId ? (

                        <p className="mt-1 text-[11px] text-gray-400">
                          PO Pusat ID:{" "}
                          {
                            selectedPayable
                              .purchaseId
                          }
                        </p>

                      ) : selectedPayable
                        .outletPurchaseId ? (

                        <p className="mt-1 text-[11px] text-gray-400">
                          PO Outlet ID:{" "}
                          {
                            selectedPayable
                              .outletPurchaseId
                          }
                        </p>

                      ) : null}

                    </div>

                    <div>

                      <p className="text-xs text-gray-400">
                        Total Invoice
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-700">
                        Rp{" "}
                        {formatRupiah(
                          selectedPayable.amount
                        )}
                      </p>

                    </div>

                    <div>

                      <p className="text-xs text-gray-400">
                        Sudah Dibayar
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-700">
                        Rp{" "}
                        {formatRupiah(
                          selectedPayable.paidAmount
                        )}
                      </p>

                    </div>

                    <div className="md:col-span-2">

                      <div className="flex items-center justify-between rounded-lg bg-white px-3 py-3">

                        <span className="text-xs font-semibold text-gray-500">
                          Outstanding
                        </span>

                        <span className="text-lg font-bold text-red-600">
                          Rp{" "}
                          {formatRupiah(
                            selectedPayable.outstanding
                          )}
                        </span>

                      </div>

                    </div>

                  </div>

                </div>

              )}

              {/* ACCOUNT */}

              <div>

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                  Akun Pembayaran
                </label>

                <div className="relative">

                  <select
                    value={
                      paymentAccountId
                    }
                    onChange={(e) =>
                      setPaymentAccountId(
                        e.target.value
                      )
                    }
                    disabled={
                      savingPayment
                    }
                    className="w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 pr-10 text-sm text-gray-700 outline-none focus:border-[#497F70]"
                  >

                    <option value="">
                      Pilih akun
                    </option>

                    {accounts
                      .filter(
                        (
                          account
                        ) =>
                          account.active
                      )
                      .map(
                        (
                          account
                        ) => (

                          <option
                            key={
                              account.id
                            }
                            value={String(
                              account.id
                            )}
                          >

                            {account.code}
                            {" - "}
                            {account.name}
                            {" "}
                            (Rp{" "}
                            {formatRupiah(
                              account.currentBalance
                            )}
                            )

                          </option>

                        )
                      )}

                  </select>

                  <ChevronDown
                    size={17}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                </div>

                {accounts.filter(
                  (account) =>
                    account.active
                ).length ===
                  0 && (

                  <p className="mt-2 text-xs text-red-500">
                    Tidak ada akun pembayaran yang aktif.
                  </p>

                )}

              </div>

              {/* AMOUNT */}

              <div>

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                  Nominal Pembayaran
                </label>

                <div className="relative">

                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">
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
                    className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-12 pr-4 text-sm font-semibold text-gray-700 outline-none focus:border-[#497F70]"
                  />

                </div>

                {selectedPayable && (

                  <div className="mt-2 flex items-center justify-between rounded-lg bg-[#F5F8F6] px-3 py-2 text-xs">

                    <span className="text-gray-500">
                      Maksimal pembayaran
                    </span>

                    <span className="font-bold text-[#18352D]">
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

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
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
                    className="w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 pr-10 text-sm text-gray-700 outline-none focus:border-[#497F70]"
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
                    size={17}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                </div>

              </div>

              {/* DATE */}

              <div>

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                  Tanggal Pembayaran
                </label>

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
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm text-gray-700 outline-none focus:border-[#497F70]"
                />

              </div>

              {/* REFERENCE */}

              <div>

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
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
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm text-gray-700 outline-none focus:border-[#497F70]"
                />

              </div>

              {/* REMARKS */}

              <div>

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
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
                  className="w-full resize-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm text-gray-700 outline-none focus:border-[#497F70]"
                />

              </div>

            </div>

            {/* FOOTER */}

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[#E5ECE9] bg-[#FAFCFB] px-6 py-4">

              <button
                type="button"
                disabled={
                  savingPayment
                }
                onClick={() =>
                  setShowPayment(
                    false
                  )
                }
                className="rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={
                  savingPayment ||
                  !paymentPayableId ||
                  !paymentAccountId ||
                  !paymentAmount ||
                  !paymentMethod ||
                  !selectedPayable ||
                  (!selectedPayable.purchaseId &&
                    !selectedPayable.outletPurchaseId &&
                    !selectedPayable.purchase?.id &&
                    !selectedPayable.outletPurchase?.id)
                }
                onClick={
                  submitPayment
                }
                className="inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-5 py-3 text-sm font-semibold text-white hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-50"
              >

                {savingPayment && (

                  <RefreshCw
                    size={16}
                    className="animate-spin"
                  />

                )}

                {savingPayment
                  ? "Memproses..."
                  : "Simpan Pembayaran"}

              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}