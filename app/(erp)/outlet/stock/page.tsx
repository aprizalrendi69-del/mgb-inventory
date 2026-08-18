"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Package,
  Warehouse,
  ChevronDown,
  ClipboardCheck,
  LockKeyhole,
  History,
  X,
  CalendarDays,
  ArrowUp,
  ArrowDown,
  Minus,
  ArrowDownCircle,
  ArrowUpCircle,
  Info,
} from "lucide-react";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type LastOpname = {
  opnameId: number;
  code: string;
  date: string;
  status: string;
  systemQty: number;
  physicalQty: number;
  difference: number;
  note: string | null;
};

type Stock = {
  id: number;
  outletId: number;
  barangId: number;
  stock: number;
  minimumStock: number;
  averageCost: number;

  barang: {
    id: number;
    code: string;
    name: string;
    unit: string;
    barcode: string | null;
  };

  outlet: {
    id: number;
    code: string;
    name: string;
  };

  lastOpname: LastOpname | null;
};

type ApiResponse = {
  success: boolean;
  data: Stock[];
  message?: string;
};

type HistoryBarang = {
  id: number;
  code: string;
  name: string;
  unit: string;
  barcode: string | null;
};

type HistoryRow = {
  id: string;
  date: string;
  type: string;
  direction: "IN" | "OUT" | "INFO";
  number: string | null;
  outletId: number | null;
  barangId: number;
  qty: number;
  stockBefore: number | null;
  stockAfter: number | null;
  status: string | null;
  description: string | null;
  source: string;
  barang: HistoryBarang | null;
};

type HistoryResponse = {
  success: boolean;
  data: HistoryRow[];
  summary?: {
    total: number;
    stockIn: number;
    stockOut: number;
    informational: number;
  };
  message?: string;
};

export default function OutletStockPage() {
  const [data, setData] = useState<Stock[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);

  const [outletId, setOutletId] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingOutlet, setLoadingOutlet] = useState(true);

  const [error, setError] = useState("");

  // =====================================================
  // HISTORY MODAL
  // =====================================================

  const [selectedHistory, setSelectedHistory] =
    useState<Stock | null>(null);

  const [historyData, setHistoryData] =
    useState<HistoryRow[]>([]);

  const [historySummary, setHistorySummary] =
    useState({
      total: 0,
      stockIn: 0,
      stockOut: 0,
      informational: 0,
    });

  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [historyError, setHistoryError] =
    useState("");

  // =====================================================
  // LOAD OUTLET
  // =====================================================

  async function loadOutlets() {
    try {
      setLoadingOutlet(true);

      const res = await fetch("/api/outlet", {
        cache: "no-store",
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(
          result?.message ||
            "Gagal mengambil data outlet"
        );
      }

      const list = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
        ? result.data
        : [];

      setOutlets(list);
    } catch (error) {
      console.error(
        "LOAD OUTLET ERROR:",
        error
      );

      setOutlets([]);
    } finally {
      setLoadingOutlet(false);
    }
  }

  // =====================================================
  // LOAD STOCK
  // =====================================================

  async function loadStock(
    selectedOutlet = outletId
  ) {
    try {
      setLoading(true);
      setError("");

      const url = selectedOutlet
        ? `/api/outlet/stock?outletId=${selectedOutlet}`
        : "/api/outlet/stock";

      const res = await fetch(url, {
        cache: "no-store",
      });

      const result: ApiResponse =
        await res.json();

      if (!res.ok || !result.success) {
        throw new Error(
          result.message ||
            "Gagal mengambil stock outlet"
        );
      }

      setData(
        Array.isArray(result.data)
          ? result.data
          : []
      );
    } catch (error: any) {
      console.error(
        "LOAD OUTLET STOCK ERROR:",
        error
      );

      setData([]);

      setError(
        error?.message ||
          "Gagal mengambil stock outlet"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // INITIAL
  // =====================================================

  useEffect(() => {
    loadOutlets();
    loadStock("");
  }, []);

  // =====================================================
  // FILTER OUTLET
  // =====================================================

  function handleOutletChange(
    value: string
  ) {
    setOutletId(value);
    loadStock(value);
  }

  // =====================================================
  // SEARCH
  // =====================================================

  const filteredData = useMemo(() => {
    const keyword =
      search.toLowerCase().trim();

    if (!keyword) {
      return data;
    }

    return data.filter((item) => {
      const code =
        item.barang?.code
          ?.toLowerCase() || "";

      const name =
        item.barang?.name
          ?.toLowerCase() || "";

      const barcode =
        item.barang?.barcode
          ?.toLowerCase() || "";

      return (
        code.includes(keyword) ||
        name.includes(keyword) ||
        barcode.includes(keyword)
      );
    });
  }, [data, search]);

  // =====================================================
  // STATUS STOCK
  // =====================================================

  function getStatus(
    stock: number,
    minimum: number
  ) {
    if (stock <= 0) {
      return {
        text: "HABIS",
        className:
          "bg-red-100 text-red-700",
      };
    }

    if (stock <= minimum) {
      return {
        text: "MINIMUM",
        className:
          "bg-yellow-100 text-yellow-700",
      };
    }

    return {
      text: "AMAN",
      className:
        "bg-green-100 text-green-700",
    };
  }

  // =====================================================
  // STATUS OPNAME
  // =====================================================

  function getOpnameStatus(
    status?: string
  ) {
    const value = String(
      status || ""
    ).toUpperCase();

    if (value === "APPROVED") {
      return {
        text: "APPROVED",
        className:
          "bg-green-100 text-green-700",
      };
    }

    if (
      value === "COUNTING" ||
      value === "PENDING"
    ) {
      return {
        text: "MENUNGGU",
        className:
          "bg-yellow-100 text-yellow-700",
      };
    }

    if (value === "REJECTED") {
      return {
        text: "REJECTED",
        className:
          "bg-red-100 text-red-700",
      };
    }

    return {
      text: value || "-",
      className:
        "bg-gray-100 text-gray-600",
    };
  }

  // =====================================================
  // HISTORY TYPE LABEL
  // =====================================================

  function getHistoryType(
    type: string
  ) {
    switch (type) {
      case "OUTLET_RECEIPT":
        return {
          text: "Barang Masuk Supplier",
          className:
            "bg-green-100 text-green-700",
        };

      case "TRANSFER_IN":
        return {
          text: "Transfer Masuk",
          className:
            "bg-blue-100 text-blue-700",
        };

      case "DELIVERY_IN":
        return {
          text: "Delivery Masuk",
          className:
            "bg-blue-100 text-blue-700",
        };

      case "STOCK_OUT":
        return {
          text: "Pemakaian / Waste",
          className:
            "bg-red-100 text-red-700",
        };

      case "STOCK_OPNAME":
        return {
          text: "Stock Opname",
          className:
            "bg-purple-100 text-purple-700",
        };

      case "STOCK_OPNAME_HISTORY":
        return {
          text: "History Stock Opname",
          className:
            "bg-purple-100 text-purple-700",
        };

      case "OUTLET_PURCHASE":
        return {
          text: "Purchase Order",
          className:
            "bg-gray-100 text-gray-700",
        };

      default:
        return {
          text: type || "-",
          className:
            "bg-gray-100 text-gray-600",
        };
    }
  }

  // =====================================================
  // FORMAT NUMBER
  // =====================================================

  function formatNumber(
    value: number
  ) {
    return Number(
      value ?? 0
    ).toLocaleString("id-ID");
  }

  // =====================================================
  // FORMAT DATE
  // =====================================================

  function formatDate(
    value?: string | null
  ) {
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
        month: "short",
        year: "numeric",
      }
    );
  }

  // =====================================================
  // FORMAT DATE TIME
  // =====================================================

  function formatDateTime(
    value?: string | null
  ) {
    if (!value) return "-";

    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
    }

    return date.toLocaleString(
      "id-ID",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  // =====================================================
  // TOTAL STOCK
  // =====================================================

  const totalStock = useMemo(() => {
    return filteredData.reduce(
      (total, item) =>
        total +
        Number(item.stock || 0),
      0
    );
  }, [filteredData]);

  // =====================================================
  // TOTAL BARANG SO
  // =====================================================

  const totalWithOpname = useMemo(() => {
    return filteredData.filter(
      (item) =>
        item.lastOpname !== null
    ).length;
  }, [filteredData]);

  // =====================================================
  // TOTAL SELISIH SO
  // =====================================================

  const totalDifference = useMemo(() => {
    return filteredData.reduce(
      (total, item) =>
        total +
        Number(
          item.lastOpname
            ?.difference || 0
        ),
      0
    );
  }, [filteredData]);

  // =====================================================
  // SELECTED OUTLET
  // =====================================================

  const selectedOutlet =
    outlets.find(
      (item) =>
        String(item.id) ===
        outletId
    );

  // =====================================================
  // OPEN HISTORY
  // =====================================================

  async function openHistory(
    stock: Stock
  ) {
    try {
      setSelectedHistory(stock);
      setHistoryData([]);
      setHistoryError("");
      setHistoryLoading(true);

      const params =
        new URLSearchParams();

      /*
       * Kalau filter outlet sedang dipilih,
       * gunakan outlet tersebut.
       *
       * Kalau kosong, gunakan outlet dari
       * row stock yang diklik.
       */
      const targetOutletId =
        outletId ||
        String(stock.outletId);

      params.set(
        "outletId",
        targetOutletId
      );

      params.set(
        "barangId",
        String(stock.barangId)
      );

      const res = await fetch(
        `/api/outlet/stock/history?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const result: HistoryResponse =
        await res.json();

      if (
        !res.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
            "Gagal mengambil history stock"
        );
      }

      setHistoryData(
        Array.isArray(result.data)
          ? result.data
          : []
      );

      setHistorySummary({
        total:
          Number(
            result.summary?.total ||
              0
          ),

        stockIn:
          Number(
            result.summary?.stockIn ||
              0
          ),

        stockOut:
          Number(
            result.summary?.stockOut ||
              0
          ),

        informational:
          Number(
            result.summary
              ?.informational ||
              0
          ),
      });
    } catch (error: any) {
      console.error(
        "LOAD HISTORY ERROR:",
        error
      );

      setHistoryData([]);

      setHistoryError(
        error?.message ||
          "Gagal mengambil history stock"
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  // =====================================================
  // CLOSE HISTORY
  // =====================================================

  function closeHistory() {
    setSelectedHistory(null);
    setHistoryData([]);
    setHistoryError("");
    setHistoryLoading(false);
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

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <Warehouse size={23} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Stock Outlet
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Persediaan outlet dengan
              informasi stock opname dan
              riwayat transaksi barang
            </p>
          </div>

        </div>

        <button
          type="button"
          onClick={() =>
            loadStock(outletId)
          }
          disabled={loading}
          className="
            inline-flex
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-[#497F70]
            px-4
            py-2.5
            text-sm
            font-semibold
            text-white
            shadow-sm
            transition
            hover:bg-[#3D6D60]
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          {loading
            ? "Memuat..."
            : "Refresh"}
        </button>

      </div>

      {/* =================================================
          LOCK INFO
      ================================================= */}

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#CFE1D9] bg-[#EDF6F1] px-5 py-4">

        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#DCEDE5] text-[#497F70]">
          <LockKeyhole size={18} />
        </div>

        <div>
          <p className="text-sm font-bold text-[#285346]">
            Stock outlet terkunci
          </p>

          <p className="mt-1 text-xs leading-5 text-[#56766B]">
            Angka stock di halaman ini
            adalah stock sistem dan tidak
            dapat diubah secara manual.
            Hasil stock opname ditampilkan
            sebagai informasi kontrol.
            Seluruh transaksi barang dapat
            dilihat melalui tombol History.
          </p>
        </div>

      </div>

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* =================================================
          FILTER
      ================================================= */}

      <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          {/* OUTLET */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#35564C]">
              Filter Outlet
            </label>

            <div className="relative">

              <Warehouse
                size={17}
                className="
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                "
              />

              <select
                value={outletId}
                onChange={(e) =>
                  handleOutletChange(
                    e.target.value
                  )
                }
                disabled={
                  loadingOutlet
                }
                className="
                  w-full
                  appearance-none
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  px-4
                  py-3
                  pl-10
                  pr-10
                  text-sm
                  font-medium
                  text-[#35564C]
                  outline-none
                  transition
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >

                <option value="">
                  Semua Outlet
                </option>

                {outlets.map(
                  (outlet) => (
                    <option
                      key={outlet.id}
                      value={outlet.id}
                    >
                      {outlet.code} -{" "}
                      {outlet.name}
                    </option>
                  )
                )}

              </select>

              <ChevronDown
                size={17}
                className="
                  pointer-events-none
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                "
              />

            </div>
          </div>

          {/* SEARCH */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#35564C]">
              Cari Barang
            </label>

            <div className="relative">

              <Search
                size={17}
                className="
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                "
              />

              <input
                type="text"
                placeholder="Kode, barcode, atau nama barang..."
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  py-3
                  pl-9
                  pr-4
                  text-sm
                  outline-none
                  transition
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />

            </div>
          </div>

        </div>

        {/* FILTER INFO */}

        <div className="mt-4 flex flex-wrap items-center gap-2">

          <span className="text-xs text-gray-500">
            Menampilkan:
          </span>

          <span className="rounded-full bg-[#EAF3EF] px-3 py-1 text-xs font-semibold text-[#497F70]">
            {selectedOutlet
              ? `${selectedOutlet.code} - ${selectedOutlet.name}`
              : "Semua Outlet"}
          </span>

          {search && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              Pencarian: "{search}"
            </span>
          )}

        </div>

      </div>

      {/* =================================================
          SUMMARY
      ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

        {/* JENIS BARANG */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Jenis Barang
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  filteredData.length
                )}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Package size={21} />
            </div>

          </div>

        </div>

        {/* TOTAL STOCK */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Total Qty Stock
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalStock
                )}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Warehouse size={21} />
            </div>

          </div>

        </div>

        {/* SUDAH SO */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Sudah SO
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalWithOpname
                )}
              </p>

              <p className="mt-1 text-[11px] text-gray-400">
                dari{" "}
                {formatNumber(
                  filteredData.length
                )}{" "}
                barang
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <ClipboardCheck
                size={21}
              />
            </div>

          </div>

        </div>

        {/* SELISIH */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Selisih SO Terakhir
              </p>

              <p
                className={`mt-1 text-2xl font-bold ${
                  totalDifference === 0
                    ? "text-[#18352D]"
                    : totalDifference > 0
                    ? "text-green-700"
                    : "text-red-700"
                }`}
              >
                {totalDifference > 0
                  ? "+"
                  : ""}
                {formatNumber(
                  totalDifference
                )}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <ClipboardCheck
                size={21}
              />
            </div>

          </div>

        </div>

      </div>

      {/* =================================================
          TABLE
      ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        <div className="flex flex-col gap-4 border-b border-[#E5ECE9] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">

          <div>
            <h2 className="font-semibold text-[#18352D]">
              Persediaan Outlet
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Stock sistem dan hasil stock
              opname terakhir
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">

            <LockKeyhole size={14} />

            <span>
              Stock terkunci
            </span>

          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="min-w-[1450px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Outlet
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Kode
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Nama Barang
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Satuan
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Stock Sistem
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  SO Terakhir
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Fisik
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Selisih
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Status SO
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Minimum
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Status Stock
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  History
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>
                  <td
                    colSpan={13}
                    className="px-5 py-14 text-center"
                  >

                    <RefreshCw
                      size={22}
                      className="mx-auto mb-2 animate-spin text-[#497F70]"
                    />

                    <p className="text-sm text-gray-500">
                      Memuat stock outlet...
                    </p>

                  </td>
                </tr>

              ) : filteredData.length === 0 ? (

                <tr>
                  <td
                    colSpan={13}
                    className="px-5 py-14 text-center"
                  >

                    <Package
                      size={42}
                      className="mx-auto mb-3 text-gray-300"
                    />

                    <p className="font-medium text-gray-500">
                      Belum ada data stock outlet
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      Pastikan stock outlet
                      sudah tersedia.
                    </p>

                  </td>
                </tr>

              ) : (

                filteredData.map(
                  (item, index) => {

                    const stockStatus =
                      getStatus(
                        Number(
                          item.stock
                        ),
                        Number(
                          item.minimumStock
                        )
                      );

                    const lastOpname =
                      item.lastOpname;

                    const difference =
                      Number(
                        lastOpname
                          ?.difference || 0
                      );

                    const opnameStatus =
                      getOpnameStatus(
                        lastOpname?.status
                      );

                    return (
                      <tr
                        key={item.id}
                        className="
                          border-b
                          border-[#EDF2EF]
                          transition
                          hover:bg-[#FAFCFB]
                        "
                      >

                        <td className="px-5 py-4 text-gray-500">
                          {index + 1}
                        </td>

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {item.outlet?.name ||
                              "-"}
                          </div>

                          <div className="text-xs text-gray-400">
                            {item.outlet?.code ||
                              "-"}
                          </div>

                        </td>

                        <td className="px-5 py-4 font-semibold text-[#35564C]">
                          {item.barang?.code ||
                            "-"}
                        </td>

                        <td className="px-5 py-4">

                          <div className="font-medium text-[#18352D]">
                            {item.barang?.name ||
                              "-"}
                          </div>

                          {item.barang?.barcode && (
                            <div className="text-xs text-gray-400">
                              {item.barang.barcode}
                            </div>
                          )}

                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {item.barang?.unit ||
                            "-"}
                        </td>

                        <td className="px-5 py-4 text-right">

                          <div className="flex items-center justify-end gap-2">

                            <LockKeyhole
                              size={13}
                              className="text-gray-400"
                            />

                            <span className="font-bold text-[#18352D]">
                              {formatNumber(
                                Number(
                                  item.stock
                                )
                              )}
                            </span>

                          </div>

                        </td>

                        <td className="px-5 py-4 text-right">

                          {lastOpname ? (
                            <div>

                              <div className="font-semibold text-[#35564C]">
                                {formatDate(
                                  lastOpname.date
                                )}
                              </div>

                              <div className="mt-0.5 text-[11px] text-gray-400">
                                {lastOpname.code}
                              </div>

                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">
                              Belum ada SO
                            </span>
                          )}

                        </td>

                        <td className="px-5 py-4 text-right">

                          {lastOpname ? (
                            <span className="font-bold text-[#18352D]">
                              {formatNumber(
                                Number(
                                  lastOpname.physicalQty
                                )
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-400">
                              -
                            </span>
                          )}

                        </td>

                        <td className="px-5 py-4 text-right">

                          {!lastOpname ? (
                            <span className="text-gray-400">
                              -
                            </span>
                          ) : difference > 0 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-green-700">
                              <ArrowUp
                                size={14}
                              />
                              +
                              {formatNumber(
                                difference
                              )}
                            </span>
                          ) : difference < 0 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-red-700">
                              <ArrowDown
                                size={14}
                              />
                              {formatNumber(
                                difference
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-gray-500">
                              <Minus
                                size={14}
                              />
                              0
                            </span>
                          )}

                        </td>

                        <td className="px-5 py-4 text-center">

                          {lastOpname ? (
                            <span
                              className={`
                                inline-flex
                                rounded-full
                                px-3
                                py-1
                                text-xs
                                font-semibold
                                ${opnameStatus.className}
                              `}
                            >
                              {
                                opnameStatus.text
                              }
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">
                              -
                            </span>
                          )}

                        </td>

                        <td className="px-5 py-4 text-right text-gray-600">
                          {formatNumber(
                            Number(
                              item.minimumStock
                            )
                          )}
                        </td>

                        <td className="px-5 py-4 text-center">

                          <span
                            className={`
                              inline-flex
                              rounded-full
                              px-3
                              py-1
                              text-xs
                              font-semibold
                              ${stockStatus.className}
                            `}
                          >
                            {
                              stockStatus.text
                            }
                          </span>

                        </td>

                        <td className="px-5 py-4 text-center">

                          <button
                            type="button"
                            onClick={() =>
                              openHistory(
                                item
                              )
                            }
                            className="
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-lg
                              border
                              border-[#CFE1D9]
                              bg-[#F7FBF9]
                              px-3
                              py-2
                              text-xs
                              font-semibold
                              text-[#497F70]
                              transition
                              hover:bg-[#EAF3EF]
                            "
                          >

                            <History
                              size={14}
                            />

                            History

                          </button>

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
          HISTORY MODAL
      ================================================= */}

      {selectedHistory && (
        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-black/40
            p-4
          "
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeHistory();
            }
          }}
        >

          <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* =================================================
                MODAL HEADER
            ================================================= */}

            <div className="flex items-start justify-between border-b border-[#E5ECE9] px-6 py-5">

              <div>

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                    <History size={20} />
                  </div>

                  <div>

                    <h2 className="text-lg font-bold text-[#18352D]">
                      History Stock Barang
                    </h2>

                    <p className="mt-0.5 text-sm text-gray-500">
                      {selectedHistory.barang.name}
                    </p>

                  </div>

                </div>

                <div className="mt-3 flex flex-wrap gap-2">

                  <span className="rounded-full bg-[#EAF3EF] px-3 py-1 text-xs font-semibold text-[#497F70]">
                    {selectedHistory.barang.code}
                  </span>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    Satuan:{" "}
                    {selectedHistory.barang.unit}
                  </span>

                  <span className="rounded-full bg-[#FFF8E7] px-3 py-1 text-xs font-semibold text-[#8A6A1E]">
                    Stock Sistem:{" "}
                    {formatNumber(
                      Number(
                        selectedHistory.stock
                      )
                    )}
                  </span>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    Outlet:{" "}
                    {selectedHistory.outlet.name}
                  </span>

                </div>

              </div>

              <button
                type="button"
                onClick={closeHistory}
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-lg
                  text-gray-400
                  transition
                  hover:bg-gray-100
                  hover:text-gray-600
                "
              >
                <X size={19} />
              </button>

            </div>

            {/* =================================================
                HISTORY SUMMARY
            ================================================= */}

            <div className="grid grid-cols-2 gap-3 border-b border-[#E5ECE9] bg-[#FAFCFB] p-5 md:grid-cols-4">

              <div className="rounded-xl border border-[#DDE9E4] bg-white p-4">

                <div className="flex items-center gap-2">

                  <History
                    size={16}
                    className="text-[#497F70]"
                  />

                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Total Transaksi
                  </p>

                </div>

                <p className="mt-1 text-xl font-bold text-[#18352D]">
                  {formatNumber(
                    historySummary.total
                  )}
                </p>

              </div>

              <div className="rounded-xl border border-[#DDE9E4] bg-white p-4">

                <div className="flex items-center gap-2">

                  <ArrowDownCircle
                    size={16}
                    className="text-green-600"
                  />

                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Total Masuk
                  </p>

                </div>

                <p className="mt-1 text-xl font-bold text-green-700">
                  +
                  {formatNumber(
                    historySummary.stockIn
                  )}
                </p>

              </div>

              <div className="rounded-xl border border-[#DDE9E4] bg-white p-4">

                <div className="flex items-center gap-2">

                  <ArrowUpCircle
                    size={16}
                    className="text-red-600"
                  />

                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Total Keluar
                  </p>

                </div>

                <p className="mt-1 text-xl font-bold text-red-700">
                  -
                  {formatNumber(
                    historySummary.stockOut
                  )}
                </p>

              </div>

              <div className="rounded-xl border border-[#DDE9E4] bg-white p-4">

                <div className="flex items-center gap-2">

                  <Info
                    size={16}
                    className="text-blue-600"
                  />

                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Informasi
                  </p>

                </div>

                <p className="mt-1 text-xl font-bold text-blue-700">
                  {formatNumber(
                    historySummary.informational
                  )}
                </p>

              </div>

            </div>

            {/* =================================================
                MODAL BODY
            ================================================= */}

            <div className="min-h-0 flex-1 overflow-y-auto p-6">

              {historyLoading ? (

                <div className="rounded-2xl border border-[#DDE9E4] bg-[#FAFCFB] px-6 py-16 text-center">

                  <RefreshCw
                    size={28}
                    className="mx-auto mb-3 animate-spin text-[#497F70]"
                  />

                  <p className="font-medium text-gray-500">
                    Memuat history transaksi...
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    Mengambil seluruh transaksi
                    barang outlet.
                  </p>

                </div>

              ) : historyError ? (

                <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center">

                  <Info
                    size={36}
                    className="mx-auto mb-3 text-red-400"
                  />

                  <p className="font-semibold text-red-700">
                    Gagal mengambil history
                  </p>

                  <p className="mt-1 text-sm text-red-600">
                    {historyError}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      openHistory(
                        selectedHistory
                      )
                    }
                    className="
                      mt-4
                      rounded-xl
                      bg-[#497F70]
                      px-4
                      py-2.5
                      text-sm
                      font-semibold
                      text-white
                      hover:bg-[#3D6D60]
                    "
                  >
                    Coba Lagi
                  </button>

                </div>

              ) : historyData.length === 0 ? (

                <div className="rounded-2xl border border-dashed border-[#DDE9E4] px-6 py-16 text-center">

                  <History
                    size={42}
                    className="mx-auto mb-3 text-gray-300"
                  />

                  <p className="font-medium text-gray-500">
                    Belum ada history transaksi
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    Barang ini belum memiliki
                    transaksi yang tercatat.
                  </p>

                </div>

              ) : (

                <div className="overflow-hidden rounded-2xl border border-[#DDE9E4]">

                  <div className="overflow-x-auto">

                    <table className="min-w-[1200px] w-full text-sm">

                      <thead className="bg-[#F5F8F6]">

                        <tr className="border-b border-[#E5ECE9]">

                          <th className="px-4 py-3 text-left font-semibold text-[#35564C]">
                            No
                          </th>

                          <th className="px-4 py-3 text-left font-semibold text-[#35564C]">
                            Tanggal
                          </th>

                          <th className="px-4 py-3 text-left font-semibold text-[#35564C]">
                            Jenis Transaksi
                          </th>

                          <th className="px-4 py-3 text-left font-semibold text-[#35564C]">
                            No. Transaksi
                          </th>

                          <th className="px-4 py-3 text-right font-semibold text-[#35564C]">
                            Masuk
                          </th>

                          <th className="px-4 py-3 text-right font-semibold text-[#35564C]">
                            Keluar
                          </th>

                          <th className="px-4 py-3 text-center font-semibold text-[#35564C]">
                            Status
                          </th>

                          <th className="px-4 py-3 text-left font-semibold text-[#35564C]">
                            Keterangan
                          </th>

                        </tr>

                      </thead>

                      <tbody>

                        {historyData.map(
                          (
                            history,
                            index
                          ) => {

                            const type =
                              getHistoryType(
                                history.type
                              );

                            const isIn =
                              history.direction ===
                              "IN";

                            const isOut =
                              history.direction ===
                              "OUT";

                            return (
                              <tr
                                key={
                                  history.id
                                }
                                className="
                                  border-b
                                  border-[#EDF2EF]
                                  last:border-b-0
                                  hover:bg-[#FAFCFB]
                                "
                              >

                                {/* NO */}

                                <td className="px-4 py-4 text-gray-500">
                                  {index + 1}
                                </td>

                                {/* DATE */}

                                <td className="px-4 py-4">

                                  <div className="flex items-center gap-2">

                                    <CalendarDays
                                      size={14}
                                      className="text-gray-400"
                                    />

                                    <div>

                                      <div className="font-medium text-[#18352D]">
                                        {formatDate(
                                          history.date
                                        )}
                                      </div>

                                      <div className="text-[11px] text-gray-400">
                                        {formatDateTime(
                                          history.date
                                        ).split(
                                          ", "
                                        )[1] ||
                                          ""}
                                      </div>

                                    </div>

                                  </div>

                                </td>

                                {/* TYPE */}

                                <td className="px-4 py-4">

                                  <span
                                    className={`
                                      inline-flex
                                      rounded-full
                                      px-3
                                      py-1
                                      text-xs
                                      font-semibold
                                      ${type.className}
                                    `}
                                  >
                                    {type.text}
                                  </span>

                                </td>

                                {/* NUMBER */}

                                <td className="px-4 py-4">

                                  <span className="font-semibold text-[#35564C]">
                                    {history.number ||
                                      "-"}
                                  </span>

                                </td>

                                {/* IN */}

                                <td className="px-4 py-4 text-right">

                                  {isIn ? (
                                    <span className="inline-flex items-center gap-1 font-bold text-green-700">

                                      <ArrowDownCircle
                                        size={14}
                                      />

                                      +
                                      {formatNumber(
                                        Number(
                                          history.qty
                                        )
                                      )}

                                    </span>
                                  ) : (
                                    <span className="text-gray-300">
                                      -
                                    </span>
                                  )}

                                </td>

                                {/* OUT */}

                                <td className="px-4 py-4 text-right">

                                  {isOut ? (
                                    <span className="inline-flex items-center gap-1 font-bold text-red-700">

                                      <ArrowUpCircle
                                        size={14}
                                      />

                                      -
                                      {formatNumber(
                                        Number(
                                          history.qty
                                        )
                                      )}

                                    </span>
                                  ) : (
                                    <span className="text-gray-300">
                                      -
                                    </span>
                                  )}

                                </td>

                                {/* STATUS */}

                                <td className="px-4 py-4 text-center">

                                  {history.status ? (
                                    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                                      {
                                        history.status
                                      }
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">
                                      -
                                    </span>
                                  )}

                                </td>

                                {/* DESCRIPTION */}

                                <td className="px-4 py-4">

                                  <div className="max-w-[360px]">

                                    <p className="text-sm text-gray-600">
                                      {
                                        history.description ||
                                        "-"
                                      }
                                    </p>

                                    {(history.stockBefore !==
                                      null ||
                                      history.stockAfter !==
                                        null) && (
                                      <div className="mt-1 text-[11px] text-gray-400">

                                        Stock:
                                        {" "}
                                        {history.stockBefore !==
                                        null
                                          ? formatNumber(
                                              Number(
                                                history.stockBefore
                                              )
                                            )
                                          : "-"}

                                        {" → "}

                                        {history.stockAfter !==
                                        null
                                          ? formatNumber(
                                              Number(
                                                history.stockAfter
                                              )
                                            )
                                          : "-"}

                                      </div>
                                    )}

                                  </div>

                                </td>

                              </tr>
                            );
                          }
                        )}

                      </tbody>

                    </table>

                  </div>

                </div>

              )}

            </div>

            {/* =================================================
                FOOTER
            ================================================= */}

            <div className="flex items-center justify-between border-t border-[#E5ECE9] bg-[#FAFCFB] px-6 py-4">

              <div className="flex items-center gap-2 text-xs text-gray-500">

                <LockKeyhole
                  size={14}
                />

                <span>
                  Stock sistem tetap
                  terkunci.
                </span>

              </div>

              <button
                type="button"
                onClick={closeHistory}
                className="
                  rounded-xl
                  bg-[#497F70]
                  px-4
                  py-2.5
                  text-sm
                  font-semibold
                  text-white
                  transition
                  hover:bg-[#3D6D60]
                "
              >
                Tutup
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}