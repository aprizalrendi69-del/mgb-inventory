"use client";

import { useState } from "react";

export default function BarangForm() {
  const [form, setForm] = useState({
    code: "",
    barcode: "",
    name: "",
    category: "",
    unit: "",
    minStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
  });

  async function simpan() {
    const res = await fetch("/api/master/barang", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const json = await res.json();

    if (json.success) {
      alert("Barang berhasil disimpan");
      window.location.reload();
    } else {
      alert(json.message);
    }
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow">
      <h2 className="text-xl font-bold mb-4">Tambah Barang</h2>

      <div className="grid grid-cols-2 gap-4">
        <input
          placeholder="Kode"
          className="border rounded p-2"
          onChange={(e) => setForm({ ...form, code: e.target.value })}
        />

        <input
          placeholder="Barcode"
          className="border rounded p-2"
          onChange={(e) => setForm({ ...form, barcode: e.target.value })}
        />

        <input
          placeholder="Nama Barang"
          className="border rounded p-2"
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <input
          placeholder="Kategori"
          className="border rounded p-2"
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />

        <input
          placeholder="Satuan"
          className="border rounded p-2"
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
        />

        <input
          type="number"
          placeholder="Minimum Stock"
          className="border rounded p-2"
          onChange={(e) =>
            setForm({ ...form, minStock: Number(e.target.value) })
          }
        />

        <input
          type="number"
          placeholder="Harga Beli"
          className="border rounded p-2"
          onChange={(e) =>
            setForm({ ...form, purchasePrice: Number(e.target.value) })
          }
        />

        <input
          type="number"
          placeholder="Harga Jual"
          className="border rounded p-2"
          onChange={(e) =>
            setForm({ ...form, sellingPrice: Number(e.target.value) })
          }
        />
      </div>

      <button
        onClick={simpan}
        className="mt-5 bg-blue-600 text-white px-5 py-2 rounded"
      >
        Simpan
      </button>
    </div>
  );
}