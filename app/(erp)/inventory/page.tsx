"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Package,
  Percent,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Warehouse,
  X,
} from "lucide-react";

/* =========================================================
 * TYPES
 * ========================================================= */

type Transaction = {
  id?: string | number;

  date?: string;
  createdAt?: string;
  trxDate?: string;

  direction?: string;
  type?: string;
  transactionType?: string;

  reference?: string;
  referenceNo?: string;
  number?: string;

  note?: string;
  description?: string;

  qty?: number | string;
  quantity?: number | string;

  amount?: number | string;

  unitCost?: number | string;
  cost?: number | string;
  harga?: number | string;
  price?: number | string;
  totalCost?: number | string;
  transactionCost?: number | string;

  source?: string;
};

type MonthlyRow = {
  id?: string | number;

  code?: string;
  name?: string;
  barcode?: string;

  barang?: any;

  unit?: string;
  baseUnit?: string;
  warehouse?: string;

  stockAwal?: number | string;
  openingStock?: number | string;

  barangMasuk?: number | string;
  stockIn?: number | string;
  masuk?: number | string;

  barangKeluar?: number | string;
  stockOut?: number | string;
  keluar?: number | string;

  stockAkhir?: number | string;
  endingStock?: number | string;
  stock?: number | string;

  harga?: number | string;
  price?: number | string;
  averageCost?: number | string;
  cost?: number | string;

  previousCost?: number | string;
  previousAverageCost?: number | string;

  costPercentage?: number | string;
  costPercent?: number | string;

  barangMasukCost?: number | string;
  stockInCost?: number | string;
  incomingCost?: number | string;
  purchaseCost?: number | string;
  totalPurchaseCost?: number | string;

  barangKeluarCost?: number | string;
  stockOutCost?: number | string;
  outgoingCost?: number | string;
  issueCost?: number | string;
  totalOutgoingCost?: number | string;

  stockValue?: number | string;
  endingStockValue?: number | string;
  inventoryValue?: number | string;

  minimumStock?: number | string;
  minStock?: number | string;

  status?: string;

  stockAwalSource?: any;
  openingStockSource?: any;

  transactions?: Transaction[];
  inventoryTransactions?: Transaction[];
};

type ApiResponse = {
  success?: boolean;

  data?: MonthlyRow[];
  rows?: MonthlyRow[];

  summary?: {
    totalItem?: number;
    totalStockAwal?: number;
    totalBarangMasuk?: number;
    totalBarangKeluar?: number;

    totalStockAkhir?: number;

    totalCost?: number;

    totalPurchaseCost?: number;
    totalIncomingCost?: number;
    totalOutgoingCost?: number;
    totalStockValue?: number;
  };

  period?: {
    dateFrom?: string;
    dateTo?: string;
    month?: string;
    label?: string;
  };

  message?: string;
};

/* =========================================================
 * TRANSACTION HISTORY FILTER
 * ========================================================= */

// Hanya barang Pusat yang memiliki transaksi sejak awal periode ini
// yang boleh tampil di daftar Mutasi Stock.
const TRANSACTION_HISTORY_START_DATE = "2026-08-01";

/* =========================================================
 * HELPERS
 * ========================================================= */

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(
  value: unknown,
  maximumFractionDigits = 2
) {
  return toNumber(value).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

function formatCurrency(value: unknown) {
  return toNumber(value).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(dateValue?: string | Date | null) {
  if (!dateValue) return "-";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateValue?: string | Date | null) {
  if (!dateValue) return "-";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCurrentMonthValue() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
}

function getMonthRange(monthValue: string) {
  const [yearString, monthString] =
    monthValue.split("-");

  const year = Number(yearString);
  const month = Number(monthString);

  if (!year || !month) {
    const now = new Date();

    return {
      dateFrom: `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-01`,

      dateTo: `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")}`,
    };
  }

  const lastDay = new Date(year, month, 0);
  const now = new Date();

  const isCurrentMonth =
    year === now.getFullYear() &&
    month === now.getMonth() + 1;

  const endDay = isCurrentMonth
    ? now.getDate()
    : lastDay.getDate();

  return {
    dateFrom: `${year}-${String(month).padStart(
      2,
      "0"
    )}-01`,

    dateTo: `${year}-${String(month).padStart(
      2,
      "0"
    )}-${String(endDay).padStart(2, "0")}`,
  };
}

function getMonthLabel(monthValue: string) {
  const [yearString, monthString] =
    monthValue.split("-");

  const year = Number(yearString);
  const month = Number(monthString);

  if (!year || !month) return "-";

  return new Date(
    year,
    month - 1,
    1
  ).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function getPreviousMonthValue(monthValue: string) {
  const [yearString, monthString] =
    monthValue.split("-");

  const year = Number(yearString);
  const month = Number(monthString);

  if (!year || !month) {
    return "";
  }

  const date = new Date(
    year,
    month - 2,
    1
  );

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function getValue(
  row: MonthlyRow,
  keys: string[]
) {
  for (const key of keys) {
    const value = (row as any)[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return toNumber(value);
    }
  }

  return 0;
}

function getRowCode(row: MonthlyRow) {
  return String(
    row.code ??
      row.barang?.code ??
      "-"
  );
}

function getRowName(row: MonthlyRow) {
  return String(
    row.name ??
      row.barang?.name ??
      "-"
  );
}

function getRowUnit(row: MonthlyRow) {
  return String(
    row.baseUnit ??
      row.barang?.baseUnit ??
      row.unit ??
      row.barang?.unit ??
      "-"
  );
}

function getRowMinStock(row: MonthlyRow) {
  return getValue(row, [
    "minimumStock",
    "minStock",
  ]);
}

function getRowOpening(row: MonthlyRow) {
  return getValue(row, [
    "stockAwal",
    "openingStock",
  ]);
}

function getRowIn(row: MonthlyRow) {
  return getValue(row, [
    "barangMasuk",
    "stockIn",
    "masuk",
  ]);
}

function getRowOut(row: MonthlyRow) {
  return getValue(row, [
    "barangKeluar",
    "stockOut",
    "keluar",
  ]);
}

function getRowEnding(row: MonthlyRow) {
  return getValue(row, [
    "stockAkhir",
    "endingStock",
    "stock",
  ]);
}

function getRowCost(row: MonthlyRow) {
  return getValue(row, [
    "cost",
    "averageCost",
    "price",
    "harga",
  ]);
}

function getRowPreviousCost(row: MonthlyRow) {
  return getValue(row, [
    "previousCost",
    "previousAverageCost",
  ]);
}

function getRowCostPercentage(row: MonthlyRow) {
  const explicit = getValue(row, [
    "costPercentage",
    "costPercent",
  ]);

  if (explicit !== 0) {
    return explicit;
  }

  const current = getRowCost(row);
  const previous = getRowPreviousCost(row);

  return getPercentageChange(
    current,
    previous
  );
}

function getTransactions(
  row: MonthlyRow
): Transaction[] {
  if (Array.isArray(row.transactions)) {
    return row.transactions;
  }

  if (
    Array.isArray(row.inventoryTransactions)
  ) {
    return row.inventoryTransactions;
  }

  return [];
}

/* =========================================================
 * COST HELPERS
 * ========================================================= */

function getRowIncomingCost(
  row: MonthlyRow
) {
  const direct = getValue(row, [
    "barangMasukCost",
    "stockInCost",
    "incomingCost",
    "purchaseCost",
    "totalPurchaseCost",
  ]);

  if (direct !== 0) {
    return direct;
  }

  const transactions =
    getTransactions(row);

  if (transactions.length > 0) {
    let transactionTotal = 0;

    for (const transaction of transactions) {
      const direction =
        getTransactionDirection(
          transaction
        );

      if (direction !== "IN") {
        continue;
      }

      const explicitCost =
        getTransactionCost(
          transaction
        );

      if (explicitCost !== 0) {
        transactionTotal +=
          explicitCost;

        continue;
      }

      const qty =
        getTransactionQty(
          transaction
        );

      const transactionUnitCost =
        getTransactionUnitCost(
          transaction
        );

      transactionTotal +=
        qty * transactionUnitCost;
    }

    if (transactionTotal !== 0) {
      return transactionTotal;
    }
  }

  return (
    getRowIn(row) *
    getRowCost(row)
  );
}

function getRowOutgoingCost(
  row: MonthlyRow
) {
  const direct = getValue(row, [
    "barangKeluarCost",
    "stockOutCost",
    "outgoingCost",
    "issueCost",
    "totalOutgoingCost",
  ]);

  if (direct !== 0) {
    return direct;
  }

  const transactions =
    getTransactions(row);

  if (transactions.length > 0) {
    let transactionTotal = 0;

    for (const transaction of transactions) {
      const direction =
        getTransactionDirection(
          transaction
        );

      if (direction !== "OUT") {
        continue;
      }

      const explicitCost =
        getTransactionCost(
          transaction
        );

      if (explicitCost !== 0) {
        transactionTotal +=
          explicitCost;

        continue;
      }

      const qty =
        getTransactionQty(
          transaction
        );

      const transactionUnitCost =
        getTransactionUnitCost(
          transaction
        );

      transactionTotal +=
        qty * transactionUnitCost;
    }

    if (transactionTotal !== 0) {
      return transactionTotal;
    }
  }

  return (
    getRowOut(row) *
    getRowCost(row)
  );
}

function getRowEndingValue(
  row: MonthlyRow
) {
  const direct = getValue(row, [
    "endingStockValue",
    "stockValue",
    "inventoryValue",
  ]);

  if (direct !== 0) {
    return direct;
  }

  return (
    getRowEnding(row) *
    getRowCost(row)
  );
}

function getTransactionCost(
  transaction: Transaction
) {
  return toNumber(
    transaction.totalCost ??
      transaction.transactionCost ??
      transaction.amount
  );
}

function getTransactionUnitCost(
  transaction: Transaction
) {
  return toNumber(
    transaction.unitCost ??
      transaction.cost ??
      transaction.harga ??
      transaction.price
  );
}

function getPercentageChange(
  current: number,
  previous: number
) {
  if (
    previous === 0 &&
    current === 0
  ) {
    return 0;
  }

  if (previous === 0) {
    return current > 0
      ? 100
      : 0;
  }

  return (
    ((current - previous) /
      Math.abs(previous)) *
    100
  );
}

function getTransactionDirection(
  transaction: Transaction
) {
  const raw = String(
    transaction.direction ??
      transaction.type ??
      transaction.transactionType ??
      ""
  ).toUpperCase();

  if (
    raw.includes("IN") ||
    raw.includes("MASUK") ||
    raw.includes("RECEIPT") ||
    raw.includes("RECEIVE") ||
    raw.includes("PURCHASE") ||
    raw.includes("TRANSFER_IN")
  ) {
    return "IN";
  }

  if (
    raw.includes("OUT") ||
    raw.includes("KELUAR") ||
    raw.includes("ISSUE") ||
    raw.includes("DELIVERY") ||
    raw.includes("TRANSFER_OUT") ||
    raw.includes("WASTE")
  ) {
    return "OUT";
  }

  return raw;
}

function getTransactionQty(
  transaction: Transaction
) {
  return toNumber(
    transaction.qty ??
      transaction.quantity
  );
}

function getTransactionDate(
  transaction: Transaction
) {
  return (
    transaction.date ??
    transaction.trxDate ??
    transaction.createdAt
  );
}

/* =========================================================
 * COMPONENT
 * ========================================================= */

export default function InventoryPage() {
  const [data, setData] =
    useState<MonthlyRow[]>([]);

  const [
    previousMonthData,
    setPreviousMonthData,
  ] = useState<MonthlyRow[]>([]);

  const [
    transactionHistoryData,
    setTransactionHistoryData,
  ] = useState<MonthlyRow[]>([]);

  const [selectedMonth, setSelectedMonth] =
    useState(
      getCurrentMonthValue()
    );

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [
    directionFilter,
    setDirectionFilter,
  ] = useState("ALL");

  const [loading, setLoading] =
    useState(false);

  const [
    loadingPrevious,
    setLoadingPrevious,
  ] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [selectedRow, setSelectedRow] =
    useState<MonthlyRow | null>(null);

  const [
    summaryFromApi,
    setSummaryFromApi,
  ] = useState<
    ApiResponse["summary"] | null
  >(null);

  const [
    periodFromApi,
    setPeriodFromApi,
  ] = useState<
    ApiResponse["period"] | null
  >(null);

  const [
    previousSummaryFromApi,
    setPreviousSummaryFromApi,
  ] = useState<
    ApiResponse["summary"] | null
  >(null);

  const monthRange = useMemo(
    () =>
      getMonthRange(
        selectedMonth
      ),
    [selectedMonth]
  );

  const monthLabel = useMemo(
    () =>
      getMonthLabel(
        selectedMonth
      ),
    [selectedMonth]
  );

  const previousMonthValue =
    useMemo(
      () =>
        getPreviousMonthValue(
          selectedMonth
        ),
      [selectedMonth]
    );

  const previousMonthLabel =
    useMemo(
      () =>
        getMonthLabel(
          previousMonthValue
        ),
      [previousMonthValue]
    );

  /* =======================================================
   * LOAD CURRENT + PREVIOUS MONTH
   * ======================================================= */

  async function loadData() {
    try {
      setLoading(true);
      setLoadingPrevious(true);
      setErrorMessage("");

      const currentParams =
        new URLSearchParams({
          dateFrom:
            monthRange.dateFrom,
          dateTo:
            monthRange.dateTo,
        });

      const previousRange =
        getMonthRange(
          previousMonthValue
        );

      const previousParams =
        new URLSearchParams({
          dateFrom:
            previousRange.dateFrom,
          dateTo:
            previousRange.dateTo,
        });

      // Data history dipakai HANYA untuk menentukan barang mana yang
      // memang pernah mempunyai transaksi. Perhitungan laporan bulan
      // berjalan tetap memakai currentParams seperti sebelumnya.
      const historyParams =
        new URLSearchParams({
          dateFrom:
            TRANSACTION_HISTORY_START_DATE,
          dateTo:
            monthRange.dateTo,
        });

      const [
        currentResponse,
        previousResponse,
        historyResponse,
      ] = await Promise.all([
        fetch(
          `/api/mutasi-stock?${currentParams.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          }
        ),

        fetch(
          `/api/mutasi-stock?${previousParams.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          }
        ),

        fetch(
          `/api/mutasi-stock?${historyParams.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          }
        ),
      ]);

      const currentResult: ApiResponse =
        await currentResponse
          .json()
          .catch(() => ({}));

      const previousResult: ApiResponse =
        await previousResponse
          .json()
          .catch(() => ({}));

      const historyResult: ApiResponse =
        await historyResponse
          .json()
          .catch(() => ({}));

      if (
        !currentResponse.ok ||
        currentResult.success === false
      ) {
        throw new Error(
          currentResult.message ||
            `Gagal mengambil data transaksi (${currentResponse.status})`
        );
      }

      const currentRows =
        Array.isArray(
          currentResult.data
        )
          ? currentResult.data
          : Array.isArray(
              currentResult.rows
            )
          ? currentResult.rows
          : [];

      const previousRows =
        Array.isArray(
          previousResult.data
        )
          ? previousResult.data
          : Array.isArray(
              previousResult.rows
            )
          ? previousResult.rows
          : [];

      if (
        !historyResponse.ok ||
        historyResult.success === false
      ) {
        throw new Error(
          historyResult.message ||
            `Gagal mengambil riwayat transaksi (${historyResponse.status})`
        );
      }

      const historyRows =
        Array.isArray(
          historyResult.data
        )
          ? historyResult.data
          : Array.isArray(
              historyResult.rows
            )
          ? historyResult.rows
          : [];

      setData(currentRows);

      setPreviousMonthData(
        previousRows
      );

      setTransactionHistoryData(
        historyRows
      );

      setSummaryFromApi(
        currentResult.summary ??
          null
      );

      setPeriodFromApi(
        currentResult.period ??
          null
      );

      setPreviousSummaryFromApi(
        previousResult.summary ??
          null
      );
    } catch (error) {
      console.error(
        "LOAD MUTASI STOCK ERROR:",
        error
      );

      setData([]);
      setPreviousMonthData([]);
      setTransactionHistoryData([]);

      setSummaryFromApi(null);
      setPreviousSummaryFromApi(null);
      setPeriodFromApi(null);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal mengambil data transaksi stock."
      );
    } finally {
      setLoading(false);
      setLoadingPrevious(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  /* =======================================================
   * ITEM SCOPE
   *
   * Jangan tampilkan seluruh master Barang Pusat.
   * Hanya barang yang memiliki transaksi IN/OUT sejak
   * 1 Agustus 2026 sampai akhir periode yang dipilih.
   *
   * Data current month tetap dipakai untuk angka laporan,
   * sedangkan transactionHistoryData hanya dipakai untuk
   * menentukan daftar barang yang eligible.
   * ======================================================= */

  const transactionItemCodes =
    useMemo(() => {
      const codes = new Set<string>();

      for (const row of transactionHistoryData) {
        const code = getRowCode(row);

        if (!code || code === "-") {
          continue;
        }

        const transactions = getTransactions(row);
        const hasTransactionDetail =
          transactions.some((transaction) => {
            const direction =
              getTransactionDirection(transaction);

            return (
              direction === "IN" ||
              direction === "OUT"
            );
          });

        const hasAggregatedTransaction =
          getRowIn(row) !== 0 ||
          getRowOut(row) !== 0;

        if (
          hasTransactionDetail ||
          hasAggregatedTransaction
        ) {
          codes.add(code);
        }
      }

      return codes;
    }, [transactionHistoryData]);

  const transactionRows =
    useMemo(() => {
      return data.filter((row) =>
        transactionItemCodes.has(
          getRowCode(row)
        )
      );
    }, [data, transactionItemCodes]);

  /* =======================================================
   * PREVIOUS MONTH MAP
   *
   * Dipetakan berdasarkan CODE supaya:
   * current item A dibandingkan
   * dengan item A bulan sebelumnya.
   * ======================================================= */

  const previousRowMap =
    useMemo(() => {
      const map =
        new Map<string, MonthlyRow>();

      for (const row of previousMonthData) {
        const code =
          getRowCode(row);

        if (
          code &&
          code !== "-"
        ) {
          map.set(
            code,
            row
          );
        }
      }

      return map;
    }, [previousMonthData]);

  function getPreviousRow(
    row: MonthlyRow
  ) {
    return previousRowMap.get(
      getRowCode(row)
    );
  }

  function getCurrentIncomingCost(
    row: MonthlyRow
  ) {
    return getRowIncomingCost(row);
  }

  function getCurrentOutgoingCost(
    row: MonthlyRow
  ) {
    return getRowOutgoingCost(row);
  }

  function getPreviousIncomingCost(
    row: MonthlyRow
  ) {
    const previous =
      getPreviousRow(row);

    if (!previous) {
      return 0;
    }

    return getRowIncomingCost(
      previous
    );
  }

  function getPreviousOutgoingCost(
    row: MonthlyRow
  ) {
    const previous =
      getPreviousRow(row);

    if (!previous) {
      return 0;
    }

    return getRowOutgoingCost(
      previous
    );
  }

  function getItemCostPercentage(
    row: MonthlyRow
  ) {
    const current =
      getRowCost(row);

    const previousRow =
      getPreviousRow(row);

    const previous =
      previousRow
        ? getRowCost(
            previousRow
          )
        : getRowPreviousCost(
            row
          );

    return getPercentageChange(
      current,
      previous
    );
  }

  function getIncomingCostPercentage(
    row: MonthlyRow
  ) {
    const current =
      getCurrentIncomingCost(
        row
      );

    const previous =
      getPreviousIncomingCost(
        row
      );

    return getPercentageChange(
      current,
      previous
    );
  }

  function getOutgoingCostPercentage(
    row: MonthlyRow
  ) {
    const current =
      getCurrentOutgoingCost(
        row
      );

    const previous =
      getPreviousOutgoingCost(
        row
      );

    return getPercentageChange(
      current,
      previous
    );
  }

  /* =======================================================
   * FILTER
   * ======================================================= */

  const filteredData =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return transactionRows.filter(
        (row) => {
          const name =
            getRowName(row)
              .toLowerCase();

          const code =
            getRowCode(row)
              .toLowerCase();

          const matchesSearch =
            !keyword ||
            name.includes(
              keyword
            ) ||
            code.includes(
              keyword
            );

          const ending =
            getRowEnding(row);

          const minimum =
            getRowMinStock(row);

          const isLow =
            ending <= minimum;

          const matchesStatus =
            statusFilter ===
              "ALL" ||
            (statusFilter ===
              "LOW" &&
              isLow) ||
            (statusFilter ===
              "SAFE" &&
              !isLow);

          const masuk =
            getRowIn(row);

          const keluar =
            getRowOut(row);

          const matchesDirection =
            directionFilter ===
              "ALL" ||
            (directionFilter ===
              "IN" &&
              masuk > 0) ||
            (directionFilter ===
              "OUT" &&
              keluar > 0) ||
            (directionFilter ===
              "BOTH" &&
              masuk > 0 &&
              keluar > 0);

          return (
            matchesSearch &&
            matchesStatus &&
            matchesDirection
          );
        }
      );
    }, [
      transactionRows,
      search,
      statusFilter,
      directionFilter,
    ]);

  /* =======================================================
   * CURRENT SUMMARY
   * ======================================================= */

  const summary =
    useMemo(() => {
      const totalItem =
        transactionRows.length;

      const totalStockAwal =
        transactionRows.reduce(
          (sum, row) =>
            sum +
            getRowOpening(row),
          0
        );

      const totalMasuk =
        transactionRows.reduce(
          (sum, row) =>
            sum +
            getRowIn(row),
          0
        );

      const totalKeluar =
        transactionRows.reduce(
          (sum, row) =>
            sum +
            getRowOut(row),
          0
        );

      const totalStockAkhir =
        transactionRows.reduce(
          (sum, row) =>
            sum +
            getRowEnding(row),
          0
        );

      const totalLow =
        transactionRows.filter(
          (row) =>
            getRowEnding(row) <=
            getRowMinStock(row)
        ).length;

      const totalSafe =
        transactionRows.filter(
          (row) =>
            getRowEnding(row) >
            getRowMinStock(row)
        ).length;

      const totalPurchaseCost =
        transactionRows.reduce(
          (sum, row) =>
            sum +
            getRowIncomingCost(
              row
            ),
          0
        );

      const totalOutgoingCost =
        transactionRows.reduce(
          (sum, row) =>
            sum +
            getRowOutgoingCost(
              row
            ),
          0
        );

      const totalStockValue =
        transactionRows.reduce(
          (sum, row) =>
            sum +
            getRowEndingValue(
              row
            ),
          0
        );

      return {
        totalItem,
        totalStockAwal,
        totalMasuk,
        totalKeluar,
        totalStockAkhir,
        totalLow,
        totalSafe,
        totalPurchaseCost,
        totalOutgoingCost,
        totalStockValue,
        totalCost:
          totalStockValue,
      };
    }, [
      transactionRows,
    ]);

  /* =======================================================
   * PREVIOUS MONTH SUMMARY
   * ======================================================= */

  const previousSummary =
    useMemo(() => {
      const totalPurchaseCost =
        previousMonthData.reduce(
          (sum, row) =>
            sum +
            getRowIncomingCost(
              row
            ),
          0
        );

      const totalOutgoingCost =
        previousMonthData.reduce(
          (sum, row) =>
            sum +
            getRowOutgoingCost(
              row
            ),
          0
        );

      const totalStockValue =
        previousMonthData.reduce(
          (sum, row) =>
            sum +
            getRowEndingValue(
              row
            ),
          0
        );

      const totalStockAkhir =
        previousMonthData.reduce(
          (sum, row) =>
            sum +
            getRowEnding(row),
          0
        );

      return {
        totalPurchaseCost,
        totalOutgoingCost,
        totalStockValue,
        totalStockAkhir,
      };
    }, [
      previousMonthData,
    ]);

  /* =======================================================
   * COST ANALYSIS
   * ======================================================= */

  const costAnalysis =
    useMemo(() => {
      const purchaseCurrent =
        summary.totalPurchaseCost;

      const purchasePrevious =
        previousSummaryFromApi
          ?.totalPurchaseCost ??
        previousSummaryFromApi
          ?.totalIncomingCost ??
        previousSummary.totalPurchaseCost;

      const outgoingCurrent =
        summary.totalOutgoingCost;

      const outgoingPrevious =
        previousSummaryFromApi
          ?.totalOutgoingCost ??
        previousSummary.outgoingCost ??
        previousSummary.totalOutgoingCost;

      const purchaseDifference =
        purchaseCurrent -
        purchasePrevious;

      const outgoingDifference =
        outgoingCurrent -
        outgoingPrevious;

      const purchasePercentage =
        getPercentageChange(
          purchaseCurrent,
          purchasePrevious
        );

      const outgoingPercentage =
        getPercentageChange(
          outgoingCurrent,
          outgoingPrevious
        );

      return {
        purchaseCurrent,
        purchasePrevious,
        purchaseDifference,
        purchasePercentage,

        outgoingCurrent,
        outgoingPrevious,
        outgoingDifference,
        outgoingPercentage,
      };
    }, [
      summary,
      previousSummary,
      previousSummaryFromApi,
    ]);

  const purchaseIsOver =
    costAnalysis.purchaseCurrent >
    costAnalysis.purchasePrevious;

  const outgoingIsOver =
    costAnalysis.outgoingCurrent >
    costAnalysis.outgoingPrevious;

  const isCurrentMonth =
    selectedMonth ===
    getCurrentMonthValue();

  const effectiveDateFrom =
    periodFromApi?.dateFrom ??
    monthRange.dateFrom;

  const effectiveDateTo =
    periodFromApi?.dateTo ??
    monthRange.dateTo;

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setDirectionFilter("ALL");
  };

  const hasFilter =
    Boolean(search) ||
    statusFilter !== "ALL" ||
    directionFilter !== "ALL";

  /* =======================================================
   * RENDER
   * ======================================================= */

  return (
    <div className="min-h-full bg-[#F6F9F7] px-4 py-5 text-[#17352D] transition-colors dark:bg-[#0B1411] dark:text-[#E7F0EC] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px]">

        {/* =================================================
         * HERO
         * ================================================= */}

        <div className="relative mb-6 overflow-hidden rounded-[28px] border border-[#DCE9E3] bg-white shadow-[0_12px_40px_rgba(31,73,61,0.07)] dark:border-[#243B33] dark:bg-[#111D19] dark:shadow-[0_12px_40px_rgba(0,0,0,0.25)]">

          <div className="absolute inset-0 bg-gradient-to-br from-[#F1F8F4] via-white to-[#F8FBF9] dark:from-[#14251F] dark:via-[#111D19] dark:to-[#0F1915]" />

          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#DCEEE6]/50 blur-3xl dark:bg-[#2C5A4A]/20" />

          <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-[#EEF7F2] blur-3xl dark:bg-[#1D4034]/20" />

          <div className="relative flex flex-col gap-5 p-6 sm:p-7 xl:flex-row xl:items-center xl:justify-between">

            <div className="flex items-start gap-4">

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#173F34] text-white shadow-lg shadow-[#173F34]/15">
                <Boxes
                  size={26}
                  strokeWidth={2}
                />
              </div>

              <div>

                <div className="mb-1.5 flex flex-wrap items-center gap-2">

                  <span className="rounded-full bg-[#E8F3EE] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#497F70] dark:bg-[#203C32] dark:text-[#8EC2B1]">
                    Mutasi Stock
                  </span>

                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Central / Pusat
                  </span>

                  {isCurrentMonth && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                      BULAN BERJALAN
                    </span>
                  )}

                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[#17352D] dark:text-[#E7F0EC] sm:text-3xl">
                  Transaksi Stock Pusat
                </h1>

                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
                  Pantau stock awal,
                  barang masuk,
                  barang keluar,
                  stock akhir,
                  cost setiap item,
                  serta perbandingan
                  cost dengan bulan
                  sebelumnya.
                </p>

              </div>

            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

              <div className="rounded-2xl border border-[#DCE9E3] bg-white/90 px-4 py-3 shadow-sm dark:border-[#29443A] dark:bg-[#15231E]">

                <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                  <CalendarDays size={13} />
                  Periode
                </div>

                <div className="text-sm font-bold capitalize text-[#17352D] dark:text-[#E7F0EC]">
                  {monthLabel}
                </div>

                <div className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                  {formatDate(
                    effectiveDateFrom
                  )}
                  {" — "}
                  {formatDate(
                    effectiveDateTo
                  )}
                </div>

              </div>

              <button
                type="button"
                onClick={loadData}
                disabled={
                  loading ||
                  loadingPrevious
                }
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#D9E6E0] bg-white px-4 text-sm font-semibold text-[#31584C] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#BFD5CC] hover:bg-[#F8FBF9] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#29443A] dark:bg-[#15231E] dark:text-[#9BC7B7] dark:hover:border-[#386052] dark:hover:bg-[#1A2D26]"
              >
                <RefreshCw
                  size={16}
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

          </div>
        </div>

        {/* =================================================
         * MONTH SELECTOR
         * ================================================= */}

        <div className="mb-6 rounded-[22px] border border-[#DDE9E4] bg-white p-4 shadow-[0_8px_30px_rgba(31,73,61,0.045)] dark:border-[#243B33] dark:bg-[#111D19] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] sm:p-5">

          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">

            <div>

              <div className="flex items-center gap-2">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70] dark:bg-[#203C32] dark:text-[#8EC2B1]">
                  <CalendarDays size={18} />
                </div>

                <div>

                  <p className="text-sm font-bold text-[#17352D] dark:text-[#E7F0EC]">
                    Pilih Bulan Transaksi
                  </p>

                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Stock awal mengambil
                    SO APPROVED sebelum
                    periode.
                  </p>

                </div>

              </div>

            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">

              <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                Bulan
              </label>

              <input
                type="month"
                value={selectedMonth}
                onChange={(event) =>
                  setSelectedMonth(
                    event.target.value
                  )
                }
                className="h-11 rounded-xl border border-[#DDE9E4] bg-white px-3 text-sm font-semibold text-[#17352D] outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10 dark:border-[#29443A] dark:bg-[#15231E] dark:text-[#E7F0EC]"
              />

              <button
                type="button"
                onClick={() =>
                  setSelectedMonth(
                    getCurrentMonthValue()
                  )
                }
                className={`h-11 rounded-xl px-4 text-xs font-bold transition ${
                  isCurrentMonth
                    ? "bg-[#315F51] text-white"
                    : "border border-[#DDE9E4] bg-white text-[#497F70] hover:bg-[#F5F9F7] dark:border-[#29443A] dark:bg-[#15231E] dark:text-[#9BC7B7] dark:hover:bg-[#1A2D26]"
                }`}
              >
                Bulan Berjalan
              </button>

            </div>

          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">

            <div className="rounded-xl border border-[#E3ECE7] bg-[#F8FBF9] px-4 py-3 dark:border-[#29443A] dark:bg-[#15231E]">

              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                Stock Awal
              </p>

              <p className="mt-1 text-xs font-semibold text-[#31584C] dark:text-[#9BC7B7]">
                SO APPROVED sebelum{" "}
                {monthLabel}
              </p>

              <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                {previousMonthLabel}
              </p>

            </div>

            <div className="rounded-xl border border-[#E3ECE7] bg-[#F8FBF9] px-4 py-3 dark:border-[#29443A] dark:bg-[#15231E]">

              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                Pembelian & Pengeluaran
              </p>

              <p className="mt-1 text-xs font-semibold text-[#31584C] dark:text-[#9BC7B7]">
                Hanya {monthLabel}
              </p>

              <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                Dibandingkan otomatis
                dengan{" "}
                {previousMonthLabel}.
              </p>

            </div>

            <div className="rounded-xl border border-[#E3ECE7] bg-[#F8FBF9] px-4 py-3 dark:border-[#29443A] dark:bg-[#15231E]">

              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                Stock Akhir
              </p>

              <p className="mt-1 text-xs font-semibold text-[#31584C] dark:text-[#9BC7B7]">
                {isCurrentMonth
                  ? "Stock terakhir saat ini"
                  : `Stock terakhir ${monthLabel}`}
              </p>

              <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                Sampai{" "}
                {formatDate(
                  effectiveDateTo
                )}
              </p>

            </div>

          </div>
        </div>

        {/* =================================================
         * ERROR
         * ================================================= */}

        {errorMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">

            <AlertTriangle
              size={19}
              className="mt-0.5 shrink-0"
            />

            <div className="flex-1">

              <p className="text-sm font-bold">
                Gagal mengambil data
              </p>

              <p className="mt-0.5 text-xs">
                {errorMessage}
              </p>

            </div>

            <button
              type="button"
              onClick={loadData}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-[#241513] dark:text-red-300 dark:hover:bg-red-950/50"
            >
              Coba Lagi
            </button>

          </div>
        )}

        {/* =================================================
         * STOCK SUMMARY
         * ================================================= */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_6px_24px_rgba(31,73,61,0.045)] dark:border-[#243B33] dark:bg-[#111D19] dark:shadow-[0_6px_24px_rgba(0,0,0,0.2)]">

            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#EDF6F1] dark:bg-[#203C32]/60" />

            <div className="relative flex items-start justify-between">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                  Item Stock
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-[#17352D] dark:text-[#E7F0EC]">
                  {(
                    summaryFromApi?.totalItem ??
                    summary.totalItem
                  ).toLocaleString(
                    "id-ID"
                  )}
                </p>

                <p className="mt-2 text-xs text-[#497F70] dark:text-[#8EC2B1]">
                  Periode {monthLabel}
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70] dark:bg-[#203C32] dark:text-[#8EC2B1]">
                <Package size={21} />
              </div>

            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_6px_24px_rgba(31,73,61,0.045)] dark:border-[#243B33] dark:bg-[#111D19]">

            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#EEF7F2] dark:bg-[#203C32]/60" />

            <div className="relative flex items-start justify-between">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                  Stock Awal
                </p>

                <p className="mt-2 text-2xl font-bold tracking-tight text-[#17352D] dark:text-[#E7F0EC]">
                  {formatNumber(
                    summaryFromApi?.totalStockAwal ??
                      summary.totalStockAwal
                  )}
                </p>

                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  SO APPROVED{" "}
                  {previousMonthLabel}
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70] dark:bg-[#203C32] dark:text-[#8EC2B1]">
                <Warehouse size={21} />
              </div>

            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_6px_24px_rgba(31,73,61,0.045)] dark:border-[#243B33] dark:bg-[#111D19]">

            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-50 dark:bg-emerald-950/30" />

            <div className="relative flex items-start justify-between">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                  Barang Masuk
                </p>

                <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  +
                  {formatNumber(
                    summaryFromApi?.totalBarangMasuk ??
                      summary.totalMasuk
                  )}
                </p>

                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  Hanya transaksi{" "}
                  {monthLabel}
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                <ArrowDownToLine size={21} />
              </div>

            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_6px_24px_rgba(31,73,61,0.045)] dark:border-[#243B33] dark:bg-[#111D19]">

            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-red-50 dark:bg-red-950/30" />

            <div className="relative flex items-start justify-between">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                  Barang Keluar
                </p>

                <p className="mt-2 text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">
                  -
                  {formatNumber(
                    summaryFromApi?.totalBarangKeluar ??
                      summary.totalKeluar
                  )}
                </p>

                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  Hanya transaksi{" "}
                  {monthLabel}
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
                <ArrowUpFromLine size={21} />
              </div>

            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[#BFD9CF] bg-[#173F34] p-5 shadow-[0_10px_30px_rgba(31,73,61,0.12)]">

            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10" />

            <div className="relative flex items-start justify-between">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
                  Stock Akhir
                </p>

                <p className="mt-2 text-2xl font-bold tracking-tight text-white">
                  {formatNumber(
                    summaryFromApi?.totalStockAkhir ??
                      summary.totalStockAkhir
                  )}
                </p>

                <p className="mt-2 text-xs text-white/55">
                  {isCurrentMonth
                    ? "Stock terakhir saat ini"
                    : `Sampai ${formatDate(
                        effectiveDateTo
                      )}`}
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white">
                <Boxes size={21} />
              </div>

            </div>
          </div>

        </div>

        {/* =================================================
         * COST ANALYSIS
         * ================================================= */}

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* PURCHASE */}

          <div className="relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_8px_28px_rgba(31,73,61,0.05)] dark:border-[#243B33] dark:bg-[#111D19]">

            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-50 dark:bg-emerald-950/30" />

            <div className="relative">

              <div className="flex items-start justify-between">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                  <CircleDollarSign size={21} />
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    purchaseIsOver
                      ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                      : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                  }`}
                >
                  {purchaseIsOver
                    ? "OVER"
                    : "NORMAL"}
                </span>

              </div>

              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                Cost Barang Masuk
              </p>

              <p className="mt-1 text-2xl font-bold text-[#17352D] dark:text-[#E7F0EC]">
                {formatCurrency(
                  costAnalysis.purchaseCurrent
                )}
              </p>

              <div className="mt-3 flex items-center justify-between gap-3">

                <div>

                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    {previousMonthLabel}
                  </p>

                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {formatCurrency(
                      costAnalysis.purchasePrevious
                    )}
                  </p>

                </div>

                <div className="text-right">

                  <p
                    className={`inline-flex items-center gap-1 text-xs font-bold ${
                      costAnalysis.purchasePercentage >
                      0
                        ? "text-red-600 dark:text-red-400"
                        : costAnalysis.purchasePercentage <
                          0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-500"
                    }`}
                  >
                    {costAnalysis.purchasePercentage >
                    0 ? (
                      <TrendingUp size={13} />
                    ) : costAnalysis.purchasePercentage <
                      0 ? (
                      <TrendingDown size={13} />
                    ) : null}

                    {costAnalysis.purchasePercentage >
                    0
                      ? "+"
                      : ""}
                    {formatNumber(
                      costAnalysis.purchasePercentage,
                      2
                    )}
                    %
                  </p>

                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    perubahan
                  </p>

                </div>

              </div>

              <div className="mt-3 rounded-xl bg-[#F7FAF8] px-3 py-2 dark:bg-[#182720]">

                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  Selisih
                </p>

                <p
                  className={`text-xs font-bold ${
                    costAnalysis.purchaseDifference >
                    0
                      ? "text-red-600 dark:text-red-400"
                      : costAnalysis.purchaseDifference <
                        0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-gray-500"
                  }`}
                >
                  {costAnalysis.purchaseDifference >
                  0
                    ? "+"
                    : ""}
                  {formatCurrency(
                    costAnalysis.purchaseDifference
                  )}
                </p>

              </div>

            </div>
          </div>

          {/* OUTGOING */}

          <div className="relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_8px_28px_rgba(31,73,61,0.05)] dark:border-[#243B33] dark:bg-[#111D19]">

            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-red-50 dark:bg-red-950/30" />

            <div className="relative">

              <div className="flex items-start justify-between">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
                  <CircleDollarSign size={21} />
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    outgoingIsOver
                      ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                      : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                  }`}
                >
                  {outgoingIsOver
                    ? "OVER"
                    : "NORMAL"}
                </span>

              </div>

              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                Cost Barang Keluar
              </p>

              <p className="mt-1 text-2xl font-bold text-[#17352D] dark:text-[#E7F0EC]">
                {formatCurrency(
                  costAnalysis.outgoingCurrent
                )}
              </p>

              <div className="mt-3 flex items-center justify-between gap-3">

                <div>

                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    {previousMonthLabel}
                  </p>

                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {formatCurrency(
                      costAnalysis.outgoingPrevious
                    )}
                  </p>

                </div>

                <div className="text-right">

                  <p
                    className={`inline-flex items-center gap-1 text-xs font-bold ${
                      costAnalysis.outgoingPercentage >
                      0
                        ? "text-red-600 dark:text-red-400"
                        : costAnalysis.outgoingPercentage <
                          0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-500"
                    }`}
                  >
                    {costAnalysis.outgoingPercentage >
                    0 ? (
                      <TrendingUp size={13} />
                    ) : costAnalysis.outgoingPercentage <
                      0 ? (
                      <TrendingDown size={13} />
                    ) : null}

                    {costAnalysis.outgoingPercentage >
                    0
                      ? "+"
                      : ""}
                    {formatNumber(
                      costAnalysis.outgoingPercentage,
                      2
                    )}
                    %
                  </p>

                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    perubahan
                  </p>

                </div>

              </div>

              <div className="mt-3 rounded-xl bg-[#F7FAF8] px-3 py-2 dark:bg-[#182720]">

                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  Selisih
                </p>

                <p
                  className={`text-xs font-bold ${
                    costAnalysis.outgoingDifference >
                    0
                      ? "text-red-600 dark:text-red-400"
                      : costAnalysis.outgoingDifference <
                        0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-gray-500"
                  }`}
                >
                  {costAnalysis.outgoingDifference >
                  0
                    ? "+"
                    : ""}
                  {formatCurrency(
                    costAnalysis.outgoingDifference
                  )}
                </p>

              </div>

            </div>
          </div>

          {/* STOCK VALUE */}

          <div className="relative overflow-hidden rounded-2xl border border-[#BFD9CF] bg-[#173F34] p-5 shadow-[0_10px_30px_rgba(31,73,61,0.12)]">

            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />

            <div className="relative">

              <div className="flex items-start justify-between">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white">
                  <Boxes size={21} />
                </div>

                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/75">
                  STOCK VALUE
                </span>

              </div>

              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
                Nilai Stock Akhir
              </p>

              <p className="mt-1 text-2xl font-bold text-white">
                {formatCurrency(
                  summary.totalStockValue
                )}
              </p>

              <p className="mt-3 text-[10px] leading-5 text-white/55">
                Stock akhir × cost
                masing-masing item
                pada periode ini.
              </p>

              <div className="mt-3 rounded-xl bg-white/10 px-3 py-2">

                <p className="text-[10px] text-white/45">
                  Periode pembanding
                </p>

                <p className="text-xs font-bold text-white">
                  {previousMonthLabel}
                </p>

              </div>

            </div>
          </div>

        </div>

        {/* =================================================
         * TABLE
         * ================================================= */}

        <div className="overflow-hidden rounded-[24px] border border-[#DDE9E4] bg-white shadow-[0_10px_35px_rgba(31,73,61,0.055)] dark:border-[#243B33] dark:bg-[#111D19] dark:shadow-[0_10px_35px_rgba(0,0,0,0.25)]">

          {/* TABLE HEADER */}

          <div className="border-b border-[#E7EFEB] px-5 py-5 dark:border-[#263D35] sm:px-6">

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173F34] text-white shadow-sm">
                  <FileText size={19} />
                </div>

                <div>

                  <div className="flex items-center gap-2">

                    <h2 className="font-bold text-[#17352D] dark:text-[#E7F0EC]">
                      Mutasi Stock{" "}
                      {monthLabel}
                    </h2>

                    <span className="rounded-full bg-[#F0F5F2] px-2 py-0.5 text-[10px] font-bold text-[#497F70] dark:bg-[#203C32] dark:text-[#9BC7B7]">
                      {filteredData.length}
                    </span>

                  </div>

                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    Hanya barang yang memiliki transaksi sejak
                    {" "}
                    {formatDate(
                      TRANSACTION_HISTORY_START_DATE
                    )}
                    . Stock awal → masuk → keluar → stock akhir
                    → cost → perbandingan bulan sebelumnya.
                  </p>

                </div>

              </div>

              <div className="flex flex-wrap items-center gap-2">

                <div className="flex items-center gap-1.5 rounded-lg border border-[#DDE9E4] bg-[#F8FBF9] px-2.5 py-1.5 text-[10px] font-semibold text-gray-500 dark:border-[#29443A] dark:bg-[#15231E] dark:text-gray-400">

                  <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />

                  {formatDate(
                    effectiveDateFrom
                  )}
                  {" — "}
                  {formatDate(
                    effectiveDateTo
                  )}

                </div>

                <div className="flex items-center gap-1.5 rounded-lg border border-[#DDE9E4] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-gray-500 dark:border-[#29443A] dark:bg-[#15231E] dark:text-gray-400">

                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                  CENTRAL

                </div>

              </div>

            </div>
          </div>

          {/* FILTER */}

          <div className="border-b border-[#E7EFEB] bg-[#FAFCFB] px-5 py-4 dark:border-[#263D35] dark:bg-[#0F1915] sm:px-6">

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">

              <div className="relative flex-1">

                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  placeholder="Cari kode atau nama barang..."
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-[#DDE9E4] bg-white pl-10 pr-10 text-sm text-[#17352D] outline-none transition-all placeholder:text-gray-400 focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10 dark:border-[#29443A] dark:bg-[#15231E] dark:text-[#E7F0EC]"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-[#20352D]"
                  >
                    <X size={15} />
                  </button>
                )}

              </div>

              {/* STATUS */}

              <div className="flex gap-2">

                {[
                  {
                    value: "ALL",
                    label: "Semua",
                    count:
                      transactionRows.length,
                  },
                  {
                    value: "SAFE",
                    label: "Aman",
                    count:
                      summary.totalSafe,
                  },
                  {
                    value: "LOW",
                    label: "Menipis",
                    count:
                      summary.totalLow,
                  },
                ].map(
                  (option) => {
                    const active =
                      statusFilter ===
                      option.value;

                    return (
                      <button
                        key={
                          option.value
                        }
                        type="button"
                        onClick={() =>
                          setStatusFilter(
                            option.value
                          )
                        }
                        className={`inline-flex h-11 items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition-all ${
                          active
                            ? "border-[#315F51] bg-[#315F51] text-white shadow-sm"
                            : "border-[#DDE9E4] bg-white text-[#526D64] hover:border-[#BFD4CC] hover:bg-[#F7FAF8] dark:border-[#29443A] dark:bg-[#15231E] dark:text-[#9BC7B7] dark:hover:bg-[#1A2D26]"
                        }`}
                      >
                        {
                          option.label
                        }

                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                            active
                              ? "bg-white/15 text-white"
                              : "bg-[#F1F5F3] text-gray-500 dark:bg-[#20352D] dark:text-gray-400"
                          }`}
                        >
                          {
                            option.count
                          }
                        </span>
                      </button>
                    );
                  }
                )}

              </div>

              {/* DIRECTION */}

              <div className="relative">

                <select
                  value={
                    directionFilter
                  }
                  onChange={(event) =>
                    setDirectionFilter(
                      event.target.value
                    )
                  }
                  className="h-11 appearance-none rounded-xl border border-[#DDE9E4] bg-white pl-3.5 pr-9 text-xs font-semibold text-[#526D64] outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10 dark:border-[#29443A] dark:bg-[#15231E] dark:text-[#9BC7B7]"
                >
                  <option value="ALL">
                    Semua Mutasi
                  </option>

                  <option value="IN">
                    Ada Barang Masuk
                  </option>

                  <option value="OUT">
                    Ada Barang Keluar
                  </option>

                  <option value="BOTH">
                    Masuk & Keluar
                  </option>
                </select>

                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

              </div>

            </div>
          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">

            <table className="w-full min-w-[2050px]">

              <thead>

                <tr className="border-b border-[#E4ECE8] bg-[#F7F9F8] dark:border-[#293F37] dark:bg-[#16231F]">

                  {[
                    ["No", "center"],
                    ["Kode", "left"],
                    ["Nama Barang", "left"],
                    ["Satuan", "center"],
                    ["Stock Awal", "right"],
                    ["Barang Masuk", "right"],
                    ["Barang Keluar", "right"],
                    ["Stock Akhir", "right"],
                    ["Harga / Cost", "right"],
                    ["Cost %", "right"],
                    ["Nilai Masuk", "right"],
                    ["Masuk %", "right"],
                    ["Nilai Keluar", "right"],
                    ["Keluar %", "right"],
                    ["Status", "center"],
                    ["Detail", "center"],
                  ].map(
                    ([label, align]) => (
                      <th
                        key={label}
                        className={`px-4 py-3.5 text-${align} text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500`}
                      >
                        {label}
                      </th>
                    )
                  )}

                </tr>

              </thead>

              <tbody>

                {loading ? (
                  <tr>

                    <td
                      colSpan={16}
                      className="px-4 py-16 text-center"
                    >

                      <div className="flex flex-col items-center">

                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70] dark:bg-[#203C32] dark:text-[#9BC7B7]">
                          <RefreshCw
                            size={22}
                            className="animate-spin"
                          />
                        </div>

                        <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-300">
                          Memuat transaksi
                          stock...
                        </p>

                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          Mengambil{" "}
                          {monthLabel}
                          {" dan "}
                          {previousMonthLabel}
                        </p>

                      </div>

                    </td>

                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>

                    <td
                      colSpan={16}
                      className="px-4 py-16 text-center"
                    >

                      <div className="flex flex-col items-center">

                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70] dark:bg-[#203C32] dark:text-[#9BC7B7]">
                          <Boxes size={26} />
                        </div>

                        <h3 className="mt-4 font-semibold text-gray-700 dark:text-gray-200">
                          Tidak ada data
                          stock
                        </h3>

                        <p className="mt-1 max-w-md text-sm text-gray-400 dark:text-gray-500">
                          Tidak ditemukan
                          barang yang
                          sesuai dengan
                          filter pada
                          periode{" "}
                          {monthLabel}.
                        </p>

                        {hasFilter && (
                          <button
                            type="button"
                            onClick={
                              resetFilters
                            }
                            className="mt-4 rounded-xl bg-[#173F34] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#255648]"
                          >
                            Reset Filter
                          </button>
                        )}

                      </div>

                    </td>

                  </tr>
                ) : (
                  filteredData.map(
                    (
                      row,
                      index
                    ) => {

                      const opening =
                        getRowOpening(
                          row
                        );

                      const masuk =
                        getRowIn(
                          row
                        );

                      const keluar =
                        getRowOut(
                          row
                        );

                      const ending =
                        getRowEnding(
                          row
                        );

                      const cost =
                        getRowCost(
                          row
                        );

                      const previousRow =
                        getPreviousRow(
                          row
                        );

                      const previousCost =
                        previousRow
                          ? getRowCost(
                              previousRow
                            )
                          : getRowPreviousCost(
                              row
                            );

                      const costPercentage =
                        getItemCostPercentage(
                          row
                        );

                      const incomingCost =
                        getCurrentIncomingCost(
                          row
                        );

                      const outgoingCost =
                        getCurrentOutgoingCost(
                          row
                        );

                      const previousIncomingCost =
                        getPreviousIncomingCost(
                          row
                        );

                      const previousOutgoingCost =
                        getPreviousOutgoingCost(
                          row
                        );

                      const incomingPercentage =
                        getIncomingCostPercentage(
                          row
                        );

                      const outgoingPercentage =
                        getOutgoingCostPercentage(
                          row
                        );

                      const minimum =
                        getRowMinStock(
                          row
                        );

                      const isLow =
                        ending <=
                        minimum;

                      const costUp =
                        costPercentage >
                        0;

                      const costDown =
                        costPercentage <
                        0;

                      const incomingUp =
                        incomingPercentage >
                        0;

                      const incomingDown =
                        incomingPercentage <
                        0;

                      const outgoingUp =
                        outgoingPercentage >
                        0;

                      const outgoingDown =
                        outgoingPercentage <
                        0;

                      return (
                        <tr
                          key={
                            row.id ??
                            `${getRowCode(
                              row
                            )}-${index}`
                          }
                          className="group border-b border-[#EEF2F0] transition-colors hover:bg-[#F8FBF9] dark:border-[#22372F] dark:hover:bg-[#16251F]"
                        >

                          {/* NO */}

                          <td className="px-4 py-4 text-center text-xs font-medium text-gray-400">
                            {index + 1}
                          </td>

                          {/* CODE */}

                          <td className="px-4 py-4">

                            <span className="rounded-lg bg-[#F1F6F3] px-2.5 py-1.5 font-mono text-xs font-semibold text-[#41675B] dark:bg-[#20352D] dark:text-[#9BC7B7]">
                              {getRowCode(
                                row
                              )}
                            </span>

                          </td>

                          {/* NAME */}

                          <td className="px-4 py-4">

                            <div className="flex items-center gap-3">

                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF5F1] text-[#497F70] transition group-hover:bg-[#E3F0EA] dark:bg-[#20352D] dark:text-[#9BC7B7] dark:group-hover:bg-[#29463B]">
                                <Package size={16} />
                              </div>

                              <div>

                                <p className="text-sm font-semibold text-[#1D3931] dark:text-[#E7F0EC]">
                                  {getRowName(
                                    row
                                  )}
                                </p>

                                {row.barcode && (
                                  <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                                    {
                                      row.barcode
                                    }
                                  </p>
                                )}

                              </div>

                            </div>

                          </td>

                          {/* UNIT */}

                          <td className="px-4 py-4 text-center">

                            <span className="rounded-lg bg-[#F7F9F8] px-2.5 py-1.5 text-xs font-semibold text-gray-600 dark:bg-[#1A2B25] dark:text-gray-300">
                              {getRowUnit(
                                row
                              )}
                            </span>

                          </td>

                          {/* OPENING */}

                          <td className="px-4 py-4 text-right">

                            <div>

                              <p className="text-sm font-bold text-[#17352D] dark:text-[#E7F0EC]">
                                {formatNumber(
                                  opening
                                )}
                              </p>

                              {row.stockAwalSource && (
                                <p className="mt-1 text-[9px] text-gray-400 dark:text-gray-500">
                                  SO Approved
                                </p>
                              )}

                            </div>

                          </td>

                          {/* IN */}

                          <td className="px-4 py-4 text-right">

                            {masuk > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm font-bold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                <ArrowDownToLine
                                  size={13}
                                />
                                +
                                {formatNumber(
                                  masuk
                                )}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-300 dark:text-gray-600">
                                0
                              </span>
                            )}

                          </td>

                          {/* OUT */}

                          <td className="px-4 py-4 text-right">

                            {keluar > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-sm font-bold text-red-600 dark:bg-red-950/30 dark:text-red-400">
                                <ArrowUpFromLine
                                  size={13}
                                />
                                -
                                {formatNumber(
                                  keluar
                                )}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-300 dark:text-gray-600">
                                0
                              </span>
                            )}

                          </td>

                          {/* ENDING */}

                          <td className="px-4 py-4 text-right">

                            <div className="inline-flex flex-col items-end">

                              <span
                                className={`text-base font-bold ${
                                  isLow
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-[#17352D] dark:text-[#E7F0EC]"
                                }`}
                              >
                                {formatNumber(
                                  ending
                                )}
                              </span>

                              <span className="mt-0.5 text-[9px] text-gray-400 dark:text-gray-500">
                                akhir periode
                              </span>

                            </div>

                          </td>

                          {/* COST */}

                          <td className="px-4 py-4 text-right">

                            <div>

                              <p className="text-sm font-bold text-[#31584C] dark:text-[#9BC7B7]">
                                {formatCurrency(
                                  cost
                                )}
                              </p>

                              <p className="mt-1 text-[9px] text-gray-400 dark:text-gray-500">
                                Sebelum:{" "}
                                {formatCurrency(
                                  previousCost
                                )}
                              </p>

                            </div>

                          </td>

                          {/* COST % */}

                          <td className="px-4 py-4 text-right">

                            {costPercentage ===
                            0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-[10px] font-bold text-gray-500 dark:bg-[#1A2924] dark:text-gray-400">
                                0%
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                  costUp
                                    ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                                    : costDown
                                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                                    : "bg-gray-50 text-gray-500 dark:bg-[#1A2924]"
                                }`}
                              >

                                {costUp ? (
                                  <TrendingUp
                                    size={11}
                                  />
                                ) : (
                                  <TrendingDown
                                    size={11}
                                  />
                                )}

                                {costUp
                                  ? "+"
                                  : ""}

                                {formatNumber(
                                  costPercentage,
                                  2
                                )}
                                %

                              </span>
                            )}

                          </td>

                          {/* INCOMING VALUE */}

                          <td className="px-4 py-4 text-right">

                            <div>

                              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(
                                  incomingCost
                                )}
                              </p>

                              <p className="mt-1 text-[9px] text-gray-400 dark:text-gray-500">
                                Sebelumnya:{" "}
                                {formatCurrency(
                                  previousIncomingCost
                                )}
                              </p>

                            </div>

                          </td>

                          {/* INCOMING % */}

                          <td className="px-4 py-4 text-right">

                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                incomingUp
                                  ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                                  : incomingDown
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                                  : "bg-gray-50 text-gray-500 dark:bg-[#1A2924] dark:text-gray-400"
                              }`}
                            >

                              {incomingUp ? (
                                <TrendingUp
                                  size={11}
                                />
                              ) : incomingDown ? (
                                <TrendingDown
                                  size={11}
                                />
                              ) : null}

                              {incomingUp
                                ? "+"
                                : ""}

                              {formatNumber(
                                incomingPercentage,
                                2
                              )}
                              %

                            </span>

                          </td>

                          {/* OUTGOING VALUE */}

                          <td className="px-4 py-4 text-right">

                            <div>

                              <p className="text-sm font-bold text-red-600 dark:text-red-400">
                                {formatCurrency(
                                  outgoingCost
                                )}
                              </p>

                              <p className="mt-1 text-[9px] text-gray-400 dark:text-gray-500">
                                Sebelumnya:{" "}
                                {formatCurrency(
                                  previousOutgoingCost
                                )}
                              </p>

                            </div>

                          </td>

                          {/* OUTGOING % */}

                          <td className="px-4 py-4 text-right">

                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                outgoingUp
                                  ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                                  : outgoingDown
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                                  : "bg-gray-50 text-gray-500 dark:bg-[#1A2924] dark:text-gray-400"
                              }`}
                            >

                              {outgoingUp ? (
                                <TrendingUp
                                  size={11}
                                />
                              ) : outgoingDown ? (
                                <TrendingDown
                                  size={11}
                                />
                              ) : null}

                              {outgoingUp
                                ? "+"
                                : ""}

                              {formatNumber(
                                outgoingPercentage,
                                2
                              )}
                              %

                            </span>

                          </td>

                          {/* STATUS */}

                          <td className="px-4 py-4 text-center">

                            {isLow ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-[10px] font-bold text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                                <AlertTriangle
                                  size={11}
                                />
                                Menipis
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
                                <CheckCircle2
                                  size={11}
                                />
                                Aman
                              </span>
                            )}

                          </td>

                          {/* DETAIL */}

                          <td className="px-4 py-4 text-center">

                            <button
                              type="button"
                              onClick={() =>
                                setSelectedRow(
                                  row
                                )
                              }
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DDE9E4] bg-white px-3 text-[10px] font-bold text-[#497F70] transition hover:border-[#BFD4CC] hover:bg-[#F5F9F7] dark:border-[#29443A] dark:bg-[#15231E] dark:text-[#9BC7B7] dark:hover:bg-[#1D322A]"
                            >
                              Detail
                              <ChevronRight
                                size={13}
                              />
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

          {/* FOOTER */}

          <div className="flex flex-col justify-between gap-3 border-t border-[#E6EEE9] bg-[#F8FAF9] px-5 py-4 dark:border-[#263D35] dark:bg-[#0F1915] sm:flex-row sm:items-center sm:px-6">

            <div className="text-xs text-gray-500 dark:text-gray-400">

              Menampilkan{" "}

              <span className="font-bold text-[#17352D] dark:text-[#E7F0EC]">
                {filteredData.length.toLocaleString(
                  "id-ID"
                )}
              </span>{" "}

              dari{" "}

              <span className="font-bold text-[#17352D] dark:text-[#E7F0EC]">
                {transactionRows.length.toLocaleString(
                  "id-ID"
                )}
              </span>{" "}

              item stock pada{" "}

              <span className="font-bold capitalize text-[#17352D] dark:text-[#E7F0EC]">
                {monthLabel}
              </span>

            </div>

            <div className="flex flex-wrap items-center gap-2">

              <div className="flex items-center gap-1.5 rounded-lg border border-[#DDE9E4] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-gray-500 dark:border-[#29443A] dark:bg-[#15231E] dark:text-gray-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Masuk
              </div>

              <div className="flex items-center gap-1.5 rounded-lg border border-[#F1DCDC] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-gray-500 dark:border-red-950/50 dark:bg-[#15231E] dark:text-gray-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Keluar
              </div>

              <div className="flex items-center gap-1.5 rounded-lg border border-[#DDE9E4] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-gray-500 dark:border-[#29443A] dark:bg-[#15231E] dark:text-gray-400">
                <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />
                Stock Akhir
              </div>

              <div className="flex items-center gap-1.5 rounded-lg border border-[#DDE9E4] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-gray-500 dark:border-[#29443A] dark:bg-[#15231E] dark:text-gray-400">
                <CircleDollarSign
                  size={11}
                  className="text-[#497F70]"
                />
                Cost
              </div>

            </div>

          </div>
        </div>
      </div>

      {/* =====================================================
       * DETAIL MODAL
       * ===================================================== */}

      {selectedRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#102B24]/40 p-4 backdrop-blur-sm dark:bg-black/65"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedRow(null);
            }
          }}
        >

          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[26px] border border-[#DDE9E4] bg-white shadow-[0_30px_100px_rgba(0,0,0,0.18)] dark:border-[#29443A] dark:bg-[#111D19] dark:shadow-[0_30px_100px_rgba(0,0,0,0.5)]">

            {/* HEADER */}

            <div className="border-b border-[#E6EEE9] bg-gradient-to-br from-[#F1F8F4] via-white to-[#F8FBF9] px-5 py-5 dark:border-[#293F37] dark:from-[#14251F] dark:via-[#111D19] dark:to-[#0F1915] sm:px-6">

              <div className="flex items-start justify-between gap-4">

                <div className="flex items-start gap-3">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#173F34] text-white">
                    <Package size={20} />
                  </div>

                  <div>

                    <div className="flex flex-wrap items-center gap-2">

                      <h3 className="text-lg font-bold text-[#17352D] dark:text-[#E7F0EC]">
                        {getRowName(
                          selectedRow
                        )}
                      </h3>

                      <span className="rounded-lg bg-[#EAF3EF] px-2 py-1 font-mono text-[10px] font-bold text-[#497F70] dark:bg-[#203C32] dark:text-[#9BC7B7]">
                        {getRowCode(
                          selectedRow
                        )}
                      </span>

                    </div>

                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      Detail transaksi{" "}
                      {monthLabel}
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedRow(
                      null
                    )
                  }
                  className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-[#20352D] dark:hover:text-gray-200"
                >
                  <X size={19} />
                </button>

              </div>

              {/* MODAL SUMMARY */}

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-8">

                <div className="rounded-xl border border-[#DDE9E4] bg-white p-3 dark:border-[#29443A] dark:bg-[#15231E]">

                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                    Stock Awal
                  </p>

                  <p className="mt-1 text-lg font-bold text-[#17352D] dark:text-[#E7F0EC]">
                    {formatNumber(
                      getRowOpening(
                        selectedRow
                      )
                    )}
                  </p>

                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">

                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-500 dark:text-emerald-400">
                    Masuk
                  </p>

                  <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    +
                    {formatNumber(
                      getRowIn(
                        selectedRow
                      )
                    )}
                  </p>

                </div>

                <div className="rounded-xl border border-red-100 bg-red-50/50 p-3 dark:border-red-900/40 dark:bg-red-950/20">

                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-red-500 dark:text-red-400">
                    Keluar
                  </p>

                  <p className="mt-1 text-lg font-bold text-red-600 dark:text-red-400">
                    -
                    {formatNumber(
                      getRowOut(
                        selectedRow
                      )
                    )}
                  </p>

                </div>

                <div className="rounded-xl border border-[#BFD9CF] bg-[#173F34] p-3">

                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/55">
                    Stock Akhir
                  </p>

                  <p className="mt-1 text-lg font-bold text-white">
                    {formatNumber(
                      getRowEnding(
                        selectedRow
                      )
                    )}
                  </p>

                </div>

                <div className="rounded-xl border border-[#DDE9E4] bg-white p-3 dark:border-[#29443A] dark:bg-[#15231E]">

                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                    Cost
                  </p>

                  <p className="mt-1 text-sm font-bold text-[#31584C] dark:text-[#9BC7B7]">
                    {formatCurrency(
                      getRowCost(
                        selectedRow
                      )
                    )}
                  </p>

                </div>

                <div className="rounded-xl border border-[#DDE9E4] bg-white p-3 dark:border-[#29443A] dark:bg-[#15231E]">

                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                    Cost %
                  </p>

                  <p
                    className={`mt-1 text-sm font-bold ${
                      getItemCostPercentage(
                        selectedRow
                      ) > 0
                        ? "text-red-600 dark:text-red-400"
                        : getItemCostPercentage(
                            selectedRow
                          ) < 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-500"
                    }`}
                  >
                    {getItemCostPercentage(
                      selectedRow
                    ) > 0
                      ? "+"
                      : ""}
                    {formatNumber(
                      getItemCostPercentage(
                        selectedRow
                      ),
                      2
                    )}
                    %
                  </p>

                </div>

                <div className="rounded-xl border border-emerald-100 bg-white p-3 dark:border-emerald-900/40 dark:bg-[#15231E]">

                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                    Nilai Masuk
                  </p>

                  <p className="mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(
                      getCurrentIncomingCost(
                        selectedRow
                      )
                    )}
                  </p>

                </div>

                <div className="rounded-xl border border-red-100 bg-white p-3 dark:border-red-900/40 dark:bg-[#15231E]">

                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                    Nilai Keluar
                  </p>

                  <p className="mt-1 text-sm font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(
                      getCurrentOutgoingCost(
                        selectedRow
                      )
                    )}
                  </p>

                </div>

              </div>
            </div>

            {/* BODY */}

            <div className="max-h-[55vh] overflow-y-auto p-5 dark:bg-[#111D19] sm:p-6">

              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <h4 className="text-sm font-bold text-[#17352D] dark:text-[#E7F0EC]">
                    Riwayat Transaksi
                  </h4>

                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    Transaksi yang masuk
                    dalam periode yang
                    dipilih.
                  </p>

                </div>

                <div className="flex flex-wrap items-center gap-2">

                  <span className="rounded-lg bg-[#F3F7F5] px-3 py-1.5 text-[10px] font-bold text-gray-500 dark:bg-[#1A2B25] dark:text-gray-400">
                    Satuan:{" "}
                    {getRowUnit(
                      selectedRow
                    )}
                  </span>

                  <span className="rounded-lg bg-[#F3F7F5] px-3 py-1.5 text-[10px] font-bold text-gray-500 dark:bg-[#1A2B25] dark:text-gray-400">
                    Cost:{" "}
                    {formatCurrency(
                      getRowCost(
                        selectedRow
                      )
                    )}
                  </span>

                </div>

              </div>

              {getTransactions(
                selectedRow
              ).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DDE9E4] bg-[#FAFCFB] px-5 py-12 text-center dark:border-[#29443A] dark:bg-[#15231E]">

                  <FileText
                    size={26}
                    className="mx-auto text-[#497F70] dark:text-[#8EC2B1]"
                  />

                  <p className="mt-3 text-sm font-semibold text-gray-600 dark:text-gray-300">
                    Detail transaksi
                    tidak tersedia
                  </p>

                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    API memberikan
                    rekap periode untuk
                    item ini, tetapi
                    tidak mengirim daftar
                    detail transaksinya.
                  </p>

                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[#E1EAE6] dark:border-[#29443A]">

                  <div className="overflow-x-auto">

                    <table className="w-full min-w-[1000px]">

                      <thead>

                        <tr className="border-b border-[#E4ECE8] bg-[#F7F9F8] dark:border-[#293F37] dark:bg-[#16231F]">

                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                            Tanggal
                          </th>

                          <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                            Arah
                          </th>

                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                            Referensi
                          </th>

                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                            Keterangan
                          </th>

                          <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                            Qty
                          </th>

                          <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                            Cost
                          </th>

                          <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                            Nilai
                          </th>

                        </tr>

                      </thead>

                      <tbody>

                        {getTransactions(
                          selectedRow
                        ).map(
                          (
                            transaction,
                            index
                          ) => {

                            const direction =
                              getTransactionDirection(
                                transaction
                              );

                            const quantity =
                              getTransactionQty(
                                transaction
                              );

                            const transactionUnitCost =
                              getTransactionUnitCost(
                                transaction
                              ) ||
                              getRowCost(
                                selectedRow
                              );

                            const explicitTransactionCost =
                              getTransactionCost(
                                transaction
                              );

                            const transactionValue =
                              explicitTransactionCost !==
                              0
                                ? explicitTransactionCost
                                : quantity *
                                  transactionUnitCost;

                            const reference =
                              transaction.reference ??
                              transaction.referenceNo ??
                              transaction.number ??
                              "-";

                            const description =
                              transaction.note ??
                              transaction.description ??
                              transaction.type ??
                              "-";

                            return (
                              <tr
                                key={
                                  transaction.id ??
                                  `${reference}-${index}`
                                }
                                className="border-b border-[#EEF2F0] last:border-b-0 hover:bg-[#FAFCFB] dark:border-[#22372F] dark:hover:bg-[#16251F]"
                              >

                                <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-gray-300">
                                  {formatDateTime(
                                    getTransactionDate(
                                      transaction
                                    )
                                  )}
                                </td>

                                <td className="px-4 py-3.5 text-center">

                                  {direction ===
                                  "IN" ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                      <ArrowDownToLine
                                        size={11}
                                      />
                                      MASUK
                                    </span>
                                  ) : direction ===
                                    "OUT" ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-600 dark:bg-red-950/30 dark:text-red-400">
                                      <ArrowUpFromLine
                                        size={11}
                                      />
                                      KELUAR
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[10px] font-bold text-gray-500 dark:bg-[#1A2924] dark:text-gray-400">
                                      {direction ||
                                        "TRANSAKSI"}
                                    </span>
                                  )}

                                </td>

                                <td className="px-4 py-3.5">

                                  <span className="rounded-lg bg-[#F2F6F4] px-2 py-1 font-mono text-[10px] font-semibold text-[#497F70] dark:bg-[#20352D] dark:text-[#9BC7B7]">
                                    {reference}
                                  </span>

                                </td>

                                <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-gray-300">
                                  {description}
                                </td>

                                <td className="px-4 py-3.5 text-right">

                                  <span
                                    className={`text-sm font-bold ${
                                      direction ===
                                      "IN"
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : direction ===
                                          "OUT"
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-gray-600 dark:text-gray-300"
                                    }`}
                                  >
                                    {direction ===
                                    "IN"
                                      ? "+"
                                      : direction ===
                                        "OUT"
                                      ? "-"
                                      : ""}

                                    {formatNumber(
                                      quantity
                                    )}
                                  </span>

                                </td>

                                <td className="px-4 py-3.5 text-right">

                                  <span className="text-xs font-semibold text-[#31584C] dark:text-[#9BC7B7]">
                                    {formatCurrency(
                                      transactionUnitCost
                                    )}
                                  </span>

                                </td>

                                <td className="px-4 py-3.5 text-right">

                                  <span
                                    className={`text-sm font-bold ${
                                      direction ===
                                      "IN"
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : direction ===
                                          "OUT"
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-gray-600 dark:text-gray-300"
                                    }`}
                                  >
                                    {formatCurrency(
                                      transactionValue
                                    )}
                                  </span>

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

              {/* =================================================
               * STOCK / COST COMPARISON
               * ================================================= */}

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">

                <div className="rounded-xl border border-[#DDE9E4] bg-[#F8FBF9] p-4 dark:border-[#29443A] dark:bg-[#15231E]">

                  <div className="flex items-center gap-2">

                    <Warehouse
                      size={15}
                      className="text-[#497F70] dark:text-[#8EC2B1]"
                    />

                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                      Sumber Stock Awal
                    </p>

                  </div>

                  <p className="mt-2 text-xs font-semibold text-[#31584C] dark:text-[#9BC7B7]">
                    {selectedRow.stockAwalSource
                      ? "Stock Opname APPROVED"
                      : "Stock Opname / saldo periode sebelumnya"}
                  </p>

                  {selectedRow.stockAwalSource && (
                    <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                      {formatDate(
                        selectedRow
                          .stockAwalSource
                          ?.approvedAt ??
                          selectedRow
                            .stockAwalSource
                            ?.date ??
                          selectedRow
                            .stockAwalSource
                            ?.createdAt
                      )}
                    </p>
                  )}

                </div>

                <div className="rounded-xl border border-[#DDE9E4] bg-[#F8FBF9] p-4 dark:border-[#29443A] dark:bg-[#15231E]">

                  <div className="flex items-center gap-2">

                    <CircleDollarSign
                      size={15}
                      className="text-[#497F70] dark:text-[#8EC2B1]"
                    />

                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                      Cost Item
                    </p>

                  </div>

                  <div className="mt-2">

                    <p className="text-lg font-bold text-[#31584C] dark:text-[#9BC7B7]">
                      {formatCurrency(
                        getRowCost(
                          selectedRow
                        )
                      )}
                    </p>

                    <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                      Sebelum:{" "}
                      {formatCurrency(
                        previousRow
                          ? getRowCost(
                              previousRow
                            )
                          : getRowPreviousCost(
                              selectedRow
                            )
                      )}
                    </p>

                  </div>

                </div>

                <div className="rounded-xl border border-[#DDE9E4] bg-[#F8FBF9] p-4 dark:border-[#29443A] dark:bg-[#15231E]">

                  <div className="flex items-center gap-2">

                    <Percent
                      size={15}
                      className="text-[#497F70] dark:text-[#8EC2B1]"
                    />

                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                      Cost Item %
                    </p>

                  </div>

                  <div className="mt-2 flex items-center gap-2">

                    {getItemCostPercentage(
                      selectedRow
                    ) > 0 ? (
                      <TrendingUp
                        size={16}
                        className="text-red-600 dark:text-red-400"
                      />
                    ) : getItemCostPercentage(
                        selectedRow
                      ) < 0 ? (
                      <TrendingDown
                        size={16}
                        className="text-emerald-600 dark:text-emerald-400"
                      />
                    ) : null}

                    <span
                      className={`text-lg font-bold ${
                        getItemCostPercentage(
                          selectedRow
                        ) > 0
                          ? "text-red-600 dark:text-red-400"
                          : getItemCostPercentage(
                              selectedRow
                            ) < 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-gray-500"
                      }`}
                    >
                      {getItemCostPercentage(
                        selectedRow
                      ) > 0
                        ? "+"
                        : ""}
                      {formatNumber(
                        getItemCostPercentage(
                          selectedRow
                        ),
                        2
                      )}
                      %
                    </span>

                  </div>

                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">

                  <div className="flex items-center gap-2">

                    <ArrowDownToLine
                      size={15}
                      className="text-emerald-600 dark:text-emerald-400"
                    />

                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                      Cost Masuk %
                    </p>

                  </div>

                  <div className="mt-2">

                    <p
                      className={`text-lg font-bold ${
                        getIncomingCostPercentage(
                          selectedRow
                        ) > 0
                          ? "text-red-600 dark:text-red-400"
                          : getIncomingCostPercentage(
                              selectedRow
                            ) < 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-gray-500"
                      }`}
                    >
                      {getIncomingCostPercentage(
                        selectedRow
                      ) > 0
                        ? "+"
                        : ""}
                      {formatNumber(
                        getIncomingCostPercentage(
                          selectedRow
                        ),
                        2
                      )}
                      %
                    </p>

                    <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                      Dibanding{" "}
                      {previousMonthLabel}
                    </p>

                  </div>

                </div>

                <div className="rounded-xl border border-red-100 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-950/20">

                  <div className="flex items-center gap-2">

                    <ArrowUpFromLine
                      size={15}
                      className="text-red-600 dark:text-red-400"
                    />

                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                      Cost Keluar %
                    </p>

                  </div>

                  <div className="mt-2">

                    <p
                      className={`text-lg font-bold ${
                        getOutgoingCostPercentage(
                          selectedRow
                        ) > 0
                          ? "text-red-600 dark:text-red-400"
                          : getOutgoingCostPercentage(
                              selectedRow
                            ) < 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-gray-500"
                      }`}
                    >
                      {getOutgoingCostPercentage(
                        selectedRow
                      ) > 0
                        ? "+"
                        : ""}
                      {formatNumber(
                        getOutgoingCostPercentage(
                          selectedRow
                        ),
                        2
                      )}
                      %
                    </p>

                    <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                      Dibanding{" "}
                      {previousMonthLabel}
                    </p>

                  </div>

                </div>

              </div>

            </div>

            {/* FOOTER */}

            <div className="flex items-center justify-between gap-3 border-t border-[#E6EEE9] bg-[#F8FAF9] px-5 py-4 dark:border-[#293F37] dark:bg-[#0F1915] sm:px-6">

              <div className="text-[10px] text-gray-400 dark:text-gray-500">
                Periode{" "}
                {formatDate(
                  effectiveDateFrom
                )}
                {" — "}
                {formatDate(
                  effectiveDateTo
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedRow(
                    null
                  )
                }
                className="rounded-xl bg-[#173F34] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#255648]"
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