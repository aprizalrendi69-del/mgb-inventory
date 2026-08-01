"use client";

import { useEffect, useState } from "react";

export default function InventoryPage() {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  async function loadData() {
    try {
      const res = await fetch("/api/inventory");
      const result = await res.json();

      if (result.success) {
        setData(result.data);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error(error);
      setData([]);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filter = data.filter((item: any) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="bg-white shadow rounded-xl p-6">

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">
            Inventory Stock
          </h1>

          <input
            className="border rounded-lg p-2 w-72"
            placeholder="Cari barang..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <table className="w-full border border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">No</th>
              <th className="border p-2">Kode</th>
              <th className="border p-2">Nama Barang</th>
              <th className="border p-2">Satuan</th>
              <th className="border p-2">Gudang</th>
              <th className="border p-2">Stock</th>
              <th className="border p-2">Available</th>
              <th className="border p-2">Reserved</th>
              <th className="border p-2">Min Stock</th>
              <th className="border p-2">Average Cost</th>
              <th className="border p-2">Status</th>
            </tr>
          </thead>

          <tbody>
            {filter.length === 0 ? (
              <tr>
                <td colSpan={11} className="border p-4 text-center">
                  Tidak ada data
                </td>
              </tr>
            ) : (
              filter.map((item: any, index: number) => (
                <tr key={item.id}>
                  <td className="border p-2 text-center">
                    {index + 1}
                  </td>

                  <td className="border p-2">
                    {item.code}
                  </td>

                  <td className="border p-2">
                    {item.name}
                  </td>

                  <td className="border p-2 text-center">
                    {item.unit}
                  </td>

                  <td className="border p-2 text-center">
                    {item.warehouse}
                  </td>

                  <td className="border p-2 text-center font-semibold">
                    {item.stock}
                  </td>

                  <td className="border p-2 text-center">
                    {item.availableStock}
                  </td>

                  <td className="border p-2 text-center">
                    {item.reservedStock}
                  </td>

                  <td className="border p-2 text-center">
                    {item.minimumStock}
                  </td>

                  <td className="border p-2 text-right">
                    {Number(item.averageCost).toLocaleString("id-ID")}
                  </td>

                  <td className="border p-2 text-center">
                    {item.stock <= item.minimumStock ? (
                      <span className="text-red-600 font-bold">
                        STOCK MENIPIS
                      </span>
                    ) : (
                      <span className="text-green-600 font-semibold">
                        AMAN
                      </span>
                    )}
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