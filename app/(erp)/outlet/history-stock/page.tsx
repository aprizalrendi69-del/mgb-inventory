"use client";

import { useEffect, useMemo, useState } from "react";
import {
  History,
  RefreshCw,
  Search,
  CalendarDays,
  Building2,
} from "lucide-react";

type StockHistory = {
  id: number;
  number: string;
  outletId: number;
  outlet: string;
  trxDate: string;
  type: string;
  barangId: number;
  code: string;
  barang: string;
  unit: string;
  qtyProcessed: number;
  wasteQty: number;
  netQty: number;
  unitCost: number;
  totalCost: number;
  note?: string | null;
  user?: {
    id: number;
    fullname: string;
    username: string;
  } | null;
};

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  role?: string;
  currentOutlet?: Outlet | null;
  outlets?: Outlet[];
  transactions?: StockHistory[];
};

export default function OutletHistoryStockPage() {
  const [data, setData] = useState<StockHistory[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [role, setRole] = useState("");

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [outletId, setOutletId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function loadData() {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      /*
       * ADMIN PUSAT
       * boleh kirim filter outlet + tanggal.
       *
       * OUTLET_ADMIN
       * API akan mengabaikan filter outlet/tanggal
       * dan tetap menggunakan outlet dari session.
       */

      if (outletId) {
        params.set("outletId", outletId);
      }

      if (dateFrom) {
        params.set("from", dateFrom);
      }

      if (dateTo) {
        params.set("to", dateTo);
      }

      const query = params.toString();

      const res = await fetch(
        `/api/outlet/barang-keluar${
          query ? `?${query}` : ""
        }`,
        {
          cache: "no-store",
        }
      );

      const text = await res.text();

      let json: ApiResponse;

      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          `Response API tidak valid (${res.status})`
        );
      }

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil history barang keluar"
        );
      }

      setRole(json.role || "");

      setOutlets(
        Array.isArray(json.outlets)
          ? json.outlets
          : []
      );

      setData(
        Array.isArray(json.transactions)
          ? json.transactions
          : []
      );
    } catch (error: any) {
      console.error(
        "LOAD HISTORY STOCK OUTLET ERROR:",
        error
      );

      setData([]);

      alert(
        error?.message ||
          "Gagal mengambil history barang keluar"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [outletId, dateFrom, dateTo]);

  function formatNumber(value: number) {
    return Number(value || 0).toLocaleString(
      "id-ID",
      {
        maximumFractionDigits: 2,
      }
    );
  }

  function formatCurrency(value: number) {
    return Number(value || 0).toLocaleString(
      "id-ID",
      {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }
    );
  }

  const filteredData = useMemo(() => {
    const keyword = search
      .toLowerCase()
      .trim();

    if (!keyword) {
      return data;
    }

    return data.filter((item) => {
      return (
        item.number
          ?.toLowerCase()
          .includes(keyword) ||
        item.type
          ?.toLowerCase()
          .includes(keyword) ||
        item.code
          ?.toLowerCase()
          .includes(keyword) ||
        item.barang
          ?.toLowerCase()
          .includes(keyword) ||
        item.outlet
          ?.toLowerCase()
          .includes(keyword) ||
        item.user?.fullname
          ?.toLowerCase()
          .includes(keyword)
      );
    });
  }, [data, search]);

  const summary = useMemo(() => {
    return filteredData.reduce(
      (acc, item) => {
        acc.processed += Number(
          item.qtyProcessed || 0
        );

        acc.waste += Number(
          item.wasteQty || 0
        );

        acc.net += Number(
          item.netQty || 0
        );

        acc.cost += Number(
          item.totalCost || 0
        );

        return acc;
      },
      {
        processed: 0,
        waste: 0,
        net: 0,
        cost: 0,
      }
    );
  }, [filteredData]);

  function resetFilter() {
    setSearch("");
    setOutletId("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">
      <div className="mx-auto max-w-[1600px]">
        {/* HEADER */}
        <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
              <History size={23} />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
                History Stock Outlet
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Riwayat barang keluar dan proses bahan
                outlet
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-[#F5F8F6] disabled:opacity-50"
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

        {/* FILTER */}
        <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Search
              size={18}
              className="text-[#497F70]"
            />

            <h2 className="font-semibold text-[#18352D]">
              Filter History
            </h2>
          </div>

          <div
            className={
              role === "ADMIN"
                ? "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
                : "grid grid-cols-1 gap-4 md:grid-cols-2"
            }
          >
            {/* SEARCH */}
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Cari nomor, barang..."
                className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
              />
            </div>

            {/* OUTLET - ADMIN PUSAT SAJA */}
            {role === "ADMIN" && (
              <div className="relative">
                <Building2
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <select
                  value={outletId}
                  onChange={(e) =>
                    setOutletId(
                      e.target.value
                    )
                  }
                  className="w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#497F70]"
                >
                  <option value="">
                    Semua Outlet
                  </option>

                  {outlets.map((outlet) => (
                    <option
                      key={outlet.id}
                      value={outlet.id}
                    >
                      {outlet.code} -{" "}
                      {outlet.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* FROM */}
            {role === "ADMIN" && (
              <div className="relative">
                <CalendarDays
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) =>
                    setDateFrom(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#497F70]"
                />
              </div>
            )}

            {/* TO */}
            {role === "ADMIN" && (
              <div className="relative">
                <CalendarDays
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) =>
                    setDateTo(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#497F70]"
                />
              </div>
            )}
          </div>

          {/* RESET */}
          {(search ||
            outletId ||
            dateFrom ||
            dateTo) && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={resetFilter}
                className="rounded-xl border border-[#D5E5DC] bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-[#F5F8F6]"
              >
                Reset Filter
              </button>
            </div>
          )}
        </div>

        {/* OUTLET ADMIN INFO */}
        {role === "OUTLET_ADMIN" &&
          outlets.length === 1 && (
            <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[#EAF3EF] p-2 text-[#497F70]">
                  <Building2 size={20} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Outlet Anda
                  </p>

                  <p className="font-semibold text-[#18352D]">
                    {outlets[0].code} -{" "}
                    {outlets[0].name}
                  </p>
                </div>
              </div>
            </div>
          )}

        {/* SUMMARY */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Diproses"
            value={formatNumber(
              summary.processed
            )}
          />

          <SummaryCard
            title="Waste"
            value={formatNumber(
              summary.waste
            )}
          />

          <SummaryCard
            title="Hasil Bersih"
            value={formatNumber(
              summary.net
            )}
          />

          <SummaryCard
            title="Total Cost"
            value={formatCurrency(
              summary.cost
            )}
          />
        </div>

        {/* TABLE */}
        <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1250px] w-full text-sm">
              <thead className="bg-[#F5F8F6]">
                <tr className="border-b border-[#E5ECE9]">
                  <th className="px-5 py-4 text-left text-[#35564C]">
                    No
                  </th>

                  <th className="px-5 py-4 text-left text-[#35564C]">
                    Nomor
                  </th>

                  {role === "ADMIN" && (
                    <th className="px-5 py-4 text-left text-[#35564C]">
                      Outlet
                    </th>
                  )}

                  <th className="px-5 py-4 text-left text-[#35564C]">
                    Tanggal
                  </th>

                  <th className="px-5 py-4 text-left text-[#35564C]">
                    Barang
                  </th>

                  <th className="px-5 py-4 text-left text-[#35564C]">
                    Jenis
                  </th>

                  <th className="px-5 py-4 text-right text-[#35564C]">
                    Diproses
                  </th>

                  <th className="px-5 py-4 text-right text-[#35564C]">
                    Waste
                  </th>

                  <th className="px-5 py-4 text-right text-[#35564C]">
                    Bersih
                  </th>

                  <th className="px-5 py-4 text-right text-[#35564C]">
                    HPP
                  </th>

                  <th className="px-5 py-4 text-right text-[#35564C]">
                    Total Cost
                  </th>

                  <th className="px-5 py-4 text-left text-[#35564C]">
                    User
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={
                        role === "ADMIN"
                          ? 12
                          : 11
                      }
                      className="px-5 py-16 text-center"
                    >
                      <div className="flex items-center justify-center gap-3 text-gray-500">
                        <RefreshCw
                          size={20}
                          className="animate-spin text-[#497F70]"
                        />

                        Memuat data...
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={
                        role === "ADMIN"
                          ? 12
                          : 11
                      }
                      className="px-5 py-16 text-center"
                    >
                      <div className="flex flex-col items-center">
                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF3EF] text-[#497F70]">
                          <History size={25} />
                        </div>

                        <p className="font-semibold text-gray-700">
                          Belum ada history
                        </p>

                        <p className="mt-1 text-sm text-gray-400">
                          Belum ada transaksi
                          barang keluar outlet.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map(
                    (item, index) => (
                      <tr
                        key={item.id}
                        className="border-b border-[#EDF2EF] hover:bg-[#FAFCFB]"
                      >
                        <td className="px-5 py-4 text-gray-500">
                          {index + 1}
                        </td>

                        <td className="px-5 py-4 font-semibold text-[#18352D]">
                          {item.number}
                        </td>

                        {role === "ADMIN" && (
                          <td className="px-5 py-4">
                            <div className="font-semibold text-[#18352D]">
                              {item.outlet}
                            </div>
                          </td>
                        )}

                        <td className="px-5 py-4 text-gray-600">
                          {new Date(
                            item.trxDate
                          ).toLocaleDateString(
                            "id-ID",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            }
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-semibold text-[#18352D]">
                            {item.barang}
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {item.code} •{" "}
                            {item.unit}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-lg bg-[#EAF3EF] px-2.5 py-1 text-xs font-semibold text-[#497F70]">
                            {item.type}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right font-semibold">
                          {formatNumber(
                            item.qtyProcessed
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-red-600">
                          {formatNumber(
                            item.wasteQty
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-[#497F70]">
                          {formatNumber(
                            item.netQty
                          )}
                        </td>

                        <td className="px-5 py-4 text-right text-gray-600">
                          {formatCurrency(
                            item.unitCost
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-[#18352D]">
                          {formatCurrency(
                            item.totalCost
                          )}
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {item.user
                            ?.fullname ||
                            "-"}
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
    </div>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-[#18352D]">
        {value}
      </p>
    </div>
  );
}