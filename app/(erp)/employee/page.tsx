"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode, type FormEvent } from "react";
import {
  Users,
  UserPlus,
  RefreshCw,
  Eye,
  Phone,
  BriefcaseBusiness,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpRight,
  Building2,
  UserRoundCheck,
  UserRoundX,
  X,
  CircleAlert,
  ContactRound,
  Sparkles,
} from "lucide-react";

type Employee = {
  id: string | number;
  nik?: string | null;
  name?: string | null;
  position?: string | null;
  department?: string | null;
  phone?: string | null;
  photo?: string | null;
  active?: boolean | null;
};

type StatusFilter = "all" | "active" | "inactive";

type EmployeeForm = {
  nik: string;
  name: string;
  gender: string;
  position: string;
  department: string;
  phone: string;
  address: string;
};

type AttendanceRecord = {
  id: string | number;
  date?: string | Date | null;
  checkIn?: string | Date | null;
  checkOut?: string | Date | null;
  photoIn?: string | null;
  photoOut?: string | null;
  status?: string | null;
};

type EmployeeDetail = Employee & {
  gender?: string | null;
  address?: string | null;
  attendances?: AttendanceRecord[];
};

function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "K";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export default function EmployeePage() {
  const [data, setData] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<EmployeeForm>({
    nik: "",
    name: "",
    gender: "",
    position: "",
    department: "",
    phone: "",
    address: "",
  });
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const loadEmployee = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      const res = await fetch("/api/employee", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Gagal mengambil data karyawan (HTTP ${res.status}).`);
      }

      const json = await res.json();
      console.log("EMPLOYEE:", json);

      if (json?.success) {
        setData(Array.isArray(json.data) ? json.data : []);
      } else {
        throw new Error(json?.message || json?.error || "Data karyawan tidak dapat dimuat.");
      }
    } catch (err) {
      console.error("LOAD EMPLOYEE ERROR:", err);
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data.");
      setData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadEmployee();
  }, [loadEmployee]);

  const departments = useMemo(() => {
    const unique = new Set(
      data.map((employee) => employee.department?.trim()).filter((value): value is string => Boolean(value)),
    );
    return [...unique].sort((a, b) => a.localeCompare(b, "id"));
  }, [data]);

  const activeCount = data.filter((employee) => Boolean(employee.active)).length;
  const inactiveCount = data.length - activeCount;

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id");
    return data.filter((employee) => {
      const matchesSearch = !query || [
        employee.name,
        employee.nik,
        employee.position,
        employee.department,
        employee.phone,
      ].some((value) => String(value ?? "").toLocaleLowerCase("id").includes(query));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && Boolean(employee.active)) ||
        (statusFilter === "inactive" && !employee.active);

      const matchesDepartment =
        departmentFilter === "all" || employee.department?.trim() === departmentFilter;

      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [data, search, statusFilter, departmentFilter]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDepartmentFilter("all");
  };

  const openCreateModal = () => {
    setForm({
      nik: "",
      name: "",
      gender: "",
      position: "",
      department: "",
      phone: "",
      address: "",
    });
    setFormError("");
    setIsCreateOpen(true);
  };

  const saveEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const res = await fetch("/api/employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || json?.error || `Gagal menyimpan karyawan (HTTP ${res.status}).`);
      }

      await loadEmployee(true);
      setIsCreateOpen(false);
      setForm({
        nik: "",
        name: "",
        gender: "",
        position: "",
        department: "",
        phone: "",
        address: "",
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan karyawan.");
    } finally {
      setSaving(false);
    }
  };

  const openDetailModal = async (employee: Employee) => {
    setSelectedEmployee(null);
    setDetailError("");
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/employee/${employee.id}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success || !json?.data) {
        throw new Error(json?.message || json?.error || "Detail karyawan gagal dimuat.");
      }
      setSelectedEmployee({
        ...json.data,
        attendances: Array.isArray(json.data.attendances) ? json.data.attendances : [],
      });
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat detail.");
      setSelectedEmployee({ ...employee, attendances: [] });
    } finally {
      setDetailLoading(false);
    }
  };

  const formatDate = (value?: string | Date | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    });
  };

  const formatTime = (value?: string | Date | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    });
  };

  return (
    <main className="min-h-full bg-[#F4F7F5] dark:bg-[#0B1511] px-4 py-5 text-[#18352D] dark:text-[#E3EEE7] sm:px-6 sm:py-7 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        {/* Page heading */}
        <section className="relative mb-7 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#173D32] via-[#285D4D] to-[#497F70] p-6 text-white shadow-[0_18px_45px_rgba(31,76,61,0.16)] sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-2 -top-14 h-52 w-52 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute bottom-[-90px] right-[24%] h-52 w-52 rounded-full bg-white/[0.05] blur-2xl" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner backdrop-blur-sm sm:h-16 sm:w-16">
                <ContactRound size={29} strokeWidth={1.7} />
              </div>
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.17em] text-emerald-50">
                  <Sparkles size={12} />
                  People management
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-[34px]">
                  Master Karyawan
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/80 sm:text-[15px]">
                  Kelola data pegawai, informasi pekerjaan, dan status karyawan dalam satu tempat.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => void loadEmployee(true)}
                disabled={loading || refreshing}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                Perbarui data
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white dark:bg-[#15231C] px-4 py-2.5 text-sm font-bold text-[#245342] dark:text-[#D0E5D8] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-emerald-50"
              >
                <UserPlus size={17} />
                Tambah karyawan
                <ArrowUpRight size={15} className="ml-0.5 opacity-70" />
              </button>
            </div>
          </div>
        </section>

        {/* Summary cards */}
        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            label="Total karyawan"
            value={data.length}
            note="Seluruh data terdaftar"
            icon={<Users size={21} />}
            tone="green"
            loading={loading}
          />
          <SummaryCard
            label="Karyawan aktif"
            value={activeCount}
            note={data.length ? `${Math.round((activeCount / data.length) * 100)}% dari seluruh karyawan` : "Belum ada data"}
            icon={<UserRoundCheck size={21} />}
            tone="emerald"
            loading={loading}
          />
          <SummaryCard
            label="Karyawan nonaktif"
            value={inactiveCount}
            note="Perlu ditinjau bila diperlukan"
            icon={<UserRoundX size={21} />}
            tone="rose"
            loading={loading}
          />
        </section>

        {/* Main content */}
        <section className="overflow-hidden rounded-[24px] border border-[#E0EAE4] dark:border-[#2A4034] bg-white dark:bg-[#15231C] shadow-[0_8px_30px_rgba(28,61,48,0.045)]">
          <div className="flex flex-col gap-4 border-b border-[#EAF0EC] dark:border-[#2A4034] p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-[#203F34] dark:text-[#E3EEE7] sm:text-xl">
                  Daftar karyawan
                </h2>
                <span className="rounded-lg bg-[#EDF5F0] dark:bg-[#20372B] px-2 py-1 text-xs font-bold text-[#477663] dark:text-[#A8D0B7]">
                  {loading ? "…" : filteredEmployees.length.toLocaleString("id-ID")}
                </span>
              </div>
              <p className="mt-1 text-sm text-[#84948C] dark:text-[#A1B4A8]">
                Cari pegawai dan saring berdasarkan status atau departemen.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative block min-w-0 sm:min-w-[260px] lg:min-w-[300px]">
                <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#91A198] dark:text-[#91A99A]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari nama, NIK, jabatan..."
                  className="h-11 w-full rounded-xl border border-[#DDE8E1] dark:border-[#30483A] bg-[#FBFCFB] dark:bg-[#111D16] pl-10 pr-10 text-sm text-[#234438] dark:text-[#D9E8DE] outline-none transition placeholder:text-[#A0ADA6] dark:text-[#91A99A] focus:border-[#6B9A85] focus:bg-white dark:focus:bg-[#15231C] focus:ring-4 focus:ring-[#497F70]/10"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Hapus pencarian"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#91A198] dark:text-[#91A99A] hover:bg-[#EDF4EF] dark:bg-[#20372B] hover:text-[#315D4A] dark:text-[#C7E0D0]"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>

              <label className="relative block sm:min-w-[155px]">
                <SlidersHorizontal size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7E9387] dark:text-[#A1B4A8]" />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  className="h-11 w-full appearance-none rounded-xl border border-[#DDE8E1] dark:border-[#30483A] bg-[#FBFCFB] dark:bg-[#111D16] pl-9 pr-9 text-sm font-medium text-[#456356] dark:text-[#B7CBBE] outline-none transition focus:border-[#6B9A85] focus:ring-4 focus:ring-[#497F70]/10"
                >
                  <option value="all">Semua status</option>
                  <option value="active">Aktif saja</option>
                  <option value="inactive">Nonaktif saja</option>
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7E9387] dark:text-[#A1B4A8]" />
              </label>

              {departments.length > 0 && (
                <label className="relative block sm:min-w-[170px]">
                  <Building2 size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7E9387] dark:text-[#A1B4A8]" />
                  <select
                    value={departmentFilter}
                    onChange={(event) => setDepartmentFilter(event.target.value)}
                    className="h-11 w-full appearance-none rounded-xl border border-[#DDE8E1] dark:border-[#30483A] bg-[#FBFCFB] dark:bg-[#111D16] pl-9 pr-9 text-sm font-medium text-[#456356] dark:text-[#B7CBBE] outline-none transition focus:border-[#6B9A85] focus:ring-4 focus:ring-[#497F70]/10"
                  >
                    <option value="all">Semua departemen</option>
                    {departments.map((department) => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </select>
                  <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7E9387] dark:text-[#A1B4A8]" />
                </label>
              )}
            </div>
          </div>

          {error && (
            <div className="mx-5 mt-5 flex flex-col gap-3 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-[#351F22] p-4 sm:mx-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <CircleAlert size={19} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-300" />
                <div>
                  <p className="text-sm font-bold text-rose-800 dark:text-rose-200">Data belum berhasil dimuat</p>
                  <p className="mt-1 text-sm text-rose-700 dark:text-rose-200">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadEmployee()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-white dark:bg-[#15231C] px-3 py-2 text-sm font-semibold text-rose-700 dark:text-rose-200 transition hover:bg-rose-100"
              >
                <RefreshCw size={14} />
                Coba lagi
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#E8EFEB] dark:border-[#2A4034] bg-[#F8FAF8] dark:bg-[#18261E] text-[11px] font-bold uppercase tracking-[0.11em] text-[#809288] dark:text-[#A1B4A8]">
                  <th className="px-6 py-4">Karyawan</th>
                  <th className="px-5 py-4">NIK</th>
                  <th className="px-5 py-4">Jabatan</th>
                  <th className="px-5 py-4">Departemen</th>
                  <th className="px-5 py-4">Kontak</th>
                  <th className="px-5 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2EF]">
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 7 }).map((__, cell) => (
                        <td key={cell} className="px-5 py-5">
                          <div className="h-4 animate-pulse rounded-md bg-[#EEF3EF] dark:bg-[#26362D]" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !error && filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF5F0] dark:bg-[#20372B] text-[#5B8B75] dark:text-[#A8D0B7]">
                          {search || statusFilter !== "all" || departmentFilter !== "all" ? <Search size={27} /> : <Users size={28} />}
                        </div>
                        <p className="mt-4 font-bold text-[#29483A] dark:text-[#E0ECE4]">
                          {search || statusFilter !== "all" || departmentFilter !== "all"
                            ? "Tidak ada hasil yang cocok"
                            : "Belum ada data karyawan"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#91A097] dark:text-[#91A99A]">
                          {search || statusFilter !== "all" || departmentFilter !== "all"
                            ? "Coba ubah kata kunci atau reset filter untuk melihat data lainnya."
                            : "Data karyawan yang ditambahkan akan muncul di daftar ini."}
                        </p>
                        {(search || statusFilter !== "all" || departmentFilter !== "all") && (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="mt-4 rounded-xl border border-[#D7E5DC] dark:border-[#30483A] px-4 py-2 text-sm font-semibold text-[#477663] dark:text-[#A8D0B7] transition hover:bg-[#F1F7F3] dark:bg-[#20372B]"
                          >
                            Reset filter
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="group transition-colors hover:bg-[#FAFCFA] dark:bg-[#111D16]">
                      <td className="px-6 py-4">
                        <div className="flex min-w-[220px] items-center gap-3">
                          {employee.photo ? (
                            <img
                              src={employee.photo}
                              alt={employee.name || "Foto karyawan"}
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                              className="h-11 w-11 shrink-0 rounded-[14px] object-cover ring-1 ring-[#E3ECE6]"
                            />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#E4F0E8] to-[#D4E6DA] text-sm font-bold text-[#477663] dark:text-[#A8D0B7] ring-1 ring-[#DDEAE1]">
                              {initials(employee.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => void openDetailModal(employee)}
                              className="block max-w-full truncate text-left font-bold text-[#29483A] dark:text-[#E0ECE4] transition hover:text-[#497F70] dark:text-[#A8D0B7]"
                            >
                              {employee.name || "Nama belum diisi"}
                            </button>
                            <span className="mt-1 block text-xs text-[#9AA79F] dark:text-[#91A99A]">
                              ID: {String(employee.id)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-lg bg-[#F5F8F6] dark:bg-[#1B2B22] px-2.5 py-1.5 font-mono text-xs font-semibold text-[#5C7467] dark:text-[#B7CBBE]">
                          {employee.nik || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5 text-[#5C7065] dark:text-[#B7CBBE]">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F2F6F3] dark:bg-[#1B2B22] text-[#7E9587] dark:text-[#A1B4A8]">
                            <BriefcaseBusiness size={15} />
                          </span>
                          <span className="max-w-[170px] truncate">{employee.position || "Belum diatur"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex max-w-[170px] items-center gap-1.5 truncate rounded-lg border border-[#E8EFEA] dark:border-[#2A4034] bg-white dark:bg-[#15231C] px-2.5 py-1.5 text-xs font-medium text-[#678072] dark:text-[#AFC5B6]">
                          <Building2 size={13} className="shrink-0 text-[#91A99A] dark:text-[#91A99A]" />
                          <span className="truncate">{employee.department || "Umum"}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {employee.phone ? (
                          <div className="flex items-center gap-2 text-[#62776B] dark:text-[#B7CBBE]">
                            <Phone size={15} className="shrink-0 text-[#91A99A] dark:text-[#91A99A]" />
                            <span className="whitespace-nowrap">{employee.phone}</span>
                          </div>
                        ) : (
                          <span className="text-[#A5B0A9] dark:text-[#91A99A]">Belum tersedia</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                          employee.active
                            ? "bg-[#EAF6EE] dark:bg-[#193A28] text-[#34764E] dark:text-[#9CDBB0]"
                            : "bg-[#FFF0F0] dark:bg-[#3A2224] text-[#B64F52] dark:text-[#FFB0B0]"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${employee.active ? "bg-[#3E9A60] dark:bg-[#193A28]" : "bg-[#D96A6D] dark:bg-[#3A2224]"}`} />
                          {employee.active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => void openDetailModal(employee)}
                          aria-label={`Lihat detail ${employee.name || "karyawan"}`}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DDE8E1] dark:border-[#30483A] bg-white dark:bg-[#15231C] px-3.5 py-2.5 text-xs font-bold text-[#477663] dark:text-[#A8D0B7] shadow-sm transition hover:border-[#AFCDBB] hover:bg-[#F2F8F4] dark:bg-[#20372B] hover:text-[#2E5D46] dark:text-[#C7E0D0]"
                        >
                          <Eye size={14} />
                          Detail
                          <ArrowUpRight size={13} className="opacity-60 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 border-t border-[#EAF0EC] dark:border-[#2A4034] bg-[#FCFDFC] dark:bg-[#111D16] px-5 py-4 text-xs text-[#8A9A90] dark:text-[#A1B4A8] sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              Menampilkan <span className="font-bold text-[#4B6B5A] dark:text-[#B7CBBE]">{loading ? "…" : filteredEmployees.length.toLocaleString("id-ID")}</span>
              {" "}dari <span className="font-bold text-[#4B6B5A] dark:text-[#B7CBBE]">{data.length.toLocaleString("id-ID")}</span> karyawan
            </p>
            <p className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#66A17D] dark:bg-[#244A33]" />
              Data diperbarui langsung dari sistem
            </p>
          </div>
        </section>


        {/* CREATE EMPLOYEE MODAL */}
        {isCreateOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#10271F] dark:bg-[#0B1511]/60 p-3 backdrop-blur-sm sm:p-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !saving) setIsCreateOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-employee-title"
              className="my-auto w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/70 bg-white dark:bg-[#15231C] shadow-[0_30px_100px_rgba(8,31,22,0.35)]"
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-[#173D32] via-[#285D4D] to-[#497F70] px-6 py-6 text-white sm:px-8">
                <div className="pointer-events-none absolute -right-8 -top-14 h-44 w-44 rounded-full border border-white/10" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                      <UserPlus size={23} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100/80">Data pegawai baru</p>
                      <h2 id="create-employee-title" className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Tambah karyawan</h2>
                      <p className="mt-1.5 text-sm text-emerald-50/75">Lengkapi informasi dasar karyawan di bawah ini.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => !saving && setIsCreateOpen(false)}
                    disabled={saving}
                    aria-label="Tutup modal"
                    className="rounded-xl border border-white/15 bg-white/10 p-2.5 text-white transition hover:bg-white/20 disabled:opacity-50"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <form onSubmit={saveEmployee} className="max-h-[calc(100dvh-190px)] overflow-y-auto">
                <div className="space-y-6 p-5 sm:p-8">
                  {formError && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-[#351F22] p-3.5 text-sm text-rose-700 dark:text-rose-200">
                      <CircleAlert size={17} className="mt-0.5 shrink-0" />
                      <p>{formError}</p>
                    </div>
                  )}

                  <div>
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#315545] dark:text-[#CFE3D5]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF3EE] dark:bg-[#20372B] text-[#4A806B] dark:text-[#A8D0B7]"><Users size={15} /></span>
                      Informasi personal
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField label="NIK" required>
                        <input
                          name="nik"
                          value={form.nik}
                          onChange={(event) => setForm({ ...form, nik: event.target.value })}
                          required
                          placeholder="Masukkan NIK"
                          className={fieldClass}
                        />
                      </FormField>
                      <FormField label="Nama lengkap" required>
                        <input
                          name="name"
                          value={form.name}
                          onChange={(event) => setForm({ ...form, name: event.target.value })}
                          required
                          placeholder="Nama karyawan"
                          className={fieldClass}
                        />
                      </FormField>
                      <FormField label="Jenis kelamin">
                        <select
                          name="gender"
                          value={form.gender}
                          onChange={(event) => setForm({ ...form, gender: event.target.value })}
                          className={fieldClass}
                        >
                          <option value="">Pilih jenis kelamin</option>
                          <option value="L">Laki-laki</option>
                          <option value="P">Perempuan</option>
                        </select>
                      </FormField>
                      <FormField label="Nomor telepon">
                        <input
                          name="phone"
                          type="tel"
                          value={form.phone}
                          onChange={(event) => setForm({ ...form, phone: event.target.value })}
                          placeholder="Contoh: 08xxxxxxxxxx"
                          className={fieldClass}
                        />
                      </FormField>
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#315545] dark:text-[#CFE3D5]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF3EE] dark:bg-[#20372B] text-[#4A806B] dark:text-[#A8D0B7]"><BriefcaseBusiness size={15} /></span>
                      Informasi pekerjaan
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField label="Jabatan">
                        <input
                          name="position"
                          value={form.position}
                          onChange={(event) => setForm({ ...form, position: event.target.value })}
                          placeholder="Contoh: Staff"
                          className={fieldClass}
                        />
                      </FormField>
                      <FormField label="Departemen">
                        <input
                          name="department"
                          value={form.department}
                          onChange={(event) => setForm({ ...form, department: event.target.value })}
                          placeholder="Contoh: Operasional"
                          className={fieldClass}
                        />
                      </FormField>
                      <div className="sm:col-span-2">
                        <FormField label="Alamat">
                          <textarea
                            name="address"
                            value={form.address}
                            onChange={(event) => setForm({ ...form, address: event.target.value })}
                            rows={3}
                            placeholder="Alamat tempat tinggal karyawan"
                            className={`${fieldClass} resize-y`}
                          />
                        </FormField>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-[#EAF0EC] dark:border-[#2A4034] bg-[#FBFCFB] dark:bg-[#111D16] px-5 py-4 sm:flex-row sm:justify-end sm:px-8">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    disabled={saving}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#DDE8E1] dark:border-[#30483A] bg-white dark:bg-[#15231C] px-5 text-sm font-semibold text-[#60776A] dark:text-[#B7CBBE] transition hover:bg-[#F4F8F5] dark:bg-[#20372B] disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#326B52] dark:bg-[#285940] dark:bg-[#214733] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#285940] dark:bg-[#214733] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? <RefreshCw size={16} className="animate-spin" /> : <UserPlus size={16} />}
                    {saving ? "Menyimpan..." : "Simpan karyawan"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* EMPLOYEE DETAIL MODAL */}
        {(detailLoading || selectedEmployee || detailError) && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#10271F] dark:bg-[#0B1511]/60 p-3 backdrop-blur-sm sm:p-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !detailLoading) {
                setSelectedEmployee(null);
                setDetailError("");
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="employee-detail-title"
              className="my-auto w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/70 bg-white dark:bg-[#15231C] shadow-[0_30px_100px_rgba(8,31,22,0.35)]"
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-[#173D32] via-[#285D4D] to-[#497F70] px-6 py-6 text-white sm:px-8">
                <div className="pointer-events-none absolute -right-8 -top-14 h-44 w-44 rounded-full border border-white/10" />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100/80">Employee profile</p>
                    <h2 id="employee-detail-title" className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Detail karyawan</h2>
                    <p className="mt-1.5 text-sm text-emerald-50/75">Profil pegawai dan riwayat absensi terbaru.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedEmployee(null); setDetailError(""); }}
                    disabled={detailLoading}
                    aria-label="Tutup detail"
                    className="rounded-xl border border-white/15 bg-white/10 p-2.5 text-white transition hover:bg-white/20 disabled:opacity-50"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(100dvh-190px)] overflow-y-auto p-5 sm:p-8">
                {detailLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3EE] dark:bg-[#20372B] text-[#497F70] dark:text-[#A8D0B7]">
                      <RefreshCw size={24} className="animate-spin" />
                    </div>
                    <p className="mt-4 font-semibold text-[#29483A] dark:text-[#E0ECE4]">Memuat detail karyawan...</p>
                    <p className="mt-1 text-sm text-[#91A097] dark:text-[#91A99A]">Mohon tunggu sebentar.</p>
                  </div>
                ) : (
                  <>
                    {detailError && (
                      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-[#342D1C] p-3.5 text-sm text-amber-800 dark:text-amber-200">
                        <CircleAlert size={17} className="mt-0.5 shrink-0" />
                        <p>{detailError}</p>
                      </div>
                    )}
                    {selectedEmployee && (
                      <>
                        <div className="flex flex-col gap-4 rounded-2xl border border-[#E3ECE6] dark:border-[#2A4034] bg-[#F8FBF8] dark:bg-[#18261E] p-5 sm:flex-row sm:items-center">
                          {selectedEmployee.photo ? (
                            <img src={selectedEmployee.photo} alt={selectedEmployee.name || "Foto karyawan"} className="h-16 w-16 rounded-2xl object-cover ring-1 ring-[#DCE8E0]" />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E4F0E8] to-[#D4E6DA] text-lg font-bold text-[#477663] dark:text-[#A8D0B7]">
                              {initials(selectedEmployee.name)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xl font-bold text-[#29483A] dark:text-[#E0ECE4]">{selectedEmployee.name || "Nama belum diisi"}</h3>
                            <p className="mt-1 text-sm text-[#7C9083] dark:text-[#A1B4A8]">{selectedEmployee.position || "Jabatan belum diatur"}{selectedEmployee.department ? ` · ${selectedEmployee.department}` : ""}</p>
                            <div className="mt-2">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${selectedEmployee.active ? "bg-[#EAF6EE] dark:bg-[#193A28] text-[#34764E] dark:text-[#9CDBB0]" : "bg-[#FFF0F0] dark:bg-[#3A2224] text-[#B64F52] dark:text-[#FFB0B0]"}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${selectedEmployee.active ? "bg-[#3E9A60] dark:bg-[#193A28]" : "bg-[#D96A6D] dark:bg-[#3A2224]"}`} />
                                {selectedEmployee.active ? "Aktif" : "Nonaktif"}
                              </span>
                            </div>
                          </div>
                          <div className="rounded-xl border border-[#E2EBE5] dark:border-[#2A4034] bg-white dark:bg-[#15231C] px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#91A097] dark:text-[#91A99A]">NIK</p>
                            <p className="mt-1 font-mono text-sm font-bold text-[#426653] dark:text-[#C6DCCE]">{selectedEmployee.nik || "—"}</p>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <DetailInfo label="Jenis kelamin" value={selectedEmployee.gender === "L" ? "Laki-laki" : selectedEmployee.gender === "P" ? "Perempuan" : selectedEmployee.gender || "—"} />
                          <DetailInfo label="Nomor telepon" value={selectedEmployee.phone || "—"} />
                          <DetailInfo label="Departemen" value={selectedEmployee.department || "—"} />
                          <DetailInfo label="Jabatan" value={selectedEmployee.position || "—"} />
                          <div className="sm:col-span-2">
                            <DetailInfo label="Alamat" value={selectedEmployee.address || "—"} />
                          </div>
                        </div>

                        <div className="mt-7">
                          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                            <div>
                              <h3 className="font-bold text-[#29483A] dark:text-[#E0ECE4]">Riwayat absensi</h3>
                              <p className="mt-1 text-xs text-[#91A097] dark:text-[#91A99A]">Catatan absensi yang tersedia untuk karyawan ini.</p>
                            </div>
                            <span className="rounded-lg bg-[#EDF5F0] dark:bg-[#20372B] px-2.5 py-1.5 text-xs font-bold text-[#477663] dark:text-[#A8D0B7]">
                              {(selectedEmployee.attendances || []).length} catatan
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-2xl border border-[#E5ECE7] dark:border-[#2A4034]">
                            <table className="w-full min-w-[620px] text-left text-sm">
                              <thead className="bg-[#F7FAF7] dark:bg-[#18261E] text-[11px] font-bold uppercase tracking-wider text-[#809288] dark:text-[#A1B4A8]">
                                <tr>
                                  <th className="px-4 py-3">Tanggal</th>
                                  <th className="px-4 py-3">Masuk</th>
                                  <th className="px-4 py-3">Pulang</th>
                                  <th className="px-4 py-3">Foto</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#EEF2EF]">
                                {(selectedEmployee.attendances || []).length === 0 ? (
                                  <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-[#91A097] dark:text-[#91A99A]">Belum ada riwayat absensi.</td></tr>
                                ) : (
                                  (selectedEmployee.attendances || []).map((attendance) => (
                                    <tr key={attendance.id} className="text-[#5C7065] dark:text-[#B7CBBE]">
                                      <td className="whitespace-nowrap px-4 py-3 font-medium">{formatDate(attendance.date)}</td>
                                      <td className="whitespace-nowrap px-4 py-3">{formatTime(attendance.checkIn)}</td>
                                      <td className="whitespace-nowrap px-4 py-3">{formatTime(attendance.checkOut)}</td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                          {attendance.photoIn ? <a href={attendance.photoIn} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#477663] dark:text-[#A8D0B7] underline underline-offset-2">Masuk</a> : <span className="text-xs text-[#A5B0A9] dark:text-[#91A99A]">—</span>}
                                          {attendance.photoOut ? <a href={attendance.photoOut} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#477663] dark:text-[#A8D0B7] underline underline-offset-2">Pulang</a> : null}
                                        </div>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-end border-t border-[#EAF0EC] dark:border-[#2A4034] bg-[#FBFCFB] dark:bg-[#111D16] px-5 py-4 sm:px-8">
                <button
                  type="button"
                  onClick={() => { setSelectedEmployee(null); setDetailError(""); }}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#DDE8E1] dark:border-[#30483A] bg-white dark:bg-[#15231C] px-5 text-sm font-semibold text-[#60776A] dark:text-[#B7CBBE] transition hover:bg-[#F4F8F5] dark:bg-[#20372B]"
                >
                  Tutup
                </button>
              </div>
            </section>
          </div>
        )}

        <p className="mt-5 px-1 text-center text-[11px] text-[#A0ADA5] dark:text-[#91A99A]">
          Master Karyawan <span className="mx-1">·</span> Pengelolaan data pegawai
        </p>
      </div>
    </main>
  );
}


const fieldClass =
  "mt-1.5 h-11 w-full rounded-xl border border-[#DDE8E1] dark:border-[#30483A] bg-[#FBFCFB] dark:bg-[#111D16] px-3.5 text-sm text-[#234438] dark:text-[#D9E8DE] outline-none transition placeholder:text-[#A0ADA6] dark:text-[#91A99A] focus:border-[#6B9A85] focus:bg-white dark:focus:bg-[#15231C] focus:ring-4 focus:ring-[#497F70]/10";

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-bold text-[#5A7465] dark:text-[#B7CBBE]">
      {label}{required ? <span className="ml-1 text-rose-500">*</span> : null}
      {children}
    </label>
  );
}

function DetailInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E7EEE9] dark:border-[#2A4034] bg-white dark:bg-[#15231C] px-4 py-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#91A097] dark:text-[#91A99A]">{label}</p>
      <p className="mt-1.5 break-words text-sm font-semibold text-[#426653] dark:text-[#C6DCCE]">{value}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  icon,
  tone,
  loading,
}: {
  label: string;
  value: number;
  note: string;
  icon: ReactNode;
  tone: "green" | "emerald" | "rose";
  loading: boolean;
}) {
  const toneStyles = {
    green: {
      icon: "bg-[#EAF3EE] dark:bg-[#20372B] text-[#4A806B] dark:text-[#A8D0B7]",
      glow: "bg-[#E8F2EC] dark:bg-[#20372B]",
      line: "bg-[#72A78A] dark:bg-[#244A33]",
    },
    emerald: {
      icon: "bg-emerald-50 dark:bg-[#193A2A] text-emerald-700 dark:text-emerald-300",
      glow: "bg-emerald-50 dark:bg-[#193A2A]",
      line: "bg-emerald-500",
    },
    rose: {
      icon: "bg-rose-50 dark:bg-[#351F22] text-rose-600 dark:text-rose-300",
      glow: "bg-rose-50 dark:bg-[#351F22]",
      line: "bg-rose-400",
    },
  }[tone];

  return (
    <div className="group relative overflow-hidden rounded-[22px] border border-[#E0EAE4] dark:border-[#2A4034] bg-white dark:bg-[#15231C] p-5 shadow-[0_5px_22px_rgba(28,61,48,0.035)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(28,61,48,0.075)] sm:p-6">
      <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full ${toneStyles.glow} opacity-70 blur-2xl transition group-hover:opacity-100`} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#84948A] dark:text-[#A1B4A8]">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-[#203F34] dark:text-[#E3EEE7] sm:text-[34px]">
            {loading ? <span className="inline-block h-9 w-16 animate-pulse rounded-lg bg-[#EEF3EF] dark:bg-[#26362D]" /> : value.toLocaleString("id-ID")}
          </p>
          <p className="mt-2 text-xs text-[#9AA79F] dark:text-[#91A99A]">{note}</p>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${toneStyles.icon}`}>
          {icon}
        </div>
      </div>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-[#F0F4F1] dark:bg-[#26362D]">
        <div className={`h-full w-1/3 rounded-full ${toneStyles.line} transition-all duration-500 group-hover:w-2/3`} />
      </div>
    </div>
  );
}
