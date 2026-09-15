"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  X,
  FileText,
  CreditCard,
  AlertTriangle,
  Check,
  Loader2,
} from "lucide-react";

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
    purchaseDate: new Date().toISOString().substring(0, 10),
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
      (item) => String(item.id) === form.supplierId
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
    const keyword = String(barangSearch[index] ?? "")
      .trim()
      .toLowerCase();

    if (!keyword) {
      return barang;
    }

    return barang.filter((item) => {
      const name = String(item.name ?? "").toLowerCase();
      const code = String(item.code ?? "").toLowerCase();
      const barcode = String(item.barcode ?? "").toLowerCase();
      const unit = String(item.unit ?? "").toLowerCase();

      return (
        name.includes(keyword) ||
        code.includes(keyword) ||
        barcode.includes(keyword) ||
        unit.includes(keyword)
      );
    });
  }

  function selectedBarangName(barangId: string) {
    const selected = barang.find(
      (item) => String(item.id) === barangId
    );

    return selected?.name ?? "";
  }

  function selectBarang(index: number, item: Barang) {
    const barangId = String(item.id);

    updateItem(index, "barangId", barangId);

    setBarangSearch((prev) => ({
      ...prev,
      [index]: item.name,
    }));

    setBarangOpen((prev) => ({
      ...prev,
      [index]: false,
    }));

    loadLastPrice(index, barangId);
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
      alert("Minimal harus ada 1 barang.");
      return;
    }

    const arr = [...form.items];

    arr.splice(index, 1);

    setForm((prev) => ({
      ...prev,
      items: arr,
    }));

    setBarangSearch((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });

    setBarangOpen((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });

    setPriceWarning((prev) => {
      const next = { ...prev };
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

      if (json.success && json.data) {
        setForm((prev) => {
          const arr = [...prev.items];

          arr[index] = {
            ...arr[index],
            barangId,
            price: Number(json.data.hargaTerakhir ?? 0),
          };

          return {
            ...prev,
            items: arr,
          };
        });
      }
    } catch (error) {
      console.error("LOAD LAST PRICE ERROR:", error);
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
    if (!barangId || harga <= 0) {
      setPriceWarning((prev) => {
        const next = { ...prev };
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

      if (json.success && json.data) {
        setPriceWarning((prev) => ({
          ...prev,
          [index]: json.data,
        }));
      } else {
        setPriceWarning((prev) => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
      }
    } catch (error) {
      console.error("CHECK PRICE ERROR:", error);
    }
  }

  /* =========================================================
     TOTAL
  ========================================================= */

  const grandTotal = useMemo(() => {
    return form.items.reduce(
      (total, item) =>
        total +
        Number(item.qty || 0) * Number(item.price || 0),
      0
    );
  }, [form.items]);

  const totalQty = useMemo(() => {
    return form.items.reduce(
      (total, item) => total + Number(item.qty || 0),
      0
    );
  }, [form.items]);

  function formatRupiah(value: number) {
    return Number(value || 0).toLocaleString("id-ID");
  }

  /* =========================================================
     SAVE
  ========================================================= */

  async function savePurchase() {
    if (!form.supplierId) {
      alert("Supplier wajib dipilih.");
      return;
    }

    if (!form.items.length) {
      alert("Minimal harus ada 1 barang.");
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

      const res = await fetch("/api/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (json.success) {
        alert("Purchase berhasil dibuat");
        router.push("/purchase");
      } else {
        alert(
          json.message ||
            "Gagal membuat Purchase Order"
        );
      }
    } catch (error) {
      console.error("SAVE PURCHASE ERROR:", error);

      alert(
        "Terjadi kesalahan saat menyimpan Purchase Order."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F7F6] text-[#18352D]">

      {/* =====================================================
          TOP HEADER
      ===================================================== */}

      <header className="sticky top-0 z-50 border-b border-[#DCE7E2] bg-white/95 backdrop-blur-xl">

        <div className="mx-auto max-w-[1500px] px-5 py-4 lg:px-8">

          <div className="flex items-center justify-between gap-4">

            <div className="flex min-w-0 items-center gap-3">

              <button
                type="button"
                onClick={() => router.push("/purchase")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D8E3DE] bg-white text-[#60746D] shadow-sm transition-all hover:border-[#497F70] hover:bg-[#F4F8F6] hover:text-[#497F70]"
                title="Kembali"
              >
                <ArrowLeft size={17} />
              </button>

              <div className="min-w-0">

                <div className="flex items-center gap-2">

                  <h1 className="truncate text-lg font-bold tracking-tight text-[#17372E] sm:text-xl">
                    Purchase Order Baru
                  </h1>

                  <span className="hidden rounded-full border border-[#D9E8E1] bg-[#F0F7F3] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#497F70] sm:inline-flex">
                    Draft
                  </span>

                </div>

                <p className="mt-0.5 hidden text-xs text-[#82918C] sm:block">
                  Buat dan kelola pembelian barang dari supplier.
                </p>

              </div>

            </div>

            <div className="flex items-center gap-2">

              <div className="hidden rounded-xl border border-[#E0E8E4] bg-[#F8FAF9] px-3.5 py-2 sm:block">

                <div className="text-[9px] font-bold uppercase tracking-widest text-[#9AA8A3]">
                  Total PO
                </div>

                <div className="mt-0.5 text-sm font-bold text-[#18352D]">
                  Rp {formatRupiah(grandTotal)}
                </div>

              </div>

              <span className="flex items-center gap-1.5 rounded-xl border border-[#D9E8E1] bg-[#F0F7F3] px-3 py-2 text-[10px] font-bold text-[#497F70] sm:hidden">
                <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />
                DRAFT
              </span>

            </div>

          </div>

        </div>

      </header>

      {/* =====================================================
          CONTENT
      ===================================================== */}

      <main className="mx-auto max-w-[1500px] px-5 py-6 pb-32 lg:px-8">

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">

          {/* =================================================
              LEFT
          ================================================= */}

          <div className="space-y-5">

            {/* =================================================
                INFORMASI PO
            ================================================= */}

            <section className="overflow-visible rounded-2xl border border-[#DDE7E2] bg-white shadow-[0_4px_20px_rgba(30,60,50,0.04)]">

              <div className="border-b border-[#E8EEEB] px-5 py-4 lg:px-6">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                    <FileText size={18} />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-[#18352D]">
                      Informasi Purchase Order
                    </h2>

                    <p className="mt-0.5 text-xs text-[#8A9893]">
                      Tentukan supplier, tanggal dan metode pembayaran.
                    </p>
                  </div>

                </div>

              </div>

              <div className="p-5 lg:p-6">

                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">

                  {/* SUPPLIER */}

                  <div className="relative lg:col-span-2">

                    <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#687A73]">
                      <UserRound size={12} />
                      Supplier
                      <span className="text-red-500">*</span>
                    </label>

                    <div className="relative">

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
                          setSupplierSearch(e.target.value);
                          setSupplierOpen(true);
                        }}
                        className="h-11 w-full rounded-xl border border-[#D6E2DD] bg-[#FBFCFC] px-3.5 pr-10 text-sm text-[#30443D] outline-none transition-all placeholder:text-[#A7B2AE] hover:border-[#BFCFC8] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                      />

                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9AA8A3]">
                        {supplierOpen ? (
                          <Search size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </div>

                    </div>

                    {supplierOpen && (
                      <div className="absolute left-0 right-0 top-[76px] z-[200] overflow-hidden rounded-xl border border-[#D5E1DC] bg-white shadow-[0_16px_40px_rgba(25,50,42,0.15)]">

                        <div className="border-b border-[#EDF1EF] bg-[#FAFCFB] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#9AA7A2]">
                          Pilih Supplier
                        </div>

                        <div className="max-h-64 overflow-y-auto">

                          {filteredSupplier.length === 0 ? (

                            <div className="px-4 py-8 text-center">

                              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F5F3] text-[#9AA8A3]">
                                <Search size={16} />
                              </div>

                              <p className="mt-2 text-xs text-[#7C8B85]">
                                Supplier tidak ditemukan.
                              </p>

                            </div>

                          ) : (

                            filteredSupplier.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() =>
                                  selectSupplier(item)
                                }
                                className="flex w-full items-center gap-3 border-b border-[#F0F3F2] px-4 py-3 text-left transition last:border-0 hover:bg-[#F4F8F6]"
                              >

                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF2EE] text-[#497F70]">
                                  <UserRound size={14} />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-semibold text-[#30443D]">
                                    {item.name}
                                  </div>
                                </div>

                                {String(item.id) ===
                                  form.supplierId && (
                                  <Check
                                    size={16}
                                    className="text-[#497F70]"
                                  />
                                )}

                              </button>
                            ))

                          )}

                        </div>

                      </div>
                    )}

                  </div>

                  {/* TANGGAL */}

                  <div>

                    <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#687A73]">
                      <CalendarDays size={12} />
                      Tanggal PO
                      <span className="text-red-500">*</span>
                    </label>

                    <div className="relative">

                      <input
                        type="date"
                        value={form.purchaseDate}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            purchaseDate:
                              e.target.value,
                          }))
                        }
                        className="h-11 w-full rounded-xl border border-[#D6E2DD] bg-[#FBFCFC] px-3.5 text-sm text-[#30443D] outline-none transition-all hover:border-[#BFCFC8] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                      />

                    </div>

                  </div>

                  {/* PAYMENT */}

                  <div>

                    <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#687A73]">
                      <CreditCard size={12} />
                      Metode Pembayaran
                    </label>

                    <div className="relative">

                      <select
                        value={form.paymentMethod}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            paymentMethod:
                              e.target.value as PaymentMethod,
                          }))
                        }
                        className="h-11 w-full appearance-none rounded-xl border border-[#D6E2DD] bg-[#FBFCFC] px-3.5 pr-9 text-sm font-medium text-[#30443D] outline-none transition-all hover:border-[#BFCFC8] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                      >
                        <option value="CASH">Cash</option>
                        <option value="TRANSFER">
                          Transfer
                        </option>
                        <option value="COD">COD</option>
                        <option value="CBD">CBD</option>
                        <option value="TEMPO">Tempo</option>
                      </select>

                      <ChevronDown
                        size={15}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A9893]"
                      />

                    </div>

                  </div>

                  {/* KETERANGAN */}

                  <div className="lg:col-span-4">

                    <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#687A73]">
                      <FileText size={12} />
                      Keterangan
                    </label>

                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          description:
                            e.target.value,
                        }))
                      }
                      placeholder="Tambahkan keterangan atau catatan untuk Purchase Order..."
                      className="w-full resize-none rounded-xl border border-[#D6E2DD] bg-[#FBFCFC] px-3.5 py-3 text-sm text-[#30443D] outline-none transition-all placeholder:text-[#A7B2AE] hover:border-[#BFCFC8] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                    />

                  </div>

                </div>

              </div>

            </section>

            {/* =================================================
                DETAIL BARANG
            ================================================= */}

            <section className="overflow-visible rounded-2xl border border-[#DDE7E2] bg-white shadow-[0_4px_20px_rgba(30,60,50,0.04)]">

              <div className="border-b border-[#E8EEEB] px-5 py-4 lg:px-6">

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                      <Package size={18} />
                    </div>

                    <div>
                      <h2 className="text-sm font-bold text-[#18352D]">
                        Detail Barang
                      </h2>

                      <p className="mt-0.5 text-xs text-[#8A9893]">
                        Tambahkan seluruh barang yang akan dibeli.
                      </p>
                    </div>

                  </div>

                  <div className="flex items-center gap-2">

                    <span className="rounded-lg border border-[#E1E9E5] bg-[#F8FAF9] px-3 py-2 text-[11px] font-semibold text-[#70807A]">
                      {form.items.length}{" "}
                      {form.items.length === 1
                        ? "Item"
                        : "Items"}
                    </span>

                    <span className="rounded-lg border border-[#E1E9E5] bg-[#F8FAF9] px-3 py-2 text-[11px] font-semibold text-[#70807A]">
                      Qty {totalQty}
                    </span>

                  </div>

                </div>

              </div>

              <div className="p-5 lg:p-6">

                <div className="overflow-x-auto">

                  <div className="min-w-[850px]">

                    {/* TABLE HEADER */}

                    <div className="grid grid-cols-[minmax(330px,1fr)_110px_190px_60px] gap-4 border-b border-[#E8EEEB] px-1 pb-3">

                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#98A49F]">
                        Barang
                      </div>

                      <div className="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[#98A49F]">
                        Qty
                      </div>

                      <div className="text-right text-[10px] font-bold uppercase tracking-[0.12em] text-[#98A49F]">
                        Harga Satuan
                      </div>

                      <div />

                    </div>

                    {/* ITEMS */}

                    <div>

                      {form.items.map((row, index) => {

                        const subtotal =
                          Number(row.qty || 0) *
                          Number(row.price || 0);

                        return (
                          <div
                            key={index}
                            className="group border-b border-[#EEF2F0] py-4 last:border-b-0"
                          >

                            <div className="grid grid-cols-[minmax(330px,1fr)_110px_190px_60px] items-start gap-4">

                              {/* BARANG */}

                              <div className="relative">

                                <div className="mb-1.5 flex items-center justify-between">

                                  <span className="text-[10px] font-semibold text-[#A0AAA6]">
                                    ITEM {String(index + 1).padStart(2, "0")}
                                  </span>

                                  {row.barangId && (
                                    <span className="flex items-center gap-1 text-[10px] font-medium text-[#497F70]">
                                      <Check size={11} />
                                      Dipilih
                                    </span>
                                  )}

                                </div>

                                <div className="relative">

                                  <input
                                    type="text"
                                    value={
                                      barangOpen[index]
                                        ? barangSearch[index] ?? ""
                                        : selectedBarangName(
                                            row.barangId
                                          )
                                    }
                                    placeholder="Cari nama, kode, barcode..."
                                    onFocus={() => {
                                      setBarangOpen(
                                        (prev) => ({
                                          ...prev,
                                          [index]: true,
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
                                          [index]: true,
                                        })
                                      );
                                    }}
                                    className="h-11 w-full rounded-xl border border-[#D6E2DD] bg-[#FBFCFC] px-3.5 pr-10 text-sm text-[#30443D] outline-none transition-all placeholder:text-[#A7B2AE] hover:border-[#BFCFC8] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                                  />

                                  <Search
                                    size={15}
                                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9AA8A3]"
                                  />

                                </div>

                                {barangOpen[index] && (
                                  <div className="absolute left-0 top-[68px] z-[200] max-h-72 w-full overflow-hidden rounded-xl border border-[#D5E1DC] bg-white shadow-[0_16px_40px_rgba(25,50,42,0.15)]">

                                    <div className="border-b border-[#EDF1EF] bg-[#FAFCFB] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#9AA7A2]">
                                      Pilih Barang
                                    </div>

                                    <div className="max-h-64 overflow-y-auto">

                                      {getFilteredBarang(index)
                                        .length === 0 ? (

                                        <div className="px-4 py-8 text-center">

                                          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F5F3] text-[#9AA8A3]">
                                            <Search size={16} />
                                          </div>

                                          <p className="mt-2 text-xs text-[#7C8B85]">
                                            Barang tidak ditemukan.
                                          </p>

                                        </div>

                                      ) : (

                                        getFilteredBarang(index).map(
                                          (item) => (
                                            <button
                                              key={item.id}
                                              type="button"
                                              onClick={() =>
                                                selectBarang(
                                                  index,
                                                  item
                                                )
                                              }
                                              className="flex w-full items-center gap-3 border-b border-[#F0F3F2] px-4 py-3 text-left transition last:border-0 hover:bg-[#F4F8F6]"
                                            >

                                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF2EE] text-[#497F70]">
                                                <Package size={15} />
                                              </div>

                                              <div className="min-w-0 flex-1">

                                                <div className="truncate text-sm font-semibold text-[#30443D]">
                                                  {item.name}
                                                </div>

                                                <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-[#9AA7A2]">

                                                  {item.code && (
                                                    <span>
                                                      Kode: {item.code}
                                                    </span>
                                                  )}

                                                  {item.barcode && (
                                                    <span>
                                                      Barcode:{" "}
                                                      {item.barcode}
                                                    </span>
                                                  )}

                                                  {item.unit && (
                                                    <span>
                                                      Unit: {item.unit}
                                                    </span>
                                                  )}

                                                </div>

                                              </div>

                                              {String(item.id) ===
                                                row.barangId && (
                                                <Check
                                                  size={16}
                                                  className="text-[#497F70]"
                                                />
                                              )}

                                            </button>
                                          )
                                        )

                                      )}

                                    </div>

                                  </div>
                                )}

                              </div>

                              {/* QTY */}

                              <div>

                                <div className="mb-1.5 text-center text-[10px] font-semibold text-[#A0AAA6]">
                                  JUMLAH
                                </div>

                                <input
                                  type="number"
                                  min="1"
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
                                  className="h-11 w-full rounded-xl border border-[#D6E2DD] bg-[#FBFCFC] px-2 text-center text-sm font-semibold text-[#30443D] outline-none transition-all hover:border-[#BFCFC8] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                                />

                              </div>

                              {/* HARGA */}

                              <div>

                                <div className="mb-1.5 flex items-center justify-between">

                                  <span className="text-[10px] font-semibold text-[#A0AAA6]">
                                    HARGA SATUAN
                                  </span>

                                </div>

                                <div className="relative">

                                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[#9AA8A3]">
                                    Rp
                                  </span>

                                  <input
                                    type="number"
                                    min="1"
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
                                    className="h-11 w-full rounded-xl border border-[#D6E2DD] bg-[#FBFCFC] pl-9 pr-3 text-right text-sm font-semibold text-[#30443D] outline-none transition-all hover:border-[#BFCFC8] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                                  />

                                </div>

                                <div className="mt-1.5 flex items-center justify-between">

                                  <span className="text-[10px] text-[#A0AAA6]">
                                    Subtotal
                                  </span>

                                  <span className="text-[11px] font-bold text-[#52665E]">
                                    Rp {formatRupiah(subtotal)}
                                  </span>

                                </div>

                              </div>

                              {/* HAPUS */}

                              <div className="pt-[23px]">

                                <button
                                  type="button"
                                  onClick={() =>
                                    removeItem(index)
                                  }
                                  className="flex h-11 w-full items-center justify-center rounded-xl border border-[#F0D7D7] bg-[#FFF8F8] text-[#C56B6B] transition-all hover:border-[#E7BABA] hover:bg-[#FFF0F0] hover:text-[#B94F4F]"
                                  title="Hapus barang"
                                >
                                  <Trash2 size={15} />
                                </button>

                              </div>

                            </div>

                            {/* PRICE WARNING */}

                            {priceWarning[index] && (
                              <div className="mt-3 rounded-xl border border-[#F0DFB0] bg-[#FFFBF0] px-4 py-3">

                                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">

                                  <div className="flex items-center gap-2 text-xs font-bold text-[#9A751E]">

                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFF1C9]">
                                      <AlertTriangle size={14} />
                                    </div>

                                    Harga berubah
                                  </div>

                                  <div className="h-4 w-px bg-[#EBDDB9]" />

                                  <div className="text-[11px] text-[#806F45]">
                                    Lama:
                                    <strong className="ml-1 text-[#66562F]">
                                      Rp{" "}
                                      {formatRupiah(
                                        priceWarning[index]
                                          .hargaLama
                                      )}
                                    </strong>
                                  </div>

                                  <div className="text-[11px] text-[#806F45]">
                                    Baru:
                                    <strong className="ml-1 text-[#66562F]">
                                      Rp{" "}
                                      {formatRupiah(
                                        priceWarning[index]
                                          .hargaBaru
                                      )}
                                    </strong>
                                  </div>

                                  <div className="text-[11px] text-[#806F45]">
                                    Perubahan:
                                    <strong className="ml-1 text-[#66562F]">
                                      {Number(
                                        priceWarning[index]
                                          .persen ?? 0
                                      ).toFixed(2)}
                                      %
                                    </strong>
                                  </div>

                                  <div className="text-[11px] text-[#806F45]">
                                    Supplier:
                                    <strong className="ml-1 text-[#66562F]">
                                      {priceWarning[index]
                                        .supplier ?? "-"}
                                    </strong>
                                  </div>

                                </div>

                              </div>
                            )}

                          </div>
                        );
                      })}

                    </div>

                  </div>

                </div>

                {/* ADD ITEM */}

                <div className="mt-5 flex flex-col gap-4 border-t border-[#E8EEEB] pt-5 sm:flex-row sm:items-center sm:justify-between">

                  <button
                    type="button"
                    onClick={addItem}
                    className="flex w-fit items-center gap-2 rounded-xl border border-[#C9DCD4] bg-[#F2F8F5] px-4 py-2.5 text-xs font-bold text-[#497F70] transition-all hover:border-[#AFCBBF] hover:bg-[#E8F3EE]"
                  >
                    <Plus size={15} />
                    Tambah Barang
                  </button>

                  <div className="flex items-center gap-5">

                    <div className="text-right">

                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#9AA7A2]">
                        Total
                      </div>

                      <div className="mt-0.5 text-xs text-[#7F8D88]">
                        {form.items.length} item · {totalQty} qty
                      </div>

                    </div>

                    <div className="h-9 w-px bg-[#DCE5E1]" />

                    <div className="text-right">

                      <div className="text-xl font-extrabold tracking-tight text-[#18352D]">
                        Rp {formatRupiah(grandTotal)}
                      </div>

                    </div>

                  </div>

                </div>

              </div>

            </section>

          </div>

          {/* =================================================
              RIGHT SUMMARY
          ================================================= */}

          <aside className="hidden xl:block">

            <div className="sticky top-[90px] space-y-4">

              <div className="overflow-hidden rounded-2xl border border-[#DDE7E2] bg-white shadow-[0_4px_20px_rgba(30,60,50,0.04)]">

                <div className="border-b border-[#E8EEEB] px-5 py-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                      <ShoppingCart size={16} />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-[#18352D]">
                        Ringkasan PO
                      </h3>

                      <p className="text-[10px] text-[#929F9A]">
                        Review sebelum disimpan.
                      </p>
                    </div>

                  </div>

                </div>

                <div className="p-5">

                  <div className="space-y-4">

                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-[#A0AAA6]">
                        Supplier
                      </div>

                      <div className="mt-1.5 flex items-center gap-2">

                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F0F5F2] text-[#647A71]">
                          <UserRound size={13} />
                        </div>

                        <div className="min-w-0 flex-1 truncate text-xs font-semibold text-[#40544C]">
                          {selectedSupplierName() ||
                            "Belum dipilih"}
                        </div>

                      </div>
                    </div>

                    <div className="h-px bg-[#EEF2F0]" />

                    <div className="grid grid-cols-2 gap-4">

                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-[#A0AAA6]">
                          Item
                        </div>
                        <div className="mt-1 text-sm font-bold text-[#30443D]">
                          {form.items.length}
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-[#A0AAA6]">
                          Qty
                        </div>
                        <div className="mt-1 text-sm font-bold text-[#30443D]">
                          {totalQty}
                        </div>
                      </div>

                    </div>

                    <div className="rounded-xl bg-[#F5F8F6] p-4">

                      <div className="text-[9px] font-bold uppercase tracking-widest text-[#8D9B95]">
                        Total Purchase Order
                      </div>

                      <div className="mt-1 text-xl font-extrabold tracking-tight text-[#18352D]">
                        Rp {formatRupiah(grandTotal)}
                      </div>

                    </div>

                    <div className="flex items-center justify-between text-[11px]">

                      <span className="text-[#899690]">
                        Pembayaran
                      </span>

                      <span className="rounded-lg bg-[#EFF5F2] px-2.5 py-1 font-bold text-[#497F70]">
                        {form.paymentMethod}
                      </span>

                    </div>

                  </div>

                </div>

              </div>

              <div className="rounded-2xl border border-[#DDE7E2] bg-[#18352D] p-5 text-white shadow-[0_8px_30px_rgba(24,53,45,0.12)]">

                <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/50">
                  Status Dokumen
                </div>

                <div className="mt-2 flex items-center gap-2">

                  <span className="h-2 w-2 rounded-full bg-[#91C5AF]" />

                  <span className="text-sm font-bold">
                    DRAFT
                  </span>

                </div>

                <p className="mt-3 text-[10px] leading-relaxed text-white/55">
                  Purchase Order belum diproses dan masih dapat
                  diperiksa sebelum disimpan.
                </p>

              </div>

            </div>

          </aside>

        </div>

      </main>

      {/* =====================================================
          MOBILE / DESKTOP ACTION BAR
      ===================================================== */}

      <div className="fixed bottom-0 left-0 right-0 z-[100] border-t border-[#DCE6E1] bg-white/95 shadow-[0_-8px_30px_rgba(20,45,37,0.07)] backdrop-blur-xl">

        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-3 lg:px-8">

          <div className="hidden min-w-0 sm:block">

            {form.supplierId ? (

              <div className="flex items-center gap-2">

                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF2EE] text-[#497F70]">
                  <Check size={14} />
                </div>

                <div className="min-w-0">

                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#9AA7A2]">
                    Supplier
                  </div>

                  <div className="max-w-[300px] truncate text-xs font-semibold text-[#40544C]">
                    {selectedSupplierName()}
                  </div>

                </div>

              </div>

            ) : (

              <div className="text-xs text-[#9A6767]">
                Supplier belum dipilih
              </div>

            )}

          </div>

          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">

            <div className="mr-1 text-right sm:hidden">

              <div className="text-[9px] font-bold uppercase tracking-wider text-[#9AA7A2]">
                Total
              </div>

              <div className="text-sm font-extrabold text-[#18352D]">
                Rp {formatRupiah(grandTotal)}
              </div>

            </div>

            <button
              type="button"
              onClick={() => router.push("/purchase")}
              disabled={saving}
              className="rounded-xl border border-[#D5E1DC] bg-white px-4 py-2.5 text-xs font-bold text-[#66766F] transition-all hover:bg-[#F4F7F5] disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={savePurchase}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-[#497F70] px-5 py-2.5 text-xs font-bold text-white shadow-[0_4px_12px_rgba(73,127,112,0.22)] transition-all hover:bg-[#3D6D60] hover:shadow-[0_6px_16px_rgba(73,127,112,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Simpan Purchase Order
                </>
              )}
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}