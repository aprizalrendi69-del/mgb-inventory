"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CalendarDays,
  ChevronDown,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react";

/*
===========================================================
TYPE
===========================================================
*/

type CashAccount = {
  id: number;
  code: string;
  name: string;
  openingBalance: number;
  currentBalance: number;
  isActive?: boolean;
  active?: boolean;
  outletId?: number | null;

  outlet?: {
    id: number;
    code: string;
    name: string;
  } | null;
};

type CashLedger = {
  id: number;
  number: string;
  accountId: number;

  trxDate: string;

  type: "IN" | "OUT" | string;

  category?: string | null;
  description?: string | null;

  amount: number;

  balanceBefore: number;
  balanceAfter: number;

  paymentId?: number | null;
  outletId?: number | null;

  status?: "PENDING" | "APPROVED" | "REJECTED" | string;

  account?: {
    id: number;
    code: string;
    name: string;
    outletId?: number | null;

    outlet?: {
      id: number;
      code: string;
      name: string;
    } | null;
  } | null;

  outlet?: {
    id: number;
    code: string;
    name: string;
  } | null;
};

type UserInfo = {
  id: number;
  fullname?: string;
  role: string;
  outletId?: number | null;
};

/*
===========================================================
HELPER
===========================================================
*/

function formatRupiah(value: number) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatDateTime(value?: string) {
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
}

function getTypeLabel(type: string) {
  switch (type) {
    case "IN":
      return "MASUK";

    case "OUT":
      return "KELUAR";

    default:
      return type;
  }
}

function isMoneyIn(type: string) {
  return type === "IN";
}

/*
===========================================================
EXTRACT ACCOUNTS
===========================================================
*/

function extractAccounts(json: any): CashAccount[] {
  const payload = json?.data ?? json;

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.accounts)) {
    return payload.accounts;
  }

  if (Array.isArray(payload?.cashAccounts)) {
    return payload.cashAccounts;
  }

  if (Array.isArray(json?.accounts)) {
    return json.accounts;
  }

  return [];
}

/*
===========================================================
EXTRACT PETTY CASH TRANSACTIONS

API /api/petty-cash:

{
  success: true,
  data: pettyCash
}

Jadi data langsung berupa ARRAY transaksi.

INI YANG MEMPERBAIKI MASALAH UTAMA.
===========================================================
*/

function extractLedgers(json: any): CashLedger[] {
  const payload = json?.data ?? json;

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.pettyCash)) {
    return payload.pettyCash;
  }

  if (Array.isArray(payload?.transactions)) {
    return payload.transactions;
  }

  if (Array.isArray(payload?.ledgers)) {
    return payload.ledgers;
  }

  if (Array.isArray(payload?.history)) {
    return payload.history;
  }

  if (Array.isArray(json?.pettyCash)) {
    return json.pettyCash;
  }

  if (Array.isArray(json?.transactions)) {
    return json.transactions;
  }

  if (Array.isArray(json?.ledgers)) {
    return json.ledgers;
  }

  return [];
}

/*
===========================================================
PAGE
===========================================================
*/

export default function PettyCashPage() {
  const [user, setUser] =
    useState<UserInfo | null>(null);

  const [accounts, setAccounts] =
    useState<CashAccount[]>([]);

  const [ledgers, setLedgers] =
    useState<CashLedger[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [loadingUser, setLoadingUser] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [selectedAccount, setSelectedAccount] =
    useState<string>("ALL");

  const [tanggalMulai, setTanggalMulai] =
    useState("");

  const [tanggalSelesai, setTanggalSelesai] =
    useState("");

  /*
  =========================================================
  TOP UP
  =========================================================
  */

  const [showTopUp, setShowTopUp] =
    useState(false);

  const [savingTopUp, setSavingTopUp] =
    useState(false);

  const [topUpAccountId, setTopUpAccountId] =
    useState<string>("");

  const [topUpAmount, setTopUpAmount] =
    useState("");

  const [topUpDate, setTopUpDate] =
    useState("");

  const [topUpReference, setTopUpReference] =
    useState("");

  const [topUpDescription, setTopUpDescription] =
    useState("");

  /*
  =========================================================
  LOAD USER
  =========================================================
  */

  async function loadUser() {
    try {
      setLoadingUser(true);

      const res = await fetch("/api/me", {
        cache: "no-store",
      });

      const json = await res.json();

      const currentUser =
        json?.user ??
        json?.data ??
        json;

      if (res.ok && currentUser?.id) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error(
        "LOAD USER ERROR:",
        error
      );

      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }

  /*
  =========================================================
  LOAD ACCOUNTS
  =========================================================
  */

  async function loadAccounts() {
    try {
      const res = await fetch(
        "/api/petty-cash/accounts",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json?.message ||
            "Gagal mengambil data akun Petty Cash"
        );
      }

      const accountData =
        extractAccounts(json);

      const activeAccounts =
        accountData.filter((account) => {
          if (
            typeof account.isActive ===
            "boolean"
          ) {
            return account.isActive;
          }

          if (
            typeof account.active ===
            "boolean"
          ) {
            return account.active;
          }

          return true;
        });

      setAccounts(activeAccounts);

      setTopUpAccountId((current) => {
        if (
          current &&
          activeAccounts.some(
            (account) =>
              String(account.id) === current
          )
        ) {
          return current;
        }

        return activeAccounts[0]
          ? String(activeAccounts[0].id)
          : "";
      });
    } catch (error) {
      console.error(
        "LOAD PETTY CASH ACCOUNTS ERROR:",
        error
      );

      setAccounts([]);
      setTopUpAccountId("");
    }
  }

  /*
  =========================================================
  LOAD TRANSACTIONS

  API /api/petty-cash langsung mengembalikan:

  data: [
    {
      id,
      number,
      type,
      amount,
      balanceBefore,
      balanceAfter,
      ...
    }
  ]

  Jadi langsung masukkan hasil data ke ledger.
  =========================================================
  */

  async function loadLedgers() {
    try {
      const res = await fetch(
        "/api/petty-cash",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json?.message ||
            "Gagal mengambil data Petty Cash"
        );
      }

      const ledgerData =
        extractLedgers(json);

      setLedgers(
        Array.isArray(ledgerData)
          ? ledgerData
          : []
      );
    } catch (error) {
      console.error(
        "LOAD PETTY CASH LEDGER ERROR:",
        error
      );

      setLedgers([]);
    }
  }

  /*
  =========================================================
  LOAD ALL
  =========================================================
  */

  async function loadPettyCash() {
    try {
      setLoading(true);

      await Promise.all([
        loadAccounts(),
        loadLedgers(),
      ]);
    } finally {
      setLoading(false);
    }
  }

  /*
  =========================================================
  INITIAL LOAD
  =========================================================
  */

  useEffect(() => {
    loadUser();
    loadPettyCash();
  }, []);

  /*
  =========================================================
  ROLE
  =========================================================
  */

  const role = String(
    user?.role || ""
  ).toUpperCase();

  const canTopUp =
    role === "ADMIN" ||
    role === "MANAGER";

  /*
  =========================================================
  PETTY CASH ACCOUNTS
  =========================================================
  */

  const pettyCashAccounts = useMemo(() => {
    return accounts;
  }, [accounts]);

  /*
  =========================================================
  TOTAL BALANCE
  =========================================================
  */

  const pettyCashBalance =
    useMemo(() => {
      return pettyCashAccounts.reduce(
        (total, account) =>
          total +
          Number(
            account.currentBalance || 0
          ),
        0
      );
    }, [pettyCashAccounts]);

  /*
  =========================================================
  FILTER LEDGER
  =========================================================
  */

  const filteredLedgers =
    useMemo(() => {
      const keyword =
        search.trim().toLowerCase();

      return ledgers.filter(
        (ledger) => {
          /*
          ACCOUNT
          */

          if (
            selectedAccount !==
              "ALL" &&
            String(
              ledger.accountId
            ) !== selectedAccount
          ) {
            return false;
          }

          /*
          DATE
          */

          const ledgerDate =
            new Date(
              ledger.trxDate
            );

          if (
            Number.isNaN(
              ledgerDate.getTime()
            )
          ) {
            return false;
          }

          const year =
            ledgerDate.getFullYear();

          const month = String(
            ledgerDate.getMonth() + 1
          ).padStart(2, "0");

          const day = String(
            ledgerDate.getDate()
          ).padStart(2, "0");

          const dateOnly =
            `${year}-${month}-${day}`;

          if (
            tanggalMulai &&
            dateOnly < tanggalMulai
          ) {
            return false;
          }

          if (
            tanggalSelesai &&
            dateOnly > tanggalSelesai
          ) {
            return false;
          }

          /*
          SEARCH
          */

          if (!keyword) {
            return true;
          }

          return (
            ledger.number
              ?.toLowerCase()
              .includes(keyword) ||

            ledger.type
              ?.toLowerCase()
              .includes(keyword) ||

            ledger.category
              ?.toLowerCase()
              .includes(keyword) ||

            ledger.description
              ?.toLowerCase()
              .includes(keyword) ||

            ledger.account?.code
              ?.toLowerCase()
              .includes(keyword) ||

            ledger.account?.name
              ?.toLowerCase()
              .includes(keyword)
          );
        }
      );
    }, [
      ledgers,
      search,
      selectedAccount,
      tanggalMulai,
      tanggalSelesai,
    ]);

  /*
  =========================================================
  RESET FILTER
  =========================================================
  */

  function resetFilter() {
    setSearch("");
    setSelectedAccount("ALL");
    setTanggalMulai("");
    setTanggalSelesai("");
  }

  /*
  =========================================================
  OPEN TOP UP
  =========================================================
  */

  function openTopUp() {
    const firstPetty =
      pettyCashAccounts[0];

    setTopUpAccountId(
      firstPetty
        ? String(firstPetty.id)
        : ""
    );

    setTopUpAmount("");

    setTopUpDate(
      new Date()
        .toISOString()
        .slice(0, 10)
    );

    setTopUpReference("");
    setTopUpDescription("");

    setShowTopUp(true);
  }

  /*
  =========================================================
  SUBMIT TOP UP
  =========================================================
  */

  async function submitTopUp() {
    const accountId =
      Number(topUpAccountId);

    const amount = Number(
      topUpAmount
        .replace(/\./g, "")
        .replace(/,/g, "")
    );

    /*
    ACCOUNT
    */

    if (!accountId) {
      alert(
        "Pilih akun Petty Cash."
      );
      return;
    }

    const selected =
      pettyCashAccounts.find(
        (account) =>
          account.id === accountId
      );

    if (!selected) {
      alert(
        "Akun Petty Cash tidak ditemukan. Silakan refresh halaman."
      );

      return;
    }

    /*
    AMOUNT
    */

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      alert(
        "Nominal Top Up harus lebih dari 0."
      );

      return;
    }

    try {
      setSavingTopUp(true);

      const res = await fetch(
        "/api/petty-cash/top-up",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            accountId,

            amount,

            paymentDate:
              topUpDate || undefined,

            referenceNumber:
              topUpReference.trim() ||
              undefined,

            description:
              topUpDescription.trim() ||
              undefined,
          }),
        }
      );

      const json = await res.json();

      if (
        !res.ok ||
        json?.success === false
      ) {
        throw new Error(
          json?.message ||
            "Gagal melakukan Top Up."
        );
      }

      setShowTopUp(false);

      await loadPettyCash();

      alert(
        "Top Up Petty Cash berhasil."
      );
    } catch (error) {
      console.error(
        "TOP UP PETTY CASH ERROR:",
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
  RENDER
  =========================================================
  */

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* HEADER */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <Wallet size={23} />
          </div>

          <div>

            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Petty Cash
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Kelola saldo dan transaksi Petty Cash
            </p>

          </div>

        </div>

        <div className="flex flex-wrap gap-2">

          <button
            type="button"
            onClick={loadPettyCash}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-50"
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

          {canTopUp && (
            <button
              type="button"
              onClick={openTopUp}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3D6D60]"
            >
              <Plus size={17} />

              Top Up
            </button>
          )}

        </div>

      </div>

      {/* SUMMARY */}

      <div className="mb-6">

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-6 shadow-sm">

          <div className="flex items-start justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Saldo Petty Cash
              </p>

              <p className="mt-2 text-3xl font-bold text-[#18352D]">
                Rp{" "}
                {formatRupiah(
                  pettyCashBalance
                )}
              </p>

              <p className="mt-2 text-xs text-gray-400">
                {pettyCashAccounts.length} akun Petty Cash
              </p>

            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Wallet size={23} />
            </div>

          </div>

        </div>

      </div>

      {/* ACCOUNT LIST */}

      {pettyCashAccounts.length > 0 && (

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">

          {pettyCashAccounts.map(
            (account) => (

              <div
                key={account.id}
                className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm"
              >

                <div className="flex items-start justify-between gap-3">

                  <div className="min-w-0">

                    <p className="text-xs font-semibold text-[#58736A]">
                      {account.code}
                    </p>

                    <p className="mt-1 truncate text-sm font-bold text-[#18352D]">
                      {account.name}
                    </p>

                  </div>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                    <Wallet size={17} />
                  </div>

                </div>

                <div className="mt-4">

                  <p className="text-xs text-gray-400">
                    Saldo
                  </p>

                  <p className="mt-1 text-xl font-bold text-[#18352D]">
                    Rp{" "}
                    {formatRupiah(
                      account.currentBalance
                    )}
                  </p>

                </div>

                {account.outlet && (
                  <p className="mt-3 text-xs text-gray-400">
                    {account.outlet.code} -{" "}
                    {account.outlet.name}
                  </p>
                )}

              </div>

            )
          )}

        </div>

      )}

      {/* MAIN CARD */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        {/* FILTER */}

        <div className="border-b border-[#E5ECE9] p-5">

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

            {/* SEARCH */}

            <div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Pencarian
              </label>

              <div className="relative">

                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Cari transaksi..."
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                />

              </div>

            </div>

            {/* ACCOUNT */}

            <div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Akun Petty Cash
              </label>

              <div className="relative">

                <select
                  value={selectedAccount}
                  onChange={(e) =>
                    setSelectedAccount(
                      e.target.value
                    )
                  }
                  className="w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 pr-10 text-sm font-medium text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                >

                  <option value="ALL">
                    Semua Akun
                  </option>

                  {pettyCashAccounts.map(
                    (account) => (

                      <option
                        key={account.id}
                        value={String(
                          account.id
                        )}
                      >
                        {account.code} -{" "}
                        {account.name}
                      </option>

                    )
                  )}

                </select>

                <ChevronDown
                  size={17}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

              </div>

            </div>

            {/* START DATE */}

            <div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Tanggal Mulai
              </label>

              <input
                type="date"
                value={tanggalMulai}
                onChange={(e) =>
                  setTanggalMulai(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
              />

            </div>

            {/* END DATE */}

            <div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Tanggal Selesai
              </label>

              <input
                type="date"
                value={tanggalSelesai}
                onChange={(e) =>
                  setTanggalSelesai(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
              />

            </div>

          </div>

          <div className="mt-4 flex items-center justify-between gap-3">

            <div className="text-xs text-gray-500">

              Menampilkan{" "}

              <span className="font-semibold text-[#497F70]">
                {filteredLedgers.length}
              </span>{" "}

              transaksi

            </div>

            {(search ||
              selectedAccount !==
                "ALL" ||
              tanggalMulai ||
              tanggalSelesai) && (

              <button
                type="button"
                onClick={resetFilter}
                className="rounded-lg border border-[#D5E5DC] bg-white px-3 py-2 text-xs font-semibold text-[#497F70] transition hover:bg-[#F5F8F6]"
              >
                Reset Filter
              </button>

            )}

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="min-w-[1150px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Tanggal
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Nomor
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Akun
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Jenis
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Kategori
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Keterangan
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Masuk
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Keluar
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Saldo
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {loading || loadingUser ? (

                <tr>

                  <td
                    colSpan={11}
                    className="px-5 py-14 text-center"
                  >

                    <div className="flex items-center justify-center gap-2 text-gray-500">

                      <RefreshCw
                        size={18}
                        className="animate-spin text-[#497F70]"
                      />

                      Memuat Petty Cash...

                    </div>

                  </td>

                </tr>

              ) : filteredLedgers.length ===
                0 ? (

                <tr>

                  <td
                    colSpan={11}
                    className="px-5 py-14 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF3EF] text-[#497F70]">

                        <Wallet size={25} />

                      </div>

                      <p className="font-semibold text-gray-700">
                        Belum ada transaksi Petty Cash
                      </p>

                      <p className="mt-1 max-w-md text-sm text-gray-400">
                        Belum terdapat transaksi
                        Petty Cash yang sesuai
                        dengan filter.
                      </p>

                      {pettyCashAccounts.length ===
                        0 && (

                        <p className="mt-2 text-xs font-medium text-[#497F70]">
                          Belum ada akun Petty Cash
                          yang tersedia.
                        </p>

                      )}

                    </div>

                  </td>

                </tr>

              ) : (

                filteredLedgers.map(
                  (ledger, index) => {

                    const moneyIn =
                      isMoneyIn(
                        ledger.type
                      );

                    const account =
                      ledger.account ||
                      pettyCashAccounts.find(
                        (item) =>
                          item.id ===
                          ledger.accountId
                      );

                    return (

                      <tr
                        key={ledger.id}
                        className="border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                      >

                        {/* NO */}

                        <td className="px-5 py-4 text-gray-500">
                          {index + 1}
                        </td>

                        {/* DATE */}

                        <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                          {formatDateTime(
                            ledger.trxDate
                          )}
                        </td>

                        {/* NUMBER */}

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {ledger.number ||
                              "-"}
                          </div>

                        </td>

                        {/* ACCOUNT */}

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {account?.name ||
                              "-"}
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {account?.code ||
                              "-"}
                          </div>

                        </td>

                        {/* TYPE */}

                        <td className="px-5 py-4">

                          <span
                            className={
                              `inline-flex rounded-full px-3 py-1 text-xs font-semibold ` +
                              (
                                ledger.type ===
                                "IN"
                                  ? "bg-green-100 text-green-700"
                                  : ledger.type ===
                                    "OUT"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-700"
                              )
                            }
                          >
                            {getTypeLabel(
                              ledger.type
                            )}
                          </span>

                        </td>

                        {/* CATEGORY */}

                        <td className="px-5 py-4">

                          <span className="text-gray-700">
                            {ledger.category ||
                              "-"}
                          </span>

                        </td>

                        {/* DESCRIPTION */}

                        <td className="max-w-[280px] px-5 py-4 text-gray-600">

                          <div className="truncate">
                            {ledger.description ||
                              "-"}
                          </div>

                        </td>

                        {/* IN */}

                        <td className="px-5 py-4 text-right font-semibold text-green-700">

                          {moneyIn
                            ? `Rp ${formatRupiah(
                                ledger.amount
                              )}`
                            : "-"}

                        </td>

                        {/* OUT */}

                        <td className="px-5 py-4 text-right font-semibold text-red-600">

                          {!moneyIn
                            ? `Rp ${formatRupiah(
                                ledger.amount
                              )}`
                            : "-"}

                        </td>

                        {/* BALANCE */}

                        <td className="px-5 py-4 text-right font-bold text-[#18352D]">

                          Rp{" "}

                          {formatRupiah(
                            ledger.balanceAfter
                          )}

                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-4 text-center">

                          <span
                            className={
                              `inline-flex rounded-full px-3 py-1 text-xs font-semibold ` +
                              (
                                ledger.status ===
                                "APPROVED"
                                  ? "bg-green-100 text-green-700"
                                  : ledger.status ===
                                    "PENDING"
                                  ? "bg-amber-100 text-amber-700"
                                  : ledger.status ===
                                    "REJECTED"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-700"
                              )
                            }
                          >
                            {ledger.status ||
                              "-"}
                          </span>

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

      {/* TOP UP MODAL */}

      {showTopUp && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-[#E5ECE9] px-6 py-5">

              <div>

                <h2 className="text-lg font-bold text-[#18352D]">
                  Top Up Petty Cash
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Tambahkan saldo ke akun Petty Cash
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  !savingTopUp &&
                  setShowTopUp(false)
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={18} />
              </button>

            </div>

            {/* FORM */}

            <div className="space-y-4 p-6">

              {/* ACCOUNT */}

              <div>

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                  Akun Petty Cash
                </label>

                {pettyCashAccounts.length ===
                0 ? (

                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Belum ada akun Petty Cash
                    yang tersedia.
                  </div>

                ) : (

                  <div>

                    <div className="relative">

                      <select
                        value={topUpAccountId}
                        onChange={(e) =>
                          setTopUpAccountId(
                            e.target.value
                          )
                        }
                        className="w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 pr-10 text-sm text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                      >

                        <option value="">
                          Pilih akun
                        </option>

                        {pettyCashAccounts.map(
                          (account) => (

                            <option
                              key={account.id}
                              value={String(
                                account.id
                              )}
                            >
                              {account.code} -{" "}
                              {account.name}
                            </option>

                          )
                        )}

                      </select>

                      <ChevronDown
                        size={17}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                    </div>

                    {topUpAccountId && (

                      <div className="mt-2 rounded-lg bg-[#F5F8F6] px-3 py-2 text-xs text-[#58736A]">

                        Saldo saat ini:{" "}

                        <span className="font-bold text-[#18352D]">

                          Rp{" "}

                          {formatRupiah(
                            pettyCashAccounts.find(
                              (account) =>
                                String(
                                  account.id
                                ) ===
                                topUpAccountId
                            )
                              ?.currentBalance ||
                              0
                          )}

                        </span>

                      </div>

                    )}

                  </div>

                )}

              </div>

              {/* AMOUNT */}

              <div>

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                  Nominal Top Up
                </label>

                <div className="relative">

                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">
                    Rp
                  </span>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={topUpAmount}
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
                    className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-12 pr-4 text-sm font-semibold text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                  />

                </div>

              </div>

              {/* DATE */}

              <div>

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                  Tanggal
                </label>

                <div className="relative">

                  <CalendarDays
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="date"
                    value={topUpDate}
                    onChange={(e) =>
                      setTopUpDate(
                        e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 pl-10 text-sm text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                  />

                </div>

              </div>

              {/* REFERENCE */}

              <div>

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                  Nomor Referensi
                </label>

                <input
                  type="text"
                  value={topUpReference}
                  onChange={(e) =>
                    setTopUpReference(
                      e.target.value
                    )
                  }
                  placeholder="Contoh: TOPUP-001"
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                />

              </div>

              {/* DESCRIPTION */}

              <div>

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                  Keterangan
                </label>

                <textarea
                  value={topUpDescription}
                  onChange={(e) =>
                    setTopUpDescription(
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder="Keterangan Top Up..."
                  className="w-full resize-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                />

              </div>

            </div>

            {/* FOOTER */}

            <div className="flex justify-end gap-2 border-t border-[#E5ECE9] bg-[#FAFCFB] px-6 py-4">

              <button
                type="button"
                disabled={savingTopUp}
                onClick={() =>
                  setShowTopUp(false)
                }
                className="rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={
                  savingTopUp ||
                  !topUpAccountId ||
                  !topUpAmount ||
                  pettyCashAccounts.length ===
                    0
                }
                onClick={submitTopUp}
                className="inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-50"
              >

                {savingTopUp && (
                  <RefreshCw
                    size={16}
                    className="animate-spin"
                  />
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