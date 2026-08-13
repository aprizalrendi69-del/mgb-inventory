"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  Users,
  Search,
  FileDown,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Wallet,
  ShoppingCart,
  Package,
  X,
} from "lucide-react";

import { exportReportPdf } from "@/lib/exportReportPdf";
import { exportReportExcel } from "@/lib/exportReportExcel";
import { printTable } from "@/lib/print";

type CustomerReport = {
  id: number;
  name?: string;
  pic?: string;
  transaksi?: number;
  qty?: number;
  nominal?: number;
};

export default function LaporanCustomer() {
  const [data, setData] = useState<CustomerReport[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  // =========================================================
  // LOAD DATA
  // =========================================================

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      let url = "/api/laporan/customer";

      const params = new URLSearchParams();

      if (start) {
        params.append("start", start);
      }

      if (end) {
        params.append("end", end);
      }

      const query = params.toString();

      if (query) {
        url += `?${query}`;
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
      console.error(
        "Gagal mengambil laporan customer:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // FILTER
  // =========================================================

  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return data;
    }

    return data.filter((item) => {
      return (
        item.name
          ?.toLowerCase()
          .includes(keyword) ||
        item.pic
          ?.toLowerCase()
          .includes(keyword)
      );
    });
  }, [data, search]);

  // =========================================================
  // SUMMARY
  // =========================================================

  const totalCustomer = filteredData.length;

  const totalTransaksi = useMemo(() => {
    return filteredData.reduce(
      (sum, item) =>
        sum + Number(item.transaksi ?? 0),
      0
    );
  }, [filteredData]);

  const totalQty = useMemo(() => {
    return filteredData.reduce(
      (sum, item) =>
        sum + Number(item.qty ?? 0),
      0
    );
  }, [filteredData]);

  const totalNominal = useMemo(() => {
    return filteredData.reduce(
      (sum, item) =>
        sum + Number(item.nominal ?? 0),
      0
    );
  }, [filteredData]);

  // =========================================================
  // FORMAT
  // =========================================================

  function formatNumber(value: number) {
    return Number(value ?? 0).toLocaleString(
      "id-ID"
    );
  }

  function formatRupiah(value: number) {
    return (
      "Rp " +
      Number(value ?? 0).toLocaleString("id-ID")
    );
  }

  // =========================================================
  // EXPORT DATA
  // =========================================================

  const columns = [
    "No",
    "Customer",
    "PIC",
    "Total Transaksi",
    "Total Qty",
    "Total Nominal",
  ];

  const rows = filteredData.map(
    (item, index) => [
      index + 1,
      item.name ?? "-",
      item.pic ?? "-",
      Number(item.transaksi ?? 0),
      Number(item.qty ?? 0),
      formatRupiah(
        Number(item.nominal ?? 0)
      ),
    ]
  );

  // =========================================================
  // RESET
  // =========================================================

  function resetFilter() {
    setSearch("");
    setStart("");
    setEnd("");

    setTimeout(() => {
      loadData();
    }, 0);
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
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
            Memuat laporan customer...
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
            <Users size={23} />
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
              Laporan Customer
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Ringkasan transaksi, jumlah barang,
              dan nilai transaksi customer
            </p>

          </div>

        </div>

        <button
          type="button"
          onClick={loadData}
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
          "
        >
          <RefreshCw size={17} />

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

        {/* TOTAL CUSTOMER */}

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
                Total Customer
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalCustomer
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Customer dalam laporan
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

        {/* TRANSAKSI */}

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
                Total Transaksi
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalTransaksi
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Total delivery customer
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
              <ShoppingCart size={20} />
            </div>

          </div>

        </div>

        {/* QTY */}

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
                Total Qty
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(totalQty)}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Jumlah barang keluar
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
              <Package size={20} />
            </div>

          </div>

        </div>

        {/* NOMINAL */}

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

            <div className="min-w-0">

              <p className="text-sm text-gray-500">
                Total Nominal
              </p>

              <p
                className="
                  mt-2
                  truncate
                  text-xl
                  font-bold
                  text-[#497F70]
                  md:text-2xl
                "
              >
                {formatRupiah(
                  totalNominal
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Nilai transaksi customer
              </p>

            </div>

            <div
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-[#EAF3EF]
                text-[#497F70]
              "
            >
              <Wallet size={20} />
            </div>

          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* FILTER & TOOLBAR */}
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

        <div className="mb-5">

          <h2 className="font-semibold text-[#18352D]">
            Filter Laporan
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Cari customer atau batasi laporan
            berdasarkan periode delivery
          </p>

        </div>

        {/* FILTER INPUT */}

        <div
          className="
            grid
            grid-cols-1
            gap-4
            md:grid-cols-2
            xl:grid-cols-4
          "
        >

          {/* SEARCH */}

          <div className="xl:col-span-2">

            <label className="mb-2 block text-sm font-medium text-[#35564C]">
              Pencarian
            </label>

            <div className="relative">

              <Search
                size={18}
                className="
                  absolute
                  left-3.5
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                "
              />

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Cari nama customer atau PIC..."
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  py-3
                  pl-10
                  pr-10
                  text-sm
                  text-gray-700
                  outline-none
                  transition
                  placeholder:text-gray-400
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  className="
                    absolute
                    right-3
                    top-1/2
                    -translate-y-1/2
                    rounded-lg
                    p-1
                    text-gray-400
                    transition
                    hover:bg-[#EAF3EF]
                    hover:text-[#497F70]
                  "
                >
                  <X size={16} />
                </button>
              )}

            </div>

          </div>

          {/* START */}

          <div>

            <label className="mb-2 block text-sm font-medium text-[#35564C]">
              Dari Tanggal
            </label>

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

          </div>

          {/* END */}

          <div>

            <label className="mb-2 block text-sm font-medium text-[#35564C]">
              Sampai Tanggal
            </label>

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

          </div>

        </div>

        {/* FILTER ACTION */}

        <div
          className="
            mt-5
            flex
            flex-wrap
            gap-2
          "
        >

          <button
            type="button"
            onClick={loadData}
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-[#497F70]
              px-5
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-sm
              transition
              hover:bg-[#3D6D60]
            "
          >
            <Search size={17} />

            Terapkan Filter
          </button>

          <button
            type="button"
            onClick={resetFilter}
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-[#D5E5DC]
              bg-white
              px-5
              py-2.5
              text-sm
              font-semibold
              text-[#35564C]
              transition
              hover:bg-[#F5F8F6]
            "
          >
            <RefreshCw size={17} />

            Reset
          </button>

        </div>

        {/* TOOLBAR INFO */}

        <div
          className="
            mt-5
            flex
            flex-col
            gap-3
            border-t
            border-[#EDF2EF]
            pt-5
            lg:flex-row
            lg:items-center
            lg:justify-between
          "
        >

          <p className="text-sm text-gray-500">

            Menampilkan{" "}

            <span className="font-semibold text-[#35564C]">
              {formatNumber(
                filteredData.length
              )}
            </span>

            {" "}dari{" "}

            <span className="font-semibold text-[#35564C]">
              {formatNumber(data.length)}
            </span>

            {" "}customer

          </p>

          <div className="flex flex-wrap gap-2">

            <button
              type="button"
              disabled={filteredData.length === 0}
              onClick={() =>
                exportReportPdf(
                  "Laporan Customer",
                  columns,
                  rows
                )
              }
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
              disabled={filteredData.length === 0}
              onClick={() =>
                exportReportExcel(
                  "Laporan Customer",
                  columns,
                  rows
                )
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
              disabled={filteredData.length === 0}
              onClick={() =>
                printTable(
                  columns,
                  rows
                )
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
              Data Customer
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Klik nama customer untuk melihat
              detail transaksi
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
              filteredData.length
            )}{" "}
            Customer
          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="min-w-[900px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="w-16 px-5 py-4 text-center font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Customer
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  PIC
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Transaksi
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Qty
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Total Nominal
                </th>

              </tr>

            </thead>

            <tbody>

              {filteredData.length === 0 ? (

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
                        <Users size={25} />
                      </div>

                      <p className="font-semibold text-gray-700">
                        Tidak ada data customer
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        Coba ubah filter atau
                        kata pencarian
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
                        border-[#EDF2EF]
                        transition
                        hover:bg-[#FAFCFB]
                      "
                    >

                      {/* NO */}

                      <td className="px-5 py-4 text-center text-gray-500">
                        {index + 1}
                      </td>

                      {/* CUSTOMER */}

                      <td className="px-5 py-4">

                        <Link
                          href={`/laporan/customer/${item.id}`}
                          className="
                            font-semibold
                            text-[#497F70]
                            transition
                            hover:text-[#3D6D60]
                            hover:underline
                          "
                        >
                          {item.name ?? "-"}
                        </Link>

                      </td>

                      {/* PIC */}

                      <td className="px-5 py-4 text-gray-600">
                        {item.pic ?? "-"}
                      </td>

                      {/* TRANSAKSI */}

                      <td className="px-5 py-4 text-right font-semibold text-[#18352D]">
                        {formatNumber(
                          Number(
                            item.transaksi ?? 0
                          )
                        )}
                      </td>

                      {/* QTY */}

                      <td className="px-5 py-4 text-right text-gray-700">
                        {formatNumber(
                          Number(
                            item.qty ?? 0
                          )
                        )}
                      </td>

                      {/* NOMINAL */}

                      <td className="px-5 py-4 text-right">

                        <span className="font-semibold text-[#497F70]">
                          {formatRupiah(
                            Number(
                              item.nominal ?? 0
                            )
                          )}
                        </span>

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

            {/* TOTAL */}

            {!loading &&
              filteredData.length > 0 && (

                <tfoot className="bg-[#F5F8F6]">

                  <tr className="border-t-2 border-[#DDE9E4]">

                    <td
                      colSpan={3}
                      className="
                        px-5
                        py-4
                        text-right
                        font-bold
                        text-[#35564C]
                      "
                    >
                      TOTAL
                    </td>

                    <td className="px-5 py-4 text-right font-bold text-[#18352D]">
                      {formatNumber(
                        totalTransaksi
                      )}
                    </td>

                    <td className="px-5 py-4 text-right font-bold text-[#18352D]">
                      {formatNumber(
                        totalQty
                      )}
                    </td>

                    <td className="px-5 py-4 text-right font-bold text-[#497F70]">
                      {formatRupiah(
                        totalNominal
                      )}
                    </td>

                  </tr>

                </tfoot>

              )}

          </table>

        </div>

        {/* FOOTER */}

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
                  filteredData.length
                )}
              </span>{" "}
              customer

            </div>

            <div className="font-semibold text-[#35564C]">

              Total Nominal:{" "}

              <span className="text-[#497F70]">
                {formatRupiah(
                  totalNominal
                )}
              </span>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}