"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BarChart3,
  Boxes,
  CalendarDays,
  FileText,
  Package,
  PackageCheck,
  PackageX,
  RefreshCw,
  ShoppingCart,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  Search,
  Truck,
} from "lucide-react";

type ReportType =
  | "stock"
  | "barang-masuk"
  | "barang-keluar"
  | "purchase";

type ReportItem = any;

const reportTabs: {
  id: ReportType;
  label: string;
  description: string;
  icon: any;
  color: string;
  active: string;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    id: "stock",
    label: "Stock",
    description: "Posisi persediaan",
    icon: Boxes,
    color: "emerald",
    active: "bg-emerald-500 text-white shadow-sm",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    id: "barang-masuk",
    label: "Barang Masuk",
    description: "Penerimaan barang",
    icon: ArrowDownToLine,
    color: "blue",
    active: "bg-blue-500 text-white shadow-sm",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    id: "barang-keluar",
    label: "Barang Keluar",
    description: "Pengeluaran barang",
    icon: ArrowUpFromLine,
    color: "rose",
    active: "bg-rose-500 text-white shadow-sm",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
  },
  {
    id: "purchase",
    label: "Purchase",
    description: "Purchase order",
    icon: ShoppingCart,
    color: "amber",
    active: "bg-amber-500 text-white shadow-sm",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
];

function formatNumber(value: any) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatDate(value: any) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getItemNumber(item: ReportItem) {
  return (
    item.number ??
    item.poNumber ??
    item.purchaseNumber ??
    item.receiptNumber ??
    item.deliveryNumber ??
    item.code ??
    item.kodeBarang ??
    "-"
  );
}

function getItemName(item: ReportItem) {
  return (
    item.barang?.name ??
    item.barang?.namaBarang ??
    item.name ??
    item.namaBarang ??
    item.customer?.name ??
    item.supplier?.name ??
    "-"
  );
}

function getItemStatus(item: ReportItem) {
  return item.status ?? "ACTIVE";
}

function getItemDate(item: ReportItem) {
  return (
    item.date ??
    item.createdAt ??
    item.tanggal ??
    item.receivedAt ??
    item.deliveryDate ??
    null
  );
}

function getItemQty(item: ReportItem) {
  return (
    item.qty ??
    item.quantity ??
    item.receivedQty ??
    item.stock ??
    null
  );
}

function getStatusStyle(status: string) {
  const value = String(status).toUpperCase();

  if (
    value.includes("APPROVED") ||
    value.includes("RECEIVED") ||
    value.includes("COMPLETED") ||
    value.includes("DONE") ||
    value === "ACTIVE"
  ) {
    return "border-emerald-100 bg-emerald-50 text-emerald-600";
  }

  if (
    value.includes("PENDING") ||
    value.includes("DRAFT")
  ) {
    return "border-amber-100 bg-amber-50 text-amber-600";
  }

  if (
    value.includes("CANCEL") ||
    value.includes("REJECT") ||
    value.includes("VOID")
  ) {
    return "border-rose-100 bg-rose-50 text-rose-600";
  }

  return "border-slate-100 bg-slate-50 text-slate-600";
}

export default function LaporanPage() {
  const [type, setType] =
    useState<ReportType>("stock");

  const [data, setData] =
    useState<ReportItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [search, setSearch] =
    useState("");

  async function load(
    selectedType: ReportType = type,
    showRefresh = false
  ) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const res = await fetch(
        `/api/laporan?type=${selectedType}`,
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error(
          "Gagal mengambil laporan"
        );
      }

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
      console.error("LAPORAN ERROR", error);
      setData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load("stock");
  }, []);

  useEffect(() => {
    if (type !== "stock") {
      load(type);
    }
  }, [type]);

  const activeTab = useMemo(
    () =>
      reportTabs.find(
        (item) => item.id === type
      ) ?? reportTabs[0],
    [type]
  );

  const filteredData = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    if (!keyword) {
      return data;
    }

    return data.filter((item) => {
      const text = [
        getItemNumber(item),
        getItemName(item),
        getItemStatus(item),
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [data, search]);

  const summary = useMemo(() => {
    return {
      total: data.length,
      displayed: filteredData.length,
    };
  }, [data, filteredData]);

  const handleTypeChange = (
    newType: ReportType
  ) => {
    setSearch("");
    setType(newType);
  };

  return (
    <div className="min-h-screen bg-[#F5F8F7] text-slate-800">
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">

        {/* HEADER */}

        <section className="relative overflow-hidden rounded-[30px] border border-white bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.05)] sm:p-8">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-100/50 blur-3xl" />

          <div className="absolute -bottom-24 right-48 h-48 w-48 rounded-full bg-teal-100/40 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_5px_rgba(52,211,153,0.10)]" />

                <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                  MGB ERP
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
                Laporan ERP
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Pantau data stock, barang masuk,
                barang keluar, dan purchase dalam
                satu halaman laporan.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                <CalendarDays className="h-5 w-5 text-emerald-600" />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Laporan
                </p>

                <p className="mt-0.5 text-sm font-semibold text-slate-700">
                  {activeTab.label}
                </p>
              </div>

              <button
                onClick={() =>
                  load(type, true)
                }
                disabled={refreshing}
                title="Refresh laporan"
                className="ml-2 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing
                      ? "animate-spin"
                      : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* REPORT MENU */}

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-800">
              Jenis Laporan
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              Pilih laporan yang ingin ditampilkan
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {reportTabs.map((tab) => {
              const Icon = tab.icon;
              const active = type === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() =>
                    handleTypeChange(tab.id)
                  }
                  className={`group rounded-2xl border p-4 text-left transition duration-200 ${
                    active
                      ? "border-transparent bg-white shadow-[0_10px_30px_rgba(15,23,42,0.07)]"
                      : "border-white bg-white shadow-[0_6px_22px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                        active
                          ? tab.active
                          : tab.iconBg
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          active
                            ? "text-white"
                            : tab.iconColor
                        }`}
                      />
                    </div>

                    <ChevronRight
                      className={`h-4 w-4 transition ${
                        active
                          ? tab.iconColor
                          : "text-slate-300 group-hover:text-slate-500"
                      }`}
                    />
                  </div>

                  <p className="mt-4 text-sm font-bold text-slate-700">
                    {tab.label}
                  </p>

                  <p className="mt-1 text-[11px] text-slate-400">
                    {tab.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* REPORT TABLE */}

        <section className="overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_8px_30px_rgba(15,23,42,0.045)]">

          {/* TABLE HEADER */}

          <div className="border-b border-slate-100 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                </div>

                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    {activeTab.label}
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-400">
                    {summary.total.toLocaleString(
                      "id-ID"
                    )}{" "}
                    data tersedia
                  </p>
                </div>
              </div>

              <div className="relative w-full lg:w-[300px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Cari laporan..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          </div>

          {/* LOADING */}

          {loading ? (
            <div className="p-6">
              <div className="space-y-3">
                {Array.from({
                  length: 6,
                }).map((_, index) => (
                  <div
                    key={index}
                    className="h-14 animate-pulse rounded-xl bg-slate-50"
                  />
                ))}
              </div>
            </div>
          ) : filteredData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      No
                    </th>

                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Nomor / Kode
                    </th>

                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Data
                    </th>

                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Qty
                    </th>

                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Tanggal
                    </th>

                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredData.map(
                    (
                      item: ReportItem,
                      index: number
                    ) => {
                      const number =
                        getItemNumber(item);

                      const name =
                        getItemName(item);

                      const status =
                        getItemStatus(item);

                      const qty =
                        getItemQty(item);

                      const date =
                        getItemDate(item);

                      return (
                        <tr
                          key={
                            item.id ??
                            `${number}-${index}`
                          }
                          className="group transition hover:bg-slate-50/70"
                        >
                          <td className="px-6 py-4 text-sm font-medium text-slate-400">
                            {index + 1}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                                {type ===
                                "stock" ? (
                                  <Boxes className="h-4 w-4 text-emerald-600" />
                                ) : type ===
                                  "purchase" ? (
                                  <ShoppingCart className="h-4 w-4 text-amber-600" />
                                ) : type ===
                                  "barang-masuk" ? (
                                  <PackageCheck className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <PackageX className="h-4 w-4 text-rose-600" />
                                )}
                              </div>

                              <span className="text-sm font-semibold text-slate-700">
                                {number}
                              </span>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <p className="max-w-[300px] truncate text-sm font-medium text-slate-700">
                              {name}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <span className="text-sm font-semibold text-slate-600">
                              {qty !== null
                                ? formatNumber(
                                    qty
                                  )
                                : "-"}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span className="text-xs font-medium text-slate-500">
                              {formatDate(date)}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${getStatusStyle(
                                status
                              )}`}
                            >
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                <FileText className="h-7 w-7 text-emerald-500" />
              </div>

              <p className="mt-4 text-sm font-semibold text-slate-700">
                {search
                  ? "Data tidak ditemukan"
                  : "Belum ada data laporan"}
              </p>

              <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
                {search
                  ? "Coba gunakan kata kunci pencarian yang berbeda."
                  : `Belum ada data untuk laporan ${activeTab.label.toLowerCase()}.`}
              </p>
            </div>
          )}

          {/* FOOTER TABLE */}

          {!loading &&
            filteredData.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-400">
                  Menampilkan{" "}
                  <span className="font-semibold text-slate-600">
                    {summary.displayed.toLocaleString(
                      "id-ID"
                    )}
                  </span>{" "}
                  dari{" "}
                  <span className="font-semibold text-slate-600">
                    {summary.total.toLocaleString(
                      "id-ID"
                    )}
                  </span>{" "}
                  data
                </p>

                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                  <Truck className="h-3.5 w-3.5" />
                  MGB ERP Report
                </div>
              </div>
            )}
        </section>

        {/* FOOTER */}

        <footer className="border-t border-slate-200 py-5 text-center">
          <p className="text-xs text-slate-400">
            PT. Mitra Garam Bogatama • ERP Inventory
            System
          </p>
        </footer>
      </div>
    </div>
  );
}