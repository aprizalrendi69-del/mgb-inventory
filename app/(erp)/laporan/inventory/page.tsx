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
  const [statusFilter, setStatusFilter] = useState("ALL");

  // =========================================================
  // LOAD DATA
  // =========================================================

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
        "Gagal mengambil laporan inventory:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // HELPER
  // =========================================================

  function getCategory(item: any) {
    if (
      typeof item.category === "object" &&
      item.category !== null
    ) {
      return item.category?.name ?? "-";
    }

    return item.category ?? "-";
  }

  function getMinimumStock(item: any) {
    return Number(
      item.minimumStock ??
        item.minStock ??
        item.stockMinimum ??
        0
    );
  }

  function getStockStatus(item: any) {
    const stock = Number(item.stock ?? 0);
    const minimum = getMinimumStock(item);

    if (stock <= 0) {
      return "HABIS";
    }

    if (
      minimum > 0 &&
      stock <= minimum
    ) {
      return "MENIPIS";
    }

    return "AMAN";
  }

  // =========================================================
  // FILTER
  // =========================================================

  const filteredData = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    return data.filter((item: any) => {
      const code =
        String(item.code ?? "")
          .toLowerCase();

      const name =
        String(item.name ?? "")
          .toLowerCase();

      const category =
        String(getCategory(item))
          .toLowerCase();

      const status =
        getStockStatus(item);

      const cocokSearch =
        !keyword ||
        code.includes(keyword) ||
        name.includes(keyword) ||
        category.includes(keyword);

      const cocokStatus =
        statusFilter === "ALL" ||
        status === statusFilter;

      return (
        cocokSearch &&
        cocokStatus
      );
    });
  }, [
    data,
    search,
    statusFilter,
  ]);

  // =========================================================
  // SUMMARY
  // =========================================================

  const totalStock = useMemo(() => {
    return filteredData.reduce(
      (total, item) =>
        total +
        Number(item.stock ?? 0),
      0
    );
  }, [filteredData]);

  const totalAsset = useMemo(() => {
    return filteredData.reduce(
      (total, item) => {
        const stock =
          Number(item.stock ?? 0);

        const price =
          Number(
            item.purchasePrice ?? 0
          );

        return total + stock * price;
      },
      0
    );
  }, [filteredData]);

  const lowStockCount = useMemo(() => {
    return filteredData.filter(
      (item: any) =>
        getStockStatus(item) ===
        "MENIPIS"
    ).length;
  }, [filteredData]);

  const emptyStockCount = useMemo(() => {
    return filteredData.filter(
      (item: any) =>
        getStockStatus(item) ===
        "HABIS"
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

  function formatRupiah(value: any) {
    return (
      "Rp " +
      Number(
        value ?? 0
      ).toLocaleString("id-ID")
    );
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
    "Status",
  ];

  const rows = filteredData.map(
    (item: any, index: number) => {
      const stock =
        Number(item.stock ?? 0);

      const price =
        Number(
          item.purchasePrice ?? 0
        );

      const asset =
        stock * price;

      return [
        index + 1,
        item.code ?? "-",
        item.name ?? "-",
        getCategory(item),
        stock,
        formatRupiah(price),
        formatRupiah(asset),
        getStockStatus(item),
      ];
    }
  );

  // =========================================================
  // RESET FILTER
  // =========================================================

  function resetFilter() {
    setSearch("");
    setStatusFilter("ALL");
  }

  const hasFilter =
    search !== "" ||
    statusFilter !== "ALL";

  // =========================================================
  // STATUS BADGE
  // =========================================================

  function StatusBadge({
    status,
  }: {
    status: string;
  }) {
    if (status === "HABIS") {
      return (
        <span
          className="
            inline-flex
            items-center
            gap-1.5
            rounded-full
            bg-red-50
            px-3
            py-1
            text-xs
            font-semibold
            text-red-600
          "
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          Habis
        </span>
      );
    }

    if (status === "MENIPIS") {
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
            text-amber-600
          "
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Menipis
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
          bg-emerald-50
          px-3
          py-1
          text-xs
          font-semibold
          text-emerald-600
        "
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Aman
      </span>
    );
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
            Memuat laporan inventory...
          </p>

        </div>
      </div>
    );
  }

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="space-y-6 pb-8">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div
        className="
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
          disabled={loading}
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

      {/* ================================================= */}
      {/* SUMMARY */}
      {/* ================================================= */}

      <div
        className="
          grid
          grid-cols-1
          gap-4
          sm:grid-cols-2
          xl:grid-cols-5
        "
      >

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
                {formatNumber(totalStock)}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Jumlah seluruh stock
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

        {/* MENIPIS */}

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
                Stok Menipis
              </p>

              <p className="mt-2 text-2xl font-bold text-amber-600">
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

        {/* HABIS */}

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
                Stok Habis
              </p>

              <p className="mt-2 text-2xl font-bold text-red-600">
                {formatNumber(
                  emptyStockCount
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Tidak tersedia
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
                bg-red-50
                text-red-600
              "
            >
              <Package size={20} />
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
                {formatRupiah(totalAsset)}
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
      {/* FILTER / TOOLBAR */}
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

        <div
          className="
            flex
            flex-col
            gap-4
            xl:flex-row
            xl:items-end
            xl:justify-between
          "
        >

          {/* FILTER AREA */}

          <div
            className="
              grid
              w-full
              grid-cols-1
              gap-3
              md:grid-cols-[minmax(0,1fr)_220px]
              xl:max-w-3xl
            "
          >

            {/* SEARCH */}

            <div>

              <label className="mb-1.5 block text-sm font-medium text-[#35564C]">
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
                    title="Hapus pencarian"
                  >
                    <X size={16} />
                  </button>
                )}

              </div>

            </div>

            {/* STATUS */}

            <div>

              <label className="mb-1.5 block text-sm font-medium text-[#35564C]">
                Status Stock
              </label>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value
                  )
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
              >
                <option value="ALL">
                  Semua Status
                </option>

                <option value="AMAN">
                  Aman
                </option>

                <option value="MENIPIS">
                  Menipis
                </option>

                <option value="HABIS">
                  Habis
                </option>
              </select>

            </div>

          </div>

          {/* EXPORT */}

          <div className="flex flex-wrap gap-2">

            <button
              type="button"
              disabled={
                filteredData.length === 0
              }
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
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              <FileDown size={17} />
              PDF
            </button>

            <button
              type="button"
              disabled={
                filteredData.length === 0
              }
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
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              <FileSpreadsheet size={17} />
              Excel
            </button>

            <button
              type="button"
              disabled={
                filteredData.length === 0
              }
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
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              <Printer size={17} />
              Print
            </button>

          </div>

        </div>

        {/* INFO FILTER */}

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

          {hasFilter && (
            <button
              type="button"
              onClick={resetFilter}
              className="
                inline-flex
                items-center
                gap-1
                font-semibold
                text-[#497F70]
                transition
                hover:text-[#3D6D60]
              "
            >
              <X size={14} />
              Reset Filter
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

          <table className="min-w-[1050px] w-full text-sm">

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

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {filteredData.length === 0 ? (

                <tr>

                  <td
                    colSpan={8}
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
                        Coba ubah pencarian atau
                        filter status
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

                    const status =
                      getStockStatus(
                        item
                      );

                    const isLowStock =
                      status ===
                      "MENIPIS";

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
                            {getCategory(
                              item
                            )}
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

                            {status ===
                              "HABIS" && (
                              <AlertTriangle
                                size={15}
                                className="text-red-500"
                              />
                            )}

                            <span
                              className={`
                                font-semibold
                                ${
                                  status ===
                                  "HABIS"
                                    ? "text-red-600"
                                    : status ===
                                      "MENIPIS"
                                    ? "text-amber-600"
                                    : "text-[#18352D]"
                                }
                              `}
                            >
                              {formatNumber(
                                stock
                              )}
                            </span>

                          </div>

                        </td>

                        {/* HARGA */}

                        <td className="whitespace-nowrap px-5 py-4 text-right text-gray-600">

                          {formatRupiah(
                            price
                          )}

                        </td>

                        {/* ASSET */}

                        <td className="whitespace-nowrap px-5 py-4 text-right">

                          <span className="font-semibold text-[#497F70]">
                            {formatRupiah(
                              asset
                            )}
                          </span>

                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-4 text-center">

                          <StatusBadge
                            status={status}
                          />

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
                {formatRupiah(
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