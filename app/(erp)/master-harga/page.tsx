"use client";

import { useEffect, useState } from "react";

export default function MasterHargaPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const res = await fetch("/api/master-harga");
    const json = await res.json();

    if (json.success) {
      setRows(json.data);
    }

    setLoading(false);
  }

  return (
    <div className="p-6">

      <h1 className="text-2xl font-bold mb-6">
        Master Harga
      </h1>

      <div className="overflow-auto rounded-lg border">

        <table className="min-w-full text-sm">

          <thead className="bg-gray-100">

            <tr>

              <th className="p-3 text-left">Tanggal</th>

              <th className="p-3 text-left">PO</th>

              <th className="p-3 text-left">Supplier</th>

              <th className="p-3 text-left">Barang</th>

              <th className="p-3 text-right">Harga Lama</th>

              <th className="p-3 text-right">Harga Baru</th>

              <th className="p-3 text-right">Selisih</th>

              <th className="p-3 text-right">%</th>

              <th className="p-3 text-right">Qty</th>

              <th className="p-3 text-right">Total</th>

            </tr>

          </thead>

          <tbody>

            {loading && (

              <tr>

                <td colSpan={10} className="text-center p-8">

                  Loading...

                </td>

              </tr>

            )}

            {!loading && rows.length === 0 && (

              <tr>

                <td colSpan={10} className="text-center p-8">

                  Belum ada histori harga

                </td>

              </tr>

            )}

            {rows.map((row) => (

              <tr
                key={row.id}
                className="border-t"
              >

                <td className="p-3">
                  {row.receiveDate
                    ? new Date(row.receiveDate).toLocaleDateString("id-ID")
                    : "-"}
                </td>

                <td className="p-3">
                  {row.poNumber}
                </td>

                <td className="p-3">
                  {row.supplier?.name}
                </td>

                <td className="p-3">
                  {row.barang?.name}
                </td>

                <td className="p-3 text-right">
                  {row.hargaLama.toLocaleString()}
                </td>

                <td className="p-3 text-right">
                  {row.hargaBaru.toLocaleString()}
                </td>

                <td className="p-3 text-right">
                  {row.selisihHarga.toLocaleString()}
                </td>

                <td className="p-3 text-right">
                  {row.persenNaik.toFixed(2)}%
                </td>

                <td className="p-3 text-right">
                  {row.qty}
                </td>

                <td className="p-3 text-right">
                  {row.total.toLocaleString()}
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}