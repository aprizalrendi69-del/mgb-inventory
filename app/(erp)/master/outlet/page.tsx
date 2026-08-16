"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Power,
  X,
  Loader2,
  Store,
} from "lucide-react";

type Outlet = {
  id: number;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  active: boolean;
  _count?: {
    users: number;
  };
};

type FormData = {
  code: string;
  name: string;
  address: string;
  city: string;
  phone: string;
};

const emptyForm: FormData = {
  code: "",
  name: "",
  address: "",
  city: "",
  phone: "",
};

export default function MasterOutletPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState<FormData>(emptyForm);

  async function loadOutlets() {
    try {
      setLoading(true);

      const res = await fetch("/api/outlet");
      const data = await res.json();

      if (data.success) {
        setOutlets(data.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOutlets();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(outlet: Outlet) {
    setEditingId(outlet.id);

    setForm({
      code: outlet.code,
      name: outlet.name,
      address: outlet.address || "",
      city: outlet.city || "",
      phone: outlet.phone || "",
    });

    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.code.trim() || !form.name.trim()) {
      alert("Kode dan nama outlet wajib diisi");
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        const res = await fetch(`/api/outlet/${editingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        });

        const data = await res.json();

        if (!data.success) {
          alert(data.message || "Gagal mengubah outlet");
          return;
        }
      } else {
        const res = await fetch("/api/outlet", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        });

        const data = await res.json();

        if (!data.success) {
          alert(data.message || "Gagal membuat outlet");
          return;
        }
      }

      closeModal();
      await loadOutlets();
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(outlet: Outlet) {
    const action = outlet.active ? "menonaktifkan" : "mengaktifkan";

    if (!confirm(`Yakin ingin ${action} outlet ${outlet.name}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/outlet/${outlet.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          active: !outlet.active,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.message || "Gagal mengubah status outlet");
        return;
      }

      await loadOutlets();
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan");
    }
  }

  const filteredOutlets = outlets.filter((outlet) => {
    const keyword = search.toLowerCase();

    return (
      outlet.code.toLowerCase().includes(keyword) ||
      outlet.name.toLowerCase().includes(keyword) ||
      (outlet.city || "").toLowerCase().includes(keyword)
    );
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Master Outlet
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Kelola data outlet perusahaan
          </p>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#527A6B] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#486D60]"
        >
          <Plus size={17} />
          Tambah Outlet
        </button>
      </div>

      {/* CARD */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* TOOLBAR */}

        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:w-80">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari outlet..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-[#527A6B] focus:bg-white"
            />
          </div>

          <div className="text-sm text-slate-500">
            Total outlet:{" "}
            <span className="font-bold text-slate-700">
              {filteredOutlets.length}
            </span>
          </div>
        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Outlet
                </th>

                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Alamat
                </th>

                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Telepon
                </th>

                <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  Admin
                </th>

                <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  Status
                </th>

                <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center"
                  >
                    <Loader2
                      className="mx-auto animate-spin text-[#527A6B]"
                      size={24}
                    />

                    <p className="mt-2 text-sm text-slate-500">
                      Memuat data outlet...
                    </p>
                  </td>
                </tr>
              ) : filteredOutlets.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center"
                  >
                    <Store
                      size={32}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      Belum ada outlet
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Tambahkan outlet pertama.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOutlets.map((outlet) => (
                  <tr
                    key={outlet.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F3EC] text-[#527A6B]">
                          <Store size={18} />
                        </div>

                        <div>
                          <p className="font-bold text-slate-800">
                            {outlet.name}
                          </p>

                          <p className="mt-0.5 text-xs font-medium text-slate-400">
                            {outlet.code}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {outlet.address || "-"}
                      {outlet.city && (
                        <span className="block text-xs text-slate-400">
                          {outlet.city}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {outlet.phone || "-"}
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span className="font-semibold text-slate-700">
                        {outlet._count?.users || 0}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-center">
                      {outlet.active ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          AKTIF
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                          NONAKTIF
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(outlet)}
                          className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          onClick={() => toggleActive(outlet)}
                          className={`rounded-lg border p-2 transition ${
                            outlet.active
                              ? "border-red-200 text-red-500 hover:bg-red-50"
                              : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={
                            outlet.active
                              ? "Nonaktifkan"
                              : "Aktifkan"
                          }
                        >
                          <Power size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-800">
                  {editingId ? "Edit Outlet" : "Tambah Outlet"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-400">
                  Lengkapi informasi outlet
                </p>
              </div>

              <button
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-4 p-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Kode Outlet *
                  </label>

                  <input
                    value={form.code}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="OUT-001"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#527A6B]"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Nama Outlet *
                  </label>

                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        name: e.target.value,
                      })
                    }
                    placeholder="Outlet Bandung"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#527A6B]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Alamat
                </label>

                <textarea
                  value={form.address}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      address: e.target.value,
                    })
                  }
                  rows={3}
                  placeholder="Alamat lengkap outlet"
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#527A6B]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Kota
                  </label>

                  <input
                    value={form.city}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        city: e.target.value,
                      })
                    }
                    placeholder="Bandung"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#527A6B]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Telepon
                  </label>

                  <input
                    value={form.phone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        phone: e.target.value,
                      })
                    }
                    placeholder="08xxxxxxxxxx"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#527A6B]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#527A6B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#486D60] disabled:opacity-60"
                >
                  {saving && (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  )}

                  {editingId ? "Simpan Perubahan" : "Simpan Outlet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}