"use client";

import { useEffect, useState } from "react";

export default function BarangKeluar() {
  const [delivery, setDelivery] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const res = await fetch("/api/barang-keluar");
      const result = await res.json();

      if (Array.isArray(result)) {
        setDelivery(result);
      } else if (result.success) {
        setDelivery(result.data || []);
      } else {
        setDelivery([]);
      }
    } catch (error) {
      console.error(error);
      setDelivery([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">

      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold">
          Barang Keluar
        </h1>

        <button
          onClick={loadData}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Refresh
        </button>
      </div>

      <table className="w-full border-collapse border border-gray-300">

        <thead className="bg-slate-200">

          <tr>

            <th className="border p-2">No Surat Jalan</th>

            <th className="border p-2">Customer</th>

            <th className="border p-2">Tanggal</th>

            <th className="border p-2">Driver</th>

            <th className="border p-2">Kendaraan</th>

            <th className="border p-2">Jumlah Item</th>

          </tr>

        </thead>

        <tbody>

          {loading ? (

            <tr>

              <td
                colSpan={6}
                className="border p-4 text-center"
              >
                Loading...
              </td>

            </tr>

          ) : delivery.length === 0 ? (

            <tr>

              <td
                colSpan={6}
                className="border p-4 text-center"
              >
                Belum ada data pengiriman
              </td>

            </tr>

          ) : (

            delivery.map((x: any) => (

              <tr key={x.id}>

                <td className="border p-2">
                  {x.number}
                </td>

                <td className="border p-2">
                  {x.customer?.name ?? "-"}
                </td>

                <td className="border p-2">
                  {new Date(x.deliveryDate).toLocaleDateString("id-ID")}
                </td>

                <td className="border p-2">
                  {x.driver ?? "-"}
                </td>

                <td className="border p-2">
                  {x.vehicle ?? "-"}
                </td>

                <td className="border p-2 text-center">
                  {x.items?.length ?? 0}
                </td>

              </tr>

            ))

          )}

        </tbody>

      </table>

    </div>
  );
}