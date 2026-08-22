"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

export default function EditBarangPage() {
  const params = useParams();

  const router = useRouter();

  const id = params.id;

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [form, setForm] = useState({
    code: "",
    barcode: "",
    name: "",
    category: "",

    // SATUAN TRANSAKSI
    unit: "",

    // SATUAN DASAR
    baseUnit: "",

    // KONVERSI
    conversionRate: 1,

    minimumStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    hasExpired: false,
  });

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/master/barang/${id}`,
        {
          cache: "no-store",
        }
      );

      const json =
        await res.json();

      if (json.success) {
        const b = json.data;

        setForm({
          code: b.code ?? "",

          barcode:
            b.barcode ?? "",

          name:
            b.name ?? "",

          category:
            b.category ?? "",

          unit:
            b.unit ?? "",

          baseUnit:
            b.baseUnit ??
            b.unit ??
            "",

          conversionRate:
            Number(
              b.conversionRate ?? 1
            ) || 1,

          minimumStock:
            Number(
              b.minimumStock ?? 0
            ),

          purchasePrice:
            Number(
              b.purchasePrice ?? 0
            ),

          sellingPrice:
            Number(
              b.sellingPrice ?? 0
            ),

          hasExpired:
            b.hasExpired ?? false,
        });
      } else {
        alert(
          json.message ||
            "Barang tidak ditemukan"
        );

        router.push(
          "/master-barang"
        );
      }
    } catch (error) {
      console.error(error);

      alert(
        "Gagal mengambil data barang"
      );

      router.push(
        "/master-barang"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  function update(
    field: string,
    value: any
  ) {
    setForm((old) => ({
      ...old,
      [field]: value,
    }));
  }

  async function save() {
    if (!form.name.trim()) {
      alert(
        "Nama Barang wajib diisi"
      );

      return;
    }

    if (!form.unit.trim()) {
      alert(
        "Satuan wajib diisi"
      );

      return;
    }

    if (!form.baseUnit.trim()) {
      alert(
        "Satuan dasar wajib diisi"
      );

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
      setSaving(true);

      const res = await fetch(
        `/api/master/barang/${id}`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(form),
        }
      );

      const json =
        await res.json();

      if (json.success) {
        alert(
          "Barang berhasil diupdate"
        );

        router.push(
          "/master-barang"
        );
      } else {
        alert(
          json.message ||
            "Gagal update barang"
        );
      }
    } catch (error) {
      console.error(error);

      alert(
        "Terjadi kesalahan saat update barang"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F6F8F7] p-8">
      <h1 className="mb-6 text-3xl font-bold">
        Edit Barang
      </h1>

      <div className="space-y-4 rounded-xl bg-white p-6 shadow">
        {/* KODE */}

        <input
          className="
            w-full
            rounded-lg
            border
            p-2
            bg-gray-100
          "
          value={form.code}
          disabled
          placeholder="Kode Barang"
        />

        {/* BARCODE */}

        <input
          className="
            w-full
            rounded-lg
            border
            p-2
          "
          value={form.barcode}
          onChange={(e) =>
            update(
              "barcode",
              e.target.value
            )
          }
          placeholder="Barcode"
        />

        {/* NAMA */}

        <input
          className="
            w-full
            rounded-lg
            border
            p-2
          "
          value={form.name}
          onChange={(e) =>
            update(
              "name",
              e.target.value
            )
          }
          placeholder="Nama Barang"
        />

        {/* KATEGORI */}

        <input
          className="
            w-full
            rounded-lg
            border
            p-2
          "
          value={form.category}
          onChange={(e) =>
            update(
              "category",
              e.target.value
            )
          }
          placeholder="Kategori"
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
            value={form.unit}
            onChange={(e) =>
              update(
                "unit",
                e.target.value
              )
            }
            placeholder="Contoh: Dus"
          />

          <p className="mt-1 text-xs text-gray-400">
            Satuan ini tetap digunakan
            oleh seluruh transaksi.
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
            value={form.baseUnit}
            onChange={(e) =>
              update(
                "baseUnit",
                e.target.value
              )
            }
            placeholder="Contoh: PCS"
          />

          <p className="mt-1 text-xs text-gray-400">
            Satuan dasar untuk hasil
            konversi stock.
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
              1{" "}
              {form.unit ||
                "Satuan"}
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
                update(
                  "conversionRate",
                  Number(
                    e.target.value
                  )
                )
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
            rounded-lg
            border
            border-[#DDE9E4]
            bg-[#F5F8F6]
            p-4
          "
        >
          <p className="text-xs text-gray-500">
            Konversi stock
          </p>

          <p className="mt-1 font-semibold text-[#18352D]">
            {Number(
              1
            ).toLocaleString(
              "id-ID"
            )}{" "}
            {form.unit ||
              "Satuan"}{" "}
            ={" "}
            {Number(
              form.conversionRate ||
                1
            ).toLocaleString(
              "id-ID"
            )}{" "}
            {form.baseUnit ||
              form.unit ||
              "Satuan"}
          </p>
        </div>

        {/* MINIMUM STOCK */}

        <input
          type="number"
          className="
            w-full
            rounded-lg
            border
            p-2
          "
          value={
            form.minimumStock
          }
          onChange={(e) =>
            update(
              "minimumStock",
              Number(
                e.target.value
              )
            )
          }
          placeholder="Minimum Stock"
        />

        {/* HARGA BELI */}

        <input
          type="number"
          className="
            w-full
            rounded-lg
            border
            p-2
          "
          value={
            form.purchasePrice
          }
          onChange={(e) =>
            update(
              "purchasePrice",
              Number(
                e.target.value
              )
            )
          }
          placeholder="Harga Beli"
        />

        {/* HARGA JUAL */}

        <input
          type="number"
          className="
            w-full
            rounded-lg
            border
            p-2
          "
          value={
            form.sellingPrice
          }
          onChange={(e) =>
            update(
              "sellingPrice",
              Number(
                e.target.value
              )
            )
          }
          placeholder="Harga Jual"
        />

        {/* EXPIRED */}

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={
              form.hasExpired
            }
            onChange={(e) =>
              update(
                "hasExpired",
                e.target.checked
              )
            }
          />

          Barang memiliki expired
        </label>

        {/* BUTTON */}

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="
              rounded
              bg-blue-600
              px-5
              py-2
              text-white
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {saving
              ? "Menyimpan..."
              : "Simpan"}
          </button>

          <button
            onClick={() =>
              router.push(
                "/master-barang"
              )
            }
            disabled={saving}
            className="
              rounded
              bg-gray-500
              px-5
              py-2
              text-white
            "
          >
            Kembali
          </button>
        </div>
      </div>
    </div>
  );
}