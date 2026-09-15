"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Edit3,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  LockKeyhole,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  UserCog,
  UserRound,
  Users,
  X,
} from "lucide-react";

type Role =
  | "ADMIN"
  | "MANAGER"
  | "OUTLET_ADMIN"
  | "KASIR"
  | string;

type Outlet = {
  id: number;
  name: string;
};

type UserData = {
  id: number;
  username: string;
  fullname: string;
  photo: string | null;
  role: Role;
  active: boolean;
  outletId: number | null;
  outlet: {
    id: number;
    name: string;
  } | null;
};

type CurrentUser = {
  id: number;
  role: Role;
  outletId: number | null;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  data?: UserData[];
  currentUser?: CurrentUser;
};

type FormData = {
  username: string;
  fullname: string;
  password: string;
  role: Role;
  outletId: string;
  active: boolean;
  photo: string;
};

const EMPTY_FORM: FormData = {
  username: "",
  fullname: "",
  password: "",
  role: "KASIR",
  outletId: "",
  active: true,
  photo: "",
};

const ROLE_OPTIONS = [
  {
    value: "ADMIN",
    label: "ADMIN",
    description: "Akses penuh sistem pusat",
  },
  {
    value: "MANAGER",
    label: "MANAGER",
    description: "Akses manajemen operasional",
  },
  {
    value: "OUTLET_ADMIN",
    label: "OUTLET ADMIN",
    description: "Administrator satu outlet",
  },
  {
    value: "KASIR",
    label: "KASIR",
    description: "Operasional kasir outlet",
  },
];

function roleLabel(role: Role) {
  switch (role) {
    case "ADMIN":
      return "ADMIN";
    case "MANAGER":
      return "MANAGER";
    case "OUTLET_ADMIN":
      return "OUTLET ADMIN";
    case "KASIR":
      return "KASIR";
    default:
      return role;
  }
}

function roleDescription(role: Role) {
  switch (role) {
    case "ADMIN":
      return "Akses penuh sistem pusat";
    case "MANAGER":
      return "Akses manajemen operasional";
    case "OUTLET_ADMIN":
      return "Administrator outlet";
    case "KASIR":
      return "Operasional kasir";
    default:
      return "Role pengguna";
  }
}

function roleBadgeClass(role: Role) {
  switch (role) {
    case "ADMIN":
      return "border-[#d7e5e0] bg-[#edf5f2] text-[#18352D]";
    case "MANAGER":
      return "border-blue-100 bg-blue-50 text-blue-700";
    case "OUTLET_ADMIN":
      return "border-amber-100 bg-amber-50 text-amber-700";
    case "KASIR":
      return "border-purple-100 bg-purple-50 text-purple-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function initials(name: string) {
  const value = name.trim();

  if (!value) return "U";

  const parts = value.split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

export default function Page() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingOutlets, setLoadingOutlets] =
    useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] =
    useState<UserData | null>(null);

  const [form, setForm] =
    useState<FormData>(EMPTY_FORM);

  const [showPassword, setShowPassword] =
    useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // =====================================================
  // LOAD USERS
  // =====================================================

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/user", {
        method: "GET",
        cache: "no-store",
      });

      const json: ApiResponse =
        await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil data user"
        );
      }

      setUsers(json.data || []);

      if (json.currentUser) {
        setCurrentUser(json.currentUser);
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Gagal mengambil data user"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // LOAD OUTLETS
  // =====================================================

  async function loadOutlets() {
    try {
      setLoadingOutlets(true);

      const response = await fetch(
        "/api/outlet",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        return;
      }

      const json = await response.json();

      if (!json?.success) {
        return;
      }

      const rawData = Array.isArray(json.data)
        ? json.data
        : [];

      const mapped: Outlet[] = rawData
        .map((item: any) => ({
          id: Number(item.id),
          name:
            item.name ||
            item.nama ||
            `Outlet ${item.id}`,
        }))
        .filter(
          (item: Outlet) =>
            Number.isInteger(item.id) &&
            item.id > 0
        );

      setOutlets(mapped);
    } catch (err) {
      console.error(
        "LOAD OUTLET ERROR:",
        err
      );
    } finally {
      setLoadingOutlets(false);
    }
  }

  useEffect(() => {
    loadUsers();
    loadOutlets();
  }, []);

  // =====================================================
  // PERMISSIONS
  // =====================================================

  const isAdmin =
    currentUser?.role === "ADMIN";

  const isOutletAdmin =
    currentUser?.role === "OUTLET_ADMIN";

  // =====================================================
  // FILTER
  // =====================================================

  const filteredUsers = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !keyword ||
        user.username
          .toLowerCase()
          .includes(keyword) ||
        user.fullname
          .toLowerCase()
          .includes(keyword) ||
        roleLabel(user.role)
          .toLowerCase()
          .includes(keyword) ||
        user.outlet?.name
          ?.toLowerCase()
          .includes(keyword);

      const matchesRole =
        roleFilter === "ALL" ||
        user.role === roleFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE"
          ? user.active
          : !user.active);

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      );
    });
  }, [
    users,
    search,
    roleFilter,
    statusFilter,
  ]);

  // =====================================================
  // STATISTICS
  // =====================================================

  const stats = useMemo(() => {
    const active = users.filter(
      (user) => user.active
    ).length;

    const inactive =
      users.length - active;

    const admins = users.filter(
      (user) => user.role === "ADMIN"
    ).length;

    const outletUsers = users.filter(
      (user) =>
        user.role === "OUTLET_ADMIN" ||
        user.role === "KASIR"
    ).length;

    return {
      total: users.length,
      active,
      inactive,
      admins,
      outletUsers,
    };
  }, [users]);

  // =====================================================
  // FORM
  // =====================================================

  function openCreate() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setShowPassword(false);
    setMessage("");
    setError("");
    setModalOpen(true);
  }

  function openEdit(user: UserData) {
    setEditingUser(user);

    setForm({
      username: user.username || "",
      fullname: user.fullname || "",
      password: "",
      role: user.role || "KASIR",
      outletId: user.outletId
        ? String(user.outletId)
        : "",
      active: user.active,
      photo: user.photo || "",
    });

    setShowPassword(false);
    setMessage("");
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setShowPassword(false);
    setError("");
    setMessage("");
  }

  function updateForm(
    field: keyof FormData,
    value: string | boolean
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  const outletRequired =
    form.role === "KASIR" ||
    form.role === "OUTLET_ADMIN";

  // =====================================================
  // SAVE
  // =====================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!form.username.trim()) {
      setError("Username wajib diisi.");
      return;
    }

    if (!form.fullname.trim()) {
      setError("Nama lengkap wajib diisi.");
      return;
    }

    if (!editingUser && !form.password) {
      setError("Password wajib diisi.");
      return;
    }

    if (
      form.password &&
      form.password.length < 6
    ) {
      setError(
        "Password minimal 6 karakter."
      );
      return;
    }

    if (
      outletRequired &&
      !form.outletId
    ) {
      setError(
        form.role === "KASIR"
          ? "Outlet wajib dipilih untuk KASIR."
          : "Outlet wajib dipilih untuk OUTLET ADMIN."
      );
      return;
    }

    try {
      setSaving(true);

      const payload: Record<
        string,
        unknown
      > = {
        username: form.username.trim(),
        fullname: form.fullname.trim(),
        role: form.role,
        outletId: outletRequired
          ? Number(form.outletId)
          : null,
        active: form.active,
        photo:
          form.photo.trim() || null,
      };

      if (form.password.trim()) {
        payload.password =
          form.password.trim();
      }

      if (editingUser) {
        payload.id = editingUser.id;
      }

      const response = await fetch(
        "/api/user",
        {
          method: editingUser
            ? "PUT"
            : "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal menyimpan user"
        );
      }

      setMessage(
        json.message ||
          "User berhasil disimpan."
      );

      await loadUsers();

      setTimeout(() => {
        closeModal();
      }, 500);
    } catch (err: any) {
      setError(
        err?.message ||
          "Gagal menyimpan user."
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // ACCESS DENIED FALLBACK
  // =====================================================

  if (
    !loading &&
    error &&
    users.length === 0 &&
    !currentUser
  ) {
    return (
      <main className="min-h-screen bg-[#f6f8f7] p-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-[28px] border border-red-100 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <ShieldCheck size={30} />
            </div>

            <h1 className="mt-5 text-2xl font-black text-[#18352D]">
              Tidak dapat memuat User
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
              {error}
            </p>

            <button
              type="button"
              onClick={loadUsers}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#18352D] px-5 py-3 text-sm font-bold text-white"
            >
              <RefreshCw size={16} />
              Coba Lagi
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f8f7] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link
              href="/pengaturan"
              className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-slate-400 transition hover:text-[#497F70]"
            >
              <ArrowLeft size={14} />
              Pengaturan
            </Link>

            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#18352D] text-[#b9d7cd] shadow-lg shadow-[#18352D]/15">
                <Users size={27} />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#497F70]">
                  System Administration
                </p>

                <h1 className="mt-1 text-3xl font-black tracking-tight text-[#18352D] sm:text-4xl">
                  User & Hak Akses
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Kelola akun, role, outlet, dan
                  status pengguna MGB ERP.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadUsers}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#dce7e2] bg-white px-4 text-sm font-bold text-[#18352D] shadow-sm transition hover:border-[#a9c6bd] hover:bg-[#f8faf9] disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#18352D] px-5 text-sm font-bold text-white shadow-lg shadow-[#18352D]/15 transition hover:-translate-y-0.5 hover:bg-[#24493f]"
              >
                <Plus size={17} />
                Tambah User
              </button>
            )}
          </div>
        </div>

        {/* ================================================= */}
        {/* ALERT */}
        {/* ================================================= */}

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <ShieldCheck
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div className="flex-1">
              <p className="font-bold">
                Terjadi kesalahan
              </p>

              <p className="mt-0.5 text-xs">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-400 hover:text-red-700"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* ================================================= */}
        {/* STATS */}
        {/* ================================================= */}

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard
            icon={<Users size={19} />}
            label="Total User"
            value={stats.total}
          />

          <StatCard
            icon={<CheckCircle2 size={19} />}
            label="Aktif"
            value={stats.active}
          />

          <StatCard
            icon={<LockKeyhole size={19} />}
            label="Nonaktif"
            value={stats.inactive}
          />

          <StatCard
            icon={<ShieldCheck size={19} />}
            label="Admin Pusat"
            value={stats.admins}
          />

          <StatCard
            icon={<Store size={19} />}
            label="User Outlet"
            value={stats.outletUsers}
          />
        </div>

        {/* ================================================= */}
        {/* MAIN CARD */}
        {/* ================================================= */}

        <div className="overflow-hidden rounded-[28px] border border-[#dce7e2] bg-white shadow-[0_18px_60px_rgba(24,53,45,0.07)]">
          {/* FILTER BAR */}

          <div className="border-b border-[#edf1ef] p-4 sm:p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Cari username, nama, role, atau outlet..."
                  className="h-11 w-full rounded-2xl border border-[#dfe8e4] bg-[#f8faf9] pl-11 pr-4 text-sm font-medium text-[#18352D] outline-none transition placeholder:text-slate-400 focus:border-[#82a99e] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex">
                <FilterSelect
                  icon={<UserCog size={15} />}
                  value={roleFilter}
                  onChange={setRoleFilter}
                >
                  <option value="ALL">
                    Semua Role
                  </option>
                  <option value="ADMIN">
                    ADMIN
                  </option>
                  <option value="MANAGER">
                    MANAGER
                  </option>
                  <option value="OUTLET_ADMIN">
                    OUTLET ADMIN
                  </option>
                  <option value="KASIR">
                    KASIR
                  </option>
                </FilterSelect>

                <FilterSelect
                  icon={<Filter size={15} />}
                  value={statusFilter}
                  onChange={setStatusFilter}
                >
                  <option value="ALL">
                    Semua Status
                  </option>
                  <option value="ACTIVE">
                    Aktif
                  </option>
                  <option value="INACTIVE">
                    Nonaktif
                  </option>
                </FilterSelect>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-400">
                Menampilkan{" "}
                <span className="font-black text-[#18352D]">
                  {filteredUsers.length}
                </span>{" "}
                dari{" "}
                <span className="font-black text-[#18352D]">
                  {users.length}
                </span>{" "}
                user
              </p>

              {(search ||
                roleFilter !== "ALL" ||
                statusFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setRoleFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                  className="text-xs font-bold text-[#497F70] hover:underline"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-[#edf1ef] bg-[#fafcfb]">
                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    User
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Role
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Outlet
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Status
                  </th>

                  <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-20 text-center"
                    >
                      <Loader2
                        size={28}
                        className="mx-auto animate-spin text-[#497F70]"
                      />

                      <p className="mt-3 text-sm font-bold text-[#18352D]">
                        Memuat data user...
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Mohon tunggu sebentar.
                      </p>
                    </td>
                  </tr>
                ) : filteredUsers.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-20 text-center"
                    >
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0f5f3] text-[#497F70]">
                        <Users size={25} />
                      </div>

                      <p className="mt-4 text-sm font-black text-[#18352D]">
                        Tidak ada user
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Tidak ada data yang
                        sesuai filter.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(
                    (user) => (
                      <tr
                        key={user.id}
                        className="group border-b border-[#f0f3f2] transition hover:bg-[#fbfdfc]"
                      >
                        {/* USER */}

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {user.photo ? (
                              <img
                                src={user.photo}
                                alt={
                                  user.fullname
                                }
                                className="h-11 w-11 rounded-2xl border border-[#dce7e2] object-cover"
                              />
                            ) : (
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e8f1ee] text-xs font-black text-[#497F70]">
                                {initials(
                                  user.fullname
                                )}
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-[#18352D]">
                                {user.fullname}
                              </p>

                              <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-400">
                                <CircleUserRound
                                  size={12}
                                />
                                @{user.username}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* ROLE */}

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${roleBadgeClass(
                              user.role
                            )}`}
                          >
                            {roleLabel(
                              user.role
                            )}
                          </span>

                          <p className="mt-1.5 text-[10px] text-slate-400">
                            {roleDescription(
                              user.role
                            )}
                          </p>
                        </td>

                        {/* OUTLET */}

                        <td className="px-5 py-4">
                          {user.outlet ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f1f6f4] text-[#497F70]">
                                <Store
                                  size={15}
                                />
                              </div>

                              <div>
                                <p className="text-xs font-bold text-[#18352D]">
                                  {
                                    user
                                      .outlet
                                      .name
                                  }
                                </p>

                                <p className="text-[10px] text-slate-400">
                                  Outlet #
                                  {
                                    user
                                      .outlet
                                      .id
                                  }
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-slate-400">
                              Pusat / Tidak
                              terikat outlet
                            </span>
                          )}
                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-4">
                          {user.active ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              Nonaktif
                            </span>
                          )}
                        </td>

                        {/* ACTION */}

                        <td className="px-5 py-4 text-right">
                          {(isAdmin ||
                            (isOutletAdmin &&
                              user.id ===
                                currentUser?.id)) && (
                            <button
                              type="button"
                              onClick={() =>
                                openEdit(
                                  user
                                )
                              }
                              className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#dce7e2] bg-white px-3 text-xs font-bold text-[#18352D] shadow-sm transition hover:border-[#a9c6bd] hover:bg-[#f6faf8]"
                            >
                              <Edit3
                                size={14}
                              />
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* FOOTER */}

          <div className="flex flex-col gap-2 border-t border-[#edf1ef] bg-[#fafcfb] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck
                size={14}
                className="text-[#497F70]"
              />

              <span>
                Hak akses divalidasi oleh
                server.
              </span>
            </div>

            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              MGB ERP • User Management
            </p>
          </div>
        </div>
      </div>

      {/* ================================================= */}
      {/* MODAL */}
      {/* ================================================= */}

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#10251f]/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/30 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.25)]">
            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-[#edf1ef] bg-[#fafcfb] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#18352D] text-[#b9d7cd]">
                  {editingUser ? (
                    <Edit3 size={20} />
                  ) : (
                    <UserRound size={20} />
                  )}
                </div>

                <div>
                  <h2 className="text-lg font-black text-[#18352D]">
                    {editingUser
                      ? "Edit User"
                      : "Tambah User"}
                  </h2>

                  <p className="text-xs text-slate-400">
                    {editingUser
                      ? "Perbarui informasi dan hak akses user."
                      : "Buat akun pengguna baru untuk MGB ERP."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            {/* FORM */}

            <form
              onSubmit={handleSubmit}
              className="overflow-y-auto"
            >
              <div className="space-y-6 p-6">
                {/* ERROR */}

                {error && (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                    {error}
                  </div>
                )}

                {/* BASIC */}

                <section>
                  <div className="mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#497F70]">
                      Informasi Akun
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Identitas dasar pengguna.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      label="Username"
                      required
                    >
                      <input
                        value={form.username}
                        onChange={(event) =>
                          updateForm(
                            "username",
                            event.target
                              .value
                          )
                        }
                        disabled={
                          saving ||
                          (isOutletAdmin &&
                            !!editingUser)
                        }
                        placeholder="contoh: kasir01"
                        className="form-input"
                      />
                    </FormField>

                    <FormField
                      label="Nama Lengkap"
                      required
                    >
                      <input
                        value={form.fullname}
                        onChange={(event) =>
                          updateForm(
                            "fullname",
                            event.target
                              .value
                          )
                        }
                        disabled={saving}
                        placeholder="Nama lengkap"
                        className="form-input"
                      />
                    </FormField>

                    <FormField
                      label={
                        editingUser
                          ? "Password Baru"
                          : "Password"
                      }
                      required={!editingUser}
                    >
                      <div className="relative">
                        <input
                          type={
                            showPassword
                              ? "text"
                              : "password"
                          }
                          value={form.password}
                          onChange={(event) =>
                            updateForm(
                              "password",
                              event.target
                                .value
                            )
                          }
                          disabled={saving}
                          placeholder={
                            editingUser
                              ? "Kosongkan jika tidak diubah"
                              : "Minimal 6 karakter"
                          }
                          className="form-input pr-11"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword(
                              (prev) =>
                                !prev
                            )
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#497F70]"
                        >
                          {showPassword ? (
                            <EyeOff
                              size={17}
                            />
                          ) : (
                            <Eye
                              size={17}
                            />
                          )}
                        </button>
                      </div>
                    </FormField>

                    <FormField label="Foto Profil">
                      <input
                        value={form.photo}
                        onChange={(event) =>
                          updateForm(
                            "photo",
                            event.target
                              .value
                          )
                        }
                        disabled={saving}
                        placeholder="/uploads/users/photo.jpg"
                        className="form-input"
                      />
                    </FormField>
                  </div>
                </section>

                {/* ACCESS */}

                <section className="border-t border-[#edf1ef] pt-6">
                  <div className="mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#497F70]">
                      Hak Akses
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Tentukan role dan outlet
                      pengguna.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      label="Role"
                      required
                    >
                      <div className="relative">
                        <select
                          value={form.role}
                          onChange={(event) =>
                            updateForm(
                              "role",
                              event.target
                                .value
                            )
                          }
                          disabled={
                            saving ||
                            (isOutletAdmin &&
                              !!editingUser)
                          }
                          className="form-input appearance-none pr-10"
                        >
                          {ROLE_OPTIONS.map(
                            (role) => (
                              <option
                                key={
                                  role.value
                                }
                                value={
                                  role.value
                                }
                              >
                                {role.label}
                              </option>
                            )
                          )}
                        </select>

                        <ChevronDown
                          size={16}
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                      </div>

                      <p className="mt-1.5 text-[10px] text-slate-400">
                        {roleDescription(
                          form.role
                        )}
                      </p>
                    </FormField>

                    <FormField
                      label="Outlet"
                      required={outletRequired}
                    >
                      <div className="relative">
                        <select
                          value={form.outletId}
                          onChange={(event) =>
                            updateForm(
                              "outletId",
                              event.target
                                .value
                            )
                          }
                          disabled={
                            saving ||
                            !outletRequired ||
                            (isOutletAdmin &&
                              !!editingUser)
                          }
                          className="form-input appearance-none pr-10 disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          <option value="">
                            {outletRequired
                              ? loadingOutlets
                                ? "Memuat outlet..."
                                : "Pilih outlet"
                              : "Tidak menggunakan outlet"}
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
                                {outlet.name}
                              </option>
                            )
                          )}
                        </select>

                        <ChevronDown
                          size={16}
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                      </div>
                    </FormField>
                  </div>

                  {/* ROLE INFO */}

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {ROLE_OPTIONS.map(
                      (role) => (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() => {
                            if (
                              isOutletAdmin &&
                              editingUser
                            ) {
                              return;
                            }

                            updateForm(
                              "role",
                              role.value
                            );
                          }}
                          disabled={
                            saving ||
                            (isOutletAdmin &&
                              !!editingUser)
                          }
                          className={`rounded-2xl border p-4 text-left transition ${
                            form.role ===
                            role.value
                              ? "border-[#9fc1b6] bg-[#f0f6f3] shadow-sm"
                              : "border-[#e5ece9] bg-white hover:border-[#bfd4cc]"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-[#18352D]">
                              {role.label}
                            </span>

                            {form.role ===
                              role.value && (
                              <CheckCircle2
                                size={16}
                                className="text-[#497F70]"
                              />
                            )}
                          </div>

                          <p className="mt-1 text-[10px] leading-5 text-slate-400">
                            {role.description}
                          </p>
                        </button>
                      )
                    )}
                  </div>
                </section>

                {/* STATUS */}

                <section className="border-t border-[#edf1ef] pt-6">
                  <div className="flex items-center justify-between rounded-2xl border border-[#e2ebe7] bg-[#f8faf9] p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          form.active
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <ShieldCheck
                          size={19}
                        />
                      </div>

                      <div>
                        <p className="text-xs font-black text-[#18352D]">
                          Status Akun
                        </p>

                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {form.active
                            ? "User dapat login ke sistem."
                            : "User tidak dapat menggunakan sistem."}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={
                        saving ||
                        (isOutletAdmin &&
                          !!editingUser)
                      }
                      onClick={() =>
                        updateForm(
                          "active",
                          !form.active
                        )
                      }
                      className={`relative h-7 w-12 rounded-full transition ${
                        form.active
                          ? "bg-[#497F70]"
                          : "bg-slate-300"
                      } disabled:opacity-50`}
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                          form.active
                            ? "left-6"
                            : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                </section>
              </div>

              {/* MODAL FOOTER */}

              <div className="flex flex-col-reverse gap-3 border-t border-[#edf1ef] bg-[#fafcfb] px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="h-11 rounded-2xl border border-[#dce7e2] bg-white px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#18352D] px-6 text-sm font-bold text-white shadow-lg shadow-[#18352D]/15 transition hover:bg-[#24493f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        size={17}
                      />
                      {editingUser
                        ? "Simpan Perubahan"
                        : "Buat User"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================= */}
      {/* GLOBAL FORM STYLE */}
      {/* ================================================= */}

      <style jsx global>{`
        .form-input {
          width: 100%;
          height: 44px;
          border-radius: 14px;
          border: 1px solid #dfe8e4;
          background: #f8faf9;
          padding: 0 14px;
          font-size: 13px;
          font-weight: 600;
          color: #18352d;
          outline: none;
          transition:
            border-color 150ms ease,
            background 150ms ease,
            box-shadow 150ms ease;
        }

        .form-input::placeholder {
          color: #9aa9a3;
          font-weight: 500;
        }

        .form-input:focus {
          border-color: #82a99e;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(73, 127, 112, 0.1);
        }

        .form-input:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }
      `}</style>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[22px] border border-[#dce7e2] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf5f2] text-[#497F70]">
          {icon}
        </div>

        <span className="text-xl font-black text-[#18352D]">
          {value}
        </span>
      </div>

      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
    </div>
  );
}

function FilterSelect({
  icon,
  value,
  onChange,
  children,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#497F70]">
        {icon}
      </div>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="h-11 min-w-[155px] appearance-none rounded-2xl border border-[#dfe8e4] bg-[#f8faf9] pl-9 pr-9 text-xs font-bold text-[#18352D] outline-none transition focus:border-[#82a99e] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
      >
        {children}
      </select>

      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}

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
    <label className="block">
      <span className="mb-2 block text-xs font-black text-[#18352D]">
        {label}
        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}