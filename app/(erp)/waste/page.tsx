"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

type Barang = {
  id: number;
  code: string;
  name: string;
  unit: string;
  stock: number;
  averageCost?: number;
};

type Waste = {
  id: number;
  number: string;
  trxDate: string;
  status: string;
  qtyProcessed: number;
  wasteQty: number;
  netQty: number;
  unitCost: number;
  totalCost: number;
  note: string | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  barang: Barang | null;
  user?: {
    id: number;
    username: string;
    fullname: string | null;
  } | null;
};

type Summary = {
  totalTransactions: number;
  totalWasteQty: number;
  totalWasteValue: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
};

const monthNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const fmt = (v: number) =>
  new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Number(v || 0));

const money = (v: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));

const date = (v: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(v));

function Badge({ status }: { status: string }) {
  const s = String(status).toUpperCase();

  if (s === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
        <CheckCircle2 size={12} />
        APPROVED
      </span>
    );
  }

  if (s === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">
        <XCircle size={12} />
        REJECTED
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
      <Clock3 size={12} />
      PENDING
    </span>
  );
}

export default function WastePusatPage() {
  const [month, setMonth] = useState(monthNow());
  const [status, setStatus] = useState("ALL");

  const [rows, setRows] = useState<Waste[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [barangs, setBarangs] = useState<Barang[]>([]);
  const [role, setRole] = useState("");

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [barangSearch, setBarangSearch] = useState("");
  const [showBarangDropdown, setShowBarangDropdown] = useState(false);

  const [form, setForm] = useState({
    barangId: "",
    wasteQty: "",
    unitCost: "",
    note: "",
  });

  const load = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const [w, b] = await Promise.all([
          fetch(`/api/waste?month=${month}&status=${status}`, {
            cache: "no-store",
          }).then((r) => r.json()),
          fetch("/api/stock", {
            cache: "no-store",
          }).then((r) => r.json()),
        ]);

        if (!w.success) {
          throw new Error(
            w.message || "Gagal mengambil Waste Pusat."
          );
        }

        setRole(String(w.role || "").toUpperCase());
        setRows(Array.isArray(w.data) ? w.data : []);
        setSummary(w.summary || null);

        if (b.success) {
          setBarangs(
            (b.data || []).map((x: any) => ({
              id: x.barang?.id ?? x.id,
              code: x.barang?.code ?? x.code,
              name: x.barang?.name ?? x.name,
              unit: x.barang?.unit ?? x.unit,
              stock: Number(x.stock ?? 0),
              averageCost: Number(x.averageCost ?? 0),
            }))
          );
        }
      } catch (e) {
        console.error("CENTRAL WASTE LOAD ERROR", e);

        alert(
          e instanceof Error
            ? e.message
            : "Gagal mengambil data."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [month, status]
  );

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return rows;

    return rows.filter((x) =>
      [
        x.number,
        x.barang?.code,
        x.barang?.name,
        x.note,
        x.user?.fullname,
      ]
        .filter(Boolean)
        .some((v) =>
          String(v).toLowerCase().includes(q)
        )
    );
  }, [rows, search]);

  const selectedBarang = useMemo(
    () =>
      barangs.find(
        (x) => String(x.id) === form.barangId
      ),
    [barangs, form.barangId]
  );

  const filteredBarangs = useMemo(() => {
    const q = barangSearch.trim().toLowerCase();

    if (!q) {
      return barangs.slice(0, 50);
    }

    return barangs
      .filter((b) =>
        [b.code, b.name, b.unit]
          .filter(Boolean)
          .some((v) =>
            String(v).toLowerCase().includes(q)
          )
      )
      .slice(0, 50);
  }, [barangs, barangSearch]);

  function selectBarang(barang: Barang) {
    setForm((f) => ({
      ...f,
      barangId: String(barang.id),
      unitCost:
        barang.averageCost && barang.averageCost > 0
          ? String(barang.averageCost)
          : "",
    }));

    setBarangSearch("");
    setShowBarangDropdown(false);
  }

  function clearBarang() {
    setForm((f) => ({
      ...f,
      barangId: "",
      unitCost: "",
    }));

    setBarangSearch("");
    setShowBarangDropdown(true);
  }

  async function createWaste() {
    const qty = Number(form.wasteQty);
    const cost =
      form.unitCost === ""
        ? 0
        : Number(form.unitCost);

    if (!form.barangId) {
      return alert("Barang wajib dipilih.");
    }

    if (!(qty > 0)) {
      return alert(
        "Qty Waste harus lebih besar dari 0."
      );
    }

    if (
      qty >
      Number(selectedBarang?.stock || 0)
    ) {
      return alert(
        "Qty Waste melebihi stock pusat."
      );
    }

    if (!(cost >= 0)) {
      return alert("Unit cost tidak valid.");
    }

    try {
      setSaving(true);

      const res = await fetch("/api/waste", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          barangId: Number(form.barangId),
          wasteQty: qty,
          unitCost: cost,
          note: form.note,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.message ||
            "Gagal membuat Waste Pusat."
        );
      }

      setShowCreate(false);

      setForm({
        barangId: "",
        wasteQty: "",
        unitCost: "",
        note: "",
      });

      setBarangSearch("");
      setShowBarangDropdown(false);

      await load(true);
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "Gagal membuat Waste Pusat."
      );
    } finally {
      setSaving(false);
    }
  }

  async function approve(id: number) {
    const row = rows.find(
      (x) => x.id === id
    );

    if (!row) return;

    if (
      !window.confirm(
        `Approve ${row.number}?\n\nStock pusat akan berkurang ${fmt(
          row.wasteQty
        )} ${row.barang?.unit || ""}.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        `/api/waste/${id}/approve`,
        {
          method: "PUT",
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        return alert(
          data.message || "Gagal approve."
        );
      }

      await load(true);
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "Gagal approve."
      );
    }
  }

  async function reject(id: number) {
    const row = rows.find(
      (x) => x.id === id
    );

    if (!row) return;

    const reason = window.prompt(
      `Alasan reject ${row.number}:`
    );

    if (reason === null) return;

    if (!reason.trim()) {
      return alert(
        "Alasan reject wajib diisi."
      );
    }

    try {
      const res = await fetch(
        `/api/waste/${id}/reject`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        return alert(
          data.message || "Gagal reject."
        );
      }

      await load(true);
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "Gagal reject."
      );
    }
  }

  function openCreate() {
    setForm({
      barangId: "",
      wasteQty: "",
      unitCost: "",
      note: "",
    });

    setBarangSearch("");
    setShowBarangDropdown(false);
    setShowCreate(true);
  }

  function closeCreate() {
    if (saving) return;

    setShowCreate(false);

    setForm({
      barangId: "",
      wasteQty: "",
      unitCost: "",
      note: "",
    });

    setBarangSearch("");
    setShowBarangDropdown(false);
  }

  return (
    <div className="min-h-screen bg-[#F5F9F6] p-5 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* HEADER */}
        <section className="relative overflow-hidden rounded-[28px] border border-white bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.05)] sm:p-8">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-100/50 blur-3xl" />

          <div className="absolute -bottom-20 right-48 h-48 w-48 rounded-full bg-teal-100/40 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

                <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                  MGB ERP • WAREHOUSE
                </span>
              </div>

              <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-[#29483A] sm:text-3xl">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E3F0EA] text-[#497F70]">
                  <Trash2 size={23} />
                </span>

                Waste Pusat
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71827A]">
                Kelola barang rusak, expired, atau kehilangan
                dari stock pusat dengan approval dan audit
                stock yang terintegrasi.
              </p>
            </div>

            {["ADMIN", "GUDANG"].includes(role) && (
              <button
                onClick={openCreate}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#3F7063]"
              >
                <Plus size={17} />
                Buat Waste
              </button>
            )}
          </div>
        </section>

        {/* SUMMARY */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "Total Transaksi",
              summary?.totalTransactions || 0,
              "bg-slate-50 text-slate-600",
            ],
            [
              "Menunggu Approval",
              summary?.pendingCount || 0,
              "bg-amber-50 text-amber-600",
            ],
            [
              "Total Waste",
              fmt(summary?.totalWasteQty || 0),
              "bg-red-50 text-red-600",
            ],
            [
              "Nilai Waste",
              money(summary?.totalWasteValue || 0),
              "bg-emerald-50 text-emerald-600",
            ],
          ].map(([label, value, cls]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-white bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.045)]"
            >
              <div
                className={`inline-flex rounded-xl px-3 py-2 text-xs font-bold ${cls}`}
              >
                {label}
              </div>

              <div className="mt-4 truncate text-2xl font-bold text-slate-800">
                {value}
              </div>
            </div>
          ))}
        </section>

        {/* TABLE */}
        <section className="rounded-2xl border border-[#DCE8E2] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                ["ALL", "Semua"],
                ["PENDING", "Pending"],
                ["APPROVED", "Approved"],
                ["REJECTED", "Rejected"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setStatus(v)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold ${
                    status === v
                      ? "bg-[#E8F3EC] text-[#29483A]"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="month"
                value={month}
                onChange={(e) =>
                  setMonth(e.target.value)
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#497F70]"
              />

              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Cari nomor / barang..."
                  className="w-56 rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-[#497F70]"
                />
              </div>

              <button
                onClick={() => load(true)}
                disabled={refreshing}
                className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
              >
                <RefreshCw
                  size={16}
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1150px] w-full text-sm">
              <thead className="bg-slate-50/80">
                <tr>
                  {[
                    "No. Waste",
                    "Tanggal",
                    "Barang",
                    "Keterangan",
                    "Qty Waste",
                    "Unit Cost",
                    "Nilai",
                    "Status",
                    "Dibuat Oleh",
                    "Aksi",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-20 text-center text-sm text-slate-400"
                    >
                      <RefreshCw className="mx-auto mb-3 animate-spin text-emerald-600" />
                      Memuat Waste Pusat...
                    </td>
                  </tr>
                ) : filtered.length ? (
                  filtered.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="px-5 py-4 font-bold text-[#497F70]">
                        {row.number}
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-500">
                        {date(row.trxDate)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-700">
                          {row.barang?.name || "-"}
                        </div>

                        <div className="text-[11px] text-slate-400">
                          {row.barang?.code || "-"}
                        </div>
                      </td>

                      {/* KETERANGAN */}
                      <td className="max-w-[260px] px-5 py-4">
                        <div
                          className="whitespace-normal break-words text-xs leading-5 text-slate-600"
                          title={row.note || "-"}
                        >
                          {row.note || "-"}
                        </div>
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-700">
                        {fmt(row.wasteQty)}{" "}
                        {row.barang?.unit}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {money(row.unitCost)}
                      </td>

                      <td className="px-5 py-4 font-semibold text-red-600">
                        {money(row.totalCost)}
                      </td>

                      <td className="px-5 py-4">
                        <Badge status={row.status} />
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-500">
                        {row.user?.fullname ||
                          row.user?.username ||
                          "-"}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          {row.status === "PENDING" &&
                            ["ADMIN", "MANAGER"].includes(
                              role
                            ) && (
                              <>
                                <button
                                  onClick={() =>
                                    approve(row.id)
                                  }
                                  className="rounded-lg bg-[#497F70] px-3 py-2 text-xs font-semibold text-white hover:bg-[#3F7063]"
                                >
                                  Approve
                                </button>

                                <button
                                  onClick={() =>
                                    reject(row.id)
                                  }
                                  className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-20 text-center"
                    >
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <Trash2 />
                      </div>

                      <p className="mt-3 text-sm font-semibold text-slate-700">
                        Belum ada data Waste Pusat
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Buat transaksi waste pertama untuk
                        mulai mencatat kehilangan stock.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeCreate();
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Buat Waste Pusat
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Transaksi dibuat PENDING dan belum
                  mengurangi stock.
                </p>
              </div>

              <button
                onClick={closeCreate}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-50"
              >
                <X />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {/* SEARCHABLE BARANG */}
              <label className="block text-sm font-semibold text-slate-600">
                Barang

                <div className="relative mt-1">
                  <input
                    type="text"
                    value={
                      form.barangId
                        ? `${selectedBarang?.code || ""} — ${
                            selectedBarang?.name || ""
                          }`
                        : barangSearch
                    }
                    onChange={(e) => {
                      setBarangSearch(
                        e.target.value
                      );

                      setShowBarangDropdown(true);

                      if (form.barangId) {
                        setForm((f) => ({
                          ...f,
                          barangId: "",
                          unitCost: "",
                        }));
                      }
                    }}
                    onFocus={() =>
                      setShowBarangDropdown(true)
                    }
                    placeholder="Ketik kode atau nama barang..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#497F70]"
                  />

                  {form.barangId && (
                    <button
                      type="button"
                      onClick={clearBarang}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  )}

                  {showBarangDropdown &&
                    !form.barangId && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() =>
                            setShowBarangDropdown(
                              false
                            )
                          }
                        />

                        <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                          {filteredBarangs.length > 0 ? (
                            filteredBarangs.map(
                              (b) => (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() =>
                                    selectBarang(
                                      b
                                    )
                                  }
                                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-emerald-50"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-slate-700">
                                      {b.code} —{" "}
                                      {b.name}
                                    </div>

                                    <div className="mt-0.5 text-[11px] text-slate-400">
                                      Stok:{" "}
                                      {fmt(
                                        b.stock
                                      )}{" "}
                                      {b.unit}
                                    </div>
                                  </div>

                                  <div className="ml-3 shrink-0 text-[11px] font-semibold text-slate-400">
                                    {b.unit}
                                  </div>
                                </button>
                              )
                            )
                          ) : (
                            <div className="px-4 py-8 text-center text-xs text-slate-400">
                              Barang tidak ditemukan
                            </div>
                          )}
                        </div>
                      </>
                    )}
                </div>
              </label>

              {/* QTY + COST */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-600">
                  Qty Waste

                  <div className="mt-1">
                    <input
                      type="number"
                      min="0.0001"
                      step="any"
                      value={form.wasteQty}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          wasteQty: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#497F70]"
                      placeholder="0"
                    />
                  </div>
                </label>

                <label className="block text-sm font-semibold text-slate-600">
                  Unit Cost

                  <div className="mt-1">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.unitCost}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          unitCost: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#497F70]"
                      placeholder="0"
                    />
                  </div>
                </label>
              </div>

              {/* NOTE */}
              <label className="block text-sm font-semibold text-slate-600">
                Catatan / Alasan

                <div className="mt-1">
                  <textarea
                    rows={3}
                    value={form.note}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        note: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#497F70]"
                    placeholder="Contoh: barang rusak / expired / pecah..."
                  />
                </div>
              </label>

              {/* STOCK INFO */}
              {selectedBarang && (
                <div className="rounded-xl bg-emerald-50 p-4 text-xs text-emerald-800">
                  <div className="font-bold">
                    Stock tersedia
                  </div>

                  <div className="mt-1 text-lg font-bold">
                    {fmt(selectedBarang.stock)}{" "}
                    {selectedBarang.unit}
                  </div>
                </div>
              )}

              {/* ACTION */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  onClick={closeCreate}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
                >
                  Batal
                </button>

                <button
                  onClick={createWaste}
                  disabled={saving}
                  className="rounded-xl bg-[#497F70] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving
                    ? "Menyimpan..."
                    : "Simpan Waste"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}