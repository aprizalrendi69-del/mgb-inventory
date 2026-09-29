"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
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

type StatusFilter = "EXPIRED" | "WARNING" | "AMAN";

const STATUS_META = {
  EXPIRED: {
    label: "Expired",
    description: "Sudah melewati tanggal",
    icon: XCircle,
    badge: "border-red-200 bg-red-50 text-red-700",
    iconWrap: "bg-red-100 text-red-600",
    accent: "from-red-500 to-rose-600",
    soft: "bg-red-50/70",
    text: "text-red-600",
    active:
      "border-red-300 bg-gradient-to-br from-red-50 to-rose-50 text-red-700 shadow-[0_8px_24px_-12px_rgba(220,38,38,0.45)]",
  },
  WARNING: {
    label: "Warning",
    description: "Mendekati expired",
    icon: AlertTriangle,
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    iconWrap: "bg-amber-100 text-amber-600",
    accent: "from-amber-400 to-orange-500",
    soft: "bg-amber-50/70",
    text: "text-amber-600",
    active:
      "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-700 shadow-[0_8px_24px_-12px_rgba(245,158,11,0.45)]",
  },
  AMAN: {
    label: "Aman",
    description: "Masih dalam masa berlaku",
    icon: CheckCircle2,
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconWrap: "bg-emerald-100 text-emerald-600",
    accent: "from-emerald-400 to-teal-600",
    soft: "bg-emerald-50/70",
    text: "text-emerald-600",
    active:
      "border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-700 shadow-[0_8px_24px_-12px_rgba(16,185,129,0.45)]",
  },
} as const;

const STATUS_OPTIONS: StatusFilter[] = [
  "EXPIRED",
  "WARNING",
  "AMAN",
];

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

  // Multi-select status.
  // Empty array = Semua Status.
  const [statusFilters, setStatusFilters] = useState<
    StatusFilter[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const [deleteLoading, setDeleteLoading] = useState<number | null>(
    null
  );

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

  function toggleStatus(statusValue: StatusFilter) {
    setStatusFilters((prev) => {
      if (prev.includes(statusValue)) {
        return prev.filter((item) => item !== statusValue);
      }

      return [...prev, statusValue];
    });
  }

  function resetFilters() {
    setSearch("");
    setStatusFilters([]);
  }

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return data.filter((item) => {
      const cocokSearch =
        !keyword ||
        item.namaBarang?.toLowerCase().includes(keyword) ||
        item.kodeBarang?.toLowerCase().includes(keyword) ||
        item.batchNumber?.toLowerCase().includes(keyword);

      const cocokStatus =
        statusFilters.length === 0 ||
        statusFilters.includes(item.status);

      return cocokSearch && cocokStatus;
    });
  }, [data, search, statusFilters]);

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
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const now = new Date();

      const colors = {
        ink: [15, 23, 42] as [number, number, number],
        muted: [100, 116, 139] as [number, number, number],
        line: [226, 232, 240] as [number, number, number],
        soft: [248, 250, 252] as [number, number, number],
        green: [24, 53, 45] as [number, number, number],
        green2: [73, 127, 112] as [number, number, number],
        white: [255, 255, 255] as [number, number, number],
        red: [185, 28, 28] as [number, number, number],
        redSoft: [254, 242, 242] as [number, number, number],
        amber: [180, 83, 9] as [number, number, number],
        amberSoft: [255, 247, 237] as [number, number, number],
        emerald: [4, 120, 87] as [number, number, number],
        emeraldSoft: [236, 253, 245] as [number, number, number],
      };

      const statusLabel =
        statusFilters.length === 0
          ? "Semua Status"
          : statusFilters
              .map((item) => STATUS_META[item].label)
              .join(" + ");

      const searchLabel = search.trim()
        ? search.trim()
        : "Semua Barang";

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

      const riskQty = filtered
        .filter(
          (item) =>
            item.status === "EXPIRED" ||
            item.status === "WARNING"
        )
        .reduce((sum, item) => sum + Number(item.qty || 0), 0);

      const formatExportDate = (date: Date) =>
        date.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });

      const formatExportTime = (date: Date) =>
        date.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        });

      /*
       * ---------------------------------------------------------
       * SMALL VECTOR ICONS
       * ---------------------------------------------------------
       * Dibuat dengan vector PDF supaya tidak bergantung pada
       * font emoji / icon image dan tetap tajam saat dicetak.
       */
      const drawCheckIcon = (
        x: number,
        y: number,
        radius: number,
        color: [number, number, number]
      ) => {
        pdf.setDrawColor(...color);
        pdf.setLineWidth(0.7);
        pdf.circle(x, y, radius, "S");
        pdf.line(
          x - radius * 0.45,
          y,
          x - radius * 0.08,
          y + radius * 0.42
        );
        pdf.line(
          x - radius * 0.08,
          y + radius * 0.42,
          x + radius * 0.55,
          y - radius * 0.48
        );
      };

      const drawXIcon = (
        x: number,
        y: number,
        radius: number,
        color: [number, number, number]
      ) => {
        pdf.setDrawColor(...color);
        pdf.setLineWidth(0.7);
        pdf.circle(x, y, radius, "S");
        pdf.line(
          x - radius * 0.4,
          y - radius * 0.4,
          x + radius * 0.4,
          y + radius * 0.4
        );
        pdf.line(
          x + radius * 0.4,
          y - radius * 0.4,
          x - radius * 0.4,
          y + radius * 0.4
        );
      };

      const drawWarningIcon = (
        x: number,
        y: number,
        size: number,
        color: [number, number, number]
      ) => {
        pdf.setDrawColor(...color);
        pdf.setLineWidth(0.7);

        const top = y - size * 0.58;
        const bottom = y + size * 0.48;
        const left = x - size * 0.62;
        const right = x + size * 0.62;

        pdf.line(top ? x : x, top, right, bottom);
        pdf.line(right, bottom, left, bottom);
        pdf.line(left, bottom, x, top);

        pdf.line(x, y - size * 0.22, x, y + size * 0.15);
        pdf.circle(x, y + size * 0.31, 0.35, "F");
      };

      const drawPackageIcon = (
        x: number,
        y: number,
        size: number,
        color: [number, number, number]
      ) => {
        pdf.setDrawColor(...color);
        pdf.setLineWidth(0.55);

        const w = size;
        const h = size * 0.72;
        const left = x - w / 2;
        const right = x + w / 2;
        const top = y - h / 2;
        const bottom = y + h / 2;

        pdf.rect(left, top, w, h, "S");
        pdf.line(left, top, x, top + h * 0.22);
        pdf.line(x, top + h * 0.22, right, top);
        pdf.line(x, top + h * 0.22, x, bottom);
      };

      const drawCalendarIcon = (
        x: number,
        y: number,
        size: number,
        color: [number, number, number]
      ) => {
        pdf.setDrawColor(...color);
        pdf.setLineWidth(0.55);

        const w = size;
        const h = size * 0.82;
        const left = x - w / 2;
        const top = y - h / 2;

        pdf.roundedRect(left, top, w, h, 1, 1, "S");
        pdf.line(left, top + h * 0.28, left + w, top + h * 0.28);
        pdf.line(
          left + w * 0.25,
          top - 0.7,
          left + w * 0.25,
          top + 1.8
        );
        pdf.line(
          left + w * 0.75,
          top - 0.7,
          left + w * 0.75,
          top + 1.8
        );
      };

      const drawStatusIcon = (
        status: ExpiredItem["status"],
        x: number,
        y: number
      ) => {
        if (status === "EXPIRED") {
          drawXIcon(x, y, 2.2, colors.red);
        } else if (status === "WARNING") {
          drawWarningIcon(x, y, 4.4, colors.amber);
        } else {
          drawCheckIcon(x, y, 2.2, colors.emerald);
        }
      };

      /*
       * ---------------------------------------------------------
       * HEADER / BRAND
       * ---------------------------------------------------------
       */
      const drawPageChrome = (
        pageNumber: number,
        totalPages?: number
      ) => {
        pdf.setFillColor(...colors.green);
        pdf.rect(0, 0, pageWidth, 7, "F");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(...colors.white);
        pdf.text("MGB ERP", 14, 4.8);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.5);
        pdf.text(
          "INVENTORY CONTROL  /  EXPIRY MONITORING",
          pageWidth - 14,
          4.8,
          { align: "right" }
        );

        pdf.setDrawColor(...colors.line);
        pdf.setLineWidth(0.25);
        pdf.line(
          14,
          pageHeight - 12,
          pageWidth - 14,
          pageHeight - 12
        );

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.5);
        pdf.setTextColor(...colors.muted);
        pdf.text(
          "MGB ERP • Monitoring Barang Expired",
          14,
          pageHeight - 6.8
        );

        pdf.text(
          `Page ${pageNumber}${totalPages ? ` / ${totalPages}` : ""}`,
          pageWidth - 14,
          pageHeight - 6.8,
          { align: "right" }
        );
      };

      drawPageChrome(1);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(19);
      pdf.setTextColor(...colors.ink);
      pdf.text("Monitoring Barang Expired", 14, 19);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...colors.muted);
      pdf.text(
        "Laporan kontrol masa berlaku batch • Identifikasi risiko dan prioritas tindakan inventory",
        14,
        25
      );

      /*
       * META PANEL
       */
      const metaX = pageWidth - 96;
      const metaY = 12;
      const metaW = 82;
      const metaH = 17;

      pdf.setFillColor(...colors.soft);
      pdf.setDrawColor(...colors.line);
      pdf.roundedRect(metaX, metaY, metaW, metaH, 2.5, 2.5, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.2);
      pdf.setTextColor(...colors.muted);
      pdf.text("EXPORT", metaX + 5, metaY + 5);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.2);
      pdf.setTextColor(...colors.ink);
      pdf.text(
        `${formatExportDate(now)} • ${formatExportTime(now)}`,
        metaX + 5,
        metaY + 9.5
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.3);
      pdf.setTextColor(...colors.muted);
      pdf.text(
        `Filter: ${statusLabel}`,
        metaX + 5,
        metaY + 14
      );

      /*
       * ---------------------------------------------------------
       * KPI CARDS
       * ---------------------------------------------------------
       */
      const cards = [
        {
          label: "TOTAL BATCH",
          value: filtered.length,
          sub: `${filteredQty.toLocaleString("id-ID")} qty`,
          color: colors.green,
          soft: colors.soft,
          icon: "package",
        },
        {
          label: "EXPIRED",
          value: filteredExpired,
          sub: `${riskQty.toLocaleString("id-ID")} qty berisiko`,
          color: colors.red,
          soft: colors.redSoft,
          icon: "expired",
        },
        {
          label: "WARNING",
          value: filteredWarning,
          sub: "Perlu dipantau",
          color: colors.amber,
          soft: colors.amberSoft,
          icon: "warning",
        },
        {
          label: "AMAN",
          value: filteredAman,
          sub: "Dalam masa berlaku",
          color: colors.emerald,
          soft: colors.emeraldSoft,
          icon: "safe",
        },
      ];

      const cardGap = 4;
      const cardY = 33;
      const cardH = 22;
      const cardWidth =
        (pageWidth - 28 - cardGap * 3) / 4;

      cards.forEach((card, index) => {
        const x = 14 + index * (cardWidth + cardGap);

        pdf.setFillColor(...card.soft);
        pdf.setDrawColor(...colors.line);
        pdf.roundedRect(
          x,
          cardY,
          cardWidth,
          cardH,
          2.5,
          2.5,
          "FD"
        );

        pdf.setFillColor(...card.color);
        pdf.roundedRect(
          x + 4,
          cardY + 4,
          11,
          11,
          2,
          2,
          "F"
        );

        if (card.icon === "expired") {
          drawXIcon(
            x + 9.5,
            cardY + 9.5,
            2.1,
            colors.white
          );
        } else if (card.icon === "warning") {
          drawWarningIcon(
            x + 9.5,
            cardY + 9.5,
            4.1,
            colors.white
          );
        } else if (card.icon === "safe") {
          drawCheckIcon(
            x + 9.5,
            cardY + 9.5,
            2.1,
            colors.white
          );
        } else {
          drawPackageIcon(
            x + 9.5,
            cardY + 9.5,
            6.2,
            colors.white
          );
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.4);
        pdf.setTextColor(...colors.muted);
        pdf.text(card.label, x + 19, cardY + 6.5);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(...card.color);
        pdf.text(String(card.value), x + 19, cardY + 14.5);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.2);
        pdf.setTextColor(...colors.muted);
        pdf.text(card.sub, x + 19, cardY + 19);
      });

      /*
       * ---------------------------------------------------------
       * FILTER / CONTROL SUMMARY
       * ---------------------------------------------------------
       */
      const infoY = 59;

      pdf.setFillColor(249, 250, 251);
      pdf.setDrawColor(...colors.line);
      pdf.roundedRect(
        14,
        infoY,
        pageWidth - 28,
        10,
        2,
        2,
        "FD"
      );

      drawPackageIcon(
        20,
        infoY + 5,
        5.5,
        colors.green2
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.8);
      pdf.setTextColor(...colors.ink);
      pdf.text(
        `${filtered.length} batch`,
        25,
        infoY + 4.3
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.setTextColor(...colors.muted);
      pdf.text(
        `• Total quantity ${filteredQty.toLocaleString("id-ID")}`,
        25,
        infoY + 7.5
      );

      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...colors.red);
      pdf.text(
        `Expired ${filteredExpired}`,
        91,
        infoY + 4.3
      );

      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...colors.amber);
      pdf.text(
        `Warning ${filteredWarning}`,
        123,
        infoY + 4.3
      );

      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...colors.emerald);
      pdf.text(
        `Aman ${filteredAman}`,
        157,
        infoY + 4.3
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.3);
      pdf.setTextColor(...colors.muted);
      pdf.text(
        `Pencarian: ${searchLabel}`,
        pageWidth - 19,
        infoY + 7.5,
        { align: "right" }
      );

      /*
       * ---------------------------------------------------------
       * TABLE
       * ---------------------------------------------------------
       */
      autoTable(pdf, {
        startY: 74,
        head: [
          [
            "NO",
            "KODE BARANG",
            "NAMA BARANG",
            "BATCH",
            "QTY",
            "TANGGAL EXPIRED",
            "SISA MASA",
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
            ? `${Math.abs(Number(item.sisaHari || 0))} hari lewat`
            : Number(item.sisaHari || 0) === 0
              ? "Hari ini"
              : `${Number(item.sisaHari || 0)} hari lagi`,
          item.status,
        ]),
        theme: "plain",
        styles: {
          font: "helvetica",
          fontSize: 7.2,
          cellPadding: {
            top: 3,
            right: 2.5,
            bottom: 3,
            left: 2.5,
          },
          textColor: colors.ink,
          lineColor: colors.line,
          lineWidth: 0.2,
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          font: "helvetica",
          fontStyle: "bold",
          fontSize: 6.5,
          textColor: colors.white,
          fillColor: colors.green,
          lineColor: colors.green,
          lineWidth: 0.2,
          halign: "center",
          valign: "middle",
          cellPadding: 3,
        },
        alternateRowStyles: {
          fillColor: [250, 251, 252],
        },
        columnStyles: {
          0: {
            cellWidth: 10,
            halign: "center",
          },
          1: {
            cellWidth: 29,
            fontStyle: "bold",
          },
          2: {
            cellWidth: 61,
            fontStyle: "bold",
          },
          3: {
            cellWidth: 38,
            fontStyle: "bold",
          },
          4: {
            cellWidth: 19,
            halign: "right",
            fontStyle: "bold",
          },
          5: {
            cellWidth: 34,
            halign: "center",
          },
          6: {
            cellWidth: 35,
            halign: "center",
          },
          7: {
            cellWidth: 31,
            halign: "left",
            fontStyle: "bold",
          },
        },
        didParseCell: (hookData) => {
          if (hookData.section !== "body") return;

          const item = filtered[hookData.row.index];
          if (!item) return;

          /*
           * Beri tint lembut pada row berdasarkan status.
           * Tidak menggunakan full red/orange/green agar tetap
           * terlihat premium dan mudah dibaca saat print.
           */
          if (item.status === "EXPIRED") {
            if (hookData.row.index % 2 === 0) {
              hookData.cell.styles.fillColor = [255, 248, 248];
            }
          } else if (item.status === "WARNING") {
            if (hookData.row.index % 2 === 0) {
              hookData.cell.styles.fillColor = [255, 252, 244];
            }
          } else if (item.status === "AMAN") {
            if (hookData.row.index % 2 === 0) {
              hookData.cell.styles.fillColor = [247, 253, 250];
            }
          }

          if (hookData.column.index === 6) {
            if (item.status === "EXPIRED") {
              hookData.cell.styles.textColor = colors.red;
              hookData.cell.styles.fontStyle = "bold";
            } else if (item.status === "WARNING") {
              hookData.cell.styles.textColor = colors.amber;
              hookData.cell.styles.fontStyle = "bold";
            } else {
              hookData.cell.styles.textColor = colors.emerald;
              hookData.cell.styles.fontStyle = "bold";
            }
          }

          if (hookData.column.index === 7) {
            /*
             * Text status digambar manual sebagai premium badge
             * pada didDrawCell agar icon + label benar-benar
             * terlihat seperti status chip.
             */
            hookData.cell.text = [];
          }
        },
        didDrawCell: (hookData) => {
          if (hookData.section !== "body") return;

          const item = filtered[hookData.row.index];
          if (!item) return;

          if (hookData.column.index === 7) {
            const cell = hookData.cell;

            let textColor = colors.emerald;
            let bgColor = colors.emeraldSoft;
            let label = "AMAN";

            if (item.status === "EXPIRED") {
              textColor = colors.red;
              bgColor = colors.redSoft;
              label = "EXPIRED";
            } else if (item.status === "WARNING") {
              textColor = colors.amber;
              bgColor = colors.amberSoft;
              label = "WARNING";
            }

            const badgeW =
              label === "EXPIRED" ? 25 : 25;
            const badgeH = 6.5;
            const badgeX =
              cell.x + (cell.width - badgeW) / 2;
            const badgeY =
              cell.y + (cell.height - badgeH) / 2;

            pdf.setFillColor(...bgColor);
            pdf.setDrawColor(...bgColor);
            pdf.roundedRect(
              badgeX,
              badgeY,
              badgeW,
              badgeH,
              2.8,
              2.8,
              "F"
            );

            drawStatusIcon(
              item.status,
              badgeX + 4,
              badgeY + badgeH / 2
            );

            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(6.2);
            pdf.setTextColor(...textColor);
            pdf.text(
              label,
              badgeX + 8,
              badgeY + 4.25
            );
          }

          /*
           * Icon kecil untuk kolom sisa masa berlaku.
           */
          if (hookData.column.index === 6) {
            const cell = hookData.cell;
            const iconX = cell.x + 5;
            const iconY = cell.y + cell.height / 2;

            pdf.setDrawColor(...(
              item.status === "EXPIRED"
                ? colors.red
                : item.status === "WARNING"
                  ? colors.amber
                  : colors.emerald
            ));
            pdf.setLineWidth(0.55);
            pdf.circle(iconX, iconY, 2, "S");
            pdf.line(
              iconX,
              iconY,
              iconX,
              iconY - 1.1
            );
            pdf.line(
              iconX,
              iconY,
              iconX + 0.9,
              iconY + 0.65
            );
          }
        },
        didDrawPage: () => {
          const pageNumber =
            pdf.getCurrentPageInfo().pageNumber;

          /*
           * Halaman lanjutan mendapatkan header compact.
           * Halaman pertama sudah memiliki hero header.
           */
          if (pageNumber > 1) {
            pdf.setFillColor(...colors.green);
            pdf.rect(0, 0, pageWidth, 7, "F");

            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(7.5);
            pdf.setTextColor(...colors.white);
            pdf.text(
              "MGB ERP",
              14,
              4.8
            );

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(6.5);
            pdf.text(
              "Monitoring Barang Expired",
              pageWidth - 14,
              4.8,
              { align: "right" }
            );
          }

          pdf.setDrawColor(...colors.line);
          pdf.setLineWidth(0.25);
          pdf.line(
            14,
            pageHeight - 12,
            pageWidth - 14,
            pageHeight - 12
          );

          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(6.5);
          pdf.setTextColor(...colors.muted);
          pdf.text(
            "MGB ERP • Inventory Control • Expiry Monitoring",
            14,
            pageHeight - 6.8
          );

          pdf.text(
            `Page ${pageNumber}`,
            pageWidth - 14,
            pageHeight - 6.8,
            { align: "right" }
          );
        },
        margin: {
          top: 12,
          left: 14,
          right: 14,
          bottom: 15,
        },
        pageBreak: "auto",
        rowPageBreak: "auto",
      });

      /*
       * ---------------------------------------------------------
       * FINAL PAGE REFINEMENT
       * ---------------------------------------------------------
       */
      const totalPages = pdf.getNumberOfPages();

      for (let page = 1; page <= totalPages; page++) {
        pdf.setPage(page);

        /*
         * Pastikan nomor halaman final konsisten.
         */
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.5);
        pdf.setTextColor(...colors.muted);
        pdf.text(
          `Page ${page} / ${totalPages}`,
          pageWidth - 14,
          pageHeight - 6.8,
          { align: "right" }
        );

        /*
         * Legend status hanya di halaman terakhir.
         */
        if (page === totalPages) {
          const legendY = pageHeight - 18.5;

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(6.2);
          pdf.setTextColor(...colors.muted);
          pdf.text("STATUS LEGEND", 14, legendY);

          drawStatusIcon(
            "EXPIRED",
            42,
            legendY - 1.7
          );
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(6.2);
          pdf.setTextColor(...colors.red);
          pdf.text("Expired", 47, legendY);

          drawStatusIcon(
            "WARNING",
            70,
            legendY - 1.7
          );
          pdf.setTextColor(...colors.amber);
          pdf.text("Warning", 75, legendY);

          drawStatusIcon(
            "AMAN",
            99,
            legendY - 1.7
          );
          pdf.setTextColor(...colors.emerald);
          pdf.text("Aman", 104, legendY);

          pdf.setTextColor(...colors.muted);
          pdf.text(
            "Dokumen ini dibuat otomatis dari data batch inventory yang sedang ditampilkan.",
            pageWidth - 14,
            legendY,
            { align: "right" }
          );
        }
      }

      const safeSearch = search
        .trim()
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);

      const safeStatus =
        statusFilters.length === 0
          ? "SEMUA"
          : statusFilters.join("-");

      const filename =
        [
          "Monitoring-Barang-Expired",
          safeStatus,
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
    search.trim() !== "" ||
    statusFilters.length > 0;

  const statusFilterLabel =
    statusFilters.length === 0
      ? "Semua Status"
      : statusFilters.length === 3
      ? "Semua Status"
      : statusFilters
          .map((item) => STATUS_META[item].label)
          .join(" + ");

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
            PREMIUM FILTER / CONTROL BAR
        ====================================================== */}
        <section className="mb-5 overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_8px_30px_-20px_rgba(15,23,42,0.3)]">
          <div className="p-3 sm:p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
              {/* SEARCH */}
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

              {/* STATUS MULTI SELECT */}
              <div className="w-full xl:w-auto">
                <div className="flex h-12 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 shadow-inner">
                  {/* ALL */}
                  <button
                    type="button"
                    onClick={() =>
                      setStatusFilters([])
                    }
                    className={[
                      "inline-flex h-9 items-center justify-center rounded-lg px-3.5 text-xs font-black transition-all",
                      statusFilters.length === 0
                        ? "bg-[#18352D] text-white shadow-md shadow-[#18352D]/15"
                        : "text-slate-500 hover:bg-white hover:text-slate-700",
                    ].join(" ")}
                  >
                    Semua
                  </button>

                  {STATUS_OPTIONS.map(
                    (statusOption) => {
                      const meta =
                        STATUS_META[
                          statusOption
                        ];

                      const Icon = meta.icon;

                      const active =
                        statusFilters.includes(
                          statusOption
                        );

                      return (
                        <button
                          key={statusOption}
                          type="button"
                          onClick={() =>
                            toggleStatus(
                              statusOption
                            )
                          }
                          aria-pressed={active}
                          title={
                            meta.description
                          }
                          className={[
                            "group inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black transition-all",
                            active
                              ? meta.active
                              : "text-slate-500 hover:bg-white hover:text-slate-700",
                          ].join(" ")}
                        >
                          <Icon
                            className={[
                              "h-3.5 w-3.5 transition-transform",
                              active
                                ? "scale-105"
                                : "text-slate-400 group-hover:text-slate-600",
                            ].join(" ")}
                          />

                          {meta.label}

                          {active && (
                            <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white/80 px-1 text-[9px] font-black">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* RESET */}
              {hasFilter && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Reset
                </button>
              )}
            </div>

            {/* ACTIVE FILTER SUMMARY */}
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

              <div className="flex flex-wrap items-center gap-2">
                {statusFilters.length > 0 && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                    <span>Status:</span>

                    <span className="font-black text-slate-700">
                      {statusFilterLabel}
                    </span>
                  </div>
                )}

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
                            onClick={resetFilters}
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
                      getExpiryTone(item.status);

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
