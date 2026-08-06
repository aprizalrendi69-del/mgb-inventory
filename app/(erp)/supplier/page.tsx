"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ImportSupplierModal from "@/components/supplier/ImportSupplierModal";

export default function SupplierPage() {

  const [supplier, setSupplier] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openImport, setOpenImport] = useState(false);

  async function load() {

    try {

      const res = await fetch("/api/supplier", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setSupplier(json.data);
      } else {
        alert(json.message);
      }

    } catch (err) {

      console.error(err);
      alert("Gagal mengambil data supplier");

    } finally {

      setLoading(false);

    }

  }

  async function hapusSupplier(id: number) {

    const ok = confirm(
      "Yakin ingin menghapus supplier ini?"
    );

    if (!ok) return;

    try {

      const res = await fetch(
        `/api/supplier/${id}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      alert(json.message);

      if (json.success) {
        load();
      }

    } catch (err) {

      console.error(err);
      alert("Gagal menghapus supplier");

    }

  }

  useEffect(() => {
    load();
  }, []);

  return (

    <div className="p-8">

      <div className="flex justify-between items-center mb-6">

        <div>

          <h1 className="text-3xl font-bold">
            Master Supplier
          </h1>

          <p className="text-gray-500">
            Kelola data supplier perusahaan
          </p>

        </div>

        <div className="flex gap-3">

          <button
            onClick={() => setOpenImport(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded"
          >
            Import Excel
          </button>

          <Link
            href="/supplier/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded"
          >
            + Supplier
          </Link>

        </div>

      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">

        <table className="w-full border-collapse">

          <thead>

            <tr className="bg-gray-100">

              <th className="border p-2">Kode</th>
              <th className="border p-2">Nama</th>
              <th className="border p-2">Kota</th>
              <th className="border p-2">Contact Person</th>
              <th className="border p-2">Telepon</th>
              <th className="border p-2">Email</th>
              <th className="border p-2 w-44">Aksi</th>

            </tr>

          </thead>

          <tbody>
                        {loading ? (

              <tr>

                <td
                  colSpan={7}
                  className="text-center p-5"
                >
                  Loading...
                </td>

              </tr>

            ) : supplier.length === 0 ? (

              <tr>

                <td
                  colSpan={7}
                  className="text-center p-5"
                >
                  Belum ada data supplier
                </td>

              </tr>

            ) : (

              supplier.map((item: any) => (

                <tr key={item.id}>

                  <td className="border p-2">
                    {item.code}
                  </td>

                  <td className="border p-2">
                    {item.name}
                  </td>

                  <td className="border p-2">
                    {item.city ?? "-"}
                  </td>

                  <td className="border p-2">
                    {item.contactPerson ?? "-"}
                  </td>

                  <td className="border p-2">
                    {item.phone ?? "-"}
                  </td>

                  <td className="border p-2">
                    {item.email ?? "-"}
                  </td>

                  <td className="border p-2">

                    <div className="flex justify-center gap-2">

                      <Link
                        href={`/supplier/${item.id}/edit`}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                      >
                        Edit
                      </Link>

                      <button
                        onClick={() =>
                          hapusSupplier(item.id)
                        }
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

      <ImportSupplierModal
        open={openImport}
        onClose={() => setOpenImport(false)}
        onSuccess={load}
      />

    </div>

  );

}