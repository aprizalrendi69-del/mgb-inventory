"use client";

import { useEffect, useMemo, useState } from "react";

import {
  PackageCheck,
  ShoppingCart,
  CalendarDays,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Barcode,
  ScanLine,
  Plus,
  Trash2,
  Package,
  ClipboardCheck,
  Boxes,
  ArrowRight,
  Sparkles,
  ChevronRight,
  CircleCheck,
  Clock3,
  ShieldCheck,
  ScanBarcode,
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
  // SUPPLIER INVOICE
  // =====================================================

  const [invoiceNumber, setInvoiceNumber] =
    useState("");

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
  // SCANNER BARANG
  // =====================================================

  const [showBarangScanner, setShowBarangScanner] =
    useState(false);

  const [barangScanMessage, setBarangScanMessage] =
    useState("");

  // =====================================================
  // SCANNER BATCH
  // =====================================================

  const [showBatchScanner, setShowBatchScanner] =
    useState(false);

  const [batchScanMessage, setBatchScanMessage] =
    useState("");

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

    // Invoice selalu diisi ulang secara manual
    // setiap kali PO berganti.
    setInvoiceNumber("");

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
  // TOTAL INPUT QTY
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
      `✓ ${item.barang?.name ?? "Barang"} — Qty ${newTotal}/${Number(
        item.qty ?? 0
      ) -
        Number(
          item.receivedQty ??
            0
        )}`
    );
  }

  // =====================================================
  // PARSE BATCH SCAN
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

    return {
      batchNumber:
        raw,

      expiredDate: "",

      barangId: null,
    };
  }

  // =====================================================
  // SCAN BATCH
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

    // ===================================================
    // VALIDASI INVOICE SUPPLIER
    // ===================================================

    const paymentMethod =
      String(
        selected.paymentMethod ??
          ""
      )
        .trim()
        .toUpperCase();

    if (
      paymentMethod ===
        "TEMPO" &&
      !invoiceNumber.trim()
    ) {
      alert(
        "Nomor Invoice Supplier wajib diisi untuk pembayaran TEMPO."
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

    // ===================================================
    // DUPLICATE BATCH
    // ===================================================

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

          invoiceNumber:
            invoiceNumber.trim() ||
            null,

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

                // Invoice supplier diisi
                // manual pada saat penerimaan.
                invoiceNumber:
                  invoiceNumber.trim() ||
                  null,
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
  // TOTAL PO QTY
  // =====================================================

  const totalPOQty =
    useMemo(
      () =>
        rows
          .filter(
            (row) =>
              !row.isBatchRow
          )
          .reduce(
            (
              total,
              row
            ) =>
              total +
              Math.max(
                0,
                row.poQty -
                  row.alreadyReceivedQty
              ),
            0
          ),
      [rows]
    );

  // =====================================================
  // RECEIVE PROGRESS
  // =====================================================

  const receiveProgress =
    useMemo(() => {
      if (
        totalPOQty <= 0
      ) {
        return 0;
      }

      return Math.min(
        100,
        Math.round(
          (totalReceive /
            totalPOQty) *
            100
        )
      );
    }, [
      totalReceive,
      totalPOQty,
    ]);

  // =====================================================
  // TOTAL BATCH
  // =====================================================

  const totalBatch =
    useMemo(
      () =>
        rows.filter(
          (row) =>
            row.hasExpired &&
            row.isBatchRow
        ).length,
      [rows]
    );

  // =====================================================
  // TARGET BATCH
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

    setInvoiceNumber("");

    setRows([]);

    setBarangScanMessage("");

    setBatchScanMessage("");

    setShowBarangScanner(false);

    setShowBatchScanner(false);

    setBatchScanTarget("");
  }

  // =====================================================
  // FORMAT DATE
  // =====================================================

  function formatDate(
    value: any
  ) {
    if (!value) {
      return "-";
    }

    try {
      return new Date(
        value
      ).toLocaleDateString(
        "id-ID",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );
    } catch {
      return "-";
    }
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-screen bg-[#F4F7F5] text-[#18352D]">

      <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">

        {/* =================================================
            PREMIUM HEADER
        ================================================= */}

        <div className="relative mb-7 overflow-hidden rounded-[24px] border border-[#DDE9E4] bg-white shadow-[0_8px_35px_rgba(24,53,45,0.06)]">

          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#EAF3EF] blur-3xl" />

          <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#F0F6F3] blur-3xl" />

          <div className="relative flex flex-col gap-6 p-6 md:p-7 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-start gap-4">

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#497F70] text-white shadow-[0_8px_20px_rgba(73,127,112,0.25)]">

                <PackageCheck
                  size={27}
                  strokeWidth={2}
                />

              </div>

              <div>

                <div className="mb-2 flex flex-wrap items-center gap-2">

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF3EF] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#497F70]">

                    <Sparkles size={12} />

                    Inventory Receiving

                  </span>

                  <span className="rounded-full border border-[#DDE9E4] bg-white px-3 py-1 text-[11px] font-semibold text-gray-500">

                    Gudang Pusat

                  </span>

                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">

                  Barang Masuk

                </h1>

                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-gray-500">

                  Kelola penerimaan barang dari Purchase Order yang
                  telah disetujui dengan kontrol Qty, batch, dan
                  expired date yang terstruktur.

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
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-5 text-sm font-semibold text-[#35564C] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#AFCBC0] hover:bg-[#F8FBF9] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >

              <RefreshCw
                size={17}
                className={
                  loadingPurchase
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh Data

            </button>

          </div>

        </div>

        {/* =================================================
            OVERVIEW CARDS
        ================================================= */}

        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* PO */}

          <div className="group rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  PO Siap Diproses
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-[#18352D]">
                  {loadingPurchase
                    ? "—"
                    : purchase.length.toLocaleString(
                        "id-ID"
                      )}
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70] transition-transform group-hover:scale-105">

                <ShoppingCart
                  size={20}
                />

              </div>

            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">

              <Clock3 size={14} />

              Menunggu penerimaan

            </div>

          </div>

          {/* ITEM */}

          <div className="group rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Item PO Aktif
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-[#18352D]">
                  {selected
                    ? totalItem.toLocaleString(
                        "id-ID"
                      )
                    : "—"}
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF4F1] text-[#497F70] transition-transform group-hover:scale-105">

                <Boxes
                  size={20}
                />

              </div>

            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">

              <Package size={14} />

              {selected
                ? "Barang pada PO terpilih"
                : "Pilih PO untuk melihat"}

            </div>

          </div>

          {/* QTY */}

          <div className="group rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Qty Penerimaan
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-[#18352D]">
                  {selected
                    ? totalReceive.toLocaleString(
                        "id-ID"
                      )
                    : "—"}
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F1F5EE] text-[#607E4D] transition-transform group-hover:scale-105">

                <PackageCheck
                  size={20}
                />

              </div>

            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">

              <ClipboardCheck
                size={14}
              />

              Qty yang akan diterima

            </div>

          </div>

          {/* PROGRESS */}

          <div className="group rounded-2xl border border-[#DDE9E4] bg-[#18352D] p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-[#BFD6CE]">
                  Progress
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-white">

                  {selected
                    ? `${receiveProgress}%`
                    : "—"}

                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white">

                <CircleCheck
                  size={20}
                />

              </div>

            </div>

            <div className="mt-4">

              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">

                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
                  style={{
                    width: `${
                      selected
                        ? receiveProgress
                        : 0
                    }%`,
                  }}
                />

              </div>

              <p className="mt-2 text-[11px] text-[#BFD6CE]">

                {selected
                  ? `${totalReceive.toLocaleString(
                      "id-ID"
                    )} / ${totalPOQty.toLocaleString(
                      "id-ID"
                    )} Qty`

                  : "Pilih PO untuk memulai"}

              </p>

            </div>

          </div>

        </div>

        {/* =================================================
            PO LIST
        ================================================= */}

        <div className="mb-7 overflow-hidden rounded-[24px] border border-[#DDE9E4] bg-white shadow-[0_8px_30px_rgba(24,53,45,0.045)]">

          <div className="flex flex-col gap-4 border-b border-[#E8EEEB] bg-[#FBFCFB] p-5 md:flex-row md:items-center md:justify-between md:px-6">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">

                <ShoppingCart
                  size={20}
                />

              </div>

              <div>

                <div className="flex items-center gap-2">

                  <h2 className="font-bold text-[#18352D]">
                    Purchase Order Siap Diterima
                  </h2>

                  <span className="rounded-full bg-[#EAF3EF] px-2.5 py-1 text-[10px] font-bold text-[#497F70]">
                    {purchase.length}
                  </span>

                </div>

                <p className="mt-1 text-xs text-gray-500">
                  Pilih Purchase Order yang telah approved untuk
                  memulai proses penerimaan.
                </p>

              </div>

            </div>

            <div className="hidden items-center gap-2 text-xs font-medium text-gray-400 md:flex">

              <ShieldCheck
                size={15}
              />

              Approved PO only

            </div>

          </div>

          <div className="p-5 md:p-6">

            {loadingPurchase ? (

              <div className="grid gap-3">

                {[1, 2, 3].map(
                  (item) => (
                    <div
                      key={item}
                      className="animate-pulse rounded-2xl border border-[#E8EEEB] p-5"
                    >

                      <div className="flex items-center justify-between">

                        <div className="space-y-2">

                          <div className="h-4 w-40 rounded bg-gray-200" />

                          <div className="h-3 w-56 rounded bg-gray-100" />

                        </div>

                        <div className="h-10 w-24 rounded-xl bg-gray-100" />

                      </div>

                    </div>
                  )
                )}

              </div>

            ) : purchase.length === 0 ? (

              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D6E3DD] bg-[#FBFCFB] px-6 py-16 text-center">

                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">

                  <CheckCircle2
                    size={30}
                  />

                </div>

                <h3 className="mt-5 text-base font-bold text-[#18352D]">
                  Semua PO Sudah Tertangani
                </h3>

                <p className="mt-2 max-w-md text-sm leading-6 text-gray-400">
                  Tidak ada Purchase Order pusat dengan status
                  APPROVED yang menunggu proses penerimaan.
                </p>

                <button
                  type="button"
                  onClick={
                    loadPurchase
                  }
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-sm font-semibold text-[#497F70] shadow-sm transition hover:bg-[#F5F8F6]"
                >

                  <RefreshCw
                    size={15}
                  />

                  Periksa Lagi

                </button>

              </div>

            ) : (

              <div className="grid gap-3">

                {purchase.map(
                  (po: any) => {

                    const isSelected =
                      selected?.id ===
                      po.id;

                    const itemCount =
                      po.items?.length ??
                      0;

                    const totalQty =
                      (
                        po.items ??
                        []
                      ).reduce(
                        (
                          total: number,
                          item: any
                        ) =>
                          total +
                          Number(
                            item.qty ??
                              0
                          ),
                        0
                      );

                    return (
                      <button
                        type="button"
                        key={
                          po.id
                        }
                        onClick={() =>
                          pilihPO(
                            po
                          )
                        }
                        className={`group w-full rounded-2xl border p-4 text-left transition-all duration-200 md:p-5 ${
                          isSelected
                            ? "border-[#497F70] bg-[#F3F9F6] shadow-[0_8px_25px_rgba(73,127,112,0.10)]"
                            : "border-[#E3EBE7] bg-white hover:-translate-y-0.5 hover:border-[#B8D0C5] hover:bg-[#FBFDFC] hover:shadow-md"
                        }`}
                      >

                        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                          <div className="flex min-w-0 items-start gap-4">

                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition ${
                                isSelected
                                  ? "bg-[#497F70] text-white"
                                  : "bg-[#EEF4F1] text-[#497F70] group-hover:bg-[#EAF3EF]"
                              }`}
                            >

                              <ShoppingCart
                                size={21}
                              />

                            </div>

                            <div className="min-w-0">

                              <div className="flex flex-wrap items-center gap-2">

                                <span className="truncate font-bold text-[#18352D]">
                                  {po.number}
                                </span>

                                {isSelected && (

                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#497F70] px-2.5 py-1 text-[10px] font-bold tracking-wide text-white">

                                    <CheckCircle2
                                      size={11}
                                    />

                                    DIPILIH

                                  </span>

                                )}

                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                                  APPROVED
                                </span>

                              </div>

                              <p className="mt-1.5 truncate text-sm font-medium text-gray-600">
                                {po.supplier
                                  ?.name ??
                                  po.supplierName ??
                                  "-"}
                              </p>

                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">

                                <span className="inline-flex items-center gap-1.5">

                                  <CalendarDays
                                    size={13}
                                  />

                                  {formatDate(
                                    po.date ??
                                      po.purchaseDate
                                  )}

                                </span>

                                <span className="inline-flex items-center gap-1.5">

                                  <Package
                                    size={13}
                                  />

                                  {itemCount} item

                                </span>

                                <span className="inline-flex items-center gap-1.5">

                                  <Boxes
                                    size={13}
                                  />

                                  {totalQty.toLocaleString(
                                    "id-ID"
                                  )} Qty

                                </span>

                              </div>

                            </div>

                          </div>

                          <div className="flex items-center justify-between gap-4 border-t border-[#E8EEEB] pt-4 lg:min-w-[210px] lg:border-0 lg:pt-0">

                            <div className="lg:text-right">

                              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                Total PO
                              </p>

                              <p className="mt-1 text-base font-bold text-[#18352D]">

                                Rp{" "}
                                {Number(
                                  po.total ??
                                    0
                                ).toLocaleString(
                                  "id-ID"
                                )}

                              </p>

                            </div>

                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                                isSelected
                                  ? "bg-[#497F70] text-white"
                                  : "bg-[#F1F5F3] text-gray-400 group-hover:bg-[#EAF3EF] group-hover:text-[#497F70]"
                              }`}
                            >

                              <ChevronRight
                                size={18}
                              />

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
            RECEIVE WORKSPACE
        ================================================= */}

        {selected && (

          <div className="overflow-hidden rounded-[24px] border border-[#DDE9E4] bg-white shadow-[0_10px_40px_rgba(24,53,45,0.07)]">

            {/* =================================================
                WORKSPACE HEADER
            ================================================= */}

            <div className="relative overflow-hidden border-b border-[#E5ECE9] bg-[#18352D]">

              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#497F70]/30 blur-3xl" />

              <div className="relative p-5 md:p-6">

                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

                  <div className="flex items-start gap-4">

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/10">

                      <ClipboardCheck
                        size={22}
                      />

                    </div>

                    <div>

                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B8D0C7]">
                        Receiving Workspace
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-2">

                        <h2 className="text-xl font-bold text-white md:text-2xl">
                          PO {selected.number}
                        </h2>

                        <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold text-emerald-200">
                          APPROVED
                        </span>

                      </div>

                      <p className="mt-1.5 text-sm text-[#B8D0C7]">

                        Supplier:{" "}

                        <span className="font-semibold text-white">

                          {selected.supplier
                            ?.name ??
                            selected.supplierName ??
                            "-"}

                        </span>

                      </p>

                    </div>

                  </div>

                  <div className="flex flex-wrap items-center gap-2">

                    {/* BARANG SCANNER */}

                    <button
                      type="button"
                      onClick={() => {
                        setBarangScanMessage("");
                        setShowBarangScanner(
                          true
                        );
                      }}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#18352D] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#F3F8F5] hover:shadow-md"
                    >

                      <ScanBarcode
                        size={17}
                      />

                      Scan Barang

                    </button>

                    {/* BATCH SCANNER */}

                    {batchTargets.length >
                      0 && (

                      <button
                        type="button"
                        onClick={() => {
                          setBatchScanMessage(
                            ""
                          );

                          setShowBatchScanner(
                            true
                          );

                          if (
                            !batchScanTarget
                          ) {
                            setBatchScanTarget(
                              batchTargets[0]
                                .rowId
                            );
                          }
                        }}
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white transition-all hover:bg-white/15"
                      >

                        <Barcode
                          size={17}
                        />

                        Scan Batch

                      </button>

                    )}

                  </div>

                </div>

                {/* PROGRESS */}

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">

                  <div className="flex items-center justify-between gap-4">

                    <div>

                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#AFCBC0]">
                        Progress Penerimaan
                      </p>

                      <p className="mt-1 text-sm font-semibold text-white">

                        {totalReceive.toLocaleString(
                          "id-ID"
                        )}{" "}

                        <span className="font-normal text-[#AFCBC0]">
                          dari
                        </span>{" "}

                        {totalPOQty.toLocaleString(
                          "id-ID"
                        )} Qty

                      </p>

                    </div>

                    <span className="text-lg font-bold text-white">
                      {receiveProgress}%
                    </span>

                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">

                    <div
                      className="h-full rounded-full bg-white transition-all duration-500"
                      style={{
                        width: `${receiveProgress}%`,
                      }}
                    />

                  </div>

                </div>

              </div>

            </div>

            {/* =================================================
                INVOICE SUPPLIER
            ================================================= */}

            <div className="border-b border-[#E8EEEB] bg-white p-5 md:p-6">

              <div className="rounded-2xl border border-[#DDE9E4] bg-[#FBFCFB] p-5">

                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <label
                        htmlFor="supplier-invoice-number"
                        className="text-sm font-bold text-[#18352D]"
                      >
                        Nomor Invoice Supplier
                      </label>

                      {String(
                        selected.paymentMethod ??
                          ""
                      )
                        .trim()
                        .toUpperCase() ===
                        "TEMPO" ? (
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-600">
                          WAJIB
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-500">
                          OPSIONAL
                        </span>
                      )}

                    </div>

                    <p className="mt-1.5 text-xs leading-5 text-gray-500">

                      Nomor invoice diambil dari invoice/faktur
                      yang diberikan supplier saat barang diterima.

                      {String(
                        selected.paymentMethod ??
                          ""
                      )
                        .trim()
                        .toUpperCase() ===
                        "TEMPO" && (
                        <>
                          {" "}
                          Untuk pembayaran TEMPO, nomor invoice
                          wajib diisi.
                        </>
                      )}

                    </p>

                  </div>

                  <div className="w-full lg:max-w-md">

                    <div className="relative">

                      <ClipboardCheck
                        size={17}
                        className="absolute left-3.5 top-3.5 text-[#497F70]"
                      />

                      <input
                        id="supplier-invoice-number"
                        type="text"
                        value={
                          invoiceNumber
                        }
                        onChange={(
                          e
                        ) =>
                          setInvoiceNumber(
                            e.target.value
                          )
                        }
                        placeholder="Contoh: INV-SUP-00123"
                        autoComplete="off"
                        className={`h-12 w-full rounded-xl border bg-white pl-10 pr-4 text-sm font-semibold text-[#18352D] outline-none transition placeholder:font-normal placeholder:text-gray-300 focus:ring-4 ${
                          String(
                            selected.paymentMethod ??
                              ""
                          )
                            .trim()
                            .toUpperCase() ===
                          "TEMPO"
                            ? "border-[#E4CACA] focus:border-red-400 focus:ring-red-400/10"
                            : "border-[#D5E5DC] focus:border-[#497F70] focus:ring-[#497F70]/10"
                        }`}
                      />

                    </div>

                    {String(
                      selected.paymentMethod ??
                        ""
                    )
                      .trim()
                      .toUpperCase() ===
                      "TEMPO" &&
                      !invoiceNumber.trim() && (

                      <p className="mt-2 text-[11px] font-medium text-red-500">
                        Invoice supplier wajib diisi sebelum
                        penerimaan diproses.
                      </p>

                    )}

                  </div>

                </div>

              </div>

            </div>

            {/* =================================================
                SCANNER INFO
            ================================================= */}

            <div className="border-b border-[#E8EEEB] bg-[#FBFCFB] p-5 md:p-6">

              <div className="grid gap-4 lg:grid-cols-2">

                {/* BARANG */}

                <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

                  <div className="flex items-start gap-3">

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">

                      <ScanLine
                        size={20}
                      />

                    </div>

                    <div className="min-w-0">

                      <div className="flex items-center gap-2">

                        <h3 className="text-sm font-bold text-[#18352D]">
                          Scanner Barang
                        </h3>

                        <span className="rounded-full bg-[#EAF3EF] px-2 py-0.5 text-[9px] font-bold text-[#497F70]">
                          BARCODE
                        </span>

                      </div>

                      <p className="mt-1.5 text-xs leading-5 text-gray-500">
                        Scan barcode produk untuk otomatis
                        menambahkan Qty penerimaan.
                      </p>

                    </div>

                  </div>

                  {barangScanMessage && (

                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#CDE1D8] bg-[#F0F8F4] px-3.5 py-3 text-xs font-semibold text-[#35564C]">

                      <CheckCircle2
                        size={15}
                        className="mt-0.5 shrink-0 text-[#497F70]"
                      />

                      <span>
                        {barangScanMessage}
                      </span>

                    </div>

                  )}

                </div>

                {/* BATCH */}

                {batchTargets.length >
                  0 && (

                  <div className="rounded-2xl border border-[#E8DEC5] bg-white p-5 shadow-sm">

                    <div className="flex items-start gap-3">

                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F7F1E4] text-[#8A6A28]">

                        <Barcode
                          size={20}
                        />

                      </div>

                      <div className="min-w-0 flex-1">

                        <div className="flex items-center gap-2">

                          <h3 className="text-sm font-bold text-[#18352D]">
                            Scanner Batch
                          </h3>

                          <span className="rounded-full bg-[#F7F1E4] px-2 py-0.5 text-[9px] font-bold text-[#8A6A28]">
                            BATCH
                          </span>

                        </div>

                        <p className="mt-1.5 text-xs leading-5 text-gray-500">
                          Scan batch / QR dari kemasan barang
                          expired.
                        </p>

                      </div>

                    </div>

                    <div className="mt-4">

                      <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                        Target Scan
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
                        className="h-10 w-full rounded-xl border border-[#D5E5DC] bg-white px-3 text-sm font-medium text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
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

                    {batchScanMessage && (

                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#CDE1D8] bg-[#F0F8F4] px-3.5 py-3 text-xs font-semibold text-[#35564C]">

                        <CheckCircle2
                          size={15}
                          className="mt-0.5 shrink-0 text-[#497F70]"
                        />

                        <span>
                          {batchScanMessage}
                        </span>

                      </div>

                    )}

                  </div>

                )}

              </div>

            </div>

            {/* =================================================
                TABLE
            ================================================= */}

            <div className="p-5 md:p-6">

              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <h3 className="font-bold text-[#18352D]">
                    Detail Barang
                  </h3>

                  <p className="mt-1 text-xs text-gray-400">
                    Masukkan Qty aktual yang diterima dari supplier.
                  </p>

                </div>

                <div className="flex items-center gap-2">

                  {totalBatch >
                    0 && (

                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F7F1E4] px-3 py-1.5 text-[11px] font-semibold text-[#8A6A28]">

                      <Barcode
                        size={13}
                      />

                      {totalBatch} batch tambahan

                    </span>

                  )}

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF3EF] px-3 py-1.5 text-[11px] font-semibold text-[#497F70]">

                    <Package
                      size={13}
                    />

                    {totalItem} item

                  </span>

                </div>

              </div>

              <div className="overflow-hidden rounded-2xl border border-[#E1E9E5]">

                <div className="overflow-x-auto">

                  <table className="min-w-[1280px] w-full text-sm">

                    <thead className="bg-[#F5F8F6]">

                      <tr className="border-b border-[#E3EBE7]">

                        <th className="w-14 px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide text-[#668177]">
                          No
                        </th>

                        <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-[#668177]">
                          Barang
                        </th>

                        <th className="w-28 px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-[#668177]">
                          Qty PO
                        </th>

                        <th className="w-32 px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-[#668177]">
                          Diterima
                        </th>

                        <th className="w-36 px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide text-[#668177]">
                          Qty Terima
                        </th>

                        <th className="w-64 px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-[#668177]">
                          Batch Number
                        </th>

                        <th className="w-56 px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-[#668177]">
                          Expired Date
                        </th>

                        <th className="w-48 px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide text-[#668177]">
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

                          const baseRemaining =
                            Math.max(
                              0,
                              row.poQty -
                                row.alreadyReceivedQty
                            );

                          const rowProgress =
                            baseRemaining >
                            0
                              ? Math.min(
                                  100,
                                  Math.round(
                                    (inputQty /
                                      baseRemaining) *
                                      100
                                  )
                                )
                              : 0;

                          return (
                            <tr
                              key={
                                row.rowId
                              }
                              className={`border-b border-[#EDF2EF] transition ${
                                row.isBatchRow
                                  ? "bg-[#F2F8F5]"
                                  : isScanned
                                  ? "bg-[#FBFDFC]"
                                  : "bg-white"
                              } hover:bg-[#F8FBF9]`}
                            >

                              {/* NO */}

                              <td className="px-4 py-4 text-center align-top">

                                <span
                                  className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                                    row.isBatchRow
                                      ? "bg-[#E2F0EA] text-[#497F70]"
                                      : "bg-[#F1F4F2] text-gray-500"
                                  }`}
                                >
                                  {index +
                                    1}
                                </span>

                              </td>

                              {/* BARANG */}

                              <td className="px-4 py-4 align-top">

                                <div
                                  className={`flex items-start gap-3 ${
                                    row.isBatchRow
                                      ? "pl-5"
                                      : ""
                                  }`}
                                >

                                  {row.isBatchRow && (

                                    <div className="mt-1 text-[#497F70]">
                                      ↳
                                    </div>

                                  )}

                                  {!row.isBatchRow &&
                                    isScanned && (

                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#497F70] text-white shadow-sm">

                                      <CheckCircle2
                                        size={17}
                                      />

                                    </div>

                                  )}

                                  {!row.isBatchRow &&
                                    !isScanned && (

                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F0F3F1] text-gray-400">

                                      <Package
                                        size={16}
                                      />

                                    </div>

                                  )}

                                  <div className="min-w-0">

                                    <p className="font-bold text-[#18352D]">
                                      {row.name}
                                    </p>

                                    {row.hasExpired && (

                                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">

                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">

                                          <AlertTriangle
                                            size={11}
                                          />

                                          Batch + Expired

                                        </span>

                                      </div>

                                    )}

                                    {row.isBatchRow && (

                                      <p className="mt-1 text-[11px] font-medium text-[#668177]">
                                        Batch tambahan
                                      </p>

                                    )}

                                    {!row.isBatchRow && (

                                      <div className="mt-2 h-1 w-28 overflow-hidden rounded-full bg-[#E8EEEB]">

                                        <div
                                          className="h-full rounded-full bg-[#497F70] transition-all"
                                          style={{
                                            width: `${rowProgress}%`,
                                          }}
                                        />

                                      </div>

                                    )}

                                  </div>

                                </div>

                              </td>

                              {/* QTY PO */}

                              <td className="px-4 py-4 text-right align-top">

                                {!row.isBatchRow ? (

                                  <div>

                                    <p className="font-bold text-gray-700">
                                      {row.poQty.toLocaleString(
                                        "id-ID"
                                      )}
                                    </p>

                                    <p className="mt-1 text-[10px] text-gray-400">
                                      Qty order
                                    </p>

                                  </div>

                                ) : (

                                  <span className="text-gray-300">
                                    —
                                  </span>

                                )}

                              </td>

                              {/* RECEIVED */}

                              <td className="px-4 py-4 text-right align-top">

                                {!row.isBatchRow ? (

                                  <div>

                                    <p className="font-bold text-gray-700">
                                      {row.alreadyReceivedQty.toLocaleString(
                                        "id-ID"
                                      )}
                                    </p>

                                    <p className="mt-1 text-[10px] text-gray-400">
                                      Sebelumnya
                                    </p>

                                  </div>

                                ) : (

                                  <span className="text-gray-300">
                                    —
                                  </span>

                                )}

                              </td>

                              {/* QTY */}

                              <td className="px-4 py-4 text-center align-top">

                                <div className="flex flex-col items-center">

                                  <div
                                    className={`relative rounded-xl transition ${
                                      isScanned
                                        ? "ring-2 ring-[#497F70]/10"
                                        : ""
                                    }`}
                                  >

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
                                      className="h-11 w-28 rounded-xl border border-[#D5E5DC] bg-white px-3 text-center text-sm font-bold text-[#18352D] outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                                    />

                                  </div>

                                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-400">

                                    <span>
                                      Input{" "}
                                      <b className="text-gray-600">
                                        {inputQty}
                                      </b>
                                    </span>

                                    <span>
                                      •
                                    </span>

                                    <span>
                                      Sisa{" "}
                                      <b className="text-[#497F70]">
                                        {remaining}
                                      </b>
                                    </span>

                                  </div>

                                </div>

                              </td>

                              {/* BATCH */}

                              <td className="px-4 py-4 align-top">

                                {row.hasExpired ? (

                                  <div className="relative">

                                    <Barcode
                                      size={16}
                                      className="absolute left-3 top-3.5 text-[#497F70]"
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
                                      className="h-11 w-full rounded-xl border border-[#D5E5DC] bg-white pl-9 pr-3 text-sm font-medium text-gray-700 outline-none transition placeholder:text-gray-300 focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                                    />

                                  </div>

                                ) : (

                                  <div className="flex items-center gap-2 rounded-xl bg-[#F7F9F8] px-3 py-3 text-xs text-gray-400">

                                    <Barcode
                                      size={15}
                                    />

                                    Tidak menggunakan batch

                                  </div>

                                )}

                              </td>

                              {/* EXPIRED */}

                              <td className="px-4 py-4 align-top">

                                {row.hasExpired ? (

                                  <div className="relative">

                                    <CalendarDays
                                      size={16}
                                      className="absolute left-3 top-3.5 text-[#497F70]"
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
                                      className="h-11 w-full rounded-xl border border-[#D5E5DC] bg-white pl-9 pr-3 text-sm font-medium text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                                    />

                                  </div>

                                ) : (

                                  <div className="flex items-center gap-2 rounded-xl bg-[#F7F9F8] px-3 py-3 text-xs text-gray-400">

                                    <CalendarDays
                                      size={15}
                                    />

                                    Tidak menggunakan expired

                                  </div>

                                )}

                              </td>

                              {/* AKSI */}

                              <td className="px-4 py-4 text-center align-top">

                                {row.hasExpired ? (

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
                                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#497F70] px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#3E6F62] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
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
                                        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3.5 text-xs font-bold text-red-600 transition hover:bg-red-100"
                                      >

                                        <Trash2
                                          size={14}
                                        />

                                        Hapus

                                      </button>

                                    )}

                                  </div>

                                ) : (

                                  <span className="text-xs text-gray-300">
                                    —
                                  </span>

                                )}

                              </td>

                            </tr>
                          );
                        }
                      )}

                    </tbody>

                    {/* =================================================
                        FOOTER
                    ================================================= */}

                    <tfoot>

                      <tr className="bg-[#F5F8F6]">

                        <td
                          colSpan={4}
                          className="px-4 py-5 text-right"
                        >

                          <div className="text-xs font-semibold uppercase tracking-wide text-[#668177]">
                            Total Qty Penerimaan
                          </div>

                        </td>

                        <td className="px-4 py-5 text-center">

                          <div className="inline-flex min-w-[90px] flex-col items-center rounded-xl bg-white px-4 py-2 shadow-sm ring-1 ring-[#E0E9E4]">

                            <span className="text-xl font-bold text-[#18352D]">

                              {totalReceive.toLocaleString(
                                "id-ID"
                              )}

                            </span>

                            <span className="text-[9px] font-bold uppercase tracking-wide text-[#497F70]">
                              Qty
                            </span>

                          </div>

                        </td>

                        <td colSpan={3} />

                      </tr>

                    </tfoot>

                  </table>

                </div>

              </div>

              {/* =================================================
                  BATCH WARNING
              ================================================= */}

              {rows.some(
                (row) =>
                  row.hasExpired
              ) && (

                <div className="mt-5 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">

                  <div className="flex items-start gap-3 p-4">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">

                      <AlertTriangle
                        size={18}
                      />

                    </div>

                    <div>

                      <p className="text-sm font-bold text-amber-800">
                        Perhatian Batch & Expired Date
                      </p>

                      <p className="mt-1 text-xs leading-5 text-amber-700">
                        Barang yang menggunakan sistem expired
                        wajib memiliki Batch Number dan Expired
                        Date. Satu barang dapat memiliki beberapa
                        batch dalam satu penerimaan.
                      </p>

                    </div>

                  </div>

                </div>

              )}

              {/* =================================================
                  ACTION BAR
              ================================================= */}

              <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-[#E1E9E5] bg-[#FBFCFB] p-4 md:flex-row md:items-center md:justify-between">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">

                    <ShieldCheck
                      size={19}
                    />

                  </div>

                  <div>

                    <p className="text-xs font-bold text-[#35564C]">
                      Validasi penerimaan aktif
                    </p>

                    <p className="mt-0.5 text-[11px] text-gray-400">
                      Qty tidak boleh melebihi sisa PO.
                    </p>

                  </div>

                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row">

                  <button
                    type="button"
                    onClick={
                      resetForm
                    }
                    disabled={
                      receiving
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-5 text-sm font-semibold text-gray-600 transition hover:bg-[#F4F7F5] disabled:cursor-not-allowed disabled:opacity-50"
                  >

                    <X
                      size={16}
                    />

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
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#497F70] px-6 text-sm font-bold text-white shadow-[0_6px_18px_rgba(73,127,112,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#3E6F62] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >

                    {receiving ? (
                      <>

                        <RefreshCw
                          size={17}
                          className="animate-spin"
                        />

                        Memproses Penerimaan...

                      </>
                    ) : (
                      <>

                        <PackageCheck
                          size={17}
                        />

                        Terima Barang

                        <ArrowRight
                          size={16}
                        />

                      </>
                    )}

                  </button>

                </div>

              </div>

            </div>

          </div>

        )}

      </div>

      {/* =====================================================
          BARANG SCANNER MODAL
      ===================================================== */}

      {showBarangScanner && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102720]/75 p-4 backdrop-blur-sm">

          <div className="w-full max-w-xl overflow-hidden rounded-[24px] border border-white/10 bg-white shadow-[0_25px_80px_rgba(0,0,0,0.30)]">

            <div className="relative overflow-hidden bg-[#18352D] px-5 py-5 text-white">

              <div className="absolute -right-10 -top-14 h-36 w-36 rounded-full bg-[#497F70]/30 blur-2xl" />

              <div className="relative flex items-start justify-between gap-4">

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">

                    <ScanBarcode
                      size={21}
                    />

                  </div>

                  <div>

                    <h3 className="font-bold">
                      Scan Barcode Barang
                    </h3>

                    <p className="mt-1 text-xs text-[#B8D0C7]">
                      Scan barcode produk untuk menambah Qty.
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowBarangScanner(
                      false
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
                >

                  <X
                    size={19}
                  />

                </button>

              </div>

            </div>

            <div className="p-5 md:p-6">

              <div className="mb-4 rounded-xl border border-[#E2EAE6] bg-[#F8FAF9] p-3.5">

                <div className="flex items-center gap-2 text-xs font-semibold text-[#497F70]">

                  <ScanLine
                    size={15}
                  />

                  <span>
                    PO {selected?.number}
                  </span>

                </div>

              </div>

              <BarcodeInputScanner
                onScan={
                  handleBarangScan
                }
              />

              {barangScanMessage && (

                <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#CDE1D8] bg-[#F0F8F4] px-4 py-3 text-xs font-semibold text-[#35564C]">

                  <CheckCircle2
                    size={15}
                    className="mt-0.5 shrink-0"
                  />

                  <span>
                    {barangScanMessage}
                  </span>

                </div>

              )}

              <button
                type="button"
                onClick={() =>
                  setShowBarangScanner(
                    false
                  )
                }
                className="mt-5 h-11 w-full rounded-xl border border-[#DDE5E1] bg-white text-sm font-semibold text-gray-600 transition hover:bg-[#F5F8F6]"
              >
                Selesai
              </button>

            </div>

          </div>

        </div>

      )}

      {/* =====================================================
          BATCH SCANNER MODAL
      ===================================================== */}

      {showBatchScanner && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102720]/75 p-4 backdrop-blur-sm">

          <div className="w-full max-w-xl overflow-hidden rounded-[24px] border border-white/10 bg-white shadow-[0_25px_80px_rgba(0,0,0,0.30)]">

            <div className="relative overflow-hidden bg-[#18352D] px-5 py-5 text-white">

              <div className="absolute -right-10 -top-14 h-36 w-36 rounded-full bg-[#497F70]/30 blur-2xl" />

              <div className="relative flex items-start justify-between gap-4">

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">

                    <Barcode
                      size={21}
                    />

                  </div>

                  <div>

                    <h3 className="font-bold">
                      Scan Batch Number
                    </h3>

                    <p className="mt-1 text-xs text-[#B8D0C7]">
                      Scan barcode atau QR batch dari kemasan.
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowBatchScanner(
                      false
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
                >

                  <X
                    size={19}
                  />

                </button>

              </div>

            </div>

            <div className="space-y-5 p-5 md:p-6">

              {/* TARGET */}

              <div>

                <div className="mb-2 flex items-center justify-between">

                  <label className="text-xs font-bold uppercase tracking-wide text-[#35564C]">
                    Target Batch
                  </label>

                  <span className="text-[10px] font-medium text-gray-400">
                    Wajib dipilih
                  </span>

                </div>

                <select
                  value={
                    batchScanTarget
                  }
                  onChange={(e) =>
                    setBatchScanTarget(
                      e.target.value
                    )
                  }
                  className="h-12 w-full rounded-xl border border-[#D5E5DC] bg-white px-4 text-sm font-medium text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
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

              <div className="rounded-2xl border border-[#E3EBE7] bg-[#FBFCFB] p-4">

                <BarcodeInputScanner
                  onScan={
                    handleBatchScan
                  }

                />

              </div>

              {batchScanMessage && (

                <div className="flex items-start gap-2 rounded-xl border border-[#CDE1D8] bg-[#F0F8F4] px-4 py-3 text-xs font-semibold text-[#35564C]">

                  <CheckCircle2
                    size={15}
                    className="mt-0.5 shrink-0"
                  />

                  <span>
                    {batchScanMessage}
                  </span>

                </div>

              )}

              <button
                type="button"
                onClick={() =>
                  setShowBatchScanner(
                    false
                  )
                }
                className="h-11 w-full rounded-xl border border-[#DDE5E1] bg-white text-sm font-semibold text-gray-600 transition hover:bg-[#F5F8F6]"
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