"use client";

import { useEffect, useState } from "react";

export default function BarangPage() {

  const [barang, setBarang] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);

  const [form, setForm] = useState({

    code: "",

    barcode: "",

    name: "",

    category: "",

    unit: "",

    minStock: 0,

    purchasePrice: 0,

    sellingPrice: 0

  });

  async function loadBarang() {

    const res = await fetch("/api/barang");

    const json = await res.json();

    setBarang(json.data);

  }

  function editBarang(item:any){

    setEditId(item.id);

    setForm({

        code:item.code,

        barcode:item.barcode ?? "",

        name:item.name,

        category:item.category ?? "",

        unit:item.unit,

        minStock:item.minStock ?? 0,

        purchasePrice:item.purchasePrice,

        sellingPrice:item.sellingPrice

    });

    }

  useEffect(() => {

    loadBarang();

  }, []);

async function simpan() {

  setLoading(true);

  const url =
    editId === null
      ? "/api/barang"
      : "/api/barang/" + editId;

  const method =
    editId === null
      ? "POST"
      : "PUT";

  const res = await fetch(url, {

    method,

    headers: {

      "Content-Type": "application/json"

    },

    body: JSON.stringify(form)

  });

  const json = await res.json();

  setLoading(false);

  if (json.success) {

    alert(
      editId === null
        ? "Barang berhasil ditambahkan"
        : "Barang berhasil diupdate"
    );

    setEditId(null);

    setForm({

      code: "",

      barcode: "",

      name: "",

      category: "",

      unit: "",

      minStock: 0,

      purchasePrice: 0,

      sellingPrice: 0

    });

    loadBarang();

  } else {

    alert(json.message);

  }

}

  async function hapus(id: number) {

    if (!confirm("Hapus data ?")) return;

    await fetch("/api/barang/" + id, {

      method: "DELETE"

    });

    loadBarang();

  }

  return (

    <div>

      <h1 className="text-3xl font-bold">

        Master Barang

      </h1>

      <div className="bg-white mt-6 rounded-xl shadow p-6">

        <div className="grid grid-cols-4 gap-4">

          <input

            className="border rounded p-2"

            placeholder="Kode"

            value={form.code}

            onChange={(e) =>

              setForm({

                ...form,

                code: e.target.value

              })

            }

          />

          <input

            className="border rounded p-2"

            placeholder="Barcode"

            value={form.barcode}

            onChange={(e) =>

              setForm({

                ...form,

                barcode: e.target.value

              })

            }

          />

          <input

            className="border rounded p-2"

            placeholder="Nama Barang"

            value={form.name}

            onChange={(e) =>

              setForm({

                ...form,

                name: e.target.value

              })

            }

          />

          <input

            className="border rounded p-2"

            placeholder="Kategori"

            value={form.category}

            onChange={(e) =>

              setForm({

                ...form,

                category: e.target.value

              })

            }

          />

          <input

            className="border rounded p-2"

            placeholder="Satuan"

            value={form.unit}

            onChange={(e) =>

              setForm({

                ...form,

                unit: e.target.value

              })

            }

          />

          <input

            type="number"

            className="border rounded p-2"

            placeholder="Minimum Stock"

            value={form.minStock}

            onChange={(e) =>

              setForm({

                ...form,

                minStock: Number(e.target.value)

              })

            }

          />

          <input

            type="number"

            className="border rounded p-2"

            placeholder="Harga Beli"

            value={form.purchasePrice}

            onChange={(e) =>

              setForm({

                ...form,

                purchasePrice: Number(e.target.value)

              })

            }

          />

          <input

            type="number"

            className="border rounded p-2"

            placeholder="Harga Jual"

            value={form.sellingPrice}

            onChange={(e) =>

              setForm({

                ...form,

                sellingPrice: Number(e.target.value)

              })

            }

          />

        </div>

        <div className="mt-5 flex gap-3">

  <button

    onClick={simpan}

    disabled={loading}

    className="bg-blue-600 text-white px-6 py-3 rounded"

  >

    {loading
      ? "Menyimpan..."
      : editId === null
      ? "Simpan Barang"
      : "Update Barang"}

  </button>

  {

    editId !== null && (

      <button

        onClick={() => {

          setEditId(null);

          setForm({

            code: "",

            barcode: "",

            name: "",

            category: "",

            unit: "",

            minStock: 0,

            purchasePrice: 0,

            sellingPrice: 0

          });

        }}

        className="bg-gray-500 text-white px-6 py-3 rounded"

      >

        Batal

      </button>

    )

  }

</div>

</div>
      <div className="bg-white mt-8 rounded-xl shadow">

        <table className="w-full">

          <thead className="bg-slate-100">

            <tr>

              <th className="p-3">Kode</th>

              <th>Nama</th>

              <th>Kategori</th>

              <th>Satuan</th>

              <th>Stock</th>

              <th>Harga Beli</th>

              <th>Harga Jual</th>

              <th>Aksi</th>

            </tr>

          </thead>

<tbody>
  {barang.map((b) => (
    <tr key={b.id} className="border-t">
      <td className="p-3">{b.code}</td>
      <td>{b.name}</td>
      <td>{b.category}</td>
      <td>{b.unit}</td>
      <td>{b.stock}</td>
      <td>Rp {Number(b.purchasePrice).toLocaleString("id-ID")}</td>
<td>Rp {Number(b.sellingPrice).toLocaleString("id-ID")}</td>

      <td>
        <div className="flex gap-2">
          <button
            onClick={() => editBarang(b)}
            className="bg-yellow-500 text-white px-3 py-1 rounded"
          >
            Edit
          </button>

          <button
            onClick={() => hapus(b.id)}
            className="bg-red-600 text-white px-3 py-1 rounded"
          >
            Hapus
          </button>
        </div>
      </td>
    </tr>
  ))}
</tbody>

</table>

</div>

</div>

);

}