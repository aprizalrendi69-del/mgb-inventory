"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Search,
  FileDown,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Package,
  AlertTriangle,
  Wallet,
  X,
} from "lucide-react";

import { exportReportPdf } from "@/lib/exportReportPdf";
import { exportReportExcel } from "@/lib/exportReportExcel";
import { printTable } from "@/lib/print";

export default function LaporanInventoryPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch("/api/inventory", {
        cache: "no-store",
      });

      const result = await res.json();

      console.log("LAPORAN INVENTORY:", result);

      if (result.success) {
        setData(result.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error(
        "Gagal mengambil laporan inventory:",
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
    const keyword = search.toLowerCase().trim();

    if (!keyword) {
      return data;
    }

    return data.filter((item: any) => {
      return (
        item.code
          ?.toLowerCase()
          .includes(keyword) ||
        item.name
          ?.toLowerCase()
          .includes(keyword) ||
        item.category
          ?.toLowerCase()
          .includes(keyword)
      );
    });
  }, [data, search]);

  // =========================================================
  // TOTAL STOCK
  // =========================================================

  const totalStock = useMemo(() => {
    return filteredData.reduce(
      (total, item) =>
        total + Number(item.stock ?? 0),
      0
    );
  }, [filteredData]);

  // =========================================================
  // TOTAL ASSET
  // =========================================================

  const totalAsset = useMemo(() => {
    return filteredData.reduce(
      (total, item) => {
        const stock = Number(
          item.stock ?? 0
        );

        const price = Number(
          item.purchasePrice ?? 0
        );

        return total + stock * price;
      },
      0
    );
  }, [filteredData]);

  // =========================================================
  // STOCK MINIMUM
  // =========================================================

  const lowStockCount = useMemo(() => {
    return filteredData.filter(
      (item: any) => {
        const stock = Number(
          item.stock ?? 0
        );

        const minimum = Number(
          item.minimumStock ??
            item.minStock ??
            item.stockMinimum ??
            0
        );

        return (
          minimum > 0 &&
          stock <= minimum
        );
      }
    ).length;
  }, [filteredData]);

  // =========================================================
  // FORMAT
  // =========================================================

  function formatNumber(value: any) {
    return Number(
      value ?? 0
    ).toLocaleString("id-ID");
  }

  // =========================================================
  // EXPORT DATA
  // =========================================================

  const columns = [
    "No",
    "Kode",
    "Nama Barang",
    "Kategori",
    "Stock",
    "Harga",
    "Nilai Asset",
  ];

  const rows = filteredData.map(
    (item: any, index: number) => {
      const stock = Number(
        item.stock ?? 0
      );

      const price = Number(
        item.purchasePrice ?? 0
      );

      const asset =
        stock * price;

      return [
        index + 1,
        item.code ?? "-",
        item.name ?? "-",
        item.category ?? "-",
        stock,
        "Rp " +
          price.toLocaleString(
            "id-ID"
          ),
        "Rp " +
          asset.toLocaleString(
            "id-ID"
          ),
      ];
    }
  );

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
            Memuat laporan inventory...
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
            <Boxes size={23} />
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
              Laporan Inventory
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Ringkasan persediaan dan nilai
              asset barang
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* TOTAL BARANG */}

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
                Total Barang
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  filteredData.length
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Jenis barang
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

        {/* TOTAL STOCK */}

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
                Total Stock
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalStock
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Jumlah unit tersedia
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
              <Boxes size={20} />
            </div>

          </div>

        </div>

        {/* STOCK MINIMUM */}

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
                Stok Minimum
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  lowStockCount
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Perlu perhatian
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
              <AlertTriangle size={20} />
            </div>

          </div>

        </div>

        {/* ASSET */}

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
                Nilai Asset
              </p>

              <p className="mt-2 truncate text-xl font-bold text-[#497F70] md:text-2xl">
                Rp{" "}
                {formatNumber(
                  totalAsset
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Nilai persediaan
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
      {/* TOOLBAR */}
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

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

          {/* SEARCH */}

          <div className="relative w-full xl:max-w-xl">

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
              placeholder="Cari kode, nama barang, atau kategori..."
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
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
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

          {/* EXPORT */}

          <div className="flex flex-wrap gap-2">

            <button
              type="button"
              onClick={() =>
                exportReportPdf(
                  "Laporan Inventory",
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
                py-3
                text-sm
                font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-[#3D6D60]
              "
            >
              <FileDown size={17} />

              PDF
            </button>

            <button
              type="button"
              onClick={() =>
                exportReportExcel(
                  "Laporan Inventory",
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
                py-3
                text-sm
                font-semibold
                text-[#35564C]
                shadow-sm
                transition
                hover:bg-[#F5F8F6]
              "
            >
              <FileSpreadsheet size={17} />

              Excel
            </button>

            <button
              type="button"
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
                py-3
                text-sm
                font-semibold
                text-[#35564C]
                shadow-sm
                transition
                hover:bg-[#F5F8F6]
              "
            >
              <Printer size={17} />

              Print
            </button>

          </div>

        </div>

        {/* INFO */}

        <div
          className="
            mt-4
            flex
            flex-col
            gap-2
            border-t
            border-[#EDF2EF]
            pt-4
            text-xs
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          <p className="text-gray-500">

            Menampilkan{" "}

            <span className="font-semibold text-[#35564C]">
              {formatNumber(
                filteredData.length
              )}
            </span>

            {" "}dari{" "}

            <span className="font-semibold text-[#35564C]">
              {formatNumber(
                data.length
              )}
            </span>

            {" "}barang

          </p>

          {search && (
            <button
              type="button"
              onClick={() =>
                setSearch("")
              }
              className="
                font-semibold
                text-[#497F70]
                transition
                hover:text-[#3D6D60]
              "
            >
              Reset pencarian
            </button>
          )}

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
              Daftar Inventory
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Detail stok dan nilai persediaan
              barang
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
            Item
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
                  Kode
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Nama Barang
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Kategori
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Stock
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Harga
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Nilai Asset
                </th>

              </tr>

            </thead>

            <tbody>

              {filteredData.length === 0 ? (

                <tr>

                  <td
                    colSpan={7}
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
                        <Package size={25} />
                      </div>

                      <p className="font-semibold text-gray-700">
                        Tidak ada data inventory
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        Coba ubah kata pencarian
                        atau refresh data
                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                filteredData.map(
                  (
                    item: any,
                    index: number
                  ) => {

                    const stock =
                      Number(
                        item.stock ?? 0
                      );

                    const price =
                      Number(
                        item.purchasePrice ??
                          0
                      );

                    const asset =
                      stock * price;

                    const minimum =
                      Number(
                        item.minimumStock ??
                          item.minStock ??
                          item.stockMinimum ??
                          0
                      );

                    const isLowStock =
                      minimum > 0 &&
                      stock <= minimum;

                    return (
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

                        {/* KODE */}

                        <td className="px-5 py-4">

                          <span className="font-semibold text-[#18352D]">
                            {item.code ??
                              "-"}
                          </span>

                        </td>

                        {/* NAMA */}

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {item.name ??
                              "-"}
                          </div>

                        </td>

                        {/* KATEGORI */}

                        <td className="px-5 py-4">

                          <span
                            className="
                              inline-flex
                              rounded-full
                              bg-[#EAF3EF]
                              px-3
                              py-1
                              text-xs
                              font-semibold
                              text-[#497F70]
                            "
                          >
                            {item.category ??
                              "-"}
                          </span>

                        </td>

                        {/* STOCK */}

                        <td className="px-5 py-4 text-right">

                          <div className="flex items-center justify-end gap-2">

                            {isLowStock && (
                              <AlertTriangle
                                size={15}
                                className="text-amber-500"
                              />
                            )}

                            <span
                              className={`font-semibold ${
                                isLowStock
                                  ? "text-amber-600"
                                  : "text-[#18352D]"
                              }`}
                            >
                              {formatNumber(
                                stock
                              )}
                            </span>

                          </div>

                        </td>

                        {/* HARGA */}

                        <td className="whitespace-nowrap px-5 py-4 text-right text-gray-600">

                          Rp{" "}
                          {formatNumber(
                            price
                          )}

                        </td>

                        {/* ASSET */}

                        <td className="whitespace-nowrap px-5 py-4 text-right">

                          <span className="font-semibold text-[#497F70]">
                            Rp{" "}
                            {formatNumber(
                              asset
                            )}
                          </span>

                        </td>

                      </tr>
                    );
                  }
                )

              )}

            </tbody>

          </table>

        </div>

        {/* ================================================= */}
        {/* FOOTER */}
        {/* ================================================= */}

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
              barang

            </div>

            <div className="font-semibold text-[#35564C]">

              Total Asset:{" "}

              <span className="text-[#497F70]">
                Rp{" "}
                {formatNumber(
                  totalAsset
                )}
              </span>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}