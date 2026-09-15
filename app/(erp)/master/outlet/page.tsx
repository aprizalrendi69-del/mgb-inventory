"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Power,
  X,
  Loader2,
  Store,
  MapPin,
  Phone,
  UsersRound,
  Building2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  Hash,
  MapPinned,
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

  // =========================================================
  // LOAD OUTLETS
  // =========================================================

  async function loadOutlets() {
    try {
      setLoading(true);

      const res = await fetch("/api/outlet", {
        cache: "no-store",
      });

      const data = await res.json();

      if (data.success) {
        setOutlets(data.data ?? []);
      } else {
        setOutlets([]);
      }
    } catch (error) {
      console.error("LOAD OUTLET ERROR:", error);
      setOutlets([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOutlets();
  }, []);

  // =========================================================
  // CREATE
  // =========================================================

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  // =========================================================
  // EDIT
  // =========================================================

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

  // =========================================================
  // CLOSE MODAL
  // =========================================================

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  // =========================================================
  // SUBMIT
  // =========================================================

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!form.code.trim() || !form.name.trim()) {
      alert("Kode dan nama outlet wajib diisi");
      return;
    }

    try {
      setSaving(true);

      if (editingId !== null) {
        const res = await fetch(
          `/api/outlet/${editingId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(form),
          }
        );

        const data = await res.json();

        if (!data.success) {
          alert(
            data.message ||
              "Gagal mengubah outlet"
          );
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
          alert(
            data.message ||
              "Gagal membuat outlet"
          );
          return;
        }
      }

      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);

      await loadOutlets();
    } catch (error) {
      console.error(
        "SAVE OUTLET ERROR:",
        error
      );

      alert("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // TOGGLE ACTIVE
  // =========================================================

  async function toggleActive(
    outlet: Outlet
  ) {
    const action = outlet.active
      ? "menonaktifkan"
      : "mengaktifkan";

    if (
      !confirm(
        `Yakin ingin ${action} outlet ${outlet.name}?`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        `/api/outlet/${outlet.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            active: !outlet.active,
          }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        alert(
          data.message ||
            "Gagal mengubah status outlet"
        );
        return;
      }

      await loadOutlets();
    } catch (error) {
      console.error(
        "TOGGLE OUTLET ERROR:",
        error
      );

      alert("Terjadi kesalahan");
    }
  }

  // =========================================================
  // FILTER
  // =========================================================

  const filteredOutlets = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    if (!keyword) {
      return outlets;
    }

    return outlets.filter((outlet) => {
      return (
        outlet.code
          .toLowerCase()
          .includes(keyword) ||
        outlet.name
          .toLowerCase()
          .includes(keyword) ||
        (outlet.city || "")
          .toLowerCase()
          .includes(keyword) ||
        (outlet.phone || "")
          .toLowerCase()
          .includes(keyword)
      );
    });
  }, [outlets, search]);

  // =========================================================
  // SUMMARY
  // =========================================================

  const totalOutlets = outlets.length;

  const activeOutlets = outlets.filter(
    (outlet) => outlet.active
  ).length;

  const inactiveOutlets =
    totalOutlets - activeOutlets;

  const totalAdmins = outlets.reduce(
    (total, outlet) =>
      total + (outlet._count?.users || 0),
    0
  );

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="min-h-full bg-[#F5F8F6]">
      <div className="mx-auto max-w-[1500px] space-y-6">

        {/* =================================================
            PREMIUM PAGE HEADER
        ================================================= */}

        <section className="relative overflow-hidden rounded-[30px] border border-[#DCE9E3] bg-white shadow-[0_18px_60px_rgba(24,53,45,0.07)]">

          <div className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full bg-[#497F70]/10 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-emerald-100/30 blur-3xl" />

          <div
            className="
              pointer-events-none
              absolute
              inset-0
              opacity-[0.025]
              [background-image:linear-gradient(#18352D_1px,transparent_1px),linear-gradient(90deg,#18352D_1px,transparent_1px)]
              [background-size:32px_32px]
            "
          />

          <div className="relative flex flex-col gap-6 p-6 md:p-8 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-start gap-4">

              <div className="relative shrink-0">

                <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#18352D] text-white shadow-[0_12px_30px_rgba(24,53,45,0.2)]">
                  <Store
                    size={26}
                    strokeWidth={1.8}
                  />
                </div>

                <div className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500">
                  <CheckCircle2
                    size={11}
                    strokeWidth={3}
                    className="text-white"
                  />
                </div>

              </div>

              <div>

                <div className="mb-1 flex flex-wrap items-center gap-2">

                  <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#497F70]">
                    MGB Master Data
                  </span>

                  <span className="h-1 w-1 rounded-full bg-slate-300" />

                  <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Outlet Management
                  </span>

                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-[30px]">
                  Master Outlet
                </h1>

                <p className="mt-1.5 max-w-xl text-xs leading-5 text-slate-400 md:text-sm">
                  Kelola identitas, lokasi,
                  kontak, dan status operasional
                  seluruh outlet perusahaan.
                </p>

              </div>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="
                group
                inline-flex
                min-h-[48px]
                items-center
                justify-center
                gap-2.5
                rounded-2xl
                bg-[#497F70]
                px-5
                text-xs
                font-bold
                text-white
                shadow-[0_12px_28px_rgba(73,127,112,0.2)]
                transition-all
                duration-300
                hover:-translate-y-0.5
                hover:bg-[#3F6F62]
                hover:shadow-[0_16px_32px_rgba(73,127,112,0.25)]
              "
            >
              <Plus
                size={17}
                strokeWidth={2.2}
                className="transition-transform duration-300 group-hover:rotate-90"
              />

              Tambah Outlet

              <ChevronRight
                size={15}
                className="opacity-50 transition-transform group-hover:translate-x-0.5"
              />
            </button>

          </div>
        </section>

        {/* =================================================
            KPI
        ================================================= */}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

          <SummaryCard
            icon={<Building2 size={18} />}
            label="Total Outlet"
            value={totalOutlets}
            description="Seluruh outlet terdaftar"
            tone="green"
          />

          <SummaryCard
            icon={<CheckCircle2 size={18} />}
            label="Outlet Aktif"
            value={activeOutlets}
            description="Sedang beroperasi"
            tone="emerald"
          />

          <SummaryCard
            icon={<XCircle size={18} />}
            label="Nonaktif"
            value={inactiveOutlets}
            description="Tidak aktif saat ini"
            tone="slate"
          />

          <SummaryCard
            icon={<UsersRound size={18} />}
            label="Admin Outlet"
            value={totalAdmins}
            description="User terhubung ke outlet"
            tone="blue"
          />

        </div>

        {/* =================================================
            MAIN TABLE CARD
        ================================================= */}

        <section className="overflow-hidden rounded-[30px] border border-[#DCE9E3] bg-white shadow-[0_18px_60px_rgba(24,53,45,0.055)]">

          {/* =================================================
              TOOLBAR
          ================================================= */}

          <div className="border-b border-[#E8EFEC] p-5 md:p-6">

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                    <Store size={17} />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold tracking-tight text-[#18352D]">
                      Daftar Outlet
                    </h2>

                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Data master lokasi operasional
                      MGB.
                    </p>
                  </div>

                </div>

              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

                {/* SEARCH */}

                <div className="relative w-full sm:w-[320px]">

                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                    placeholder="Cari nama, kode, kota..."
                    className="
                      h-11
                      w-full
                      rounded-2xl
                      border
                      border-[#D9E6E0]
                      bg-[#F8FBF9]
                      pl-10
                      pr-10
                      text-xs
                      font-medium
                      text-slate-700
                      outline-none
                      transition-all
                      placeholder:text-slate-400
                      focus:border-[#497F70]
                      focus:bg-white
                      focus:ring-4
                      focus:ring-[#497F70]/8
                    "
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() =>
                        setSearch("")
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}

                </div>

                <button
                  type="button"
                  onClick={loadOutlets}
                  disabled={loading}
                  className="
                    inline-flex
                    h-11
                    items-center
                    justify-center
                    gap-2
                    rounded-2xl
                    border
                    border-[#D9E6E0]
                    bg-[#F8FBF9]
                    px-4
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-[0.12em]
                    text-[#497F70]
                    transition
                    hover:border-[#BCD3C8]
                    hover:bg-[#EFF7F3]
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
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

              </div>

            </div>

            {/* RESULT META */}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">

              <div className="flex items-center gap-2">

                <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />

                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                  Showing
                </span>

                <span className="text-[10px] font-bold text-[#18352D]">
                  {filteredOutlets.length}
                </span>

                <span className="text-[9px] text-slate-400">
                  dari {totalOutlets} outlet
                </span>

              </div>

              {search && (
                <div className="rounded-full bg-[#EFF7F3] px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.13em] text-[#497F70]">
                  Filter aktif
                </div>
              )}

            </div>

          </div>

          {/* =================================================
              TABLE
          ================================================= */}

          <div className="overflow-x-auto">

            <table className="w-full min-w-[950px]">

              <thead>
                <tr className="border-b border-[#E8EFEC] bg-[#F8FAF9]">

                  <th className="px-6 py-4 text-left text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Outlet
                  </th>

                  <th className="px-6 py-4 text-left text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Lokasi
                  </th>

                  <th className="px-6 py-4 text-left text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Kontak
                  </th>

                  <th className="px-6 py-4 text-center text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Admin
                  </th>

                  <th className="px-6 py-4 text-center text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Status
                  </th>

                  <th className="px-6 py-4 text-right text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Aksi
                  </th>

                </tr>
              </thead>

              <tbody>

                {loading ? (
                  <LoadingRows />
                ) : filteredOutlets.length === 0 ? (
                  <EmptyState
                    hasSearch={Boolean(
                      search
                    )}
                    onClear={() =>
                      setSearch("")
                    }
                    onCreate={
                      openCreate
                    }
                  />
                ) : (
                  filteredOutlets.map(
                    (outlet) => (
                      <OutletRow
                        key={outlet.id}
                        outlet={outlet}
                        onEdit={openEdit}
                        onToggle={
                          toggleActive
                        }
                      />
                    )
                  )
                )}

              </tbody>

            </table>

          </div>

          {/* =================================================
              TABLE FOOTER
          ================================================= */}

          {!loading &&
            filteredOutlets.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-[#E8EFEC] bg-[#FBFCFB] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex items-center gap-2 text-[9px] text-slate-400">

                  <ShieldCheck
                    size={14}
                    className="text-[#497F70]"
                  />

                  <span>
                    Data outlet dikelola melalui
                    Master Data MGB ERP.
                  </span>

                </div>

                <div className="text-[9px] font-semibold text-slate-400">
                  {filteredOutlets.length} record
                </div>

              </div>
            )}

        </section>

      </div>

      {/* =====================================================
          MODAL
      ===================================================== */}

      {modalOpen && (
        <div
          className="
            fixed
            inset-0
            z-[500]
            flex
            items-center
            justify-center
            bg-[#0B211B]/60
            p-4
            backdrop-blur-sm
          "
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !saving
            ) {
              closeModal();
            }
          }}
        >

          <div
            className="
              relative
              w-full
              max-w-xl
              overflow-hidden
              rounded-[30px]
              border
              border-[#DCE9E3]
              bg-white
              shadow-[0_30px_100px_rgba(10,35,27,0.25)]
            "
          >

            {/* MODAL DECORATION */}

            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[#497F70]/10 blur-3xl" />

            {/* MODAL HEADER */}

            <div className="relative border-b border-[#E7EFEB] px-6 py-5 md:px-7">

              <div className="flex items-start justify-between gap-4">

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-[#EAF3EF] text-[#497F70]">
                    {editingId !== null ? (
                      <Pencil size={19} />
                    ) : (
                      <Plus size={20} />
                    )}
                  </div>

                  <div>

                    <div className="text-[8px] font-bold uppercase tracking-[0.22em] text-[#497F70]">
                      {editingId !== null
                        ? "Update Master Data"
                        : "Create Master Data"}
                    </div>

                    <h2 className="mt-0.5 text-base font-bold tracking-tight text-[#18352D]">
                      {editingId !== null
                        ? "Edit Outlet"
                        : "Tambah Outlet"}
                    </h2>

                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Lengkapi informasi outlet
                      perusahaan.
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-[#E2EAE6]
                    bg-[#F8FAF9]
                    text-slate-400
                    transition
                    hover:border-slate-200
                    hover:bg-slate-100
                    hover:text-slate-700
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  <X size={17} />
                </button>

              </div>

            </div>

            {/* FORM */}

            <form
              onSubmit={handleSubmit}
              className="relative space-y-5 p-6 md:p-7"
            >

              {/* BASIC INFO */}

              <div className="rounded-[22px] border border-[#E3ECE7] bg-[#F8FAF9] p-4">

                <div className="mb-4 flex items-center gap-2">

                  <Hash
                    size={14}
                    className="text-[#497F70]"
                  />

                  <span className="text-[9px] font-bold uppercase tracking-[0.17em] text-[#35564C]">
                    Identitas Outlet
                  </span>

                </div>

                <div className="grid gap-4 sm:grid-cols-2">

                  <FormField
                    label="Kode Outlet"
                    required
                  >
                    <input
                      value={form.code}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          code: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="OUT-001"
                      required
                      className={inputClass}
                    />
                  </FormField>

                  <FormField
                    label="Nama Outlet"
                    required
                  >
                    <input
                      value={form.name}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          name: e.target.value,
                        })
                      }
                      placeholder="Outlet Bandung"
                      required
                      className={inputClass}
                    />
                  </FormField>

                </div>

              </div>

              {/* LOCATION */}

              <div className="rounded-[22px] border border-[#E3ECE7] bg-white">

                <div className="flex items-center gap-2 border-b border-[#E8EFEC] px-4 py-3.5">

                  <MapPinned
                    size={14}
                    className="text-[#497F70]"
                  />

                  <span className="text-[9px] font-bold uppercase tracking-[0.17em] text-[#35564C]">
                    Lokasi
                  </span>

                </div>

                <div className="space-y-4 p-4">

                  <FormField label="Alamat">
                    <textarea
                      value={form.address}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          address:
                            e.target.value,
                        })
                      }
                      rows={3}
                      placeholder="Alamat lengkap outlet"
                      className={`${inputClass} min-h-[88px] resize-none py-3`}
                    />
                  </FormField>

                  <FormField label="Kota">
                    <input
                      value={form.city}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          city: e.target.value,
                        })
                      }
                      placeholder="Bandung"
                      className={inputClass}
                    />
                  </FormField>

                </div>

              </div>

              {/* CONTACT */}

              <div className="rounded-[22px] border border-[#E3ECE7] bg-white">

                <div className="flex items-center gap-2 border-b border-[#E8EFEC] px-4 py-3.5">

                  <Phone
                    size={14}
                    className="text-[#497F70]"
                  />

                  <span className="text-[9px] font-bold uppercase tracking-[0.17em] text-[#35564C]">
                    Informasi Kontak
                  </span>

                </div>

                <div className="p-4">

                  <FormField label="Telepon">
                    <input
                      value={form.phone}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          phone: e.target.value,
                        })
                      }
                      placeholder="08xxxxxxxxxx"
                      className={inputClass}
                    />
                  </FormField>

                </div>

              </div>

              {/* FOOTER */}

              <div className="flex flex-col-reverse gap-3 border-t border-[#E8EFEC] pt-5 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex items-center gap-2">

                  <ShieldCheck
                    size={14}
                    className="text-[#497F70]"
                  />

                  <span className="text-[9px] text-slate-400">
                    Data akan tersimpan ke master
                    outlet.
                  </span>

                </div>

                <div className="flex gap-2">

                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="
                      rounded-2xl
                      border
                      border-[#DDE7E2]
                      bg-white
                      px-4
                      py-2.5
                      text-xs
                      font-bold
                      text-slate-600
                      transition
                      hover:bg-[#F8FAF9]
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="
                      inline-flex
                      min-w-[150px]
                      items-center
                      justify-center
                      gap-2
                      rounded-2xl
                      bg-[#18352D]
                      px-5
                      py-2.5
                      text-xs
                      font-bold
                      text-white
                      shadow-[0_10px_24px_rgba(24,53,45,0.16)]
                      transition-all
                      hover:-translate-y-0.5
                      hover:bg-[#21473C]
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                  >
                    {saving ? (
                      <>
                        <Loader2
                          size={15}
                          className="animate-spin"
                        />

                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <CheckCircle2
                          size={15}
                        />

                        {editingId !== null
                          ? "Simpan Perubahan"
                          : "Simpan Outlet"}
                      </>
                    )}
                  </button>

                </div>

              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}

// =============================================================
// INPUT STYLE
// =============================================================

const inputClass = `
  h-11
  w-full
  rounded-2xl
  border
  border-[#D9E6E0]
  bg-[#F9FBFA]
  px-3.5
  text-xs
  font-medium
  text-slate-700
  outline-none
  transition-all
  placeholder:text-slate-400
  focus:border-[#497F70]
  focus:bg-white
  focus:ring-4
  focus:ring-[#497F70]/8
`;

// =============================================================
// FORM FIELD
// =============================================================

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}

// =============================================================
// SUMMARY CARD
// =============================================================

function SummaryCard({
  icon,
  label,
  value,
  description,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  description: string;
  tone:
    | "green"
    | "emerald"
    | "slate"
    | "blue";
}) {
  const toneClass = {
    green:
      "bg-[#EAF3EF] text-[#497F70]",
    emerald:
      "bg-emerald-50 text-emerald-600",
    slate:
      "bg-slate-100 text-slate-500",
    blue:
      "bg-sky-50 text-sky-600",
  }[tone];

  return (
    <div className="group relative overflow-hidden rounded-[24px] border border-[#DCE9E3] bg-white p-5 shadow-[0_10px_35px_rgba(24,53,45,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(24,53,45,0.07)]">

      <div className="flex items-start justify-between gap-3">

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-[14px] ${toneClass}`}
        >
          {icon}
        </div>

        <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-slate-300">
          MGB ERP
        </span>

      </div>

      <div className="mt-4">

        <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
          {label}
        </div>

        <div className="mt-1 text-2xl font-bold tracking-tight text-[#18352D]">
          {value}
        </div>

        <div className="mt-1 text-[9px] text-slate-400">
          {description}
        </div>

      </div>

    </div>
  );
}

// =============================================================
// OUTLET ROW
// =============================================================

function OutletRow({
  outlet,
  onEdit,
  onToggle,
}: {
  outlet: Outlet;
  onEdit: (outlet: Outlet) => void;
  onToggle: (outlet: Outlet) => void;
}) {
  const adminCount =
    outlet._count?.users || 0;

  return (
    <tr className="group border-b border-[#EEF3F0] transition-colors last:border-0 hover:bg-[#FAFCFB]">

      {/* OUTLET */}

      <td className="px-6 py-5">

        <div className="flex items-center gap-3.5">

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#EAF3EF] text-[#497F70] transition-all duration-300 group-hover:bg-[#18352D] group-hover:text-white">
            <Store size={18} />
          </div>

          <div className="min-w-0">

            <div className="flex items-center gap-2">

              <p className="truncate text-xs font-bold text-[#18352D]">
                {outlet.name}
              </p>

              {outlet.active && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              )}

            </div>

            <div className="mt-1 flex items-center gap-1.5">

              <Hash
                size={10}
                className="text-slate-300"
              />

              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                {outlet.code}
              </p>

            </div>

          </div>

        </div>

      </td>

      {/* LOCATION */}

      <td className="px-6 py-5">

        <div className="flex items-start gap-2.5">

          <MapPin
            size={14}
            className="mt-0.5 shrink-0 text-[#497F70]"
          />

          <div className="min-w-0">

            <p className="max-w-[270px] truncate text-[11px] font-semibold text-slate-600">
              {outlet.address || "-"}
            </p>

            <p className="mt-1 text-[9px] font-medium text-slate-400">
              {outlet.city || "Kota belum diisi"}
            </p>

          </div>

        </div>

      </td>

      {/* CONTACT */}

      <td className="px-6 py-5">

        <div className="flex items-center gap-2">

          <Phone
            size={13}
            className="shrink-0 text-slate-300"
          />

          <span className="text-[10px] font-semibold text-slate-600">
            {outlet.phone || "-"}
          </span>

        </div>

      </td>

      {/* ADMIN */}

      <td className="px-6 py-5 text-center">

        <div className="inline-flex items-center gap-2 rounded-xl bg-[#F5F8F6] px-3 py-2">

          <UsersRound
            size={13}
            className="text-[#497F70]"
          />

          <span className="text-[10px] font-bold text-[#18352D]">
            {adminCount}
          </span>

        </div>

      </td>

      {/* STATUS */}

      <td className="px-6 py-5 text-center">

        {outlet.active ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.12em] text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Aktif
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Nonaktif
          </span>
        )}

      </td>

      {/* ACTION */}

      <td className="px-6 py-5">

        <div className="flex justify-end gap-2">

          <button
            type="button"
            onClick={() => onEdit(outlet)}
            title="Edit outlet"
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-xl
              border
              border-[#DCE7E2]
              bg-white
              text-slate-400
              transition-all
              hover:border-[#BCD3C8]
              hover:bg-[#EFF7F3]
              hover:text-[#497F70]
            "
          >
            <Pencil size={14} />
          </button>

          <button
            type="button"
            onClick={() =>
              onToggle(outlet)
            }
            title={
              outlet.active
                ? "Nonaktifkan"
                : "Aktifkan"
            }
            className={`
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-xl
              border
              transition-all
              ${
                outlet.active
                  ? "border-red-100 bg-white text-red-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  : "border-emerald-100 bg-white text-emerald-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              }
            `}
          >
            <Power size={14} />
          </button>

        </div>

      </td>

    </tr>
  );
}

// =============================================================
// LOADING ROWS
// =============================================================

function LoadingRows() {
  return (
    <>
      {[1, 2, 3, 4].map((item) => (
        <tr
          key={item}
          className="border-b border-[#EEF3F0]"
        >
          <td
            colSpan={6}
            className="px-6 py-5"
          >
            <div className="flex animate-pulse items-center gap-4">

              <div className="h-11 w-11 rounded-[15px] bg-slate-100" />

              <div className="flex-1 space-y-2">

                <div className="h-3 w-40 rounded-full bg-slate-100" />

                <div className="h-2.5 w-24 rounded-full bg-slate-100" />

              </div>

              <div className="hidden h-8 w-24 rounded-xl bg-slate-100 md:block" />

              <div className="hidden h-8 w-20 rounded-xl bg-slate-100 md:block" />

            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

// =============================================================
// EMPTY STATE
// =============================================================

function EmptyState({
  hasSearch,
  onClear,
  onCreate,
}: {
  hasSearch: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  return (
    <tr>
      <td
        colSpan={6}
        className="px-6 py-16"
      >

        <div className="mx-auto flex max-w-md flex-col items-center text-center">

          <div className="relative">

            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#EAF3EF] text-[#497F70]">
              {hasSearch ? (
                <Search size={26} />
              ) : (
                <Store size={26} />
              )}
            </div>

            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-100">
              <X
                size={11}
                className="text-slate-400"
              />
            </div>

          </div>

          <h3 className="mt-5 text-sm font-bold text-[#18352D]">
            {hasSearch
              ? "Outlet tidak ditemukan"
              : "Belum ada outlet"}
          </h3>

          <p className="mt-1.5 max-w-sm text-[10px] leading-5 text-slate-400">
            {hasSearch
              ? "Tidak ada outlet yang sesuai dengan kata pencarian."
              : "Belum terdapat data outlet pada master data MGB."}
          </p>

          <div className="mt-5 flex gap-2">

            {hasSearch && (
              <button
                type="button"
                onClick={onClear}
                className="rounded-xl border border-[#DCE7E2] bg-white px-4 py-2.5 text-[10px] font-bold text-slate-600 transition hover:bg-[#F8FAF9]"
              >
                Reset Pencarian
              </button>
            )}

            {!hasSearch && (
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-[10px] font-bold text-white transition hover:bg-[#3F6F62]"
              >
                <Plus size={14} />
                Tambah Outlet
              </button>
            )}

          </div>

        </div>

      </td>
    </tr>
  );
}