"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function LaporanSupplierPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch("/api/laporan/supplier");
      const json = await res.json();

      if (json.success) {
        setData(json.data ?? []);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error("LOAD LAPORAN SUPPLIER:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const suppliers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return data;
    }

    return data.filter((item: any) => {
      return (
        item.name?.toLowerCase().includes(keyword) ||
        item.city?.toLowerCase().includes(keyword)
      );
    });
  }, [data, search]);

  const totalPO = suppliers.reduce(
    (sum, item) => sum + Number(item.totalPO ?? 0),
    0
  );

  const totalValue = suppliers.reduce(
    (sum, item) => sum + Number(item.totalValue ?? 0),
    0
  );

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">
          Laporan Supplier
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Ringkasan supplier, purchase order, dan nilai transaksi pembelian
        </p>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">

        {/* TOTAL SUPPLIER */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <p className="text-sm font-medium text-slate-500">
            Total Supplier
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-800">
            {suppliers.length.toLocaleString("id-ID")}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Supplier sesuai pencarian
          </p>

        </div>

        {/* TOTAL PO */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <p className="text-sm font-medium text-slate-500">
            Total Purchase Order
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-800">
            {totalPO.toLocaleString("id-ID")}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Total PO supplier
          </p>

        </div>

        {/* TOTAL VALUE */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <p className="text-sm font-medium text-slate-500">
            Nilai PO
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-800">
            Rp {totalValue.toLocaleString("id-ID")}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Total nilai pembelian
          </p>

        </div>

      </div>

      {/* MAIN CARD */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {/* TOOLBAR */}
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <h2 className="font-semibold text-slate-800">
              Data Supplier
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Klik nama supplier untuk melihat detail transaksi
            </p>

          </div>

          <div className="w-full lg:w-80">

            <input
              type="text"
              placeholder="🔎 Cari supplier atau kota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="
                w-full
                rounded-xl
                border
                border-slate-200
                bg-slate-50
                px-4
                py-3
                text-sm
                outline-none
                transition
                focus:border-blue-500
                focus:bg-white
                focus:ring-2
                focus:ring-blue-100
              "
            />

          </div>

        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">

          <table className="w-full min-w-[900px] text-sm">

            <thead className="bg-slate-50">

              <tr>

                <th className="px-5 py-4 text-left font-semibold text-slate-600">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-slate-600">
                  Supplier
                </th>

                <th className="px-5 py-4 text-left font-semibold text-slate-600">
                  Kota
                </th>

                <th className="px-5 py-4 text-right font-semibold text-slate-600">
                  Total PO
                </th>

                <th className="px-5 py-4 text-right font-semibold text-slate-600">
                  Nilai PO
                </th>

                <th className="px-5 py-4 text-center font-semibold text-slate-600">
                  Transaksi Terakhir
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    <div className="flex flex-col items-center gap-2">

                      <div className="
                        h-8
                        w-8
                        animate-spin
                        rounded-full
                        border-4
                        border-slate-200
                        border-t-blue-600
                      " />

                      <span>
                        Memuat laporan supplier...
                      </span>

                    </div>
                  </td>

                </tr>

              ) : suppliers.length === 0 ? (

                <tr>

                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center"
                  >

                    <div className="text-4xl">
                      📦
                    </div>

                    <p className="mt-3 font-medium text-slate-700">
                      Tidak ada data supplier
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      Coba gunakan kata pencarian yang berbeda.
                    </p>

                  </td>

                </tr>

              ) : (

                suppliers.map((item: any, index: number) => (

                  <tr
                    key={item.id}
                    className="
                      border-t
                      border-slate-100
                      transition
                      hover:bg-slate-50
                    "
                  >

                    {/* NO */}
                    <td className="px-5 py-4 text-slate-500">
                      {index + 1}
                    </td>

                    {/* SUPPLIER */}
                    <td className="px-5 py-4">

                      <Link
                        href={`/laporan/supplier/${item.id}`}
                        className="
                          font-semibold
                          text-blue-600
                          transition
                          hover:text-blue-800
                          hover:underline
                        "
                      >
                        {item.name ?? "-"}
                      </Link>

                    </td>

                    {/* KOTA */}
                    <td className="px-5 py-4 text-slate-600">
                      {item.city ?? "-"}
                    </td>

                    {/* TOTAL PO */}
                    <td className="px-5 py-4 text-right font-medium text-slate-700">
                      {Number(
                        item.totalPO ?? 0
                      ).toLocaleString("id-ID")}
                    </td>

                    {/* NILAI PO */}
                    <td className="px-5 py-4 text-right font-semibold text-slate-800">
                      Rp{" "}
                      {Number(
                        item.totalValue ?? 0
                      ).toLocaleString("id-ID")}
                    </td>

                    {/* LAST TRANSACTION */}
                    <td className="px-5 py-4 text-center text-slate-600">

                      {item.lastTransaction ? (
                        new Date(
                          item.lastTransaction
                        ).toLocaleDateString("id-ID")
                      ) : (
                        "-"
                      )}

                    </td>

                  </tr>

                ))

              )}

            </tbody>

            {/* TOTAL */}
            {!loading && suppliers.length > 0 && (

              <tfoot className="bg-slate-50">

                <tr className="border-t-2 border-slate-200">

                  <td
                    colSpan={3}
                    className="px-5 py-4 text-right font-bold text-slate-700"
                  >
                    TOTAL
                  </td>

                  <td className="px-5 py-4 text-right font-bold text-slate-800">
                    {totalPO.toLocaleString("id-ID")}
                  </td>

                  <td className="px-5 py-4 text-right font-bold text-slate-800">
                    Rp {totalValue.toLocaleString("id-ID")}
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