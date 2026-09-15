"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  Package,
  Plus,
  Search,
  Trash2,
  AlertTriangle,
  LockKeyhole,
  Loader2,
  Hash,
} from "lucide-react";

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

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "COD", label: "COD" },
  { value: "CBD", label: "CBD" },
  { value: "TEMPO", label: "Tempo" },
];

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
    setText(value === 0 ? "" : String(value));
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    let input = e.target.value;

    input = input.replace(",", ".");
    input = input.replace(/[^0-9.]/g, "");

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

/* =====================================================
   BARANG SEARCH INPUT
===================================================== */

type BarangSearchProps = {
  value: number;
  barangs: Barang[];
  selectedBarang?: Barang;
  onChange: (barangId: number) => void;
};

function BarangSearch({
  value,
  barangs,
  selectedBarang,
  onChange,
}: BarangSearchProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedBarang) {
      setSearch(
        `${selectedBarang.code} - ${selectedBarang.name}`
      );
    }
  }, [selectedBarang]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        ref.current &&
        !ref.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);

        if (selectedBarang) {
          setSearch(
            `${selectedBarang.code} - ${selectedBarang.name}`
          );
        }
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, [selectedBarang]);

  const keyword =
    search.trim().toLowerCase();

  const filteredBarangs =
    keyword === ""
      ? barangs.slice(0, 20)
      : barangs
          .filter((barang) => {
            const code =
              barang.code?.toLowerCase() || "";

            const name =
              barang.name?.toLowerCase() || "";

            return (
              code.includes(keyword) ||
              name.includes(keyword)
            );
          })
          .slice(0, 30);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const text = e.target.value;

    setSearch(text);
    setOpen(true);

    if (!text.trim()) {
      onChange(0);
    }
  }

  function handleSelect(barang: Barang) {
    onChange(barang.id);

    setSearch(
      `${barang.code} - ${barang.name}`
    );

    setOpen(false);
  }

  return (
    <div
      ref={ref}
      className="relative min-w-[320px]"
    >
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[#9AA7A2]"
        />

        <input
          type="text"
          value={search}
          onFocus={() => setOpen(true)}
          onChange={handleChange}
          placeholder="Cari kode atau nama barang..."
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-[#D6E2DD] bg-[#FCFDFC] pl-10 pr-10 text-sm font-medium text-[#354840] outline-none transition-all placeholder:text-[#A3ADA9] hover:border-[#C4D4CD] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
        />

        <ChevronDown
          size={15}
          className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8C9A94] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </div>

      {open && (
        <div className="absolute left-0 top-full z-[100] mt-2 w-full overflow-hidden rounded-2xl border border-[#D6E2DD] bg-white shadow-[0_18px_50px_rgba(31,59,50,0.16)]">
          <div className="border-b border-[#EDF1EF] bg-[#F8FAF9] px-4 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C8B84]">
                Pilih Barang
              </span>

              <span className="text-[10px] text-[#9AA7A2]">
                {filteredBarangs.length} hasil
              </span>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {filteredBarangs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F3] text-[#9AA7A2]">
                  <Package size={17} />
                </div>

                <p className="text-xs font-semibold text-[#66756E]">
                  Barang tidak ditemukan
                </p>

                <p className="mt-1 text-[10px] text-[#A1ABA7]">
                  Coba gunakan kode atau nama lain.
                </p>
              </div>
            ) : (
              filteredBarangs.map((barang) => {
                const selected =
                  barang.id === value;

                return (
                  <button
                    key={barang.id}
                    type="button"
                    onMouseDown={(e) =>
                      e.preventDefault()
                    }
                    onClick={() =>
                      handleSelect(barang)
                    }
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-all ${
                      selected
                        ? "bg-[#EAF4EF]"
                        : "hover:bg-[#F5F8F6]"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-[#F0F4F2] px-2 py-1 font-mono text-[10px] font-bold text-[#497F70]">
                          {barang.code}
                        </span>

                        {barang.unit && (
                          <span className="text-[10px] font-medium text-[#9AA7A2]">
                            {barang.unit}
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 truncate text-sm font-semibold text-[#29443B]">
                        {barang.name}
                      </div>
                    </div>

                    {selected && (
                      <div className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#497F70] text-white">
                        <Check size={14} />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =====================================================
   SUPPLIER SEARCH INPUT
===================================================== */

type SupplierSearchProps = {
  value: string;
  suppliers: Supplier[];
  onChange: (supplierId: string) => void;
};

function SupplierSearch({
  value,
  suppliers,
  onChange,
}: SupplierSearchProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);

  const selectedSupplier = suppliers.find(
    (supplier) =>
      String(supplier.id) === String(value)
  );

  /* ---------------------------------------------------
     SET NAMA SUPPLIER SAAT PO SELESAI LOAD
  --------------------------------------------------- */

  useEffect(() => {
    if (selectedSupplier) {
      setSearch(selectedSupplier.name);
    }
  }, [selectedSupplier]);

  /* ---------------------------------------------------
     CLICK OUTSIDE
  --------------------------------------------------- */

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        ref.current &&
        !ref.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);

        if (selectedSupplier) {
          setSearch(selectedSupplier.name);
        }
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, [selectedSupplier]);

  /* ---------------------------------------------------
     FILTER SUPPLIER
  --------------------------------------------------- */

  const keyword =
    search.trim().toLowerCase();

  const filteredSuppliers =
    keyword === ""
      ? suppliers.slice(0, 30)
      : suppliers
          .filter((supplier) =>
            supplier.name
              .toLowerCase()
              .includes(keyword)
          )
          .slice(0, 30);

  /* ---------------------------------------------------
     INPUT CHANGE
  --------------------------------------------------- */

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const text = e.target.value;

    setSearch(text);
    setOpen(true);

    /*
     * Kalau user menghapus seluruh isi,
     * supplier juga dianggap belum dipilih.
     */
    if (!text.trim()) {
      onChange("");
    }
  }

  /* ---------------------------------------------------
     SELECT SUPPLIER
  --------------------------------------------------- */

  function handleSelect(
    supplier: Supplier
  ) {
    onChange(String(supplier.id));
    setSearch(supplier.name);
    setOpen(false);
  }

  return (
    <div
      ref={ref}
      className="relative"
    >
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[#9AA7A2]"
        />

        <input
          type="text"
          value={search}
          onFocus={() => setOpen(true)}
          onChange={handleChange}
          placeholder="Ketik nama supplier..."
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-[#D6E2DD] bg-[#FCFDFC] pl-10 pr-10 text-sm font-medium text-[#354840] outline-none transition-all placeholder:text-[#A3ADA9] hover:border-[#C4D4CD] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
        />

        <ChevronDown
          size={15}
          className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#899791] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </div>

      {open && (
        <div className="absolute left-0 top-full z-[100] mt-2 w-full overflow-hidden rounded-2xl border border-[#D6E2DD] bg-white shadow-[0_18px_50px_rgba(31,59,50,0.16)]">
          <div className="border-b border-[#EDF1EF] bg-[#F8FAF9] px-4 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C8B84]">
                Pilih Supplier
              </span>

              <span className="text-[10px] text-[#9AA7A2]">
                {filteredSuppliers.length} hasil
              </span>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {filteredSuppliers.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F3] text-[#9AA7A2]">
                  <Package size={17} />
                </div>

                <p className="text-xs font-semibold text-[#66756E]">
                  Supplier tidak ditemukan
                </p>

                <p className="mt-1 text-[10px] text-[#A1ABA7]">
                  Coba ketik nama supplier lain.
                </p>
              </div>
            ) : (
              filteredSuppliers.map(
                (supplier) => {
                  const selected =
                    String(supplier.id) ===
                    String(value);

                  return (
                    <button
                      key={supplier.id}
                      type="button"
                      onMouseDown={(e) =>
                        e.preventDefault()
                      }
                      onClick={() =>
                        handleSelect(
                          supplier
                        )
                      }
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-all ${
                        selected
                          ? "bg-[#EAF4EF]"
                          : "hover:bg-[#F5F8F6]"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F0F4F2] text-[#497F70]">
                            <Package size={13} />
                          </span>

                          <span className="truncate text-sm font-semibold text-[#29443B]">
                            {supplier.name}
                          </span>
                        </div>
                      </div>

                      {selected && (
                        <div className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#497F70] text-white">
                          <Check size={14} />
                        </div>
                      )}
                    </button>
                  );
                }
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =====================================================
   PAGE
===================================================== */

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

  const [paymentMethod, setPaymentMethod] =
    useState("");

  const [remarks, setRemarks] =
    useState("");

  const [items, setItems] =
    useState<PurchaseItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  /* =====================================================
     LOAD DATA
  ===================================================== */

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

      setPaymentMethod(
        String(
          data.paymentMethod ?? ""
        ).toUpperCase()
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

  /* =====================================================
     ADD ITEM
  ===================================================== */

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

  /* =====================================================
     REMOVE ITEM
  ===================================================== */

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

  /* =====================================================
     UPDATE ITEM
  ===================================================== */

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

  /* =====================================================
     TOTAL
  ===================================================== */

  const total = items.reduce(
    (sum, item) =>
      sum +
      Number(item.qty || 0) *
        Number(item.price || 0),
    0
  );

  /* =====================================================
     SUBMIT
  ===================================================== */

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

    if (!paymentMethod) {
      alert(
        "Metode pembayaran wajib dipilih"
      );

      return;
    }

    if (
      !PAYMENT_METHODS.some(
        (method) =>
          method.value ===
          paymentMethod
      )
    ) {
      alert(
        "Metode pembayaran tidak valid"
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

            paymentMethod:
              paymentMethod,

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
        console.error(
          "UPDATE PURCHASE RESPONSE:",
          json
        );

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

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F6F4]">
        <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-[#DCE7E2]" />

            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-[#DCE7E2]" />
              <div className="h-6 w-56 animate-pulse rounded bg-[#DCE7E2]" />
            </div>
          </div>

          <div className="space-y-5">
            <div className="h-56 animate-pulse rounded-2xl border border-[#DDE7E2] bg-white" />
            <div className="h-96 animate-pulse rounded-2xl border border-[#DDE7E2] bg-white" />
          </div>
        </div>
      </div>
    );
  }

  /* =====================================================
     NOT FOUND
  ===================================================== */

  if (!purchase) {
    return (
      <div className="min-h-screen bg-[#F3F6F4] px-5 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-[#DDE7E2] bg-white p-10 text-center shadow-[0_4px_20px_rgba(31,59,50,0.04)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F5F3] text-[#8A9892]">
              <FileText size={22} />
            </div>

            <h1 className="mt-4 text-lg font-bold text-[#18352D]">
              Purchase Order tidak ditemukan
            </h1>

            <p className="mt-1 text-sm text-[#84918C]">
              Data Purchase Order yang diminta tidak tersedia.
            </p>

            <Link
              href="/purchase"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#3D6D60]"
            >
              <ArrowLeft size={15} />
              Kembali ke Purchase
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* =====================================================
     LOCKED
  ===================================================== */

  if (purchase.status !== "DRAFT") {
    return (
      <div className="min-h-screen bg-[#F3F6F4] px-5 py-8 md:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="overflow-hidden rounded-2xl border border-[#E6D5D5] bg-white shadow-[0_4px_20px_rgba(31,59,50,0.04)]">
            <div className="border-b border-[#F0E2E2] bg-[#FFF9F9] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FDECEC] text-[#C85C5C]">
                  <LockKeyhole size={19} />
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#B06A6A]">
                    Editing Locked
                  </div>

                  <h1 className="mt-0.5 text-lg font-bold text-[#6B3030]">
                    Purchase Order tidak dapat diedit
                  </h1>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm leading-6 text-[#725454]">
                Purchase Order{" "}
                <strong className="font-semibold text-[#5E3535]">
                  {purchase.number}
                </strong>{" "}
                sudah berstatus{" "}
                <span className="rounded-md bg-[#F8EEEE] px-2 py-1 text-xs font-bold text-[#A54F4F]">
                  {purchase.status}
                </span>
                .
              </p>

              <div className="mt-6">
                <Link
                  href={`/purchase/${id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-5 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#3D6D60]"
                >
                  <ArrowLeft size={15} />
                  Kembali ke Detail
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =====================================================
     UI
  ===================================================== */

  return (
    <div className="min-h-screen bg-[#F3F6F4] text-[#18352D]">

      <header className="sticky top-0 z-50 border-b border-[#DDE7E2] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 py-4 lg:px-8">
          <div className="flex items-center justify-between gap-4">

            <div className="flex min-w-0 items-center gap-3">
              <Link
                href={`/purchase/${id}`}
                className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D6E2DD] bg-white text-[#667770] shadow-sm transition-all hover:border-[#BFD1C9] hover:bg-[#F4F8F6] hover:text-[#497F70]"
                title="Kembali"
              >
                <ArrowLeft
                  size={17}
                  className="transition-transform group-hover:-translate-x-0.5"
                />
              </Link>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="hidden text-[10px] font-bold uppercase tracking-[0.14em] text-[#497F70] sm:inline">
                    Procurement
                  </span>

                  <span className="hidden text-[#C6CFCC] sm:inline">
                    /
                  </span>

                  <span className="truncate text-[10px] font-medium text-[#8D9A95] sm:text-xs">
                    Edit Purchase Order
                  </span>
                </div>

                <div className="mt-0.5 flex items-center gap-2">
                  <h1 className="truncate text-lg font-bold tracking-tight text-[#18352D] sm:text-xl">
                    {purchase.number}
                  </h1>

                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EAF3EE] px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-[#497F70]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />
                    Draft
                  </span>
                </div>
              </div>
            </div>

            <Link
              href={`/purchase/${id}`}
              className="hidden items-center gap-2 rounded-xl border border-[#D6E2DD] bg-white px-4 py-2.5 text-xs font-bold text-[#667770] shadow-sm transition hover:border-[#C3D2CB] hover:bg-[#F6F9F7] md:inline-flex"
            >
              Batal
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 pb-28 lg:px-8">

        <form onSubmit={handleSubmit}>

          <div className="space-y-5">

            {/* =================================================
                INFORMATION CARD
            ================================================= */}

            <section className="overflow-visible rounded-2xl border border-[#DDE7E2] bg-white shadow-[0_4px_22px_rgba(31,59,50,0.045)]">

              <div className="flex items-center justify-between border-b border-[#E8EEEB] px-5 py-4 lg:px-6">

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EE] text-[#497F70]">
                    <ClipboardList size={18} />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-[#18352D]">
                      Informasi Purchase Order
                    </h2>

                    <p className="mt-0.5 text-[11px] text-[#899690]">
                      Informasi utama dokumen pembelian.
                    </p>
                  </div>
                </div>

                <div className="hidden items-center gap-2 rounded-lg bg-[#F7F9F8] px-3 py-1.5 sm:flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />

                  <span className="text-[10px] font-semibold text-[#718079]">
                    Status DRAFT
                  </span>
                </div>

              </div>

              <div className="p-5 lg:p-6">

                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">

                  {/* NO PO */}

                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#687871]">
                      Nomor PO
                    </label>

                    <div className="relative">
                      <Hash
                        size={15}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA7A2]"
                      />

                      <input
                        value={
                          purchase.number ||
                          ""
                        }
                        disabled
                        className="h-11 w-full rounded-xl border border-[#E0E7E4] bg-[#F5F7F6] pl-10 pr-3 text-sm font-semibold text-[#7A8782] outline-none"
                      />
                    </div>
                  </div>

                  {/* SUPPLIER - SEARCHABLE */}

                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#687871]">
                      Supplier
                      <span className="text-red-500">
                        *
                      </span>
                    </label>

                    <SupplierSearch
                      value={supplierId}
                      suppliers={suppliers}
                      onChange={setSupplierId}
                    />
                  </div>

                  {/* PAYMENT */}

                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#687871]">
                      Metode Pembayaran
                      <span className="text-red-500">
                        *
                      </span>
                    </label>

                    <div className="relative">
                      <CreditCard
                        size={15}
                        className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[#9AA7A2]"
                      />

                      <select
                        value={paymentMethod}
                        onChange={(e) =>
                          setPaymentMethod(
                            e.target.value
                          )
                        }
                        required
                        className="h-11 w-full appearance-none rounded-xl border border-[#D6E2DD] bg-[#FCFDFC] pl-10 pr-10 text-sm font-medium text-[#354840] outline-none transition-all hover:border-[#C4D4CD] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                      >
                        <option value="">
                          Pilih Metode Pembayaran
                        </option>

                        {PAYMENT_METHODS.map(
                          (method) => (
                            <option
                              key={
                                method.value
                              }
                              value={
                                method.value
                              }
                            >
                              {method.label}
                            </option>
                          )
                        )}
                      </select>

                      <ChevronDown
                        size={15}
                        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#899791]"
                      />
                    </div>
                  </div>

                  {/* STATUS */}

                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#687871]">
                      Status Dokumen
                    </label>

                    <div className="flex h-11 items-center gap-2 rounded-xl border border-[#DDE8E2] bg-[#F7FAF8] px-3.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E6F1EB] text-[#497F70]">
                        <Check size={14} />
                      </span>

                      <div>
                        <div className="text-xs font-bold text-[#3D6256]">
                          DRAFT
                        </div>

                        <div className="text-[9px] text-[#8B9893]">
                          Dapat diedit
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KETERANGAN */}

                  <div className="lg:col-span-4">
                    <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#687871]">
                      Keterangan
                      <span className="font-normal normal-case tracking-normal text-[#A0AAA6]">
                        Opsional
                      </span>
                    </label>

                    <div className="relative">
                      <FileText
                        size={15}
                        className="pointer-events-none absolute left-3.5 top-3.5 text-[#9AA7A2]"
                      />

                      <textarea
                        value={remarks}
                        onChange={(e) =>
                          setRemarks(
                            e.target.value
                          )
                        }
                        rows={3}
                        placeholder="Tambahkan keterangan atau catatan Purchase Order..."
                        className="w-full resize-none rounded-xl border border-[#D6E2DD] bg-[#FCFDFC] px-10 py-3 text-sm text-[#354840] outline-none transition-all placeholder:text-[#A3ADA9] hover:border-[#C4D4CD] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                      />
                    </div>
                  </div>

                </div>

              </div>
            </section>

            {/* =================================================
                DETAIL CARD
            ================================================= */}

            <section className="overflow-visible rounded-2xl border border-[#DDE7E2] bg-white shadow-[0_4px_22px_rgba(31,59,50,0.045)]">

              <div className="flex flex-col gap-3 border-b border-[#E8EEEB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EE] text-[#497F70]">
                    <Package size={18} />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-[#18352D]">
                      Detail Barang
                    </h2>

                    <p className="mt-0.5 text-[11px] text-[#899690]">
                      Ubah barang, kuantitas, dan harga pembelian.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">

                  <div className="rounded-lg border border-[#E2EAE6] bg-[#F8FAF9] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#718079]">
                    {items.length}{" "}
                    {items.length === 1
                      ? "Item"
                      : "Items"}
                  </div>

                  <button
                    type="button"
                    onClick={addItem}
                    className="group inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-xs font-bold text-white shadow-[0_5px_14px_rgba(73,127,112,0.18)] transition-all hover:bg-[#3D6D60] hover:shadow-[0_7px_18px_rgba(73,127,112,0.24)]"
                  >
                    <Plus
                      size={15}
                      className="transition-transform group-hover:rotate-90"
                    />
                    Tambah Barang
                  </button>

                </div>

              </div>

              <div className="p-5 lg:p-6">

                <div className="overflow-x-auto rounded-2xl border border-[#E1E9E5]">

                  <table className="min-w-[980px] w-full text-sm">

                    <thead className="bg-[#F7F9F8]">
                      <tr className="border-b border-[#E2EAE6]">

                        <th className="w-14 px-4 py-3.5 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[#899690]">
                          No
                        </th>

                        <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-[#899690]">
                          Barang
                        </th>

                        <th className="w-36 px-4 py-3.5 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[#899690]">
                          Qty
                        </th>

                        <th className="w-48 px-4 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-[#899690]">
                          Harga Satuan
                        </th>

                        <th className="w-48 px-4 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-[#899690]">
                          Subtotal
                        </th>

                        <th className="w-20 px-4 py-3.5 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[#899690]">
                          Aksi
                        </th>

                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#EDF1EF]">

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

                          const selectedBarang =
                            item.barang ||
                            barangs.find(
                              (barang) =>
                                barang.id ===
                                item.barangId
                            );

                          return (
                            <tr
                              key={
                                item.id ??
                                `new-${index}`
                              }
                              className="group bg-white transition-colors hover:bg-[#FCFDFC]"
                            >

                              <td className="px-4 py-5 text-center">
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#F3F6F4] text-[11px] font-bold text-[#7F8D87]">
                                  {index + 1}
                                </span>
                              </td>

                              <td className="px-4 py-5">
                                <BarangSearch
                                  value={
                                    item.barangId
                                  }
                                  barangs={
                                    barangs
                                  }
                                  selectedBarang={
                                    selectedBarang
                                  }
                                  onChange={(
                                    barangId
                                  ) =>
                                    updateItem(
                                      index,
                                      "barangId",
                                      barangId
                                    )
                                  }
                                />
                              </td>

                              <td className="px-4 py-5">
                                <DecimalInput
                                  value={Number(
                                    item.qty ||
                                      0
                                  )}
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
                                  className="h-11 w-full rounded-xl border border-[#D6E2DD] bg-[#FCFDFC] px-3 text-center text-sm font-bold tabular-nums text-[#354840] outline-none transition-all hover:border-[#C4D4CD] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                                />
                              </td>

                              <td className="px-4 py-5">
                                <div className="relative">
                                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#9AA7A2]">
                                    Rp
                                  </span>

                                  <DecimalInput
                                    value={Number(
                                      item.price ||
                                        0
                                    )}
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
                                    className="h-11 w-full rounded-xl border border-[#D6E2DD] bg-[#FCFDFC] pl-9 pr-3 text-right text-sm font-bold tabular-nums text-[#354840] outline-none transition-all hover:border-[#C4D4CD] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                                  />
                                </div>
                              </td>

                              <td className="px-4 py-5 text-right">
                                <div className="font-bold tabular-nums text-[#18352D]">
                                  {formatRupiah(
                                    subtotal
                                  )}
                                </div>

                                <div className="mt-1 text-[9px] text-[#9AA7A2]">
                                  {formatNumber(
                                    item.qty
                                  )}{" "}
                                  ×{" "}
                                  {formatRupiah(
                                    item.price
                                  )}
                                </div>
                              </td>

                              <td className="px-4 py-5 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeItem(
                                      index
                                    )
                                  }
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#F0DADA] bg-[#FFF9F9] text-[#C65D5D] transition-all hover:border-[#E7BABA] hover:bg-[#FFF1F1]"
                                  title="Hapus barang"
                                >
                                  <Trash2
                                    size={15}
                                  />
                                </button>
                              </td>

                            </tr>
                          );
                        }
                      )}

                    </tbody>
                  </table>
                </div>

                {items.length === 0 && (
                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#EAD9A8] bg-[#FFFCF2] px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF3C8] text-[#B88924]">
                      <AlertTriangle size={15} />
                    </div>

                    <div>
                      <p className="text-xs font-bold text-[#80621F]">
                        Belum ada barang
                      </p>

                      <p className="mt-0.5 text-[10px] text-[#9A8655]">
                        Tambahkan minimal satu barang ke Purchase Order.
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-5 flex flex-col gap-4 border-t border-[#E8EEEB] pt-5 sm:flex-row sm:items-center sm:justify-between">

                  <div className="hidden sm:block">
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#929F9A]">
                      Ringkasan Pembelian
                    </div>

                    <div className="mt-1 text-xs text-[#718079]">
                      {items.length}{" "}
                      {items.length === 1
                        ? "item"
                        : "items"}{" "}
                      dalam Purchase Order
                    </div>
                  </div>

                  <div className="flex min-w-[340px] items-center justify-between gap-8 rounded-2xl border border-[#DCE8E2] bg-[#F7FAF8] px-5 py-4">

                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8B9993]">
                        Total Purchase
                      </div>

                      <div className="mt-1 text-[11px] text-[#75837D]">
                        Nilai keseluruhan PO
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9AA7A2]">
                        Grand Total
                      </div>

                      <div className="mt-0.5 text-xl font-extrabold tracking-tight text-[#18352D]">
                        {formatRupiah(
                          total
                        )}
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            </section>

          </div>

        </form>

      </main>

      {/* =================================================
          STICKY ACTION BAR
      ================================================= */}

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#DDE7E2] bg-white/95 shadow-[0_-8px_30px_rgba(31,59,50,0.08)] backdrop-blur-xl">

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 lg:px-8">

          <div className="hidden min-w-0 sm:block">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#497F70] shadow-[0_0_0_3px_rgba(73,127,112,0.12)]" />

              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B9993]">
                Siap disimpan
              </span>

              <span className="text-xs font-semibold text-[#4A5D55]">
                {items.length}{" "}
                {items.length === 1
                  ? "item"
                  : "items"}
              </span>
            </div>
          </div>

          <div className="flex w-full gap-2 sm:w-auto">

            <Link
              href={`/purchase/${id}`}
              className="flex flex-1 items-center justify-center rounded-xl border border-[#D6E2DD] bg-white px-5 py-2.5 text-xs font-bold text-[#697871] transition-all hover:border-[#C3D2CB] hover:bg-[#F5F8F6] sm:flex-none"
            >
              Batal
            </Link>

            <button
              type="button"
              onClick={() => {
                const form =
                  document.querySelector(
                    "form"
                  ) as HTMLFormElement | null;

                form?.requestSubmit();
              }}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#497F70] px-6 py-2.5 text-xs font-bold text-white shadow-[0_5px_14px_rgba(73,127,112,0.22)] transition-all hover:bg-[#3D6D60] hover:shadow-[0_7px_18px_rgba(73,127,112,0.28)] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {saving ? (
                <>
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Check size={15} />
                  Simpan Perubahan
                </>
              )}
            </button>

          </div>

        </div>
      </div>

    </div>
  );
}