"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  FileDown,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
  Truck,
  X,
} from "lucide-react";

import { exportReportPdf } from "@/lib/exportReportPdf";
import { exportReportExcel } from "@/lib/exportReportExcel";
import { printTable } from "@/lib/print";

type DeliveryItem = {
  id: number;
  barangId?: number;
  code?: string;
  name?: string;
  unit?: string;
  qty?: number;
  price?: number;
  subtotal?: number;
};

type Delivery = {
  id: number;
  number?: string;
  deliveryDate: string;
  customer?: {
    id?: number | null;
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

      const res = await fetch(url, {
        cache: "no-store",
      });

      const result = await res.json();

      if (result.success) {
        setData(
          Array.isArray(result.data)
            ? result.data
            : []
        );
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
   * =====================================================
   * FLATTEN DATA
   * =====================================================
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
          customer:
            delivery.customer?.name ?? "-",
          kodeBarang: item.code ?? "-",
          barang: item.name ?? "-",
          qty,
          harga,
          subtotal,
        });
      });
    });

    return result;
  }, [data]);

  /*
   * =====================================================
   * SEARCH
   * =====================================================
   */

  const filteredRows = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

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
   * =====================================================
   * SUMMARY
   * =====================================================
   */

  const totalDelivery = useMemo(() => {
    return new Set(
      filteredRows.map(
        (row) => row.noDelivery
      )
    ).size;
  }, [filteredRows]);

  const totalQty = useMemo(() => {
    return filteredRows.reduce(
      (sum, row) => sum + row.qty,
      0
    );
  }, [filteredRows]);

  const totalNominal = useMemo(() => {
    return filteredRows.reduce(
      (sum, row) => sum + row.subtotal,
      0
    );
  }, [filteredRows]);

  /*
   * =====================================================
   * FORMAT
   * =====================================================
   */

  function formatRupiah(value: number) {
    return (
      "Rp " +
      Number(value || 0).toLocaleString(
        "id-ID"
      )
    );
  }

  function formatTanggal(value: string) {
    if (!value) {
      return "-";
    }

    return new Date(
      value
    ).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  /*
   * =====================================================
   * EXPORT
   * =====================================================
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

  const rows = filteredRows.map(
    (row) => [
      row.no,
      formatTanggal(row.tanggal),
      row.noDelivery,
      row.customer,
      row.kodeBarang,
      row.barang,
      row.qty,
      formatRupiah(row.harga),
      formatRupiah(row.subtotal),
    ]
  );

  function handleExportPDF() {
    if (filteredRows.length === 0) {
      return;
    }

    exportReportPdf(
      "Laporan Barang Keluar",
      columns,
      rows
    );
  }

  function handleExportExcel() {
    if (filteredRows.length === 0) {
      return;
    }

    exportReportExcel(
      "Laporan Barang Keluar",
      columns,
      rows
    );
  }

  function handlePrint() {
    if (filteredRows.length === 0) {
      return;
    }

    printTable(columns, rows);
  }

  /*
   * =====================================================
   * FILTER
   * =====================================================
   */

  function resetFilter() {
    setSearch("");
    setStart("");
    setEnd("");

    setTimeout(() => {
      loadData();
    }, 0);
  }

  const hasFilter =
    search.trim() !== "" ||
    start !== "" ||
    end !== "";

  /*
   * =====================================================
   * RENDER
   * =====================================================
   */

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
            <Truck
              size={22}
              className="text-blue-600"
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Laporan Barang Keluar
            </h1>

            <p className="mt-0.5 text-sm text-slate-500">
              Riwayat barang yang keluar melalui pengiriman
            </p>
          </div>

        </div>

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
            border-slate-200
            bg-white
            px-4
            py-2.5
            text-sm
            font-semibold
            text-slate-700
            shadow-sm
            transition
            hover:bg-slate-50
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

      </div>

      {/* =================================================
          SUMMARY
      ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

        {/* TOTAL DELIVERY */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Total Delivery
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {totalDelivery.toLocaleString(
                  "id-ID"
                )}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Nomor pengiriman
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
              <Truck
                size={21}
                className="text-blue-600"
              />
            </div>

          </div>

        </div>

        {/* TOTAL QTY */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Total Qty Keluar
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {totalQty.toLocaleString(
                  "id-ID"
                )}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Seluruh barang keluar
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
              <Boxes
                size={21}
                className="text-emerald-600"
              />
            </div>

          </div>

        </div>

        {/* TOTAL NILAI */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Total Nilai
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatRupiah(
                  totalNominal
                )}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Berdasarkan harga barang
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
              <Boxes
                size={21}
                className="text-amber-600"
              />
            </div>

          </div>

        </div>

      </div>

      {/* =================================================
          FILTER
      ================================================= */}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="mb-4">

          <h2 className="font-semibold text-slate-800">
            Filter Laporan
          </h2>

          <p className="mt-0.5 text-sm text-slate-500">
            Cari berdasarkan nomor delivery, customer,
            kode atau nama barang
          </p>

        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">

          {/* SEARCH */}

          <div className="lg:col-span-2">

            <label className="mb-1.5 block text-sm font-medium text-slate-600">
              Pencarian
            </label>

            <div className="relative">

              <Search
                size={17}
                className="
                  pointer-events-none
                  absolute
                  left-3.5
                  top-1/2
                  -translate-y-1/2
                  text-slate-400
                "
              />

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
                  py-3
                  pl-10
                  pr-4
                  text-sm
                  text-slate-700
                  outline-none
                  transition
                  placeholder:text-slate-400
                  focus:border-blue-400
                  focus:ring-2
                  focus:ring-blue-100
                "
              />

            </div>

          </div>

          {/* START */}

          <div>

            <label className="mb-1.5 block text-sm font-medium text-slate-600">
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
                text-slate-700
                outline-none
                transition
                focus:border-blue-400
                focus:ring-2
                focus:ring-blue-100
              "
            />

          </div>

          {/* END */}

          <div>

            <label className="mb-1.5 block text-sm font-medium text-slate-600">
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
                text-slate-700
                outline-none
                transition
                focus:border-blue-400
                focus:ring-2
                focus:ring-blue-100
              "
            />

          </div>

        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">

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
              bg-slate-800
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-sm
              transition
              hover:bg-slate-900
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            <Search size={16} />

            Terapkan Filter
          </button>

          <button
            type="button"
            onClick={resetFilter}
            disabled={!hasFilter}
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-slate-200
              bg-white
              px-4
              py-2.5
              text-sm
              font-semibold
              text-slate-700
              shadow-sm
              transition
              hover:bg-slate-50
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            <X size={16} />

            Reset
          </button>

        </div>

      </div>

      {/* =================================================
          ACTION BAR
      ================================================= */}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

        <div className="text-sm text-slate-500">

          Menampilkan{" "}

          <span className="font-semibold text-slate-800">
            {filteredRows.length}
          </span>

          {" "}baris data

        </div>

        <div className="flex flex-wrap gap-2">

          {/* PDF */}

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={
              filteredRows.length === 0
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-red-600
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-sm
              transition
              hover:bg-red-700
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            <FileDown size={16} />

            Export PDF
          </button>

          {/* EXCEL */}

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={
              filteredRows.length === 0
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-emerald-600
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-sm
              transition
              hover:bg-emerald-700
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            <FileSpreadsheet size={16} />

            Export Excel
          </button>

          {/* PRINT */}

          <button
            type="button"
            onClick={handlePrint}
            disabled={
              filteredRows.length === 0
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-blue-600
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-sm
              transition
              hover:bg-blue-700
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            <Printer size={16} />

            Print
          </button>

        </div>

      </div>

      {/* =================================================
          TABLE
      ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 px-5 py-4">

          <div className="flex items-center justify-between gap-3">

            <div>

              <h2 className="font-semibold text-slate-800">
                Detail Barang Keluar
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                Daftar barang berdasarkan Delivery Order
              </p>

            </div>

            <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {filteredRows.length} baris
            </div>

          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1100px] text-sm">

            <thead>

              <tr className="border-b border-slate-200 bg-slate-50">

                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  No
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tanggal
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  No Delivery
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Kode Barang
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nama Barang
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Qty
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Harga
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Subtotal
                </th>

              </tr>

            </thead>

            <tbody>

              {/* LOADING */}

              {loading && (

                <tr>

                  <td
                    colSpan={9}
                    className="px-4 py-14 text-center"
                  >

                    <div className="flex flex-col items-center justify-center">

                      <RefreshCw
                        size={25}
                        className="animate-spin text-blue-600"
                      />

                      <p className="mt-3 text-sm text-slate-500">
                        Memuat laporan barang keluar...
                      </p>

                    </div>

                  </td>

                </tr>

              )}

              {/* EMPTY */}

              {!loading &&
                filteredRows.length === 0 && (

                  <tr>

                    <td
                      colSpan={9}
                      className="px-4 py-14 text-center"
                    >

                      <div className="mx-auto flex max-w-md flex-col items-center">

                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">

                          <Truck
                            size={27}
                            className="text-slate-400"
                          />

                        </div>

                        <h3 className="mt-4 font-semibold text-slate-700">
                          Tidak ada data barang keluar
                        </h3>

                        <p className="mt-1 text-sm text-slate-400">
                          Coba ubah kata pencarian atau
                          rentang tanggal.
                        </p>

                      </div>

                    </td>

                  </tr>

                )}

              {/* DATA */}

              {!loading &&
                filteredRows.length > 0 &&
                filteredRows.map((row) => (

                  <tr
                    key={`${row.noDelivery}-${row.kodeBarang}-${row.no}`}
                    className="
                      border-b
                      border-slate-100
                      transition
                      hover:bg-slate-50
                    "
                  >

                    <td className="px-4 py-3 text-center text-slate-500">
                      {row.no}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatTanggal(
                        row.tanggal
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">
                      {row.noDelivery}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {row.customer}
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {row.kodeBarang}
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-800">
                      {row.barang}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-slate-700">
                      {row.qty.toLocaleString(
                        "id-ID"
                      )}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatRupiah(
                        row.harga
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {formatRupiah(
                        row.subtotal
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