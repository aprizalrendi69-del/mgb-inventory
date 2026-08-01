"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function CustomerPage() {
  const [customer, setCustomer] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);

      const res = await fetch("/api/customer", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setCustomer(json.data);
      } else {
        alert(json.message);
      }
    } catch (error) {
      console.error(error);
      alert("Gagal mengambil data customer");
    } finally {
      setLoading(false);
    }
  }

  async function hapusCustomer(id: number) {
    const ok = confirm("Yakin ingin menghapus customer ini?");

    if (!ok) return;

    try {
      const res = await fetch(`/api/customer/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      alert(json.message);

      if (json.success) {
        load();
      }
    } catch (error) {
      console.error(error);
      alert("Gagal menghapus customer");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-8">

      <div className="flex justify-between items-center mb-6">

        <h1 className="text-3xl font-bold">
          Master Customer
        </h1>

        <Link
          href="/customer/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded"
        >
          + Customer
        </Link>

      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">

        <table className="w-full border-collapse">

          <thead>

            <tr className="bg-slate-100">

              <th className="border p-2">Kode</th>

              <th className="border p-2">Nama</th>

              <th className="border p-2">Kota</th>

              <th className="border p-2">Contact Person</th>

              <th className="border p-2">Telepon</th>

              <th className="border p-2">Email</th>

              <th className="border p-2 w-48">
                Aksi
              </th>

            </tr>

          </thead>

          <tbody>

            {loading ? (

              <tr>

                <td
                  colSpan={7}
                  className="text-center p-6"
                >
                  Loading...
                </td>

              </tr>

            ) : customer.length === 0 ? (

              <tr>

                <td
                  colSpan={7}
                  className="text-center p-6"
                >
                  Belum ada data customer
                </td>

              </tr>

            ) : (

              customer.map((c) => (

                <tr key={c.id}>

                  <td className="border p-2">
                    {c.code}
                  </td>

                  <td className="border p-2">
                    {c.name}
                  </td>

                  <td className="border p-2">
                    {c.city ?? "-"}
                  </td>

                  <td className="border p-2">
                    {c.contactPerson ?? "-"}
                  </td>

                  <td className="border p-2">
                    {c.phone ?? "-"}
                  </td>

                  <td className="border p-2">
                    {c.email ?? "-"}
                  </td>

                  <td className="border p-2">

                    <div className="flex justify-center gap-2">

                      <Link
                        href={`/customer/${c.id}/edit`}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                      >
                        Edit
                      </Link>

                      <button
                        onClick={() => hapusCustomer(c.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                      >
                        Hapus
                      </button>

                    </div>

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