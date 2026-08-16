"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  ShoppingCart,
  Save,
  RefreshCw,
} from "lucide-react";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Supplier = {
  id: number;
  code: string;
  name: string;
};

type Barang = {
  id: number;
  code: string;
  barcode?: string | null;
  name: string;
  unit: string;
  purchasePrice?: number;
  active?: boolean;
};

type PurchaseItem = {
  barangId: number;
  barang: Barang;
  qty: number;
  price: number;
  subtotal: number;
};

export default function PurchaseOutletNewPage() {
  const router = useRouter();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [barang, setBarang] = useState<Barang[]>([]);

  const [outletId, setOutletId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [remarks, setRemarks] = useState("");

  const [barangSearch, setBarangSearch] = useState("");
  const [selectedBarangId, setSelectedBarangId] = useState("");

  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");

  const [items, setItems] = useState<PurchaseItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMaster();
  }, []);

  async function loadMaster() {
    try {
      setLoading(true);

      const [outletRes, supplierRes, barangRes] =
        await Promise.all([
          fetch("/api/outlet", {
            cache: "no-store",
          }),

          fetch("/api/master/supplier", {
            cache: "no-store",
          }),

          fetch("/api/master/barang?search=", {
            cache: "no-store",
          }),
        ]);

      const outletJson = await outletRes.json();
      const supplierJson = await supplierRes.json();
      const barangJson = await barangRes.json();

      if (outletJson.success) {
        setOutlets(outletJson.data || []);
      }

      if (supplierJson.success) {
        setSuppliers(supplierJson.data || []);
      }

      if (barangJson.success) {
        setBarang(barangJson.data || []);
      }
    } catch (error) {
      console.error("LOAD MASTER OUTLET PURCHASE ERROR:", error);

      alert("Gagal mengambil data master");
    } finally {
      setLoading(false);
    }
  }

  const filteredBarang = useMemo(() => {
    const keyword = barangSearch
      .toLowerCase()
      .trim();

    if (!keyword) {
      return barang.slice(0, 30);
    }

    return barang
      .filter((item) => {
        return (
          item.code
            ?.toLowerCase()
            .includes(keyword) ||
          item.name
            ?.toLowerCase()
            .includes(keyword) ||
          item.barcode
            ?.toLowerCase()
            .includes(keyword)
        );
      })
      .slice(0, 30);
  }, [barang, barangSearch]);

  const selectedBarang = useMemo(() => {
    return barang.find(
      (item) =>
        item.id === Number(selectedBarangId)
    );
  }, [barang, selectedBarangId]);

  function handleSelectBarang(
    id: string
  ) {
    setSelectedBarangId(id);

    const item = barang.find(
      (barangItem) =>
        barangItem.id === Number(id)
    );

    if (item) {
      setPrice(
        String(
          Number(item.purchasePrice || 0)
        )
      );
    }
  }

  function addItem() {
    if (!selectedBarangId) {
      alert("Pilih barang terlebih dahulu");
      return;
    }

    const selected = barang.find(
      (item) =>
        item.id === Number(selectedBarangId)
    );

    if (!selected) {
      alert("Barang tidak ditemukan");
      return;
    }

    const itemQty = Number(qty);
    const itemPrice = Number(price);

    if (!itemQty || itemQty <= 0) {
      alert("Qty harus lebih dari 0");
      return;
    }

    if (!itemPrice || itemPrice <= 0) {
      alert("Harga harus lebih dari 0");
      return;
    }

    const existingIndex = items.findIndex(
      (item) =>
        item.barangId === selected.id
    );

    if (existingIndex >= 0) {
      const updated = [...items];

      const newQty =
        updated[existingIndex].qty +
        itemQty;

      updated[existingIndex] = {
        ...updated[existingIndex],
        qty: newQty,
        price: itemPrice,
        subtotal:
          newQty * itemPrice,
      };

      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          barangId: selected.id,
          barang: selected,
          qty: itemQty,
          price: itemPrice,
          subtotal:
            itemQty * itemPrice,
        },
      ]);
    }

    setSelectedBarangId("");
    setBarangSearch("");
    setQty("1");
    setPrice("");
  }

  function updateQty(
    barangId: number,
    value: string
  ) {
    const newQty = Number(value);

    setItems((current) =>
      current.map((item) => {
        if (item.barangId !== barangId) {
          return item;
        }

        return {
          ...item,
          qty: newQty,
          subtotal:
            newQty * item.price,
        };
      })
    );
  }

  function updatePrice(
    barangId: number,
    value: string
  ) {
    const newPrice = Number(value);

    setItems((current) =>
      current.map((item) => {
        if (item.barangId !== barangId) {
          return item;
        }

        return {
          ...item,
          price: newPrice,
          subtotal:
            item.qty * newPrice,
        };
      })
    );
  }

  function removeItem(
    barangId: number
  ) {
    setItems((current) =>
      current.filter(
        (item) =>
          item.barangId !== barangId
      )
    );
  }

  const total = useMemo(() => {
    return items.reduce(
      (sum, item) =>
        sum + item.subtotal,
      0
    );
  }, [items]);

  function formatRupiah(value: number) {
    return Number(value || 0).toLocaleString(
      "id-ID"
    );
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!outletId) {
      alert("Outlet wajib dipilih");
      return;
    }

    if (!supplierId) {
      alert("Supplier wajib dipilih");
      return;
    }

    if (items.length === 0) {
      alert("Minimal tambahkan 1 barang");
      return;
    }

    const invalidItem = items.find(
      (item) =>
        item.qty <= 0 ||
        item.price <= 0
    );

    if (invalidItem) {
      alert(
        "Qty dan harga semua barang harus valid"
      );
      return;
    }

    const ok = confirm(
      "Simpan Purchase Order Outlet ini?"
    );

    if (!ok) return;

    try {
      setSaving(true);

      const res = await fetch(
        "/api/outlet/purchase",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            outletId: Number(outletId),
            supplierId: Number(supplierId),
            remarks:
              remarks.trim() || null,
            items: items.map((item) => ({
              barangId: item.barangId,
              qty: item.qty,
              price: item.price,
            })),
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        alert(
          json.message ||
            "Gagal membuat Purchase Order Outlet"
        );
        return;
      }

      alert(
        "Purchase Order Outlet berhasil dibuat"
      );

      router.push("/outlet/purchase");
      router.refresh();
    } catch (error) {
      console.error(
        "CREATE OUTLET PURCHASE ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat membuat Purchase Order Outlet"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex items-center gap-3 text-gray-500">
            <RefreshCw
              size={22}
              className="animate-spin text-[#497F70]"
            />
            Memuat data...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* HEADER */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <button
            type="button"
            onClick={() =>
              router.push(
                "/outlet/purchase"
              )
            }
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DDE9E4] bg-white text-gray-600 shadow-sm transition hover:bg-[#F5F8F6]"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <ShoppingCart size={23} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Purchase Outlet Baru
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Buat Purchase Order untuk outlet
            </p>
          </div>

        </div>

      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >

        {/* INFORMASI PO */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

          <div className="border-b border-[#E5ECE9] px-5 py-4">
            <h2 className="font-semibold text-[#18352D]">
              Informasi Purchase Order
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Tentukan outlet dan supplier
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">

            {/* OUTLET */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Outlet
                <span className="ml-1 text-red-500">
                  *
                </span>
              </label>

              <select
                value={outletId}
                onChange={(e) =>
                  setOutletId(e.target.value)
                }
                className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
              >
                <option value="">
                  Pilih Outlet
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

            {/* SUPPLIER */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Supplier
                <span className="ml-1 text-red-500">
                  *
                </span>
              </label>

              <select
                value={supplierId}
                onChange={(e) =>
                  setSupplierId(e.target.value)
                }
                className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
              >
                <option value="">
                  Pilih Supplier
                </option>

                {suppliers.map((supplier) => (
                  <option
                    key={supplier.id}
                    value={supplier.id}
                  >
                    {supplier.code} -{" "}
                    {supplier.name}
                  </option>
                ))}
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
                  setRemarks(e.target.value)
                }
                rows={3}
                placeholder="Keterangan Purchase Order..."
                className="w-full resize-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
              />
            </div>

          </div>

        </div>

        {/* TAMBAH BARANG */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

          <div className="border-b border-[#E5ECE9] px-5 py-4">

            <h2 className="font-semibold text-[#18352D]">
              Tambah Barang
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Pilih barang lalu tentukan qty dan harga
            </p>

          </div>

          <div className="p-5">

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

              {/* BARANG */}

              <div className="lg:col-span-5">

                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Barang
                </label>

                <div className="relative mb-2">

                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="text"
                    value={barangSearch}
                    onChange={(e) =>
                      setBarangSearch(
                        e.target.value
                      )
                    }
                    placeholder="Cari kode / nama / barcode..."
                    className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#497F70]"
                  />

                </div>

                <select
                  value={selectedBarangId}
                  onChange={(e) =>
                    handleSelectBarang(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm outline-none focus:border-[#497F70]"
                >
                  <option value="">
                    Pilih Barang
                  </option>

                  {filteredBarang.map(
                    (item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.code} -{" "}
                        {item.name}
                      </option>
                    )
                  )}
                </select>

              </div>

              {/* QTY */}

              <div className="lg:col-span-2">

                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Qty
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={qty}
                  onChange={(e) =>
                    setQty(e.target.value)
                  }
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm outline-none focus:border-[#497F70]"
                />

              </div>

              {/* HARGA */}

              <div className="lg:col-span-3">

                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Harga
                </label>

                <input
                  type="number"
                  min="0"
                  step="any"
                  value={price}
                  onChange={(e) =>
                    setPrice(e.target.value)
                  }
                  placeholder="0"
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm outline-none focus:border-[#497F70]"
                />

                {selectedBarang && (
                  <p className="mt-1 text-xs text-gray-400">
                    Harga terakhir: Rp{" "}
                    {formatRupiah(
                      Number(
                        selectedBarang.purchasePrice ||
                          0
                      )
                    )}
                  </p>
                )}

              </div>

              {/* BUTTON */}

              <div className="flex items-end lg:col-span-2">

                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#497F70] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3D6D60]"
                >
                  <Plus size={17} />
                  Tambah
                </button>

              </div>

            </div>

          </div>

        </div>

        {/* ITEM TABLE */}

        <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

          <div className="flex flex-col gap-1 border-b border-[#E5ECE9] px-5 py-4 md:flex-row md:items-center md:justify-between">

            <div>
              <h2 className="font-semibold text-[#18352D]">
                Detail Barang
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {items.length} barang ditambahkan
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-500">
                Total Purchase Order
              </p>

              <p className="text-xl font-bold text-[#18352D]">
                Rp {formatRupiah(total)}
              </p>
            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="min-w-full text-sm">

              <thead className="bg-[#F5F8F6]">

                <tr className="border-b border-[#E5ECE9]">

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    No
                  </th>

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Barang
                  </th>

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Satuan
                  </th>

                  <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                    Qty
                  </th>

                  <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                    Harga
                  </th>

                  <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                    Subtotal
                  </th>

                  <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                    Aksi
                  </th>

                </tr>

              </thead>

              <tbody>

                {items.length === 0 ? (
                  <tr>

                    <td
                      colSpan={7}
                      className="px-5 py-14 text-center"
                    >

                      <div className="flex flex-col items-center">

                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF3EF] text-[#497F70]">
                          <ShoppingCart
                            size={25}
                          />
                        </div>

                        <p className="font-semibold text-gray-700">
                          Belum ada barang
                        </p>

                        <p className="mt-1 text-sm text-gray-400">
                          Tambahkan barang menggunakan form di atas.
                        </p>

                      </div>

                    </td>

                  </tr>
                ) : (
                  items.map(
                    (item, index) => (
                      <tr
                        key={item.barangId}
                        className="border-b border-[#EDF2EF] hover:bg-[#FAFCFB]"
                      >

                        <td className="px-5 py-4 text-gray-500">
                          {index + 1}
                        </td>

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {item.barang.name}
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {item.barang.code}
                          </div>

                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {item.barang.unit ||
                            "-"}
                        </td>

                        <td className="px-5 py-4">

                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={item.qty}
                            onChange={(e) =>
                              updateQty(
                                item.barangId,
                                e.target.value
                              )
                            }
                            className="w-24 rounded-lg border border-[#D5E5DC] bg-white px-3 py-2 text-right text-sm outline-none focus:border-[#497F70]"
                          />

                        </td>

                        <td className="px-5 py-4">

                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.price}
                            onChange={(e) =>
                              updatePrice(
                                item.barangId,
                                e.target.value
                              )
                            }
                            className="w-36 rounded-lg border border-[#D5E5DC] bg-white px-3 py-2 text-right text-sm outline-none focus:border-[#497F70]"
                          />

                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-[#18352D]">
                          Rp{" "}
                          {formatRupiah(
                            item.subtotal
                          )}
                        </td>

                        <td className="px-5 py-4 text-center">

                          <button
                            type="button"
                            onClick={() =>
                              removeItem(
                                item.barangId
                              )
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100"
                            title="Hapus barang"
                          >
                            <Trash2
                              size={16}
                            />
                          </button>

                        </td>

                      </tr>
                    )
                  )
                )}

              </tbody>

              {items.length > 0 && (
                <tfoot>

                  <tr className="bg-[#F5F8F6]">

                    <td
                      colSpan={5}
                      className="px-5 py-5 text-right font-bold text-[#18352D]"
                    >
                      TOTAL
                    </td>

                    <td className="px-5 py-5 text-right text-lg font-bold text-[#18352D]">
                      Rp{" "}
                      {formatRupiah(total)}
                    </td>

                    <td />

                  </tr>

                </tfoot>
              )}

            </table>

          </div>

        </div>

        {/* ACTION */}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

          <button
            type="button"
            onClick={() =>
              router.push(
                "/outlet/purchase"
              )
            }
            disabled={saving}
            className="rounded-xl border border-[#D5E5DC] bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-[#F5F8F6] disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={
              saving ||
              !outletId ||
              !supplierId ||
              items.length === 0
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw
                  size={17}
                  className="animate-spin"
                />
                Menyimpan...
              </>
            ) : (
              <>
                <Save size={17} />
                Simpan Purchase Outlet
              </>
            )}
          </button>

        </div>

      </form>

    </div>
  );
}