"use client";

import { useEffect, useMemo, useState } from "react";
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
    month: "2-digit",
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
      return "SEBAGIAN DITERIMA";

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
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
        <CheckCircle2 size={13} />
        DITERIMA
      </span>
    );
  }

  if (status === "PARTIAL") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
        <Truck size={13} />
        SEBAGIAN
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
      <Clock3 size={13} />
      DIKIRIM
    </span>
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

  // ===================================================
  // ADMIN PUSAT OUTLET FILTER
  // ===================================================

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

  const [remarks, setRemarks] =
    useState("");

  const [itemSearch, setItemSearch] =
    useState("");

  const [selectedItems, setSelectedItems] =
    useState<
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

  const [receiveItems, setReceiveItems] =
    useState<
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

          // ADMIN PUSAT:
          // filter berdasarkan outlet asal
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

    // -----------------------------------------------
    // VALIDASI STOCK LAGI
    // -----------------------------------------------

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
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px]">
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Transfer Outlet
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Transfer stok barang dari outlet
              asal ke outlet tujuan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
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
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <Plus size={17} />
              Buat Transfer
            </button>
          </div>
        </div>

        {/* =================================================
            CURRENT OUTLET / ADMIN FILTER
        ================================================= */}

        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                {currentUser?.role === "ADMIN"
                  ? "Outlet Dipilih"
                  : "Outlet Aktif"}
              </div>

              <div className="mt-0.5 font-bold text-emerald-900">
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

            {currentUser && (
              <div className="text-sm text-emerald-700">
                {currentUser.fullname ||
                  "-"}{" "}
                · {currentUser.role}
              </div>
            )}
          </div>
        </div>

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <SummaryCard
            label="Total Transfer"
            value={summary.total}
            icon={
              <Package
                size={18}
              />
            }
          />

          <SummaryCard
            label="Dikirim"
            value={summary.sent}
            icon={
              <Send size={18} />
            }
          />

          <SummaryCard
            label="Sebagian"
            value={summary.partial}
            icon={
              <Truck size={18} />
            }
          />

          <SummaryCard
            label="Diterima"
            value={summary.received}
            icon={
              <CheckCircle2
                size={18}
              />
            }
          />

          <SummaryCard
            label="Belum Selesai"
            value={
              summary.pendingReceive
            }
            icon={
              <Clock3 size={18} />
            }
          />
        </div>

        {/* =================================================
            FILTER
        ================================================= */}

        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row">
            {/* SEARCH */}

            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Cari nomor transfer atau outlet..."
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            {/* =================================================
                OUTLET DROPDOWN
                ADMIN PUSAT ONLY
            ================================================= */}

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
                className="rounded-lg border border-emerald-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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

            {/* STATUS */}

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
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

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <RefreshCw
                  size={18}
                  className="animate-spin"
                />
                Memuat data...
              </div>
            </div>
          ) : filteredTransfers.length ===
            0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
              <Package
                size={42}
                className="mb-3 text-slate-300"
              />

              <div className="font-semibold text-slate-600">
                Belum ada transfer
              </div>

              <div className="mt-1 text-sm text-slate-400">
                Data transfer outlet akan
                muncul di sini.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Transfer
                    </th>

                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Asal
                    </th>

                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Tujuan
                    </th>

                    <th className="px-4 py-3 text-center font-semibold text-slate-600">
                      Qty
                    </th>

                    <th className="px-4 py-3 text-center font-semibold text-slate-600">
                      Diterima
                    </th>

                    <th className="px-4 py-3 text-center font-semibold text-slate-600">
                      Sisa
                    </th>

                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Status
                    </th>

                    <th className="px-4 py-3 text-center font-semibold text-slate-600">
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
                        transfer.remainingQty >
                          0;

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Buat Transfer Outlet
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Stok akan langsung
                  berkurang dari outlet
                  asal saat transfer
                  dibuat.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreate}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* BODY */}

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
                {/* LEFT */}

                <div>
                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 text-sm font-bold text-slate-700">
                      Informasi Transfer
                    </div>

                    <div className="mb-4">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                        Outlet Asal
                      </label>

                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700">
                        {sourceOutlet
                          ? `${sourceOutlet.code} - ${sourceOutlet.name}`
                          : "-"}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
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
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
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
                        placeholder="Keterangan transfer..."
                        className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                  </div>

                  {/* SELECTED */}

                  <div className="rounded-xl border border-slate-200">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-700">
                          Barang Transfer
                        </span>

                        <span className="text-xs text-slate-500">
                          {selectedItems.length}{" "}
                          barang
                        </span>
                      </div>
                    </div>

                    {selectedItemDetails.length ===
                    0 ? (
                      <div className="px-4 py-10 text-center">
                        <Package
                          size={34}
                          className="mx-auto mb-2 text-slate-300"
                        />

                        <div className="text-sm text-slate-500">
                          Belum ada barang
                          dipilih
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
                              className="p-3"
                            >
                              <div className="flex gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-slate-700">
                                    {
                                      item
                                        .stock
                                        .barang
                                        .name
                                    }
                                  </div>

                                  <div className="mt-0.5 text-xs text-slate-400">
                                    {
                                      item
                                        .stock
                                        .barang
                                        .code
                                    }{" "}
                                    · Stok{" "}
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
                                    className="w-24 rounded-lg border border-slate-300 px-2.5 py-2 text-center text-sm outline-none focus:border-emerald-500"
                                  />

                                  <span className="w-10 text-xs text-slate-500">
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
                                    className="rounded-lg p-2 text-red-500 hover:bg-red-50"
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

                <div className="rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 p-4">
                    <div className="mb-3 text-sm font-bold text-slate-700">
                      Pilih Barang
                    </div>

                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        value={itemSearch}
                        onChange={(e) =>
                          setItemSearch(
                            e.target.value
                          )
                        }
                        placeholder="Cari kode, nama, barcode..."
                        className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="max-h-[520px] overflow-y-auto">
                    {filteredStocks.length ===
                    0 ? (
                      <div className="px-4 py-10 text-center text-sm text-slate-400">
                        Barang tidak
                        ditemukan.
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
                              className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition ${
                                selected
                                  ? "bg-emerald-50"
                                  : empty
                                  ? "bg-slate-50 opacity-50"
                                  : "hover:bg-slate-50"
                              }`}
                            >
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                  selected
                                    ? "bg-emerald-100 text-emerald-600"
                                    : "bg-slate-100 text-slate-500"
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
                                <div className="truncate text-sm font-semibold text-slate-700">
                                  {
                                    stock
                                      .barang
                                      .name
                                  }
                                </div>

                                <div className="mt-0.5 text-xs text-slate-400">
                                  {
                                    stock
                                      .barang
                                      .code
                                  }
                                </div>
                              </div>

                              <div className="text-right">
                                <div
                                  className={`text-sm font-bold ${
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

                                <div className="text-[11px] text-slate-400">
                                  {
                                    stock
                                      .barang
                                      .unit
                                  }
                                </div>
                              </div>
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

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600">
                Total transfer:{" "}
                <span className="font-bold text-slate-800">
                  {formatNumber(
                    createTotalQty
                  )}
                </span>{" "}
                qty
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeCreate}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
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
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Terima Transfer
                  </h2>

                  <div className="mt-1 text-xs text-slate-500">
                    {
                      receiveTransfer.number
                    }
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowReceive(false)
                  }
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-5">
                <div className="mb-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs text-slate-400">
                      Dari
                    </div>

                    <div className="mt-1 font-semibold text-slate-700">
                      {receiveTransfer
                        .sourceOutlet
                        ?.name ||
                        "-"}
                    </div>
                  </div>

                  <div className="rounded-lg bg-emerald-50 p-3">
                    <div className="text-xs text-emerald-600">
                      Ke
                    </div>

                    <div className="mt-1 font-semibold text-emerald-800">
                      {(
                        receiveTransfer
                          .destinationOutlet ||
                        receiveTransfer.outlet
                      )?.name ||
                        "-"}
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left">
                          <th className="px-4 py-3 font-semibold text-slate-600">
                            Barang
                          </th>

                          <th className="px-4 py-3 text-center font-semibold text-slate-600">
                            Transfer
                          </th>

                          <th className="px-4 py-3 text-center font-semibold text-slate-600">
                            Sudah Diterima
                          </th>

                          <th className="px-4 py-3 text-center font-semibold text-slate-600">
                            Sisa
                          </th>

                          <th className="px-4 py-3 text-center font-semibold text-slate-600">
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
                                  className="border-b border-slate-100 last:border-0"
                                >
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-slate-700">
                                      {
                                        item
                                          .barang
                                          .name
                                      }
                                    </div>

                                    <div className="mt-0.5 text-xs text-slate-400">
                                      {
                                        item
                                          .barang
                                          .code
                                      }
                                    </div>
                                  </td>

                                  <td className="px-4 py-3 text-center font-semibold">
                                    {formatNumber(
                                      Number(
                                        item.qty
                                      )
                                    )}
                                  </td>

                                  <td className="px-4 py-3 text-center text-slate-500">
                                    {formatNumber(
                                      Number(
                                        item.receivedQty ||
                                          0
                                      )
                                    )}
                                  </td>

                                  <td className="px-4 py-3 text-center font-semibold text-orange-600">
                                    {formatNumber(
                                      remaining
                                    )}
                                  </td>

                                  <td className="px-4 py-3">
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
                                      className="w-28 rounded-lg border border-slate-300 px-2.5 py-2 text-center text-sm font-semibold outline-none focus:border-emerald-500"
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

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
                <button
                  type="button"
                  onClick={() =>
                    setShowReceive(false)
                  }
                  disabled={
                    receivingId !== null
                  }
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
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
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400"
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
        )}
    </div>
  );
}

// =====================================================
// SUMMARY CARD
// =====================================================

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-500">
          {label}
        </div>

        <div className="text-slate-400">
          {icon}
        </div>
      </div>

      <div className="text-2xl font-bold text-slate-800">
        {formatNumber(value)}
      </div>
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
      <tr className="border-b border-slate-100 hover:bg-slate-50">
        <td className="px-4 py-3">
          <div className="font-bold text-slate-700">
            {transfer.number}
          </div>

          <div className="mt-1 text-xs text-slate-400">
            {formatDate(
              transfer.transferDate
            )}
          </div>
        </td>

        <td className="px-4 py-3">
          <div className="font-semibold text-slate-700">
            {transfer.sourceOutlet
              ?.code || "-"}
          </div>

          <div className="text-xs text-slate-400">
            {transfer.sourceOutlet
              ?.name || "-"}
          </div>
        </td>

        <td className="px-4 py-3">
          <div className="font-semibold text-slate-700">
            {destination?.code || "-"}
          </div>

          <div className="text-xs text-slate-400">
            {destination?.name || "-"}
          </div>
        </td>

        <td className="px-4 py-3 text-center font-semibold text-slate-700">
          {formatNumber(
            transfer.totalQty
          )}
        </td>

        <td className="px-4 py-3 text-center font-semibold text-green-600">
          {formatNumber(
            transfer.totalReceived
          )}
        </td>

        <td className="px-4 py-3 text-center font-semibold text-orange-600">
          {formatNumber(
            transfer.remainingQty
          )}
        </td>

        <td className="px-4 py-3">
          <StatusBadge
            status={
              transfer.status
            }
          />
        </td>

        <td className="px-4 py-3">
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={onToggle}
              title="Detail"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
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

            {canReceive && (
              <button
                type="button"
                onClick={onReceive}
                disabled={receiving}
                title="Terima"
                className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
              >
                {receiving ? (
                  <RefreshCw
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <CheckCircle2
                    size={17}
                  />
                )}
              </button>
            )}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-slate-200 bg-slate-50">
          <td
            colSpan={8}
            className="px-5 py-4"
          >
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-bold text-slate-700">
                    Detail Barang
                  </div>

                  {transfer.remarks && (
                    <div className="text-xs text-slate-500">
                      Keterangan:{" "}
                      {transfer.remarks}
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left">
                      <th className="px-4 py-2.5 font-semibold text-slate-500">
                        Kode
                      </th>

                      <th className="px-4 py-2.5 font-semibold text-slate-500">
                        Barang
                      </th>

                      <th className="px-4 py-2.5 text-center font-semibold text-slate-500">
                        Transfer
                      </th>

                      <th className="px-4 py-2.5 text-center font-semibold text-slate-500">
                        Diterima
                      </th>

                      <th className="px-4 py-2.5 text-center font-semibold text-slate-500">
                        Sisa
                      </th>

                      <th className="px-4 py-2.5 font-semibold text-slate-500">
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
                            className="border-b border-slate-100 last:border-0"
                          >
                            <td className="px-4 py-3 font-medium text-slate-600">
                              {
                                item
                                  .barang
                                  .code
                              }
                            </td>

                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-700">
                                {
                                  item
                                    .barang
                                    .name
                                }
                              </div>
                            </td>

                            <td className="px-4 py-3 text-center">
                              {formatNumber(
                                Number(
                                  item.qty
                                )
                              )}
                            </td>

                            <td className="px-4 py-3 text-center font-semibold text-green-600">
                              {formatNumber(
                                Number(
                                  item.receivedQty ||
                                    0
                                )
                              )}
                            </td>

                            <td className="px-4 py-3 text-center font-semibold text-orange-600">
                              {formatNumber(
                                remaining
                              )}
                            </td>

                            <td className="px-4 py-3 text-slate-500">
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