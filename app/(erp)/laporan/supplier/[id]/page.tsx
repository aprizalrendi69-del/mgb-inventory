"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  FileText,
  Users,
  ShoppingCart,
  Package,
  Wallet,
  CalendarDays,
  Download,
  Printer,
  Mail,
  Phone,
  MapPin,
  Search,
  X,
} from "lucide-react";

import { exportSupplierExcel } from "@/lib/exportSupplierExcel";
import { exportSupplierPdf } from "@/lib/exportSupplierPdf";

type Supplier = {
  id: number;
  code?: string;
  name: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

export default function DetailSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [supplier, setSupplier] =
    useState<Supplier | null>(null);

  const [purchases, setPurchases] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [from, setFrom] =
    useState("");

  const [to, setTo] =
    useState("");

  const [searchPO, setSearchPO] =
    useState("");

  const [supplierId, setSupplierId] =
    useState("");

  // =========================================================
  // LOAD DATA
  // =========================================================

  async function loadData(
    customFrom = from,
    customTo = to,
    customId = supplierId
  ) {
    try {
      setLoading(true);

      let id = customId;

      if (!id) {
        const resolvedParams = await params;

        id = resolvedParams.id;

        setSupplierId(id);
      }

      let url =
        `/api/laporan/supplier/${id}`;

      const query: string[] = [];

      if (customFrom) {
        query.push(
          `from=${encodeURIComponent(customFrom)}`
        );
      }

      if (customTo) {
        query.push(
          `to=${encodeURIComponent(customTo)}`
        );
      }

      if (query.length > 0) {
        url += "?" + query.join("&");
      }

      const res = await fetch(url, {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setSupplier(
          json.supplier ?? null
        );

        setPurchases(
          json.purchases ?? []
        );
      } else {
        setSupplier(null);
        setPurchases([]);
      }
    } catch (error) {
      console.error(
        "DETAIL SUPPLIER ERROR:",
        error
      );

      setSupplier(null);
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    async function init() {
      const resolvedParams =
        await params;

      const id =
        resolvedParams.id;

      setSupplierId(id);

      await loadData(
        "",
        "",
        id
      );
    }

    init();
  }, []);

  // =========================================================
  // SEARCH PURCHASE ORDER
  // =========================================================

  const filteredPurchases = useMemo(() => {
    const keyword =
      searchPO.trim().toLowerCase();

    if (!keyword) {
      return purchases;
    }

    return purchases.filter(
      (po: any) =>
        String(po.number || "")
          .toLowerCase()
          .includes(keyword)
    );
  }, [purchases, searchPO]);

  // =========================================================
  // SUMMARY
  // =========================================================

  const summary = useMemo(() => {
    let totalPO =
      filteredPurchases.length;

    let totalQty = 0;

    let grandTotal = 0;

    filteredPurchases.forEach(
      (po: any) => {
        grandTotal += Number(
          po.total || 0
        );

        if (
          Array.isArray(
            po.items
          )
        ) {
          po.items.forEach(
            (item: any) => {
              totalQty += Number(
                item.qty || 0
              );
            }
          );
        }
      }
    );

    return {
      totalPO,
      totalQty,
      grandTotal,
    };
  }, [filteredPurchases]);

  // =========================================================
  // FORMAT
  // =========================================================

  function formatNumber(
    value: number
  ) {
    return new Intl.NumberFormat(
      "id-ID"
    ).format(
      Number(value || 0)
    );
  }

  function formatDate(
    value?: string | null
  ) {
    if (!value) return "-";

    return new Date(
      value
    ).toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  // =========================================================
  // STATUS
  // =========================================================

  function getStatusClass(
    status: string
  ) {
    const value =
      String(
        status || ""
      ).toUpperCase();

    if (value === "RECEIVED") {
      return "bg-green-50 text-green-700 border-green-200";
    }

    if (value === "APPROVED") {
      return "bg-blue-50 text-blue-700 border-blue-200";
    }

    if (value === "DRAFT") {
      return "bg-gray-50 text-gray-700 border-gray-200";
    }

    return "bg-gray-50 text-gray-700 border-gray-200";
  }

  function getStatusLabel(
    status: string
  ) {
    const value =
      String(
        status || ""
      ).toUpperCase();

    if (value === "RECEIVED") {
      return "Received";
    }

    if (value === "APPROVED") {
      return "Approved";
    }

    if (value === "DRAFT") {
      return "Draft";
    }

    return status || "-";
  }

  // =========================================================
  // FILTER
  // =========================================================

  function handleFilter() {
    loadData(
      from,
      to,
      supplierId
    );
  }

  function resetFilter() {
    setSearchPO("");
    setFrom("");
    setTo("");

    loadData(
      "",
      "",
      supplierId
    );
  }

  // =========================================================
  // CLEAR SEARCH PO
  // =========================================================

  function clearSearchPO() {
    setSearchPO("");
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8F7] p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex flex-col items-center">
              <RefreshCw
                size={30}
                className="mb-3 animate-spin text-[#497F70]"
              />

              <p className="font-medium text-gray-700">
                Memuat detail supplier...
              </p>

              <p className="mt-1 text-sm text-gray-400">
                Mohon tunggu sebentar
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // NOT FOUND
  // =========================================================

  if (!supplier) {
    return (
      <div className="min-h-screen bg-[#F6F8F7] p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Users size={25} />
            </div>

            <h1 className="text-lg font-semibold text-gray-800">
              Supplier tidak ditemukan
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Data supplier yang Anda cari tidak tersedia.
            </p>

            <Link
              href="/laporan/supplier"
              className="
                mt-5
                inline-flex
                items-center
                gap-2
                rounded-xl
                bg-[#497F70]
                px-5
                py-2.5
                text-sm
                font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-[#3d6c5f]
              "
            >
              <ArrowLeft size={16} />
              Kembali ke Laporan Supplier
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="min-h-screen bg-[#F6F8F7] p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3">
                <Link
                  href="/laporan/supplier"
                  className="
                    inline-flex
                    items-center
                    gap-2
                    text-sm
                    font-medium
                    text-[#497F70]
                    transition
                    hover:text-[#3d6c5f]
                    hover:underline
                  "
                >
                  <ArrowLeft size={16} />
                  Kembali ke Laporan Supplier
                </Link>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
                  <Users size={22} />
                </div>

                <div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">
                    {supplier.name}
                  </h1>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                    {supplier.code && (
                      <span>
                        {supplier.code}
                      </span>
                    )}

                    {supplier.city && (
                      <>
                        <span>•</span>

                        <span>
                          {supplier.city}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() =>
                loadData(
                  from,
                  to,
                  supplierId
                )
              }
              disabled={loading}
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-xl
                border
                border-gray-200
                bg-white
                px-4
                py-2.5
                text-sm
                font-medium
                text-gray-700
                shadow-sm
                transition
                hover:bg-gray-50
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
        </div>

        {/* =====================================================
            INFORMASI SUPPLIER
        ===================================================== */}

        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-900">
              Informasi Supplier
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Informasi dasar supplier
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                <Users size={14} />
                Supplier
              </div>

              <p className="mt-2 font-semibold text-gray-800">
                {supplier.name}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                <MapPin size={14} />
                Kota
              </div>

              <p className="mt-2 font-semibold text-gray-800">
                {supplier.city || "-"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                <Phone size={14} />
                Telepon
              </div>

              <p className="mt-2 font-semibold text-gray-800">
                {supplier.phone || "-"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                <Mail size={14} />
                Email
              </div>

              <p className="mt-2 break-all font-semibold text-gray-800">
                {supplier.email || "-"}
              </p>
            </div>
          </div>

          {supplier.address && (
            <div className="mt-4 rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                <MapPin size={14} />
                Alamat
              </div>

              <p className="mt-2 text-sm font-medium text-gray-700">
                {supplier.address}
              </p>
            </div>
          )}
        </div>

        {/* =====================================================
            SUMMARY
        ===================================================== */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Total Purchase Order
                </p>

                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {formatNumber(
                    summary.totalPO
                  )}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ShoppingCart size={20} />
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              Jumlah PO supplier
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Total Qty
                </p>

                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {formatNumber(
                    summary.totalQty
                  )}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
                <Package size={20} />
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              Total quantity barang
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Total Nilai Purchase
                </p>

                <p className="mt-2 text-2xl font-bold text-gray-900">
                  Rp{" "}
                  {formatNumber(
                    summary.grandTotal
                  )}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
                <Wallet size={20} />
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              Total nilai pembelian
            </p>
          </div>
        </div>

        {/* =====================================================
            FILTER
        ===================================================== */}

        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">
                Filter Laporan
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Cari nomor PO atau pilih periode transaksi supplier
              </p>
            </div>

            {(searchPO || from || to) && (
              <button
                onClick={resetFilter}
                className="
                  text-sm
                  font-medium
                  text-[#497F70]
                  hover:underline
                "
              >
                Reset Filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">

            {/* =================================================
                CARI NOMOR PO
            ================================================= */}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Cari Nomor PO
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
                  value={searchPO}
                  onChange={(e) =>
                    setSearchPO(
                      e.target.value
                    )
                  }
                  placeholder="Nomor PO..."
                  className="
                    w-full
                    rounded-xl
                    border
                    border-gray-200
                    bg-gray-50
                    py-2.5
                    pl-10
                    pr-9
                    text-sm
                    outline-none
                    transition
                    focus:border-[#497F70]
                    focus:bg-white
                  "
                />

                {searchPO && (
                  <button
                    type="button"
                    onClick={clearSearchPO}
                    className="
                      absolute
                      right-3
                      top-1/2
                      -translate-y-1/2
                      text-gray-400
                      transition
                      hover:text-gray-700
                    "
                    title="Hapus pencarian"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* =================================================
                DARI TANGGAL
            ================================================= */}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Dari Tanggal
              </label>

              <div className="relative">
                <CalendarDays
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
                  type="date"
                  value={from}
                  onChange={(e) =>
                    setFrom(
                      e.target.value
                    )
                  }
                  className="
                    w-full
                    rounded-xl
                    border
                    border-gray-200
                    bg-gray-50
                    py-2.5
                    pl-10
                    pr-3
                    text-sm
                    outline-none
                    transition
                    focus:border-[#497F70]
                    focus:bg-white
                  "
                />
              </div>
            </div>

            {/* =================================================
                SAMPAI TANGGAL
            ================================================= */}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Sampai Tanggal
              </label>

              <div className="relative">
                <CalendarDays
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
                  type="date"
                  value={to}
                  onChange={(e) =>
                    setTo(
                      e.target.value
                    )
                  }
                  className="
                    w-full
                    rounded-xl
                    border
                    border-gray-200
                    bg-gray-50
                    py-2.5
                    pl-10
                    pr-3
                    text-sm
                    outline-none
                    transition
                    focus:border-[#497F70]
                    focus:bg-white
                  "
                />
              </div>
            </div>

            {/* =================================================
                FILTER BUTTON
            ================================================= */}

            <div className="flex items-end">
              <button
                onClick={handleFilter}
                className="
                  inline-flex
                  w-full
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-[#497F70]
                  px-5
                  py-2.5
                  text-sm
                  font-semibold
                  text-white
                  shadow-sm
                  transition
                  hover:bg-[#3d6c5f]
                "
              >
                <CalendarDays size={16} />
                Terapkan Filter
              </button>
            </div>

            {/* =================================================
                EXPORT
            ================================================= */}

            <div className="flex items-end gap-2">
              <button
                onClick={() =>
                  window.print()
                }
                className="
                  inline-flex
                  flex-1
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-gray-700
                  px-3
                  py-2.5
                  text-sm
                  font-medium
                  text-white
                  transition
                  hover:bg-gray-800
                "
              >
                <Printer size={16} />
                Print
              </button>

              <button
                onClick={() =>
                  exportSupplierExcel(
                    supplier,
                    filteredPurchases
                  )
                }
                className="
                  inline-flex
                  flex-1
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-green-600
                  px-3
                  py-2.5
                  text-sm
                  font-medium
                  text-white
                  transition
                  hover:bg-green-700
                "
              >
                <Download size={16} />
                Excel
              </button>

              <button
                onClick={() =>
                  exportSupplierPdf(
                    supplier,
                    filteredPurchases
                  )
                }
                className="
                  inline-flex
                  flex-1
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-red-600
                  px-3
                  py-2.5
                  text-sm
                  font-medium
                  text-white
                  transition
                  hover:bg-red-700
                "
              >
                <Download size={16} />
                PDF
              </button>
            </div>
          </div>

          {/* =================================================
              SEARCH INFO
          ================================================= */}

          {searchPO && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-[#D7E8E1] bg-[#EDF5F2] px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-[#497F70]">
                <Search size={16} />

                <span>
                  Hasil pencarian nomor PO:
                </span>

                <span className="font-semibold">
                  "{searchPO}"
                </span>
              </div>

              <span className="text-sm font-semibold text-gray-700">
                {filteredPurchases.length} PO
              </span>
            </div>
          )}
        </div>

        {/* =====================================================
            RIWAYAT PURCHASE ORDER + DETAIL BARANG
            MENYATU
        ===================================================== */}

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">

          {/* HEADER */}

          <div className="flex flex-col gap-2 border-b border-gray-100 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">
                Riwayat Purchase Order
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Riwayat transaksi dan detail barang supplier
              </p>
            </div>

            <div className="text-sm text-gray-500">
              Menampilkan{" "}
              <span className="font-semibold text-gray-800">
                {filteredPurchases.length}
              </span>
              {" "}Purchase Order
            </div>
          </div>

          {/* CONTENT */}

          {filteredPurchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <FileText size={22} />
              </div>

              <p className="font-medium text-gray-700">
                {searchPO
                  ? "Purchase Order tidak ditemukan"
                  : "Tidak ada transaksi"}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                {searchPO
                  ? `Tidak ditemukan PO dengan nomor "${searchPO}".`
                  : "Tidak ditemukan Purchase Order pada periode tersebut."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredPurchases.map(
                (po: any) => (
                  <div
                    key={`purchase-${po.id}`}
                    className="p-5"
                  >

                    {/* =================================================
                        PO HEADER
                    ================================================= */}

                    <div className="overflow-hidden rounded-xl border border-gray-200">

                      <div className="bg-[#EDF5F2] px-4 py-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">

                          {/* PO NUMBER */}

                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                              No Purchase Order
                            </p>

                            <div className="mt-1 flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#497F70]">
                                <ShoppingCart size={16} />
                              </div>

                              <p className="font-bold text-gray-900">
                                {po.number || "-"}
                              </p>
                            </div>
                          </div>

                          {/* DATE */}

                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                              Tanggal
                            </p>

                            <p className="mt-2 font-semibold text-gray-800">
                              {formatDate(
                                po.purchaseDate
                              )}
                            </p>
                          </div>

                          {/* STATUS */}

                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                              Status
                            </p>

                            <div className="mt-2">
                              <span
                                className={`
                                  inline-flex
                                  items-center
                                  rounded-full
                                  border
                                  px-3
                                  py-1
                                  text-xs
                                  font-semibold
                                  ${getStatusClass(
                                    po.status
                                  )}
                                `}
                              >
                                {getStatusLabel(
                                  po.status
                                )}
                              </span>
                            </div>
                          </div>

                          {/* TOTAL */}

                          <div className="md:text-right">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                              Total PO
                            </p>

                            <p className="mt-2 font-bold text-gray-900">
                              Rp{" "}
                              {formatNumber(
                                Number(
                                  po.total || 0
                                )
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* =================================================
                          DETAIL BARANG PO
                      ================================================= */}

                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-t border-gray-200 bg-gray-50">
                              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                                Barang
                              </th>

                              <th className="px-4 py-3 text-center font-semibold text-gray-600">
                                Qty
                              </th>

                              <th className="px-4 py-3 text-right font-semibold text-gray-600">
                                Harga
                              </th>

                              <th className="px-4 py-3 text-right font-semibold text-gray-600">
                                Subtotal
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {Array.isArray(
                              po.items
                            ) &&
                            po.items.length > 0 ? (
                              po.items.map(
                                (
                                  item: any
                                ) => (
                                  <tr
                                    key={`purchase-${po.id}-item-${item.id}`}
                                    className="border-t border-gray-100 transition hover:bg-gray-50"
                                  >
                                    {/* BARANG */}

                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                                          <Package size={15} />
                                        </div>

                                        <span className="font-medium text-gray-800">
                                          {item.barang?.name ||
                                            "-"}
                                        </span>
                                      </div>
                                    </td>

                                    {/* QTY */}

                                    <td className="px-4 py-3 text-center font-medium text-gray-700">
                                      {formatNumber(
                                        Number(
                                          item.qty || 0
                                        )
                                      )}
                                    </td>

                                    {/* HARGA */}

                                    <td className="whitespace-nowrap px-4 py-3 text-right text-gray-700">
                                      Rp{" "}
                                      {formatNumber(
                                        Number(
                                          item.price || 0
                                        )
                                      )}
                                    </td>

                                    {/* SUBTOTAL */}

                                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-900">
                                      Rp{" "}
                                      {formatNumber(
                                        Number(
                                          item.subtotal || 0
                                        )
                                      )}
                                    </td>
                                  </tr>
                                )
                              )
                            ) : (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="px-4 py-6 text-center text-sm text-gray-400"
                                >
                                  Tidak ada detail barang.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}