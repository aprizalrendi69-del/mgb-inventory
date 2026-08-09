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
} from "lucide-react";

type User = {
  id: number;
  username: string;
  fullname: string;
  role: string;
};

export default function UserPage() {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    username: "",
    fullname: "",
    password: "",
    role: "ADMIN",
  });

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
        alert(json.message ?? "Gagal mengambil data user");
      }
    } catch (error) {
      console.error("Load user error:", error);
      alert("Gagal mengambil data user");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function simpan() {
    if (!form.username.trim()) {
      alert("Username wajib diisi");
      return;
    }

    if (!form.fullname.trim()) {
      alert("Nama wajib diisi");
      return;
    }

    if (!form.password.trim()) {
      alert("Password wajib diisi");
      return;
    }

    if (form.password.length < 6) {
      alert("Password minimal 6 karakter");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (json.success) {
        alert("User berhasil dibuat");

        setForm({
          username: "",
          fullname: "",
          password: "",
          role: "ADMIN",
        });

        setShowPassword(false);

        await load();
      } else {
        alert(json.message ?? "Gagal membuat user");
      }
    } catch (error) {
      console.error("Simpan user error:", error);
      alert("Terjadi kesalahan saat membuat user");
    } finally {
      setSaving(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) {
      return data;
    }

    return data.filter((user) => {
      return (
        user.username?.toLowerCase().includes(keyword) ||
        user.fullname?.toLowerCase().includes(keyword) ||
        user.role?.toLowerCase().includes(keyword)
      );
    });
  }, [data, search]);

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

      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  }

  return (
    <div className="min-h-full bg-[#F5F8F6] p-6 md:p-8">

      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">

        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
              <Users size={22} />
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
                Master User
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Kelola akun pengguna dan hak akses aplikasi
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={load}
          disabled={loading}
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
            className={loading ? "animate-spin" : ""}
          />

          Refresh
        </button>

      </div>


      {/* SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">

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


      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">


        {/* FORM USER */}
        <div className="rounded-2xl border border-[#DCE9E2] bg-white shadow-sm">

          <div className="border-b border-[#E5ECE8] p-5">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F2ED] text-[#497F70]">
                <UserPlus size={20} />
              </div>

              <div>
                <h2 className="font-semibold text-slate-800">
                  Tambah User
                </h2>

                <p className="text-xs text-slate-500">
                  Buat akun pengguna baru
                </p>
              </div>

            </div>

          </div>


          <div className="p-5 space-y-5">

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
                    username: e.target.value,
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
                    fullname: e.target.value,
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

              <div className="relative mt-2">

                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimal 6 karakter"
                  value={form.password}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      password: e.target.value,
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
                    setShowPassword(!showPassword)
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
                    role: e.target.value,
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
              </select>

            </div>


            {/* BUTTON */}
            <button
              onClick={simpan}
              disabled={saving}
              className="
                flex
                w-full
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-[#497F70]
                px-5
                py-3
                text-sm
                font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-[#3F6F62]
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >

              {saving ? (
                <>
                  <RefreshCw
                    size={17}
                    className="animate-spin"
                  />

                  Menyimpan...
                </>
              ) : (
                <>
                  <Plus size={18} />

                  Simpan User
                </>
              )}

            </button>

          </div>

        </div>


        {/* TABLE USER */}
        <div className="rounded-2xl border border-[#DCE9E2] bg-white shadow-sm overflow-hidden">

          <div className="border-b border-[#E5ECE8] p-5">

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

              <div>
                <h2 className="font-semibold text-slate-800">
                  Daftar User
                </h2>

                <p className="text-xs text-slate-500 mt-1">
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
                    setSearch(e.target.value)
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


          <div className="overflow-x-auto">

            <table className="w-full min-w-[650px]">

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

                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                </tr>

              </thead>


              <tbody className="divide-y divide-[#E8EEE9]">

                {loading ? (

                  <tr>
                    <td
                      colSpan={4}
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

                ) : filteredUsers.length === 0 ? (

                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      <Users
                        size={32}
                        className="mx-auto mb-3 text-slate-300"
                      />

                      Tidak ada user ditemukan.
                    </td>
                  </tr>

                ) : (

                  filteredUsers.map((user) => (

                    <tr
                      key={user.id}
                      className="transition hover:bg-[#FAFCFB]"
                    >

                      <td className="px-5 py-4">

                        <div className="flex items-center gap-3">

                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F2ED] font-semibold text-[#497F70]">
                            {user.fullname
                              ?.charAt(0)
                              ?.toUpperCase() || "U"}
                          </div>

                          <div>
                            <p className="font-medium text-slate-800">
                              {user.fullname || "-"}
                            </p>

                            <p className="text-xs text-slate-400">
                              ID #{user.id}
                            </p>
                          </div>

                        </div>

                      </td>


                      <td className="px-5 py-4 text-sm text-slate-600">
                        @{user.username}
                      </td>


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
                            ${getRoleClass(user.role)}
                          `}
                        >
                          <ShieldCheck size={13} />

                          {user.role}
                        </span>

                      </td>


                      <td className="px-5 py-4 text-center">

                        <span className="
                          inline-flex
                          items-center
                          gap-1.5
                          rounded-full
                          bg-green-50
                          px-3
                          py-1
                          text-xs
                          font-medium
                          text-green-700
                        ">

                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />

                          Aktif

                        </span>

                      </td>

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>

        </div>

      </div>

    </div>
  );
}