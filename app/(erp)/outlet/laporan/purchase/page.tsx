"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  RefreshCw,
  Search,
  CalendarDays,
  ShoppingCart,
} from "lucide-react";

type Supplier = {
  id: number;
  code?: string;
  name: string;
};

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Purchase = {
  id: number;
  number: string;
  purchaseDate?: string;
  status?: string;
  total?: number;

  supplier?: Supplier;

  outlet?: Outlet;

  items?: any[];
};

export default function LaporanPurchaseOutletPage() {
  const [data, setData] = useState<Purchase[]>([]);

  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const [tanggalAwal, setTanggalAwal] =
    useState("");

  const [tanggalAkhir, setTanggalAkhir] =
    useState("");

  // =====================================================
  // LOAD DATA PURCHASE OUTLET
  // =====================================================

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch(
        "/api/outlet/purchase",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error(
          "LOAD PURCHASE OUTLET ERROR:",
          json
        );

        setData([]);

        return;
      }

      const result = Array.isArray(json)
        ? json
        : Array.isArray(json.data)
        ? json.data
        : [];

      setData(result);
    } catch (error) {
      console.error(
        "LOAD LAPORAN PURCHASE OUTLET ERROR:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    loadData();
  }, []);

  // =====================================================
  // FILTER DATA
  // =====================================================

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const keyword = search
        .toLowerCase()
        .trim();

      const text = `
        ${item.number ?? ""}
        ${item.supplier?.code ?? ""}
        ${item.supplier?.name ?? ""}
        ${item.outlet?.code ?? ""}
        ${item.outlet?.name ?? ""}
      `.toLowerCase();

      // SEARCH
      if (
        keyword &&
        !text.includes(keyword)
      ) {
        return false;
      }

      // STATUS
      if (
        status &&
        String(item.status ?? "")
          .toUpperCase() !==
          status.toUpperCase()
      ) {
        return false;
      }

      // =================================================
      // FILTER TANGGAL
      // =================================================

      if (
        tanggalAwal ||
        tanggalAkhir
      ) {
        if (!item.purchaseDate) {
          return false;
        }

        const tanggal = new Date(
          item.purchaseDate
        );

        if (
          Number.isNaN(
            tanggal.getTime()
          )
        ) {
          return false;
        }

        // TANGGAL AWAL
        if (tanggalAwal) {
          const awal = new Date(
            `${tanggalAwal}T00:00:00`
          );

          if (tanggal < awal) {
            return false;
          }
        }

        // TANGGAL AKHIR
        if (tanggalAkhir) {
          const akhir = new Date(
            `${tanggalAkhir}T23:59:59`
          );

          if (tanggal > akhir) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    data,
    search,
    status,
    tanggalAwal,
    tanggalAkhir,
  ]);

  // =====================================================
  // TOTAL
  // =====================================================

  const totalPO =
    filteredData.length;

  const totalNominal =
    filteredData.reduce(
      (total, item) =>
        total +
        Number(
          item.total ?? 0
        ),
      0
    );

  // =====================================================
  // FORMAT NUMBER
  // =====================================================

  function formatNumber(
    value: any
  ) {
    return Number(
      value ?? 0
    ).toLocaleString("id-ID");
  }

  // =====================================================
  // FORMAT RUPIAH
  // =====================================================

  function formatRupiah(
    value: any
  ) {
    return `Rp ${formatNumber(
      value
    )}`;
  }

  // =====================================================
  // FORMAT DATE
  // =====================================================

  function formatDate(
    value?: string
  ) {
    if (!value) {
      return "-";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
    }

    return date.toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  // =====================================================
  // STATUS CLASS
  // =====================================================

  function statusClass(
    value?: string
  ) {
    const status =
      String(
        value ?? ""
      ).toUpperCase();

    if (
      status ===
      "APPROVED"
    ) {
      return "bg-green-50 text-green-700";
    }

    if (
      status ===
      "RECEIVED"
    ) {
      return "bg-blue-50 text-blue-700";
    }

    if (
      status ===
      "CANCELLED"
    ) {
      return "bg-red-50 text-red-700";
    }

    if (
      status ===
      "REJECTED"
    ) {
      return "bg-red-50 text-red-700";
    }

    return "bg-yellow-50 text-yellow-700";
  }

  // =====================================================
  // RESET FILTER
  // =====================================================

  function resetFilter() {
    setSearch("");
    setStatus("");
    setTanggalAwal("");
    setTanggalAkhir("");
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <FileText size={23} />
          </div>

          <div>

            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Laporan Purchase Order Outlet
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Riwayat Purchase Order yang dibuat oleh outlet
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
            disabled:opacity-50
          "
        >

          <RefreshCw
            size={16}
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

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">

        {/* TOTAL PO */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">

              <ShoppingCart
                size={19}
              />

            </div>

            <div>

              <p className="text-sm text-gray-500">
                Total Purchase Order
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalPO
                )}
              </p>

            </div>

          </div>

        </div>

        {/* TOTAL NOMINAL */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">

              <FileText
                size={19}
              />

            </div>

            <div>

              <p className="text-sm text-gray-500">
                Total Nilai Purchase
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {formatRupiah(
                  totalNominal
                )}
              </p>

            </div>

          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* FILTER */}
      {/* ================================================= */}

      <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm md:p-6">

        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">

              <Search
                size={19}
              />

            </div>

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Filter Laporan
              </h2>

              <p className="text-xs text-gray-500">
                Cari dan filter Purchase Order outlet
              </p>

            </div>

          </div>

          {(search ||
            status ||
            tanggalAwal ||
            tanggalAkhir) && (
            <button
              type="button"
              onClick={resetFilter}
              className="text-sm font-semibold text-[#497F70] hover:underline"
            >
              Reset Filter
            </button>
          )}

        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">

          {/* SEARCH */}

          <div className="lg:col-span-2">

            <label className="mb-2 block text-sm font-semibold text-[#35564C]">
              Cari
            </label>

            <div className="relative">

              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Nomor PO / supplier / outlet..."
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  py-3
                  pl-10
                  pr-4
                  text-sm
                  outline-none
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />

            </div>

          </div>

          {/* STATUS */}

          <div>

            <label className="mb-2 block text-sm font-semibold text-[#35564C]">
              Status
            </label>

            <select
              value={status}
              onChange={(e) =>
                setStatus(
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
                outline-none
                focus:border-[#497F70]
              "
            >

              <option value="">
                Semua Status
              </option>

              <option value="DRAFT">
                DRAFT
              </option>

              <option value="APPROVED">
                APPROVED
              </option>

              <option value="RECEIVED">
                RECEIVED
              </option>

              <option value="CANCELLED">
                CANCELLED
              </option>

              <option value="REJECTED">
                REJECTED
              </option>

            </select>

          </div>

          {/* TANGGAL AWAL */}

          <div>

            <label className="mb-2 block text-sm font-semibold text-[#35564C]">
              Dari
            </label>

            <div className="relative">

              <CalendarDays
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="date"
                value={
                  tanggalAwal
                }
                onChange={(e) =>
                  setTanggalAwal(
                    e.target.value
                  )
                }
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  py-3
                  pl-9
                  pr-3
                  text-sm
                  outline-none
                  focus:border-[#497F70]
                "
              />

            </div>

          </div>

          {/* TANGGAL AKHIR */}

          <div>

            <label className="mb-2 block text-sm font-semibold text-[#35564C]">
              Sampai
            </label>

            <div className="relative">

              <CalendarDays
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="date"
                value={
                  tanggalAkhir
                }
                onChange={(e) =>
                  setTanggalAkhir(
                    e.target.value
                  )
                }
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  py-3
                  pl-9
                  pr-3
                  text-sm
                  outline-none
                  focus:border-[#497F70]
                "
              />

            </div>

          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* TABLE */}
      {/* ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        {/* TABLE HEADER */}

        <div className="border-b border-[#E5ECE9] px-5 py-4 md:px-6">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">

              <FileText
                size={19}
              />

            </div>

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Data Purchase Order Outlet
              </h2>

              <p className="text-xs text-gray-500">
                {filteredData.length} data ditemukan
              </p>

            </div>

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="min-w-[1100px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Nomor PO
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Tanggal
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Supplier
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Outlet
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Status
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Total
                </th>

              </tr>

            </thead>

            <tbody>

              {/* LOADING */}

              {loading ? (
                <tr>

                  <td
                    colSpan={7}
                    className="px-5 py-14 text-center"
                  >

                    <RefreshCw
                      size={20}
                      className="mx-auto mb-2 animate-spin text-[#497F70]"
                    />

                    <p className="text-sm text-gray-500">
                      Memuat laporan...
                    </p>

                  </td>

                </tr>
              ) : filteredData.length ===
                0 ? (

                /* EMPTY */

                <tr>

                  <td
                    colSpan={7}
                    className="px-5 py-14 text-center"
                  >

                    <FileText
                      size={30}
                      className="mx-auto mb-2 text-gray-300"
                    />

                    <p className="font-semibold text-gray-600">
                      Belum ada data
                    </p>

                    <p className="mt-1 text-sm text-gray-400">
                      Purchase Order outlet belum tersedia.
                    </p>

                  </td>

                </tr>
              ) : (

                /* DATA */

                filteredData.map(
                  (
                    item,
                    index
                  ) => (

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

                      <td className="px-5 py-4 text-gray-500">
                        {index + 1}
                      </td>

                      {/* NOMOR PO */}

                      <td className="px-5 py-4">

                        <span className="font-semibold text-[#18352D]">
                          {item.number ||
                            "-"}
                        </span>

                      </td>

                      {/* TANGGAL */}

                      <td className="px-5 py-4 text-gray-600">

                        {formatDate(
                          item.purchaseDate
                        )}

                      </td>

                      {/* SUPPLIER */}

                      <td className="px-5 py-4">

                        <div className="font-medium text-[#18352D]">

                          {item
                            .supplier
                            ?.name ||
                            "-"}

                        </div>

                        {item
                          .supplier
                          ?.code && (
                          <div className="text-xs text-gray-400">
                            {
                              item
                                .supplier
                                .code
                            }
                          </div>
                        )}

                      </td>

                      {/* OUTLET */}

                      <td className="px-5 py-4">

                        <div className="font-medium text-[#18352D]">

                          {item
                            .outlet
                            ?.name ||
                            "-"}

                        </div>

                        {item
                          .outlet
                          ?.code && (
                          <div className="text-xs text-gray-400">
                            {
                              item
                                .outlet
                                .code
                            }
                          </div>
                        )}

                      </td>

                      {/* STATUS */}

                      <td className="px-5 py-4 text-center">

                        <span
                          className={`
                            inline-flex
                            rounded-full
                            px-3
                            py-1
                            text-xs
                            font-semibold
                            ${statusClass(
                              item.status
                            )}
                          `}
                        >
                          {item.status ||
                            "DRAFT"}
                        </span>

                      </td>

                      {/* TOTAL */}

                      <td className="px-5 py-4 text-right font-semibold text-[#18352D]">

                        {formatRupiah(
                          item.total
                        )}

                      </td>

                    </tr>

                  )
                )
              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}