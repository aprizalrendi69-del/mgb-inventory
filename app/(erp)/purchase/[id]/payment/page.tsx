"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  FileText,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";

type PaymentStatus =
  | "UNPAID"
  | "PARTIAL"
  | "PAID"
  | string;

type PaymentMethod =
  | "PETTY_CASH"
  | "TRANSFER"
  | "TEMPO"
  | "COD"
  | "CBD"
  | string;

type Supplier = {
  id: number;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
};

type PurchaseItem = {
  id: number;
  barangId: number;
  qty: number;
  receivedQty: number;
  price: number;
  discount: number;
  tax: number;
  subtotal: number;
  barang?: {
    id: number;
    code: string;
    name: string;
    unit: string;
  } | null;
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
  account?: {
    id: number;
    code: string;
    name: string;
    type: string;
  } | null;
};

type Payable = {
  id: number;
  purchaseId?: number | null;
  supplierId: number;
  outletId?: number | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  amount: number;
  paidAmount: number;
  outstanding: number;
  status: PaymentStatus;
  payments?: Payment[];
};

type CashAccount = {
  id: number;
  code: string;
  name: string;
  type: "PETTY_CASH" | "CASH" | "BANK" | string;
  outletId?: number | null;
  openingBalance: number;
  currentBalance: number;
  active: boolean;
  outlet?: {
    id: number;
    code: string;
    name: string;
  } | null;
};

type Purchase = {
  id: number;
  number: string;
  supplierId: number;
  purchaseDate: string;
  status: string;
  remarks?: string | null;
  total: number;
  paymentMethod?: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  supplier: Supplier;
  items: PurchaseItem[];
  payable?: Payable | null;
};

type UserInfo = {
  id: number;
  fullname?: string;
  role: string;
  outletId?: number | null;
};

function formatRupiah(value: number) {
  return Number(value || 0).toLocaleString("id-ID");
}

function parseRupiah(value: string) {
  return Number(
    value
      .replace(/\./g, "")
      .replace(/,/g, "")
      .replace(/\D/g, "")
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";

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
  if (!value) return "-";

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

function getPaymentMethodLabel(method?: string | null) {
  switch (method) {
    case "PETTY_CASH":
      return "PETTY CASH";
    case "TRANSFER":
      return "TRANSFER";
    case "TEMPO":
      return "TEMPO";
    case "COD":
      return "COD";
    case "CBD":
      return "CBD";
    default:
      return method || "-";
  }
}

function getPaymentStatusLabel(status?: string | null) {
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

function getPaymentStatusClass(status?: string | null) {
  switch (status) {
    case "PAID":
      return "bg-green-100 text-green-700";
    case "PARTIAL":
      return "bg-yellow-100 text-yellow-700";
    case "UNPAID":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getAccountTypeLabel(type: string) {
  switch (type) {
    case "PETTY_CASH":
      return "PETTY CASH";
    case "CASH":
      return "CASH";
    case "BANK":
      return "BANK";
    default:
      return type;
  }
}

export default function PurchasePaymentPage() {
  const params = useParams();
  const router = useRouter();

  const purchaseId = Number(params?.id);

  const [user, setUser] = useState<UserInfo | null>(null);

  const [purchase, setPurchase] =
    useState<Purchase | null>(null);

  const [accounts, setAccounts] =
    useState<CashAccount[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingAccounts, setLoadingAccounts] =
    useState(true);
  const [saving, setSaving] = useState(false);

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("PETTY_CASH");

  const [accountId, setAccountId] =
    useState("");

  const [paymentDate, setPaymentDate] =
    useState("");

  const [referenceNumber, setReferenceNumber] =
    useState("");

  const [remarks, setRemarks] =
    useState("");

  // =====================================================
  // LOAD USER
  // =====================================================

  async function loadUser() {
    try {
      const res = await fetch("/api/me", {
        cache: "no-store",
      });

      const json = await res.json();

      const currentUser =
        json?.user ??
        json?.data ??
        json;

      if (res.ok && currentUser?.id) {
        setUser(currentUser);
      }
    } catch (error) {
      console.error("LOAD USER ERROR:", error);
    }
  }

  // =====================================================
  // LOAD PURCHASE
  // =====================================================

  async function loadPurchase() {
    if (!purchaseId || Number.isNaN(purchaseId)) {
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        `/api/purchase/${purchaseId}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json?.message ||
            "Gagal mengambil data Purchase."
        );
      }

      const payload =
        json?.data ??
        json?.purchase ??
        json;

      setPurchase(payload);

      const payable =
        payload?.payable;

      if (payable) {
        const outstanding =
          Math.max(
            0,
            Number(
              payable.outstanding ?? 0
            )
          );

        if (outstanding > 0) {
          setPaymentAmount(
            outstanding.toLocaleString(
              "id-ID"
            )
          );
        }
      } else {
        const outstanding =
          Math.max(
            0,
            Number(payload?.total ?? 0)
          );

        if (outstanding > 0) {
          setPaymentAmount(
            outstanding.toLocaleString(
              "id-ID"
            )
          );
        }
      }
    } catch (error) {
      console.error(
        "LOAD PURCHASE PAYMENT ERROR:",
        error
      );

      setPurchase(null);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal mengambil data Purchase."
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // LOAD CASH ACCOUNTS
  // =====================================================

  async function loadAccounts() {
    try {
      setLoadingAccounts(true);

      const res = await fetch(
        "/api/petty-cash",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json?.message ||
            "Gagal mengambil akun kas."
        );
      }

      const payload =
        json?.data ?? json;

      const data =
        payload?.accounts ??
        payload?.cashAccounts ??
        (Array.isArray(payload)
          ? payload
          : []);

      const activeAccounts =
        Array.isArray(data)
          ? data.filter(
              (account: CashAccount) =>
                account.active !== false
            )
          : [];

      setAccounts(activeAccounts);

      /*
       * Default account:
       *
       * PETTY_CASH -> pilih Petty Cash
       * TRANSFER   -> BANK
       * COD/CBD    -> CASH
       */

      let defaultAccount:
        | CashAccount
        | undefined;

      if (
        paymentMethod ===
        "PETTY_CASH"
      ) {
        defaultAccount =
          activeAccounts.find(
            (account: CashAccount) =>
              account.type ===
              "PETTY_CASH"
          );
      }

      if (
        paymentMethod ===
        "TRANSFER"
      ) {
        defaultAccount =
          activeAccounts.find(
            (account: CashAccount) =>
              account.type === "BANK"
          );
      }

      if (
        paymentMethod === "COD" ||
        paymentMethod === "CBD"
      ) {
        defaultAccount =
          activeAccounts.find(
            (account: CashAccount) =>
              account.type === "CASH"
          );
      }

      if (!defaultAccount) {
        defaultAccount =
          activeAccounts[0];
      }

      if (defaultAccount) {
        setAccountId(
          String(defaultAccount.id)
        );
      }
    } catch (error) {
      console.error(
        "LOAD CASH ACCOUNTS ERROR:",
        error
      );

      setAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  }

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    if (!purchaseId) return;

    loadUser();
    loadPurchase();
    loadAccounts();
  }, [purchaseId]);

  // =====================================================
  // PAYMENT METHOD CHANGE
  // =====================================================

  useEffect(() => {
    if (!accounts.length) {
      return;
    }

    let account:
      | CashAccount
      | undefined;

    if (
      paymentMethod ===
      "PETTY_CASH"
    ) {
      account = accounts.find(
        (item) =>
          item.type ===
          "PETTY_CASH"
      );
    } else if (
      paymentMethod ===
      "TRANSFER"
    ) {
      account = accounts.find(
        (item) =>
          item.type === "BANK"
      );
    } else if (
      paymentMethod === "COD" ||
      paymentMethod === "CBD"
    ) {
      account = accounts.find(
        (item) =>
          item.type === "CASH"
      );
    }

    if (account) {
      setAccountId(
        String(account.id)
      );
    }
  }, [paymentMethod, accounts]);

  // =====================================================
  // PAYABLE
  // =====================================================

  const payable = purchase?.payable;

  const totalAmount = useMemo(() => {
    return Number(
      payable?.amount ??
        purchase?.total ??
        0
    );
  }, [payable, purchase]);

  const paidAmount = useMemo(() => {
    return Number(
      payable?.paidAmount ?? 0
    );
  }, [payable]);

  const outstandingAmount = useMemo(() => {
    const serverOutstanding =
      Number(
        payable?.outstanding ?? 0
      );

    if (
      Number.isFinite(
        serverOutstanding
      )
    ) {
      return Math.max(
        0,
        serverOutstanding
      );
    }

    return Math.max(
      0,
      totalAmount - paidAmount
    );
  }, [
    payable,
    totalAmount,
    paidAmount,
  ]);

  const enteredAmount = useMemo(() => {
    return parseRupiah(
      paymentAmount
    );
  }, [paymentAmount]);

  const remainingAfterPayment =
    Math.max(
      0,
      outstandingAmount -
        enteredAmount
    );

  const paymentWillFullyPay =
    enteredAmount > 0 &&
    enteredAmount >=
      outstandingAmount;

  const selectedAccount =
    accounts.find(
      (account) =>
        account.id ===
        Number(accountId)
    );

  const accountBalance =
    Number(
      selectedAccount
        ?.currentBalance ?? 0
    );

  const insufficientBalance =
    paymentMethod !== "TEMPO" &&
    selectedAccount &&
    enteredAmount >
      accountBalance;

  const paymentAmountTooLarge =
    enteredAmount >
    outstandingAmount;

  const canSubmit =
    !saving &&
    !loading &&
    !loadingAccounts &&
    !!purchase &&
    !!accountId &&
    enteredAmount > 0 &&
    outstandingAmount > 0 &&
    !paymentAmountTooLarge &&
    !insufficientBalance;

  // =====================================================
  // SET FULL OUTSTANDING
  // =====================================================

  function setFullPayment() {
    setPaymentAmount(
      outstandingAmount.toLocaleString(
        "id-ID"
      )
    );
  }

  // =====================================================
  // SUBMIT PAYMENT
  // =====================================================

  async function submitPayment() {
    if (!purchase) {
      alert(
        "Data Purchase tidak ditemukan."
      );
      return;
    }

    const amount =
      parseRupiah(
        paymentAmount
      );

    const selectedAccountId =
      Number(accountId);

    if (
      !selectedAccountId
    ) {
      alert(
        "Pilih akun pembayaran."
      );
      return;
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      alert(
        "Nominal pembayaran harus lebih dari 0."
      );
      return;
    }

    /*
     * Client validation hanya sebagai
     * UX.
     *
     * Validasi sebenarnya tetap dilakukan
     * oleh API / server.
     */

    if (
      amount >
      outstandingAmount
    ) {
      alert(
        `Nominal pembayaran tidak boleh melebihi outstanding Rp ${formatRupiah(
          outstandingAmount
        )}.`
      );
      return;
    }

    if (
      paymentMethod !==
        "TEMPO" &&
      selectedAccount &&
      amount >
        Number(
          selectedAccount.currentBalance ||
            0
        )
    ) {
      alert(
        `Saldo akun tidak mencukupi. Saldo saat ini Rp ${formatRupiah(
          Number(
            selectedAccount.currentBalance ||
              0
          )
        )}.`
      );
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(
        `/api/purchase/${purchaseId}/payment`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            accountId:
              selectedAccountId,
            amount,
            method:
              paymentMethod,
            paymentDate:
              paymentDate || undefined,
            referenceNumber:
              referenceNumber.trim() ||
              undefined,
            remarks:
              remarks.trim() ||
              undefined,
          }),
        }
      );

      const json = await res.json();

      if (
        !res.ok ||
        json?.success === false
      ) {
        throw new Error(
          json?.message ||
            "Gagal melakukan pembayaran."
        );
      }

      alert(
        paymentWillFullyPay
          ? "Pembayaran berhasil. Purchase sekarang LUNAS."
          : "Pembayaran sebagian berhasil."
      );

      await loadPurchase();
      await loadAccounts();

      /*
       * Setelah server berhasil memproses,
       * kosongkan form lalu isi kembali
       * dengan outstanding terbaru.
       */

      const resultPayable =
        json?.data?.payable ??
        json?.payable;

      const newOutstanding =
        Number(
          resultPayable?.outstanding ??
            0
        );

      if (
        newOutstanding > 0
      ) {
        setPaymentAmount(
          newOutstanding.toLocaleString(
            "id-ID"
          )
        );
      } else {
        setPaymentAmount("");
      }

      setReferenceNumber("");
      setRemarks("");
    } catch (error) {
      console.error(
        "PAYMENT ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Gagal melakukan pembayaran."
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

        <div className="flex min-h-[500px] items-center justify-center">

          <div className="flex items-center gap-3 text-gray-500">

            <RefreshCw
              size={20}
              className="animate-spin text-[#497F70]"
            />

            Memuat data pembayaran...

          </div>

        </div>

      </div>
    );
  }

  // =====================================================
  // NOT FOUND
  // =====================================================

  if (!purchase) {
    return (
      <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

        <div className="mx-auto max-w-4xl rounded-2xl border border-[#DDE9E4] bg-white p-8 text-center shadow-sm">

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
            <FileText size={25} />
          </div>

          <h2 className="text-lg font-bold text-gray-800">
            Purchase tidak ditemukan
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Data Purchase yang ingin dibayar
            tidak tersedia.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push("/purchase")
            }
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3D6D60]"
          >
            <ArrowLeft size={17} />
            Kembali ke Purchase
          </button>

        </div>

      </div>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <button
            type="button"
            onClick={() =>
              router.push(
                `/purchase/${purchaseId}`
              )
            }
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D5E5DC] bg-white text-gray-600 shadow-sm transition hover:bg-[#F5F8F6] hover:text-[#497F70]"
          >
            <ArrowLeft size={19} />
          </button>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <Wallet size={23} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Pembayaran Purchase
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              {purchase.number}
            </p>
          </div>

        </div>

        <button
          type="button"
          onClick={() => {
            loadPurchase();
            loadAccounts();
          }}
          disabled={
            loading ||
            loadingAccounts
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={
              loading ||
              loadingAccounts
                ? "animate-spin"
                : ""
            }
          />
          Refresh
        </button>

      </div>

      {/* =================================================
          PURCHASE INFO
      ================================================= */}

      <div className="mb-6 grid gap-5 lg:grid-cols-3">

        {/* PURCHASE */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm lg:col-span-2">

          <div className="mb-5 flex items-center justify-between">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Informasi Purchase
              </p>

              <h2 className="mt-1 text-lg font-bold text-[#18352D]">
                {purchase.number}
              </h2>
            </div>

            <span
              className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${getPaymentStatusClass(
                purchase.paymentStatus
              )}`}
            >
              {getPaymentStatusLabel(
                purchase.paymentStatus
              )}
            </span>

          </div>

          <div className="grid gap-4 sm:grid-cols-2">

            <div>
              <p className="text-xs text-gray-400">
                Supplier
              </p>

              <p className="mt-1 font-semibold text-gray-800">
                {purchase.supplier?.name ||
                  "-"}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                {purchase.supplier?.code ||
                  "-"}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-400">
                Tanggal Purchase
              </p>

              <p className="mt-1 font-semibold text-gray-800">
                {formatDate(
                  purchase.purchaseDate
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-400">
                Invoice
              </p>

              <p className="mt-1 font-semibold text-gray-800">
                {purchase.invoiceNumber ||
                  "-"}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-400">
                Jatuh Tempo
              </p>

              <p className="mt-1 font-semibold text-gray-800">
                {formatDate(
                  purchase.dueDate
                )}
              </p>
            </div>

          </div>

        </div>

        {/* TOTAL */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <p className="text-xs font-semibold uppercase tracking-wide text-[#58736A]">
            Ringkasan Pembayaran
          </p>

          <div className="mt-5 space-y-4">

            <div className="flex items-center justify-between gap-3">

              <span className="text-sm text-gray-500">
                Total Purchase
              </span>

              <span className="font-bold text-gray-800">
                Rp{" "}
                {formatRupiah(
                  totalAmount
                )}
              </span>

            </div>

            <div className="flex items-center justify-between gap-3">

              <span className="text-sm text-gray-500">
                Sudah Dibayar
              </span>

              <span className="font-bold text-green-700">
                Rp{" "}
                {formatRupiah(
                  paidAmount
                )}
              </span>

            </div>

            <div className="border-t border-[#E5ECE9] pt-4">

              <div className="flex items-center justify-between gap-3">

                <span className="font-semibold text-[#35564C]">
                  Outstanding
                </span>

                <span className="text-xl font-bold text-[#18352D]">
                  Rp{" "}
                  {formatRupiah(
                    outstandingAmount
                  )}
                </span>

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* =================================================
          PAYMENT FORM + HISTORY
      ================================================= */}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">

        {/* PAYMENT FORM */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

          <div className="border-b border-[#E5ECE9] px-6 py-5">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <Banknote size={20} />
              </div>

              <div>
                <h2 className="font-bold text-[#18352D]">
                  Input Pembayaran
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Masukkan nominal pembayaran
                  kepada supplier
                </p>
              </div>

            </div>

          </div>

          <div className="space-y-5 p-6">

            {/* AMOUNT */}

            <div>

              <div className="mb-2 flex items-center justify-between">

                <label className="text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                  Nominal Pembayaran
                </label>

                <button
                  type="button"
                  onClick={
                    setFullPayment
                  }
                  disabled={
                    outstandingAmount <=
                    0
                  }
                  className="text-xs font-semibold text-[#497F70] hover:underline disabled:opacity-40"
                >
                  Bayar Penuh
                </button>

              </div>

              <div className="relative">

                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">
                  Rp
                </span>

                <input
                  type="text"
                  inputMode="numeric"
                  value={paymentAmount}
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
                    outstandingAmount <=
                    0
                  }
                  className={`w-full rounded-xl border bg-[#FAFCFB] py-4 pl-12 pr-4 text-lg font-bold outline-none transition focus:ring-2 ${
                    paymentAmountTooLarge
                      ? "border-red-400 focus:border-red-500 focus:ring-red-500/10"
                      : "border-[#D5E5DC] focus:border-[#497F70] focus:ring-[#497F70]/10"
                  }`}
                />

              </div>

              <div className="mt-2 flex items-center justify-between">

                <p className="text-xs text-gray-400">
                  Outstanding:{" "}
                  <span className="font-semibold text-[#497F70]">
                    Rp{" "}
                    {formatRupiah(
                      outstandingAmount
                    )}
                  </span>
                </p>

                {paymentAmountTooLarge && (
                  <p className="text-xs font-semibold text-red-600">
                    Melebihi outstanding
                  </p>
                )}

              </div>

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
                      e.target
                        .value as PaymentMethod
                    )
                  }
                  className="w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 pr-10 text-sm font-medium text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                >

                  <option value="PETTY_CASH">
                    PETTY CASH
                  </option>

                  <option value="TRANSFER">
                    TRANSFER
                  </option>

                  <option value="COD">
                    COD
                  </option>

                  <option value="CBD">
                    CBD
                  </option>

                  <option value="TEMPO">
                    TEMPO
                  </option>

                </select>

                <ChevronDown
                  size={17}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

              </div>

            </div>

            {/* ACCOUNT */}

            <div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Akun Pembayaran
              </label>

              <div className="relative">

                <select
                  value={accountId}
                  onChange={(e) =>
                    setAccountId(
                      e.target.value
                    )
                  }
                  disabled={
                    loadingAccounts
                  }
                  className="w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 pr-10 text-sm font-medium text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10 disabled:opacity-60"
                >

                  <option value="">
                    {loadingAccounts
                      ? "Memuat akun..."
                      : "Pilih akun"}
                  </option>

                  {accounts.map(
                    (account) => (
                      <option
                        key={
                          account.id
                        }
                        value={String(
                          account.id
                        )}
                      >
                        {account.code} -{" "}
                        {account.name}{" "}
                        (
                        {getAccountTypeLabel(
                          account.type
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

              {selectedAccount && (
                <div className="mt-2 flex items-center justify-between rounded-lg bg-[#F5F8F6] px-3 py-2">

                  <span className="text-xs text-gray-500">
                    Saldo tersedia
                  </span>

                  <span
                    className={`text-xs font-bold ${
                      insufficientBalance
                        ? "text-red-600"
                        : "text-[#497F70]"
                    }`}
                  >
                    Rp{" "}
                    {formatRupiah(
                      accountBalance
                    )}
                  </span>

                </div>
              )}

              {insufficientBalance && (
                <p className="mt-2 text-xs font-semibold text-red-600">
                  Saldo akun tidak mencukupi
                  untuk pembayaran ini.
                </p>
              )}

            </div>

            {/* DATE */}

            <div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Tanggal Pembayaran
              </label>

              <div className="relative">

                <CalendarDays
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
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
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 pl-10 text-sm text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                />

              </div>

            </div>

            {/* REFERENCE */}

            <div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Nomor Referensi
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
                placeholder="No. transfer / bukti pembayaran"
                className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
              />

            </div>

            {/* REMARKS */}

            <div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Keterangan
              </label>

              <textarea
                value={remarks}
                onChange={(e) =>
                  setRemarks(
                    e.target.value
                  )
                }
                rows={3}
                placeholder="Keterangan pembayaran..."
                className="w-full resize-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
              />

            </div>

            {/* AFTER PAYMENT */}

            {enteredAmount > 0 &&
              !paymentAmountTooLarge && (
                <div className="rounded-xl border border-[#DDE9E4] bg-[#F5F8F6] p-4">

                  <div className="flex items-center justify-between">

                    <span className="text-sm text-gray-500">
                      Sisa setelah pembayaran
                    </span>

                    <span className="font-bold text-[#18352D]">
                      Rp{" "}
                      {formatRupiah(
                        remainingAfterPayment
                      )}
                    </span>

                  </div>

                  {paymentWillFullyPay && (
                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-green-700">

                      <CheckCircle2
                        size={15}
                      />

                      Pembayaran ini akan
                      melunasi Purchase.

                    </div>
                  )}

                </div>
              )}

            {/* SUBMIT */}

            <button
              type="button"
              disabled={!canSubmit}
              onClick={
                submitPayment
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#497F70] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-50"
            >

              {saving ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                  Memproses Pembayaran...
                </>
              ) : (
                <>
                  <CreditCard
                    size={18}
                  />
                  {paymentWillFullyPay
                    ? "Bayar & Lunasi"
                    : "Simpan Pembayaran"}
                </>
              )}

            </button>

            {outstandingAmount <= 0 && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">

                <CheckCircle2
                  size={18}
                />

                Purchase sudah lunas.

              </div>
            )}

          </div>

        </div>

        {/* =================================================
            PAYMENT HISTORY
        ================================================= */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

          <div className="flex items-center justify-between border-b border-[#E5ECE9] px-6 py-5">

            <div>
              <h2 className="font-bold text-[#18352D]">
                Riwayat Pembayaran
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Semua pembayaran Purchase ini
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <CreditCard
                size={19}
              />
            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="min-w-[800px] w-full text-sm">

              <thead className="bg-[#F5F8F6]">

                <tr className="border-b border-[#E5ECE9]">

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    No
                  </th>

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Tanggal
                  </th>

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Nomor
                  </th>

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Metode
                  </th>

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Akun
                  </th>

                  <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                    Nominal
                  </th>

                </tr>

              </thead>

              <tbody>

                {!payable?.payments ||
                payable.payments.length ===
                  0 ? (

                  <tr>

                    <td
                      colSpan={6}
                      className="px-5 py-16 text-center"
                    >

                      <div className="flex flex-col items-center">

                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF3EF] text-[#497F70]">
                          <CreditCard
                            size={25}
                          />
                        </div>

                        <p className="font-semibold text-gray-700">
                          Belum ada pembayaran
                        </p>

                        <p className="mt-1 text-sm text-gray-400">
                          Belum ada transaksi
                          pembayaran untuk
                          Purchase ini.
                        </p>

                      </div>

                    </td>

                  </tr>

                ) : (

                  payable.payments.map(
                    (
                      payment,
                      index
                    ) => (
                      <tr
                        key={
                          payment.id
                        }
                        className="border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                      >

                        <td className="px-5 py-4 text-gray-500">
                          {index + 1}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                          {formatDateTime(
                            payment.paymentDate
                          )}
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

                          <span className="inline-flex rounded-full bg-[#EAF3EF] px-3 py-1 text-xs font-semibold text-[#497F70]">
                            {getPaymentMethodLabel(
                              payment.method
                            )}
                          </span>

                        </td>

                        <td className="px-5 py-4">

                          <div className="font-semibold text-gray-700">
                            {payment
                              .account
                              ?.name ||
                              accounts.find(
                                (
                                  account
                                ) =>
                                  account.id ===
                                  payment.accountId
                              )?.name ||
                              "-"}
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {payment
                              .account
                              ?.code ||
                              accounts.find(
                                (
                                  account
                                ) =>
                                  account.id ===
                                  payment.accountId
                              )?.code ||
                              "-"}
                          </div>

                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-red-600">
                          Rp{" "}
                          {formatRupiah(
                            payment.amount
                          )}
                        </td>

                      </tr>
                    )
                  )

                )}

              </tbody>

            </table>

          </div>

        </div>

      </div>

      {/* =================================================
          PURCHASE ITEMS
      ================================================= */}

      <div className="mt-6 overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        <div className="border-b border-[#E5ECE9] px-6 py-5">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F3E8] text-[#8A7A35]">
              <FileText size={19} />
            </div>

            <div>
              <h2 className="font-bold text-[#18352D]">
                Detail Purchase
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Barang yang terdapat pada
                Purchase
              </p>
            </div>

          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="min-w-[850px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Kode
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Nama Barang
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Qty
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Harga
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Subtotal
                </th>

              </tr>

            </thead>

            <tbody>

              {purchase.items?.map(
                (item, index) => (
                  <tr
                    key={item.id}
                    className="border-b border-[#EDF2EF] hover:bg-[#FAFCFB]"
                  >

                    <td className="px-5 py-4 text-gray-500">
                      {index + 1}
                    </td>

                    <td className="px-5 py-4 font-medium text-gray-700">
                      {item.barang
                        ?.code || "-"}
                    </td>

                    <td className="px-5 py-4">

                      <div className="font-semibold text-[#18352D]">
                        {item.barang
                          ?.name ||
                          "-"}
                      </div>

                      <div className="mt-1 text-xs text-gray-400">
                        Satuan:{" "}
                        {item.barang
                          ?.unit ||
                          "-"}
                      </div>

                    </td>

                    <td className="px-5 py-4 text-right font-semibold text-gray-700">
                      {item.qty.toLocaleString(
                        "id-ID"
                      )}
                    </td>

                    <td className="px-5 py-4 text-right text-gray-600">
                      Rp{" "}
                      {formatRupiah(
                        item.price
                      )}
                    </td>

                    <td className="px-5 py-4 text-right font-bold text-gray-800">
                      Rp{" "}
                      {formatRupiah(
                        item.subtotal
                      )}
                    </td>

                  </tr>
                )
              )}

            </tbody>

            <tfoot>

              <tr className="bg-[#F5F8F6]">

                <td
                  colSpan={5}
                  className="px-5 py-4 text-right font-bold text-[#35564C]"
                >
                  TOTAL
                </td>

                <td className="px-5 py-4 text-right text-lg font-bold text-[#18352D]">
                  Rp{" "}
                  {formatRupiah(
                    totalAmount
                  )}
                </td>

              </tr>

            </tfoot>

          </table>

        </div>

      </div>

    </div>
  );
}