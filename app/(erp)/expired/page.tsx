"use client";

import { useEffect, useMemo, useState } from "react";

export default function ExpiredPage() {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("SEMUA");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/barang-batch");
      const json = await res.json();

      if (json.success) {
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    return data.filter((item) => {
      const cocokNama =
        item.namaBarang
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        item.kodeBarang
          .toLowerCase()
          .includes(search.toLowerCase());

      const cocokStatus =
        status === "SEMUA" ||
        item.status === status;

      return cocokNama && cocokStatus;
    });
  }, [data, search, status]);

  return (
    <div className="p-8">

      <div className="flex justify-between items-center mb-6">

        <div>

          <h1 className="text-3xl font-bold">
            Monitoring Barang Expired
          </h1>

          <p className="text-gray-500">
            Monitoring seluruh batch barang
          </p>

        </div>

      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-5">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <input
            className="border rounded-lg p-2"
            placeholder="Cari kode / nama barang..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

          <select
            className="border rounded-lg p-2"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value)
            }
          >
            <option value="SEMUA">Semua</option>
            <option value="WARNING">Warning</option>
            <option value="EXPIRED">Expired</option>
            <option value="AMAN">Aman</option>
          </select>

        </div>

      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">

        <table className="w-full">

          <thead className="bg-slate-100">

            <tr>

              <th className="p-3 text-left">
                Kode
              </th>

              <th className="p-3 text-left">
                Barang
              </th>

              <th className="p-3 text-left">
                Batch
              </th>

              <th className="p-3 text-center">
                Qty
              </th>

              <th className="p-3 text-center">
                Expired
              </th>

              <th className="p-3 text-center">
                Sisa Hari
              </th>

              <th className="p-3 text-center">
                Status
              </th>

            </tr>

          </thead>

          <tbody>

            {loading ? (

              <tr>

                <td
                  colSpan={7}
                  className="text-center p-8"
                >
                  Loading...
                </td>

              </tr>

            ) : filtered.length === 0 ? (

              <tr>

                <td
                  colSpan={7}
                  className="text-center p-8"
                >
                  Tidak ada data
                </td>

              </tr>

            ) : (

              filtered.map((item) => (

                <tr
                  key={item.id}
                  className="border-b hover:bg-slate-50"
                >

                  <td className="p-3">
                    {item.kodeBarang}
                  </td>

                  <td className="p-3 font-medium">
                    {item.namaBarang}
                  </td>

                  <td className="p-3">
                    {item.batchNumber}
                  </td>

                  <td className="p-3 text-center">
                    {item.qty}
                  </td>

                  <td className="p-3 text-center">
                    {new Date(
                      item.expiredDate
                    ).toLocaleDateString("id-ID")}
                  </td>

                  <td className="p-3 text-center">

                    {item.status === "EXPIRED"
                      ? `${Math.abs(
                          item.sisaHari
                        )} Hari Lewat`
                      : `${item.sisaHari} Hari`}

                  </td>

                  <td className="p-3 text-center">

                    {item.status ===
                    "EXPIRED" ? (

                      <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs">
                        EXPIRED
                      </span>

                    ) : item.status ===
                      "WARNING" ? (

                      <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-xs">
                        WARNING
                      </span>

                    ) : (

                      <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs">
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