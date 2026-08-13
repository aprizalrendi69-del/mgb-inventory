"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Supplier = {
  id: number;
  name: string;
};

type Barang = {
  id: number;
  code?: string;
  name: string;
  barcode?: string;
  unit?: string;
};

type PurchaseItem = {
  barangId: string;
  qty: number;
  price: number;
};

type PriceWarning = {
  hargaLama: number;
  hargaBaru: number;
  persen: number;
  supplier: string;
};

export default function NewPurchasePage() {
  const router = useRouter();

  const [supplier, setSupplier] = useState<Supplier[]>([]);
  const [barang, setBarang] = useState<Barang[]>([]);

  const [priceWarning, setPriceWarning] = useState<
    Record<number, PriceWarning>
  >({});

  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);

  const [barangSearch, setBarangSearch] = useState<
    Record<number, string>
  >({});

  const [barangOpen, setBarangOpen] = useState<
    Record<number, boolean>
  >({});

  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    supplierId: "",

    purchaseDate: new Date()
      .toISOString()
      .substring(0, 10),

    items: [
      {
        barangId: "",
        qty: 1,
        price: 0,
      },
    ] as PurchaseItem[],
  });

  useEffect(() => {
    loadSupplier();
    loadBarang();
  }, []);

  async function loadSupplier() {
    try {
      const res = await fetch("/api/supplier", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setSupplier(json.data ?? []);
      }
    } catch (error) {
      console.error("LOAD SUPPLIER ERROR:", error);
      setSupplier([]);
    }
  }

  async function loadBarang() {
    try {
      const res = await fetch("/api/barang", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setBarang(json.data ?? []);
      }
    } catch (error) {
      console.error("LOAD BARANG ERROR:", error);
      setBarang([]);
    }
  }

  /* =========================================================
     SUPPLIER SEARCH
  ========================================================= */

  const filteredSupplier = supplier.filter((item) => {
    const keyword = supplierSearch
      .trim()
      .toLowerCase();

    if (!keyword) return true;

    return item.name
      .toLowerCase()
      .includes(keyword);
  });

  function selectedSupplierName() {
    const selected = supplier.find(
      (item) =>
        String(item.id) === form.supplierId
    );

    return selected?.name ?? "";
  }

  function selectSupplier(item: Supplier) {
    setForm({
      ...form,
      supplierId: String(item.id),
    });

    setSupplierSearch(item.name);
    setSupplierOpen(false);
  }

  /* =========================================================
     BARANG SEARCH
  ========================================================= */

  function getFilteredBarang(index: number) {
    const keyword = String(
      barangSearch[index] ?? ""
    )
      .trim()
      .toLowerCase();

    if (!keyword) {
      return barang;
    }

    return barang.filter((item) => {
      const name = String(
        item.name ?? ""
      ).toLowerCase();

      const code = String(
        item.code ?? ""
      ).toLowerCase();

      const barcode = String(
        item.barcode ?? ""
      ).toLowerCase();

      const unit = String(
        item.unit ?? ""
      ).toLowerCase();

      return (
        name.includes(keyword) ||
        code.includes(keyword) ||
        barcode.includes(keyword) ||
        unit.includes(keyword)
      );
    });
  }

  function selectedBarangName(
    barangId: string
  ) {
    const selected = barang.find(
      (item) =>
        String(item.id) === barangId
    );

    if (!selected) return "";

    return selected.name;
  }

  function selectBarang(
    index: number,
    item: Barang
  ) {
    const barangId = String(item.id);

    updateItem(
      index,
      "barangId",
      barangId
    );

    setBarangSearch((prev) => ({
      ...prev,
      [index]: item.name,
    }));

    setBarangOpen((prev) => ({
      ...prev,
      [index]: false,
    }));

    loadLastPrice(
      index,
      barangId
    );
  }

  /* =========================================================
     ITEM
  ========================================================= */

  function addItem() {
    setForm({
      ...form,

      items: [
        ...form.items,
        {
          barangId: "",
          qty: 1,
          price: 0,
        },
      ],
    });
  }

  function removeItem(index: number) {
    if (form.items.length === 1) {
      alert(
        "Minimal harus ada 1 barang."
      );
      return;
    }

    const arr = [...form.items];

    arr.splice(index, 1);

    setForm({
      ...form,
      items: arr,
    });

    setBarangSearch((prev) => {
      const next = {
        ...prev,
      };

      delete next[index];

      return next;
    });

    setBarangOpen((prev) => {
      const next = {
        ...prev,
      };

      delete next[index];

      return next;
    });

    setPriceWarning((prev) => {
      const next = {
        ...prev,
      };

      delete next[index];

      return next;
    });
  }

  function updateItem(
    index: number,
    field: keyof PurchaseItem,
    value: any
  ) {
    const arr = [...form.items];

    arr[index] = {
      ...arr[index],
      [field]: value,
    };

    setForm({
      ...form,
      items: arr,
    });
  }

  /* =========================================================
     LAST PRICE
  ========================================================= */

  async function loadLastPrice(
    index: number,
    barangId: string
  ) {
    if (!barangId) {
      return;
    }

    try {
      const res = await fetch(
        `/api/master-harga/latest/${barangId}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (
        json.success &&
        json.data
      ) {
        const arr = [...form.items];

        arr[index] = {
          ...arr[index],

          barangId,

          price: Number(
            json.data.hargaTerakhir ?? 0
          ),
        };

        setForm({
          ...form,
          items: arr,
        });
      }
    } catch (error) {
      console.error(
        "LOAD LAST PRICE ERROR:",
        error
      );
    }
  }

  /* =========================================================
     PRICE CHECK
  ========================================================= */

  async function checkPrice(
    index: number,
    barangId: string,
    harga: number
  ) {
    if (
      !barangId ||
      harga <= 0
    ) {
      setPriceWarning((prev) => {
        const next = {
          ...prev,
        };

        delete next[index];

        return next;
      });

      return;
    }

    try {
      const res = await fetch(
        `/api/master-harga/check/${barangId}/${harga}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (
        json.success &&
        json.data
      ) {
        setPriceWarning(
          (prev) => ({
            ...prev,
            [index]: json.data,
          })
        );
      }
    } catch (error) {
      console.error(
        "CHECK PRICE ERROR:",
        error
      );
    }
  }

  /* =========================================================
     SAVE
  ========================================================= */

  async function savePurchase() {
    if (!form.supplierId) {
      alert(
        "Supplier wajib dipilih."
      );
      return;
    }

    if (
      !form.items.length
    ) {
      alert(
        "Minimal harus ada 1 barang."
      );
      return;
    }

    for (const item of form.items) {
      if (
        !item.barangId ||
        Number(item.qty) <= 0 ||
        Number(item.price) <= 0
      ) {
        alert(
          "Pastikan barang, qty, dan harga sudah benar."
        );
        return;
      }
    }

    try {
      setSaving(true);

      const res = await fetch(
        "/api/purchase",
        {
          method: "POST",

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
          "Purchase berhasil dibuat"
        );

        router.push(
          "/purchase"
        );
      } else {
        alert(
          json.message ||
            "Gagal membuat Purchase Order"
        );
      }
    } catch (error) {
      console.error(
        "SAVE PURCHASE ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menyimpan Purchase Order."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      <div className="mx-auto max-w-6xl">

        {/* HEADER */}

        <div className="mb-6">

          <h1 className="text-3xl font-bold text-[#18352D]">
            Purchase Order Baru
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Buat Purchase Order kepada supplier.
          </p>

        </div>

        <div className="space-y-6">

          {/* =================================================
              INFORMASI PURCHASE
          ================================================= */}

          <div className="rounded-2xl border border-[#DDE9E4] bg-white p-6 shadow-sm">

            <h2 className="mb-5 text-lg font-bold text-[#18352D]">
              Informasi Purchase Order
            </h2>

            <div className="grid gap-5 md:grid-cols-2">

              {/* SUPPLIER */}

              <div className="relative">

                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Supplier
                </label>

                <input
                  type="text"
                  value={
                    supplierOpen
                      ? supplierSearch
                      : selectedSupplierName()
                  }
                  placeholder="Ketik nama supplier..."
                  onFocus={() => {
                    setSupplierOpen(true);

                    setSupplierSearch(
                      selectedSupplierName()
                    );
                  }}
                  onChange={(e) => {
                    setSupplierSearch(
                      e.target.value
                    );

                    setSupplierOpen(
                      true
                    );
                  }}
                  className="w-full rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                />

                {supplierOpen && (
                  <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[#D5E5DC] bg-white shadow-xl">

                    {filteredSupplier.length === 0 ? (

                      <div className="px-4 py-3 text-sm text-gray-500">
                        Supplier tidak ditemukan.
                      </div>

                    ) : (

                      filteredSupplier.map(
                        (item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              selectSupplier(
                                item
                              )
                            }
                            className="block w-full border-b border-gray-100 px-4 py-3 text-left text-sm hover:bg-[#F5F8F6]"
                          >
                            <div className="font-semibold text-gray-700">
                              {item.name}
                            </div>
                          </button>
                        )
                      )

                    )}

                  </div>
                )}

              </div>

              {/* TANGGAL */}

              <div>

                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Tanggal PO
                </label>

                <input
                  type="date"
                  className="w-full rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                  value={
                    form.purchaseDate
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      purchaseDate:
                        e.target.value,
                    })
                  }
                />

              </div>

            </div>

          </div>

          {/* =================================================
              DETAIL BARANG
          ================================================= */}

          <div className="overflow-visible rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

            <div className="border-b border-[#E5ECE9] px-6 py-5">

              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">

                <div>

                  <h2 className="text-lg font-bold text-[#18352D]">
                    Detail Barang
                  </h2>

                  <p className="text-sm text-gray-500">
                    Ketik nama, kode, barcode, atau satuan untuk mencari barang.
                  </p>

                </div>

              </div>

            </div>

            <div className="overflow-x-auto p-6">

              <div className="min-w-[900px]">

                {/* HEADER TABLE */}

                <div className="mb-3 grid grid-cols-[minmax(320px,2fr)_120px_180px_100px] gap-4 px-1">

                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Barang
                  </div>

                  <div className="text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Qty
                  </div>

                  <div className="text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Harga
                  </div>

                  <div />

                </div>

                {form.items.map(
                  (row, index) => (

                    <div
                      key={index}
                      className="mb-4"
                    >

                      <div className="grid grid-cols-[minmax(320px,2fr)_120px_180px_100px] items-start gap-4">

                        {/* BARANG SEARCH */}

                        <div className="relative">

                          <input
                            type="text"
                            value={
                              barangOpen[index]
                                ? (
                                    barangSearch[
                                      index
                                    ] ?? ""
                                  )
                                : selectedBarangName(
                                    row.barangId
                                  )
                            }
                            placeholder="Ketik nama / kode / barcode barang..."
                            onFocus={() => {
                              setBarangOpen(
                                (prev) => ({
                                  ...prev,
                                  [index]:
                                    true,
                                })
                              );

                              setBarangSearch(
                                (prev) => ({
                                  ...prev,
                                  [index]:
                                    selectedBarangName(
                                      row.barangId
                                    ),
                                })
                              );
                            }}
                            onChange={(e) => {
                              setBarangSearch(
                                (prev) => ({
                                  ...prev,
                                  [index]:
                                    e.target.value,
                                })
                              );

                              setBarangOpen(
                                (prev) => ({
                                  ...prev,
                                  [index]:
                                    true,
                                })
                              );
                            }}
                            className="w-full rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                          />

                          {barangOpen[index] && (

                            <div className="absolute left-0 top-full z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-[#D5E5DC] bg-white shadow-xl">

                              {getFilteredBarang(
                                index
                              ).length === 0 ? (

                                <div className="px-4 py-3 text-sm text-gray-500">
                                  Barang tidak ditemukan.
                                </div>

                              ) : (

                                getFilteredBarang(
                                  index
                                ).map(
                                  (item) => (
                                    <button
                                      key={
                                        item.id
                                      }
                                      type="button"
                                      onClick={() =>
                                        selectBarang(
                                          index,
                                          item
                                        )
                                      }
                                      className="block w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-[#F5F8F6]"
                                    >

                                      <div className="font-semibold text-gray-700">
                                        {item.name}
                                      </div>

                                      <div className="mt-1 text-xs text-gray-400">

                                        {item.code && (
                                          <>
                                            Kode:{" "}
                                            {
                                              item.code
                                            }
                                          </>
                                        )}

                                        {item.barcode && (
                                          <>
                                            {" • "}
                                            Barcode:{" "}
                                            {
                                              item.barcode
                                            }
                                          </>
                                        )}

                                        {item.unit && (
                                          <>
                                            {" • "}
                                            {item.unit}
                                          </>
                                        )}

                                      </div>

                                    </button>
                                  )
                                )

                              )}

                            </div>

                          )}

                        </div>

                        {/* QTY */}

                        <input
                          type="number"
                          min="1"
                          className="w-full rounded-xl border border-[#D5E5DC] px-3 py-3 text-center outline-none focus:border-[#497F70]"
                          placeholder="Qty"
                          value={row.qty}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "qty",
                              Number(
                                e.target.value
                              )
                            )
                          }
                        />

                        {/* HARGA */}

                        <input
                          type="number"
                          min="1"
                          className="w-full rounded-xl border border-[#D5E5DC] px-3 py-3 text-right outline-none focus:border-[#497F70]"
                          placeholder="Harga terakhir"
                          value={row.price}
                          onChange={(e) => {
                            const value =
                              Number(
                                e.target.value
                              );

                            updateItem(
                              index,
                              "price",
                              value
                            );

                            checkPrice(
                              index,
                              row.barangId,
                              value
                            );
                          }}
                        />

                        {/* HAPUS */}

                        <button
                          type="button"
                          onClick={() =>
                            removeItem(
                              index
                            )
                          }
                          className="rounded-xl bg-red-600 px-3 py-3 text-sm font-semibold text-white hover:bg-red-700"
                        >
                          Hapus
                        </button>

                      </div>

                      {/* PRICE WARNING */}

                      {priceWarning[index] && (

                        <div className="mt-3 rounded-xl bg-yellow-50 p-4 text-sm text-yellow-800">

                          ⚠ Harga berubah dari{" "}

                          <strong>
                            Rp{" "}
                            {Number(
                              priceWarning[
                                index
                              ]
                                .hargaLama ??
                                0
                            ).toLocaleString(
                              "id-ID"
                            )}
                          </strong>

                          {" "}menjadi{" "}

                          <strong>
                            Rp{" "}
                            {Number(
                              priceWarning[
                                index
                              ]
                                .hargaBaru ??
                                0
                            ).toLocaleString(
                              "id-ID"
                            )}
                          </strong>

                          <br />

                          Perubahan:{" "}

                          <strong>
                            {Number(
                              priceWarning[
                                index
                              ]
                                .persen ??
                                0
                            ).toFixed(2)}
                            %
                          </strong>

                          <br />

                          Supplier terakhir:{" "}

                          <strong>
                            {
                              priceWarning[
                                index
                              ].supplier ??
                              "-"
                            }
                          </strong>

                        </div>

                      )}

                    </div>

                  )
                )}

                {/* TAMBAH BARANG */}

                <button
                  type="button"
                  onClick={addItem}
                  className="mt-2 rounded-xl bg-[#497F70] px-5 py-3 text-sm font-semibold text-white hover:bg-[#3D6D60]"
                >
                  + Tambah Barang
                </button>

              </div>

            </div>

          </div>

          {/* =================================================
              FOOTER
          ================================================= */}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/purchase"
                )
              }
              className="rounded-xl border border-[#D5E5DC] bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-[#F5F8F6]"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={savePurchase}
              disabled={saving}
              className="rounded-xl bg-[#497F70] px-7 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Menyimpan..."
                : "Simpan Purchase Order"}
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}