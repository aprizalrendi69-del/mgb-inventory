"use client";

import { useEffect, useMemo, useState } from "react";
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

type PaymentMethod =
  | "CASH"
  | "TRANSFER"
  | "COD"
  | "CBD"
  | "TEMPO";

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

    paymentMethod: "CASH" as PaymentMethod,

    description: "",

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
     SUPPLIER
  ========================================================= */

  const filteredSupplier = useMemo(() => {
    const keyword = supplierSearch.trim().toLowerCase();

    if (!keyword) return supplier;

    return supplier.filter((item) =>
      item.name.toLowerCase().includes(keyword)
    );
  }, [supplier, supplierSearch]);

  function selectedSupplierName() {
    const selected = supplier.find(
      (item) =>
        String(item.id) === form.supplierId
    );

    return selected?.name ?? "";
  }

  function selectSupplier(item: Supplier) {
    setForm((prev) => ({
      ...prev,
      supplierId: String(item.id),
    }));

    setSupplierSearch(item.name);
    setSupplierOpen(false);
  }

  /* =========================================================
     BARANG
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

    return selected?.name ?? "";
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
    setForm((prev) => ({
      ...prev,

      items: [
        ...prev.items,
        {
          barangId: "",
          qty: 1,
          price: 0,
        },
      ],
    }));
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

    setForm((prev) => ({
      ...prev,
      items: arr,
    }));

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
    setForm((prev) => {
      const arr = [...prev.items];

      arr[index] = {
        ...arr[index],
        [field]: value,
      };

      return {
        ...prev,
        items: arr,
      };
    });
  }

  /* =========================================================
     LAST PRICE
  ========================================================= */

  async function loadLastPrice(
    index: number,
    barangId: string
  ) {
    if (!barangId) return;

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
        setForm((prev) => {
          const arr = [...prev.items];

          arr[index] = {
            ...arr[index],
            barangId,
            price: Number(
              json.data.hargaTerakhir ?? 0
            ),
          };

          return {
            ...prev,
            items: arr,
          };
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
      } else {
        setPriceWarning((prev) => {
          const next = {
            ...prev,
          };

          delete next[index];

          return next;
        });
      }
    } catch (error) {
      console.error(
        "CHECK PRICE ERROR:",
        error
      );
    }
  }

  /* =========================================================
     TOTAL
  ========================================================= */

  const grandTotal = useMemo(() => {
    return form.items.reduce(
      (total, item) =>
        total +
        Number(item.qty || 0) *
          Number(item.price || 0),
      0
    );
  }, [form.items]);

  function formatRupiah(value: number) {
    return Number(value || 0).toLocaleString(
      "id-ID"
    );
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
    <div className="min-h-full bg-[#F5F7F6]">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="border-b border-[#DDE7E2] bg-white">

        <div className="mx-auto max-w-7xl px-5 py-5 lg:px-7">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <div className="flex items-center gap-3">

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/purchase"
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D9E4DF] bg-white text-gray-500 transition hover:bg-[#F4F7F5] hover:text-[#497F70]"
                  title="Kembali"
                >
                  ←
                </button>

                <div>
                  <h1 className="text-xl font-bold tracking-tight text-[#18352D]">
                    Purchase Order Baru
                  </h1>

                  <p className="mt-0.5 text-xs text-gray-500">
                    Buat Purchase Order kepada supplier.
                  </p>
                </div>

              </div>
            </div>

            <div className="flex items-center gap-2">

              <div className="rounded-lg border border-[#DDE7E2] bg-[#F8FAF9] px-3 py-2 text-xs text-gray-500">
                Status
                <span className="ml-2 font-semibold text-[#497F70]">
                  DRAFT
                </span>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* =====================================================
          CONTENT
      ===================================================== */}

      <div className="mx-auto max-w-7xl px-5 py-5 lg:px-7">

        <div className="space-y-5">

          {/* =================================================
              INFORMASI PO
          ================================================= */}

          <div className="rounded-xl border border-[#DDE7E2] bg-white shadow-sm">

            <div className="border-b border-[#E7ECEA] px-5 py-4">

              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF2EE] text-[#497F70]">
                  📋
                </div>

                <div>
                  <h2 className="text-sm font-bold text-[#18352D]">
                    Informasi Purchase Order
                  </h2>

                  <p className="text-xs text-gray-500">
                    Lengkapi informasi utama PO.
                  </p>
                </div>

              </div>

            </div>

            <div className="p-5">

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

                {/* SUPPLIER */}

                <div className="relative lg:col-span-2">

                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Supplier
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    type="text"
                    value={
                      supplierOpen
                        ? supplierSearch
                        : selectedSupplierName()
                    }
                    placeholder="Cari supplier..."
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
                    className="h-10 w-full rounded-lg border border-[#D5E1DC] bg-white px-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                  />

                  {supplierOpen && (
                    <div className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-60 overflow-y-auto rounded-lg border border-[#D5E1DC] bg-white shadow-xl">

                      {filteredSupplier.length ===
                      0 ? (

                        <div className="px-3 py-3 text-xs text-gray-500">
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
                              className="block w-full border-b border-gray-100 px-3 py-2.5 text-left text-sm transition last:border-0 hover:bg-[#F4F8F6]"
                            >
                              <div className="font-medium text-gray-700">
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

                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Tanggal PO
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    type="date"
                    value={
                      form.purchaseDate
                    }
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        purchaseDate:
                          e.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-[#D5E1DC] bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                  />

                </div>

                {/* PAYMENT */}

                <div>

                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Metode Pembayaran
                  </label>

                  <select
                    value={
                      form.paymentMethod
                    }
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        paymentMethod:
                          e.target
                            .value as PaymentMethod,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-[#D5E1DC] bg-white px-3 text-sm font-medium text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                  >
                    <option value="CASH">
                      Cash
                    </option>

                    <option value="TRANSFER">
                      Transfer
                    </option>

                    <option value="COD">
                      COD
                    </option>

                    <option value="CBD">
                      CBD
                    </option>

                    <option value="TEMPO">
                      Tempo
                    </option>
                  </select>

                </div>

                {/* KETERANGAN */}

                <div className="lg:col-span-4">

                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Keterangan
                  </label>

                  <textarea
                    rows={2}
                    value={
                      form.description
                    }
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        description:
                          e.target.value,
                      }))
                    }
                    placeholder="Tambahkan keterangan Purchase Order..."
                    className="w-full resize-none rounded-lg border border-[#D5E1DC] bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                  />

                </div>

              </div>

            </div>

          </div>

          {/* =================================================
              DETAIL BARANG
          ================================================= */}

          <div className="overflow-visible rounded-xl border border-[#DDE7E2] bg-white shadow-sm">

            <div className="border-b border-[#E7ECEA] px-5 py-4">

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF2EE] text-[#497F70]">
                    📦
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-[#18352D]">
                      Detail Barang
                    </h2>

                    <p className="text-xs text-gray-500">
                      Tambahkan barang yang akan dibeli.
                    </p>
                  </div>

                </div>

                <div className="rounded-lg bg-[#F5F8F6] px-3 py-2 text-xs text-gray-500">
                  {form.items.length}{" "}
                  item
                  {form.items.length !==
                  1
                    ? "s"
                    : ""}
                </div>

              </div>

            </div>

            <div className="p-5">

              {/* TABLE */}

              <div className="overflow-x-auto">

                <div className="min-w-[780px]">

                  {/* HEADER */}

                  <div className="grid grid-cols-[minmax(280px,1fr)_100px_170px_70px] gap-3 border-b border-[#E7ECEA] px-1 pb-2">

                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Barang
                    </div>

                    <div className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Qty
                    </div>

                    <div className="text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Harga Satuan
                    </div>

                    <div />

                  </div>

                  {/* ITEMS */}

                  <div className="pt-2">

                    {form.items.map(
                      (row, index) => {

                        const subtotal =
                          Number(
                            row.qty || 0
                          ) *
                          Number(
                            row.price || 0
                          );

                        return (
                          <div
                            key={index}
                            className="border-b border-[#EEF2F0] py-3 last:border-b-0"
                          >

                            <div className="grid grid-cols-[minmax(280px,1fr)_100px_170px_70px] items-start gap-3">

                              {/* BARANG */}

                              <div className="relative">

                                <input
                                  type="text"
                                  value={
                                    barangOpen[
                                      index
                                    ]
                                      ? (
                                          barangSearch[
                                            index
                                          ] ??
                                          ""
                                        )
                                      : selectedBarangName(
                                          row.barangId
                                        )
                                  }
                                  placeholder="Cari nama / kode / barcode..."
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
                                          e.target
                                            .value,
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
                                  className="h-10 w-full rounded-lg border border-[#D5E1DC] bg-white px-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                                />

                                {barangOpen[
                                  index
                                ] && (

                                  <div className="absolute left-0 top-full z-[100] mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#D5E1DC] bg-white shadow-xl">

                                    {getFilteredBarang(
                                      index
                                    ).length ===
                                    0 ? (

                                      <div className="px-3 py-3 text-xs text-gray-500">
                                        Barang tidak ditemukan.
                                      </div>

                                    ) : (

                                      getFilteredBarang(
                                        index
                                      ).map(
                                        (
                                          item
                                        ) => (
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
                                            className="block w-full border-b border-gray-100 px-3 py-2.5 text-left transition last:border-0 hover:bg-[#F4F8F6]"
                                          >

                                            <div className="text-sm font-semibold text-gray-700">
                                              {
                                                item.name
                                              }
                                            </div>

                                            <div className="mt-0.5 text-[10px] text-gray-400">

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
                                                  {
                                                    item.unit
                                                  }
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
                                value={
                                  row.qty
                                }
                                onChange={(
                                  e
                                ) =>
                                  updateItem(
                                    index,
                                    "qty",
                                    Number(
                                      e.target
                                        .value
                                    )
                                  )
                                }
                                className="h-10 w-full rounded-lg border border-[#D5E1DC] px-2 text-center text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                              />

                              {/* HARGA */}

                              <div>

                                <div className="relative">

                                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                    Rp
                                  </span>

                                  <input
                                    type="number"
                                    min="1"
                                    value={
                                      row.price
                                    }
                                    onChange={(
                                      e
                                    ) => {
                                      const value =
                                        Number(
                                          e.target
                                            .value
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
                                    className="h-10 w-full rounded-lg border border-[#D5E1DC] pl-9 pr-2 text-right text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                                  />

                                </div>

                                <div className="mt-1 text-right text-[10px] text-gray-400">
                                  Subtotal:{" "}
                                  <span className="font-semibold text-gray-600">
                                    Rp{" "}
                                    {formatRupiah(
                                      subtotal
                                    )}
                                  </span>
                                </div>

                              </div>

                              {/* HAPUS */}

                              <button
                                type="button"
                                onClick={() =>
                                  removeItem(
                                    index
                                  )
                                }
                                className="flex h-10 w-full items-center justify-center rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                                title="Hapus barang"
                              >
                                Hapus
                              </button>

                            </div>

                            {/* WARNING */}

                            {priceWarning[
                              index
                            ] && (

                              <div className="mt-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5">

                                <div className="flex flex-wrap items-start gap-x-4 gap-y-1 text-xs text-yellow-800">

                                  <span className="font-semibold">
                                    ⚠ Harga berubah
                                  </span>

                                  <span>
                                    Lama:{" "}
                                    <strong>
                                      Rp{" "}
                                      {formatRupiah(
                                        priceWarning[
                                          index
                                        ]
                                          .hargaLama
                                      )}
                                    </strong>
                                  </span>

                                  <span>
                                    Baru:{" "}
                                    <strong>
                                      Rp{" "}
                                      {formatRupiah(
                                        priceWarning[
                                          index
                                        ]
                                          .hargaBaru
                                      )}
                                    </strong>
                                  </span>

                                  <span>
                                    Perubahan:{" "}
                                    <strong>
                                      {Number(
                                        priceWarning[
                                          index
                                        ]
                                          .persen ??
                                          0
                                      ).toFixed(
                                        2
                                      )}
                                      %
                                    </strong>
                                  </span>

                                  <span>
                                    Supplier terakhir:{" "}
                                    <strong>
                                      {
                                        priceWarning[
                                          index
                                        ]
                                          .supplier ??
                                          "-"
                                      }
                                    </strong>
                                  </span>

                                </div>

                              </div>

                            )}

                          </div>
                        );
                      }
                    )}

                  </div>

                </div>

              </div>

              {/* ADD ITEM + TOTAL */}

              <div className="mt-4 flex flex-col gap-4 border-t border-[#E7ECEA] pt-4 sm:flex-row sm:items-center sm:justify-between">

                <button
                  type="button"
                  onClick={addItem}
                  className="w-fit rounded-lg bg-[#497F70] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#3D6D60]"
                >
                  + Tambah Barang
                </button>

                <div className="flex items-center justify-between gap-8 rounded-lg bg-[#F5F8F6] px-4 py-3 sm:min-w-[300px]">

                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Total PO
                    </div>

                    <div className="text-xs text-gray-500">
                      {form.items.length}{" "}
                      item
                    </div>
                  </div>

                  <div className="text-right">

                    <div className="text-lg font-bold text-[#18352D]">
                      Rp{" "}
                      {formatRupiah(
                        grandTotal
                      )}
                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>

          {/* =================================================
              FOOTER ACTION
          ================================================= */}

          <div className="sticky bottom-0 z-40 -mx-5 border-t border-[#DDE7E2] bg-[#F5F7F6]/95 px-5 py-4 backdrop-blur lg:-mx-7 lg:px-7">

            <div className="mx-auto flex max-w-7xl flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">

              <div className="text-xs text-gray-500">

                {form.supplierId ? (
                  <>
                    Supplier:{" "}
                    <span className="font-semibold text-gray-700">
                      {
                        selectedSupplierName()
                      }
                    </span>
                  </>
                ) : (
                  "Supplier belum dipilih"
                )}

              </div>

              <div className="flex gap-2">

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/purchase"
                    )
                  }
                  disabled={saving}
                  className="rounded-lg border border-[#D5E1DC] bg-white px-5 py-2.5 text-xs font-semibold text-gray-600 transition hover:bg-[#F4F7F5] disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={savePurchase}
                  disabled={saving}
                  className="rounded-lg bg-[#497F70] px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Menyimpan..."
                    : "Simpan Purchase Order"}
                </button>

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}