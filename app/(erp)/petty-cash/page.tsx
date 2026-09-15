"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleX,
  Clock3,
  CreditCard,
  FileDown,
  Landmark,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Truck,
  Wallet,
  X,
} from "lucide-react";

/*
===========================================================
TYPES
===========================================================
*/

type Role =
  | "ADMIN"
  | "MANAGER"
  | "OUTLET_ADMIN"
  | "ADMIN_OUTLET"
  | string;

type PettyCashType = "IN" | "OUT";

type PettyCashStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | string;

interface UserData {
  id: number;
  fullname: string;
  role: Role;
  active: boolean;
  outletId: number | null;

  outlet?: {
    id: number;
    code: string;
    name: string;
  } | null;
}

interface Outlet {
  id: number;
  code: string;
  name: string;
  active: boolean;
}

interface PettyCashAccount {
  id: number;
  code: string;
  name: string;
  outletId: number | null;

  openingBalance: number | string;
  currentBalance: number | string;

  balance?: number | string;
  saldo?: number | string;

  isActive: boolean;

  outlet?: {
    id: number;
    code: string;
    name: string;
    active?: boolean;
  } | null;
}

interface OutletBalance {
  outletId: number | null;

  outletCode: string;
  outletName: string;

  openingBalance: number;
  balance: number;
  saldo: number;
  currentBalance: number;

  accountCount: number;
  accountId: number | null;
}

interface PettyCashTransaction {
  id: number;
  number: string;

  /*
  IMPORTANT:
  Tanggal transaksi yang dipilih user.
  BUKAN createdAt.
  */
  trxDate: string;

  type: PettyCashType;

  category: string;
  description: string | null;

  amount: number | string;

  balanceBefore: number | string;
  balanceAfter: number | string;

  accountId: number;

  paymentId: number | null;
  outletId: number | null;

  createdBy: number;

  status: PettyCashStatus;

  referenceNumber?: string | null;

  outlet?: {
    id: number;
    code: string;
    name: string;
  } | null;

  account?: {
    id: number;
    code: string;
    name: string;

    outletId: number | null;

    openingBalance: number | string;
    currentBalance: number | string;

    isActive: boolean;

    outlet?: {
      id: number;
      code: string;
      name: string;
    } | null;
  } | null;
}

interface PettyCashResponse {
  success: boolean;

  data: PettyCashTransaction[];

  accounts: PettyCashAccount[];

  outlets: Outlet[];

  outletBalances: OutletBalance[];

  summary: {
    totalIn: number;
    totalOut: number;
    currentBalance: number;
    totalOutletBalance: number;
    pusatBalance: number;
  };
}

/*
===========================================================
HELPERS
===========================================================
*/

function formatRupiah(
  value: number | string | null | undefined
) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return Math.round(number).toLocaleString("id-ID");
}

function formatRupiahSigned(
  value: number | string | null | undefined
) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return "Rp 0";
  }

  const rounded = Math.round(number);

  if (rounded < 0) {
    return `-Rp ${Math.abs(rounded).toLocaleString("id-ID")}`;
  }

  return `Rp ${rounded.toLocaleString("id-ID")}`;
}

function parseRupiah(value: string) {
  const raw = value.replace(/\D/g, "");

  if (!raw) {
    return 0;
  }

  const number = Number(raw);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
}

/*
===========================================================
DATE

Untuk response API DateTime ISO, kita tetap menggunakan
tanggal transaksi dari trxDate.

Frontend TIDAK PERNAH menggunakan createdAt.
===========================================================
*/

function formatDateOnly(
  value: string | Date | null | undefined
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(
  value: string | Date | null | undefined
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

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

function getTodayInput() {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isMoneyIn(type: string) {
  return type === "IN";
}

function isCentralRole(role?: string) {
  return (
    role === "ADMIN" ||
    role === "MANAGER"
  );
}

function isOutletRole(role?: string) {
  return (
    role === "OUTLET_ADMIN" ||
    role === "ADMIN_OUTLET"
  );
}

/*
===========================================================
STATUS BADGE
===========================================================
*/

function StatusBadge({
  status,
}: {
  status: PettyCashStatus;
}) {
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-bold tracking-wide text-emerald-700">
        <Check size={10} />
        APPROVED
      </span>
    );
  }

  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[9px] font-bold tracking-wide text-sky-700">
        <Clock3 size={10} />
        PENDING
      </span>
    );
  }

  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[9px] font-bold tracking-wide text-red-700">
        <CircleX size={10} />
        REJECTED
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-bold text-slate-600">
      {status}
    </span>
  );
}

/*
===========================================================
PAGE
===========================================================
*/

export default function PettyCashPage() {
  /*
  =========================================================
  USER
  =========================================================
  */

  const [user, setUser] =
    useState<UserData | null>(null);

  const [loadingUser, setLoadingUser] =
    useState(true);

  /*
  =========================================================
  DATA
  =========================================================
  */

  const [transactions, setTransactions] =
    useState<PettyCashTransaction[]>([]);

  const [accounts, setAccounts] =
    useState<PettyCashAccount[]>([]);

  const [outlets, setOutlets] =
    useState<Outlet[]>([]);

  const [outletBalances, setOutletBalances] =
    useState<OutletBalance[]>([]);

  const [summary, setSummary] =
    useState<PettyCashResponse["summary"]>({
      totalIn: 0,
      totalOut: 0,
      currentBalance: 0,
      totalOutletBalance: 0,
      pusatBalance: 0,
    });

  const [loading, setLoading] =
    useState(true);

  /*
  =========================================================
  LOCATION
  null = PUSAT
  number = OUTLET
  =========================================================
  */

  const [
    selectedLocationId,
    setSelectedLocationId,
  ] = useState<number | null>(null);

  const [
    locationInitialized,
    setLocationInitialized,
  ] = useState(false);

  /*
  =========================================================
  FILTER
  =========================================================
  */

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [tanggalMulai, setTanggalMulai] =
    useState("");

  const [tanggalSelesai, setTanggalSelesai] =
    useState("");

  /*
  =========================================================
  MODALS
  =========================================================
  */

  const [showManual, setShowManual] =
    useState(false);

  const [showTopUp, setShowTopUp] =
    useState(false);

  /*
  =========================================================
  MANUAL OUT
  =========================================================
  */

  const [manualCategory, setManualCategory] =
    useState("LALAMOVE");

  const [manualAmount, setManualAmount] =
    useState("");

  const [manualDate, setManualDate] =
    useState(getTodayInput());

  const [manualReference, setManualReference] =
    useState("");

  const [manualDescription, setManualDescription] =
    useState("");

  const [savingManual, setSavingManual] =
    useState(false);

  /*
  =========================================================
  TOP UP
  =========================================================
  */

  const [topUpAmount, setTopUpAmount] =
    useState("");

  const [topUpDate, setTopUpDate] =
    useState(getTodayInput());

  const [topUpReference, setTopUpReference] =
    useState("");

  const [topUpDescription, setTopUpDescription] =
    useState("");

  const [savingTopUp, setSavingTopUp] =
    useState(false);

  /*
  =========================================================
  APPROVAL
  =========================================================
  */

  const [approvingId, setApprovingId] =
    useState<number | null>(null);

  const [rejectingId, setRejectingId] =
    useState<number | null>(null);

  /*
  =========================================================
  LOAD USER
  =========================================================
  */

  const loadUser = useCallback(
    async () => {
      try {
        setLoadingUser(true);

        const res = await fetch(
          "/api/me",
          {
            cache: "no-store",
          }
        );

        const contentType =
          res.headers.get("content-type") || "";

        if (
          !contentType.includes(
            "application/json"
          )
        ) {
          const text =
            await res.text();

          console.error(
            "LOAD USER NON JSON RESPONSE:",
            text
          );

          throw new Error(
            `Server mengembalikan response bukan JSON (${res.status}).`
          );
        }

        const json =
          await res.json();

        if (!res.ok) {
          throw new Error(
            json?.message ||
              json?.error ||
              "Gagal mengambil data user."
          );
        }

        const userData =
          json?.user ??
          json?.data ??
          json;

        if (!userData?.id) {
          throw new Error(
            "Data user tidak ditemukan."
          );
        }

        setUser(userData);
      } catch (error) {
        console.error(
          "LOAD USER PETTY CASH ERROR:",
          error
        );

        alert(
          error instanceof Error
            ? error.message
            : "Gagal mengambil data user."
        );
      } finally {
        setLoadingUser(false);
      }
    },
    []
  );

  /*
  =========================================================
  LOAD PETTY CASH
  =========================================================
  */

  const loadPettyCash =
    useCallback(async () => {
      try {
        setLoading(true);

        const res =
          await fetch(
            "/api/petty-cash",
            {
              cache: "no-store",
            }
          );

        const contentType =
          res.headers.get(
            "content-type"
          ) || "";

        let json: any;

        if (
          contentType.includes(
            "application/json"
          )
        ) {
          json = await res.json();
        } else {
          const text =
            await res.text();

          console.error(
            "PETTY CASH NON JSON RESPONSE:",
            text
          );

          throw new Error(
            `Server mengembalikan response bukan JSON (${res.status}).`
          );
        }

        if (
          !res.ok ||
          json?.success === false
        ) {
          throw new Error(
            json?.message ||
              json?.error ||
              "Gagal mengambil data Petty Cash."
          );
        }

        const data =
          json as PettyCashResponse;

        setTransactions(
          Array.isArray(data.data)
            ? data.data
            : []
        );

        setAccounts(
          Array.isArray(data.accounts)
            ? data.accounts
            : []
        );

        setOutlets(
          Array.isArray(data.outlets)
            ? data.outlets
            : []
        );

        setOutletBalances(
          Array.isArray(
            data.outletBalances
          )
            ? data.outletBalances
            : []
        );

        setSummary(
          data.summary ?? {
            totalIn: 0,
            totalOut: 0,
            currentBalance: 0,
            totalOutletBalance: 0,
            pusatBalance: 0,
          }
        );
      } catch (error) {
        console.error(
          "LOAD PETTY CASH ERROR:",
          error
        );

        alert(
          error instanceof Error
            ? error.message
            : "Gagal mengambil data Petty Cash."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  /*
  =========================================================
  INITIAL LOAD
  =========================================================
  */

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    loadPettyCash();
  }, [loadPettyCash]);

  /*
  =========================================================
  DEFAULT LOCATION
  =========================================================
  */

  useEffect(() => {
    if (
      locationInitialized ||
      loadingUser ||
      !user
    ) {
      return;
    }

    if (isOutletRole(user.role)) {
      if (
        user.outletId !== null &&
        user.outletId !== undefined
      ) {
        setSelectedLocationId(
          user.outletId
        );
      }

      setLocationInitialized(true);
      return;
    }

    setSelectedLocationId(null);
    setLocationInitialized(true);
  }, [
    user,
    loadingUser,
    locationInitialized,
  ]);

  /*
  =========================================================
  ACCESS
  =========================================================
  */

  const isCentralAdmin =
    isCentralRole(user?.role);

  const isOutletAdmin =
    isOutletRole(user?.role);

  const canTopUp =
    isCentralAdmin;

  const canCreateTransaction =
    Boolean(user);

  const canApprove =
    isCentralAdmin;

  /*
  =========================================================
  LOCATION DATA
  =========================================================
  */

  const selectedOutlet =
    selectedLocationId === null
      ? null
      : outlets.find(
          (outlet) =>
            outlet.id ===
            selectedLocationId
        ) ?? null;

  const selectedBalance =
    outletBalances.find(
      (item) =>
        item.outletId ===
        selectedLocationId
    ) ?? null;

  const selectedAccount =
    accounts.find(
      (account) =>
        account.outletId ===
        selectedLocationId
    ) ?? null;

  const userLocationLabel =
    selectedLocationId === null
      ? "Pusat • Petty Cash Pusat"
      : selectedOutlet
        ? `${selectedOutlet.code} • ${selectedOutlet.name}`
        : user?.outletId ===
              selectedLocationId &&
            user.outlet
          ? `${user.outlet.code} • ${user.outlet.name}`
          : "Outlet";

  /*
  =========================================================
  CURRENT BALANCE
  =========================================================
  */

  const pettyCashBalance =
    selectedBalance
      ? Number(
          selectedBalance.balance ??
            selectedBalance.currentBalance ??
            selectedBalance.saldo ??
            0
        )
      : selectedAccount
        ? Number(
            selectedAccount.currentBalance ??
              selectedAccount.balance ??
              selectedAccount.saldo ??
              0
          )
        : selectedLocationId === null
          ? Number(
              summary.pusatBalance ?? 0
            )
          : 0;

  /*
  =========================================================
  LOCATION TRANSACTIONS
  =========================================================
  */

  const locationTransactions =
    useMemo(() => {
      return transactions.filter(
        (transaction) => {
          const transactionOutletId =
            transaction.outletId;

          if (
            selectedLocationId === null
          ) {
            return (
              transactionOutletId ===
                null ||
              transactionOutletId ===
                undefined
            );
          }

          return (
            Number(
              transactionOutletId
            ) ===
            Number(
              selectedLocationId
            )
          );
        }
      );
    }, [
      transactions,
      selectedLocationId,
    ]);

  /*
  =========================================================
  FILTER
  =========================================================
  */

  const filteredTransactions =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return locationTransactions.filter(
        (transaction) => {
          if (
            normalizedSearch
          ) {
            const haystack = [
              transaction.number,
              transaction.category,
              transaction.description,
              transaction.referenceNumber,
              transaction.outlet?.code,
              transaction.outlet?.name,
              transaction.account?.code,
              transaction.account?.name,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            if (
              !haystack.includes(
                normalizedSearch
              )
            ) {
              return false;
            }
          }

          if (
            statusFilter !== "ALL" &&
            transaction.status !==
              statusFilter
          ) {
            return false;
          }

          if (
            tanggalMulai
          ) {
            const transactionDate =
              new Date(
                transaction.trxDate
              );

            const from =
              new Date(
                `${tanggalMulai}T00:00:00`
              );

            if (
              transactionDate <
              from
            ) {
              return false;
            }
          }

          if (
            tanggalSelesai
          ) {
            const transactionDate =
              new Date(
                transaction.trxDate
              );

            const to =
              new Date(
                `${tanggalSelesai}T23:59:59.999`
              );

            if (
              transactionDate >
              to
            ) {
              return false;
            }
          }

          return true;
        }
      );
    }, [
      locationTransactions,
      search,
      statusFilter,
      tanggalMulai,
      tanggalSelesai,
    ]);

  /*
  =========================================================
  APPROVED TOTALS
  =========================================================
  */

  const totalApprovedIn =
    useMemo(() => {
      return locationTransactions
        .filter(
          (transaction) =>
            transaction.status ===
              "APPROVED" &&
            transaction.type ===
              "IN"
        )
        .reduce(
          (total, transaction) =>
            total +
            Number(
              transaction.amount ?? 0
            ),
          0
        );
    }, [
      locationTransactions,
    ]);

  const totalApprovedOut =
    useMemo(() => {
      return locationTransactions
        .filter(
          (transaction) =>
            transaction.status ===
              "APPROVED" &&
            transaction.type ===
              "OUT"
        )
        .reduce(
          (total, transaction) =>
            total +
            Number(
              transaction.amount ?? 0
            ),
          0
        );
    }, [
      locationTransactions,
    ]);

  const pendingCount =
    useMemo(() => {
      return locationTransactions.filter(
        (transaction) =>
          transaction.status ===
          "PENDING"
      ).length;
    }, [
      locationTransactions,
    ]);

  const approvedCount =
    useMemo(() => {
      return locationTransactions.filter(
        (transaction) =>
          transaction.status ===
          "APPROVED"
      ).length;
    }, [
      locationTransactions,
    ]);

  const rejectedCount =
    useMemo(() => {
      return locationTransactions.filter(
        (transaction) =>
          transaction.status ===
          "REJECTED"
      ).length;
    }, [
      locationTransactions,
    ]);

  /*
  =========================================================
  RESET
  =========================================================
  */

  function resetFilter() {
    setSearch("");
    setStatusFilter("ALL");
    setTanggalMulai("");
    setTanggalSelesai("");
  }

  /*
  =========================================================
  LOCATION CHANGE
  =========================================================
  */

  function handleLocationChange(
    value: string
  ) {
    if (!isCentralAdmin) {
      return;
    }

    if (value === "PUSAT") {
      setSelectedLocationId(null);
    } else {
      const outletId =
        Number(value);

      if (
        Number.isInteger(outletId)
      ) {
        setSelectedLocationId(
          outletId
        );
      }
    }

    resetFilter();
  }

  /*
  =========================================================
  OPEN MANUAL
  =========================================================
  */

  function openManualTransaction() {
    if (!canCreateTransaction) {
      return;
    }

    setManualAmount("");
    setManualDate(
      getTodayInput()
    );
    setManualReference("");
    setManualDescription("");
    setManualCategory("LALAMOVE");

    setShowManual(true);
  }

  /*
  =========================================================
  OPEN TOP UP
  =========================================================
  */

  function openTopUp() {
    if (!canTopUp) {
      return;
    }

    setTopUpAmount("");
    setTopUpDate(
      getTodayInput()
    );
    setTopUpReference("");
    setTopUpDescription("");

    setShowTopUp(true);
  }

  /*
  =========================================================
  SUBMIT MANUAL
  =========================================================
  */

  async function submitManualTransaction() {
    if (savingManual) {
      return;
    }

    const amount =
      parseRupiah(
        manualAmount
      );

    if (amount <= 0) {
      alert(
        "Nominal transaksi harus lebih dari 0."
      );
      return;
    }

    if (!manualDate) {
      alert(
        "Tanggal transaksi wajib dipilih."
      );
      return;
    }

    try {
      setSavingManual(true);

      const res =
        await fetch(
          "/api/petty-cash",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              type: "OUT",
              category:
                manualCategory,
              amount,
              trxDate:
                manualDate,
              referenceNumber:
                manualReference.trim() ||
                null,
              description:
                manualDescription.trim() ||
                null,
              outletId:
                selectedLocationId,
            }),
          }
        );

      const contentType =
        res.headers.get(
          "content-type"
        ) || "";

      let json: any;

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        json =
          await res.json();
      } else {
        const text =
          await res.text();

        throw new Error(
          `Server mengembalikan response bukan JSON (${res.status}). ${text}`
        );
      }

      if (!res.ok) {
        throw new Error(
          json?.message ||
            json?.error ||
            "Gagal membuat transaksi."
        );
      }

      setShowManual(false);

      await loadPettyCash();

      alert(
        "Transaksi keluar berhasil dibuat dan menunggu approval."
      );
    } catch (error) {
      console.error(
        "SUBMIT MANUAL TRANSACTION ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Gagal membuat transaksi."
      );
    } finally {
      setSavingManual(false);
    }
  }

  /*
  =========================================================
  SUBMIT TOP UP
  =========================================================
  */

  async function submitTopUp() {
    if (savingTopUp) {
      return;
    }

    if (!canTopUp) {
      alert(
        "Anda tidak memiliki akses Top Up."
      );
      return;
    }

    const amount =
      parseRupiah(
        topUpAmount
      );

    if (amount <= 0) {
      alert(
        "Nominal Top Up harus lebih dari 0."
      );
      return;
    }

    if (!topUpDate) {
      alert(
        "Tanggal Top Up wajib dipilih."
      );
      return;
    }

    try {
      setSavingTopUp(true);

      const res =
        await fetch(
          "/api/petty-cash",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              type: "IN",
              category: "TOP UP",
              amount,
              trxDate:
                topUpDate,
              referenceNumber:
                topUpReference.trim() ||
                null,
              description:
                topUpDescription.trim() ||
                null,
              outletId:
                selectedLocationId,
              status:
                "APPROVED",
            }),
          }
        );

      const contentType =
        res.headers.get(
          "content-type"
        ) || "";

      let json: any;

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        json =
          await res.json();
      } else {
        const text =
          await res.text();

        throw new Error(
          `Server mengembalikan response bukan JSON (${res.status}). ${text}`
        );
      }

      if (!res.ok) {
        throw new Error(
          json?.message ||
            json?.error ||
            "Gagal melakukan Top Up."
        );
      }

      setShowTopUp(false);

      await loadPettyCash();

      alert(
        "Top Up berhasil dan saldo telah ditambahkan."
      );
    } catch (error) {
      console.error(
        "SUBMIT TOP UP ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Gagal melakukan Top Up."
      );
    } finally {
      setSavingTopUp(false);
    }
  }

  /*
  =========================================================
  APPROVE
  =========================================================
  */

  async function approveTransaction(
    transaction: PettyCashTransaction
  ) {
    if (
      approvingId !== null ||
      rejectingId !== null
    ) {
      return;
    }

    if (!canApprove) {
      return;
    }

    const confirmed =
      window.confirm(
        `Approve transaksi ${transaction.number} sebesar ${formatRupiahSigned(
          transaction.amount
        )}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setApprovingId(
        transaction.id
      );

      const res =
        await fetch(
          `/api/petty-cash/${transaction.id}/approve`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

      const contentType =
        res.headers.get(
          "content-type"
        ) || "";

      let json: any;

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        json =
          await res.json();
      } else {
        const text =
          await res.text();

        throw new Error(
          `Server mengembalikan response bukan JSON (${res.status}). ${text}`
        );
      }

      if (!res.ok) {
        throw new Error(
          json?.message ||
            json?.error ||
            "Gagal approve transaksi."
        );
      }

      await loadPettyCash();

      alert(
        "Transaksi berhasil di-approve."
      );
    } catch (error) {
      console.error(
        "APPROVE PETTY CASH ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Gagal approve transaksi."
      );
    } finally {
      setApprovingId(null);
    }
  }

  /*
  =========================================================
  REJECT
  =========================================================
  */

  async function rejectTransaction(
    transaction: PettyCashTransaction
  ) {
    if (
      approvingId !== null ||
      rejectingId !== null
    ) {
      return;
    }

    if (!canApprove) {
      return;
    }

    const confirmed =
      window.confirm(
        `Reject transaksi ${transaction.number}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setRejectingId(
        transaction.id
      );

      const res =
        await fetch(
          `/api/petty-cash/${transaction.id}/reject`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

      const contentType =
        res.headers.get(
          "content-type"
        ) || "";

      let json: any;

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        json =
          await res.json();
      } else {
        const text =
          await res.text();

        throw new Error(
          `Server mengembalikan response bukan JSON (${res.status}). ${text}`
        );
      }

      if (!res.ok) {
        throw new Error(
          json?.message ||
            json?.error ||
            "Gagal reject transaksi."
        );
      }

      await loadPettyCash();

      alert(
        "Transaksi berhasil di-reject."
      );
    } catch (error) {
      console.error(
        "REJECT PETTY CASH ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Gagal reject transaksi."
      );
    } finally {
      setRejectingId(null);
    }
  }

/*
=========================================================
EXPORT PDF
=========================================================
*/

function exportPettyCashPDF() {
  if (
    loading ||
    loadingUser ||
    filteredTransactions.length === 0
  ) {
    return;
  }

  // =====================================================
  // LOCATION
  // =====================================================

  const locationName = String(
    userLocationLabel || "Pusat"
  );

  // =====================================================
  // CREATE PDF
  // =====================================================

  const doc = new jsPDF("l", "mm", "a4");

  const pageWidth =
    doc.internal.pageSize.getWidth();

  const pageHeight =
    doc.internal.pageSize.getHeight();

  const margin = 12;

  // =====================================================
  // HEADER
  // =====================================================

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(18, 59, 93);

  doc.text(
    "REKENING KORAN PETTY CASH",
    margin,
    16
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 128);

  doc.text(
    `Lokasi: ${locationName}`,
    margin,
    22
  );

  // =====================================================
  // PERIOD / FILTER
  // =====================================================

  let periodText = "Semua periode";

  if (
    tanggalMulai &&
    tanggalSelesai
  ) {
    periodText =
      `${formatDateOnly(tanggalMulai)} - ${formatDateOnly(
        tanggalSelesai
      )}`;
  } else if (tanggalMulai) {
    periodText =
      `Mulai ${formatDateOnly(tanggalMulai)}`;
  } else if (tanggalSelesai) {
    periodText =
      `Sampai ${formatDateOnly(tanggalSelesai)}`;
  }

  doc.text(
    `Periode: ${periodText}`,
    margin,
    27
  );

  // =====================================================
  // SUMMARY CARDS
  // =====================================================

  const cardY = 33;
  const cardHeight = 18;
  const gap = 4;

  const cardWidth =
    (pageWidth -
      margin * 2 -
      gap * 3) /
    4;

  const summaryCards = [
    {
      label: "SALDO TERSEDIA",
      value: formatRupiahSigned(
        pettyCashBalance
      ),
    },
    {
      label: "TOTAL MASUK",
      value: formatRupiahSigned(
        totalApprovedIn
      ),
    },
    {
      label: "TOTAL KELUAR",
      value: formatRupiahSigned(
        totalApprovedOut
      ),
    },
    {
      label: "PENDING",
      value: String(
        pendingCount
      ),
    },
  ];

  summaryCards.forEach(
    (card, index) => {
      const x =
        margin +
        index *
          (cardWidth + gap);

      doc.setDrawColor(
        211,
        225,
        233
      );

      doc.setFillColor(
        247,
        250,
        252
      );

      doc.roundedRect(
        x,
        cardY,
        cardWidth,
        cardHeight,
        2,
        2,
        "FD"
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(6.5);

      doc.setTextColor(
        113,
        136,
        153
      );

      doc.text(
        card.label,
        x + 4,
        cardY + 6
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(10);

      doc.setTextColor(
        18,
        59,
        93
      );

      doc.text(
        card.value,
        x + 4,
        cardY + 13
      );
    }
  );

  // =====================================================
  // TABLE DATA
  // =====================================================

  const tableRows =
    filteredTransactions.map(
      (
        transaction,
        index
      ) => {
        const moneyIn =
          isMoneyIn(
            transaction.type
          );

        return [
          String(index + 1),

          // =================================================
          // TANGGAL TRANSAKSI
          // =================================================
          formatDateOnly(
            transaction.trxDate
          ),

          transaction.number ||
            "-",

          transaction.description ||
            "-",

          transaction.category ||
            "-",

          // =================================================
          // DEBET / KELUAR
          // =================================================
          !moneyIn &&
          transaction.status ===
            "APPROVED"
            ? formatRupiahSigned(
                transaction.amount
              )
            : "-",

          // =================================================
          // KREDIT / MASUK
          // =================================================
          moneyIn &&
          transaction.status ===
            "APPROVED"
            ? formatRupiahSigned(
                transaction.amount
              )
            : "-",

          // =================================================
          // SALDO
          // =================================================
          transaction.status ===
          "APPROVED"
            ? formatRupiahSigned(
                transaction.balanceAfter
              )
            : "Belum diposting",

          transaction.status ||
            "-",
        ];
      }
    );

  // =====================================================
  // TABLE
  // =====================================================

  autoTable(doc, {
    startY: 57,

    head: [
      [
        "No",
        "Tanggal",
        "Nomor Transaksi",
        "Keterangan",
        "Kategori",
        "Debet",
        "Kredit",
        "Saldo",
        "Status",
      ],
    ],

    body: tableRows,

    margin: {
      left: margin,
      right: margin,
    },

    theme: "grid",

    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 3,

      textColor: [
        36,
        59,
        75,
      ],

      lineColor: [
        220,
        232,
        239,
      ],

      lineWidth: 0.2,

      valign: "middle",
    },

    headStyles: {
      font: "helvetica",
      fontStyle: "bold",
      fontSize: 7,

      textColor: [
        54,
        93,
        117,
      ],

      fillColor: [
        221,
        235,
        244,
      ],

      lineColor: [
        197,
        219,
        232,
      ],

      lineWidth: 0.2,

      halign: "left",
    },

    alternateRowStyles: {
      fillColor: [
        249,
        251,
        252,
      ],
    },

    columnStyles: {
      0: {
        halign: "center",
        cellWidth: 10,
      },

      1: {
        cellWidth: 25,
      },

      2: {
        cellWidth: 38,
      },

      3: {
        cellWidth: "auto",
      },

      4: {
        cellWidth: 28,
      },

      5: {
        halign: "right",
        cellWidth: 34,
      },

      6: {
        halign: "right",
        cellWidth: 34,
      },

      7: {
        halign: "right",
        cellWidth: 36,
      },

      8: {
        halign: "center",
        cellWidth: 24,
      },
    },

    // ===================================================
    // STATUS
    // ===================================================

    didParseCell(data) {
      if (
        data.section ===
          "body" &&
        data.column.index === 8
      ) {
        const status =
          String(
            data.cell.raw || ""
          );

        if (
          status === "APPROVED" ||
          status === "PENDING" ||
          status === "REJECTED"
        ) {
          data.cell.styles.fontStyle =
            "bold";
        }
      }
    },

    // ===================================================
    // FOOTER
    // ===================================================

    didDrawPage() {
      const pageNumber =
        doc.getNumberOfPages();

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(6.5);

      doc.setTextColor(
        129,
        147,
        160
      );

      doc.text(
        "MGB ERP • Petty Cash",
        margin,
        pageHeight - 7
      );

      doc.text(
        `Halaman ${pageNumber}`,
        pageWidth - margin,
        pageHeight - 7,
        {
          align: "right",
        }
      );
    },
  });

  // =====================================================
  // FILE NAME
  // =====================================================

  const safeLocation =
    locationName
      .replace(/[<>:"/\\|?*]+/g, "")
      .replace(/\s+/g, "-")
      .trim() || "Pusat";

  const dateNow =
    new Date()
      .toISOString()
      .slice(0, 10);

  const fileName =
    `Petty-Cash-${safeLocation}-${dateNow}.pdf`;

  // =====================================================
  // DIRECT DOWNLOAD
  // =====================================================

  doc.save(fileName);
}

  /*
  =========================================================
  RENDER
  =========================================================
  */

  return (
    <div className="min-h-screen bg-[#F4F8FB] text-[#173D59]">

      {/* =================================================
          TOP HEADER
          ================================================= */}

      <header className="sticky top-0 z-30 border-b border-[#D7E5ED] bg-white/95 backdrop-blur-xl">

        <div className="px-5 py-4 lg:px-8">

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

            <div className="flex min-w-0 items-center gap-3">

              <div className="relative">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#0066B3] to-[#0B86C8] text-white shadow-[0_8px_20px_rgba(0,102,179,0.20)]">

                  <Wallet size={20} />

                </div>

                <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />

              </div>

              <div className="min-w-0">

                <div className="flex flex-wrap items-center gap-2">

                  <h1 className="text-[19px] font-extrabold tracking-[-0.025em] text-[#123B5D]">
                    Petty Cash
                  </h1>

                  <span className="rounded-full border border-[#CFE2ED] bg-[#F0F7FB] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-[#0066B3]">
                    Finance
                  </span>

                </div>

                <p className="mt-0.5 text-[10px] font-medium text-[#8094A2]">
                  Kelola saldo, pengeluaran, dan mutasi kas kecil
                </p>

              </div>

            </div>

            <div className="flex flex-wrap items-center gap-2">

              {/* LOCATION */}

              <div className="relative">

                {isCentralAdmin ? (
                  <select
                    value={
                      selectedLocationId ===
                      null
                        ? "PUSAT"
                        : String(
                            selectedLocationId
                          )
                    }
                    onChange={(e) =>
                      handleLocationChange(
                        e.target.value
                      )
                    }
                    className="h-10 min-w-[225px] appearance-none rounded-xl border border-[#C8DCE8] bg-[#F7FAFC] px-3.5 pr-9 text-[10px] font-bold text-[#315A78] shadow-sm outline-none transition focus:border-[#0066B3] focus:bg-white focus:ring-4 focus:ring-[#0066B3]/10"
                  >
                    <option value="PUSAT">
                      PUSAT • Petty Cash Pusat
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
                          {outlet.code} •{" "}
                          {outlet.name}
                        </option>
                      )
                    )}
                  </select>
                ) : (
                  <div className="flex h-10 items-center gap-2 rounded-xl border border-[#C8DCE8] bg-[#F1F7FB] px-3.5 text-[10px] font-bold text-[#315A78]">

                    {selectedLocationId ===
                    null ? (
                      <Landmark
                        size={14}
                        className="text-[#0066B3]"
                      />
                    ) : (
                      <Building2
                        size={14}
                        className="text-[#0066B3]"
                      />
                    )}

                    {userLocationLabel}

                  </div>
                )}

                {isCentralAdmin && (
                  <ChevronDown
                    size={13}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7896AA]"
                  />
                )}

              </div>

              <button
                type="button"
                onClick={
                  loadPettyCash
                }
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#C8DCE8] bg-white px-3.5 text-[10px] font-bold text-[#315A78] shadow-sm transition hover:border-[#9DBDD0] hover:bg-[#F4F9FC] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />
                Refresh
              </button>

              {canCreateTransaction && (
                <button
                  type="button"
                  onClick={
                    openManualTransaction
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0066B3] to-[#087CC1] px-4 text-[10px] font-extrabold text-white shadow-[0_8px_20px_rgba(0,102,179,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,102,179,0.24)]"
                >
                  <ArrowUpRight
                    size={15}
                  />
                  Transaksi Keluar
                </button>
              )}

              {canTopUp && (
                <button
                  type="button"
                  onClick={openTopUp}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087A56] to-[#0B966B] px-4 text-[10px] font-extrabold text-white shadow-[0_8px_20px_rgba(8,122,86,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(8,122,86,0.24)]"
                >
                  <Plus size={15} />
                  Top Up
                </button>
              )}

            </div>

          </div>

        </div>

      </header>

      {/* =================================================
          MAIN
          ================================================= */}

      <main className="px-5 py-6 lg:px-8">

        {/* =================================================
            HERO / BALANCE
            ================================================= */}

        <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr_1fr_1fr]">

          {/* BALANCE CARD */}

          <div
            className={
              "relative min-h-[185px] overflow-hidden rounded-2xl p-6 text-white shadow-[0_18px_45px_rgba(22,75,110,0.14)] " +
              (pettyCashBalance < 0
                ? "bg-gradient-to-br from-[#A91D16] via-[#C62828] to-[#9E1B16]"
                : "bg-gradient-to-br from-[#005A9F] via-[#006FBA] to-[#0A88C9]")
            }
          >

            <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full border-[32px] border-white/[0.06]" />

            <div className="absolute -bottom-24 right-20 h-52 w-52 rounded-full border-[25px] border-white/[0.05]" />

            <div className="absolute right-8 top-8 opacity-10">
              <Wallet size={90} />
            </div>

            <div className="relative z-10">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-2">

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">

                    <CreditCard
                      size={15}
                    />

                  </div>

                  <div>

                    <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/70">
                      Saldo Tersedia
                    </div>

                    <div className="mt-0.5 text-[10px] font-medium text-white/85">
                      {selectedLocationId ===
                      null
                        ? "Petty Cash Pusat"
                        : "Petty Cash Outlet"}
                    </div>

                  </div>

                </div>

                <MoreHorizontal
                  size={18}
                  className="text-white/65"
                />

              </div>

              <div className="mt-6">

                <div className="text-[31px] font-extrabold tracking-[-0.04em]">

                  {formatRupiahSigned(
                    pettyCashBalance
                  )}

                </div>

                {pettyCashBalance < 0 ? (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-bold text-white ring-1 ring-white/10">
                    <CircleX size={10} />
                    Saldo negatif
                  </div>
                ) : (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-bold text-white ring-1 ring-white/10">
                    <Check size={10} />
                    Saldo aktif
                  </div>
                )}

              </div>

              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-3">

                <span className="text-[9px] font-medium text-white/60">
                  Lokasi rekening
                </span>

                <span className="max-w-[65%] truncate text-right text-[9px] font-bold text-white/90">
                  {userLocationLabel}
                </span>

              </div>

            </div>

          </div>

          {/* TOTAL IN */}

          <div className="group rounded-2xl border border-[#D8E6EE] bg-white p-5 shadow-[0_8px_28px_rgba(22,75,110,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(22,75,110,0.09)]">

            <div className="flex items-start justify-between">

              <div>

                <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8195A3]">
                  Total Masuk
                </div>

                <div className="mt-4 text-[21px] font-extrabold tracking-tight text-[#123B5D]">
                  {formatRupiahSigned(
                    totalApprovedIn
                  )}
                </div>

              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF6FB] text-[#0066B3] transition group-hover:scale-105">

                <ArrowDownLeft
                  size={18}
                />

              </div>

            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[#EDF2F5] pt-3">

              <span className="text-[9px] text-[#91A1AC]">
                Transaksi approved
              </span>

              <span className="text-[9px] font-bold text-[#0066B3]">
                Masuk
              </span>

            </div>

          </div>

          {/* TOTAL OUT */}

          <div className="group rounded-2xl border border-[#D8E6EE] bg-white p-5 shadow-[0_8px_28px_rgba(22,75,110,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(22,75,110,0.09)]">

            <div className="flex items-start justify-between">

              <div>

                <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8195A3]">
                  Total Keluar
                </div>

                <div className="mt-4 text-[21px] font-extrabold tracking-tight text-[#C62828]">
                  {formatRupiahSigned(
                    totalApprovedOut
                  )}
                </div>

              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1F1] text-[#C62828] transition group-hover:scale-105">

                <ArrowUpRight
                  size={18}
                />

              </div>

            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[#EDF2F5] pt-3">

              <span className="text-[9px] text-[#91A1AC]">
                Transaksi approved
              </span>

              <span className="text-[9px] font-bold text-[#C62828]">
                Keluar
              </span>

            </div>

          </div>

          {/* PENDING */}

          <div className="group rounded-2xl border border-[#D8E6EE] bg-white p-5 shadow-[0_8px_28px_rgba(22,75,110,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(22,75,110,0.09)]">

            <div className="flex items-start justify-between">

              <div>

                <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8195A3]">
                  Menunggu Approval
                </div>

                <div className="mt-4 text-[27px] font-extrabold tracking-tight text-[#123B5D]">
                  {pendingCount}
                </div>

              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF7FC] text-[#0066B3] transition group-hover:scale-105">

                <Clock3 size={18} />

              </div>

            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[#EDF2F5] pt-3">

              <span className="text-[9px] text-[#91A1AC]">
                Perlu tindakan
              </span>

              <span className="text-[9px] font-bold text-[#0066B3]">
                {canApprove
                  ? "Approval"
                  : "Monitoring"}
              </span>

            </div>

          </div>

        </section>

        {/* =================================================
            MINI STAT BAR
            ================================================= */}

        <section className="mt-4 grid gap-3 sm:grid-cols-3">

          <div className="flex items-center justify-between rounded-xl border border-[#DCE8EF] bg-white px-4 py-3 shadow-sm">

            <div className="flex items-center gap-2.5">

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF6FB] text-[#0066B3]">
                <CreditCard size={14} />
              </div>

              <div>
                <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#91A0AB]">
                  Total Mutasi
                </div>

                <div className="mt-0.5 text-[12px] font-extrabold text-[#244B65]">
                  {locationTransactions.length}
                </div>
              </div>

            </div>

            <span className="text-[9px] font-semibold text-[#78909F]">
              transaksi
            </span>

          </div>

          <div className="flex items-center justify-between rounded-xl border border-[#DCE8EF] bg-white px-4 py-3 shadow-sm">

            <div className="flex items-center gap-2.5">

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF8F1] text-[#087A56]">
                <Check size={14} />
              </div>

              <div>
                <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#91A0AB]">
                  Approved
                </div>

                <div className="mt-0.5 text-[12px] font-extrabold text-[#244B65]">
                  {approvedCount}
                </div>
              </div>

            </div>

            <span className="text-[9px] font-semibold text-[#087A56]">
              selesai
            </span>

          </div>

          <div className="flex items-center justify-between rounded-xl border border-[#DCE8EF] bg-white px-4 py-3 shadow-sm">

            <div className="flex items-center gap-2.5">

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF1F1] text-[#C62828]">
                <CircleX size={14} />
              </div>

              <div>
                <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#91A0AB]">
                  Rejected
                </div>

                <div className="mt-0.5 text-[12px] font-extrabold text-[#244B65]">
                  {rejectedCount}
                </div>
              </div>

            </div>

            <span className="text-[9px] font-semibold text-[#C62828]">
              ditolak
            </span>

          </div>

        </section>

        {/* =================================================
            REKENING KORAN
            ================================================= */}

        <section className="mt-5 overflow-hidden rounded-2xl border border-[#D5E3EB] bg-white shadow-[0_12px_38px_rgba(22,75,110,0.07)]">

          {/* SECTION HEADER */}

          <div className="border-b border-[#DCE8EF] bg-gradient-to-r from-[#F5F9FC] via-white to-[#F8FBFD] px-5 py-5 lg:px-6">

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0066B3] to-[#0A87C9] text-white shadow-[0_6px_16px_rgba(0,102,179,0.16)]">

                  <CreditCard size={17} />

                </div>

                <div>

                  <div className="flex flex-wrap items-center gap-2">

                    <h2 className="text-[16px] font-extrabold tracking-tight text-[#123B5D]">
                      Rekening Koran
                    </h2>

                    <span className="rounded-full border border-[#CFE1EC] bg-[#EFF7FB] px-2.5 py-1 text-[8px] font-bold tracking-wide text-[#0066B3]">
                      {filteredTransactions.length} MUTASI
                    </span>

                  </div>

                  <p className="mt-1 text-[9px] font-medium text-[#879AA7]">
                    Riwayat transaksi, approval, dan pergerakan saldo Petty Cash
                  </p>

                </div>

              </div>

              <div className="flex items-center gap-2">

                <div className="hidden items-center gap-1.5 rounded-lg bg-[#F2F7FA] px-3 py-2 text-[9px] font-bold text-[#668196] lg:flex">

                  <SlidersHorizontal
                    size={12}
                    className="text-[#0066B3]"
                  />

                  Filter mutasi

                </div>

                <button
                  type="button"
                  onClick={
                    exportPettyCashPDF
                  }
                  disabled={
                    loading ||
                    loadingUser ||
                    filteredTransactions.length ===
                      0
                  }
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#C7DBE7] bg-white px-3.5 text-[9px] font-bold text-[#0066B3] shadow-sm transition hover:border-[#94BAD0] hover:bg-[#F0F7FB] disabled:cursor-not-allowed disabled:opacity-50"
                >

                  <FileDown
                    size={13}
                  />

                  Export PDF

                </button>

              </div>

            </div>

            {/* FILTER BAR */}

            <div className="mt-5 rounded-xl border border-[#D8E5EC] bg-[#F7FAFC] p-3">

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]">

                {/* SEARCH */}

                <div className="relative">

                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7896AA]"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                    placeholder="Cari nomor, keterangan, kategori, referensi..."
                    className="h-10 w-full rounded-lg border border-[#C9DCE8] bg-white pl-9 pr-3 text-[10px] font-medium text-[#344B5B] outline-none transition placeholder:text-[#9AAAB5] focus:border-[#0066B3] focus:ring-4 focus:ring-[#0066B3]/10"
                  />

                </div>

                {/* STATUS */}

                <div className="relative">

                  <select
                    value={
                      statusFilter
                    }
                    onChange={(e) =>
                      setStatusFilter(
                        e.target.value
                      )
                    }
                    className="h-10 w-full appearance-none rounded-lg border border-[#C9DCE8] bg-white px-3 pr-8 text-[10px] font-semibold text-[#4D6271] outline-none transition focus:border-[#0066B3] focus:ring-4 focus:ring-[#0066B3]/10"
                  >

                    <option value="ALL">
                      Semua Status
                    </option>

                    <option value="PENDING">
                      PENDING
                    </option>

                    <option value="APPROVED">
                      APPROVED
                    </option>

                    <option value="REJECTED">
                      REJECTED
                    </option>

                  </select>

                  <ChevronDown
                    size={12}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7896AA]"
                  />

                </div>

                {/* FROM */}

                <div className="relative">

                  <CalendarDays
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7896AA]"
                  />

                  <input
                    type="date"
                    value={
                      tanggalMulai
                    }
                    onChange={(e) =>
                      setTanggalMulai(
                        e.target.value
                      )
                    }
                    className="h-10 w-full rounded-lg border border-[#C9DCE8] bg-white pl-9 pr-2 text-[10px] font-medium text-[#4D6271] outline-none transition focus:border-[#0066B3] focus:ring-4 focus:ring-[#0066B3]/10"
                  />

                </div>

                {/* TO */}

                <div className="relative">

                  <CalendarDays
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7896AA]"
                  />

                  <input
                    type="date"
                    value={
                      tanggalSelesai
                    }
                    onChange={(e) =>
                      setTanggalSelesai(
                        e.target.value
                      )
                    }
                    className="h-10 w-full rounded-lg border border-[#C9DCE8] bg-white pl-9 pr-2 text-[10px] font-medium text-[#4D6271] outline-none transition focus:border-[#0066B3] focus:ring-4 focus:ring-[#0066B3]/10"
                  />

                </div>

                {/* RESET */}

                {(
                  search ||
                  statusFilter !==
                    "ALL" ||
                  tanggalMulai ||
                  tanggalSelesai
                ) ? (
                  <button
                    type="button"
                    onClick={
                      resetFilter
                    }
                    className="h-10 rounded-lg border border-[#C7DBE7] bg-white px-3.5 text-[9px] font-bold text-[#0066B3] transition hover:bg-[#EAF5FB]"
                  >
                    Reset Filter
                  </button>
                ) : (
                  <div className="hidden xl:block" />
                )}

              </div>

            </div>

          </div>

          {/* LOCATION BAR */}

          <div className="flex flex-col gap-3 border-b border-[#DCE8EF] bg-[#F5F9FC] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between lg:px-6">

            <div className="flex items-center gap-2.5">

              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#CFE0E9] bg-white text-[#0066B3] shadow-sm">

                {selectedLocationId ===
                null ? (
                  <Landmark size={14} />
                ) : (
                  <Building2 size={14} />
                )}

              </div>

              <div>

                <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#879BA8]">
                  Rekening / Lokasi Aktif
                </div>

                <div className="mt-0.5 text-[10px] font-extrabold text-[#245675]">
                  {userLocationLabel}
                </div>

              </div>

            </div>

            <div className="flex items-center gap-4">

              <div className="text-[9px] text-[#8195A3]">

                Menampilkan{" "}

                <span className="font-extrabold text-[#0066B3]">
                  {filteredTransactions.length}
                </span>{" "}

                dari{" "}

                <span className="font-bold text-[#4D6677]">
                  {locationTransactions.length}
                </span>{" "}
                transaksi

              </div>

              {search ||
              statusFilter !==
                "ALL" ||
              tanggalMulai ||
              tanggalSelesai ? (
                <span className="rounded-full bg-[#EAF5FB] px-2.5 py-1 text-[8px] font-bold text-[#0066B3]">
                  Filter aktif
                </span>
              ) : null}

            </div>

          </div>

          {/* =================================================
              TABLE
              ================================================= */}

          <div className="overflow-x-auto">

            <table className="min-w-[1180px] w-full border-collapse">

              <thead>

                <tr className="border-b border-[#C5D9E5] bg-[#EAF3F8]">

                  <th className="w-[55px] px-4 py-3.5 text-center text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#547187]">
                    No
                  </th>

                  <th className="w-[125px] px-4 py-3.5 text-left text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#547187]">
                    Tanggal
                  </th>

                  <th className="w-[170px] px-4 py-3.5 text-left text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#547187]">
                    Nomor Transaksi
                  </th>

                  <th className="min-w-[290px] px-4 py-3.5 text-left text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#547187]">
                    Keterangan
                  </th>

                  <th className="w-[140px] px-4 py-3.5 text-left text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#547187]">
                    Kategori
                  </th>

                  <th className="w-[160px] px-4 py-3.5 text-right text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#547187]">
                    Keluar
                  </th>

                  <th className="w-[160px] px-4 py-3.5 text-right text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#547187]">
                    Masuk
                  </th>

                  <th className="w-[170px] px-4 py-3.5 text-right text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#547187]">
                    Saldo
                  </th>

                  <th className="w-[120px] px-4 py-3.5 text-center text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#547187]">
                    Status
                  </th>

                  <th className="w-[170px] px-4 py-3.5 text-center text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#547187]">
                    Aksi
                  </th>

                </tr>

              </thead>

              <tbody>

                {loading ||
                loadingUser ? (
                  <tr>

                    <td
                      colSpan={10}
                      className="px-5 py-24"
                    >

                      <div className="flex flex-col items-center">

                        <div className="relative">

                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF4F9] text-[#0066B3]">
                            <RefreshCw
                              size={21}
                              className="animate-spin"
                            />
                          </div>

                        </div>

                        <p className="mt-4 text-[11px] font-extrabold text-[#42647A]">
                          Memuat rekening koran
                        </p>

                        <p className="mt-1 text-[9px] text-[#91A3AE]">
                          Mengambil data Petty Cash...
                        </p>

                      </div>

                    </td>

                  </tr>
                ) : filteredTransactions.length ===
                  0 ? (
                  <tr>

                    <td
                      colSpan={10}
                      className="px-5 py-24"
                    >

                      <div className="flex flex-col items-center">

                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#DCE8EF] bg-[#F5F9FC] text-[#7B96A7]">

                          <Wallet size={24} />

                        </div>

                        <p className="mt-4 text-[12px] font-extrabold text-[#536F82]">
                          Tidak ada mutasi
                        </p>

                        <p className="mt-1 max-w-md text-center text-[9px] leading-5 text-[#91A3AE]">
                          Tidak ditemukan transaksi Petty Cash yang sesuai dengan filter dan lokasi yang dipilih.
                        </p>

                        {(search ||
                          statusFilter !==
                            "ALL" ||
                          tanggalMulai ||
                          tanggalSelesai) && (
                          <button
                            type="button"
                            onClick={
                              resetFilter
                            }
                            className="mt-4 rounded-lg border border-[#C7DBE7] bg-white px-3.5 py-2 text-[9px] font-bold text-[#0066B3] shadow-sm transition hover:bg-[#EAF5FB]"
                          >
                            Hapus Filter
                          </button>
                        )}

                      </div>

                    </td>

                  </tr>
                ) : (
                  filteredTransactions.map(
                    (
                      transaction,
                      index
                    ) => {
                      const moneyIn =
                        isMoneyIn(
                          transaction.type
                        );

                      const isPending =
                        transaction.status ===
                        "PENDING";

                      const isApproving =
                        approvingId ===
                        transaction.id;

                      const isRejecting =
                        rejectingId ===
                        transaction.id;

                      const transactionBalance =
                        Number(
                          transaction.balanceAfter ??
                            0
                        );

                      return (
                        <tr
                          key={
                            transaction.id
                          }
                          className={
                            "group border-b border-[#E6EEF3] transition-all " +
                            (isPending
                              ? "bg-[#F8FCFE] hover:bg-[#EFF8FC]"
                              : index %
                                    2 ===
                                  0
                                ? "bg-white hover:bg-[#F7FBFD]"
                                : "bg-[#FBFCFD] hover:bg-[#F5F9FC]")
                          }
                        >

                          {/* NO */}

                          <td className="px-4 py-4 text-center align-middle">

                            <span className="text-[9px] font-bold text-[#8AA0AE]">
                              {String(
                                index + 1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </span>

                          </td>

                          {/* TANGGAL */}

                          <td className="px-4 py-4 align-middle">

                            <div className="flex items-start gap-2">

                              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F0F6FA] text-[#62849A]">

                                <CalendarDays
                                  size={12}
                                />

                              </div>

                              <div>

                                <div className="whitespace-nowrap text-[10px] font-extrabold text-[#365A70]">
                                  {formatDateOnly(
                                    transaction.trxDate
                                  )}
                                </div>

                                <div className="mt-0.5 whitespace-nowrap text-[8px] text-[#99A9B4]">
                                  {formatDateTime(
                                    transaction.trxDate
                                  )
                                    .split(
                                      " "
                                    )
                                    .slice(
                                      1
                                    )
                                    .join(
                                      " "
                                    )}
                                </div>

                              </div>

                            </div>

                          </td>

                          {/* NUMBER */}

                          <td className="px-4 py-4 align-middle">

                            <div className="text-[10px] font-extrabold text-[#0066B3]">
                              {transaction.number ||
                                "-"}
                            </div>

                            {transaction.referenceNumber && (
                              <div className="mt-1 max-w-[145px] truncate text-[8px] text-[#879AA7]">
                                Ref.{" "}
                                {
                                  transaction.referenceNumber
                                }
                              </div>
                            )}

                            {transaction.paymentId && (
                              <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-[#F1F6F9] px-1.5 py-0.5 text-[7px] font-bold text-[#718896]">
                                Payment #
                                {
                                  transaction.paymentId
                                }
                              </div>
                            )}

                          </td>

                          {/* KETERANGAN */}

                          <td className="px-4 py-4 align-middle">

                            <div className="flex items-center gap-3">

                              <div
                                className={
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm " +
                                  (moneyIn
                                    ? "border-[#CBE4EF] bg-[#EFF8FC] text-[#0066B3]"
                                    : "border-[#E6D8D8] bg-[#FFF7F7] text-[#C62828]")
                                }
                              >

                                {moneyIn ? (
                                  <ArrowDownLeft
                                    size={15}
                                  />
                                ) : (
                                  <ArrowUpRight
                                    size={15}
                                  />
                                )}

                              </div>

                              <div className="min-w-0">

                                <div className="max-w-[330px] truncate text-[10px] font-bold text-[#344D5C]">
                                  {transaction.description ||
                                    "Tanpa keterangan"}
                                </div>

                                <div className="mt-1 flex items-center gap-1.5">

                                  {transaction.outlet ? (
                                    <>
                                      <Building2
                                        size={9}
                                        className="text-[#8AA0AE]"
                                      />

                                      <span className="max-w-[230px] truncate text-[8px] text-[#8AA0AE]">
                                        {
                                          transaction
                                            .outlet
                                            .code
                                        }{" "}
                                        •{" "}
                                        {
                                          transaction
                                            .outlet
                                            .name
                                        }
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Landmark
                                        size={9}
                                        className="text-[#8AA0AE]"
                                      />

                                      <span className="text-[8px] text-[#8AA0AE]">
                                        Petty Cash Pusat
                                      </span>
                                    </>
                                  )}

                                </div>

                              </div>

                            </div>

                          </td>

                          {/* CATEGORY */}

                          <td className="px-4 py-4 align-middle">

                            {transaction.category ===
                            "LALAMOVE" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#C7DDE9] bg-[#EFF7FB] px-2.5 py-1.5 text-[8px] font-extrabold tracking-wide text-[#0066B3]">

                                <Truck size={10} />

                                LALAMOVE

                              </span>
                            ) : (
                              <span className="inline-flex max-w-[120px] truncate rounded-lg border border-[#DFE7EC] bg-[#F7FAFC] px-2.5 py-1.5 text-[8px] font-bold text-[#617C8E]">
                                {transaction.category ||
                                  "-"}
                              </span>
                            )}

                          </td>

                          {/* OUT */}

                          <td className="px-4 py-4 text-right align-middle">

                            {!moneyIn ? (
                              <div>

                                <div
                                  className={
                                    "text-[10px] font-extrabold tabular-nums " +
                                    (transaction.status ===
                                    "APPROVED"
                                      ? "text-[#C62828]"
                                      : "text-[#A7B6C0]")
                                  }
                                >
                                  {formatRupiahSigned(
                                    transaction.amount
                                  )}
                                </div>

                                {transaction.status !==
                                  "APPROVED" && (
                                  <div className="mt-0.5 text-[7px] font-semibold text-[#A5B3BC]">
                                    Belum diposting
                                  </div>
                                )}

                              </div>
                            ) : (
                              <span className="text-[#CBD6DC]">
                                —
                              </span>
                            )}

                          </td>

                          {/* IN */}

                          <td className="px-4 py-4 text-right align-middle">

                            {moneyIn ? (
                              <div>

                                <div
                                  className={
                                    "text-[10px] font-extrabold tabular-nums " +
                                    (transaction.status ===
                                    "APPROVED"
                                      ? "text-[#087A56]"
                                      : "text-[#A7B6C0]")
                                  }
                                >
                                  {formatRupiahSigned(
                                    transaction.amount
                                  )}
                                </div>

                                {transaction.status !==
                                  "APPROVED" && (
                                  <div className="mt-0.5 text-[7px] font-semibold text-[#A5B3BC]">
                                    Belum diposting
                                  </div>
                                )}

                              </div>
                            ) : (
                              <span className="text-[#CBD6DC]">
                                —
                              </span>
                            )}

                          </td>

                          {/* BALANCE */}

                          <td className="px-4 py-4 text-right align-middle">

                            {transaction.status ===
                            "APPROVED" ? (
                              <div>

                                <div
                                  className={
                                    "text-[10px] font-extrabold tabular-nums " +
                                    (transactionBalance <
                                    0
                                      ? "text-[#C62828]"
                                      : "text-[#173D59]")
                                  }
                                >
                                  {formatRupiahSigned(
                                    transaction.balanceAfter
                                  )}
                                </div>

                                <div className="mt-0.5 text-[7px] text-[#9AAAB4]">
                                  Saldo akhir
                                </div>

                              </div>
                            ) : (
                              <span className="inline-flex rounded-md bg-[#F4F7F9] px-2 py-1 text-[8px] font-bold text-[#9EAFBA]">
                                Belum diposting
                              </span>
                            )}

                          </td>

                          {/* STATUS */}

                          <td className="px-4 py-4 text-center align-middle">

                            <StatusBadge
                              status={
                                transaction.status
                              }
                            />

                          </td>

                          {/* ACTION */}

                          <td className="px-4 py-4 text-center align-middle">

                            {canApprove &&
                            isPending ? (
                              <div className="flex items-center justify-center gap-1.5">

                                <button
                                  type="button"
                                  disabled={
                                    isApproving ||
                                    isRejecting
                                  }
                                  onClick={() =>
                                    approveTransaction(
                                      transaction
                                    )
                                  }
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0066B3] px-2.5 text-[8px] font-extrabold text-white shadow-sm transition hover:bg-[#005596] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                                >

                                  {isApproving ? (
                                    <RefreshCw
                                      size={10}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Check
                                      size={10}
                                    />
                                  )}

                                  {isApproving
                                    ? "..."
                                    : "Approve"}

                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    isApproving ||
                                    isRejecting
                                  }
                                  onClick={() =>
                                    rejectTransaction(
                                      transaction
                                    )
                                  }
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E3CACA] bg-white px-2.5 text-[8px] font-extrabold text-[#C62828] transition hover:bg-[#FFF4F4] disabled:cursor-not-allowed disabled:opacity-50"
                                >

                                  {isRejecting ? (
                                    <RefreshCw
                                      size={10}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <CircleX
                                      size={10}
                                    />
                                  )}

                                  {isRejecting
                                    ? "..."
                                    : "Reject"}

                                </button>

                              </div>
                            ) : (
                              <span className="text-[10px] font-medium text-[#C0CCD3]">
                                —
                              </span>
                            )}

                          </td>

                        </tr>
                      );
                    }
                  )
                )}

              </tbody>

            </table>

          </div>

          {/* TABLE FOOTER */}

          {!loading &&
            !loadingUser &&
            filteredTransactions.length >
              0 && (
              <div className="flex flex-col gap-3 border-t border-[#DCE8EF] bg-[#F7FAFC] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between lg:px-6">

                <div className="flex items-center gap-2">

                  <div className="h-2 w-2 rounded-full bg-[#0066B3]" />

                  <span className="text-[8px] font-medium text-[#718B9C]">
                    Data transaksi berdasarkan tanggal transaksi
                    <span className="font-bold text-[#4D6677]">
                      {" "}
                      (trxDate)
                    </span>
                  </span>

                </div>

                <div className="flex items-center gap-4 text-[8px]">

                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#087A56]" />
                    <span className="font-semibold text-[#718B9C]">
                      Masuk
                    </span>
                  </span>

                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#C62828]" />
                    <span className="font-semibold text-[#718B9C]">
                      Keluar
                    </span>
                  </span>

                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#0066B3]" />
                    <span className="font-semibold text-[#718B9C]">
                      Pending
                    </span>
                  </span>

                </div>

              </div>
            )}

        </section>

      </main>

      {/* ===================================================
          MODAL TRANSAKSI KELUAR
          =================================================== */}

      {showManual && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#061F31]/60 p-4 backdrop-blur-md"
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !savingManual
            ) {
              setShowManual(false);
            }
          }}
        >

          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_30px_100px_rgba(0,30,50,0.30)]">

            {/* MODAL HEADER */}

            <div className="relative overflow-hidden border-b border-[#D9E6ED] bg-gradient-to-br from-[#F1F8FC] via-white to-[#F8FBFD] px-6 py-5">

              <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[#0066B3]/[0.04]" />

              <div className="relative flex items-center justify-between">

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF5FB] text-[#0066B3] shadow-sm">
                    <ArrowUpRight size={19} />
                  </div>

                  <div>

                    <h2 className="text-[16px] font-extrabold tracking-tight text-[#123B5D]">
                      Transaksi Keluar
                    </h2>

                    <p className="mt-0.5 text-[9px] font-medium text-[#8297A4]">
                      Catat pengeluaran Petty Cash
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  disabled={savingManual}
                  onClick={() =>
                    setShowManual(false)
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[#8FA2AF] transition hover:bg-[#EDF4F8] hover:text-[#425766] disabled:opacity-50"
                >
                  <X size={17} />
                </button>

              </div>

            </div>

            {/* MODAL BODY */}

            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">

              {/* LOCATION */}

              <div>

                <label className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#657B8A]">
                  Rekening / Lokasi
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-[#D2E1E9] bg-[#F5F9FC] px-3.5 py-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#0066B3] shadow-sm">

                    {selectedLocationId ===
                    null ? (
                      <Landmark size={15} />
                    ) : (
                      <Building2 size={15} />
                    )}

                  </div>

                  <div>

                    <div className="text-[10px] font-extrabold text-[#315A78]">
                      {userLocationLabel}
                    </div>

                    <div className="mt-0.5 text-[8px] text-[#8B9EA9]">
                      Rekening yang akan digunakan
                    </div>

                  </div>

                </div>

              </div>

              {/* TYPE */}

              <div>

                <label className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#657B8A]">
                  Jenis Mutasi
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-[#CBE0EB] bg-[#F0F8FC] px-3.5 py-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#0066B3] shadow-sm">
                    <ArrowUpRight size={15} />
                  </div>

                  <div>

                    <div className="text-[10px] font-extrabold text-[#0066B3]">
                      KELUAR
                    </div>

                    <div className="mt-0.5 text-[8px] text-[#78909F]">
                      Saldo berkurang setelah transaksi di-approve
                    </div>

                  </div>

                </div>

              </div>

              {/* CATEGORY */}

              <div>

                <label className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#657B8A]">
                  Kategori
                </label>

                <div className="relative">

                  <select
                    value={
                      manualCategory
                    }
                    onChange={(e) =>
                      setManualCategory(
                        e.target.value
                      )
                    }
                    className="h-11 w-full appearance-none rounded-xl border border-[#D0E0E8] bg-white px-3.5 pr-10 text-[10px] font-semibold text-[#465B69] outline-none transition focus:border-[#0066B3] focus:ring-4 focus:ring-[#0066B3]/10"
                  >

                    <option value="LALAMOVE">
                      LALAMOVE
                    </option>

                    <option value="OPERASIONAL">
                      OPERASIONAL
                    </option>

                    <option value="TRANSPORTASI">
                      TRANSPORTASI
                    </option>

                    <option value="ATK">
                      ATK
                    </option>

                    <option value="KAS KECIL">
                      KAS KECIL
                    </option>

                    <option value="LAINNYA">
                      LAINNYA
                    </option>

                  </select>

                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8CA0AD]"
                  />

                </div>

              </div>

              {/* AMOUNT */}

              <div>

                <label className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#657B8A]">
                  Nominal Transaksi
                </label>

                <div className="relative">

                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-extrabold text-[#738692]">
                    Rp
                  </span>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      manualAmount
                    }
                    onChange={(e) => {
                      const raw =
                        e.target.value.replace(
                          /\D/g,
                          ""
                        );

                      setManualAmount(
                        raw
                          ? Number(
                              raw
                            ).toLocaleString(
                              "id-ID"
                            )
                          : ""
                      );
                    }}
                    placeholder="0"
                    className="h-12 w-full rounded-xl border border-[#D0E0E8] bg-white pl-10 pr-4 text-[17px] font-extrabold tracking-tight text-[#123B5D] outline-none transition placeholder:text-[#C2CDD4] focus:border-[#0066B3] focus:ring-4 focus:ring-[#0066B3]/10"
                  />

                </div>

                {manualAmount && (
                  <div className="mt-1.5 text-[8px] font-medium text-[#8297A4]">
                    Nilai transaksi:{" "}
                    <span className="font-bold text-[#0066B3]">
                      Rp{" "}
                      {formatRupiah(
                        parseRupiah(
                          manualAmount
                        )
                      )}
                    </span>
                  </div>
                )}

              </div>

              {/* DATE + REFERENCE */}

              <div className="grid gap-4 sm:grid-cols-2">

                <div>

                  <label className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#657B8A]">
                    Tanggal Transaksi
                  </label>

                  <div className="relative">

                    <CalendarDays
                      size={14}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8CA0AD]"
                    />

                    <input
                      type="date"
                      value={
                        manualDate
                      }
                      onChange={(e) =>
                        setManualDate(
                          e.target.value
                        )
                      }
                      className="h-11 w-full rounded-xl border border-[#D0E0E8] bg-white pl-10 pr-3 text-[10px] font-semibold text-[#465B69] outline-none transition focus:border-[#0066B3] focus:ring-4 focus:ring-[#0066B3]/10"
                    />

                  </div>

                  <p className="mt-1.5 text-[8px] text-[#91A1AC]">
                    Tanggal ini disimpan sebagai tanggal transaksi.
                  </p>

                </div>

                <div>

                  <label className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#657B8A]">
                    Nomor Referensi
                  </label>

                  <input
                    type="text"
                    value={
                      manualReference
                    }
                    onChange={(e) =>
                      setManualReference(
                        e.target.value
                      )
                    }
                    placeholder="Contoh: LLMV-001"
                    className="h-11 w-full rounded-xl border border-[#D0E0E8] bg-white px-3.5 text-[10px] font-medium text-[#465B69] outline-none transition focus:border-[#0066B3] focus:ring-4 focus:ring-[#0066B3]/10"
                  />

                </div>

              </div>

              {/* DESCRIPTION */}

              <div>

                <label className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#657B8A]">
                  Keterangan
                </label>

                <textarea
                  value={
                    manualDescription
                  }
                  onChange={(e) =>
                    setManualDescription(
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder={
                    manualCategory ===
                    "LALAMOVE"
                      ? "Contoh: Ongkir Lalamove pengiriman barang..."
                      : "Keterangan transaksi..."
                  }
                  className="w-full resize-none rounded-xl border border-[#D0E0E8] bg-white px-3.5 py-3 text-[10px] font-medium leading-5 text-[#465B69] outline-none transition placeholder:text-[#A3B1BA] focus:border-[#0066B3] focus:ring-4 focus:ring-[#0066B3]/10"
                />

              </div>

              {/* INFO */}

              <div className="flex gap-3 rounded-xl border border-[#CDE1EC] bg-gradient-to-r from-[#EFF8FC] to-[#F8FBFD] px-4 py-3.5">

                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[#0066B3] shadow-sm">
                  <Clock3 size={13} />
                </div>

                <div className="text-[9px] leading-5 text-[#637B8B]">

                  <span className="font-extrabold text-[#0066B3]">
                    Menunggu approval.
                  </span>{" "}
                  Transaksi ini akan dibuat sebagai{" "}
                  <span className="font-bold text-[#17618B]">
                    KELUAR / PENDING
                  </span>
                  . Saldo Petty Cash belum berubah sampai transaksi disetujui.

                </div>

              </div>

            </div>

            {/* MODAL FOOTER */}

            <div className="flex flex-col-reverse gap-2 border-t border-[#D9E6ED] bg-[#F7FAFC] px-6 py-4 sm:flex-row sm:justify-end">

              <button
                type="button"
                disabled={
                  savingManual
                }
                onClick={() =>
                  setShowManual(
                    false
                  )
                }
                className="h-10 rounded-xl border border-[#CBDDE7] bg-white px-5 text-[9px] font-bold text-[#687B88] transition hover:bg-[#EDF5FA] disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={
                  savingManual ||
                  !manualAmount
                }
                onClick={
                  submitManualTransaction
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0066B3] to-[#087CC1] px-5 text-[9px] font-extrabold text-white shadow-[0_7px_18px_rgba(0,102,179,0.18)] transition hover:shadow-[0_9px_22px_rgba(0,102,179,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
              >

                {savingManual ? (
                  <RefreshCw
                    size={13}
                    className="animate-spin"
                  />
                ) : (
                  <ArrowUpRight
                    size={13}
                  />
                )}

                {savingManual
                  ? "Memproses..."
                  : "Simpan Transaksi"}

              </button>

            </div>

          </div>

        </div>
      )}

      {/* ===================================================
          TOP UP MODAL
          =================================================== */}

      {showTopUp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#061F31]/60 p-4 backdrop-blur-md"
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !savingTopUp
            ) {
              setShowTopUp(false);
            }
          }}
        >

          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_30px_100px_rgba(0,30,50,0.30)]">

            {/* HEADER */}

            <div className="relative overflow-hidden border-b border-[#D9E6ED] bg-gradient-to-br from-[#EFFAF5] via-white to-[#F8FCFA] px-6 py-5">

              <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[#087A56]/[0.04]" />

              <div className="relative flex items-center justify-between">

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF8F1] text-[#087A56] shadow-sm">
                    <Wallet size={19} />
                  </div>

                  <div>

                    <h2 className="text-[16px] font-extrabold tracking-tight text-[#123B5D]">
                      Top Up Petty Cash
                    </h2>

                    <p className="mt-0.5 text-[9px] font-medium text-[#8297A4]">
                      Tambahkan saldo ke rekening Petty Cash
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  disabled={savingTopUp}
                  onClick={() =>
                    setShowTopUp(
                      false
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[#8FA2AF] transition hover:bg-[#EDF4F8] hover:text-[#425766] disabled:opacity-50"
                >
                  <X size={17} />
                </button>

              </div>

            </div>

            {/* BODY */}

            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">

              {/* LOCATION */}

              <div>

                <label className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#657B8A]">
                  Rekening / Lokasi
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-[#D2E1E9] bg-[#F5F9FC] px-3.5 py-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#087A56] shadow-sm">

                    {selectedLocationId ===
                    null ? (
                      <Landmark size={15} />
                    ) : (
                      <Building2 size={15} />
                    )}

                  </div>

                  <div>

                    <div className="text-[10px] font-extrabold text-[#315A78]">
                      {userLocationLabel}
                    </div>

                    <div className="mt-0.5 text-[8px] text-[#8B9EA9]">
                      Saldo akan ditambahkan ke rekening ini
                    </div>

                  </div>

                </div>

              </div>

              {/* AMOUNT */}

              <div>

                <label className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#657B8A]">
                  Nominal Top Up
                </label>

                <div className="relative">

                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-extrabold text-[#738692]">
                    Rp
                  </span>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      topUpAmount
                    }
                    onChange={(e) => {
                      const raw =
                        e.target.value.replace(
                          /\D/g,
                          ""
                        );

                      setTopUpAmount(
                        raw
                          ? Number(
                              raw
                            ).toLocaleString(
                              "id-ID"
                            )
                          : ""
                      );
                    }}
                    placeholder="0"
                    className="h-12 w-full rounded-xl border border-[#D0E0E8] bg-white pl-10 pr-4 text-[17px] font-extrabold tracking-tight text-[#123B5D] outline-none transition placeholder:text-[#C2CDD4] focus:border-[#087A56] focus:ring-4 focus:ring-[#087A56]/10"
                  />

                </div>

                {topUpAmount && (
                  <div className="mt-1.5 text-[8px] font-medium text-[#8297A4]">
                    Nilai top up:{" "}
                    <span className="font-bold text-[#087A56]">
                      Rp{" "}
                      {formatRupiah(
                        parseRupiah(
                          topUpAmount
                        )
                      )}
                    </span>
                  </div>
                )}

              </div>

              {/* DATE + REF */}

              <div className="grid gap-4 sm:grid-cols-2">

                <div>

                  <label className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#657B8A]">
                    Tanggal Top Up
                  </label>

                  <div className="relative">

                    <CalendarDays
                      size={14}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8CA0AD]"
                    />

                    <input
                      type="date"
                      value={
                        topUpDate
                      }
                      onChange={(e) =>
                        setTopUpDate(
                          e.target.value
                        )
                      }
                      className="h-11 w-full rounded-xl border border-[#D0E0E8] bg-white pl-10 pr-3 text-[10px] font-semibold text-[#465B69] outline-none transition focus:border-[#087A56] focus:ring-4 focus:ring-[#087A56]/10"
                    />

                  </div>

                  <p className="mt-1.5 text-[8px] text-[#91A1AC]">
                    Tanggal ini digunakan sebagai trxDate.
                  </p>

                </div>

                <div>

                  <label className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#657B8A]">
                    Nomor Referensi
                  </label>

                  <input
                    type="text"
                    value={
                      topUpReference
                    }
                    onChange={(e) =>
                      setTopUpReference(
                        e.target.value
                      )
                    }
                    placeholder="Contoh: TOPUP-001"
                    className="h-11 w-full rounded-xl border border-[#D0E0E8] bg-white px-3.5 text-[10px] font-medium text-[#465B69] outline-none transition focus:border-[#087A56] focus:ring-4 focus:ring-[#087A56]/10"
                  />

                </div>

              </div>

              {/* DESCRIPTION */}

              <div>

                <label className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#657B8A]">
                  Keterangan
                </label>

                <textarea
                  value={
                    topUpDescription
                  }
                  onChange={(e) =>
                    setTopUpDescription(
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder="Keterangan Top Up..."
                  className="w-full resize-none rounded-xl border border-[#D0E0E8] bg-white px-3.5 py-3 text-[10px] font-medium leading-5 text-[#465B69] outline-none transition placeholder:text-[#A3B1BA] focus:border-[#087A56] focus:ring-4 focus:ring-[#087A56]/10"
                />

              </div>

              {/* INFO */}

              <div className="flex gap-3 rounded-xl border border-[#CDE7DB] bg-gradient-to-r from-[#EFFBF5] to-[#F8FCFA] px-4 py-3.5">

                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[#087A56] shadow-sm">
                  <Check size={13} />
                </div>

                <div className="text-[9px] leading-5 text-[#637B70]">

                  <span className="font-extrabold text-[#087A56]">
                    Top Up langsung approved.
                  </span>{" "}
                  Transaksi akan dibuat sebagai{" "}
                  <span className="font-bold text-[#087A56]">
                    IN / APPROVED
                  </span>{" "}
                  dan menambah saldo rekening Petty Cash.

                </div>

              </div>

            </div>

            {/* FOOTER */}

            <div className="flex flex-col-reverse gap-2 border-t border-[#D9E6ED] bg-[#F7FAFC] px-6 py-4 sm:flex-row sm:justify-end">

              <button
                type="button"
                disabled={
                  savingTopUp
                }
                onClick={() =>
                  setShowTopUp(
                    false
                  )
                }
                className="h-10 rounded-xl border border-[#CBDDE7] bg-white px-5 text-[9px] font-bold text-[#687B88] transition hover:bg-[#EDF5FA] disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={
                  savingTopUp ||
                  !topUpAmount
                }
                onClick={
                  submitTopUp
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087A56] to-[#0B966B] px-5 text-[9px] font-extrabold text-white shadow-[0_7px_18px_rgba(8,122,86,0.18)] transition hover:shadow-[0_9px_22px_rgba(8,122,86,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
              >

                {savingTopUp ? (
                  <RefreshCw
                    size={13}
                    className="animate-spin"
                  />
                ) : (
                  <Plus size={13} />
                )}

                {savingTopUp
                  ? "Memproses..."
                  : "Top Up Sekarang"}

              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}