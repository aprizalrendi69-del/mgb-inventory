"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  Package,
  Plus,
  RefreshCw,
  Search,
  Warehouse,
  Upload,
  FileSpreadsheet,
  Download,
  X,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Trash2,
  CircleDot,
  ChevronDown,
  Check,
  MapPin,
  Boxes,
  FileCheck2,
  RotateCcw,
} from "lucide-react";

import * as XLSX from "xlsx";

// =====================================================
// TYPE
// =====================================================

type Outlet = {
  id: number;
  code: string;
  name: string;
  active?: boolean;
};

type Barang = {
  id: number;
  code: string;
  name: string;
  unit: string;
  stock?: number;
  purchasePrice?: number;
  sellingPrice?: number;
  minimumStock?: number;
  active?: boolean;
  source?: string;
};

type OutletStock = {
  id: number;
  outletId: number;
  barangId: number;
  stock: number;
  minimumStock: number;
  averageCost: number;
  updatedAt?: string;

  outlet: Outlet;

  barang: Barang;
};

type ImportStatus =
  | "READY"
  | "UPDATE"
  | "ERROR"
  | "DONE"
  | "FAILED";

type ImportRow = {
  outletCode: string;
  outletName?: string;

  barangCode: string;
  barangName?: string;

  qty: number;
  averageCost: number;
  minimumStock: number;

  status: ImportStatus;

  message?: string;

  existingId?: number;
};

type SearchableOption = {
  id: number;
  code: string;
  name: string;
  extra?: string;
};

// =====================================================
// SEARCHABLE SELECT
// =====================================================

function SearchableSelect({
  value,
  options,
  placeholder,
  searchPlaceholder,
  onChange,
  disabled = false,
  icon,
}: {
  value: string;
  options: SearchableOption[];
  placeholder: string;
  searchPlaceholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const inputRef =
    useRef<HTMLInputElement | null>(null);

  const [open, setOpen] =
    useState(false);

  const [keyword, setKeyword] =
    useState("");

  const selected =
    options.find(
      (item) =>
        String(item.id) === value
    ) ?? null;

  const filteredOptions =
    options.filter((item) => {
      const searchText =
        `${item.code} ${item.name} ${item.extra ?? ""}`
          .toLowerCase();

      return searchText.includes(
        keyword.trim().toLowerCase()
      );
    });

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);

        if (!selected) {
          setKeyword("");
        }
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, [selected]);

  function selectOption(
    option: SearchableOption
  ) {
    onChange(String(option.id));
    setKeyword("");
    setOpen(false);
  }

  function clearSelection() {
    onChange("");
    setKeyword("");
    setOpen(false);
  }

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <div
        className={`
          relative flex min-h-[48px] w-full
          items-center rounded-xl border
          bg-[#FAFCFB]
          transition
          ${
            open
              ? "border-[#497F70] bg-white ring-2 ring-[#497F70]/10"
              : "border-[#D5E5DC]"
          }
          ${
            disabled
              ? "cursor-not-allowed opacity-60"
              : "cursor-text"
          }
        `}
        onClick={() => {
          if (disabled) return;

          setOpen(true);

          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
        }}
      >
        {icon && (
          <div className="ml-3 shrink-0 text-[#497F70]">
            {icon}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {open ? (
            <input
              ref={inputRef}
              value={keyword}
              onChange={(event) =>
                setKeyword(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Escape"
                ) {
                  setOpen(false);
                  setKeyword("");
                }

                if (
                  event.key ===
                    "Enter" &&
                  filteredOptions.length ===
                    1
                ) {
                  event.preventDefault();

                  selectOption(
                    filteredOptions[0]
                  );
                }
              }}
              placeholder={
                searchPlaceholder
              }
              className="
                w-full
                bg-transparent
                px-3
                py-3
                text-sm
                text-[#18352D]
                outline-none
                placeholder:text-gray-400
              "
              autoFocus
            />
          ) : (
            <div className="px-3 py-3">
              {selected ? (
                <>
                  <div className="truncate text-sm font-semibold text-[#18352D]">
                    {selected.code} -{" "}
                    {selected.name}
                  </div>

                  {selected.extra && (
                    <div className="mt-0.5 truncate text-[11px] text-gray-400">
                      {selected.extra}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-sm text-gray-400">
                  {placeholder}
                </span>
              )}
            </div>
          )}
        </div>

        {selected && !open && !disabled && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              clearSelection();
            }}
            className="
              mr-1
              rounded-lg
              p-1.5
              text-gray-400
              hover:bg-gray-100
              hover:text-gray-600
            "
            title="Hapus pilihan"
          >
            <X size={15} />
          </button>
        )}

        <ChevronDown
          size={17}
          className={`
            mr-3
            shrink-0
            text-gray-400
            transition-transform
            ${open ? "rotate-180" : ""}
          `}
        />
      </div>

      {open && !disabled && (
        <div
          className="
            absolute
            left-0
            right-0
            z-[70]
            mt-2
            overflow-hidden
            rounded-xl
            border
            border-[#DDE9E4]
            bg-white
            shadow-xl
          "
        >
          <div className="border-b border-[#EDF2EF] bg-[#FAFCFB] px-4 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Pilih data
              </span>

              <span className="text-[11px] text-gray-400">
                {filteredOptions.length} hasil
              </span>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {filteredOptions.length ===
            0 ? (
              <div className="px-4 py-8 text-center">
                <Search
                  size={22}
                  className="mx-auto mb-2 text-gray-300"
                />

                <p className="text-sm font-semibold text-gray-500">
                  Data tidak ditemukan
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Coba cari dengan kode atau nama
                </p>
              </div>
            ) : (
              filteredOptions.map(
                (option) => {
                  const isSelected =
                    String(
                      option.id
                    ) === value;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        selectOption(
                          option
                        )
                      }
                      className={`
                        flex
                        w-full
                        items-center
                        gap-3
                        px-4
                        py-3
                        text-left
                        transition
                        ${
                          isSelected
                            ? "bg-[#EAF3EF]"
                            : "hover:bg-[#F7FAF8]"
                        }
                      `}
                    >
                      <div
                        className={`
                          flex
                          h-9
                          w-9
                          shrink-0
                          items-center
                          justify-center
                          rounded-lg
                          ${
                            isSelected
                              ? "bg-[#497F70] text-white"
                              : "bg-[#F0F5F2] text-[#497F70]"
                          }
                        `}
                      >
                        {isSelected ? (
                          <Check
                            size={16}
                          />
                        ) : (
                          <CircleDot
                            size={16}
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-[#18352D]">
                          {option.code}{" "}
                          -{" "}
                          {option.name}
                        </div>

                        {option.extra && (
                          <div className="mt-0.5 truncate text-[11px] text-gray-400">
                            {
                              option.extra
                            }
                          </div>
                        )}
                      </div>
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

// =====================================================
// COMPONENT
// =====================================================

export default function StockAwalOutletPage() {
  // ===================================================
  // MASTER
  // ===================================================

  const [outlets, setOutlets] =
    useState<Outlet[]>([]);

  const [barang, setBarang] =
    useState<Barang[]>([]);

  const [stocks, setStocks] =
    useState<OutletStock[]>([]);

  // Snapshot seluruh stock untuk kebutuhan
  // validasi/import.
  const [
    importStockSnapshot,
    setImportStockSnapshot,
  ] = useState<OutletStock[]>([]);

  // ===================================================
  // FORM
  // ===================================================

  const [outletId, setOutletId] =
    useState("");

  const [barangId, setBarangId] =
    useState("");

  const [qty, setQty] =
    useState("");

  const [averageCost, setAverageCost] =
    useState("");

  const [minimumStock, setMinimumStock] =
    useState("");

  // ===================================================
  // FILTER
  // ===================================================

  const [search, setSearch] =
    useState("");

  // ===================================================
  // LOADING
  // ===================================================

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  // ===================================================
  // EDIT
  // ===================================================

  const [editingId, setEditingId] =
    useState<number | null>(null);

  // ===================================================
  // IMPORT
  // ===================================================

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [showImport, setShowImport] =
    useState(false);

  const [importRows, setImportRows] =
    useState<ImportRow[]>([]);

  const [importing, setImporting] =
    useState(false);

  const [selectedFileName, setSelectedFileName] =
    useState("");

  // ===================================================
  // LOAD OUTLET
  // ===================================================

  async function loadOutlets() {
    try {
      const res = await fetch(
        "/api/outlet",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json?.message ||
            "Gagal mengambil data outlet"
        );
      }

      const data = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
        ? json.data
        : [];

      setOutlets(data);
    } catch (error) {
      console.error(
        "LOAD OUTLET ERROR:",
        error
      );

      setOutlets([]);
    }
  }

  // ===================================================
  // LOAD BARANG
  // ===================================================

  async function loadBarang() {
    try {
      const res = await fetch(
        "/api/barang",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json?.message ||
            "Gagal mengambil data barang"
        );
      }

      const data = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
        ? json.data
        : [];

      setBarang(data);
    } catch (error) {
      console.error(
        "LOAD BARANG ERROR:",
        error
      );

      setBarang([]);
    }
  }

  // ===================================================
  // LOAD STOCK
  // ===================================================

  async function loadStock(
    selectedOutlet = outletId
  ) {
    try {
      setLoading(true);

      const url = selectedOutlet
        ? `/api/outlet/stock-awal?outletId=${selectedOutlet}`
        : "/api/outlet/stock-awal";

      const res = await fetch(url, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json?.message ||
            "Gagal mengambil stock outlet"
        );
      }

      setStocks(
        Array.isArray(json.data)
          ? json.data
          : []
      );
    } catch (error) {
      console.error(
        "LOAD STOCK ERROR:",
        error
      );

      setStocks([]);
    } finally {
      setLoading(false);
    }
  }

  // ===================================================
  // LOAD ALL STOCK FOR IMPORT
  // ===================================================

  async function loadAllStockForImport() {
    try {
      const res = await fetch(
        "/api/outlet/stock-awal",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json?.message ||
            "Gagal mengambil stock outlet"
        );
      }

      const data =
        Array.isArray(json.data)
          ? json.data
          : [];

      setImportStockSnapshot(data);

      return data;
    } catch (error) {
      console.error(
        "LOAD ALL STOCK FOR IMPORT ERROR:",
        error
      );

      setImportStockSnapshot([]);

      return [];
    }
  }

  // ===================================================
  // INITIAL
  // ===================================================

  useEffect(() => {
    loadOutlets();
    loadBarang();
    loadStock("");
    loadAllStockForImport();
  }, []);

  // ===================================================
  // PILIH BARANG
  // ===================================================

  function handleBarangChange(
    value: string
  ) {
    setBarangId(value);

    const selected = barang.find(
      (item) =>
        String(item.id) === value
    );

    if (!selected) {
      setAverageCost("");
      setMinimumStock("");
      return;
    }

    setAverageCost(
      String(
        selected.purchasePrice ?? 0
      )
    );

    setMinimumStock(
      String(
        selected.minimumStock ?? 0
      )
    );
  }

  // ===================================================
  // RESET FORM
  // ===================================================

  function resetForm() {
    setEditingId(null);

    setBarangId("");
    setQty("");
    setAverageCost("");
    setMinimumStock("");
  }

  // ===================================================
  // EDIT
  // ===================================================

  function mulaiEdit(
    item: OutletStock
  ) {
    setEditingId(item.id);

    setOutletId(
      String(item.outlet.id)
    );

    setBarangId(
      String(item.barang.id)
    );

    setQty(
      String(item.stock ?? 0)
    );

    setAverageCost(
      String(
        item.averageCost ?? 0
      )
    );

    setMinimumStock(
      String(
        item.minimumStock ?? 0
      )
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // ===================================================
  // SIMPAN / UPDATE MANUAL
  // ===================================================

  async function simpan() {
    if (!outletId) {
      alert(
        "Pilih outlet terlebih dahulu"
      );
      return;
    }

    if (!barangId) {
      alert(
        "Pilih barang terlebih dahulu"
      );
      return;
    }

    const jumlah = Number(qty);

    if (
      !Number.isFinite(jumlah) ||
      jumlah < 0
    ) {
      alert(
        "Qty stock awal tidak valid"
      );
      return;
    }

    const harga =
      Number(averageCost) || 0;

    const minimum =
      Number(minimumStock) || 0;

    if (harga < 0) {
      alert(
        "Harga modal tidak boleh negatif"
      );
      return;
    }

    if (minimum < 0) {
      alert(
        "Minimum stock tidak boleh negatif"
      );
      return;
    }

    try {
      setSaving(true);

      const body = {
        outletId: Number(outletId),
        barangId: Number(barangId),
        qty: jumlah,
        averageCost: harga,
        minimumStock: minimum,
      };

      const res = await fetch(
        "/api/outlet/stock-awal",
        {
          method: editingId
            ? "PUT"
            : "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            editingId
              ? {
                  id: editingId,
                  ...body,
                }
              : body
          ),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        alert(
          json?.message ||
            "Gagal menyimpan stock awal"
        );

        return;
      }

      alert(
        editingId
          ? "Stock outlet berhasil diperbarui"
          : "Stock awal outlet berhasil disimpan"
      );

      resetForm();

      await loadStock(outletId);
      await loadAllStockForImport();
    } catch (error) {
      console.error(
        "SIMPAN STOCK AWAL ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menyimpan stock awal"
      );
    } finally {
      setSaving(false);
    }
  }

  // ===================================================
  // HAPUS
  // ===================================================

  async function hapusStock(
    item: OutletStock
  ) {
    const yakin = confirm(
      `Hapus stock awal "${item.barang.name}" dari ${item.outlet.name}?`
    );

    if (!yakin) return;

    try {
      const res = await fetch(
        `/api/outlet/stock-awal?id=${item.id}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        alert(
          json?.message ||
            "Gagal menghapus stock outlet"
        );

        return;
      }

      if (
        editingId === item.id
      ) {
        resetForm();
      }

      await loadStock(outletId);
      await loadAllStockForImport();

      alert(
        "Stock outlet berhasil dihapus"
      );
    } catch (error) {
      console.error(
        "HAPUS STOCK ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menghapus stock"
      );
    }
  }

  // ===================================================
  // BUKA IMPORT
  // ===================================================

  function bukaImport() {
    setImportRows([]);
    setSelectedFileName("");
    setShowImport(true);

    loadAllStockForImport();
  }

  // ===================================================
  // TUTUP IMPORT
  // ===================================================

  function tutupImport() {
    if (importing) return;

    setShowImport(false);
    setImportRows([]);
    setSelectedFileName("");
  }

  // ===================================================
  // NORMALISASI HEADER
  // ===================================================

  function normalizeHeader(
    value: unknown
  ) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/_/g, "")
      .replace(/-/g, "");
  }

  // ===================================================
  // AMBIL CELL
  // ===================================================

  function getCell(
    row: Record<string, any>,
    names: string[]
  ) {
    const keys = Object.keys(row);

    const normalizedNames =
      names.map(normalizeHeader);

    const key = keys.find(
      (item) =>
        normalizedNames.includes(
          normalizeHeader(item)
        )
    );

    return key !== undefined
      ? row[key]
      : undefined;
  }

  // ===================================================
  // PARSE ANGKA EXCEL
  // ===================================================

  function parseExcelNumber(
    value: any
  ): number {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return 0;
    }

    if (
      typeof value === "number"
    ) {
      return Number.isFinite(value)
        ? value
        : 0;
    }

    let text =
      String(value).trim();

    if (!text) return 0;

    text = text
      .replace(/\s/g, "")
      .replace(/Rp/gi, "");

    if (
      text.includes(".") &&
      text.includes(",")
    ) {
      const lastDot =
        text.lastIndexOf(".");

      const lastComma =
        text.lastIndexOf(",");

      if (lastComma > lastDot) {
        text = text
          .replace(/\./g, "")
          .replace(",", ".");
      } else {
        text = text.replace(
          /,/g,
          ""
        );
      }
    } else if (
      text.includes(",")
    ) {
      text = text.replace(
        ",",
        "."
      );
    }

    const parsed =
      Number(text);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  // ===================================================
  // CARI EXISTING STOCK
  // ===================================================

  function findExistingStock(
    stockData: OutletStock[],
    outlet: Outlet,
    selectedBarang: Barang
  ) {
    return stockData.find(
      (item) =>
        item.outletId ===
          outlet.id &&
        item.barangId ===
          selectedBarang.id
    );
  }

  // ===================================================
  // HANDLE EXCEL
  // ===================================================

  async function handleExcel(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    try {
      setSelectedFileName(
        file.name
      );

      /*
       * Selalu refresh seluruh stock sebelum
       * melakukan preview import.
       *
       * Ini penting karena halaman bisa sedang
       * difilter hanya ke satu outlet.
       */
      const currentStock =
        await loadAllStockForImport();

      const buffer =
        await file.arrayBuffer();

      const workbook =
        XLSX.read(buffer, {
          type: "array",
        });

      if (
        !workbook.SheetNames.length
      ) {
        alert(
          "File Excel tidak memiliki sheet"
        );

        return;
      }

      const sheetName =
        workbook.SheetNames[0];

      const worksheet =
        workbook.Sheets[
          sheetName
        ];

      const rawRows =
        XLSX.utils.sheet_to_json<
          Record<string, any>
        >(worksheet, {
          defval: "",
        });

      if (!rawRows.length) {
        alert(
          "File Excel tidak memiliki data"
        );

        return;
      }

      /*
       * Dipakai untuk mendeteksi duplikat
       * dalam file Excel itu sendiri.
       *
       * Contoh:
       *
       * CUST001 + BRG001
       * CUST001 + BRG001
       *
       * Baris kedua ERROR.
       */
      const importedKeys =
        new Set<string>();

      const result: ImportRow[] =
        rawRows.map((row) => {
          // ==========================================
          // OUTLET
          // ==========================================

          const outletCode =
            String(
              getCell(row, [
                "outletcode",
                "kodeoutlet",
                "outlet",
              ]) ?? ""
            ).trim();

          const outletName =
            String(
              getCell(row, [
                "outletname",
                "namaoutlet",
              ]) ?? ""
            ).trim();

          // ==========================================
          // BARANG
          // ==========================================

          const barangCode =
            String(
              getCell(row, [
                "barangcode",
                "kodebarang",
                "kode",
                "code",
              ]) ?? ""
            ).trim();

          const barangName =
            String(
              getCell(row, [
                "barangname",
                "namabarang",
                "nama",
              ]) ?? ""
            ).trim();

          // ==========================================
          // QTY
          // ==========================================

          const qtyValue =
            getCell(row, [
              "qty",
              "qtyawal",
              "stockawal",
              "jumlah",
              "stock",
            ]);

          // ==========================================
          // HARGA MODAL
          // ==========================================

          const averageCostValue =
            getCell(row, [
              "averagecost",
              "hargamodal",
              "hargabeli",
              "harga",
              "hpp",
            ]);

          // ==========================================
          // MINIMUM STOCK
          // ==========================================

          const minimumStockValue =
            getCell(row, [
              "minimumstock",
              "minstock",
              "stokminimum",
            ]);

          const parsedQty =
            parseExcelNumber(
              qtyValue
            );

          const parsedCost =
            parseExcelNumber(
              averageCostValue
            );

          const parsedMinimum =
            parseExcelNumber(
              minimumStockValue
            );

          // ==========================================
          // VALIDASI OUTLET
          // ==========================================

          if (!outletCode) {
            return {
              outletCode,
              outletName,
              barangCode,
              barangName,
              qty: parsedQty,
              averageCost:
                parsedCost,
              minimumStock:
                parsedMinimum,
              status: "ERROR",
              message:
                "Kode outlet kosong",
            };
          }

          // ==========================================
          // VALIDASI BARANG
          // ==========================================

          if (!barangCode) {
            return {
              outletCode,
              outletName,
              barangCode,
              barangName,
              qty: parsedQty,
              averageCost:
                parsedCost,
              minimumStock:
                parsedMinimum,
              status: "ERROR",
              message:
                "Kode barang kosong",
            };
          }

          // ==========================================
          // VALIDASI QTY
          // ==========================================

          if (
            !Number.isFinite(
              parsedQty
            ) ||
            parsedQty < 0
          ) {
            return {
              outletCode,
              outletName,
              barangCode,
              barangName,
              qty: 0,
              averageCost:
                parsedCost,
              minimumStock:
                parsedMinimum,
              status: "ERROR",
              message:
                "Qty Excel tidak valid",
            };
          }

          // ==========================================
          // VALIDASI HARGA
          // ==========================================

          if (
            !Number.isFinite(
              parsedCost
            ) ||
            parsedCost < 0
          ) {
            return {
              outletCode,
              outletName,
              barangCode,
              barangName,
              qty: parsedQty,
              averageCost: 0,
              minimumStock:
                parsedMinimum,
              status: "ERROR",
              message:
                "Harga modal tidak valid",
            };
          }

          // ==========================================
          // VALIDASI MINIMUM STOCK
          // ==========================================

          if (
            !Number.isFinite(
              parsedMinimum
            ) ||
            parsedMinimum < 0
          ) {
            return {
              outletCode,
              outletName,
              barangCode,
              barangName,
              qty: parsedQty,
              averageCost:
                parsedCost,
              minimumStock: 0,
              status: "ERROR",
              message:
                "Minimum stock tidak valid",
            };
          }

          // ==========================================
          // CARI OUTLET
          // ==========================================

          const outlet =
            outlets.find(
              (item) =>
                item.code
                  .trim()
                  .toLowerCase() ===
                outletCode
                  .trim()
                  .toLowerCase()
            );

          if (!outlet) {
            return {
              outletCode,
              outletName,
              barangCode,
              barangName,
              qty: parsedQty,
              averageCost:
                parsedCost,
              minimumStock:
                parsedMinimum,
              status: "ERROR",
              message:
                `Outlet ${outletCode} tidak ditemukan`,
            };
          }

          // ==========================================
          // CARI BARANG
          // ==========================================

          const selectedBarang =
            barang.find(
              (item) =>
                item.code
                  .trim()
                  .toLowerCase() ===
                barangCode
                  .trim()
                  .toLowerCase()
            );

          if (!selectedBarang) {
            return {
              outletCode,
              outletName:
                outletName ||
                outlet.name,
              barangCode,
              barangName,
              qty: parsedQty,
              averageCost:
                parsedCost,
              minimumStock:
                parsedMinimum,
              status: "ERROR",
              message:
                `Barang ${barangCode} tidak ditemukan`,
            };
          }

          // ==========================================
          // DETEKSI DUPLIKAT DALAM EXCEL
          // ==========================================

          const duplicateKey =
            `${outlet.id}::${selectedBarang.id}`;

          if (
            importedKeys.has(
              duplicateKey
            )
          ) {
            return {
              outletCode,
              outletName:
                outletName ||
                outlet.name,
              barangCode,
              barangName:
                barangName ||
                selectedBarang.name,
              qty: parsedQty,
              averageCost:
                parsedCost,
              minimumStock:
                parsedMinimum,
              status: "ERROR",
              message:
                "Barang yang sama untuk outlet ini muncul lebih dari satu kali di Excel",
            };
          }

          importedKeys.add(
            duplicateKey
          );

          // ==========================================
          // CEK EXISTING
          // ==========================================

          const existing =
            findExistingStock(
              currentStock,
              outlet,
              selectedBarang
            );

          return {
            outletCode,
            outletName:
              outletName ||
              outlet.name,
            barangCode,
            barangName:
              barangName ||
              selectedBarang.name,
            qty: parsedQty,
            averageCost:
              parsedCost,
            minimumStock:
              parsedMinimum,
            status: existing
              ? "UPDATE"
              : "READY",
            existingId:
              existing?.id,
            message: existing
              ? "Stock sudah ada dan akan diperbarui"
              : "Stock baru akan dibuat",
          };
        });

      setImportRows(result);
    } catch (error) {
      console.error(
        "READ EXCEL ERROR:",
        error
      );

      alert(
        "Gagal membaca file Excel"
      );
    } finally {
      event.target.value = "";
    }
  }

  // ===================================================
  // UPDATE SATU ROW
  // ===================================================

  async function updateExistingStock(
    id: number,
    row: ImportRow,
    outlet: Outlet,
    selectedBarang: Barang
  ) {
    const res = await fetch(
      "/api/outlet/stock-awal",
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          id,

          outletId:
            outlet.id,

          barangId:
            selectedBarang.id,

          qty: row.qty,

          averageCost:
            row.averageCost,

          minimumStock:
            row.minimumStock,
        }),
      }
    );

    const json = await res.json();

    return {
      res,
      json,
    };
  }

  // ===================================================
  // PROSES IMPORT
  // ===================================================

  async function prosesImport() {
    const readyRows =
      importRows.filter(
        (row) =>
          row.status ===
            "READY" ||
          row.status ===
            "UPDATE"
      );

    if (!readyRows.length) {
      alert(
        "Tidak ada data valid untuk diimport"
      );

      return;
    }

    const hasErrors =
      importRows.some(
        (row) =>
          row.status ===
            "ERROR" ||
          row.status ===
            "FAILED"
      );

    if (hasErrors) {
      const lanjut = confirm(
        "Masih ada baris ERROR/FAILED.\n\n" +
          "Baris tersebut tidak akan diproses.\n\n" +
          "Lanjutkan hanya untuk baris yang valid?"
      );

      if (!lanjut) {
        return;
      }
    }

    try {
      setImporting(true);

      let berhasil = 0;
      let gagal = 0;

      // ================================================
      // RESET STATUS ERROR LAMA
      // ================================================

      setImportRows((prev) =>
        prev.map((row) => {
          if (
            row.status ===
              "READY" ||
            row.status ===
              "UPDATE"
          ) {
            return {
              ...row,
              message:
                row.existingId
                  ? "Sedang memperbarui stock..."
                  : "Sedang membuat stock...",
            };
          }

          return row;
        })
      );

      // ================================================
      // PROSES SATU PER SATU
      // ================================================

      for (
        let index = 0;
        index < readyRows.length;
        index++
      ) {
        const row =
          readyRows[index];

        const outlet =
          outlets.find(
            (item) =>
              item.code
                .trim()
                .toLowerCase() ===
              row.outletCode
                .trim()
                .toLowerCase()
          );

        const selectedBarang =
          barang.find(
            (item) =>
              item.code
                .trim()
                .toLowerCase() ===
              row.barangCode
                .trim()
                .toLowerCase()
          );

        if (
          !outlet ||
          !selectedBarang
        ) {
          gagal++;

          setImportRows(
            (prev) =>
              prev.map((item) =>
                item === row
                  ? {
                      ...item,
                      status:
                        "FAILED",
                      message:
                        !outlet
                          ? `Outlet ${row.outletCode} tidak ditemukan`
                          : `Barang ${row.barangCode} tidak ditemukan`,
                    }
                  : item
              )
          );

          continue;
        }

        try {
          // ============================================
          // EXISTING
          // ============================================

          if (row.existingId) {
            const result =
              await updateExistingStock(
                row.existingId,
                row,
                outlet,
                selectedBarang
              );

            if (
              result.res.ok &&
              result.json.success
            ) {
              berhasil++;

              setImportRows(
                (prev) =>
                  prev.map(
                    (item) =>
                      item === row
                        ? {
                            ...item,
                            status:
                              "DONE",
                            message:
                              "Stock berhasil diperbarui",
                            existingId:
                              row.existingId,
                          }
                        : item
                  )
              );

              continue;
            }

            gagal++;

            setImportRows(
              (prev) =>
                prev.map(
                  (item) =>
                    item === row
                      ? {
                          ...item,
                          status:
                            "FAILED",
                          message:
                            result
                              .json
                              ?.message ||
                            "Gagal memperbarui stock",
                        }
                      : item
                )
            );

            continue;
          }

          // ============================================
          // CREATE STOCK BARU
          // ============================================

          const postRes =
            await fetch(
              "/api/outlet/stock-awal",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body: JSON.stringify({
                  outletId:
                    outlet.id,

                  barangId:
                    selectedBarang.id,

                  qty: row.qty,

                  averageCost:
                    row.averageCost,

                  minimumStock:
                    row.minimumStock,
                }),
              }
            );

          const postJson =
            await postRes.json();

          // ============================================
          // POST BERHASIL
          // ============================================

          if (
            postRes.ok &&
            postJson.success
          ) {
            berhasil++;

            setImportRows(
              (prev) =>
                prev.map(
                  (item) =>
                    item === row
                      ? {
                          ...item,
                          status:
                            "DONE",
                          message:
                            "Stock baru berhasil dibuat",
                        }
                      : item
                )
            );

            continue;
          }

          // ============================================
          // POST 409
          //
          // Stock sudah ada karena race-condition
          // atau data berubah setelah preview.
          // ============================================

          if (
            postRes.status === 409
          ) {
            const existingId =
              Number(
                postJson?.data?.id
              );

            if (
              Number.isInteger(
                existingId
              ) &&
              existingId > 0
            ) {
              const updateResult =
                await updateExistingStock(
                  existingId,
                  row,
                  outlet,
                  selectedBarang
                );

              if (
                updateResult.res.ok &&
                updateResult.json
                  .success
              ) {
                berhasil++;

                setImportRows(
                  (prev) =>
                    prev.map(
                      (item) =>
                        item === row
                          ? {
                              ...item,
                              status:
                                "DONE",
                              existingId,
                              message:
                                "Stock sudah ada dan berhasil diperbarui",
                            }
                          : item
                    )
                );

                continue;
              }

              gagal++;

              setImportRows(
                (prev) =>
                  prev.map(
                    (item) =>
                      item === row
                        ? {
                            ...item,
                            status:
                              "FAILED",
                            existingId,
                            message:
                              updateResult
                                .json
                                ?.message ||
                              "Stock sudah ada tetapi gagal diperbarui",
                          }
                        : item
                  )
              );

              continue;
            }
          }

          // ============================================
          // ERROR LAIN
          // ============================================

          console.error(
            "IMPORT ROW ERROR:",
            row,
            postJson
          );

          gagal++;

          setImportRows(
            (prev) =>
              prev.map(
                (item) =>
                  item === row
                    ? {
                        ...item,
                        status:
                          "FAILED",
                        message:
                          postJson?.message ||
                          "Gagal menyimpan stock",
                      }
                    : item
              )
          );
        } catch (rowError) {
          console.error(
            "IMPORT ROW EXCEPTION:",
            row,
            rowError
          );

          gagal++;

          setImportRows(
            (prev) =>
              prev.map(
                (item) =>
                  item === row
                    ? {
                        ...item,
                        status:
                          "FAILED",
                        message:
                          "Terjadi kesalahan saat memproses baris",
                      }
                    : item
              )
          );
        }
      }

      // ================================================
      // RELOAD DATA
      // ================================================

      await loadStock(outletId);
      await loadAllStockForImport();

      // ================================================
      // SUMMARY
      // ================================================

      alert(
        `Import selesai.\n\n` +
          `Berhasil: ${berhasil}\n` +
          `Gagal: ${gagal}`
      );
    } catch (error) {
      console.error(
        "IMPORT STOCK AWAL ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat import Excel"
      );
    } finally {
      setImporting(false);
    }
  }

  // ===================================================
  // TEMPLATE EXCEL
  // ===================================================

  function downloadTemplate() {
    const data = [
      {
        "Kode Outlet":
          "CUST003",

        "Nama Outlet":
          "GANGNAM BBQ SUNTER",

        "Kode Barang":
          "VGT043",

        "Nama Barang":
          "Kentang",

        "Qty Awal":
          10,

        "Harga Modal":
          18000,

        "Minimum Stock":
          1,
      },

      {
        "Kode Outlet":
          "CUST003",

        "Nama Outlet":
          "GANGNAM BBQ SUNTER",

        "Kode Barang":
          "VGT023",

        "Nama Barang":
          "Daun Pandan",

        "Qty Awal":
          0.25,

        "Harga Modal":
          12000,

        "Minimum Stock":
          1,
      },
    ];

    const worksheet =
      XLSX.utils.json_to_sheet(
        data
      );

    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 18 },
      { wch: 30 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Stock Awal"
    );

    XLSX.writeFile(
      workbook,
      "template-stock-awal-outlet.xlsx"
    );
  }

  // ===================================================
  // FILTER
  // ===================================================

  const filteredStocks =
    stocks.filter((item) => {
      const text =
        `${item.barang.code} ${item.barang.name} ${item.outlet.code} ${item.outlet.name}`
          .toLowerCase();

      return text.includes(
        search.toLowerCase()
      );
    });

  // ===================================================
  // FORMAT NUMBER
  // ===================================================

  function formatNumber(
    value: any
  ) {
    const number =
      Number(value ?? 0);

    return number.toLocaleString(
      "id-ID",
      {
        maximumFractionDigits: 4,
      }
    );
  }

  // ===================================================
  // FORMAT RUPIAH
  // ===================================================

  function formatRupiah(
    value: any
  ) {
    const number =
      Number(value ?? 0);

    return `Rp ${number.toLocaleString(
      "id-ID",
      {
        maximumFractionDigits: 0,
      }
    )}`;
  }

  // ===================================================
  // IMPORT SUMMARY
  // ===================================================

  const importReadyCount =
    importRows.filter(
      (row) =>
        row.status ===
          "READY" ||
        row.status ===
          "UPDATE"
    ).length;

  const importNewCount =
    importRows.filter(
      (row) =>
        row.status ===
        "READY"
    ).length;

  const importUpdateCount =
    importRows.filter(
      (row) =>
        row.status ===
        "UPDATE"
    ).length;

  const importDoneCount =
    importRows.filter(
      (row) =>
        row.status ===
        "DONE"
    ).length;

  const importFailedCount =
    importRows.filter(
      (row) =>
        row.status ===
          "ERROR" ||
        row.status ===
          "FAILED"
    ).length;

  // ===================================================
  // SEARCHABLE OPTIONS
  // ===================================================

  const outletOptions: SearchableOption[] =
    outlets.map((outlet) => ({
      id: outlet.id,
      code: outlet.code,
      name: outlet.name,
      extra: "Outlet aktif",
    }));

  const barangOptions: SearchableOption[] =
    barang.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      extra: `Satuan: ${item.unit}`,
    }));

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <Warehouse size={23} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Stock Awal Outlet
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Masukkan stok awal masing-masing outlet
            </p>
          </div>

        </div>

        <div className="flex flex-wrap gap-2">

          <button
            type="button"
            onClick={bukaImport}
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-[#497F70]
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-sm
              hover:bg-[#3D6D60]
            "
          >
            <Upload size={16} />
            Import Excel
          </button>

          <button
            type="button"
            onClick={() =>
              loadStock(outletId)
            }
            disabled={loading}
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-[#DDE9E4]
              bg-white
              px-4
              py-2.5
              text-sm
              font-semibold
              text-[#35564C]
              shadow-sm
              hover:bg-[#F5F8F6]
              disabled:opacity-50
            "
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>

        </div>

      </div>

      <div className="space-y-6">

        {/* =================================================
            FORM
        ================================================= */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm md:p-6">

          <div className="mb-5 flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">

              {editingId ? (
                <Pencil size={19} />
              ) : (
                <Plus size={19} />
              )}

            </div>

            <div>

              <h2 className="font-semibold text-[#18352D]">
                {editingId
                  ? "Edit Stock Outlet"
                  : "Tambah Stock Awal"}
              </h2>

              <p className="text-xs text-gray-500">
                Stok awal tidak akan mengurangi stok gudang pusat
              </p>

            </div>

          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-5">

            {/* OUTLET */}

            <div>

              <label className="mb-2 block text-sm font-semibold text-[#35564C]">
                Outlet
              </label>

              <SearchableSelect
                value={outletId}
                options={outletOptions}
                placeholder="-- Pilih Outlet --"
                searchPlaceholder="Ketik kode atau nama outlet..."
                onChange={(value) => {
                  setOutletId(value);

                  if (!editingId) {
                    loadStock(value);
                  }
                }}
                icon={
                  <MapPin size={16} />
                }
              />

            </div>

            {/* BARANG */}

            <div className="lg:col-span-2">

              <label className="mb-2 block text-sm font-semibold text-[#35564C]">
                Barang
              </label>

              <SearchableSelect
                value={barangId}
                options={barangOptions}
                placeholder="-- Pilih Barang --"
                searchPlaceholder="Ketik kode atau nama barang..."
                onChange={
                  handleBarangChange
                }
                icon={
                  <Package size={16} />
                }
              />

            </div>

            {/* QTY */}

            <div>

              <label className="mb-2 block text-sm font-semibold text-[#35564C]">
                Qty Awal
              </label>

              <input
                type="number"
                min="0"
                step="any"
                value={qty}
                onChange={(e) =>
                  setQty(
                    e.target.value
                  )
                }
                placeholder="0"
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  px-4
                  py-3
                  text-sm
                  outline-none
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />

            </div>

            {/* HARGA */}

            <div>

              <label className="mb-2 block text-sm font-semibold text-[#35564C]">
                Harga Modal
              </label>

              <input
                type="number"
                min="0"
                step="any"
                value={
                  averageCost
                }
                onChange={(e) =>
                  setAverageCost(
                    e.target.value
                  )
                }
                placeholder="0"
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  px-4
                  py-3
                  text-sm
                  outline-none
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />

            </div>

          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">

            {/* MINIMUM STOCK */}

            <div>

              <label className="mb-2 block text-sm font-semibold text-[#35564C]">
                Minimum Stock
              </label>

              <input
                type="number"
                min="0"
                step="any"
                value={
                  minimumStock
                }
                onChange={(e) =>
                  setMinimumStock(
                    e.target.value
                  )
                }
                placeholder="0"
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  px-4
                  py-3
                  text-sm
                  outline-none
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />

            </div>

          </div>

          <div className="mt-5 flex justify-end gap-2">

            {editingId && (
              <button
                type="button"
                onClick={
                  resetForm
                }
                className="
                  rounded-xl
                  border
                  border-[#DDE9E4]
                  bg-white
                  px-5
                  py-3
                  text-sm
                  font-semibold
                  text-gray-600
                  hover:bg-gray-50
                "
              >
                Batal
              </button>
            )}

            <button
              type="button"
              onClick={simpan}
              disabled={saving}
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-[#497F70]
                px-6
                py-3
                text-sm
                font-semibold
                text-white
                shadow-sm
                hover:bg-[#3D6D60]
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
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
                  {editingId ? (
                    <Pencil size={17} />
                  ) : (
                    <Plus size={17} />
                  )}

                  {editingId
                    ? "Update Stock"
                    : "Simpan Stock Awal"}
                </>
              )}

            </button>

          </div>

        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

          <div className="flex flex-col gap-4 border-b border-[#E5ECE9] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <Package size={19} />
              </div>

              <div>

                <h2 className="font-semibold text-[#18352D]">
                  Stock Outlet
                </h2>

                <p className="text-xs text-gray-500">
                  Daftar stok yang sudah dimasukkan
                </p>

              </div>

            </div>

            <div className="relative w-full md:w-72">

              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Cari barang atau outlet..."
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  py-2.5
                  pl-9
                  pr-4
                  text-sm
                  outline-none
                  focus:border-[#497F70]
                  focus:bg-white
                "
              />

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="min-w-[1100px] w-full text-sm">

              <thead className="bg-[#F5F8F6]">

                <tr className="border-b border-[#E5ECE9]">

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Outlet
                  </th>

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Barang
                  </th>

                  <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                    Stock
                  </th>

                  <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                    Minimum
                  </th>

                  <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                    Harga Modal
                  </th>

                  <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                    Nilai Stock
                  </th>

                  <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                    Aksi
                  </th>

                </tr>

              </thead>

              <tbody>

                {loading ? (
                  <tr>

                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center"
                    >

                      <RefreshCw
                        size={20}
                        className="mx-auto mb-2 animate-spin text-[#497F70]"
                      />

                      <p className="text-sm text-gray-500">
                        Memuat stock...
                      </p>

                    </td>

                  </tr>
                ) : filteredStocks.length ===
                  0 ? (
                  <tr>

                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center"
                    >

                      <Boxes
                        size={30}
                        className="mx-auto mb-2 text-gray-300"
                      />

                      <p className="text-sm font-semibold text-gray-500">
                        Belum ada stock outlet
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Tambahkan stock manual atau import dari Excel
                      </p>

                    </td>

                  </tr>
                ) : (
                  filteredStocks.map(
                    (item) => (
                      <tr
                        key={item.id}
                        className="border-b border-[#EDF2EF] hover:bg-[#FAFCFB]"
                      >

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {item.outlet.name}
                          </div>

                          <div className="text-xs text-gray-400">
                            {item.outlet.code}
                          </div>

                        </td>

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {item.barang.name}
                          </div>

                          <div className="text-xs text-gray-400">
                            {item.barang.code}
                          </div>

                        </td>

                        <td className="px-5 py-4 text-center">

                          <span className="inline-flex rounded-full bg-[#EAF3EF] px-3 py-1 text-xs font-semibold text-[#497F70]">

                            {formatNumber(
                              item.stock
                            )}{" "}

                            {item.barang.unit}

                          </span>

                        </td>

                        <td className="px-5 py-4 text-center">

                          <span
                            className={
                              Number(
                                item.stock
                              ) <=
                              Number(
                                item.minimumStock
                              )
                                ? "inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600"
                                : "inline-flex rounded-full bg-[#EAF3EF] px-3 py-1 text-xs font-semibold text-[#497F70]"
                            }
                          >
                            {formatNumber(
                              item.minimumStock
                            )}
                          </span>

                        </td>

                        <td className="px-5 py-4 text-right text-gray-600">
                          {formatRupiah(
                            item.averageCost
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-[#18352D]">
                          {formatRupiah(
                            Number(
                              item.stock
                            ) *
                              Number(
                                item.averageCost
                              )
                          )}
                        </td>

                        <td className="px-5 py-4">

                          <div className="flex justify-center gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                mulaiEdit(
                                  item
                                )
                              }
                              className="
                                inline-flex
                                h-9
                                w-9
                                items-center
                                justify-center
                                rounded-lg
                                border
                                border-[#DDE9E4]
                                bg-white
                                text-[#497F70]
                                hover:bg-[#EAF3EF]
                              "
                              title="Edit"
                            >
                              <Pencil
                                size={15}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                hapusStock(
                                  item
                                )
                              }
                              className="
                                inline-flex
                                h-9
                                w-9
                                items-center
                                justify-center
                                rounded-lg
                                border
                                border-red-100
                                bg-white
                                text-red-500
                                hover:bg-red-50
                              "
                              title="Hapus"
                            >
                              <Trash2
                                size={15}
                              />
                            </button>

                          </div>

                        </td>

                      </tr>
                    )
                  )
                )}

              </tbody>

            </table>

          </div>

        </div>

      </div>

      {/* =================================================
          IMPORT MODAL
      ================================================= */}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">

          <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="flex items-center justify-between border-b border-[#E5ECE9] bg-gradient-to-r from-[#F8FBF9] to-white px-6 py-5">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <FileSpreadsheet
                    size={21}
                  />
                </div>

                <div>

                  <h2 className="font-bold text-[#18352D]">
                    Import Stock Awal Outlet
                  </h2>

                  <p className="mt-0.5 text-xs text-gray-500">
                    Import massal stock outlet dari Excel
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={
                  tutupImport
                }
                disabled={importing}
                className="
                  rounded-xl
                  p-2
                  text-gray-400
                  transition
                  hover:bg-gray-100
                  hover:text-gray-600
                  disabled:opacity-50
                "
              >
                <X size={19} />
              </button>

            </div>

            {/* =================================================
                INFO PANEL
            ================================================= */}

            <div className="border-b border-[#E5ECE9] bg-[#F8FBF9] px-6 py-4">

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

                <div className="flex items-start gap-3 rounded-xl border border-[#DDE9E4] bg-white p-3">

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                    <Warehouse
                      size={17}
                    />
                  </div>

                  <div>
                    <p className="text-xs font-bold text-[#35564C]">
                      Stock Pusat Aman
                    </p>

                    <p className="mt-1 text-[11px] leading-5 text-gray-500">
                      Qty Excel langsung menjadi stock outlet. Stock gudang pusat tidak dikurangi.
                    </p>
                  </div>

                </div>

                <div className="flex items-start gap-3 rounded-xl border border-[#DDE9E4] bg-white p-3">

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <RotateCcw
                      size={17}
                    />
                  </div>

                  <div>
                    <p className="text-xs font-bold text-[#35564C]">
                      Existing = UPDATE
                    </p>

                    <p className="mt-1 text-[11px] leading-5 text-gray-500">
                      Jika kombinasi outlet + barang sudah ada, data akan diperbarui.
                    </p>
                  </div>

                </div>

                <div className="flex items-start gap-3 rounded-xl border border-[#DDE9E4] bg-white p-3">

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <AlertTriangle
                      size={17}
                    />
                  </div>

                  <div>
                    <p className="text-xs font-bold text-[#35564C]">
                      Hindari Duplikat
                    </p>

                    <p className="mt-1 text-[11px] leading-5 text-gray-500">
                      Satu barang untuk satu outlet hanya boleh muncul sekali dalam Excel.
                    </p>
                  </div>

                </div>

              </div>

              <div className="mt-4 flex justify-end">

                <button
                  type="button"
                  onClick={
                    downloadTemplate
                  }
                  className="
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    border
                    border-[#DDE9E4]
                    bg-white
                    px-4
                    py-2.5
                    text-xs
                    font-semibold
                    text-[#497F70]
                    shadow-sm
                    hover:bg-[#EAF3EF]
                  "
                >
                  <Download size={14} />
                  Download Template Excel
                </button>

              </div>

            </div>

            {/* =================================================
                FILE UPLOAD
            ================================================= */}

            <div className="px-6 py-5">

              <input
                ref={
                  fileInputRef
                }
                type="file"
                accept=".xlsx,.xls"
                onChange={
                  handleExcel
                }
                className="hidden"
              />

              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={importing}
                className="
                  group
                  flex
                  w-full
                  flex-col
                  items-center
                  justify-center
                  rounded-2xl
                  border-2
                  border-dashed
                  border-[#CFE0D8]
                  bg-[#FAFCFB]
                  px-6
                  py-8
                  text-center
                  transition
                  hover:border-[#497F70]
                  hover:bg-[#F5F9F7]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >

                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70] transition group-hover:scale-105">

                  <FileSpreadsheet
                    size={29}
                  />

                </div>

                <p className="text-sm font-bold text-[#35564C]">
                  {selectedFileName
                    ? "Ganti file Excel"
                    : "Pilih file Excel"}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Format .xlsx atau .xls
                </p>

                {selectedFileName && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#EAF3EF] px-3 py-1.5 text-[11px] font-semibold text-[#497F70]">

                    <FileCheck2
                      size={13}
                    />

                    {selectedFileName}

                  </div>
                )}

              </button>

            </div>

            {/* =================================================
                PREVIEW
            ================================================= */}

            {importRows.length > 0 && (
              <div className="min-h-0 flex-1 overflow-hidden border-t border-[#E5ECE9]">

                {/* SUMMARY */}

                <div className="border-b border-[#E5ECE9] bg-white px-6 py-4">

                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

                    <div>

                      <p className="text-sm font-bold text-[#18352D]">
                        Preview Import
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Periksa hasil validasi sebelum menekan Import / Update Stock
                      </p>

                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">

                      <div className="rounded-xl border border-[#DDE9E4] bg-[#FAFCFB] px-4 py-2.5">

                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Total
                        </p>

                        <p className="mt-0.5 text-lg font-bold text-[#18352D]">
                          {importRows.length}
                        </p>

                      </div>

                      <div className="rounded-xl border border-[#DDE9E4] bg-[#FAFCFB] px-4 py-2.5">

                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Baru
                        </p>

                        <p className="mt-0.5 text-lg font-bold text-[#497F70]">
                          {importNewCount}
                        </p>

                      </div>

                      <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-2.5">

                        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-400">
                          Update
                        </p>

                        <p className="mt-0.5 text-lg font-bold text-blue-600">
                          {importUpdateCount}
                        </p>

                      </div>

                      <div className="rounded-xl border border-red-100 bg-red-50/50 px-4 py-2.5">

                        <p className="text-[10px] font-semibold uppercase tracking-wide text-red-400">
                          Error
                        </p>

                        <p className="mt-0.5 text-lg font-bold text-red-500">
                          {importFailedCount}
                        </p>

                      </div>

                    </div>

                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">

                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF3EF] px-3 py-1.5 text-[11px] font-semibold text-[#497F70]">

                      <CircleDot
                        size={11}
                      />

                      {importReadyCount} siap diproses

                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-[11px] font-semibold text-green-600">

                      <CheckCircle2
                        size={11}
                      />

                      {importDoneCount} selesai

                    </span>

                    {importFailedCount >
                      0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-500">

                        <AlertTriangle
                          size={11}
                        />

                        {importFailedCount} tidak dapat diproses

                      </span>
                    )}

                  </div>

                </div>

                {/* TABLE */}

                <div className="max-h-[430px] overflow-auto">

                  <table className="min-w-[1200px] w-full text-xs">

                    <thead className="sticky top-0 z-10 bg-[#F5F8F6] shadow-sm">

                      <tr className="border-b border-[#E5ECE9]">

                        <th className="px-4 py-3 text-left font-bold text-[#35564C]">
                          #
                        </th>

                        <th className="px-4 py-3 text-left font-bold text-[#35564C]">
                          Outlet
                        </th>

                        <th className="px-4 py-3 text-left font-bold text-[#35564C]">
                          Barang
                        </th>

                        <th className="px-4 py-3 text-right font-bold text-[#35564C]">
                          Qty
                        </th>

                        <th className="px-4 py-3 text-right font-bold text-[#35564C]">
                          Harga Modal
                        </th>

                        <th className="px-4 py-3 text-right font-bold text-[#35564C]">
                          Min Stock
                        </th>

                        <th className="px-4 py-3 text-left font-bold text-[#35564C]">
                          Status
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {importRows.map(
                        (
                          row,
                          index
                        ) => (
                          <tr
                            key={`${row.outletCode}-${row.barangCode}-${index}`}
                            className={`
                              border-b
                              border-[#EDF2EF]
                              transition
                              ${
                                row.status ===
                                    "ERROR" ||
                                  row.status ===
                                    "FAILED"
                                  ? "bg-red-50/40"
                                  : row.status ===
                                    "DONE"
                                  ? "bg-green-50/30"
                                  : "hover:bg-[#FAFCFB]"
                              }
                            `}
                          >

                            <td className="px-4 py-3 text-gray-400">
                              {index +
                                1}
                            </td>

                            <td className="px-4 py-3">

                              <div className="font-semibold text-[#18352D]">
                                {
                                  row.outletCode
                                }
                              </div>

                              <div className="mt-0.5 text-gray-400">
                                {
                                  row.outletName
                                }
                              </div>

                            </td>

                            <td className="px-4 py-3">

                              <div className="font-semibold text-[#18352D]">
                                {
                                  row.barangCode
                                }
                              </div>

                              <div className="mt-0.5 text-gray-400">
                                {
                                  row.barangName
                                }
                              </div>

                            </td>

                            <td className="px-4 py-3 text-right">

                              <div className="font-bold text-[#497F70]">
                                {formatNumber(
                                  row.qty
                                )}
                              </div>

                            </td>

                            <td className="px-4 py-3 text-right font-medium text-gray-600">
                              {formatRupiah(
                                row.averageCost
                              )}
                            </td>

                            <td className="px-4 py-3 text-right font-medium text-gray-600">
                              {formatNumber(
                                row.minimumStock
                              )}
                            </td>

                            <td className="px-4 py-3">

                              {row.status ===
                                "READY" && (
                                <div>
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF3EF] px-2.5 py-1.5 font-semibold text-[#497F70]">
                                    <CircleDot
                                      size={
                                        12
                                      }
                                    />
                                    Baru
                                  </span>

                                  {row.message && (
                                    <p className="mt-1 text-[10px] text-gray-400">
                                      {
                                        row.message
                                      }
                                    </p>
                                  )}
                                </div>
                              )}

                              {row.status ===
                                "UPDATE" && (
                                <div>
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1.5 font-semibold text-blue-600">
                                    <RefreshCw
                                      size={
                                        12
                                      }
                                    />
                                    Akan Update
                                  </span>

                                  {row.message && (
                                    <p className="mt-1 text-[10px] text-gray-400">
                                      {
                                        row.message
                                      }
                                    </p>
                                  )}
                                </div>
                              )}

                              {row.status ===
                                "DONE" && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1.5 font-semibold text-green-600">
                                  <CheckCircle2
                                    size={
                                      12
                                    }
                                  />
                                  {row.message ||
                                    "Selesai"}
                                </span>
                              )}

                              {row.status ===
                                "ERROR" && (
                                <div className="max-w-[300px]">
                                  <span className="inline-flex items-start gap-1.5 rounded-full bg-red-50 px-2.5 py-1.5 font-semibold text-red-500">
                                    <AlertTriangle
                                      size={
                                        12
                                      }
                                      className="mt-0.5 shrink-0"
                                    />
                                    <span>
                                      {row.message ||
                                        "Data tidak valid"}
                                    </span>
                                  </span>
                                </div>
                              )}

                              {row.status ===
                                "FAILED" && (
                                <div className="max-w-[300px]">
                                  <span className="inline-flex items-start gap-1.5 rounded-full bg-red-50 px-2.5 py-1.5 font-semibold text-red-500">
                                    <AlertTriangle
                                      size={
                                        12
                                      }
                                      className="mt-0.5 shrink-0"
                                    />
                                    <span>
                                      {row.message ||
                                        "Gagal"}
                                    </span>
                                  </span>
                                </div>
                              )}

                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>

              </div>
            )}

            {/* =================================================
                FOOTER
            ================================================= */}

            <div className="flex flex-col gap-3 border-t border-[#E5ECE9] bg-[#FAFCFB] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">

              <div className="text-xs text-gray-400">

                {importRows.length >
                0 ? (
                  <>
                    <span className="font-semibold text-[#35564C]">
                      {importReadyCount}
                    </span>{" "}
                    baris siap diproses
                    {importFailedCount >
                      0 && (
                      <>
                        {" "}
                        ·{" "}
                        <span className="font-semibold text-red-500">
                          {
                            importFailedCount
                          }
                        </span>{" "}
                        error akan dilewati
                      </>
                    )}
                  </>
                ) : (
                  "Belum ada file Excel yang dipilih"
                )}

              </div>

              <div className="flex justify-end gap-2">

                <button
                  type="button"
                  onClick={
                    tutupImport
                  }
                  disabled={importing}
                  className="
                    rounded-xl
                    border
                    border-[#DDE9E4]
                    bg-white
                    px-5
                    py-2.5
                    text-sm
                    font-semibold
                    text-gray-600
                    hover:bg-gray-50
                    disabled:opacity-50
                  "
                >
                  Tutup
                </button>

                <button
                  type="button"
                  onClick={
                    prosesImport
                  }
                  disabled={
                    importing ||
                    importReadyCount ===
                      0
                  }
                  className="
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-[#497F70]
                    px-5
                    py-2.5
                    text-sm
                    font-semibold
                    text-white
                    shadow-sm
                    hover:bg-[#3D6D60]
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >

                  {importing ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="animate-spin"
                      />

                      Memproses...
                    </>
                  ) : (
                    <>
                      <Upload
                        size={16}
                      />

                      Import / Update Stock
                    </>
                  )}

                </button>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}