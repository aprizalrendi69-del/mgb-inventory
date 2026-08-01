"use client";

import Link from "next/link";

export default function BarangTable({
  data,
  reload,
}: {
  data: any[];
  reload: () => void;
}) {
  async function hapus(id: number) {
    if (!confirm("Hapus barang ini?")) return;

    const res = await fetch(`/api/master/barang/${id}`, {
      method: "DELETE",
    });

    const json = await res.json();

    if (json.success) {
      reload();
    } else {
      alert(json.message);
    }
  }

  return (
    <table className="w-full border mt-5">
      <thead className="bg-slate-100">
        <tr>
          <th className="border p-2">Kode</th>
          <th className="border p-2">Barcode</th>
          <th className="border p-2">Nama</th>
          <th className="border p-2">Kategori</th>
          <th className="border p-2">Satuan</th>
          <th className="border p-2">Stock</th>
          <th className="border p-2">Harga Beli</th>
          <th className="border p-2">Harga Jual</th>
          <th className="border p-2">Aksi</th>
        </tr>
      </thead>

      <tbody>
        {data.map((item) => (
          <tr key={item.id}>
            <td className="border p-2">{item.code}</td>
            <td className="border p-2">{item.barcode}</td>
            <td className="border p-2">{item.name}</td>
            <td className="border p-2">{item.category}</td>
            <td className="border p-2">{item.unit}</td>
            <td className="border p-2">{item.stock}</td>
            <td className="border p-2">
              {item.purchasePrice.toLocaleString()}
            </td>
            <td className="border p-2">
              {item.sellingPrice.toLocaleString()}
            </td>

            <td className="border p-2 flex gap-2">
              <Link
                href={`/master/barang/${item.id}/edit`}
                className="bg-yellow-500 text-white px-3 py-1 rounded"
              >
                Edit
              </Link>

              <button
                onClick={() => hapus(item.id)}
                className="bg-red-600 text-white px-3 py-1 rounded"
              >
                Hapus
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}