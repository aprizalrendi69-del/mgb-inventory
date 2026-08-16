"use client";

import { useEffect, useRef, useState } from "react";
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

// =====================================================
// COMPONENT
// =====================================================

export default function StockAwalOutletPage() {
  // ===================================================
  // MASTER
  // ===================================================

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [barang, setBarang] = useState<Barang[]>([]);
  const [stocks, setStocks] = useState<OutletStock[]>([]);

  // ===================================================
  // FORM
  // ===================================================

  const [outletId, setOutletId] = useState("");
  const [barangId, setBarangId] = useState("");

  const [qty, setQty] = useState("");
  const [averageCost, setAverageCost] = useState("");
  const [minimumStock, setMinimumStock] = useState("");

  // ===================================================
  // FILTER
  // ===================================================

  const [search, setSearch] = useState("");

  // ===================================================
  // LOADING
  // ===================================================

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ===================================================
  // EDIT
  // ===================================================

  const [editingId, setEditingId] =
    useState<number | null>(null);

  // ===================================================
  // IMPORT
  // ===================================================

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [showImport, setShowImport] =
    useState(false);

  const [importRows, setImportRows] =
    useState<ImportRow[]>([]);

  const [importing, setImporting] =
    useState(false);

  // ===================================================
  // LOAD OUTLET
  // ===================================================

  async function loadOutlets() {
    try {
      const res = await fetch("/api/outlet", {
        cache: "no-store",
      });

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
      const res = await fetch("/api/barang", {
        cache: "no-store",
      });

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
  // INITIAL
  // ===================================================

  useEffect(() => {
    loadOutlets();
    loadBarang();
    loadStock("");
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

    try {
      setSaving(true);

      const body = {
        outletId: Number(outletId),
        barangId: Number(barangId),

        // NILAI STOCK BERASAL DARI FORM
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
    setShowImport(true);
  }

  // ===================================================
  // NORMALISASI HEADER
  // ===================================================

  function normalizeHeader(
    value: any
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
  //
  // PENTING:
  //
  // 0.25 -> 0.25
  // 2.7  -> 2.7
  // 18.94 -> 18.94
  //
  // 1.250.000 -> 1250000
  // 1.250,50 -> 1250.50
  // 1250,50 -> 1250.50
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

    /*
     * Jika terdapat koma dan titik:
     *
     * 1.250,50
     * -> 1250.50
     */

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
      /*
       * 18,94
       * -> 18.94
       */
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
  //
  // Dipakai sebelum import.
  //
  // Jika stock sudah ada:
  // -> POST tidak diperlukan
  // -> gunakan PUT
  //
  // Tetapi kita tetap memakai POST terlebih dahulu
  // agar race-condition ditangani API.
  // ===================================================

  function findExistingStock(
    outlet: Outlet,
    selectedBarang: Barang
  ) {
    return stocks.find(
      (item) =>
        item.outletId ===
          outlet.id &&
        item.barangId ===
          selectedBarang.id
    );
  }

  // ===================================================
  // BACA EXCEL
  // ===================================================

  async function handleExcel(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    try {
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

      const result: ImportRow[] =
        rawRows.map((row) => {
          // ============================================
          // OUTLET
          // ============================================

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

          // ============================================
          // BARANG
          // ============================================

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

          // ============================================
          // QTY
          // ============================================

          const qtyValue =
            getCell(row, [
              "qty",
              "qtyawal",
              "stockawal",
              "jumlah",
              "stock",
            ]);

          // ============================================
          // HARGA MODAL
          // ============================================

          const averageCostValue =
            getCell(row, [
              "averagecost",
              "hargamodal",
              "hargabeli",
              "harga",
              "hpp",
            ]);

          // ============================================
          // MINIMUM STOCK
          // ============================================

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

          // ============================================
          // VALIDASI OUTLET
          // ============================================

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

          // ============================================
          // VALIDASI BARANG
          // ============================================

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

          // ============================================
          // VALIDASI QTY
          // ============================================

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

          // ============================================
          // CARI OUTLET
          // ============================================

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

          // ============================================
          // CARI BARANG
          // ============================================

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

          // ============================================
          // CEK EXISTING
          // ============================================

          const existing =
            findExistingStock(
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
              : undefined,
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
  //
  // LOGIC:
  //
  // 1. Kalau belum ada -> POST
  //
  // 2. Kalau POST berhasil -> DONE
  //
  // 3. Kalau POST 409 ->
  //    ambil ID dari response
  //    lalu PUT
  //
  // 4. Kalau existing sudah diketahui
  //    dari tabel -> langsung PUT
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

    try {
      setImporting(true);

      let berhasil = 0;
      let gagal = 0;

      // ===============================================
      // RESET STATUS ERROR LAMA
      // ===============================================

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
              status:
                row.existingId
                  ? "UPDATE"
                  : "READY",
              message:
                row.existingId
                  ? "Stock sudah ada, akan diperbarui"
                  : undefined,
            };
          }

          return row;
        })
      );

      // ===============================================
      // PROSES SATU PER SATU
      // ===============================================

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
          // ==========================================
          // CASE 1
          // EXISTING SUDAH DIKETAHUI
          //
          // LANGSUNG PUT
          // ==========================================

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

          // ==========================================
          // CASE 2
          // POST STOCK BARU
          // ==========================================

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

                  // LANGSUNG DARI EXCEL
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

          // ==========================================
          // POST BERHASIL
          // ==========================================

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
                            "Stock berhasil dibuat",
                        }
                      : item
                )
            );

            continue;
          }

          // ==========================================
          // POST 409
          //
          // STOCK SUDAH ADA
          //
          // INI YANG MEMPERBAIKI MASALAH LOG TERAKHIR
          // ==========================================

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

          // ==========================================
          // ERROR LAIN
          // ==========================================

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

      // ===============================================
      // RELOAD
      // ===============================================

      await loadStock(outletId);

      // ===============================================
      // JANGAN LANGSUNG TUTUP MODAL
      //
      // Supaya user bisa melihat hasil.
      // ===============================================

      alert(
        `Import selesai.\n\nBerhasil: ${berhasil}\nGagal: ${gagal}`
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

              <select
                value={outletId}
                onChange={(e) => {
                  const value =
                    e.target.value;

                  setOutletId(value);

                  if (!editingId) {
                    loadStock(value);
                  }
                }}
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
              >

                <option value="">
                  -- Semua Outlet --
                </option>

                {outlets.map(
                  (outlet) => (
                    <option
                      key={
                        outlet.id
                      }
                      value={
                        outlet.id
                      }
                    >
                      {outlet.code} -{" "}
                      {outlet.name}
                    </option>
                  )
                )}

              </select>

            </div>

            {/* BARANG */}

            <div className="lg:col-span-2">

              <label className="mb-2 block text-sm font-semibold text-[#35564C]">
                Barang
              </label>

              <select
                value={barangId}
                onChange={(e) =>
                  handleBarangChange(
                    e.target.value
                  )
                }
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
              >

                <option value="">
                  -- Pilih Barang --
                </option>

                {barang.map(
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
                placeholder="Cari barang..."
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
                      className="px-5 py-12 text-center text-sm text-gray-400"
                    >
                      Belum ada stock outlet
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-[#E5ECE9] px-6 py-5">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <FileSpreadsheet size={20} />
                </div>

                <div>

                  <h2 className="font-bold text-[#18352D]">
                    Import Stock Awal Outlet
                  </h2>

                  <p className="text-xs text-gray-500">
                    Qty, harga modal, dan minimum stock diambil langsung dari Excel
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowImport(
                    false
                  )
                }
                disabled={importing}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              >
                <X size={19} />
              </button>

            </div>

            {/* INFO */}

            <div className="border-b border-[#E5ECE9] bg-[#F8FBF9] px-6 py-4">

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                <div className="flex items-start gap-3">

                  <AlertTriangle
                    size={18}
                    className="mt-0.5 shrink-0 text-[#497F70]"
                  />

                  <div className="text-xs text-gray-600">

                    <p className="font-semibold text-[#35564C]">
                      Stock gudang pusat tidak digunakan.
                    </p>

                    <p className="mt-1">
                      <b>Qty Awal</b> pada Excel menjadi stock outlet secara langsung.
                    </p>

                    <p className="mt-1">
                      Jika stock outlet sudah ada, sistem otomatis melakukan <b>UPDATE</b>.
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={
                    downloadTemplate
                  }
                  className="
                    inline-flex
                    shrink-0
                    items-center
                    justify-center
                    gap-2
                    rounded-lg
                    border
                    border-[#DDE9E4]
                    bg-white
                    px-3
                    py-2
                    text-xs
                    font-semibold
                    text-[#497F70]
                    hover:bg-[#EAF3EF]
                  "
                >
                  <Download size={14} />
                  Download Template
                </button>

              </div>

            </div>

            {/* FILE */}

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
                  flex
                  w-full
                  flex-col
                  items-center
                  justify-center
                  rounded-xl
                  border-2
                  border-dashed
                  border-[#CFE0D8]
                  bg-[#FAFCFB]
                  px-6
                  py-8
                  text-center
                  hover:border-[#497F70]
                  hover:bg-[#F5F9F7]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >

                <FileSpreadsheet
                  size={30}
                  className="mb-3 text-[#497F70]"
                />

                <p className="text-sm font-semibold text-[#35564C]">
                  Pilih file Excel
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Format .xlsx atau .xls
                </p>

              </button>

            </div>

            {/* PREVIEW */}

            {importRows.length > 0 && (
              <div className="min-h-0 flex-1 overflow-hidden border-t border-[#E5ECE9]">

                {/* SUMMARY */}

                <div className="border-b border-[#E5ECE9] px-6 py-3">

                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                    <div>

                      <p className="text-sm font-semibold text-[#18352D]">
                        Preview Import
                      </p>

                      <p className="text-xs text-gray-400">
                        {importRows.length} baris
                      </p>

                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">

                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF3EF] px-3 py-1 font-semibold text-[#497F70]">

                        <CircleDot size={11} />

                        {importReadyCount} siap

                      </span>

                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-600">

                        <RefreshCw size={11} />

                        {importRows.filter(
                          (x) =>
                            x.status ===
                            "UPDATE"
                        ).length}{" "}
                        update

                      </span>

                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 font-semibold text-green-600">

                        <CheckCircle2 size={11} />

                        {importDoneCount}{" "}
                        selesai

                      </span>

                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 font-semibold text-red-500">

                        <AlertTriangle size={11} />

                        {importFailedCount}{" "}
                        error

                      </span>

                    </div>

                  </div>

                </div>

                {/* TABLE */}

                <div className="max-h-[420px] overflow-auto">

                  <table className="min-w-[1100px] w-full text-xs">

                    <thead className="sticky top-0 z-10 bg-[#F5F8F6]">

                      <tr>

                        <th className="px-4 py-3 text-left">
                          Outlet
                        </th>

                        <th className="px-4 py-3 text-left">
                          Barang
                        </th>

                        <th className="px-4 py-3 text-right">
                          Qty Excel
                        </th>

                        <th className="px-4 py-3 text-right">
                          Harga Modal
                        </th>

                        <th className="px-4 py-3 text-right">
                          Min Stock
                        </th>

                        <th className="px-4 py-3 text-left">
                          Status
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {importRows.map(
                        (row, index) => (
                          <tr
                            key={
                              `${row.outletCode}-${row.barangCode}-${index}`
                            }
                            className="border-b border-[#EDF2EF]"
                          >

                            <td className="px-4 py-3">

                              <div className="font-semibold">
                                {row.outletCode}
                              </div>

                              <div className="text-gray-400">
                                {row.outletName}
                              </div>

                            </td>

                            <td className="px-4 py-3">

                              <div className="font-semibold">
                                {row.barangCode}
                              </div>

                              <div className="text-gray-400">
                                {row.barangName}
                              </div>

                            </td>

                            <td className="px-4 py-3 text-right font-bold text-[#497F70]">
                              {formatNumber(
                                row.qty
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              {formatRupiah(
                                row.averageCost
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              {formatNumber(
                                row.minimumStock
                              )}
                            </td>

                            <td className="px-4 py-3">

                              {row.status ===
                                "READY" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF3EF] px-2.5 py-1 font-semibold text-[#497F70]">
                                  <CircleDot
                                    size={13}
                                  />
                                  Siap
                                </span>
                              )}

                              {row.status ===
                                "UPDATE" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-600">
                                  <RefreshCw
                                    size={13}
                                  />
                                  Akan Update
                                </span>
                              )}

                              {row.status ===
                                "DONE" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 font-semibold text-green-600">
                                  <CheckCircle2
                                    size={13}
                                  />
                                  {row.message ||
                                    "Selesai"}
                                </span>
                              )}

                              {row.status ===
                                "ERROR" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-500">
                                  <AlertTriangle
                                    size={13}
                                  />
                                  {row.message}
                                </span>
                              )}

                              {row.status ===
                                "FAILED" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-500">
                                  <AlertTriangle
                                    size={13}
                                  />
                                  {row.message ||
                                    "Gagal"}
                                </span>
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

            {/* FOOTER */}

            <div className="flex justify-end gap-2 border-t border-[#E5ECE9] px-6 py-4">

              <button
                type="button"
                onClick={() =>
                  setShowImport(
                    false
                  )
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
                  gap-2
                  rounded-xl
                  bg-[#497F70]
                  px-5
                  py-2.5
                  text-sm
                  font-semibold
                  text-white
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
                    <Upload size={16} />

                    Import / Update Stock
                  </>
                )}

              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}