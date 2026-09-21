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
      Math.max(rect.width, 420);

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

    const estimatedHeight = 390;

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
            className="overflow-hidden rounded-2xl border border-[#D7E3DE] bg-white shadow-[0_22px_55px_rgba(28,58,48,0.20)]"
          >
            <div className="border-b border-[#E9EFEC] bg-[#F7FAF8] px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#497F70]">
                    Master Barang
                  </div>

                  <div className="mt-0.5 text-[10px] text-[#96A39E]">
                    Pilih barang untuk Purchase Order
                  </div>
                </div>

                <span className="rounded-lg border border-[#DFE9E4] bg-white px-2.5 py-1 text-[10px] font-bold text-[#7D8C85]">
                  {filteredBarangs.length} hasil
                </span>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto p-1.5">
              {filteredBarangs.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F1F5F3] text-[#95A29D]">
                    <Package size={18} />
                  </div>

                  <p className="text-xs font-bold text-[#64736C]">
                    Barang tidak ditemukan
                  </p>

                  <p className="mt-1 text-[10px] text-[#A0ABA6]">
                    Coba gunakan kode atau nama barang lain.
                  </p>
                </div>
              ) : (
                filteredBarangs.map(
                  (barang) => {
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
                          handleSelect(
                            barang
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
                            <span className="rounded-md bg-[#EFF4F1] px-2 py-1 font-mono text-[10px] font-bold text-[#497F70]">
                              {barang.code}
                            </span>

                            {barang.unit && (
                              <span className="text-[10px] font-medium text-[#9AA7A2]">
                                {barang.unit}
                              </span>
                            )}
                          </div>

                          <div className="mt-1.5 truncate text-sm font-bold text-[#29443B]">
                            {barang.name}
                          </div>
                        </div>

                        {selected && (
                          <div className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#497F70] text-white shadow-sm">
                            <Check size={14} />
                          </div>
                        )}
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
            className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[#91A19A]"
          />

          <input
            ref={inputRef}
            type="text"
            value={search}
            onFocus={openDropdown}
            onChange={handleChange}
            placeholder="Cari kode atau nama barang..."
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-[#D8E3DE] bg-[#FBFCFB] pl-10 pr-10 text-sm font-medium text-[#30473F] outline-none transition-all placeholder:text-[#A7B1AD] hover:border-[#C3D4CC] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
          />

          <ChevronDown
            size={15}
            className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#899892] transition-transform ${
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
          className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[#91A19A]"
        />

        <input
          type="text"
          value={search}
          onFocus={() => setOpen(true)}
          onChange={handleChange}
          placeholder="Ketik nama supplier..."
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-[#D8E3DE] bg-[#FBFCFB] pl-10 pr-10 text-sm font-medium text-[#30473F] outline-none transition-all placeholder:text-[#A7B1AD] hover:border-[#C3D4CC] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
        />

        <ChevronDown
          size={15}
          className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#899892] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </div>

      {open && (
        <div className="absolute left-0 top-full z-[100] mt-2 w-full overflow-hidden rounded-2xl border border-[#D7E3DE] bg-white shadow-[0_22px_55px_rgba(28,58,48,0.16)]">
          <div className="border-b border-[#E9EFEC] bg-[#F7FAF8] px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#497F70]">
                  Supplier
                </div>

                <div className="mt-0.5 text-[10px] text-[#96A39E]">
                  Pilih supplier Purchase Order
                </div>
              </div>

              <span className="rounded-lg border border-[#DFE9E4] bg-white px-2.5 py-1 text-[10px] font-bold text-[#7D8C85]">
                {filteredSuppliers.length} hasil
              </span>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {filteredSuppliers.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F1F5F3] text-[#95A29D]">
                  <Package size={18} />
                </div>

                <p className="text-xs font-bold text-[#64736C]">
                  Supplier tidak ditemukan
                </p>

                <p className="mt-1 text-[10px] text-[#A0ABA6]">
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
                          ? "bg-[#EAF4EF]"
                          : "hover:bg-[#F5F8F6]"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EFF4F1] text-[#497F70]">
                          <Package size={14} />
                        </span>

                        <span className="truncate text-sm font-bold text-[#29443B]">
                          {supplier.name}
                        </span>
                      </div>

                      {selected && (
                        <div className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#497F70] text-white shadow-sm">
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
          "border-[#F0CFC5] bg-gradient-to-r from-[#FFF7F4] via-[#FFF9F7] to-white",

        icon:
          "bg-[#FFE7DF] text-[#C45B3D]",

        title:
          "text-[#A9472E]",

        description:
          "text-[#916F65]",

        badge:
          "border border-[#F5C9BC] bg-[#FFE8E1] text-[#B84F32]",

        oldBox:
          "border-[#EBDDD8] bg-white",

        oldLabel:
          "text-[#9C8178]",

        oldPrice:
          "text-[#65534D]",

        arrow:
          "text-[#C7A59A]",

        newBox:
          "border-[#F0C8BC] bg-[#FFF8F5]",

        newLabel:
          "text-[#A36C5B]",

        newPrice:
          "text-[#A9472E]",

        bottom:
          "border-[#F1DDD7] bg-[#FFF9F7]",

        bottomIcon:
          "text-[#B56B55]",

        bottomText:
          "text-[#866A61]",

        bottomStrong:
          "text-[#A9472E]",

        bottomDivider:
          "bg-[#E9CFC6]",

        bottomBadge:
          "bg-[#FFE8E1] text-[#B84F32]",
      }
    : {
        panel:
          "border-[#C8E2D3] bg-gradient-to-r from-[#F3FBF6] via-[#F8FCF9] to-white",

        icon:
          "bg-[#DDF2E5] text-[#3F8062]",

        title:
          "text-[#397258]",

        description:
          "text-[#6C897B]",

        badge:
          "border border-[#BFE0CD] bg-[#DFF3E7] text-[#3C795B]",

        oldBox:
          "border-[#DCE8E1] bg-white",

        oldLabel:
          "text-[#80958B]",

        oldPrice:
          "text-[#4F655C]",

        arrow:
          "text-[#94B5A4]",

        newBox:
          "border-[#BFDCCB] bg-[#F5FBF7]",

        newLabel:
          "text-[#648977]",

        newPrice:
          "text-[#397258]",

        bottom:
          "border-[#D5E8DD] bg-[#F8FCF9]",

        bottomIcon:
          "text-[#4D8469]",

        bottomText:
          "text-[#698276]",

        bottomStrong:
          "text-[#397258]",

        bottomDivider:
          "bg-[#CDE2D5]",

        bottomBadge:
          "bg-[#DFF3E7] text-[#3C795B]",
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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(73,127,112,0.08),transparent_28%),#F3F6F4]">
        <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-2xl bg-[#DCE7E2]" />

            <div className="space-y-2">
              <div className="h-3 w-28 animate-pulse rounded bg-[#DCE7E2]" />

              <div className="h-6 w-52 animate-pulse rounded-lg bg-[#DCE7E2]" />
            </div>
          </div>

          <div className="space-y-5">
            <div className="h-64 animate-pulse rounded-[24px] border border-[#DDE7E2] bg-white shadow-sm" />

            <div className="h-[520px] animate-pulse rounded-[24px] border border-[#DDE7E2] bg-white shadow-sm" />
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
          <div className="rounded-[24px] border border-[#DDE7E2] bg-white p-10 text-center shadow-[0_12px_40px_rgba(31,59,50,0.06)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#F1F5F3] text-[#8A9892]">
              <FileText size={24} />
            </div>

            <h1 className="mt-5 text-xl font-extrabold tracking-tight text-[#18352D]">
              Purchase Order tidak ditemukan
            </h1>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#84918C]">
              Data Purchase Order yang diminta
              tidak tersedia atau sudah tidak dapat
              diakses.
            </p>

            <Link
              href="/purchase"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-5 py-3 text-xs font-bold text-white shadow-[0_6px_18px_rgba(73,127,112,0.2)] transition-all hover:bg-[#3D6D60]"
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
          <div className="overflow-hidden rounded-[24px] border border-[#E6D5D5] bg-white shadow-[0_12px_40px_rgba(80,40,40,0.06)]">
            <div className="border-b border-[#F0E2E2] bg-gradient-to-r from-[#FFF8F8] to-white px-6 py-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDECEC] text-[#C85C5C]">
                  <LockKeyhole size={20} />
                </div>

                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#B06A6A]">
                    Editing Locked
                  </div>

                  <h1 className="mt-1 text-xl font-extrabold tracking-tight text-[#6B3030]">
                    Purchase Order tidak dapat diedit
                  </h1>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm leading-6 text-[#725454]">
                Purchase Order{" "}
                <strong className="font-bold text-[#5E3535]">
                  {purchase.number}
                </strong>{" "}
                sudah berstatus{" "}
                <span className="rounded-lg bg-[#F8EEEE] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#A54F4F]">
                  {purchase.status}
                </span>
                .
              </p>

              <div className="mt-6">
                <Link
                  href={`/purchase/${id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-5 py-3 text-xs font-bold text-white shadow-[0_6px_18px_rgba(73,127,112,0.2)] transition hover:bg-[#3D6D60]"
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(73,127,112,0.07),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(24,53,45,0.035),transparent_25%),#F3F6F4] text-[#18352D]">
      <div className="fixed inset-x-0 top-0 z-[60] h-[2px] bg-gradient-to-r from-transparent via-[#497F70] to-transparent" />

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-[#DDE7E2] bg-white/95 shadow-[0_4px_24px_rgba(31,59,50,0.045)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 py-4 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href={`/purchase/${id}`}
                className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D6E2DD] bg-white text-[#687871] shadow-sm transition-all hover:border-[#BFD1C9] hover:bg-[#F4F8F6] hover:text-[#497F70]"
                title="Kembali"
              >
                <ArrowLeft
                  size={17}
                  className="transition-transform group-hover:-translate-x-0.5"
                />
              </Link>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="hidden text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#497F70] sm:inline">
                    Procurement
                  </span>

                  <span className="hidden text-[#C5D0CB] sm:inline">
                    /
                  </span>

                  <span className="truncate text-[10px] font-medium text-[#8D9A95] sm:text-xs">
                    Edit Purchase Order
                  </span>
                </div>

                <div className="mt-0.5 flex items-center gap-2.5">
                  <h1 className="truncate text-lg font-extrabold tracking-tight text-[#18352D] sm:text-xl">
                    {purchase.number}
                  </h1>

                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9EAE1] bg-[#EDF7F1] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#497F70]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#497F70] shadow-[0_0_0_3px_rgba(73,127,112,0.12)]" />
                    Draft
                  </span>
                </div>
              </div>
            </div>

            <Link
              href={`/purchase/${id}`}
              className="hidden items-center gap-2 rounded-xl border border-[#D6E2DD] bg-white px-4 py-2.5 text-xs font-bold text-[#667770] shadow-sm transition hover:border-[#C3D2CB] hover:bg-[#F6F9F7] hover:text-[#497F70] md:inline-flex"
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
            <section className="overflow-visible rounded-[24px] border border-[#DDE7E2] bg-white shadow-[0_10px_35px_rgba(31,59,50,0.055)]">
              <div className="flex items-center justify-between border-b border-[#E8EEEB] bg-gradient-to-r from-white via-white to-[#F8FBF9] px-5 py-5 lg:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF3EE] text-[#497F70] shadow-[inset_0_0_0_1px_rgba(73,127,112,0.06)]">
                    <ClipboardList size={18} />
                  </div>

                  <div>
                    <h2 className="text-sm font-extrabold tracking-tight text-[#18352D]">
                      Informasi Purchase Order
                    </h2>

                    <p className="mt-0.5 text-[11px] text-[#899690]">
                      Informasi utama dokumen pembelian.
                    </p>
                  </div>
                </div>

                <div className="hidden items-center gap-2 rounded-xl border border-[#E2EBE6] bg-[#F8FAF9] px-3 py-2 sm:flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />

                  <span className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#718079]">
                    Editable Draft
                  </span>
                </div>
              </div>

              <div className="p-5 lg:p-6">
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                  {/* PO NUMBER */}
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#687871]">
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
                        className="h-11 w-full rounded-xl border border-[#E0E7E4] bg-[#F5F7F6] pl-10 pr-3 text-sm font-bold text-[#7A8782] outline-none"
                      />
                    </div>
                  </div>

                  {/* SUPPLIER */}
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#687871]">
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
                    <label className="mb-2 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#687871]">
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
                        value={
                          paymentMethod
                        }
                        onChange={(e) =>
                          setPaymentMethod(
                            e.target.value
                          )
                        }
                        required
                        className="h-11 w-full appearance-none rounded-xl border border-[#D8E3DE] bg-[#FBFCFB] pl-10 pr-10 text-sm font-medium text-[#30473F] outline-none transition-all hover:border-[#C3D4CC] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
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
                    <label className="mb-2 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#687871]">
                      Status Dokumen
                    </label>

                    <div className="flex h-11 items-center gap-2.5 rounded-xl border border-[#DDE8E2] bg-[#F7FAF8] px-3.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E6F1EB] text-[#497F70]">
                        <Check size={14} />
                      </span>

                      <div>
                        <div className="text-xs font-extrabold text-[#3D6256]">
                          DRAFT
                        </div>

                        <div className="text-[9px] text-[#8B9893]">
                          Dapat diedit
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* REMARKS */}
                  <div className="lg:col-span-4">
                    <label className="mb-2 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#687871]">
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
                        className="w-full resize-none rounded-xl border border-[#D8E3DE] bg-[#FBFCFB] px-10 py-3 text-sm leading-6 text-[#30473F] outline-none transition-all placeholder:text-[#A3ADA9] hover:border-[#C3D4CC] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ITEMS */}
            <section className="overflow-visible rounded-[24px] border border-[#DDE7E2] bg-white shadow-[0_10px_35px_rgba(31,59,50,0.055)]">
              <div className="flex flex-col gap-4 border-b border-[#E8EEEB] bg-gradient-to-r from-white via-white to-[#F8FBF9] px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF3EE] text-[#497F70]">
                    <Package size={18} />
                  </div>

                  <div>
                    <h2 className="text-sm font-extrabold tracking-tight text-[#18352D]">
                      Detail Barang
                    </h2>

                    <p className="mt-0.5 text-[11px] text-[#899690]">
                      Kelola barang, qty, dan harga pembelian.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {warningCount > 0 && (
                    <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#E9DDBE] bg-[#FFFCF3] px-3 py-2 text-[9px] font-extrabold text-[#8A6A28]">
                      <ShieldAlert size={12} />
                      {warningCount} harga perlu ditinjau
                    </div>
                  )}

                  <div className="rounded-xl border border-[#E2EAE6] bg-[#F8FAF9] px-3 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#718079]">
                    {items.length}{" "}
                    {items.length === 1
                      ? "Item"
                      : "Items"}
                  </div>

                  <button
                    type="button"
                    onClick={addItem}
                    className="group inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-xs font-extrabold text-white shadow-[0_6px_16px_rgba(73,127,112,0.2)] transition-all hover:bg-[#3D6D60] hover:shadow-[0_8px_20px_rgba(73,127,112,0.26)] active:scale-[0.98]"
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
                <div className="overflow-x-auto rounded-[20px] border border-[#E0E9E4] shadow-[0_4px_18px_rgba(31,59,50,0.025)]">
                  <table className="min-w-[1080px] w-full text-sm">
                    <thead className="bg-[#F7F9F8]">
                      <tr className="border-b border-[#E1E9E5]">
                        <th className="w-16 px-4 py-3.5 text-center text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#899690]">
                          No
                        </th>

                        <th className="px-4 py-3.5 text-left text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#899690]">
                          Barang
                        </th>

                        <th className="w-36 px-4 py-3.5 text-center text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#899690]">
                          Qty
                        </th>

                        <th className="w-52 px-4 py-3.5 text-right text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#899690]">
                          Harga Satuan
                        </th>

                        <th className="w-52 px-4 py-3.5 text-right text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#899690]">
                          Subtotal
                        </th>

                        <th className="w-20 px-4 py-3.5 text-center text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#899690]">
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
                                className={`group border-b border-[#EDF1EF] transition-all ${
                                  warning
                                    ? "bg-[#FFFDF8]"
                                    : "bg-white hover:bg-[#FCFDFC]"
                                }`}
                              >
                                <td className="px-4 py-5 text-center align-top">
                                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#F2F6F4] text-[10px] font-extrabold text-[#7F8D87]">
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
                                    className="h-11 w-full rounded-xl border border-[#D8E3DE] bg-[#FBFCFB] px-3 text-center text-sm font-extrabold tabular-nums text-[#30473F] outline-none transition-all hover:border-[#C3D4CC] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                                  />
                                </td>

                                <td className="px-4 py-5 align-top">
                                  <div className="relative">
                                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-[#98A49F]">
                                      Rp
                                    </span>

                                    {isLoadingPrice && (
                                      <div className="pointer-events-none absolute right-3.5 top-1/2 z-10 -translate-y-1/2">
                                        <Loader2
                                          size={14}
                                          className="animate-spin text-[#497F70]"
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
                                      className={`h-11 w-full rounded-xl border bg-[#FBFCFB] pl-9 pr-9 text-right text-sm font-extrabold tabular-nums text-[#30473F] outline-none transition-all hover:border-[#C3D4CC] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10 ${
                                        warning
                                          ? isIncreaseWarning(
                                              warning
                                            )
                                              ? "border-[#E3A28D] bg-[#FFF7F4] focus:border-[#C45B3D] focus:ring-[#C45B3D]/10"
                                              : "border-[#9BC8AE] bg-[#F4FBF7] focus:border-[#3F8062] focus:ring-[#3F8062]/10"
                                          : "border-[#D8E3DE]"
                                      }`}
                                    />
                                  </div>

                                  {lookupStatus ===
                                    "success" &&
                                    !isLoadingPrice &&
                                    !warning && (
                                      <div className="mt-2 flex items-center justify-end gap-1.5 text-[9px] font-bold text-[#497F70]">
                                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#EAF4EF]">
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
                                      <div className="mt-2 flex items-center justify-end gap-1 text-[9px] font-semibold text-[#A17A28]">
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
                                      <div className="mt-2 flex items-center justify-end gap-1 text-[9px] font-semibold text-[#B56752]">
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
                                      <div className="mt-2 flex items-center justify-end gap-1 text-[9px] font-medium text-[#9AA7A2]">
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
                                  <div className="rounded-xl bg-[#F8FAF9] px-3.5 py-2.5">
                                    <div className="text-sm font-extrabold tabular-nums text-[#18352D]">
                                      {formatRupiah(
                                        subtotal
                                      )}
                                    </div>

                                    <div className="mt-1 text-[9px] font-medium text-[#9AA7A2]">
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
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#F0DADA] bg-[#FFF9F9] text-[#C65D5D] transition-all hover:border-[#E7BABA] hover:bg-[#FFF1F1] active:scale-95"
                                    title="Hapus barang"
                                  >
                                    <Trash2
                                      size={15}
                                    />
                                  </button>
                                </td>
                              </tr>

                              {warning && (
                                <tr className="border-b border-[#EEE6D5] bg-[#FFFDF8]">
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
                  <div className="mt-4 rounded-2xl border border-[#EAD9A8] bg-[#FFFCF2] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF3C8] text-[#B88924]">
                        <Sparkles size={16} />
                      </div>

                      <div>
                        <p className="text-xs font-extrabold text-[#80621F]">
                          Belum ada barang
                        </p>

                        <p className="mt-0.5 text-[10px] leading-5 text-[#9A8655]">
                          Tambahkan barang untuk mulai
                          menyusun Purchase Order.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={
                          addItem
                        }
                        className="ml-auto hidden rounded-xl bg-[#497F70] px-3 py-2 text-[10px] font-bold text-white sm:inline-flex"
                      >
                        Tambah
                      </button>
                    </div>
                  </div>
                )}

                {/* SUMMARY */}
                <div className="mt-6 grid gap-4 border-t border-[#E8EEEB] pt-6 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EAF3EE] text-[#497F70]">
                        <ClipboardList size={14} />
                      </div>

                      <div>
                        <div className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#8D9A95]">
                          Ringkasan Pembelian
                        </div>

                        <div className="mt-0.5 text-xs font-semibold text-[#596A63]">
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
                      <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#E9DDBE] bg-[#FFFCF3] px-3 py-2">
                        <ShieldAlert
                          size={13}
                          className="text-[#B27D1F]"
                        />

                        <span className="text-[9px] font-bold text-[#80621F]">
                          {warningCount} item memiliki
                          perubahan harga yang perlu ditinjau.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="relative overflow-hidden rounded-[20px] border border-[#D5E4DD] bg-gradient-to-br from-[#F7FBF8] via-[#F3F9F5] to-white px-5 py-4 shadow-[0_8px_25px_rgba(31,59,50,0.045)] sm:min-w-[390px]">
                    <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-[#497F70]/[0.07]" />

                    <div className="relative flex items-center justify-between gap-8">
                      <div>
                        <div className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#84938C]">
                          Total Purchase
                        </div>

                        <div className="mt-1 text-[10px] text-[#75837D]">
                          Nilai keseluruhan PO
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#9AA7A2]">
                          Grand Total
                        </div>

                        <div className="mt-0.5 text-2xl font-black tracking-tight text-[#18352D]">
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
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#DDE7E2] bg-white/95 shadow-[0_-10px_35px_rgba(31,59,50,0.09)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 lg:px-8">
          <div className="hidden min-w-0 sm:block">
            {warningCount > 0 ? (
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF3D1] text-[#B27D1F]">
                  <ShieldAlert size={14} />
                </span>

                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#9B7A36]">
                    Perlu ditinjau
                  </div>

                  <div className="text-xs font-bold text-[#5E5545]">
                    {warningCount} perubahan harga
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EAF3EE] text-[#497F70]">
                  <Check size={14} />
                </span>

                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#8B9993]">
                    Siap disimpan
                  </div>

                  <div className="text-xs font-bold text-[#4A5D55]">
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
              className="flex flex-1 items-center justify-center rounded-xl border border-[#D6E2DD] bg-white px-5 py-2.5 text-xs font-extrabold text-[#697871] transition-all hover:border-[#C3D2CB] hover:bg-[#F5F8F6] hover:text-[#497F70] sm:flex-none"
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
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#497F70] px-6 py-2.5 text-xs font-extrabold text-white shadow-[0_6px_18px_rgba(73,127,112,0.22)] transition-all hover:bg-[#3D6D60] hover:shadow-[0_8px_22px_rgba(73,127,112,0.28)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
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