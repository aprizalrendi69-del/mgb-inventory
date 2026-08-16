"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Package,
  Warehouse,
  ChevronDown,
} from "lucide-react";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Stock = {
  id: number;
  outletId: number;
  barangId: number;
  stock: number;
  minimumStock: number;
  averageCost: number;

  barang: {
    id: number;
    code: string;
    barcode: string | null;
    name: string;
    unit: string;
  };

  outlet: {
    id: number;
    code: string;
    name: string;
  };
};

type ApiResponse = {
  success: boolean;
  data: Stock[];
  message?: string;
};

export default function OutletStockPage() {
  const [data, setData] = useState<Stock[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);

  const [outletId, setOutletId] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingOutlet, setLoadingOutlet] =
    useState(true);

  const [error, setError] = useState("");

  // =====================================================
  // LOAD OUTLET
  // =====================================================

  async function loadOutlets() {
    try {
      setLoadingOutlet(true);

      const res = await fetch(
        "/api/outlet",
        {
          cache: "no-store",
        }
      );

      const result = await res.json();

      if (!res.ok) {
        throw new Error(
          result?.message ||
            "Gagal mengambil data outlet"
        );
      }

      const list = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
        ? result.data
        : [];

      setOutlets(list);
    } catch (error) {
      console.error(
        "LOAD OUTLET ERROR:",
        error
      );

      setOutlets([]);
    } finally {
      setLoadingOutlet(false);
    }
  }

  // =====================================================
  // LOAD STOCK
  // =====================================================

  async function loadStock(
    selectedOutlet = outletId
  ) {
    try {
      setLoading(true);
      setError("");

      const url = selectedOutlet
        ? `/api/outlet/stock?outletId=${selectedOutlet}`
        : "/api/outlet/stock";

      const res = await fetch(url, {
        cache: "no-store",
      });

      const result: ApiResponse =
        await res.json();

      if (!res.ok || !result.success) {
        throw new Error(
          result.message ||
            "Gagal mengambil stock outlet"
        );
      }

      setData(
        Array.isArray(result.data)
          ? result.data
          : []
      );
    } catch (error: any) {
      console.error(
        "LOAD OUTLET STOCK ERROR:",
        error
      );

      setData([]);

      setError(
        error?.message ||
          "Gagal mengambil stock outlet"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // INITIAL
  // =====================================================

  useEffect(() => {
    loadOutlets();
    loadStock("");
  }, []);

  // =====================================================
  // FILTER OUTLET
  // =====================================================

  function handleOutletChange(
    value: string
  ) {
    setOutletId(value);

    loadStock(value);
  }

  // =====================================================
  // FILTER SEARCH
  // =====================================================

  const filteredData = useMemo(() => {
    const keyword =
      search.toLowerCase().trim();

    if (!keyword) {
      return data;
    }

    return data.filter((item) => {
      const code =
        item.barang?.code
          ?.toLowerCase() || "";

      const name =
        item.barang?.name
          ?.toLowerCase() || "";

      const barcode =
        item.barang?.barcode
          ?.toLowerCase() || "";

      return (
        code.includes(keyword) ||
        name.includes(keyword) ||
        barcode.includes(keyword)
      );
    });
  }, [data, search]);

  // =====================================================
  // STATUS
  // =====================================================

  function getStatus(
    stock: number,
    minimum: number
  ) {
    if (stock <= 0) {
      return {
        text: "HABIS",
        className:
          "bg-red-100 text-red-700",
      };
    }

    if (stock <= minimum) {
      return {
        text: "MINIMUM",
        className:
          "bg-yellow-100 text-yellow-700",
      };
    }

    return {
      text: "AMAN",
      className:
        "bg-green-100 text-green-700",
    };
  }

  // =====================================================
  // FORMAT
  // =====================================================

  function formatNumber(value: number) {
    return Number(
      value ?? 0
    ).toLocaleString("id-ID");
  }

  // =====================================================
  // TOTAL
  // =====================================================

  const totalStock = useMemo(() => {
    return filteredData.reduce(
      (total, item) =>
        total + Number(item.stock || 0),
      0
    );
  }, [filteredData]);

  // =====================================================
  // NAMA OUTLET AKTIF
  // =====================================================

  const selectedOutlet =
    outlets.find(
      (item) =>
        String(item.id) === outletId
    );

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <Warehouse size={23} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Stock Outlet
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Daftar persediaan barang pada outlet
            </p>
          </div>

        </div>

        <button
          type="button"
          onClick={() =>
            loadStock(outletId)
          }
          disabled={loading}
          className="
            inline-flex
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-[#497F70]
            px-4
            py-2.5
            text-sm
            font-semibold
            text-white
            shadow-sm
            transition
            hover:bg-[#3D6D60]
            disabled:cursor-not-allowed
            disabled:opacity-60
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

          {loading
            ? "Memuat..."
            : "Refresh"}
        </button>

      </div>

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* =================================================
          FILTER
      ================================================= */}

      <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          {/* OUTLET */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#35564C]">
              Filter Outlet
            </label>

            <div className="relative">

              <Warehouse
                size={17}
                className="
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                "
              />

              <select
                value={outletId}
                onChange={(e) =>
                  handleOutletChange(
                    e.target.value
                  )
                }
                disabled={loadingOutlet}
                className="
                  w-full
                  appearance-none
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  px-4
                  py-3
                  pl-10
                  pr-10
                  text-sm
                  font-medium
                  text-[#35564C]
                  outline-none
                  transition
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >

                <option value="">
                  Semua Outlet
                </option>

                {outlets.map(
                  (outlet) => (
                    <option
                      key={outlet.id}
                      value={outlet.id}
                    >
                      {outlet.code} -{" "}
                      {outlet.name}
                    </option>
                  )
                )}

              </select>

              <ChevronDown
                size={17}
                className="
                  pointer-events-none
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                "
              />

            </div>
          </div>

          {/* SEARCH */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#35564C]">
              Cari Barang
            </label>

            <div className="relative">

              <Search
                size={17}
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
                placeholder="Kode, barcode, atau nama barang..."
                value={search}
                onChange={(e) =>
                  setSearch(
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
                  pr-4
                  text-sm
                  outline-none
                  transition
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />

            </div>
          </div>

        </div>

        {/* FILTER INFO */}

        <div className="mt-4 flex flex-wrap items-center gap-2">

          <span className="text-xs text-gray-500">
            Menampilkan:
          </span>

          <span className="rounded-full bg-[#EAF3EF] px-3 py-1 text-xs font-semibold text-[#497F70]">
            {selectedOutlet
              ? `${selectedOutlet.code} - ${selectedOutlet.name}`
              : "Semua Outlet"}
          </span>

          {search && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              Pencarian: "{search}"
            </span>
          )}

        </div>

      </div>

      {/* =================================================
          SUMMARY
      ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Jenis Barang
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  filteredData.length
                )}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Package size={21} />
            </div>

          </div>

        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Total Qty Stock
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {formatNumber(totalStock)}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Warehouse size={21} />
            </div>

          </div>

        </div>

      </div>

      {/* =================================================
          TABLE
      ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        <div className="flex flex-col gap-4 border-b border-[#E5ECE9] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">

          <div>
            <h2 className="font-semibold text-[#18352D]">
              Persediaan Outlet
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Stock awal dan persediaan outlet
            </p>
          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="min-w-[900px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Outlet
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Kode
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Nama Barang
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Satuan
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Stock
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Minimum
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-14 text-center"
                  >
                    <RefreshCw
                      size={22}
                      className="mx-auto mb-2 animate-spin text-[#497F70]"
                    />

                    <p className="text-sm text-gray-500">
                      Memuat stock outlet...
                    </p>
                  </td>
                </tr>

              ) : filteredData.length === 0 ? (

                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-14 text-center"
                  >

                    <Package
                      size={42}
                      className="mx-auto mb-3 text-gray-300"
                    />

                    <p className="font-medium text-gray-500">
                      Belum ada data stock outlet
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      Pastikan stock awal outlet
                      sudah dimasukkan.
                    </p>

                  </td>
                </tr>

              ) : (

                filteredData.map(
                  (item, index) => {

                    const status =
                      getStatus(
                        Number(item.stock),
                        Number(
                          item.minimumStock
                        )
                      );

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

                        <td className="px-5 py-4 text-gray-500">
                          {index + 1}
                        </td>

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {item.outlet?.name ||
                              "-"}
                          </div>

                          <div className="text-xs text-gray-400">
                            {item.outlet?.code ||
                              "-"}
                          </div>

                        </td>

                        <td className="px-5 py-4 font-semibold text-[#35564C]">
                          {item.barang?.code ||
                            "-"}
                        </td>

                        <td className="px-5 py-4">

                          <div className="font-medium text-[#18352D]">
                            {item.barang?.name ||
                              "-"}
                          </div>

                          {item.barang?.barcode && (
                            <div className="text-xs text-gray-400">
                              {item.barang.barcode}
                            </div>
                          )}

                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {item.barang?.unit ||
                            "-"}
                        </td>

                        <td className="px-5 py-4 text-right">

                          <span className="font-bold text-[#18352D]">
                            {formatNumber(
                              Number(
                                item.stock
                              )
                            )}
                          </span>

                        </td>

                        <td className="px-5 py-4 text-right text-gray-600">
                          {formatNumber(
                            Number(
                              item.minimumStock
                            )
                          )}
                        </td>

                        <td className="px-5 py-4 text-center">

                          <span
                            className={`
                              inline-flex
                              rounded-full
                              px-3
                              py-1
                              text-xs
                              font-semibold
                              ${status.className}
                            `}
                          >
                            {status.text}
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

      </div>

    </div>
  );
}