"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Search,
  RefreshCw,
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock3,
} from "lucide-react";

type ExpiredItem = {
  id: number;
  kodeBarang: string;
  namaBarang: string;
  batchNumber: string;
  qty: number;
  expiredDate: string;
  sisaHari: number;
  status: "AMAN" | "WARNING" | "EXPIRED";
};

export default function ExpiredPage() {
  const [data, setData] = useState<ExpiredItem[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("SEMUA");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);

      const res = await fetch("/api/barang-batch", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setData(json.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error("Gagal mengambil data expired:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return data.filter((item) => {
      const cocokSearch =
        !keyword ||
        item.namaBarang?.toLowerCase().includes(keyword) ||
        item.kodeBarang?.toLowerCase().includes(keyword) ||
        item.batchNumber?.toLowerCase().includes(keyword);

      const cocokStatus =
        status === "SEMUA" || item.status === status;

      return cocokSearch && cocokStatus;
    });
  }, [data, search, status]);

  const total = data.length;

  const totalExpired = data.filter(
    (item) => item.status === "EXPIRED"
  ).length;

  const totalWarning = data.filter(
    (item) => item.status === "WARNING"
  ).length;

  const totalAman = data.filter(
    (item) => item.status === "AMAN"
  ).length;

  function formatDate(date: string) {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function renderStatus(status: ExpiredItem["status"]) {
    if (status === "EXPIRED") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
          <XCircle className="h-3.5 w-3.5" />
          EXPIRED
        </span>
      );
    }

    if (status === "WARNING") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          WARNING
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        AMAN
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">

      {/* HEADER */}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div>
          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
              <Package className="h-6 w-6 text-red-600" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
                Monitoring Barang Expired
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Pantau masa berlaku seluruh batch barang di gudang
              </p>
            </div>

          </div>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />

          Refresh
        </button>

      </div>

      {/* SUMMARY */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* TOTAL */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm font-medium text-slate-500">
                Total Batch
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {total}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
              <Package className="h-5 w-5 text-slate-600" />
            </div>

          </div>
        </div>

        {/* EXPIRED */}

        <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm font-medium text-slate-500">
                Expired
              </p>

              <p className="mt-2 text-2xl font-bold text-red-600">
                {totalExpired}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>

          </div>
        </div>

        {/* WARNING */}

        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm font-medium text-slate-500">
                Warning
              </p>

              <p className="mt-2 text-2xl font-bold text-amber-600">
                {totalWarning}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>

          </div>
        </div>

        {/* AMAN */}

        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm font-medium text-slate-500">
                Aman
              </p>

              <p className="mt-2 text-2xl font-bold text-emerald-600">
                {totalAman}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>

          </div>
        </div>

      </div>

      {/* FILTER */}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">

          {/* SEARCH */}

          <div className="relative">

            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              placeholder="Cari kode, nama barang, atau nomor batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />

          </div>

          {/* STATUS */}

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
          >
            <option value="SEMUA">
              Semua Status
            </option>

            <option value="EXPIRED">
              Expired
            </option>

            <option value="WARNING">
              Warning
            </option>

            <option value="AMAN">
              Aman
            </option>
          </select>

        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">

          <span>
            Menampilkan{" "}
            <b className="text-slate-700">
              {filtered.length}
            </b>{" "}
            dari{" "}
            <b className="text-slate-700">
              {data.length}
            </b>{" "}
            batch
          </span>

          {(search || status !== "SEMUA") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatus("SEMUA");
              }}
              className="font-medium text-emerald-600 hover:text-emerald-700"
            >
              Reset Filter
            </button>
          )}

        </div>

      </div>

      {/* TABLE */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="overflow-x-auto">

          <table className="min-w-[950px] w-full">

            <thead className="border-b border-slate-200 bg-slate-50">

              <tr>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Kode
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Barang
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Batch
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Qty
                </th>

                <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Expired
                </th>

                <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Sisa
                </th>

                <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-100">

              {loading ? (

                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center"
                  >
                    <div className="flex flex-col items-center gap-3">

                      <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />

                      <span className="text-sm text-slate-500">
                        Memuat data...
                      </span>

                    </div>
                  </td>
                </tr>

              ) : filtered.length === 0 ? (

                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center"
                  >
                    <div className="flex flex-col items-center">

                      <Package className="mb-3 h-10 w-10 text-slate-300" />

                      <p className="font-medium text-slate-700">
                        Tidak ada data
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        Tidak ditemukan batch sesuai filter
                      </p>

                    </div>
                  </td>
                </tr>

              ) : (

                filtered.map((item) => (

                  <tr
                    key={item.id}
                    className="transition hover:bg-slate-50"
                  >

                    <td className="px-5 py-4">
                      <span className="font-mono text-sm font-semibold text-slate-700">
                        {item.kodeBarang}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800">
                        {item.namaBarang}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {item.batchNumber || "-"}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <span className="font-semibold text-slate-800">
                        {item.qty.toLocaleString("id-ID")}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span className="text-sm text-slate-700">
                        {formatDate(item.expiredDate)}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-center">

                      {item.status === "EXPIRED" ? (

                        <div className="inline-flex items-center gap-1.5 font-semibold text-red-600">
                          <Clock3 className="h-4 w-4" />
                          {Math.abs(item.sisaHari)} hari lewat
                        </div>

                      ) : (

                        <div
                          className={`font-semibold ${
                            item.status === "WARNING"
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {item.sisaHari} hari
                        </div>

                      )}

                    </td>

                    <td className="px-5 py-4 text-center">
                      {renderStatus(item.status)}
                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}