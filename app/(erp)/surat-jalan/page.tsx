"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Truck,
  Search,
  RefreshCw,
  Eye,
  FileText,
} from "lucide-react";

export default function SuratJalanPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("SEMUA");

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch("/api/delivery", {
        cache: "no-store",
      });

      const json = await res.json();

      const result = Array.isArray(json)
        ? json
        : json.data || [];

      setData(result);
    } catch (err) {
      console.error("Load surat jalan error:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return data.filter((item: any) => {
      const cocokSearch =
        !keyword ||
        String(item.number ?? "")
          .toLowerCase()
          .includes(keyword) ||
        String(item.customer?.name ?? "")
          .toLowerCase()
          .includes(keyword) ||
        String(item.status ?? "")
          .toLowerCase()
          .includes(keyword);

      const cocokStatus =
        status === "SEMUA" ||
        String(item.status ?? "").toUpperCase() === status;

      return cocokSearch && cocokStatus;
    });
  }, [data, search, status]);

  const totalData = data.length;

  const totalPending = data.filter(
    (item: any) =>
      String(item.status ?? "").toUpperCase() === "PENDING"
  ).length;

  const totalDelivered = data.filter(
    (item: any) =>
      ["DELIVERED", "RECEIVED", "SELESAI"].includes(
        String(item.status ?? "").toUpperCase()
      )
  ).length;

  function formatDate(value: any) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function StatusBadge({ value }: { value: string }) {
    const current = String(value || "").toUpperCase();

    if (
      ["DELIVERED", "RECEIVED", "SELESAI"].includes(current)
    ) {
      return (
        <span
          className="
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
          "
        >
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          {value || "SELESAI"}
        </span>
      );
    }

    if (
      ["PENDING", "PROCESS", "PROCESSING", "DIKIRIM"].includes(
        current
      )
    ) {
      return (
        <span
          className="
            inline-flex
            items-center
            gap-1.5
            rounded-full
            bg-amber-50
            px-3
            py-1
            text-xs
            font-semibold
            text-amber-700
          "
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {value || "PENDING"}
        </span>
      );
    }

    return (
      <span
        className="
          inline-flex
          items-center
          gap-1.5
          rounded-full
          bg-slate-100
          px-3
          py-1
          text-xs
          font-semibold
          text-slate-600
        "
      >
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        {value || "UNKNOWN"}
      </span>
    );
  }

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* ================= HEADER ================= */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

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
            <Truck size={23} />
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
              Surat Jalan
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Kelola pengiriman dan surat jalan barang
            </p>
          </div>

        </div>

      </div>


      {/* ================= SUMMARY ================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* TOTAL */}

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
          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-gray-500">
                Total Surat Jalan
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {totalData}
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
              <FileText size={21} />
            </div>

          </div>
        </div>


        {/* PENDING */}

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
          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-gray-500">
                Dalam Proses
              </p>

              <p className="mt-1 text-2xl font-bold text-amber-600">
                {totalPending}
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
              <Truck size={21} />
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
          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-gray-500">
                Selesai
              </p>

              <p className="mt-1 text-2xl font-bold text-green-600">
                {totalDelivered}
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
                bg-green-50
                text-green-600
              "
            >
              <Truck size={21} />
            </div>

          </div>
        </div>

      </div>


      {/* ================= CONTENT ================= */}

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

        {/* ================= TOOLBAR ================= */}

        <div className="border-b border-[#E5ECE9] p-4 md:p-5">

          <div
            className="
              flex
              flex-col
              gap-3
              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >

            {/* SEARCH */}

            <div className="relative w-full lg:max-w-md">

              <Search
                size={18}
                className="
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                "
              />

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nomor surat jalan atau customer..."
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  py-2.5
                  pl-10
                  pr-4
                  text-sm
                  outline-none
                  transition
                  focus:border-[#497F70]
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />

            </div>


            {/* FILTER + REFRESH */}

            <div className="flex gap-2">

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  px-4
                  py-2.5
                  text-sm
                  outline-none
                  focus:border-[#497F70]
                "
              >

                <option value="SEMUA">
                  Semua Status
                </option>

                <option value="PENDING">
                  Pending
                </option>

                <option value="DELIVERED">
                  Delivered
                </option>

                <option value="RECEIVED">
                  Received
                </option>

                <option value="SELESAI">
                  Selesai
                </option>

              </select>


              <button
                type="button"
                onClick={loadData}
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
                  transition
                  hover:bg-[#F5F8F6]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >

                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />

                Refresh

              </button>

            </div>

          </div>


          {/* RESULT INFO */}

          <div className="mt-4 text-sm text-gray-500">

            Menampilkan{" "}

            <span className="font-semibold text-[#18352D]">
              {filteredData.length}
            </span>

            {" "}dari{" "}

            <span className="font-semibold text-[#18352D]">
              {data.length}
            </span>

            {" "}surat jalan

          </div>

        </div>


        {/* ================= TABLE ================= */}

        <div className="overflow-x-auto">

          <table className="min-w-[900px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  No. Surat Jalan
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Tanggal
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Customer
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

              {/* LOADING */}

              {loading ? (

                <tr>

                  <td
                    colSpan={6}
                    className="px-5 py-14 text-center"
                  >

                    <div className="flex flex-col items-center gap-3 text-gray-500">

                      <RefreshCw
                        size={24}
                        className="animate-spin text-[#497F70]"
                      />

                      <span>
                        Loading data surat jalan...
                      </span>

                    </div>

                  </td>

                </tr>

              ) : filteredData.length === 0 ? (

                /* EMPTY */

                <tr>

                  <td
                    colSpan={6}
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
                        <Truck size={25} />
                      </div>

                      <p className="font-semibold text-gray-700">
                        Belum ada surat jalan
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        Data surat jalan akan muncul di sini.
                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                filteredData.map(
                  (item: any, index: number) => (

                    <tr
                      key={item.id}
                      className="
                        border-b
                        border-[#EDF2EF]
                        transition
                        hover:bg-[#FAFCFB]
                      "
                    >

                      {/* NO */}

                      <td className="px-5 py-4 text-gray-500">
                        {index + 1}
                      </td>


                      {/* NOMOR */}

                      <td className="px-5 py-4">

                        <div className="font-semibold text-[#18352D]">
                          {item.number || "-"}
                        </div>

                      </td>


                      {/* TANGGAL */}

                      <td className="px-5 py-4 whitespace-nowrap text-gray-600">

                        {formatDate(item.deliveryDate)}

                      </td>


                      {/* CUSTOMER */}

                      <td className="px-5 py-4">

                        <div className="font-medium text-gray-700">
                          {item.customer?.name || "-"}
                        </div>

                      </td>


                      {/* STATUS */}

                      <td className="px-5 py-4 text-center">

                        <StatusBadge
                          value={item.status}
                        />

                      </td>


                      {/* AKSI */}

                      <td className="px-5 py-4">

                        <div className="flex justify-center">

                          <Link
                            href={`/surat-jalan/${item.id}`}
                            className="
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-lg
                              bg-[#EAF3EF]
                              px-3
                              py-2
                              text-xs
                              font-semibold
                              text-[#497F70]
                              transition
                              hover:bg-[#DDEDE6]
                            "
                          >

                            <Eye size={14} />

                            Detail

                          </Link>

                        </div>

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