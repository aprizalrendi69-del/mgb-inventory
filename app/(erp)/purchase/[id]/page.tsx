"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  ArrowLeft,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Edit,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  PackageCheck,
  Printer,
  ReceiptText,
  ShieldCheck,
  Trash2,
  Truck,
  Wallet,
  X,
} from "lucide-react";

import { exportPurchasePDF } from "@/lib/exportPurchasePdf";
import { exportPurchaseExcel } from "@/lib/exportPurchaseExcel";
import { buildWhatsAppPurchaseUrl } from "@/lib/whatsapp";
import PurchaseComments from "@/components/PurchaseComments";

/* =========================================================
   TYPES
========================================================= */

type PriceChangeInfo = {
  changed: boolean;
  hargaLama: number;
  hargaBaru: number;
  persen: number;
  supplier: string;
  difference: number;
  direction: "UP" | "DOWN" | null;
};

/* =========================================================
   DEFAULT PRICE INFO
========================================================= */

const EMPTY_PRICE_INFO: PriceChangeInfo = {
  changed: false,
  hargaLama: 0,
  hargaBaru: 0,
  persen: 0,
  supplier: "",
  difference: 0,
  direction: null,
};

export default function DetailPurchase() {
  const params = useParams();
  const router = useRouter();

  const purchaseId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  /*
   * =======================================================
   * PRICE CHANGE STATE
   *
   * Acuan:
   * Edit Purchase menggunakan:
   *
   * /api/master-harga/check/${barangId}/${price}
   *
   * Jadi halaman Detail juga menggunakan sumber data yang
   * sama agar informasi harga konsisten.
   * =======================================================
   */
  const [priceChangeMap, setPriceChangeMap] = useState<
    Record<number, PriceChangeInfo>
  >({});

  const [loadingPriceMap, setLoadingPriceMap] = useState<
    Record<number, boolean>
  >({});

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

  async function loadPurchase(
    signal?: AbortSignal
  ) {
    if (!purchaseId) return;

    try {
      setLoading(true);

      const res = await fetch(
        `/api/purchase/${purchaseId}`,
        {
          cache: "no-store",
          signal,
        }
      );

      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status}`
        );
      }

      const json = await res.json();

      if (json.success) {
        setPurchase(json.data);

        /*
         * API diharapkan mengirim:
         *
         * access: {
         *   canDelete: boolean
         * }
         *
         * Jika API belum mengirim access,
         * fallback tetap false agar aman.
         */
        setCanDelete(
          json.access?.canDelete === true
        );
      } else {
        setPurchase(null);
        setCanDelete(false);
      }
    } catch (error: any) {
      if (
        error?.name ===
        "AbortError"
      ) {
        return;
      }

      console.error(
        "LOAD PURCHASE ERROR:",
        error
      );

      setPurchase(null);
      setCanDelete(false);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!purchaseId) {
      setLoading(false);
      setPurchase(null);
      setCanDelete(false);
      setPriceChangeMap({});
      return;
    }

    const controller =
      new AbortController();

    loadPurchase(
      controller.signal
    );

    return () => {
      controller.abort();
    };
  }, [purchaseId]);

  // =====================================================
  // LOAD PRICE CHANGE INFORMATION
  // =====================================================

  useEffect(() => {
    if (!purchase?.items?.length) {
      setPriceChangeMap({});
      setLoadingPriceMap({});
      return;
    }

    let cancelled = false;

    async function loadPriceChanges() {
      const nextMap: Record<
        number,
        PriceChangeInfo
      > = {};

      const nextLoading: Record<
        number,
        boolean
      > = {};

      for (
        const item of purchase.items
      ) {
        const itemKey = Number(
          item?.id ??
            item?.barangId ??
            0
        );

        const barangId = Number(
          item?.barangId ??
            item?.barang?.id ??
            0
        );

        const purchasePrice = Number(
          item?.price ?? 0
        );

        if (
          !itemKey ||
          !barangId ||
          !Number.isFinite(
            purchasePrice
          ) ||
          purchasePrice <= 0
        ) {
          continue;
        }

        nextLoading[itemKey] =
          true;
      }

      if (!cancelled) {
        setLoadingPriceMap(
          nextLoading
        );
      }

      /*
       * Jalankan pengecekan secara paralel.
       * Endpoint sama dengan halaman Edit Purchase.
       */
      await Promise.all(
        purchase.items.map(
          async (
            item: any
          ) => {
            const itemKey = Number(
              item?.id ??
                item?.barangId ??
                0
            );

            const barangId = Number(
              item?.barangId ??
                item?.barang?.id ??
                0
            );

            const purchasePrice =
              Number(
                item?.price ?? 0
              );

            if (
              !itemKey ||
              !barangId ||
              !Number.isFinite(
                purchasePrice
              ) ||
              purchasePrice <= 0
            ) {
              return;
            }

            try {
              const res =
                await fetch(
                  `/api/master-harga/check/${barangId}/${purchasePrice}`,
                  {
                    cache:
                      "no-store",
                  }
                );

              if (!res.ok) {
                return;
              }

              const json =
                await res.json();

              if (
                cancelled
              ) {
                return;
              }

              const data =
                json?.data ??
                json;

              if (
                !data ||
                typeof data !==
                  "object"
              ) {
                return;
              }

              const hargaLamaRaw =
                data?.hargaLama ??
                data?.lastPrice ??
                data?.hargaTerakhir ??
                0;

              const hargaBaruRaw =
                data?.hargaBaru ??
                data?.price ??
                purchasePrice;

              const hargaLama =
                Number(
                  hargaLamaRaw
                );

              const hargaBaru =
                Number(
                  hargaBaruRaw
                );

              if (
                !Number.isFinite(
                  hargaLama
                ) ||
                !Number.isFinite(
                  hargaBaru
                ) ||
                hargaLama <= 0 ||
                hargaBaru <= 0
              ) {
                return;
              }

              const difference =
                hargaBaru -
                hargaLama;

              /*
               * Sama dengan acuan Edit:
               * jika old price <= 0 atau sama dengan
               * new price, tidak dianggap berubah.
               */
              if (
                Math.abs(
                  difference
                ) <= 0.01
              ) {
                nextMap[
                  itemKey
                ] = {
                  ...EMPTY_PRICE_INFO,
                  hargaLama,
                  hargaBaru,
                };

                return;
              }

              let persen =
                Number(
                  data?.persen ??
                    data?.percentage ??
                    0
                );

              /*
               * Jika API belum mengirim persen,
               * hitung sendiri berdasarkan harga lama.
               */
              if (
                !Number.isFinite(
                  persen
                )
              ) {
                persen =
                  (difference /
                    hargaLama) *
                  100;
              }

              const direction =
                difference >
                0.01
                  ? "UP"
                  : difference <
                    -0.01
                  ? "DOWN"
                  : null;

              nextMap[
                itemKey
              ] = {
                changed:
                  direction !==
                  null,
                hargaLama,
                hargaBaru,
                persen,
                supplier:
                  String(
                    data?.supplier ??
                      data?.supplierName ??
                      ""
                  ),
                difference,
                direction,
              };
            } catch (error) {
              console.error(
                "PRICE CHANGE CHECK ERROR:",
                error
              );
            } finally {
              if (
                !cancelled
              ) {
                setLoadingPriceMap(
                  (
                    current
                  ) => ({
                    ...current,
                    [itemKey]:
                      false,
                  })
                );
              }
            }
          }
        )
      );

      if (!cancelled) {
        setPriceChangeMap(
          nextMap
        );
      }
    }

    loadPriceChanges();

    return () => {
      cancelled = true;
    };
  }, [purchase]);

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
        `/api/purchase/${purchase.id}?source=PUSAT`,
        {
          method: "DELETE",
        }
      );

      const json =
        await res.json();

      if (json.success) {
        alert(
          "Purchase Order berhasil dihapus"
        );

        router.push(
          "/purchase"
        );

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
  // APPROVE PURCHASE ORDER
  // =====================================================

  function openApproveModal() {
    if (!purchase) return;

    if (purchase.status !== "DRAFT") {
      alert("Purchase Order ini sudah tidak berstatus DRAFT.");
      return;
    }

    setShowApproveModal(true);
  }

  async function approvePurchase() {
    if (!purchase || approving) return;

    if (purchase.status !== "DRAFT") {
      setShowApproveModal(false);
      alert("Purchase Order ini sudah tidak berstatus DRAFT.");
      return;
    }

    try {
      setApproving(true);

      const res = await fetch(
        `/api/purchase/${purchase.id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(
          json?.message ||
            "Gagal melakukan approval Purchase Order."
        );
      }

      setShowApproveModal(false);

      await loadPurchase();
      router.refresh();

      alert(
        json?.message ||
          `Purchase Order ${purchase.number} berhasil di-approve.`
      );
    } catch (error) {
      console.error(
        "APPROVE PURCHASE ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat approve Purchase Order."
      );
    } finally {
      setApproving(false);
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

  function formatRupiah(
    value: any
  ) {
    const numericValue =
      Number(value);

    if (
      !Number.isFinite(
        numericValue
      )
    ) {
      return "0";
    }

    return numericValue.toLocaleString(
      "id-ID"
    );
  }

  function formatSignedRupiah(
    value: number
  ) {
    const numericValue =
      Number(value);

    if (
      !Number.isFinite(
        numericValue
      )
    ) {
      return "+Rp 0";
    }

    const absolute =
      Math.abs(
        numericValue
      );

    return `${
      numericValue >= 0
        ? "+"
        : "-"
    }Rp ${formatRupiah(
      absolute
    )}`;
  }

  function formatPercent(
    value: number
  ) {
    const numericValue =
      Number(value);

    if (
      !Number.isFinite(
        numericValue
      )
    ) {
      return "0%";
    }

    const sign =
      numericValue > 0
        ? "+"
        : "";

    return `${sign}${numericValue.toLocaleString(
      "id-ID",
      {
        maximumFractionDigits: 2,
      }
    )}%`;
  }

  function formatDate(
    value: any
  ) {
    if (!value) return "-";

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
        month: "long",
        year: "numeric",
      }
    );
  }

  function getTodayDate() {
    const now =
      new Date();

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
        return "bg-amber-50 text-amber-700 border-amber-200";

      case "APPROVED":
        return "bg-blue-50 text-blue-700 border-blue-200";

      case "RECEIVED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";

      case "COMPLETED":
        return "bg-purple-50 text-purple-700 border-purple-200";

      case "CANCELLED":
        return "bg-red-50 text-red-700 border-red-200";

      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  }

  function getStatusIcon(
    status: string
  ) {
    switch (status) {
      case "DRAFT":
        return Clock3;

      case "APPROVED":
        return ShieldCheck;

      case "RECEIVED":
        return PackageCheck;

      case "COMPLETED":
        return CheckCircle2;

      case "CANCELLED":
        return X;

      default:
        return Info;
    }
  }

  // =====================================================
  // PRICE CHANGE
  //
  // Sekarang sumber utama adalah priceChangeMap,
  // bukan item.barang.purchasePrice.
  // =====================================================

  function getPriceChangeInfo(
    item: any
  ): PriceChangeInfo {
    const itemKey = Number(
      item?.id ??
        item?.barangId ??
        0
    );

    if (
      itemKey &&
      priceChangeMap[itemKey]
    ) {
      return priceChangeMap[
        itemKey
      ];
    }

    return EMPTY_PRICE_INFO;
  }

  // =====================================================
  // PAYMENT / PAYABLE DATA
  // =====================================================

  const purchasePaymentMethod =
    String(
      purchase?.paymentMethod ||
        ""
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
    purchase.status !==
      "DRAFT" &&
    purchase.status !==
      "COMPLETED" &&
    purchase.status !==
      "CANCELLED" &&
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
      ? "Buat Hutang"
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
        purchase.paymentMethod ||
          ""
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

      setShowPaymentModal(
        true
      );

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

      setShowPaymentModal(
        true
      );

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

    setShowPaymentModal(
      true
    );
  }

  // =====================================================
  // CLOSE PAYMENT MODAL
  // =====================================================

  function closePaymentModal() {
    if (
      processingPayment
    ) {
      return;
    }

    setShowPaymentModal(
      false
    );
  }

  // =====================================================
  // PROCESS PAYMENT
  // =====================================================

  async function processPurchasePayment() {
    if (!purchase) return;

    const purchaseMethod =
      String(
        purchase.paymentMethod ||
          ""
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

    const normalizedAmount =
      String(
        paymentAmount
      ).trim();

    const amount =
      Number(
        normalizedAmount.replace(
          /[^0-9.-]/g,
          ""
        )
      );

    if (
      !Number.isFinite(
        amount
      ) ||
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

    let confirmMessage =
      "";

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
            : "Petty Cash tidak berkurang karena menggunakan TRANSFER."
        );
    }

    const confirmed =
      window.confirm(
        confirmMessage
      );

    if (!confirmed) return;

    try {
      setProcessingPayment(
        true
      );

      const res =
        await fetch(
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

      setShowPaymentModal(
        false
      );

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
  // PRICE CHANGE SUMMARY
  // =====================================================

  const priceChangeItems =
    purchase?.items
      ?.map(
        (
          item: any,
          index: number
        ) => ({
          item,
          index,
          priceInfo:
            getPriceChangeInfo(
              item
            ),
        })
      )
      .filter(
        ({
          priceInfo,
        }: {
          priceInfo: PriceChangeInfo;
        }) =>
          priceInfo.changed
      ) ?? [];

  const totalPriceChangeItems =
    priceChangeItems.length;

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(73,127,112,0.10),transparent_30%),#F4F7F5]">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-[28px] border border-[#DDE9E4] bg-white p-8 text-center shadow-[0_20px_60px_rgba(24,53,45,0.08)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF3EF]">
              <Loader2
                size={28}
                className="animate-spin text-[#497F70]"
              />
            </div>

            <h2 className="mt-5 text-lg font-bold text-[#18352D]">
              Memuat Purchase Order
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Menyiapkan detail transaksi...
            </p>

            <div className="mx-auto mt-6 h-1.5 w-32 overflow-hidden rounded-full bg-[#E8EFEC]">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-[#497F70]" />
            </div>
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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(73,127,112,0.10),transparent_30%),#F4F7F5] p-6 md:p-8">
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="w-full max-w-lg rounded-[30px] border border-[#DDE9E4] bg-white p-10 text-center shadow-[0_20px_60px_rgba(24,53,45,0.08)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
              <FileText size={30} />
            </div>

            <h2 className="mt-5 text-xl font-bold text-[#18352D]">
              Purchase Order tidak ditemukan
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Data Purchase Order yang kamu cari
              tidak tersedia atau sudah tidak dapat
              diakses.
            </p>

            <button
              onClick={() =>
                router.push(
                  "/purchase"
                )
              }
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#18352D] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#18352D]/10 transition hover:bg-[#244A40]"
            >
              <ArrowLeft size={16} />
              Kembali ke Purchase
            </button>
          </div>
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

  const CurrentStatusIcon =
    getStatusIcon(
      purchase.status
    );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(73,127,112,0.10),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(24,53,45,0.05),transparent_25%),#F4F7F5]">

      <div className="h-1 w-full bg-gradient-to-r from-[#18352D] via-[#497F70] to-[#8EB8A9]" />

      <div className="mx-auto w-full max-w-[1700px] p-4 sm:p-6 lg:p-8">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="mb-6 overflow-hidden rounded-[28px] border border-[#DDE9E4] bg-white shadow-[0_16px_50px_rgba(24,53,45,0.07)]">
          <div className="relative overflow-hidden">

            <div className="absolute -right-24 -top-32 h-72 w-72 rounded-full bg-[#497F70]/8 blur-3xl" />

            <div className="absolute -bottom-32 left-1/3 h-60 w-60 rounded-full bg-[#18352D]/5 blur-3xl" />

            <div className="relative flex flex-col gap-6 p-5 md:p-7 xl:p-8">

              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

                <div className="flex min-w-0 items-center gap-4">

                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#18352D] text-white shadow-xl shadow-[#18352D]/15">
                    <ShoppingCartIcon />

                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#497F70]">
                      <Check
                        size={11}
                        strokeWidth={3}
                      />
                    </span>
                  </div>

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <h1 className="text-xl font-black tracking-tight text-[#18352D] sm:text-2xl lg:text-3xl">
                        Detail Purchase Order
                      </h1>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStatusClass(
                          purchase.status
                        )}`}
                      >
                        <CurrentStatusIcon
                          size={12}
                        />
                        {purchase.status}
                      </span>

                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">

                      <span className="font-semibold text-[#497F70]">
                        {purchase.number}
                      </span>

                      <span className="hidden h-1 w-1 rounded-full bg-gray-300 sm:block" />

                      <span>
                        {formatDate(
                          purchase.purchaseDate
                        )}
                      </span>

                      <span className="hidden h-1 w-1 rounded-full bg-gray-300 sm:block" />

                      <span>
                        {supplier}
                      </span>

                    </div>

                  </div>

                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">

                  {isDraft && (
                    <button
                      onClick={() =>
                        router.push(
                          `/purchase/${purchase.id}/edit`
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
                    >
                      <Edit size={16} />
                      Edit
                    </button>
                  )}

                  {isDraft && (
                    <button
                      type="button"
                      onClick={openApproveModal}
                      disabled={approving || deleting}
                      className="group relative inline-flex min-w-[142px] items-center justify-center gap-3 overflow-hidden rounded-2xl border border-[#315E50] bg-gradient-to-br from-[#244A40] via-[#18352D] to-[#102A23] px-4 py-2.5 text-left text-white shadow-[0_12px_28px_rgba(24,53,45,0.22)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(24,53,45,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition duration-500 group-hover:translate-x-full group-hover:opacity-100" />

                      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                        {approving ? (
                          <Loader2
                            size={17}
                            className="animate-spin"
                          />
                        ) : (
                          <ShieldCheck
                            size={17}
                          />
                        )}
                      </span>

                      <span className="relative flex min-w-0 flex-col">
                        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-100/60">
                          Approval
                        </span>
                        <span className="text-sm font-black tracking-tight">
                          {approving
                            ? "Memproses..."
                            : "Approve PO"}
                        </span>
                      </span>
                    </button>
                  )}

                  {isDraft &&
                    canDelete && (
                      <button
                        onClick={
                          deletePurchase
                        }
                        disabled={
                          deleting
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2
                          size={16}
                        />

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
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#497F70]/15 transition hover:-translate-y-0.5 hover:bg-[#3D6D60]"
                    >
                      <CreditCard
                        size={16}
                      />
                      {paymentButtonLabel}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={
                      sendPurchaseWhatsApp
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-green-500/10 transition hover:-translate-y-0.5 hover:bg-[#20BD5B]"
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
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
                  >
                    <FileText
                      size={16}
                    />
                    PDF
                  </button>

                  <button
                    onClick={() =>
                      exportPurchaseExcel(
                        purchase
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
                  >
                    <FileSpreadsheet
                      size={16}
                    />
                    Excel
                  </button>

                  <a
                    href={`/purchase/print?id=${purchase.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
                  >
                    <Printer
                      size={16}
                    />
                    Print
                  </a>

                </div>

              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-[#E8EFEC] pt-5 sm:grid-cols-3">

                <div className="rounded-2xl bg-[#F7FAF8] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Supplier
                  </p>

                  <p className="mt-1 truncate text-sm font-bold text-[#18352D]">
                    {supplier}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#F7FAF8] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Payment
                  </p>

                  <p className="mt-1 text-sm font-bold text-[#18352D]">
                    {purchasePaymentMethod ||
                      "-"}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#F0F6F3] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#497F70]">
                    Total Purchase
                  </p>

                  <p className="mt-1 text-lg font-black text-[#18352D]">
                    Rp{" "}
                    {formatRupiah(
                      totalNilai
                    )}
                  </p>
                </div>

              </div>

            </div>
          </div>
        </div>

        {/* =====================================================
            DRAFT WARNING
        ===================================================== */}

        {isDraft && (
          <div className="mb-6 overflow-hidden rounded-[24px] border border-amber-200 bg-gradient-to-r from-amber-50 to-white shadow-sm">

            <div className="flex items-start gap-4 p-5">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Clock3
                  size={21}
                />
              </div>

              <div className="min-w-0">

                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-amber-900">
                    Purchase Order masih Draft
                  </p>

                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Editable
                  </span>
                </div>

                <p className="mt-1 text-sm leading-6 text-amber-700">
                  PO masih dapat diedit.
                  {canDelete
                    ? " Sebagai Admin Pusat, PO juga dapat dihapus."
                    : " Penghapusan PO hanya dapat dilakukan oleh Admin Pusat."}{" "}
                  Setelah di-approve, data PO tidak
                  dapat diubah atau dihapus. Pastikan seluruh
                  data PO sudah benar sebelum menekan tombol Approve.
                </p>

              </div>

            </div>

          </div>
        )}

        {/* =====================================================
            PAYMENT METHOD INFO
        ===================================================== */}

        {purchasePaymentMethod && (
          <div className="mb-6 overflow-hidden rounded-[24px] border border-[#CFE5DA] bg-white shadow-sm">

            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-center gap-4">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                  <CreditCard
                    size={21}
                  />
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#497F70]">
                    Metode Pembayaran
                  </p>

                  <p className="mt-1 text-lg font-black text-[#18352D]">
                    {purchasePaymentMethod}
                  </p>
                </div>

              </div>

              {isTempoPurchase &&
                hasPayable && (
                  <div className="rounded-2xl bg-[#F7FAF8] px-5 py-3 sm:text-right">

                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Status Hutang
                    </p>

                    <p
                      className={`mt-1 text-sm font-black ${
                        isTempoPaid
                          ? "text-emerald-700"
                          : "text-orange-700"
                      }`}
                    >
                      {isTempoPaid
                        ? "LUNAS"
                        : payableStatus ||
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

              <PayableCard
                label="Nilai Hutang"
                value={payableAmount}
                icon={
                  <Wallet
                    size={21}
                  />
                }
                tone="blue"
              />

              <PayableCard
                label="Sudah Dibayar"
                value={
                  payablePaidAmount
                }
                icon={
                  <CheckCircle2
                    size={21}
                  />
                }
                tone="green"
              />

              <PayableCard
                label="Outstanding"
                value={
                  payableOutstanding
                }
                icon={
                  hasOutstanding ? (
                    <AlertCircle
                      size={21}
                    />
                  ) : (
                    <CheckCircle2
                      size={21}
                    />
                  )
                }
                tone={
                  hasOutstanding
                    ? "orange"
                    : "green"
                }
              />

            </div>
          )}

        {/* =====================================================
            TEMPO PAID INFO
        ===================================================== */}

        {isTempoPaid && (
          <div className="mb-6 overflow-hidden rounded-[24px] border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white">

            <div className="flex items-start gap-4 p-5">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <CheckCircle2
                  size={21}
                />
              </div>

              <div>
                <p className="font-bold text-emerald-900">
                  Purchase Payable sudah LUNAS
                </p>

                <p className="mt-1 text-sm leading-6 text-emerald-700">
                  Seluruh hutang Purchase ini sudah
                  dibayar. Tidak ada outstanding yang
                  tersisa.
                </p>
              </div>

            </div>

          </div>
        )}

        {/* =====================================================
            SUMMARY CARDS
        ===================================================== */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <SummaryCard
            label="Supplier"
            value={supplier}
            subtitle="Vendor Purchase"
            icon={
              <Truck size={21} />
            }
            tone="green"
          />

          <SummaryCard
            label="Jumlah Item"
            value={formatRupiah(
              totalItem
            )}
            subtitle="Jenis barang"
            icon={
              <ReceiptText
                size={21}
              />
            }
            tone="blue"
          />

          <SummaryCard
            label="Total Qty"
            value={formatRupiah(
              totalQty
            )}
            subtitle="Total kuantitas"
            icon={
              <PackageCheck
                size={21}
              />
            }
            tone="orange"
          />

          <SummaryCard
            label="Nilai Purchase"
            value={`Rp ${formatRupiah(
              totalNilai
            )}`}
            subtitle="Grand total"
            icon={
              <CreditCard
                size={21}
              />
            }
            tone="purple"
            emphasis
          />

        </div>

        {/* =====================================================
            STATUS TIMELINE
        ===================================================== */}

        <div className="mb-6 overflow-hidden rounded-[28px] border border-[#DDE9E4] bg-white shadow-[0_12px_40px_rgba(24,53,45,0.05)]">

          <div className="border-b border-[#E8EFEC] px-5 py-5 md:px-7">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#497F70]" />

                  <h2 className="text-lg font-black text-[#18352D]">
                    Status Purchase Order
                  </h2>
                </div>

                <p className="mt-1 text-sm text-gray-500">
                  Progress perjalanan Purchase Order
                </p>
              </div>

              <span
                className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${getStatusClass(
                  purchase.status
                )}`}
              >
                <CurrentStatusIcon
                  size={13}
                />
                {purchase.status}
              </span>

            </div>

          </div>

          <div className="overflow-x-auto p-6 md:p-8">

            <div className="flex min-w-[650px] items-start">

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

                  const completed =
                    index <
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
                          className={`h-[3px] flex-1 ${
                            index === 0
                              ? "bg-transparent"
                              : active
                              ? "bg-[#497F70]"
                              : "bg-[#E5ECE9]"
                          }`}
                        />

                        <div
                          className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-4 border-white text-sm font-bold shadow-md ${
                            active
                              ? "bg-[#497F70] text-white shadow-[#497F70]/20"
                              : "bg-[#EEF2F0] text-gray-400 shadow-none"
                          }`}
                        >
                          {active ? (
                            <Check
                              size={20}
                              strokeWidth={
                                2.8
                              }
                            />
                          ) : (
                            index + 1
                          )}
                        </div>

                        <div
                          className={`h-[3px] flex-1 ${
                            isLast
                              ? "bg-transparent"
                              : completed
                              ? "bg-[#497F70]"
                              : "bg-[#E5ECE9]"
                          }`}
                        />

                      </div>

                      <div className="mt-4 text-center">

                        <p
                          className={`text-sm font-bold ${
                            active
                              ? "text-[#18352D]"
                              : "text-gray-400"
                          }`}
                        >
                          {step.label}
                        </p>

                        <p
                          className={`mt-1 text-[10px] font-medium uppercase tracking-wider ${
                            active
                              ? "text-[#497F70]"
                              : "text-gray-300"
                          }`}
                        >
                          {step.name}
                        </p>

                      </div>

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

          <InformationCard
            title="Informasi Purchase"
            icon={
              <FileText
                size={19}
              />
            }
          >

            <InfoRow
              label="No PO"
              value={
                purchase.number
              }
              strong
            />

            <InfoRow
              label="Tanggal"
              value={formatDate(
                purchase.purchaseDate
              )}
            />

            <InfoRow
              label="Status"
              value={
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStatusClass(
                    purchase.status
                  )}`}
                >
                  <CurrentStatusIcon
                    size={12}
                  />
                  {purchase.status}
                </span>
              }
            />

            <InfoRow
              label="Metode"
              value={
                purchase.paymentMethod ||
                "-"
              }
              strong
            />

            <InfoRow
              label="Total"
              value={`Rp ${formatRupiah(
                purchase.total
              )}`}
              strong
              highlight
            />

            <InfoRow
              label="Keterangan"
              value={
                purchase.remarks ||
                "-"
              }
            />

          </InformationCard>

          <InformationCard
            title="Informasi Supplier"
            icon={
              <Truck
                size={19}
              />
            }
          >

            <InfoRow
              label="Nama"
              value={
                purchase.supplier
                  ?.name ||
                "-"
              }
              strong
            />

            <InfoRow
              label="PIC"
              value={
                purchase.supplier
                  ?.contactPerson ||
                "-"
              }
            />

            <InfoRow
              label="Telepon"
              value={
                purchase.supplier
                  ?.phone ||
                "-"
              }
            />

            <InfoRow
              label="Email"
              value={
                purchase.supplier
                  ?.email ||
                "-"
              }
              breakWord
            />

            <InfoRow
              label="Alamat"
              value={
                purchase.supplier
                  ?.address ||
                "-"
              }
            />

          </InformationCard>

        </div>

        {/* =====================================================
            DETAIL BARANG
        ===================================================== */}

        <div className="mb-6 overflow-hidden rounded-[28px] border border-[#DDE9E4] bg-white shadow-[0_12px_40px_rgba(24,53,45,0.05)]">

          <div className="relative overflow-hidden border-b border-[#E8EFEC] bg-gradient-to-r from-white via-white to-[#F4F9F6] px-5 py-6 md:px-7">

            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[#497F70]/6 blur-3xl" />

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-center gap-4">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                  <PackageCheck
                    size={22}
                  />
                </div>

                <div>
                  <h2 className="text-lg font-black text-[#18352D]">
                    Detail Barang Purchase
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Daftar barang yang terdapat dalam
                    Purchase Order
                  </p>
                </div>

              </div>

              <div className="flex flex-wrap items-center gap-3">

                {totalPriceChangeItems >
                  0 && (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 px-5 py-3 shadow-sm">

                    <div className="flex items-center gap-2">

                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                        <AlertCircle
                          size={16}
                        />
                      </div>

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-orange-600">
                          Perubahan Harga
                        </p>

                        <p className="mt-0.5 text-sm font-black text-orange-900">
                          {totalPriceChangeItems}{" "}
                          item memiliki perbedaan
                          harga
                        </p>
                      </div>

                    </div>

                  </div>
                )}

                <div className="rounded-2xl border border-[#DDE9E4] bg-white px-5 py-3 shadow-sm">

                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Total Nilai Barang
                  </p>

                  <p className="mt-1 text-lg font-black text-[#18352D]">
                    Rp{" "}
                    {formatRupiah(
                      totalNilai
                    )}
                  </p>

                </div>

              </div>

            </div>

          </div>

          {/* =====================================================
              PRICE CHANGE INFORMATION BANNER
          ===================================================== */}

          {totalPriceChangeItems >
            0 && (
            <div className="border-b border-orange-100 bg-gradient-to-r from-orange-50 via-amber-50/70 to-white px-5 py-4 md:px-7">

              <div className="flex items-start gap-3">

                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                  <Info
                    size={17}
                  />
                </div>

                <div className="min-w-0">

                  <p className="text-sm font-black text-orange-900">
                    Ada perbedaan harga pada item Purchase
                  </p>

                  <p className="mt-1 text-xs leading-5 text-orange-700">
                    Harga pada Purchase Order dibandingkan
                    dengan{" "}
                    <strong>
                      harga pembelian terakhir
                    </strong>
                    . Jika harga PO lebih tinggi akan
                    ditandai{" "}
                    <strong>HARGA NAIK</strong>,
                    sedangkan jika lebih rendah akan
                    ditandai{" "}
                    <strong>HARGA TURUN</strong>.
                  </p>

                </div>

              </div>

            </div>
          )}

          <div className="overflow-x-auto">

            <table className="min-w-[1250px] w-full text-sm">

              <thead className="bg-[#F7FAF8]">

                <tr className="border-b border-[#E5ECE9]">

                  <th className="w-16 px-5 py-4 text-center text-[11px] font-black uppercase tracking-wider text-[#527268]">
                    No
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-wider text-[#527268]">
                    Nama Barang
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-wider text-[#527268]">
                    Kode
                  </th>

                  <th className="px-5 py-4 text-center text-[11px] font-black uppercase tracking-wider text-[#527268]">
                    Satuan
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-wider text-[#527268]">
                    Qty
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-wider text-[#527268]">
                    Harga Purchase
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-wider text-[#527268]">
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

                    const itemKey =
                      Number(
                        item?.id ??
                          item?.barangId ??
                          0
                      );

                    const priceInfo =
                      getPriceChangeInfo(
                        item
                      );

                    const priceLoading =
                      !!loadingPriceMap[
                        itemKey
                      ];

                    return (
                      <tr
                        key={
                          item.id ??
                          `${itemCode}-${index}`
                        }
                        className={`group border-b transition ${
                          priceInfo.changed
                            ? priceInfo.direction ===
                              "UP"
                              ? "border-red-100 bg-red-50/30 hover:bg-red-50/55"
                              : "border-emerald-100 bg-emerald-50/25 hover:bg-emerald-50/45"
                            : "border-[#EDF2EF] hover:bg-[#FAFCFB]"
                        }`}
                      >

                        <td className="px-5 py-5 text-center align-middle">

                          <span
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                              priceInfo.changed
                                ? priceInfo.direction ===
                                  "UP"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-emerald-100 text-emerald-700"
                                : "bg-[#F3F6F4] text-gray-500"
                            }`}
                          >
                            {index +
                              1}
                          </span>

                        </td>

                        <td className="min-w-[280px] px-5 py-5 align-middle">

                          <div className="flex items-center gap-3">

                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition ${
                                priceInfo.changed
                                  ? priceInfo.direction ===
                                    "UP"
                                    ? "border-red-200 bg-red-100 text-red-700 group-hover:bg-red-200"
                                    : "border-emerald-200 bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200"
                                  : "border-[#DDE9E4] bg-[#F1F7F4] text-[#497F70] group-hover:bg-[#EAF3EF]"
                              }`}
                            >
                              <PackageCheck
                                size={19}
                              />
                            </div>

                            <div className="min-w-0">

                              <div className="flex flex-wrap items-center gap-2">

                                <p className="font-bold leading-5 text-[#18352D]">
                                  {itemName}
                                </p>

                                {priceLoading && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-[#DDE9E4] bg-white px-2 py-0.5 text-[9px] font-bold text-gray-400">
                                    <Loader2
                                      size={10}
                                      className="animate-spin"
                                    />
                                    Cek harga
                                  </span>
                                )}

                                {!priceLoading &&
                                  priceInfo.changed &&
                                  priceInfo.direction ===
                                    "UP" && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-red-700">
                                      <ArrowUp
                                        size={10}
                                        strokeWidth={
                                          3
                                        }
                                      />
                                      Harga Naik
                                    </span>
                                  )}

                                {!priceLoading &&
                                  priceInfo.changed &&
                                  priceInfo.direction ===
                                    "DOWN" && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-700">
                                      <ArrowDown
                                        size={10}
                                        strokeWidth={
                                          3
                                        }
                                      />
                                      Harga Turun
                                    </span>
                                  )}

                              </div>

                              <p className="mt-1 text-[11px] font-medium text-gray-400">
                                Barang Purchase
                              </p>

                            </div>

                          </div>

                        </td>

                        <td className="px-5 py-5 align-middle">

                          <span className="inline-flex rounded-lg border border-[#E1E9E5] bg-[#F8FAF9] px-3 py-1.5 font-mono text-xs font-bold text-gray-600">
                            {itemCode}
                          </span>

                        </td>

                        <td className="px-5 py-5 text-center align-middle">

                          <span className="inline-flex rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600">
                            {itemUnit}
                          </span>

                        </td>

                        <td className="px-5 py-5 text-right align-middle">

                          <div className="inline-flex flex-col items-end">

                            <span className="text-base font-black text-[#18352D]">
                              {formatRupiah(
                                qty
                              )}
                            </span>

                            <span className="mt-0.5 text-[11px] text-gray-400">
                              {itemUnit}
                            </span>

                          </div>

                        </td>

                        <td className="px-5 py-5 text-right align-middle">

                          <div className="flex flex-col items-end">

                            <div className="flex items-center gap-2">

                              <span className="text-base font-black text-[#18352D]">
                                Rp{" "}
                                {formatRupiah(
                                  price
                                )}
                              </span>

                              {priceInfo.changed && (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black ${
                                    priceInfo.direction ===
                                    "UP"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  {priceInfo.direction ===
                                  "UP" ? (
                                    <ArrowUp
                                      size={10}
                                      strokeWidth={
                                        3
                                      }
                                    />
                                  ) : (
                                    <ArrowDown
                                      size={10}
                                      strokeWidth={
                                        3
                                      }
                                    />
                                  )}

                                  {priceInfo.direction ===
                                  "UP"
                                    ? "NAIK"
                                    : "TURUN"}

                                  <span>
                                    {formatPercent(
                                      priceInfo.persen
                                    )}
                                  </span>
                                </span>
                              )}

                            </div>

                            <span className="mt-1 text-[11px] text-gray-400">
                              per {itemUnit}
                            </span>

                            {priceInfo.changed && (
                              <div
                                className={`mt-3 w-full min-w-[270px] rounded-xl border bg-white p-3 text-left shadow-sm ${
                                  priceInfo.direction ===
                                  "UP"
                                    ? "border-red-200"
                                    : "border-emerald-200"
                                }`}
                              >

                                <div className="flex items-center justify-between gap-3">

                                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                    Harga Terakhir
                                  </span>

                                  <span className="text-xs font-black text-[#18352D]">
                                    Rp{" "}
                                    {formatRupiah(
                                      priceInfo.hargaLama
                                    )}
                                  </span>

                                </div>

                                <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#EDF2EF] pt-2">

                                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                    Harga PO
                                  </span>

                                  <span className="text-xs font-black text-[#18352D]">
                                    Rp{" "}
                                    {formatRupiah(
                                      priceInfo.hargaBaru
                                    )}
                                  </span>

                                </div>

                                <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#EDF2EF] pt-2">

                                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                    Selisih
                                  </span>

                                  <span
                                    className={`text-xs font-black ${
                                      priceInfo.direction ===
                                      "UP"
                                        ? "text-red-600"
                                        : "text-emerald-600"
                                    }`}
                                  >
                                    {formatSignedRupiah(
                                      priceInfo.difference
                                    )}
                                  </span>

                                </div>

                                <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#EDF2EF] pt-2">

                                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                    Perubahan
                                  </span>

                                  <span
                                    className={`text-xs font-black ${
                                      priceInfo.direction ===
                                      "UP"
                                        ? "text-red-600"
                                        : "text-emerald-600"
                                    }`}
                                  >
                                    {formatPercent(
                                      priceInfo.persen
                                    )}
                                  </span>

                                </div>

                                {priceInfo.supplier && (
                                  <div className="mt-2 border-t border-[#EDF2EF] pt-2">

                                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                      Supplier Harga Terakhir
                                    </p>

                                    <p className="mt-1 truncate text-xs font-bold text-[#497F70]">
                                      {priceInfo.supplier}
                                    </p>

                                  </div>
                                )}

                                <p className="mt-3 text-[10px] leading-4 text-gray-400">
                                  Harga PO dibandingkan
                                  dengan harga
                                  pembelian terakhir
                                  yang tersimpan pada
                                  riwayat harga barang.
                                </p>

                              </div>
                            )}

                          </div>

                        </td>

                        <td className="px-5 py-5 text-right align-middle">

                          <div className="inline-flex flex-col items-end">

                            <span className="text-base font-black text-[#18352D]">
                              Rp{" "}
                              {formatRupiah(
                                subtotal
                              )}
                            </span>

                            <span className="mt-1 text-[11px] text-gray-400">
                              {formatRupiah(
                                qty
                              )}{" "}
                              × Rp{" "}
                              {formatRupiah(
                                price
                              )}
                            </span>

                          </div>

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
                      className="px-5 py-16 text-center"
                    >
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                        <PackageCheck
                          size={25}
                        />
                      </div>

                      <p className="mt-4 font-bold text-gray-600">
                        Tidak ada item Purchase
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        Belum terdapat barang pada
                        Purchase Order ini.
                      </p>
                    </td>
                  </tr>
                )}

              </tbody>

              <tfoot>

                <tr className="border-t-2 border-[#DDE9E4] bg-[#F5F8F6]">

                  <td
                    colSpan={4}
                    className="px-5 py-5 text-right text-xs font-black uppercase tracking-wider text-[#527268]"
                  >
                    Total
                  </td>

                  <td className="px-5 py-5 text-right">

                    <span className="text-base font-black text-[#18352D]">
                      {formatRupiah(
                        totalQty
                      )}
                    </span>

                    <p className="mt-1 text-[11px] text-gray-400">
                      Total Qty
                    </p>

                  </td>

                  <td className="px-5 py-5 text-right text-sm font-semibold text-gray-400">
                    —
                  </td>

                  <td className="px-5 py-5 text-right">

                    <span className="text-lg font-black text-[#18352D]">
                      Rp{" "}
                      {formatRupiah(
                        totalNilai
                      )}
                    </span>

                    <p className="mt-1 text-[11px] text-gray-400">
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

        <div className="mb-6">
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

        <div className="mb-8 overflow-hidden rounded-[24px] border border-[#DDE9E4] bg-white p-4 shadow-[0_12px_40px_rgba(24,53,45,0.05)]">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <ShieldCheck
                  size={19}
                />
              </div>

              <div>
                <p className="text-sm font-bold text-[#18352D]">
                  {purchase.status ===
                  "COMPLETED"
                    ? "Purchase Order selesai diproses"
                    : "Purchase Order"}
                </p>

                <p className="text-xs text-gray-400">
                  {purchase.number}
                </p>
              </div>

            </div>

            <div className="flex flex-wrap justify-end gap-2">

              {isDraft && (
                <>
                  <button
                    onClick={() =>
                      router.push(
                        `/purchase/${purchase.id}/edit`
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/10 transition hover:bg-amber-600"
                  >
                    <Edit
                      size={17}
                    />
                    Edit Purchase
                  </button>

                  {canDelete && (
                    <button
                      onClick={
                        deletePurchase
                      }
                      disabled={
                        deleting
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2
                        size={17}
                      />

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
                  className="inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#497F70]/15 transition hover:-translate-y-0.5 hover:bg-[#3D6D60]"
                >
                  <CreditCard
                    size={17}
                  />
                  {paymentButtonLabel}
                </button>
              )}

              <button
                type="button"
                onClick={
                  sendPurchaseWhatsApp
                }
                className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#20BD5B]"
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
                className="inline-flex items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-5 py-3 text-sm font-bold text-gray-700 transition hover:bg-[#F5F8F6]"
              >
                <ArrowLeft
                  size={17}
                />
                Kembali
              </button>

            </div>

          </div>

        </div>

      </div>

      {/* =====================================================
          APPROVE PURCHASE MODAL
      ===================================================== */}

      {showApproveModal && purchase && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0C211B]/70 p-4 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !approving) {
              setShowApproveModal(false);
            }
          }}
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_30px_100px_rgba(8,32,25,0.30)]">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#18352D] via-[#21483D] to-[#102A23] px-6 pb-7 pt-6 text-white">
              <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-emerald-300/10 blur-3xl" />
              <div className="absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-white/5 blur-3xl" />

              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 shadow-inner">
                    <ShieldCheck size={27} />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100/60">
                      Purchase Order
                    </p>
                    <h2 className="mt-1 text-xl font-black tracking-tight">
                      Konfirmasi Approval
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  disabled={approving}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/60 transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="rounded-2xl border border-[#DCEAE4] bg-[#F7FAF8] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Nomor PO
                    </p>
                    <p className="mt-1 text-sm font-black text-[#18352D]">
                      {purchase.number}
                    </p>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E7F1EC] text-[#315E50]">
                    <CheckCircle2 size={19} />
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-sm font-bold text-[#18352D]">
                  Anda yakin ingin approve Purchase Order ini?
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Setelah disetujui, PO akan berubah menjadi{" "}
                  <span className="font-bold text-[#315E50]">
                    APPROVED
                  </span>{" "}
                  dan tidak dapat diedit atau dihapus lagi.
                </p>
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4">
                <Info
                  size={17}
                  className="mt-0.5 shrink-0 text-amber-600"
                />
                <p className="text-xs leading-5 text-amber-800">
                  Pastikan supplier, item, qty, harga, dan metode pembayaran
                  sudah benar sebelum melanjutkan approval.
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  disabled={approving}
                  className="rounded-2xl border border-[#D8E4DF] bg-white px-4 py-3 text-sm font-bold text-gray-600 transition hover:bg-[#F6F9F7] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={approvePurchase}
                  disabled={approving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#244A40] via-[#18352D] to-[#102A23] px-4 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(24,53,45,0.20)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(24,53,45,0.26)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {approving ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <ShieldCheck size={17} />
                  )}
                  {approving
                    ? "Memproses..."
                    : "Ya, Approve PO"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          PAYMENT MODAL
      ===================================================== */}

      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#10251F]/65 p-3 backdrop-blur-md sm:p-5">

          <div className="relative flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-[30px] border border-white/60 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.25)]">

            <div className="relative overflow-hidden bg-[#18352D] px-6 py-6 text-white">

              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#497F70]/30 blur-3xl" />

              <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-white/5 blur-3xl" />

              <div className="relative flex items-start justify-between gap-4">

                <div className="flex min-w-0 items-center gap-4">

                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                    <CreditCard
                      size={22}
                    />
                  </div>

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <h2 className="text-lg font-black sm:text-xl">
                        {paymentModalTitle}
                      </h2>

                      {isSettlementModal && (
                        <span className="rounded-full bg-orange-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-200 ring-1 ring-orange-300/20">
                          Settlement
                        </span>
                      )}

                      {isInitialTempoModal && (
                        <span className="rounded-full bg-blue-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-200 ring-1 ring-blue-300/20">
                          TEMPO
                        </span>
                      )}

                    </div>

                    <p className="mt-1 truncate text-sm text-white/60">
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X size={19} />
                </button>

              </div>

              <div className="relative mt-6 grid grid-cols-2 gap-3">

                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                    Metode
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {paymentMethod ||
                      "-"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                    Nilai
                  </p>

                  <p className="mt-1 truncate text-sm font-black">
                    Rp{" "}
                    {formatRupiah(
                      paymentAmount
                    )}
                  </p>
                </div>

              </div>

            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAF9] p-5 sm:p-6">

              <div className="space-y-5">

                {isSettlementModal && (
                  <div className="overflow-hidden rounded-[22px] border border-orange-200 bg-white shadow-sm">

                    <div className="flex items-center gap-3 border-b border-orange-100 bg-orange-50 px-5 py-4">

                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                        <AlertCircle
                          size={18}
                        />
                      </div>

                      <div>
                        <p className="text-sm font-black text-orange-900">
                          Sisa Hutang Purchase
                        </p>

                        <p className="text-xs text-orange-600">
                          Masukkan nilai pelunasan
                        </p>
                      </div>

                    </div>

                    <div className="grid grid-cols-2 gap-4 p-5">

                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Total Hutang
                        </p>

                        <p className="mt-1 text-base font-black text-[#18352D]">
                          Rp{" "}
                          {formatRupiah(
                            payableAmount
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Sudah Dibayar
                        </p>

                        <p className="mt-1 text-base font-black text-emerald-700">
                          Rp{" "}
                          {formatRupiah(
                            payablePaidAmount
                          )}
                        </p>
                      </div>

                    </div>

                    <div className="border-t border-[#E8EFEC] bg-[#F7FAF8] px-5 py-4">

                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        Outstanding
                      </p>

                      <p className="mt-1 text-2xl font-black text-orange-700">
                        Rp{" "}
                        {formatRupiah(
                          payableOutstanding
                        )}
                      </p>

                    </div>

                  </div>
                )}

                {isInitialTempoModal && (
                  <div className="rounded-[22px] border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-5">

                    <div className="flex items-start gap-3">

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                        <Wallet
                          size={19}
                        />
                      </div>

                      <div>

                        <p className="font-black text-blue-900">
                          Pembuatan Purchase Payable
                        </p>

                        <p className="mt-1 text-sm leading-6 text-blue-700">
                          Purchase ini menggunakan
                          metode TEMPO. Proses ini
                          hanya membuat catatan hutang
                          kepada supplier. Tidak ada
                          pengeluaran Petty Cash.
                        </p>

                      </div>

                    </div>

                  </div>
                )}

                {!isSettlementModal && (
                  <div className="rounded-[22px] border border-[#DDE9E4] bg-white p-5 shadow-sm">

                    <div className="flex items-center justify-between gap-4">

                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Total Purchase
                        </p>

                        <p className="mt-1 text-sm font-semibold text-gray-600">
                          Nilai transaksi
                        </p>
                      </div>

                      <p className="text-xl font-black text-[#18352D]">
                        Rp{" "}
                        {formatRupiah(
                          purchase.total
                        )}
                      </p>

                    </div>

                  </div>
                )}

                <PaymentField
                  label={
                    isSettlementModal
                      ? "Metode Pelunasan"
                      : "Metode Pembayaran"
                  }
                  icon={
                    <CreditCard
                      size={16}
                    />
                  }
                >

                  {isSettlementModal ? (
                    <select
                      value={
                        paymentMethod
                      }
                      onChange={(
                        e
                      ) =>
                        setPaymentMethod(
                          e.target.value
                        )
                      }
                      disabled={
                        processingPayment
                      }
                      className="w-full appearance-none rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 disabled:cursor-not-allowed disabled:bg-gray-100"
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
                    <div className="relative">

                      <select
                        value={
                          paymentMethod
                        }
                        disabled
                        className="w-full cursor-not-allowed appearance-none rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 outline-none disabled:opacity-100"
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

                      <ShieldCheck
                        size={16}
                        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600"
                      />

                    </div>
                  )}

                  <p className="mt-2 text-xs leading-5 text-gray-400">
                    {isInitialTempoModal
                      ? "Metode TEMPO mengikuti Purchase Order dan digunakan untuk membuat hutang."
                      : isSettlementModal
                      ? "CASH/COD/CBD mengurangi Petty Cash, sedangkan TRANSFER tidak."
                      : "Metode pembayaran mengikuti Purchase Order dan tidak dapat diubah."}
                  </p>

                </PaymentField>

                <PaymentField
                  label={
                    isSettlementModal
                      ? "Jumlah Pelunasan"
                      : "Jumlah Pembayaran"
                  }
                  icon={
                    <Wallet
                      size={16}
                    />
                  }
                >

                  <div className="relative">

                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">
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
                      onChange={(
                        e
                      ) =>
                        setPaymentAmount(
                          e.target.value
                        )
                      }
                      disabled={
                        processingPayment
                      }
                      className="w-full rounded-xl border border-[#D6E2DD] bg-white py-3.5 pl-12 pr-4 text-base font-bold text-[#18352D] outline-none transition placeholder:text-gray-300 focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10 disabled:cursor-not-allowed disabled:bg-gray-100"
                    />

                  </div>

                  {isSettlementModal ? (
                    <div className="mt-2 flex items-center justify-between text-xs">

                      <span className="text-gray-400">
                        Maksimal pembayaran
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
                        className="font-bold text-[#497F70] hover:text-[#3D6D60] disabled:opacity-50"
                      >
                        Rp{" "}
                        {formatRupiah(
                          payableOutstanding
                        )}
                      </button>

                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-gray-400">
                      Jumlah harus sama dengan total
                      Purchase.
                    </p>
                  )}

                </PaymentField>

                <PaymentField
                  label="Tanggal Pembayaran"
                  icon={
                    <Clock3
                      size={16}
                    />
                  }
                >

                  <input
                    type="date"
                    value={
                      paymentDate
                    }
                    onChange={(
                      e
                    ) =>
                      setPaymentDate(
                        e.target.value
                      )
                    }
                    disabled={
                      processingPayment
                    }
                    className="w-full rounded-xl border border-[#D6E2DD] bg-white px-4 py-3.5 text-sm font-semibold text-[#18352D] outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10 disabled:cursor-not-allowed disabled:bg-gray-100"
                  />

                </PaymentField>

                {paymentMethod ===
                  "TRANSFER" && (
                  <PaymentField
                    label="Nomor Referensi Transfer"
                    required
                    icon={
                      <ReceiptText
                        size={16}
                      />
                    }
                  >

                    <input
                      type="text"
                      value={
                        referenceNumber
                      }
                      onChange={(
                        e
                      ) =>
                        setReferenceNumber(
                          e.target.value
                        )
                      }
                      placeholder="Masukkan nomor referensi / bukti transfer"
                      disabled={
                        processingPayment
                      }
                      className="w-full rounded-xl border border-[#D6E2DD] bg-white px-4 py-3.5 text-sm font-semibold text-[#18352D] outline-none transition placeholder:font-normal placeholder:text-gray-300 focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10 disabled:cursor-not-allowed disabled:bg-gray-100"
                    />

                  </PaymentField>
                )}

                <PaymentField
                  label="Keterangan"
                  icon={
                    <FileText
                      size={16}
                    />
                  }
                >

                  <textarea
                    value={
                      paymentRemarks
                    }
                    onChange={(
                      e
                    ) =>
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
                    className="w-full resize-none rounded-xl border border-[#D6E2DD] bg-white px-4 py-3.5 text-sm text-[#18352D] outline-none transition placeholder:text-gray-300 focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10 disabled:cursor-not-allowed disabled:bg-gray-100"
                  />

                </PaymentField>

                <div
                  className={`rounded-[22px] border p-5 ${
                    isInitialTempoModal
                      ? "border-blue-200 bg-blue-50"
                      : paymentIsTransfer
                      ? "border-purple-200 bg-purple-50"
                      : "border-emerald-200 bg-emerald-50"
                  }`}
                >

                  <div className="flex items-start gap-3">

                    <Info
                      size={18}
                      className={
                        isInitialTempoModal
                          ? "mt-0.5 shrink-0 text-blue-600"
                          : paymentIsTransfer
                          ? "mt-0.5 shrink-0 text-purple-600"
                          : "mt-0.5 shrink-0 text-emerald-600"
                      }
                    />

                    <p
                      className={`text-sm leading-6 ${
                        isInitialTempoModal
                          ? "text-blue-800"
                          : paymentIsTransfer
                          ? "text-purple-800"
                          : "text-emerald-800"
                      }`}
                    >
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

              </div>

            </div>

            <div className="border-t border-[#E3EBE7] bg-white p-4 sm:p-5">

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={
                    closePaymentModal
                  }
                  disabled={
                    processingPayment
                  }
                  className="inline-flex items-center justify-center rounded-xl border border-[#D6E2DD] bg-white px-5 py-3 text-sm font-bold text-gray-700 transition hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#497F70]/20 transition hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-60"
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

        </div>
      )}

    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  label,
  value,
  subtitle,
  icon,
  tone,
  emphasis = false,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  tone:
    | "green"
    | "blue"
    | "orange"
    | "purple";
  emphasis?: boolean;
}) {
  const toneMap = {
    green: {
      box: "bg-[#EAF3EF] text-[#497F70]",
      dot: "bg-[#497F70]",
    },
    blue: {
      box: "bg-blue-50 text-blue-600",
      dot: "bg-blue-500",
    },
    orange: {
      box: "bg-orange-50 text-orange-600",
      dot: "bg-orange-500",
    },
    purple: {
      box: "bg-purple-50 text-purple-600",
      dot: "bg-purple-500",
    },
  };

  const current =
    toneMap[tone];

  return (
    <div className="group rounded-[24px] border border-[#DDE9E4] bg-white p-5 shadow-[0_8px_30px_rgba(24,53,45,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_38px_rgba(24,53,45,0.07)]">

      <div className="flex items-start justify-between gap-4">

        <div className="min-w-0">

          <div className="flex items-center gap-2">

            <span
              className={`h-2 w-2 rounded-full ${current.dot}`}
            />

            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              {label}
            </p>

          </div>

          <p
            className={`mt-3 truncate ${
              emphasis
                ? "text-xl"
                : "text-lg"
            } font-black text-[#18352D]`}
          >
            {value}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            {subtitle}
          </p>

        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${current.box}`}
        >
          {icon}
        </div>

      </div>

    </div>
  );
}

/* =========================================================
   PAYABLE CARD
========================================================= */

function PayableCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone:
    | "blue"
    | "green"
    | "orange";
}) {
  const styles = {
    blue: {
      card: "border-blue-200 bg-gradient-to-br from-blue-50 to-white",
      label: "text-blue-600",
      value: "text-blue-900",
      icon: "bg-blue-100 text-blue-700",
    },
    green: {
      card: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
      label: "text-emerald-600",
      value: "text-emerald-900",
      icon: "bg-emerald-100 text-emerald-700",
    },
    orange: {
      card: "border-orange-200 bg-gradient-to-br from-orange-50 to-white",
      label: "text-orange-600",
      value: "text-orange-900",
      icon: "bg-orange-100 text-orange-700",
    },
  };

  const current =
    styles[tone];

  return (
    <div
      className={`rounded-[24px] border p-5 shadow-sm ${current.card}`}
    >

      <div className="flex items-center justify-between gap-4">

        <div>
          <p
            className={`text-[11px] font-bold uppercase tracking-wider ${current.label}`}
          >
            {label}
          </p>

          <p
            className={`mt-2 text-xl font-black ${current.value}`}
          >
            Rp{" "}
            {Number(
              value || 0
            ).toLocaleString(
              "id-ID"
            )}
          </p>

        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${current.icon}`}
        >
          {icon}
        </div>

      </div>

    </div>
  );
}

/* =========================================================
   INFORMATION CARD
========================================================= */

function InformationCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-[#DDE9E4] bg-white shadow-[0_10px_35px_rgba(24,53,45,0.04)]">

      <div className="flex items-center gap-3 border-b border-[#E8EFEC] bg-[#FBFCFB] px-5 py-5 md:px-6">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
          {icon}
        </div>

        <div>
          <h2 className="text-base font-black text-[#18352D]">
            {title}
          </h2>

          <p className="mt-0.5 text-xs text-gray-400">
            Informasi terkait transaksi
          </p>
        </div>

      </div>

      <div className="divide-y divide-[#EDF2EF] px-5 md:px-6">
        {children}
      </div>

    </div>
  );
}

/* =========================================================
   INFO ROW
========================================================= */

function InfoRow({
  label,
  value,
  strong = false,
  highlight = false,
  breakWord = false,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
  highlight?: boolean;
  breakWord?: boolean;
}) {
  return (
    <div className="grid grid-cols-[105px_minmax(0,1fr)] gap-4 py-4 sm:grid-cols-[125px_minmax(0,1fr)]">

      <span className="text-xs font-bold uppercase tracking-wide text-gray-400">
        {label}
      </span>

      <span
        className={`min-w-0 text-sm ${
          strong
            ? "font-bold text-[#18352D]"
            : "text-gray-600"
        } ${
          highlight
            ? "text-base font-black text-[#497F70]"
            : ""
        } ${
          breakWord
            ? "break-all"
            : ""
        }`}
      >
        {value}
      </span>

    </div>
  );
}

/* =========================================================
   PAYMENT FIELD
========================================================= */

function PaymentField({
  label,
  icon,
  required = false,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>

      <label className="mb-2.5 flex items-center gap-2 text-sm font-bold text-[#18352D]">

        {icon && (
          <span className="text-[#497F70]">
            {icon}
          </span>
        )}

        {label}

        {required && (
          <span className="text-red-500">
            *
          </span>
        )}

      </label>

      {children}

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
      aria-hidden="true"
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

      <path d="M8.5 7.8c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.7c.1.3.1.5-.1.7l-.5.6c-.2.2-.2.4-.1.6.4.8 1 1.4 1.7 1.9.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.7-.1l1.7.8c.3.1.4.3.4.5v.5c0 .3-.1.6-.4.8-.4.3-1 .5-1.5.4-1.4-.2-2.8-1-4-2.1-4-2.1-1.1-3.5-1.9-3.5-2.3-.1-1.2.2-1.9.7-2.6Z" />
    </svg>
  );
}