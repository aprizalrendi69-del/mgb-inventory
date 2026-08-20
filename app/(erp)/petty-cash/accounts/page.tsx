"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  WalletCards,
  Search,
  Power,
  X,
  Save,
  RefreshCw,
  MapPin,
} from "lucide-react";

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
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  outletId?: number | null;
  outlet?: {
    id: number;
    code: string;
    name: string;
    active: boolean;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

interface FormData {
  code: string;
  name: string;
  openingBalance: string;
  outletId: string;
  isActive: boolean;
}

const emptyForm: FormData = {
  code: "",
  name: "",
  openingBalance: "0",
  outletId: "",
  isActive: true,
};

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function PettyCashAccountsPage() {
  const [accounts, setAccounts] = useState<PettyCashAccount[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingOutlets, setLoadingOutlets] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState<FormData>(emptyForm);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /*
  =========================================================
  LOAD ACCOUNTS
  =========================================================
  */

  async function loadAccounts() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/petty-cash/accounts", {
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Gagal mengambil data akun petty cash."
        );
      }

      const accountData = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.accounts)
          ? data.accounts
          : Array.isArray(data)
            ? data
            : [];

      setAccounts(accountData);

      /*
       * API accounts juga mengirim daftar outlet.
       */
      if (Array.isArray(data?.outlets)) {
        setOutlets(data.outlets);
      }
    } catch (err) {
      console.error("LOAD PETTY CASH ACCOUNTS ERROR:", err);

      setAccounts([]);

      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data akun petty cash."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
  =========================================================
  LOAD OUTLETS
  =========================================================

  Tetap disediakan fallback terpisah.
  Jadi apabila API accounts tidak mengirim outlets,
  halaman masih bisa mengambil daftar outlet.
  */

  async function loadOutlets() {
    try {
      setLoadingOutlets(true);

      const res = await fetch("/api/petty-cash/accounts", {
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        return;
      }

      if (Array.isArray(data?.outlets)) {
        setOutlets(data.outlets);
      }
    } catch (error) {
      console.error("LOAD PETTY CASH OUTLETS ERROR:", error);
    } finally {
      setLoadingOutlets(false);
    }
  }

  useEffect(() => {
    loadAccounts();
    loadOutlets();
  }, []);

  /*
  =========================================================
  CREATE
  =========================================================
  */

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  /*
  =========================================================
  EDIT
  =========================================================
  */

  function openEdit(account: PettyCashAccount) {
    setEditingId(account.id);

    setForm({
      code: account.code || "",
      name: account.name || "",
      openingBalance: String(account.openingBalance || 0),

      /*
       * null = PUSAT
       * number = outlet
       */
      outletId:
        account.outletId !== null &&
        account.outletId !== undefined
          ? String(account.outletId)
          : "",

      isActive: account.isActive,
    });

    setError("");
    setSuccess("");
    setShowModal(true);
  }

  /*
  =========================================================
  CLOSE
  =========================================================
  */

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
  }

  /*
  =========================================================
  SUBMIT
  =========================================================
  */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.code.trim()) {
      setError("Kode akun wajib diisi.");
      return;
    }

    if (!form.name.trim()) {
      setError("Nama akun wajib diisi.");
      return;
    }

    const openingBalance = Number(form.openingBalance);

    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      setError("Saldo awal tidak valid.");
      return;
    }

    /*
     * PUSAT = null
     * OUTLET = ID outlet
     */
    const outletId =
      form.outletId.trim() === ""
        ? null
        : Number(form.outletId);

    if (
      outletId !== null &&
      (!Number.isInteger(outletId) || outletId <= 0)
    ) {
      setError("Lokasi outlet tidak valid.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        openingBalance,
        outletId,
        isActive: form.isActive,
      };

      const url = editingId
        ? `/api/petty-cash/accounts/${editingId}`
        : "/api/petty-cash/accounts";

      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Gagal menyimpan akun petty cash."
        );
      }

      setSuccess(
        editingId
          ? "Akun petty cash berhasil diperbarui."
          : "Akun petty cash berhasil ditambahkan."
      );

      await loadAccounts();

      setTimeout(() => {
        setShowModal(false);
        setEditingId(null);
        setForm(emptyForm);
        setSuccess("");
      }, 500);
    } catch (err) {
      console.error("SAVE PETTY CASH ACCOUNT ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan akun petty cash."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
  =========================================================
  TOGGLE STATUS
  =========================================================
  */

  async function toggleStatus(account: PettyCashAccount) {
    const action = account.isActive
      ? "menonaktifkan"
      : "mengaktifkan";

    const confirmed = window.confirm(
      `Yakin ingin ${action} akun "${account.name}"?`
    );

    if (!confirmed) return;

    try {
      setError("");

      const res = await fetch(
        `/api/petty-cash/accounts/${account.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: account.code,
            name: account.name,
            outletId: account.outletId ?? null,
            isActive: !account.isActive,
          }),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Gagal mengubah status akun."
        );
      }

      await loadAccounts();
    } catch (err) {
      console.error("TOGGLE PETTY CASH ACCOUNT ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengubah status akun."
      );
    }
  }

  /*
  =========================================================
  FILTER
  =========================================================
  */

  const filteredAccounts = accounts.filter((account) => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) return true;

    return (
      account.code.toLowerCase().includes(keyword) ||
      account.name.toLowerCase().includes(keyword) ||
      (account.outlet?.name || "")
        .toLowerCase()
        .includes(keyword) ||
      (account.outlet?.code || "")
        .toLowerCase()
        .includes(keyword)
    );
  });

  /*
  =========================================================
  SUMMARY
  =========================================================
  */

  const totalBalance = accounts
    .filter((account) => account.isActive)
    .reduce(
      (total, account) =>
        total + Number(account.currentBalance || 0),
      0
    );

  const activeCount = accounts.filter(
    (account) => account.isActive
  ).length;

  /*
  =========================================================
  RENDER
  =========================================================
  */

  return (
    <div className="min-h-full bg-[#F5F8F7] p-6">
      <div className="mx-auto max-w-[1400px]">

        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <WalletCards
                size={22}
                className="text-[#527A6B]"
              />

              <h1 className="text-[22px] font-bold text-[#24352F]">
                Akun Petty Cash
              </h1>
            </div>

            <p className="text-[12px] text-[#70837B]">
              Kelola akun kas kecil, lokasi, dan saldo awal petty cash.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                loadAccounts();
                loadOutlets();
              }}
              disabled={loading}
              className="
                flex h-10 items-center gap-2 rounded-lg
                border border-[#D4E0DB] bg-white px-4
                text-[12px] font-semibold text-[#52665E]
                transition hover:bg-[#F1F6F3]
                disabled:cursor-not-allowed disabled:opacity-60
              "
            >
              <RefreshCw
                size={15}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreate}
              className="
                flex h-10 items-center gap-2 rounded-lg
                bg-[#527A6B] px-4 text-[12px] font-bold
                text-white shadow-sm transition hover:bg-[#466C5E]
              "
            >
              <Plus size={16} />
              Tambah Akun
            </button>
          </div>
        </div>

        {/* ERROR */}
        {error && !showModal && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-700">
            {error}
          </div>
        )}

        {/* SUMMARY */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#DDE8E3] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82938C]">
              Total Akun
            </p>

            <p className="mt-2 text-[24px] font-bold text-[#24352F]">
              {accounts.length}
            </p>
          </div>

          <div className="rounded-xl border border-[#DDE8E3] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82938C]">
              Akun Aktif
            </p>

            <p className="mt-2 text-[24px] font-bold text-[#527A6B]">
              {activeCount}
            </p>
          </div>

          <div className="rounded-xl border border-[#DDE8E3] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82938C]">
              Total Saldo Aktif
            </p>

            <p className="mt-2 text-[21px] font-bold text-[#24352F]">
              {formatRupiah(totalBalance)}
            </p>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-hidden rounded-xl border border-[#DDE8E3] bg-white shadow-sm">

          <div className="flex flex-col gap-3 border-b border-[#E5ECE9] p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-[14px] font-bold text-[#24352F]">
                Daftar Akun
              </h2>

              <p className="mt-0.5 text-[11px] text-[#84948D]">
                Akun yang tersedia untuk transaksi petty cash.
              </p>
            </div>

            <div className="relative w-full md:w-[280px]">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#91A19A]"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode, nama, atau outlet..."
                className="
                  h-9 w-full rounded-lg border border-[#D8E3DE]
                  bg-[#FAFCFB] pl-9 pr-3 text-[12px]
                  text-[#263A33] outline-none transition
                  focus:border-[#527A6B]
                  focus:ring-2 focus:ring-[#527A6B]/10
                "
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="border-b border-[#E5ECE9] bg-[#F8FAF9]">
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-[#75877F]">
                    Kode
                  </th>

                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-[#75877F]">
                    Nama Akun
                  </th>

                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-[#75877F]">
                    Lokasi
                  </th>

                  <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-[#75877F]">
                    Saldo Awal
                  </th>

                  <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-[#75877F]">
                    Saldo Berjalan
                  </th>

                  <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[#75877F]">
                    Status
                  </th>

                  <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[#75877F]">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-[12px] text-[#84948D]"
                    >
                      Memuat akun petty cash...
                    </td>
                  </tr>
                ) : filteredAccounts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center"
                    >
                      <WalletCards
                        size={30}
                        className="mx-auto text-[#B6C5BF]"
                      />

                      <p className="mt-3 text-[12px] font-semibold text-[#657871]">
                        Belum ada akun petty cash
                      </p>

                      <p className="mt-1 text-[11px] text-[#95A49E]">
                        Tambahkan akun untuk mulai mengelola kas kecil.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((account) => (
                    <tr
                      key={account.id}
                      className="border-b border-[#EDF2F0] transition hover:bg-[#FAFCFB]"
                    >
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-[#EEF5F2] px-2 py-1 text-[11px] font-bold text-[#527A6B]">
                          {account.code}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-[12px] font-bold text-[#2A3D36]">
                          {account.name}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        {account.outlet ? (
                          <div className="flex items-center gap-2">
                            <MapPin
                              size={14}
                              className="text-[#527A6B]"
                            />

                            <div>
                              <p className="text-[11px] font-bold text-[#40554C]">
                                {account.outlet.name}
                              </p>

                              <p className="text-[10px] text-[#8A9993]">
                                {account.outlet.code}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex rounded-md bg-[#EEF5F2] px-2 py-1 text-[10px] font-bold text-[#527A6B]">
                            PUSAT
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right text-[12px] font-semibold text-[#566961]">
                        {formatRupiah(
                          Number(account.openingBalance || 0)
                        )}
                      </td>

                      <td className="px-5 py-4 text-right text-[12px] font-bold text-[#2A3D36]">
                        {formatRupiah(
                          Number(account.currentBalance || 0)
                        )}
                      </td>

                      <td className="px-5 py-4 text-center">
                        {account.isActive ? (
                          <span className="inline-flex rounded-full bg-[#E7F3EC] px-2.5 py-1 text-[10px] font-bold text-[#39704E]">
                            AKTIF
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-[#F0F2F1] px-2.5 py-1 text-[10px] font-bold text-[#7A8581]">
                            NONAKTIF
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(account)}
                            className="
                              flex h-8 w-8 items-center justify-center
                              rounded-lg border border-[#D9E4DF]
                              text-[#60746B] transition
                              hover:border-[#B7C9C1]
                              hover:bg-[#F1F6F3]
                              hover:text-[#527A6B]
                            "
                            title="Edit akun"
                          >
                            <Pencil size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleStatus(account)}
                            className="
                              flex h-8 w-8 items-center justify-center
                              rounded-lg border border-[#D9E4DF]
                              text-[#60746B] transition
                              hover:border-[#B7C9C1]
                              hover:bg-[#F1F6F3]
                              hover:text-[#527A6B]
                            "
                            title={
                              account.isActive
                                ? "Nonaktifkan"
                                : "Aktifkan"
                            }
                          >
                            <Power size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#E5ECE9] bg-[#FAFCFB] px-5 py-3">
            <p className="text-[10px] text-[#84948D]">
              Menampilkan{" "}
              <span className="font-bold text-[#52665E]">
                {filteredAccounts.length}
              </span>{" "}
              dari{" "}
              <span className="font-bold text-[#52665E]">
                {accounts.length}
              </span>{" "}
              akun.
            </p>
          </div>
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[500px] overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-[#E3EBE7] px-5 py-4">
              <div>
                <h2 className="text-[15px] font-bold text-[#263A33]">
                  {editingId
                    ? "Edit Akun Petty Cash"
                    : "Tambah Akun Petty Cash"}
                </h2>

                <p className="mt-0.5 text-[10px] text-[#899891]">
                  Kelola informasi akun, lokasi, dan saldo awal.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="
                  flex h-8 w-8 items-center justify-center
                  rounded-lg text-[#87968F]
                  hover:bg-[#F1F5F3]
                  hover:text-[#40554C]
                  disabled:opacity-50
                "
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 px-5 py-5">

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] font-medium text-red-700">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-[11px] font-medium text-green-700">
                    {success}
                  </div>
                )}

                {/* KODE */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-[#52665E]">
                    Kode Akun
                  </label>

                  <input
                    value={form.code}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        code: e.target.value,
                      }))
                    }
                    placeholder="Contoh: PC-001"
                    disabled={saving}
                    className="
                      h-10 w-full rounded-lg
                      border border-[#D7E2DD] px-3
                      text-[12px] text-[#263A33]
                      outline-none focus:border-[#527A6B]
                      focus:ring-2 focus:ring-[#527A6B]/10
                      disabled:bg-[#F3F6F4]
                    "
                  />
                </div>

                {/* NAMA */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-[#52665E]">
                    Nama Akun
                  </label>

                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Contoh: Kas Kecil Outlet"
                    disabled={saving}
                    className="
                      h-10 w-full rounded-lg
                      border border-[#D7E2DD] px-3
                      text-[12px] text-[#263A33]
                      outline-none focus:border-[#527A6B]
                      focus:ring-2 focus:ring-[#527A6B]/10
                      disabled:bg-[#F3F6F4]
                    "
                  />
                </div>

                {/* LOKASI */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-[#52665E]">
                    <MapPin size={13} />
                    Lokasi
                  </label>

                  <select
                    value={form.outletId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        outletId: e.target.value,
                      }))
                    }
                    disabled={saving || loadingOutlets}
                    className="
                      h-10 w-full rounded-lg
                      border border-[#D7E2DD]
                      bg-white px-3
                      text-[12px] text-[#263A33]
                      outline-none focus:border-[#527A6B]
                      focus:ring-2 focus:ring-[#527A6B]/10
                      disabled:bg-[#F3F6F4]
                    "
                  >
                    <option value="">
                      PUSAT
                    </option>

                    {outlets
                      .filter((outlet) => outlet.active)
                      .map((outlet) => (
                        <option
                          key={outlet.id}
                          value={outlet.id}
                        >
                          {outlet.code} - {outlet.name}
                        </option>
                      ))}
                  </select>

                  <p className="mt-1 text-[10px] text-[#899891]">
                    PUSAT = akun petty cash kantor pusat.
                    Pilih outlet untuk akun petty cash outlet.
                  </p>
                </div>

                {/* SALDO AWAL */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-[#52665E]">
                    Saldo Awal
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={form.openingBalance}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        openingBalance: e.target.value,
                      }))
                    }
                    placeholder="0"
                    disabled={saving}
                    className="
                      h-10 w-full rounded-lg
                      border border-[#D7E2DD] px-3
                      text-[12px] text-[#263A33]
                      outline-none focus:border-[#527A6B]
                      focus:ring-2 focus:ring-[#527A6B]/10
                      disabled:bg-[#F3F6F4]
                    "
                  />

                  {editingId && (
                    <p className="mt-1 text-[10px] text-[#899891]">
                      Perubahan saldo awal tidak otomatis mengubah saldo berjalan.
                    </p>
                  )}
                </div>

                {/* STATUS */}
                <div className="flex items-center justify-between rounded-lg border border-[#DCE6E2] bg-[#F8FAF9] px-3.5 py-3">
                  <div>
                    <p className="text-[11px] font-bold text-[#3D5149]">
                      Status Akun
                    </p>

                    <p className="mt-0.5 text-[10px] text-[#899891]">
                      Akun aktif dapat digunakan pada transaksi petty cash.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        isActive: !prev.isActive,
                      }))
                    }
                    className={`
                      relative h-6 w-11 rounded-full
                      transition disabled:opacity-50
                      ${
                        form.isActive
                          ? "bg-[#527A6B]"
                          : "bg-[#B8C3BE]"
                      }
                    `}
                  >
                    <span
                      className={`
                        absolute top-1 h-4 w-4 rounded-full
                        bg-white shadow transition
                        ${
                          form.isActive
                            ? "left-6"
                            : "left-1"
                        }
                      `}
                    />
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#E3EBE7] bg-[#FAFCFB] px-5 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="
                    h-9 rounded-lg border border-[#D7E2DD]
                    bg-white px-4 text-[11px] font-bold
                    text-[#63746D] hover:bg-[#F1F5F3]
                    disabled:opacity-50
                  "
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="
                    flex h-9 items-center gap-2 rounded-lg
                    bg-[#527A6B] px-4 text-[11px]
                    font-bold text-white
                    hover:bg-[#466C5E]
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                >
                  {saving ? (
                    <RefreshCw
                      size={14}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={14} />
                  )}

                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}