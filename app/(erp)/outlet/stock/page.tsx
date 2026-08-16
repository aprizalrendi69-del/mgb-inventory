"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Package } from "lucide-react";

type Stock = {
  id: number;
  outletId: number;
  barangId: number;
  stock: number;
  minimumStock: number;
  averageCost: number;
  barang: {
    id: number;
    code: string;
    barcode: string | null;
    name: string;
    unit: string;
  };
  outlet: {
    id: number;
    code: string;
    name: string;
  };
};

export default function OutletStockPage() {
  const [data, setData] = useState<Stock[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadStock() {
    try {
      setLoading(true);

      const res = await fetch("/api/outlet/stock");

      if (!res.ok) {
        throw new Error("Gagal mengambil stock");
      }

      const result = await res.json();

      setData(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error("LOAD OUTLET STOCK ERROR:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStock();
  }, []);

  const filteredData = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) return data;

    return data.filter(
      (item) =>
        item.barang.code.toLowerCase().includes(keyword) ||
        item.barang.name.toLowerCase().includes(keyword) ||
        (item.barang.barcode ?? "").toLowerCase().includes(keyword)
    );
  }, [data, search]);

  function getStatus(stock: number, minimum: number) {
    if (stock <= 0) {
      return {
        text: "HABIS",
        className: "bg-red-100 text-red-700",
      };
    }

    if (stock <= minimum) {
      return {
        text: "MINIMUM",
        className: "bg-yellow-100 text-yellow-700",
      };
    }

    return {
      text: "AMAN",
      className: "bg-green-100 text-green-700",
    };
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Stock Outlet
          </h1>

          <p className="text-sm text-gray-500">
            Daftar persediaan barang pada outlet
          </p>
        </div>

        <button
          onClick={loadStock}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b">
          <div className="relative max-w-md">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              placeholder="Cari kode, barcode, atau nama barang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3">No</th>
                <th className="text-left px-4 py-3">Kode</th>
                <th className="text-left px-4 py-3">Nama Barang</th>
                <th className="text-left px-4 py-3">Satuan</th>
                <th className="text-right px-4 py-3">Stok</th>
                <th className="text-right px-4 py-3">Minimum</th>
                <th className="text-center px-4 py-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-10 text-gray-500"
                  >
                    Memuat stock...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-12 text-gray-500"
                  >
                    <Package
                      size={40}
                      className="mx-auto mb-2 text-gray-300"
                    />

                    Belum ada data stock outlet.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => {
                  const status = getStatus(
                    item.stock,
                    item.minimumStock
                  );

                  return (
                    <tr
                      key={item.id}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        {index + 1}
                      </td>

                      <td className="px-4 py-3 font-medium">
                        {item.barang.code}
                      </td>

                      <td className="px-4 py-3">
                        {item.barang.name}
                      </td>

                      <td className="px-4 py-3">
                        {item.barang.unit}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold">
                        {item.stock}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {item.minimumStock}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${status.className}`}
                        >
                          {status.text}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}