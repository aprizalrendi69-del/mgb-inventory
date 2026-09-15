"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  PackageCheck,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  Ban,
  AlertTriangle,
  Store,
  Truck,
  ShoppingCart,
  CalendarDays,
  FileText,
  Package,
  CircleDot,
  ShieldCheck,
  Clock3,
  ChevronRight,
  Info,
  Sparkles,
  LockKeyhole,
  X,
  Check,
  ArrowDownToLine,
} from "lucide-react";

type Item = {
  id: number;
  qty: number;
  receivedQty?: number | null;
  price: number;
  subtotal: number;
  voided?: boolean | null;
  isVoided?: boolean | null;
  voidStatus?: string | null;
  status?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  reason?: string | null;
  is_voided?: boolean | null;
  void_status?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  barang: {
    id: number;
    code: string;
    name: string;
    unit: string;
  };
};

type OutletInfo = {
  id?: number | null;
  code: string;
  name: string;
  active?: boolean;
};

type PayableInfo = {
  id: number;
  invoiceNumber: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  amount: number;
  paidAmount: number;
  outstanding: number;
  status: string;
};

type PurchaseInfo = {
  id: number;
  number: string;
  status: string;
  purchaseDate?: string;
  remarks?: string | null;
  paymentMethod?: string | null;
  invoiceNumber?: string | null;
  payable?: PayableInfo | null;
  invoiceRequired?: boolean;
};

type Detail = {
  id: number;
  sourceId: number;
  sumber: "PURCHASE" | "TRANSFER";
  nomor: string;
  tanggal: string;
  status: string;
  remarks?: string | null;

  outlet?: OutletInfo | null;

  supplier?: {
    id?: number;
    code: string;
    name: string;
  } | null;

  sourceOutlet?: OutletInfo | null;

  purchase?: PurchaseInfo | null;

  transfer?: {
    id: number;
    number: string;
    status: string;
    transferDate?: string;
    remarks?: string | null;
    sourceOutlet?: OutletInfo | null;
    destinationOutlet?: OutletInfo | null;
  } | null;

  items: Item[];

  totalQty?: number;
  totalReceivedQty?: number;
  totalValue?: number;
};

type CurrentUser = {
  id?: number;
  role?: string;
  outletId?: number | null;
};

type FeedbackState = {
  open: boolean;
  type: "success" | "error";
  title: string;
  message: string;
};

export default function OutletBarangMasukDetailPage() {
  const params = useParams();
  const router = useRouter();

  const id = String(params.id);

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState(false);

  const [role, setRole] = useState("");
  const [userOutletId, setUserOutletId] =
    useState<number | null>(null);

  const [receivedQty, setReceivedQty] =
    useState<Record<number, number>>({});

  const [invoiceNumber, setInvoiceNumber] =
    useState("");

  // =====================================================
  // CUSTOM MODAL
  // =====================================================

  const [confirmOpen, setConfirmOpen] = useState(false);

  const [feedback, setFeedback] =
    useState<FeedbackState>({
      open: false,
      type: "success",
      title: "",
      message: "",
    });

  // =====================================================
  // HELPERS
  // =====================================================

  const normalizeStatus = (
    value?: string | null
  ) =>
    String(value || "")
      .trim()
      .toUpperCase();

  const normalizePaymentMethod = (
    value?: string | null
  ) =>
    String(value || "")
      .trim()
      .toUpperCase();

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 2,
    }).format(Number(value || 0));

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  const formatDate = (
    value?: string | null
  ) => {
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
  };

  const formatDateTime = (
    value?: string | null
  ) => {
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
  };

  const isItemVoided = (
    item: Item
  ) => {
    if (
      item.voided === true ||
      item.isVoided === true ||
      item.is_voided === true
    ) {
      return true;
    }

    const status = normalizeStatus(
      item.voidStatus ??
        item.void_status ??
        item.status
    );

    if (
      status === "VOID" ||
      status === "VOIDED" ||
      status === "CANCELLED" ||
      status === "CANCELED"
    ) {
      return true;
    }

    if (
      item.voidedAt ||
      item.voided_at ||
      item.voidReason ||
      item.void_reason
    ) {
      return true;
    }

    return false;
  };

  const getVoidReason = (
    item: Item
  ) =>
    item.voidReason ??
    item.void_reason ??
    item.reason ??
    null;

  const showFeedback = (
    type: "success" | "error",
    title: string,
    message: string
  ) => {
    setFeedback({
      open: true,
      type,
      title,
      message,
    });
  };

  const closeFeedback = () => {
    setFeedback((prev) => ({
      ...prev,
      open: false,
    }));
  };

  // =====================================================
  // LOAD CURRENT USER
  // =====================================================

  const loadCurrentUser = async () => {
    try {
      const response = await fetch(
        "/api/me",
        {
          cache: "no-store",
        }
      );

      if (!response.ok) return;

      const result = await response.json();

      const user: CurrentUser =
        result?.user ??
        result?.data ??
        result ??
        {};

      setRole(
        String(user.role || "")
          .trim()
          .toUpperCase()
      );

      setUserOutletId(
        user.outletId == null
          ? null
          : Number(user.outletId)
      );
    } catch (error) {
      console.error(
        "LOAD CURRENT USER ERROR:",
        error
      );
    }
  };

  // =====================================================
  // LOAD DETAIL
  // =====================================================

  const loadData = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `/api/outlet/barang-masuk/${encodeURIComponent(
          id
        )}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        setData(null);
        return;
      }

      const result = await response.json();

      const detail: Detail =
        result?.data ?? result;

      if (!detail) {
        setData(null);
        return;
      }

      const normalizedItems = Array.isArray(
        detail.items
      )
        ? detail.items.map(
            (item: Item) => ({
              ...item,
              voided:
                item.voided ??
                item.isVoided ??
                item.is_voided ??
                false,
            })
          )
        : [];

      const normalizedDetail: Detail = {
        ...detail,
        items: normalizedItems,
      };

      setData(normalizedDetail);

      const initialReceived: Record<
        number,
        number
      > = {};

      normalizedItems.forEach(
        (item: Item) => {
          if (isItemVoided(item)) {
            initialReceived[item.id] = 0;
            return;
          }

          if (
            normalizedDetail.sumber ===
            "TRANSFER"
          ) {
            initialReceived[item.id] =
              Number(
                item.receivedQty ?? 0
              );
          } else {
            initialReceived[item.id] =
              Number(
                item.receivedQty ??
                  item.qty ??
                  0
              );
          }
        }
      );

      setReceivedQty(initialReceived);

      const storedInvoice =
        normalizedDetail.purchase
          ?.invoiceNumber ??
        normalizedDetail.purchase
          ?.payable?.invoiceNumber ??
        "";

      setInvoiceNumber(
        String(storedInvoice || "")
      );
    } catch (error) {
      console.error(
        "LOAD BARANG MASUK DETAIL ERROR:",
        error
      );

      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentUser();
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // =====================================================
  // DERIVED STATUS
  // =====================================================

  const normalizedStatus = normalizeStatus(
    data?.status
  );

  const purchaseStatus = normalizeStatus(
    data?.purchase?.status
  );

  const purchasePaymentMethod =
    normalizePaymentMethod(
      data?.purchase?.paymentMethod
    );

  const purchasePayable =
    data?.purchase?.payable ?? null;

  const isPurchase =
    data?.sumber === "PURCHASE";

  const isTransfer =
    data?.sumber === "TRANSFER";

  const isTempoPurchase =
    isPurchase &&
    purchasePaymentMethod === "TEMPO";

  const invoiceNumberTrimmed =
    invoiceNumber.trim();

  const invoiceRequired =
    isTempoPurchase && !purchasePayable;

  const invoiceNumberValid =
    !invoiceRequired ||
    invoiceNumberTrimmed.length > 0;

  const alreadyReceived =
    (isPurchase &&
      purchaseStatus === "RECEIVED") ||
    normalizedStatus === "RECEIVED" ||
    normalizedStatus === "SELESAI";

  const isPartial =
    normalizedStatus === "PARTIAL";

  const isWaiting =
    normalizedStatus === "SENT" ||
    normalizedStatus === "PENDING";

  // =====================================================
  // OUTLET
  // =====================================================

  const destinationOutlet =
    data?.transfer?.destinationOutlet ??
    data?.outlet ??
    null;

  const sourceOutlet =
    data?.transfer?.sourceOutlet ??
    data?.sourceOutlet ??
    null;

  const isOutletUser =
    role === "OUTLET_ADMIN" ||
    role === "ADMIN_OUTLET";

  const destinationOutletId =
    destinationOutlet?.id == null
      ? null
      : Number(destinationOutlet.id);

  const outletOwnershipValid =
    !isOutletUser ||
    destinationOutletId == null ||
    userOutletId == null ||
    destinationOutletId === userOutletId;

  // =====================================================
  // ITEMS
  // =====================================================

  const receivableItems = useMemo(
    () =>
      (data?.items ?? []).filter(
        (item) => !isItemVoided(item)
      ),
    [data?.items]
  );

  const voidedItems = useMemo(
    () =>
      (data?.items ?? []).filter(
        (item) => isItemVoided(item)
      ),
    [data?.items]
  );

  const hasReceivableItems =
    receivableItems.length > 0;

  // =====================================================
  // TOTALS
  // =====================================================

  const totalQty = useMemo(
    () =>
      receivableItems.reduce(
        (sum, item) =>
          sum + Number(item.qty || 0),
        0
      ),
    [receivableItems]
  );

  const totalVoidQty = useMemo(
    () =>
      voidedItems.reduce(
        (sum, item) =>
          sum + Number(item.qty || 0),
        0
      ),
    [voidedItems]
  );

  const totalReceivedQty = useMemo(
    () =>
      receivableItems.reduce(
        (sum, item) => {
          if (isTransfer) {
            return (
              sum +
              Number(
                receivedQty[item.id] ?? 0
              )
            );
          }

          return (
            sum +
            Number(
              item.receivedQty ??
                item.qty ??
                0
            )
          );
        },
        0
      ),
    [
      receivableItems,
      receivedQty,
      isTransfer,
    ]
  );

  const totalValue = useMemo(
    () =>
      receivableItems.reduce(
        (sum, item) =>
          sum +
          Number(item.qty || 0) *
            Number(item.price || 0),
        0
      ),
    [receivableItems]
  );

  const totalReceivedValue = useMemo(
    () =>
      receivableItems.reduce(
        (sum, item) => {
          const qty =
            isTransfer
              ? Number(
                  receivedQty[item.id] ??
                    0
                )
              : Number(
                  item.receivedQty ??
                    item.qty ??
                    0
                );

          return (
            sum +
            qty *
              Number(item.price || 0)
          );
        },
        0
      ),
    [
      receivableItems,
      receivedQty,
      isTransfer,
    ]
  );

  const totalVoidValue = useMemo(
    () =>
      voidedItems.reduce(
        (sum, item) =>
          sum +
          Number(item.qty || 0) *
            Number(item.price || 0),
        0
      ),
    [voidedItems]
  );

  const totalRemainingQty =
    Math.max(
      0,
      totalQty - totalReceivedQty
    );

  const receiveProgress =
    totalQty > 0
      ? Math.min(
          100,
          Math.round(
            (totalReceivedQty /
              totalQty) *
              100
          )
        )
      : 0;

  // =====================================================
  // TRANSFER VALIDATION
  // =====================================================

  const transferQtyValid = useMemo(() => {
    if (!isTransfer) return true;

    return receivableItems.every(
      (item) => {
        const qtyKirim = Number(
          item.qty || 0
        );

        const qtyDiterima = Number(
          receivedQty[item.id] ?? 0
        );

        return (
          qtyDiterima >= 0 &&
          qtyDiterima <= qtyKirim
        );
      }
    );
  }, [
    isTransfer,
    receivableItems,
    receivedQty,
  ]);

  const transferTotalReceived =
    useMemo(() => {
      if (!isTransfer) return 0;

      return receivableItems.reduce(
        (sum, item) =>
          sum +
          Number(
            receivedQty[item.id] ?? 0
          ),
        0
      );
    }, [
      isTransfer,
      receivableItems,
      receivedQty,
    ]);

  const canReceive =
    Boolean(data) &&
    !alreadyReceived &&
    hasReceivableItems &&
    outletOwnershipValid &&
    (isPurchase
      ? purchaseStatus === "APPROVED" &&
        invoiceNumberValid
      : isTransfer
      ? transferQtyValid &&
        transferTotalReceived > 0
      : false);

  // =====================================================
  // QTY CHANGE
  // =====================================================

  const handleQtyChange = (
    item: Item,
    value: string
  ) => {
    let qty = Number(value);

    if (!Number.isFinite(qty)) {
      qty = 0;
    }

    const maxQty = Number(
      item.qty || 0
    );

    qty = Math.max(
      0,
      Math.min(qty, maxQty)
    );

    setReceivedQty(
      (prev) => ({
        ...prev,
        [item.id]: qty,
      })
    );
  };

  // =====================================================
  // PRE-RECEIVE VALIDATION
  // =====================================================

  const validateBeforeReceive = () => {
    if (!data || receiving) return false;

    if (alreadyReceived) {
      showFeedback(
        "error",
        "Transaksi Sudah Diterima",
        "Transaksi ini sudah selesai diproses dan tidak dapat diterima kembali."
      );
      return false;
    }

    if (!outletOwnershipValid) {
      showFeedback(
        "error",
        "Akses Outlet Tidak Valid",
        "Transaksi ini bukan untuk outlet Anda."
      );
      return false;
    }

    if (!hasReceivableItems) {
      showFeedback(
        "error",
        "Tidak Ada Item",
        "Tidak ada item yang dapat diterima pada transaksi ini."
      );
      return false;
    }

    if (
      isPurchase &&
      purchaseStatus !== "APPROVED"
    ) {
      showFeedback(
        "error",
        "Purchase Belum Di-approve",
        "Purchase Order belum di-approve sehingga barang belum dapat diterima."
      );
      return false;
    }

    if (
      isPurchase &&
      invoiceRequired &&
      !invoiceNumberTrimmed
    ) {
      showFeedback(
        "error",
        "Invoice Supplier Wajib",
        "Nomor invoice supplier wajib diisi untuk Purchase dengan pembayaran TEMPO."
      );
      return false;
    }

    if (isTransfer) {
      if (!transferQtyValid) {
        showFeedback(
          "error",
          "Qty Tidak Valid",
          "Qty diterima tidak valid. Pastikan tidak melebihi Qty Kirim."
        );
        return false;
      }

      if (transferTotalReceived <= 0) {
        showFeedback(
          "error",
          "Qty Belum Diisi",
          "Isi minimal satu Qty Diterima sebelum melakukan penerimaan."
        );
        return false;
      }
    }

    return true;
  };

  // =====================================================
  // OPEN CONFIRMATION MODAL
  // =====================================================

  const handleReceive = () => {
    if (!validateBeforeReceive()) {
      return;
    }

    setConfirmOpen(true);
  };

  // =====================================================
  // EXECUTE RECEIVE
  // =====================================================

  const executeReceive = async () => {
    if (!data || receiving) return;

    try {
      setReceiving(true);

      let response: Response;

      if (isTransfer) {
        response = await fetch(
          `/api/outlet/barang-masuk/${encodeURIComponent(
            id
          )}/receive`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              items:
                receivableItems.map(
                  (item) => ({
                    id: item.id,
                    receivedQty:
                      Number(
                        receivedQty[
                          item.id
                        ] ?? 0
                      ),
                  })
                ),
            }),
          }
        );
      } else {
        response = await fetch(
          "/api/outlet/barang-masuk/receive",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              purchaseId:
                data.sourceId,
              invoiceNumber:
                invoiceNumberTrimmed ||
                null,
            }),
          }
        );
      }

      const result =
        await response.json().catch(
          () => ({})
        );

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.error ||
            "Gagal memproses penerimaan barang."
        );
      }

      setConfirmOpen(false);

      showFeedback(
        "success",
        "Penerimaan Berhasil",
        result?.message ||
          "Barang berhasil diterima dan stok outlet telah diperbarui."
      );

      await loadData();
    } catch (error) {
      console.error(
        "RECEIVE BARANG MASUK ERROR:",
        error
      );

      setConfirmOpen(false);

      showFeedback(
        "error",
        "Penerimaan Gagal",
        error instanceof Error
          ? error.message
          : "Gagal memproses penerimaan barang."
      );
    } finally {
      setReceiving(false);
    }
  };

  // =====================================================
  // PREMIUM RECEIVE BUTTON
  // =====================================================

  const receiveButtonLabel = receiving
    ? "Memproses Penerimaan..."
    : isTransfer
    ? isPartial
      ? "Terima Sisa Barang"
      : "Terima Barang"
    : "Terima Barang";

  const renderPremiumReceiveButton = (
    variant: "hero" | "bottom"
  ) => {
    if (!canReceive) return null;

    if (variant === "hero") {
      return (
        <button
          type="button"
          onClick={handleReceive}
          disabled={receiving}
          className="group relative inline-flex min-w-[210px] items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/20 bg-white px-5 py-3.5 text-left text-[#18352D] shadow-[0_12px_30px_rgba(0,0,0,0.16)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#F8FCFA] hover:shadow-[0_16px_38px_rgba(0,0,0,0.22)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#497F70]/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm transition-transform duration-300 group-hover:scale-105">
            {receiving ? (
              <RefreshCw
                size={18}
                className="animate-spin"
              />
            ) : (
              <PackageCheck size={19} />
            )}
          </span>

          <span className="relative min-w-0">
            <span className="block text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#497F70]">
              {receiving
                ? "Sedang diproses"
                : "Penerimaan barang"}
            </span>

            <span className="mt-0.5 block whitespace-nowrap text-sm font-extrabold">
              {receiveButtonLabel}
            </span>
          </span>

          {!receiving && (
            <span className="relative ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EDF5F1] text-[#497F70] transition-transform duration-300 group-hover:translate-x-0.5">
              <ArrowRight size={15} />
            </span>
          )}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleReceive}
        disabled={receiving}
        className="group relative inline-flex min-w-[205px] items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-[#497F70] to-[#3E6E61] px-5 py-3 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(73,127,112,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(73,127,112,0.3)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        <span className="absolute inset-0 bg-white/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {receiving ? (
          <RefreshCw
            size={17}
            className="relative animate-spin"
          />
        ) : (
          <CheckCircle2
            size={17}
            className="relative"
          />
        )}

        <span className="relative">
          {receiveButtonLabel}
        </span>

        {!receiving && (
          <ArrowRight
            size={15}
            className="relative transition-transform duration-300 group-hover:translate-x-0.5"
          />
        )}
      </button>
    );
  };

  // =====================================================
  // BADGES
  // =====================================================

  const sourceBadge = () => {
    if (data?.sumber === "PURCHASE") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-purple-700">
          <ShoppingCart size={12} />
          Purchase Supplier
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-700">
        <Truck size={12} />
        Transfer Outlet
      </span>
    );
  };

  const statusBadge = () => {
    if (
      normalizedStatus ===
        "RECEIVED" ||
      normalizedStatus ===
        "SELESAI"
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
          <CheckCircle2 size={12} />
          DITERIMA
        </span>
      );
    }

    if (normalizedStatus === "PARTIAL") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-orange-700">
          <Clock3 size={12} />
          PARTIAL
        </span>
      );
    }

    if (
      normalizedStatus === "SENT" ||
      normalizedStatus === "PENDING"
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-700">
          <Truck size={12} />
          MENUNGGU PENERIMAAN
        </span>
      );
    }

    if (normalizedStatus === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
          <ShieldCheck size={12} />
          APPROVED
        </span>
      );
    }

    if (normalizedStatus === "DRAFT") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-gray-600">
          DRAFT
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-gray-600">
        {normalizedStatus ||
          "UNKNOWN"}
      </span>
    );
  };

  const purchaseStatusBadge = () => {
    if (
      purchaseStatus === "APPROVED"
    ) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700">
          <CheckCircle2 size={11} />
          APPROVED
        </span>
      );
    }

    if (
      purchaseStatus === "RECEIVED"
    ) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-blue-700">
          <CheckCircle2 size={11} />
          RECEIVED
        </span>
      );
    }

    if (purchaseStatus === "DRAFT") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-gray-600">
          DRAFT
        </span>
      );
    }

    return (
      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-gray-600">
        {purchaseStatus || "-"}
      </span>
    );
  };

  const voidBadge = (
    item: Item
  ) => {
    if (!isItemVoided(item)) {
      return null;
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-white">
        <Ban size={10} />
        VOID
      </span>
    );
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="min-h-[80vh] bg-[#F5F8F6] p-6 md:p-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6 h-8 w-64 animate-pulse rounded-lg bg-gray-200" />

          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({
              length: 4,
            }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-white"
              />
            ))}
          </div>

          <div className="mt-6 h-96 animate-pulse rounded-2xl border border-gray-200 bg-white" />

          <div className="mt-6 flex items-center justify-center gap-3 text-sm text-gray-500">
            <RefreshCw
              size={17}
              className="animate-spin text-[#497F70]"
            />
            Memuat detail barang masuk...
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // NOT FOUND
  // =====================================================

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F5F8F6] p-6 md:p-8">
        <div className="mx-auto max-w-[900px]">
          <button
            type="button"
            onClick={() =>
              router.push(
                "/outlet/barang-masuk"
              )
            }
            className="mb-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#497F70] transition hover:bg-white"
          >
            <ArrowLeft size={17} />
            Kembali
          </button>

          <div className="overflow-hidden rounded-3xl border border-[#DDE9E4] bg-white shadow-sm">
            <div className="bg-gradient-to-br from-[#EDF6F1] to-white px-6 py-14 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#497F70]/10">
                <PackageCheck
                  size={30}
                  className="text-[#497F70]"
                />
              </div>

              <h2 className="mt-5 text-xl font-extrabold text-[#18352D]">
                Data barang masuk tidak
                ditemukan
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                Transaksi mungkin sudah
                dihapus atau Anda tidak
                memiliki akses untuk melihat
                data ini.
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/outlet/barang-masuk"
                  )
                }
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#3E6E61]"
              >
                Kembali ke Barang Masuk
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-screen bg-[#F5F8F6]">
      <div className="mx-auto max-w-[1600px] p-5 md:p-7 lg:p-8">

        {/* BREADCRUMB */}
        <div className="mb-5 flex items-center gap-2 text-xs font-semibold text-gray-400">
          <button
            type="button"
            onClick={() =>
              router.push(
                "/outlet/barang-masuk"
              )
            }
            className="transition hover:text-[#497F70]"
          >
            Barang Masuk
          </button>

          <ChevronRight size={13} />

          <span className="text-[#497F70]">
            Detail
          </span>
        </div>

        {/* HERO HEADER */}
        <div className="mb-6 overflow-hidden rounded-3xl border border-[#DCE9E3] bg-white shadow-[0_8px_30px_rgba(38,73,58,0.06)]">

          <div className="relative overflow-hidden bg-gradient-to-br from-[#29483A] via-[#355F4F] to-[#497F70] px-6 py-7 text-white md:px-8 md:py-8">

            <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/5" />
            <div className="absolute -bottom-32 right-24 h-72 w-72 rounded-full bg-white/5" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-start gap-4">

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/outlet/barang-masuk"
                    )
                  }
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
                  title="Kembali"
                >
                  <ArrowLeft size={19} />
                </button>

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner backdrop-blur">
                  <PackageCheck size={24} />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
                      Detail Barang Masuk
                    </h1>

                    <span className="hidden rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/80 sm:inline-flex">
                      ERP
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-white/75">
                      {data.nomor}
                    </span>

                    <span className="text-white/30">
                      •
                    </span>

                    <span className="text-sm text-white/70">
                      {formatDate(
                        data.tanggal
                      )}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {sourceBadge()}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {renderPremiumReceiveButton(
                  "hero"
                )}

                <button
                  type="button"
                  onClick={loadData}
                  disabled={
                    loading ||
                    receiving
                  }
                  className="inline-flex h-[66px] items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white backdrop-blur transition-all duration-300 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw
                    size={17}
                    className={
                      loading
                        ? "animate-spin"
                        : ""
                    }
                  />
                  <span className="hidden sm:inline">
                    Refresh
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* HERO META */}
          <div className="grid divide-y border-t border-[#E8EFEB] md:grid-cols-4 md:divide-x md:divide-y-0">

            <div className="flex items-center gap-3 px-6 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDF5F1]">
                <CalendarDays
                  size={17}
                  className="text-[#497F70]"
                />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Tanggal
                </p>

                <p className="mt-0.5 text-sm font-bold text-[#18352D]">
                  {formatDate(
                    data.tanggal
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDF5F1]">
                <Store
                  size={17}
                  className="text-[#497F70]"
                />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Outlet Tujuan
                </p>

                <p className="mt-0.5 truncate text-sm font-bold text-[#18352D]">
                  {destinationOutlet?.name ||
                    "-"}
                </p>

                <p className="text-[11px] text-gray-400">
                  {destinationOutlet?.code ||
                    "-"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDF5F1]">
                {data.sumber ===
                "PURCHASE" ? (
                  <ShoppingCart
                    size={17}
                    className="text-[#497F70]"
                  />
                ) : (
                  <Truck
                    size={17}
                    className="text-[#497F70]"
                  />
                )}
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {data.sumber ===
                  "PURCHASE"
                    ? "Supplier"
                    : "Outlet Asal"}
                </p>

                <p className="mt-0.5 truncate text-sm font-bold text-[#18352D]">
                  {data.sumber ===
                  "PURCHASE"
                    ? data.supplier?.name ||
                      "-"
                    : sourceOutlet?.name ||
                      "-"}
                </p>

                <p className="text-[11px] text-gray-400">
                  {data.sumber ===
                  "PURCHASE"
                    ? data.supplier?.code ||
                      "-"
                    : sourceOutlet?.code ||
                      "-"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDF5F1]">
                <ShieldCheck
                  size={17}
                  className="text-[#497F70]"
                />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Status
                </p>

                <div className="mt-1">
                  {statusBadge()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECURITY WARNING */}
        {!outletOwnershipValid && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
            <div className="flex items-start gap-4 border-l-4 border-red-500 bg-red-50 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
                <AlertTriangle
                  size={19}
                  className="text-red-600"
                />
              </div>

              <div>
                <p className="font-extrabold text-red-800">
                  Transaksi bukan untuk outlet Anda
                </p>

                <p className="mt-1 text-sm leading-6 text-red-700">
                  Transaksi ini ditujukan ke{" "}
                  <strong>
                    {destinationOutlet?.name ||
                      "-"}
                  </strong>
                  . Anda tidak dapat
                  melakukan penerimaan
                  barang untuk transaksi ini.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SUMMARY CARDS */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

          <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Qty Aktif
              </span>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDF5F1]">
                <Package
                  size={17}
                  className="text-[#497F70]"
                />
              </div>
            </div>

            <p className="mt-4 text-2xl font-extrabold tracking-tight text-[#18352D]">
              {formatNumber(totalQty)}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Total qty yang dikirim
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Diterima
              </span>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                <CheckCircle2
                  size={17}
                  className="text-emerald-600"
                />
              </div>
            </div>

            <p className="mt-4 text-2xl font-extrabold tracking-tight text-emerald-700">
              {formatNumber(
                totalReceivedQty
              )}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              {receiveProgress}% dari total
            </p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Sisa
              </span>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50">
                <Clock3
                  size={17}
                  className="text-orange-500"
                />
              </div>
            </div>

            <p className="mt-4 text-2xl font-extrabold tracking-tight text-orange-600">
              {formatNumber(
                totalRemainingQty
              )}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Belum diterima
            </p>
          </div>

          <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Qty VOID
              </span>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
                <Ban
                  size={17}
                  className="text-red-600"
                />
              </div>
            </div>

            <p className="mt-4 text-2xl font-extrabold tracking-tight text-red-700">
              {formatNumber(
                totalVoidQty
              )}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              {voidedItems.length} item VOID
            </p>
          </div>

          <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Nilai Diterima
              </span>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDF5F1]">
                <CircleDot
                  size={17}
                  className="text-[#497F70]"
                />
              </div>
            </div>

            <p className="mt-4 truncate text-xl font-extrabold tracking-tight text-[#18352D]">
              {formatCurrency(
                totalReceivedValue
              )}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Nilai barang aktif
            </p>
          </div>
        </div>

        {/* PROGRESS */}
        <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EDF5F1]">
                  <PackageCheck
                    size={16}
                    className="text-[#497F70]"
                  />
                </div>

                <h2 className="font-extrabold text-[#18352D]">
                  Progress Penerimaan
                </h2>
              </div>

              <p className="mt-2 text-sm text-gray-400">
                Perbandingan jumlah barang yang
                sudah diterima terhadap qty aktif
                yang dikirim.
              </p>
            </div>

            <div className="text-left md:text-right">
              <p className="text-2xl font-extrabold text-[#497F70]">
                {receiveProgress}%
              </p>

              <p className="text-xs text-gray-400">
                {formatNumber(
                  totalReceivedQty
                )}{" "}
                /{" "}
                {formatNumber(totalQty)}
              </p>
            </div>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#EAF0ED]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#497F70] to-[#6A9C8B] transition-all duration-500"
              style={{
                width: `${receiveProgress}%`,
              }}
            />
          </div>

          <div className="mt-3 flex justify-between text-[11px] font-semibold text-gray-400">
            <span>0%</span>

            <span>
              {formatNumber(
                totalRemainingQty
              )}{" "}
              qty tersisa
            </span>

            <span>100%</span>
          </div>
        </div>

        {/* SOURCE / DESTINATION */}
        {data.sumber === "TRANSFER" && (
          <div className="mb-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-500">
                  Transfer Barang
                </p>

                <h2 className="mt-1 text-lg font-extrabold text-[#18352D]">
                  Alur Distribusi
                </h2>
              </div>

              {data.transfer?.number && (
                <div className="hidden rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-right sm:block">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-blue-400">
                    Nomor Transfer
                  </p>

                  <p className="mt-0.5 font-mono text-xs font-bold text-blue-700">
                    {data.transfer.number}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
              <div className="flex-1 rounded-2xl border border-[#DDE9E4] bg-[#FAFCFB] p-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                  <Truck size={14} />
                  Outlet Asal
                </div>

                <p className="mt-3 text-lg font-extrabold text-[#18352D]">
                  {sourceOutlet?.name ||
                    "-"}
                </p>

                <p className="mt-1 text-xs font-medium text-gray-400">
                  {sourceOutlet?.code ||
                    "-"}
                </p>
              </div>

              <div className="flex items-center justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-200 bg-blue-50">
                  <ArrowRight
                    size={18}
                    className="text-blue-600"
                  />
                </div>
              </div>

              <div className="flex-1 rounded-2xl border border-[#DDE9E4] bg-[#FAFCFB] p-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                  <Store size={14} />
                  Outlet Tujuan
                </div>

                <p className="mt-3 text-lg font-extrabold text-[#18352D]">
                  {destinationOutlet?.name ||
                    "-"}
                </p>

                <p className="mt-1 text-xs font-medium text-gray-400">
                  {destinationOutlet?.code ||
                    "-"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STATUS INFORMATION */}
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          {data.sumber === "PURCHASE" && (
            <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50">
                  <ShoppingCart
                    size={19}
                    className="text-purple-600"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                    Purchase Order
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="font-extrabold text-[#18352D]">
                      {data.purchase
                        ?.number || "-"}
                    </p>

                    {purchaseStatusBadge()}
                  </div>

                  {data.purchase
                    ?.purchaseDate && (
                    <p className="mt-2 text-xs text-gray-400">
                      Tanggal PO:{" "}
                      {formatDate(
                        data.purchase
                          .purchaseDate
                      )}
                    </p>
                  )}

                  {purchasePaymentMethod && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-purple-700">
                        Pembayaran:{" "}
                        {purchasePaymentMethod}
                      </span>

                      {isTempoPurchase && (
                        <span className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-orange-700">
                          TEMPO
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EDF5F1]">
                {alreadyReceived ? (
                  <CheckCircle2
                    size={19}
                    className="text-emerald-600"
                  />
                ) : (
                  <Clock3
                    size={19}
                    className="text-[#497F70]"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  Status Transaksi
                </p>

                <div className="mt-2">
                  {statusBadge()}
                </div>

                <p className="mt-2 text-xs leading-5 text-gray-400">
                  {alreadyReceived
                    ? "Transaksi sudah selesai dan tidak dapat diterima kembali."
                    : isPartial
                    ? "Sebagian barang sudah diterima. Anda masih dapat memproses sisa penerimaan."
                    : isWaiting
                    ? "Barang sedang menunggu proses penerimaan oleh outlet tujuan."
                    : "Periksa detail transaksi sebelum melakukan penerimaan."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* INVOICE SUPPLIER */}
        {data.sumber === "PURCHASE" &&
          !alreadyReceived && (
            <div className="mb-6 overflow-hidden rounded-2xl border border-purple-200 bg-white shadow-sm">
              <div className="border-l-4 border-purple-500 bg-gradient-to-r from-purple-50 to-white p-5 md:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-100">
                      <FileText
                        size={19}
                        className="text-purple-600"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-500">
                        Invoice Supplier
                      </p>

                      <h3 className="mt-1 text-base font-extrabold text-[#18352D]">
                        Nomor Invoice Supplier
                      </h3>

                      <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                        Masukkan nomor invoice yang
                        tercantum pada dokumen invoice
                        dari supplier.
                        {isTempoPurchase ? (
                          <>
                            {" "}
                            Karena Purchase ini
                            menggunakan pembayaran{" "}
                            <strong>TEMPO</strong>,
                            nomor invoice wajib
                            dicatat dan akan menjadi
                            referensi hutang supplier.
                          </>
                        ) : (
                          <>
                            {" "}
                            Untuk pembayaran{" "}
                            <strong>
                              {purchasePaymentMethod ||
                                "non-TEMPO"}
                            </strong>
                            , nomor invoice bersifat
                            opsional tetapi tetap
                            dapat dicatat sebagai
                            referensi transaksi.
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="w-full lg:max-w-md">
                    <label
                      htmlFor="supplier-invoice-number"
                      className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-gray-500"
                    >
                      No. Invoice Supplier

                      {isTempoPurchase && (
                        <span className="ml-1 text-red-500">
                          *
                        </span>
                      )}
                    </label>

                    <input
                      id="supplier-invoice-number"
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) =>
                        setInvoiceNumber(
                          e.target.value
                        )
                      }
                      disabled={
                        receiving ||
                        purchaseStatus !==
                          "APPROVED"
                      }
                      placeholder="Contoh: INV/ABC/2026/00123"
                      maxLength={100}
                      className="w-full rounded-xl border border-purple-200 bg-white px-4 py-3 text-sm font-bold text-[#18352D] shadow-sm outline-none transition placeholder:text-gray-300 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 disabled:cursor-not-allowed disabled:bg-gray-100"
                    />

                    <div className="mt-2 flex items-start gap-1.5">
                      <Info
                        size={12}
                        className="mt-0.5 shrink-0 text-gray-400"
                      />

                      <p className="text-[11px] text-gray-400">
                        {isTempoPurchase
                          ? "Wajib diisi untuk Purchase dengan pembayaran TEMPO."
                          : "Opsional. Jika tersedia, nomor invoice akan disimpan sebagai referensi penerimaan supplier."}
                      </p>
                    </div>

                    {isTempoPurchase &&
                      !invoiceNumberTrimmed &&
                      purchaseStatus ===
                        "APPROVED" && (
                        <p className="mt-2 text-[11px] font-semibold text-red-500">
                          No. Invoice Supplier belum
                          diisi.
                        </p>
                      )}
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* STORED INVOICE */}
        {data.sumber === "PURCHASE" &&
          alreadyReceived &&
          invoiceNumberTrimmed && (
            <div className="mb-6 overflow-hidden rounded-2xl border border-purple-200 bg-white shadow-sm">
              <div className="border-l-4 border-purple-500 bg-gradient-to-r from-purple-50 to-white p-5 md:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-100">
                      <FileText
                        size={19}
                        className="text-purple-600"
                      />
                    </div>

                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-500">
                        Invoice Supplier
                      </p>

                      <h3 className="mt-1 text-base font-extrabold text-[#18352D]">
                        Invoice sudah tercatat
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        Nomor invoice tersimpan pada
                        transaksi penerimaan supplier.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-purple-100 bg-white px-4 py-3">
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400">
                      No. Invoice
                    </p>

                    <p className="mt-1 break-all font-mono text-sm font-extrabold text-[#18352D]">
                      {invoiceNumberTrimmed}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* TEMPO PAYABLE */}
        {data.sumber === "PURCHASE" &&
          isTempoPurchase &&
          purchasePayable && (
            <div className="mb-6 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm">
              <div className="border-l-4 border-orange-500 bg-gradient-to-r from-orange-50 to-white p-5 md:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100">
                      <FileText
                        size={19}
                        className="text-orange-600"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-orange-500">
                        Hutang Supplier
                      </p>

                      <h3 className="mt-1 text-base font-extrabold text-[#18352D]">
                        Invoice Supplier
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-gray-500">
                        Invoice supplier sudah
                        tercatat pada Purchase
                        Payable dan menjadi
                        referensi hutang transaksi
                        ini.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
                    <div className="rounded-xl border border-orange-100 bg-white p-4">
                      <p className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400">
                        No. Invoice
                      </p>

                      <p className="mt-1 break-all font-mono text-sm font-extrabold text-[#18352D]">
                        {
                          purchasePayable.invoiceNumber
                        }
                      </p>
                    </div>

                    <div className="rounded-xl border border-orange-100 bg-white p-4">
                      <p className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400">
                        Status Hutang
                      </p>

                      <p className="mt-1 text-sm font-extrabold text-orange-700">
                        {purchasePayable.status ||
                          "-"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-orange-100 bg-white p-4">
                      <p className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400">
                        Nilai Hutang
                      </p>

                      <p className="mt-1 text-sm font-extrabold text-[#18352D]">
                        {formatCurrency(
                          purchasePayable.amount
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-orange-100 bg-white p-4">
                      <p className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400">
                        Outstanding
                      </p>

                      <p className="mt-1 text-sm font-extrabold text-red-700">
                        {formatCurrency(
                          purchasePayable.outstanding
                        )}
                      </p>
                    </div>

                    {purchasePayable.dueDate && (
                      <div className="rounded-xl border border-orange-100 bg-white p-4 sm:col-span-2">
                        <p className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400">
                          Jatuh Tempo
                        </p>

                        <p className="mt-1 text-sm font-extrabold text-[#18352D]">
                          {formatDate(
                            purchasePayable.dueDate
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* VOID WARNING */}
        {voidedItems.length > 0 && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
            <div className="flex items-start gap-4 border-l-4 border-red-500 bg-gradient-to-r from-red-50 to-white p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100">
                <Ban
                  size={19}
                  className="text-red-600"
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-extrabold uppercase tracking-wide text-red-800">
                    Item VOID Terdeteksi
                  </h3>

                  <span className="rounded-full bg-red-600 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-white">
                    {voidedItems.length} Item
                  </span>
                </div>

                <p className="mt-2 max-w-4xl text-sm leading-6 text-red-700">
                  Item yang sudah di-void tetap
                  ditampilkan sebagai riwayat
                  transaksi. Item tersebut tidak
                  dapat diterima dan tidak menambah
                  stok outlet.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700">
                    Qty VOID:{" "}
                    {formatNumber(
                      totalVoidQty
                    )}
                  </span>

                  <span className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700">
                    Nilai VOID:{" "}
                    {formatCurrency(
                      totalVoidValue
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ACTION INFO */}
        {data.sumber === "PURCHASE" &&
          purchaseStatus !== "APPROVED" &&
          !alreadyReceived && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                  <AlertTriangle
                    size={18}
                    className="text-amber-600"
                  />
                </div>

                <div>
                  <p className="font-extrabold text-amber-800">
                    Barang belum dapat diterima
                  </p>

                  <p className="mt-1 text-sm leading-6 text-amber-700">
                    Purchase Order masih
                    berstatus{" "}
                    <strong>
                      {data.purchase?.status ||
                        "DRAFT"}
                    </strong>
                    . Barang hanya dapat
                    diterima setelah Purchase
                    Order di-approve.
                  </p>
                </div>
              </div>
            </div>
          )}

        {data.sumber === "PURCHASE" &&
          purchaseStatus === "APPROVED" &&
          isTempoPurchase &&
          !purchasePayable &&
          !alreadyReceived &&
          !invoiceNumberTrimmed && (
            <div className="mb-6 rounded-2xl border border-purple-200 bg-purple-50 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100">
                  <FileText
                    size={18}
                    className="text-purple-600"
                  />
                </div>

                <div>
                  <p className="font-extrabold text-purple-800">
                    Invoice Supplier diperlukan
                  </p>

                  <p className="mt-1 text-sm leading-6 text-purple-700">
                    Purchase menggunakan
                    pembayaran TEMPO. Isi nomor
                    invoice supplier terlebih dahulu
                    sebelum melakukan penerimaan
                    barang.
                  </p>
                </div>
              </div>
            </div>
          )}

        {data.sumber === "TRANSFER" &&
          !alreadyReceived &&
          hasReceivableItems &&
          outletOwnershipValid && (
            <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                  <PackageCheck
                    size={18}
                    className="text-blue-600"
                  />
                </div>

                <div>
                  <p className="font-extrabold text-blue-800">
                    {isPartial
                      ? "Penerimaan sebagian"
                      : "Transfer belum diterima"}
                  </p>

                  <p className="mt-1 text-sm leading-6 text-blue-700">
                    Periksa barang yang benar-benar
                    diterima outlet. Isi Qty Diterima
                    sesuai jumlah fisik, lalu klik{" "}
                    <strong>Terima Barang</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

        {alreadyReceived && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                <CheckCircle2
                  size={18}
                  className="text-emerald-600"
                />
              </div>

              <div>
                <p className="font-extrabold text-emerald-800">
                  Barang sudah diterima
                </p>

                <p className="mt-1 text-sm leading-6 text-emerald-700">
                  Transaksi ini sudah selesai
                  diproses dan tidak dapat diterima
                  kembali.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ITEMS */}
        <div className="overflow-hidden rounded-3xl border border-[#DDE9E4] bg-white shadow-[0_8px_30px_rgba(38,73,58,0.05)]">
          <div className="border-b border-[#E7EEEA] px-5 py-5 md:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDF5F1]">
                    <Package
                      size={17}
                      className="text-[#497F70]"
                    />
                  </div>

                  <h2 className="font-extrabold text-[#18352D]">
                    Detail Barang
                  </h2>
                </div>

                <p className="mt-2 text-sm text-gray-400">
                  {data.sumber ===
                  "TRANSFER"
                    ? "Qty Diterima dapat disesuaikan berdasarkan kondisi fisik barang."
                    : "Daftar barang pada transaksi penerimaan outlet."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-xl border border-[#DDE9E4] bg-[#F8FAF9] px-3 py-2 text-xs font-bold text-gray-600">
                  {data.items.length} total item
                </span>

                {voidedItems.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                    <Ban size={13} />
                    {voidedItems.length} VOID
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-sm">
              <thead className="sticky top-0 z-10 bg-[#F5F8F6]">
                <tr className="border-b border-[#E1EBE6]">
                  <th className="px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-[#527065]">
                    No
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-[#527065]">
                    Barang
                  </th>

                  <th className="px-5 py-4 text-center text-[11px] font-extrabold uppercase tracking-wider text-[#527065]">
                    Qty Kirim
                  </th>

                  {data.sumber ===
                    "TRANSFER" && (
                    <th className="px-5 py-4 text-center text-[11px] font-extrabold uppercase tracking-wider text-[#527065]">
                      Qty Diterima
                    </th>
                  )}

                  <th className="px-5 py-4 text-right text-[11px] font-extrabold uppercase tracking-wider text-[#527065]">
                    Harga
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-extrabold uppercase tracking-wider text-[#527065]">
                    Subtotal
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={
                        data.sumber ===
                        "TRANSFER"
                          ? 6
                          : 5
                      }
                      className="px-5 py-16 text-center"
                    >
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                        <Package
                          size={21}
                          className="text-gray-400"
                        />
                      </div>

                      <p className="mt-3 font-bold text-gray-600">
                        Tidak ada barang
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Belum ada item pada transaksi
                        ini.
                      </p>
                    </td>
                  </tr>
                ) : (
                  data.items.map(
                    (item, index) => {
                      const isVoided =
                        isItemVoided(item);

                      const qtyKirim =
                        Number(
                          item.qty || 0
                        );

                      const qtyDiterima =
                        isVoided
                          ? 0
                          : data.sumber ===
                            "TRANSFER"
                          ? Number(
                              receivedQty[
                                item.id
                              ] ?? 0
                            )
                          : Number(
                              item.receivedQty ??
                                item.qty ??
                                0
                            );

                      const subtotal =
                        isVoided
                          ? 0
                          : qtyKirim *
                            Number(
                              item.price || 0
                            );

                      const remaining =
                        Math.max(
                          0,
                          qtyKirim -
                            qtyDiterima
                        );

                      const voidReason =
                        getVoidReason(item);

                      return (
                        <tr
                          key={item.id}
                          className={
                            isVoided
                              ? "border-b border-red-200 bg-red-50/80"
                              : "border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                          }
                        >
                          <td className="px-5 py-5 align-top">
                            <span
                              className={
                                isVoided
                                  ? "font-extrabold text-red-500"
                                  : "font-semibold text-gray-400"
                              }
                            >
                              {String(
                                index + 1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </span>
                          </td>

                          <td className="px-5 py-5 align-top">
                            <div className="flex items-start gap-3">
                              <div
                                className={
                                  isVoided
                                    ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600"
                                    : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDF5F1] text-[#497F70]"
                                }
                              >
                                {isVoided ? (
                                  <Ban
                                    size={17}
                                  />
                                ) : (
                                  <Package
                                    size={17}
                                  />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={
                                      isVoided
                                        ? "font-extrabold text-red-700 line-through"
                                        : "font-extrabold text-[#18352D]"
                                    }
                                  >
                                    {
                                      item.barang
                                        .name
                                    }
                                  </span>

                                  {voidBadge(
                                    item
                                  )}
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <span
                                    className={
                                      isVoided
                                        ? "font-mono text-xs font-bold text-red-500 line-through"
                                        : "font-mono text-xs font-semibold text-[#497F70]"
                                    }
                                  >
                                    {
                                      item.barang
                                        .code
                                    }
                                  </span>

                                  <span className="text-gray-300">
                                    •
                                  </span>

                                  <span
                                    className={
                                      isVoided
                                        ? "text-xs font-medium text-red-400"
                                        : "text-xs text-gray-400"
                                    }
                                  >
                                    {
                                      item.barang
                                        .unit
                                    }
                                  </span>
                                </div>

                                {isVoided && (
                                  <div className="mt-3 max-w-md rounded-xl border border-red-200 bg-white p-3">
                                    <div className="flex items-center gap-2">
                                      <Ban
                                        size={14}
                                        className="text-red-600"
                                      />

                                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-700">
                                        Item sudah di-void
                                      </span>
                                    </div>

                                    <p className="mt-2 text-[11px] leading-5 text-red-600">
                                      Barang ini tidak
                                      dapat diterima
                                      oleh outlet dan
                                      tidak menambah
                                      stok outlet.
                                    </p>

                                    {voidReason && (
                                      <div className="mt-2 rounded-lg bg-red-50 px-3 py-2">
                                        <p className="text-[9px] font-extrabold uppercase tracking-wider text-red-500">
                                          Alasan VOID
                                        </p>

                                        <p className="mt-1 text-[11px] font-semibold text-red-700">
                                          {
                                            voidReason
                                          }
                                        </p>
                                      </div>
                                    )}

                                    {(item.voidedAt ||
                                      item.voided_at) && (
                                      <p className="mt-2 text-[10px] text-red-400">
                                        Di-void:{" "}
                                        {formatDateTime(
                                          item.voidedAt ??
                                            item.voided_at
                                        )}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-5 text-center align-top">
                            <span
                              className={
                                isVoided
                                  ? "font-extrabold text-red-600 line-through"
                                  : "font-extrabold text-[#18352D]"
                              }
                            >
                              {formatNumber(
                                qtyKirim
                              )}
                            </span>

                            {isVoided && (
                              <div className="mt-1">
                                <span className="rounded-md bg-red-600 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-white">
                                  VOID
                                </span>
                              </div>
                            )}
                          </td>

                          {data.sumber ===
                            "TRANSFER" && (
                            <td className="px-5 py-5 text-center align-top">
                              {isVoided ? (
                                <div className="flex flex-col items-center gap-2">
                                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-100 px-3 py-2 text-[10px] font-extrabold text-red-700">
                                    <Ban
                                      size={13}
                                    />
                                    TIDAK DITERIMA
                                  </span>
                                </div>
                              ) : alreadyReceived ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-700">
                                    <CheckCircle2
                                      size={13}
                                    />
                                    {formatNumber(
                                      qtyDiterima
                                    )}
                                  </span>
                                </div>
                              ) : !outletOwnershipValid ? (
                                <span className="inline-flex rounded-xl bg-gray-100 px-3 py-2 text-[10px] font-bold text-gray-500">
                                  Tidak dapat
                                  menerima
                                </span>
                              ) : (
                                <div className="flex flex-col items-center">
                                  <div className="relative">
                                    <input
                                      type="number"
                                      min={0}
                                      max={
                                        qtyKirim
                                      }
                                      step="any"
                                      value={
                                        receivedQty[
                                          item.id
                                        ] ?? 0
                                      }
                                      onChange={(
                                        e
                                      ) =>
                                        handleQtyChange(
                                          item,
                                          e
                                            .target
                                            .value
                                        )
                                      }
                                      disabled={
                                        receiving
                                      }
                                      className="w-28 rounded-xl border border-[#CFE0D8] bg-white px-3 py-2.5 text-center font-extrabold text-[#18352D] shadow-sm outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10 disabled:cursor-not-allowed disabled:bg-gray-100"
                                    />
                                  </div>

                                  <div className="mt-1.5 text-[10px] font-medium text-gray-400">
                                    Maks.{" "}
                                    {formatNumber(
                                      qtyKirim
                                    )}
                                  </div>

                                  {qtyDiterima >
                                    0 &&
                                    qtyDiterima <
                                      qtyKirim && (
                                      <div className="mt-1 rounded-md bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-600">
                                        Sisa{" "}
                                        {formatNumber(
                                          remaining
                                        )}
                                      </div>
                                    )}
                                </div>
                              )}
                            </td>
                          )}

                          <td
                            className={
                              isVoided
                                ? "px-5 py-5 text-right align-top text-red-400 line-through"
                                : "px-5 py-5 text-right align-top text-gray-600"
                            }
                          >
                            {formatCurrency(
                              Number(
                                item.price ||
                                  0
                              )
                            )}
                          </td>

                          <td className="px-5 py-5 text-right align-top">
                            {isVoided ? (
                              <div className="flex flex-col items-end gap-1.5">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[10px] font-extrabold text-red-700">
                                  <Ban
                                    size={11}
                                  />
                                  VOID
                                </span>

                                <span className="text-[9px] font-semibold text-red-400">
                                  Tidak masuk
                                  perhitungan
                                </span>
                              </div>
                            ) : (
                              <span className="font-extrabold text-[#18352D]">
                                {formatCurrency(
                                  subtotal
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>

              <tfoot>
                <tr className="bg-[#F5F8F6]">
                  <td
                    colSpan={3}
                    className="px-5 py-5 text-right text-xs font-extrabold uppercase tracking-wider text-[#527065]"
                  >
                    Total Barang Aktif
                  </td>

                  <td className="px-5 py-5 text-center font-extrabold text-[#18352D]">
                    {formatNumber(totalQty)}
                  </td>

                  {data.sumber ===
                    "TRANSFER" && (
                    <td className="px-5 py-5 text-center font-extrabold text-emerald-700">
                      {formatNumber(
                        totalReceivedQty
                      )}
                    </td>
                  )}

                  <td />

                  <td className="px-5 py-5 text-right font-extrabold text-[#18352D]">
                    {formatCurrency(
                      totalValue
                    )}
                  </td>
                </tr>

                {voidedItems.length > 0 && (
                  <tr className="border-t border-red-200 bg-red-50">
                    <td
                      colSpan={
                        data.sumber ===
                        "TRANSFER"
                          ? 4
                          : 3
                      }
                      className="px-5 py-4"
                    >
                      <div className="flex items-center justify-end gap-2 text-[10px] font-extrabold uppercase tracking-wider text-red-700">
                        <Ban size={13} />
                        Total Item VOID
                      </div>
                    </td>

                    <td className="px-5 py-4 text-center text-xs font-extrabold text-red-700">
                      {voidedItems.length} item
                    </td>

                    <td
                      colSpan={1}
                      className="px-5 py-4 text-right text-xs font-extrabold text-red-700"
                    >
                      Qty{" "}
                      {formatNumber(
                        totalVoidQty
                      )}
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </div>

        {/* FINANCIAL SUMMARY */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
              Nilai Barang Aktif
            </p>

            <p className="mt-2 text-xl font-extrabold text-[#18352D]">
              {formatCurrency(
                totalValue
              )}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Tidak termasuk item VOID.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
              Nilai Barang Diterima
            </p>

            <p className="mt-2 text-xl font-extrabold text-emerald-700">
              {formatCurrency(
                totalReceivedValue
              )}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Berdasarkan qty penerimaan aktif.
            </p>
          </div>

          <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
              Nilai Item VOID
            </p>

            <p className="mt-2 text-xl font-extrabold text-red-700">
              {formatCurrency(
                totalVoidValue
              )}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Tidak masuk nilai barang aktif.
            </p>
          </div>
        </div>

        {/* REMARKS */}
        {data.remarks && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">
            <div className="flex items-start gap-4 p-5 md:p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDF5F1]">
                <FileText
                  size={18}
                  className="text-[#497F70]"
                />
              </div>

              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  Catatan Transaksi
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                  {data.remarks}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM ACTION */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">
          <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDF5F1]">
                <Info
                  size={16}
                  className="text-[#497F70]"
                />
              </div>

              <div>
                <p className="text-xs font-bold text-[#35564C]">
                  Informasi transaksi
                </p>

                <p className="text-[11px] text-gray-400">
                  Data ditampilkan berdasarkan
                  transaksi terbaru dari server.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/outlet/barang-masuk"
                  )
                }
                disabled={receiving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm font-bold text-[#40584C] transition-all duration-200 hover:border-[#BFD4CA] hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeft size={16} />
                Kembali
              </button>

              {renderPremiumReceiveButton(
                "bottom"
              )}
            </div>
          </div>

          {canReceive && !receiving && (
            <div className="border-t border-[#E8EFEB] bg-gradient-to-r from-[#F4F9F6] via-white to-[#F4F9F6] px-5 py-3">
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[10px] font-semibold text-[#6B8178]">
                <Sparkles
                  size={12}
                  className="text-[#497F70]"
                />

                <span>
                  Data penerimaan siap diproses
                </span>

                <span className="text-[#C4D2CC]">
                  •
                </span>

                <span>
                  {formatNumber(
                    isTransfer
                      ? transferTotalReceived
                      : totalQty
                  )}{" "}
                  qty akan diterima
                </span>

                <span className="text-[#C4D2CC]">
                  •
                </span>

                <span className="text-[#497F70]">
                  Pastikan kondisi fisik sesuai
                </span>
              </div>
            </div>
          )}

          {receiving && (
            <div className="border-t border-[#E8EFEB] bg-[#F8FBF9] px-5 py-3">
              <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-[#497F70]">
                <RefreshCw
                  size={12}
                  className="animate-spin"
                />
                Sistem sedang memproses penerimaan
                dan memperbarui stok outlet...
              </div>
            </div>
          )}

          {!canReceive &&
            !alreadyReceived &&
            outletOwnershipValid &&
            hasReceivableItems && (
              <div className="border-t border-[#E8EFEB] bg-[#FAFCFB] px-5 py-3">
                <div className="flex items-center justify-center gap-2 text-[10px] font-semibold text-gray-400">
                  <LockKeyhole size={12} />
                  Tombol penerimaan akan aktif
                  setelah seluruh persyaratan
                  transaksi terpenuhi.
                </div>
              </div>
            )}
        </div>
      </div>

      {/* =====================================================
          PREMIUM CONFIRMATION MODAL
          ===================================================== */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-[#10251F]/70 p-4 backdrop-blur-md sm:p-6"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !receiving
            ) {
              setConfirmOpen(false);
            }
          }}
        >
          <div
            className="relative my-auto w-full max-w-[620px] overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_30px_100px_rgba(15,45,35,0.32)]"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            {/* MODAL HEADER */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#29483A] via-[#355F4F] to-[#497F70] px-6 pb-7 pt-6 text-white sm:px-7">
              <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/5" />
              <div className="absolute -bottom-24 left-24 h-48 w-48 rounded-full bg-white/5" />

              <button
                type="button"
                onClick={() =>
                  !receiving &&
                  setConfirmOpen(false)
                }
                disabled={receiving}
                className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white/80 backdrop-blur transition hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Tutup"
              >
                <X size={17} />
              </button>

              <div className="relative">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/10 backdrop-blur">
                    <PackageCheck
                      size={27}
                      className="text-white"
                    />
                  </div>

                  <div className="min-w-0 pr-8">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.16em] text-white/75">
                        Konfirmasi
                      </span>

                      <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.16em] text-emerald-100">
                        FINAL CHECK
                      </span>
                    </div>

                    <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
                      Konfirmasi Penerimaan Barang
                    </h2>

                    <p className="mt-1.5 text-xs leading-5 text-white/65">
                      Pastikan seluruh data penerimaan
                      sudah sesuai dengan kondisi fisik
                      barang sebelum stok diperbarui.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* MODAL BODY */}
            <div className="max-h-[68vh] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">

              {/* FLOW */}
              <div className="rounded-2xl border border-[#DDE9E4] bg-[#F7FAF8] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#E0EAE5] bg-white p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDF5F1]">
                      {isPurchase ? (
                        <ShoppingCart
                          size={17}
                          className="text-[#497F70]"
                        />
                      ) : (
                        <Truck
                          size={17}
                          className="text-[#497F70]"
                        />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-gray-400">
                        {isPurchase
                          ? "Supplier"
                          : "Outlet Asal"}
                      </p>

                      <p className="mt-0.5 truncate text-sm font-extrabold text-[#18352D]">
                        {isPurchase
                          ? data.supplier?.name ||
                            "Supplier"
                          : sourceOutlet?.name ||
                            "Outlet Asal"}
                      </p>

                      <p className="truncate text-[10px] text-gray-400">
                        {isPurchase
                          ? data.supplier?.code ||
                            "-"
                          : sourceOutlet?.code ||
                            "-"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#497F70] text-white shadow-sm">
                      <ArrowRight size={14} />
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#DCE9E3] bg-white p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDF5F1]">
                      <Store
                        size={17}
                        className="text-[#497F70]"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-gray-400">
                        Outlet Tujuan
                      </p>

                      <p className="mt-0.5 truncate text-sm font-extrabold text-[#18352D]">
                        {destinationOutlet?.name ||
                          "Outlet Tujuan"}
                      </p>

                      <p className="truncate text-[10px] text-gray-400">
                        {destinationOutlet?.code ||
                          "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* TRANSACTION INFO */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#E0EAE5] bg-white p-4">
                  <div className="flex items-center gap-2">
                    <FileText
                      size={15}
                      className="text-[#497F70]"
                    />

                    <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-gray-400">
                      Nomor Transaksi
                    </p>
                  </div>

                  <p className="mt-2 break-all font-mono text-sm font-extrabold text-[#18352D]">
                    {data.nomor}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E0EAE5] bg-white p-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays
                      size={15}
                      className="text-[#497F70]"
                    />

                    <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-gray-400">
                      Tanggal
                    </p>
                  </div>

                  <p className="mt-2 text-sm font-extrabold text-[#18352D]">
                    {formatDate(
                      data.tanggal
                    )}
                  </p>
                </div>
              </div>

              {/* QTY SUMMARY */}
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#DDE9E4] bg-[#F8FAF9] p-4">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-gray-400">
                    Qty Aktif
                  </p>

                  <p className="mt-2 text-xl font-extrabold text-[#18352D]">
                    {formatNumber(
                      totalQty
                    )}
                  </p>

                  <p className="mt-0.5 text-[10px] text-gray-400">
                    Total barang
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-emerald-600">
                    Qty Diterima
                  </p>

                  <p className="mt-2 text-xl font-extrabold text-emerald-700">
                    {formatNumber(
                      isTransfer
                        ? transferTotalReceived
                        : totalQty
                    )}
                  </p>

                  <p className="mt-0.5 text-[10px] text-emerald-600/70">
                    Akan masuk stok
                  </p>
                </div>

                <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-orange-600">
                    Sisa
                  </p>

                  <p className="mt-2 text-xl font-extrabold text-orange-700">
                    {formatNumber(
                      isTransfer
                        ? Math.max(
                            0,
                            totalQty -
                              transferTotalReceived
                          )
                        : 0
                    )}
                  </p>

                  <p className="mt-0.5 text-[10px] text-orange-600/70">
                    Belum diterima
                  </p>
                </div>
              </div>

              {/* PURCHASE INVOICE */}
              {isPurchase &&
                invoiceNumberTrimmed && (
                  <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-100">
                        <FileText
                          size={16}
                          className="text-purple-600"
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-purple-500">
                          Invoice Supplier
                        </p>

                        <p className="mt-1 break-all font-mono text-sm font-extrabold text-[#18352D]">
                          {invoiceNumberTrimmed}
                        </p>

                        {isTempoPurchase && (
                          <p className="mt-1 text-[10px] font-semibold text-purple-600">
                            Invoice akan menjadi referensi
                            hutang supplier.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              {/* VOID INFO */}
              {voidedItems.length > 0 && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100">
                      <Ban
                        size={16}
                        className="text-red-600"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-red-500">
                        Item VOID
                      </p>

                      <p className="mt-1 text-sm font-extrabold text-red-800">
                        {voidedItems.length} item
                        {" · "}
                        Qty{" "}
                        {formatNumber(
                          totalVoidQty
                        )}
                      </p>

                      <p className="mt-1 text-[10px] leading-5 text-red-600">
                        Item VOID tidak akan diterima
                        dan tidak menambah stok outlet.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* IMPORTANT WARNING */}
              <div className="mt-4 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
                <div className="flex items-start gap-3 border-l-4 border-amber-500 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                    <AlertTriangle
                      size={17}
                      className="text-amber-600"
                    />
                  </div>

                  <div>
                    <p className="text-sm font-extrabold text-amber-900">
                      Pastikan data sudah sesuai
                    </p>

                    <p className="mt-1 text-[11px] leading-5 text-amber-700">
                      Setelah penerimaan diproses, sistem
                      akan memperbarui stok outlet
                      berdasarkan qty yang diterima.
                      Pastikan jumlah fisik barang dan
                      dokumen transaksi sudah benar.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECURITY CHECK */}
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#DDE9E4] bg-[#F8FAF9] px-4 py-3">
                <ShieldCheck
                  size={15}
                  className="shrink-0 text-[#497F70]"
                />

                <p className="text-[10px] font-semibold leading-5 text-[#60776E]">
                  Transaksi akan dicatat ke sistem dan
                  perubahan stok dilakukan melalui proses
                  penerimaan resmi.
                </p>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="border-t border-[#E5ECE8] bg-[#FAFCFB] p-4 sm:p-5">
              <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    !receiving &&
                    setConfirmOpen(false)
                  }
                  disabled={receiving}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#D4E2DB] bg-white px-5 text-sm font-extrabold text-[#496158] transition-all duration-200 hover:border-[#B9CEC3] hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={16} />
                  Batalkan
                </button>

                <button
                  type="button"
                  onClick={executeReceive}
                  disabled={receiving}
                  className="group relative inline-flex min-h-[48px] items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-[#497F70] to-[#355F4F] px-6 text-sm font-extrabold text-white shadow-[0_8px_24px_rgba(73,127,112,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(73,127,112,0.32)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  <span className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />

                  {receiving ? (
                    <>
                      <RefreshCw
                        size={17}
                        className="relative animate-spin"
                      />

                      <span className="relative">
                        Memproses Penerimaan...
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        size={17}
                        className="relative"
                      />

                      <span className="relative">
                        Terima Barang
                      </span>

                      <ArrowRight
                        size={15}
                        className="relative transition-transform group-hover:translate-x-0.5"
                      />
                    </>
                  )}
                </button>
              </div>

              {receiving && (
                <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-semibold text-[#497F70]">
                  <ArrowDownToLine
                    size={12}
                    className="animate-bounce"
                  />
                  Sistem sedang memperbarui stok outlet...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          FEEDBACK MODAL
          ===================================================== */}
      {feedback.open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#10251F]/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-[440px] overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_100px_rgba(15,45,35,0.3)]">

            <div
              className={
                feedback.type ===
                "success"
                  ? "bg-gradient-to-br from-[#29483A] via-[#355F4F] to-[#497F70] px-6 py-7 text-white"
                  : "bg-gradient-to-br from-[#7F2929] via-[#A53C3C] to-[#C65353] px-6 py-7 text-white"
              }
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner">
                  {feedback.type ===
                  "success" ? (
                    <CheckCircle2
                      size={28}
                    />
                  ) : (
                    <AlertTriangle
                      size={28}
                    />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-white/65">
                    {feedback.type ===
                    "success"
                      ? "Berhasil"
                      : "Terjadi Kesalahan"}
                  </p>

                  <h3 className="mt-1 text-xl font-extrabold tracking-tight">
                    {feedback.title}
                  </h3>
                </div>
              </div>
            </div>

            <div className="px-6 py-6">
              <p className="text-sm leading-6 text-gray-600">
                {feedback.message}
              </p>

              <button
                type="button"
                onClick={closeFeedback}
                className={
                  feedback.type ===
                  "success"
                    ? "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#497F70] px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#3E6E61]"
                    : "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#A53C3C] px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#8F3030]"
                }
              >
                <Check size={16} />
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}