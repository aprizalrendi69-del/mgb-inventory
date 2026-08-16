"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  ShoppingCart,
  Plus,
  Search,
  RefreshCw,
  FileText,
  CheckCircle2,
  PackageCheck,
  Clock3,
  Eye,
  Printer,
  Check,
  Truck,
  Store,
} from "lucide-react";

type PurchaseRow = {
  id: number;
  number: string;
  purchaseDate?: string;
  total: number;
  status: string;

  supplier?: {
    id: number;
    code?: string;
    name: string;
  };

  outlet?: {
    id: number;
    code?: string;
    name: string;
  };

  outletId?: number | null;
  supplierId?: number;

  source?: "PUSAT" | "OUTLET" | string;

  destinationType?: "PUSAT" | "OUTLET";
  destinationId?: number | null;
  destinationName?: string;
  destinationCode?: string | null;
};

export default function PurchasePage() {
  const [purchase, setPurchase] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("SEMUA");
  const [source, setSource] = useState("SEMUA");

  useEffect(() => {
    loadPurchase();
  }, []);

  async function loadPurchase() {
    try {
      setLoading(true);

      const res = await fetch("/api/purchase", {
        cache: "no-store",
      });

      const json = await res.json();

      console.log("PURCHASE DATA:", json);

      if (!json.success || !Array.isArray(json.data)) {
        setPurchase([]);
        return;
      }

      /*
       * NORMALISASI DATA
       *
       * Kalau source dari API ada -> pakai.
       * Kalau tidak ada tapi ada outletId -> otomatis OUTLET.
       * Selain itu -> PUSAT.
       */
      const normalized: PurchaseRow[] = json.data.map(
        (item: any) => ({
          ...item,

          source:
            item.source === "OUTLET" ||
            item.outletId !== null &&
              item.outletId !== undefined
              ? "OUTLET"
              : "PUSAT",
        })
      );

      setPurchase(normalized);
    } catch (error) {
      console.error("PURCHASE ERROR:", error);
      setPurchase([]);
    } finally {
      setLoading(false);
    }
  }

  async function approvePurchase(id: number) {
    const ok = confirm(
      "Approve Purchase Order ini?"
    );

    if (!ok) return;

    try {
      const res = await fetch(
        `/api/purchase/${id}/approve`,
        {
          method: "POST",
        }
      );

      const json = await res.json();

      if (json.success) {
        alert(
          "Purchase Order berhasil di-Approve"
        );

        await loadPurchase();
      } else {
        alert(
          json.message ||
            "Gagal approve Purchase Order"
        );
      }
    } catch (error) {
      console.error(
        "APPROVE PURCHASE ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat approve Purchase Order"
      );
    }
  }

  async function receivePurchase(id: number) {
    const ok = confirm(
      "Terima barang dari Purchase Order ini?"
    );

    if (!ok) return;

    try {
      const res = await fetch(
        `/api/purchase/${id}/receive`,
        {
          method: "PUT",
        }
      );

      const json = await res.json();

      if (json.success) {
        alert("Barang berhasil diterima");
        await loadPurchase();
      } else {
        alert(
          json.message ||
            "Gagal menerima barang"
        );
      }
    } catch (error) {
      console.error(
        "RECEIVE PURCHASE ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menerima barang"
      );
    }
  }

  const filteredPurchase = useMemo(() => {
    const keyword =
      search.toLowerCase().trim();

    return purchase.filter((item) => {
      const itemSource =
        item.source === "OUTLET"
          ? "OUTLET"
          : "PUSAT";

      const nomorPO =
        item.number
          ?.toLowerCase()
          .includes(keyword);

      const namaSupplier =
        item.supplier?.name
          ?.toLowerCase()
          .includes(keyword);

      const kodeSupplier =
        item.supplier?.code
          ?.toLowerCase()
          .includes(keyword);

      const namaOutlet =
        item.outlet?.name
          ?.toLowerCase()
          .includes(keyword);

      const kodeOutlet =
        item.outlet?.code
          ?.toLowerCase()
          .includes(keyword);

      const cocokSearch =
        !keyword ||
        nomorPO ||
        namaSupplier ||
        kodeSupplier ||
        namaOutlet ||
        kodeOutlet;

      const cocokStatus =
        status === "SEMUA" ||
        item.status === status;

      const cocokSource =
        source === "SEMUA" ||
        itemSource === source;

      return (
        cocokSearch &&
        cocokStatus &&
        cocokSource
      );
    });
  }, [
    purchase,
    search,
    status,
    source,
  ]);

  const totalPurchase =
    purchase.length;

  const totalPusat =
    purchase.filter(
      (item) =>
        item.source !== "OUTLET"
    ).length;

  const totalOutlet =
    purchase.filter(
      (item) =>
        item.source === "OUTLET"
    ).length;

  const totalDraft =
    purchase.filter(
      (item) =>
        item.status === "DRAFT"
    ).length;

  const totalApproved =
    purchase.filter(
      (item) =>
        item.status === "APPROVED"
    ).length;

  const totalReceived =
    purchase.filter(
      (item) =>
        item.status === "RECEIVED"
    ).length;

  const totalValue =
    purchase.reduce(
      (total, item) =>
        total +
        Number(item.total || 0),
      0
    );

  function formatRupiah(value: any) {
    return Number(
      value || 0
    ).toLocaleString("id-ID");
  }

  function formatDate(value: any) {
    if (!value) return "-";

    const date = new Date(value);

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
        month: "short",
        year: "numeric",
      }
    );
  }

  function StatusBadge({
    status,
  }: {
    status: string;
  }) {
    if (status === "DRAFT") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Draft
        </span>
      );
    }

    if (status === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          Approved
        </span>
      );
    }

    if (status === "RECEIVED") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Received
        </span>
      );
    }

    if (status === "COMPLETED") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
          Completed
        </span>
      );
    }

    if (status === "CANCELLED") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          Cancelled
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
        {status || "Unknown"}
      </span>
    );
  }

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* HEADER */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <ShoppingCart size={23} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Purchase Order
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Kelola Purchase Order pusat dan outlet
            </p>
          </div>

        </div>

        <Link
          href="/purchase/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3D6D60]"
        >
          <Plus size={18} />
          Purchase Baru
        </Link>

      </div>

      {/* SUMMARY */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Total Purchase
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {totalPurchase}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <FileText size={21} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Purchase Pusat
              </p>

              <p className="mt-1 text-2xl font-bold text-[#497F70]">
                {totalPusat}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <ShoppingCart size={21} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Purchase Outlet
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-600">
                {totalOutlet}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Store size={21} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Barang Diterima
              </p>

              <p className="mt-1 text-2xl font-bold text-green-600">
                {totalReceived}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <PackageCheck size={21} />
            </div>
          </div>
        </div>

      </div>

      {/* STATUS */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock3 size={19} />
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Draft
              </p>

              <p className="text-xl font-bold text-amber-600">
                {totalDraft}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <CheckCircle2 size={19} />
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Approved
              </p>

              <p className="text-xl font-bold text-blue-600">
                {totalApproved}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            Total Nilai Purchase
          </p>

          <p className="mt-1 text-xl font-bold text-[#18352D]">
            Rp {formatRupiah(totalValue)}
          </p>
        </div>

      </div>

      {/* TABLE */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        {/* TOOLBAR */}

        <div className="border-b border-[#E5ECE9] p-4 md:p-5">

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

            <div className="relative w-full lg:max-w-md">

              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Cari No PO, supplier, atau outlet..."
                className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
              />

            </div>

            <div className="flex flex-wrap gap-2">

              <select
                value={source}
                onChange={(e) =>
                  setSource(e.target.value)
                }
                className="rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-2.5 text-sm outline-none focus:border-[#497F70]"
              >
                <option value="SEMUA">
                  Semua Purchase
                </option>

                <option value="PUSAT">
                  Purchase Pusat
                </option>

                <option value="OUTLET">
                  Purchase Outlet
                </option>
              </select>

              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value)
                }
                className="rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-2.5 text-sm outline-none focus:border-[#497F70]"
              >
                <option value="SEMUA">
                  Semua Status
                </option>

                <option value="DRAFT">
                  Draft
                </option>

                <option value="APPROVED">
                  Approved
                </option>

                <option value="RECEIVED">
                  Received
                </option>

                <option value="COMPLETED">
                  Completed
                </option>

                <option value="CANCELLED">
                  Cancelled
                </option>
              </select>

              <button
                onClick={loadPurchase}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-50"
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

          </div>

          <div className="mt-4 text-sm text-gray-500">

            Menampilkan{" "}

            <span className="font-semibold text-[#18352D]">
              {filteredPurchase.length}
            </span>{" "}

            dari{" "}

            <span className="font-semibold text-[#18352D]">
              {purchase.length}
            </span>{" "}

            Purchase Order

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="min-w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  No. PO
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Jenis
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

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Total
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Status
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Aksi
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-14 text-center"
                  >
                    <div className="flex flex-col items-center gap-3 text-gray-500">
                      <RefreshCw
                        size={25}
                        className="animate-spin text-[#497F70]"
                      />

                      <span>
                        Loading Purchase Order...
                      </span>
                    </div>
                  </td>
                </tr>

              ) : filteredPurchase.length === 0 ? (

                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-14 text-center"
                  >
                    <div className="flex flex-col items-center">

                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF3EF] text-[#497F70]">
                        <ShoppingCart size={25} />
                      </div>

                      <p className="font-semibold text-gray-700">
                        Tidak ada Purchase Order
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        Coba ubah pencarian atau filter.
                      </p>

                    </div>
                  </td>
                </tr>

              ) : (

                filteredPurchase.map(
                  (item, index) => {

                    const isOutlet =
                      item.source === "OUTLET";

                    return (
                      <tr
                        key={`${isOutlet ? "OUTLET" : "PUSAT"}-${item.id}`}
                        className="border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                      >

                        {/* NO */}

                        <td className="px-5 py-4 text-gray-500">
                          {index + 1}
                        </td>

                        {/* PO */}

                        <td className="px-5 py-4">

                          <Link
                            href={
                              isOutlet
                                ? `/outlet/purchase/${item.id}`
                                : `/purchase/${item.id}`
                            }
                            className="font-semibold text-[#18352D] transition hover:text-[#497F70]"
                          >
                            {item.number || "-"}
                          </Link>

                        </td>

                        {/* JENIS */}

                        <td className="px-5 py-4 text-center">

                          {isOutlet ? (

                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                              <Store size={13} />
                              Outlet
                            </span>

                          ) : (

                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF3EF] px-3 py-1.5 text-xs font-semibold text-[#497F70]">
                              <ShoppingCart size={13} />
                              Pusat
                            </span>

                          )}

                        </td>

                        {/* TANGGAL */}

                        <td className="px-5 py-4 text-gray-600">
                          {formatDate(
                            item.purchaseDate
                          )}
                        </td>

                        {/* SUPPLIER */}

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-3">

                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                              <Truck size={17} />
                            </div>

                            <span className="font-medium text-gray-700">
                              {item.supplier?.name || "-"}
                            </span>

                          </div>

                        </td>

                        {/* OUTLET */}

                        <td className="px-5 py-4">

                          {isOutlet ? (

                            <div className="flex items-center gap-2">

                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                <Store size={15} />
                              </div>

                              <div>

                                <div className="font-medium text-gray-700">
                                  {item.outlet?.name ||
                                    item.destinationName ||
                                    "-"}
                                </div>

                                {(item.outlet?.code ||
                                  item.destinationCode) && (
                                  <div className="text-xs text-gray-400">
                                    {item.outlet?.code ||
                                      item.destinationCode}
                                  </div>
                                )}

                              </div>

                            </div>

                          ) : (

                            <span className="text-gray-400">
                              Gudang Pusat
                            </span>

                          )}

                        </td>

                        {/* TOTAL */}

                        <td className="px-5 py-4 text-right font-semibold text-[#18352D]">
                          Rp{" "}
                          {formatRupiah(
                            item.total
                          )}
                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-4 text-center">
                          <StatusBadge
                            status={
                              item.status
                            }
                          />
                        </td>

                        {/* AKSI */}

                        <td className="px-5 py-4">

                          <div className="flex flex-wrap justify-center gap-2">

                            {/* DETAIL */}

                            <Link
                              href={
                                isOutlet
                                  ? `/outlet/purchase/${item.id}`
                                  : `/purchase/${item.id}`
                              }
                              title="Detail Purchase"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#EAF3EF] px-3 py-2 text-xs font-semibold text-[#497F70] transition hover:bg-[#DDEDE6]"
                            >
                              <Eye size={14} />
                              Detail
                            </Link>

                            {/* PUSAT */}

                            {!isOutlet &&
                              item.status ===
                                "DRAFT" && (

                                <button
                                  onClick={() =>
                                    approvePurchase(
                                      item.id
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600"
                                >
                                  <Check size={14} />
                                  Approve
                                </button>

                              )}

                            {!isOutlet &&
                              item.status ===
                                "APPROVED" && (

                                <button
                                  onClick={() =>
                                    receivePurchase(
                                      item.id
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700"
                                >
                                  <PackageCheck
                                    size={14}
                                  />
                                  Receive
                                </button>

                              )}

                            {/* OUTLET */}

                            {isOutlet &&
                              item.status ===
                                "DRAFT" && (

                                <Link
                                  href={`/outlet/purchase/${item.id}`}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600"
                                >
                                  <Check size={14} />
                                  Proses
                                </Link>

                              )}

                            {isOutlet &&
                              item.status ===
                                "APPROVED" && (

                                <Link
                                  href={`/outlet/purchase/${item.id}`}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700"
                                >
                                  <PackageCheck
                                    size={14}
                                  />
                                  Receive
                                </Link>

                              )}

                            {/* PRINT */}

                            <a
                              href={
                                isOutlet
                                  ? `/outlet/purchase/print?id=${item.id}`
                                  : `/purchase/print?id=${item.id}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5E5DC] bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-[#F5F8F6]"
                            >
                              <Printer size={14} />
                              Print
                            </a>

                          </div>

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