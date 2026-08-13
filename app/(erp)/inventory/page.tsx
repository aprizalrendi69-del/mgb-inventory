"use client";

import { useEffect, useState } from "react";
import {
  Boxes,
  Search,
  RefreshCw,
  Package,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export default function InventoryPage() {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch("/api/inventory", {
        cache: "no-store",
      });

      const result = await res.json();

      if (result.success) {
        setData(result.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error("LOAD INVENTORY ERROR:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // =====================================================
  // FILTER
  // =====================================================

  const filteredData = data.filter((item: any) => {
    const keyword = search.toLowerCase();

    const matchesSearch =
      String(item.name ?? "")
        .toLowerCase()
        .includes(keyword) ||
      String(item.code ?? "")
        .toLowerCase()
        .includes(keyword);

    const isLowStock =
      Number(item.stock ?? 0) <=
      Number(item.minimumStock ?? 0);

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "LOW" && isLowStock) ||
      (statusFilter === "SAFE" && !isLowStock);

    return matchesSearch && matchesStatus;
  });

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalItem = data.length;

  const totalLowStock = data.filter(
    (item: any) =>
      Number(item.stock ?? 0) <=
      Number(item.minimumStock ?? 0)
  ).length;

  const totalSafe = data.filter(
    (item: any) =>
      Number(item.stock ?? 0) >
      Number(item.minimumStock ?? 0)
  ).length;

  return (
    <div className="min-h-full bg-[#F8FBF9] p-6 md:p-8">

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
              bg-[#EAF3EF]
              text-[#497F70]
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
              Inventory Stock
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Monitoring stok inventory perusahaan
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
            className={loading ? "animate-spin" : ""}
          />

          Refresh
        </button>

      </div>

      {/* ================================================= */}
      {/* SUMMARY */}
      {/* ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* TOTAL */}

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

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Total Item
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {totalItem}
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
              <Package size={21} />
            </div>

          </div>

        </div>

        {/* AMAN */}

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

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Stock Aman
              </p>

              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {totalSafe}
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
                bg-emerald-50
                text-emerald-600
              "
            >
              <CheckCircle2 size={21} />
            </div>

          </div>

        </div>

        {/* LOW STOCK */}

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

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Stock Menipis
              </p>

              <p className="mt-1 text-2xl font-bold text-red-600">
                {totalLowStock}
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
              <AlertTriangle size={21} />
            </div>

          </div>

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

        {/* HEADER */}

        <div
          className="
            border-b
            border-[#E5ECE9]
            px-5
            py-4
            md:px-6
          "
        >

          <div className="flex items-center gap-3">

            <div
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                bg-[#EAF3EF]
                text-[#497F70]
              "
            >
              <Boxes size={19} />
            </div>

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Daftar Inventory
              </h2>

              <p className="mt-0.5 text-xs text-gray-500">
                Monitor jumlah stok dan kondisi persediaan
              </p>

            </div>

          </div>

        </div>

        {/* FILTER */}

        <div
          className="
            flex
            flex-col
            gap-3
            border-b
            border-[#E5ECE9]
            bg-[#FAFCFB]
            px-5
            py-4
            md:flex-row
            md:items-center
            md:px-6
          "
        >

          {/* SEARCH */}

          <div className="relative flex-1">

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
              placeholder="Cari kode atau nama barang..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              className="
                w-full
                rounded-xl
                border
                border-[#DDE9E4]
                bg-white
                py-2.5
                pl-10
                pr-4
                text-sm
                outline-none
                transition
                focus:border-[#497F70]
                focus:ring-2
                focus:ring-[#497F70]/10
              "
            />

          </div>

          {/* STATUS */}

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
            className="
              rounded-xl
              border
              border-[#DDE9E4]
              bg-white
              px-4
              py-2.5
              text-sm
              font-medium
              text-[#35564C]
              outline-none
              transition
              focus:border-[#497F70]
              focus:ring-2
              focus:ring-[#497F70]/10
            "
          >

            <option value="ALL">
              Semua Status
            </option>

            <option value="SAFE">
              Stock Aman
            </option>

            <option value="LOW">
              Stock Menipis
            </option>

          </select>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1100px]">

            <thead>

              <tr className="border-b border-[#E5ECE9] bg-[#F5F8F6]">

                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  No
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Kode
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Nama Barang
                </th>

                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Satuan
                </th>

                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Gudang
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Stock
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Available
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Reserved
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Min Stock
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Average Cost
                </th>

                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {loading && data.length === 0 ? (

                <tr>

                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <RefreshCw
                        size={25}
                        className="animate-spin text-[#497F70]"
                      />

                      <p className="mt-3 text-sm text-gray-500">
                        Memuat inventory...
                      </p>

                    </div>

                  </td>

                </tr>

              ) : filteredData.length === 0 ? (

                <tr>

                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <div
                        className="
                          flex
                          h-14
                          w-14
                          items-center
                          justify-center
                          rounded-2xl
                          bg-[#EAF3EF]
                          text-[#497F70]
                        "
                      >
                        <Boxes size={27} />
                      </div>

                      <h3 className="mt-4 font-semibold text-gray-700">
                        Tidak ada data inventory
                      </h3>

                      <p className="mt-1 text-sm text-gray-400">
                        Coba ubah kata pencarian atau filter status.
                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                filteredData.map(
                  (item: any, index: number) => {

                    const stock =
                      Number(item.stock ?? 0);

                    const minimumStock =
                      Number(
                        item.minimumStock ?? 0
                      );

                    const isLowStock =
                      stock <= minimumStock;

                    return (
                      <tr
                        key={item.id}
                        className="
                          border-b
                          border-[#EEF2F0]
                          transition
                          hover:bg-[#FAFCFB]
                        "
                      >

                        <td className="px-4 py-3 text-center text-sm text-gray-500">
                          {index + 1}
                        </td>

                        <td className="px-4 py-3 text-sm font-medium text-[#35564C]">
                          {item.code}
                        </td>

                        <td className="px-4 py-3 text-sm font-semibold text-[#18352D]">
                          {item.name}
                        </td>

                        <td className="px-4 py-3 text-center text-sm text-gray-600">
                          {item.unit || "-"}
                        </td>

                        <td className="px-4 py-3 text-center text-sm text-gray-600">
                          {item.warehouse || "-"}
                        </td>

                        <td className="px-4 py-3 text-right text-sm font-bold text-[#18352D]">
                          {stock.toLocaleString("id-ID")}
                        </td>

                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {Number(
                            item.availableStock ?? 0
                          ).toLocaleString("id-ID")}
                        </td>

                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {Number(
                            item.reservedStock ?? 0
                          ).toLocaleString("id-ID")}
                        </td>

                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {minimumStock.toLocaleString("id-ID")}
                        </td>

                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {Number(
                            item.averageCost ?? 0
                          ).toLocaleString("id-ID")}
                        </td>

                        <td className="px-4 py-3 text-center">

                          {isLowStock ? (

                            <span
                              className="
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
                              "
                            >
                              <AlertTriangle size={13} />

                              Stock Menipis
                            </span>

                          ) : (

                            <span
                              className="
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-full
                                bg-emerald-50
                                px-3
                                py-1.5
                                text-xs
                                font-semibold
                                text-emerald-600
                              "
                            >
                              <CheckCircle2 size={13} />

                              Aman
                            </span>

                          )}

                        </td>

                      </tr>
                    );
                  }
                )

              )}

            </tbody>

          </table>

        </div>

        {/* FOOTER */}

        <div
          className="
            flex
            flex-col
            justify-between
            gap-2
            border-t
            border-[#E5ECE9]
            bg-[#F5F8F6]
            px-5
            py-4
            text-sm
            md:flex-row
            md:items-center
            md:px-6
          "
        >

          <div className="text-gray-500">

            Menampilkan{" "}

            <span className="font-semibold text-[#18352D]">
              {filteredData.length}
            </span>{" "}

            dari{" "}

            <span className="font-semibold text-[#18352D]">
              {data.length}
            </span>{" "}

            barang

          </div>

          <div className="flex items-center gap-2 font-medium text-[#35564C]">

            <Boxes
              size={15}
              className="text-[#497F70]"
            />

            Inventory Stock

          </div>

        </div>

      </div>

    </div>
  );
}