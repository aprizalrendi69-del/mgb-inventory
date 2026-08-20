"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Plus,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  RefreshCw,
  Circle,
  Pencil,
  X,
  Save,
} from "lucide-react";

type Outlet = {
  id: number;
  name: string;
};

type User = {
  id: number;
  username: string;
  fullname: string;
  role: string;
  active: boolean;
  outletId?: number | null;
  outlet?: Outlet | null;
  lastSeen?: string | null;
  online?: boolean;
};

export default function UserPage() {
  const [data, setData] = useState<User[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [onlineLoading, setOnlineLoading] =
    useState(false);

  const [search, setSearch] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);

  // =====================================================
  // EDIT MODE
  // =====================================================

  const [editingUserId, setEditingUserId] =
    useState<number | null>(null);

  const [form, setForm] = useState({
    username: "",
    fullname: "",
    password: "",
    role: "ADMIN",
    outletId: "",
    active: true,
  });

  // =====================================================
  // LOAD USER
  // =====================================================

  async function load() {
    try {
      setLoading(true);

      const res = await fetch("/api/user", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setData(json.data ?? []);
      } else {
        alert(
          json.message ??
            "Gagal mengambil data user"
        );
      }
    } catch (error) {
      console.error(
        "Load user error:",
        error
      );

      alert("Gagal mengambil data user");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // LOAD ONLINE STATUS
  // =====================================================

  async function loadOnlineStatus() {
    try {
      setOnlineLoading(true);

      const res = await fetch(
        "/api/user/online",
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error(
          "Gagal mengambil status online"
        );
      }

      const json = await res.json();

      if (!json.success) {
        return;
      }

      const onlineUsers =
        json.users ?? [];

      setData((currentUsers) =>
        currentUsers.map((user) => {
          const onlineUser =
            onlineUsers.find(
              (item: any) =>
                item.id === user.id
            );

          if (!onlineUser) {
            return {
              ...user,
              online: false,
              lastSeen: null,
            };
          }

          return {
            ...user,
            online: Boolean(
              onlineUser.online
            ),
            lastSeen:
              onlineUser.lastSeen ??
              null,
          };
        })
      );
    } catch (error) {
      console.error(
        "Load online status error:",
        error
      );
    } finally {
      setOnlineLoading(false);
    }
  }

  // =====================================================
  // LOAD OUTLET
  // =====================================================

  async function loadOutlets() {
    try {
      const res = await fetch(
        "/api/outlet",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (json.success) {
        setOutlets(json.data ?? []);
      } else {
        console.error(json.message);
      }
    } catch (error) {
      console.error(
        "Load outlet error:",
        error
      );
    }
  }

  // =====================================================
  // LOAD ALL
  // =====================================================

  async function loadAll() {
    await Promise.all([
      load(),
      loadOutlets(),
    ]);
  }

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    loadAll();
  }, []);

  // =====================================================
  // ONLINE REFRESH
  // =====================================================

  useEffect(() => {
    loadOnlineStatus();

    const interval = setInterval(() => {
      loadOnlineStatus();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // =====================================================
  // RESET FORM
  // =====================================================

  function resetForm() {
    setForm({
      username: "",
      fullname: "",
      password: "",
      role: "ADMIN",
      outletId: "",
      active: true,
    });

    setEditingUserId(null);
    setShowPassword(false);
  }

  // =====================================================
  // MULAI EDIT
  // =====================================================

  function mulaiEdit(user: User) {
    setEditingUserId(user.id);

    setForm({
      username: user.username ?? "",
      fullname: user.fullname ?? "",
      password: "",
      role: user.role ?? "ADMIN",
      outletId: user.outletId
        ? String(user.outletId)
        : "",
      active: user.active,
    });

    setShowPassword(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // =====================================================
  // BATAL EDIT
  // =====================================================

  function batalEdit() {
    resetForm();
  }

  // =====================================================
  // SIMPAN / UPDATE USER
  // =====================================================

  async function simpan() {
    if (!form.username.trim()) {
      alert("Username wajib diisi");
      return;
    }

    if (!form.fullname.trim()) {
      alert("Nama wajib diisi");
      return;
    }

    // Password wajib hanya saat tambah
    if (
      editingUserId === null &&
      !form.password.trim()
    ) {
      alert("Password wajib diisi");
      return;
    }

    // Password jika diisi saat edit
    if (
      form.password.trim() &&
      form.password.length < 6
    ) {
      alert("Password minimal 6 karakter");
      return;
    }

    if (
      form.role === "OUTLET_ADMIN" &&
      !form.outletId
    ) {
      alert(
        "Outlet wajib dipilih untuk OUTLET ADMIN"
      );
      return;
    }

    try {
      setSaving(true);

      const isEdit =
        editingUserId !== null;

      const body = {
        ...(isEdit
          ? {
              id: editingUserId,
            }
          : {}),
        username:
          form.username.trim(),
        fullname:
          form.fullname.trim(),
        password:
          form.password,
        role: form.role,
        outletId:
          form.role === "OUTLET_ADMIN"
            ? Number(form.outletId)
            : null,
        active: form.active,
      };

      const res = await fetch(
        "/api/user",
        {
          method: isEdit
            ? "PUT"
            : "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const json = await res.json();

      if (json.success) {
        alert(
          isEdit
            ? "User berhasil diperbarui"
            : "User berhasil dibuat"
        );

        resetForm();

        await load();
        await loadOnlineStatus();
      } else {
        alert(
          json.message ??
            "Gagal menyimpan user"
        );
      }
    } catch (error) {
      console.error(
        "Simpan user error:",
        error
      );

      alert(
        "Terjadi kesalahan saat menyimpan user"
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // FILTER
  // =====================================================

  const filteredUsers = useMemo(() => {
    const keyword =
      search.toLowerCase().trim();

    if (!keyword) {
      return data;
    }

    return data.filter((user) => {
      return (
        user.username
          ?.toLowerCase()
          .includes(keyword) ||
        user.fullname
          ?.toLowerCase()
          .includes(keyword) ||
        user.role
          ?.toLowerCase()
          .includes(keyword) ||
        user.outlet?.name
          ?.toLowerCase()
          .includes(keyword)
      );
    });
  }, [data, search]);

  // =====================================================
  // ONLINE COUNT
  // =====================================================

  const onlineCount = useMemo(() => {
    return data.filter(
      (user) => user.online
    ).length;
  }, [data]);

  // =====================================================
  // ROLE CLASS
  // =====================================================

  function getRoleClass(role: string) {
    switch (role) {
      case "ADMIN":
        return "bg-red-50 text-red-700 border-red-200";

      case "MANAGER":
        return "bg-purple-50 text-purple-700 border-purple-200";

      case "PURCHASING":
        return "bg-blue-50 text-blue-700 border-blue-200";

      case "GUDANG":
        return "bg-amber-50 text-amber-700 border-amber-200";

      case "OUTLET_ADMIN":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";

      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  }

  // =====================================================
  // LAST SEEN
  // =====================================================

  function formatLastSeen(
    lastSeen?: string | null
  ) {
    if (!lastSeen) {
      return "Belum pernah aktif";
    }

    return new Date(
      lastSeen
    ).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-full bg-[#F5F8F6] p-6 md:p-8">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div>
          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
              <Users size={22} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
                Master User
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Kelola akun pengguna dan hak akses aplikasi
              </p>
            </div>

          </div>
        </div>

        <button
          onClick={async () => {
            await loadAll();
            await loadOnlineStatus();
          }}
          disabled={
            loading ||
            onlineLoading ||
            saving
          }
          className="
            inline-flex
            items-center
            justify-center
            gap-2
            rounded-xl
            border
            border-[#D5E5DC]
            bg-white
            px-4
            py-2.5
            text-sm
            font-medium
            text-slate-700
            shadow-sm
            hover:bg-[#F7FAF8]
            disabled:opacity-50
          "
        >
          <RefreshCw
            size={17}
            className={
              loading ||
              onlineLoading
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>

      </div>

      {/* =================================================
          SUMMARY
      ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* TOTAL */}

        <div className="rounded-2xl border border-[#DCE9E2] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Total User
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-800">
                {data.length}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F2ED] text-[#497F70]">
              <Users size={21} />
            </div>

          </div>

        </div>

        {/* ONLINE */}

        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Sedang Online
              </p>

              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {onlineCount}
              </p>

              <p className="mt-1 text-[10px] text-slate-400">
                Update otomatis setiap 30 detik
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
              <Circle
                size={18}
                fill="currentColor"
                className="text-emerald-500"
              />
            </div>

          </div>

        </div>

        {/* SEARCH */}

        <div className="rounded-2xl border border-[#DCE9E2] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Hasil Pencarian
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-800">
                {filteredUsers.length}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Search size={21} />
            </div>

          </div>

        </div>

      </div>

      {/* =================================================
          MAIN
      ================================================= */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">

        {/* =================================================
            FORM USER
        ================================================= */}

        <div
          className={`
            rounded-2xl
            border
            bg-white
            shadow-sm
            ${
              editingUserId !== null
                ? "border-blue-200"
                : "border-[#DCE9E2]"
            }
          `}
        >

          {/* FORM HEADER */}

          <div className="border-b border-[#E5ECE8] p-5">

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-3">

                <div
                  className={`
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    ${
                      editingUserId !== null
                        ? "bg-blue-50 text-blue-600"
                        : "bg-[#E8F2ED] text-[#497F70]"
                    }
                  `}
                >
                  {editingUserId !== null ? (
                    <Pencil size={20} />
                  ) : (
                    <UserPlus size={20} />
                  )}
                </div>

                <div>

                  <h2 className="font-semibold text-slate-800">
                    {editingUserId !== null
                      ? "Edit User"
                      : "Tambah User"}
                  </h2>

                  <p className="text-xs text-slate-500">
                    {editingUserId !== null
                      ? "Ubah data pengguna"
                      : "Buat akun pengguna baru"}
                  </p>

                </div>

              </div>

              {editingUserId !== null && (
                <button
                  type="button"
                  onClick={batalEdit}
                  className="
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-lg
                    text-slate-400
                    hover:bg-slate-100
                    hover:text-slate-700
                  "
                  title="Batal edit"
                >
                  <X size={18} />
                </button>
              )}

            </div>

          </div>

          {/* FORM BODY */}

          <div className="space-y-5 p-5">

            {/* USERNAME */}

            <div>

              <label className="text-sm font-medium text-slate-700">
                Username
              </label>

              <input
                type="text"
                placeholder="Masukkan username"
                value={form.username}
                onChange={(e) =>
                  setForm({
                    ...form,
                    username:
                      e.target.value,
                  })
                }
                className="
                  mt-2
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-white
                  px-4
                  py-3
                  text-sm
                  outline-none
                  transition
                  focus:border-[#497F70]
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />

            </div>

            {/* NAMA */}

            <div>

              <label className="text-sm font-medium text-slate-700">
                Nama Lengkap
              </label>

              <input
                type="text"
                placeholder="Masukkan nama lengkap"
                value={form.fullname}
                onChange={(e) =>
                  setForm({
                    ...form,
                    fullname:
                      e.target.value,
                  })
                }
                className="
                  mt-2
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-white
                  px-4
                  py-3
                  text-sm
                  outline-none
                  transition
                  focus:border-[#497F70]
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />

            </div>

            {/* PASSWORD */}

            <div>

              <label className="text-sm font-medium text-slate-700">
                Password
              </label>

              {editingUserId !== null && (
                <p className="mt-1 text-[11px] text-slate-400">
                  Kosongkan jika password tidak ingin diubah.
                </p>
              )}

              <div className="relative mt-2">

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder={
                    editingUserId !== null
                      ? "Kosongkan jika tidak diubah"
                      : "Minimal 6 karakter"
                  }
                  value={form.password}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      password:
                        e.target.value,
                    })
                  }
                  className="
                    w-full
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    bg-white
                    px-4
                    py-3
                    pr-12
                    text-sm
                    outline-none
                    transition
                    focus:border-[#497F70]
                    focus:ring-2
                    focus:ring-[#497F70]/10
                  "
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  className="
                    absolute
                    right-3
                    top-1/2
                    -translate-y-1/2
                    text-slate-400
                    hover:text-slate-700
                  "
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>

              </div>

            </div>

            {/* ROLE */}

            <div>

              <label className="text-sm font-medium text-slate-700">
                Role
              </label>

              <select
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role:
                      e.target.value,
                    outletId:
                      e.target.value ===
                      "OUTLET_ADMIN"
                        ? form.outletId
                        : "",
                  })
                }
                className="
                  mt-2
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-white
                  px-4
                  py-3
                  text-sm
                  outline-none
                  focus:border-[#497F70]
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              >

                <option value="ADMIN">
                  ADMIN
                </option>

                <option value="MANAGER">
                  MANAGER
                </option>

                <option value="PURCHASING">
                  PURCHASING
                </option>

                <option value="GUDANG">
                  GUDANG
                </option>

                <option value="OUTLET_ADMIN">
                  OUTLET ADMIN
                </option>

              </select>

            </div>

            {/* OUTLET */}

            {form.role ===
              "OUTLET_ADMIN" && (
              <div>

                <label className="text-sm font-medium text-slate-700">
                  Outlet
                </label>

                <select
                  value={
                    form.outletId
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      outletId:
                        e.target.value,
                    })
                  }
                  className="
                    mt-2
                    w-full
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    bg-white
                    px-4
                    py-3
                    text-sm
                    outline-none
                    focus:border-[#497F70]
                    focus:ring-2
                    focus:ring-[#497F70]/10
                  "
                >

                  <option value="">
                    Pilih Outlet
                  </option>

                  {outlets.map(
                    (outlet) => (
                      <option
                        key={outlet.id}
                        value={
                          outlet.id
                        }
                      >
                        {outlet.name}
                      </option>
                    )
                  )}

                </select>

                {outlets.length ===
                  0 && (
                  <p className="mt-2 text-xs text-amber-600">
                    Belum ada outlet yang tersedia.
                  </p>
                )}

              </div>
            )}

            {/* STATUS */}

            {editingUserId !== null && (
              <div>

                <label className="text-sm font-medium text-slate-700">
                  Status Akun
                </label>

                <select
                  value={
                    form.active
                      ? "true"
                      : "false"
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      active:
                        e.target.value ===
                        "true",
                    })
                  }
                  className="
                    mt-2
                    w-full
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    bg-white
                    px-4
                    py-3
                    text-sm
                    outline-none
                    focus:border-[#497F70]
                    focus:ring-2
                    focus:ring-[#497F70]/10
                  "
                >

                  <option value="true">
                    Aktif
                  </option>

                  <option value="false">
                    Nonaktif
                  </option>

                </select>

              </div>
            )}

            {/* BUTTON */}

            <div className="space-y-2">

              <button
                onClick={simpan}
                disabled={saving}
                className={`
                  flex
                  w-full
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  px-5
                  py-3
                  text-sm
                  font-semibold
                  text-white
                  shadow-sm
                  transition
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                  ${
                    editingUserId !==
                    null
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-[#497F70] hover:bg-[#3F6F62]"
                  }
                `}
              >

                {saving ? (
                  <>
                    <RefreshCw
                      size={17}
                      className="animate-spin"
                    />

                    Menyimpan...
                  </>
                ) : editingUserId !==
                  null ? (
                  <>
                    <Save size={17} />

                    Simpan Perubahan
                  </>
                ) : (
                  <>
                    <Plus size={18} />

                    Simpan User
                  </>
                )}

              </button>

              {editingUserId !==
                null && (
                <button
                  type="button"
                  onClick={batalEdit}
                  disabled={saving}
                  className="
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    px-5
                    py-3
                    text-sm
                    font-medium
                    text-slate-600
                    hover:bg-slate-50
                    disabled:opacity-50
                  "
                >
                  <X size={17} />

                  Batal Edit
                </button>
              )}

            </div>

          </div>

        </div>

        {/* =================================================
            TABLE USER
        ================================================= */}

        <div className="overflow-hidden rounded-2xl border border-[#DCE9E2] bg-white shadow-sm">

          {/* TABLE HEADER */}

          <div className="border-b border-[#E5ECE8] p-5">

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

              <div>

                <h2 className="font-semibold text-slate-800">
                  Daftar User
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Semua akun pengguna yang terdaftar
                </p>

              </div>

              <div className="relative w-full md:w-72">

                <Search
                  size={18}
                  className="
                    absolute
                    left-3
                    top-1/2
                    -translate-y-1/2
                    text-slate-400
                  "
                />

                <input
                  type="text"
                  placeholder="Cari user..."
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  className="
                    w-full
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    py-2.5
                    pl-10
                    pr-4
                    text-sm
                    outline-none
                    focus:border-[#497F70]
                    focus:ring-2
                    focus:ring-[#497F70]/10
                  "
                />

              </div>

            </div>

          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1050px]">

              <thead className="bg-[#F7FAF8]">

                <tr>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    User
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Username
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Role
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Outlet
                  </th>

                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status Akun
                  </th>

                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Online
                  </th>

                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Aksi
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-[#E8EEE9]">

                {loading ? (

                  <tr>

                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >

                      <div className="flex justify-center">

                        <RefreshCw
                          size={22}
                          className="animate-spin text-[#497F70]"
                        />

                      </div>

                      <p className="mt-3">
                        Memuat data user...
                      </p>

                    </td>

                  </tr>

                ) : filteredUsers.length ===
                  0 ? (

                  <tr>

                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >

                      <Users
                        size={32}
                        className="mx-auto mb-3 text-slate-300"
                      />

                      Tidak ada user
                      ditemukan.

                    </td>

                  </tr>

                ) : (

                  filteredUsers.map(
                    (user) => (

                      <tr
                        key={user.id}
                        className={`
                          transition
                          hover:bg-[#FAFCFB]
                          ${
                            editingUserId ===
                            user.id
                              ? "bg-blue-50/40"
                              : ""
                          }
                        `}
                      >

                        {/* USER */}

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-3">

                            <div className="relative">

                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F2ED] font-semibold text-[#497F70]">

                                {user.fullname
                                  ?.charAt(
                                    0
                                  )
                                  ?.toUpperCase() ||
                                  "U"}

                              </div>

                              <span
                                className={`
                                  absolute
                                  bottom-0
                                  right-0
                                  h-3
                                  w-3
                                  rounded-full
                                  border-2
                                  border-white
                                  ${
                                    user.online
                                      ? "bg-emerald-500"
                                      : "bg-slate-300"
                                  }
                                `}
                              />

                            </div>

                            <div>

                              <p className="font-medium text-slate-800">
                                {user.fullname ||
                                  "-"}
                              </p>

                              <p className="text-xs text-slate-400">
                                ID #{user.id}
                              </p>

                            </div>

                          </div>

                        </td>

                        {/* USERNAME */}

                        <td className="px-5 py-4 text-sm text-slate-600">
                          @{user.username}
                        </td>

                        {/* ROLE */}

                        <td className="px-5 py-4">

                          <span
                            className={`
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-full
                              border
                              px-3
                              py-1
                              text-xs
                              font-semibold
                              ${getRoleClass(
                                user.role
                              )}
                            `}
                          >

                            <ShieldCheck
                              size={13}
                            />

                            {user.role ===
                            "OUTLET_ADMIN"
                              ? "OUTLET ADMIN"
                              : user.role}

                          </span>

                        </td>

                        {/* OUTLET */}

                        <td className="px-5 py-4 text-sm text-slate-600">

                          {user.outlet?.name ? (
                            <span className="font-medium text-slate-700">
                              {
                                user
                                  .outlet
                                  .name
                              }
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              Pusat
                            </span>
                          )}

                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-4 text-center">

                          <span
                            className={`
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-full
                              px-3
                              py-1
                              text-xs
                              font-medium
                              ${
                                user.active
                                  ? "bg-green-50 text-green-700"
                                  : "bg-red-50 text-red-700"
                              }
                            `}
                          >

                            <span
                              className={`
                                h-1.5
                                w-1.5
                                rounded-full
                                ${
                                  user.active
                                    ? "bg-green-500"
                                    : "bg-red-500"
                                }
                              `}
                            />

                            {user.active
                              ? "Aktif"
                              : "Nonaktif"}

                          </span>

                        </td>

                        {/* ONLINE */}

                        <td className="px-5 py-4 text-center">

                          <div className="flex flex-col items-center">

                            <span
                              className={`
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-full
                                px-3
                                py-1
                                text-xs
                                font-semibold
                                ${
                                  user.online
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-500"
                                }
                              `}
                            >

                              <span
                                className={`
                                  h-2
                                  w-2
                                  rounded-full
                                  ${
                                    user.online
                                      ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
                                      : "bg-slate-300"
                                  }
                                `}
                              />

                              {user.online
                                ? "Online"
                                : "Offline"}

                            </span>

                            {!user.online &&
                              user.lastSeen && (
                                <span className="mt-1 text-[9px] text-slate-400">
                                  {formatLastSeen(
                                    user.lastSeen
                                  )}
                                </span>
                              )}

                          </div>

                        </td>

                        {/* AKSI */}

                        <td className="px-5 py-4 text-center">

                          <button
                            type="button"
                            onClick={() =>
                              mulaiEdit(
                                user
                              )
                            }
                            className="
                              inline-flex
                              items-center
                              justify-center
                              gap-1.5
                              rounded-lg
                              border
                              border-blue-200
                              bg-blue-50
                              px-3
                              py-2
                              text-xs
                              font-semibold
                              text-blue-600
                              transition
                              hover:bg-blue-100
                            "
                            title="Edit user"
                          >

                            <Pencil
                              size={14}
                            />

                            Edit

                          </button>

                        </td>

                      </tr>

                    )
                  )

                )}

              </tbody>

            </table>

          </div>

        </div>

      </div>

    </div>
  );
}