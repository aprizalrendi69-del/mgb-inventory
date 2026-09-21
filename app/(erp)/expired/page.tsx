"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileDown,
  Package,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ExpiredItem = {
  id: number;
  kodeBarang: string;
  namaBarang: string;
  batchNumber: string;
  qty: number;
  expiredDate: string;
  sisaHari: number;
  status: "AMAN" | "WARNING" | "EXPIRED";
};

type StatusFilter = "SEMUA" | "EXPIRED" | "WARNING" | "AMAN";

const STATUS_META = {
  EXPIRED: {
    label: "Expired",
    description: "Sudah melewati tanggal",
    icon: XCircle,
    badge:
      "border-red-200 bg-red-50 text-red-700",
    iconWrap:
      "bg-red-100 text-red-600",
    accent:
      "from-red-500 to-rose-600",
    soft:
      "bg-red-50/70",
    text:
      "text-red-600",
  },
  WARNING: {
    label: "Warning",
    description: "Mendekati expired",
    icon: AlertTriangle,
    badge:
      "border-amber-200 bg-amber-50 text-amber-700",
    iconWrap:
      "bg-amber-100 text-amber-600",
    accent:
      "from-amber-400 to-orange-500",
    soft:
      "bg-amber-50/70",
    text:
      "text-amber-600",
  },
  AMAN: {
    label: "Aman",
    description: "Masih dalam masa berlaku",
    icon: CheckCircle2,
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconWrap:
      "bg-emerald-100 text-emerald-600",
    accent:
      "from-emerald-400 to-teal-600",
    soft:
      "bg-emerald-50/70",
    text:
      "text-emerald-600",
  },
} as const;

function formatDate(date: string) {
  if (!date) return "-";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatLongDate(date: string) {
  if (!date) return "-";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("id-ID");
}

function getExpiryText(item: ExpiredItem) {
  const days = Number(item.sisaHari || 0);

  if (item.status === "EXPIRED") {
    return `${Math.abs(days)} hari lewat`;
  }

  if (days === 0) {
    return "Hari ini";
  }

  if (days === 1) {
    return "1 hari lagi";
  }

  return `${days} hari lagi`;
}

function getExpiryTone(status: ExpiredItem["status"]) {
  if (status === "EXPIRED") {
    return {
      text: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-100",
    };
  }

  if (status === "WARNING") {
    return {
      text: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
    };
  }

  return {
    text: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
  };
}

export default function ExpiredPage() {
  const [data, setData] = useState<ExpiredItem[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("SEMUA");
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);

  const [editData, setEditData] = useState({
    id: 0,
    batchNumber: "",
    qty: "",
    expiredDate: "",
  });

  async function load() {
    try {
      setLoading(true);

      const res = await fetch("/api/barang-batch", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setData(json.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error("Gagal mengambil data expired:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return data.filter((item) => {
      const cocokSearch =
        !keyword ||
        item.namaBarang?.toLowerCase().includes(keyword) ||
        item.kodeBarang?.toLowerCase().includes(keyword) ||
        item.batchNumber?.toLowerCase().includes(keyword);

      const cocokStatus =
        status === "SEMUA" || item.status === status;

      return cocokSearch && cocokStatus;
    });
  }, [data, search, status]);

  const summary = useMemo(() => {
    const expired = data.filter(
      (item) => item.status === "EXPIRED"
    ).length;

    const warning = data.filter(
      (item) => item.status === "WARNING"
    ).length;

    const aman = data.filter(
      (item) => item.status === "AMAN"
    ).length;

    const totalQty = data.reduce(
      (sum, item) => sum + Number(item.qty || 0),
      0
    );

    const filteredQty = filtered.reduce(
      (sum, item) => sum + Number(item.qty || 0),
      0
    );

    return {
      total: data.length,
      expired,
      warning,
      aman,
      totalQty,
      filteredQty,
    };
  }, [data, filtered]);

  function renderStatus(itemStatus: ExpiredItem["status"]) {
    const meta = STATUS_META[itemStatus];
    const Icon = meta.icon;

    return (
      <span
        className={[
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5",
          "text-[11px] font-bold uppercase tracking-[0.04em]",
          meta.badge,
        ].join(" ")}
      >
        <Icon className="h-3.5 w-3.5" />
        {meta.label}
      </span>
    );
  }

  async function exportPDF() {
    if (filtered.length === 0) {
      alert("Tidak ada data sesuai filter untuk diexport.");
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
      const now = new Date();

      const statusLabel =
        status === "SEMUA" ? "Semua Status" : status;

      const searchLabel = search.trim()
        ? `Pencarian: ${search.trim()}`
        : "Pencarian: Semua Barang";

      const filteredExpired = filtered.filter(
        (item) => item.status === "EXPIRED"
      ).length;

      const filteredWarning = filtered.filter(
        (item) => item.status === "WARNING"
      ).length;

      const filteredAman = filtered.filter(
        (item) => item.status === "AMAN"
      ).length;

      const filteredQty = filtered.reduce(
        (sum, item) => sum + Number(item.qty || 0),
        0
      );

      /*
       * PDF HEADER
       */
      pdf.setFillColor(24, 53, 45);
      pdf.rect(0, 0, pageWidth, 9, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text("MGB ERP", 14, 6);

      pdf.setFontSize(17);
      pdf.setTextColor(24, 53, 45);
      pdf.text("Monitoring Barang Expired", 14, 20);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        "Inventory Control • Monitoring masa berlaku batch barang",
        14,
        26
      );

      pdf.setFontSize(8);
      pdf.text(
        `Export: ${now.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })} ${now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        pageWidth - 14,
        14,
        { align: "right" }
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(
        `FILTER: ${statusLabel}  •  ${searchLabel}  •  ${filtered.length} batch`,
        pageWidth - 14,
        21,
        { align: "right" }
      );

      /*
       * SUMMARY
       */
      const cards = [
        {
          label: "TOTAL BATCH",
          value: filtered.length,
        },
        {
          label: "EXPIRED",
          value: filteredExpired,
        },
        {
          label: "WARNING",
          value: filteredWarning,
        },
        {
          label: "AMAN",
          value: filteredAman,
        },
      ];

      const cardGap = 5;
      const cardWidth =
        (pageWidth - 28 - cardGap * 3) / 4;

      const cardY = 33;
      const cardH = 18;

      cards.forEach((card, index) => {
        const x = 14 + index * (cardWidth + cardGap);

        pdf.setDrawColor(226, 232, 240);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(
          x,
          cardY,
          cardWidth,
          cardH,
          2.5,
          2.5,
          "FD"
        );

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text(card.label, x + 5, cardY + 6);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(15, 23, 42);
        pdf.text(
          String(card.value),
          x + 5,
          cardY + 14
        );
      });

      pdf.setTextColor(71, 85, 105);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(
        `Total Qty pada hasil filter: ${filteredQty.toLocaleString(
          "id-ID"
        )}`,
        14,
        58
      );

      autoTable(pdf, {
        startY: 63,
        head: [
          [
            "NO",
            "KODE BARANG",
            "NAMA BARANG",
            "BATCH",
            "QTY",
            "TANGGAL EXPIRED",
            "SISA HARI",
            "STATUS",
          ],
        ],
        body: filtered.map((item, index) => [
          index + 1,
          item.kodeBarang || "-",
          item.namaBarang || "-",
          item.batchNumber || "-",
          Number(item.qty || 0).toLocaleString("id-ID"),
          formatDate(item.expiredDate),
          item.status === "EXPIRED"
            ? `${Math.abs(
                Number(item.sisaHari || 0)
              )} hari lewat`
            : `${Number(item.sisaHari || 0)} hari`,
          item.status,
        ]),
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 7.5,
          cellPadding: 2.5,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          valign: "middle",
        },
        headStyles: {
          fontStyle: "bold",
          fontSize: 7,
          textColor: [255, 255, 255],
          fillColor: [24, 53, 45],
          halign: "center",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: {
            cellWidth: 10,
            halign: "center",
          },
          1: {
            cellWidth: 29,
          },
          2: {
            cellWidth: 63,
          },
          3: {
            cellWidth: 38,
          },
          4: {
            cellWidth: 20,
            halign: "right",
          },
          5: {
            cellWidth: 34,
            halign: "center",
          },
          6: {
            cellWidth: 32,
            halign: "center",
          },
          7: {
            cellWidth: 27,
            halign: "center",
            fontStyle: "bold",
          },
        },
        didParseCell: (hookData) => {
          if (
            hookData.section === "body" &&
            hookData.column.index === 7
          ) {
            const value = String(
              hookData.cell.raw || ""
            );

            if (value === "EXPIRED") {
              hookData.cell.styles.textColor = [
                185,
                28,
                28,
              ];
            } else if (value === "WARNING") {
              hookData.cell.styles.textColor = [
                180,
                83,
                9,
              ];
            } else if (value === "AMAN") {
              hookData.cell.styles.textColor = [
                4,
                120,
                87,
              ];
            }
          }
        },
        didDrawPage: () => {
          const pageNumber =
            pdf.getCurrentPageInfo().pageNumber;

          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7);
          pdf.setTextColor(100, 116, 139);

          pdf.text(
            "MGB ERP • Monitoring Barang Expired",
            14,
            pageHeight - 7
          );

          pdf.text(
            `Page ${pageNumber}`,
            pageWidth - 14,
            pageHeight - 7,
            { align: "right" }
          );
        },
        margin: {
          left: 14,
          right: 14,
          bottom: 12,
        },
      });

      const totalPages = pdf.getNumberOfPages();

      for (
        let page = 1;
        page <= totalPages;
        page++
      ) {
        pdf.setPage(page);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);

        pdf.text(
          "MGB ERP • Monitoring Barang Expired",
          14,
          pageHeight - 7
        );

        pdf.text(
          `Page ${page} / ${totalPages}`,
          pageWidth - 14,
          pageHeight - 7,
          { align: "right" }
        );
      }

      const safeSearch = search
        .trim()
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);

      const filename =
        [
          "Monitoring-Barang-Expired",
          status !== "SEMUA" ? status : "SEMUA",
          safeSearch || null,
          now.toISOString().slice(0, 10),
        ]
          .filter(Boolean)
          .join("-") + ".pdf";

      pdf.save(filename);
    } catch (error) {
      console.error(
        "Gagal export PDF expired:",
        error
      );

      alert(
        "Gagal membuat PDF. Pastikan package jspdf dan jspdf-autotable tersedia."
      );
    }
  }

  function openEdit(item: ExpiredItem) {
    setEditData({
      id: item.id,
      batchNumber: item.batchNumber ?? "",
      qty: String(item.qty ?? ""),
      expiredDate: item.expiredDate
        ? new Date(item.expiredDate)
            .toISOString()
            .split("T")[0]
        : "",
    });

    setEditOpen(true);
  }

  async function handleUpdate() {
    if (!editData.id) return;

    if (
      editData.qty === "" ||
      Number(editData.qty) < 0
    ) {
      alert("Qty tidak valid.");
      return;
    }

    if (!editData.expiredDate) {
      alert("Tanggal expired wajib diisi.");
      return;
    }

    try {
      setEditLoading(true);

      const res = await fetch(
        `/api/barang-batch/${editData.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            batchNumber: editData.batchNumber,
            qty: Number(editData.qty),
            expiredDate: editData.expiredDate,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengubah data batch."
        );
      }

      setEditOpen(false);
      await load();

      alert("Data batch berhasil diperbarui.");
    } catch (error: any) {
      console.error(
        "Gagal update batch:",
        error
      );

      alert(
        error?.message ||
          "Terjadi kesalahan saat mengubah data."
      );
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(item: ExpiredItem) {
    const yakin = window.confirm(
      `Hapus batch "${
        item.batchNumber || "-"
      }" dari barang "${item.namaBarang}"?\n\nData yang dihapus tidak dapat dikembalikan.`
    );

    if (!yakin) return;

    try {
      setDeleteLoading(item.id);

      const res = await fetch(
        `/api/barang-batch/${item.id}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal menghapus batch."
        );
      }

      await load();

      alert("Batch berhasil dihapus.");
    } catch (error: any) {
      console.error(
        "Gagal menghapus batch:",
        error
      );

      alert(
        error?.message ||
          "Terjadi kesalahan saat menghapus data."
      );
    } finally {
      setDeleteLoading(null);
    }
  }

  const hasFilter =
    search.trim() !== "" || status !== "SEMUA";

  return (
    <div className="min-h-screen bg-[#f5f7f8]">
      {/* =====================================================
          BACKGROUND DECORATION
      ====================================================== */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-emerald-100/40 blur-3xl" />
        <div className="absolute -left-32 top-[45%] h-96 w-96 rounded-full bg-slate-200/40 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        {/* =====================================================
            PREMIUM HEADER
        ====================================================== */}
        <section className="relative mb-6 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_12px_45px_-20px_rgba(15,23,42,0.22)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_20%,rgba(73,127,112,0.12),transparent_30%)]" />

          <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 blur-xl" />

                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#497F70] to-[#18352D] text-white shadow-lg shadow-emerald-900/20">
                  <Package className="h-7 w-7" />
                </div>
              </div>

              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                    <ShieldCheck className="h-3 w-3" />
                    Inventory Control
                  </span>

                  <span className="hidden text-slate-300 sm:inline">
                    /
                  </span>

                  <span className="text-[11px] font-medium text-slate-400">
                    Batch Monitoring
                  </span>
                </div>

                <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  Monitoring Barang Expired
                </h1>

                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
                  Pantau masa berlaku seluruh batch,
                  identifikasi risiko expired, dan
                  kelola data batch dari satu dashboard.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 transition-transform ${
                    loading
                      ? "animate-spin"
                      : "group-hover:rotate-90"
                  }`}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={exportPDF}
                disabled={
                  loading || filtered.length === 0
                }
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#18352D] px-4 text-sm font-bold text-white shadow-lg shadow-[#18352D]/15 transition-all hover:-translate-y-0.5 hover:bg-[#21483e] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <FileDown className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
                Export PDF
              </button>
            </div>
          </div>
        </section>

        {/* =====================================================
            KPI CARDS
        ====================================================== */}
        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {/* TOTAL */}
          <div className="group relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-xl">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-slate-100 opacity-70 transition-transform duration-500 group-hover:scale-125" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Total Batch
                </p>

                <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                  {summary.total}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {formatNumber(summary.totalQty)} total
                  qty
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-transform group-hover:scale-105">
                <Package className="h-5 w-5" />
              </div>
            </div>

            <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-full rounded-full bg-slate-300" />
            </div>
          </div>

          {/* EXPIRED */}
          <div className="group relative overflow-hidden rounded-[22px] border border-red-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(127,29,29,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-xl">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-red-50 transition-transform duration-500 group-hover:scale-125" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Expired
                </p>

                <p className="mt-2 text-3xl font-black tracking-tight text-red-600">
                  {summary.expired}
                </p>

                <p className="mt-1 text-xs text-red-500/70">
                  Perlu tindakan
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600 transition-transform group-hover:scale-105">
                <XCircle className="h-5 w-5" />
              </div>
            </div>

            <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-red-50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-500 transition-all"
                style={{
                  width:
                    summary.total > 0
                      ? `${Math.max(
                          4,
                          (summary.expired /
                            summary.total) *
                            100
                        )}%`
                      : "0%",
                }}
              />
            </div>
          </div>

          {/* WARNING */}
          <div className="group relative overflow-hidden rounded-[22px] border border-amber-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(146,64,14,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-xl">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-50 transition-transform duration-500 group-hover:scale-125" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Warning
                </p>

                <p className="mt-2 text-3xl font-black tracking-tight text-amber-600">
                  {summary.warning}
                </p>

                <p className="mt-1 text-xs text-amber-500/70">
                  Mendekati expired
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 transition-transform group-hover:scale-105">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>

            <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-amber-50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                style={{
                  width:
                    summary.total > 0
                      ? `${Math.max(
                          4,
                          (summary.warning /
                            summary.total) *
                            100
                        )}%`
                      : "0%",
                }}
              />
            </div>
          </div>

          {/* AMAN */}
          <div className="group relative overflow-hidden rounded-[22px] border border-emerald-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(6,78,59,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-xl">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-50 transition-transform duration-500 group-hover:scale-125" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Aman
                </p>

                <p className="mt-2 text-3xl font-black tracking-tight text-emerald-600">
                  {summary.aman}
                </p>

                <p className="mt-1 text-xs text-emerald-500/70">
                  Dalam masa berlaku
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition-transform group-hover:scale-105">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>

            <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-emerald-50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-600 transition-all"
                style={{
                  width:
                    summary.total > 0
                      ? `${Math.max(
                          4,
                          (summary.aman /
                            summary.total) *
                            100
                        )}%`
                      : "0%",
                }}
              />
            </div>
          </div>
        </section>

        {/* =====================================================
            FILTER / CONTROL BAR
        ====================================================== */}
        <section className="mb-5 rounded-[22px] border border-slate-200/80 bg-white p-3 shadow-[0_8px_30px_-20px_rgba(15,23,42,0.3)] sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                placeholder="Cari kode barang, nama barang, atau nomor batch..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-11 pr-11 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Hapus pencarian"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="relative w-full xl:w-[220px]">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target.value as StatusFilter
                  )
                }
                className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-4 pr-10 text-sm font-semibold text-slate-700 outline-none transition-all hover:border-slate-300 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
              >
                <option value="SEMUA">
                  Semua Status
                </option>
                <option value="EXPIRED">
                  Expired
                </option>
                <option value="WARNING">
                  Warning
                </option>
                <option value="AMAN">
                  Aman
                </option>
              </select>

              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            {hasFilter && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("SEMUA");
                }}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
                Reset
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-400">
              <span className="font-medium">
                Menampilkan
              </span>

              <span className="font-black text-slate-700">
                {filtered.length}
              </span>

              <span>dari</span>

              <span className="font-black text-slate-700">
                {data.length}
              </span>

              <span>batch</span>

              {hasFilter && (
                <>
                  <span className="text-slate-300">
                    •
                  </span>

                  <span className="font-semibold text-[#497F70]">
                    Filter aktif
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 text-slate-400">
              <Package className="h-3.5 w-3.5" />
              <span>
                Qty hasil:{" "}
                <strong className="text-slate-700">
                  {formatNumber(
                    summary.filteredQty
                  )}
                </strong>
              </span>
            </div>
          </div>
        </section>

        {/* =====================================================
            DATA TABLE
        ====================================================== */}
        <section className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_10px_40px_-22px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-sm font-black text-slate-900">
                Daftar Batch
              </h2>

              <p className="mt-0.5 text-xs text-slate-400">
                Detail masa berlaku dan status inventory
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <CalendarDays className="h-4 w-4" />
              Data batch
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="w-[180px] px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    Barang
                  </th>

                  <th className="w-[180px] px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    Batch
                  </th>

                  <th className="w-[110px] px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    Qty
                  </th>

                  <th className="w-[170px] px-5 py-4 text-center text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    Tanggal Expired
                  </th>

                  <th className="w-[170px] px-5 py-4 text-center text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    Sisa Masa Berlaku
                  </th>

                  <th className="w-[150px] px-5 py-4 text-center text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    Status
                  </th>

                  <th className="w-[190px] px-5 py-4 text-center text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <>
                    {[1, 2, 3, 4, 5].map(
                      (row) => (
                        <tr key={row}>
                          <td
                            colSpan={7}
                            className="px-5 py-4"
                          >
                            <div className="flex animate-pulse items-center gap-4">
                              <div className="h-10 w-10 rounded-xl bg-slate-100" />

                              <div className="flex-1 space-y-2">
                                <div className="h-3 w-36 rounded-full bg-slate-100" />
                                <div className="h-2.5 w-24 rounded-full bg-slate-50" />
                              </div>

                              <div className="hidden h-3 w-28 rounded-full bg-slate-100 sm:block" />
                              <div className="hidden h-8 w-20 rounded-lg bg-slate-100 md:block" />
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-20 text-center"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-slate-100">
                          <Package className="h-7 w-7 text-slate-300" />
                        </div>

                        <h3 className="text-base font-black text-slate-700">
                          Tidak ada data
                        </h3>

                        <p className="mt-1.5 text-sm leading-6 text-slate-400">
                          Tidak ditemukan batch yang
                          sesuai dengan filter saat ini.
                        </p>

                        {hasFilter && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearch("");
                              setStatus("SEMUA");
                            }}
                            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#18352D] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#21483e]"
                          >
                            <X className="h-3.5 w-3.5" />
                            Reset Filter
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const expiryTone =
                      getExpiryTone(
                        item.status
                      );

                    return (
                      <tr
                        key={item.id}
                        className="group transition-colors hover:bg-slate-50/70"
                      >
                        {/* BARANG */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-[#497F70]/10 group-hover:text-[#497F70]">
                              <Package className="h-4.5 w-4.5" />
                            </div>

                            <div className="min-w-0">
                              <p
                                className="truncate text-sm font-bold text-slate-800"
                                title={
                                  item.namaBarang
                                }
                              >
                                {item.namaBarang}
                              </p>

                              <p className="mt-0.5 font-mono text-[11px] font-semibold text-slate-400">
                                {item.kodeBarang ||
                                  "-"}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* BATCH */}
                        <td className="px-5 py-4">
                          <div className="inline-flex max-w-[170px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <span
                              className="truncate font-mono text-xs font-bold text-slate-600"
                              title={
                                item.batchNumber ||
                                "-"
                              }
                            >
                              {item.batchNumber ||
                                "-"}
                            </span>
                          </div>
                        </td>

                        {/* QTY */}
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex flex-col items-end">
                            <span className="text-sm font-black tabular-nums text-slate-800">
                              {formatNumber(
                                item.qty
                              )}
                            </span>

                            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Quantity
                            </span>
                          </div>
                        </td>

                        {/* EXPIRED DATE */}
                        <td className="px-5 py-4 text-center">
                          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />

                            <span className="text-xs font-bold text-slate-700">
                              {formatDate(
                                item.expiredDate
                              )}
                            </span>
                          </div>
                        </td>

                        {/* SISA */}
                        <td className="px-5 py-4 text-center">
                          <div
                            className={`inline-flex min-w-[125px] items-center justify-center gap-2 rounded-xl border px-3 py-2 ${expiryTone.bg} ${expiryTone.border}`}
                          >
                            <Clock3
                              className={`h-3.5 w-3.5 ${expiryTone.text}`}
                            />

                            <div className="text-left">
                              <p
                                className={`text-xs font-black ${expiryTone.text}`}
                              >
                                {getExpiryText(
                                  item
                                )}
                              </p>

                              <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                                masa berlaku
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* STATUS */}
                        <td className="px-5 py-4 text-center">
                          {renderStatus(
                            item.status
                          )}
                        </td>

                        {/* AKSI */}
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openEdit(item)
                              }
                              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition-all hover:border-blue-200 hover:bg-blue-100 hover:shadow-sm"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(item)
                              }
                              disabled={
                                deleteLoading ===
                                item.id
                              }
                              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 text-xs font-bold text-red-700 transition-all hover:border-red-200 hover:bg-red-100 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deleteLoading ===
                              item.id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}

                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <span>
                Menampilkan{" "}
                <strong className="text-slate-600">
                  {filtered.length}
                </strong>{" "}
                batch
              </span>

              <span>
                Total qty{" "}
                <strong className="text-slate-600">
                  {formatNumber(
                    summary.filteredQty
                  )}
                </strong>
              </span>
            </div>
          )}
        </section>
      </main>

      {/* =====================================================
          EDIT MODAL
      ====================================================== */}
      {editOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-md"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !editLoading
            ) {
              setEditOpen(false);
            }
          }}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_30px_100px_-25px_rgba(15,23,42,0.5)]">
            {/* MODAL HEADER */}
            <div className="relative overflow-hidden border-b border-slate-100 px-6 py-6 sm:px-7">
              <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-50 blur-2xl" />

              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#18352D] text-white shadow-lg shadow-[#18352D]/15">
                    <Pencil className="h-5 w-5" />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-600">
                        Batch Management
                      </span>
                    </div>

                    <h2 className="text-xl font-black tracking-tight text-slate-900">
                      Edit Batch Barang
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Perbarui informasi batch,
                      quantity, dan tanggal expired.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEditOpen(false)
                  }
                  disabled={editLoading}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  aria-label="Tutup"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* MODAL BODY */}
            <div className="space-y-5 px-6 py-6 sm:px-7">
              {/* BATCH */}
              <div>
                <label className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.08em] text-slate-600">
                  <span>Nomor Batch</span>
                  <span className="font-medium normal-case tracking-normal text-slate-400">
                    Identitas batch
                  </span>
                </label>

                <input
                  type="text"
                  value={
                    editData.batchNumber
                  }
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      batchNumber:
                        e.target.value,
                    }))
                  }
                  disabled={editLoading}
                  placeholder="Contoh: BATCH-2026-001"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm font-semibold text-slate-800 outline-none transition-all placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* QTY */}
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.08em] text-slate-600">
                    Quantity
                  </label>

                  <div className="relative">
                    <Package className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editData.qty}
                      onChange={(e) =>
                        setEditData(
                          (prev) => ({
                            ...prev,
                            qty: e.target.value,
                          })
                        )
                      }
                      disabled={editLoading}
                      placeholder="0"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm font-bold tabular-nums text-slate-800 outline-none transition-all placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* DATE */}
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.08em] text-slate-600">
                    Tanggal Expired
                  </label>

                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="date"
                      value={
                        editData.expiredDate
                      }
                      onChange={(e) =>
                        setEditData(
                          (prev) => ({
                            ...prev,
                            expiredDate:
                              e.target.value,
                          })
                        )
                      }
                      disabled={editLoading}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all hover:border-slate-300 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* PREVIEW */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#497F70]" />

                  <span className="text-xs font-black text-slate-700">
                    Preview Data
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Batch
                    </p>

                    <p className="mt-1 truncate font-mono text-xs font-bold text-slate-700">
                      {editData.batchNumber ||
                        "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Qty
                    </p>

                    <p className="mt-1 text-xs font-black tabular-nums text-slate-700">
                      {formatNumber(
                        Number(
                          editData.qty || 0
                        )
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Expired
                    </p>

                    <p className="mt-1 text-xs font-bold text-slate-700">
                      {editData.expiredDate
                        ? formatLongDate(
                            editData.expiredDate
                          )
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button
                type="button"
                onClick={() =>
                  setEditOpen(false)
                }
                disabled={editLoading}
                className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleUpdate}
                disabled={editLoading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#18352D] px-6 text-sm font-bold text-white shadow-lg shadow-[#18352D]/15 transition hover:bg-[#21483e] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editLoading && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}

                {editLoading
                  ? "Menyimpan..."
                  : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}