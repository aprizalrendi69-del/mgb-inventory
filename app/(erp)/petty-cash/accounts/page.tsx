"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
  Building2,
  CheckCircle2,
  AlertCircle,
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
  outlet?: Outlet | null;
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

interface ApiResponse<T = unknown> {
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
  accounts?: PettyCashAccount[];
  outlets?: Outlet[];
}

const emptyForm: FormData = {
  code: "",
  name: "",
  openingBalance: "0",
  outletId: "",
  isActive: true,
};

function formatRupiah(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numberValue) ? numberValue : 0);
}

function readError(data: ApiResponse | null, fallback: string) {
  return data?.message || data?.error || fallback;
}

export default function PettyCashAccountsPage() {
  const [accounts, setAccounts] = useState<PettyCashAccount[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOutlets, setLoadingOutlets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pageError, setPageError] = useState("");

  const loadAccounts = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setPageError("");

      const res = await fetch("/api/petty-cash/accounts", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = (await res.json().catch(() => null)) as ApiResponse | null;

      if (!res.ok) throw new Error(readError(data, "Gagal mengambil data akun petty cash."));

      const accountData = Array.isArray(data?.data)
        ? (data.data as PettyCashAccount[])
        : Array.isArray(data?.accounts)
          ? data.accounts
          : Array.isArray(data)
            ? (data as unknown as PettyCashAccount[])
            : [];

      setAccounts(accountData);

      // API akun adalah sumber utama daftar outlet; tidak melakukan request duplikat.
      if (Array.isArray(data?.outlets)) {
        setOutlets(data.outlets);
        setLoadingOutlets(false);
      }
    } catch (err) {
      console.error("LOAD PETTY CASH ACCOUNTS ERROR:", err);
      setPageError(err instanceof Error ? err.message : "Gagal mengambil data akun petty cash.");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openEdit(account: PettyCashAccount) {
    setEditingId(account.id);
    setForm({
      code: account.code || "",
      name: account.name || "",
      openingBalance: String(account.openingBalance ?? 0),
      outletId: account.outletId == null ? "" : String(account.outletId),
      isActive: Boolean(account.isActive),
    });
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const code = form.code.trim();
    const name = form.name.trim();
    const openingBalance = Number(form.openingBalance);
    const outletId = form.outletId.trim() === "" ? null : Number(form.outletId);

    if (!code) return setError("Kode akun wajib diisi.");
    if (!name) return setError("Nama akun wajib diisi.");
    if (form.openingBalance.trim() === "" || !Number.isFinite(openingBalance) || openingBalance < 0) {
      return setError("Saldo awal harus berupa angka yang valid dan tidak boleh negatif.");
    }
    if (outletId !== null && (!Number.isInteger(outletId) || outletId <= 0)) {
      return setError("Lokasi outlet tidak valid.");
    }

    // Saat edit, field saldo awal memang dikirim hanya dari form edit.
    // API harus tetap membiarkan currentBalance tidak berubah.
    const payload = {
      code,
      name,
      openingBalance,
      outletId,
      isActive: form.isActive,
    };

    try {
      setSaving(true);
      const url = editingId ? `/api/petty-cash/accounts/${editingId}` : "/api/petty-cash/accounts";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!res.ok) throw new Error(readError(data, "Gagal menyimpan akun petty cash."));

      setSuccess(editingId ? "Akun petty cash berhasil diperbarui." : "Akun petty cash berhasil ditambahkan.");
      await loadAccounts(false);
      window.setTimeout(() => {
        setShowModal(false);
        setEditingId(null);
        setForm(emptyForm);
        setSuccess("");
      }, 650);
    } catch (err) {
      console.error("SAVE PETTY CASH ACCOUNT ERROR:", err);
      setError(err instanceof Error ? err.message : "Gagal menyimpan akun petty cash.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(account: PettyCashAccount) {
    const nextActive = !account.isActive;
    const action = nextActive ? "mengaktifkan" : "menonaktifkan";
    if (!window.confirm(`Yakin ingin ${action} akun "${account.name}"?`)) return;

    try {
      setTogglingId(account.id);
      setPageError("");
      const res = await fetch(`/api/petty-cash/accounts/${account.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        // Partial update: API mempertahankan field lain, termasuk openingBalance dan currentBalance.
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!res.ok) throw new Error(readError(data, "Gagal mengubah status akun."));
      await loadAccounts(false);
    } catch (err) {
      console.error("TOGGLE PETTY CASH ACCOUNT ERROR:", err);
      setPageError(err instanceof Error ? err.message : "Gagal mengubah status akun.");
    } finally {
      setTogglingId(null);
    }
  }

  const filteredAccounts = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    if (!keyword) return accounts;
    return accounts.filter((account) =>
      [account.code, account.name, account.outlet?.name ?? "", account.outlet?.code ?? ""]
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [accounts, search]);

  const totalBalance = useMemo(
    () => accounts.filter((account) => account.isActive).reduce((sum, account) => sum + (Number(account.currentBalance) || 0), 0),
    [accounts],
  );
  const activeCount = accounts.filter((account) => account.isActive).length;

  return (
    <div className="min-h-full bg-[#F4F7F6] p-4 text-[#23352E] transition-colors dark:bg-[#101714] dark:text-[#E6EEE9] sm:p-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D8E5DE] bg-white text-[#3F7862] shadow-sm dark:border-[#30483C] dark:bg-[#19251F] dark:text-[#8BC5A5]">
                <WalletCards size={19} />
              </div>
              <h1 className="text-[22px] font-bold tracking-tight text-[#24352F] dark:text-[#EDF5F0]">Akun Petty Cash</h1>
            </div>
            <p className="ml-11 text-[12px] text-[#70837B] dark:text-[#9AAEA3]">Kelola akun kas kecil, lokasi, saldo awal, dan status akun.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadAccounts()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#D4E0DB] bg-white px-4 text-[12px] font-semibold text-[#52665E] transition hover:bg-[#F1F6F3] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#354A3F] dark:bg-[#19251F] dark:text-[#C4D4CA] dark:hover:bg-[#22332A]">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button type="button" onClick={openCreate} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#326B52] px-4 text-[12px] font-bold text-white shadow-sm transition hover:bg-[#285840] focus:outline-none focus:ring-2 focus:ring-[#5B9B78]/40 dark:bg-[#397957] dark:hover:bg-[#438B65]">
              <Plus size={16} /> Tambah Akun
            </button>
          </div>
        </div>

        {pageError && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{pageError}</span>
            <button type="button" onClick={() => setPageError("")} className="ml-auto rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-900/40" aria-label="Tutup pesan"><X size={14} /></button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard label="Total Akun" value={String(accounts.length)} detail="Seluruh akun terdaftar" icon={<WalletCards size={17} />} />
          <SummaryCard label="Akun Aktif" value={String(activeCount)} detail={`${accounts.length - activeCount} akun nonaktif`} icon={<CheckCircle2 size={17} />} accent />
          <SummaryCard label="Total Saldo Aktif" value={formatRupiah(totalBalance)} detail="Saldo berjalan akun aktif" icon={<Building2 size={17} />} />
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#DDE7E2] bg-white shadow-[0_4px_18px_rgba(22,45,34,0.04)] dark:border-[#2B3E33] dark:bg-[#17211B] dark:shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
          <div className="flex flex-col gap-3 border-b border-[#E5ECE9] p-4 dark:border-[#2B3E33] md:flex-row md:items-center md:justify-between md:px-5">
            <div>
              <h2 className="text-[14px] font-bold text-[#263A33] dark:text-[#E8F0EB]">Daftar Akun</h2>
              <p className="mt-0.5 text-[11px] text-[#84948D] dark:text-[#94A79B]">Pusat dan outlet dikelola sebagai akun yang terpisah.</p>
            </div>
            <div className="relative w-full md:w-[300px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#91A19A] dark:text-[#82968A]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari kode, nama, atau outlet..." className="h-9 w-full rounded-lg border border-[#D8E3DE] bg-[#FAFCFB] pl-9 pr-3 text-[12px] text-[#263A33] outline-none transition placeholder:text-[#9AA9A2] focus:border-[#4B8A68] focus:ring-2 focus:ring-[#4B8A68]/10 dark:border-[#354A3F] dark:bg-[#111A15] dark:text-[#E4EDE7] dark:placeholder:text-[#74877B] dark:focus:border-[#65A77F]" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead><tr className="border-b border-[#E5ECE9] bg-[#F7FAF8] dark:border-[#2B3E33] dark:bg-[#1C2A22]">
                {[
                  { label: "Kode", align: "text-left" },
                  { label: "Nama Akun", align: "text-left" },
                  { label: "Lokasi", align: "text-left" },
                  { label: "Saldo Awal", align: "text-right" },
                  { label: "Saldo Berjalan", align: "text-right" },
                  { label: "Status", align: "text-center" },
                  { label: "Aksi", align: "text-center" },
                ].map(({ label, align }) => <th key={label} className={`px-5 py-3 ${align} text-[10px] font-bold uppercase tracking-[0.08em] text-[#75877F] dark:text-[#9BAEA2]`}>{label}</th>)}
              </tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-5 py-14 text-center text-[12px] text-[#84948D] dark:text-[#91A498]"><RefreshCw size={18} className="mx-auto mb-2 animate-spin" />Memuat akun petty cash...</td></tr>
                ) : filteredAccounts.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-14 text-center">
                    <WalletCards size={30} className="mx-auto text-[#B6C5BF] dark:text-[#52685A]" />
                    <p className="mt-3 text-[12px] font-semibold text-[#657871] dark:text-[#C2D1C7]">{search ? "Akun tidak ditemukan" : "Belum ada akun petty cash"}</p>
                    <p className="mt-1 text-[11px] text-[#95A49E] dark:text-[#819589]">{search ? "Coba kata kunci lain." : "Tambahkan akun untuk mulai mengelola kas kecil."}</p>
                  </td></tr>
                ) : filteredAccounts.map((account) => (
                  <tr key={account.id} className="border-b border-[#EDF2F0] transition last:border-b-0 hover:bg-[#FAFCFB] dark:border-[#26392E] dark:hover:bg-[#1B2921]">
                    <td className="px-5 py-4"><span className="rounded-md bg-[#EEF5F1] px-2 py-1 text-[11px] font-bold text-[#397354] dark:bg-[#243B2D] dark:text-[#A2D6B4]">{account.code}</span></td>
                    <td className="px-5 py-4"><p className="text-[12px] font-bold text-[#2A3D36] dark:text-[#E2EBE5]">{account.name}</p><p className="mt-0.5 text-[10px] text-[#9AA8A1] dark:text-[#819589]">ID akun: {account.id}</p></td>
                    <td className="px-5 py-4">{account.outlet ? <div className="flex items-center gap-2"><MapPin size={14} className="shrink-0 text-[#438260] dark:text-[#8FC5A2]" /><div><p className="text-[11px] font-bold text-[#40554C] dark:text-[#D1DED5]">{account.outlet.name}</p><p className="text-[10px] text-[#8A9993] dark:text-[#8EA195]">{account.outlet.code}</p></div></div> : <span className="inline-flex rounded-md bg-[#EEF5F1] px-2 py-1 text-[10px] font-bold text-[#397354] dark:bg-[#243B2D] dark:text-[#A2D6B4]">PUSAT</span>}</td>
                    <td className="px-5 py-4 text-right text-[12px] font-semibold tabular-nums text-[#566961] dark:text-[#AFC0B5]">{formatRupiah(account.openingBalance)}</td>
                    <td className="px-5 py-4 text-right text-[12px] font-bold tabular-nums text-[#2A3D36] dark:text-[#E0EAE3]">{formatRupiah(account.currentBalance)}</td>
                    <td className="px-5 py-4 text-center">{account.isActive ? <span className="inline-flex rounded-full bg-[#E7F3EC] px-2.5 py-1 text-[10px] font-bold text-[#39704E] dark:bg-[#244631] dark:text-[#A6D8B6]">AKTIF</span> : <span className="inline-flex rounded-full bg-[#F0F2F1] px-2.5 py-1 text-[10px] font-bold text-[#7A8581] dark:bg-[#303A34] dark:text-[#B2BDB6]">NONAKTIF</span>}</td>
                    <td className="px-5 py-4"><div className="flex justify-center gap-1.5">
                      <button type="button" onClick={() => openEdit(account)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9E4DF] text-[#60746B] transition hover:border-[#B7C9C1] hover:bg-[#F1F6F3] hover:text-[#397354] dark:border-[#3A5043] dark:text-[#B0C2B6] dark:hover:border-[#54745E] dark:hover:bg-[#26392D] dark:hover:text-[#A4D7B5]" title="Edit akun" aria-label={`Edit akun ${account.name}`}><Pencil size={14} /></button>
                      <button type="button" onClick={() => void toggleStatus(account)} disabled={togglingId === account.id} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9E4DF] text-[#60746B] transition hover:border-[#B7C9C1] hover:bg-[#F1F6F3] hover:text-[#397354] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3A5043] dark:text-[#B0C2B6] dark:hover:border-[#54745E] dark:hover:bg-[#26392D] dark:hover:text-[#A4D7B5]" title={account.isActive ? "Nonaktifkan" : "Aktifkan"} aria-label={account.isActive ? `Nonaktifkan ${account.name}` : `Aktifkan ${account.name}`}>
                        {togglingId === account.id ? <RefreshCw size={14} className="animate-spin" /> : <Power size={14} />}
                      </button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-1 border-t border-[#E5ECE9] bg-[#FAFCFB] px-5 py-3 dark:border-[#2B3E33] dark:bg-[#141E18] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] text-[#84948D] dark:text-[#91A498]">Menampilkan <span className="font-bold text-[#52665E] dark:text-[#C1D1C6]">{filteredAccounts.length}</span> dari <span className="font-bold text-[#52665E] dark:text-[#C1D1C6]">{accounts.length}</span> akun.</p>
            <p className="text-[10px] text-[#84948D] dark:text-[#91A498]">Saldo berjalan ditampilkan dari data API.</p>
          </div>
        </section>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#07130C]/55 p-3 backdrop-blur-[3px] sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="petty-cash-modal-title" className="my-auto w-full max-w-[520px] overflow-hidden rounded-2xl border border-[#DCE7E1] bg-white shadow-2xl dark:border-[#354A3D] dark:bg-[#17211B]">
            <div className="flex items-center justify-between border-b border-[#E3EBE7] px-5 py-4 dark:border-[#2D4034]">
              <div><h2 id="petty-cash-modal-title" className="text-[15px] font-bold text-[#263A33] dark:text-[#E8F0EB]">{editingId ? "Edit Akun Petty Cash" : "Tambah Akun Petty Cash"}</h2><p className="mt-0.5 text-[10px] text-[#899891] dark:text-[#95A79B]">Kelola informasi akun dan lokasi kas kecil.</p></div>
              <button type="button" onClick={closeModal} disabled={saving} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#87968F] transition hover:bg-[#F1F5F3] hover:text-[#40554C] disabled:opacity-50 dark:text-[#A3B3A8] dark:hover:bg-[#26382C] dark:hover:text-white" aria-label="Tutup modal"><X size={17} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="max-h-[calc(100vh-210px)] space-y-4 overflow-y-auto px-5 py-5">
                {error && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] font-medium text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</div>}
                {success && <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-[11px] font-medium text-green-700 dark:border-green-900/70 dark:bg-green-950/30 dark:text-green-300"><CheckCircle2 size={14} className="mt-0.5 shrink-0" />{success}</div>}

                <Field label="Kode Akun"><input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="Contoh: PC-001" disabled={saving} maxLength={50} autoComplete="off" className={inputClass} /></Field>
                <Field label="Nama Akun"><input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Contoh: Kas Kecil Outlet" disabled={saving} maxLength={120} autoComplete="off" className={inputClass} /></Field>
                <Field label={<><MapPin size={13} /> Lokasi</>}>
                  <select value={form.outletId} onChange={(event) => setForm((prev) => ({ ...prev, outletId: event.target.value }))} disabled={saving || loadingOutlets} className={inputClass}>
                    <option value="">PUSAT</option>
                    {outlets.filter((outlet) => outlet.active || String(outlet.id) === form.outletId).map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.code} - {outlet.name}{outlet.active ? "" : " (Nonaktif)"}</option>)}
                  </select>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-[#899891] dark:text-[#91A498]">PUSAT berarti akun kas kecil kantor pusat. Pilih outlet untuk akun kas kecil outlet. Akun yang sudah memiliki transaksi tidak dapat dipindahkan lokasinya.</p>
                </Field>
                <Field label="Saldo Awal"><input type="number" min="0" step="any" inputMode="decimal" value={form.openingBalance} onChange={(event) => setForm((prev) => ({ ...prev, openingBalance: event.target.value }))} placeholder="0" disabled={saving} className={inputClass} />
                  {editingId && <p className="mt-1.5 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">Mengubah saldo awal tidak mengubah saldo berjalan. Pastikan perubahan ini sesuai dengan pencatatan awal akun.</p>}
                </Field>
                <div className="flex items-center justify-between rounded-xl border border-[#DCE6E2] bg-[#F8FAF9] px-3.5 py-3 dark:border-[#304538] dark:bg-[#1D2A22]">
                  <div><p className="text-[11px] font-bold text-[#3D5149] dark:text-[#D5E2D9]">Status Akun</p><p className="mt-0.5 text-[10px] text-[#899891] dark:text-[#91A498]">Akun aktif dapat digunakan untuk transaksi petty cash.</p></div>
                  <button type="button" role="switch" aria-checked={form.isActive} aria-label="Status akun" disabled={saving} onClick={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))} className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${form.isActive ? "bg-[#397957]" : "bg-[#B8C3BE] dark:bg-[#526158]"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${form.isActive ? "left-6" : "left-1"}`} /></button>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-[#E3EBE7] bg-[#FAFCFB] px-5 py-4 dark:border-[#2D4034] dark:bg-[#141E18]">
                <button type="button" onClick={closeModal} disabled={saving} className="h-9 rounded-lg border border-[#D7E2DD] bg-white px-4 text-[11px] font-bold text-[#63746D] transition hover:bg-[#F1F5F3] disabled:opacity-50 dark:border-[#3A5043] dark:bg-[#1A271F] dark:text-[#C0D0C5] dark:hover:bg-[#26382C]">Batal</button>
                <button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#326B52] px-4 text-[11px] font-bold text-white transition hover:bg-[#285840] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#397957] dark:hover:bg-[#438B65]">{saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}{saving ? "Menyimpan..." : "Simpan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputClass = "h-10 w-full rounded-lg border border-[#D7E2DD] bg-white px-3 text-[12px] text-[#263A33] outline-none transition placeholder:text-[#9AA9A2] focus:border-[#4B8A68] focus:ring-2 focus:ring-[#4B8A68]/10 disabled:bg-[#F3F6F4] dark:border-[#354A3F] dark:bg-[#111A15] dark:text-[#E4EDE7] dark:placeholder:text-[#74877B] dark:focus:border-[#65A77F] dark:disabled:bg-[#1B2820]";

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div><label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-[#52665E] dark:text-[#B8C9BE]">{label}</label>{children}</div>;
}

function SummaryCard({ label, value, detail, icon, accent = false }: { label: string; value: string; detail: string; icon: ReactNode; accent?: boolean }) {
  return <div className="rounded-2xl border border-[#DDE8E3] bg-white p-5 shadow-[0_4px_18px_rgba(22,45,34,0.035)] dark:border-[#2B3E33] dark:bg-[#17211B]">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82938C] dark:text-[#93A79A]">{label}</p><p className={`mt-2 break-words text-[23px] font-bold tracking-tight ${accent ? "text-[#397957] dark:text-[#94D0A8]" : "text-[#24352F] dark:text-[#E6EEE9]"}`}>{value}</p><p className="mt-1 text-[10px] text-[#95A49E] dark:text-[#819589]">{detail}</p></div><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent ? "bg-[#E7F3EC] text-[#397957] dark:bg-[#244631] dark:text-[#A6D8B6]" : "bg-[#EEF5F1] text-[#527A6B] dark:bg-[#243B2D] dark:text-[#A2D6B4]"}`}>{icon}</div></div>
  </div>;
}
