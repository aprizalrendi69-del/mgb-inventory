"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  Building2,
  CalendarDays,
  CircleDollarSign,
  FileDown,
  FileText,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Truck,
  Users,
  X,
  Hash,
  Receipt,
  Clock3,
  Boxes,
  MapPin,
  Warehouse,
} from "lucide-react";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { COMPANY } from "@/lib/company";

/*
============================================================
TYPE
============================================================
*/

type SourceType =
  | "PURCHASE_SUPPLIER"
  | "WAREHOUSE_TO_OUTLET"
  | "OUTLET_TO_OUTLET";

type SourceFilter = "ALL" | SourceType;

type StatusFilter =
  | "ALL"
  | "RECEIVED"
  | "PARTIAL"
  | "SENT"
  | "DELIVERED"
  | "DRAFT"
  | "VOID";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Supplier = {
  id: number;
  code: string;
  name: string;
};

type BarangItem = {
  barangId: number;
  code: string;
  barcode: string | null;
  name: string;
  category: string | null;
  brand: string | null;
  unit: string;
  baseUnit: string | null;
  conversionRate: number;
  qty: number;
  receivedQty: number;
  price: number;
  subtotal: number;
};

type ReportRow = {
  id: string;
  source: SourceType;
  documentNumber: string;
  date: string;

  outletId: number | null;
  outlet: Outlet | null;

  sourceOutletId: number | null;
  sourceOutlet: Outlet | null;

  supplier: Supplier | null;

  invoiceNumber: string | null;
  suratJalanNumber: string | null;

  status: string;
  remarks: string | null;
  receivedAt: string | null;

  items: BarangItem[];

  totalItem: number;
  totalQty: number;
  totalReceivedQty: number;
  totalValue: number;
};

type ReportResponse = {
  success: boolean;
  message?: string;

  filters?: {
    dateFrom: string | null;
    dateTo: string | null;
    outletId: number | null;
    source: string;
    status: string;
  };

  summary?: {
    totalTransaction: number;
    totalItem: number;
    totalQty: number;
    totalReceivedQty: number;
    totalValue: number;

    purchaseSupplier: number;
    warehouseToOutlet: number;
    outletToOutlet: number;

    received: number;
    partial: number;
    waiting: number;
    void: number;
  };

  data?: ReportRow[];

  meta?: {
    total: number;
    generatedAt: string;
    role: string;
    outletId: number | null;
  };
};

/*
============================================================
HELPERS
============================================================
*/

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDate(
  value: string | null | undefined,
) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(
  value: string | null | undefined,
) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getSourceLabel(source: SourceType) {
  switch (source) {
    case "PURCHASE_SUPPLIER":
      return "Purchase Supplier";

    case "WAREHOUSE_TO_OUTLET":
      return "Gudang / Pusat";

    case "OUTLET_TO_OUTLET":
      return "Transfer Antar Outlet";

    default:
      return source;
  }
}

function getSourceShortLabel(source: SourceType) {
  switch (source) {
    case "PURCHASE_SUPPLIER":
      return "Purchase";

    case "WAREHOUSE_TO_OUTLET":
      return "Gudang/Pusat";

    case "OUTLET_TO_OUTLET":
      return "Transfer";

    default:
      return "-";
  }
}

function getStatusLabel(status: string) {
  switch (String(status).toUpperCase()) {
    case "RECEIVED":
      return "Diterima";

    case "DELIVERED":
      return "Terkirim";

    case "PARTIAL":
      return "Sebagian";

    case "SENT":
      return "Dikirim";

    case "APPROVED":
      return "Disetujui";

    case "DRAFT":
      return "Draft";

    case "VOID":
      return "Void";

    default:
      return status || "-";
  }
}

function getStatusClass(status: string) {
  switch (String(status).toUpperCase()) {
    case "RECEIVED":
    case "DELIVERED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "PARTIAL":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "SENT":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "APPROVED":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";

    case "VOID":
      return "border-red-200 bg-red-50 text-red-700";

    case "DRAFT":
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getSourceName(row: ReportRow) {
  if (row.source === "PURCHASE_SUPPLIER") {
    return row.supplier
      ? `${row.supplier.code} - ${row.supplier.name}`
      : "-";
  }

  if (row.source === "WAREHOUSE_TO_OUTLET") {
    return "Gudang / Pusat";
  }

  return row.sourceOutlet
    ? `${row.sourceOutlet.code} - ${row.sourceOutlet.name}`
    : "-";
}

function getOutletName(row: ReportRow) {
  return row.outlet
    ? `${row.outlet.code} - ${row.outlet.name}`
    : "-";
}

/*
============================================================
PAGE
============================================================
*/

export default function LaporanBarangMasukOutletPage() {
  const [role, setRole] = useState("");
  const [userOutletId, setUserOutletId] =
    useState<number | null>(null);

  const [data, setData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedOutlet, setSelectedOutlet] =
    useState("ALL");

  const [selectedSupplier, setSelectedSupplier] =
    useState("ALL");

  const [selectedSource, setSelectedSource] =
    useState<SourceFilter>("ALL");

  const [selectedStatus, setSelectedStatus] =
    useState<StatusFilter>("ALL");

  const [search, setSearch] = useState("");

  const [selectedRow, setSelectedRow] =
    useState<ReportRow | null>(null);

  const [exporting, setExporting] = useState(false);

  /*
  ==========================================================
  LOAD REPORT
  ==========================================================
  */

  async function loadReport() {
    try {
      setLoading(true);
      setError("");

      const meResponse = await fetch("/api/me", {
        cache: "no-store",
      });

      if (!meResponse.ok) {
        throw new Error(
          "Gagal mengambil informasi user.",
        );
      }

      const meJson = await meResponse.json();

      const currentUser =
        meJson?.user ??
        meJson?.data ??
        meJson;

      const currentRole =
        currentUser?.role ?? "";

      const currentOutletId =
        currentUser?.outletId != null
          ? Number(currentUser.outletId)
          : null;

      setRole(currentRole);
      setUserOutletId(currentOutletId);

      const params = new URLSearchParams();

      if (dateFrom) {
        params.set("dateFrom", dateFrom);
      }

      if (dateTo) {
        params.set("dateTo", dateTo);
      }

      const isOutletAdmin =
        currentRole === "OUTLET_ADMIN" ||
        currentRole === "ADMIN_OUTLET";

      if (isOutletAdmin) {
        if (currentOutletId != null) {
          params.set(
            "outletId",
            String(currentOutletId),
          );
        }
      } else if (selectedOutlet !== "ALL") {
        params.set(
          "outletId",
          selectedOutlet,
        );
      }

      if (selectedSource !== "ALL") {
        params.set(
          "source",
          selectedSource,
        );
      }

      if (selectedStatus !== "ALL") {
        params.set(
          "status",
          selectedStatus,
        );
      }

      const response = await fetch(
        `/api/outlet/laporan/barang-masuk${
          params.toString()
            ? `?${params.toString()}`
            : ""
        }`,
        {
          cache: "no-store",
        },
      );

      const json: ReportResponse =
        await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil laporan barang masuk.",
        );
      }

      setData(json.data ?? []);
    } catch (err) {
      console.error(
        "LOAD LAPORAN BARANG MASUK ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil laporan.",
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleApplyFilter() {
    await loadReport();
  }

  function resetFilter() {
    setDateFrom("");
    setDateTo("");
    setSelectedOutlet("ALL");
    setSelectedSupplier("ALL");
    setSelectedSource("ALL");
    setSelectedStatus("ALL");
    setSearch("");
    setSelectedRow(null);

    setTimeout(() => {
      window.location.reload();
    }, 0);
  }

  /*
  ==========================================================
  OUTLET OPTIONS
  ==========================================================
  */

  const outletOptions = useMemo(() => {
    const map = new Map<number, Outlet>();

    for (const row of data) {
      if (row.outlet) {
        map.set(row.outlet.id, row.outlet);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        a.name.localeCompare(b.name),
    );
  }, [data]);

  /*
  ==========================================================
  SUPPLIER OPTIONS
  ==========================================================
  */

  const supplierOptions = useMemo(() => {
    const map = new Map<number, Supplier>();

    for (const row of data) {
      if (
        row.source === "PURCHASE_SUPPLIER" &&
        row.supplier
      ) {
        map.set(
          row.supplier.id,
          row.supplier,
        );
      }
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        a.name.localeCompare(b.name),
    );
  }, [data]);

  /*
  ==========================================================
  SEARCH + SUPPLIER FILTER
  ==========================================================
  */

  const filteredData = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    return data.filter((row) => {
      if (
        selectedSupplier !== "ALL" &&
        String(row.supplier?.id ?? "") !==
          selectedSupplier
      ) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchable = [
        row.documentNumber,
        row.invoiceNumber,
        row.suratJalanNumber,
        row.status,
        getSourceLabel(row.source),
        row.supplier?.code,
        row.supplier?.name,
        row.sourceOutlet?.code,
        row.sourceOutlet?.name,
        row.outlet?.code,
        row.outlet?.name,
        row.remarks,

        ...row.items.flatMap((item) => [
          item.code,
          item.barcode,
          item.name,
          item.category,
          item.brand,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(keyword);
    });
  }, [
    data,
    search,
    selectedSupplier,
  ]);

  /*
  ==========================================================
  INVOICE SUPPLIER TABLE DATA
  ==========================================================
  */

  const supplierInvoiceRows = useMemo(() => {
    return filteredData
      .filter(
        (row) =>
          row.source ===
            "PURCHASE_SUPPLIER" &&
          Boolean(
            row.invoiceNumber?.trim(),
          ),
      )
      .sort((a, b) => {
        const dateA = new Date(
          a.date,
        ).getTime();

        const dateB = new Date(
          b.date,
        ).getTime();

        return dateB - dateA;
      });
  }, [filteredData]);

  const supplierInvoiceSummary =
    useMemo(() => {
      return {
        count: supplierInvoiceRows.length,

        totalItem:
          supplierInvoiceRows.reduce(
            (sum, row) =>
              sum +
              Number(row.totalItem || 0),
            0,
          ),

        totalQty:
          supplierInvoiceRows.reduce(
            (sum, row) =>
              sum +
              Number(row.totalQty || 0),
            0,
          ),

        totalReceived:
          supplierInvoiceRows.reduce(
            (sum, row) =>
              sum +
              Number(
                row.totalReceivedQty || 0,
              ),
            0,
          ),

        totalValue:
          supplierInvoiceRows.reduce(
            (sum, row) =>
              sum +
              Number(row.totalValue || 0),
            0,
          ),
      };
    }, [supplierInvoiceRows]);

  /*
  ==========================================================
  SUMMARY
  ==========================================================
  */

  const summary = useMemo(() => {
    return {
      totalTransaction:
        filteredData.length,

      totalItem:
        filteredData.reduce(
          (sum, row) =>
            sum +
            Number(row.totalItem || 0),
          0,
        ),

      totalQty:
        filteredData.reduce(
          (sum, row) =>
            sum +
            Number(row.totalQty || 0),
          0,
        ),

      totalReceivedQty:
        filteredData.reduce(
          (sum, row) =>
            sum +
            Number(
              row.totalReceivedQty || 0,
            ),
          0,
        ),

      totalValue:
        filteredData.reduce(
          (sum, row) =>
            sum +
            Number(row.totalValue || 0),
          0,
        ),

      purchaseSupplier:
        filteredData.filter(
          (row) =>
            row.source ===
            "PURCHASE_SUPPLIER",
        ).length,

      warehouseToOutlet:
        filteredData.filter(
          (row) =>
            row.source ===
            "WAREHOUSE_TO_OUTLET",
        ).length,

      outletToOutlet:
        filteredData.filter(
          (row) =>
            row.source ===
            "OUTLET_TO_OUTLET",
        ).length,

      received:
        filteredData.filter(
          (row) =>
            row.status === "RECEIVED" ||
            row.status === "DELIVERED",
        ).length,

      partial:
        filteredData.filter(
          (row) =>
            row.status === "PARTIAL",
        ).length,

      waiting:
        filteredData.filter(
          (row) =>
            row.status === "SENT" ||
            row.status === "DRAFT",
        ).length,

      void:
        filteredData.filter(
          (row) =>
            row.status === "VOID",
        ).length,
    };
  }, [filteredData]);

  /*
  ==========================================================
  DETAIL ESCAPE
  ==========================================================
  */

  useEffect(() => {
    if (!selectedRow) return;

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setSelectedRow(null);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [selectedRow]);

  /*
  ==========================================================
  SOURCE ICON
  ==========================================================
  */

  function SourceIcon({
    source,
  }: {
    source: SourceType;
  }) {
    if (
      source ===
      "PURCHASE_SUPPLIER"
    ) {
      return <Users size={15} />;
    }

    if (
      source ===
      "WAREHOUSE_TO_OUTLET"
    ) {
      return <Truck size={15} />;
    }

    return (
      <ArrowDownToLine size={15} />
    );
  }

  /*
  ==========================================================
  EXPORT PDF
  ==========================================================
  */

  async function exportPDF() {
    try {
      if (filteredData.length === 0) {
        alert(
          "Tidak ada data yang dapat diexport.",
        );
        return;
      }

      setExporting(true);

      const doc = new jsPDF(
        "l",
        "mm",
        "a4",
      );

      const pageWidth =
        doc.internal.pageSize.getWidth();

      const pageHeight =
        doc.internal.pageSize.getHeight();

      const marginLeft = 8;
      const marginRight = 8;

      const usableWidth =
        pageWidth -
        marginLeft -
        marginRight;

      const generatedAt = new Date();

      const companyName = String(
        (COMPANY as any)?.name ?? "",
      );

      const companyAddress = String(
        (COMPANY as any)?.address ?? "",
      );

      const companyPhone = String(
        (COMPANY as any)?.phone ?? "",
      );

      let filterText =
        "Sumber: Semua";

      if (selectedSource !== "ALL") {
        filterText =
          `Sumber: ${getSourceLabel(
            selectedSource,
          )}`;
      }

      if (dateFrom || dateTo) {
        filterText +=
          `  |  Periode: ${
            dateFrom || "Awal"
          } s/d ${
            dateTo || "Akhir"
          }`;
      }

      if (selectedOutlet !== "ALL") {
        const outlet =
          outletOptions.find(
            (item) =>
              String(item.id) ===
              selectedOutlet,
          );

        if (outlet) {
          filterText +=
            `  |  Outlet: ${outlet.code} - ${outlet.name}`;
        }
      }

      if (selectedSupplier !== "ALL") {
        const supplier =
          supplierOptions.find(
            (item) =>
              String(item.id) ===
              selectedSupplier,
          );

        if (supplier) {
          filterText +=
            `  |  Supplier: ${supplier.code} - ${supplier.name}`;
        }
      }

      if (selectedStatus !== "ALL") {
        filterText +=
          `  |  Status: ${getStatusLabel(
            selectedStatus,
          )}`;
      }

      if (search.trim()) {
        filterText +=
          `  |  Pencarian: "${search.trim()}"`;
      }

      const drawPdfHeader = () => {
        doc.setFillColor(
          248,
          250,
          252,
        );

        doc.rect(
          0,
          0,
          pageWidth,
          31,
          "F",
        );

        doc.setFillColor(
          15,
          23,
          42,
        );

        doc.rect(
          0,
          0,
          pageWidth,
          2,
          "F",
        );

        doc.setFont(
          "helvetica",
          "bold",
        );

        doc.setFontSize(17);
        doc.setTextColor(
          15,
          23,
          42,
        );

        doc.text(
          "MGB",
          marginLeft,
          11,
        );

        doc.setFontSize(7);

        if (companyName) {
          doc.text(
            companyName,
            marginLeft,
            16,
          );
        }

        doc.setFont(
          "helvetica",
          "normal",
        );

        doc.setFontSize(6.2);

        doc.setTextColor(
          100,
          116,
          139,
        );

        let companyY = 19;

        if (companyAddress) {
          doc.text(
            companyAddress,
            marginLeft,
            companyY,
          );

          companyY += 3;
        }

        if (companyPhone) {
          doc.text(
            `Telp: ${companyPhone}`,
            marginLeft,
            companyY,
          );
        }

        doc.setFont(
          "helvetica",
          "bold",
        );

        doc.setFontSize(13);

        doc.setTextColor(
          15,
          23,
          42,
        );

        doc.text(
          "LAPORAN BARANG MASUK OUTLET",
          pageWidth / 2,
          11,
          {
            align: "center",
          },
        );

        doc.setFont(
          "helvetica",
          "normal",
        );

        doc.setFontSize(6.5);

        doc.setTextColor(
          100,
          116,
          139,
        );

        doc.text(
          `Dicetak ${formatDateTime(
            generatedAt.toISOString(),
          )}`,
          pageWidth -
            marginRight,
          10.5,
          {
            align: "right",
          },
        );

        doc.text(
          filterText,
          marginLeft,
          28,
        );
      };

      drawPdfHeader();

      const summaryY = 34;
      const summaryGap = 3;

      const summaryBoxWidth =
        (usableWidth -
          summaryGap * 4) /
        5;

      const summaryBoxHeight = 12;

      const summaryBoxes = [
        {
          label: "TRANSAKSI",
          value: formatNumber(
            summary.totalTransaction,
          ),
        },
        {
          label: "ITEM",
          value: formatNumber(
            summary.totalItem,
          ),
        },
        {
          label: "QTY",
          value: formatNumber(
            summary.totalQty,
          ),
        },
        {
          label: "DITERIMA",
          value: formatNumber(
            summary.totalReceivedQty,
          ),
        },
        {
          label: "TOTAL NILAI",
          value: formatCurrency(
            summary.totalValue,
          ),
        },
      ];

      summaryBoxes.forEach(
        (box, index) => {
          const x =
            marginLeft +
            index *
              (summaryBoxWidth +
                summaryGap);

          doc.setFillColor(
            255,
            255,
            255,
          );

          doc.setDrawColor(
            226,
            232,
            240,
          );

          doc.roundedRect(
            x,
            summaryY,
            summaryBoxWidth,
            summaryBoxHeight,
            2,
            2,
            "FD",
          );

          doc.setFont(
            "helvetica",
            "bold",
          );

          doc.setFontSize(5.5);

          doc.setTextColor(
            100,
            116,
            139,
          );

          doc.text(
            box.label,
            x + 3,
            summaryY + 4,
          );

          doc.setFontSize(7.2);

          doc.setTextColor(
            15,
            23,
            42,
          );

          doc.text(
            box.value,
            x + 3,
            summaryY + 9,
          );
        },
      );

      const tableBody: any[] = [];

      let nomor = 1;

      for (const row of filteredData) {
        const asal = getSourceName(row);
        const tujuan =
          getOutletName(row);

        const invoiceSupplier =
          row.source ===
          "PURCHASE_SUPPLIER"
            ? row.invoiceNumber ||
              "-"
            : "-";

        if (
          !row.items ||
          row.items.length === 0
        ) {
          tableBody.push([
            nomor,
            formatDate(row.date),
            row.documentNumber,
            invoiceSupplier,
            getSourceShortLabel(
              row.source,
            ),
            asal,
            tujuan,
            "-",
            "Tidak ada detail barang",
            "-",
            "-",
            "-",
            "-",
            getStatusLabel(
              row.status,
            ),
          ]);

          nomor++;
          continue;
        }

        for (const item of row.items) {
          tableBody.push([
            nomor,
            formatDate(row.date),
            row.documentNumber,
            invoiceSupplier,
            getSourceShortLabel(
              row.source,
            ),
            asal,
            tujuan,
            item.code || "-",
            item.name || "-",
            formatNumber(item.qty),
            formatNumber(
              item.receivedQty,
            ),
            formatCurrency(
              item.price,
            ),
            formatCurrency(
              item.subtotal,
            ),
            getStatusLabel(
              row.status,
            ),
          ]);

          nomor++;
        }
      }

      const columnWidths = {
        no: 7,
        date: 18,
        document: 24,
        invoice: 27,
        source: 19,
        asal: 30,
        tujuan: 30,
        kode: 17,
        barang: 40,
        qty: 12,
        received: 14,
        price: 24,
        subtotal: 25,
        status: 18,
      };

      const totalColumnWidth =
        Object.values(
          columnWidths,
        ).reduce(
          (sum, value) =>
            sum + value,
          0,
        );

      const widthScale =
        totalColumnWidth >
        usableWidth
          ? usableWidth /
            totalColumnWidth
          : 1;

      const scaled = (
        value: number,
      ) =>
        Number(
          (
            value *
            widthScale
          ).toFixed(3),
        );

      autoTable(doc, {
        startY: 50,

        margin: {
          left: marginLeft,
          right: marginRight,
          top: 48,
          bottom: 13,
        },

        tableWidth: usableWidth,

        head: [
          [
            "#",
            "Tanggal",
            "Dokumen",
            "Invoice Supplier",
            "Sumber",
            "Asal",
            "Outlet Tujuan",
            "Kode",
            "Barang",
            "Qty",
            "Diterima",
            "Harga",
            "Subtotal",
            "Status",
          ],
        ],

        body: tableBody,

        theme: "grid",

        styles: {
          font: "helvetica",
          fontSize: 5.8,
          cellPadding: {
            top: 1.5,
            right: 1.25,
            bottom: 1.5,
            left: 1.25,
          },
          overflow: "linebreak",
          valign: "middle",
          lineColor: [
            226,
            232,
            240,
          ],
          lineWidth: 0.15,
          textColor: [
            51,
            65,
            85,
          ],
        },

        headStyles: {
          fillColor: [
            15,
            23,
            42,
          ],
          textColor: [
            255,
            255,
            255,
          ],
          fontStyle: "bold",
          fontSize: 5.8,
          halign: "center",
          valign: "middle",
          cellPadding: {
            top: 2.2,
            right: 1.4,
            bottom: 2.2,
            left: 1.4,
          },
        },

        alternateRowStyles: {
          fillColor: [
            248,
            250,
            252,
          ],
        },

        columnStyles: {
          0: {
            cellWidth: scaled(
              columnWidths.no,
            ),
            halign: "center",
          },
          1: {
            cellWidth: scaled(
              columnWidths.date,
            ),
            halign: "center",
          },
          2: {
            cellWidth: scaled(
              columnWidths.document,
            ),
          },
          3: {
            cellWidth: scaled(
              columnWidths.invoice,
            ),
            fontStyle: "bold",
          },
          4: {
            cellWidth: scaled(
              columnWidths.source,
            ),
            halign: "center",
          },
          5: {
            cellWidth: scaled(
              columnWidths.asal,
            ),
          },
          6: {
            cellWidth: scaled(
              columnWidths.tujuan,
            ),
          },
          7: {
            cellWidth: scaled(
              columnWidths.kode,
            ),
          },
          8: {
            cellWidth: scaled(
              columnWidths.barang,
            ),
          },
          9: {
            cellWidth: scaled(
              columnWidths.qty,
            ),
            halign: "right",
          },
          10: {
            cellWidth: scaled(
              columnWidths.received,
            ),
            halign: "right",
          },
          11: {
            cellWidth: scaled(
              columnWidths.price,
            ),
            halign: "right",
          },
          12: {
            cellWidth: scaled(
              columnWidths.subtotal,
            ),
            halign: "right",
          },
          13: {
            cellWidth: scaled(
              columnWidths.status,
            ),
            halign: "center",
          },
        },

        didDrawPage: () => {
          drawPdfHeader();

          const currentPage =
            doc.getNumberOfPages();

          doc.setDrawColor(
            226,
            232,
            240,
          );

          doc.setLineWidth(0.2);

          doc.line(
            marginLeft,
            pageHeight - 10,
            pageWidth -
              marginRight,
            pageHeight - 10,
          );

          doc.setFont(
            "helvetica",
            "normal",
          );

          doc.setFontSize(6);

          doc.setTextColor(
            100,
            116,
            139,
          );

          doc.text(
            "Laporan Barang Masuk Outlet",
            marginLeft,
            pageHeight - 6,
          );

          doc.text(
            `Halaman ${currentPage}`,
            pageWidth -
              marginRight,
            pageHeight - 6,
            {
              align: "right",
            },
          );
        },
      });

      const now = new Date();

      const yyyy =
        now.getFullYear();

      const mm = String(
        now.getMonth() + 1,
      ).padStart(2, "0");

      const dd = String(
        now.getDate(),
      ).padStart(2, "0");

      doc.save(
        `Laporan-Barang-Masuk-Outlet-${yyyy}${mm}${dd}.pdf`,
      );
    } catch (err) {
      console.error(
        "EXPORT PDF ERROR:",
        err,
      );

      alert(
        "Gagal membuat PDF.",
      );
    } finally {
      setExporting(false);
    }
  }

  const hasActiveFilter =
    !!dateFrom ||
    !!dateTo ||
    selectedOutlet !== "ALL" ||
    selectedSupplier !== "ALL" ||
    selectedSource !== "ALL" ||
    selectedStatus !== "ALL" ||
    !!search;

  const isOutletAdmin =
    role === "OUTLET_ADMIN" ||
    role === "ADMIN_OUTLET";

  /*
  ==========================================================
  RENDER
  ==========================================================
  */

  return (
    <div className="min-h-screen bg-[#f6f8fb] p-4 md:p-6">
      <div className="mx-auto max-w-[1700px] space-y-5">

        {/* HEADER */}

        <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]">

          <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-slate-50" />

          <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-blue-100/50 blur-3xl" />

          <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-indigo-100/40 blur-3xl" />

          <div className="relative p-6 md:p-7">

            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-start gap-4">

                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-xl shadow-slate-900/15">
                  <Package size={25} />
                </div>

                <div>

                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-600">
                      Inventory Intelligence
                    </span>

                    <span className="h-1 w-1 rounded-full bg-slate-300" />

                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Outlet
                    </span>
                  </div>

                  <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                    Laporan Barang Masuk
                  </h1>

                  <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">
                    Pantau seluruh pergerakan barang
                    yang masuk ke outlet dari supplier,
                    gudang pusat, dan transfer antar outlet.
                  </p>

                </div>

              </div>

              <div className="flex flex-wrap gap-2">

                <button
                  type="button"
                  onClick={() =>
                    loadReport()
                  }
                  disabled={loading}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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

                <button
                  type="button"
                  onClick={exportPDF}
                  disabled={
                    exporting ||
                    loading ||
                    filteredData.length ===
                      0
                  }
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exporting ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <FileDown size={16} />
                  )}

                  {exporting
                    ? "Membuat PDF..."
                    : "Export PDF"}
                </button>

              </div>

            </div>

          </div>
        </section>

        {/* ERROR */}

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">

            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div className="flex-1">
              <div className="font-semibold">
                Gagal memuat laporan
              </div>

              <div className="mt-1">
                {error}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="rounded-lg p-1 hover:bg-red-100"
            >
              <X size={16} />
            </button>

          </div>
        )}

        {/* KPI */}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">

          <KpiCard
            icon={<FileText size={19} />}
            label="Total Transaksi"
            value={formatNumber(
              summary.totalTransaction,
            )}
            description="Dokumen barang masuk"
          />

          <KpiCard
            icon={<Boxes size={19} />}
            label="Total Item"
            value={formatNumber(
              summary.totalItem,
            )}
            description="Baris barang"
          />

          <KpiCard
            icon={
              <ArrowDownToLine size={19} />
            }
            label="Total Qty"
            value={formatNumber(
              summary.totalQty,
            )}
            description="Qty dalam transaksi"
          />

          <KpiCard
            icon={<Package size={19} />}
            label="Qty Diterima"
            value={formatNumber(
              summary.totalReceivedQty,
            )}
            description="Qty yang sudah diterima"
          />

          <KpiCard
            icon={
              <CircleDollarSign size={19} />
            }
            label="Total Nilai"
            value={formatCurrency(
              summary.totalValue,
            )}
            description="Estimasi nilai barang"
          />

        </section>

        {/* SOURCE SUMMARY */}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">

          <SourceSummaryCard
            source="PURCHASE_SUPPLIER"
            count={summary.purchaseSupplier}
          />

          <SourceSummaryCard
            source="WAREHOUSE_TO_OUTLET"
            count={
              summary.warehouseToOutlet
            }
          />

          <SourceSummaryCard
            source="OUTLET_TO_OUTLET"
            count={
              summary.outletToOutlet
            }
          />

        </section>

        {/* FILTER */}

        <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">

          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">

            <div>

              <div className="flex items-center gap-2">

                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Search size={15} />
                </div>

                <h2 className="font-bold text-slate-900">
                  Filter Laporan
                </h2>

              </div>

              <p className="mt-1 pl-10 text-xs text-slate-500">
                Atur periode, outlet, supplier, sumber,
                dan status untuk melihat transaksi yang lebih spesifik.
              </p>

            </div>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilter}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <X size={14} />
                Reset Filter
              </button>
            )}

          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">

            <FilterField
              label="Tanggal Dari"
              icon={
                <CalendarDays size={15} />
              }
            >
              <input
                type="date"
                value={dateFrom}
                onChange={(event) =>
                  setDateFrom(
                    event.target.value,
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              />
            </FilterField>

            <FilterField
              label="Tanggal Sampai"
              icon={
                <CalendarDays size={15} />
              }
            >
              <input
                type="date"
                value={dateTo}
                onChange={(event) =>
                  setDateTo(
                    event.target.value,
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              />
            </FilterField>

            {!isOutletAdmin ? (
              <FilterField
                label="Outlet Tujuan"
                icon={
                  <Building2 size={15} />
                }
              >
                <select
                  value={selectedOutlet}
                  onChange={(event) =>
                    setSelectedOutlet(
                      event.target.value,
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                >
                  <option value="ALL">
                    Semua Outlet
                  </option>

                  {outletOptions.map(
                    (outlet) => (
                      <option
                        key={outlet.id}
                        value={outlet.id}
                      >
                        {outlet.code} -{" "}
                        {outlet.name}
                      </option>
                    ),
                  )}
                </select>
              </FilterField>
            ) : (
              <FilterField
                label="Outlet Tujuan"
                icon={
                  <Building2 size={15} />
                }
              >
                <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600">
                  {outletOptions.find(
                    (item) =>
                      item.id ===
                      userOutletId,
                  )?.name ??
                    "Outlet Saya"}
                </div>
              </FilterField>
            )}

            <FilterField
              label="Supplier"
              icon={
                <Users size={15} />
              }
            >
              <select
                value={selectedSupplier}
                onChange={(event) =>
                  setSelectedSupplier(
                    event.target.value,
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              >
                <option value="ALL">
                  Semua Supplier
                </option>

                {supplierOptions.map(
                  (supplier) => (
                    <option
                      key={supplier.id}
                      value={supplier.id}
                    >
                      {supplier.code} -{" "}
                      {supplier.name}
                    </option>
                  ),
                )}
              </select>
            </FilterField>

            <FilterField
              label="Sumber Barang"
              icon={
                <ArrowDownToLine size={15} />
              }
            >
              <select
                value={selectedSource}
                onChange={(event) =>
                  setSelectedSource(
                    event.target
                      .value as SourceFilter,
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              >
                <option value="ALL">
                  Semua Sumber
                </option>

                <option value="PURCHASE_SUPPLIER">
                  Purchase Supplier
                </option>

                <option value="WAREHOUSE_TO_OUTLET">
                  Gudang / Pusat
                </option>

                <option value="OUTLET_TO_OUTLET">
                  Transfer Antar Outlet
                </option>
              </select>
            </FilterField>

            <FilterField
              label="Status"
              icon={<Package size={15} />}
            >
              <select
                value={selectedStatus}
                onChange={(event) =>
                  setSelectedStatus(
                    event.target
                      .value as StatusFilter,
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              >
                <option value="ALL">
                  Semua Status
                </option>

                <option value="RECEIVED">
                  Diterima
                </option>

                <option value="DELIVERED">
                  Terkirim
                </option>

                <option value="PARTIAL">
                  Sebagian
                </option>

                <option value="SENT">
                  Dikirim
                </option>

                <option value="DRAFT">
                  Draft
                </option>

                <option value="VOID">
                  Void
                </option>
              </select>
            </FilterField>

            <div className="flex items-end lg:col-span-2 xl:col-span-1">

              <button
                type="button"
                onClick={
                  handleApplyFilter
                }
                disabled={loading}
                className="h-11 w-full rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />
                    Memuat...
                  </span>
                ) : (
                  "Tampilkan Laporan"
                )}
              </button>

            </div>

          </div>
        </section>

        {/* ==================================================
            MAIN TABLE
        ================================================== */}

        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.05)]">

          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">

            <div>

              <div className="flex items-center gap-2">

                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-white">
                  <FileText size={15} />
                </div>

                <h2 className="font-bold text-slate-900">
                  Detail Barang Masuk
                </h2>

              </div>

              <p className="mt-1 pl-10 text-xs text-slate-500">
                {formatNumber(
                  filteredData.length,
                )}{" "}
                transaksi ditemukan
              </p>

            </div>

            <div className="relative w-full md:w-[380px]">

              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Cari dokumen, barang, supplier..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X size={15} />
                </button>
              )}

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="min-w-[1250px] w-full border-collapse">

              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">

                  <th className="w-12 px-4 py-3 text-center">
                    #
                  </th>

                  <th className="px-4 py-3">
                    Dokumen
                  </th>

                  <th className="px-4 py-3">
                    Tanggal
                  </th>

                  <th className="px-4 py-3">
                    Sumber
                  </th>

                  <th className="px-4 py-3">
                    Asal
                  </th>

                  <th className="px-4 py-3">
                    Outlet Tujuan
                  </th>

                  <th className="px-4 py-3 text-right">
                    Item
                  </th>

                  <th className="px-4 py-3 text-right">
                    Qty
                  </th>

                  <th className="px-4 py-3 text-right">
                    Diterima
                  </th>

                  <th className="px-4 py-3 text-right">
                    Nilai
                  </th>

                  <th className="px-4 py-3">
                    Status
                  </th>

                  <th className="px-4 py-3 text-center">
                    Detail
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {loading ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="py-24 text-center"
                    >
                      <div className="flex flex-col items-center gap-3 text-slate-500">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                          <Loader2
                            size={24}
                            className="animate-spin"
                          />
                        </div>

                        <span className="text-sm font-medium">
                          Memuat laporan...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="py-24 text-center"
                    >
                      <div className="flex flex-col items-center">

                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                          <Package size={24} />
                        </div>

                        <div className="font-semibold text-slate-700">
                          Tidak ada data
                        </div>

                        <div className="mt-1 max-w-md text-xs leading-5 text-slate-400">
                          Tidak ditemukan transaksi
                          barang masuk sesuai
                          filter yang dipilih.
                        </div>

                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map(
                    (row, index) => (
                      <tr
                        key={row.id}
                        className="group transition hover:bg-slate-50/80"
                      >

                        <td className="px-4 py-4 text-center text-xs font-semibold text-slate-400">
                          {index + 1}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">

                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-slate-900 group-hover:text-white">
                              <FileText size={15} />
                            </div>

                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800">
                                {
                                  row.documentNumber
                                }
                              </div>

                              {row.invoiceNumber && (
                                <div className="mt-1 text-[10px] text-slate-400">
                                  Invoice:{" "}
                                  {
                                    row.invoiceNumber
                                  }
                                </div>
                              )}

                              {row.suratJalanNumber && (
                                <div className="mt-1 text-[10px] text-slate-400">
                                  SJ:{" "}
                                  {
                                    row.suratJalanNumber
                                  }
                                </div>
                              )}
                            </div>

                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-xs font-medium text-slate-600">
                          {formatDate(
                            row.date,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm">
                            <SourceIcon
                              source={
                                row.source
                              }
                            />

                            {getSourceLabel(
                              row.source,
                            )}
                          </div>
                        </td>

                        <td className="max-w-[230px] px-4 py-4">
                          <div className="truncate text-xs font-medium text-slate-700">
                            {getSourceName(
                              row,
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          {row.outlet ? (
                            <div>
                              <div className="text-xs font-bold text-slate-700">
                                {
                                  row.outlet.code
                                }
                              </div>

                              <div className="mt-0.5 text-[10px] text-slate-400">
                                {
                                  row.outlet.name
                                }
                              </div>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td className="px-4 py-4 text-right text-xs font-bold text-slate-700">
                          {formatNumber(
                            row.totalItem,
                          )}
                        </td>

                        <td className="px-4 py-4 text-right text-xs font-bold text-slate-700">
                          {formatNumber(
                            row.totalQty,
                          )}
                        </td>

                        <td className="px-4 py-4 text-right text-xs font-bold text-emerald-700">
                          {formatNumber(
                            row.totalReceivedQty,
                          )}
                        </td>

                        <td className="px-4 py-4 text-right text-xs font-bold text-slate-800">
                          {formatCurrency(
                            row.totalValue,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-bold ${getStatusClass(
                              row.status,
                            )}`}
                          >
                            {getStatusLabel(
                              row.status,
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedRow(
                                row,
                              )
                            }
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-900 hover:text-white"
                          >
                            Detail
                            <ArrowRight
                              size={14}
                            />
                          </button>
                        </td>

                      </tr>
                    ),
                  )
                )}

              </tbody>

            </table>

          </div>

          {!loading &&
            filteredData.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">

                <div>
                  Menampilkan{" "}
                  <span className="font-bold text-slate-700">
                    {formatNumber(
                      filteredData.length,
                    )}
                  </span>{" "}
                  transaksi
                </div>

                <div className="flex flex-wrap gap-5">

                  <span>
                    Diterima:{" "}
                    <b className="text-emerald-700">
                      {formatNumber(
                        summary.received,
                      )}
                    </b>
                  </span>

                  <span>
                    Partial:{" "}
                    <b className="text-amber-700">
                      {formatNumber(
                        summary.partial,
                      )}
                    </b>
                  </span>

                  <span>
                    Menunggu:{" "}
                    <b className="text-blue-700">
                      {formatNumber(
                        summary.waiting,
                      )}
                    </b>
                  </span>

                  <span>
                    Void:{" "}
                    <b className="text-red-700">
                      {formatNumber(
                        summary.void,
                      )}
                    </b>
                  </span>

                </div>
              </div>
            )}

        </section>

        {/* ==================================================
            INVOICE SUPPLIER TABLE
        ================================================== */}

        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.05)]">

          <div className="relative overflow-hidden border-b border-slate-100">

            <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-emerald-100/50 blur-3xl" />

            <div className="relative flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">

              <div className="flex items-start gap-3">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Receipt size={19} />
                </div>

                <div>

                  <div className="flex items-center gap-2">

                    <h2 className="font-bold text-slate-900">
                      Invoice Supplier
                    </h2>

                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                      Purchase Supplier
                    </span>

                  </div>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Daftar invoice supplier dari transaksi
                    Purchase Supplier sesuai filter laporan.
                  </p>

                </div>

              </div>

              <div className="flex flex-wrap gap-2">

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Invoice
                  </div>

                  <div className="mt-0.5 text-sm font-bold text-slate-900">
                    {formatNumber(
                      supplierInvoiceSummary.count,
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Qty
                  </div>

                  <div className="mt-0.5 text-sm font-bold text-slate-900">
                    {formatNumber(
                      supplierInvoiceSummary.totalQty,
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Nilai
                  </div>

                  <div className="mt-0.5 text-sm font-bold text-slate-900">
                    {formatCurrency(
                      supplierInvoiceSummary.totalValue,
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="min-w-[1350px] w-full border-collapse">

              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">

                  <th className="w-12 px-4 py-3 text-center">
                    #
                  </th>

                  <th className="px-4 py-3">
                    Invoice Supplier
                  </th>

                  <th className="px-4 py-3">
                    Dokumen Purchase
                  </th>

                  <th className="px-4 py-3">
                    Tanggal
                  </th>

                  <th className="px-4 py-3">
                    Supplier
                  </th>

                  <th className="px-4 py-3">
                    Outlet Tujuan
                  </th>

                  <th className="px-4 py-3 text-right">
                    Item
                  </th>

                  <th className="px-4 py-3 text-right">
                    Qty
                  </th>

                  <th className="px-4 py-3 text-right">
                    Diterima
                  </th>

                  <th className="px-4 py-3 text-right">
                    Nilai
                  </th>

                  <th className="px-4 py-3">
                    Status
                  </th>

                  <th className="px-4 py-3 text-center">
                    Detail
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {loading ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="py-20 text-center"
                    >
                      <div className="flex flex-col items-center gap-3 text-slate-500">

                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                          <Loader2
                            size={23}
                            className="animate-spin"
                          />
                        </div>

                        <span className="text-sm font-medium">
                          Memuat invoice supplier...
                        </span>

                      </div>
                    </td>
                  </tr>
                ) : supplierInvoiceRows.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="py-20 text-center"
                    >
                      <div className="flex flex-col items-center">

                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                          <Receipt size={24} />
                        </div>

                        <div className="font-semibold text-slate-700">
                          Tidak ada Invoice Supplier
                        </div>

                        <div className="mt-1 max-w-md text-xs leading-5 text-slate-400">
                          Tidak ditemukan invoice supplier
                          pada transaksi yang sesuai dengan
                          filter saat ini.
                        </div>

                      </div>
                    </td>
                  </tr>
                ) : (
                  supplierInvoiceRows.map(
                    (row, index) => (
                      <tr
                        key={`invoice-${row.id}`}
                        className="group transition hover:bg-emerald-50/30"
                      >

                        <td className="px-4 py-4 text-center text-xs font-semibold text-slate-400">
                          {index + 1}
                        </td>

                        <td className="px-4 py-4">

                          <div className="flex items-center gap-3">

                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
                              <Receipt size={16} />
                            </div>

                            <div className="min-w-0">

                              <div className="font-bold text-slate-900">
                                {
                                  row.invoiceNumber
                                }
                              </div>

                              <div className="mt-1 text-[10px] text-slate-400">
                                Invoice Supplier
                              </div>

                            </div>

                          </div>

                        </td>

                        <td className="px-4 py-4">

                          <div className="font-semibold text-slate-700">
                            {
                              row.documentNumber
                            }
                          </div>

                          {row.suratJalanNumber && (
                            <div className="mt-1 text-[10px] text-slate-400">
                              SJ:{" "}
                              {
                                row.suratJalanNumber
                              }
                            </div>
                          )}

                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-xs font-medium text-slate-600">
                          {formatDate(
                            row.date,
                          )}
                        </td>

                        <td className="px-4 py-4">

                          {row.supplier ? (
                            <div>
                              <div className="text-xs font-bold text-slate-700">
                                {
                                  row.supplier.code
                                }
                              </div>

                              <div className="mt-0.5 max-w-[230px] truncate text-[10px] text-slate-400">
                                {
                                  row.supplier.name
                                }
                              </div>
                            </div>
                          ) : (
                            "-"
                          )}

                        </td>

                        <td className="px-4 py-4">

                          {row.outlet ? (
                            <div>
                              <div className="text-xs font-bold text-slate-700">
                                {
                                  row.outlet.code
                                }
                              </div>

                              <div className="mt-0.5 max-w-[180px] truncate text-[10px] text-slate-400">
                                {
                                  row.outlet.name
                                }
                              </div>
                            </div>
                          ) : (
                            "-"
                          )}

                        </td>

                        <td className="px-4 py-4 text-right text-xs font-bold text-slate-700">
                          {formatNumber(
                            row.totalItem,
                          )}
                        </td>

                        <td className="px-4 py-4 text-right text-xs font-bold text-slate-800">
                          {formatNumber(
                            row.totalQty,
                          )}
                        </td>

                        <td className="px-4 py-4 text-right text-xs font-bold text-emerald-700">
                          {formatNumber(
                            row.totalReceivedQty,
                          )}
                        </td>

                        <td className="px-4 py-4 text-right">

                          <div className="text-xs font-bold text-slate-900">
                            {formatCurrency(
                              row.totalValue,
                            )}
                          </div>

                        </td>

                        <td className="px-4 py-4">

                          <span
                            className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-bold ${getStatusClass(
                              row.status,
                            )}`}
                          >
                            {getStatusLabel(
                              row.status,
                            )}
                          </span>

                        </td>

                        <td className="px-4 py-4 text-center">

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedRow(
                                row,
                              )
                            }
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-600 hover:text-white"
                          >
                            Detail
                            <ArrowRight
                              size={14}
                            />
                          </button>

                        </td>

                      </tr>
                    ),
                  )
                )}

              </tbody>

            </table>

          </div>

          {!loading &&
            supplierInvoiceRows.length >
              0 && (
              <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">

                <div>
                  Menampilkan{" "}
                  <span className="font-bold text-slate-700">
                    {formatNumber(
                      supplierInvoiceSummary.count,
                    )}
                  </span>{" "}
                  invoice supplier
                </div>

                <div className="flex flex-wrap gap-5">

                  <span>
                    Qty:{" "}
                    <b className="text-slate-800">
                      {formatNumber(
                        supplierInvoiceSummary.totalQty,
                      )}
                    </b>
                  </span>

                  <span>
                    Diterima:{" "}
                    <b className="text-emerald-700">
                      {formatNumber(
                        supplierInvoiceSummary.totalReceived,
                      )}
                    </b>
                  </span>

                  <span>
                    Nilai:{" "}
                    <b className="text-slate-900">
                      {formatCurrency(
                        supplierInvoiceSummary.totalValue,
                      )}
                    </b>
                  </span>

                </div>

              </div>
            )}

        </section>

        {/* SECURITY INFO */}

        {isOutletAdmin && (
          <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-700">

            <Building2 size={16} />

            <span>
              Laporan dibatasi otomatis ke outlet
              yang terhubung dengan akun Anda.
            </span>

          </div>
        )}

      </div>

      {/* ====================================================
          DETAIL DRAWER
      ==================================================== */}

      {selectedRow && (
        <div
          className="fixed inset-0 z-[100] flex justify-end"
          role="dialog"
          aria-modal="true"
        >

          <button
            type="button"
            aria-label="Tutup detail"
            onClick={() =>
              setSelectedRow(null)
            }
            className="absolute inset-0 cursor-default bg-slate-950/40 backdrop-blur-[3px]"
          />

          <aside className="relative flex h-full w-full max-w-[720px] flex-col bg-[#f8fafc] shadow-2xl">

            <div className="relative overflow-hidden border-b border-slate-200 bg-white">

              <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-100/60 blur-3xl" />

              <div className="relative p-5">

                <div className="flex items-start justify-between gap-4">

                  <div className="flex min-w-0 items-start gap-3">

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg">
                      <FileText size={19} />
                    </div>

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-2">

                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">
                          Detail Transaksi
                        </span>

                        <span className="h-1 w-1 rounded-full bg-slate-300" />

                        <span
                          className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${getStatusClass(
                            selectedRow.status,
                          )}`}
                        >
                          {getStatusLabel(
                            selectedRow.status,
                          )}
                        </span>

                      </div>

                      <h2 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-950">
                        {
                          selectedRow.documentNumber
                        }
                      </h2>

                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                        <CalendarDays size={13} />
                        {formatDate(
                          selectedRow.date,
                        )}
                      </div>

                    </div>

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedRow(null)
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <X size={17} />
                  </button>

                </div>

                <div className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
                    <SourceIcon
                      source={
                        selectedRow.source
                      }
                    />
                  </div>

                  <div className="min-w-0 flex-1">

                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Sumber Barang
                    </div>

                    <div className="mt-0.5 truncate text-sm font-bold text-slate-800">
                      {getSourceLabel(
                        selectedRow.source,
                      )}
                    </div>

                  </div>

                  <ArrowRight
                    size={17}
                    className="text-slate-300"
                  />

                  <div className="min-w-0 flex-1 text-right">

                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Outlet Tujuan
                    </div>

                    <div className="mt-0.5 truncate text-sm font-bold text-slate-800">
                      {getOutletName(
                        selectedRow,
                      )}
                    </div>

                  </div>

                </div>

              </div>
            </div>

            <div className="flex-1 overflow-y-auto">

              <div className="space-y-4 p-5">

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                  <DetailMetric
                    icon={<Boxes size={16} />}
                    label="Item"
                    value={formatNumber(
                      selectedRow.totalItem,
                    )}
                  />

                  <DetailMetric
                    icon={
                      <Package size={16} />
                    }
                    label="Qty"
                    value={formatNumber(
                      selectedRow.totalQty,
                    )}
                  />

                  <DetailMetric
                    icon={
                      <ArrowDownToLine size={16} />
                    }
                    label="Diterima"
                    value={formatNumber(
                      selectedRow.totalReceivedQty,
                    )}
                    valueClass="text-emerald-700"
                  />

                  <DetailMetric
                    icon={
                      <CircleDollarSign size={16} />
                    }
                    label="Nilai"
                    value={formatCurrency(
                      selectedRow.totalValue,
                    )}
                  />

                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Informasi Transaksi
                    </div>
                  </div>

                  <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">

                    <div className="space-y-4 p-4">

                      <InfoRow
                        icon={<Hash size={15} />}
                        label="Nomor Dokumen"
                        value={
                          selectedRow.documentNumber
                        }
                      />

                      <InfoRow
                        icon={
                          <CalendarDays size={15} />
                        }
                        label="Tanggal Transaksi"
                        value={formatDate(
                          selectedRow.date,
                        )}
                      />

                      <InfoRow
                        icon={
                          <Warehouse size={15} />
                        }
                        label="Sumber"
                        value={getSourceName(
                          selectedRow,
                        )}
                      />

                    </div>

                    <div className="space-y-4 p-4">

                      <InfoRow
                        icon={
                          <Building2 size={15} />
                        }
                        label="Outlet Tujuan"
                        value={getOutletName(
                          selectedRow,
                        )}
                      />

                      <InfoRow
                        icon={
                          <Receipt size={15} />
                        }
                        label={
                          selectedRow.source ===
                          "PURCHASE_SUPPLIER"
                            ? "Invoice Supplier"
                            : "Invoice"
                        }
                        value={
                          selectedRow.invoiceNumber ||
                          "-"
                        }
                      />

                      <InfoRow
                        icon={<Truck size={15} />}
                        label="Surat Jalan"
                        value={
                          selectedRow.suratJalanNumber ||
                          "-"
                        }
                      />

                    </div>

                  </div>

                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

                    <div className="flex items-center gap-2">

                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <Clock3 size={15} />
                      </div>

                      <div>

                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Diterima
                        </div>

                        <div className="mt-0.5 text-xs font-bold text-slate-700">
                          {formatDateTime(
                            selectedRow.receivedAt,
                          )}
                        </div>

                      </div>

                    </div>

                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

                    <div className="flex items-center gap-2">

                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <MapPin size={15} />
                      </div>

                      <div className="min-w-0">

                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Outlet
                        </div>

                        <div className="mt-0.5 truncate text-xs font-bold text-slate-700">
                          {
                            selectedRow.outlet
                              ?.name ??
                            "-"
                          }
                        </div>

                      </div>

                    </div>

                  </div>

                </div>

                {selectedRow.source ===
                  "PURCHASE_SUPPLIER" && (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">

                    <div className="flex items-center gap-3">

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                        <Users size={16} />
                      </div>

                      <div className="min-w-0">

                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                          Supplier
                        </div>

                        <div className="mt-0.5 truncate text-sm font-bold text-slate-800">
                          {selectedRow.supplier
                            ? `${selectedRow.supplier.code} - ${selectedRow.supplier.name}`
                            : "-"}
                        </div>

                      </div>

                    </div>

                  </div>
                )}

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">

                    <div>

                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                        Detail Barang
                      </div>

                      <div className="mt-1 text-sm font-bold text-slate-800">
                        {formatNumber(
                          selectedRow.items.length,
                        )}{" "}
                        jenis barang
                      </div>

                    </div>

                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <Boxes size={15} />
                    </div>

                  </div>

                  {selectedRow.items.length ===
                  0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Tidak ada detail barang.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">

                      {selectedRow.items.map(
                        (item) => (
                          <div
                            key={`${selectedRow.id}-${item.barangId}`}
                            className="p-4 transition hover:bg-slate-50"
                          >

                            <div className="flex items-start gap-3">

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                                <Package size={17} />
                              </div>

                              <div className="min-w-0 flex-1">

                                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">

                                  <div className="min-w-0">

                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                      {item.code}
                                    </div>

                                    <div className="mt-0.5 font-semibold text-slate-800">
                                      {item.name}
                                    </div>

                                    {(item.brand ||
                                      item.category) && (
                                      <div className="mt-1 text-[10px] text-slate-400">
                                        {item.brand}

                                        {item.brand &&
                                          item.category &&
                                          " • "}

                                        {item.category}
                                      </div>
                                    )}

                                  </div>

                                  <div className="text-left sm:text-right">

                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                      Subtotal
                                    </div>

                                    <div className="mt-0.5 text-sm font-bold text-slate-900">
                                      {formatCurrency(
                                        item.subtotal,
                                      )}
                                    </div>

                                  </div>

                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">

                                  <MiniItemStat
                                    label="Qty"
                                    value={formatNumber(
                                      item.qty,
                                    )}
                                  />

                                  <MiniItemStat
                                    label="Diterima"
                                    value={formatNumber(
                                      item.receivedQty,
                                    )}
                                    valueClass="text-emerald-700"
                                  />

                                  <MiniItemStat
                                    label="Satuan"
                                    value={
                                      item.unit ||
                                      "-"
                                    }
                                  />

                                  <MiniItemStat
                                    label="Harga"
                                    value={formatCurrency(
                                      item.price,
                                    )}
                                  />

                                </div>

                              </div>

                            </div>

                          </div>
                        ),
                      )}

                    </div>
                  )}

                </div>

                {selectedRow.remarks && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

                    <div className="flex items-start gap-3">

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <FileText size={15} />
                      </div>

                      <div>

                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Catatan
                        </div>

                        <div className="mt-1 text-xs leading-5 text-slate-600">
                          {
                            selectedRow.remarks
                          }
                        </div>

                      </div>

                    </div>

                  </div>
                )}

              </div>

            </div>

            <div className="border-t border-slate-200 bg-white p-4">

              <button
                type="button"
                onClick={() =>
                  setSelectedRow(null)
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Tutup Detail
              </button>

            </div>

          </aside>

        </div>
      )}

    </div>
  );
}

/*
============================================================
DETAIL METRIC
============================================================
*/

function DetailMetric({
  icon,
  label,
  value,
  valueClass = "text-slate-900",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">

      <div className="flex items-center gap-2">

        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          {icon}
        </div>

        <div className="min-w-0">

          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
            {label}
          </div>

          <div
            className={`mt-0.5 truncate text-sm font-bold ${valueClass}`}
          >
            {value}
          </div>

        </div>

      </div>

    </div>
  );
}

/*
============================================================
INFO ROW
============================================================
*/

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </div>

      <div className="min-w-0 flex-1">

        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </div>

        <div className="mt-1 break-words text-xs font-semibold text-slate-700">
          {value}
        </div>

      </div>

    </div>
  );
}

/*
============================================================
MINI ITEM STAT
============================================================
*/

function MiniItemStat({
  label,
  value,
  valueClass = "text-slate-700",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">

      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>

      <div
        className={`mt-0.5 text-xs font-bold ${valueClass}`}
      >
        {value}
      </div>

    </div>
  );
}

/*
============================================================
KPI CARD
============================================================
*/

function KpiCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_5px_20px_rgba(15,23,42,0.035)] transition hover:-translate-y-0.5 hover:shadow-lg">

      <div className="flex items-start justify-between gap-3">

        <div>

          <div className="text-[11px] font-semibold text-slate-500">
            {label}
          </div>

          <div className="mt-2 text-xl font-bold tracking-tight text-slate-950">
            {value}
          </div>

          <div className="mt-1 text-[10px] text-slate-400">
            {description}
          </div>

        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-slate-950 group-hover:text-white">
          {icon}
        </div>

      </div>

    </div>
  );
}

/*
============================================================
SOURCE SUMMARY
============================================================
*/

function SourceSummaryCard({
  source,
  count,
}: {
  source: SourceType;
  count: number;
}) {
  return (
    <div className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_5px_20px_rgba(15,23,42,0.035)] transition hover:-translate-y-0.5 hover:shadow-lg">

      <div className="flex items-center gap-3">

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-slate-950 group-hover:text-white">

          {source ===
          "PURCHASE_SUPPLIER" ? (
            <Users size={17} />
          ) : source ===
            "WAREHOUSE_TO_OUTLET" ? (
            <Truck size={17} />
          ) : (
            <ArrowDownToLine size={17} />
          )}

        </div>

        <div>

          <div className="text-xs font-bold text-slate-700">
            {getSourceLabel(source)}
          </div>

          <div className="mt-0.5 text-[10px] text-slate-400">
            Jumlah transaksi
          </div>

        </div>

      </div>

      <div className="text-lg font-bold text-slate-950">
        {formatNumber(count)}
      </div>

    </div>
  );
}

/*
============================================================
FILTER FIELD
============================================================
*/

function FilterField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>

      <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
        {icon}
        {label}
      </label>

      {children}

    </div>
  );
}