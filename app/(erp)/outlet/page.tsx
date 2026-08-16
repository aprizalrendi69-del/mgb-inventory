"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  ShoppingCart,
  Package,
  PackageCheck,
  Clock3,
  AlertTriangle,
  ClipboardList,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Boxes,
  CheckCircle2,
} from "lucide-react";

type DashboardData = {
  totalPurchase: number;
  totalDraft: number;
  totalApproved: number;
  totalReceived: number;
  totalReceipt: number;
  totalStock: number;
  lowStock: number;
  recentPurchase: {
    id: number;
    number: string;
    purchaseDate: string;
    status: string;
    total: number;
    supplier: {
      code: string;
      name: string;
    };
  }[];
};

export default function OutletDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    try {
      setLoading(true);

      const res = await fetch("/api/outlet/dashboard", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!json.success) {
        console.error(json.message);
        return;
      }

      setData(json.data);
      setUser(json.user);
    } catch (error) {
      console.error("OUTLET DASHBOARD ERROR:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  function formatRupiah(value: number) {
    return Number(value || 0).toLocaleString("id-ID");
  }

  function formatDate(value: string) {
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

  function statusBadge(status: string) {
    if (status === "DRAFT") {
      return (
        <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          Draft
        </span>
      );
    }

    if (status === "APPROVED") {
      return (
        <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          Approved
        </span>
      );
    }

    if (status === "RECEIVED") {
      return (
        <span className="inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
          Received
        </span>
      );
    }

    return (
      <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
        {status}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#F6F8F7]">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw
            size={22}
            className="animate-spin text-[#497F70]"
          />
          Loading Dashboard Outlet...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          Gagal mengambil data dashboard outlet.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F6F8F7] p-5 md:p-7 lg:p-8">

      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-[#497F70]">
            Overview Outlet
          </p>

          <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
            Dashboard Outlet
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            {user?.outlet?.name || "Outlet"}
            {user?.outlet?.code
              ? ` • ${user.outlet.code}`
              : ""}
          </p>
        </div>

        <button
          onClick={loadDashboard}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-[#F5F8F6]"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* TOTAL PURCHASE */}
        <Link
          href="/outlet/purchase"
          className="group rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Total Purchase
              </p>

              <p className="mt-2 text-3xl font-bold text-[#18352D]">
                {data.totalPurchase}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Semua Purchase Order
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <ShoppingCart size={21} />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#497F70]">
            Lihat purchase
            <ArrowRight
              size={14}
              className="transition group-hover:translate-x-1"
            />
          </div>
        </Link>

        {/* DRAFT */}
        <Link
          href="/outlet/purchase?status=DRAFT"
          className="group rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Purchase Draft
              </p>

              <p className="mt-2 text-3xl font-bold text-amber-600">
                {data.totalDraft}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Belum disetujui
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock3 size={21} />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-amber-600">
            Lihat draft
            <ArrowRight
              size={14}
              className="transition group-hover:translate-x-1"
            />
          </div>
        </Link>

        {/* APPROVED */}
        <Link
          href="/outlet/purchase?status=APPROVED"
          className="group rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Menunggu Receive
              </p>

              <p className="mt-2 text-3xl font-bold text-blue-600">
                {data.totalApproved}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Purchase sudah approved
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <PackageCheck size={21} />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-600">
            Proses receive
            <ArrowRight
              size={14}
              className="transition group-hover:translate-x-1"
            />
          </div>
        </Link>

        {/* STOCK */}
        <Link
          href="/outlet/stock"
          className="group rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Item Stok Outlet
              </p>

              <p className="mt-2 text-3xl font-bold text-green-600">
                {data.totalStock}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Item tersedia di outlet
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <Package size={21} />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-green-600">
            Lihat stok
            <ArrowRight
              size={14}
              className="transition group-hover:translate-x-1"
            />
          </div>
        </Link>
      </div>

      {/* SECONDARY STATISTICS */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <TrendingUp size={21} />
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Purchase Received
              </p>

              <p className="mt-1 text-xl font-bold text-[#18352D]">
                {data.totalReceived}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <CheckCircle2 size={21} />
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Total Receipt
              </p>

              <p className="mt-1 text-xl font-bold text-[#18352D]">
                {data.totalReceipt}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Boxes size={21} />
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Status Inventory
              </p>

              <p className="mt-1 text-xl font-bold text-[#18352D]">
                {data.totalStock} Item
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK MENU */}
      <div className="mb-6">

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#18352D]">
              Menu Cepat
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Akses fitur utama outlet
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

          <Link
            href="/outlet/purchase/new"
            className="group rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <ShoppingCart size={22} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[#18352D]">
                  Purchase Baru
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Buat PO pembelian outlet.
                </p>
              </div>

              <ArrowRight
                size={18}
                className="text-gray-300 transition group-hover:translate-x-1 group-hover:text-[#497F70]"
              />
            </div>
          </Link>

          <Link
            href="/outlet/barang-masuk"
            className="group rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <PackageCheck size={22} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[#18352D]">
                  Barang Masuk
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Kelola penerimaan barang.
                </p>
              </div>

              <ArrowRight
                size={18}
                className="text-gray-300 transition group-hover:translate-x-1 group-hover:text-green-600"
              />
            </div>
          </Link>

          <Link
            href="/outlet/stock-opname"
            className="group rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ClipboardList size={22} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[#18352D]">
                  Stock Opname
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Cek stok fisik outlet.
                </p>
              </div>

              <ArrowRight
                size={18}
                className="text-gray-300 transition group-hover:translate-x-1 group-hover:text-blue-600"
              />
            </div>
          </Link>

        </div>
      </div>

      {/* ALERT */}
      {data.lowStock > 0 && (
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-4">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <AlertTriangle size={21} />
            </div>

            <div>
              <p className="font-semibold text-amber-800">
                Perhatian Stok
              </p>

              <p className="mt-1 text-sm text-amber-700">
                {data.lowStock} item outlet memiliki stok habis.
              </p>
            </div>

          </div>

          <Link
            href="/outlet/stock"
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
          >
            Lihat Stok
            <ArrowRight size={16} />
          </Link>

        </div>
      )}

      {/* RECENT PURCHASE */}
      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        <div className="flex flex-col gap-3 border-b border-[#E5ECE9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h2 className="font-bold text-[#18352D]">
              Purchase Terbaru
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Daftar Purchase Order terbaru outlet
            </p>
          </div>

          <Link
            href="/outlet/purchase"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#497F70] hover:text-[#355F53]"
          >
            Lihat Semua
            <ArrowRight size={16} />
          </Link>

        </div>

        <div className="overflow-x-auto">

          <table className="min-w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-3 text-left font-semibold text-[#35564C]">
                  No. PO
                </th>

                <th className="px-5 py-3 text-left font-semibold text-[#35564C]">
                  Tanggal
                </th>

                <th className="px-5 py-3 text-left font-semibold text-[#35564C]">
                  Supplier
                </th>

                <th className="px-5 py-3 text-right font-semibold text-[#35564C]">
                  Total
                </th>

                <th className="px-5 py-3 text-center font-semibold text-[#35564C]">
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {data.recentPurchase.length === 0 ? (

                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center"
                  >
                    <div className="flex flex-col items-center">

                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                        <ShoppingCart size={22} />
                      </div>

                      <p className="font-medium text-gray-500">
                        Belum ada Purchase Order
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Purchase terbaru akan muncul di sini.
                      </p>

                    </div>
                  </td>
                </tr>

              ) : (

                data.recentPurchase.map((item) => (

                  <tr
                    key={item.id}
                    className="border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                  >

                    <td className="px-5 py-4">

                      <Link
                        href={`/outlet/purchase/${item.id}`}
                        className="font-semibold text-[#18352D] hover:text-[#497F70]"
                      >
                        {item.number}
                      </Link>

                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                      {formatDate(item.purchaseDate)}
                    </td>

                    <td className="px-5 py-4">

                      <div>
                        <p className="font-medium text-gray-700">
                          {item.supplier?.name || "-"}
                        </p>

                        {item.supplier?.code && (
                          <p className="mt-0.5 text-xs text-gray-400">
                            {item.supplier.code}
                          </p>
                        )}
                      </div>

                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-[#18352D]">
                      Rp {formatRupiah(item.total)}
                    </td>

                    <td className="px-5 py-4 text-center">
                      {statusBadge(item.status)}
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