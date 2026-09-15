"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportSupplierModal({
  open,
  onClose,
  onSuccess,
}: Props) {

  const [file, setFile] =
    useState<File | null>(null);

  const [loading, setLoading] =
    useState(false);

  if (!open) return null;

  async function importExcel() {

    if (!file) {

      alert("Pilih file Excel terlebih dahulu.");

      return;

    }

    try {

      setLoading(true);

      const formData = new FormData();

      formData.append("file", file);

      const res = await fetch(
        "/api/supplier/import",
        {
          method: "POST",
          body: formData,
        }
      );

      const json = await res.json();

      alert(json.message);

      if (json.success) {

        setFile(null);

        onClose();

        onSuccess();

      }

    } catch (err) {

      console.error(err);

      alert("Import gagal.");

    } finally {

      setLoading(false);

    }

  }

  return (

    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

      <div className="bg-white rounded-lg shadow-lg w-[560px]">

        <div className="border-b px-6 py-4">

          <h2 className="text-xl font-bold">

            Import Supplier

          </h2>

        </div>

        <div className="p-6">
                      <div className="mb-5">

            <a
              href="/api/supplier/template"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Download Template Excel
            </a>

          </div>

          <p className="mb-3 text-gray-600 font-medium">
            Format Excel:
          </p>

          <div className="bg-gray-100 rounded-lg p-4 text-sm mb-5">

            <table className="w-full">

              <thead>

                <tr className="font-semibold">

                  <td>Code</td>
                  <td>Name</td>
                  <td>Address</td>
                  <td>City</td>
                  <td>Phone</td>

                </tr>

              </thead>

              <tbody>

                <tr>

                  <td>SUP001</td>
                  <td>PT ABC</td>
                  <td>Jl. Industri</td>
                  <td>Bekasi</td>
                  <td>08123456789</td>

                </tr>

              </tbody>

            </table>

            <div className="mt-3">

              Email | Contact Person

            </div>

          </div>

          <input
            type="file"
            accept=".xlsx,.xls"
            className="w-full border rounded p-2"
            onChange={(e) =>
              setFile(
                e.target.files?.[0] ?? null
              )
            }
          />

        </div>

        <div className="border-t px-6 py-4 flex justify-end gap-3">

          <button
            onClick={onClose}
            disabled={loading}
            className="border px-5 py-2 rounded"
          >
            Batal
          </button>

          <button
            onClick={importExcel}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded"
          >
            {loading
              ? "Mengimport..."
              : "Import"}
          </button>

        </div>

      </div>

    </div>

  );

}