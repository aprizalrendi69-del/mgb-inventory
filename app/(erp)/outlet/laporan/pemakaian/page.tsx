"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Layers3,
  MessageCircle,
  Package,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Minus,
  Wallet,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ============================================================
// TYPES
// ============================================================

type OutletOption = {
  id: number;
  code: string;
  name: string;
  active?: boolean;
};

type UsageRow = {
  barangId: number;
  code: string;
  name: string;
  category: string | null;
  unit: string;
  openingStock: number | null;
  purchaseIncoming: number;
  transferIncoming: number;
  deliveryIncoming: number;
  adjustmentIncoming: number;
  incomingQty: number;
  endingStock: number | null;
  endingSource: string;
  wasteQty: number;
  otherOutQty: number;
  grossStockOut: number | null;
  usageQty: number | null;
  discrepancyQty: number;
  unitCost: number;
  usageCost: number | null;
  canCalculate: boolean;
};

type Report = {
  success: boolean;
  message?: string;
  requiresOutletSelection?: boolean;
  outlets?: OutletOption[];
  outlet?: OutletOption;
  period?: { year: number; month: number };
  opname?: {
    opening: {
      id: number;
      code: string;
      date: string;
      status: string;
    } | null;
    ending: {
      id: number;
      code: string;
      date: string;
      status: string;
    } | null;
    isProvisional: boolean;
  };
  summary?: {
    itemCount: number;
    calculatedItemCount: number;
    pendingItemCount: number;
    incomingQty: number;
    wasteQty: number;
    usageQty: number;
    usageCost: number;
  };
  rows?: UsageRow[];
};

type CategorySummary = {
  category: string;
  itemCount: number;
  calculatedCount: number;
  usageCost: number;
  pendingCount: number;
};

type CategoryComparison = {
  category: string;
  currentCost: number;
  previousCost: number;
  currentCount: number;
  previousCount: number;
  currentCalculated: number;
  previousCalculated: number;
  currentPending: number;
  previousPending: number;
  difference: number;
  percentage: number | null;
};

const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

// ============================================================
// HELPERS
// ============================================================

const fmtQty = (value: number | null | undefined) => {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toLocaleString("id-ID", {
    maximumFractionDigits: 3,
  });
};

const fmtMoney = (value: number | null | undefined) => {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value));
};

const fmtDate = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

function getPreviousPeriod(year: number, month: number) {
  const date = new Date(year, month - 2, 1);

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

function getCategoryName(category: string | null | undefined) {
  return String(category ?? "").trim() || "Tanpa Kategori";
}

function summarizeCategories(rows: UsageRow[]): CategorySummary[] {
  const groups = new Map<string, CategorySummary>();

  for (const row of rows) {
    const category = getCategoryName(row.category);

    let item = groups.get(category);

    if (!item) {
      item = {
        category,
        itemCount: 0,
        calculatedCount: 0,
        usageCost: 0,
        pendingCount: 0,
      };

      groups.set(category, item);
    }

    item.itemCount += 1;

    if (row.canCalculate && row.usageCost !== null) {
      item.calculatedCount += 1;
      item.usageCost += Number(row.usageCost || 0);
    } else {
      item.pendingCount += 1;
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) => b.usageCost - a.usageCost,
  );
}

function calculateChange(current: number, previous: number) {
  const difference = current - previous;

  const percentage =
    previous === 0
      ? current === 0
        ? 0
        : null
      : (difference / Math.abs(previous)) * 100;

  return { difference, percentage };
}

function sumCalculatedCost(rows: UsageRow[]) {
  return rows.reduce((total, row) => {
    if (!row.canCalculate || row.usageCost === null) {
      return total;
    }

    return total + Number(row.usageCost || 0);
  }, 0);
}

function getCompleteness(rows: UsageRow[]) {
  const calculated = rows.filter(
    (row) => row.canCalculate && row.usageCost !== null,
  ).length;

  return {
    calculated,
    pending: Math.max(0, rows.length - calculated),
    percentage:
      rows.length === 0
        ? 0
        : Math.round((calculated / rows.length) * 100),
  };
}

async function requestReport(
  year: number,
  month: number,
  outletId: string,
): Promise<Report> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });

  if (outletId) params.set("outletId", outletId);

  const response = await fetch(
    `/api/outlet/laporan/pemakaian?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" },
    },
  );

  let data: Report;

  try {
    data = (await response.json()) as Report;
  } catch {
    throw new Error(
      `Respons server tidak valid (HTTP ${response.status}).`,
    );
  }

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Gagal memuat laporan.");
  }

  return data;
}

function formatPercent(value: number | null) {
  if (value === null) return "Basis pembanding 0";
  if (!Number.isFinite(value)) return "—";

  return `${value > 0 ? "+" : ""}${value.toLocaleString("id-ID", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })}%`;
}

function periodLabel(year: number, month: number) {
  return `${monthNames[month - 1]} ${year}`;
}

function safeFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============================================================
// PAGE
// ============================================================

export default function LaporanPemakaianOutletPage() {
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [outletId, setOutletId] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [report, setReport] = useState<Report | null>(null);
  const [previousReport, setPreviousReport] = useState<Report | null>(null);

  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState("");
  const [previousError, setPreviousError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const previousPeriod = useMemo(
    () => getPreviousPeriod(year, month),
    [year, month],
  );

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    setPreviousError("");
    setCopyMessage("");

    try {
      const current = await requestReport(year, month, outletId);

      setReport(current);

      if (
        !outletId &&
        current.outlets?.length === 1 &&
        !current.requiresOutletSelection
      ) {
        setOutletId(String(current.outlets[0].id));
      }

      if (current.requiresOutletSelection || !outletId) {
        setPreviousReport(null);
        return;
      }

      try {
        const previous = await requestReport(
          previousPeriod.year,
          previousPeriod.month,
          outletId,
        );

        setPreviousReport(previous);
      } catch (err) {
        setPreviousReport(null);
        setPreviousError(
          err instanceof Error
            ? err.message
            : "Gagal memuat periode pembanding.",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memuat laporan.",
      );
      setReport(null);
      setPreviousReport(null);
    } finally {
      setLoading(false);
    }
  }, [year, month, outletId, previousPeriod]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const allRows = report?.rows ?? [];

  const categories = useMemo(
    () =>
      Array.from(
        new Set(allRows.map((row) => getCategoryName(row.category))),
      ).sort((a, b) => a.localeCompare(b, "id")),
    [allRows],
  );

  const rows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("id-ID");

    return allRows.filter((row) => {
      const matchesSearch =
        !keyword ||
        [row.code, row.name, row.category ?? ""].some((value) =>
          value.toLocaleLowerCase("id-ID").includes(keyword),
        );

      const matchesCategory =
        categoryFilter === "ALL" ||
        getCategoryName(row.category) === categoryFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "CALCULATED" &&
          row.canCalculate &&
          row.usageCost !== null) ||
        (statusFilter === "PENDING" &&
          (!row.canCalculate || row.usageCost === null)) ||
        (statusFilter === "DISCREPANCY" && row.discrepancyQty < 0);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [allRows, search, categoryFilter, statusFilter]);

  const currentCategories = useMemo(
    () => summarizeCategories(allRows),
    [allRows],
  );

  const previousCategories = useMemo(
    () => summarizeCategories(previousReport?.rows ?? []),
    [previousReport],
  );

  const comparison = useMemo((): CategoryComparison[] => {
    const previousMap = new Map(
      previousCategories.map((item) => [item.category, item]),
    );
    const currentMap = new Map(
      currentCategories.map((item) => [item.category, item]),
    );

    const names = Array.from(
      new Set([
        ...currentCategories.map((item) => item.category),
        ...previousCategories.map((item) => item.category),
      ]),
    ).sort((a, b) => a.localeCompare(b, "id"));

    return names.map((category) => {
      const current = currentMap.get(category);
      const previous = previousMap.get(category);
      const currentCost = current?.usageCost ?? 0;
      const previousCost = previous?.usageCost ?? 0;

      return {
        category,
        currentCost,
        previousCost,
        currentCount: current?.itemCount ?? 0,
        previousCount: previous?.itemCount ?? 0,
        currentCalculated: current?.calculatedCount ?? 0,
        previousCalculated: previous?.calculatedCount ?? 0,
        currentPending: current?.pendingCount ?? 0,
        previousPending: previous?.pendingCount ?? 0,
        ...calculateChange(currentCost, previousCost),
      };
    });
  }, [currentCategories, previousCategories]);

  const currentTotalCost = useMemo(
    () => sumCalculatedCost(allRows),
    [allRows],
  );

  const previousTotalCost = useMemo(
    () => sumCalculatedCost(previousReport?.rows ?? []),
    [previousReport],
  );

  const currentCompleteness = useMemo(
    () => getCompleteness(allRows),
    [allRows],
  );

  const previousCompleteness = useMemo(
    () => getCompleteness(previousReport?.rows ?? []),
    [previousReport],
  );

  const totalChange = calculateChange(currentTotalCost, previousTotalCost);
  const comparisonAvailable = Boolean(report && previousReport);
  const selectedOutlet = report?.outlet;

  const discrepancyCount = allRows.filter(
    (row) => row.discrepancyQty < 0,
  ).length;

  // ==========================================================
  // CSV EXPORT
  // ==========================================================

  const exportCsv = () => {
    if (!rows.length) return;

    const header = [
      "Kode Barang",
      "Nama Barang",
      "Kategori",
      "Satuan",
      "Stok Awal",
      "Barang Masuk PO",
      "Transfer Masuk",
      "Delivery Pusat",
      "Penyesuaian Masuk",
      "Total Masuk",
      "Stok Akhir",
      "Waste/Rusak",
      "Keluar Non-Pemakaian",
      "Estimasi Pemakaian Bersih",
      "Biaya per Satuan",
      "Estimasi Biaya Pemakaian",
      "Status Perhitungan",
      "Selisih Tidak Wajar",
    ];

    const escape = (value: unknown) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const lines = rows.map((row) =>
      [
        row.code,
        row.name,
        row.category ?? "",
        row.unit,
        row.openingStock ?? "",
        row.purchaseIncoming,
        row.transferIncoming,
        row.deliveryIncoming,
        row.adjustmentIncoming,
        row.incomingQty,
        row.endingStock ?? "",
        row.wasteQty,
        row.otherOutQty,
        row.usageQty ?? "",
        row.unitCost,
        row.usageCost ?? "",
        row.canCalculate ? "TERHITUNG" : "BELUM LENGKAP",
        row.discrepancyQty < 0 ? row.discrepancyQty : "",
      ]
        .map(escape)
        .join(","),
    );

    const csv =
      "\uFEFF" + [header.map(escape).join(","), ...lines].join("\r\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
      `laporan-pemakaian-${outletId || "outlet"}-` +
      `${year}-${String(month).padStart(2, "0")}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // ==========================================================
  // WHATSAPP REPORT
  // ==========================================================

  const whatsappMessage = useMemo(() => {
    const outletName = selectedOutlet
      ? `${selectedOutlet.code} — ${selectedOutlet.name}`
      : "Outlet";

    const lines: string[] = [
      "🌿 *MGB ERP | LAPORAN ANALISIS BIAYA BAHAN*",
      "━━━━━━━━━━━━━━━━━━━━",
      `🏬 *Outlet:* ${outletName}`,
      `📅 *Periode:* ${periodLabel(year, month)}`,
      `🔎 *Pembanding:* ${periodLabel(previousPeriod.year, previousPeriod.month)}`,
      "",
      "💰 *RINGKASAN BIAYA*",
      `• Periode terpilih: *${fmtMoney(currentTotalCost)}*`,
      `• Periode sebelumnya: *${previousReport ? fmtMoney(previousTotalCost) : "Belum tersedia"}*`,
      `• Selisih: *${comparisonAvailable ? `${totalChange.difference > 0 ? "+" : ""}${fmtMoney(totalChange.difference)}` : "Belum dapat dihitung"}*`,
      `• Perubahan biaya: *${comparisonAvailable ? formatPercent(totalChange.percentage) : "Belum tersedia"}*`,
      "",
      "📊 *ANALISIS PER KATEGORI*",
    ];

    if (!comparisonAvailable) {
      lines.push(
        "Data periode pembanding belum tersedia. Persentase perubahan belum dapat disimpulkan.",
      );
    }

    if (comparisonAvailable && comparison.length === 0) {
      lines.push("Belum ada kategori untuk dibandingkan.");
    }

    for (const item of comparison) {
      lines.push(
        "",
        `▪️ *${item.category}*`,
        `   • ${periodLabel(previousPeriod.year, previousPeriod.month)}: ${fmtMoney(item.previousCost)}`,
        `   • ${periodLabel(year, month)}: ${fmtMoney(item.currentCost)}`,
        `   • Selisih: ${comparisonAvailable ? `${item.difference > 0 ? "+" : ""}${fmtMoney(item.difference)}` : "—"}`,
        `   • Perubahan: ${comparisonAvailable ? formatPercent(item.percentage) : "—"}`,
        `   • Barang terhitung: ${item.currentCalculated}/${item.currentCount}`,
        ...(item.currentPending > 0
          ? [`   ⚠️ Belum lengkap: ${item.currentPending} barang`]
          : []),
      );
    }

    lines.push(
      "",
      "🧾 *KELENGKAPAN DATA*",
      `• Terhitung: ${currentCompleteness.calculated}/${allRows.length} barang (${currentCompleteness.percentage}%)`,
      `• Belum lengkap: ${currentCompleteness.pending} barang`,
      `• Selisih stok tidak wajar: ${discrepancyCount} barang`,
      `• Stok akhir: ${report?.opname?.isProvisional ? "Sementara, memakai saldo sistem" : report?.opname?.ending ? "Stock Opname disetujui" : "Belum tersedia"}`,
      "",
      "ℹ️ *Catatan:* Biaya adalah estimasi rekonsiliasi stok berdasarkan data yang terhitung, bukan konsumsi POS/BOM aktual. Kenaikan biaya tidak otomatis berarti pemborosan. Periksa kuantitas, harga bahan, waste, dan kelengkapan stok.",
      "",
      "_Dibuat melalui MGB ERP — Inventory Control_",
    );

    return lines.join("\n");
  }, [
    selectedOutlet,
    year,
    month,
    previousPeriod,
    currentTotalCost,
    previousTotalCost,
    comparisonAvailable,
    totalChange,
    previousReport,
    comparison,
    currentCompleteness,
    allRows.length,
    discrepancyCount,
    report?.opname,
  ]);

  const copyWhatsAppMessage = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopyMessage("Pesan WhatsApp berhasil disalin.");
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = whatsappMessage;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();

      const copied = document.execCommand("copy");
      textArea.remove();

      setCopyMessage(
        copied
          ? "Pesan WhatsApp berhasil disalin."
          : "Gagal menyalin otomatis. Silakan salin pesan secara manual.",
      );
    }
  };

  const openWhatsApp = () => {
    const url = `https://web.whatsapp.com/send?text=${encodeURIComponent(
      whatsappMessage,
    )}`;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  // ==========================================================
  // PDF EXPORT
  // ==========================================================

  const exportPdf = async () => {
    if (!report || !allRows.length || exportingPdf) return;

    setExportingPdf(true);
    setError("");

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const outletName = selectedOutlet
        ? `${selectedOutlet.code} - ${selectedOutlet.name}`
        : "Outlet";

      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(24, 53, 45);
      doc.rect(0, 0, pageWidth, 31, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("MGB ERP", 14, 12);

      doc.setFontSize(13);
      doc.text("LAPORAN PEMAKAIAN BAHAN OUTLET", 14, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        `${outletName} | Periode ${periodLabel(year, month)}`,
        14,
        26,
      );

      doc.setTextColor(35, 45, 40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("RINGKASAN BIAYA", 14, 40);

      autoTable(doc, {
        startY: 43,
        head: [["Keterangan", "Nilai"]],
        body: [
          ["Biaya periode terpilih", fmtMoney(currentTotalCost)],
          [
            `Biaya ${periodLabel(previousPeriod.year, previousPeriod.month)}`,
            previousReport ? fmtMoney(previousTotalCost) : "Belum tersedia",
          ],
          [
            "Selisih biaya",
            comparisonAvailable
              ? `${totalChange.difference > 0 ? "+" : ""}${fmtMoney(totalChange.difference)}`
              : "Belum tersedia",
          ],
          [
            "Perubahan biaya",
            comparisonAvailable
              ? formatPercent(totalChange.percentage)
              : "Belum tersedia",
          ],
          [
            "Kelengkapan data",
            `${currentCompleteness.calculated}/${allRows.length} barang (${currentCompleteness.percentage}%)`,
          ],
          ["Belum lengkap", `${currentCompleteness.pending} barang`],
          ["Selisih stok tidak wajar", `${discrepancyCount} barang`],
        ],
        theme: "grid",
        headStyles: {
          fillColor: [24, 53, 45],
          textColor: 255,
          fontStyle: "bold",
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          overflow: "linebreak",
        },
        margin: { left: 14, right: 14 },
      });

      let nextY =
        ((doc as unknown as { lastAutoTable?: { finalY: number } })
          .lastAutoTable?.finalY ?? 80) + 8;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("ANALISIS BIAYA PER KATEGORI", 14, nextY);

      autoTable(doc, {
        startY: nextY + 3,
        head: [[
          "Kategori",
          periodLabel(previousPeriod.year, previousPeriod.month),
          periodLabel(year, month),
          "Selisih",
          "Perubahan",
          "Barang Terhitung",
          "Belum Lengkap",
        ]],
        body: comparison.map((item) => [
          item.category,
          previousReport ? fmtMoney(item.previousCost) : "—",
          fmtMoney(item.currentCost),
          comparisonAvailable
            ? `${item.difference > 0 ? "+" : ""}${fmtMoney(item.difference)}`
            : "—",
          comparisonAvailable ? formatPercent(item.percentage) : "—",
          `${item.currentCalculated}/${item.currentCount}`,
          String(item.currentPending),
        ]),
        theme: "grid",
        headStyles: {
          fillColor: [40, 106, 85],
          textColor: 255,
          fontStyle: "bold",
        },
        styles: {
          fontSize: 7,
          cellPadding: 2,
          overflow: "linebreak",
        },
        columnStyles: {
          0: { cellWidth: 47 },
          1: { halign: "right" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "center" },
          6: { halign: "center" },
        },
        margin: { left: 14, right: 14 },
      });

      const categoryEndY =
        (doc as unknown as { lastAutoTable?: { finalY: number } })
          .lastAutoTable?.finalY ?? 100;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("RINCIAN PEMAKAIAN PER BARANG", 14, categoryEndY + 9);

      autoTable(doc, {
        startY: categoryEndY + 12,
        head: [[
          "Kode",
          "Nama Barang",
          "Kategori",
          "Unit",
          "Stok Awal",
          "Masuk PO",
          "Transfer",
          "Delivery",
          "Penyesuaian +",
          "Total Masuk",
          "Stok Akhir",
          "Waste/Rusak",
          "Keluar Lain",
          "Pemakaian",
          "Biaya/Unit",
          "Estimasi Biaya",
          "Status",
        ]],
        body: allRows.map((row) => [
          row.code,
          row.name,
          getCategoryName(row.category),
          row.unit,
          fmtQty(row.openingStock),
          fmtQty(row.purchaseIncoming),
          fmtQty(row.transferIncoming),
          fmtQty(row.deliveryIncoming),
          fmtQty(row.adjustmentIncoming),
          fmtQty(row.incomingQty),
          fmtQty(row.endingStock),
          fmtQty(row.wasteQty),
          fmtQty(row.otherOutQty),
          fmtQty(row.usageQty),
          fmtMoney(row.unitCost),
          fmtMoney(row.usageCost),
          row.canCalculate && row.usageCost !== null
            ? "Terhitung"
            : "Belum lengkap",
        ]),
        theme: "striped",
        headStyles: {
          fillColor: [24, 53, 45],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [244, 248, 246],
        },
        styles: {
          fontSize: 6,
          cellPadding: 1.5,
          overflow: "linebreak",
        },
        margin: { left: 8, right: 8, top: 12, bottom: 15 },
        horizontalPageBreak: true,
        horizontalPageBreakRepeat: [0, 1],
        didDrawPage: () => {
          const pageHeight = doc.internal.pageSize.getHeight();
          const pageCount = doc.getNumberOfPages();
          const currentPage = doc.getCurrentPageInfo().pageNumber;

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(100, 110, 105);
          doc.text(
            "MGB ERP | Estimasi rekonsiliasi stok — bukan konsumsi POS/BOM aktual",
            8,
            pageHeight - 6,
          );
          doc.text(
            `Halaman ${currentPage} dari ${pageCount}`,
            pageWidth - 8,
            pageHeight - 6,
            { align: "right" },
          );
        },
      });

      const filename =
        `laporan-pemakaian-${safeFilePart(
          selectedOutlet?.code || "outlet",
        )}-${year}-${String(month).padStart(2, "0")}.pdf`;

      doc.save(filename);
    } catch (err) {
      setError(
        err instanceof Error
          ? `PDF gagal dibuat: ${err.message}`
          : "PDF gagal dibuat. Periksa instalasi jspdf dan jspdf-autotable.",
      );
    } finally {
      setExportingPdf(false);
    }
  };

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <main className="min-h-screen bg-[#F3F6F5] p-3 text-slate-800 transition-colors dark:bg-[#101714] dark:text-slate-100 sm:p-5 xl:p-7">
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }

          html,
          body {
            background: #fff !important;
            color: #111827 !important;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .no-print {
            display: none !important;
          }

          .print-area {
            max-width: none !important;
            padding: 0 !important;
          }

          .print-card {
            box-shadow: none !important;
            break-inside: avoid;
            border-color: #d1d5db !important;
            background: #fff !important;
            color: #111827 !important;
          }

          .print-table {
            min-width: 0 !important;
            width: 100% !important;
            font-size: 7px !important;
          }

          th,
          td {
            padding: 4px !important;
            color: #111827 !important;
          }

          button,
          input,
          select {
            display: none !important;
          }

          .overflow-x-auto {
            overflow: visible !important;
          }
        }
      `}</style>

      <div className="print-area mx-auto max-w-[1680px] space-y-5">
        {/* HEADER */}
        <header className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-[#142E27] via-[#21483B] to-[#497F70] p-5 text-white shadow-[0_18px_50px_-25px_rgba(24,53,45,0.7)] sm:p-7 xl:p-8">
          <div className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full bg-emerald-200/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-50">
                  <Layers3 className="h-3.5 w-3.5" />
                  MGB ERP
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-100/10 px-3 py-1.5 text-[10px] font-semibold text-emerald-50">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Inventory Control
                </span>
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl xl:text-[38px]">
                Laporan Pemakaian Bahan
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80">
                Analisis rekonsiliasi stok outlet, estimasi biaya per
                kategori, waste, serta perubahan biaya terhadap bulan
                sebelumnya.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-emerald-50/80">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {periodLabel(year, month)}
                </span>
                {selectedOutlet && (
                  <span className="inline-flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {selectedOutlet.code} · {selectedOutlet.name}
                  </span>
                )}
                <span className="inline-flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Laporan baca-saja
                </span>
              </div>
            </div>

            <div className="no-print flex flex-wrap gap-2">
              <ActionButton
                onClick={() => void loadReport()}
                disabled={loading}
                icon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />}
              >
                Refresh
              </ActionButton>

              <ActionButton
                onClick={exportCsv}
                disabled={!rows.length}
                icon={<FileSpreadsheet className="h-4 w-4" />}
                variant="light"
              >
                Export CSV
              </ActionButton>

              <ActionButton
                onClick={() => void exportPdf()}
                disabled={!report || !allRows.length || exportingPdf}
                icon={<FileText className={`h-4 w-4 ${exportingPdf ? "animate-pulse" : ""}`} />}
                variant="light"
              >
                {exportingPdf ? "Membuat PDF..." : "Download PDF"}
              </ActionButton>

              <ActionButton
                onClick={() => window.print()}
                icon={<Printer className="h-4 w-4" />}
              >
                Cetak
              </ActionButton>
            </div>
          </div>
        </header>

        {/* FILTER */}
        <section className="print-card rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-[#19231E] sm:p-5">
          <SectionTitle
            icon={<CalendarDays className="h-5 w-5" />}
            title="Parameter Laporan"
            description="Tentukan periode dan outlet yang ingin dianalisis."
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr_auto] xl:items-end">
            <Field label="Bulan">
              <select
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
                className={inputClass}
              >
                {monthNames.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tahun">
              <select
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                className={inputClass}
              >
                {Array.from(
                  { length: 7 },
                  (_, index) => now.getFullYear() - 5 + index,
                ).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Outlet">
              <select
                value={outletId}
                onChange={(event) => setOutletId(event.target.value)}
                disabled={(report?.outlets?.length ?? 0) === 1}
                className={inputClass}
              >
                <option value="">Pilih outlet...</option>
                {(report?.outlets ?? []).map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.code} — {outlet.name}
                  </option>
                ))}
              </select>
            </Field>

            <button
              onClick={() => void loadReport()}
              disabled={loading || !outletId}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#18352D] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#254D41] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              Tampilkan
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <span>
              Pembanding:{" "}
              <b className="text-slate-700 dark:text-slate-200">
                {periodLabel(previousPeriod.year, previousPeriod.month)}
              </b>
            </span>
            <span>Perubahan filter memuat ulang laporan otomatis.</span>
          </div>
        </section>

        {/* ERROR / STATUS */}
        {error && (
          <Notice tone="rose" title="Laporan bermasalah" icon={<XCircle className="h-5 w-5" />}>
            <p className="break-words">{error}</p>
            <button
              onClick={() => void loadReport()}
              className="no-print mt-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"
            >
              Coba lagi
            </button>
          </Notice>
        )}

        {report?.requiresOutletSelection && (
          <Notice tone="amber" title="Pilih outlet terlebih dahulu" icon={<Info className="h-5 w-5" />}>
            Pilih outlet pada parameter laporan, kemudian tekan Tampilkan.
          </Notice>
        )}

        {report?.opname?.isProvisional && (
          <Notice tone="amber" title="Periode belum final" icon={<AlertTriangle className="h-5 w-5" />}>
            Stok akhir masih menggunakan saldo sistem sementara. Angka
            pemakaian dan biaya dapat berubah setelah Stock Opname fisik
            disetujui.
          </Notice>
        )}

        {/* SNAPSHOTS */}
        {report?.opname && (
          <section className="grid gap-3 md:grid-cols-2">
            <SnapshotCard
              title="Snapshot Stok Awal"
              icon={<ArrowDownRight className="h-5 w-5" />}
              code={report.opname.opening?.code ?? "Belum tersedia"}
              date={report.opname.opening?.date}
              description={
                report.opname.opening
                  ? "Stock Opname terakhir yang disetujui sebelum periode laporan."
                  : "Belum ditemukan Stock Opname disetujui sebelum periode ini."
              }
              tone="blue"
            />
            <SnapshotCard
              title="Snapshot Stok Akhir"
              icon={<ArrowUpRight className="h-5 w-5" />}
              code={
                report.opname.ending?.code ??
                (report.opname.isProvisional
                  ? "Saldo sistem sementara"
                  : "Belum tersedia")
              }
              date={report.opname.ending?.date}
              description={
                report.opname.ending
                  ? "Stock Opname yang disetujui pada periode laporan."
                  : report.opname.isProvisional
                    ? "Saldo sistem sementara karena opname akhir belum disetujui."
                    : "Belum ditemukan Stock Opname disetujui pada periode ini."
              }
              tone={report.opname.isProvisional ? "amber" : "green"}
              badge={report.opname.isProvisional ? "SEMENTARA" : undefined}
            />
          </section>
        )}

        {/* KPI */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            title="Total Estimasi Biaya"
            value={report ? fmtMoney(currentTotalCost) : "—"}
            detail={`${periodLabel(year, month)} · barang yang terhitung`}
            icon={<Wallet className="h-5 w-5" />}
            accent="green"
          />
          <Metric
            title="Barang Terhitung"
            value={report ? fmtQty(currentCompleteness.calculated) : "—"}
            detail={
              report
                ? `dari ${allRows.length} barang · ${currentCompleteness.percentage}% lengkap`
                : "Menunggu data laporan"
            }
            icon={<CheckCircle2 className="h-5 w-5" />}
            accent="blue"
          />
          <Metric
            title="Perlu Rekonsiliasi"
            value={report ? fmtQty(currentCompleteness.pending) : "—"}
            detail="Snapshot atau perhitungan belum lengkap"
            icon={<AlertCircle className="h-5 w-5" />}
            accent="amber"
          />
          <Metric
            title="Selisih Tidak Wajar"
            value={report ? fmtQty(discrepancyCount) : "—"}
            detail="Barang perlu ditinjau sebelum laporan final"
            icon={<AlertTriangle className="h-5 w-5" />}
            accent={discrepancyCount > 0 ? "rose" : "green"}
          />
        </section>

        {/* COST ANALYSIS */}
        <section className="print-card space-y-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-[#19231E] sm:p-5 xl:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <SectionTitle
              icon={<TrendingUp className="h-5 w-5" />}
              title="Analisis Biaya per Kategori"
              description="Bandingkan biaya bulan ini dengan bulan sebelumnya, termasuk selisih rupiah dan persentase perubahan."
            />
            <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              {comparison.length} kategori
            </span>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <ComparisonMetric
              label="Biaya Periode Terpilih"
              period={periodLabel(year, month)}
              value={report ? fmtMoney(currentTotalCost) : "—"}
              icon={<Wallet className="h-4 w-4" />}
              tone="green"
            />
            <ComparisonMetric
              label="Biaya Periode Sebelumnya"
              period={periodLabel(previousPeriod.year, previousPeriod.month)}
              value={previousReport ? fmtMoney(previousTotalCost) : "—"}
              icon={<CalendarDays className="h-4 w-4" />}
              tone="blue"
            />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#111A15]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Perubahan Biaya
                </p>
                <span className="rounded-lg bg-white p-2 text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                  {totalChange.difference > 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : totalChange.difference < 0 ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : (
                    <Minus className="h-4 w-4" />
                  )}
                </span>
              </div>
              <p
                className={`mt-3 break-words text-xl font-extrabold tracking-tight ${
                  totalChange.difference > 0
                    ? "text-rose-700 dark:text-rose-300"
                    : totalChange.difference < 0
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-slate-800 dark:text-slate-100"
                }`}
              >
                {comparisonAvailable
                  ? `${totalChange.difference > 0 ? "+" : ""}${fmtMoney(totalChange.difference)}`
                  : "—"}
              </p>
              <div className="mt-2">
                <ChangeLabel
                  difference={totalChange.difference}
                  percentage={totalChange.percentage}
                  available={comparisonAvailable}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-[#151E19]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Kelengkapan periode terpilih
              </span>
              <span className="text-xs font-extrabold text-[#286A55] dark:text-emerald-300">
                {currentCompleteness.percentage}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#497F70] to-[#76A998] transition-all"
                style={{ width: `${currentCompleteness.percentage}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span>{currentCompleteness.calculated} barang terhitung</span>
              <span>{currentCompleteness.pending} belum lengkap</span>
            </div>
            {previousReport && (
              <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Kelengkapan periode pembanding
                  </span>
                  <span className="text-xs font-extrabold text-blue-700 dark:text-blue-300">
                    {previousCompleteness.percentage}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${previousCompleteness.percentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {previousError && (
            <Notice tone="amber" title="Data pembanding belum tersedia" icon={<AlertTriangle className="h-4 w-4" />}>
              {previousError}
            </Notice>
          )}

          {!previousReport && !loading && outletId && !previousError && (
            <Notice tone="amber" title="Perbandingan belum tersedia" icon={<Info className="h-4 w-4" />}>
              Data bulan sebelumnya belum dimuat. Selisih dan persentase
              belum dapat dijadikan kesimpulan final.
            </Notice>
          )}

          <div>
            <div className="mb-3">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">
                Rincian Perbandingan Kategori
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Kenaikan biaya tidak otomatis berarti pemborosan. Periksa
                jumlah pemakaian, harga bahan, dan kelengkapan data.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3.5">Kategori Barang</th>
                    <th className="px-4 py-3.5 text-right">
                      {monthNames[previousPeriod.month - 1]}
                    </th>
                    <th className="px-4 py-3.5 text-right">
                      {monthNames[month - 1]}
                    </th>
                    <th className="px-4 py-3.5 text-right">Selisih</th>
                    <th className="px-4 py-3.5 text-right">Perubahan</th>
                    <th className="px-4 py-3.5 text-right">Terhitung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                        <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        Menghitung perbandingan biaya...
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    comparison.map((item) => (
                      <tr key={item.category} className="transition hover:bg-[#F5FAF7] dark:hover:bg-slate-800/70">
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-slate-800 dark:text-slate-100">
                            {item.category}
                          </p>
                          {(item.currentPending > 0 || item.previousPending > 0) && (
                            <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                              <AlertTriangle className="h-3 w-3" />
                              Ada barang belum lengkap
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right text-slate-600 dark:text-slate-300">
                          {previousReport ? fmtMoney(item.previousCost) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-bold text-slate-800 dark:text-slate-100">
                          {report ? fmtMoney(item.currentCost) : "—"}
                        </td>
                        <td className={`whitespace-nowrap px-4 py-3.5 text-right font-bold ${item.difference > 0 ? "text-rose-700 dark:text-rose-300" : item.difference < 0 ? "text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300"}`}>
                          {comparisonAvailable
                            ? `${item.difference > 0 ? "+" : ""}${fmtMoney(item.difference)}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <ChangeLabel
                            difference={item.difference}
                            percentage={item.percentage}
                            available={comparisonAvailable}
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right text-xs text-slate-600 dark:text-slate-300">
                          {report ? `${item.currentCalculated}/${item.currentCount}` : "—"}
                        </td>
                      </tr>
                    ))}

                  {!loading && comparison.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                        Belum ada kategori untuk dibandingkan.
                      </td>
                    </tr>
                  )}
                </tbody>

                {!loading && comparisonAvailable && (
                  <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-extrabold dark:border-slate-600 dark:bg-slate-800">
                    <tr>
                      <td className="px-4 py-3.5 text-slate-800 dark:text-slate-100">TOTAL</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-slate-700 dark:text-slate-200">
                        {fmtMoney(previousTotalCost)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-slate-800 dark:text-slate-100">
                        {fmtMoney(currentTotalCost)}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3.5 text-right ${totalChange.difference > 0 ? "text-rose-700 dark:text-rose-300" : totalChange.difference < 0 ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-200"}`}>
                        {totalChange.difference > 0 ? "+" : ""}
                        {fmtMoney(totalChange.difference)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <ChangeLabel
                          difference={totalChange.difference}
                          percentage={totalChange.percentage}
                          available
                        />
                      </td>
                      <td className="px-4 py-3.5 text-right text-xs text-slate-600 dark:text-slate-300">
                        {currentCompleteness.calculated}/{allRows.length}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* WHATSAPP ACTIONS */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 dark:border-emerald-900 dark:from-[#152A20] dark:to-[#17211B] sm:p-5">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 dark:text-slate-100">
                    Ringkasan WhatsApp Premium
                  </h3>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600 dark:text-slate-300">
                    Pesan berisi total biaya, perbandingan per kategori,
                    persentase perubahan, jumlah barang yang terhitung, dan
                    peringatan kelengkapan data.
                  </p>
                  {copyMessage && (
                    <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {copyMessage}
                    </p>
                  )}
                </div>
              </div>

              <div className="no-print flex flex-wrap gap-2">
                <button
                  onClick={() => void copyWhatsAppMessage()}
                  disabled={!report}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-emerald-950"
                >
                  <Copy className="h-4 w-4" />
                  Salin Pesan
                </button>
                <button
                  onClick={openWhatsApp}
                  disabled={!report}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#16865B] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#117349] disabled:opacity-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Buka WhatsApp Web
                </button>
              </div>
            </div>

            <details className="mt-4 rounded-xl border border-emerald-100 bg-white/80 p-3 dark:border-emerald-900 dark:bg-black/10">
              <summary className="cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200">
                Pratinjau pesan yang akan disalin/dikirim
              </summary>
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700 dark:bg-[#101714] dark:text-slate-200">
                {whatsappMessage}
              </pre>
            </details>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-[#F5F8F6] p-3.5 text-xs leading-5 text-slate-600 dark:bg-[#111A15] dark:text-slate-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#497F70]" />
            <p>
              Biaya kategori menjumlahkan barang yang dapat dihitung.
              Jika ada barang belum lengkap, angka tersebut merupakan
              subtotal barang terhitung, bukan nilai final keseluruhan
              kategori. Persentase tidak dapat dihitung sebagai perubahan
              normal jika biaya periode sebelumnya nol dan biaya sekarang
              bukan nol.
            </p>
          </div>
        </section>

        {/* GUIDE */}
        <section className="print-card rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-[#19231E] sm:p-5">
          <SectionTitle
            icon={<Info className="h-5 w-5" />}
            title="Cara Membaca Laporan"
            description="Gunakan urutan berikut untuk memahami angka dan menentukan data yang perlu diperiksa."
          />

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <GuideCard number="01" title="Stok Awal" description="Saldo dari Stock Opname sebelumnya yang telah disetujui." tone="blue" />
            <GuideCard number="02" title="Barang Masuk" description="Penambahan stok yang tercatat, seperti penerimaan PO, transfer, delivery, dan penyesuaian masuk." tone="green" />
            <GuideCard number="03" title="Stok Akhir" description="Saldo fisik dari Stock Opname akhir yang disetujui, atau saldo sistem sementara jika belum tersedia." tone="amber" />
            <GuideCard number="04" title="Estimasi Pemakaian" description="Sisa pergerakan stok setelah memperhitungkan stok awal, barang masuk, stok akhir, waste, dan pengeluaran lain." tone="violet" />
          </div>

          <div className="mt-4 rounded-xl border border-[#D9E8E1] bg-[#F4F8F5] p-4 dark:border-emerald-900 dark:bg-[#14241B]">
            <p className="text-xs font-bold uppercase tracking-wider text-[#286A55] dark:text-emerald-300">
              Rumus rekonsiliasi
            </p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-800 dark:text-slate-100">
              Estimasi Pemakaian = Stok Awal + Total Masuk − Stok Akhir
              − Waste/Rusak − Keluar Non-Pemakaian
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
              Hasil ini adalah estimasi rekonsiliasi stok, bukan konsumsi
              POS atau BOM aktual. Angka negatif atau selisih tidak wajar
              perlu ditinjau.
            </p>
          </div>
        </section>

        {/* DETAIL TABLE */}
        <section className="print-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-[#19231E]">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-4 dark:border-slate-700 sm:p-5 xl:flex-row xl:items-center">
            <SectionTitle
              icon={<Package className="h-5 w-5" />}
              title="Rincian Pemakaian per Barang"
              description="Biaya per barang menggunakan biaya satuan dari API. Kuantitas mengikuti satuan stok pada laporan."
            />

            <div className="no-print grid gap-2 sm:grid-cols-3 xl:min-w-[650px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari kode / nama..."
                  className={`${inputClass} pl-9`}
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className={inputClass}
                aria-label="Filter kategori"
              >
                <option value="ALL">Semua kategori</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={inputClass}
                aria-label="Filter status"
              >
                <option value="ALL">Semua status</option>
                <option value="CALCULATED">Terhitung</option>
                <option value="PENDING">Belum lengkap</option>
                <option value="DISCREPANCY">Selisih tidak wajar</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 text-xs dark:border-slate-700 dark:bg-[#151E19] sm:px-5">
            <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {rows.length} barang ditampilkan
              </span>
              <span className="text-slate-300">|</span>
              <span>{currentCompleteness.calculated} terhitung</span>
              <span className="text-slate-300">|</span>
              <span>{currentCompleteness.pending} belum lengkap</span>
            </div>

            {(search || categoryFilter !== "ALL" || statusFilter !== "ALL") && (
              <button
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("ALL");
                  setStatusFilter("ALL");
                }}
                className="no-print inline-flex items-center gap-1.5 font-semibold text-[#286A55] hover:underline dark:text-emerald-300"
              >
                <XCircle className="h-3.5 w-3.5" />
                Reset filter
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="print-table w-full min-w-[1450px] border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="sticky left-0 z-10 min-w-[220px] bg-slate-50 px-4 py-3.5 dark:bg-slate-800">Barang</th>
                  <th className="whitespace-nowrap px-3 py-3.5 text-right">Stok Awal</th>
                  <th className="whitespace-nowrap px-3 py-3.5 text-right">Masuk PO</th>
                  <th className="whitespace-nowrap px-3 py-3.5 text-right">Transfer</th>
                  <th className="whitespace-nowrap px-3 py-3.5 text-right">Delivery</th>
                  <th className="whitespace-nowrap px-3 py-3.5 text-right">Penyesuaian +</th>
                  <th className="whitespace-nowrap px-3 py-3.5 text-right">Total Masuk</th>
                  <th className="whitespace-nowrap px-3 py-3.5 text-right">Stok Akhir</th>
                  <th className="whitespace-nowrap px-3 py-3.5 text-right">Waste/Rusak</th>
                  <th className="whitespace-nowrap px-3 py-3.5 text-right">Keluar Lain</th>
                  <th className="whitespace-nowrap px-3 py-3.5 text-right">Pemakaian</th>
                  <th className="whitespace-nowrap px-3 py-3.5 text-right">Biaya / Unit</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-right">Estimasi Biaya</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {loading && (
                  <tr>
                    <td colSpan={14} className="px-4 py-14 text-center text-slate-500 dark:text-slate-400">
                      <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-[#497F70]" />
                      <p className="font-semibold text-slate-700 dark:text-slate-200">Memuat laporan...</p>
                      <p className="mt-1 text-xs">Sedang mengambil data stok dan transaksi.</p>
                    </td>
                  </tr>
                )}

                {!loading &&
                  rows.map((row) => {
                    const hasDiscrepancy = row.discrepancyQty < 0;

                    return (
                      <tr key={row.barangId} className="transition hover:bg-[#F5FAF7] dark:hover:bg-slate-800/70">
                        <td className="sticky left-0 z-[1] bg-white px-4 py-3.5 transition dark:bg-[#19231E]">
                          <p className="font-bold leading-5 text-slate-800 dark:text-slate-100">{row.name}</p>
                          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                            {row.code}{row.category ? ` · ${row.category}` : ""}
                          </p>
                        </td>
                        <NumCell value={row.openingStock} unit={row.unit} />
                        <NumCell value={row.purchaseIncoming} unit={row.unit} />
                        <NumCell value={row.transferIncoming} unit={row.unit} />
                        <NumCell value={row.deliveryIncoming} unit={row.unit} />
                        <NumCell value={row.adjustmentIncoming} unit={row.unit} />
                        <NumCell value={row.incomingQty} unit={row.unit} strong />
                        <NumCell value={row.endingStock} unit={row.unit} />
                        <NumCell value={row.wasteQty} unit={row.unit} />
                        <NumCell value={row.otherOutQty} unit={row.unit} />

                        <td className="whitespace-nowrap px-3 py-3.5 text-right">
                          <span className={`font-extrabold ${row.usageQty === null ? "text-slate-400" : hasDiscrepancy ? "text-rose-700 dark:text-rose-300" : "text-[#286A55] dark:text-emerald-300"}`}>
                            {row.usageQty === null ? "—" : `${fmtQty(row.usageQty)} ${row.unit}`}
                          </span>
                          {hasDiscrepancy && (
                            <p className="mt-1 text-[10px] font-semibold text-rose-600 dark:text-rose-300">Perlu diperiksa</p>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-3 py-3.5 text-right text-slate-600 dark:text-slate-300">
                          {fmtMoney(row.unitCost)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-bold text-slate-800 dark:text-slate-100">
                          {fmtMoney(row.usageCost)}
                        </td>
                        <td className="px-4 py-3.5">
                          {row.canCalculate && row.usageCost !== null ? (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Terhitung
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Belum lengkap
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-4 py-14 text-center text-slate-500 dark:text-slate-400">
                      <Search className="mx-auto mb-3 h-7 w-7 text-slate-300" />
                      <p className="font-semibold text-slate-700 dark:text-slate-200">Tidak ada barang yang cocok</p>
                      <p className="mt-1 text-xs">Coba ubah kata pencarian atau filter laporan.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 border-t border-slate-100 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-[#151E19] sm:grid-cols-3 sm:px-5">
            <MiniSummary label="Barang pada tampilan" value={fmtQty(rows.length)} description="Setelah filter diterapkan" />
            <MiniSummary label="Estimasi biaya pada tampilan" value={fmtMoney(sumCalculatedCost(rows))} description="Hanya barang yang terhitung" />
            <MiniSummary label="Barang perlu ditinjau" value={fmtQty(rows.filter((row) => row.discrepancyQty < 0).length)} description="Selisih tidak wajar" />
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-[11px] leading-5 text-slate-500 dark:border-slate-700 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <span>Menampilkan {rows.length} dari {allRows.length} barang.</span>
            <span>Kuantitas tidak dijumlahkan lintas satuan karena unit barang dapat berbeda.</span>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-4 text-[11px] leading-5 text-slate-500 dark:border-slate-700 dark:bg-[#19231E] dark:text-slate-400 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#18352D] text-white">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-slate-700 dark:text-slate-200">MGB ERP</p>
              <p>Laporan Pemakaian Bahan Outlet</p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="font-semibold text-slate-700 dark:text-slate-200">{periodLabel(year, month)}</p>
            <p>Estimasi rekonsiliasi stok · Bukan konsumsi POS/BOM aktual</p>
          </div>
        </footer>
      </div>
    </main>
  );
}

// ============================================================
// REUSABLE UI
// ============================================================

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10 disabled:bg-slate-100 dark:border-slate-600 dark:bg-[#111A15] dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-800";

function ActionButton({
  children,
  onClick,
  disabled,
  icon,
  variant = "glass",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon: ReactNode;
  variant?: "glass" | "light";
}) {
  const styles =
    variant === "light"
      ? "bg-white text-[#18352D] hover:bg-emerald-50"
      : "border border-white/20 bg-white/10 text-white hover:bg-white/20";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {icon}
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0 text-sm">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function SectionTitle({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#286A55] dark:bg-[#233B30] dark:text-emerald-300">
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="font-extrabold text-slate-800 dark:text-slate-100">
          {title}
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function Notice({
  title,
  children,
  icon,
  tone,
}: {
  title: string;
  children: ReactNode;
  icon: ReactNode;
  tone: "rose" | "amber";
}) {
  const colors =
    tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
      : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";

  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm leading-6 ${colors}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="mb-1 font-bold">{title}</p>
        {children}
      </div>
    </div>
  );
}

function SnapshotCard({
  title,
  icon,
  code,
  date,
  description,
  tone,
  badge,
}: {
  title: string;
  icon: ReactNode;
  code: string;
  date?: string;
  description: string;
  tone: "blue" | "green" | "amber";
  badge?: string;
}) {
  const tones = {
    blue: {
      icon: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      border: "border-blue-100 dark:border-blue-900",
      badge: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    },
    green: {
      icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
      border: "border-emerald-100 dark:border-emerald-900",
      badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    },
    amber: {
      icon: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
      border: "border-amber-100 dark:border-amber-900",
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    },
  };

  const color = tones[tone];

  return (
    <div className={`print-card rounded-2xl border ${color.border} bg-white p-4 shadow-sm dark:bg-[#19231E] sm:p-5`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color.icon}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="break-words text-lg font-extrabold text-slate-800 dark:text-slate-100">
              {code}
            </p>
            {badge && (
              <span className={`rounded-full px-2 py-1 text-[9px] font-extrabold tracking-wide ${color.badge}`}>
                {badge}
              </span>
            )}
          </div>
          {date && (
            <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Tanggal: {fmtDate(date)}
            </p>
          )}
          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function Metric({
  title,
  value,
  detail,
  icon,
  accent,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
  accent: "green" | "blue" | "amber" | "rose";
}) {
  const accents = {
    green: {
      icon: "bg-[#EAF3EF] text-[#286A55] dark:bg-[#233B30] dark:text-emerald-300",
      bar: "bg-[#497F70]",
    },
    blue: {
      icon: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      bar: "bg-blue-500",
    },
    amber: {
      icon: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      bar: "bg-amber-500",
    },
    rose: {
      icon: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
      bar: "bg-rose-500",
    },
  };

  return (
    <div className="print-card group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-[#19231E] sm:p-5">
      <div className={`absolute inset-x-0 top-0 h-1 ${accents[accent].bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-3 break-words text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
            {value}
          </p>
          <p className="mt-2 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accents[accent].icon}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function ComparisonMetric({
  label,
  period,
  value,
  icon,
  tone,
}: {
  label: string;
  period: string;
  value: string;
  icon: ReactNode;
  tone: "green" | "blue";
}) {
  const color =
    tone === "green"
      ? "bg-[#EAF3EF] text-[#286A55] dark:bg-[#233B30] dark:text-emerald-300"
      : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#111A15]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`rounded-lg p-2 ${color}`}>{icon}</span>
      </div>
      <p className="mt-3 break-words text-xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
        {value}
      </p>
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{period}</p>
    </div>
  );
}

function GuideCard({
  number,
  title,
  description,
  tone,
}: {
  number: string;
  title: string;
  description: string;
  tone: "blue" | "green" | "amber" | "violet";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  };

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-[#151E19]">
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-extrabold ${tones[tone]}`}>
          {number}
        </span>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

function ChangeLabel({
  difference,
  percentage,
  available,
}: {
  difference: number;
  percentage: number | null;
  available: boolean;
}) {
  if (!available) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  if (difference > 0) {
    return (
      <span className="inline-flex items-center justify-end gap-1 text-xs font-bold text-rose-700 dark:text-rose-300">
        <TrendingUp className="h-3.5 w-3.5" />
        {percentage === null ? "Baru" : formatPercent(percentage)}
      </span>
    );
  }

  if (difference < 0) {
    return (
      <span className="inline-flex items-center justify-end gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
        <TrendingDown className="h-3.5 w-3.5" />
        {percentage === null ? "Turun" : formatPercent(percentage)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-end gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
      <Minus className="h-3.5 w-3.5" />
      0%
    </span>
  );
}

function MiniSummary({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-[#19231E]">
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1.5 break-words text-base font-extrabold text-slate-800 dark:text-slate-100">{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

function NumCell({
  value,
  unit,
  strong = false,
}: {
  value: number | null;
  unit: string;
  strong?: boolean;
}) {
  return (
    <td className={`whitespace-nowrap px-3 py-3.5 text-right ${strong ? "font-extrabold text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}`}>
      {value === null ? "—" : fmtQty(value)}{" "}
      <span className="text-[10px] text-slate-400">{unit}</span>
    </td>
  );
}
