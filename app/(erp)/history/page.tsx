"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  CheckCircle2,
  ChevronsUpDown,
  Eye,
  FileText,
  Filter,
  Hash,
  History,
  MessageSquareText,
  Package,
  RefreshCw,
  Search,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

type Direction = "IN" | "OUT" | "OTHER";

type HistoryItem = {
  id: number | string;
  barangId?: number | null;
  kodeBarang?: string | null;
  code?: string | null;
  barcode?: string | null;
  barang?: string | null;
  namaBarang?: string | null;
  satuan?: string | null;
  trxDate?: string | null;
  tanggal?: string | null;
  createdAt?: string | null;
  trxType?: string | null;
  tipe?: string | null;
  transactionType?: string | null;
  trxNumber?: string | null;
  nomor?: string | null;
  reference?: string | null;
  referenceId?: number | null;
  warehouse?: string | null;
  qtyIn?: number | null;
  qtyOut?: number | null;
  balance?: number | null;
  unitPrice?: number | null;
  totalValue?: number | null;
  note?: string | null;
  description?: string | null;
  direction?: Direction;
};

type SortKey =
  | "trxDate"
  | "trxType"
  | "reference"
  | "barang"
  | "qtyIn"
  | "qtyOut"
  | "balance"
  | "totalValue";

type SortDirection = "asc" | "desc";

/* =========================================================
 * DATE HELPERS
 * ========================================================= */

function getCurrentMonthValue() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  return `${year}-${month}`;
}

function getMonthRange(monthValue: string) {
  const [yearString, monthString] =
    monthValue.split("-");

  const year = Number(yearString);
  const month = Number(monthString);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  ) {
    const current = getCurrentMonthValue();

    return {
      dateFrom: `${current}-01`,
      dateTo: getLastDayOfMonth(
        current
      ),
    };
  }

  const normalizedMonth = String(
    month
  ).padStart(2, "0");

  const dateFrom =
    `${year}-${normalizedMonth}-01`;

  const dateTo =
    getLastDayOfMonth(
      `${year}-${normalizedMonth}`
    );

  return {
    dateFrom,
    dateTo,
  };
}

function getLastDayOfMonth(
  monthValue: string
) {
  const [yearString, monthString] =
    monthValue.split("-");

  const year = Number(yearString);
  const month = Number(monthString);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month)
  ) {
    const now = new Date();

    return `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(
      new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate()
    ).padStart(2, "0")}`;
  }

  const lastDay = new Date(
    year,
    month,
    0
  ).getDate();

  return `${year}-${String(month).padStart(
    2,
    "0"
  )}-${String(lastDay).padStart(2, "0")}`;
}

function getMonthLabel(
  monthValue: string
) {
  const [yearString, monthString] =
    monthValue.split("-");

  const year = Number(yearString);
  const month = Number(monthString);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  ) {
    return monthValue;
  }

  const date = new Date(
    year,
    month - 1,
    1
  );

  return date.toLocaleDateString(
    "id-ID",
    {
      month: "long",
      year: "numeric",
    }
  );
}

function getDateRangeLabel(
  dateFrom: string,
  dateTo: string
) {
  if (!dateFrom && !dateTo) {
    return "Semua Periode";
  }

  if (dateFrom && dateTo && dateFrom === dateTo) {
    return formatDate(dateFrom);
  }

  if (dateFrom && dateTo) {
    return `${formatDate(dateFrom)} — ${formatDate(dateTo)}`;
  }

  if (dateFrom) {
    return `Mulai ${formatDate(dateFrom)}`;
  }

  return `Sampai ${formatDate(dateTo)}`;
}

/* =========================================================
 * FORMAT HELPERS
 * ========================================================= */

function num(value: unknown) {
  const n = Number(value ?? 0);

  return Number.isFinite(n)
    ? n
    : 0;
}

function formatQty(value: unknown) {
  return num(value).toLocaleString(
    "id-ID",
    {
      maximumFractionDigits: 4,
    }
  );
}

function formatMoney(value: unknown) {
  return `Rp ${num(value).toLocaleString(
    "id-ID",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  )}`;
}

function formatDate(value: unknown) {
  if (!value) return "-";

  const date = new Date(
    String(value)
  );

  if (
    Number.isNaN(date.getTime())
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

function formatDateTime(value: unknown) {
  if (!value) return "-";

  const date = new Date(
    String(value)
  );

  if (
    Number.isNaN(date.getTime())
  ) {
    return "-";
  }

  return date.toLocaleString(
    "id-ID",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

/* =========================================================
 * TRANSACTION HELPERS
 * ========================================================= */

function getDirection(
  item: HistoryItem
): Direction {
  const qtyIn = num(item.qtyIn);
  const qtyOut = num(item.qtyOut);

  if (
    qtyIn > 0 &&
    qtyOut <= 0
  ) {
    return "IN";
  }

  if (
    qtyOut > 0 &&
    qtyIn <= 0
  ) {
    return "OUT";
  }

  return "OTHER";
}

function getTypeStyle(
  item: HistoryItem
) {
  const direction =
    getDirection(item);

  const type =
    item.transactionType ||
    item.trxType ||
    item.tipe ||
    "TRANSAKSI";

  if (direction === "IN") {
    return {
      label: type,
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
      iconClass:
        "bg-emerald-100 text-emerald-700",
      icon: ArrowDownToLine,
    };
  }

  if (direction === "OUT") {
    return {
      label: type,
      className:
        "border-red-200 bg-red-50 text-red-700",
      iconClass:
        "bg-red-100 text-red-700",
      icon: ArrowUpFromLine,
    };
  }

  return {
    label: type,
    className:
      "border-slate-200 bg-slate-100 text-slate-600",
    iconClass:
      "bg-slate-200 text-slate-600",
    icon: FileText,
  };
}

/* =========================================================
 * COMPONENT
 * ========================================================= */

export default function HistoryPage() {
  const [data, setData] =
    useState<HistoryItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  /*
   * Default periode selalu seluruh bulan berjalan.
   * Tanggal From/To dapat diubah untuk menampilkan
   * periode custom.
   */
  const currentMonthRange = useMemo(
    () =>
      getMonthRange(
        getCurrentMonthValue()
      ),
    []
  );

  const [selectedMonth, setSelectedMonth] =
    useState(
      getCurrentMonthValue()
    );

  const [dateFrom, setDateFrom] =
    useState(
      currentMonthRange.dateFrom
    );

  const [dateTo, setDateTo] =
    useState(
      currentMonthRange.dateTo
    );

  const [search, setSearch] =
    useState("");

  const [
    transactionFilter,
    setTransactionFilter,
  ] = useState("ALL");

  const [sortKey, setSortKey] =
    useState<SortKey>("trxDate");

  const [
    sortDirection,
    setSortDirection,
  ] =
    useState<SortDirection>("desc");

  const [
    selectedItem,
    setSelectedItem,
  ] =
    useState<HistoryItem | null>(null);

  const periodLabel = useMemo(
    () =>
      getDateRangeLabel(
        dateFrom,
        dateTo
      ),
    [dateFrom, dateTo]
  );


  /* =======================================================
   * LOAD DATA
   * ======================================================= */

  async function loadData(
    from = dateFrom,
    to = dateTo
  ) {
    try {
      setLoading(true);
      setErrorMessage("");

      const params =
        new URLSearchParams();

      /*
       * History mengambil transaksi sesuai
       * periode tanggal yang dipilih.
       * Default-nya adalah seluruh bulan berjalan.
       */
      params.set(
        "dateFrom",
        from
      );

      params.set(
        "dateTo",
        to
      );

      if (search.trim()) {
        params.set(
          "search",
          search.trim()
        );
      }

      if (
        transactionFilter !== "ALL"
      ) {
        params.set(
          "trxType",
          transactionFilter
        );
      }

      const query =
        params.toString();

      const response =
        await fetch(
          `/api/history${
            query
              ? `?${query}`
              : ""
          }`,
          {
            cache: "no-store",
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
            "Gagal mengambil history transaksi"
        );
      }

      setData(
        Array.isArray(
          result.data
        )
          ? result.data
          : []
      );

    } catch (error) {
      console.error(
        "LOAD HISTORY ERROR:",
        error
      );

      setData([]);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal mengambil history transaksi"
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Saat pertama kali halaman dibuka,
   * langsung mengambil bulan berjalan.
   *
   * Saat halaman pertama dibuka,
   * otomatis mengambil seluruh bulan berjalan.
   * Perubahan preset bulan langsung diterapkan
   * melalui handleMonthChange.
   */
  useEffect(() => {
    loadData();
    // Initial load: seluruh bulan berjalan.
    // Filter berikutnya dijalankan melalui tombol Terapkan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =======================================================
   * TRANSACTION TYPES
   * ======================================================= */

  const transactionTypes =
    useMemo(() => {
      const types =
        new Set<string>();

      data.forEach((item) => {
        const type =
          String(
            item.transactionType ||
              item.trxType ||
              item.tipe ||
              ""
          ).trim();

        if (type) {
          types.add(type);
        }
      });

      return Array.from(
        types
      ).sort((a, b) =>
        a.localeCompare(b)
      );
    }, [data]);

  /* =======================================================
   * LOCAL FILTER
   * ======================================================= */

  const filteredData =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return data.filter(
        (item) => {
          const type =
            String(
              item.transactionType ||
                item.trxType ||
                item.tipe ||
                ""
            ).toLowerCase();

          const reference =
            String(
              item.reference ||
                item.trxNumber ||
                item.nomor ||
                ""
            ).toLowerCase();

          const code =
            String(
              item.kodeBarang ||
                item.code ||
                ""
            ).toLowerCase();

          const name =
            String(
              item.barang ||
                item.namaBarang ||
                ""
            ).toLowerCase();

          const barcode =
            String(
              item.barcode || ""
            ).toLowerCase();

          const description =
            String(
              item.description ||
                item.note ||
                ""
            ).toLowerCase();

          const matchesSearch =
            !keyword ||
            type.includes(keyword) ||
            reference.includes(
              keyword
            ) ||
            code.includes(keyword) ||
            name.includes(keyword) ||
            barcode.includes(
              keyword
            ) ||
            description.includes(
              keyword
            );

          const actualType =
            String(
              item.transactionType ||
                item.trxType ||
                item.tipe ||
                ""
            );

          const matchesType =
            transactionFilter ===
              "ALL" ||
            actualType ===
              transactionFilter;

          return (
            matchesSearch &&
            matchesType
          );
        }
      );
    }, [
      data,
      search,
      transactionFilter,
    ]);

  /* =======================================================
   * SORTING
   * ======================================================= */

  const sortedData =
    useMemo(() => {
      const result = [
        ...filteredData,
      ];

      result.sort((a, b) => {
        let comparison = 0;

        switch (sortKey) {
          case "trxDate": {
            const first =
              new Date(
                String(
                  a.trxDate ||
                    a.tanggal ||
                    a.createdAt ||
                    ""
                )
              ).getTime();

            const second =
              new Date(
                String(
                  b.trxDate ||
                    b.tanggal ||
                    b.createdAt ||
                    ""
                )
              ).getTime();

            comparison =
              first - second;

            break;
          }

          case "trxType":
            comparison =
              String(
                a.transactionType ||
                  a.trxType ||
                  ""
              ).localeCompare(
                String(
                  b.transactionType ||
                    b.trxType ||
                    ""
                ),
                "id",
                {
                  sensitivity:
                    "base",
                }
              );

            break;

          case "reference":
            comparison =
              String(
                a.reference ||
                  a.trxNumber ||
                  ""
              ).localeCompare(
                String(
                  b.reference ||
                    b.trxNumber ||
                    ""
                ),
                "id",
                {
                  numeric: true,
                  sensitivity:
                    "base",
                }
              );

            break;

          case "barang":
            comparison =
              String(
                a.barang ||
                  a.namaBarang ||
                  ""
              ).localeCompare(
                String(
                  b.barang ||
                    b.namaBarang ||
                    ""
                ),
                "id",
                {
                  sensitivity:
                    "base",
                }
              );

            break;

          case "qtyIn":
            comparison =
              num(a.qtyIn) -
              num(b.qtyIn);

            break;

          case "qtyOut":
            comparison =
              num(a.qtyOut) -
              num(b.qtyOut);

            break;

          case "balance":
            comparison =
              num(a.balance) -
              num(b.balance);

            break;

          case "totalValue":
            comparison =
              num(a.totalValue) -
              num(b.totalValue);

            break;
        }

        return sortDirection ===
          "asc"
          ? comparison
          : -comparison;
      });

      return result;
    }, [
      filteredData,
      sortKey,
      sortDirection,
    ]);

  /* =======================================================
   * TABLE DATA
   * ======================================================= */

  // Semua transaksi pada periode/filter yang dipilih
  // ditampilkan langsung tanpa pagination.
  /* =======================================================
   * SUMMARY
   * ======================================================= */

  const totalQtyIn =
    data.reduce(
      (sum, item) =>
        sum +
        num(item.qtyIn),
      0
    );

  const totalQtyOut =
    data.reduce(
      (sum, item) =>
        sum +
        num(item.qtyOut),
      0
    );

  const totalIn =
    data.filter(
      (item) =>
        getDirection(item) ===
        "IN"
    ).length;

  const totalOut =
    data.filter(
      (item) =>
        getDirection(item) ===
        "OUT"
    ).length;

  const totalOther =
    data.length -
    totalIn -
    totalOut;

  const defaultMonth = getCurrentMonthValue();
  const defaultRange = getMonthRange(
    defaultMonth
  );

  const hasFilter =
    Boolean(search.trim()) ||
    transactionFilter !==
      "ALL" ||
    dateFrom !== defaultRange.dateFrom ||
    dateTo !== defaultRange.dateTo;

  /* =======================================================
   * ACTIONS
   * ======================================================= */

  function resetFilters() {
    const defaultMonth =
      getCurrentMonthValue();
    const defaultRange =
      getMonthRange(defaultMonth);

    setSelectedMonth(
      defaultMonth
    );
    setDateFrom(
      defaultRange.dateFrom
    );
    setDateTo(
      defaultRange.dateTo
    );
    setSearch("");
    setTransactionFilter(
      "ALL"
    );

    loadData(
      defaultRange.dateFrom,
      defaultRange.dateTo
    );
  }

  function handleApplyFilter() {
    if (
      dateFrom &&
      dateTo &&
      dateFrom > dateTo
    ) {
      setErrorMessage(
        "Tanggal Dari tidak boleh lebih besar dari Tanggal Sampai."
      );
      return;
    }

    loadData();
  }

  function handleMonthChange(
    value: string
  ) {
    if (!value) return;

    const range =
      getMonthRange(value);

    setSelectedMonth(value);
    setDateFrom(
      range.dateFrom
    );
    setDateTo(
      range.dateTo
    );

    loadData(
      range.dateFrom,
      range.dateTo
    );
  }

  function handleSort(
    key: SortKey
  ) {
    if (sortKey === key) {
      setSortDirection(
        (current) =>
          current === "asc"
            ? "desc"
            : "asc"
      );

      return;
    }

    setSortKey(key);

    setSortDirection(
      key === "trxDate"
        ? "desc"
        : "asc"
    );
  }

  function SortIcon({
    column,
  }: {
    column: SortKey;
  }) {
    if (
      sortKey !== column
    ) {
      return (
        <ChevronsUpDown
          size={14}
          className="text-slate-300"
        />
      );
    }

    return sortDirection ===
      "asc" ? (
      <ArrowUp
        size={14}
        className="text-emerald-600"
      />
    ) : (
      <ArrowDown
        size={14}
        className="text-emerald-600"
      />
    );
  }

  /* =======================================================
   * RENDER
   * ======================================================= */

  return (
    <div className="min-h-full space-y-6 pb-8">
      {/* =====================================================
       * HERO
       * ===================================================== */}

      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-50 blur-2xl" />

        <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E8F3EC] text-[#29483A]">
              <History size={27} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                  History Stock Pusat
                </h1>

                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  MAIN
                </span>

                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                  {periodLabel}
                </span>
              </div>

              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
                Riwayat pergerakan stock
                pusat berdasarkan
                StockCard pada bulan
                yang dipilih. Setiap
                transaksi menampilkan
                barang, referensi,
                qty masuk, qty keluar,
                balance, dan nilai
                transaksi.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* =================================================
             * MONTH SELECTOR
             * ================================================= */}

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <CalendarDays size={12} />
                Preset Bulan
              </div>

              <input
                type="month"
                value={selectedMonth}
                onChange={(event) =>
                  handleMonthChange(
                    event.target.value
                  )
                }
                className="h-8 min-w-[150px] border-0 bg-transparent p-0 text-sm font-semibold text-slate-700 outline-none focus:ring-0"
              />
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </button>
          </div>
        </div>

        {/* =====================================================
         * PERIOD BAR
         * ===================================================== */}

        <div className="relative border-t border-slate-100 bg-slate-50/60 px-6 py-3">
          <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays
                size={14}
                className="text-emerald-600"
              />

              <span>
                Periode aktif:
              </span>

              <strong className="text-slate-700">
                {periodLabel}
              </strong>
            </div>

            <div className="text-[11px] text-slate-400">
              {formatDate(
                dateFrom
              )}{" "}
              —{" "}
              {formatDate(
                dateTo
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
       * ERROR
       * ===================================================== */}

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100">
            <X size={16} />
          </div>

          <div className="flex-1">
            <p className="font-semibold">
              Gagal memuat history
            </p>

            <p className="mt-1 text-xs text-red-600">
              {errorMessage}
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-red-100"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* =====================================================
       * SUMMARY
       * ===================================================== */}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Transaksi"
          value={data.length}
          description={`StockCard ${periodLabel}`}
          icon={History}
          iconClass="bg-blue-50 text-blue-600"
          valueClass="text-slate-800"
        />

        <SummaryCard
          label="Qty Masuk"
          value={totalQtyIn}
          description={`${totalIn.toLocaleString(
            "id-ID"
          )} transaksi masuk`}
          icon={ArrowDownToLine}
          iconClass="bg-emerald-50 text-emerald-600"
          valueClass="text-emerald-600"
        />

        <SummaryCard
          label="Qty Keluar"
          value={totalQtyOut}
          description={`${totalOut.toLocaleString(
            "id-ID"
          )} transaksi keluar`}
          icon={ArrowUpFromLine}
          iconClass="bg-red-50 text-red-600"
          valueClass="text-red-600"
        />

        <SummaryCard
          label="Transaksi Lain"
          value={totalOther}
          description="Tidak memiliki arah qty tunggal"
          icon={Activity}
          iconClass="bg-violet-50 text-violet-600"
          valueClass="text-violet-600"
        />
      </section>

      {/* =====================================================
       * FILTER
       * ===================================================== */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Filter size={17} />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-700">
                Filter & Pencarian
              </p>

              <p className="text-[11px] text-slate-400">
                History menampilkan seluruh transaksi pada periode tanggal yang dipilih.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasFilter && (
              <button
                type="button"
                onClick={
                  resetFilters
                }
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={14} />
                Reset
              </button>
            )}

            <button
              type="button"
              onClick={
                handleApplyFilter
              }
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#29483A] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#20392F] disabled:opacity-50"
            >
              <Search size={14} />
              Terapkan
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 xl:grid-cols-12">
          {/* DATE FROM */}

          <div className="xl:col-span-3">
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <CalendarDays size={12} />
              Tanggal Dari
            </label>

            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) =>
                setDateFrom(
                  event.target.value
                )
              }
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
            />
          </div>

          {/* DATE TO */}

          <div className="xl:col-span-3">
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <CalendarDays size={12} />
              Tanggal Sampai
            </label>

            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) =>
                setDateTo(
                  event.target.value
                )
              }
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
            />
          </div>

          {/* SEARCH */}

          <div className="relative xl:col-span-4">
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  handleApplyFilter();
                }
              }}
              placeholder="Cari kode, nama barang, barcode, referensi, atau keterangan..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Hapus pencarian"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* TRANSACTION TYPE */}

          <div className="md:col-span-1 xl:col-span-2">
            <select
              value={
                transactionFilter
              }
              onChange={(event) =>
                setTransactionFilter(
                  event.target.value
                )
              }
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
            >
              <option value="ALL">
                Semua Jenis Transaksi
              </option>

              {transactionTypes.map(
                (type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {type}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Menampilkan{" "}
            <strong className="text-slate-700">
              {sortedData.length.toLocaleString(
                "id-ID"
              )}
            </strong>{" "}
            dari{" "}
            <strong className="text-slate-700">
              {data.length.toLocaleString(
                "id-ID"
              )}
            </strong>{" "}
            transaksi pada{" "}
            <strong className="text-slate-700">
              {periodLabel}
            </strong>
          </span>

          <span>
            Periode{" "}
            <strong className="text-slate-700">
              {periodLabel}
            </strong>
          </span>
        </div>
      </section>

      {/* =====================================================
       * TABLE
       * ===================================================== */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Daftar Pergerakan Stock
            </h2>

            <p className="mt-0.5 text-xs text-slate-400">
              Sumber data: StockCard
              warehouse MAIN ·{" "}
              <span>
                {periodLabel}
              </span>
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
            <Package size={13} />
            Stock Pusat
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1250px] w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80">
              <tr>
                <TableHeader label="No" />

                <SortableHeader
                  label="Tanggal"
                  onClick={() =>
                    handleSort(
                      "trxDate"
                    )
                  }
                  icon={
                    <SortIcon column="trxDate" />
                  }
                />

                <SortableHeader
                  label="Jenis"
                  onClick={() =>
                    handleSort(
                      "trxType"
                    )
                  }
                  icon={
                    <SortIcon column="trxType" />
                  }
                />

                <SortableHeader
                  label="Referensi"
                  onClick={() =>
                    handleSort(
                      "reference"
                    )
                  }
                  icon={
                    <SortIcon column="reference" />
                  }
                />

                <SortableHeader
                  label="Barang"
                  onClick={() =>
                    handleSort(
                      "barang"
                    )
                  }
                  icon={
                    <SortIcon column="barang" />
                  }
                />

                <SortableHeader
                  label="Qty Masuk"
                  onClick={() =>
                    handleSort(
                      "qtyIn"
                    )
                  }
                  icon={
                    <SortIcon column="qtyIn" />
                  }
                  align="right"
                />

                <SortableHeader
                  label="Qty Keluar"
                  onClick={() =>
                    handleSort(
                      "qtyOut"
                    )
                  }
                  icon={
                    <SortIcon column="qtyOut" />
                  }
                  align="right"
                />

                <SortableHeader
                  label="Balance"
                  onClick={() =>
                    handleSort(
                      "balance"
                    )
                  }
                  icon={
                    <SortIcon column="balance" />
                  }
                  align="right"
                />

                <SortableHeader
                  label="Harga"
                  onClick={() =>
                    handleSort(
                      "totalValue"
                    )
                  }
                  icon={
                    <SortIcon column="totalValue" />
                  }
                  align="right"
                />

                <TableHeader label="Keterangan" />

                <TableHeader
                  label="Detail"
                  align="center"
                />
              </tr>
            </thead>

            <tbody>
              {/* LOADING */}

              {loading &&
                Array.from({
                  length: 6,
                }).map(
                  (_, index) => (
                    <tr
                      key={index}
                      className="border-b border-slate-100"
                    >
                      <td
                        colSpan={11}
                        className="px-5 py-4"
                      >
                        <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
                      </td>
                    </tr>
                  )
                )}

              {/* EMPTY */}

              {!loading &&
                sortedData.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-5 py-16"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                          <History
                            size={30}
                          />
                        </div>

                        <p className="mt-4 text-sm font-bold text-slate-700">
                          {hasFilter
                            ? "History tidak ditemukan"
                            : "Belum ada history stock"}
                        </p>

                        <p className="mt-1 max-w-md text-center text-xs leading-5 text-slate-400">
                          {hasFilter
                            ? "Tidak ada StockCard yang sesuai dengan filter."
                            : `Belum ada pergerakan stock pusat pada ${periodLabel}.`}
                        </p>

                        {hasFilter && (
                          <button
                            type="button"
                            onClick={
                              resetFilters
                            }
                            className="mt-4 rounded-xl bg-[#29483A] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#20392F]"
                          >
                            Reset Filter
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}

              {/* DATA */}

              {!loading &&
                sortedData.map(
                  (
                    item,
                    index
                  ) => {
                    const style =
                      getTypeStyle(
                        item
                      );

                    const Icon =
                      style.icon;

                    const actualIndex =
                      index + 1;

                    const date =
                      item.trxDate ||
                      item.tanggal ||
                      item.createdAt;

                    const code =
                      item.kodeBarang ||
                      item.code ||
                      "-";

                    const name =
                      item.barang ||
                      item.namaBarang ||
                      "-";

                    const reference =
                      item.reference ||
                      item.trxNumber ||
                      item.nomor ||
                      "-";

                    const description =
                      item.description ||
                      item.note ||
                      "-";

                    return (
                      <tr
                        key={String(
                          item.id
                        )}
                        onClick={() =>
                          setSelectedItem(
                            item
                          )
                        }
                        className="group cursor-pointer border-b border-slate-100 transition hover:bg-emerald-50/40"
                      >
                        <td className="px-4 py-4 text-center">
                          <span className="text-xs font-semibold text-slate-400">
                            {
                              actualIndex
                            }
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-emerald-600">
                              <CalendarDays
                                size={
                                  16
                                }
                              />
                            </div>

                            <div>
                              <p className="font-semibold text-slate-700">
                                {formatDate(
                                  date
                                )}
                              </p>

                              <p className="mt-0.5 text-[11px] text-slate-400">
                                {date
                                  ? new Date(
                                      String(
                                        date
                                      )
                                    ).toLocaleTimeString(
                                      "id-ID",
                                      {
                                        hour: "2-digit",
                                        minute:
                                          "2-digit",
                                      }
                                    )
                                  : "-"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold ${style.className}`}
                          >
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full ${style.iconClass}`}
                            >
                              <Icon
                                size={
                                  11
                                }
                              />
                            </span>

                            {
                              style.label
                            }
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Hash
                              size={
                                14
                              }
                              className="text-slate-300"
                            />

                            <span className="font-semibold text-slate-700">
                              {
                                reference
                              }
                            </span>
                          </div>
                        </td>

                        <td className="max-w-[260px] px-4 py-4">
                          <div>
                            <p className="font-semibold text-slate-700">
                              {code}
                            </p>

                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {name}
                            </p>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          <span
                            className={
                              num(
                                item.qtyIn
                              ) >
                              0
                                ? "font-bold text-emerald-600"
                                : "text-slate-300"
                            }
                          >
                            {num(
                              item.qtyIn
                            ) > 0
                              ? `+${formatQty(
                                  item.qtyIn
                                )}`
                              : "-"}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          <span
                            className={
                              num(
                                item.qtyOut
                              ) >
                              0
                                ? "font-bold text-red-600"
                                : "text-slate-300"
                            }
                          >
                            {num(
                              item.qtyOut
                            ) > 0
                              ? `-${formatQty(
                                  item.qtyOut
                                )}`
                              : "-"}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          <span className="font-bold text-slate-700">
                            {formatQty(
                              item.balance
                            )}
                          </span>

                          <span className="ml-1 text-[11px] text-slate-400">
                            {
                              item.satuan ||
                              ""
                            }
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          <p className="font-semibold text-slate-700">
                            {formatMoney(
                              item.unitPrice
                            )}
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Total{" "}
                            {formatMoney(
                              item.totalValue
                            )}
                          </p>
                        </td>

                        <td className="max-w-[280px] px-4 py-4">
                          <div className="flex items-start gap-2">
                            <MessageSquareText
                              size={
                                15
                              }
                              className="mt-0.5 shrink-0 text-slate-300"
                            />

                            <span className="line-clamp-2 text-xs leading-5 text-slate-600">
                              {
                                description
                              }
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={(
                              event
                            ) => {
                              event.stopPropagation();

                              setSelectedItem(
                                item
                              );
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                            title="Lihat detail"
                          >
                            <Eye
                              size={
                                16
                              }
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )}
            </tbody>
          </table>
        </div>

      </section>

      {/* =====================================================
       * DETAIL MODAL
       * ===================================================== */}

      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedItem(
                null
              );
            }
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/50 bg-white shadow-2xl">
            {/* HEADER */}

            <div className="relative border-b border-slate-100 bg-slate-50/80 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#29483A] text-white">
                    <FileText
                      size={20}
                    />
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Detail StockCard
                    </p>

                    <h3 className="mt-0.5 text-lg font-bold text-slate-800">
                      {selectedItem.reference ||
                        selectedItem.trxNumber ||
                        "Transaksi"}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedItem(
                      null
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 hover:text-slate-700"
                  title="Tutup detail"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* BODY */}

            <div className="overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailItem
                  icon={
                    <Activity
                      size={
                        16
                      }
                    />
                  }
                  label="Jenis Transaksi"
                >
                  <TypeBadge
                    item={
                      selectedItem
                    }
                  />
                </DetailItem>

                <DetailItem
                  icon={
                    <Hash
                      size={
                        16
                      }
                    />
                  }
                  label="Referensi"
                >
                  <span className="font-semibold text-slate-700">
                    {selectedItem.reference ||
                      selectedItem.trxNumber ||
                      selectedItem.nomor ||
                      "-"}
                  </span>
                </DetailItem>

                <DetailItem
                  icon={
                    <CalendarDays
                      size={
                        16
                      }
                    />
                  }
                  label="Tanggal Transaksi"
                >
                  <span className="font-semibold text-slate-700">
                    {formatDateTime(
                      selectedItem.trxDate ||
                        selectedItem.tanggal ||
                        selectedItem.createdAt
                    )}
                  </span>
                </DetailItem>

                <DetailItem
                  icon={
                    <Package
                      size={
                        16
                      }
                    />
                  }
                  label="Barang"
                >
                  <div>
                    <p className="font-semibold text-slate-700">
                      {selectedItem.kodeBarang ||
                        selectedItem.code ||
                        "-"}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {selectedItem.barang ||
                        selectedItem.namaBarang ||
                        "-"}
                    </p>
                  </div>
                </DetailItem>

                <DetailItem
                  icon={
                    <ArrowDownToLine
                      size={
                        16
                      }
                    />
                  }
                  label="Qty Masuk"
                >
                  <span className="font-bold text-emerald-600">
                    {formatQty(
                      selectedItem.qtyIn
                    )}{" "}
                    {selectedItem.satuan ||
                      ""}
                  </span>
                </DetailItem>

                <DetailItem
                  icon={
                    <ArrowUpFromLine
                      size={
                        16
                      }
                    />
                  }
                  label="Qty Keluar"
                >
                  <span className="font-bold text-red-600">
                    {formatQty(
                      selectedItem.qtyOut
                    )}{" "}
                    {selectedItem.satuan ||
                      ""}
                  </span>
                </DetailItem>

                <DetailItem
                  icon={
                    <Activity
                      size={
                        16
                      }
                    />
                  }
                  label="Balance Setelah Transaksi"
                >
                  <span className="font-bold text-slate-700">
                    {formatQty(
                      selectedItem.balance
                    )}{" "}
                    {selectedItem.satuan ||
                      ""}
                  </span>
                </DetailItem>

                <DetailItem
                  icon={
                    <Package
                      size={
                        16
                      }
                    />
                  }
                  label="Warehouse"
                >
                  <span className="font-semibold text-slate-700">
                    {selectedItem.warehouse ||
                      "MAIN"}
                  </span>
                </DetailItem>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailItem
                  icon={
                    <Activity
                      size={
                        16
                      }
                    />
                  }
                  label="Harga Satuan"
                >
                  <span className="font-semibold text-slate-700">
                    {formatMoney(
                      selectedItem.unitPrice
                    )}
                  </span>
                </DetailItem>

                <DetailItem
                  icon={
                    <Activity
                      size={
                        16
                      }
                    />
                  }
                  label="Total Nilai"
                >
                  <span className="font-semibold text-slate-700">
                    {formatMoney(
                      selectedItem.totalValue
                    )}
                  </span>
                </DetailItem>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <MessageSquareText
                    size={15}
                    className="text-emerald-600"
                  />

                  Keterangan
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {selectedItem.description ||
                    selectedItem.note ||
                    "Tidak ada keterangan."}
                </p>
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <CheckCircle2
                      size={17}
                    />
                  </div>

                  <div>
                    <p className="text-xs font-bold text-emerald-800">
                      StockCard tercatat
                    </p>

                    <p className="mt-1 text-xs leading-5 text-emerald-700/80">
                      Data ini berasal
                      dari riwayat
                      pergerakan stock
                      pusat warehouse
                      MAIN dan tidak
                      mengubah data
                      ketika detail
                      dibuka.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  System Information
                </p>

                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      StockCard ID
                    </p>

                    <p className="mt-1 text-xs font-semibold text-slate-700">
                      {String(
                        selectedItem.id
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Reference ID
                    </p>

                    <p className="mt-1 text-xs font-semibold text-slate-700">
                      {selectedItem.referenceId ??
                        "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER */}

            <div className="flex justify-end border-t border-slate-100 bg-slate-50/70 px-6 py-4">
              <button
                type="button"
                onClick={() =>
                  setSelectedItem(
                    null
                  )
                }
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#29483A] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#20392F]"
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

/* =========================================================
 * TYPE BADGE
 * ========================================================= */

function TypeBadge({
  item,
}: {
  item: HistoryItem;
}) {
  const style =
    getTypeStyle(item);

  const Icon = style.icon;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold ${style.className}`}
    >
      <Icon size={12} />
      {style.label}
    </span>
  );
}

/* =========================================================
 * SUMMARY CARD
 * ========================================================= */

function SummaryCard({
  label,
  value,
  description,
  icon: Icon,
  iconClass,
  valueClass,
}: {
  label: string;
  value: number;
  description: string;
  icon: React.ElementType;
  iconClass: string;
  valueClass: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </p>

          <p
            className={`mt-1 text-2xl font-bold tracking-tight ${valueClass}`}
          >
            {value.toLocaleString(
              "id-ID",
              {
                maximumFractionDigits: 4,
              }
            )}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Icon size={21} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />

        {description}
      </div>
    </div>
  );
}

/* =========================================================
 * TABLE HEADER
 * ========================================================= */

function TableHeader({
  label,
  align = "left",
}: {
  label: string;
  align?:
    | "left"
    | "center"
    | "right";
}) {
  const alignmentClass =
    align === "center"
      ? "text-center"
      : align === "right"
        ? "text-right"
        : "text-left";

  return (
    <th
      className={`whitespace-nowrap px-4 py-3 ${alignmentClass} text-[11px] font-bold uppercase tracking-wider text-slate-500`}
    >
      {label}
    </th>
  );
}

/* =========================================================
 * SORTABLE HEADER
 * ========================================================= */

function SortableHeader({
  label,
  onClick,
  icon,
  align = "left",
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  align?:
    | "left"
    | "center"
    | "right";
}) {
  const alignmentClass =
    align === "center"
      ? "text-center"
      : align === "right"
        ? "text-right"
        : "text-left";

  const justifyClass =
    align === "right"
      ? "justify-end"
      : align === "center"
        ? "justify-center"
        : "justify-start";

  return (
    <th
      className={`whitespace-nowrap px-4 py-3 ${alignmentClass}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 ${justifyClass} text-[11px] font-bold uppercase tracking-wider text-slate-500 transition hover:text-emerald-700`}
      >
        {label}
        {icon}
      </button>
    </th>
  );
}

/* =========================================================
 * DETAIL ITEM
 * ========================================================= */

function DetailItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </div>

      <div className="mt-2">
        {children}
      </div>
    </div>
  );
}