"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  Truck,
  X,
  ArrowRight,
  Boxes,
  CircleDashed,
  MapPin,
  FileText,
  Layers3,
  Sparkles,
} from "lucide-react";

// =====================================================
// TYPES
// =====================================================

type Outlet = {
  id: number;
  code: string;
  name: string;
  active?: boolean;
};

type Barang = {
  id: number;
  code: string;
  name: string;
  unit: string;
  barcode?: string | null;
  purchasePrice?: number | null;
  sellingPrice?: number | null;
};

type OutletStock = {
  id: number;
  outletId: number;
  barangId: number;
  stock: number;
  minimumStock: number;
  averageCost: number;

  outlet: {
    id: number;
    code: string;
    name: string;
  };

  barang: Barang;

  lastOpname?: any;
  opnameHistory?: any[];
};

type TransferItem = {
  id: number;
  transferId: number;
  barangId: number;
  qty: number;
  receivedQty: number;
  remainingQty?: number;
  remaining?: number;

  barang: {
    id: number;
    code: string;
    name: string;
    unit: string;
    source?: string;
    purchasePrice?: number;
  };
};

type Transfer = {
  id: number;
  number: string;

  sourceOutletId: number;
  outletId: number;

  sourceOutlet: Outlet | null;

  destinationOutlet?: Outlet | null;

  outlet?: Outlet | null;

  transferDate: string;
  status: "SENT" | "PARTIAL" | "RECEIVED" | string;

  remarks?: string | null;

  createdAt?: string;
  updatedAt?: string;

  totalQty: number;
  totalReceived: number;
  remainingQty: number;

  items: TransferItem[];
};

type CurrentUser = {
  id: number;
  fullname?: string | null;
  role: string;
  outletId?: number | null;
};

// =====================================================
// HELPERS
// =====================================================

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value: string) {
  if (!value) return "-";

  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(status: string) {
  switch (status) {
    case "SENT":
      return "DIKIRIM";

    case "PARTIAL":
      return "SEBAGIAN";

    case "RECEIVED":
      return "DITERIMA";

    default:
      return status;
  }
}

// =====================================================
// STATUS BADGE
// =====================================================

function StatusBadge({
  status,
}: {
  status: string;
}) {
  if (status === "RECEIVED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold tracking-wide text-emerald-700">
        <CheckCircle2 size={13} />
        DITERIMA
      </span>
    );
  }

  if (status === "PARTIAL") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold tracking-wide text-amber-700">
        <Truck size={13} />
        SEBAGIAN
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold tracking-wide text-blue-700">
      <Clock3 size={13} />
      DIKIRIM
    </span>
  );
}

// =====================================================
// SUMMARY CARD
// =====================================================

function SummaryCard({
  label,
  value,
  icon,
  tone = "slate",
  description,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: "slate" | "blue" | "amber" | "emerald" | "violet";
  description?: string;
}) {
  const tones = {
    slate: {
      icon: "bg-slate-100 text-slate-600",
      value: "text-slate-900",
    },
    blue: {
      icon: "bg-blue-50 text-blue-600",
      value: "text-blue-700",
    },
    amber: {
      icon: "bg-amber-50 text-amber-600",
      value: "text-amber-700",
    },
    emerald: {
      icon: "bg-emerald-50 text-emerald-600",
      value: "text-emerald-700",
    },
    violet: {
      icon: "bg-violet-50 text-violet-600",
      value: "text-violet-700",
    },
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-slate-50 opacity-70 transition-transform duration-300 group-hover:scale-125" />

      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
            {label}
          </div>

          <div
            className={`mt-2 text-2xl font-extrabold tracking-tight ${tones[tone].value}`}
          >
            {formatNumber(value)}
          </div>

          {description && (
            <div className="mt-1 text-[11px] text-slate-400">
              {description}
            </div>
          )}
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone].icon}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// PAGE
// =====================================================

export default function OutletTransferPage() {
  // ===================================================
  // DATA
  // ===================================================

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [stocks, setStocks] = useState<OutletStock[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  // ===================================================
  // UI
  // ===================================================

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receivingId, setReceivingId] =
    useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [outletFilter, setOutletFilter] =
    useState<number | "ALL">("ALL");

  const [showCreate, setShowCreate] =
    useState(false);

  const [expandedId, setExpandedId] =
    useState<number | null>(null);

  // ===================================================
  // FORM TRANSFER
  // ===================================================

  const [destinationOutletId, setDestinationOutletId] =
    useState<number | "">("");

  const [remarks, setRemarks] = useState("");

  const [itemSearch, setItemSearch] = useState("");

  const [selectedItems, setSelectedItems] = useState<
    {
      barangId: number;
      qty: number;
    }[]
  >([]);

  // ===================================================
  // RECEIVE MODAL
  // ===================================================

  const [showReceive, setShowReceive] =
    useState(false);

  const [receiveTransfer, setReceiveTransfer] =
    useState<Transfer | null>(null);

  const [receiveItems, setReceiveItems] = useState<
    {
      itemId: number;
      receivedQty: number;
    }[]
  >([]);

  // ===================================================
  // LOAD DATA
  // ===================================================

  async function loadData() {
    try {
      setLoading(true);

      const [
        transferRes,
        stockRes,
        outletRes,
      ] = await Promise.all([
        fetch("/api/outlet/transfer", {
          cache: "no-store",
        }),

        fetch("/api/outlet/stock", {
          cache: "no-store",
        }),

        fetch("/api/outlet", {
          cache: "no-store",
        }),
      ]);

      const transferJson =
        await transferRes.json();

      const stockJson =
        await stockRes.json();

      const outletJson =
        await outletRes.json();

      if (!transferRes.ok || !transferJson.success) {
        throw new Error(
          transferJson.message ||
            "Gagal mengambil data transfer"
        );
      }

      if (!stockRes.ok || !stockJson.success) {
        throw new Error(
          stockJson.message ||
            "Gagal mengambil stok outlet"
        );
      }

      if (!outletRes.ok || !outletJson.success) {
        throw new Error(
          outletJson.message ||
            "Gagal mengambil data outlet"
        );
      }

      setTransfers(
        Array.isArray(transferJson.data)
          ? transferJson.data
          : []
      );

      setStocks(
        Array.isArray(stockJson.data)
          ? stockJson.data
          : []
      );

      setOutlets(
        Array.isArray(outletJson.data)
          ? outletJson.data.filter(
              (x: Outlet) =>
                x.active !== false
            )
          : []
      );

      setCurrentUser(
        stockJson.user
          ? {
              id: Number(
                stockJson.user.id
              ),
              fullname:
                stockJson.user.fullname,
              role:
                stockJson.user.role,
              outletId:
                stockJson.user.outletId,
            }
          : null
      );
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal mengambil data"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // ===================================================
  // SOURCE OUTLET
  // ===================================================

  const sourceOutlet = useMemo(() => {
    if (!currentUser?.outletId) {
      return null;
    }

    return (
      outlets.find(
        (outlet) =>
          outlet.id ===
          currentUser.outletId
      ) || null
    );
  }, [
    currentUser,
    outlets,
  ]);

  // ===================================================
  // SELECTED ADMIN OUTLET
  // ===================================================

  const selectedAdminOutlet = useMemo(() => {
    if (
      currentUser?.role !== "ADMIN" ||
      outletFilter === "ALL"
    ) {
      return null;
    }

    return (
      outlets.find(
        (outlet) =>
          outlet.id ===
          Number(outletFilter)
      ) || null
    );
  }, [
    currentUser,
    outletFilter,
    outlets,
  ]);

  // ===================================================
  // DESTINATION OPTIONS
  // ===================================================

  const destinationOptions =
    useMemo(() => {
      return outlets.filter(
        (outlet) =>
          outlet.id !==
          currentUser?.outletId
      );
    }, [
      outlets,
      currentUser,
    ]);

  // ===================================================
  // STOCK SOURCE
  // ===================================================

  const sourceStocks = useMemo(() => {
    if (!currentUser?.outletId) {
      return [];
    }

    return stocks.filter(
      (stock) =>
        stock.outletId ===
        currentUser.outletId
    );
  }, [
    stocks,
    currentUser,
  ]);

  // ===================================================
  // SEARCH BARANG
  // ===================================================

  const filteredStocks =
    useMemo(() => {
      const keyword =
        itemSearch
          .trim()
          .toLowerCase();

      return sourceStocks
        .filter((stock) => {
          if (!keyword) {
            return true;
          }

          return (
            stock.barang.code
              .toLowerCase()
              .includes(keyword) ||
            stock.barang.name
              .toLowerCase()
              .includes(keyword) ||
            String(
              stock.barang.barcode || ""
            )
              .toLowerCase()
              .includes(keyword)
          );
        })
        .sort((a, b) =>
          a.barang.name.localeCompare(
            b.barang.name
          )
        );
    }, [
      sourceStocks,
      itemSearch,
    ]);

  // ===================================================
  // TRANSFER FILTER
  // ===================================================

  const filteredTransfers =
    useMemo(() => {
      const keyword =
        search.trim().toLowerCase();

      return transfers.filter(
        (transfer) => {
          const matchesSearch =
            !keyword ||
            transfer.number
              .toLowerCase()
              .includes(keyword) ||
            (
              transfer.sourceOutlet
                ?.name || ""
            )
              .toLowerCase()
              .includes(keyword) ||
            (
              transfer.destinationOutlet
                ?.name ||
              transfer.outlet?.name ||
              ""
            )
              .toLowerCase()
              .includes(keyword);

          const matchesStatus =
            statusFilter === "ALL" ||
            transfer.status ===
              statusFilter;

          const matchesOutlet =
            currentUser?.role === "ADMIN"
              ? outletFilter === "ALL" ||
                transfer.sourceOutletId ===
                  Number(outletFilter)
              : true;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesOutlet
          );
        }
      );
    }, [
      transfers,
      search,
      statusFilter,
      outletFilter,
      currentUser,
    ]);

  // ===================================================
  // SUMMARY
  // ===================================================

  const summary = useMemo(() => {
    const sent = filteredTransfers.filter(
      (x) => x.status === "SENT"
    ).length;

    const partial =
      filteredTransfers.filter(
        (x) =>
          x.status === "PARTIAL"
      ).length;

    const received =
      filteredTransfers.filter(
        (x) =>
          x.status === "RECEIVED"
      ).length;

    const pendingReceive =
      filteredTransfers.filter(
        (x) =>
          x.status === "SENT" ||
          x.status === "PARTIAL"
      ).length;

    return {
      total: filteredTransfers.length,
      sent,
      partial,
      received,
      pendingReceive,
    };
  }, [filteredTransfers]);

  // ===================================================
  // SELECT ITEM
  // ===================================================

  function addItem(barangId: number) {
    const stock =
      sourceStocks.find(
        (x) =>
          x.barangId === barangId
      );

    if (!stock) {
      return;
    }

    if (
      Number(stock.stock) <= 0
    ) {
      alert(
        "Stok barang tersebut kosong."
      );
      return;
    }

    const existing =
      selectedItems.find(
        (x) =>
          x.barangId === barangId
      );

    if (existing) {
      return;
    }

    setSelectedItems((prev) => [
      ...prev,
      {
        barangId,
        qty: 1,
      },
    ]);
  }

  // ===================================================
  // REMOVE ITEM
  // ===================================================

  function removeItem(
    barangId: number
  ) {
    setSelectedItems((prev) =>
      prev.filter(
        (x) =>
          x.barangId !== barangId
      )
    );
  }

  // ===================================================
  // CHANGE QTY
  // ===================================================

  function changeQty(
    barangId: number,
    value: string
  ) {
    const stock =
      sourceStocks.find(
        (x) =>
          x.barangId === barangId
      );

    const maxStock = Number(
      stock?.stock || 0
    );

    let qty = Number(value);

    if (!Number.isFinite(qty)) {
      qty = 0;
    }

    if (qty < 0) {
      qty = 0;
    }

    if (qty > maxStock) {
      qty = maxStock;
    }

    setSelectedItems((prev) =>
      prev.map((item) =>
        item.barangId === barangId
          ? {
              ...item,
              qty,
            }
          : item
      )
    );
  }

  // ===================================================
  // RESET FORM
  // ===================================================

  function resetCreateForm() {
    setDestinationOutletId("");
    setRemarks("");
    setItemSearch("");
    setSelectedItems([]);
  }

  // ===================================================
  // CREATE TRANSFER
  // ===================================================

  async function createTransfer() {
    if (saving) {
      return;
    }

    if (!currentUser?.outletId) {
      alert(
        "User belum terhubung dengan outlet."
      );
      return;
    }

    if (
      !destinationOutletId ||
      Number(destinationOutletId) <= 0
    ) {
      alert(
        "Silakan pilih outlet tujuan."
      );
      return;
    }

    if (
      Number(destinationOutletId) ===
      Number(currentUser.outletId)
    ) {
      alert(
        "Outlet tujuan tidak boleh sama dengan outlet asal."
      );
      return;
    }

    const validItems =
      selectedItems.filter(
        (item) =>
          Number(item.qty) > 0
      );

    if (validItems.length === 0) {
      alert(
        "Minimal satu barang harus dipilih."
      );
      return;
    }

    for (const item of validItems) {
      const stock =
        sourceStocks.find(
          (x) =>
            x.barangId ===
            item.barangId
        );

      if (!stock) {
        alert(
          `Barang ID ${item.barangId} tidak ditemukan di stok outlet.`
        );
        return;
      }

      if (
        Number(item.qty) >
        Number(stock.stock)
      ) {
        alert(
          `Stok ${stock.barang.name} tidak mencukupi. Tersedia ${formatNumber(
            Number(stock.stock)
          )} ${stock.barang.unit}.`
        );
        return;
      }
    }

    try {
      setSaving(true);

      const response =
        await fetch(
          "/api/outlet/transfer",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              destinationOutletId:
                Number(
                  destinationOutletId
                ),

              remarks:
                remarks.trim() || null,

              items: validItems.map(
                (item) => ({
                  barangId:
                    item.barangId,

                  qty:
                    Number(item.qty),
                })
              ),
            }),
          }
        );

      const json =
        await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal membuat transfer"
        );
      }

      alert(
        json.message ||
          "Transfer berhasil dibuat."
      );

      resetCreateForm();
      setShowCreate(false);

      await loadData();
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal membuat transfer"
      );
    } finally {
      setSaving(false);
    }
  }

  // ===================================================
  // OPEN RECEIVE
  // ===================================================

  function openReceive(
    transfer: Transfer
  ) {
    const items =
      transfer.items
        .filter(
          (item) =>
            Number(item.qty) >
            Number(
              item.receivedQty || 0
            )
        )
        .map((item) => ({
          itemId: item.id,
          receivedQty:
            Math.max(
              0,
              Number(item.qty) -
                Number(
                  item.receivedQty || 0
                )
            ),
        }));

    if (items.length === 0) {
      alert(
        "Tidak ada sisa barang yang dapat diterima."
      );
      return;
    }

    setReceiveTransfer(
      transfer
    );

    setReceiveItems(items);
    setShowReceive(true);
  }

  // ===================================================
  // CHANGE RECEIVE QTY
  // ===================================================

  function changeReceiveQty(
    itemId: number,
    value: string
  ) {
    const transfer =
      receiveTransfer;

    if (!transfer) {
      return;
    }

    const item =
      transfer.items.find(
        (x) =>
          x.id === itemId
      );

    if (!item) {
      return;
    }

    const remaining =
      Math.max(
        0,
        Number(item.qty) -
          Number(
            item.receivedQty || 0
          )
      );

    let qty = Number(value);

    if (!Number.isFinite(qty)) {
      qty = 0;
    }

    if (qty < 0) {
      qty = 0;
    }

    if (qty > remaining) {
      qty = remaining;
    }

    setReceiveItems((prev) =>
      prev.map((x) =>
        x.itemId === itemId
          ? {
              ...x,
              receivedQty:
                qty,
            }
          : x
      )
    );
  }

  // ===================================================
  // RECEIVE TRANSFER
  // ===================================================

  async function receiveTransferSubmit() {
    if (
      !receiveTransfer ||
      receivingId !== null
    ) {
      return;
    }

    const validItems =
      receiveItems.filter(
        (item) =>
          Number(
            item.receivedQty
          ) > 0
      );

    if (validItems.length === 0) {
      alert(
        "Tidak ada qty yang akan diterima."
      );
      return;
    }

    try {
      setReceivingId(
        receiveTransfer.id
      );

      const response =
        await fetch(
          `/api/outlet/transfer/${receiveTransfer.id}/receive`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              items: validItems.map(
                (item) => ({
                  itemId:
                    item.itemId,

                  receivedQty:
                    Number(
                      item.receivedQty
                    ),
                })
              ),
            }),
          }
        );

      const json =
        await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal menerima transfer"
        );
      }

      alert(
        json.message ||
          "Transfer berhasil diterima."
      );

      setShowReceive(false);
      setReceiveTransfer(null);
      setReceiveItems([]);

      await loadData();
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal menerima transfer"
      );
    } finally {
      setReceivingId(null);
    }
  }

  // ===================================================
  // CLOSE CREATE
  // ===================================================

  function closeCreate() {
    if (saving) {
      return;
    }

    resetCreateForm();
    setShowCreate(false);
  }

  // ===================================================
  // SELECTED ITEM DATA
  // ===================================================

  const selectedItemDetails =
    selectedItems
      .map((selected) => {
        const stock =
          sourceStocks.find(
            (x) =>
              x.barangId ===
              selected.barangId
          );

        if (!stock) {
          return null;
        }

        return {
          ...selected,
          stock,
        };
      })
      .filter(Boolean) as {
      barangId: number;
      qty: number;
      stock: OutletStock;
    }[];

  // ===================================================
  // TOTAL CREATE QTY
  // ===================================================

  const createTotalQty =
    selectedItems.reduce(
      (total, item) =>
        total +
        Number(item.qty || 0),
      0
    );

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">

        {/* =================================================
            PREMIUM HEADER
        ================================================= */}

        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.05)]">
          <div className="relative overflow-hidden px-5 py-6 sm:px-7 lg:px-8">
            <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-emerald-100/60 blur-3xl" />
            <div className="absolute -bottom-28 right-48 h-52 w-52 rounded-full bg-blue-100/40 blur-3xl" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-200">
                  <Truck size={27} />
                </div>

                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      <Sparkles size={11} />
                      Inventory Flow
                    </span>
                  </div>

                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                    Transfer Outlet
                  </h1>

                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
                    Kelola perpindahan stok antar outlet secara
                    terkontrol, transparan, dan real-time.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={
                      loading
                        ? "animate-spin"
                        : ""
                    }
                  />
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setShowCreate(true)
                  }
                  disabled={
                    !currentUser?.outletId
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  <Plus size={17} />
                  Buat Transfer
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            OUTLET CONTEXT
        ================================================= */}

        <div className="mb-6 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <MapPin size={19} />
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600">
                  {currentUser?.role === "ADMIN"
                    ? "Outlet Dipilih"
                    : "Outlet Aktif"}
                </div>

                <div className="mt-0.5 font-extrabold text-emerald-950">
                  {currentUser?.role === "ADMIN"
                    ? outletFilter === "ALL"
                      ? "Semua Outlet"
                      : selectedAdminOutlet
                      ? `${selectedAdminOutlet.code} - ${selectedAdminOutlet.name}`
                      : "Semua Outlet"
                    : sourceOutlet
                    ? `${sourceOutlet.code} - ${sourceOutlet.name}`
                    : "Belum terhubung ke outlet"}
                </div>
              </div>
            </div>

            {currentUser && (
              <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-2.5 text-sm font-semibold text-emerald-800">
                {currentUser.fullname || "-"}
                <span className="mx-2 text-emerald-300">
                  •
                </span>
                {currentUser.role}
              </div>
            )}
          </div>
        </div>

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <SummaryCard
            label="Total Transfer"
            value={summary.total}
            icon={<Package size={19} />}
            tone="slate"
            description="Seluruh transaksi"
          />

          <SummaryCard
            label="Dikirim"
            value={summary.sent}
            icon={<Send size={19} />}
            tone="blue"
            description="Menunggu penerimaan"
          />

          <SummaryCard
            label="Sebagian"
            value={summary.partial}
            icon={<Truck size={19} />}
            tone="amber"
            description="Belum lengkap"
          />

          <SummaryCard
            label="Diterima"
            value={summary.received}
            icon={<CheckCircle2 size={19} />}
            tone="emerald"
            description="Transaksi selesai"
          />

          <SummaryCard
            label="Belum Selesai"
            value={summary.pendingReceive}
            icon={<Clock3 size={19} />}
            tone="violet"
            description="Perlu ditindaklanjuti"
          />
        </div>

        {/* =================================================
            FILTER
        ================================================= */}

        <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_14px_rgba(15,23,42,0.04)] sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Search size={15} />
            </div>

            <div>
              <div className="text-sm font-bold text-slate-800">
                Filter Transfer
              </div>

              <div className="text-[11px] text-slate-400">
                Cari dan saring transaksi transfer
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Cari nomor transfer atau outlet..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-10 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {currentUser?.role ===
              "ADMIN" && (
              <select
                value={outletFilter}
                onChange={(e) =>
                  setOutletFilter(
                    e.target.value ===
                      "ALL"
                      ? "ALL"
                      : Number(
                          e.target.value
                        )
                  )
                }
                className="h-11 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              >
                <option value="ALL">
                  Semua Outlet
                </option>

                {outlets.map(
                  (outlet) => (
                    <option
                      key={
                        outlet.id
                      }
                      value={
                        outlet.id
                      }
                    >
                      {outlet.code} -{" "}
                      {outlet.name}
                    </option>
                  )
                )}
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
              className="h-11 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
            >
              <option value="ALL">
                Semua Status
              </option>

              <option value="SENT">
                Dikirim
              </option>

              <option value="PARTIAL">
                Sebagian
              </option>

              <option value="RECEIVED">
                Diterima
              </option>
            </select>
          </div>
        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.045)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Layers3 size={17} />
              </div>

              <div>
                <div className="text-sm font-bold text-slate-800">
                  Daftar Transfer
                </div>

                <div className="text-[11px] text-slate-400">
                  {filteredTransfers.length} transaksi ditampilkan
                </div>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 self-start rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-500 sm:self-auto">
              <CircleDashed size={13} />
              Real-time inventory
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center">
              <div className="flex flex-col items-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <RefreshCw
                    size={22}
                    className="animate-spin"
                  />
                </div>

                <div className="text-sm font-bold text-slate-600">
                  Memuat data transfer
                </div>

                <div className="mt-1 text-xs text-slate-400">
                  Mengambil data terbaru...
                </div>
              </div>
            </div>
          ) : filteredTransfers.length ===
            0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
                <Package size={30} />
              </div>

              <div className="font-bold text-slate-700">
                Belum ada transfer
              </div>

              <div className="mt-1 max-w-sm text-sm leading-6 text-slate-400">
                Tidak ada transaksi yang sesuai
                dengan filter saat ini.
              </div>

              {(search ||
                statusFilter !== "ALL" ||
                outletFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter(
                      "ALL"
                    );
                    setOutletFilter(
                      "ALL"
                    );
                  }}
                  className="mt-4 rounded-lg px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50"
                >
                  Reset filter
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
                    <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Transfer
                    </th>

                    <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Asal
                    </th>

                    <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Tujuan
                    </th>

                    <th className="px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Qty
                    </th>

                    <th className="px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Diterima
                    </th>

                    <th className="px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Sisa
                    </th>

                    <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTransfers.map(
                    (transfer) => {
                      const expanded =
                        expandedId ===
                        transfer.id;

                      const destination =
                        transfer.destinationOutlet ||
                        transfer.outlet;

                      const canReceive =
                        transfer.status !==
                          "RECEIVED" &&
                        Number(
                          transfer.remainingQty
                        ) > 0;

                      return (
                        <TransferRow
                          key={
                            transfer.id
                          }
                          transfer={
                            transfer
                          }
                          destination={
                            destination
                          }
                          expanded={
                            expanded
                          }
                          canReceive={
                            canReceive
                          }
                          receiving={
                            receivingId ===
                            transfer.id
                          }
                          onToggle={() =>
                            setExpandedId(
                              expanded
                                ? null
                                : transfer.id
                            )
                          }
                          onReceive={() =>
                            openReceive(
                              transfer
                            )
                          }
                        />
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================
          CREATE MODAL
      =================================================== */}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/40 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.3)]">
            {/* HEADER */}

            <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 px-5 py-5 text-white sm:px-7">
              <div className="absolute -right-12 -top-24 h-60 w-60 rounded-full bg-emerald-500/20 blur-3xl" />

              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                    <Send size={20} />
                  </div>

                  <div>
                    <h2 className="text-lg font-extrabold">
                      Buat Transfer Outlet
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-300">
                      Stok outlet asal akan berkurang saat transfer dibuat.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeCreate}
                  className="rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* BODY */}

            <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">

                {/* LEFT */}

                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <FileText size={17} />
                      </div>

                      <div>
                        <div className="text-sm font-bold text-slate-800">
                          Informasi Transfer
                        </div>

                        <div className="text-[11px] text-slate-400">
                          Tentukan tujuan dan keterangan
                        </div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Outlet Asal
                      </label>

                      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
                          <MapPin size={15} />
                        </div>

                        <div className="text-sm font-bold text-slate-700">
                          {sourceOutlet
                            ? `${sourceOutlet.code} - ${sourceOutlet.name}`
                            : "-"}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Outlet Tujuan{" "}
                        <span className="text-red-500">
                          *
                        </span>
                      </label>

                      <select
                        value={
                          destinationOutletId
                        }
                        onChange={(e) =>
                          setDestinationOutletId(
                            e.target
                              .value
                              ? Number(
                                  e.target
                                    .value
                                )
                              : ""
                          )
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                      >
                        <option value="">
                          Pilih outlet tujuan
                        </option>

                        {destinationOptions.map(
                          (outlet) => (
                            <option
                              key={
                                outlet.id
                              }
                              value={
                                outlet.id
                              }
                            >
                              {outlet.code} -{" "}
                              {outlet.name}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div className="mt-4">
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
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
                        placeholder="Tambahkan keterangan transfer jika diperlukan..."
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                      />
                    </div>
                  </div>

                  {/* SELECTED */}

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <Boxes size={17} />
                        </div>

                        <div>
                          <div className="text-sm font-bold text-slate-800">
                            Barang Transfer
                          </div>

                          <div className="text-[11px] text-slate-400">
                            Barang yang akan dikirim
                          </div>
                        </div>
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-500">
                        {selectedItems.length} barang
                      </span>
                    </div>

                    {selectedItemDetails.length ===
                    0 ? (
                      <div className="px-5 py-12 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
                          <Package size={23} />
                        </div>

                        <div className="text-sm font-bold text-slate-500">
                          Belum ada barang dipilih
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          Pilih barang dari daftar di sebelah kanan.
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {selectedItemDetails.map(
                          (item) => (
                            <div
                              key={
                                item.barangId
                              }
                              className="p-4"
                            >
                              <div className="flex gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                  <Package
                                    size={17}
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="font-bold text-slate-700">
                                    {
                                      item
                                        .stock
                                        .barang
                                        .name
                                    }
                                  </div>

                                  <div className="mt-1 text-xs text-slate-400">
                                    {
                                      item
                                        .stock
                                        .barang
                                        .code
                                    }
                                    <span className="mx-1.5">
                                      •
                                    </span>
                                    Stok{" "}
                                    {formatNumber(
                                      Number(
                                        item
                                          .stock
                                          .stock
                                      )
                                    )}{" "}
                                    {
                                      item
                                        .stock
                                        .barang
                                        .unit
                                    }
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={Number(
                                      item
                                        .stock
                                        .stock
                                    )}
                                    step="any"
                                    value={
                                      item.qty
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      changeQty(
                                        item
                                          .barangId,
                                        e
                                          .target
                                          .value
                                      )
                                    }
                                    className="h-10 w-24 rounded-xl border border-slate-200 bg-slate-50 px-2 text-center text-sm font-bold text-slate-700 outline-none focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                                  />

                                  <span className="w-8 text-xs font-medium text-slate-400">
                                    {
                                      item
                                        .stock
                                        .barang
                                        .unit
                                    }
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeItem(
                                        item
                                          .barangId
                                      )
                                    }
                                    className="rounded-xl p-2 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                                  >
                                    <X
                                      size={
                                        16
                                      }
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT */}

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 p-5">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <Search size={16} />
                      </div>

                      <div>
                        <div className="text-sm font-bold text-slate-800">
                          Pilih Barang
                        </div>

                        <div className="text-[11px] text-slate-400">
                          Barang dari stok outlet asal
                        </div>
                      </div>
                    </div>

                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        value={itemSearch}
                        onChange={(e) =>
                          setItemSearch(
                            e.target.value
                          )
                        }
                        placeholder="Cari kode, nama, barcode..."
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                      />

                      {itemSearch && (
                        <button
                          type="button"
                          onClick={() =>
                            setItemSearch("")
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-[540px] overflow-y-auto">
                    {filteredStocks.length ===
                    0 ? (
                      <div className="px-4 py-14 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
                          <Package size={23} />
                        </div>

                        <div className="text-sm font-bold text-slate-500">
                          Barang tidak ditemukan
                        </div>
                      </div>
                    ) : (
                      filteredStocks.map(
                        (stock) => {
                          const selected =
                            selectedItems.some(
                              (item) =>
                                item.barangId ===
                                stock.barangId
                            );

                          const empty =
                            Number(
                              stock.stock
                            ) <= 0;

                          return (
                            <button
                              type="button"
                              key={
                                stock.id
                              }
                              disabled={
                                selected ||
                                empty
                              }
                              onClick={() =>
                                addItem(
                                  stock
                                    .barang
                                    .id
                                )
                              }
                              className={`group flex w-full items-center gap-3 border-b border-slate-100 px-5 py-3.5 text-left transition ${
                                selected
                                  ? "bg-emerald-50"
                                  : empty
                                  ? "bg-slate-50 opacity-50"
                                  : "hover:bg-slate-50"
                              }`}
                            >
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                  selected
                                    ? "bg-emerald-100 text-emerald-600"
                                    : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm"
                                }`}
                              >
                                {selected ? (
                                  <CheckCircle2
                                    size={
                                      18
                                    }
                                  />
                                ) : (
                                  <Package
                                    size={
                                      18
                                    }
                                  />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-bold text-slate-700">
                                  {
                                    stock
                                      .barang
                                      .name
                                  }
                                </div>

                                <div className="mt-1 text-[11px] text-slate-400">
                                  {
                                    stock
                                      .barang
                                      .code
                                  }
                                </div>
                              </div>

                              <div className="text-right">
                                <div
                                  className={`text-sm font-extrabold ${
                                    empty
                                      ? "text-red-500"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {formatNumber(
                                    Number(
                                      stock.stock
                                    )
                                  )}
                                </div>

                                <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                  {
                                    stock
                                      .barang
                                      .unit
                                  }
                                </div>
                              </div>

                              {!selected &&
                                !empty && (
                                  <ArrowRight
                                    size={
                                      16
                                    }
                                    className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500"
                                  />
                                )}
                            </button>
                          );
                        }
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER */}

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Boxes size={17} />
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Total Transfer
                  </div>

                  <div className="text-lg font-extrabold text-slate-900">
                    {formatNumber(
                      createTotalQty
                    )}{" "}
                    <span className="text-xs font-semibold text-slate-400">
                      qty
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeCreate}
                  disabled={saving}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={
                    createTransfer
                  }
                  disabled={
                    saving ||
                    !destinationOutletId ||
                    selectedItems.length ===
                      0
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                >
                  {saving ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="animate-spin"
                      />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Send
                        size={16}
                      />
                      Buat Transfer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          RECEIVE MODAL
      =================================================== */}

      {showReceive &&
        receiveTransfer && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5">
            {/* 
              IMPORTANT:
              Modal dibuat flex column + max height.
              Header dan footer tidak ikut scroll.
              Hanya area detail item yang melakukan scroll.
            */}
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/40 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.3)]">
              
              {/* HEADER */}

              <div className="relative shrink-0 overflow-hidden border-b border-slate-200 bg-gradient-to-r from-emerald-700 to-emerald-900 px-5 py-5 text-white sm:px-7">
                <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                      <CheckCircle2
                        size={21}
                      />
                    </div>

                    <div>
                      <h2 className="text-lg font-extrabold">
                        Terima Transfer
                      </h2>

                      <div className="mt-1 flex items-center gap-2 text-xs text-emerald-100">
                        <span>
                          {receiveTransfer.number}
                        </span>

                        <span className="opacity-50">
                          •
                        </span>

                        <span>
                          {formatDate(
                            receiveTransfer.transferDate
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setShowReceive(false)
                    }
                    disabled={
                      receivingId !== null
                    }
                    className="rounded-xl p-2 text-emerald-100 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* BODY */}
              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
                <div className="mb-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                      <MapPin size={12} />
                      Dari
                    </div>

                    <div className="font-extrabold text-slate-800">
                      {receiveTransfer
                        .sourceOutlet
                        ?.name ||
                        "-"}
                    </div>

                    <div className="mt-1 text-xs text-slate-400">
                      {receiveTransfer
                        .sourceOutlet
                        ?.code ||
                        "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-600">
                      <MapPin size={12} />
                      Ke
                    </div>

                    <div className="font-extrabold text-emerald-900">
                      {(
                        receiveTransfer
                          .destinationOutlet ||
                        receiveTransfer.outlet
                      )?.name ||
                        "-"}
                    </div>

                    <div className="mt-1 text-xs text-emerald-600">
                      {(
                        receiveTransfer
                          .destinationOutlet ||
                        receiveTransfer.outlet
                      )?.code ||
                        "-"}
                    </div>
                  </div>
                </div>

                {/* =================================================
                    DETAIL PENERIMAAN
                    HANYA BAGIAN ITEM YANG SCROLL
                ================================================= */}

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {/* DETAIL HEADER - TIDAK SCROLL */}

                  <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                      <div className="text-sm font-bold text-slate-800">
                        Detail Penerimaan
                      </div>

                      <div className="mt-0.5 text-[11px] text-slate-400">
                        Masukkan jumlah barang yang diterima
                      </div>
                    </div>

                    <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      {formatNumber(
                        receiveTransfer.remainingQty
                      )}{" "}
                      qty tersisa
                    </span>
                  </div>

                  {/* 
                    SCROLL CONTAINER:
                    - max-h menjaga modal tetap pendek
                    - overflow-y-auto membuat daftar item scroll
                    - overflow-x-auto tetap menjaga tabel responsive
                  */}
                  <div className="max-h-[46vh] overflow-auto">
                    <table className="w-full min-w-[700px] text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-slate-100 bg-slate-50 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                          <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Barang
                          </th>

                          <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Transfer
                          </th>

                          <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Diterima
                          </th>

                          <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Sisa
                          </th>

                          <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Terima
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {receiveTransfer.items
                          .filter(
                            (item) =>
                              Number(
                                item.qty
                              ) >
                              Number(
                                item.receivedQty ||
                                  0
                              )
                          )
                          .map(
                            (item) => {
                              const remaining =
                                Math.max(
                                  0,
                                  Number(
                                    item.qty
                                  ) -
                                    Number(
                                      item.receivedQty ||
                                        0
                                    )
                                );

                              const receiveValue =
                                receiveItems.find(
                                  (x) =>
                                    x.itemId ===
                                    item.id
                                )
                                  ?.receivedQty ??
                                0;

                              return (
                                <tr
                                  key={
                                    item.id
                                  }
                                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                                >
                                  <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                                        <Package
                                          size={
                                            16
                                          }
                                        />
                                      </div>

                                      <div className="min-w-0">
                                        <div className="max-w-[300px] truncate font-bold text-slate-700">
                                          {
                                            item
                                              .barang
                                              .name
                                          }
                                        </div>

                                        <div className="mt-0.5 text-[11px] text-slate-400">
                                          {
                                            item
                                              .barang
                                              .code
                                          }
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-4 py-4 text-center font-bold text-slate-700">
                                    {formatNumber(
                                      Number(
                                        item.qty
                                      )
                                    )}
                                  </td>

                                  <td className="px-4 py-4 text-center font-semibold text-emerald-600">
                                    {formatNumber(
                                      Number(
                                        item.receivedQty ||
                                          0
                                      )
                                    )}
                                  </td>

                                  <td className="px-4 py-4 text-center font-bold text-amber-600">
                                    {formatNumber(
                                      remaining
                                    )}
                                  </td>

                                  <td className="px-5 py-4">
                                    <input
                                      type="number"
                                      min={0}
                                      max={
                                        remaining
                                      }
                                      step="any"
                                      value={
                                        receiveValue
                                      }
                                      onChange={(
                                        e
                                      ) =>
                                        changeReceiveQty(
                                          item.id,
                                          e
                                            .target
                                            .value
                                        )
                                      }
                                      className="h-10 w-28 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-center text-sm font-extrabold text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                                    />
                                  </td>
                                </tr>
                              );
                            }
                          )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* FOOTER - TIDAK SCROLL */}

              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
                <div className="hidden text-xs text-slate-400 sm:block">
                  Pastikan qty penerimaan sesuai dengan barang fisik.
                </div>

                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setShowReceive(false)
                    }
                    disabled={
                      receivingId !== null
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    onClick={
                      receiveTransferSubmit
                    }
                    disabled={
                      receivingId !== null
                    }
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                  >
                    {receivingId !==
                    null ? (
                      <>
                        <RefreshCw
                          size={16}
                          className="animate-spin"
                        />
                        Memproses...
                      </>
                    ) : (
                      <>
                        <CheckCircle2
                          size={16}
                        />
                        Terima Transfer
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

// =====================================================
// TRANSFER ROW
// =====================================================

function TransferRow({
  transfer,
  destination,
  expanded,
  canReceive,
  receiving,
  onToggle,
  onReceive,
}: {
  transfer: Transfer;
  destination: Outlet | null | undefined;
  expanded: boolean;
  canReceive: boolean;
  receiving: boolean;
  onToggle: () => void;
  onReceive: () => void;
}) {
  return (
    <>
      <tr
        className={`border-b border-slate-100 transition ${
          expanded
            ? "bg-slate-50/80"
            : "hover:bg-slate-50/70"
        }`}
      >
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Send size={16} />
            </div>

            <div>
              <div className="font-extrabold text-slate-800">
                {transfer.number}
              </div>

              <div className="mt-1 text-[11px] text-slate-400">
                {formatDate(
                  transfer.transferDate
                )}
              </div>
            </div>
          </div>
        </td>

        <td className="px-5 py-4">
          <div className="font-bold text-slate-700">
            {transfer.sourceOutlet
              ?.code || "-"}
          </div>

          <div className="mt-0.5 max-w-[170px] truncate text-xs text-slate-400">
            {transfer.sourceOutlet
              ?.name || "-"}
          </div>
        </td>

        <td className="px-5 py-4">
          <div className="flex items-center gap-2">
            <ArrowRight
              size={14}
              className="text-slate-300"
            />

            <div>
              <div className="font-bold text-slate-700">
                {destination?.code ||
                  "-"}
              </div>

              <div className="mt-0.5 max-w-[170px] truncate text-xs text-slate-400">
                {destination?.name ||
                  "-"}
              </div>
            </div>
          </div>
        </td>

        <td className="px-5 py-4 text-center">
          <div className="font-extrabold text-slate-700">
            {formatNumber(
              transfer.totalQty
            )}
          </div>
        </td>

        <td className="px-5 py-4 text-center">
          <div className="font-extrabold text-emerald-600">
            {formatNumber(
              transfer.totalReceived
            )}
          </div>
        </td>

        <td className="px-5 py-4 text-center">
          <div className="font-extrabold text-amber-600">
            {formatNumber(
              transfer.remainingQty
            )}
          </div>
        </td>

        <td className="px-5 py-4">
          <StatusBadge
            status={
              transfer.status
            }
          />
        </td>

        {/* =================================================
            ACTIONS
        ================================================= */}

        <td className="px-5 py-4">
          <div className="flex items-center justify-center gap-2">
            {/* DETAIL */}

            <button
              type="button"
              onClick={onToggle}
              title={
                expanded
                  ? "Tutup detail"
                  : "Lihat detail"
              }
              aria-label={
                expanded
                  ? "Tutup detail transfer"
                  : "Lihat detail transfer"
              }
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                expanded
                  ? "border-slate-300 bg-slate-200 text-slate-800 shadow-sm"
                  : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              {expanded ? (
                <ChevronUp
                  size={17}
                />
              ) : (
                <ChevronDown
                  size={17}
                />
              )}
            </button>

            {/* TERIMA */}

            {canReceive && (
              <button
                type="button"
                onClick={onReceive}
                disabled={receiving}
                title="Terima transfer"
                aria-label={`Terima transfer ${transfer.number}`}
                className={`inline-flex h-10 min-w-[92px] items-center justify-center gap-2 rounded-xl border px-3 text-xs font-extrabold transition-all ${
                  receiving
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800 hover:shadow-md active:scale-[0.98]"
                }`}
              >
                {receiving ? (
                  <>
                    <RefreshCw
                      size={15}
                      className="animate-spin"
                    />
                    Menerima...
                  </>
                ) : (
                  <>
                    <CheckCircle2
                      size={16}
                      strokeWidth={2.5}
                    />
                    Terima
                  </>
                )}
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* =================================================
          EXPANDED DETAIL
      ================================================= */}

      {expanded && (
        <tr className="border-b border-slate-200 bg-slate-50">
          <td
            colSpan={8}
            className="px-5 py-4"
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <Package size={16} />
                    </div>

                    <div>
                      <div className="text-sm font-bold text-slate-800">
                        Detail Barang
                      </div>

                      <div className="text-[11px] text-slate-400">
                        {transfer.items.length} item
                      </div>
                    </div>
                  </div>

                  {transfer.remarks && (
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      <span className="font-bold text-slate-600">
                        Keterangan:
                      </span>{" "}
                      {transfer.remarks}
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Kode
                      </th>

                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Barang
                      </th>

                      <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Transfer
                      </th>

                      <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Diterima
                      </th>

                      <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Sisa
                      </th>

                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Satuan
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {transfer.items.map(
                      (item) => {
                        const remaining =
                          Math.max(
                            0,
                            Number(
                              item.qty
                            ) -
                              Number(
                                item.receivedQty ||
                                  0
                              )
                          );

                        return (
                          <tr
                            key={
                              item.id
                            }
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                          >
                            <td className="px-5 py-3.5">
                              <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600">
                                {
                                  item
                                    .barang
                                    .code
                                }
                              </span>
                            </td>

                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-700">
                                {
                                  item
                                    .barang
                                    .name
                                }
                              </div>
                            </td>

                            <td className="px-4 py-3.5 text-center font-semibold text-slate-600">
                              {formatNumber(
                                Number(
                                  item.qty
                                )
                              )}
                            </td>

                            <td className="px-4 py-3.5 text-center font-extrabold text-emerald-600">
                              {formatNumber(
                                Number(
                                  item.receivedQty ||
                                    0
                                )
                              )}
                            </td>

                            <td className="px-4 py-3.5 text-center font-extrabold text-amber-600">
                              {formatNumber(
                                remaining
                              )}
                            </td>

                            <td className="px-5 py-3.5 text-slate-500">
                              {
                                item
                                  .barang
                                  .unit
                              }
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}