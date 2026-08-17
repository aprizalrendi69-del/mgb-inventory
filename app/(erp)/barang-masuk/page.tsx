"use client";

import { useEffect, useMemo, useState } from "react";

import {
  PackageCheck,
  ShoppingCart,
  CalendarDays,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Camera,
  X,
  Barcode,
  ScanLine,
  Plus,
  Trash2,
} from "lucide-react";

import BarcodeInputScanner from "@/components/BarcodeInputScanner";

interface ReceiveRow {
  rowId: string;

  barangId: number;
  name: string;

  poQty: number;
  alreadyReceivedQty: number;

  price: number;

  hasExpired: boolean;

  batchNumber: string;
  expiredDate: string;

  qty: number;

  isBatchRow: boolean;
}

export default function BarangMasukPage() {
  // =====================================================
  // PURCHASE ORDER
  // =====================================================

  const [purchase, setPurchase] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  // =====================================================
  // RECEIVE ROWS
  // =====================================================

  const [rows, setRows] = useState<ReceiveRow[]>([]);

  // =====================================================
  // LOADING
  // =====================================================

  const [loadingPurchase, setLoadingPurchase] =
    useState(true);

  const [receiving, setReceiving] =
    useState(false);

  // =====================================================
  // SCANNER BARANG GLOBAL
  // =====================================================

  const [showBarangScanner, setShowBarangScanner] =
    useState(false);

  const [barangScanMessage, setBarangScanMessage] =
    useState("");

  // =====================================================
  // SCANNER BATCH GLOBAL
  // =====================================================

  const [showBatchScanner, setShowBatchScanner] =
    useState(false);

  const [batchScanMessage, setBatchScanMessage] =
    useState("");

  /*
   * Menentukan batch row mana yang akan menerima
   * hasil scan batch.
   */
  const [batchScanTarget, setBatchScanTarget] =
    useState<string>("");

  // =====================================================
  // LOAD PURCHASE
  // =====================================================

  async function loadPurchase() {
    try {
      setLoadingPurchase(true);

      const res = await fetch("/api/purchase", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json.message ||
            "Gagal mengambil Purchase Order"
        );
      }

      const purchases = Array.isArray(json)
        ? json
        : Array.isArray(json.data)
        ? json.data
        : [];

      // BARANG MASUK PUSAT:
      // hanya PO PUSAT yang sudah APPROVED
      const approved = purchases.filter(
        (po: any) =>
          po.status === "APPROVED" &&
          po.source === "PUSAT"
      );

      setPurchase(approved);
    } catch (error) {
      console.error(
        "LOAD PURCHASE ERROR:",
        error
      );

      setPurchase([]);
    } finally {
      setLoadingPurchase(false);
    }
  }

  useEffect(() => {
    loadPurchase();
  }, []);

  // =====================================================
  // PILIH PO
  // =====================================================

  function pilihPO(po: any) {
    setSelected(po);

    setBarangScanMessage("");
    setBatchScanMessage("");

    setShowBarangScanner(false);
    setShowBatchScanner(false);

    setBatchScanTarget("");

    const newRows: ReceiveRow[] =
      (po.items ?? []).map(
        (item: any, index: number) => ({
          rowId:
            `${item.barangId}-main-${index}`,

          barangId:
            Number(item.barangId),

          name:
            item.barang?.name ??
            "-",

          poQty:
            Number(item.qty ?? 0),

          alreadyReceivedQty:
            Number(
              item.receivedQty ?? 0
            ),

          price:
            Number(item.price ?? 0),

          hasExpired:
            Boolean(
              item.barang?.hasExpired
            ),

          batchNumber: "",

          expiredDate: "",

          qty: 0,

          isBatchRow: false,
        })
      );

    setRows(newRows);
  }

  // =====================================================
  // BARANG ROWS
  // =====================================================

  function getBarangRows(
    barangId: number
  ) {
    return rows.filter(
      (row) =>
        row.barangId === barangId
    );
  }

  // =====================================================
  // TOTAL QTY INPUT
  // =====================================================

  function getInputQty(
    barangId: number
  ) {
    return getBarangRows(
      barangId
    ).reduce(
      (total, row) =>
        total +
        Number(row.qty || 0),
      0
    );
  }

  // =====================================================
  // SISA QTY PO
  // =====================================================

  function getRemainingQty(
    barangId: number
  ) {
    const barangRows =
      getBarangRows(
        barangId
      );

    if (!barangRows.length) {
      return 0;
    }

    const first =
      barangRows[0];

    const remainingPO =
      Math.max(
        0,
        first.poQty -
          first.alreadyReceivedQty
      );

    const inputQty =
      getInputQty(
        barangId
      );

    return Math.max(
      0,
      remainingPO -
        inputQty
    );
  }

  // =====================================================
  // UPDATE QTY
  // =====================================================

  function updateQty(
    index: number,
    value: string
  ) {
    const row =
      rows[index];

    if (!row) {
      return;
    }

    let newQty =
      value === ""
        ? 0
        : Number(value);

    if (
      !Number.isFinite(
        newQty
      )
    ) {
      newQty = 0;
    }

    newQty =
      Math.max(
        0,
        Math.floor(newQty)
      );

    const otherQty =
      getInputQty(
        row.barangId
      ) -
      Number(
        row.qty || 0
      );

    const remainingForThisRow =
      Math.max(
        0,
        row.poQty -
          row.alreadyReceivedQty -
          otherQty
      );

    newQty =
      Math.min(
        newQty,
        remainingForThisRow
      );

    setRows(
      (current) =>
        current.map(
          (item, i) =>
            i === index
              ? {
                  ...item,
                  qty: newQty,
                }
              : item
        )
    );
  }

  // =====================================================
  // UPDATE BATCH
  // =====================================================

  function updateBatch(
    index: number,
    value: string
  ) {
    setRows(
      (current) =>
        current.map(
          (item, i) =>
            i === index
              ? {
                  ...item,
                  batchNumber:
                    value,
                }
              : item
        )
    );
  }

  // =====================================================
  // UPDATE EXPIRED
  // =====================================================

  function updateExpired(
    index: number,
    value: string
  ) {
    setRows(
      (current) =>
        current.map(
          (item, i) =>
            i === index
              ? {
                  ...item,
                  expiredDate:
                    value,
                }
              : item
        )
    );
  }

  // =====================================================
  // TAMBAH BATCH
  // =====================================================

  function addBatch(
    index: number
  ) {
    const source =
      rows[index];

    if (!source) {
      return;
    }

    if (
      !source.hasExpired
    ) {
      return;
    }

    const remaining =
      getRemainingQty(
        source.barangId
      );

    if (
      remaining <= 0
    ) {
      alert(
        `Qty ${source.name} sudah mencapai sisa PO.`
      );

      return;
    }

    const newRow: ReceiveRow =
      {
        ...source,

        rowId:
          `${source.barangId}-batch-${Date.now()}-${Math.random()}`,

        batchNumber: "",

        expiredDate: "",

        qty: 0,

        isBatchRow: true,
      };

    setRows(
      (current) => {
        const result =
          [...current];

        result.splice(
          index + 1,
          0,
          newRow
        );

        return result;
      }
    );

    /*
     * Setelah batch baru dibuat,
     * otomatis jadikan target scanner batch.
     */
    setTimeout(() => {
      setBatchScanTarget(
        newRow.rowId
      );
    }, 0);
  }

  // =====================================================
  // HAPUS BATCH
  // =====================================================

  function removeBatch(
    index: number
  ) {
    const row =
      rows[index];

    if (!row) {
      return;
    }

    if (
      !row.isBatchRow
    ) {
      return;
    }

    if (
      batchScanTarget ===
      row.rowId
    ) {
      setBatchScanTarget("");
    }

    setRows(
      (current) =>
        current.filter(
          (_, i) =>
            i !== index
        )
    );
  }

  // =====================================================
  // SCAN BARANG
  // =====================================================

  function handleBarangScan(
    barcode: string
  ) {
    const code =
      barcode.trim();

    if (!code) {
      return;
    }

    if (!selected) {
      setBarangScanMessage(
        "Pilih Purchase Order terlebih dahulu."
      );

      return;
    }

    const item =
      selected.items?.find(
        (item: any) => {
          const itemBarcode =
            String(
              item.barang?.barcode ??
                ""
            ).trim();

          const itemCode =
            String(
              item.barang?.code ??
                ""
            ).trim();

          return (
            itemBarcode ===
              code ||
            itemCode ===
              code
          );
        }
      );

    if (!item) {
      setBarangScanMessage(
        `Barcode ${code} tidak ditemukan di PO ${selected.number}.`
      );

      return;
    }

    const barangId =
      Number(
        item.barangId
      );

    const remaining =
      getRemainingQty(
        barangId
      );

    if (
      remaining <= 0
    ) {
      setBarangScanMessage(
        `${item.barang?.name ?? "Barang"} sudah mencapai Qty PO.`
      );

      return;
    }

    /*
     * Scanner barang selalu memasukkan
     * Qty ke row utama barang.
     */
    const rowIndex =
      rows.findIndex(
        (row) =>
          row.barangId ===
            barangId &&
          !row.isBatchRow
      );

    if (
      rowIndex === -1
    ) {
      setBarangScanMessage(
        "Baris barang tidak ditemukan."
      );

      return;
    }

    setRows(
      (current) =>
        current.map(
          (row, index) => {
            if (
              index !==
              rowIndex
            ) {
              return row;
            }

            return {
              ...row,
              qty:
                Number(
                  row.qty || 0
                ) + 1,
            };
          }
        )
    );

    const newTotal =
      getInputQty(
        barangId
      ) + 1;

    setBarangScanMessage(
      `✓ ${
        item.barang?.name ??
        "Barang"
      } — Qty ${newTotal}/${Number(
        item.qty ?? 0
      ) -
        Number(
          item.receivedQty ??
            0
        )}`
    );
  }

  // =====================================================
  // PARSE HASIL SCAN BATCH
  // =====================================================

  function parseBatchScan(
    rawValue: string
  ): {
    batchNumber: string;
    expiredDate: string;
    barangId: number | null;
  } {
    const raw =
      rawValue.trim();

    // ---------------------------------------------------
    // JSON QR
    // ---------------------------------------------------

    try {
      const data =
        JSON.parse(raw);

      if (
        data &&
        typeof data ===
          "object"
      ) {
        return {
          batchNumber:
            String(
              data.batchNumber ??
                data.batch ??
                ""
            ).trim(),

          expiredDate:
            data.expiredDate
              ? String(
                  data.expiredDate
                ).substring(
                  0,
                  10
                )
              : "",

          barangId:
            data.barangId !==
                undefined &&
            data.barangId !==
                null
              ? Number(
                  data.barangId
                )
              : null,
        };
      }
    } catch {
      // Bukan JSON
    }

    // ---------------------------------------------------
    // FORMAT MGB
    //
    // MGB|235|BVG049|GR-xxx|2027-02-25
    // ---------------------------------------------------

    if (
      raw.startsWith(
        "MGB|"
      )
    ) {
      const parts =
        raw.split("|");

      const barangId =
        Number(
          parts[1]
        );

      return {
        batchNumber:
          String(
            parts[2] ?? ""
          ).trim(),

        expiredDate:
          parts[4]
            ? String(
                parts[4]
              ).substring(
                0,
                10
              )
            : "",

        barangId:
          Number.isInteger(
            barangId
          )
            ? barangId
            : null,
      };
    }

    // ---------------------------------------------------
    // BARCODE BIASA
    // ---------------------------------------------------

    return {
      batchNumber:
        raw,

      expiredDate: "",

      barangId: null,
    };
  }

  // =====================================================
  // SCAN BATCH GLOBAL
  // =====================================================

  function handleBatchScan(
    barcode: string
  ) {
    const raw =
      barcode.trim();

    if (!raw) {
      return;
    }

    if (!batchScanTarget) {
      setBatchScanMessage(
        "Pilih barang/batch tujuan terlebih dahulu."
      );

      return;
    }

    const targetIndex =
      rows.findIndex(
        (row) =>
          row.rowId ===
          batchScanTarget
      );

    if (
      targetIndex === -1
    ) {
      setBatchScanMessage(
        "Baris batch tujuan tidak ditemukan."
      );

      return;
    }

    const targetRow =
      rows[targetIndex];

    const parsed =
      parseBatchScan(
        raw
      );

    if (
      !parsed.batchNumber
    ) {
      setBatchScanMessage(
        "Hasil scan tidak memiliki Batch Number."
      );

      return;
    }

    /*
     * Kalau QR membawa barangId,
     * pastikan sesuai dengan row tujuan.
     */
    if (
      parsed.barangId !==
        null &&
      parsed.barangId !==
        targetRow.barangId
    ) {
      setBatchScanMessage(
        `QR Batch bukan untuk barang "${targetRow.name}".`
      );

      return;
    }

    setRows(
      (current) =>
        current.map(
          (row) =>
            row.rowId ===
            batchScanTarget
              ? {
                  ...row,

                  batchNumber:
                    parsed.batchNumber,

                  expiredDate:
                    parsed.expiredDate ||
                    row.expiredDate,
                }
              : row
        )
    );

    setBatchScanMessage(
      `✓ Batch "${parsed.batchNumber}" berhasil dimasukkan ke ${targetRow.name}.`
    );

    /*
     * Tutup scanner setelah berhasil.
     */
    setShowBatchScanner(
      false
    );
  }

  // =====================================================
  // VALIDASI
  // =====================================================

  function validate() {
    if (!selected) {
      alert(
        "Pilih Purchase Order terlebih dahulu."
      );

      return false;
    }

    if (!rows.length) {
      alert(
        "Tidak ada barang pada Purchase Order."
      );

      return false;
    }

    const barangIds = [
      ...new Set(
        rows.map(
          (row) =>
            row.barangId
        )
      ),
    ];

    for (
      const barangId of barangIds
    ) {
      const barangRows =
        getBarangRows(
          barangId
        );

      if (
        !barangRows.length
      ) {
        continue;
      }

      const first =
        barangRows[0];

      const totalQty =
        barangRows.reduce(
          (
            total,
            row
          ) =>
            total +
            Number(
              row.qty || 0
            ),
          0
        );

      const sisaPO =
        Math.max(
          0,
          first.poQty -
            first.alreadyReceivedQty
        );

      if (
        totalQty <= 0
      ) {
        alert(
          `Qty ${first.name} yang diterima harus lebih dari 0.`
        );

        return false;
      }

      if (
        totalQty >
        sisaPO
      ) {
        alert(
          `Qty ${first.name} melebihi sisa PO.\n\n` +
            `Sisa PO: ${sisaPO}\n` +
            `Qty diterima: ${totalQty}`
        );

        return false;
      }

      // -------------------------------------------------
      // BARANG EXPIRED
      // -------------------------------------------------

      if (
        first.hasExpired
      ) {
        for (
          const row of barangRows
        ) {
          const qty =
            Number(
              row.qty || 0
            );

          if (
            qty <= 0
          ) {
            continue;
          }

          if (
            !row.batchNumber.trim()
          ) {
            alert(
              `Batch Number wajib diisi untuk ${row.name}.`
            );

            return false;
          }

          if (
            !row.expiredDate
          ) {
            alert(
              `Expired Date wajib diisi untuk batch ${row.batchNumber}.`
            );

            return false;
          }
        }
      }
    }

    // ---------------------------------------------------
    // CEK DUPLIKAT BATCH
    // ---------------------------------------------------

    for (
      const barangId of barangIds
    ) {
      const barangRows =
        getBarangRows(
          barangId
        ).filter(
          (row) =>
            Number(
              row.qty || 0
            ) > 0
        );

      if (
        barangRows.length <=
        1
      ) {
        continue;
      }

      const batches =
        barangRows.map(
          (row) =>
            row.batchNumber
              .trim()
              .toLowerCase()
        );

      const duplicate =
        batches.find(
          (
            batch,
            index
          ) =>
            batches.indexOf(
              batch
            ) !== index
        );

      if (duplicate) {
        const barang =
          barangRows[0]
            ?.name ??
          "Barang";

        alert(
          `Batch "${duplicate}" digunakan lebih dari satu kali untuk ${barang}.`
        );

        return false;
      }
    }

    return true;
  }

  // =====================================================
  // RECEIVE
  // =====================================================

  async function receive() {
    if (!validate()) {
      return;
    }

    setReceiving(true);

    try {
      const receiveItems =
        rows
          .filter(
            (row) =>
              Number(
                row.qty || 0
              ) > 0
          )
          .map(
            (row) => ({
              barangId:
                Number(
                  row.barangId
                ),

              qty:
                Number(
                  row.qty
                ),

              price:
                Number(
                  row.price || 0
                ),

              batchNumber:
                row.hasExpired
                  ? row.batchNumber
                      .trim()
                  : null,

              expiredDate:
                row.hasExpired
                  ? row.expiredDate
                  : null,
            })
          );

      console.log(
        "GOODS RECEIPT PAYLOAD:",
        {
          purchaseId:
            selected.id,

          items:
            receiveItems,
        }
      );

      const res =
        await fetch(
          "/api/goods-receipt",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                purchaseId:
                  Number(
                    selected.id
                  ),

                items:
                  receiveItems,
              }),
          }
        );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        alert(
          json.message ??
            "Gagal menerima barang."
        );

        return;
      }

      alert(
        json.message ??
          "Barang berhasil diterima."
      );

      resetForm();

      await loadPurchase();
    } catch (error) {
      console.error(
        "RECEIVE BARANG ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menerima barang."
      );
    } finally {
      setReceiving(false);
    }
  }

  // =====================================================
  // TOTAL QTY
  // =====================================================

  const totalReceive =
    useMemo(
      () =>
        rows.reduce(
          (
            total,
            row
          ) =>
            total +
            Number(
              row.qty || 0
            ),
          0
        ),
      [rows]
    );

  // =====================================================
  // TOTAL ITEM
  // =====================================================

  const totalItem =
    useMemo(
      () =>
        new Set(
          rows.map(
            (row) =>
              row.barangId
          )
        ).size,
      [rows]
    );

  // =====================================================
  // TARGET BATCH OPTIONS
  // =====================================================

  const batchTargets =
    useMemo(
      () =>
        rows.filter(
          (row) =>
            row.hasExpired
        ),
      [rows]
    );

  // =====================================================
  // RESET
  // =====================================================

  function resetForm() {
    setSelected(null);

    setRows([]);

    setBarangScanMessage("");

    setBatchScanMessage("");

    setShowBarangScanner(false);

    setShowBatchScanner(false);

    setBatchScanTarget("");
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <PackageCheck size={24} />
          </div>

          <div>

            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Barang Masuk
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Penerimaan barang berdasarkan Purchase Order
            </p>

          </div>

        </div>

        <button
          type="button"
          onClick={
            loadPurchase
          }
          disabled={
            loadingPurchase
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-50"
        >

          <RefreshCw
            size={17}
            className={
              loadingPurchase
                ? "animate-spin"
                : ""
            }
          />

          Refresh

        </button>

      </div>

      {/* =================================================
          PO LIST
      ================================================= */}

      <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        <div className="border-b border-[#E5ECE9] p-5">

          <div className="flex items-center justify-between">

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Purchase Order Siap Diterima
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Pilih PO yang sudah di-approve untuk menerima barang.
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <ShoppingCart size={20} />
            </div>

          </div>

        </div>

        <div className="p-5">

          {loadingPurchase ? (

            <div className="flex flex-col items-center justify-center py-12 text-gray-500">

              <RefreshCw
                size={25}
                className="mb-3 animate-spin text-[#497F70]"
              />

              <span className="text-sm">
                Memuat Purchase Order...
              </span>

            </div>

          ) : purchase.length ===
            0 ? (

            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#DDE9E4] bg-[#FAFCFB] py-12">

              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF3EF] text-[#497F70]">
                <CheckCircle2 size={26} />
              </div>

              <p className="mt-4 font-semibold text-gray-700">
                Tidak ada PO yang siap diterima
              </p>

              <p className="mt-1 text-sm text-gray-400">
                Semua Purchase Order yang approved sudah diproses.
              </p>

            </div>

          ) : (

            <div className="grid gap-3">

              {purchase.map(
                (po: any) => {

                  const isSelected =
                    selected?.id ===
                    po.id;

                  return (
                    <button
                      type="button"
                      key={po.id}
                      onClick={() =>
                        pilihPO(
                          po
                        )
                      }
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        isSelected
                          ? "border-[#497F70] bg-[#EAF3EF] shadow-sm"
                          : "border-[#E1E9E5] bg-white hover:border-[#AFCBC0] hover:bg-[#FAFCFB]"
                      }`}
                    >

                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                        <div>

                          <div className="flex items-center gap-2">

                            <span className="font-bold text-[#18352D]">
                              {po.number}
                            </span>

                            {isSelected && (
                              <span className="rounded-full bg-[#497F70] px-2.5 py-1 text-[11px] font-semibold text-white">
                                DIPILIH
                              </span>
                            )}

                          </div>

                          <p className="mt-1 text-sm text-gray-500">
                            {po.supplier
                              ?.name ??
                              po.supplierName ??
                              "-"}
                          </p>

                        </div>

                        <div className="flex items-center gap-5 text-sm">

                          <div>

                            <p className="text-xs text-gray-400">
                              Tanggal
                            </p>

                            <p className="mt-1 font-medium text-gray-700">
                              {po.date
                                ? new Date(
                                    po.date
                                  ).toLocaleDateString(
                                    "id-ID"
                                  )
                                : po.purchaseDate
                                ? new Date(
                                    po.purchaseDate
                                  ).toLocaleDateString(
                                    "id-ID"
                                  )
                                : "-"}
                            </p>

                          </div>

                          <div>

                            <p className="text-xs text-gray-400">
                              Status
                            </p>

                            <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              APPROVED
                            </span>

                          </div>

                        </div>

                      </div>

                    </button>
                  );
                }
              )}

            </div>

          )}

        </div>

      </div>

      {/* =================================================
          DETAIL RECEIVE
      ================================================= */}

      {selected && (

        <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

          {/* =================================================
              HEADER
          ================================================= */}

          <div className="border-b border-[#E5ECE9] bg-[#FAFCFB] p-5">

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-[#497F70]">
                  Penerimaan Barang
                </p>

                <h2 className="mt-1 text-xl font-bold text-[#18352D]">
                  PO {selected.number}
                </h2>

              </div>

              <div className="flex flex-wrap items-center gap-2">

                {/* SCAN BARANG GLOBAL */}

                <button
                  type="button"
                  onClick={() => {
                    setBarangScanMessage("");
                    setShowBarangScanner(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3E6F62]"
                >

                  <Camera size={17} />

                  Scan Barang

                </button>

                {/* SCAN BATCH GLOBAL */}

                {batchTargets.length > 0 && (

                  <button
                    type="button"
                    onClick={() => {
                      setBatchScanMessage("");
                      setShowBatchScanner(true);

                      /*
                       * Kalau belum ada target,
                       * pilih target pertama.
                       */
                      if (
                        !batchScanTarget
                      ) {
                        setBatchScanTarget(
                          batchTargets[0]
                            .rowId
                        );
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#18352D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#102720]"
                  >

                    <Barcode size={17} />

                    Scan Batch

                  </button>

                )}

                <div className="flex h-10 items-center gap-2 rounded-xl bg-[#EAF3EF] px-4 text-sm font-semibold text-[#497F70]">

                  <ShoppingCart size={17} />

                  {totalItem} Item

                </div>

              </div>

            </div>

          </div>

          {/* =================================================
              INFO SCANNER
          ================================================= */}

          <div className="border-b border-[#E5ECE9] bg-[#FAFCFB] p-5">

            <div className="grid gap-4 md:grid-cols-2">

              {/* SCAN BARANG */}

              <div className="rounded-xl border border-[#DDE9E4] bg-white p-4">

                <div className="flex items-start gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">

                    <ScanLine size={19} />

                  </div>

                  <div>

                    <p className="text-sm font-semibold text-[#18352D]">
                      Scanner Barang
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Gunakan barcode produk untuk menambah Qty penerimaan. Barang tanpa barcode tetap bisa diisi manual.
                    </p>

                  </div>

                </div>

                {barangScanMessage && (
                  <div className="mt-3 rounded-lg border border-[#D5E5DC] bg-[#EAF3EF] px-3 py-2 text-xs font-medium text-[#35564C]">
                    {barangScanMessage}
                  </div>
                )}

              </div>

              {/* SCAN BATCH */}

              {batchTargets.length > 0 && (

                <div className="rounded-xl border border-[#DDE9E4] bg-white p-4">

                  <div className="flex items-start gap-3">

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F5F1E7] text-[#8A6A28]">

                      <Barcode size={19} />

                    </div>

                    <div className="min-w-0 flex-1">

                      <p className="text-sm font-semibold text-[#18352D]">
                        Scanner Batch
                      </p>

                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        Pilih baris batch, lalu scan nomor batch dari kemasan.
                      </p>

                    </div>

                  </div>

                  <div className="mt-3">

                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Scan Batch untuk
                    </label>

                    <select
                      value={
                        batchScanTarget
                      }
                      onChange={(e) =>
                        setBatchScanTarget(
                          e.target.value
                        )
                      }
                      className="w-full rounded-lg border border-[#D5E5DC] bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                    >

                      <option value="">
                        Pilih barang / batch
                      </option>

                      {batchTargets.map(
                        (row, index) => (
                          <option
                            key={
                              row.rowId
                            }
                            value={
                              row.rowId
                            }
                          >
                            {row.name}
                            {row.isBatchRow
                              ? ` — Batch tambahan`
                              : ` — Batch utama`}
                            {row.batchNumber
                              ? ` (${row.batchNumber})`
                              : ""}
                          </option>
                        )
                      )}

                    </select>

                  </div>

                  {batchScanMessage && (
                    <div className="mt-3 rounded-lg border border-[#D5E5DC] bg-[#EAF3EF] px-3 py-2 text-xs font-medium text-[#35564C]">
                      {batchScanMessage}
                    </div>
                  )}

                </div>

              )}

            </div>

          </div>

          {/* =================================================
              TABLE
          ================================================= */}

          <div className="p-5">

            <div className="overflow-hidden rounded-xl border border-[#E1E9E5]">

              <div className="overflow-x-auto">

                <table className="min-w-[1250px] w-full text-sm">

                  <thead className="bg-[#F5F8F6]">

                    <tr className="border-b border-[#E5ECE9]">

                      <th className="px-4 py-3 text-center font-semibold text-[#35564C]">
                        No
                      </th>

                      <th className="px-4 py-3 text-left font-semibold text-[#35564C]">
                        Barang
                      </th>

                      <th className="px-4 py-3 text-right font-semibold text-[#35564C]">
                        Qty PO
                      </th>

                      <th className="px-4 py-3 text-right font-semibold text-[#35564C]">
                        Sudah Diterima
                      </th>

                      <th className="px-4 py-3 text-center font-semibold text-[#35564C]">
                        Qty Terima
                      </th>

                      <th className="px-4 py-3 text-center font-semibold text-[#35564C]">
                        Batch Number
                      </th>

                      <th className="px-4 py-3 text-center font-semibold text-[#35564C]">
                        Expired Date
                      </th>

                      <th className="px-4 py-3 text-center font-semibold text-[#35564C]">
                        Aksi
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {rows.map(
                      (
                        row,
                        index
                      ) => {

                        const inputQty =
                          getInputQty(
                            row.barangId
                          );

                        const remaining =
                          getRemainingQty(
                            row.barangId
                          );

                        const isScanned =
                          Number(
                            row.qty
                          ) > 0;

                        return (
                          <tr
                            key={
                              row.rowId
                            }
                            className={`border-b border-[#EDF2EF] transition ${
                              row.isBatchRow
                                ? "bg-[#F0F8F4]"
                                : isScanned
                                ? "bg-[#F7FBF9]"
                                : ""
                            }`}
                          >

                            {/* NO */}

                            <td className="px-4 py-4 text-center text-gray-400">
                              {index + 1}
                            </td>

                            {/* BARANG */}

                            <td className="px-4 py-4">

                              <div
                                className={`flex items-start gap-3 ${
                                  row.isBatchRow
                                    ? "pl-6"
                                    : ""
                                }`}
                              >

                                {row.isBatchRow && (
                                  <span className="mt-1 text-[#497F70]">
                                    ↳
                                  </span>
                                )}

                                {isScanned &&
                                  !row.isBatchRow && (
                                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#497F70] text-white">
                                      <CheckCircle2
                                        size={16}
                                      />
                                    </div>
                                  )}

                                <div>

                                  <p className="font-semibold text-[#18352D]">
                                    {row.name}
                                  </p>

                                  {row.hasExpired && (
                                    <p className="mt-1 text-xs text-amber-600">
                                      Menggunakan Batch & Expired
                                    </p>
                                  )}

                                  {row.isBatchRow && (
                                    <p className="mt-1 text-xs text-gray-400">
                                      Batch tambahan
                                    </p>
                                  )}

                                </div>

                              </div>

                            </td>

                            {/* QTY PO */}

                            <td className="px-4 py-4 text-right font-medium text-gray-700">

                              {!row.isBatchRow
                                ? row.poQty.toLocaleString(
                                    "id-ID"
                                  )
                                : "-"}

                            </td>

                            {/* SUDAH DITERIMA */}

                            <td className="px-4 py-4 text-right font-medium text-gray-700">

                              {!row.isBatchRow
                                ? row.alreadyReceivedQty.toLocaleString(
                                    "id-ID"
                                  )
                                : "-"}

                            </td>

                            {/* QTY */}

                            <td className="px-4 py-4 text-center">

                              <div className="flex flex-col items-center gap-1">

                                <input
                                  type="number"
                                  min="0"
                                  value={
                                    row.qty
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    updateQty(
                                      index,
                                      e.target
                                        .value
                                    )
                                  }
                                  className="w-28 rounded-lg border border-[#D5E5DC] bg-white px-3 py-2 text-center font-medium text-gray-700 outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                                />

                                <span className="text-[11px] text-gray-400">
                                  Total input:{" "}
                                  {inputQty}
                                  {" • "}
                                  Sisa:{" "}
                                  {remaining}
                                </span>

                              </div>

                            </td>

                            {/* BATCH */}

                            <td className="px-4 py-4">

                              {row.hasExpired ? (

                                <div className="flex items-center gap-2">

                                  <Barcode
                                    size={16}
                                    className="shrink-0 text-[#497F70]"
                                  />

                                  <input
                                    type="text"
                                    value={
                                      row.batchNumber
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      updateBatch(
                                        index,
                                        e.target
                                          .value
                                      )
                                    }
                                    placeholder="BATCH-001"
                                    className="w-48 rounded-lg border border-[#D5E5DC] bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                                  />

                                </div>

                              ) : (

                                <span className="text-xs text-gray-400">
                                  Tidak menggunakan batch
                                </span>

                              )}

                            </td>

                            {/* EXPIRED */}

                            <td className="px-4 py-4">

                              {row.hasExpired ? (

                                <div className="flex items-center gap-2">

                                  <CalendarDays
                                    size={16}
                                    className="shrink-0 text-[#497F70]"
                                  />

                                  <input
                                    type="date"
                                    value={
                                      row.expiredDate
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      updateExpired(
                                        index,
                                        e.target
                                          .value
                                      )
                                    }
                                    className="rounded-lg border border-[#D5E5DC] bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                                  />

                                </div>

                              ) : (

                                <span className="text-xs text-gray-400">
                                  Tidak menggunakan expired
                                </span>

                              )}

                            </td>

                            {/* AKSI */}

                            <td className="px-4 py-4 text-center">

                              {row.hasExpired && (

                                <div className="flex items-center justify-center gap-2">

                                  <button
                                    type="button"
                                    onClick={() =>
                                      addBatch(
                                        index
                                      )
                                    }
                                    disabled={
                                      remaining <=
                                      0
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg bg-[#497F70] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3E6F62] disabled:cursor-not-allowed disabled:opacity-40"
                                  >

                                    <Plus
                                      size={14}
                                    />

                                    Batch

                                  </button>

                                  {row.isBatchRow && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeBatch(
                                          index
                                        )
                                      }
                                      className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                                    >

                                      <Trash2
                                        size={14}
                                      />

                                      Hapus

                                    </button>
                                  )}

                                </div>

                              )}

                            </td>

                          </tr>
                        );
                      }
                    )}

                  </tbody>

                  <tfoot>

                    <tr className="bg-[#F5F8F6]">

                      <td
                        colSpan={4}
                        className="px-4 py-4 text-right font-semibold text-[#35564C]"
                      >
                        Total Qty Diterima
                      </td>

                      <td className="px-4 py-4 text-center font-bold text-[#18352D]">

                        {totalReceive.toLocaleString(
                          "id-ID"
                        )}

                      </td>

                      <td colSpan={3} />

                    </tr>

                  </tfoot>

                </table>

              </div>

            </div>

            {/* =================================================
                WARNING
            ================================================= */}

            {rows.some(
              (row) =>
                row.hasExpired
            ) && (

              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">

                <AlertTriangle
                  size={19}
                  className="mt-0.5 shrink-0 text-amber-600"
                />

                <div>

                  <p className="text-sm font-semibold text-amber-800">
                    Perhatian Batch & Expired Date
                  </p>

                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    Barang yang menggunakan sistem expired wajib memiliki Batch Number dan Expired Date. Satu barang boleh memiliki beberapa batch dalam satu penerimaan.
                  </p>

                </div>

              </div>

            )}

            {/* =================================================
                ACTION
            ================================================= */}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

              <button
                type="button"
                onClick={
                  resetForm
                }
                disabled={
                  receiving
                }
                className="rounded-xl border border-[#D5E5DC] bg-white px-5 py-3 text-sm font-medium text-gray-700 transition hover:bg-[#F5F8F6] disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={
                  receive
                }
                disabled={
                  receiving ||
                  totalReceive <=
                    0
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3E6F62] disabled:cursor-not-allowed disabled:opacity-50"
              >

                {receiving ? (
                  <>
                    <RefreshCw
                      size={17}
                      className="animate-spin"
                    />

                    Memproses...
                  </>
                ) : (
                  <>
                    <PackageCheck
                      size={17}
                    />

                    Terima Barang
                  </>
                )}

              </button>

            </div>

          </div>

        </div>
      )}

      {/* =====================================================
          MODAL SCAN BARANG GLOBAL
      ===================================================== */}

      {showBarangScanner && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">

          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">

              <div>

                <h3 className="font-semibold text-[#18352D]">
                  Scan Barcode Barang
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Scan barcode produk untuk menambah Qty penerimaan.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowBarangScanner(
                    false
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
              >

                <X size={20} />

              </button>

            </div>

            <div className="p-5">

              <BarcodeInputScanner
                onScan={
                  handleBarangScan
                }
              />

              <button
                type="button"
                onClick={() =>
                  setShowBarangScanner(
                    false
                  )
                }
                className="mt-4 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Selesai
              </button>

            </div>

          </div>

        </div>

      )}

      {/* =====================================================
          MODAL SCAN BATCH GLOBAL
      ===================================================== */}

      {showBatchScanner && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">

          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">

              <div>

                <h3 className="font-semibold text-[#18352D]">
                  Scan Batch Number
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Pilih target batch kemudian scan barcode / QR batch.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowBatchScanner(
                    false
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
              >

                <X size={20} />

              </button>

            </div>

            <div className="space-y-4 p-5">

              {/* TARGET */}

              <div>

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Batch untuk
                </label>

                <select
                  value={
                    batchScanTarget
                  }
                  onChange={(e) =>
                    setBatchScanTarget(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[#D5E5DC] bg-white px-3 py-3 text-sm text-gray-700 outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                >

                  <option value="">
                    Pilih barang / batch
                  </option>

                  {batchTargets.map(
                    (row) => (
                      <option
                        key={
                          row.rowId
                        }
                        value={
                          row.rowId
                        }
                      >
                        {row.name}
                        {row.isBatchRow
                          ? " — Batch tambahan"
                          : " — Batch utama"}
                        {row.batchNumber
                          ? ` (${row.batchNumber})`
                          : ""}
                      </option>
                    )
                  )}

                </select>

              </div>

              {/* SCANNER */}

              <BarcodeInputScanner
                onScan={
                  handleBatchScan
                }
              />

              {batchScanMessage && (

                <div className="rounded-xl border border-[#D5E5DC] bg-[#EAF3EF] px-4 py-3 text-sm font-medium text-[#35564C]">
                  {batchScanMessage}
                </div>

              )}

              <button
                type="button"
                onClick={() =>
                  setShowBatchScanner(
                    false
                  )
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Selesai
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}