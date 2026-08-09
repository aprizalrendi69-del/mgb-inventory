"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Users,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  RefreshCw,
} from "lucide-react";

export default function EmployeePage() {
  const [employee, setEmployee] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("SEMUA");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);

      const res = await fetch("/api/employee", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setEmployee(json.data ?? []);
      } else {
        setEmployee([]);
      }
    } catch (error) {
      console.error("Load employee error:", error);
      setEmployee([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function hapus(id: number, name: string) {
    const yakin = confirm(
      `Hapus karyawan "${name}"?\n\nData yang sudah dihapus tidak dapat dikembalikan.`
    );

    if (!yakin) return;

    try {
      const res = await fetch(`/api/employee/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      alert(json.message);

      if (json.success) {
        load();
      }
    } catch (error) {
      console.error(error);
      alert("Gagal menghapus karyawan.");
    }
  }

  const filteredEmployee = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return employee.filter((item: any) => {
      const cocokSearch =
        !keyword ||
        item.name?.toLowerCase().includes(keyword) ||
        item.nik?.toLowerCase().includes(keyword) ||
        item.position?.toLowerCase().includes(keyword);

      const cocokStatus =
        status === "SEMUA" ||
        (status === "AKTIF" && item.active) ||
        (status === "NONAKTIF" && !item.active);

      return cocokSearch && cocokStatus;
    });
  }, [employee, search, status]);

  const totalAktif = employee.filter((item) => item.active).length;
  const totalNonAktif = employee.filter((item) => !item.active).length;

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* HEADER */}
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
              <Users size={22} />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
                Master Karyawan
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Kelola data karyawan dan status keaktifan karyawan.
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/karyawan/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3D6D60]"
        >
          <Plus size={18} />
          Tambah Karyawan
        </Link>
      </div>

      {/* SUMMARY */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Total Karyawan
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {employee.length}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Users size={21} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Karyawan Aktif
              </p>

              <p className="mt-1 text-2xl font-bold text-green-600">
                {totalAktif}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <UserCheck size={21} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Non Aktif
              </p>

              <p className="mt-1 text-2xl font-bold text-gray-500">
                {totalNonAktif}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
              <UserX size={21} />
            </div>
          </div>
        </div>

      </div>

      {/* TABLE CARD */}
      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        {/* TOOLBAR */}
        <div className="border-b border-[#E5ECE9] p-4 md:p-5">

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

            <div className="relative w-full lg:max-w-md">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                placeholder="Cari nama, NIK, atau jabatan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-2.5 text-sm outline-none focus:border-[#497F70]"
              >
                <option value="SEMUA">
                  Semua Status
                </option>

                <option value="AKTIF">
                  Aktif
                </option>

                <option value="NONAKTIF">
                  Non Aktif
                </option>
              </select>

              <button
                onClick={load}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-[#F5F8F6]"
              >
                <RefreshCw size={16} />
                Refresh
              </button>

            </div>

          </div>

          <div className="mt-4 text-sm text-gray-500">
            Menampilkan{" "}
            <span className="font-semibold text-[#18352D]">
              {filteredEmployee.length}
            </span>{" "}
            dari{" "}
            <span className="font-semibold text-[#18352D]">
              {employee.length}
            </span>{" "}
            karyawan
          </div>

        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">

          <table className="min-w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  NIK
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Nama Karyawan
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Jabatan
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Status
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Aksi
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-14 text-center"
                  >
                    <div className="flex flex-col items-center justify-center gap-3 text-gray-500">

                      <RefreshCw
                        size={24}
                        className="animate-spin text-[#497F70]"
                      />

                      <span>
                        Memuat data karyawan...
                      </span>

                    </div>
                  </td>
                </tr>

              ) : filteredEmployee.length === 0 ? (

                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-14 text-center"
                  >
                    <div className="flex flex-col items-center">

                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF3EF] text-[#497F70]">
                        <Users size={25} />
                      </div>

                      <p className="font-semibold text-gray-700">
                        Tidak ada data karyawan
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        Coba ubah kata pencarian atau filter status.
                      </p>

                    </div>
                  </td>
                </tr>

              ) : (

                filteredEmployee.map((e: any, index: number) => (

                  <tr
                    key={e.id}
                    className="border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                  >

                    <td className="px-5 py-4 text-gray-500">
                      {index + 1}
                    </td>

                    <td className="px-5 py-4">
                      <span className="font-medium text-gray-700">
                        {e.nik || "-"}
                      </span>
                    </td>

                    <td className="px-5 py-4">

                      <div className="flex items-center gap-3">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF3EF] font-semibold text-[#497F70]">
                          {e.name
                            ? e.name.charAt(0).toUpperCase()
                            : "?"}
                        </div>

                        <div>
                          <p className="font-semibold text-[#18352D]">
                            {e.name}
                          </p>
                        </div>

                      </div>

                    </td>

                    <td className="px-5 py-4 text-gray-600">
                      {e.position || "-"}
                    </td>

                    <td className="px-5 py-4 text-center">

                      {e.active ? (

                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Aktif
                        </span>

                      ) : (

                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                          Non Aktif
                        </span>

                      )}

                    </td>

                    <td className="px-5 py-4">

                      <div className="flex items-center justify-center gap-2">

                        <Link
                          href={`/karyawan/${e.id}/edit`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                        >
                          <Pencil size={14} />
                          Edit
                        </Link>

                        <button
                          onClick={() =>
                            hapus(e.id, e.name)
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                        >
                          <Trash2 size={14} />
                          Hapus
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

    </div>
  );
}