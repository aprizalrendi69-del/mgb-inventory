"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  RefreshCw,
  Tag,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  Filter,
} from "lucide-react";

type HargaStatus = "SEMUA" | "NAIK" | "TETAP" | "TURUN";

export default function MasterHargaPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<HargaStatus>("SEMUA");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch("/api/master-harga", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setRows(json.data ?? []);
      } else {
        setRows([]);
      }
    } catch (error) {
      console.error(
        "Gagal mengambil master harga:",
        error
      );

      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // STATUS HARGA
  // =========================================================

  function getStatus(row: any): HargaStatus {
    const hargaLama = Number(
      row.hargaLama ?? 0
    );

    const hargaBaru = Number(
      row.hargaBaru ?? 0
    );

    if (hargaBaru > hargaLama) {
      return "NAIK";
    }

    if (hargaBaru < hargaLama) {
      return "TURUN";
    }

    return "TETAP";
  }

  // =========================================================
  // FILTER DATA
  // =========================================================

  const filteredRows = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    return rows.filter((row) => {
      // -------------------------
      // FILTER STATUS
      // -------------------------

      const rowStatus = getStatus(row);

      if (
        statusFilter !== "SEMUA" &&
        rowStatus !== statusFilter
      ) {
        return false;
      }

      // -------------------------
      // SEARCH
      // -------------------------

      if (!keyword) {
        return true;
      }

      const po = String(
        row.poNumber ?? ""
      ).toLowerCase();

      const supplier = String(
        row.supplier?.name ?? ""
      ).toLowerCase();

      const barang = String(
        row.barang?.name ?? ""
      ).toLowerCase();

      const kodeBarang = String(
        row.barang?.code ?? ""
      ).toLowerCase();

      const barcode = String(
        row.barang?.barcode ?? ""
      ).toLowerCase();

      const unit = String(
        row.barang?.unit ?? ""
      ).toLowerCase();

      return (
        po.includes(keyword) ||
        supplier.includes(keyword) ||
        barang.includes(keyword) ||
        kodeBarang.includes(keyword) ||
        barcode.includes(keyword) ||
        unit.includes(keyword)
      );
    });
  }, [rows, search, statusFilter]);

  // =========================================================
  // FORMAT
  // =========================================================

  function formatNumber(value: any) {
    return Number(value ?? 0).toLocaleString(
      "id-ID"
    );
  }

  function formatPercent(value: any) {
    return Number(value ?? 0).toFixed(2);
  }

  // =========================================================
  // SUMMARY
  // =========================================================

  const totalData = rows.length;

  const totalNaik = rows.filter(
    (row) => getStatus(row) === "NAIK"
  ).length;

  const totalTurun = rows.filter(
    (row) => getStatus(row) === "TURUN"
  ).length;

  const totalTetap = rows.filter(
    (row) => getStatus(row) === "TETAP"
  ).length;

  // =========================================================
  // RESET FILTER
  // =========================================================

  function resetFilter() {
    setSearch("");
    setStatusFilter("SEMUA");
  }

  const hasFilter =
    search.trim() !== "" ||
    statusFilter !== "SEMUA";

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* ===================================================== */}
      {/* HEADER */}
      {/* ===================================================== */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <Tag size={23} />
          </div>

          <div>

            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Master Harga
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Riwayat perubahan harga pembelian barang
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
            border-[#D5E5DC]
            bg-white
            px-5
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

          <RefreshCw
            size={17}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          Refresh Data

        </button>

      </div>

      {/* ===================================================== */}
      {/* SUMMARY */}
      {/* ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* TOTAL */}

        <button
          type="button"
          onClick={() =>
            setStatusFilter("SEMUA")
          }
          className={`
            rounded-2xl
            border
            bg-white
            p-5
            text-left
            shadow-sm
            transition
            hover:shadow-md
            ${
              statusFilter === "SEMUA"
                ? "border-[#497F70] ring-2 ring-[#497F70]/10"
                : "border-[#DDE9E4]"
            }
          `}
        >

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Total Histori
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {totalData}
              </p>

            </div>

            <div className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-[#EAF3EF]
              text-[#497F70]
            ">
              <Package size={21} />
            </div>

          </div>

        </button>

        {/* NAIK */}

        <button
          type="button"
          onClick={() =>
            setStatusFilter("NAIK")
          }
          className={`
            rounded-2xl
            border
            bg-white
            p-5
            text-left
            shadow-sm
            transition
            hover:shadow-md
            ${
              statusFilter === "NAIK"
                ? "border-red-400 ring-2 ring-red-100"
                : "border-red-100"
            }
          `}
        >

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Harga Naik
              </p>

              <p className="mt-1 text-2xl font-bold text-red-600">
                {totalNaik}
              </p>

            </div>

            <div className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-red-50
              text-red-600
            ">
              <TrendingUp size={21} />
            </div>

          </div>

        </button>

        {/* TURUN */}

        <button
          type="button"
          onClick={() =>
            setStatusFilter("TURUN")
          }
          className={`
            rounded-2xl
            border
            bg-white
            p-5
            text-left
            shadow-sm
            transition
            hover:shadow-md
            ${
              statusFilter === "TURUN"
                ? "border-green-400 ring-2 ring-green-100"
                : "border-green-100"
            }
          `}
        >

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Harga Turun
              </p>

              <p className="mt-1 text-2xl font-bold text-green-600">
                {totalTurun}
              </p>

            </div>

            <div className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-green-50
              text-green-600
            ">
              <TrendingDown size={21} />
            </div>

          </div>

        </button>

        {/* TETAP */}

        <button
          type="button"
          onClick={() =>
            setStatusFilter("TETAP")
          }
          className={`
            rounded-2xl
            border
            bg-white
            p-5
            text-left
            shadow-sm
            transition
            hover:shadow-md
            ${
              statusFilter === "TETAP"
                ? "border-blue-400 ring-2 ring-blue-100"
                : "border-blue-100"
            }
          `}
        >

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Harga Tetap
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-600">
                {totalTetap}
              </p>

            </div>

            <div className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-blue-50
              text-blue-600
            ">
              <Minus size={21} />
            </div>

          </div>

        </button>

      </div>

      {/* ===================================================== */}
      {/* SEARCH + FILTER */}
      {/* ===================================================== */}

      <div className="
        mb-6
        rounded-2xl
        border
        border-[#DDE9E4]
        bg-white
        p-4
        shadow-sm
        md:p-5
      ">

        <div className="
          flex
          flex-col
          gap-4
          xl:flex-row
          xl:items-end
        ">

          {/* SEARCH */}

          <div className="w-full xl:flex-1">

            <label className="mb-2 block text-sm font-semibold text-[#35564C]">
              Pencarian
            </label>

            <div className="relative">

              <Search
                size={19}
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
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Cari PO, supplier, kode, barcode, nama barang, atau satuan..."
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
                    hover:bg-gray-100
                    hover:text-gray-600
                  "
                  title="Hapus pencarian"
                >

                  <X size={17} />

                </button>

              )}

            </div>

          </div>

          {/* STATUS */}

          <div className="w-full xl:w-64">

            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#35564C]">

              <Filter size={16} />

              Status Harga

            </label>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as HargaStatus
                )
              }
              className="
                w-full
                rounded-xl
                border
                border-[#D5E5DC]
                bg-white
                px-4
                py-3
                text-sm
                font-medium
                text-gray-700
                outline-none
                transition
                focus:border-[#497F70]
                focus:ring-2
                focus:ring-[#497F70]/10
              "
            >

              <option value="SEMUA">
                Semua Status
              </option>

              <option value="NAIK">
                Harga Naik
              </option>

              <option value="TETAP">
                Harga Tetap
              </option>

              <option value="TURUN">
                Harga Turun
              </option>

            </select>

          </div>

          {/* RESET */}

          {hasFilter && (

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
                border-red-200
                bg-red-50
                px-4
                py-3
                text-sm
                font-semibold
                text-red-600
                transition
                hover:bg-red-100
                xl:w-auto
              "
            >

              <X size={17} />

              Reset Filter

            </button>

          )}

        </div>

        {/* HASIL FILTER */}

        <div className="mt-4 flex flex-col gap-2 border-t border-[#EDF2EF] pt-4 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">

          <div>

            Menampilkan{" "}

            <span className="font-bold text-[#18352D]">
              {filteredRows.length}
            </span>{" "}

            dari{" "}

            <span className="font-bold text-[#18352D]">
              {rows.length}
            </span>{" "}

            data

          </div>

          {statusFilter !== "SEMUA" && (

            <div className="flex items-center gap-2">

              <span className="text-gray-400">
                Filter:
              </span>

              {statusFilter === "NAIK" && (
                <span className="
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
                ">
                  <TrendingUp size={13} />
                  Naik
                </span>
              )}

              {statusFilter === "TURUN" && (
                <span className="
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-full
                  bg-green-50
                  px-3
                  py-1
                  text-xs
                  font-semibold
                  text-green-600
                ">
                  <TrendingDown size={13} />
                  Turun
                </span>
              )}

              {statusFilter === "TETAP" && (
                <span className="
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-full
                  bg-blue-50
                  px-3
                  py-1
                  text-xs
                  font-semibold
                  text-blue-600
                ">
                  <Minus size={13} />
                  Tetap
                </span>
              )}

            </div>

          )}

        </div>

      </div>

      {/* ===================================================== */}
      {/* TABLE */}
      {/* ===================================================== */}

      <div className="
        overflow-hidden
        rounded-2xl
        border
        border-[#DDE9E4]
        bg-white
        shadow-sm
      ">

        <div className="overflow-x-auto">

          <table className="min-w-[1350px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="whitespace-nowrap px-5 py-4 text-left font-semibold text-[#35564C]">
                  Tanggal
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-left font-semibold text-[#35564C]">
                  PO
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-left font-semibold text-[#35564C]">
                  Supplier
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-left font-semibold text-[#35564C]">
                  Barang
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-center font-semibold text-[#35564C]">
                  Satuan
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-right font-semibold text-[#35564C]">
                  Harga Lama
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-right font-semibold text-[#35564C]">
                  Harga Baru
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-right font-semibold text-[#35564C]">
                  Selisih
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-right font-semibold text-[#35564C]">
                  %
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-center font-semibold text-[#35564C]">
                  Status
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-right font-semibold text-[#35564C]">
                  Qty
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-right font-semibold text-[#35564C]">
                  Total
                </th>

              </tr>

            </thead>

            <tbody>

              {/* LOADING */}

              {loading && (

                <tr>

                  <td
                    colSpan={12}
                    className="px-5 py-14 text-center"
                  >

                    <div className="
                      flex
                      flex-col
                      items-center
                      gap-3
                      text-gray-500
                    ">

                      <RefreshCw
                        size={25}
                        className="animate-spin text-[#497F70]"
                      />

                      <span>
                        Memuat data master harga...
                      </span>

                    </div>

                  </td>

                </tr>

              )}

              {/* EMPTY */}

              {!loading &&
                filteredRows.length === 0 && (

                  <tr>

                    <td
                      colSpan={12}
                      className="px-5 py-14 text-center"
                    >

                      <div className="
                        flex
                        flex-col
                        items-center
                      ">

                        <div className="
                          mb-3
                          flex
                          h-14
                          w-14
                          items-center
                          justify-center
                          rounded-full
                          bg-[#EAF3EF]
                          text-[#497F70]
                        ">

                          <Search size={25} />

                        </div>

                        <p className="
                          font-semibold
                          text-gray-700
                        ">

                          {hasFilter
                            ? "Data tidak ditemukan"
                            : "Belum ada histori harga"}

                        </p>

                        <p className="
                          mt-1
                          text-sm
                          text-gray-400
                        ">

                          {hasFilter
                            ? "Coba ubah pencarian atau filter status."
                            : "Histori perubahan harga akan muncul di sini."}

                        </p>

                        {hasFilter && (

                          <button
                            type="button"
                            onClick={resetFilter}
                            className="
                              mt-4
                              rounded-xl
                              bg-[#497F70]
                              px-4
                              py-2.5
                              text-sm
                              font-semibold
                              text-white
                              transition
                              hover:bg-[#3D6D60]
                            "
                          >
                            Reset Filter
                          </button>

                        )}

                      </div>

                    </td>

                  </tr>

                )}

              {/* DATA */}

              {!loading &&
                filteredRows.map(
                  (row: any) => {

                    const hargaLama =
                      Number(
                        row.hargaLama ?? 0
                      );

                    const hargaBaru =
                      Number(
                        row.hargaBaru ?? 0
                      );

                    const selisih =
                      Number(
                        row.selisihHarga ?? 0
                      );

                    const status =
                      getStatus(row);

                    const naik =
                      status === "NAIK";

                    const turun =
                      status === "TURUN";

                    return (

                      <tr
                        key={row.id}
                        className="
                          border-b
                          border-[#EDF2EF]
                          transition
                          hover:bg-[#FAFCFB]
                        "
                      >

                        {/* TANGGAL */}

                        <td className="
                          whitespace-nowrap
                          px-5
                          py-4
                          text-gray-600
                        ">

                          {row.receiveDate
                            ? new Date(
                                row.receiveDate
                              ).toLocaleDateString(
                                "id-ID"
                              )
                            : "-"}

                        </td>

                        {/* PO */}

                        <td className="
                          whitespace-nowrap
                          px-5
                          py-4
                          font-semibold
                          text-[#18352D]
                        ">

                          {row.poNumber || "-"}

                        </td>

                        {/* SUPPLIER */}

                        <td className="
                          px-5
                          py-4
                          text-gray-600
                        ">

                          {row.supplier?.name ||
                            "-"}

                        </td>

                        {/* BARANG */}

                        <td className="px-5 py-4">

                          <div className="
                            font-semibold
                            text-gray-700
                          ">

                            {row.barang?.name ||
                              "-"}

                          </div>

                          {row.barang?.code && (

                            <div className="
                              mt-1
                              text-xs
                              text-gray-400
                            ">

                              {row.barang.code}

                              {row.barang?.barcode && (
                                <>
                                  {" • "}
                                  {
                                    row.barang
                                      .barcode
                                  }
                                </>
                              )}

                            </div>

                          )}

                        </td>

                        {/* SATUAN */}

                        <td className="
                          whitespace-nowrap
                          px-5
                          py-4
                          text-center
                          font-medium
                          text-[#35564C]
                        ">

                          {row.barang?.unit ||
                            "-"}

                        </td>

                        {/* HARGA LAMA */}

                        <td className="
                          whitespace-nowrap
                          px-5
                          py-4
                          text-right
                          text-gray-500
                        ">

                          Rp{" "}
                          {formatNumber(
                            hargaLama
                          )}

                        </td>

                        {/* HARGA BARU */}

                        <td className="
                          whitespace-nowrap
                          px-5
                          py-4
                          text-right
                          font-semibold
                          text-[#18352D]
                        ">

                          Rp{" "}
                          {formatNumber(
                            hargaBaru
                          )}

                        </td>

                        {/* SELISIH */}

                        <td
                          className={`
                            whitespace-nowrap
                            px-5
                            py-4
                            text-right
                            font-semibold
                            ${
                              naik
                                ? "text-red-600"
                                : turun
                                ? "text-green-600"
                                : "text-gray-500"
                            }
                          `}
                        >

                          {naik
                            ? "+"
                            : ""}

                          Rp{" "}
                          {formatNumber(
                            selisih
                          )}

                        </td>

                        {/* PERSEN */}

                        <td className="
                          whitespace-nowrap
                          px-5
                          py-4
                          text-right
                          text-gray-600
                        ">

                          {formatPercent(
                            row.persenNaik
                          )}
                          %

                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-4">

                          <div className="flex justify-center">

                            {naik ? (

                              <span className="
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-full
                                bg-red-50
                                px-3
                                py-1.5
                                text-xs
                                font-semibold
                                text-red-600
                              ">

                                <TrendingUp
                                  size={13}
                                />

                                Naik

                              </span>

                            ) : turun ? (

                              <span className="
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-full
                                bg-green-50
                                px-3
                                py-1.5
                                text-xs
                                font-semibold
                                text-green-600
                              ">

                                <TrendingDown
                                  size={13}
                                />

                                Turun

                              </span>

                            ) : (

                              <span className="
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-full
                                bg-blue-50
                                px-3
                                py-1.5
                                text-xs
                                font-semibold
                                text-blue-600
                              ">

                                <Minus
                                  size={13}
                                />

                                Tetap

                              </span>

                            )}

                          </div>

                        </td>

                        {/* QTY */}

                        <td className="
                          whitespace-nowrap
                          px-5
                          py-4
                          text-right
                          text-gray-600
                        ">

                          {formatNumber(
                            row.qty
                          )}

                        </td>

                        {/* TOTAL */}

                        <td className="
                          whitespace-nowrap
                          px-5
                          py-4
                          text-right
                          font-semibold
                          text-[#18352D]
                        ">

                          Rp{" "}
                          {formatNumber(
                            row.total
                          )}

                        </td>

                      </tr>

                    );
                  }
                )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}