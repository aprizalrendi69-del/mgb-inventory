"use client";

import { useEffect, useMemo, useState } from "react";

import { exportReportPdf } from "@/lib/exportReportPdf";
import { exportReportExcel } from "@/lib/exportReportExcel";
import { printTable } from "@/lib/print";

type DeliveryItem = {
  id: number;
  qty?: number;
  price?: number;
  subtotal?: number;
  barang?: {
    code?: string;
    name?: string;
  };
};

type Delivery = {
  id: number;
  number?: string;
  deliveryDate: string;
  customer?: {
    name?: string;
  };
  items?: DeliveryItem[];
};

type ReportRow = {
  no: number;
  tanggal: string;
  noDelivery: string;
  customer: string;
  kodeBarang: string;
  barang: string;
  qty: number;
  harga: number;
  subtotal: number;
};

export default function LaporanBarangKeluar() {
  const [data, setData] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      let url = "/api/laporan/barang-keluar";

      if (start || end) {
        const params = new URLSearchParams();

        if (start) {
          params.append("start", start);
        }

        if (end) {
          params.append("end", end);
        }

        url += `?${params.toString()}`;
      }

      const res = await fetch(url);

      const result = await res.json();

      if (result.success) {
        setData(result.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error(
        "Gagal mengambil laporan barang keluar:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  /*
   * Ubah data delivery menjadi
   * data per barang.
   */
  const rowsData = useMemo<ReportRow[]>(() => {
    const result: ReportRow[] = [];

    let nomor = 1;

    data.forEach((delivery) => {
      delivery.items?.forEach((item) => {
        const qty = Number(item.qty ?? 0);

        const harga = Number(item.price ?? 0);

        const subtotal = Number(
          item.subtotal ?? qty * harga
        );

        result.push({
          no: nomor++,
          tanggal: delivery.deliveryDate,
          noDelivery: delivery.number ?? "-",
          customer: delivery.customer?.name ?? "-",
          kodeBarang: item.barang?.code ?? "-",
          barang: item.barang?.name ?? "-",
          qty,
          harga,
          subtotal,
        });
      });
    });

    return result;
  }, [data]);

  /*
   * Filter pencarian.
   */
  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return rowsData.filter((row) => {
      if (!keyword) {
        return true;
      }

      return (
        row.noDelivery
          .toLowerCase()
          .includes(keyword) ||
        row.customer
          .toLowerCase()
          .includes(keyword) ||
        row.kodeBarang
          .toLowerCase()
          .includes(keyword) ||
        row.barang
          .toLowerCase()
          .includes(keyword)
      );
    });
  }, [rowsData, search]);

  /*
   * Total Qty.
   */
  const totalQty = useMemo(() => {
    return filteredRows.reduce(
      (sum, row) => sum + row.qty,
      0
    );
  }, [filteredRows]);

  /*
   * Total nominal.
   */
  const totalNominal = useMemo(() => {
    return filteredRows.reduce(
      (sum, row) => sum + row.subtotal,
      0
    );
  }, [filteredRows]);

  /*
   * Jumlah Delivery Order unik.
   */
  const totalDelivery = useMemo(() => {
    return new Set(
      filteredRows.map((row) => row.noDelivery)
    ).size;
  }, [filteredRows]);

  function formatRupiah(value: number) {
    return "Rp " + value.toLocaleString("id-ID");
  }

  function formatTanggal(value: string) {
    if (!value) {
      return "-";
    }

    return new Date(value).toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  /*
   * Data export.
   */
  const columns = [
    "No",
    "Tanggal",
    "No Delivery",
    "Customer",
    "Kode Barang",
    "Nama Barang",
    "Qty",
    "Harga",
    "Subtotal",
  ];

  const rows = filteredRows.map((row) => [
    row.no,
    formatTanggal(row.tanggal),
    row.noDelivery,
    row.customer,
    row.kodeBarang,
    row.barang,
    row.qty,
    formatRupiah(row.harga),
    formatRupiah(row.subtotal),
  ]);

  function handleExportPDF() {
    exportReportPdf(
      "Laporan Barang Keluar",
      columns,
      rows
    );
  }

  function handleExportExcel() {
    exportReportExcel(
      "Laporan Barang Keluar",
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

  function resetFilter() {
    setSearch("");
    setStart("");
    setEnd("");

    /*
     * Reload semua data setelah reset.
     */
    setTimeout(() => {
      loadData();
    }, 0);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">

      {/* HEADER */}
      <div className="mb-6">

        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
          Laporan Barang Keluar
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Riwayat barang yang keluar melalui pengiriman
        </p>

      </div>


      {/* SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

        {/* TOTAL DELIVERY */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <p className="text-sm text-slate-500">
            Total Delivery
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-800">
            {totalDelivery.toLocaleString("id-ID")}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Nomor pengiriman
          </p>

        </div>


        {/* TOTAL QTY */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <p className="text-sm text-slate-500">
            Total Qty Keluar
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-800">
            {totalQty.toLocaleString("id-ID")}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Seluruh barang keluar
          </p>

        </div>


        {/* TOTAL NOMINAL */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <p className="text-sm text-slate-500">
            Total Nilai
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-800">
            {formatRupiah(totalNominal)}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Berdasarkan harga barang
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
            Cari barang, customer atau nomor delivery
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
              placeholder="Cari No Delivery, customer, kode atau nama barang..."
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


          {/* START */}
          <div>

            <label className="mb-1 block text-sm font-medium text-slate-600">
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


          {/* END */}
          <div>

            <label className="mb-1 block text-sm font-medium text-slate-600">
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
            onClick={loadData}
            className="
              rounded-xl
              bg-slate-800
              px-5
              py-2.5
              text-sm
              font-medium
              text-white
              hover:bg-slate-900
            "
          >
            Terapkan Filter
          </button>


          <button
            onClick={resetFilter}
            className="
              rounded-xl
              border
              border-slate-300
              bg-white
              px-5
              py-2.5
              text-sm
              font-medium
              text-slate-700
              hover:bg-slate-50
            "
          >
            Reset
          </button>

        </div>

      </div>


      {/* ACTION BAR */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

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

          <table className="min-w-[1100px] w-full text-sm">

            <thead className="bg-slate-100">

              <tr>

                <th className="px-4 py-3 text-center font-semibold text-slate-600">
                  No
                </th>

                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Tanggal
                </th>

                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  No Delivery
                </th>

                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Customer
                </th>

                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Kode Barang
                </th>

                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Nama Barang
                </th>

                <th className="px-4 py-3 text-right font-semibold text-slate-600">
                  Qty
                </th>

                <th className="px-4 py-3 text-right font-semibold text-slate-600">
                  Harga
                </th>

                <th className="px-4 py-3 text-right font-semibold text-slate-600">
                  Subtotal
                </th>

              </tr>

            </thead>


            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    Memuat laporan barang keluar...
                  </td>

                </tr>

              ) : filteredRows.length === 0 ? (

                <tr>

                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    Tidak ada data barang keluar
                  </td>

                </tr>

              ) : (

                filteredRows.map((row) => (

                  <tr
                    key={`${row.noDelivery}-${row.kodeBarang}-${row.no}`}
                    className="
                      border-t
                      border-slate-100
                      hover:bg-slate-50
                    "
                  >

                    <td className="px-4 py-3 text-center text-slate-500">
                      {row.no}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {formatTanggal(row.tanggal)}
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-800">
                      {row.noDelivery}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {row.customer}
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
                      {formatRupiah(row.subtotal)}
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