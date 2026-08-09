"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import CameraBarcodeScanner from "@/components/CameraBarcodeScanner";

type StockOpnameItem = {
  id: number;
  barangId: number;
  systemQty: number;
  physicalQty: number;
  difference: number;
  note?: string | null;
  barang?: {
    id: number;
    code: string;
    barcode?: string | null;
    name: string;
    category?: string | null;
    unit?: string;
  };
};

type StockOpnameData = {
  id: number;
  code: string;
  date: string;
  status: string;
  createdBy?: number | null;
  approvedBy?: number | null;
  items: StockOpnameItem[];
};

export default function StockOpnameDetailPage() {
  const params = useParams();
  const router = useRouter();

  const id = String(params.id);

  const [data, setData] = useState<StockOpnameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);

  const [scanResult, setScanResult] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [approving, setApproving] = useState(false);

  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // =========================================================
  // LOAD DATA
  // =========================================================

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const res = await fetch(`/api/stock-opname/${id}`, {
        cache: "no-store",
      });

      const json = await res.json();

      console.log("DETAIL STOCK OPNAME:", json);

      if (json.success) {
        setData(json.data);
      } else {
        setData(null);
      }
    } catch (error) {
      console.error("LOAD STOCK OPNAME ERROR:", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, loadData]);

  // =========================================================
  // UPDATE QTY
  // =========================================================

  async function updateQty(
    itemId: number,
    qty: number
  ) {
    if (!data) return;

    if (data.status === "APPROVED") {
      return;
    }

    if (!Number.isFinite(qty) || qty < 0) {
      alert("Qty fisik tidak valid.");
      return;
    }

    try {
      setSavingItemId(itemId);

      const res = await fetch(`/api/stock-opname/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemId,
          physicalQty: qty,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        alert(json.message || "Gagal menyimpan qty.");
        return;
      }

      // Update langsung di layar supaya lebih cepat
      setData((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          items: prev.items.map((item) => {
            if (item.id !== itemId) {
              return item;
            }

            return {
              ...item,
              physicalQty: qty,
              difference: qty - item.systemQty,
            };
          }),
        };
      });
    } catch (error) {
      console.error("UPDATE QTY ERROR:", error);
      alert("Gagal menyimpan qty.");
    } finally {
      setSavingItemId(null);
    }
  }

  // =========================================================
  // FIND BARANG BY BARCODE
  // =========================================================

  const findBarangByBarcode = useCallback(
    (barcode: string) => {
      if (!data?.items) return;

      const cleanBarcode = barcode.trim();

      if (!cleanBarcode) {
        return;
      }

      console.log(
        "BARCODE YANG DICARI:",
        cleanBarcode
      );

      const found = data.items.find(
        (item) =>
          String(item.barang?.barcode || "").trim() ===
          cleanBarcode
      );

      if (!found) {
        alert(
          "Barcode tidak ditemukan dalam Stock Opname."
        );

        setScanResult("");
        return;
      }

      console.log(
        "BARANG DITEMUKAN:",
        found
      );

      // Tutup scanner
      setShowScanner(false);
      setScanResult("");

      // Scroll ke barang
      setTimeout(() => {
        const el = document.getElementById(
          `item-${found.id}`
        );

        if (el) {
          el.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }

        // Fokus ke Physical Qty
        setTimeout(() => {
          const input =
            inputRefs.current[found.id];

          if (input) {
            input.focus();
            input.select();
          }
        }, 400);
      }, 100);
    },
    [data]
  );

  // =========================================================
  // APPROVE
  // =========================================================

  async function approve() {
    if (!data) return;

    if (data.status === "APPROVED") {
      alert(
        "Stock Opname sudah disahkan."
      );
      return;
    }

    const ok = confirm(
      "Approve Stock Opname ini?\n\nSetelah disahkan, data Stock Opname tidak dapat diubah lagi."
    );

    if (!ok) {
      return;
    }

    try {
      setApproving(true);

      const res = await fetch(
        `/api/stock-opname/${id}`,
        {
          method: "POST",
        }
      );

      const json = await res.json();

      alert(
        json.message ||
          "Proses approve selesai."
      );

      if (json.success) {
        router.push("/stock-opname");
      }
    } catch (error) {
      console.error(
        "APPROVE STOCK OPNAME ERROR:",
        error
      );

      alert(
        "Gagal approve Stock Opname."
      );
    } finally {
      setApproving(false);
    }
  }

  // =========================================================
  // SUMMARY
  // =========================================================

  const totalItem =
    data?.items.length ?? 0;

  const countedItem =
    data?.items.filter(
      (item) =>
        item.physicalQty !== 0 ||
        item.systemQty === 0
    ).length ?? 0;

  const plusItem =
    data?.items.filter(
      (item) => item.difference > 0
    ).length ?? 0;

  const minusItem =
    data?.items.filter(
      (item) => item.difference < 0
    ).length ?? 0;

  const totalPlus =
    data?.items.reduce(
      (total, item) =>
        total +
        (item.difference > 0
          ? item.difference
          : 0),
      0
    ) ?? 0;

  const totalMinus =
    data?.items.reduce(
      (total, item) =>
        total +
        (item.difference < 0
          ? Math.abs(item.difference)
          : 0),
      0
    ) ?? 0;

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              <span className="font-medium text-slate-600">
                Memuat Stock Opname...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // DATA TIDAK DITEMUKAN
  // =========================================================

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              !
            </div>

            <h2 className="text-lg font-bold text-slate-800">
              Stock Opname tidak ditemukan
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Data mungkin sudah dihapus atau ID tidak valid.
            </p>

            <Link
              href="/stock-opname"
              className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Kembali ke Stock Opname
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isApproved =
    data.status === "APPROVED";

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">

        {/* =====================================================
            TOP HEADER
        ====================================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="p-5 md:p-6">

            {/* Breadcrumb / Back */}

            <div className="mb-5">
              <Link
                href="/stock-opname"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600"
              >
                ← Kembali ke Stock Opname
              </Link>
            </div>

            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

              {/* INFO */}

              <div>
                <div className="flex flex-wrap items-center gap-3">

                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                    Stock Opname
                  </h1>

                  <span
                    className={`
                      rounded-full px-3 py-1 text-xs font-bold
                      ${
                        isApproved
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }
                    `}
                  >
                    {data.status}
                  </span>

                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500">

                  <span>
                    Nomor:
                    <strong className="ml-1 text-slate-800">
                      {data.code}
                    </strong>
                  </span>

                  <span>
                    Tanggal:
                    <strong className="ml-1 text-slate-800">
                      {new Date(
                        data.date
                      ).toLocaleDateString(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    </strong>
                  </span>

                </div>

              </div>

              {/* ACTIONS */}

              <div className="flex flex-wrap gap-2">

                {!isApproved && (
                  <button
                    type="button"
                    onClick={() =>
                      setShowScanner(true)
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700"
                  >
                    📷 Scan Barcode
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    window.print()
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  🖨 Print
                </button>

                <a
                  href={`/api/laporan/stock-opname/${id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  PDF
                </a>

                <a
                  href={`/api/laporan/stock-opname/${id}/excel`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  Excel
                </a>

                {!isApproved && (
                  <button
                    type="button"
                    onClick={approve}
                    disabled={approving}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {approving
                      ? "Memproses..."
                      : "✓ Approve"}
                  </button>
                )}

              </div>

            </div>
          </div>
        </div>

        {/* =====================================================
            SUMMARY CARDS
        ====================================================== */}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total Item
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-900">
              {totalItem}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Selisih Plus
            </div>

            <div className="mt-2 text-2xl font-bold text-emerald-600">
              +{totalPlus}
            </div>

            <div className="mt-1 text-xs text-slate-400">
              {plusItem} item
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Selisih Minus
            </div>

            <div className="mt-2 text-2xl font-bold text-red-600">
              -{totalMinus}
            </div>

            <div className="mt-1 text-xs text-slate-400">
              {minusItem} item
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Status Hitung
            </div>

            <div className="mt-2 text-2xl font-bold text-blue-600">
              {countedItem}
              <span className="text-base font-medium text-slate-400">
                /{totalItem}
              </span>
            </div>

            <div className="mt-1 text-xs text-slate-400">
              item sudah dihitung
            </div>
          </div>

        </div>

        {/* =====================================================
            APPROVED INFO
        ====================================================== */}

        {isApproved && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                ✓
              </div>

              <div>
                <div className="font-semibold text-emerald-800">
                  Stock Opname sudah disahkan
                </div>

                <div className="mt-1 text-sm text-emerald-700">
                  Data fisik dan selisih sudah diterapkan ke stok inventory.
                  Data tidak dapat diubah kembali.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            TABLE
        ====================================================== */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-5 py-4">

            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">

              <div>
                <h2 className="font-bold text-slate-900">
                  Daftar Barang
                </h2>

                <p className="text-sm text-slate-500">
                  Masukkan jumlah fisik hasil perhitungan gudang.
                </p>
              </div>

              {!isApproved && (
                <div className="text-xs text-slate-400">
                  Tip: gunakan Scan Barcode untuk menemukan barang dengan cepat.
                </div>
              )}

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full min-w-[800px] border-collapse">

              <thead>
                <tr className="bg-slate-50">

                  <th className="border-b border-slate-200 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                    No
                  </th>

                  <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    Barang
                  </th>

                  <th className="border-b border-slate-200 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                    System Qty
                  </th>

                  <th className="border-b border-slate-200 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                    Physical Qty
                  </th>

                  <th className="border-b border-slate-200 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                    Selisih
                  </th>

                </tr>
              </thead>

              <tbody>

                {data.items.map(
                  (item, index) => {

                    const difference =
                      item.difference ??
                      item.physicalQty -
                        item.systemQty;

                    const isPlus =
                      difference > 0;

                    const isMinus =
                      difference < 0;

                    return (
                      <tr
                        key={item.id}
                        id={`item-${item.id}`}
                        className={`
                          transition
                          ${
                            difference !== 0
                              ? "bg-amber-50/40"
                              : "hover:bg-slate-50"
                          }
                        `}
                      >

                        {/* NO */}

                        <td className="border-b border-slate-100 px-4 py-4 text-center text-sm text-slate-500">
                          {index + 1}
                        </td>

                        {/* BARANG */}

                        <td className="border-b border-slate-100 px-4 py-4">

                          <div className="font-semibold text-slate-800">
                            {item.barang?.name ||
                              "-"}
                          </div>

                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">

                            <span>
                              Kode:{" "}
                              <strong className="text-slate-600">
                                {item.barang?.code ||
                                  "-"}
                              </strong>
                            </span>

                            <span>
                              Barcode:{" "}
                              <strong className="text-slate-600">
                                {item.barang?.barcode ||
                                  "-"}
                              </strong>
                            </span>

                            {item.barang?.unit && (
                              <span>
                                Satuan:{" "}
                                <strong className="text-slate-600">
                                  {item.barang.unit}
                                </strong>
                              </span>
                            )}

                          </div>

                        </td>

                        {/* SYSTEM QTY */}

                        <td className="border-b border-slate-100 px-4 py-4 text-center">

                          <span className="font-semibold text-slate-700">
                            {item.systemQty}
                          </span>

                        </td>

                        {/* PHYSICAL QTY */}

                        <td className="border-b border-slate-100 px-4 py-4 text-center">

                          <div className="flex justify-center">

                            <input
                              ref={(el) => {
                                inputRefs.current[
                                  item.id
                                ] = el;
                              }}
                              type="number"
                              min="0"
                              step="any"
                              value={
                                item.physicalQty
                              }
                              disabled={
                                isApproved ||
                                savingItemId ===
                                  item.id
                              }
                              onChange={(e) => {
                                const value =
                                  Number(
                                    e.target.value
                                  );

                                if (
                                  Number.isFinite(
                                    value
                                  ) &&
                                  value >= 0
                                ) {
                                  updateQty(
                                    item.id,
                                    value
                                  );
                                }
                              }}
                              className={`
                                w-28 rounded-lg
                                border
                                px-3 py-2
                                text-center
                                font-semibold
                                outline-none
                                transition
                                ${
                                  isApproved
                                    ? "cursor-not-allowed bg-slate-100 text-slate-500"
                                    : "border-slate-300 bg-white text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                }
                              `}
                            />

                          </div>

                        </td>

                        {/* DIFFERENCE */}

                        <td className="border-b border-slate-100 px-4 py-4 text-center">

                          <span
                            className={`
                              inline-flex min-w-[70px]
                              items-center justify-center
                              rounded-full px-3 py-1.5
                              text-sm font-bold
                              ${
                                isPlus
                                  ? "bg-emerald-100 text-emerald-700"
                                  : isMinus
                                  ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-600"
                              }
                            `}
                          >
                            {isPlus
                              ? `+${difference}`
                              : difference}
                          </span>

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        </div>

      </div>

      {/* =======================================================
          CAMERA MODAL
      ======================================================== */}

      {showScanner && !isApproved && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => {
            setShowScanner(false);
            setScanResult("");
          }}
        >

          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">

              <div>
                <h2 className="font-bold text-slate-900">
                  Scan Barcode Barang
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Arahkan kamera ke barcode barang
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowScanner(false);
                  setScanResult("");
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl font-bold text-slate-400 hover:bg-slate-100 hover:text-red-600"
              >
                ×
              </button>

            </div>

            {/* CAMERA */}

            <div className="p-4">

              <div className="overflow-hidden rounded-xl bg-black">

                <CameraBarcodeScanner
                  onScan={(barcode) => {
                    console.log(
                      "BARCODE TERBACA:",
                      barcode
                    );

                    setScanResult(
                      barcode
                    );

                    findBarangByBarcode(
                      barcode
                    );
                  }}
                  onClose={() => {
                    setShowScanner(false);
                    setScanResult("");
                  }}
                />

              </div>

              {/* HASIL SCAN */}

              <div className="mt-4">

                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Hasil Scan
                </label>

                <input
                  type="text"
                  placeholder="Masukkan barcode secara manual..."
                  value={scanResult}
                  onChange={(e) =>
                    setScanResult(
                      e.target.value
                    )
                  }
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter"
                    ) {
                      findBarangByBarcode(
                        scanResult
                      );
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

              </div>

              {/* CARI */}

              <button
                type="button"
                onClick={() => {
                  if (
                    scanResult.trim()
                  ) {
                    findBarangByBarcode(
                      scanResult
                    );
                  } else {
                    alert(
                      "Masukkan barcode terlebih dahulu."
                    );
                  }
                }}
                className="mt-3 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Cari Barcode
              </button>

              {/* TUTUP */}

              <button
                type="button"
                onClick={() => {
                  setShowScanner(false);
                  setScanResult("");
                }}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Tutup Kamera
              </button>

            </div>

          </div>

        </div>
      )}

      {/* =======================================================
          PRINT STYLE
      ======================================================== */}

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          .min-h-screen {
            min-height: auto !important;
            background: white !important;
          }

          button,
          a {
            display: none !important;
          }

          input {
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
          }

          table {
            font-size: 11px !important;
          }

          th,
          td {
            border: 1px solid #000 !important;
          }
        }
      `}</style>
    </div>
  );
}