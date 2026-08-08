"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function loadData() {
    try {
      setLoading(true);

      const { id } = await params;

      let url = `/api/laporan/supplier/${id}`;

      const query: string[] = [];

      if (from) {
        query.push(`from=${encodeURIComponent(from)}`);
      }

      if (to) {
        query.push(`to=${encodeURIComponent(to)}`);
      }

      if (query.length > 0) {
        url += "?" + query.join("&");
      }

      const res = await fetch(url, {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setSupplier(json.supplier);
        setPurchases(json.purchases || []);
      } else {
        setSupplier(null);
        setPurchases([]);
      }
    } catch (error) {
      console.error("DETAIL SUPPLIER ERROR:", error);
      setSupplier(null);
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(() => {
    let totalPO = purchases.length;
    let totalQty = 0;
    let grandTotal = 0;

    purchases.forEach((po: any) => {
      grandTotal += Number(po.total || 0);

      if (Array.isArray(po.items)) {
        po.items.forEach((item: any) => {
          totalQty += Number(item.qty || 0);
        });
      }
    });

    return {
      totalPO,
      totalQty,
      grandTotal,
    };
  }, [purchases]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="text-lg font-semibold text-slate-700">
              Loading...
            </div>

            <div className="mt-2 text-sm text-slate-500">
              Memuat detail supplier
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="text-lg font-semibold text-slate-700">
              Supplier tidak ditemukan
            </div>

            <a
              href="/laporan/supplier"
              className="mt-5 inline-block rounded-lg bg-[#497F70] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3d6d60]"
            >
              Kembali
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              {supplier.name}
            </h1>

            <div className="mt-1 flex flex-wrap gap-2 text-sm text-slate-500">
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

          <a
            href="/laporan/supplier"
            className="rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Kembali
          </a>
        </div>

        {/* SUPPLIER INFO */}

        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Supplier
              </div>

              <div className="mt-1 font-semibold text-slate-700">
                {supplier.name}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Kota
              </div>

              <div className="mt-1 font-semibold text-slate-700">
                {supplier.city || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Telepon
              </div>

              <div className="mt-1 font-semibold text-slate-700">
                {supplier.phone || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Email
              </div>

              <div className="mt-1 break-all font-semibold text-slate-700">
                {supplier.email || "-"}
              </div>
            </div>

          </div>
        </div>

        {/* FILTER */}

        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-800">
              Filter Laporan
            </h2>

            <p className="text-sm text-slate-500">
              Pilih periode transaksi supplier
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Dari Tanggal
              </label>

              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-[#497F70]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Sampai Tanggal
              </label>

              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-[#497F70]"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={loadData}
                className="w-full rounded-lg bg-[#497F70] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#3d6d60]"
              >
                Filter
              </button>
            </div>

            <div className="flex items-end justify-start gap-2 lg:justify-end">

              <button
                onClick={() => window.print()}
                className="rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Print
              </button>

              <button
                onClick={() =>
                  exportSupplierExcel(
                    supplier,
                    purchases
                  )
                }
                className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
              >
                Excel
              </button>

              <button
                onClick={() =>
                  exportSupplierPdf(
                    supplier,
                    purchases
                  )
                }
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                PDF
              </button>

            </div>

          </div>
        </div>

        {/* SUMMARY */}

        <div className="mb-6 grid gap-5 md:grid-cols-3">

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <div className="text-sm font-medium text-slate-500">
              Total PO
            </div>

            <div className="mt-2 text-3xl font-bold text-slate-800">
              {summary.totalPO.toLocaleString("id-ID")}
            </div>
          </div>

          <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
            <div className="text-sm font-medium text-slate-500">
              Total Qty
            </div>

            <div className="mt-2 text-3xl font-bold text-slate-800">
              {summary.totalQty.toLocaleString("id-ID")}
            </div>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
            <div className="text-sm font-medium text-slate-500">
              Total Nilai PO
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-800">
              Rp{" "}
              {summary.grandTotal.toLocaleString("id-ID")}
            </div>
          </div>

        </div>

        {/* PURCHASE HISTORY */}

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">

          <div className="border-b border-slate-100 p-5">
            <h2 className="text-xl font-bold text-slate-800">
              Riwayat Purchase Order
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Daftar transaksi Purchase Order supplier
            </p>
          </div>

          <div className="overflow-x-auto">

            <table className="w-full border-collapse">

              <thead>
                <tr className="bg-slate-50">

                  <th className="border border-slate-200 p-3 text-left text-sm font-semibold text-slate-700">
                    No PO
                  </th>

                  <th className="border border-slate-200 p-3 text-left text-sm font-semibold text-slate-700">
                    Tanggal
                  </th>

                  <th className="border border-slate-200 p-3 text-left text-sm font-semibold text-slate-700">
                    Status
                  </th>

                  <th className="border border-slate-200 p-3 text-right text-sm font-semibold text-slate-700">
                    Total
                  </th>

                </tr>
              </thead>

              <tbody>

                {purchases.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-10 text-center text-sm text-slate-500"
                    >
                      Tidak ada transaksi.
                    </td>
                  </tr>
                )}

                {purchases.map((po: any) => (

                  /*
                   * KEY HARUS ADA DI ELEMENT TERLUAR
                   * YANG DIHASILKAN OLEH MAP.
                   */
                  <tr
                    key={`purchase-${po.id}`}
                    className="border-b border-slate-100"
                  >
                    <td
                      colSpan={4}
                      className="p-0"
                    >

                      <table className="w-full border-collapse">

                        <tbody>

                          {/* PURCHASE HEADER */}

                          <tr className="bg-blue-50 font-semibold">

                            <td className="border border-slate-200 p-3">
                              {po.number || "-"}
                            </td>

                            <td className="border border-slate-200 p-3">
                              {po.purchaseDate
                                ? new Date(
                                    po.purchaseDate
                                  ).toLocaleDateString(
                                    "id-ID"
                                  )
                                : "-"
                              }
                            </td>

                            <td className="border border-slate-200 p-3">
                              {po.status || "-"}
                            </td>

                            <td className="border border-slate-200 p-3 text-right">
                              Rp{" "}
                              {Number(
                                po.total || 0
                              ).toLocaleString(
                                "id-ID"
                              )}
                            </td>

                          </tr>

                          {/* ITEMS */}

                          <tr>
                            <td
                              colSpan={4}
                              className="border border-slate-200 p-0"
                            >

                              <table className="w-full border-collapse">

                                <thead>
                                  <tr className="bg-slate-100">

                                    <th className="border border-slate-200 p-2 text-left text-xs font-semibold text-slate-600">
                                      Barang
                                    </th>

                                    <th className="border border-slate-200 p-2 text-center text-xs font-semibold text-slate-600">
                                      Qty
                                    </th>

                                    <th className="border border-slate-200 p-2 text-right text-xs font-semibold text-slate-600">
                                      Harga
                                    </th>

                                    <th className="border border-slate-200 p-2 text-right text-xs font-semibold text-slate-600">
                                      Subtotal
                                    </th>

                                  </tr>
                                </thead>

                                <tbody>

                                  {Array.isArray(
                                    po.items
                                  ) &&
                                    po.items.map(
                                      (item: any) => (
                                        <tr
                                          key={`purchase-${po.id}-item-${item.id}`}
                                        >

                                          <td className="border border-slate-200 p-2 text-sm">
                                            {item.barang?.name ||
                                              "-"}
                                          </td>

                                          <td className="border border-slate-200 p-2 text-center text-sm">
                                            {Number(
                                              item.qty || 0
                                            ).toLocaleString(
                                              "id-ID"
                                            )}
                                          </td>

                                          <td className="border border-slate-200 p-2 text-right text-sm">
                                            Rp{" "}
                                            {Number(
                                              item.price || 0
                                            ).toLocaleString(
                                              "id-ID"
                                            )}
                                          </td>

                                          <td className="border border-slate-200 p-2 text-right text-sm">
                                            Rp{" "}
                                            {Number(
                                              item.subtotal || 0
                                            ).toLocaleString(
                                              "id-ID"
                                            )}
                                          </td>

                                        </tr>
                                      )
                                    )}

                                </tbody>

                              </table>

                            </td>
                          </tr>

                        </tbody>

                      </table>

                    </td>
                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </div>

      </div>
    </div>
  );
}