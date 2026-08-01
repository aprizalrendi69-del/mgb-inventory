"use client";

import { useEffect, useMemo, useState } from "react";

export default function LaporanSupplierPage() {

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadData() {

    try {

      const res = await fetch("/api/laporan/supplier");
      const json = await res.json();

      if (json.success) {
        setData(json.data);
      }

    } catch (err) {

      console.log(err);

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    loadData();

  }, []);

  const supplier = useMemo(() => {

    return data.filter((item: any) => {

      const keyword = search.toLowerCase();

      return (
        item.name?.toLowerCase().includes(keyword) ||
        item.city?.toLowerCase().includes(keyword)
      );

    });

  }, [data, search]);

  if (loading) {

    return (
      <div className="p-8">
        Loading...
      </div>
    );

  }

  return (

    <div className="p-8">

      <div className="flex justify-between items-center mb-6">

        <h1 className="text-3xl font-bold">

          Laporan Supplier

        </h1>

      </div>

      <div className="bg-white rounded-xl shadow p-5">

        <div className="flex justify-between mb-5">

          <input
            type="text"
            placeholder="Cari Supplier..."
            className="border rounded-lg px-4 py-2 w-80"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="text-gray-500">

            Total Supplier : {supplier.length}

          </div>

        </div>

        <table className="w-full border">

          <thead>

            <tr className="bg-slate-100">

              <th className="border p-3 text-left">
                Supplier
              </th>

              <th className="border p-3">
                Kota
              </th>

              <th className="border p-3">
                Total PO
              </th>

              <th className="border p-3">
                Nilai PO
              </th>

              <th className="border p-3">
                Transaksi Terakhir
              </th>

            </tr>

          </thead>

          <tbody>

            {
              supplier.length === 0 &&
              (
                <tr>

                  <td
                    colSpan={5}
                    className="text-center p-10"
                  >

                    Tidak ada data supplier.

                  </td>

                </tr>
              )
            }

            {
              supplier.map((item: any) => (

                <tr
                  key={item.id}
                  className="hover:bg-gray-50"
                >

                  <td className="border p-3">

                    <a
                      href={`/laporan/supplier/${item.id}`}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      {item.name}
                    </a>

                  </td>

                  <td className="border p-3">

                    {item.city ?? "-"}

                  </td>

                  <td className="border p-3 text-center">

                    {item.totalPO}

                  </td>

                  <td className="border p-3 text-right">

                    Rp{" "}
                    {Number(item.totalValue).toLocaleString("id-ID")}

                  </td>

                  <td className="border p-3 text-center">

                    {new Date(
                      item.lastTransaction
                    ).toLocaleDateString("id-ID")}
                                      </td>

                </tr>

              ))
            }

          </tbody>

        </table>

      </div>

    </div>

  );

}