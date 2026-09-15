"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  Search,
  RefreshCw,
  FileText,
  Download,
  Printer,
  CalendarDays,
  ClipboardCheck,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Eye,
} from "lucide-react";

import { exportReportPdf } from "@/lib/exportReportPdf";
import { exportReportExcel } from "@/lib/exportReportExcel";
import { printTable } from "@/lib/print";

type StockOpname = {
  id: number;
  code: string;
  date: string;
  status: string;
  totalItem: number;
  totalDifference: number;
};

export default function LaporanStockOpnamePage() {
  const [data, setData] = useState<StockOpname[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // =========================
  // LOAD DATA
  // =========================

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch(
        "/api/laporan/stock-opname",
        {
          cache: "no-store",
        }
      );

      const result = await res.json();

      if (result.success) {
        setData(result.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error(
        "Gagal mengambil laporan stock opname:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // =========================
  // FILTER
  // =========================

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const keyword = search
        .toLowerCase()
        .trim();

      const matchesSearch =
        !keyword ||
        String(item.code ?? "")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        statusFilter === "ALL" ||
        String(item.status ?? "")
          .toUpperCase() === statusFilter;

      const itemDate = item.date
        ? new Date(item.date)
            .toISOString()
            .split("T")[0]
        : "";

      const matchesStart =
        !startDate ||
        itemDate >= startDate;

      const matchesEnd =
        !endDate ||
        itemDate <= endDate;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesStart &&
        matchesEnd
      );
    });
  }, [
    data,
    search,
    statusFilter,
    startDate,
    endDate,
  ]);

  // =========================
  // SUMMARY
  // =========================

  const totalOpname = filteredData.length;

  const totalItem = useMemo(() => {
    return filteredData.reduce(
      (sum, item) =>
        sum + Number(item.totalItem || 0),
      0
    );
  }, [filteredData]);

  const totalDifference = useMemo(() => {
    return filteredData.reduce(
      (sum, item) =>
        sum + Number(
          item.totalDifference || 0
        ),
      0
    );
  }, [filteredData]);

  const totalApproved = useMemo(() => {
    return filteredData.filter(
      (item) =>
        String(item.status)
          .toUpperCase() === "APPROVED"
    ).length;
  }, [filteredData]);

  const totalPending = useMemo(() => {
    return filteredData.filter(
      (item) =>
        String(item.status)
          .toUpperCase() !== "APPROVED"
    ).length;
  }, [filteredData]);

  // =========================
  // FORMAT
  // =========================

  function formatDate(value: string) {
    if (!value) return "-";

    return new Date(
      value
    ).toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  function formatNumber(value: number) {
    return Number(
      value || 0
    ).toLocaleString("id-ID");
  }

  function getStatusLabel(status: string) {
    const value =
      String(status).toUpperCase();

    if (value === "APPROVED") {
      return "Approved";
    }

    if (value === "DRAFT") {
      return "Draft";
    }

    if (value === "PENDING") {
      return "Pending";
    }

    return status || "-";
  }

  function getStatusClass(status: string) {
    const value =
      String(status).toUpperCase();

    if (value === "APPROVED") {
      return "bg-green-50 text-green-700 border-green-200";
    }

    if (value === "DRAFT") {
      return "bg-gray-50 text-gray-700 border-gray-200";
    }

    if (value === "PENDING") {
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    }

    return "bg-gray-50 text-gray-700 border-gray-200";
  }

  function getStatusIcon(status: string) {
    const value =
      String(status).toUpperCase();

    if (value === "APPROVED") {
      return <CheckCircle2 size={14} />;
    }

    if (
      value === "PENDING"
    ) {
      return <Clock3 size={14} />;
    }

    return <Clock3 size={14} />;
  }

  // =========================
  // EXPORT
  // =========================

  const columns = [
    "No",
    "Kode Opname",
    "Tanggal",
    "Status",
    "Jumlah Item",
    "Total Selisih",
  ];

  const rows = filteredData.map(
    (item, index) => [
      index + 1,
      item.code,
      formatDate(item.date),
      getStatusLabel(item.status),
      item.totalItem ?? 0,
      item.totalDifference ?? 0,
    ]
  );

  function handleExportPdf() {
    exportReportPdf(
      "Laporan Stock Opname",
      columns,
      rows
    );
  }

  function handleExportExcel() {
    exportReportExcel(
      "Laporan Stock Opname",
      columns,
      rows
    );
  }

  function handlePrint() {
    printTable(
      columns,
      rows
    );
  }

  // =========================
  // RESET FILTER
  // =========================

  function resetFilter() {
    setSearch("");
    setStatusFilter("ALL");
    setStartDate("");
    setEndDate("");
  }

  // =========================
  // RENDER
  // =========================

  return (
    <div className="min-h-screen bg-[#F6F8F7] p-4 md:p-6 lg:p-8">

      {/* =========================
          HEADER
      ========================= */}

      <div className="mb-6">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <div className="flex items-center gap-3">

              <div className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-[#497F70]
                text-white
                shadow-sm
              ">
                <ClipboardCheck size={22} />
              </div>

              <div>

                <h1 className="
                  text-2xl
                  font-bold
                  text-[#1F2937]
                ">
                  Laporan Stock Opname
                </h1>

                <p className="
                  mt-1
                  text-sm
                  text-gray-500
                ">
                  Riwayat pemeriksaan dan penyesuaian stok fisik gudang
                </p>

              </div>

            </div>

          </div>

          {/* ACTION */}

          <div className="flex flex-wrap gap-2">

            <button
              onClick={loadData}
              disabled={loading}
              className="
                inline-flex
                items-center
                gap-2
                rounded-xl
                border
                border-gray-200
                bg-white
                px-4
                py-2.5
                text-sm
                font-medium
                text-gray-700
                shadow-sm
                transition
                hover:bg-gray-50
                disabled:opacity-50
              "
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

            <button
              onClick={handleExportPdf}
              disabled={
                filteredData.length === 0
              }
              className="
                inline-flex
                items-center
                gap-2
                rounded-xl
                bg-red-600
                px-4
                py-2.5
                text-sm
                font-medium
                text-white
                shadow-sm
                transition
                hover:bg-red-700
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >

              <Download size={16} />

              PDF

            </button>

            <button
              onClick={handleExportExcel}
              disabled={
                filteredData.length === 0
              }
              className="
                inline-flex
                items-center
                gap-2
                rounded-xl
                bg-green-600
                px-4
                py-2.5
                text-sm
                font-medium
                text-white
                shadow-sm
                transition
                hover:bg-green-700
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >

              <Download size={16} />

              Excel

            </button>

            <button
              onClick={handlePrint}
              disabled={
                filteredData.length === 0
              }
              className="
                inline-flex
                items-center
                gap-2
                rounded-xl
                bg-[#497F70]
                px-4
                py-2.5
                text-sm
                font-medium
                text-white
                shadow-sm
                transition
                hover:bg-[#3d6c5f]
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >

              <Printer size={16} />

              Print

            </button>

          </div>

        </div>

      </div>


      {/* =========================
          STATISTIC CARDS
      ========================= */}

      <div className="
        mb-6
        grid
        grid-cols-1
        gap-4
        sm:grid-cols-2
        xl:grid-cols-4
      ">

        {/* TOTAL OPNAME */}

        <div className="
          rounded-2xl
          border
          border-gray-100
          bg-white
          p-5
          shadow-sm
        ">

          <div className="
            flex
            items-start
            justify-between
          ">

            <div>

              <p className="
                text-sm
                font-medium
                text-gray-500
              ">
                Total Stock Opname
              </p>

              <p className="
                mt-2
                text-2xl
                font-bold
                text-gray-900
              ">
                {formatNumber(totalOpname)}
              </p>

            </div>

            <div className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              bg-blue-50
              text-blue-600
            ">
              <ClipboardCheck size={20} />
            </div>

          </div>

          <p className="
            mt-3
            text-xs
            text-gray-500
          ">
            Jumlah pemeriksaan stok
          </p>

        </div>


        {/* TOTAL ITEM */}

        <div className="
          rounded-2xl
          border
          border-gray-100
          bg-white
          p-5
          shadow-sm
        ">

          <div className="
            flex
            items-start
            justify-between
          ">

            <div>

              <p className="
                text-sm
                font-medium
                text-gray-500
              ">
                Total Item
              </p>

              <p className="
                mt-2
                text-2xl
                font-bold
                text-gray-900
              ">
                {formatNumber(totalItem)}
              </p>

            </div>

            <div className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              bg-gray-100
              text-gray-600
            ">
              <FileText size={20} />
            </div>

          </div>

          <p className="
            mt-3
            text-xs
            text-gray-500
          ">
            Total item yang diperiksa
          </p>

        </div>


        {/* APPROVED */}

        <div className="
          rounded-2xl
          border
          border-gray-100
          bg-white
          p-5
          shadow-sm
        ">

          <div className="
            flex
            items-start
            justify-between
          ">

            <div>

              <p className="
                text-sm
                font-medium
                text-gray-500
              ">
                Approved
              </p>

              <p className="
                mt-2
                text-2xl
                font-bold
                text-gray-900
              ">
                {formatNumber(totalApproved)}
              </p>

            </div>

            <div className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              bg-green-50
              text-green-600
            ">
              <CheckCircle2 size={20} />
            </div>

          </div>

          <p className="
            mt-3
            text-xs
            text-gray-500
          ">
            Stock opname sudah disetujui
          </p>

        </div>


        {/* SELISIH */}

        <div className="
          rounded-2xl
          border
          border-gray-100
          bg-white
          p-5
          shadow-sm
        ">

          <div className="
            flex
            items-start
            justify-between
          ">

            <div>

              <p className="
                text-sm
                font-medium
                text-gray-500
              ">
                Total Selisih
              </p>

              <p className={`
                mt-2
                text-2xl
                font-bold
                ${
                  totalDifference !== 0
                    ? "text-red-600"
                    : "text-gray-900"
                }
              `}>
                {formatNumber(totalDifference)}
              </p>

            </div>

            <div className={`
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              ${
                totalDifference !== 0
                  ? "bg-red-50 text-red-600"
                  : "bg-green-50 text-green-600"
              }
            `}>
              <AlertTriangle size={20} />
            </div>

          </div>

          <p className="
            mt-3
            text-xs
            text-gray-500
          ">
            Akumulasi selisih stok
          </p>

        </div>

      </div>


      {/* =========================
          FILTER
      ========================= */}

      <div className="
        mb-6
        rounded-2xl
        border
        border-gray-100
        bg-white
        p-5
        shadow-sm
      ">

        <div className="
          mb-4
          flex
          items-center
          justify-between
        ">

          <div>

            <h2 className="
              font-semibold
              text-gray-900
            ">
              Filter Laporan
            </h2>

            <p className="
              mt-1
              text-xs
              text-gray-500
            ">
              Gunakan filter untuk mencari data stock opname
            </p>

          </div>

          <button
            onClick={resetFilter}
            className="
              text-sm
              font-medium
              text-[#497F70]
              hover:underline
            "
          >
            Reset Filter
          </button>

        </div>


        <div className="
          grid
          grid-cols-1
          gap-4
          md:grid-cols-2
          xl:grid-cols-4
        ">

          {/* SEARCH */}

          <div>

            <label className="
              mb-2
              block
              text-sm
              font-medium
              text-gray-700
            ">
              Pencarian
            </label>

            <div className="relative">

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
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Cari kode opname..."
                className="
                  w-full
                  rounded-xl
                  border
                  border-gray-200
                  bg-gray-50
                  py-2.5
                  pl-10
                  pr-3
                  text-sm
                  outline-none
                  transition
                  focus:border-[#497F70]
                  focus:bg-white
                "
              />

            </div>

          </div>


          {/* STATUS */}

          <div>

            <label className="
              mb-2
              block
              text-sm
              font-medium
              text-gray-700
            ">
              Status
            </label>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
              className="
                w-full
                rounded-xl
                border
                border-gray-200
                bg-gray-50
                px-3
                py-2.5
                text-sm
                outline-none
                focus:border-[#497F70]
                focus:bg-white
              "
            >

              <option value="ALL">
                Semua Status
              </option>

              <option value="APPROVED">
                Approved
              </option>

              <option value="DRAFT">
                Draft
              </option>

              <option value="PENDING">
                Pending
              </option>

            </select>

          </div>


          {/* START DATE */}

          <div>

            <label className="
              mb-2
              block
              text-sm
              font-medium
              text-gray-700
            ">
              Dari Tanggal
            </label>

            <div className="relative">

              <CalendarDays
                size={17}
                className="
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                "
              />

              <input
                type="date"
                value={startDate}
                onChange={(e) =>
                  setStartDate(e.target.value)
                }
                className="
                  w-full
                  rounded-xl
                  border
                  border-gray-200
                  bg-gray-50
                  py-2.5
                  pl-10
                  pr-3
                  text-sm
                  outline-none
                  focus:border-[#497F70]
                  focus:bg-white
                "
              />

            </div>

          </div>


          {/* END DATE */}

          <div>

            <label className="
              mb-2
              block
              text-sm
              font-medium
              text-gray-700
            ">
              Sampai Tanggal
            </label>

            <div className="relative">

              <CalendarDays
                size={17}
                className="
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                "
              />

              <input
                type="date"
                value={endDate}
                onChange={(e) =>
                  setEndDate(e.target.value)
                }
                className="
                  w-full
                  rounded-xl
                  border
                  border-gray-200
                  bg-gray-50
                  py-2.5
                  pl-10
                  pr-3
                  text-sm
                  outline-none
                  focus:border-[#497F70]
                  focus:bg-white
                "
              />

            </div>

          </div>

        </div>


        <div className="
          mt-4
          flex
          items-center
          justify-between
          border-t
          border-gray-100
          pt-4
        ">

          <p className="
            text-sm
            text-gray-500
          ">
            Menampilkan{" "}
            <span className="
              font-semibold
              text-gray-800
            ">
              {filteredData.length}
            </span>{" "}
            dari{" "}
            <span className="
              font-semibold
              text-gray-800
            ">
              {data.length}
            </span>{" "}
            data
          </p>

        </div>

      </div>


      {/* =========================
          TABLE
      ========================= */}

      <div className="
        overflow-hidden
        rounded-2xl
        border
        border-gray-100
        bg-white
        shadow-sm
      ">

        <div className="overflow-x-auto">

          <table className="
            min-w-full
            text-sm
          ">

            <thead>

              <tr className="
                border-b
                border-gray-100
                bg-gray-50
              ">

                <th className="
                  whitespace-nowrap
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-gray-600
                ">
                  No
                </th>

                <th className="
                  whitespace-nowrap
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-gray-600
                ">
                  Kode Opname
                </th>

                <th className="
                  whitespace-nowrap
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-gray-600
                ">
                  Tanggal
                </th>

                <th className="
                  whitespace-nowrap
                  px-5
                  py-4
                  text-center
                  font-semibold
                  text-gray-600
                ">
                  Status
                </th>

                <th className="
                  whitespace-nowrap
                  px-5
                  py-4
                  text-right
                  font-semibold
                  text-gray-600
                ">
                  Jumlah Item
                </th>

                <th className="
                  whitespace-nowrap
                  px-5
                  py-4
                  text-right
                  font-semibold
                  text-gray-600
                ">
                  Total Selisih
                </th>

                <th className="
                  whitespace-nowrap
                  px-5
                  py-4
                  text-center
                  font-semibold
                  text-gray-600
                ">
                  Aksi
                </th>

              </tr>

            </thead>


            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan={7}
                    className="
                      px-5
                      py-12
                      text-center
                    "
                  >

                    <div className="
                      flex
                      flex-col
                      items-center
                      justify-center
                    ">

                      <RefreshCw
                        size={28}
                        className="
                          mb-3
                          animate-spin
                          text-[#497F70]
                        "
                      />

                      <p className="
                        text-sm
                        text-gray-500
                      ">
                        Memuat laporan stock opname...
                      </p>

                    </div>

                  </td>

                </tr>

              ) : filteredData.length === 0 ? (

                <tr>

                  <td
                    colSpan={7}
                    className="
                      px-5
                      py-12
                      text-center
                    "
                  >

                    <div className="
                      flex
                      flex-col
                      items-center
                    ">

                      <div className="
                        mb-3
                        flex
                        h-12
                        w-12
                        items-center
                        justify-center
                        rounded-full
                        bg-gray-100
                        text-gray-400
                      ">
                        <ClipboardCheck size={22} />
                      </div>

                      <p className="
                        font-medium
                        text-gray-700
                      ">
                        Tidak ada data stock opname
                      </p>

                      <p className="
                        mt-1
                        text-xs
                        text-gray-400
                      ">
                        Coba ubah kata pencarian atau filter
                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                filteredData.map(
                  (item, index) => (

                    <tr
                      key={item.id}
                      className="
                        border-b
                        border-gray-100
                        transition
                        hover:bg-gray-50
                      "
                    >

                      {/* NO */}

                      <td className="
                        whitespace-nowrap
                        px-5
                        py-4
                        text-gray-500
                      ">
                        {index + 1}
                      </td>


                      {/* CODE */}

                      <td className="
                        whitespace-nowrap
                        px-5
                        py-4
                      ">

                        <div className="
                          flex
                          items-center
                          gap-3
                        ">

                          <div className="
                            flex
                            h-9
                            w-9
                            items-center
                            justify-center
                            rounded-lg
                            bg-[#EDF5F2]
                            text-[#497F70]
                          ">
                            <ClipboardCheck size={17} />
                          </div>

                          <div>

                            <p className="
                              font-semibold
                              text-gray-900
                            ">
                              {item.code}
                            </p>

                            <p className="
                              text-xs
                              text-gray-400
                            ">
                              Stock Opname
                            </p>

                          </div>

                        </div>

                      </td>


                      {/* DATE */}

                      <td className="
                        whitespace-nowrap
                        px-5
                        py-4
                        text-gray-600
                      ">
                        {formatDate(item.date)}
                      </td>


                      {/* STATUS */}

                      <td className="
                        whitespace-nowrap
                        px-5
                        py-4
                        text-center
                      ">

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
                            ${getStatusClass(
                              item.status
                            )}
                          `}
                        >

                          {getStatusIcon(
                            item.status
                          )}

                          {getStatusLabel(
                            item.status
                          )}

                        </span>

                      </td>


                      {/* TOTAL ITEM */}

                      <td className="
                        whitespace-nowrap
                        px-5
                        py-4
                        text-right
                      ">

                        <span className="
                          font-semibold
                          text-gray-900
                        ">
                          {formatNumber(
                            item.totalItem
                          )}
                        </span>

                      </td>


                      {/* DIFFERENCE */}

                      <td className="
                        whitespace-nowrap
                        px-5
                        py-4
                        text-right
                      ">

                        <span
                          className={`
                            font-semibold
                            ${
                              Number(
                                item.totalDifference
                              ) !== 0
                                ? "text-red-600"
                                : "text-green-600"
                            }
                          `}
                        >
                          {formatNumber(
                            item.totalDifference
                          )}
                        </span>

                      </td>


                      {/* ACTION */}

                      <td className="
                        whitespace-nowrap
                        px-5
                        py-4
                        text-center
                      ">

                        <Link
                          href={`/stock-opname/${item.id}`}
                          className="
                            inline-flex
                            items-center
                            gap-1.5
                            rounded-xl
                            bg-[#497F70]
                            px-3
                            py-2
                            text-xs
                            font-semibold
                            text-white
                            transition
                            hover:bg-[#3d6c5f]
                          "
                        >

                          <Eye size={14} />

                          Detail

                        </Link>

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>


            {/* FOOTER */}

            {!loading &&
              filteredData.length > 0 && (

                <tfoot>

                  <tr className="
                    bg-gray-50
                  ">

                    <td
                      colSpan={4}
                      className="
                        px-5
                        py-4
                        text-right
                        font-semibold
                        text-gray-700
                      "
                    >
                      Total
                    </td>

                    <td className="
                      px-5
                      py-4
                      text-right
                      text-base
                      font-bold
                      text-[#497F70]
                    ">
                      {formatNumber(
                        totalItem
                      )}
                    </td>

                    <td className={`
                      px-5
                      py-4
                      text-right
                      text-base
                      font-bold
                      ${
                        totalDifference !== 0
                          ? "text-red-600"
                          : "text-green-600"
                      }
                    `}>
                      {formatNumber(
                        totalDifference
                      )}
                    </td>

                    <td />

                  </tr>

                </tfoot>

              )}

          </table>

        </div>

      </div>

    </div>
  );
}