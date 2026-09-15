"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import BarcodeInputScanner from "@/components/BarcodeInputScanner";

interface ReceiveRow {
  barangId: number;
  name: string;
  poQty: number;
  receivedQty: number;
  price: number;
  hasExpired: boolean;

  batchNumber: string;
  expiredDate: string;

  qty: number;

  isBatchRow?: boolean;
}

interface ParsedBatch {
  batchNumber: string;
  expiredDate: string;
  barangId: number | null;
}

/**
 * ============================================================
 * PARSE HASIL SCAN BATCH
 * ============================================================
 *
 * Scanner bisa mengirim:
 *
 * 1. Batch biasa:
 *    BVG049
 *
 * 2. JSON:
 *    {
 *      type: "MGB-BATCH",
 *      barangId: 235,
 *      batchNumber: "BVG049",
 *      expiredDate: "2027-02-25"
 *    }
 *
 * 3. QR TEXT:
 *    MGB|235|BVG049|GR-1786285055548|2027-02-25T00:00:00.000Z
 *
 * Yang masuk ke input Batch:
 *
 *    BVG049
 *
 * Yang masuk ke input Expired:
 *
 *    2027-02-25
 */
function parseBatchScan(
  value: string
): ParsedBatch {
  const raw = String(value || "").trim();

  if (!raw) {
    return {
      batchNumber: "",
      expiredDate: "",
      barangId: null,
    };
  }

  // ==========================================================
  // FORMAT MGB|...
  // ==========================================================

  if (raw.startsWith("MGB|")) {
    const parts = raw.split("|");

    /*
     * Format:
     *
     * 0 = MGB
     * 1 = barangId
     * 2 = batchNumber
     * 3 = reference / GR
     * 4 = expiredDate
     */

    if (parts.length >= 3) {
      const scannedBarangId = Number(
        parts[1]
      );

      const batchNumber = String(
        parts[2] || ""
      ).trim();

      let expiredDate = "";

      if (parts[4]) {
        expiredDate = String(
          parts[4]
        )
          .trim()
          .substring(0, 10);
      }

      return {
        batchNumber,
        expiredDate,
        barangId:
          Number.isInteger(
            scannedBarangId
          )
            ? scannedBarangId
            : null,
      };
    }

    /*
     * Kalau format MGB| rusak,
     * jangan masukkan seluruh QR ke batch.
     */
    return {
      batchNumber: "",
      expiredDate: "",
      barangId: null,
    };
  }

  // ==========================================================
  // FORMAT JSON
  // ==========================================================

  if (
    raw.startsWith("{") &&
    raw.endsWith("}")
  ) {
    try {
      const parsed =
        JSON.parse(raw);

      if (
        parsed &&
        typeof parsed === "object"
      ) {
        const batchNumber =
          String(
            parsed.batchNumber ??
              parsed.batch ??
              ""
          ).trim();

        const expiredDate =
          parsed.expiredDate
            ? String(
                parsed.expiredDate
              )
                .trim()
                .substring(0, 10)
            : "";

        const scannedBarangId =
          parsed.barangId !==
            undefined &&
          parsed.barangId !== null
            ? Number(
                parsed.barangId
              )
            : null;

        return {
          batchNumber,
          expiredDate,
          barangId:
            Number.isInteger(
              scannedBarangId
            )
              ? scannedBarangId
              : null,
        };
      }
    } catch {
      // lanjut sebagai barcode biasa
    }
  }

  // ==========================================================
  // BARCODE BATCH BIASA
  // ==========================================================

  return {
    batchNumber: raw,
    expiredDate: "",
    barangId: null,
  };
}

export default function ReceivePage() {
  const router = useRouter();
  const params = useParams();

  const purchaseId = String(
    params?.id ?? ""
  );

  const [items, setItems] =
    useState<ReceiveRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [receiving, setReceiving] =
    useState(false);

  const [scanIndex, setScanIndex] =
    useState<number | null>(null);

  // ==========================================================
  // LOAD PURCHASE
  // ==========================================================

  useEffect(() => {
    if (!purchaseId || purchaseId === "undefined") {
      setLoading(false);
      return;
    }

    load();
  }, [purchaseId]);

  async function load() {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/purchase/${purchaseId}`,
        {
          cache: "no-store",
        }
      );

      const json =
        await res.json();

      if (!res.ok || !json.success) {
        alert(
          json.message ||
            "Gagal mengambil data Purchase"
        );

        return;
      }

      const purchase =
        json.data;

      const rows: ReceiveRow[] =
        (
          purchase.items || []
        ).map((item: any) => ({
          barangId:
            Number(item.barangId),

          name:
            item.barang?.name ||
            item.barang?.nama ||
            "-",

          poQty:
            Number(item.qty || 0),

          receivedQty:
            Number(
              item.receivedQty || 0
            ),

          price:
            Number(item.price || 0),

          hasExpired:
            Boolean(
              item.barang?.hasExpired
            ),

          batchNumber: "",

          expiredDate: "",

          qty: 0,

          isBatchRow: false,
        }));

      setItems(rows);
    } catch (error) {
      console.error(
        "LOAD RECEIVE ERROR:",
        error
      );

      alert(
        "Gagal mengambil data Purchase"
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================
  // BARANG ROWS
  // ==========================================================

  function getBarangRows(
    barangId: number
  ) {
    return items.filter(
      (item) =>
        item.barangId === barangId
    );
  }

  // ==========================================================
  // TOTAL RECEIVE PER BARANG
  // ==========================================================

  function getTotalReceive(
    barangId: number
  ) {
    return getBarangRows(
      barangId
    ).reduce(
      (total, item) =>
        total +
        Number(item.qty || 0),
      0
    );
  }

  // ==========================================================
  // SISA PO
  // ==========================================================

  function getRemainingReceive(
    barangId: number
  ) {
    const rows =
      getBarangRows(
        barangId
      );

    if (!rows.length) {
      return 0;
    }

    const first =
      rows[0];

    const sisaPO =
      Number(first.poQty || 0) -
      Number(
        first.receivedQty || 0
      );

    const sudahDiisi =
      getTotalReceive(
        barangId
      );

    return Math.max(
      0,
      sisaPO - sudahDiisi
    );
  }

  // ==========================================================
  // UPDATE ITEM
  // ==========================================================

  function updateItem(
    index: number,
    field: keyof ReceiveRow,
    value: string | number
  ) {
    setItems(
      (current) =>
        current.map(
          (item, i) => {
            if (i !== index) {
              return item;
            }

            return {
              ...item,
              [field]: value,
            };
          }
        )
    );
  }

  // ==========================================================
  // SCAN BATCH
  // ==========================================================

  function handleScan(
    barcode: string
  ) {
    if (
      scanIndex === null
    ) {
      return;
    }

    const index =
      scanIndex;

    const currentRow =
      items[index];

    if (!currentRow) {
      setScanIndex(null);
      return;
    }

    const raw =
      String(
        barcode || ""
      ).trim();

    if (!raw) {
      return;
    }

    console.log(
      "RAW SCAN:",
      raw
    );

    // ========================================================
    // PARSE
    // ========================================================

    const parsed =
      parseBatchScan(raw);

    console.log(
      "PARSED BATCH:",
      parsed
    );

    // ========================================================
    // VALIDASI BARANG
    // ========================================================

    if (
      parsed.barangId !== null &&
      Number(
        parsed.barangId
      ) !==
        Number(
          currentRow.barangId
        )
    ) {
      alert(
        `QR ini bukan untuk barang "${currentRow.name}".`
      );

      return;
    }

    // ========================================================
    // BATCH TIDAK BOLEH KOSONG
    // ========================================================

    if (
      !parsed.batchNumber
    ) {
      alert(
        "Batch Number tidak ditemukan dari hasil scan."
      );

      return;
    }

    // ========================================================
    // UPDATE SEKALIGUS
    //
    // PENTING:
    // Jangan update batchNumber dan expiredDate
    // dengan dua setState terpisah.
    //
    // Langsung satu update supaya hasil scan konsisten.
    // ========================================================

    setItems(
      (current) =>
        current.map(
          (item, i) => {
            if (i !== index) {
              return item;
            }

            return {
              ...item,

              // HANYA BATCH NUMBER
              // contoh:
              // BVG049
              batchNumber:
                parsed.batchNumber,

              // HANYA YYYY-MM-DD
              expiredDate:
                parsed.expiredDate ||
                item.expiredDate,
            };
          }
        )
    );

    // Tutup scanner
    setScanIndex(null);
  }

  // ==========================================================
  // TAMBAH BATCH
  // ==========================================================

  function addBatch(
    index: number
  ) {
    const source =
      items[index];

    if (
      !source ||
      !source.hasExpired
    ) {
      return;
    }

    const remaining =
      getRemainingReceive(
        source.barangId
      );

    if (
      remaining <= 0
    ) {
      alert(
        `Qty penerimaan ${source.name} sudah mencapai batas PO.`
      );

      return;
    }

    const newRow: ReceiveRow = {
      ...source,

      batchNumber: "",

      expiredDate: "",

      qty: 0,

      isBatchRow: true,
    };

    setItems(
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
  }

  // ==========================================================
  // HAPUS BATCH
  // ==========================================================

  function removeBatch(
    index: number
  ) {
    const item =
      items[index];

    if (!item) {
      return;
    }

    if (
      !item.isBatchRow
    ) {
      return;
    }

    if (
      scanIndex === index
    ) {
      setScanIndex(null);
    }

    setItems(
      (current) =>
        current.filter(
          (_, i) =>
            i !== index
        )
    );
  }

  // ==========================================================
  // UPDATE QTY
  // ==========================================================

  function updateQty(
    index: number,
    value: string
  ) {
    const item =
      items[index];

    if (!item) {
      return;
    }

    let qty =
      Number(value);

    if (
      !Number.isFinite(qty) ||
      qty < 0
    ) {
      qty = 0;
    }

    const totalBarang =
      getTotalReceive(
        item.barangId
      );

    const currentQty =
      Number(
        item.qty || 0
      );

    const sisaPO =
      Number(item.poQty || 0) -
      Number(
        item.receivedQty || 0
      );

    const maxQty =
      Math.max(
        0,
        sisaPO -
          (
            totalBarang -
            currentQty
          )
      );

    if (
      qty > maxQty
    ) {
      qty = maxQty;
    }

    updateItem(
      index,
      "qty",
      qty
    );
  }

  // ==========================================================
  // VALIDASI
  // ==========================================================

  function validate() {
    if (!items.length) {
      alert(
        "Tidak ada barang untuk diterima."
      );

      return false;
    }

    const barangIds = [
      ...new Set(
        items.map(
          (item) =>
            item.barangId
        )
      ),
    ];

    for (
      const barangId
      of barangIds
    ) {
      const rows =
        getBarangRows(
          barangId
        );

      if (!rows.length) {
        continue;
      }

      const first =
        rows[0];

      const totalQty =
        rows.reduce(
          (total, row) =>
            total +
            Number(
              row.qty || 0
            ),
          0
        );

      const sisaPO =
        Number(
          first.poQty || 0
        ) -
        Number(
          first.receivedQty || 0
        );

      // ======================================================
      // QTY HARUS ADA
      // ======================================================

      if (
        totalQty <= 0
      ) {
        alert(
          `Qty penerimaan ${first.name} harus lebih dari 0.`
        );

        return false;
      }

      // ======================================================
      // TIDAK BOLEH MELEBIHI PO
      // ======================================================

      if (
        totalQty > sisaPO
      ) {
        alert(
          `Qty penerimaan ${first.name} melebihi sisa PO.\n\n` +
            `Sisa PO: ${sisaPO}\n` +
            `Qty diterima: ${totalQty}`
        );

        return false;
      }

      // ======================================================
      // BARANG BATCH
      // ======================================================

      if (
        first.hasExpired
      ) {
        for (
          const row of rows
        ) {
          const qty =
            Number(
              row.qty || 0
            );

          if (
            qty <= 0
          ) {
            alert(
              `Qty batch untuk ${row.name} harus lebih dari 0.`
            );

            return false;
          }

          const batch =
            String(
              row.batchNumber ||
                ""
            ).trim();

          if (!batch) {
            alert(
              `Batch Number wajib diisi untuk ${row.name}.`
            );

            return false;
          }

          if (
            !row.expiredDate
          ) {
            alert(
              `Expired Date wajib diisi untuk batch ${batch}.`
            );

            return false;
          }

          const date =
            new Date(
              row.expiredDate
            );

          if (
            Number.isNaN(
              date.getTime()
            )
          ) {
            alert(
              `Expired Date untuk batch ${batch} tidak valid.`
            );

            return false;
          }
        }
      }
    }

    return true;
  }

  // ==========================================================
  // RECEIVE
  // ==========================================================

  async function receive() {
    if (
      receiving
    ) {
      return;
    }

    if (
      !validate()
    ) {
      return;
    }

    try {
      setReceiving(true);

      /*
       * Buat payload.
       *
       * Yang dikirim:
       *
       * batchNumber = BVG049
       *
       * BUKAN:
       *
       * MGB|235|BVG049|GR-...|...
       */

      const payload = {
        items: items
          .filter(
            (item) =>
              Number(
                item.qty || 0
              ) > 0
          )
          .map(
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
                  item.price || 0
                ),

              batchNumber:
                item.hasExpired
                  ? String(
                      item.batchNumber ||
                        ""
                    ).trim()
                  : null,

              expiredDate:
                item.hasExpired
                  ? item.expiredDate
                  : null,
            })
          ),
      };

      console.log(
        "RECEIVE PAYLOAD:",
        JSON.stringify(
          payload,
          null,
          2
        )
      );

      const res =
        await fetch(
          `/api/purchase/${purchaseId}/receive`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        alert(
          json.message ||
            "Gagal menerima barang"
        );

        return;
      }

      alert(
        "Barang berhasil diterima."
      );

      router.push(
        "/barang-masuk"
      );

      router.refresh();
    } catch (error) {
      console.error(
        "RECEIVE ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menerima barang."
      );
    } finally {
      setReceiving(false);
    }
  }

  // ==========================================================
  // TOTAL
  // ==========================================================

  const totalReceive =
    useMemo(
      () =>
        items.reduce(
          (total, item) =>
            total +
            Number(
              item.qty || 0
            ),
          0
        ),
      [items]
    );

  // ==========================================================
  // INVALID PURCHASE ID
  // ==========================================================

  if (
    !purchaseId ||
    purchaseId ===
      "undefined"
  ) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
          <div className="font-semibold">
            ID Purchase tidak ditemukan.
          </div>

          <div className="text-sm mt-1">
            Halaman Receive harus
            dibuka dari detail Purchase.
          </div>

          <button
            onClick={() =>
              router.back()
            }
            className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-white"
          >
            ← Kembali
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="p-8">
        <div className="rounded-xl border bg-white p-6">
          Memuat data penerimaan...
        </div>
      </div>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="p-8">

      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="mb-6 flex items-center justify-between">

        <div>
          <h1 className="text-3xl font-bold">
            Receive Barang
          </h1>

          <p className="mt-1 text-gray-500">
            Masukkan barang yang
            benar-benar diterima
            dari Purchase Order.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            router.back()
          }
          className="rounded-lg border px-4 py-2 hover:bg-gray-50"
        >
          ← Kembali
        </button>

      </div>

      {/* ====================================================
          INFO
      ==================================================== */}

      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">

        <strong>
          Catatan:
        </strong>{" "}

        Untuk barang yang memiliki
        expired, satu barang dapat
        memiliki beberapa batch
        dalam satu penerimaan.

        <div className="mt-1 text-xs text-blue-700">
          Scan QR batch akan otomatis
          mengambil Batch Number dan
          Expired Date dari QR.
        </div>

      </div>

      {/* ====================================================
          TABLE
      ==================================================== */}

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">

        <div className="overflow-x-auto">

          <table className="w-full border-collapse">

            <thead className="bg-gray-50">

              <tr>

                <th className="border p-3 text-left">
                  Barang
                </th>

                <th className="border p-3 text-right">
                  Qty PO
                </th>

                <th className="border p-3 text-right">
                  Sudah Diterima
                </th>

                <th className="border p-3 text-right">
                  Qty Terima
                </th>

                <th className="border p-3 text-left">
                  Batch
                </th>

                <th className="border p-3 text-left">
                  Expired
                </th>

                <th className="border p-3 text-center">
                  Aksi
                </th>

              </tr>

            </thead>

            <tbody>

              {items.length === 0 ? (

                <tr>
                  <td
                    colSpan={7}
                    className="border p-8 text-center text-gray-500"
                  >
                    Tidak ada item
                    Purchase Order.
                  </td>
                </tr>

              ) : (

                items.map(
                  (
                    item,
                    index
                  ) => {

                    const totalBarang =
                      getTotalReceive(
                        item.barangId
                      );

                    const sisaPO =
                      Number(
                        item.poQty || 0
                      ) -
                      Number(
                        item.receivedQty ||
                          0
                      );

                    const sisaSetelahRow =
                      Math.max(
                        0,
                        sisaPO -
                          (
                            totalBarang -
                            Number(
                              item.qty ||
                                0
                            )
                          )
                      );

                    return (
                      <tr
                        key={`${item.barangId}-${index}`}
                        className={
                          item.isBatchRow
                            ? "bg-green-50"
                            : "hover:bg-gray-50"
                        }
                      >

                        {/* ==================================
                            BARANG
                        ================================== */}

                        <td className="border p-3">

                          <div
                            className={
                              item.isBatchRow
                                ? "pl-6"
                                : ""
                            }
                          >

                            {item.isBatchRow && (
                              <span className="mr-2 text-green-600">
                                ↳
                              </span>
                            )}

                            <span className="font-semibold">
                              {item.name}
                            </span>

                          </div>

                          {item.hasExpired &&
                            !item.isBatchRow && (
                              <div className="mt-1 text-xs text-orange-600">
                                Batch diperlukan
                              </div>
                            )}

                          {item.isBatchRow && (
                            <div className="mt-1 pl-6 text-xs text-gray-500">
                              Sisa PO:{" "}
                              {sisaSetelahRow}
                            </div>
                          )}

                        </td>

                        {/* ==================================
                            QTY PO
                        ================================== */}

                        <td className="border p-3 text-right">

                          {!item.isBatchRow
                            ? item.poQty
                            : ""}

                        </td>

                        {/* ==================================
                            SUDAH DITERIMA
                        ================================== */}

                        <td className="border p-3 text-right">

                          {!item.isBatchRow
                            ? item.receivedQty
                            : ""}

                        </td>

                        {/* ==================================
                            QTY RECEIVE
                        ================================== */}

                        <td className="border p-3">

                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={
                              item.qty
                            }
                            onChange={(e) =>
                              updateQty(
                                index,
                                e.target.value
                              )
                            }
                            className="w-28 rounded-lg border px-3 py-2 text-right"
                          />

                        </td>

                        {/* ==================================
                            BATCH
                        ================================== */}

                        <td className="border p-3">

                          {item.hasExpired ? (

                            <div className="space-y-2">

                              <div className="flex gap-2">

                                <input
                                  type="text"
                                  value={
                                    item.batchNumber
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    updateItem(
                                      index,
                                      "batchNumber",
                                      e.target.value
                                    )
                                  }
                                  placeholder="BVG049"
                                  className="min-w-[180px] flex-1 rounded-lg border px-3 py-2"
                                />

                                <button
                                  type="button"
                                  onClick={() =>
                                    setScanIndex(
                                      index
                                    )
                                  }
                                  className="whitespace-nowrap rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800"
                                >
                                  Scan
                                </button>

                              </div>

                              {/* ==================================
                                  SCANNER
                              ================================== */}

                              {scanIndex ===
                                index && (

                                <div className="rounded-lg border bg-gray-50 p-3">

                                  <div className="mb-2 text-xs font-medium text-gray-600">
                                    Scan Barcode /
                                    QR Batch
                                  </div>

                                  <BarcodeInputScanner
                                    onScan={
                                      handleScan
                                    }
                                  />

                                  <div className="mt-2 text-xs text-gray-400">
                                    Contoh QR:
                                    <span className="ml-1 font-mono">
                                      MGB|235|BVG049|GR-...|2027-02-25
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setScanIndex(
                                        null
                                      )
                                    }
                                    className="mt-2 text-sm text-red-600 hover:underline"
                                  >
                                    Batal scan
                                  </button>

                                </div>

                              )}

                              {/* ==================================
                                  HASIL SCAN
                              ================================== */}

                              {item.batchNumber && (
                                <div className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">

                                  <div>
                                    Batch terbaca:
                                    <strong className="ml-1">
                                      {
                                        item.batchNumber
                                      }
                                    </strong>
                                  </div>

                                  {item.expiredDate && (
                                    <div>
                                      Expired:
                                      <strong className="ml-1">
                                        {
                                          item.expiredDate
                                        }
                                      </strong>
                                    </div>
                                  )}

                                </div>
                              )}

                            </div>

                          ) : (

                            <span className="text-gray-400">
                              Tidak menggunakan
                              batch
                            </span>

                          )}

                        </td>

                        {/* ==================================
                            EXPIRED
                        ================================== */}

                        <td className="border p-3">

                          {item.hasExpired ? (

                            <input
                              type="date"
                              value={
                                item.expiredDate
                              }
                              onChange={(
                                e
                              ) =>
                                updateItem(
                                  index,
                                  "expiredDate",
                                  e.target.value
                                )
                              }
                              className="rounded-lg border px-3 py-2"
                            />

                          ) : (

                            <span className="text-gray-400">
                              -
                            </span>

                          )}

                        </td>

                        {/* ==================================
                            AKSI
                        ================================== */}

                        <td className="border p-3 text-center">

                          {item.hasExpired && (

                            <div className="flex justify-center gap-2">

                              <button
                                type="button"
                                onClick={() =>
                                  addBatch(
                                    index
                                  )
                                }
                                className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
                              >
                                + Batch
                              </button>

                              {item.isBatchRow && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeBatch(
                                      index
                                    )
                                  }
                                  className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
                                >
                                  Hapus
                                </button>
                              )}

                            </div>

                          )}

                        </td>

                      </tr>
                    );
                  }
                )

              )}

            </tbody>

            {/* ================================================
                TOTAL
            ================================================= */}

            <tfoot>

              <tr className="bg-gray-50 font-bold">

                <td
                  colSpan={3}
                  className="border p-3 text-right"
                >
                  Total Qty
                  Diterima
                </td>

                <td className="border p-3 text-right">
                  {totalReceive}
                </td>

                <td
                  colSpan={3}
                  className="border p-3"
                />

              </tr>

            </tfoot>

          </table>

        </div>

      </div>

      {/* ====================================================
          ACTION
      ==================================================== */}

      <div className="mt-6 flex justify-end">

        <button
          type="button"
          onClick={receive}
          disabled={
            receiving ||
            items.length === 0
          }
          className="rounded-lg bg-green-600 px-7 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {receiving
            ? "Memproses..."
            : "✓ Terima Barang"}
        </button>

      </div>

    </div>
  );
}