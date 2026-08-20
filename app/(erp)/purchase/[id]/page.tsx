"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Edit,
  FileSpreadsheet,
  FileText,
  PackageCheck,
  Printer,
  Trash2,
  Truck,
  CreditCard,
  X,
  Loader2,
} from "lucide-react";

import { exportPurchasePDF } from "@/lib/exportPurchasePdf";
import { exportPurchaseExcel } from "@/lib/exportPurchaseExcel";
import PurchaseComments from "@/components/PurchaseComments";

export default function DetailPurchase() {
  const params = useParams();
  const router = useRouter();

  const [purchase, setPurchase] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(true);

  const [deleting, setDeleting] =
    useState(false);

  const [canDelete, setCanDelete] =
    useState(false);

  // =====================================================
  // PAYMENT STATE
  // =====================================================

  const [showPaymentModal, setShowPaymentModal] =
    useState(false);

  const [processingPayment, setProcessingPayment] =
    useState(false);

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState("");

  const [referenceNumber, setReferenceNumber] =
    useState("");

  const [paymentRemarks, setPaymentRemarks] =
    useState("");

  const [paymentDate, setPaymentDate] =
    useState("");

  // =====================================================
  // LOAD PURCHASE
  // =====================================================

  async function loadPurchase() {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/purchase/${params.id}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (json.success) {
        setPurchase(json.data);

        setCanDelete(
          json.access?.canDelete === true
        );
      } else {
        setPurchase(null);
        setCanDelete(false);
      }
    } catch (error) {
      console.error(
        "LOAD PURCHASE ERROR:",
        error
      );

      setPurchase(null);
      setCanDelete(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (params.id) {
      loadPurchase();
    }
  }, [params.id]);

  // =====================================================
  // DELETE PURCHASE
  // =====================================================

  async function deletePurchase() {
    if (!purchase) return;

    if (!canDelete) {
      alert(
        "Hanya Admin Pusat yang dapat menghapus Purchase Order."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Hapus Purchase Order ${purchase.number}?\n\nData PO beserta itemnya akan dihapus dan tidak dapat dikembalikan.`
      );

    if (!confirmed) return;

    try {
      setDeleting(true);

      const res = await fetch(
        `/api/purchase/${purchase.id}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      if (json.success) {
        alert(
          "Purchase Order berhasil dihapus"
        );

        router.push("/purchase");
        router.refresh();
      } else {
        alert(
          json.message ||
            "Gagal menghapus Purchase Order"
        );
      }
    } catch (error) {
      console.error(
        "DELETE PURCHASE ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menghapus Purchase Order"
      );
    } finally {
      setDeleting(false);
    }
  }

  // =====================================================
  // FORMAT
  // =====================================================

  function formatRupiah(value: any) {
    return Number(
      value || 0
    ).toLocaleString("id-ID");
  }

  function formatDate(value: any) {
    if (!value) return "-";

    const date = new Date(value);

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
        month: "long",
        year: "numeric",
      }
    );
  }

  function getTodayDate() {
    const now = new Date();

    const year =
      now.getFullYear();

    const month =
      String(
        now.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        now.getDate()
      ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getStatusClass(
    status: string
  ) {
    switch (status) {
      case "DRAFT":
        return "bg-amber-100 text-amber-700";

      case "APPROVED":
        return "bg-blue-100 text-blue-700";

      case "RECEIVED":
        return "bg-green-100 text-green-700";

      case "COMPLETED":
        return "bg-purple-100 text-purple-700";

      case "CANCELLED":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  // =====================================================
  // PAYMENT
  // =====================================================

  const purchasePaymentMethod =
    String(
      purchase?.paymentMethod || ""
    ).toUpperCase();

  const canPayment =
    purchase &&
    purchase.status !== "DRAFT" &&
    purchase.status !== "COMPLETED" &&
    purchase.status !== "CANCELLED";

  function openPaymentModal() {
    if (!purchase) return;

    const method =
      String(
        purchase.paymentMethod || ""
      ).toUpperCase();

    setPaymentAmount(
      String(
        Number(
          purchase.total || 0
        )
      )
    );

    setPaymentMethod(method);

    setReferenceNumber("");

    setPaymentRemarks("");

    setPaymentDate(
      getTodayDate()
    );

    setShowPaymentModal(true);
  }

  function closePaymentModal() {
    if (processingPayment) return;

    setShowPaymentModal(false);
  }

  async function processPurchasePayment() {
    if (!purchase) return;

    const amount =
      Number(
        String(
          paymentAmount
        ).replace(
          /[^0-9.-]/g,
          ""
        )
      );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      alert(
        "Jumlah pembayaran tidak valid."
      );

      return;
    }

    const total =
      Number(
        purchase.total || 0
      );

    if (
      Math.abs(
        amount - total
      ) > 0.01
    ) {
      alert(
        `Jumlah pembayaran harus sama dengan total Purchase.\n\nTotal Purchase: Rp ${formatRupiah(
          total
        )}`
      );

      return;
    }

    if (!paymentMethod) {
      alert(
        "Metode pembayaran belum dipilih."
      );

      return;
    }

    if (
      paymentMethod ===
        "TRANSFER" &&
      !referenceNumber.trim()
    ) {
      alert(
        "Nomor referensi wajib diisi untuk pembayaran Transfer."
      );

      return;
    }

    if (!paymentDate) {
      alert(
        "Tanggal pembayaran wajib diisi."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Proses pembayaran Purchase ${purchase.number}?\n\nMetode: ${paymentMethod}\nJumlah: Rp ${formatRupiah(
          amount
        )}`
      );

    if (!confirmed) return;

    try {
      setProcessingPayment(true);

      const res = await fetch(
        `/api/purchase/${purchase.id}/payment`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            amount,

            method:
              paymentMethod,

            referenceNumber:
              referenceNumber.trim() ||
              null,

            remarks:
              paymentRemarks.trim() ||
              null,

            paymentDate,
          }),
        }
      );

      const json =
        await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal melakukan pembayaran Purchase."
        );
      }

      alert(
        json.message ||
          "Pembayaran Purchase berhasil."
      );

      setShowPaymentModal(false);

      await loadPurchase();

      router.refresh();
    } catch (error) {
      console.error(
        "PAYMENT PURCHASE ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat melakukan pembayaran."
      );
    } finally {
      setProcessingPayment(false);
    }
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-[#DDE9E4] border-t-[#497F70]" />

            <p className="text-sm text-gray-500">
              Loading Purchase Order...
            </p>
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
        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-10 text-center shadow-sm">
          <FileText
            size={42}
            className="mx-auto mb-4 text-gray-300"
          />

          <h2 className="text-lg font-bold text-gray-700">
            Purchase Order tidak ditemukan
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Data Purchase Order yang kamu cari tidak tersedia.
          </p>

          <button
            onClick={() =>
              router.push("/purchase")
            }
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3D6D60]"
          >
            <ArrowLeft size={16} />
            Kembali ke Purchase
          </button>
        </div>
      </div>
    );
  }

  const totalItem =
    purchase.items?.length ?? 0;

  const totalQty =
    purchase.items?.reduce(
      (
        sum: number,
        item: any
      ) =>
        sum +
        Number(
          item.qty || 0
        ),
      0
    ) ?? 0;

  const totalNilai =
    Number(
      purchase.total ?? 0
    );

  const supplier =
    purchase.supplier?.name ??
    "-";

  const isDraft =
    purchase.status ===
    "DRAFT";

  const isApproved =
    purchase.status ===
    "APPROVED";

  const isReceived =
    purchase.status ===
    "RECEIVED";

  const statusOrder = [
    "DRAFT",
    "APPROVED",
    "RECEIVED",
    "COMPLETED",
  ];

  const currentStatusIndex =
    statusOrder.indexOf(
      purchase.status
    );

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <ShoppingCartIcon />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Detail Purchase Order
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              {purchase.number}
            </p>
          </div>

        </div>

        {/* ===================================================
            ACTIONS
        =================================================== */}

        <div className="flex flex-wrap gap-2">

          {/* EDIT */}

          {isDraft && (
            <button
              onClick={() =>
                router.push(
                  `/purchase/${purchase.id}/edit`
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              <Edit size={16} />
              Edit
            </button>
          )}

          {/* DELETE - ADMIN PUSAT ONLY */}

          {isDraft &&
            canDelete && (
              <button
                onClick={
                  deletePurchase
                }
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={16} />

                {deleting
                  ? "Menghapus..."
                  : "Hapus"}
              </button>
            )}

          {/* =================================================
              PAYMENT
          ================================================= */}

          {canPayment && (
            <button
              onClick={
                openPaymentModal
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <CreditCard size={16} />
              Payment
            </button>
          )}

          {/* EXPORT PDF */}

          <button
            onClick={() =>
              exportPurchasePDF(
                purchase
              )
            }
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
          >
            <FileText size={16} />
            PDF
          </button>

          {/* EXPORT EXCEL */}

          <button
            onClick={() =>
              exportPurchaseExcel(
                purchase
              )
            }
            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            <FileSpreadsheet size={16} />
            Excel
          </button>

          {/* PRINT */}

          <a
            href={`/purchase/print?id=${purchase.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Printer size={16} />
            Print
          </a>

          {/* RECEIVE */}

          {isApproved && (
            <a
              href={`/barang-masuk/create?purchaseId=${purchase.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3D6D60]"
            >
              <PackageCheck size={16} />
              Receive Barang
            </a>
          )}

          {/* BARANG MASUK */}

          {isReceived && (
            <a
              href="/barang-masuk"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <PackageCheck size={16} />
              Lihat Barang Masuk
            </a>
          )}

          {/* BACK */}

          <button
            onClick={() =>
              router.push("/purchase")
            }
            className="inline-flex items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-[#F5F8F6]"
          >
            <ArrowLeft size={16} />
            Kembali
          </button>

        </div>
      </div>

      {/* =====================================================
          INFO WARNING DRAFT
      ===================================================== */}

      {isDraft && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">

          <Clock3
            size={20}
            className="mt-0.5 shrink-0 text-amber-600"
          />

          <div>
            <p className="font-semibold text-amber-800">
              Purchase Order masih Draft
            </p>

            <p className="mt-1 text-sm text-amber-700">
              PO masih dapat diedit.
              {canDelete
                ? " Sebagai Admin Pusat, PO juga dapat dihapus."
                : " Penghapusan PO hanya dapat dilakukan oleh Admin Pusat."}
              {" "}Setelah di-approve, data PO tidak dapat diubah atau dihapus.
            </p>
          </div>

        </div>
      )}

      {/* =====================================================
          PAYMENT METHOD INFO
      ===================================================== */}

      {purchasePaymentMethod && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CreditCard size={19} />
            </div>

            <div>
              <p className="text-xs font-medium text-emerald-700">
                Metode Pembayaran Purchase
              </p>

              <p className="mt-0.5 font-bold text-emerald-900">
                {purchasePaymentMethod}
              </p>
            </div>

          </div>

        </div>
      )}

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* SUPPLIER */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div className="min-w-0">

              <p className="text-sm text-gray-500">
                Supplier
              </p>

              <p className="mt-2 truncate text-lg font-bold text-[#18352D]">
                {supplier}
              </p>

            </div>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Truck size={21} />
            </div>

          </div>

        </div>

        {/* ITEM */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-gray-500">
                Jumlah Item
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {totalItem}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileText size={21} />
            </div>

          </div>

        </div>

        {/* QTY */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-gray-500">
                Total Qty
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {formatRupiah(
                  totalQty
                )}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
              <PackageCheck size={21} />
            </div>

          </div>

        </div>

        {/* NILAI */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div className="min-w-0">

              <p className="text-sm text-gray-500">
                Nilai Purchase
              </p>

              <p className="mt-1 truncate text-lg font-bold text-[#18352D]">
                Rp{" "}
                {formatRupiah(
                  totalNilai
                )}
              </p>

            </div>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <FileText size={21} />
            </div>

          </div>

        </div>

      </div>

      {/* =====================================================
          STATUS TIMELINE
      ===================================================== */}

      <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white p-6 shadow-sm">

        <div className="mb-6 flex items-center justify-between">

          <div>
            <h2 className="font-bold text-lg text-[#18352D]">
              Status Purchase Order
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Progress Purchase Order
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${getStatusClass(
              purchase.status
            )}`}
          >
            {purchase.status}
          </span>

        </div>

        <div className="overflow-x-auto">

          <div className="flex min-w-[600px] items-start">

            {[
              {
                name: "DRAFT",
                label: "Draft",
              },
              {
                name: "APPROVED",
                label: "Approved",
              },
              {
                name: "RECEIVED",
                label: "Received",
              },
              {
                name: "COMPLETED",
                label: "Completed",
              },
            ].map(
              (
                step,
                index
              ) => {

                const active =
                  index <=
                  currentStatusIndex;

                const isLast =
                  index === 3;

                return (
                  <div
                    key={
                      step.name
                    }
                    className="relative flex flex-1 flex-col items-center"
                  >

                    <div className="flex w-full items-center">

                      <div
                        className={`h-1 flex-1 ${
                          index === 0
                            ? "bg-transparent"
                            : active
                            ? "bg-[#497F70]"
                            : "bg-gray-200"
                        }`}
                      />

                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          active
                            ? "bg-[#497F70] text-white"
                            : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {active ? (
                          <CheckCircle2
                            size={19}
                          />
                        ) : (
                          index + 1
                        )}
                      </div>

                      <div
                        className={`h-1 flex-1 ${
                          isLast
                            ? "bg-transparent"
                            : active &&
                              index <
                                currentStatusIndex
                            ? "bg-[#497F70]"
                            : "bg-gray-200"
                        }`}
                      />

                    </div>

                    <p
                      className={`mt-3 text-sm font-semibold ${
                        active
                          ? "text-[#18352D]"
                          : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </p>

                  </div>
                );
              }
            )}

          </div>

        </div>

      </div>

      {/* =====================================================
          INFORMATION
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* PURCHASE */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-6 shadow-sm">

          <h2 className="mb-5 text-lg font-bold text-[#18352D]">
            Informasi Purchase
          </h2>

          <div className="space-y-3 text-sm">

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                No PO
              </span>

              <span className="text-gray-700">
                : {purchase.number}
              </span>
            </div>

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                Tanggal
              </span>

              <span className="text-gray-700">
                :{" "}
                {formatDate(
                  purchase.purchaseDate
                )}
              </span>
            </div>

            <div className="flex items-center">
              <span className="w-32 font-semibold text-gray-600">
                Status
              </span>

              <span>
                :{" "}
                <span
                  className={`ml-2 rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
                    purchase.status
                  )}`}
                >
                  {purchase.status}
                </span>
              </span>
            </div>

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                Metode
              </span>

              <span className="font-semibold text-[#18352D]">
                :{" "}
                {purchase.paymentMethod ||
                  "-"}
              </span>
            </div>

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                Total
              </span>

              <span className="font-bold text-[#18352D]">
                : Rp{" "}
                {formatRupiah(
                  purchase.total
                )}
              </span>
            </div>

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                Keterangan
              </span>

              <span className="text-gray-700">
                :{" "}
                {purchase.remarks ||
                  "-"}
              </span>
            </div>

          </div>

        </div>

        {/* SUPPLIER */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-6 shadow-sm">

          <h2 className="mb-5 text-lg font-bold text-[#18352D]">
            Informasi Supplier
          </h2>

          <div className="space-y-3 text-sm">

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                Nama
              </span>

              <span className="text-gray-700">
                :{" "}
                {purchase.supplier
                  ?.name ||
                  "-"}
              </span>
            </div>

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                PIC
              </span>

              <span className="text-gray-700">
                :{" "}
                {purchase.supplier
                  ?.contactPerson ||
                  "-"}
              </span>
            </div>

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                Telepon
              </span>

              <span className="text-gray-700">
                :{" "}
                {purchase.supplier
                  ?.phone ||
                  "-"}
              </span>
            </div>

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                Email
              </span>

              <span className="break-all text-gray-700">
                :{" "}
                {purchase.supplier
                  ?.email ||
                  "-"}
              </span>
            </div>

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                Alamat
              </span>

              <span className="text-gray-700">
                :{" "}
                {purchase.supplier
                  ?.address ||
                  "-"}
              </span>
            </div>

          </div>

        </div>

      </div>

      {/* =====================================================
          DETAIL BARANG
      ===================================================== */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        <div className="border-b border-[#E5ECE9] px-5 py-5">

          <h2 className="text-lg font-bold text-[#18352D]">
            Detail Barang Purchase
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Daftar barang yang terdapat dalam Purchase Order
          </p>

        </div>

        <div className="overflow-x-auto">

          <table className="min-w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Kode
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Nama Barang
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Satuan
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
                (
                  item: any,
                  index: number
                ) => {

                  const subtotal =
                    Number(
                      item.qty || 0
                    ) *
                    Number(
                      item.price || 0
                    );

                  return (
                    <tr
                      key={
                        item.id
                      }
                      className="border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                    >

                      <td className="px-5 py-4 text-center text-gray-500">
                        {index + 1}
                      </td>

                      <td className="px-5 py-4 font-medium text-gray-700">
                        {item.barang
                          ?.code ||
                          "-"}
                      </td>

                      <td className="px-5 py-4 font-medium text-[#18352D]">
                        {item.barang
                          ?.name ||
                          "-"}
                      </td>

                      <td className="px-5 py-4 text-center text-gray-600">
                        {item.barang
                          ?.unit ||
                          "-"}
                      </td>

                      <td className="px-5 py-4 text-right font-semibold text-gray-700">
                        {formatRupiah(
                          item.qty
                        )}
                      </td>

                      <td className="px-5 py-4 text-right text-gray-600">
                        Rp{" "}
                        {formatRupiah(
                          item.price
                        )}
                      </td>

                      <td className="px-5 py-4 text-right font-semibold text-[#18352D]">
                        Rp{" "}
                        {formatRupiah(
                          subtotal
                        )}
                      </td>

                    </tr>
                  );
                }
              )}

              {(!purchase.items ||
                purchase.items
                  .length ===
                  0) && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-gray-400"
                  >
                    Tidak ada item Purchase.
                  </td>
                </tr>
              )}

            </tbody>

            <tfoot>

              <tr className="bg-[#F5F8F6]">

                <td
                  colSpan={4}
                  className="px-5 py-4 text-right font-bold text-[#35564C]"
                >
                  TOTAL
                </td>

                <td className="px-5 py-4 text-right font-bold text-[#18352D]">
                  {formatRupiah(
                    totalQty
                  )}
                </td>

                <td />

                <td className="px-5 py-4 text-right text-lg font-bold text-[#18352D]">
                  Rp{" "}
                  {formatRupiah(
                    totalNilai
                  )}
                </td>

              </tr>

            </tfoot>

          </table>

        </div>

      </div>

      {/* =====================================================
          PURCHASE COMMENTS
      ===================================================== */}

      <div className="mt-6">
        <PurchaseComments
          purchaseId={purchase.id}
          source="PUSAT"
        />
      </div>

      {/* =====================================================
          BOTTOM ACTION
      ===================================================== */}

      <div className="mt-6 flex flex-wrap justify-end gap-2">

        {isDraft && (
          <>
            <button
              onClick={() =>
                router.push(
                  `/purchase/${purchase.id}/edit`
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-600"
            >
              <Edit size={17} />
              Edit Purchase
            </button>

            {canDelete && (
              <button
                onClick={
                  deletePurchase
                }
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 size={17} />

                {deleting
                  ? "Menghapus..."
                  : "Hapus Purchase"}
              </button>
            )}
          </>
        )}

        {canPayment && (
          <button
            onClick={
              openPaymentModal
            }
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <CreditCard size={17} />
            Payment Purchase
          </button>
        )}

        <button
          onClick={() =>
            router.push("/purchase")
          }
          className="inline-flex items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-[#F5F8F6]"
        >
          <ArrowLeft size={17} />
          Kembali
        </button>

      </div>

      {/* =====================================================
          PAYMENT MODAL
      ===================================================== */}

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <CreditCard size={20} />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-[#18352D]">
                    Payment Purchase
                  </h2>

                  <p className="text-xs text-gray-500">
                    {purchase.number}
                  </p>
                </div>

              </div>

              <button
                type="button"
                onClick={
                  closePaymentModal
                }
                disabled={
                  processingPayment
                }
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              >
                <X size={20} />
              </button>

            </div>

            {/* MODAL BODY */}

            <div className="space-y-5 p-6">

              {/* TOTAL */}

              <div className="rounded-xl border border-[#DDE9E4] bg-[#F5F8F6] p-4">

                <div className="flex items-center justify-between">

                  <span className="text-sm text-gray-600">
                    Total Purchase
                  </span>

                  <span className="text-xl font-bold text-[#18352D]">
                    Rp{" "}
                    {formatRupiah(
                      purchase.total
                    )}
                  </span>

                </div>

              </div>

              {/* METHOD */}

              <div>

                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Metode Pembayaran
                </label>

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
                    processingPayment
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10 disabled:bg-gray-100"
                >

                  <option value="">
                    Pilih metode pembayaran
                  </option>

                  <option value="CASH">
                    CASH
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

              </div>

              {/* AMOUNT */}

              <div>

                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Jumlah Pembayaran
                </label>

                <div className="relative">

                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">
                    Rp
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      paymentAmount
                    }
                    onChange={(e) =>
                      setPaymentAmount(
                        e.target.value
                      )
                    }
                    disabled={
                      processingPayment
                    }
                    className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-12 pr-4 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10 disabled:bg-gray-100"
                  />

                </div>

                <p className="mt-1 text-xs text-gray-400">
                  Jumlah harus sama dengan total Purchase.
                </p>

              </div>

              {/* PAYMENT DATE */}

              <div>

                <label className="mb-2 block text-sm font-semibold text-gray-700">
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
                    processingPayment
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10 disabled:bg-gray-100"
                />

              </div>

              {/* REFERENCE */}

              {paymentMethod ===
                "TRANSFER" && (
                <div>

                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Nomor Referensi Transfer
                    <span className="ml-1 text-red-500">
                      *
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
                    placeholder="Masukkan nomor referensi / bukti transfer"
                    disabled={
                      processingPayment
                    }
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10 disabled:bg-gray-100"
                  />

                </div>
              )}

              {/* REMARKS */}

              <div>

                <label className="mb-2 block text-sm font-semibold text-gray-700">
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
                  rows={3}
                  placeholder="Keterangan pembayaran (opsional)"
                  disabled={
                    processingPayment
                  }
                  className="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10 disabled:bg-gray-100"
                />

              </div>

              {/* INFO */}

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">

                {paymentMethod ===
                  "TEMPO" ? (
                  <p>
                    <strong>TEMPO:</strong>{" "}
                    pembayaran tidak membuat
                    Petty Cash. Sistem akan
                    membuat Purchase Payable.
                  </p>
                ) : paymentMethod ===
                  "TRANSFER" ? (
                  <p>
                    <strong>TRANSFER:</strong>{" "}
                    pembayaran akan dicatat
                    sebagai Payment tanpa
                    mengurangi Petty Cash.
                  </p>
                ) : (
                  <p>
                    <strong>
                      {paymentMethod ||
                        "CASH/COD/CBD"}:
                    </strong>{" "}
                    pembayaran akan dicatat
                    sebagai Payment dan
                    mengurangi Petty Cash.
                  </p>
                )}

              </div>

            </div>

            {/* MODAL FOOTER */}

            <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">

              <button
                type="button"
                onClick={
                  closePaymentModal
                }
                disabled={
                  processingPayment
                }
                className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={
                  processPurchasePayment
                }
                disabled={
                  processingPayment
                }
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >

                {processingPayment ? (
                  <>
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                    Memproses...
                  </>
                ) : (
                  <>
                    <CreditCard
                      size={17}
                    />
                    Proses Payment
                  </>
                )}

              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

/* =========================================================
   ICON HELPER
========================================================= */

function ShoppingCartIcon() {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="9"
        cy="20"
        r="1"
      />

      <circle
        cx="20"
        cy="20"
        r="1"
      />

      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}