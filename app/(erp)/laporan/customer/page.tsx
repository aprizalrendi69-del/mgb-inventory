"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { exportReportPDF } from "@/lib/exportReportPdf";
import { exportReportExcel } from "@/lib/exportReportExcel";
import { printTable } from "@/lib/print";

export default function LaporanCustomer() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  async function loadData() {
    try {
      setLoading(true);

      let url = "/api/laporan/customer";

      if (start && end) {
        url += `?start=${start}&end=${end}`;
      }

      const res = await fetch(url);
      const json = await res.json();

      if (json.success) {
        setData(json.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error("LOAD LAPORAN CUSTOMER:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // =========================
  // SUMMARY
  // =========================

  const totalCustomer = data.length;

  const totalTransaksi = data.reduce(
    (sum, item) => sum + Number(item.transaksi ?? 0),
    0
  );

  const totalQty = data.reduce(
    (sum, item) => sum + Number(item.qty ?? 0),
    0
  );

  const totalNominal = data.reduce(
    (sum, item) => sum + Number(item.nominal ?? 0),
    0
  );

  // =========================
  // EXPORT DATA
  // =========================

  const columns = [
    "No",
    "Customer",
    "PIC",
    "Total Transaksi",
    "Total Qty",
    "Total Nominal",
  ];

  const rows = data.map((item, index) => [
    index + 1,
    item.name ?? "-",
    item.pic ?? "-",
    item.transaksi ?? 0,
    item.qty ?? 0,
    "Rp " +
      Number(item.nominal ?? 0).toLocaleString("id-ID"),
  ]);

  // =========================
  // PRINT
  // =========================

  function handlePrint() {
    printTable(columns, rows);
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">
          Laporan Customer
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Ringkasan transaksi, jumlah barang, dan nilai transaksi customer
        </p>
      </div>

      {/* FILTER */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Filter Laporan
          </h2>

          <p className="text-sm text-slate-500">
            Pilih periode tanggal delivery
          </p>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">

          <div className="w-full lg:w-56">
            <label className="mb-2 block text-sm font-medium text-slate-600">
              Tanggal Awal
            </label>

            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
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

          <div className="w-full lg:w-56">
            <label className="mb-2 block text-sm font-medium text-slate-600">
              Tanggal Akhir
            </label>

            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
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
            {loading ? "Memuat..." : "🔎 Filter"}
          </button>

          <button
            onClick={() => {
              setStart("");
              setEnd("");

              setTimeout(() => {
                loadData();
              }, 0);
            }}
            className="
              rounded-xl
              border
              border-slate-200
              bg-white
              px-6
              py-3
              text-sm
              font-semibold
              text-slate-600
              transition
              hover:bg-slate-50
            "
          >
            Reset
          </button>

        </div>

      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Total Customer
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-800">
            {totalCustomer.toLocaleString("id-ID")}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Total Transaksi
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-800">
            {totalTransaksi.toLocaleString("id-ID")}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Total Qty
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-800">
            {totalQty.toLocaleString("id-ID")}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Total Nominal
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-800">
            Rp {totalNominal.toLocaleString("id-ID")}
          </p>
        </div>

      </div>

      {/* ACTION */}
      <div className="flex flex-wrap gap-3">

        <button
          onClick={() =>
            exportReportPDF(
              "Laporan Customer",
              columns,
              rows
            )
          }
          disabled={data.length === 0}
          className="
            rounded-xl
            bg-red-600
            px-5
            py-3
            text-sm
            font-semibold
            text-white
            transition
            hover:bg-red-700
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          📄 Export PDF
        </button>

        <button
          onClick={() =>
            exportReportExcel(
              "Laporan Customer",
              columns,
              rows
            )
          }
          disabled={data.length === 0}
          className="
            rounded-xl
            bg-green-600
            px-5
            py-3
            text-sm
            font-semibold
            text-white
            transition
            hover:bg-green-700
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          📊 Export Excel
        </button>

        <button
          onClick={handlePrint}
          disabled={data.length === 0}
          className="
            rounded-xl
            bg-slate-700
            px-5
            py-3
            text-sm
            font-semibold
            text-white
            transition
            hover:bg-slate-800
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          🖨️ Print
        </button>

      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 px-5 py-4">

          <h2 className="font-semibold text-slate-800">
            Data Customer
          </h2>

          <p className="text-sm text-slate-500">
            Klik nama customer untuk melihat detail
          </p>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[900px] text-sm">

            <thead className="bg-slate-50">

              <tr>

                <th className="px-5 py-4 text-left font-semibold text-slate-600">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-slate-600">
                  Customer
                </th>

                <th className="px-5 py-4 text-left font-semibold text-slate-600">
                  PIC
                </th>

                <th className="px-5 py-4 text-right font-semibold text-slate-600">
                  Transaksi
                </th>

                <th className="px-5 py-4 text-right font-semibold text-slate-600">
                  Qty
                </th>

                <th className="px-5 py-4 text-right font-semibold text-slate-600">
                  Total Nominal
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
                    Memuat laporan...
                  </td>

                </tr>

              ) : data.length === 0 ? (

                <tr>

                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    Tidak ada data customer pada periode tersebut.
                  </td>

                </tr>

              ) : (

                data.map((item, index) => (

                  <tr
                    key={item.id}
                    className="
                      border-t
                      border-slate-100
                      transition
                      hover:bg-slate-50
                    "
                  >

                    <td className="px-5 py-4 text-slate-500">
                      {index + 1}
                    </td>

                    <td className="px-5 py-4">

                      <Link
                        href={`/laporan/customer/${item.id}`}
                        className="
                          font-semibold
                          text-blue-600
                          hover:text-blue-800
                          hover:underline
                        "
                      >
                        {item.name ?? "-"}
                      </Link>

                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {item.pic ?? "-"}
                    </td>

                    <td className="px-5 py-4 text-right font-medium">
                      {Number(
                        item.transaksi ?? 0
                      ).toLocaleString("id-ID")}
                    </td>

                    <td className="px-5 py-4 text-right">
                      {Number(
                        item.qty ?? 0
                      ).toLocaleString("id-ID")}
                    </td>

                    <td className="px-5 py-4 text-right font-semibold">
                      Rp{" "}
                      {Number(
                        item.nominal ?? 0
                      ).toLocaleString("id-ID")}
                    </td>

                  </tr>

                ))

              )}

            </tbody>

            {!loading && data.length > 0 && (

              <tfoot className="bg-slate-50">

                <tr className="border-t-2 border-slate-200">

                  <td
                    colSpan={3}
                    className="px-5 py-4 text-right font-bold text-slate-700"
                  >
                    TOTAL
                  </td>

                  <td className="px-5 py-4 text-right font-bold text-slate-800">
                    {totalTransaksi.toLocaleString("id-ID")}
                  </td>

                  <td className="px-5 py-4 text-right font-bold text-slate-800">
                    {totalQty.toLocaleString("id-ID")}
                  </td>

                  <td className="px-5 py-4 text-right font-bold text-slate-800">
                    Rp {totalNominal.toLocaleString("id-ID")}
                  </td>

                </tr>

              </tfoot>

            )}

          </table>

        </div>

      </div>

    </div>
  );
}