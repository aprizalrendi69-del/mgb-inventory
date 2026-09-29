"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import CameraBarcodeScanner from "@/components/CameraBarcodeScanner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);

  const [scanResult, setScanResult] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  const [approving, setApproving] = useState(false);
  const [copyingWhatsApp, setCopyingWhatsApp] = useState(false);

  const [search, setSearch] = useState("");

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
  // FILTER ITEM
  // =========================================================

  const filteredItems = useMemo(() => {
    if (!data?.items) {
      return [];
    }

    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return data.items;
    }

    return data.items.filter((item) => {
      const name = String(item.barang?.name || "").toLowerCase();
      const code = String(item.barang?.code || "").toLowerCase();
      const barcode = String(item.barang?.barcode || "").toLowerCase();
      const category = String(item.barang?.category || "").toLowerCase();
      const unit = String(item.barang?.unit || "").toLowerCase();

      return (
        name.includes(keyword) ||
        code.includes(keyword) ||
        barcode.includes(keyword) ||
        category.includes(keyword) ||
        unit.includes(keyword)
      );
    });
  }, [data, search]);

  // =========================================================
  // UPDATE QTY
  // =========================================================

  async function updateQty(itemId: number, qty: number) {
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
  // UPDATE CATATAN
  // =========================================================

  async function updateNote(itemId: number, note: string) {
    if (!data || data.status === "APPROVED") {
      return;
    }

    const cleanNote = note.trim().slice(0, 500);

    try {
      setSavingNoteId(itemId);

      const res = await fetch(`/api/stock-opname/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemId,
          note: cleanNote || null,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        alert(json.message || "Gagal menyimpan catatan.");
        return;
      }

      setData((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  note: cleanNote || null,
                }
              : item
          ),
        };
      });
    } catch (error) {
      console.error("UPDATE NOTE ERROR:", error);
      alert("Gagal menyimpan catatan.");
    } finally {
      setSavingNoteId(null);
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

      console.log("BARCODE YANG DICARI:", cleanBarcode);

      const found = data.items.find(
        (item) =>
          String(item.barang?.barcode || "").trim() === cleanBarcode
      );

      if (!found) {
        alert("Barcode tidak ditemukan dalam Stock Opname.");
        setScanResult("");
        return;
      }

      console.log("BARANG DITEMUKAN:", found);

      setShowScanner(false);
      setScanResult("");
      setSearch("");

      setTimeout(() => {
        const el = document.getElementById(`item-${found.id}`);

        if (el) {
          el.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }

        setTimeout(() => {
          const input = inputRefs.current[found.id];

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
  // SUMMARY
  // =========================================================

  const totalItem = data?.items.length ?? 0;

  const countedItem =
    data?.items.filter(
      (item) =>
        item.physicalQty !== 0 || item.systemQty === 0
    ).length ?? 0;

  const plusItem =
    data?.items.filter((item) => item.difference > 0).length ?? 0;

  const minusItem =
    data?.items.filter((item) => item.difference < 0).length ?? 0;

  const totalPlus =
    data?.items.reduce(
      (total, item) =>
        total + (item.difference > 0 ? item.difference : 0),
      0
    ) ?? 0;

  const totalMinus =
    data?.items.reduce(
      (total, item) =>
        total +
        (item.difference < 0 ? Math.abs(item.difference) : 0),
      0
    ) ?? 0;

  const isApproved = data?.status === "APPROVED";

  const matchedItems =
    data?.items.filter((item) => item.difference === 0) ?? [];

  const differenceItems =
    data?.items.filter((item) => item.difference !== 0) ?? [];

  const formatQty = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 4,
    }).format(Number(value) || 0);

  const accuracy =
    totalItem > 0
      ? ((matchedItems.length / totalItem) * 100).toFixed(1)
      : "0.0";

  // =========================================================
  // APPROVE
  // =========================================================

  async function approve() {
    if (!data) return;

    if (data.status === "APPROVED") {
      alert("Stock Opname sudah disahkan.");
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

      const res = await fetch(`/api/stock-opname/${id}`, {
        method: "POST",
      });

      const json = await res.json();

      alert(json.message || "Proses approve selesai.");

      if (json.success) {
        router.push("/stock-opname");
      }
    } catch (error) {
      console.error("APPROVE STOCK OPNAME ERROR:", error);
      alert("Gagal approve Stock Opname.");
    } finally {
      setApproving(false);
    }
  }

  // =========================================================
  // BUILD WHATSAPP MESSAGE
  // =========================================================

  const buildWhatsAppMessage = useCallback(() => {
    if (!data) {
      return "";
    }

    const dateText = new Date(data.date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const currentAccuracy =
      totalItem > 0
        ? ((matchedItems.length / totalItem) * 100).toFixed(1)
        : "0";

    let message = "";

    message += `*📋 HASIL STOCK OPNAME*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🏢 *PT.MITRA GARAM BOGATAMA*\n`;
    message += `🧾 No. Opname: *${data.code}*\n`;
    message += `📅 Tanggal: *${dateText}*\n`;
    message += `📌 Status: *${data.status}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    message += `*📊 RINGKASAN HASIL*\n`;
    message += `📦 Total Item     : *${totalItem} item*\n`;
    message += `✅ Barang Cocok   : *${matchedItems.length} item*\n`;
    message += `⚠️ Barang Selisih : *${differenceItems.length} item*\n`;
    message += `🟢 Selisih Plus   : *+${formatQty(totalPlus)}*\n`;
    message += `🔴 Selisih Minus  : *-${formatQty(totalMinus)}*\n`;
    message += `📈 Akurasi        : *${currentAccuracy}%*\n`;

    if (differenceItems.length > 0) {
      message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      message += `*⚠️ DETAIL BARANG SELISIH*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;

      differenceItems.forEach((item, index) => {
        const difference = Number(item.difference || 0);
        const sign = difference > 0 ? "+" : "";
        const icon = difference > 0 ? "🟢" : "🔴";

        message += `\n${index + 1}. *${item.barang?.name || "-"}*\n`;
        message += `   Kode    : ${item.barang?.code || "-"}\n`;

        // BARCODE DIHAPUS DARI PESAN WHATSAPP

        message += `   Sistem  : ${formatQty(item.systemQty)}\n`;
        message += `   Fisik   : ${formatQty(item.physicalQty)}\n`;
        message += `   Selisih : ${icon} *${sign}${formatQty(
          difference
        )}*\n`;

        if (item.barang?.unit) {
          message += `   Satuan  : ${item.barang.unit}\n`;
        }

        if (item.note) {
          message += `   Catatan : ${item.note}\n`;
        }
      });
    } else {
      message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      message += `*✅ HASIL OPNAME*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `Seluruh item sesuai antara stok sistem dan stok fisik.\n`;
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*📌 KESIMPULAN*\n`;
    message += `Stock Opname *${data.code}* mencatat *${totalItem} item*, dengan *${matchedItems.length} item* sesuai dan *${differenceItems.length} item* memiliki selisih.\n`;

    message += isApproved
      ? `\n✅ Status: *SUDAH DISETUJUI*\n`
      : `\n🕐 Status: *BELUM DISETUJUI*\n`;

    message += `\n_PT.MITRA GARAM BOGATAMA • Stock Opname Report_`;

    return message;
  }, [
    data,
    totalItem,
    matchedItems.length,
    differenceItems,
    totalPlus,
    totalMinus,
    isApproved,
  ]);

  // =========================================================
  // WHATSAPP WEB
  // =========================================================

  function exportWhatsApp() {
    if (!data) return;

    const message = buildWhatsAppMessage();

    if (!message) {
      alert("Pesan WhatsApp tidak dapat dibuat.");
      return;
    }

    const whatsappUrl =
      `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  // =========================================================
  // COPY WHATSAPP MESSAGE
  // =========================================================

  async function copyWhatsAppMessage() {
    if (!data) return;

    const message = buildWhatsAppMessage();

    if (!message) {
      alert("Pesan WhatsApp tidak dapat dibuat.");
      return;
    }

    try {
      setCopyingWhatsApp(true);

      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(message);
      } else {
        const textarea = document.createElement("textarea");

        textarea.value = message;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        textarea.setAttribute("readonly", "");

        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const success = document.execCommand("copy");

        document.body.removeChild(textarea);

        if (!success) {
          throw new Error("Clipboard copy failed");
        }
      }

      setTimeout(() => {
        setCopyingWhatsApp(false);
      }, 1800);
    } catch (error) {
      console.error("COPY WHATSAPP MESSAGE ERROR:", error);
      setCopyingWhatsApp(false);

      alert(
        "Pesan tidak berhasil disalin. Silakan coba lagi."
      );
    }
  }

  // =========================================================
  // EXPORT PDF PREMIUM
  // =========================================================

  async function exportPDF() {
    if (!data || filteredItems.length === 0) {
      alert("Tidak ada data yang dapat diekspor.");
      return;
    }

    try {
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const generatedAt = new Date();

      const dateText = new Date(data.date).toLocaleDateString(
        "id-ID",
        {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }
      );

      pdf.setFillColor(24, 53, 45);
      pdf.rect(0, 0, pageWidth, 32, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text(
        "PT.MITRA GARAM BOGATAMA",
        margin,
        13
      );

      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        "INVENTORY CONTROL SYSTEM",
        margin,
        19
      );

      pdf.setFontSize(15);
      pdf.setFont("helvetica", "bold");
      pdf.text(
        "STOCK OPNAME REPORT",
        pageWidth - margin,
        13,
        { align: "right" }
      );

      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        "Laporan pemeriksaan stok fisik",
        pageWidth - margin,
        19,
        { align: "right" }
      );

      pdf.setTextColor(24, 53, 45);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text(data.code, margin, 42);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);

      pdf.text(
        `Tanggal Opname: ${dateText}`,
        margin,
        48
      );

      pdf.text(
        `Status: ${data.status}`,
        margin,
        53
      );

      pdf.text(
        `Generated: ${generatedAt.toLocaleString("id-ID")}`,
        pageWidth - margin,
        48,
        { align: "right" }
      );

      pdf.text(
        `Filter: ${
          search.trim()
            ? `"${search.trim()}"`
            : "Semua Barang"
        }`,
        pageWidth - margin,
        53,
        { align: "right" }
      );

      const cards = [
        ["TOTAL ITEM", totalItem, "item"],
        ["BARANG COCOK", matchedItems.length, "item"],
        ["SELISIH", differenceItems.length, "item"],
        ["SELISIH MINUS", `-${formatQty(totalMinus)}`, "qty"],
        ["SELISIH PLUS", `+${formatQty(totalPlus)}`, "qty"],
      ];

      const cardY = 59;
      const cardGap = 4;
      const cardW =
        (pageWidth - margin * 2 - cardGap * 4) / 5;

      cards.forEach(([label, value, suffix], i) => {
        const x =
          margin + i * (cardW + cardGap);

        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);

        pdf.roundedRect(
          x,
          cardY,
          cardW,
          20,
          2,
          2,
          "FD"
        );

        pdf.setTextColor(100, 116, 139);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "bold");

        pdf.text(
          String(label),
          x + 4,
          cardY + 6
        );

        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(12);

        pdf.text(
          String(value),
          x + 4,
          cardY + 14
        );

        if (suffix === "item") {
          pdf.setFontSize(7);
          pdf.setTextColor(100, 116, 139);

          pdf.text(
            "item",
            x +
              4 +
              pdf.getTextWidth(String(value)) +
              2,
            cardY + 14
          );
        }
      });

      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(24, 53, 45);

      pdf.text(
        `AKURASI OPNAME: ${accuracy}%`,
        margin,
        87
      );

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 116, 139);

      pdf.text(
        isApproved
          ? "Dokumen telah disahkan dan tidak dapat diubah."
          : "Dokumen belum disahkan.",
        margin + 45,
        87
      );

      autoTable(pdf, {
        startY: 91,
        margin: {
          left: margin,
          right: margin,
          bottom: 14,
        },
        head: [
          [
            "NO",
            "KODE",
            "BARANG",
            "BARCODE",
            "UNIT",
            "SYSTEM QTY",
            "PHYSICAL QTY",
            "SELISIH",
            "CATATAN",
          ],
        ],
        body: filteredItems.map(
          (item, index) => {
            const diff = Number(
              item.difference ??
                item.physicalQty -
                  item.systemQty
            );

            return [
              index + 1,
              item.barang?.code || "-",
              item.barang?.name || "-",
              item.barang?.barcode || "-",
              item.barang?.unit || "-",
              formatQty(
                Number(
                  item.systemQty || 0
                )
              ),
              formatQty(
                Number(
                  item.physicalQty || 0
                )
              ),
              diff > 0
                ? `+${formatQty(diff)}`
                : formatQty(diff),
              item.note || "-",
            ];
          }
        ),
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 7.5,
          cellPadding: 2.4,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          valign: "middle",
        },
        headStyles: {
          fillColor: [24, 53, 45],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7,
          halign: "center",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: {
            cellWidth: 9,
            halign: "center",
          },
          1: {
            cellWidth: 25,
          },
          2: {
            cellWidth: 57,
          },
          3: {
            cellWidth: 32,
          },
          4: {
            cellWidth: 18,
            halign: "center",
          },
          5: {
            cellWidth: 27,
            halign: "right",
          },
          6: {
            cellWidth: 29,
            halign: "right",
          },
          7: {
            cellWidth: 25,
            halign: "right",
            fontStyle: "bold",
          },
          8: {
            cellWidth: 48,
          },
        },
        didParseCell: (hookData: any) => {
          if (
            hookData.section === "body" &&
            hookData.column.index === 7
          ) {
            const raw = String(
              hookData.cell.raw || ""
            );

            if (raw.startsWith("+")) {
              hookData.cell.styles.textColor = [
                5,
                150,
                105,
              ];
            } else if (raw !== "0") {
              hookData.cell.styles.textColor = [
                220,
                38,
                38,
              ];
            }
          }
        },
        didDrawPage: () => {
          const page =
            pdf.getNumberOfPages();

          pdf.setDrawColor(
            226,
            232,
            240
          );

          pdf.line(
            margin,
            pageHeight - 10,
            pageWidth - margin,
            pageHeight - 10
          );

          pdf.setFont(
            "helvetica",
            "normal"
          );

          pdf.setFontSize(7);
          pdf.setTextColor(
            100,
            116,
            139
          );

          pdf.text(
            "MGB ERP • Stock Opname Report",
            margin,
            pageHeight - 5
          );

          pdf.text(
            `Page ${page}`,
            pageWidth - margin,
            pageHeight - 5,
            {
              align: "right",
            }
          );
        },
      });

      const totalPages =
        pdf.getNumberOfPages();

      for (
        let page = 1;
        page <= totalPages;
        page++
      ) {
        pdf.setPage(page);
        pdf.setFontSize(7);
        pdf.setTextColor(
          100,
          116,
          139
        );

        pdf.text(
          `Page ${page} / ${totalPages}`,
          pageWidth - margin,
          pageHeight - 5,
          {
            align: "right",
          }
        );
      }

      const safeCode =
        data.code.replace(
          /[^a-zA-Z0-9-_]+/g,
          "-"
        );

      const safeSearch =
        search
          .trim()
          .replace(
            /[^a-zA-Z0-9-_]+/g,
            "-"
          )
          .slice(0, 30);

      pdf.save(
        [
          "Stock-Opname",
          safeCode,
          safeSearch || null,
          generatedAt
            .toISOString()
            .slice(0, 10),
        ]
          .filter(Boolean)
          .join("-") + ".pdf"
      );
    } catch (error) {
      console.error(
        "EXPORT STOCK OPNAME PDF ERROR:",
        error
      );

      alert(
        "Gagal membuat PDF. Pastikan package jspdf dan jspdf-autotable tersedia."
      );
    }
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-[1440px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />

              <span className="text-sm font-semibold text-slate-600">
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
      <div className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-[1440px]">
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-lg font-bold text-red-600">
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
              className="mt-5 inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
            >
              Kembali ke Stock Opname
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="min-h-screen bg-[#f6f8f7] px-3 py-4 md:px-5 lg:px-6">
      <div className="mx-auto w-full max-w-[1440px] space-y-4">

        {/* =====================================================
            HEADER
        ====================================================== */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 px-5 py-5 md:px-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

              <div className="min-w-0">
                <Link
                  href="/stock-opname"
                  className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-100/80 transition hover:text-white"
                >
                  ← Kembali ke Stock Opname
                </Link>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-lg">
                    📋
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">
                        Stock Opname
                      </h1>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                          isApproved
                            ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100"
                            : "border-amber-300/30 bg-amber-400/15 text-amber-100"
                        }`}
                      >
                        {data.status}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-emerald-100/75">
                      <span>
                        Nomor:
                        <strong className="ml-1 text-white">
                          {data.code}
                        </strong>
                      </span>

                      <span>
                        Tanggal:
                        <strong className="ml-1 text-white">
                          {new Date(data.date).toLocaleDateString(
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
                </div>
              </div>

              {/* ACTIONS */}

              <div className="flex flex-wrap gap-2 xl:max-w-[720px] xl:justify-end">

                {!isApproved && (
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-400/20 bg-purple-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-purple-700"
                  >
                    📷 Scan
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-white/15"
                >
                  🖨 Print
                </button>

                <button
                  type="button"
                  onClick={exportPDF}
                  disabled={filteredItems.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  PDF
                </button>

                <a
                  href={`/api/laporan/stock-opname/${id}/excel`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-400"
                >
                  Excel
                </a>

                <button
                  type="button"
                  onClick={copyWhatsAppMessage}
                  disabled={copyingWhatsApp}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-white/15 disabled:opacity-70"
                >
                  {copyingWhatsApp
                    ? "✓ Tersalin"
                    : "📋 Salin"}
                </button>

                <button
                  type="button"
                  onClick={exportWhatsApp}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-green-400"
                >
                  💬 WhatsApp
                </button>

                {!isApproved && (
                  <button
                    type="button"
                    onClick={approve}
                    disabled={approving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-xs font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {approving
                      ? "Memproses..."
                      : "✓ Approve"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* QUICK INFO */}

          <div className="grid grid-cols-2 divide-x divide-slate-100 md:grid-cols-4">
            <div className="px-5 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Item
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900">
                {totalItem}
              </div>
            </div>

            <div className="px-5 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Barang Cocok
              </div>
              <div className="mt-1 text-lg font-bold text-emerald-700">
                {matchedItems.length}
              </div>
            </div>

            <div className="px-5 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Selisih
              </div>
              <div className="mt-1 text-lg font-bold text-amber-600">
                {differenceItems.length}
              </div>
            </div>

            <div className="px-5 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Akurasi
              </div>
              <div className="mt-1 text-lg font-bold text-emerald-700">
                {accuracy}%
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            SUMMARY CARDS
        ====================================================== */}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_5px_18px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Item
              </span>

              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-sm">
                📦
              </span>
            </div>

            <div className="mt-2 text-xl font-bold text-slate-900">
              {totalItem}
            </div>

            <div className="mt-0.5 text-[11px] text-slate-400">
              seluruh barang opname
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-white px-4 py-3.5 shadow-[0_5px_18px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Selisih Plus
              </span>

              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-sm">
                ↗
              </span>
            </div>

            <div className="mt-2 text-xl font-bold text-emerald-600">
              +{formatQty(totalPlus)}
            </div>

            <div className="mt-0.5 text-[11px] text-slate-400">
              {plusItem} item
            </div>
          </div>

          <div className="rounded-xl border border-red-100 bg-white px-4 py-3.5 shadow-[0_5px_18px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Selisih Minus
              </span>

              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-sm">
                ↘
              </span>
            </div>

            <div className="mt-2 text-xl font-bold text-red-600">
              -{formatQty(totalMinus)}
            </div>

            <div className="mt-0.5 text-[11px] text-slate-400">
              {minusItem} item
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-white px-4 py-3.5 shadow-[0_5px_18px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Status Hitung
              </span>

              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-sm">
                ✓
              </span>
            </div>

            <div className="mt-2 text-xl font-bold text-blue-600">
              {countedItem}
              <span className="text-sm font-medium text-slate-400">
                /{totalItem}
              </span>
            </div>

            <div className="mt-0.5 text-[11px] text-slate-400">
              item sudah dihitung
            </div>
          </div>
        </section>

        {/* =====================================================
            APPROVED INFO
        ====================================================== */}

        {isApproved && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-sm font-bold text-emerald-700">
                ✓
              </div>

              <div>
                <div className="text-sm font-bold text-emerald-800">
                  Stock Opname sudah disahkan
                </div>

                <div className="mt-0.5 text-xs leading-5 text-emerald-700">
                  Data fisik dan selisih sudah diterapkan ke stok inventory.
                  Data tidak dapat diubah kembali.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            TABLE CARD
        ====================================================== */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">

          {/* TABLE HEADER */}

          <div className="border-b border-slate-200 bg-white px-4 py-4 md:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-sm">
                    📦
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Daftar Barang
                    </h2>

                    <p className="text-[11px] text-slate-400">
                      Input stok fisik dan catatan pemeriksaan
                    </p>
                  </div>
                </div>
              </div>

              {/* SEARCH */}

              <div className="w-full lg:w-[420px]">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4.5 w-4.5 text-slate-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle
                        cx="11"
                        cy="11"
                        r="7"
                      />
                      <path d="m20 20-3.5-3.5" />
                    </svg>
                  </div>

                  <input
                    type="text"
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    placeholder="Cari nama, kode, barcode, kategori..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-10 text-xs font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-lg font-semibold text-slate-400 transition hover:text-red-500"
                      title="Hapus pencarian"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="mt-1.5 flex items-center justify-between px-1 text-[10px]">
                  <span className="text-slate-400">
                    {search
                      ? `Filter: "${search}"`
                      : "Menampilkan seluruh barang"}
                  </span>

                  <span className="font-bold text-slate-500">
                    {filteredItems.length}/{totalItem}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="border-b border-slate-200 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    No
                  </th>

                  <th className="border-b border-slate-200 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Barang
                  </th>

                  <th className="border-b border-slate-200 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    System Qty
                  </th>

                  <th className="border-b border-slate-200 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Physical Qty
                  </th>

                  <th className="border-b border-slate-200 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Selisih
                  </th>

                  <th className="border-b border-slate-200 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Catatan
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center"
                    >
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        🔎
                      </div>

                      <div className="mt-3 text-sm font-bold text-slate-700">
                        Barang tidak ditemukan
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        Tidak ada barang yang cocok dengan pencarian "
                        {search}".
                      </div>

                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-800"
                      >
                        Tampilkan Semua
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => {
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
                        className={`group transition-colors ${
                          difference !== 0
                            ? "bg-amber-50/35 hover:bg-amber-50/60"
                            : "hover:bg-slate-50/70"
                        }`}
                      >
                        {/* NO */}

                        <td className="border-b border-slate-100 px-3 py-3.5 text-center text-xs font-medium text-slate-400">
                          {index + 1}
                        </td>

                        {/* BARANG */}

                        <td className="border-b border-slate-100 px-3 py-3.5">
                          <div className="font-semibold text-sm text-slate-800">
                            {item.barang?.name || "-"}
                          </div>

                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                            <span>
                              Kode:
                              <strong className="ml-1 text-slate-600">
                                {item.barang?.code || "-"}
                              </strong>
                            </span>

                            <span>
                              Barcode:
                              <strong className="ml-1 text-slate-600">
                                {item.barang?.barcode || "-"}
                              </strong>
                            </span>

                            {item.barang?.unit && (
                              <span>
                                Satuan:
                                <strong className="ml-1 text-slate-600">
                                  {item.barang.unit}
                                </strong>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* SYSTEM QTY */}

                        <td className="border-b border-slate-100 px-3 py-3.5 text-center">
                          <span className="inline-flex min-w-[64px] items-center justify-center rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700">
                            {formatQty(item.systemQty)}
                          </span>
                        </td>

                        {/* PHYSICAL QTY */}

                        <td className="border-b border-slate-100 px-3 py-3.5 text-center">
                          <div className="flex justify-center">
                            <input
                              ref={(el) => {
                                inputRefs.current[item.id] = el;
                              }}
                              type="number"
                              min="0"
                              step="any"
                              value={item.physicalQty}
                              disabled={
                                isApproved ||
                                savingItemId === item.id
                              }
                              onChange={(e) => {
                                const value =
                                  Number(e.target.value);

                                if (
                                  Number.isFinite(value) &&
                                  value >= 0
                                ) {
                                  updateQty(
                                    item.id,
                                    value
                                  );
                                }
                              }}
                              className={`w-24 rounded-lg border px-2.5 py-2 text-center text-xs font-bold outline-none transition ${
                                isApproved
                                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                                  : "border-emerald-200 bg-white text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
                              }`}
                            />
                          </div>
                        </td>

                        {/* DIFFERENCE */}

                        <td className="border-b border-slate-100 px-3 py-3.5 text-center">
                          <span
                            className={`inline-flex min-w-[62px] items-center justify-center rounded-full px-2.5 py-1.5 text-xs font-bold ${
                              isPlus
                                ? "bg-emerald-100 text-emerald-700"
                                : isMinus
                                ? "bg-red-100 text-red-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {isPlus
                              ? `+${formatQty(
                                  difference
                                )}`
                              : formatQty(
                                  difference
                                )}
                          </span>
                        </td>

                        {/* CATATAN */}

                        <td className="border-b border-slate-100 px-3 py-3.5 align-top">
                          <div className="relative min-w-[260px]">
                            <textarea
                              defaultValue={
                                item.note || ""
                              }
                              disabled={
                                isApproved ||
                                savingNoteId ===
                                  item.id
                              }
                              maxLength={500}
                              rows={2}
                              placeholder={
                                isApproved
                                  ? "Tidak ada catatan"
                                  : "Tulis catatan pemeriksaan..."
                              }
                              onBlur={(e) => {
                                const nextNote =
                                  e.target.value;

                                if (
                                  nextNote.trim() !==
                                  String(
                                    item.note || ""
                                  ).trim()
                                ) {
                                  updateNote(
                                    item.id,
                                    nextNote
                                  );
                                }
                              }}
                              className={`w-full resize-none rounded-lg border px-3 py-2 text-xs leading-5 outline-none transition placeholder:text-slate-400 ${
                                isApproved
                                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                              }`}
                            />

                            <span
                              className={`pointer-events-none absolute bottom-1.5 right-2 text-[9px] font-medium ${
                                savingNoteId === item.id
                                  ? "text-emerald-600"
                                  : "text-slate-400"
                              }`}
                            >
                              {savingNoteId === item.id
                                ? "Menyimpan..."
                                : `${Math.min(
                                    500,
                                    String(
                                      item.note || ""
                                    ).length
                                  )}/500`}
                            </span>
                          </div>

                          {!isApproved &&
                            savingNoteId !== item.id && (
                              <div className="mt-1 text-[9px] font-medium text-slate-400">
                                Simpan otomatis saat keluar kolom
                              </div>
                            )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE FOOTER */}

          <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Menampilkan{" "}
              <strong className="text-slate-600">
                {filteredItems.length}
              </strong>{" "}
              dari{" "}
              <strong className="text-slate-600">
                {totalItem}
              </strong>{" "}
              item
            </span>

            <span>
              {isApproved
                ? "Dokumen terkunci setelah approval."
                : "Perubahan qty dan catatan tersimpan otomatis."}
            </span>
          </div>
        </section>
      </div>

      {/* =======================================================
          CAMERA MODAL
      ======================================================== */}

      {showScanner && !isApproved && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onClick={() => {
            setShowScanner(false);
            setScanResult("");
          }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}

            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-950 to-emerald-800 px-4 py-4">
              <div>
                <h2 className="text-sm font-bold text-white">
                  Scan Barcode Barang
                </h2>

                <p className="mt-0.5 text-[10px] text-emerald-100/75">
                  Arahkan kamera ke barcode barang
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowScanner(false);
                  setScanResult("");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-lg font-bold text-white transition hover:bg-white/20"
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

                    setScanResult(barcode);

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

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
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
                    if (e.key === "Enter") {
                      findBarangByBarcode(
                        scanResult
                      );
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (scanResult.trim()) {
                    findBarangByBarcode(
                      scanResult
                    );
                  } else {
                    alert(
                      "Masukkan barcode terlebih dahulu."
                    );
                  }
                }}
                className="mt-3 w-full rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800"
              >
                Cari Barcode
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowScanner(false);
                  setScanResult("");
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
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

          input,
          textarea {
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
          }

          table {
            font-size: 10px !important;
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