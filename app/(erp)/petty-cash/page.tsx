"use client";

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
  CircleCheck,
  CircleX,
  Clock3,
  CreditCard,
  Landmark,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Truck,
  Wallet,
  X,
  Store,
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

type PettyCashType =
  | "IN"
  | "OUT";

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
    month: "2-digit",
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
    month: "2-digit",
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
  PETTY CASH DATA
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
  LOCATION SELECTION
  =========================================================

  null
  = PUSAT

  number
  = OUTLET ID
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
  MODAL
  =========================================================
  */

  const [showManual, setShowManual] =
    useState(false);

  const [showTopUp, setShowTopUp] =
    useState(false);

  /*
  =========================================================
  MANUAL TRANSACTION
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

  const loadUser = useCallback(async () => {
    try {
      setLoadingUser(true);

      const res = await fetch(
        "/api/me",
        {
          cache: "no-store",
        }
      );

      const contentType =
        res.headers.get(
          "content-type"
        ) || "";

      if (
        !contentType.includes(
          "application/json"
        )
      ) {
        const text = await res.text();

        console.error(
          "LOAD USER NON JSON RESPONSE:",
          text
        );

        throw new Error(
          `Server mengembalikan response bukan JSON (${res.status}).`
        );
      }

      const json = await res.json();

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
    } finally {
      setLoadingUser(false);
    }
  }, []);

  /*
  =========================================================
  LOAD PETTY CASH
  =========================================================
  */

  const loadPettyCash = useCallback(
    async () => {
      try {
        setLoading(true);

        const res = await fetch(
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
    },
    []
  );

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
  SET DEFAULT LOCATION
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

  /*
  Admin Pusat boleh Top Up.
  Admin Outlet TIDAK BOLEH Top Up.
  */

  const canTopUp =
    isCentralAdmin;

  /*
  Semua user yang punya akses halaman
  boleh membuat transaksi keluar.

  API tetap wajib melakukan validasi
  outletId berdasarkan session.
  */

  const canCreateTransaction =
    Boolean(user);

  /*
  Approval hanya pusat.
  */

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

  /*
  Cari saldo dari outletBalances terlebih dahulu.
  */

  const selectedBalance =
    outletBalances.find(
      (item) =>
        item.outletId ===
        selectedLocationId
    ) ?? null;

  /*
  Fallback ke account jika outletBalances
  belum memiliki data saldo.
  */

  const selectedAccount =
    accounts.find(
      (account) =>
        account.outletId ===
        selectedLocationId
    ) ?? null;

  /*
  =========================================================
  LOCATION LABEL
  =========================================================
  */

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

  Jangan menghitung saldo dari transaksi.

  Prioritas:
  1. outletBalances.balance
  2. outletBalances.currentBalance
  3. outletBalances.saldo
  4. account.currentBalance
  5. account.balance
  6. account.saldo
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
        : 0;

  /*
  =========================================================
  FILTER TRANSACTIONS BY LOCATION
  =========================================================
  */

  const locationTransactions =
    useMemo(() => {
      return transactions.filter(
        (transaction) =>
          Number(
            transaction.outletId
          ) ===
          Number(
            selectedLocationId
          )
      );
    }, [
      transactions,
      selectedLocationId,
    ]);

  /*
  =========================================================
  SEARCH + FILTER
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

  /*
  =========================================================
  RESET FILTER
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
  OPEN MANUAL
  =========================================================
  */

  function openManualTransaction() {
    if (!user) {
      alert(
        "User belum tersedia."
      );

      return;
    }

    if (
      isOutletAdmin &&
      user.outletId == null
    ) {
      alert(
        "User outlet belum memiliki outlet."
      );

      return;
    }

    setManualCategory(
      "LALAMOVE"
    );

    setManualAmount("");

    setManualDate(
      getTodayInput()
    );

    setManualReference("");

    setManualDescription("");

    setShowManual(true);
  }

  /*
  =========================================================
  OPEN TOP UP
  =========================================================
  */

  function openTopUp() {
    if (!canTopUp) {
      alert(
        "Anda tidak memiliki akses Top Up."
      );

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
  SUBMIT TOP UP
  =========================================================

  Top Up:
  1. CREATE IN
  2. API membuat PENDING
  3. Ambil ID
  4. APPROVE
  5. Reload saldo

  API tetap wajib memastikan user adalah
  Admin Pusat dan outletId valid.
  =========================================================
  */

  async function submitTopUp() {
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

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      alert(
        "Nominal Top Up harus lebih dari 0."
      );

      return;
    }

    const outletId =
      selectedLocationId;

    try {
      setSavingTopUp(true);

      /*
      CREATE TOP UP
      */

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

              category:
                "TOP UP",

              description:
                topUpDescription.trim() ||
                `Top Up Petty Cash ${userLocationLabel}`,

              amount,

              outletId,

              referenceNumber:
                topUpReference.trim() ||
                undefined,

              trxDate:
                topUpDate ||
                undefined,
            }),
          }
        );

      const contentType =
        res.headers.get(
          "content-type"
        ) || "";

      let json: any = null;

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

        console.error(
          "TOP UP NON JSON RESPONSE:",
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
            "Gagal membuat Top Up."
        );
      }

      const createdTransaction =
        json?.data;

      const createdId =
        Number(
          createdTransaction?.id
        );

      if (
        !Number.isInteger(
          createdId
        ) ||
        createdId <= 0
      ) {
        throw new Error(
          "Top Up berhasil dibuat tetapi ID transaksi tidak ditemukan untuk proses approval."
        );
      }

      /*
      AUTO APPROVE
      */

      const approveRes =
        await fetch(
          "/api/petty-cash/approve",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              id: createdId,
              action: "APPROVE",
            }),
          }
        );

      const approveContentType =
        approveRes.headers.get(
          "content-type"
        ) || "";

      let approveJson: any =
        null;

      if (
        approveContentType.includes(
          "application/json"
        )
      ) {
        approveJson =
          await approveRes.json();
      } else {
        const text =
          await approveRes.text();

        console.error(
          "TOP UP APPROVE NON JSON RESPONSE:",
          text
        );

        throw new Error(
          `Top Up berhasil dibuat tetapi response approval bukan JSON (${approveRes.status}).`
        );
      }

      if (
        !approveRes.ok ||
        approveJson?.success ===
          false
      ) {
        throw new Error(
          approveJson?.message ||
            approveJson?.error ||
            "Top Up berhasil dibuat tetapi gagal di-approve."
        );
      }

      setShowTopUp(false);

      await loadPettyCash();

      alert(
        "Petty Cash berhasil di-Top Up dan langsung APPROVED."
      );
    } catch (error) {
      console.error(
        "TOP UP PETTY CASH ERROR:",
        error
      );

      await loadPettyCash();

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
  MANUAL TRANSACTION
  =========================================================

  Manual selalu OUT.
  Status awal mengikuti API:
  PENDING.
  =========================================================
  */

  async function submitManualTransaction() {
    if (!user) {
      alert(
        "User belum tersedia."
      );

      return;
    }

    const amount =
      parseRupiah(
        manualAmount
      );

    const category =
      manualCategory.trim();

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      alert(
        "Nominal transaksi harus lebih dari 0."
      );

      return;
    }

    if (!category) {
      alert(
        "Kategori wajib diisi."
      );

      return;
    }

    if (
      isOutletAdmin &&
      user.outletId == null
    ) {
      alert(
        "User outlet belum memiliki outlet."
      );

      return;
    }

    let description =
      manualDescription.trim();

    if (
      manualCategory ===
        "LALAMOVE" &&
      !description
    ) {
      description =
        "Pembayaran ongkir Lalamove";
    }

    /*
    Admin pusat:
    lokasi mengikuti dropdown.

    Admin outlet:
    API wajib memaksa outlet
    dari session.
    */

    const outletId =
      selectedLocationId;

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

              category,

              description:
                description ||
                undefined,

              amount,

              outletId,

              referenceNumber:
                manualReference.trim() ||
                undefined,

              trxDate:
                manualDate ||
                undefined,
            }),
          }
        );

      const contentType =
        res.headers.get(
          "content-type"
        ) || "";

      let json: any = null;

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
            "Gagal membuat transaksi Petty Cash."
        );
      }

      setShowManual(false);

      await loadPettyCash();

      alert(
        "Transaksi keluar berhasil dibuat dan menunggu approval."
      );
    } catch (error) {
      console.error(
        "MANUAL PETTY CASH ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Gagal membuat transaksi Petty Cash."
      );
    } finally {
      setSavingManual(false);
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
    if (!canApprove) {
      alert(
        "Anda tidak memiliki akses approval."
      );

      return;
    }

    if (
      transaction.status !==
      "PENDING"
    ) {
      alert(
        "Transaksi ini sudah tidak berstatus PENDING."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Approve transaksi ${transaction.number} sebesar Rp ${formatRupiah(
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
          "/api/petty-cash/approve",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              id: transaction.id,
              action: "APPROVE",
            }),
          }
        );

      const contentType =
        res.headers.get(
          "content-type"
        ) || "";

      let json: any = null;

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

        console.error(
          "APPROVE NON JSON RESPONSE:",
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

      await loadPettyCash();

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
    if (!canApprove) {
      alert(
        "Anda tidak memiliki akses approval."
      );

      return;
    }

    if (
      transaction.status !==
      "PENDING"
    ) {
      alert(
        "Transaksi ini sudah tidak berstatus PENDING."
      );

      return;
    }

    const reason =
      window.prompt(
        "Alasan Reject transaksi:"
      );

    if (reason === null) {
      return;
    }

    try {
      setRejectingId(
        transaction.id
      );

      const res =
        await fetch(
          "/api/petty-cash/approve",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              id: transaction.id,

              action: "REJECT",

              reason:
                reason.trim() ||
                undefined,
            }),
          }
        );

      const contentType =
        res.headers.get(
          "content-type"
        ) || "";

      let json: any = null;

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

        console.error(
          "REJECT NON JSON RESPONSE:",
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

      await loadPettyCash();

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
  STATUS BADGE
  =========================================================
  */

  function StatusBadge({
    status,
  }: {
    status?: string;
  }) {
    if (
      status ===
      "APPROVED"
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B7D9EE] bg-[#EEF7FD] px-2.5 py-1 text-[9px] font-bold tracking-wide text-[#0066B3]">
          <CircleCheck
            size={11}
          />
          APPROVED
        </span>
      );
    }

    if (
      status ===
      "PENDING"
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B9D8EB] bg-[#F1F8FC] px-2.5 py-1 text-[9px] font-bold tracking-wide text-[#17618B]">
          <Clock3
            size={11}
          />
          PENDING
        </span>
      );
    }

    if (
      status ===
      "REJECTED"
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F0C5C5] bg-[#FFF5F5] px-2.5 py-1 text-[9px] font-bold tracking-wide text-[#C62828]">
          <CircleX
            size={11}
          />
          REJECTED
        </span>
      );
    }

    return (
      <span className="inline-flex rounded-full bg-[#EEF4F8] px-2.5 py-1 text-[9px] font-bold text-[#58768B]">
        {status || "-"}
      </span>
    );
  }

  /*
  =========================================================
  RENDER
  =========================================================
  */

  return (
    <div className="min-h-full bg-[#F2F7FB] text-[#172B3A]">

      {/* ===================================================
          HEADER
          =================================================== */}

      <div className="border-b border-[#D2E1EC] bg-white">

        <div className="px-5 py-5 lg:px-8">

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0066B3] text-white shadow-[0_4px_12px_rgba(0,102,179,0.20)]">
                <Wallet size={21} />
              </div>

              <div>

                <div className="flex items-center gap-2">

                  <h1 className="text-[22px] font-bold tracking-[-0.025em] text-[#123B5D]">
                    Petty Cash
                  </h1>

                  <span className="hidden rounded-full bg-[#E8F3FA] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#0066B3] sm:inline-flex">
                    Cash Management
                  </span>

                </div>

                <p className="mt-0.5 text-xs text-[#728494]">
                  Rekening koran dan mutasi Petty Cash
                </p>

              </div>

            </div>

            <div className="flex flex-wrap items-center gap-2">

              {/* LOCATION SELECTOR */}

              <div className="flex items-center gap-2 rounded-lg border border-[#D4E3ED] bg-[#F3F8FC] px-3 py-1.5">

                {selectedLocationId ===
                null ? (
                  <Landmark
                    size={15}
                    className="text-[#0066B3]"
                  />
                ) : (
                  <Store
                    size={15}
                    className="text-[#0066B3]"
                  />
                )}

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
                      onChange={(e) => {
                        const value =
                          e.target
                            .value;

                        if (
                          value ===
                          "PUSAT"
                        ) {
                          setSelectedLocationId(
                            null
                          );
                        } else {
                          const outletId =
                            Number(
                              value
                            );

                          if (
                            Number.isInteger(
                              outletId
                            )
                          ) {
                            setSelectedLocationId(
                              outletId
                            );
                          }
                        }

                        resetFilter();
                      }}
                      className="h-7 min-w-[180px] appearance-none bg-transparent pr-6 text-xs font-bold text-[#315A78] outline-none"
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
                    <span className="text-xs font-bold text-[#315A78]">
                      {userLocationLabel}
                    </span>
                  )}

                  {isCentralAdmin && (
                    <ChevronDown
                      size={13}
                      className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[#7896AA]"
                    />
                  )}

                </div>

              </div>

              <button
                type="button"
                onClick={
                  loadPettyCash
                }
                disabled={
                  loading
                }
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#C9DCE9] bg-white px-3.5 text-xs font-bold text-[#315A78] shadow-sm transition hover:border-[#8FB9D3] hover:bg-[#F2F8FC] disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0066B3] px-3.5 text-xs font-bold text-white shadow-[0_3px_8px_rgba(0,102,179,0.18)] transition hover:bg-[#005596]"
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
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#087A56] px-3.5 text-xs font-bold text-white shadow-[0_3px_8px_rgba(8,122,86,0.18)] transition hover:bg-[#066646]"
                >
                  <Plus size={15} />
                  Top Up
                </button>
              )}

            </div>

          </div>

        </div>

      </div>

      {/* ===================================================
          SUMMARY
          =================================================== */}

      <div className="px-5 py-5 lg:px-8">

        <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr_1fr_1fr]">

          {/* SALDO */}

          <div className="relative overflow-hidden rounded-xl bg-[#0066B3] p-5 text-white shadow-[0_8px_25px_rgba(0,73,128,0.16)]">

            <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full border-[24px] border-white/5" />

            <div className="absolute -bottom-20 right-12 h-40 w-40 rounded-full border-[20px] border-white/5" />

            <div className="relative">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-2">

                  <CreditCard
                    size={16}
                    className="text-blue-100"
                  />

                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-100">
                    Saldo Tersedia
                  </span>

                </div>

                <MoreHorizontal
                  size={18}
                  className="text-blue-100"
                />

              </div>

              <div className="mt-3">

                <div className="text-[11px] text-blue-100">
                  {selectedLocationId ===
                  null
                    ? "Petty Cash Pusat"
                    : "Petty Cash Outlet"}
                </div>

                <div className="mt-1 text-[29px] font-bold tracking-[-0.03em]">
                  Rp{" "}
                  {formatRupiah(
                    pettyCashBalance
                  )}
                </div>

              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3">

                <span className="text-[10px] text-blue-100">
                  Lokasi
                </span>

                <span className="text-right text-[10px] font-bold">
                  {userLocationLabel}
                </span>

              </div>

            </div>

          </div>

          {/* TOTAL MASUK */}

          <div className="rounded-xl border border-[#CFE0EB] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718899]">
                Total Masuk
              </span>

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF5FB] text-[#0066B3]">
                <ArrowDownLeft
                  size={16}
                />
              </div>

            </div>

            <div className="mt-4 text-[21px] font-bold tracking-tight text-[#123B5D]">
              Rp{" "}
              {formatRupiah(
                totalApprovedIn
              )}
            </div>

            <p className="mt-1 text-[10px] text-[#91A0AB]">
              Total transaksi approved
            </p>

          </div>

          {/* TOTAL KELUAR */}

          <div className="rounded-xl border border-[#CFE0EB] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718899]">
                Total Keluar
              </span>

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF5FA] text-[#0066B3]">
                <ArrowUpRight
                  size={16}
                />
              </div>

            </div>

            <div className="mt-4 text-[21px] font-bold tracking-tight text-[#123B5D]">
              Rp{" "}
              {formatRupiah(
                totalApprovedOut
              )}
            </div>

            <p className="mt-1 text-[10px] text-[#91A0AB]">
              Total transaksi approved
            </p>

          </div>

          {/* PENDING */}

          <div className="rounded-xl border border-[#CFE0EB] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718899]">
                Menunggu Approval
              </span>

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3FA] text-[#0066B3]">
                <Clock3 size={16} />
              </div>

            </div>

            <div className="mt-4 text-[25px] font-bold tracking-tight text-[#123B5D]">
              {pendingCount}
            </div>

            <p className="mt-1 text-[10px] text-[#91A0AB]">
              Transaksi pending
            </p>

          </div>

        </div>

        {/* =================================================
            REKENING KORAN
            ================================================= */}

        <div className="mt-5 overflow-hidden rounded-xl border border-[#BFD5E3] bg-white shadow-[0_4px_18px_rgba(22,75,110,0.07)]">

          {/* HEADER */}

          <div className="border-b border-[#C8DCE9] bg-gradient-to-r from-[#F1F7FB] via-white to-[#F5F9FC] px-5 py-4">

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0066B3] text-white shadow-sm">
                    <CreditCard
                      size={13}
                    />
                  </div>

                  <h2 className="text-[15px] font-bold tracking-[-0.01em] text-[#123B5D]">
                    Rekening Koran
                  </h2>

                  <span className="rounded-full border border-[#BFD9EA] bg-[#EAF5FB] px-2.5 py-1 text-[9px] font-bold text-[#0066B3]">
                    {
                      filteredTransactions.length
                    }{" "}
                    MUTASI
                  </span>

                </div>

                <p className="mt-1 pl-9 text-[10px] text-[#82919D]">
                  Riwayat transaksi dan saldo Petty Cash
                </p>

              </div>

              <div className="flex items-center gap-2">

                <div className="hidden items-center gap-1.5 text-[10px] font-medium text-[#668196] sm:flex">
                  <SlidersHorizontal
                    size={13}
                    className="text-[#0066B3]"
                  />
                  Filter mutasi
                </div>

              </div>

            </div>

            {/* FILTER */}

            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]">

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
                  placeholder="Cari transaksi, nomor, keterangan..."
                  className="h-9 w-full rounded-lg border border-[#C9DCE8] bg-[#F4F9FC] pl-9 pr-3 text-xs text-[#344B5B] outline-none transition placeholder:text-[#91A6B5] focus:border-[#0066B3] focus:bg-white focus:ring-2 focus:ring-[#0066B3]/10"
                />

              </div>

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
                  className="h-9 w-full appearance-none rounded-lg border border-[#C9DCE8] bg-[#F4F9FC] px-3 pr-8 text-xs font-medium text-[#4D6271] outline-none focus:border-[#0066B3] focus:bg-white"
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
                  size={13}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7896AA]"
                />

              </div>

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
                  className="h-9 w-full rounded-lg border border-[#C9DCE8] bg-[#F4F9FC] pl-8 pr-2 text-xs text-[#4D6271] outline-none focus:border-[#0066B3] focus:bg-white"
                />

              </div>

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
                  className="h-9 w-full rounded-lg border border-[#C9DCE8] bg-[#F4F9FC] pl-8 pr-2 text-xs text-[#4D6271] outline-none focus:border-[#0066B3] focus:bg-white"
                />

              </div>

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
                  className="h-9 rounded-lg border border-[#BFD7E5] bg-white px-3 text-[10px] font-bold text-[#0066B3] transition hover:bg-[#EAF5FB]"
                >
                  Reset
                </button>
              ) : (
                <div className="hidden xl:block" />
              )}

            </div>

          </div>

          {/* LOCATION BAR */}

          <div className="flex flex-col gap-2 border-b border-[#CFE0EA] bg-[#EDF5FA] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-2">

              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#C5DCEB] bg-white text-[#0066B3] shadow-sm">

                {selectedLocationId ===
                null ? (
                  <Landmark
                    size={13}
                  />
                ) : (
                  <Building2
                    size={13}
                  />
                )}

              </div>

              <div>

                <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#7890A0]">
                  Rekening / Lokasi
                </div>

                <div className="text-[10px] font-bold text-[#245675]">
                  {userLocationLabel}
                </div>

              </div>

            </div>

            <div className="text-[10px] text-[#7890A0]">

              Menampilkan{" "}

              <span className="font-bold text-[#0066B3]">
                {
                  filteredTransactions.length
                }
              </span>{" "}

              transaksi

            </div>

          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">

            <table className="min-w-[1160px] w-full border-collapse">

              <thead>

                <tr className="border-b border-[#9FC0D5] bg-[#DDECF5]">

                  <th className="w-[55px] border-r border-[#C5DBE8] px-4 py-3 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-[#365D75]">
                    No
                  </th>

                  <th className="w-[115px] border-r border-[#C5DBE8] px-4 py-3 text-left text-[9px] font-bold uppercase tracking-[0.08em] text-[#365D75]">
                    Tanggal
                  </th>

                  <th className="w-[165px] border-r border-[#C5DBE8] px-4 py-3 text-left text-[9px] font-bold uppercase tracking-[0.08em] text-[#365D75]">
                    Nomor Transaksi
                  </th>

                  <th className="min-w-[270px] border-r border-[#C5DBE8] px-4 py-3 text-left text-[9px] font-bold uppercase tracking-[0.08em] text-[#365D75]">
                    Keterangan
                  </th>

                  <th className="w-[130px] border-r border-[#C5DBE8] px-4 py-3 text-left text-[9px] font-bold uppercase tracking-[0.08em] text-[#365D75]">
                    Kategori
                  </th>

                  <th className="w-[155px] border-r border-[#C5DBE8] px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.08em] text-[#365D75]">
                    Debet
                  </th>

                  <th className="w-[155px] border-r border-[#C5DBE8] px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.08em] text-[#365D75]">
                    Kredit
                  </th>

                  <th className="w-[165px] border-r border-[#C5DBE8] px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.08em] text-[#365D75]">
                    Saldo
                  </th>

                  <th className="w-[115px] border-r border-[#C5DBE8] px-4 py-3 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-[#365D75]">
                    Status
                  </th>

                  <th className="w-[150px] px-4 py-3 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-[#365D75]">
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
                      className="px-4 py-20 text-center"
                    >

                      <div className="flex flex-col items-center">

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E5F1F8] text-[#0066B3]">

                          <RefreshCw
                            size={18}
                            className="animate-spin"
                          />

                        </div>

                        <p className="mt-3 text-xs font-bold text-[#42647A]">
                          Memuat rekening koran...
                        </p>

                        <p className="mt-1 text-[10px] text-[#8DA1AF]">
                          Mohon tunggu sebentar
                        </p>

                      </div>

                    </td>

                  </tr>
                ) : filteredTransactions.length ===
                  0 ? (
                  <tr>

                    <td
                      colSpan={10}
                      className="px-4 py-20 text-center"
                    >

                      <div className="flex flex-col items-center">

                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF3F8] text-[#7191A5]">
                          <Wallet
                            size={20}
                          />
                        </div>

                        <p className="mt-3 text-xs font-bold text-[#536F82]">
                          Belum ada mutasi
                        </p>

                        <p className="mt-1 max-w-sm text-[10px] leading-5 text-[#91A3AE]">
                          Transaksi Petty Cash yang
                          sesuai dengan filter akan
                          ditampilkan di rekening koran.
                        </p>

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

                      return (
                        <tr
                          key={
                            transaction.id
                          }
                          className={
                            "group border-b border-[#DCE8EF] transition-colors " +
                            (isPending
                              ? "bg-[#F5FAFD] hover:bg-[#EAF5FB]"
                              : index %
                                    2 ===
                                  0
                                ? "bg-white hover:bg-[#F0F7FB]"
                                : "bg-[#F8FBFD] hover:bg-[#EDF5FA]")
                          }
                        >

                          <td className="border-r border-[#E1EBF1] px-4 py-3.5 text-center align-middle">
                            <span className="text-[10px] font-semibold text-[#7692A4]">
                              {index + 1}
                            </span>
                          </td>

                          <td className="whitespace-nowrap border-r border-[#E1EBF1] px-4 py-3.5 align-middle">
                            <div className="text-[10px] font-bold text-[#365A70]">
                              {formatDateOnly(
                                transaction.trxDate
                              )}
                            </div>

                            <div className="mt-0.5 text-[9px] text-[#8EA2AF]">
                              {formatDateTime(
                                transaction.trxDate
                              )
                                .split(" ")
                                .slice(1)
                                .join(" ")}
                            </div>
                          </td>

                          <td className="border-r border-[#E1EBF1] px-4 py-3.5 align-middle">
                            <div className="text-[10px] font-bold text-[#0066B3]">
                              {transaction.number ||
                                "-"}
                            </div>

                            {transaction.referenceNumber && (
                              <div className="mt-1 text-[8px] text-[#8EA2AF]">
                                Ref.{" "}
                                {
                                  transaction.referenceNumber
                                }
                              </div>
                            )}

                            {transaction.paymentId && (
                              <div className="mt-1 text-[8px] font-medium text-[#7B919F]">
                                Payment #
                                {
                                  transaction.paymentId
                                }
                              </div>
                            )}
                          </td>

                          <td className="max-w-[330px] border-r border-[#E1EBF1] px-4 py-3.5 align-middle">
                            <div className="flex items-center gap-2.5">

                              <div
                                className={
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border " +
                                  (moneyIn
                                    ? "border-[#BFDDEB] bg-[#EAF6FB] text-[#0066B3]"
                                    : "border-[#D3E1E9] bg-[#F0F6FA] text-[#48728C]")
                                }
                              >
                                {moneyIn ? (
                                  <ArrowDownLeft
                                    size={13}
                                  />
                                ) : (
                                  <ArrowUpRight
                                    size={13}
                                  />
                                )}
                              </div>

                              <div className="min-w-0">

                                <div className="truncate text-[10px] font-semibold text-[#354D5C]">
                                  {transaction.description ||
                                    "-"}
                                </div>

                                {transaction.outlet && (
                                  <div className="mt-0.5 truncate text-[8px] text-[#8EA2AF]">
                                    {
                                      transaction.outlet
                                        .code
                                    }{" "}
                                    •{" "}
                                    {
                                      transaction.outlet
                                        .name
                                    }
                                  </div>
                                )}

                              </div>

                            </div>
                          </td>

                          <td className="border-r border-[#E1EBF1] px-4 py-3.5 align-middle">

                            {transaction.category ===
                            "LALAMOVE" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-md border border-[#BFD9E8] bg-[#EAF4FA] px-2 py-1 text-[8px] font-bold tracking-wide text-[#0066B3]">
                                <Truck
                                  size={10}
                                />
                                LALAMOVE
                              </span>
                            ) : (
                              <span className="text-[9px] font-semibold text-[#617C8E]">
                                {transaction.category ||
                                  "-"}
                              </span>
                            )}

                          </td>

                          {/* DEBET / OUT */}

                          <td className="border-r border-[#E1EBF1] px-4 py-3.5 text-right align-middle">

                            {!moneyIn ? (
                              transaction.status ===
                              "APPROVED" ? (
                                <span className="font-bold tabular-nums text-[#C62828]">
                                  Rp{" "}
                                  {formatRupiah(
                                    transaction.amount
                                  )}
                                </span>
                              ) : (
                                <span className="font-semibold tabular-nums text-[#9AAEBB]">
                                  Rp{" "}
                                  {formatRupiah(
                                    transaction.amount
                                  )}
                                </span>
                              )
                            ) : (
                              <span className="text-[#C3D0D8]">
                                —
                              </span>
                            )}

                          </td>

                          {/* KREDIT / IN */}

                          <td className="border-r border-[#E1EBF1] px-4 py-3.5 text-right align-middle">

                            {moneyIn ? (
                              transaction.status ===
                              "APPROVED" ? (
                                <span className="font-bold tabular-nums text-[#0066B3]">
                                  Rp{" "}
                                  {formatRupiah(
                                    transaction.amount
                                  )}
                                </span>
                              ) : (
                                <span className="font-semibold tabular-nums text-[#9AAEBB]">
                                  Rp{" "}
                                  {formatRupiah(
                                    transaction.amount
                                  )}
                                </span>
                              )
                            ) : (
                              <span className="text-[#C3D0D8]">
                                —
                              </span>
                            )}

                          </td>

                          {/* SALDO */}

                          <td className="border-r border-[#E1EBF1] px-4 py-3.5 text-right align-middle">

                            {transaction.status ===
                            "APPROVED" ? (
                              <span className="font-bold tabular-nums text-[#173D59]">
                                Rp{" "}
                                {formatRupiah(
                                  transaction.balanceAfter
                                )}
                              </span>
                            ) : (
                              <span className="text-[9px] font-semibold text-[#9EAFBA]">
                                Belum diposting
                              </span>
                            )}

                          </td>

                          {/* STATUS */}

                          <td className="border-r border-[#E1EBF1] px-4 py-3.5 text-center align-middle">

                            <StatusBadge
                              status={
                                transaction.status
                              }
                            />

                          </td>

                          {/* AKSI */}

                          <td className="px-4 py-3.5 text-center align-middle">

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
                                  className="inline-flex h-7 items-center gap-1 rounded-md bg-[#0066B3] px-2.5 text-[8px] font-bold text-white shadow-sm transition hover:bg-[#005596] disabled:cursor-not-allowed disabled:opacity-50"
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
                                  className="inline-flex h-7 items-center gap-1 rounded-md border border-[#C7DCE8] bg-white px-2.5 text-[8px] font-bold text-[#C62828] transition hover:bg-[#FFF5F5] disabled:cursor-not-allowed disabled:opacity-50"
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
                              <span className="text-[10px] text-[#B8C7D0]">
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

          {/* FOOTER */}

          {!loading &&
            !loadingUser &&
            filteredTransactions.length >
              0 && (
              <div className="flex flex-col gap-2 border-t border-[#C9DDE9] bg-[#EDF5FA] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">

                <div className="text-[9px] text-[#718B9C]">
                  Rekening koran Petty Cash
                </div>

                <div className="flex items-center gap-4 text-[9px]">

                  <span className="flex items-center gap-1.5">

                    <span className="h-2 w-2 rounded-full bg-[#0066B3]" />

                    <span className="text-[#647D8D]">
                      Kredit / Masuk
                    </span>

                  </span>

                  <span className="flex items-center gap-1.5">

                    <span className="h-2 w-2 rounded-full bg-[#C62828]" />

                    <span className="text-[#647D8D]">
                      Debet / Keluar
                    </span>

                  </span>

                </div>

              </div>
            )}

        </div>

      </div>

      {/* ===================================================
          MANUAL TRANSACTION MODAL
          =================================================== */}

      {showManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061F31]/50 p-4 backdrop-blur-sm">

          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/50 bg-white shadow-[0_25px_80px_rgba(0,30,50,0.25)]">

            <div className="flex items-center justify-between border-b border-[#D7E4EC] bg-[#EDF5FA] px-5 py-4">

              <div>

                <div className="flex items-center gap-2">

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#DDECF5] text-[#0066B3]">
                    <ArrowUpRight
                      size={15}
                    />
                  </div>

                  <h2 className="text-[15px] font-bold text-[#123B5D]">
                    Transaksi Keluar
                  </h2>

                </div>

                <p className="mt-1 pl-10 text-[10px] text-[#78909F]">
                  Tambahkan pengeluaran Petty Cash
                </p>

              </div>

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
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8FA2AF] transition hover:bg-white hover:text-[#425766]"
              >
                <X size={17} />
              </button>

            </div>

            <div className="space-y-4 p-5">

              {/* LOKASI */}

              <div>

                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#647A89]">
                  Rekening / Lokasi
                </label>

                <div className="flex items-center gap-2 rounded-lg border border-[#C9DCE8] bg-[#F1F7FB] px-3 py-2.5 text-xs font-bold text-[#315A78]">

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

              </div>

              {/* JENIS */}

              <div>

                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#647A89]">
                  Jenis Mutasi
                </label>

                <div className="flex items-center gap-2 rounded-lg border border-[#BFD9E8] bg-[#EAF4FA] px-3 py-2.5">

                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[#0066B3] shadow-sm">
                    <ArrowUpRight
                      size={14}
                    />
                  </div>

                  <div>

                    <div className="text-xs font-bold text-[#0066B3]">
                      KELUAR
                    </div>

                    <div className="text-[9px] text-[#78909F]">
                      Mengurangi saldo Petty Cash setelah approval
                    </div>

                  </div>

                </div>

              </div>

              {/* KATEGORI */}

              <div>

                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#647A89]">
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
                    className="h-10 w-full appearance-none rounded-lg border border-[#C9DCE8] bg-white px-3 pr-9 text-xs text-[#465B69] outline-none focus:border-[#0066B3] focus:ring-2 focus:ring-[#0066B3]/10"
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
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8CA0AD]"
                  />

                </div>

              </div>

              {/* NOMINAL */}

              <div>

                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#647A89]">
                  Nominal
                </label>

                <div className="relative">

                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7A8994]">
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
                    className="h-10 w-full rounded-lg border border-[#C9DCE8] bg-white pl-10 pr-3 text-sm font-bold text-[#123B5D] outline-none focus:border-[#0066B3] focus:ring-2 focus:ring-[#0066B3]/10"
                  />

                </div>

              </div>

              {/* TANGGAL + REFERENSI */}

              <div className="grid gap-3 sm:grid-cols-2">

                <div>

                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#647A89]">
                    Tanggal
                  </label>

                  <div className="relative">

                    <CalendarDays
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8CA0AD]"
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
                      className="h-10 w-full rounded-lg border border-[#C9DCE8] bg-white pl-9 pr-2 text-xs text-[#465B69] outline-none focus:border-[#0066B3]"
                    />

                  </div>

                </div>

                <div>

                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#647A89]">
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
                    className="h-10 w-full rounded-lg border border-[#C9DCE8] bg-white px-3 text-xs text-[#465B69] outline-none focus:border-[#0066B3]"
                  />

                </div>

              </div>

              {/* KETERANGAN */}

              <div>

                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#647A89]">
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
                  className="w-full resize-none rounded-lg border border-[#C9DCE8] bg-white px-3 py-2.5 text-xs text-[#465B69] outline-none focus:border-[#0066B3] focus:ring-2 focus:ring-[#0066B3]/10"
                />

              </div>

              {/* INFO */}

              <div className="rounded-lg border border-[#C4DDEB] bg-[#EFF7FB] px-3 py-2.5 text-[10px] leading-5 text-[#617B8C]">

                <span className="font-bold text-[#0066B3]">
                  Informasi:
                </span>{" "}
                transaksi ini merupakan{" "}
                <span className="font-bold text-[#17618B]">
                  KELUAR
                </span>{" "}
                dan akan masuk ke status{" "}
                <span className="font-bold text-[#17618B]">
                  PENDING
                </span>
                . Saldo belum berkurang sebelum approval.

              </div>

            </div>

            <div className="flex justify-end gap-2 border-t border-[#D7E4EC] bg-[#F4F8FB] px-5 py-4">

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
                className="h-9 rounded-lg border border-[#C9DCE8] bg-white px-4 text-xs font-bold text-[#687B88] transition hover:bg-[#EDF5FA] disabled:opacity-50"
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
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0066B3] px-5 text-xs font-bold text-white transition hover:bg-[#005596] disabled:cursor-not-allowed disabled:opacity-50"
              >

                {savingManual && (
                  <RefreshCw
                    size={13}
                    className="animate-spin"
                  />
                )}

                {!savingManual && (
                  <ArrowUpRight
                    size={13}
                  />
                )}

                {savingManual
                  ? "Memproses..."
                  : "Simpan Transaksi Keluar"}

              </button>

            </div>

          </div>

        </div>
      )}

      {/* ===================================================
          TOP UP MODAL
          =================================================== */}

      {showTopUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061F31]/50 p-4 backdrop-blur-sm">

          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/50 bg-white shadow-[0_25px_80px_rgba(0,30,50,0.25)]">

            <div className="flex items-center justify-between border-b border-[#D7E4EC] bg-[#EDF5FA] px-5 py-4">

              <div>

                <div className="flex items-center gap-2">

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E6F5EF] text-[#087A56]">
                    <Wallet
                      size={15}
                    />
                  </div>

                  <h2 className="text-[15px] font-bold text-[#123B5D]">
                    Top Up Petty Cash
                  </h2>

                </div>

                <p className="mt-1 pl-10 text-[10px] text-[#78909F]">
                  Penambahan saldo ke rekening Petty Cash
                </p>

              </div>

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
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8FA2AF] transition hover:bg-white hover:text-[#425766]"
              >
                <X size={17} />
              </button>

            </div>

            <div className="space-y-4 p-5">

              {/* LOKASI */}

              <div>

                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#647A89]">
                  Rekening / Lokasi
                </label>

                <div className="flex items-center gap-2 rounded-lg border border-[#C9DCE8] bg-[#F1F7FB] px-3 py-2.5 text-xs font-bold text-[#315A78]">

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

              </div>

              {/* NOMINAL */}

              <div>

                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#647A89]">
                  Nominal Top Up
                </label>

                <div className="relative">

                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7A8994]">
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
                    className="h-11 w-full rounded-lg border border-[#C9DCE8] bg-white pl-10 pr-3 text-sm font-bold text-[#123B5D] outline-none focus:border-[#087A56] focus:ring-2 focus:ring-[#087A56]/10"
                  />

                </div>

              </div>

              {/* TANGGAL + REF */}

              <div className="grid gap-3 sm:grid-cols-2">

                <div>

                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#647A89]">
                    Tanggal
                  </label>

                  <div className="relative">

                    <CalendarDays
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8CA0AD]"
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
                      className="h-10 w-full rounded-lg border border-[#C9DCE8] bg-white pl-9 pr-2 text-xs text-[#465B69] outline-none focus:border-[#087A56]"
                    />

                  </div>

                </div>

                <div>

                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#647A89]">
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
                    className="h-10 w-full rounded-lg border border-[#C9DCE8] bg-white px-3 text-xs text-[#465B69] outline-none focus:border-[#087A56]"
                  />

                </div>

              </div>

              {/* KETERANGAN */}

              <div>

                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#647A89]">
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
                  className="w-full resize-none rounded-lg border border-[#C9DCE8] bg-white px-3 py-2.5 text-xs text-[#465B69] outline-none focus:border-[#087A56] focus:ring-2 focus:ring-[#087A56]/10"
                />

              </div>

              {/* INFO */}

              <div className="rounded-lg border border-[#CFE7DD] bg-[#F0FBF6] px-3 py-2.5 text-[10px] leading-5 text-[#58776A]">

                <span className="font-bold text-[#087A56]">
                  Status:
                </span>{" "}
                transaksi Top Up akan dibuat
                sebagai{" "}
                <span className="font-bold text-[#087A56]">
                  IN
                </span>{" "}
                lalu otomatis diproses menjadi{" "}
                <span className="font-bold text-[#087A56]">
                  APPROVED
                </span>{" "}
                dan menambah saldo Petty Cash.

              </div>

            </div>

            <div className="flex justify-end gap-2 border-t border-[#D7E4EC] bg-[#F4F8FB] px-5 py-4">

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
                className="h-9 rounded-lg border border-[#C9DCE8] bg-white px-4 text-xs font-bold text-[#687B88] transition hover:bg-[#EDF5FA] disabled:opacity-50"
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
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#087A56] px-5 text-xs font-bold text-white transition hover:bg-[#066646] disabled:cursor-not-allowed disabled:opacity-50"
              >

                {savingTopUp && (
                  <RefreshCw
                    size={13}
                    className="animate-spin"
                  />
                )}

                {!savingTopUp && (
                  <Plus size={13} />
                )}

                {savingTopUp
                  ? "Memproses..."
                  : "Top Up"}

              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}