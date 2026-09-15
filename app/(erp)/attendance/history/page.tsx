"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";

export default function AttendanceHistory() {
  const [data, setData] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [employeeId, setEmployeeId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingEmployee, setLoadingEmployee] = useState(true);

  useEffect(() => {
    loadEmployee();
    load();
  }, []);

  async function loadEmployee() {
    try {
      setLoadingEmployee(true);

      const res = await fetch("/api/employee", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setEmployees(json.data ?? []);
      } else {
        setEmployees([]);
      }
    } catch (error) {
      console.error("LOAD EMPLOYEE ERROR:", error);
      setEmployees([]);
    } finally {
      setLoadingEmployee(false);
    }
  }

  async function load() {
    try {
      setLoading(true);

      let url = "/api/attendance/history";

      const params = new URLSearchParams();

      if (employeeId) {
        params.append("employeeId", employeeId);
      }

      if (start) {
        params.append("start", start);
      }

      if (end) {
        params.append("end", end);
      }

      if (params.toString()) {
        url += "?" + params.toString();
      }

      const res = await fetch(url, {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setData(json.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error("LOAD ATTENDANCE ERROR:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(value: any) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatTime(value: any) {
    if (!value) return "-";

    return new Date(value).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const totalAbsensi = data.length;

  const selesai = data.filter(
    (item) => item.checkOut
  ).length;

  const belumPulang = data.filter(
    (item) => !item.checkOut
  ).length;

  const terlambat = data.filter(
    (item) => item.late
  ).length;

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* ==========================================
          HEADER
      ========================================== */}

      <div className="
        mb-7
        flex
        flex-col
        gap-4
        md:flex-row
        md:items-center
        md:justify-between
      ">

        <div className="flex items-center gap-3">

          <div className="
            flex
            h-12
            w-12
            items-center
            justify-center
            rounded-xl
            bg-[#497F70]
            text-white
            shadow-sm
          ">
            <CalendarDays size={23} />
          </div>

          <div>

            <h1 className="
              text-2xl
              font-bold
              tracking-tight
              text-[#18352D]
              md:text-3xl
            ">
              Riwayat Absensi
            </h1>

            <p className="
              mt-1
              text-sm
              text-gray-500
            ">
              Riwayat kehadiran dan aktivitas absensi karyawan
            </p>

          </div>

        </div>


        <button
          type="button"
          onClick={() => {
            loadEmployee();
            load();
          }}
          disabled={loading || loadingEmployee}
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
            text-gray-700
            shadow-sm
            transition
            hover:bg-[#F5F8F6]
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >

          <RefreshCw
            size={17}
            className={
              loading || loadingEmployee
                ? "animate-spin"
                : ""
            }
          />

          Refresh

        </button>

      </div>


      {/* ==========================================
          SUMMARY
      ========================================== */}

      <div className="
        mb-6
        grid
        grid-cols-1
        gap-4
        sm:grid-cols-2
        lg:grid-cols-4
      ">

        {/* TOTAL */}

        <div className="
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-white
          p-5
          shadow-sm
        ">

          <div className="
            flex
            items-center
            justify-between
          ">

            <div>

              <p className="text-sm text-gray-500">
                Total Absensi
              </p>

              <p className="
                mt-1
                text-2xl
                font-bold
                text-[#18352D]
              ">
                {totalAbsensi.toLocaleString("id-ID")}
              </p>

            </div>

            <div className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-[#EAF3EF]
              text-[#497F70]
            ">
              <Users size={21} />
            </div>

          </div>

        </div>


        {/* SELESAI */}

        <div className="
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-white
          p-5
          shadow-sm
        ">

          <div className="
            flex
            items-center
            justify-between
          ">

            <div>

              <p className="text-sm text-gray-500">
                Sudah Pulang
              </p>

              <p className="
                mt-1
                text-2xl
                font-bold
                text-green-600
              ">
                {selesai.toLocaleString("id-ID")}
              </p>

            </div>

            <div className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-green-50
              text-green-600
            ">
              <CheckCircle2 size={21} />
            </div>

          </div>

        </div>


        {/* BELUM PULANG */}

        <div className="
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-white
          p-5
          shadow-sm
        ">

          <div className="
            flex
            items-center
            justify-between
          ">

            <div>

              <p className="text-sm text-gray-500">
                Belum Pulang
              </p>

              <p className="
                mt-1
                text-2xl
                font-bold
                text-red-600
              ">
                {belumPulang.toLocaleString("id-ID")}
              </p>

            </div>

            <div className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-red-50
              text-red-600
            ">
              <XCircle size={21} />
            </div>

          </div>

        </div>


        {/* TERLAMBAT */}

        <div className="
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-white
          p-5
          shadow-sm
        ">

          <div className="
            flex
            items-center
            justify-between
          ">

            <div>

              <p className="text-sm text-gray-500">
                Terlambat
              </p>

              <p className="
                mt-1
                text-2xl
                font-bold
                text-amber-600
              ">
                {terlambat.toLocaleString("id-ID")}
              </p>

            </div>

            <div className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-amber-50
              text-amber-600
            ">
              <Clock3 size={21} />
            </div>

          </div>

        </div>

      </div>


      {/* ==========================================
          FILTER
      ========================================== */}

      <div className="
        mb-6
        rounded-2xl
        border
        border-[#DDE9E4]
        bg-white
        p-5
        shadow-sm
      ">

        <div className="
          mb-4
          flex
          items-center
          gap-2
        ">

          <Search
            size={18}
            className="text-[#497F70]"
          />

          <div>

            <h2 className="
              text-sm
              font-semibold
              text-[#18352D]
            ">
              Filter Absensi
            </h2>

            <p className="
              mt-0.5
              text-xs
              text-gray-400
            ">
              Pilih karyawan dan periode untuk melihat riwayat
            </p>

          </div>

        </div>


        <div className="
          grid
          grid-cols-1
          gap-3
          md:grid-cols-4
        ">

          {/* KARYAWAN */}

          <select
            value={employeeId}
            onChange={(e) =>
              setEmployeeId(e.target.value)
            }
            disabled={loadingEmployee}
            className="
              w-full
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
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >

            <option value="">
              {loadingEmployee
                ? "Memuat karyawan..."
                : "Semua Karyawan"}
            </option>

            {employees.map((employee) => (
              <option
                key={employee.id}
                value={employee.id}
              >
                {employee.name}
              </option>
            ))}

          </select>


          {/* START */}

          <input
            type="date"
            value={start}
            onChange={(e) =>
              setStart(e.target.value)
            }
            className="
              w-full
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


          {/* END */}

          <input
            type="date"
            value={end}
            onChange={(e) =>
              setEnd(e.target.value)
            }
            className="
              w-full
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


          {/* CARI */}

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
              bg-[#497F70]
              px-5
              py-3
              text-sm
              font-semibold
              text-white
              shadow-sm
              transition
              hover:bg-[#3E6E61]
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >

            {loading ? (
              <>
                <RefreshCw
                  size={17}
                  className="animate-spin"
                />

                Memuat...
              </>
            ) : (
              <>
                <Search size={17} />

                Cari Absensi
              </>
            )}

          </button>

        </div>

      </div>


      {/* ==========================================
          TABLE
      ========================================== */}

      <div className="
        overflow-hidden
        rounded-2xl
        border
        border-[#DDE9E4]
        bg-white
        shadow-sm
      ">

        {/* HEADER */}

        <div className="
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
        ">

          <div>

            <h2 className="
              font-semibold
              text-[#18352D]
            ">
              Riwayat Kehadiran
            </h2>

            <p className="
              mt-0.5
              text-xs
              text-gray-400
            ">
              Detail check-in dan check-out karyawan
            </p>

          </div>

          <span className="
            w-fit
            rounded-full
            bg-[#EAF3EF]
            px-3
            py-1
            text-xs
            font-semibold
            text-[#497F70]
          ">
            {data.length.toLocaleString("id-ID")} data
          </span>

        </div>


        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="
            w-full
            min-w-[1050px]
            text-sm
          ">

            <thead className="bg-[#F5F8F6]">

              <tr className="
                border-b
                border-[#E5ECE9]
              ">

                <th className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                ">
                  Tanggal
                </th>

                <th className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                ">
                  Karyawan
                </th>

                <th className="
                  px-5
                  py-4
                  text-center
                  font-semibold
                  text-[#35564C]
                ">
                  Check In
                </th>

                <th className="
                  px-5
                  py-4
                  text-center
                  font-semibold
                  text-[#35564C]
                ">
                  Foto In
                </th>

                <th className="
                  px-5
                  py-4
                  text-center
                  font-semibold
                  text-[#35564C]
                ">
                  Check Out
                </th>

                <th className="
                  px-5
                  py-4
                  text-center
                  font-semibold
                  text-[#35564C]
                ">
                  Foto Out
                </th>

                <th className="
                  px-5
                  py-4
                  text-center
                  font-semibold
                  text-[#35564C]
                ">
                  Status
                </th>

              </tr>

            </thead>


            <tbody>

              {/* LOADING */}

              {loading && (

                <tr>

                  <td
                    colSpan={7}
                    className="px-5 py-14 text-center"
                  >

                    <div className="
                      flex
                      flex-col
                      items-center
                    ">

                      <RefreshCw
                        size={25}
                        className="
                          animate-spin
                          text-[#497F70]
                        "
                      />

                      <p className="
                        mt-3
                        text-sm
                        text-gray-500
                      ">
                        Memuat riwayat absensi...
                      </p>

                    </div>

                  </td>

                </tr>

              )}


              {/* EMPTY */}

              {!loading && data.length === 0 && (

                <tr>

                  <td
                    colSpan={7}
                    className="px-5 py-14 text-center"
                  >

                    <div className="
                      flex
                      flex-col
                      items-center
                    ">

                      <div className="
                        flex
                        h-14
                        w-14
                        items-center
                        justify-center
                        rounded-2xl
                        bg-[#EAF3EF]
                        text-[#497F70]
                      ">

                        <CalendarDays size={27} />

                      </div>

                      <p className="
                        mt-4
                        font-semibold
                        text-gray-700
                      ">
                        Belum ada riwayat absensi
                      </p>

                      <p className="
                        mt-1
                        text-sm
                        text-gray-400
                      ">
                        Data absensi akan muncul setelah karyawan melakukan absensi.
                      </p>

                    </div>

                  </td>

                </tr>

              )}


              {/* DATA */}

              {!loading &&
                data.map((attendance) => (

                  <tr
                    key={attendance.id}
                    className="
                      border-b
                      border-[#EDF2EF]
                      transition
                      hover:bg-[#FAFCFB]
                    "
                  >

                    {/* TANGGAL */}

                    <td className="
                      whitespace-nowrap
                      px-5
                      py-4
                      text-gray-600
                    ">

                      {formatDate(
                        attendance.date
                      )}

                    </td>


                    {/* KARYAWAN */}

                    <td className="px-5 py-4">

                      <div className="
                        flex
                        items-center
                        gap-3
                      ">

                        <div className="
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-full
                          bg-[#EAF3EF]
                          text-[#497F70]
                        ">

                          <UserCheck size={18} />

                        </div>

                        <div>

                          <p className="
                            font-semibold
                            text-[#35564C]
                          ">
                            {attendance.employee?.name ||
                              "-"}
                          </p>

                          <p className="
                            mt-0.5
                            text-xs
                            text-gray-400
                          ">
                            {attendance.employee?.department ||
                              "-"}
                          </p>

                        </div>

                      </div>

                    </td>


                    {/* CHECK IN */}

                    <td className="
                      px-5
                      py-4
                      text-center
                    ">

                      {attendance.checkIn ? (

                        <span className="
                          inline-flex
                          items-center
                          gap-1.5
                          rounded-full
                          bg-green-50
                          px-3
                          py-1
                          text-xs
                          font-semibold
                          text-green-700
                        ">

                          <Clock3 size={13} />

                          {formatTime(
                            attendance.checkIn
                          )}

                        </span>

                      ) : (
                        <span className="text-gray-300">
                          -
                        </span>
                      )}

                    </td>


                    {/* FOTO IN */}

                    <td className="
                      px-5
                      py-4
                      text-center
                    ">

                      {attendance.photoIn ? (

                        <img
                          src={attendance.photoIn}
                          alt="Foto Check In"
                          className="
                            mx-auto
                            h-14
                            w-14
                            rounded-xl
                            object-cover
                            ring-2
                            ring-[#EAF3EF]
                          "
                        />

                      ) : (

                        <div className="
                          mx-auto
                          flex
                          h-14
                          w-14
                          items-center
                          justify-center
                          rounded-xl
                          bg-gray-100
                          text-gray-400
                        ">

                          <Camera size={19} />

                        </div>

                      )}

                    </td>


                    {/* CHECK OUT */}

                    <td className="
                      px-5
                      py-4
                      text-center
                    ">

                      {attendance.checkOut ? (

                        <span className="
                          inline-flex
                          items-center
                          gap-1.5
                          rounded-full
                          bg-blue-50
                          px-3
                          py-1
                          text-xs
                          font-semibold
                          text-blue-700
                        ">

                          <Clock3 size={13} />

                          {formatTime(
                            attendance.checkOut
                          )}

                        </span>

                      ) : (
                        <span className="text-gray-300">
                          -
                        </span>
                      )}

                    </td>


                    {/* FOTO OUT */}

                    <td className="
                      px-5
                      py-4
                      text-center
                    ">

                      {attendance.photoOut ? (

                        <img
                          src={attendance.photoOut}
                          alt="Foto Check Out"
                          className="
                            mx-auto
                            h-14
                            w-14
                            rounded-xl
                            object-cover
                            ring-2
                            ring-[#EAF3EF]
                          "
                        />

                      ) : (

                        <div className="
                          mx-auto
                          flex
                          h-14
                          w-14
                          items-center
                          justify-center
                          rounded-xl
                          bg-gray-100
                          text-gray-400
                        ">

                          <Camera size={19} />

                        </div>

                      )}

                    </td>


                    {/* STATUS */}

                    <td className="
                      px-5
                      py-4
                      text-center
                    ">

                      {attendance.checkOut ? (

                        <span className="
                          inline-flex
                          items-center
                          gap-1.5
                          rounded-full
                          bg-green-100
                          px-3
                          py-1
                          text-xs
                          font-semibold
                          text-green-700
                        ">

                          <CheckCircle2 size={13} />

                          Selesai

                        </span>

                      ) : (

                        <span className="
                          inline-flex
                          items-center
                          gap-1.5
                          rounded-full
                          bg-red-100
                          px-3
                          py-1
                          text-xs
                          font-semibold
                          text-red-700
                        ">

                          <XCircle size={13} />

                          Belum Pulang

                        </span>

                      )}

                    </td>

                  </tr>

                ))}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}