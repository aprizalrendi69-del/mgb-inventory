"use client";

import { useEffect, useMemo, useState } from "react";
import { exportSupplierExcel } from "@/lib/exportSupplierExcel";
import { exportSupplierPdf } from "@/lib/exportSupplierPdf";

export default function DetailSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [supplier, setSupplier] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function loadData() {
    setLoading(true);

    const { id } = await params;

    let url = `/api/laporan/supplier/${id}`;

    const query = [];

    if (from) query.push(`from=${from}`);
    if (to) query.push(`to=${to}`);

    if (query.length > 0) {
      url += "?" + query.join("&");
    }

    const res = await fetch(url);
    const json = await res.json();

    if (json.success) {
      setSupplier(json.supplier);
      setPurchases(json.purchases);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(() => {
    let totalPO = purchases.length;
    let totalQty = 0;
    let grandTotal = 0;

    purchases.forEach((po: any) => {
      grandTotal += po.total;

      po.items.forEach((item: any) => {
        totalQty += item.qty;
      });
    });

    return {
      totalPO,
      totalQty,
      grandTotal,
    };
  }, [purchases]);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!supplier) {
    return <div className="p-8">Supplier tidak ditemukan.</div>;
  }

  return (
    <div className="p-8">

      <div className="flex justify-between items-center mb-6">

        <div>

          <h1 className="text-3xl font-bold">
            {supplier.name}
          </h1>

          <p className="text-gray-500">
            {supplier.city}
          </p>

        </div>

        <a
          href="/laporan/supplier"
          className="bg-gray-600 text-white px-4 py-2 rounded"
        >
          Kembali
        </a>

      </div>
            <div className="bg-white rounded-xl shadow p-5 mb-6">

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">

          <div>

            <label className="block mb-1 font-semibold">
              Dari Tanggal
            </label>

            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border rounded-lg p-2 w-full"
            />

          </div>

          <div>

            <label className="block mb-1 font-semibold">
              Sampai Tanggal
            </label>

            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border rounded-lg p-2 w-full"
            />

          </div>

          <div className="flex items-end">

            <button
              onClick={loadData}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
            >
              Filter
            </button>

          </div>

          <div className="flex items-end justify-end gap-2">

            <button
              onClick={() => window.print()}
              className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg"
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
  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
>
  Export Excel
</button>

            <button
  onClick={() =>
    exportSupplierPdf(
      supplier,
      purchases
    )
  }
  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
>
  Export PDF
</button>

          </div>

        </div>

      </div>

      <div className="grid md:grid-cols-3 gap-5 mb-6">

        <div className="bg-blue-50 border rounded-xl p-5">

          <div className="text-gray-500">
            Total PO
          </div>

          <div className="text-3xl font-bold mt-2">
            {summary.totalPO}
          </div>

        </div>

        <div className="bg-green-50 border rounded-xl p-5">

          <div className="text-gray-500">
            Total Qty
          </div>

          <div className="text-3xl font-bold mt-2">
            {summary.totalQty.toLocaleString("id-ID")}
          </div>

        </div>

        <div className="bg-orange-50 border rounded-xl p-5">

          <div className="text-gray-500">
            Total Nilai PO
          </div>

          <div className="text-2xl font-bold mt-2">

            Rp{" "}

            {summary.grandTotal.toLocaleString("id-ID")}

          </div>

        </div>

      </div>

      <div className="bg-white rounded-xl shadow p-5">

        <h2 className="text-xl font-bold mb-5">

          Riwayat Purchase Order

        </h2>
                <table className="w-full border border-collapse">

          <thead>

            <tr className="bg-slate-100">

              <th className="border p-3">
                No PO
              </th>

              <th className="border p-3">
                Tanggal
              </th>

              <th className="border p-3">
                Status
              </th>

              <th className="border p-3">
                Total
              </th>

            </tr>

          </thead>

          <tbody>

            {

              purchases.length === 0 && (

                <tr>

                  <td
                    colSpan={4}
                    className="text-center p-8"
                  >

                    Tidak ada transaksi.

                  </td>

                </tr>

              )

            }

            {

              purchases.map((po: any) => (

                <>

                  <tr
                    key={po.id}
                    className="bg-blue-50 font-semibold"
                  >

                    <td className="border p-3">

                      {po.number}

                    </td>

                    <td className="border p-3">

                      {new Date(
                        po.purchaseDate
                      ).toLocaleDateString("id-ID")}

                    </td>

                    <td className="border p-3">

                      {po.status}

                    </td>

                    <td className="border p-3 text-right">

                      Rp{" "}

                      {Number(po.total).toLocaleString("id-ID")}

                    </td>

                  </tr>

                  <tr>

                    <td
                      colSpan={4}
                      className="p-0"
                    >

                      <table className="w-full">

                        <thead>

                          <tr className="bg-gray-100">

                            <th className="border p-2">
                              Barang
                            </th>

                            <th className="border p-2">
                              Qty
                            </th>

                            <th className="border p-2">
                              Harga
                            </th>

                            <th className="border p-2">
                              Subtotal
                            </th>

                          </tr>

                        </thead>

                        <tbody>

                          {

                            po.items.map((item: any) => (

                              <tr key={item.id}>

                                <td className="border p-2">

                                  {item.barang?.name}

                                </td>

                                <td className="border p-2 text-center">

                                  {item.qty}

                                </td>

                                <td className="border p-2 text-right">

                                  Rp{" "}

                                  {Number(item.price).toLocaleString("id-ID")}

                                </td>

                                <td className="border p-2 text-right">

                                  Rp{" "}

                                  {Number(item.subtotal).toLocaleString("id-ID")}

                                </td>

                              </tr>

                            ))

                          }

                        </tbody>

                      </table>

                    </td>

                  </tr>

                </>

              ))

            }

          </tbody>

        </table>

      </div>

    </div>

  );

}