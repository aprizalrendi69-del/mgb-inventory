"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  History,
  Info,
  Loader2,
  Hash,
  LockKeyhole,
  Package,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";

type Barang = {
  id: number;
  code: string;
  name: string;
  unit?: string;

  /*
   * STOCK INFO
   * Data ini diambil dari response /api/master/barang
   * apabila tersedia.
   */
  stock?: number;
  minimumStock?: number;
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

type PriceWarning = {
  hargaLama: number;
  hargaBaru: number;
  persen: number;
  supplier: string;
};

type PriceLookupStatus =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "error";

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

function formatPercent(value: number | string) {
  const number = Number(value || 0);

  return `${number > 0 ? "+" : ""}${number.toLocaleString(
    "id-ID",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  )}%`;
}

/* =====================================================
   STOCK STATUS
===================================================== */

type StockStatus = {
  label: "HABIS" | "MENIPIS" | "AMAN";
  className: string;
};

function getStockStatus(
  stockValue: number | undefined,
  minimumStockValue: number | undefined
): StockStatus {
  const stock = Number(stockValue ?? 0);

  const hasMinimumStock =
    minimumStockValue !== undefined &&
    minimumStockValue !== null &&
    Number.isFinite(Number(minimumStockValue));

  const minimumStock = hasMinimumStock
    ? Number(minimumStockValue)
    : undefined;

  if (stock <= 0) {
    return {
      label: "HABIS",
      className:
        "border border-[#F1D0D0] dark:border-[#6B2424] bg-[#FFF1F1] dark:bg-[#501111] text-[#C25555] dark:text-[#CC7070]",
    };
  }

  if (
    minimumStock !== undefined &&
    stock <= minimumStock
  ) {
    return {
      label: "MENIPIS",
      className:
        "border border-[#EBD9A8] dark:border-[#6B5824] bg-[#FFF9E8] dark:bg-[#504011] text-[#A2761D] dark:text-[#E2BF78]",
    };
  }

  return {
    label: "AMAN",
    className:
      "border border-[#CBE3D4] dark:border-[#325D42] bg-[#EDF8F1] dark:bg-[#173B24] text-[#3F7D5D] dark:text-[#86C7A6]",
  };
}

/* =====================================================
   DECIMAL INPUT
===================================================== */

type DecimalInputProps = {
  value: number;
  onChange: (value: number) => void;
  onBlurValue?: (value: number) => void;
  className?: string;
  min?: number;
};

function DecimalInput({
  value,
  onChange,
  onBlurValue,
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
    e: ChangeEvent<HTMLInputElement>
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

    let numericValue = Number(text);

    if (
      Number.isNaN(numericValue) ||
      numericValue < 0
    ) {
      numericValue = 0;
    }

    if (
      min !== undefined &&
      numericValue < min
    ) {
      numericValue = min;
    }

    onChange(numericValue);

    setText(
      numericValue === 0
        ? ""
        : String(numericValue)
    );

    onBlurValue?.(numericValue);
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
   BARANG SEARCH
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

  const [dropdownStyle, setDropdownStyle] =
    useState<CSSProperties>({});

  const ref =
    useRef<HTMLDivElement>(null);

  const inputRef =
    useRef<HTMLInputElement>(null);

  const dropdownRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedBarang) {
      setSearch(
        `${selectedBarang.code} - ${selectedBarang.name}`
      );
    } else if (!value) {
      setSearch("");
    }
  }, [selectedBarang, value]);

  /* =====================================================
     POSITION DROPDOWN
  ===================================================== */

  function updateDropdownPosition() {
    const input =
      inputRef.current;

    if (!input) {
      return;
    }

    const rect =
      input.getBoundingClientRect();

    const viewportWidth =
      window.innerWidth;

    const viewportHeight =
      window.innerHeight;

    const gap = 8;

    const desiredWidth =
      Math.max(rect.width, 520);

    const width = Math.min(
      desiredWidth,
      viewportWidth - 24
    );

    let left = rect.left;

    if (
      left + width >
      viewportWidth - 12
    ) {
      left =
        viewportWidth -
        width -
        12;
    }

    if (left < 12) {
      left = 12;
    }

    const estimatedHeight = 440;

    const spaceBelow =
      viewportHeight -
      rect.bottom;

    const spaceAbove =
      rect.top;

    const showAbove =
      spaceBelow <
        estimatedHeight &&
      spaceAbove > spaceBelow;

    const top = showAbove
      ? Math.max(
          12,
          rect.top -
            Math.min(
              estimatedHeight,
              spaceAbove - 12
            ) -
            gap
        )
      : rect.bottom + gap;

    setDropdownStyle({
      position: "fixed",
      left,
      top,
      width,
      zIndex: 999999,
    });
  }

  function openDropdown() {
    setOpen(true);

    requestAnimationFrame(() => {
      updateDropdownPosition();
    });
  }

  /* =====================================================
     UPDATE POSITION SAAT SCROLL / RESIZE
  ===================================================== */

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleScroll() {
      updateDropdownPosition();
    }

    function handleResize() {
      updateDropdownPosition();
    }

    window.addEventListener(
      "scroll",
      handleScroll,
      true
    );

    window.addEventListener(
      "resize",
      handleResize
    );

    requestAnimationFrame(() => {
      updateDropdownPosition();
    });

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll,
        true
      );

      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, [open]);

  /* =====================================================
     CLICK OUTSIDE
  ===================================================== */

  useEffect(() => {
    function handleClickOutside(
      event: MouseEvent
    ) {
      const target =
        event.target as Node;

      const clickedInputArea =
        ref.current?.contains(target);

      const clickedDropdown =
        dropdownRef.current?.contains(
          target
        );

      if (
        !clickedInputArea &&
        !clickedDropdown
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
    e: ChangeEvent<HTMLInputElement>
  ) {
    const text =
      e.target.value;

    setSearch(text);
    setOpen(true);

    requestAnimationFrame(() => {
      updateDropdownPosition();
    });

    if (!text.trim()) {
      onChange(0);
    }
  }

  function handleSelect(
    barang: Barang
  ) {
    onChange(barang.id);

    setSearch(
      `${barang.code} - ${barang.name}`
    );

    setOpen(false);
  }

  const dropdown =
    open &&
    typeof document !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="overflow-hidden rounded-2xl border border-[#D7E3DE] dark:border-[#3B544A] bg-white dark:bg-[#0D1714] shadow-[0_22px_55px_rgba(28,58,48,0.20)]"
          >
            {/* DROPDOWN HEADER */}
            <div className="border-b border-[#E9EFEC] dark:border-[#3B5447] bg-[#F7FAF8] dark:bg-[#161D18] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#497F70] dark:text-[#79B8A3]">
                    Master Barang
                  </div>

                  <div className="mt-0.5 text-[10px] text-[#96A39E] dark:text-[#8DB0A2]">
                    Pilih barang untuk Purchase Order
                  </div>
                </div>

                <span className="shrink-0 rounded-lg border border-[#DFE9E4] dark:border-[#3A5547] bg-white dark:bg-[#0D1714] px-2.5 py-1 text-[10px] font-bold text-[#7D8C85] dark:text-[#8DB09F]">
                  {filteredBarangs.length} hasil
                </span>
              </div>

              {/* STATUS LEGEND */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-semibold text-[#899690] dark:text-[#8DB09F]">
                  Status stock:
                </span>

                <span className="rounded-md border border-[#F1D0D0] dark:border-[#6B2424] bg-[#FFF1F1] dark:bg-[#501111] px-2 py-1 text-[8px] font-extrabold text-[#C25555] dark:text-[#CC7070]">
                  HABIS
                </span>

                <span className="rounded-md border border-[#EBD9A8] dark:border-[#6B5824] bg-[#FFF9E8] dark:bg-[#504011] px-2 py-1 text-[8px] font-extrabold text-[#A2761D] dark:text-[#E2BF78]">
                  MENIPIS
                </span>

                <span className="rounded-md border border-[#CBE3D4] dark:border-[#325D42] bg-[#EDF8F1] dark:bg-[#173B24] px-2 py-1 text-[8px] font-extrabold text-[#3F7D5D] dark:text-[#86C7A6]">
                  AMAN
                </span>
              </div>
            </div>

            <div className="max-h-[330px] overflow-y-auto p-1.5">
              {filteredBarangs.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F1F5F3] dark:bg-[#161D19] text-[#95A29D] dark:text-[#8DB0A2]">
                    <Package size={18} />
                  </div>

                  <p className="text-xs font-bold text-[#64736C] dark:text-[#9FBCAE]">
                    Barang tidak ditemukan
                  </p>

                  <p className="mt-1 text-[10px] text-[#A0ABA6] dark:text-[#8DB0A0]">
                    Coba gunakan kode atau nama barang lain.
                  </p>
                </div>
              ) : (
                filteredBarangs.map(
                  (barang) => {
                    const selected =
                      barang.id === value;

                    const stock =
                      Number(
                        barang.stock ?? 0
                      );

                    const minimumStock =
                      barang.minimumStock !==
                        undefined &&
                      barang.minimumStock !==
                        null
                        ? Number(
                            barang.minimumStock
                          )
                        : undefined;

                    const stockStatus =
                      getStockStatus(
                        barang.stock,
                        barang.minimumStock
                      );

                    return (
                      <button
                        key={barang.id}
                        type="button"
                        onMouseDown={(e) =>
                          e.preventDefault()
                        }
                        onClick={() =>
                          handleSelect(
                            barang
                          )
                        }
                        className={`flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left transition-all ${
                          selected
                            ? "bg-[#EAF4EF] dark:bg-[#1B3428]"
                            : "hover:bg-[#F5F8F6] dark:hover:bg-[#161D18]"
                        }`}
                      >
                        {/* BARANG INFO */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-[#EFF4F1] dark:bg-[#1E2923] px-2 py-1 font-mono text-[10px] font-bold text-[#497F70] dark:text-[#79B8A3]">
                              {barang.code}
                            </span>

                            {barang.unit && (
                              <span className="text-[10px] font-medium text-[#9AA7A2] dark:text-[#8DB0A2]">
                                {barang.unit}
                              </span>
                            )}
                          </div>

                          <div className="mt-1.5 truncate text-sm font-bold text-[#29443B] dark:text-[#C9DDD5]">
                            {barang.name}
                          </div>
                        </div>

                        {/* STOCK INFO */}
                        <div className="flex shrink-0 items-center gap-3">
                          <div className="hidden text-right sm:block">
                            <div className="text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#98A49F] dark:text-[#8DB0A1]">
                              Stock
                            </div>

                            <div className="mt-0.5 text-xs font-extrabold tabular-nums text-[#30473F] dark:text-[#C5D9D1]">
                              {formatNumber(stock)}
                              {barang.unit
                                ? ` ${barang.unit}`
                                : ""}
                            </div>

                            {minimumStock !==
                              undefined && (
                              <div className="mt-0.5 text-[8px] font-medium text-[#A0AAA6] dark:text-[#8DB0A2]">
                                Min.{" "}
                                {formatNumber(
                                  minimumStock
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex min-w-[72px] justify-end">
                            <span
                              className={`rounded-lg px-2.5 py-1.5 text-[8px] font-extrabold uppercase tracking-[0.08em] ${stockStatus.className}`}
                            >
                              {stockStatus.label}
                            </span>
                          </div>

                          {selected && (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#497F70] dark:bg-[#17382F] text-white shadow-sm">
                              <Check size={14} />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  }
                )
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        ref={ref}
        className="relative min-w-[320px]"
      >
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[#91A19A] dark:text-[#8DB0A0]"
          />

          <input
            ref={inputRef}
            type="text"
            value={search}
            onFocus={openDropdown}
            onChange={handleChange}
            placeholder="Cari kode atau nama barang..."
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-[#D8E3DE] dark:border-[#3B5449] bg-[#FBFCFB] dark:bg-[#161D16] pl-10 pr-10 text-sm font-medium text-[#30473F] dark:text-[#C5D9D1] outline-none transition-all placeholder:text-[#A7B1AD] dark:placeholder:text-[#8DB0A2] hover:border-[#C3D4CC] dark:hover:border-[#3B5448] focus:border-[#497F70] dark:focus:border-[#3B6F60] focus:bg-white dark:bg-[#0D1714] focus:ring-4 focus:ring-[#497F70]/10 dark:focus:ring-[#17382F]/10"
          />

          <ChevronDown
            size={15}
            className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#899892] dark:text-[#8DB0A2] transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {dropdown}
    </>
  );
}

/* =====================================================
   SUPPLIER SEARCH
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

  const ref =
    useRef<HTMLDivElement>(null);

  const selectedSupplier =
    suppliers.find(
      (supplier) =>
        String(supplier.id) ===
        String(value)
    );

  useEffect(() => {
    if (selectedSupplier) {
      setSearch(selectedSupplier.name);
    } else if (!value) {
      setSearch("");
    }
  }, [selectedSupplier, value]);

  useEffect(() => {
    function handleClickOutside(
      event: MouseEvent
    ) {
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

  function handleChange(
    e: ChangeEvent<HTMLInputElement>
  ) {
    const text = e.target.value;

    setSearch(text);
    setOpen(true);

    if (!text.trim()) {
      onChange("");
    }
  }

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
          className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[#91A19A] dark:text-[#8DB0A0]"
        />

        <input
          type="text"
          value={search}
          onFocus={() => setOpen(true)}
          onChange={handleChange}
          placeholder="Ketik nama supplier..."
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-[#D8E3DE] dark:border-[#3B5449] bg-[#FBFCFB] dark:bg-[#161D16] pl-10 pr-10 text-sm font-medium text-[#30473F] dark:text-[#C5D9D1] outline-none transition-all placeholder:text-[#A7B1AD] dark:placeholder:text-[#8DB0A2] hover:border-[#C3D4CC] dark:hover:border-[#3B5448] focus:border-[#497F70] dark:focus:border-[#3B6F60] focus:bg-white dark:bg-[#0D1714] focus:ring-4 focus:ring-[#497F70]/10 dark:focus:ring-[#17382F]/10"
        />

        <ChevronDown
          size={15}
          className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#899892] dark:text-[#8DB0A2] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </div>

      {open && (
        <div className="absolute left-0 top-full z-[100] mt-2 w-full overflow-hidden rounded-2xl border border-[#D7E3DE] dark:border-[#3B544A] bg-white dark:bg-[#0D1714] shadow-[0_22px_55px_rgba(28,58,48,0.16)]">
          <div className="border-b border-[#E9EFEC] dark:border-[#3B5447] bg-[#F7FAF8] dark:bg-[#161D18] px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#497F70] dark:text-[#79B8A3]">
                  Supplier
                </div>

                <div className="mt-0.5 text-[10px] text-[#96A39E] dark:text-[#8DB0A2]">
                  Pilih supplier Purchase Order
                </div>
              </div>

              <span className="rounded-lg border border-[#DFE9E4] dark:border-[#3A5547] bg-white dark:bg-[#0D1714] px-2.5 py-1 text-[10px] font-bold text-[#7D8C85] dark:text-[#8DB09F]">
                {filteredSuppliers.length} hasil
              </span>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {filteredSuppliers.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F1F5F3] dark:bg-[#161D19] text-[#95A29D] dark:text-[#8DB0A2]">
                  <Package size={18} />
                </div>

                <p className="text-xs font-bold text-[#64736C] dark:text-[#9FBCAE]">
                  Supplier tidak ditemukan
                </p>

                <p className="mt-1 text-[10px] text-[#A0ABA6] dark:text-[#8DB0A0]">
                  Coba ketik nama supplier lain.
                </p>
              </div>
            ) : (
              filteredSuppliers.map(
                (supplier) => {
                  const selected =
                    String(
                      supplier.id
                    ) === String(value);

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
                          ? "bg-[#EAF4EF] dark:bg-[#1B3428]"
                          : "hover:bg-[#F5F8F6] dark:hover:bg-[#161D18]"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EFF4F1] dark:bg-[#1E2923] text-[#497F70] dark:text-[#79B8A3]">
                          <Package size={14} />
                        </span>

                        <span className="truncate text-sm font-bold text-[#29443B] dark:text-[#C9DDD5]">
                          {supplier.name}
                        </span>
                      </div>

                      {selected && (
                        <div className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#497F70] dark:bg-[#17382F] text-white shadow-sm">
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
   PRICE WARNING
===================================================== */

function PriceWarningPanel({
  warning,
}: {
  warning: PriceWarning;
}) {
  const isIncrease =
    warning.hargaBaru > warning.hargaLama;

  const difference =
    warning.hargaBaru -
    warning.hargaLama;

  const theme = isIncrease
    ? {
        panel:
          "border-[#F0CFC5] dark:border-[#6B3424] bg-gradient-to-r from-[#FFF7F4] dark:from-[#502211] via-[#FFF9F7] dark:via-[#502111] to-white dark:to-[#0D1714]",

        icon:
          "bg-[#FFE7DF] dark:bg-[#502111] text-[#C45B3D] dark:text-[#D2816A]",

        title:
          "text-[#A9472E] dark:text-[#DC927F]",

        description:
          "text-[#916F65] dark:text-[#B0958D]",

        badge:
          "border border-[#F5C9BC] dark:border-[#6B3424] bg-[#FFE8E1] dark:bg-[#502011] text-[#B84F32] dark:text-[#D67F67]",

        oldBox:
          "border-[#EBDDD8] dark:border-[#5E3D30] bg-white dark:bg-[#0D1714]",

        oldLabel:
          "text-[#9C8178] dark:text-[#B0958D]",

        oldPrice:
          "text-[#65534D] dark:text-[#BCA69F]",

        arrow:
          "text-[#C7A59A] dark:text-[#BA9082]",

        newBox:
          "border-[#F0C8BC] dark:border-[#6B3424] bg-[#FFF8F5] dark:bg-[#502411]",

        newLabel:
          "text-[#A36C5B] dark:text-[#BA9083]",

        newPrice:
          "text-[#A9472E] dark:text-[#DC927F]",

        bottom:
          "border-[#F1DDD7] dark:border-[#6A3525] bg-[#FFF9F7] dark:bg-[#502111]",

        bottomIcon:
          "text-[#B56B55] dark:text-[#C48978]",

        bottomText:
          "text-[#866A61] dark:text-[#B0958D]",

        bottomStrong:
          "text-[#A9472E] dark:text-[#DC927F]",

        bottomDivider:
          "bg-[#E9CFC6] dark:bg-[#3C2017]",

        bottomBadge:
          "bg-[#FFE8E1] dark:bg-[#502011] text-[#B84F32] dark:text-[#D67F67]",
      }
    : {
        panel:
          "border-[#C8E2D3] dark:border-[#315E44] bg-gradient-to-r from-[#F3FBF6] dark:from-[#153F25] via-[#F8FCF9] dark:via-[#161D18] to-white dark:to-[#0D1714]",

        icon:
          "bg-[#DDF2E5] dark:bg-[#173C25] text-[#3F8062] dark:text-[#86C7A6]",

        title:
          "text-[#397258] dark:text-[#86C5AE]",

        description:
          "text-[#6C897B] dark:text-[#8DB09F]",

        badge:
          "border border-[#BFE0CD] dark:border-[#2F6044] bg-[#DFF3E7] dark:bg-[#173C26] text-[#3C795B] dark:text-[#92C9AE]",

        oldBox:
          "border-[#DCE8E1] dark:border-[#395645] bg-white dark:bg-[#0D1714]",

        oldLabel:
          "text-[#80958B] dark:text-[#8DB09F]",

        oldPrice:
          "text-[#4F655C] dark:text-[#9FBCB0]",

        arrow:
          "text-[#94B5A4] dark:text-[#8CB09E]",

        newBox:
          "border-[#BFDCCB] dark:border-[#325C44] bg-[#F5FBF7] dark:bg-[#161D18]",

        newLabel:
          "text-[#648977] dark:text-[#8DB09F]",

        newPrice:
          "text-[#397258] dark:text-[#86C5AE]",

        bottom:
          "border-[#D5E8DD] dark:border-[#335C44] bg-[#F8FCF9] dark:bg-[#161D18]",

        bottomIcon:
          "text-[#4D8469] dark:text-[#98C3AE]",

        bottomText:
          "text-[#698276] dark:text-[#8DB09F]",

        bottomStrong:
          "text-[#397258] dark:text-[#86C5AE]",

        bottomDivider:
          "bg-[#CDE2D5] dark:bg-[#1D3125]",

        bottomBadge:
          "bg-[#DFF3E7] dark:bg-[#173C26] text-[#3C795B] dark:text-[#92C9AE]",
      };

  return (
    <div
      className={`overflow-hidden rounded-2xl border ${theme.panel}`}
    >
      {/* MAIN WARNING */}
      <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${theme.icon}`}
          >
            {isIncrease ? (
              <ArrowUpRight size={17} />
            ) : (
              <ArrowDownRight size={17} />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[10px] font-extrabold uppercase tracking-[0.13em] ${theme.title}`}
              >
                Perubahan Harga Terdeteksi
              </span>

              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-extrabold ${theme.badge}`}
              >
                {isIncrease ? (
                  <ArrowUpRight size={11} />
                ) : (
                  <ArrowDownRight size={11} />
                )}

                {isIncrease
                  ? "Harga Naik"
                  : "Harga Turun"}{" "}
                {formatPercent(
                  warning.persen
                )}
              </span>
            </div>

            <p
              className={`mt-1 text-[10px] leading-5 ${theme.description}`}
            >
              {isIncrease
                ? "Harga yang sedang digunakan lebih tinggi dari harga pembelian terakhir. Mohon tinjau sebelum menyimpan PO."
                : "Harga yang sedang digunakan lebih rendah dari harga pembelian terakhir. Perubahan harga terdeteksi dan dapat ditinjau sebelum menyimpan PO."}
            </p>
          </div>
        </div>

        {/* PRICE COMPARISON */}
        <div className="flex shrink-0 items-center gap-2">
          <div
            className={`rounded-xl border px-3 py-2 ${theme.oldBox}`}
          >
            <div
              className={`text-[8px] font-bold uppercase tracking-[0.12em] ${theme.oldLabel}`}
            >
              Harga Terakhir
            </div>

            <div
              className={`mt-0.5 text-xs font-extrabold tabular-nums ${theme.oldPrice}`}
            >
              {formatRupiah(
                warning.hargaLama
              )}
            </div>
          </div>

          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full ${theme.icon}`}
          >
            {isIncrease ? (
              <ArrowUpRight size={14} />
            ) : (
              <ArrowDownRight size={14} />
            )}
          </div>

          <div
            className={`rounded-xl border px-3 py-2 ${theme.newBox}`}
          >
            <div
              className={`text-[8px] font-bold uppercase tracking-[0.12em] ${theme.newLabel}`}
            >
              Harga PO
            </div>

            <div
              className={`mt-0.5 text-xs font-extrabold tabular-nums ${theme.newPrice}`}
            >
              {formatRupiah(
                warning.hargaBaru
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DETAIL */}
      <div
        className={`flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-3.5 py-2.5 ${theme.bottom}`}
      >
        <div className="flex items-center gap-1.5">
          <History
            size={12}
            className={theme.bottomIcon}
          />

          <span
            className={`text-[9px] font-semibold ${theme.bottomText}`}
          >
            Supplier harga terakhir:
          </span>

          <span
            className={`text-[9px] font-bold ${theme.bottomStrong}`}
          >
            {warning.supplier ||
              "Tidak tersedia"}
          </span>
        </div>

        <div
          className={`hidden h-3 w-px sm:block ${theme.bottomDivider}`}
        />

        <div
          className={`text-[9px] font-semibold ${theme.bottomText}`}
        >
          Selisih:{" "}
          <span
            className={`font-extrabold ${theme.bottomStrong}`}
          >
            {formatRupiah(
              Math.abs(difference)
            )}
          </span>
        </div>

        <div
          className={`ml-auto rounded-lg px-2 py-1 text-[9px] font-extrabold ${theme.bottomBadge}`}
        >
          {isIncrease
            ? "↑ Biaya meningkat"
            : "↓ Biaya menurun"}
        </div>
      </div>
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

  const [priceWarning, setPriceWarning] =
    useState<
      Record<number, PriceWarning>
    >({});

  const [loadingPrice, setLoadingPrice] =
    useState<Record<number, boolean>>({});

  const [
    priceLookupStatus,
    setPriceLookupStatus,
  ] = useState<
    Record<number, PriceLookupStatus>
  >({});

  const initialPriceCheckDone =
    useRef(false);

  /* =====================================================
     LOAD DATA
  ===================================================== */

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      initialPriceCheckDone.current = false;

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
     GET LAST PRICE
  ===================================================== */

  async function getLatestPrice(
    barangId: number
  ): Promise<number | null> {
    if (!barangId) {
      return null;
    }

    try {
      const res = await fetch(
        `/api/master-harga/latest/${barangId}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        return null;
      }

      const data =
        json.data || json;

      const possiblePrice =
        typeof data === "number"
          ? data
          : data?.hargaTerakhir ??
            data?.hargaLama ??
            data?.price ??
            data?.harga ??
            data?.purchasePrice ??
            null;

      if (
        possiblePrice === null ||
        possiblePrice === undefined
      ) {
        return null;
      }

      const numericPrice =
        Number(possiblePrice);

      return Number.isFinite(
        numericPrice
      )
        ? numericPrice
        : null;
    } catch (error) {
      console.error(
        "GET LATEST PRICE ERROR:",
        error
      );

      return null;
    }
  }

  /* =====================================================
     AUTO PRICE + WARNING
  ===================================================== */

  async function applyLatestPrice(
    index: number,
    barangId: number,
    forceApply = true
  ) {
    if (!barangId) {
      setPriceLookupStatus(
        (prev) => ({
          ...prev,
          [index]: "idle",
        })
      );

      setPriceWarning((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });

      return;
    }

    setLoadingPrice((prev) => ({
      ...prev,
      [index]: true,
    }));

    setPriceLookupStatus(
      (prev) => ({
        ...prev,
        [index]: "loading",
      })
    );

    try {
      const latestPrice =
        await getLatestPrice(
          barangId
        );

      if (
        latestPrice !== null &&
        latestPrice > 0
      ) {
        if (forceApply) {
          setItems((prev) => {
            const next = [...prev];

            if (!next[index]) {
              return prev;
            }

            next[index] = {
              ...next[index],
              price: latestPrice,
            };

            return next;
          });
        }

        setPriceLookupStatus(
          (prev) => ({
            ...prev,
            [index]: "success",
          })
        );

        await checkPriceWarning(
          index,
          barangId,
          latestPrice
        );
      } else {
        setPriceLookupStatus(
          (prev) => ({
            ...prev,
            [index]: "empty",
          })
        );

        setPriceWarning((prev) => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
      }
    } catch (error) {
      console.error(
        "APPLY LATEST PRICE ERROR:",
        error
      );

      setPriceLookupStatus(
        (prev) => ({
          ...prev,
          [index]: "error",
        })
      );
    } finally {
      setLoadingPrice((prev) => ({
        ...prev,
        [index]: false,
      }));
    }
  }

  async function checkPriceWarning(
    index: number,
    barangId: number,
    price: number
  ) {
    if (
      !barangId ||
      !price ||
      price <= 0
    ) {
      setPriceWarning((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });

      return;
    }

    try {
      const res = await fetch(
        `/api/master-harga/check/${barangId}/${price}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (
        !res.ok ||
        !json.success ||
        !json.data
      ) {
        setPriceWarning((prev) => {
          const next = { ...prev };
          delete next[index];
          return next;
        });

        return;
      }

      const data =
        json.data;

      const warning: PriceWarning = {
        hargaLama:
          Number(
            data.hargaLama ?? 0
          ),
        hargaBaru:
          Number(
            data.hargaBaru ??
              price
          ),
        persen:
          Number(
            data.persen ?? 0
          ),
        supplier:
          data.supplier ??
          "-",
      };

      if (
        warning.hargaLama <= 0 ||
        warning.hargaLama ===
          warning.hargaBaru
      ) {
        setPriceWarning((prev) => {
          const next = { ...prev };
          delete next[index];
          return next;
        });

        return;
      }

      setPriceWarning((prev) => ({
        ...prev,
        [index]: warning,
      }));
    } catch (error) {
      console.error(
        "CHECK PRICE WARNING ERROR:",
        error
      );
    }
  }

  /* =====================================================
     INITIAL PRICE CHECK
  ===================================================== */

  useEffect(() => {
    if (
      loading ||
      initialPriceCheckDone.current ||
      items.length === 0
    ) {
      return;
    }

    initialPriceCheckDone.current =
      true;

    items.forEach(
      (item, index) => {
        if (
          item.barangId &&
          item.price > 0
        ) {
          checkPriceWarning(
            index,
            item.barangId,
            item.price
          );
        }
      }
    );
  }, [loading, items.length]);

  /* =====================================================
     ADD ITEM
  ===================================================== */

  function addItem() {
    setItems((prev) => [
      ...prev,
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

    setItems((prev) =>
      prev.filter(
        (_, i) => i !== index
      )
    );

    setPriceWarning((prev) => {
      const next: Record<
        number,
        PriceWarning
      > = {};

      Object.entries(prev).forEach(
        ([key, warning]) => {
          const oldIndex =
            Number(key);

          if (oldIndex < index) {
            next[oldIndex] = warning;
          }

          if (oldIndex > index) {
            next[oldIndex - 1] =
              warning;
          }
        }
      );

      return next;
    });

    setLoadingPrice((prev) => {
      const next: Record<
        number,
        boolean
      > = {};

      Object.entries(prev).forEach(
        ([key, value]) => {
          const oldIndex =
            Number(key);

          if (oldIndex < index) {
            next[oldIndex] = value;
          }

          if (oldIndex > index) {
            next[oldIndex - 1] =
              value;
          }
        }
      );

      return next;
    });

    setPriceLookupStatus(
      (prev) => {
        const next: Record<
          number,
          PriceLookupStatus
        > = {};

        Object.entries(prev).forEach(
          ([key, value]) => {
            const oldIndex =
              Number(key);

            if (oldIndex < index) {
              next[oldIndex] = value;
            }

            if (oldIndex > index) {
              next[oldIndex - 1] =
                value;
            }
          }
        );

        return next;
      }
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
    setItems((prev) => {
      const updated = [...prev];

      if (!updated[index]) {
        return prev;
      }

      updated[index] = {
        ...updated[index],
        [field]: value,
      };

      return updated;
    });

    if (field === "barangId") {
      const barangId =
        Number(value);

      setPriceWarning((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });

      if (!barangId) {
        setPriceLookupStatus(
          (prev) => ({
            ...prev,
            [index]: "idle",
          })
        );

        setItems((prev) => {
          const next = [...prev];

          if (!next[index]) {
            return prev;
          }

          next[index] = {
            ...next[index],
            price: 0,
          };

          return next;
        });

        return;
      }

      setItems((prev) => {
        const next = [...prev];

        if (!next[index]) {
          return prev;
        }

        next[index] = {
          ...next[index],
          price: 0,
        };

        return next;
      });

      window.setTimeout(async () => {
        await applyLatestPrice(
          index,
          barangId,
          true
        );
      }, 0);
    }

    if (field === "price") {
      setPriceLookupStatus(
        (prev) => ({
          ...prev,
          [index]:
            prev[index] === "success"
              ? "idle"
              : prev[index] ??
                "idle",
        })
      );
    }
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

  const warningCount =
    Object.keys(priceWarning).length;

  /* =====================================================
     SUBMIT
  ===================================================== */

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>
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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(73,127,112,0.08),transparent_28%),#F3F6F4] dark:bg-[radial-gradient(circle_at_top_right,rgba(73,127,112,0.16),transparent_28%),#07110E]">
        <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-2xl bg-[#DCE7E2] dark:bg-[#1D3027]" />

            <div className="space-y-2">
              <div className="h-3 w-28 animate-pulse rounded bg-[#DCE7E2] dark:bg-[#1D3027]" />

              <div className="h-6 w-52 animate-pulse rounded-lg bg-[#DCE7E2] dark:bg-[#1D3027]" />
            </div>
          </div>

          <div className="space-y-5">
            <div className="h-64 animate-pulse rounded-[24px] border border-[#DDE7E2] dark:border-[#3B5447] bg-white dark:bg-[#0D1714] shadow-sm" />

            <div className="h-[520px] animate-pulse rounded-[24px] border border-[#DDE7E2] dark:border-[#3B5447] bg-white dark:bg-[#0D1714] shadow-sm" />
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
      <div className="min-h-screen bg-[#F3F6F4] dark:bg-[#07110E] px-5 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[24px] border border-[#DDE7E2] dark:border-[#3B5447] bg-white dark:bg-[#0D1714] p-10 text-center shadow-[0_12px_40px_rgba(31,59,50,0.06)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#F1F5F3] dark:bg-[#161D19] text-[#8A9892] dark:text-[#8DB0A1]">
              <FileText size={24} />
            </div>

            <h1 className="mt-5 text-xl font-extrabold tracking-tight text-[#18352D] dark:text-[#D8E8E2]">
              Purchase Order tidak ditemukan
            </h1>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#84918C] dark:text-[#8DB0A2]">
              Data Purchase Order yang diminta
              tidak tersedia atau sudah tidak dapat
              diakses.
            </p>

            <Link
              href="/purchase"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#497F70] dark:bg-[#17382F] px-5 py-3 text-xs font-bold text-white shadow-[0_6px_18px_rgba(73,127,112,0.2)] transition-all hover:bg-[#3D6D60] dark:hover:bg-[#1C322C]"
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
      <div className="min-h-screen bg-[#F3F6F4] dark:bg-[#07110E] px-5 py-8 md:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="overflow-hidden rounded-[24px] border border-[#E6D5D5] dark:border-[#5A3535] bg-white dark:bg-[#0D1714] shadow-[0_12px_40px_rgba(80,40,40,0.06)]">
            <div className="border-b border-[#F0E2E2] dark:border-[#5E3131] bg-gradient-to-r from-[#FFF8F8] dark:from-[#1D1616] to-white dark:to-[#0D1714] px-6 py-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDECEC] dark:bg-[#4C1010] text-[#C85C5C] dark:text-[#CE6E6E]">
                  <LockKeyhole size={20} />
                </div>

                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#B06A6A] dark:text-[#BC8080]">
                    Editing Locked
                  </div>

                  <h1 className="mt-1 text-xl font-extrabold tracking-tight text-[#6B3030] dark:text-[#CC8E8E]">
                    Purchase Order tidak dapat diedit
                  </h1>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm leading-6 text-[#725454] dark:text-[#BC9F9F]">
                Purchase Order{" "}
                <strong className="font-bold text-[#5E3535] dark:text-[#C49797]">
                  {purchase.number}
                </strong>{" "}
                sudah berstatus{" "}
                <span className="rounded-lg bg-[#F8EEEE] dark:bg-[#3A1818] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#A54F4F] dark:text-[#C07C7C]">
                  {purchase.status}
                </span>
                .
              </p>

              <div className="mt-6">
                <Link
                  href={`/purchase/${id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#497F70] dark:bg-[#17382F] px-5 py-3 text-xs font-bold text-white shadow-[0_6px_18px_rgba(73,127,112,0.2)] transition hover:bg-[#3D6D60] dark:hover:bg-[#1C322C]"
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
     MAIN UI
  ===================================================== */

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(73,127,112,0.07),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(24,53,45,0.035),transparent_25%),#F3F6F4] dark:bg-[radial-gradient(circle_at_top_right,rgba(73,127,112,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(73,127,112,0.08),transparent_25%),#07110E] text-[#18352D] dark:text-[#D8E8E2]">
      <div className="fixed inset-x-0 top-0 z-[60] h-[2px] bg-gradient-to-r from-transparent via-[#497F70] dark:via-[#17382F] to-transparent" />

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-[#DDE7E2] dark:border-[#3B5447] bg-white/95 dark:bg-[#0D1714]/95 shadow-[0_4px_24px_rgba(31,59,50,0.045)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 py-4 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href={`/purchase/${id}`}
                className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D6E2DD] dark:border-[#3B544A] bg-white dark:bg-[#0D1714] text-[#687871] dark:text-[#9FBCAF] shadow-sm transition-all hover:border-[#BFD1C9] dark:hover:border-[#3B5449] hover:bg-[#F4F8F6] dark:hover:bg-[#161D1A] hover:text-[#497F70] dark:hover:text-[#79B8A3]"
                title="Kembali"
              >
                <ArrowLeft
                  size={17}
                  className="transition-transform group-hover:-translate-x-0.5"
                />
              </Link>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="hidden text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#497F70] dark:text-[#79B8A3] sm:inline">
                    Procurement
                  </span>

                  <span className="hidden text-[#C5D0CB] dark:text-[#8DB0A0] sm:inline">
                    /
                  </span>

                  <span className="truncate text-[10px] font-medium text-[#8D9A95] dark:text-[#8DB0A2] sm:text-xs">
                    Edit Purchase Order
                  </span>
                </div>

                <div className="mt-0.5 flex items-center gap-2.5">
                  <h1 className="truncate text-lg font-extrabold tracking-tight text-[#18352D] dark:text-[#D8E8E2] sm:text-xl">
                    {purchase.number}
                  </h1>

                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9EAE1] dark:border-[#335C46] bg-[#EDF7F1] dark:bg-[#193825] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#497F70] dark:text-[#79B8A3]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#497F70] dark:bg-[#17382F] shadow-[0_0_0_3px_rgba(73,127,112,0.12)]" />
                    Draft
                  </span>
                </div>
              </div>
            </div>

            <Link
              href={`/purchase/${id}`}
              className="hidden items-center gap-2 rounded-xl border border-[#D6E2DD] dark:border-[#3B544A] bg-white dark:bg-[#0D1714] px-4 py-2.5 text-xs font-bold text-[#667770] dark:text-[#9FBCB0] shadow-sm transition hover:border-[#C3D2CB] dark:hover:border-[#3B5448] hover:bg-[#F6F9F7] dark:hover:bg-[#161D18] hover:text-[#497F70] dark:hover:text-[#79B8A3] md:inline-flex"
            >
              Batal
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 pb-32 lg:px-8">
        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            {/* INFORMATION */}
            <section className="overflow-visible rounded-[24px] border border-[#DDE7E2] dark:border-[#3B5447] bg-white dark:bg-[#0D1714] shadow-[0_10px_35px_rgba(31,59,50,0.055)]">
              <div className="flex items-center justify-between border-b border-[#E8EEEB] dark:border-[#3B5447] bg-gradient-to-r from-white dark:from-[#0D1714] via-white dark:via-[#0D1714] to-[#F8FBF9] dark:to-[#161D18] px-5 py-5 lg:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF3EE] dark:bg-[#1C3226] text-[#497F70] dark:text-[#79B8A3] shadow-[inset_0_0_0_1px_rgba(73,127,112,0.06)]">
                    <ClipboardList size={18} />
                  </div>

                  <div>
                    <h2 className="text-sm font-extrabold tracking-tight text-[#18352D] dark:text-[#D8E8E2]">
                      Informasi Purchase Order
                    </h2>

                    <p className="mt-0.5 text-[11px] text-[#899690] dark:text-[#8DB09F]">
                      Informasi utama dokumen pembelian.
                    </p>
                  </div>
                </div>

                <div className="hidden items-center gap-2 rounded-xl border border-[#E2EBE6] dark:border-[#3A5546] bg-[#F8FAF9] dark:bg-[#161D1A] px-3 py-2 sm:flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#497F70] dark:bg-[#17382F]" />

                  <span className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#718079] dark:text-[#8DB09F]">
                    Editable Draft
                  </span>
                </div>
              </div>

              <div className="p-5 lg:p-6">
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                  {/* PO NUMBER */}
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#687871] dark:text-[#9FBCAF]">
                      Nomor PO
                    </label>

                    <div className="relative">
                      <Hash
                        size={15}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA7A2] dark:text-[#8DB0A2]"
                      />

                      <input
                        value={
                          purchase.number ||
                          ""
                        }
                        disabled
                        className="h-11 w-full rounded-xl border border-[#E0E7E4] dark:border-[#3B5449] bg-[#F5F7F6] dark:bg-[#171C1A] pl-10 pr-3 text-sm font-bold text-[#7A8782] dark:text-[#8DB0A2] outline-none"
                      />
                    </div>
                  </div>

                  {/* SUPPLIER */}
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#687871] dark:text-[#9FBCAF]">
                      Supplier
                      <span className="text-red-500">
                        *
                      </span>
                    </label>

                    <SupplierSearch
                      value={supplierId}
                      suppliers={suppliers}
                      onChange={
                        setSupplierId
                      }
                    />
                  </div>

                  {/* PAYMENT */}
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#687871] dark:text-[#9FBCAF]">
                      Metode Pembayaran
                      <span className="text-red-500">
                        *
                      </span>
                    </label>

                    <div className="relative">
                      <CreditCard
                        size={15}
                        className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[#9AA7A2] dark:text-[#8DB0A2]"
                      />

                      <select
                        value={
                          paymentMethod
                        }
                        onChange={(e) =>
                          setPaymentMethod(
                            e.target.value
                          )
                        }
                        required
                        className="h-11 w-full appearance-none rounded-xl border border-[#D8E3DE] dark:border-[#3B5449] bg-[#FBFCFB] dark:bg-[#161D16] pl-10 pr-10 text-sm font-medium text-[#30473F] dark:text-[#C5D9D1] outline-none transition-all hover:border-[#C3D4CC] dark:hover:border-[#3B5448] focus:border-[#497F70] dark:focus:border-[#3B6F60] focus:bg-white dark:bg-[#0D1714] focus:ring-4 focus:ring-[#497F70]/10 dark:focus:ring-[#17382F]/10"
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
                        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#899791] dark:text-[#8DB0A1]"
                      />
                    </div>
                  </div>

                  {/* STATUS */}
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#687871] dark:text-[#9FBCAF]">
                      Status Dokumen
                    </label>

                    <div className="flex h-11 items-center gap-2.5 rounded-xl border border-[#DDE8E2] dark:border-[#3A5546] bg-[#F7FAF8] dark:bg-[#161D18] px-3.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E6F1EB] dark:bg-[#1C3226] text-[#497F70] dark:text-[#79B8A3]">
                        <Check size={14} />
                      </span>

                      <div>
                        <div className="text-xs font-extrabold text-[#3D6256] dark:text-[#9AC0B4]">
                          DRAFT
                        </div>

                        <div className="text-[9px] text-[#8B9893] dark:text-[#8DB0A2]">
                          Dapat diedit
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* REMARKS */}
                  <div className="lg:col-span-4">
                    <label className="mb-2 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#687871] dark:text-[#9FBCAF]">
                      Keterangan
                      <span className="font-normal normal-case tracking-normal text-[#A0AAA6] dark:text-[#8DB0A2]">
                        Opsional
                      </span>
                    </label>

                    <div className="relative">
                      <FileText
                        size={15}
                        className="pointer-events-none absolute left-3.5 top-3.5 text-[#9AA7A2] dark:text-[#8DB0A2]"
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
                        className="w-full resize-none rounded-xl border border-[#D8E3DE] dark:border-[#3B5449] bg-[#FBFCFB] dark:bg-[#161D16] px-10 py-3 text-sm leading-6 text-[#30473F] dark:text-[#C5D9D1] outline-none transition-all placeholder:text-[#A3ADA9] dark:placeholder:text-[#8DB0A2] hover:border-[#C3D4CC] dark:hover:border-[#3B5448] focus:border-[#497F70] dark:focus:border-[#3B6F60] focus:bg-white dark:bg-[#0D1714] focus:ring-4 focus:ring-[#497F70]/10 dark:focus:ring-[#17382F]/10"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ITEMS */}
            <section className="overflow-visible rounded-[24px] border border-[#DDE7E2] dark:border-[#3B5447] bg-white dark:bg-[#0D1714] shadow-[0_10px_35px_rgba(31,59,50,0.055)]">
              <div className="flex flex-col gap-4 border-b border-[#E8EEEB] dark:border-[#3B5447] bg-gradient-to-r from-white dark:from-[#0D1714] via-white dark:via-[#0D1714] to-[#F8FBF9] dark:to-[#161D18] px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF3EE] dark:bg-[#1C3226] text-[#497F70] dark:text-[#79B8A3]">
                    <Package size={18} />
                  </div>

                  <div>
                    <h2 className="text-sm font-extrabold tracking-tight text-[#18352D] dark:text-[#D8E8E2]">
                      Detail Barang
                    </h2>

                    <p className="mt-0.5 text-[11px] text-[#899690] dark:text-[#8DB09F]">
                      Kelola barang, qty, dan harga pembelian.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {warningCount > 0 && (
                    <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#E9DDBE] dark:border-[#6B5724] bg-[#FFFCF3] dark:bg-[#504011] px-3 py-2 text-[9px] font-extrabold text-[#8A6A28] dark:text-[#DABD80]">
                      <ShieldAlert size={12} />
                      {warningCount} harga perlu ditinjau
                    </div>
                  )}

                  <div className="rounded-xl border border-[#E2EAE6] dark:border-[#3B5447] bg-[#F8FAF9] dark:bg-[#161D1A] px-3 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#718079] dark:text-[#8DB09F]">
                    {items.length}{" "}
                    {items.length === 1
                      ? "Item"
                      : "Items"}
                  </div>

                  <button
                    type="button"
                    onClick={addItem}
                    className="group inline-flex items-center gap-2 rounded-xl bg-[#497F70] dark:bg-[#17382F] px-4 py-2.5 text-xs font-extrabold text-white shadow-[0_6px_16px_rgba(73,127,112,0.2)] transition-all hover:bg-[#3D6D60] dark:hover:bg-[#1C322C] hover:shadow-[0_8px_20px_rgba(73,127,112,0.26)] active:scale-[0.98]"
                  >
                    <Plus
                      size={15}
                      className="transition-transform duration-300 group-hover:rotate-90"
                    />
                    Tambah Barang
                  </button>
                </div>
              </div>

              <div className="p-5 lg:p-6">
                <div className="overflow-x-auto rounded-[20px] border border-[#E0E9E4] dark:border-[#3B5446] shadow-[0_4px_18px_rgba(31,59,50,0.025)]">
                  <table className="min-w-[1080px] w-full text-sm">
                    <thead className="bg-[#F7F9F8] dark:bg-[#161D1A]">
                      <tr className="border-b border-[#E1E9E5] dark:border-[#3B5447]">
                        <th className="w-16 px-4 py-3.5 text-center text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#899690] dark:text-[#8DB09F]">
                          No
                        </th>

                        <th className="px-4 py-3.5 text-left text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#899690] dark:text-[#8DB09F]">
                          Barang
                        </th>

                        <th className="w-36 px-4 py-3.5 text-center text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#899690] dark:text-[#8DB09F]">
                          Qty
                        </th>

                        <th className="w-52 px-4 py-3.5 text-right text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#899690] dark:text-[#8DB09F]">
                          Harga Satuan
                        </th>

                        <th className="w-52 px-4 py-3.5 text-right text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#899690] dark:text-[#8DB09F]">
                          Subtotal
                        </th>

                        <th className="w-20 px-4 py-3.5 text-center text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#899690] dark:text-[#8DB09F]">
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

                          const selectedBarang =
                            item.barang ||
                            barangs.find(
                              (barang) =>
                                barang.id ===
                                item.barangId
                            );

                          const warning =
                            priceWarning[
                              index
                            ];

                          const isLoadingPrice =
                            Boolean(
                              loadingPrice[
                                index
                              ]
                            );

                          const lookupStatus =
                            priceLookupStatus[
                              index
                            ];

                          return (
                            <Fragment
                              key={
                                item.id ??
                                `new-${index}`
                              }
                            >
                              <tr
                                className={`group border-b border-[#EDF1EF] dark:border-[#3B5447] transition-all ${
                                  warning
                                    ? "bg-[#FFFDF8] dark:bg-[#1D1B16]"
                                    : "bg-white dark:bg-[#0D1714] hover:bg-[#FCFDFC] dark:hover:bg-[#161D16]"
                                }`}
                              >
                                <td className="px-4 py-5 text-center align-top">
                                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#F2F6F4] dark:bg-[#161D1A] text-[10px] font-extrabold text-[#7F8D87] dark:text-[#8DB0A1]">
                                    {String(
                                      index + 1
                                    ).padStart(
                                      2,
                                      "0"
                                    )}
                                  </span>
                                </td>

                                <td className="px-4 py-5 align-top">
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

                                <td className="px-4 py-5 align-top">
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
                                    className="h-11 w-full rounded-xl border border-[#D8E3DE] dark:border-[#3B5449] bg-[#FBFCFB] dark:bg-[#161D16] px-3 text-center text-sm font-extrabold tabular-nums text-[#30473F] dark:text-[#C5D9D1] outline-none transition-all hover:border-[#C3D4CC] dark:hover:border-[#3B5448] focus:border-[#497F70] dark:focus:border-[#3B6F60] focus:bg-white dark:bg-[#0D1714] focus:ring-4 focus:ring-[#497F70]/10 dark:focus:ring-[#17382F]/10"
                                  />
                                </td>

                                <td className="px-4 py-5 align-top">
                                  <div className="relative">
                                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-[#98A49F] dark:text-[#8DB0A1]">
                                      Rp
                                    </span>

                                    {isLoadingPrice && (
                                      <div className="pointer-events-none absolute right-3.5 top-1/2 z-10 -translate-y-1/2">
                                        <Loader2
                                          size={14}
                                          className="animate-spin text-[#497F70] dark:text-[#79B8A3]"
                                        />
                                      </div>
                                    )}

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
                                      onBlurValue={(
                                        value
                                      ) =>
                                        checkPriceWarning(
                                          index,
                                          item.barangId,
                                          value
                                        )
                                      }
                                      className={`h-11 w-full rounded-xl border bg-[#FBFCFB] dark:bg-[#161D16] pl-9 pr-9 text-right text-sm font-extrabold tabular-nums text-[#30473F] dark:text-[#C5D9D1] outline-none transition-all hover:border-[#C3D4CC] dark:hover:border-[#3B5448] focus:border-[#497F70] dark:focus:border-[#3B6F60] focus:bg-white dark:bg-[#0D1714] focus:ring-4 focus:ring-[#497F70]/10 dark:focus:ring-[#17382F]/10 ${
                                        warning
                                          ? isIncreaseWarning(
                                              warning
                                            )
                                              ? "border-[#E3A28D] dark:border-[#6B3524] bg-[#FFF7F4] dark:bg-[#502211] focus:border-[#C45B3D] dark:focus:border-[#6B3424] focus:ring-[#C45B3D]/10 dark:focus:ring-[#411E14]/10"
                                              : "border-[#9BC8AE] dark:border-[#335C44] bg-[#F4FBF7] dark:bg-[#161D19] focus:border-[#3F8062] dark:focus:border-[#2F6049] focus:ring-[#3F8062]/10 dark:focus:ring-[#1A3629]/10"
                                          : "border-[#D8E3DE] dark:border-[#3B5449]"
                                      }`}
                                    />
                                  </div>

                                  {lookupStatus ===
                                    "success" &&
                                    !isLoadingPrice &&
                                    !warning && (
                                      <div className="mt-2 flex items-center justify-end gap-1.5 text-[9px] font-bold text-[#497F70] dark:text-[#79B8A3]">
                                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#EAF4EF] dark:bg-[#1B3428]">
                                          <Check
                                            size={
                                              9
                                            }
                                          />
                                        </span>

                                        Harga terakhir otomatis
                                      </div>
                                    )}

                                  {lookupStatus ===
                                    "empty" &&
                                    !isLoadingPrice && (
                                      <div className="mt-2 flex items-center justify-end gap-1 text-[9px] font-semibold text-[#A17A28] dark:text-[#DFBF7C]">
                                        <Info
                                          size={
                                            10
                                          }
                                        />

                                        Harga terakhir belum tersedia
                                      </div>
                                    )}

                                  {lookupStatus ===
                                    "error" &&
                                    !isLoadingPrice && (
                                      <div className="mt-2 flex items-center justify-end gap-1 text-[9px] font-semibold text-[#B56752] dark:text-[#C58877]">
                                        <Info
                                          size={
                                            10
                                          }
                                        />

                                        Harga otomatis gagal diambil
                                      </div>
                                    )}

                                  {lookupStatus !==
                                    "success" &&
                                    lookupStatus !==
                                      "empty" &&
                                    lookupStatus !==
                                      "error" &&
                                    !isLoadingPrice &&
                                    item.barangId &&
                                    item.price >
                                      0 && (
                                      <div className="mt-2 flex items-center justify-end gap-1 text-[9px] font-medium text-[#9AA7A2] dark:text-[#8DB0A2]">
                                        <Info
                                          size={
                                            10
                                          }
                                        />
                                        Harga dapat berubah sesuai riwayat pembelian.
                                      </div>
                                    )}
                                </td>

                                <td className="px-4 py-5 text-right align-top">
                                  <div className="rounded-xl bg-[#F8FAF9] dark:bg-[#161D1A] px-3.5 py-2.5">
                                    <div className="text-sm font-extrabold tabular-nums text-[#18352D] dark:text-[#D8E8E2]">
                                      {formatRupiah(
                                        subtotal
                                      )}
                                    </div>

                                    <div className="mt-1 text-[9px] font-medium text-[#9AA7A2] dark:text-[#8DB0A2]">
                                      {formatNumber(
                                        item.qty
                                      )}{" "}
                                      ×{" "}
                                      {formatRupiah(
                                        item.price
                                      )}
                                    </div>
                                  </div>
                                </td>

                                <td className="px-4 py-5 text-center align-top">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeItem(
                                        index
                                      )
                                    }
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#F0DADA] dark:border-[#662929] bg-[#FFF9F9] dark:bg-[#1D1616] text-[#C65D5D] dark:text-[#CD7070] transition-all hover:border-[#E7BABA] dark:hover:border-[#6A2525] hover:bg-[#FFF1F1] dark:hover:bg-[#501111] active:scale-95"
                                    title="Hapus barang"
                                  >
                                    <Trash2
                                      size={15}
                                    />
                                  </button>
                                </td>
                              </tr>

                              {warning && (
                                <tr className="border-b border-[#EEE6D5] dark:border-[#665229] bg-[#FFFDF8] dark:bg-[#1D1B16]">
                                  <td
                                    colSpan={6}
                                    className="px-4 pb-4 pt-0"
                                  >
                                    <PriceWarningPanel
                                      warning={
                                        warning
                                      }
                                    />
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>

                {items.length === 0 && (
                  <div className="mt-4 rounded-2xl border border-[#EAD9A8] dark:border-[#6B5924] bg-[#FFFCF2] dark:bg-[#504111] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF3C8] dark:bg-[#504211] text-[#B88924] dark:text-[#E2C178]">
                        <Sparkles size={16} />
                      </div>

                      <div>
                        <p className="text-xs font-extrabold text-[#80621F] dark:text-[#DFC07C]">
                          Belum ada barang
                        </p>

                        <p className="mt-0.5 text-[10px] leading-5 text-[#9A8655] dark:text-[#BAAA82]">
                          Tambahkan barang untuk mulai
                          menyusun Purchase Order.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={
                          addItem
                        }
                        className="ml-auto hidden rounded-xl bg-[#497F70] dark:bg-[#17382F] px-3 py-2 text-[10px] font-bold text-white sm:inline-flex"
                      >
                        Tambah
                      </button>
                    </div>
                  </div>
                )}

                {/* SUMMARY */}
                <div className="mt-6 grid gap-4 border-t border-[#E8EEEB] dark:border-[#3B5447] pt-6 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EAF3EE] dark:bg-[#1C3226] text-[#497F70] dark:text-[#79B8A3]">
                        <ClipboardList size={14} />
                      </div>

                      <div>
                        <div className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#8D9A95] dark:text-[#8DB0A2]">
                          Ringkasan Pembelian
                        </div>

                        <div className="mt-0.5 text-xs font-semibold text-[#596A63] dark:text-[#9FBCB0]">
                          {items.length}{" "}
                          {items.length ===
                          1
                            ? "item"
                            : "items"}{" "}
                          dalam Purchase Order
                        </div>
                      </div>
                    </div>

                    {warningCount >
                      0 && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#E9DDBE] dark:border-[#6B5724] bg-[#FFFCF3] dark:bg-[#504011] px-3 py-2">
                        <ShieldAlert
                          size={13}
                          className="text-[#B27D1F] dark:text-[#E2BC78]"
                        />

                        <span className="text-[9px] font-bold text-[#80621F] dark:text-[#DFC07C]">
                          {warningCount} item memiliki
                          perubahan harga yang perlu ditinjau.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="relative overflow-hidden rounded-[20px] border border-[#D5E4DD] dark:border-[#385748] bg-gradient-to-br from-[#F7FBF8] dark:from-[#161D18] via-[#F3F9F5] dark:via-[#161D18] to-white dark:to-[#0D1714] px-5 py-4 shadow-[0_8px_25px_rgba(31,59,50,0.045)] sm:min-w-[390px]">
                    <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-[#497F70]/[0.07] dark:bg-[#17382F]/[0.07]" />

                    <div className="relative flex items-center justify-between gap-8">
                      <div>
                        <div className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#84938C] dark:text-[#8DB09F]">
                          Total Purchase
                        </div>

                        <div className="mt-1 text-[10px] text-[#75837D] dark:text-[#8DB0A1]">
                          Nilai keseluruhan PO
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#9AA7A2] dark:text-[#8DB0A2]">
                          Grand Total
                        </div>

                        <div className="mt-0.5 text-2xl font-black tracking-tight text-[#18352D] dark:text-[#D8E8E2]">
                          {formatRupiah(
                            total
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </form>
      </main>

      {/* STICKY ACTION BAR */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#DDE7E2] dark:border-[#3B5447] bg-white/95 dark:bg-[#0D1714]/95 shadow-[0_-10px_35px_rgba(31,59,50,0.09)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 lg:px-8">
          <div className="hidden min-w-0 sm:block">
            {warningCount > 0 ? (
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF3D1] dark:bg-[#504011] text-[#B27D1F] dark:text-[#E2BC78]">
                  <ShieldAlert size={14} />
                </span>

                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#9B7A36] dark:text-[#D5BB86]">
                    Perlu ditinjau
                  </div>

                  <div className="text-xs font-bold text-[#5E5545] dark:text-[#BCB29F]">
                    {warningCount} perubahan harga
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EAF3EE] dark:bg-[#1C3226] text-[#497F70] dark:text-[#79B8A3]">
                  <Check size={14} />
                </span>

                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#8B9993] dark:text-[#8DB0A1]">
                    Siap disimpan
                  </div>

                  <div className="text-xs font-bold text-[#4A5D55] dark:text-[#9FBCB0]">
                    {items.length}{" "}
                    {items.length ===
                    1
                      ? "item"
                      : "items"}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex w-full gap-2 sm:w-auto">
            <Link
              href={`/purchase/${id}`}
              className="flex flex-1 items-center justify-center rounded-xl border border-[#D6E2DD] dark:border-[#3B544A] bg-white dark:bg-[#0D1714] px-5 py-2.5 text-xs font-extrabold text-[#697871] dark:text-[#9FBCAE] transition-all hover:border-[#C3D2CB] dark:hover:border-[#3B5448] hover:bg-[#F5F8F6] dark:hover:bg-[#161D18] hover:text-[#497F70] dark:hover:text-[#79B8A3] sm:flex-none"
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
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#497F70] dark:bg-[#17382F] px-6 py-2.5 text-xs font-extrabold text-white shadow-[0_6px_18px_rgba(73,127,112,0.22)] transition-all hover:bg-[#3D6D60] dark:hover:bg-[#1C322C] hover:shadow-[0_8px_22px_rgba(73,127,112,0.28)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
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

/* =====================================================
   PRICE WARNING HELPER
===================================================== */

function isIncreaseWarning(
  warning: PriceWarning
) {
  return (
    warning.hargaBaru >
    warning.hargaLama
  );
}