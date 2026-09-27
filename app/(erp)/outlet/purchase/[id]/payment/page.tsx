"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

// =====================================================
// TYPES
// =====================================================

type PurchaseItem = {
  id: number;
  qty: number;
  price: number;
  subtotal: number;

  barang?: {
    id: number;
    code?: string | null;
    name: string;
    unit?: string | null;
  } | null;
};

type PurchasePayable = {
  id?: number;
  amount?: number | string | null;
  totalAmount?: number | string | null;
  paidAmount?: number | string | null;
  paid?: number | string | null;
  outstanding?: number | string | null;
  remaining?: number | string | null;
  status?: string | null;
  dueDate?: string | null;
};

type Purchase = {
  id: number;
  number: string;

  outletId: number;
  supplierId: number;

  status: string;
  total: number;

  paymentMethod?: string | null;

  remarks?: string | null;

  outlet?: {
    id: number;
    code?: string | null;
    name: string;
  } | null;

  supplier?: {
    id: number;
    name: string;
  } | null;

  items: PurchaseItem[];

  purchasePayable?: PurchasePayable | null;
  payable?: PurchasePayable | null;
  PurchasePayable?: PurchasePayable | null;

  paymentStatus?: string | null;
  paidAmount?: number | string | null;
  outstanding?: number | string | null;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  data?: Purchase;
};

type PaymentResponse = {
  success: boolean;
  message?: string;
  data?: any;
};

type CurrentUser = {
  id?: number | string;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  outletId?: number | null;
};

// =====================================================
// PAYMENT METHODS
// =====================================================
//
// TEMPO = sumber hutang.
// Saat pelunasan, metode aktual:
// CASH / COD / CBD / TRANSFER.
//
// CASH / COD / CBD:
// -> mengurangi Petty Cash sesuai business rule.
//
// TRANSFER:
// -> tidak mengurangi Petty Cash.
// -> tidak membuat hutang baru.
// =====================================================

const PAYMENT_METHODS = [
  {
    value: "CASH",
    label: "Cash",
    description: "Pelunasan tunai melalui Petty Cash Outlet.",
    pettyCash: true,
    icon: "cash",
  },
  {
    value: "COD",
    label: "COD",
    description: "Pelunasan melalui Cash On Delivery.",
    pettyCash: true,
    icon: "cod",
  },
  {
    value: "CBD",
    label: "CBD",
    description: "Pelunasan melalui Cash Before Delivery.",
    pettyCash: true,
    icon: "cbd",
  },
  {
    value: "TRANSFER",
    label: "Transfer",
    description: "Pelunasan melalui transfer bank.",
    pettyCash: false,
    icon: "transfer",
  },
];

// =====================================================
// HELPERS
// =====================================================

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: Date) {
  return value.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getLocalDateInputValue() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeStatus(
  value?: string | null
) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeRole(
  value?: string | null
) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function getApiUser(json: any): CurrentUser | null {
  if (!json) {
    return null;
  }

  const candidates = [
    json.user,
    json.data?.user,
    json.data,
    json.currentUser,
    json.me,
  ];

  for (const candidate of candidates) {
    if (
      candidate &&
      typeof candidate === "object"
    ) {
      return candidate as CurrentUser;
    }
  }

  return null;
}

function getApiRole(json: any) {
  const user = getApiUser(json);

  return normalizeRole(
    user?.role ??
      json?.role ??
      json?.data?.role
  );
}

// =====================================================
// INLINE ICONS
// =====================================================

function IconArrowLeft() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 20 6v5c0 5.25-3.4 8.6-8 10-4.6-1.4-8-4.75-8-10V6l8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6h16v14H4z" />
      <path d="M4 6V4h13" />
      <path d="M16 13h4" />
      <circle
        cx="16"
        cy="13"
        r="1"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M16 9h2a2 2 0 0 1 2 2v10" />
      <path d="M8 7h4" />
      <path d="M8 11h4" />
      <path d="M8 15h4" />
      <path d="M8 19h4" />
      <path d="M3 21h18" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="17"
        rx="2"
      />
      <path d="M16 2v4M8 2v4M3 9h18" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

function IconCreditCard() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="2"
        y="5"
        width="20"
        height="14"
        rx="2"
      />
      <path d="M2 10h20" />
      <path d="M6 15h3" />
    </svg>
  );
}

// =====================================================
// PAGE
// =====================================================

export default function OutletPurchasePaymentPage() {
  const params = useParams();
  const router = useRouter();

  const id = String(params?.id || "");

  // ===================================================
  // STATE
  // ===================================================

  const [purchase, setPurchase] =
    useState<Purchase | null>(null);

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [checkingAccess, setCheckingAccess] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [method, setMethod] =
    useState("CASH");

  const [referenceNumber, setReferenceNumber] =
    useState("");

  const [remarks, setRemarks] =
    useState("");

  const [paymentDate, setPaymentDate] =
    useState(
      getLocalDateInputValue()
    );

  // ===================================================
  // ACCESS CONTROL
  // ===================================================

  const userRole = useMemo(() => {
    return normalizeRole(
      currentUser?.role
    );
  }, [currentUser]);

  const isAdmin =
    userRole === "ADMIN";

  // ===================================================
  // PAYABLE HELPERS
  // ===================================================

  const payable = useMemo(() => {
    if (!purchase) {
      return null;
    }

    return (
      purchase.purchasePayable ??
      purchase.payable ??
      purchase.PurchasePayable ??
      null
    );
  }, [purchase]);

  const purchasePaymentMethod = useMemo(() => {
    return normalizeStatus(
      purchase?.paymentMethod
    );
  }, [purchase]);

  const isTempoPurchase = useMemo(() => {
    return (
      purchasePaymentMethod ===
      "TEMPO"
    );
  }, [purchasePaymentMethod]);

  // ---------------------------------------------------
  // PAYMENT NOW ONLY AFTER RECEIVED
  // ---------------------------------------------------

  const isReceivedPurchase = useMemo(() => {
    return (
      normalizeStatus(
        purchase?.status
      ) === "RECEIVED"
    );
  }, [purchase]);

  const payableTotal = useMemo(() => {
    if (!purchase) {
      return 0;
    }

    const value = Number(
      payable?.amount ??
        payable?.totalAmount ??
        purchase.total ??
        0
    );

    return Number.isFinite(value)
      ? Math.max(value, 0)
      : 0;
  }, [purchase, payable]);

  const payablePaidAmount = useMemo(() => {
    if (!purchase) {
      return 0;
    }

    const value = Number(
      payable?.paidAmount ??
        payable?.paid ??
        purchase.paidAmount ??
        0
    );

    return Number.isFinite(value)
      ? Math.max(value, 0)
      : 0;
  }, [purchase, payable]);

  const payableOutstanding = useMemo(() => {
    if (!purchase) {
      return 0;
    }

    const explicitOutstanding =
      payable?.outstanding ??
      payable?.remaining ??
      purchase.outstanding;

    if (
      explicitOutstanding !==
        undefined &&
      explicitOutstanding !== null &&
      explicitOutstanding !== ""
    ) {
      const value = Number(
        explicitOutstanding
      );

      if (Number.isFinite(value)) {
        return Math.max(value, 0);
      }
    }

    return Math.max(
      payableTotal -
        payablePaidAmount,
      0
    );
  }, [
    purchase,
    payable,
    payableTotal,
    payablePaidAmount,
  ]);

  const payableStatus = useMemo(() => {
    return normalizeStatus(
      payable?.status ??
        purchase?.paymentStatus
    );
  }, [payable, purchase]);

  const isTempoPaid = useMemo(() => {
    if (!isTempoPurchase) {
      return false;
    }

    return (
      payableStatus === "PAID" ||
      payableStatus === "LUNAS" ||
      payableStatus === "SETTLED" ||
      payableStatus === "COMPLETED" ||
      payableOutstanding <= 0.01
    );
  }, [
    isTempoPurchase,
    payableStatus,
    payableOutstanding,
  ]);

  // ===================================================
  // LOAD CURRENT USER
  // ===================================================

  async function loadCurrentUser() {
    try {
      setCheckingAccess(true);

      const res = await fetch(
        "/api/me",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json?.message ||
            "Gagal memeriksa user login."
        );
      }

      const user =
        getApiUser(json);

      if (!user) {
        throw new Error(
          "Data user login tidak ditemukan."
        );
      }

      setCurrentUser(user);

      const role =
        getApiRole(json);

      if (role !== "ADMIN") {
        setError(
          "Akses pembayaran Purchase TEMPO hanya diperbolehkan untuk user ADMIN."
        );
      }
    } catch (err) {
      console.error(
        "LOAD CURRENT USER:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Gagal memeriksa hak akses user."
      );
    } finally {
      setCheckingAccess(false);
    }
  }

  // ===================================================
  // LOAD PURCHASE
  // ===================================================

  async function loadPurchase(
    preserveAmount = false
  ) {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(
        `/api/outlet/purchase/${id}`,
        {
          cache: "no-store",
        }
      );

      const json: ApiResponse =
        await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil Purchase Outlet."
        );
      }

      if (!json.data) {
        throw new Error(
          "Data Purchase Outlet tidak ditemukan."
        );
      }

      const nextPurchase =
        json.data;

      setPurchase(nextPurchase);

      const nextPayable =
        nextPurchase.purchasePayable ??
        nextPurchase.payable ??
        nextPurchase.PurchasePayable ??
        null;

      const nextPayableTotal =
        Number(
          nextPayable?.amount ??
            nextPayable?.totalAmount ??
            nextPurchase.total ??
            0
        );

      const nextPaidAmount =
        Number(
          nextPayable?.paidAmount ??
            nextPayable?.paid ??
            nextPurchase.paidAmount ??
            0
        );

      let nextOutstanding =
        nextPayable?.outstanding ??
        nextPayable?.remaining ??
        nextPurchase.outstanding;

      if (
        nextOutstanding ===
          undefined ||
        nextOutstanding === null ||
        nextOutstanding === ""
      ) {
        nextOutstanding =
          Math.max(
            nextPayableTotal -
              nextPaidAmount,
            0
          );
      }

      const numericOutstanding =
        Number(nextOutstanding);

      const finalOutstanding =
        Number.isFinite(
          numericOutstanding
        )
          ? Math.max(
              numericOutstanding,
              0
            )
          : Math.max(
              Number(
                nextPurchase.total ||
                  0
              ),
              0
            );

      if (!preserveAmount) {
        setAmount(
          String(
            Math.round(
              finalOutstanding
            )
          )
        );
      }
    } catch (err) {
      console.error(
        "LOAD OUTLET PURCHASE PAYMENT:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data Purchase Outlet."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) {
      setError(
        "ID Purchase Outlet tidak valid."
      );
      setLoading(false);
      setCheckingAccess(false);
      return;
    }

    loadCurrentUser();
    loadPurchase();
  }, [id]);

  // ===================================================
  // CALCULATION
  // ===================================================

  const total = useMemo(() => {
    return Number(
      purchase?.total || 0
    );
  }, [purchase]);

  const debtTotal = useMemo(() => {
    if (!purchase) {
      return 0;
    }

    if (payableTotal > 0) {
      return payableTotal;
    }

    return total;
  }, [
    purchase,
    payableTotal,
    total,
  ]);

  const paidAmount = useMemo(() => {
    return Math.max(
      payablePaidAmount,
      0
    );
  }, [payablePaidAmount]);

  const outstanding = useMemo(() => {
    return Math.max(
      payableOutstanding,
      0
    );
  }, [payableOutstanding]);

  const paymentAmount = useMemo(() => {
    const value = Number(amount);

    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      return 0;
    }

    return value;
  }, [amount]);

  const remainingAfterPayment =
    useMemo(() => {
      return Math.max(
        outstanding -
          paymentAmount,
        0
      );
    }, [
      outstanding,
      paymentAmount,
    ]);

  const overpayment = useMemo(() => {
    return Math.max(
      paymentAmount -
        outstanding,
      0
    );
  }, [
    paymentAmount,
    outstanding,
  ]);

  const selectedMethod =
    PAYMENT_METHODS.find(
      (item) =>
        item.value === method
    );

  const isPettyCashPayment =
    selectedMethod?.pettyCash === true;

  const isFullSettlement =
    paymentAmount > 0 &&
    paymentAmount <= outstanding &&
    remainingAfterPayment <= 0.01;

  // ===================================================
  // SUBMIT PAYMENT
  // ===================================================

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!purchase) {
      return;
    }

    setError("");
    setSuccessMessage("");

    // -----------------------------------------------
    // ROLE
    // -----------------------------------------------

    if (!isAdmin) {
      setError(
        "Akses ditolak. Hanya user ADMIN yang dapat melakukan pembayaran Purchase TEMPO."
      );
      return;
    }

    // -----------------------------------------------
    // HARUS TEMPO
    // -----------------------------------------------

    if (!isTempoPurchase) {
      setError(
        "Halaman ini hanya digunakan untuk pelunasan Purchase dengan metode TEMPO."
      );
      return;
    }

    // -----------------------------------------------
    // HARUS RECEIVED
    // -----------------------------------------------

    if (!isReceivedPurchase) {
      setError(
        "Pembayaran Purchase TEMPO hanya dapat dilakukan setelah Purchase berstatus RECEIVED."
      );
      return;
    }

    // -----------------------------------------------
    // SUDAH LUNAS
    // -----------------------------------------------

    if (isTempoPaid) {
      setError(
        "Hutang TEMPO untuk Purchase ini sudah lunas. Pembayaran tidak dapat dilakukan lagi."
      );
      return;
    }

    // -----------------------------------------------
    // AMOUNT
    // -----------------------------------------------

    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      setError(
        "Jumlah pembayaran harus lebih dari 0."
      );
      return;
    }

    // -----------------------------------------------
    // OVERPAYMENT
    // -----------------------------------------------

    if (
      numericAmount >
      outstanding
    ) {
      setError(
        `Jumlah pelunasan tidak boleh lebih besar dari sisa hutang (${formatRupiah(
          outstanding
        )}).`
      );
      return;
    }

    // -----------------------------------------------
    // CONFIRM
    // -----------------------------------------------

    const confirmText =
      isPettyCashPayment
        ? isFullSettlement
          ? `Lunasi seluruh hutang TEMPO sebesar ${formatRupiah(
              numericAmount
            )} dengan ${selectedMethod?.label}?\n\nPembayaran ini akan memproses pelunasan hutang dan ${selectedMethod?.label} akan mengurangi Petty Cash Outlet.`
          : `Bayar sebagian hutang TEMPO sebesar ${formatRupiah(
              numericAmount
            )} dengan ${selectedMethod?.label}?\n\nSisa hutang setelah pembayaran diperkirakan ${formatRupiah(
              remainingAfterPayment
            )}.\n\nPetty Cash Outlet akan otomatis berkurang.`
        : isFullSettlement
          ? `Lunasi seluruh hutang TEMPO sebesar ${formatRupiah(
              numericAmount
            )} dengan ${selectedMethod?.label}?`
          : `Bayar sebagian hutang TEMPO sebesar ${formatRupiah(
              numericAmount
            )} dengan ${selectedMethod?.label}?\n\nSisa hutang setelah pembayaran diperkirakan ${formatRupiah(
              remainingAfterPayment
            )}.`;

    const confirmed =
      window.confirm(
        confirmText
      );

    if (!confirmed) {
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(
        `/api/outlet/purchase/${purchase.id}/payment`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            amount:
              numericAmount,

            method,

            referenceNumber:
              referenceNumber.trim() ||
              null,

            remarks:
              remarks.trim() ||
              null,

            paymentDate:
              paymentDate
                ? paymentDate
                : undefined,
          }),
        }
      );

      const json: PaymentResponse =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Pelunasan gagal."
        );
      }

      setSuccessMessage(
        json.message ||
          (isFullSettlement
            ? "Pelunasan hutang TEMPO berhasil. Purchase sudah LUNAS."
            : "Pembayaran hutang TEMPO berhasil.")
      );

      // ---------------------------------------------
      // REFRESH DATA
      // ---------------------------------------------

      try {
        const refreshRes =
          await fetch(
            `/api/outlet/purchase/${purchase.id}`,
            {
              cache: "no-store",
            }
          );

        const refreshJson: ApiResponse =
          await refreshRes.json();

        if (
          refreshRes.ok &&
          refreshJson.success &&
          refreshJson.data
        ) {
          setPurchase(
            refreshJson.data
          );

          const refreshedPayable =
            refreshJson.data
              .purchasePayable ??
            refreshJson.data
              .payable ??
            refreshJson.data
              .PurchasePayable ??
            null;

          const refreshedPayableTotal =
            Number(
              refreshedPayable?.amount ??
                refreshedPayable?.totalAmount ??
                refreshJson.data.total ??
                0
            );

          const refreshedPaid =
            Number(
              refreshedPayable?.paidAmount ??
                refreshedPayable?.paid ??
                refreshJson.data.paidAmount ??
                0
            );

          let refreshedOutstanding =
            refreshedPayable?.outstanding ??
            refreshedPayable?.remaining ??
            refreshJson.data.outstanding;

          if (
            refreshedOutstanding ===
              undefined ||
            refreshedOutstanding ===
              null ||
            refreshedOutstanding ===
              ""
          ) {
            refreshedOutstanding =
              Math.max(
                refreshedPayableTotal -
                  refreshedPaid,
                0
              );
          }

          const numericRefreshedOutstanding =
            Number(
              refreshedOutstanding
            );

          if (
            Number.isFinite(
              numericRefreshedOutstanding
            )
          ) {
            setAmount(
              String(
                Math.round(
                  Math.max(
                    numericRefreshedOutstanding,
                    0
                  )
                )
              )
            );
          }
        }
      } catch (refreshError) {
        console.error(
          "REFRESH PURCHASE AFTER PAYMENT:",
          refreshError
        );
      }

      // ---------------------------------------------
      // REDIRECT
      // ---------------------------------------------

      setTimeout(() => {
        router.push(
          `/outlet/purchase/${purchase.id}`
        );

        router.refresh();
      }, 900);
    } catch (err) {
      console.error(
        "OUTLET PURCHASE PAYMENT ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Gagal melakukan pelunasan."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ===================================================
  // LOADING
  // ===================================================

  if (
    loading ||
    checkingAccess
  ) {
    return (
      <div className="min-h-full bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-emerald-700 via-green-600 to-emerald-500" />

            <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
              <div className="relative mb-5">
                <div className="h-14 w-14 rounded-2xl bg-emerald-50" />

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-100 border-t-emerald-600" />
                </div>
              </div>

              <h2 className="text-lg font-bold text-slate-900">
                Memuat Pembayaran Purchase
              </h2>

              <p className="mt-1.5 max-w-md text-sm leading-6 text-slate-500">
                Sedang memverifikasi hak akses
                dan mengambil data Purchase
                Outlet...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===================================================
  // ACCESS DENIED
  // ===================================================

  if (!isAdmin) {
    return (
      <div className="min-h-full bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-5">
            <button
              type="button"
              onClick={() =>
                router.push(
                  purchase
                    ? `/outlet/purchase/${purchase.id}`
                    : "/outlet/purchase"
                )
              }
              className="group inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <IconArrowLeft />
              Kembali
            </button>
          </div>

          <div className="overflow-hidden rounded-3xl border border-red-200 bg-white shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-red-600 to-orange-500" />

            <div className="p-6 md:p-10">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-8 ring-red-50/60">
                  <IconShield />
                </div>

                <div className="mt-6">
                  <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-red-700">
                    Access Restricted
                  </span>

                  <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                    Akses Pembayaran Ditolak
                  </h1>

                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    Fitur pembayaran Purchase
                    TEMPO hanya dapat diakses
                    oleh user dengan role{" "}
                    <strong className="text-slate-700">
                      ADMIN
                    </strong>
                    .
                  </p>
                </div>

                <div className="mt-7 w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      User
                    </span>

                    <span className="font-semibold text-slate-800">
                      {currentUser?.name ||
                        currentUser?.username ||
                        "-"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Role
                    </span>

                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                      {currentUser?.role ||
                        "UNKNOWN"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      purchase
                        ? `/outlet/purchase/${purchase.id}`
                        : "/outlet/purchase"
                    )
                  }
                  className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99]"
                >
                  Kembali ke Purchase
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===================================================
  // ERROR / NOT FOUND
  // ===================================================

  if (!purchase) {
    return (
      <div className="min-h-full bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-4xl">
          <div className="overflow-hidden rounded-3xl border border-red-200 bg-white shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-red-600 to-orange-500" />

            <div className="p-7 md:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                !
              </div>

              <h2 className="mt-5 text-xl font-bold text-slate-900">
                Purchase Outlet tidak
                dapat dibuka
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {error ||
                  "Data Purchase Outlet tidak ditemukan."}
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/outlet/purchase"
                  )
                }
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                <IconArrowLeft />
                Kembali ke Purchase
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===================================================
  // NON TEMPO
  // ===================================================

  if (!isTempoPurchase) {
    return (
      <div className="min-h-full bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/outlet/purchase/${purchase.id}`
              )
            }
            className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <IconArrowLeft />
            Kembali ke Detail Purchase
          </button>

          <div className="overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-blue-600 to-cyan-500" />

            <div className="bg-gradient-to-br from-blue-50 via-white to-white p-7 md:p-10">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                  <IconCreditCard />
                </div>

                <div>
                  <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                    Payment Information
                  </span>

                  <h1 className="mt-3 text-2xl font-bold text-slate-900">
                    Pembayaran TEMPO
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Halaman ini khusus untuk
                    pelunasan Purchase dengan
                    metode pembayaran TEMPO.
                  </p>
                </div>
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Nomor Purchase
                  </div>

                  <div className="mt-2 font-bold text-slate-900">
                    {purchase.number}
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-blue-500">
                    Metode Purchase
                  </div>

                  <div className="mt-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                    {purchase.paymentMethod ||
                      "-"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===================================================
  // STATUS MUST BE RECEIVED
  // ===================================================

  if (!isReceivedPurchase) {
    return (
      <div className="min-h-full bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/outlet/purchase/${purchase.id}`
              )
            }
            className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <IconArrowLeft />
            Kembali ke Detail Purchase
          </button>

          <div className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-amber-500 to-orange-500" />

            <div className="p-7 md:p-10">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <IconDocument />
                </div>

                <div>
                  <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">
                    Payment Locked
                  </span>

                  <h1 className="mt-3 text-2xl font-bold text-slate-900">
                    Purchase Belum Dapat Dibayar
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Pelunasan hutang TEMPO hanya
                    dapat dilakukan setelah
                    Purchase Outlet berstatus{" "}
                    <strong className="text-slate-800">
                      RECEIVED
                    </strong>
                    .
                  </p>
                </div>
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Nomor Purchase
                  </div>

                  <div className="mt-2 font-bold text-slate-900">
                    {purchase.number}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Status Saat Ini
                  </div>

                  <div className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                    {purchase.status}
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-blue-500">
                    Syarat Pembayaran
                  </div>

                  <div className="mt-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                    RECEIVED
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex gap-3">
                  <div className="mt-0.5 text-amber-600">
                    <IconShield />
                  </div>

                  <div>
                    <div className="text-sm font-bold text-amber-800">
                      Pembayaran dikunci
                    </div>

                    <p className="mt-1 text-xs leading-5 text-amber-700">
                      Status Purchase saat ini{" "}
                      <strong>
                        {purchase.status}
                      </strong>
                      . Tombol pembayaran baru
                      akan tersedia ketika proses
                      penerimaan barang telah
                      menghasilkan status{" "}
                      <strong>
                        RECEIVED
                      </strong>
                      .
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===================================================
  // TEMPO SUDAH LUNAS
  // ===================================================

  if (isTempoPaid) {
    return (
      <div className="min-h-full bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/outlet/purchase/${purchase.id}`
                  )
                }
                className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-emerald-700"
              >
                <IconArrowLeft />
                Kembali ke Detail Purchase
              </button>

              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Pembayaran Purchase
                  Outlet
                </h1>

                <span className="hidden rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 sm:inline-flex">
                  TEMPO
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Status hutang supplier untuk
                Purchase Order.
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
                <IconCheck />
              </span>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  Status Pembayaran
                </div>

                <div className="text-sm font-bold text-emerald-800">
                  LUNAS
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-emerald-700 via-green-600 to-emerald-400" />

            <div className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-7 md:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 ring-8 ring-emerald-50">
                  <IconCheck />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-emerald-900">
                    TEMPO Sudah Lunas
                  </h2>

                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-emerald-700">
                    Seluruh hutang supplier
                    untuk Purchase ini telah
                    diselesaikan. Pembayaran
                    tambahan tidak dapat
                    dilakukan lagi.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Nomor Purchase
                </div>

                <div className="mt-2 font-bold text-slate-900">
                  {purchase.number}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Supplier
                </div>

                <div className="mt-2 font-bold text-slate-900">
                  {purchase.supplier?.name ||
                    "-"}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
                  Metode Purchase
                </div>

                <div className="mt-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                  TEMPO
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  Sisa Hutang
                </div>

                <div className="mt-2 text-xl font-bold text-emerald-700">
                  {formatRupiah(0)}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 px-6 py-5">
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-slate-400">
                    Total Hutang
                  </div>

                  <div className="mt-1 text-base font-bold text-slate-900">
                    {formatRupiah(
                      debtTotal
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400">
                    Sudah Dibayar
                  </div>

                  <div className="mt-1 text-base font-bold text-emerald-700">
                    {formatRupiah(
                      Math.max(
                        paidAmount,
                        debtTotal
                      )
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400">
                    Status
                  </div>

                  <div className="mt-1 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                    TEMPO LUNAS
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-5">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/outlet/purchase/${purchase.id}`
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Kembali ke Detail Purchase
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===================================================
  // MAIN PAYMENT PAGE
  // ===================================================

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        {/* =================================================
            PREMIUM HEADER
        ================================================= */}

        <div className="mb-6 overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-emerald-800 via-green-600 to-emerald-400" />

          <div className="p-5 md:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/outlet/purchase/${purchase.id}`
                    )
                  }
                  className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-emerald-700"
                >
                  <IconArrowLeft />
                  Kembali ke Detail Purchase
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                    Pelunasan Purchase
                    TEMPO
                  </h1>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                    TEMPO
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    RECEIVED
                  </span>
                </div>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Proses pembayaran hutang
                  supplier untuk Purchase
                  Order Outlet yang telah
                  diterima.
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                  <IconShield />
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    Authorized User
                  </div>

                  <div className="mt-0.5 text-sm font-bold text-emerald-900">
                    ADMIN
                  </div>
                </div>
              </div>
            </div>

            {/* WORKFLOW */}

            <div className="mt-7 grid grid-cols-3 gap-2 md:max-w-2xl">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">
                  1
                </span>

                <div className="min-w-0">
                  <div className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Purchase
                  </div>

                  <div className="truncate text-xs font-bold text-slate-700">
                    Approved
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  2
                </span>

                <div className="min-w-0">
                  <div className="truncate text-[10px] font-bold uppercase tracking-wide text-emerald-500">
                    Receiving
                  </div>

                  <div className="truncate text-xs font-bold text-emerald-800">
                    Received
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-3 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-700 text-xs font-bold text-white">
                  3
                </span>

                <div className="min-w-0">
                  <div className="truncate text-[10px] font-bold uppercase tracking-wide text-green-600">
                    Payment
                  </div>

                  <div className="truncate text-xs font-bold text-green-800">
                    Ready
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            ALERTS
        ================================================= */}

        {error && (
          <div className="mb-5 overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
            <div className="border-l-4 border-red-500 bg-red-50 px-5 py-4">
              <div className="font-bold text-red-800">
                Pelunasan gagal
              </div>

              <div className="mt-1 text-sm leading-6 text-red-700">
                {error}
              </div>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
            <div className="border-l-4 border-emerald-500 bg-emerald-50 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-emerald-600">
                  <IconCheck />
                </div>

                <div>
                  <div className="font-bold text-emerald-800">
                    Pembayaran berhasil
                  </div>

                  <div className="mt-1 text-sm leading-6 text-emerald-700">
                    {successMessage}
                  </div>

                  <div className="mt-1 text-xs text-emerald-600">
                    Mengarahkan kembali ke
                    detail Purchase Outlet...
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            MAIN GRID
        ================================================= */}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* =================================================
              LEFT
          ================================================= */}

          <div className="space-y-6">
            {/* PURCHASE INFO */}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <IconDocument />
                    </div>

                    <h2 className="font-bold text-slate-900">
                      Informasi Purchase
                    </h2>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Data dokumen Purchase yang
                    akan dilunasi.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                    TEMPO
                  </span>

                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    RECEIVED
                  </span>
                </div>
              </div>

              <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
                <div className="bg-white p-5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Nomor Purchase
                  </div>

                  <div className="mt-2 text-base font-bold text-slate-900">
                    {purchase.number}
                  </div>
                </div>

                <div className="bg-white p-5">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <IconBuilding />
                    Outlet
                  </div>

                  <div className="mt-2 text-base font-bold text-slate-900">
                    {purchase.outlet?.name ||
                      "-"}
                  </div>

                  {purchase.outlet?.code && (
                    <div className="mt-0.5 text-xs text-slate-500">
                      {purchase.outlet.code}
                    </div>
                  )}
                </div>

                <div className="bg-white p-5">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <IconUser />
                    Supplier
                  </div>

                  <div className="mt-2 text-base font-bold text-slate-900">
                    {purchase.supplier?.name ||
                      "-"}
                  </div>
                </div>

                <div className="bg-white p-5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Status Purchase
                  </div>

                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {purchase.status}
                  </div>
                </div>
              </div>
            </div>

            {/* DEBT SUMMARY */}

            <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
              <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-5 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <IconWallet />
                  </div>

                  <div>
                    <h2 className="font-bold text-slate-900">
                      Ringkasan Hutang TEMPO
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-500">
                      Posisi hutang supplier
                      sebelum transaksi pembayaran.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total Hutang
                  </div>

                  <div className="mt-2 text-lg font-bold text-slate-900">
                    {formatRupiah(
                      debtTotal
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    Sudah Dibayar
                  </div>

                  <div className="mt-2 text-lg font-bold text-emerald-700">
                    {formatRupiah(
                      paidAmount
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
                    Sisa Hutang
                  </div>

                  <div className="mt-2 text-lg font-bold text-orange-700">
                    {formatRupiah(
                      outstanding
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ITEMS */}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-slate-900">
                      Detail Barang
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      Item yang terkait dengan
                      Purchase Order.
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
                    {purchase.items.length}{" "}
                    ITEM
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-5 py-3.5 text-left font-bold">
                        Barang
                      </th>

                      <th className="px-5 py-3.5 text-right font-bold">
                        Qty
                      </th>

                      <th className="px-5 py-3.5 text-right font-bold">
                        Harga
                      </th>

                      <th className="px-5 py-3.5 text-right font-bold">
                        Subtotal
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {purchase.items.map(
                      (item) => (
                        <tr
                          key={item.id}
                          className="transition hover:bg-emerald-50/30"
                        >
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-900">
                              {item.barang
                                ?.name ||
                                "-"}
                            </div>

                            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                              {item.barang
                                ?.code && (
                                <span>
                                  {
                                    item
                                      .barang
                                      .code
                                  }
                                </span>
                              )}

                              {item.barang
                                ?.unit && (
                                <>
                                  <span>
                                    •
                                  </span>

                                  <span>
                                    {
                                      item
                                        .barang
                                        .unit
                                    }
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-right font-medium text-slate-700">
                            {item.qty}
                          </td>

                          <td className="px-5 py-4 text-right whitespace-nowrap text-slate-600">
                            {formatRupiah(
                              Number(
                                item.price
                              )
                            )}
                          </td>

                          <td className="px-5 py-4 text-right font-bold whitespace-nowrap text-slate-900">
                            {formatRupiah(
                              Number(
                                item.subtotal
                              )
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-100 bg-slate-50 px-5 py-5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-bold text-slate-600">
                    Total Purchase
                  </span>

                  <span className="text-xl font-extrabold text-emerald-700">
                    {formatRupiah(
                      total
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* =================================================
              RIGHT - PAYMENT FORM
          ================================================= */}

          <div>
            <form
              onSubmit={
                handleSubmit
              }
              className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-md shadow-emerald-950/[0.04]"
            >
              {/* FORM HEADER */}

              <div className="relative overflow-hidden border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white px-5 py-5">
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-100/60 blur-2xl" />

                <div className="relative flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
                    <IconCreditCard />
                  </div>

                  <div>
                    <h2 className="font-bold text-slate-900">
                      Pelunasan Hutang
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-500">
                      Pembayaran sebagian atau
                      pelunasan penuh.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-5">
                {/* OUTSTANDING HERO */}

                <div className="relative overflow-hidden rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-5">
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-orange-200/40 blur-2xl" />

                  <div className="relative">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-600">
                      Sisa Hutang Saat Ini
                    </div>

                    <div className="mt-2 text-3xl font-extrabold tracking-tight text-orange-700">
                      {formatRupiah(
                        outstanding
                      )}
                    </div>

                    <div className="mt-2 text-xs leading-5 text-orange-700/80">
                      Pembayaran tidak boleh
                      melebihi sisa hutang
                      TEMPO.
                    </div>
                  </div>
                </div>

                {/* METHOD */}

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Metode Pelunasan
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map(
                      (item) => {
                        const active =
                          method ===
                          item.value;

                        return (
                          <button
                            key={
                              item.value
                            }
                            type="button"
                            disabled={
                              submitting
                            }
                            onClick={() =>
                              setMethod(
                                item.value
                              )
                            }
                            className={`group relative rounded-xl border px-3 py-3 text-left transition ${
                              active
                                ? "border-emerald-500 bg-emerald-50 shadow-sm ring-2 ring-emerald-100"
                                : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            {active && (
                              <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                                <IconCheck />
                              </span>
                            )}

                            <div
                              className={`text-xs font-bold ${
                                active
                                  ? "text-emerald-800"
                                  : "text-slate-700"
                              }`}
                            >
                              {
                                item.label
                              }
                            </div>

                            <div
                              className={`mt-1 text-[10px] leading-4 ${
                                active
                                  ? "text-emerald-600"
                                  : "text-slate-400"
                              }`}
                            >
                              {item.pettyCash
                                ? "Petty Cash"
                                : "Bank Transfer"}
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>

                  {selectedMethod && (
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {
                        selectedMethod.description
                      }
                    </p>
                  )}
                </div>

                {/* PETTY CASH INFO */}

                {isPettyCashPayment && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                        <IconWallet />
                      </div>

                      <div>
                        <div className="text-sm font-bold text-amber-900">
                          Petty Cash Outlet
                        </div>

                        <p className="mt-1 text-xs leading-5 text-amber-700">
                          Pelunasan{" "}
                          <strong>
                            {
                              selectedMethod?.label
                            }
                          </strong>{" "}
                          akan dicatat sebagai
                          pengeluaran Petty Cash
                          Outlet sesuai business
                          rule pembayaran.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* AMOUNT */}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-bold text-slate-700">
                      Jumlah Pelunasan
                    </label>

                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      IDR
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                      Rp
                    </span>

                    <input
                      type="number"
                      min="1"
                      max={outstanding}
                      step="1"
                      value={amount}
                      onChange={(e) =>
                        setAmount(
                          e.target.value
                        )
                      }
                      disabled={
                        submitting ||
                        outstanding <= 0
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-10 pr-4 text-base font-bold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
                      placeholder="0"
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      Maksimal pembayaran
                    </span>

                    <span className="font-bold text-slate-700">
                      {formatRupiah(
                        outstanding
                      )}
                    </span>
                  </div>
                </div>

                {/* QUICK FULL PAYMENT */}

                <button
                  type="button"
                  disabled={
                    submitting ||
                    outstanding <= 0
                  }
                  onClick={() =>
                    setAmount(
                      String(
                        Math.round(
                          outstanding
                        )
                      )
                    )
                  }
                  className="group flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>
                    Lunasi Penuh
                  </span>

                  <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-emerald-700 shadow-sm">
                    {formatRupiah(
                      outstanding
                    )}
                  </span>
                </button>

                {/* LIVE SUMMARY */}

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Payment Summary
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-slate-500">
                        Total Hutang
                      </span>

                      <span className="font-semibold text-slate-900">
                        {formatRupiah(
                          debtTotal
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-slate-500">
                        Sudah Dibayar
                      </span>

                      <span className="font-bold text-emerald-700">
                        {formatRupiah(
                          paidAmount
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-slate-500">
                        Pelunasan Ini
                      </span>

                      <span className="font-bold text-blue-700">
                        {formatRupiah(
                          paymentAmount
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 px-4 py-4">
                      <span className="text-sm font-bold text-slate-700">
                        Sisa Setelah Pembayaran
                      </span>

                      <span
                        className={`text-base font-extrabold ${
                          remainingAfterPayment ===
                          0
                            ? "text-emerald-700"
                            : "text-orange-600"
                        }`}
                      >
                        {formatRupiah(
                          remainingAfterPayment
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* REFERENCE */}

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Nomor Referensi
                    <span className="ml-1 font-normal text-slate-400">
                      (opsional)
                    </span>
                  </label>

                  <input
                    type="text"
                    value={
                      referenceNumber
                    }
                    onChange={(e) =>
                      setReferenceNumber(
                        e.target.value
                      )
                    }
                    disabled={
                      submitting
                    }
                    placeholder="Contoh: TRF-00123"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
                  />
                </div>

                {/* DATE */}

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Tanggal Pelunasan
                  </label>

                  <div className="relative">
                    <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <IconCalendar />
                    </div>

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
                        submitting
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
                    />
                  </div>

                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Tanggal transaksi:
                    {" "}
                    {paymentDate
                      ? formatDate(
                          new Date(
                            `${paymentDate}T00:00:00`
                          )
                        )
                      : "-"}
                  </p>
                </div>

                {/* REMARKS */}

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Keterangan
                    <span className="ml-1 font-normal text-slate-400">
                      (opsional)
                    </span>
                  </label>

                  <textarea
                    value={remarks}
                    onChange={(e) =>
                      setRemarks(
                        e.target.value
                      )
                    }
                    disabled={
                      submitting
                    }
                    rows={3}
                    placeholder="Keterangan pelunasan..."
                    className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
                  />
                </div>

                {/* OVERPAYMENT */}

                {overpayment > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3.5">
                    <div className="text-xs font-bold text-red-800">
                      Jumlah pembayaran tidak valid
                    </div>

                    <p className="mt-1 text-xs leading-5 text-red-700">
                      Jumlah pelunasan melebihi
                      sisa hutang TEMPO.
                    </p>
                  </div>
                )}

                {/* FULL SETTLEMENT INFO */}

                {isFullSettlement && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <IconCheck />
                      </div>

                      <div>
                        <div className="text-sm font-bold text-emerald-900">
                          Pelunasan Penuh
                        </div>

                        <p className="mt-1 text-xs leading-5 text-emerald-700">
                          Setelah pembayaran
                          berhasil, sisa hutang
                          akan menjadi{" "}
                          <strong>
                            Rp 0
                          </strong>{" "}
                          dan status hutang akan
                          menjadi{" "}
                          <strong>
                            LUNAS
                          </strong>
                          .
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ADMIN SECURITY INFO */}

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <IconShield />
                    </div>

                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                        Authorized Payment
                      </div>

                      <p className="mt-1 text-xs leading-5 text-emerald-700">
                        Pembayaran Purchase TEMPO
                        ini hanya dapat diproses
                        oleh user{" "}
                        <strong>
                          ADMIN
                        </strong>{" "}
                        dan Purchase harus
                        berstatus{" "}
                        <strong>
                          RECEIVED
                        </strong>
                        .
                      </p>
                    </div>
                  </div>
                </div>

                {/* SUBMIT */}

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    paymentAmount <= 0 ||
                    paymentAmount >
                      outstanding ||
                    outstanding <= 0 ||
                    !isAdmin ||
                    !isReceivedPurchase
                  }
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 to-green-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-700/15 transition hover:from-emerald-800 hover:to-green-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:bg-none disabled:shadow-none"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Memproses Pelunasan...
                    </>
                  ) : (
                    <>
                      <IconCreditCard />
                      Bayar{" "}
                      {formatRupiah(
                        paymentAmount
                      )}
                    </>
                  )}
                </button>

                {/* CANCEL */}

                <button
                  type="button"
                  disabled={
                    submitting
                  }
                  onClick={() =>
                    router.push(
                      `/outlet/purchase/${purchase.id}`
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Batal
                </button>

                <div className="text-center text-[10px] leading-5 text-slate-400">
                  Pembayaran akan tercatat
                  sebagai transaksi pelunasan
                  hutang Purchase TEMPO.
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}