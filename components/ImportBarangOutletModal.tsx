"use client";

import { useEffect, useState } from "react";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

export default function ImportBarangOutletModal({
  open,
  onClose,
  reload,
}: {
  open: boolean;
  onClose: () => void;
  reload: () => void;
}) {
  const [file, setFile] =
    useState<File | null>(null);

  const [outlets, setOutlets] =
    useState<Outlet[]>([]);

  const [outletId, setOutletId] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [loadingOutlet, setLoadingOutlet] =
    useState(false);

  useEffect(() => {
    if (!open) return;

    async function loadOutlets() {
      try {
        setLoadingOutlet(true);

        const res = await fetch(
          "/api/outlet",
          {
            cache: "no-store",
          }
        );

        const json = await res.json();

        if (json.success) {
          setOutlets(json.data || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingOutlet(false);
      }
    }

    loadOutlets();
  }, [open]);

  if (!open) return null;

  async function handleImport() {
    if (!file) {
      alert(
        "Pilih file Excel terlebih dahulu"
      );
      return;
    }

    const formData = new FormData();

    formData.append("file", file);

    // Admin pusat perlu memilih outlet
    if (outletId) {
      formData.append(
        "outletId",
        outletId
      );
    }

    try {
      setLoading(true);

      const res = await fetch(
        "/api/outlet/master-barang/import",
        {
          method: "POST",
          body: formData,
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        alert(
          json.message ||
            "Import gagal"
        );
        return;
      }

      alert(json.message);

      reload();
      onClose();

      setFile(null);
      setOutletId("");
    } catch (error) {
      console.error(error);

      alert(
        "Terjadi kesalahan saat import"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            Import Barang Outlet
          </h2>

          <button
            onClick={onClose}
            className="text-xl text-gray-500 hover:text-black"
          >
            ✕
          </button>
        </div>

        <div className="mb-5 rounded-lg bg-green-50 p-4 text-sm text-gray-700">
          <b>Format Excel:</b>

          <div className="mt-2">
            Kode Barang, Harga
          </div>

          <div className="mt-2 text-xs text-gray-500">
            Barang harus sudah terdaftar
            di Master Barang Central.
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium">
            Outlet
          </label>

          <select
            value={outletId}
            onChange={(e) =>
              setOutletId(e.target.value)
            }
            disabled={loadingOutlet}
            className="w-full rounded-lg border p-2.5"
          >
            <option value="">
              {loadingOutlet
                ? "Memuat outlet..."
                : "Pilih Outlet"}
            </option>

            {outlets.map((outlet) => (
              <option
                key={outlet.id}
                value={outlet.id}
              >
                {outlet.code} -{" "}
                {outlet.name}
              </option>
            ))}
          </select>
        </div>

        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) =>
            setFile(
              e.target.files?.[0] ||
                null
            )
          }
          className="w-full rounded-lg border p-2"
        />

        {file && (
          <div className="mt-3 text-sm text-gray-600">
            File:{" "}
            <b>{file.name}</b>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2"
          >
            Batal
          </button>

          <button
            onClick={handleImport}
            disabled={loading}
            className="rounded-lg bg-green-600 px-5 py-2 text-white disabled:opacity-50"
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