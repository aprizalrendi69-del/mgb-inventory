"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  CalendarDays,
  FileDown,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Users,
  UserCheck,
  Clock3,
  UserX,
} from "lucide-react";

import { exportAttendanceExcel } from "@/lib/exportAttendanceExcel";
import { exportAttendancePdf } from "@/lib/exportAttendancePdf";

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

type AttendanceReport = {
  id: number;
  nik?: string;
  name?: string;
  position?: string;
  department?: string;
  totalHadir?: number;
  totalSelesai?: number;
  totalBelumPulang?: number;
};

export default function LaporanAttendance() {
  const [data, setData] = useState<AttendanceReport[]>([]);

  const [month, setMonth] = useState(
    new Date().getMonth() + 1
  );

  const [year, setYear] = useState(
    new Date().getFullYear()
  );

  const [loading, setLoading] = useState(false);

  // =========================================================
  // LOAD DATA
  // =========================================================

  useEffect(() => {
    load();
  }, [month, year]);

  async function load() {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/laporan/attendance?month=${month}&year=${year}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (json.success) {
        setData(json.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error(
        "Gagal mengambil laporan attendance:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // SUMMARY
  // =========================================================

  const totalKaryawan = useMemo(() => {
    return data.length;
  }, [data]);

  const totalHadir = useMemo(() => {
    return data.reduce(
      (sum, item) =>
        sum + Number(item.totalHadir ?? 0),
      0
    );
  }, [data]);

  const totalSelesai = useMemo(() => {
    return data.reduce(
      (sum, item) =>
        sum + Number(item.totalSelesai ?? 0),
      0
    );
  }, [data]);

  const totalBelumPulang = useMemo(() => {
    return data.reduce(
      (sum, item) =>
        sum + Number(
          item.totalBelumPulang ?? 0
        ),
      0
    );
  }, [data]);

  // =========================================================
  // FORMAT
  // =========================================================

  function formatNumber(value: number) {
    return Number(value ?? 0).toLocaleString(
      "id-ID"
    );
  }

  // =========================================================
  // EXPORT
  // =========================================================

  function handleExportExcel() {
    if (data.length === 0) return;

    exportAttendanceExcel(
      data,
      month,
      year
    );
  }

  function handleExportPdf() {
    if (data.length === 0) return;

    exportAttendancePdf(
      data,
      month,
      year
    );
  }

  // =========================================================
  // PRINT
  // =========================================================

  function handlePrint() {
    if (data.length === 0) return;

    const columns = [
      "NIK",
      "Nama Karyawan",
      "Jabatan",
      "Department",
      "Hadir",
      "Selesai",
      "Belum Pulang",
    ];

    const rows = data.map((item) => [
      item.nik ?? "-",
      item.name ?? "-",
      item.position ?? "-",
      item.department ?? "-",
      Number(item.totalHadir ?? 0),
      Number(item.totalSelesai ?? 0),
      Number(item.totalBelumPulang ?? 0),
    ]);

    // Import dinamis supaya fungsi print tetap
    // hanya dipakai saat tombol ditekan.
    import("@/lib/print").then(
      ({ printTable }) => {
        printTable(columns, rows);
      }
    );
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading && data.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">

          <div
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-xl
              bg-[#EAF3EF]
              text-[#497F70]
            "
          >
            <RefreshCw
              size={22}
              className="animate-spin"
            />
          </div>

          <p className="text-sm font-medium text-gray-500">
            Memuat laporan attendance...
          </p>

        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div
        className="
          mb-7
          flex
          flex-col
          gap-4
          md:flex-row
          md:items-center
          md:justify-between
        "
      >

        <div className="flex items-center gap-3">

          <div
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-xl
              bg-[#497F70]
              text-white
              shadow-sm
            "
          >
            <CalendarDays size={23} />
          </div>

          <div>

            <h1
              className="
                text-2xl
                font-bold
                tracking-tight
                text-[#18352D]
                md:text-3xl
              "
            >
              Laporan Attendance
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Rekap absensi karyawan berdasarkan bulan
            </p>

          </div>

        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="
            inline-flex
            items-center
            justify-center
            gap-2
            rounded-xl
            border
            border-[#DDE9E4]
            bg-white
            px-4
            py-2.5
            text-sm
            font-semibold
            text-[#35564C]
            shadow-sm
            transition
            hover:bg-[#F5F8F6]
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>

      </div>

      {/* ================================================= */}
      {/* SUMMARY */}
      {/* ================================================= */}

      <div
        className="
          grid
          grid-cols-1
          gap-4
          sm:grid-cols-2
          xl:grid-cols-4
        "
      >

        {/* TOTAL KARYAWAN */}

        <div
          className="
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
          "
        >

          <div className="flex items-start justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Total Karyawan
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalKaryawan
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Karyawan terdaftar
              </p>

            </div>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-[#EAF3EF]
                text-[#497F70]
              "
            >
              <Users size={20} />
            </div>

          </div>

        </div>

        {/* TOTAL HADIR */}

        <div
          className="
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
          "
        >

          <div className="flex items-start justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Total Hadir
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalHadir
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Kehadiran bulan ini
              </p>

            </div>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-[#EAF3EF]
                text-[#497F70]
              "
            >
              <UserCheck size={20} />
            </div>

          </div>

        </div>

        {/* SELESAI */}

        <div
          className="
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
          "
        >

          <div className="flex items-start justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Selesai
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalSelesai
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Sudah check-out
              </p>

            </div>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-[#EAF3EF]
                text-[#497F70]
              "
            >
              <Clock3 size={20} />
            </div>

          </div>

        </div>

        {/* BELUM PULANG */}

        <div
          className="
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
          "
        >

          <div className="flex items-start justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Belum Pulang
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalBelumPulang
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Belum check-out
              </p>

            </div>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-amber-50
                text-amber-600
              "
            >
              <UserX size={20} />
            </div>

          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* FILTER & EXPORT */}
      {/* ================================================= */}

      <div
        className="
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-white
          p-5
          shadow-sm
          md:p-6
        "
      >

        <div
          className="
            flex
            flex-col
            gap-4
            xl:flex-row
            xl:items-end
            xl:justify-between
          "
        >

          {/* FILTER */}

          <div>

            <div className="mb-3">

              <h2 className="font-semibold text-[#18352D]">
                Filter Periode
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Pilih bulan dan tahun laporan attendance
              </p>

            </div>

            <div className="flex flex-col gap-3 sm:flex-row">

              {/* BULAN */}

              <div>

                <label className="mb-1.5 block text-xs font-semibold text-[#35564C]">
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
                    min-w-[170px]
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    bg-[#FAFCFB]
                    px-4
                    py-3
                    text-sm
                    text-gray-700
                    outline-none
                    transition
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-2
                    focus:ring-[#497F70]/10
                  "
                >

                  {months.map(
                    (monthName, index) => (
                      <option
                        key={index}
                        value={index + 1}
                      >
                        {monthName}
                      </option>
                    )
                  )}

                </select>

              </div>

              {/* TAHUN */}

              <div>

                <label className="mb-1.5 block text-xs font-semibold text-[#35564C]">
                  Tahun
                </label>

                <input
                  type="number"
                  value={year}
                  min={2000}
                  max={2100}
                  onChange={(e) =>
                    setYear(
                      Number(
                        e.target.value
                      )
                    )
                  }
                  className="
                    w-full
                    min-w-[130px]
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    bg-[#FAFCFB]
                    px-4
                    py-3
                    text-sm
                    text-gray-700
                    outline-none
                    transition
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-2
                    focus:ring-[#497F70]/10
                  "
                />

              </div>

            </div>

          </div>

          {/* EXPORT */}

          <div>

            <div className="mb-3">

              <h2 className="font-semibold text-[#18352D]">
                Export Laporan
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Export data periode yang dipilih
              </p>

            </div>

            <div className="flex flex-wrap gap-2">

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={
                  data.length === 0 ||
                  loading
                }
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-[#497F70]
                  px-4
                  py-3
                  text-sm
                  font-semibold
                  text-white
                  shadow-sm
                  transition
                  hover:bg-[#3D6D60]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                <FileDown size={17} />

                PDF
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={
                  data.length === 0 ||
                  loading
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
                  py-3
                  text-sm
                  font-semibold
                  text-[#35564C]
                  shadow-sm
                  transition
                  hover:bg-[#F5F8F6]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                <FileSpreadsheet size={17} />

                Excel
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={
                  data.length === 0 ||
                  loading
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
                  py-3
                  text-sm
                  font-semibold
                  text-[#35564C]
                  shadow-sm
                  transition
                  hover:bg-[#F5F8F6]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                <Printer size={17} />

                Print
              </button>

            </div>

          </div>

        </div>

        {/* INFO */}

        <div
          className="
            mt-5
            flex
            flex-col
            gap-2
            border-t
            border-[#EDF2EF]
            pt-4
            text-xs
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          <p className="text-gray-500">

            Periode:

            <span className="ml-1 font-semibold text-[#35564C]">
              {months[month - 1]}{" "}
              {year}
            </span>

          </p>

          <p className="text-gray-500">

            Menampilkan{" "}

            <span className="font-semibold text-[#35564C]">
              {formatNumber(
                data.length
              )}
            </span>{" "}

            karyawan

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
          border-[#DDE9E4]
          bg-white
          shadow-sm
        "
      >

        {/* TABLE HEADER */}

        <div
          className="
            flex
            flex-col
            gap-2
            border-b
            border-[#E5ECE9]
            px-5
            py-4
            md:flex-row
            md:items-center
            md:justify-between
            md:px-6
          "
        >

          <div>

            <h2 className="font-semibold text-[#18352D]">
              Rekap Attendance
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Rekap absensi setiap karyawan pada periode terpilih
            </p>

          </div>

          <div
            className="
              w-fit
              rounded-full
              bg-[#EAF3EF]
              px-3
              py-1
              text-xs
              font-semibold
              text-[#497F70]
            "
          >
            {formatNumber(
              data.length
            )}{" "}
            Karyawan
          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="min-w-[1000px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="w-16 px-5 py-4 text-center font-semibold text-[#35564C]">
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

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Department
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Hadir
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Selesai
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Belum Pulang
                </th>

              </tr>

            </thead>

            <tbody>

              {data.length === 0 ? (

                <tr>

                  <td
                    colSpan={8}
                    className="px-5 py-14 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <div
                        className="
                          mb-3
                          flex
                          h-14
                          w-14
                          items-center
                          justify-center
                          rounded-full
                          bg-[#EAF3EF]
                          text-[#497F70]
                        "
                      >
                        <Users size={25} />
                      </div>

                      <p className="font-semibold text-gray-700">
                        Belum ada data absensi
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        Tidak ada data attendance untuk periode{" "}
                        {months[month - 1]} {year}
                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                data.map(
                  (
                    employee,
                    index
                  ) => {

                    const hadir =
                      Number(
                        employee.totalHadir ?? 0
                      );

                    const selesai =
                      Number(
                        employee.totalSelesai ?? 0
                      );

                    const belumPulang =
                      Number(
                        employee.totalBelumPulang ?? 0
                      );

                    return (
                      <tr
                        key={employee.id}
                        className="
                          border-b
                          border-[#EDF2EF]
                          transition
                          hover:bg-[#FAFCFB]
                        "
                      >

                        {/* NO */}

                        <td className="px-5 py-4 text-center text-gray-500">
                          {index + 1}
                        </td>

                        {/* NIK */}

                        <td className="px-5 py-4">

                          <span className="font-mono font-semibold text-[#35564C]">
                            {employee.nik ?? "-"}
                          </span>

                        </td>

                        {/* NAMA */}

                        <td className="px-5 py-4">

                          <Link
                            href={`/laporan/attendance/${employee.id}`}
                            className="
                              font-semibold
                              text-[#497F70]
                              transition
                              hover:text-[#3D6D60]
                              hover:underline
                            "
                          >
                            {employee.name ?? "-"}
                          </Link>

                        </td>

                        {/* JABATAN */}

                        <td className="px-5 py-4 text-gray-600">
                          {employee.position ?? "-"}
                        </td>

                        {/* DEPARTMENT */}

                        <td className="px-5 py-4 text-gray-600">
                          {employee.department ?? "-"}
                        </td>

                        {/* HADIR */}

                        <td className="px-5 py-4 text-center">

                          <span
                            className="
                              inline-flex
                              min-w-[42px]
                              items-center
                              justify-center
                              rounded-full
                              bg-[#EAF3EF]
                              px-3
                              py-1
                              font-semibold
                              text-[#497F70]
                            "
                          >
                            {formatNumber(hadir)}
                          </span>

                        </td>

                        {/* SELESAI */}

                        <td className="px-5 py-4 text-center">

                          <span
                            className="
                              inline-flex
                              min-w-[42px]
                              items-center
                              justify-center
                              rounded-full
                              bg-[#EAF3EF]
                              px-3
                              py-1
                              font-semibold
                              text-[#497F70]
                            "
                          >
                            {formatNumber(selesai)}
                          </span>

                        </td>

                        {/* BELUM PULANG */}

                        <td className="px-5 py-4 text-center">

                          <span
                            className={`
                              inline-flex
                              min-w-[42px]
                              items-center
                              justify-center
                              rounded-full
                              px-3
                              py-1
                              font-semibold
                              ${
                                belumPulang > 0
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-[#EAF3EF] text-[#497F70]"
                              }
                            `}
                          >
                            {formatNumber(
                              belumPulang
                            )}
                          </span>

                        </td>

                      </tr>
                    );
                  }
                )

              )}

            </tbody>

          </table>

        </div>

        {/* ================================================= */}
        {/* FOOTER */}
        {/* ================================================= */}

        <div
          className="
            border-t
            border-[#E5ECE9]
            bg-[#F5F8F6]
            px-5
            py-4
            md:px-6
          "
        >

          <div
            className="
              flex
              flex-col
              gap-2
              text-sm
              md:flex-row
              md:items-center
              md:justify-between
            "
          >

            <div className="text-gray-500">

              Menampilkan{" "}

              <span className="font-semibold text-[#35564C]">
                {formatNumber(
                  data.length
                )}
              </span>{" "}

              karyawan

            </div>

            <div className="font-semibold text-[#35564C]">

              Periode:{" "}

              <span className="text-[#497F70]">
                {months[month - 1]} {year}
              </span>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}