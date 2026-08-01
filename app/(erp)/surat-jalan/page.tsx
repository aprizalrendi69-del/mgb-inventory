"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function SuratJalanPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const res = await fetch("/api/delivery");
      const json = await res.json();

      const deliveries = Array.isArray(json)
        ? json
        : Array.isArray(json.data)
        ? json.data
        : [];

      setData(deliveries);
    } catch (error) {
      console.error(error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">
          Surat Jalan
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-3">Nomor DO</th>
              <th className="text-left p-3">Tanggal</th>
              <th className="text-left p-3">Customer</th>
              <th className="text-center p-3">Status</th>
              <th className="text-center p-3">Aksi</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center p-6">
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center p-6">
                  Belum ada Delivery Order
                </td>
              </tr>
            ) : (
              data.map((item: any) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3">{item.number}</td>

                  <td className="p-3">
                    {new Date(item.deliveryDate).toLocaleDateString("id-ID")}
                  </td>

                  <td className="p-3">
                    {item.customer?.name}
                  </td>

                  <td className="p-3 text-center">
                    {item.status}
                  </td>

                  <td className="p-3 text-center">
                    <Link
                      href={`/surat-jalan/${item.id}`}
                      className="bg-blue-600 text-white px-3 py-2 rounded"
                    >
                      Cetak
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}