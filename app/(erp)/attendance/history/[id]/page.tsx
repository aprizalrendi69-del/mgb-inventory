"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Attendance = {
  id: number;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  photoIn: string | null;
  photoOut: string | null;
  note: string | null;
};

type Employee = {
  id: number;
  nik: string;
  name: string;
  position: string | null;
  department?: string | null;
};

type AttendanceResponse = {
  employee: Employee;
  attendance: Attendance[];
};

export default function AttendanceDetailPage() {
  const params = useParams();
  const router = useRouter();

  const id = String(params.id || "");

  const [data, setData] =
    useState<AttendanceResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [from, setFrom] =
    useState("");

  const [to, setTo] =
    useState("");

  useEffect(() => {
    if (!id) return;

    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(
        `/api/attendance/history/${id}`
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil data absensi"
        );
      }

      setData(json.data);
    } catch (error: any) {
      console.error(
        "LOAD ATTENDANCE DETAIL ERROR:",
        error
      );

      setError(
        error.message ||
          "Gagal mengambil data absensi"
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
          <div className="text-gray-500">
            Memuat data absensi...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <button
          onClick={() => router.back()}
          className="mb-5 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
        >
          ← Kembali
        </button>

        <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
          <div className="text-red-600 font-semibold mb-2">
            Gagal Memuat Data
          </div>

          <div className="text-gray-600 text-sm">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
          Data tidak ditemukan.
        </div>
      </div>
    );
  }

  const attendance = data.attendance.filter(
    (item) => {
      /*
       * Gunakan field date sebagai tanggal absensi,
       * bukan checkIn.
       *
       * Ini lebih aman karena date selalu ada.
       */
      const tanggal = new Date(item.date)
        .toISOString()
        .split("T")[0];

      if (from && tanggal < from) {
        return false;
      }

      if (to && tanggal > to) {
        return false;
      }

      return true;
    }
  );

  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* HEADER */}
      <div>
        <button
          onClick={() => router.back()}
          className="
            mb-4
            inline-flex
            items-center
            gap-2
            px-4
            py-2
            rounded-lg
            bg-gray-100
            hover:bg-gray-200
            text-gray-700
            text-sm
            font-medium
            transition
          "
        >
          ← Kembali
        </button>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Detail Absensi
        </h1>

        <p className="text-gray-500 mt-1">
          Riwayat absensi karyawan
        </p>
      </div>


      {/* EMPLOYEE INFORMATION */}
      <div className="
        bg-white
        rounded-xl
        border
        border-gray-200
        shadow-sm
        p-6
      ">

        <div className="
          flex
          flex-col
          md:flex-row
          md:items-center
          md:justify-between
          gap-5
        ">

          <div>

            <div className="
              text-xl
              font-bold
              text-gray-900
            ">
              {data.employee.name}
            </div>

            <div className="
              text-sm
              text-gray-500
              mt-1
            ">
              {data.employee.department || "-"}
            </div>

          </div>


          <div className="
            grid
            grid-cols-2
            gap-x-8
            gap-y-2
            text-sm
          ">

            <div>
              <span className="text-gray-500">
                NIK
              </span>

              <div className="font-semibold text-gray-900">
                {data.employee.nik}
              </div>
            </div>


            <div>
              <span className="text-gray-500">
                Jabatan
              </span>

              <div className="font-semibold text-gray-900">
                {data.employee.position || "-"}
              </div>
            </div>

          </div>

        </div>


        {/* SUMMARY */}
        <div className="
          mt-6
          pt-5
          border-t
          grid
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-4
          gap-4
        ">

          <div className="
            rounded-lg
            bg-blue-50
            p-4
          ">
            <div className="text-sm text-blue-600">
              Total Kehadiran
            </div>

            <div className="
              text-2xl
              font-bold
              text-blue-700
              mt-1
            ">
              {attendance.length}
            </div>

            <div className="text-xs text-blue-500">
              Hari
            </div>
          </div>


          <div className="
            rounded-lg
            bg-green-50
            p-4
          ">
            <div className="text-sm text-green-600">
              Check In
            </div>

            <div className="
              text-2xl
              font-bold
              text-green-700
              mt-1
            ">
              {
                attendance.filter(
                  (item) => item.checkIn
                ).length
              }
            </div>

            <div className="text-xs text-green-500">
              Hari
            </div>
          </div>


          <div className="
            rounded-lg
            bg-orange-50
            p-4
          ">
            <div className="text-sm text-orange-600">
              Check Out
            </div>

            <div className="
              text-2xl
              font-bold
              text-orange-700
              mt-1
            ">
              {
                attendance.filter(
                  (item) => item.checkOut
                ).length
              }
            </div>

            <div className="text-xs text-orange-500">
              Hari
            </div>
          </div>


          <div className="
            rounded-lg
            bg-gray-50
            p-4
          ">
            <div className="text-sm text-gray-600">
              Belum Check Out
            </div>

            <div className="
              text-2xl
              font-bold
              text-gray-700
              mt-1
            ">
              {
                attendance.filter(
                  (item) =>
                    item.checkIn &&
                    !item.checkOut
                ).length
              }
            </div>

            <div className="text-xs text-gray-500">
              Hari
            </div>
          </div>

        </div>

      </div>


      {/* DATE FILTER */}
      <div className="
        bg-white
        rounded-xl
        border
        border-gray-200
        shadow-sm
        p-6
      ">

        <h2 className="
          text-lg
          font-bold
          text-gray-900
          mb-4
        ">
          Filter Tanggal
        </h2>

        <div className="
          grid
          grid-cols-1
          md:grid-cols-3
          gap-4
          items-end
        ">

          <div>

            <label className="
              block
              text-sm
              font-medium
              text-gray-600
              mb-2
            ">
              Dari Tanggal
            </label>

            <input
              type="date"
              className="
                border
                border-gray-300
                rounded-lg
                p-3
                w-full
                outline-none
                focus:ring-2
                focus:ring-blue-500
              "
              value={from}
              onChange={(e) =>
                setFrom(e.target.value)
              }
            />

          </div>


          <div>

            <label className="
              block
              text-sm
              font-medium
              text-gray-600
              mb-2
            ">
              Sampai Tanggal
            </label>

            <input
              type="date"
              className="
                border
                border-gray-300
                rounded-lg
                p-3
                w-full
                outline-none
                focus:ring-2
                focus:ring-blue-500
              "
              value={to}
              onChange={(e) =>
                setTo(e.target.value)
              }
            />

          </div>


          <button
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            className="
              bg-gray-100
              hover:bg-gray-200
              text-gray-700
              px-5
              py-3
              rounded-lg
              font-medium
              transition
            "
          >
            Reset Filter
          </button>

        </div>

      </div>


      {/* ATTENDANCE TABLE */}
      <div className="
        bg-white
        rounded-xl
        border
        border-gray-200
        shadow-sm
        overflow-hidden
      ">

        <div className="
          px-6
          py-5
          border-b
          border-gray-200
        ">

          <h2 className="
            text-lg
            font-bold
            text-gray-900
          ">
            Riwayat Absensi
          </h2>

          <p className="
            text-sm
            text-gray-500
            mt-1
          ">
            {attendance.length} data ditemukan
          </p>

        </div>


        <div className="overflow-x-auto">

          <table className="
            w-full
            border-collapse
            min-w-[900px]
          ">

            <thead className="bg-gray-50">

              <tr>

                <th className="
                  border-b
                  p-4
                  text-left
                  text-sm
                  font-semibold
                  text-gray-600
                ">
                  Tanggal
                </th>

                <th className="
                  border-b
                  p-4
                  text-left
                  text-sm
                  font-semibold
                  text-gray-600
                ">
                  Check In
                </th>

                <th className="
                  border-b
                  p-4
                  text-left
                  text-sm
                  font-semibold
                  text-gray-600
                ">
                  Foto In
                </th>

                <th className="
                  border-b
                  p-4
                  text-left
                  text-sm
                  font-semibold
                  text-gray-600
                ">
                  Check Out
                </th>

                <th className="
                  border-b
                  p-4
                  text-left
                  text-sm
                  font-semibold
                  text-gray-600
                ">
                  Foto Out
                </th>

                <th className="
                  border-b
                  p-4
                  text-left
                  text-sm
                  font-semibold
                  text-gray-600
                ">
                  Catatan
                </th>

              </tr>

            </thead>


            <tbody>

              {attendance.length === 0 ? (

                <tr>

                  <td
                    colSpan={6}
                    className="
                      p-8
                      text-center
                      text-gray-500
                    "
                  >
                    Belum ada data absensi
                    pada periode yang dipilih.
                  </td>

                </tr>

              ) : (

                attendance.map(
                  (item) => (

                    <tr
                      key={item.id}
                      className="
                        hover:bg-gray-50
                        transition
                      "
                    >

                      {/* DATE */}
                      <td className="
                        p-4
                        border-b
                        text-sm
                        text-gray-700
                        whitespace-nowrap
                      ">
                        {new Date(
                          item.date
                        ).toLocaleDateString(
                          "id-ID",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          }
                        )}
                      </td>


                      {/* CHECK IN */}
                      <td className="
                        p-4
                        border-b
                        text-sm
                        font-medium
                        text-green-700
                        whitespace-nowrap
                      ">

                        {item.checkIn
                          ? new Date(
                              item.checkIn
                            ).toLocaleTimeString(
                              "id-ID",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "-"}

                      </td>


                      {/* FOTO IN */}
                      <td className="
                        p-4
                        border-b
                      ">

                        {item.photoIn ? (

                          <img
                            src={item.photoIn}
                            alt="Foto Check In"
                            className="
                              w-16
                              h-16
                              object-cover
                              rounded-lg
                              border
                              border-gray-200
                            "
                          />

                        ) : (

                          <span className="
                            text-gray-400
                            text-sm
                          ">
                            -
                          </span>

                        )}

                      </td>


                      {/* CHECK OUT */}
                      <td className="
                        p-4
                        border-b
                        text-sm
                        font-medium
                        text-red-600
                        whitespace-nowrap
                      ">

                        {item.checkOut
                          ? new Date(
                              item.checkOut
                            ).toLocaleTimeString(
                              "id-ID",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "-"}

                      </td>


                      {/* FOTO OUT */}
                      <td className="
                        p-4
                        border-b
                      ">

                        {item.photoOut ? (

                          <img
                            src={item.photoOut}
                            alt="Foto Check Out"
                            className="
                              w-16
                              h-16
                              object-cover
                              rounded-lg
                              border
                              border-gray-200
                            "
                          />

                        ) : (

                          <span className="
                            text-gray-400
                            text-sm
                          ">
                            -
                          </span>

                        )}

                      </td>


                      {/* NOTE */}
                      <td className="
                        p-4
                        border-b
                        text-sm
                        text-gray-600
                        max-w-[250px]
                      ">

                        {item.note || "-"}

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
  );
}