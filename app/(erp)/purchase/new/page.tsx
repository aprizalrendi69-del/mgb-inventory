"use client";

import { createPortal } from "react-dom";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CreditCard,
  FileText,
  History,
  Info,
  Loader2,
  Package,
  Plus,
  Search,
  ShieldAlert,
  ShoppingCart,
  Trash2,
  UserRound,
  X,
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

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
};

export default function NewPurchasePage() {
  const router = useRouter();

  const [supplier, setSupplier] = useState<Supplier[]>([]);
  const [barang, setBarang] = useState<Barang[]>([]);

  const [loadingSupplier, setLoadingSupplier] =
    useState(true);

  const [loadingBarang, setLoadingBarang] =
    useState(true);

  const [priceWarning, setPriceWarning] = useState<
    Record<number, PriceWarning>
  >({});

  const [supplierSearch, setSupplierSearch] =
    useState("");

  const [supplierOpen, setSupplierOpen] =
    useState(false);

  const [barangSearch, setBarangSearch] = useState<
    Record<number, string>
  >({});

  const [barangOpen, setBarangOpen] = useState<
    Record<number, boolean>
  >({});

  const [activeBarangDropdown, setActiveBarangDropdown] =
    useState<number | null>(null);

  const [barangDropdownPosition, setBarangDropdownPosition] =
    useState<DropdownPosition | null>(null);

  const [saving, setSaving] = useState(false);

  const lastPriceRequestRef = useRef<
    Record<number, number>
  >({});

  const priceCheckRequestRef = useRef<
    Record<number, number>
  >({});

  const supplierRef = useRef<HTMLDivElement | null>(null);

  const formItemsRef = useRef<PurchaseItem[]>([]);

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
    formItemsRef.current = form.items;
  }, [form.items]);

  /* =========================================================
     LOAD DATA
  ========================================================= */

  useEffect(() => {
    loadSupplier();
    loadBarang();
  }, []);

  async function loadSupplier() {
    try {
      setLoadingSupplier(true);

      const res = await fetch("/api/supplier", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setSupplier(json.data ?? []);
      } else {
        setSupplier([]);
      }
    } catch (error) {
      console.error("LOAD SUPPLIER ERROR:", error);
      setSupplier([]);
    } finally {
      setLoadingSupplier(false);
    }
  }

  async function loadBarang() {
    try {
      setLoadingBarang(true);

      const res = await fetch("/api/barang", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setBarang(json.data ?? []);
      } else {
        setBarang([]);
      }
    } catch (error) {
      console.error("LOAD BARANG ERROR:", error);
      setBarang([]);
    } finally {
      setLoadingBarang(false);
    }
  }

  /* =========================================================
     CLOSE SUPPLIER DROPDOWN
  ========================================================= */

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (
        supplierRef.current &&
        !supplierRef.current.contains(
          event.target as Node
        )
      ) {
        setSupplierOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleMouseDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleMouseDown
      );
    };
  }, []);

  /* =========================================================
     CLOSE BARANG DROPDOWN / POSITION
  ========================================================= */

  useEffect(() => {
    function handleScrollOrResize() {
      if (activeBarangDropdown === null) return;

      updateBarangDropdownPosition(
        activeBarangDropdown
      );
    }

    window.addEventListener(
      "scroll",
      handleScrollOrResize,
      true
    );

    window.addEventListener(
      "resize",
      handleScrollOrResize
    );

    return () => {
      window.removeEventListener(
        "scroll",
        handleScrollOrResize,
        true
      );

      window.removeEventListener(
        "resize",
        handleScrollOrResize
      );
    };
  }, [activeBarangDropdown]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      setSupplierOpen(false);

      if (activeBarangDropdown !== null) {
        closeBarangDropdown(activeBarangDropdown);
      }
    }

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [activeBarangDropdown]);

  /* =========================================================
     SUPPLIER
  ========================================================= */

  const filteredSupplier = useMemo(() => {
    const keyword = supplierSearch
      .trim()
      .toLowerCase();

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

  function selectedBarangName(barangId: string) {
    const selected = barang.find(
      (item) =>
        String(item.id) === String(barangId)
    );

    return selected?.name ?? "";
  }

  function getBarangElement(index: number) {
    return document.querySelector(
      `[data-barang-picker="${index}"]`
    ) as HTMLElement | null;
  }

  function updateBarangDropdownPosition(index: number) {
    const element = getBarangElement(index);

    if (!element) return;

    const rect = element.getBoundingClientRect();

    setBarangDropdownPosition({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  }

  function openBarangDropdown(index: number) {
    setBarangOpen((prev) => ({
      ...prev,
      [index]: true,
    }));

    setActiveBarangDropdown(index);

    requestAnimationFrame(() => {
      updateBarangDropdownPosition(index);
    });
  }

  function closeBarangDropdown(index: number) {
    setBarangOpen((prev) => ({
      ...prev,
      [index]: false,
    }));

    if (activeBarangDropdown === index) {
      setActiveBarangDropdown(null);
      setBarangDropdownPosition(null);
    }
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

    closeBarangDropdown(index);

    /*
     * Ambil harga pembelian terakhir.
     * Setelah harga terakhir ditemukan, harga otomatis
     * masuk ke input.
     */
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

    setForm((prev) => {
      const items = prev.items.filter(
        (_, itemIndex) =>
          itemIndex !== index
      );

      return {
        ...prev,
        items,
      };
    });

    setBarangSearch((prev) => {
      const next: Record<number, string> = {};

      Object.entries(prev).forEach(
        ([key, value]) => {
          const oldIndex = Number(key);

          if (oldIndex < index) {
            next[oldIndex] = value;
          }

          if (oldIndex > index) {
            next[oldIndex - 1] = value;
          }
        }
      );

      return next;
    });

    setBarangOpen((prev) => {
      const next: Record<number, boolean> = {};

      Object.entries(prev).forEach(
        ([key, value]) => {
          const oldIndex = Number(key);

          if (oldIndex < index) {
            next[oldIndex] = value;
          }

          if (oldIndex > index) {
            next[oldIndex - 1] = value;
          }
        }
      );

      return next;
    });

    setPriceWarning((prev) => {
      const next: Record<
        number,
        PriceWarning
      > = {};

      Object.entries(prev).forEach(
        ([key, value]) => {
          const oldIndex = Number(key);

          if (oldIndex < index) {
            next[oldIndex] = value;
          }

          if (oldIndex > index) {
            next[oldIndex - 1] = value;
          }
        }
      );

      return next;
    });

    delete lastPriceRequestRef.current[index];
    delete priceCheckRequestRef.current[index];

    if (activeBarangDropdown === index) {
      setActiveBarangDropdown(null);
      setBarangDropdownPosition(null);
    }
  }

  function updateItem(
    index: number,
    field: keyof PurchaseItem,
    value: string | number
  ) {
    setForm((prev) => {
      const items = [...prev.items];

      if (!items[index]) {
        return prev;
      }

      items[index] = {
        ...items[index],
        [field]: value,
      };

      return {
        ...prev,
        items,
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

    const requestId =
      Date.now() +
      Math.random();

    lastPriceRequestRef.current[index] =
      requestId;

    try {
      const res = await fetch(
        `/api/master-harga/latest/${barangId}`,
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        return;
      }

      const json = await res.json();

      if (
        lastPriceRequestRef.current[index] !==
        requestId
      ) {
        return;
      }

      if (
        !json.success ||
        !json.data
      ) {
        return;
      }

      const data = json.data;

      /*
       * Support beberapa kemungkinan nama
       * field dari endpoint harga terakhir.
       */
      const lastPrice = Number(
        data.hargaTerakhir ??
          data.lastPrice ??
          data.lastPurchasePrice ??
          data.purchasePrice ??
          data.harga ??
          data.price ??
          0
      );

      setForm((prev) => {
        const current = prev.items[index];

        if (
          !current ||
          String(current.barangId) !==
            String(barangId)
        ) {
          return prev;
        }

        const items = [...prev.items];

        items[index] = {
          ...current,
          price:
            Number.isFinite(lastPrice)
              ? lastPrice
              : 0,
        };

        return {
          ...prev,
          items,
        };
      });

      /*
       * Harga terakhir adalah harga referensi,
       * jadi warning tidak ditampilkan sampai
       * user mengubah harga menjadi berbeda.
       */
      setPriceWarning((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
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
      !harga ||
      harga <= 0
    ) {
      setPriceWarning((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });

      return;
    }

    const requestId =
      Date.now() +
      Math.random();

    priceCheckRequestRef.current[index] =
      requestId;

    try {
      const res = await fetch(
        `/api/master-harga/check/${barangId}/${harga}`,
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        return;
      }

      const json = await res.json();

      if (
        priceCheckRequestRef.current[index] !==
        requestId
      ) {
        return;
      }

      if (
        json.success &&
        json.data
      ) {
        const warning =
          json.data as PriceWarning;

        const hargaLama = Number(
          warning.hargaLama ?? 0
        );

        const hargaBaru = Number(
          warning.hargaBaru ??
            harga
        );

        if (
          hargaLama > 0 &&
          Math.abs(
            hargaBaru -
              hargaLama
          ) > 0.01
        ) {
          setPriceWarning((prev) => ({
            ...prev,
            [index]: {
              ...warning,
              hargaLama,
              hargaBaru,
              persen: Number(
                warning.persen ?? 0
              ),
            },
          }));
        } else {
          setPriceWarning((prev) => {
            const next = { ...prev };
            delete next[index];
            return next;
          });
        }
      } else {
        setPriceWarning((prev) => {
          const next = { ...prev };
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
     PRICE HELPERS
  ========================================================= */

  function getPriceDirection(
    index: number
  ) {
    const warning =
      priceWarning[index];

    if (!warning) {
      return null;
    }

    return Number(
      warning.hargaBaru
    ) >
      Number(
        warning.hargaLama
      )
      ? "up"
      : "down";
  }

  const changedPriceCount =
    useMemo(() => {
      return Object.keys(
        priceWarning
      ).length;
    }, [priceWarning]);

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

  const totalQty = useMemo(() => {
    return form.items.reduce(
      (total, item) =>
        total +
        Number(item.qty || 0),
      0
    );
  }, [form.items]);

  function formatRupiah(
    value: number
  ) {
    return Number(
      value || 0
    ).toLocaleString(
      "id-ID"
    );
  }

  /* =========================================================
     BARANG DROPDOWN PORTAL
  ========================================================= */

  function renderBarangDropdown() {
    if (
      activeBarangDropdown ===
        null ||
      !barangOpen[
        activeBarangDropdown
      ] ||
      !barangDropdownPosition
    ) {
      return null;
    }

    const index =
      activeBarangDropdown;

    const filtered =
      getFilteredBarang(index);

    return createPortal(
      <div
        className="fixed z-[9998] overflow-hidden rounded-2xl border border-[#D5E1DC] bg-white shadow-[0_24px_60px_rgba(25,50,42,0.22)]"
        style={{
          top:
            barangDropdownPosition.top,
          left:
            barangDropdownPosition.left,
          width:
            barangDropdownPosition.width,
        }}
      >
        <div className="flex items-center justify-between border-b border-[#EDF1EF] bg-[#FAFCFB] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
              <Package size={13} />
            </div>

            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8B9994]">
              Pilih Barang
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              closeBarangDropdown(
                index
              )
            }
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#A1ADA8] transition hover:bg-[#EEF4F1] hover:text-[#497F70]"
          >
            <X size={13} />
          </button>
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-9 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F5F3] text-[#9AA8A3]">
                <Search size={16} />
              </div>

              <p className="mt-2 text-xs font-semibold text-[#7C8B85]">
                Barang tidak ditemukan.
              </p>

              <p className="mt-1 text-[9px] text-[#A0AAA6]">
                Coba gunakan nama, kode atau
                barcode.
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() =>
                  selectBarang(
                    index,
                    item
                  )
                }
                className="group flex w-full items-center gap-3 border-b border-[#F0F3F2] px-4 py-3 text-left transition last:border-0 hover:bg-[#F5F9F7]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF2EE] text-[#497F70] transition group-hover:bg-[#DCEEE6]">
                  <Package size={15} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-[#30443D]">
                    {item.name}
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] font-medium text-[#9AA7A2]">
                    {item.code && (
                      <span>
                        Kode:{" "}
                        {item.code}
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
                        Unit:{" "}
                        {item.unit}
                      </span>
                    )}
                  </div>
                </div>

                {String(item.id) ===
                  form.items[
                    index
                  ]?.barangId && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E5F2EC] text-[#497F70]">
                    <Check size={14} />
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>,
      document.body
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

    if (!form.items.length) {
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
    <div className="min-h-screen bg-[#F3F7F5] text-[#18352D]">
      {/* =====================================================
          TOP HEADER
      ===================================================== */}

      <header className="sticky top-0 z-50 border-b border-[#DCE7E2] bg-white/90 shadow-[0_4px_20px_rgba(24,53,45,0.035)] backdrop-blur-2xl">
        <div className="mx-auto max-w-[1500px] px-5 py-4 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/purchase"
                  )
                }
                className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D8E3DE] bg-white text-[#60746D] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#9FC1B4] hover:bg-[#F3F8F5] hover:text-[#497F70] hover:shadow-md"
                title="Kembali"
              >
                <ArrowLeft
                  size={17}
                  className="transition-transform duration-200 group-hover:-translate-x-0.5"
                />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-lg font-extrabold tracking-tight text-[#17372E] sm:text-xl">
                    Purchase Order Baru
                  </h1>

                  <span className="hidden rounded-full border border-[#CFE2D9] bg-[#EDF6F1] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#497F70] sm:inline-flex">
                    Draft
                  </span>
                </div>

                <p className="mt-0.5 hidden text-xs font-medium text-[#82918C] sm:block">
                  Buat dan kelola pembelian
                  barang dari supplier.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden rounded-xl border border-[#E0E8E4] bg-[#F8FAF9] px-4 py-2.5 shadow-sm sm:block">
                <div className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#9AA8A3]">
                  Total PO
                </div>

                <div className="mt-0.5 text-sm font-extrabold tracking-tight text-[#18352D]">
                  Rp{" "}
                  {formatRupiah(
                    grandTotal
                  )}
                </div>
              </div>

              <span className="flex items-center gap-1.5 rounded-xl border border-[#D9E8E1] bg-[#F0F7F3] px-3 py-2 text-[9px] font-extrabold tracking-wider text-[#497F70] sm:hidden">
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
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
          {/* LEFT */}

          <div className="space-y-5">
            {/* INFORMASI PO */}

            <section className="overflow-visible rounded-[24px] border border-[#DDE7E2] bg-white shadow-[0_8px_35px_rgba(30,60,50,0.045)]">
              <div className="border-b border-[#E8EEEB] px-5 py-4 lg:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D8E9E1] bg-gradient-to-br from-[#EDF7F2] to-[#E6F1EC] text-[#497F70] shadow-sm">
                    <FileText size={18} />
                  </div>

                  <div>
                    <h2 className="text-sm font-extrabold text-[#18352D]">
                      Informasi Purchase
                      Order
                    </h2>

                    <p className="mt-0.5 text-xs font-medium text-[#8A9893]">
                      Tentukan supplier,
                      tanggal dan metode
                      pembayaran.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 lg:p-6">
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                  {/* SUPPLIER */}

                  <div
                    ref={supplierRef}
                    className="relative lg:col-span-2"
                  >
                    <label className="mb-2 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#687A73]">
                      <UserRound size={12} />
                      Supplier
                      <span className="text-red-500">
                        *
                      </span>
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
                          setSupplierOpen(
                            true
                          );

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
                        className="h-[46px] w-full rounded-xl border border-[#D6E2DD] bg-[#FBFCFC] px-3.5 pr-10 text-sm font-medium text-[#30443D] outline-none transition-all placeholder:text-[#A7B2AE] hover:border-[#BFCFC8] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
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
                      <div className="absolute left-0 right-0 top-[78px] z-[200] overflow-hidden rounded-2xl border border-[#D5E1DC] bg-white shadow-[0_20px_50px_rgba(25,50,42,0.16)]">
                        <div className="flex items-center justify-between border-b border-[#EDF1EF] bg-[#FAFCFB] px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                              <UserRound size={13} />
                            </div>

                            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8B9994]">
                              Pilih Supplier
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setSupplierOpen(
                                false
                              )
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#A1ADA8] transition hover:bg-[#EEF4F1] hover:text-[#497F70]"
                          >
                            <X size={13} />
                          </button>
                        </div>

                        <div className="max-h-64 overflow-y-auto">
                          {filteredSupplier.length ===
                          0 ? (
                            <div className="px-4 py-9 text-center">
                              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F5F3] text-[#9AA8A3]">
                                <Search size={16} />
                              </div>

                              <p className="mt-2 text-xs font-semibold text-[#7C8B85]">
                                Supplier tidak
                                ditemukan.
                              </p>
                            </div>
                          ) : (
                            filteredSupplier.map(
                              (item) => (
                                <button
                                  key={
                                    item.id
                                  }
                                  type="button"
                                  onClick={() =>
                                    selectSupplier(
                                      item
                                    )
                                  }
                                  className="group flex w-full items-center gap-3 border-b border-[#F0F3F2] px-4 py-3 text-left transition last:border-0 hover:bg-[#F5F9F7]"
                                >
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF2EE] text-[#497F70] transition group-hover:bg-[#DCEEE6]">
                                    <UserRound size={14} />
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-bold text-[#30443D]">
                                      {
                                        item.name
                                      }
                                    </div>

                                    <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-[#A0AAA6]">
                                      Supplier
                                    </div>
                                  </div>

                                  {String(
                                    item.id
                                  ) ===
                                    form.supplierId && (
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E5F2EC] text-[#497F70]">
                                      <Check size={14} />
                                    </div>
                                  )}
                                </button>
                              )
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* TANGGAL */}

                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#687A73]">
                      <CalendarDays size={12} />
                      Tanggal PO
                      <span className="text-red-500">
                        *
                      </span>
                    </label>

                    <input
                      type="date"
                      value={
                        form.purchaseDate
                      }
                      onChange={(e) =>
                        setForm(
                          (prev) => ({
                            ...prev,
                            purchaseDate:
                              e.target.value,
                          })
                        )
                      }
                      className="h-[46px] w-full rounded-xl border border-[#D6E2DD] bg-[#FBFCFC] px-3.5 text-sm font-medium text-[#30443D] outline-none transition-all hover:border-[#BFCFC8] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                    />
                  </div>

                  {/* PAYMENT */}

                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#687A73]">
                      <CreditCard size={12} />
                      Metode Pembayaran
                    </label>

                    <div className="relative">
                      <select
                        value={
                          form.paymentMethod
                        }
                        onChange={(e) =>
                          setForm(
                            (prev) => ({
                              ...prev,
                              paymentMethod:
                                e.target
                                  .value as PaymentMethod,
                            })
                          )
                        }
                        className="h-[46px] w-full appearance-none rounded-xl border border-[#D6E2DD] bg-[#FBFCFC] px-3.5 pr-9 text-sm font-semibold text-[#30443D] outline-none transition-all hover:border-[#BFCFC8] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
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

                      <ChevronDown
                        size={15}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A9893]"
                      />
                    </div>
                  </div>

                  {/* KETERANGAN */}

                  <div className="lg:col-span-4">
                    <label className="mb-2 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#687A73]">
                      <FileText size={12} />
                      Keterangan
                    </label>

                    <textarea
                      rows={3}
                      value={
                        form.description
                      }
                      onChange={(e) =>
                        setForm(
                          (prev) => ({
                            ...prev,
                            description:
                              e.target
                                .value,
                          })
                        )
                      }
                      placeholder="Tambahkan keterangan atau catatan untuk Purchase Order..."
                      className="w-full resize-none rounded-xl border border-[#D6E2DD] bg-[#FBFCFC] px-3.5 py-3 text-sm font-medium text-[#30443D] outline-none transition-all placeholder:text-[#A7B2AE] hover:border-[#BFCFC8] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* DETAIL BARANG */}

            <section className="overflow-visible rounded-[24px] border border-[#DDE7E2] bg-white shadow-[0_8px_35px_rgba(30,60,50,0.045)]">
              <div className="border-b border-[#E8EEEB] px-5 py-4 lg:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D8E9E1] bg-gradient-to-br from-[#EDF7F2] to-[#E6F1EC] text-[#497F70] shadow-sm">
                      <Package size={18} />
                    </div>

                    <div>
                      <h2 className="text-sm font-extrabold text-[#18352D]">
                        Detail Barang
                      </h2>

                      <p className="mt-0.5 text-xs font-medium text-[#8A9893]">
                        Tambahkan seluruh
                        barang yang akan
                        dibeli.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-[#E1E9E5] bg-[#F8FAF9] px-3 py-2 text-[10px] font-bold text-[#70807A]">
                      {form.items.length}{" "}
                      {form.items.length ===
                      1
                        ? "ITEM"
                        : "ITEMS"}
                    </span>

                    <span className="rounded-lg border border-[#E1E9E5] bg-[#F8FAF9] px-3 py-2 text-[10px] font-bold text-[#70807A]">
                      QTY {totalQty}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5 lg:p-6">
                <div className="overflow-x-auto">
                  <div className="min-w-[850px]">
                    <div className="grid grid-cols-[minmax(330px,1fr)_110px_190px_60px] gap-4 border-b border-[#E8EEEB] px-1 pb-3">
                      <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#98A49F]">
                        Barang
                      </div>

                      <div className="text-center text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#98A49F]">
                        Qty
                      </div>

                      <div className="text-right text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#98A49F]">
                        Harga Satuan
                      </div>

                      <div />
                    </div>

                    <div>
                      {form.items.map(
                        (
                          row,
                          index
                        ) => {
                          const subtotal =
                            Number(
                              row.qty ||
                                0
                            ) *
                            Number(
                              row.price ||
                                0
                            );

                          const warning =
                            priceWarning[
                              index
                            ];

                          const direction =
                            getPriceDirection(
                              index
                            );

                          return (
                            <div
                              key={
                                `${row.barangId}-${index}`
                              }
                              className={`group border-b py-5 last:border-b-0 ${
                                warning
                                  ? "border-[#F1E6C7]"
                                  : "border-[#EEF2F0]"
                              }`}
                            >
                              <div className="grid grid-cols-[minmax(330px,1fr)_110px_190px_60px] items-start gap-4">
                                {/* BARANG */}

                                <div className="relative">
                                  <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-[9px] font-extrabold tracking-[0.12em] text-[#A0AAA6]">
                                      ITEM{" "}
                                      {String(
                                        index +
                                          1
                                      ).padStart(
                                        2,
                                        "0"
                                      )}
                                    </span>

                                    {row.barangId && (
                                      <span className="flex items-center gap-1 rounded-full bg-[#EEF7F3] px-2 py-1 text-[9px] font-bold text-[#497F70]">
                                        <Check
                                          size={
                                            10
                                          }
                                        />
                                        Dipilih
                                      </span>
                                    )}
                                  </div>

                                  <div
                                    data-barang-picker={
                                      index
                                    }
                                    className="relative"
                                  >
                                    <input
                                      type="text"
                                      value={
                                        barangOpen[
                                          index
                                        ]
                                          ? barangSearch[
                                              index
                                            ] ??
                                            ""
                                          : selectedBarangName(
                                              row.barangId
                                            )
                                      }
                                      placeholder="Cari nama, kode, barcode..."
                                      onFocus={() => {
                                        setBarangSearch(
                                          (
                                            prev
                                          ) => ({
                                            ...prev,
                                            [index]:
                                              selectedBarangName(
                                                row.barangId
                                              ),
                                          })
                                        );

                                        openBarangDropdown(
                                          index
                                        );
                                      }}
                                      onChange={(
                                        e
                                      ) => {
                                        setBarangSearch(
                                          (
                                            prev
                                          ) => ({
                                            ...prev,
                                            [index]:
                                              e
                                                .target
                                                .value,
                                          })
                                        );

                                        setBarangOpen(
                                          (
                                            prev
                                          ) => ({
                                            ...prev,
                                            [index]:
                                              true,
                                          })
                                        );

                                        setActiveBarangDropdown(
                                          index
                                        );

                                        requestAnimationFrame(
                                          () =>
                                            updateBarangDropdownPosition(
                                              index
                                            )
                                        );
                                      }}
                                      className="h-[46px] w-full rounded-xl border border-[#D6E2DD] bg-[#FBFCFC] px-3.5 pr-10 text-sm font-medium text-[#30443D] outline-none transition-all placeholder:text-[#A7B2AE] hover:border-[#BFCFC8] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                                    />

                                    <Search
                                      size={15}
                                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9AA8A3]"
                                    />
                                  </div>
                                </div>

                                {/* QTY */}

                                <div>
                                  <div className="mb-1.5 text-center text-[9px] font-extrabold tracking-[0.12em] text-[#A0AAA6]">
                                    JUMLAH
                                  </div>

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
                                          e
                                            .target
                                            .value
                                        )
                                      )
                                    }
                                    className="h-[46px] w-full rounded-xl border border-[#D6E2DD] bg-[#FBFCFC] px-2 text-center text-sm font-bold text-[#30443D] outline-none transition-all hover:border-[#BFCFC8] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                                  />
                                </div>

                                {/* HARGA */}

                                <div>
                                  <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-[9px] font-extrabold tracking-[0.12em] text-[#A0AAA6]">
                                      HARGA SATUAN
                                    </span>

                                    {warning && (
                                      <span
                                        className={`flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-extrabold uppercase tracking-wide ${
                                          direction ===
                                          "up"
                                            ? "bg-[#FFF4E5] text-[#B46B14]"
                                            : "bg-[#EEF7F3] text-[#497F70]"
                                        }`}
                                      >
                                        {direction ===
                                        "up" ? (
                                          <ArrowUpRight
                                            size={
                                              10
                                            }
                                          />
                                        ) : (
                                          <ArrowDownRight
                                            size={
                                              10
                                            }
                                          />
                                        )}

                                        {direction ===
                                        "up"
                                          ? "Harga Naik"
                                          : "Harga Turun"}
                                      </span>
                                    )}
                                  </div>

                                  <div
                                    className={`relative rounded-xl ${
                                      warning
                                        ? "ring-2 ring-[#D7A84B]/20"
                                        : ""
                                    }`}
                                  >
                                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#9AA8A3]">
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
                                            e
                                              .target
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
                                      className={`h-[46px] w-full rounded-xl border bg-[#FBFCFC] pl-9 pr-3 text-right text-sm font-bold outline-none transition-all focus:bg-white focus:ring-4 ${
                                        warning
                                          ? "border-[#DDB86A] text-[#76571D] focus:border-[#C8953D] focus:ring-[#D7A84B]/10"
                                          : "border-[#D6E2DD] text-[#30443D] hover:border-[#BFCFC8] focus:border-[#497F70] focus:ring-[#497F70]/10"
                                      }`}
                                    />
                                  </div>

                                  <div className="mt-1.5 flex items-center justify-between">
                                    <span className="text-[10px] font-medium text-[#A0AAA6]">
                                      Subtotal
                                    </span>

                                    <span className="text-[11px] font-extrabold text-[#52665E]">
                                      Rp{" "}
                                      {formatRupiah(
                                        subtotal
                                      )}
                                    </span>
                                  </div>
                                </div>

                                {/* HAPUS */}

                                <div className="pt-[23px]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeItem(
                                        index
                                      )
                                    }
                                    className="flex h-[46px] w-full items-center justify-center rounded-xl border border-[#F0D7D7] bg-[#FFF8F8] text-[#C56B6B] transition-all hover:border-[#E7BABA] hover:bg-[#FFF0F0] hover:text-[#B94F4F]"
                                    title="Hapus barang"
                                  >
                                    <Trash2
                                      size={
                                        15
                                      }
                                    />
                                  </button>
                                </div>
                              </div>

                              {/* PREMIUM PRICE WARNING */}

                              {warning && (
                                <div
                                  className={`relative mt-4 overflow-hidden rounded-2xl border ${
                                    direction ===
                                    "up"
                                      ? "border-[#EED8A8] bg-gradient-to-r from-[#FFFCF5] via-[#FFF9EC] to-[#FFFDF8]"
                                      : "border-[#CFE3DA] bg-gradient-to-r from-[#F6FBF8] via-[#F0F8F4] to-[#FAFCFB]"
                                  }`}
                                >
                                  <div
                                    className={`absolute left-0 top-0 h-full w-1 ${
                                      direction ===
                                      "up"
                                        ? "bg-[#D7A84B]"
                                        : "bg-[#497F70]"
                                    }`}
                                  />

                                  <div className="p-4 pl-5">
                                    <div className="flex items-start gap-3">
                                      <div
                                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${
                                          direction ===
                                          "up"
                                            ? "border border-[#F0DEB4] bg-[#FFF4D8] text-[#A9781E]"
                                            : "border border-[#D5E8DF] bg-[#E8F4EE] text-[#497F70]"
                                        }`}
                                      >
                                        {direction ===
                                        "up" ? (
                                          <ArrowUpRight
                                            size={
                                              18
                                            }
                                          />
                                        ) : (
                                          <ArrowDownRight
                                            size={
                                              18
                                            }
                                          />
                                        )}
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <h4
                                            className={`text-xs font-extrabold ${
                                              direction ===
                                              "up"
                                                ? "text-[#805D1A]"
                                                : "text-[#356A5A]"
                                            }`}
                                          >
                                            Perubahan
                                            Harga
                                            Terdeteksi
                                          </h4>

                                          <span
                                            className={`rounded-full px-2 py-1 text-[8px] font-extrabold uppercase tracking-wider ${
                                              direction ===
                                              "up"
                                                ? "bg-[#F9E8BE] text-[#916817]"
                                                : "bg-[#DCEEE6] text-[#39705F]"
                                            }`}
                                          >
                                            {direction ===
                                            "up"
                                              ? "Harga Naik"
                                              : "Harga Turun"}
                                          </span>
                                        </div>

                                        <p className="mt-1 text-[10px] font-medium leading-relaxed text-[#7F8984]">
                                          Harga yang
                                          dimasukkan
                                          berbeda
                                          dari
                                          referensi
                                          harga
                                          pembelian
                                          sebelumnya.
                                          Mohon
                                          review
                                          sebelum
                                          Purchase
                                          Order
                                          disimpan.
                                        </p>

                                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                          <div className="rounded-xl border border-black/[0.04] bg-white/70 px-3 py-2.5">
                                            <div className="flex items-center gap-1.5 text-[8px] font-extrabold uppercase tracking-wider text-[#A0AAA6]">
                                              <History
                                                size={
                                                  10
                                                }
                                              />
                                              Harga
                                              Sebelumnya
                                            </div>

                                            <div className="mt-1 text-xs font-extrabold text-[#455A52]">
                                              Rp{" "}
                                              {formatRupiah(
                                                Number(
                                                  warning.hargaLama
                                                )
                                              )}
                                            </div>
                                          </div>

                                          <div className="rounded-xl border border-black/[0.04] bg-white/70 px-3 py-2.5">
                                            <div className="flex items-center gap-1.5 text-[8px] font-extrabold uppercase tracking-wider text-[#A0AAA6]">
                                              <Info
                                                size={
                                                  10
                                                }
                                              />
                                              Harga
                                              Baru
                                            </div>

                                            <div
                                              className={`mt-1 text-xs font-extrabold ${
                                                direction ===
                                                "up"
                                                  ? "text-[#9B6A17]"
                                                  : "text-[#39705F]"
                                              }`}
                                            >
                                              Rp{" "}
                                              {formatRupiah(
                                                Number(
                                                  warning.hargaBaru
                                                )
                                              )}
                                            </div>
                                          </div>

                                          <div className="rounded-xl border border-black/[0.04] bg-white/70 px-3 py-2.5">
                                            <div className="flex items-center gap-1.5 text-[8px] font-extrabold uppercase tracking-wider text-[#A0AAA6]">
                                              {direction ===
                                              "up" ? (
                                                <ArrowUpRight
                                                  size={
                                                    10
                                                  }
                                                />
                                              ) : (
                                                <ArrowDownRight
                                                  size={
                                                    10
                                                  }
                                                />
                                              )}

                                              Perubahan
                                            </div>

                                            <div
                                              className={`mt-1 text-xs font-extrabold ${
                                                direction ===
                                                "up"
                                                  ? "text-[#9B6A17]"
                                                  : "text-[#39705F]"
                                              }`}
                                            >
                                              {direction ===
                                              "up"
                                                ? "+"
                                                : ""}
                                              {Number(
                                                warning.persen ??
                                                  0
                                              ).toFixed(
                                                2
                                              )}
                                              %
                                            </div>
                                          </div>
                                        </div>

                                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                                          <div className="flex items-center gap-1.5 text-[9px] font-medium text-[#89958F]">
                                            <UserRound
                                              size={
                                                11
                                              }
                                            />

                                            Referensi
                                            supplier:

                                            <span className="font-bold text-[#5E7068]">
                                              {warning.supplier ||
                                                "-"}
                                            </span>
                                          </div>

                                          <div className="h-3 w-px bg-[#D8E1DD]" />

                                          <div className="flex items-center gap-1.5 text-[9px] font-medium text-[#89958F]">
                                            <ShieldAlert
                                              size={
                                                11
                                              }
                                            />
                                            Perlu
                                            review
                                          </div>
                                        </div>
                                      </div>
                                    </div>
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

                {/* ADD ITEM */}

                <div className="mt-5 flex flex-col gap-4 border-t border-[#E8EEEB] pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={addItem}
                    className="group flex w-fit items-center gap-2 rounded-xl border border-[#C9DCD4] bg-gradient-to-r from-[#F2F8F5] to-[#EEF7F3] px-4 py-2.5 text-xs font-extrabold text-[#497F70] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#AFCBBF] hover:shadow-md"
                  >
                    <Plus
                      size={15}
                      className="transition-transform duration-200 group-hover:rotate-90"
                    />
                    Tambah Barang
                  </button>

                  <div className="flex items-center gap-5">
                    <div className="text-right">
                      <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#9AA7A2]">
                        Total
                      </div>

                      <div className="mt-0.5 text-xs font-medium text-[#7F8D88]">
                        {form.items.length}{" "}
                        item ·{" "}
                        {totalQty} qty
                      </div>
                    </div>

                    <div className="h-9 w-px bg-[#DCE5E1]" />

                    <div className="text-right">
                      <div className="text-xl font-extrabold tracking-tight text-[#18352D]">
                        Rp{" "}
                        {formatRupiah(
                          grandTotal
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT SUMMARY */}

          <aside className="hidden xl:block">
            <div className="sticky top-[90px] space-y-4">
              <div className="overflow-hidden rounded-[24px] border border-[#DDE7E2] bg-white shadow-[0_8px_35px_rgba(30,60,50,0.045)]">
                <div className="border-b border-[#E8EEEB] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D8E9E1] bg-[#EAF3EF] text-[#497F70]">
                      <ShoppingCart size={16} />
                    </div>

                    <div>
                      <h3 className="text-sm font-extrabold text-[#18352D]">
                        Ringkasan PO
                      </h3>

                      <p className="text-[10px] font-medium text-[#929F9A]">
                        Review sebelum
                        disimpan.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="space-y-4">
                    <div>
                      <div className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#A0AAA6]">
                        Supplier
                      </div>

                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F0F5F2] text-[#647A71]">
                          <UserRound size={13} />
                        </div>

                        <div className="min-w-0 flex-1 truncate text-xs font-bold text-[#40544C]">
                          {selectedSupplierName() ||
                            "Belum dipilih"}
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-[#EEF2F0]" />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#A0AAA6]">
                          Item
                        </div>

                        <div className="mt-1 text-sm font-extrabold text-[#30443D]">
                          {
                            form.items
                              .length
                          }
                        </div>
                      </div>

                      <div>
                        <div className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#A0AAA6]">
                          Qty
                        </div>

                        <div className="mt-1 text-sm font-extrabold text-[#30443D]">
                          {totalQty}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#E2EBE6] bg-gradient-to-br from-[#F7FAF8] to-[#F1F6F3] p-4">
                      <div className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#8D9B95]">
                        Total Purchase
                        Order
                      </div>

                      <div className="mt-1 text-xl font-extrabold tracking-tight text-[#18352D]">
                        Rp{" "}
                        {formatRupiah(
                          grandTotal
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-medium text-[#899690]">
                        Pembayaran
                      </span>

                      <span className="rounded-lg border border-[#DCE9E3] bg-[#EFF5F2] px-2.5 py-1 font-extrabold text-[#497F70]">
                        {
                          form.paymentMethod
                        }
                      </span>
                    </div>

                    {/* PRICE REVIEW */}

                    {changedPriceCount >
                      0 && (
                      <div className="relative overflow-hidden rounded-2xl border border-[#EED8A8] bg-gradient-to-br from-[#FFFDF7] to-[#FFF7E5] p-4">
                        <div className="absolute right-0 top-0 h-16 w-16 translate-x-6 -translate-y-6 rounded-full bg-[#F5D993]/20" />

                        <div className="relative flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#F0DEB4] bg-[#FFF1CC] text-[#A9781E]">
                            <ShieldAlert size={16} />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-[#805D1A]">
                                Perlu Review
                              </span>

                              <span className="rounded-full bg-[#F9E8BE] px-2 py-0.5 text-[8px] font-extrabold text-[#916817]">
                                {
                                  changedPriceCount
                                }{" "}
                                ITEM
                              </span>
                            </div>

                            <p className="mt-1 text-[10px] font-medium leading-relaxed text-[#8A774B]">
                              Terdapat harga
                              yang berbeda
                              dari
                              referensi
                              pembelian
                              sebelumnya.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[24px] border border-[#234A40] bg-[#18352D] p-5 text-white shadow-[0_12px_35px_rgba(24,53,45,0.16)]">
                <div className="absolute right-0 top-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-white/[0.035]" />

                <div className="relative">
                  <div className="text-[8px] font-extrabold uppercase tracking-[0.17em] text-white/45">
                    Status Dokumen
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-[#91C5AF] shadow-[0_0_0_4px_rgba(145,197,175,0.1)]" />

                    <span className="text-sm font-extrabold">
                      DRAFT
                    </span>
                  </div>

                  <p className="mt-3 text-[10px] font-medium leading-relaxed text-white/50">
                    Purchase Order belum
                    diproses dan masih dapat
                    diperiksa sebelum
                    disimpan.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* =====================================================
          BARANG DROPDOWN PORTAL
      ===================================================== */}

      {renderBarangDropdown()}

      {/* =====================================================
          MOBILE / DESKTOP ACTION BAR
      ===================================================== */}

      <div className="fixed bottom-0 left-0 right-0 z-[100] border-t border-[#DCE6E1] bg-white/90 shadow-[0_-10px_35px_rgba(20,45,37,0.08)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <div className="hidden min-w-0 sm:block">
            {form.supplierId ? (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF2EE] text-[#497F70]">
                  <Check size={14} />
                </div>

                <div className="min-w-0">
                  <div className="text-[8px] font-extrabold uppercase tracking-[0.14em] text-[#9AA7A2]">
                    Supplier
                  </div>

                  <div className="max-w-[300px] truncate text-xs font-bold text-[#40544C]">
                    {selectedSupplierName()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-[#9A6767]">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFF2F2]">
                  <Info size={13} />
                </div>

                Supplier belum dipilih
              </div>
            )}
          </div>

          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <div className="mr-1 text-right sm:hidden">
              <div className="text-[8px] font-extrabold uppercase tracking-wider text-[#9AA7A2]">
                Total
              </div>

              <div className="text-sm font-extrabold text-[#18352D]">
                Rp{" "}
                {formatRupiah(
                  grandTotal
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/purchase"
                )
              }
              disabled={saving}
              className="rounded-xl border border-[#D5E1DC] bg-white px-4 py-2.5 text-xs font-extrabold text-[#66766F] shadow-sm transition-all hover:border-[#C2D1CA] hover:bg-[#F5F8F6] disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={savePurchase}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#497F70] to-[#3F7062] px-5 py-2.5 text-xs font-extrabold text-white shadow-[0_5px_16px_rgba(73,127,112,0.24)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(73,127,112,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
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
                  Simpan Purchase
                  Order
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}