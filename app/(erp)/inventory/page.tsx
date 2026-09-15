"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Search,
  RefreshCw,
  Package,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Warehouse,
  X,
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

  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return data.filter((item: any) => {
      const matchesSearch =
        !keyword ||
        String(item.name ?? "")
          .toLowerCase()
          .includes(keyword) ||
        String(item.code ?? "")
          .toLowerCase()
          .includes(keyword);

      const stock = Number(item.stock ?? 0);
      const minimumStock = Number(item.minimumStock ?? 0);
      const isLowStock = stock <= minimumStock;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "LOW" && isLowStock) ||
        (statusFilter === "SAFE" && !isLowStock);

      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  const totalItem = data.length;

  const totalLowStock = data.filter(
    (item: any) =>
      Number(item.stock ?? 0) <= Number(item.minimumStock ?? 0)
  ).length;

  const totalSafe = data.filter(
    (item: any) =>
      Number(item.stock ?? 0) > Number(item.minimumStock ?? 0)
  ).length;

  const totalStock = data.reduce(
    (sum: number, item: any) => sum + Number(item.stock ?? 0),
    0
  );

  const totalAvailable = data.reduce(
    (sum: number, item: any) =>
      sum + Number(item.availableStock ?? 0),
    0
  );

  return (
    <div className="min-h-full bg-[#F6F9F7] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">

        {/* ===================================================== */}
        {/* HERO */}
        {/* ===================================================== */}

        <div className="relative mb-7 overflow-hidden rounded-[28px] border border-[#DCE9E3] bg-white shadow-[0_12px_40px_rgba(31,73,61,0.07)]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#F1F8F4] via-white to-[#F8FBF9]" />

          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#DCEEE6]/50 blur-3xl" />
          <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-[#EEF7F2] blur-3xl" />

          <div className="relative flex flex-col gap-6 p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#173F34] text-white shadow-lg shadow-[#173F34]/15">
                <Boxes size={26} strokeWidth={2} />
              </div>

              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-[#E8F3EE] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#497F70]">
                    Inventory
                  </span>

                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Live Stock
                  </span>
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[#17352D] sm:text-3xl">
                  Inventory Stock
                </h1>

                <p className="mt-1.5 max-w-xl text-sm leading-6 text-gray-500">
                  Monitoring persediaan barang, ketersediaan stok,
                  dan kondisi inventory perusahaan secara real-time.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D9E6E0] bg-white px-4 text-sm font-semibold text-[#31584C] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#BFD5CC] hover:bg-[#F8FBF9] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              {loading ? "Memuat..." : "Refresh Data"}
            </button>
          </div>
        </div>

        {/* ===================================================== */}
        {/* SUMMARY CARDS */}
        {/* ===================================================== */}

        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* TOTAL ITEM */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_6px_24px_rgba(31,73,61,0.045)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(31,73,61,0.08)]">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#EDF6F1] transition-transform group-hover:scale-125" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
                  Total Item
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-[#17352D]">
                  {totalItem.toLocaleString("id-ID")}
                </p>

                <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#497F70]">
                  <Package size={13} />
                  Master inventory
                </div>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <Package size={21} />
              </div>
            </div>
          </div>

          {/* TOTAL STOCK */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_6px_24px_rgba(31,73,61,0.045)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(31,73,61,0.08)]">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#EEF7F2] transition-transform group-hover:scale-125" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
                  Total Stock
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-[#17352D]">
                  {totalStock.toLocaleString("id-ID")}
                </p>

                <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#497F70]">
                  <TrendingUp size={13} />
                  Current quantity
                </div>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <Boxes size={21} />
              </div>
            </div>
          </div>

          {/* SAFE */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_6px_24px_rgba(31,73,61,0.045)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(31,73,61,0.08)]">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-50 transition-transform group-hover:scale-125" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
                  Stock Aman
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-600">
                  {totalSafe.toLocaleString("id-ID")}
                </p>

                <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <CheckCircle2 size={13} />
                  Di atas minimum
                </div>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={21} />
              </div>
            </div>
          </div>

          {/* LOW */}

          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-[0_6px_24px_rgba(31,73,61,0.045)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(31,73,61,0.08)]">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-red-50 transition-transform group-hover:scale-125" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
                  Stock Menipis
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-red-600">
                  {totalLowStock.toLocaleString("id-ID")}
                </p>

                <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <AlertTriangle size={13} />
                  Perlu perhatian
                </div>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle size={21} />
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================== */}
        {/* MAIN TABLE CARD */}
        {/* ===================================================== */}

        <div className="overflow-hidden rounded-[24px] border border-[#DDE9E4] bg-white shadow-[0_10px_35px_rgba(31,73,61,0.055)]">

          {/* TABLE HEADER */}

          <div className="border-b border-[#E7EFEB] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173F34] text-white shadow-sm">
                  <Warehouse size={19} />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-[#17352D]">
                      Daftar Inventory
                    </h2>

                    <span className="rounded-full bg-[#F0F5F2] px-2 py-0.5 text-[10px] font-bold text-[#497F70]">
                      {filteredData.length}
                    </span>
                  </div>

                  <p className="mt-0.5 text-xs text-gray-400">
                    Monitor jumlah stok dan kondisi persediaan
                  </p>
                </div>
              </div>

              {totalAvailable > 0 && (
                <div className="hidden items-center gap-2 rounded-xl bg-[#F6FAF8] px-3 py-2 text-xs text-gray-500 lg:flex">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Available{" "}
                  <span className="font-bold text-[#31584C]">
                    {totalAvailable.toLocaleString("id-ID")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* FILTER BAR */}

          <div className="border-b border-[#E7EFEB] bg-[#FAFCFB] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">

              {/* SEARCH */}

              <div className="relative flex-1">
                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  placeholder="Cari kode atau nama barang..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#DDE9E4] bg-white pl-10 pr-10 text-sm text-[#17352D] outline-none transition-all placeholder:text-gray-400 focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* STATUS */}

              <div className="flex gap-2">
                {[
                  {
                    value: "ALL",
                    label: "Semua",
                    count: totalItem,
                  },
                  {
                    value: "SAFE",
                    label: "Aman",
                    count: totalSafe,
                  },
                  {
                    value: "LOW",
                    label: "Menipis",
                    count: totalLowStock,
                  },
                ].map((option) => {
                  const active = statusFilter === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStatusFilter(option.value)}
                      className={`inline-flex h-11 items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition-all ${
                        active
                          ? "border-[#315F51] bg-[#315F51] text-white shadow-sm"
                          : "border-[#DDE9E4] bg-white text-[#526D64] hover:border-[#BFD4CC] hover:bg-[#F7FAF8]"
                      }`}
                    >
                      {option.label}

                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                          active
                            ? "bg-white/15 text-white"
                            : "bg-[#F1F5F3] text-gray-500"
                        }`}
                      >
                        {option.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px]">

              <thead>
                <tr className="border-b border-[#E4ECE8] bg-[#F7F9F8]">
                  {[
                    ["No", "center"],
                    ["Kode", "left"],
                    ["Nama Barang", "left"],
                    ["Satuan", "center"],
                    ["Gudang", "center"],
                    ["Stock", "right"],
                    ["Available", "right"],
                    ["Reserved", "right"],
                    ["Min Stock", "right"],
                    ["Average Cost", "right"],
                    ["Status", "center"],
                  ].map(([label, align]) => (
                    <th
                      key={label}
                      className={`px-4 py-3.5 text-${align} text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading && data.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                          <RefreshCw
                            size={22}
                            className="animate-spin"
                          />
                        </div>

                        <p className="mt-3 text-sm font-medium text-gray-600">
                          Memuat inventory...
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          Mengambil data stok terbaru
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                          <Boxes size={26} />
                        </div>

                        <h3 className="mt-4 font-semibold text-gray-700">
                          Tidak ada data inventory
                        </h3>

                        <p className="mt-1 max-w-sm text-sm text-gray-400">
                          Tidak ditemukan barang yang sesuai dengan
                          pencarian atau filter yang dipilih.
                        </p>

                        {(search || statusFilter !== "ALL") && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearch("");
                              setStatusFilter("ALL");
                            }}
                            className="mt-4 rounded-xl bg-[#173F34] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#255648]"
                          >
                            Reset Filter
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map(
                    (item: any, index: number) => {
                      const stock = Number(item.stock ?? 0);
                      const minimumStock = Number(
                        item.minimumStock ?? 0
                      );
                      const availableStock = Number(
                        item.availableStock ?? 0
                      );
                      const reservedStock = Number(
                        item.reservedStock ?? 0
                      );
                      const averageCost = Number(
                        item.averageCost ?? 0
                      );

                      const isLowStock = stock <= minimumStock;

                      return (
                        <tr
                          key={item.id}
                          className="group border-b border-[#EEF2F0] transition-colors hover:bg-[#F8FBF9]"
                        >
                          <td className="px-4 py-3.5 text-center text-xs font-medium text-gray-400">
                            {index + 1}
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="rounded-lg bg-[#F1F6F3] px-2.5 py-1.5 font-mono text-xs font-semibold text-[#41675B]">
                              {item.code || "-"}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF5F1] text-[#497F70] transition group-hover:bg-[#E3F0EA]">
                                <Package size={16} />
                              </div>

                              <div>
                                <p className="text-sm font-semibold text-[#1D3931]">
                                  {item.name || "-"}
                                </p>

                                {item.barcode && (
                                  <p className="mt-0.5 text-[10px] text-gray-400">
                                    {item.barcode}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <span className="text-xs font-medium text-gray-600">
                              {item.unit || "-"}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
                              <Warehouse
                                size={13}
                                className="text-gray-400"
                              />
                              {item.warehouse || "-"}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <span
                              className={`text-sm font-bold ${
                                isLowStock
                                  ? "text-red-600"
                                  : "text-[#17352D]"
                              }`}
                            >
                              {stock.toLocaleString("id-ID")}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <span className="text-sm font-medium text-gray-600">
                              {availableStock.toLocaleString(
                                "id-ID"
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <span
                              className={`text-sm font-medium ${
                                reservedStock > 0
                                  ? "text-amber-600"
                                  : "text-gray-500"
                              }`}
                            >
                              {reservedStock.toLocaleString(
                                "id-ID"
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <span className="text-sm text-gray-500">
                              {minimumStock.toLocaleString(
                                "id-ID"
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <span className="text-sm font-medium text-gray-600">
                              {averageCost.toLocaleString("id-ID")}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            {isLowStock ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600">
                                <AlertTriangle size={12} />
                                Menipis
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-600">
                                <CheckCircle2 size={12} />
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

          <div className="flex flex-col justify-between gap-3 border-t border-[#E6EEE9] bg-[#F8FAF9] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <div className="text-xs text-gray-500">
              Menampilkan{" "}
              <span className="font-bold text-[#17352D]">
                {filteredData.length.toLocaleString("id-ID")}
              </span>{" "}
              dari{" "}
              <span className="font-bold text-[#17352D]">
                {data.length.toLocaleString("id-ID")}
              </span>{" "}
              barang
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-[#DDE9E4] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-gray-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Stock Aman
              </div>

              <div className="flex items-center gap-1.5 rounded-lg border border-[#F1DCDC] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-gray-500">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Stock Menipis
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}