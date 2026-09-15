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

type Purchase = {
  id: number;
  number: string;

  outletId: number;
  supplierId: number;

  status: string;
  total: number;

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

// =====================================================
// PAYMENT METHODS
// =====================================================

const PAYMENT_METHODS = [
  {
    value: "CASH",
    label: "Cash",
    description: "Bayar tunai dari Petty Cash Outlet",
    pettyCash: true,
  },
  {
    value: "COD",
    label: "COD",
    description: "Cash On Delivery",
    pettyCash: true,
  },
  {
    value: "CBD",
    label: "CBD",
    description: "Cash Before Delivery",
    pettyCash: true,
  },
  {
    value: "TRANSFER",
    label: "Transfer",
    description: "Pembayaran melalui transfer",
    pettyCash: false,
  },
  {
    value: "TEMPO",
    label: "Tempo",
    description: "Pembayaran dicatat sebagai hutang supplier",
    pettyCash: false,
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

  const [loading, setLoading] =
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
      new Date()
        .toISOString()
        .slice(0, 10)
    );

  // ===================================================
  // LOAD PURCHASE
  // ===================================================

  async function loadPurchase() {
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
            "Gagal mengambil Purchase Outlet"
        );
      }

      if (!json.data) {
        throw new Error(
          "Data Purchase Outlet tidak ditemukan"
        );
      }

      setPurchase(json.data);

      // Default amount = total PO
      setAmount(
        String(
          Math.round(
            Number(json.data.total || 0)
          )
        )
      );
    } catch (err) {
      console.error(
        "LOAD OUTLET PURCHASE PAYMENT:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data Purchase Outlet"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) {
      setError(
        "ID Purchase Outlet tidak valid"
      );
      setLoading(false);
      return;
    }

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

  const remaining = useMemo(() => {
    return Math.max(
      total - paymentAmount,
      0
    );
  }, [
    total,
    paymentAmount,
  ]);

  const overpayment = useMemo(() => {
    return Math.max(
      paymentAmount - total,
      0
    );
  }, [
    total,
    paymentAmount,
  ]);

  const selectedMethod =
    PAYMENT_METHODS.find(
      (item) =>
        item.value === method
    );

  const isPettyCashPayment =
    selectedMethod?.pettyCash === true;

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
        "Jumlah pembayaran harus lebih dari 0"
      );
      return;
    }

    // -----------------------------------------------
    // OVERPAYMENT
    // -----------------------------------------------

    if (
      numericAmount >
      total
    ) {
      setError(
        `Jumlah pembayaran tidak boleh lebih besar dari total PO (${formatRupiah(
          total
        )})`
      );
      return;
    }

    // -----------------------------------------------
    // CONFIRM
    // -----------------------------------------------

    const confirmText =
      isPettyCashPayment
        ? `Lakukan pembayaran ${formatRupiah(
            numericAmount
          )} dengan ${selectedMethod?.label}?\n\nPembayaran ini akan diproses dan untuk ${selectedMethod?.label}, Petty Cash Outlet akan otomatis berkurang.`
        : `Lakukan pembayaran ${formatRupiah(
            numericAmount
          )} dengan ${selectedMethod?.label}?`;

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
            "Pembayaran gagal"
        );
      }

      setSuccessMessage(
        json.message ||
          "Pembayaran Purchase Outlet berhasil"
      );

      // ---------------------------------------------
      // REDIRECT
      // ---------------------------------------------

      setTimeout(() => {
        router.push(
          `/outlet/purchase/${purchase.id}`
        );

        router.refresh();
      }, 700);
    } catch (err) {
      console.error(
        "OUTLET PURCHASE PAYMENT ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Gagal melakukan pembayaran"
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />

          <p className="text-sm text-gray-500">
            Memuat Purchase Outlet...
          </p>
        </div>
      </div>
    );
  }

  // ===================================================
  // ERROR / NOT FOUND
  // ===================================================

  if (!purchase) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="font-semibold text-red-700">
            Purchase Outlet tidak dapat dibuka
          </h2>

          <p className="mt-1 text-sm text-red-600">
            {error ||
              "Data Purchase Outlet tidak ditemukan"}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/outlet/purchase"
              )
            }
            className="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  // ===================================================
  // STATUS CHECK
  // ===================================================

  if (
    purchase.status !==
    "APPROVED"
  ) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/outlet/purchase/${purchase.id}`
              )
            }
            className="mb-4 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            ← Kembali ke Purchase Outlet
          </button>

          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6">
            <h2 className="text-lg font-semibold text-yellow-800">
              Purchase belum dapat dibayar
            </h2>

            <p className="mt-2 text-sm text-yellow-700">
              Pembayaran hanya dapat dilakukan
              setelah Purchase Outlet berstatus{" "}
              <strong>APPROVED</strong>.
            </p>

            <div className="mt-4 rounded-lg bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Nomor PO
                </span>

                <span className="font-semibold text-gray-900">
                  {purchase.number}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Status
                </span>

                <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                  {purchase.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===================================================
  // MAIN
  // ===================================================

  return (
    <div className="min-h-full p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        {/* ============================================
            HEADER
        ============================================ */}

        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/outlet/purchase/${purchase.id}`
                )
              }
              className="mb-2 text-sm font-medium text-gray-500 hover:text-gray-800"
            >
              ← Kembali ke Detail Purchase
            </button>

            <h1 className="text-2xl font-bold text-gray-900">
              Pembayaran Purchase Outlet
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Proses pembayaran Purchase Order Outlet
            </p>
          </div>

          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <div className="text-xs font-medium text-green-600">
              STATUS
            </div>

            <div className="mt-1 text-sm font-bold text-green-700">
              APPROVED
            </div>
          </div>
        </div>

        {/* ============================================
            ERROR
        ============================================ */}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="font-semibold text-red-700">
              Pembayaran gagal
            </div>

            <div className="mt-1 text-sm text-red-600">
              {error}
            </div>
          </div>
        )}

        {/* ============================================
            SUCCESS
        ============================================ */}

        {successMessage && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="font-semibold text-green-700">
              Pembayaran berhasil
            </div>

            <div className="mt-1 text-sm text-green-600">
              {successMessage}
            </div>

            <div className="mt-1 text-xs text-green-600">
              Mengarahkan kembali ke detail Purchase
              Outlet...
            </div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          {/* ==========================================
              LEFT
          ========================================== */}

          <div className="space-y-5">
            {/* PURCHASE INFO */}

            <div className="rounded-xl border bg-white shadow-sm">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold text-gray-900">
                  Informasi Purchase
                </h2>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-gray-500">
                    Nomor Purchase
                  </div>

                  <div className="mt-1 font-semibold text-gray-900">
                    {purchase.number}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">
                    Outlet
                  </div>

                  <div className="mt-1 font-semibold text-gray-900">
                    {purchase.outlet?.name ||
                      "-"}
                  </div>

                  {purchase.outlet?.code && (
                    <div className="text-xs text-gray-500">
                      {purchase.outlet.code}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-gray-500">
                    Supplier
                  </div>

                  <div className="mt-1 font-semibold text-gray-900">
                    {purchase.supplier?.name ||
                      "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">
                    Tanggal
                  </div>

                  <div className="mt-1 font-semibold text-gray-900">
                    {formatDate(
                      new Date()
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ITEMS */}

            <div className="rounded-xl border bg-white shadow-sm">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold text-gray-900">
                  Detail Barang
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">
                        Barang
                      </th>

                      <th className="px-4 py-3 text-right font-medium">
                        Qty
                      </th>

                      <th className="px-4 py-3 text-right font-medium">
                        Harga
                      </th>

                      <th className="px-4 py-3 text-right font-medium">
                        Subtotal
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {purchase.items.map(
                      (item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {item.barang
                                ?.name ||
                                "-"}
                            </div>

                            {item.barang
                              ?.code && (
                              <div className="text-xs text-gray-500">
                                {
                                  item
                                    .barang
                                    .code
                                }
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {item.qty}
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {formatRupiah(
                              Number(
                                item.price
                              )
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
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

              <div className="border-t bg-gray-50 px-5 py-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700">
                    Total Purchase
                  </span>

                  <span className="text-xl font-bold text-green-700">
                    {formatRupiah(
                      total
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ==========================================
              RIGHT - PAYMENT FORM
          ========================================== */}

          <div>
            <form
              onSubmit={
                handleSubmit
              }
              className="rounded-xl border bg-white shadow-sm"
            >
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold text-gray-900">
                  Form Pembayaran
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Isi data pembayaran Purchase Outlet
                </p>
              </div>

              <div className="space-y-5 p-5">
                {/* TOTAL */}

                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">
                    Total Purchase
                  </div>

                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {formatRupiah(
                      total
                    )}
                  </div>
                </div>

                {/* METHOD */}

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Metode Pembayaran
                  </label>

                  <select
                    value={method}
                    onChange={(e) =>
                      setMethod(
                        e.target.value
                      )
                    }
                    disabled={
                      submitting
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  >
                    {PAYMENT_METHODS.map(
                      (item) => (
                        <option
                          key={
                            item.value
                          }
                          value={
                            item.value
                          }
                        >
                          {item.label}
                        </option>
                      )
                    )}
                  </select>

                  {selectedMethod && (
                    <p className="mt-1.5 text-xs text-gray-500">
                      {
                        selectedMethod.description
                      }
                    </p>
                  )}
                </div>

                {/* PETTY CASH INFO */}

                {isPettyCashPayment && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex gap-2">
                      <div className="mt-0.5 text-amber-600">
                        ⚠
                      </div>

                      <div>
                        <div className="text-sm font-semibold text-amber-800">
                          Petty Cash Outlet
                        </div>

                        <p className="mt-1 text-xs leading-5 text-amber-700">
                          Pembayaran{" "}
                          <strong>
                            {
                              selectedMethod?.label
                            }
                          </strong>{" "}
                          akan otomatis dicatat
                          sebagai pengeluaran
                          Petty Cash Outlet.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* AMOUNT */}

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Jumlah Pembayaran
                  </label>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                      Rp
                    </span>

                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={amount}
                      onChange={(e) =>
                        setAmount(
                          e.target.value
                        )
                      }
                      disabled={
                        submitting
                      }
                      className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    />
                  </div>

                  <div className="mt-1 flex justify-between text-xs">
                    <span className="text-gray-500">
                      Maksimal:
                    </span>

                    <span className="font-medium text-gray-700">
                      {formatRupiah(
                        total
                      )}
                    </span>
                  </div>
                </div>

                {/* SUMMARY */}

                <div className="rounded-lg border bg-white">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <span className="text-sm text-gray-500">
                      Total PO
                    </span>

                    <span className="font-medium text-gray-900">
                      {formatRupiah(
                        total
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <span className="text-sm text-gray-500">
                      Dibayar
                    </span>

                    <span className="font-semibold text-green-700">
                      {formatRupiah(
                        paymentAmount
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium text-gray-700">
                      Sisa
                    </span>

                    <span
                      className={`font-bold ${
                        remaining === 0
                          ? "text-green-700"
                          : "text-orange-600"
                      }`}
                    >
                      {formatRupiah(
                        remaining
                      )}
                    </span>
                  </div>
                </div>

                {/* REFERENCE */}

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Nomor Referensi
                    <span className="ml-1 font-normal text-gray-400">
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                {/* DATE */}

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
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
                      submitting
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                {/* REMARKS */}

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Keterangan
                    <span className="ml-1 font-normal text-gray-400">
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
                    placeholder="Keterangan pembayaran..."
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                {/* OVERPAYMENT WARNING */}

                {overpayment > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    Jumlah pembayaran melebihi
                    total Purchase.
                  </div>
                )}

                {/* SUBMIT */}

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    paymentAmount <= 0 ||
                    paymentAmount > total
                  }
                  className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {submitting
                    ? "Memproses Pembayaran..."
                    : `Bayar ${formatRupiah(
                        paymentAmount
                      )}`}
                </button>

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
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}