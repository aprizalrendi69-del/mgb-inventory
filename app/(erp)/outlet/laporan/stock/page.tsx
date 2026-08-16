"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Search,
  RefreshCw,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Package,
  Wallet,
} from "lucide-react";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Barang = {
  id: number;
  code: string;
  name: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
};

type OutletStock = {
  id: number;
  outletId: number;
  barangId: number;
  stock: number;
  minimumStock: number;
  averageCost: number;
  updatedAt: string;
  outlet: Outlet;
  barang: Barang;
};

export default function OutletStockReportPage() {
  const [data, setData] = useState<OutletStock[]>([]);
  const [outlet, setOutlet] = useState<Outlet | null>(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function loadData() {
    try {
      setLoading(true);

      // =================================================
      // USER LOGIN
      // =================================================

      const meRes = await fetch("/api/me", {
        cache: "no-store",
      });

      const meJson = await meRes.json();

      if (!meRes.ok || !meJson.success) {
        throw new Error(
          meJson.message ||
            "Gagal mengambil user login"
        );
      }

      const loginUser = meJson.user;

      if (
        !loginUser?.outletId ||
        !loginUser?.outlet
      ) {
        setOutlet(null);
        setData([]);
        return;
      }

      const loginOutlet: Outlet = {
        id: Number(loginUser.outlet.id),
        code: loginUser.outlet.code,
        name: loginUser.outlet.name,
      };

      setOutlet(loginOutlet);

      // =================================================
      // STOCK OUTLET
      // =================================================

      const res = await fetch(
        `/api/outlet/stock?outletId=${loginOutlet.id}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil stock outlet"
        );
      }

      const stocks: OutletStock[] =
        Array.isArray(json.data)
          ? json.data
          : [];

      // =================================================
      // FILTER KETAT
      // =================================================

      const outletStocks = stocks.filter(
        (stock) =>
          Number(stock.outletId) ===
          loginOutlet.id
      );

      setData(outletStocks);
    } catch (error) {
      console.error(
        "LOAD OUTLET STOCK REPORT ERROR:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // =====================================================
  // SEARCH
  // =====================================================

  const filteredData = useMemo(() => {
    const keyword =
      search.toLowerCase().trim();

    if (!keyword) {
      return data;
    }

    return data.filter((item) => {
      const text = [
        item.barang?.code,
        item.barang?.name,
        item.barang?.unit,
        item.outlet?.code,
        item.outlet?.name,
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [data, search]);

  // =====================================================
  // FORMAT
  // =====================================================

  function formatNumber(value: number) {
    return Number(value || 0).toLocaleString(
      "id-ID"
    );
  }

  function formatRupiah(value: number) {
    return `Rp ${formatNumber(value)}`;
  }

  // =====================================================
  // STOCK STATUS
  // =====================================================

  function getStockStatus(item: OutletStock) {
    const stock = Number(item.stock || 0);
    const minimum = Number(
      item.minimumStock || 0
    );

    if (stock <= 0) {
      return "HABIS";
    }

    if (stock <= minimum) {
      return "MINIMUM";
    }

    return "AMAN";
  }

  function getStatusClass(item: OutletStock) {
    const status = getStockStatus(item);

    switch (status) {
      case "HABIS":
        return "bg-[#FDECEC] text-[#C84B4B]";

      case "MINIMUM":
        return "bg-[#FFF4DD] text-[#9A6A18]";

      default:
        return "bg-[#E8F4EC] text-[#2F7A4F]";
    }
  }

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalBarang =
    filteredData.length;

  const totalQty =
    filteredData.reduce(
      (sum, item) =>
        sum + Number(item.stock || 0),
      0
    );

  const totalNilai =
    filteredData.reduce(
      (sum, item) =>
        sum +
        Number(item.stock || 0) *
          Number(item.averageCost || 0),
      0
    );

  const totalMinimum =
    filteredData.reduce(
      (sum, item) =>
        sum +
        Number(item.minimumStock || 0),
      0
    );

  const totalHabis =
    filteredData.filter(
      (item) =>
        getStockStatus(item) === "HABIS"
    ).length;

  const totalMinimumStatus =
    filteredData.filter(
      (item) =>
        getStockStatus(item) === "MINIMUM"
    ).length;

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
            <Boxes size={23} />
          </div>

          <div>

            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Laporan Stock Outlet
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Laporan persediaan barang outlet
            </p>

            {outlet && (
              <p className="mt-1 text-xs font-semibold text-[#497F70]">
                Outlet: {outlet.code} -{" "}
                {outlet.name}
              </p>
            )}

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

      {/* =================================================
          SUMMARY
      ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

        {/* TOTAL BARANG */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Total Barang
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(totalBarang)}
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Package size={19} />
            </div>

          </div>

        </div>

        {/* TOTAL QTY */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Total Stock
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(totalQty)}
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Boxes size={19} />
            </div>

          </div>

        </div>

        {/* NILAI STOCK */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Nilai Persediaan
              </p>

              <p className="mt-2 text-lg font-bold text-[#18352D]">
                {formatRupiah(totalNilai)}
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Wallet size={19} />
            </div>

          </div>

        </div>

        {/* STATUS */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Perlu Perhatian
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalHabis +
                    totalMinimumStatus
                )}
              </p>

              <p className="mt-1 text-[11px] text-gray-400">
                Habis: {totalHabis} · Minimum:{" "}
                {totalMinimumStatus}
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF4DD] text-[#9A6A18]">
              <AlertTriangle size={19} />
            </div>

          </div>

        </div>

      </div>

      {/* =================================================
          TABLE
      ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        {/* TOOLBAR */}

        <div className="flex flex-col gap-4 border-b border-[#E5ECE9] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">

          <div>

            <h2 className="font-semibold text-[#18352D]">
              Stock Barang Outlet
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Hanya stock outlet yang sedang
              login
            </p>

          </div>

          <div className="relative w-full md:w-80">

            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Cari kode atau nama barang..."
              className="
                w-full
                rounded-xl
                border
                border-[#D5E5DC]
                bg-[#FAFCFB]
                py-2.5
                pl-9
                pr-4
                text-sm
                outline-none
                focus:border-[#497F70]
              "
            />

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="min-w-[1200px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Kode
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Barang
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Satuan
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Stock
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Minimum
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Average Cost
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Nilai Stock
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
                    className="px-5 py-12 text-center"
                  >

                    <RefreshCw
                      size={20}
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
                    className="px-5 py-12 text-center text-sm text-gray-400"
                  >

                    Belum ada stock barang
                    untuk outlet ini

                  </td>

                </tr>

              ) : (

                filteredData.map((item) => {

                  const stock =
                    Number(item.stock || 0);

                  const minimum =
                    Number(
                      item.minimumStock || 0
                    );

                  const averageCost =
                    Number(
                      item.averageCost || 0
                    );

                  const nilaiStock =
                    stock * averageCost;

                  const status =
                    getStockStatus(item);

                  return (
                    <tr
                      key={item.id}
                      className="
                        border-b
                        border-[#EDF2EF]
                        hover:bg-[#FAFCFB]
                      "
                    >

                      {/* KODE */}

                      <td className="px-5 py-4 align-top">

                        <span className="font-semibold text-[#35564C]">
                          {item.barang?.code}
                        </span>

                      </td>

                      {/* BARANG */}

                      <td className="px-5 py-4 align-top">

                        <div className="font-semibold text-[#18352D]">
                          {item.barang?.name}
                        </div>

                      </td>

                      {/* SATUAN */}

                      <td className="px-5 py-4 text-center align-top">

                        <span className="text-gray-500">
                          {item.barang?.unit ||
                            "-"}
                        </span>

                      </td>

                      {/* STOCK */}

                      <td className="px-5 py-4 text-right align-top">

                        <span className="font-bold text-[#18352D]">
                          {formatNumber(stock)}
                        </span>

                      </td>

                      {/* MINIMUM */}

                      <td className="px-5 py-4 text-right align-top">

                        <span className="text-gray-500">
                          {formatNumber(minimum)}
                        </span>

                      </td>

                      {/* AVERAGE COST */}

                      <td className="px-5 py-4 text-right align-top whitespace-nowrap">

                        <span className="font-medium text-[#35564C]">
                          {formatRupiah(
                            averageCost
                          )}
                        </span>

                      </td>

                      {/* NILAI STOCK */}

                      <td className="px-5 py-4 text-right align-top whitespace-nowrap">

                        <span className="font-semibold text-[#18352D]">
                          {formatRupiah(
                            nilaiStock
                          )}
                        </span>

                      </td>

                      {/* STATUS */}

                      <td className="px-5 py-4 text-center align-top">

                        <span
                          className={`
                            inline-flex
                            items-center
                            gap-1.5
                            rounded-full
                            px-3
                            py-1
                            text-xs
                            font-semibold
                            ${getStatusClass(item)}
                          `}
                        >

                          {status ===
                            "AMAN" && (
                            <CheckCircle2
                              size={13}
                            />
                          )}

                          {status !==
                            "AMAN" && (
                            <AlertTriangle
                              size={13}
                            />
                          )}

                          {status}

                        </span>

                      </td>

                    </tr>
                  );
                })

              )}

            </tbody>

          </table>

        </div>

        {/* FOOTER TOTAL */}

        {!loading &&
          filteredData.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-[#E5ECE9] bg-[#FAFCFB] px-5 py-4 md:flex-row md:items-center md:justify-between">

              <p className="text-xs text-gray-500">
                Menampilkan{" "}
                <span className="font-semibold text-[#35564C]">
                  {formatNumber(
                    filteredData.length
                  )}
                </span>{" "}
                barang
              </p>

              <div className="flex items-center gap-6">

                <div className="text-right">

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Total Qty
                  </p>

                  <p className="text-sm font-bold text-[#18352D]">
                    {formatNumber(totalQty)}
                  </p>

                </div>

                <div className="text-right">

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Total Nilai
                  </p>

                  <p className="text-sm font-bold text-[#18352D]">
                    {formatRupiah(totalNilai)}
                  </p>

                </div>

              </div>

            </div>
          )}

      </div>

    </div>
  );
}