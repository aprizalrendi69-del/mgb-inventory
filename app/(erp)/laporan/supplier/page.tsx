"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  FileText,
  Users,
  ShoppingCart,
  Wallet,
  Eye,
} from "lucide-react";

type Supplier = {
  id: number;
  name: string;
  city?: string | null;
  totalPO?: number;
  totalValue?: number;
  lastTransaction?: string | null;
};

export default function LaporanSupplierPage() {
  const [data, setData] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch("/api/laporan/supplier", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setData(json.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error("Gagal mengambil laporan supplier:", error);
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

    if (!keyword) {
      return data;
    }

    return data.filter((item) => {
      return (
        item.name?.toLowerCase().includes(keyword) ||
        item.city?.toLowerCase().includes(keyword)
      );
    });
  }, [data, search]);

  const totalSupplier = filteredData.length;

  const totalPO = useMemo(() => {
    return filteredData.reduce(
      (sum, item) => sum + Number(item.totalPO ?? 0),
      0
    );
  }, [filteredData]);

  const totalValue = useMemo(() => {
    return filteredData.reduce(
      (sum, item) => sum + Number(item.totalValue ?? 0),
      0
    );
  }, [filteredData]);

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("id-ID").format(
      Number(value || 0)
    );
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "-";

    return new Date(value).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-[#F6F8F7] p-4 md:p-6 lg:p-8">

      {/* HEADER */}
      <div className="mb-6">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
                <FileText size={22} />
              </div>

              <div>

                <h1 className="text-2xl font-bold text-[#1F2937]">
                  Laporan Supplier
                </h1>

                <p className="mt-1 text-sm text-gray-500">
                  Ringkasan supplier, purchase order, dan transaksi pembelian
                </p>

              </div>

            </div>

          </div>

          {/* REFRESH */}
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

      </div>

      {/* SUMMARY CARDS */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">

        {/* TOTAL SUPPLIER */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">

          <div className="flex items-start justify-between">

            <div>

              <p className="text-sm font-medium text-gray-500">
                Total Supplier
              </p>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatNumber(totalSupplier)}
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users size={20} />
            </div>

          </div>

          <p className="mt-3 text-xs text-gray-500">
            Supplier sesuai pencarian
          </p>

        </div>

        {/* TOTAL PO */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">

          <div className="flex items-start justify-between">

            <div>

              <p className="text-sm font-medium text-gray-500">
                Total Purchase Order
              </p>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatNumber(totalPO)}
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ShoppingCart size={20} />
            </div>

          </div>

          <p className="mt-3 text-xs text-gray-500">
            Total PO dari supplier
          </p>

        </div>

        {/* TOTAL VALUE */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">

          <div className="flex items-start justify-between">

            <div>

              <p className="text-sm font-medium text-gray-500">
                Nilai Purchase
              </p>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                Rp {formatNumber(totalValue)}
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <Wallet size={20} />
            </div>

          </div>

          <p className="mt-3 text-xs text-gray-500">
            Total nilai pembelian
          </p>

        </div>

      </div>

      {/* MAIN CARD */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">

        {/* TOOLBAR */}
        <div className="flex flex-col gap-4 border-b border-gray-100 p-5 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <h2 className="font-semibold text-gray-900">
              Data Supplier
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Klik nama supplier atau detail untuk melihat transaksi
            </p>

          </div>

          {/* SEARCH */}
          <div className="w-full lg:w-80">

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
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari supplier / kota..."
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

        </div>

        {/* INFO */}
        <div className="border-b border-gray-100 px-5 py-3">

          <p className="text-sm text-gray-500">

            Menampilkan{" "}

            <span className="font-semibold text-gray-800">
              {filteredData.length}
            </span>

            {" "}dari{" "}

            <span className="font-semibold text-gray-800">
              {data.length}
            </span>

            {" "}supplier

          </p>

        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">

          <table className="min-w-full text-sm">

            <thead>

              <tr className="border-b border-gray-100 bg-gray-50">

                <th className="whitespace-nowrap px-5 py-4 text-left font-semibold text-gray-600">
                  No
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-left font-semibold text-gray-600">
                  Supplier
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-left font-semibold text-gray-600">
                  Kota
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-right font-semibold text-gray-600">
                  Total PO
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-right font-semibold text-gray-600">
                  Nilai PO
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-center font-semibold text-gray-600">
                  Transaksi Terakhir
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-center font-semibold text-gray-600">
                  Aksi
                </th>

              </tr>

            </thead>

            <tbody>

              {/* LOADING */}
              {loading ? (

                <tr>

                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center"
                  >

                    <div className="flex flex-col items-center justify-center">

                      <RefreshCw
                        size={28}
                        className="mb-3 animate-spin text-[#497F70]"
                      />

                      <p className="text-sm text-gray-500">
                        Memuat laporan supplier...
                      </p>

                    </div>

                  </td>

                </tr>

              ) : filteredData.length === 0 ? (

                /* EMPTY */
                <tr>

                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                        <FileText size={22} />
                      </div>

                      <p className="font-medium text-gray-700">
                        Tidak ada data supplier
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Coba ubah kata pencarian atau refresh data
                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                /* DATA */
                filteredData.map((item, index) => (

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
                    <td className="whitespace-nowrap px-5 py-4 text-gray-500">
                      {index + 1}
                    </td>

                    {/* SUPPLIER */}
                    <td className="px-5 py-4">

                      <div className="flex items-center gap-3">

                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EDF5F2] text-[#497F70]">
                          <Users size={17} />
                        </div>

                        <div>

                          <Link
                            href={`/laporan/supplier/${item.id}`}
                            className="
                              font-semibold
                              text-gray-900
                              transition
                              hover:text-[#497F70]
                              hover:underline
                            "
                          >
                            {item.name || "-"}
                          </Link>

                          <p className="text-xs text-gray-400">
                            Supplier
                          </p>

                        </div>

                      </div>

                    </td>

                    {/* KOTA */}
                    <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                      {item.city || "-"}
                    </td>

                    {/* TOTAL PO */}
                    <td className="whitespace-nowrap px-5 py-4 text-right">

                      <span className="font-semibold text-gray-800">
                        {formatNumber(
                          Number(item.totalPO ?? 0)
                        )}
                      </span>

                    </td>

                    {/* NILAI */}
                    <td className="whitespace-nowrap px-5 py-4 text-right">

                      <span className="font-semibold text-gray-900">
                        Rp{" "}
                        {formatNumber(
                          Number(item.totalValue ?? 0)
                        )}
                      </span>

                    </td>

                    {/* TRANSAKSI TERAKHIR */}
                    <td className="whitespace-nowrap px-5 py-4 text-center text-gray-600">

                      {formatDate(item.lastTransaction)}

                    </td>

                    {/* AKSI */}
                    <td className="whitespace-nowrap px-5 py-4 text-center">

                      <Link
                        href={`/laporan/supplier/${item.id}`}
                        className="
                          inline-flex
                          items-center
                          gap-2
                          rounded-lg
                          border
                          border-gray-200
                          bg-white
                          px-3
                          py-2
                          text-xs
                          font-medium
                          text-gray-700
                          shadow-sm
                          transition
                          hover:border-[#497F70]
                          hover:bg-[#EDF5F2]
                          hover:text-[#497F70]
                        "
                      >

                        <Eye size={15} />

                        Detail

                      </Link>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

            {/* TOTAL */}
            {!loading && filteredData.length > 0 && (

              <tfoot>

                <tr className="bg-gray-50">

                  <td
                    colSpan={3}
                    className="px-5 py-4 text-right font-semibold text-gray-700"
                  >
                    Total
                  </td>

                  <td className="px-5 py-4 text-right font-bold text-gray-900">
                    {formatNumber(totalPO)}
                  </td>

                  <td className="px-5 py-4 text-right text-base font-bold text-[#497F70]">
                    Rp {formatNumber(totalValue)}
                  </td>

                  <td colSpan={2} />

                </tr>

              </tfoot>

            )}

          </table>

        </div>

      </div>

    </div>
  );
}