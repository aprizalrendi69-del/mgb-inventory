"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  RefreshCw,
  Eye,
  Phone,
  BriefcaseBusiness,
} from "lucide-react";

export default function EmployeePage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadEmployee() {
    try {
      setLoading(true);

      const res = await fetch("/api/employee", {
        cache: "no-store",
      });

      const json = await res.json();

      console.log("EMPLOYEE:", json);

      if (json.success) {
        setData(json.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error("LOAD EMPLOYEE ERROR:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployee();
  }, []);

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
            <Users size={23} />
          </div>

          <div>

            <h1 className="
              text-2xl
              font-bold
              tracking-tight
              text-[#18352D]
              md:text-3xl
            ">
              Master Karyawan
            </h1>

            <p className="
              mt-1
              text-sm
              text-gray-500
            ">
              Data pegawai dan informasi karyawan perusahaan
            </p>

          </div>

        </div>


        <div className="flex items-center gap-2">

          {/* REFRESH */}

          <button
            type="button"
            onClick={loadEmployee}
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
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh

          </button>


          {/* TAMBAH */}

          <Link
            href="/employee/new"
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-[#497F70]
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-sm
              transition
              hover:bg-[#3E6E61]
            "
          >

            <UserPlus size={17} />

            Tambah Karyawan

          </Link>

        </div>

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
        lg:grid-cols-3
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

              <p className="
                text-sm
                text-gray-500
              ">
                Total Karyawan
              </p>

              <p className="
                mt-1
                text-2xl
                font-bold
                text-[#18352D]
              ">
                {data.length.toLocaleString("id-ID")}
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


        {/* AKTIF */}

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

              <p className="
                text-sm
                text-gray-500
              ">
                Karyawan Aktif
              </p>

              <p className="
                mt-1
                text-2xl
                font-bold
                text-green-600
              ">
                {data
                  .filter((item) => item.active)
                  .length
                  .toLocaleString("id-ID")}
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
              <Users size={21} />
            </div>

          </div>

        </div>


        {/* NONAKTIF */}

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

              <p className="
                text-sm
                text-gray-500
              ">
                Karyawan Nonaktif
              </p>

              <p className="
                mt-1
                text-2xl
                font-bold
                text-red-600
              ">
                {data
                  .filter((item) => !item.active)
                  .length
                  .toLocaleString("id-ID")}
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
              <Users size={21} />
            </div>

          </div>

        </div>

      </div>


      {/* ==========================================
          TABLE CARD
      ========================================== */}

      <div className="
        overflow-hidden
        rounded-2xl
        border
        border-[#DDE9E4]
        bg-white
        shadow-sm
      ">

        {/* TABLE HEADER */}

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
              Daftar Karyawan
            </h2>

            <p className="
              mt-0.5
              text-xs
              text-gray-400
            ">
              Data seluruh pegawai yang terdaftar
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
            {data.length.toLocaleString("id-ID")} karyawan
          </span>

        </div>


        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="
            w-full
            min-w-[1100px]
            text-sm
          ">

            <thead className="
              bg-[#F5F8F6]
            ">

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
                  Foto
                </th>

                <th className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                ">
                  NIK
                </th>

                <th className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                ">
                  Nama
                </th>

                <th className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                ">
                  Jabatan
                </th>

                <th className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                ">
                  Department
                </th>

                <th className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                ">
                  Telepon
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

                <th className="
                  px-5
                  py-4
                  text-center
                  font-semibold
                  text-[#35564C]
                ">
                  Aksi
                </th>

              </tr>

            </thead>


            <tbody>

              {/* LOADING */}

              {loading && (

                <tr>

                  <td
                    colSpan={8}
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
                        Memuat data karyawan...
                      </p>

                    </div>

                  </td>

                </tr>

              )}


              {/* EMPTY */}

              {!loading && data.length === 0 && (

                <tr>

                  <td
                    colSpan={8}
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

                        <Users size={27} />

                      </div>

                      <p className="
                        mt-4
                        font-semibold
                        text-gray-700
                      ">
                        Belum ada data karyawan
                      </p>

                      <p className="
                        mt-1
                        text-sm
                        text-gray-400
                      ">
                        Tambahkan karyawan untuk mulai mengelola data pegawai.
                      </p>

                    </div>

                  </td>

                </tr>

              )}


              {/* DATA */}

              {!loading &&
                data.map((employee) => (

                  <tr
                    key={employee.id}
                    className="
                      border-b
                      border-[#EDF2EF]
                      transition
                      hover:bg-[#FAFCFB]
                    "
                  >

                    {/* FOTO */}

                    <td className="px-5 py-4">

                      {employee.photo ? (

                        <img
                          src={employee.photo}
                          alt={employee.name}
                          className="
                            h-11
                            w-11
                            rounded-full
                            object-cover
                            ring-2
                            ring-[#EAF3EF]
                          "
                        />

                      ) : (

                        <div className="
                          flex
                          h-11
                          w-11
                          items-center
                          justify-center
                          rounded-full
                          bg-[#EAF3EF]
                          text-[#497F70]
                        ">

                          <Users size={19} />

                        </div>

                      )}

                    </td>


                    {/* NIK */}

                    <td className="
                      px-5
                      py-4
                      font-medium
                      text-gray-600
                    ">
                      {employee.nik || "-"}
                    </td>


                    {/* NAMA */}

                    <td className="px-5 py-4">

                      <Link
                        href={`/employee/${employee.id}`}
                        className="
                          font-semibold
                          text-[#35564C]
                          transition
                          hover:text-[#497F70]
                        "
                      >
                        {employee.name || "-"}
                      </Link>

                    </td>


                    {/* JABATAN */}

                    <td className="
                      px-5
                      py-4
                      text-gray-600
                    ">

                      <div className="
                        flex
                        items-center
                        gap-2
                      ">

                        <BriefcaseBusiness
                          size={15}
                          className="text-gray-400"
                        />

                        {employee.position || "-"}

                      </div>

                    </td>


                    {/* DEPARTMENT */}

                    <td className="
                      px-5
                      py-4
                      text-gray-600
                    ">
                      {employee.department || "-"}
                    </td>


                    {/* TELEPON */}

                    <td className="
                      px-5
                      py-4
                      text-gray-600
                    ">

                      {employee.phone ? (

                        <div className="
                          flex
                          items-center
                          gap-2
                        ">

                          <Phone
                            size={15}
                            className="text-gray-400"
                          />

                          {employee.phone}

                        </div>

                      ) : (
                        "-"
                      )}

                    </td>


                    {/* STATUS */}

                    <td className="
                      px-5
                      py-4
                      text-center
                    ">

                      <span
                        className={`
                          inline-flex
                          rounded-full
                          px-3
                          py-1
                          text-xs
                          font-semibold
                          ${
                            employee.active
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }
                        `}
                      >

                        {employee.active
                          ? "Aktif"
                          : "Nonaktif"}

                      </span>

                    </td>


                    {/* AKSI */}

                    <td className="
                      px-5
                      py-4
                      text-center
                    ">

                      <Link
                        href={`/employee/${employee.id}`}
                        className="
                          inline-flex
                          items-center
                          justify-center
                          gap-1.5
                          rounded-lg
                          bg-[#497F70]
                          px-3
                          py-2
                          text-xs
                          font-semibold
                          text-white
                          transition
                          hover:bg-[#3E6E61]
                        "
                      >

                        <Eye size={14} />

                        Detail

                      </Link>

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