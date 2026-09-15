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
  Wallet,
  AlertCircle,
} from "lucide-react";

import { exportPurchasePDF } from "@/lib/exportPurchasePdf";
import { exportPurchaseExcel } from "@/lib/exportPurchaseExcel";
import { buildWhatsAppPurchaseUrl } from "@/lib/whatsapp";
import PurchaseComments from "@/components/PurchaseComments";

export default function DetailPurchase() {
  const params = useParams();
  const router = useRouter();

  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

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

    const confirmed = window.confirm(
      `Hapus Purchase Order ${purchase.number}?\n\nData PO beserta itemnya akan dihapus dan tidak dapat dikembalikan.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);

      const res = await fetch(
        `/api/purchase/${purchase.id}?source=PUSAT`,
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
  // WHATSAPP PURCHASE ORDER
  // =====================================================

  function sendPurchaseWhatsApp() {
    if (!purchase) return;

    try {
      const whatsappUrl =
        buildWhatsAppPurchaseUrl(
          purchase
        );

      window.open(
        whatsappUrl,
        "MGB_WHATSAPP",
        "noopener,noreferrer"
      );
    } catch (error) {
      console.error(
        "WHATSAPP PURCHASE ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Gagal membuka WhatsApp untuk Purchase Order."
      );
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
  // PAYMENT / PAYABLE DATA
  // =====================================================

  const purchasePaymentMethod =
    String(
      purchase?.paymentMethod || ""
    )
      .trim()
      .toUpperCase();

  const payable =
    purchase?.purchasePayable ??
    purchase?.payable ??
    purchase?.PurchasePayable ??
    null;

  const payableAmount =
    Number(
      payable?.amount ??
        purchase?.total ??
        0
    );

  const payablePaidAmount =
    Number(
      payable?.paidAmount ??
        0
    );

  const payableOutstanding =
    Number(
      payable?.outstanding ??
        Math.max(
          0,
          payableAmount -
            payablePaidAmount
        )
    );

  const payableStatus =
    String(
      payable?.status || ""
    )
      .trim()
      .toUpperCase();

  // =====================================================
  // PAYMENT BUSINESS RULE
  // =====================================================

  const isTempoPurchase =
    purchasePaymentMethod ===
    "TEMPO";

  const hasPayable =
    isTempoPurchase &&
    !!payable;

  const hasOutstanding =
    hasPayable &&
    payableOutstanding >
      0.01 &&
    payableStatus !==
      "PAID";

  const isTempoInitialPayment =
    isTempoPurchase &&
    !hasPayable;

  const isTempoSettlement =
    isTempoPurchase &&
    hasPayable &&
    hasOutstanding;

  const isTempoPaid =
    isTempoPurchase &&
    hasPayable &&
    !hasOutstanding;

  const pettyCashPaymentMethods = [
    "CASH",
    "COD",
    "CBD",
  ];

  const settlementMethods = [
    "CASH",
    "TRANSFER",
    "COD",
    "CBD",
  ];

  // =====================================================
  // PAYMENT BUTTON
  // =====================================================

  const canPayment =
    !!purchase &&
    purchase.status !== "DRAFT" &&
    purchase.status !== "COMPLETED" &&
    purchase.status !== "CANCELLED" &&
    !!purchasePaymentMethod &&
    (
      !isTempoPurchase ||
      isTempoInitialPayment ||
      isTempoSettlement
    );

  // =====================================================
  // PAYMENT LABEL
  // =====================================================

  const paymentButtonLabel =
    isTempoInitialPayment
      ? "Buat Hutang TEMPO"
      : isTempoSettlement
      ? "Bayar Hutang"
      : "Payment";

  // =====================================================
  // PAYMENT MODAL TITLE
  // =====================================================

  const paymentModalTitle =
    isTempoInitialPayment
      ? "Buat Purchase Payable"
      : isTempoSettlement
      ? "Pelunasan Purchase"
      : "Payment Purchase";

  // =====================================================
  // OPEN PAYMENT MODAL
  // =====================================================

  function openPaymentModal() {
    if (!purchase) return;

    const method =
      String(
        purchase.paymentMethod || ""
      )
        .trim()
        .toUpperCase();

    if (!method) {
      alert(
        "Purchase belum memiliki metode pembayaran."
      );

      return;
    }

    if (
      purchase.status ===
      "COMPLETED"
    ) {
      alert(
        "Purchase ini sudah COMPLETED dan tidak dapat diproses Payment lagi."
      );

      return;
    }

    if (
      method === "TEMPO" &&
      hasPayable &&
      !hasOutstanding
    ) {
      alert(
        "Purchase Payable ini sudah lunas."
      );

      return;
    }

    if (
      method === "TEMPO" &&
      !hasPayable
    ) {
      setPaymentAmount(
        String(
          Number(
            purchase.total || 0
          )
        )
      );

      setPaymentMethod(
        "TEMPO"
      );

      setReferenceNumber("");
      setPaymentRemarks("");

      setPaymentDate(
        getTodayDate()
      );

      setShowPaymentModal(true);

      return;
    }

    if (
      method === "TEMPO" &&
      hasPayable &&
      hasOutstanding
    ) {
      setPaymentAmount(
        String(
          payableOutstanding
        )
      );

      setPaymentMethod(
        "TRANSFER"
      );

      setReferenceNumber("");
      setPaymentRemarks("");

      setPaymentDate(
        getTodayDate()
      );

      setShowPaymentModal(true);

      return;
    }

    setPaymentAmount(
      String(
        Number(
          purchase.total || 0
        )
      )
    );

    setPaymentMethod(
      method
    );

    setReferenceNumber("");
    setPaymentRemarks("");

    setPaymentDate(
      getTodayDate()
    );

    setShowPaymentModal(true);
  }

  // =====================================================
  // CLOSE PAYMENT MODAL
  // =====================================================

  function closePaymentModal() {
    if (processingPayment) return;

    setShowPaymentModal(false);
  }

  // =====================================================
  // PROCESS PAYMENT
  // =====================================================

  async function processPurchasePayment() {
    if (!purchase) return;

    const purchaseMethod =
      String(
        purchase.paymentMethod || ""
      )
        .trim()
        .toUpperCase();

    const selectedMethod =
      String(
        paymentMethod || ""
      )
        .trim()
        .toUpperCase();

    if (!purchaseMethod) {
      alert(
        "Purchase belum memiliki metode pembayaran."
      );

      return;
    }

    if (!selectedMethod) {
      alert(
        "Metode pembayaran wajib dipilih."
      );

      return;
    }

    if (
      purchase.status ===
      "DRAFT"
    ) {
      alert(
        "Purchase Order masih DRAFT. Payment belum dapat diproses."
      );

      return;
    }

    if (
      purchase.status ===
      "COMPLETED"
    ) {
      alert(
        "Purchase Order sudah COMPLETED. Payment tidak dapat diproses lagi."
      );

      return;
    }

    if (
      purchase.status ===
      "CANCELLED"
    ) {
      alert(
        "Purchase Order CANCELLED. Payment tidak dapat diproses."
      );

      return;
    }

    if (
      purchaseMethod ===
        "TEMPO" &&
      !hasPayable
    ) {
      if (
        selectedMethod !==
        "TEMPO"
      ) {
        alert(
          "Untuk pembuatan Purchase Payable pertama, metode harus TEMPO."
        );

        setPaymentMethod(
          "TEMPO"
        );

        return;
      }
    }

    if (
      purchaseMethod ===
        "TEMPO" &&
      hasPayable
    ) {
      if (!hasOutstanding) {
        alert(
          "Purchase Payable ini sudah lunas."
        );

        return;
      }

      if (
        !settlementMethods.includes(
          selectedMethod
        )
      ) {
        alert(
          "Pelunasan hutang TEMPO hanya dapat menggunakan CASH, TRANSFER, COD, atau CBD."
        );

        return;
      }
    }

    if (
      purchaseMethod !==
        "TEMPO" &&
      selectedMethod !==
        purchaseMethod
    ) {
      alert(
        `Metode pembayaran tidak boleh berbeda dari Purchase.\n\nMetode Purchase: ${purchaseMethod}`
      );

      setPaymentMethod(
        purchaseMethod
      );

      return;
    }

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

    if (
      purchaseMethod ===
        "TEMPO" &&
      !hasPayable
    ) {
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
          `Jumlah untuk pembuatan Purchase Payable harus sama dengan total Purchase.\n\nTotal Purchase: Rp ${formatRupiah(
            total
          )}`
        );

        return;
      }
    }

    if (
      purchaseMethod ===
        "TEMPO" &&
      hasPayable
    ) {
      if (
        amount >
        payableOutstanding +
          0.01
      ) {
        alert(
          `Jumlah pembayaran tidak boleh melebihi outstanding.\n\nOutstanding: Rp ${formatRupiah(
            payableOutstanding
          )}`
        );

        return;
      }
    }

    if (
      purchaseMethod !==
        "TEMPO"
    ) {
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
    }

    if (
      selectedMethod ===
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

    let confirmMessage = "";

    if (
      purchaseMethod ===
        "TEMPO" &&
      !hasPayable
    ) {
      confirmMessage =
        `Buat Purchase Payable ${purchase.number}?\n\n` +
        `Metode: TEMPO\n` +
        `Nilai Hutang: Rp ${formatRupiah(
          amount
        )}\n\n` +
        `Tidak ada pengeluaran Petty Cash.`;
    } else if (
      purchaseMethod ===
        "TEMPO"
    ) {
      const remaining =
        Math.max(
          0,
          payableOutstanding -
            amount
        );

      const cashImpact =
        pettyCashPaymentMethods.includes(
          selectedMethod
        );

      confirmMessage =
        `Proses pelunasan Purchase ${purchase.number}?\n\n` +
        `Metode: ${selectedMethod}\n` +
        `Pembayaran: Rp ${formatRupiah(
          amount
        )}\n` +
        `Outstanding sebelum: Rp ${formatRupiah(
          payableOutstanding
        )}\n` +
        `Sisa setelah pembayaran: Rp ${formatRupiah(
          remaining
        )}\n\n` +
        (
          cashImpact
            ? `Petty Cash akan berkurang Rp ${formatRupiah(
                amount
              )}.`
            : "Petty Cash tidak berkurang karena pembayaran menggunakan TRANSFER."
        );
    } else {
      const cashImpact =
        pettyCashPaymentMethods.includes(
          selectedMethod
        );

      confirmMessage =
        `Proses pembayaran Purchase ${purchase.number}?\n\n` +
        `Metode: ${selectedMethod}\n` +
        `Jumlah: Rp ${formatRupiah(
          amount
        )}\n\n` +
        (
          cashImpact
            ? `Petty Cash akan berkurang Rp ${formatRupiah(
                amount
              )}.`
            : "Petty Cash tidak berkurang karena pembayaran menggunakan TRANSFER."
        );
    }

    const confirmed =
      window.confirm(
        confirmMessage
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
              selectedMethod,
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

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Gagal melakukan pembayaran Purchase."
        );
      }

      if (
        json.data?.type ===
        "PAYABLE"
      ) {
        const resultPayable =
          json.data?.payable;

        alert(
          `Purchase Payable berhasil dibuat.\n\n` +
          `Nilai Hutang: Rp ${formatRupiah(
            resultPayable?.amount ??
              purchase.total
          )}\n` +
          `Outstanding: Rp ${formatRupiah(
            resultPayable?.outstanding ??
              purchase.total
          )}\n\n` +
          `Tidak ada pengeluaran Petty Cash.`
        );
      } else if (
        json.data?.type ===
        "PAYABLE_PAYMENT"
      ) {
        const resultPayable =
          json.data?.payable;

        const resultStatus =
          String(
            resultPayable?.status ||
              ""
          ).toUpperCase();

        if (
          resultStatus ===
          "PAID"
        ) {
          alert(
            "Pembayaran berhasil. Purchase Payable sudah LUNAS."
          );
        } else {
          alert(
            `Pembayaran berhasil.\n\nSisa hutang: Rp ${formatRupiah(
              resultPayable?.outstanding
            )}`
          );
        }
      } else {
        const cashImpact =
          pettyCashPaymentMethods.includes(
            selectedMethod
          );

        alert(
          cashImpact
            ? "Pembayaran Purchase berhasil dan Petty Cash telah dikurangi."
            : "Pembayaran Purchase berhasil. Karena menggunakan TRANSFER, Petty Cash tidak dikurangi."
        );
      }

      setShowPaymentModal(false);

      setPaymentAmount("");
      setPaymentMethod("");
      setReferenceNumber("");
      setPaymentRemarks("");
      setPaymentDate("");

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
      setProcessingPayment(
        false
      );
    }
  }

  // =====================================================
  // PAYMENT UI STATE
  // =====================================================

  const isSettlementModal =
    isTempoSettlement;

  const isInitialTempoModal =
    isTempoInitialPayment;

  const paymentUsesPettyCash =
    pettyCashPaymentMethods.includes(
      String(
        paymentMethod || ""
      )
        .trim()
        .toUpperCase()
    );

  const paymentIsTransfer =
    String(
      paymentMethod || ""
    )
      .trim()
      .toUpperCase() ===
    "TRANSFER";

  const paymentInfoText =
    isInitialTempoModal
      ? "Purchase akan dicatat sebagai hutang supplier. Tidak ada pengeluaran Petty Cash."
      : isSettlementModal
      ? paymentUsesPettyCash
        ? `Pelunasan ${paymentMethod}: Payment akan dicatat dan Petty Cash akan berkurang.`
        : paymentIsTransfer
        ? "TRANSFER: pelunasan akan dicatat sebagai Payment tanpa mengurangi Petty Cash."
        : "Pilih metode pelunasan."
      : paymentUsesPettyCash
      ? `${paymentMethod}: pembayaran akan dicatat sebagai Payment dan mengurangi Petty Cash.`
      : paymentIsTransfer
      ? "TRANSFER: pembayaran akan dicatat sebagai Payment tanpa mengurangi Petty Cash."
      : "Metode pembayaran mengikuti Purchase Order.";

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
              router.push(
                "/purchase"
              )
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

  // =====================================================
  // SUMMARY
  // =====================================================

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

        {/* ACTIONS */}

        <div className="flex flex-wrap gap-2">

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

          {canPayment && (
            <button
              onClick={
                openPaymentModal
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <CreditCard size={16} />
              {paymentButtonLabel}
            </button>
          )}

          <button
            type="button"
            onClick={
              sendPurchaseWhatsApp
            }
            className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-600"
          >
            <WhatsAppIcon />
            WhatsApp
          </button>

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

          <a
            href={`/purchase/print?id=${purchase.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Printer size={16} />
            Print
          </a>

          {isApproved && (
            <a
              href={`/barang-masuk/create?purchaseId=${purchase.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3D6D60]"
            >
              <PackageCheck size={16} />
              Receive Barang
            </a>
          )}

          {isReceived && (
            <a
              href="/barang-masuk"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <PackageCheck size={16} />
              Lihat Barang Masuk
            </a>
          )}

          <button
            onClick={() =>
              router.push(
                "/purchase"
              )
            }
            className="inline-flex items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-[#F5F8F6]"
          >
            <ArrowLeft size={16} />
            Kembali
          </button>

        </div>
      </div>

      {/* =====================================================
          DRAFT WARNING
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
              {" "}
              Setelah di-approve, data PO tidak dapat diubah atau dihapus.
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

            <div className="min-w-0 flex-1">

              <p className="text-xs font-medium text-emerald-700">
                Metode Pembayaran Purchase
              </p>

              <p className="mt-0.5 font-bold text-emerald-900">
                {purchasePaymentMethod}
              </p>

            </div>

            {isTempoPurchase &&
              hasPayable && (
                <div className="hidden text-right sm:block">

                  <p className="text-xs text-emerald-700">
                    Status Hutang
                  </p>

                  <p
                    className={`mt-0.5 font-bold ${
                      isTempoPaid
                        ? "text-green-700"
                        : "text-orange-700"
                    }`}
                  >
                    {payableStatus ||
                      "OUTSTANDING"}
                  </p>

                </div>
              )}

          </div>

        </div>
      )}

      {/* =====================================================
          TEMPO PAYABLE SUMMARY
      ===================================================== */}

      {isTempoPurchase &&
        hasPayable && (
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-sm text-blue-700">
                    Nilai Hutang
                  </p>

                  <p className="mt-1 text-xl font-bold text-blue-900">
                    Rp{" "}
                    {formatRupiah(
                      payableAmount
                    )}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <Wallet size={21} />
                </div>

              </div>

            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-sm text-emerald-700">
                    Sudah Dibayar
                  </p>

                  <p className="mt-1 text-xl font-bold text-emerald-900">
                    Rp{" "}
                    {formatRupiah(
                      payablePaidAmount
                    )}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 size={21} />
                </div>

              </div>

            </div>

            <div
              className={`rounded-2xl border p-5 ${
                hasOutstanding
                  ? "border-orange-200 bg-orange-50"
                  : "border-green-200 bg-green-50"
              }`}
            >

              <div className="flex items-center justify-between">

                <div>
                  <p
                    className={`text-sm ${
                      hasOutstanding
                        ? "text-orange-700"
                        : "text-green-700"
                    }`}
                  >
                    Outstanding
                  </p>

                  <p
                    className={`mt-1 text-xl font-bold ${
                      hasOutstanding
                        ? "text-orange-900"
                        : "text-green-900"
                    }`}
                  >
                    Rp{" "}
                    {formatRupiah(
                      payableOutstanding
                    )}
                  </p>
                </div>

                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                    hasOutstanding
                      ? "bg-orange-100 text-orange-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {hasOutstanding ? (
                    <AlertCircle
                      size={21}
                    />
                  ) : (
                    <CheckCircle2
                      size={21}
                    />
                  )}
                </div>

              </div>

            </div>

          </div>
        )}

      {/* =====================================================
          TEMPO PAID INFO
      ===================================================== */}

      {isTempoPaid && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">

          <CheckCircle2
            size={21}
            className="mt-0.5 shrink-0 text-green-600"
          />

          <div>
            <p className="font-semibold text-green-800">
              Purchase Payable sudah LUNAS
            </p>

            <p className="mt-1 text-sm text-green-700">
              Seluruh hutang Purchase ini sudah dibayar.
              Tidak ada outstanding yang tersisa.
            </p>
          </div>

        </div>
      )}

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

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

        {/* HEADER DETAIL BARANG */}

        <div className="border-b border-[#E5ECE9] bg-white px-5 py-5 md:px-6">

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <h2 className="text-lg font-bold text-[#18352D]">
                Detail Barang Purchase
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Daftar barang yang terdapat dalam Purchase Order
              </p>
            </div>

            <div className="rounded-xl bg-[#F5F8F6] px-4 py-2 text-right">

              <p className="text-xs text-gray-500">
                Total Nilai Barang
              </p>

              <p className="text-base font-bold text-[#18352D]">
                Rp{" "}
                {formatRupiah(
                  totalNilai
                )}
              </p>

            </div>

          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="min-w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="w-16 px-5 py-4 text-center font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Nama Barang
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Kode
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

                  const qty =
                    Number(
                      item.qty || 0
                    );

                  const price =
                    Number(
                      item.price || 0
                    );

                  const subtotal =
                    qty * price;

                  const itemName =
                    item.barang
                      ?.name ||
                    item.name ||
                    "-";

                  const itemCode =
                    item.barang
                      ?.code ||
                    item.code ||
                    "-";

                  const itemUnit =
                    item.barang
                      ?.unit ||
                    item.unit ||
                    "-";

                  return (
                    <tr
                      key={
                        item.id ??
                        `${itemCode}-${index}`
                      }
                      className="border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                    >

                      {/* NO */}

                      <td className="px-5 py-5 text-center align-middle text-gray-500">
                        {index + 1}
                      </td>

                      {/* NAMA BARANG */}

                      <td className="min-w-[260px] px-5 py-5 align-middle">

                        <div className="flex items-center gap-3">

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                            <PackageCheck
                              size={19}
                            />
                          </div>

                          <div className="min-w-0">

                            <p className="font-bold leading-5 text-[#18352D]">
                              {itemName}
                            </p>

                            <p className="mt-1 text-xs text-gray-400">
                              Barang Purchase
                            </p>

                          </div>

                        </div>

                      </td>

                      {/* KODE */}

                      <td className="px-5 py-5 align-middle font-medium text-gray-700">
                        {itemCode}
                      </td>

                      {/* SATUAN */}

                      <td className="px-5 py-5 text-center align-middle">

                        <span className="inline-flex rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                          {itemUnit}
                        </span>

                      </td>

                      {/* QTY */}

                      <td className="px-5 py-5 text-right align-middle">

                        <div className="inline-flex flex-col items-end">

                          <span className="text-base font-bold text-[#18352D]">
                            {formatRupiah(
                              qty
                            )}
                          </span>

                          <span className="mt-0.5 text-xs text-gray-400">
                            {itemUnit}
                          </span>

                        </div>

                      </td>

                      {/* HARGA */}

                      <td className="min-w-[150px] px-5 py-5 text-right align-middle">

                        <span className="font-semibold text-gray-700">
                          Rp{" "}
                          {formatRupiah(
                            price
                          )}
                        </span>

                        <p className="mt-1 text-xs text-gray-400">
                          per {itemUnit}
                        </p>

                      </td>

                      {/* SUBTOTAL */}

                      <td className="min-w-[170px] px-5 py-5 text-right align-middle">

                        <span className="text-base font-bold text-[#18352D]">
                          Rp{" "}
                          {formatRupiah(
                            subtotal
                          )}
                        </span>

                        <p className="mt-1 text-xs text-gray-400">
                          {formatRupiah(
                            qty
                          )} × Rp{" "}
                          {formatRupiah(
                            price
                          )}
                        </p>

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

              <tr className="border-t-2 border-[#DDE9E4] bg-[#F5F8F6]">

                <td
                  colSpan={4}
                  className="px-5 py-5 text-right font-bold text-[#35564C]"
                >
                  TOTAL
                </td>

                <td className="px-5 py-5 text-right">

                  <span className="text-base font-bold text-[#18352D]">
                    {formatRupiah(
                      totalQty
                    )}
                  </span>

                  <p className="mt-1 text-xs text-gray-400">
                    Total Qty
                  </p>

                </td>

                <td className="px-5 py-5 text-right text-sm font-semibold text-gray-500">
                  —
                </td>

                <td className="px-5 py-5 text-right">

                  <span className="text-lg font-bold text-[#18352D]">
                    Rp{" "}
                    {formatRupiah(
                      totalNilai
                    )}
                  </span>

                  <p className="mt-1 text-xs text-gray-400">
                    Total Purchase
                  </p>

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
          purchaseId={
            purchase.id
          }
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
            {paymentButtonLabel}
          </button>
        )}

        <button
          type="button"
          onClick={
            sendPurchaseWhatsApp
          }
          className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-5 py-3 text-sm font-semibold text-white hover:bg-green-600"
        >
          <WhatsAppIcon />
          Kirim WhatsApp
        </button>

        <button
          onClick={() =>
            router.push(
              "/purchase"
            )
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
                    {paymentModalTitle}
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

            <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">

              {/* TEMPO OUTSTANDING */}

              {isSettlementModal && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">

                  <div className="mb-3 flex items-center gap-2">

                    <AlertCircle
                      size={18}
                      className="text-orange-600"
                    />

                    <span className="font-semibold text-orange-800">
                      Sisa Hutang Purchase
                    </span>

                  </div>

                  <div className="grid grid-cols-2 gap-3">

                    <div>
                      <p className="text-xs text-orange-700">
                        Total Hutang
                      </p>

                      <p className="mt-1 font-bold text-orange-900">
                        Rp{" "}
                        {formatRupiah(
                          payableAmount
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-orange-700">
                        Sudah Dibayar
                      </p>

                      <p className="mt-1 font-bold text-orange-900">
                        Rp{" "}
                        {formatRupiah(
                          payablePaidAmount
                        )}
                      </p>
                    </div>

                  </div>

                  <div className="mt-3 border-t border-orange-200 pt-3">

                    <p className="text-xs text-orange-700">
                      Outstanding
                    </p>

                    <p className="text-2xl font-bold text-orange-900">
                      Rp{" "}
                      {formatRupiah(
                        payableOutstanding
                      )}
                    </p>

                  </div>

                </div>
              )}

              {/* INITIAL TEMPO INFO */}

              {isInitialTempoModal && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">

                  <div className="flex items-start gap-3">

                    <Wallet
                      size={20}
                      className="mt-0.5 shrink-0 text-blue-600"
                    />

                    <div>

                      <p className="font-semibold text-blue-800">
                        Pembuatan Purchase Payable
                      </p>

                      <p className="mt-1 text-sm leading-relaxed text-blue-700">
                        Purchase ini menggunakan
                        metode TEMPO. Proses ini
                        hanya membuat catatan
                        hutang kepada supplier.
                        Tidak ada pengeluaran
                        Petty Cash.
                      </p>

                    </div>

                  </div>

                </div>
              )}

              {/* NORMAL TOTAL */}

              {!isSettlementModal && (
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
              )}

              {/* METHOD */}

              <div>

                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  {isSettlementModal
                    ? "Metode Pelunasan"
                    : "Metode Pembayaran"}
                </label>

                {isSettlementModal ? (
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
                    className="w-full rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 disabled:bg-gray-100"
                  >

                    {settlementMethods.map(
                      (
                        method
                      ) => (
                        <option
                          key={
                            method
                          }
                          value={
                            method
                          }
                        >
                          {
                            method
                          }
                        </option>
                      )
                    )}

                  </select>
                ) : (
                  <select
                    value={
                      paymentMethod
                    }
                    disabled
                    className="w-full cursor-not-allowed appearance-none rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 outline-none disabled:opacity-100"
                  >
                    <option
                      value={
                        paymentMethod
                      }
                    >
                      {
                        paymentMethod
                      }
                    </option>
                  </select>
                )}

                <p className="mt-1 text-xs text-gray-400">

                  {isInitialTempoModal
                    ? "Metode TEMPO mengikuti Purchase Order dan digunakan untuk membuat hutang. Tidak mengurangi Petty Cash."
                    : isSettlementModal
                    ? "Untuk pelunasan TEMPO, pilih metode pembayaran aktual. CASH/COD/CBD mengurangi Petty Cash, sedangkan TRANSFER tidak."
                    : "Metode pembayaran mengikuti metode yang dipilih saat Purchase Order dibuat dan tidak dapat diubah."}

                </p>

              </div>

              {/* AMOUNT */}

              <div>

                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  {isSettlementModal
                    ? "Jumlah Pelunasan"
                    : "Jumlah Pembayaran"}
                </label>

                <div className="relative">

                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">
                    Rp
                  </span>

                  <input
                    type="number"
                    min="0"
                    max={
                      isSettlementModal
                        ? payableOutstanding
                        : undefined
                    }
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

                {isSettlementModal ? (
                  <div className="mt-2 flex items-center justify-between text-xs">

                    <span className="text-gray-400">
                      Maksimal pembayaran:
                    </span>

                    <button
                      type="button"
                      disabled={
                        processingPayment
                      }
                      onClick={() =>
                        setPaymentAmount(
                          String(
                            payableOutstanding
                          )
                        )
                      }
                      className="font-bold text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                    >
                      Rp{" "}
                      {formatRupiah(
                        payableOutstanding
                      )}
                    </button>

                  </div>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">
                    Jumlah harus sama dengan total Purchase.
                  </p>
                )}

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
                  placeholder={
                    isSettlementModal
                      ? "Keterangan pelunasan (opsional)"
                      : "Keterangan pembayaran (opsional)"
                  }
                  disabled={
                    processingPayment
                  }
                  className="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10 disabled:bg-gray-100"
                />

              </div>

              {/* INFO PAYMENT */}

              <div
                className={`rounded-xl border p-4 text-sm leading-relaxed ${
                  isInitialTempoModal
                    ? "border-blue-200 bg-blue-50 text-blue-800"
                    : paymentIsTransfer
                    ? "border-purple-200 bg-purple-50 text-purple-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >

                <p>
                  <strong>
                    {paymentMethod}:
                  </strong>{" "}
                  {paymentInfoText.replace(
                    `${paymentMethod}: `,
                    ""
                  )}
                </p>

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

                    {isInitialTempoModal
                      ? "Buat Hutang"
                      : isSettlementModal
                      ? "Proses Pelunasan"
                      : "Proses Payment"}
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

/* =========================================================
   WHATSAPP ICON HELPER
========================================================= */

function WhatsAppIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-4.1-1.1L3 20l1.1-5.1A8.4 8.4 0 0 1 3 10.8 8.5 8.5 0 1 1 21 11.5Z" />

      <path d="M8.5 7.8c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.7c.1.3.1.5-.1.7l-.5.6c-.2.2-.2.4-.1.6.4.8 1 1.4 1.7 1.9.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.7-.1l1.7.8c.3.1.4.3.4.5v.5c0 .3-.1.6-.4.8-.4.3-1 .5-1.5.4-1.4-.2-2.8-1-4-2.1-3.5-1.1-1.9-2.2-2.3-3.5-.2-.6-.1-1.2.2-1.9Z" />
    </svg>
  );
}