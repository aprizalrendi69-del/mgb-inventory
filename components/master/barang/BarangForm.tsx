"use client";

import { useState } from "react";

export default function BarangForm({
  reload,
}: {
  reload?: () => void;
}) {
  const initialForm = {
    code: "",
    barcode: "",
    name: "",
    category: "",

    // SATUAN TRANSAKSI
    unit: "",

    // SATUAN DASAR
    baseUnit: "",

    // CONVERSI
    conversionRate: 1,

    hasExpired: false,
  };

  const [form, setForm] =
    useState(initialForm);

  const [loading, setLoading] =
    useState(false);

  async function simpan() {
    if (!form.code.trim() || !form.name.trim()) {
      alert(
        "Kode Barang dan Nama Barang wajib diisi"
      );

      return;
    }

    if (!form.unit.trim()) {
      alert("Satuan wajib diisi");

      return;
    }

    if (
      !form.baseUnit.trim()
    ) {
      alert("Satuan dasar wajib diisi");

      return;
    }

    if (
      !Number.isFinite(
        form.conversionRate
      ) ||
      form.conversionRate <= 0
    ) {
      alert(
        "Konversi harus lebih besar dari 0"
      );

      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        "/api/barang",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(form),
        }
      );

      const json = await res.json();

      if (json.success) {
        alert(
          "Barang berhasil disimpan"
        );

        setForm(initialForm);

        if (reload) {
          reload();
        }
      } else {
        alert(
          json.message ||
            "Gagal menyimpan barang"
        );
      }
    } catch (error) {
      console.error(error);

      alert(
        "Terjadi kesalahan server"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="
        rounded-xl
        bg-white
        p-6
        shadow
      "
    >
      <h2
        className="
          mb-5
          text-xl
          font-bold
        "
      >
        Tambah Master Barang
      </h2>

      <div
        className="
          grid
          grid-cols-1
          gap-4
          md:grid-cols-2
        "
      >
        {/* KODE */}

        <input
          className="
            rounded-lg
            border
            p-2
          "
          placeholder="Kode Barang"
          value={form.code}
          onChange={(e) =>
            setForm({
              ...form,
              code: e.target.value,
            })
          }
        />

        {/* BARCODE */}

        <input
          className="
            rounded-lg
            border
            p-2
          "
          placeholder="Barcode"
          value={form.barcode}
          onChange={(e) =>
            setForm({
              ...form,
              barcode: e.target.value,
            })
          }
        />

        {/* NAMA */}

        <input
          className="
            rounded-lg
            border
            p-2
          "
          placeholder="Nama Barang"
          value={form.name}
          onChange={(e) =>
            setForm({
              ...form,
              name: e.target.value,
            })
          }
        />

        {/* KATEGORI */}

        <input
          className="
            rounded-lg
            border
            p-2
          "
          placeholder="Kategori"
          value={form.category}
          onChange={(e) =>
            setForm({
              ...form,
              category: e.target.value,
            })
          }
        />

        {/* SATUAN TRANSAKSI */}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Satuan Transaksi
          </label>

          <input
            className="
              w-full
              rounded-lg
              border
              p-2
            "
            placeholder="Contoh: Dus"
            value={form.unit}
            onChange={(e) =>
              setForm({
                ...form,
                unit: e.target.value,
              })
            }
          />

          <p className="mt-1 text-xs text-gray-400">
            Satuan yang tetap digunakan
            pada semua transaksi.
          </p>
        </div>

        {/* SATUAN DASAR */}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Satuan Dasar
          </label>

          <input
            className="
              w-full
              rounded-lg
              border
              p-2
            "
            placeholder="Contoh: PCS"
            value={form.baseUnit}
            onChange={(e) =>
              setForm({
                ...form,
                baseUnit: e.target.value,
              })
            }
          />

          <p className="mt-1 text-xs text-gray-400">
            Satuan terkecil untuk
            tampilan hasil konversi stock.
          </p>
        </div>

        {/* KONVERSI */}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Konversi
          </label>

          <div className="flex items-center gap-2">
            <div
              className="
                rounded-lg
                bg-gray-100
                px-3
                py-2
                text-sm
                font-medium
                text-gray-600
              "
            >
              1 {form.unit || "Satuan"}
            </div>

            <span className="text-gray-500">
              =
            </span>

            <input
              type="number"
              min="0.01"
              step="0.01"
              className="
                min-w-0
                flex-1
                rounded-lg
                border
                p-2
              "
              value={
                form.conversionRate
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  conversionRate:
                    Number(
                      e.target.value
                    ),
                })
              }
            />

            <div
              className="
                rounded-lg
                bg-gray-100
                px-3
                py-2
                text-sm
                font-medium
                text-gray-600
              "
            >
              {form.baseUnit ||
                "Dasar"}
            </div>
          </div>

          <p className="mt-1 text-xs text-gray-400">
            Contoh: 1 Dus = 24 PCS.
          </p>
        </div>

        {/* PREVIEW */}

        <div
          className="
            flex
            items-center
            rounded-lg
            border
            border-[#DDE9E4]
            bg-[#F5F8F6]
            px-4
            py-3
          "
        >
          <div>
            <p className="text-xs text-gray-500">
              Contoh konversi stock
            </p>

            <p className="mt-1 text-sm font-semibold text-[#18352D]">
              1{" "}
              {form.unit ||
                "Satuan"}{" "}
              ={" "}
              {form.conversionRate ||
                1}{" "}
              {form.baseUnit ||
                form.unit ||
                "Satuan"}
            </p>
          </div>
        </div>

        {/* EXPIRED */}

        <label
          className="
            col-span-1
            flex
            items-center
            gap-2
            md:col-span-2
          "
        >
          <input
            type="checkbox"
            checked={
              form.hasExpired
            }
            onChange={(e) =>
              setForm({
                ...form,
                hasExpired:
                  e.target.checked,
              })
            }
          />

          Barang memiliki tanggal expired
        </label>

        {/* BUTTON */}

        <button
          disabled={loading}
          onClick={simpan}
          className="
            col-span-1
            rounded-lg
            bg-blue-600
            py-2
            text-white
            hover:bg-blue-700
            disabled:cursor-not-allowed
            disabled:opacity-50
            md:col-span-2
          "
        >
          {loading
            ? "Menyimpan..."
            : "Simpan Barang"}
        </button>
      </div>
    </div>
  );
}