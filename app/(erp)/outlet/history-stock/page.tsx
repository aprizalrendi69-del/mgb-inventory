"use client";

import { useEffect, useMemo, useState } from "react";
import {
  History,
  RefreshCw,
  Search,
  CalendarDays,
  Building2,
  Package,
  TrendingUp,
  Wallet,
  RotateCcw,
  ChevronDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  ArrowDownRight,
  Boxes,
  Activity,
  FileDown,
  Filter,
  UserRound,
  X,
} from "lucide-react";
import jsPDF from "jspdf";

type Direction = "IN" | "OUT";

type StockHistory = {
  id: number;
  sourceId?: number | null;
  source?: string | null;

  direction: Direction;

  trxDate: string;
  trxNumber: string;

  outletId: number;
  outlet?: {
    id: number;
    code: string;
    name: string;
  } | null;

  barangId: number;
  code: string;
  barang: string;
  unit: string;

  qtyIn: number;
  qtyOut: number;

  quantity: number;
  balance: number;

  unitCost: number;
  totalCost: number;

  type: string;

  status?: string | null;
  note?: string | null;

  user?: {
    id: number;
    fullname: string;
    username: string;
  } | null;

  referenceId?: number | null;
};

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type ApiResponse = {
  success: boolean;
  message?: string;

  role?: string;

  currentOutlet?: Outlet | null;

  outlets?: Outlet[];

  transactions?: StockHistory[];

  summary?: {
    transactionCount?: number;
    totalIn?: number;
    totalOut?: number;
    totalValueIn?: number;
    totalValueOut?: number;
  };
};

export default function OutletHistoryStockPage() {
  const [data, setData] = useState<StockHistory[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [role, setRole] = useState("");

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState("");
  const [outletId, setOutletId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [transactionType, setTransactionType] = useState("");
  const [userId, setUserId] = useState("");

  async function loadData() {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (outletId) {
        params.set("outletId", outletId);
      }

      if (dateFrom) {
        params.set("from", dateFrom);
      }

      if (dateTo) {
        params.set("to", dateTo);
      }

      const query = params.toString();

      const res = await fetch(
        `/api/outlet/history-stock${query ? `?${query}` : ""}`,
        {
          cache: "no-store",
        }
      );

      const text = await res.text();

      let json: ApiResponse;

      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Response API tidak valid (${res.status})`);
      }

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Gagal mengambil history stok outlet"
        );
      }

      setRole(json.role || "");

      setOutlets(
        Array.isArray(json.outlets)
          ? json.outlets
          : json.currentOutlet
          ? [json.currentOutlet]
          : []
      );

      setData(
        Array.isArray(json.transactions)
          ? json.transactions
          : []
      );
    } catch (error: any) {
      console.error(
        "LOAD HISTORY STOCK OUTLET ERROR:",
        error
      );

      setData([]);

      alert(
        error?.message ||
          "Gagal mengambil history stok outlet"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [outletId, dateFrom, dateTo]);

  /*
   * ============================================================
   * FORMATTER
   * ============================================================
   */

  function formatNumber(value: number) {
    const number = Number(value ?? 0);

    if (!Number.isFinite(number)) {
      return "0";
    }

    return number.toLocaleString("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    });
  }

  function formatCurrency(value: number) {
    const number = Number(value ?? 0);

    if (!Number.isFinite(number)) {
      return "Rp0";
    }

    return number.toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    });
  }

  function formatDate(value: string) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatDateTime(value: string) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDateForPdf(value: string) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function sanitizePdfText(value: string) {
    return String(value || "")
      .replace(/\r?\n/g, " ")
      .replace(/[^\x20-\x7EÀ-ÿ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /*
   * ============================================================
   * TYPE LABEL
   * ============================================================
   */

  function getTypeLabel(item: StockHistory) {
    const type = String(item.type || "")
      .trim()
      .toUpperCase();

    const labels: Record<string, string> = {
      OUTLET_STOCK_IN: "PENERIMAAN",
      OUTLET_RECEIVE: "PENERIMAAN",

      OUTLET_STOCK_OUT: "PEMAKAIAN",

      POS_OUT: "POS / BOM",

      MANUFACTURE_CONSUME: "MANUFACTURE",

      MANUFACTURE_OUTPUT: "HASIL MANUFACTURE",

      OUTLET_TRANSFER_IN: "TRANSFER MASUK",

      OUTLET_TRANSFER_OUT: "TRANSFER KELUAR",

      STOCK_OPNAME_IN: "STOCK OPNAME +",

      STOCK_OPNAME_OUT: "STOCK OPNAME -",

      ADJUSTMENT_IN: "ADJUSTMENT +",

      ADJUSTMENT_OUT: "ADJUSTMENT -",
    };

    return (
      labels[type] ||
      String(item.type || "TRANSAKSI")
        .replaceAll("_", " ")
        .toUpperCase()
    );
  }

  function getDirectionLabel(direction: Direction) {
    return direction === "IN"
      ? "STOK MASUK"
      : "STOK KELUAR";
  }

  /*
   * ============================================================
   * TRANSACTION TYPE OPTIONS
   * ============================================================
   */

  const transactionTypes = useMemo(() => {
    const map = new Map<string, string>();

    data.forEach((item) => {
      const raw = String(item.type || "")
        .trim()
        .toUpperCase();

      if (!raw) return;

      map.set(raw, getTypeLabel(item));
    });

    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1], "id-ID"))
      .map(([value, label]) => ({
        value,
        label,
      }));
  }, [data]);

  /*
   * ============================================================
   * USER OPTIONS
   * ============================================================
   */

  const users = useMemo(() => {
    const map = new Map<
      number,
      {
        id: number;
        fullname: string;
        username: string;
      }
    >();

    data.forEach((item) => {
      if (!item.user?.id) return;

      map.set(item.user.id, {
        id: item.user.id,
        fullname: item.user.fullname || "-",
        username: item.user.username || "",
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.fullname.localeCompare(b.fullname, "id-ID")
    );
  }, [data]);

  /*
   * ============================================================
   * SEARCH + FILTER
   * ============================================================
   */

  const filteredData = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return data.filter((item) => {
      const outletText = item.outlet
        ? `${item.outlet.code} ${item.outlet.name}`
        : "";

      const matchesSearch =
        !keyword ||
        item.trxNumber
          ?.toLowerCase()
          .includes(keyword) ||
        item.type
          ?.toLowerCase()
          .includes(keyword) ||
        getTypeLabel(item)
          .toLowerCase()
          .includes(keyword) ||
        item.code
          ?.toLowerCase()
          .includes(keyword) ||
        item.barang
          ?.toLowerCase()
          .includes(keyword) ||
        item.unit
          ?.toLowerCase()
          .includes(keyword) ||
        item.note
          ?.toLowerCase()
          .includes(keyword) ||
        item.source
          ?.toLowerCase()
          .includes(keyword) ||
        outletText
          .toLowerCase()
          .includes(keyword) ||
        item.user?.fullname
          ?.toLowerCase()
          .includes(keyword) ||
        item.user?.username
          ?.toLowerCase()
          .includes(keyword) ||
        item.direction
          ?.toLowerCase()
          .includes(keyword);

      const matchesType =
        !transactionType ||
        String(item.type || "")
          .trim()
          .toUpperCase() ===
          transactionType;

      const matchesUser =
        !userId ||
        String(item.user?.id || "") === userId;

      return (
        matchesSearch &&
        matchesType &&
        matchesUser
      );
    });
  }, [
    data,
    search,
    transactionType,
    userId,
  ]);

  /*
   * ============================================================
   * SUMMARY
   * ============================================================
   */

  const summary = useMemo(() => {
    return filteredData.reduce(
      (acc, item) => {
        const qtyIn = Number(item.qtyIn || 0);
        const qtyOut = Number(item.qtyOut || 0);

        const totalCost = Math.abs(
          Number(item.totalCost || 0)
        );

        acc.transactions += 1;

        acc.qtyIn += qtyIn;
        acc.qtyOut += qtyOut;

        if (item.direction === "IN") {
          acc.valueIn += totalCost;
        }

        if (item.direction === "OUT") {
          acc.valueOut += totalCost;
        }

        return acc;
      },
      {
        transactions: 0,
        qtyIn: 0,
        qtyOut: 0,
        valueIn: 0,
        valueOut: 0,
      }
    );
  }, [filteredData]);

  /*
   * ============================================================
   * RESET
   * ============================================================
   */

  function resetFilter() {
    setSearch("");
    setOutletId("");
    setDateFrom("");
    setDateTo("");
    setTransactionType("");
    setUserId("");
  }

  const hasFilter = Boolean(
    search ||
      outletId ||
      dateFrom ||
      dateTo ||
      transactionType ||
      userId
  );

  const tableColSpan =
    role === "ADMIN" ? 13 : 12;

  /*
   * ============================================================
   * PDF EXPORT
   * ============================================================
   */

  function drawPdfHeader(
    doc: jsPDF,
    pageWidth: number
  ) {
    doc.setFillColor(49, 95, 82);
    doc.rect(0, 0, pageWidth, 23, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);

    doc.text(
      "HISTORY STOK OUTLET",
      10,
      10
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    doc.text(
      "MGB ERP • ALL STOCK MOVEMENT",
      10,
      16
    );

    doc.text(
      `Dicetak: ${new Date().toLocaleString(
        "id-ID"
      )}`,
      pageWidth - 10,
      13,
      {
        align: "right",
      }
    );
  }

  function drawPdfTableHeader(
    doc: jsPDF,
    y: number,
    pageWidth: number
  ) {
    const columns = role === "ADMIN"
      ? [
          ["No", 8],
          ["Tanggal", 22],
          ["Nomor", 27],
          ["Outlet", 27],
          ["Barang", 42],
          ["Arah", 20],
          ["Jenis", 30],
          ["Qty In", 22],
          ["Qty Out", 22],
          ["Saldo", 22],
          ["HPP", 27],
          ["Nilai", 30],
          ["User", 31],
        ]
      : [
          ["No", 8],
          ["Tanggal", 22],
          ["Nomor", 29],
          ["Barang", 46],
          ["Arah", 21],
          ["Jenis", 32],
          ["Qty In", 23],
          ["Qty Out", 23],
          ["Saldo", 23],
          ["HPP", 28],
          ["Nilai", 31],
          ["User", 38],
        ];

    const totalWidth = columns.reduce(
      (sum, [, width]) => sum + width,
      0
    );

    const scale =
      totalWidth > pageWidth - 20
        ? (pageWidth - 20) / totalWidth
        : 1;

    let x = 10;

    doc.setFillColor(239, 246, 242);
    doc.setDrawColor(205, 221, 214);

    doc.rect(
      10,
      y - 5,
      totalWidth * scale,
      9,
      "FD"
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(53, 86, 76);

    columns.forEach(([label, width]) => {
      const scaledWidth =
        Number(width) * scale;

      doc.text(
        sanitizePdfText(label),
        x + 1.5,
        y,
        {
          maxWidth:
            scaledWidth - 3,
        }
      );

      x += scaledWidth;
    });

    return {
      columns,
      scale,
      totalWidth:
        totalWidth * scale,
    };
  }

  function exportPdf() {
    if (filteredData.length === 0) {
      alert(
        "Tidak ada data yang dapat diexport ke PDF."
      );
      return;
    }

    try {
      setExporting(true);

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth =
        doc.internal.pageSize.getWidth();

      const pageHeight =
        doc.internal.pageSize.getHeight();

      const marginBottom = 12;

      let y = 31;

      drawPdfHeader(
        doc,
        pageWidth
      );

      /*
       * FILTER INFO
       */

      doc.setTextColor(90, 110, 101);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);

      const filterParts: string[] = [];

      if (dateFrom) {
        filterParts.push(
          `Dari ${dateFrom}`
        );
      }

      if (dateTo) {
        filterParts.push(
          `Sampai ${dateTo}`
        );
      }

      if (outletId) {
        const outlet = outlets.find(
          (item) =>
            String(item.id) ===
            outletId
        );

        if (outlet) {
          filterParts.push(
            `Outlet: ${outlet.code} - ${outlet.name}`
          );
        }
      }

      if (transactionType) {
        const type =
          transactionTypes.find(
            (item) =>
              item.value ===
              transactionType
          );

        if (type) {
          filterParts.push(
            `Jenis: ${type.label}`
          );
        }
      }

      if (userId) {
        const selectedUser =
          users.find(
            (item) =>
              String(item.id) ===
              userId
          );

        if (selectedUser) {
          filterParts.push(
            `User: ${selectedUser.fullname}`
          );
        }
      }

      if (search) {
        filterParts.push(
          `Pencarian: ${search}`
        );
      }

      const filterText =
        filterParts.length > 0
          ? `Filter: ${filterParts.join(
              " • "
            )}`
          : "Filter: Semua transaksi";

      doc.text(
        sanitizePdfText(filterText),
        10,
        y,
        {
          maxWidth: pageWidth - 20,
        }
      );

      y += 7;

      /*
       * SUMMARY PDF
       */

      doc.setFillColor(248, 251, 249);
      doc.setDrawColor(220, 232, 226);

      doc.roundedRect(
        10,
        y,
        pageWidth - 20,
        17,
        2,
        2,
        "FD"
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(53, 86, 76);

      doc.text(
        `TRANSAKSI: ${summary.transactions.toLocaleString(
          "id-ID"
        )}`,
        15,
        y + 7
      );

      doc.text(
        `QTY MASUK: +${formatNumber(
          summary.qtyIn
        )}`,
        67,
        y + 7
      );

      doc.text(
        `QTY KELUAR: -${formatNumber(
          summary.qtyOut
        )}`,
        120,
        y + 7
      );

      doc.text(
        `NILAI MASUK: ${sanitizePdfText(
          formatCurrency(summary.valueIn)
        )}`,
        180,
        y + 7
      );

      doc.text(
        `NILAI KELUAR: ${sanitizePdfText(
          formatCurrency(summary.valueOut)
        )}`,
        255,
        y + 7
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(120, 135, 128);

      doc.text(
        "History ini menampilkan transaksi yang tercatat sebagai pergerakan stok outlet.",
        15,
        y + 13
      );

      y += 25;

      let tableMeta =
        drawPdfTableHeader(
          doc,
          y,
          pageWidth
        );

      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);

      filteredData.forEach(
        (item, index) => {
          const isIn =
            item.direction === "IN";

          const outletText =
            item.outlet?.code ||
            item.outlet?.name ||
            `Outlet #${item.outletId}`;

          const userText =
            item.user?.fullname ||
            item.user?.username ||
            "-";

          const row = role === "ADMIN"
            ? [
                String(index + 1),
                formatDateForPdf(
                  item.trxDate
                ),
                item.trxNumber || "-",
                outletText,
                `${item.code || "-"} - ${
                  item.barang || "-"
                }`,
                isIn ? "MASUK" : "KELUAR",
                getTypeLabel(item),
                isIn
                  ? `+${formatNumber(
                      item.qtyIn
                    )}`
                  : "-",
                !isIn
                  ? `-${formatNumber(
                      item.qtyOut
                    )}`
                  : "-",
                formatNumber(
                  item.balance
                ),
                formatCurrency(
                  item.unitCost
                ),
                formatCurrency(
                  Math.abs(
                    Number(
                      item.totalCost || 0
                    )
                  )
                ),
                userText,
              ]
            : [
                String(index + 1),
                formatDateForPdf(
                  item.trxDate
                ),
                item.trxNumber || "-",
                `${item.code || "-"} - ${
                  item.barang || "-"
                }`,
                isIn ? "MASUK" : "KELUAR",
                getTypeLabel(item),
                isIn
                  ? `+${formatNumber(
                      item.qtyIn
                    )}`
                  : "-",
                !isIn
                  ? `-${formatNumber(
                      item.qtyOut
                    )}`
                  : "-",
                formatNumber(
                  item.balance
                ),
                formatCurrency(
                  item.unitCost
                ),
                formatCurrency(
                  Math.abs(
                    Number(
                      item.totalCost || 0
                    )
                  )
                ),
                userText,
              ];

          const rowHeight = 7;

          if (
            y + rowHeight >
            pageHeight - marginBottom
          ) {
            doc.addPage();

            y = 14;

            drawPdfHeader(
              doc,
              pageWidth
            );

            y = 30;

            tableMeta =
              drawPdfTableHeader(
                doc,
                y,
                pageWidth
              );

            y += 6;

            doc.setFont(
              "helvetica",
              "normal"
            );

            doc.setFontSize(6.5);
          }

          let x = 10;

          doc.setDrawColor(
            232,
            239,
            235
          );

          doc.setTextColor(
            75,
            90,
            84
          );

          row.forEach(
            (value, columnIndex) => {
              const width =
                Number(
                  tableMeta.columns[
                    columnIndex
                  ]?.[1] || 20
                ) *
                tableMeta.scale;

              let text =
                sanitizePdfText(
                  String(value)
                );

              if (
                text.length > 34
              ) {
                text =
                  text.slice(0, 31) +
                  "...";
              }

              const rightAligned =
                [
                  0,
                  7,
                  8,
                  9,
                  10,
                  11,
                ].includes(
                  columnIndex
                );

              if (
                role !== "ADMIN" &&
                [0, 6, 7, 8, 9, 10].includes(
                  columnIndex
                )
              ) {
                // numeric/right alignment
              }

              if (
                rightAligned
              ) {
                doc.text(
                  text,
                  x + width - 1.5,
                  y,
                  {
                    align: "right",
                    maxWidth:
                      width - 3,
                  }
                );
              } else {
                doc.text(
                  text,
                  x + 1.5,
                  y,
                  {
                    maxWidth:
                      width - 3,
                  }
                );
              }

              x += width;
            }
          );

          doc.setDrawColor(
            232,
            239,
            235
          );

          doc.line(
            10,
            y + 2.5,
            10 +
              tableMeta.totalWidth,
            y + 2.5
          );

          y += rowHeight;
        }
      );

      /*
       * FOOTER SETIAP HALAMAN
       */

      const totalPages =
        doc.getNumberOfPages();

      for (
        let page = 1;
        page <= totalPages;
        page++
      ) {
        doc.setPage(page);

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(6.5);

        doc.setTextColor(
          145,
          155,
          150
        );

        doc.text(
          "MGB ERP • History Stok Outlet",
          10,
          pageHeight - 6
        );

        doc.text(
          `Halaman ${page} / ${totalPages}`,
          pageWidth - 10,
          pageHeight - 6,
          {
            align: "right",
          }
        );
      }

      const outletSuffix =
        outletId
          ? `_Outlet-${outletId}`
          : "_Semua-Outlet";

      const dateSuffix =
        dateFrom || dateTo
          ? `_${dateFrom || "awal"}_${
              dateTo || "akhir"
            }`
          : "";

      const filename =
        `History-Stok-Outlet${outletSuffix}${dateSuffix}.pdf`;

      doc.save(filename);
    } catch (error) {
      console.error(
        "EXPORT HISTORY STOCK PDF ERROR:",
        error
      );

      alert(
        "Gagal membuat PDF history stok."
      );
    } finally {
      setExporting(false);
    }
  }

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="min-h-full bg-[#F4F7F5] p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1900px]">

        {/* ===================================================== */}
        {/* HEADER */}
        {/* ===================================================== */}

        <div className="mb-7 overflow-hidden rounded-3xl border border-[#DCE8E2] bg-white shadow-[0_8px_30px_rgba(24,53,45,0.06)]">

          <div className="relative overflow-hidden px-6 py-6 md:px-8 md:py-7">

            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#EAF3EF]" />

            <div className="pointer-events-none absolute -bottom-28 right-28 h-48 w-48 rounded-full bg-[#F4F8F6]" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-center gap-4">

                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#497F70] to-[#315F52] text-white shadow-lg shadow-[#497F70]/20">
                  <History
                    size={25}
                    strokeWidth={2.2}
                  />
                </div>

                <div>

                  <div className="flex flex-wrap items-center gap-2">

                    <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
                      History Stok Outlet
                    </h1>

                    <span className="rounded-full border border-[#CFE1D9] bg-[#F0F7F3] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#497F70]">
                      All Stock Movement
                    </span>

                  </div>

                  <p className="mt-1.5 max-w-4xl text-sm leading-6 text-gray-500">
                    Menampilkan seluruh transaksi yang menyebabkan
                    perubahan stok outlet, baik barang masuk maupun
                    barang keluar, lengkap dengan quantity, saldo,
                    HPP, nilai transaksi, jenis transaksi, dan user.
                  </p>

                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">

                <button
                  type="button"
                  onClick={exportPdf}
                  disabled={
                    loading ||
                    exporting ||
                    filteredData.length === 0
                  }
                  className="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#315F52] px-5 py-3 text-sm font-bold text-white shadow-md shadow-[#315F52]/15 transition hover:bg-[#274F44] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileDown
                    size={17}
                    className={
                      exporting
                        ? "animate-pulse"
                        : "transition group-hover:translate-y-0.5"
                    }
                  />

                  {exporting
                    ? "Membuat PDF..."
                    : "Export PDF"}
                </button>

                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  className="group inline-flex items-center justify-center gap-2.5 rounded-xl border border-[#D3E2DB] bg-white px-5 py-3 text-sm font-bold text-[#35564C] shadow-sm transition hover:border-[#497F70] hover:bg-[#F4F8F6] hover:text-[#315F52] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw
                    size={17}
                    className={`transition ${
                      loading
                        ? "animate-spin"
                        : "group-hover:rotate-180"
                    }`}
                  />
                  Refresh Data
                </button>

              </div>

            </div>

            {/* HEADER QUICK INFO */}

            <div className="relative mt-6 grid grid-cols-1 gap-3 border-t border-[#EDF2EF] pt-5 sm:grid-cols-2 xl:grid-cols-4">

              <QuickInfo
                icon={<Activity size={17} />}
                title="Total Transaksi"
                value={summary.transactions.toLocaleString("id-ID")}
              />

              <QuickInfo
                icon={<ArrowDownToLine size={17} />}
                title="Transaksi Masuk"
                value={filteredData.filter(
                  (item) =>
                    item.direction === "IN"
                ).length.toLocaleString("id-ID")}
              />

              <QuickInfo
                icon={<ArrowUpFromLine size={17} />}
                title="Transaksi Keluar"
                value={filteredData.filter(
                  (item) =>
                    item.direction === "OUT"
                ).length.toLocaleString("id-ID")}
              />

              <QuickInfo
                icon={<Boxes size={17} />}
                title="Saldo Pergerakan"
                value={formatNumber(
                  summary.qtyIn -
                    summary.qtyOut
                )}
              />

            </div>
          </div>
        </div>

        {/* ===================================================== */}
        {/* FILTER */}
        {/* ===================================================== */}

        <div className="mb-6 rounded-3xl border border-[#DCE8E2] bg-white p-5 shadow-[0_5px_20px_rgba(24,53,45,0.04)] md:p-6">

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <Filter size={18} />
              </div>

              <div>

                <h2 className="text-sm font-bold text-[#18352D]">
                  Filter & Pencarian
                </h2>

                <p className="mt-0.5 text-xs text-gray-400">
                  Filter berdasarkan periode, outlet, jenis
                  transaksi, user, atau kata kunci.
                </p>

              </div>
            </div>

            {hasFilter && (
              <button
                type="button"
                onClick={resetFilter}
                className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[#DCE8E2] bg-white px-3.5 py-2 text-xs font-bold text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:self-auto"
              >
                <RotateCcw size={14} />
                Reset Filter
              </button>
            )}

          </div>

          <div
            className={
              role === "ADMIN"
                ? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
                : "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
            }
          >

            {/* SEARCH */}

            <div className="relative">

              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Cari nomor, barang, jenis, user..."
                className="h-12 w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] pl-10 pr-4 text-sm font-medium text-[#18352D] outline-none transition placeholder:text-gray-400 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
              />

            </div>

            {/* OUTLET */}

            {role === "ADMIN" && (
              <div className="relative">

                <Building2
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <select
                  value={outletId}
                  onChange={(e) =>
                    setOutletId(e.target.value)
                  }
                  className="h-12 w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] pl-10 pr-10 text-sm font-medium text-[#18352D] outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                >
                  <option value="">
                    Semua Outlet
                  </option>

                  {outlets.map((outlet) => (
                    <option
                      key={outlet.id}
                      value={outlet.id}
                    >
                      {outlet.code} - {outlet.name}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

              </div>
            )}

            {/* DATE FROM */}

            <div className="relative">

              <CalendarDays
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) =>
                  setDateFrom(e.target.value)
                }
                className="h-12 w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] pl-10 pr-4 text-sm font-medium text-[#18352D] outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
              />

            </div>

            {/* DATE TO */}

            <div className="relative">

              <CalendarDays
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) =>
                  setDateTo(e.target.value)
                }
                className="h-12 w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] pl-10 pr-4 text-sm font-medium text-[#18352D] outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
              />

            </div>

            {/* TRANSACTION TYPE */}

            <div className="relative">

              <Activity
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <select
                value={transactionType}
                onChange={(e) =>
                  setTransactionType(
                    e.target.value
                  )
                }
                className="h-12 w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] pl-10 pr-10 text-sm font-medium text-[#18352D] outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
              >
                <option value="">
                  Semua Jenis Transaksi
                </option>

                {transactionTypes.map(
                  (item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  )
                )}
              </select>

              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />

            </div>

            {/* USER */}

            <div className="relative">

              <UserRound
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <select
                value={userId}
                onChange={(e) =>
                  setUserId(
                    e.target.value
                  )
                }
                className="h-12 w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] pl-10 pr-10 text-sm font-medium text-[#18352D] outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
              >
                <option value="">
                  Semua User
                </option>

                {users.map((user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {user.fullname}
                    {user.username
                      ? ` (@${user.username})`
                      : ""}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />

            </div>

          </div>

          {/* ACTIVE FILTER */}

          {hasFilter && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#EDF2EF] pt-4">

              <span className="text-xs font-semibold text-gray-400">
                Filter aktif:
              </span>

              {search && (
                <FilterBadge
                  label={`Pencarian: ${search}`}
                  onClear={() =>
                    setSearch("")
                  }
                />
              )}

              {outletId && (
                <FilterBadge
                  label={`Outlet: ${
                    outlets.find(
                      (item) =>
                        String(
                          item.id
                        ) === outletId
                    )?.code ||
                    outletId
                  }`}
                  onClear={() =>
                    setOutletId("")
                  }
                />
              )}

              {dateFrom && (
                <FilterBadge
                  label={`Dari: ${dateFrom}`}
                  onClear={() =>
                    setDateFrom("")
                  }
                />
              )}

              {dateTo && (
                <FilterBadge
                  label={`Sampai: ${dateTo}`}
                  onClear={() =>
                    setDateTo("")
                  }
                />
              )}

              {transactionType && (
                <FilterBadge
                  label={`Jenis: ${
                    transactionTypes.find(
                      (item) =>
                        item.value ===
                        transactionType
                    )?.label ||
                    transactionType
                  }`}
                  onClear={() =>
                    setTransactionType("")
                  }
                />
              )}

              {userId && (
                <FilterBadge
                  label={`User: ${
                    users.find(
                      (item) =>
                        String(
                          item.id
                        ) === userId
                    )?.fullname ||
                    userId
                  }`}
                  onClear={() =>
                    setUserId("")
                  }
                />
              )}

            </div>
          )}

        </div>

        {/* ===================================================== */}
        {/* OUTLET ADMIN INFO */}
        {/* ===================================================== */}

        {role === "OUTLET_ADMIN" &&
          outlets.length === 1 && (
            <div className="mb-6 overflow-hidden rounded-2xl border border-[#CFE1D9] bg-gradient-to-r from-[#F0F7F3] to-white shadow-sm">

              <div className="flex items-center gap-4 px-5 py-4">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
                  <Building2 size={19} />
                </div>

                <div>

                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#497F70]">
                    Outlet Anda
                  </p>

                  <p className="mt-0.5 font-bold text-[#18352D]">
                    {outlets[0].code} -{" "}
                    {outlets[0].name}
                  </p>

                  <p className="mt-0.5 text-xs text-gray-400">
                    Seluruh perubahan stok barang pada outlet ini
                  </p>

                </div>

              </div>
            </div>
          )}

        {/* ===================================================== */}
        {/* SUMMARY */}
        {/* ===================================================== */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <SummaryCard
            title="Total Barang Masuk"
            value={formatNumber(
              summary.qtyIn
            )}
            subtitle="Total quantity penambahan stok"
            icon={
              <ArrowDownToLine
                size={19}
              />
            }
            positive
          />

          <SummaryCard
            title="Total Barang Keluar"
            value={formatNumber(
              summary.qtyOut
            )}
            subtitle="Total quantity pengurangan stok"
            icon={
              <ArrowUpFromLine
                size={19}
              />
            }
            danger
          />

          <SummaryCard
            title="Nilai Stok Masuk"
            value={formatCurrency(
              summary.valueIn
            )}
            subtitle="Total nilai transaksi masuk"
            icon={
              <TrendingUp
                size={19}
              />
            }
            positive
          />

          <SummaryCard
            title="Nilai Stok Keluar"
            value={formatCurrency(
              summary.valueOut
            )}
            subtitle="Total nilai transaksi keluar"
            icon={
              <Wallet size={19} />
            }
            danger
          />

        </div>

        {/* ===================================================== */}
        {/* TABLE */}
        {/* ===================================================== */}

        <div className="overflow-hidden rounded-3xl border border-[#DCE8E2] bg-white shadow-[0_6px_25px_rgba(24,53,45,0.05)]">

          {/* TABLE HEADER */}

          <div className="flex flex-col gap-3 border-b border-[#E7EFEB] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <History size={18} />
              </div>

              <div>

                <h2 className="font-bold text-[#18352D]">
                  Semua Transaksi Stok Outlet
                </h2>

                <p className="text-xs text-gray-400">
                  Menampilkan{" "}
                  {filteredData.length.toLocaleString(
                    "id-ID"
                  )}{" "}
                  transaksi masuk dan keluar
                </p>

              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">

              <div className="rounded-full border border-[#DCE8E2] bg-[#F7FAF8] px-3 py-1.5 text-xs font-bold text-[#497F70]">
                {role === "ADMIN"
                  ? "ADMIN PUSAT"
                  : "OUTLET"}
              </div>

              <div className="rounded-full border border-[#DCE8E2] bg-white px-3 py-1.5 text-xs font-semibold text-gray-500">
                {filteredData.length.toLocaleString(
                  "id-ID"
                )}{" "}
                data
              </div>

            </div>

          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">

            <table className="min-w-[1750px] w-full text-sm">

              <thead>

                <tr className="border-b border-[#E4ECE8] bg-[#F7FAF8]">

                  <th className="w-16 px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#668078]">
                    No
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#668078]">
                    Nomor
                  </th>

                  {role === "ADMIN" && (
                    <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#668078]">
                      Outlet
                    </th>
                  )}

                  <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#668078]">
                    Tanggal
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#668078]">
                    Barang
                  </th>

                  <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-[#668078]">
                    Arah
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#668078]">
                    Jenis Transaksi
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#668078]">
                    Qty Masuk
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#668078]">
                    Qty Keluar
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#668078]">
                    Saldo
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#668078]">
                    HPP
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#668078]">
                    Nilai
                  </th>

                  <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#668078]">
                    User
                  </th>

                </tr>

              </thead>

              <tbody>

                {/* LOADING */}

                {loading ? (

                  <tr>

                    <td
                      colSpan={tableColSpan}
                      className="px-5 py-20 text-center"
                    >

                      <div className="flex flex-col items-center justify-center">

                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                          <RefreshCw
                            size={21}
                            className="animate-spin"
                          />
                        </div>

                        <p className="font-semibold text-[#35564C]">
                          Memuat history stok...
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          Mengambil seluruh transaksi stok outlet
                        </p>

                      </div>

                    </td>

                  </tr>

                ) : filteredData.length === 0 ? (

                  <tr>

                    <td
                      colSpan={tableColSpan}
                      className="px-5 py-20 text-center"
                    >

                      <div className="flex flex-col items-center">

                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                          <History size={27} />
                        </div>

                        <p className="font-bold text-[#35564C]">
                          Belum ada transaksi stok
                        </p>

                        <p className="mt-1 max-w-lg text-sm leading-6 text-gray-400">
                          Tidak ditemukan transaksi stok masuk atau
                          stok keluar yang sesuai dengan filter.
                        </p>

                        {hasFilter && (
                          <button
                            type="button"
                            onClick={resetFilter}
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#3C6E60]"
                          >
                            <RotateCcw size={14} />
                            Bersihkan Filter
                          </button>
                        )}

                      </div>

                    </td>

                  </tr>

                ) : (

                  filteredData.map(
                    (item, index) => {

                      const isIn =
                        item.direction ===
                        "IN";

                      return (
                        <tr
                          key={`${item.id}-${item.trxNumber}-${item.barangId}-${index}`}
                          className="group border-b border-[#EDF2EF] transition hover:bg-[#F8FBF9]"
                        >

                          {/* NO */}

                          <td className="px-5 py-4 text-xs font-semibold text-gray-400">
                            {index + 1}
                          </td>

                          {/* NUMBER */}

                          <td className="px-5 py-4">

                            <div className="font-bold text-[#18352D]">
                              {item.trxNumber ||
                                "-"}
                            </div>

                            <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                              {item.source
                                ? item.source.replaceAll(
                                    "_",
                                    " "
                                  )
                                : "STOCK LEDGER"}
                            </div>

                            {item.note && (
                              <div
                                className="mt-1 max-w-[220px] truncate text-[10px] text-gray-400"
                                title={item.note}
                              >
                                {item.note}
                              </div>
                            )}

                          </td>

                          {/* OUTLET */}

                          {role === "ADMIN" && (
                            <td className="px-5 py-4">

                              <div className="flex items-center gap-2.5">

                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                                  <Building2
                                    size={14}
                                  />
                                </div>

                                <div>

                                  <div className="font-semibold text-[#35564C]">
                                    {item.outlet
                                      ?.code ||
                                      item.outlet
                                        ?.name ||
                                      "-"}
                                  </div>

                                  <div className="mt-0.5 text-[10px] text-gray-400">
                                    Outlet #
                                    {
                                      item.outletId
                                    }
                                  </div>

                                </div>

                              </div>

                            </td>
                          )}

                          {/* DATE */}

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-2">

                              <CalendarDays
                                size={14}
                                className="shrink-0 text-[#8AA39A]"
                              />

                              <div>

                                <div className="font-medium text-gray-600">
                                  {formatDate(
                                    item.trxDate
                                  )}
                                </div>

                                <div className="mt-0.5 text-[10px] text-gray-400">
                                  {formatDateTime(
                                    item.trxDate
                                  )
                                    .split(
                                      " "
                                    )
                                    .slice(
                                      -1
                                    )[0] ||
                                    ""}
                                </div>

                              </div>

                            </div>

                          </td>

                          {/* BARANG */}

                          <td className="px-5 py-4">

                            <div className="flex items-start gap-3">

                              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F5F2] text-[#497F70]">
                                <Package
                                  size={16}
                                />
                              </div>

                              <div className="min-w-0">

                                <div className="font-bold text-[#18352D]">
                                  {item.barang ||
                                    "-"}
                                </div>

                                <div className="mt-1 text-xs text-gray-400">
                                  {item.code ||
                                    "-"}

                                  <span className="mx-1.5">
                                    •
                                  </span>

                                  {item.unit ||
                                    "-"}
                                </div>

                              </div>

                            </div>

                          </td>

                          {/* DIRECTION */}

                          <td className="px-5 py-4 text-center">

                            <span
                              className={`inline-flex min-w-[92px] items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-[10px] font-extrabold uppercase tracking-wide ${
                                isIn
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-red-200 bg-red-50 text-red-600"
                              }`}
                            >

                              {isIn ? (
                                <ArrowDownToLine
                                  size={13}
                                />
                              ) : (
                                <ArrowUpFromLine
                                  size={13}
                                />
                              )}

                              {isIn
                                ? "MASUK"
                                : "KELUAR"}

                            </span>

                          </td>

                          {/* TYPE */}

                          <td className="px-5 py-4">

                            <div
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${
                                isIn
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-orange-200 bg-orange-50 text-orange-700"
                              }`}
                            >

                              {isIn ? (
                                <ArrowUpRight
                                  size={13}
                                />
                              ) : (
                                <ArrowDownRight
                                  size={13}
                                />
                              )}

                              {getTypeLabel(
                                item
                              )}

                            </div>

                          </td>

                          {/* QTY IN */}

                          <td className="px-5 py-4 text-right">

                            <div
                              className={`font-extrabold ${
                                isIn
                                  ? "text-emerald-600"
                                  : "text-gray-300"
                              }`}
                            >
                              {isIn
                                ? `+${formatNumber(
                                    item.qtyIn
                                  )}`
                                : "—"}
                            </div>

                            <div className="mt-1 text-[10px] text-gray-400">
                              {item.unit ||
                                "base unit"}
                            </div>

                          </td>

                          {/* QTY OUT */}

                          <td className="px-5 py-4 text-right">

                            <div
                              className={`font-extrabold ${
                                !isIn
                                  ? "text-red-600"
                                  : "text-gray-300"
                              }`}
                            >
                              {!isIn
                                ? `-${formatNumber(
                                    item.qtyOut
                                  )}`
                                : "—"}
                            </div>

                            <div className="mt-1 text-[10px] text-gray-400">
                              {item.unit ||
                                "base unit"}
                            </div>

                          </td>

                          {/* BALANCE */}

                          <td className="px-5 py-4 text-right">

                            <div className="inline-flex min-w-[100px] justify-end">

                              <span className="rounded-lg border border-[#DCE8E2] bg-[#F7FAF8] px-2.5 py-1.5 font-extrabold text-[#18352D]">
                                {formatNumber(
                                  item.balance
                                )}
                              </span>

                            </div>

                            <div className="mt-1 text-[10px] text-gray-400">
                              {item.unit ||
                                "base unit"}
                            </div>

                          </td>

                          {/* HPP */}

                          <td className="px-5 py-4 text-right">

                            <div className="font-semibold text-gray-600">
                              {formatCurrency(
                                item.unitCost
                              )}
                            </div>

                            <div className="mt-1 text-[10px] text-gray-400">
                              /{" "}
                              {item.unit ||
                                "unit"}
                            </div>

                          </td>

                          {/* VALUE */}

                          <td className="px-5 py-4 text-right">

                            <div
                              className={`font-extrabold ${
                                isIn
                                  ? "text-emerald-700"
                                  : "text-[#18352D]"
                              }`}
                            >
                              {formatCurrency(
                                Math.abs(
                                  Number(
                                    item.totalCost ||
                                      0
                                  )
                                )
                              )}
                            </div>

                            <div className="mt-1 text-[10px] text-gray-400">
                              nilai transaksi
                            </div>

                          </td>

                          {/* USER */}

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-2.5">

                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DDEBE5] text-[11px] font-bold text-[#497F70]">
                                {item.user
                                  ?.fullname
                                  ? item.user.fullname
                                      .trim()
                                      .charAt(
                                        0
                                      )
                                      .toUpperCase()
                                  : "?"}
                              </div>

                              <div className="min-w-0">

                                <div className="max-w-[150px] truncate font-semibold text-gray-700">
                                  {item.user
                                    ?.fullname ||
                                    "-"}
                                </div>

                                {item.user
                                  ?.username && (
                                  <div className="max-w-[150px] truncate text-[10px] text-gray-400">
                                    @
                                    {
                                      item
                                        .user
                                        .username
                                    }
                                  </div>
                                )}

                              </div>

                            </div>

                          </td>

                        </tr>
                      );
                    }
                  )
                )}

              </tbody>

            </table>

          </div>

          {/* ===================================================== */}
          {/* FOOTER */}
          {/* ===================================================== */}

          {!loading &&
            filteredData.length > 0 && (
              <div className="flex flex-col gap-4 border-t border-[#E7EFEB] bg-[#FAFCFB] px-5 py-4 text-xs md:px-6">

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">

                    <p className="text-gray-500">
                      Menampilkan{" "}
                      <span className="font-bold text-[#35564C]">
                        {filteredData.length.toLocaleString(
                          "id-ID"
                        )}
                      </span>{" "}
                      transaksi
                    </p>

                    <div className="hidden h-3 w-px bg-[#DCE8E2] sm:block" />

                    <p className="text-gray-500">
                      Masuk:{" "}
                      <span className="font-bold text-emerald-600">
                        +{formatNumber(
                          summary.qtyIn
                        )}
                      </span>
                    </p>

                    <p className="text-gray-500">
                      Keluar:{" "}
                      <span className="font-bold text-red-600">
                        -{formatNumber(
                          summary.qtyOut
                        )}
                      </span>
                    </p>

                    <p className="text-gray-500">
                      Selisih:{" "}
                      <span
                        className={`font-bold ${
                          summary.qtyIn -
                            summary.qtyOut <
                          0
                            ? "text-red-600"
                            : "text-[#35564C]"
                        }`}
                      >
                        {summary.qtyIn -
                          summary.qtyOut >=
                        0
                          ? "+"
                          : ""}
                        {formatNumber(
                          summary.qtyIn -
                            summary.qtyOut
                        )}
                      </span>
                    </p>

                  </div>

                  <div className="flex flex-wrap items-center gap-4">

                    <div className="flex items-center gap-2 text-gray-400">

                      <span>
                        Nilai Masuk:
                      </span>

                      <span className="font-bold text-emerald-700">
                        {formatCurrency(
                          summary.valueIn
                        )}
                      </span>

                    </div>

                    <div className="hidden h-3 w-px bg-[#DCE8E2] sm:block" />

                    <div className="flex items-center gap-2 text-gray-400">

                      <span>
                        Nilai Keluar:
                      </span>

                      <span className="font-bold text-[#18352D]">
                        {formatCurrency(
                          summary.valueOut
                        )}
                      </span>

                    </div>

                    <div className="hidden h-3 w-px bg-[#DCE8E2] sm:block" />

                    <button
                      type="button"
                      onClick={exportPdf}
                      disabled={
                        exporting
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-[#315F52] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#274F44] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FileDown
                        size={14}
                      />
                      {exporting
                        ? "Export..."
                        : "Export PDF"}
                    </button>

                  </div>

                </div>

              </div>
            )}

        </div>

      </div>
    </div>
  );
}

/* ============================================================
   FILTER BADGE
============================================================ */

function FilterBadge({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CFE1D9] bg-[#EAF3EF] px-3 py-1.5 text-xs font-semibold text-[#497F70]">

      <span className="max-w-[280px] truncate">
        {label}
      </span>

      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-0.5 transition hover:bg-white hover:text-red-600"
        title="Hapus filter"
      >
        <X size={12} />
      </button>

    </span>
  );
}

/* ============================================================
   QUICK INFO
============================================================ */

function QuickInfo({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#E3ECE7] bg-[#FAFCFB] px-4 py-3">

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
        {icon}
      </div>

      <div className="min-w-0">

        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {title}
        </p>

        <p className="mt-0.5 truncate text-sm font-extrabold text-[#18352D]">
          {value}
        </p>

      </div>

    </div>
  );
}

/* ============================================================
   SUMMARY CARD
============================================================ */

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  danger = false,
  positive = false,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  danger?: boolean;
  positive?: boolean;
}) {
  const iconClass = danger
    ? "bg-red-50 text-red-600"
    : positive
    ? "bg-[#EAF3EF] text-[#497F70]"
    : "bg-[#EEF5F1] text-[#497F70]";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#DCE8E2] bg-white p-5 shadow-[0_5px_18px_rgba(24,53,45,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(24,53,45,0.08)]">

      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#F7FAF8] transition group-hover:scale-125" />

      <div className="relative">

        <div className="flex items-start justify-between gap-3">

          <div>

            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">
              {title}
            </p>

            <p
              className={`mt-2 text-2xl font-extrabold tracking-tight ${
                danger
                  ? "text-red-600"
                  : positive
                  ? "text-emerald-700"
                  : "text-[#18352D]"
              }`}
            >
              {value}
            </p>

          </div>

          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
          >
            {icon}
          </div>

        </div>

        <p className="mt-3 text-xs font-medium text-gray-400">
          {subtitle}
        </p>

      </div>
    </div>
  );
}