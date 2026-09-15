"use client";

import { useEffect, useState } from "react";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Me = {
  id: number;
  username: string;
  fullname: string;
  role: string;
  outletId?: number | null;
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

  const [me, setMe] =
    useState<Me | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [loadingData, setLoadingData] =
    useState(false);

  useEffect(() => {
    if (!open) return;

    async function loadData() {
      try {
        setLoadingData(true);

        const [meRes, outletRes] =
          await Promise.all([
            fetch("/api/me", {
              cache: "no-store",
            }),
            fetch("/api/outlet", {
              cache: "no-store",
            }),
          ]);

        const meJson =
          await meRes.json();

        const outletJson =
          await outletRes.json();

        let currentUser: Me | null = null;

        if (
          meJson?.success &&
          meJson?.data
        ) {
          currentUser = meJson.data;
        } else if (meJson?.data) {
          currentUser = meJson.data;
        } else if (meJson?.user) {
          currentUser = meJson.user;
        }

        setMe(currentUser);

        if (outletJson?.success) {
          setOutlets(
            outletJson.data || []
          );
        }

        // =================================================
        // OUTLET ADMIN
        // OTOMATIS PILIH OUTLET SENDIRI
        // =================================================

        if (
          currentUser?.role ===
            "OUTLET_ADMIN" &&
          currentUser.outletId
        ) {
          setOutletId(
            String(currentUser.outletId)
          );
        } else {
          // ADMIN / MANAGER
          setOutletId("");
        }
      } catch (error) {
        console.error(
          "LOAD IMPORT OUTLET DATA ERROR:",
          error
        );

        alert(
          "Gagal mengambil data user/outlet"
        );
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, [open]);

  if (!open) return null;

  const isOutletAdmin =
    me?.role === "OUTLET_ADMIN";

  const isCentralAdmin =
    me?.role === "ADMIN" ||
    me?.role === "MANAGER";

  async function handleImport() {
    if (!file) {
      alert(
        "Pilih file Excel terlebih dahulu"
      );
      return;
    }

    // ADMIN / MANAGER wajib memilih outlet
    if (
      isCentralAdmin &&
      !outletId
    ) {
      alert(
        "Pilih outlet terlebih dahulu"
      );
      return;
    }

    // OUTLET ADMIN wajib memiliki outlet
    if (
      isOutletAdmin &&
      !outletId
    ) {
      alert(
        "User belum memiliki outlet"
      );
      return;
    }

    const formData =
      new FormData();

    formData.append(
      "file",
      file
    );

    // Admin pusat / Manager
    // kirim outletId
    if (isCentralAdmin) {
      formData.append(
        "outletId",
        outletId
      );
    }

    // Outlet admin juga boleh dikirim,
    // tetapi API tetap akan memaksa
    // menggunakan user.outletId
    if (isOutletAdmin) {
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

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        alert(
          json.message ||
            "Import gagal"
        );
        return;
      }

      alert(
        json.message ||
          "Import berhasil"
      );

      reload();

      onClose();

      setFile(null);

      if (isOutletAdmin) {
        setOutletId(
          me?.outletId
            ? String(me.outletId)
            : ""
        );
      } else {
        setOutletId("");
      }
    } catch (error) {
      console.error(
        "IMPORT BARANG OUTLET ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat import"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">

        {/* HEADER */}

        <div className="mb-5 flex items-center justify-between">

          <div>
            <h2 className="text-xl font-bold text-[#18352D]">
              Import Barang Outlet
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Daftarkan barang dari Master
              Barang Central ke outlet
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-xl text-gray-500 hover:text-black disabled:opacity-50"
          >
            ✕
          </button>

        </div>

        {/* INFO */}

        <div className="mb-5 rounded-xl border border-green-100 bg-green-50 p-4 text-sm text-gray-700">

          <div className="font-semibold text-[#18352D]">
            Format Excel
          </div>

          <div className="mt-2 rounded-lg bg-white p-3 font-mono text-xs">
            Kode Barang | Harga
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Barang harus sudah tersedia
            di Master Barang Central.
          </div>

          <div className="mt-2 text-xs text-gray-500">
            Import hanya mendaftarkan barang
            ke outlet dan membuat stok awal
            <b> 0</b>.
          </div>

        </div>

        {/* OUTLET */}

        <div className="mb-4">

          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Outlet
          </label>

          {isOutletAdmin ? (
            <div className="rounded-xl border border-[#D5E5DC] bg-gray-100 px-4 py-3 text-sm text-gray-700">

              {outlets.find(
                (outlet) =>
                  outlet.id ===
                  Number(outletId)
              )?.code || "-"}{" "}

              {outlets.find(
                (outlet) =>
                  outlet.id ===
                  Number(outletId)
              )?.name || ""}

            </div>
          ) : (
            <select
              value={outletId}
              onChange={(e) =>
                setOutletId(
                  e.target.value
                )
              }
              disabled={
                loadingData ||
                loading
              }
              className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] p-3 text-sm outline-none focus:border-[#497F70] disabled:bg-gray-100"
            >

              <option value="">
                {loadingData
                  ? "Memuat outlet..."
                  : "Pilih Outlet"}
              </option>

              {outlets.map(
                (outlet) => (
                  <option
                    key={outlet.id}
                    value={outlet.id}
                  >
                    {outlet.code} -{" "}
                    {outlet.name}
                  </option>
                )
              )}

            </select>
          )}

        </div>

        {/* FILE */}

        <div>

          <label className="mb-2 block text-sm font-semibold text-gray-700">
            File Excel
          </label>

          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={
              loading ||
              loadingData
            }
            onChange={(e) =>
              setFile(
                e.target.files?.[0] ||
                  null
              )
            }
            className="w-full rounded-xl border border-[#D5E5DC] bg-white p-2.5 text-sm"
          />

        </div>

        {file && (
          <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
            File:{" "}
            <b>{file.name}</b>
          </div>
        )}

        {/* BUTTON */}

        <div className="mt-6 flex justify-end gap-3">

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-[#F5F8F6] disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleImport}
            disabled={
              loading ||
              loadingData ||
              !file ||
              !outletId
            }
            className="rounded-xl bg-[#497F70] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-50"
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