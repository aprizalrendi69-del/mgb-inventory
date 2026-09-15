"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

const months = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

type Attendance = {
  id: number;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  photoIn?: string | null;
  photoOut?: string | null;
};

type Employee = {
  id: number;
  nik: string;
  name: string;
  position?: string | null;
  department?: string | null;
  attendances: Attendance[];
};

export default function AttendanceDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const [id, setId] = useState("");

  const [employee, setEmployee] =
    useState<Employee | null>(null);

  const [month, setMonth] = useState(
    new Date().getMonth() + 1
  );

  const [year, setYear] = useState(
    new Date().getFullYear()
  );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // =========================================================
  // GET PARAM ID
  // =========================================================

  useEffect(() => {
    async function getParams() {
      const p = await params;

      setId(p.id);
    }

    getParams();
  }, [params]);

  // =========================================================
  // LOAD DATA
  // =========================================================

  useEffect(() => {
    if (!id) return;

    loadData();
  }, [id, month, year]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const url =
        `/api/laporan/attendance/${id}` +
        `?month=${month}&year=${year}`;

      console.log(
        "LOAD DETAIL ATTENDANCE:",
        url
      );

      const res = await fetch(url, {
        cache: "no-store",
      });

      const json = await res.json();

      console.log(
        "DETAIL ATTENDANCE RESPONSE:",
        json
      );

      if (!res.ok || !json.success) {
        setEmployee(null);

        setError(
          json.message ||
            "Gagal mengambil data attendance."
        );

        return;
      }

      setEmployee(json.data);
    } catch (err) {
      console.error(
        "LOAD DETAIL ATTENDANCE ERROR:",
        err
      );

      setEmployee(null);

      setError(
        "Terjadi kesalahan saat mengambil data."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // FORMAT
  // =========================================================

  function formatDate(
    value: string
  ) {
    if (!value) return "-";

    return new Date(
      value
    ).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatTime(
    value?: string | null
  ) {
    if (!value) return "-";

    return new Date(
      value
    ).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  // =========================================================
  // SUMMARY
  // =========================================================

  const totalHadir =
    employee?.attendances?.length ?? 0;

  const totalSelesai =
    employee?.attendances?.filter(
      (item) => item.checkOut
    ).length ?? 0;

  const totalBelumPulang =
    employee?.attendances?.filter(
      (item) => !item.checkOut
    ).length ?? 0;

  // =========================================================
  // LOADING
  // =========================================================

  if (loading && !employee) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-3 text-lg font-semibold text-slate-700">
            Memuat data attendance...
          </div>

          <div className="text-sm text-slate-400">
            Mohon tunggu sebentar
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (error && !employee) {
    return (
      <div className="p-8">
        <Link
          href="/laporan/attendance"
          className="
            inline-flex
            items-center
            gap-2
            font-semibold
            text-blue-600
            hover:text-blue-800
          "
        >
          ← Kembali ke Laporan Attendance
        </Link>

        <div
          className="
            mt-6
            rounded-2xl
            border
            border-red-200
            bg-red-50
            p-6
            text-red-700
          "
        >
          {error}
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8">
        <Link
          href="/laporan/attendance"
          className="
            font-semibold
            text-blue-600
            hover:underline
          "
        >
          ← Kembali ke Laporan Attendance
        </Link>

        <div className="mt-6 text-slate-500">
          Data karyawan tidak ditemukan.
        </div>
      </div>
    );
  }

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="space-y-6 p-8">

      {/* ================================================= */}
      {/* BACK */}
      {/* ================================================= */}

      <Link
        href="/laporan/attendance"
        className="
          inline-flex
          items-center
          gap-2
          text-sm
          font-semibold
          text-blue-600
          transition
          hover:text-blue-800
          hover:underline
        "
      >
        ← Kembali ke Laporan Attendance
      </Link>

      {/* ================================================= */}
      {/* HEADER EMPLOYEE */}
      {/* ================================================= */}

      <div
        className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-6
          shadow-sm
        "
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <p className="text-sm font-medium text-slate-500">
              Detail Absensi Karyawan
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-800">
              {employee.name}
            </h1>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">

              <div>
                <span className="text-slate-400">
                  NIK:
                </span>{" "}
                <span className="font-semibold">
                  {employee.nik}
                </span>
              </div>

              <div>
                <span className="text-slate-400">
                  Jabatan:
                </span>{" "}
                <span className="font-semibold">
                  {employee.position ||
                    "-"}
                </span>
              </div>

              <div>
                <span className="text-slate-400">
                  Department:
                </span>{" "}
                <span className="font-semibold">
                  {employee.department ||
                    "-"}
                </span>
              </div>

            </div>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="
              rounded-xl
              bg-blue-600
              px-5
              py-3
              text-sm
              font-semibold
              text-white
              transition
              hover:bg-blue-700
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {loading
              ? "Memuat..."
              : "Refresh"}
          </button>

        </div>
      </div>

      {/* ================================================= */}
      {/* FILTER */}
      {/* ================================================= */}

      <div
        className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-5
          shadow-sm
        "
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Filter Periode
          </h2>

          <p className="text-sm text-slate-500">
            Pilih bulan dan tahun untuk melihat
            riwayat absensi
          </p>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-end">

          {/* BULAN */}

          <div className="w-full md:w-56">
            <label className="mb-2 block text-sm font-medium text-slate-600">
              Bulan
            </label>

            <select
              value={month}
              onChange={(e) =>
                setMonth(
                  Number(
                    e.target.value
                  )
                )
              }
              className="
                w-full
                rounded-xl
                border
                border-slate-200
                bg-white
                px-4
                py-3
                text-sm
                outline-none
                transition
                focus:border-blue-500
                focus:ring-2
                focus:ring-blue-100
              "
            >
              {months.map(
                (name, index) => (
                  <option
                    key={index}
                    value={index + 1}
                  >
                    {name}
                  </option>
                )
              )}
            </select>
          </div>

          {/* TAHUN */}

          <div className="w-full md:w-40">
            <label className="mb-2 block text-sm font-medium text-slate-600">
              Tahun
            </label>

            <input
              type="number"
              value={year}
              onChange={(e) =>
                setYear(
                  Number(
                    e.target.value
                  )
                )
              }
              className="
                w-full
                rounded-xl
                border
                border-slate-200
                bg-white
                px-4
                py-3
                text-sm
                outline-none
                transition
                focus:border-blue-500
                focus:ring-2
                focus:ring-blue-100
              "
            />
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="
              rounded-xl
              bg-blue-600
              px-6
              py-3
              text-sm
              font-semibold
              text-white
              transition
              hover:bg-blue-700
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {loading
              ? "Memuat..."
              : "🔎 Tampilkan"}
          </button>

        </div>
      </div>

      {/* ================================================= */}
      {/* SUMMARY */}
      {/* ================================================= */}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        {/* HADIR */}

        <div
          className="
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-5
            shadow-sm
          "
        >
          <p className="text-sm font-medium text-slate-500">
            Total Hadir
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-800">
            {totalHadir.toLocaleString(
              "id-ID"
            )}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Hari hadir pada periode ini
          </p>
        </div>

        {/* SELESAI */}

        <div
          className="
            rounded-2xl
            border
            border-green-200
            bg-white
            p-5
            shadow-sm
          "
        >
          <p className="text-sm font-medium text-slate-500">
            Selesai
          </p>

          <p className="mt-2 text-3xl font-bold text-green-600">
            {totalSelesai.toLocaleString(
              "id-ID"
            )}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Sudah melakukan check out
          </p>
        </div>

        {/* BELUM PULANG */}

        <div
          className="
            rounded-2xl
            border
            border-yellow-200
            bg-white
            p-5
            shadow-sm
          "
        >
          <p className="text-sm font-medium text-slate-500">
            Belum Pulang
          </p>

          <p className="mt-2 text-3xl font-bold text-yellow-600">
            {totalBelumPulang.toLocaleString(
              "id-ID"
            )}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Belum melakukan check out
          </p>
        </div>

      </div>

      {/* ================================================= */}
      {/* TABLE */}
      {/* ================================================= */}

      <div
        className="
          overflow-hidden
          rounded-2xl
          border
          border-slate-200
          bg-white
          shadow-sm
        "
      >

        {/* TABLE HEADER */}

        <div
          className="
            border-b
            border-slate-200
            px-5
            py-4
          "
        >
          <h2 className="font-semibold text-slate-800">
            Riwayat Absensi
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {months[month - 1]}{" "}
            {year}
          </p>
        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1000px]">

            <thead className="bg-slate-50">

              <tr>

                <th className="px-5 py-4 text-left text-sm font-semibold text-slate-600">
                  Tanggal
                </th>

                <th className="px-5 py-4 text-center text-sm font-semibold text-slate-600">
                  Check In
                </th>

                <th className="px-5 py-4 text-center text-sm font-semibold text-slate-600">
                  Foto Masuk
                </th>

                <th className="px-5 py-4 text-center text-sm font-semibold text-slate-600">
                  Check Out
                </th>

                <th className="px-5 py-4 text-center text-sm font-semibold text-slate-600">
                  Foto Keluar
                </th>

                <th className="px-5 py-4 text-center text-sm font-semibold text-slate-600">
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan={6}
                    className="
                      px-5
                      py-12
                      text-center
                      text-slate-500
                    "
                  >
                    Memuat data attendance...
                  </td>

                </tr>

              ) : employee.attendances.length === 0 ? (

                <tr>

                  <td
                    colSpan={6}
                    className="
                      px-5
                      py-12
                      text-center
                      text-slate-500
                    "
                  >
                    Belum ada absensi pada periode{" "}
                    <span className="font-semibold">
                      {months[month - 1]}{" "}
                      {year}
                    </span>
                    .
                  </td>

                </tr>

              ) : (

                employee.attendances.map(
                  (attendance) => {

                    const selesai =
                      Boolean(
                        attendance.checkOut
                      );

                    return (
                      <tr
                        key={
                          attendance.id
                        }
                        className="
                          border-t
                          border-slate-100
                          transition
                          hover:bg-slate-50
                        "
                      >

                        {/* TANGGAL */}

                        <td className="px-5 py-4 font-medium text-slate-700">
                          {formatDate(
                            attendance.date
                          )}
                        </td>

                        {/* CHECK IN */}

                        <td className="px-5 py-4 text-center">

                          <span className="font-semibold text-slate-700">
                            {formatTime(
                              attendance.checkIn
                            )}
                          </span>

                        </td>

                        {/* FOTO MASUK */}

                        <td className="px-5 py-4">

                          <div className="flex justify-center">

                            {attendance.photoIn ? (

                              <img
                                src={
                                  attendance.photoIn
                                }
                                alt="Foto masuk"
                                className="
                                  h-20
                                  w-20
                                  rounded-xl
                                  border
                                  border-slate-200
                                  object-cover
                                "
                              />

                            ) : (

                              <span className="text-sm text-slate-400">
                                Tidak ada foto
                              </span>

                            )}

                          </div>

                        </td>

                        {/* CHECK OUT */}

                        <td className="px-5 py-4 text-center">

                          <span className="font-semibold text-slate-700">
                            {formatTime(
                              attendance.checkOut
                            )}
                          </span>

                        </td>

                        {/* FOTO KELUAR */}

                        <td className="px-5 py-4">

                          <div className="flex justify-center">

                            {attendance.photoOut ? (

                              <img
                                src={
                                  attendance.photoOut
                                }
                                alt="Foto keluar"
                                className="
                                  h-20
                                  w-20
                                  rounded-xl
                                  border
                                  border-slate-200
                                  object-cover
                                "
                              />

                            ) : (

                              <span className="text-sm text-slate-400">
                                Tidak ada foto
                              </span>

                            )}

                          </div>

                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-4 text-center">

                          {selesai ? (

                            <span
                              className="
                                inline-flex
                                rounded-full
                                bg-green-100
                                px-3
                                py-1.5
                                text-xs
                                font-semibold
                                text-green-700
                              "
                            >
                              Selesai
                            </span>

                          ) : (

                            <span
                              className="
                                inline-flex
                                rounded-full
                                bg-yellow-100
                                px-3
                                py-1.5
                                text-xs
                                font-semibold
                                text-yellow-700
                              "
                            >
                              Belum Pulang
                            </span>

                          )}

                        </td>

                      </tr>
                    );
                  }
                )

              )}

            </tbody>

          </table>

        </div>

        {/* FOOTER */}

        <div
          className="
            border-t
            border-slate-200
            bg-slate-50
            px-5
            py-4
          "
        >
          <div className="text-sm text-slate-500">

            Menampilkan{" "}

            <span className="font-semibold text-slate-700">
              {employee.attendances.length}
            </span>{" "}

            data absensi pada{" "}

            <span className="font-semibold text-slate-700">
              {months[month - 1]}{" "}
              {year}
            </span>

          </div>
        </div>

      </div>

    </div>
  );
}