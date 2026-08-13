"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Barang = {
  id: number;
  code: string;
  name: string;
  unit?: string;
};

type Supplier = {
  id: number;
  name: string;
};

type PurchaseItem = {
  id?: number;
  barangId: number;
  qty: number;
  price: number;
  barang?: Barang;
};

// =====================================================
// FORMAT NUMBER
// =====================================================

function formatNumber(value: number | string) {
  const number = Number(value || 0);

  return number.toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  });
}

function formatRupiah(value: number | string) {
  const number = Number(value || 0);

  return number.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// =====================================================
// DECIMAL INPUT
// =====================================================

type DecimalInputProps = {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  min?: number;
};

function DecimalInput({
  value,
  onChange,
  className = "",
  min,
}: DecimalInputProps) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(
    value === 0 ? "" : String(value)
  );

  useEffect(() => {
    if (!focused) {
      setText(value === 0 ? "" : String(value));
    }
  }, [value, focused]);

  function handleFocus() {
    setFocused(true);

    setText(
      value === 0
        ? ""
        : String(value)
    );
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    let input = e.target.value;

    // Izinkan koma Indonesia
    input = input.replace(",", ".");

    // Hanya angka dan satu titik desimal
    input = input.replace(
      /[^0-9.]/g,
      ""
    );

    const parts = input.split(".");

    if (parts.length > 2) {
      input =
        parts[0] +
        "." +
        parts.slice(1).join("");
    }

    setText(input);

    if (input === "" || input === ".") {
      onChange(0);
      return;
    }

    const numericValue = Number(input);

    if (Number.isNaN(numericValue)) {
      return;
    }

    onChange(numericValue);
  }

  function handleBlur() {
    setFocused(false);

    const numericValue = Number(text);

    if (
      Number.isNaN(numericValue) ||
      numericValue < 0
    ) {
      setText("");
      onChange(0);
      return;
    }

    if (
      min !== undefined &&
      numericValue < min
    ) {
      setText(String(min));
      onChange(min);
      return;
    }

    onChange(numericValue);

    setText(
      numericValue === 0
        ? ""
        : String(numericValue)
    );
  }

  const displayValue = focused
    ? text
    : value === 0
      ? ""
      : formatNumber(value);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
  );
}

// =====================================================
// PAGE
// =====================================================

export default function EditPurchasePage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id;

  const [purchase, setPurchase] =
    useState<any>(null);

  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [barangs, setBarangs] =
    useState<Barang[]>([]);

  const [supplierId, setSupplierId] =
    useState("");

  const [remarks, setRemarks] =
    useState("");

  const [items, setItems] =
    useState<PurchaseItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  // =====================================================
  // LOAD DATA
  // =====================================================

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);

      const [
        purchaseRes,
        supplierRes,
        barangRes,
      ] = await Promise.all([
        fetch(`/api/purchase/${id}`, {
          cache: "no-store",
        }),

        fetch("/api/master/supplier", {
          cache: "no-store",
        }),

        fetch("/api/master/barang", {
          cache: "no-store",
        }),
      ]);

      const purchaseJson =
        await purchaseRes.json();

      const supplierJson =
        await supplierRes.json();

      const barangJson =
        await barangRes.json();

      if (!purchaseJson.success) {
        alert(
          purchaseJson.message ||
            "Purchase Order tidak ditemukan"
        );

        router.push("/purchase");
        return;
      }

      const data =
        purchaseJson.data;

      setPurchase(data);

      setSupplierId(
        String(
          data.supplierId ?? ""
        )
      );

      setRemarks(
        data.remarks ?? ""
      );

      setItems(
        (data.items || []).map(
          (item: any) => ({
            id: item.id,

            barangId:
              Number(item.barangId),

            qty:
              Number(item.qty ?? 0),

            price:
              Number(item.price ?? 0),

            barang:
              item.barang,
          })
        )
      );

      if (supplierJson.success) {
        setSuppliers(
          supplierJson.data ||
            supplierJson.suppliers ||
            []
        );
      }

      if (barangJson.success) {
        setBarangs(
          barangJson.data ||
            barangJson.barang ||
            []
        );
      }
    } catch (error) {
      console.error(
        "LOAD PURCHASE ERROR:",
        error
      );

      alert(
        "Gagal mengambil data Purchase Order"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // ADD ITEM
  // =====================================================

  function addItem() {
    setItems([
      ...items,
      {
        barangId: 0,
        qty: 1,
        price: 0,
      },
    ]);
  }

  // =====================================================
  // REMOVE ITEM
  // =====================================================

  function removeItem(index: number) {
    if (items.length === 1) {
      alert(
        "Purchase Order harus memiliki minimal 1 barang."
      );

      return;
    }

    setItems(
      items.filter(
        (_, i) => i !== index
      )
    );
  }

  // =====================================================
  // UPDATE ITEM
  // =====================================================

  function updateItem(
    index: number,
    field: keyof PurchaseItem,
    value: any
  ) {
    const updated = [...items];

    updated[index] = {
      ...updated[index],
      [field]: value,
    };

    setItems(updated);
  }

  // =====================================================
  // TOTAL
  // =====================================================

  const total = items.reduce(
    (sum, item) =>
      sum +
      Number(item.qty || 0) *
        Number(item.price || 0),
    0
  );

  // =====================================================
  // SUBMIT
  // =====================================================

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!supplierId) {
      alert(
        "Supplier wajib dipilih"
      );

      return;
    }

    if (items.length === 0) {
      alert(
        "Barang belum dipilih"
      );

      return;
    }

    for (const item of items) {
      if (!item.barangId) {
        alert(
          "Semua barang harus dipilih."
        );

        return;
      }

      if (
        Number(item.qty) <= 0
      ) {
        alert(
          `Qty ${
            item.barang?.name ||
            "barang"
          } harus lebih dari 0.`
        );

        return;
      }

      if (
        Number(item.price) <= 0
      ) {
        alert(
          `Harga ${
            item.barang?.name ||
            "barang"
          } harus lebih dari 0.`
        );

        return;
      }
    }

    try {
      setSaving(true);

      const res = await fetch(
        `/api/purchase/${id}`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            supplierId:
              Number(supplierId),

            remarks,

            items: items.map(
              (item) => ({
                barangId:
                  Number(
                    item.barangId
                  ),

                qty:
                  Number(
                    item.qty
                  ),

                price:
                  Number(
                    item.price
                  ),
              })
            ),
          }),
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
            "Gagal mengubah Purchase Order"
        );

        return;
      }

      alert(
        "Purchase Order berhasil diubah"
      );

      router.push(
        `/purchase/${id}`
      );

      router.refresh();
    } catch (error) {
      console.error(
        "SAVE PURCHASE ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat mengubah Purchase Order"
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="min-h-full bg-[#F6F8F7] p-8">
        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-8 text-center">
          Loading Purchase Order...
        </div>
      </div>
    );
  }

  // =====================================================
  // NOT FOUND
  // =====================================================

  if (!purchase) {
    return (
      <div className="min-h-full bg-[#F6F8F7] p-8">
        Purchase Order tidak ditemukan.
      </div>
    );
  }

  // =====================================================
  // LOCKED
  // =====================================================

  if (
    purchase.status !== "DRAFT"
  ) {
    return (
      <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">
        <div className="mx-auto max-w-5xl">

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">

            <h1 className="text-xl font-bold text-red-700">
              Purchase Order tidak dapat diedit
            </h1>

            <p className="mt-2 text-sm text-red-600">
              Purchase Order{" "}
              <strong>
                {purchase.number}
              </strong>{" "}
              sudah berstatus{" "}
              <strong>
                {purchase.status}
              </strong>
              .
            </p>

            <Link
              href={`/purchase/${id}`}
              className="mt-5 inline-flex rounded-xl bg-[#497F70] px-5 py-3 text-sm font-semibold text-white"
            >
              Kembali ke Detail
            </Link>

          </div>

        </div>
      </div>
    );
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      <div className="mx-auto max-w-6xl">

        {/* HEADER */}

        <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>

            <p className="text-sm font-medium text-[#497F70]">
              Purchase Order
            </p>

            <h1 className="mt-1 text-2xl font-bold text-[#18352D] md:text-3xl">
              Edit Purchase Order
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              {purchase.number}
            </p>

          </div>

          <Link
            href={`/purchase/${id}`}
            className="inline-flex items-center justify-center rounded-xl border border-[#D5E5DC] bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-[#F5F8F6]"
          >
            Batal
          </Link>

        </div>

        <form
          onSubmit={handleSubmit}
        >

          {/* ================================================= */}
          {/* INFORMASI PO */}
          {/* ================================================= */}

          <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

            <div className="border-b border-[#E5ECE9] px-5 py-4">

              <h2 className="font-bold text-[#18352D]">
                Informasi Purchase Order
              </h2>

            </div>

            <div className="grid gap-5 p-5 md:grid-cols-2">

              {/* NO PO */}

              <div>

                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  No. PO
                </label>

                <input
                  value={
                    purchase.number ||
                    ""
                  }
                  disabled
                  className="w-full rounded-xl border border-[#D5E5DC] bg-gray-100 px-4 py-3 text-sm text-gray-500"
                />

              </div>

              {/* SUPPLIER */}

              <div>

                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Supplier
                </label>

                <select
                  value={supplierId}
                  onChange={(e) =>
                    setSupplierId(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                >

                  <option value="">
                    Pilih Supplier
                  </option>

                  {suppliers.map(
                    (supplier) => (
                      <option
                        key={
                          supplier.id
                        }
                        value={
                          supplier.id
                        }
                      >
                        {
                          supplier.name
                        }
                      </option>
                    )
                  )}

                </select>

              </div>

              {/* KETERANGAN */}

              <div className="md:col-span-2">

                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Keterangan
                </label>

                <textarea
                  value={remarks}
                  onChange={(e) =>
                    setRemarks(
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder="Keterangan Purchase Order..."
                  className="w-full rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                />

              </div>

            </div>

          </div>

          {/* ================================================= */}
          {/* BARANG */}
          {/* ================================================= */}

          <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

            <div className="flex flex-col gap-3 border-b border-[#E5ECE9] px-5 py-4 md:flex-row md:items-center md:justify-between">

              <div>

                <h2 className="font-bold text-[#18352D]">
                  Detail Barang
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Ubah barang, qty, dan harga Purchase Order.
                </p>

              </div>

              <button
                type="button"
                onClick={addItem}
                className="rounded-xl bg-[#497F70] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3D6D60]"
              >
                + Tambah Barang
              </button>

            </div>

            <div className="overflow-x-auto">

              <table className="min-w-full text-sm">

                <thead className="bg-[#F5F8F6]">

                  <tr className="border-b border-[#E5ECE9]">

                    <th className="px-4 py-3 text-left font-semibold text-[#35564C]">
                      No
                    </th>

                    <th className="px-4 py-3 text-left font-semibold text-[#35564C]">
                      Barang
                    </th>

                    <th className="px-4 py-3 text-center font-semibold text-[#35564C]">
                      Qty
                    </th>

                    <th className="px-4 py-3 text-right font-semibold text-[#35564C]">
                      Harga
                    </th>

                    <th className="px-4 py-3 text-right font-semibold text-[#35564C]">
                      Subtotal
                    </th>

                    <th className="px-4 py-3 text-center font-semibold text-[#35564C]">
                      Aksi
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {items.map(
                    (
                      item,
                      index
                    ) => {

                      const subtotal =
                        Number(
                          item.qty || 0
                        ) *
                        Number(
                          item.price || 0
                        );

                      return (
                        <tr
                          key={
                            item.id ??
                            `new-${index}`
                          }
                          className="border-b border-[#EDF2EF]"
                        >

                          {/* NO */}

                          <td className="px-4 py-4 text-gray-500">
                            {index + 1}
                          </td>

                          {/* BARANG */}

                          <td className="px-4 py-4">

                            <select
                              value={
                                item.barangId
                                  ? String(
                                      item.barangId
                                    )
                                  : ""
                              }
                              onChange={(e) =>
                                updateItem(
                                  index,
                                  "barangId",
                                  Number(
                                    e.target.value
                                  )
                                )
                              }
                              className="min-w-[280px] rounded-xl border border-[#D5E5DC] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#497F70]"
                            >

                              <option value="">
                                Pilih Barang
                              </option>

                              {barangs.map(
                                (
                                  barang
                                ) => (
                                  <option
                                    key={
                                      barang.id
                                    }
                                    value={
                                      barang.id
                                    }
                                  >
                                    {
                                      barang.code
                                    }{" "}
                                    -{" "}
                                    {
                                      barang.name
                                    }
                                  </option>
                                )
                              )}

                            </select>

                          </td>

                          {/* QTY */}

                          <td className="px-4 py-4">

                            <DecimalInput
                              value={
                                Number(
                                  item.qty || 0
                                )
                              }
                              min={1}
                              onChange={(
                                value
                              ) =>
                                updateItem(
                                  index,
                                  "qty",
                                  value
                                )
                              }
                              className="w-28 rounded-xl border border-[#D5E5DC] bg-white px-3 py-2.5 text-right outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                            />

                          </td>

                          {/* HARGA */}

                          <td className="px-4 py-4">

                            <DecimalInput
                              value={
                                Number(
                                  item.price || 0
                                )
                              }
                              min={1}
                              onChange={(
                                value
                              ) =>
                                updateItem(
                                  index,
                                  "price",
                                  value
                                )
                              }
                              className="w-40 rounded-xl border border-[#D5E5DC] bg-white px-3 py-2.5 text-right outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                            />

                          </td>

                          {/* SUBTOTAL */}

                          <td className="px-4 py-4 text-right font-semibold text-[#18352D] whitespace-nowrap">

                            {formatRupiah(
                              subtotal
                            )}

                          </td>

                          {/* HAPUS */}

                          <td className="px-4 py-4 text-center">

                            <button
                              type="button"
                              onClick={() =>
                                removeItem(
                                  index
                                )
                              }
                              className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                            >
                              Hapus
                            </button>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

            {/* ================================================= */}
            {/* TOTAL */}
            {/* ================================================= */}

            <div className="flex justify-end border-t border-[#E5ECE9] bg-[#FAFCFB] px-5 py-5">

              <div className="w-full max-w-sm">

                <div className="flex items-center justify-between gap-5">

                  <span className="text-sm font-semibold text-gray-600">
                    Total Purchase
                  </span>

                  <span className="text-xl font-bold text-[#18352D] whitespace-nowrap">
                    {formatRupiah(
                      total
                    )}
                  </span>

                </div>

              </div>

            </div>

          </div>

          {/* ================================================= */}
          {/* FOOTER */}
          {/* ================================================= */}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

            <Link
              href={`/purchase/${id}`}
              className="inline-flex items-center justify-center rounded-xl border border-[#D5E5DC] bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-[#F5F8F6]"
            >
              Batal
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl bg-[#497F70] px-7 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Menyimpan..."
                : "Simpan Perubahan"}
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}