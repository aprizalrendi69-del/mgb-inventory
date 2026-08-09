"use client";

import { useEffect, useMemo, useState } from "react";

import { exportReportPDF } from "@/lib/exportReportPdf";
import { exportReportExcel } from "@/lib/exportReportExcel";
import { printTable } from "@/lib/print";

type BarangMasukItem = {
  barang?: {
    name?: string;
    code?: string;
  };
  qty?: number;
  price?: number;
  subtotal?: number;
};

type Receipt = {
  id: number;
  number: string;
  receiptDate: string;
  supplier?: {
    name?: string;
  };
  items?: BarangMasukItem[];
};

type ReportRow = {
  noReceive: string;
  tanggal: string;
  supplier: string;
  kodeBarang: string;
  barang: string;
  qty: number;
  harga: number;
  total: number;
};

export default function LaporanBarangMasuk() {
  const [data, setData] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch("/api/laporan/barang-masuk");

      const result = await res.json();

      if (result.success) {
        setData(result.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error("Gagal mengambil laporan barang masuk:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  /*
   * Ubah data receipt menjadi data per barang.
   */
  const rowsData = useMemo<ReportRow[]>(() => {
    const result: ReportRow[] = [];

    data.forEach((receipt) => {
      receipt.items?.forEach((item) => {
        const date = new Date(receipt.receiptDate);

        const tanggalISO = date.toISOString().split("T")[0];

        result.push({
          noReceive: receipt.number,
          tanggal: tanggalISO,
          supplier: receipt.supplier?.name ?? "-",
          kodeBarang: item.barang?.code ?? "-",
          barang: item.barang?.name ?? "-",
          qty: Number(item.qty ?? 0),
          harga: Number(item.price ?? 0),
          total: Number(item.subtotal ?? 0),
        });
      });
    });

    return result;
  }, [data]);

  /*
   * Filter pencarian dan tanggal.
   */
  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return rowsData.filter((row) => {
      const cocokSearch =
        !keyword ||
        row.noReceive.toLowerCase().includes(keyword) ||
        row.supplier.toLowerCase().includes(keyword) ||
        row.kodeBarang.toLowerCase().includes(keyword) ||
        row.barang.toLowerCase().includes(keyword);

      const cocokStart =
        !startDate || row.tanggal >= startDate;

      const cocokEnd =
        !endDate || row.tanggal <= endDate;

      return cocokSearch && cocokStart && cocokEnd;
    });
  }, [rowsData, search, startDate, endDate]);

  const totalQty = useMemo(() => {
    return filteredRows.reduce(
      (sum, row) => sum + row.qty,
      0
    );
  }, [filteredRows]);

  const totalNilai = useMemo(() => {
    return filteredRows.reduce(
      (sum, row) => sum + row.total,
      0
    );
  }, [filteredRows]);

  const formatRupiah = (value: number) => {
    return "Rp " + value.toLocaleString("id-ID");
  };

  const formatTanggal = (value: string) => {
    if (!value) return "-";

    return new Date(value).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  /*
   * Data untuk export.
   */
  const exportColumns = [
    "No Receive",
    "Tanggal",
    "Supplier",
    "Kode Barang",
    "Barang",
    "Qty",
    "Harga",
    "Total",
  ];

  const exportRows = filteredRows.map((row) => [
    row.noReceive,
    formatTanggal(row.tanggal),
    row.supplier,
    row.kodeBarang,
    row.barang,
    row.qty,
    formatRupiah(row.harga),
    formatRupiah(row.total),
  ]);

  function handleExportPDF() {
    exportReportPDF(
      "Laporan Barang Masuk",
      exportColumns,
      exportRows
    );
  }

  function handleExportExcel() {
    exportReportExcel(
      "Laporan Barang Masuk",
      exportColumns,
      exportRows
    );
  }

  function handlePrint() {
    printTable(
      exportColumns,
      exportRows
    );
  }

  function resetFilter() {
    setSearch("");
    setStartDate("");
    setEndDate("");
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">

      {/* HEADER */}
      <div className="mb-6">

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            Laporan Barang Masuk
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Riwayat penerimaan barang dari supplier
          </p>
        </div>

      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <p className="text-sm text-slate-500">
            Total Transaksi
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-800">
            {new Set(
              filteredRows.map((row) => row.noReceive)
            ).size}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Nomor penerimaan
          </p>

        </div>


        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <p className="text-sm text-slate-500">
            Total Qty Masuk
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-800">
            {totalQty.toLocaleString("id-ID")}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Seluruh barang masuk
          </p>

        </div>


        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <p className="text-sm text-slate-500">
            Total Nilai Barang
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-800">
            {formatRupiah(totalNilai)}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Berdasarkan harga penerimaan
          </p>

        </div>

      </div>


      {/* FILTER */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="mb-4">

          <h2 className="font-semibold text-slate-800">
            Filter Laporan
          </h2>

          <p className="text-sm text-slate-500">
            Cari barang atau batasi laporan berdasarkan tanggal
          </p>

        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* SEARCH */}
          <div className="lg:col-span-2">

            <label className="mb-1 block text-sm font-medium text-slate-600">
              Pencarian
            </label>

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Cari No Receive, supplier, kode atau nama barang..."
              className="
                w-full
                rounded-xl
                border
                border-slate-300
                bg-white
                px-4
                py-3
                text-sm
                outline-none
                transition
                focus:border-slate-500
                focus:ring-2
                focus:ring-slate-100
              "
            />

          </div>


          {/* START DATE */}
          <div>

            <label className="mb-1 block text-sm font-medium text-slate-600">
              Dari Tanggal
            </label>

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
                border-slate-300
                bg-white
                px-4
                py-3
                text-sm
                outline-none
                focus:border-slate-500
                focus:ring-2
                focus:ring-slate-100
              "
            />

          </div>


          {/* END DATE */}
          <div>

            <label className="mb-1 block text-sm font-medium text-slate-600">
              Sampai Tanggal
            </label>

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
                border-slate-300
                bg-white
                px-4
                py-3
                text-sm
                outline-none
                focus:border-slate-500
                focus:ring-2
                focus:ring-slate-100
              "
            />

          </div>

        </div>


        <div className="mt-4 flex flex-wrap gap-3">

          <button
            onClick={resetFilter}
            className="
              rounded-xl
              border
              border-slate-300
              bg-white
              px-4
              py-2.5
              text-sm
              font-medium
              text-slate-700
              hover:bg-slate-50
            "
          >
            Reset Filter
          </button>

        </div>

      </div>


      {/* ACTION */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

        <div className="text-sm text-slate-500">

          Menampilkan{" "}
          <span className="font-semibold text-slate-800">
            {filteredRows.length}
          </span>{" "}
          baris data

        </div>


        <div className="flex flex-wrap gap-2">

          <button
            onClick={handleExportPDF}
            disabled={filteredRows.length === 0}
            className="
              rounded-xl
              bg-red-600
              px-4
              py-2.5
              text-sm
              font-medium
              text-white
              shadow-sm
              hover:bg-red-700
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            Export PDF
          </button>


          <button
            onClick={handleExportExcel}
            disabled={filteredRows.length === 0}
            className="
              rounded-xl
              bg-green-600
              px-4
              py-2.5
              text-sm
              font-medium
              text-white
              shadow-sm
              hover:bg-green-700
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            Export Excel
          </button>


          <button
            onClick={handlePrint}
            disabled={filteredRows.length === 0}
            className="
              rounded-xl
              bg-blue-600
              px-4
              py-2.5
              text-sm
              font-medium
              text-white
              shadow-sm
              hover:bg-blue-700
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            Print
          </button>

        </div>

      </div>


      {/* TABLE */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="overflow-x-auto">

          <table className="min-w-[1000px] w-full text-sm">

            <thead className="bg-slate-100">

              <tr>

                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  No Receive
                </th>

                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Tanggal
                </th>

                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Supplier
                </th>

                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Kode
                </th>

                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Barang
                </th>

                <th className="px-4 py-3 text-right font-semibold text-slate-600">
                  Qty
                </th>

                <th className="px-4 py-3 text-right font-semibold text-slate-600">
                  Harga
                </th>

                <th className="px-4 py-3 text-right font-semibold text-slate-600">
                  Total
                </th>

              </tr>

            </thead>


            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    Memuat laporan barang masuk...
                  </td>

                </tr>

              ) : filteredRows.length === 0 ? (

                <tr>

                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    Tidak ada data barang masuk
                  </td>

                </tr>

              ) : (

                filteredRows.map((row, index) => (

                  <tr
                    key={`${row.noReceive}-${row.kodeBarang}-${index}`}
                    className="
                      border-t
                      border-slate-100
                      hover:bg-slate-50
                    "
                  >

                    <td className="px-4 py-3 font-medium text-slate-800">
                      {row.noReceive}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {formatTanggal(row.tanggal)}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {row.supplier}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {row.kodeBarang}
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-800">
                      {row.barang}
                    </td>

                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      {row.qty.toLocaleString("id-ID")}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatRupiah(row.harga)}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {formatRupiah(row.total)}
                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}